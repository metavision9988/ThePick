-- ADR-035: PBKDF2 iteration trigger Workers 호환 100k (Phase 2 Eval MVP, Session 065)
--
-- Cloudflare Workers Web Crypto API 제약: PBKDF2 iterations 상한 100,000.
-- ADR-005 OWASP 2024 600k 권고 + 마이그레이션 0007 trigger `< 600000` reject vs
-- Workers runtime 제약 silent drift 발견 (Session 065 진산 G9 register 500 reproduce).
--
-- 본 마이그레이션:
--   1. 기존 trigger `enforce_users_password_iterations_min` (>= 600000 강제) DROP
--   2. 신규 trigger (>= 100000 강제) CREATE — Workers 호환 + minimum 보안 baseline
--
-- ★ Phase 3 launch 직전 Argon2id 또는 외부 hash service 검토 carry-over
--   (ADR-035 §"복원 의무"). 본 trigger는 PBKDF2 환경에 한정.

-- (1) 기존 600k trigger drop
DROP TRIGGER IF EXISTS enforce_users_password_iterations_min;

-- (2) 신규 100k trigger create (Workers 호환 minimum)
CREATE TRIGGER enforce_users_password_iterations_min
BEFORE INSERT ON users
WHEN NEW.password_iterations < 100000
BEGIN
  SELECT RAISE(ABORT, 'users.password_iterations must be >= 100000 (Cloudflare Workers PBKDF2 max, ADR-035)');
END;

-- ROLLBACK (참고, 자동 실행 X)
-- DROP TRIGGER IF EXISTS enforce_users_password_iterations_min;
-- CREATE TRIGGER enforce_users_password_iterations_min
-- BEFORE INSERT ON users
-- WHEN NEW.password_iterations < 600000
-- BEGIN
--   SELECT RAISE(ABORT, 'users.password_iterations must be >= 600000 (OWASP 2024 PBKDF2-SHA256 recommendation)');
-- END;
