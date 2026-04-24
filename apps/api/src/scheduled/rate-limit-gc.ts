/**
 * rate_limits 테이블 GC — 오래된 bucket 을 주기 삭제 (NC-2).
 *
 * 배경 (Pass 3 Advocate 재리뷰, 2026-04-24):
 *   10K 유저 × 1440 min/day = 14.4M rows/day 누적. D1 10GB 한도(~800M rows) 약
 *   2개월 내 포화. MAJOR 이월이 아닌 가용성 CRITICAL 로 즉시 해결 필요.
 *
 * 전략: Cloudflare Workers Cron Trigger 하루 1회 실행 → 2일 이전 bucket DELETE.
 *   - 2일 여유: rate-limit 분 단위 bucket 이지만 retryAfter 계산 등에서 과거
 *     bucket 조회가 있을 수 있고, 운영 디버깅 시 최근 24h 전후 데이터 유지가 유용.
 *   - 인덱스 `idx_rate_limits_bucket` (migrations/0012) 활용으로 DELETE range 스캔
 *     효율적 처리.
 *
 * 호출 규약: `purgeOldRateLimits(db, options)` 를 scheduled 핸들러와 단위 테스트가
 * 공유한다. 에러는 전파 (scheduled 핸들러가 로깅 후 Workers 는 자동 재시도).
 */

export interface PurgeRateLimitsOptions {
  /** 현재 시각 (테스트 결정론을 위해 주입 가능). 기본: 실시간. */
  readonly now?: () => Date;
  /** 보존 기간 (일). 기본: 2일. */
  readonly retentionDays?: number;
}

export interface PurgeRateLimitsResult {
  readonly deletedCount: number;
  readonly cutoffBucket: string;
}

/**
 * retentionDays 이전의 rate_limits bucket 을 DELETE.
 * @returns 삭제된 row 수 + cutoff bucket (관측용).
 */
export async function purgeOldRateLimits(
  db: D1Database,
  options: PurgeRateLimitsOptions = {},
): Promise<PurgeRateLimitsResult> {
  const now = (options.now ?? (() => new Date()))();
  const retentionDays = options.retentionDays ?? 2;

  // F1 (3차 리뷰): retentionDays 입력 검증 — 0/음수/NaN 시 활성 bucket 삭제 방지.
  // 현재 호출자는 default=2 만 사용하나, 향후 env var 주입 등 확장 시 silent destructive
  // 분기를 막는다. CLAUDE.md "try-catch 에서 데이터 조용히 삭제 금지" 정신.
  if (!Number.isFinite(retentionDays) || retentionDays < 1 || !Number.isInteger(retentionDays)) {
    throw new Error(
      `purgeOldRateLimits: invalid retentionDays=${retentionDays} (must be positive integer)`,
    );
  }

  const cutoffTime = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  // bucket_minute 컬럼은 'YYYY-MM-DDTHH:MM' 16자 ISO 접두사. 사전식 비교가 시각 순서와 동등.
  const cutoffBucket = cutoffTime.toISOString().slice(0, 16);

  const result = await db
    .prepare(`DELETE FROM rate_limits WHERE bucket_minute < ?`)
    .bind(cutoffBucket)
    .run();

  const deletedCount = Number(result.meta?.changes ?? 0);
  return { deletedCount, cutoffBucket };
}
