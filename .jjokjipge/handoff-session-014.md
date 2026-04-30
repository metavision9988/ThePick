# Handoff — Session 014 → Engine Hardening 5-페르소나 + 메타 감사 흡수 + P0 정정 진행

작성일: 2026-04-28 (KST)
직전 세션: 013 (Engine Hardening 방향 전환) → 014 (5-페르소나 + 메타 감사 + P0 첫 단계 정정)

---

## 0. 세션 014 가장 중요한 결정 3건

### 0.1 결정 1 — 진산님 통합 분석 path (시나리오 A 채택)

진산님 메타 감사 (`docs/plans/engine-hardening/reviews/Engine Hardening 중간 보고서 감사 (DEV COVEN 합동).md` + `Universal Knowledge Engine — 비전 설계.md`) 검토 후:

> **시나리오 A 채택** — 5-페르소나 §3.2 P0 진행 + P1 시점 4건 정정 (메타 감사 결함 1/2/3/7).

8 결함 중 거짓 통계 1건 (§9-9 ExamAdapter) 은 **fabrication 인정 + 직접 거부**. 통합 분석 보고서 v1.1 정정으로 결함 흡수 + 메타 감사 영속 보존.

### 0.2 결정 2 — D-C1 Anthropic Console cap 권고 A 채택

진산님 응답: **"권고대로 해주고, 망각하지 않도록 기록을 해두라고."**

핵심 발견 (본 세션에서 처음 명확화):

