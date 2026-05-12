import { describe, expect, it } from 'vitest';
import { gradeEssay } from '../input-types/essay.js';

describe('gradeEssay', () => {
  it("self-rating 'correct' → 정답", () => {
    const result = gradeEssay({ userAnswer: '서술 답안', selfRating: 'correct' });
    expect(result.isCorrect).toBe(true);
    expect(result.partial).toBe(false);
  });

  it("self-rating 'partial' → 오답 (자동) + partial=true", () => {
    const result = gradeEssay({ userAnswer: '부분 답안', selfRating: 'partial' });
    expect(result.isCorrect).toBe(false);
    expect(result.partial).toBe(true);
  });

  it("self-rating 'incorrect' → 오답", () => {
    const result = gradeEssay({ userAnswer: '틀린 답안', selfRating: 'incorrect' });
    expect(result.isCorrect).toBe(false);
    expect(result.partial).toBe(false);
  });

  it('userAnswer 내용은 채점 결과에 영향 없음 (self-grade만)', () => {
    const r1 = gradeEssay({ userAnswer: 'a', selfRating: 'correct' });
    const r2 = gradeEssay({ userAnswer: 'b'.repeat(10000), selfRating: 'correct' });
    expect(r1.isCorrect).toBe(r2.isCorrect);
  });
});
