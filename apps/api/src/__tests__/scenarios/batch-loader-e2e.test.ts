/**
 * Session 052 5-Persona QE-C3 흡수 — E2E BATCH invariant 회귀.
 *
 * 목적:
 *   "schema-validator PASS 인 contract는 D1 INSERT도 끝까지 성공한다" 불변식 검증.
 *   validator는 통과하나 D1 FK constraint / CHECK constraint로 partial dirty state
 *   발생하는 silent failure 회귀 차단 (Phase 2A BATCH 적재 첫 1초 사용자 응대 무력화).
 *
 * 시나리오:
 *   1. A_simple 1×1 — Validator PASS → D1 INSERT (table_structures + headers + cells) → SELECT roundtrip
 *   2. H_nested 부모/자식 — value_type='nested_table' + nested_table_id round-trip
 *   3. F_formula — formula_id FK 정합성 (formulas seed → cell.formula_id → INSERT)
 *   4. table_node_links — extracted_from / referenced_by relation 적재
 *   5. Cross-pattern — A_simple + F_formula + H_nested 혼재 단일 BATCH 정합
 *   6. FK 위배 시나리오 — validator 잡지 못한 dangling header → D1 FK reject (defense-in-depth)
 *
 * 의존성:
 *   - @thepick/parser (devDep) — validateKnowledgeContract 직접 호출
 *   - helpers/d1-from-sqlite — node:sqlite 25 마이그레이션 적용된 D1 호환 wrapper
 *
 * 근거: .claude/reviews/review-20260507-154747-session-052-5-persona-tech-debt.md QE-C3
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  validateKnowledgeContract,
  type KnowledgeContract,
  type KnowledgeContractTable,
} from '@thepick/parser';
import { createD1FromAllMigrations, type SqliteBackedD1 } from '../helpers/d1-from-sqlite.js';

/**
 * E2E 적재기 — KnowledgeContract → D1 INSERT (BATCH-loader 축약 모델).
 *
 * 실제 BATCH-loader는 batch_runs idempotency 등 부가 책임 보유. 본 함수는 "validator
 * PASS 시 무조건 INSERT 끝까지 가능한가" 불변식 검증에 한정.
 */
async function loadContractIntoDb(db: D1Database, contract: KnowledgeContract): Promise<void> {
  // 1. nodes (table_structures.source_node_id FK 정합 위해 선행)
  //    KnowledgeContractNode.source_page → D1 page_ref 텍스트 + book_page/pdf_page 그대로
  for (const node of contract.nodes) {
    await db
      .prepare(
        `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page)
         VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      )
      .bind(
        node.id,
        node.type,
        node.title,
        `교재 ${node.book_page}쪽 (PDF ${node.pdf_page}쪽)`,
        2026,
        node.truth_weight,
        node.book_page,
        node.pdf_page,
      )
      .run();
  }

  // 2. formulas (table_cells.formula_id FK 정합)
  for (const formula of contract.formulas) {
    await db
      .prepare(
        `INSERT INTO formulas (id, name, equation_template, variables_schema, page_ref, version_year)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        formula.id,
        formula.name,
        formula.equation_template,
        formula.variables_schema,
        `교재 ${formula.source_page}쪽`,
        2026,
      )
      .run();
  }

  if (!contract.tables) return;

  // 3. table_structures 먼저 (nested_table_id self-ref FK 정합 — 부모/자식 순서 무관)
  for (const table of contract.tables) {
    await db
      .prepare(
        `INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')`,
      )
      .bind(
        table.id,
        table.source_node_id,
        table.title,
        table.pattern_type,
        table.row_count,
        table.col_count,
        table.source,
      )
      .run();
  }

  // 4. table_headers — parent_id FK 정합 위해 level=1 먼저 (현 fixture는 level=1만)
  for (const table of contract.tables) {
    for (const header of table.headers) {
      await db
        .prepare(
          `INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          header.id,
          table.id,
          header.axis,
          header.level,
          header.index_pos,
          header.parent_id ?? null,
          header.text,
        )
        .run();
    }
  }

  // 5. table_cells — row_id/col_id FK 정합
  for (const table of contract.tables) {
    for (const cell of table.cells) {
      await db
        .prepare(
          `INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type, formula_id, merged_with_id, nested_table_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          cell.id,
          table.id,
          cell.row_id,
          cell.col_id,
          cell.value_text ?? null,
          cell.value_type,
          cell.formula_id ?? null,
          cell.merged_with_id ?? null,
          cell.nested_table_id ?? null,
        )
        .run();
    }
  }
}

