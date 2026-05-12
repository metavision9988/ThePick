import { describe, expect, it } from 'vitest';
import { createFreshCard, replayReviews, scheduleReview } from '../fsrs.js';
import type { FsrsCardState } from '../types.js';

const FIXED_NOW = new Date('2026-05-12T08:00:00.000Z');
const ONE_DAY_LATER = new Date('2026-05-13T08:00:00.000Z');
const ONE_WEEK_LATER = new Date('2026-05-19T08:00:00.000Z');

describe('createFreshCard', () => {
  it('new state + reps=0 + lapses=0 + stability=0', () => {
    const card = createFreshCard(FIXED_NOW);
    expect(card.state).toBe('new');
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
    expect(card.stability).toBe(0);
    expect(card.lastReview).toBeNull();
  });

  it('due timestamp는 ISO string', () => {
    const card = createFreshCard(FIXED_NOW);
    expect(card.due).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('now 미주입 시 현재 시각 사용 (smoke)', () => {
    const card = createFreshCard();
    expect(card.state).toBe('new');
  });
});

describe('scheduleReview', () => {
  it('new 카드 + good rating → state 전이 + reps=1', () => {
    const initial = createFreshCard(FIXED_NOW);
    const result = scheduleReview({ state: initial, rating: 'good', now: FIXED_NOW });
    expect(result.nextState.reps).toBe(1);
    expect(['learning', 'review']).toContain(result.nextState.state);
    expect(result.review.rating).toBe('good');
  });

  it('again rating → lapses 증가 가능 (review 상태 카드에 대해)', () => {
    // 신규 카드를 학습 후 review state로 진입시키고 again 적용
    const initial = createFreshCard(FIXED_NOW);
    const afterGood = scheduleReview({ state: initial, rating: 'good', now: FIXED_NOW });
    const afterEasy = scheduleReview({
      state: afterGood.nextState,
      rating: 'easy',
      now: ONE_DAY_LATER,
    });
    // afterEasy는 review state 진입 기대
    const afterAgain = scheduleReview({
      state: afterEasy.nextState,
      rating: 'again',
      now: ONE_WEEK_LATER,
    });
    expect(afterAgain.nextState.lapses).toBeGreaterThanOrEqual(afterEasy.nextState.lapses);
  });

  it('결정성: 같은 (state, rating, now) → 같은 nextState', () => {
    const initial = createFreshCard(FIXED_NOW);
    const r1 = scheduleReview({ state: initial, rating: 'good', now: FIXED_NOW });
    const r2 = scheduleReview({ state: initial, rating: 'good', now: FIXED_NOW });
    expect(r1.nextState).toEqual(r2.nextState);
    expect(r1.review.stabilityAfter).toBe(r2.review.stabilityAfter);
  });

  it('review 결과 metadata: stabilityBefore/After + intervalDays + reviewedAt', () => {
    const initial = createFreshCard(FIXED_NOW);
    const result = scheduleReview({ state: initial, rating: 'good', now: FIXED_NOW });
    expect(result.review.stabilityBefore).toBe(0);
    expect(result.review.stabilityAfter).toBeGreaterThan(0);
    expect(result.review.intervalDays).toBeGreaterThanOrEqual(0);
    expect(result.review.reviewedAt).toBe(FIXED_NOW.toISOString());
  });

  it('easy rating은 good보다 stability 더 큼 (FSRS-4 paper 정합)', () => {
    const initial = createFreshCard(FIXED_NOW);
    const good = scheduleReview({ state: initial, rating: 'good', now: FIXED_NOW });
    const easy = scheduleReview({ state: initial, rating: 'easy', now: FIXED_NOW });
    expect(easy.nextState.stability).toBeGreaterThanOrEqual(good.nextState.stability);
  });

  it('hard rating은 good보다 stability 더 작거나 같음', () => {
    const initial = createFreshCard(FIXED_NOW);
    const good = scheduleReview({ state: initial, rating: 'good', now: FIXED_NOW });
    const hard = scheduleReview({ state: initial, rating: 'hard', now: FIXED_NOW });
    expect(hard.nextState.stability).toBeLessThanOrEqual(good.nextState.stability);
  });

  it('연속 good 4회 → stability 증가 monotonic', () => {
    let state = createFreshCard(FIXED_NOW);
    const stabilities: number[] = [];
    const times = [
      FIXED_NOW,
      ONE_DAY_LATER,
      new Date('2026-05-15T08:00:00.000Z'),
      new Date('2026-05-25T08:00:00.000Z'),
    ];
    for (const t of times) {
      const result = scheduleReview({ state, rating: 'good', now: t });
      state = result.nextState;
      stabilities.push(state.stability);
    }
    // monotonic 증가 (또는 동일)
    for (let i = 1; i < stabilities.length; i++) {
      expect(stabilities[i]!).toBeGreaterThanOrEqual(stabilities[i - 1]!);
    }
  });

  it('lastReview는 now timestamp로 갱신', () => {
    const initial = createFreshCard(FIXED_NOW);
    const result = scheduleReview({ state: initial, rating: 'good', now: ONE_DAY_LATER });
    expect(result.nextState.lastReview).toBe(ONE_DAY_LATER.toISOString());
  });
});

describe('replayReviews', () => {
  it('빈 reviews → initialState 그대로', () => {
    const initial = createFreshCard(FIXED_NOW);
    const result = replayReviews(initial, []);
    expect(result).toEqual(initial);
  });

  it('단일 review 적용 = scheduleReview 결과', () => {
    const initial = createFreshCard(FIXED_NOW);
    const direct = scheduleReview({
      state: initial,
      rating: 'good',
      now: ONE_DAY_LATER,
    });
    const replayed = replayReviews(initial, [{ rating: 'good', reviewedAt: ONE_DAY_LATER }]);
    expect(replayed).toEqual(direct.nextState);
  });

  it('연속 reviews → 누적 state 변화', () => {
    const initial = createFreshCard(FIXED_NOW);
    const replayed = replayReviews(initial, [
      { rating: 'good', reviewedAt: ONE_DAY_LATER },
      { rating: 'good', reviewedAt: ONE_WEEK_LATER },
      { rating: 'easy', reviewedAt: new Date('2026-05-29T08:00:00.000Z') },
    ]);
    expect(replayed.reps).toBe(3);
    expect(replayed.stability).toBeGreaterThan(0);
  });

  it('결정성: 같은 reviews 순서 → 같은 final state (cold start replay 검증)', () => {
    const initial = createFreshCard(FIXED_NOW);
    const reviews = [
      { rating: 'good' as const, reviewedAt: ONE_DAY_LATER },
      { rating: 'hard' as const, reviewedAt: ONE_WEEK_LATER },
    ];
    expect(replayReviews(initial, reviews)).toEqual(replayReviews(initial, reviews));
  });

  it('ISO string reviewedAt 허용 (D1 row fetch 정합)', () => {
    const initial = createFreshCard(FIXED_NOW);
    const replayed = replayReviews(initial, [
      { rating: 'good', reviewedAt: ONE_DAY_LATER.toISOString() },
    ]);
    expect(replayed.reps).toBe(1);
  });
});

describe('FsrsCardState round-trip (D1 직렬화)', () => {
  it('FsrsCardState → scheduleReview → 다시 FsrsCardState (정합 검증)', () => {
    const initial = createFreshCard(FIXED_NOW);
    const result = scheduleReview({ state: initial, rating: 'good', now: ONE_DAY_LATER });
    const state: FsrsCardState = result.nextState;
    // JSON 직렬화 후 복원 (D1 fsrs_state JSON 컬럼 round-trip)
    const json = JSON.stringify(state);
    const restored = JSON.parse(json) as FsrsCardState;
    expect(restored).toEqual(state);

    // 복원된 state로 다음 review 적용 가능
    const next = scheduleReview({
      state: restored,
      rating: 'good',
      now: ONE_WEEK_LATER,
    });
    expect(next.nextState.reps).toBe(state.reps + 1);
  });
});
