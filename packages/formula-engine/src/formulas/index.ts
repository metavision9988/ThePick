/**
 * 산식 레지스트리 — ID로 산식 정의를 조회한다.
 * 등록 시 equation_template의 변수와 variablesSchema를 교차 검증한다.
 */

import type { FormulaDefinition } from '../types';
import { safeParse } from '../sandbox';
import { BATCH1_FORMULAS } from './batch1-definitions';
import { BATCH2_FORMULAS } from './batch2-definitions';
import { BATCH3_FORMULAS } from './batch3-definitions';
import { BATCH4_FORMULAS } from './batch4-definitions';
import { BATCH5_FORMULAS } from './batch5-definitions';

const ALL_FORMULAS: readonly FormulaDefinition[] = [
  ...BATCH1_FORMULAS,
  ...BATCH2_FORMULAS,
  ...BATCH3_FORMULAS,
  ...BATCH4_FORMULAS,
  ...BATCH5_FORMULAS,
];

const registry = new Map<string, FormulaDefinition>();

for (const formula of ALL_FORMULAS) {
  // 등록 시 template ↔ schema 변수 교차 검증
  const parsed = safeParse(formula.equationTemplate);
  if (!parsed.ok) {
    throw new Error(
      `Formula ${formula.id} (${formula.name}): equation_template parse failed: ${parsed.message}`,
    );
  }

  const schemaNames = new Set(formula.variablesSchema.map((s) => s.name));
  const templateVars = new Set(parsed.variables);

  // 정방향: template 변수 → schema에 존재해야 함
  for (const v of templateVars) {
    if (!schemaNames.has(v)) {
      throw new Error(
        `Formula ${formula.id} (${formula.name}): variable '${v}' in equation_template not found in variablesSchema`,
      );
    }
  }

  // 역방향: required schema 변수 → template에서 사용되어야 함
  for (const s of formula.variablesSchema) {
    if (s.required && !templateVars.has(s.name)) {
      throw new Error(
        `Formula ${formula.id} (${formula.name}): required variable '${s.name}' in variablesSchema not used in equation_template`,
      );
    }
  }

  if (registry.has(formula.id)) {
    throw new Error(
      `Formula ${formula.id} (${formula.name}): duplicate ID — already registered as '${registry.get(formula.id)!.name}'`,
    );
  }

  registry.set(formula.id, formula);
}

export function getFormula(id: string): FormulaDefinition | undefined {
  return registry.get(id);
}

export function getAllFormulas(): readonly FormulaDefinition[] {
  return [...registry.values()];
}

export { BATCH1_FORMULAS, BATCH2_FORMULAS, BATCH3_FORMULAS, BATCH4_FORMULAS, BATCH5_FORMULAS };
