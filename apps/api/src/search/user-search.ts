/**
 * User Search — 정식 RAG 검색 (SEARCH_PIPELINE.md Stage 1+2+3 + ADR-008).
 *
 * Stage 1: Vector Recall (Vectorize.query top-K=20, similarity ≥ 0.60)
 * Stage 2: Graph Hard Filter (D1 WHERE is_current_active=1 AND status='approved')
 * Stage 3: Truth Weight Re-rank (LAW=10 > FORMULA=8 > ... > TERM=3, 동일 weight 내 vector 보존)
 *
 * ADR-008 graceful degradation:
 *   - 800ms hard timeout (AbortSignal.timeout)
 *   - 1 retry on network error
 *   - top-1 similarity < 0.60 → `gracefulDegradation: true` 플래그 (Multi-Path Fallback 진입 신호)
 *
 * Hard Rule 16/17 zero-cost:
 *   - 첫 인자 examId: ExamId 강제
 *   - EXAM_IDS 경유 100%, 리터럴 0건
 *
 * 비스코프 (별도 step carry-over):
 *   - Multi-Path Fallback (Rule 18) — 본 step 은 graceful 플래그만 응답
 *   - Concurrent Execution (Rule 23) — 별도 step
 *   - user_session 인증 + rate-limit
 *
 * 근거:
 *   - docs/architecture/SEARCH_PIPELINE.md v2.1 §2~§4
 *   - docs/adr/ADR-008-graceful-degradation.md
 *   - docs/adr/ADR-012-three-stage-hybrid-search.md
 *   - docs/adr/ADR-013-materialized-active-view.md
 *   - docs/plans/phase2a-user-search-route.plan.md §3.1
 */

import { TRUTH_WEIGHTS, type ExamId, type NodeType } from '@thepick/shared';
import type { AiBinding, VectorizeBinding } from '../vectorize/upserter.js';
import { parsePageRefToInt } from '../vectorize/page-ref.js';
import { buildApprovedNodesQuery } from './approved-nodes-sql.js';

/** Stage 1 Vector Recall similarity 임계 (ADR-008). */
export const STAGE1_VECTOR_RECALL_MIN_SIMILARITY = 0.6;

/** ADR-008 graceful degradation 임계 (top-1 score < 0.60 → flag true). */
export const ADR_008_GRACEFUL_THRESHOLD = 0.6;

/** ADR-008 Vectorize.query timeout (ms). */
export const ADR_008_TIMEOUT_MS = 800;

/** ADR-008 retry count (network blip 대응). */
export const ADR_008_RETRY_COUNT = 1;

/** Stage 1 Vector Recall top-K (Stage 2/3 input candidate). */
export const STAGE1_TOP_K = 20;

/**
 * Stage 1 결과에서 client-side 제외할 표 벡터 id prefix — 결재 #13 (b) /
 * ADR-047 (2026-07-02 진산 결재).
 *
 * production `thepick-embeddings` 인덱스에는 knowledge_nodes 794 외에 표 벡터
 * 433(TBL- 20 / TROW-·TCOL- 167 / TCELL- 246 — ADR-032 Table-as-Micro-KG)이
 * 동거한다. Stage 1 filter 는 `{ exam_id }` 단독 → 표 벡터가 top-20 후보
 * 슬롯을 잠식하고, Stage 2 `fetchApprovedNodes` 는 knowledge_nodes 한정이라
 * 표 벡터는 슬롯만 소모 후 **무음 탈락** + 표 벡터가 top-1 이면 top1Score/
 * gracefulDegradation 판정까지 왜곡(제공 불가 후보가 graceful 억제)한다.
 *
 * 서버측 제외가 정공법이나 불가: knowledge_node 벡터의 node_type metadata 는
 * 'knowledge_node' 고정값이 아닌 실 노드 type 12종(vectorize/routes.ts:367)
 * → equality 단독으론 "표 제외" 표현 불가, `$nin`/`$ne` 는 V2 binding 미작동
 * 실측(Session 061 — 아래 topic-cluster-router.ts STAGE3 선례 주석 참조).
 * 따라서 client-side prefix post-filter 채택. **한계(ADR-047 §D-3 명기)**:
 * 슬롯 회복은 부분적 — top-20 회수 자체엔 표 벡터가 여전히 참여하며 제거분
 * 만큼 knowledge_node 후보가 보충되진 않는다. 완전 회복은 표 전용 인덱스
 * 분리(카드 #13 (c)) 또는 V2 filter 연산자 정상화 후 서버측 제외(Year 2
 * carry-over) 몫. supersedes 채널 단일화 마이그는 "첫 표 개정 전" 게이트로
 * 이연 (ADR-047 §D-2).
 */
