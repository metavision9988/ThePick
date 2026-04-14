/**
 * ThePick Shared Types
 * Domain-agnostic types used across packages and modules.
 */

/** Node types in the knowledge graph (7 types) */
export type NodeType =
  | 'LAW'
  | 'FORMULA'
  | 'INVESTIGATION'
  | 'INSURANCE'
  | 'CROP'
  | 'CONCEPT'
  | 'TERM';

/** Edge types in the knowledge graph (13 types) */
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
  | 'CROSS_REF';

/** Truth weight values by node type */
export const TRUTH_WEIGHTS: Record<NodeType, number> = {
  LAW: 10,
  FORMULA: 8,
  INVESTIGATION: 7,
  INSURANCE: 6,
  CROP: 6,
  CONCEPT: 5,
  TERM: 3,
} as const;

/** Content status workflow: draft → review → approved → published */
export type ContentStatus = 'draft' | 'review' | 'approved' | 'published' | 'flagged';

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
