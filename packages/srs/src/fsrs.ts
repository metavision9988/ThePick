/**
 * @thepick/srs/fsrs — ts-fsrs (FSRS-4) wrapper.
 *
 * plan §6.1 D2 lock + §7 Engine-First.
 *   - 결정성 wrapper: 같은 input → 같은 output (시간만 변동)
 *   - D1 영속 가능한 FsrsCardState로 직렬화
 *   - FsrsRating ('again'|'hard'|'good'|'easy') ↔ ts-fsrs Rating enum 매핑
 *   - Workers 호환 (Date + 순수 수학만, Node 의존 0)
 *
 * Reference: docs/plans/phase3-learning-ux-modes.plan.md §13.1
 */

import { Card, FSRS, Grade, Rating, State, createEmptyCard, generatorParameters } from 'ts-fsrs';
import type { FsrsRating } from '@thepick/learning-modes';
import type { FsrsCardState, ScheduleReviewInput, ScheduleReviewResult } from './types.js';

const FSRS_INSTANCE = new FSRS(generatorParameters());

const RATING_MAP: Record<FsrsRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const STATE_TO_STRING: Record<State, FsrsCardState['state']> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const STRING_TO_STATE: Record<FsrsCardState['state'], State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

function toIsoString(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

/**
 * ts-fsrs Card → D1 영속 FsrsCardState.
 *
 * ts-fsrs Card 일부 필드 (learning_steps, elapsed_days)는 본 wrapper에서 노출 X
 * — D1 스키마 작아짐 + 향후 ts-fsrs upgrade 시 영향 격리.
 */
function fromFsrsCard(card: Card): FsrsCardState {
  return {
    due: toIsoString(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_TO_STRING[card.state],
    lastReview: card.last_review !== undefined ? toIsoString(card.last_review) : null,
    scheduledDays: card.scheduled_days,
  };
}

/**
 * D1 FsrsCardState → ts-fsrs Card 복원.
 *
 * learning_steps / elapsed_days는 ts-fsrs 자체 계산 (next 호출 시 갱신).
 * 본 wrapper는 외부 필드만 직렬화하므로 ts-fsrs default로 채움.
 */
function toFsrsCard(state: FsrsCardState): Card {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    reps: state.reps,
    lapses: state.lapses,
    state: STRING_TO_STATE[state.state],
    last_review: state.lastReview !== null ? new Date(state.lastReview) : undefined,
    learning_steps: 0,
    scheduled_days: state.scheduledDays,
    elapsed_days: 0,
  };
}

/**
 * 신규 카드 초기화 (cold start).
 *
 * 사용처: 사용자가 카드를 처음 만났을 때 (user_progress row 신규 INSERT 직전).
 */
export function createFreshCard(now?: Date): FsrsCardState {
  const t = now ?? new Date();
  const card = createEmptyCard(t);
  return fromFsrsCard(card);
}

/**
 * Review 이력 적용 → 다음 카드 상태 계산.
 *
 * 정합:
 *   - 결정성: 같은 (state, rating, now) → 같은 output
 *   - D1 study_reviews INSERT row source: ScheduleReviewResult.review
 *   - now 파라미터 inject 허용 (vitest fake timer 없이도 결정성 보장)
 */
export function scheduleReview(input: ScheduleReviewInput): ScheduleReviewResult {
  const t = input.now ?? new Date();
  const card = toFsrsCard(input.state);
  const record = FSRS_INSTANCE.next(card, t, RATING_MAP[input.rating]);
  const nextState = fromFsrsCard(record.card);

  return {
    nextState,
    review: {
      rating: input.rating,
      stabilityBefore: input.state.stability,
      stabilityAfter: nextState.stability,
      intervalDays: nextState.scheduledDays,
      reviewedAt: t.toISOString(),
    },
  };
}

/**
 * Review 이력 누적 재생 (replay).
 *
 * 사용처:
 *   - cold start 후 사용자가 다른 device에서 review 누적 → state 복원
 *   - D1 study_reviews fetch (chronological) → 본 함수로 누적 reduce → 최종 state
 *   - 마이그레이션 0033 backward-compat: fsrs_state IS NULL row를 study_reviews로부터 복원
 *
 * 결정성: 같은 (initialState, reviews 순서) → 같은 최종 state.
 */
export function replayReviews(
  initialState: FsrsCardState,
  reviews: ReadonlyArray<{ rating: FsrsRating; reviewedAt: Date | string }>,
): FsrsCardState {
  let state = initialState;
  for (const review of reviews) {
    const t = review.reviewedAt instanceof Date ? review.reviewedAt : new Date(review.reviewedAt);
    const result = scheduleReview({ state, rating: review.rating, now: t });
    state = result.nextState;
  }
  return state;
}
