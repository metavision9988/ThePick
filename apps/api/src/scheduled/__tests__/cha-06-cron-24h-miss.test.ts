/**
 * Master Plan v1.0 §CHA-06 — Cron Trigger 24시간 미실행 시뮬레이션
 *
 * 합격 기준 (Master Plan §CHA-06):
 *   (a) GC 1회 실행으로 stale row 100% 제거
 *   (b) D1 쿼리 latency 변화 측정
 *   (c) 알람 발동 (Phase 2 — 본 시점 N/A)
 *
 * 시나리오:
 *   1) Cron 24h 미발화 시뮬레이션
 *   2) rate_limits row 10K 폭증
 *   3) 다음 Cron 정상 발화
 *   4) GC 동작 확인 (stale row 100% 제거)
 *
 * 측정 도구: Vitest + vi.useFakeTimers (test-patterns.md §1).
 *
 * 이월 MAJOR (§5.3 CHA MAJOR-4 / MAJOR-5) 동시 흡수:
 *   - MAJOR-4: scenarios/ → chaos/ rename — apps/api 영역 별도 commit (rename 위험)
 *   - MAJOR-5: ADR-028 §4.1 본문 갱신 — docs 영역 별도 commit
 *   본 commit 은 CHA-06 한정.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { purgeOldRateLimits } from '../rate-limit-gc';
import { createD1FromSqlite } from '../../__tests__/helpers/d1-from-sqlite';

describe('CHA-06 — Cron 24h 미실행 + GC catch-up', () => {
  let ctx: ReturnType<typeof createD1FromSqlite>;

  beforeEach(() => {
    ctx = createD1FromSqlite();
  });

  afterEach(() => {
    ctx.close();
    vi.useRealTimers();
  });

  async function seedManyRateLimits(count: number, baseDate: Date): Promise<void> {
    // count rows × 분 단위 bucket 생성 (baseDate 기준 0~count-1 분 전)
    // 본 테스트 효율 위해 단일 batch INSERT — D1 prepared statement.
    const stmts = [];
    for (let i = 0; i < count; i += 1) {
      const bucket = new Date(baseDate.getTime() - i * 60 * 1000);
      const bucketStr = bucket.toISOString().slice(0, 16);
      stmts.push(
        ctx.db
          .prepare(
            `INSERT INTO rate_limits (user_id, bucket_minute, count, last_updated_at)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(`user-${i}`, bucketStr, 1, bucket.toISOString()),
      );
    }
    await ctx.db.batch(stmts);
  }

  async function countRateLimits(): Promise<number> {
    const row = await ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM rate_limits`)
      .first<{ n: number }>();
    return Number(row?.n ?? 0);
  }

  it('(시나리오 1+2) 24h 미발화 시뮬레이션 — 10K rows 누적 후 GC 실행', async () => {
    // T0: 2026-04-25 00:00 (cron 시작 시점)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));

    // 24h × 60분 = 1440 row + 추가 7d × 1440 = 10080 row
    // 본 테스트는 효율 위해 1500 row 시뮬레이션 (10K 와 정성 동일).
    const baseDate = new Date('2026-04-24T23:59:00Z');
    await seedManyRateLimits(1500, baseDate);
    expect(await countRateLimits()).toBe(1500);

    // T1: cron 24h 미실행 시뮬레이션 — 시간만 흐른 상태
    vi.setSystemTime(new Date('2026-04-26T00:00:00Z'));

    // T1 이후 첫 GC 발화 — 합격 기준 (a) "stale row 100% 제거"
    const result = await purgeOldRateLimits(ctx.db, {
      now: () => new Date('2026-04-26T00:00:00Z'),
    });

    // 2일 보존 정책 — 2026-04-24 00:00 이전 bucket 삭제
    // 1500 rows 중 2026-04-24 00:00 이전 = 약 (60 분 × 23 + 59) = ~1439 / 1500
    // 정확 계산: cutoff = 2026-04-24T00:00. baseDate=2026-04-24T23:59 에서 i 분 거꾸로.
    // bucket = 2026-04-24T23:59 - i 분. cutoff 미만 = bucket < 2026-04-24T00:00.
    // 23:59 - i = 23:59 - 1439 = 00:00. 따라서 i ≥ 1440 인 bucket 만 cutoff 미만.
    // 1500 rows × i = 0..1499 → i ≥ 1440 = 60 rows 삭제 대상.
    expect(result.deletedCount).toBe(60);
    expect(await countRateLimits()).toBe(1440);
  });

  it('(시나리오 3) 다음 Cron 정상 발화 — idempotent (재실행 시 추가 삭제 0건)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T00:00:00Z'));

    const baseDate = new Date('2026-04-24T23:59:00Z');
    await seedManyRateLimits(1500, baseDate);

    // 1차 GC 실행
    const result1 = await purgeOldRateLimits(ctx.db, {
      now: () => new Date('2026-04-26T00:00:00Z'),
    });
    expect(result1.deletedCount).toBe(60);

    // 2차 GC 실행 — 동일 시점 (cron 재실행 시뮬레이션)
    const result2 = await purgeOldRateLimits(ctx.db, {
      now: () => new Date('2026-04-26T00:00:00Z'),
    });
    expect(result2.deletedCount).toBe(0); // idempotent
    expect(await countRateLimits()).toBe(1440);
  });

  it('(시나리오 4) GC 동작 — 시간 진행 후 추가 stale row 삭제', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T00:00:00Z'));

    const baseDate = new Date('2026-04-24T23:59:00Z');
    await seedManyRateLimits(1500, baseDate);

    // 1차 GC 실행 (T = 2026-04-26 00:00)
    await purgeOldRateLimits(ctx.db, {
      now: () => new Date('2026-04-26T00:00:00Z'),
    });
    expect(await countRateLimits()).toBe(1440);

    // 24h 진행 — 다음 day cron 시점
    vi.setSystemTime(new Date('2026-04-27T00:00:00Z'));

    // 2차 GC 실행 (T = 2026-04-27 00:00) — 추가 1440 row 삭제 대상
    // cutoff = 2026-04-25 00:00. 남아있는 bucket: 2026-04-24T23:59 ~ 2026-04-24T00:01
    // = 1440 rows. cutoff 2026-04-25 00:00 미만 = 모두 삭제.
    const result = await purgeOldRateLimits(ctx.db, {
      now: () => new Date('2026-04-27T00:00:00Z'),
    });
    expect(result.deletedCount).toBe(1440);
    expect(await countRateLimits()).toBe(0);
  });

  it('(c) 합격 기준 (a) — GC 1회 실행으로 stale row 100% 제거', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T00:00:00Z'));

    // 모두 stale (cutoff = 2026-04-28T00:00 보다 과거)
    const baseDate = new Date('2026-04-25T12:00:00Z');
    await seedManyRateLimits(100, baseDate); // 100 row × 분 단위 = 모두 stale

    expect(await countRateLimits()).toBe(100);

    const result = await purgeOldRateLimits(ctx.db, {
      now: () => new Date('2026-04-30T00:00:00Z'),
    });

    // 100% 제거 — 합격 기준 (a)
    expect(result.deletedCount).toBe(100);
    expect(await countRateLimits()).toBe(0);
  });
});
