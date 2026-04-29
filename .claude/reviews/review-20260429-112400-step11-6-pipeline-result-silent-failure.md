---
리뷰 방식: 독립 에이전트 (silent-failure-hunter)
리뷰 일시: 2026-04-29 KST
리뷰 대상: Step 11.6 B1 PipelineResult 확장 — recoveryStatus + metaPersistenceFailures (Session 017)
리뷰자 컨텍스트: 메인 대화 모름 (의도 편향 차단)
선행 보고서: review-20260429-094423-step11-6-pipeline-integration-silent-failure.md / review-20260429-104757-step11-6-cap2-silent-failure.md
---

# Step 11.6 B1 PipelineResult 확장 — Silent Failure 단독 리뷰

## 리뷰 범위 (전체 범위 원칙 준수)

**변경 3 파일:**

- `/home/soo/ClaudePro/ThePick/apps/batch/src/pipeline.ts` (310 라인 diff 핵심)
- `/home/soo/ClaudePro/ThePick/apps/batch/bin/batch.ts` (cmdRun + printRunReport)
- `/home/soo/ClaudePro/ThePick/apps/batch/src/__tests__/pipeline.integration.test.ts` (5 callsite expect)

**연관 파일:**

- `/home/soo/ClaudePro/ThePick/apps/batch/src/signal-handlers.ts` (closure 호출자)
- `/home/soo/ClaudePro/ThePick/apps/batch/src/recover.ts` (RecoveryStatus, BatchRunsDb 타입)
- `/home/soo/ClaudePro/ThePick/apps/batch/src/in-memory-batch-runs-db.ts` (테스트 더블 — 0015 트리거 시뮬레이션)

**리뷰 의무:** silent-failure-hunter 단일 관점 — 데이터 조용히 삭제 / 빈 catch / fallback 마스킹 / 무음 silent drop 도입 여부.

**중복 보고 차단:** 직전 4-Pass 의 SF-CRITICAL-2 (signal handler async 패턴) 는 옵션 C 채택으로 명시 이연 — 본 리뷰는 B1 변경의 silent failure 영향에만 집중.

---

## Pass 1 — Surgeon (Silent Failure 단독, Bottom-Up)

### ✅ 확인 항목 (8건)

