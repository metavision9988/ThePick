-- [migrations-v2 정본] exam-generic — 1호 인스턴스 동치본: migrations/0041_revision_watch_phase0_effective_date.sql
-- 신규 종목 D1 인스턴스화 시 이 파일을 순서대로 적용 (종목 하드코딩 0 — Hard Rule 16/17).
-- Migration 0041: Revision Watch Phase 0 — 시행시점(effective_date) 축 신설 (GAP-RW-1)
-- ============================================================
-- STATUS: 선작성본 (formal sign-off 대기) — §9 위임 결재(2026-07-07) 근거 SQL 작성.
--   production 적용(wrangler --remote) = 진산 인증 게이트 별도 (TR-0/0038 선례).
-- 정책 출처: docs/plans/revision-watch.plan.md §5 (Q3 위임 결재 = B안 knowledge_nodes valid_from)
--   + §9 Q7 (exam-generic 정본 = migrations-v2/revision-watch/, 본 파일 = 1호 인스턴스 적용본)
--
-- 무엇을:
--   1) knowledge_nodes/formulas/constants 에 valid_from/valid_until (전부 nullable = additive)
--      + knowledge_nodes 에 source_url/source_article_code (law.go.kr DRF 앵커 — 출처 추적성)
--   2) revision_changes 에 effective_date/exam_id/source_ref/status (GAP-RW-1/5)
--   3) ★UPDATE 가드 재구축 — 신규 컬럼은 기존 WHEN 화이트리스트 밖 = UPDATE 무방비가 되므로
--      0016 백필 선례(NULL→값 1회 허용, 값→값·값→NULL 차단)로 잠근다.
--      Phase 2 백필(4 미시행 노드 LAW-022/023/053/INV-087 valid_from='2026-08-15')의 합법 경로.
--
-- 하지 않는 것:
--   - 학습자 경로 필터 배선(approved-nodes-sql·enrichRelatedNodes·vectorize) = Phase 0 후속 코드(별건 커밋)
--   - revision_changes UPDATE 개방 없음 — 0004 전면 ABORT 유지(개정 워크플로우 상태는 Phase 4
--     revision_review_queue 소관, CREATE TABLE = 결재 후 별건)
--   - knowledge_edges 가드 = WS-2b 슬롯 0039 별건(§9 Q2 스코프 아님 — 이중 구현 금지)
-- ============================================================

-- ---------- 1) 시행시점 축 컬럼 (additive · nullable) ----------
ALTER TABLE knowledge_nodes ADD COLUMN valid_from TEXT;
ALTER TABLE knowledge_nodes ADD COLUMN valid_until TEXT;
ALTER TABLE knowledge_nodes ADD COLUMN source_url TEXT;
ALTER TABLE knowledge_nodes ADD COLUMN source_article_code TEXT;

ALTER TABLE formulas ADD COLUMN valid_from TEXT;
ALTER TABLE formulas ADD COLUMN valid_until TEXT;

ALTER TABLE constants ADD COLUMN valid_from TEXT;
ALTER TABLE constants ADD COLUMN valid_until TEXT;

-- ---------- 2) revision_changes 확장 (GAP-RW-1/5) ----------
ALTER TABLE revision_changes ADD COLUMN effective_date TEXT;
ALTER TABLE revision_changes ADD COLUMN exam_id TEXT;
ALTER TABLE revision_changes ADD COLUMN source_ref TEXT;
ALTER TABLE revision_changes ADD COLUMN status TEXT;

-- ---------- 3) 조회 인덱스 (학습자 경로 필터 대비) ----------
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_valid_from ON knowledge_nodes(valid_from);
CREATE INDEX IF NOT EXISTS idx_revision_changes_effective ON revision_changes(effective_date);

-- ---------- 4) knowledge_nodes 가드 재구축 (0016 본문 + 신규 4컬럼 백필 패턴) ----------
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
  -- 0041 봉합(독립 리뷰 wf_83d2aa9a MAJOR — 선재 0019 구멍): 출처 앵커 4컬럼 + created_at 은
  -- 어느 재구축에도 미등재라 값→값·값→NULL 이 무음 통과였음(실측). 사용자 노출 1급 앵커
  -- (study 라우트 실서빙) → 하드 차단. updated_at 은 관례적 메타컬럼으로 미차단(의도 기록).
  OR NEW.book_page IS NOT OLD.book_page
  OR NEW.pdf_page IS NOT OLD.pdf_page
  OR NEW.chapter IS NOT OLD.chapter
  OR NEW.section IS NOT OLD.section
  OR NEW.created_at IS NOT OLD.created_at
  -- 0016 backfill 예외: NULL → 값 1회 허용. 값 → 다른 값 / 값 → NULL 차단.
  OR (OLD.batch_run_id IS NOT NULL AND NEW.batch_run_id IS NOT OLD.batch_run_id)
  OR (OLD.source_id    IS NOT NULL AND NEW.source_id    IS NOT OLD.source_id)
  -- 0041: 시행시점 축·출처 앵커 — 동일 백필 패턴 (Phase 2 backfill = NULL→값 1회, 이후 불변)
  OR (OLD.valid_from          IS NOT NULL AND NEW.valid_from          IS NOT OLD.valid_from)
  OR (OLD.valid_until         IS NOT NULL AND NEW.valid_until         IS NOT OLD.valid_until)
  OR (OLD.source_url          IS NOT NULL AND NEW.source_url          IS NOT OLD.source_url)
  OR (OLD.source_article_code IS NOT NULL AND NEW.source_article_code IS NOT OLD.source_article_code)
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on knowledge_nodes body columns is forbidden (Hard Rule 1, Temporal Graph). Use INSERT + SUPERSEDES edge pattern. Only is_current_active flip and (batch_run_id/source_id/valid_from/valid_until/source_url/source_article_code) NULL->value backfill (1회) allowed.');
END;

-- ---------- 5) formulas 가드 재구축 (0014 본문 + valid_from/until 백필 패턴) ----------
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
  OR (OLD.valid_from  IS NOT NULL AND NEW.valid_from  IS NOT OLD.valid_from)
  OR (OLD.valid_until IS NOT NULL AND NEW.valid_until IS NOT OLD.valid_until)
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on formulas body columns is forbidden (Hard Rule 1/2, Temporal Graph). Use INSERT new formula with superseded_by set. Only is_current_active and valid_from/valid_until NULL->value backfill (1회) may change.');
END;

-- ---------- 6) constants 가드 재구축 (0014 본문 + valid_from/until 백필 패턴) ----------
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
  OR (OLD.valid_from  IS NOT NULL AND NEW.valid_from  IS NOT OLD.valid_from)
  OR (OLD.valid_until IS NOT NULL AND NEW.valid_until IS NOT OLD.valid_until)
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on constants body columns is forbidden (Hard Rule 2, Temporal Graph). Use INSERT new constant with superseded_by set. Only is_current_active and valid_from/valid_until NULL->value backfill (1회) may change.');
END;

-- ============================================================
-- 롤백 (비상시 수동): SQLite ALTER DROP COLUMN 미지원 — 컬럼은 잔류(nullable·무해).
--   트리거는 0016/0014 본문으로 재적용. 인덱스 DROP INDEX 2건.
-- ============================================================
