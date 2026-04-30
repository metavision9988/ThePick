/**
 * Step 13 (Engine Hardening Roadmap v1.3) — formula-engine 결정성 Property Test (AC-FE-2).
 *
 * 동일 (formulaId, scope) → 100회 반복 시 100% 동일 CalculateResult.
 * v3.0 Vol XV.3 의무 5요소 #1 — Property Test.
 * contract.yaml AC-FE-2 (`docs/engines/formula-engine/contract.yaml`).
 *
 * 결정성은 success(ok=true) / failure(ok=false) 양쪽 모두 검증한다 —
 * fast-check 가 분모 = 0 같은 edge 를 자동 발견할 때도 동일 에러 코드로 수렴해야 한다.
 */

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { calculate } from '../engine';
import { getAllFormulas } from '../formulas';
import type {
  FormulaConstraint,
  FormulaDefinition,
  FormulaScope,
  VariableSchema,
  VariableType,
} from '../types';

const ITERATIONS = 100;

const TYPE_DEFAULT_RANGE: Record<VariableType, { min: number; max: number }> = {
  integer: { min: 0, max: 1_000 },
  number: { min: 0, max: 1_000_000 },
  ratio: { min: 0, max: 1 },
  percentage: { min: 0, max: 100 },
};

function rangeFor(
  schema: VariableSchema,
  constraints: readonly FormulaConstraint[],
): { min: number; max: number } {
  const fallback = TYPE_DEFAULT_RANGE[schema.type];
  let min = schema.min ?? fallback.min;
  let max = schema.max ?? fallback.max;
  for (const c of constraints) {
    if (c.variable !== schema.name) continue;
    if (c.rule === 'positive') min = Math.max(min, 1);
    if (c.rule === 'non_negative') min = Math.max(min, 0);
    if (c.rule === 'range') {
      if (typeof c.min === 'number') min = Math.max(min, c.min);
      if (typeof c.max === 'number') max = Math.min(max, c.max);
    }
  }
  if (max < min) max = min;
  return { min, max };
}

function arbitraryFor(
  schema: VariableSchema,
  constraints: readonly FormulaConstraint[],
): fc.Arbitrary<number> {
  const { min, max } = rangeFor(schema, constraints);
  if (schema.type === 'integer') {
    return fc.integer({ min: Math.ceil(min), max: Math.floor(max) });
  }
  return fc.double({
    min,
    max,
    noNaN: true,
    noDefaultInfinity: true,
    minExcluded: false,
    maxExcluded: false,
  });
}

function arbitraryScopeFor(formula: FormulaDefinition): fc.Arbitrary<FormulaScope> {
  const entries = formula.variablesSchema.map(
    (schema) =>
      [schema.name, arbitraryFor(schema, formula.constraints)] as [string, fc.Arbitrary<number>],
  );
  return fc.record(Object.fromEntries(entries) as Record<string, fc.Arbitrary<number>>);
}

describe('formula-engine determinism property (AC-FE-2)', () => {
  const formulas = getAllFormulas();

  it('레지스트리는 68개 산식을 노출한다 (Roadmap §3.2 invariant)', () => {
    expect(formulas.length).toBe(68);
  });

  for (const formula of formulas) {
    it(`${formula.id} (${formula.name}) — 동일 입력 → 동일 결과 (${ITERATIONS}회)`, () => {
      fc.assert(
        fc.property(arbitraryScopeFor(formula), (scope) => {
          const first = calculate(formula.id, scope);
          const second = calculate(formula.id, scope);
          // CalculateResult 전체 구조 동일 — value, code, message, inputs 모두.
          expect(second).toEqual(first);
        }),
        { numRuns: ITERATIONS, endOnFailure: true },
      );
    });
  }
});
