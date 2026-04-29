---
리뷰 방식: 독립 에이전트 (quality-engineer)
리뷰 일시: 2026-04-29 09:44 KST
리뷰 대상: Step 11.6 코드 구현 (본 세션 변경 9건 — pipeline/recover/checkpoint/CostMeter 통합)
리뷰자 컨텍스트: 본 세션 메인 대화 모름 (의도 편향 차단)
리뷰 페르소나: quality-engineer (Pass 1 Surgeon + Pass 3 Advocate 중심, edge case + boundary + production 결함 hunt)
검증 환경: pnpm --filter @thepick/batch typecheck PASS / test 137/137 PASS (직접 실행 확인)
---

# Step 11.6 Pipeline Integration — Quality Review

## 1. 검토 범위 (실제로 읽은 파일:라인)

|  #  | 파일                                                                                    | 라인 범위                                                       | 확인 깊이                                              |
| :-: | :-------------------------------------------------------------------------------------- | :-------------------------------------------------------------- | :----------------------------------------------------- |
|  1  | `apps/batch/src/pipeline.ts`                                                            | 1-948 (전체)                                                    | 모든 신규 통합 로직 + stage runner                     |
|  2  | `apps/batch/src/checkpoint.ts`                                                          | 1-540 (전체)                                                    | fsync 옵션 + writeCheckpointSync + canonicalJson       |
|  3  | `apps/batch/src/recover.ts`                                                             | 1-301 (전체)                                                    | BatchRunsDb 인터페이스 + insertNewRun optional         |
|  4  | `apps/batch/src/signal-handlers.ts`                                                     | 1-61 (전체)                                                     | SIGINT/SIGTERM cleanup                                 |
|  5  | `apps/batch/src/d1-batch-runs-db.ts`                                                    | 1-128 (전체)                                                    | D1 어댑터 SQL 발행                                     |
|  6  | `apps/batch/src/in-memory-batch-runs-db.ts`                                             | 1-140 (전체)                                                    | 0015 트리거 invariant 모방                             |
|  7  | `apps/batch/src/loader/draft-loader.ts`                                                 | 1-383                                                           | LoadDraftResult.lastInsertedNodeId? 추가 위치          |
|  8  | `apps/batch/bin/batch.ts`                                                               | 1-417                                                           | 5 신규 필드 + ENGINE_VERSION 동적                      |
|  9  | `apps/batch/src/__tests__/pipeline.integration.test.ts`                                 | 1-393                                                           | step116TestFields 헬퍼 + 5 ctx                         |
| 10  | `migrations/0015_batch_runs.sql`                                                        | 1-94                                                            | 트리거 3종 invariant 비교 기준                         |
| 11  | `migrations/0016_knowledge_nodes_batch_idempotency.sql`                                 | 1-97                                                            | 0014 화이트리스트 갱신 검증                            |
| 12  | `apps/batch/src/cost-meter.ts`                                                          | 30-475                                                          | toCheckpointCostState + recordTokens validation        |
| 13  | `packages/parser/src/batch-processor.ts`                                                | 28-66, 300-410                                                  | TokenUsage shape (camelCase) + processBatch usage 반환 |
| 14  | `apps/batch/__tests__/recover.test.ts`                                                  | mock signature 확인 (selectByRunId/updateState 시그니처 호환성) |
| 15  | `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md` v1.1 §3, §4 | 의도 대조                                                       |

테스트 회귀 검증: `pnpm --filter @thepick/batch test` 직접 실행 → 137/137 PASS, typecheck PASS.

---

## 2. CRITICAL (0건)

검토 범위 내 production 차단 결함은 발견하지 않았다. 본 세션 변경은 plan v1.1 §3.3 흐름에 충실하며, fsync 무결성 / 0015 invariant 모방 / SIGINT cleanup / Hard Rule 16 시그니처 정합 / Q-C1 false positive 정정이 모두 반영되어 있다.

근거 (3건 이상):

