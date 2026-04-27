-- ============================================================
-- 쪽집게 스키마 패치 v1.8 (Phase 0.5 — 4-Pass 리뷰 CRITICAL 7건 정정)
--
-- 배경 (2026-04-26):
--   Phase 0 6 commit 후 Stop hook 강제 4-Pass 리뷰 (5 페르소나 독립 에이전트):
--   - silent-failure-hunter / security / system-architect / quality / code-reviewer
--   - CRITICAL 7건 dedupe (review-20260426-233916-phase0-4pass.md)
--
--   본 마이그레이션은 CRITICAL 6건 (DB 영역) 통합 정정:
--   - C-1: prevent_X_update 화이트리스트 우회 (4 페르소나 합의) — 컬럼별 명시
--   - C-2: DELETE 트리거 부재 — 3 테이블 추가
--   - C-3: formulas/constants SUPERSEDES 트리거 부재 — superseded_by 기반 자동 비활성화
--   - C-5: SUPERSEDES 1단계 순환 가드
--   - C-7: review_decisions reviewer_id 인증 / AI 자동 채택 우회 차단
--
--   C-4 (ADR-013 column drift) 와 C-6 (ai-adapter unit test) 는 별도 작업.
--
-- 북극성 연결:
--   - knowledge_nodes / formulas / constants 본문 변조 = 학습자 잘못된 정답 = 서비스 사망
--   - DB 가 마지막 방어선 — application 레이어 의존 최소화
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- PART 1: prevent_X_update 컬럼별 화이트리스트 재정의 (C-1)
-- ============================================================
--
-- 0013 의 WHEN 조건 ('OLD.is_current_active = NEW.is_current_active') 는
-- active flip + 본문 변경 동시 시 통과. 본문 컬럼별 IS NOT 비교로 강화.
-- IS NOT 는 NULL-safe 비교 (SQLite IS / IS NOT 연산자).
-- ============================================================

DROP TRIGGER IF EXISTS prevent_knowledge_nodes_update;
CREATE TRIGGER prevent_knowledge_nodes_update
BEFORE UPDATE ON knowledge_nodes
WHEN NEW.id IS NOT OLD.id
  OR NEW.type IS NOT OLD.type
  OR NEW.name IS NOT OLD.name
  OR NEW.description IS NOT OLD.description
  OR NEW.lv1_insurance IS NOT OLD.lv1_insurance
  OR NEW.lv2_crop IS NOT OLD.lv2_crop
  OR NEW.lv3_investigation IS NOT OLD.lv3_investigation
  OR NEW.page_ref IS NOT OLD.page_ref
  OR NEW.batch_id IS NOT OLD.batch_id
  OR NEW.version_year IS NOT OLD.version_year
  OR NEW.superseded_by IS NOT OLD.superseded_by
  OR NEW.truth_weight IS NOT OLD.truth_weight
  OR NEW.status IS NOT OLD.status
  OR NEW.exam_scope IS NOT OLD.exam_scope
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on knowledge_nodes body columns is forbidden (Hard Rule 1, Temporal Graph). Use INSERT + SUPERSEDES edge pattern. Only is_current_active may change (Materialized Active View).');
END;

DROP TRIGGER IF EXISTS prevent_formulas_update;
CREATE TRIGGER prevent_formulas_update
BEFORE UPDATE ON formulas
WHEN NEW.id IS NOT OLD.id
  OR NEW.name IS NOT OLD.name
  OR NEW.equation_template IS NOT OLD.equation_template
  OR NEW.equation_display IS NOT OLD.equation_display
  OR NEW.variables_schema IS NOT OLD.variables_schema
  OR NEW.constraints IS NOT OLD.constraints
  OR NEW.expected_inputs IS NOT OLD.expected_inputs
  OR NEW.graceful_degradation IS NOT OLD.graceful_degradation
  OR NEW.page_ref IS NOT OLD.page_ref
  OR NEW.node_id IS NOT OLD.node_id
  OR NEW.version_year IS NOT OLD.version_year
  OR NEW.superseded_by IS NOT OLD.superseded_by
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on formulas body columns is forbidden (Hard Rule 1/2, Temporal Graph). Use INSERT new formula with superseded_by set. Only is_current_active may change.');
END;

