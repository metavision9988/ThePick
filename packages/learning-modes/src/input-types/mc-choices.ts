/**
 * @thepick/learning-modes/input-types/mc-choices — 객관식 보기 배열 + answer 계약
 * 파싱 **단일 정본** (결재 #2 위치 라벨형, mc-answer.ts 정본 위에 구축).
 *
 * `exam_questions.distractors`(보기 전체 배열 JSON, 원본 순서) + `exam_questions.answer`
 * (1-based 위치 라벨) 를 **검증된 originalTexts + 0-based 정답 위치 집합**으로 환원한다.
 *
 * 이 파싱·검증 로직은 과거 apps/api `buildShuffledChoices` 내부에만 있었고, 무인증
 * 공개 표면(`/api/public/*`) 이 이를 복제하면 answer 해석이 2벌로 갈려 무음 오채점
 * (감사 critical `mc-grading-answer-index-contradiction` 재발) 위험 → 순수 함수로
 * 격리해 **인증 경로(buildShuffledChoices)·공개 경로(public serve/grade) 공유**한다.
 *
 * 순수 함수 (logger 없음) — 거부 사유를 타입으로 반환, 로깅은 호출 측 책임.
 */

import { normalizeAnswer } from '../normalize.js';
import { answerLabelsFitChoices, parseMcAnswerLabels } from './mc-answer.js';

/** 보기 파싱·검증 거부 사유 (buildShuffledChoices 경고 메시지와 1:1). */
export type McChoiceRejectReason =
  | 'no_distractors' // distractors NULL/빈 문자열
  | 'no_answer' // answer NULL/빈 문자열
  | 'distractors_not_array' // JSON 이 배열 아님
  | 'distractors_parse_failed' // JSON.parse throw
  | 'distractors_invalid_element' // 비문자/빈/공백-only 원소 (무음 filter 금지 → 서빙 거부)
  | 'answer_contract_violation' // answer 위치 파싱 실패 또는 보기 수와 불일치
  | 'duplicate_choice_text'; // normalize 동치 보기 2개 (불공정 오채점 방지)

export interface McChoicesParsed {
  readonly ok: true;
  /** 원본 순서(①②③④) 보기 텍스트 — 위치 전단사 보존 (무음 filter 0). */
  readonly originalTexts: readonly string[];
  /** 0-based 정답 위치 집합 (복수정답 = 복수 원소). */
  readonly correctOriginalIndices: ReadonlySet<number>;
}

export interface McChoicesRejected {
  readonly ok: false;
  readonly reason: McChoiceRejectReason;
  /**
   * `duplicate_choice_text` 일 때만 채워짐: 충돌 index 쌍 "prev=i" (콤마 구분).
   * ★ 정답 위치 자체는 비노출 — index 쌍만 (정답 누출 차단, buildShuffledChoices 계승).
   */
  readonly collisionIndexPairs?: string;
}

export type McChoicesResult = McChoicesParsed | McChoicesRejected;

/**
 * distractors JSON + answer → 검증된 보기 배열 + 정답 위치 집합.
 *
 * 검증 순서·기준은 구 `buildShuffledChoices`(apps/api/src/study/routes.ts:440-497) 를
 * 그대로 계승 — 무음 원소 filter 금지(위치 오염 차단), answer 위치 정합, 동치 보기 거부.
 */
export function parseMcChoices(
  distractors: string | null | undefined,
  answer: string | null | undefined,
): McChoicesResult {
  if (distractors === null || distractors === undefined || distractors === '') {
    return { ok: false, reason: 'no_distractors' };
  }
  if (answer === null || answer === undefined || answer === '') {
    return { ok: false, reason: 'no_answer' };
  }

  let choices: string[];
  try {
    const parsed: unknown = JSON.parse(distractors);
    if (!Array.isArray(parsed)) {
      return { ok: false, reason: 'distractors_not_array' };
    }
    // ★ 무음 filter 금지: 위치 라벨형 계약에서 원소를 떨구면 이후 보기 위치가 당겨져
    //   answer↔보기 매핑이 조용히 오염(오답이 정답 처리)된다. 비문자/빈/공백-only =
    //   적재 결함 → 전수 검증 실패 시 서빙 거부.
    if (!parsed.every((v): v is string => typeof v === 'string' && v.trim().length > 0)) {
      return { ok: false, reason: 'distractors_invalid_element' };
    }
    choices = parsed;
  } catch {
    return { ok: false, reason: 'distractors_parse_failed' };
  }

  // 위치 라벨형 계약 검증 — answer 가 위치 집합으로 파싱되고 보기 수와 정합해야 통과.
  const answerLabels = parseMcAnswerLabels(answer);
  if (answerLabels === null || !answerLabelsFitChoices(answerLabels, choices.length)) {
    return { ok: false, reason: 'answer_contract_violation' };
  }

  // 보기 간 동치/중복 가드 (동치 기준 normalizeAnswer) — 같은 텍스트 보기 2개는
  // 한쪽을 고른 사용자가 위치 불일치로 오답 처리되는 불공정 → 거부.
  const normalizedTexts = choices.map((t) => normalizeAnswer(t));
  const firstSeenIndex = new Map<string, number>();
  const collisionPairs: string[] = [];
  normalizedTexts.forEach((norm, i) => {
    const prev = firstSeenIndex.get(norm);
    if (prev === undefined) {
      firstSeenIndex.set(norm, i);
      return;
    }
    collisionPairs.push(`${prev}=${i}`);
  });
  if (collisionPairs.length > 0) {
    return {
      ok: false,
      reason: 'duplicate_choice_text',
      collisionIndexPairs: collisionPairs.join(','),
    };
  }

  return { ok: true, originalTexts: choices, correctOriginalIndices: answerLabels };
}
