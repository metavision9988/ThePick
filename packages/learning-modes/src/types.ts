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

export const FSRS_RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export type FsrsRating = (typeof FSRS_RATINGS)[number];
