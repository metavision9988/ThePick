/**
 * cost-meter-pipeline-kill.test.ts — AC-Cost (Step 11.6 §7)
 *
 * 검증 범위:
 *   1. CostMeter.toCheckpointCostState() 7 케이스 — recover 시 initial_spend_usd 누적 + breaches 직렬화
 *   2. Pipeline kill switch → onKillSwitch 콜백 → checkpoint flush 통합 (AC-Cost)
 *
 * 본 파일은 cost-meter.test.ts 31 케이스의 보완 — 단위 cost 회계 검증은 그쪽,
 * 본 파일은 Step 11.6 통합 (checkpoint cost_state 인계 + onKillSwitch flush) 만 담당.
 *
 * 근거:
 *   - docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md §7 AC-Cost
 *   - .claude/reviews/midpoint-20260428-p0fix-quality.md Q-C1 (toCheckpointCostState 7 케이스)
 */

import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CostMeter, KillSwitchError } from '../src/cost-meter';
import { writeCheckpointSync, buildCheckpoint, checkpointPath } from '../src/checkpoint';
import type { PipelineStateSnapshot } from '../src/checkpoint';
import { PIPELINE_STAGES } from '../src/pipeline';

const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
// pricing: Haiku $1/1M input + $5/1M output. 1M+1M = $6.

const TEST_ENGINE_VERSION = '0.1.0';

function snapshotForStage(): PipelineStateSnapshot {
  return {
    last_inserted_node_id: null,
    last_completed_stage: 'batch_structurize',
    nodes_processed: 0,
    edges_processed: 0,
    stage_results: Object.fromEntries(
      PIPELINE_STAGES.map((s) => [s, { status: 'pending', durationMs: 0 }]),
    ) as PipelineStateSnapshot['stage_results'],
  };
}

describe('CostMeter.toCheckpointCostState — 7 케이스 직렬화', () => {
  it('Case 1: fresh meter (start 전) → spend=0 + call_count=0 + breaches 0건', () => {
    const meter = new CostMeter({ batchRunId: 'cs-1', dailyBudgetUsd: 10 });
    const snap = meter.toCheckpointCostState();
    expect(snap.initial_spend_usd).toBe(0);
    expect(snap.call_count).toBe(0);
    expect(snap.threshold_breaches).toEqual([]);
  });

  it('Case 2: start() 직후 (record 0건) → 동일 (spend=0 + breaches 0)', () => {
    const meter = new CostMeter({ batchRunId: 'cs-2', dailyBudgetUsd: 10 });
    meter.start();
    const snap = meter.toCheckpointCostState();
    expect(snap.initial_spend_usd).toBe(0);
    expect(snap.call_count).toBe(0);
    expect(snap.threshold_breaches).toEqual([]);
  });

  it('Case 3: soft 미만 1회 호출 → breaches 0건 + call_count=1 + spend>0', () => {
    const meter = new CostMeter({ batchRunId: 'cs-3', dailyBudgetUsd: 100 });
    meter.start();
    meter.recordTokens(100_000, 50_000, MODEL_HAIKU, 'batch_structurize');
    // 0.1M * $1 + 0.05M * $5 = $0.35 (< 70% of $100)
    const snap = meter.toCheckpointCostState();
    expect(snap.call_count).toBe(1);
    expect(snap.initial_spend_usd).toBeCloseTo(0.35, 6);
    expect(snap.threshold_breaches).toEqual([]);
  });

  it('Case 4: soft 임계 도달 → breaches 1건 (soft_warn)', () => {
    // soft=0.7, budget=$10 → soft 임계 = $7. Haiku 1M+1M = $6. 1.2M+1.2M = $7.2.
    const meter = new CostMeter({ batchRunId: 'cs-4', dailyBudgetUsd: 10 });
    meter.start();
    meter.recordTokens(1_200_000, 1_200_000, MODEL_HAIKU, 'batch_structurize');
    const snap = meter.toCheckpointCostState();
    expect(snap.call_count).toBe(1);
    expect(snap.threshold_breaches.length).toBeGreaterThanOrEqual(1);
    const labels = snap.threshold_breaches.map((b) => b.threshold);
    expect(labels).toContain('soft_warn');
  });

  it('Case 5: hard 임계 도달 (단발 거대 호출) → breaches 2건 (soft + hard)', () => {
    // hard=0.9, budget=$10 → hard 임계 = $9. 1.5M+1.5M = $9.0.
    const meter = new CostMeter({ batchRunId: 'cs-5', dailyBudgetUsd: 10 });
    meter.start();
    meter.recordTokens(1_500_000, 1_500_000, MODEL_HAIKU, 'batch_structurize');
    const snap = meter.toCheckpointCostState();
    const labels = snap.threshold_breaches.map((b) => b.threshold);
    expect(labels).toContain('soft_warn');
    expect(labels).toContain('hard_throttle');
  });

  it('Case 6: kill 임계 도달 (autoEnforce=false) → breaches 3건 + throw 없음', () => {
    // kill=1.0, budget=$10 → kill 임계 = $10. 1.7M+1.7M = $10.2.
    const meter = new CostMeter({
      batchRunId: 'cs-6',
      dailyBudgetUsd: 10,
      autoEnforce: false,
    });
    meter.start();
    const status = meter.recordTokens(1_700_000, 1_700_000, MODEL_HAIKU, 'batch_structurize');
    expect(status).toBe('kill_switch'); // status 반환 (autoEnforce=false 라 throw X)
    const snap = meter.toCheckpointCostState();
    const labels = snap.threshold_breaches.map((b) => b.threshold);
    expect(labels).toContain('soft_warn');
    expect(labels).toContain('hard_throttle');
    expect(labels).toContain('kill_switch');
  });

  it('Case 7: initialSpendUsd>0 (recover 시나리오) → initial_spend_usd 가 누적 spend 반영', () => {
    // 직전 BATCH 가 $5.0 spend 후 kill — recover 시 initialSpendUsd=5 주입.
    const meter = new CostMeter({
      batchRunId: 'cs-7-resume',
      dailyBudgetUsd: 10,
      initialSpendUsd: 5.0,
    });
    meter.start();
    // 본 인스턴스 추가 spend $0.35
    meter.recordTokens(100_000, 50_000, MODEL_HAIKU, 'batch_structurize');
    const snap = meter.toCheckpointCostState();
    // initial_spend_usd 는 getCurrentSpend() — initialSpend 5 + 추가 0.35 = 5.35
    expect(snap.initial_spend_usd).toBeCloseTo(5.35, 6);
    expect(snap.call_count).toBe(1);
  });
});

