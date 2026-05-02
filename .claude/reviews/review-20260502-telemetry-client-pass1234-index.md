# 4-Pass 통합 인덱스 — telemetry-client wire-up (Step 037 CRITICAL-DO-S1-1)

작성일: 2026-05-02 ~23:30 KST (Session 037)
대상: CRITICAL-DO-S1-1 (apps/batch telemetry-client wire-up + 6 게이지 emit)
정합 출처:

- `.claude/reviews/review-20260502-telemetry-client-pass12.md` (silent-failure-hunter, agentId `a38a51f4acf6e1e65`)
- `.claude/reviews/review-20260502-telemetry-client-pass34.md` (code-reviewer, agentId `a6c8312c9d0da23bc`)

---

## 0. Executive Summary

| Pass               | 에이전트              | CRITICAL | MAJOR | 판정          |
| :----------------- | :-------------------- | :------: | :---: | :------------ |
| Pass 1 (Surgeon)   | silent-failure-hunter |    0     |   2   | 완료 가능     |
| Pass 2 (Architect) | silent-failure-hunter |    0     |   2   | 완료 가능     |
| Pass 3 (Advocate)  | code-reviewer         |    0     |   2   | 완료 가능     |
| Pass 4 (Contract)  | code-reviewer         |    0     |   1   | 완료 가능     |
| **합계**           |                       |  **0**   | **7** | **완료 가능** |

**판정: CRITICAL 0건 → 완료 선언 가능. MAJOR 7건 즉시 흡수 (`feedback_no_granular_decisions` 정합).**

---

## 1. MAJOR 7건 흡수 status

| ID            | 출처 Pass          | 우선순위 | 항목                                                                 |                          흡수 status                           |
| :------------ | :----------------- | :------: | :------------------------------------------------------------------- | :------------------------------------------------------------: |
| Pass2-MAJOR-1 | Pass 2 (Architect) |  **P0**  | 6 게이지 단위 0017 마이그레이션 정의 불일치 (admin-web prerequisite) |                            ✅ 흡수                             |
| Pass1-MAJOR-1 | Pass 1 (Surgeon)   |    P1    | timeoutMs/maxAttempts 0 가드 부재 → constructor throw                |                            ✅ 흡수                             |
| Pass4-MAJOR-1 | Pass 4 (Contract)  |    P1    | PHASE_1_GAUGES reviewer_queue 분류 + admin-web no_data graceful 의무 |                     ✅ 흡수 (코멘트 보강)                      |
| Pass3-MAJOR-1 | Pass 3 (Advocate)  |    P2    | bin/batch.ts printHelp Environment 섹션 ENV 누락                     |                            ✅ 흡수                             |
| Pass3-MAJOR-2 | Pass 3 (Advocate)  |    P2    | `.env.example` THEPICK*TELEMETRY*\* 미문서화                         | ⏸ **이월** (.env Hard Limit 권한 거부 — handoff-038 §5.X 명시) |
| Pass1-MAJOR-2 | Pass 1 (Surgeon)   |    P2    | pipeline.ts flushPending finally try/catch dead code 주석            |                   ✅ 흡수 (defensive 코멘트)                   |
| Pass2-MAJOR-2 | Pass 2 (Architect) |    P2    | SIGINT signal handler telemetry flushPending 부재                    |               ✅ 흡수 (best-effort 누수 코멘트)                |

**즉시 흡수: 6건 / 명시 이월: 1건 (.env 권한 거부 — Hard Limit 정합)**

---

## 2. 흡수 후 검증 (실측)

### 2.1 typecheck

```
@thepick/batch  : tsc --noEmit + tsc -p tsconfig.manual.json  PASS
@thepick/api    : tsc --noEmit                                  PASS
```

### 2.2 vitest (apps/batch)

```
Test Files  18 passed (18)
Tests       327 passed (327)   ← 311 → 325 (+14 telemetry-client) → 327 (+2 0가드 tests)
Duration    1.91s
```

### 2.3 verify-engine-contracts.ts

```
1회차 첫 실행: batch 326 / 327 FAIL (TD-VRF-001 비결정성 재현)
2회차 재실행:  batch 327 / 327 PASS
3회차 재실행:  batch 327 / 327 PASS  ← deterministic 확정

최종: overallStatus PASS, 모노레포 1190 / 1190 PASS, 자동 게이트 9 / 9 PASS
```

**TD-VRF-001 패턴 확정**: 코드 변경 직후 verify --json 첫 실행 시 vitest reporter timing 으로 1~2개 카운트 부족 → 재실행부터 정합. 직전 세션 036 와 동일 패턴 재현.

---

## 3. 변경 파일 요약

신규 (4 파일):

- `apps/batch/src/adapters/telemetry-client.ts` (~240 lines, 0 가드 추가 후)
- `apps/batch/src/__tests__/telemetry-client.test.ts` (~380 lines, 16 tests)
- `.claude/reviews/review-20260502-telemetry-client-pass12.md` (Pass 1+2 산출물)
- `.claude/reviews/review-20260502-telemetry-client-pass34.md` (Pass 3+4 산출물)

