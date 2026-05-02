── 4-PASS REVIEW (Pass 1+2) — telemetry-client wire-up ──

리뷰 일자: 2026-05-02
리뷰 대상: Step 037 CRITICAL-DO-S1-1 (apps/batch telemetry-client + pipeline 6곳 wire-up)
리뷰 방식: 독립 에이전트 (silent-failure-hunter / 무자가리뷰 의무)
리뷰 범위:
변경 4개 파일 — 명시 확인: - apps/batch/src/adapters/telemetry-client.ts (신규, 244 lines 실측) - apps/batch/src/**tests**/telemetry-client.test.ts (신규, 357 lines 실측, 14 tests PASS) - apps/batch/src/pipeline.ts (PipelineContext.telemetryClient + 6곳 emit + 1곳 flushPending) - apps/batch/bin/batch.ts (createTelemetryClientFromEnv() + ctx 주입) - scripts/verify-engine-contracts.ts (apps/batch required 311→325 — actual file shows 325 ✓)
연관 3개 파일 (수정 안 함, 정합 검토): - apps/api/src/telemetry/types.ts (ENGINE_TELEMETRY_GAUGES + Zod schema) - apps/api/src/telemetry/routes.ts (POST /api/telemetry 구현) - apps/api/src/telemetry/admin-token.ts (cookie/header 추출)

─────────────────────────────────────────────────────────────

## Pass 1 (Surgeon) — 코드 정합성

🔴 0건 / 🟠 2건 / ✅ 6건 확인 / N/A 1건

### ✅ 확인 (증거 기반 — 6개 이상)

1. telemetry-client.ts:97 — `globalThis.fetch.bind(globalThis)` 명시 binding. Detached `globalThis.fetch` 호출 시 Illegal invocation TypeError 위험을 제거. Node 18+ undici 의 fetch 가 internal `this` slot 의존하는 환경에서 안전.

2. telemetry-client.ts:147,174 — AbortController + clearTimeout 정합. `try/finally`로 clearTimeout 보장 (catch 흐름 + ok 흐름 + 4xx 분기 + retry 분기 모두 finally 통과). Timer leak 0건. 14건 테스트 중 timeout 시나리오(test:326-356)에서 callCount=2 검증되어 retry 후에도 leak 없음.

3. telemetry-client.ts:121-124 — pending Set race 차단 패턴. `pending.add(promise)` 가 emit() 동기 흐름에서 즉시 수행되고, `promise.finally(() => pending.delete(promise))` 는 microtask. flushPending() 이 emit() 호출 직후 동기적으로 호출되어도 add 가 먼저 끝난 후라 snapshot 에 반드시 포함됨. test:286-310 (3건 동시 emit + flushPending) 결과 3개 모두 wait 검증 PASS.

4. telemetry-client.ts:113-120 — fire-and-forget catch. `this.send(input).catch(...)` 가 send() 의 모든 throw 경로를 흡수. flushPending 의 `Promise.allSettled` (line 130) 와 결합하여 unhandled rejection 0건. test:261-282 (network throw) 결과 maxAttempts=2 callCount=2 + errorCalls=1 검증 PASS.

5. telemetry-client.ts:144-182 — retry 결정 트리. lastErr 누적 + nonRetryable break + maxAttempts loop 구조 직선적. 4xx → 즉시 break (test:186-210, callCount=1 검증). 503 → maxAttempts 회 (test:212-233, callCount=3 검증). first 503 → second 201 → 성공 (test:235-259, errorCalls=0 검증).

6. telemetry-client.ts:90 — apiBase trailing slash 정규화 `replace(/\/+$/, '')`. test:121-160 에서 'http://localhost:8787/' 입력 → 'http://localhost:8787/api/telemetry' 출력 검증.

### 🟠 MAJOR 1: timeoutMs=0 / maxAttempts=0 엣지케이스 미검증 (telemetry-client.ts:95-96)

**증상:**

- `options.timeoutMs ?? DEFAULT_TIMEOUT_MS` — 호출자가 명시적으로 `0` 주입 시 `?? `는 nullish 만 fallback 하므로 timeoutMs=0 이 그대로 전파.
- timeoutMs=0 → `setTimeout(..., 0)` 가 즉시 abort signal trigger → fetch 가 시작도 전에 AbortError → retry → 동일 즉시 abort → 영구 실패.
- maxAttempts=0 입력 시 line 145 `for (let attempt = 1; attempt <= 0; attempt++)` 루프 진입 안 함 → lastErr=null → line 182 `throw lastErr ?? new Error('telemetry emit failed (unknown)')` → 'unknown' 으로 throw → 어떤 fetch 호출도 없이 무조건 실패.

