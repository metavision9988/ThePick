# Handoff — Session 015 → Step 11.6 코드 진입 직전

작성일: 2026-04-29 (KST)
직전 세션: 014 (Engine Hardening 5-페르소나 + 메타 감사 + P0 첫 단계 정정) → 015 (후보 B 채택 후 P0 잔여 정정 + B-C1+B-C2 + 4-Pass + ROADMAP v1.2)

---

## 0. 세션 015 핵심 결정

### 0.1 결정 — 진산님 후보 B (절충안) 채택

핸드오프 014 §2.3 의 후보 A/B/C 중 **B 채택**:

- 즉시 정정: Q3 + SA-M1 + SA-M2 (0.3d)
- 명시 이연: Q1/Q2/Q4 단위 테스트는 Step 11.6 코드 구현 시 e2e 흡수

이후 권고대로 진행 = B-C1+B-C2 → 4-Pass 자동 → ROADMAP v1.2 패치 → 본 핸드오프.

### 0.2 결정 — 4-Pass 통합 후 즉시 정정 3건 처리

B-C1+B-C2 4-Pass 가 발견한 추가 CRITICAL:

- **SA-CRITICAL** (system-architect) — Step 11.6 plan §10 "caller 없음" 거짓 진술 → 6 callsite 명시
- **SF-M-2** (silent-failure-hunter) — recover.ts examId 일관성 가드 14줄 추가
- **Q-CRITICAL-Q4** (quality-engineer) — Step 5 plan draft-loader.ts:247 미반영 → 명시 이연

3건 모두 즉시 정정 후 통합 4-Pass 보고서 작성 (review-gate.sh 통과 형식).

### 0.3 결정 — ROADMAP v1.1 → v1.2 패치

후보 B 흡수 결과 시간 추정 +4.3~4.8d (11d → 15.3~15.8d). v1.2 갱신 의무.

---

## 1. 직전 세션(015) 에서 완료한 것

### 1.1 영속 문서 산출 (8건)

#### 4-Pass 독립 에이전트 리뷰 (4건)

- `.claude/reviews/review-20260428-200210-bc1bc2-step5-examid-silent-failure.md` (silent-failure-hunter)
- `.claude/reviews/review-20260428-200307-bc1bc2-step5-examid-system-architect.md` (system-architect)
- `.claude/reviews/review-20260428-200211-bc1bc2-step5-examid-quality.md` (quality-engineer)
- `.claude/reviews/review-20260428-200210-bc1bc2-step5-examid-4pass.md` (통합 보고서, review-gate.sh 형식)

#### plan 정정 (4건)

- `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md` v1.0 → v1.1 (P0 정정 + B-C2 + SA-CRITICAL 흡수)
- `docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md` v1.0 → v1.1 (B-C1 + Q-CRITICAL-Q4 명시 이연)
- `docs/plans/engine-hardening/ROADMAP.md` v1.1 → v1.2 (5-페르소나 + P0 + B-C1+B-C2 통합 정정 흡수)
- `migrations/0015_batch_runs.sql` SA-M2 정정 (DROP TRIGGER IF EXISTS 옛 이름)

### 1.2 코드 변경 (4건, 137/137 PASS, typecheck PASS)

|     #      | 파일                                   | 변경                                                                                                                                      | 의도                                                  |
| :--------: | :------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------- |
| **B-C2-1** | `apps/batch/src/recover.ts`            | `import type { ExamId } from '@thepick/shared'` + BatchRunsDb 메서드 3개 첫 인자 examId + RecoverOptions.examId required + 본문 호출 갱신 | Hard Rule 16 정합 (Year 1 한시 예외)                  |
| **B-C2-2** | `apps/batch/src/checkpoint.ts`         | `import type { ExamId }` + BatchCheckpoint.exam_id? optional + SnapshotInput.examId? optional + buildCheckpoint spread                    | Hard Rule 17 Year 1 한시 예외 + Year 2 zero-cost 전환 |
| **B-C2-3** | `apps/batch/__tests__/recover.test.ts` | `EXAM_IDS.SON_HAE_PYEONG_GA_SA` import + makeMockDb 시그니처 + 8개 recoverBatch 호출 examId 추가                                          | 시그니처 회귀 흡수                                    |
| **SF-M-2** | `apps/batch/src/recover.ts:230-244`    | `checkpoint.exam_id !== opts.examId` 시 `recovery_failed` 가드 14줄 추가                                                                  | Year 2 cross-tenant recover silent 통과 차단          |

