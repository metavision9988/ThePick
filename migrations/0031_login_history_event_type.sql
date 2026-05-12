-- ★ Migration 0031 — login_history.event_type 컬럼 (refresh audit 확장)
--
-- 트리거: Session 068 메타 5-페르소나 P-α C-α-2 (refresh rotation audit hole)
--   - 기존 login_history는 login 진입점만 audit → refresh rotation 30일 chain 미커버
--   - stolen refresh token으로 silent 30일 rotation → forensic blind
--   - event_type 컬럼으로 login + refresh 분리 audit
--
-- 변경:
--   - login_history.event_type TEXT NOT NULL DEFAULT 'login' CHECK enum
--   - 기존 row는 모두 'login' (default backfill)
--   - 인덱스 추가 (user_id, event_type, login_at DESC) — 이벤트별 최근 활동
--
-- L3 영역: DB 스키마 변경 (CLAUDE.md L3 정합)
-- Plan: docs/plans/phase3-launch-chain.plan.md §3 Stage E
--
-- production 적용:
--   wrangler d1 migrations apply thepick-db-production --remote
--   (Stage C 0030와 함께 적용 의무 — Stage E commit 후 일괄)

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- A. login_history.event_type 컬럼 추가
-- ---------------------------------------------------------------------------

-- SQLite ALTER TABLE ADD COLUMN은 NOT NULL DEFAULT 가능 (3.32+ / D1 정합)
ALTER TABLE login_history
  ADD COLUMN event_type TEXT NOT NULL DEFAULT 'login'
  CHECK (event_type IN ('login', 'refresh'));

-- ---------------------------------------------------------------------------
-- B. 인덱스 추가 (이벤트별 최근 활동 조회 — admin observability + forensics)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_login_history_event_at
  ON login_history(user_id, event_type, login_at DESC);