**Hidden Errors:**

- 호출자가 환경변수 파싱 실수로 0 입력 (예: `parseInt('') === NaN ?? DEFAULT` 가 아닌 `parseInt('0')`)
- 테스트에서 maxAttempts=0 으로 "retry 비활성" 의도 시 silent 0회 호출 + 'unknown' error 발생

**User Impact:**

- production 운영자가 환경변수 misconfig 시 모든 telemetry 가 0회 시도로 사라짐 + log 메시지가 'telemetry emit failed (unknown)' 로 모호함
- BATCH 진행은 정상이나 8 게이지 dashboard 에 데이터 0건 — 운영 알람 부재 시 silent observability 손실

**Recommendation:**

- constructor 에 `if (timeoutMs <= 0 || maxAttempts <= 0) throw new Error(...)` 또는 최소 1로 강제 (`Math.max(1, ...)`)
- 또는 명시적 sanity validation + logger.warn 후 default 폴백

**예시 수정:**

```typescript
timeoutMs:
  options.timeoutMs !== undefined && options.timeoutMs > 0
    ? options.timeoutMs
    : DEFAULT_TIMEOUT_MS,
maxAttempts:
  options.maxAttempts !== undefined && options.maxAttempts >= 1
    ? options.maxAttempts
    : DEFAULT_MAX_ATTEMPTS,
```

### 🟠 MAJOR 2: pipeline.ts:728 telemetryClient null 체크와 ctx.telemetryClient?.emit 비대칭

**증상:**

- pipeline.ts:617, 682, 1036, 1113, 1184, 1199 — 모두 `ctx.telemetryClient?.emit({...})` 패턴으로 optional chaining.
- pipeline.ts:728 — `if (ctx.telemetryClient) { try { await ctx.telemetryClient.flushPending() } catch ... }` — 대조적으로 명시 `if` 분기.
- 결과 자체는 동일하지만 **try/catch 가 emit 6곳에는 없고 flushPending 1곳에만 있음**. Promise rejection 발생 가능성:
  - emit 은 fire-and-forget — 내부 catch 가 send() 의 모든 throw 흡수 (telemetry-client.ts:113), `void` 반환이라 throw 가 BATCH 흐름에 영향 없음 ✓
  - flushPending 은 `Promise.allSettled` 사용 (telemetry-client.ts:130) — 자체적으로 throw 안 함. 따라서 pipeline.ts:730 `await ctx.telemetryClient.flushPending()` 는 사실상 throw 불가능.
- 즉 pipeline.ts:731-742 의 try/catch + metaPersistenceFailures push 는 **dead code path** (도달 불가능).

**Hidden Errors:**

- 미래 누군가 NoopTelemetryClient 또는 HttpTelemetryClient 의 flushPending 시그니처를 throw 가능하게 변경 시 → 이 catch 가 제대로 동작 — 즉 **방어적 코드로 정당화 가능**.
- 그러나 현재로서는 LOC 11줄 (730-742) 의 catch 분기가 cover 안 되는 상태. 테스트 부재.

**User Impact:**

- 영향 0 (방어 코드라 정상 동작에는 무영향).
- 향후 리팩토링 시 이 catch 가 의도된 dead code 임을 모르고 제거할 위험.

**Recommendation:**

- 옵션 A: telemetry-client.ts flushPending() 내부에서 `Promise.allSettled` 가 아니라 unsettled rejection 을 의도적으로 surface 하도록 변경 (현재 의도와 충돌, 비추천)
- 옵션 B: pipeline.ts:728-743 에 주석 추가 — "현재 flushPending() 는 Promise.allSettled 로 throw 불가, 이 try/catch 는 향후 시그니처 변경 대비 방어"
- 옵션 C: telemetry-client.ts 에 명시 — `flushPending(): Promise<void>` // never throws (allSettled 보장)

**예시 수정 (옵션 B):**

```typescript
// 본 try/catch 는 향후 flushPending() 시그니처 변경 (allSettled → all 등) 대비 방어선.
// 현재 구현(allSettled)에서는 도달 불가능 — 의도된 dead code.
if (ctx.telemetryClient) {
  try {
    await ctx.telemetryClient.flushPending();
  } catch (err) { ... }
}
```

