/**
 * silent_failure_monitor 단위 테스트 — Step 3-UX-6e devops CRIT-DO-1 흡수.
 *
 * ADR-043 정합 — engine_telemetry에서 silent failure 이벤트 집계 + 임계 분류.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { monitorSilentFailures, reportSilentFailures } from '../silent-failure-monitor';
import { createD1FromSqlite } from '../../__tests__/helpers/d1-from-sqlite';
import { EXAM_IDS, createLogger } from '@thepick/shared';

describe('monitorSilentFailures', () => {
  let ctx: ReturnType<typeof createD1FromSqlite>;

  beforeEach(() => {
    ctx = createD1FromSqlite();
  });

  afterEach(() => {
    ctx.close();
  });

  async function seedTelemetry(
    event: string,
    recordedAt: string,
    examId: string = EXAM_IDS.SON_HAE_PYEONG_GA_SA,
  ): Promise<void> {
    await ctx.db
      .prepare(
        `INSERT INTO engine_telemetry (id, exam_id, gauge_name, metric_value, metric_json, recorded_at)
         VALUES (?, ?, 'learning_slo', 1, ?, ?)`,
      )
      .bind(crypto.randomUUID(), examId, JSON.stringify({ event }), recordedAt)
      .run();
  }

  it('이벤트 없음 → totalCount 0 + severity ok', async () => {
    const now = () => new Date('2026-05-13T12:00:00Z');
    const result = await monitorSilentFailures(ctx.db, { now });
    expect(result.totalCount).toBe(0);
    expect(result.severity).toBe('ok');
    expect(result.counts).toHaveLength(2);
    expect(result.counts.every((c) => c.count === 0)).toBe(true);
  });

  it('window 안 streak_silent_failure 카운트 집계', async () => {
    const now = () => new Date('2026-05-13T12:00:00Z');
    // 24h 안 (포함)
    await seedTelemetry('streak_silent_failure', '2026-05-13T06:00:00.000Z');
    await seedTelemetry('streak_silent_failure', '2026-05-13T08:00:00.000Z');
    // 24h 밖 (제외)
    await seedTelemetry('streak_silent_failure', '2026-05-12T11:00:00.000Z');
    const result = await monitorSilentFailures(ctx.db, { now });
    const streak = result.counts.find((c) => c.event === 'streak_silent_failure');
    expect(streak?.count).toBe(2);
    expect(result.totalCount).toBe(2);
    expect(result.severity).toBe('ok'); // 2 ≤ warnThreshold 5
  });

  it('warn 임계 초과 → severity warn', async () => {
    const now = () => new Date('2026-05-13T12:00:00Z');
    for (let i = 0; i < 10; i++) {
      await seedTelemetry('weak_delta_silent_failure', '2026-05-13T08:00:00.000Z');
    }
    const result = await monitorSilentFailures(ctx.db, { now });
    expect(result.totalCount).toBe(10);
    expect(result.severity).toBe('warn'); // 5 < 10 ≤ 50
  });

  it('critical 임계 초과 → severity critical', async () => {
    const now = () => new Date('2026-05-13T12:00:00Z');
    for (let i = 0; i < 55; i++) {
      await seedTelemetry('streak_silent_failure', '2026-05-13T08:00:00.000Z');
    }
    const result = await monitorSilentFailures(ctx.db, { now });
    expect(result.totalCount).toBe(55);
    expect(result.severity).toBe('critical'); // > 50
  });

  it('서로 다른 이벤트 카운트 분리', async () => {
    const now = () => new Date('2026-05-13T12:00:00Z');
    await seedTelemetry('streak_silent_failure', '2026-05-13T08:00:00.000Z');
    await seedTelemetry('weak_delta_silent_failure', '2026-05-13T08:00:00.000Z');
    await seedTelemetry('weak_delta_silent_failure', '2026-05-13T09:00:00.000Z');
    const result = await monitorSilentFailures(ctx.db, { now });
    expect(result.counts.find((c) => c.event === 'streak_silent_failure')?.count).toBe(1);
    expect(result.counts.find((c) => c.event === 'weak_delta_silent_failure')?.count).toBe(2);
  });

  it('알 수 없는 이벤트는 무시 (다른 learning_slo emit과 격리)', async () => {
    const now = () => new Date('2026-05-13T12:00:00Z');
    await seedTelemetry('grade', '2026-05-13T08:00:00.000Z'); // 정상 이벤트
    await seedTelemetry('mode_start', '2026-05-13T09:00:00.000Z'); // 정상 이벤트
    await seedTelemetry('streak_silent_failure', '2026-05-13T10:00:00.000Z');
    const result = await monitorSilentFailures(ctx.db, { now });
    expect(result.totalCount).toBe(1);
  });

  it('잘못된 windowHours → throw', async () => {
    await expect(monitorSilentFailures(ctx.db, { windowHours: 0 })).rejects.toThrow();
    await expect(monitorSilentFailures(ctx.db, { windowHours: -1 })).rejects.toThrow();
  });

  it('잘못된 threshold → throw', async () => {
    await expect(
      monitorSilentFailures(ctx.db, { warnThreshold: 100, criticalThreshold: 50 }),
    ).rejects.toThrow();
  });
});

describe('reportSilentFailures', () => {
  let ctx: ReturnType<typeof createD1FromSqlite>;

  beforeEach(() => {
    ctx = createD1FromSqlite();
  });

  afterEach(() => {
    ctx.close();
  });

  async function seedTelemetry(event: string, recordedAt: string): Promise<void> {
    await ctx.db
      .prepare(
        `INSERT INTO engine_telemetry (id, exam_id, gauge_name, metric_value, metric_json, recorded_at)
         VALUES (?, ?, 'learning_slo', 1, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        JSON.stringify({ event }),
        recordedAt,
      )
      .run();
  }

  it('severity critical 시 logger.error + console.error 호출', async () => {
    const now = () => new Date('2026-05-13T12:00:00Z');
    for (let i = 0; i < 60; i++) {
      await seedTelemetry('streak_silent_failure', '2026-05-13T08:00:00.000Z');
    }
    const logger = createLogger({ service: 'test', environment: 'test' });
    const errSpy = vi.spyOn(logger, 'error');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await reportSilentFailures(ctx.db, logger, { now });

    expect(result.severity).toBe('critical');
    expect(errSpy).toHaveBeenCalledOnce();
    // logger.error 내부가 console.error로도 emit → spy가 2회 잡힘. 직접 emit이 CRITICAL 문자열 포함.
    expect(consoleSpy).toHaveBeenCalled();
    const directCall = consoleSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('CRITICAL'),
    );
    expect(directCall).toBeDefined();

    consoleSpy.mockRestore();
  });

  it('severity ok 시 console 호출 0', async () => {
    const now = () => new Date('2026-05-13T12:00:00Z');
    const logger = createLogger({ service: 'test', environment: 'test' });
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await reportSilentFailures(ctx.db, logger, { now });

    expect(result.severity).toBe('ok');
    expect(consoleErrSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    consoleErrSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
});
