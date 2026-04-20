-- ============================================================
-- 쪽집게 스키마 패치 v1.5
-- NOT NULL 트리거 보강 (기술 부채 정리 — Session 8 독립 리뷰 M1-3)
--
-- 배경: 0003 은 knowledge_nodes/formulas/knowledge_edges 만 다뤘음.
-- Drizzle 스키마 .notNull() 선언과 DB 트리거 방어선 갭 해소.
-- Drizzle 이 항상 기본값을 전송하므로 런타임 위험은 낮으나,
-- L3 Hard Limit 대상 테이블(constants 등)은 방어선 완비 필수.
--
-- 대상 테이블:
--   - constants (L3 — "65%를 60%로 잘못 입력 = 서비스 사망")
--   - revision_changes (append-only 감사 로그)
--   - exam_questions (기출 — 정답 안전 Hard Stop)
--   - mnemonic_cards (암기법 카드)
--   - user_progress (PII — 학습 진도)
--   - topic_clusters (농학개론 역공학용)
--
-- 설계 원칙: 0003 과 동일하게 각 (테이블, 컬럼) 마다 독립 trigger.
-- D1 wrangler statement splitter 호환 (SELECT CASE WHEN 사용 금지).
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. constants — L3 Hard Limit 최우선
CREATE TRIGGER IF NOT EXISTS enforce_constants_category_not_null
BEFORE INSERT ON constants
WHEN NEW.category IS NULL
BEGIN
  SELECT RAISE(ABORT, 'constants.category cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_constants_name_not_null
BEFORE INSERT ON constants
WHEN NEW.name IS NULL
BEGIN
  SELECT RAISE(ABORT, 'constants.name cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_constants_value_not_null
BEFORE INSERT ON constants
WHEN NEW.value IS NULL
BEGIN
  SELECT RAISE(ABORT, 'constants.value cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_constants_applies_to_not_null
BEFORE INSERT ON constants
WHEN NEW.applies_to IS NULL
BEGIN
  SELECT RAISE(ABORT, 'constants.applies_to cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_constants_version_year_not_null
BEFORE INSERT ON constants
WHEN NEW.version_year IS NULL
BEGIN
  SELECT RAISE(ABORT, 'constants.version_year cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_constants_created_at_not_null
BEFORE INSERT ON constants
WHEN NEW.created_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'constants.created_at cannot be NULL');
END;

-- 2. revision_changes — append-only 감사 로그
CREATE TRIGGER IF NOT EXISTS enforce_revision_changes_version_year_not_null
BEFORE INSERT ON revision_changes
WHEN NEW.version_year IS NULL
BEGIN
  SELECT RAISE(ABORT, 'revision_changes.version_year cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_revision_changes_revision_date_not_null
BEFORE INSERT ON revision_changes
WHEN NEW.revision_date IS NULL
BEGIN
  SELECT RAISE(ABORT, 'revision_changes.revision_date cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_revision_changes_change_type_not_null
BEFORE INSERT ON revision_changes
WHEN NEW.change_type IS NULL
BEGIN
  SELECT RAISE(ABORT, 'revision_changes.change_type cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_revision_changes_created_at_not_null
BEFORE INSERT ON revision_changes
WHEN NEW.created_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'revision_changes.created_at cannot be NULL');
END;

-- 3. exam_questions — 정답 안전 Hard Stop 대상
CREATE TRIGGER IF NOT EXISTS enforce_exam_questions_year_not_null
BEFORE INSERT ON exam_questions
WHEN NEW.year IS NULL
BEGIN
  SELECT RAISE(ABORT, 'exam_questions.year cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_exam_questions_content_not_null
BEFORE INSERT ON exam_questions
WHEN NEW.content IS NULL
BEGIN
  SELECT RAISE(ABORT, 'exam_questions.content cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_exam_questions_status_not_null
BEFORE INSERT ON exam_questions
WHEN NEW.status IS NULL
BEGIN
  SELECT RAISE(ABORT, 'exam_questions.status cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_exam_questions_created_at_not_null
BEFORE INSERT ON exam_questions
WHEN NEW.created_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'exam_questions.created_at cannot be NULL');
END;

-- 4. mnemonic_cards
CREATE TRIGGER IF NOT EXISTS enforce_mnemonic_cards_target_type_not_null
BEFORE INSERT ON mnemonic_cards
WHEN NEW.target_type IS NULL
BEGIN
  SELECT RAISE(ABORT, 'mnemonic_cards.target_type cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_mnemonic_cards_target_id_not_null
BEFORE INSERT ON mnemonic_cards
WHEN NEW.target_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'mnemonic_cards.target_id cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_mnemonic_cards_memorization_method_not_null
BEFORE INSERT ON mnemonic_cards
WHEN NEW.memorization_method IS NULL
BEGIN
  SELECT RAISE(ABORT, 'mnemonic_cards.memorization_method cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_mnemonic_cards_content_not_null
BEFORE INSERT ON mnemonic_cards
WHEN NEW.content IS NULL
BEGIN
  SELECT RAISE(ABORT, 'mnemonic_cards.content cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_mnemonic_cards_created_at_not_null
BEFORE INSERT ON mnemonic_cards
WHEN NEW.created_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'mnemonic_cards.created_at cannot be NULL');
END;

-- 5. user_progress — PII 포함
CREATE TRIGGER IF NOT EXISTS enforce_user_progress_user_id_not_null
BEFORE INSERT ON user_progress
WHEN NEW.user_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'user_progress.user_id cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_user_progress_card_type_not_null
BEFORE INSERT ON user_progress
WHEN NEW.card_type IS NULL
BEGIN
  SELECT RAISE(ABORT, 'user_progress.card_type cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_user_progress_created_at_not_null
BEFORE INSERT ON user_progress
WHEN NEW.created_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'user_progress.created_at cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_user_progress_updated_at_not_null
BEFORE INSERT ON user_progress
WHEN NEW.updated_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'user_progress.updated_at cannot be NULL');
END;

-- 6. topic_clusters
CREATE TRIGGER IF NOT EXISTS enforce_topic_clusters_name_not_null
BEFORE INSERT ON topic_clusters
WHEN NEW.name IS NULL
BEGIN
  SELECT RAISE(ABORT, 'topic_clusters.name cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_topic_clusters_created_at_not_null
BEFORE INSERT ON topic_clusters
WHEN NEW.created_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'topic_clusters.created_at cannot be NULL');
END;

-- ============================================================
-- 롤백 (비상시 수동 실행)
-- ============================================================
-- DROP TRIGGER IF EXISTS enforce_constants_category_not_null;
-- DROP TRIGGER IF EXISTS enforce_constants_name_not_null;
-- DROP TRIGGER IF EXISTS enforce_constants_value_not_null;
-- DROP TRIGGER IF EXISTS enforce_constants_applies_to_not_null;
-- DROP TRIGGER IF EXISTS enforce_constants_version_year_not_null;
-- DROP TRIGGER IF EXISTS enforce_constants_created_at_not_null;
-- DROP TRIGGER IF EXISTS enforce_revision_changes_version_year_not_null;
-- DROP TRIGGER IF EXISTS enforce_revision_changes_revision_date_not_null;
-- DROP TRIGGER IF EXISTS enforce_revision_changes_change_type_not_null;
-- DROP TRIGGER IF EXISTS enforce_revision_changes_created_at_not_null;
-- DROP TRIGGER IF EXISTS enforce_exam_questions_year_not_null;
-- DROP TRIGGER IF EXISTS enforce_exam_questions_content_not_null;
-- DROP TRIGGER IF EXISTS enforce_exam_questions_status_not_null;
-- DROP TRIGGER IF EXISTS enforce_exam_questions_created_at_not_null;
-- DROP TRIGGER IF EXISTS enforce_mnemonic_cards_target_type_not_null;
-- DROP TRIGGER IF EXISTS enforce_mnemonic_cards_target_id_not_null;
-- DROP TRIGGER IF EXISTS enforce_mnemonic_cards_memorization_method_not_null;
-- DROP TRIGGER IF EXISTS enforce_mnemonic_cards_content_not_null;
-- DROP TRIGGER IF EXISTS enforce_mnemonic_cards_created_at_not_null;
-- DROP TRIGGER IF EXISTS enforce_user_progress_user_id_not_null;
-- DROP TRIGGER IF EXISTS enforce_user_progress_card_type_not_null;
-- DROP TRIGGER IF EXISTS enforce_user_progress_created_at_not_null;
-- DROP TRIGGER IF EXISTS enforce_user_progress_updated_at_not_null;
-- DROP TRIGGER IF EXISTS enforce_topic_clusters_name_not_null;
-- DROP TRIGGER IF EXISTS enforce_topic_clusters_created_at_not_null;