### N/A 1: 부동소수점 정밀도

**N/A 사유:** metricValue 는 number — JavaScript IEEE 754 double 그대로 JSON.stringify 후 전송. 백엔드(routes.ts:191) 는 `z.number().finite()` 만 검사하고 D1 REAL 컬럼에 그대로 저장. `cost` 게이지(pipeline.ts:684) USD float, `formula_accuracy` (pipeline.ts:1201) 0~1 ratio, `batch_progress` (pipeline.ts:619) 0~100 percent 모두 IEEE 754 표현 가능 범위 내. 부동소수점 누적 오차 우려 0건 (단일 측정값 emit 이라 reduce/sum 없음).

### 반론 (Devil's Advocate)

**시나리오:** `process.exit(1)` 직후 in-flight emit 이 누수된다.

- pipeline.ts:744 finally 블록은 정상 throw / 정상 완료 모두 await flushPending 보장 ✓
- 그러나 `bin/batch.ts:521-524` 의 `main().then(...).catch(...)` 에서 main() 자체가 reject 시 `process.exit(1)` 즉시 호출. 이 시점에 in-flight emit Promise 가 남아 있다면?
- `main()` 내부 try/finally (batch.ts:209-251) 가 runPipeline 호출을 감싸지만 **catch 부재**. runPipeline 이 throw 하면 finally 실행 → flushPending 도 finally 안에서 await 완료된 후 → catch는 외부 main의 try 내 catch → exit 1.
- 즉 finally 순서상 flushPending 은 process.exit 전에 await 완료. ✓
- **단, SIGINT 도중**: signal-handlers.ts (pipeline.ts:507-545) flushCheckpoint 콜백 안에서 `process.exit` 직접 호출 하지 않더라도 `markBatchRunKilled` 가 fire-and-forget. 이 시점에 telemetry in-flight 가 있다면 process.exit() 도달 시 unhandled. → telemetry-client 의 emit catch 가 unhandled rejection 막아주지만 **데이터 자체는 전송 안 됨** (정상 동작 — best-effort).
- 결론: 정상 흐름은 안전. SIGINT는 best-effort 손실 수용 (이미 design 의도).

**시나리오:** AbortController.abort() 와 fetch 응답 도착 race condition.

- 50ms timeoutMs + 5ms 응답 도착 시 fetch promise resolve 는 timer 콜백보다 먼저 → res.ok=true return → finally clearTimeout. 안전.
- 49ms 응답 + 50ms timer race → controller.abort() 호출 후에도 이미 응답 stream 진입 → 표준 fetch 는 abort 시 stream 폐기. 응답 onbody 처리 진입 후 abort 도달 시 partial response throw 가능 — 하지만 본 모듈은 res.body 를 읽지 않고 status 만 검사 (line 161 `res.ok`) → race window 좁음.
- **잠재 약점**: status 200 / network drop mid-body 시 — 본 모듈 영향 0 (body 미사용).

─────────────────────────────────────────────────────────────

## Pass 2 (Architect) — 연계 검증

🔴 0건 / 🟠 2건 / ✅ 7건 확인 / N/A 2건

### ✅ 확인 (증거 기반 — 7개 이상)

1. **Import 방향 단방향 확인** — apps/batch/src/adapters/telemetry-client.ts 의 import 는 `'@thepick/shared'` 만 (line 25). apps/api 직접 import 없음 (`grep -r "from.*apps/api" apps/batch/src/` 결과 0건 검증). HTTP 경계만 존재 → monorepo 의존성 단방향 정합.

2. **TELEMETRY_GAUGES enum 1:1 정합** — apps/batch/src/adapters/telemetry-client.ts:31-40 vs apps/api/src/telemetry/types.ts:14-23 — 8 게이지 순서/이름 모두 일치:
   - batch_progress, cost, d1_slo, graph_integrity, quality_gate, formula_accuracy, reviewer_queue, learning_slo
     test 정합 검증 (telemetry-client.test.ts:46-57) PASS.

