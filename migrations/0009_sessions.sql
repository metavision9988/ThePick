-- ============================================================
-- 쪽집게 스키마 패치 v1.9 — Sessions (Phase 1 Step 1-4)
--
-- 근거:
--   - ADR-005 §Addendum — JWT Phase 2 → Phase 1 조기 도입
--   - Access JWT (HS256 15min) + D1-backed Refresh Token (30day rotation)
--
-- 설계 원칙:
--   - refresh_token_hash: SHA-256 해시만 저장, 원본 절대 미저장
--   - ip_hash: SHA-256(ip + IP_PEPPER), 원본 IP 미저장 (PII 최소화)
--   - revoked_at NULL = active, NOT NULL = revoked (로그아웃/탈취 감지)
--   - UNIQUE(refresh_token_hash) = rotation 시 새 토큰 INSERT 의 원자적 검증
--   - ON DELETE CASCADE (users FK) = 계정 삭제 시 세션 자동 정리
--   - users 테이블은 UPDATE 허용 예외 (ADR-005 본문 — subscription/status 변경)
--     sessions 는 revoked_at UPDATE 만 허용 (운영 메타, SUPERSEDES 무관)
-- ============================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 명시 이름 UNIQUE INDEX — Step 1-3 TD-001 재발 방지.
-- inline UNIQUE 는 SQLite autoindex (sqlite_autoindex_sessions_1) 이름이라
-- Drizzle 명시 이름(sessions_refresh_token_hash_unique)과 drift. 명시 선언.
CREATE UNIQUE INDEX IF NOT EXISTS sessions_refresh_token_hash_unique
  ON sessions(refresh_token_hash);

-- 활성 세션 조회용 (로그인 시 사용자 세션 수 확인, revokeAll 시)
CREATE INDEX IF NOT EXISTS idx_sessions_user_active
  ON sessions(user_id, revoked_at, expires_at);

-- TTL cron 삭제용 (Step 1-5 이후). partial index — Drizzle 선언도 동일 where 절 필요.
CREATE INDEX IF NOT EXISTS idx_sessions_expires_active
  ON sessions(expires_at) WHERE revoked_at IS NULL;

-- ============================================================
-- NOT NULL 방어 트리거 (0008 webhook_events 패턴 준용)
-- ============================================================

CREATE TRIGGER IF NOT EXISTS enforce_sessions_user_id_not_empty
  BEFORE INSERT ON sessions
  WHEN length(trim(NEW.user_id)) = 0
  BEGIN
    SELECT RAISE(ABORT, 'user_id must not be empty');
  END;

CREATE TRIGGER IF NOT EXISTS enforce_sessions_refresh_token_hash_not_empty
  BEFORE INSERT ON sessions
  WHEN length(trim(NEW.refresh_token_hash)) = 0
  BEGIN
    SELECT RAISE(ABORT, 'refresh_token_hash must not be empty');
  END;

-- SHA-256 hex = 정확히 64자
CREATE TRIGGER IF NOT EXISTS enforce_sessions_refresh_token_hash_length
  BEFORE INSERT ON sessions
  WHEN length(NEW.refresh_token_hash) != 64
  BEGIN
    SELECT RAISE(ABORT, 'refresh_token_hash must be 64 hex chars (SHA-256)');
  END;

CREATE TRIGGER IF NOT EXISTS enforce_sessions_expires_at_not_empty
  BEFORE INSERT ON sessions
  WHEN length(trim(NEW.expires_at)) = 0
  BEGIN
    SELECT RAISE(ABORT, 'expires_at must not be empty');
  END;

-- ============================================================
-- UPDATE 허용 범위 제한: revoked_at / last_used_at 만 변경 가능
-- 그 외 컬럼 (user_id, refresh_token_hash, created_at, expires_at) 은 불변
-- ============================================================

CREATE TRIGGER IF NOT EXISTS enforce_sessions_immutable_user_id
  BEFORE UPDATE OF user_id ON sessions
  WHEN OLD.user_id != NEW.user_id
  BEGIN
    SELECT RAISE(ABORT, 'sessions.user_id is immutable');
  END;

CREATE TRIGGER IF NOT EXISTS enforce_sessions_immutable_refresh_token_hash
  BEFORE UPDATE OF refresh_token_hash ON sessions
  WHEN OLD.refresh_token_hash != NEW.refresh_token_hash
  BEGIN
    SELECT RAISE(ABORT, 'sessions.refresh_token_hash is immutable (rotation = INSERT new + UPDATE old.revoked_at)');
  END;

CREATE TRIGGER IF NOT EXISTS enforce_sessions_immutable_created_at
  BEFORE UPDATE OF created_at ON sessions
  WHEN OLD.created_at != NEW.created_at
  BEGIN
    SELECT RAISE(ABORT, 'sessions.created_at is immutable');
  END;

CREATE TRIGGER IF NOT EXISTS enforce_sessions_immutable_expires_at
  BEFORE UPDATE OF expires_at ON sessions
  WHEN OLD.expires_at != NEW.expires_at
  BEGIN
    SELECT RAISE(ABORT, 'sessions.expires_at is immutable');
  END;

-- ============================================================
-- revoked_at 단방향 전이: NULL → timestamp 만 허용, 복원 금지
-- ============================================================

CREATE TRIGGER IF NOT EXISTS enforce_sessions_revoked_at_one_way
  BEFORE UPDATE OF revoked_at ON sessions
  WHEN OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL
  BEGIN
    SELECT RAISE(ABORT, 'sessions.revoked_at cannot be unset (one-way transition)');
  END;

-- ============================================================
-- 롤백 전략
-- ============================================================
-- DROP TRIGGER IF EXISTS enforce_sessions_revoked_at_one_way;
-- DROP TRIGGER IF EXISTS enforce_sessions_immutable_expires_at;
-- DROP TRIGGER IF EXISTS enforce_sessions_immutable_created_at;
-- DROP TRIGGER IF EXISTS enforce_sessions_immutable_refresh_token_hash;
-- DROP TRIGGER IF EXISTS enforce_sessions_immutable_user_id;
-- DROP TRIGGER IF EXISTS enforce_sessions_expires_at_not_empty;
-- DROP TRIGGER IF EXISTS enforce_sessions_refresh_token_hash_length;
-- DROP TRIGGER IF EXISTS enforce_sessions_refresh_token_hash_not_empty;
-- DROP TRIGGER IF EXISTS enforce_sessions_user_id_not_empty;
-- DROP INDEX IF EXISTS idx_sessions_expires_active;
-- DROP INDEX IF EXISTS idx_sessions_user_active;
-- DROP INDEX IF EXISTS sessions_refresh_token_hash_unique;
-- DROP TABLE IF EXISTS sessions;
