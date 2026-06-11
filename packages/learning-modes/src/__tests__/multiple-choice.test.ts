import { describe, expect, it } from 'vitest';
import {
  gradeMultipleChoice,
  multipleChoiceAnswerToIndex,
} from '../input-types/multiple-choice.js';
import type { ShuffledChoice } from '../shuffle.js';

const sampleShuffled: ShuffledChoice[] = [
  { label: 'A', originalIndex: 2, text: 'choice three' },
  { label: 'B', originalIndex: 0, text: 'choice one' },
  { label: 'C', originalIndex: 4, text: 'choice five' },
  { label: 'D', originalIndex: 1, text: 'choice two' },
  { label: 'E', originalIndex: 3, text: 'choice four' },
];

// 결재 #2 (2026-06-11): correctOriginalIndex(단수) → correctOriginalIndices(집합) 계약 전환.
// 기존 시나리오 의도는 단원소 Set 으로 보존.
describe('gradeMultipleChoice', () => {
  it('정답 위치 {2} → 셔플 후 라벨 A 선택 시 정답', () => {
    const result = gradeMultipleChoice({
      submittedLabel: 'A',
      shuffledChoices: sampleShuffled,
      correctOriginalIndices: new Set([2]),
    });
    expect(result.isCorrect).toBe(true);
    expect(result.submittedOriginalIndex).toBe(2);
    expect(result.correctLabels).toEqual(['A']);
  });

  it('정답 위치 {0} → 셔플 후 라벨 B 선택 시 정답', () => {
    const result = gradeMultipleChoice({
      submittedLabel: 'B',
      shuffledChoices: sampleShuffled,
      correctOriginalIndices: new Set([0]),
    });
    expect(result.isCorrect).toBe(true);
    expect(result.correctLabels).toEqual(['B']);
  });

  it('정답 위치 {4} → 셔플 후 라벨 C 외 선택 시 오답', () => {
    const result = gradeMultipleChoice({
      submittedLabel: 'A',
      shuffledChoices: sampleShuffled,
      correctOriginalIndices: new Set([4]),
    });
    expect(result.isCorrect).toBe(false);
    expect(result.submittedOriginalIndex).toBe(2);
    expect(result.correctLabels).toEqual(['C']);
  });

  it('복수정답 {1,2} — 어느 정답 보기(D 또는 A)를 골라도 정답 (공식 복수정답 인정)', () => {
    for (const label of ['A', 'D'] as const) {
      const result = gradeMultipleChoice({
        submittedLabel: label,
        shuffledChoices: sampleShuffled,
        correctOriginalIndices: new Set([1, 2]),
      });
      expect(result.isCorrect).toBe(true);
      expect(result.correctLabels).toEqual(['A', 'D']); // 셔플 순서대로
    }
    const wrong = gradeMultipleChoice({
      submittedLabel: 'B',
      shuffledChoices: sampleShuffled,
      correctOriginalIndices: new Set([1, 2]),
    });
    expect(wrong.isCorrect).toBe(false);
  });

  it('정답 데이터 부재 (null) → 오답 + correctLabels 빈 배열', () => {
    const result = gradeMultipleChoice({
      submittedLabel: 'A',
      shuffledChoices: sampleShuffled,
      correctOriginalIndices: null,
    });
    expect(result.isCorrect).toBe(false);
    expect(result.correctLabels).toEqual([]);
  });

  it('submittedLabel이 셔플에 없음 (잘못된 입력) → submittedOriginalIndex null + 오답', () => {
    const result = gradeMultipleChoice({
      submittedLabel: 'Z',
      shuffledChoices: sampleShuffled,
      correctOriginalIndices: new Set([0]),
    });
    expect(result.isCorrect).toBe(false);
    expect(result.submittedOriginalIndex).toBeNull();
    expect(result.correctLabels).toEqual(['B']);
  });

  it('빈 셔플 → 항상 오답 (방어)', () => {
    const result = gradeMultipleChoice({
      submittedLabel: 'A',
      shuffledChoices: [],
      correctOriginalIndices: new Set([0]),
    });
    expect(result.isCorrect).toBe(false);
    expect(result.submittedOriginalIndex).toBeNull();
  });
});

describe('multipleChoiceAnswerToIndex (deprecated 호환 래퍼 — 정본 = parseMcAnswerLabels)', () => {
  it('원형숫자 ① ~ ⑤ → 0 ~ 4', () => {
    expect(multipleChoiceAnswerToIndex('①')).toBe(0);
    expect(multipleChoiceAnswerToIndex('③')).toBe(2);
    expect(multipleChoiceAnswerToIndex('⑤')).toBe(4);
  });

  it('숫자 "1" ~ "5" / "N번" → 0 ~ 4', () => {
    expect(multipleChoiceAnswerToIndex('1')).toBe(0);
    expect(multipleChoiceAnswerToIndex('5')).toBe(4);
    expect(multipleChoiceAnswerToIndex('3번')).toBe(2);
  });

  it('범위 외·서술형·빈 string → null', () => {
    expect(multipleChoiceAnswerToIndex('6')).toBeNull();
    expect(multipleChoiceAnswerToIndex('0')).toBeNull();
    expect(multipleChoiceAnswerToIndex('보험가액의 80%')).toBeNull();
    expect(multipleChoiceAnswerToIndex('')).toBeNull();
  });

  it('복수정답 "2,3" → null (단수 API 로 표현 불가 — parseMcAnswerLabels 사용 강제)', () => {
    expect(multipleChoiceAnswerToIndex('2,3')).toBeNull();
  });

  it('공백 trim 후 처리', () => {
    expect(multipleChoiceAnswerToIndex('  ②  ')).toBe(1);
  });
});