3. **examId Hard Rule 17 정합** — bin/batch.ts:204 `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 명시 사용. telemetry-client.ts:62 `examId: ExamId` brand type 만 receive (literal 직접 미수용). createTelemetryClientFromEnv (line 213-236) 는 args.examId 를 그대로 신뢰 — 최외곽 진입점(bin/batch.ts)이 EXAM_IDS 경유로 주입하므로 Rule 17 위반 0건. assertValidExamId 추가 방어선은 runPipeline 진입(pipeline.ts:456)에서 수행됨.

4. **Workers 호환성 N/A 처리 정합** — telemetry-client.ts 는 `@runtime Node.js only` 명시 (line 4). Cloudflare Workers 가 아닌 apps/batch (Node 진입점) 에서만 사용. `process.env` (line 218-219) / `setTimeout` (line 100, 147) / `AbortController` 모두 Node 환경 가용. 검증: bin/batch.ts:1 shebang `#!/usr/bin/env tsx` + 기존 `node:fs` / `node:path` import 와 동일 환경.

5. **D1 schema 정합** — migrations/0017_engine_telemetry.sql:66-75 CHECK 제약 8 게이지 enum 과 telemetry-client.ts:31-40 TELEMETRY_GAUGES 1:1 매칭. metric_value REAL / metric_json TEXT (line 61-62) → batch.ts emit body (telemetry-client.ts:135-142) 의 metricValue: number / metricJson: object → routes.ts:191 writeTelemetryEvent → D1 적재. CHECK (metric_value IS NOT NULL OR metric_json IS NOT NULL) — telemetry-client.ts:105-112 application 측 동일 검증 (refine 위반 시 fetch 호출 안 함). DB 트리거와 application 가드 이중방어.

6. **PipelineContext.telemetryClient optional 적합** — pipeline.ts:307 `readonly telemetryClient?: TelemetryClient`. `?.` chaining (line 617, 682, 1036, 1113, 1184, 1199) + line 728 `if` 분기 — 미주입 시 BATCH 차단 0건. recover.ts 는 telemetryClient 의존 0건 (`grep -n "telemetry" recover.ts` 0건). 의존 흐름 단방향 (pipeline.ts → telemetry-client.ts).

7. **MetaPersistenceFailure.operation union 갱신 정합** — pipeline.ts:118-125 union 에 `'finalize_telemetry'` 추가됨. 사용처 pipeline.ts:739 `operation: 'finalize_telemetry'` 일치. caller(bin/batch.ts:240-242) 는 `f.operation` 을 string 으로만 출력하므로 새 literal 추가에 영향 0건. exhaustive switch 사용처 0건 (`grep -rn "operation === 'finalize" apps/batch` 결과 사용 패턴 없음 — push only).

### 🟠 MAJOR 1: pipeline.ts:617, 1036, 1113, 1184, 1199 — `metricValue` semantics 일관성 부재 (게이지간 단위 혼재)

**증상:**

- batch_progress (line 619): `((i + 1) / PIPELINE_STAGES.length) * 100` — **percent 0~100**
- cost (line 684): `costState.initial_spend_usd` — **USD float**
- d1_slo (line 1038): `loadResult.durationMs` — **milliseconds (정수)**
- graph_integrity (line 1115): `1` — **boolean indicator (1=valid, 0=invalid)**
- quality_gate (line 1186): `result.passed ? 1 : 0` — **boolean indicator**
- formula_accuracy (line 1201): `formulaPassCount / formulaChecks.length` — **ratio 0~1**

→ 6개 emit 이 6가지 다른 단위. `migrations/0017_engine_telemetry.sql:25-33` 주석은 (1) 0~1, (2) micro_cents, (3) latency_ms, (4) violations_count, (5) pass_count, (6) 1.0/0.0, (7) queue_size, (8) sessions_per_user_p95 로 정의. 비교:

| gauge            | 마이그레이션 주석 의도          | pipeline.ts 실 구현               | 정합?                    |
| ---------------- | ------------------------------- | --------------------------------- | ------------------------ |
| batch_progress   | 0~1 적재 진척 비율              | 0~100 percent                     | **불일치**               |
| cost             | micro_cents                     | initial_spend_usd (USD float)     | **불일치**               |
| d1_slo           | latency_ms p95                  | loadResult.durationMs (단일 측정) | 단위 일치, p95 X         |
| graph_integrity  | violations_count (≥0, 0=PASS)   | 1 (success only)                  | **반대 의미** (1이 PASS) |
| quality_gate     | pass_count (8 카테고리 PASS 수) | 0 또는 1 (passed boolean)         | **불일치**               |
| formula_accuracy | 1.0/0.0                         | 0~1 ratio                         | 의미 다름 (정확도 비율)  |

**Hidden Errors:**

