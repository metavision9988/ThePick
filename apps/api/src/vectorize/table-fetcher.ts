/**
 * Table Fetcher — D1 table_structures / table_headers / table_cells row 를 Vectorize 인덱싱용
 * NodeForVectorize 로 변환 (Phase 2A Step 2 — 433 cell-level 노드).
 *
 * 책임:
 *   - JOIN-based 텍스트 합성 (row_label × col_label = value_repr 형태)
 *   - 부모 table_structures.status 추론 (headers/cells 자체 status 컬럼 부재)
 *   - merged_ref 셀 자동 SKIP (caller WHERE 절 — primary cell 중복 차단)
 *   - formula 셀 → formulas.equation_template JOIN, nested_table 셀 → 부모 table 제목 JOIN
 *   - Hard Rule 16: 첫 인자 examId 강제 (메타데이터 자동 주입)
 *
 * 비스코프:
 *   - Vectorize upsert (upsertNodesToVectorize 위임)
 *   - 청크 분할 (caller — routes.ts 가 limit/offset 페이지네이션)
 *   - status 정책 (ADR-004 §4 Addendum: 모든 status 인덱싱)
 *
 * 근거:
 *   - docs/plans/phase2a-vectorize-table-indexing.plan.md §2 §3.1
 *   - ADR-032 Table-as-Micro-KG (Accepted Session 050)
 *   - migrations/0021/0023/0024/0025
 */

import { TRUTH_WEIGHTS, type ExamId, type NodeType } from '@thepick/shared';
import type { NodeForVectorize, VectorizeUpsertMetadata } from './upserter.js';
import { parsePageRefWithWarn } from './page-ref.js';

/**
 * 본 모듈은 D1Database 의 `prepare(...).bind(...).all<T>()` 만 사용 — Workers 환경 / vitest mock
 * 양쪽에서 호환되는 최소 인터페이스. routes.ts 의 D1Database 와 시그니처 일관.
 */
export interface D1Reader {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      all<T = Record<string, unknown>>(): Promise<{
        readonly results?: ReadonlyArray<T>;
      }>;
    };
  };
}

export interface FetchPagination {
  readonly limit: number;
  readonly offset: number;
}

/** 테이블 row 합성 시 사용하는 공통 메타 (knowledge_node JOIN 결과). */
interface SourceNodeMeta {
  readonly source_node_id: string | null;
  readonly source_node_name: string | null;
  readonly lv1_insurance: string | null;
  readonly lv2_crop: string | null;
  readonly page_ref: string | null;
  readonly version_year: number | null;
}

interface TableStructureRow extends SourceNodeMeta {
  readonly id: string;
  readonly title: string;
  readonly pattern_type: string;
  readonly row_count: number;
  readonly col_count: number;
  readonly source: string;
  readonly status: string;
  readonly source_node_description: string | null;
}

interface TableHeaderRow extends SourceNodeMeta {
  readonly id: string;
  readonly table_id: string;
  readonly axis: 'row' | 'column';
  readonly level: number;
  readonly index_pos: number;
  readonly own_text: string;
  readonly parent1_text: string | null;
  readonly parent2_text: string | null;
  readonly table_title: string;
  readonly table_status: string;
}

interface TableCellRow extends SourceNodeMeta {
  readonly id: string;
  readonly table_id: string;
  readonly row_id: string;
  readonly col_id: string;
  readonly value_text: string | null;
  readonly value_type: string;
  readonly formula_id: string | null;
  readonly nested_table_id: string | null;
  readonly row_text: string;
  readonly row_parent1_text: string | null;
  readonly row_parent2_text: string | null;
  readonly col_text: string;
  readonly col_parent1_text: string | null;
  readonly col_parent2_text: string | null;
  readonly table_title: string;
  readonly table_status: string;
  readonly equation_template: string | null;
  readonly formula_name: string | null;
  readonly nested_table_title: string | null;
}

/** Vectorize 메타데이터 확장 — table_* 인덱싱 시 추가 컬럼. */
export interface TableVectorizeMetadataExtras {
  readonly parent_table_id: string;
  readonly axis?: 'row' | 'column';
  readonly value_type?: string;
  readonly pattern_type?: string;
}

/** TABLE/ROW_HEADER/COL_HEADER/CELL 노드의 메타데이터 = 공통 + 확장 (exam_id 제외, upserter 가 주입). */
export type TableNodeMetadata = Omit<VectorizeUpsertMetadata, 'exam_id'> &
  TableVectorizeMetadataExtras;

