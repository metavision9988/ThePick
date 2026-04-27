-- ============================================================
-- 쪽집게 스키마 패치 v1.7 (Phase 1 Step 1-5 가-1, Phase 0)
-- 1. is_current_active 컬럼 (Materialized Active View, ADR-013)
-- 2. prevent_X_update 트리거 재정의 (active flip 만 허용)
-- 3. SUPERSEDES → active flip 트리거 (Rule 1 정합 보존)
-- 4. review_decisions 테이블 (Admin Review UI INSERT-only, Rule 31)
--
-- 배경 (2026-04-26):
--   v2.2 6 페르소나 검토 발견:
--   - C-2: is_current_active 컬럼 부재 → BATCH-1 INSERT 즉시 SQL 에러
--   - C-3: review_decisions 테이블 부재 → Admin Review UI 차단
--   - P-C3: prevent_X_update 와 Materialized Active View UPDATE 충돌
--
--   해법:
--   - 0013_active_view_and_review_decisions.sql 신설
--   - prevent_X_update 트리거 화이트리스트 컬럼 (is_current_active 만 UPDATE 허용)
--   - SUPERSEDES INSERT → 구 노드 is_current_active=0 자동 (Materialized Active View)
--
-- 북극성 연결: 운영 RAG 가 재귀 CTE 없이 활성 노드만 조회 → 50ms 이내 응답.
-- 검수 결정은 INSERT-only (Rule 1 정합) — Rollback 도 신규 INSERT.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- PART 1: is_current_active 컬럼 추가 (ADR-013)
-- ============================================================

ALTER TABLE knowledge_nodes ADD COLUMN is_current_active INTEGER NOT NULL DEFAULT 1
  CHECK(is_current_active IN (0, 1));

ALTER TABLE formulas ADD COLUMN is_current_active INTEGER NOT NULL DEFAULT 1
  CHECK(is_current_active IN (0, 1));

ALTER TABLE constants ADD COLUMN is_current_active INTEGER NOT NULL DEFAULT 1
  CHECK(is_current_active IN (0, 1));

-- 활성 노드 조회 인덱스 (운영 RAG 의 핵심 경로)
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_active
  ON knowledge_nodes(is_current_active, status);

CREATE INDEX IF NOT EXISTS idx_formulas_active
  ON formulas(is_current_active);

CREATE INDEX IF NOT EXISTS idx_constants_active
  ON constants(is_current_active);

-- ============================================================
-- PART 2: prevent_X_update 트리거 재정의 (active flip 만 허용)
-- ============================================================
--
-- 기존 (0003/0004): 모든 UPDATE 차단 (RAISE ABORT)
-- 신규 (0013):     is_current_active 플립 (1↔0) 만 허용, 본문 변경 시 ABORT
--
-- 화이트리스트 정책:
--   OLD.is_current_active != NEW.is_current_active (active 플립) → 통과
--   OLD.is_current_active  = NEW.is_current_active (본문 변경) → ABORT
--
-- 위험 시나리오: 같은 UPDATE 안에 active 플립 + 본문 변경 → 본 트리거는 통과시킴.
-- 방어: SUPERSEDES 트리거만 is_current_active 를 변경하도록 application 레이어 강제.
--       application 코드에서 knowledge_nodes 직접 UPDATE 금지 (Drizzle ORM 미허용).
-- ============================================================

DROP TRIGGER IF EXISTS prevent_knowledge_nodes_update;
CREATE TRIGGER prevent_knowledge_nodes_update
BEFORE UPDATE ON knowledge_nodes
WHEN OLD.is_current_active = NEW.is_current_active
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on knowledge_nodes body columns is forbidden. Use INSERT + SUPERSEDES edge pattern. Only SUPERSEDES trigger may flip is_current_active.');
END;