### 1.3 신규 마이그레이션 (1건)

- `migrations/0016_knowledge_nodes_batch_idempotency.sql` (95줄) — knowledge_nodes 에 batch_run_id/source_id 컬럼 + partial UNIQUE INDEX + 0014 prevent_knowledge_nodes_update 화이트리스트 갱신 (NULL→값 1회 backfill 허용)

### 1.4 검증 결과

- **typecheck PASS** (`pnpm -C apps/batch typecheck`)
- **137/137 tests PASS** (회귀 0건, plan/sql/recover.ts examId 가드 모두 기존 path 영향 0)

---

## 2. 4-Pass 통합 결과 — 명시 이연 9 AC

### 2.1 페르소나별 산출물

| 페르소나              |        판정         |        CRITICAL        |     MAJOR     |
| :-------------------- | :-----------------: | :--------------------: | :-----------: |
| silent-failure-hunter | accept_with_caveats |           0            | 2 (M-1 / M-2) |
| system-architect      |  reject_and_revise  | 1 (plan §10 거짓 진술) |       1       |
| quality-engineer      |  reject_and_revise  |  5 (모두 후보 B 정합)  |       3       |

### 2.2 즉시 정정 (3건, 본 세션 처리 완료)

- SA-CRITICAL → Step 11.6 plan §10 정정 + 6 callsite 표 + 코드 진입 첫 commit 일괄 갱신 SLO
- SF-M-2 → recover.ts:230-244 examId 일관성 가드 14줄
- Q-CRITICAL-Q4 → Step 5 plan v1.1 명시 이연 절 신규 (draft-loader.ts:247 + page_ref null 처리 옵션 B `<no_page>#{node_id}` fallback 권고)

### 2.3 명시 이연 9 AC (Step 11.6 코드 구현 시 e2e 흡수)

| AC                 | 정의                                          | 흡수 위치                                                                  |
| :----------------- | :-------------------------------------------- | :------------------------------------------------------------------------- |
| AC-Cost            | toCheckpointCostState 7 케이스                | `cost-meter-pipeline-kill.test.ts` 신규                                    |
| AC-Snapshot'       | canonicalJson 9종+circular 13 케이스          | `checkpoint.test.ts` 확장 또는 `pipeline-integration.test.ts`              |
| AC-T3              | batch_runs state transition 5×7 + race window | `d1-trigger-verify.test.ts` 신규 (better-sqlite3)                          |
| AC-R1~R6           | mock → production e2e 격상                    | `pipeline-integration.test.ts` 신규                                        |
| AC-ExamId          | BatchRunsDb examId 시그니처 + SF-M-2 가드     | `pipeline-integration.test.ts` 또는 신규 `examid-tenant-isolation.test.ts` |
| AC-RP-6            | 0016 마이그레이션 + 0014 화이트리스트 e2e     | `d1-trigger-verify.test.ts` 또는 `migrations-0016.test.ts`                 |
| AC-RP-7            | source_id 결정성 100회 반복                   | `draft-loader.test.ts` 신규 (Step 5 코드 구현 시)                          |
| AC-Snapshot-ExamId | exam_id 직렬화 + state_hash 영향              | `checkpoint.test.ts` 확장                                                  |

---

## 3. 다음 세션 작업 — Step 11.6 코드 구현 ⭐

### 3.1 작업 분해 (3.1~3.5d 추정)

