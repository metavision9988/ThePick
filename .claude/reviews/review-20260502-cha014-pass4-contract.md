# Sprint 1 §5.3 CHA-01 / CHA-02 / CHA-04 — Pass 4 CONTRACT 독립 리뷰

**작성일**: 2026-05-02 KST
**리뷰어**: Pass 4 CONTRACT (quality-engineer 페르소나) — 코드 작성 컨텍스트 무관 / 독립
**리뷰 대상 commits**:

- `e589ce7` CHA-01 — D1 disconnect Proxy + retry 정합
- `ac5e4db` CHA-02 — CalculationTimeoutError + COMPUTE_TIMEOUT
- `a319a81` CHA-04 — wall clock skew + 24h 가드 회귀 방어

**리뷰 범위**: 변경 8 파일 + 연관 7 파일

- 변경 (CHA-01): `apps/api/src/__tests__/helpers/d1-disconnect-mock.ts` (신규), `apps/api/src/__tests__/scenarios/cha-01-d1-disconnect.test.ts` (신규), `apps/api/src/middleware/__tests__/retry.test.ts`, `apps/api/src/middleware/retry.ts`
- 변경 (CHA-02): `packages/formula-engine/src/__tests__/cha-02-compute-timeout.test.ts` (신규), `packages/formula-engine/src/engine.ts`, `packages/formula-engine/src/errors.ts` (신규), `packages/formula-engine/src/index.ts`, `packages/formula-engine/src/sandbox.ts`, `packages/formula-engine/src/types.ts`
- 변경 (CHA-04): `apps/batch/__tests__/cha-04-clock-skew.test.ts` (신규)
- 연관: `apps/batch/src/recover.ts`, `apps/batch/src/checkpoint.ts`, ADR-028, test-patterns.md, Master Plan v1.0 §CHA-01/02/04, handoff-031, dev-guide.md

**관점**: "기획대로 만들었는가? Silent Pivot 없는가? Hard Rule / L3 / 합격 기준 정합?"

---

## 0. 종합 결과

| 분류        | 카운트 |
| :---------- | :----: |
| ✅ PASS     |   14   |
| 🔴 CRITICAL |   1    |
| 🟠 MAJOR    |   4    |
| 🟢 MINOR    |   4    |
| N/A         |   2    |

**판정**: 🔴 **수정 필요** — CRITICAL 1건 (L3 영역 plan 부재) 으로 auto-review-protocol 규칙 4 ("Critical 0건이어야 완료 선언 가능") 미충족. CHA-02 부분이 `packages/formula-engine/` (CLAUDE.md L3 영역) 변경임에도 명시적 plan + 진산님 승인 흔적 부재.

**즉시 흡수 권고**:

- C-1 (L3 plan 부재) — handoff-032 작성 시 "L3 사후 plan 검토 결정" 명시 또는 진산님 retroactive 승인 기록.
- M-1~M-4 — §5.4 commit 동시 흡수 (auto-review-protocol §"MAJOR phase 종료 전 또는 다음 phase 명시 이월" 정합).

---

## 1. 명세 vs 구현 대조표

### 1.A CHA-01 — D1 disconnect 10% rate (Master Plan §CHA-01)

| 항목             | 명세                                                      | 실제 구현                                                                                         |           정합           |
| :--------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------ | :----------------------: |
| **목적**         | BATCH 실행 중 D1 호출 10% 실패 시 retry + checkpoint 보존 | apps/batch wire-up 이연으로 INSERT 시퀀스 100건 시뮬레이션 (commit message + test §1~4)           |            🟠            |
| **시나리오 (1)** | BATCH-1 fixture 실행                                      | 미적용 — INSERT 100건 직접 시뮬레이션 (test:148-200)                                              |            🟠            |
| **시나리오 (2)** | MSW 로 D1 binding fetch 가로채서 10% 503                  | 미적용 — wrapper-level Proxy (helpers/d1-disconnect-mock.ts:76-103)                               |  ✅ (ADR-028 §4.1 정합)  |
| **시나리오 (3)** | BATCH 완료까지 대기                                       | 100건 시퀀스 완료 검증 (test:179)                                                                 | 🟠 (대체 합격 기준 정합) |
| **입력**         | seed=42 PRNG, 100회 중 10건 실패                          | `mulberry32(42)` (test:32, 53-58) — 100회 표본 5~15건 분산 검증 (test:67-69)                      |            ✅            |
| **측정 도구**    | Vitest + MSW + Workers Vitest Pool                        | Vitest + Proxy direct (MSW/Workers Pool 미경유)                                                   | 🟠 (ADR-028 채택 정당화) |
| **합격 (a)**     | BATCH 최종 status='completed'                             | `successCount === 100` (test:179) — "100 INSERT 모두 최종 PASS" 대체                              |            🟠            |
| **합격 (b)**     | p95 latency ≤ 2,000ms                                     | `expect(p95).toBeLessThanOrEqual(P95_LATENCY_BUDGET_MS)` (test:191) — backoff 100→400ms 포함      |            ✅            |
| **합격 (c)**     | 각 호출 retry ≤ 3회                                       | `MAX_RETRY_ATTEMPTS=2` (retry.ts:17) → 총 3회 시도 / `attempts.toBeLessThanOrEqual(3)` (test:184) |            ✅            |
| **합격 (d)**     | checkpoint 파일 corruption=0                              | `count.n === 100` (test:199) — INSERT 멱등성 + 부분 INSERT 0건으로 대체                           |            🟠            |
| **선행 조건**    | apps/batch wire-up 완료                                   | 현 deferred 상태 — commit/test 본문 정직 명시 (test:9-20)                                         |       ✅ (정직성)        |