DROP TRIGGER IF EXISTS prevent_formulas_update;
CREATE TRIGGER prevent_formulas_update
BEFORE UPDATE ON formulas
WHEN OLD.is_current_active = NEW.is_current_active
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on formulas body columns is forbidden. Use INSERT + SUPERSEDES edge pattern. Only SUPERSEDES trigger may flip is_current_active.');
END;

DROP TRIGGER IF EXISTS prevent_constants_update;
CREATE TRIGGER prevent_constants_update
BEFORE UPDATE ON constants
WHEN OLD.is_current_active = NEW.is_current_active
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on constants body columns is forbidden. Use INSERT with new version_year (Temporal pattern). Only SUPERSEDES trigger may flip is_current_active.');
END;

-- ============================================================
-- PART 3: SUPERSEDES → active flip 트리거 (Materialized Active View)
-- ============================================================
--
-- 시맨틱 (VERSION_MANAGEMENT.md §3.1):
--   from_node = 신 버전 노드 (superseder)
--   to_node   = 구 버전 노드 (supersedee) — is_current_active=0 으로 자동 갱신
--
-- knowledge_edges 의 from_node/to_node 는 knowledge_nodes(id) 참조 (FK).
-- formulas / constants 의 SUPERSEDES 메커니즘은 knowledge_edges 를 거치지 않으며
-- 마이그레이션 0014 가 자체 superseded_by 컬럼 기반 트리거 (mav_formulas_supersedes_deactivate / mav_constants_supersedes_deactivate) 추가 (Phase 0.5 C-3 해소).
-- ============================================================

CREATE TRIGGER IF NOT EXISTS mav_supersedes_knowledge_nodes_deactivate
AFTER INSERT ON knowledge_edges
WHEN NEW.edge_type = 'SUPERSEDES'
BEGIN
  UPDATE knowledge_nodes
    SET is_current_active = 0
    WHERE id = NEW.to_node AND is_current_active = 1;
END;

-- ============================================================
-- PART 4: review_decisions 테이블 (INSERT-only, Rule 31)
-- ============================================================
--
-- 검수자 (진산님) 의 명시적 결정 기록 (Hard Rule 29):
--   merge / reject / keep_both / rollback / approve / flag
--
-- INSERT-only — Rollback 은 신규 INSERT 패턴 (decision_type='rollback', references_decision_id):
--   원본 결정 (id=R1) INSERT → 24h 또는 다음 BATCH 진입 전 Rollback 가능
--   Rollback 시 (id=R2, decision_type='rollback', references_decision_id=R1) INSERT
--   조회: WHERE references_decision_id IS NULL AND NOT EXISTS (rollback for this id)
--
-- AI 추천 자동 채택 금지 (Hard Rule 29) — ai_recommendation 컬럼은 기록 용도만,
-- decided_at 은 진산님 명시 액션 시각.
-- ============================================================

CREATE TABLE IF NOT EXISTS review_decisions (
  id TEXT PRIMARY KEY,
  decision_type TEXT NOT NULL CHECK(decision_type IN (
    'merge', 'reject', 'keep_both', 'rollback', 'approve', 'flag'
  )),
  target_type TEXT NOT NULL CHECK(target_type IN ('node', 'formula', 'constant', 'edge')),
  target_id TEXT NOT NULL,
  -- merge 의 경우 두 번째 노드 ID
  secondary_target_id TEXT,
  reviewer_id TEXT NOT NULL,
  decision_rationale TEXT,
  -- AI 추천 (기록 용도, 자동 채택 금지 - Hard Rule 29)
  ai_recommendation TEXT CHECK(ai_recommendation IS NULL OR ai_recommendation IN (
    'merge', 'reject', 'keep_both', 'approve', 'flag'
  )),
  ai_confidence REAL CHECK(ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)),
  -- Rollback 체인 (신규 INSERT 패턴)
  references_decision_id TEXT REFERENCES review_decisions(id),
  decided_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Rollback 기한 (Hard Rule 31): 24h 또는 다음 BATCH 진입 전, 큐 3 (CBIV 차단) 은 1h
  rollback_deadline TEXT NOT NULL,
  -- 결정 컨텍스트 메타 (큐 1/2/3 분류 + BATCH 식별)
  queue_id INTEGER NOT NULL CHECK(queue_id IN (1, 2, 3)),
  batch_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_decisions_target
  ON review_decisions(target_type, target_id, decided_at);

