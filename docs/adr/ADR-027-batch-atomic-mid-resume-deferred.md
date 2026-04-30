# ADR-027: Year 1 BATCH = Atomic, Mid-Pipeline Resume = Year 2 이연

- **상태:** Accepted (2026-04-30)
- **결정일:** 2026-04-30
- **결정자:** 진산 ("권고 진행" — handoff-019 §3 결정 4 옵션 A 채택)
- **관련 헌법:** v3.0 Vol VI.3 (Financial Circuit Breaker), Vol XIX (Heartbeat Paralysis Avoidance)
- **관련 ADR:** ADR-014 (Cross-Batch Integrity Validator), ADR-019 (Concurrent Execution Short-Circuit), ADR-007 (Year 2 멀티시험 이연)
- **관련 plan:** Step 11.5 (recover), Step 11.6 (pipeline 통합), Step 5 (reproducibility-idempotency)
- **트리거:** Engine Hardening Roadmap v1.2 Step 11.6 §7 AC-R1 4-Pass quality CRITICAL 1건 — `pipeline.ts:518-540` resume 시 `state.contract` 재주입 0건 → mid-pipeline resume 진입 시 Stage 6 (integrity_check) 즉시 throw

---

## 1. Context (맥락)

### 1.1 Step 11.5 / 11.6 plan 본문 가정

Step 11.5 `recover.ts` + Step 11.6 `pipeline.ts` 통합 plan 은 다음 분기를 의도했다:

- `recoverBatch` 가 5개 status 반환: `fully_recovered` / `partially_recovered` / `already_completed` / `concurrent_run_detected` / `recovery_failed` / `no_checkpoint`
- `fully_recovered` / `partially_recovered` 진입 시 → `runPipeline` 이 `resumed_from_stage` 다음 stage 부터 재개 (mid-pipeline resume)
- AC-R1 e2e 본문 (`step11-6 plan §7 line 845-858`, v1.1 원본): "Stage 5 (`db_load`) 종료 후 SIGTERM → 재호출 → Stage 6~10 재실행 후 `state='completed'`"

### 1.2 본 세션 4-Pass quality CRITICAL 1건 (cap=2 후 잔존)

`.claude/reviews/review-20260429-221027-step11-6-9ac-e2e-4pass.md`

- `apps/batch/src/__tests__/pipeline.integration.test.ts:540` — `last_completed_stage='qg2_gate'` (= 마지막 stage, index 9) 사용
- resume index = 9 + 1 = 10 → 모든 stage `i < 10` true → "Resumed from later stage" skip
- `state.contract` 재주입 0건 → mid-resume 의 본질 미검증 → AC-R1 plan 의도 ("Stage 6~10 재실행") 와 본 e2e 의 검증 (전체 skip degenerate) 사이 silent pivot

### 1.3 코드 구현의 실제 한계

`apps/batch/src/pipeline.ts:518-540` resume 분기:

- stage 0~N-1 skip (runStage 호출 0건)
- `state.contract` 는 `stagePdfExtract` 진입 시점에 설정됨 — resume 시 미설정
- Stage 6 (`integrity_check`, `pipeline.ts:937`) — `if (!state.contract) throw new Error('Integrity check requires contract')` 강제 throw

→ **현재 구현은 mid-pipeline resume 가 동작 안 함** (Stage 6 즉시 fail). 본 4-Pass 가 quality CRITICAL 로 올바르게 지적.

### 1.4 옵션 평가 (handoff-019 §3.2)

|    옵션    |  비용  |     BATCH-1 진입     |      mid-resume       |    plan-구현 정합    |
| :--------: | :----: | :------------------: | :-------------------: | :------------------: |
| **A 권고** |  0.1d  |         즉시         | 미지원 (atomic BATCH) |    ✅ 본 ADR 명시    |
|     B      | 1.5~2d |     1.5~2d 지연      |         지원          | ✅ plan 의도 그대로  |
|     C      |   0d   | 즉시 (CRITICAL 잔존) |        미구현         | ❌ Silent Pivot 잔존 |

**진산님 결정 (2026-04-30):** 옵션 A 채택.

---

## 2. Decision (결정)

### 2.1 핵심

**Year 1 동안 BATCH 1회 실행은 atomic 단위로 정의한다. 어떤 stage 에서 SIGTERM/SIGINT 가 발생하더라도 재실행은 처음부터 진행한다. 중복 INSERT 차단은 Step 5 의 `source_id UNIQUE` 제약으로 멱등성을 보장한다. mid-pipeline state 재구성 (resume 시 `state.contract` / `state.graphNodes` 복원 후 특정 stage 부터 재개) 은 Year 2 Step 11.7 도입 후보로 명시 이연한다.**

### 2.2 atomic BATCH 운영 규칙 (Year 1)

