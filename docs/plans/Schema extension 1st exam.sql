-- ============================================================
-- 쪽집게 통합 스키마 확장 v1.2 (1차+2차 통합)
-- 기존 GRAPH_RAG_SCHEMA_v1.sql 위에 적용
-- ============================================================

-- 1. knowledge_nodes 확장: 시험 범위 식별
ALTER TABLE knowledge_nodes ADD COLUMN exam_scope TEXT DEFAULT '2nd';
-- '1st_sub1' = 상법 보험편
-- '1st_sub2' = 농어업재해보험법령
-- '1st_sub3' = 농학개론
-- '2nd'      = 2차 손해평가 이론과 실무
-- 'shared'   = 1차-2차 공유 노드

CREATE INDEX IF NOT EXISTS idx_nodes_scope ON knowledge_nodes(exam_scope);

-- 2. exam_questions 확장: 시험 유형/과목 식별
ALTER TABLE exam_questions ADD COLUMN exam_type TEXT DEFAULT '2nd';
-- '1st' | '2nd'

ALTER TABLE exam_questions ADD COLUMN subject TEXT;
-- '상법보험편' | '농어업재해보험법령' | '농학개론' | '손해평가이론실무'

ALTER TABLE exam_questions ADD COLUMN topic_cluster TEXT;
-- 농학개론 역공학용: 기출에서 추출한 토픽 클러스터 ID

ALTER TABLE exam_questions ADD COLUMN memorization_type TEXT;
-- '정의형' | '나열형' | '구분형' | '조건형' | '절차형' | '수치형' | '예외형' | '관계형'

ALTER TABLE exam_questions ADD COLUMN confusion_type TEXT;
-- '숫자혼동' | '날짜혼동' | '긍부정' | '예외함정' | '절차순서' | '작물교차' | '준용관계' | '나열누락'

CREATE INDEX IF NOT EXISTS idx_exam_type ON exam_questions(exam_type);
CREATE INDEX IF NOT EXISTS idx_exam_subject ON exam_questions(subject);
CREATE INDEX IF NOT EXISTS idx_exam_topic ON exam_questions(topic_cluster);

-- 3. constants 확장: 시험 범위 식별
ALTER TABLE constants ADD COLUMN exam_scope TEXT DEFAULT '2nd';

-- 4. 암기법 매칭 테이블 (신규)
CREATE TABLE IF NOT EXISTS mnemonic_cards (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,           -- 'constant' | 'node' | 'edge_group' | 'formula'
  target_id TEXT NOT NULL,             -- 대상 ID (constants.id, knowledge_nodes.id 등)
  confusion_type TEXT,                 -- 혼동 유형
  memorization_method TEXT NOT NULL,   -- 'acronym' | 'peg_system' | 'memory_palace' | 'story' | 'comparison_table' | 'flowchart' | 'ox_drill' | 'calculation_drill'
  content TEXT NOT NULL,               -- 생성된 암기법 컨텐츠 (JSON)
  reverse_verified INTEGER DEFAULT 0,  -- 역방향 검증 통과 여부 (두문자어→원래항목 복원)
  exam_scope TEXT,
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mnemonic_target ON mnemonic_cards(target_id);
CREATE INDEX IF NOT EXISTS idx_mnemonic_confusion ON mnemonic_cards(confusion_type);
CREATE INDEX IF NOT EXISTS idx_mnemonic_method ON mnemonic_cards(memorization_method);

-- 5. 학습 진도 테이블 (신규)
CREATE TABLE IF NOT EXISTS user_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  node_id TEXT REFERENCES knowledge_nodes(id),
  card_id TEXT,                        -- mnemonic_cards.id 또는 exam_questions.id
  card_type TEXT NOT NULL,             -- 'flashcard' | 'ox' | 'blank' | 'exam' | 'calculation'
  fsrs_difficulty REAL DEFAULT 0.3,
  fsrs_stability REAL DEFAULT 1.0,
  fsrs_interval INTEGER DEFAULT 1,
  fsrs_next_review TEXT,
  total_reviews INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  last_confusion_type TEXT,            -- 마지막 오답의 혼동 유형
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_next ON user_progress(fsrs_next_review);
CREATE INDEX IF NOT EXISTS idx_progress_node ON user_progress(node_id);

-- 6. 토픽 클러스터 테이블 (농학개론 역공학용, 신규)
CREATE TABLE IF NOT EXISTS topic_clusters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                  -- "벼의 이앙시기", "토양pH" 등
  lv1 TEXT,                            -- 재배학 | 원예작물학
  lv2 TEXT,                            -- 재배환경 | 재배기술 | 병충해 등
  lv3 TEXT,                            -- 토양 | 온도 | 광 등
  exam_frequency INTEGER DEFAULT 0,    -- 기출 등장 횟수
  question_ids TEXT,                   -- JSON: 관련 기출 문항 ID 목록
  is_covered INTEGER DEFAULT 1,        -- 기출 커버 여부 (0=미출제 영역)
  source TEXT,                         -- 'exam_reverse' | 'textbook_scan' | 'web_supplement'
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_topic_lv1 ON topic_clusters(lv1);
CREATE INDEX IF NOT EXISTS idx_topic_freq ON topic_clusters(exam_frequency DESC);
CREATE INDEX IF NOT EXISTS idx_topic_covered ON topic_clusters(is_covered);