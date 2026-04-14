/**
 * M16 Formula Engine — 산식 계산의 단일 진입점
 *
 * 계산 파이프라인:
 *   1. 산식 ID → 정의 조회
 *   2. 입력값 → 변수 매핑/검증
 *   3. equation_template → AST 파싱 (캐시)
 *   4. AST + scope → 평가
 *   5. 후처리 (반올림)
 *   6. FormulaResult 반환
 *
 * 모든 계산은 math.js AST evaluate만 사용. 동적 코드 실행 절대 금지.
 */

import type { CalculateResult, FormulaError, FormulaResult } from './types';
import { getFormula } from './formulas';
import { parseFormula } from './ast-parser';
import { mapVariables } from './variable-mapper';
import { safeEvaluate } from './sandbox';

function roundTo(value: number, decimals: number): number {
  if (decimals <= 0) {
    return Math.round(value);
  }
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function fail(
  formulaId: string,
  code: FormulaError['code'],
  message: string,
  details?: readonly string[],
): FormulaError {
  return { ok: false, formulaId, code, message, details };
}

/**
 * 산식을 계산한다.
 *
 * @param formulaId - 산식 ID (F-01 ~ F-68)
 * @param inputs - 변수명 → 값 매핑
 * @returns FormulaResult (성공) 또는 FormulaError (실패)
 */
export function calculate(formulaId: string, inputs: Record<string, unknown>): CalculateResult {
  // 1. 산식 정의 조회
  const definition = getFormula(formulaId);
  if (!definition) {
    return fail(formulaId, 'FORMULA_NOT_FOUND', `Formula not found: ${formulaId}`);
  }

  // 2. 변수 매핑/검증
  const mapped = mapVariables(definition, inputs);
  if (!mapped.ok) {
    const first = mapped.errors[0];
    const details = mapped.errors.length > 1 ? mapped.errors.map((e) => e.message) : undefined;
    return fail(formulaId, first.code, first.message, details);
  }

  // 3. AST 파싱
  const parsed = parseFormula(definition.equationTemplate);
  if (!parsed.ok) {
    return fail(formulaId, 'PARSE_FAILED', parsed.message);
  }

  // 4. 평가
  let rawValue: number;
  try {
    rawValue = safeEvaluate(parsed.compiled, mapped.scope);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const ctx = definition.pageRef ? ` (${definition.pageRef})` : '';
    if (raw.includes('Division by zero')) {
      return fail(
        formulaId,
        'DIVISION_BY_ZERO',
        `${definition.name} 계산 실패: 0으로 나눌 수 없습니다${ctx}`,
      );
    }
    return fail(formulaId, 'EVALUATION_FAILED', `${definition.name} 계산 실패: ${raw}${ctx}`);
  }

  // 5. 후처리 (반올림)
  const value = roundTo(rawValue, definition.resultPrecision);

  // 6. 결과 구성
  const warnings = [...mapped.warnings];

  // 음수 결과 경고 (보험금/비율 산식에서 음수는 의미 없음)
  if (value < 0) {
    warnings.push(`Calculation result is negative (${value}), which may indicate invalid inputs`);
  }

  const result: FormulaResult = {
    ok: true,
    formulaId: definition.id,
    formulaName: definition.name,
    value,
    inputs: { ...mapped.scope },
    warnings,
  };

  return result;
}