| 우선  | 작업                                                                                                                                                                            | 시간  | 의존  |
| :---: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---: | :---- |
| **A** | `PipelineContext` 확장 (examId/batchRunId/checkpointBaseDir/batchRunsDb/engineVersion required + costMeter/enableSignalHandlers/fsyncCheckpoint optional)                       | 0.15d | —     |
|   A   | `toSnapshot()` helper 신규 (PipelineState → PipelineStateSnapshot 변환, sibling reference 미발생 보장)                                                                          | 0.2d  | A     |
| **B** | `runPipeline` 흐름 통합 — `0. recoverBatch()` → `0.5 batch_runs INSERT/UPDATE` → `0.7 SIGINT handler 등록` → `0.9 CostMeter start` → stage loop (resume 시 skip) → finally 정리 | 0.5d  | A     |
|   B   | `writeCheckpoint` fsync 옵션 + `writeCheckpointSync` 신규 (이연 3 처리)                                                                                                         | 0.2d  | —     |
| **C** | `apps/batch/src/signal-handlers.ts` 신규 (SIGINT/SIGTERM handler)                                                                                                               | 0.15d | B     |
| **D** | `apps/batch/src/d1-batch-runs-db.ts` 신규 (BatchRunsDb D1 어댑터 실구현 — examId void 패턴, drizzle 미사용 raw SQL, 향후 Year 2 WHERE 추가)                                     | 0.25d | A     |
| **E** | 6 callsite 일괄 갱신 — `apps/batch/bin/batch.ts:156-169` + `pipeline.integration.test.ts` 5건                                                                                   | 0.3d  | B     |
| **F** | 신규 통합 테스트 4건 작성 + 단위 테스트 흡수                                                                                                                                    | 0.7d  | C/D/E |
|  F1   | `pipeline-integration.test.ts` (AC-1, AC-R1~R3 e2e + AC-Snapshot-ExamId)                                                                                                        | 0.3d  | F     |
|  F2   | `signal-handlers.test.ts` (AC-R4 SIGINT/SIGTERM)                                                                                                                                | 0.15d | C     |
|  F3   | `cost-meter-pipeline-kill.test.ts` (AC-Cost — toCheckpointCostState 7 케이스 + kill switch checkpoint flush)                                                                    | 0.15d | B/D   |
|  F4   | `d1-trigger-verify.test.ts` (AC-R6 + AC-T3 + AC-RP-6 — better-sqlite3 e2e 0015/0016 트리거)                                                                                     | 0.2d  | D     |
|  F5   | `checkpoint.test.ts` 확장 (AC-Snapshot' 13 케이스 9종+circular + diamond DAG false-positive 차단)                                                                               | 0.2d  | —     |
| **G** | typecheck + 138+/138+ PASS 확인                                                                                                                                                 | 0.1d  | F     |
| **H** | Step 11.6 4-Pass 독립 에이전트 재리뷰 (silent-failure / system-architect / quality 3건 병렬) + cap=2 정정                                                                       | 0.5d  | G     |

총 추정: 3.4d (현실 ×1.5 적용 시 5.1d 비관)

### 3.2 권고 진행 순서

```
[Day 1]   A (PipelineContext + toSnapshot)        0.35d
          B (runPipeline 흐름 + fsync)            0.7d
[Day 2]   C (signal-handlers)                    0.15d
          D (D1BatchRunsDb 어댑터)                 0.25d
          E (6 callsite 갱신)                    0.3d
          F1 (pipeline-integration.test.ts)        0.3d
[Day 3]   F2/F3/F4/F5 (통합 + 단위 테스트)         0.7d
          G (typecheck + 회귀)                   0.1d
[Day 4]   H (4-Pass + 정정 cap=2)                0.5d
```

### 3.3 진입 직후 첫 결정 (다음 세션 첫 5분)

다음 세션 시작 시 진산님 검토 필요 항목:

1. **D1BatchRunsDb 의 `void examId;` TODO 주석 정책** — Year 2 진입 시 SQL 갱신 잊을 위험 (silent-failure M-1). 검토:
   - (A) 코드 주석만 추가 (현재 권고)
   - (B) ESLint custom rule 신규 (Year 2 진입 시점 trigger)
   - (C) Year 2 마이그레이션 0005 작업 시 수동 점검 (별도 plan)
2. **Step 11.6 Q1/Q2/Q4 단위 테스트 우선순위** — F3/F4/F5 작업이 e2e 와 병행 진행 가능한지, 또는 e2e 우선 후 흡수 시점 결정.
3. **AC-RP-7 (source_id 결정성) 의 page_ref null 처리** — Step 5 plan v1.1 §"v1.1 명시 이연" 옵션 B (`<no_page>#{node_id}` fallback) 권고가 진산님 검토 의무 X 자율 진행 가능한지.

본 세션 권고: 3개 모두 자율 진행 (메모리 §5.4 자율 영역 정합 — plan/research 작성 + 코드 구현 + 4-Pass 정정).

---

## 4. 핵심 문서 위치 (필수 읽기)

### 4.1 새 세션 진입 직후 1차 읽기 (10분)

1. **본 핸드오프** — `.jjokjipge/handoff-session-015.md`
2. **Step 11.6 plan v1.1** — `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md` (특히 §3.1~§3.3 통합 설계 + §4.4 D1BatchRunsDb 어댑터 + §6 0015 트리거 검증 + §7 AC + §10 호환 보장 6 callsite)
3. **B-C1+B-C2 4-Pass 통합 보고서** — `.claude/reviews/review-20260428-200210-bc1bc2-step5-examid-4pass.md`
4. **ROADMAP v1.2** — `docs/plans/engine-hardening/ROADMAP.md` §0.5.1 v1.2 통합 정정 매트릭스 + §3.1 의존성 그래프 + §3.2 시간 추정 + §8 완료 기준
5. **CLAUDE.md** (프로젝트 룰)

### 4.2 작업 진입 시 읽기

| 작업                             | 필수 읽기                                                                                                             |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| A (PipelineContext + toSnapshot) | `apps/batch/src/pipeline.ts` 전체 + Step 11.6 plan §3.1, §3.2                                                         |
| B (runPipeline 통합)             | `apps/batch/src/pipeline.ts:215-259` + Step 11.6 plan §3.3 + step6 plan §"5가지 recovery status 분기"                 |
| C (signal-handlers)              | Step 11.6 plan §5.3 + Node.js process.on docs (context7 활용)                                                         |
| D (D1BatchRunsDb)                | Step 11.6 plan §4.4 + `migrations/0015_batch_runs.sql` + `migrations/0016_knowledge_nodes_batch_idempotency.sql`      |
| E (6 callsite)                   | `apps/batch/bin/batch.ts:1-200` + `apps/batch/src/__tests__/pipeline.integration.test.ts` 전체                        |
| F4 (d1-trigger-verify)           | `migrations/0015_batch_runs.sql` 전체 + `migrations/0016_*.sql` 전체 + better-sqlite3 docs                            |
| F5 (checkpoint 9종+circular)     | `apps/batch/src/checkpoint.ts:188-272` + `.claude/reviews/midpoint-20260428-p0fix-quality.md` (CRITICAL-Q2 13 케이스) |
| H (4-Pass)                       | `.claude/rules/auto-review-protocol.md` + 본 핸드오프 §2 결과                                                         |

---

## 5. 주의사항 (강제 — 세션 015 학습)

### 5.1 review-gate.sh Stop Hook — 코드 변경 = 의무 발동

본 세션에서 B-C1+B-C2 코드 변경 (3파일) + 마이그레이션 1건 후 자가 4-Pass 시도 차단됨. 회피:

- **3+ 독립 서브에이전트 병렬 호출 의무** (silent-failure / system-architect / quality)
- 통합 보고서 `.claude/reviews/review-YYYYMMDD-HHMMSS-*.md` 형식 (review-gate.sh 인식)
- 파일 상단 "리뷰 방식: 독립 에이전트" 명시

### 5.2 plan §10 "caller 없음" 패턴 — 거짓 진술 차단

본 세션 4-Pass 가 발견한 SA-CRITICAL 의 본질: plan 작성 시점의 가정 ("caller 0건 가정") 이 실재 6 callsite 와 어긋남. 향후:

- 새 plan 작성 시 caller grep 자동 실행 (`grep -rn "runPipeline\|new PipelineContext" apps src`)
- 가정 표현 ("없거나", "최소", "있다면") 사용 시 grep 증거 첨부 의무
- 본 패턴 반복 차단 = handoff 014 §5.2 "Silent Pivot 차단" 정합

### 5.3 후보 B 명시 이연의 누적 패턴

직전 P0 4-Pass 의 quality CRITICAL 4건 + 본 4-Pass quality CRITICAL 5건 = **9 AC 명시 이연**. Step 11.6 코드 진입 시 일괄 흡수 의무. 만약 Step 11.6 4-Pass 에서 또 quality CRITICAL 발생 시 후보 A (엄격) 재검토 의무.

### 5.4 5-페르소나 시간 underestimate 패턴 (handoff-014 §5.5 + 본 세션 검증)

5-페르소나 §3.2 의 "0.5d" 추정이 quality 권고 3.75d (7.5배 차이). 본 세션 직접 정정 0.3d + B-C1+B-C2 1.5d + 4-Pass 0.5d + ROADMAP v1.2 0.2d = **2.5d 분량을 1세션** (약 36분) 으로 압축 — 단 명시 이연 9 AC 가 다음 세션 부담으로 누적. 보정: 5-페르소나 시간 추정 ×1.5~2배 + 후보 B 흡수 비용 +30~50%.

### 5.5 진산님 결정 영역 vs 자율 영역 (handoff-014 §5.4 정합)

**자율 진행 (본 세션 검증):**

- plan v1.x 정정 (Q3, SA-M1, SA-M2, B-C1, B-C2, SA-CRITICAL, SF-M-2, Q-CRITICAL-Q4)
- 마이그레이션 신규 (0016)
- 4-Pass 독립 에이전트 호출 + 통합 보고서
- ROADMAP 패치 (시간 추정 갱신)
- 메모리 등록은 진산님 직접 요청 시 우선

**진산님 결정 영역:**

- 후보 A/B/C 같은 큰 방향 전환
- 새 ADR ACCEPTED
- Anthropic Console cap 활성 (Phase 2 진입 시)
- 일정 / 법무 / 결제 PG / SLM-LoRA / 교재 저작권

---

## 6. 진산님 메모리 (자동 로드)

자동 로드되는 핵심 메모리 — 별도 행동 불필요:

- `project_content_build_engine_as_core.md`
- `project_batch_load_workflow.md`
- `feedback_document_first_workflow.md` ⭐
- `feedback_two_fix_failures_zoom_out.md` (handoff-014 등록)
- `project_anthropic_cap_pre_install.md` (handoff-014 등록 — Phase 2 진입 의무)
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
.jjokjipge/handoff-session-015.md 읽고 이어가줘
```

→ Claude 가 핸드오프 읽고 §3.1 의 우선 A (PipelineContext 확장 + toSnapshot) 자동 진입.

### 옵션 B (특정 작업)

```
.jjokjipge/handoff-session-015.md 읽고 Step 11.6 코드 시작 — 우선 A부터
```

또는

```
.jjokjipge/handoff-session-015.md 읽고 D1BatchRunsDb 어댑터부터
```

### 옵션 C (직접 결정 요청)

```
.jjokjipge/handoff-session-015.md 읽고 §3.3 첫 결정 3건 보고
```

---

## 8. 세션 015 메타 통계

- 시작 시각: 2026-04-29 04:47 KST (state file timestamp 1777373269)
- 종료 시각: 2026-04-29 05:25 KST (핸드오프 작성 완료 시점)
- 누적 시간: 약 38분
- 누적 턴: 약 9
- 영속 문서 산출: 8건 (4-Pass 4 + plan 정정 3 + 마이그레이션 1)
- 코드 변경: 4건 (recover.ts × 2 + checkpoint.ts × 1 + recover.test.ts × 1) + 137/137 tests PASS
- session-health.md 권고 90분/50턴 임계 — 안전 범위
- **5-페르소나 §3.2 추정 0.5d 대비 본 세션 = 약 2.5d 분량 압축 진행** (5배 효율 — 단 명시 이연 9 AC 누적)

---

## 9. 진척도 (백분율) — v1.2 기준

Engine Hardening Roadmap v1.2 기준 (본 세션 후):

| Phase                                     | 산출물                                                                           |  진행   | 비고                   |
| :---------------------------------------- | :------------------------------------------------------------------------------- | :-----: | :--------------------- |
| Phase 0 (마스터 + ADR + 설계)             | ROADMAP v1.2 + ADR 4건 + LLM_CONTAINMENT.md                                      | ✅ 100% | v1.2 패치 흡수         |
| Phase 1 (엔진 contract)                   | research × 3 + contract × 3                                                      | ✅ 100% | —                      |
| Phase 2 (단계별 plan)                     | step1~7 + step6 + step11.6 v1.1 + step5 v1.1 + 0016 마이그레이션                 | ✅ 100% | B-C1 흡수              |
| Phase 3 (코드 구현)                       | Step 12 + Step 17 + R-C1/Q-C1/B-C3/SF-M-2 + B-C2 examId / Step 11.6 + 13~16 잔여 | 🟡 ~38% | Step 11.6 진입 직전    |
| Phase 4 (자동 검증 + 4-Pass + 5-페르소나) | 4-Pass 5건 + 5-페르소나 1건 + 메타 감사 1건                                      | 🟡 ~50% | B-C1+B-C2 4-Pass 추가  |
| Phase 5 (BATCH-1 적재 진입)               | —                                                                                |  ⏳ 0%  | Step 11.6 코드 통과 후 |

**총 진행률 (v1.2 기준 production 검증 weight 보정):** 약 **60~65%**

---

## 10. 본 세션 통합 정정 매트릭스 (요약)

| 출처                              | 결함                               | 정정                                                                                            | 상태 |
| :-------------------------------- | :--------------------------------- | :---------------------------------------------------------------------------------------------- | :--: |
| handoff-014 §2.3 후보 B           | Q3 plan §7 AC-Snapshot 5종         | 9종 + circular + diamond DAG false-positive                                                     |  ✅  |
| handoff-014 §2.3 후보 B           | SA-M1 extractCostState 자유 함수   | meter.toCheckpointCostState() 인스턴스 메서드 + §3.3 호출 5곳                                   |  ✅  |
| handoff-014 §2.3 후보 B           | SA-M2 0015 트리거 idempotency      | DROP TRIGGER IF EXISTS 옛 이름 추가                                                             |  ✅  |
| 5-페르소나 backend C-1            | knowledge_nodes 컬럼 부재          | 0016 마이그레이션 신규 + Step 5 plan v1.1 source_id 정의                                        |  ✅  |
| 5-페르소나 backend C-2            | BatchRunsDb examId 부재            | recover.ts 시그니처 + RecoverOptions.examId + checkpoint.ts exam_id? + Step 11.6 plan §3.1/§4.4 |  ✅  |
| B-C1+B-C2 4-Pass system-architect | Step 11.6 plan §10 거짓 진술       | 6 callsite 표 + 코드 진입 SLO                                                                   |  ✅  |
| B-C1+B-C2 4-Pass silent-failure   | recover.ts examId 일관성 가드 부재 | 14줄 가드 추가 (Q3.5)                                                                           |  ✅  |
| B-C1+B-C2 4-Pass quality          | source_id draft-loader 미반영      | Step 5 plan v1.1 명시 이연 절 신규                                                              |  ✅  |
| ROADMAP 시간 추정 stale           | v1.1 11d → v1.2 +4.3~4.8d          | v1.2 패치 (시간 + 의존성 그래프 + 완료 기준)                                                    |  ✅  |

---

**핸드오프 작성자:** Claude (Opus 4.7)
**다음 세션 시작 권고:** 옵션 A — `.jjokjipge/handoff-session-015.md 읽고 이어가줘`
**첫 작업:** §3.1 우선 A (PipelineContext 확장 + toSnapshot helper)
**예상 세션 분량:** Step 11.6 §A~F 가능 (Day 1~2 분량). Day 3 (테스트) + Day 4 (4-Pass) 는 별도 세션 권고.
