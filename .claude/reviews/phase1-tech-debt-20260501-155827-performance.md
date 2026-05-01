# Phase 1 종료 5-페르소나 (2/5) — performance-engineer

**작성:** 2026-05-01 15:58 KST
**리뷰어:** performance-engineer (독립 에이전트, 4-Pass 결과 전달받음 — 6건 흡수 완료 가정)
**대상:** Step 19 신규 산출물 + Phase 1 누적 (formula-engine 251 + parser 136 + quality 41 + batch 236 + api 227 = 891 tests)
**리뷰 범위:**

- 신규: migrations/0017_engine_telemetry.sql · apps/api/src/telemetry/\* (4 파일 + 1 테스트) · apps/admin-web/src/components/TelemetryDashboard.tsx · apps/api/src/index.ts CORS · apps/batch/src/cost-meter.ts logger / pipeline.ts log.child / recover.ts log.child
- 연관: packages/shared/src/logger.ts · 17 마이그레이션 누적 · cachePolicyMiddleware · 미들웨어 PRAGMA FK
  **중복 지적 가드:** 4-Pass 6건 (pipeline.ts:898 / GET examId / engine_telemetry FK 의도 / CORS / plan drift / wire-up 트래킹) 본 리뷰에서 재지적 금지 — 위 항목은 모두 "흡수 완료" 가정으로 처리.

---

## 핵심 질문

**"10K 사용자에서 뭐가 터지나?"**

Phase 1 종료 시점은 BATCH-1 적재 직전 — 사용자 트래픽은 0이지만 적재 자동화가 시간당 수천 건의 텔레메트리/INSERT 압력을 만들어낸다. 따라서 본 리뷰의 "10K 부하"는 두 시나리오로 분리:

- **시나리오 A — BATCH 적재 (현실):** 580 문항 × 8 stage × 7 게이지 = 단일 BATCH-1 실행에서 약 32,000+ telemetry events. Phase 1 후반 (BATCH-2~5) 합산 시 1년 내 100K~1M events 누적 가능.
- **시나리오 B — admin-web 다중 폴링 (가설):** 진산님 1 사용자 가정이지만, 탭 leak / 모바일 PWA 백그라운드 / 자동화 스크립트 호출 시 30s 폴링 동시성 N → D1 round-trip × N 폭증.
- **시나리오 C — Year 2 사용자 노출 (학습 트래픽):** 본 step 직접 영향 없음 (learning_slo Phase 2). 다만 동일 D1 인스턴스 공유하므로 engine_telemetry row 누적이 user_progress 쿼리 latency에 PRAGMA cache_size 압력으로 간접 영향 가능.

---

## CRITICAL — 0건

(전제: 4-Pass 6건 흡수 완료 후. 본 step 신규 코드에서 10K 부하 시 즉시 서비스 중단을 일으키는 결함은 발견되지 않음. 단, 아래 MAJOR 항목 중 일부는 BATCH-3 시점에 CRITICAL로 격상될 수 있음 — 본 step 통과 후 BATCH-1 적재 직전 의무 처리.)

---

## MAJOR

### MAJOR-P1 — GET /api/telemetry/dashboard 16 sequential D1 round-trip (Workers CPU 50ms 임계 근접)

**파일:** `apps/api/src/telemetry/routes.ts:225-275`

**증거:**

- `for (const gauge of ENGINE_TELEMETRY_GAUGES)` 루프(8 iter) 안에서 매 iteration `c.env.DB.prepare(...).first()` 2회 (latest + count_24h). 총 **16 sequential D1 prepared statement**.
- Cloudflare D1 prepared statement latency 추정: same-region 1~3ms / cross-region 5~15ms (worst case). 16 × 3ms = **48ms (Workers Free 50ms CPU 임계 도달)** / 16 × 8ms = **128ms (Paid 30s 한도 OK이나 사용자 체감 지연)**.
- routes.ts:223 본문 주석 자체가 명시: "round-trip = 게이지(8) × 2 = 16 sequential D1 prepared statement (Workers CPU < 50ms 가정)". → "가정"은 측정 근거 부재.
- engine_telemetry row count 누적 시 `COUNT(*)` 비용도 증가. idx_engine_telemetry_gauge_recorded 인덱스가 (gauge_name, recorded_at) 커버 → COUNT은 인덱스 range scan. 1만 row 이하 시 sub-ms / 100만 row 시 5~10ms. **시나리오 A에서 1년 누적 ~1M events 시 1 COUNT × 8 gauge = 40~80ms 추가**.