const PATTERN_TYPE_LABELS: Record<string, string> = {
  A_simple: '단순 격자',
  B_2level: '2단 헤더',
  C_3level: '3단 헤더',
  D_merged: '셀 병합',
  E_na: 'N/A 셀',
  F_formula: '산식 셀',
  G_temporal: '시간차 변경',
  H_nested: '중첩 표',
};

const VALUE_TYPE_LABELS: Record<string, string> = {
  text: '텍스트',
  number: '수치',
  formula: '산식',
  na: '해당없음',
  nested_table: '중첩 표',
  merged_ref: '셀 병합 ref',
};

/** breadcrumb 합성 — depth 3 한도 (table_headers level CHECK 1-3). */
function joinBreadcrumb(parent2: string | null, parent1: string | null, own: string): string {
  return [parent2, parent1, own]
    .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
    .join(' > ');
}

/** Hard Rule 16: examId 첫 인자 강제 검증 (caller 진입점 type guard). */
function requireExamId(examId: ExamId): void {
  if (!examId || (examId as string).trim() === '') {
    throw new Error('examId is required (Hard Rule 16 시험 경계 강제)');
  }
}

/**
 * table_structures → NodeForVectorize.
 *
 * 텍스트 합성: title + (source_node 이름 + description 200자) + 패턴 + 행/열 + source.
 *
 * @throws {Error} examId 미지정 (Hard Rule 16)
 */
export async function fetchTableStructuresForVectorize(
  db: D1Reader,
  examId: ExamId,
  pagination: FetchPagination,
): Promise<ReadonlyArray<NodeForVectorize>> {
  requireExamId(examId);

  const sql = `
    SELECT
      ts.id,
      ts.title,
      ts.pattern_type,
      ts.row_count,
      ts.col_count,
      ts.source,
      ts.status,
      ts.source_node_id,
      kn.name AS source_node_name,
      kn.description AS source_node_description,
      kn.lv1_insurance,
      kn.lv2_crop,
      kn.page_ref,
      kn.version_year
    FROM table_structures ts
    LEFT JOIN knowledge_nodes kn ON kn.id = ts.source_node_id
    ORDER BY ts.id
    LIMIT ? OFFSET ?
  `;

  const result = await db
    .prepare(sql)
    .bind(pagination.limit, pagination.offset)
    .all<TableStructureRow>();
  const rows = result.results ?? [];

  return rows.map((row) => buildTableStructureNode(row));
}

function buildTableStructureNode(row: TableStructureRow): NodeForVectorize {
  const patternLabel = PATTERN_TYPE_LABELS[row.pattern_type] ?? row.pattern_type;
  const sourceNodePart =
    row.source_node_id !== null && row.source_node_name !== null
      ? `근거: [${row.source_node_id}] ${row.source_node_name}${
          row.source_node_description !== null && row.source_node_description.trim() !== ''
            ? ' — ' + row.source_node_description.trim().slice(0, 200)
            : ''
        }\n`
      : '';

  const text = `[${row.id}] ${row.title}\n${sourceNodePart}패턴: ${patternLabel} | 행수: ${row.row_count} × 열수: ${row.col_count}\n출처: ${row.source}`;

  const nodeType: NodeType = 'TABLE';
  const metadata: TableNodeMetadata = {
    node_id: row.id,
    node_type: nodeType,
    status: row.status,
    truth_weight: TRUTH_WEIGHTS[nodeType],
    revision_year: row.version_year ?? 0,
    source_page: parsePageRefWithWarn(row.page_ref, row.id),
    is_active: true,
    parent_table_id: row.id,
    pattern_type: row.pattern_type,
    ...(row.lv1_insurance ? { lv1_insurance: row.lv1_insurance } : {}),
    ...(row.lv2_crop ? { lv2_crop: row.lv2_crop } : {}),
  };

  return { id: row.id, text, metadata };
}

/**
 * table_headers → NodeForVectorize. parent_id 체인 depth 3 한도 (LEFT JOIN 2단).
 * status 부모 table_structures.status 추론.
 */
