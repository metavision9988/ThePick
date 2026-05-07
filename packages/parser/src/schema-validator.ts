/**
 * M08 Schema Validator — Knowledge Contract JSON 검증기
 *
 * Claude API 배치 프로세서(M07)가 생성한 Knowledge Contract JSON이
 * Ontology Registry의 ID 체계를 준수하는지 검증한다.
 * 미등록 ID → 거부 + 전체 에러 목록 반환 (재수행 효율).
 *
 * 필드 매핑 참고 (Knowledge Contract → DB):
 *   title → name, content → description, source_page → page_ref
 *   매핑은 DB 적재 단계(Step 0-9)에서 처리.
 */

import type { NodeType } from '@thepick/shared';
import { EXAM_IDS } from '@thepick/shared';
import {
  registry,
  isValidNodeType,
  isValidEdgeType,
  isValidNodeId,
  isValidFormulaId,
  isValidConstantId,
  isValidConstantCategory,
  inferNodeTypeFromId,
} from './ontology-registry';
import { KnowledgeContractValidationError } from './errors';

// --- Knowledge Contract types ---

export interface KnowledgeContractNode {
  id: string;
  type: string;
  title: string;
  content: string;
  lv1_insurance?: string;
  lv2_crop?: string;
  lv3_investigation?: string;
  truth_weight: number;
  /**
   * 출처 페이지 — page_ref 텍스트 생성 fallback (legacy). PDF 페이지 기준으로 보존.
   * ADR-030 도입 후 신규 BATCH 추출은 book_page/pdf_page 를 명시 채움.
   */
  source_page: number;
  /**
   * 사용자(수험자) 노출용 본문 페이지 (ADR-030). 교재 footer 페이지 번호 기준.
   * 마이그레이션 0019 트리거 enforce_book_page_on_insert 가 NULL INSERT 차단.
   * 본문/PDF 페이지 단위가 동일한 자료(법령 PDF 등)는 pdf_page 와 동일 값.
   */
  book_page: number;
  /**
   * PDF 추적용 페이지 (ADR-030). 검수 단계 PDF 직접 검증 시 사용.
   * 마이그레이션 0019 트리거 enforce_pdf_page_on_insert 가 NULL INSERT 차단.
   */
  pdf_page: number;
  /** 챕터 타이틀 (ADR-030, 예: "제1장 농업재해보험 손해평가 개관"). NULL 허용 — 법령 노드 등. */
  chapter?: string;
  /** 절 타이틀 (ADR-030, 예: "제3절 현지조사 내용"). NULL 허용. */
  section?: string;
}

export interface KnowledgeContractEdge {
  source_id: string;
  target_id: string;
  edge_type: string;
  condition?: string;
}

export interface KnowledgeContractFormula {
  id: string;
  name: string;
  equation_template: string;
  variables_schema: string;
  /** 출처 페이지 — 북극성(출처 추적성) 강제. 비어 있으면 MISSING_SOURCE_PAGE 에러. */
  source_page: number;
}

export interface KnowledgeContractConstant {
  id: string;
  name: string;
  value: string;
  category: string;
  /** 출처 페이지 — 북극성(출처 추적성) 강제. 비어 있으면 MISSING_SOURCE_PAGE 에러. */
  source_page: number;
}

/**
 * 표 헤더 노드 (ADR-032 v1.4.0 — Table-as-Micro-KG).
 * `axis='row'` → ROW_HEADER (^TROW-\d{3}-\d{2}$),
 * `axis='column'` → COL_HEADER (^TCOL-\d{3}-\d{2}$).
 * 다중 헤더(패턴 B/C)는 `parent_id`로 트리 표현.
 */
export interface KnowledgeContractTableHeader {
  id: string;
  axis: 'row' | 'column';
  level: number;
  index_pos: number;
  parent_id?: string;
  text: string;
}

/**
 * 표 셀 (ADR-032 v1.4.0 — 5종 / v1.5.0 D-PHASE2-7=α — 6종 패턴-H Nested Table 추가).
 * - 산식 셀(F)은 `formula_id` 필수
 * - 셀 병합(D)은 `merged_with_id` 필수
 * - Nested table 셀(H)은 `nested_table_id` 필수 (별표9 / 위험물 등급표 / 가액산정표 등)
 */
export interface KnowledgeContractTableCell {
  id: string;
  row_id: string;
  col_id: string;
  value_text?: string;
  value_type: 'text' | 'number' | 'formula' | 'na' | 'merged_ref' | 'nested_table';
  formula_id?: string;
  merged_with_id?: string;
  nested_table_id?: string;
}

/**
 * 표 구조 (ADR-032 v1.5.0). 비정형 표 8 패턴 분류 (A/B/C/D/E/F/G + 패턴-H Nested Table).
 * BATCH 추출 시 LLM이 표를 발견하면 별도 `tables[]` 배열로 추출.
 * D1 적재 = `table_structures` + `table_headers` + `table_cells` + `table_node_links`.
 *
 * Session 052 CRIT-A 흡수: pattern_type 8종 (마이그레이션 0024 D1 CHECK 정합).
 * Session 052 CRIT-D 흡수: book_page / pdf_page 필수 (북극성 출처 추적성).
 */
export interface KnowledgeContractTable {
  id: string;
  source_node_id: string;
  title: string;
  pattern_type:
    | 'A_simple'
    | 'B_2level'
    | 'C_3level'
    | 'D_merged'
    | 'E_na'
    | 'F_formula'
    | 'G_temporal'
    | 'H_nested';
  row_count: number;
  col_count: number;
  source: string;
  /**
   * 사용자(수험자) 노출용 본문 페이지 (ADR-030 + Session 052 CRIT-D).
   * 표 단위 출처 — admin G5.5 검수 시 PDF 직접 검증 + 수험자 "근거 보기" UX.
   */
  book_page: number;
  /** PDF 추적용 페이지 (ADR-030 + Session 052 CRIT-D). 검수 단계 PDF 직접 검증 시 사용. */
  pdf_page: number;
  /** 챕터 타이틀 (ADR-030, 선택). */
  chapter?: string;
  /** 절 타이틀 (ADR-030, 선택). */
  section?: string;
  headers: KnowledgeContractTableHeader[];
  cells: KnowledgeContractTableCell[];
}

