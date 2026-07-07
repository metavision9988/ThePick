/**
 * Graph-augmented search route — 독립 `/api/search/graph` 엔드포인트 (옵션 C).
 *
 * 근거: docs/plans/graph-walk-s5-integration.plan.md §2 (PITR) / §4 S5-3 +
 *   S5-0 진산 결재 6-B **옵션 C** (2026-05-15 Session 086). ADR-045 / ADR-044.
 *
 * ★ Engine-First / 회귀 표면 0:
 *   기존 `/api/search`(`createUserSearchRoutes`)·`searchKnowledgeNodesForUser`
 *   는 **불변**. 본 라우트는 opt-in 신규 경로로 graph-walk multi-hop 확장을
 *   격리 노출 — 학습자 정상 경로(Stage 2.5 통합 = 옵션 A)는 S5-6 baseline
 *   후 **차기 별도 결재** (자율 통합 금지, plan §4 S5-7 / handoff-086).
 *
 * 파이프라인 (정상 경로 *복제 아님* — 기존 함수 재사용):
 *   1. `searchKnowledgeNodesForUser` (Stage 1 Vector → 2 approved → 3 re-rank)
 *      = vector-only **baseline** (그대로 응답에 포함 → S5-6 A/B 비교 격리).
 *   2. baseline approved 시드에서 `graphWalk` N-hop 확장 (graph-walk 모듈 불변).
 *   3. 확장 노드 = graph-walk projection(S5-2 단일 진실원 SQL + description
 *      동봉, CO6-1) 을 `NodeHitSource` 로 직접 매핑 — **2차 조회 없음**.
 *   4. baseline + 확장 병합 → `compareByTruthWeightThenScore`
 *      (**Stage 3 단일 진실원 공유** — graph-walk 2차 truth_weight 정책 금지,
 *      CO-3). graph-walk 은 hop-distance 로 recall bound 만 책임.
 *
 * fail-loud: graph-walk / D1 실패는 빈 결과로 삼키지 않고 전파 (CLAUDE.md
 *   빈 catch 금지). 시드 0건(graceful/stage2=0)은 정상 — 확장 미적용 명시.
 *
 * debug 플래그 (MASTER_PLAN WS-4 4c, 기본 off — 응답 계약 additive):
 *   (a) `graphExpansion.expandedNodes` 확장 전체집합 surface (랭크미달 vs
 *       미도달 진단, G-WS4 ③)
 *   (b) query 상한 500 → GRAPH_QUERY_DEBUG_MAX_LENGTH 측정 경로 한정 우회
 *       (golden Q-004 583자 영구 제외 해소, G-WS4 ④ — 공개 계약 500 불변)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  ErrorCode,
  assertValidExamId,
  createLogger,
  type ExamId,
  type LoggerEnvironment,
} from '@thepick/shared';
import {
  embedQuery,
  searchKnowledgeNodesForUser,
  buildHit,
  compareByTruthWeightThenScore,
  UserSearchError,
  DEFAULT_RESULT_TOP_K,
  MAX_RESULT_TOP_K,
  type UserSearchDeps,
  type UserSearchHit,
  type UserSearchResult,
  type VectorizeQueryBinding,
  type UserSearchD1,
  type NodeHitSource,
} from './user-search.js';
import {
  graphWalk,
  GraphWalkError,
  MAX_ALLOWED_DEPTH,
  MAX_ALLOWED_RESULT_CAP,
  type GraphWalkD1,
  type GraphWalkNode,
} from './graph-walk/index.js';
import { runKeywordFallback } from './multi-path-fallback/keyword-fallback.js';
import type { AiBinding } from '../vectorize/upserter.js';
import { getClientIp, type RateLimiter } from '../auth/rate-limit.js';

export interface GraphSearchRouteBindings {
  readonly DB: D1Database;
  readonly VECTORIZE: VectorizeQueryBinding;
  readonly AI: AiBinding;
  readonly SEARCH_RATE_LIMITER_IP?: RateLimiter;
  readonly ENVIRONMENT?: string;
}

/**
 * baseline 상위 시드 중 graph-walk 를 실행할 최대 개수 — CPU 상한 (plan §0
 * Reality Anchor #1). 각 시드 walk = 재귀 쿼리 1회. 시드 수 × walk 비용을
 * bound. 5 = 정상 topK(3)·MAX(10) 대비 충분(중복 확장은 dedup 으로 흡수).
 */