export async function fetchTableHeadersForVectorize(
  db: D1Reader,
  examId: ExamId,
  pagination: FetchPagination,
): Promise<ReadonlyArray<NodeForVectorize>> {
  requireExamId(examId);

  const sql = `
    SELECT
      th.id,
      th.table_id,
      th.axis,
      th.level,
      th.index_pos,
      th.text AS own_text,
      p1.text AS parent1_text,
      p2.text AS parent2_text,
      ts.title AS table_title,
      ts.status AS table_status,
      ts.source_node_id,
      kn.name AS source_node_name,
      kn.lv1_insurance,
      kn.lv2_crop,
      kn.page_ref,
      kn.version_year
    FROM table_headers th
    JOIN table_structures ts ON ts.id = th.table_id
    LEFT JOIN knowledge_nodes kn ON kn.id = ts.source_node_id
    LEFT JOIN table_headers p1 ON p1.id = th.parent_id
    LEFT JOIN table_headers p2 ON p2.id = p1.parent_id
    ORDER BY th.id
    LIMIT ? OFFSET ?
  `;

  const result = await db
    .prepare(sql)
    .bind(pagination.limit, pagination.offset)
    .all<TableHeaderRow>();
  const rows = result.results ?? [];

  return rows.map((row) => buildTableHeaderNode(row));
}

function buildTableHeaderNode(row: TableHeaderRow): NodeForVectorize {
  const breadcrumb = joinBreadcrumb(row.parent2_text, row.parent1_text, row.own_text);
  const axisLabel = row.axis === 'row' ? '행' : '열';

  const text = `[${row.id}] ${axisLabel} 헤더 (level ${row.level}): ${breadcrumb}\n표: [${row.table_id}] ${row.table_title}`;

  const nodeType: NodeType = row.axis === 'row' ? 'ROW_HEADER' : 'COL_HEADER';
  const metadata: TableNodeMetadata = {
    node_id: row.id,
    node_type: nodeType,
    status: row.table_status,
    truth_weight: TRUTH_WEIGHTS[nodeType],
    revision_year: row.version_year ?? 0,
    source_page: parsePageRefWithWarn(row.page_ref, row.id),
    is_active: true,
    parent_table_id: row.table_id,
    axis: row.axis,
    ...(row.lv1_insurance ? { lv1_insurance: row.lv1_insurance } : {}),
    ...(row.lv2_crop ? { lv2_crop: row.lv2_crop } : {}),
  };

  return { id: row.id, text, metadata };
}

/**
 * table_cells → NodeForVectorize. value_type 분기 + JOIN.
 *
 * 인덱싱 제외:
 *   - `value_type='merged_ref'` (primary cell 중복 차단)
 *
 * 텍스트 합성:
 *   - text → value_text 그대로
 *   - number → value_text 그대로
 *   - formula → formulas.equation_template (가시화)
 *   - na → 'N/A (해당없음)'
 *   - nested_table → '중첩 표 [TBL-NNN] {nested.title}'
 */
export async function fetchTableCellsForVectorize(
  db: D1Reader,
  examId: ExamId,
  pagination: FetchPagination,
): Promise<ReadonlyArray<NodeForVectorize>> {
  requireExamId(examId);

  const sql = `
    SELECT
      tc.id,
      tc.table_id,
      tc.row_id,
      tc.col_id,
      tc.value_text,
      tc.value_type,
      tc.formula_id,
      tc.nested_table_id,
      rh.text AS row_text,
      rh_p1.text AS row_parent1_text,
      rh_p2.text AS row_parent2_text,
      ch.text AS col_text,
      ch_p1.text AS col_parent1_text,
      ch_p2.text AS col_parent2_text,
      ts.title AS table_title,
      ts.status AS table_status,
      ts.source_node_id,
      kn.name AS source_node_name,
      kn.lv1_insurance,
      kn.lv2_crop,
      kn.page_ref,
      kn.version_year,
      f.equation_template,
      f.name AS formula_name,
      nt.title AS nested_table_title
    FROM table_cells tc
    JOIN table_structures ts ON ts.id = tc.table_id
    LEFT JOIN knowledge_nodes kn ON kn.id = ts.source_node_id
    JOIN table_headers rh ON rh.id = tc.row_id
    LEFT JOIN table_headers rh_p1 ON rh_p1.id = rh.parent_id
    LEFT JOIN table_headers rh_p2 ON rh_p2.id = rh_p1.parent_id
    JOIN table_headers ch ON ch.id = tc.col_id
    LEFT JOIN table_headers ch_p1 ON ch_p1.id = ch.parent_id
    LEFT JOIN table_headers ch_p2 ON ch_p2.id = ch_p1.parent_id
    LEFT JOIN formulas f ON f.id = tc.formula_id
    LEFT JOIN table_structures nt ON nt.id = tc.nested_table_id
    WHERE tc.value_type != 'merged_ref'
    ORDER BY tc.id
    LIMIT ? OFFSET ?
  `;

  const result = await db
    .prepare(sql)
    .bind(pagination.limit, pagination.offset)
    .all<TableCellRow>();
  const rows = result.results ?? [];

  return rows.map((row) => buildTableCellNode(row));
}

