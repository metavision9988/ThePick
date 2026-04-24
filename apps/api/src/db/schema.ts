/**
 * ThePick Graph RAG — Drizzle ORM Schema
 *
 * ## ⚠️ 마이그레이션 정책 (NC-1, 2026-04-24) — 반드시 준수
 *
 * - 본 파일은 **타입 파생 전용**: `$inferSelect` / `$inferInsert` 를 통해 Drizzle
 *   ORM 쿼리 빌더에 타입을 제공한다.
 * - **drizzle-kit generate / push 사용 금지**. 본 리포지토리의 마이그레이션 원천은
 *   `migrations/NNNN_*.sql` 수동 SQL 이며, 여기에는 Drizzle 이 표현할 수 없는
 *   트리거 12종 + CHECK 제약 + 복합 인덱스 + Temporal Graph 보호 장치가 포함된다.
 *   drizzle-kit 이 schema.ts 와 실제 D1 상태를 diff 하면 이 구조들을 **drop** 한다.
 * - 스키마 변경 절차: (1) `migrations/NNNN_*.sql` 수동 작성 → (2) `wrangler d1
 *   migrations apply` → (3) 본 파일을 SQL 에 맞춰 수동 동기화 (CHECK 제약은 enum
 *   배열로, 트리거는 주석으로만 표현).
 * - drizzle.config.ts 는 의도적으로 생성하지 않는다. 누군가 추가 필요성을 느낀다면
 *   먼저 ADR 로 기존 정책을 번복한 후 진행할 것.
 *
 * ## 테이블 구성
 *
 * 14 tables (base 6 + extension 3 + auth 2 + webhook 1 + audit 1 + rate 1):
 *   knowledge_nodes, knowledge_edges, formulas, constants,
 *   revision_changes, exam_questions,
 *   mnemonic_cards, user_progress, topic_clusters,
 *   users (Phase 1 Step 1-1 — migrations/0006),
 *   webhook_events (Phase 1 Step 1-2 — migrations/0008),
 *   sessions (Phase 1 Step 1-4 — migrations/0009),
 *   status_transitions (Phase 1 Step 1-5 — migrations/0010),
 *   rate_limits (Phase 1 Step 1-5 가-0 — migrations/0012)
 *
 * Temporal Graph pattern: UPDATE 금지 → INSERT + SUPERSEDES edge
 * (users 테이블은 예외 — last_login_at / subscription_* 변경 빈도로 일반 UPDATE 허용)
 * (rate_limits 테이블도 예외 — UPSERT count 증가 고빈도, Temporal 비대상)
 *
 * 상태 전이 패턴 (migrations/0010):
 *   knowledge_nodes/formulas/constants 는 UPDATE 전면 차단되므로
 *   status 전이(draft→review→approved)는 status_transitions append-only 로그로 외부화.
 *   knowledge_nodes.status 컬럼은 INSERT 시 초기 상태 스냅샷으로만 남는다.
 *   실시간 현재 상태는 status_transitions 최신 레코드 (없으면 DEFAULT 'draft').
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { TransitionStatus, TransitionTargetType } from '@thepick/shared';

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
const USER_STATUSES = ['active', 'suspended', 'deleted'] as const;
const SUBSCRIPTION_PLANS = ['single', 'combo', 'all_access'] as const;
const WEBHOOK_PROVIDERS = ['mock', 'polar', 'portone', 'tosspayments'] as const;
const WEBHOOK_STATUSES = ['received', 'processing', 'processed', 'failed'] as const;
const EXAM_SCOPES = ['1st_sub1', '1st_sub2', '1st_sub3', '2nd', 'shared'] as const;
const EXAM_TYPES = ['1st', '2nd'] as const;
const TRANSITION_STATUSES = ['draft', 'review', 'approved', 'flagged'] as const;
const TRANSITION_TARGET_TYPES = ['node', 'formula', 'constant'] as const;
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
  /** 출처 페이지 참조 — 북극성(출처 추적성) 강제. migrations/0010 INSERT 트리거에서 NULL/빈문자열 거부. */
  pageRef: text('page_ref').notNull(),
  batchId: text('batch_id'),
  versionYear: integer('version_year').notNull(),
  supersededBy: text('superseded_by'),
  truthWeight: integer('truth_weight').notNull().default(5),
  /**
   * @deprecated 현재 상태 조회에 **사용하지 말 것** (ADR-010).
   *
   * 본 컬럼은 INSERT 시점의 초기 상태 스냅샷(항상 'draft')일 뿐이며, migrations/0010
   * 트리거 `prevent_nodes_update` 로 UPDATE 가 DB 레벨 차단된다. 실시간 현재 상태
   * 조회는 **반드시** `status_transitions` 최신 레코드를 COALESCE 패턴으로 조회:
   *
   *   COALESCE(
   *     (SELECT to_status FROM status_transitions
   *       WHERE target_type = 'node' AND target_id = knowledge_nodes.id
   *       ORDER BY transitioned_at DESC LIMIT 1),
   *     'draft'
   *   )
   *
   * `node.status === 'approved'` 같은 코드는 항상 false (모든 레코드가 'draft' 스냅샷).
   * Phase 2 이후 DROP 고려.
   */
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
  /** 출처 페이지 참조 — 북극성(출처 추적성) 강제. migrations/0010 INSERT 트리거에서 NULL/빈문자열 거부. */
  pageRef: text('page_ref').notNull(),
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
  /** 출처 페이지 참조 — 북극성(출처 추적성) 강제. migrations/0010 INSERT 트리거에서 NULL/빈문자열 거부. */
  pageRef: text('page_ref').notNull(),
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
// 10. Users (Phase 1 Step 1-1 — migrations/0006)
// L3: PII — password_hash/salt/iterations + subscription 관리
// ---------------------------------------------------------------------------

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'), // v3.0 §7.1 정합 — migrations/0007
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  passwordIterations: integer('password_iterations').notNull(),
  subscriptionPlan: text('subscription_plan', { enum: SUBSCRIPTION_PLANS }),
  subscribedExams: text('subscribed_exams'), // JSON array of ExamId
  subscriptionStartedAt: text('subscription_started_at'),
  subscriptionExpiresAt: text('subscription_expires_at'),
  lastLoginAt: text('last_login_at'),
  status: text('status', { enum: USER_STATUSES }).notNull().default('active'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// 11. Webhook Events (Phase 1 Step 1-2 — migrations/0008)
// PG-중립 수신 로그 + Replay/Idempotency 보장 (ADR-002 §Migrations 연결)
// 비즈니스 payment_events 는 Phase 3 에 별도 테이블 추가 예정.
//
// DB 추가 제약 (Drizzle 에서 선언 불가하여 migrations/0008 에만 존재):
//   - TRIGGER enforce_webhook_events_{provider,event_id,event_type,payload}_not_empty
//   - TRIGGER enforce_webhook_events_status_enum_insert
//   - TRIGGER enforce_webhook_events_status_transition
//     (received → processing → processed|failed; received → failed 직접 전이 허용)
//   - TRIGGER webhook_events_auto_processed_at (status 전이 시 timestamp 자동 설정)
// ---------------------------------------------------------------------------

export const webhookEvents = sqliteTable(
  'webhook_events',
  {
    id: text('id').primaryKey(),
    provider: text('provider', { enum: WEBHOOK_PROVIDERS }).notNull(),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: text('payload').notNull(),
    signature: text('signature'),
    receivedAt: text('received_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    processedAt: text('processed_at'),
    status: text('status', { enum: WEBHOOK_STATUSES }).notNull().default('received'),
    errorMessage: text('error_message'),
  },
  (table) => ({
    // composite UNIQUE — Idempotency/Replay 방어 핵심 (migrations/0008:32)
    providerEventIdUnique: uniqueIndex('webhook_events_provider_event_id_unique').on(
      table.provider,
      table.eventId,
    ),
    // migrations/0008:35-38 과 1:1 대응 (drizzle-kit generate 시 drop 방지)
    statusReceivedAtIdx: index('idx_webhook_events_status').on(table.status, table.receivedAt),
    providerReceivedAtIdx: index('idx_webhook_events_provider').on(
      table.provider,
      table.receivedAt,
    ),
  }),
);

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;

// ---------------------------------------------------------------------------
// 12. Sessions (Phase 1 Step 1-4 — migrations/0009)
// JWT Access (stateless) + Refresh Token (D1-backed, rotation) — ADR-005 §Addendum
//
// DB 추가 제약 (Drizzle 에서 선언 불가하여 migrations/0009 에만 존재):
//   - TRIGGER enforce_sessions_{user_id,refresh_token_hash,expires_at}_not_empty
//   - TRIGGER enforce_sessions_refresh_token_hash_length (SHA-256 hex = 64자)
//   - TRIGGER enforce_sessions_immutable_{user_id,refresh_token_hash,created_at,expires_at}
//     (rotation = INSERT 신규 + UPDATE 이전.revoked_at; 컬럼값 변경 금지)
//   - TRIGGER enforce_sessions_revoked_at_one_way (NULL → timestamp 만, 복원 금지)
// ---------------------------------------------------------------------------

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    lastUsedAt: text('last_used_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),
  },
  (table) => ({
    // rotation 시 새 refresh 의 해시 충돌 방지. migrations/0009 의 명시 UNIQUE INDEX 와 이름 일치 (drift 0).
    refreshTokenHashUnique: uniqueIndex('sessions_refresh_token_hash_unique').on(
      table.refreshTokenHash,
    ),
    // revokeAllUserSessions + 사용자 활성 세션 조회
    userActiveIdx: index('idx_sessions_user_active').on(
      table.userId,
      table.revokedAt,
      table.expiresAt,
    ),
    // TTL cron 삭제 (Step 1-5+). Partial index — migrations/0009 의 WHERE revoked_at IS NULL 절 동기.
    expiresActiveIdx: index('idx_sessions_expires_active')
      .on(table.expiresAt)
      .where(sql`revoked_at IS NULL`),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

// ---------------------------------------------------------------------------
// 13. Status Transitions (Phase 1 Step 1-5 가-0 — migrations/0010)
// append-only 상태 전이 감사 로그.
// knowledge_nodes/formulas/constants 는 UPDATE 전면 차단되므로
// 상태 전이(draft→review→approved)를 별도 테이블에 기록한다.
//
// 최신 상태 조회 패턴:
//   SELECT to_status
//   FROM status_transitions
//   WHERE target_type = ? AND target_id = ?
//   ORDER BY transitioned_at DESC LIMIT 1;
//   (없으면 초기 상태 'draft')
//
// DB 추가 제약 (Drizzle 에서 선언 불가하여 migrations/0010 에만 존재):
//   - TRIGGER prevent_status_transitions_update/delete (append-only 보장)
//   - TRIGGER enforce_status_transitions_*_not_null (target_type/id/statuses/reviewer_id)
//   - TRIGGER enforce_status_transitions_one_way
//     (허용: draft→review→approved, any→flagged; downgrade 금지)
// ---------------------------------------------------------------------------

export const statusTransitions = sqliteTable(
  'status_transitions',
  {
    id: text('id').primaryKey(),
    targetType: text('target_type', { enum: TRANSITION_TARGET_TYPES }).notNull(),
    targetId: text('target_id').notNull(),
    fromStatus: text('from_status', { enum: TRANSITION_STATUSES }).notNull(),
    toStatus: text('to_status', { enum: TRANSITION_STATUSES }).notNull(),
    reviewerId: text('reviewer_id').notNull(),
    reason: text('reason'),
    transitionedAt: text('transitioned_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => ({
    // 최신 상태 조회 핵심 인덱스 (migrations/0010 idx_status_transitions_target 동기)
    targetIdx: index('idx_status_transitions_target').on(
      table.targetType,
      table.targetId,
      table.transitionedAt,
    ),
    reviewerIdx: index('idx_status_transitions_reviewer').on(
      table.reviewerId,
      table.transitionedAt,
    ),
    toStatusIdx: index('idx_status_transitions_to_status').on(table.toStatus, table.transitionedAt),
  }),
);

export type StatusTransition = typeof statusTransitions.$inferSelect;
export type NewStatusTransition = typeof statusTransitions.$inferInsert;
// 런타임 상수는 Drizzle enum 선언용으로 유지하되, 타입은 @thepick/shared 에서 단일 선언.
export type { TransitionTargetType, TransitionStatus };

// ============================================================
// rate_limits — per-user 분 단위 요청 카운터 (migrations/0012)
// ============================================================
// UPSERT 대상, Temporal 예외. count 는 고빈도 증가 (UPDATE 차단 트리거 없음).
// TD-030 enumeration oracle 방어: /api/progress/review 의 404 ↔ 200 분기를
// per-user 분당 요청 상한으로 감쇠.
//
// GC 전략(TD 이월): 24시간 이상 경과한 bucket 은 Cron Trigger 로 주기 삭제 예정.
export const rateLimits = sqliteTable(
  'rate_limits',
  {
    userId: text('user_id').notNull(),
    bucketMinute: text('bucket_minute').notNull(),
    count: integer('count').notNull().default(0),
    lastUpdatedAt: text('last_updated_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.bucketMinute] }),
    bucketIdx: index('idx_rate_limits_bucket').on(table.bucketMinute),
  }),
);

export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;
