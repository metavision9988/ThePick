# Handoff — Session 035 → Group A 잔여 2건 + Group B/C 이월 + BATCH-1 진입 prerequisite

작성일: 2026-05-02 ~17:10 KST
직전 세션: 034 (Sprint 1 §5.5 commit + Phase 1 5-페르소나 5병렬 + Group A 5/7 즉시 흡수)

---

## 0. 본 세션(034) 누적 결과

### 0.1 commits 체인 (10건)

|  #  | Commit    | 단계                            | 핵심                                          |
| :-: | :-------- | :------------------------------ | :-------------------------------------------- |
|  1  | `a8d0101` | Sprint 1 §5.5 commit            | Master Plan v1.0.2 footnote 6건               |
|  2  | `28cd90f` | Sprint 1 §5.5 commit            | verify Cat 5A 자동화 + CRITICAL-A1 흡수       |
|  3  | `cebe2b8` | Sprint 1 §5.5 commit            | v1.2 보고서 (1164/1164, 9/9 게이트)           |
|  4  | `ef27be4` | Sprint 1 §5.5 commit            | §5.5 4-Pass 산출물 + verify JSON              |
|  5  | `850a73b` | Sprint 1 §5.5 commit            | handoff-034                                   |
|  6  | `2d10ed9` | Group A — CRIT-QPHASE1-3        | 마이그레이션 0018 (Hard Rule 13 트리거 2종)   |
|  7  | `3a39310` | Group A — B-C1 + CRIT-QPHASE1-3 | progress 3 endpoint examId + Hard Rule 13 e2e |
|  8  | `760fa4f` | Group A — CRIT-QPHASE1-2        | EXPANSION_OBLIGATIONS 6건 + 카운트 갱신       |
|  9  | `789b28b` | Group A — B-C2 + B-C3           | production + engine-telemetry-gc runbook      |
| 10  | `1c5d9d8` | Group A — 5-페르소나 영속       | 5개 산출물 + 통합 인덱스                      |

### 0.2 본 세션 6단계 작업

1. **Sprint 1 §5.5 commit window** — 5 commits (이전 세션 결과 영속)
2. **Phase 1 5-페르소나 5병렬 호출** — auto-review-protocol §"Phase 단위 5-페르소나" 의무 게이트
3. **5-페르소나 산출물 영속** — 5개 페르소나 + 통합 인덱스 (`.claude/reviews/phase1-tech-debt-20260502-*.md`)
4. **Group A 5/7 흡수**:
   - B-C1 (Hard Rule 16 progress examId + 3 신규 tests)
   - B-C2 (production-deployment.md runbook)
   - B-C3 (engine-telemetry-gc.md runbook)
   - CRIT-QPHASE1-2 (EXPANSION_OBLIGATIONS 6건 자동 trigger)
   - CRIT-QPHASE1-3 (마이그레이션 0018 + e2e 5 tests)
5. **Group A 5건 commit window** — 5 commits (commit 6~10)
6. **handoff-035 작성**

### 0.3 5-페르소나 종합 결과

| 페르소나                   | CRITICAL | MAJOR  | MINOR  |
| :------------------------- | :------: | :----: | :----: |
| refactoring-expert         |    2     |   10   |   5    |
| performance-engineer       |    4     |   6    |   5    |
| quality-engineer (Phase 1) |    3     |   8    |   5    |
| backend-architect          |    3     |   6    |   4    |
| devops-architect           |    1     |   4    |   3    |
| **합계**                   |  **13**  | **34** | **22** |

### 0.4 누적 테스트 카운트

| 패키지                  | §5.5 종료 후 (handoff-034) | Group A 5건 흡수 후 |
| :---------------------- | :------------------------: | :-----------------: |
| @thepick/shared         |             50             |         50          |
| @thepick/formula-engine |            303             |         303         |
| @thepick/parser         |            155             |         155         |
| @thepick/quality        |             57             |         57          |
| @thepick/batch          |            309             |         309         |
| @thepick/api            |            277             |    **285** (+8)     |
| @thepick/ai-adapter     |             13             |         13          |
| **모노레포 합계**       |            1164            |    **1172** (+8)    |

**증분 +8** = B-C1 progress examId 검증 3건 + CRIT-QPHASE1-3 Hard Rule 13 e2e 5건. apps/api 285/285 PASS 실측.

---

## 1. Group A 7건 흡수 상태