DROP TRIGGER IF EXISTS prevent_constants_update;
CREATE TRIGGER prevent_constants_update
BEFORE UPDATE ON constants
WHEN NEW.id IS NOT OLD.id
  OR NEW.category IS NOT OLD.category
  OR NEW.name IS NOT OLD.name
  OR NEW.value IS NOT OLD.value
  OR NEW.numeric_value IS NOT OLD.numeric_value
  OR NEW.applies_to IS NOT OLD.applies_to
  OR NEW.insurance_type IS NOT OLD.insurance_type
  OR NEW.confusion_risk IS NOT OLD.confusion_risk
  OR NEW.confusion_level IS NOT OLD.confusion_level
  OR NEW.unit IS NOT OLD.unit
  OR NEW.page_ref IS NOT OLD.page_ref
  OR NEW.version_year IS NOT OLD.version_year
  OR NEW.exam_frequency IS NOT OLD.exam_frequency
  OR NEW.related_formula IS NOT OLD.related_formula
  OR NEW.exam_scope IS NOT OLD.exam_scope
  OR NEW.superseded_by IS NOT OLD.superseded_by
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on constants body columns is forbidden (Hard Rule 2, Temporal Graph). Use INSERT new constant with superseded_by set. Only is_current_active may change.');
END;

-- ============================================================
-- PART 2: prevent_X_delete 트리거 추가 (C-2)
-- ============================================================
--
-- DELETE 차단 — Temporal Graph audit history 보존.
-- Rollback 도 INSERT 패턴 (Hard Rule 1, 31).
-- ============================================================

CREATE TRIGGER IF NOT EXISTS prevent_knowledge_nodes_delete
BEFORE DELETE ON knowledge_nodes
BEGIN
  SELECT RAISE(ABORT, 'DELETE on knowledge_nodes is forbidden. Temporal Graph audit history must be preserved (Hard Rule 1). Use is_current_active=0 via SUPERSEDES.');
END;

CREATE TRIGGER IF NOT EXISTS prevent_formulas_delete
BEFORE DELETE ON formulas
BEGIN
  SELECT RAISE(ABORT, 'DELETE on formulas is forbidden. Temporal Graph audit history must be preserved (Hard Rule 1/2). Use is_current_active=0 via superseded_by chain.');
END;

CREATE TRIGGER IF NOT EXISTS prevent_constants_delete
BEFORE DELETE ON constants
BEGIN
  SELECT RAISE(ABORT, 'DELETE on constants is forbidden. Temporal Graph audit history must be preserved (Hard Rule 2). Use is_current_active=0 via superseded_by chain.');
END;

-- ============================================================
-- PART 3: formulas / constants SUPERSEDES 자동 비활성화 (C-3)
-- ============================================================
--
-- 0013 가 knowledge_nodes 만 SUPERSEDES 트리거 (knowledge_edges 경유).
-- formulas / constants 는 knowledge_edges FK 와 무관 — 자체 superseded_by 컬럼 사용.
--
-- formulas: superseded_by 이미 존재 (0001).
-- constants: superseded_by 부재 → ALTER TABLE 로 추가.
-- ============================================================

ALTER TABLE constants ADD COLUMN superseded_by TEXT REFERENCES constants(id);

CREATE INDEX IF NOT EXISTS idx_constants_superseded_by ON constants(superseded_by);
CREATE INDEX IF NOT EXISTS idx_formulas_superseded_by ON formulas(superseded_by);

-- formulas: 신규 row INSERT 시 superseded_by 채워졌으면 구 row 비활성화
CREATE TRIGGER IF NOT EXISTS mav_formulas_supersedes_deactivate
AFTER INSERT ON formulas
WHEN NEW.superseded_by IS NOT NULL AND NEW.superseded_by != ''
BEGIN
  UPDATE formulas SET is_current_active = 0
    WHERE id = NEW.superseded_by AND is_current_active = 1;
END;

-- constants: 동일 패턴
CREATE TRIGGER IF NOT EXISTS mav_constants_supersedes_deactivate
AFTER INSERT ON constants
WHEN NEW.superseded_by IS NOT NULL AND NEW.superseded_by != ''
BEGIN
  UPDATE constants SET is_current_active = 0
    WHERE id = NEW.superseded_by AND is_current_active = 1;
END;

-- 자기 참조 차단 (formulas / constants)
CREATE TRIGGER IF NOT EXISTS prevent_formulas_self_supersede
BEFORE INSERT ON formulas
WHEN NEW.superseded_by IS NOT NULL AND NEW.superseded_by = NEW.id
BEGIN
  SELECT RAISE(ABORT, 'formulas.superseded_by cannot reference itself (cyclic versioning).');
END;

CREATE TRIGGER IF NOT EXISTS prevent_constants_self_supersede
BEFORE INSERT ON constants
WHEN NEW.superseded_by IS NOT NULL AND NEW.superseded_by = NEW.id
BEGIN
  SELECT RAISE(ABORT, 'constants.superseded_by cannot reference itself (cyclic versioning).');
END;