- pipeline.ts:269-280 toSnapshot 의 `Object.fromEntries(PIPELINE_STAGES.map(s => [s, {status, durationMs}]))` 는 매 entry 가 새 object literal — Diamond DAG sibling reference 공유 차단 (Q-C1 정정 반영, AC-Snapshot false positive 미발생)
- pipeline.ts:547-556 finally 블록이 try 의 모든 throw 경로 (recover throw / stage throw / completed UPDATE throw) 후에도 removeHandlers + costMeter.finalize() 호출 보장 — finalize 자체 throw 도 inner try/catch 로 격리
- in-memory-batch-runs-db.ts:73-78, 112-121 의 invariant 3종이 0015 트리거 3종 (line 40-49, 54-59, 89-94) 영문 메시지와 정확 일치 — `cannot re-insert completed batch_run_id (Idempotency violation)` / `cannot transition out of completed state (Idempotency violation)` / `cannot recover completed run (Idempotency violation)`

---

## 3. MAJOR (3건)

### M-1. SIGINT/SIGTERM handler 본문 inner closure 의 `lastSnapshot.last_completed_stage` 가 stale 가능 — 첫 stage 진입 전 SIGINT 시점에서 `lastSnapshot===null` early return 정확하나, **첫 stage success 직후 + checkpoint write 진행 중 SIGINT** 시 race 검증 부재

**파일:라인:** `apps/batch/src/pipeline.ts:411-447`
**증거:**

```typescript
let lastSnapshot: PipelineStateSnapshot | null = null;
const removeHandlers = ctx.enableSignalHandlers !== false
  ? installSignalHandlers({
      flushCheckpoint: () => {
        if (lastSnapshot === null) return;  // ← line 416
        const cp = buildCheckpoint({ ..., snapshot: lastSnapshot, ... });
        writeCheckpointSync(cp, ctx.checkpointBaseDir, { fsync: ... });
        markBatchRunKilled(...).catch(...);
      },
    })
  : () => { /* test mode */ };
...
if (result.status === 'success') {
  lastSnapshot = toSnapshot(state, stages, stage);          // ← line 515
  const cp = buildCheckpoint({ ... });                       // ← line 516
  await writeCheckpoint(cp, ctx.checkpointBaseDir, { ... }); // ← line 528
  await ctx.batchRunsDb.updateState(..., {                   // ← line 531
    state: 'in_progress',
    state_hash: cp.state_hash,                                // ← cp.state_hash 인계
  });
}
```

**race 시나리오 (boundary value):**

1. Stage `pdf_extract` success → `lastSnapshot` 채움 (line 515)
2. `await writeCheckpoint(...)` 에 진입 (line 528) — 이 시점에 SIGINT 도착
3. signal handler 가 `lastSnapshot` 비-null 확인 → `writeCheckpointSync` 호출
4. async writeCheckpoint 가 작성 중인 `.tmp` 파일을 sync 가 다시 작성 — 같은 임시 경로
5. POSIX rename 은 atomic 하지만, 두 프로세스가 동시 `tmpPath` 에 write 하면 한쪽 데이터가 깨질 수 있음

**완화 평가:** Node.js 단일 프로세스 single-thread event loop 기준으로 `await writeCheckpoint` 가 진행 중일 때 sync handler 의 writeFileSync 가 동일 fd 충돌 발생 가능성은 낮으나, 임시 파일 경로 (`${filePath}.tmp`) 가 동일하다는 사실은 boundary 위험. 일반적으로는 SIGINT 직후 process.exit 으로 async writeCheckpoint 가 cancel 되므로 실제 문제는 SIGINT race 시 부분 작성된 `.tmp` 파일이 다음 recover 의 `.json` 본 파일 (rename 완료) 을 덮지 않음 — atomic rename 의 의미 그대로. 따라서 **데이터 손상은 차단** 되나, **임시 파일 잔존 (.tmp suffix) 가능성** 은 존재. recover 는 `.json` 만 읽으므로 영향 없음.

**영향:** 데이터 손실 없음, 다만 test 환경 (특히 test mode 가 아닌 production-like) 에서 `.tmp` 파일 잔존이 후속 cleanup 부재 시 디스크 쓰레기 누적. **MAJOR (clean-up)** 로 분류.

**권고:** writeCheckpointSync 에 `.tmp.sigint` 같은 별도 suffix 사용 또는 finally 블록에서 `.tmp` 패턴 cleanup. 명시 이연 (다음 세션 AC-T3) 수용 가능.

---

### M-2. `PipelineResult.recovery_status` 누락 — caller 가 `no_checkpoint` vs `fully_recovered` vs `already_completed` 구분 불가

**파일:라인:** `apps/batch/src/pipeline.ts:79-86, 558-566`
**증거:**