**§5.3 합격 기준 (a)/(d) 의 "대체"**: Master Plan §CHA-01 의 (a) BATCH status='completed' 와 (d) checkpoint corruption=0 은 본질적으로 BATCH wire-up 완료 후 검증 가능. 본 구현은 이를 "INSERT 멱등성 + row count" 로 대체. 합격 기준의 **의도** (모든 호출이 retry 후 최종 성공 + 부분 INSERT 0건) 는 검증되나, **명시적 합격 기준 텍스트** 와는 차이. handoff `apps/batch wire-up 완료 시점 BATCH 통합 카오스 테스트 별도 추가 의무` (test:18-19) 명시로 일탈 추적성 확보.

---

### 1.B CHA-02 — Worker CPU 50ms 초과 시뮬레이션 (Master Plan §CHA-02)

| 항목             | 명세                                             | 실제 구현                                                                                                                                                                    | 정합 |
| :--------------- | :----------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
| **목적**         | 50ms 한도 초과 시 graceful 처리                  | 사전 (AST 복잡도/깊이) + 사후 (wall-clock) 이중 방어 (sandbox.ts:243-283, 336-380)                                                                                           |  ✅  |
| **시나리오 (1)** | math.parse() 가 10,000 노드 깊이 AST 산식 입력   | `Array.from({ length: 300 }, () => '1').join('+')` (test:39) — 300회 → 599 노드                                                                                              |  🟠  |
| **시나리오 (2)** | engine.calculate() 호출                          | `safeParse` 직접 호출 (test:44, 136) + `calculate('F-01', ...)` 정상 회귀 (test:157)                                                                                         |  🟠  |
| **시나리오 (3)** | setTimeout(50) 시뮬레이션                        | busy-wait 60ms (test:99-101) — setTimeout 미사용 (sync evaluate 정합)                                                                                                        |  ✅  |
| **입력**         | "1+1+...+1" 1000회 + "sin(cos(tan(...)))" 50중첩 | "1+...+1" 300회 (test:39) + "((((1))))" 35중첩 (test:68)                                                                                                                     |  🟠  |
| **측정 도구**    | Vitest + performance.now()                       | Vitest + `Date.now()` (sandbox.ts:359, 361)                                                                                                                                  |  🟢  |
| **합격 (a)**     | CalculationTimeoutError throw                    | `ast_too_complex` (test:48-49) / `ast_too_deep` (test:77-78) / `eval_timeout` (test:113) 모두 검증                                                                           |  ✅  |
| **합격 (b)**     | error.code='COMPUTE_TIMEOUT'                     | engine.ts:67-77 (parse), engine.ts:88-94 (eval) — FormulaError code='COMPUTE_TIMEOUT' 매핑. **engine 매핑은 직접 검증 없음** (test:139 mocked compiled 만 safeEvaluate 검증) |  🟠  |
| **합격 (c)**     | 메모리 누수=0 (3회 후 heap < 1MB)                | 100회 반복 + heap delta < 5MB (test:174-187) — 33× 강화 + 5× 한도 완화                                                                                                       |  🟠  |
| **불합격 분류**  | Critical: 무한 루프 / Major: silent fail         | "sync 코드 preempt 불가 → 무한 루프 hang 본질적 미해결" (test:11-12) — AST 사전 차단으로 우회                                                                                |  ⚠️  |

**시나리오 입력 차이**:

- Master Plan: "1+1+...+1" **1000회** + "sin(cos(tan(...)))" **50중첩**.
- 구현: 300회 + 35중첩.
- **사유 (test:36-40)**: `MAX_EXPRESSION_LENGTH=1024` (sandbox.ts:250) 한도 안에서 `MAX_AST_NODE_COUNT=500` 초과 필요 → 300회 반복 = 599 chars / 599 nodes. 1000회 = 1999 chars (length 한도 우선 차단).
- **정합 평가**: 합격 기준 의도 ("AST 복잡도/깊이 한도 초과 시 throw") 는 명백히 충족. 입력 수치는 **상수 한도 강화 결과** 로 적정화. `MAX_EXPRESSION_LENGTH` 자체가 1차 방어선이라 합리적.

**합격 (c) 메모리 누수 강화**:

- Master Plan: "3회 후 heap delta < 1MB"
- 구현: 100회 후 < 5MB
- 사유 (test:170-185): "33× 강화" (반복 수) + "5× 한도 완화" (Vitest GC 주기/V8 hidden class 캐시 변동 흡수). **누수가 있으면 100회면 명백히 5MB 초과** 라는 정직 추론. 명세 의도 (누수 검증) 는 강화되었으나 임계치 자체는 5× 느슨해짐.

**합격 (b) 매핑 검증 부재**: test:139~153 의 "engine.calculate() COMPUTE_TIMEOUT 매핑" 는 실제 engine.calculate 호출 없이 safeEvaluate 직접 mocked compiled 검증. registry 등록된 산식의 equation_template 자체가 < 50 노드 / < 10 깊이라서 **engine.ts:67-77 의 parse-time 매핑 분기는 본 테스트에서 절대 발화 안 함** (정상 산식이라 try/catch 진입 X). **engine.ts:88-94 의 eval-time 매핑 분기도 발화 안 함** (정상 evaluate 가 catch 진입 X). 매핑 코드 자체의 회귀 방어 미보장.

---

### 1.C CHA-04 — Wall clock skew ±10분 (Master Plan §CHA-04)

