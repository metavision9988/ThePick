/**
 * @thepick/learning-modes types — 학습 모드 코어 type 정의.
 *
 * plan §4 정합 (Phase 3 학습 UX 5축).
 * Step 3-UX-2 (packages/learning-modes 신설).
 */

export const INPUT_TYPES = ['multiple_choice', 'fill_blank', 'essay', 'calc'] as const;
export type InputType = (typeof INPUT_TYPES)[number];

export const LEARNING_MODES = ['category', 'topic', 'confusion', 'weak', 'mixed'] as const;
export type LearningMode = (typeof LEARNING_MODES)[number];

export const SESSION_PHASES = ['warmup', 'main', 'cooldown', 'completed'] as const;
export type SessionPhase = (typeof SESSION_PHASES)[number];

// FSRS_RATINGS / FsrsRating 는 @thepick/srs 로 이관 (srs → learning-modes 역의존
// 차단, plan §7.3:375). 본 패키지 내부 미사용 — 소비자(apps/api)는 @thepick/srs 에서 import.