function buildTableCellNode(row: TableCellRow): NodeForVectorize {
  const rowLabel = joinBreadcrumb(row.row_parent2_text, row.row_parent1_text, row.row_text);
  const colLabel = joinBreadcrumb(row.col_parent2_text, row.col_parent1_text, row.col_text);
  const valueRepr = composeValueRepr(row);
  const valueTypeLabel = VALUE_TYPE_LABELS[row.value_type] ?? row.value_type;

  const text = `[${row.id}] ${rowLabel} × ${colLabel} = ${valueRepr}\n표: [${row.table_id}] ${row.table_title}\n값 타입: ${valueTypeLabel}`;

  const nodeType: NodeType = 'CELL';
  const metadata: TableNodeMetadata = {
    node_id: row.id,
    node_type: nodeType,
    status: row.table_status,
    truth_weight: TRUTH_WEIGHTS[nodeType],
    revision_year: row.version_year ?? 0,
    source_page: parsePageRefWithWarn(row.page_ref, row.id),
    is_active: true,
    parent_table_id: row.table_id,
    value_type: row.value_type,
    ...(row.lv1_insurance ? { lv1_insurance: row.lv1_insurance } : {}),
    ...(row.lv2_crop ? { lv2_crop: row.lv2_crop } : {}),
  };

  return { id: row.id, text, metadata };
}

function composeValueRepr(row: TableCellRow): string {
  switch (row.value_type) {
    case 'text':
    case 'number': {
      // Pass 1 SURGEON M3 (Session 057) — 빈 값 fallback 시 운영자 detect 의무
      // (다수 빈 셀 동일 임베딩 collapse 차단)
      const trimmed = (row.value_text ?? '').trim();
      if (trimmed === '') {
        console.warn(
          `composeValueRepr: empty value_text for cell ${row.id} (value_type=${row.value_type})`,
        );
        return '(빈 값)';
      }
      return trimmed;
    }
    case 'formula': {
      // F-NNN equation_template 가시화 — 산식 검색 회귀 (smoke test "무화과 8월" 등)
      if (row.equation_template !== null && row.equation_template.trim() !== '') {
        const formulaIdPart = row.formula_id !== null ? `[${row.formula_id}] ` : '';
        const formulaNamePart = row.formula_name !== null ? `${row.formula_name} = ` : '';
        return `${formulaIdPart}${formulaNamePart}${row.equation_template.trim()}`;
      }
      // schema CHECK 가 'formula' AND formula_id NOT NULL 강제 (migrations/0021:104) —
      // 본 분기 도달 = 데이터 무결성 위반. 운영자 detect 후 value_text fallback.
      console.warn(
        `composeValueRepr: formula cell ${row.id} missing equation_template (formula_id=${row.formula_id ?? 'null'}) — schema CHECK 위반 가능`,
      );
      return (row.value_text ?? '').trim() || '(산식 미정의)';
    }
    case 'na':
      return 'N/A (해당없음)';
    case 'nested_table': {
      if (row.nested_table_id !== null && row.nested_table_title !== null) {
        return `중첩 표 [${row.nested_table_id}] ${row.nested_table_title}`;
      }
      // 부재 시 value_text fallback (현 데이터에서 "→ TBL-NNN (...)" 형태 직접 저장).
      // schema CHECK 가 'nested_table' AND nested_table_id NOT NULL 강제 (migrations/0023) —
      // 본 fallback 진입 시 운영자 detect.
      if (row.nested_table_id === null) {
        console.warn(
          `composeValueRepr: nested_table cell ${row.id} missing nested_table_id — schema CHECK 위반 가능`,
        );
      }
      return (row.value_text ?? '').trim() || '(중첩 표 미정의)';
    }
    case 'merged_ref':
      // SQL WHERE 절이 차단 — 본 case 도달 시 schema/쿼리 회귀 (즉시 실패).
      throw new Error(
        `composeValueRepr: merged_ref cell ${row.id} reached buildTableCellNode — fetchTableCellsForVectorize WHERE clause 회귀 (caller 차단 의무 위반)`,
      );
    default:
      // schema CHECK enum 변경 시 즉시 실패 — silent fallback 차단 (Pass 1 SURGEON M2).
      throw new Error(
        `composeValueRepr: unsupported value_type='${row.value_type}' for cell ${row.id} — schema CHECK 확장 시 본 함수 분기 추가 의무`,
      );
  }
}
