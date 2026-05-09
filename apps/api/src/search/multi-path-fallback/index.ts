/**
 * Multi-Path Fallback (Rule 18 / ADR-015) — Stage 2 → 3 → 4 순차 routing.
 *
 * 진입 조건 (routes.ts 에서 호출):
 *   - searchKnowledgeNodesForUser 결과 gracefulDegradation=true OR stage2Count=0
 *   - 즉 Stage 1 Vector 0건 / Stage 1 < 0.60 / Stage 2 hard filter 0건
 *
 * 흐름:
 *   1. Stage 2 Keyword Fallback (D1 LIKE) — 매칭 시 즉시 반환
 *   2. Stage 3 Topic Cluster Routing — 매칭 시 cluster + 추천 노드 반환
 *   3. Stage 4 Honest Refusal — review_queue INSERT + 안내 응답
 *
 * D-MPF-1=A + D-MPF-2=A + D-MPF-3=A + D-MPF-4=A (Session 059).
 *
 * 근거:
 *   - docs/plans/phase2a-multi-path-fallback.plan.md §3.1
 *   - docs/architecture/SEARCH_PIPELINE.md §5
 *   - docs/adr/ADR-015-multi-path-fallback-pipeline.md
 */

import type { ExamId } from '@thepick/shared';
import type { QueryDigest } from '../log-redact.js';
import {
  type UserSearchD1,
  type UserSearchHit,
  type VectorizeQueryBinding,
} from '../user-search.js';
import { runKeywordFallback, type KeywordFallbackResult } from './keyword-fallback.js';
import { runTopicClusterRouting, type TopicClusterRouterResult } from './topic-cluster-router.js';
import {
  buildHonestRefusalResponse,
  recordHonestRefusal,
  type HonestRefusalResponse,
} from './honest-refusal.js';

export interface MultiPathFallbackDeps {
  readonly db: UserSearchD1;
  readonly vectorize: VectorizeQueryBinding;
}

/**
 * Multi-Path Fallback 응답 — 어느 단계에서 매칭됐는지 source 표기.
 * 학습자 UI 가 source 별로 안내문 분기 (e.g. 'keyword-fallback' → "유사 토픽일 수 있습니다").
 */
export type MultiPathFallbackResponse =
  | (KeywordFallbackResult & { readonly stage: 2 })
  | (TopicClusterRouterResult & { readonly stage: 3 })
  | (HonestRefusalResponse & { readonly stage: 4 });

/**
 * Multi-Path Fallback 진입.
 *
 * Stage 2 → 3 → 4 순차. 각 단계 매칭 시 즉시 반환.
 *
 * @param queryDigest Pass 2 MAJ-1 흡수 — routes.ts 에서 1회 계산 후 전달 (재계산 회피)
 * @param queryEmbedding Pass 2 MAJ-1 흡수 — Stage 1 임베딩 재사용 (bge-m3 1회 호출)
 */
export async function runMultiPathFallback(
  deps: MultiPathFallbackDeps,
  examId: ExamId,
  query: string,
  queryDigest: QueryDigest,
  queryEmbedding: ReadonlyArray<number>,
): Promise<MultiPathFallbackResponse> {
  // Stage 2: Keyword Fallback
  const keywordResult = await runKeywordFallback(deps.db, examId, query);
  if (keywordResult.results.length > 0) {
    return { ...keywordResult, stage: 2 };
  }

  // Stage 3: Topic Cluster Routing
  // Vectorize topic_cluster 미적재 시 (carry-over) graceful Miss → Stage 4 진입
  const topicResult = await runTopicClusterRouting(deps.vectorize, deps.db, examId, queryEmbedding);
  if (topicResult.results.length > 0) {
    return { ...topicResult, stage: 3 };
  }

  // Stage 4: Honest Refusal
  // Pass 1 CRIT-1 흡수 (Session 059) — review_queue INSERT 실패가 학습자 응답을
  // 깨뜨리지 않도록 try/catch + best-effort. ADR-015 graceful 본질 보존.
  // 운영 모니터링: caller (routes.ts) 가 c.executionCtx?.waitUntil 또는 logger 측면 surface 의무.
  // 미적재 / 권한 부재 / SQLITE_CONSTRAINT 발생 시에도 학습자는 honest-refusal 응답 정상 수신.
  const reviewQueueId = generateReviewQueueId();
  try {
    await recordHonestRefusal(deps.db, {
      id: reviewQueueId,
      examId,
      queryDigest,
      reason: 'honest_refusal',
    });
  } catch {
    // best-effort — INSERT 실패 시 reviewQueueId 는 client 에 전송되나 D1 row 부재.
    // carry-over (plan §10): caller 측 logger.error('review_queue_insert_failed', ...) 적용.
  }
  // D-TCV-4-FIX-1=B-1 진단 surface (Session 061): Stage 3 미히트 시 어디서 막혔는지
  // staging/production e2e + SP-T06/T07 측정 시점에 검증.
  const refusal = buildHonestRefusalResponse(reviewQueueId, topicResult.diagnostics);
  return { ...refusal, stage: 4 };
}

/**
 * review_queue.id 생성 — Workers crypto.randomUUID() 1급 지원.
 *
 * Year 1 단일 시험: 'rq_' prefix + UUID v4. Year 2 멀티시험 진입 시 prefix 변경 검토.
 */
function generateReviewQueueId(): string {
  return `rq_${crypto.randomUUID()}`;
}

/**
 * UserSearchHit 응답 shape 호환성 — Multi-Path 결과를 Stage 1+2+3 응답과 동일 shape 으로
 * 노출하기 위한 helper.
 *
 * @returns results 배열 + source 메타 (라우터 측에서 응답 shape 결정)
 */
export function multiPathResponseToHits(
  response: MultiPathFallbackResponse,
): ReadonlyArray<UserSearchHit> {
  if (response.stage === 2 || response.stage === 3) return response.results;
  return [];
}
