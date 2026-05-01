# Handoff — Session 030 → Sprint 1 §5.3 NOT-IMPL 7건 + §5.4 PARTIAL 7건 + v1.2 보고서

작성일: 2026-05-02 ~00:40 KST
직전 세션: 029 (P0→P1 재분류 + Sprint 1 §5.2 도구 정비 + 4-Pass 흡수)

---

## 0. 본 세션(029) 누적 결과

### 0.1 3 commits 체인

|  #  | Commit    | 단계                 | 핵심                                                                                                                                                                                                                          |
| :-: | :-------- | :------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | `fefa64a` | P0→P1 재분류 결정    | CHA-03 / CHA-05 P0 → P1 재분류. Sprint 1 종료 게이트 17/17 → **15/15 PASS**. P1 게이트 18 → **20**. decision-2026-05-02 + Master Plan v1.0.1 패치 (§11.1/§11.2/§13.1) + Sprint 0 baseline banner.                             |
|  2  | `ba9ad2b` | §5.2 Day 1 도구 정비 | handoff-029 §2.A 6개 중 5개 도입 + 1개 (MSW) 명시 이연. perf wrapper (`@thepick/shared/test-helpers/perf`) / vi.useFakeTimers 패턴 / PDF malicious 5종 / Claude malformed 8종 / ADR-028 / .prettierignore. shared 33→46 PASS. |
|  3  | `49335c5` | §5.2 4-Pass 흡수     | CRITICAL 1 (test-patterns.md fixture 경로 거짓) + MAJOR 6건 즉시 흡수. shared 46→**50 PASS** (+4 회귀). Master Plan §12/§14 자기모순 정정. PDF README OOM 경고 banner.                                                        |

### 0.2 본 세션 핵심 발견 (4-Pass 통합)

**4-Pass 독립 에이전트 4개 병렬** (silent-failure-hunter / system-architect / security-engineer / quality-engineer) 결과:

|  #   | Pass      | CRITICAL | MAJOR  | MINOR  |
| :--: | :-------- | :------: | :----: | :----: |
|  1   | SURGEON   |    0     |   3    |   4    |
|  2   | ARCHITECT |  **1**   |   3    |   5    |
|  3   | ADVOCATE  |    0     |   3    |   4    |
|  4   | CONTRACT  |    0     |   4    |   2    |
| 합계 |           |  **1**   | **13** | **15** |

**CRITICAL F1**: test-patterns.md §4 fixture 경로 거짓 (`tests/fixtures/...` ≠ 실제 `packages/parser/__fixtures__/...`). 3 개 에이전트 독립 적발 → 신뢰도 매우 높음. commit `49335c5` 즉시 흡수.

### 0.3 본 세션 게이트 통과 누적 검증

- `packages/shared` test 33 → **50 PASS** (+17 perf 회귀 + 4-Pass 흡수 회귀 4건)
- `apps/api` test 261 PASS (회귀 0건)
- `apps/admin-web` typecheck clean
- `packages/quality` test 48 PASS (회귀 0건)
- `apps/batch` test 238 PASS (회귀 0건)
- `packages/parser` test 136 PASS (회귀 0건)
- `verify-engine-contracts.ts` PASS=4 FAIL=0 SKIP=2 (every step)
- 4-Pass 독립 에이전트 리뷰 1회 영속 (5개 산출물 — Pass 1~4 + 통합 인덱스)

---

## 1. Sprint 1 진행 상태 (handoff-029 §1 갱신)

