/**
 * write-helper.ts — 단위 테스트 (5-페르소나 quality CRIT-Q2 흡수, Step 19).
 *
 * routes.test.ts 가 integration 만 검증 → throw 경로 3건 (64KB / circular ref / D1 RETURNING null)
 * 단위 검증 부재였음. 본 파일이 writeTelemetryEvent 직접 호출 + 의존성 mock 으로 격리.
 */

import { describe, expect, it } from 'vitest';
import { createLogger, EXAM_IDS } from '@thepick/shared';
import {
  writeTelemetryEvent,
  TelemetryWriteError,
  type WriteTelemetryDeps,
} from '../write-helper.js';
import type { TelemetryEventPayload } from '../types.js';

const baseLogger = createLogger({ service: 'test-write-helper' });

function buildPayload(overrides: Partial<TelemetryEventPayload> = {}): TelemetryEventPayload {
  return {
    examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
    gaugeName: 'cost',
    metricValue: 100,
    ...overrides,
  } as TelemetryEventPayload;
}

interface FakePreparedOptions {
  readonly returningRow?: { recorded_at: string } | null;
  readonly throwOnFirst?: Error;
}

function buildFakeDb(opts: FakePreparedOptions = {}): D1Database {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => {
          if (opts.throwOnFirst) throw opts.throwOnFirst;
          if (opts.returningRow === undefined) {
            return { recorded_at: '2026-05-01T00:00:00.000Z' };
          }
          return opts.returningRow;
        },
        run: async () => ({ success: true, meta: {} }),
        all: async () => ({ success: true, results: [] }),
      }),
    }),
  } as unknown as D1Database;
}

function buildDeps(dbOpts: FakePreparedOptions = {}): WriteTelemetryDeps {
  return {
    db: buildFakeDb(dbOpts),
    logger: baseLogger,
    generateId: () => 'fixed-uuid-for-test-determinism-1234',
  };
}

describe('writeTelemetryEvent — 단위 (Step 19 CRIT-Q2 흡수)', () => {
  describe('정상 경로', () => {
    it('metricValue 만 → 정상 INSERT + recordedAt 반환', async () => {
      const result = await writeTelemetryEvent(buildPayload({ metricValue: 42 }), buildDeps());
      expect(result.id).toBe('fixed-uuid-for-test-determinism-1234');
      expect(result.metricValue).toBe(42);
      expect(result.metricJson).toBeNull();
      expect(result.recordedAt).toBe('2026-05-01T00:00:00.000Z');
    });

    it('metricJson 만 → 정상 INSERT (metricValue null)', async () => {
      const result = await writeTelemetryEvent(
        buildPayload({ metricValue: undefined, metricJson: { orphan_nodes: 0 } }),
        buildDeps(),
      );
      expect(result.metricValue).toBeNull();
      expect(result.metricJson).toEqual({ orphan_nodes: 0 });
    });

    it('sourceId/batchRunId optional 부재 → null 채움', async () => {
      const result = await writeTelemetryEvent(buildPayload(), buildDeps());
      expect(result.sourceId).toBeNull();
      expect(result.batchRunId).toBeNull();
    });
  });

  describe('throw 경로 1: assertValidExamId 다층 방어', () => {
    it('미지 examId → throw (Hard Rule 17 다층 방어선)', async () => {
      // Zod refine 우회 가정 (TypeScript 캐스팅 시뮬레이션)
      const evilPayload = {
        examId: 'evil-exam',
        gaugeName: 'cost',
        metricValue: 100,
      } as unknown as TelemetryEventPayload;
      await expect(writeTelemetryEvent(evilPayload, buildDeps())).rejects.toThrow(/Invalid examId/);
    });
  });

  describe('throw 경로 2: metricJson 직렬화 실패', () => {
    it('순환 참조 → TelemetryWriteError("metricJson serialization failed")', async () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      await expect(
        writeTelemetryEvent(buildPayload({ metricJson: circular }), buildDeps()),
      ).rejects.toThrowError(TelemetryWriteError);
    });

    it('64KB 초과 → TelemetryWriteError("metricJson too large")', async () => {
      const big = { huge: 'x'.repeat(70_000) };
      await expect(
        writeTelemetryEvent(buildPayload({ metricJson: big }), buildDeps()),
      ).rejects.toThrow(/metricJson too large/);
    });

    it('정확히 64KB 경계 → throw (>= 65536 bytes)', async () => {
      // 65540 bytes 정도 — JSON.stringify({"k":"<padding>"}) ≈ 65540
      const padding = 'x'.repeat(65_530);
      await expect(
        writeTelemetryEvent(buildPayload({ metricJson: { k: padding } }), buildDeps()),
      ).rejects.toThrow(/metricJson too large/);
    });
  });

  describe('throw 경로 3: D1 INSERT 실패', () => {
    it('first() 가 null 반환 → TelemetryWriteError("INSERT returned no row")', async () => {
      await expect(
        writeTelemetryEvent(buildPayload(), buildDeps({ returningRow: null })),
      ).rejects.toThrow(/INSERT returned no row/);
    });

    it('first() 가 throw → TelemetryWriteError("D1 INSERT failed")', async () => {
      await expect(
        writeTelemetryEvent(
          buildPayload(),
          buildDeps({ throwOnFirst: new Error('connection lost') }),
        ),
      ).rejects.toThrow(/D1 INSERT failed/);
    });

    it('TelemetryWriteError 는 cause 보존', async () => {
      const cause = new Error('network down');
      try {
        await writeTelemetryEvent(buildPayload(), buildDeps({ throwOnFirst: cause }));
        expect.fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(TelemetryWriteError);
        expect((err as TelemetryWriteError).cause).toBe(cause);
      }
    });
  });

  describe('UUID 결정성 / 주입', () => {
    it('generateId 미주입 시 crypto.randomUUID 사용 (fallback 동작)', async () => {
      const deps: WriteTelemetryDeps = { db: buildFakeDb(), logger: baseLogger };
      const result = await writeTelemetryEvent(buildPayload(), deps);
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('동일 입력 + 다른 generateId → 다른 id (의도 — 매 호출 신규 이벤트)', async () => {
      const result1 = await writeTelemetryEvent(buildPayload(), {
        db: buildFakeDb(),
        logger: baseLogger,
        generateId: () => 'id-A',
      });
      const result2 = await writeTelemetryEvent(buildPayload(), {
        db: buildFakeDb(),
        logger: baseLogger,
        generateId: () => 'id-B',
      });
      expect(result1.id).toBe('id-A');
      expect(result2.id).toBe('id-B');
    });
  });
});