| 항목             | 명세                                                                        | 실제 구현                                                                                                                                |             정합              |
| :--------------- | :-------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------: |
| **목적**         | 클럭 ±10분 어긋날 때 batch_runs state machine + checkpoint timestamp 정합성 | recover.ts `Math.max(0, ...)` (recover.ts:186) + STALE_LOCK_THRESHOLD_MS (checkpoint.ts:40) + checkpoint timestamp 비검증 정책 회귀 방어 |              ✅               |
| **시나리오 (1)** | Date.now() mock 으로 +10분 future                                           | `vi.setSystemTime` 으로 started_at = 미래 (test:107-110)                                                                                 |              ✅               |
| **시나리오 (2)** | BATCH 실행                                                                  | recover.ts 호출 직접 시뮬레이션 (test:125-131)                                                                                           |              ✅               |
| **시나리오 (3)** | 정상 시계 후 recover                                                        | `vi.advanceTimersByTime(STALE_LOCK_THRESHOLD_MS + 1000)` (test:185)                                                                      |              ✅               |
| **입력**         | T=0 시작 / T=600s -10분 / T=900s 정상                                       | test §4 (cha-04-clock-skew.test.ts:293-340) — 정확 정합                                                                                  |              ✅               |
| **측정 도구**    | Vitest + sinon.useFakeTimers                                                | Vitest + vi.useFakeTimers (test:108) — sinon 미도입, vi 채택                                                                             | ✅ (test-patterns.md §1 정합) |
| **합격 (a)**     | batch_runs.elapsed 음수 시 abs()                                            | `Math.max(0, Date.now() - started_at)` (recover.ts:186) — abs() 가 아닌 max(0) 채택. test 검증 `concurrent_run_detected` (test:134)      |              ✅               |
| **합격 (b)**     | recover.ts Q1 "elapsed < 24h" 가드 통과                                     | `STALE_LOCK_THRESHOLD_MS = 24 * 60 * 60 * 1000` (checkpoint.ts:40) — test §2 (test:144-235) 24h+1s 진행 후 fully_recovered               |              ✅               |
| **합격 (c)**     | checkpoint timestamp 미래라도 거부 안 함                                    | test §3 (test:241-287) — checkpoint.timestamp = 11:00 / 현재 = 10:00 → fully_recovered                                                   |              ✅               |

**일탈 평가**:

- 측정 도구 sinon→vi 전환은 test-patterns.md §1.2 ("sinon 미도입 — 동일 기능을 vi.useFakeTimers() 가 커버") 명시 결정 정합. silent pivot 없음.
- 합격 (a) abs() vs max(0): 의미 차이 없음 (음수 elapsed 모두 0 처리). 다만 명세 텍스트 "abs()" 와 코드 "Math.max(0, ...)" 차이는 정직 명시 필요.

**CHA-04 가장 정합도 높음** — 신규 production 코드 0줄, 회귀 방어 테스트만 추가 (commit message:9-10 명시).

---

## 2. Hard Rules / Hard Limit 위반 점검

### 2.A CLAUDE.md "Hard Limit (절대 제약)"