**왜 위험한가:**

1. Workers Free Tier 50ms CPU 임계 — 본 endpoint가 `503: Exceeded CPU` 빈발 시 admin-web 폴링이 상시 실패. 진산님이 BATCH 진척 못 봄.
2. 30s 폴링 × 2시간 BATCH = 240회 dashboard 호출 / BATCH. tail latency p99 polling 미스 시 진척 모니터링 깜빡임.
3. 4-Pass에서 "MINOR 트래킹"으로 처리됐으나 실제 부하 모델 적용 시 MAJOR 격상.

**권고 (BATCH-1 적재 직전 의무):**

```sql
-- 단일 UNION ALL 쿼리로 8 게이지 latest + count_24h 한 번에 조회
WITH latest_per_gauge AS (
  SELECT gauge_name, id, exam_id, metric_value, metric_json,
         source_id, batch_run_id, recorded_at,
         ROW_NUMBER() OVER (PARTITION BY gauge_name ORDER BY recorded_at DESC) AS rn
  FROM engine_telemetry
  WHERE gauge_name IN (?, ?, ?, ?, ?, ?, ?, ?)
    AND (? IS NULL OR exam_id = ?)
)
SELECT * FROM latest_per_gauge WHERE rn = 1;
-- + 별도 쿼리 1회로 GROUP BY gauge_name COUNT(*)
```

- 16 round-trip → **2 round-trip**. 추정 latency 6~16ms (8x 개선).
- D1 batch API (`db.batch([stmt1, stmt2])`) 도 검토 가능 — 단일 transaction wrap.
- 또는 **응답 캐싱 5초** (`cache-policy.ts` private/no-store 정책과 충돌 — admin endpoint 한정 예외 ADR 필요). 30s 폴링 vs 5s 캐시 = D1 부하 1/6.

**임계값:** Phase 2 alarm rule `d1_slo` warn = 500ms → 본 endpoint가 워밍업 후에도 100ms 넘으면 d1_slo 게이지 자체가 warn 발화하는 자기 모순 위험.

### MAJOR-P2 — engine_telemetry row size + 1년 누적 GB 미산정 → D1 5GB Free 한도 무계획 진입

**파일:** `migrations/0017_engine_telemetry.sql:57-77` · `docs/observability/master-dashboard.md §3`

**증거:**

- engine_telemetry 한 row 추정 size:
  - id (UUID 36자) + exam_id (~25자) + gauge_name (~20자) + metric_value (8B REAL) + metric_json (가변, 평균 200~500B 가정) + source_id (~50자) + batch_run_id (~36자) + recorded_at (24자 ISO) ≈ **350~750 bytes / row** (SQLite overhead + 3 인덱스 포함 시 1.5~2.5 KB / row).
- BATCH-1 적재 추정 events:
  - batch_progress: 8 stage × ~5 substep = ~40 events / BATCH
  - cost: 매 API call 후 → 580 문항 / batch_size 가정 N → ~100 events
  - d1_slo: loader.ts 매 INSERT 후 → 580 문항 × 평균 5 row/문항 = ~2,900 events
  - graph_integrity / quality_gate / formula_accuracy: stage 종료 시 1회 → ~20 events
  - **총 ~3,000 events / BATCH-1 (보수 추정).** 580 문항 × 8 stage × 7 게이지 = 32,480 worst case.
- BATCH-2~5 합산 + Phase 1 후반 운영 = 50,000 ~ 200,000 events 첫 12개월.
- master-dashboard.md §3 명시: "Phase 1 무제한 (D1 무료 5GB 한도까지) / Phase 2 1년 보존". → **GC 없이 5GB 한도 도달 시점 산출 부재**.
- 200,000 events × 2 KB = **400 MB** (보수). 1M events × 2 KB = **2 GB**. D1 Free 5GB 한도의 40%. 다른 9 테이블 합산 시 **30~36개월 만에 D1 5GB 포화 가능**.
- D1 5GB 도달 시 INSERT 차단 → BATCH 사망 + telemetry 자체가 멈추는 silent 장애.

