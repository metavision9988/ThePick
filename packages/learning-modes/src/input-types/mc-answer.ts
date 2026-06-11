/**
 * @thepick/learning-modes/input-types/mc-answer — 객관식 answer 계약 **단일 정본**.
 *
 * 결재 #2 (진산 2026-06-11, decision-card-2-mc-answer-contract.md) = (a) 위치 라벨형:
 *   - `exam_questions.answer` = **1-based 위치 라벨 문자열** ("1"~"5")
 *   - 복수정답 = 콤마 구분 ("2,3" / "1,2,3,4" — 시험 공식 복수정답 인정 문항,
 *     production 실측 6건). 채점 = 제출 보기의 원본 위치 ∈ 정답 집합이면 정답.
 *   - `exam_questions.distractors` = **보기 전체 배열(원본 순서)** JSON — 정답 텍스트를
 *     배열 머리에 끼워넣지 않는다 (구 buildShuffledChoices 의 "answer=정답텍스트 index0"
 *     가정 = 감사 critical mc-grading-answer-index-contradiction 의 진앙, 본 모듈로 폐기).
 *
 * 근거 데이터 (2026-06-11 production 라이브 실측): 1차 525건 answer = plain 숫자
 * 519 + 복수정답 6, 원형숫자·"N번" 0건. 마이그레이션 0건으로 현행 데이터와 정합.
 *
 * 본 모듈이 3경로(보기 구성 buildShuffledChoices / 채점 gradeMultipleChoice /
 * 셔플 shuffle 계약 "originalIndex 0 = 원본 1번 보기")의 공유 정본이다 —
 * answer 해석을 다른 곳에서 재구현하지 말 것.
 */

import { CHOICE_LABELS } from '../shuffle.js';

/**
 * 객관식 보기 수 상한 (1차 = 4지선다 실측, 5지선다 여지).
 * shuffle CHOICE_LABELS 에서 파생 — 리터럴 중복 드리프트 차단 (리뷰 P34-M1:
 * G-WS1 ① "3경로 동일 계약" 의 셔플 경로 공유. shuffle 은 mc-answer 미참조 = 순환 없음).
 */
export const MC_MAX_CHOICES = CHOICE_LABELS.length;

/**
 * answer 문자열 → **0-based 원본 위치 인덱스 집합**.
 *
 * 수용 형식 (현행 데이터 + 입력 관용):
 *   - "3"        → {2}
 *   - "2,3"      → {1, 2}        (복수정답 — 공백 허용 "2, 3")
 *   - "3번"      → {2}           (관용 — 기존 파서 호환)
 *   - "③"        → {2}           (관용 — 원형숫자, production 0건이나 방어 수용)
 *
 * 거부 (null 반환 — 호출 측이 fallback/경고 처리):
 *   - 빈 문자열 / null·undefined 류 비문자
 *   - 범위 밖 ("0", "6"+) / 비숫자 토큰 ("정답은 3") / 중복 토큰 ("3,3")
 *
 * null = "위치 라벨형 answer 가 아님" — 서술/계산형 정답(2차)은 본 계약 비대상.
 */
export function parseMcAnswerLabels(answer: string): ReadonlySet<number> | null {
  const trimmed = answer.trim();
  if (trimmed === '') return null;

  const CIRCLED = '①②③④⑤';
  const indices = new Set<number>();

  for (const rawToken of trimmed.split(',')) {
    const token = rawToken.trim();
    if (token === '') return null; // "3," / ",3" 류 비정형 거부

    let n: number;
    const circledPos = CIRCLED.indexOf(token);
    if (token.length === 1 && circledPos !== -1) {
      n = circledPos + 1;
    } else {
      const m = /^([1-9])번?$/.exec(token);
      if (m === null) return null;
      n = Number.parseInt(m[1]!, 10);
    }

    if (n < 1 || n > MC_MAX_CHOICES) return null;
    const idx = n - 1;
    if (indices.has(idx)) return null; // 중복 토큰 = 데이터 오류 신호 — 무음 dedupe 금지
    indices.add(idx);
  }

  return indices;
}

/**
 * 정답 위치 집합이 보기 배열 길이와 정합하는지 검증.
 * (answer "4" 인데 보기 3개 등 = 적재 데이터 결함 — 서빙 거부 근거.)
 */
export function answerLabelsFitChoices(labels: ReadonlySet<number>, choiceCount: number): boolean {
  if (choiceCount < 2 || choiceCount > MC_MAX_CHOICES) return false;
  for (const idx of labels) {
    if (idx >= choiceCount) return false;
  }
  return true;
}
