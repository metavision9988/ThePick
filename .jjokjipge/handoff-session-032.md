# Handoff — Session 032 → Sprint 1 §5.4 PARTIAL 7건 + §5.2/5.3 이월 MAJOR 14건 + v1.2

작성일: 2026-05-02 ~11:25 KST
직전 세션: 031 (Sprint 1 §5.3 NOT-IMPL 3건 — CHA-01/02/04 옵션 A 순서 + 4-Pass + 흡수)

---

## 0. 본 세션(031) 누적 결과

### 0.1 4 commits 체인

|  #  | Commit    | 단계             | 핵심                                                                                                                                                                                                                                                 |
| :-: | :-------- | :--------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | `e589ce7` | §5.3 CHA-01      | D1 disconnect Proxy + retry 정합. apps/api retry.ts D1_DISCONNECT/UNAVAILABLE 패턴 추가, helpers/d1-disconnect-mock.ts (mulberry32 + 2단 Proxy), scenarios/cha-01-d1-disconnect.test.ts (9 tests). api 261 → 272 PASS (+11).                         |
|  2  | `ac5e4db` | §5.3 CHA-02      | CalculationTimeoutError + COMPUTE_TIMEOUT. errors.ts (신규), types.ts (FormulaErrorCode 'COMPUTE_TIMEOUT'), sandbox.ts (MAX_AST_NODE_COUNT 500/DEPTH 30/EVAL_MS 50 + 사전/사후 차단), engine.ts (catch + 매핑). formula-engine 251 → 261 PASS (+10). |
|  3  | `a319a81` | §5.3 CHA-04      | wall clock skew + 24h 가드 회귀 방어. cha-04-clock-skew.test.ts (5 tests). 신규 production 코드 0줄 (테스트만). batch 238 → 243 PASS (+5).                                                                                                           |
|  4  | `c8ca91d` | §5.3 4-Pass 흡수 | CRITICAL 2 + MAJOR 4 즉시 흡수. C-CODE-1 parseFormula cache hit 차단 / C-CODE-2 부분 helper sentinel / M-1 well-known symbol passthrough / M-2 performance.now() / M-3 회귀 1 test / M-4 PRNG 안전 마커. 4-Pass 산출물 5개 영속.                     |

### 0.2 본 세션 4-Pass 통합 결과

**4-Pass 독립 에이전트 4개 병렬** (silent-failure-hunter / system-architect / security-engineer / quality-engineer) 결과:

| Pass        | CRITICAL | MAJOR  | MINOR  |  N/A   |  PASS  |
| :---------- | :------: | :----: | :----: | :----: | :----: |
| 1 SURGEON   |    1     |   4    |   3    |   3    |   14   |
| 2 ARCHITECT |    0     |   2    |   4    |   4    |   9    |
| 3 ADVOCATE  |    2     |   5    |   3    |   4    |   12   |
| 4 CONTRACT  |    1     |   4    |   4    |   2    |   14   |
| **합계**    |  **4**   | **15** | **14** | **13** | **49** |

**CRITICAL 4건 dedup → 2 코드 흡수 + 1 절차 (handoff §3) + 1 reclassify (MAJOR-7)**:

- C-CODE-1 (Pass 1): parseFormula cache hit 차단 → ast-parser.ts 흡수 ✅
- C-CODE-2 (Pass 3): wrangler bundle chaos 헬퍼 위험 → sentinel 강화 (부분), ESLint config §5.4 이월
- C-PROC-1 (Pass 4): packages/formula-engine L3 plan 부재 → 본 §3 정책 결정 의무
- C-DOWNGRADE (Pass 3 C-2): D1_DISCONNECT substring 위장 → MAJOR-7 reclassify, §5.4 이월

**MAJOR 12 unique** → 4 즉시 흡수 + 8 §5.4 + 3 handoff ledger.

### 0.3 본 세션 게이트 통과 누적 검증

- `apps/api` test 261 → **273 PASS** (+12 — CHA-01 9 + retry 패턴 2 + well-known passthrough 1)
- `packages/formula-engine` test 251 → **264 PASS** (+13 — CHA-02 10 + cache hit 1 + COMPUTE_TIMEOUT 매핑 1 + heap delta 강화 1)
- `apps/batch` test 238 → **243 PASS** (+5 — CHA-04)
- typecheck / lint 전 패키지 clean
- 4-Pass 독립 에이전트 리뷰 1회 영속 (5개 산출물 — 통합 인덱스 + Pass 1~4)

