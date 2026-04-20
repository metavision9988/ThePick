-- ============================================================
-- 쪽집게 스키마 패치 v1.4
-- Temporal Graph 보호 트리거 확장: constants, revision_changes, exam_questions
--
-- 배경: Phase 0 종료 5-페르소나 리뷰 Backend D-1 CRITICAL.
-- 기존 0003 은 knowledge_nodes + formulas 만 UPDATE 차단.
-- 재정립서 Hard Limit "매직 넘버 UPDATE 금지" 와 모순되는 상태.
--
-- 적용 원칙:
--   - constants:        INSERT + 새 version_year 로 대체 (Temporal 패턴)
--   - revision_changes: append-only 로그. UPDATE 절대 금지.
--   - exam_questions:   SUPERSEDES 패턴 + valid_until 설정.
--                       상태 변경(active→deprecated)은 Phase 2 에서
--                       `deprecate_exam_question()` 저장 프로시저로 별도 허용.
--
-- 승인 근거: docs/plans/current.plan.md (2026-04-18)
-- 리뷰 번호: review-20260418-092310 + phase0-tech-debt-20260418-092310
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. constants UPDATE 차단 (L3 — 재정립서 "65%를 60%로 잘못 입력 = 서비스 사망")
CREATE TRIGGER IF NOT EXISTS prevent_constants_update
BEFORE UPDATE ON constants
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on constants is forbidden. Use INSERT with new version_year (Temporal pattern).');
END;

-- 2. revision_changes UPDATE 차단 (append-only 감사 로그)
CREATE TRIGGER IF NOT EXISTS prevent_revision_changes_update
BEFORE UPDATE ON revision_changes
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on revision_changes is forbidden. This table is append-only audit log.');
END;

-- 3. exam_questions UPDATE 차단 (SUPERSEDES 패턴 강제)
-- 주의: status 변경 유즈케이스는 Phase 2 에서 저장 프로시저 별도 설계.
-- 현재 애플리케이션 코드에 UPDATE 사용 0건 확인 (2026-04-18 기준).
CREATE TRIGGER IF NOT EXISTS prevent_exam_questions_update
BEFORE UPDATE ON exam_questions
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on exam_questions is forbidden. Use INSERT + superseded_by + valid_until pattern.');
END;

-- ============================================================
-- 롤백 (비상시 수동 실행)
-- ============================================================
-- DROP TRIGGER IF EXISTS prevent_constants_update;
-- DROP TRIGGER IF EXISTS prevent_revision_changes_update;
-- DROP TRIGGER IF EXISTS prevent_exam_questions_update;
