import { describe, expect, it } from 'vitest';
import { gradeFillBlank } from '../input-types/fill-blank.js';

describe('gradeFillBlank', () => {
  it('동일 string → 정답', () => {
    expect(gradeFillBlank({ expected: '보험가액', userAnswer: '보험가액' }).isCorrect).toBe(true);
  });

  it('normalize 후 동일 → 정답', () => {
    expect(gradeFillBlank({ expected: '①', userAnswer: '1' }).isCorrect).toBe(true);
    expect(gradeFillBlank({ expected: '②', userAnswer: '2번' }).isCorrect).toBe(true);
    expect(gradeFillBlank({ expected: '  Hello  ', userAnswer: 'HELLO' }).isCorrect).toBe(true);
  });

  it('다른 답 → 오답', () => {
    expect(gradeFillBlank({ expected: '보험가액', userAnswer: '보험금' }).isCorrect).toBe(false);
    expect(gradeFillBlank({ expected: '①', userAnswer: '2' }).isCorrect).toBe(false);
  });

  it('expected 빈 string → 오답 (정답 데이터 부재)', () => {
    expect(gradeFillBlank({ expected: '', userAnswer: '1' }).isCorrect).toBe(false);
  });

  it('userAnswer 빈 string → 오답', () => {
    expect(gradeFillBlank({ expected: '①', userAnswer: '' }).isCorrect).toBe(false);
    expect(gradeFillBlank({ expected: '①', userAnswer: '   ' }).isCorrect).toBe(false);
  });

  it('서술형 정답 normalize 후 비교', () => {
    expect(
      gradeFillBlank({
        expected: '보험가액의 80%',
        userAnswer: '보험가액의80%',
      }).isCorrect,
    ).toBe(true);
  });

  it('normalize 결과를 result에 포함 (audit)', () => {
    const result = gradeFillBlank({ expected: '①', userAnswer: '1' });
    expect(result.normalizedExpected).toBe('1');
    expect(result.normalizedUser).toBe('1');
  });

  it('"호" vs "번" — 호 보존 (carry-over)', () => {
    // Pass 1 M1 회귀 정합: '1호' ≠ '1번'
    expect(gradeFillBlank({ expected: '1호', userAnswer: '1번' }).isCorrect).toBe(false);
    expect(gradeFillBlank({ expected: '1호', userAnswer: '1호' }).isCorrect).toBe(true);
  });
});
