/**
 * @thepick/srs — FSRS-4 SRS 알고리즘 + weak_score (D2 lock 정합).
 *
 * 본 패키지는 ts-fsrs npm wrapper + 도메인 weak_score 산식을 격리한다 (Engine-First).
 *
 * plan: docs/plans/phase3-learning-ux-modes.plan.md (Step 3-UX-3)
 *
 * 사용처:
 *   - apps/api study routes weak mode + grade 후 user_progress fsrs_state 갱신
 *   - apps/web local-progress: FSRS 스케줄 계산을 클라 runtime 소비
 *     (promo-1st D-1 위임 결재 2026-07-08 — 무인증 로컬 진도. 구 "type만 import" 계약 개정.
 *     ★ 채점(grade*)·정답 데이터는 여전히 server 전용 — 보안 불변)
 *
 * 의존:
 *   - ts-fsrs (FSRS-4 알고리즘 자체)
 *   - @thepick/shared (TYPES)
 *
 * ★ FsrsRating / FSRS_RATINGS 정본 = 본 패키지 (이전 learning-modes 에서 이관 —
 *   srs → learning-modes 역의존 차단, plan §7.3:375).
 *
 * Step 3-UX-5 통합 시:
 *   - migration 0033 user_progress.fsrs_state JSON 컬럼 적재
 *   - migration 0034 study_reviews 테이블 INSERT
 *   - weak mode 추출 정책 (computeWeakScore + byWeakScoreDesc)
 */

export type {
  FsrsCardState,
  FsrsRating,
  ScheduleReviewInput,
  ScheduleReviewResult,
  WeakScoreInput,
} from './types.js';

export { FSRS_RATINGS, MASTERED_THRESHOLD_DAYS, WEAK_SCORE_WEIGHTS } from './types.js';

export { createFreshCard, replayReviews, scheduleReview } from './fsrs.js';

export { byWeakScoreDesc, computeWeakScore, normalizeStability } from './weak-score.js';
