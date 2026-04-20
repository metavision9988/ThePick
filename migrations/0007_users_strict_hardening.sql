-- ============================================================
-- 쪽집게 스키마 패치 v1.7 — users 엄격 정합 복원 (Step 1-1 4-Pass 리뷰 Critical)
--
-- 근거:
--   - 4-Pass 리뷰 C-6: PBKDF2 iterations 310k → 600k 상향 (ADR-005 원본 정합)
--   - 4-Pass 리뷰 C-7: v3.0 §7.1 `name` 컬럼 복원
--   - 4-Pass 리뷰 C-9: users UPDATE 자동 `updated_at` 갱신 트리거
--
-- 신뢰성 원칙: 자격증 학습 서비스는 계정 탈취 시 학습 이력/결제 정보 유출.
-- OWASP 2024 원본 권장 600k를 엄격 적용.
-- ============================================================

PRAGMA foreign_keys = ON;

-- 1. users.name 컬럼 추가 (v3.0 §7.1 정합)
ALTER TABLE users ADD COLUMN name TEXT;

-- 2. iterations 하한 트리거 교체 (310000 → 600000)
DROP TRIGGER IF EXISTS enforce_users_password_iterations_min;

CREATE TRIGGER enforce_users_password_iterations_min
BEFORE INSERT ON users
WHEN NEW.password_iterations < 600000
BEGIN
  SELECT RAISE(ABORT, 'users.password_iterations must be >= 600000 (OWASP 2024 PBKDF2-SHA256 recommendation)');
END;

-- 3. users UPDATE 시 updated_at 자동갱신 (4-Pass Pass 2 C-1)
-- 호출 측이 updated_at 바인딩을 깜빡 잊어도 감사 추적 보존.
-- 재귀 방지: NEW.updated_at = OLD.updated_at 일 때만 자동 세팅 (수동 세팅 우선).
CREATE TRIGGER IF NOT EXISTS users_auto_update_timestamp
AFTER UPDATE ON users
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================
-- 롤백 (비상시 수동 실행)
-- ============================================================
-- DROP TRIGGER IF EXISTS users_auto_update_timestamp;
-- DROP TRIGGER IF EXISTS enforce_users_password_iterations_min;
-- CREATE TRIGGER enforce_users_password_iterations_min
-- BEFORE INSERT ON users
-- WHEN NEW.password_iterations < 310000
-- BEGIN
--   SELECT RAISE(ABORT, 'users.password_iterations must be >= 310000');
-- END;
-- ALTER TABLE users DROP COLUMN name;  -- SQLite 3.35+ 필요