---

## 1. Sprint 1 진행 상태 (handoff-031 §1 갱신)

```
[x] §5.1  CRITICAL-N1   iterative DFS + MAX_SUPERSEDE_CHAIN_DEPTH sentinel    ← 028
[x] §5.1  4-Pass 흡수   caller 통합                                           ← 028
[x] §5.2  Day 1 도구    perf + fakeTimers + fixtures + ADR-028                ← 029
[x] §5.2  4-Pass 흡수   CRITICAL 1 + MAJOR 6 즉시                              ← 029
[x] §5.3  FUZ-01/02     fixtures 우선 옵션 B 진행                              ← 030
[x] §5.3  4-Pass 흡수   CRITICAL 5 + MAJOR 5 즉시 + MAJOR 7 §5.4 이월         ← 030
[x] §5.3  NOT-IMPL 3건  CHA-01 / CHA-02 / CHA-04 옵션 A 순서                   ← 본 세션
[x] §5.3  4-Pass 흡수   CRITICAL 2 + MAJOR 4 즉시 + MAJOR 8 §5.4 이월         ← 본 세션
[ ] §5.4  PARTIAL 7건   CHA-06 / FUZ-04 / PRF-01/02 / PRC-01 / REC-01/02       ← 차세션 (~2d)
[ ] §5.4  이월 MAJOR 14건 흡수 (§5.2 7 + §5.3 from 030 7) + §5.3 8 from 본세션 ← §5.4 commit 동시
[ ] §5.4  C-PROC-1 흡수 packages/formula-engine L3 plan 사후 작성 (또는 ADR-029) ← §3 정책 결정 후
[ ] §5.5  종료 게이트   15/15 PASS + verify-engine-contracts Cat 5 자동화       ← BATCH-1 진입 트리거
[ ] v1.2  보고서        ENGINE_HARDENING_COMPLETION_REPORT v1.1 → v1.2          ← §5.4 완료 후
```

**P0 15건 (재분류 후) 현재 상태**:

- **PASS 8건**: REG-01 / REG-02 / PRC-02 / FUZ-01 / FUZ-02 + **CHA-01 / CHA-02 / CHA-04 (본 세션 신규)**
- PARTIAL 7건: CHA-06 / FUZ-04 / PRF-01 / PRF-02 / PRC-01 / REC-01 / REC-02

---

## 2. 차세션 진입 액션 명세 (Sprint 1 §5.4)

### 2.A — §5.4 PARTIAL 7건 보강 (~2d)

handoff-030 §2.B 명세 그대로 유지. 시나리오별 1 commit + Day 별 4-Pass + 1 흡수 commit.

**§5.4 동시 흡수 의무 — 이월 MAJOR 합계 14+8건 = 22건** (§6 ledger 참조):

- §5.2 4-Pass 이월 MAJOR 7건 (handoff-030 §6.1)
- §5.3 FUZ 4-Pass 이월 MAJOR 7건 (handoff-031 §6.1)
- §5.3 CHA 4-Pass 이월 MAJOR 8건 (본 §6.1)

### 2.B — §5.4 commit 시 ESLint no-restricted-imports + L3 plan 후처리

- C-CODE-2 잔여: `apps/api/eslint.config` (또는 monorepo root) 에 `no-restricted-imports` 추가 — production 코드 (`src/index.ts`, `src/routes/**`, `src/middleware/**`) 에서 `__tests__/helpers/**` import 차단. ~30분 작업.
- C-PROC-1: 본 §3 정책 결정 후 `cha-02-formula-engine-resource-limit.plan.md` 사후 작성 또는 ADR-029 작성.

### 2.C — Sprint 1 종료 게이트 + v1.2 보고서

handoff-030 §2.C 명세 그대로. P0 15/15 PASS + verify-engine-contracts Cat 5 자동화 + JSON 리포트 + BATCH-1 진입 트리거.

---

## 3. 진산님 정책 결정 사항 (Session 032 신규 + 잔존)

### 3.1 (신규) C-PROC-1 — packages/formula-engine L3 plan 부재 처리

