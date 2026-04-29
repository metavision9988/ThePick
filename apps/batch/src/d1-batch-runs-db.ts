/**
 * D1 batch_runs 어댑터 — recover.ts BatchRunsDb 인터페이스의 D1 구현체.
 *
 * @runtime Node.js (로컬 better-sqlite3 wrapper) 또는 Cloudflare Workers (D1).
 *   draft-loader.ts 의 D1Db 인터페이스에 맞춤 — `prepare/bind/run/first` 만 사용.
 *
 * 책임:
 *   1. batch_runs 테이블 SELECT/INSERT/UPDATE 의 SQL 발행
 *   2. 0015 트리거 발화 (RAISE(ABORT)) 를 throw 로 caller 에 전파 (silent failure 차단)
 *   3. Hard Rule 16 정합 — 모든 메서드 첫 인자 examId. Year 1 단일 시험이라
 *      내부 SQL 의 `WHERE exam_id = ?` 미주입이지만 시그니처 자체가 examId 포함.
 *      Year 2 Phase 4 (마이그레이션 0005, exam_id 컬럼 도입) 진입 시:
 *        - 본 파일 내부에서 SELECT/UPDATE 는 `AND exam_id = ?` 추가
 *        - INSERT 는 `exam_id` 컬럼 추가
 *        - 호출 측 코드 (pipeline.ts 등) 변경 0건 — zero-cost 전환
 *
 * 본 모듈은 batch_runs 테이블만 다룸. knowledge_nodes / formulas / constants 는
 * draft-loader.ts (Step 5 책임) 가 별도 어댑터로 처리.
 *
 * 근거:
 *   - docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md §4.4
 *   - migrations/0015_batch_runs.sql (batch_runs 스키마 + 트리거 3종)
 *   - .claude/rules/production-quality.md Hard Rule 16/17
 *   - .claude/reviews/midpoint-20260428-backend.md C-2
 */

import type { ExamId } from '@thepick/shared';
import type { D1Db } from './loader/draft-loader.js';
import type { PipelineStage } from './pipeline.js';
import type { BatchRunRow, BatchRunState, BatchRunsDb } from './recover.js';

export class D1BatchRunsDb implements BatchRunsDb {
  constructor(private readonly db: D1Db) {}

  async selectByRunId(examId: ExamId, batchRunId: string): Promise<BatchRunRow | null> {
    // Year 1: examId 미사용 (단일 시험). Year 2 Phase 4 진입 시 'AND exam_id = ?' 추가.
    void examId;
    const row = await this.db
      .prepare('SELECT * FROM batch_runs WHERE batch_run_id = ?')
      .bind(batchRunId)
      .first<BatchRunRow>();
    return row ?? null;
  }

  async insertNewRun(
    examId: ExamId,
    input: {
      readonly batchRunId: string;
      readonly fixturePath: string;
      readonly engineVersion: string;
    },
  ): Promise<void> {
    // Year 1: examId 미사용. Year 2 진입 시 INSERT 컬럼에 exam_id 추가.
    void examId;
    // 0015 BEFORE INSERT 트리거 (trg_batch_runs_no_duplicate_completed) 가
    // completed 재INSERT 시 RAISE(ABORT) — driver 가 throw 로 전파.
    await this.db
      .prepare(
        `INSERT INTO batch_runs
         (batch_run_id, started_at, last_completed_stage, state, resume_count, fixture_path, state_hash, engine_version)
         VALUES (?, ?, ?, 'in_progress', 0, ?, '', ?)`,
      )
      .bind(
        input.batchRunId,
        new Date().toISOString(),
        'pdf_extract' satisfies PipelineStage,
        input.fixturePath,
        input.engineVersion,
      )
      .run();
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
    // Year 1: examId 미사용. Year 2 진입 시 'AND exam_id = ?' 추가.
    void examId;

    const sets: string[] = ['state = ?'];
    const vals: unknown[] = [update.state];

    if (update.resume_count_increment !== undefined) {
      sets.push('resume_count = resume_count + ?');
      vals.push(update.resume_count_increment);
    }
    if (update.last_completed_stage !== undefined) {
      sets.push('last_completed_stage = ?');
      vals.push(update.last_completed_stage);
    }
    if (update.last_node_id !== undefined) {
      sets.push('last_node_id = ?');
      vals.push(update.last_node_id);
    }
    if (update.state_hash !== undefined) {
      sets.push('state_hash = ?');
      vals.push(update.state_hash);
    }
    if (update.completed_at !== undefined) {
      sets.push('completed_at = ?');
      vals.push(update.completed_at);
    }

    vals.push(batchRunId);
    // 0015 트리거 (trg_batch_runs_no_state_downgrade /
    // trg_batch_runs_recover_only_from_non_completed) 가 비정상 전이 시 RAISE(ABORT) —
    // driver 가 throw 로 전파.
    await this.db
      .prepare(`UPDATE batch_runs SET ${sets.join(', ')} WHERE batch_run_id = ?`)
      .bind(...vals)
      .run();
  }
}
