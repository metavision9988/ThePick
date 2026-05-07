/**
 * Session 052 5-Persona QE-C1 흡수 — 0024 D1 raw INSERT/SELECT 회귀 테스트.
 *
 * 목적:
 *   schema-validator unit test 통과 ≠ D1 CHECK 통과. 마이그레이션 0024 (pattern_type
 *   7→8 'H_nested') 효과를 raw D1 (node:sqlite + foreign_keys=ON) 위에서 직접 검증.
 *   silent dirty state 30% 위험 차단 (5-Persona Persona 3 quality 평가).
 *
 * 범위 (Phase 2A 진입 전 의무):
 *   1. 8 패턴 모두 INSERT 가능 — A_simple ~ H_nested
 *   2. 미허용 pattern_type ('Z_unknown') CHECK constraint 거부
 *   3. 0024 종착부 trigger 재생성 검증 — pattern_type UPDATE 차단
 *   4. table_cells value_type='nested_table' + nested_table_id roundtrip (0023 정합)
 *   5. 0026 trigger 3종 동작 (cells/headers/node_links UPDATE 차단)
 *
 * 의존성:
 *   - helpers/d1-from-sqlite.ts createD1FromAllMigrations() — 25 마이그레이션 자동 적용
 *   - 신규 의존성 0 (Node 22 내장 node:sqlite, vitest 기존)
 *
 * 근거: .claude/reviews/review-20260507-154747-session-052-5-persona-tech-debt.md QE-C1
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createD1FromAllMigrations, type SqliteBackedD1 } from '../helpers/d1-from-sqlite.js';

const PATTERN_TYPES = [
  'A_simple',
  'B_2level',
  'C_3level',
  'D_merged',
  'E_na',
  'F_formula',
  'G_temporal',
  'H_nested',
] as const;

describe('마이그레이션 0024 — table_structures.pattern_type CHECK 7→8 (H_nested 추가)', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(() => {
    backend = createD1FromAllMigrations();
  });

  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('8 패턴 모두 INSERT/SELECT roundtrip — A_simple ~ H_nested', async () => {
    if (!backend) throw new Error('backend not initialized');

    for (let i = 0; i < PATTERN_TYPES.length; i++) {
      const pattern = PATTERN_TYPES[i];
      const tblId = `TBL-${String(i + 1).padStart(3, '0')}`;
      await backend.db
        .prepare(
          `INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status)
           VALUES (?, NULL, ?, ?, 1, 1, 'manual:test', 'draft')`,
        )
        .bind(tblId, `테스트 ${pattern}`, pattern)
        .run();
    }

    const rows = await backend.db
      .prepare(`SELECT id, pattern_type FROM table_structures ORDER BY id`)
      .all<{ id: string; pattern_type: string }>();

    expect(rows.results.map((r) => r.pattern_type)).toEqual([...PATTERN_TYPES]);
  });

  it('CHECK constraint reject — pattern_type=Z_unknown INSERT 차단 (4-Pass CRIT-A 회귀)', async () => {
    if (!backend) throw new Error('backend not initialized');

    await expect(
      backend.db
        .prepare(
          `INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status)
           VALUES ('TBL-099', NULL, 'unknown', 'Z_unknown', 1, 1, 'manual:test', 'draft')`,
        )
        .run(),
    ).rejects.toThrow(/CHECK constraint/i);
  });

  it('CHECK constraint reject — id GLOB 위배 (TBL-1 단일 자릿수)', async () => {
    if (!backend) throw new Error('backend not initialized');

    await expect(
      backend.db
        .prepare(
          `INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status)
           VALUES ('TBL-1', NULL, 'invalid id', 'A_simple', 1, 1, 'manual:test', 'draft')`,
        )
        .run(),
    ).rejects.toThrow(/CHECK constraint/i);
  });

  it('CHECK constraint reject — row_count > 99 (BA-C3 한도 검증)', async () => {
    if (!backend) throw new Error('backend not initialized');

    await expect(
      backend.db
        .prepare(
          `INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status)
           VALUES ('TBL-100', NULL, 'overflow', 'A_simple', 100, 1, 'manual:test', 'draft')`,
        )
        .run(),
    ).rejects.toThrow(/CHECK constraint/i);
  });

  it('0024 trigger 재생성 — pattern_type UPDATE 차단 (Hard Rule 28)', async () => {
    if (!backend) throw new Error('backend not initialized');

    await backend.db
      .prepare(
        `INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status)
         VALUES ('TBL-001', NULL, 'immutable', 'A_simple', 1, 1, 'manual:test', 'draft')`,
      )
      .run();

    await expect(
      backend.db
        .prepare(`UPDATE table_structures SET pattern_type = 'H_nested' WHERE id = 'TBL-001'`)
        .run(),
    ).rejects.toThrow(/Hard Rule 28|immutable/);
  });

  it('0024 trigger 재생성 — title UPDATE 차단', async () => {
    if (!backend) throw new Error('backend not initialized');

    await backend.db
      .prepare(
        `INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status)
         VALUES ('TBL-002', NULL, '원제목', 'A_simple', 1, 1, 'manual:test', 'draft')`,
      )
      .run();

    await expect(
      backend.db
        .prepare(`UPDATE table_structures SET title = '바뀐제목' WHERE id = 'TBL-002'`)
        .run(),
    ).rejects.toThrow(/Hard Rule 28|immutable/);
  });

  it('0024 trigger 재생성 — status UPDATE 허용 (검수 워크플로우)', async () => {
    if (!backend) throw new Error('backend not initialized');

    await backend.db
      .prepare(
        `INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status)
         VALUES ('TBL-003', NULL, 'status flow', 'A_simple', 1, 1, 'manual:test', 'draft')`,
      )
      .run();

    await backend.db
      .prepare(`UPDATE table_structures SET status = 'active' WHERE id = 'TBL-003'`)
      .run();

    const row = await backend.db
      .prepare(`SELECT status FROM table_structures WHERE id = 'TBL-003'`)
      .first<{ status: string }>();
    expect(row?.status).toBe('active');
  });
});

describe('마이그레이션 0023 + 0024 — table_cells nested_table roundtrip', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(async () => {
    backend = createD1FromAllMigrations();

    // 부모 표 (H_nested) + 자식 표 (A_simple)
    await backend.db
      .prepare(
        `INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status)
         VALUES ('TBL-010', NULL, '별표9 부모', 'H_nested', 1, 1, 'manual:test', 'draft')`,
      )
      .run();
    await backend.db
      .prepare(
        `INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status)
         VALUES ('TBL-011', NULL, '중첩 자식', 'A_simple', 1, 1, 'manual:test', 'draft')`,
      )
      .run();
    // 행/열 헤더
    await backend.db
      .prepare(
        `INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text)
         VALUES ('TROW-010-01', 'TBL-010', 'row', 1, 1, NULL, '행 1')`,
      )
      .run();
    await backend.db
      .prepare(
        `INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text)
         VALUES ('TCOL-010-01', 'TBL-010', 'column', 1, 1, NULL, '열 1')`,
      )
      .run();
  });

  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('value_type=nested_table + nested_table_id roundtrip (D-PHASE2-7=α)', async () => {
    if (!backend) throw new Error('backend not initialized');

    await backend.db
      .prepare(
        `INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, nested_table_id)
         VALUES ('TCELL-010-01-01', 'TBL-010', 'TROW-010-01', 'TCOL-010-01', '중첩 표', 'nested_table', 'TBL-011')`,
      )
      .run();

    const row = await backend.db
      .prepare(
        `SELECT value_type, nested_table_id, value_text FROM table_cells WHERE id = 'TCELL-010-01-01'`,
      )
      .first<{ value_type: string; nested_table_id: string; value_text: string }>();

    expect(row?.value_type).toBe('nested_table');
    expect(row?.nested_table_id).toBe('TBL-011');
    expect(row?.value_text).toBe('중첩 표');
  });

  it('value_type=nested_table 인데 nested_table_id NULL → CHECK reject', async () => {
    if (!backend) throw new Error('backend not initialized');

    await expect(
      backend.db
        .prepare(
          `INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, nested_table_id)
           VALUES ('TCELL-010-01-02', 'TBL-010', 'TROW-010-01', 'TCOL-010-01', '중첩', 'nested_table', NULL)`,
        )
        .run(),
    ).rejects.toThrow(/CHECK constraint/i);
  });

  it('value_type=text 인데 formula_id 채움 → 통과 (CHECK 부분조건 — Devil 반론)', async () => {
    // CHECK 절은 'OR' 조합 — value_type='text'면 다른 컬럼 NOT NULL 제약 없음.
    // text+formula_id 조합은 의미상 모순이지만 DB 레벨에서 차단되지 않음 →
    // schema-validator (application layer)에서 차단해야 함을 확인.
    if (!backend) throw new Error('backend not initialized');

    // formulas 0001 schema: id/name/equation_template/variables_schema/version_year 필수
    await backend.db
      .prepare(
        `INSERT INTO formulas (id, name, equation_template, variables_schema, page_ref, version_year)
         VALUES ('F-099', '테스트', 'a + b', '[]', '교재 1쪽', 2026)`,
      )
      .run();

    await backend.db
      .prepare(
        `INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id)
         VALUES ('TCELL-010-01-03', 'TBL-010', 'TROW-010-01', 'TCOL-010-01', 'mixed', 'text', 'F-099')`,
      )
      .run();

    const row = await backend.db
      .prepare(`SELECT value_type, formula_id FROM table_cells WHERE id = 'TCELL-010-01-03'`)
      .first<{ value_type: string; formula_id: string }>();

    expect(row?.value_type).toBe('text');
    expect(row?.formula_id).toBe('F-099');
  });
});

describe('마이그레이션 0026 — 종속 테이블 UPDATE guard 3종', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(async () => {
    backend = createD1FromAllMigrations();

    await backend.db
      .prepare(
        `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page)
         VALUES ('LAW-001', 'LAW', '근거 노드', '법 제1조', 2026, 10, 'draft', 1, 1)`,
      )
      .run();

    await backend.db
      .prepare(
        `INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status)
         VALUES ('TBL-020', 'LAW-001', '검수 대상 표', 'A_simple', 1, 1, 'manual:test', 'draft')`,
      )
      .run();
    await backend.db
      .prepare(
        `INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text)
         VALUES ('TROW-020-01', 'TBL-020', 'row', 1, 1, NULL, '원본 행 헤더')`,
      )
      .run();
    await backend.db
      .prepare(
        `INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text)
         VALUES ('TCOL-020-01', 'TBL-020', 'column', 1, 1, NULL, '원본 열 헤더')`,
      )
      .run();
    await backend.db
      .prepare(
        `INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type)
         VALUES ('TCELL-020-01-01', 'TBL-020', 'TROW-020-01', 'TCOL-020-01', '원본 셀 값', 'text')`,
      )
      .run();
    await backend.db
      .prepare(
        `INSERT INTO table_node_links (table_id, related_node_id, relation_type)
         VALUES ('TBL-020', 'LAW-001', 'extracted_from')`,
      )
      .run();
  });

  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('table_cells.value_type UPDATE 차단 (BA-C2)', async () => {
    if (!backend) throw new Error('backend not initialized');

    await expect(
      backend.db
        .prepare(`UPDATE table_cells SET value_type = 'number' WHERE id = 'TCELL-020-01-01'`)
        .run(),
    ).rejects.toThrow(/Hard Rule 28|immutable/);
  });

  it('table_cells.value_text UPDATE 허용 (admin G5.5 오타 수정)', async () => {
    if (!backend) throw new Error('backend not initialized');

    await backend.db
      .prepare(`UPDATE table_cells SET value_text = '오타 수정' WHERE id = 'TCELL-020-01-01'`)
      .run();

    const row = await backend.db
      .prepare(`SELECT value_text FROM table_cells WHERE id = 'TCELL-020-01-01'`)
      .first<{ value_text: string }>();
    expect(row?.value_text).toBe('오타 수정');
  });

  it('table_headers.parent_id UPDATE 차단 (BA-C2)', async () => {
    if (!backend) throw new Error('backend not initialized');

    await backend.db
      .prepare(
        `INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text)
         VALUES ('TROW-020-02', 'TBL-020', 'row', 2, 2, 'TROW-020-01', '하위 행')`,
      )
      .run();

    await expect(
      backend.db
        .prepare(`UPDATE table_headers SET parent_id = NULL WHERE id = 'TROW-020-02'`)
        .run(),
    ).rejects.toThrow(/Hard Rule 28|immutable/);
  });

  it('table_headers.text UPDATE 허용 (오타 수정)', async () => {
    if (!backend) throw new Error('backend not initialized');

    await backend.db
      .prepare(`UPDATE table_headers SET text = '수정된 헤더' WHERE id = 'TROW-020-01'`)
      .run();

    const row = await backend.db
      .prepare(`SELECT text FROM table_headers WHERE id = 'TROW-020-01'`)
      .first<{ text: string }>();
    expect(row?.text).toBe('수정된 헤더');
  });

  it('table_node_links 전면 UPDATE 차단 (BA-C2)', async () => {
    if (!backend) throw new Error('backend not initialized');

    await expect(
      backend.db
        .prepare(
          `UPDATE table_node_links SET relation_type = 'referenced_by' WHERE table_id = 'TBL-020'`,
        )
        .run(),
    ).rejects.toThrow(/INSERT-only|append-only/);
  });
});

describe('Cat 9 자기검증 — sqlite_master에 trigger 4종 모두 존재 (DA-C1 흡수)', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(() => {
    backend = createD1FromAllMigrations();
  });

  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('0022/0024/0026 trigger 4종 영속 — sqlite_master SELECT', async () => {
    if (!backend) throw new Error('backend not initialized');

    const triggers = await backend.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'prevent_table_%' ORDER BY name`,
      )
      .all<{ name: string }>();

    expect(triggers.results.map((r) => r.name)).toEqual([
      'prevent_table_cells_critical_update',
      'prevent_table_headers_critical_update',
      'prevent_table_node_links_update',
      'prevent_table_structures_critical_update',
    ]);
  });

  it('table_structures.pattern_type CHECK enum 8종 — schema 직접 grep', async () => {
    if (!backend) throw new Error('backend not initialized');

    const schema = await backend.db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='table_structures'`)
      .first<{ sql: string }>();

    expect(schema?.sql).toBeTruthy();
    for (const pattern of PATTERN_TYPES) {
      expect(schema?.sql).toContain(`'${pattern}'`);
    }
  });

  it('table_cells.value_type CHECK enum 6종 — schema 직접 grep (0023 정합)', async () => {
    if (!backend) throw new Error('backend not initialized');

    const schema = await backend.db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='table_cells'`)
      .first<{ sql: string }>();

    expect(schema?.sql).toBeTruthy();
    for (const valueType of ['text', 'number', 'formula', 'na', 'merged_ref', 'nested_table']) {
      expect(schema?.sql).toContain(`'${valueType}'`);
    }
  });
});