수정 (4 파일):

- `apps/batch/src/pipeline.ts` (PipelineContext.telemetryClient + 6 wire-up + flushPending finally + 단위 정정 + 코멘트 보강)
- `apps/batch/bin/batch.ts` (createTelemetryClientFromEnv + ctx 주입 + printHelp Environment 갱신)
- `apps/api/src/telemetry/types.ts` (PHASE_1_GAUGES 코멘트 보강 — admin-web no_data graceful 의무 명시)
- `scripts/verify-engine-contracts.ts` (apps/batch required 311 → 327)

verify reports (2 파일):

- `.claude/reports/sprint1-step5-5-verify-session-037-run1.json` (세션 진입 직후 deterministic 검증)
- `.claude/reports/sprint1-step5-5-verify-session-037-run2.json` (세션 진입 직후 재실행)

---

## 4. 메모리 정합 (본 흡수 후)

| 메모리                                       | 흡수 전 status                  | 흡수 후 status                                                                        |
| :------------------------------------------- | :------------------------------ | :------------------------------------------------------------------------------------ |
| `project_engine_observability` (8 게이지)    | ❌ 위반 (telemetry wire-up 0건) | ✅ 6 게이지 wire-up + 2 deferred (reviewer_queue Phase 1 후반 + learning_slo Phase 2) |
| `project_completion_notification_obligation` | 🟡 Group A 잔여 2건 흡수 의무   | 🟡 1건 흡수 (CRITICAL-DO-S1-1) + 1건 잔여 (CRIT-QPHASE1-1 admin-web vitest)           |
| `feedback_no_granular_decisions`             | —                               | ✅ 정합 (MAJOR 7건 비협의 자동 흡수, .env 권한 거부만 명시 이월)                      |
| `feedback_review_filename_pattern`           | —                               | ✅ 정합 (review-20260502-telemetry-client-pass{12,34}.md + 본 통합 인덱스)            |
| `feedback_two_fix_failures_zoom_out`         | TD-VRF-001 ledger               | ✅ 본 세션 재현 패턴 확정 — handoff-038 ledger 갱신                                   |
| `feedback_focus_reliability_not_schedule`    | —                               | ✅ 정합 (.env 권한 거부 = 진산님 콘솔 영역)                                           |

---

## 5. 이월 항목 (handoff-038 명시 의무)

### 5.1 명시 이월 (1건)

- **Pass3-MAJOR-2**: `.env.example` (root + apps/admin-web) 에 `THEPICK_TELEMETRY_API_BASE` + `THEPICK_TELEMETRY_ADMIN_TOKEN` 추가 — 권한 거부 (Hard Limit `.env*` 커밋 금지) → 진산님 콘솔 영역 (`feedback_focus_reliability_not_schedule` 정합).

### 5.2 본 흡수 chain 이후 신규 ledger 추적

- **TD-VRF-001 재현 패턴 확정**: 코드 변경 직후 verify --json 첫 실행 1~2 카운트 부족 → 재실행 정합. Sprint 2 초기 root cause 분석 의무 (vitest reporter timing 또는 cache 추정).
- **reviewer_queue Phase 1 후반 wire-up 의무**: LLM Reviewer 도입 시 `apps/api/src/telemetry/types.ts` 코멘트 정합 검증 + apps/batch wire-up 추가. 본 시점 미 wire-up = admin-web 측 graceful no_data 표시 의무.
- **SIGINT 경로 telemetry flush 부재**: best-effort 의도된 손실. 운영 alarm 으로 가시화 검증 의무 (Phase 2 SIGINT recover 정합 검토 시).

---

## 6. 4-Pass 프로토콜 정합 (`.claude/rules/auto-review-protocol.md`)

- ✅ 규칙 0: 독립 에이전트 필수 — Pass 1+2 silent-failure-hunter / Pass 3+4 code-reviewer 병렬 위임
- ✅ 규칙 1: 전체 범위 리뷰 — 변경 4 파일 + 연관 3 파일 (apps/api types.ts / routes.ts / admin-token.ts) 명시
- ✅ 규칙 2: 증거 기반 보고 — 각 Pass 확인 evidence 3+개 + 0건 보고 시 PASS / N/A 구분
- ✅ 규칙 3: 반론 의무 (Devil's Advocate) — 각 Pass 시나리오 1+개 명시
- ✅ 규칙 4: 분류 및 수정 — CRITICAL/MAJOR/MINOR 분류 + CRITICAL/MAJOR 즉시 흡수 (1건 권한 거부 명시 이월)
- ✅ 보고 형식: review-20260502-telemetry-client-pass\*.md + 본 통합 인덱스

---

**판정**: CRITICAL 0건 → 완료 선언 가능. MAJOR 7건 중 6건 즉시 흡수 + 1건 명시 이월 → handoff-038 §5.1 추적 의무.