**왜 위험한가:**

1. Phase 2 GC가 1년 보존 정책이지만 Phase 1 시점에는 GC 없음. BATCH-1~5가 Phase 1 후반에 몰리면 5GB 임계 진입.
2. master-dashboard.md §3 "Phase 2 진입 시 별도 plan" 명시되어 있으나, **트리거가 시간 기반이 아니라 D1 사용량 기반이어야 함**. row count 또는 storage_bytes 모니터링 게이지 부재 = 자기 진단 불능.
3. UPDATE/DELETE 트리거가 부착되어 있어 GC 시점에 트리거 일시 DROP 의무 → 운영 실수 시 telemetry 영구 손실 위험.

**권고:**

- 9번째 게이지 후보 `d1_storage` (Phase 2 신설) — engine_telemetry row count + table_info pragma 기반 storage_bytes 추적.
- engine_telemetry CHECK 제약에 metric_json size hard limit 64KB (write-helper.ts:58 적용 중 — 정상). 추가로 **평균 row size 모니터링 의무** (P95 row size > 5KB 시 metric_json 남용 신호).
- BATCH-1 진입 전 `pnpm wrangler d1 execute thepick --command "SELECT SUM(LENGTH(metric_json)) FROM engine_telemetry"` 모니터링 스크립트.
- Phase 2 GC plan은 **Cloudflare Cron Trigger** (이미 apps/api/src/index.ts:scheduled 패턴 존재, rate_limits GC와 동형) — Phase 2 진입 ADR 필수. 트리거 일시 DROP 안전 패턴은 별도 transaction wrap 검증.

### MAJOR-P3 — TelemetryDashboard.tsx fetch AbortController 부재 → 탭 leak / unmount 시 race

**파일:** `apps/admin-web/src/components/TelemetryDashboard.tsx:229-271, 273-278`

**증거:**

- `fetchDashboard` 내 `await fetch(...)` 에 `signal` 미주입.
- `useEffect` cleanup이 `clearInterval` 만 수행 — 진행 중인 fetch는 취소 안됨.
- 시나리오:
  1. 진산님 탭 닫음 → unmount → cleanup 실행 → setInterval 제거
  2. 그러나 30s 직전 시작된 fetch가 응답 도착 → unmounted setState 호출 → React warning + 메모리 leak
  3. token 변경 시 (logout 후 재로그인) 이전 fetch 미취소 상태에서 새 fetch 시작 → response race condition (이전 응답이 새 토큰 응답 덮어씀 가능)
- 본 endpoint가 admin-token mismatch 시 401 반환 → 이전 토큰 fetch가 401 받아 `clearToken()` → 새 토큰 즉시 무효화

**부하 시 시나리오:**

- BATCH 적재 중 진산님이 admin-web 새로고침 반복 / 탭 5개 열어 모니터 → 5 polling × 30s = D1 부하 5배. AbortController 없으면 페이지 닫아도 in-flight fetch 30s 진행.
- 모바일 PWA 백그라운드 진입 시 setInterval suspend → 복귀 시 burst fetch (Safari 특이).

**권고:**

```tsx
const fetchDashboard = useCallback(
  async (signal?: AbortSignal) => {
    // ...
    const res = await fetch(`${apiBase}/api/telemetry/dashboard`, {
      headers: { 'X-Admin-Token': token },
      signal, // 추가
    });
    // ...
  },
  [token, apiBase],
);

useEffect(() => {
  if (!token) return;
  const controller = new AbortController();
  fetchDashboard(controller.signal);
  const id = window.setInterval(() => fetchDashboard(controller.signal), POLL_INTERVAL_MS);
  return () => {
    controller.abort();
    window.clearInterval(id);
  };
}, [token, fetchDashboard]);
```

- 추가: token 변경 시 이전 fetch race 차단 (응답에 token snapshot 비교 후 setState).
- visibilitychange 이벤트로 탭 백그라운드 시 폴링 일시 중단 (D1 부하 감소).

---

## MINOR

### MINOR-P1 — JsonLogger.emit() 매 호출 maskContext 재귀 + JSON.stringify 비용

**파일:** `packages/shared/src/logger.ts:284-313, 228-235`

