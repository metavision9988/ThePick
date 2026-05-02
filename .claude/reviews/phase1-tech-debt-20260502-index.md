# Phase 1 5-페르소나 기술부채 심층 리뷰 — 통합 인덱스

**작성일**: 2026-05-02 ~15:30 KST
**작성자**: Claude (Opus 4.7 1M context) — Session 034
**리뷰 방식**: 독립 에이전트 5개 병렬 (refactoring-expert / performance-engineer / quality-engineer / backend-architect / devops-architect)
**리뷰 범위**: Phase 1 본체 (Step 0~19) + Sprint 1 강화 (§5.1~§5.5) 완료 시점 — BATCH-1 적재 직전
**4-Pass 중복 회피**: §5.4 (handoff-033) + §5.5 (`.claude/reviews/review-20260502-step5-5-index.md`) 결과 cross-ref 검증

---

## 0. 종합 결과

| 페르소나                   | CRITICAL | MAJOR  | MINOR  | 핵심 발견                                                        |
| :------------------------- | :------: | :----: | :----: | :--------------------------------------------------------------- |
| refactoring-expert         |  **2**   |   10   |   5    | resolveLoggerEnv 6중 복제 / withRetry 중복                       |
| performance-engineer       |  **4**   |   6    |   5    | dashboard 16 RT / GC timeout / cache overhead                    |
| quality-engineer (Phase 1) |  **3**   |   8    |   5    | admin-web 0 tests / footnote trigger 부재 / Hard Rule 13 e2e     |
| backend-architect          |  **3**   |   6    |   4    | Hard Rule 16 9 테이블 부재 / production 마이그 0/17 / GC runbook |
| devops-architect           |  **1**   |   4    |   3    | telemetry wire-up 0건 (8 게이지 no_data)                         |
| **합계**                   |  **13**  | **34** | **22** | —                                                                |

**판정**: BATCH-1 진입 차단 게이트 (Group A 7건 흡수 전) — 진산님 결정 "통합 보고서 영속 + Group A 7건 즉시 흡수" 승인 후 본 통합 인덱스 영속.

---

## 1. CRITICAL 13건 분류

### Group A — BATCH-1 진입 즉시 차단 (7건, 즉시 흡수 의무)

| ID               | 페르소나 | 제목                                                                    | 위치                                                        |
| :--------------- | :------- | :---------------------------------------------------------------------- | :---------------------------------------------------------- |
| B-C1             | backend  | Hard Rule 16 9 테이블 examId 시그니처 부재 (Year 2 zero-cost 약속 파산) | apps/api/src/db/schema.ts + apps/api/src/progress/routes.ts |
| B-C2             | backend  | production 마이그레이션 0/17 적용 — staging dry-run 의무                | wrangler.toml + migrations/                                 |
| B-C3             | backend  | engine_telemetry 1년 보존 GC runbook 부재                               | migrations/0017 + docs/runbooks/                            |
| CRIT-QPHASE1-1   | quality  | admin-web 0 tests (1차 리뷰 1주 영속)                                   | apps/admin-web/                                             |
| CRIT-QPHASE1-2   | quality  | Master Plan v1.0.2 footnote 6건 expansion 자동 trigger 부재             | scripts/verify-engine-contracts.ts                          |
| CRIT-QPHASE1-3   | quality  | Hard Rule 13 (status='draft' 강제) e2e 부재                             | apps/batch/ + 마이그레이션 0018 신규                        |
| CRITICAL-DO-S1-1 | devops   | apps/batch telemetry POST wire-up 0건 (8 게이지 no_data 비행)           | apps/batch/src/telemetry-client.ts 신규                     |

### Group B — Phase 2 진입 직전 의무 (4건, performance)

| ID       | 제목                                                                   | 위치                                         |
| :------- | :--------------------------------------------------------------------- | :------------------------------------------- |
| C-PERF-1 | GET /api/telemetry/dashboard 16 sequential RT (Workers 50ms 한도)      | apps/api/src/telemetry/routes.ts:286-341     |
| C-PERF-2 | engine_telemetry 1년 보존 GC 부재                                      | migrations/0017 + apps/api/src/index.ts:159  |
| C-PERF-3 | purgeOldRateLimits 28.8M row 단일 DELETE timeout                       | apps/api/src/scheduled/rate-limit-gc.ts:54   |
| C-PERF-4 | parseFormula cache hit 시 assertWithinComplexityBudget 재실행 overhead | packages/formula-engine/src/ast-parser.ts:45 |