-- ============================================================
-- PART 4: SUPERSEDES 1단계 순환 가드 (C-5)
-- ============================================================
--
-- knowledge_edges 의 SUPERSEDES INSERT 시 역방향 엣지 존재 여부 검사:
--   A→B SUPERSEDES 후 B→A SUPERSEDES INSERT 시도 → ABORT.
--   다단계 (A→B→C→A) 는 graph-integrity 검증에서 별도 차단 (DFS).
-- ============================================================

CREATE TRIGGER IF NOT EXISTS prevent_supersedes_reverse_cycle
BEFORE INSERT ON knowledge_edges
WHEN NEW.edge_type = 'SUPERSEDES'
  AND EXISTS (
    SELECT 1 FROM knowledge_edges
    WHERE from_node = NEW.to_node
      AND to_node = NEW.from_node
      AND edge_type = 'SUPERSEDES'
  )
BEGIN
  SELECT RAISE(ABORT, 'SUPERSEDES reverse cycle detected. Versioning must be acyclic — A→B SUPERSEDES already exists, cannot INSERT B→A.');
END;

-- 자기 참조 차단
CREATE TRIGGER IF NOT EXISTS prevent_supersedes_self
BEFORE INSERT ON knowledge_edges
WHEN NEW.edge_type = 'SUPERSEDES' AND NEW.from_node = NEW.to_node
BEGIN
  SELECT RAISE(ABORT, 'SUPERSEDES self-reference is forbidden (from_node = to_node).');
END;

-- ============================================================
-- PART 5: review_decisions reviewer_id 인증 + AI 자동 채택 차단 (C-7)
-- ============================================================
--
-- Hard Rule 29: AI 추천 자동 채택 금지.
-- DB 가 reviewer_id 가 "human session" 인지 보장하는 차단:
--   1. system / ai / auto / batch / bot / admin / root 등 시스템 prefix 차단
--   2. AI 추천 == decision_type 일 때 decision_rationale 필수 (min 10 chars) — 인간 검증 증거
-- ============================================================

CREATE TRIGGER IF NOT EXISTS prevent_review_decisions_system_reviewer
BEFORE INSERT ON review_decisions
WHEN LOWER(NEW.reviewer_id) IN ('system', 'ai', 'auto', 'batch', 'admin', 'root', 'bot', 'service', 'cron', 'worker')
   OR LOWER(NEW.reviewer_id) LIKE 'ai-%'
   OR LOWER(NEW.reviewer_id) LIKE 'system-%'
   OR LOWER(NEW.reviewer_id) LIKE 'auto-%'
   OR LOWER(NEW.reviewer_id) LIKE 'bot-%'
   OR LOWER(NEW.reviewer_id) LIKE 'service-%'
   OR LOWER(NEW.reviewer_id) LIKE 'worker-%'
BEGIN
  SELECT RAISE(ABORT, 'reviewer_id must be a human session identifier. System/AI/auto/batch/bot reviewer IDs are forbidden (Hard Rule 29 — AI 추천 자동 채택 금지).');
END;

CREATE TRIGGER IF NOT EXISTS prevent_review_decisions_ai_silent_adoption
BEFORE INSERT ON review_decisions
WHEN NEW.ai_recommendation IS NOT NULL
  AND NEW.ai_recommendation = NEW.decision_type
  AND (NEW.decision_rationale IS NULL OR LENGTH(TRIM(NEW.decision_rationale)) < 10)
BEGIN
  SELECT RAISE(ABORT, 'When AI recommendation matches decision_type, decision_rationale (min 10 chars) is required to prove human review (Hard Rule 29).');
END;

-- ============================================================
-- 롤백 (비상시 수동 실행)
-- ============================================================
-- DROP TRIGGER IF EXISTS prevent_review_decisions_system_reviewer;
-- DROP TRIGGER IF EXISTS prevent_review_decisions_ai_silent_adoption;
-- DROP TRIGGER IF EXISTS prevent_supersedes_reverse_cycle;
-- DROP TRIGGER IF EXISTS prevent_supersedes_self;
-- DROP TRIGGER IF EXISTS mav_formulas_supersedes_deactivate;
-- DROP TRIGGER IF EXISTS mav_constants_supersedes_deactivate;
-- DROP TRIGGER IF EXISTS prevent_formulas_self_supersede;
-- DROP TRIGGER IF EXISTS prevent_constants_self_supersede;
-- DROP TRIGGER IF EXISTS prevent_knowledge_nodes_delete;
-- DROP TRIGGER IF EXISTS prevent_formulas_delete;
-- DROP TRIGGER IF EXISTS prevent_constants_delete;
-- prevent_X_update 트리거는 0013 의 단순 버전으로 회귀 (수동).
-- constants.superseded_by 컬럼은 SQLite ALTER DROP COLUMN 미지원 — 테이블 재생성 필요.