**증거:**

- `emit()` 매 호출마다:
  1. `{ ...this.baseContext, ...extra }` spread (얕은 복사 N keys)
  2. `maskContext(merged)` — Object.entries + 재귀 (depth ≤ 6) + WeakSet 인스턴스 1회
  3. `serializeError(err, ...)` — Error 인스턴스 시 stack trace 전체 복사 + cause chain 재귀 (depth ≤ 8) + redact regex 3종 (production)
  4. `JSON.stringify(record)` — 전체 객체 직렬화
- BATCH 적재 중 cost-meter.ts `costMeterLog.warn` × 580 calls + pipeline.ts log.child stage 별 × 8 + recover.ts × N 이벤트 → **추정 1,000~5,000 emit() / BATCH**.
- emit() 1회 추정 비용:
  - context 5 keys: ~50μs (V8)
  - maskContext WeakSet 생성 + 재귀 1단: ~30μs
  - JSON.stringify 500B 출력: ~100μs
  - **합계 ~200μs / emit**. 5,000 emit = **1,000ms 누적**. BATCH-1 1시간 실행 대비 0.03% — **현시점 무관**.
- 그러나 d1_slo 게이지 wire-up 시 매 INSERT 마다 logger.info 호출 가정 → 2,900 INSERT × 200μs = 580ms / BATCH. 여전히 무시 가능.

**왜 MINOR인가:**

- 현 부하에서 영향 미미. logger.ts:284 emit 자체가 silent drop 차단을 위한 3단계 fallback 보유 — 안전성 우선 설계 정합.
- WeakSet 인스턴스 재사용 안 하는 이유: 순환 참조 가드의 호출 간 격리 — 보안/정확성 trade-off 정당.

**권고 (Phase 2 1만 사용자 진입 시):**

- minLevel 빌드 타임 결정 — 'info' 미만 전체 제거 (tree shaking).
- production 환경에서 maskContext 사전 계산 cache (빈도 높은 keyset 별 비트마스크).
- 현시점 조치 불필요.

### MINOR-P2 — D1 prepared statement 캐싱 미활용 (every-call prepare)

**파일:** `apps/api/src/telemetry/routes.ts:183-202, 227-265` · `apps/api/src/telemetry/write-helper.ts:71-79`

**증거:**

- 매 요청마다 `c.env.DB.prepare("SELECT ...")` 신규 호출. Cloudflare D1 SDK 내부적으로 prepared statement plan을 캐싱하는지 미확인 (공식 문서는 명시 X).
- 모듈 스코프 변수에 `const stmt = db.prepare(...)` 저장하면 1회 prepare로 재사용 가능 — Hono의 `c.env.DB` 가 request-scoped binding이라 모듈 스코프 캐싱은 단일 워커 인스턴스 내에서만 유효.
- BATCH-1 적재 시 telemetry write 추정 ~3,000 INSERT — 매 INSERT 시 prepare 비용. D1 prepare는 client-side parsing → 실제 server cost 미세.

**왜 MINOR인가:**

- D1 SDK 내부 plan cache 동작 미확인. 미들웨어 PRAGMA(`PRAGMA foreign_keys = ON`)는 이미 매 요청마다 호출 중 (apps/api/src/index.ts:108) — D1 은 connection-pooled 상태가 없어 prepare 캐싱 효과 제한.
- 현 부하에서 측정 가능한 영향 부재.

**권고:**

- BATCH-1 진입 후 wrangler tail 로 INSERT 평균 latency 측정 → > 50ms이면 batch API (`db.batch([])`) 도입.

### MINOR-P3 — admin-token timingSafeEqual 길이 비교 즉시 false → 정보 누출

**파일:** `apps/api/src/telemetry/admin-token.ts:28-35`

**증거:**

- `if (a.length !== b.length) return false;` — 길이 다른 경우 0μs 응답, 길이 같은 경우 N×1μs 응답. 응답 시간 차이로 토큰 길이 추정 가능.
- 본 코드 주석 자체가 명시: "길이가 다를 경우 즉시 false 반환은 information leak 가능하나, 운영자가 의도한 토큰을 사용한다면 실제 비교에서만 시간 차이 노출 → MIN_TOKEN_LENGTH 강제로 < 16 차단."
- MIN_TOKEN_LENGTH = 16 강제로 16자 미만 토큰 시도는 일괄 401. 그러나 16~64자 범위 내 길이 추정 가능.