| 규칙                                 | 점검 결과 | 증거                                                                                                                                                                                                                                       |
| :----------------------------------- | :-------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env*` 파일 커밋 금지               | ✅ PASS   | git diff 에 `.env*` 변경 0건                                                                                                                                                                                                               |
| Guide/ 디렉토리 수정 금지            | ✅ PASS   | git diff 에 Guide/ 변경 0건                                                                                                                                                                                                                |
| knowledge_nodes/formulas UPDATE 금지 | ✅ PASS   | UPDATE 문 0건                                                                                                                                                                                                                              |
| LLM 수식 계산 금지                   | ✅ PASS   | sandbox.ts AST evaluate 만, eval/Function/import 모두 throwing stub (sandbox.ts:117-151)                                                                                                                                                   |
| 동적 코드 실행 금지                  | ✅ PASS   | sandbox.ts evaluate/parse/compile 전부 stub. CHA-02 변경은 화이트리스트 강화                                                                                                                                                               |
| Constants는 DB 쿼리로만              | 🟢 MINOR  | sandbox.ts:250-252 `MAX_EXPRESSION_LENGTH=1024` / `MAX_AST_NODE_COUNT=500` / `MAX_AST_DEPTH=30` / `MAX_EVAL_MS=50` 모두 코드 상수. **사유**: 본 한도는 시험 도메인이 아닌 **엔진 자기 보호 한도** (Workers 50ms 정합). DB 쿼리 부적절. M14 |
| Ontology Lock                        | N/A       | 본 변경에 노드/엣지 신규 0건                                                                                                                                                                                                               |
| AI 생성 데이터 draft 강제            | N/A       | 본 변경에 AI 생성 데이터 0건                                                                                                                                                                                                               |
| BATCH 순차 실행                      | N/A       | 본 변경에 BATCH 실행 0건                                                                                                                                                                                                                   |
| 농학 미출제 영역 라벨링              | N/A       | 본 변경에 도메인 콘텐츠 0건                                                                                                                                                                                                                |
| shared 노드 1차/2차 양쪽 검토        | N/A       | 본 변경에 shared 노드 수정 0건                                                                                                                                                                                                             |
| 암기법 역방향 검증                   | N/A       | 본 변경에 암기법 0건                                                                                                                                                                                                                       |

### 2.B production-quality.md Hard Rule 15 — 범용 계층 시험 특화 분기 금지

| 파일                                                   | 점검    | 증거                                           |
| :----------------------------------------------------- | :------ | :--------------------------------------------- |
| `packages/formula-engine/src/sandbox.ts`               | ✅ PASS | `if.*examId` / `switch.*examId` grep 결과 0건  |
| `packages/formula-engine/src/errors.ts`                | ✅ PASS | examId 참조 0건, 시험 도메인 분기 0건          |
| `packages/formula-engine/src/engine.ts`                | ✅ PASS | examId 참조 0건                                |
| `apps/api/src/__tests__/helpers/d1-disconnect-mock.ts` | ✅ PASS | apps/ 계층이라 Rule 15 비적용 + 시험 분기 없음 |

### 2.C Hard Rule 16 — 데이터 조회 시 examId 시그니처 의무

| 파일                                                            | 점검    | 증거                                                                                                               |
| :-------------------------------------------------------------- | :------ | :----------------------------------------------------------------------------------------------------------------- |
| `apps/batch/__tests__/cha-04-clock-skew.test.ts`                | ✅ PASS | `recoverBatch({ examId: TEST_EXAM_ID, ... })` (test:126, 176, 188, 226, 276, 329) — 6회 호출 모두 examId 인자 정합 |
| `apps/api/src/__tests__/scenarios/cha-01-d1-disconnect.test.ts` | ✅ PASS | 본 테스트는 시험 지식 테이블 조회 0건 (`cha01_simulated` ad-hoc 테이블만) — Rule 16 비적용                         |
| `packages/formula-engine/src/*`                                 | N/A     | 데이터 조회 함수 0건                                                                                               |

### 2.D Hard Rule 17 — exam ID 리터럴 단일 선언

| 파일                              | 점검    | 증거                                                                                                     |
| :-------------------------------- | :------ | :------------------------------------------------------------------------------------------------------- |
| 본 변경 8 파일 전수               | ✅ PASS | `grep -rn "son-hae-pyeong-ga-sa"` 결과 0건                                                               |
| `cha-04-clock-skew.test.ts:26-37` | ✅ PASS | `import { EXAM_IDS } from '@thepick/shared'` + `const TEST_EXAM_ID = EXAM_IDS.SON_HAE_PYEONG_GA_SA` 정합 |

### 2.E production-quality.md "금지 패턴 → 올바른 패턴"

| 패턴                   | 점검     | 증거                                                                                                                                                                                                |
| :--------------------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `any` 타입             | ✅ PASS  | grep "any\b" → sandbox.ts:184/201/213/320 모두 `if (type === 'X')` 매칭 (false positive)                                                                                                            |
| 하드코딩               | 🟢 MINOR | sandbox.ts MAX\_\* 상수 (전술). M14                                                                                                                                                                 |
| `console.log`          | ✅ PASS  | grep `console\.` → 본 변경 7 파일 0건                                                                                                                                                               |
| 인메모리 임시 저장     | ✅ PASS  | recover.ts staleThreshold 옵션 / d1-disconnect-mock Proxy 모두 stateless                                                                                                                            |
| TODO/HACK 주석         | ✅ PASS  | grep TODO/HACK/FIXME → 본 변경 7 파일 0건                                                                                                                                                           |
| 빈 catch               | ✅ PASS  | test:171 `} catch {` (latencies push for failure tracking) — 의도적 무명 catch (durationMs/exhaustedCount 측정용). test:177 `} catch {` (메모리 누수 검증). 모두 합법. production 코드 빈 catch 0건 |
| `import *` 전체 임포트 | ✅ PASS  | sandbox.ts:19-40 selective import (parseDependencies 등 17개 명시)                                                                                                                                  |

---

## 3. L3 영역 (CLAUDE.md §"L3 영역") 위반 점검 — **CRITICAL**

### CLAUDE.md:73-79 명시:

> **L3 영역 (plan 필수 + 인간 승인 후 코딩)**
>
> - `packages/formula-engine/` — 산식 연산 (계산 오류 = 서비스 사망)
> - `**/constants*` — 매직 넘버 (65%를 60%로 잘못 입력 = 서비스 사망)
> - `**/ontology-registry*` — 허용 ID 목록
> - DB 스키마 변경 (마이그레이션)
> - 사용자 데이터 처리 (user_progress)

### dev-guide.md:47:

> [ ] L3 영역 변경 시 plan + 승인 완료

### 본 변경 점검:

**CHA-02 commit `ac5e4db` 변경 파일**:

- `packages/formula-engine/src/engine.ts` — L3 영역 ✅
- `packages/formula-engine/src/errors.ts` — L3 영역 ✅ (신규)
- `packages/formula-engine/src/index.ts` — L3 영역 ✅
- `packages/formula-engine/src/sandbox.ts` — L3 영역 ✅ (헤더 명시: "DEFCON L3: 이 파일 변경 시 반드시 보안 리뷰 필수")
- `packages/formula-engine/src/types.ts` — L3 영역 ✅

**plan 검색 결과**:

```
ls /home/soo/ClaudePro/ThePick/docs/plans/engine-hardening/
- ROADMAP.md
- decision-2026-05-02-cha-03-05-p1-reclassification.md
- step1~step19 plans (모두 ROADMAP step 별)
- 두 검토서 교차 분석 + 통합 v1.1 PATCH 권고.md
```

**CHA-02 (formula-engine 변경) 전용 plan 부재**. handoff-031 §2.A 의 "CHA-02 CalculationTimeoutError + 무거운 산식 setTimeout bail" 는 **작업 명세** 일 뿐, CLAUDE.md L3 § "plan 필수 + 인간 승인" 의 plan 요건 (PITR / engine 의 alternative 비교 / 진산님 명시 승인) 미충족.

**판정**: 🔴 **CRITICAL — Hard Limit 위반**

**증거**:

1. CLAUDE.md:75 `packages/formula-engine/` 명시 L3.
2. sandbox.ts:7 자체 "DEFCON L3: 이 파일 변경 시 반드시 보안 리뷰 필수" 자가 선언.
3. dev-guide.md:47 배포 전 체크리스트 "L3 영역 변경 시 plan + 승인 완료" 명시.
4. handoff-031 의 "CHA-02 작업 명세" 는 plan 이 아닌 로드맵.
5. ROADMAP §"5.3 신규 구현" 도 L3 plan 의 요건 (alternative 비교 / 보안 리뷰 흔적) 미충족.

**반론 (Devil's Advocate)**:

- 본 변경은 **자원 한도 강화** 일 뿐 산식 평가 알고리즘 변경 아님 → L3 의도 (계산 오류 = 서비스 사망) 와 무관할 수 있음.
- engine.calculate() 정상 산식 케이스는 회귀 0건 (test:155-160 F-01 = 0.3 검증).
- sandbox.ts 변경은 화이트리스트 강화 + 한도 추가 — 보수적 변경 (FAIL-SECURE).

**그럼에도 CRITICAL 유지 사유**:

- L3 의 의도는 "사후 회귀 검증 통과" 가 아닌 "사전 plan + 인간 승인" — 절차 위반.
- `MAX_EVAL_MS=50` / `MAX_AST_NODE_COUNT=500` / `MAX_AST_DEPTH=30` 매직 넘버 결정 자체가 **정상 산식의 평가 동작 영역에 직접 영향** — Workers Free Plan 50ms 정합이라 주장하나, 유료 플랜 30s 환경에서 정상 산식이 차단될 회귀 가능성 plan 검토 부재.
- "회귀 0건" 은 현 시점 산식 (F-01~F-68) 한정. 향후 BATCH 적재 시점 신규 산식 (예: 복합 농작물 가중 평균) 이 한도 근접 시 자동 차단될 위험 plan 검토 부재.

**즉시 흡수**: handoff-032 작성 시 다음 중 하나 선택:

- (A) 진산님 retroactive 승인 기록 (메모리 자동 로드 정합).
- (B) `docs/plans/engine-hardening/cha-02-formula-engine-resource-limit.plan.md` 사후 작성 + 진산님 검토.
- (C) ADR-029 작성 ("formula-engine 자원 한도 — Workers 50ms 정합 vs 산식 다양성").

---

## 4. 합격 기준 / Sprint 1 진행 상태 정합

### 4.A handoff-031 §2.A 진입 명세 정합

| 시나리오 | handoff 명세                                                                                                                | 본 commit                                                                                                                                             | 정합 |
| :------- | :-------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
| CHA-01   | "D1 disconnect 10% Proxy wrap + retry 검증, 0.5d, ADR-028 §4.1 정합"                                                        | e589ce7 — Proxy + retry + ADR-028 §4.1 명시 (helpers/d1-disconnect-mock.ts:5)                                                                         |  ✅  |
| CHA-02   | "CalculationTimeoutError + 무거운 산식 setTimeout bail, 0.5d, formula-engine/engine.ts setTimeout-based bail-out"           | ac5e4db — CalculationTimeoutError ✅ / **setTimeout bail 미적용** (sync evaluate preempt 불가, 사전 AST + 사후 wall-clock 채택, test:11-12 정직 명시) |  🟠  |
| CHA-04   | "vi.useFakeTimers clock skew + recover Q1 (24h 가드), 0.5d, test-patterns.md §1 정합 + apps/batch/recover.ts elapsed abs()" | a319a81 — vi.useFakeTimers + Math.max(0) (abs() 와 의미 동일)                                                                                         |  ✅  |

**CHA-02 시나리오 변경 (setTimeout bail → AST 사전 + wall-clock 사후)**:

- handoff 명세는 "setTimeout bail" — Workers 의 비동기 yield point 시뮬레이션.
- 실 구현은 "사전 AST 복잡도 + 사후 wall-clock" — sync 코드 preempt 불가 (mathjs evaluate 가 sync) 하므로 setTimeout 부적합.
- **silent pivot 위험**: handoff 명세를 따르지 못한 사유 (test:11-12) 는 commit/test 본문에 명시되어 silent pivot 아님.
- 그러나 handoff §2.A 와 다른 구현 결정은 **CRITICAL RULE #1 ("기획과 다르게 구현하려면 → 코딩 멈추고 인간에게 먼저 보고")** 에 인접. handoff-032 작성 시 명시 보고 의무.

### 4.B handoff-031 §6.3 — 패턴 정합

> "시나리오별 1 commit / Day 별 1 4-Pass / 1 흡수 commit 패턴 유지"

| 시나리오    | commit                                  | 정합 |
| :---------- | :-------------------------------------- | :--: |
| CHA-01      | e589ce7 (1 commit)                      |  ✅  |
| CHA-02      | ac5e4db (1 commit)                      |  ✅  |
| CHA-04      | a319a81 (1 commit)                      |  ✅  |
| 4-Pass      | **본 리뷰** 진행 중                     |  ⏳  |
| 흡수 commit | **미실행** — 본 Pass 4 결과에 따라 결정 |  ⏳  |

### 4.C 네이밍 컨벤션 정합

| 항목                | 명세                                      | 실제                                     | 정합 |
| :------------------ | :---------------------------------------- | :--------------------------------------- | :--: |
| 파일명 (CHA-01)     | scenarios/cha-01-\*.test.ts               | `cha-01-d1-disconnect.test.ts`           |  ✅  |
| 파일명 (CHA-02)     | **tests**/cha-02-\*.test.ts               | `cha-02-compute-timeout.test.ts`         |  ✅  |
| 파일명 (CHA-04)     | **tests**/cha-04-\*.test.ts               | `cha-04-clock-skew.test.ts`              |  ✅  |
| 클래스명 (CHA-01)   | `Simulated[Domain]Error`                  | `SimulatedD1DisconnectError`             |  ✅  |
| 클래스명 (CHA-02)   | `CalculationTimeoutError`                 | `CalculationTimeoutError` (errors.ts:17) |  ✅  |
| Error code (CHA-02) | `COMPUTE_TIMEOUT`                         | `COMPUTE_TIMEOUT` (types.ts:76)          |  ✅  |
| Error kind 분류     | ast_too_complex/ast_too_deep/eval_timeout | 동일 (errors.ts:15)                      |  ✅  |

---

## 5. PASS 항목 (증거 기반)

1. **EXAM_IDS 정합** — `cha-04-clock-skew.test.ts:26,37` 단일 import + 단일 const, 6회 호출 모두 경유. Hard Rule 17 정합.
2. **examId 시그니처** — recover.ts:142 `RecoverOptions.examId: ExamId` 필수. test 6회 호출 모두 정합. Hard Rule 16 정합.
3. **시험 분기 부재** — formula-engine 3 파일 (engine/sandbox/errors) 에 `if.*examId` / `switch.*examId` grep 결과 0건. Hard Rule 15 정합.
4. **TODO/HACK/FIXME 부재** — 본 변경 7 파일 grep 결과 0건. production-quality.md 정합.
5. **console.log 부재** — 본 변경 7 파일 grep 결과 0건.
6. **import \* 부재** — sandbox.ts:19-40 selective import 17개 명시.
7. **빈 catch 부재** (production) — d1-disconnect-mock.ts / engine.ts / sandbox.ts / errors.ts 모두 catch 블록 본문 비어있는 경우 0건.
8. **CalculationTimeoutError export** — index.ts 신규 export (commit message), test:20 `import { calculate, CalculationTimeoutError } from '../index'` 검증.
9. **ADR-028 §4.1 정합** — helpers/d1-disconnect-mock.ts:5 "ADR-028 §4.1 (Workers Vitest Pool 이연 — Proxy wrap 채택)" 명시. ADR-028 §4.1:94-119 의 코드 예시와 본 구현 핵심 일치 (Proxy wrap), 단 ADR 단일 Proxy → 본 구현 2단 Proxy (D1Database + D1PreparedStatement) 강화 (helpers:13-15 정직 명시).
10. **test-patterns.md §1 정합** — cha-04-clock-skew.test.ts:99 `vi.useRealTimers()` afterEach 의무 호출. §1.2 안티패턴 ("vi.useRealTimers() 누락") 회피.
11. **mulberry32 결정성** — test:53-58 동일 seed 동일 시퀀스 검증. flaky test 방어.
12. **retry middleware 정합** — retry.ts:45-53 RETRYABLE_MESSAGE_PATTERNS 에 D1_DISCONNECT/D1_UNAVAILABLE/timeout 추가. d1-disconnect-mock.ts:55-63 SimulatedD1DisconnectError message 가 패턴 매칭.
13. **CHA-04 신규 production 코드 0줄** — commit message:9-10 "신규 코드 변경 0건, 테스트만 추가" 명시. recover.ts/checkpoint.ts 의 기존 가드 (Math.max(0) / STALE_LOCK_THRESHOLD_MS) 회귀 방어 정합.
14. **STALE_LOCK_THRESHOLD_MS 임계 검증** — checkpoint.ts:40 `24 * 60 * 60 * 1000` + test:185 `vi.advanceTimersByTime(STALE_LOCK_THRESHOLD_MS + 1000)` 정합.

---

## 6. CRITICAL / MAJOR / MINOR

### 🔴 CRITICAL

#### C-1: L3 영역 (`packages/formula-engine/`) 변경에 plan + 진산님 승인 흔적 부재

**위치**: commit `ac5e4db` 전체 — packages/formula-engine/src/ 6 파일 변경
**명세 인용**: CLAUDE.md:73-75 "L3 영역 (plan 필수 + 인간 승인 후 코딩) — `packages/formula-engine/` 산식 연산 (계산 오류 = 서비스 사망)"
**증거**:

- sandbox.ts:7 자체 "DEFCON L3: 이 파일 변경 시 반드시 보안 리뷰 필수" 자가 선언
- dev-guide.md:47 배포 전 체크리스트 "L3 영역 변경 시 plan + 승인 완료" 명시
- `docs/plans/engine-hardening/` 디렉토리에 cha-02 / formula-engine resource limit 전용 plan 부재
- ROADMAP step 1~19 중 본 변경 매핑 plan 없음

**수정 권고**:

- (A) handoff-032 §3 "L3 사후 plan 검토 결정" 명시 + 진산님 retroactive 승인 기록
- (B) `docs/plans/engine-hardening/cha-02-formula-engine-resource-limit.plan.md` 사후 작성 (PITR alternative 비교 + 보안 영향 분석)
- (C) ADR-029 작성 ("formula-engine 자원 한도 결정 — Workers 50ms vs 산식 다양성 trade-off")

---

### 🟠 MAJOR

#### M-1: CHA-02 명세 일탈 — setTimeout bail → AST 사전 + wall-clock 사후 (Silent Pivot 위험)

**위치**: handoff-031 §2.A vs commit `ac5e4db`
**명세 인용**: handoff-031 §2.A "CHA-02 작업: CalculationTimeoutError + 무거운 산식 setTimeout bail / 도구 의존: packages/formula-engine/engine.ts setTimeout-based bail-out"
**증거**:

- 실제 구현: setTimeout 미사용. 사전 AST 복잡도/깊이 (sandbox.ts:263-283) + 사후 wall-clock Date.now() (sandbox.ts:359-368)
- test:11-12 정직 명시 ("sync 코드 preempt 불가 — sandbox.ts 가 사전 차단 + 사후 차단 이중 방어")
- commit message 본문에 "sync 코드 preempt 불가하므로 사전 + 사후 이중 방어" 명시

**평가**: 명시적 사유 + commit/test 본문 정직 명시로 **silent pivot 은 회피**. 그러나 handoff 명세를 따르지 못한 사유는 **CRITICAL RULE #1** (기획과 다르게 구현 → 코딩 멈추고 인간에게 먼저 보고) 에 인접. 사후 정직 보고로 차단되나, 사전 진산님 보고가 정합.

**수정 권고**: handoff-032 §3 (정책 결정 사항) 에 "CHA-02 setTimeout bail 무용 — sync evaluate 본질 / 사전+사후 이중 방어 채택 사유" 명시. 진산님 사후 승인 또는 명세 갱신.

---

#### M-2: CHA-01 합격 기준 (a)/(d) "BATCH wire-up 이연" 대체 검증 — 선행 조건 미충족 사유로 명세 일탈

**위치**: cha-01-d1-disconnect.test.ts:9-20
**명세 인용**: Master Plan §CHA-01 합격 기준 (a) "BATCH 최종 status='completed'", (d) "checkpoint 파일 corruption=0", 선행 조건 "apps/batch wire-up 완료 (현 deferred)"
**증거**:

- (a) 대체: `successCount === 100` (test:179) — INSERT 100건 모두 PASS = "BATCH 최종 status='completed'" 의 **유사 신호** 일 뿐
- (d) 대체: `count.n === 100` (test:199) — INSERT 멱등성 = "checkpoint 파일 corruption=0" 의 **유사 신호** 일 뿐
- handoff §2.A 의 "현 deferred" 가 명시되어 있으나, Master Plan §CHA-01 의 "선행 조건: apps/batch wire-up 완료 (현 deferred)" 는 **본 시나리오 진입 가능 시점 명시 조건** — 미충족 상태로 진입하여 합격 기준 대체 검증

**평가**: handoff §2.A 의 "ADR-028 §4.1 정합" + commit/test 정직 명시로 일탈 추적성 확보. 그러나 합격 기준 텍스트 자체와 다른 검증 방식 채택은 **Sprint 1 종료 게이트 (P0 15/15 PASS)** 시점에 "CHA-01 PASS" 판정 가능 여부 모호.

**수정 권고**: handoff-032 §6 (이월 의무 ledger) 에 "CHA-01 wire-up 완료 시점 BATCH 통합 카오스 테스트 추가 의무" 명시 (본 commit message 4-pass 흡수 라인 정합). Sprint 1 종료 게이트 판정 시 "CHA-01 PARTIAL (대체 검증)" 명시 vs "PASS" 판정 진산님 결정.

---

#### M-3: CHA-02 합격 기준 (b) "engine.calculate() COMPUTE_TIMEOUT 매핑" 직접 회귀 방어 부재

**위치**: cha-02-compute-timeout.test.ts:130-160 (Section 3)
**명세 인용**: Master Plan §CHA-02 합격 기준 (b) "error.code='COMPUTE_TIMEOUT'"
**증거**:

- engine.ts:67-77 (parse-time CalculationTimeoutError → COMPUTE_TIMEOUT 매핑) — 본 테스트에서 발화 안 함 (등록 산식 전부 < 50 노드)
- engine.ts:88-94 (eval-time 매핑) — 본 테스트에서 발화 안 함 (정상 evaluate < 1ms)
- test:139-153 mocked compiled 만 safeEvaluate 직접 검증, engine.calculate() 미호출
- test:155-160 calculate('F-01') 정상 케이스만 회귀 — COMPUTE_TIMEOUT 매핑 분기 발화 X

**평가**: engine.ts:67-77 / 88-94 의 매핑 코드 자체의 회귀 방어 보장 부재. 향후 mathjs 회귀 / 신규 산식이 매핑 코드 미경유 시 경보 X.

**수정 권고**: 다음 중 하나 추가 —

- (A) Spy on `safeParse` to throw CalculationTimeoutError, then assert `calculate('F-01', ...)` returns FormulaError code='COMPUTE_TIMEOUT'.
- (B) F-99 "악의적 등록 산식" 테스트 fixture (registry 에 임시 등록 + cleanup) 로 매핑 코드 직접 발화.

---

#### M-4: CHA-02 합격 기준 (c) 메모리 누수 임계 5× 완화 (1MB → 5MB) 사유 정직 명시 부재

**위치**: cha-02-compute-timeout.test.ts:170-188
**명세 인용**: Master Plan §CHA-02 합격 기준 (c) "메모리 누수=0 (3회 반복 후 heap delta < 1MB)"
**증거**:

- 구현: 100회 반복 + < 5MB
- test:170 사유 "100회 반복 (10× 강화) + delta 5MB 한도 (Vitest GC 주기 변동 흡수)"
- 그러나 5× 완화 사유가 "Vitest GC 주기" 라는 환경 한정 사유 — 실제 누수 1MB 이하 보장 X

**평가**: "100회면 명백히 5MB 초과" 라는 정직 추론은 합리적이나, **"3회 후 < 1MB" 의 의도 (작은 누수도 즉시 검출)** 는 약화됨. 4MB / 99회 누수 (≈40KB/iter) 케이스 검출 X.

**수정 권고**: 다음 중 하나 추가 —

- (A) 1000회 반복 + < 5MB 검증 (대규모 누수만 검출)
- (B) 100회 반복 + 1MB 한도 + `--expose-gc` + 3회 강제 GC 후 측정
- (C) heap delta 측정 외 `WeakRef` 기반 instance count 측정

---

### 🟢 MINOR

#### m-1: CHA-02 시나리오 입력 명세 일탈 (1000회 → 300회, 50중첩 → 35중첩) — MAX_EXPRESSION_LENGTH 한도 사유

**위치**: cha-02-compute-timeout.test.ts:36-40, 65-68
**평가**: MAX_EXPRESSION_LENGTH=1024 한도 안에서 MAX_AST_NODE_COUNT=500 / MAX_AST_DEPTH=30 초과 필요 → 입력 수치 적정화 합리. test:36-40 정직 명시.
**수정 권고**: handoff-032 §6 또는 v1.2 보고서에 "Master Plan §CHA-02 입력 수치 vs 실 한도 강화 결과 일탈" 명시.

---

#### m-2: CHA-04 합격 (a) "abs()" → "Math.max(0, ...)" 텍스트 차이

**위치**: recover.ts:186 vs Master Plan §CHA-04 합격 기준 (a)
**평가**: 의미 동일 (음수 elapsed 모두 0 처리). 텍스트 차이만.
**수정 권고**: v1.2 보고서에 "CHA-04 (a) 'abs()' 명세 → 'Math.max(0, ...)' 구현 / 의미 동일" 명시.

---

#### m-3: CHA-02 측정 도구 `performance.now()` 명세 → `Date.now()` 구현

**위치**: sandbox.ts:359, 361 vs Master Plan §CHA-02 측정 도구
**평가**: Workers 의 `performance.now()` 와 `Date.now()` 모두 ms 단위 동일 인터페이스 (sandbox.ts:358 정직 명시). monotonic 보장은 performance.now() 만 — wall-clock skew 시 Date.now() 음수 elapsed 가능. 그러나 본 측정은 단일 함수 내부 elapsed 이라 < 50ms 측정 영향 미미.
**수정 권고**: 미수정 — 정직 명시로 충분.

---

#### m-4: CHA-04 (a) 명세 매핑 검증의 `state='killed'` 우회 (test:314)

**위치**: cha-04-clock-skew.test.ts:308-339 (Section 4)
**평가**: state='killed' 로 concurrent_run 블록 우회 → checkpoint 통과 → fully_recovered 검증. 그러나 Master Plan §CHA-04 시나리오 "T=0 시작 / T=600s -10분 / T=900s 정상" 은 **state='in_progress'** 정상 흐름. state='killed' 는 명세에 없는 가정.
**수정 권고**: state='in_progress' + 24h 진행 후 시나리오로 추가 (또는 본 테스트 본문에 "killed 가정 사유" 정직 명시 추가).

---

## 7. Devil's Advocate 반론 (auto-review-protocol 규칙 3)

### 반론 1: "CHA-02 가 sync evaluate 본질 한계로 무한 루프 hang 본질적 미해결" → 합격 기준 (a) 의도와 차이

test:11-12 의 정직 명시 ("sync 코드 preempt 불가") 는 양날의 칼. **사용자 입력 산식이 (악의적이 아닌) 단순 큰 산식** 이라면 사전 AST 차단으로 graceful 거부 가능. 그러나 **mathjs 라이브러리 자체의 회귀** (예: `pow(2, 1000)` 같은 단일 노드 폭탄) 는 nodeCount=2 / depth=2 로 차단 불가능. wall-clock 사후 차단도 sync evaluate 진행 중에는 발화 안 함 (return 후 측정).

**시나리오**: `pow(2, 10000)` → `Number.POSITIVE_INFINITY` 즉시 반환 (mathjs 내부 fast path) 또는 hang. 본 테스트 미커버. F-XX 중 pow 사용 산식이 신규 등록 시 위험.

### 반론 2: "CHA-01 mulberry32 PRNG 결정성" 이 실은 spec 의 "10%" 를 보장하지 못함

test:64-69 검증 "100회 표본 → 5~15건 (±5)" 는 통계적 분산 허용. seed=42 의 정확 시퀀스에서 실제 비율은 검증 안 함. 다른 seed (예: seed=43) 에서 100회 표본 0건 또는 30건 시나리오 발생 가능. spec 의 "10% rate" 는 **통계적 평균** 이라기보다 **실 운영 환경 D1 disconnect 평균치** — 본 테스트는 의도 (10% rate 시뮬레이션) 가 정확히 검증 안 됨.

### 반론 3: "CHA-04 vi.useFakeTimers" 가 실 wall-clock skew 미검증

vi.useFakeTimers 는 **JavaScript Date.now() / setTimeout 만 mock**. 실제 OS 의 NTP 보정 / monotonic clock / TZ 변경 시나리오 미커버. recover.ts:186 의 `Math.max(0, ...)` 가 **부동소수점 elapsed (μs) 변환 시 오차** 케이스 미검증. UTC vs KST 혼합 (시험 응시자 IP-based TZ 가 BATCH 적재 시점 TZ 와 다른 경우) 미검증.

---

## 8. 종합 판정

**4-Pass CONTRACT 결과**: ✅ PASS 14건 / 🔴 CRITICAL 1건 / 🟠 MAJOR 4건 / 🟢 MINOR 4건 / N/A 2건

**판정**: **수정 필요**

**완료 선언 차단 사유**: auto-review-protocol §"Critical 0건이어야 완료 선언 가능" — C-1 (L3 plan 부재) 미해결.

**즉시 흡수 의무**:

- C-1: handoff-032 작성 시 진산님 retroactive 승인 또는 사후 plan/ADR 작성.
- M-1: handoff-032 §3 "CHA-02 setTimeout bail 무용 — 이중 방어 채택 사유" 진산님 보고.
- M-2: handoff-032 §6 ledger "CHA-01 wire-up 완료 시점 BATCH 통합 카오스 테스트 의무" 명시.
- M-3: 다음 4-Pass 진행 전 engine.calculate() COMPUTE_TIMEOUT 매핑 직접 회귀 방어 추가.
- M-4: §5.4 commit 동시 흡수 (메모리 누수 임계 강화 또는 사유 정직 명시 강화).

**§5.4 진입 가능 여부**: C-1 흡수 후 진입 가능. M-1~M-4 는 §5.4 commit 동시 흡수 (handoff-031 §3.2 옵션 A "MAJOR 이월 흡수 시점 — §5.4 동시 묶음" 정합).

---

**리뷰어 시그니처**: Pass 4 CONTRACT (quality-engineer 독립 페르소나) — 메인 작성 컨텍스트 무관 / Master Plan v1.0 + handoff-031 + ADR-028 + test-patterns.md + CLAUDE.md + production-quality.md + dev-guide.md 7 문서 직접 인용
**리뷰 효력**: 2026-05-02 KST
**다음 행동**: handoff-032 §3 진산님 정책 결정 사항 진입 (C-1 흡수 결정 의무)
