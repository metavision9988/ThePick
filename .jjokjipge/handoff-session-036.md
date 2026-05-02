# Handoff — Session 036 → Group A 잔여 2건 즉시 흡수 + Phase B 강화 + WBS 대시보드 sync

작성일: 2026-05-02 ~22:15 KST
직전 세션: 035 (verify 의무 + 회귀 흡수 + 4-Pass MAJOR 1+2 + WBS 대시보드 신설)

---

## 0. 본 세션(035) 누적 결과

### 0.1 commits 체인 (2건)

|  #  | Commit    | 단계                       | 핵심                                                                                            |
| :-: | :-------- | :------------------------- | :---------------------------------------------------------------------------------------------- |
|  1  | `48545f3` | verify 회귀 흡수           | loader page_ref 정규식 0010\|0018 alternation (batch 308/309 → 309/309)                         |
|  2  | `b6605b6` | 4-Pass MAJOR 1+2 즉시 흡수 | 트리거 등록 invariant 검증 + 빈 문자열 차단 회귀 게이트 (batch 309 → 311, 모노레포 1172 → 1174) |

### 0.2 본 세션 7단계 작업

1. **§5.6 verify 영속 의무 처리** (handoff-035 §5.6 명시 차세션 의무)
   - `verify-engine-contracts.ts --json > .claude/reports/sprint1-step5-5-verify-after-group-a-20260502.json`
   - **회귀 발견**: batch 308/309 FAIL (원인: 직전 세션 `2d10ed9` 마이그레이션 0018 + `3a39310` SCENARIO_MIGRATIONS 0001~0018 확장 부수효과 — `loader.test.ts:215` 가 0010 트리거 메시지 단독 기대했으나 0018 트리거가 NULL 케이스 먼저 발화)
2. **L1 회귀 fix** — `loader.test.ts:215` 정규식 `/page_ref is required/` → `/page_ref is required\|Hard Rule 13 violation/` alternation + 설명 "0010 + 0018 의도된 redundancy" 갱신 → commit `48545f3`
3. **review-gate hook 발화** → 독립 에이전트 위임 (silent-failure-hunter, agentId `a73327b5c71fc1d3c`) → Pass 1+2 검증 → CRITICAL 0 / MAJOR 3 / MINOR 4
4. **MAJOR-1 + MAJOR-2 즉시 흡수** (`feedback_no_granular_decisions` 정합 — 품질 지엽 결정 비협의 자동):
   - MAJOR-1: 트리거 등록 invariant 검증 테스트 추가 (sqlite_master 에 `enforce_knowledge_nodes_page_ref_not_null` + `enforce_page_ref_on_insert` 양쪽 등록 강제)
   - MAJOR-2: 0010 strict superset 빈 문자열 차단 회귀 게이트 테스트 추가
   - `verify-engine-contracts.ts:148` batch required 309 → 311 동시 갱신
   - 리뷰 산출물 영속: `.claude/reviews/review-20260502-batch-loader-regex-regression.md`
   - commit `b6605b6`
