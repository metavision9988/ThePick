---
리뷰 방식: 독립 에이전트 (silent-failure-hunter)
리뷰 일시: 2026-04-29 KST
리뷰 대상: Step 11.6 cap=2 정정 — SF-C-1 + SA-M-2 (Session 017)
리뷰자 컨텍스트: 메인 대화 모름 (의도 편향 차단)
---

# Step 11.6 cap=2 정정 — Silent-Failure-Hunter 독립 리뷰

## 리뷰 범위

**변경 파일 (전수 검증):**

- `apps/batch/src/pipeline.ts:537-549` — finally 블록 `removeHandlers()` outer try/catch wrap
- `apps/batch/bin/batch.ts:23-30` — `ConcurrentRunError` / `RecoveryFailedError` 임포트
- `apps/batch/bin/batch.ts:72` — `ExitCode` 타입 확장 (`0|1|2` → `0|1|2|4|5`)
- `apps/batch/bin/batch.ts:94-101` — main catch 분기 추가 (`instanceof` 체크 + return 4/5)

**연관 파일 (검증 위해 참조):**

- `apps/batch/src/signal-handlers.ts:34-56` — `installSignalHandlers` / cleanup 함수의 throw surface
- `apps/batch/src/recover.ts:65-80, 270-292` — `BatchRunsDb` 인터페이스 + recovery success 분기
- `apps/batch/src/pipeline.ts:294-316` — `ConcurrentRunError` / `RecoveryFailedError` 클래스 정의
- `apps/batch/src/pipeline.ts:381-389` — recover() 결과 분기 throw 위치
- `apps/batch/bin/batch.ts:425-431` — main().then(...) top-level promise rejection handler

**스킵 사유 (이전 4-Pass 가 다룬 항목):**

- `SF-CRITICAL-2` (signal handler markBatchRunKilled fire-and-forget) — 본 cap=2 대상 아님
- `SF-CRITICAL-3` (state='failed' UPDATE silent) — 본 cap=2 대상 아님 (단, line 499-502 catch 의 console.error 가시화는 이미 있음 확인)
- `SF-MAJOR-1~4` 일괄 — 다음 세션 이월 사항

---

## Pass 1 — Surgeon (Bottom-Up, 정정 코드 정합성)

**관점:** "이 정정이 단독으로 새 silent failure 를 도입했는가?"

### ✅ 확인 (4건)