| 시나리오                                 | 재실행 동작                                                                          | 멱등성 보장 메커니즘                                                           |
| :--------------------------------------- | :----------------------------------------------------------------------------------- | :----------------------------------------------------------------------------- |
| **마지막 stage (qg2_gate) 완료 후 kill** | `recoverBatch` → `already_completed` skip                                            | `batch_runs.state='completed'` 검사                                            |
| **mid-pipeline kill (Stage 1~9)**        | `recoverBatch` → `recovery_failed` 또는 `no_checkpoint` 처리 후 처음부터 fresh start | Step 5 `source_id UNIQUE` partial index — `WHERE state='active' AND exam_id=?` |
| **동시 실행 시도**                       | `recoverBatch` → `concurrent_run_detected` block                                     | `state='in_progress'` 검사 + 0019 트리거                                       |
| **checkpoint 변조**                      | `recoverBatch` → `recovery_failed` reject                                            | `state_hash` SHA-256 검증                                                      |

### 2.3 Year 1 활성 분기 vs 보존 분기

**Year 1 활성 (Step 11.6 본 plan):**

- `already_completed` (skip)
- `concurrent_run_detected` (block)
- `recovery_failed` (reject + 사용자 명시 우회 의무)
- `no_checkpoint` (fresh start)

**Year 2 보존 (Step 11.7 후보):**

- `fully_recovered` / `partially_recovered` 분기 + `pipeline.ts:518-540` resume 로직
- `recover.ts` 의 `RecoveryResult.resumed_from_stage` 필드
- `step11-6 plan §3 의사코드 / §4 상태 머신 표 / §6 분기 표 / line 481-483`
- `checkpoint.ts` 의 `PipelineStateSnapshot` 직렬화 (current scope: `state.metadata` + `state.timing` + `state.cost` 등)
- canonicalJson `assertCanonicalSafe` ancestor-only 추적 인프라 (본 plan §7 AC-Snapshot 4 시나리오 검증 완료)

→ Year 1 코드 변경 0건 (보존 분기는 dead code 아님 — Year 2 활성화 대기).

### 2.4 Step 5 멱등성 의존성 (선결 조건)

- Step 5 `reproducibility-idempotency.plan.md` 의 partial UNIQUE index 의무 (`source_id` × `exam_id` × `state='active'`) 가 본 ADR 의 atomic 정책의 멱등성 보장 핵심.
- BATCH 마지막 stage 미완료 상태에서 처음부터 재실행 시: 같은 `source_id` 로 두 번째 INSERT 시도 → UNIQUE 위배 throw → 운영자 인지 → `temporal_state='superseded'` 로 이전 active 노드 ToString 후 재INSERT (Step 5 §"멱등 재실행 절차").
- 본 ADR ACCEPTED 시점 Step 5 plan v1.1 의 partial UNIQUE 명시는 이미 존재. 본 ADR 은 그 의존성을 명문화.

### 2.5 mid-pipeline resume Year 2 도입 트리거

다음 중 1건 이상 발생 시 Year 2 Step 11.7 plan 을 작성한다:

1. BATCH 평균 실행 시간이 90분 초과 → 50% kill 시 처음부터 재실행 비용이 운영자 인내 임계 (60분) 초과
2. BATCH-Q (혹은 그 이후) 적재 시 고비용 stage (예: Vectorize 임베딩 호출 누적 $50+) 가 mid-pipeline 에 위치 → 처음부터 재실행 시 비용 손실 unacceptable
3. Year 2 멀티시험 진입 시 BATCH × N 시험 동시 실행 — atomic 단위가 너무 큰 경우
4. 진산님 명시 트리거 (운영 경험 누적 후)

---

## 3. Consequences (결과)

### 긍정적

- **plan-구현 정합 회복** — 본 4-Pass quality CRITICAL 1건 즉시 해소 (Year 1 정책 명문화로 silent pivot 차단)
- **BATCH-1 적재 즉시 진입 가능** — Step 11.6 차단 게이트 통과 (1.5~2d 지연 회피)
- **canonicalJson + checkpoint 인프라 보존** — Step 11.5 산출 + 본 plan §7 AC-Snapshot 4 시나리오 검증 완료된 인프라가 Year 2 재활용 가능 (sunk cost 0)
- **운영 단순화** — recover 분기 4건만 의미 (already_completed / concurrent_run_detected / recovery_failed / no_checkpoint)
- **메모리 정합** — `feedback_focus_reliability_not_schedule.md` (안정성·신뢰성·항상성 우선) + `feedback_no_granular_decisions.md` (전략 갈림길 vs 지엽 결정) 양쪽 정합

### 부정적 / 트레이드오프

- 30분 BATCH × 50% kill (Stage 5 시점) 시 처음부터 재실행 비용 = 30분 추가. **운영 acceptable** (BATCH-1 적재 ~30분 가정, BATCH-Q 까지 누적 운영 부담 < 진산님 인내 임계)
- Year 2 멀티시험 진입 시 BATCH 동시 실행 N 개 → atomic 단위 재고 필요 (트리거 §2.5)
- `recover.ts` 의 보존 분기 (fully_recovered / partially_recovered) 가 Year 1 활성 코드 0건 — typecheck 통과 보장 의무 (본 ADR ACCEPTED 후 회귀 테스트 1회 의무)

