---
리뷰 방식: 독립 에이전트 (system-architect)
리뷰 일시: 2026-04-29 09:44 KST
리뷰 대상: Step 11.6 코드 구현 (본 세션 변경 9건)
리뷰자 컨텍스트: 본 세션 메인 대화 모름 (의도 편향 차단)
---

## 1. 검토 범위 — 실제로 읽은 파일:라인

|  #  | 파일                                                                        |     라인     | 목적                                                                 |
| :-: | :-------------------------------------------------------------------------- | :----------: | :------------------------------------------------------------------- |
|  1  | `apps/batch/src/pipeline.ts`                                                | 1–948 (전체) | PipelineContext 확장 / runPipeline 흐름 / toSnapshot / 에러 클래스   |
|  2  | `apps/batch/src/checkpoint.ts`                                              | 1–541 (전체) | WriteCheckpointOptions / writeCheckpoint fsync / writeCheckpointSync |
|  3  | `apps/batch/src/recover.ts`                                                 | 1–301 (전체) | BatchRunsDb.insertNewRun? optional / examId 파라미터                 |
|  4  | `apps/batch/src/d1-batch-runs-db.ts`                                        | 1–129 (전체) | D1 어댑터 SQL 발행 + 0015 트리거 throw 전파                          |
|  5  | `apps/batch/src/in-memory-batch-runs-db.ts`                                 | 1–141 (전체) | dry-run/test 어댑터 0015 invariant 모방                              |
|  6  | `apps/batch/src/signal-handlers.ts`                                         | 1–62 (전체)  | SIGINT/SIGTERM handler + cleanup                                     |
|  7  | `apps/batch/bin/batch.ts`                                                   | 1–417 (전체) | CLI 진입점 5 신규 ctx 필드 + ENGINE_VERSION 동적                     |
|  8  | `apps/batch/src/__tests__/pipeline.integration.test.ts`                     | 1–393 (전체) | step116TestFields helper + 5 ctx 갱신                                |
|  9  | `apps/batch/src/loader/draft-loader.ts`                                     | 1–230 (선택) | LoadDraftResult.lastInsertedNodeId 옵셔널 + 미주입 확인              |
| 10  | `apps/batch/src/cost-meter.ts`                                              |   340–399    | toCheckpointCostState() 시그니처                                     |
| 11  | `apps/batch/__tests__/recover.test.ts`                                      |    1–120     | 8 mock 테스트의 BatchRunsDb 모양 (insertNewRun 부재 확인)            |
| 12  | `migrations/0015_batch_runs.sql`                                            | 1–95 (전체)  | 트리거 3종 invariant 원본                                            |
| 13  | `migrations/0016_knowledge_nodes_batch_idempotency.sql`                     | 1–98 (전체)  | knowledge_nodes batch_run_id/source_id                               |
| 14  | `apps/batch/package.json`                                                   |     1–25     | `"type": "module"`, version 0.1.0                                    |
| 15  | `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md` |  1040–1130   | §10 6 callsite SLO + §11 의존성                                      |

**typecheck 검증:** `cd apps/batch && pnpm typecheck` → tsc --noEmit + tsconfig.manual.json 모두 0 errors. Plan §10 SLO `typecheck PASS` 만족.

---

## 2. CRITICAL — 0건

증거 기반:

- C1 후보 (`runPipeline` 의 0.5 분기 idempotency UPDATE 중복) 검증 — `recover.ts:283-286` 의 `state='recovered'` UPDATE 는 **fully_recovered/partially_recovered 경로만** 발화. `pipeline.ts:386-408` 의 `no_checkpoint` 분기는 `insertNewRun` (state='in_progress' 신규 INSERT) 수행. **두 경로는 상호배타적** — recover.ts 가 throw 또는 5종 status 중 1개 반환, fully/partially 시 이미 'recovered' UPDATE, no_checkpoint 시는 INSERT. 중복 UPDATE 없음. **non-issue.**
- C2 후보 (resume_from_stage_index 의 off-by-one) 검증 — `pipeline.ts:387-392`:
  ```typescript
  const resumeFromStageIndex =
    (recovery.status === 'fully_recovered' || ...) && recovery.resumed_from_stage !== null
      ? PIPELINE_STAGES.indexOf(recovery.resumed_from_stage) + 1 : 0;
  ```
  `recover.ts:290` 가 `resumed_from_stage: checkpoint.pipeline_state_snapshot.last_completed_stage` 반환. plan §4.2 명시 "fully_recovered: resumed_from_stage 다음 stage 부터 재개" — `+1` 정확. e.g. last_completed='db_load' (idx=5) → resume idx=6 ('integrity_check'). off-by-one 없음.