```
[x] §5.1  CRITICAL-N1   iterative DFS + MAX_SUPERSEDE_CHAIN_DEPTH sentinel    ← 028
[x] §5.1  4-Pass 흡수   caller 통합 (qg2-validator/pipeline/index.ts/JSDoc)   ← 028
[x] §5.2  Day 1 도구    perf + fakeTimers + fixtures + ADR-028 (MSW 이연)     ← 본 세션
[x] §5.2  4-Pass 흡수   CRITICAL 1 + MAJOR 6 즉시                              ← 본 세션
[ ] §5.3  NOT-IMPL 5건  CHA-01/02/04 + FUZ-01/02 신규 구현 (CHA-03/05 P1 이연)  ← 차세션 (~2~3일)
[ ] §5.4  PARTIAL 7건   CHA-06/FUZ-04/PRF-01/02/PRC-01/REC-01/02 보강           ← 차세션 (~2일)
[ ] §5.5  종료 게이트   15/15 PASS + verify-engine-contracts Cat 5 자동화       ← BATCH-1 진입 트리거
[ ] v1.2  보고서        ENGINE_HARDENING_COMPLETION_REPORT v1.1 → v1.2          ← §5.4 완료 후
```

**P0 15건 (재분류 후) 현재 상태**:

- PASS 3건: REG-01 / REG-02 / PRC-02
- PARTIAL 6건: CHA-06 / FUZ-04 (5/12) / PRF-01 (119/255) / PRF-02 (정확성 PASS, 성능 비교 부재) / PRC-01 (119/255) / REC-01 (1/50) / REC-02 (1/5)
  - 본 세션 §5.1 흡수 후 PRF-02 정확성 측면 → PASS 승격 가능 (iterative DFS + sentinel 정확성 검증 완료). 다만 "Tarjan SCC 비교" 시나리오 미구현 → PARTIAL 유지가 정확.
- NOT-IMPLEMENTED 5건: CHA-01 / CHA-02 / CHA-04 / FUZ-01 / FUZ-02 (CHA-03 / CHA-05 P1 이연)

---

## 2. 차세션 진입 액션 명세 (Sprint 1 §5.3 + §5.4)

### 2.A — §5.3 NOT-IMPL 5건 신규 구현 (~2~3일)

**근거**: review-sprint0-baseline §5.3 + decision-2026-05-02 §3.1 (CHA-03/05 P1 이연) + 본 §5.2 도구 산출물 활용.

| 시나리오 | 작업                                                 | 시간 | 도구 의존                                                             |
| :------- | :--------------------------------------------------- | :--: | :-------------------------------------------------------------------- |
| CHA-01   | D1 disconnect 10% Proxy wrap + retry 검증            | 0.5d | `d1-from-sqlite.ts` + `withDisconnect` Proxy 패턴 (ADR-028 §4.1 정합) |
| CHA-02   | CalculationTimeoutError 추가 + 무거운 산식           | 0.5d | `packages/formula-engine/engine.ts` setTimeout-based bail-out         |
| CHA-04   | vi.useFakeTimers clock skew + recover Q1 (24h 가드)  | 0.5d | `test-patterns.md` §1 정합 패턴 + apps/batch/recover.ts elapsed abs() |
| FUZ-01   | 5종 PDF + PdfParseError 분류 + subprocess zombie 0건 | 0.5d | `packages/parser/__fixtures__/pdf-malicious/` (본 세션 산출)          |
| FUZ-02   | 8종 변조 응답 + KnowledgeContractValidationError     |  1d  | `packages/parser/__fixtures__/claude-malformed/` (본 세션 산출)       |

**CHA-03 / CHA-05 P1 이월 사유**: decision-2026-05-02 §2.1 / §2.2 (anthropic-adapter NOT_IMPLEMENTED + hybrid-search Phase 1 후반 활성).

**커밋 단위**: 시나리오별 1 commit + Day 별 4-Pass 리뷰 의무.

### 2.B — §5.4 PARTIAL 7건 보강 (~2일)

