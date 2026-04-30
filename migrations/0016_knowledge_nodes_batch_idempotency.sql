-- ============================================================
-- 0016_knowledge_nodes_batch_idempotency.sql
--
-- knowledge_nodes 의 BATCH Idempotency 컬럼 + 0014 화이트리스트 갱신
--
-- 배경 (2026-04-28):
--   Engine Hardening 5-페르소나 backend-architect C-1 (`midpoint-20260428-backend.md:18-39`):
--   Step 5 plan v1.0 의 `(batch_run_id, source_id)` UNIQUE 인덱스 전제 컬럼이
--   knowledge_nodes (`migrations/0001_initial_schema.sql:21`) 에 부재 — `batch_id TEXT` 만 존재.
--   Step 11.6 코드 진입 + Step 5 재현성/Idempotency 테스트 진입 전에
--   본 마이그레이션 의무.
--
-- 책임:
--   1. knowledge_nodes 에 batch_run_id (1회 BATCH 실행 UUID) + source_id 컬럼 추가
--   2. (batch_run_id, source_id) partial UNIQUE 인덱스 — Year 1 적재 전 NULL 행 안전
--   3. 0014 prevent_knowledge_nodes_update 트리거 화이트리스트 갱신
--      — batch_run_id/source_id 의 NULL → 값 1회 backfill UPDATE 만 허용
--      — 기존 본문 컬럼 (name/description/page_ref/...) UPDATE 여전히 차단 (Hard Rule 1)
--
-- source_id 정의 (Step 5 plan v1.1):
--   `{page_ref}#{node_id}` — PDF 페이지 참조 + ontology-registry 노드 ID 결합
--   - 결정성: 동일 PDF + 동일 파서 + 동일 ontology → 동일 source_id
--   - 디버깅 가독성: 어떤 페이지의 어떤 노드인지 즉시 식별
--   - idempotency: 동일 BATCH 내 동일 source 노드 1개로 INSERT OR IGNORE
--
-- 근거:
--   - .claude/reviews/midpoint-20260428-backend.md C-1
--   - docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md v1.1
--   - .claude/reviews/review-20260428-171431-p0-fixes-r1q1b3-4pass.md (후보 B)
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- PART 1: knowledge_nodes 컬럼 추가
-- ============================================================
ALTER TABLE knowledge_nodes ADD COLUMN batch_run_id TEXT;
ALTER TABLE knowledge_nodes ADD COLUMN source_id TEXT;

-- ============================================================
-- PART 2: 인덱스 추가
-- ============================================================
-- partial UNIQUE — batch_run_id IS NULL 인 row 는 제외.
-- Year 1 진입 전 기존 row 가 0건이지만, fixture seed / import 등으로 NULL row
-- 가 잠시 존재할 수 있으므로 partial 로 안전하게 적용.
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_nodes_batch_source
  ON knowledge_nodes(batch_run_id, source_id)
  WHERE batch_run_id IS NOT NULL;

-- batch_run_id 단독 인덱스 — recover 시 row scan 방어
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_batch_run_id
  ON knowledge_nodes(batch_run_id);

-- ============================================================
-- PART 3: 0014 prevent_knowledge_nodes_update 트리거 갱신
-- ============================================================
--
-- 변경 의도:
--   - batch_run_id / source_id 의 NULL → 값 backfill UPDATE 만 1회 허용
--   - 값 → 다른 값 / 값 → NULL UPDATE 는 차단 (Hard Rule 1)
--   - 기존 본문 컬럼 (name/description/page_ref/...) UPDATE 는 여전히 차단 (회귀 0건)
--
-- IS / IS NOT 는 NULL-safe 비교 (SQLite). NULL → 값 변환 시:
--   `OLD.batch_run_id IS NOT NULL` = FALSE → WHEN 조건 통과 (본문 미변경 시)
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
  -- 0016 backfill 예외: NULL → 값 1회 허용. 값 → 다른 값 / 값 → NULL 차단.
  OR (OLD.batch_run_id IS NOT NULL AND NEW.batch_run_id IS NOT OLD.batch_run_id)
  OR (OLD.source_id    IS NOT NULL AND NEW.source_id    IS NOT OLD.source_id)
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on knowledge_nodes body columns is forbidden (Hard Rule 1, Temporal Graph). Use INSERT + SUPERSEDES edge pattern. Only is_current_active flip and (batch_run_id/source_id) NULL->value backfill (1회) allowed.');
END;

-- ============================================================
-- 롤백 (비상시 수동 실행)
-- ============================================================
-- DROP INDEX IF EXISTS idx_knowledge_nodes_batch_run_id;
-- DROP INDEX IF EXISTS idx_knowledge_nodes_batch_source;
-- 0014 prevent_knowledge_nodes_update 트리거는 0014 의 본문으로 회귀 (수동 재적용).
-- SQLite 는 ALTER DROP COLUMN 미지원 — knowledge_nodes 테이블 재생성 필요.
