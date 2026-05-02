# engine_telemetry GC Runbook

**작성일**: 2026-05-02 (Session 034 — Phase 1 5-페르소나 B-C3 흡수)
**근거**:

- `migrations/0017_engine_telemetry.sql:111-123` — `prevent_engine_telemetry_update` + `prevent_engine_telemetry_delete` 트리거 RAISE(ABORT)
- ENGINE_HARDENING_COMPLETION_REPORT v1.2 §10.7 #11
- `.claude/reviews/phase1-tech-debt-20260502-backend.md` B-C3
- `.claude/reviews/phase1-tech-debt-20260502-performance.md` CRITICAL-PERF-2

**용도**: 1년 보존 정책 활성 시점 (Phase 2) engine_telemetry GC 절차. **본 시점 (Phase 1 closeout) 미실행 — Phase 2 진입 시 의무**.

---

## 0. 정책 정의

### 0.1 1년 보존 정책 (Phase 2)

- 모든 게이지 default 365일 보존
- gauge별 차등 (Phase 2 Step 21 권고):
  - `cost` / `d1_slo`: 90일 (활성 적재 + 모니터링 윈도우)
  - `batch_progress` / `quality_gate` / `formula_accuracy`: 365일 (BATCH 적재 이력)
  - `reviewer_queue` / `graph_integrity`: 180일

### 0.2 GC trigger 시점

- **Cron `0 3 * * *`** (apps/api/wrangler.toml `CRON_GC_DAILY`) 일일 자동 실행 (Phase 2 활성)
- **Manual override**: 진산님 직접 `wrangler d1 execute` (긴급)

### 0.3 트리거 차단 정책

`prevent_engine_telemetry_delete` 트리거가 RAISE(ABORT) — DELETE 자체 차단. **GC = 트리거 일시 비활성화 후 DELETE 후 재활성화 3-step 패턴**.

---

## 1. GC SQL 시퀀스 (Phase 2 자동 + Manual override 공통)

### 1.1 Dry-Run COUNT (필수 선행)

```sql
-- staging 또는 production 환경 모두 동일
-- 365일 cutoff 기준 삭제 예정 row 수 확인
SELECT
  gauge_name,
  COUNT(*) AS expired_rows,
  MIN(recorded_at) AS oldest_row,
  MAX(recorded_at) AS newest_expired
FROM engine_telemetry
WHERE recorded_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-365 day')
GROUP BY gauge_name
ORDER BY expired_rows DESC;
```

**판정 기준**:

- 합계 < 100,000 row: 단일 statement DELETE OK
- 합계 100,000~1,000,000: chunked DELETE 권고 (10K rows/iter × 100)
- 합계 > 1,000,000: 진산님 보고 + plan 재작성 (D1 limits 검토)

### 1.2 트리거 일시 비활성화

```sql
DROP TRIGGER prevent_engine_telemetry_delete;
```

### 1.3 GC 실행 (chunked 권고)

```sql
-- chunk 1: 1년 이상 row 10K 단위 삭제 + 진척도 모니터링
DELETE FROM engine_telemetry
WHERE recorded_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-365 day')
LIMIT 10000;

-- 반복 (changes() = 0 까지):
SELECT changes(); -- 직전 DELETE row 수 확인
-- changes() > 0 면 다시 DELETE LIMIT 10000

-- 또는 단일 statement (< 100K row 시):
-- DELETE FROM engine_telemetry WHERE recorded_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-365 day');
```

### 1.4 트리거 재활성화

```sql
CREATE TRIGGER prevent_engine_telemetry_delete
BEFORE DELETE ON engine_telemetry
BEGIN
  SELECT RAISE(ABORT, 'engine_telemetry rows are append-only; DELETE forbidden. Use Phase 2 GC runbook (docs/runbooks/engine-telemetry-gc.md) with explicit DROP TRIGGER + DELETE + CREATE TRIGGER sequence.');
END;
```

### 1.5 검증

```sql
-- 트리거 재활성 확인
SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'prevent_engine_telemetry_delete';
-- 기대: 1 row

-- 잔여 row 카운트
SELECT gauge_name, COUNT(*) FROM engine_telemetry GROUP BY gauge_name;
-- 기대: 365일 이내 row 만
```

---

## 2. Phase 2 자동화 (Cron handler 통합)

### 2.1 cron handler 신규 (`apps/api/src/scheduled/telemetry-gc.ts`)

의사 코드 (Phase 2 진입 시 구현):