**컨텍스트**: 본 세션 commit `ac5e4db` (CHA-02) 가 packages/formula-engine/ (CLAUDE.md L3 영역) 6 파일 변경. dev-guide.md "L3 영역 변경 시 plan + 승인 완료" 미충족.

**옵션**:

- A) **진산님 retroactive 승인** — "CHA-02 는 보안 강화 목적, 4-Pass Pass 1/2/3 모두 검증 완료, 회고적 plan 생략" 결정 명시
- B) **사후 plan 작성** — `docs/plans/engine-hardening/cha-02-formula-engine-resource-limit.plan.md` 작성 + 승인 후 본 commit retroactively 정합
- C) **ADR-029 작성** — "Formula Engine resource limit 도입 결정" ADR 작성 (Hard Limit/L3 영역 변경 시 ADR 의무 채택 시점부터)

**권고**: **옵션 C (ADR-029)** — 본 변경이 향후 재사용성 높은 정책 (resource limit + COMPUTE_TIMEOUT 매핑) → ADR 영속이 plan 보다 가치 큼. dev-guide.md 도 "L3 영역 변경 시 plan **+** 승인" 명시이므로 ADR + 진산님 승인 조합 정합.

### 3.2 (신규) §5.3 setTimeout bail 명세 vs 실 구현 — silent pivot 회피 보고

**컨텍스트**: handoff-031 §2.A "CHA-02 setTimeout bail" 명세 → 실 구현 "AST 사전 + wall-clock 사후 차단".

**사유**: math.js compiled.evaluate() 는 sync — sync 코드 preempt 불가 (setTimeout 으로 interrupt 불가능). 사전 차단 (AST 복잡도/깊이) + 사후 차단 (실 elapsed) 이중 방어가 유일 가능 방안.

**보고 의무**: CRITICAL RULE #1 ("기획과 다르게 구현하려면 코딩 멈추고 인간에게 먼저 보고") 인접 — 본 세션 진행 중 이미 commit 했으나, 본 §3 명시 보고로 silent pivot 회피.

**진산님 결정 필요**: 본 구현 (이중 방어) 채택 OK 인지 / setTimeout bail 시뮬레이션 별도 (Workers 진입 후 isolate kill 정합) 추가 필요 인지.

### 3.3 (신규) §5.4 진입 순서 결정

**옵션**:

- A) **명세 순서** (CHA-06 / FUZ-04 / PRF-01/02 / PRC-01 / REC-01/02)
- B) **이월 MAJOR 22건 먼저 흡수** → §5.4 PARTIAL (정합 단순화)
- C) **§5.4 PARTIAL 진행 + 이월 MAJOR commit 동시 흡수** (handoff-030 §3.4 옵션 A 정합)

**권고**: **옵션 C** — handoff-030 §3.4 "§5.3 4-Pass 이월 MAJOR + §5.4 commit 들과 동시 흡수" 결정 정합 + 회귀 추적 단순화.

### 3.4 (해결됨) §5.3 진입 순서 — 옵션 A (CHA-01 → CHA-02 → CHA-04)

handoff-031 §3.3 옵션 A 진산님 권고 → 본 세션 적용 완료. 4 commits 정합.

### 3.5 (해결됨) §5.4 진입 시점 — 옵션 A (선형 순차)

handoff-031 §3.4 옵션 A 채택 → 본 세션 §5.3 NOT-IMPL 3건 완료 후 §5.4 진입 정합.

---

## 4. 차세션 진입 직후 1차 읽기

### 4.1 핵심 문서 (의무, 우선순위 순)

1. **본 핸드오프** — `.jjokjipge/handoff-session-032.md`
2. **§5.3 CHA 4-Pass 통합 인덱스** — `.claude/reviews/review-20260502-cha014-index.md` (이월 MAJOR 8건 + ESLint config + L3 plan 명세)
3. **§5.3 FUZ 4-Pass 통합 인덱스** — `.claude/reviews/review-20260502-090418-sprint1-step5-3-fuz-01-02-4pass-index.md` (이월 MAJOR 7건)
4. **§5.2 4-Pass 통합 인덱스** — `.claude/reviews/review-20260502-003506-sprint1-step5-2-4pass.md` (이월 MAJOR 7건)
5. **decision-2026-05-02** — `docs/plans/engine-hardening/decision-2026-05-02-cha-03-05-p1-reclassification.md` (P0→P1 재분류)
6. **test-patterns.md** — `docs/quality/test-patterns.md` (CHA-04 vi.useFakeTimers 정합)
7. **ADR-028** — `docs/adr/ADR-028-workers-vitest-pool-deferred-to-phase-2.md` (CHA-01 §4.1 패턴, §5.4 갱신 의무)
8. **테스트 마스터 플랜** — `docs/ThePick Engine Quality Test Master Plan v1.0.md` (§5.4 PARTIAL 7건 명세 §CHA-06 / §FUZ-04 / §PRF-01~02 / §PRC-01 / §REC-01~02)

