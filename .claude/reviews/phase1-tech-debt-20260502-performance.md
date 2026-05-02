# Phase 1 5-페르소나 기술부채 심층 리뷰 — performance-engineer

**작성일**: 2026-05-02 ~15:30 KST
**리뷰 방식**: 독립 에이전트 (`performance-engineer`, agentId `a1cc8a17c8c04a6e0`)
**페르소나 핵심 질문**: "10K 사용자에서 뭐가 터지나?"
**리뷰 범위**: hot path (formula-engine sandbox/ast-parser, quality cycle-detection, batch pipeline/loader/checkpoint, api progress/telemetry/scheduled, migrations 0012/0017)

---

## 전제 정량 추정 (실측 BATCH-1 적재 후 갱신 의무)

- BATCH-1 ~60 노드 / 200 엣지 / 13 산식 (BATCH_CONFIGS 명시)
- Phase 1 1차 trial 가정: 동시 10K MAU / 평균 1 review/min / 산식 풀이 5/min/active user
- D1 query budget: Workers free CPU 50ms / paid 30s wall, RTT 1~5ms in-region

---

## CRITICAL — Phase 2 진입 직전 의무 (4건)

### CRITICAL-PERF-1 — `GET /api/telemetry/dashboard` 16 sequential round-trip (Workers CPU 50ms 한도 임박)

**위치**: `apps/api/src/telemetry/routes.ts:286-341`

**증거**: 8 게이지 × 2 query = 16 sequential D1 prepared statement. 코드 주석 line 289 명시. `for (const gauge of ENGINE_TELEMETRY_GAUGES)` 루프 내부 `await ... .first()` 순차.

**정량 추정**:

- N=10K 누적 row: 16×4ms = ~64ms (한도 초과)
- N=100K: 16×8ms = ~128ms (관리자 dashboard 1초+ 체감)
- admin-web 5초 polling 분당 12회 — Workers paid duration 누적

**권고**:

1. 즉시 (Phase 2 전): `Promise.all(ENGINE_TELEMETRY_GAUGES.map(...))` 병렬화 → ~3~5ms
2. 중기: UNION ALL 단일 쿼리 → ~3ms
3. countRow approximate count 또는 `engine_telemetry_daily` aggregate 테이블

### CRITICAL-PERF-2 — engine_telemetry 1년 보존 정책 활성 시 GC 부재 + Cron 03:00 폭주

**위치**: `migrations/0017_engine_telemetry.sql:111-123` + `apps/api/src/index.ts:159-203`

**증거**: 트리거 RAISE(ABORT) 차단 → manual `wrangler d1 execute` 필수. cron handler `CRON_GC_DAILY = '0 3 * * *'` 는 rate_limits 만 — telemetry GC 누락.

**정량**: 8 게이지 × ~5 BATCH/일 + cost-meter 100/일 + d1_slo 144/일 = ~1,200/일 (활동기). 1년 누적 73K~438K row. 인덱스 3개 ~30~120MB. **실제 위험**: GC 도입 시점 누적 폭증 → 트리거 drop/recreate window 동안 telemetry write 차단.

**권고**:

1. Phase 2 진입 직전: cron handler `purgeOldTelemetry()` + 트리거 `WHEN OLD.recorded_at < strftime(...,'-365 day')` 조건부 허용
2. gauge별 차등 retention (cost/d1_slo 90일, batch_progress/quality_gate 1년)
3. application-side rotation pseudo-table

### CRITICAL-PERF-3 — `purgeOldRateLimits` 단일 DELETE 무경계 (D1 transaction 시간 한도 위험)

**위치**: `apps/api/src/scheduled/rate-limit-gc.ts:54-57`

**증거**: `db.prepare('DELETE FROM rate_limits WHERE bucket_minute < ?').bind(cutoffBucket).run()` 단일 statement. `GC_DELETE_COUNT_WARN_THRESHOLD = 30,000,000` 자체가 28.8M 정상치 명시.

**정량**:

- D1 단일 statement DELETE ~10K rows/sec (보수)
- 28.8M / 10K = 2,880초 (~48분). Workers Cron 30초 한도 명백 초과
- 28.8M 미만 (1M row) 도 100초 — 30초 한도 초과

실제 발화 시: `console.error('rate_limits GC failed', err)` 로그만 남고 silently 누락 → 영구 누적.

**권고**:

1. 즉시: batch DELETE — `DELETE FROM rate_limits WHERE bucket_minute < ? LIMIT 10000` 루프 + 중간 changes==0 종료
2. 중기: cron 빈도 hourly + 처리량 24× 확보
3. 장기 (10K active): rate_limits 를 KV / Durable Objects 이전 (TTL 자동) — Phase 3 ADR

### CRITICAL-PERF-4 — Formula Engine `parseFormula` cache hit 시 `assertWithinComplexityBudget` 재실행 (캐시 효과 부분 무력화)

**위치**: `packages/formula-engine/src/ast-parser.ts:45-60`

**증거**: line 52 cache hit 분기에서 매번 재실행. node count traversal + depth iterative DFS = O(N) where N ≤ 200.

