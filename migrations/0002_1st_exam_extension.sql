-- ============================================================
-- 쪽집게 통합 스키마 확장 v1.2 (1차+2차 통합)
-- 기존 0001_initial_schema.sql 위에 적용
-- 신규 테이블 3개 + ALTER TABLE 3건
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. knowledge_nodes 확장: 시험 범위 식별
ALTER TABLE knowledge_nodes ADD COLUMN exam_scope TEXT DEFAULT '2nd';
-- '1st_sub1' = 상법 보험편
-- '1st_sub2' = 농어업재해보험법령
-- '1st_sub3' = 농학개론
-- '2nd'      = 2차 손해평가 이론과 실무
-- 'shared'   = 1차-2차 공유 노드

CREATE INDEX IF NOT EXISTS idx_nodes_scope ON knowledge_nodes(exam_scope);

-- 2. exam_questions 확장: 시험 유형/암기유형/혼동유형
ALTER TABLE exam_questions ADD COLUMN exam_type TEXT DEFAULT '2nd';
-- '1st' | '2nd'

ALTER TABLE exam_questions ADD COLUMN topic_cluster TEXT;
-- 농학개론 역공학용: topic_clusters.id

ALTER TABLE exam_questions ADD COLUMN memorization_type TEXT;
-- 'definition' | 'enumeration' | 'distinction' | 'condition'
-- | 'procedure' | 'numeric' | 'exception' | 'relation'

ALTER TABLE exam_questions ADD COLUMN confusion_type TEXT;
-- 'numeric' | 'decimal_coefficient' | 'date_period' | 'positive_negative'
-- | 'exception' | 'procedure_order' | 'cross_crop' | 'list_omission'

CREATE INDEX IF NOT EXISTS idx_exam_type ON exam_questions(exam_type);
CREATE INDEX IF NOT EXISTS idx_exam_topic ON exam_questions(topic_cluster);

-- 3. constants 확장: 시험 범위 식별
ALTER TABLE constants ADD COLUMN exam_scope TEXT DEFAULT '2nd';

-- 4. 암기법 카드 (신규)
CREATE TABLE IF NOT EXISTS mnemonic_cards (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  confusion_type TEXT,
  memorization_method TEXT NOT NULL,
  content TEXT NOT NULL,
  reverse_verified INTEGER DEFAULT 0,
  exam_scope TEXT,
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mnemonic_target ON mnemonic_cards(target_id);
CREATE INDEX IF NOT EXISTS idx_mnemonic_confusion ON mnemonic_cards(confusion_type);
CREATE INDEX IF NOT EXISTS idx_mnemonic_method ON mnemonic_cards(memorization_method);

-- 5. 학습 진도 (신규 — L3: PII 포함)
CREATE TABLE IF NOT EXISTS user_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  node_id TEXT REFERENCES knowledge_nodes(id),
  card_id TEXT,
  card_type TEXT NOT NULL,
  fsrs_difficulty REAL DEFAULT 0.3,
  fsrs_stability REAL DEFAULT 1.0,
  fsrs_interval INTEGER DEFAULT 1,
  fsrs_next_review TEXT,
  total_reviews INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  last_confusion_type TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_next ON user_progress(fsrs_next_review);
CREATE INDEX IF NOT EXISTS idx_progress_node ON user_progress(node_id);

-- 6. 토픽 클러스터 (농학개론 역공학용, 신규)
CREATE TABLE IF NOT EXISTS topic_clusters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lv1 TEXT,
  lv2 TEXT,
  lv3 TEXT,
  exam_frequency INTEGER DEFAULT 0,
  question_ids TEXT,
  is_covered INTEGER DEFAULT 1,
  source TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_topic_lv1 ON topic_clusters(lv1);
CREATE INDEX IF NOT EXISTS idx_topic_freq ON topic_clusters(exam_frequency DESC);
CREATE INDEX IF NOT EXISTS idx_topic_covered ON topic_clusters(is_covered);
