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

const GraphSearchBodySchema = z.object({
  examId: z.string().min(1),
  query: z.string().min(1).max(500),
  topK: z.number().int().min(1).max(MAX_RESULT_TOP_K).default(DEFAULT_RESULT_TOP_K),
  /**
   * graph-walk maxDepth. HTTP 계약 상한 = 엔진 hard ceiling
   * `MAX_ALLOWED_DEPTH`(D-2=4). 초과 시 silent clamp 아닌 **400 정직 거부**
   * (S5-5 Pass3 Minor-1). 엔진 clampInt 는 방어선으로 잔존(이중 방어).
   */
  maxDepth: z.number().int().min(1).max(MAX_ALLOWED_DEPTH).optional(),
  /** graph-walk resultCap. HTTP 상한 = 엔진 `MAX_ALLOWED_RESULT_CAP`. */
  resultCap: z.number().int().min(1).max(MAX_ALLOWED_RESULT_CAP).optional(),
});

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
    const { examId: rawExamId, query, topK, maxDepth, resultCap } = parsed.data;

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
