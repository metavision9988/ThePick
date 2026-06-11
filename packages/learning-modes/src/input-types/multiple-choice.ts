/**
 * @thepick/learning-modes/input-types/multiple-choice — 객관식 채점.
 *
 * plan §4.1 객관식 + §4.2 보기 랜덤화 정합.
 *   - 클라이언트는 셔플된 라벨 (A~E)만 전송
 *   - 서버는 ShuffledChoice.originalIndex로 역추적 → answer 위치 집합 매칭
 *   - 정답 라벨은 채점 결과로만 노출 (사전 노출 0)
 *
 * ★ answer 해석 정본 = mc-answer.ts (결재 #2 위치 라벨형, 2026-06-11) —
 *   복수정답(콤마)은 "제출 보기의 원본 위치 ∈ 정답 집합이면 정답" (공식
 *   복수정답 인정 규정 정합, production 실측 6문항).
 */

import type { ShuffledChoice } from '../shuffle.js';
import { parseMcAnswerLabels } from './mc-answer.js';

export interface MultipleChoiceGradeInput {
  /** 클라이언트가 전송한 선택 라벨 ('A' ~ 'E'). */
  readonly submittedLabel: string;
  /** 셔플된 보기 목록. 서버가 원본 인덱스 역추적 source. */
  readonly shuffledChoices: readonly ShuffledChoice[];
  /**
   * 정답 원본 위치 집합 (0-based) — `parseMcAnswerLabels(answer)` 산출.
   * null = 정답 데이터 부재/비위치형 (오답 처리 + correctLabels 빈 배열).
   */
  readonly correctOriginalIndices: ReadonlySet<number> | null;
}

export interface MultipleChoiceGradeResult {
  readonly isCorrect: boolean;
  /** submittedLabel이 셔플 라벨에 없으면 null (보호 안전망). */
  readonly submittedOriginalIndex: number | null;
  /**
   * 채점 후 노출 가능한 정답 라벨들 (셔플 라벨 'A'~'E', 복수정답 = 복수 원소,
   * 셔플 순서대로 정렬). 정답 데이터 없으면 빈 배열.
   */
  readonly correctLabels: readonly string[];
}

export function gradeMultipleChoice(input: MultipleChoiceGradeInput): MultipleChoiceGradeResult {
  const submitted = input.shuffledChoices.find((c) => c.label === input.submittedLabel);
  const submittedOriginalIndex = submitted?.originalIndex ?? null;

  if (input.correctOriginalIndices === null || input.correctOriginalIndices.size === 0) {
    return { isCorrect: false, submittedOriginalIndex, correctLabels: [] };
  }

  const correctLabels = input.shuffledChoices
    .filter((c) => input.correctOriginalIndices!.has(c.originalIndex))
    .map((c) => c.label);

  return {
    isCorrect:
      submittedOriginalIndex !== null && input.correctOriginalIndices.has(submittedOriginalIndex),
    submittedOriginalIndex,
    correctLabels,
  };
}

/**
 * @deprecated 결재 #2 (2026-06-11) — 신규 코드는 `parseMcAnswerLabels`(mc-answer.ts,
 * 복수정답 지원)를 사용할 것. 본 함수는 단수 호환 래퍼로만 유지 — 복수정답("2,3")은
 * 단수 API 로 표현 불가하므로 **null 반환** (parseMcAnswerLabels 사용 강제. 리뷰 M-1 정정).
 */
export function multipleChoiceAnswerToIndex(answer: string): number | null {
  const labels = parseMcAnswerLabels(answer);
  // 복수정답("2,3")은 단수 API 로 표현 불가 — 명시 null (size 1 만 값 반환)
  if (labels === null || labels.size !== 1) return null;
  return labels.values().next().value ?? null;
}