```typescript
export interface PipelineResult {
  readonly batchId: string;
  readonly stages: readonly StageResult[];
  readonly qg2Passed: boolean;
  readonly qg2Result: QG2Result | null;
  readonly contract: KnowledgeContract | null;
  readonly loadResult: LoadDraftResult | null;
  // ← recovery_status / batchRunId / costReport 모두 부재
}
```

`buildSkipResult(ctx, recovery.message)` 가 `already_completed` 시 호출되어 모든 stage='skipped' 로 채움 (line 317-331). caller (batch.ts cmdRun:198-200) 는:

```typescript
const result = await runPipeline(ctx);
printRunReport(result);
return result.qg2Passed ? 0 : 1;
```

**문제:**

1. `already_completed` 케이스: `qg2Passed=false` (line 326) → caller 가 exit code 1 반환 (실패로 오해). 그러나 의미는 "이전 실행에서 이미 통과됨" — exit code 0 이 정합.
2. `printRunReport` 가 `Stage 1~9 모두 ⏭️ skipped` 출력 + `QG-2: ❌ FAILED` — 사용자에게 misleading 메시지.
3. `no_checkpoint` (정상 신규 실행) vs `fully_recovered` (resume) 의 caller 측 구분 불가 — operations 대시보드 / on-call alert 에서 신규/복구 통계 분리 불가.

**영향:**

- **수험생 운영 영향:** `already_completed` 의 동일 batch_run_id 재실행 시 false negative exit code 1 → CI/cron 이 실패 알림 발화. 사용자 (진산님) 새벽 3시 on-call 시 잘못된 실패 알림.
- **메트릭 손실:** Phase 2 운영 시 recover 빈도 / kill switch 빈도 추적 불가 → 비용 제어 효과 측정 불가.

**권고:** `PipelineResult` 에 `recovery_status: RecoveryStatus | 'normal_run'` 추가 + `batch.ts` 의 exit code 분기 갱신 (`already_completed` → 0).

---

### M-3. `stageBatchStructurize` 의 `result.usage` null skip 시 silent 검증 누락 — production 시 토큰 미계측 위험

**파일:라인:** `apps/batch/src/pipeline.ts:750-767`
**증거:**

```typescript
if (ctx.costMeter) {
  if (result.usage) {
    const status = ctx.costMeter.recordTokens(...);
    if (status === 'hard_throttle') {
      await ctx.costMeter.applyThrottle();
    }
  } else {
    console.warn(
      '[Pipeline] processBatch returned null usage — CostMeter skip for this call',
    );
  }
}
```

batch-processor.ts:354-358 에서 usage 는 `response.usage?.input_tokens ?? 0` fallback. 즉 Anthropic API 응답에 usage 누락 시 `usage.inputTokens=0, usage.outputTokens=0` 로 채워짐 — `result.usage` 가 truthy → CostMeter.recordTokens(0, 0) 호출 → CostMeter.recordTokens (cost-meter.ts:248-258) 의 validation `inputTokens < 0 || outputTokens < 0` 통과 (0 은 허용) → **0 비용으로 누적 + log**.

**그러나** batch-processor 가 catch 블록 진입 (network error 등) 시 usage 가 null 인 채로 retry 0회 + result.error='...' 로 반환. pipeline.ts:741 에서 `result.error` 가 있으면 이미 throw 후 catch 로 stageBatchStructurize 자체가 'failed' 반환 — costMeter.recordTokens 도달 X. **OK 분기.**

**남은 boundary case:** `processBatch` 내부의 try 블록이 정상 종료했지만 contract 만 null 인 경우 (실제 코드 흐름상 불가능, but defensive). `result.usage` 가 null 이지만 `result.contract` 도 null 이면 line 744 에서 throw — 통과. `usage=null && contract!==null` 조합이 가능한가? batch-processor 흐름상 try 블록 line 354 에서 usage 항상 채움 → catch 진입 안 한 한 usage 는 항상 truthy. 따라서 `else { console.warn(...) }` 분기는 **사실상 도달 불가**.

**영향:**

