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

/** 사용자 응답 default top-K (SEARCH_PIPELINE.md §4). */
export const DEFAULT_RESULT_TOP_K = 3;

/** 사용자 응답 max top-K. */
export const MAX_RESULT_TOP_K = 10;

/**
 * Vectorize.query 인터페이스 (upserter.ts VectorizeBinding 확장 — query 메서드 추가).
 */
export interface VectorizeQueryBinding extends VectorizeBinding {
  query(
    values: ReadonlyArray<number>,
    options: {
      readonly topK: number;
      readonly filter?: Record<string, string | number | boolean>;
      readonly returnMetadata?: 'none' | 'indexed' | 'all';
      readonly returnValues?: boolean;
    },
  ): Promise<{
    readonly count: number;
    readonly matches: ReadonlyArray<{
      readonly id: string;
      readonly score: number;
      readonly metadata?: Record<string, unknown>;
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

interface ApprovedNodeRow {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly description: string | null;
  readonly page_ref: string | null;
  readonly truth_weight: number;
  readonly status: string;
  readonly is_current_active: number;
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
 * @throws {UserSearchError} embed 실패 / query 실패 / D1 실패 / timeout (800ms)
 */
export async function searchKnowledgeNodesForUser(
  deps: UserSearchDeps,
  examId: ExamId,
  query: string,
  topK: number = DEFAULT_RESULT_TOP_K,
): Promise<UserSearchResult> {
  if (!examId || (examId as string).trim() === '') {
    throw new UserSearchError('examId is required (Hard Rule 16 시험 경계 강제)', 'filter');
  }
  if (!query || query.trim() === '') {
    throw new UserSearchError('query must be non-empty', 'embed');
  }
  const effectiveTopK = Math.min(Math.max(topK, 1), MAX_RESULT_TOP_K);

  // Stage 1.a: bge-m3 임베딩
  const aiResp = await runWithRetry(
    () => deps.ai.run('@cf/baai/bge-m3', { text: [query] }),
    'embed',
  );
  const queryVector = aiResp.data[0];
  if (!Array.isArray(queryVector) || queryVector.length === 0) {
    throw new UserSearchError('bge-m3 응답 차원 부재', 'embed');
  }

  // Stage 1.b: Vectorize.query (timeout + retry)
  const vectorMatches = await runVectorizeQueryWithTimeout(deps.vectorize, queryVector, examId);

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
    .sort((a, b) => {
      if (a.truthWeight !== b.truthWeight) return b.truthWeight - a.truthWeight;
      return b.score - a.score;
    });

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

function buildHit(row: ApprovedNodeRow, score: number): UserSearchHit {
  const nodeType = row.type as NodeType;
  const truthWeight = TRUTH_WEIGHTS[nodeType] ?? row.truth_weight;
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
 *   - draft → review → approved 단방향 전이 (CHECK 제약, migrations/0010)
 *
 * **valid_from 4번째 조건 carry-over** (Pass 4 CONTRACT C1 재평가, Session 058):
 *   - SEARCH_PIPELINE.md §4 line 62 + ADR-012 §Decision Stage 2 가 명시한 "valid_from" 필터는
 *     `knowledge_nodes.valid_from` 컬럼 존재를 가정. 그러나 현 schema (migrations 0001~0026) 에는
 *     `valid_from` 컬럼이 `exam_questions` / `revision_changes` 테이블에만 존재.
 *   - 본 step은 `is_current_active=1` (Materialized Active View) 가 활성-버전 semantic 을 캡슐화 —
 *     SUPERSEDES 트리거가 구 노드 자동 비활성화. 시간-기반 발효일 (revision_changes JOIN)은
 *     Year 2 별도 step carry-over.
 *   - 영속: docs/plans/phase2a-user-search-route.plan.md §2.2 "valid_from time-based effectivity"
 *     항목 + handoff-067 §3 carry-over 명시.
 *
 * SEARCH_PIPELINE.md §4 + ADR-012 §Decision + ADR-013 Materialized Active View Rule 16 정합.
 */
async function fetchApprovedNodes(
  db: UserSearchD1,
  candidateIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<ApprovedNodeRow>> {
  if (candidateIds.length === 0) return [];

  const placeholders = candidateIds.map(() => '?').join(',');
  // status_transitions 최신 레코드 to_status='approved' 인 노드만 (없으면 default 'draft' 차단)
  // ROW_NUMBER OVER PARTITION BY 는 D1 SQLite 3.45+ 지원 (migrations 호환).
  const sql = `
    SELECT kn.id, kn.type, kn.name, kn.description, kn.page_ref, kn.truth_weight,
           kn.status, kn.is_current_active
    FROM knowledge_nodes kn
    LEFT JOIN (
      SELECT target_id, to_status,
        ROW_NUMBER() OVER (PARTITION BY target_id ORDER BY transitioned_at DESC) AS rn
      FROM status_transitions
      WHERE target_type = 'node'
    ) latest ON latest.target_id = kn.id AND latest.rn = 1
    WHERE kn.id IN (${placeholders})
      AND kn.is_current_active = 1
      AND COALESCE(latest.to_status, 'draft') = 'approved'
  `;

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
