/**
 * recover.ts 단위 테스트 — AC-R1 ~ AC-R5
 *
 * 시나리오:
 *   - AC-R1: OOM 부활 (50% 진행 → kill → recover → fully_recovered)
 *   - AC-R2: 체크포인트 변조 → recovery_failed
 *   - AC-R3: 동일 batch_run_id 재실행 (state='completed') → already_completed
 *   - AC-R4: 동시 실행 (state='in_progress' < 24h) → concurrent_run_detected
 *   - AC-R5: engine_version major 불일치 → recovery_failed
 *   - 추가: stale lock (state='in_progress' > 24h) → 정상 복구 허용
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXAM_IDS } from '@thepick/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCheckpoint,
  checkpointPath,
  writeCheckpoint,
  type BatchCheckpoint,
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
  tempDir = await mkdtemp(join(tmpdir(), 'thepick-recover-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  vi.useRealTimers();
});

describe('recoverBatch — AC-R1: OOM 부활 (50% 진행)', () => {
  it('fully_recovered when checkpoint is valid', async () => {
    // 50% 진행 (Stage 5/10 = db_load 완료) checkpoint 작성
    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-oom',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: snapshotAtStage('db_load', 30),
    });
    await writeCheckpoint(cp, tempDir);

    const db = makeMockDb({
      batch_run_id: 'BATCH-1-oom',
      started_at: '2026-04-27T19:00:00Z',
      completed_at: null,
      last_completed_stage: 'db_load',
      last_node_id: 'CONCEPT-030',
      state: 'killed',
      resume_count: 0,
      fixture_path: 'fixtures/batch1/test.pdf',
      state_hash: cp.state_hash,
      engine_version: '0.1.0',
    });

    const result = await recoverBatch({
      examId: TEST_EXAM_ID,
      batchRunId: 'BATCH-1-oom',
      baseDir: tempDir,
      currentEngineVersion: '0.1.0',
      batchRunsDb: db,
    });

    expect(result.status).toBe('fully_recovered');
    expect(result.resumed_from_stage).toBe('db_load');
    expect(result.data_loss_estimate.severity).toBe('none');
    expect(result.data_loss_estimate.nodes_lost).toBe(0);
    expect(result.user_notification_required).toBe(false);
    expect(result.checkpoint).toBeDefined();
    expect(result.checkpoint?.batch_run_id).toBe('BATCH-1-oom');

    // batch_runs.state 가 'recovered' 로 갱신
    expect(db.updateCalls).toHaveLength(1);
    expect(db.updateCalls[0]?.update).toMatchObject({
      state: 'recovered',
      resume_count_increment: 1,
    });
  });
});

describe('recoverBatch — AC-R2: 체크포인트 변조', () => {
  it('recovery_failed with critical severity on tampered checkpoint', async () => {
    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-tamper',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: snapshotAtStage('db_load'),
    });
    await writeCheckpoint(cp, tempDir);

    // 외부에서 변조
    const filePath = checkpointPath(tempDir, 'BATCH-1-tamper');
    const raw = JSON.parse(await readFile(filePath, 'utf8')) as BatchCheckpoint;
    const tampered = {
      ...raw,
      pipeline_state_snapshot: {
        ...raw.pipeline_state_snapshot,
        nodes_processed: 9999,
      },
    };
    await writeFile(filePath, JSON.stringify(tampered, null, 2), 'utf8');

    const db = makeMockDb({
      batch_run_id: 'BATCH-1-tamper',
      started_at: '2026-04-27T19:00:00Z',
      completed_at: null,
      last_completed_stage: 'db_load',
      last_node_id: 'CONCEPT-030',
      state: 'killed',
      resume_count: 0,
      fixture_path: 'fixtures/batch1/test.pdf',
      state_hash: cp.state_hash,
      engine_version: '0.1.0',
    });

    const result = await recoverBatch({
      examId: TEST_EXAM_ID,
      batchRunId: 'BATCH-1-tamper',
      baseDir: tempDir,
      currentEngineVersion: '0.1.0',
      batchRunsDb: db,
    });

    expect(result.status).toBe('recovery_failed');
    expect(result.data_loss_estimate.severity).toBe('critical');
    expect(result.fallback_strategy).toBe('manual_review_required');
    expect(result.user_notification_required).toBe(true);
    expect(result.message).toContain('무결성 검증 실패');

    // recovery_failed 시에는 batch_runs.state 갱신 안 함
    expect(db.updateCalls).toHaveLength(0);
  });
});

describe('recoverBatch — AC-R3: 동일 batch_run_id (state=completed)', () => {
  it('already_completed (skip, no INSERT)', async () => {
    const db = makeMockDb({
      batch_run_id: 'BATCH-1-done',
      started_at: '2026-04-27T19:00:00Z',
      completed_at: '2026-04-27T19:30:00Z',
      last_completed_stage: 'qg2_gate',
      last_node_id: 'CONCEPT-060',
      state: 'completed',
      resume_count: 0,
      fixture_path: 'fixtures/batch1/test.pdf',
      state_hash: 'abc123',
      engine_version: '0.1.0',
    });

    const result = await recoverBatch({
      examId: TEST_EXAM_ID,
      batchRunId: 'BATCH-1-done',
      baseDir: tempDir,
      currentEngineVersion: '0.1.0',
      batchRunsDb: db,
    });

    expect(result.status).toBe('already_completed');
    expect(result.data_loss_estimate.severity).toBe('none');
    expect(result.user_notification_required).toBe(false);
    expect(db.updateCalls).toHaveLength(0);
  });
});

describe('recoverBatch — AC-R4: 동시 실행 (concurrent)', () => {
  it('concurrent_run_detected when state=in_progress and < 24h', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T20:00:00Z'));

    const db = makeMockDb({
      batch_run_id: 'BATCH-1-conc',
      started_at: '2026-04-27T19:00:00Z', // 1시간 전
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
      batchRunId: 'BATCH-1-conc',
      baseDir: tempDir,
      currentEngineVersion: '0.1.0',
      batchRunsDb: db,
    });

    expect(result.status).toBe('concurrent_run_detected');
    expect(result.user_notification_required).toBe(true);
    expect(result.message).toContain('다른 인스턴스가 실행 중');
    expect(db.updateCalls).toHaveLength(0);
  });

  it('stale lock — recovers normally when state=in_progress > 24h', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T20:00:00Z'));

    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-stale',
      engineVersion: '0.1.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: snapshotAtStage('db_load'),
    });
    await writeCheckpoint(cp, tempDir);

    const db = makeMockDb({
      batch_run_id: 'BATCH-1-stale',
      started_at: '2026-04-27T19:00:00Z', // 48시간 전 — stale
      completed_at: null,
      last_completed_stage: 'db_load',
      last_node_id: 'CONCEPT-030',
      state: 'in_progress',
      resume_count: 0,
      fixture_path: 'fixtures/batch1/test.pdf',
      state_hash: cp.state_hash,
      engine_version: '0.1.0',
    });

    const result = await recoverBatch({
      examId: TEST_EXAM_ID,
      batchRunId: 'BATCH-1-stale',
      baseDir: tempDir,
      currentEngineVersion: '0.1.0',
      batchRunsDb: db,
    });

    // stale lock 통과 후 정상 복구
    expect(result.status).toBe('fully_recovered');
  });
});

describe('recoverBatch — AC-R5: engine_version major 불일치', () => {
  it('recovery_failed with manual_review_required', async () => {
    const cp = buildCheckpoint({
      batchRunId: 'BATCH-1-ver',
      engineVersion: '1.0.0',
      currentStage: 'db_load',
      currentStageIndex: 6,
      totalStages: 10,
      snapshot: snapshotAtStage('db_load'),
    });
    await writeCheckpoint(cp, tempDir);

    const db = makeMockDb({
      batch_run_id: 'BATCH-1-ver',
      started_at: '2026-04-27T19:00:00Z',
      completed_at: null,
      last_completed_stage: 'db_load',
      last_node_id: 'CONCEPT-030',
      state: 'killed',
      resume_count: 0,
      fixture_path: 'fixtures/batch1/test.pdf',
      state_hash: cp.state_hash,
      engine_version: '1.0.0',
    });

    const result = await recoverBatch({
      examId: TEST_EXAM_ID,
      batchRunId: 'BATCH-1-ver',
      baseDir: tempDir,
      currentEngineVersion: '2.0.0',
      batchRunsDb: db,
    });

    expect(result.status).toBe('recovery_failed');
    expect(result.fallback_strategy).toBe('manual_review_required');
    expect(result.user_notification_required).toBe(true);
    expect(result.message).toContain('엔진 버전 불일치');
    expect(result.message).toContain('Migration');
    expect(db.updateCalls).toHaveLength(0);
  });
});

describe('recoverBatch — checkpoint 파일 부재', () => {
  it('no_checkpoint with manual_review by default', async () => {
    const db = makeMockDb(null);

    const result = await recoverBatch({
      examId: TEST_EXAM_ID,
      batchRunId: 'BATCH-1-missing',
      baseDir: tempDir,
      currentEngineVersion: '0.1.0',
      batchRunsDb: db,
    });

    expect(result.status).toBe('no_checkpoint');
    expect(result.fallback_strategy).toBe('manual_review_required');
    expect(result.user_notification_required).toBe(true);
  });

  it('no_checkpoint with auto restart when option set', async () => {
    const db = makeMockDb(null);

    const result = await recoverBatch({
      examId: TEST_EXAM_ID,
      batchRunId: 'BATCH-1-auto',
      baseDir: tempDir,
      currentEngineVersion: '0.1.0',
      batchRunsDb: db,
      autoRestartOnNoCheckpoint: true,
    });

    expect(result.status).toBe('no_checkpoint');
    expect(result.fallback_strategy).toBe('restart');
    expect(result.message).toContain('자동 재시작');
  });
});
