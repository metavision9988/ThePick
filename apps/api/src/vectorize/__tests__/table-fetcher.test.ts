/**
 * table-fetcher 테스트 — JOIN-based 텍스트 합성, value_type 분기, breadcrumb,
 * 부모 status 추론, Hard Rule 16, merged_ref SKIP (SQL WHERE 절 검증).
 *
 * 근거: docs/plans/phase2a-vectorize-table-indexing.plan.md §3.3 + §5 Gate 5.1
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { EXAM_IDS, type ExamId } from '@thepick/shared';
import {
  fetchTableStructuresForVectorize,
  fetchTableHeadersForVectorize,
  fetchTableCellsForVectorize,
  type D1Reader,
  type TableNodeMetadata,
} from '../table-fetcher.js';

interface CapturedQuery {
  sql: string;
  params: ReadonlyArray<unknown>;
}

function makeD1Reader<T>(rows: ReadonlyArray<T>): D1Reader & { captured: CapturedQuery[] } {
  const captured: CapturedQuery[] = [];
  const reader: D1Reader = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async all<R>() {
              captured.push({ sql, params });
              return { results: rows as unknown as ReadonlyArray<R> };
            },
          };
        },
      };
    },
  };
  return Object.assign(reader, { captured });
}

const exam: ExamId = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

// ---------------------------------------------------------------
// fetchTableStructuresForVectorize
// ---------------------------------------------------------------

describe('fetchTableStructuresForVectorize', () => {
  it('TBL-001 H_nested 텍스트 + 메타데이터 정합', async () => {
    const db = makeD1Reader([
      {
        id: 'TBL-001',
        title: '농작물재해보험 품목별 표본주(구간)수 표 — 15 분류 nested 부모',
        pattern_type: 'H_nested',
        row_count: 15,
        col_count: 1,
        source: '실무서 별표 1',
        status: 'draft',
        source_node_id: 'LAW-138',
        source_node_name: '별표 1: 표본주수 산정 기준',
        source_node_description:
          '농작물재해보험 표본주(구간)수 산정 기준 — 농작물 품목별 표본주수.',
        lv1_insurance: '농작물재해보험',
        lv2_crop: null,
        page_ref: 'p.524',
        version_year: 2026,
      },
    ]);

    const nodes = await fetchTableStructuresForVectorize(db, exam, { limit: 50, offset: 0 });

    expect(nodes).toHaveLength(1);
    const [node] = nodes;
    expect(node.id).toBe('TBL-001');
    expect(node.text).toContain('[TBL-001]');
    expect(node.text).toContain('근거: [LAW-138] 별표 1: 표본주수 산정 기준');
    expect(node.text).toContain('패턴: 중첩 표 | 행수: 15 × 열수: 1');
    expect(node.text).toContain('출처: 실무서 별표 1');
    expect(node.metadata.node_id).toBe('TBL-001');
    expect(node.metadata.node_type).toBe('TABLE');
    expect(node.metadata.status).toBe('draft');
    expect(node.metadata.truth_weight).toBe(8);
    expect(node.metadata.revision_year).toBe(2026);
    expect(node.metadata.source_page).toBe(524);
    expect(node.metadata.is_active).toBe(true);
    const meta = node.metadata as unknown as TableNodeMetadata;
    expect(meta.parent_table_id).toBe('TBL-001');
    expect(meta.pattern_type).toBe('H_nested');
    expect(meta.lv1_insurance).toBe('농작물재해보험');
  });

  it('source_node_id 부재 시 근거 라인 생략 + revision_year/source_page 0 sentinel', async () => {
    const db = makeD1Reader([
      {
        id: 'TBL-099',
        title: '독립 표',
        pattern_type: 'A_simple',
        row_count: 3,
        col_count: 2,
        source: '실무서 §1',
        status: 'active',
        source_node_id: null,
        source_node_name: null,
        source_node_description: null,
        lv1_insurance: null,
        lv2_crop: null,
        page_ref: null,
        version_year: null,
      },
    ]);
    const [node] = await fetchTableStructuresForVectorize(db, exam, { limit: 50, offset: 0 });
    expect(node.text).not.toContain('근거:');
    expect(node.metadata.revision_year).toBe(0);
    expect(node.metadata.source_page).toBe(0);
  });

  it('Hard Rule 16: examId 빈 문자열 시 throw', async () => {
    const db = makeD1Reader([]);
    await expect(
      fetchTableStructuresForVectorize(db, '' as ExamId, { limit: 50, offset: 0 }),
    ).rejects.toThrow(/Hard Rule 16/);
  });
});

// ---------------------------------------------------------------
// fetchTableHeadersForVectorize
// ---------------------------------------------------------------

describe('fetchTableHeadersForVectorize', () => {
  it('level 1 행 헤더 — 부모 텍스트 부재', async () => {
    const db = makeD1Reader([
      {
        id: 'TROW-001-01',
        table_id: 'TBL-001',
        axis: 'row',
        level: 1,
        index_pos: 1,
        own_text: '사과/배/단감/떫은감/포도',
        parent1_text: null,
        parent2_text: null,
        table_title: '농작물재해보험 표본주수 표',
        table_status: 'draft',
        source_node_id: 'LAW-138',
        source_node_name: '별표 1',
        lv1_insurance: '농작물재해보험',
        lv2_crop: null,
        page_ref: 'p.524',
        version_year: 2026,
      },
    ]);
    const [node] = await fetchTableHeadersForVectorize(db, exam, { limit: 200, offset: 0 });
    expect(node.id).toBe('TROW-001-01');
    expect(node.text).toContain('[TROW-001-01] 행 헤더 (level 1): 사과/배/단감/떫은감/포도');
    expect(node.text).toContain('표: [TBL-001]');
    expect(node.text).not.toContain(' > ');
    expect(node.metadata.node_type).toBe('ROW_HEADER');
    expect(node.metadata.status).toBe('draft');
    expect(node.metadata.truth_weight).toBe(7);
    const meta = node.metadata as unknown as TableNodeMetadata;
    expect(meta.axis).toBe('row');
    expect(meta.parent_table_id).toBe('TBL-001');
  });

  it('level 3 열 헤더 — 부모 2단 breadcrumb', async () => {
    const db = makeD1Reader([
      {
        id: 'TCOL-002-03',
        table_id: 'TBL-002',
        axis: 'column',
        level: 3,
        index_pos: 3,
        own_text: '100주 미만',
        parent1_text: '재배면적별',
        parent2_text: '표본주수',
        table_title: '사과/배/단감 표본주수 표',
        table_status: 'active',
        source_node_id: 'LAW-138',
        source_node_name: '별표 1',
        lv1_insurance: null,
        lv2_crop: null,
        page_ref: 'p.525',
        version_year: 2026,
      },
    ]);
    const [node] = await fetchTableHeadersForVectorize(db, exam, { limit: 200, offset: 0 });
    expect(node.text).toContain('표본주수 > 재배면적별 > 100주 미만');
    expect(node.metadata.node_type).toBe('COL_HEADER');
    expect(node.metadata.status).toBe('active');
  });
});

// ---------------------------------------------------------------
// fetchTableCellsForVectorize
// ---------------------------------------------------------------

describe('fetchTableCellsForVectorize', () => {
  it('text value_type 단순 셀 정합', async () => {
    const db = makeD1Reader([
      {
        id: 'TCELL-002-01-02',
        table_id: 'TBL-002',
        row_id: 'TROW-002-01',
        col_id: 'TCOL-002-02',
        value_text: '5주',
        value_type: 'text',
        formula_id: null,
        nested_table_id: null,
        row_text: '사과',
        row_parent1_text: null,
        row_parent2_text: null,
        col_text: '50주~150주',
        col_parent1_text: null,
        col_parent2_text: null,
        table_title: '사과/배/단감 표본주수 표',
        table_status: 'draft',
        source_node_id: 'LAW-138',
        source_node_name: '별표 1',
        lv1_insurance: '농작물재해보험',
        lv2_crop: null,
        page_ref: 'p.525',
        version_year: 2026,
        equation_template: null,
        formula_name: null,
        nested_table_title: null,
      },
    ]);
    const [node] = await fetchTableCellsForVectorize(db, exam, { limit: 200, offset: 0 });
    expect(node.text).toContain('[TCELL-002-01-02] 사과 × 50주~150주 = 5주');
    expect(node.text).toContain('표: [TBL-002]');
    expect(node.text).toContain('값 타입: 텍스트');
    expect(node.metadata.node_type).toBe('CELL');
    expect(node.metadata.truth_weight).toBe(6);
    expect(node.metadata.status).toBe('draft');
    expect((node.metadata as unknown as TableNodeMetadata).value_type).toBe('text');
  });

  it('formula value_type → equation_template JOIN 가시화', async () => {
    const db = makeD1Reader([
      {
        id: 'TCELL-013-01-02',
        table_id: 'TBL-013',
        row_id: 'TROW-013-01',
        col_id: 'TCOL-013-02',
        value_text: '{100 - (1.06 × 사고발생일자)}',
        value_type: 'formula',
        formula_id: 'F-155',
        nested_table_id: null,
        row_text: '8월',
        row_parent1_text: null,
        row_parent2_text: null,
        col_text: '잔여수확량',
        col_parent1_text: null,
        col_parent2_text: null,
        table_title: '무화과 사고발생일 잔여수확량 비율 산식',
        table_status: 'draft',
        source_node_id: 'LAW-140',
        source_node_name: '별표 5',
        lv1_insurance: null,
        lv2_crop: '무화과',
        page_ref: 'p.583',
        version_year: 2026,
        equation_template: '100 - (1.06 * day_of_event)',
        formula_name: '잔여수확량 8월 산식',
        nested_table_title: null,
      },
    ]);
    const [node] = await fetchTableCellsForVectorize(db, exam, { limit: 200, offset: 0 });
    expect(node.text).toContain('[F-155] 잔여수확량 8월 산식 = 100 - (1.06 * day_of_event)');
    expect(node.text).toContain('값 타입: 산식');
    expect((node.metadata as unknown as TableNodeMetadata).lv2_crop).toBe('무화과');
  });

  it('na value_type → "N/A (해당없음)" 라벨', async () => {
    const db = makeD1Reader([
      {
        id: 'TCELL-099-01-01',
        table_id: 'TBL-099',
        row_id: 'TROW-099-01',
        col_id: 'TCOL-099-01',
        value_text: null,
        value_type: 'na',
        formula_id: null,
        nested_table_id: null,
        row_text: '비대상 품목',
        row_parent1_text: null,
        row_parent2_text: null,
        col_text: '인정비율',
        col_parent1_text: null,
        col_parent2_text: null,
        table_title: '독립 표',
        table_status: 'active',
        source_node_id: null,
        source_node_name: null,
        lv1_insurance: null,
        lv2_crop: null,
        page_ref: null,
        version_year: null,
        equation_template: null,
        formula_name: null,
        nested_table_title: null,
      },
    ]);
    const [node] = await fetchTableCellsForVectorize(db, exam, { limit: 200, offset: 0 });
    expect(node.text).toContain('= N/A (해당없음)');
  });

  it('nested_table value_type → 부모 table title JOIN', async () => {
    const db = makeD1Reader([
      {
        id: 'TCELL-001-01-01',
        table_id: 'TBL-001',
        row_id: 'TROW-001-01',
        col_id: 'TCOL-001-01',
        value_text: '→ TBL-002',
        value_type: 'nested_table',
        formula_id: null,
        nested_table_id: 'TBL-002',
        row_text: '사과/배/단감/떫은감/포도',
        row_parent1_text: null,
        row_parent2_text: null,
        col_text: '표본주(구간)수 표',
        col_parent1_text: null,
        col_parent2_text: null,
        table_title: '농작물재해보험 표본주수 표 (nested 부모)',
        table_status: 'draft',
        source_node_id: 'LAW-138',
        source_node_name: '별표 1',
        lv1_insurance: '농작물재해보험',
        lv2_crop: null,
        page_ref: 'p.524',
        version_year: 2026,
        equation_template: null,
        formula_name: null,
        nested_table_title: '사과/배/단감 등 표본주수 표 (50주~1000주+ 13구간)',
      },
    ]);
    const [node] = await fetchTableCellsForVectorize(db, exam, { limit: 200, offset: 0 });
    expect(node.text).toContain(
      '= 중첩 표 [TBL-002] 사과/배/단감 등 표본주수 표 (50주~1000주+ 13구간)',
    );
    expect(node.text).toContain('값 타입: 중첩 표');
  });

  it('SQL WHERE 절: merged_ref 자동 SKIP', async () => {
    const db = makeD1Reader([]);
    await fetchTableCellsForVectorize(db, exam, { limit: 200, offset: 0 });
    expect(db.captured).toHaveLength(1);
    expect(db.captured[0].sql).toMatch(/WHERE\s+tc\.value_type\s*!=\s*'merged_ref'/i);
  });

  it('Hard Rule 16: examId 미지정 throw', async () => {
    const db = makeD1Reader([]);
    await expect(
      fetchTableCellsForVectorize(db, '' as ExamId, { limit: 200, offset: 0 }),
    ).rejects.toThrow(/Hard Rule 16/);
  });

  describe('composeValueRepr 흡수 (4-Pass MAJOR 흡수, Session 057)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function makeBaseCellRow(overrides: Record<string, unknown>): Record<string, unknown> {
      return {
        id: 'TCELL-099-01-01',
        table_id: 'TBL-099',
        row_id: 'TROW-099-01',
        col_id: 'TCOL-099-01',
        value_text: null,
        value_type: 'text',
        formula_id: null,
        nested_table_id: null,
        row_text: 'r',
        row_parent1_text: null,
        row_parent2_text: null,
        col_text: 'c',
        col_parent1_text: null,
        col_parent2_text: null,
        table_title: '독립 표',
        table_status: 'draft',
        source_node_id: null,
        source_node_name: null,
        lv1_insurance: null,
        lv2_crop: null,
        page_ref: null,
        version_year: null,
        equation_template: null,
        formula_name: null,
        nested_table_title: null,
        ...overrides,
      };
    }

    it('value_type=merged_ref: caller WHERE 차단 회귀 시 즉시 throw (P1-M2 흡수)', async () => {
      // SQL WHERE 절 우회한 비정상 데이터 시뮬레이션 (caller 차단 의무 위반)
      const db = makeD1Reader([makeBaseCellRow({ value_type: 'merged_ref' })]);
      await expect(
        fetchTableCellsForVectorize(db, exam, { limit: 200, offset: 0 }),
      ).rejects.toThrow(/merged_ref.*WHERE clause 회귀/);
    });

    it('value_type=unsupported (schema CHECK 확장 시): 즉시 throw — silent fallback 차단 (P1-M2)', async () => {
      const db = makeD1Reader([makeBaseCellRow({ value_type: 'range' })]);
      await expect(
        fetchTableCellsForVectorize(db, exam, { limit: 200, offset: 0 }),
      ).rejects.toThrow(/unsupported value_type='range'/);
    });

    it('value_type=text + value_text 빈 문자열: console.warn + "(빈 값)" fallback (P1-M3)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const db = makeD1Reader([
        makeBaseCellRow({ value_text: '   ', value_type: 'text', id: 'TCELL-077-02-03' }),
      ]);
      const [node] = await fetchTableCellsForVectorize(db, exam, { limit: 200, offset: 0 });
      expect(node.text).toContain('= (빈 값)');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('TCELL-077-02-03'));
    });

    it('value_type=formula + equation_template null: console.warn + value_text fallback (schema CHECK 위반 detect)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const db = makeD1Reader([
        makeBaseCellRow({
          value_type: 'formula',
          formula_id: 'F-999',
          equation_template: null,
          formula_name: null,
          value_text: '{빈 산식}',
          id: 'TCELL-077-03-01',
        }),
      ]);
      const [node] = await fetchTableCellsForVectorize(db, exam, { limit: 200, offset: 0 });
      expect(node.text).toContain('= {빈 산식}');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('TCELL-077-03-01'));
    });

    it('value_type=nested_table + nested_table_id null: console.warn + value_text fallback', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const db = makeD1Reader([
        makeBaseCellRow({
          value_type: 'nested_table',
          nested_table_id: null,
          nested_table_title: null,
          value_text: '→ TBL-001',
          id: 'TCELL-077-04-01',
        }),
      ]);
      const [node] = await fetchTableCellsForVectorize(db, exam, { limit: 200, offset: 0 });
      expect(node.text).toContain('= → TBL-001');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('TCELL-077-04-01'));
    });
  });
});