1. **`pipeline.ts:539-544` — SF-C-3 정정 검증:** `state='failed'` UPDATE catch 블록이 (a) Error|string 양쪽을 reason 으로 정규화 (b) `console.error` 로 stderr 가시화 (c) `metaPersistenceFailures.push` 로 PipelineResult 에 누적 (d) `continue` 로 흐름 유지. 빈 catch 0건, silent drop 0건. CRITICAL RULE #3 준수.
2. **`pipeline.ts:563-575` — SF-M-4 `state='in_progress'` UPDATE wrap 검증:** 동일 패턴 (reason 정규화 + console.error + push). checkpoint 가 이미 쓴 후이므로 메타 일관성만 깨질 뿐 데이터 무결성 영향 없음을 주석에 명시 (line 571).
3. **`pipeline.ts:580-596` — SF-M-4 `state='completed'` UPDATE wrap 검증:** 정상 완료 경로의 마지막 UPDATE 도 동일 패턴. PipelineResult 반환은 `finally` 다음 line 612-621 이라 catch 후 `metaPersistenceFailures` 가 정상 전파.
4. **`pipeline.ts:469-477` — SF-C-2 옵션 C SIGINT closure push 검증:** `markBatchRunKilled().catch` 가 (a) reason 정규화 (b) console.error stderr 가시화 (c) outer scope `metaPersistenceFailures` 에 closure capture 로 push. process.exit 직전 도달이라 PipelineResult 미반환이지만 stderr 로그가 운영 alarm 트리거 (line 467-468 주석 명시).
5. **`pipeline.ts:90-94` — `MetaPersistenceFailure` 타입 완전성:** `stage` literal union 이 4가지 push 시점 모두 커버 (`PipelineStage` 10종 + `'completed_transition'` + `'sigint_kill'`). `operation` literal 이 4가지 모두 매핑 (`state_failed` / `state_in_progress` / `state_completed` / `state_killed`). reason 은 string — Error 외 객체도 `String(err)` 폴백.
6. **`pipeline.ts:96-114` — `PipelineResult` 인터페이스 readonly 보강:** `recoveryStatus: RecoveryStatus` + `metaPersistenceFailures: readonly MetaPersistenceFailure[]` 추가. JSDoc (line 103-112) 이 caller 의 alarm 의무 (24h stale lock 차단) 를 명시 — 운영 가시화 계약이 타입 레벨에서 강제된다.
7. **`batch.ts:219-226` — caller alarm 가시화:** `result.metaPersistenceFailures.length > 0` 시 stderr 에 ⚠️ + 각 항목 + force-unlock 검토 안내. silent failure 후 caller 가 무시할 가능성 차단.
8. **`pipeline.ts:597-609` — finally 블록 자체 silent failure 차단:** `removeHandlers()` 와 `costMeter.finalize()` 도 try/catch wrap 후 `console.error` (line 601, 607). finally 자체가 throw 해서 PipelineResult 차단 가능성 — wrap 으로 차단 (BUT line 597-602 의 try/catch 는 push 누적 X — 아래 Devil's Advocate 1 참조).

### Devil's Advocate (3건 — 의무 1건 초과 달성)

**DA-1 (Critical 후보, 결국 Major 등급으로 등급화):** `pipeline.ts:597-602` finally 의 `removeHandlers` catch 는 console.error 만 하고 `metaPersistenceFailures` 에 push 안 함.

`removeHandlers()` 가 throw 하는 시나리오 — Node.js 의 `process.off()` 는 보통 throw 안 하지만 (a) 현재 process listener 배열이 외부에 의해 mutate 된 경우 (b) signal-handlers.ts 가 미래에 cleanup 로직을 추가하고 그 cleanup 이 throw 하는 경우 — stderr 로 가시화되지만 PipelineResult 에는 흔적 없음. caller (batch.ts) 의 metaPersistenceFailures 검사 (line 219) 가 0 으로 평가되어 alarm 건너뜀.

비슷하게 `costMeter.finalize()` catch (line 606-608) 도 PipelineResult 미반영. CostMeter finalize 실패 = 비용 통계 손실 = 운영 부정확. silent partial failure.

**판정:** Major (Critical 아님 — 두 함수 모두 낮은 throw 확률 + stderr 로그 1차 방어선 유지).

**DA-2 (Major):** `pipeline.ts:469-477` SIGINT handler closure 의 race condition.

`markBatchRunKilled().catch(...)` 는 마이크로태스크로 실행. 그러나 signal handler 본체 (`signal-handlers.ts:36-44`) 는 try/catch + `process.exit()` 를 sync 로 수행한다. `process.exit()` 가 호출되는 시점에 catch 콜백이 아직 enqueue 만 된 상태일 가능성 — Node.js v20+ 의 process.exit 는 pending microtask 를 flush 하지 않는다. 결과:

- `markBatchRunKilled` 가 throw 했지만 `.catch` 콜백 자체가 실행 안 됨 → `console.error` 출력 0건, `metaPersistenceFailures.push` 도 미수행
- caller 는 PipelineResult 미수신 (process 사망) — 영향 없음
- 그러나 stderr 로그 자체도 안 나오므로 운영자가 "killed 전이 시도가 있었는지" 자체를 모름 → 24h stale lock 알림은 **다른 경로 (D1 row 의 state='in_progress' 24h)** 로만 트리거. 본 push 는 사실상 cosmetic.

**판정:** Major. 옵션 C 의 가시화 효과가 SIGINT 경로에 한해서는 closure capture 가 의미 없음 (process 사망으로 PipelineResult 자체가 caller 에 전달 안 됨). 현 주석 (line 467-468) 이 "stderr 로 운영 alarm 트리거" 라고 적었으나 race 시 stderr 도 안 나올 수 있다는 사실은 누락. **이 race 자체는 SF-CRITICAL-2 이연으로 알려진 사안이지만, 옵션 C 의 가시화 주장이 SIGINT 경로에서 깨질 수 있다는 점은 명시 의무.**

**DA-3 (Minor → Issue로 격상):** `pipeline.ts:543, 574, 590` 의 `metaPersistenceFailures.push` 가 동일 stage 에서 여러 번 발생 가능.

시나리오: stage A 가 success → `state='in_progress'` UPDATE 실패 → push 1건. 다음 stage B 가 success → 다시 `state='in_progress'` UPDATE 실패 → push 2건. 양쪽 모두 동일 reason 인 경우 (예: D1 connection lost) caller 입장에서 stage 별 진행 상태와 무관하게 같은 메타 실패가 N번 누적. caller (batch.ts:222) 가 모두 stderr 출력 — 운영자가 "왜 stage 마다 실패가 따로 보고되지" 혼란.

**판정:** Minor — 누적 자체는 정확한 사실 (각 UPDATE 시도마다 1건). 그러나 운영 가시성에 대해서는 deduplicate 가 더 친절. **데이터 손실은 없음** (silent-failure-hunter 관점 PASS).

### 분류

- 🔴 Critical: **0건**
- 🟠 Major: **2건** (DA-1: removeHandlers/costMeter finalize 실패가 PipelineResult 미반영, DA-2: SIGINT closure push race 시 stderr 도 silent)
- 🟡 Minor: **1건** (DA-3: stage 별 메타 실패 누적 시 deduplicate 미수행)

---

## Pass 2 — Architect (연계 검증, 신규 silent failure 도입 여부)

### ✅ 확인 항목 (6건)

1. **`recover.ts:99-105` `RecoveryStatus` import 정합:** `pipeline.ts:55` 가 type-only import (`type RecoveryStatus`). 6가지 status 모두 `recoveryStatus` 필드에 직렬화 가능 (string literal). `'concurrent_run_detected'` / `'recovery_failed'` 는 throw 후 도달 X — buildSkipResult 에서는 `'already_completed'` 만 push. JSDoc (line 105-107) 명시.
2. **`in-memory-batch-runs-db.ts:104-112` 트리거 시뮬레이션 vs 0015 실제 트리거 일관성:** `state='completed'` 에서 다른 state 전이 차단 (line 105-108) + `completed → recovered` 차단 (line 110-112). 본 InMemory 어댑터가 throw 시 — `pipeline.ts:534, 563, 581` 의 try/catch 가 모두 잡고 push. **silent drop 신규 도입 0건.**
3. **`batch.ts:43-44` D1BatchRunsDb / InMemoryBatchRunsDb dual 경로:** dryRun/fixtures 경로는 InMemory, production 은 D1 — 본 B1 변경은 어댑터 인터페이스에 영향 없음 (BatchRunsDb 타입 그대로). 기존 8개 recover.test.ts mock 영향 0건 (line 88-90 JSDoc 보장).
4. **`buildSkipResult` (pipeline.ts:350-366) — already_completed Idempotency skip:** `metaPersistenceFailures: []` 빈 배열로 명시 초기화. `recoveryStatus: 'already_completed'` 고정. caller 가 false negative 처리 가능 (batch.ts:229 — exit 0).
5. **`PipelineResult.recoveryStatus` ↔ `batch.ts:229` exit code 매핑:** `'already_completed'` → exit 0 (Q-M-2 정정). 다른 status 는 `qg2Passed` 로 분기. silent false negative 차단.
6. **타입 시스템 일관성:** `pipeline.ts:96-114` 의 `readonly metaPersistenceFailures: readonly MetaPersistenceFailure[]` — 외부에서 mutate 불가. `metaPersistenceFailures.push` 는 runPipeline 내부 mutable `MetaPersistenceFailure[]` 변수 (line 445). return 시 readonly 캐스트 — 타입 안전.

### Devil's Advocate (2건 — 의무 1건 초과 달성)

**DA-4 (Critical 후보, Major 등급화):** `pipeline.ts:469-477` 의 closure 가 outer `metaPersistenceFailures` 를 capture 한다. SIGINT 가 stage 진행 도중 발생 시:

- main loop (line 502-577) 도중 SIGINT 발생
- handler (`signal-handlers.ts:36`) 동기적으로 실행 → flushCheckpoint 호출 → `markBatchRunKilled().catch` enqueue
- `process.exit(130)` 호출 → main loop 의 await 가 cancel
- runPipeline 의 `try { ... } finally { ... }` 가 unwind 되지 않음 (process 사망)

이 시나리오에서 `metaPersistenceFailures` 변수는 GC 대상 — closure 가 capture 했지만 process 사망으로 무관. **PipelineResult 자체가 caller 에 전달 안 되므로** 옵션 C 의 가시화 효과는 **stderr 로그 단독** 으로 의존. DA-2 와 같은 결론이지만 architect 관점에서 한 번 더 확인.

→ **이 점이 직전 4-Pass 의 SF-CRITICAL-2 이연 결정의 핵심 근거.** 본 B1 변경이 race 자체를 해결하는 게 아니라 "race 가 발생하지 않을 때만 가시화" 하는 것. 명시 이연이라 본 리뷰에서는 **신규 결함 0건** 으로 판정.

**판정:** 신규 결함 아님 (이연된 알려진 한계). 그러나 본 B1 의 옵션 C 주석 (line 467-468) 이 "stderr 로 운영 alarm 트리거" 라고 단언한 부분이 race 시 깨진다는 사실을 caller-level JSDoc 어딘가에 명시하면 좋다. → Minor 이슈로 등급화.

**DA-5 (Minor):** `MetaPersistenceFailure.reason` 이 string 단일 필드. 그러나 D1 throw 의 원인은 (a) network (b) trigger RAISE(ABORT) (c) row not found 중 무엇인지 caller 가 분류 불가. `console.error(..., err)` 는 raw err 객체를 출력하지만 PipelineResult 의 reason 은 `err.message` 만 — Error stack 손실. operation 별 stale lock 권고가 다를 수 있음 (예: trigger violation 은 force-unlock 무의미).

**판정:** Minor — 본 변경의 신규 silent failure 도입은 아니지만, 향후 운영 분류에 도움 될 보강.

### 분류

- 🔴 Critical: **0건** (신규 도입 0건 확인)
- 🟠 Major: **0건** (DA-4 는 명시 이연 — SF-CRITICAL-2 와 중복 차단)
- 🟡 Minor: **1건** (DA-5: reason 분류 가능한 enum/category 필드 부재)

---

## Pass 3 — Advocate (UX + 운영자 시각, Silent 가시화)

### ✅ 확인 항목 (5건)

1. **`batch.ts:219-226` 운영자 alarm 메시지:** ⚠️ 이모지 + "운영 alarm 검토 필수" + stage/op/reason 각 항목 + "force-unlock 검토" 행동 안내. Critical Rule #4 준수 (사용자에게 무엇을 할지 알려준다).
2. **`pipeline.ts:80-89` `MetaPersistenceFailure` JSDoc 발생 시점 enumeration:** 4가지 시점 모두 명시 — 운영자가 어떤 상황에서 발생했는지 즉시 파악 가능.
3. **stderr vs stdout 분리:** `pipeline.ts:471, 542, 573, 589, 601, 607` 모두 `console.error` (stderr). `batch.ts:220-225` alarm 도 stderr. `printRunReport` (batch.ts:256-268) 의 normal 출력은 stdout. CI/cron job 로그 라우팅 정상.
4. **`batch.ts:259` `recovery: ${result.recoveryStatus}` 1줄 추가 — 정상 출력에도 노출:** 운영자가 매 실행 결과에서 recovery 분기를 볼 수 있음. 'already_completed' 시 stage 전부 skipped 인 이유를 즉시 파악.
5. **테스트 expect (`pipeline.integration.test.ts:155, 181, 218, 274, 402-403`) 모두 `metaPersistenceFailures: []` 빈 배열 검증:** fresh run + InMemoryBatchRunsDb 정상 경로에서 메타 실패 0건이 보장됨 — silent drop 의도 도입 차단.

### Devil's Advocate (1건)

**DA-6 (Minor):** `batch.ts:222` 의 alarm 출력이 `result.qg2Passed` 분기 (line 230) 와 별도 — qg2Passed=true 인 정상 케이스에서도 메타 실패 alarm 이 출력되면 운영자가 "QG-2 통과했는데 왜 ⚠️" 로 혼란. exit code 는 0 (qg2 pass) 이지만 stderr 에 alarm — log aggregator 가 "WARN" 레벨로 처리 vs "ERROR" 레벨 처리 분리 필요.

→ 본 변경 자체는 silent 차단 의도라 의도된 동작. 그러나 운영 문서 (Step 11.6 plan §X) 에 "exit 0 + ⚠️ stderr 동시 가능" 시나리오 명시 권고.

**판정:** Minor (UX 보강 권고).

### 분류

- 🔴 Critical: **0건**
- 🟠 Major: **0건**
- 🟡 Minor: **1건** (DA-6: 정상 exit + stderr alarm 동시 발생 운영 매뉴얼 보강)

---

## Pass 4 — Contract (B1 변경 contract 정합성)

### ✅ 확인 항목 (5건)

1. **결정 1 = 옵션 C (PipelineResult 가시화) 채택 검증:** `pipeline.ts:113` `metaPersistenceFailures: readonly MetaPersistenceFailure[]` 가 PipelineResult 에 추가됨 — 진산님 결정 1 (decision-20260429-step11-6-after-cap2.md) 정확히 반영.
2. **결정 2 = 시점 X (Day 1 첫 작업) 검증:** Session 017 진입 즉시 B1 진행 — 검증 결과 (typecheck PASS + 137/137 tests PASS) 가 본 리뷰 컨텍스트에서 객관 사실로 보고됨.
3. **SF-C-3 정정 (`state='failed'` UPDATE catch):** line 539-544 에 try/catch wrap + push + console.error + continue. silent drop → 가시화 전환 완료.
4. **SF-M-4 정정 (`state='completed'` 와 `state='in_progress'` UPDATE wrap):** 동일 패턴 (line 563-575, 580-596). 일관성 PASS.
5. **SF-C-2 옵션 C 정정 (SIGINT handler closure push):** line 469-477. 옵션 C = best-effort 그대로 + 가시화 — 정확히 매칭.

### Devil's Advocate (1건)

**DA-7 (Minor):** `MetaPersistenceFailure.stage` 가 `PipelineStage | 'completed_transition' | 'sigint_kill'` 인데, 'recover' 시점 (recover.ts:275 의 `state='recovered'` UPDATE) 은 enumeration 에서 제외됐다.

`recover.ts:275-278` 은 `await opts.batchRunsDb.updateState(opts.examId, opts.batchRunId, { state: 'recovered', resume_count_increment: 1 });` — try/catch 없음. throw 시 recover.ts 내부에서 그대로 전파되어 `recoverBatch` caller (`pipeline.ts:403`) 에서 **catch 되지 않고** runPipeline 자체가 throw. caller (batch.ts:96-103) 의 outer catch 가 잡아 exit 1/4/5 로 종료. → silent drop 0건 (CRITICAL RULE #3 준수, throw 가시화).

**그러나** 본 B1 변경은 `state='recovered'` UPDATE 실패 시점은 가시화 대상에서 제외. 이는 의도적 (recover.ts 자체 결함 시 metaPersistenceFailures 에 push 할 outer scope 가 없음) — 해당 경로는 throw → exit 5 (RecoveryFailedError) 가 1차 방어선이 아니라 직접 throw → exit 1.

**판정:** 정상 동작. 그러나 `MetaPersistenceFailure.stage` JSDoc (line 80-89) 의 enumeration 에서 "왜 recover 시점은 빠졌는지" 명시하면 향후 유지보수자 혼란 차단. → Minor.

### 분류

- 🔴 Critical: **0건**
- 🟠 Major: **0건**
- 🟡 Minor: **1건** (DA-7: recover 시점 metaPersistenceFailures 미커버 사유 JSDoc 보강)

---

## 종합 판정

```
── SILENT-FAILURE REVIEW (Step 11.6 B1) ─────
리뷰 방식: 독립 에이전트 (silent-failure-hunter, 메인 대화 모름)
리뷰 범위: 변경 3 파일 + 연관 3 파일

Pass 1 (Surgeon):    ✅ 8건 / 🔴 0건 / 🟠 2건 / 🟡 1건
Pass 2 (Architect):  ✅ 6건 / 🔴 0건 / 🟠 0건 / 🟡 1건
Pass 3 (Advocate):   ✅ 5건 / 🔴 0건 / 🟠 0건 / 🟡 1건
Pass 4 (Contract):   ✅ 5건 / 🔴 0건 / 🟠 0건 / 🟡 1건

합계: ✅ 24건 / 🔴 0건 / 🟠 2건 / 🟡 4건
판정: 완료 가능 (CRITICAL 0건)
─────────────────────────────────────────────
```

### 핵심 결론 (silent-failure-hunter 단독 관점)

1. **SF-C-3, SF-M-4, SF-C-2 옵션 C 모두 silent drop → 가시화 전환 완료.** B1 변경은 본래 의도대로 작동.
2. **신규 silent failure 도입 0건** — 모든 try/catch 가 reason 정규화 + console.error + push 패턴 일관 준수.
3. **CRITICAL RULE #3 (try-catch 데이터 조용히 삭제 금지) 준수.** 빈 catch 0건. 모든 catch 에서 가시화 + 누적.
4. **MAJOR 2건** 은 본 B1 의 결함이 아닌 **closure capture 의 본질적 한계** (DA-1: finally 자체 실패 시 push 불가, DA-2/DA-4: SIGINT race 시 .catch 콜백 자체 미실행). 둘 다 옵션 C 의 가시화 효과 한계 — **SF-CRITICAL-2 (signal handler async 패턴) 이연으로 알려진 사안과 일관**.

### 권고 (Minor — 본 세션 차후 또는 다음 step 옵션)

1. **DA-1 보강:** `finally` 의 `removeHandlers` 와 `costMeter.finalize` 실패도 `metaPersistenceFailures.push` 에 누적 — 1줄씩 추가하면 finally throw 손실 0 (단, finally 자체 throw 가 PipelineResult 차단할 가능성은 별도 — DA-1 의 핵심).
2. **DA-2/DA-4 명시:** `pipeline.ts:467-468` 주석에 "process.exit(130) 시 microtask cancel 가능 — closure push 미실행 가능" 1줄 보강.
3. **DA-3 deduplicate:** stage 별 동일 reason 누적 차단 — 운영 가시성 보강 (시점 자유).
4. **DA-5 reason 분류:** `MetaPersistenceFailure` 에 `category: 'trigger_violation' | 'connection_lost' | 'unknown'` 추가 권고.
5. **DA-6 운영 매뉴얼:** "exit 0 + ⚠️ stderr alarm 동시 발생 시 처리" plan/runbook 명시.
6. **DA-7 JSDoc:** `MetaPersistenceFailure.stage` 의 'recover' 시점 미커버 사유 명시.

### 본 세션 진행 권고

**판정: 완료 가능 (CRITICAL 0건).** B1 변경은 silent-failure-hunter 단독 관점에서 통과. Minor 6건은 기록 후 차후 step 또는 폴리시 보강 단계에서 수렴 가능. 본 세션 다음 작업으로 진행해도 silent failure 차단 의무는 충족.

**주의 (재강조):** 본 리뷰는 silent-failure-hunter 단독 시각 — system-architect / quality-engineer / refactoring-expert / backend-architect 시각에서 별도 결함이 발견될 수 있다. 4-Pass 종합 판정 시 본 보고서를 1개 입력으로 사용.

---

## 부록 — 파일 라인 증거 (재검증 가능)

| 항목                                      | 파일                                                    | 라인                                        |
| ----------------------------------------- | ------------------------------------------------------- | ------------------------------------------- |
| MetaPersistenceFailure 타입 선언          | `apps/batch/src/pipeline.ts`                            | 80-94                                       |
| PipelineResult 인터페이스 확장            | `apps/batch/src/pipeline.ts`                            | 96-114                                      |
| metaPersistenceFailures 누적 변수 선언    | `apps/batch/src/pipeline.ts`                            | 445                                         |
| SIGINT closure push (옵션 C)              | `apps/batch/src/pipeline.ts`                            | 469-477                                     |
| state='failed' UPDATE catch (SF-C-3)      | `apps/batch/src/pipeline.ts`                            | 532-545                                     |
| state='in_progress' UPDATE catch (SF-M-4) | `apps/batch/src/pipeline.ts`                            | 563-575                                     |
| state='completed' UPDATE catch (SF-M-4)   | `apps/batch/src/pipeline.ts`                            | 580-596                                     |
| finally removeHandlers/finalize wrap      | `apps/batch/src/pipeline.ts`                            | 597-609                                     |
| PipelineResult return 에 신규 필드 포함   | `apps/batch/src/pipeline.ts`                            | 612-621                                     |
| buildSkipResult 메타 일관                 | `apps/batch/src/pipeline.ts`                            | 350-366                                     |
| caller alarm 가시화                       | `apps/batch/bin/batch.ts`                               | 219-226                                     |
| recoveryStatus → exit code 분기           | `apps/batch/bin/batch.ts`                               | 229                                         |
| printRunReport recovery 1줄 추가          | `apps/batch/bin/batch.ts`                               | 259                                         |
| 5 callsite expect (no_checkpoint + [])    | `apps/batch/src/__tests__/pipeline.integration.test.ts` | 154-155, 180-181, 217-218, 273-274, 402-403 |