| ID                                              | 페르소나 |    상태     | Commit                |
| :---------------------------------------------- | :------- | :---------: | :-------------------- |
| B-C1 (Hard Rule 16 examId 시그니처)             | backend  |   ✅ 흡수   | `3a39310`             |
| B-C2 (production staging dry-run runbook)       | backend  |   ✅ 흡수   | `789b28b`             |
| B-C3 (engine_telemetry GC runbook)              | backend  |   ✅ 흡수   | `789b28b`             |
| CRIT-QPHASE1-2 (footnote expansion trigger)     | quality  |   ✅ 흡수   | `760fa4f`             |
| CRIT-QPHASE1-3 (Hard Rule 13 e2e + 0018)        | quality  |   ✅ 흡수   | `2d10ed9` + `3a39310` |
| **CRIT-QPHASE1-1** (admin-web vitest + 8 tests) | quality  | ❌ **이월** | 차세션                |
| **CRITICAL-DO-S1-1** (telemetry-client wire-up) | devops   | ❌ **이월** | 차세션                |

**5/7 흡수 완료. 잔여 2건은 분리 PR 의무 (handoff-035 §3 진산님 결정).**

---

## 2. Sprint 1 + Phase 1 진행 상태 (handoff-034 §1 갱신)

```
[x] §5.1~§5.5  Sprint 1 강화 완료                                       ← 028~033
[x] Sprint 1 §5.5 commit window — 5 commits                              ← 본 세션
[x] Phase 1 5-페르소나 5병렬 (CRITICAL 13 / MAJOR 34 / MINOR 22)         ← 본 세션
[x] Group A 5/7 흡수 — B-C1/2/3 + CRIT-QPHASE1-2/3                       ← 본 세션
[ ] Group A 잔여 2건 — CRIT-QPHASE1-1 (admin-web) + CRITICAL-DO-S1-1     ← 차세션 진입 첫 우선
[ ] Group B 4건 — performance (Phase 2 진입 직전 의무)                    ← Phase 2
[ ] Group C 2건 — refactoring (Phase 1 종료 게이트 또는 Phase 2)         ← 결정 의무
[ ] master-test-checklist v3 갱신 (Cat 5 분리 5A/5B + footnote 진척도)   ← Sprint 2 초기
[ ] tech-debt.md 신규 등록 — TD-DO-053~056 + Group B/C 28~30건           ← Sprint 2 초기
[ ] Phase B 보안 패치 — localStorage → httpOnly cookie (~1.5h)            ← 차세션 (병렬 가능)
[ ] BATCH-1 진입 직전 후속 PR (~1주)                                      ← Group A 7/7 + Phase B 후
[ ] BATCH-1 적재 진입 (Step 20)                                          ← 진산님 트리거
```

---

## 3. 진산님 차세션 진입 결정 의무

### 3.1 (★ 권고) Group A 잔여 2건 즉시 흡수

**CRIT-QPHASE1-1 — admin-web vitest + 8 tests** (~3-4h)

- `apps/admin-web/package.json` scripts.test 추가 + vitest + @testing-library/react 도입
- 최소 8 tests:
  - TokenForm 입력 → POST /login → cookie 모드
  - TelemetryDashboard 4 상태 (loading/success/unauthorized/error)
  - 30s polling cleanup (unmount setInterval 해제) + AbortController in-flight cancel
  - resolveApiBase production env 미설정 throw
  - GraphVisualizer mount/unmount D3 cleanup (svg child count 0)
- 1차 5-페르소나 (2026-05-01) CRIT-Q1 1주 영속 흡수

**CRITICAL-DO-S1-1 — apps/batch telemetry-client wire-up** (~2-3h)

- `apps/batch/src/telemetry-client.ts` 신규 — POST `/api/telemetry` helper
- 7 게이지 wire-up (Phase 1 활성):
  - cost (cost-meter.ts)
  - batch_progress (pipeline.ts)
  - d1_slo (loader.ts)
  - quality_gate (qg2-validator.ts)
  - formula_accuracy (formula-engine integration)
  - reviewer_queue (Phase 2 deferred OK)
  - graph_integrity (quality.ts)
- e2e: BATCH dry-run → admin-web `/telemetry` 데이터 흐름 시각 확인
- 메모리 `project_engine_observability` 직접 위반 해소

### 3.2 결정 트리거 키워드

| 트리거                                       | 진행                                                                                                  |
| :------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **"Group A 잔여 2건 + Phase B 동시"** ★ 권고 | admin-web (3-4h) + telemetry-client (2-3h) + Phase B 보안 (1.5h) = ~7-9h, 영역 분리 가능              |
| **"Group A 잔여 2건만"**                     | admin-web + telemetry-client (~5-7h) → Phase B 별도                                                   |
| **"admin-web 먼저"**                         | CRIT-QPHASE1-1 단독                                                                                   |
| **"telemetry-client 먼저"**                  | CRITICAL-DO-S1-1 단독                                                                                 |
| **"BATCH-1 진입 직전 후속 PR 일괄"**         | Group A 잔여 2건 + Phase B + telemetry wire-up + admin-web vitest + production staging dry-run (~1주) |

