/**
 * CHA-04 — Wall clock skew (시계 ±10분) chaos 테스트.
 *
 * 근거:
 *   - Master Plan v1.0 §CHA-04 (BATCH state machine + checkpoint timestamp 정합)
 *   - test-patterns.md §1 (vi.useFakeTimers / vi.setSystemTime 정합 패턴)
 *   - handoff-031 §2.A (Sprint 1 §5.3 NOT-IMPL 3건 진입)
 *
 * 합격 기준 매핑 (Master Plan §CHA-04):
 *   (a) batch_runs.elapsed 음수 시 abs() 처리 → recover.ts:186 `Math.max(0, ...)` 검증
 *   (b) recover.ts Q1 "elapsed < 24h" 가드 통과 → STALE_LOCK_THRESHOLD_MS 임계 검증
 *   (c) checkpoint timestamp 가 미래라도 거부 안 함 → checkpoint.ts 비검증 정책 검증
 *
 * 본 시점 적용 범위 (정직 명시):
 *   - recover.ts 의 Math.max(0, ...) 가드는 commit b1d8a... (handoff 028) 도입 — 본 테스트는
 *     해당 가드의 회귀 방어 + 미테스트 케이스 (skew +N분 / -N분 / catch-up) 추가.
 *   - 24h 가드 검증은 기존 recover.test.ts AC-R4 (1시간 / 48시간 stale lock) 정합 — 본 테스트는
 *     fake timer 시간 진행 시뮬레이션 (vi.advanceTimersByTime) 추가.
 *   - checkpoint.ts 의 timestamp 비검증 정책은 코드 부재로 자동 PASS — 본 테스트는 정책 회귀
 *     방어 (timestamp 미래 → 정상 복구).
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXAM_IDS } from '@thepick/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCheckpoint,
  STALE_LOCK_THRESHOLD_MS,
  writeCheckpoint,
  type PipelineStateSnapshot,
} from '../src/checkpoint.js';
import { recoverBatch, type BatchRunRow, type BatchRunsDb } from '../src/recover.js';
import type { PipelineStage } from '../src/pipeline.js';

const TEST_EXAM_ID = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

const ALL_STAGES: PipelineStage[] = [
  'pdf_extract',
  'section_split',
  'vision_ocr',
  'batch_structurize',
  'constants_extract',
  'db_load',
  'integrity_check',
  'human_review',
  'formula_verify',
  'qg2_gate',
];

function emptyStageResults(): PipelineStateSnapshot['stage_results'] {
  return Object.fromEntries(
    ALL_STAGES.map((s) => [s, { status: 'pending' as const, durationMs: 0 }]),
  ) as PipelineStateSnapshot['stage_results'];
}

function snapshotAtStage(stage: PipelineStage, nodes: number = 30): PipelineStateSnapshot {
  return {
    last_inserted_node_id: `CONCEPT-${String(nodes).padStart(3, '0')}`,
    last_completed_stage: stage,
    nodes_processed: nodes,
    edges_processed: nodes * 3,
    stage_results: emptyStageResults(),
  };
}

function makeMockDb(initialRow?: BatchRunRow | null): BatchRunsDb & {
  updateCalls: { batchRunId: string; update: object }[];
} {
  const updateCalls: { batchRunId: string; update: object }[] = [];
  let currentRow = initialRow ?? null;
  return {
    async selectByRunId(_examId, batchRunId) {
      return currentRow && currentRow.batch_run_id === batchRunId ? currentRow : null;
    },
    async updateState(_examId, batchRunId, update) {
      updateCalls.push({ batchRunId, update });
      if (currentRow && currentRow.batch_run_id === batchRunId) {
        currentRow = {
          ...currentRow,
          state: update.state,
          resume_count: currentRow.resume_count + (update.resume_count_increment ?? 0),
        };
      }
    },
    updateCalls,
  };
}

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'thepick-cha04-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  vi.useRealTimers(); // test-patterns.md §1.1 의무 — 다음 테스트 누설 방지
});

// ---------------------------------------------------------------------------
// Section 1 — clock skew + (시계가 미래로 점프, started_at 가 미래로 보임)
// ---------------------------------------------------------------------------

describe('CHA-04 (a) — skew +10min, elapsed 음수 → Math.max(0) 가드', () => {
  it('Date.now() < started_at 시 elapsed=0 → concurrent_run 블록 유지', async () => {
    vi.useFakeTimers();
    // 현재 시각 = 10:00:00, started_at = 10:10:00 (미래 — NTP skew 시뮬레이션)
    vi.setSystemTime(new Date('2026-05-02T10:00:00Z'));

    const db = makeMockDb({
      batch_run_id: 'BATCH-1-skew-future',
      started_at: '2026-05-02T10:10:00Z', // 10분 미래
      completed_at: null,
      last_completed_stage: 'db_load',
      last_node_id: 'CONCEPT-030',
      state: 'in_progress',
      resume_count: 0,
      fixture_path: 'fixtures/batch1/test.pdf',
      state_hash: 'abc',
      engine_version: '0.1.0',
    });

    const result = await recoverBatch({
      examId: TEST_EXAM_ID,
      batchRunId: 'BATCH-1-skew-future',
      baseDir: tempDir,
      currentEngineVersion: '0.1.0',
      batchRunsDb: db,
    });

    // Math.max(0, ...) 가드로 elapsed=0 < 24h → concurrent_run_detected (정상)
    expect(result.status).toBe('concurrent_run_detected');
    expect(result.user_notification_required).toBe(true);
    // BATCH 좀비 상태 미발생 (started_at 미래라도 graceful 응답).
  });
});

// ---------------------------------------------------------------------------
// Section 2 — clock catch-up — fake timer 시간 진행 후 24h 임계
// ---------------------------------------------------------------------------

describe('CHA-04 (b) — clock catch-up, 24h 임계 정합', () => {
  it('vi.advanceTimersByTime(24h+1s) 후 stale lock 통과 → 정상 복구', async () => {
    vi.useFakeTimers();
    // 시뮬레이션: BATCH 시작 후 23h 경과 → 아직 lock active
    const startTime = new Date('2026-05-02T00:00:00Z');
    vi.setSystemTime(startTime);

    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-catchup',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: snapshotAtStage('db_load'),
    });
    await writeCheckpoint(cp, tempDir);

    const db = makeMockDb({
      batch_run_id: 'BATCH-1-catchup',
      started_at: startTime.toISOString(),
      completed_at: null,
      last_completed_stage: 'db_load',
      last_node_id: 'CONCEPT-030',
      state: 'in_progress',
      resume_count: 0,
      fixture_path: 'fixtures/batch1/test.pdf',
      state_hash: cp.state_hash,
      engine_version: '0.1.0',
    });

    // T+0: lock active → concurrent_run_detected
    const t0Result = await recoverBatch({
      examId: TEST_EXAM_ID,
      batchRunId: 'BATCH-1-catchup',
      baseDir: tempDir,
      currentEngineVersion: '0.1.0',
      batchRunsDb: db,
    });
    expect(t0Result.status).toBe('concurrent_run_detected');

    // 24시간 + 1초 진행 → stale lock 통과
    vi.advanceTimersByTime(STALE_LOCK_THRESHOLD_MS + 1000);

    const t24Result = await recoverBatch({
      examId: TEST_EXAM_ID,
      batchRunId: 'BATCH-1-catchup',
      baseDir: tempDir,
      currentEngineVersion: '0.1.0',
      batchRunsDb: db,
    });
    expect(t24Result.status).toBe('fully_recovered');
  });

  it('staleLockThresholdMs 옵션으로 동적 한도 주입 가능 (테스트 격리)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-02T01:00:00Z'));

    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-custom-threshold',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: snapshotAtStage('db_load'),
    });
    await writeCheckpoint(cp, tempDir);

    const db = makeMockDb({
      batch_run_id: 'BATCH-1-custom-threshold',
      started_at: '2026-05-02T00:00:00Z', // 1시간 전
      completed_at: null,
      last_completed_stage: 'db_load',
      last_node_id: 'CONCEPT-030',
      state: 'in_progress',
      resume_count: 0,
      fixture_path: 'fixtures/batch1/test.pdf',
      state_hash: cp.state_hash,
      engine_version: '0.1.0',
    });

    // 30분 한도 주입 → 1시간 경과 = stale lock 통과
    const result = await recoverBatch({
      examId: TEST_EXAM_ID,
      batchRunId: 'BATCH-1-custom-threshold',
      baseDir: tempDir,
      currentEngineVersion: '0.1.0',
      batchRunsDb: db,
      staleLockThresholdMs: 30 * 60 * 1000,
    });
    expect(result.status).toBe('fully_recovered');
  });
});

// ---------------------------------------------------------------------------
// Section 3 — checkpoint timestamp 미래 → 거부 안 함 (정책 회귀 방어)
// ---------------------------------------------------------------------------

describe('CHA-04 (c) — checkpoint timestamp 미래 → 거부 안 함', () => {
  it('checkpoint.timestamp 가 현재 시각보다 1시간 미래여도 정상 복구', async () => {
    vi.useFakeTimers();
    // 현재 시각 = 10:00:00, checkpoint 작성 시각 = 11:00:00 (미래 = clock skew 산출물)
    vi.setSystemTime(new Date('2026-05-02T11:00:00Z'));

    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-future-ts',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: snapshotAtStage('db_load'),
    });
    // checkpoint.ts:170 의 clock 옵션 미주입 → new Date() 사용 → timestamp = 11:00:00
    expect(cp.timestamp).toBe('2026-05-02T11:00:00.000Z');
    await writeCheckpoint(cp, tempDir);

    // 현재 시각을 10:00:00 으로 되돌림 (NTP 보정 시뮬레이션)
    vi.setSystemTime(new Date('2026-05-02T10:00:00Z'));

    const db = makeMockDb({
      batch_run_id: 'BATCH-1-future-ts',
      started_at: '2026-05-02T09:00:00Z',
      completed_at: null,
      last_completed_stage: 'db_load',
      last_node_id: 'CONCEPT-030',
      state: 'recovered',
      resume_count: 0,
      fixture_path: 'fixtures/batch1/test.pdf',
      state_hash: cp.state_hash,
      engine_version: '0.1.0',
    });

    const result = await recoverBatch({
      examId: TEST_EXAM_ID,
      batchRunId: 'BATCH-1-future-ts',
      baseDir: tempDir,
      currentEngineVersion: '0.1.0',
      batchRunsDb: db,
    });

    // checkpoint.timestamp 가 미래 (11:00) > 현재 (10:00) 여도 fully_recovered.
    // checkpoint.ts 는 timestamp 비교 검증 미수행 → 정책 회귀 방어.
    expect(result.status).toBe('fully_recovered');
  });
});

// ---------------------------------------------------------------------------
// Section 4 — 다중 skew 시나리오 (Master Plan §CHA-04 시나리오 정합)
// ---------------------------------------------------------------------------

describe('CHA-04 — Master Plan 시나리오 정합 (T=0 / T=600s -10분 / T=900s 정상)', () => {
  it('T=0 시작 / T=600s 시계 -10분 점프 / T=900s 정상 → recover 정상 동작', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-02T10:00:00Z'));

    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-multi-skew',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: snapshotAtStage('db_load'),
    });
    await writeCheckpoint(cp, tempDir);

    const db = makeMockDb({
      batch_run_id: 'BATCH-1-multi-skew',
      started_at: '2026-05-02T10:00:00Z', // T=0
      completed_at: null,
      last_completed_stage: 'db_load',
      last_node_id: 'CONCEPT-030',
      state: 'killed', // 이미 killed 상태 — concurrent_run 블록 우회
      resume_count: 0,
      fixture_path: 'fixtures/batch1/test.pdf',
      state_hash: cp.state_hash,
      engine_version: '0.1.0',
    });

    // T=600s: 시계 -10분 점프 (T+600s 인데 시계는 T+0 으로 후퇴)
    vi.advanceTimersByTime(600 * 1000); // T=10:10:00
    vi.setSystemTime(new Date('2026-05-02T10:00:00Z')); // -10분 점프 → T=10:00:00

    // T=900s 정상: 시계 +15분
    vi.setSystemTime(new Date('2026-05-02T10:15:00Z'));

    const result = await recoverBatch({
      examId: TEST_EXAM_ID,
      batchRunId: 'BATCH-1-multi-skew',
      baseDir: tempDir,
      currentEngineVersion: '0.1.0',
      batchRunsDb: db,
    });

    // state=killed → concurrent_run 블록 미적용. checkpoint 통과 → fully_recovered.
    expect(result.status).toBe('fully_recovered');
    expect(result.checkpoint).toBeDefined();
  });
});