export const STAGE1_TABLE_VECTOR_EXCLUDE_PREFIXES = ['TBL-', 'TROW-', 'TCOL-', 'TCELL-'] as const;

/**
 * 표 벡터 id 판별 (ADR-047 §D-3) — Stage 1 잠식 차단 단일 판별원.
 * TC-(topic_clusters)는 본 필터 범위 밖 — 카드 #13 은 표 벡터 433 한정
 * (동일 잠식 기전이나 별도 처분, ADR-047 §결과 ⚠️).
 */
export function isTableVectorId(id: string): boolean {
  return STAGE1_TABLE_VECTOR_EXCLUDE_PREFIXES.some((prefix) => id.startsWith(prefix));
}

/** 사용자 응답 default top-K (SEARCH_PIPELINE.md §4). */
export const DEFAULT_RESULT_TOP_K = 3;

/** 사용자 응답 max top-K. */
export const MAX_RESULT_TOP_K = 10;

/**
 * Vectorize metadata filter value 타입.
 *
 * Cloudflare Vectorize V2 spec 은 `$eq` / `$ne` / `$in` / `$nin` 객체 형식
 * operator 를 명시하지만, Session 061 staging e2e 실측 결과 V2 binding 은 객체
 * 형식 적용 시 0건 반환 (binding spec mismatch 또는 미배포 — Cloudflare changelog
 * 모니터링 carry-over).
 *
 * 따라서 Year 1 운영 코드는 단순 `string | number | boolean` equality filter 만
 * 사용 + client-side post-filter (예: topic-cluster-router.ts:STAGE3_NODE_ID_EXCLUDE_PREFIXES)
 * 로 cross-pollution 차단.
 *
 * union 의 operator 분기 (`$eq`/`$ne`/`$in`/`$nin`) 는 Year 2 carry-over — V2
 * binding 정상화 검증 후 활성화 예정 (4-Pass M2-2 / M4-C2 carry-over, ADR-004 §3
 * Addendum 영속 의무).
 */
export type VectorizeFilterValue =
  | string
  | number
  | boolean
  | { readonly $eq?: string | number | boolean }
  | { readonly $ne?: string | number | boolean }
  | { readonly $in?: ReadonlyArray<string | number | boolean> }
  | { readonly $nin?: ReadonlyArray<string | number | boolean> };

/**
 * Vectorize.query 인터페이스 (upserter.ts VectorizeBinding 확장 — query 메서드 추가).
 */
export interface VectorizeQueryBinding extends VectorizeBinding {
  query(
    values: ReadonlyArray<number>,
    options: {
      readonly topK: number;
      readonly filter?: Record<string, VectorizeFilterValue>;
      readonly returnMetadata?: 'none' | 'indexed' | 'all';
      readonly returnValues?: boolean;
    },
  ): Promise<{
    readonly count: number;
    readonly matches: ReadonlyArray<{
      readonly id: string;
      readonly score: number;
      readonly metadata?: Record<string, unknown>;
      readonly values?: ReadonlyArray<number>;
    }>;
  }>;
}

/** D1 인터페이스 (테스트 mock 호환 — 실 D1Database 와 구조 호환). */
export interface UserSearchD1 {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      all<T = Record<string, unknown>>(): Promise<{
        readonly results?: ReadonlyArray<T>;
      }>;
    };
  };
}

export interface UserSearchDeps {
  readonly ai: AiBinding;
  readonly vectorize: VectorizeQueryBinding;
  readonly db: UserSearchD1;
}

export interface UserSearchHit {
  readonly id: string;
  readonly score: number;
  readonly type: string;
  readonly truthWeight: number;
  readonly pageRef: number;
  readonly name: string;
  readonly description: string | null;
}

export interface UserSearchResult {
  readonly query: string;
  readonly examId: ExamId;
  readonly topK: number;
  readonly gracefulDegradation: boolean;
  readonly top1Score: number;
  readonly stage1Count: number;
  readonly stage2Count: number;
  readonly results: ReadonlyArray<UserSearchHit>;
}