- admin-web 대시보드(routes.ts dashboard 응답)가 마이그레이션 주석 단위로 표시 시 batch_progress 100% 가 "10000% (100×100)" 로 보일 수 있음.
- graph_integrity=1 이 "1건 위반" 으로 오해석 가능 (반대 의미).
- cost 누적 USD 가 "1.5 micro_cents = 0.0000015 USD" 로 표기 → 실제 $1.5 가 아주 작은 값으로 보임.

**User Impact:**

- 관리자가 dashboard 보고 8 게이지 의미 혼동 → 운영 의사결정 오류.
- 마이그레이션 SQL 주석은 "정의 의도", pipeline.ts 는 "실제 emit" — 이 두 출처가 어긋난 채 fact table 누적 → Phase 2 alarm rule 작성 시 임계값 정의 충돌.

**Recommendation:**

- 옵션 A (즉시): pipeline.ts emit 시 metricValue 를 마이그레이션 주석 의도와 일치시킴
  - batch_progress: `(i+1)/PIPELINE_STAGES.length` (0~1)
  - cost: USD → micro_cents 변환 `Math.round(initial_spend_usd * 100_000_000)`
  - graph_integrity: orphans+broken+cycles 의 합 (violations_count)
  - quality_gate: `passCount` 직접 (pass_count)
- 옵션 B: 마이그레이션 주석을 "Phase 1 에서는 단위 자유, Phase 2 에서 표준화" 로 명시 변경
- 옵션 C: types.ts 에 게이지별 단위 명세 enum 추가 + ESLint rule 로 emit 단위 강제

**우선순위:** Phase 1 admin-web 대시보드 PR 직전 (Step 037 직후)에 정합 의무 — 그렇지 않으면 dashboard UI 가 혼란.

### 🟠 MAJOR 2: telemetryClient flushPending 호출 위치 — sigint 시 누수 가능

**증상:**

- pipeline.ts:725-743 — `finally` 블록 안에서 `await ctx.telemetryClient.flushPending()` 정상 동작.
- 그러나 pipeline.ts:511-545 `installSignalHandlers` flushCheckpoint 콜백은 process.exit 직전에 동기적으로 `writeCheckpointSync` + `markBatchRunKilled` (fire-and-forget) 호출. 이 시점에 in-flight telemetry emit 이 있다면 process.exit 시 데이터 손실.
- **이는 의도된 best-effort** (markBatchRunKilled 도 동일 패턴 — pipeline.ts:529 코멘트 "best-effort — process.exit 직전이라 await 불가"). 그러나 **telemetry flushPending 은 signal handler 내에서 호출 시도조차 없음**.

**Hidden Errors:**

- BATCH 7 stage (예: db_load) success 직후 telemetry emit (metricValue=...) → 즉시 SIGTERM (Cloudflare Workers 가 아닌 Node 환경에서도 운영자 Ctrl+C) → in-flight POST 가 5s timeout 도달 못 함 → process.exit → 1 게이지 데이터 누락.
- 정상 SIGINT 종료 후 다음 BATCH run 시 그 게이지 데이터에 5분 공백 발생 → Phase 2 alarm rule 의 "no_data" 분류로 들어가 false alarm.

**User Impact:**

- 운영자 SIGINT 빈번 환경에서 8 게이지 dashboard 데이터 sparse → "엔진 죽었나?" 오해.
- 그러나 BATCH 결과 자체에는 무영향 (best-effort 의도와 정합).

**Recommendation:**

- 옵션 A: signal handler 내 `flushCheckpoint` 콜백에 telemetry flushPending fire-and-forget 추가 (markBatchRunKilled 와 동일 패턴 — 5s timeout 안에 끝나면 보존, 안 되면 포기).
- 옵션 B: 현 상태 유지 + 코멘트 명시 — "SIGINT 시 telemetry in-flight 손실 best-effort 수용".
- 옵션 C: SIGINT 시 process.exit 호출 전 grace period (예: 5s) 도입 — signal-handlers.ts 변경 영향 큼.

**예시 수정 (옵션 B, 즉시 적용 가능):**

```typescript
// pipeline.ts:725 직전
// === Step 037 telemetry — flushPending (in-flight emit drain) ===
// 정상 종료 경로에서만 await — SIGINT 도중 in-flight emit 은 best-effort 손실 수용
// (markBatchRunKilled 와 동일 패턴, signal-handlers.ts 미연동 의도).
```

### N/A 1: Workers 제약 (fs/path)