export const GRAPH_SEED_WALK_LIMIT = 5;

/**
 * 공개 계약 query 상한 — 기존 500 **유지** (`/api/search` routes.ts:61 정합,
 * DoS/임베딩 비용 가드). MASTER_PLAN WS-4 4c "query 500자 천장 처리" 는
 * 공개 계약 분리가 아닌 **측정 경로 한정 우회**(debug 플래그 결합 상향)로
 * 처분 — 보수적 택1.
 */
export const GRAPH_QUERY_PUBLIC_MAX_LENGTH = 500;

/**
 * debug(측정) 플래그 결합 시 query 절대 상한 — golden Q-004(583자, queryBody
 * 정화로도 미회복 → 종전 영구 제외)와 정화 전 최장 golden(Q-015 원문 922자)
 * 을 여유 있게 커버. bge-m3 입력 한도(8192 tokens) 대비 안전 + rate-limit
 * (60/min per IP) 병행으로 남용 표면 bounded. 무제한이 아닌 절대 상한 유지
 * (Reality Anchor — 측정 경로도 계약은 있다).
 */
export const GRAPH_QUERY_DEBUG_MAX_LENGTH = 2000;

const GraphSearchBodySchema = z
  .object({
    examId: z.string().min(1),
    query: z.string().min(1).max(GRAPH_QUERY_DEBUG_MAX_LENGTH),
    topK: z.number().int().min(1).max(MAX_RESULT_TOP_K).default(DEFAULT_RESULT_TOP_K),
    /**
     * graph-walk maxDepth. HTTP 계약 상한 = 엔진 hard ceiling
     * `MAX_ALLOWED_DEPTH`(D-2=4). 초과 시 silent clamp 아닌 **400 정직 거부**
     * (S5-5 Pass3 Minor-1). 엔진 clampInt 는 방어선으로 잔존(이중 방어).
     */
    maxDepth: z.number().int().min(1).max(MAX_ALLOWED_DEPTH).optional(),
    /** graph-walk resultCap. HTTP 상한 = 엔진 `MAX_ALLOWED_RESULT_CAP`. */
    resultCap: z.number().int().min(1).max(MAX_ALLOWED_RESULT_CAP).optional(),
    /**
     * 진단·측정 플래그 (MASTER_PLAN WS-4 4c, 기본 off). true 시:
     *   (a) `graphExpansion.expandedNodes` 로 graph 확장 전체집합 surface
     *       — 랭크미달 vs 미도달 판별(Binary Gate G-WS4 ③) 재료.
     *   (b) query 상한 500 → `GRAPH_QUERY_DEBUG_MAX_LENGTH` 상향
     *       — golden Q-004(583자) 측정 포함(G-WS4 ④), 공개 계약 500 불변.
     * 응답 계약 additive — 기존 필드 전부 불변.
     */
    debug: z.boolean().default(false),
    /**
     * Phase 1-D 비교군 모드 (lexical-fusion-phase1d.plan.md rev3).
     * 'graph'(default) = 기존 계약 byte-동치. 'lexical' = graph-walk 무접촉,
     * vector pool(10) 을 lexical 신호로 ε-양자화 재정렬(주입 없음 — M-2).
     * 측정 전용: mode='lexical' 은 debug=true 필수(superRefine).
     */
    mode: z.enum(['graph', 'lexical']).default('graph'),
    /**
     * lexical ε-band 폭 (감도 스윕 M-5·동치 테스트 m-4 전용). graph 경로는
     * eps 미독(무시 — rev3 m-N2). 기본 0.03(provenance: F2 실측 Δ0.02 유래 —
     * 측정셋 적합·일반화 근거 아님, plan §0-7).
     */
    eps: z.number().min(0).max(0.1).default(0.03),
  })
  .superRefine((data, ctx) => {
    // 공개 계약(debug 미사용) = 종전 그대로 500 상한. debug=true 만 측정
    // 경로 한정 우회 — silent 완화 아닌 명시 opt-in.
    if (!data.debug && data.query.length > GRAPH_QUERY_PUBLIC_MAX_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: GRAPH_QUERY_PUBLIC_MAX_LENGTH,
        type: 'string',
        inclusive: true,
        path: ['query'],
        message: `query length > ${GRAPH_QUERY_PUBLIC_MAX_LENGTH} (public contract; debug flag required)`,
      });
    }
    // mode='lexical' = 측정 전용 명시 게이트 (plan rev3 m-3 — 공개 남용 표면 차단).
    if (data.mode === 'lexical' && !data.debug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mode'],
        message: `mode='lexical' requires debug=true (measurement-only path)`,
      });
    }
  });

