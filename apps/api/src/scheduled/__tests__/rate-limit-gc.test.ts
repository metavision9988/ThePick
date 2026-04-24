/**
 * rate_limits GC 단위 테스트 — NC-2 (가용성 CRITICAL).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { purgeOldRateLimits } from '../rate-limit-gc';
import { createD1FromSqlite } from '../../__tests__/helpers/d1-from-sqlite';

describe('purgeOldRateLimits', () => {
  let ctx: ReturnType<typeof createD1FromSqlite>;

  beforeEach(() => {
    ctx = createD1FromSqlite();
  });

  afterEach(() => {
    ctx.close();
  });

  async function seedRateLimit(userId: string, bucketMinute: string, count: number) {
    await ctx.db
      .prepare(
        `INSERT INTO rate_limits (user_id, bucket_minute, count, last_updated_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(userId, bucketMinute, count, `${bucketMinute}:00Z`)
      .run();
  }

  async function countRateLimits(): Promise<number> {
    const row = await ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM rate_limits`)
      .first<{ n: number }>();
    return Number(row?.n ?? 0);
  }

  it('2일 이상 지난 bucket 은 삭제, 2일 이내는 보존', async () => {
    const now = () => new Date('2026-04-24T12:00:00Z');

    // 3일 전 (삭제 대상)
    await seedRateLimit('user-a', '2026-04-21T10:00', 5);
    // 2일 5분 전 (삭제 대상 — 경계 바로 바깥)
    await seedRateLimit('user-b', '2026-04-22T11:55', 10);
    // 1일 23시간 전 (보존)
    await seedRateLimit('user-c', '2026-04-22T13:00', 3);
    // 현재 bucket (보존)
    await seedRateLimit('user-d', '2026-04-24T12:00', 1);

    expect(await countRateLimits()).toBe(4);

    const result = await purgeOldRateLimits(ctx.db, { now });

    expect(result.deletedCount).toBe(2);
    expect(result.cutoffBucket).toBe('2026-04-22T12:00');
    expect(await countRateLimits()).toBe(2);
  });

  it('빈 테이블에서도 안전하게 0 반환', async () => {
    const now = () => new Date('2026-04-24T12:00:00Z');
    const result = await purgeOldRateLimits(ctx.db, { now });
    expect(result.deletedCount).toBe(0);
  });

  it('모든 bucket 이 보존 범위 내면 삭제 0건', async () => {
    const now = () => new Date('2026-04-24T12:00:00Z');
    await seedRateLimit('user-a', '2026-04-23T12:00', 5);
    await seedRateLimit('user-b', '2026-04-24T11:00', 3);

    const result = await purgeOldRateLimits(ctx.db, { now });
    expect(result.deletedCount).toBe(0);
    expect(await countRateLimits()).toBe(2);
  });

  it('retentionDays 커스텀 — 1일 경계 적용', async () => {
    const now = () => new Date('2026-04-24T12:00:00Z');
    // 23시간 전 (1일 보존 시 통과)
    await seedRateLimit('user-a', '2026-04-23T13:00', 5);
    // 25시간 전 (1일 보존 시 삭제)
    await seedRateLimit('user-b', '2026-04-23T11:00', 10);

    const result = await purgeOldRateLimits(ctx.db, { now, retentionDays: 1 });
    expect(result.deletedCount).toBe(1);
    expect(result.cutoffBucket).toBe('2026-04-23T12:00');
  });
});
