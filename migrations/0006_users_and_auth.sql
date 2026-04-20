-- ============================================================
-- 쪽집게 스키마 패치 v1.6 — users 테이블 + 인증 기반
--
-- 근거:
--   - ADR-005 (PBKDF2-SHA256, salt + iterations stored)
--   - ADR-007 §즉시반영 4 (v3.0 §7.1 구독 5컬럼 포함)
--   - Session 8 Step 1-1 L3 plan (docs/plans/current.plan.md)
--
-- 설계 원칙:
--   - Temporal 예외: users 는 변경 빈도(last_login_at, subscription_*)가 높아
--     INSERT + SUPERSEDES 패턴 적용 시 비용 과다 → 일반 UPDATE 허용
--     (temporal guard 트리거 대상 아님)
--   - Drizzle ORM .notNull() 선언과 DB 트리거 방어선 1:1 대응
--   - exam_id 컬럼 없음 (users 는 시험 무관 엔티티 — ADR-007)
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. users 테이블
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,        -- PBKDF2 결과값 (base64)
  password_salt TEXT NOT NULL,        -- 128-bit salt (base64)
  password_iterations INTEGER NOT NULL, -- 310000 (ADR-005)
  -- v3.0 §7.1 구독 컬럼 (ADR-007 §즉시반영 4)
  subscription_plan TEXT CHECK(subscription_plan IN ('single','combo','all_access') OR subscription_plan IS NULL),
  subscribed_exams TEXT,              -- JSON array of ExamId (Year 1: ["son-hae-pyeong-ga-sa"] 또는 NULL)
  subscription_started_at TEXT,       -- ISO 8601, NULL 허용 (미구독자)
  subscription_expires_at TEXT,       -- ISO 8601, NULL 허용
  last_login_at TEXT,                 -- ISO 8601, 최초 회원가입 시 NULL
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','deleted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_subscription_expires ON users(subscription_expires_at) WHERE subscription_expires_at IS NOT NULL;

-- 2. NOT NULL 방어 트리거 (0005 패턴 준수)
CREATE TRIGGER IF NOT EXISTS enforce_users_email_not_null
BEFORE INSERT ON users
WHEN NEW.email IS NULL
BEGIN
  SELECT RAISE(ABORT, 'users.email cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_users_password_hash_not_null
BEFORE INSERT ON users
WHEN NEW.password_hash IS NULL
BEGIN
  SELECT RAISE(ABORT, 'users.password_hash cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_users_password_salt_not_null
BEFORE INSERT ON users
WHEN NEW.password_salt IS NULL
BEGIN
  SELECT RAISE(ABORT, 'users.password_salt cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_users_password_iterations_not_null
BEFORE INSERT ON users
WHEN NEW.password_iterations IS NULL
BEGIN
  SELECT RAISE(ABORT, 'users.password_iterations cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_users_status_not_null
BEFORE INSERT ON users
WHEN NEW.status IS NULL
BEGIN
  SELECT RAISE(ABORT, 'users.status cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_users_created_at_not_null
BEFORE INSERT ON users
WHEN NEW.created_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'users.created_at cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS enforce_users_updated_at_not_null
BEFORE INSERT ON users
WHEN NEW.updated_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'users.updated_at cannot be NULL');
END;

-- 3. email 포맷 최소 검증 (애플리케이션 Zod 검증이 1차, DB는 방어선)
CREATE TRIGGER IF NOT EXISTS enforce_users_email_format
BEFORE INSERT ON users
WHEN NEW.email NOT LIKE '%@%.%'
BEGIN
  SELECT RAISE(ABORT, 'users.email must contain @ and domain');
END;

-- 4. password_iterations 하한 (다운그레이드 공격 방어 — OWASP 2023 권고 최소)
CREATE TRIGGER IF NOT EXISTS enforce_users_password_iterations_min
BEFORE INSERT ON users
WHEN NEW.password_iterations < 310000
BEGIN
  SELECT RAISE(ABORT, 'users.password_iterations must be >= 310000 (OWASP 2023 PBKDF2-SHA256 minimum)');
END;

-- ============================================================
-- 롤백 (비상시 수동 실행)
-- ============================================================
-- DROP TRIGGER IF EXISTS enforce_users_password_iterations_min;
-- DROP TRIGGER IF EXISTS enforce_users_email_format;
-- DROP TRIGGER IF EXISTS enforce_users_updated_at_not_null;
-- DROP TRIGGER IF EXISTS enforce_users_created_at_not_null;
-- DROP TRIGGER IF EXISTS enforce_users_status_not_null;
-- DROP TRIGGER IF EXISTS enforce_users_password_iterations_not_null;
-- DROP TRIGGER IF EXISTS enforce_users_password_salt_not_null;
-- DROP TRIGGER IF EXISTS enforce_users_password_hash_not_null;
-- DROP TRIGGER IF EXISTS enforce_users_email_not_null;
-- DROP INDEX IF EXISTS idx_users_subscription_expires;
-- DROP INDEX IF EXISTS idx_users_status;
-- DROP INDEX IF EXISTS idx_users_email;
-- DROP TABLE IF EXISTS users;