1. **`pipeline.ts:537-542` — finally 의 try/catch wrap 적용 검증**

   ```typescript
   } finally {
     try {
       removeHandlers();
     } catch (err) {
       console.error('[Pipeline] removeHandlers 실패 (logged only):', err);
     }
     if (ctx.costMeter) { ... }
   }
   ```

   `removeHandlers` 가 throw 해도 `console.error` 로 가시화 후 다음 분기 (`costMeter.finalize`) 실행됨. 빈 catch 아니며 (CRITICAL RULE #3 준수), 에러 객체 그대로 전달 (stack trace 보존).

2. **`signal-handlers.ts:52-55` — cleanup 함수가 실제로 throw 가능한가 surface 분석**
   cleanup 클로저는 `process.off('SIGINT', sigintHandler)` 와 `process.off('SIGTERM', sigtermHandler)` 두 줄. Node.js `process.off` 는 이론적으로 throw 하지 않지만 (EventEmitter.removeListener), `process` 객체가 monkey-patched 되거나 frozen 된 환경(테스트 격리 / VM2 / 일부 sandbox)에서 throw 가능. 따라서 wrap 은 **방어적이며 정당**.

3. **`pipeline.ts:543-549` — 두 finally 분기 격리 확인**
   `removeHandlers` try/catch 와 `costMeter.finalize` try/catch 가 **각자 독립 try/catch** 로 분리됨. 한쪽이 throw 해도 다른 쪽 영향 없음. 순서도 의도대로: 시그널 핸들러 먼저 떼고 → 비용 메트릭 마감.

4. **`batch.ts:94-101` — main catch 의 console.error 출력 순서 검증**
   ```typescript
   } catch (err) {
     const msg = err instanceof Error ? err.message : String(err);
     console.error(`[thepick-batch] ERROR: ${msg}`);
     if (err instanceof Error && err.stack) console.error(err.stack);
     if (err instanceof ConcurrentRunError) return 4;
     if (err instanceof RecoveryFailedError) return 5;
     return 1;
   }
   ```
   `console.error` 는 분기 **이전에 1회만** 출력 (msg + stack). 분기에서 추가 console.error 없음 → **이중 출력 risk 0건**. exit code 만 분기, 로깅은 일관.

### 🔴 Critical (0건)

새 silent failure 도입 없음.

### 🟠 Major (1건)

**SF-M-NEW-1 — `pipeline.ts:540` console.error 가 logger 가 아닌 직접 출력 (관찰성 부채)**

- 위치: `apps/batch/src/pipeline.ts:541, 547`
- 증상: 정정으로 추가된 두 console.error 가 직접 stderr 로 출력. 프로젝트는 production-quality.md §"console.log 디버깅 → console.warn/error + 구조화 로깅" 권고. `removeHandlers` 실패는 운영자가 grep 으로 추적해야 하는 사고 (시그널 핸들러 누수 = 좀비 프로세스).
- 영향: cap=2 정정 본질은 OK 이나, 추후 logger 도입 시 일관성 위해 `logError` 또는 동등 추상화 사용 필요.
- 권고: cap=2 외 이연 사항으로 분류. 본 정정의 silent failure 본질은 해결되었음.

### 🟢 Minor (1건)

**SF-m-NEW-1 — `pipeline.ts:541` 메시지 "(logged only)" 의 맥락 부족**

- 위치: `apps/batch/src/pipeline.ts:541`
- 증상: `[Pipeline] removeHandlers 실패 (logged only)` — "logged only" 만으로는 운영자가 "재실행 가능한가? 위험한가?" 판단 불가. SIGINT/SIGTERM 핸들러가 leak 되면 프로세스 재기동 후 stale handler 가 영향 미칠 수 있다는 맥락 누락.
- 권고: `'[Pipeline] removeHandlers 실패 (logged only — 다음 실행 시 핸들러 누수 가능, 운영자 검토 권장):'` 식으로 보강. 본 정정 후속 PR 사항.

### Devil's Advocate

**시나리오: `removeHandlers` 가 sync throw 가 아닌 async / microtask 에서 reject 한다면?**

- `signal-handlers.ts:52` cleanup 함수는 sync (Promise 반환 X). `process.off` 는 sync API. 따라서 본 정정의 try/catch 는 **sync throw 만 catch** 한다.
- 만약 향후 누군가 cleanup 클로저에 `await` 를 추가하거나 `Promise` 반환으로 변경하면, 본 try/catch 는 unhandled rejection 을 차단하지 못한다 (sync catch 가 async reject 를 못 잡음).
- **현시점 정정은 안전** — `process.off` 는 영구 sync API. 단, signal-handlers.ts cleanup signature 가 `() => void` 임을 회귀 테스트로 고정할 가치 있음.

---

## Pass 2 — Architect (정정과 주변 모듈 상호작용)

**관점:** "정정이 다른 catch / handler 와 만나서 silent failure 를 만드는가?"

### ✅ 확인 (3건)

1. **`pipeline.ts:381-389` recover() 분기 throw 와 `bin/batch.ts:98-99` instanceof 체크 동기화**
   - `runPipeline` 은 recover() 결과로 `ConcurrentRunError` (line 385) / `RecoveryFailedError` (line 388) 를 직접 `throw new` 한다.
   - `bin/batch.ts:98-99` 의 `instanceof` 는 **동일한 export 된 클래스** 를 import (line 26-27 에서 `from '../src/pipeline'`).
   - **동일 모듈 인스턴스 보장** → instanceof 항상 true. 이 시점에 silent miscategorization 없음.

2. **`bin/batch.ts:425-431` top-level main().then 의 reject path 와 main catch 의 분리 확인**

   ```typescript
   main().then(
     (code) => process.exit(code),
     (err) => {
       console.error('[thepick-batch] FATAL:', err);
       process.exit(1);
     },
   );
   ```

   - main() 내부 try/catch 가 모든 throw 를 catch 하므로 (line 81-101), top-level reject 로 빠지는 건 main() 자체가 throw 한 경우뿐.
   - `cmdRun` 의 finally `localDb?.close()` (line 217) 가 throw 하면 main() throw → top-level reject → exit 1 (4/5 가 아닌). **silent miscategorization 가능성 1건** — 단 이는 cap=2 대상이 아니며 기존 동작 유지.
   - **본 정정에 의한 새 silent failure 는 없음.**

3. **`recover.ts:270-292` fully_recovered 경로의 `updateState` throw 처리 검증**
   - `recoverBatch` 내부에서 `batchRunsDb.updateState({ state: 'recovered' })` 호출 (line 275-278). 이 호출이 throw 하면 `recover()` 가 reject → `runPipeline` line 373 의 `await recoverBatch` 로 전파.
   - 이 throw 는 `ConcurrentRunError` / `RecoveryFailedError` 둘 다 아닌 generic Error. `bin/batch.ts:98-99` instanceof 체크 모두 false → **return 1** (의도된 동작). silent failure 아님.

### 🔴 Critical (0건)

### 🟠 Major (0건)

### 🟢 Minor (1건)

**SF-m-NEW-2 — 정정 후 ExitCode 4/5 는 문서화되었으나 README/CHANGELOG 미반영 가능성**

- 위치: `bin/batch.ts:67-72` 주석
- 증상: exit code 4/5 의미가 코드 주석으로만 존재 (`주석`). 운영자 매뉴얼에 명시되지 않으면 CI 스크립트가 4/5 를 일반 실패로 처리할 위험.
- 권고: README 또는 운영 가이드 갱신 (cap=2 외 사항).

### Devil's Advocate

**시나리오: ESM/CJS dual-package hazard — instanceof check race**

- 만약 `pipeline.ts` 가 ESM 으로 빌드되고 `batch.ts` 가 CJS 로 빌드되어 **다른 module instance** 가 로드된다면, `ConcurrentRunError` 클래스가 두 번 정의되어 instanceof false 가 되어 exit 1 fallthrough.
- **현 시점 검증 결과 안전:** `apps/batch/package.json` + tsconfig 가 단일 ESM 경로 (`.js` import suffix 사용 — `'./recover.js'`). instanceof 안전.
- **잠재 위험:** 추후 packaging 변경 시 본 정정의 instanceof 체크가 silent fallthrough 할 수 있다. 회귀 테스트로 `expect(err instanceof ConcurrentRunError).toBe(true)` 고정 권장.

---

## Pass 3 — Cross-Cutting (본 정정의 silent surface 전수)

**관점:** "정정 외 부수 효과로 silent drop / fire-and-forget / catch-and-ignore 가 도입되었는가?"

### ✅ 확인 (3건)

1. **finally 의 try/catch 두 분기 모두 빈 catch 아님 (CRITICAL RULE #3 준수)**
   - line 540-542: `console.error` 출력 후 throw 미전파 (의도된 swallow)
   - line 546-548: `console.error` 출력 후 throw 미전파 (의도된 swallow)
   - 둘 다 가시화 + 근거 주석 (`logged only`) 존재 → silent failure 아님.

2. **main catch 의 console.error 가 분기 이전에 출력 → 모든 에러 가시화 보장**
   - `bin/batch.ts:96-97` 의 `console.error(msg)` + `console.error(stack)` 이 **분기 이전** 실행.
   - 어떤 exit code (1/4/5) 든 stderr 에 동일하게 가시화됨. 운영자가 exit 4/5 를 받아도 메시지를 보고 원인 파악 가능.

3. **recover() 결과 → throw 사이의 추가 silent drop 없음**
   - `pipeline.ts:381-389` 에서 `already_completed` 는 `buildSkipResult` 정상 반환 (skip 인지 가능 — 모든 stage 'skipped' status), `concurrent_run_detected` / `recovery_failed` 는 throw → bin/batch.ts catch 에서 instanceof 분기.
   - 어떤 분기도 silent drop 없음. status 객체 자체가 message 필드 보유 → throw 시 원본 message 전파됨.

### 🔴 Critical (0건)

### 🟠 Major (0건)

### 🟢 Minor (0건)

### Devil's Advocate

**시나리오: 사용자가 `Ctrl+C` 를 finally 진입 직후 한 번 더 누른다면?**

- 첫 SIGINT → handler 실행 (signal-handlers.ts:35-44) → flushCheckpoint() 호출 + process.exit(130).
- 만약 두 번째 SIGINT 가 첫 SIGINT 의 handler 내부 (flushCheckpoint 실행 중) 에 도착한다면? Node 의 default SIGINT handler 가 즉시 종료 → `removeHandlers` 호출 못 함.
- **본 cap=2 정정과 무관** — finally 블록은 정상 종료 경로용. signal handler 경로의 race 는 별도 이슈 (이전 SF-CRITICAL-2 와 관련).
- 단, 본 정정의 try/catch wrap 이 이 race 를 악화시키지는 않음 (오히려 정상 경로 robustness 향상).

**시나리오: VM2 / vitest 격리 환경에서 process.off 가 throw 한다면?**

- 본 정정 직전에는 finally 가 throw → outer catch 부재로 unhandled rejection.
- 본 정정 직후에는 console.error 후 흐름 계속 → costMeter.finalize 실행 + 정상 return.
- **명시적 개선 사례 — silent failure 차단됨.** Devil's Advocate 가 정정의 정당성을 강화하는 결과.

---

## Pass 4 — Contract (정정 의도 vs Plan 정합성)

**관점:** "정정이 plan v1.1 의 의도와 일치하는가? 새 stub / TODO / placeholder 도입 여부?"

### ✅ 확인 (3건)

1. **plan §5.3 (signal handler 등록 + cleanup 책임) 와 정정 정합성**
   - plan 은 finally 블록에서 cleanup 호출만 명시. throw 처리는 plan 에 없으나 silent-failure-hunter SF-CRITICAL-1 가 보강 사항으로 추가.
   - 본 정정은 plan 의 의도 (cleanup 항상 실행) 를 **강화** — costMeter.finalize 가 항상 호출됨. 정합 ✅.

2. **CRITICAL RULE #3 (try-catch 데이터 조용히 삭제 금지) 준수**
   - 두 신규 catch 모두 `console.error` 로 가시화. 빈 catch 0건.
   - exit code 분기는 데이터 삭제가 아닌 분류 (운영자 관찰성 향상). 정합 ✅.

3. **stub / TODO / placeholder 도입 여부 — 0건**
   - 정정 코드 8라인 (pipeline.ts) + 분기 7라인 (batch.ts) 모두 실제 로직.
   - "TODO: replace with logger" 주석 도입 위험이 있었으나 실제 도입 X. 정합 ✅.

### 🔴 Critical (0건)

### 🟠 Major (0건)

### 🟢 Minor (0건)

### Devil's Advocate

**시나리오: cap=2 정책으로 SF-CRITICAL-2/3 이연 → 본 정정과 결합 시 누적 silent risk?**

- SF-CRITICAL-2 (markBatchRunKilled fire-and-forget at pipeline.ts:435-437) — 본 정정과 별개 코드 경로. signal handler 내부 (process.exit 직전).
- SF-CRITICAL-3 (state='failed' UPDATE silent at pipeline.ts:499-502) — 본 정정과 별개. stage failure 분기.
- **결합 risk 평가:** 본 cap=2 정정 (정상 종료 경로의 finally + main catch) 은 SF-CRITICAL-2/3 의 비정상 경로와 직교. 누적 결합 silent failure 없음.
- 단, **다음 세션에서 SF-CRITICAL-2/3 정정 시 본 정정 패턴 (try/catch + console.error)** 을 일관 적용하면 OK. 패턴 분기 risk 없음.

---

## 신규 결함 통합 분류

| ID         | 위치                   | 분류     | cap=2 정정과의 관계                               |
| ---------- | ---------------------- | -------- | ------------------------------------------------- |
| SF-M-NEW-1 | `pipeline.ts:541, 547` | 🟠 Major | 정정 자체는 OK, logger 부재는 별도 부채 (이연 OK) |
| SF-m-NEW-1 | `pipeline.ts:541`      | 🟢 Minor | 메시지 보강 (선택)                                |
| SF-m-NEW-2 | `bin/batch.ts:67-72`   | 🟢 Minor | exit code 4/5 README 반영 (선택)                  |

**Critical (0건) — 정정으로 새 silent failure 도입 없음.**

---

## 검증 사실 정합성

```
pnpm -C apps/batch typecheck    PASS (0 errors)
pnpm -C apps/batch test          PASS (137/137 tests, 1.39s)
```

- 회귀 0건 ✅.
- 단, **정정에 직접 대응하는 신규 회귀 테스트 부재** (예: `removeHandlers` mock throw → finally 가 console.error 출력 후 costMeter.finalize 호출 검증). 본 정정의 의도가 깨지지 않음을 보장하는 골든 테스트 추가가 다음 세션 우선순위 권장.

---

## 판정

**accept_with_caveats**

### 근거

1. **silent failure 본질 해결:** SF-C-1 (finally outer catch 부재) + SA-M-2 (exit code 일괄 1) 모두 가시화 + 분류 가능 상태로 정정됨.
2. **새 silent failure 도입 없음:** 두 신규 catch 모두 console.error 가시화. 빈 catch / fire-and-forget / catch-and-ignore 0건.
3. **CRITICAL 0건, MAJOR 1건 (logger 부채 — 이연 OK), MINOR 2건.**

### Caveats (다음 세션 권장 사항, "완료" 차단 아님)

1. **회귀 테스트 추가:** `removeHandlers` throw mock → finally 양쪽 분기 모두 실행 검증 (vitest spy on `console.error` + spy on `costMeter.finalize`). 본 정정의 의도 회귀 방지.
2. **logger 추상화 검토 (이연):** 현 console.error 직접 호출 → 향후 logError 도입 시 일관 적용. cap=2 외 사항.
3. **README/CHANGELOG 갱신 (이연):** exit code 4/5 의미 운영자 가이드 반영.
4. **ESM/CJS dual-package 회귀 테스트:** instanceof 분기가 모듈 인스턴스 분리 시 silent fallthrough 하지 않도록 unit test 고정.

### 다음 세션 이월 (cap=2 외)

- SF-CRITICAL-2 (markBatchRunKilled fire-and-forget)
- SF-CRITICAL-3 (state='failed' UPDATE silent)
- SF-MAJOR-1~4 일괄
- 본 리뷰 SF-M-NEW-1 (logger 추상화)

---

**리뷰자 서명:** silent-failure-hunter (independent agent, no main-thread context)
**리뷰 종료:** 2026-04-29 KST
