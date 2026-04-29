---
리뷰 방식: 독립 에이전트 (quality-engineer)
리뷰 일시: 2026-04-29 KST
리뷰 대상: Step 11.6 cap=2 정정 — SF-C-1 + SA-M-2 (Session 017)
리뷰자 컨텍스트: 메인 대화 모름 (의도 편향 차단)
---

## 0. 리뷰 범위 — 변경 2 + 연관 5

### 변경 파일 (cap=2 정정 대상)

| #   | 파일                         | 라인          | 변경 요약                                                                                           |
| --- | ---------------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| 1   | `apps/batch/src/pipeline.ts` | 537-549       | finally 블록 `removeHandlers()` try/catch wrap + 기존 `costMeter.finalize()` inner try 유지         |
| 2   | `apps/batch/bin/batch.ts`    | 26-27, 67-101 | `ConcurrentRunError`/`RecoveryFailedError` import + main catch 분기 (exit 4/5) + ExitCode 타입 확장 |

### 연관 파일 (테스트 커버리지 평가용)

- `apps/batch/src/signal-handlers.ts` (1-56) — `installSignalHandlers` 반환 cleanup 함수의 throw 가능성 (SF-C-1 정정 대상 함수)
- `apps/batch/src/__tests__/pipeline.integration.test.ts` (1-393, 5 tests) — 기존 통합 테스트, `enableSignalHandlers: false` 고정
- `apps/batch/__tests__/recover.test.ts` (8 tests) — `concurrent_run_detected`/`recovery_failed` 상태 반환 테스트 (Error throw 경로 미커버)
- `apps/batch/__tests__/cost-meter.test.ts` (31 tests) — finally `costMeter.finalize()` 인접 검증
- `apps/batch/__tests__/checkpoint.test.ts` — checkpoint write/read 인접

### 객관 사실 (검증 재실행)

- `pnpm -C apps/batch test` → **9 files / 137 tests PASS / 1.50s**
- `pnpm -C apps/batch typecheck` (Session 017 보고) → 0 errors

---

## 1. 4-Pass — quality-engineer 단일 관점

### Pass 1 (Surgeon — 회귀 0건 검증): ✅ 4건 확인 / 🔴 0건 / 🟠 0건 / 🟡 2건 / N/A 0건

**관점:** 137 PASS 는 객관. 본 정정 2건의 **새 동작 경로** 가 기존 137 테스트로 실제 커버되는가?

**확인 (PASS):**

1. **`apps/batch/src/pipeline.ts:538-542`** — finally 블록의 `removeHandlers()` try/catch wrap. 기존 137 테스트는 모두 `step116TestFields(outDir)` 의 `enableSignalHandlers: false` 를 사용 (`pipeline.integration.test.ts:47`). 따라서 `pipeline.ts:416-442` 의 ternary 가 `() => { /* test mode */ }` no-op 함수를 반환 — **try 블록 진입은 하나, throw 경로는 절대 실행되지 않음.** 그러나 정정 이전 코드도 finally 직접 호출이었고, no-op 호출은 throw 불가능하므로 **회귀 위험 0**. 함수 호출 자체의 정상 종료는 137 테스트 전수가 검증한다 (모든 통합 테스트가 `runPipeline` 정상 반환을 확인).

2. **`apps/batch/src/pipeline.ts:543-548`** — `costMeter?.finalize()` inner try/catch 는 변경 없음 (기존 구조 유지). 37/37 cost-meter 테스트 (`cost-meter.test.ts`) 가 finalize 동작을 별도 단위로 검증.

3. **`apps/batch/bin/batch.ts:81-101`** — main try/catch 는 `cmdRun`/`cmdStatus`/`cmdList` 반환을 await 후 `instanceof` 분기. 이 진입점은 CLI 실행 코드이며 본 137 테스트는 vitest 가 `runPipeline` 을 직접 호출하므로 **batch.ts main 자체가 임포트 / 실행되지 않는다.** (정상 — 본 정정의 instanceof 분기는 unit test 가 아닌 e2e CLI 테스트 영역.)

4. **`apps/batch/bin/batch.ts:72`** — ExitCode 타입 `0 | 1 | 2 | 4 | 5` 확장. typecheck PASS = `cmdRun`/`cmdStatus`/`cmdList` 반환값이 모두 ExitCode 유니온에 속한다는 컴파일 시 보장. 회귀 없음.