### 즉시 발생하는 작업 (본 commit 묶음)

- **Step 11.6 plan §7 AC-R1 본문 정정** (`docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md:845-858`) — 본 ADR reference 추가
- **방법론 v1.2 정정** (`docs/방법론적용-ThePick-v1.0.md`) — handoff-019 §3 결정 영속화
- **typecheck + 회귀** — 195/195 PASS 유지 검증

### 후속 작업 (다음 step)

- Step 5 `reproducibility-idempotency.plan.md` 본 ADR §2.4 reference 추가 (Step 5 plan 진입 시점)
- ROADMAP v1.2 의 Step 11.7 plan 명시 후보 (Year 2 Phase 4 배치)

---

## 4. Alternatives Considered (대안)

| 대안                                      | 장점                                      | 단점                                                                                         | 미선택 이유                                               |
| :---------------------------------------- | :---------------------------------------- | :------------------------------------------------------------------------------------------- | :-------------------------------------------------------- |
| **옵션 A — atomic BATCH (본 ADR)**        | BATCH-1 즉시 진입, 운영 단순, 인프라 보존 | mid-resume 미지원                                                                            | **선택** (진산님 권고 채택)                               |
| 옵션 B — Step 11.7 신설 (mid-resume 구현) | plan 의도 충실, 50% kill 비용 절감        | 1.5~2d BATCH-1 지연, checkpoint payload 증가 (~20KB), 외부 객체 직렬화 안전성 검증 부담 증가 | Year 1 ROI 음수 (BATCH-1 ~30분, 50% kill 비용 acceptable) |
| 옵션 C — 명시 이연 (CRITICAL 잔존)        | 0d 비용                                   | quality CRITICAL 1건 잔존 = "완료" 선언 불가, plan-구현 silent pivot                         | CRITICAL RULE #4 위반                                     |

---

## 5. Migration / Backward Compatibility

- 본 ADR ACCEPTED 시점 — **코드 변경 0건**
- `apps/batch/src/recover.ts` / `apps/batch/src/pipeline.ts` / `apps/batch/src/checkpoint.ts` 모두 그대로 유지 (보존 분기 dead code 아님)
- `apps/batch/src/__tests__/pipeline.integration.test.ts:540` 의 AC-R1 e2e (`last_completed_stage='qg2_gate'`) 는 본 ADR 정책 (already_completed skip 검증) 정합으로 유지
- Step 5 plan v1.1 partial UNIQUE 명시는 이미 존재 — 본 ADR 의존성 만족

---

## 6. SLO Impact

| SLO                           | Before (옵션 B 가정)                               | After (본 ADR atomic)                 |
| :---------------------------- | :------------------------------------------------- | :------------------------------------ |
| BATCH 50% kill 시 재실행 비용 | ~15분 (mid-resume)                                 | ~30분 (처음부터)                      |
| recover 분기 의미 수          | 6건 (full/partial/already/concurrent/no_cp/failed) | 4건 (already/concurrent/no_cp/failed) |
| checkpoint payload 크기       | ~20KB+ (state 직렬화 포함)                         | 현재 그대로 (~2KB metadata only)      |
| BATCH-1 적재 진입 시점        | D+2 (Step 11.7 후)                                 | **D+0 즉시**                          |

---

## 7. Human Decision Required

- [x] Approved (진산 2026-04-30 — handoff-019 §3 결정 4 옵션 A "권고 진행" 채택)
- [ ] Rejected
- [ ] Modified

**Reviewer:** 진산
**Date:** 2026-04-30

---

## 8. 부록 — Year 2 Step 11.7 도입 트리거 (재명시)

본 ADR §2.5 의 4 트리거 중 1건 이상 발생 시 Year 2 Step 11.7 plan 작성 의무 발생. 작성 시 본 ADR 의 결정 컨텍스트 (Year 1 atomic 정책 채택 사유) 를 보존하여 트리거 조건이 실제 충족되었는지 검증.

Step 11.7 plan 작성 시 재활용 인프라:

- `recover.ts` 의 `RecoveryResult.resumed_from_stage` 필드 (이미 존재)
- `pipeline.ts:518-540` 의 fully_recovered / partially_recovered 분기 (이미 존재)
- `checkpoint.ts` 의 `PipelineStateSnapshot` 인터페이스 + `PipelineState` 직렬화 가능 부분 확장
- canonicalJson `assertCanonicalSafe` ancestor-only 추적 (본 plan §7 AC-Snapshot 4 시나리오 검증 완료)
- `step11-6 plan §3 / §4 / §6` 의 의사코드 + 상태 머신 표 + 분기 표

→ 본 ADR 의 "보존" 정책 덕분에 Year 2 진입 시 추가 인프라 비용 0d (state 재구성 로직 + e2e 만 신규 작성).
