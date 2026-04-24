-- ============================================================
-- 쪽집게 스키마 패치 v1.8 (Phase 1 Step 1-5 가-0)
-- rate_limits 테이블 — per-user 분 단위 요청 카운터.
--
-- 배경 (TD-030, 2026-04-23):
--   /api/progress/review 가 knowledge_nodes.id 존재 여부로 404 ↔ 200 을 분기한다.
--   인증된 악의적 사용자가 이를 oracle 로 사용해 교재 노드 ID 전수 열거 가능.
--   Step 1-5 가 교재 Graph 적재 전에 반드시 차단 (감사 대상).
--
-- 방어 전략:
--   1. per-user 분당 요청 수 제한 (본 테이블)
--   2. 404 응답 전 무작위 지연(jitter) 50~150ms (코드 레벨)
--
-- 스키마:
--   - PK (user_id, bucket_minute) — 1분 단위 고정 윈도우
--   - bucket_minute 는 ISO 8601 의 'YYYY-MM-DDTHH:MM' 접두사 (초 이하 절단)
--   - count 는 해당 분의 요청 수
--
-- UPDATE 허용: rate_limits 는 Temporal Graph 대상 아님 (고빈도 count 증가).
-- 따라서 별도 UPDATE 차단 트리거 없음. UPSERT 패턴 (ON CONFLICT UPDATE) 지원.
-- ============================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rate_limits (
  user_id TEXT NOT NULL,
  bucket_minute TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  last_updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, bucket_minute)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_bucket
  ON rate_limits(bucket_minute);

-- NOT NULL 방어선 — 각 필드 개별 트리거
CREATE TRIGGER IF NOT EXISTS enforce_rate_limits_user_id_not_null
BEFORE INSERT ON rate_limits
WHEN NEW.user_id IS NULL OR NEW.user_id = ''
BEGIN
  SELECT RAISE(ABORT, 'rate_limits.user_id cannot be NULL or empty');
END;

CREATE TRIGGER IF NOT EXISTS enforce_rate_limits_bucket_minute_not_null
BEFORE INSERT ON rate_limits
WHEN NEW.bucket_minute IS NULL OR NEW.bucket_minute = ''
BEGIN
  SELECT RAISE(ABORT, 'rate_limits.bucket_minute cannot be NULL or empty');
END;

-- ============================================================
-- 롤백 (비상시 수동 실행)
-- ============================================================
-- DROP TABLE IF EXISTS rate_limits;
