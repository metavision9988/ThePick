---
리뷰 방식: 독립 에이전트 (system-architect)
리뷰 일시: 2026-04-29 KST
리뷰 대상: Step 11.6 B1 PipelineResult 확장 — recoveryStatus + metaPersistenceFailures (Session 017)
리뷰자 컨텍스트: 메인 대화 모름 (의도 편향 차단)
선행 보고서: review-20260429-094423-step11-6-pipeline-integration-system-architect.md / review-20260429-104757-step11-6-cap2-system-architect.md
---

## 0. 리뷰 범위 (변경 3 + 연관 5)

|   #    | 파일                                                                        |                                         라인                                         | 역할                                                                                                                                                                             |
| :----: | :-------------------------------------------------------------------------- | :----------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 변경 1 | `apps/batch/src/pipeline.ts`                                                | 80-94 / 96-114 / 350-366 / 444-445 / 469-477 / 539-544 / 563-575 / 580-596 / 612-621 | `MetaPersistenceFailure` 신규 export + `PipelineResult` 2 필드 추가 + 4개 누적 사이트                                                                                            |
| 변경 2 | `apps/batch/bin/batch.ts`                                                   |                                  215-230 / 256-268                                   | `result.metaPersistenceFailures.length>0` stderr alarm + `recoveryStatus==='already_completed'` exit 0 분기 + `printRunReport` recovery 1줄 추가                                 |
| 변경 3 | `apps/batch/src/__tests__/pipeline.integration.test.ts`                     |                     153-155, 180-181, 217-218, 273-274, 402-403                      | 5 testcase 모두 `expect(result.recoveryStatus).toBe('no_checkpoint') + metaPersistenceFailures.toEqual([])`                                                                      |
| 연관 1 | `apps/batch/src/recover.ts`                                                 |                                        99-105                                        | `RecoveryStatus` 6 literal union 정의 (`'fully_recovered' \| 'partially_recovered' \| 'recovery_failed' \| 'no_checkpoint' \| 'concurrent_run_detected' \| 'already_completed'`) |
| 연관 2 | `apps/batch/src/in-memory-batch-runs-db.ts`                                 |                                       105-112                                        | 0015 트리거 invariant 모방 (completed→다른 state 차단 / completed→recovered 차단) — metaPersistenceFailure 발생 가능 케이스 검증 도구                                            |
| 연관 3 | `apps/batch/src/index.ts`                                                   |                                        14-22                                         | 패키지 외부 export 표면 (`PipelineResult` 포함, `MetaPersistenceFailure` / `RecoveryStatus` 미포함 — 본 리뷰 핵심 발견)                                                          |
| 연관 4 | `apps/batch/src/pipeline.ts`                                                |                                        59-69                                         | `PipelineStage` 10 literal union (`'pdf_extract'` ~ `'qg2_gate'`) — `MetaPersistenceFailure.stage` 의 base union                                                                 |
| 연관 5 | `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md` |                                      1040-1056                                       | §10 SLO "Step 11.6 코드 진입 첫 commit 에서 6 callsite 모두 갱신 PASS — 부분 commit 금지"                                                                                        |

연관 파일은 본 정정의 인터페이스 정합 검증을 위한 read-only 점검 대상.

---

## Pass 2 — ARCHITECT (system-architect 단독 관점)

> "이 코드가 다른 모듈과 만나면 터지는가?"

### ✅ 7건 확인 / 🔴 0건 / 🟠 2건 / 🟡 2건 / N/A 1건

---

#### ✅ 확인 1 — 6 callsite 일괄 갱신 PASS (plan §10 SLO 만족)

- **갱신 대상 6 callsite (모두 `result.recoveryStatus` + `result.metaPersistenceFailures` 소비):**
  1. `apps/batch/bin/batch.ts:215` (cmdRun) — `runPipeline(ctx)` 호출 후 `printRunReport(result)` + `result.metaPersistenceFailures.length` 분기 + `result.recoveryStatus === 'already_completed'` exit 0 분기 (line 219-230)
  2. `apps/batch/src/__tests__/pipeline.integration.test.ts:140` — fixture mode 소규모 (`expect(result.recoveryStatus).toBe('no_checkpoint')` + `metaPersistenceFailures.toEqual([])` line 154-155)
  3. `apps/batch/src/__tests__/pipeline.integration.test.ts:175` — dry-run snapshot (line 180-181)
  4. `apps/batch/src/__tests__/pipeline.integration.test.ts:213` — 합성 대규모 contract (line 217-218)
  5. `apps/batch/src/__tests__/pipeline.integration.test.ts:266` — 실패 경로 invalid contract (line 273-274)
  6. `apps/batch/src/__tests__/pipeline.integration.test.ts:381` — non-fixture 통합 CR-5b (line 402-403)