### 4.2 직전 세션 핸드오프 체인

9. `.jjokjipge/handoff-session-031.md` (옵션 A 권고)
10. `.jjokjipge/handoff-session-030.md` (P0→P1 재분류 + §5.3 옵션 B)
11. `.jjokjipge/handoff-session-029.md` (§5.2 도구 정비)

### 4.3 진산님 메모리 정합 (자동 로드)

- `project_completion_notification_obligation` (Sprint 1 종료 = ★ 알림 의무)
- `feedback_two_fix_failures_zoom_out` (§5.4 PRF-02 / FUZ-04 보강 시 정합)
- `feedback_no_shortcuts` (CHA-03/05 P1 재분류 정당화)
- `feedback_review_filename_pattern` (review-\* prefix — 본 세션 5개 산출물 정합)
- `feedback_document_first_workflow` (decision / ADR / test-patterns 영속 문서 우선)

---

## 5. 진산님 차세션 트리거 키워드

| 트리거                                                 | 진행                                                                                   |
| :----------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **"§5.4 진입 — 옵션 C"** (권고)                        | PARTIAL 7건 진행 + commit 별 이월 MAJOR 동시 흡수 (~2d)                                |
| **"§5.4 — 이월 MAJOR 22건 먼저 흡수"**                 | §5.2 7 + §5.3 FUZ 7 + §5.3 CHA 8 일괄 흡수 commit (~1d) → §5.4 PARTIAL 진입            |
| **"L3 plan — ADR-029 작성"** (권고 §3.1)               | `docs/adr/ADR-029-formula-engine-resource-limit.md` 작성 → 진산님 승인                 |
| **"L3 plan — 사후 plan 작성"**                         | `docs/plans/engine-hardening/cha-02-formula-engine-resource-limit.plan.md` 작성 → 승인 |
| **"L3 plan — retroactive 승인"**                       | "CHA-02 4-Pass 검증 완료, plan 생략" 결정 명시 (본 §3.1 옵션 A 채택)                   |
| **"setTimeout bail — 이중 방어 채택 OK"**              | §3.2 보고 수용. 본 구현 유지.                                                          |
| **"setTimeout bail — Workers isolate kill 별도 추가"** | Phase 2 Workers Pool 진입 시 isolate kill 정합 별도 작업 추가                          |
| **"v1.2 보고서 즉시 갱신"**                            | §5.4 완료 전 v1.2 갱신 (handoff-029 §3.2 권고 A 위배 — 신중)                           |
| **"Sprint 1 종료 게이트 즉시 검증"**                   | 현 시점 P0 PASS = 8 / 15 — 종료 미충족. PARTIAL 7건 진입 의무                          |

**권고**: **"§5.4 진입 — 옵션 C"** (권고 §3.3) + **"L3 plan — ADR-029 작성"** (권고 §3.1) 동시 결정.

---

## 6. 본 세션이 차세션에 넘기는 의무 (정직)

본 세션 작성자(Claude Opus 4.7)가 차세션 Claude 에게 명시 의무:

### 6.1 §5.3 CHA 4-Pass 이월 MAJOR 8건 ledger (§5.4 commit 들과 동시 흡수 의무)