describe('CostMeter — pipeline kill switch → checkpoint flush 통합 (AC-Cost)', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'thepick-cost-'));
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('autoEnforce=true + dailyBudgetUsd=극소 → onKillSwitch 가 checkpoint flush 후 throw', () => {
    const batchRunId = randomUUID();

    let flushedCheckpoint = false;
    let recordedCostStateAtFlush: ReturnType<CostMeter['toCheckpointCostState']> | null = null;

    // production-like onKillSwitch: checkpoint flush 후 throw (caller catch 가 finalize 처리)
    const meter: CostMeter = new CostMeter({
      batchRunId,
      dailyBudgetUsd: 0.001, // 즉시 kill 도달
      autoEnforce: true,
      onKillSwitch: (): never => {
        // pipeline 통합: 마지막 snapshot + cost_state 를 checkpoint 로 flush
        recordedCostStateAtFlush = meter.toCheckpointCostState();
        const cp = buildCheckpoint({
          batchRunId,
          engineVersion: TEST_ENGINE_VERSION,
          currentStage: 'batch_structurize',
          currentStageIndex: PIPELINE_STAGES.indexOf('batch_structurize'),
          totalStages: PIPELINE_STAGES.length,
          snapshot: snapshotForStage(),
          costState: recordedCostStateAtFlush,
        });
        writeCheckpointSync(cp, outDir, { fsync: false });
        flushedCheckpoint = true;
        throw new KillSwitchError(batchRunId, meter.getCurrentSpend(), 0.001);
      },
    });
    meter.start();

    // recordTokens → ratio >> 1 → autoEnforce=true → onKillSwitch never 진입
    expect(() => meter.recordTokens(100_000, 100_000, MODEL_HAIKU, 'batch_structurize')).toThrow(
      KillSwitchError,
    );

    expect(flushedCheckpoint).toBe(true);

    // checkpoint 파일 존재 + cost_state 직렬화 일관
    const cpRaw = readFileSync(checkpointPath(outDir, batchRunId), 'utf-8');
    const cp = JSON.parse(cpRaw);
    expect(cp.batch_run_id).toBe(batchRunId);
    expect(cp.cost_state).toBeDefined();
    expect(cp.cost_state.initial_spend_usd).toBeCloseTo(meter.getCurrentSpend(), 6);
    const labels = (cp.cost_state.threshold_breaches as { threshold: string }[]).map(
      (b) => b.threshold,
    );
    expect(labels).toContain('kill_switch');

    // recordedCostStateAtFlush snapshot 일관 — flush 시점 spend 와 동일
    expect(recordedCostStateAtFlush).not.toBeNull();
    expect(recordedCostStateAtFlush!.threshold_breaches.map((b) => b.threshold)).toContain(
      'kill_switch',
    );
  });
});