- 6 callsite 모두 인터페이스 확장 후 신규 2 필드 직접 접근 — 누락 callsite 0건. plan §10 SLO ("부분 commit 금지") 객관적 만족.
- typecheck (`pnpm -C apps/batch typecheck`) PASS — 누락 callsite 가 있었다면 readonly required 필드 미초기화로 컴파일 에러 발생 (TypeScript strict 가 음성 검증).
- 137/137 vitest PASS — 5개 테스트 모두 새 expect 통과 = 런타임 동등성도 입증.

---

#### ✅ 확인 2 — `RecoveryStatus` 6 literal union 노출이 caller 분기 정합

- `apps/batch/src/recover.ts:99-105` 의 `RecoveryStatus = 'fully_recovered' | 'partially_recovered' | 'recovery_failed' | 'no_checkpoint' | 'concurrent_run_detected' | 'already_completed'`
- `pipeline.ts:411-419` 에서 `concurrent_run_detected` → `ConcurrentRunError` throw, `recovery_failed` → `RecoveryFailedError` throw — 둘 다 PipelineResult 미반환 (caller 가 catch 후 exit code 4/5 처리, batch.ts:100-101)
- `pipeline.ts:411-413` `already_completed` → `buildSkipResult(...)` early return — 이 경로의 `PipelineResult.recoveryStatus` 는 `'already_completed'` 하드코딩 (line 363)
- 정상 흐름 종료(line 612-621) 시 `recoveryStatus: recovery.status` 는 `recovery.status !== 'concurrent_run_detected' && recovery.status !== 'recovery_failed' && recovery.status !== 'already_completed'` 잔여 3 literal (`fully_recovered` / `partially_recovered` / `no_checkpoint`)
- 따라서 caller 가 PipelineResult 를 받았을 때 실제 도달 가능한 `recoveryStatus` literal 은 4종 (`already_completed` / `fully_recovered` / `partially_recovered` / `no_checkpoint`)
- batch.ts:229 의 분기 `result.recoveryStatus === 'already_completed'` 는 4 literal 중 1개를 정확히 구별 — 정합 PASS. 나머지 3 literal 은 `qg2Passed` 분기로 통합 처리(line 230) — 의도 명확.

---

#### ✅ 확인 3 — `MetaPersistenceFailure.stage` union 확장이 4 누적 사이트와 정합

`MetaPersistenceFailure.stage: PipelineStage | 'completed_transition' | 'sigint_kill'` 의 caller 4 사이트 매핑 검증:

|  #  | 위치                                                     | stage 값                            | operation 값          | union 정합                        |
| :-: | :------------------------------------------------------- | :---------------------------------- | :-------------------- | :-------------------------------- |
|  1  | pipeline.ts:543 (stage failed UPDATE 실패)               | `stage` (loop var, `PipelineStage`) | `'state_failed'`      | ✅ PipelineStage                  |
|  2  | pipeline.ts:574 (stage success UPDATE in_progress 실패)  | `stage` (loop var, `PipelineStage`) | `'state_in_progress'` | ✅ PipelineStage                  |
|  3  | pipeline.ts:590 (정상 완료 UPDATE completed 실패)        | `'completed_transition'`            | `'state_completed'`   | ✅ literal 'completed_transition' |
|  4  | pipeline.ts:472 (SIGINT handler markBatchRunKilled 실패) | `'sigint_kill'`                     | `'state_killed'`      | ✅ literal 'sigint_kill'          |

