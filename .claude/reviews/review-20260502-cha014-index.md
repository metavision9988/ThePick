# Sprint 1 §5.3 CHA-01 + CHA-02 + CHA-04 — 4-Pass 통합 인덱스

**작성일**: 2026-05-02 ~11:15 KST
**작성자**: Claude (Opus 4.7 1M context) — Session 031
**리뷰 방식**: 독립 에이전트 4개 병렬 (silent-failure-hunter / system-architect / security-engineer / quality-engineer)
**리뷰 범위**: commit 3건 (`e589ce7` CHA-01 + `ac5e4db` CHA-02 + `a319a81` CHA-04) + 변경 11파일 + 연관 8파일
**근거 문서**: `.claude/rules/auto-review-protocol.md`

---

## 0. 종합 결과

| Pass        | 에이전트              |  PASS  | CRITICAL | MAJOR  | MINOR  |  N/A   |
| :---------- | :-------------------- | :----: | :------: | :----: | :----: | :----: |
| 1 SURGEON   | silent-failure-hunter |   14   |    1     |   4    |   3    |   3    |
| 2 ARCHITECT | system-architect      |   9    |    0     |   2    |   4    |   4    |
| 3 ADVOCATE  | security-engineer     |   12   |    2     |   5    |   3    |   4    |
| 4 CONTRACT  | quality-engineer      |   14   |    1     |   4    |   4    |   2    |
| **합계**    | —                     | **49** |  **4**   | **15** | **14** | **13** |

**판정**: 수정 필요 — CRITICAL 2건 즉시 코드 흡수 + 1건 절차 흡수 (handoff-032 §3 정책 결정) + Pass 3 C-2 MAJOR 재분류.

---

## 1. CRITICAL dedup (4건 → 2 코드 + 1 절차 + 1 reclassify)

### C-CODE-1 (Pass 1) — parseFormula 캐시가 CalculationTimeoutError 차단 영구 우회

**증거**: `packages/formula-engine/src/ast-parser.ts:40-66`. cache hit 분기가 `safeParse` 자체를 건너뛰어 `assertWithinComplexityBudget` 미실행. 동일 산식 반복 호출 시 처음 통과 후 한도 변경 (MAX_AST_NODE_COUNT 강화) 시점에도 캐시된 산식은 영원히 신규 검증 우회.

**위험**: 회귀 vector 영구 활성. CHA-02 의 사전 차단 보장 신뢰성 무효.

**흡수**: `parseFormula` cache hit 분기 진입 직전 `assertWithinComplexityBudget(cached.node)` 재실행 추가.

### C-CODE-2 (Pass 3) — wrangler 번들에 chaos 헬퍼 포함 회귀 vector

**증거**: `apps/api/src/__tests__/helpers/d1-disconnect-mock.ts` 가 wrangler entry (`src/index.ts`) 와 동일 트리 안. `.wranglerignore` 부재 + `tsconfig.json` `include: ["src/**/*"]` 광역 + ESLint `no-restricted-imports` 미설정 → 누군가 1줄 import 추가 시 production Workers 에 `SimulatedD1DisconnectError` + `mulberry32` PRNG 가 활성 코드로 배포되는 회귀 vector 영구 열려 있음.

**위험**: 본 시점은 import 0건이라 안전, 그러나 회귀 방어 부재 = 시점만 다른 동일 사고.

**흡수 (2단계)**:

- **본 commit**: 헬퍼 파일 모두 `@internal — TEST ONLY` sentinel 강화 + JSDoc 경고 + 본 인덱스 §3 ledger 명시.
- **§5.4 commit (이월)**: ESLint `no-restricted-imports` rule 추가 — production 코드에서 `__tests__/helpers/**` import 차단. (apps/api/eslint config 파악 + monorepo 정합 의무, ~30분 작업).

### C-PROC-1 (Pass 4) — packages/formula-engine 변경에 L3 plan 부재

**증거**: commit `ac5e4db` (CHA-02) 가 `packages/formula-engine/` (CLAUDE.md L3 영역) 6 파일 변경. `docs/plans/engine-hardening/` 에 `cha-02-formula-engine-resource-limit.plan.md` 부재. dev-guide.md "L3 영역 변경 시 plan + 승인 완료" 미충족.

**위험**: 절차적 위반. 코드 자체는 안전 (4-Pass Pass 1/2/3 모두 검증), 그러나 향후 L3 변경 패턴 정합 깨짐.