| 시나리오 | 작업                                                       | 시간 | 본 세션 도구 의존                                     |
| :------- | :--------------------------------------------------------- | :--: | :---------------------------------------------------- |
| CHA-06   | wrangler cron + GC catch-up                                | 0.5d | vi.useFakeTimers (test-patterns.md §1)                |
| FUZ-04   | 7 vectors 추가 (12-5=7)                                    | 0.5d | sandbox-bypass.property.test.ts 확장                  |
| PRF-01   | 성능 메트릭 wrapper + p99 측정                             | 0.5d | `@thepick/shared/test-helpers/perf` (본 세션)         |
| PRF-02   | N=5K/10K/50K Tarjan vs iterative-DFS 비교                  | 0.5d | `@thepick/shared/test-helpers/perf` + Tarjan SCC 후보 |
| PRC-01   | batch6~10-golden 또는 5 시나리오 expansion                 | 0.5d | —                                                     |
| REC-01   | 4 시점 × 10 반복 추가 (5/25/75/95% × 10)                   | 0.5d | parameterize test                                     |
| REC-02   | 4 변조 케이스 추가 (trailing 0 / key reorder / 공백 / BOM) | 0.5d | checkpoint.test.ts                                    |

**§5.4 동시 흡수 의무 — 본 세션 4-Pass 이월 MAJOR 7건**:

§6 ledger 참조. §5.4 commit 들과 동시 묶음 처리 권고.

### 2.C — Sprint 1 종료 게이트 + v1.2 보고서 (별도)

**Sprint 1 종료 조건** (handoff-029 §2.D 갱신):

- **P0 15/15 PASS** (CHA-03/05 P1 재분류 적용)
- `verify-engine-contracts.ts` Cat 5 부분 자동화 추가
- JSON 리포트 생성 (`apps/batch/sprint1-final-report.json`)
- BATCH-1 진입 진산님 트리거 대기

**ENGINE_HARDENING_COMPLETION_REPORT v1.1 → v1.2 갱신** (handoff-029 §3.2 권고 A 정합 — Sprint 1 §5.4 완료 후 일괄):

- §10.7 #6 항목 갱신 — "✅ Sprint 0 baseline (PRF-02) 측정 완료 + Sprint 1 §5.1 commit 1c54a85 + b587bdc 흡수"
- §10.7 #16 신규 — anthropic-adapter NOT_IMPLEMENTED throw (CHA-03 측정 불가, P1 재분류)
- §10.7 #17 신규 — hybrid-search Phase 1 후반 활성 (CHA-05 측정 불가, P1 재분류)
- §0 Executive Summary "naive DFS 임계 노드 수 미검증" → "✅ Sprint 1 §5.1 흡수"
- §14 결론 갱신 (P0 17→15, P1 18→20)

---

## 3. 진산님 정책 결정 사항 (Session 030 신규 + 029 잔존 0건)

### 3.1 (해결됨) CHA-03 / CHA-05 P0 → P1 재분류

- 진산님 권고 A 채택 → commit `fefa64a` 적용. 본 handoff §0.1 / §1 / §2 모두 P0 15 / P1 20 정합.

### 3.2 (해결됨) v1.2 보고서 갱신 시점

- 진산님 권고 A 채택 → Sprint 1 §5.4 완료 후 일괄 갱신. 본 §2.C 정합.

### 3.3 (신규) §5.3 진입 순서 결정 필요

**옵션**:

- A) **CHA-01 → CHA-02 → CHA-04 → FUZ-01 → FUZ-02** (handoff 명세 순서)
- B) **FUZ-01 → FUZ-02 (fixtures 활용 우선) → CHA-01 → CHA-02 → CHA-04**
- C) **병렬 (Day 1: CHA-01/02/04, Day 2: FUZ-01/02 동시)**

**권고**: **옵션 B** — 본 세션 §5.2 산출 fixtures 즉시 활용 → 회귀 방어 효과 우선. 또한 FUZ 시나리오는 schema-validator 단위 테스트 (in-process) 로 도구 의존 최소.

### 3.4 (신규) MAJOR 7건 이월 흡수 시점

**옵션**:

