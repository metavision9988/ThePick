/**
 * CostMeter 단위 테스트 — AC-CM-1 ~ AC-CM-5 + 4-Pass 리뷰 보강 시나리오
 *
 * 근거:
 *   - docs/plans/engine-hardening/step1-cost-meter.plan.md §"검증 계획"
 *   - .claude/reviews/review-20260427-194529-step1-cost-meter-4pass.md
 *
 * 보강 항목 (CRITICAL 3건 + MAJOR 7건 수정 후):
 *   - autoEnforce 기본값 false 검증
 *   - KillSwitchError 기본 throw 검증 (caller catch 패턴)
 *   - 단발 거대 호출 시 SOFT/HARD/KILL 누적 발화 (Pass 4 반론)
 *   - NaN/Infinity/non-integer 토큰 입력 거부 (P1-M3)
 *   - 정수 마이크로센트 누적 정밀도 (P1-M2)
 *   - initialSpend 옵션 (P2-M2 Idempotency 인계)
 *   - autoEnforce=true 시 onKillSwitch 호출 검증
 */

import { describe, expect, it, vi } from 'vitest';
import { CostMeter, DEFAULT_THRESHOLDS, KillSwitchError } from '../src/cost-meter.js';

const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
// claude-pricing.ts 기준 (ADR-025 v1.1 정정 후 이 단가 채택):
//   Haiku $1.0 input / $5.0 output per 1M tokens
//   → 1M input + 1M output = $6.00

function newMeter(overrides: Partial<ConstructorParameters<typeof CostMeter>[0]> = {}) {
  return new CostMeter({
    batchRunId: 'test-run-001',
    dailyBudgetUsd: 10,
    // autoEnforce 기본값 false (안전) — production 에서만 명시 true + onKillSwitch 주입
    ...overrides,
  });
}

describe('CostMeter — AC-CM-1: token accounting accuracy', () => {
  it('records input/output tokens cumulatively', () => {
    const meter = newMeter();
    meter.start();

    meter.recordTokens(1_000_000, 1_000_000, MODEL_HAIKU, 'batch_structurize');
    expect(meter.getCurrentSpend()).toBeCloseTo(6.0, 6);

    meter.recordTokens(500_000, 200_000, MODEL_HAIKU, 'batch_structurize');
    // 0.5M * $1 + 0.2M * $5 = $0.5 + $1.0 = $1.5
    expect(meter.getCurrentSpend()).toBeCloseTo(7.5, 6);

    const report = meter.finalize();
    expect(report.total_input_tokens).toBe(1_500_000);
    expect(report.total_output_tokens).toBe(1_200_000);
    expect(report.total_cost_usd).toBeCloseTo(7.5, 6);
    expect(report.call_count).toBe(2);
  });

  it('aggregates per-model usage independently', () => {
    const meter = newMeter();
    meter.start();
    meter.recordTokens(100_000, 50_000, MODEL_HAIKU, 'batch_structurize');
    meter.recordTokens(100_000, 50_000, 'claude-sonnet-4-6', 'vision_ocr');

    const report = meter.finalize();
    expect(Object.keys(report.per_model)).toEqual(
      expect.arrayContaining([MODEL_HAIKU, 'claude-sonnet-4-6']),
    );
    expect(report.per_model[MODEL_HAIKU]?.inputTokens).toBe(100_000);
    expect(report.per_model['claude-sonnet-4-6']?.inputTokens).toBe(100_000);
  });

  it('integer micro-USD accumulation has zero floating-point drift', () => {
    const meter = newMeter({ dailyBudgetUsd: 100 });
    meter.start();
    // 1토큰 호출 1000번 — 부동소수점 누적 오차 발생 가능 케이스
    for (let i = 0; i < 1000; i++) {
      meter.recordTokens(1, 1, MODEL_HAIKU, 'micro_call');
    }
    // 1토큰 input ($0.000001) + 1토큰 output ($0.000005) = $0.000006 × 1000 = $0.006
    const report = meter.finalize();
    // 정수 누적이라 정확 — 0.006 USD 정확히 일치
    expect(report.total_cost_usd).toBe(0.006);
    expect(report.total_input_tokens).toBe(1000);
    expect(report.total_output_tokens).toBe(1000);
  });
});

