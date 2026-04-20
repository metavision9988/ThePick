/**
 * D1 쿼리 재시도 유틸리티 (ADR-008 §1).
 *
 * 정책:
 *   - 최대 재시도: 2회 (총 3번 시도)
 *   - 지수 백오프: 100ms → 400ms (jitter 없음 — Workers 단일 요청 스코프)
 *   - 재시도 대상: HTTP 5xx, timeout, network 키워드
 *   - 제외: D1_CONSTRAINT_*, D1_TRIGGER_* (무결성 위반은 재시도해도 동일 실패)
 *
 * 사용처:
 *   - read-only 공용 테이블 (knowledge_nodes, formulas, constants 등) — 실패 시 KV 폴백
 *   - 사용자별 데이터 (users, user_progress, payment_events) — 실패 시 503 + Retry-After
 *
 * 본 유틸은 단순 쿼리 래퍼. KV 폴백/503 분기는 호출 측에서 처리.
 */

const MAX_RETRY_ATTEMPTS = 2;
const INITIAL_BACKOFF_MS = 100;
const BACKOFF_MULTIPLIER = 4;

const NON_RETRYABLE_MESSAGE_PATTERNS: readonly RegExp[] = [
  /D1_CONSTRAINT/i,
  /D1_TRIGGER/i,
  /UNIQUE constraint failed/i,
  /NOT NULL constraint failed/i,
  /CHECK constraint failed/i,
  /FOREIGN KEY constraint failed/i,
];

const RETRYABLE_MESSAGE_PATTERNS: readonly RegExp[] = [
  /timeout/i,
  /network/i,
  /D1_ERROR.*5\d\d/i,
  /D1_DUMP_ERROR/i,
  /unreachable/i,
];

export interface RetryResult<T> {
  readonly value: T;
  readonly attempts: number;
}

/**
 * 비동기 함수를 재시도 정책으로 래핑한다.
 *
 * @throws 최종 실패 시 마지막 에러 원본 (catch 측에서 503 or 폴백 결정)
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const value = await fn();
      return { value, attempts: attempt + 1 };
    } catch (err) {
      lastError = err;

      if (!isRetryable(err)) {
        throw err;
      }

      if (attempt === MAX_RETRY_ATTEMPTS) {
        break;
      }

      const backoff = INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt);
      await sleep(backoff);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`withRetry exhausted: ${String(lastError)}`);
}

/**
 * 에러가 재시도 가능한지 판정.
 *
 * 우선순위:
 *   1. D1 무결성 위반 패턴 → false (즉시 전파)
 *   2. 5xx / timeout / network 패턴 → true
 *   3. 그 외 → false (안전 기본값 — 의도치 않은 재시도 폭주 방어)
 */
export function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  const message = err.message;

  for (const pattern of NON_RETRYABLE_MESSAGE_PATTERNS) {
    if (pattern.test(message)) return false;
  }

  for (const pattern of RETRYABLE_MESSAGE_PATTERNS) {
    if (pattern.test(message)) return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
