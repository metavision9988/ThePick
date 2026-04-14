/**
 * M16 Variable Mapper — 입력값을 산식 변수에 매핑하고 검증한다.
 *
 * 1. 필수 변수 누락 검사
 * 2. 타입 검증 (integer 변수에 소수 입력 등)
 * 3. 범위 제약 검증 (constraints)
 * 4. 검증 통과 시 FormulaScope 반환
 */

import type { FormulaDefinition, FormulaScope, FormulaError, FormulaConstraint } from './types';

export interface MapSuccess {
  readonly ok: true;
  readonly scope: FormulaScope;
  readonly warnings: string[];
}

export interface MapFailure {
  readonly ok: false;
  readonly errors: FormulaError[];
}

export type MapResult = MapSuccess | MapFailure;

function makeError(formulaId: string, code: FormulaError['code'], message: string): FormulaError {
  return { ok: false, formulaId, code, message };
}

/**
 * 입력값을 산식 변수 스키마에 맞춰 검증하고 매핑한다.
 * 모든 에러를 누적하여 한 번에 보고한다.
 */
export function mapVariables(
  definition: FormulaDefinition,
  rawInputs: Record<string, unknown>,
): MapResult {
  const errors: FormulaError[] = [];
  const warnings: string[] = [];
  const scope: FormulaScope = {};
  const { id } = definition;

  // 1. 변수 스키마 기반 검증
  for (const schema of definition.variablesSchema) {
    const raw = rawInputs[schema.name];

    if (raw === undefined || raw === null) {
      if (schema.required) {
        errors.push(
          makeError(
            id,
            'VARIABLE_MISSING',
            `Missing required variable: ${schema.name} (${schema.displayName})`,
          ),
        );
      }
      continue;
    }

    const num = Number(raw);
    if (!Number.isFinite(num)) {
      errors.push(
        makeError(
          id,
          'VARIABLE_TYPE_MISMATCH',
          `Variable ${schema.name} is not a valid number: ${raw}`,
        ),
      );
      continue;
    }

    // integer 타입 검증
    if (schema.type === 'integer' && !Number.isInteger(num)) {
      errors.push(
        makeError(
          id,
          'VARIABLE_TYPE_MISMATCH',
          `Variable ${schema.name} must be an integer: ${num}`,
        ),
      );
      continue;
    }

    // ratio 범위 검증 (0~1)
    if (schema.type === 'ratio' && (num < 0 || num > 1)) {
      warnings.push(`Variable ${schema.name} (ratio) is outside [0, 1]: ${num}`);
    }

    // percentage 범위 검증 (0~100)
    if (schema.type === 'percentage' && (num < 0 || num > 100)) {
      warnings.push(`Variable ${schema.name} (percentage) is outside [0, 100]: ${num}`);
    }

    // 스키마 min/max 검증
    if (schema.min !== undefined && num < schema.min) {
      errors.push(
        makeError(
          id,
          'CONSTRAINT_VIOLATION',
          `Variable ${schema.name} below minimum ${schema.min}: ${num}`,
        ),
      );
      continue;
    }
    if (schema.max !== undefined && num > schema.max) {
      errors.push(
        makeError(
          id,
          'CONSTRAINT_VIOLATION',
          `Variable ${schema.name} above maximum ${schema.max}: ${num}`,
        ),
      );
      continue;
    }

    scope[schema.name] = num;
  }

  // 1b. 미인식 변수 경고
  const schemaNames = new Set(definition.variablesSchema.map((s) => s.name));
  for (const key of Object.keys(rawInputs)) {
    if (!schemaNames.has(key)) {
      warnings.push(`Unrecognized variable: ${key}`);
    }
  }

  // 2. 추가 constraints 검증
  if (errors.length === 0) {
    for (const constraint of definition.constraints) {
      const val = scope[constraint.variable];
      if (val === undefined) continue;

      if (!checkConstraint(constraint, val)) {
        errors.push(makeError(id, 'CONSTRAINT_VIOLATION', constraint.message));
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, scope, warnings };
}

function checkConstraint(constraint: FormulaConstraint, value: number): boolean {
  switch (constraint.rule) {
    case 'non_negative':
      return value >= 0;
    case 'positive':
      return value > 0;
    case 'integer':
      return Number.isInteger(value);
    case 'range':
      return (
        (constraint.min === undefined || value >= constraint.min) &&
        (constraint.max === undefined || value <= constraint.max)
      );
    default: {
      const _exhaustive: never = constraint.rule;
      throw new Error(`Unknown constraint rule: ${_exhaustive}`);
    }
  }
}