describe('CostMeter — AC-CM-2: soft warn at 70%', () => {
  it('fires SOFT_WARN at >= 70% of budget', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const meter = newMeter({ dailyBudgetUsd: 10 });
    meter.start();

    // 0.6M output = $3 (30%)
    let status = meter.recordTokens(0, 600_000, MODEL_HAIKU, 'stage_a');
    expect(status).toBe('ok');

    // +0.8M output = +$4 (총 $7 = 70%)
    status = meter.recordTokens(0, 800_000, MODEL_HAIKU, 'stage_b');
    expect(status).toBe('soft_warn');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SOFT_WARN'));
    warnSpy.mockRestore();
  });

  it('fires SOFT_WARN only once even after multiple calls in soft range', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const meter = newMeter({ dailyBudgetUsd: 10 });
    meter.start();

    meter.recordTokens(0, 1_400_000, MODEL_HAIKU, 's'); // $7 = 70%
    meter.recordTokens(0, 100_000, MODEL_HAIKU, 's'); // $7.5
    meter.recordTokens(0, 100_000, MODEL_HAIKU, 's'); // $8.0

    const softWarns = warnSpy.mock.calls.filter((c) => String(c[0]).includes('SOFT_WARN'));
    expect(softWarns).toHaveLength(1);

    const report = meter.finalize();
    const softBreaches = report.threshold_breaches.filter((b) => b.threshold === 'soft_warn');
    expect(softBreaches).toHaveLength(1);
    warnSpy.mockRestore();
  });
});

describe('CostMeter — AC-CM-3: hard throttle at 90%', () => {
  it('fires HARD_THROTTLE at >= 90% of budget', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const meter = newMeter({ dailyBudgetUsd: 10 });
    meter.start();

    // $9 = 90%: 1.8M output
    const status = meter.recordTokens(0, 1_800_000, MODEL_HAIKU, 's');
    expect(status).toBe('hard_throttle');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('HARD_THROTTLE'));
    warnSpy.mockRestore();
  });

  it('applyThrottle() sleeps the configured duration', async () => {
    const meter = newMeter({ throttleSleepMs: 50 });
    meter.start();
    const before = Date.now();
    await meter.applyThrottle();
    const elapsed = Date.now() - before;
    expect(elapsed).toBeGreaterThanOrEqual(45); // OS jitter 허용
  });

  it('caller pattern: status check + applyThrottle await', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const meter = newMeter({ dailyBudgetUsd: 10, throttleSleepMs: 30 });
    meter.start();

    const status = meter.recordTokens(0, 1_800_000, MODEL_HAIKU, 's'); // 90%
    expect(status).toBe('hard_throttle');

    // caller 가 await applyThrottle 패턴
    if (status === 'hard_throttle') {
      const before = Date.now();
      await meter.applyThrottle();
      expect(Date.now() - before).toBeGreaterThanOrEqual(25);
    }
    warnSpy.mockRestore();
  });
});