**흡수**: 코드 수정 X. handoff-032 §3 정책 결정 — (A) 진산님 retroactive 승인 / (B) 사후 plan 작성 / (C) ADR-029 작성 중 택일.

### C-DOWNGRADE (Pass 3 C-2 → MAJOR-7 재분류) — D1_DISCONNECT substring 위장

**증거**: `retry.ts:50` 의 `/D1_DISCONNECT/i` 단순 substring 매칭. 향후 정책 변경 시 공격자 제어 페이로드가 D1_DISCONNECT substring 위장으로 retry 폭주 매개체 가능성.

**재분류 사유**:

1. D1 에러 메시지는 D1 service 가 생성 — 사용자 입력 통제 불가.
2. 현재 NON_RETRYABLE 우선순위 보호 (D1_CONSTRAINT 등) 가 1차 방어.
3. 위협 시나리오 모두 가설적 (현 시점 미존재).

**흡수**: §5.4 commit 흡수 (정밀 패턴 — word boundary 또는 prefix anchor).

---

## 2. MAJOR 15건 dedup (12 unique)

### 2.1 본 commit 즉시 흡수 — 4건

|  #  |    Pass     | 적발                                                                                                                                           | 흡수                                                                       |
| :-: | :---------: | :--------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------- |
|  1  |    1 M1     | `withDisconnect` Proxy `get` 트랩이 `then`/`Symbol.*`/`constructor`/`toString` 등 well-known symbol 까지 fail 주입 → `await flakyDb` 즉시 발화 | well-known symbol allowlist + 함수형 속성 외 passthrough                   |
|  2  | 1 M3 + 3 M2 | `safeEvaluate` `Date.now()` 측정이 `vi.useFakeTimers` 활성 컨텍스트에서 사후 차단 우회                                                         | `performance.now()` 우선 + `Date.now()` fallback (Workers 양쪽 가용)       |
|  3  |    4 M3     | `engine.calculate()` COMPUTE_TIMEOUT 매핑 분기 (engine.ts:67-77, 88-94) 직접 회귀 방어 부재                                                    | mocked-compiled `safeEvaluate` 검증 외 `calculate()` 진입 회귀 1 test 추가 |
|  4  | 3 C-1 부분  | helper 파일 `@internal — TEST ONLY` sentinel 미강화                                                                                            | d1-disconnect-mock.ts JSDoc 경고 강화 + 파일 헤더 sentinel                 |

### 2.2 §5.4 PARTIAL 보강 동시 흡수 — 8건

|  #  |     Pass      | 적발                                                                                                  | 이월 사유                                                |
| :-: | :-----------: | :---------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
|  5  | 3 C-2 reclass | `D1_DISCONNECT` substring 위장 가능성 — word boundary 정밀 매칭 부재                                  | retry.ts 정밀 패턴 + isRetryable 검증 ~30분              |
|  6  |     1 M2      | 100 INSERT 결정성 단일 시퀀스 운에 의존 (정확 카운트 검증 부재)                                       | seed=42 expected count 정합 검증 추가                    |
|  7  |     1 M4      | `computeAstDepth` 순수 재귀 — V8 stack overflow 시 `engine.ts` catch 우회 throw propagate             | iterative 변환 (stack 명시 사용)                         |
|  8  |     2 M1      | `scenarios/` 디렉토리 ↔ `scenarios.test.ts` 파일 네이밍 충돌                                          | rename `scenarios/` → `chaos/` 또는 컨벤션 명시          |
|  9  |     2 M2      | ADR-028 §4.1 단일 Proxy 예시 vs 실 2단 Proxy 구현 불일치                                              | ADR-028 본문 갱신 (또는 §6 한계 섹션)                    |
| 10  |     3 M1      | `MAX_AST_NODE_COUNT=500` 한도 보수화 필요 (정상 산식 50 → 10× 여유 너무 관대)                         | 한도 100~200 으로 강화 (실 산식 회귀 측정 후)            |
| 11  |     3 M3      | `CalculationTimeoutError.details` 가 engine.ts:73 user-facing message 에 leak                         | message 와 details 분리, 사용자 노출 message 는 graceful |
| 12  |     3 M4      | `safeEvaluate` 사후 차단 한계 — 무한 루프 시 영원 hang (Workers 50ms isolate kill 시점 fallback 부재) | Phase 2 Workers Pool 진입 시 isolate kill 정합           |
| 13  |     3 M5      | i18n 부재 — sandbox.ts 영문 message 가 engine.ts 한국어 prefix 와 혼합                                | 한국어 message 또는 i18n 키 도입 (Phase 1 후반 일괄)     |