- `PipelineStage` 10 literal + 2 추가 literal = 12 가능값 — 4 사이트 모두 의미 있는 1:1 매핑.
- `operation` 4 literal (`state_failed` / `state_completed` / `state_in_progress` / `state_killed`) 도 4 사이트와 1:1 정합 — orphan literal 없음.
- `PipelineStage` 가 추후 확장될 경우(예: `'manual_review'` 추가) `MetaPersistenceFailure.stage` 가 자동 흡수 → forward-compat 정합. ✅

---

#### ✅ 확인 4 — `metaPersistenceFailures` 누적 → PipelineResult 노출 일관성

- `pipeline.ts:445` `const metaPersistenceFailures: MetaPersistenceFailure[] = []` 는 try/finally 외부에서 선언 (line 501 try 블록 진입 전).
- 4 push 사이트 (line 472 SIGINT handler closure / 543 stage failed catch / 574 stage success catch / 590 completed catch) 가 모두 동일 closure 의 `metaPersistenceFailures` 변수에 누적.
- finally(line 597-610) 블록은 `removeHandlers` + `costMeter.finalize()` 만 — `metaPersistenceFailures` 미접근 (push 도 finalize 도 안 함). ✅ try-finally 인터페이스 격리.
- return 경로(line 612-621) 는 finally 종료 후 도달 — `metaPersistenceFailures` 값은 그 시점까지의 모든 push 누적. ✅
- SIGINT handler push (line 472-477) 는 process.exit 전에 fire-and-forget — `markBatchRunKilled().catch()` 가 await 되지 않음. 따라서 PipelineResult 가 caller 에 반환된 시점에 SIGINT push 가 누적되어 있다는 보장 X, 하지만 SIGINT 시 caller 는 PipelineResult 를 수신할 수 없음(process 종료) — 이것은 의도된 best-effort (line 467-468 주석 명시).
- 일관성 ✅ 단, 본 사실은 caller 가 "SIGINT 시 metaPersistenceFailures 가 비어있을 수 있음"을 알아야 함 — 별도 마이너 지적 (Mn-1 참조).

---

#### ✅ 확인 5 — Hard Rule 16/17 정합 (시험 ID 리터럴 신규 도입 0건)

- 변경 3 파일에서 `'son-hae-pyeong-ga-sa'` 직접 리터럴 사용 0건. `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 경유:
  - `bin/batch.ts:22` `import { EXAM_IDS }` / `bin/batch.ts:208` `examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA`
  - `__tests__/pipeline.integration.test.ts:23` `import { EXAM_IDS }` / `step116TestFields()` line 42 `examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA`
- `pipeline.ts` 내 `son-hae-pyeong-ga-sa` 0건 (JSDoc 예시는 line 239 `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 백틱 코드블록 — production-quality.md Rule 17 예외 "JSDoc 내 문자열" 적용)
- `examId` 시그니처는 신규 도입 컴포넌트 전부 적용:
  - `MetaPersistenceFailure` 자체에는 `examId` 미포함 (PipelineResult 가 batch_run_id+examId 컨텍스트를 이미 보유 — caller 가 결합 상태에서 소비하므로 redundancy 회피, line 88 JSDoc "caller (CLI / 모니터링) 는 metaPersistenceFailures.length > 0 시 alarm 의무" 가 결합 가정 명시) ✅
  - `markBatchRunKilled(examId, batchRunId, batchRunsDb)` line 372-378 — examId 시그니처 첫 인자 정합 (Hard Rule 16 Year 1 한시 예외 패턴)
- Hard Rule 16/17 위반 0건. ✅

---

#### ✅ 확인 6 — CRITICAL RULE #2 / #3 정합 (빈 함수 / 빈 catch 위반 없음)

- 변경 3 파일 내 신규 함수/메서드 본문 검사:
  - `markBatchRunKilled(examId, batchRunId, batchRunsDb)` line 372-378 — `await batchRunsDb.updateState(...)` 단일 라인 실 로직. CRITICAL RULE #2 PASS.
  - `buildSkipResult(ctx, message)` line 350-366 — 명시적 PipelineResult 객체 생성 (10 stage `skipped` 매핑). PASS.
  - signal handler closure line 451-478 — `flushCheckpoint` 가 lastSnapshot null guard + buildCheckpoint + writeCheckpointSync + markBatchRunKilled 4 단계 실행. PASS.