- A) **§5.4 PARTIAL 보강 commit 들과 동시 묶음** (handoff-028 §2.4 / §5.4 동시 흡수 패턴 정합)
- B) §5.3 NOT-IMPL 완료 직후 별도 commit
- C) Sprint 1 종료 게이트 직전 일괄

**권고**: **옵션 A**. §5.4 commit 들이 자연스러운 흡수 시점.

---

## 4. 차세션 진입 직후 1차 읽기

### 4.1 핵심 문서 (의무, 우선순위 순)

1. **본 핸드오프** — `.jjokjipge/handoff-session-030.md`
2. **decision-2026-05-02** — `docs/plans/engine-hardening/decision-2026-05-02-cha-03-05-p1-reclassification.md` (P0→P1 재분류 효력)
3. **§5.2 4-Pass 통합 인덱스** — `.claude/reviews/review-20260502-003506-sprint1-step5-2-4pass.md` (이월 MAJOR 7건 명세)
4. **test-patterns.md** — `docs/quality/test-patterns.md` (§5.3 / §5.4 신규 테스트 작성 시 진실 소스)
5. **ADR-028** — `docs/adr/ADR-028-workers-vitest-pool-deferred-to-phase-2.md` (CHA-01 D1 disconnect Proxy 패턴 §4.1)
6. **Sprint 0 baseline** — `.claude/reviews/review-sprint0-baseline-20260501-230231.md` (P0 측정 결과 + §5.3 / §5.4 권고 작업 순서)
7. **테스트 마스터 플랜** — `docs/ThePick Engine Quality Test Master Plan v1.0.md` (v1.0.1 패치 적용)

### 4.2 직전 세션 핸드오프 (체인)

8. `.jjokjipge/handoff-session-029.md` (P0→P1 재분류 + §5.2 도구 정비 명세)
9. `.jjokjipge/handoff-session-028.md` (Phase A → B → C → D 명세)

### 4.3 진산님 메모리 정합 (자동 로드)

- `project_completion_notification_obligation` (Sprint 1 종료 = ★ 알림 의무)
- `feedback_two_fix_failures_zoom_out` (§5.4 PRF-02 / FUZ-04 보강 시 정합)
- `feedback_no_shortcuts` (CHA-03/05 P1 재분류 정당화)
- `feedback_review_filename_pattern` (review-\* prefix — 본 세션 5개 산출물 정합)
- `feedback_document_first_workflow` (decision / ADR / test-patterns 영속 문서 우선)

---

## 5. 진산님 차세션 트리거 키워드

| 트리거                                                  | 진행                                                                               |
| :------------------------------------------------------ | :--------------------------------------------------------------------------------- |
| **"§5.3 진입 — fixtures 우선 (FUZ-01/02 먼저)"** (권고) | 옵션 B 채택. FUZ-01 → FUZ-02 → CHA-01 → CHA-02 → CHA-04 (~2~3일)                   |
| **"§5.3 handoff 순서 (CHA 먼저)"**                      | 옵션 A. CHA-01 → CHA-02 → CHA-04 → FUZ-01 → FUZ-02 (~2~3일)                        |
| **"§5.3 + §5.4 풀 진행"**                               | NOT-IMPL 5건 + PARTIAL 7건 일괄 (~5일) — 다중 세션 분할 의무                       |
| **"이월 MAJOR 7건 먼저 흡수"**                          | tsconfig path mapping + Rule 17 nameset + ADR-028 trigger 재정의 + .snyk 등 (~1일) |
| **"v1.2 보고서 즉시 갱신"**                             | §5.4 완료 전 v1.2 갱신 (handoff-029 §3.2 권고 A 위배 — 신중)                       |
| **"Sprint 1 종료 게이트 즉시 검증"**                    | 현 시점 P0 PASS = 3 / 15 — 종료 미충족. NOT-IMPL 5건 진입 의무                     |

**권고**: **"§5.3 진입 — fixtures 우선 (FUZ-01/02 먼저)"** — 본 세션 §5.2 산출물 즉시 활용 + 옵션 B 정합.

