-- ★ Migration 0034 — study_reviews 신규 (review 이력 trace)
--
-- 트리거: phase3-learning-ux-modes.plan §8.3
--   - packages/srs.scheduleReview 결과 영속 source
--   - cold start replay (packages/srs.replayReviews) source — device sync 복원
--   - admin observability — Phase 3 user 행동 forensics
--
-- L3 영역: 사용자 학습 데이터 PII (CLAUDE.md L3 정합)
-- Plan: docs/plans/migration-0032-0035-learning-ux-schema.plan.md §2.3
--
-- 정합:
--   - FK ON DELETE CASCADE — 사용자 삭제 시 이력 동기 삭제 (GDPR right-to-erasure)
--   - rating CHECK enum — packages/learning-modes FSRS_RATINGS 정합
--   - session_id FK는 0035 적용 후 retroactive 활성 (본 마이그레이션은 NULL 허용)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS study_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  card_type TEXT NOT NULL CHECK (card_type IN ('exam', 'concept')),
  reviewed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  rating TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  interval_days INTEGER NOT NULL,
  stability_before REAL,
  stability_after REAL,
  shuffle_seed TEXT,
  session_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_study_reviews_user_at
  ON study_reviews(user_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_reviews_card
  ON study_reviews(card_id, card_type);

CREATE TRIGGER IF NOT EXISTS enforce_study_reviews_user_id_not_null
BEFORE INSERT ON study_reviews
WHEN NEW.user_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'study_reviews.user_id cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_study_reviews_card_id_not_null
BEFORE INSERT ON study_reviews
WHEN NEW.card_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'study_reviews.card_id cannot be NULL');
END;
