/**
 * M16 Formula Engine — 타입 정의
 *
 * 산식 연산에 필요한 모든 인터페이스를 정의한다.
 * DB formulas 테이블 스키마와 대응.
 */

/** 변수의 데이터 타입 */
export type VariableType = 'number' | 'integer' | 'ratio' | 'percentage';

/** 단일 변수의 스키마 정의 */
export interface VariableSchema {
  readonly name: string;
  readonly displayName: string;
  readonly type: VariableType;
  readonly min?: number;
  readonly max?: number;
  readonly required: boolean;
}

/** 산식의 입력 제약조건 */
export interface FormulaConstraint {
  readonly variable: string;
  readonly rule: 'non_negative' | 'positive' | 'range' | 'integer';
  readonly min?: number;
  readonly max?: number;
  readonly message: string;
}

/** 산식 정의 (DB formulas 테이블과 대응) */
export interface FormulaDefinition {
  readonly id: string;
  readonly name: string;
  readonly equationTemplate: string;
  readonly equationDisplay: string;
  readonly variablesSchema: readonly VariableSchema[];
  readonly constraints: readonly FormulaConstraint[];
  readonly pageRef?: string;
  readonly nodeId?: string;
  readonly versionYear: number;
  readonly supersededBy?: string;
  readonly gracefulDegradation?: string;
  readonly resultPrecision: number;
}

/** 계산 입력값 (변수명 → 숫자 매핑) */
export type FormulaScope = Record<string, number>;

/** 상수 제공 인터페이스 (DI) */
export interface ConstantsProvider {
  resolve(name: string): number | null;
}

/** 산식 계산 결과 */
export interface FormulaResult {
  readonly ok: true;
  readonly formulaId: string;
  readonly formulaName: string;
  readonly value: number;
  readonly inputs: Readonly<FormulaScope>;
  readonly warnings: readonly string[];
}

/** 산식 에러 코드 */
export type FormulaErrorCode =
  | 'FORMULA_NOT_FOUND'
  | 'PARSE_FAILED'
  | 'VARIABLE_MISSING'
  | 'VARIABLE_TYPE_MISMATCH'
  | 'CONSTRAINT_VIOLATION'
  | 'EVALUATION_FAILED'
  | 'UNSAFE_EXPRESSION'
  | 'DIVISION_BY_ZERO';

/** 산식 계산 에러 */
export interface FormulaError {
  readonly ok: false;
  readonly formulaId: string;
  readonly code: FormulaErrorCode;
  readonly message: string;
  readonly details?: readonly string[];
}

/** 계산 결과 유니언 */
export type CalculateResult = FormulaResult | FormulaError;