### 2.3 handoff-032 §6 ledger 이월 — 3건

|  #  | Pass | 적발                                                                                                              | 이월 사유                                                                 |
| :-: | :--: | :---------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| 14  | 4 M1 | handoff-031 §2.A "CHA-02 setTimeout bail" 명세 → 실 구현 "AST 사전 + wall-clock 사후"                             | handoff-032 §3 진산님 명시 보고 (silent pivot 회피)                       |
| 15  | 4 M2 | CHA-01 합격 (a)/(d) 의 "BATCH status='completed' / checkpoint corruption=0" 을 "INSERT 100건 / row count" 로 대체 | apps/batch wire-up 시점 통합 카오스 테스트 의무 명시                      |
| 16  | 4 M4 | CHA-02 합격 (c) 메모리 누수 임계 1MB → 5MB 완화 사유 약함                                                         | §5.4 commit 동시 흡수 (1000회 + < 5MB 또는 100회 + < 1MB + `--expose-gc`) |

**MAJOR dedup 합계**: 15건 적발 → 12 unique → 4 즉시 흡수 + 8 §5.4 + 3 handoff-032 ledger.

---

## 3. MINOR 14건 (보고만)

- Pass 1 Minor 3건 — JSDoc 명시 부족 / mulberry32 보안 마커 부재 / heap delta 측정 GC 의존
- Pass 2 Minor 4건 — D1_TIMEOUT explicit 부재 / fake timer 영향 / formula-engine examId 미사용 / CHA-01 examId 미사용
- Pass 3 Minor 3건 — mulberry32 cryptographic security 명시 부재 / retry × eval 자원 한도 dependency cycle / 헬퍼 파일 `@internal` 마커 부재
- Pass 4 Minor 4건 — CHA-02 입력 1000→300회 / abs() vs Math.max(0) / performance.now 명세 vs Date.now 구현 / Section 4 state='killed' 가정

---

## 4. 본 4-Pass Devil's Advocate 종합

1. **Pass 1**: parseFormula cache hit 시 한도 변경 후에도 우회 → CRITICAL 핵심
2. **Pass 1**: `await flakyDb` 의 thenable 검출이 Proxy then() 발화 → 단순 케이스 깨짐
3. **Pass 2**: 미래 D1 API 추가 (e.g., withSession 본격 활성) 시 silent break — Proxy allowlist 외 신규 메서드 자동 fail 주입
4. **Pass 3**: D1_DISCONNECT substring 매칭 회귀 vector
5. **Pass 4**: pow(2, 10000) 같은 단일 노드 폭탄 (nodeCount=2) 은 사전 차단 미작동, sync hang 시 사후 wall-clock 도 발화 안 함

---

## 5. 본 인덱스의 한계 (정직)

1. CRITICAL 2건 즉시 코드 흡수 의무 — §5.3 종료 게이트 진입 차단.
2. CRITICAL 1건 절차 — handoff-032 §3 정책 결정 후 ADR/plan 작성.
3. MAJOR 12건 dedup → 4 즉시 + 8 §5.4 + 3 handoff ledger.
4. 본 4-Pass 는 §5.3 commit 3건 한정 — §5.4 PARTIAL 7건 진입 시 별도 4-Pass 의무.
5. 테스트 카운트 변동 — apps/api 261 → 272 (+11) / formula-engine 251 → 261 (+10) / batch 238 → 243 (+5).

---

## 6. 본 4-Pass 산출물 보고서

| Pass | 보고서                                                      |
| :--: | :---------------------------------------------------------- |
|  1   | `.claude/reviews/review-20260502-cha014-pass1-surgeon.md`   |
|  2   | `.claude/reviews/review-20260502-cha014-pass2-architect.md` |
|  3   | `.claude/reviews/review-20260502-cha014-pass3-advocate.md`  |
|  4   | `.claude/reviews/review-20260502-cha014-pass4-contract.md`  |

---

**통합 인덱스 작성**: Claude (Opus 4.7 1M context) — Session 031
**리뷰 방식**: 독립 에이전트 4개 병렬 (auto-review-protocol §"규칙 0" 정합)
**다음 단계**: CRITICAL 2 + MAJOR 4 즉시 흡수 → 회귀 게이트 → 8 §5.4 + 3 handoff ledger → handoff-032 작성 → §5.4 진입