export interface KnowledgeContract {
  nodes: KnowledgeContractNode[];
  edges: KnowledgeContractEdge[];
  formulas: KnowledgeContractFormula[];
  constants: KnowledgeContractConstant[];
  /**
   * 표 구조 (ADR-032 v1.4.0). Phase 2 BATCH 재추출 시점부터 활성.
   * Phase 1 = optional (현 BATCH 결과 호환 — undefined/[] 동작 보존).
   */
  tables?: KnowledgeContractTable[];
}

// --- Validation result types ---

export type ValidationErrorCode =
  | 'INVALID_NODE_TYPE'
  | 'INVALID_NODE_ID_PATTERN'
  | 'INVALID_EDGE_TYPE'
  | 'INVALID_EDGE_SOURCE_ID'
  | 'INVALID_EDGE_TARGET_ID'
  | 'INVALID_FORMULA_ID'
  | 'INVALID_CONSTANT_ID'
  | 'INVALID_CONSTANT_CATEGORY'
  | 'MISSING_REQUIRED_FIELD'
  | 'MISSING_SOURCE_PAGE'
  | 'INVALID_TRUTH_WEIGHT'
  | 'DANGLING_EDGE_REFERENCE'
  | 'DUPLICATE_NODE_ID'
  | 'INVALID_CONTRACT_STRUCTURE'
  // ADR-032 v1.4.0 + v1.5.0 — Table-as-Micro-KG 검증 (MAJOR-A 흡수)
  | 'INVALID_TABLE_ID'
  | 'INVALID_TABLE_HEADER_ID'
  | 'INVALID_TABLE_CELL_ID'
  | 'INVALID_TABLE_VALUE_TYPE'
  | 'DANGLING_TABLE_CELL_REFERENCE'
  | 'DANGLING_NESTED_TABLE_REFERENCE'
  | 'TABLE_PATTERN_VALUETYPE_MISMATCH'
  | 'TABLE_HEADER_INDEX_GAP'
  // Session 052 CRIT-A/B/C 흡수 — pattern_type whitelist + nested cycle 차단
  | 'INVALID_TABLE_PATTERN_TYPE'
  | 'NESTED_TABLE_SELF_REFERENCE'
  | 'NESTED_TABLE_CYCLE_DETECTED';

export interface ValidationError {
  path: string;
  code: ValidationErrorCode;
  message: string;
  value: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  stats: {
    nodesValidated: number;
    edgesValidated: number;
    formulasValidated: number;
    constantsValidated: number;
    tablesValidated: number;
  };
}

// --- Helpers ---

function err(
  path: string,
  code: ValidationErrorCode,
  message: string,
  value: unknown,
): ValidationError {
  return { path, code, message, value };
}

const emptyStats = {
  nodesValidated: 0,
  edgesValidated: 0,
  formulasValidated: 0,
  constantsValidated: 0,
  tablesValidated: 0,
};

/**
 * 출처 페이지 검증 — 양의 정수만 허용 (0, 음수, NaN, Infinity, null, undefined 거부).
 * 북극성(출처 추적성) 1차 방어선으로, schema-validator 단계에서 먼저 걸러 DB 트리거 의존을 줄인다.
 */
function isValidSourcePage(value: unknown): boolean {
  return (
    typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
  );
}

// --- Table-as-Micro-KG 검증 (ADR-032 v1.4.0 + v1.5.0 D-PHASE2-7=α) ---

/** 마이그레이션 0021 + 0023 정합 — value_type 6종 (5 + nested_table 패턴-H). */
const VALID_TABLE_VALUE_TYPES: ReadonlyArray<KnowledgeContractTableCell['value_type']> = [
  'text',
  'number',
  'formula',
  'na',
  'merged_ref',
  'nested_table',
];

/**
 * 마이그레이션 0021 + 0024 정합 — pattern_type 8종 화이트리스트.
 * Session 052 CRIT-A/B 흡수: D1 CHECK는 0024로 8종 확장되었으나 schema-validator 단계
 * 1차 방어선이 부재하여 LLM이 hallucination(예: 'Z_unknown')을 emit해도 통과 → D1
 * INSERT 시 silent fail로 BATCH rollback. 본 화이트리스트가 application-layer 차단.
 */
const VALID_TABLE_PATTERN_TYPES: ReadonlyArray<KnowledgeContractTable['pattern_type']> = [
  'A_simple',
  'B_2level',
  'C_3level',
  'D_merged',
  'E_na',
  'F_formula',
  'G_temporal',
  'H_nested',
];

/**
 * 패턴-H Nested Table 사이클 검출 — DFS 기반 (Session 052 CRIT-C 흡수).
 *
 * 입력: tables[]에서 추출한 nested_table_id 인접 그래프 (table.id → Set<nested_table_id>).
 * 출력: 사이클이 발견되면 첫 사이클 경로 (배열, 예: ['TBL-001','TBL-002','TBL-001']).
 *       사이클이 없으면 null.
 *
 * 자기 참조(A→A)는 *호출 측에서 별도로 거부* — 본 함수는 다단 사이클(A→B→A 등) 전담.
 * visiting set은 현재 DFS 스택 ("회색"), visited set은 완료된 노드("검정")으로 분리하여
 * 동일 노드를 여러 시작점에서 재방문 시 중복 보고 차단.
 */
function detectNestedTableCycle(adj: Map<string, Set<string>>): string[] | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): string[] | null {
    if (visiting.has(node)) {
      // 사이클 발견 — stack에서 본 노드 위치까지 슬라이스
      const idx = stack.indexOf(node);
      return idx >= 0 ? [...stack.slice(idx), node] : [node, node];
    }
    if (visited.has(node)) return null;

    visiting.add(node);
    stack.push(node);

    const neighbors = adj.get(node);
    if (neighbors) {
      for (const next of neighbors) {
        const cycle = dfs(next);
        if (cycle) return cycle;
      }
    }

    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const start of adj.keys()) {
    if (!visited.has(start)) {
      const cycle = dfs(start);
      if (cycle) return cycle;
    }
  }
  return null;
}

