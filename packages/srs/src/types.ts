/**
 * @thepick/srs types — FSRS-4 + weak_score 타입.
 *
 * plan §6.1 D2 lock 정합: FSRS-4 + subject+concept weak_score.
 * Step 3-UX-3 (packages/srs 신설).
 */

import type { FsrsRating } from '@thepick/learning-modes';

/**
 * D1 user_progress.fsrs_state JSON 컬럼 직렬화 형식.
 *
 * ts-fsrs `Card` interface를 D1 영속 가능한 plain object로 변환.
 * 마이그레이션 0033 (planned) 정합.
 */
export interface FsrsCardState {
  /** 다음 review 예정 timestamp (ISO 8601). */
  readonly due: string;
  /** 메모리 안정도 (FSRS-4 stability). */
  readonly stability: number;
  /** 카드 난이도 (FSRS-4 difficulty). */
  readonly difficulty: number;
  /** 누적 review 횟수. */
  readonly reps: number;
  /** 누적 실패 횟수 (rating='again' 발생 횟수). */
  readonly lapses: number;
  /** 카드 상태: 'new' | 'learning' | 'review' | 'relearning'. */
  readonly state: 'new' | 'learning' | 'review' | 'relearning';
  /** 마지막 review timestamp (ISO 8601). null = 첫 review 전. */
  readonly lastReview: string | null;
  /** scheduled 일수 (interval). */
  readonly scheduledDays: number;
}

export interface ScheduleReviewInput {
  readonly state: FsrsCardState;
  readonly rating: FsrsRating;
  /** 현재 timestamp (default = new Date()). 결정성 테스트 위해 inject 허용. */
  readonly now?: Date;
}

export interface ScheduleReviewResult {
  readonly nextState: FsrsCardState;
  /** review 이력 row source (study_reviews 테이블 INSERT 용). */
  readonly review: {
    readonly rating: FsrsRating;
    readonly stabilityBefore: number;
    readonly stabilityAfter: number;
    readonly intervalDays: number;
    readonly reviewedAt: string;
  };
}

/**
 * weak_score 산식 입력 (D2 lock 정합).
 *
 * `weakScore = α·(1 - subjectCorrectRate) + β·(1 - conceptStability_normalized)`
 *
 * subjectCorrectRate: 사용자의 해당 과목 정답률 (0~1)
 * conceptStability: 해당 concept의 FSRS stability (0~∞, 정규화 필요)
 */
export interface WeakScoreInput {
  readonly subjectCorrectRate: number;
  readonly conceptStability: number;
  /** subject 가중치 (default 0.6, D8 carry-over 조정). */
  readonly alpha?: number;
  /** concept 가중치 (default 0.4, D8 carry-over 조정). */
  readonly beta?: number;
}

/** weak_score 산식 default 가중치 (plan §13.1 + D8 carry-over). */
export const WEAK_SCORE_WEIGHTS = {
  alpha: 0.6,
  beta: 0.4,
} as const;

/**
 * Concept stability 정규화 임계값.
 *
 * FSRS stability는 0~∞ 범위 (일수 단위). weak_score 입력은 0~1 정규화 필요.
 * 마스터 임계값으로 사용 (stability >= MASTERED_THRESHOLD_DAYS → conceptStability=1).
 */
export const MASTERED_THRESHOLD_DAYS = 30 as const;