**왜 MINOR인가:**

- 본 endpoint 트래픽 = 진산님 1명. 공격자 트래픽 0건.
- timing attack은 정확한 RTT 측정 + 수십만 회 시도 필요 — Cloudflare WAF rate limit과 ADMIN_API_TOKEN 무작위성으로 실효성 낮음.
- 본 step master-dashboard.md §4.3 에 명시 — Phase 2 Cloudflare Access로 대체.

**권고:**

- 현시점 조치 불필요.
- Phase 2 Cloudflare Access 마이그레이션 시점에 본 미들웨어 제거 의무 (이미 plan).

### MINOR-P4 — CORS maxAge 600s 일관 → admin-web preflight 캐싱 OK

**파일:** `apps/api/src/index.ts:77, 84-87`

**증거:**

- `maxAge: 600` (10분) — 각 endpoint 첫 X-Admin-Token 호출 시 OPTIONS preflight 1회 → 10분 캐싱.
- 30s 폴링 × 600s = 매 20회 호출당 1회 preflight. 진산님 1 사용자 기준 부담 무.
- admin-web `/api/telemetry/*` 별도 cors() 인스턴스 (allowHeaders X-Admin-Token 추가) — `/api/auth/*`, `/api/progress/*` 와 분리.

**왜 MINOR인가:**

- 정상 설계. preflight 비용 무시 가능.

**권고:**

- 없음.

### MINOR-P5 — TelemetryDashboard 30s 폴링 + 시각적 indicator 부재 → 진산님 "데이터 흐르고 있는지" 불안

**파일:** `apps/admin-web/src/components/TelemetryDashboard.tsx:325-326`

**증거:**

- `state.fetchedAt` 표시: `Updated 14:32:00` — 마지막 fetch 시각만 표시.
- 30s 폴링 진행 중 visual cue 부재 (loading spinner는 manual refresh 시에만 표시 — `state.status === 'loading'` 이지만 polling은 자동이라 사용자가 인지 못함).
- BATCH 적재 중 데이터 흐름 정체 시 진산님이 "30s 폴링이 멎었나?" vs "데이터 자체가 안 들어오나?" 구분 불가.

**왜 MINOR인가:**

- UX 개선 — 성능 부채 아님. master-dashboard.md alarm rule 활성 시 자동 critical 표시.

**권고:**

- 향후 다음 polling까지 카운트다운 (`Next refresh in 27s`) 또는 polling tick visual.
- 진산님 alarm 라우팅 (Phase 2 Workers Logpush → 이메일) 우선 — 본건은 후순위.

### MINOR-P6 — engine_telemetry exam_id 인덱스 cardinality 부재 (Year 1 단일 시험)

**파일:** `migrations/0017_engine_telemetry.sql:88-89`

**증거:**

- `CREATE INDEX idx_engine_telemetry_exam_gauge ON engine_telemetry(exam_id, gauge_name, recorded_at DESC)` — Year 1 시점 exam_id cardinality = 1 (`son-hae-pyeong-ga-sa`). 인덱스 selectivity = 0.
- 인덱스 storage 비용은 row 수에 비례 — 100K events × ~80B index entry = ~8 MB. D1 5GB 한도 대비 무시 가능.
- Year 2 multi-tenant 진입 시 exam_id cardinality > 1 → 인덱스 활용도 정상화. **사전 인프라 투자**.

**왜 MINOR인가:**

- Hard Rule 16 zero-cost 전환 정합 — Year 2 마이그레이션에 인덱스 신규 생성 비용 회피 (Year 1 누적 데이터 위에 인덱스 생성은 lock + IO 비용 큼).
- Year 1 비용 8 MB는 합리적 prepay.

**권고:**

- 없음. Year 1 한시 인덱스 부담은 zero-cost 전환 가치 대비 합리적.

### MINOR-P7 — 모노레포 `pnpm -r test` 891 tests 실행 시간 (CI 부담)

**파일:** N/A — CI workflow

**증거:**

