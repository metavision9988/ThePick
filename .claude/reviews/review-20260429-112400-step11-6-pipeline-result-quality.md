---
리뷰 방식: 독립 에이전트 (quality-engineer)
리뷰 일시: 2026-04-29 KST
리뷰 대상: Step 11.6 B1 PipelineResult 확장 — recoveryStatus + metaPersistenceFailures (Session 017)
리뷰자 컨텍스트: 메인 대화 모름 (의도 편향 차단)
선행 보고서: review-20260429-094423-step11-6-pipeline-integration-quality.md / review-20260429-104757-step11-6-cap2-quality.md
---

# Step 11.6 B1 PipelineResult 확장 — Quality Engineer 리뷰

리뷰 방식: 독립 에이전트 (quality-engineer)
리뷰 범위: 변경 3 파일 (pipeline.ts / batch.ts / pipeline.integration.test.ts) + 연관 4 파일 (in-memory-batch-runs-db.ts / checkpoint.test.ts / recover.test.ts / cost-meter.test.ts)

검증 객관 사실:

- pnpm -C apps/batch typecheck PASS (0 errors)
- pnpm -C apps/batch test PASS (137/137 tests, 1.49s)
- 회귀 0건 객관 — 정상 경로 한정 (mutated path 미탐)

---

## Pass 1 (Surgeon): ✅ 5건 확인 / 🔴 0건 / 🟠 0건 / N/A 0건

확인 항목:

1. `apps/batch/src/pipeline.ts:96-114` — `PipelineResult` 인터페이스에 `recoveryStatus: RecoveryStatus` + `metaPersistenceFailures: readonly MetaPersistenceFailure[]` 추가됨. 두 필드 모두 readonly — caller mutation 차단. JSDoc 89-94 가 발생 시점 4종 (state=failed/in_progress/completed UPDATE throw + SIGINT) 명시.
2. `apps/batch/src/pipeline.ts:533-545` — `state='failed'` UPDATE 가 try/catch wrap. catch 블록은 `console.error` + `reason` 캡처 + `metaPersistenceFailures.push(...)` + `continue` (흐름 유지). 빈 catch 0건. 산식 정밀도 영향 없음 (메타 영구화만).
3. `apps/batch/src/pipeline.ts:563-575` — `state='in_progress'` UPDATE 가 try/catch wrap. checkpoint 는 이미 line 560 의 `await writeCheckpoint(...)` 로 영속화된 후라 — 메타 영구화 실패해도 다음 stage 진행 가능 (SF-M-4 일관성).
4. `apps/batch/src/pipeline.ts:580-596` — `state='completed'` UPDATE 가 try/catch wrap. catch 시 `stage='completed_transition'` 라벨 명시 — 추적 가능.
5. `apps/batch/src/pipeline.ts:469-477` — SIGINT handler 내부 `markBatchRunKilled.catch(...)` 가 `metaPersistenceFailures.push({ stage:'sigint_kill', operation:'state_killed', reason })`. fire-and-forget 이라 process.exit 후 push 자체가 caller 에 전달 안 될 수 있음 (Devil's Advocate §1 참조).
6. `apps/batch/src/pipeline.ts:612-621` — 정상 종료 path 의 PipelineResult 가 `recoveryStatus: recovery.status` + `metaPersistenceFailures` 포함하여 반환. `buildSkipResult` (line 350-366) 도 두 필드 정상 채움.

반론 시나리오 (Devil's Advocate Pass 1):

- **`metaPersistenceFailures` 누수 경로** — `runPipeline` 외부 throw 시 (예: `recoverBatch` 자체 throw, `insertNewRun` throw, `costMeter.start()` throw) — `try { ... } finally { removeHandlers + costMeter.finalize }` 의 try 블록은 line 501 부터. 그 이전에 throw 시 finally 실행 안 됨 + PipelineResult 반환 X = `metaPersistenceFailures` 의 SIGINT push 가 영원히 caller 에 전달 안 됨. 정확히는 `console.error` 만 남고 push 는 무의미. 이 부분은 **현재 정정의 의도된 한계** (옵션 C JSDoc 명시 — caller 가 throw catch 시 push 미수신).

---

## Pass 2 (Architect): ✅ 5건 확인 / 🔴 0건 / 🟠 0건 / N/A 1건

확인 항목:

1. `apps/batch/src/pipeline.ts:90-94` — `MetaPersistenceFailure.stage` 타입이 `PipelineStage | 'completed_transition' | 'sigint_kill'` 합집합. 10 stage + 2 메타 라벨 = 12 가능 값. PipelineStage union 변경 시 자동 확장. operation 4 literal (`state_failed | state_completed | state_in_progress | state_killed`) — recover.ts BatchRunState 5 union (`in_progress | completed | failed | recovered | killed`) 과 부분 매핑. `recovered` 는 metaPersistenceFailures 에 없음 — recover.ts 내부 `updateState({ state: 'recovered' })` 가 throw 해도 recoverBatch 가 throw 전파 → runPipeline 도달 X (의도된 누락).
2. `apps/batch/src/pipeline.ts:108` — `recoveryStatus: RecoveryStatus`. `recover.ts:99-105` 의 6 literal 합집합 (`fully_recovered | partially_recovered | recovery_failed | no_checkpoint | concurrent_run_detected | already_completed`) 그대로 전파. PipelineResult 도달 가능 literal 4종 (recovery_failed / concurrent_run_detected 는 throw 후 미도달). JSDoc 106-107 명시.
3. `apps/batch/src/in-memory-batch-runs-db.ts:43-131` — 0015 트리거 invariant 1:1 모방: (a) `insertNewRun` 의 `existing.state === 'completed'` 체크 = `trg_batch_runs_no_duplicate_completed`. (b) `updateState` 의 `row.state === 'completed' && update.state !== 'completed'` 체크 = `trg_batch_runs_no_state_downgrade`. (c) `row.state === 'completed' && update.state === 'recovered'` 체크 = `trg_batch_runs_recover_only_from_non_completed`. 3종 모두 모방 — D1BatchRunsDb 와 lockstep.
4. `apps/batch/bin/batch.ts:218-226` — caller (CLI) 가 `result.metaPersistenceFailures.length > 0` 시 stderr 로 alarm 출력. line 229 의 `result.recoveryStatus === 'already_completed' → return 0` 분기 = Q-M-2 정정 검증. exit code 0 / 1 / 4 / 5 분기와 의존성 일관.
5. `apps/batch/src/__tests__/pipeline.integration.test.ts:38-50` — `step116TestFields(outDir)` 헬퍼가 `examId / batchRunId / checkpointBaseDir / batchRunsDb / engineVersion / enableSignalHandlers=false / fsyncCheckpoint=false` 7 필드 일괄 주입. 5 callsite (line 137, 172, 210, 263, 378) 모두 동일 헬퍼 사용 — DRY 원칙 + 신규 필드 추가 시 단일 변경점.

N/A: Workers 제약 — pipeline.ts 는 Node.js 전용 (mkdirSync/writeFileSync/Buffer 사용). pipeline 자체가 Workers 미배포 (배치 파이프라인은 빌드타임).

반론 시나리오 (Devil's Advocate Pass 2):

- **InMemoryBatchRunsDb 와 D1 트리거 lockstep 깨질 위험** — `migrations/0015_batch_runs.sql:38-94` 의 트리거 본문이 변경되어도 (예: 새 invariant 추가) `in-memory-batch-runs-db.ts:104-112` 가 자동 동기화 X. 본 정정 후 PASS 137/137 = D1 PASS 보장 X. F4 d1-trigger-verify.test.ts (다음 세션) 에서 better-sqlite3 e2e 로 트리거 직접 검증 의무.

---

## Pass 3 (Advocate): ✅ 5건 확인 / 🔴 0건 / 🟠 1건 / N/A 0건

확인 항목:

1. `apps/batch/bin/batch.ts:218-226` — 운영자 UX: stderr 출력에 stage / operation / reason 명시 + `→ 다음 recover 시 stale lock 가능. force-unlock 검토.` 안내 메시지. on-call 진산님이 무엇을 해야 할지 명확.
2. `apps/batch/bin/batch.ts:229` — `already_completed → return 0` 정합. CI/cron 이 동일 batch_run_id 재실행 시 false negative exit 1 발화 차단 (Q-M-2 정정 검증).
3. `apps/batch/src/pipeline.ts:541, 572, 588, 470` — 4 catch 블록 모두 `console.error` 사용 + `[Pipeline]` prefix 일관. 운영 로그 grep 가능 (production-quality.md 정합).
4. `apps/batch/src/__tests__/pipeline.integration.test.ts:155, 181, 218, 274, 403` — 5 callsite 의 `expect(result.metaPersistenceFailures).toEqual([])` — 정상 경로 = 빈 배열 검증. 누락 가능성 0 (단언 명시).
5. `apps/batch/src/__tests__/pipeline.integration.test.ts:154, 180, 217, 273, 402` — 5 callsite 의 `expect(result.recoveryStatus).toBe('no_checkpoint')` — 신규 run 기본값 검증.

🟠 MAJOR — 보안 관련 noise (수정 권고가 아니라 인지 차원):

- **A-MAJOR-1**: `metaPersistenceFailures.reason` 필드가 `err.message` 그대로 캡처 (`pipeline.ts:541, 572, 588, 470`). DB 어댑터 throw 메시지에 connection string / 환경 변수 / fixturePath 등이 포함될 가능성. `console.error` + caller printRunReport (`bin/batch.ts:223`) 가 stdout/stderr 노출. 가-0 환경에서는 `InMemoryBatchRunsDb` throw 메시지만 노출되므로 영향 미미. 그러나 **production D1 환경에서 D1BatchRunsDb 의 SQLite 라이브러리 throw 메시지가 sensitive info 포함할 위험** — 본 B1 정정 자체가 도입한 risk 아니나, 새 노출 경로 추가 = 의식 필요. 권고: Phase 1/2 진입 시 `reason` sanitize (마스킹 or 화이트리스트) 검토 — Step 18 contract verify 묶음 흡수 가능.

반론 시나리오 (Devil's Advocate Pass 3):

- **운영자가 `metaPersistenceFailures.length > 0` 을 무시할 위험** — stderr 출력은 시각적이나, CI/cron 환경에서 exit code 만 보는 운영 자동화에서는 묻힘. 본 B1 은 exit code 별도 분기 X (`metaPersistenceFailures` 1건 이상이라도 exit 0/1 그대로). on-call 진산님이 stderr 를 읽지 않으면 24h stale lock 위험 잔존 — **이는 옵션 C 의도된 한계**. 미래 보강: `metaPersistenceFailures.length > 0` 시 별도 exit code (예: 6=meta_dirty) 추가 검토 가능 (Phase 1+).

---

## Pass 4 (Contract): ✅ 6건 확인 / 🔴 0건 / 🟠 0건 / N/A 0건

확인 항목:

1. **production-quality.md "빈 catch 금지" 정합** — `pipeline.ts:539-544, 570-575, 586-595, 469-477` 의 4 catch 모두 (a) `console.error` + (b) `metaPersistenceFailures.push(...)` 또는 흐름 유지 + (c) reason 캡처. 빈 catch 0건. CRITICAL RULE #3 (try-catch에서 데이터 조용히 삭제 금지) 정합.
2. **CRITICAL RULE #2 stub 금지 정합** — `metaPersistenceFailures` 가 단순 빈 배열 placeholder 가 아닌 실 push 로직 4 시점 + caller alarm 의무 + JSDoc 명시. 실제 동작 (사이드 이펙트 console.error / 외부 PipelineResult 노출) 보유.
3. **Hard Rule 16 정합** — `recoverBatch.examId` 첫 인자 + `batchRunsDb.{select,insert,update}` 모두 examId 첫 인자. PipelineContext.examId required (`pipeline.ts:244`). Year 1 한시 예외 적용된 영역에 본 정정이 추가 위반 없음.
4. **Q-M-2 정정 검증** — 선행 보고서 `review-20260429-094423-step11-6-pipeline-integration-quality.md` Q-M-2 (already_completed false negative — caller exit 1 오해) 가 본 B1 정정 + `bin/batch.ts:229` 분기로 해결됨. `result.recoveryStatus === 'already_completed' → return 0` 명시.
5. **handoff-016 §3.1 B1 작업 범위 정합** — handoff-016 line 165 의 "B1: PipelineResult 인터페이스 확장 + 6 callsite 갱신, 0.4d" 와 본 정정 일치 (인터페이스 2 필드 + 6 callsite). 부분 commit 금지 SLO (handoff-016 §5.5) 도 단일 commit 내 모두 반영 (typecheck PASS = 부분 누락 0).
6. **ADR / plan 명시 — 옵션 C 채택 근거** — handoff-016 §3.3 line 203 "옵션 C (metaFailures 가시화 + PipelineResult 확장과 묶음)" 본 세션 권고. 진산님 결정 후 본 B1 진행 — Silent Pivot 0건.

반론 시나리오 (Devil's Advocate Pass 4):

- **PipelineResult 변경 = 외부 caller breaking change** — `apps/batch/bin/batch.ts:215-216` 외에 `apps/api/...` 또는 `apps/web/...` 가 `runPipeline` 직접 import 했다면 컴파일 에러 발생 가능. 검증: `grep -r "runPipeline\|PipelineResult" apps/ packages/ --include="*.ts"` 으로 외부 caller 0건 확인 의무. 본 review 검증 범위 외라 가정만.

---

## 추가 분석 — 사용자 질문 항목 직접 응답

### 1. 회귀 0건 객관 vs 효과 검증 갭 (사용자 질문 #1)

✅ 회귀 0건 객관 (137/137 PASS) — **정상 경로 한정**.

❌ 효과 검증 0% — `metaPersistenceFailures.length > 0` 경로 (정정의 핵심 기능) 는 **본 세션 e2e 0건**. 5 통합 테스트 모두 `InMemoryBatchRunsDb` 정상 경로 (throw 안 함) → push 트리거 안 됨. `expect(result.metaPersistenceFailures).toEqual([])` 5건은 **"빈 배열 누수 차단"** 만 검증 (필수이나 충분 X).

**Quality 결론**: 본 B1 PASS 는 "객관 사실 회귀 0건" 보고만 안전. **"옵션 C 효과 검증"** 은 다음 세션 §3.1 D / F 작업에서 의무.

### 2. e2e 적격 위치 매핑 (사용자 질문 #2)

handoff-016 §3.1 의 9 AC e2e 작업과 본 B1 검증 매핑 (다음 세션 분량 추가 영향):

| 본 B1 의 검증 부족 영역                       | handoff-016 §3.1 흡수 가능 작업        | 추가 부담         |
| :-------------------------------------------- | :------------------------------------- | :---------------- |
| `state='failed'` UPDATE throw → push          | F (d1-trigger-verify.test.ts) AC-R6    | +1 케이스 (~10분) |
| `state='in_progress'` UPDATE throw → push     | F (d1-trigger-verify.test.ts) AC-R6    | +1 케이스 (~10분) |
| `state='completed'` UPDATE throw → push       | F (d1-trigger-verify.test.ts) AC-RP-6  | +1 케이스 (~10분) |
| `markBatchRunKilled` SIGINT throw → push      | D (signal-handlers.test.ts) AC-R4      | +1 케이스 (~15분) |
| `recoverBatch` 자체 throw (`recovery_failed`) | C (pipeline-integration.test.ts)       | +2 케이스 (~20분) |
| `already_completed` recoveryStatus            | C (pipeline-integration.test.ts) AC-R3 | +1 케이스 (~10분) |
| `fully_recovered` / `partially_recovered`     | C (pipeline-integration.test.ts) AC-R1 | +2 케이스 (~20분) |

**총 추가 부담**: ~95분 (handoff-016 §3.1 D/E/F/C 합계 0.95d 의 ~17% 비중). 실효성은 다음 세션 시작 전에 본 매핑을 plan 에 흡수하면 zero-cost.

### 3. InMemoryBatchRunsDb 정합 — "intentional throw" 옵션 추가 검토 (사용자 질문 #3)

3가지 옵션 비교:

| 옵션                                         | 장점                                       | 단점                                          |
| :------------------------------------------- | :----------------------------------------- | :-------------------------------------------- |
| **A. `throwOnState: 'failed'` 옵션**         | 5 통합 테스트 mock 패턴 일관               | 0015 트리거 모방 본질 흐림 (테스트 pollution) |
| **B. inline mock 객체 주입**                 | 단일 테스트 격리, 트리거 모방 보존         | callsite 5 → 6+ 로 mock 객체 boilerplate 증가 |
| **C. 신규 stub 클래스 (FailingBatchRunsDb)** | 의도 명시적 + InMemoryBatchRunsDb pristine | 신규 파일 + 5 케이스 callsite 추가 부담       |

**Quality 권고: 옵션 B (inline mock 객체)** — 트리거 모방 = production lockstep 검증 책임 (다음 세션 F 작업). throw 시뮬레이션 = unit-level pollution 회피. 5 케이스 모두 `metaPersistenceFailures.length === 1 && metaPersistenceFailures[0].operation === 'state_failed'` 패턴이라 inline mock 30 라인 ×5 = 150 라인 정도. 옵션 A 은 InMemoryBatchRunsDb 내부에 테스트 전용 hook 노출 = 운영 코드 오염.

근거: 5 통합 테스트는 "정상 경로 e2e" 가 본질. throw 경로는 별도 test suite (`pipeline-integration-throw.test.ts` 같은) 에서 inline mock 으로 격리 = production 코드 변경 0.

### 4. 테스트 커버리지 매트릭스 — runPipeline 5 throw 시점 (사용자 질문 #4)

본 B1 의 5 throw 시점 vs e2e 매핑:

| throw 시점                                          | 위치 (pipeline.ts) | 권고 e2e 위치             | 본 세션 매핑 |
| :-------------------------------------------------- | :----------------- | :------------------------ | :----------: |
| `state='failed'` UPDATE throw → push                | line 535-544       | F (d1-trigger-verify) + B |     ❌ 0     |
| `state='in_progress'` UPDATE throw → push           | line 564-575       | F (d1-trigger-verify) + B |     ❌ 0     |
| `state='completed'` UPDATE throw → push             | line 582-595       | F (d1-trigger-verify) + B |     ❌ 0     |
| SIGINT `markBatchRunKilled` throw → push            | line 469-477       | D (signal-handlers)       |     ❌ 0     |
| `recoverBatch` 자체 throw (e.g. checkpoint corrupt) | line 403-419       | C (pipeline-integration)  |     ❌ 0     |

**Quality 결론**: 5 throw 시점 모두 **e2e 0건** — 본 B1 정정의 핵심 효과는 **다음 세션 4 새 파일 (C/D/E/F) 에서 일괄 검증** 의무. handoff-016 §3.1 작업이 본 매핑을 흡수해야 cap=2 정정 추가 회피.

### 5. `recoveryStatus` 검증 매트릭스 (사용자 질문 #5)

4 가능 literal vs e2e:

| RecoveryStatus literal | 본 세션 e2e            | 다음 세션 e2e                                |
| :--------------------- | :--------------------- | :------------------------------------------- |
| `no_checkpoint`        | ✅ 5 통합 테스트       | (이미 충분)                                  |
| `already_completed`    | ❌ 0 — buildSkipResult | **C (pipeline-integration) AC-R3 신규 의무** |
| `fully_recovered`      | ❌ 0                   | **C (pipeline-integration) AC-R1 신규 의무** |
| `partially_recovered`  | ❌ 0                   | C (pipeline-integration) — Phase 1 후반      |

**Quality 결론**: `already_completed` 와 `fully_recovered` 의 e2e 부재 = 본 정정의 Q-M-2 해결 effecitve 검증 0%. 다음 세션 C 작업이 **반드시** `recoveryStatus` 4 literal 모두 매핑 의무. (recovery_failed / concurrent_run_detected 는 throw 후 PipelineResult 미도달 — 별도 throw catch 검증).

### 6. production-quality.md 정합 (사용자 질문 #6)

본 정정의 4 새 try/catch wrap 정합 검증:

| 정합 항목                       | 검증                                                                                                                                                                                                                                    |
| :------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 빈 catch 0건                    | ✅ 4 catch 모두 `console.error` + push + 흐름 유지/상승.                                                                                                                                                                                |
| `console.warn/error` 사용       | ✅ 4 catch 모두 `console.error` ([Pipeline] prefix 일관).                                                                                                                                                                               |
| reason 보존                     | ✅ `err instanceof Error ? err.message : String(err)` 패턴 일관.                                                                                                                                                                        |
| `any` 타입 0건                  | ✅ catch 변수 `err`, narrowing 후 사용. 명시 `as` cast 0건.                                                                                                                                                                             |
| AppError 미사용 — graceful 폴백 | ⚠️ `MetaPersistenceFailure` 인터페이스로 구조화 — production-quality.md "에러 처리: AppError 사용" 권고와는 약간 미일치. 그러나 본 정정은 PipelineResult 의 metadata 필드 (throw 가 아니라 caller 가시성) — AppError 적용 대상 X. 정합. |

**Quality 결론**: 6/6 정합. 단 AppError 미사용은 **본 정정의 의도된 설계** (throw 가 아닌 PipelineResult metadata 필드).

### 7. expect 패턴 일관성 (사용자 질문 #7)

5 callsite 모두 `toEqual([])` 사용:

| 패턴                                                     | 가독성                                     | 깊이 검증                                                                                     |
| :------------------------------------------------------- | :----------------------------------------- | :-------------------------------------------------------------------------------------------- |
| `expect(result.metaPersistenceFailures).toEqual([])`     | "빈 배열" 의도 명확 + 직관적               | 정확한 빈 배열 (length=0 + 비-non-undefined) 검증                                             |
| `expect(result.metaPersistenceFailures).toHaveLength(0)` | "길이 0" 의도 명확 — 그러나 length 만 검증 | 길이만 검증 (배열이 아닌 length getter 가진 객체 통과) — `[1,2,3]` 의 mock object 통과 가능성 |

**Quality 권고: 현재 `toEqual([])` 유지** — 정확한 빈 배열 type identity 검증. 본 정정의 readonly 배열 보호와 정합 (mutated 후 length=0 인 mock 의 false PASS 차단).

### 8. Devil's Advocate 2건 이상 (사용자 질문 #8)

#### Devil's Advocate #1 — readonly 배열 mutation 우회 silent regression

`metaPersistenceFailures: readonly MetaPersistenceFailure[]` (`pipeline.ts:113`) 는 **TypeScript 컴파일 타임만 보호**. 런타임에는 `Object.freeze` 미적용 = vitest mock 패턴이 readonly 무시하고 직접 mutate 가능:

```typescript
const result = await runPipeline(ctx);
(result.metaPersistenceFailures as MetaPersistenceFailure[]).push({ ... });
expect(result.metaPersistenceFailures).toHaveLength(1);  // 통과 (silent regression)
```

위 패턴이 미래 테스트에 도입되면 production caller 가 metaPersistenceFailures mutate 시 silent regression. **권고**: pipeline.ts:614 의 `metaPersistenceFailures` 반환을 `Object.freeze(metaPersistenceFailures)` 또는 `[...metaPersistenceFailures]` defensive copy 로 변환. 0.05d 작업, 미래 회귀 차단. **본 정정에서 미반영 = MINOR**.

#### Devil's Advocate #2 — recovery.status type narrowing 미적용 future risk

`pipeline.ts:619` 의 `recoveryStatus: recovery.status` 에서 `recovery` 는 `RecoveryResult` 타입 (recover.ts:107-121). 본 정정은 `recovery.status` 를 narrowing 없이 raw RecoveryStatus union 으로 노출. 현재 5 통합 테스트는 `'no_checkpoint'` 단일 literal 만 expect — 미래 `'fully_recovered'` 테스트 추가 시:

```typescript
expect(result.recoveryStatus).toBe('fully_recovered'); // PASS
expect(result.recoveryStatus === 'fully_recovered' && result.checkpoint).toBeDefined(); // FAIL
// 이유: PipelineResult 에 checkpoint 필드 없음 — recovery.checkpoint 가 RecoveryResult 의 optional 필드
```

`PipelineResult` 가 `recoveryStatus` 만 노출 + `recovery.checkpoint` 는 미노출 = 미래 테스트가 checkpoint 검증 시 별도 access 경로 필요. **권고**: 다음 세션 C (pipeline-integration AC-R1) 작업 시 `PipelineResult.recoveryCheckpoint?: BatchCheckpoint` optional 필드 추가 검토. **본 정정에서 미반영 = MINOR (다음 세션 흡수 권고)**.

#### Devil's Advocate #3 — InMemoryBatchRunsDb vs D1 트리거 lockstep 깨질 위험

`in-memory-batch-runs-db.ts:104-112` 의 0015 트리거 invariant 모방은 코드 시점 하드 카피 — `migrations/0015_batch_runs.sql` 변경 시 자동 동기화 X. 미래 0015 트리거에 새 invariant 추가 시 (예: `state='killed' → resume_count++` 강제):

- InMemory PASS — 트리거 모방 안 함
- D1 RAISE(ABORT) — production 만 fail
- 137/137 PASS = production PASS 보장 X (lockstep 깨짐)

**권고**: F (d1-trigger-verify.test.ts) 작업이 better-sqlite3 e2e 로 0015 트리거 직접 검증 = lockstep 자동 검증 의무. **본 정정 자체의 결함 X 이나, 다음 세션 F 작업 누락 시 production silent failure 위험**.

---

## 분류 및 판정

### Critical: 0건

본 B1 정정 자체는 PipelineResult 인터페이스 + try/catch wrap + 6 callsite 일괄 갱신 = 명확한 정합. 빈 catch / stub / silent failure 0건. 137/137 PASS.

### Major: 1건

**Q-MAJOR-B1-1 — 정정 효과 검증 0% (e2e 부재)**:

- **이유**: `metaPersistenceFailures.push(...)` 4 시점 + `recoveryStatus` 3 literal (already_completed / fully_recovered / partially_recovered) 모두 e2e 0건. 137/137 PASS = "정상 경로 회귀 0건" 만 보장, **본 정정의 핵심 기능 (옵션 C 가시화) 효과 검증은 0%**.
- **해결**: 다음 세션 §3.1 C/D/F 작업이 본 매핑을 plan 에 흡수 의무. 추가 부담 ~95분 (handoff-016 §3.1 D/E/F/C 합계 0.95d 의 ~17%).
- **단독 차단 X**: 본 정정 자체는 PASS. 다만 "완료" 선언 시 "효과 검증은 다음 세션 의무" 명시 필수 — 진산님이 본 B1 만으로 완료 판단 시 false negative 위험.

### Minor: 3건

**Q-MINOR-B1-1 — readonly 배열 mutation 우회 (Devil's #1)**:

- pipeline.ts:614 의 metaPersistenceFailures 반환에 `Object.freeze` 또는 defensive copy 미적용. 미래 테스트 readonly 우회 시 silent regression 위험.
- 다음 세션 흡수 권고: B1 commit 후속 정리 묶음 / Step 18 contract verify 일괄.

**Q-MINOR-B1-2 — recovery.checkpoint 미노출 (Devil's #2)**:

- PipelineResult.recoveryStatus 만 노출, recovery.checkpoint optional 필드는 미노출. 미래 fully_recovered e2e 작성 시 checkpoint 검증 경로 부재.
- 다음 세션 흡수 권고: C (pipeline-integration AC-R1) 작업 시 `recoveryCheckpoint?: BatchCheckpoint` 필드 추가.

**Q-MINOR-B1-3 — A-MAJOR-1 reason sanitize 미적용**:

- metaPersistenceFailures.reason 이 err.message 그대로 캡처 — production D1 환경에서 sensitive info 노출 위험.
- Phase 1 진입 시 흡수 권고 (본 B1 정정 자체가 도입한 risk 아니나 새 노출 경로 추가).

### N/A: 2건

- Workers 제약 (pipeline.ts 는 Node.js 전용)
- Formula Engine 동적 코드 실행 (메타 영구화 영역과 무관)

---

## 판정

**판정: 완료 가능 (조건부)**

**조건**:

1. 본 B1 PASS 는 "정상 경로 회귀 0건" 의 객관적 사실까지만 보장.
2. **"옵션 C 정정 효과 검증" 은 다음 세션 §3.1 C/D/F 작업의 의무** — Q-MAJOR-B1-1 의 7 매핑 (5 throw 시점 + 2 RecoveryStatus literal) 다음 세션 plan 에 명시 흡수 의무.
3. Q-M-2 (already_completed false negative) 는 본 B1 + bin/batch.ts:229 분기로 정합 해결 — 그러나 **e2e 검증 0건** = 다음 세션 C 작업 의무.
4. MINOR 3건은 본 commit 직후 cleanup 또는 Step 18 contract verify 묶음 흡수 권장.

**다음 세션 진입 직후 첫 5~10분 plan 갱신 권고**:

- handoff-016 §3.1 C 작업에 "AC-R3 already_completed + AC-R1 fully_recovered (recoveryStatus 검증)" 명시
- handoff-016 §3.1 D 작업에 "AC-R4 SIGINT markBatchRunKilled throw → metaPersistenceFailures push" 명시
- handoff-016 §3.1 F 작업에 "AC-R6 + AC-RP-6 — 0015 트리거 throw → 3 metaPersistenceFailures push (state_failed / state_in_progress / state_completed)" 명시

**4-Pass 통합 보고서 (silent-failure / system-architect / quality) 모두 PASS 시 cap=2 회피 — 본 정정의 후속 검증을 다음 세션 9 AC e2e 작업에 흡수**.

---

## 리뷰 메타

- 리뷰 시간: ~25분 (파일 7개 + plan / handoff 1차 읽기 + 매트릭스 작성)
- 자체 점검: 자가 리뷰 편향 차단 — 메인 대화 모름. 137/137 PASS 의 "객관 사실" vs "효과 검증" 갭 명확 분리.
- 증거 기반 보고: ✅ 5 + ✅ 5 + ✅ 5 + ✅ 6 = 21 확인 항목 + 파일:라인 명시.
- 반론 의무: Pass 1~4 각 1건 + 별도 Devil's Advocate 3건 = **7 반론**.
- Critical 0건 객관 + Major 1건 (효과 검증 갭) + Minor 3건 = 본 정정 PASS, 다음 세션 흡수 의무 명시.