- **silent failure 차단 OK:** else 분기가 console.warn 출력하므로 silent 아님.
- **dead code 의심:** else 분기 도달 가능성 검증 부재. 만약 batch-processor 흐름이 변경되어 usage null + contract truthy 케이스 발생 시 1회당 비용 미계측 → daily budget breach 못 잡음.
- **CRITICAL RULE #3 (try-catch 조용히 데이터 삭제) 경계선:** console.warn 만으로 끝나고 status 반환/throw 없음. CostMeter 가 budget breach 미인지 → kill_switch 미발화.

**권고:** `result.usage===null` 시 stage 전체 'failed' 로 강등 (defensive). 또는 plan v1.1 §13 follow-up 으로 명시 이연 후 batch-processor 가 usage null 반환 가능성 자체를 차단 (인터페이스 강화 — non-nullable usage).

---

## 4. MINOR (5건)

### m-1. `markBatchRunKilled` best-effort 의미 모호

**파일:라인:** `apps/batch/src/pipeline.ts:336-343, 435-442`
SIGINT handler 안에서 `markBatchRunKilled(...).catch(err => console.error(...))` — fire-and-forget. 그러나 process.exit(130) 이 line 48 (signal-handlers.ts) 에서 즉시 실행되므로 **catch 도달 전에 process 종료 가능**. 즉 mark 실패 시 console.error 출력 자체가 손실될 수 있음. plan §3.3 `// best-effort` 주석과 정합하나, "best-effort" 의 의미를 docstring 에 명시 권고.

### m-2. `enableSignalHandlers !== false` 의 false-only 거짓 비교

**파일:라인:** `apps/batch/src/pipeline.ts:412-413`
`ctx.enableSignalHandlers !== false` — `undefined` 일 때 true (설치). 의도 (기본 true) 일치하나, undefined 와 `false` 만 의미있는 boolean field 의 시그널이 가독성 낮음. `ctx.enableSignalHandlers ?? true` 가 의도 명확. minor preference.

### m-3. `buildSkipResult` 의 `qg2Passed=false` 가 caller 에 misleading

**파일:라인:** `apps/batch/src/pipeline.ts:317-331`
already_completed 시 `qg2Passed=false` 반환 — 이전 실행이 이미 통과된 상태라면 실제로는 true 가 맞다. 그러나 contract / loadResult 가 null 이라 qg2Result 재생성 불가. `qg2Passed: null` (boolean | null) 로 변경 가능하나 인터페이스 변경 비용. M-2 의 `recovery_status` 와 함께 처리 권고.

### m-4. test fixture 의 `enableSignalHandlers: false` 가 cross-test pollution 차단 검증 부족

**파일:라인:** `apps/batch/src/__tests__/pipeline.integration.test.ts:40-50`
`step116TestFields(outDir)` 가 매 테스트마다 호출 → `new InMemoryBatchRunsDb()` 새 인스턴스. 그러나 `enableSignalHandlers: false` 는 test mode 에서 handler 등록 안 함 — vitest worker 의 process 에 stale handler 누적 차단 의도 정합. 단 production 통합 테스트가 추가될 때 `enableSignalHandlers: true` + 동일 process 다중 실행 시 누적 검증 부재. AC-T3 명시 이연 시 e2e 검증 의무.

### m-5. `LoadDraftResult.lastInsertedNodeId?` 의 fallback 정확도 의심

**파일:라인:** `apps/batch/src/loader/draft-loader.ts:40-46`, `apps/batch/src/pipeline.ts:265-267`
draft-loader.ts 의 LoadDraftResult interface 에 `lastInsertedNodeId?` optional 추가만 있고 `loadDraft` 함수 본체 (line 86-132) 가 본 필드를 채우지 않는다. 즉 Step 5 코드 진입 전까지는 항상 undefined.

pipeline.ts:265-267 폴백:

```typescript
const lastNode = state.contract?.nodes[state.contract.nodes.length - 1];
const last_inserted_node_id = state.loadResult?.lastInsertedNodeId ?? lastNode?.id ?? null;
```

**문제:** Step 5 진입 전엔 `state.contract.nodes 마지막` 을 사용. 그러나 이는 contract 의 노드 순서 (Claude API 응답 순서) 이지, 실제 DB INSERT 순서가 아님. INSERT OR IGNORE 로 일부 skip 된 경우 (idempotency, draft-loader.ts:248-260) 마지막 노드는 INSERT 되지 않았을 수 있음 — last_inserted_node_id 가 실제로는 skip 된 노드 ID 가 됨.