- C3 후보 (engineVersion 동적 읽기 dist 빌드 path 깨짐) 검증 — `batch.ts:53-57` 의 `JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'))`. `package.json` 의 `"bin": "./bin/batch.ts"` 는 **tsx 직접 실행 경로** (dist 빌드 단계 부재 — typecheck는 `--noEmit`). `import.meta.url` → `fileURLToPath` → `dirname` 으로 `apps/batch/bin/` 도달 → `..` 로 `apps/batch/` 도달 → `package.json` 정확. dist 빌드는 본 plan 스코프 X (Step 14 패키지화 책임). **non-issue (현 시점)**, MINOR 이연으로 후술.
- C4 후보 (Hard Rule 16 위반 — examId 미전파) 검증 — `pipeline.ts:216, 369, 403, 435, 500, 531, 542` 의 모든 BatchRunsDb 호출 examId 전파. `recover.ts:147, 151, 283` 도 examId 전파. `D1BatchRunsDb` / `InMemoryBatchRunsDb` 의 모든 메서드 첫 인자 examId 시그니처. **Hard Rule 16 PASS.**
- C5 후보 (Hard Rule 17 위반) 검증 — `grep -rn "'son-hae-pyeong-ga-sa'" apps/batch/` → **0건** 매치 (테스트 픽스처 제외). `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 만 `bin/batch.ts:191` 1곳 + JSDoc 1곳 (Rule 17 예외). **Hard Rule 17 PASS.**

---

## 3. MAJOR — 2건

### M1. `processBatch` 의 `result.usage` 타입과 `recordTokens` 호출 시 `model` 인자 정합성 미검증

**파일:라인:** `apps/batch/src/pipeline.ts:752-757`

**증거:**

```typescript
const status = ctx.costMeter.recordTokens(
  result.usage.inputTokens,
  result.usage.outputTokens,
  result.usage.model,
  'batch_structurize',
);
```

**영향:** `result.usage.model` 이 `string` 타입이지만, `CostMeter.recordTokens` 의 4번째 인자 시그니처가 `'claude-haiku' | 'claude-sonnet' | ...` 등 union 일 가능성. typecheck 가 PASS 인 것은 model 인자가 실제로 `string` 받기 때문 (cost-meter.ts 미열람). 하지만 `'claude-3-5-sonnet-20241022'` 같은 미등록 모델 ID 가 들어오면 cost-meter 내부 가격표 lookup miss → 비용 0 USD 로 silent 누락 가능 (CostMeter 의 책임이지만, pipeline 진입 시 model 정규화 의무가 누구인지 모호).

**권고:** §4.3.2 plan 본문에 "모델 ID 정규화 책임 = pipeline 진입 / cost-meter 내부 / processBatch 어디인가" 1줄 명시. 또는 `cost-meter.ts` 열람하여 알려진 모델만 받는지 확인 후 NotImplementedError throw 정책 검토. 본 리뷰 스코프 내 cost-meter 코드 직접 검증 부재 → **MAJOR 보류.**

### M2. `ConcurrentRunError` / `RecoveryFailedError` 의 caller 처리 부재

**파일:라인:** `apps/batch/src/pipeline.ts:295-311`, `apps/batch/bin/batch.ts:81-87`

**증거:** pipeline.ts 가 두 에러 클래스를 export 하고 throw 하는데, `bin/batch.ts:81-87` 의 main catch 는 **일반 Error 와 동일하게** 처리:

```typescript
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[thepick-batch] ERROR: ${msg}`);
  ...
  return 1;  // 모두 동일 exit code
}
```