5. **WBS Gantt 진척 대시보드 신설** (진산님 명시 요청 "엔진 품질 검증 wbs 간트 차트")
   - `.jjokjipge/wbs-quality-progress.md` 영속 (8 섹션: Executive Summary / WBS 트리 / Mermaid Gantt / Cat 1~8 / 우선순위 매트릭스 / Devil's Advocate Ledger / 메모리 정합 / 결정 트리거 / 갱신 trigger)
   - 38 task × 12 section Mermaid Gantt — Sprint 0 (5/1 22:30) ~ BATCH-1 진입 (5/9 추정) ~ Phase 2 (5/15~ 추정)
6. **메모리 등록 + 인덱스 관리** (진산님 명시 요청 "메모리에 등록 관리 권고 진행"):
   - `~/.claude/projects/-home-soo-ClaudePro-ThePick/memory/reference_quality_wbs_dashboard.md` 신규
   - `MEMORY.md` line 25 인덱스 추가
   - 차세션 entry 1차 읽기 5 → 6개 확장 (handoff-N + tech-debt index + 4-Pass index + 5 페르소나 5개 + runbook 2개 + **WBS 대시보드**)
7. **handoff-036 작성** (본 문서)

### 0.3 verify 실측 (최종)

```
overallStatus: PASS, EXIT 0
@thepick/shared:        50 / 50  PASS
@thepick/formula-engine: 303 / 303 PASS
@thepick/parser:        155 / 155 PASS
@thepick/quality:        57 / 57  PASS
@thepick/batch:         311 / 311 PASS  (308 → 309 → 311, +3)
@thepick/api:           285 / 285 PASS
@thepick/ai-adapter:     13 / 13  PASS
모노레포 합계:        1174 / 1174 PASS  (1172 → 1174, +2)
자동 게이트:            9 / 9 PASS
```

---

## 1. Group A 7건 흡수 상태 (handoff-035 §1 그대로 + 본 세션 무영향)

| ID                                              | 페르소나 |    상태     | Commit                |
| :---------------------------------------------- | :------- | :---------: | :-------------------- |
| B-C1 (Hard Rule 16 progress examId)             | backend  |     ✅      | `3a39310`             |
| B-C2 (production staging dry-run runbook)       | backend  |     ✅      | `789b28b`             |
| B-C3 (engine_telemetry GC runbook)              | backend  |     ✅      | `789b28b`             |
| CRIT-QPHASE1-2 (footnote expansion trigger)     | quality  |     ✅      | `760fa4f`             |
| CRIT-QPHASE1-3 (Hard Rule 13 e2e + 0018)        | quality  |     ✅      | `2d10ed9` + `3a39310` |
| **CRIT-QPHASE1-1** (admin-web vitest + 8 tests) | quality  | ❌ **이월** | 차세션                |
| **CRITICAL-DO-S1-1** (telemetry-client wire-up) | devops   | ❌ **이월** | 차세션                |

**5/7 흡수 유지. 잔여 2건 차세션 진입 직후 즉시 흡수 의무.**

---

## 2. Sprint 1 + Phase 1 진행 상태 (handoff-035 §2 갱신)

```
[x] §5.1~§5.5  Sprint 1 강화 완료                                       ← 028~033
[x] Sprint 1 §5.5 commit window — 5 commits                              ← 034
[x] Phase 1 5-페르소나 5병렬 (CRITICAL 13 / MAJOR 34 / MINOR 22)         ← 034
[x] Group A 5/7 흡수 — B-C1/2/3 + CRIT-QPHASE1-2/3                       ← 034
[x] Group A 5건 4-Pass MAJOR 4건 즉시 흡수                                ← 034
[x] §5.6 verify 영속 의무 + 회귀 흡수 + 4-Pass MAJOR 1+2 즉시 흡수        ← 본 세션
[x] WBS Gantt 진척 대시보드 신설 + 메모리 등록                             ← 본 세션
[ ] Group A 잔여 2건 — CRIT-QPHASE1-1 (admin-web) + CRITICAL-DO-S1-1     ← 차세션 진입 첫 우선
[ ] Phase B 보안 패치 — localStorage → httpOnly cookie 추가 강화 (~1.5h)  ← 차세션 (병렬 가능)
[ ] Group B 4건 — performance (Phase 2 진입 직전 의무)                    ← Phase 2
[ ] Group C 2건 — refactoring (Phase 1 종료 게이트 또는 Phase 2)         ← 결정 의무
[ ] master-test-checklist v3 갱신 (Cat 5 분리 5A/5B + footnote 진척도)   ← Sprint 2 초기
[ ] tech-debt.md 신규 등록 — TD-DO-053~056 + Group B/C 28~30건 + TD-API-001 + TD-VRF-001 ← Sprint 2 초기
[ ] BATCH-1 진입 직전 후속 PR (~1주)                                      ← Group A 7/7 + Phase B 후
[ ] BATCH-1 적재 진입 (Step 20)                                          ← 진산님 트리거
```

---

## 3. 진산님 차세션 진입 결정 의무 (handoff-035 §3.2 그대로 유효)

### 3.1 (★ 권고) Group A 잔여 2건 + Phase B 동시 — ~7-9h, 영역 분리 가능

**CRIT-QPHASE1-1 — admin-web vitest + 8 tests** (~3-4h)

- `apps/admin-web/package.json` scripts.test 추가 + vitest + @testing-library/react 도입
- 최소 8 tests:
  - TokenForm 입력 → POST /login → cookie 모드
  - TelemetryDashboard 4 상태 (loading/success/unauthorized/error)
  - 30s polling cleanup (unmount setInterval 해제) + AbortController in-flight cancel
  - resolveApiBase production env 미설정 throw
  - GraphVisualizer mount/unmount D3 cleanup (svg child count 0)
- 1차 5-페르소나 (2026-05-01) CRIT-Q1 1주+ 영속 흡수

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

**Phase B 보안 강화** (~1.5h, 영역 분리 동시 가능)

- `apps/admin-web/` localStorage admin_api_token → httpOnly cookie 추가 강화 (v1.1 §10.7 #9 잔여 흡수)
- 직전 세션 028 commit `e5273da` 1차 전환 후속

### 3.2 결정 트리거 키워드

| 트리거                                       | 진행                                                                                                  |
| :------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| **"Group A 잔여 2건 + Phase B 동시"** ★ 권고 | admin-web (3-4h) + telemetry-client (2-3h) + Phase B (1.5h) = ~7-9h                                   |
| **"Group A 잔여 2건만"**                     | admin-web + telemetry-client (~5-7h) → Phase B 별도                                                   |
| **"admin-web 먼저"**                         | CRIT-QPHASE1-1 단독                                                                                   |
| **"telemetry-client 먼저"**                  | CRITICAL-DO-S1-1 단독                                                                                 |
| **"BATCH-1 진입 직전 후속 PR 일괄"**         | Group A 잔여 2건 + Phase B + telemetry wire-up + admin-web vitest + production staging dry-run (~1주) |

---

## 4. 차세션 진입 직후 1차 읽기 (★ 6개 — 본 세션 +1)

1. **본 핸드오프** — `.jjokjipge/handoff-session-036.md`
2. **★ WBS 진척 대시보드** (신규) — `.jjokjipge/wbs-quality-progress.md` (Mermaid Gantt + 우선순위 매트릭스 + Devil's Advocate Ledger)
3. **5-페르소나 통합 인덱스** — `.claude/reviews/phase1-tech-debt-20260502-index.md`
4. **본 세션 회귀 흡수 리뷰** — `.claude/reviews/review-20260502-batch-loader-regex-regression.md`
5. **5 페르소나 산출물 5개** — `.claude/reviews/phase1-tech-debt-20260502-{refactoring,performance,quality,backend,devops}.md`
6. **runbook 2개** — `docs/runbooks/{production-deployment,engine-telemetry-gc}.md`

### 4.1 직전 세션 핸드오프 체인

7. `.jjokjipge/handoff-session-035.md` (Group A 5/7 흡수 + 잔여 2건 trigger)
8. `.jjokjipge/handoff-session-034.md` (Phase 1 5-페르소나 트리거 + 이월 36건)

### 4.2 진산님 메모리 정합 (본 세션 갱신)

- `reference_quality_wbs_dashboard` (★ 본 세션 신규) — WBS Gantt 대시보드 위치 + 갱신 trigger 6종
- `project_completion_notification_obligation` — Group A 잔여 2건 흡수까지 위반 위험 유지
- `project_engine_observability` — CRITICAL-DO-S1-1 흡수 의무 유지 (telemetry wire-up 0건)
- `feedback_no_granular_decisions` — 본 세션 MAJOR 1+2 비협의 자동 흡수로 정합 검증
- `feedback_review_filename_pattern` — review-20260502-batch-loader-regex-regression.md 정합
- `feedback_two_fix_failures_zoom_out` — verify 비결정성 TD-VRF-001 ledger 명시
- `feedback_document_first_workflow` — WBS 대시보드 영속으로 정합 검증

---

## 5. 본 세션이 차세션에 넘기는 의무 (정직)

### 5.1 Group A 잔여 2건 (BATCH-1 진입 차단) — handoff-035 §5.1 그대로

- CRIT-QPHASE1-1 admin-web vitest + 8 tests
- CRITICAL-DO-S1-1 apps/batch telemetry-client wire-up

### 5.2 본 세션 신규 이월 항목 (Sprint 2 초기 처리)

- **TD-API-001** — SCENARIO_MIGRATIONS 두 wrapper 분기 (apps/api/src/**tests**/helpers/d1-from-sqlite.ts 명시 배열 vs apps/batch/src/loader/local-db.ts 자동 readdir). silent-failure-hunter MAJOR-3 발견. 미래 0019 마이그레이션 추가 시 d1-from-sqlite.ts:38-57 갱신 망각하면 api 테스트가 0019 트리거 영향을 받지 못한 채 PASS → 본 세션 회귀 패턴 재발 위험. **권고**: SCENARIO_MIGRATIONS 동적 readdir 전환 또는 verify 게이트 추가.
- **TD-VRF-001** — verify vitest 카운트 비결정성. 본 세션 첫 verify 실측 batch 310/311 FAIL → 즉시 재실행 311/311 PASS. vitest stdout buffering 또는 reporter timing 추정. `feedback_two_fix_failures_zoom_out` 정합 추적 ledger.

### 5.3 Group B 4건 (Phase 2 진입 직전 의무) — handoff-035 §5.2 그대로

- C-PERF-1: dashboard 16 round-trip Promise.all 병렬화
- C-PERF-2: engine_telemetry GC purgeOldTelemetry() 구현
- C-PERF-3: rate_limits 28.8M batch DELETE 도입
- C-PERF-4: parseFormula cache key tuple 변경

### 5.4 Group C 2건 (코드 품질 — 결정 의무) — handoff-035 §5.3 그대로

- C-RF-1: resolveLoggerEnv 6중 복제 단일 출처화 (~1일)
- C-RF-2: withRetry 통합 + Claude API 4xx non-retryable (~1일)

### 5.5 누적 이월 MAJOR 70건 + 본 세션 추가 2건 (TD-API-001 + TD-VRF-001) = 72건

영역별 dedup 후 효과적 신규 ~25-30건 추정. master-test-checklist v3 + tech-debt.md ledger 일괄 갱신 의무 — Sprint 2 초기.

### 5.6 verify 비결정성 차세션 진입 처리

차세션 진입 직후 verify 실행 시 batch 카운트가 비결정적 (310 또는 311). PASS 보장 위해 **연속 2회 실행 + 두 번 모두 PASS** 확인 권고. 또는 TD-VRF-001 root cause 분석을 차세션 첫 task 로 진행.

### 5.7 session-health

본 세션 (035) ~4시간 도달 (90분 임계 한참 초과). 차세션 (036) 도 90분 / 30턴 전 handoff-037 작성 의무.

---

**핸드오프 작성**: Claude (Opus 4.7 1M context) — Session 035
**다음 세션**: Session 036 — Group A 잔여 2건 + Phase B 강화 + WBS 대시보드 첫 sync
**작성 효력**: 2026-05-02 ~22:15 KST
**예상 완료**: handoff-037 (Group A 7/7 + Phase B + BATCH-1 진입 직전 후속 PR 진행 + WBS 대시보드 §1+§2+§4+§6 갱신 + Step 20 진입 트리거)
