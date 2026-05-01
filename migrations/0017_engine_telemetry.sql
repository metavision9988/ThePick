-- ============================================================
-- 0017_engine_telemetry.sql
--
-- Engine Observability v1 — append-only 시계열 fact table
--
-- 배경 (2026-05-01, Step 19 Phase 1 종료 게이트):
--   진산님 메모리 `project_engine_observability` 명시 — "자동차 계기판 메타포로
--   8 게이지 (BATCH 진척/Cost/D1 SLO/Graph 무결성/품질 게이트/Formula 정확도/
--   Reviewer 큐/학습 SLO) 상시 모니터링/로그". Cloudflare 단일 벤더 정합 (D1 +
--   admin-web + Workers Analytics).
--
--   ROADMAP §8 line 510 "Engine Observability 8 게이지 가동" 충족 의무.
--   Step 19 = Phase 1 종료 = ROADMAP 100% 진입 게이트.
--
-- 책임:
--   1. engine_telemetry — 단일 fact table (gauge_name + metric_value + metric_json)
--      - 8 게이지 모두 동일 shape (게이지 추가 시 마이그레이션 불필요)
--      - append-only (UPDATE/DELETE 트리거 차단 — defense-in-depth)
--   2. exam_id NOT NULL — Hard Rule 16/17 Year 2 zero-cost 정합 (마이그레이션 0005
--      도입 시 동일 패턴 — engine_telemetry 는 신설이라 처음부터 NOT NULL)
--   3. 3 인덱스 — gauge별 타임라인 / exam별 / batch_run별 (BATCH 컨텍스트 추적)
--   4. CHECK 제약 — gauge_name enum 8개 + metric_value/metric_json 최소 1개
--      (둘 다 NULL 차단 — 빈 telemetry 이벤트 0건)
--
-- gauge_name enum (Phase 1: 1~7 활성 / Phase 2: 8 활성):
--   1. batch_progress    — 0~1 (적재 진척 비율)
--   2. cost              — micro_cents (Anthropic 토큰 누적)
--   3. d1_slo            — latency_ms (p95)
--   4. graph_integrity   — violations_count (≥ 0, 0 = PASS)
--   5. quality_gate      — pass_count (8 카테고리 PASS 수)
--   6. formula_accuracy  — 1.0 (PASS) / 0.0 (FAIL)
--   7. reviewer_queue    — queue_size (검수 대기)
--   8. learning_slo      — sessions_per_user_p95 (Phase 2 활성)
--
-- 근거:
--   - docs/plans/engine-hardening/step19-observability.plan.md §3
--   - 진산님 메모리 project_engine_observability + project_completion_notification_obligation
--   - ROADMAP v1.3 §8 line 510 (Engine Observability 8 게이지 가동)
--   - Hard Rule 16/17 (NOT NULL exam_id Year 2 zero-cost 전환 정합)
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- PART 1: engine_telemetry 테이블 신설
-- ============================================================
--
-- FK 부재 의도 (MAJOR-A2 흡수, Step 19 Pass 1+2):
--   batch_run_id / source_id 는 batch_runs / knowledge_nodes 와 lifecycle 차이.
--   - engine_telemetry: 1년 보존 (Phase 2 Cron GC 정책, master-dashboard.md §3)
--   - batch_runs: 무제한 (Year 2 분석/감사 용도)
--   - knowledge_nodes: 무제한 (Temporal Graph SUPERSEDES 패턴)
--   FK 설정 시 GC 시점에 batch_runs 잔존 의무 → 보존 정책 충돌. FK 부재로 텔레메트리 GC
--   독립성 보장. 무결성은 application 측 (write-helper.ts) 검증으로 대체.
-- ============================================================

CREATE TABLE IF NOT EXISTS engine_telemetry (
  id TEXT PRIMARY KEY NOT NULL,
  exam_id TEXT NOT NULL,
  gauge_name TEXT NOT NULL,
  metric_value REAL,
  metric_json TEXT,
  source_id TEXT,
  batch_run_id TEXT,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (gauge_name IN (
    'batch_progress',
    'cost',
    'd1_slo',
    'graph_integrity',
    'quality_gate',
    'formula_accuracy',
    'reviewer_queue',
    'learning_slo'
  )),
  CHECK (metric_value IS NOT NULL OR metric_json IS NOT NULL)
);

-- ============================================================
-- PART 2: 인덱스 3종
-- ============================================================

-- 게이지별 최근 N건 타임라인 — admin-web /telemetry 메인 쿼리
CREATE INDEX IF NOT EXISTS idx_engine_telemetry_gauge_recorded
  ON engine_telemetry(gauge_name, recorded_at DESC);

-- 시험별 게이지 격리 (Hard Rule 16) — Year 2 multi-tenant 진입 시 필수
CREATE INDEX IF NOT EXISTS idx_engine_telemetry_exam_gauge
  ON engine_telemetry(exam_id, gauge_name, recorded_at DESC);

-- batch_run 컨텍스트 추적 (BATCH 1회 실행의 모든 게이지 타임라인 재구성)
CREATE INDEX IF NOT EXISTS idx_engine_telemetry_batch_run
  ON engine_telemetry(batch_run_id)
  WHERE batch_run_id IS NOT NULL;

-- ============================================================
-- PART 3: append-only 트리거 (defense-in-depth)
-- ============================================================
--
-- 설계 의도:
--   engine_telemetry 는 시계열 fact table. UPDATE/DELETE 자체가 의미 없음
--   (이미 발생한 측정값 수정 = 데이터 위조). 트리거로 명시 차단.
--
--   knowledge_nodes Hard Rule 1 (Temporal Graph) 와 동일 패턴이지만, engine_telemetry
--   는 backfill 예외 0건 — 처음부터 모든 컬럼 INSERT 시 확정.
--
--   Phase 2 GC (1년 보존) 정책 도입 시 wrangler d1 execute 수동 override 필요
--   (자동 GC = Cron Trigger 등은 별도 plan + 트리거 일시 비활성).
-- ============================================================

DROP TRIGGER IF EXISTS prevent_engine_telemetry_update;
CREATE TRIGGER prevent_engine_telemetry_update
BEFORE UPDATE ON engine_telemetry
BEGIN
  SELECT RAISE(ABORT, 'UPDATE on engine_telemetry is forbidden (append-only fact table). Use INSERT for new readings. Phase 2 retention policy via wrangler d1 execute manual override only.');
END;

DROP TRIGGER IF EXISTS prevent_engine_telemetry_delete;
CREATE TRIGGER prevent_engine_telemetry_delete
BEFORE DELETE ON engine_telemetry
BEGIN
  SELECT RAISE(ABORT, 'DELETE on engine_telemetry is forbidden (append-only fact table). Phase 2 GC plan via wrangler d1 execute manual override only.');
END;

-- ============================================================
-- 롤백 (비상시 수동 실행)
-- ============================================================
-- DROP TRIGGER IF EXISTS prevent_engine_telemetry_delete;
-- DROP TRIGGER IF EXISTS prevent_engine_telemetry_update;
-- DROP INDEX IF EXISTS idx_engine_telemetry_batch_run;
-- DROP INDEX IF EXISTS idx_engine_telemetry_exam_gauge;
-- DROP INDEX IF EXISTS idx_engine_telemetry_gauge_recorded;
-- DROP TABLE IF EXISTS engine_telemetry;