- 4 catch 사이트(line 539-544, 563-575, 580-596, 469-477) 모두 `console.error` + `metaPersistenceFailures.push({...reason...})` 2동작 보유 — 빈 catch 0건. CRITICAL RULE #3 PASS.
- finally 의 catch 2개(line 600-602, 605-608) 도 `console.error('logged only')` — best-effort cleanup 의도 명시. CRITICAL RULE #3 의 정신(가시화 + 전파/폴백) 의 "가시화" 항목 충족.
- 변경 3 파일 어디에도 stub / placeholder / TODO / `throw new Error('not implemented')` 패턴 0건. ✅

---

#### ✅ 확인 7 — 인터페이스 호환성 (외부 패키지 영향 분석)

- `apps/batch/src/index.ts` 의 export 표면 검사:
  - `PipelineResult` export ✅ (line 18)
  - `RecoveryStatus` export ❌ — index.ts 미포함
  - `MetaPersistenceFailure` export ❌ — index.ts 미포함
- 외부 패키지가 `PipelineResult` 를 import 하면 `recoveryStatus: RecoveryStatus` 와 `metaPersistenceFailures: readonly MetaPersistenceFailure[]` 를 type-level 로 보지만, RecoveryStatus / MetaPersistenceFailure 타입을 명시적으로 import 할 수 없음 — caller 측 변수 어노테이션이나 분기 helper 작성 시 불편.
- 그러나 현재 `apps/batch` 외부에서 `PipelineResult` 소비처는 **0건** (`grep -rn` 검증 — `apps/web`, `apps/admin-web`, `apps/api`, `packages/*` 모두 PipelineResult 미참조).
- 따라서 본 누락은 **현재 시점 breaking change 0건** — 그러나 Phase 2 진입 시 admin-web 이 BATCH 결과 표시 UI 를 만들면 즉시 문제 발생. 마이너 지적 (Mn-2 참조).

---

### 🟠 MAJOR-1 (M-1) — `MetaPersistenceFailure` / `RecoveryStatus` 가 패키지 외부 export 누락 (forward-compat 부채)

- **위치:** `apps/batch/src/index.ts:14-22`
- **현상:**
  ```typescript
  export { runPipeline, PIPELINE_STAGES, BATCH_CONFIGS, BATCH1_CONFIG } from './pipeline';
  export type {
    PipelineStage,
    PipelineContext,
    PipelineResult,
    StageResult,
    BatchId,
    BatchConfig,
  } from './pipeline';
  ```
  `PipelineResult` 는 export 되지만 그 멤버 타입 `RecoveryStatus` / `MetaPersistenceFailure` 는 미export.
- **영향:**
  1. 외부 caller (예: 향후 `apps/admin-web` 의 BATCH 모니터링 페이지) 가 `metaPersistenceFailures` 를 받은 후 `MetaPersistenceFailure[]` 타입을 명시 어노테이션 / 함수 시그니처에 사용 불가 — `import('@thepick/batch').PipelineResult['metaPersistenceFailures'][number]` 같은 우회 trick 필요.
  2. `RecoveryStatus` 도 동일 — caller 가 `switch(recoveryStatus)` 분기 시 타입 narrowing 을 위해 import 필요.
  3. plan §10 SLO 의 "6 callsite 일괄 갱신" 자체는 **만족** — 문제는 외부 future caller 의 ergonomic. 그러나 PipelineResult 확장 commit 에서 export 도 같이 처리하지 않으면 다음 callsite 추가 PR 이 분리됨 = "부분 commit" 우려.
- **해결안:**
  ```typescript
  export type {
    PipelineStage,
    PipelineContext,
    PipelineResult,
    MetaPersistenceFailure, // 추가
    StageResult,
    BatchId,
    BatchConfig,
  } from './pipeline';
  export type { RecoveryStatus, BatchRunsDb, BatchRunRow } from './recover'; // 추가
  ```
  RecoveryStatus 는 `recover.ts` 가 source of truth → recover.ts 에서 re-export.
- **우선순위:** MAJOR (현재 외부 caller 0건이라 즉시 breakage 없으나, B1 커밋 일관성 + plan §10 SLO 정신 위배 우려 — 본 commit 동시 처리 권고)

---

### 🟠 MAJOR-2 (M-2) — `recoveryStatus` 타입 noise (caller 가 도달 불가 literal 4종 expect 시 dead branch)

