-- ★ Migration 0030 — login_history audit trail
--
-- 트리거: Phase 3 launch chain C-12 (Session 068 Stage C)
--   - 4-Pass + 5-Persona 통합 리뷰 C-12 (Persona4-BCRIT3): users.last_login_at UPDATE = audit trail 단절
--   - GDPR/PIPA 정합: 로그인 이력 보존 (incident forensics 가능)
--
-- 변경 의도:
--   - 기존: UPDATE users SET last_login_at = ? (덮어쓰기 → 이력 0)
--   - 신규: INSERT INTO login_history (이력 누적 → 보존)
--
-- L3 영역: DB 스키마 변경 (CLAUDE.md L3 정합)
-- Plan: docs/plans/phase3-launch-chain.plan.md §3 Stage C
--
-- 정합:
--   - users.last_login_at 컬럼은 **본 마이그레이션에서 유지** (backward-compat).
--     향후 별도 마이그레이션에서 폐기 (현 시점 폐기 시 sessions/검색/admin 다중 영향)
--   - IF NOT EXISTS — 재실행 안전 (idempotent)
--   - PII 최소수집: IP는 hash, user_agent는 truncate (256자 한계)
--   - FK ON DELETE CASCADE — 사용자 삭제 시 이력 동기 삭제 (GDPR right-to-erasure)
--
-- production 적용:
--   wrangler d1 migrations apply thepick-db-production --remote
--   (진산 wrangler 토큰 발화 후 + .claude/reports/production-migration-status.md 영속)

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- A. login_history 테이블 신규
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS login_history (
  id TEXT PRIMARY KEY,                                       -- UUID v4
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- DEFAULT는 ISO 8601 (T 구분 + ms + Z) — toISOString() 포맷과 정합 (0009 sessions.expires_at 패턴).
  -- 코드에서 항상 명시 bind하지만 DEFAULT가 의도치 않게 발동해도 포맷 일관성 보장.
  login_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ip_hash TEXT,                                              -- SHA-256(IP || pepper), NULL 허용 (IP_PEPPER 미설정 시)
  user_agent TEXT                                            -- truncate to USER_AGENT_MAX_LENGTH (256)
);

-- 인덱스: 사용자별 최근 로그인 이력 조회 (admin / user dashboard)
CREATE INDEX IF NOT EXISTS idx_login_history_user_at
  ON login_history(user_id, login_at DESC);

-- 인덱스: 전체 최근 로그인 활동 (admin observability)
CREATE INDEX IF NOT EXISTS idx_login_history_at
  ON login_history(login_at DESC);

-- ---------------------------------------------------------------------------
-- B. NOT NULL 방어 트리거 (0005 패턴 준수)
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS enforce_login_history_user_id_not_null
BEFORE INSERT ON login_history
WHEN NEW.user_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'login_history.user_id cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_login_history_login_at_not_null
BEFORE INSERT ON login_history
WHEN NEW.login_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'login_history.login_at cannot be NULL');
END;
