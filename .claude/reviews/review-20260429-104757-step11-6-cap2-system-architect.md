---
리뷰 방식: 독립 에이전트 (system-architect)
리뷰 일시: 2026-04-29 KST
리뷰 대상: Step 11.6 cap=2 정정 — SF-C-1 + SA-M-2 (Session 017)
리뷰자 컨텍스트: 메인 대화 모름 (의도 편향 차단)
---

## 0. 리뷰 범위 (변경 2 + 연관 4)

|   #    | 파일                                |               라인               | 역할                                                     |
| :----: | :---------------------------------- | :------------------------------: | :------------------------------------------------------- |
| 변경 1 | `apps/batch/src/pipeline.ts`        |             537-551              | finally 블록 (removeHandlers + costMeter.finalize)       |
| 변경 2 | `apps/batch/bin/batch.ts`           | 23-30 / 67-72 / 81-101 / 425-431 | import / ExitCode 타입 / main catch / 종결 호출          |
| 연관 1 | `apps/batch/src/pipeline.ts`        |             290-316              | ConcurrentRunError / RecoveryFailedError 정의            |
| 연관 2 | `apps/batch/src/pipeline.ts`        |             380-389              | 두 에러의 유일 throw 사이트                              |
| 연관 3 | `apps/batch/src/recover.ts`         |     99-105, 159-175, 203-272     | RecoveryStatus 5분기 + 두 status 의 발신처               |
| 연관 4 | `apps/batch/src/signal-handlers.ts` |              34-56               | installSignalHandlers cleanup 반환 (removeHandlers 정체) |
| 연관 5 | `apps/batch/bin/batch.ts`           |             191-218              | cmdRun 의 try/finally — runPipeline 호출 컨텍스트        |

연관 파일은 본 정정의 인터페이스 정합 검증을 위한 read-only 점검 대상.

---

## Pass 2 — ARCHITECT (system-architect 단독 관점)

> "이 코드가 다른 모듈과 만나면 터지는가?"

### ✅ N건 확인 / 🔴 0건 / 🟠 1건 / 🟡 1건 / N/A 0건

#### ✅ 확인 1 — ExitCode 타입 확장이 호출 측과 정합 (Q1: SA-M-2 정정 정합)

- 위치: `apps/batch/bin/batch.ts:72` `type ExitCode = 0 | 1 | 2 | 4 | 5`
- 호출 측: `apps/batch/bin/batch.ts:425-426` `main().then((code) => process.exit(code), ...)`
- main 시그니처: `async function main(): Promise<ExitCode>` (line 74)
- 모든 return 경로 (line 78 `return 0`, 84/86/88 `return await cmd*`, 92 `return 2`, 98 `return 4`, 99 `return 5`, 100 `return 1`) 가 `ExitCode` 리터럴 union 에 포함됨 → TypeScript 가 컴파일 에러로 강제. typecheck PASS (137/137 회귀 0건) 가 본 정합을 객관 증거로 입증.
- cmdRun / cmdStatus / cmdList 의 return 경로도 모두 `0|1|2` 만 반환 — 4/5 는 main catch 에서만 생성 → 단일 책임 분기 깔끔.

#### ✅ 확인 2 — 두 에러의 import / export / instanceof 동일성 보장 (Q2: 인터페이스 호환성)

- 정의: `apps/batch/src/pipeline.ts:294-302` (ConcurrentRunError) / `308-316` (RecoveryFailedError) — `export class` 선언.
- import: `apps/batch/bin/batch.ts:23-30` named import — pipeline.ts 와 단일 출처 일치.
- throw 사이트: `apps/batch/src/pipeline.ts:385, 388` — `runPipeline` 함수 본문 단일 throw. 외부 모듈 throw 0건 (`grep -rn "throw new ConcurrentRun\|throw new RecoveryFailed" → 2 hits, 모두 pipeline.ts`).
- `instanceof` 작동 조건: 동일 모듈 인스턴스에서 정의된 class 가 export → import → throw 경로에 노출 → 컨슈머가 동일 import 에서 instanceof 비교 시 PASS. ESM 환경에서 모듈 단일 인스턴스 보장됨 (workspace 내 동일 패키지 `@thepick/batch` 단일 entry).
- 직전 4-Pass §4 (Pass 4 Contract) 의 ✅ 항목 ("export 의무" 통과) 과 일관.

#### ✅ 확인 3 — finally 의 try/catch wrap 가 기존 구조와 일관 (Q3: SF-C-1 정정 정합)