- **위치:** `apps/batch/src/pipeline.ts:108` `readonly recoveryStatus: RecoveryStatus`
- **현상:** `RecoveryStatus` 6 literal 중 caller 가 PipelineResult 를 받은 시점에 도달 가능한 literal 은 4종(`already_completed` / `fully_recovered` / `partially_recovered` / `no_checkpoint`) 뿐. `concurrent_run_detected` / `recovery_failed` 는 throw 후 도달 불가 (line 414-419 의 `ConcurrentRunError` / `RecoveryFailedError` throw).
- **현 JSDoc 의 한계:** line 106 "concurrent_run_detected / recovery_failed 는 throw 후 도달 X (PipelineResult 미반환)" 가 자연어로 문서화 되어 있으나, **타입 시스템이 강제하지 않음** — caller 가 다음과 같은 코드를 작성하면 dead branch:
  ```typescript
  switch (result.recoveryStatus) {
    case 'concurrent_run_detected': // 도달 불가 — 컴파일러 경고 X
      handleConcurrentRetry();
      break;
    case 'recovery_failed': // 도달 불가
      escalate();
      break;
    // ...
  }
  ```
- **영향:**
  1. caller 가 6 literal 모두 expect 하는 exhaustive switch 작성 시 dead branch 가 silently 통과 → 향후 `RecoveryStatus` 가 7 literal 로 확장될 때 exhaustiveness 검증 손상.
  2. batch.ts:229 `if (result.recoveryStatus === 'already_completed')` 처럼 단일 분기는 영향 없음 — but 5-페르소나 리뷰 중 quality-engineer 가 "exhaustive switch 작성 시 도달 불가 case 가 silent 통과" 지적 가능성.
- **해결안 A (보수, 권고):** 별도 narrowed type 도입 + JSDoc 강화

  ```typescript
  /** PipelineResult 안에서 도달 가능한 RecoveryStatus 부분집합 — throw 분기 제외. */
  export type ReturnedRecoveryStatus = Exclude<
    RecoveryStatus,
    'concurrent_run_detected' | 'recovery_failed'
  >;

  export interface PipelineResult {
    // ...
    readonly recoveryStatus: ReturnedRecoveryStatus; // 4 literal 만
  }
  ```

  타입 시스템이 dead branch 를 컴파일 에러로 강제. caller 의 exhaustive switch 가 4-literal 만 보면 됨.

