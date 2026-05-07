/**
 * ThePick Shared Types
 * Domain-agnostic types used across packages and modules.
 */

/**
 * Node types in the knowledge graph.
 * - 7 domain types (LAW/FORMULA/INVESTIGATION/INSURANCE/CROP/CONCEPT/TERM)
 * - 4 table-as-micro-KG types (ADR-032 v1.4.0): TABLE/ROW_HEADER/COL_HEADER/CELL
 * Total: 11 types (ontology-registry v1.4.0+ 정합)
 */
export type NodeType =
  | 'LAW'
  | 'FORMULA'
  | 'INVESTIGATION'
  | 'INSURANCE'
  | 'CROP'
  | 'CONCEPT'
  | 'TERM'
  | 'TABLE'
  | 'ROW_HEADER'
  | 'COL_HEADER'
  | 'CELL';

/**
 * Edge types in the knowledge graph.
 * - 13 domain edges (APPLIES_TO ... CROSS_REF)
 * - 4 table-as-micro-KG edges (ADR-032 v1.4.0): HAS_ROW/HAS_COLUMN/BELONGS_TO_ROW/BELONGS_TO_COLUMN
 * - 1 nested-table edge (ADR-032 v1.5.0, D-PHASE2-7=α): CONTAINS_TABLE (CELL → TABLE, 패턴-H)
 * Total: 18 types (ontology-registry v1.5.0 정합)
 */
export type EdgeType =
  | 'APPLIES_TO'
  | 'REQUIRES_INVESTIGATION'
  | 'PREREQUISITE'
  | 'USES_FORMULA'
  | 'DEPENDS_ON'
  | 'GOVERNED_BY'
  | 'DEFINED_AS'
  | 'EXCEPTION'
  | 'TIME_CONSTRAINT'
  | 'SUPERSEDES'
  | 'SHARED_WITH'
  | 'DIFFERS_FROM'
  | 'CROSS_REF'
  | 'HAS_ROW'
  | 'HAS_COLUMN'
  | 'BELONGS_TO_ROW'
  | 'BELONGS_TO_COLUMN'
  | 'CONTAINS_TABLE';

/**
 * Truth weight values by node type.
 * Domain nodes (LAW/FORMULA/...) = RAG 우선순위 정합.
 *
 * Table-as-micro-KG nodes 점진 감쇠 (Session 052 CRIT-E + 5-Persona BA-M3 흡수,
 * ADR-032 §"truth_weight 정합" v2):
 *   - TABLE = 8 (FORMULA 동급 — 표 메타는 LAW 본문 직접 인용 + 산식 본문 동등 정밀)
 *   - ROW_HEADER / COL_HEADER = 7 (헤더 텍스트 = LAW 본문 보조)
 *   - CELL = 6 (셀 의미는 row+col 헤더 컨텍스트 의존 — standalone weight 가장 약함)
 *
 * 사유 (table-processing-architecture-v1.md §4.4 정합):
 *   "TABLE_CELL = LAW + 본문 명제 vs CELL 직접값 우선 (정밀도 高) — 단 셀 의미는
 *   row+col 헤더 컨텍스트 의존 → standalone weight X". ROW/COL 헤더 텍스트가 LAW
 *   본문보다 RAG 우선 노출되는 사례 차단 + TABLE 메타가 FORMULA 산식 본문보다
 *   우선되는 부정합 차단 (5-Persona Persona 4 BA-M3 자가 검증 편향 흡수).
 */
export const TRUTH_WEIGHTS: Record<NodeType, number> = {
  LAW: 10,
  FORMULA: 8,
  INVESTIGATION: 7,
  INSURANCE: 6,
  CROP: 6,
  CONCEPT: 5,
  TERM: 3,
  TABLE: 8,
  ROW_HEADER: 7,
  COL_HEADER: 7,
  CELL: 6,
} as const;

/** Content status workflow: draft → review → approved → published */
export type ContentStatus = 'draft' | 'review' | 'approved' | 'published' | 'flagged';

/**
 * Status transition workflow (migrations/0010 status_transitions).
 * knowledge_nodes/formulas/constants 의 상태 전이에 사용.
 * 'published' 는 Phase 2 에서 별도 승격 — status_transitions 는 approved 까지만 관리.
 */
export type TransitionStatus = 'draft' | 'review' | 'approved' | 'flagged';

/** status_transitions.target_type 의 허용값. */
export type TransitionTargetType = 'node' | 'formula' | 'constant';

/** Exam scope identifiers */
export type ExamScope = '1st_sub1' | '1st_sub2' | '1st_sub3' | '2nd' | 'shared';

/** Constant categories for magic number registry */
export type ConstantCategory =
  | 'threshold'
  | 'coefficient'
  | 'date'
  | 'ratio'
  | 'sample'
  | 'deductible'
  | 'insurance_rate';

/** Confusion level for constants */
export type ConfusionLevel = 'danger' | 'warn' | 'safe';

/** 8 confusion types for detection engine */
export type ConfusionType =
  | 'numeric'
  | 'decimal_coefficient'
  | 'date_period'
  | 'positive_negative'
  | 'exception'
  | 'procedure_order'
  | 'cross_crop'
  | 'list_omission';

/** FSRS card states */
export type FSRSState = 'new' | 'learning' | 'review' | 'relearning';

/** FSRS rating (1=Again, 2=Hard, 3=Good, 4=Easy) */
export type FSRSRating = 1 | 2 | 3 | 4;

/** Similarity threshold for Graceful Degradation */
export const SIMILARITY_THRESHOLD = 0.6;

/** Maximum nodes per Graph Visualizer subgraph (Hairball prevention) */
export const MAX_SUBGRAPH_NODES = 100;
