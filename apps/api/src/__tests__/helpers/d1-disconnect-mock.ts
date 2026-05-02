/**
 * CHA-01 — D1 무작위 disconnect 시뮬레이션 wrapper (Sprint 1 §5.3 신규).
 *
 * @internal
 * @testOnly — production 코드에서 import 절대 금지. Workers 번들에 포함될 경우
 *   `SimulatedD1DisconnectError` 가 D1 응답 위장으로 retry 폭주 매개체가 됨.
 *   §5.4 에서 ESLint `no-restricted-imports` 로 차단 예정 (4-Pass C-CODE-2 §5.4 이월).
 *   본 파일을 production 모듈에서 import 시 즉시 PR 차단 의무.
 *
 * 목적: BATCH 실행 중 D1 호출 N% 가 실패할 때 retry / checkpoint 보존 검증.
 * 근거: ADR-028 §4.1 (Workers Vitest Pool 이연 — Proxy wrap 채택), Master Plan v1.0 §CHA-01.
 *
 * 설계 결정:
 *   1. 실 D1 binding fetch 가로채기 (MSW) 대신 D1Database wrapper level Proxy.
 *      apps/batch wire-up 이연으로 BATCH-1 fixture 직접 실행 불가 — 본 시점에는
 *      D1 호출 시퀀스 시뮬레이션 (apps/api 인증/결제 등) 으로 retry 정합 검증.
 *   2. 결정적 PRNG (mulberry32 + seed) — Master Plan §CHA-01 "seed=42 PRNG 기반" 정합.
 *      `Math.random()` 사용 시 테스트 flaky 위험. **암호학적 안전 보장 X** —
 *      카오스 시뮬레이션 PRNG 전용. 토큰/세션/암호 키 생성 절대 금지.
 *   3. 2단 Proxy — D1Database 메서드 + D1PreparedStatement 메서드 별도 wrap.
 *      ADR-028 §4.1 의 단일 Proxy 패턴은 prepare/bind (local op) 까지 fail 주입 →
 *      비현실적. 본 wrapper 는 first/run/all/raw/exec/batch (DB 접촉) 에만 주입.
 *   4. errorClass 별 message — `withRetry` (apps/api/src/middleware/retry.ts) 의
 *      `RETRYABLE_MESSAGE_PATTERNS` 정합. `D1_DISCONNECT` / `D1_UNAVAILABLE` /
 *      `D1_TIMEOUT` 모두 retryable.
 *   5. 4-Pass Pass 1 M-1 흡수 — well-known symbol (then / Symbol.* / constructor /
 *      toString) 까지 fail 주입 시 `await flakyDb` 즉시 발화 → 본 wrapper 는 D1
 *      메서드 allowlist 만 주입, 그 외는 passthrough.
 *
 * 사용 예:
 *   const ctx = createD1FromSqlite();
 *   const prng = mulberry32(42);
 *   const flakyDb = withDisconnect(ctx.db, { disconnectRate: 0.1, errorClass: 'D1_DISCONNECT', prng });
 *   await withRetry(() => flakyDb.prepare('INSERT INTO ...').bind(...).run());
 */

/** 결정적 PRNG (mulberry32) — seed 동일 시 동일 시퀀스. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type DisconnectErrorClass = 'D1_DISCONNECT' | 'D1_UNAVAILABLE' | 'D1_TIMEOUT';

export interface DisconnectConfig {
  /** 0.0 ~ 1.0 — 호출당 실패 확률 */
  readonly disconnectRate: number;
  /** retry middleware 의 RETRYABLE_MESSAGE_PATTERNS 정합 클래스 */
  readonly errorClass: DisconnectErrorClass;
  /** 결정적 PRNG (mulberry32 권장) */
  readonly prng: () => number;
  /**
   * 호출별 latency 측정 callback (옵션). p95 latency 검증용.
   * 인자 attempts: withRetry 가 호출하지 않으므로 본 wrapper 수준 1로 고정.
   */
  readonly onCall?: (event: { method: string; failed: boolean; durationMs: number }) => void;
}

/** D1 disconnect 시 throw 되는 Error — message 가 RETRYABLE_MESSAGE_PATTERNS 매칭. */
export class SimulatedD1DisconnectError extends Error {
  readonly code: DisconnectErrorClass;
  constructor(errorClass: DisconnectErrorClass, context: string) {
    super(`${errorClass}: simulated ${context}`);
    this.name = 'SimulatedD1DisconnectError';
    this.code = errorClass;
  }
}