- **해결안 B (현상 유지 + 도구):** `// @ts-expect-error (concurrent/recovery_failed 는 throw — 도달 불가)` ESLint 룰 도입은 과도. 본 해결안은 비추.
- **우선순위:** MAJOR (외부 caller 0건이지만 admin-web BATCH 모니터링 UI 작성 시 발생할 흔한 패턴 — Phase 2 진입 전 정리 권고. 본 B1 commit 에 포함 또는 다음 세션 즉시 처리)
- **반증 (Devil's Advocate):** "throw 분기는 caller catch 에서 별도 처리하므로 PipelineResult 의 recoveryStatus 가 6 literal 모두 노출되는 게 자연스럽다 (transparent)" — 그러나 caller 가 catch 와 PipelineResult 분기를 분리 처리하는 게 일반적이므로 narrowing 이 더 정합.

---

### 🟡 Mn-1 — SIGINT push 의 race: caller 가 PipelineResult 를 수신했다면 SIGINT push 도달 X (현 JSDoc 명시 부족)

- **위치:** `pipeline.ts:469-477` (SIGINT handler `markBatchRunKilled().catch(...)`)
- **현상:** SIGINT handler 의 `metaPersistenceFailures.push({stage:'sigint_kill',...})` 는 process.exit 직전 fire-and-forget. caller 가 PipelineResult 를 정상 수신했다는 것은 process 가 살아있다는 의미 → SIGINT handler 가 발사된 시나리오면 process.exit 이미 실행되어 caller 는 PipelineResult 를 수신할 수 없음.
- **결론:** `metaPersistenceFailures` 안에 `stage:'sigint_kill'` 이 들어있는 PipelineResult 는 **이론상 도달 불가** — line 91 union 의 `'sigint_kill'` literal 이 PipelineResult 표면에서 dead value.
- **그러나** stderr 로그(`console.error('[Pipeline] markBatchRunKilled failed (best-effort):', err)`)는 운영자 alarm 으로 도달 — 옵션 C 의도(line 467-468 주석)는 **PipelineResult 수신 X 케이스에서 stderr 가 alarm 트리거**.
- **권고:** `MetaPersistenceFailure.stage = 'sigint_kill'` literal 의 JSDoc 에 "PipelineResult 표면에서 도달 불가 — stderr 만이 운영 alarm 경로" 추가. 또는 `'sigint_kill'` 을 union 에서 제거하고 stderr-only 경로로 분리. 후자가 더 깔끔하나 본 B1 변경 범위 외.
- **우선순위:** Minor (현재 코드 동작 정상, 문서화만 보강)

---

### 🟡 Mn-2 — `MetaPersistenceFailure.reason: string` 이 원본 Error stack 손실 (디버깅 정보 trade-off)

- **위치:** `pipeline.ts:541, 572, 588, 470` 4 사이트 모두 `const reason = err instanceof Error ? err.message : String(err)`
- **현상:** Error 객체에서 `.message` 만 추출 → `.stack` / `.cause` / `.name` 손실. metaPersistenceFailures 만으로 운영자가 D1 단절 vs 0015 트리거 RAISE(ABORT) vs network timeout 을 구분하기 어려움.
- **trade-off:** PipelineResult 가 직렬화 가능해야 하는 가정(JSON 로그 적재 / IPC 전송 가능성) 하에서는 string 단순화 의도 정당 — Error 객체는 직렬화 시 stack 일부 손실. 하지만 current caller 0건이라 직렬화 의무 검증 부재.
- **상보 보강 (이미 존재):** `console.error(reason 원본 Error 객체)` 가 stderr 로 stack 출력(line 542, 573, 589, 471) — 운영 alarm 시 stderr 로그 결합 검토 가능. 따라서 본 손실은 PipelineResult 단독 분석 한정 = 운영 워크플로우(stderr+PipelineResult 결합 전제) 에서는 영향 미미.
- **권고:** PipelineResult 가 직렬화 의무 미확정 시점에서 `reason: string` 유지가 보수적. Phase 2 admin-web BATCH 모니터링 UI 설계 시 `cause?: { name: string; stack?: string }` 추가 검토 — 본 B1 변경 범위 외.
- **우선순위:** Minor (현재 워크플로우 정합, 미래 확장 시그널만 기록)

---

### N/A 1건 — Workers 제약 검증

- `apps/batch` 는 Node.js subprocess 환경 (pdfplumber + tsx CLI) — Workers 런타임이 아니므로 fs/path/CPU 제한 N/A.
- `installSignalHandlers` (`signal-handlers.ts`) 의 `process.on('SIGINT')` 사용은 Node 전용 — Workers 호환성 N/A (apps/batch 는 Workers 배포 대상 X).

---

### Devil's Advocate 반론 (시나리오 2건)

#### 반론 1 — `metaPersistenceFailures.length > 0` 분기가 alarm 으로 충분한가? (운영자 UX 시나리오)

- batch.ts:219-226 의 stderr 출력은 **단일 BATCH 실행 종료 시점** alarm. 그러나 5-페르소나 리뷰의 devops-architect 관점("새벽 3시 on-call")에서 검증하면:
  1. 운영자가 BATCH-N 실행을 cron / GitHub Actions 로 자동화하면 stderr 가 어디로 가는가? — `.github/workflows/*.yml` / `crontab` 설정 의존.
  2. stderr 메시지에 명시된 "force-unlock 검토" 가이드가 실제 CLI 명령어와 정합? — 본 리뷰에서 검증: `bin/batch.ts` 의 commands 는 `run` / `status` / `list` 만(line 84-90) → **`force-unlock` CLI 미존재**.
  3. 즉, stderr 안내가 "다음 recover 시 stale lock 가능. force-unlock 검토" 라고 하지만, 운영자는 force-unlock 명령어를 찾을 수 없음 → **broken UX**.
- **그러나** 본 시나리오는 본 B1 변경 범위 외 — plan §3.1 "G. force-unlock CLI" 가 별도 미구현 항목으로 흡수 (다음 세션 §3.1 G 흡수, 본 task description 명시).
- **마이너 지적:** B1 commit 메시지 또는 stderr 안내에 "force-unlock CLI 는 다음 세션에서 추가 — 임시 해결책: D1 batch_runs 테이블 직접 조회 후 SQL UPDATE" 같은 임시 안내가 **현 시점에는 부재**. 운영자 UX 일관성 측면에서 보강 권고 (Mn 등급 — 본 보고서 분류 외 정보).

#### 반론 2 — 0015 트리거가 metaPersistenceFailure 를 전혀 발생시키지 않는 시나리오: 운영자가 alarm 부재로 안심하지만 실제로는 D1 단절

- `pipeline.ts:539-544` 의 catch 는 `ctx.batchRunsDb.updateState(...)` 가 throw 한 경우만 잡음.
- D1 connection 자체가 끊어져서 `updateState` 가 throw 한다고 가정 — InMemoryBatchRunsDb (test) 는 이런 케이스 모방 X (line 86-130 모든 throw 가 0015 트리거 invariant 모방만).
- D1BatchRunsDb 구현 (`d1-batch-runs-db.ts` — 본 리뷰 범위 외) 이 D1 단절 시 throw 하는지 확인 필요. 만약 D1 단절 시 silent 0 rows updated 패턴이면 catch 가 발사되지 않음 → metaPersistenceFailures 비어있음 → caller 가 정상 종료로 오인.
- **즉 본 B1 가 silent failure 차단 효과를 가정하는 전제는 "D1BatchRunsDb.updateState 가 단절 시 throw" — 본 리뷰 범위 외 검증 필요.**
- **권고:** silent-failure-hunter 페르소나가 D1BatchRunsDb 구현을 별도 검증해야 함. 본 architect 관점은 PipelineResult 인터페이스만 다룸 — 본 반론은 "interface 가 silent failure 차단을 약속하지만 구현(D1 어댑터) 검증이 별도 필요" 라는 의존 관계 시그널.
- **우선순위:** 본 B1 범위 외 (silent-failure-hunter 별도 위임 항목)

---

## 결론

### 분류 합계

- 🔴 CRITICAL: 0건
- 🟠 MAJOR: 2건 (M-1 export 누락 / M-2 recoveryStatus 타입 narrowing)
- 🟡 Minor: 2건 (Mn-1 sigint_kill literal dead value 문서화 / Mn-2 reason: string trade-off)
- ✅ 확인: 7건
- N/A: 1건

### 판정

**완료 가능 (조건부)** — CRITICAL 0건 PASS. plan §10 SLO ("6 callsite 일괄 갱신 PASS — 부분 commit 금지") 객관적 만족 (✅ 확인 1).

단, MAJOR 2건은 **본 B1 commit 시점 또는 즉시 후속 처리 권고**:

- M-1 (`MetaPersistenceFailure` / `RecoveryStatus` export 누락) — index.ts 동시 수정이 plan §10 SLO 정신("부분 commit 금지")과 가장 정합. 본 commit 에 포함 강력 권고.
- M-2 (`ReturnedRecoveryStatus` narrowing) — Phase 2 admin-web 진입 전 정리. 본 commit 에 포함 또는 다음 세션 첫 작업.

Mn-1/Mn-2 는 보고만 — 본 B1 commit 차단 사유 아님.

### Devil's Advocate 반론 강도

- 반론 1 (force-unlock CLI 부재 시 stderr 안내가 broken UX) — 본 B1 범위 외, 다음 세션 §3.1 G 흡수 명시되어 있어 정합. 단, B1 commit 시점에는 stderr 안내 문구가 운영자에게 misleading 가능 — commit 메시지에 "force-unlock CLI 는 후속 세션 §3.1 G" 명시 권고.
- 반론 2 (D1BatchRunsDb 구현이 D1 단절 시 throw 하는지) — 본 B1 인터페이스 범위 외, silent-failure-hunter 별도 위임 항목.

---

**최종 architect 권고:** B1 commit 진행 가능. 단, M-1 (index.ts export 추가)을 본 commit 에 동시 포함하면 SLO "부분 commit 금지" 정신 완전 만족. M-2 는 별도 후속 처리 가능 (다음 세션 첫 작업 우선순위).
