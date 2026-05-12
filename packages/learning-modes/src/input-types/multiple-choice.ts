/**
 * @thepick/learning-modes/input-types/multiple-choice — 객관식 채점.
 *
 * plan §4.1 객관식 + §4.2 보기 랜덤화 정합.
 *   - 클라이언트는 셔플된 라벨 (A~E)만 전송
 *   - 서버는 ShuffledChoice.originalIndex로 역추적 → exam_questions.answer 매칭
 *   - 정답 라벨은 채점 결과로만 노출 (사전 노출 0)
 */

import type { ShuffledChoice } from '../shuffle.js';

export interface MultipleChoiceGradeInput {
  /** 클라이언트가 전송한 선택 라벨 ('A' ~ 'E'). */
  readonly submittedLabel: string;
  /** 셔플된 보기 목록. 서버가 원본 인덱스 역추적 source. */
  readonly shuffledChoices: readonly ShuffledChoice[];
  /** exam_questions.answer 파싱 결과 (0~4). null 시 정답 데이터 부재 (오답 처리). */
  readonly correctOriginalIndex: number | null;
}

export interface MultipleChoiceGradeResult {
  readonly isCorrect: boolean;
  /** submittedLabel이 셔플 라벨에 없으면 null (보호 안전망). */
  readonly submittedOriginalIndex: number | null;
  /** 채점 후 노출 가능. 셔플 라벨 ('A' ~ 'E'). 정답 데이터 없으면 빈 string. */
  readonly correctLabel: string;
}

export function gradeMultipleChoice(input: MultipleChoiceGradeInput): MultipleChoiceGradeResult {
  const submitted = input.shuffledChoices.find((c) => c.label === input.submittedLabel);
  const submittedOriginalIndex = submitted?.originalIndex ?? null;

  if (input.correctOriginalIndex === null) {
    return { isCorrect: false, submittedOriginalIndex, correctLabel: '' };
  }

  const correctChoice = input.shuffledChoices.find(
    (c) => c.originalIndex === input.correctOriginalIndex,
  );
  const correctLabel = correctChoice?.label ?? '';

  return {
    isCorrect: submittedOriginalIndex === input.correctOriginalIndex,
    submittedOriginalIndex,
    correctLabel,
  };
}

/**
 * exam_questions.answer 컬럼 값을 0~4 originalIndex로 파싱.
 *
 * 허용 패턴:
 *   - 원형숫자 ① ~ ⑤  → 0 ~ 4
 *   - 숫자 "1" ~ "5"   → 0 ~ 4
 *   - "1번" ~ "5번"    → 0 ~ 4
 *   - 그 외 (서술/계산식 정답)  → null
 */
export function multipleChoiceAnswerToIndex(answer: string): number | null {
  const trimmed = answer.trim();
  if (trimmed === '') return null;

  const circledMap: Record<string, number> = {
    '①': 0,
    '②': 1,
    '③': 2,
    '④': 3,
    '⑤': 4,
  };
  if (trimmed in circledMap) return circledMap[trimmed] ?? null;

  const numMatch = /^([1-5])번?$/.exec(trimmed);
  if (numMatch !== null) {
    return Number.parseInt(numMatch[1]!, 10) - 1;
  }

  return null;
}