**Critical / Major / Minor:**

- 🟡 **Q-MINOR-A** — `pipeline.ts:540` try/catch 내 console.error 메시지 "(logged only)" 는 silent failure 방지 차원 양호. 다만 **stack trace 미포함** (`err.stack` 출력 없음) — `costMeter.finalize()` (line 547) 와 동일 패턴으로 일관성은 유지. **권고:** 이연 (대칭성 OK).
- 🟡 **Q-MINOR-B** — 137 테스트는 `enableSignalHandlers: false` 만 검증 → SF-C-1 의 **방어 가치 자체가 검증되지 않는다.** 즉 정정 코드는 "회귀 0건" 이지만 "효과 0건 검증" 이기도 하다. **다음 세션 §3.1 D (signal-handlers.test.ts)** 에서 의무 흡수 (아래 Pass 2 §2 참조).

**반론 (Devil's Advocate):**

> 137 PASS 는 정정 코드의 **dead branch** 를 통과시키는 결과일 뿐, 정정의 실효성 (handler removal throw 시 finalize 도달 보장) 을 증명하지 않는다. 만약 미래에 누군가 `pipeline.ts:416-442` 의 ternary 분기를 제거해 production 모드로 전환하면, 그 시점에서 `removeHandlers()` 가 `process.off` 내부 throw 를 발생시킬 silent regression 이 잠재해 있을 수 있다 (Node 이벤트 emitter 내부 변경 / 메모리 압박 시 listener registry 손상 시나리오). **즉 본 정정은 "테스트로 보장된 안전" 이 아니라 "코드 리뷰 만으로 보장된 안전".** Pass 2 §2 권고 충족 전에는 SF-C-1 이 **재발 가능 클래스 결함** 으로 남는다.

---

### Pass 2 (Architect — e2e 커버리지 갭 + 테스트 배치): ✅ 3건 확인 / 🔴 0건 / 🟠 1건 / N/A 0건

**관점:** handoff-016 §3.1 의 9 AC e2e 작성 (다음 세션 §3.1 C~G) 시 본 cap=2 정정 검증을 어디에 포함해야 하는가?

**확인 (PASS):**

1. **`signal-handlers.test.ts` 적합성 (handoff-016 §3.1 D 0.15d)** — handoff-016 §3.1 D 는 "signal-handlers.test.ts 신규 (AC-R4 SIGINT/SIGTERM 격리)" 로 명시. **SF-C-1 정정의 핵심 시나리오 (cleanup 함수가 throw 했을 때 outer catch 가 흡수)** 는 본 파일 안에서 unit-level 로 검증 가능. 권고 케이스:
   - "cleanup 함수가 throw 해도 calling code 가 정상 종료한다" (SF-C-1 직접 검증) — `installSignalHandlers` 모킹 후 `process.off` stub 이 throw 시나리오.
   - 단, 현재 `installSignalHandlers` 의 cleanup 은 `process.off` 만 호출 (signal-handlers.ts:53-54). Node 표준 `process.off` 는 throw 하지 않으므로, 이 시나리오는 **production 코드 단독으로 재현 불가** — vitest mock 이 필수 (`vi.spyOn(process, 'off').mockImplementation(() => { throw ... })`).

2. **`pipeline-integration.test.ts` 부적합성 (SF-C-1)** — 통합 테스트는 `enableSignalHandlers: false` 를 사용 → no-op cleanup 반환. `removeHandlers()` 가 throw 하는 경로 자체를 만들 수 없다. **결론: SF-C-1 정정은 integration 이 아닌 signal-handlers 단위 테스트가 적격.**

3. **SA-M-2 (ConcurrentRunError/RecoveryFailedError exit code) 적합 위치** — 본 정정의 `instanceof` 분기는 `bin/batch.ts` main 안에 있다. 137 기존 테스트는 vitest 가 `runPipeline` 을 직접 호출 (batch.ts 미경유). **권고: 신규 `bin/batch.cli.test.ts`** 또는 handoff-016 §3.1 G (CLI exit code matrix e2e) 에서 흡수. 후보 시나리오:
   - state='in_progress' < 24h 인 batch_runs 행 시드 → `tsx bin/batch.ts run BATCH-1 --fixtures` → exit code === 4 검증.
   - tampered checkpoint 생성 → 동일 명령 → exit code === 5 검증.
     `recover.test.ts:238-263` 은 `recoverBatch` 가 status 'concurrent_run_detected' 를 반환함을 검증하나 — **status → throw → CLI exit 매핑 (3-step chain) 은 미커버.**

**Critical / Major / Minor:**

- 🟠 **Q-MAJOR-1 (커버리지 갭)** — SA-M-2 정정의 instanceof 분기 (`batch.ts:98-99`) 는 현재 137 테스트로 도달 0건. handoff-016 §3.1 D~G 의 e2e 작성 시 **반드시 CLI exit code === 4 / === 5 의 시나리오 2건이 포함되어야 한다.** 누락 시 정정 코드가 dead 라는 시각적 증거 부재 = 회귀 시 알 수 없음.
  **권고:** handoff-016 §3.1 G 항목에 명시 추가 또는 별도 sub-task 로 등록. cap=2 정정 자체의 e2e 의무는 다음 세션 §3.1 G 에서 흡수 (본 cap=2 작업의 추가 의무 아님 — 본문 단서 충족).

**반론 (Devil's Advocate):**

> "test pyramid" 관점에서 instanceof 분기는 unit test 로도 충분하지 않은가? 즉 `import { ... } from '../bin/batch'` 후 main 함수를 직접 호출 + 의존성 모킹 하면 된다. **그러나 batch.ts 는 module-level top 에서 `main().then(code => process.exit(code))` 를 즉시 실행** (line 425-431) → import 자체가 process 종료 부작용. 따라서 batch.ts 는 **subprocess spawn (e2e) 외 테스트 경로 없음.** 이는 architecture 결함의 잠재 (테스트 가능성 부족) 이지만 본 cap=2 범위 외. handoff-016 §3.1 G 가 subprocess 기반 e2e 임을 가정하고 진행해야 한다.

---

### Pass 3 (Advocate — 테스트 가독성 / 모킹 부담): ✅ 3건 확인 / 🔴 0건 / 🟠 0건 / 🟡 1건 / N/A 0건

**관점:** 정정이 테스트 작성 부담 / 모킹 부담을 늘리는가?

**확인 (PASS):**

1. **finally try/catch 구조의 테스트 가능성** — Vitest 표준 `vi.spyOn(...).mockImplementation(throw)` 패턴으로 검증 가능. 모킹 부담 낮음 (3-5줄 추가). 예시:

   ```ts
   vi.spyOn(process, 'off').mockImplementationOnce(() => {
     throw new Error('x');
   });
   // → installSignalHandlers().() 호출 → throw 흡수 + console.error 검증
   ```

2. **batch.ts CLI 진입점의 e2e 부담** — `import { spawn } from 'node:child_process'` + `tsx bin/batch.ts ...` subprocess 패턴. 1-2초 stake (tsx cold start). 137 단위 테스트 1.5초 대비 **e2e 5-7건 추가 시 10초 미만 예상.** 부담 허용 범위.

3. **production-quality.md 정합 — 빈 catch 0건** — 정정 2건 모두 `console.error(...)` 출력 포함 → silent failure 0건 (production-quality.md "빈 catch 0건" 위반 없음). dev-guide.md "빈 catch 금지 — 에러 로깅 + 전파/폴백" 정합. ✅

**Critical / Major / Minor:**

- 🟡 **Q-MINOR-C** — `batch.ts:97` `if (err instanceof Error && err.stack) console.error(err.stack);` 는 정정 이전부터 있던 코드. **ConcurrentRunError 와 RecoveryFailedError 는 모두 `Error` extends 이므로 stack 출력 OK.** 다만 운영자가 stack trace 만으로 "concurrent" 인지 "recovery_failed" 인지 즉시 판별 어려움 → 정정으로 추가된 exit code 4/5 분기가 운영적 가독성을 보강함. ✅ Devil's advocate 반박 가능 (다음 항목 참조).

**반론 (Devil's Advocate):**

> 정정으로 stack trace 가 그대로 출력된 채 exit 4/5 가 추가되었다 — 운영자가 잡을 신호는 (a) 마지막 줄 exit code 와 (b) 첫 줄 `[thepick-batch] ERROR: <msg>` 두 가지. **그러나 stack 출력은 두 줄 사이에 끼어** 가독성 저해 가능. **추가로 ConcurrentRunError 메시지 (`recoverBatch` 의 `recovery.message` 그대로 전파) 가 운영자에게 즉시 의미 전달 가능한가?** 메시지 포맷 검증 부재. **권고:** 다음 세션 §3.1 G 시 e2e 에서 stderr 출력 contains 'ConcurrentRunError' 또는 명시적 운영 가이드 문구 검증 추가. 본 cap=2 범위 외 — Q-MINOR.

---

### Pass 4 (Contract — production-quality.md / CLAUDE.md 정합): ✅ 4건 확인 / 🔴 0건 / 🟠 0건 / 🟡 0건 / N/A 0건

**관점:** 정정이 ThePick 상용 품질 원칙 / CLAUDE.md / auto-review-protocol.md 와 정합한가?

**확인 (PASS):**

1. **production-quality.md "빈 catch 금지"** — 본 정정 2건 모두 catch 블록에 `console.error(...)` 포함 (`pipeline.ts:541, 547`; `batch.ts:96-99`). ✅ 위반 없음.

2. **CLAUDE.md "console.warn/error + 구조화 로깅"** — `console.error` 사용 (`console.log` 아님) → debugging 출력 분리 원칙 정합. quality-gate.sh 훅의 console.log 검출 대상 외. ✅

3. **CRITICAL RULE #3 "try-catch 에서 데이터 조용히 삭제 금지 — 로깅 + 에러 전파/폴백"** — `pipeline.ts:540-542` 정정은 **로깅 후 에러 흡수** 패턴. **전파 생략에 정당성 있는가?** finally 블록은 (a) 정상 경로 (성공 후 cleanup) 와 (b) 예외 경로 (try 안 throw 후 cleanup) 모두 진입 → finally 안 throw 는 **try 의 원본 throw 를 silent 하게 덮어씀** (JavaScript 사양). 따라서 본 정정은 **CRITICAL RULE #3 준수** (원본 throw 를 보존하기 위해 finally 내 throw 흡수 필수). ✅ 정당.

4. **auto-review-protocol.md "cap=2 규칙"** — Session 017 본 정정은 직전 4-Pass 의 CRITICAL 3건 중 SF-C-1 + SA-M-2 = 2건 (cap=2 한도). 잔여 1건 (SF-C-2 — 진산님 결정 대기) 명시 이연. ✅ 프로토콜 정합.

**Critical / Major / Minor:** 0건.

**반론 (Devil's Advocate):**

> finally 안 throw 흡수 (CRITICAL RULE #3 정당화) 는 옳다. 그러나 `removeHandlers()` 가 만약 **데이터 일관성에 영향** 을 주는 작업 (예: D1 connection close, file lock release) 으로 미래에 확장된다면, 본 try/catch 흡수가 silent failure 로 변질된다. **즉 본 정정의 안전성은 `signal-handlers.ts:52-55` 의 cleanup 이 영원히 "process listener removal 만" 한다는 약속에 의존한다.** **권고:** `signal-handlers.ts` cleanup 함수에 JSDoc `@invariant: 본 함수는 process listener removal 외 데이터 영향 작업을 수행하지 않는다` 추가. 본 cap=2 범위 외 (다음 세션 또는 후속 정리).

---

## 2. 본 정정 2건의 quality 영향 — 종합 판정

### 분류 요약 (cap=2 범위 한정)

| 분류        | 개수 | 항목                                                                                                            |
| ----------- | ---- | --------------------------------------------------------------------------------------------------------------- |
| 🔴 CRITICAL | 0    | —                                                                                                               |
| 🟠 MAJOR    | 1    | Q-MAJOR-1 (SA-M-2 instanceof 분기 e2e 갭 — 다음 세션 §3.1 G 에서 흡수 예정)                                     |
| 🟡 MINOR    | 3    | Q-MINOR-A (stack trace 누락 양 finally), Q-MINOR-B (SF-C-1 효과 검증 부재), Q-MINOR-C (운영 가독성 메시지 포맷) |

### 회귀 검증 (객관)

- ✅ 137/137 PASS (1.50s) — 회귀 0건 객관 확정.
- ✅ typecheck 0 errors (Session 017 보고 / 직접 미재실행하나 137 PASS 가 typecheck PASS 의 종속 확인).
- ⚠️ 137 테스트는 cap=2 정정의 **새 경로** (removeHandlers throw 흡수, instanceof 분기) 를 0건 도달. → "회귀 없음" ≠ "정정 효과 검증". **다음 세션 §3.1 D + G 에서 의무 흡수 필요.**

### Devil's Advocate 종합

본 cap=2 정정 2건은 **방어적 코딩 (defensive programming)** 의 전형 — 현재 코드 경로상 실제 발생 가능성 낮으나 미래 회귀 시 silent failure 차단. **그러나 137 회귀가 PASS 한다는 사실은 본 정정의 효과를 증명하지 않는다.** 정정 효과를 증명하려면 다음 시나리오의 e2e 또는 단위 테스트가 추가되어야 한다:

- (a) `removeHandlers()` throw 시 finally 가 정상 종료 + costMeter.finalize 도달 검증 (signal-handlers.test.ts) — handoff-016 §3.1 D
- (b) ConcurrentRunError throw → CLI exit 4 검증 (CLI e2e) — handoff-016 §3.1 G
- (c) RecoveryFailedError throw → CLI exit 5 검증 (CLI e2e) — handoff-016 §3.1 G

본 cap=2 작업 자체의 e2e 추가 의무는 본문 단서대로 다음 세션에서 흡수.

추가 silent regression 가능성 점검:

- ❌ **stdout assertion 깨짐 가능성** — 본 정정으로 추가된 `console.error('[Pipeline] removeHandlers 실패 ...')` 는 **try 안 throw 시에만** 출력. 137 테스트는 throw 경로 미진입 → stdout/stderr 라인 수 변화 0. ✅ 회귀 없음.
- ❌ **vitest mock signal handler 동작 변경** — 본 정정은 `installSignalHandlers` 내부 미수정, finally 블록 wrapping 만. mock 영향 0. ✅
- ❌ **ExitCode 타입 확장으로 caller 영향** — `cmdRun`/`cmdStatus`/`cmdList` 모두 0/1/2 만 반환 (typecheck PASS 가 증거). exit 4/5 는 main catch 에서만 결정 → ExitCode 확장이 다른 함수에 영향 0. ✅

### 판정

**완료 가능 (cap=2 범위 한정)**

- 🔴 CRITICAL 0건 (cap=2 정정 자체 결함 없음)
- 🟠 MAJOR 1건 (Q-MAJOR-1) 은 본 cap=2 작업 외 — 다음 세션 §3.1 G 에서 의무 흡수 명시
- 🟡 MINOR 3건 (Q-MINOR-A/B/C) — 보고만, 즉시 수정 불요

본 정정은 회귀 0건 객관 확정 + production-quality.md / CRITICAL RULE #3 정합. **단, "회귀 없음" 판정과 "정정 효과 검증" 은 분리된 사실이며, 후자는 다음 세션 §3.1 D (signal-handlers.test.ts) + G (CLI exit code matrix) 에서 의무 흡수 필요 (핸드오프 명시).**

---

## 3. 다음 세션 §3.1 권고 (cap=2 작업 외 흡수 항목)

본 quality-engineer 관점에서 다음 세션 진입 시 핸드오프에 명시 반영 권고:

| 우선 | 항목                                      | 위치                                               | 의도                                                                    |
| ---- | ----------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| C0   | signal-handlers.test.ts 신규              | apps/batch/src/**tests**/                          | SF-C-1 정정 효과 직접 검증 (mock process.off throw → finally 정상 종료) |
| G1   | CLI exit code 4 (ConcurrentRunError) e2e  | apps/batch/**tests**/cli-exit-codes.test.ts (신규) | SA-M-2 정정 효과 직접 검증 (subprocess spawn)                           |
| G2   | CLI exit code 5 (RecoveryFailedError) e2e | 동상                                               | SA-M-2 정정 효과 직접 검증                                              |

세 항목 모두 cap=2 정정 효과 검증의 의무 — 본 작업의 추가 부담 아닌 다음 세션 §3.1 흡수.

---

## 4. 결론 — 한 줄 보고

cap=2 정정 2건은 회귀 0건 (137/137 PASS) + production-quality.md 정합 + CRITICAL RULE #3 (finally throw 흡수) 정당. **단 정정 효과의 직접 검증은 다음 세션 §3.1 D + G 에 위임됨을 명시.** CRITICAL 0건 = **완료 가능**.
