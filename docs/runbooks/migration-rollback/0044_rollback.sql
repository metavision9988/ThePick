-- 0044_rollback — exam_questions old 행 처분 역전이 (비상용, 런북 §2 LIFO)
-- ⚠️ 실행 결과 = old 525 + -MC 521 이중 active 복귀(오답 36 재서빙 가능 상태) —
--    실행 후 G-OLD-2 재실행 + 서빙 가드(C-1) 존속 확인 의무.
--
-- ★적용 후 의무 (0026 런북 규약 동일 — 4-Pass MAJOR-2/4):
--   1) d1_migrations 부기 삭제(wrangler 는 forward 만 추적 — 미삭제 시 재적용 불가):
--        DELETE FROM d1_migrations WHERE name LIKE '0044_%';
--   2) handoff/incident 원장에 롤백 사실 영속 + G-OLD-2 재실행.
--   3) ★G-OLD-8(서빙 가드 폐기 커밋) 이후에는 본 롤백 금지 — 코드 차단막이 없어
--      오답 36 이 인증 경로에 무방비 재서빙된다. 그 시점의 유일 안전 경로 =
--      0044 수동 재적용(wrangler d1 execute --file migrations/0044_...sql --remote)
--      또는 가드 커밋 revert 선행 후 롤백.

PRAGMA foreign_keys = ON;

DROP TRIGGER IF EXISTS prevent_exam_questions_body_update;

UPDATE exam_questions
   SET status = 'active',
       valid_until = NULL,
       superseded_by = NULL
 WHERE status = 'deprecated'
   AND exam_type = '1st'
   AND input_type = 'fill_blank'
   AND id NOT LIKE '%-MC';

-- 0038 트리거 재생성 (0038:42-64 byte-동일)
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
