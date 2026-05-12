-- ★ Migration 0033 — user_progress FSRS-4 column 확장 (D7 lock option C)
--
-- 트리거: phase3-learning-ux-modes.plan §8.2 + §13.3 D7 lock
--   - 기존 fsrs_difficulty/stability/interval/next_review 4 컬럼 유지 (column 확장 패턴)
--   - 신규 4 컬럼: reps + lapses + state + last_review
--   - 약점/마스터 컬럼: mastered_at + weak_score
--
-- L3 영역: DB 스키마 변경 + 사용자 학습 데이터 (CLAUDE.md L3 정합)
-- Plan: docs/plans/migration-0032-0035-learning-ux-schema.plan.md §2.2
--
-- backward-compat:
--   - NOT NULL DEFAULT — 기존 row 영향 0
--   - 기존 routes SELECT/INSERT 100% 호환 (column 추가만)
--   - fsrs_state default='new' → packages/srs.createFreshCard 첫 review 정합

PRAGMA foreign_keys = ON;

-- FSRS-4 신규 컬럼 (packages/srs FsrsCardState 매핑)
ALTER TABLE user_progress ADD COLUMN fsrs_reps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_progress ADD COLUMN fsrs_lapses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_progress ADD COLUMN fsrs_state TEXT NOT NULL DEFAULT 'new'
  CHECK (fsrs_state IN ('new', 'learning', 'review', 'relearning'));
ALTER TABLE user_progress ADD COLUMN fsrs_last_review TEXT;

-- 약점/마스터 (D2 lock 정합)
ALTER TABLE user_progress ADD COLUMN mastered_at TEXT;
ALTER TABLE user_progress ADD COLUMN weak_score REAL NOT NULL DEFAULT 0;

-- 약점 우선 정렬 인덱스 (Step 3-UX-5 weak mode 추출 정책)
CREATE INDEX IF NOT EXISTS idx_user_progress_weak
  ON user_progress(user_id, weak_score DESC);

-- 마스터 카드 cool-down 추출 인덱스
CREATE INDEX IF NOT EXISTS idx_user_progress_mastered
  ON user_progress(user_id, mastered_at)
  WHERE mastered_at IS NOT NULL;