---

## 6. 본 세션이 차세션에 넘기는 의무 (정직)

본 세션 작성자(Claude Opus 4.7)가 차세션 Claude 에게 명시 의무:

### 6.1 §5.2 4-Pass 이월 MAJOR 7건 ledger

본 ledger 의 7건은 §5.4 commit 들과 동시 흡수 의무 (auto-review-protocol §"MAJOR phase 종료 전 해결 또는 다음 phase 명시 이월" 정합):

|  #  | Pass | ID         | 적발 내용                                                                        | 흡수 위치                                                                                                        |
| :-: | :--: | :--------- | :------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
|  1  |  2   | A1         | tsconfig path mapping 이 test-helpers production import 차단 부재                | `packages/shared/tsconfig.json` paths 검토 + ESLint no-restricted-imports `@thepick/shared/test-helpers/**` 차단 |
|  2  |  2   | D1         | Rule 17 예외 nameset 가 `__fixtures__/**` 미포함 (.eslintignore 자체 미생성)     | ESLint Rule 17 도입 시점 (Phase 1 후반) — `.eslintignore` 신규 + `__fixtures__/**` allowlist                     |
|  3  |  2   | E1         | ADR-028 trigger #4 ("node:sqlite 1% 결손") 측정 불가능                           | ADR-028 §5 trigger #4 재작성 (구체 측정 항목 + 임계값 명시)                                                      |
|  4  |  3   | A2         | 보안 스캐너 (Snyk / Dependabot) false positive 차단 마커 부재                    | `.snyk` (`packages/parser/__fixtures__/pdf-malicious/**` exclude) + `dependabot.yml` ignore                      |
|  5  |  3   | A4         | Phase 2 진입 트리거 binary 정의 부재                                             | ROADMAP Phase 2 진입 게이트 명세 — "BATCH-1 적재 완료" 의 측정 가능 정의 (예: 노드 ≥ N건 등)                     |
|  6  |  4   | MAJOR-1    | commit ba9ad2b message 의 fixtures 위치 변경 transparency 누락                   | 이미 commit 됨 — 본 ledger 가 명시 진실 소스. 향후 commit msg 작성 시 위치 변경 명시 의무                        |
|  7  |  3   | A3 (Minor) | Hard Rule 17 예외 패턴 명세 (08-fixture 의 'son-hae-pyeong-ga-sa') ESLint config | ledger #2 와 동일 시점 흡수                                                                                      |

### 6.2 §5.2 통합 인덱스 + 4 Pass 보고서 직접 읽기 의무

차세션 Claude 는 commit `49335c5` 의 4-Pass 흡수만 신뢰하지 말고, 통합 인덱스 (`.claude/reviews/review-20260502-003506-sprint1-step5-2-4pass.md`) + 각 Pass 보고서 직접 읽기. 이월 MAJOR 의 정확한 위치 / 흡수 방법 / 회귀 시나리오 인지 의무.

### 6.3 §5.3 진입 시 4-Pass 의무

§5.3 NOT-IMPL 5건 본격 구현 commit 별 4-Pass 의무 — 본 §5.2 처럼 1 commit / 1 4-Pass / 1 흡수 commit 패턴 유지. auto-review-protocol §"L2 이상 구현 작업 완료 시" 정합.

### 6.4 session-health 의무

본 세션 (029) 은 ~50분 도달 시점 (commit 3 직후) — 90분 임계 미도달이지만 turn count ~15 도달. 차세션 Claude 도 90분 / 30턴 전 handoff-031 작성 의무.

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 029
**다음 세션**: Session 030 — Sprint 1 §5.3 NOT-IMPL 5건 + §5.4 PARTIAL 7건 + v1.2 보고서
**작성 효력**: 2026-05-02 ~00:40 KST
**예상 완료**: handoff-031 (Sprint 1 P0 15/15 GREEN 후 → BATCH-1 진입 트리거 대기)
