import { describe, expect, it } from 'vitest';
import { gradeCalc } from '../input-types/calc.js';

describe('gradeCalc', () => {
  it('정수 정확 일치 → 정답', () => {
    const result = gradeCalc({ expectedValue: '800000', userValue: '800000' });
    expect(result.isCorrect).toBe(true);
    expect(result.expectedNumeric).toBe(800000);
    expect(result.userNumeric).toBe(800000);
    expect(result.autoGraded).toBe(true);
  });

  it('콤마 천단위 구분자 → 정답', () => {
    expect(gradeCalc({ expectedValue: '1000000', userValue: '1,000,000' }).isCorrect).toBe(true);
    expect(gradeCalc({ expectedValue: '1,000,000', userValue: '1000000' }).isCorrect).toBe(true);
  });

  it('공백 포함 → 정답', () => {
    expect(gradeCalc({ expectedValue: '1000', userValue: ' 1000 ' }).isCorrect).toBe(true);
  });

  it('소수점 정확 일치 → 정답', () => {
    expect(gradeCalc({ expectedValue: '1.05', userValue: '1.05' }).isCorrect).toBe(true);
  });

  it('tolerance 허용 시 근사값 → 정답', () => {
    expect(
      gradeCalc({ expectedValue: '1.05', userValue: '1.051', tolerance: 0.01 }).isCorrect,
    ).toBe(true);
    expect(gradeCalc({ expectedValue: '1.05', userValue: '1.10', tolerance: 0.01 }).isCorrect).toBe(
      false,
    );
  });

  it('tolerance 0 default → 정확 일치만', () => {
    expect(gradeCalc({ expectedValue: '1.05', userValue: '1.051' }).isCorrect).toBe(false);
  });

  it('음수 정답 처리', () => {
    expect(gradeCalc({ expectedValue: '-100', userValue: '-100' }).isCorrect).toBe(true);
    expect(gradeCalc({ expectedValue: '-100', userValue: '100' }).isCorrect).toBe(false);
  });

  it('".5" 같은 leading dot decimal 허용', () => {
    expect(gradeCalc({ expectedValue: '0.5', userValue: '.5' }).isCorrect).toBe(true);
  });

  it('서술형 정답 ("보험가액의 80%") → 자동 채점 불가', () => {
    const result = gradeCalc({ expectedValue: '보험가액의 80%', userValue: '800000' });
    expect(result.autoGraded).toBe(false);
    expect(result.isCorrect).toBe(false);
    expect(result.expectedNumeric).toBeNull();
    expect(result.userNumeric).toBe(800000);
  });

  it('사용자가 숫자 외 입력 → autoGraded false', () => {
    const result = gradeCalc({ expectedValue: '1000', userValue: 'abc' });
    expect(result.autoGraded).toBe(false);
    expect(result.userNumeric).toBeNull();
  });

  it('빈 입력 → autoGraded false', () => {
    expect(gradeCalc({ expectedValue: '1000', userValue: '' }).autoGraded).toBe(false);
    expect(gradeCalc({ expectedValue: '', userValue: '1000' }).autoGraded).toBe(false);
  });

  it('큰 수치 (보험금 단위) 처리', () => {
    expect(
      gradeCalc({
        expectedValue: '50000000',
        userValue: '50,000,000',
      }).isCorrect,
    ).toBe(true);
  });
});
