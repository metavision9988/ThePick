/**
 * @thepick/learning-modes/input-types/essay — 서술식 self-grade.
 *
 * plan §4.1 서술식 정합:
 *   - 자동 채점 불가 (LLM 채점은 Phase 3 후반 carry-over)
 *   - self-grade: 사용자가 정답 확인 후 '맞음/부분/틀림' 라디오 입력
 *   - FSRS rating 매핑: correct → good, partial → hard, incorrect → again
 */

export type EssaySelfRating = 'correct' | 'partial' | 'incorrect';

export interface EssayGradeInput {
  readonly userAnswer: string;
  readonly selfRating: EssaySelfRating;
}

export interface EssayGradeResult {
  readonly isCorrect: boolean;
  readonly partial: boolean;
}

export function gradeEssay(input: EssayGradeInput): EssayGradeResult {
  return {
    isCorrect: input.selfRating === 'correct',
    partial: input.selfRating === 'partial',
  };
}