/**
 * tables[] 본문 검증 (MAJOR-A 흡수).
 *
 * 검증 항목:
 *   1. tables[].id Ontology Lock (TABLE 패턴) + 중복 차단
 *   2. headers[].id axis-prefix 매칭 (row → TROW / column → TCOL)
 *   3. cells[].id (TCELL 패턴)
 *   4. headers[].index_pos gap 차단 (row_count / col_count 정합)
 *   5. cells[].row_id ∈ headers[axis='row'].id, cells[].col_id ∈ headers[axis='column'].id (table 단위)
 *   6. value_type ↔ formula_id / merged_with_id / nested_table_id 정합 (Pass 1 Devil's Advocate)
 *   7. pattern_type ↔ cell value_type cross-validation
 *   8. 패턴-H Nested Table — nested_table_id ∈ tables[].id (자기 참조 허용)
 *
 * 호출: validateKnowledgeContract 내부, 5단계.
 *
 * @param tables KnowledgeContract.tables[] (optional 의 unwrap 후 호출)
 * @param formulaIds 선언된 formulas[].id 집합 (cell.formula_id dangling 검증)
 * @returns ValidationError[] (빈 배열 = 본 단계 PASS)
 */
function validateTablesSection(
  tables: KnowledgeContractTable[],
  formulaIds: ReadonlySet<string>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const tableIdSet = new Set<string>();
  // Session 052 CRIT-C: nested 관계 인접 그래프 — DFS cycle 검출 입력.
  const nestedEdges = new Map<string, Set<string>>();

  // 1차 pass: tables[].id 수집 (nested_table_id 검증을 위해 선행, 유효 패턴만 등록)
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t];
    if (table?.id && typeof table.id === 'string' && isValidNodeId('TABLE', table.id)) {
      tableIdSet.add(table.id);
    }
  }

  // 2차 pass: 표 단위 본문 검증
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t];
    const tablePrefix = `tables[${t}]`;

    if (!table || typeof table !== 'object') {
      errors.push(
        err(
          tablePrefix,
          'INVALID_CONTRACT_STRUCTURE',
          `tables[${t}] is null or not an object`,
          table,
        ),
      );
      continue;
    }

    // 1. tables[].id Ontology Lock
    if (!table.id || typeof table.id !== 'string') {
      errors.push(
        err(`${tablePrefix}.id`, 'MISSING_REQUIRED_FIELD', 'tables[].id is required', table.id),
      );
      continue;
    }
    if (!isValidNodeId('TABLE', table.id)) {
      errors.push(
        err(
          `${tablePrefix}.id`,
          'INVALID_TABLE_ID',
          `Table ID "${table.id}" does not match pattern: ${registry.node_id_patterns.TABLE}`,
          table.id,
        ),
      );
    }

    // 1b. pattern_type 화이트리스트 검증 (Session 052 CRIT-B 흡수 — 1차 방어선)
    //     LLM hallucination 시 unknown pattern → schema-validator 단계 거부.
    //     마이그레이션 0024 D1 CHECK 8종과 정합.
    if (!VALID_TABLE_PATTERN_TYPES.includes(table.pattern_type)) {
      errors.push(
        err(
          `${tablePrefix}.pattern_type`,
          'INVALID_TABLE_PATTERN_TYPE',
          `Unknown pattern_type: "${table.pattern_type}". Allowed: ${VALID_TABLE_PATTERN_TYPES.join(', ')}`,
          table.pattern_type,
        ),
      );
    }

    // 필수 메타 필드
    if (!table.title) {
      errors.push(
        err(
          `${tablePrefix}.title`,
          'MISSING_REQUIRED_FIELD',
          'tables[].title is required',
          table.title,
        ),
      );
    }
    if (!table.source) {
      errors.push(
        err(
          `${tablePrefix}.source`,
          'MISSING_REQUIRED_FIELD',
          'tables[].source is required',
          table.source,
        ),
      );
    }

    // 1c. ADR-030 페이지 메타 강제 — Session 052 CRIT-D 흡수 (북극성 출처 추적성).
    if (!isValidSourcePage(table.book_page)) {
      errors.push(
        err(
          `${tablePrefix}.book_page`,
          'MISSING_SOURCE_PAGE',
          'tables[].book_page is required (ADR-030 사용자 노출용 본문 페이지). Must be a positive integer.',
          table.book_page,
        ),
      );
    }
    if (!isValidSourcePage(table.pdf_page)) {
      errors.push(
        err(
          `${tablePrefix}.pdf_page`,
          'MISSING_SOURCE_PAGE',
          'tables[].pdf_page is required (ADR-030 PDF 추적용). Must be a positive integer.',
          table.pdf_page,
        ),
      );
    }
    if (
      table.chapter !== undefined &&
      (typeof table.chapter !== 'string' || table.chapter.trim() === '')
    ) {
      errors.push(
        err(
          `${tablePrefix}.chapter`,
          'MISSING_REQUIRED_FIELD',
          'tables[].chapter must be a non-empty string when provided (ADR-030).',
          table.chapter,
        ),
      );
    }
    if (
      table.section !== undefined &&
      (typeof table.section !== 'string' || table.section.trim() === '')
    ) {
      errors.push(
        err(
          `${tablePrefix}.section`,
          'MISSING_REQUIRED_FIELD',
          'tables[].section must be a non-empty string when provided (ADR-030).',
          table.section,
        ),
      );
    }
    if (
      typeof table.row_count !== 'number' ||
      !Number.isInteger(table.row_count) ||
      table.row_count < 1
    ) {
      errors.push(
        err(
          `${tablePrefix}.row_count`,
          'MISSING_REQUIRED_FIELD',
          'tables[].row_count must be a positive integer',
          table.row_count,
        ),
      );
    }
    if (
      typeof table.col_count !== 'number' ||
      !Number.isInteger(table.col_count) ||
      table.col_count < 1
    ) {
      errors.push(
        err(
          `${tablePrefix}.col_count`,
          'MISSING_REQUIRED_FIELD',
          'tables[].col_count must be a positive integer',
          table.col_count,
        ),
      );
    }

    // 2. headers 검증 — axis-prefix 매칭 + index_pos 수집
    const rowHeaderIds = new Set<string>();
    const colHeaderIds = new Set<string>();
    const rowIndexes = new Set<number>();
    const colIndexes = new Set<number>();

    if (!Array.isArray(table.headers)) {
      errors.push(
        err(
          `${tablePrefix}.headers`,
          'INVALID_CONTRACT_STRUCTURE',
          'tables[].headers must be an array',
          table.headers,
        ),
      );
    } else {
      for (let h = 0; h < table.headers.length; h++) {
        const header = table.headers[h];
        const hp = `${tablePrefix}.headers[${h}]`;

        if (!header || typeof header !== 'object' || !header.id) {
          errors.push(
            err(`${hp}.id`, 'MISSING_REQUIRED_FIELD', 'header.id is required', header?.id),
          );
          continue;
        }

        if (header.axis === 'row') {
          if (!isValidNodeId('ROW_HEADER', header.id)) {
            errors.push(
              err(
                `${hp}.id`,
                'INVALID_TABLE_HEADER_ID',
                `axis='row' requires TROW prefix: ${registry.node_id_patterns.ROW_HEADER}, got "${header.id}"`,
                header.id,
              ),
            );
          } else {
            rowHeaderIds.add(header.id);
            if (typeof header.index_pos === 'number') rowIndexes.add(header.index_pos);
          }
        } else if (header.axis === 'column') {
          if (!isValidNodeId('COL_HEADER', header.id)) {
            errors.push(
              err(
                `${hp}.id`,
                'INVALID_TABLE_HEADER_ID',
                `axis='column' requires TCOL prefix: ${registry.node_id_patterns.COL_HEADER}, got "${header.id}"`,
                header.id,
              ),
            );
          } else {
            colHeaderIds.add(header.id);
            if (typeof header.index_pos === 'number') colIndexes.add(header.index_pos);
          }
        } else {
          errors.push(
            err(
              `${hp}.axis`,
              'MISSING_REQUIRED_FIELD',
              `header.axis must be 'row' or 'column', got "${header.axis}"`,
              header.axis,
            ),
          );
        }
      }
    }

    // 3. headers index_pos gap 정합 (row_count / col_count 기준 1..N 모두 채워져야 함)
    if (typeof table.row_count === 'number' && table.row_count >= 1) {
      for (let i = 1; i <= table.row_count; i++) {
        if (!rowIndexes.has(i)) {
          errors.push(
            err(
              `${tablePrefix}.headers`,
              'TABLE_HEADER_INDEX_GAP',
              `Missing row header at index_pos=${i} (row_count=${table.row_count})`,
              i,
            ),
          );
        }
      }
    }
    if (typeof table.col_count === 'number' && table.col_count >= 1) {
      for (let i = 1; i <= table.col_count; i++) {
        if (!colIndexes.has(i)) {
          errors.push(
            err(
              `${tablePrefix}.headers`,
              'TABLE_HEADER_INDEX_GAP',
              `Missing column header at index_pos=${i} (col_count=${table.col_count})`,
              i,
            ),
          );
        }
      }
    }

    // 4. cells 검증
    let hasFormulaCell = false;
    let hasMergedRefCell = false;
    let hasNaCell = false;
    let hasNestedTableCell = false;

    if (!Array.isArray(table.cells)) {
      errors.push(
        err(
          `${tablePrefix}.cells`,
          'INVALID_CONTRACT_STRUCTURE',
          'tables[].cells must be an array',
          table.cells,
        ),
      );
    } else {
      for (let c = 0; c < table.cells.length; c++) {
        const cell = table.cells[c];
        const cp = `${tablePrefix}.cells[${c}]`;

        if (!cell || typeof cell !== 'object' || !cell.id) {
          errors.push(err(`${cp}.id`, 'MISSING_REQUIRED_FIELD', 'cell.id is required', cell?.id));
          continue;
        }

        if (!isValidNodeId('CELL', cell.id)) {
          errors.push(
            err(
              `${cp}.id`,
              'INVALID_TABLE_CELL_ID',
              `Cell ID "${cell.id}" does not match pattern: ${registry.node_id_patterns.CELL}`,
              cell.id,
            ),
          );
        }

        // value_type 6종 검증
        if (!VALID_TABLE_VALUE_TYPES.includes(cell.value_type)) {
          errors.push(
            err(
              `${cp}.value_type`,
              'INVALID_TABLE_VALUE_TYPE',
              `Unknown value_type: "${cell.value_type}". Allowed: ${VALID_TABLE_VALUE_TYPES.join(', ')}`,
              cell.value_type,
            ),
          );
          continue;
        }

        // value_type ↔ FK 정합
        if (cell.value_type === 'formula') {
          hasFormulaCell = true;
          if (!cell.formula_id) {
            errors.push(
              err(
                `${cp}.formula_id`,
                'MISSING_REQUIRED_FIELD',
                "value_type='formula' requires formula_id",
                cell.formula_id,
              ),
            );
          } else if (!formulaIds.has(cell.formula_id)) {
            errors.push(
              err(
                `${cp}.formula_id`,
                'DANGLING_TABLE_CELL_REFERENCE',
                `formula_id "${cell.formula_id}" not in declared formulas[]`,
                cell.formula_id,
              ),
            );
          }
        } else if (cell.value_type === 'merged_ref') {
          hasMergedRefCell = true;
          if (!cell.merged_with_id) {
            errors.push(
              err(
                `${cp}.merged_with_id`,
                'MISSING_REQUIRED_FIELD',
                "value_type='merged_ref' requires merged_with_id",
                cell.merged_with_id,
              ),
            );
          } else if (!isValidNodeId('CELL', cell.merged_with_id)) {
            errors.push(
              err(
                `${cp}.merged_with_id`,
                'DANGLING_TABLE_CELL_REFERENCE',
                `merged_with_id "${cell.merged_with_id}" not a valid TCELL pattern`,
                cell.merged_with_id,
              ),
            );
          }
        } else if (cell.value_type === 'na') {
          hasNaCell = true;
        } else if (cell.value_type === 'nested_table') {
          hasNestedTableCell = true;
          if (!cell.nested_table_id) {
            errors.push(
              err(
                `${cp}.nested_table_id`,
                'MISSING_REQUIRED_FIELD',
                "value_type='nested_table' requires nested_table_id (패턴-H)",
                cell.nested_table_id,
              ),
            );
          } else if (cell.nested_table_id === table.id) {
            // Session 052 CRIT-C 흡수: 자기 참조 명시 거부 (UI 무한 재귀 / 정답 결정 불가).
            errors.push(
              err(
                `${cp}.nested_table_id`,
                'NESTED_TABLE_SELF_REFERENCE',
                `nested_table_id "${cell.nested_table_id}" cannot reference its own table (self-loop forbidden)`,
                cell.nested_table_id,
              ),
            );
          } else if (!isValidNodeId('TABLE', cell.nested_table_id)) {
            // 패턴 위반 nested_table_id (TBL prefix 부재) — DANGLING보다 더 정확한 메시지.
            errors.push(
              err(
                `${cp}.nested_table_id`,
                'INVALID_TABLE_ID',
                `nested_table_id "${cell.nested_table_id}" does not match TABLE pattern: ${registry.node_id_patterns.TABLE}`,
                cell.nested_table_id,
              ),
            );
          } else if (!tableIdSet.has(cell.nested_table_id)) {
            errors.push(
              err(
                `${cp}.nested_table_id`,
                'DANGLING_NESTED_TABLE_REFERENCE',
                `nested_table_id "${cell.nested_table_id}" not declared in tables[]`,
                cell.nested_table_id,
              ),
            );
          } else {
            // Session 052 CRIT-C 흡수: 다단 사이클(A→B→A 등) 검출용 인접 그래프 누적.
            let neighbors = nestedEdges.get(table.id);
            if (!neighbors) {
              neighbors = new Set<string>();
              nestedEdges.set(table.id, neighbors);
            }
            neighbors.add(cell.nested_table_id);
          }
        }

        // dangling row_id / col_id (table 단위)
        if (cell.row_id && rowHeaderIds.size > 0 && !rowHeaderIds.has(cell.row_id)) {
          errors.push(
            err(
              `${cp}.row_id`,
              'DANGLING_TABLE_CELL_REFERENCE',
              `row_id "${cell.row_id}" not in this table's row headers`,
              cell.row_id,
            ),
          );
        }
        if (cell.col_id && colHeaderIds.size > 0 && !colHeaderIds.has(cell.col_id)) {
          errors.push(
            err(
              `${cp}.col_id`,
              'DANGLING_TABLE_CELL_REFERENCE',
              `col_id "${cell.col_id}" not in this table's column headers`,
              cell.col_id,
            ),
          );
        }
      }
    }

    // 5. pattern_type ↔ value_type cross-validation
    if (table.pattern_type === 'F_formula' && !hasFormulaCell) {
      errors.push(
        err(
          `${tablePrefix}.pattern_type`,
          'TABLE_PATTERN_VALUETYPE_MISMATCH',
          "pattern_type='F_formula' requires ≥1 cell with value_type='formula'",
          table.pattern_type,
        ),
      );
    }
    if (table.pattern_type === 'D_merged' && !hasMergedRefCell) {
      errors.push(
        err(
          `${tablePrefix}.pattern_type`,
          'TABLE_PATTERN_VALUETYPE_MISMATCH',
          "pattern_type='D_merged' requires ≥1 cell with value_type='merged_ref'",
          table.pattern_type,
        ),
      );
    }
    if (table.pattern_type === 'E_na' && !hasNaCell) {
      errors.push(
        err(
          `${tablePrefix}.pattern_type`,
          'TABLE_PATTERN_VALUETYPE_MISMATCH',
          "pattern_type='E_na' requires ≥1 cell with value_type='na'",
          table.pattern_type,
        ),
      );
    }
    if (
      table.pattern_type === 'A_simple' &&
      (hasFormulaCell || hasMergedRefCell || hasNestedTableCell)
    ) {
      errors.push(
        err(
          `${tablePrefix}.pattern_type`,
          'TABLE_PATTERN_VALUETYPE_MISMATCH',
          "pattern_type='A_simple' allows only text/number/na cells (no formula/merged_ref/nested_table)",
          table.pattern_type,
        ),
      );
    }
    // Session 052 CRIT-A 흡수: H_nested 패턴은 nested_table 셀 ≥1 의무.
    if (table.pattern_type === 'H_nested' && !hasNestedTableCell) {
      errors.push(
        err(
          `${tablePrefix}.pattern_type`,
          'TABLE_PATTERN_VALUETYPE_MISMATCH',
          "pattern_type='H_nested' requires ≥1 cell with value_type='nested_table'",
          table.pattern_type,
        ),
      );
    }
  }

  // 3차 pass: nested_table 사이클 검출 (Session 052 CRIT-C 흡수).
  // 자기 참조는 2차 pass에서 NESTED_TABLE_SELF_REFERENCE로 이미 거부 — 여기서는 다단(2+) 사이클만.
  if (nestedEdges.size > 0) {
    const cycle = detectNestedTableCycle(nestedEdges);
    if (cycle && cycle.length >= 3) {
      errors.push(
        err(
          'tables',
          'NESTED_TABLE_CYCLE_DETECTED',
          `Nested table cycle detected: ${cycle.join(' → ')} (UI infinite recursion / Workers CPU 50ms breach risk)`,
          cycle,
        ),
      );
    }
  }

  return errors;
}