**권고**: **"Group A 잔여 2건 + Phase B 동시"** — 영역 분리 가능 (admin-web vs apps/batch vs apps/admin-web 보안). 차세션 ~8시간 분량.

---

## 4. 차세션 진입 직후 1차 읽기 (핵심 5개)

1. **본 핸드오프** — `.jjokjipge/handoff-session-035.md`
2. **5-페르소나 통합 인덱스** — `.claude/reviews/phase1-tech-debt-20260502-index.md`
3. **5 페르소나 산출물 5개** — `.claude/reviews/phase1-tech-debt-20260502-{refactoring,performance,quality,backend,devops}.md`
4. **runbook 2개** — `docs/runbooks/{production-deployment,engine-telemetry-gc}.md`
5. **마이그레이션 0018** — `migrations/0018_enforce_draft_only_insert.sql`

### 4.1 직전 세션 핸드오프 체인

6. `.jjokjipge/handoff-session-034.md` (Phase 1 5-페르소나 트리거)
7. `.jjokjipge/handoff-session-033.md` (silent pivot 6건 결정)

### 4.2 진산님 메모리 정합

- `project_completion_notification_obligation` (기술 부채 0 정책 — Group A 잔여 2건 흡수까지 미충족)
- `project_engine_observability` (8 게이지 — CRITICAL-DO-S1-1 직접 위반 해소 의무)
- `feedback_no_shortcuts` (CRIT-QPHASE1-2 footnote trigger 흡수 완료)
- `feedback_review_filename_pattern` (review-_ prefix 정합 — phase1-tech-debt-_ 6 파일)
- `feedback_focus_reliability_not_schedule` (B-C2 staging dry-run runbook은 진산님 콘솔 작업 영역 명시)
- `feedback_single_vendor_cloudflare` (TD-DO-055 Cloudflare webhook receiver — 외부 SaaS 도입 금지)

---

## 5. 본 세션이 차세션에 넘기는 의무 (정직)

### 5.1 Group A 잔여 2건 (BATCH-1 진입 차단)

- CRIT-QPHASE1-1 admin-web vitest + 8 tests
- CRITICAL-DO-S1-1 apps/batch telemetry-client wire-up

### 5.2 Group B 4건 (Phase 2 진입 직전 의무)

- C-PERF-1: dashboard 16 round-trip Promise.all 병렬화
- C-PERF-2: engine_telemetry GC purgeOldTelemetry() 구현
- C-PERF-3: rate_limits 28.8M batch DELETE 도입
- C-PERF-4: parseFormula cache key tuple 변경

### 5.3 Group C 2건 (코드 품질 — 결정 의무)

- C-RF-1: resolveLoggerEnv 6중 복제 단일 출처화 (~1일)
- C-RF-2: withRetry 통합 + Claude API 4xx non-retryable (~1일)

### 5.4 누적 이월 MAJOR 70건 (handoff-034 36건 + 본 5-페르소나 신규 34건)

영역별 dedup 후 효과적 신규 ~25-30건 추정. master-test-checklist v3 + tech-debt.md ledger 일괄 갱신 의무 — Sprint 2 초기.

### 5.5 Phase 2 진입 ledger (devops 4건)

- TD-DO-053: Cron 15분 health-check trigger
- TD-DO-054: engine-version-bump.md runbook
- TD-DO-055: CI 실패 Cloudflare webhook receiver
- TD-DO-056: production-deployment.md staging dry-run runbook (✅ 본 세션 흡수)

### 5.6 verify 최종 검증 의무

본 세션 Group A 5건 commit 후 verify 최종 실행 미완료 (commit window 우선 처리). 차세션 진입 직후 verify 실행 + 결과 영속:

```bash
/home/soo/ClaudePro/ThePick/packages/quality/node_modules/.bin/tsx \
  /home/soo/ClaudePro/ThePick/scripts/verify-engine-contracts.ts --json \
  > .claude/reports/sprint1-step5-5-verify-after-group-a-20260502.json
```

### 5.7 session-health

본 세션 (034) ~120분 도달 추정 (90분 임계 초과). 차세션 (035) 도 90분 / 30턴 전 handoff-036 작성 의무.

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 034
**다음 세션**: Session 035 — Group A 잔여 2건 + Phase B 보안 + BATCH-1 진입 직전 후속 PR
**작성 효력**: 2026-05-02 ~17:10 KST
**예상 완료**: handoff-036 (Group A 7/7 + Phase B + BATCH-1 진입 직전 후속 PR 진행 + Step 20 진입 트리거)