export class UserSearchError extends Error {
  readonly phase: 'embed' | 'query' | 'filter' | 'timeout';
  readonly statusCode: number;
  constructor(message: string, phase: 'embed' | 'query' | 'filter' | 'timeout', cause?: unknown) {
    super(message);
    this.name = 'UserSearchError';
    this.phase = phase;
    this.statusCode = phase === 'timeout' ? 504 : 500;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

/**
 * `buildHit` 가 실제로 소비하는 최소 필드 — status/is_current_active 는 미사용.
 *
 * S5-5 CO6-1: graph-walk 확장 노드(`GraphWalkNode`)도 이 형태로 매핑되어
 * `buildHit` 단일 진실원을 *공유*한다 (잉여 2차 fetchApprovedNodes 제거). 즉
 * hit 구성(truth_weight 도출·page_ref 정규화)이 정상 Stage 3 와 한 곳.
 */
export interface NodeHitSource {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly description: string | null;
  readonly page_ref: string | null;
  readonly truth_weight: number;
}

export interface ApprovedNodeRow extends NodeHitSource {
  readonly status: string;
  readonly is_current_active: number;
}

/**
 * bge-m3 임베딩 단독 호출 (Stage 1 + Multi-Path Fallback Stage 3 재사용).
 *
 * Pass 2 MAJ-1 흡수 (Session 059): routes.ts 가 1회 호출 후 user-search +
 * multi-path-fallback 양쪽에 전달 — request 당 bge-m3 호출 1회 보장 (CPU/비용 절감).
 *
 * @throws {UserSearchError} embed 실패 (1 retry 후)
 */
export async function embedQuery(ai: AiBinding, query: string): Promise<ReadonlyArray<number>> {
  if (!query || query.trim() === '') {
    throw new UserSearchError('query must be non-empty', 'embed');
  }
  const aiResp = await runWithRetry(() => ai.run('@cf/baai/bge-m3', { text: [query] }), 'embed');
  const queryVector = aiResp.data[0];
  if (!Array.isArray(queryVector) || queryVector.length === 0) {
    throw new UserSearchError('bge-m3 응답 차원 부재', 'embed');
  }
  return queryVector;
}

/**
 * 학습자 자연어 질문 → 검증된 knowledge_nodes top-K + 출처.
 *
 * 처리 단계:
 *   1. Stage 1 Vector Recall: bge-m3 임베딩 → Vectorize.query (top-K=20, exam_id 필터)
 *   2. Stage 2 Graph Hard Filter: D1 IN clause + status='approved' + is_current_active=1
 *   3. Stage 3 Truth Weight Re-rank: TRUTH_WEIGHTS 가중치 정렬 (동일 weight 내 vector 보존)
 *   4. graceful degradation 플래그 응답 (top-1 < 0.60)
 *
 * @param opts.precomputedEmbedding bge-m3 임베딩이 호출자(routes.ts) 에서 이미 계산된
 *   경우 재사용 (Multi-Path Fallback 와 공유). Pass 2 MAJ-1 흡수 (Session 059).
 *
 * @throws {UserSearchError} embed 실패 / query 실패 / D1 실패 / timeout (800ms)
 */
export async function searchKnowledgeNodesForUser(
  deps: UserSearchDeps,
  examId: ExamId,
  query: string,
  topK: number = DEFAULT_RESULT_TOP_K,
  opts?: { readonly precomputedEmbedding?: ReadonlyArray<number> },
): Promise<UserSearchResult> {
  if (!examId || (examId as string).trim() === '') {
    throw new UserSearchError('examId is required (Hard Rule 16 시험 경계 강제)', 'filter');
  }
  if (!query || query.trim() === '') {
    throw new UserSearchError('query must be non-empty', 'embed');
  }
  const effectiveTopK = Math.min(Math.max(topK, 1), MAX_RESULT_TOP_K);

  // Stage 1.a: bge-m3 임베딩 — precomputed 있으면 재사용 (Pass 2 MAJ-1)
  const queryVector =
    opts?.precomputedEmbedding !== undefined
      ? opts.precomputedEmbedding
      : await embedQuery(deps.ai, query);

  // Stage 1.b: Vectorize.query (timeout + retry)
  const rawMatches = await runVectorizeQueryWithTimeout(deps.vectorize, queryVector, examId);

  // ADR-047 §D-3 (결재 #13 (b)): 표 벡터(TBL-/TROW-/TCOL-/TCELL-) 잠식 차단 —
  // Stage 2 knowledge_nodes 한정으로 어차피 무음 탈락할 후보를 회수 직후 제외해
  // top1Score/graceful 판정·stage1Count 를 제공 가능 후보만으로 정화한다.
  // 서버측 $nin 미작동(V2 binding 실측) → client-side prefix post-filter
  // (STAGE1_TABLE_VECTOR_EXCLUDE_PREFIXES 주석의 부분 회복 한계 참조).
  const vectorMatches = rawMatches.filter((m) => !isTableVectorId(m.id));

  if (vectorMatches.length === 0) {
    return buildEmptyResult(query, examId, effectiveTopK, 0);
  }

  // ADR-008: similarity ≥ 0.60 필터 (Stage 1 임계)
  const stage1Filtered = vectorMatches.filter(
    (m) => m.score >= STAGE1_VECTOR_RECALL_MIN_SIMILARITY,
  );
  const top1Score = vectorMatches[0]?.score ?? 0;
  const gracefulDegradation = top1Score < ADR_008_GRACEFUL_THRESHOLD;

  if (stage1Filtered.length === 0) {
    return {
      query,
      examId,
      topK: effectiveTopK,
      gracefulDegradation,
      top1Score,
      stage1Count: 0,
      stage2Count: 0,
      results: [],
    };
  }

  // Stage 2: Graph Hard Filter (D1)
  const stage2Rows = await fetchApprovedNodes(
    deps.db,
    stage1Filtered.map((m) => m.id),
  );

  if (stage2Rows.length === 0) {
    // 모든 후보가 draft / is_current_active=0 → graceful 강제 (Multi-Path Fallback 진입 신호)
    return {
      query,
      examId,
      topK: effectiveTopK,
      gracefulDegradation: true,
      top1Score,
      stage1Count: stage1Filtered.length,
      stage2Count: 0,
      results: [],
    };
  }

  // Stage 3: Truth Weight Re-rank (vector similarity preserved within same weight)
  const scoreById = new Map(stage1Filtered.map((m) => [m.id, m.score]));
  const reranked = stage2Rows
    .map((row) => buildHit(row, scoreById.get(row.id) ?? 0))
    .sort(compareByTruthWeightThenScore);

  return {
    query,
    examId,
    topK: effectiveTopK,
    gracefulDegradation,
    top1Score,
    stage1Count: stage1Filtered.length,
    stage2Count: stage2Rows.length,
    results: reranked.slice(0, effectiveTopK),
  };
}

function buildEmptyResult(
  query: string,
  examId: ExamId,
  topK: number,
  top1Score: number,
): UserSearchResult {
  return {
    query,
    examId,
    topK,
    gracefulDegradation: true,
    top1Score,
    stage1Count: 0,
    stage2Count: 0,
    results: [],
  };
}

/**
 * Stage 3 "Truth Weight Re-rank" 비교자 — **단일 진실원 (CO-3)**.
 *
 * truth_weight 내림차순(LAW=10 > FORMULA=8 > … > TERM=3), 동일 weight 내
 * vector score 보존(내림차순). graph-walk 경로(`/api/search/graph`)도 본
 * 비교자를 *공유*한다 — graph-walk 는 최종 랭킹을 정하지 않으며(hop-distance
 * 로 recall bound 만 책임).
 *
 * **단일 진실원 범위 (정밀):** "정상 Stage 3 + graph-walk 경로" 의 truth_weight
 * 최종 정렬 유일 출처가 본 함수다. multi-path-fallback 의 topic-cluster
 * 라우터(`topic-cluster-router.ts` ranked sort)는 *별개 의미 맥락*으로
 * `truth_weight → score → name.localeCompare` 3-key 결정적 정렬을 의도적으로
 * 사용한다(폴백 결과 안정 정렬용 name tiebreak — drift 아님, 설계 차이).
 * 정상/graph 경로에 2번째 truth_weight 정책 생성 금지가 본 주석의 계약이다
 * 승인 예외 2 (2026-07-07, 5-페르소나 P2-M1 등재): graph-search-route.lexicalSortKey/lexicalRerank
 *   — Phase 1-D 측정 전용(debug 게이트·학습자 비노출), truthWeight 1차 키 동일 + lex-0 완전 동치가
 *   G-1D-2b 테스트로 기계 고정(테스트 완화 = 계약 위반). 3번째 비교자 신설은 여전히 금지.
 * (graph-walk-s5-integration.plan.md §1 CO-3 / SEARCH_PIPELINE.md §2 /
 * ADR-012 §Decision Stage 3).
 */
export function compareByTruthWeightThenScore(a: UserSearchHit, b: UserSearchHit): number {
  if (a.truthWeight !== b.truthWeight) return b.truthWeight - a.truthWeight;
  return b.score - a.score;
}

export function buildHit(row: NodeHitSource, score: number): UserSearchHit {
  const nodeType = row.type as NodeType;
  // S5-5 CO6-4(e): truth_weight 정렬 안전 가드. TRUTH_WEIGHTS 미등록 type +
  // row.truth_weight 가 NULL/NaN(D1 REAL 결측·graph 확장이 노출 확대) 이면
  // `compareByTruthWeightThenScore` 의 `!==`/뺄셈이 NaN 으로 정렬 불능 →
  // baseline 정답률 왜곡. `?? 0` 만으로 NaN 미차단이라 Number.isFinite 로 0 폴백.
  const rawTruthWeight = TRUTH_WEIGHTS[nodeType] ?? row.truth_weight;
  const truthWeight = Number.isFinite(rawTruthWeight) ? rawTruthWeight : 0;
  return {
    id: row.id,
    score,
    type: row.type,
    truthWeight,
    pageRef: parsePageRefToInt(row.page_ref).value,
    name: row.name,
    description: row.description,
  };
}

/**
 * Vectorize.query + Promise.race timeout(800ms) + 1 retry on network error.
 *
 * timeout 구현 = Promise.race + setTimeout (clearTimeout cleanup 의무 — 5th C-1 흡수, Session 058).
 * AbortSignal.timeout 은 vectorize binding 이 직접 지원하지 않아 race 패턴 사용.
 * timeout 초과 시 UserSearchError(phase=timeout) throw.
 *
 * retry 정책 (Pass 4 M1 흡수):
 *   - network error 1회 재시도, 300ms backoff
 *   - timeout 은 retry 안 함 (의도적 빠른 실패)
 */
async function runVectorizeQueryWithTimeout(
  vectorize: VectorizeQueryBinding,
  queryVector: ReadonlyArray<number>,
  examId: ExamId,
): Promise<ReadonlyArray<{ id: string; score: number; metadata?: Record<string, unknown> }>> {
  const filter = { exam_id: examId as string };
  const options = {
    topK: STAGE1_TOP_K,
    filter,
    returnMetadata: 'all' as const,
  };

  const queryWithTimeout = async (): Promise<{
    matches: ReadonlyArray<{ id: string; score: number; metadata?: Record<string, unknown> }>;
  }> => {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new UserSearchError('Vectorize.query timeout 800ms', 'timeout')),
        ADR_008_TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([vectorize.query(queryVector, options), timeoutPromise]);
    } finally {
      // 5th C-1 흡수 — query 정상 resolve 시에도 setTimeout 핸들 cleanup (다음 invocation leak 차단)
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= ADR_008_RETRY_COUNT; attempt++) {
    try {
      const result = await queryWithTimeout();
      return result.matches ?? [];
    } catch (err) {
      lastError = err;
      // timeout 은 retry 안 함 (의도적 빠른 실패)
      if (err instanceof UserSearchError && err.phase === 'timeout') throw err;
      // 마지막 시도 실패 시 throw
      // Pass 3 M2 흡수 (Session 059) — public message 에 underlying err.message 비포함.
      // 내부 디테일 (Vectorize 응답/SQL fragment) 은 cause 체인에 보존, dev 만 inspect.
      if (attempt === ADR_008_RETRY_COUNT) {
        throw new UserSearchError(`Vectorize.query 실패 (${attempt + 1} 시도)`, 'query', err);
      }
      // Pass 4 M1 흡수 — ADR-008 §2 retry "300ms 후" backoff
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  // unreachable (loop 내부에서 return or throw)
  throw new UserSearchError('Vectorize.query 비정상 종료', 'query', lastError);
}

async function runWithRetry<T>(
  fn: () => Promise<T>,
  phase: 'embed' | 'query' | 'filter',
): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= ADR_008_RETRY_COUNT; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Pass 3 M2 흡수 (Session 059) — underlying err.message 미포함. cause 체인에 보존.
      if (attempt === ADR_008_RETRY_COUNT) {
        throw new UserSearchError(`${phase} 실패 (${attempt + 1} 시도)`, phase, err);
      }
    }
  }
  throw new UserSearchError(`${phase} 비정상 종료`, phase, lastError);
}