// --- Validator ---

export function validateKnowledgeContract(contract: KnowledgeContract): ValidationResult {
  // 0. Structural validation — crash 방지
  if (!contract || typeof contract !== 'object') {
    return {
      valid: false,
      errors: [
        err('', 'INVALID_CONTRACT_STRUCTURE', 'Contract is null or not an object', contract),
      ],
      stats: emptyStats,
    };
  }

  const structErrors: ValidationError[] = [];
  if (!Array.isArray(contract.nodes)) {
    structErrors.push(
      err('nodes', 'INVALID_CONTRACT_STRUCTURE', 'nodes must be an array', contract.nodes),
    );
  }
  if (!Array.isArray(contract.edges)) {
    structErrors.push(
      err('edges', 'INVALID_CONTRACT_STRUCTURE', 'edges must be an array', contract.edges),
    );
  }
  if (!Array.isArray(contract.formulas)) {
    structErrors.push(
      err('formulas', 'INVALID_CONTRACT_STRUCTURE', 'formulas must be an array', contract.formulas),
    );
  }
  if (!Array.isArray(contract.constants)) {
    structErrors.push(
      err(
        'constants',
        'INVALID_CONTRACT_STRUCTURE',
        'constants must be an array',
        contract.constants,
      ),
    );
  }
  if (structErrors.length > 0) {
    return { valid: false, errors: structErrors, stats: emptyStats };
  }

  const errors: ValidationError[] = [];
  const declaredNodeIds = new Set<string>();

  // 1. Validate nodes
  for (let i = 0; i < contract.nodes.length; i++) {
    const node = contract.nodes[i];
    const prefix = `nodes[${i}]`;

    if (!node.id) {
      errors.push(err(`${prefix}.id`, 'MISSING_REQUIRED_FIELD', 'Node ID is required', node.id));
      continue;
    }

    if (!node.type) {
      errors.push(
        err(`${prefix}.type`, 'MISSING_REQUIRED_FIELD', 'Node type is required', node.type),
      );
      continue;
    }

    // Duplicate ID check
    if (declaredNodeIds.has(node.id)) {
      errors.push(
        err(`${prefix}.id`, 'DUPLICATE_NODE_ID', `Duplicate node ID: "${node.id}"`, node.id),
      );
    }

    if (!isValidNodeType(node.type)) {
      errors.push(
        err(
          `${prefix}.type`,
          'INVALID_NODE_TYPE',
          `Unknown node type: "${node.type}". Allowed: ${registry.node_types.join(', ')}`,
          node.type,
        ),
      );
    } else if (!isValidNodeId(node.type as NodeType, node.id)) {
      errors.push(
        err(
          `${prefix}.id`,
          'INVALID_NODE_ID_PATTERN',
          `ID "${node.id}" does not match pattern for type ${node.type}: ${registry.node_id_patterns[node.type as NodeType]}`,
          node.id,
        ),
      );
    }

    // title, content 필수 필드
    if (!node.title) {
      errors.push(
        err(`${prefix}.title`, 'MISSING_REQUIRED_FIELD', 'Node title is required', node.title),
      );
    }
    if (!node.content) {
      errors.push(
        err(
          `${prefix}.content`,
          'MISSING_REQUIRED_FIELD',
          'Node content is required',
          node.content,
        ),
      );
    }

    // truth_weight: 필수 + 정수 + 범위 1~10
    if (
      node.truth_weight == null ||
      typeof node.truth_weight !== 'number' ||
      !Number.isFinite(node.truth_weight)
    ) {
      errors.push(
        err(
          `${prefix}.truth_weight`,
          'MISSING_REQUIRED_FIELD',
          'truth_weight is required and must be a finite number',
          node.truth_weight,
        ),
      );
    } else if (
      !Number.isInteger(node.truth_weight) ||
      node.truth_weight < 1 ||
      node.truth_weight > 10
    ) {
      errors.push(
        err(
          `${prefix}.truth_weight`,
          'INVALID_TRUTH_WEIGHT',
          `truth_weight must be an integer 1-10, got ${node.truth_weight}`,
          node.truth_weight,
        ),
      );
    }

    // source_page: 출처 추적성 강제 (북극성). 정수 + 양수.
    if (!isValidSourcePage(node.source_page)) {
      errors.push(
        err(
          `${prefix}.source_page`,
          'MISSING_SOURCE_PAGE',
          'source_page is required (source citation). Must be a positive integer.',
          node.source_page,
        ),
      );
    }

    // ADR-030: book_page (required) — 사용자 노출용 본문 페이지. DB 트리거 enforce_book_page_on_insert 1차 방어선.
    if (!isValidSourcePage(node.book_page)) {
      errors.push(
        err(
          `${prefix}.book_page`,
          'MISSING_SOURCE_PAGE',
          'book_page is required (ADR-030 사용자 노출용 본문 페이지). Must be a positive integer.',
          node.book_page,
        ),
      );
    }

    // ADR-030: pdf_page (required) — PDF 추적용. DB 트리거 enforce_pdf_page_on_insert 1차 방어선.
    if (!isValidSourcePage(node.pdf_page)) {
      errors.push(
        err(
          `${prefix}.pdf_page`,
          'MISSING_SOURCE_PAGE',
          'pdf_page is required (ADR-030 PDF 추적용). Must be a positive integer.',
          node.pdf_page,
        ),
      );
    }

    // ADR-030: chapter / section (optional) — 있으면 non-empty string.
    if (
      node.chapter !== undefined &&
      (typeof node.chapter !== 'string' || node.chapter.trim() === '')
    ) {
      errors.push(
        err(
          `${prefix}.chapter`,
          'MISSING_REQUIRED_FIELD',
          'chapter must be a non-empty string when provided (ADR-030). Use undefined for nodes without chapter (e.g., LAW-NNN).',
          node.chapter,
        ),
      );
    }
    if (
      node.section !== undefined &&
      (typeof node.section !== 'string' || node.section.trim() === '')
    ) {
      errors.push(
        err(
          `${prefix}.section`,
          'MISSING_REQUIRED_FIELD',
          'section must be a non-empty string when provided (ADR-030). Use undefined for nodes without section.',
          node.section,
        ),
      );
    }

    declaredNodeIds.add(node.id);
  }

  // 2. Validate edges
  for (let i = 0; i < contract.edges.length; i++) {
    const edge = contract.edges[i];
    const prefix = `edges[${i}]`;

    // source_id, target_id 필수 필드
    if (!edge.source_id) {
      errors.push(
        err(
          `${prefix}.source_id`,
          'MISSING_REQUIRED_FIELD',
          'Edge source_id is required',
          edge.source_id,
        ),
      );
    }
    if (!edge.target_id) {
      errors.push(
        err(
          `${prefix}.target_id`,
          'MISSING_REQUIRED_FIELD',
          'Edge target_id is required',
          edge.target_id,
        ),
      );
    }

    if (!isValidEdgeType(edge.edge_type)) {
      errors.push(
        err(
          `${prefix}.edge_type`,
          'INVALID_EDGE_TYPE',
          `Unknown edge type: "${edge.edge_type}". Allowed: ${registry.edge_types.join(', ')}`,
          edge.edge_type,
        ),
      );
    }

    // 패턴 + dangling 체크는 source_id/target_id가 있을 때만
    if (edge.source_id) {
      if (!inferNodeTypeFromId(edge.source_id)) {
        errors.push(
          err(
            `${prefix}.source_id`,
            'INVALID_EDGE_SOURCE_ID',
            `source_id "${edge.source_id}" does not match any known node ID pattern`,
            edge.source_id,
          ),
        );
      }
      if (!declaredNodeIds.has(edge.source_id)) {
        errors.push(
          err(
            `${prefix}.source_id`,
            'DANGLING_EDGE_REFERENCE',
            `source_id "${edge.source_id}" not found in declared nodes`,
            edge.source_id,
          ),
        );
      }
    }

    if (edge.target_id) {
      if (!inferNodeTypeFromId(edge.target_id)) {
        errors.push(
          err(
            `${prefix}.target_id`,
            'INVALID_EDGE_TARGET_ID',
            `target_id "${edge.target_id}" does not match any known node ID pattern`,
            edge.target_id,
          ),
        );
      }
      if (!declaredNodeIds.has(edge.target_id)) {
        errors.push(
          err(
            `${prefix}.target_id`,
            'DANGLING_EDGE_REFERENCE',
            `target_id "${edge.target_id}" not found in declared nodes`,
            edge.target_id,
          ),
        );
      }
    }
  }

  // 3. Validate formulas
  for (let i = 0; i < contract.formulas.length; i++) {
    const formula = contract.formulas[i];
    const prefix = `formulas[${i}]`;

    if (!isValidFormulaId(formula.id)) {
      errors.push(
        err(
          `${prefix}.id`,
          'INVALID_FORMULA_ID',
          `Formula ID "${formula.id}" does not match pattern: ${registry.formula_id_pattern}`,
          formula.id,
        ),
      );
    }

    if (!isValidSourcePage(formula.source_page)) {
      errors.push(
        err(
          `${prefix}.source_page`,
          'MISSING_SOURCE_PAGE',
          'source_page is required (source citation). Must be a positive integer.',
          formula.source_page,
        ),
      );
    }
  }

  // 4. Validate constants
  for (let i = 0; i < contract.constants.length; i++) {
    const constant = contract.constants[i];
    const prefix = `constants[${i}]`;

    if (!isValidConstantId(constant.id)) {
      errors.push(
        err(
          `${prefix}.id`,
          'INVALID_CONSTANT_ID',
          `Constant ID "${constant.id}" does not match pattern: ${registry.constant_id_pattern}`,
          constant.id,
        ),
      );
    }

    if (!isValidConstantCategory(constant.category)) {
      errors.push(
        err(
          `${prefix}.category`,
          'INVALID_CONSTANT_CATEGORY',
          `Unknown constant category: "${constant.category}". Allowed: ${registry.constant_categories.join(', ')}`,
          constant.category,
        ),
      );
    }

    if (!isValidSourcePage(constant.source_page)) {
      errors.push(
        err(
          `${prefix}.source_page`,
          'MISSING_SOURCE_PAGE',
          'source_page is required (source citation). Must be a positive integer.',
          constant.source_page,
        ),
      );
    }
  }

  // 5. Validate tables (optional — ADR-032 v1.4.0 + v1.5.0 D-PHASE2-7=α 패턴-H)
  let tablesValidated = 0;
  if (Array.isArray(contract.tables)) {
    const formulaIds = new Set(contract.formulas.map((f) => f.id));
    errors.push(...validateTablesSection(contract.tables, formulaIds));
    tablesValidated = contract.tables.length;
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      nodesValidated: contract.nodes.length,
      edgesValidated: contract.edges.length,
      formulasValidated: contract.formulas.length,
      constantsValidated: contract.constants.length,
      tablesValidated,
    },
  };
}