- 추정 891 tests × 평균 5ms = 4.5초. 실제 측정 불가하나 vitest fast (parallel by default).
- typecheck 8 패키지 + verify-engine-contracts + admin-web build 합산 → 추정 5~8분 CI 시간.
- 4-Pass 결과 6건 흡수 후 본 step 산출물 추가 ~50 tests 가정 (telemetry routes.test.ts:328 lines = 약 25 test).

**왜 MINOR인가:**

- CI 한도 (GitHub Actions free 2,000 min/월) 대비 충분.
- pnpm workspace 의존 그래프상 일부 패키지 변경 시 다운스트림 재빌드 필요.

**권고:**

- BATCH-1 진입 후 CI 시간 측정 후 turborepo 도입 고려 (캐싱).
- 현시점 조치 불필요.

---

## Devil's Advocate (부하 시 깨질 시나리오)

### 시나리오 D1 — BATCH-3 적재 중 D1 5GB 도달 → telemetry INSERT 503 → silent BATCH 사망

**조건:**

1. BATCH-1, 2 정상 적재 완료. engine_telemetry 200K row 누적 (~400 MB).
2. BATCH-3 시작. d1_slo 게이지 wire-up 활성 → 매 INSERT 후 telemetry POST.
3. 다른 9 테이블 합산 4.5 GB 도달 (knowledge_nodes / mnemonic_cards 적재 누적).
4. BATCH-3 진행 중 D1 5GB 한도 도달 → 모든 INSERT 503.
5. cost-meter.ts soft_warn → telemetry POST 시도 → 503 → write-helper.ts try-catch가 throw → routes.ts 503 응답 → caller(pipeline.ts) 가 telemetry 실패를 무시 (or BATCH 자체 실패).

**왜 깨지는가:**

- master-dashboard.md §3 "Phase 1 무제한" 정책 + GC plan Phase 2 이월 = D1 한도 모니터링 부재.
- 본 step 신규 9번째 게이지 `d1_storage` 후보 부재 → 자기 진단 불능.
- write-helper.ts:97-101 D1 INSERT 실패 시 logger.error + throw — caller가 swallow하면 BATCH 진척이 telemetry 부재로 보고되지 않음.

**완화 방안:**

- BATCH-1 진입 직전 `wrangler d1 info thepick` storage_bytes 모니터링 의무 절차 추가.
- pipeline.ts ↔ telemetry POST 통합 시 503 응답 시 BATCH 자체 abort (silent failure 차단) — Hard Rule #3 정합.
- Phase 2 GC plan을 Phase 1 후반 활성화 검토 (BATCH-3 시점 GC 의무).

### 시나리오 D2 — admin-web 탭 5개 + 모바일 PWA 백그라운드 → D1 부하 5x → dashboard 503

**조건:**

1. 진산님 BATCH-1 적재 모니터링 중 데스크톱 탭 2개 + iPad PWA 1개 + 모바일 백그라운드 1개 + curl polling 1개.
2. 5 동시 polling × 30s = 매 30s에 5 dashboard 호출 → 16 round-trip × 5 = **80 D1 query / 30s** = ~2.67 query/s.
3. 4-Pass 흡수 후 GET /dashboard 16 round-trip 유지 가정. 평균 80ms × 5 = 400ms 동시.
4. Workers concurrent execution 한도 100 (Free) — 5는 안전. 그러나 d1_slo 자기 측정 시 자기 호출 latency가 임계 발화 가능.

**왜 깨지는가:**

- AbortController 부재 (MAJOR-P3) — 탭 닫아도 in-flight fetch 진행.
- visibilitychange 핸들러 부재 — 백그라운드 탭도 폴링 지속.

**완화 방안:**

- MAJOR-P1 (UNION ALL) + MAJOR-P3 (AbortController + visibilitychange) 병행.

### 시나리오 D3 — pipeline.ts ↔ telemetry POST wire-up 시 fire-and-forget이면 telemetry 손실 silent

**조건:**

- 본 step 시점 pipeline.ts → telemetry POST wire-up 부재 (master-dashboard.md §5 매트릭스 = 후속 PR).
- 후속 PR이 `void fetch('/api/telemetry', ...)` fire-and-forget 패턴 채택 시 — 응답 503/network error 무시.
- BATCH 진척 telemetry 누락 → admin-web 대시보드 빈 화면 → 진산님이 BATCH 진행 여부 모름.