function makeMinimalContract(): KnowledgeContract {
  return { nodes: [], edges: [], formulas: [], constants: [], tables: [] };
}

function lawNode(id: string, title: string, pageOffset = 1): KnowledgeContract['nodes'][number] {
  return {
    id,
    type: 'LAW',
    title,
    content: title,
    truth_weight: 10,
    source_page: pageOffset,
    book_page: pageOffset,
    pdf_page: pageOffset + 7,
  };
}

function makeASimpleTable(): KnowledgeContractTable {
  return {
    id: 'TBL-001',
    source_node_id: 'LAW-001',
    title: '단순 1×1 표',
    pattern_type: 'A_simple',
    row_count: 1,
    col_count: 1,
    source: 'manual:test',
    book_page: 10,
    pdf_page: 17,
    headers: [
      { id: 'TROW-001-01', axis: 'row', level: 1, index_pos: 1, text: '행 1' },
      { id: 'TCOL-001-01', axis: 'column', level: 1, index_pos: 1, text: '열 1' },
    ],
    cells: [
      {
        id: 'TCELL-001-01-01',
        row_id: 'TROW-001-01',
        col_id: 'TCOL-001-01',
        value_text: '단순 셀',
        value_type: 'text',
      },
    ],
  };
}

describe('BATCH E2E invariant — validator PASS ⇒ D1 INSERT 끝까지 성공 (QE-C3)', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(() => {
    backend = createD1FromAllMigrations();
  });

  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('A_simple 1×1 — validator PASS → INSERT all → SELECT roundtrip 일치', async () => {
    if (!backend) throw new Error('backend not initialized');
    const contract = makeMinimalContract();
    contract.nodes.push(lawNode('LAW-001', '근거 법령'));
    contract.tables = [makeASimpleTable()];

    const result = validateKnowledgeContract(contract);
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);
    expect(result.stats.tablesValidated).toBe(1);

    await loadContractIntoDb(backend.db, contract);

    const tables = await backend.db
      .prepare(`SELECT id, pattern_type, source_node_id FROM table_structures`)
      .all<{ id: string; pattern_type: string; source_node_id: string }>();
    expect(tables.results).toHaveLength(1);
    expect(tables.results[0].id).toBe('TBL-001');
    expect(tables.results[0].pattern_type).toBe('A_simple');
    expect(tables.results[0].source_node_id).toBe('LAW-001');

    const headers = await backend.db
      .prepare(`SELECT id, axis FROM table_headers ORDER BY id`)
      .all<{ id: string; axis: string }>();
    expect(headers.results).toHaveLength(2);

    const cell = await backend.db
      .prepare(`SELECT value_text, value_type FROM table_cells WHERE id = 'TCELL-001-01-01'`)
      .first<{ value_text: string; value_type: string }>();
    expect(cell?.value_text).toBe('단순 셀');
    expect(cell?.value_type).toBe('text');
  });

  it('H_nested — 부모 표 + 자식 표 + nested_table_id round-trip', async () => {
    if (!backend) throw new Error('backend not initialized');
    const contract = makeMinimalContract();
    contract.nodes.push(lawNode('LAW-001', '별표9 부모'));

    const child: KnowledgeContractTable = {
      id: 'TBL-011',
      source_node_id: 'LAW-001',
      title: '중첩 자식',
      pattern_type: 'A_simple',
      row_count: 1,
      col_count: 1,
      source: 'manual:test',
      book_page: 10,
      pdf_page: 17,
      headers: [
        { id: 'TROW-011-01', axis: 'row', level: 1, index_pos: 1, text: '자식 행' },
        { id: 'TCOL-011-01', axis: 'column', level: 1, index_pos: 1, text: '자식 열' },
      ],
      cells: [
        {
          id: 'TCELL-011-01-01',
          row_id: 'TROW-011-01',
          col_id: 'TCOL-011-01',
          value_text: '자식 셀',
          value_type: 'text',
        },
      ],
    };

    const parent: KnowledgeContractTable = {
      id: 'TBL-010',
      source_node_id: 'LAW-001',
      title: '별표9 부모',
      pattern_type: 'H_nested',
      row_count: 1,
      col_count: 1,
      source: 'manual:test',
      book_page: 10,
      pdf_page: 17,
      headers: [
        { id: 'TROW-010-01', axis: 'row', level: 1, index_pos: 1, text: '부모 행' },
        { id: 'TCOL-010-01', axis: 'column', level: 1, index_pos: 1, text: '부모 열' },
      ],
      cells: [
        {
          id: 'TCELL-010-01-01',
          row_id: 'TROW-010-01',
          col_id: 'TCOL-010-01',
          value_text: '중첩 표 위치',
          value_type: 'nested_table',
          nested_table_id: 'TBL-011',
        },
      ],
    };

    contract.tables = [parent, child];

    const result = validateKnowledgeContract(contract);
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);
    expect(result.stats.tablesValidated).toBe(2);

    await loadContractIntoDb(backend.db, contract);

    const cell = await backend.db
      .prepare(`SELECT value_type, nested_table_id FROM table_cells WHERE id = 'TCELL-010-01-01'`)
      .first<{ value_type: string; nested_table_id: string }>();
    expect(cell?.value_type).toBe('nested_table');
    expect(cell?.nested_table_id).toBe('TBL-011');

    const tableCount = await backend.db
      .prepare(`SELECT COUNT(*) AS n FROM table_structures`)
      .first<{ n: number }>();
    expect(tableCount?.n).toBe(2);
  });

  it('F_formula — formula_id FK + cell.value_type 정합', async () => {
    if (!backend) throw new Error('backend not initialized');
    const contract = makeMinimalContract();
    contract.nodes.push(lawNode('LAW-001', '산식 근거'));
    contract.formulas.push({
      id: 'F-001',
      name: '단순 산식',
      equation_template: 'a + b',
      variables_schema: '[]',
      source_page: 5,
    });

    const table: KnowledgeContractTable = {
      id: 'TBL-002',
      source_node_id: 'LAW-001',
      title: '산식 표',
      pattern_type: 'F_formula',
      row_count: 1,
      col_count: 1,
      source: 'manual:test',
      book_page: 5,
      pdf_page: 12,
      headers: [
        { id: 'TROW-002-01', axis: 'row', level: 1, index_pos: 1, text: '산식 행' },
        { id: 'TCOL-002-01', axis: 'column', level: 1, index_pos: 1, text: '산식 열' },
      ],
      cells: [
        {
          id: 'TCELL-002-01-01',
          row_id: 'TROW-002-01',
          col_id: 'TCOL-002-01',
          value_type: 'formula',
          formula_id: 'F-001',
        },
      ],
    };
    contract.tables = [table];

    const result = validateKnowledgeContract(contract);
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);

    await loadContractIntoDb(backend.db, contract);

    const cell = await backend.db
      .prepare(`SELECT value_type, formula_id FROM table_cells WHERE id = 'TCELL-002-01-01'`)
      .first<{ value_type: string; formula_id: string }>();
    expect(cell?.value_type).toBe('formula');
    expect(cell?.formula_id).toBe('F-001');
  });

  it('Cross-pattern — A_simple + F_formula + H_nested 혼재 단일 BATCH 정합', async () => {
    if (!backend) throw new Error('backend not initialized');
    const contract = makeMinimalContract();
    contract.nodes.push(lawNode('LAW-001', '근거 1'));
    contract.formulas.push({
      id: 'F-001',
      name: '산식',
      equation_template: 'a',
      variables_schema: '[]',
      source_page: 1,
    });

    const tableA = makeASimpleTable();

    const tableF: KnowledgeContractTable = {
      id: 'TBL-002',
      source_node_id: 'LAW-001',
      title: '산식 표',
      pattern_type: 'F_formula',
      row_count: 1,
      col_count: 1,
      source: 'manual:test',
      book_page: 5,
      pdf_page: 12,
      headers: [
        { id: 'TROW-002-01', axis: 'row', level: 1, index_pos: 1, text: '행' },
        { id: 'TCOL-002-01', axis: 'column', level: 1, index_pos: 1, text: '열' },
      ],
      cells: [
        {
          id: 'TCELL-002-01-01',
          row_id: 'TROW-002-01',
          col_id: 'TCOL-002-01',
          value_type: 'formula',
          formula_id: 'F-001',
        },
      ],
    };

    const tableHChild: KnowledgeContractTable = {
      id: 'TBL-004',
      source_node_id: 'LAW-001',
      title: '중첩 자식',
      pattern_type: 'A_simple',
      row_count: 1,
      col_count: 1,
      source: 'manual:test',
      book_page: 10,
      pdf_page: 17,
      headers: [
        { id: 'TROW-004-01', axis: 'row', level: 1, index_pos: 1, text: '자식 행' },
        { id: 'TCOL-004-01', axis: 'column', level: 1, index_pos: 1, text: '자식 열' },
      ],
      cells: [
        {
          id: 'TCELL-004-01-01',
          row_id: 'TROW-004-01',
          col_id: 'TCOL-004-01',
          value_text: '자식 셀',
          value_type: 'text',
        },
      ],
    };

    const tableHParent: KnowledgeContractTable = {
      id: 'TBL-003',
      source_node_id: 'LAW-001',
      title: '중첩 부모',
      pattern_type: 'H_nested',
      row_count: 1,
      col_count: 1,
      source: 'manual:test',
      book_page: 10,
      pdf_page: 17,
      headers: [
        { id: 'TROW-003-01', axis: 'row', level: 1, index_pos: 1, text: '부모 행' },
        { id: 'TCOL-003-01', axis: 'column', level: 1, index_pos: 1, text: '부모 열' },
      ],
      cells: [
        {
          id: 'TCELL-003-01-01',
          row_id: 'TROW-003-01',
          col_id: 'TCOL-003-01',
          value_text: '중첩 자식 위치',
          value_type: 'nested_table',
          nested_table_id: 'TBL-004',
        },
      ],
    };

    contract.tables = [tableA, tableF, tableHParent, tableHChild];

    const result = validateKnowledgeContract(contract);
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);
    expect(result.stats.tablesValidated).toBe(4);

    await loadContractIntoDb(backend.db, contract);

    const summary = await backend.db
      .prepare(
        `SELECT pattern_type, COUNT(*) AS n FROM table_structures GROUP BY pattern_type ORDER BY pattern_type`,
      )
      .all<{ pattern_type: string; n: number }>();
    const byPattern = Object.fromEntries(summary.results.map((r) => [r.pattern_type, r.n]));
    expect(byPattern).toEqual({ A_simple: 2, F_formula: 1, H_nested: 1 });

    const totalCells = await backend.db
      .prepare(`SELECT COUNT(*) AS n FROM table_cells`)
      .first<{ n: number }>();
    expect(totalCells?.n).toBe(4);
  });

  it('table_node_links — extracted_from / referenced_by relation 적재 + 역방향 SELECT', async () => {
    if (!backend) throw new Error('backend not initialized');
    const contract = makeMinimalContract();
    contract.nodes.push(lawNode('LAW-001', '추출 출처'));
    contract.nodes.push(lawNode('LAW-002', '참조 노드', 2));
    contract.tables = [makeASimpleTable()];

    const result = validateKnowledgeContract(contract);
    expect(result.valid, JSON.stringify(result.errors)).toBe(true);

    await loadContractIntoDb(backend.db, contract);

    // table_node_links는 BATCH-loader 후속 단계 — 본 테스트는 D1 직접 INSERT로
    // FK 정합성 (table_structures + knowledge_nodes) 검증
    await backend.db
      .prepare(
        `INSERT INTO table_node_links (table_id, related_node_id, relation_type) VALUES (?, ?, 'extracted_from')`,
      )
      .bind('TBL-001', 'LAW-001')
      .run();
    await backend.db
      .prepare(
        `INSERT INTO table_node_links (table_id, related_node_id, relation_type) VALUES (?, ?, 'referenced_by')`,
      )
      .bind('TBL-001', 'LAW-002')
      .run();

    const links = await backend.db
      .prepare(
        `SELECT relation_type, related_node_id FROM table_node_links WHERE table_id = 'TBL-001' ORDER BY relation_type`,
      )
      .all<{ relation_type: string; related_node_id: string }>();
    expect(links.results).toHaveLength(2);
    expect(links.results.map((l) => l.relation_type)).toEqual(['extracted_from', 'referenced_by']);
  });

  it('Defense-in-depth — validator가 dangling cell reference 잡고, 통과 가정 시 D1 FK reject', async () => {
    if (!backend) throw new Error('backend not initialized');
    const contract = makeMinimalContract();
    contract.nodes.push(lawNode('LAW-001', '근거'));

    // headers는 정상 채우되, cell이 미존재 row/col_id를 참조 → validator dangling 검출
    const brokenTable: KnowledgeContractTable = {
      id: 'TBL-099',
      source_node_id: 'LAW-001',
      title: '부서진 표',
      pattern_type: 'A_simple',
      row_count: 1,
      col_count: 1,
      source: 'manual:test',
      book_page: 1,
      pdf_page: 1,
      headers: [
        { id: 'TROW-099-01', axis: 'row', level: 1, index_pos: 1, text: '존재 행' },
        { id: 'TCOL-099-01', axis: 'column', level: 1, index_pos: 1, text: '존재 열' },
      ],
      cells: [
        {
          id: 'TCELL-099-01-01',
          row_id: 'TROW-099-99', // 미존재 (헤더에 99가 없음)
          col_id: 'TCOL-099-99', // 미존재
          value_text: '깨진 셀',
          value_type: 'text',
        },
      ],
    };
    contract.tables = [brokenTable];

    // 1차 방어선 — Validator가 dangling cell reference를 잡는다
    const result = validateKnowledgeContract(contract);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DANGLING_TABLE_CELL_REFERENCE')).toBe(true);

    // 2차 방어선 — Validator를 우회해 D1 직접 INSERT 시도 → FK constraint reject
    await backend.db
      .prepare(
        `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page)
         VALUES ('LAW-001', 'LAW', '근거', '법 제1조', 2026, 10, 'draft', 1, 1)`,
      )
      .run();
    await backend.db
      .prepare(
        `INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status)
         VALUES ('TBL-099', 'LAW-001', '부서진 표', 'A_simple', 1, 1, 'manual:test', 'draft')`,
      )
      .run();

    await expect(
      backend.db
        .prepare(
          `INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type)
           VALUES ('TCELL-099-01-01', 'TBL-099', 'TROW-099-99', 'TCOL-099-99', '깨진 셀', 'text')`,
        )
        .run(),
    ).rejects.toThrow(/FOREIGN KEY constraint/i);
  });
});