/**
 * debug=true 한정 확장 노드 진단 뷰 — `GraphWalkNode` 에서 description 만
 * 제외(법령 본문 텍스트 payload 비대 차단; 진단은 id/depth/weight 로 충분).
 */
export interface GraphExpansionDebugNode {
  readonly id: string;
  /** 시드로부터 hop 거리 (시드별 최단 — 다중 시드 재도달은 첫 도달분 1회). */
  readonly depth: number;
  readonly type: string;
  readonly name: string;
  readonly truthWeight: number;
  readonly pageRef: string | null;
}

interface GraphExpansionMeta {
  readonly applied: boolean;
  /** 미적용 사유 (시드 0건 등) — applied=false 일 때만. */
  readonly reason?: 'no_approved_seed';
  readonly seedWalkCount: number;
  readonly expandedNodeCount: number;
  /**
   * 시드 walk 중 하나라도 resultCap 초과로 절단됐는가 (S5-5 CO6-2).
   * silent 절단된 부분집합에서 정답률을 재면 baseline 이 왜곡되므로 측정
   * 무결성 상 반드시 surface — true 면 해당 baseline 표본은 절단 보정 필요.
   */
  readonly truncated: boolean;
  readonly maxDepth: number;
  readonly resultCap: number;
  readonly edgeTypeWhitelist: ReadonlyArray<string>;
  /**
   * debug=true 한정 — graph 확장 전체집합 (dedup 후, baseline 교집합 제외분.
   * 교집합 노드는 `baseline.results` 로 이미 관측 가능). 진단 규약(MASTER_PLAN
   * WS-4 4c / G-WS4 ③): 정답 노드가 이 집합에 있으나 `results` top-K 밖 =
   * **랭크미달**, 이 집합에도 `baseline.results` 에도 없음 = **미도달**.
   * 기본 off — 응답 계약 additive (기존 소비자 shape 불변).
   */
  readonly expandedNodes?: ReadonlyArray<GraphExpansionDebugNode>;
}

/** Phase 1-D lexical 모드 additive 메타 (plan rev3 §2-3 — 채점 코어 무접촉 필드). */
interface LexicalFusionMeta {
  readonly eps: number;
  readonly poolSize: number;
  /** pool 중 lexical 신호(lexScore>0)가 붙은 후보 수. */
  readonly lexMatchedCount: number;
  /** 재정렬로 top-K 에서 밀려난 원 baseline hit 수 (M-2(iii) — regression 귀속용). */
  readonly displacedBaselineHits: number;
  readonly matchedTokens: ReadonlyArray<string>;
  /** debug 한정 — pool 밖 lexical 히트 id (랭킹 무개입, 관측 전용 — rev3 Anchor 2). */
  readonly lexicalOnlyObserved?: ReadonlyArray<string>;
}

