/**
 * Multi-Path Fallback Stage 4 — Honest Refusal + 검수 큐 자동 기록.
 *
 * D-MPF-3=A 채택 (Session 059): 신규 review_queue D1 테이블 (migration 0027).
 * 학습자에게 정직한 거부 응답 + 검수자 워크플로우 진입 (admin G5.5 carry-over).
 *
 * 응답 정책:
 *   - results=[] (단일 안내문 회피 — Hard Rule 21 정합)
 *   - gracefulDegradation=true + honestRefusal=true (응답 shape 확장)
 *   - 학습자 안내: "이 질문은 손해평가사 범위 밖일 수 있습니다."
 *
 * 검수 큐 정책:
 *   - query 평문 미저장 (query_hash + query_length 만, Pass 3 M1 정합)
 *   - reason: 'honest_refusal' (모든 stage Miss) / 'topic_uncertain' / 'no_match'
 *
 * 근거:
 *   - docs/plans/phase2a-multi-path-fallback.plan.md §3.1
 *   - migrations/0027_review_queue.sql
 */

import type { ExamId } from '@thepick/shared';
import type { QueryDigest } from '../log-redact.js';
import { UserSearchError, type UserSearchD1 } from '../user-search.js';

export type RefusalReason = 'honest_refusal' | 'topic_uncertain' | 'no_match';

export interface HonestRefusalRecord {
  readonly id: string;
  readonly examId: ExamId;
  readonly queryDigest: QueryDigest;
  readonly reason: RefusalReason;
}

/**
 * review_queue INSERT — D-MPF-3=A.
 *
 * crypto.randomUUID() 사용 (Workers 1급 지원). PII 정책: query 평문 절대 저장 X.
 *
 * @throws {UserSearchError} D1 INSERT 실패 — Multi-Path 의 본질 (graceful) 정합 위해
 *   상위 caller 가 catch 하여 응답은 정상 진행 (검수 큐 누락 시 운영 모니터링 알림).
 */
export async function recordHonestRefusal(
  db: UserSearchD1,
  record: HonestRefusalRecord,
): Promise<void> {
  const sql = `
    INSERT INTO review_queue
      (id, exam_id, query_hash, query_length, reason)
    VALUES (?, ?, ?, ?, ?)
  `;
  try {
    await db
      .prepare(sql)
      .bind(
        record.id,
        record.examId as string,
        record.queryDigest.hash,
        record.queryDigest.length,
        record.reason,
      )
      .all();
  } catch (err) {
    // Pass 3 M2 정합 — public message 에 SQL keyword 비포함, cause 보존.
    throw new UserSearchError('Stage 4 review_queue INSERT 실패', 'filter', err);
  }
}

/**
 * Honest Refusal i18n key contract — Pass 3 C1 흡수 (Session 059).
 *
 * client (apps/web) 가 본 messageKey 를 i18n 사전에서 lookup 하여 학습자 안내문 분기.
 * server-side 가 raw 한국어 평문 미주입 → i18n 다국어 확장 정합 + Hard Rule 17 정합.
 *
 * 사전 등록 의무 (apps/web/src/i18n/ko.json carry-over):
 *   - 'fallback.honest_refusal.out_of_scope' → "이 질문은 손해평가사 범위 밖일 수 있습니다."
 */
export const HONEST_REFUSAL_MESSAGE_KEY = 'fallback.honest_refusal.out_of_scope' as const;

/**
 * Honest Refusal 응답 페이로드 build.
 *
 * 응답 shape 확장 (Pass 3 C1 흡수):
 *   - source: 'honest-refusal' (Multi-Path Fallback 진입 후 모든 stage Miss)
 *   - honestRefusal: true (학습자 UI 안내문 활성 신호)
 *   - messageKey: i18n 키 (server/client contract — 본 step 백엔드 안정화)
 *   - reviewQueueId: review_queue.id (학습자 추적용 — 향후 검수 결과 통보)
 */
export interface HonestRefusalResponse {
  readonly source: 'honest-refusal';
  readonly honestRefusal: true;
  readonly messageKey: typeof HONEST_REFUSAL_MESSAGE_KEY;
  readonly reviewQueueId: string;
  readonly results: ReadonlyArray<never>;
}

export function buildHonestRefusalResponse(reviewQueueId: string): HonestRefusalResponse {
  return {
    source: 'honest-refusal',
    honestRefusal: true,
    messageKey: HONEST_REFUSAL_MESSAGE_KEY,
    reviewQueueId,
    results: [],
  };
}