**정량**: 51 산식 expansion 후 hot path — 10K active × 5 calculate/min = 833 RPS. ~10μs × 833 = 8.3ms aggregate.

**권고**:

1. 한도 변경 ADR 시점에 `clearCache()` 명시 호출 → cache hit 분기 재검증 불필요
2. cache key 를 `(equationTemplate, MAX_AST_NODE_COUNT, MAX_AST_DEPTH)` tuple → 한도 변경 시 자동 cache miss

---

## MAJOR — 6건 (Phase 2 명시 트래킹)

|  #  | ID       | 제목                                                                                   | 위치                                            | 흡수 시점                |
| :-: | :------- | :------------------------------------------------------------------------------------- | :---------------------------------------------- | :----------------------- |
|  1  | M-PERF-1 | POST /api/progress/review 4 round-trip per request                                     | apps/api/src/progress/routes.ts:143-243         | Phase 2 FSRS 도입 시     |
|  2  | M-PERF-2 | findOrphanNodes + findBrokenEdges + findSupersedeCycles 3-pass O(N+E)                  | packages/quality/src/graph-integrity.ts:108-269 | Phase 2                  |
|  3  | M-PERF-3 | CostMeter `Math.round(costUsd × 1e6)` 정수 누적 — token-level 25% over-estimate        | apps/batch/src/cost-meter.ts:140-141, 275       | Phase 2                  |
|  4  | M-PERF-4 | db.batch() 무경계 + chunked batches 부재                                               | apps/batch/src/loader/draft-loader.ts:137-155   | BATCH-1 expansion 후     |
|  5  | M-PERF-5 | mathjs 17 dependency 번들 크기 측정 0건                                                | packages/formula-engine/src/sandbox.ts:19-40    | Phase 2 LOD-04 진입 직전 |
|  6  | M-PERF-6 | safeEvaluate `performance.now()` Workers timer 100μs precision (mathjs 회귀 측정 한계) | packages/formula-engine/src/sandbox.ts:367-403  | 운영 시                  |

---

## MINOR — 5건 (보고만)

- MIN-PERF-1: parseExamIdQuery regex (~1μs) — Set lookup 가능
- MIN-PERF-2: roundTo Number.EPSILON 평가 (~50ns)
- MIN-PERF-3: checkpoint canonicalJson 매번 SHA-256 (~50μs)
- MIN-PERF-4: costMeter Map.get + Map.set (~1μs)
- MIN-PERF-5: progress/due LIMIT 50 hardcoded — Phase 2 페이지네이션

---

## Devil's Advocate (5 시나리오)

1. **rate_limits GC 28.8M timeout**: D-1 GC 실패 → D-2 누적 43.2M → 영구 누적. CHA-06 catch-up tests fixture가 N=수백 row 수준이라 production 부하 미커버
2. **engine_telemetry 트리거 drop window**: GC 절차 중 telemetry write RAISE(ABORT) → cost-meter / batch-pipeline / d1_slo 동시 발화 → 503 → BATCH 전체 재실행
3. **Workers performance.now() 100μs precision**: V8 isolate suspend/resume 시 정확도 저하 사례 — Cloudflare GitHub issue 트래킹 의무
4. **AST 한도 200 / depth 15 4× 여유 안전**: PRF-01 footnote — 51 산식 미측정. BATCH-1 적재 후 평균 100 노드 시 1.5× 여유 — Sprint 1 §5.4 보수화 약화
5. **Two-Layer Cost kill switch 100% 임계**: 단발 거대 호출 시 budget × 1.5 spike 가능 ($10 → $15)

---

## 누적 이월 MAJOR 36건 흡수 권고 — performance 영역

1. **PRF-01 (BATCH1 6 sample → 51 산식 expansion)**: BATCH-1 적재 직후 의무. CRITICAL-PERF-4 cache key 변경과 동시 처리
2. **PRF-02 (naive DFS N 측정)**: BATCH-1 적재 후. M-PERF-2 통합 single-pass 검증 후 측정 시점 결정
3. **PRC-01 (131/255 framework → BATCH-1 expansion)**: BATCH-1 적재 직후. M-PERF-4 chunked batch 동시 처리
4. **§10.7 #4 Cat 5B 성능 벤치**: M-PERF-5 번들 측정 부분 흡수 + LOD-04 도입 후 Vectorize latency
5. **§10.7 #6 naive DFS 임계 노드 수**: PRF-02 와 동일

---

## 판정

**Phase 1 종료 게이트 통과 가능** — 본 영역 부채는 모두 Phase 2 트래킹.

진산님 즉시 결정 필요:

1. CRITICAL-PERF-3 (rate_limits 28.8M timeout): Phase 1 종료 직후 batch DELETE 도입 plan
2. CRITICAL-PERF-1 (dashboard 16 round-trip): admin-web 5초 polling 가동 직전 Promise.all 병렬화 (1시간)
3. CRITICAL-PERF-2 (telemetry GC 부재): Phase 2 LOD-03 직전 Cron handler + 트리거 조건부 완화 plan

---

**원본 에이전트**: `performance-engineer` (agentId: `a1cc8a17c8c04a6e0`)
