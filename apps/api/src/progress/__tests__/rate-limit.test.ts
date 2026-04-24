/**
 * rate-limit + sleepJitter 단위 테스트 — TD-030 enumeration oracle 방어선 검증.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkAndIncrementRateLimit, RateLimitExceeded, sleepJitter } from '../rate-limit';
import { createD1FromSqlite } from '../../__tests__/helpers/d1-from-sqlite';

describe('checkAndIncrementRateLimit', () => {
  let ctx: ReturnType<typeof createD1FromSqlite>;

  beforeEach(() => {
    ctx = createD1FromSqlite();
  });

  afterEach(() => {
    ctx.close();
  });

  it('첫 요청 → count=1 반환', async () => {
    const clock = () => new Date('2026-04-23T10:00:00Z');
    const r = await checkAndIncrementRateLimit(ctx.db, 'user-a', { now: clock });
    expect(r.count).toBe(1);
    expect(r.bucketMinute).toBe('2026-04-23T10:00');
  });

  it('같은 분 60회까지 허용, 61번째 거부', async () => {
    const clock = () => new Date('2026-04-23T10:00:00Z');
    for (let i = 0; i < 60; i++) {
      await checkAndIncrementRateLimit(ctx.db, 'user-a', { now: clock });
    }
    // 61번째
    await expect(
      checkAndIncrementRateLimit(ctx.db, 'user-a', { now: clock }),
    ).rejects.toBeInstanceOf(RateLimitExceeded);
  });

  it('분이 바뀌면 카운터 리셋 (bucket 분리)', async () => {
    const clockA = () => new Date('2026-04-23T10:00:00Z');
    const clockB = () => new Date('2026-04-23T10:01:00Z');

    for (let i = 0; i < 60; i++) {
      await checkAndIncrementRateLimit(ctx.db, 'user-a', { now: clockA });
    }
    // 새 분 — 한도 리셋
    const r = await checkAndIncrementRateLimit(ctx.db, 'user-a', { now: clockB });
    expect(r.count).toBe(1);
  });

  it('다른 사용자는 독립 카운터', async () => {
    const clock = () => new Date('2026-04-23T10:00:00Z');
    for (let i = 0; i < 60; i++) {
      await checkAndIncrementRateLimit(ctx.db, 'user-a', { now: clock });
    }
    // user-b 는 영향 없음
    const r = await checkAndIncrementRateLimit(ctx.db, 'user-b', { now: clock });
    expect(r.count).toBe(1);
  });

  it('커스텀 limit 적용', async () => {
    const clock = () => new Date('2026-04-23T10:00:00Z');
    await checkAndIncrementRateLimit(ctx.db, 'u', { now: clock, limitPerMinute: 2 });
    await checkAndIncrementRateLimit(ctx.db, 'u', { now: clock, limitPerMinute: 2 });
    // 3번째 거부
    await expect(
      checkAndIncrementRateLimit(ctx.db, 'u', { now: clock, limitPerMinute: 2 }),
    ).rejects.toBeInstanceOf(RateLimitExceeded);
  });

  it('RateLimitExceeded.retryAfterSeconds ≥ 1 (다음 분까지)', async () => {
    const clock = () => new Date('2026-04-23T10:00:30Z'); // 30초 시점
    for (let i = 0; i < 60; i++) {
      await checkAndIncrementRateLimit(ctx.db, 'u', { now: clock });
    }
    try {
      await checkAndIncrementRateLimit(ctx.db, 'u', { now: clock });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitExceeded);
      expect((err as RateLimitExceeded).retryAfterSeconds).toBe(30); // 60-30
    }
  });
});

describe('sleepJitter', () => {
  it('50~150ms 범위 내 호출', async () => {
    const sleeps: number[] = [];
    const fakeSleep = (ms: number) => {
      sleeps.push(ms);
      return Promise.resolve();
    };
    await sleepJitter(() => 0.5, fakeSleep); // 50 + 0.5*101 = 100.5 → 100
    await sleepJitter(() => 0, fakeSleep); // 50
    await sleepJitter(() => 1, fakeSleep); // 150
    expect(sleeps[0]).toBeGreaterThanOrEqual(50);
    expect(sleeps[0]).toBeLessThanOrEqual(150);
    expect(sleeps[1]).toBe(50);
    expect(sleeps[2]).toBe(150);
  });
});
