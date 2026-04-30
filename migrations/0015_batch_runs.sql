-- 0015_batch_runs.sql
-- BATCH 파이프라인 실행 추적 + Idempotency 메타테이블
--
-- 근거:
--   - docs/plans/engine-hardening/step6-recover-snapshot.plan.md
--   - docs/adr/ADR-023 (Engine-First Before BATCH-1)
--   - VOID ENGINE DESIGN CONSTITUTION v3.0 Vol V.4 (Recovery 결정 트리)
--
-- 책임:
--   1. batch_run_id 별 실행 상태 추적 (in_progress / completed / failed / killed / recovered)
--   2. recover() 시 stale lock 감지 (24시간 초과 시 resume 허용)
--   3. Idempotency 차단 — 동일 batch_run_id 재실행 시 state 검사로 skip 또는 reject
--   4. Step 5 (Reproducibility/Idempotency) 의 (batch_run_id, source_id) 유니크 제약 기반

CREATE TABLE IF NOT EXISTS batch_runs (
  batch_run_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,                        -- ISO 8601 UTC
  completed_at TEXT,                                -- NULL = 진행 중 또는 비정상 종료
  last_completed_stage TEXT NOT NULL,               -- PipelineStage enum (10개)
  last_node_id TEXT,                                -- 마지막 INSERT 된 노드 (Idempotency 키)
  state TEXT NOT NULL                               -- batch_run state
    CHECK (state IN ('in_progress', 'completed', 'failed', 'recovered', 'killed')),
  resume_count INTEGER NOT NULL DEFAULT 0,          -- recover() 호출 누적 횟수
  fixture_path TEXT NOT NULL,                       -- 적재 대상 PDF 경로
  state_hash TEXT NOT NULL,                         -- 마지막 checkpoint 의 SHA-256
  engine_version TEXT NOT NULL                      -- @thepick/batch package.json version
);

-- state 별 조회 인덱스 — recover() 시 stale lock 감지 + 운영 대시보드
CREATE INDEX IF NOT EXISTS idx_batch_runs_state ON batch_runs(state);

-- started_at 인덱스 — 24시간 stale lock 감지 시 사용
CREATE INDEX IF NOT EXISTS idx_batch_runs_started_at ON batch_runs(started_at);

-- engine_version 인덱스 — 버전별 통계 + Migration 추적
CREATE INDEX IF NOT EXISTS idx_batch_runs_engine_version ON batch_runs(engine_version);

-- Idempotency 트리거 — completed 후에는 동일 PK 재INSERT 차단 (애플리케이션 레벨에서도 검증)
-- (D1 SQLite 는 트리거 지원 — 이중 방어)
CREATE TRIGGER IF NOT EXISTS trg_batch_runs_no_duplicate_completed
BEFORE INSERT ON batch_runs
WHEN EXISTS (
  SELECT 1 FROM batch_runs
  WHERE batch_run_id = NEW.batch_run_id
    AND state = 'completed'
)
BEGIN
  SELECT RAISE(ABORT, 'batch_runs: cannot re-insert completed batch_run_id (Idempotency violation)');
END;

-- v1.1 정정 (4-Pass review CRITICAL P1-C1): BEFORE UPDATE 트리거 추가
-- completed 상태에서 다른 상태로의 하향 전이 차단 — 정상 BATCH 흐름은 'in_progress' → 'completed' 만 허용,
-- 'completed' → 'in_progress' 또는 'killed' 같은 비정상 전이 차단.
CREATE TRIGGER IF NOT EXISTS trg_batch_runs_no_state_downgrade
BEFORE UPDATE OF state ON batch_runs
WHEN OLD.state = 'completed' AND NEW.state != 'completed'
BEGIN
  SELECT RAISE(ABORT, 'batch_runs: cannot transition out of completed state (Idempotency violation)');
END;

-- recover() atomicity 보강 — 'recovered' 로의 전이는 'completed' 에서만 차단.
--
-- 정정 (2026-04-28, 5-페르소나 backend-architect B-C3):
--   원안 `OLD.state NOT IN ('killed', 'failed')` 은 stale 24h+ 'in_progress' 의 정상
--   recover 경로 (recover.ts:131-149) 까지 ABORT — 결함.
--
--   본 정정은 'completed' 만 명시 차단. 'in_progress' / 'killed' / 'failed' / 'recovered'
--   에서의 전이는 허용 (stale lock recover 정상 경로 + recover 재진입 허용).
--
-- Concurrent run guard 책임:
--   - SQL 레벨: 본 트리거 (completed 차단) + trg_batch_runs_no_state_downgrade (downgrade 차단)
--   - Application 레벨: recover.ts 가 elapsedMs vs STALE_LOCK_THRESHOLD_MS 비교
--     (24h 미만 'in_progress' → status='concurrent_run_detected' 반환, 24h+ → recover 진행)
--
-- 본 트리거 + 0014 의 trg_batch_runs_no_state_downgrade 는 'completed' → 'recovered'
-- 차단 영역에서 중복 (defense in depth). 본 트리거가 명시 메시지로 운영 가독성 보강.
--
-- 정정 (2026-04-28, P0-SA-M2 system-architect 권고):
--   B-C3 정정 과정에서 트리거 이름이 v1.0 옛 이름 (`trg_batch_runs_recover_only_from_terminal`)
--   에서 v1.1 새 이름 (`trg_batch_runs_recover_only_from_non_completed`) 으로 변경됨.
--   SQLite `CREATE TRIGGER IF NOT EXISTS` 는 이름 기반 idempotency — 옛 이름이 이미 deploy
--   된 환경에서는 옛 트리거 (옛 본문 `OLD.state NOT IN ('killed', 'failed')`) 가 잔존하여
--   stale 24h+ in_progress recover 경로를 ABORT — 결함 재발.
--
--   현재 0015 는 untracked (deploy 전) 상태이지만, production 진입 시 안전망으로
--   옛 이름의 DROP IF EXISTS 한 줄을 명시한다 (no-op 시 비용 0).
DROP TRIGGER IF EXISTS trg_batch_runs_recover_only_from_terminal;

CREATE TRIGGER IF NOT EXISTS trg_batch_runs_recover_only_from_non_completed
BEFORE UPDATE OF state ON batch_runs
WHEN NEW.state = 'recovered' AND OLD.state = 'completed'
BEGIN
  SELECT RAISE(ABORT, 'batch_runs: cannot recover completed run (Idempotency violation)');
END;