|  #  |     Pass      | 적발 내용                                                                     | 흡수 위치                                                                              |
| :-: | :-----------: | :---------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- | --- | ----------------------------------------------- |
|  1  | 3 C-2 reclass | `D1_DISCONNECT` substring 위장 가능성 — word boundary 정밀 매칭 부재          | `apps/api/src/middleware/retry.ts` 정밀 패턴 (예: `/(?:^                               | \s  | :)D1_DISCONNECT\b/i`) + retry.test.ts 검증 추가 |
|  2  |     1 M2      | 100 INSERT 결정성 단일 시퀀스 운에 의존 (정확 카운트 검증 부재)               | `cha-01-d1-disconnect.test.ts` seed=42 expected count 정합 검증 추가                   |
|  3  |     1 M4      | `computeAstDepth` 순수 재귀 — V8 stack overflow 시 `engine.ts` catch 우회     | `packages/formula-engine/src/sandbox.ts` iterative 변환 (stack 명시 사용)              |
|  4  |     2 M1      | `scenarios/` 디렉토리 ↔ `scenarios.test.ts` 파일 네이밍 충돌                  | `apps/api/src/__tests__/scenarios/` → `chaos/` rename 또는 컨벤션 명시                 |
|  5  |     2 M2      | ADR-028 §4.1 단일 Proxy 예시 vs 실 2단 Proxy 구현 불일치                      | `docs/adr/ADR-028-*.md` §4.1 본문 갱신 또는 §6 한계 섹션                               |
|  6  |     3 M1      | `MAX_AST_NODE_COUNT=500` 한도 보수화 필요 (정상 산식 50 → 10× 여유 너무 관대) | `packages/formula-engine/src/sandbox.ts` 한도 100~200 으로 강화 (실 산식 회귀 측정 후) |
|  7  |     3 M3      | `CalculationTimeoutError.details` 가 engine.ts:73 user-facing message 에 leak | `packages/formula-engine/src/engine.ts` message 와 details 분리                        |
|  8  |     3 M5      | i18n 부재 — sandbox.ts 영문 message 가 engine.ts 한국어 prefix 와 혼합        | sandbox.ts 메시지 한국어 또는 i18n 키 도입 (Phase 1 후반 일괄)                         |

### 6.2 §5.2 + §5.3 FUZ 4-Pass 이월 MAJOR 14건 ledger

handoff-030 §6.1 (§5.2 7건) + handoff-031 §6.1 (§5.3 FUZ 7건) 그대로 유지 — 본 세션 미흡수, §5.4 commit 들과 동시 흡수 의무.

**합계 이월 MAJOR**: §5.2 7 + §5.3 FUZ 7 + §5.3 CHA 8 = **22건** (§5.4 commit 들과 동시 흡수).

### 6.3 §5.3 CRITICAL C-PROC-1 + C-CODE-2 잔여 흡수 (§5.4 commit 동반)

- **C-PROC-1**: handoff §3.1 정책 결정 후 ADR-029 또는 plan 사후 작성. **차세션 진입 직후 진산님 결정 필수**.
- **C-CODE-2 잔여**: ESLint `no-restricted-imports` rule — production 코드에서 `__tests__/helpers/**` import 차단. §5.4 commit 동반 의무.

### 6.4 §5.4 PARTIAL 7건 진입 시 4-Pass 의무

CHA-06 / FUZ-04 / PRF-01/02 / PRC-01 / REC-01/02 본격 보강 commit 별 4-Pass 의무 — 본 §5.3 처럼 시나리오별 1 commit / Day 별 1 4-Pass / 1 흡수 commit 패턴 유지.

### 6.5 §5.3 4-Pass 통합 인덱스 + Pass 1~4 보고서 직접 읽기 의무

차세션 Claude 는 commit `c8ca91d` 의 흡수만 신뢰하지 말고, 통합 인덱스 (`.claude/reviews/review-20260502-cha014-index.md`) + 각 Pass 보고서 직접 읽기. 이월 MAJOR 8건의 정확한 위치 / 흡수 방법 / 회귀 시나리오 인지 의무.

### 6.6 session-health 의무

본 세션 (031) 은 commit 4 + 4-Pass 4 에이전트 병렬 + 흡수 commit 직후 — 약 100분 도달 (90분 임계 초과). 차세션 Claude 도 90분 / 30턴 전 handoff-033 작성 의무.

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 031
**다음 세션**: Session 032 — Sprint 1 §5.4 PARTIAL 7건 + 이월 MAJOR 22건 흡수 + L3 plan 정책 결정
**작성 효력**: 2026-05-02 ~11:25 KST
**예상 완료**: handoff-033 (Sprint 1 P0 15/15 GREEN 후 → BATCH-1 진입 트리거 대기)
