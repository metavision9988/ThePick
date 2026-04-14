/**
 * ThePick Graph RAG — Drizzle ORM Schema
 *
 * 9 tables (base 6 + extension 3):
 *   knowledge_nodes, knowledge_edges, formulas, constants,
 *   revision_changes, exam_questions,
 *   mnemonic_cards, user_progress, topic_clusters
 *
 * Temporal Graph pattern: UPDATE 금지 → INSERT + SUPERSEDES edge
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- Enum values (must match SQL CHECK constraints + shared/types.ts) ---

const NODE_TYPES = [
  'LAW',
  'FORMULA',
  'INVESTIGATION',
  'INSURANCE',
  'CROP',
  'CONCEPT',
  'TERM',
] as const;
const CONTENT_STATUSES = ['draft', 'review', 'approved', 'published', 'flagged'] as const;
const EXAM_QUESTION_STATUSES = ['active', 'deprecated', 'flagged'] as const;
const EDGE_TYPES = [
  'APPLIES_TO',
  'REQUIRES_INVESTIGATION',
  'PREREQUISITE',
  'USES_FORMULA',
  'DEPENDS_ON',
  'GOVERNED_BY',
  'DEFINED_AS',
  'EXCEPTION',
  'TIME_CONSTRAINT',
  'SUPERSEDES',
  'SHARED_WITH',
  'DIFFERS_FROM',
  'CROSS_REF',
] as const;
const CONFUSION_LEVELS = ['safe', 'warn', 'danger'] as const;
const CONSTANT_CATEGORIES = [
  'threshold',
  'coefficient',
  'date',
  'ratio',
  'sample',
  'deductible',
  'insurance_rate',
] as const;
const CHANGE_TYPES = ['added', 'modified', 'deleted', 'clarified'] as const;
const EXAM_SCOPES = ['1st_sub1', '1st_sub2', '1st_sub3', '2nd', 'shared'] as const;
const EXAM_TYPES = ['1st', '2nd'] as const;
const CONFUSION_TYPES = [
  'numeric',
  'decimal_coefficient',
  'date_period',
  'positive_negative',
  'exception',
  'procedure_order',
  'cross_crop',
  'list_omission',
] as const;
const CARD_TYPES = ['flashcard', 'ox', 'blank', 'exam', 'calculation'] as const;

// ---------------------------------------------------------------------------
// 1. Knowledge Nodes (Temporal Graph + Truth Weight)
// ---------------------------------------------------------------------------

export const knowledgeNodes = sqliteTable('knowledge_nodes', {
  id: text('id').primaryKey(),
  type: text('type', { enum: NODE_TYPES }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  lv1Insurance: text('lv1_insurance'),
  lv2Crop: text('lv2_crop'),
  lv3Investigation: text('lv3_investigation'),
  pageRef: text('page_ref'),
  batchId: text('batch_id'),
  versionYear: integer('version_year').notNull(),
  supersededBy: text('superseded_by'),
  truthWeight: integer('truth_weight').notNull().default(5),
  status: text('status', { enum: CONTENT_STATUSES }).notNull().default('draft'),
  examScope: text('exam_scope', { enum: EXAM_SCOPES }).default('2nd'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// 2. Knowledge Edges
// ---------------------------------------------------------------------------

export const knowledgeEdges = sqliteTable('knowledge_edges', {
  id: text('id').primaryKey(),
  fromNode: text('from_node')
    .notNull()
    .references(() => knowledgeNodes.id),
  toNode: text('to_node')
    .notNull()
    .references(() => knowledgeNodes.id),
  edgeType: text('edge_type', { enum: EDGE_TYPES }).notNull(),
  condition: text('condition'),
  priority: integer('priority').default(0),
  isActive: integer('is_active').default(1),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// 3. Formulas (Rule Engine — math.js AST only)
// ---------------------------------------------------------------------------

export const formulas = sqliteTable('formulas', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  equationTemplate: text('equation_template').notNull(),
  equationDisplay: text('equation_display'),
  variablesSchema: text('variables_schema').notNull(),
  constraints: text('constraints'),
  expectedInputs: text('expected_inputs'),
  gracefulDegradation: text('graceful_degradation'),
  pageRef: text('page_ref'),
  nodeId: text('node_id').references(() => knowledgeNodes.id),
  versionYear: integer('version_year').notNull(),
  supersededBy: text('superseded_by'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// 4. Constants (Magic Number Registry — L3)
// ---------------------------------------------------------------------------

export const constants = sqliteTable('constants', {
  id: text('id').primaryKey(),
  category: text('category', { enum: CONSTANT_CATEGORIES }).notNull(),
  name: text('name').notNull(),
  value: text('value').notNull(),
  numericValue: real('numeric_value'),
  appliesTo: text('applies_to').notNull(),
  insuranceType: text('insurance_type'),
  confusionRisk: text('confusion_risk'),
  confusionLevel: text('confusion_level', { enum: CONFUSION_LEVELS }).default('safe'),
  unit: text('unit'),
  pageRef: text('page_ref'),
  versionYear: integer('version_year').notNull(),
  examFrequency: integer('exam_frequency').default(0),
  relatedFormula: text('related_formula'),
  examScope: text('exam_scope', { enum: EXAM_SCOPES }).default('2nd'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// 5. Revision Changes
// ---------------------------------------------------------------------------

export const revisionChanges = sqliteTable('revision_changes', {
  id: text('id').primaryKey(),
  versionYear: integer('version_year').notNull(),
  revisionDate: text('revision_date').notNull(),
  category: text('category').notNull(),
  targetSection: text('target_section'),
  targetCrops: text('target_crops'),
  changeType: text('change_type', { enum: CHANGE_TYPES }).notNull(),
  beforeValue: text('before_value'),
  afterValue: text('after_value'),
  examPriority: integer('exam_priority').default(10),
  relatedConstants: text('related_constants'),
  relatedNodes: text('related_nodes'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// 6. Exam Questions
// ---------------------------------------------------------------------------

export const examQuestions = sqliteTable('exam_questions', {
  id: text('id').primaryKey(),
  year: integer('year').notNull(),
  round: integer('round'),
  questionNumber: integer('question_number'),
  subject: text('subject'),
  content: text('content').notNull(),
  answer: text('answer'),
  explanation: text('explanation'),
  validFrom: text('valid_from'),
  validUntil: text('valid_until'),
  supersededBy: text('superseded_by'),
  relatedNodes: text('related_nodes'),
  relatedConstants: text('related_constants'),
  status: text('status', { enum: EXAM_QUESTION_STATUSES }).notNull().default('active'),
  examType: text('exam_type', { enum: EXAM_TYPES }).default('2nd'),
  topicCluster: text('topic_cluster'),
  memorizationType: text('memorization_type'),
  confusionType: text('confusion_type', { enum: CONFUSION_TYPES }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// 7. Mnemonic Cards (Extension)
// ---------------------------------------------------------------------------

export const mnemonicCards = sqliteTable('mnemonic_cards', {
  id: text('id').primaryKey(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  confusionType: text('confusion_type', { enum: CONFUSION_TYPES }),
  memorizationMethod: text('memorization_method').notNull(),
  content: text('content').notNull(),
  reverseVerified: integer('reverse_verified').default(0),
  examScope: text('exam_scope', { enum: EXAM_SCOPES }),
  status: text('status', { enum: CONTENT_STATUSES }).default('draft'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// 8. User Progress (FSRS v4.5 — L3: PII)
// ---------------------------------------------------------------------------

export const userProgress = sqliteTable('user_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  nodeId: text('node_id').references(() => knowledgeNodes.id),
  cardId: text('card_id'),
  cardType: text('card_type', { enum: CARD_TYPES }).notNull(),
  fsrsDifficulty: real('fsrs_difficulty').default(0.3),
  fsrsStability: real('fsrs_stability').default(1.0),
  fsrsInterval: integer('fsrs_interval').default(1),
  fsrsNextReview: text('fsrs_next_review'),
  totalReviews: integer('total_reviews').default(0),
  correctCount: integer('correct_count').default(0),
  lastConfusionType: text('last_confusion_type', { enum: CONFUSION_TYPES }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// 9. Topic Clusters (Agricultural Science reverse-engineering)
// ---------------------------------------------------------------------------

export const topicClusters = sqliteTable('topic_clusters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  lv1: text('lv1'),
  lv2: text('lv2'),
  lv3: text('lv3'),
  examFrequency: integer('exam_frequency').default(0),
  questionIds: text('question_ids'),
  isCovered: integer('is_covered').default(1),
  source: text('source'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

export type KnowledgeNode = typeof knowledgeNodes.$inferSelect;
export type NewKnowledgeNode = typeof knowledgeNodes.$inferInsert;

export type KnowledgeEdge = typeof knowledgeEdges.$inferSelect;
export type NewKnowledgeEdge = typeof knowledgeEdges.$inferInsert;

export type Formula = typeof formulas.$inferSelect;
export type NewFormula = typeof formulas.$inferInsert;

export type Constant = typeof constants.$inferSelect;
export type NewConstant = typeof constants.$inferInsert;

export type RevisionChange = typeof revisionChanges.$inferSelect;
export type NewRevisionChange = typeof revisionChanges.$inferInsert;

export type ExamQuestion = typeof examQuestions.$inferSelect;
export type NewExamQuestion = typeof examQuestions.$inferInsert;

export type MnemonicCard = typeof mnemonicCards.$inferSelect;
export type NewMnemonicCard = typeof mnemonicCards.$inferInsert;

export type UserProgress = typeof userProgress.$inferSelect;
export type NewUserProgress = typeof userProgress.$inferInsert;

export type TopicCluster = typeof topicClusters.$inferSelect;
export type NewTopicCluster = typeof topicClusters.$inferInsert;