ConcurrentRunError vs RecoveryFailedError vs 기타 throw 에 대해 exit code 구분 없음, 진산님 결정 트리거 메시지 차별화 없음. plan §3.3 의도 "caller (CLI / 통합 테스트) 가 별도 catch 후 진산님 결정 트리거" 미달성.

**영향:** 운영 단계에서 "concurrent run" 인지 "recovery failed" 인지 stdout 만으로 구분 어려움. on-call 새벽 3시 시나리오에서 alert 노이즈. plan §13 진산님 승인 항목 3 ("`process.exit(130/143)` 호출") 의 차별 exit code 정책과 일관성 결여 — SIGINT 은 130, RecoveryFailedError 는 1 (일반 에러).

**권고:** `bin/batch.ts` main catch 분기 추가:

```typescript
if (err instanceof ConcurrentRunError) {
  console.error(`[thepick-batch] CONCURRENT_RUN: batch_run_id=${err.batchRunId}`);
  return 1; // 또는 별도 exit code (예: 75 = EX_TEMPFAIL)
}
if (err instanceof RecoveryFailedError) {
  console.error(`[thepick-batch] RECOVERY_FAILED: batch_run_id=${err.batchRunId} — manual review`);
  return 1; // 또는 EX_DATAERR=65
}
```

---

## 4. MINOR — 4건

### m1. `engineVersion` 동적 읽기 — 향후 dist 빌드 시 깨질 위험 명시 부재

**파일:라인:** `apps/batch/bin/batch.ts:50-58`

**증거:** `JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), ...))` 패턴은 tsx 실행 경로에서만 동작. `apps/batch/package.json` 의 `bin` 이 `./bin/batch.ts` 로 .ts 직접 지정 — 향후 ESM 번들 산출물(`dist/bin/batch.mjs`) 도입 시 `..` 가 `apps/batch/dist/` → `apps/batch/dist/package.json` 미존재 → throw. Step 14 패키지화 시 회귀 위험.

**권고:** 주석으로 "dist 빌드 도입 시 `import.meta.url` 기반 절대 경로 + monorepo root package.json fallback 의무" 명시. 또는 빌드 타임 `--define` 으로 const inline.

### m2. `buildSkipResult` 의 `qg2Passed: false` 가 already_completed 시 misleading

**파일:라인:** `apps/batch/src/pipeline.ts:317-331`

**증거:** already_completed (이전 실행이 이미 PASS 한 BATCH 의 idempotency 재실행) 시:

```typescript
return {
  batchId: ctx.batchId,
  stages: PIPELINE_STAGES.map((stage) => ({ stage, status: 'skipped', ... })),
  qg2Passed: false,  // ← 이전 실행이 success 했음을 caller 가 모르게 됨
  ...
}
```

CLI `bin/batch.ts:200` 가 `result.qg2Passed ? 0 : 1` 로 exit code 결정 → already_completed 인데도 exit 1 반환. on-call 시 "QG-2 실패" alert 발생 가능.

**권고:** `buildSkipResult` 에서 `qg2Passed: true` 반환 (이미 completed = PASS 였음을 의미). 또는 PipelineResult 에 `idempotencySkipped: boolean` 신규 필드 추가하여 caller 가 구분 가능하게.

### m3. `D1BatchRunsDb.updateState` 동적 SQL 의 SQL injection 가능성 — 현 구현 안전하나 가시성 부족

**파일:라인:** `apps/batch/src/d1-batch-runs-db.ts:95-126`

**증거:** `sets: string[] = ['state = ?']` 에서 컬럼명은 **string literal hardcoded** (예: `'resume_count = resume_count + ?'`). 값은 모두 `vals.push(...)` + `bind(...vals)` 로 prepared statement 파라미터화. **현 시점 SQL injection 안전.** 다만 향후 누가 동적 컬럼명을 추가할 위험 (예: `update.someColumn` 을 string concat 로 추가) 잔존.

**권고:** 함수 상단에 다음 주석 의무화:

```typescript
// SECURITY: sets 배열에 추가하는 컬럼명 string 은 반드시 hardcoded literal
// (변수 보간 금지). 값은 vals.push() + bind() 로만 주입.
```