### Group C — 코드 품질 (2건, refactoring)

| ID     | 제목                                                   | 위치                                                                                                                         |
| :----- | :----------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| C-RF-1 | resolveLoggerEnv 6중 복제 (observability silent drift) | apps/api/src/{index,auth/routes,progress/routes,telemetry/routes,webhooks/payment}.ts + apps/batch/src/{pipeline,recover}.ts |
| C-RF-2 | withRetry 중복 구현 (4xx 무한 retry 비용 폭주)         | apps/api/src/middleware/retry.ts + packages/parser/src/batch-processor.ts:236                                                |

---

## 2. Group A 7건 흡수 plan (진산님 승인 후 진행)

### 2.1 빠른 흡수 (3건, ~1.5h)

| 순  | 항목           | 작업                                                                                                | 추정 |
| :-: | :------------- | :-------------------------------------------------------------------------------------------------- | :--: |
|  1  | B-C2           | `docs/runbooks/production-deployment.md` 신규 (5 step + rollback)                                   | 30분 |
|  2  | B-C3           | `docs/runbooks/engine-telemetry-gc.md` 신규 (SQL 시퀀스 + dry-run)                                  | 30분 |
|  3  | CRIT-QPHASE1-2 | `scripts/verify-engine-contracts.ts` EXPANSION_OBLIGATIONS 6 entries + Cat 9 신규 (또는 Cat 6 보강) | 30분 |

### 2.2 중간 흡수 (2건, ~2.5h)

| 순  | 항목           | 작업                                                                                                 | 추정 |
| :-: | :------------- | :--------------------------------------------------------------------------------------------------- | :--: |
|  4  | B-C1           | progress/routes.ts 3 엔드포인트 examId query 강제 + isValidExamId runtime check + assertion + 테스트 | 1.5h |
|  5  | CRIT-QPHASE1-3 | 마이그레이션 0018 (status='draft' 트리거 + source_id NOT NULL) + e2e 5 tests                         |  1h  |

### 2.3 큰 흡수 (2건, ~5-7h, 분리 PR 권고)

| 순  | 항목             | 작업                                                             | 추정 |
| :-: | :--------------- | :--------------------------------------------------------------- | :--: |
|  6  | CRIT-QPHASE1-1   | apps/admin-web vitest 인프라 + 8 tests                           | 3-4h |
|  7  | CRITICAL-DO-S1-1 | apps/batch/src/telemetry-client.ts 신규 + 7 게이지 wire-up + e2e | 2-3h |

**총 추정**: ~9-11h (1.5일 분량). 본 세션 + handoff-035 연속 진행 권고.

---

## 3. 4-Pass 중복 회피 검증

### §5.5 4-Pass (`.claude/reviews/review-20260502-step5-5-index.md`)

- CRITICAL-A1 (VITEST_PACKAGES required +215) ↔ Group A/B/C 모두 영역 다름 (테스트 인프라 vs 7 컴포넌트)
- CRITICAL-A2/C1 (Cat 5 SKIP→PASS) ↔ Group A/B/C 모두 영역 다름

### §5.4 4-Pass (handoff-033 §6.1)

- MAJOR 11건 ledger ↔ 본 통합 인덱스 흡수 매핑 (refactoring 7건 통합)
- handoff-033 §6.1 M-1 (CHA-06 row count) ↔ B-M5 (engine_telemetry 인덱스) 영역 다름
- handoff-033 §6.1 M-3 (PRC-01 카운트) ↔ CRIT-QPHASE1-2 (footnote trigger) 부분 통합 가능

### 1차 5-페르소나 (2026-05-01)

- CRIT-Q1 admin-web 0 tests — **1주 영속 → CRIT-QPHASE1-1 재제기**
- CRIT-Q2 write-helper.test.ts — 흡수 PASS
- CRIT-DO-1 admin-web localhost fallback — 흡수 PASS
- MAJOR-DO-1~5 — 영속 (devops 4건 신규 + 1차 5건 = 9건 통합)