// --- Raw Claude response validation (FUZ-02) ---

/**
 * D1 single transaction 절대 한도 (Cloudflare 문서 기준 1 MB). schema-validator
 * 의 응답 크기 임계는 본 상수의 1/10 비율로 도출 (4-Pass §5.3 MAJOR-3 흡수).
 */
const D1_TRANSACTION_LIMIT_BYTES = 1024 * 1024; // 1 MB

/**
 * 응답 임계값 — D1 1 MB 한도의 약 1/10 (보수적). 대부분 BATCH 출력은 30~50 KB 이내.
 * 100 KB = 102400 bytes ≈ D1_TRANSACTION_LIMIT_BYTES * 0.0977 (D1 한도 변경 시
 * 본 비율 재검토 — 본 시점 100 KB 가 정합).
 */
const DEFAULT_MAX_RESPONSE_SIZE_BYTES = 100 * 1024;
// Build-time 확인 — D1 1MB 한도 미만 보장 (silent drift 방지)
void (D1_TRANSACTION_LIMIT_BYTES > DEFAULT_MAX_RESPONSE_SIZE_BYTES);

/**
 * JSON 깊이 임계값 — V8 의 default JSON.parse 한계 (~10K) 도달 전 거부.
 * 50 단계는 정상 KnowledgeContract (nodes/edges/formulas/constants 평면 구조)
 * 보다 충분히 깊다.
 */