/**
 * D1Database 메서드 중 fail 주입 대상 (allowlist).
 * 4-Pass Pass 1 M-1 흡수: well-known symbol (then / Symbol.* / constructor) 까지
 * 자동 wrap 시 `await flakyDb` 등 단순 케이스가 즉시 발화. allowlist 외 속성은
 * 모두 passthrough → Proxy 가 D1 surface 정합 보장.
 */
const D1_FAIL_INJECTION_METHODS: ReadonlySet<string> = new Set(['exec', 'batch', 'dump']);

const D1_STATEMENT_FAIL_INJECTION_METHODS: ReadonlySet<string> = new Set([
  'first',
  'run',
  'all',
  'raw',
]);

/**
 * D1Database 를 disconnect 주입 Proxy 로 감싼다.
 *
 * 주입 지점:
 *   - D1Database.exec / batch / dump (D1_FAIL_INJECTION_METHODS)
 *   - D1PreparedStatement.first / run / all / raw (D1_STATEMENT_FAIL_INJECTION_METHODS)
 *
 * 주입 제외 (local op + well-known symbol):
 *   - D1Database.prepare / withSession (local op, statement 결과만 wrap)
 *   - D1PreparedStatement.bind (local op, chain 결과만 wrap)
 *   - then / Symbol.* / constructor / toString / valueOf 등 (well-known passthrough)
 */
export function withDisconnect(d1: D1Database, config: DisconnectConfig): D1Database {
  return new Proxy(d1, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig !== 'function') return orig;

      // prepare — local op, fail 주입 X. 결과 statement 만 wrap.
      if (prop === 'prepare') {
        return (sql: string): D1PreparedStatement => {
          const stmt = (orig as (s: string) => D1PreparedStatement).call(target, sql);
          return wrapStatement(stmt, config);
        };
      }

      // withSession — 본 wrapper 미지원, d1-from-sqlite.ts 가 throw. 원본 그대로.
      if (prop === 'withSession') {
        return (orig as () => unknown).bind(target);
      }

      // allowlist — fail 주입.
      if (typeof prop === 'string' && D1_FAIL_INJECTION_METHODS.has(prop)) {
        return async (...args: unknown[]) => {
          return injectFailureOrCall(prop, config, () =>
            (orig as (...a: unknown[]) => unknown).apply(target, args),
          );
        };
      }

      // 그 외 (well-known symbol / Symbol.iterator / then 등) — passthrough.
      return typeof orig === 'function'
        ? (orig as (...a: unknown[]) => unknown).bind(target)
        : orig;
    },
  });
}

function wrapStatement(stmt: D1PreparedStatement, config: DisconnectConfig): D1PreparedStatement {
  return new Proxy(stmt, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig !== 'function') return orig;

      // bind() — local op, fail 주입 X. 결과 statement 재귀 wrap.
      if (prop === 'bind') {
        return (...args: unknown[]): D1PreparedStatement => {
          const bound = (orig as (...a: unknown[]) => D1PreparedStatement).apply(target, args);
          return wrapStatement(bound, config);
        };
      }

      // allowlist — fail 주입.
      if (typeof prop === 'string' && D1_STATEMENT_FAIL_INJECTION_METHODS.has(prop)) {
        return async (...args: unknown[]) => {
          return injectFailureOrCall(prop, config, () =>
            (orig as (...a: unknown[]) => unknown).apply(target, args),
          );
        };
      }

      // 그 외 — passthrough.
      return typeof orig === 'function'
        ? (orig as (...a: unknown[]) => unknown).bind(target)
        : orig;
    },
  });
}

async function injectFailureOrCall<T>(
  method: string,
  config: DisconnectConfig,
  call: () => unknown,
): Promise<T> {
  const start = Date.now();
  const roll = config.prng();
  if (roll < config.disconnectRate) {
    const durationMs = Date.now() - start;
    config.onCall?.({ method, failed: true, durationMs });
    throw new SimulatedD1DisconnectError(config.errorClass, `${method} (roll=${roll.toFixed(4)})`);
  }
  const result = (await call()) as T;
  const durationMs = Date.now() - start;
  config.onCall?.({ method, failed: false, durationMs });
  return result;
}
