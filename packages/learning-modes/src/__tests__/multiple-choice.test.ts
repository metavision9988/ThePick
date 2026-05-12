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

describe('gradeMultipleChoice', () => {
  it('정답 originalIndex=2 → 셔플 후 라벨 A 선택 시 정답', () => {
    const result = gradeMultipleChoice({
      submittedLabel: 'A',
      shuffledChoices: sampleShuffled,
      correctOriginalIndex: 2,
    });
    expect(result.isCorrect).toBe(true);
    expect(result.submittedOriginalIndex).toBe(2);
    expect(result.correctLabel).toBe('A');
  });

  it('정답 originalIndex=0 → 셔플 후 라벨 B 선택 시 정답', () => {
    const result = gradeMultipleChoice({
      submittedLabel: 'B',
      shuffledChoices: sampleShuffled,
      correctOriginalIndex: 0,
    });
    expect(result.isCorrect).toBe(true);
    expect(result.correctLabel).toBe('B');
  });

  it('정답 originalIndex=4 → 셔플 후 라벨 C 외 선택 시 오답', () => {
    const result = gradeMultipleChoice({
      submittedLabel: 'A',
      shuffledChoices: sampleShuffled,
      correctOriginalIndex: 4,
    });
    expect(result.isCorrect).toBe(false);
    expect(result.submittedOriginalIndex).toBe(2);
    expect(result.correctLabel).toBe('C');
  });

  it('정답 데이터 부재 (correctOriginalIndex null) → 오답 + correctLabel 빈 string', () => {
    const result = gradeMultipleChoice({
      submittedLabel: 'A',
      shuffledChoices: sampleShuffled,
      correctOriginalIndex: null,
    });
    expect(result.isCorrect).toBe(false);
    expect(result.correctLabel).toBe('');
  });

  it('submittedLabel이 셔플에 없음 (잘못된 입력) → submittedOriginalIndex null + 오답', () => {
    const result = gradeMultipleChoice({
      submittedLabel: 'Z',
      shuffledChoices: sampleShuffled,
      correctOriginalIndex: 0,
    });
    expect(result.isCorrect).toBe(false);
    expect(result.submittedOriginalIndex).toBeNull();
    expect(result.correctLabel).toBe('B');
  });

  it('빈 셔플 → 항상 오답 (방어)', () => {
    const result = gradeMultipleChoice({
      submittedLabel: 'A',
      shuffledChoices: [],
      correctOriginalIndex: 0,
    });
    expect(result.isCorrect).toBe(false);
    expect(result.submittedOriginalIndex).toBeNull();
  });
});

describe('multipleChoiceAnswerToIndex', () => {
  it('원형숫자 ① ~ ⑤ → 0 ~ 4', () => {
    expect(multipleChoiceAnswerToIndex('①')).toBe(0);
    expect(multipleChoiceAnswerToIndex('②')).toBe(1);
    expect(multipleChoiceAnswerToIndex('③')).toBe(2);
    expect(multipleChoiceAnswerToIndex('④')).toBe(3);
    expect(multipleChoiceAnswerToIndex('⑤')).toBe(4);
  });

  it('숫자 "1" ~ "5" → 0 ~ 4', () => {
    expect(multipleChoiceAnswerToIndex('1')).toBe(0);
    expect(multipleChoiceAnswerToIndex('5')).toBe(4);
  });

  it('"1번" ~ "5번" → 0 ~ 4', () => {
    expect(multipleChoiceAnswerToIndex('1번')).toBe(0);
    expect(multipleChoiceAnswerToIndex('3번')).toBe(2);
    expect(multipleChoiceAnswerToIndex('5번')).toBe(4);
  });

  it('"6" 이상은 null (5지선다 범위 외)', () => {
    expect(multipleChoiceAnswerToIndex('6')).toBeNull();
    expect(multipleChoiceAnswerToIndex('⑥')).toBeNull();
  });

  it('"0" 또는 음수는 null', () => {
    expect(multipleChoiceAnswerToIndex('0')).toBeNull();
    expect(multipleChoiceAnswerToIndex('-1')).toBeNull();
  });

  it('서술형 정답은 null', () => {
    expect(multipleChoiceAnswerToIndex('보험가액의 80%')).toBeNull();
    expect(multipleChoiceAnswerToIndex('착과수조사')).toBeNull();
  });

  it('빈 string + whitespace는 null', () => {
    expect(multipleChoiceAnswerToIndex('')).toBeNull();
    expect(multipleChoiceAnswerToIndex('   ')).toBeNull();
  });

  it('공백 trim 후 처리', () => {
    expect(multipleChoiceAnswerToIndex('  ②  ')).toBe(1);
    expect(multipleChoiceAnswerToIndex(' 3번 ')).toBe(2);
  });
});