**영향:** Step 5 진입 전 단계에서 checkpoint 의 last_inserted_node_id 가 부정확 → Step 5 reproducibility e2e (AC-RP-7 100회 결정성) 진입 전까지는 본 값으로 resume 검증 불가. 다행히 Step 11.6 의 resume 정책은 `last_completed_stage` 기반 (last_inserted_node_id 미사용) 이라 즉시 결함 아님. 다만 **Step 5 통합 후 폴백이 fall-through 되지 않도록 loadDraft 가 lastInsertedNodeId 필수 채움** 강제 필요. plan §3.2 의 "Step 5 deterministic 적재 흐름에서 채워진다" 약속이 미구현 상태.

**권고:** Step 5 코드 진입 시 `LoadDraftResult.lastInsertedNodeId` 를 required 로 승격 (optional → required), 본 세션의 optional 추가는 명시적 phase 가교 마커로만 수용.

---

## 5. ✅ 확인 항목 (PASS)

### ✅ 0015 트리거 invariant 모방 — 3종 모두 정확

**확인:**

- 0015 SQL `trg_batch_runs_no_duplicate_completed` (line 40-49) — 메시지 "batch_runs: cannot re-insert completed batch_run_id (Idempotency violation)" → in-memory-batch-runs-db.ts:75-77 동일 메시지
- 0015 SQL `trg_batch_runs_no_state_downgrade` (line 54-59) — 메시지 "batch_runs: cannot transition out of completed state (Idempotency violation)" → in-memory-batch-runs-db.ts:112-115 동일 메시지
- 0015 SQL `trg_batch_runs_recover_only_from_non_completed` (line 89-94) — 메시지 "batch_runs: cannot recover completed run (Idempotency violation)" → in-memory-batch-runs-db.ts:117-120 동일 메시지

**증거:** 영문 메시지 비교 grep `cannot re-insert completed`, `cannot transition out of completed`, `cannot recover completed run` 모두 0015 SQL ↔ in-memory 양쪽 일치. e2e test (AC-T3) 가 명시 이연 (다음 세션) 이지만 invariant 모방 자체는 이번 세션에서 정확.

### ✅ Q-C1 false positive 차단 — Object.fromEntries map 매 entry 독립 object literal

**확인:** pipeline.ts:269-280 toSnapshot 의 `PIPELINE_STAGES.map((s) => [s, { status: ..., durationMs: ... }])` 매 iteration 새 object literal 생성 → Diamond DAG sibling reference 미발생.

**반증 시도:** 만약 동일 object 인스턴스 공유 (`const empty = {status:'pending',durationMs:0}; ...PIPELINE_STAGES.map(s => [s, empty])`) 형태였다면 canonicalJson walk 시 visited WeakSet (checkpoint.ts:276-283) 에서 circular detection 발화. 본 코드는 매번 새 literal — 독립 object 인스턴스 → walk 통과 OK.

### ✅ writeCheckpointSync fsync=true 강제 (production)

**확인:**

- pipeline.ts:431-433 SIGINT handler 의 writeCheckpointSync 호출이 `{ fsync: ctx.fsyncCheckpoint ?? true }` — production (fsyncCheckpoint 미지정) 시 true 강제
- pipeline.ts:528-530 정상 stage 종료 시 writeCheckpoint 호출도 동일 default true
- checkpoint.ts:390-419 writeCheckpointSync 본체 — `fsyncSync(fd)` + dir fsync 양쪽 모두 fsync 옵션 시 적용

테스트 fixture (pipeline.integration.test.ts:48 `fsyncCheckpoint: false`) 에서만 false. production 흐름 (batch.ts:177-196 ctx 생성) 에서는 명시 false 미지정 → default true. **OK.**

### ✅ recoverBatch + insertNewRun 시그니처 호환성

**확인:**

