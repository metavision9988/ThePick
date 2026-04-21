-- ============================================================
-- 쪽집게 스키마 패치 v1.8 — Webhook Events 멱등성 저장 (Phase 1 Step 1-2)
--
-- 근거:
--   - ADR-002 §3 payment_events 추상 스키마 (Phase 3 실구현 전 infra)
--   - ADR-008 §5 Write-path 503 + Retry-After + Idempotency
--   - Phase 1 Step 1-2 plan.md §5 webhook Replay/Idempotency 설계
--
-- 설계 원칙:
--   - UNIQUE (provider, event_id) = Idempotency Key 핵심 제약
--   - Payload 원본 JSON 저장 (감사용) — PCI-DSS 마스킹은 호출 측 책임
--   - status 전이 트리거 (received → processing → processed/failed)
--   - INSERT NOT NULL 방어 5종
--
-- Phase 3 시 payment_events (비즈니스) 테이블 별도 추가 예정 (ADR-002 §Migrations 연결).
-- 본 webhook_events 는 PG-중립 수신 로그 + 멱등성 보장용.
-- ============================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  signature TEXT,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  processed_at TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status
  ON webhook_events(status, received_at);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider
  ON webhook_events(provider, received_at);

-- ============================================================
-- NOT NULL / non-empty 방어 트리거 (0005 스타일 준수)
-- ============================================================

CREATE TRIGGER IF NOT EXISTS enforce_webhook_events_provider_not_empty
BEFORE INSERT ON webhook_events
WHEN NEW.provider IS NULL OR length(trim(NEW.provider)) = 0
BEGIN
  SELECT RAISE(ABORT, 'webhook_events.provider must be non-empty');
END;

CREATE TRIGGER IF NOT EXISTS enforce_webhook_events_event_id_not_empty
BEFORE INSERT ON webhook_events
WHEN NEW.event_id IS NULL OR length(trim(NEW.event_id)) = 0
BEGIN
  SELECT RAISE(ABORT, 'webhook_events.event_id must be non-empty');
END;

CREATE TRIGGER IF NOT EXISTS enforce_webhook_events_event_type_not_empty
BEFORE INSERT ON webhook_events
WHEN NEW.event_type IS NULL OR length(trim(NEW.event_type)) = 0
BEGIN
  SELECT RAISE(ABORT, 'webhook_events.event_type must be non-empty');
END;

CREATE TRIGGER IF NOT EXISTS enforce_webhook_events_payload_not_empty
BEFORE INSERT ON webhook_events
WHEN NEW.payload IS NULL OR length(NEW.payload) = 0
BEGIN
  SELECT RAISE(ABORT, 'webhook_events.payload must be non-empty');
END;

CREATE TRIGGER IF NOT EXISTS enforce_webhook_events_status_enum_insert
BEFORE INSERT ON webhook_events
WHEN NEW.status NOT IN ('received', 'processing', 'processed', 'failed')
BEGIN
  SELECT RAISE(ABORT, 'webhook_events.status must be one of: received, processing, processed, failed');
END;

-- ============================================================
-- Status 전이 가드 (received → processing → processed|failed)
-- ============================================================

CREATE TRIGGER IF NOT EXISTS enforce_webhook_events_status_transition
BEFORE UPDATE OF status ON webhook_events
FOR EACH ROW
WHEN NEW.status != OLD.status AND NOT (
  (OLD.status = 'received'   AND NEW.status IN ('processing', 'processed', 'failed'))
  OR (OLD.status = 'processing' AND NEW.status IN ('processed', 'failed'))
)
BEGIN
  SELECT RAISE(ABORT, 'Invalid webhook_events.status transition');
END;

-- processed_at 자동 갱신 (status = 'processed' | 'failed' 전이 시)
CREATE TRIGGER IF NOT EXISTS webhook_events_auto_processed_at
AFTER UPDATE OF status ON webhook_events
FOR EACH ROW
WHEN NEW.status IN ('processed', 'failed') AND OLD.processed_at IS NULL
BEGIN
  UPDATE webhook_events SET processed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.id;
END;

-- ============================================================
-- 롤백 (비상시 수동 실행)
-- ============================================================
-- DROP TRIGGER IF EXISTS webhook_events_auto_processed_at;
-- DROP TRIGGER IF EXISTS enforce_webhook_events_status_transition;
-- DROP TRIGGER IF EXISTS enforce_webhook_events_status_enum_insert;
-- DROP TRIGGER IF EXISTS enforce_webhook_events_payload_not_empty;
-- DROP TRIGGER IF EXISTS enforce_webhook_events_event_type_not_empty;
-- DROP TRIGGER IF EXISTS enforce_webhook_events_event_id_not_empty;
-- DROP TRIGGER IF EXISTS enforce_webhook_events_provider_not_empty;
-- DROP INDEX IF EXISTS idx_webhook_events_provider;
-- DROP INDEX IF EXISTS idx_webhook_events_status;
-- DROP TABLE IF EXISTS webhook_events;
