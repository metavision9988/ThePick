/**
 * @thepick/learning-modes — Phase 3 학습 UX core 엔진.
 *
 * 본 패키지는 답안 채점 invariant + 보기 셔플 시드 + 답안 normalize 등
 * 학습 모드 코어 로직을 단일 패키지로 격리한다 (Engine-First).
 *
 * plan: docs/plans/phase3-learning-ux-modes.plan.md (Step 3-UX-2)
 *
 * 사용처:
 *   - apps/api: study routes에서 4 input type 채점
 *   - apps/web: 클라이언트는 type만 import, 채점은 server (보안)
 *
 * 의존: @thepick/shared (TYPES + EXAM_IDS)
 *
 * Step 3-UX-3 추가:
 *   - packages/srs FSRS-4 + weak_score 통합 (D2 lock 정합)
 *
 * Step 3-UX-5 통합:
 *   - apps/api/src/study/routes.ts 본 패키지 import 전환
 */

export * from './types.js';

export { normalizeAnswer } from './normalize.js';

export {
  CHOICE_LABELS,
  createPrng,
  dailySeed,
  shuffleChoices,
  shuffleWithSeed,
  todayDateString,
  type ChoiceLabel,
  type ShuffleSeedInput,
  type ShuffledChoice,
} from './shuffle.js';

export {
  gradeMultipleChoice,
  multipleChoiceAnswerToIndex,
  type MultipleChoiceGradeInput,
  type MultipleChoiceGradeResult,
} from './input-types/multiple-choice.js';

export {
  gradeFillBlank,
  type FillBlankGradeInput,
  type FillBlankGradeResult,
} from './input-types/fill-blank.js';

export {
  gradeEssay,
  type EssayGradeInput,
  type EssayGradeResult,
  type EssaySelfRating,
} from './input-types/essay.js';

export { gradeCalc, type CalcGradeInput, type CalcGradeResult } from './input-types/calc.js';

export {
  KST_OFFSET_HOURS,
  PHASE_THRESHOLD_WARMUP,
  PHASE_THRESHOLD_COOLDOWN,
  computePhaseFromProgress,
  computeStreakUpdate,
  dayBoundsUtc,
  isOneDayApart,
  resolveLearningMode,
  resolveSessionPhase,
  type DayBoundsUtc,
  type NarrowingFallback,
  type StreakInput,
  type StreakUpdate,
} from './session-progress.js';