/**
 * Stage 2 Graph Hard Filter — D1 IN clause + 현재 status='approved' + is_current_active=1.
 *
 * **현재 status 도출 정책** (migrations/0010 + 0018 정합):
 *   - `knowledge_nodes.status` 컬럼은 INSERT 시 초기 상태(항상 'draft') 스냅샷 용도
 *   - 실제 현재 상태 = `status_transitions` 최신 레코드 `to_status` (없으면 'draft' default)
 *   - migrations/0010 = **4-state** (draft/review/approved/flagged). 정상
 *     draft→review→approved 단방향 + any→flagged 일방(종착, 0010:101-106 트리거가
 *     flagged→복귀 ABORT). 본 필터는 'approved' 만 통과 → review/draft/**flagged
 *     (결함 격리)** 전부 의도적 배제. status 코어 = approved-nodes-sql.ts 단일 진실원.
 *
 * **valid_from 시행시점 필터 — 2026-08-06 배선 완료** (구 carry-over 해소):
 *   - ~~현 schema (migrations 0001~0026) 에는 `valid_from` 컬럼이 `exam_questions` /
 *     `revision_changes` 테이블에만 존재~~ → **stale**. migrations/0041(production 적용 2026-07-12)이
 *     `knowledge_nodes`/`formulas`/`constants` 에 `valid_from`/`valid_until` 을 추가했다.
 *   - 그 후속인 "학습자 경로 필터 배선"이 0041 헤더에서 별건으로 이월돼 미착수였고,
 *     2026-08-06 에 `approved-nodes-sql.ts` 의 status 코어에 시행시점 창을 넣어 배선했다
 *     (본 함수는 그 코어를 공유하므로 자동 적용 — 별도 조건 추가 불요).
 *   - 남은 축: `revision_changes` JOIN 기반 개정 이력 표면 = 여전히 Year 2 carry-over.
 *   - 근거: docs/plans/revision-watch.plan.md §3-A-2(필터점 3곳) + catchall-역이식-분석-20260806.md §3-B.
 *
 * SEARCH_PIPELINE.md §4 + ADR-012 §Decision + ADR-013 Materialized Active View Rule 16 정합.
 */