describe('CostMeter — AC-CM-4: kill switch at 100%', () => {
  it('autoEnforce=false (default): returns kill_switch status without throw', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const meter = newMeter({ dailyBudgetUsd: 10 });
    meter.start();

    const status = meter.recordTokens(0, 2_000_000, MODEL_HAIKU, 's'); // $10
    expect(status).toBe('kill_switch');
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('KILL_SWITCH'));
    errSpy.mockRestore();
  });

  it('autoEnforce=true with default onKillSwitch: throws KillSwitchError', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const meter = newMeter({ dailyBudgetUsd: 10, autoEnforce: true });
    meter.start();

    expect(() => meter.recordTokens(0, 2_000_000, MODEL_HAIKU, 's')).toThrow(KillSwitchError);
    errSpy.mockRestore();
  });

  it('autoEnforce=true with custom onKillSwitch: invokes hook (never returns)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const flushHook = vi.fn();
    const meter = newMeter({
      dailyBudgetUsd: 10,
      autoEnforce: true,
      onKillSwitch: () => {
        flushHook();
        throw new Error('CHECKPOINT_FLUSHED');
      },
    });
    meter.start();

    expect(() => meter.recordTokens(0, 2_000_000, MODEL_HAIKU, 's')).toThrow(/CHECKPOINT_FLUSHED/);
    expect(flushHook).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it('caller catch pattern: KillSwitchError → finalize() → cleanup', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const meter = newMeter({ dailyBudgetUsd: 10, autoEnforce: true });
    meter.start();
    meter.recordTokens(100_000, 50_000, MODEL_HAIKU, 'normal_stage'); // 정상 호출

    let report;
    try {
      meter.recordTokens(0, 2_000_000, MODEL_HAIKU, 'kill_stage');
    } catch (e) {
      expect(e).toBeInstanceOf(KillSwitchError);
      // caller 는 catch 후 finalize 가능 — CostReport 보존
      report = meter.finalize();
    }
    expect(report).toBeDefined();
    expect(report?.threshold_breaches.length).toBeGreaterThanOrEqual(3);
    expect(report?.threshold_breaches.map((b) => b.threshold)).toEqual(
      expect.arrayContaining(['soft_warn', 'hard_throttle', 'kill_switch']),
    );
    errSpy.mockRestore();
  });
});

describe('CostMeter — AC-CM-5: finalize report', () => {
  it('returns a complete CostReport', () => {
    const clock = vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(5000);
    const meter = newMeter({ clock });
    meter.start();
    meter.recordTokens(1000, 500, MODEL_HAIKU, 'stage_a');
    meter.recordTokens(2000, 1000, MODEL_HAIKU, 'stage_b');

    const report = meter.finalize();

    expect(report.batch_run_id).toBe('test-run-001');
    expect(report.daily_budget_usd).toBe(10);
    expect(report.initial_spend_usd).toBe(0);
    expect(report.total_input_tokens).toBe(3000);
    expect(report.total_output_tokens).toBe(1500);
    expect(report.call_count).toBe(2);
    expect(report.duration_ms).toBe(4000);
    expect(report.final_status).toBe('ok');
    expect(report.threshold_breaches).toEqual([]);
  });

  it('finalize() before start() throws', () => {
    const meter = newMeter();
    expect(() => meter.finalize()).toThrow(/before start/);
  });
});

describe('CostMeter — Pass 4 반론: 단발 거대 호출 (SOFT/HARD/KILL 누적 발화)', () => {
  it('single huge call at 150% records all 3 breaches in order', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const meter = newMeter({ dailyBudgetUsd: 10 });
    meter.start();

    // 단발 호출로 150% 도달: 3M output = $15
    const status = meter.recordTokens(0, 3_000_000, MODEL_HAIKU, 'huge_call');
    expect(status).toBe('kill_switch');

    const report = meter.finalize();
    const breachTypes = report.threshold_breaches.map((b) => b.threshold);
    expect(breachTypes).toEqual(['soft_warn', 'hard_throttle', 'kill_switch']);

    // 모두 같은 stage 에서 발생
    expect(report.threshold_breaches.every((b) => b.stage === 'huge_call')).toBe(true);
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });
});

describe('CostMeter — P1-M3: NaN/Infinity/non-integer rejection', () => {
  it('rejects negative tokens', () => {
    const meter = newMeter();
    meter.start();
    expect(() => meter.recordTokens(-1, 0, MODEL_HAIKU, 's')).toThrow(/Invalid tokens/);
  });

  it('rejects NaN tokens', () => {
    const meter = newMeter();
    meter.start();
    expect(() => meter.recordTokens(NaN, 0, MODEL_HAIKU, 's')).toThrow(/Invalid tokens/);
    expect(() => meter.recordTokens(0, NaN, MODEL_HAIKU, 's')).toThrow(/Invalid tokens/);
  });

  it('rejects Infinity tokens', () => {
    const meter = newMeter();
    meter.start();
    expect(() => meter.recordTokens(Infinity, 0, MODEL_HAIKU, 's')).toThrow(/Invalid tokens/);
  });

  it('rejects non-integer tokens (float)', () => {
    const meter = newMeter();
    meter.start();
    expect(() => meter.recordTokens(1.5, 0, MODEL_HAIKU, 's')).toThrow(/Invalid tokens/);
  });

  it('throws on recordTokens() before start()', () => {
    const meter = newMeter();
    expect(() => meter.recordTokens(100, 100, MODEL_HAIKU, 's')).toThrow(/before start/);
  });
});

