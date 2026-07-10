/**
 * rating — P4-D4 FSRS rating 매핑 골든 테스트.
 * 불변: 자동 채점 경로는 'easy'를 절대 주지 않는다(과대 간격 방지).
 */

import { describe, expect, it } from 'vitest';
import { FLIP_RATING_LABELS, ratingFromBlankGrade, ratingFromMcGrade } from '../rating';

describe('ratingFromMcGrade', () => {
  it("맞음='good' / 틀림='again'", () => {
    expect(ratingFromMcGrade(true)).toBe('good');
    expect(ratingFromMcGrade(false)).toBe('again');
  });
});

describe('ratingFromBlankGrade (M9 — 힌트 수 반영)', () => {
  it("틀림 = 힌트 무관 'again'", () => {
    expect(ratingFromBlankGrade(false, 0)).toBe('again');
    expect(ratingFromBlankGrade(false, 4)).toBe('again');
  });

  it("맞음·힌트 0 = 'good', 맞음·힌트 1+ = 'hard'", () => {
    expect(ratingFromBlankGrade(true, 0)).toBe('good');
    expect(ratingFromBlankGrade(true, 1)).toBe('hard');
    expect(ratingFromBlankGrade(true, 4)).toBe('hard');
  });

  it("자동 채점 경로는 'easy' 불가", () => {
    for (const isCorrect of [true, false]) {
      for (let hints = 0; hints <= 4; hints++) {
        expect(ratingFromBlankGrade(isCorrect, hints)).not.toBe('easy');
      }
    }
  });
});

describe('FLIP_RATING_LABELS', () => {
  it('4버튼 = 모름/애매/알았음/쉬움 → again/hard/good/easy (1~4 키 순서)', () => {
    expect(FLIP_RATING_LABELS.map((r) => r.rating)).toEqual(['again', 'hard', 'good', 'easy']);
    expect(FLIP_RATING_LABELS.map((r) => r.label)).toEqual(['모름', '애매', '알았음', '쉬움']);
  });
});