interface GraphSearchResponse {
  readonly query: string;
  readonly examId: ExamId;
  readonly topK: number;
  /** vector-only Stage1+2+3 결과 (S5-6 A/B 비교 baseline — 그대로 보존). */
  readonly baseline: UserSearchResult;
  readonly graphExpansion: GraphExpansionMeta;
  /** baseline + graph 확장 병합 후 Stage 3 단일 진실원 재정렬 top-K. */
  readonly results: ReadonlyArray<UserSearchHit>;
  /** mode='lexical' 한정 additive (graph 모드 응답 byte-불변 — G-1D-2). */
  readonly lexicalFusion?: LexicalFusionMeta;
}

/**
 * Phase 1-D 재정렬 — ε-양자화 밴드키 **전순서** (plan rev3 §2-2, 리뷰 C-1 수리).
 *
 * 정렬키 = (truthWeight DESC, band DESC, lexScore DESC, score DESC),
 *   band = eps>0 ? floor(score/eps) : score — **전 키가 원소 단독 함수** = 추이성
 *   구성적 보장(쌍별 ε-band 비교자는 비추이 → sort 미정의 동작 실증·폐기).
 * 성질: lex 전원 0 → compareByTruthWeightThenScore 완전 동치(동점 포함) /
 *   ε=0 → 정확 동점에서만 lex 개입(순수 tiebreak 의도 동작). 경계쌍 비대칭
 *   (0.599/0.601 상이 band) = 양자화의 문서화된 대가.
 * tie 최후 = 안정 정렬 입력순(ES2019 보장 — 원 비교자와 동일 관례).
 */
export function lexicalRerank(
  pool: ReadonlyArray<UserSearchHit>,
  lexScores: ReadonlyMap<string, number>,
  eps: number,
): ReadonlyArray<UserSearchHit> {
  const keyed = pool.map((hit) => ({
    hit,
    lex: lexScores.get(hit.id) ?? 0,
    band: eps > 0 ? Math.floor(hit.score / eps) : hit.score,
  }));
  const sorted = [...keyed].sort(
    (a, b) =>
      b.hit.truthWeight - a.hit.truthWeight ||
      b.band - a.band ||
      b.lex - a.lex ||
      b.hit.score - a.hit.score,
  );
  return sorted.map((k) => k.hit);
}