---

## 4. 누적 이월 MAJOR 36 → 70건

handoff-034 §6.3 누적 36건 + 본 5-페르소나 신규 34건 = **70건 누적**.

영역별 dedup 후 효과적 신규 ~25-30건 추정:

- refactoring 영역 7건 통합 (handoff-033 §6.1 ledger 와 직접 합치)
- performance 영역 6건 (PRF-01/02 / PRC-01 footnote 와 통합)
- quality 영역 8건 (1차 5-페르소나 6건과 부분 dedup)
- backend 영역 6건 (4-Pass MAJOR-A2/A3 와 통합)
- devops 영역 4건 (1차 MAJOR-DO 5건과 별도)

**Phase 2 진입 시 master-test-checklist v3 + tech-debt.md ledger 일괄 갱신 의무**.

---

## 5. 메모리 정합 위반 (Group A 미흡수 시)

| 메모리                                       | 영역                          | 위반 위험                                                                            |
| :------------------------------------------- | :---------------------------- | :----------------------------------------------------------------------------------- |
| `project_completion_notification_obligation` | "기술 부채 0 정책"            | Group A 7건 미흡수 → 정책 위반                                                       |
| `feedback_no_shortcuts`                      | "framework 보강 = 땜빵 X"     | Master Plan v1.0.2 footnote 6건 자동 trigger 부재 → BATCH-1 적재 후 망각 silent skip |
| `project_engine_observability`               | "8 게이지 상시 모니터링"      | telemetry wire-up 0건 → 메모리 직접 위반                                             |
| `project_source_citation_requirement`        | "근거 0건 = approved 차단"    | Hard Rule 13 e2e 부재 → BATCH-1 시 status='approved' bypass 가능                     |
| Hard Rule 16 (production-quality.md v1.2)    | "Year 1 시점 examId 시그니처" | 9 테이블 부재 = 이미 위반 판정                                                       |

---

## 6. 5개 페르소나 산출물 영속

| 페르소나             | 산출물                                         | agentId             |
| :------------------- | :--------------------------------------------- | :------------------ |
| refactoring-expert   | `phase1-tech-debt-20260502-refactoring.md`     | `accd4c03ca79d1294` |
| performance-engineer | `phase1-tech-debt-20260502-performance.md`     | `a1cc8a17c8c04a6e0` |
| quality-engineer     | `phase1-tech-debt-20260502-quality.md`         | `a3d09b16418b75a03` |
| backend-architect    | `phase1-tech-debt-20260502-backend.md`         | `a15b4ca611de6fa2a` |
| devops-architect     | `phase1-tech-debt-20260502-devops.md`          | `a9c29154b1105c6c0` |
| 통합 인덱스          | `phase1-tech-debt-20260502-index.md` (본 문서) | —                   |

---

## 7. 다음 단계

1. **본 통합 인덱스 + 5 페르소나 산출물 commit** (commit window)
2. **Group A 7건 흡수 plan 진행** (위 §2 순서):
   - 빠른 흡수 3건 (B-C2 / B-C3 / CRIT-QPHASE1-2) ~1.5h
   - 중간 흡수 2건 (B-C1 / CRIT-QPHASE1-3) ~2.5h
   - 큰 흡수 2건 (CRIT-QPHASE1-1 / CRITICAL-DO-S1-1) ~5-7h, 분리 PR
3. **verify-engine-contracts 재실행** + JSON 영속
4. **handoff-035 작성** — Group A 흡수 결과 + Group B/C 이월 ledger
5. **BATCH-1 진입 직전 최종 게이트** — Group A 통과 확인 + 진산님 승인

---

**통합 인덱스 작성**: Claude (Opus 4.7 1M context) — Session 034
**리뷰 방식**: 독립 에이전트 5개 병렬 (auto-review-protocol §"Phase 단위 5-페르소나" 정합)
**다음 단계**: Group A 7건 즉시 흡수 sprint (~1.5일) → BATCH-1 진입 직전 최종 게이트
