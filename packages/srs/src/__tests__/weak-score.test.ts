import { describe, expect, it } from 'vitest';
import { byWeakScoreDesc, computeWeakScore, normalizeStability } from '../weak-score.js';
import { MASTERED_THRESHOLD_DAYS, WEAK_SCORE_WEIGHTS } from '../types.js';

describe('normalizeStability', () => {
  it('stability 0 → 0', () => {
    expect(normalizeStability(0)).toBe(0);
  });

  it('stability 음수 → 0 (clamp)', () => {
    expect(normalizeStability(-10)).toBe(0);
  });

  it('stability >= MASTERED_THRESHOLD_DAYS → 1 (clamp)', () => {
    expect(normalizeStability(MASTERED_THRESHOLD_DAYS)).toBe(1);
    expect(normalizeStability(100)).toBe(1);
  });

  it('stability 중간값 → 선형 비례', () => {
    expect(normalizeStability(MASTERED_THRESHOLD_DAYS / 2)).toBeCloseTo(0.5, 3);
    expect(normalizeStability(MASTERED_THRESHOLD_DAYS * 0.25)).toBeCloseTo(0.25, 3);
  });
});

describe('computeWeakScore', () => {
  it('완전 마스터 (정답률 1 + stability ≥ threshold) → 0', () => {
    const score = computeWeakScore({
      subjectCorrectRate: 1,
      conceptStability: MASTERED_THRESHOLD_DAYS,
    });
    expect(score).toBeCloseTo(0, 5);
  });

  it('가장 약점 (정답률 0 + stability 0) → α + β', () => {
    const score = computeWeakScore({
      subjectCorrectRate: 0,
      conceptStability: 0,
    });
    expect(score).toBeCloseTo(WEAK_SCORE_WEIGHTS.alpha + WEAK_SCORE_WEIGHTS.beta, 5);
  });

  it('default α=0.6 + β=0.4 정합', () => {
    const score = computeWeakScore({
      subjectCorrectRate: 0.5,
      conceptStability: 0,
    });
    // α·(1-0.5) + β·(1-0) = 0.6·0.5 + 0.4·1 = 0.3 + 0.4 = 0.7
    expect(score).toBeCloseTo(0.7, 5);
  });

  it('custom α/β 적용', () => {
    const score = computeWeakScore({
      subjectCorrectRate: 0,
      conceptStability: 0,
      alpha: 1,
      beta: 0,
    });
    expect(score).toBeCloseTo(1, 5);
  });

  it('subjectCorrectRate clamp (>1 → 1)', () => {
    const score = computeWeakScore({
      subjectCorrectRate: 1.5,
      conceptStability: MASTERED_THRESHOLD_DAYS,
    });
    expect(score).toBeCloseTo(0, 5);
  });

  it('subjectCorrectRate clamp (<0 → 0)', () => {
    const score = computeWeakScore({
      subjectCorrectRate: -0.5,
      conceptStability: 0,
    });
    // -0.5 → 0 (clamp), 그러면 (1-0)=1
    expect(score).toBeCloseTo(WEAK_SCORE_WEIGHTS.alpha + WEAK_SCORE_WEIGHTS.beta, 5);
  });

  it('subjectCorrectRate NaN → 0 처리', () => {
    const score = computeWeakScore({
      subjectCorrectRate: Number.NaN,
      conceptStability: MASTERED_THRESHOLD_DAYS,
    });
    // NaN → 0, (1-0)·α + (1-1)·β = α
    expect(score).toBeCloseTo(WEAK_SCORE_WEIGHTS.alpha, 5);
  });

  it('약점 점수는 monotonic — 정답률 낮을수록 weak_score 높음', () => {
    const high = computeWeakScore({
      subjectCorrectRate: 0.9,
      conceptStability: 0,
    });
    const low = computeWeakScore({
      subjectCorrectRate: 0.1,
      conceptStability: 0,
    });
    expect(low).toBeGreaterThan(high);
  });

  it('약점 점수는 monotonic — stability 낮을수록 weak_score 높음', () => {
    const stable = computeWeakScore({
      subjectCorrectRate: 0.5,
      conceptStability: MASTERED_THRESHOLD_DAYS,
    });
    const unstable = computeWeakScore({
      subjectCorrectRate: 0.5,
      conceptStability: 0,
    });
    expect(unstable).toBeGreaterThan(stable);
  });
});

describe('byWeakScoreDesc', () => {
  it('weak_score 내림차순 정렬 (약점 우선)', () => {
    const cards = [
      { id: 'a', weakScore: 0.3 },
      { id: 'b', weakScore: 0.8 },
      { id: 'c', weakScore: 0.1 },
      { id: 'd', weakScore: 0.5 },
    ];
    const sorted = cards.slice().sort(byWeakScoreDesc);
    expect(sorted.map((c) => c.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('동일 weak_score는 안정 (stable sort)', () => {
    const cards = [
      { id: 'a', weakScore: 0.5 },
      { id: 'b', weakScore: 0.5 },
      { id: 'c', weakScore: 0.5 },
    ];
    const sorted = cards.slice().sort(byWeakScoreDesc);
    // Array.prototype.sort는 V8 12+ 부터 stable. id 순서 보존.
    expect(sorted.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('빈 배열 정렬 (방어)', () => {
    expect([].sort(byWeakScoreDesc)).toEqual([]);
  });
});

describe('WEAK_SCORE_WEIGHTS', () => {
  it('default α + β = 1', () => {
    expect(WEAK_SCORE_WEIGHTS.alpha + WEAK_SCORE_WEIGHTS.beta).toBeCloseTo(1, 5);
  });

  it('α > β (D2 lock 정합 — subject 정답률이 concept stability보다 우선)', () => {
    expect(WEAK_SCORE_WEIGHTS.alpha).toBeGreaterThan(WEAK_SCORE_WEIGHTS.beta);
  });
});
