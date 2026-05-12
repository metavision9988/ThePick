/**
 * @thepick/learning-modes/input-types/fill-blank — 단답 빈칸 채점.
 *
 * plan §4.1 단답형 정합. normalize 후 string 매칭.
 */

import { normalizeAnswer } from '../normalize.js';

export interface FillBlankGradeInput {
  /** exam_questions.answer (정답). */
  readonly expected: string;
  /** 사용자 입력. */
  readonly userAnswer: string;
}

export interface FillBlankGradeResult {
  readonly isCorrect: boolean;
  /** normalize 후 expected (debug + audit). */
  readonly normalizedExpected: string;
  /** normalize 후 userAnswer (debug + audit). */
  readonly normalizedUser: string;
}

export function gradeFillBlank(input: FillBlankGradeInput): FillBlankGradeResult {
  const normalizedExpected = normalizeAnswer(input.expected);
  const normalizedUser = normalizeAnswer(input.userAnswer);

  if (normalizedExpected === '' || normalizedUser === '') {
    return { isCorrect: false, normalizedExpected, normalizedUser };
  }

  return {
    isCorrect: normalizedExpected === normalizedUser,
    normalizedExpected,
    normalizedUser,
  };
}