**완화 방안:**

- wire-up PR에서 `await fetch + 503 시 ctx.logger.error` 의무. pipeline.ts 자체 abort는 X (telemetry 실패가 BATCH 사망 유발하면 self-DoS).
- D1 자체가 죽으면 BATCH 도 어차피 죽음 → telemetry 503 + BATCH 정상 진행 = 모순. retry queue (Cloudflare Queue) 도입 검토 — 단 단일 벤더 정합성 위해 D1 outbox 테이블이 더 적합.

---

## 통계 / 임계값 요약

| 항목                                      | 추정 / 임계                                      | 실측 필요                                   |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------------------- |
| GET /dashboard latency (p50)              | 16~48ms (16 round-trip × 1~3ms)                  | ✓ BATCH-1 진입 직전 wrangler tail 측정 의무 |
| GET /dashboard latency (p99 cross-region) | 80~240ms                                         | ✓ 동일                                      |
| BATCH-1 telemetry events 수               | ~3,000 (보수) ~ 32,000 (worst)                   | ✓ BATCH-1 종료 시 row count                 |
| engine_telemetry row size 평균            | 350~750 bytes (raw) / 1.5~2.5 KB (3 인덱스 포함) | ✓ BATCH-1 후 SUM(LENGTH)                    |
| 1년 누적 storage                          | 400 MB ~ 2 GB (BATCH-5 까지)                     | ✓ Phase 2 GC 트리거 결정                    |
| D1 5GB 도달 예상 시점                     | 30~36 개월 (BATCH 외 누적 포함)                  | ✓ d1_storage 게이지 신설 의무               |
| Workers Free CPU 50ms                     | dashboard 16 round-trip × 3ms = 48ms (임계 도달) | ✓ 측정 후 UNION ALL 결정                    |
| logger.emit() 비용                        | ~200μs / call                                    | 영향 무 (BATCH 5,000 calls = 1초)           |
| AbortController 미주입 영향               | 30s 폴링 × N 탭 = leak                           | ✓ 5 탭 시뮬레이션                           |

---

## 판정

### CRITICAL 0건 → ★★★ ENGINE HARDENING 완료 ★★★ 게이트 통과 가능

다만 **BATCH-1 적재 직전 의무 처리** 항목 3건 명시 이월:

1. **MAJOR-P1 (16 round-trip → 2 round-trip 최적화)** — BATCH-1 적재 시 admin-web /telemetry 폴링이 정상 작동하기 위해 필수. UNION ALL 또는 db.batch() 도입.
2. **MAJOR-P2 (D1 storage 모니터링 + 9번째 게이지 d1_storage 후보)** — Phase 2 GC plan 활성 시점이 시간 기반이 아닌 storage 기반이어야 BATCH-3 시점 silent 사망 차단.
3. **MAJOR-P3 (AbortController + visibilitychange)** — 30s 폴링 다중 탭 leak 차단. UI safety net.

MINOR 7건은 모두 Phase 2 사용자 노출 시점까지 deferred 가능.

**판정: 완료 가능 (조건부)** — 본 step Phase 1 종료 게이트 통과. MAJOR 3건은 ROADMAP §8 다음 항목 (BATCH-1 적재 PR)에 명시 이월 의무.

**기술 부채 우선순위 매트릭스 (진산님 보고용):**

| 우선순위 | 항목                                    | 이월 시점                     |
| :------: | --------------------------------------- | ----------------------------- |
|    P0    | (CRITICAL 0건)                          | —                             |
|    P1    | MAJOR-P1 dashboard UNION ALL            | BATCH-1 적재 PR (의무)        |
|    P1    | MAJOR-P2 d1_storage 게이지 + GC trigger | BATCH-3 진입 직전 (의무)      |
|    P2    | MAJOR-P3 AbortController                | BATCH-1 진입 직전 (권고)      |
|    P3    | MINOR-P1~P7                             | Phase 2 사용자 노출 직전 일괄 |

---

**리뷰어 서명:** performance-engineer (독립)
**리뷰 시각:** 2026-05-01 15:58 KST
**파일 경로:** `/home/soo/ClaudePro/ThePick/.claude/reviews/phase1-tech-debt-20260501-155827-performance.md`