- 위치: `apps/batch/src/pipeline.ts:537-549`
- 정정 전: `removeHandlers()` (raw call) + `costMeter.finalize()` (try/catch 보호) — 비대칭.
- 정정 후: 두 함수 모두 독립 try/catch + `console.error` (logged only) — 대칭 + 일관.
- `removeHandlers` 의 실체는 `signal-handlers.ts:52-55` 의 cleanup 클로저 (`process.off` 두 번 호출). `process.off` 는 Node.js EventEmitter 표준 — handler 미등록 시에도 throw 없음 (no-op return self). 따라서 throw 가능성은 매우 낮음 (Node 내부 버그 또는 `process` 객체 모킹 시) — but 그렇기에 catch 는 비용 0 의 안전장치로 합당.
- CRITICAL RULE #3 (silent failure 금지) 준수 — `console.error` 로 가시화.

#### ✅ 확인 4 — Hard Rule 16/17 무위반 (Q3: 시험 ID 리터럴)

- 변경 diff 전수 점검 (4 hunks): exam_id 리터럴 신규 도입 0건. 변경은 exit code 분기 + try/catch wrap 만.
- `bin/batch.ts:206` 의 `examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA` 는 본 cap=2 정정과 무관 (Step 11.6 본체에서 이미 추가, Hard Rule 17 § "EXAM_IDS 경유" 준수).
- 신규 throw / catch 경로에 시험 ID 분기 없음 → Year 2 adapter 주입 영향 없음.

#### ✅ 확인 5 — POSIX exit code 컨벤션 충돌 없음 (Q1 후속)

- 본 프로젝트 SIGINT/SIGTERM 종료 코드: `signal-handlers.ts:43` `process.exit(signal === 'SIGINT' ? 130 : 143)` (POSIX 128+signal_num).
- sysexits.h 영역: 64-78 (EX_USAGE=64, EX_DATAERR=65 등) — 4/5 는 sysexits 미사용 영역.
- bash builtin: 126 (not executable), 127 (command not found), 128+N (signal). 4/5 와 충돌 없음.
- Node.js internal: 1 (uncaught fatal exception), 5 (Fatal error in V8) — **여기 충돌 가능성 1건 존재**. ⚠️ 아래 🟡 Minor 1 참조.

#### ✅ 확인 6 — plan §10 SLO 영향 없음 (Q4)

- plan §3.3 / §10 의 "6 callsite 일괄 갱신" SLO 는 PipelineResult 인터페이스 변경 (qg2Passed → recovery_status 추가 등) 시 적용. 본 cap=2 정정은:
  - pipeline.ts: 함수 본문 5줄 추가 (try/catch wrap) — 인터페이스 무변경.
  - batch.ts: import 확장 + ExitCode 리터럴 union 확장 + main catch 분기 추가 — 외부 호출자 무영향 (CLI 단독 진입점).
- 따라서 다음 작업 (SF-CRITICAL-3 + Q-M-2 = PipelineResult 인터페이스 확장) 에 cap=2 정정이 새로운 부담 부여 0건. 오히려 SF-C-1 finally 의 try/catch wrap 은 finally 본문에 PipelineResult 빌드 로직이 추가될 때 안전망 역할 가능 (defensive in advance).

#### 🟡 Minor 1 — Node.js 내부 exit code 5 와 의미 충돌 가능성

