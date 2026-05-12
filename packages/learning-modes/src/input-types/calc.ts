/**
 * @thepick/learning-modes/input-types/calc — 계산식 채점 (skeleton).
 *
 * plan §4.1 계산식 정합:
 *   - 사용자 최종값 입력 + tolerance 허용
 *   - 단계별 풀이 입력 + Formula Engine AST 비교는 Step 3-UX-5에서 통합 (Phase 3-UX-3 srs 후속)
 *   - 본 step은 최종값 numeric 비교만 구현 (단순 path)
 *
 * Workers 호환: parseFloat + Number.isFinite + Math.abs (Web 표준)
 */

export interface CalcGradeInput {
  /** 정답 값 (예: "800000", "1.05", "보험가액의 80%"). 숫자 파싱 가능해야 자동 채점. */
  readonly expectedValue: string;
  readonly userValue: string;
  /** 절대 오차 허용 (default 0 — 정확 일치). 소수점 비교 시 사용 (예: 0.01). */
  readonly tolerance?: number;
}

export interface CalcGradeResult {
  readonly isCorrect: boolean;
  /** 정답 파싱 결과. null = 자동 채점 불가 (서술/표 등). */
  readonly expectedNumeric: number | null;
  /** 사용자 입력 파싱 결과. null = 숫자 입력 아님. */
  readonly userNumeric: number | null;
  /** 자동 채점 가능 여부 (expectedNumeric !== null AND userNumeric !== null). */
  readonly autoGraded: boolean;
}

export function gradeCalc(input: CalcGradeInput): CalcGradeResult {
  const expectedNumeric = parseNumeric(input.expectedValue);
  const userNumeric = parseNumeric(input.userValue);
  const autoGraded = expectedNumeric !== null && userNumeric !== null;

  if (!autoGraded) {
    return { isCorrect: false, expectedNumeric, userNumeric, autoGraded };
  }

  const tolerance = input.tolerance ?? 0;
  const diff = Math.abs(expectedNumeric! - userNumeric!);

  return {
    isCorrect: diff <= tolerance,
    expectedNumeric,
    userNumeric,
    autoGraded,
  };
}

/**
 * 숫자 파싱. 콤마(천단위 구분) 제거 + 공백 제거 + parseFloat.
 *
 * 허용:
 *   - "1000000" / "1,000,000" / " 1,000,000 "
 *   - "1.05" / "0.5"
 *   - 음수 "-100" / 소수 ".5"
 *
 * 거부 (null):
 *   - "보험가액의 80%" (단위 포함 텍스트)
 *   - "" / "abc"
 */
function parseNumeric(s: string): number | null {
  const cleaned = s.trim().replace(/,/g, '').replace(/\s+/g, '');
  if (cleaned === '') return null;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  if (!/^-?\d+(\.\d+)?$|^-?\.\d+$/.test(cleaned)) return null;
  return n;
}