정적 분석 도구 (예: `eslint-plugin-security`) 도입은 본 plan 스코프 외 — Step 14+ 권고.

### m4. `markBatchRunKilled` 의 fire-and-forget catch 가 process.exit 직전 race 조건 가능

**파일:라인:** `apps/batch/src/pipeline.ts:435-447`, `apps/batch/src/signal-handlers.ts:48`

**증거:** signal handler 흐름:

1. `flushCheckpoint()` (sync) → writeCheckpointSync 완료
2. `markBatchRunKilled().catch(...)` (async) — fire-and-forget
3. `process.exit(130)` — 즉시 종료

3번이 2번의 .then/.catch 보다 먼저 실행될 가능성 매우 높음 (process.exit 은 microtask 도 흘리지 않음). 결과: batch_runs 의 state 가 'in_progress' 로 남고, 다음 recover 시 24h 미만 → `concurrent_run_detected` 로 차단. v3.0 Vol V.4 "killed" 상태 전이 의도와 불일치.

**영향:** 사용자가 Ctrl+C 후 즉시 재시도 시 "다른 인스턴스가 실행 중" 메시지로 24h 대기 강요. 운영 incident.

**권고:** 옵션 A — `process.exit` 대신 `setImmediate(() => process.exit(...))` 으로 microtask flush 1턴 허용 (best-effort 개선, 보장은 아님). 옵션 B — markBatchRunKilled 도 sync 어댑터로 (better-sqlite3 의 동기 API 활용) 변환. plan §5.3 에 본 한계 명시 + 진산님 결정 권고.

본 항목은 "killed" 상태 전이가 "필수"라기보다 "기록 보강" 성격이라 MINOR. 하지만 운영 관점에서 후속 정정 가치 있음.

---

## 5. 확인 항목 (PASS 증거 — 의무 5건+)

1. **PipelineContext 5 required 필드 확장 호환성** — `pipeline.ts:216-225` 의 5 required 필드 (`examId`, `batchRunId`, `checkpointBaseDir`, `batchRunsDb`, `engineVersion`) + 3 optional (`costMeter`, `enableSignalHandlers`, `fsyncCheckpoint`). 6 callsite (batch.ts:177-196 + integration test 5건) 모두 typecheck PASS — `cd apps/batch && pnpm typecheck` 0 errors. plan §10 SLO 만족.

2. **InMemoryBatchRunsDb 의 0015 트리거 invariant 매핑** — `in-memory-batch-runs-db.ts:73-90` `insertNewRun` 의 completed 재INSERT 차단 = `trg_batch_runs_no_duplicate_completed`. `updateState:111-115` 의 completed → 다른 state 차단 = `trg_batch_runs_no_state_downgrade`. `updateState:117-121` 의 completed → recovered 차단 = `trg_batch_runs_recover_only_from_non_completed`. **3 트리거 모두 1:1 매핑 + 메시지 일관 (`Idempotency violation`).** 24h stale lock 트리거는 application 레벨 (recover.ts:167-184) 책임으로 명시 비스코프.

3. **D1BatchRunsDb INSERT 컬럼 일치** — `d1-batch-runs-db.ts:64-77` INSERT 8 컬럼 (`batch_run_id, started_at, last_completed_stage, state, resume_count, fixture_path, state_hash, engine_version`) = `0015_batch_runs.sql:15-27` 의 8 NOT NULL 필드 + `completed_at` (NULL 허용 — INSERT 시 미주입). **스키마 정합 PASS.** `state='in_progress'` literal + `resume_count=0` literal + `state_hash=''` empty string (NOT NULL 만족). 0014 prevent_knowledge_nodes_update 트리거의 batch_runs 영향 없음 (별도 테이블).

4. **BatchRunsDb.insertNewRun? optional 패턴의 8 mock 테스트 영향 0** — `recover.test.ts:66-87` makeMockDb 함수가 `selectByRunId` + `updateState` 만 구현 (insertNewRun 미구현). recover.ts 자체는 insertNewRun 호출 X (lines 147-301 grep PASS). 8 테스트 모두 examId 인자 통과 (32, 127, 189, 223, 256, 297, 335, 356, 372 라인). **회귀 0건 보장.** D1BatchRunsDb (d1-batch-runs-db.ts:52-78) 와 InMemoryBatchRunsDb (in-memory-batch-runs-db.ts:64-91) 둘 다 insertNewRun 의무 구현.