- recover.ts:94-101 `insertNewRun?` optional — 기존 recover.test.ts (line 72 `selectByRunId`) mock 에 insertNewRun 미구현이어도 type error 발생 X
- 실행 시 pipeline.ts:396-401 가 `if (!ctx.batchRunsDb.insertNewRun) throw new Error(...)` 명시 가드 — silent failure 차단 (CRITICAL RULE #3 정합)
- D1BatchRunsDb (line 52-78) + InMemoryBatchRunsDb (line 64-91) 양쪽 모두 insertNewRun 구현
- 137/137 tests PASS — 기존 mock 영향 0건

### ✅ resumeFromStageIndex boundary value 정합

**확인:**

- pipeline.ts:387-392 `recovery.resumed_from_stage !== null ? PIPELINE_STAGES.indexOf(...) + 1 : 0`
- last stage `qg2_gate` (index=9) success 후 SIGINT → recover 시 resumed_from_stage=qg2_gate → resumeIdx=10 → loop 진입 0회 → if(!aborted) 진입 → state='completed' UPDATE
- middle stage 예: `db_load` (index=5) success 후 → recover 시 resumeIdx=6 → integrity_check (index=6) 부터 재개

**plan §3.3 의사코드 line 325 vs 구현 line 391:**

- plan 의사코드: `PIPELINE_STAGES.indexOf(recovery.resumed_from_stage!)` — `+1` **누락**
- 구현: `PIPELINE_STAGES.indexOf(...) + 1` — **정정 반영**
- plan §4.2 표 fully_recovered: "resumed_from_stage **다음** stage 부터 재개" — 의도는 +1 (구현 일치)
- plan 의사코드의 `+1` 누락은 plan 본문 결함, 구현이 §4.2 의도를 따른 것 — **OK**

### ✅ finally 블록 cleanup 보장

**확인:**

- pipeline.ts:466-556 try/finally 구조
- finally line 547-555: `removeHandlers()` (sync, no-throw 보장 — handler 제거만) + costMeter.finalize() inner try/catch
- finalize throw 시 console.error 후 finally 종료 — outer throw 전파 차단
- 따라서 try 블록의 모든 throw 경로 (recover throw / stage runStage throw / batch_runs UPDATE throw) 후에도 cleanup 100% 보장

### ✅ ConcurrentRunError / RecoveryFailedError 의 caller 처리

**확인:** batch.ts:81-86 main() 의 outer try/catch:

```typescript
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[thepick-batch] ERROR: ${msg}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
  return 1;
}
```

ConcurrentRunError / RecoveryFailedError 모두 Error 상속 → catch 통과 → exit code 1 + stack trace 출력. 단, error class 별 분기 없음 — 사용자가 stack trace 로 구분해야 함. M-2 권고 (recovery_status PipelineResult 추가) 후 별도 exit code 분기 권장.

### ✅ assertCanonicalSafe + circular reference 차단

**확인:** checkpoint.ts:229-294 walk-then-stringify 패턴 — Date/Map/Set/BigInt/Function/Symbol/Promise/TypedArray/WeakMap/WeakSet 9종 + circular 모두 사전 거부. AC-Snapshot' 13 케이스 e2e 테스트는 명시 이연이지만 코드 자체는 모든 케이스 throw path 갖춤.

---

## 6. Devil's Advocate 반론 (깨질 수 있는 시나리오)

### 시나리오 1 — recoverBatch 가 `state='recovered'` UPDATE 후 첫 stage 진입 전 SIGTERM

**상황:**

- recover.ts:283-286 가 `selectByRunId(...)` 후 `updateState({state: 'recovered', resume_count_increment: 1})` 호출
- pipeline.ts:412 SIGINT handler 등록 (recovery 분기 처리 직후)
- 첫 stage 진입 직전 SIGTERM 도착

**분석:**

- handler 등록은 line 412 — recoverBatch 종료 후. 그 사이 (recoverBatch return 후 + handler 등록 전) SIGTERM 도착 시 handler 미등록 → Node.js default behavior (SIGTERM=프로세스 즉시 종료) → batch_runs 가 'recovered' state 채로 남음
- 다음 recover 시 row.state='recovered' → recoverBatch:154 `row.state === 'completed'` FALSE → row.state='in_progress' FALSE → checkpoint 읽기 → fully_recovered 반환 → state='recovered' UPDATE 재시도

**위험도:** 낮음. 'recovered' state 자체가 0015 트리거 통과 (downgrade 차단은 'completed' 만, recover_only_from_non_completed 도 'completed' 만). 즉 'recovered' → 'recovered' 재 UPDATE 가능. 데이터 정합성 유지.

### 시나리오 2 — Race between async writeCheckpoint 와 SIGINT handler 의 sync writeCheckpointSync

**상황:** stage success → toSnapshot → buildCheckpoint → `await writeCheckpoint(...)` 도중 (파일 작성 중) SIGINT 도착
**분석:**

- async writeCheckpoint 가 `fh.writeFile(content)` await 중 SIGINT → handler 가 `writeCheckpointSync` 호출
- 두 함수 모두 동일 `tmpPath` (`${filePath}.tmp`) 에 write
- writeFileSync 가 새로 openSync(tmpPath, 'w') → 기존 파일 truncate → write → fsync → close
- 그 후 renameSync(tmpPath, filePath)
- async writeCheckpoint 의 fh.close() / rename() 은 process.exit 으로 미실행 종료

**결과:** `${filePath}.json` 본 파일은 sync 의 rename 으로 sync content (정상). `.tmp` 파일은 sync 의 rename 으로 사라짐. async 작업의 partial content 는 lost. recover 시 `.json` 만 읽으므로 영향 없음.

**보강:** 그러나 만약 sync handler 실행 직전에 async 의 rename 이 이미 완료 (`.json` 에 새 데이터 + state_hash 포함) 됐고, sync 가 다시 sync 데이터 (toSnapshot 시점이 다를 수 있음) 로 덮어쓴다면? 두 snapshot 모두 `last_completed_stage` 동일 (최신 stage success 기준 lastSnapshot 변수) — 따라서 `state_hash` 도 동일. 의미 손실 0. **OK.**

### 시나리오 3 — InMemoryBatchRunsDb 가 stale lock 24h 시뮬레이션 부재

**상황:** 통합 테스트가 24h+ stale 'in_progress' row 를 시뮬레이션할 때 InMemoryBatchRunsDb 가 동작?
**분석:**

- recover.ts:166-184 가 `Date.now() - new Date(row.started_at).getTime()` 으로 elapsedMs 계산 → 24h+ 면 concurrent_run_detected 미반환, fully_recovered 진행
- InMemoryBatchRunsDb.insertNewRun 이 `started_at: new Date().toISOString()` (line 81) — 현재 시각 — 즉 실제 24h 대기 또는 mock clock 주입 필요
- 그러나 본 세션 변경에서 InMemoryBatchRunsDb 에 clock 주입 옵션 부재

**위험도:** AC-T3 (state transition matrix 5x7) e2e 테스트가 명시 이연이라 본 세션 직접 결함 아님. 그러나 **다음 세션에서 InMemoryBatchRunsDb 에 clock injection 추가 필요** — 미주입 시 stale lock 시뮬레이션 자체가 24h 실 sleep 필요 (실용성 0).

**권고 (다음 세션):** InMemoryBatchRunsDb 생성자에 `options?: { clock?: () => Date; insertedAt?: string }` 주입.

### 시나리오 4 — `result.usage.inputTokens=0, outputTokens=0` 으로 CostMeter 호출 시 silent zero accumulation

**상황:** Anthropic API 응답에 usage 필드 누락 (예: 일부 stub / mock) → batch-processor 가 0/0 fallback → pipeline 이 truthy 로 인식 → CostMeter.recordTokens(0, 0) 호출
**분석:**

- CostMeter:248-258 validation 0 허용 (`< 0` 만 거부) → 통과
- calculateTokenCost(model, 0, 0) → costUsd=0 → totalCostMicroUsd 변동 없음 + callCount 증가
- TokenLogger 에 record 발화 → 0/0 로그
- evaluateAndEnforce → ratio 변동 없음 → status 'ok' (또는 기존 status 유지)

**의미:** 비용은 정확 (0). 그러나 callCount 가 실제 의미 있는 호출이 아닌 0 토큰 호출까지 카운트 → 평균 토큰/호출 메트릭 왜곡.

**위험도:** 낮음. silent zero accumulation 은 metric 왜곡일 뿐 budget breach 영향 없음. 단 production logger / metrics 화면에서 "0 tokens, 0 cost" 비정상 호출 빈발 시 alert.

### 시나리오 5 — Stage 'failed' 후 batch_runs UPDATE state='failed' 가 0015 트리거에 막힐 가능성

**상황:** `result.status==='failed'` 후 pipeline.ts:500-510 `await ctx.batchRunsDb.updateState({state:'failed', last_completed_stage:stage})` 호출
**분석:**

- 0015 트리거 `trg_batch_runs_no_state_downgrade` 는 `OLD.state='completed' AND NEW.state != 'completed'` 만 차단
- 'in_progress' → 'failed' / 'recovered' → 'failed' 모두 OLD.state != 'completed' → 통과
- 단 만약 어떤 이상한 상태 (예: stage success 후 state='completed' UPDATE 가 race 로 먼저 실행되고 다음 stage 가 failed) → 0015 트리거 ABORT → catch 블록 (line 504-510) console.error 후 흐름 계속

**위험도:** 낮음. catch 블록이 가시화 (silent failure 차단) + 흐름 계속 → aborted=true 유지 → 다음 stage skip. 단 batch_runs 의 state 가 'completed' 인 채로 stages 가 failed 로 보고되면 모니터링 불일치. 그러나 정상 흐름에서 발생 불가능 (race window 매우 작음).

---

## 7. 판정

### **accept_with_caveats**

**근거:**

- CRITICAL 0건. CRITICAL RULE #1~#7 모두 정합:
  - #2 stub 금지: insertNewRun 미구현 시 명시 throw (pipeline.ts:396-401)
  - #3 silent failure 차단: console.warn / console.error 가시화 모두 적용
  - #5 불가능 보고: ConcurrentRunError / RecoveryFailedError 명시 throw
- typecheck PASS, 137/137 tests PASS, 회귀 0건
- plan v1.1 §3, §4 흐름 충실 반영 (의사코드 +1 누락은 §4.2 의도 따라 정정)
- Q-C1 false positive 정정 + Hard Rule 16 시그니처 정합 + 0015 invariant 모방 정확

**caveats (다음 세션 처리 의무):**

1. **M-2 (recovery_status 누락)** — `already_completed` 시 caller 가 exit code 0 vs 1 잘못 판정. M-1 SIGINT race tmp 파일 cleanup. 두 항목은 **명시 이연 9 AC 외 추가 보강** 필요.
2. **M-3 (result.usage null skip dead code)** — batch-processor 가 catch 진입 외 경로에서 usage=null 반환 가능성 검증. follow-up 명시.
3. **m-5 (LoadDraftResult.lastInsertedNodeId fallback 정확도)** — Step 5 진입 전엔 contract.nodes 마지막 폴백이 INSERT OR IGNORE 로 skip 된 노드 ID 가능성. Step 5 통합 시 required 승격 의무.
4. **명시 이연 9 AC** — 본 리뷰 범위 외 (다음 세션 Day 3 진행). 단 M-1 race / M-2 / M-3 / m-5 는 명시 이연이 아닌 본 세션 코드의 quality 결함 → 다음 세션 진입 전 또는 Day 3 e2e 작성 시 동시 정정.

**다음 세션 차단 게이트:**

- AC-T3 e2e 작성 시 InMemoryBatchRunsDb clock injection (시나리오 3) 필수
- AC-Cost 작성 시 CostMeter recordTokens(0, 0) 케이스 (시나리오 4) golden 추가
- M-2 recovery_status 추가는 PipelineResult 인터페이스 변경 — caller 6개 (batch.ts + 5 integration tests) 일괄 갱신 필요

---

## 부록 A — 검증 명령

```bash
# 본 리뷰 직접 실행 검증
pnpm --filter @thepick/batch typecheck   # PASS
pnpm --filter @thepick/batch test         # 137/137 PASS

# 회귀 차단 확인
grep -n "cannot re-insert completed\|cannot transition out\|cannot recover completed" \
  apps/batch/src/in-memory-batch-runs-db.ts \
  migrations/0015_batch_runs.sql           # 양쪽 정확 일치
```

## 부록 B — 본 리뷰가 다루지 않은 범위

- **명시 이연 9 AC** (handoff-session-015 §2.3): AC-Cost / AC-Snapshot' / AC-T3 / AC-R1~R6 / AC-ExamId / AC-RP-6 / AC-RP-7 / AC-Snapshot-ExamId — 다음 세션 Day 3
- **5-페르소나 리뷰** (refactoring / performance / backend / devops): 본 리뷰는 quality 단독 페르소나
- **AC-T3 race window 시뮬레이션** (concurrent_run_detected detection)
- **production D1 PreviewSession** 통합 (D1BatchRunsDb 가 실제 D1 와 호환되는지)

본 리뷰는 **본 세션 9건 변경의 quality 결함 hunt** 에 한정.
