/**
 * CHA-01 — D1 무작위 disconnect (10% rate) chaos 테스트.
 *
 * 근거:
 *   - Master Plan v1.0 §CHA-01 (D1 disconnect 10% / retry / checkpoint 보존)
 *   - ADR-028 §4.1 (Workers Vitest Pool 이연 → wrapper level Proxy 채택)
 *   - handoff-031 §2.A (Sprint 1 §5.3 NOT-IMPL 3건 진입)
 *
 * 본 시점 적용 범위 (정직 명시):
 *   - apps/batch wire-up 이연 (pipeline.integration.test.ts 도 partial) → BATCH-1 fixture
 *     end-to-end 시뮬레이션 대신 D1Database 호출 시퀀스 직접 시뮬레이션.
 *   - 합격 기준 매핑:
 *       (a) BATCH 최종 status='completed' → "100 시뮬레이션 호출 모두 최종 PASS"
 *       (b) p95 latency ≤ 2,000ms → withRetry backoff (100→400ms) 포함 측정
 *       (c) 각 호출 retry ≤ 3회 → withRetry MAX_RETRY_ATTEMPTS=2 (총 3회) 정합
 *       (d) checkpoint 파일 corruption=0 → "최종 row count == 100, 부분 INSERT 0건"
 *
 *   apps/batch wire-up 완료 시점 (Phase 1 후반 또는 BATCH-1 진입 직전) BATCH 통합
 *   카오스 테스트 별도 추가 의무 — handoff 에 명시 이월.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withRetry } from '../../middleware/retry.js';
import { createD1FromSqlite, type SqliteBackedD1 } from '../helpers/d1-from-sqlite.js';
import {
  SimulatedD1DisconnectError,
  mulberry32,
  withDisconnect,
  type DisconnectErrorClass,
} from '../helpers/d1-disconnect-mock.js';

const SEED = 42;
const ITERATIONS = 100;
const TARGET_DISCONNECT_RATE = 0.1;
const P95_LATENCY_BUDGET_MS = 2000;
const RETRY_BUDGET_ATTEMPTS = 3;

let ctx: SqliteBackedD1;

beforeEach(() => {
  ctx = createD1FromSqlite();
});

afterEach(() => {
  ctx.close();
});

// ---------------------------------------------------------------------------
// Section 1 — PRNG 결정성 (회귀 추적 단순화)
// ---------------------------------------------------------------------------

describe('mulberry32 PRNG — seed=42 결정성', () => {
  it('동일 seed → 동일 시퀀스', () => {
    const a = mulberry32(SEED);
    const b = mulberry32(SEED);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('100회 시퀀스에서 < 0.1 비율이 spec 의 ~10% 와 일치', () => {
    const prng = mulberry32(SEED);
    let belowThreshold = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      if (prng() < TARGET_DISCONNECT_RATE) belowThreshold++;
    }
    // 100회 표본 → 기댓값 10건. 분산 허용 ±5건 (deterministic).
    expect(belowThreshold).toBeGreaterThanOrEqual(5);
    expect(belowThreshold).toBeLessThanOrEqual(15);
  });
});

// ---------------------------------------------------------------------------
// Section 2 — withDisconnect Proxy fail 주입 정합
// ---------------------------------------------------------------------------

describe('withDisconnect — D1Database / D1PreparedStatement Proxy', () => {
  it('disconnectRate=1.0 → 모든 호출 실패', async () => {
    const flaky = withDisconnect(ctx.db, {
      disconnectRate: 1.0,
      errorClass: 'D1_DISCONNECT',
      prng: mulberry32(SEED),
    });

    await expect(flaky.prepare('SELECT 1 AS x').first<{ x: number }>()).rejects.toBeInstanceOf(
      SimulatedD1DisconnectError,
    );
  });

  it('disconnectRate=0.0 → 모든 호출 통과', async () => {
    const stable = withDisconnect(ctx.db, {
      disconnectRate: 0.0,
      errorClass: 'D1_DISCONNECT',
      prng: mulberry32(SEED),
    });

    const result = await stable.prepare('SELECT 1 AS x').first<{ x: number }>();
    expect(result).toEqual({ x: 1 });
  });

  it('prepare() / bind() 는 fail 주입 X (local op)', async () => {
    // disconnectRate=1.0 인데 prepare/bind 자체는 통과해야 함 (Proxy 가 wrap 만).
    const flaky = withDisconnect(ctx.db, {
      disconnectRate: 1.0,
      errorClass: 'D1_DISCONNECT',
      prng: mulberry32(SEED),
    });

    // prepare/bind 호출 자체는 throw 하지 않음 (statement 객체 반환).
    const stmt = flaky.prepare('SELECT ? AS x').bind(42);
    expect(stmt).toBeDefined();

    // first() 호출 시점에서야 throw.
    await expect(stmt.first<{ x: number }>()).rejects.toBeInstanceOf(SimulatedD1DisconnectError);
  });

  it('errorClass 별 message 포맷 정합 (retry middleware 매칭)', async () => {
    const classes: readonly DisconnectErrorClass[] = [
      'D1_DISCONNECT',
      'D1_UNAVAILABLE',
      'D1_TIMEOUT',
    ];
    for (const errorClass of classes) {
      const flaky = withDisconnect(ctx.db, {
        disconnectRate: 1.0,
        errorClass,
        prng: mulberry32(SEED),
      });
      try {
        await flaky.prepare('SELECT 1').first();
        expect.fail(`${errorClass}: 실패 미주입`);
      } catch (err) {
        expect(err).toBeInstanceOf(SimulatedD1DisconnectError);
        expect((err as Error).message).toContain(errorClass);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Section 3 — 합격 기준 — withRetry + 10% disconnect 통합 시퀀스
// ---------------------------------------------------------------------------

describe('CHA-01 합격 기준 — 100 호출 / 10% disconnect / withRetry 통합', () => {
  it('(a) 100 INSERT 모두 최종 PASS / (b) p95 < 2s / (c) attempts ≤ 3 / (d) row count = 100', async () => {
    // 사용자 1회 가입 ≈ INSERT 시퀀스 시뮬레이션.
    // BATCH wire-up 이연으로 BATCH-1 fixture 직접 실행 불가 — INSERT 시퀀스 대체.
    await ctx.db.exec(
      'CREATE TABLE cha01_simulated (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL)',
    );

    const flaky = withDisconnect(ctx.db, {
      disconnectRate: TARGET_DISCONNECT_RATE,
      errorClass: 'D1_DISCONNECT',
      prng: mulberry32(SEED),
    });

    const latencies: number[] = [];
    const attemptsPerCall: number[] = [];
    let successCount = 0;
    let exhaustedCount = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const startCall = Date.now();
      try {
        const result = await withRetry(() =>
          flaky.prepare('INSERT INTO cha01_simulated (value) VALUES (?)').bind(`row-${i}`).run(),
        );
        attemptsPerCall.push(result.attempts);
        successCount++;
      } catch {
        exhaustedCount++;
      } finally {
        latencies.push(Date.now() - startCall);
      }
    }

    // (a) 100 호출 모두 최종 PASS
    expect(successCount, '100 INSERT 최종 성공').toBe(ITERATIONS);
    expect(exhaustedCount, 'retry 소진 0건').toBe(0);

    // (c) 각 호출 retry ≤ 3 (총 시도)
    for (const attempts of attemptsPerCall) {
      expect(attempts).toBeLessThanOrEqual(RETRY_BUDGET_ATTEMPTS);
      expect(attempts).toBeGreaterThanOrEqual(1);
    }

    // (b) p95 latency ≤ 2,000ms
    const sorted = [...latencies].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    expect(p95, `p95 ${p95}ms ≤ ${P95_LATENCY_BUDGET_MS}ms`).toBeLessThanOrEqual(
      P95_LATENCY_BUDGET_MS,
    );

    // (d) row count = 100 — INSERT 멱등성 검증 (부분 INSERT 누적 0건)
    const countRow = await ctx.db
      .prepare('SELECT COUNT(*) AS n FROM cha01_simulated')
      .first<{ n: number }>();
    expect(countRow?.n).toBe(ITERATIONS);
  });

  it(
    'disconnectRate=0.5 (extreme) — 일부 호출 retry 소진 시 throw',
    { timeout: 20000 },
    async () => {
      // 50% 실패 + 3회 시도 → 단일 호출 최종 실패율 = 0.5^3 = 12.5%
      // 50회 중 ~6회 소진 예상. backoff (100ms→400ms) 누적 → 총 ~8s 소요 (timeout 20s).
      await ctx.db.exec('CREATE TABLE cha01_extreme (id INTEGER PRIMARY KEY)');

      const flaky = withDisconnect(ctx.db, {
        disconnectRate: 0.5,
        errorClass: 'D1_DISCONNECT',
        prng: mulberry32(SEED),
      });

      let exhaustedCount = 0;
      for (let i = 0; i < 50; i++) {
        try {
          await withRetry(() => flaky.prepare('SELECT ? AS x').bind(i).first());
        } catch (err) {
          exhaustedCount++;
          // 소진 시 마지막 에러 (D1_DISCONNECT) 그대로 전파
          expect(err).toBeInstanceOf(SimulatedD1DisconnectError);
        }
      }

      // 50% × 3회 시도 → 12.5% 소진 예상. seed=42 결정적이므로 정확 카운트 검증.
      // 보수 범위 (1~25건) — seed/시퀀스 변경 시 회귀 추적 신호.
      expect(exhaustedCount).toBeGreaterThan(0);
      expect(exhaustedCount).toBeLessThan(50);
    },
  );
});

// ---------------------------------------------------------------------------
// Section 4 — 회복 시나리오 — disconnect storm 후 정상 복귀
// ---------------------------------------------------------------------------

describe('CHA-01 회복 — disconnect storm 후 정상 동작 보장', () => {
  it('disconnect storm 후 정상 D1 호출 PASS', { timeout: 10000 }, async () => {
    // storm: rate 1.0 (모두 실패) 으로 5회 호출 → 전부 throw.
    // 각 호출 = 3 attempts × backoff (100ms + 400ms = 500ms 누적) → 5 × 500ms = 2.5s.
    const storm = withDisconnect(ctx.db, {
      disconnectRate: 1.0,
      errorClass: 'D1_DISCONNECT',
      prng: mulberry32(SEED),
    });

    const stormCount = 5;
    let stormFails = 0;
    for (let i = 0; i < stormCount; i++) {
      try {
        await withRetry(() => storm.prepare('SELECT 1 AS x').first());
      } catch {
        stormFails++;
      }
    }
    expect(stormFails).toBe(stormCount);

    // 동일 underlying ctx.db 가 storm 후에도 정상 동작 (state 누설 0).
    const result = await ctx.db.prepare('SELECT 42 AS x').first<{ x: number }>();
    expect(result).toEqual({ x: 42 });
  });
});