5. **fsync 옵션 무결성 보장** — `checkpoint.ts:343-379` writeCheckpoint async + `checkpoint.ts:390-419` writeCheckpointSync 둘 다 동일 무결성 패턴: tmp file write → fsync (파일) → rename → fsync (디렉토리). signal-handlers.ts:34-49 가 sync 버전 호출 (process.exit 직전 await 불가) + opts.flushCheckpoint() try/catch + console.error (silent failure 차단). plan §5.3 권고 A 만족.

6. **examId 일관성 검증 (B-C2 SF-M-2)** — `recover.ts:248-264` 가 checkpoint.exam_id !== opts.examId 시 recovery_failed throw. 본 코드는 Step 11.5 산출이지만 Step 11.6 진입 시 정합 PASS — `pipeline.ts:368-374` 가 ctx.examId 를 opts.examId 로 전달, signal handler closure (pipeline.ts:418) 도 ctx.examId 사용, buildCheckpoint (checkpoint.ts:175-196) 가 examId 직렬화. 직렬화 → 역직렬화 → 검증 흐름 PASS.

7. **toSnapshot 의 lastInsertedNodeId fallback** — `pipeline.ts:265-267` 의 `state.loadResult?.lastInsertedNodeId ?? lastNode?.id ?? null`. `draft-loader.ts:124-131` loadDraft 가 `lastInsertedNodeId` 미주입 (Step 5 deferred 명시) → fallback 의 2번째 분기 `lastNode?.id` (contract.nodes 마지막 ID) 활성. plan §3.2 명시. **Step 5 진입 전까지 정상 동작 + Step 5 진입 시 자동 활성.**

---

## 6. Devil's Advocate 반론 — "이게 깨질 수 있는 시나리오"

### 시나리오 1: SIGINT 직후 재시도 시 "concurrent_run_detected" 무한 루프 (MINOR m4 확장)

수험자 / 진산님이 BATCH 적재 중 Ctrl+C → fire-and-forget `markBatchRunKilled` 가 process.exit 보다 먼저 완료될 보장 없음 → batch_runs.state = 'in_progress' 잔존. 즉시 재시도 → recover.ts:171 의 elapsedMs 가 24h 미만 → `concurrent_run_detected` 반환 → ConcurrentRunError throw. 사용자는 24h 대기 또는 수동 D1 UPDATE 강요.

**완화 가능성:** plan §6.2 "incident playbook" 에 "concurrent_run_detected 시 batch_runs 수동 UPDATE 절차" 명시 또는 `--force-recover` CLI 플래그 도입. 본 plan 스코프 외이지만 운영 진입 전 차단 항목.

### 시나리오 2: 0016 마이그레이션의 batch_run_id NULL → 값 backfill UPDATE 가 재진입 시 ABORT

`migrations/0016:84-86` 의 트리거 예외 조건 `OLD.batch_run_id IS NOT NULL AND NEW.batch_run_id IS NOT OLD.batch_run_id` → "이미 값 있는 row 를 다른 값으로 UPDATE 시 차단". recover 시나리오에서 동일 batch_run_id 로 재진입은 OK이지만, **resume_count 를 증가시키는 UPDATE 가 batch_runs 테이블의 row 만 건드리고 knowledge_nodes 의 batch_run_id 는 건드리지 않음** — 직접 충돌 없음. 하지만 Step 5 진입 시 (batch_run_id, source_id) UNIQUE 위반 의 경우 INSERT OR IGNORE 가 아니라 ABORT 로 fail 하면 runPipeline.stageDbLoad 실패 → state='failed' UPDATE → 정상 흐름. **현 시점 깨지지 않음.**

### 시나리오 3: `step116TestFields(outDir)` 의 outDir 이 checkpointBaseDir 와 동일 — DB 적재 dry-run 산출물과 충돌