CREATE INDEX IF NOT EXISTS idx_review_decisions_reviewer
  ON review_decisions(reviewer_id, decided_at);

CREATE INDEX IF NOT EXISTS idx_review_decisions_references
  ON review_decisions(references_decision_id);

CREATE INDEX IF NOT EXISTS idx_review_decisions_queue
  ON review_decisions(queue_id, decided_at);

CREATE INDEX IF NOT EXISTS idx_review_decisions_deadline
  ON review_decisions(rollback_deadline);

-- INSERT-only 강제 (UPDATE/DELETE 차단)
CREATE TRIGGER IF NOT EXISTS prevent_review_decisions_update
BEFORE UPDATE ON review_decisions
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on review_decisions is forbidden. INSERT-only audit log. Rollback = INSERT new decision with references_decision_id (Hard Rule 1, 31).');
END;

CREATE TRIGGER IF NOT EXISTS prevent_review_decisions_delete
BEFORE DELETE ON review_decisions
BEGIN
  SELECT RAISE(ABORT, 'DELETE on review_decisions is forbidden. INSERT-only audit log.');
END;

-- NOT NULL 방어선
CREATE TRIGGER IF NOT EXISTS enforce_review_decisions_target_id_not_null
BEFORE INSERT ON review_decisions
WHEN NEW.target_id IS NULL OR NEW.target_id = ''
BEGIN
  SELECT RAISE(ABORT, 'review_decisions.target_id cannot be NULL or empty');
END;

CREATE TRIGGER IF NOT EXISTS enforce_review_decisions_reviewer_id_not_null
BEFORE INSERT ON review_decisions
WHEN NEW.reviewer_id IS NULL OR NEW.reviewer_id = ''
BEGIN
  SELECT RAISE(ABORT, 'review_decisions.reviewer_id cannot be NULL or empty');
END;

-- merge 결정 시 secondary_target_id 의무
CREATE TRIGGER IF NOT EXISTS enforce_review_decisions_merge_requires_secondary
BEFORE INSERT ON review_decisions
WHEN NEW.decision_type = 'merge'
  AND (NEW.secondary_target_id IS NULL OR NEW.secondary_target_id = '')
BEGIN
  SELECT RAISE(ABORT, 'review_decisions.secondary_target_id is required for merge decision (two-node merge).');
END;

-- rollback 결정 시 references_decision_id 의무
CREATE TRIGGER IF NOT EXISTS enforce_review_decisions_rollback_requires_reference
BEFORE INSERT ON review_decisions
WHEN NEW.decision_type = 'rollback' AND NEW.references_decision_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'review_decisions.references_decision_id is required for rollback decision (Hard Rule 31, INSERT-only pattern).');
END;

-- ============================================================
-- 롤백 (비상시 수동 실행)
-- ============================================================
-- DROP TRIGGER IF EXISTS mav_supersedes_knowledge_nodes_deactivate;
-- DROP TRIGGER IF EXISTS prevent_review_decisions_update;
-- DROP TRIGGER IF EXISTS prevent_review_decisions_delete;
-- DROP TABLE IF EXISTS review_decisions;
-- 0013 ALTER 컬럼 제거: SQLite 는 DROP COLUMN 미지원 — 신규 마이그레이션 0014 에서 테이블 재생성.
-- 본 마이그레이션의 prevent_X_update 트리거는 0003/0004 의 원본을 덮어쓰므로,
-- 롤백 시 0003/0004 의 트리거 정의를 재실행해야 함.