export async function fetchApprovedNodes(
  db: UserSearchD1,
  candidateIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<ApprovedNodeRow>> {
  if (candidateIds.length === 0) return [];

  const placeholders = candidateIds.map(() => '?').join(',');
  // status 도출 코어는 approved-nodes-sql.ts 단일 진실원 (CO-4 해소) — graph-walk
  // 와 동일 코어 *공유*(복제 아님). 후보 한정(`kn.id IN`)만 본 호출 측 주입 —
  // status 코어 뒤 AND 결합(교환법칙 → 원 SQL 결과 집합 불변). ROW_NUMBER OVER
  // PARTITION BY 는 D1 SQLite 3.45+ 지원 (migrations 호환).
  const sql = buildApprovedNodesQuery({
    projection:
      'kn.id, kn.type, kn.name, kn.description, kn.page_ref, kn.truth_weight, kn.status, kn.is_current_active',
    candidateFilter: `kn.id IN (${placeholders})`,
  });

  try {
    const result = await db
      .prepare(sql)
      .bind(...candidateIds)
      .all<ApprovedNodeRow>();
    return result.results ?? [];
  } catch (err) {
    // Pass 3 M2 흡수 (Session 059) — public message 에 SQL keyword (LEFT JOIN / ROW_NUMBER /
    // status_transitions / WHERE 등) 비노출. 내부 디테일은 cause 에 보존, dev 만 inspect.
    throw new UserSearchError('Stage 2 graph filter 실패', 'filter', err);
  }
}
