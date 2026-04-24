/**
 * Per-user rate-limit + enumeration oracle 방어 (TD-030).
 *
 * 배경: POST /api/progress/review 의 404/200 응답 차이가 knowledge_nodes.id 를
 * oracle 로 노출. 두 가지 방어선:
 *   1. 분 단위 요청 상한 — `checkAndIncrementRateLimit` (D1 rate_limits 테이블)
 *   2. 404 응답 전 무작위 지연 — `sleepJitter`
 *
 * Workers 에서 setTimeout 기반 sleep 은 CPU 시간이 아닌 wall-clock time 을 소비 →
 * 50ms paid / 30s 한도 내에서 문제없다. 테스트 환경에서는 dependency injection 으로
 * 대체 가능 (`sleepImpl` 인자).
 */

const DEFAULT_LIMIT_PER_MINUTE = 60;
const JITTER_MIN_MS = 50;
const JITTER_MAX_MS = 150;

export class RateLimitExceeded extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(`Rate limit exceeded. Retry after ${retryAfterSeconds}s.`);
    this.name = 'RateLimitExceeded';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface RateLimitCheckOptions {
  readonly limitPerMinute?: number;
  /** 현재 시각 주입 — 테스트에서 결정론적 bucket 계산. */
  readonly now?: () => Date;
}

/**
 * 현재 분(bucket) 의 요청 카운트를 1 증가시키고, 한도 초과 시 예외 throw.
 *
 * UPSERT 패턴: INSERT ... ON CONFLICT DO UPDATE.
 * 동시성: D1 은 단일 region serializable, race 도 크게 우려 없음.
 * 다만 Workers 간 동시 요청은 약간 초과 가능 (허용 오차 ±10%).
 */
export async function checkAndIncrementRateLimit(
  db: D1Database,
  userId: string,
  options: RateLimitCheckOptions = {},
): Promise<{ count: number; bucketMinute: string }> {
  const limit = options.limitPerMinute ?? DEFAULT_LIMIT_PER_MINUTE;
  const now = (options.now ?? (() => new Date()))();
  const bucketMinute = formatBucketMinute(now);

  // UPSERT — 카운트 1 증가 (없으면 1 로 생성).
  await db
    .prepare(
      `INSERT INTO rate_limits (user_id, bucket_minute, count, last_updated_at)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(user_id, bucket_minute)
       DO UPDATE SET count = count + 1, last_updated_at = ?`,
    )
    .bind(userId, bucketMinute, now.toISOString(), now.toISOString())
    .run();

  const row = await db
    .prepare(
      `SELECT count FROM rate_limits
       WHERE user_id = ? AND bucket_minute = ?
       LIMIT 1`,
    )
    .bind(userId, bucketMinute)
    .first<{ count: number }>();

  const count = Number(row?.count ?? 0);

  if (count > limit) {
    // 현재 분의 남은 초 — 다음 bucket 시작 시점.
    const secondsInMinute = now.getUTCSeconds();
    const retryAfter = Math.max(1, 60 - secondsInMinute);
    throw new RateLimitExceeded(retryAfter);
  }

  return { count, bucketMinute };
}

/**
 * 404 응답 전 무작위 지연으로 타이밍 oracle 방어.
 * 50~150ms 범위 균등 분포.
 */
export async function sleepJitter(
  random: () => number = Math.random,
  sleepImpl: (ms: number) => Promise<void> = defaultSleep,
): Promise<void> {
  const range = JITTER_MAX_MS - JITTER_MIN_MS;
  const ms = Math.min(JITTER_MAX_MS, JITTER_MIN_MS + Math.floor(random() * (range + 1)));
  await sleepImpl(ms);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** ISO 8601 'YYYY-MM-DDTHH:MM' 접두사 — 초 이하 제거한 분 단위 bucket. */
function formatBucketMinute(date: Date): string {
  return date.toISOString().slice(0, 16);
}
