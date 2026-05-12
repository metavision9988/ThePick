-- ★ Migration 0035 — study_sessions + streak_records 신규
--
-- 트리거: phase3-learning-ux-modes.plan §8.4 + §13 D5 lock (게이미피케이션 표준)
--   - 세션 흐름 (warm-up → main → cool-down) — packages/learning-modes session/flow.ts (Step 3-UX-5 후속)
--   - streak 게이미피케이션 (연속 일자 학습 + 일일 목표 + 마스터 비율)
--
-- L3 영역: 사용자 학습 데이터 PII (CLAUDE.md L3 정합)
-- Plan: docs/plans/migration-0032-0035-learning-ux-schema.plan.md §2.4
--
-- 정합:
--   - 0034 study_reviews.session_id retroactive 연결 (본 마이그레이션 후 INSERT 가능)
--   - daily_goal default 20 (D5 lock 정합)
--   - last_study_date YYYY-MM-DD UTC (packages/learning-modes.todayDateString 정합)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ended_at TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('category', 'topic', 'confusion', 'weak', 'mixed')),
  mode_params TEXT,
  phase TEXT NOT NULL DEFAULT 'warmup'
    CHECK (phase IN ('warmup', 'main', 'cooldown', 'completed')),
  cards_planned INTEGER NOT NULL,
  cards_completed INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_started
  ON study_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_study_sessions_active
  ON study_sessions(user_id, ended_at)
  WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS streak_records (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_study_date TEXT,
  daily_goal INTEGER NOT NULL DEFAULT 20
);

CREATE TRIGGER IF NOT EXISTS enforce_study_sessions_user_id_not_null
BEFORE INSERT ON study_sessions
WHEN NEW.user_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'study_sessions.user_id cannot be NULL');
END;
