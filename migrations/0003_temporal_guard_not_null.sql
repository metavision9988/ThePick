-- ============================================================
-- 쪽집게 스키마 패치 v1.3
-- 1. Temporal Graph 보호: knowledge_nodes/formulas UPDATE 차단 트리거
-- 2. NOT NULL 정렬: Drizzle ORM .notNull() 선언과 SQL 일치
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. Temporal Graph UPDATE 차단 트리거
-- knowledge_nodes와 formulas는 INSERT + SUPERSEDES 엣지 패턴으로만 변경.
-- 직접 UPDATE 시도 시 에러를 발생시켜 데이터 무결성 보호.

CREATE TRIGGER IF NOT EXISTS prevent_knowledge_nodes_update
BEFORE UPDATE ON knowledge_nodes
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on knowledge_nodes is forbidden. Use INSERT + SUPERSEDES edge pattern.');
END;

CREATE TRIGGER IF NOT EXISTS prevent_formulas_update
BEFORE UPDATE ON formulas
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on formulas is forbidden. Use INSERT + SUPERSEDES edge pattern.');
END;

-- 2. NOT NULL 정렬
-- SQL에서 DEFAULT만 있고 NOT NULL이 없던 컬럼들을 Drizzle .notNull()과 일치시킴.
-- SQLite는 ALTER COLUMN을 지원하지 않으므로, 테이블 재생성이 필요하지만
-- D1에서는 Drizzle가 항상 값을 전송하므로 실제 NULL 행은 0건.
-- 향후 테이블 재생성 마이그레이션 시 NOT NULL을 명시적으로 추가할 것.
-- 현 시점에서는 트리거로 NULL 삽입을 차단한다.

CREATE TRIGGER IF NOT EXISTS enforce_knowledge_nodes_not_null
BEFORE INSERT ON knowledge_nodes
BEGIN
  SELECT CASE
    WHEN NEW.status IS NULL THEN RAISE(ABORT, 'knowledge_nodes.status cannot be NULL')
    WHEN NEW.created_at IS NULL THEN RAISE(ABORT, 'knowledge_nodes.created_at cannot be NULL')
    WHEN NEW.updated_at IS NULL THEN RAISE(ABORT, 'knowledge_nodes.updated_at cannot be NULL')
  END;
END;

CREATE TRIGGER IF NOT EXISTS enforce_formulas_not_null
BEFORE INSERT ON formulas
BEGIN
  SELECT CASE
    WHEN NEW.created_at IS NULL THEN RAISE(ABORT, 'formulas.created_at cannot be NULL')
  END;
END;

CREATE TRIGGER IF NOT EXISTS enforce_edges_not_null
BEFORE INSERT ON knowledge_edges
BEGIN
  SELECT CASE
    WHEN NEW.created_at IS NULL THEN RAISE(ABORT, 'knowledge_edges.created_at cannot be NULL')
  END;
END;
