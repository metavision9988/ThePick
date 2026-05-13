-- ★ Migration 0037 — exam_questions(exam_type, status, subject) partial composite index
--
-- 트리거: Step 3-UX-6e 5-페르소나 performance-engineer C-P3 흡수
--   - apps/api/src/study/routes.ts GET /api/study/progress subjects 쿼리:
--     `WHERE eq.status = 'active' AND eq.exam_type = ? AND eq.subject IS NOT NULL`
--   - 현 0001 본문 인덱스는 `idx_exam_status(status)` + `idx_exam_type(exam_type)` 단독.
--     SQLite query planner는 보통 둘 중 selectivity 높은 1개만 사용 → 나머지 row-level filter.
--   - exam_questions가 581 row → 미래 5K+ (8회 추가 + 1차 확장) 시 매 호출 풀스캔 수렴.
--
-- 본 partial index는 active + subject NOT NULL 카드만 인덱싱하여 SELECT 부하만 영향
-- (INSERT 비용 최소). 기존 idempotent (IF NOT EXISTS). L2 영역 (스키마 변경 0, 인덱스 ADD only).
--
-- 정합:
--   - 0001 본문 인덱스와 비중복 (조회 패턴 분리, 본 쿼리 전용)
--   - selectivity 높은 exam_type 선두 → status → subject 순서
--   - WHERE status='active' AND subject IS NOT NULL partial → 인덱스 크기 압축

PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_exam_questions_active_subject
  ON exam_questions(exam_type, status, subject)
  WHERE status = 'active' AND subject IS NOT NULL;