**N/A 사유:** apps/batch 는 Node 진입점 (bin/batch.ts shebang). Cloudflare Workers 환경에서 실행되지 않음. telemetry-client.ts 자체도 fetch + AbortController + setTimeout 만 사용 — 모두 Workers 호환이지만 본 검증 대상 아님.

### N/A 2: i18n 한국어 하드코딩

**N/A 사유:** telemetry-client.ts 의 한국어 문자열 (line 107, 226-227, 232) 은 모두 logger 메시지 — 운영자 대상 stderr/JSON log. 사용자 노출 UI 0건. 대시보드(admin-web)는 별도 PR 범위로 분리.

### 반론 (Devil's Advocate)

**시나리오:** apps/api 측 Zod schema(types.ts:45-57) 와 batch 측 emit body(telemetry-client.ts:135-142) 미세 불일치.

- Zod: `examId / gaugeName` required, `metricValue / metricJson / sourceId / batchRunId` optional, refine: `metricValue || metricJson` 둘 중 1개 필수.
- batch: `examId / gaugeName / batchRunId` 항상 포함, `metricValue / metricJson / sourceId` 조건부 spread.
- → batchRunId 가 batch 측에서 항상 포함이지만 apps/api Zod schema 는 optional `.min(1).max(128)` (types.ts:52). 정합 ✓
- **잠재 미스매치**: batch 측 batchRunId 가 빈 문자열 ('') 일 경우? bin/batch.ts:198 `randomUUID()` 사용으로 항상 36자 보장. → 안전.
- **추가 잠재 미스매치**: sourceId max 256 (Zod), batch 측 emit (예: `'pipeline:qg2_gate'`) 19자. ✓
- 결론: schema 검증 정합 — 운영 환경에서 422 발생 0건 보장.

**시나리오:** 동시 BATCH 2개 실행 시 telemetry 충돌.

- recover.ts 가 `concurrent_run_detected` (state='in_progress' 인 다른 batch_run 존재) 차단 — 진입 차단 ✓
- 그러나 같은 examId 의 다른 batchRunId 로는 동시 진행 가능 (Year 1 단일 시험). 두 BATCH 가 batch_progress emit 시 timeline 에 interleave → admin-web 대시보드는 latest 만 표시 → 한쪽 BATCH 진척 가려짐.
- → Phase 2 alarm rule 에서 `batchRunId` GROUP BY 추가 필요 (master-dashboard.md 기 정의).

─────────────────────────────────────────────────────────────

## 판정

**완료 가능** (CRITICAL 0건). MAJOR 4건 (Pass 1: 2 / Pass 2: 2) 은 즉시 흡수 가능한 보강 항목.

### 흡수 우선순위 권고

**P0 (Step 037 진입 전 즉시 흡수 권고)**

- Pass 2 MAJOR 1: metricValue semantics 정합 (admin-web 대시보드 PR 의 prerequisite — 단위 혼재 시 UI 표시 의미 손상)

**P1 (Step 037 안에서 흡수 권고)**

- Pass 1 MAJOR 1: timeoutMs/maxAttempts 0 가드 (production misconfig 방어)
- Pass 2 MAJOR 2: SIGINT 시 telemetry flush 정책 명시 (코멘트 추가만으로도 OK)

**P2 (다음 step 으로 이연 가능)**

- Pass 1 MAJOR 2: pipeline.ts:728 dead code 주석 보강 (방어 코드 의도 명시)

### 검증 추가 권고

- 14 tests PASS 확인 (실측: telemetry-client.test.ts 14 tests / 116ms / 100% pass)
- pipeline.ts wire-up 6곳에 대한 통합 테스트 1건 추가 권장 (fixture mode + recordedEmits 검증) — 현재 테스트는 client 단독에 한정.
- types.ts 와 telemetry-client.ts 의 게이지 enum 동기를 강제하는 type-level test 또는 ESLint rule 권장 (현재는 주석으로만 동기 의무 표기).

────────────────────────────────────────────────────────────────

## 작성 메타

- 자가 리뷰 회피 확인: 본 리뷰는 코드 작성자(Step 037 구현 컨텍스트)와 분리된 독립 시점에서 수행. silent-failure-hunter 관점 적용.
- 증거 기반 보고: 각 ✅ 항목은 파일:라인 + 실 명령 결과(grep, vitest run) 동반.
- 반론 의무: Pass 1, Pass 2 각 시나리오 기반 Devil's Advocate 1개 이상 명시.
- auto-review-protocol.md 규칙 0/1/2/3 준수 확인.
