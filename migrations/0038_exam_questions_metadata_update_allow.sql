-- ============================================================
-- 쪽집게 스키마 패치 — exam_questions 메타데이터 UPDATE 허용 (TR-0)
--
-- 배경: Phase 2 5-페르소나 리뷰 backend C-7 + 이중 게이트 사전심사.
--   0004 의 prevent_exam_questions_update 가 모든 exam_questions UPDATE 를
--   전면 ABORT → G-S5 골든 라벨(related_nodes) 백필 불가 (545 기출 전부 NULL).
--
-- 결정 근거: docs/adr/ADR-046-exam-questions-metadata-update-policy.md
--   진산 결재 (2026-05-29): D-1 default-deny / D-2 status ABORT 유지 / D-3 calc_variables 본문급 ABORT.
--   plan: docs/plans/tr-0-backend-c7-trigger-redesign.plan.md (§2.1 D-1~3 / §5.1 G-TR0-1~12)
--
-- 정책 (default-deny — 화이트리스트 외 전부 ABORT):
--   허용 (메타 화이트리스트 6): related_nodes, related_constants, topic_cluster,
--                                memorization_type, confusion_type, input_type
--   ABORT (보호 16): 본문 8(content/answer/explanation/subject/year/round/question_number/exam_type)
--                  + 상태 4(status/superseded_by/valid_until/valid_from, D-2)
--                  + 답안안전 2(distractors/calc_variables, D-1·D-3)
--                  + 불변 2(id/created_at)
--   ⇒ 본문 변경은 SUPERSEDES(신규 INSERT + superseded_by) 경로 유지 (Temporal Graph 불변).
--
-- SQLite 주의: BEFORE UPDATE 트리거는 SET 절 컬럼을 직접 열거 불가 → 보호 16컬럼을
--   WHEN 절에 NEW.x IS NOT OLD.x (NULL-safe distinct) 로 enumerate. 화이트리스트 6컬럼은
--   WHEN 미포함 → 그 변동은 ABORT 미발동 = 허용. `<>` 가 아닌 `IS NOT` 필수 —
--   nullable 본문(answer/explanation)의 NULL↔값 전이를 `<>` 는 NULL<>x=거짓으로 우회시킴(G-TR0-3).
--   신규 컬럼은 본 WHEN enumeration 에 추가해야 보호됨 (ADR-046 §D-5 체크리스트).
--
-- 적용 게이트: ADR-046 Accepted + plan 정식 결재 + 4-Pass + D1 preview dry-run + G-TR0-1~12 PASS
--   후 진산 Cloudflare 인증(wrangler --remote)으로 production 적용. (L3)
--
-- ★ STATUS (2026-05-30): formal sign-off 완료 — plan approved_by=진산 + ADR-046 Accepted (게이트 #1 해소).
--   검증: G-TR0-1~12 = 28 PASS + 전체 api 671 PASS (회귀 0) + 4-Pass CRITICAL 0
--   (review-20260529-213954-4pass-changes.md). ⛔ production 미적용 — wrangler --remote =
--   진산 Cloudflare 인증 게이트(게이트 #3, 미수행). 적용 후 G-TR0-5/6 production smoke 필수.
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. 기존 전면 ABORT 트리거 제거
DROP TRIGGER IF EXISTS prevent_exam_questions_update;

-- 2. 본문/상태/답안안전/불변 컬럼 변동만 ABORT (메타 화이트리스트 6 허용)
CREATE TRIGGER IF NOT EXISTS prevent_exam_questions_body_update
BEFORE UPDATE ON exam_questions
WHEN (
     NEW.content          IS NOT OLD.content
  OR NEW.answer           IS NOT OLD.answer
  OR NEW.explanation      IS NOT OLD.explanation
  OR NEW.subject          IS NOT OLD.subject
  OR NEW.year             IS NOT OLD.year
  OR NEW.round            IS NOT OLD.round
  OR NEW.question_number  IS NOT OLD.question_number
  OR NEW.exam_type        IS NOT OLD.exam_type
  OR NEW.status           IS NOT OLD.status
  OR NEW.superseded_by    IS NOT OLD.superseded_by
  OR NEW.valid_until      IS NOT OLD.valid_until
  OR NEW.valid_from       IS NOT OLD.valid_from
  OR NEW.distractors      IS NOT OLD.distractors
  OR NEW.calc_variables   IS NOT OLD.calc_variables
  OR NEW.id               IS NOT OLD.id
  OR NEW.created_at       IS NOT OLD.created_at
)
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on exam_questions body/state/immutable columns is forbidden (ADR-046 default-deny). Updatable metadata whitelist: related_nodes, related_constants, topic_cluster, memorization_type, confusion_type, input_type. Use INSERT + superseded_by for body changes.');
END;

-- ============================================================
-- 롤백 (비상시 수동 실행 — backfill 재차단 트레이드오프, plan §7)
-- ============================================================
-- DROP TRIGGER IF EXISTS prevent_exam_questions_body_update;
-- CREATE TRIGGER IF NOT EXISTS prevent_exam_questions_update
-- BEFORE UPDATE ON exam_questions
-- BEGIN
--   SELECT RAISE(ABORT, 'UPDATE on exam_questions is forbidden. Use INSERT + superseded_by + valid_until pattern.');
-- END;