- 현 BATCH-1~5 적재 = Path A (Claude Code Opus 4.7 직접 처리, 본 프로젝트 Claude API 호출 X)
- ADR-025 의 cap = Path B (project's `processBatch(claudeClient, ...)`, Vision OCR, study-material-generator 등) 의 비용 차단
- 즉, **cap 미설정 자체는 BATCH-1 적재 차단 게이트 X** (5-페르소나 devops + DEV COVEN 의 "차단 항목" 표현은 격상)
- **Phase 2 진입 시점에 의무 활성** — 사전 설치 권고 (5분 비용 vs 미래 망각 위험)

진산님 손 작업 미확인 상태 (Console → Billing → Monthly cap=$200 + Alerts 50/80/100 + 스크린샷 → `docs/exit-strategy/anthropic-cap-2026-04.png`).

메모리 `project_anthropic_cap_pre_install.md` 등록 = Phase 2 진입 시 자동 환기 hook.

### 0.3 결정 3 — "두 번째 fix 실패 = 숲을 봐라" 메모리 등록

진산님 명시: **"같은 증상 한두번 또는 두세번 fix 시도 실패 시 문제는 다른 곳에 있을 수 있다. 나무만 보지 말고 숲을 다양한 각도에서 봐라."**

자주 발생하는 패턴이라 메모리 등록 의무. → `feedback_two_fix_failures_zoom_out.md` (5단계 행동 가이드 + 발생 신호 5건 명시).

---

## 1. 직전 세션(014) 에서 완료한 것

### 1.1 영속 문서 4건 (신규)

- `.claude/reports/engine-hardening-midpoint-20260428.md` (385줄) — Engine Hardening 중간 점검 v1.0
- `.claude/reports/engine-hardening-midpoint-20260428-synthesis.md` (164줄) — 5-페르소나 통합
- `.claude/reports/engine-hardening-vision-analysis-20260428.md` v1.1 (461줄, 336+125 §11 정정) — UKE 비전 통합 분석
- `.claude/reports/midpoint-meta-audit-20260428.md` (311줄) — 메타 감사 영속 보존

### 1.2 4-Pass 독립 에이전트 리뷰 산출물 8건

5-페르소나 (1차 — 중간 점검):

- `midpoint-20260428-{refactoring,performance,quality,backend,devops}.md` (5건)

P0 정정 4-Pass (2차 — review-gate.sh Stop Hook 의무):

- `midpoint-20260428-p0fix-{silent-failure,system-architect,quality}.md` (3건)
- 통합: `review-20260428-171431-p0-fixes-r1q1b3-4pass.md` (review-gate.sh 인식 형식)

### 1.3 코드 정정 3건 (137/137 PASS, typecheck PASS)

|    #     | 파일                             | 변경                                                                                                                                                      | 의도                                            |
| :------: | :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------- |
| **R-C1** | `apps/batch/src/cost-meter.ts`   | line 30 import + line 330-361 `toCheckpointCostState(): CheckpointCostState` 메서드 신규                                                                  | Step 11.6 plan §4.3.4 컴파일 에러 정정          |
| **Q-C1** | `apps/batch/src/checkpoint.ts`   | line 188-282 `assertCanonicalSafe` 재작성 — visited WeakSet + 9종 거부 (Symbol/WeakMap-WeakSet/Promise/TypedArray-DataView 4종 추가) + circular ref throw | silent collapse + stack overflow 차단           |
| **B-C3** | `migrations/0015_batch_runs.sql` | 트리거 정정 — 이름 `*_terminal` → `*_non_completed`, WHEN `OLD.state = 'completed'`                                                                       | stale 24h+ 'in_progress' recover 정상 경로 허용 |

### 1.4 신규 plan 1건

- `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md` v1.0 **APPROVED** (1007줄)
  - 진산님 §13 항목 1/2/3 모두 권고 A 승인 ("어렵군... 모두 권고대로 진행해줘")
  - **단 v1.1 정정 의무 발생** (P0 정정 4-Pass 결과)

### 1.5 메모리 2건 신규

- `feedback_two_fix_failures_zoom_out.md` ⭐ — 진산님 자주 발생 패턴
- `project_anthropic_cap_pre_install.md` ⭐ — Phase 2 진입 환기 hook
- MEMORY.md 인덱스 갱신 완료

### 1.6 1.6 step6 plan v1.1 정정 (1줄)

- `docs/plans/engine-hardening/step6-recover-snapshot.plan.md` 의 "step8" → "step11-6" 교차 참조 일관성 보정

---

## 2. 새 세션 첫 결정 — 후보 A/B/C 선택 의무 ⭐

### 2.1 P0 정정 4-Pass 통합 결과

| 에이전트              |         판정          | CRITICAL | MAJOR |
| :-------------------- | :-------------------: | :------: | :---: |
| silent-failure-hunter |  accept_with_caveats  |    0     |   2   |
| system-architect      |  accept_with_caveats  |    0     |   4   |
| **quality-engineer**  | **reject_and_revise** |  **4**   | **5** |

CRITICAL 4건 모두 quality 영역 — 코드 정합 ✅, 테스트+plan 미흡 ❌.

### 2.2 CRITICAL 4건 매트릭스

|   #    | 항목                                                                         | 시급도  |
| :----: | :--------------------------------------------------------------------------- | :-----: |
| **Q3** | AC-Snapshot plan 5종 → 9종 미갱신 = Silent Pivot = **CRITICAL RULE #1 위반** | 🔴 즉시 |
|   Q1   | `toCheckpointCostState()` 단위 테스트 0건                                    |   🟠    |
|   Q2   | `assertCanonicalSafe` 신규 4종+circular 거부 검증 0건                        |   🟠    |
|   Q4   | 0015 트리거 e2e 검증 0건                                                     |   🟠    |

추가 SA-M1 (즉시): Step 11.6 plan §4.3.4 `extractCostState(meter)` → `meter.toCheckpointCostState()` 5곳 갱신.

### 2.3 진산님 결정 후보 3건

|        후보         | 추가 시간 | 처리 방식                                                           | 위험                  |
| :-----------------: | :-------: | :------------------------------------------------------------------ | :-------------------- |
|    **A (엄격)**     |   +2.3d   | Q1~Q4 모두 즉시 정정 + 4-Pass 재검증 후 Step 11.6 진입              | 0                     |
| **B (절충 — 권고)** |   +0.3d   | Q3+SA-M1+SA-M2 즉시. Q1/Q2/Q4 는 Step 11.6 통합 시 e2e 로 동시 작성 | 신규 테스트 흡수 의존 |
|     C (그대로)      |     0     | Silent Pivot 지속 → CRITICAL RULE #1 위반 누적                      | **비추천**            |

본 세션 권고: 후보 B (절충). 새 세션에서 진산님 최종 결정 후 진입.

---

## 3. 다음 세션 작업 — 우선순위 정렬

### 3.1 즉시 (새 세션 진입 직후)

|  우선  | 작업                                                                                                                            |    시간     |
| :----: | :------------------------------------------------------------------------------------------------------------------------------ | :---------: |
| **A0** | **진산님 후보 A/B/C 결정 요청**                                                                                                 | 진산님 응답 |
|   A1   | (B 채택 시) Q3+SA-M1+SA-M2 정정 — Step 11.6 plan v1.1 + 0015 마이그레이션 idempotency                                           |    0.3d     |
|   A2   | (A 채택 시) Q1~Q4 신규 단위 테스트 + e2e + 4-Pass 재검증                                                                        |    2.3d     |
| **B**  | **B-C1+B-C2** — Step 5 plan + 0016 마이그레이션 + BatchRunsDb examId                                                            |    1.5d     |
|   C    | ROADMAP v1.1 → v1.2 패치 (Step 11.6 + 본 세션 결과 반영)                                                                        |    0.2d     |
|   D    | Step 11.6 코드 구현 (PipelineContext + recover/checkpoint/CostMeter 통합 + signal handler + fsync + D1 어댑터 + e2e 테스트 4건) |   2.6~3d    |

### 3.2 권고 진행 순서 (후보 B 채택 시)

```
[5분]   D-C1 진산님 Anthropic cap (선택, 메모리 등록 완료)
[0.3d]  Q3+SA-M1+SA-M2 즉시 정정
[1.5d]  B-C1+B-C2
[0.2d]  ROADMAP v1.2 패치
[2.6~3d] Step 11.6 코드 + 신규 테스트 (Q1+Q2+Q4 흡수)
[1d]    Step 11.6 4-Pass 리뷰
[병렬]  Step 2~4 Property test
```

총 약 5.6~6d 후 BATCH-1 진입 가능 (5-페르소나 §3.2 의 4.4d 대비 +1.2~1.6d).

### 3.3 P1 시점 (BATCH-1 dry-run 통과 후 1주, 약 4.5d)

메타 감사 결함 흡수:

- ADR-026: Engine vs Service Boundary
- ADR-027: CBIV-Self-Test (메타 감사 결함 2 — P2 → P1 격상)
- ADR-029: 북극성 KPI 정의
- ADR-030: UKE Vision (Year 2 4 시나리오 분기 plan 명시 의무)
- 8 → 11 페르소나 review (legal/ux-researcher/content-strategist/domain-expert 추가)

---

## 4. 핵심 문서 위치 (필수 읽기)

### 4.1 새 세션 진입 직후 1차 읽기 (10분)

1. **본 핸드오프** — `.jjokjipge/handoff-session-014.md`
2. **5-페르소나 통합** — `.claude/reports/engine-hardening-midpoint-20260428-synthesis.md`
3. **메타 감사** — `.claude/reports/midpoint-meta-audit-20260428.md`
4. **통합 분석 v1.1** — `.claude/reports/engine-hardening-vision-analysis-20260428.md` (특히 §11 정정)
5. **P0 4-Pass 통합** — `.claude/reviews/review-20260428-171431-p0-fixes-r1q1b3-4pass.md`
6. **CLAUDE.md** (프로젝트 룰)

### 4.2 작업 진입 시 읽기

| 작업                          | 필수 읽기                                                                                                    |
| :---------------------------- | :----------------------------------------------------------------------------------------------------------- |
| Q3+SA-M1 정정 (B 채택 시)     | `step11-6-...plan.md` §3 §4.3.4 §7 + `.claude/reviews/midpoint-20260428-p0fix-{quality,system-architect}.md` |
| Q1~Q4 신규 테스트 (A 채택 시) | 동상 + `apps/batch/__tests__/{cost-meter,checkpoint,recover}.test.ts` 패턴                                   |
| B-C1 (Step 5 plan + 0016)     | `step5-reproducibility-idempotency.plan.md` + `migrations/0014_*.sql` (화이트리스트 갱신 패턴)               |
| B-C2 (BatchRunsDb examId)     | `apps/batch/src/recover.ts:57-70` + `packages/shared/src/exam-adapter.ts` + `constants/exam-ids.ts`          |
| Step 11.6 코드 (B 채택 시)    | step11-6 plan + 본 핸드오프 §1.3 코드 정정 결과                                                              |

---

## 5. 주의사항 (강제 — 세션 014 학습)

### 5.1 review-gate.sh Stop Hook 차단 메커니즘

**코드 변경 발생 시 `.claude/reviews/review-YYYYMMDD-HHMMSS-*.md` 영속 보고서 없이 "완료" 선언 시 차단.** 본 세션 P0 정정 3건 이후 Hook 발동 → 4-Pass 즉시 호출 + 통합 보고서 작성으로 통과.

권장 패턴:

1. 코드 작성 + 단위 테스트 → typecheck PASS → vitest PASS
2. **3+ 독립 서브에이전트 병렬 호출** (silent-failure-hunter / system-architect / quality-engineer)
3. 통합 보고서 작성 (`review-YYYYMMDD-HHMMSS-*.md` 형식)
4. CRITICAL 0건 확인 후 "완료" 선언

### 5.2 Q3 Silent Pivot 패턴 — CRITICAL RULE #1 위반 차단

코드가 plan 본문보다 진화하면 "기획 ≠ 구현" = CRITICAL RULE #1 위반. 반드시:

- 코드 정정 시 plan 본문 동기 갱신
- AC 항목 본문 갱신 의무 (Step 11.6 plan §7 등)
- 진산님 즉시 보고 (다른 결함과 격이 다름)

### 5.3 진산님 자주 발생 패턴 — 두 번째 fix 실패 시 숲 봐라

메모리 `feedback_two_fix_failures_zoom_out.md` 등록. 본 세션 자체에서 발견한 fabrication (§9-9 ExamAdapter 거짓 통계) 도 일종의 자기 정당화 → 메타 감사가 발견 → 정정. 동일 패턴 자체 반복 차단.

### 5.4 진산님 결정 영역 vs 자율 영역

**진산님 명시 승인 필요:**

- 새 ADR ACCEPTED
- 큰 방향 전환 (시나리오 A/B/C 같은 결정)
- 진산님 통제: 일정·법무·결제 PG·SLM/LoRA·교재 저작권·Anthropic cap

**자율 진행:**

- 단계별 plan/research/contract 작성
- 코드 구현 (plan 명시 시)
- 4-Pass 리뷰 + 정정
- ROADMAP 패치 (시간 추정 갱신 등)
- 메모리 등록/갱신 (진산님 요청 시 우선)

### 5.5 5-페르소나 시간 추정 underestimate 경향

본 세션 학습: **5-페르소나 §3.2 의 "0.5d" 추정이 quality-engineer 권고 2.25d 와 4.5배 차이**. 향후 5-페르소나 시간 추정은 1.5~2배 보정 권고.

---

## 6. 진산님 메모리 (자동 로드)

자동 로드되는 핵심 메모리 — 별도 행동 불필요:

- `project_content_build_engine_as_core.md`
- `project_batch_load_workflow.md` (단 본 세션 BATCH 진입 보류 정합)
- `feedback_document_first_workflow.md` ⭐
- `feedback_two_fix_failures_zoom_out.md` ⭐ **신규 — 본 세션 등록**
- `project_anthropic_cap_pre_install.md` ⭐ **신규 — 본 세션 등록**
- `feedback_no_shortcuts.md`
- `feedback_focus_reliability_not_schedule.md`
- `feedback_no_granular_decisions.md`
- `feedback_auto_review.md`
- `feedback_phase_review_5_persona.md`
- `feedback_single_vendor_cloudflare.md`
- `project_source_citation_requirement.md`
- `project_v3_final_multi_exam_deferred.md`
- `project_vision_mvp_generalization.md`

---

## 7. 새 세션 시작 prompt

새 세션 시작 후 첫 입력으로 다음 사용:

### 옵션 A (간결 — 권고)

```
.jjokjipge/handoff-session-014.md 읽고 이어가줘
```

→ Claude 가 핸드오프 읽고 §3.1 의 A0 (후보 A/B/C 결정 요청) 자동 진입.

### 옵션 B (후보 명시)

```
.jjokjipge/handoff-session-014.md 읽고 후보 B 진행
```

또는

```
.jjokjipge/handoff-session-014.md 읽고 후보 A 진행 (엄격)
```

### 옵션 C (특정 작업 명시)

```
.jjokjipge/handoff-session-014.md 읽고 B-C1 (Step 5 plan + 0016 마이그레이션) 부터
```

---

## 8. 세션 014 메타 통계

- 시작 시각: 2026-04-28 ~10:32 KST (state file)
- 종료 시각: 2026-04-28 ~17:14 KST (4-Pass 통합 보고서 작성 완료 시점)
- 누적 시간: 약 6.7시간
- 누적 턴: 9
- 영속 문서 산출: 16건 (보고서 4 + 4-Pass 리뷰 8 + plan 1 신규 + plan 1 정정 + 메모리 2)
- 코드 변경: 3건 (R-C1/Q-C1/B-C3) + 137/137 tests PASS
- session-health.md 권고 90분 / 50턴 임계 — 시간 초과, 턴은 안전 범위

---

## 9. 진척도 (백분율)

Engine Hardening Roadmap v1.1 기준 (본 세션 후):

| Phase                                     | 산출물                                                          |  진행   |
| :---------------------------------------- | :-------------------------------------------------------------- | :-----: |
| Phase 0 (마스터 + ADR + 설계)             | ROADMAP v1.1 + ADR 4건 + LLM_CONTAINMENT.md                     | ✅ 100% |
| Phase 1 (엔진 contract)                   | research × 3 + contract × 3                                     | ✅ 100% |
| Phase 2 (단계별 plan)                     | step1~7 + step6 + step11.6 v1.0 APPROVED (단 v1.1 정정 의무)    | 🟡 95%  |
| Phase 3 (코드 구현)                       | Step 1 + Step 11.5 + R-C1/Q-C1/B-C3 정정 / Step 2~5,7,11.6 잔여 | 🟡 ~33% |
| Phase 4 (자동 검증 + 4-Pass + 5-페르소나) | 4-Pass 4건 + 5-페르소나 1건 + 메타 감사 1건                     | 🟡 ~35% |
| Phase 5 (BATCH-1 적재 진입)               | —                                                               |  ⏳ 0%  |

**총 진행률 (메타 감사 결함 2 정합 — production 검증 weight 보정):** 약 **52~57%**

---

**핸드오프 작성자:** Claude (Opus 4.7)
**다음 세션 시작 권고:** 옵션 A — `.jjokjipge/handoff-session-014.md 읽고 이어가줘`
**첫 결정:** 후보 A/B/C 선택 (시나리오 A 정합)
