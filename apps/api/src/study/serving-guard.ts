/**
 * serving-guard — 인증 학습 표면 서빙·채점 자격 가드 (5-페르소나 P4 리뷰 C-1 이식).
 *
 * 공개 표면 isServable(public/routes.ts)의 인증판 비대칭 해소: 선언된 input_type 대로
 * **정확히 채점 불가능한** 행을 서빙·채점 전에 차단한다. 표적 = MC-in-disguise 행
 * (위치라벨 answer + 보기 계약 불능 — 현 1차 old 525행, 확정 오답 36 포함):
 *   - input_type='fill_blank' 인데 answer 가 위치라벨("2","①","2,3") → gradeFillBlank 가
 *     위치라벨 문자열을 정답 기준으로 삼는 구조적 오채점(정답 100% Hard Stop 위반).
 *   - input_type='multiple_choice' 인데 parseMcChoices 계약 불능 → 기존 fill_blank
 *     fallback(routes.ts gradeAnswerByType)이 동일 오채점 경로로 강하.
 *
 * essay/calc 는 인증 표면 정규 지원(자기채점·Formula 경로)이므로 가드 비대상 —
 * calc 정답 "3" 같은 숫자 정답이 위치라벨로 오인 차단되지 않도록 input_type 한정.
 *
 * old 행 처분 정본(상태머신 마이그)은 별도 L3 plan(진산 결재) — 본 가드는 그 전까지의
 * 서빙 fail-safe. 근거: incident-1st-answer-errors-20260710.md + phaseN-tech-debt-
 * 20260710-105821-INDEX.md C-1.
 */

import { parseMcAnswerLabels, parseMcChoices, resolveInputType } from '@thepick/learning-modes';

/**
 * 가드 적용 시험 종목 — 1차 한정.
 *
 * 1차 시험은 전 문항 객관식(4지선다)이므로 "fill_blank + 위치라벨 answer" = 확정
 * MC-in-disguise(보기 미추출 원행). 반면 2차는 서술·계산형이라 진성 텍스트/수치 정답이
 * 우연히 '1'~'5' 형태일 수 있어(예: 계산 답 "3") 동일 휴리스틱이 정당한 행을 오차단한다
 * — 실측: 무분별 적용 시 기존 2차 계약 테스트 37건 파손. 데이터 상태(BE-1 이전 원행)에
 * 결부된 가드이므로 종목 한정이 정확하다.
 */
const GUARDED_EXAM_TYPES: ReadonlySet<string> = new Set(['1st']);

export interface ServingGuardRow {
  readonly exam_type: string | null;
  readonly input_type: string | null;
  readonly answer: string | null;
  readonly distractors: string | null;
}

/** 선언된 input_type 대로 정확히 채점 불가능한 행인가 (true = 서빙·채점 거부 대상). */
export function isMisgradableRow(row: ServingGuardRow): boolean {
  if (row.exam_type === null || !GUARDED_EXAM_TYPES.has(row.exam_type)) return false;
  const inputType = resolveInputType(row.input_type);
  if (inputType !== 'fill_blank' && inputType !== 'multiple_choice') return false;
  if (row.answer === null || row.answer === '') return false; // answer 부재는 별도 422 경로
  if (parseMcAnswerLabels(row.answer) === null) return false; // 진성 텍스트 정답 = 채점 가능
  // 위치라벨 정답 — 보기 계약이 성립해야만 정확 채점 가능(MC 위치 역추적).
  return !parseMcChoices(row.distractors, row.answer).ok;
}
