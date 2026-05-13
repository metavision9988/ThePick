-- ★ Migration 0036 — study_reviews(session_id, user_id) 복합 인덱스 추가
--
-- 트리거: Step 3-UX-6c-2 4-Pass 리뷰 Pass 2 M-1 흡수
--   - apps/api/src/study/routes.ts computeWeakDelta 의 WHERE 조건이
--     `sr.session_id = ? AND sr.user_id = ?` 이나 0034 본문 인덱스는
--     `(user_id, reviewed_at DESC)` + `(card_id, card_type)` 뿐.
--   - 활성 사용자가 수백 건 review 누적 시 user_id lookup 후 session_id
--     post-filter 비용 발생 → 세션 complete 응답 지연.
--
-- 본 인덱스는 SELECT 부하만 영향 (INSERT 비용 최소). 기존 idempotent (IF NOT EXISTS).
-- L2 영역 (스키마 변경 0, 인덱스 ADD only).
--
-- 정합:
--   - 0034 study_reviews 본문 인덱스와 비중복 (조회 패턴 분리)
--   - 0035 streak_records 와 무관 (별도 테이블)

PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_study_reviews_session_user
  ON study_reviews(session_id, user_id);
