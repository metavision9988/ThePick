/**
 * M16 Formula Engine — 자원 한도 위반 에러.
 *
 * Sprint 1 §5.3 CHA-02 (Worker CPU 50ms 초과 시뮬레이션) 신규.
 *
 * 본 에러는 보안 위반(UnsafeExpressionError)과 의미가 다르다 — 자원/복잡도 한도
 * 초과로 인한 종료. engine.calculate() 가 catch 후 FormulaError code='COMPUTE_TIMEOUT'
 * 으로 매핑한다.
 *
 * 근거:
 *   - Master Plan v1.0 §CHA-02 (CalculationTimeoutError + COMPUTE_TIMEOUT 코드)
 *   - Cloudflare Workers 무료 50ms / 유료 30s CPU 한도 (본 한도는 Workers 50ms 정합)
 */

export type CalculationTimeoutKind = 'ast_too_complex' | 'ast_too_deep' | 'eval_timeout';

export class CalculationTimeoutError extends Error {
  readonly kind: CalculationTimeoutKind;
  readonly details: Readonly<Record<string, number>>;

  constructor(kind: CalculationTimeoutKind, message: string, details: Record<string, number>) {
    super(message);
    this.name = 'CalculationTimeoutError';
    this.kind = kind;
    this.details = Object.freeze({ ...details });
  }
}
