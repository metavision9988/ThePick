-- ============================================================
-- 0044 — exam_questions old 525행 처분 상태머신 (인증 1차 학습 오픈 선결 게이트)
-- ============================================================
-- 목적: 오답 36건이 잔존하는 1차 원행(old 525 — 위치라벨 answer·보기 미추출)을
--   status='deprecated' 로 전이하고 superseded_by 로 -MC 서빙 정본을 지시한다.
--   전 학습 표면(status='active' 필터)에서 자연 배제 → C-1 서빙 가드·D-02 전 풀
--   재조회의 데이터 근거 소멸(가드 폐기 = G-OLD-8 별도 커밋).
--
-- 결재: docs/plans/old-rows-retirement-0044.plan.md §9 Q1~Q5 전건
--   (2026-07-12 진산 "권고대로 진행"). 근거 인시던트 =
--   docs/audit/incident-1st-answer-errors-20260710.md.
--
-- 게이트: 적용 전 G-OLD-1~3 / 적용 후 G-OLD-4~7
--   (scripts/verify-old-rows-retirement.mjs — plan §5).
--
-- 트리거 브래킷: 0038 body 가드는 status/superseded_by/valid_* 를 ABORT 하므로
--   마이그 내에서 일시 해제 후 ③에서 **0038:42-64 원문 byte-동일** 재생성(정책 불변).
-- ============================================================

PRAGMA foreign_keys = ON;

-- ① 현행 body 가드 일시 해제 (0044 적용 시점의 현행 = 0038 트리거 —
--    production 은 pending 순차 적용으로 0038 이 본 파일 직전에 적용됨)
DROP TRIGGER IF EXISTS prevent_exam_questions_body_update;
DROP TRIGGER IF EXISTS prevent_exam_questions_update; -- 방어적(0004 잔존 케이스)

-- ② old 525 전이 — 대상 술어 = 1차 + fill_blank + 비-MC id
--    (2026-07-12 실측상 old 525 와 정확 일치, G-OLD-2 가 분모 525 를 기계 검증).
--    superseded_by = -MC 짝 실재 시에만(521건), 구조훼손 4건은 NULL(§9 Q2).
UPDATE exam_questions
   SET status = 'deprecated',
       valid_until = datetime('now'),
       superseded_by = CASE
         WHEN EXISTS (SELECT 1 FROM exam_questions m WHERE m.id = exam_questions.id || '-MC')
           THEN exam_questions.id || '-MC'
         ELSE NULL
       END
 WHERE exam_type = '1st'
   AND input_type = 'fill_blank'
   AND status = 'active'
   AND id NOT LIKE '%-MC';

-- ③ 0038 트리거 원문 재생성 (0038:42-64 byte-동일 — 정책 불변, G-OLD 게이트가 대조)
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
-- 롤백 (비상시 수동 실행 — migrations/ 밖 down 스크립트 정본:
--   docs/runbooks/migration-rollback/0044_rollback.sql. 개요:
--   트리거 브래킷 + UPDATE 역전이 status='active', superseded_by=NULL,
--   valid_until=NULL WHERE status='deprecated' AND exam_type='1st'
--   AND input_type='fill_blank' AND id NOT LIKE '%-MC'.
--   ⚠️ down = old·-MC 이중 active 복귀 — 런북 LIFO + G-OLD-2 재실행 의무)
-- ============================================================