describe('CostMeter — P2-M2: initialSpendUsd (recover/resume support)', () => {
  it('inherits initial spend from previous run', () => {
    const meter = newMeter({ dailyBudgetUsd: 10, initialSpendUsd: 5.0 });
    meter.start();
    expect(meter.getCurrentSpend()).toBe(5.0);

    meter.recordTokens(0, 200_000, MODEL_HAIKU, 's'); // +$1
    expect(meter.getCurrentSpend()).toBeCloseTo(6.0, 6);

    const report = meter.finalize();
    expect(report.initial_spend_usd).toBe(5.0);
    expect(report.total_cost_usd).toBeCloseTo(6.0, 6);
  });

  it('rejects negative initialSpend', () => {
    expect(() => newMeter({ initialSpendUsd: -1 })).toThrow(/initialSpendUsd/);
  });

  it('rejects non-finite initialSpend', () => {
    expect(() => newMeter({ initialSpendUsd: NaN })).toThrow(/initialSpendUsd/);
  });

  it('triggers SOFT immediately if initial spend already at threshold', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const meter = newMeter({ dailyBudgetUsd: 10, initialSpendUsd: 7.5 }); // 75%
    meter.start();
    // 첫 호출만으로 SOFT 도달
    const status = meter.recordTokens(0, 100_000, MODEL_HAIKU, 's'); // +$0.5
    expect(status).toBe('soft_warn');
    warnSpy.mockRestore();
  });
});

describe('CostMeter — invariants', () => {
  it('rejects invalid thresholds (soft >= hard)', () => {
    expect(() =>
      newMeter({
        thresholds: { soft: 0.9, hard: 0.9, kill: 1.0 },
      }),
    ).toThrow(/Invalid thresholds/);
  });

  it('rejects budget <= 0', () => {
    expect(() => newMeter({ dailyBudgetUsd: 0 })).toThrow(/must be > 0/);
  });

  it('rejects non-finite budget', () => {
    expect(() => newMeter({ dailyBudgetUsd: NaN })).toThrow(/must be > 0/);
  });

  it('rejects double start()', () => {
    const meter = newMeter();
    meter.start();
    expect(() => meter.start()).toThrow(/start\(\) called twice/);
  });

  it('default thresholds are 0.7 / 0.9 / 1.0', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ soft: 0.7, hard: 0.9, kill: 1.0 });
  });

  it('autoEnforce default is false (safe)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const meter = newMeter({ dailyBudgetUsd: 10 });
    meter.start();
    // 기본값 false 라 throw 안 함, status 만 반환
    const status = meter.recordTokens(0, 2_000_000, MODEL_HAIKU, 's');
    expect(status).toBe('kill_switch');
    errSpy.mockRestore();
  });
});

describe('CostMeter — TokenLogger integration', () => {
  it('forwards records to logger when provided', () => {
    const sink = vi.fn();
    const records: unknown[] = [];
    const logger = {
      record: (input: {
        batchId: string;
        model: string;
        inputTokens: number;
        outputTokens: number;
        retries: number;
        stopReason: string | null;
        stage: string;
        error?: string | null;
      }) => {
        records.push(input);
        sink();
        return {
          ts: '',
          batchId: input.batchId,
          model: input.model,
          modelDisplay: '',
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          costUsd: 0,
          pricingFallback: false,
          retries: input.retries,
          stopReason: input.stopReason,
          stage: input.stage,
          error: input.error ?? null,
        };
      },
    };

    const meter = newMeter({ logger });
    meter.start();
    meter.recordTokens(100, 50, MODEL_HAIKU, 'stage_x');
    meter.recordTokens(200, 100, MODEL_HAIKU, 'stage_y');

    expect(sink).toHaveBeenCalledTimes(2);
    expect(records).toHaveLength(2);
  });
});