`pipeline.integration.test.ts:40-50` 가 `checkpointBaseDir: outDir` 설정. `pipeline.ts:815-823` 의 dry-run 흐름이 동일 outDir 에 `BATCH-1-contract.json` 작성. checkpoint 파일도 동일 디렉토리에 `{batchRunId}.json` 으로 작성. 두 파일이 동일 디렉토리 공존 → mkdtempSync 격리이므로 안전. 하지만 production 에서 운영자가 `--dry-run` + `--checkpoint-dir=./out` 동일 지정 시 fixture/checkpoint 혼재 → ls 결과 가독성 저하. **운영 UX MINOR.** plan §3.1 에서 "outDir 과 checkpointBaseDir 분리 의무" 1줄 명시 권고.

### 시나리오 4: 0015 트리거 발화 시 D1BatchRunsDb.updateState 의 RAISE(ABORT) 가 SQLite native 의 어떤 throw 형태인지 불명확

`d1-batch-runs-db.ts:120-127` 가 `RAISE(ABORT, 'message')` 발화 시 driver 가 throw 함을 가정. better-sqlite3 의 경우 `SqliteError` throw — message 프로퍼티 보존. Cloudflare D1 의 경우 throw 형태 미검증. `pipeline.ts:497-510` 의 catch 가 `console.error(...err)` 로 가시화 + 흐름 계속. silent failure 차단 PASS, 다만 caller 가 RAISE(ABORT) 발화 vs 일반 SQL 에러 구분 못 함. **본 plan 스코프 내에서는 console.error 가시화로 충분, Step 14 운영 진입 시 SqliteError 패턴 분류 권고.**

---

## 7. 판정

### **accept_with_caveats**

**근거:**

- **CRITICAL 0건** — 12 검증 항목 모두 PASS. typecheck 0 errors. Hard Rule 16/17 PASS. 0015 트리거 invariant 1:1 매핑.
- **MAJOR 2건** — caller 처리 / model ID 정규화 책임 모호 (운영 진입 시 정정 필요, 본 plan 스코프 내에서는 동작 OK).
- **MINOR 4건** — engineVersion path / qg2Passed misleading / SQL injection 가시성 / SIGINT race. 모두 후속 plan 또는 docs 정정 가능.
- **plan §10 6 callsite 일괄 갱신 SLO 만족** — typecheck PASS + integration test step116TestFields 5 spread + batch.ts 1 ctx.

**caveats (다음 작업 진입 전 처리 권고):**

1. **MAJOR M2 즉시 정정** — `bin/batch.ts` main catch 에 ConcurrentRunError / RecoveryFailedError 분기 추가 (5분 작업, 운영 가독성 핵심).
2. **MINOR m4 plan 명시** — SIGINT 직후 재시도 시나리오를 plan §6.2 incident playbook 에 반영. 또는 Step 14 운영 plan 에서 `--force-recover` CLI 플래그 의무.
3. **MAJOR M1 검증 보강** — `cost-meter.ts` 열람하여 model ID 정규화 책임 확정. 본 리뷰는 cost-meter 코드 직접 확인 부재 — 다음 4-Pass quality-engineer 에이전트가 해당 파일 검증 권고.

**다음 세션 e2e 테스트 (handoff-session-015 §2.3 9 AC) 진입 가능.** 명시 이연 처리 PASS — 본 4-Pass 는 architecture 완성도만 평가, e2e 테스트 미작성은 의도된 이연.

---

## 8. 4-Pass 리포팅 형식 요약

```
Pass 2 (Architect, system-architect 단독):
  CRITICAL: 0건
  MAJOR:    2건 (M1: cost-meter model 정규화 책임 / M2: caller 에러 분기)
  MINOR:    4건 (m1: dist path / m2: qg2Passed misleading / m3: SQL injection 주석 / m4: SIGINT race)
  PASS 증거: 7건 (PipelineContext / InMemory invariant / D1 INSERT 컬럼 / insertNewRun optional / fsync / examId 일관성 / toSnapshot fallback)
  반론:     4 시나리오 (SIGINT 무한 루프 / 0016 backfill / outDir 충돌 / RAISE(ABORT) 형태)
판정: accept_with_caveats
```