const DEFAULT_MAX_JSON_DEPTH = 50;

/**
 * XSS payload 정규식 — HTML 태그 컨텍스트 한정 (4-Pass §5.3 C-2 흡수).
 * 자연어 false positive (option=, online=, ontology=, once= 등) 차단을 위해
 * `\bon\w+\s*=` 단독 매칭 제거. event handler 는 반드시 `<tag ... on*=` 형태.
 */
const XSS_PAYLOAD_PATTERNS = [
  /<script\b/i,
  /javascript:/i,
  /<[a-z][^>]*\s+on\w+\s*=/i, // <tag ... onerror=...> / <tag ... onclick=...>
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
];

/**
 * HTML metacharacter escape — error message / metadata 의 secondary XSS 차단
 * (4-Pass §5.3 C-5 흡수). admin-web / Logpush UI 가 sanitize 안 해도 안전.
 */
function escapeHtmlSnippet(text: string, maxLen = 200): string {
  return text
    .slice(0, maxLen)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Hard Rule 17 위반 — examId literal 직접 인용 차단.
 * production-quality.md §"Hard Rule 17" 정합 — 응답 raw 단계에서 거부.
 *
 * EXAM_IDS catalogue 의 runtime values 를 그대로 차단 패턴으로 사용 — Year 2
 * 시험 추가 시 EXAM_IDS 만 갱신하면 자동 확장 (단일 진실 소스).
 */
const HARD_RULE_17_LITERALS: ReadonlyArray<string> = Object.values(EXAM_IDS);

export interface RawResponseValidationOptions {
  /** Maximum response size in bytes (default 100 KB) */
  maxSizeBytes?: number;
  /** Maximum JSON nesting depth (default 50) */
  maxDepth?: number;
}

/**
 * raw 응답 단계 character-level depth 측정 — JSON.parse 진입 전 stack overflow 보호.
 * 문자열 안의 brace / bracket 은 무시 (escape 처리 포함).
 */
function computeMaxJsonDepth(raw: string): number {
  let depth = 0;
  let max = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{' || c === '[') {
      depth++;
      if (depth > max) max = depth;
    } else if (c === '}' || c === ']') {
      depth--;
    }
  }
  return max;
}

/**
 * structural validation 결과 → KnowledgeContractValidationError 매핑.
 * 우선순위: ONTOLOGY_UNREGISTERED_ID > MISSING_REQUIRED_FIELD > 기타 (PARSE_ERROR).
 */
function mapValidationErrorsToClassification(
  errors: ValidationError[],
  raw: string,
): KnowledgeContractValidationError {
  const ontologyErr = errors.find(
    (e) => e.code === 'INVALID_NODE_ID_PATTERN' || e.code === 'INVALID_NODE_TYPE',
  );
  if (ontologyErr) {
    return new KnowledgeContractValidationError(
      'ONTOLOGY_UNREGISTERED_ID',
      `Ontology unregistered ID at ${ontologyErr.path}: ${ontologyErr.message}`,
      {
        id: typeof ontologyErr.value === 'string' ? ontologyErr.value : String(ontologyErr.value),
        field: ontologyErr.path,
        allErrors: errors,
      },
    );
  }

  const missingErr = errors.find((e) => e.code === 'MISSING_REQUIRED_FIELD');
  if (missingErr) {
    return new KnowledgeContractValidationError(
      'MISSING_REQUIRED_FIELD',
      `Missing required field at ${missingErr.path}: ${missingErr.message}`,
      { field: missingErr.path, allErrors: errors },
    );
  }

  return new KnowledgeContractValidationError(
    'PARSE_ERROR',
    `Validation failed: ${errors[0].message}`,
    { field: errors[0].path, allErrors: errors, rawSnippet: escapeHtmlSnippet(raw) },
  );
}

/**
 * raw 응답 단계 보안 / 임계 / Hard Rule 17 / depth 검사 — 1~5 단계 한정 (parse 미포함).
 *
 * 검사 순서:
 * 1. EMPTY_RESPONSE — 빈 응답
 * 2. RESPONSE_SIZE_EXCEEDED — 임계 초과 (D1 transaction 보호)
 * 3. XSS_PAYLOAD_DETECTED — script / javascript: / event handler (HTML 태그 컨텍스트)
 * 4. HARD_RULE_17_VIOLATION — examId literal 인용
 * 5. JSON_DEPTH_EXCEEDED — 50 단계 초과
 *
 * batch-processor 등 raw 단계 진입 caller 가 본 함수만 호출하여 parse 책임을
 * 자체 보유 가능 (tolerant default 처리 등). 4-Pass §5.3 C-3 흡수.
 *
 * @throws {KnowledgeContractValidationError} 1~5 단계 위반 시 분류된 에러
 */
export function validateRawResponseSecurity(
  raw: string,
  options: RawResponseValidationOptions = {},
): void {
  const maxSize = options.maxSizeBytes ?? DEFAULT_MAX_RESPONSE_SIZE_BYTES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_JSON_DEPTH;

  // 1. EMPTY_RESPONSE
  if (raw == null || raw.trim().length === 0) {
    throw new KnowledgeContractValidationError(
      'EMPTY_RESPONSE',
      'Empty Claude response (0 bytes or whitespace only)',
      { rawSnippet: typeof raw === 'string' ? escapeHtmlSnippet(raw) : '' },
    );
  }

  // 2. RESPONSE_SIZE_EXCEEDED — Session 052 CRIT-F 흡수: Workers 환경 Buffer 미존재
  //    (nodejs_compat flag 부재 기본 런타임). TextEncoder는 V8/Workers/Node 모두 표준.
  const size = new TextEncoder().encode(raw).length;
  if (size > maxSize) {
    throw new KnowledgeContractValidationError(
      'RESPONSE_SIZE_EXCEEDED',
      `Claude response size ${size} bytes exceeds maximum ${maxSize} bytes (D1 1MB transaction protection)`,
      { size, maxAllowed: maxSize },
    );
  }

  // 3. XSS_PAYLOAD_DETECTED — message + metadata 모두 escape (4-Pass §5.3 C-5)
  for (const pattern of XSS_PAYLOAD_PATTERNS) {
    const match = raw.match(pattern);
    if (match) {
      throw new KnowledgeContractValidationError(
        'XSS_PAYLOAD_DETECTED',
        `XSS payload detected in raw response: "${escapeHtmlSnippet(match[0], 100)}"`,
        {
          rawSnippet: escapeHtmlSnippet(raw),
          field: 'raw',
          pattern: pattern.source,
        },
      );
    }
  }

  // 4. HARD_RULE_17_VIOLATION
  for (const literal of HARD_RULE_17_LITERALS) {
    if (raw.includes(literal)) {
      throw new KnowledgeContractValidationError(
        'HARD_RULE_17_VIOLATION',
        `Hard Rule 17 violation: examId literal '${literal}' in raw response (must use EXAM_IDS catalogue)`,
        { rawSnippet: escapeHtmlSnippet(raw), field: 'raw', literal },
      );
    }
  }

  // 5. JSON_DEPTH_EXCEEDED
  const depth = computeMaxJsonDepth(raw);
  if (depth > maxDepth) {
    throw new KnowledgeContractValidationError(
      'JSON_DEPTH_EXCEEDED',
      `JSON depth ${depth} exceeds maximum ${maxDepth} (V8 stack overflow protection)`,
      { depth, maxAllowed: maxDepth },
    );
  }
}

/**
 * raw Claude / LLM 응답 검증 — 8종 변조 응답 (FUZ-02) graceful 분류 throw.
 *
 * 검사 순서 (실패 시 즉시 throw):
 * 1~5. validateRawResponseSecurity 위임 (보안 / 임계 / Hard Rule 17 / depth)
 * 6.   PARSE_ERROR — JSON.parse 실패
 * 7.   structural validation (validateKnowledgeContract 위임) — 실패 시
 *      ONTOLOGY_UNREGISTERED_ID / MISSING_REQUIRED_FIELD 등으로 매핑
 *
 * @throws {KnowledgeContractValidationError} 분류된 에러
 */
export function validateRawClaudeResponse(
  raw: string,
  options: RawResponseValidationOptions = {},
): KnowledgeContract {
  // 1~5. raw 단계 보안 / 임계 검사 위임
  validateRawResponseSecurity(raw, options);

  // 6. PARSE_ERROR
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const e = err as Error;
    throw new KnowledgeContractValidationError('PARSE_ERROR', `JSON parse failed: ${e.message}`, {
      rawSnippet: escapeHtmlSnippet(raw),
    });
  }

  // 7. structural validation 위임
  const result = validateKnowledgeContract(parsed as KnowledgeContract);
  if (!result.valid) {
    throw mapValidationErrorsToClassification(result.errors, raw);
  }

  return parsed as KnowledgeContract;
}
