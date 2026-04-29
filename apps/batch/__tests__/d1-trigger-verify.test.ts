/**
 * d1-trigger-verify.test.ts — AC-R6 + AC-T3 + AC-RP-6 (Step 11.6 §7).
 *
 * 검증 범위:
 *   - AC-R6: 0015 batch_runs 트리거 5건 (T1~T5)
 *   - AC-T3: batch_runs state transition matrix
 *   - AC-RP-6: 0016 knowledge_nodes backfill 트리거 invariant
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'migrations');

function loadMigration(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf-8');
}

function runSql(db: DatabaseType, sql: string): void {
  db.exec(sql);
}

function setupBatchRunsDb(): DatabaseType {
  const db = new Database(':memory:');
  runSql(db, loadMigration('0015_batch_runs.sql'));
  return db;
}

function insertRun(
  db: DatabaseType,
  args: {
    readonly batchRunId: string;
    readonly state: 'in_progress' | 'completed' | 'failed' | 'recovered' | 'killed';
    readonly startedAtIso?: string;
    readonly lastCompletedStage?: string;
    readonly engineVersion?: string;
    readonly stateHash?: string;
    readonly fixturePath?: string;
    readonly completedAtIso?: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO batch_runs (
      batch_run_id, started_at, completed_at, last_completed_stage,
      last_node_id, state, resume_count, fixture_path, state_hash, engine_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    args.batchRunId,
    args.startedAtIso ?? new Date().toISOString(),
    args.completedAtIso ?? null,
    args.lastCompletedStage ?? 'pdf_extract',
    null,
    args.state,
    0,
    args.fixturePath ?? '<test>',
    args.stateHash ?? '',
    args.engineVersion ?? '0.1.0',
  );
}

function readState(db: DatabaseType, batchRunId: string): string | null {
  const row = db.prepare('SELECT state FROM batch_runs WHERE batch_run_id = ?').get(batchRunId) as
    | { state: string }
    | undefined;
  return row?.state ?? null;
}

describe('AC-R6: 0015 batch_runs 트리거 — T1~T5 발화', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = setupBatchRunsDb();
  });

  afterEach(() => {
    db.close();
  });

  it('T1: completed 재INSERT → trg_batch_runs_no_duplicate_completed → ABORT', () => {
    insertRun(db, {
      batchRunId: 't1-run',
      state: 'completed',
      completedAtIso: new Date().toISOString(),
    });

    expect(() =>
      insertRun(db, {
        batchRunId: 't1-run',
        state: 'in_progress',
      }),
    ).toThrow(/cannot re-insert completed/);
  });

  it('T2: completed → in_progress UPDATE → trg_batch_runs_no_state_downgrade → ABORT', () => {
    insertRun(db, {
      batchRunId: 't2-run',
      state: 'completed',
      completedAtIso: new Date().toISOString(),
    });

    expect(() =>
      db
        .prepare('UPDATE batch_runs SET state = ? WHERE batch_run_id = ?')
        .run('in_progress', 't2-run'),
    ).toThrow(/cannot transition out of completed/);

    expect(readState(db, 't2-run')).toBe('completed');
  });

  it('T3: stale 24h+ in_progress → recovered → ALLOW (B-C3 정정 의도)', () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    insertRun(db, {
      batchRunId: 't3-run',
      state: 'in_progress',
      startedAtIso: stale,
    });

    expect(() =>
      db
        .prepare('UPDATE batch_runs SET state = ? WHERE batch_run_id = ?')
        .run('recovered', 't3-run'),
    ).not.toThrow();

    expect(readState(db, 't3-run')).toBe('recovered');
  });

  it('T4: killed → recovered UPDATE → ALLOW (recover 정상 경로)', () => {
    insertRun(db, { batchRunId: 't4-run', state: 'killed' });

    expect(() =>
      db
        .prepare('UPDATE batch_runs SET state = ? WHERE batch_run_id = ?')
        .run('recovered', 't4-run'),
    ).not.toThrow();

    expect(readState(db, 't4-run')).toBe('recovered');
  });

  it('T5: completed → recovered UPDATE → trg_batch_runs_recover_only_from_non_completed → ABORT', () => {
    insertRun(db, {
      batchRunId: 't5-run',
      state: 'completed',
      completedAtIso: new Date().toISOString(),
    });

    expect(() =>
      db
        .prepare('UPDATE batch_runs SET state = ? WHERE batch_run_id = ?')
        .run('recovered', 't5-run'),
    ).toThrow(/cannot recover completed run|cannot transition out of completed/);

    expect(readState(db, 't5-run')).toBe('completed');
  });

  it('idempotency: 동일 0015 SQL 두 번 실행 → DROP TRIGGER IF EXISTS 안전망 (P0-SA-M2)', () => {
    expect(() => runSql(db, loadMigration('0015_batch_runs.sql'))).not.toThrow();
  });
});

describe('AC-T3: batch_runs state transition matrix — 차단 + 허용 sample', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = setupBatchRunsDb();
  });

  afterEach(() => {
    db.close();
  });

  it('completed → in_progress 차단', () => {
    insertRun(db, {
      batchRunId: 'm-1',
      state: 'completed',
      completedAtIso: new Date().toISOString(),
    });
    expect(() =>
      db
        .prepare('UPDATE batch_runs SET state = ? WHERE batch_run_id = ?')
        .run('in_progress', 'm-1'),
    ).toThrow();
  });

  it('completed → failed 차단', () => {
    insertRun(db, {
      batchRunId: 'm-2',
      state: 'completed',
      completedAtIso: new Date().toISOString(),
    });
    expect(() =>
      db.prepare('UPDATE batch_runs SET state = ? WHERE batch_run_id = ?').run('failed', 'm-2'),
    ).toThrow();
  });

  it('completed → killed 차단 (trg_batch_runs_no_state_downgrade)', () => {
    // plan §7 AC-T3 매트릭스 ❌ 5건 중 4번째 — completed 에서 killed 로 downgrade 차단
    insertRun(db, {
      batchRunId: 'm-3',
      state: 'completed',
      completedAtIso: new Date().toISOString(),
    });
    expect(() =>
      db.prepare('UPDATE batch_runs SET state = ? WHERE batch_run_id = ?').run('killed', 'm-3'),
    ).toThrow(/cannot transition out of completed/);
  });

  it('completed → completed idempotent UPDATE 허용', () => {
    insertRun(db, {
      batchRunId: 'm-4',
      state: 'completed',
      completedAtIso: new Date().toISOString(),
    });
    expect(() =>
      db.prepare('UPDATE batch_runs SET state = ? WHERE batch_run_id = ?').run('completed', 'm-4'),
    ).not.toThrow();
  });

  it('failed → completed 허용 (재시도 정상 흐름)', () => {
    insertRun(db, { batchRunId: 'm-5', state: 'failed' });
    expect(() =>
      db.prepare('UPDATE batch_runs SET state = ? WHERE batch_run_id = ?').run('completed', 'm-5'),
    ).not.toThrow();
  });

  it('killed → recovered 허용 (T4 동등)', () => {
    insertRun(db, { batchRunId: 'm-6', state: 'killed' });
    expect(() =>
      db.prepare('UPDATE batch_runs SET state = ? WHERE batch_run_id = ?').run('recovered', 'm-6'),
    ).not.toThrow();
  });

  it('in_progress → killed 허용 (SIGINT 정상 경로)', () => {
    insertRun(db, { batchRunId: 'm-7', state: 'in_progress' });
    expect(() =>
      db.prepare('UPDATE batch_runs SET state = ? WHERE batch_run_id = ?').run('killed', 'm-7'),
    ).not.toThrow();
  });
});

describe('AC-RP-6: 0016 knowledge_nodes backfill 트리거 — 핵심 invariant', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = new Database(':memory:');
    runSql(
      db,
      `CREATE TABLE knowledge_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        lv1_insurance TEXT,
        lv2_crop TEXT,
        lv3_investigation TEXT,
        page_ref TEXT,
        batch_id TEXT,
        version_year INTEGER NOT NULL,
        superseded_by TEXT,
        truth_weight INTEGER NOT NULL DEFAULT 5,
        status TEXT DEFAULT 'draft',
        exam_scope TEXT,
        is_current_active INTEGER DEFAULT 1,
        batch_run_id TEXT,
        source_id TEXT
      );`,
    );
    runSql(
      db,
      `CREATE TRIGGER prevent_knowledge_nodes_update
       BEFORE UPDATE ON knowledge_nodes
       WHEN NEW.id IS NOT OLD.id
         OR NEW.type IS NOT OLD.type
         OR NEW.name IS NOT OLD.name
         OR NEW.description IS NOT OLD.description
         OR NEW.lv1_insurance IS NOT OLD.lv1_insurance
         OR NEW.lv2_crop IS NOT OLD.lv2_crop
         OR NEW.lv3_investigation IS NOT OLD.lv3_investigation
         OR NEW.page_ref IS NOT OLD.page_ref
         OR NEW.batch_id IS NOT OLD.batch_id
         OR NEW.version_year IS NOT OLD.version_year
         OR NEW.superseded_by IS NOT OLD.superseded_by
         OR NEW.truth_weight IS NOT OLD.truth_weight
         OR NEW.status IS NOT OLD.status
         OR NEW.exam_scope IS NOT OLD.exam_scope
         OR (OLD.batch_run_id IS NOT NULL AND NEW.batch_run_id IS NOT OLD.batch_run_id)
         OR (OLD.source_id IS NOT NULL AND NEW.source_id IS NOT OLD.source_id)
       BEGIN
         SELECT RAISE(ABORT, 'UPDATE on knowledge_nodes body columns is forbidden (Hard Rule 1, Temporal Graph). Use INSERT + SUPERSEDES edge pattern. Only is_current_active flip and (batch_run_id/source_id) NULL->value backfill (1회) allowed.');
       END;`,
    );
    db.prepare(
      `INSERT INTO knowledge_nodes (id, type, name, version_year, batch_run_id, source_id)
       VALUES ('CONCEPT-001', 'CONCEPT', '테스트 노드', 2026, NULL, NULL)`,
    ).run();
  });

  afterEach(() => {
    db.close();
  });

  it('NULL → 값 backfill UPDATE 허용', () => {
    expect(() =>
      db
        .prepare('UPDATE knowledge_nodes SET batch_run_id = ?, source_id = ? WHERE id = ?')
        .run('run-001', 'p403#CONCEPT-001', 'CONCEPT-001'),
    ).not.toThrow();

    const row = db
      .prepare('SELECT batch_run_id, source_id FROM knowledge_nodes WHERE id = ?')
      .get('CONCEPT-001') as { batch_run_id: string; source_id: string };
    expect(row.batch_run_id).toBe('run-001');
    expect(row.source_id).toBe('p403#CONCEPT-001');
  });

  it('값 → 다른 값 UPDATE 차단 (Hard Rule 1)', () => {
    db.prepare('UPDATE knowledge_nodes SET batch_run_id = ?, source_id = ? WHERE id = ?').run(
      'run-001',
      'p403#CONCEPT-001',
      'CONCEPT-001',
    );

    expect(() =>
      db
        .prepare('UPDATE knowledge_nodes SET batch_run_id = ? WHERE id = ?')
        .run('run-002', 'CONCEPT-001'),
    ).toThrow(/forbidden/);
  });

  it('값 → NULL UPDATE 차단', () => {
    db.prepare('UPDATE knowledge_nodes SET batch_run_id = ?, source_id = ? WHERE id = ?').run(
      'run-001',
      'p403#CONCEPT-001',
      'CONCEPT-001',
    );

    expect(() =>
      db.prepare('UPDATE knowledge_nodes SET batch_run_id = NULL WHERE id = ?').run('CONCEPT-001'),
    ).toThrow(/forbidden/);
  });

  it('name UPDATE 차단 (회귀 — 본문 컬럼 보호)', () => {
    expect(() =>
      db.prepare('UPDATE knowledge_nodes SET name = ? WHERE id = ?').run('변경', 'CONCEPT-001'),
    ).toThrow(/forbidden/);
  });
});
