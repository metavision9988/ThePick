/**
 * In-memory BatchRunsDb 어댑터 — dry-run / 통합 테스트 전용.
 *
 * 책임:
 *   1. batch_runs 테이블 SELECT/INSERT/UPDATE 의 메모리 시뮬레이션
 *   2. 0015 트리거 핵심 invariant 모방:
 *      - completed 재INSERT 차단 (trg_batch_runs_no_duplicate_completed)
 *      - completed → 다른 state 전이 차단 (trg_batch_runs_no_state_downgrade)
 *      - completed → recovered 차단 (trg_batch_runs_recover_only_from_non_completed)
 *   3. Hard Rule 16 정합 — 모든 메서드 첫 인자 examId (Year 1 한시 예외)
 *
 * 비스코프:
 *   - 24h stale lock 트리거 모방 (recover.ts application 레벨에서 처리)
 *   - 영구 저장 (process 종료 시 데이터 휘발 — 의도)
 *   - production 사용 (D1BatchRunsDb 사용 의무)
 *
 * 본 어댑터는 production-quality.md "인메모리 임시 저장 금지" 원칙의 예외 —
 * dry-run / 테스트 전용 명시 라벨링. real D1 DB가 없는 환경(dry-run, vitest)에서
 * runPipeline 의 batch_runs 메타테이블 동작을 검증한다.
 *
 * 근거:
 *   - migrations/0015_batch_runs.sql (트리거 3종 invariant)
 *   - docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md §3.3
 */

import type { ExamId } from '@thepick/shared';
import type { PipelineStage } from './pipeline.js';
import type { BatchRunRow, BatchRunState, BatchRunsDb } from './recover.js';

interface MutableRow {
  batch_run_id: string;
  started_at: string;
  completed_at: string | null;
  last_completed_stage: PipelineStage;
  last_node_id: string | null;
  state: BatchRunState;
  resume_count: number;
  fixture_path: string;
  state_hash: string;
  engine_version: string;
}

/**
 * 의도적 throw 시뮬레이션 — Q-MAJOR-B1-1 e2e (metaPersistenceFailures push 4 시점 검증).
 *
 * pipeline.ts 의 4 시점 (state='failed'/'completed'/'in_progress' UPDATE + SIGINT 'killed' UPDATE)
 * 에서 D1 단절 또는 0015 트리거 RAISE(ABORT) 가시화 검증을 위한 주입형 옵션.
 */
export interface InMemoryBatchRunsDbOptions {
  /** 시간 주입 — 기본: Date.now. AC-T3 stale 24h+ 시뮬레이션용. */
  readonly clock?: () => number;
  /**
   * updateState 호출 시 의도적 throw — 호출자 metaPersistenceFailures push 검증용.
   *
   * @param state 시도되는 다음 state
   * @returns true 면 해당 호출에서 throw, false 면 정상 진행.
   */
  readonly throwOnUpdate?: (state: BatchRunState) => boolean;
  /** insertNewRun 호출 시 의도적 throw — no_checkpoint 분기 무결성 검증용. */
  readonly throwOnInsert?: () => boolean;
}

export class InMemoryBatchRunsDb implements BatchRunsDb {
  private readonly rows = new Map<string, MutableRow>();
  private readonly clock: () => number;
  private readonly throwOnUpdate: ((state: BatchRunState) => boolean) | undefined;
  private readonly throwOnInsert: (() => boolean) | undefined;

  constructor(options: InMemoryBatchRunsDbOptions = {}) {
    this.clock = options.clock ?? (() => Date.now());
    this.throwOnUpdate = options.throwOnUpdate;
    this.throwOnInsert = options.throwOnInsert;
  }

  /** 테스트 헬퍼 — 현재 모든 행 스냅샷 (read-only). */
  snapshot(): readonly BatchRunRow[] {
    return Array.from(this.rows.values()).map((r) => ({ ...r }));
  }

  async selectByRunId(examId: ExamId, batchRunId: string): Promise<BatchRunRow | null> {
    void examId;
    const row = this.rows.get(batchRunId);
    return row ? { ...row } : null;
  }

  async insertNewRun(
    examId: ExamId,
    input: {
      readonly batchRunId: string;
      readonly fixturePath: string;
      readonly engineVersion: string;
    },
  ): Promise<void> {
    void examId;
    if (this.throwOnInsert?.()) {
      throw new Error('batch_runs: insertNewRun simulated failure (test injection)');
    }
    const existing = this.rows.get(input.batchRunId);
    if (existing && existing.state === 'completed') {
      throw new Error(
        'batch_runs: cannot re-insert completed batch_run_id (Idempotency violation)',
      );
    }
    this.rows.set(input.batchRunId, {
      batch_run_id: input.batchRunId,
      started_at: new Date(this.clock()).toISOString(),
      completed_at: null,
      last_completed_stage: 'pdf_extract',
      last_node_id: null,
      state: 'in_progress',
      resume_count: 0,
      fixture_path: input.fixturePath,
      state_hash: '',
      engine_version: input.engineVersion,
    });
  }

  async updateState(
    examId: ExamId,
    batchRunId: string,
    update: {
      state: BatchRunState;
      resume_count_increment?: number;
      last_completed_stage?: PipelineStage;
      last_node_id?: string | null;
      state_hash?: string;
      completed_at?: string | null;
    },
  ): Promise<void> {
    void examId;
    if (this.throwOnUpdate?.(update.state)) {
      throw new Error(
        `batch_runs: updateState simulated failure for state='${update.state}' (test injection)`,
      );
    }
    const row = this.rows.get(batchRunId);
    if (!row) {
      throw new Error(`batch_runs: row not found for batch_run_id=${batchRunId}`);
    }

    // 0015 트리거 invariant 모방
    if (row.state === 'completed' && update.state !== 'completed') {
      throw new Error(
        'batch_runs: cannot transition out of completed state (Idempotency violation)',
      );
    }
    if (row.state === 'completed' && update.state === 'recovered') {
      throw new Error('batch_runs: cannot recover completed run (Idempotency violation)');
    }

    row.state = update.state;
    if (update.resume_count_increment !== undefined) {
      row.resume_count += update.resume_count_increment;
    }
    if (update.last_completed_stage !== undefined) {
      row.last_completed_stage = update.last_completed_stage;
    }
    if (update.last_node_id !== undefined) {
      row.last_node_id = update.last_node_id;
    }
    if (update.state_hash !== undefined) {
      row.state_hash = update.state_hash;
    }
    if (update.completed_at !== undefined) {
      row.completed_at = update.completed_at;
    }
  }
}