```text
async function purgeOldTelemetry(env): Promise<GcResult>
  cutoff = ISO 8601 (now - 365 days)

  // dry-run COUNT
  countRow = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM engine_telemetry WHERE recorded_at < ?"
  ).bind(cutoff).first<{ n: number }>()

  if countRow.n > 100_000:
    log.warn("telemetry GC large batch — chunked DELETE", { count: countRow.n })

  // 트리거 drop (D1 prepared statement run() 사용)
  await env.DB.prepare("DROP TRIGGER IF EXISTS prevent_engine_telemetry_delete").run()

  // chunked DELETE
  totalDeleted = 0
  loop:
    result = await env.DB.prepare(
      "DELETE FROM engine_telemetry WHERE recorded_at < ? LIMIT 10000"
    ).bind(cutoff).run()
    totalDeleted += result.meta.changes
    if result.meta.changes == 0:
      break

  // 트리거 재생성 (multi-line trigger DDL — D1 batch() 또는 wrangler manual)
  await env.DB.batch([
    env.DB.prepare("CREATE TRIGGER prevent_engine_telemetry_delete BEFORE DELETE ON engine_telemetry BEGIN SELECT RAISE(ABORT, '...'); END;")
  ])

  return { deleted: totalDeleted, cutoff }
```

### 2.2 cron 분기 추가 (`apps/api/src/index.ts`)

기존 rate-limit-gc 옆 추가:

```text
case "0 3 * * *":
  await Promise.allSettled([
    purgeOldRateLimits(env, ctx),
    purgeOldTelemetry(env),  // 신규
  ])
  break
```

### 2.3 트리거 조건부 완화 (대안 — Phase 2 결정)

```sql
-- 옵션: 트리거를 365일 cutoff 조건부 허용 (drop/recreate 불필요)
DROP TRIGGER prevent_engine_telemetry_delete;

CREATE TRIGGER prevent_engine_telemetry_delete
BEFORE DELETE ON engine_telemetry
WHEN OLD.recorded_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-365 day')
BEGIN
  SELECT RAISE(ABORT, 'engine_telemetry rows within 365-day retention are protected. Older rows are GC-eligible.');
END;
```

**판정**: 옵션 B (조건부 트리거) 가 운영 단순성 + drop/recreate window 0초 → 권고. 단 Phase 2 진입 시 ADR + 4-Pass 리뷰 의무.

---

## 3. Manual Override 절차 (긴급 — 진산님 직접)

긴급 GC 필요 시 (예: D1 storage 90% 도달 알람):

```bash
# 1. dry-run COUNT
pnpm wrangler d1 execute thepick --env production --remote --command "
  SELECT gauge_name, COUNT(*) FROM engine_telemetry
  WHERE recorded_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-365 day')
  GROUP BY gauge_name;
"

# 2. 트리거 비활성
pnpm wrangler d1 execute thepick --env production --remote --command "
  DROP TRIGGER prevent_engine_telemetry_delete;
"

# 3. chunked DELETE (반복)
pnpm wrangler d1 execute thepick --env production --remote --command "
  DELETE FROM engine_telemetry WHERE recorded_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-365 day') LIMIT 10000;
  SELECT changes();
"

# 4. 트리거 재활성 (필수)
pnpm wrangler d1 execute thepick --env production --remote --command "
  CREATE TRIGGER prevent_engine_telemetry_delete
  BEFORE DELETE ON engine_telemetry
  BEGIN
    SELECT RAISE(ABORT, '...');
  END;
"
```

**경고**: WHERE 절 누락 시 전체 텔레메트리 손실. 4-Pass 리뷰 + 진산님 명시 승인 후 실행.

---

## 4. Rollback (GC 후 데이터 복구 불가)

DELETE 후 복구 불가 — Cloudflare D1 Time Travel (최대 30일) 만 옵션. Phase 2 진입 시 GC 1차 실행은 진산님 명시 승인 + Time Travel snapshot 사전 확보 의무.

---

## 5. 트래킹 ledger (Phase 2)

- [ ] cron handler `purgeOldTelemetry()` 구현 (apps/api/src/scheduled/telemetry-gc.ts)
- [ ] 옵션 B 조건부 트리거 ADR + 마이그레이션 0019
- [ ] gauge별 차등 retention 정책 ADR
- [ ] D1 backup 정책 (Time Travel + R2 cold storage 분기)

---

**근거 cross-ref**:

- `.claude/reviews/phase1-tech-debt-20260502-backend.md` B-C3
- `.claude/reviews/phase1-tech-debt-20260502-performance.md` CRITICAL-PERF-2
- `migrations/0017_engine_telemetry.sql:111-123`
- `apps/api/src/index.ts:159-203` (cron handler 위치)