- 위치: `bin/batch.ts:72` `ExitCode = 0|1|2|4|5`
- 사실: Node.js 공식 문서 (`process.exit` exit codes — https://nodejs.org/api/process.html#exit-codes) 에서 `5` 는 **"Fatal Error in V8"** (V8 내부 메모리 할당 실패 등) 으로 예약된 코드.
- 본 프로젝트의 의미: `5 = RecoveryFailedError` (체크포인트 무결성 실패 — 운영자 개입).
- 충돌 시나리오: V8 가 진짜 내부 fatal 로 5 종료 vs RecoveryFailedError 가 5 종료 → 운영자 / 모니터링 도구가 두 케이스를 구분 불가. 단, 본 프로젝트는 `console.error` 로 stderr 에 분류 메시지 출력 + `err.stack` 포함 (line 96-97) 하므로 로그 보면 구분 가능.
- 영향: 자동화된 retry 정책을 단순 exit code 만으로 분류하는 운영자에게 false positive/negative 유발 가능.
- 권고: **본 정정에서 즉시 변경 의무 X** (이미 통합 완료 + 회귀 0건). 다음 PR 또는 Step 11.7 운영자 가이드 작성 시 다음 중 택 1:
  - (A) sysexits-style 재할당: `4 → 75 (EX_TEMPFAIL)`, `5 → 70 (EX_SOFTWARE)` — POSIX 친화 + V8 충돌 회피.
  - (B) custom 영역 재할당: `4, 5 → 64, 65` (sysexits EX_USAGE/EX_DATAERR — 단, 의미 불일치).
  - (C) 현 상태 유지 + README/printHelp 에 명시: "exit 5 = RecoveryFailedError (NOT V8 fatal)" — 운영자 도큐로 충돌 회피.
- 이전 4-Pass 보고서에서 이 충돌이 명시되지 않았다 — 본 system-architect 관점에서 **신규 발견** (SA-Mn-1).

#### 🟠 Major 1 — exit 3 의 의도적 비움이 설계 문서화 부재 (CLI UX 의 가독성)

- 위치: `bin/batch.ts:67-72` ExitCode JSDoc + 타입 선언
- 사실: ExitCode 가 `0|1|2|4|5` 로 정의 — `3` 만 비어 있음.
- JSDoc (line 67-71) 은 "0=정상 / 1=일반 실패 / 2=invalid args / 4=ConcurrentRunError / 5=RecoveryFailedError" 만 명시 — exit 3 의 의도적 비움 사유 누락.
- 운영자 / 미래 컨트리뷰터 시점: "exit 3 은 왜 비웠는가? 미래 추가 예약? 외부 도구가 사용 중? 단순 실수?" 질문 발생 → 결국 코드 history (cap=2 정정 디프) 를 추적해야 함.
- 영향: CLI 인터페이스 문서화 결손 — 런북 (`docs/runbook/`) 작성 시 exit 3 라인이 비어 있어 운영자 매뉴얼 가독성 손상.
- 진단: 4 와 5 가 SIGINT=130 / SIGTERM=143 와 분리되어야 한다는 의도는 합리적 (3 자리수 vs 1 자리수 영역 분리). 그러나 그 의도가 코드에 표현 안 됨.
- 권고:
  - **본 cap=2 정정 직후 즉시 보강 (1줄 주석 추가, 5초)**:
    ```typescript
    /**
     *   3 = 예약 (의도적 비움 — 미래 status/list 명령 전용 분기 후보)
     *   4, 5 = run 명령 전용 (recover 결과 분기, SIGINT=130/SIGTERM=143 와 자리수 분리)
     */
    type ExitCode = 0 | 1 | 2 | 4 | 5;
    ```
  - **또는** exit 3 을 ConcurrentRunError, exit 4 를 RecoveryFailedError 로 재할당 (3,4 연속 — 빈 자리 제거). 단, 이미 통합 완료 + 회귀 0건이라 재할당의 ROI 낮음 → **주석 보강이 최선**.
- 분류: 🟠 Major (CLI UX 부분, exit code 운영자 노출 인터페이스 문서화 부재 — 런북 의무 작업에 직결).

#### Devil's Advocate (반론 1건 — 깨질 시나리오)

**시나리오: `runPipeline` 외부 사용자가 `RecoveryFailedError` 를 다른 의미로 throw 하여 분류 충돌**

- 가정: 미래 `recover.ts` 를 외부 패키지 (`@thepick/api`, `@thepick/quality`) 가 직접 import 하여 다른 컨텍스트에서 `recoverBatch()` 호출 → 실패 시 caller 가 `throw new RecoveryFailedError(...)` 로 wrapping → 그 caller 를 다시 다른 layer 에서 호출 → 최종 `bin/batch.ts:99` 의 `instanceof RecoveryFailedError` 는 PASS → exit 5 반환 → 운영자: "체크포인트 무결성 문제구나" 잘못 진단 → 실제 원인은 다른 layer 의 wrapping 실패.
- 현 상태 방어: pipeline.ts:294-316 의 두 에러 클래스 정의가 `pipeline.ts` 에 있어 외부 컨슈머가 import 하려면 의도적 import 필요. **따라서 즉각적 risk 는 0**. 그러나 문서화에서 "두 에러는 runPipeline 단독 throw — 외부 wrapping 금지" 를 명시 안 했음.
- 추가 시나리오: vitest mock 으로 `runPipeline` stub 을 작성해 `throw new RecoveryFailedError(...)` 를 시뮬레이트하는 통합 테스트 → 위와 동일 분류 정합 보장 (이건 정상 사용).
- 또 다른 시나리오: `ConcurrentRunError` 가 try/catch 로 wrap 되어 `throw new Error(originalErr.message)` 로 재 throw → instanceof 실패 → exit 1 (일반 실패) 로 분류 → false negative. 본 코드 경로는 cmdRun:191-218 finally 가 catch 없이 단순 close → wrapping 없음 → **현 상태 안전**. 그러나 미래 누군가 cmdRun 에 try/catch 를 추가하면 위험.
- 권고:
  - 두 에러 정의 옆에 JSDoc 1줄 추가: "본 클래스는 runPipeline 내부 throw 전용 — 외부 wrapping 금지 (CLI exit code 분기 신뢰성 보장)."
  - 또는 향후 단위 테스트 추가 (Minor): `pipeline.ts:294-316` 의 두 클래스 단독 instanceof 검사 + cmdRun 의 exit code 4/5 mapping E2E 테스트 (미래 회귀 차단).

---

## 1. 추가 점검 (질문지 Q5 운영자 UX)

### CLI 도큐 (printHelp / README) 갱신 의무

- `bin/batch.ts:402-423` printHelp 본문 — exit code 표 부재. 운영자가 exit 4/5 를 보고 의미 파악 경로는 stderr 메시지 (`[thepick-batch] ERROR: ...`) + 본 코드의 JSDoc (line 67-71) 뿐.
- README 부재 (`apps/batch/README.md` 없음 — `find apps/batch -name README.md` 결과 0건).
- 권고:
  - **본 cap=2 정정과 분리하여 다음 작업 (Step 11.7 또는 운영자 런북)** 에서 처리:
    - printHelp 에 "Exit Codes" 섹션 추가 (5줄).
    - `apps/batch/README.md` 신설 시 동일 표 포함.
    - retry 정책 (exit 4 → "60분 후 재시도 후에도 4 면 강제 종료 절차" / exit 5 → "절대 자동 retry 금지, 진산님 검토") 운영자 가이드.
  - 본 리뷰는 인터페이스 변경 없음 + 회귀 0건 객관 사실에 집중 — 운영자 도큐 부재는 **Minor 보고**, 본 정정의 차단 사유 아님.

---

## 2. 종합 분류

|       분류       | 건수  | 상세                                                                                                         |
| :--------------: | :---: | :----------------------------------------------------------------------------------------------------------- |
|   🔴 Critical    | **0** | —                                                                                                            |
|     🟠 Major     | **1** | SA-Mn-1: exit 3 비움 사유 JSDoc 누락 (1줄 주석 5초 보강)                                                     |
|     🟡 Minor     | **2** | (a) Node.js exit 5 = V8 fatal 의미 충돌 — README/runbook 시 명시 / (b) printHelp + README 운영자 도큐 미작성 |
|     ✅ PASS      | **6** | ExitCode 정합, instanceof 호환, finally 일관, Hard Rule 16/17 무위반, POSIX 컨벤션 적합, plan SLO 무영향     |
| Devil's Advocate | **1** | 외부 모듈 wrapping 시 false negative 가능성 (현 상태 안전, 미래 방어 필요)                                   |

---

## 3. 판정

**완료 가능 (cap=2 SF-C-1 + SA-M-2 정정 본체) — Critical 0건.**

단, 다음 1건은 **본 세션 즉시 보강 권고** (5초 작업, plan SLO 무영향):

> `bin/batch.ts:67-72` ExitCode JSDoc 에 "exit 3 = 예약 (의도적 비움)" + "4, 5 = run 명령 전용, SIGINT=130/SIGTERM=143 와 자리수 분리" 1~2줄 추가.

본 보강을 거부하는 경우, 다음 작업 (Step 11.7 또는 운영자 런북) 의 첫 항목으로 **명시적 이월** 의무.

이전 4-Pass 보고서 (review-20260429-094423-...) 의 SA-M-1 / SA-M-2 / 기타 MAJOR 9건 / MINOR 12건 중 SA-M-2 만 본 cap=2 대상 — **나머지는 본 보고서 스코프 외**, 다음 세션 정정 매트릭스 (4-Pass §6) 따라 처리.

직전 4-Pass system-architect 관점이 식별 못 한 추가 발견:

- **SA-Mn-1 (Major 신규)**: exit 3 의 의도적 비움이 JSDoc 미표현.
- **Node.js exit 5 의미 충돌 (Minor 신규)**: V8 fatal 과 RecoveryFailedError 의 우연한 동일 코드 — 4-Pass 에서 미언급.

회귀 검증 (typecheck PASS / 137 tests PASS / 1.39s) 은 정정 본체의 정합성에 대한 객관 증거로 유효. 그러나 **exit 4/5 mapping 자체에 대한 단위 테스트 0건** 은 향후 PipelineResult 인터페이스 확장 (다음 세션) 시 회귀 위험 존재 — Step 11.7 또는 다음 PR 에서 1건 추가 권고 (Minor).

---

## 4. 본 보고서가 메인 대화 컨텍스트 모름 보장

- 본 리뷰는 변경 diff (메시지에 명시) + 4 연관 파일 read-only + 직전 4-Pass 보고서 read-only 만 참조.
- 코드 작성 의도 ("왜 4, 5 였는가?") 추측 차단 — 사실 (코드 + JSDoc) 만으로 평가.
- 직전 4-Pass 보고서 SA-M-2 (cap=2 대상) 와 본 보고서의 SA-Mn-1 (신규 발견) 은 **다른 사안** — 중복 보고 0건 확인.
