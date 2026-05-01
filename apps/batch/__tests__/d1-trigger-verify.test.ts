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

/**
 * Step 16c 진입 게이트 ②/③/⑤ 흡수 — 0016 마이그레이션 직접 로드 적용 후
 * 컬럼/인덱스 존재 검증 + partial UNIQUE 동작 + `<no_page>` fallback silent 진입.
 *
 * 기존 'AC-RP-6: 0016 knowledge_nodes backfill 트리거' describe 는 inline schema +
 * inline trigger 로 4건 backfill 시나리오만 검증. 본 describe 는 실제 0016 마이그레이션
 * 파일 (PART 1 ALTER TABLE + PART 2 CREATE INDEX + PART 3 DROP/CREATE TRIGGER) 를
 * 그대로 적용하여 production 환경 정합성 검증.
 */
describe('AC-RP-6 추가: 0016 마이그레이션 직접 적용 검증 (Step 16c 게이트 ②/③/⑤)', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = new Database(':memory:');

    // 0001 발췌 — 0014/0016 트리거가 참조하는 컬럼 모두 포함 (batch_run_id/source_id 제외).
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
        is_current_active INTEGER DEFAULT 1
      );`,
    );

    // 0014 prevent_knowledge_nodes_update 트리거 (batch_run_id/source_id 미포함 v0).
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
       BEGIN
         SELECT RAISE(ABORT, 'UPDATE on knowledge_nodes body columns is forbidden (Hard Rule 1, Temporal Graph). Use INSERT + SUPERSEDES edge pattern. Only is_current_active may change (Materialized Active View).');
       END;`,
    );

    // 0016 마이그레이션 직접 로드 (production 정합성 검증).
    runSql(db, loadMigration('0016_knowledge_nodes_batch_idempotency.sql'));
  });

  afterEach(() => {
    db.close();
  });

  it('게이트 ②: knowledge_nodes 컬럼 batch_run_id + source_id 존재 (PRAGMA)', () => {
    const cols = db.prepare(`PRAGMA table_info(knowledge_nodes)`).all() as Array<{
      name: string;
      type: string;
    }>;
    const colNames = cols.map((c) => c.name);
    expect(colNames).toContain('batch_run_id');
    expect(colNames).toContain('source_id');
    expect(cols.find((c) => c.name === 'batch_run_id')?.type).toBe('TEXT');
    expect(cols.find((c) => c.name === 'source_id')?.type).toBe('TEXT');
  });

  it('게이트 ②: idx_knowledge_nodes_batch_source partial UNIQUE 인덱스 존재', () => {
    const indexes = db.prepare(`PRAGMA index_list(knowledge_nodes)`).all() as Array<{
      name: string;
      unique: number;
      partial: number;
    }>;
    const target = indexes.find((idx) => idx.name === 'idx_knowledge_nodes_batch_source');
    expect(target).toBeDefined();
    expect(target?.unique).toBe(1);
    // partial=1 — 0016 의 `WHERE batch_run_id IS NOT NULL` 절 보존 검증.
    expect(target?.partial).toBe(1);
  });

  it('게이트 ②: idx_knowledge_nodes_batch_run_id 단독 인덱스 존재 (recover row scan 방어)', () => {
    const indexes = db.prepare(`PRAGMA index_list(knowledge_nodes)`).all() as Array<{
      name: string;
    }>;
    expect(indexes.some((idx) => idx.name === 'idx_knowledge_nodes_batch_run_id')).toBe(true);
  });

  it('게이트 ③: partial UNIQUE — batch_run_id IS NULL 다중 허용', () => {
    // 동일 source_id 라도 batch_run_id NULL 이면 partial 제외 → UNIQUE 미발화.
    const insert = db.prepare(
      `INSERT INTO knowledge_nodes (id, type, name, version_year, batch_run_id, source_id)
       VALUES (?, 'CONCEPT', '노드', 2026, NULL, ?)`,
    );
    expect(() => insert.run('NODE-A', 'p403#NODE-A')).not.toThrow();
    expect(() => insert.run('NODE-B', 'p403#NODE-A')).not.toThrow();
    expect(() => insert.run('NODE-C', 'p403#NODE-A')).not.toThrow();

    const count = db.prepare(`SELECT COUNT(*) AS c FROM knowledge_nodes`).get() as { c: number };
    expect(count.c).toBe(3);
  });

  it('게이트 ③: partial UNIQUE — 동일 (batch_run_id, source_id) 충돌 차단', () => {
    db.prepare(
      `INSERT INTO knowledge_nodes (id, type, name, version_year, batch_run_id, source_id)
       VALUES (?, 'CONCEPT', '노드', 2026, ?, ?)`,
    ).run('CONCEPT-001', 'run-001', 'p403#CONCEPT-001');

    expect(() =>
      db
        .prepare(
          `INSERT INTO knowledge_nodes (id, type, name, version_year, batch_run_id, source_id)
           VALUES (?, 'CONCEPT', '중복', 2026, ?, ?)`,
        )
        .run('CONCEPT-002', 'run-001', 'p403#CONCEPT-001'),
    ).toThrow(/UNIQUE constraint failed.*batch_run_id.*source_id/);
  });

  it('게이트 ③: partial UNIQUE — 다른 batch_run_id, 동일 source_id 비충돌 (Temporal Graph 정합)', () => {
    // 다른 BATCH 실행에서 같은 source 의 새 버전 노드 INSERT 가능 (SUPERSEDES 패턴).
    const insert = db.prepare(
      `INSERT INTO knowledge_nodes (id, type, name, version_year, batch_run_id, source_id)
       VALUES (?, 'CONCEPT', '노드', 2026, ?, ?)`,
    );
    expect(() => insert.run('CONCEPT-001', 'run-001', 'p403#CONCEPT-001')).not.toThrow();
    expect(() => insert.run('CONCEPT-001-v2', 'run-002', 'p403#CONCEPT-001')).not.toThrow();
  });

  it('게이트 ⑤: `<no_page>` fallback silent 진입 시나리오 — 다른 nodeId 비충돌', () => {
    // fixture seed / migration replay 경로에서 source_page=null 진입 시 fallback
    // `<no_page>#nodeId` 사용. 다른 nodeId 두 개는 다른 source_id 라 충돌 0건.
    const insert = db.prepare(
      `INSERT INTO knowledge_nodes (id, type, name, version_year, batch_run_id, source_id)
       VALUES (?, 'CONCEPT', '노드', 2026, ?, ?)`,
    );
    expect(() => insert.run('CONCEPT-A', 'run-001', '<no_page>#CONCEPT-A')).not.toThrow();
    expect(() => insert.run('CONCEPT-B', 'run-001', '<no_page>#CONCEPT-B')).not.toThrow();

    const rows = db
      .prepare(`SELECT id, source_id FROM knowledge_nodes ORDER BY id`)
      .all() as Array<{ id: string; source_id: string }>;
    expect(rows).toHaveLength(2);
    expect(rows[0].source_id).toBe('<no_page>#CONCEPT-A');
    expect(rows[1].source_id).toBe('<no_page>#CONCEPT-B');
  });

  it('게이트 ⑤: `<no_page>` fallback — 동일 nodeId 두 번 충돌 차단 (Year 2 import path 안전망)', () => {
    // 동일 BATCH + 동일 nodeId 두 번 fallback 진입 시 source_id 충돌. partial UNIQUE 가
    // Year 2 import path 의 silent 중복 적재 차단.
    db.prepare(
      `INSERT INTO knowledge_nodes (id, type, name, version_year, batch_run_id, source_id)
       VALUES (?, 'CONCEPT', '노드', 2026, ?, ?)`,
    ).run('CONCEPT-A', 'run-001', '<no_page>#CONCEPT-A');

    expect(() =>
      db
        .prepare(
          `INSERT INTO knowledge_nodes (id, type, name, version_year, batch_run_id, source_id)
           VALUES (?, 'CONCEPT', '중복', 2026, ?, ?)`,
        )
        .run('CONCEPT-A-DUP', 'run-001', '<no_page>#CONCEPT-A'),
    ).toThrow(/UNIQUE constraint failed/);
  });

  it('idempotency: 0016 PART 2 (인덱스) + PART 3 (트리거) 부분 재실행 안전', () => {
    // 0016 전체는 ALTER TABLE 포함이라 두 번 실행 불가 (SQLite ALTER 는 IF NOT EXISTS 미지원,
    // 실제 환경에서는 drizzle-kit 등 마이그레이션 도구가 ID 기반으로 idempotent 보장).
    // 본 테스트는 PART 2/3 (DROP TRIGGER IF EXISTS + CREATE TRIGGER + CREATE INDEX IF NOT EXISTS)
    // 만 추출해 두 번째 실행 안전성 검증.
    //
    // ★ 본 idempotentParts 는 0016 PART 3 의 simplified representation (4-Pass P1-M1):
    //   실제 0016 PART 3 트리거는 14개 WHEN 조건 (id/type/name/description/lv1_insurance/
    //   lv2_crop/lv3_investigation/page_ref/batch_id/version_year/superseded_by/truth_weight/
    //   status/exam_scope + batch_run_id + source_id) 을 포함하나, 본 인라인 버전은 5개
    //   조건 (id/type/name/batch_run_id/source_id) 만 사용. full trigger 14개 조건의
    //   재실행 안전성은 migrations/0016 자체가 `DROP TRIGGER IF EXISTS` + `CREATE INDEX
    //   IF NOT EXISTS` 패턴으로 보장 — 본 테스트는 idempotent SQL 패턴이 SQLite 에서
    //   동작함을 검증할 뿐, 0016 트리거 본문 14개 조건 모두를 재검증하지는 않는다.
    //   기존 게이트 ④ 4 tests (`AC-RP-6: 0016 knowledge_nodes backfill 트리거 — 핵심 invariant`)
    //   가 본문 14개 조건의 핵심 분기를 별도로 검증.
    const idempotentParts = `
      DROP TRIGGER IF EXISTS prevent_knowledge_nodes_update;
      CREATE TRIGGER prevent_knowledge_nodes_update
      BEFORE UPDATE ON knowledge_nodes
      WHEN NEW.id IS NOT OLD.id
        OR NEW.type IS NOT OLD.type
        OR NEW.name IS NOT OLD.name
        OR (OLD.batch_run_id IS NOT NULL AND NEW.batch_run_id IS NOT OLD.batch_run_id)
        OR (OLD.source_id IS NOT NULL AND NEW.source_id IS NOT OLD.source_id)
      BEGIN
        SELECT RAISE(ABORT, 'forbidden');
      END;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_nodes_batch_source
        ON knowledge_nodes(batch_run_id, source_id)
        WHERE batch_run_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_batch_run_id
        ON knowledge_nodes(batch_run_id);
    `;
    expect(() => runSql(db, idempotentParts)).not.toThrow();
  });
});
