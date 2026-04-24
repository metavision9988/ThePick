-- ============================================================
-- 쪽집게 스키마 패치 v1.6 (Phase 1 Step 1-5 가-0)
-- 1. status_transitions 테이블 — 상태 전이 append-only 감사 로그
-- 2. page_ref NOT NULL 강제 트리거 — 출처 추적성 1차 방어선
--
-- 배경 (2026-04-23):
--   0003/0004 에서 knowledge_nodes/formulas/constants UPDATE 가 전면 차단됨.
--   따라서 status 전이(draft→review→approved)를 기존 테이블 UPDATE 로 구현 불가.
--   → append-only status_transitions 로그로 최신 상태를 외부화.
--
--   knowledge_nodes.status 컬럼은 INSERT 시 초기 상태(항상 'draft') 스냅샷 용도로만 남김.
--   formulas/constants 는 status 컬럼이 없으며 전이 로그 단일 진실 원천.
--   현재 상태 조회 = status_transitions 최신 레코드 (없으면 DEFAULT 'draft').
--
-- 북극성 연결: 출처 추적성(page_ref) + 상태 머신 격리(draft 기본) 두 불변이
-- DB 계층에서 타협 없이 강제되어야 "생성물 신뢰성·정확성" 확보 가능.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- PART 1: status_transitions 테이블 (append-only 전이 로그)
-- ============================================================

CREATE TABLE IF NOT EXISTS status_transitions (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK(target_type IN ('node','formula','constant')),
  target_id TEXT NOT NULL,
  from_status TEXT NOT NULL CHECK(from_status IN ('draft','review','approved','flagged')),
  to_status TEXT NOT NULL CHECK(to_status IN ('draft','review','approved','flagged')),
  reviewer_id TEXT NOT NULL,
  reason TEXT,
  transitioned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 최신 상태 조회용 복합 인덱스 (target_type, target_id, transitioned_at DESC)
CREATE INDEX IF NOT EXISTS idx_status_transitions_target
  ON status_transitions(target_type, target_id, transitioned_at);

-- 검수자별 활동 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_status_transitions_reviewer
  ON status_transitions(reviewer_id, transitioned_at);

-- 상태별 필터 (WHERE to_status='approved' 등) 인덱스
CREATE INDEX IF NOT EXISTS idx_status_transitions_to_status
  ON status_transitions(to_status, transitioned_at);

-- status_transitions UPDATE/DELETE 차단 (append-only 감사 로그)
CREATE TRIGGER IF NOT EXISTS prevent_status_transitions_update
BEFORE UPDATE ON status_transitions
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on status_transitions is forbidden. This table is append-only audit log.');
END;

CREATE TRIGGER IF NOT EXISTS prevent_status_transitions_delete
BEFORE DELETE ON status_transitions
BEGIN
  SELECT RAISE(ABORT, 'DELETE on status_transitions is forbidden. This table is append-only audit log.');
END;

-- status_transitions NOT NULL 방어선 (Drizzle .notNull() 와 일치)
CREATE TRIGGER IF NOT EXISTS enforce_status_transitions_target_type_not_null
BEFORE INSERT ON status_transitions
WHEN NEW.target_type IS NULL
BEGIN
  SELECT RAISE(ABORT, 'status_transitions.target_type cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_status_transitions_target_id_not_null
BEFORE INSERT ON status_transitions
WHEN NEW.target_id IS NULL OR NEW.target_id = ''
BEGIN
  SELECT RAISE(ABORT, 'status_transitions.target_id cannot be NULL or empty');
END;

CREATE TRIGGER IF NOT EXISTS enforce_status_transitions_from_status_not_null
BEFORE INSERT ON status_transitions
WHEN NEW.from_status IS NULL
BEGIN
  SELECT RAISE(ABORT, 'status_transitions.from_status cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_status_transitions_to_status_not_null
BEFORE INSERT ON status_transitions
WHEN NEW.to_status IS NULL
BEGIN
  SELECT RAISE(ABORT, 'status_transitions.to_status cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_status_transitions_reviewer_id_not_null
BEFORE INSERT ON status_transitions
WHEN NEW.reviewer_id IS NULL OR NEW.reviewer_id = ''
BEGIN
  SELECT RAISE(ABORT, 'status_transitions.reviewer_id cannot be NULL or empty');
END;

-- 일방향 전이 강제 (downgrade 차단: approved→draft, review→draft 금지)
-- 예외 허용: draft→flagged, review→flagged, approved→flagged (문제 발견 시)
CREATE TRIGGER IF NOT EXISTS enforce_status_transitions_one_way
BEFORE INSERT ON status_transitions
WHEN (NEW.from_status = 'approved' AND NEW.to_status IN ('draft','review'))
  OR (NEW.from_status = 'review' AND NEW.to_status = 'draft')
  OR (NEW.from_status = 'flagged' AND NEW.to_status IN ('draft','review','approved'))
  OR (NEW.from_status = NEW.to_status)
BEGIN
  SELECT RAISE(ABORT, 'Illegal status transition. Allowed: draft→review→approved, any→flagged (one-way).');
END;

-- ============================================================
-- PART 2: page_ref NOT NULL 트리거 (출처 추적성 강제)
-- ============================================================
--
-- 설계 메모:
--   0001 에서 knowledge_nodes/formulas/constants.page_ref 가 nullable 선언됨.
--   SQLite ALTER COLUMN 불가 → 트리거로 INSERT 시 NULL/빈문자열 차단.
--   기존 행(운영 데이터 0건 상태)은 영향 없음. Temporal UPDATE 차단은 유지.
--
--   page_ref 형식: "403" 또는 "403-434" (단일 페이지 혹은 범위).
--   빈 문자열도 거부 — Ontology Lock 이후 2차 방어선.
-- ============================================================

CREATE TRIGGER IF NOT EXISTS enforce_knowledge_nodes_page_ref_not_null
BEFORE INSERT ON knowledge_nodes
WHEN NEW.page_ref IS NULL OR NEW.page_ref = ''
BEGIN
  SELECT RAISE(ABORT, 'knowledge_nodes.page_ref is required (source citation). Use "NNN" or "NNN-MMM" format.');
END;

CREATE TRIGGER IF NOT EXISTS enforce_formulas_page_ref_not_null
BEFORE INSERT ON formulas
WHEN NEW.page_ref IS NULL OR NEW.page_ref = ''
BEGIN
  SELECT RAISE(ABORT, 'formulas.page_ref is required (source citation). Use "NNN" or "NNN-MMM" format.');
END;

CREATE TRIGGER IF NOT EXISTS enforce_constants_page_ref_not_null
BEFORE INSERT ON constants
WHEN NEW.page_ref IS NULL OR NEW.page_ref = ''
BEGIN
  SELECT RAISE(ABORT, 'constants.page_ref is required (source citation). Use "NNN" or "NNN-MMM" format.');
END;

-- ============================================================
-- 롤백 (비상시 수동 실행)
-- ============================================================
-- DROP TABLE IF EXISTS status_transitions;
-- DROP TRIGGER IF EXISTS enforce_knowledge_nodes_page_ref_not_null;
-- DROP TRIGGER IF EXISTS enforce_formulas_page_ref_not_null;
-- DROP TRIGGER IF EXISTS enforce_constants_page_ref_not_null;
