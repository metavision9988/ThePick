/**
 * @thepick/formula-engine
 *
 * 손해평가 산식을 math.js AST 기반으로 안전하게 계산하는 엔진.
 * 동적 코드 실행 절대 금지 (DEFCON L3).
 */

// 타입
export type {
  FormulaDefinition,
  FormulaScope,
  FormulaResult,
  FormulaError,
  FormulaErrorCode,
  CalculateResult,
  VariableSchema,
  VariableType,
  FormulaConstraint,
  ConstantsProvider,
} from './types';

// 엔진
export { calculate } from './engine';

// Sprint 1 §5.3 CHA-02 — 자원 한도 위반 에러 (COMPUTE_TIMEOUT 진단용)
export { CalculationTimeoutError, type CalculationTimeoutKind } from './errors';

// 산식 레지스트리
export { getFormula, getAllFormulas, BATCH1_FORMULAS } from './formulas';

// 상수 제공자 (PoC용)
export { InMemoryConstantsProvider } from './constants-resolver';

// G-FE-3 C축 — 각도 규약 저작 lint (formula-engine-expansion.plan.md §7 Q3 A+C)
export { lintAngleConvention } from './angle-lint';