export function createGraphSearchRoutes(): Hono<{ Bindings: GraphSearchRouteBindings }> {
  const app = new Hono<{ Bindings: GraphSearchRouteBindings }>();

  app.post('/', async (c) => {
    const limiter = c.env.SEARCH_RATE_LIMITER_IP;
    if (limiter !== undefined) {
      const ip = getClientIp(c);
      const { success } = await limiter.limit({ key: ip });
      if (!success) {
        c.header('Retry-After', '60');
        return c.json({ error: 'TOO_MANY_REQUESTS' }, 429);
      }
    }

    const raw = await c.req.json().catch(() => null);
    const parsed = GraphSearchBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: ErrorCode.VALIDATION_ERROR, details: parsed.error.format() }, 400);
    }
    const { examId: rawExamId, query, topK, maxDepth, resultCap, debug, mode, eps } = parsed.data;

    let examId: ExamId;
    try {
      examId = assertValidExamId(rawExamId);
    } catch {
      return c.json({ error: ErrorCode.VALIDATION_ERROR, message: 'INVALID_EXAM_ID' }, 400);
    }

    const env = c.env.ENVIRONMENT ?? 'production';
    const logger = createLogger({
      service: 'thepick-api',
      environment: env as LoggerEnvironment,
    });
    // S5-5 CO6-3: 성공 경로도 elapsed 측정 — silent degradation(상태 회귀로
    // expansion 0, 절단) 을 on-call/측정에서 관측 가능하게. 측정 무결성 직결.
    const startedAt = Date.now();
    const logOk = (meta: GraphExpansionMeta): void => {
      logger.info('graph_search_ok', {
        module: 'search/graph',
        examId,
        applied: meta.applied,
        reason: meta.reason,
        seedWalkCount: meta.seedWalkCount,
        expandedNodeCount: meta.expandedNodeCount,
        truncated: meta.truncated,
        // 측정 경로 식별 — debug=true 는 query 상한 우회·payload 확대 요청이라
        // on-call 이 정상/측정 트래픽을 로그에서 분리 가능해야 한다 (4c).
        debug,
        elapsedMs: Date.now() - startedAt,
      });
    };

    try {
      const deps: UserSearchDeps = {
        ai: c.env.AI,
        vectorize: c.env.VECTORIZE,
        db: c.env.DB as unknown as UserSearchD1,
      };

      // 1. vector-only baseline (기존 함수 재사용 — 정상 경로 불변).
      //    임베딩 1회 계산 → baseline 에 재사용 (Workers AI 호출 절감).
      const queryEmbedding = await embedQuery(c.env.AI, query);
      const baseline = await searchKnowledgeNodesForUser(deps, examId, query, topK, {
        precomputedEmbedding: queryEmbedding,
      });

      const walkDb = c.env.DB as unknown as GraphWalkD1;
      const baselineIds = new Set(baseline.results.map((h) => h.id));

      // 시드 = baseline approved 결과(이미 truth_weight 재정렬됨) 상위 N.
      const seeds = baseline.results.slice(0, GRAPH_SEED_WALK_LIMIT);

      // 시드 0건 = graceful/stage2=0. graph-walk 는 approved 시드 필요 →
      // 확장 미적용 명시 (silent fallback 금지, fail-loud 와 구분되는 정상).
      if (seeds.length === 0) {
        const meta: GraphExpansionMeta = {
          applied: false,
          reason: 'no_approved_seed',
          seedWalkCount: 0,
          expandedNodeCount: 0,
          truncated: false,
          maxDepth: maxDepth ?? 0,
          resultCap: resultCap ?? 0,
          edgeTypeWhitelist: [],
          // debug 계약 일관성 — 플래그 on 이면 필드 상시 존재 (walk 미실행 = 빈 집합)
          ...(debug ? { expandedNodes: [] as ReadonlyArray<GraphExpansionDebugNode> } : {}),
        };
        const resp: GraphSearchResponse = {
          query,
          examId,
          topK: baseline.topK,
          baseline,
          graphExpansion: meta,
          results: baseline.results,
        };
        logOk(meta);
        return c.json(resp);
      }

      // ── Phase 1-D lexical 모드 (plan rev3 §2 — graph-walk 무접촉·주입 없음) ──
      //   applied 술어 = graph 의 no_approved_seed 와 동일(위 분기 공유) → 채점
      //   코어 제외집합이 3열 구성적 동일(M-1). 재정렬 대상 = vector pool 만(M-2).
      if (mode === 'lexical') {
        const pool = await searchKnowledgeNodesForUser(deps, examId, query, MAX_RESULT_TOP_K, {
          precomputedEmbedding: queryEmbedding,
        });
        const lex = await runKeywordFallback(c.env.DB as unknown as UserSearchD1, examId, query);
        const lexScores = new Map(lex.results.map((h) => [h.id, h.score]));
        const reranked = lexicalRerank(pool.results, lexScores, eps);
        const results = reranked.slice(0, topK);

        const resultIds = new Set(results.map((h) => h.id));
        const poolIds = new Set(pool.results.map((h) => h.id));
        const lexFusion: LexicalFusionMeta = {
          eps,
          poolSize: pool.results.length,
          lexMatchedCount: pool.results.filter((h) => (lexScores.get(h.id) ?? 0) > 0).length,
          displacedBaselineHits: baseline.results.filter((h) => !resultIds.has(h.id)).length,
          matchedTokens: lex.matchedTokens,
          ...(debug
            ? {
                lexicalOnlyObserved: lex.results.filter((h) => !poolIds.has(h.id)).map((h) => h.id),
              }
            : {}),
        };
        // 채점 코어 계약 유지(M-1): graphExpansion {applied,truncated} 필수 소비 —
        // no-seed 분기 관례값(0/[]/false) 준용(rev3 m-N3). walk 미실행 = expandedNodes 항상 빈 집합.
        const meta: GraphExpansionMeta = {
          applied: true,
          seedWalkCount: 0,
          expandedNodeCount: 0,
          truncated: false,
          maxDepth: 0,
          resultCap: 0,
          edgeTypeWhitelist: [],
          ...(debug ? { expandedNodes: [] as ReadonlyArray<GraphExpansionDebugNode> } : {}),
        };
        // lexical 전용 로그 라인 (G-1D-6 — logOk 는 GraphExpansionMeta 형상 전용이라 별도 어댑트).
        logger.info('lexical_search_ok', {
          module: 'search/graph',
          examId,
          mode,
          eps,
          poolSize: lexFusion.poolSize,
          lexMatchedCount: lexFusion.lexMatchedCount,
          displacedBaselineHits: lexFusion.displacedBaselineHits,
          debug,
          elapsedMs: Date.now() - startedAt,
        });
        const resp: GraphSearchResponse = {
          query,
          examId,
          topK: baseline.topK,
          baseline,
          graphExpansion: meta,
          results,
          lexicalFusion: lexFusion,
        };
        return c.json(resp);
      }

      // 2. 각 시드 N-hop 확장. graph-walk 실패는 전파 (빈 결과로 삼키지 않음).
      //
      //    ★ mid-loop 실패 계약 (S5-5 CO6-4(c) — 명시 pin): 5-seed 중 임의
      //    시드의 graphWalk 가 throw 하면 부분 확장으로 degrade 하지 않고
      //    **fail-loud** (전파 → catch → 5xx). graph-walk 모듈 교리("빈
      //    결과로 삼키지 않는다", index.ts:252)와 정합 — 부분 확장 집합에서
      //    정답률을 재면 baseline 측정이 silent 왜곡되므로, 측정 무결성 상
      //    부분 성공 < 전체 실패. (S5-7 A 통합 시 학습자 UX 차원에서
      //    per-seed graceful 재검토 가능 — 현 옵션 C 측정 경로는 fail-loud.)
      //
      //    확장 노드는 GraphWalkNode 그대로 dedup(Map) — S5-5 CO6-1: graph-walk
      //    projection 이 description 동봉 → 잉여 2차 fetchApprovedNodes 제거.
      const expandedNodes = new Map<string, GraphWalkNode>();
      let effectiveMaxDepth = 0;
      let effectiveResultCap = 0;
      let edgeTypeWhitelist: ReadonlyArray<string> = [];
      let anyTruncated = false;
      for (const seed of seeds) {
        const walk = await graphWalk(examId, walkDb, seed.id, {
          ...(maxDepth !== undefined ? { maxDepth } : {}),
          ...(resultCap !== undefined ? { resultCap } : {}),
        });
        // 엔진이 clamp 한 실효값 노출 (D-2 MAX_ALLOWED_DEPTH=4 등 — 호출자 검사 가능)
        effectiveMaxDepth = walk.maxDepth;
        effectiveResultCap = walk.resultCap;
        edgeTypeWhitelist = walk.edgeTypeWhitelist;
        // S5-5 CO6-2: 어느 시드든 절단되면 표면화 (silent 절단 차단).
        if (walk.truncated) anyTruncated = true;
        for (const n of walk.nodes) {
          // baseline 교집합 노드는 baseline hit(실 vector score)이 우선 →
          // 확장에서 제외 (CO6-4(a) — 충돌 시 baseline 보존). 시드 간 중복은
          // Map 키로 1회 collapse.
          if (!baselineIds.has(n.id) && !expandedNodes.has(n.id)) {
            expandedNodes.set(n.id, n);
          }
        }
      }

      // 3. 확장 노드 → hit. buildHit 단일 진실원 공유(CO-3) — graph-walk 노드를
      //    NodeHitSource 로 매핑(2차 DB 조회 없음, CO6-1). 확장 노드 vector
      //    score=0 (graph 관계로 편입 — truth_weight 가 정렬 지배, score 는
      //    동 weight tiebreak 만).
      const expandedHits = [...expandedNodes.values()].map((n) => {
        const src: NodeHitSource = {
          id: n.id,
          type: n.type,
          name: n.name,
          description: n.description,
          page_ref: n.pageRef,
          truth_weight: n.truthWeight,
        };
        return buildHit(src, 0);
      });

      // 4. 병합 + Stage 3 단일 진실원 재정렬 (CO-3). baseline hit 은 실 vector
      //    score 보존(교집합은 위에서 baseline 우선 처리 → 중복 없음).
      const merged = [...baseline.results, ...expandedHits].sort(compareByTruthWeightThenScore);

      const meta: GraphExpansionMeta = {
        applied: true,
        seedWalkCount: seeds.length,
        expandedNodeCount: expandedNodes.size,
        truncated: anyTruncated,
        maxDepth: effectiveMaxDepth,
        resultCap: effectiveResultCap,
        edgeTypeWhitelist,
        // WS-4 4c: debug=true 한정 확장 전체집합 surface — 랭크미달 vs 미도달
        // 진단 (description 제외 = GraphExpansionDebugNode 주석 참조).
        ...(debug
          ? {
              expandedNodes: [...expandedNodes.values()].map(
                (n): GraphExpansionDebugNode => ({
                  id: n.id,
                  depth: n.depth,
                  type: n.type,
                  name: n.name,
                  truthWeight: n.truthWeight,
                  pageRef: n.pageRef,
                }),
              ),
            }
          : {}),
      };
      const resp: GraphSearchResponse = {
        query,
        examId,
        topK: baseline.topK,
        baseline,
        graphExpansion: meta,
        results: merged.slice(0, baseline.topK),
      };
      logOk(meta);
      return c.json(resp);
    } catch (err) {
      // fail-loud — graph-walk / user-search 실패 전파 (빈 결과 은폐 금지).
      const isDev = env === 'dev' || env === 'development' || env === 'test';
      const cause = (err as { cause?: unknown }).cause;
      const causeName = cause instanceof Error ? cause.name : undefined;

      if (err instanceof GraphWalkError) {
        logger.error('graph_search_walk_failed', undefined, {
          module: 'search/graph',
          phase: err.phase,
          examId,
          causeName,
          elapsedMs: Date.now() - startedAt,
        });
        return c.json(
          {
            error: ErrorCode.AI_GENERATION_ERROR,
            phase: err.phase,
            message: isDev ? err.message : err.phase,
          },
          err.statusCode === 400 ? 400 : 500,
        );
      }
      if (err instanceof UserSearchError) {
        logger.error('graph_search_baseline_failed', undefined, {
          module: 'search/graph',
          phase: err.phase,
          examId,
          errMessage: err.message,
          causeName,
          elapsedMs: Date.now() - startedAt,
        });
        return c.json(
          {
            error: ErrorCode.AI_GENERATION_ERROR,
            phase: err.phase,
            message: isDev ? err.message : err.phase,
          },
          err.statusCode === 504 ? 504 : 500,
        );
      }
      // 미지정(non-typed) 에러 — embedQuery(Workers AI)/graph-walk D1/buildHit
      // 등은 GraphWalkError/UserSearchError 가 아닌 raw throw 가능 (CO6-1 후
      // 확장 경로 2차 조회 없음 — graph-walk projection 직접 매핑).
      // rethrow 전 구조화 로그 의무 (S5-5 devops M-1 — on-call 사각 + S5-6
      // 측정 무결성: 무로그 bare 500 = 원인 분기 불가). cause 만 surface.
      logger.error('graph_search_unhandled', undefined, {
        module: 'search/graph',
        examId,
        causeName: err instanceof Error ? err.name : undefined,
        elapsedMs: Date.now() - startedAt,
      });
      throw err;
    }
  });

  return app;
}
