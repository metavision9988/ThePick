---
작성일: 2026-04-29 KST
작성자: Claude (Opus 4.7) — Session 017 진입 직후
선행 문서: handoff-session-016.md / review-20260429-094423-step11-6-pipeline-integration-4pass.md
대상 plan: docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md (v1.1)
판정 의무자: 진산님
---

# Step 11.6 — cap=2 정정 후 결정 영역 보고

## 0. 한 줄 결론

**A0 cap=2 정정 완료** (SF-C-1 + SA-M-2). typecheck PASS + 137/137 회귀 0건. 다음 진입은 **진산님 결정 3건**. 본 보고서 §3 의 권고를 채택 시 본 세션은 §3.1 우선 C~G (9 AC e2e) 로 즉시 진입 가능.

---

## 1. A0 cap=2 정정 결과 (본 세션 §3.1 A0)

| 결함                                                                  | 위치                                          | 정정                                                                                                                                                                                               | 검증                      |
| :-------------------------------------------------------------------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------ |
| **SF-C-1** finally `removeHandlers()` outer catch 부재                | `apps/batch/src/pipeline.ts:537-551`          | `try { removeHandlers(); } catch (err) { console.error('[Pipeline] removeHandlers 실패 (logged only):', err); }` wrap                                                                              | typecheck PASS + 회귀 0건 |
| **SA-M-2** main catch ConcurrentRunError / RecoveryFailedError 미구분 | `apps/batch/bin/batch.ts:23-30, 65-71, 88-95` | `import { ConcurrentRunError, RecoveryFailedError }` + `ExitCode = 0\|1\|2\|4\|5` 확장 + `if (err instanceof ConcurrentRunError) return 4; if (err instanceof RecoveryFailedError) return 5;` 분기 | typecheck PASS + 회귀 0건 |

**검증 명령:**

- `pnpm -C apps/batch typecheck` → 0 errors
- `pnpm -C apps/batch test` → 137/137 PASS (1.39s)

**cap=2 규칙 만족:** 본 세션 정정은 2건. auto-review-protocol.md §"규칙 4" PASS — 다음 4-Pass 재리뷰 시 CRITICAL 격상 시에만 cap 초과 후보 A 재검토.

---

## 2. 진산님 결정 영역 3건 — 다음 진입 차단 게이트

### 결정 1 — SF-C-2 SIGINT handler `markBatchRunKilled` fire-and-forget 도달 불가 [🟡 MED]

**문제:** `process.exit(130)` 가 microtask 를 flush 안 함 → D1 호출 시작도 못 함 → `batch_runs.state='in_progress'` 잔존 → 다음 recover 시도 시 24h stale lock 까지 `concurrent_run_detected` 무한 루프 가능. (4-Pass §5 Devil's Advocate #1 — 🔴 HIGH 격상 위험)

**옵션 비교:**

|   ID    | 정정 패턴                                                                                             | 변경 범위                                                                                    | 장점                                                                  | 단점                                                                                               |
| :-----: | :---------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
|  **A**  | signal handler 안 `await markBatchRunKilled` 후 `process.exit`                                        | `signal-handlers.ts:36-49` async 패턴 변경                                                   | D1 호출 도달 — 이상적 본질                                            | 두 번째 SIGTERM 강제 종료 race + D1 client 단절 위험 — second-order risk **🔴 HIGH**               |
|  **B**  | best-effort 그대로 + stale lock 임계 24h → 1h 단축                                                    | `recover.ts:130` STALE_LOCK_THRESHOLD_MS 정정 + 운영 alarm 설정                              | 시그니처 변경 X + 운영 부담 1h 로 한정                                | "1h" 도 운영자 wait — 근본 해결 아님 + 정상 장기 BATCH 가 stale 로 잘못 분류 가능 (false positive) |
| **C** ★ | best-effort 그대로 + `PipelineResult.metaPersistenceFailures` 필드 추가 + 운영자 강제 unlock CLI 옵션 | `pipeline.ts:79-86` 인터페이스 확장 + 6 callsite 갱신 + `bin/batch.ts` `--force-unlock` 추가 | 가시성 보강 + 운영자 retry 권한 보장 + 본질 보존 (best-effort 그대로) | 인터페이스 변경 — SF-C-3+Q-M-2 와 동일 변경 = **묶음 처리 효율**                                   |

**본 보고서 권고: C** (4-Pass §6 결정 영역 §1 권고 동일)

- 근거 1: A 의 second-order risk 가 4-Pass §5 #1 의 🔴 HIGH 시나리오를 해결 못 할 수도 (SIGTERM 두 번째 도달 시 동일 결과)
- 근거 2: B 의 "1h" stale 임계는 정상 BATCH (예: BATCH-2 가 50분 소요 후 SIGINT) false positive 위험
- 근거 3: C 는 SF-C-3+Q-M-2 의 PipelineResult 확장과 동일 변경 → **단일 commit + 단일 SLO 갱신** 가능 (plan §10)

### 결정 2 — SF-C-3 + Q-M-2 PipelineResult 인터페이스 확장 시점 [🔴 HIGH]

**문제:**

- SF-C-3: `state='failed'` UPDATE 실패 catch 후 `console.error` + 흐름 계속 → 운영 드리프트 silent
- Q-M-2: `already_completed` 시 `qg2Passed=false` → caller exit code 1 false negative

**정정안:**

```typescript
export interface PipelineResult {
  readonly batchId: BatchId;
  readonly stages: readonly StageResult[];
  readonly qg2Passed: boolean;
  readonly qg2Result: QG2Result | null;
  readonly contract: KnowledgeContract | null;
  readonly loadResult: LoadDraftResult | null;
  // === 신규 ===
  /** recover 결정 결과 — caller 가 "이미 완료된 BATCH skip" vs "신규 실행 정상 완료" 구분 가능 */
  readonly recoveryStatus: RecoveryStatus;
  /** batch_runs UPDATE 실패 등 메타테이블 드리프트 가시화 — caller alarm 트리거 */
  readonly metaPersistenceFailures: readonly { stage: PipelineStage; reason: string }[];
}
```

**선택지:**

- **시점 X** — 본 세션 (Day 1) 첫 작업: 0.4d 분량 + 6 callsite 일괄 갱신 + plan §10 SLO 갱신
- **시점 Y** — Step 18 contract verify 까지 이연: 본 plan 종료 후 별도 step

**본 보고서 권고: 시점 X (본 세션 Day 1 첫 작업)**

- 근거 1: 결정 1 옵션 C 채택 시 **동일 인터페이스 변경 = 단일 commit 으로 묶음 처리** (분리 불가)
- 근거 2: handoff-016 §3.1 Day 1 분량에 0.4d 이미 포함 — 작업 누락 시 다음 세션 잔여
- 근거 3: 9 AC e2e 작성 시 (§3.1 C~G) 인터페이스 의존 — 인터페이스 미정 상태로 e2e 작성 시 재작업 위험

### 결정 3 — MINOR 12건 일괄 처리 시점 [🟢 LOW]

**문제:** 4-Pass §3 MAJOR 9건 + MINOR 12건 (중복 제거 시 8+11). 각각 코드 단독 결함.

**선택지:**

- **시점 ⓐ** — 본 plan 종료 (Step 11.6 4-Pass 재리뷰 = §3.1 J) 전 일괄 흡수
- **시점 ⓑ** — Step 18 (Phase 1 정정 묶음) 으로 이연

**본 보고서 권고: 시점 ⓐ (본 plan 끝까지 일괄)**

- 근거 1: §3.1 C~G 9 AC e2e 작성 시 동시 흡수 가능 (작업 분량 1.15d 안 흡수 가능)
- 근거 2: Step 18 진입 전 cleanup → Step 18 contract verify 가 "정합 코드" 만 검증 (오염 차단)

---

## 3. 권고 종합 매트릭스

|       결정       | 권고                                                                  | 처리 시점                       | 작업 분량 |
| :--------------: | :-------------------------------------------------------------------- | :------------------------------ | :-------: |
|    1 (SF-C-2)    | **옵션 C** — metaPersistenceFailures 가시화 + 강제 unlock CLI         | 결정 2 와 묶음                  |   0.1d    |
| 2 (SF-C-3+Q-M-2) | **시점 X** — 본 세션 Day 1 첫 작업 (PipelineResult 확장 + 6 callsite) | A0 직후 → C~G e2e 진입 전       |   0.4d    |
|  3 (MINOR 12건)  | **시점 ⓐ** — 본 plan 끝까지 일괄 (C~G 작성 시 동시 흡수)              | §3.1 C~G 작성 + J 4-Pass 재리뷰 |   포함    |

**총 추가 분량 (결정 채택 시):** 0.5d (Day 1 분량 + handoff-016 §3.1 매트릭스 그대로)

---

## 4. 진산님 답변 형식

옵션:

- **(a) 권고 채택** — "1번 C / 2번 X / 3번 ⓐ" 또는 "고고" → Claude 즉시 PipelineResult 확장 + 6 callsite 갱신 + 9 AC e2e 진입
- **(b) 부분 변경** — 특정 결정만 다른 옵션 채택 (예: "1번 B / 2번 X / 3번 ⓐ")
- **(c) 검토 보류** — Day 1 진입 미루고 추가 검토 필요

권고 (a) 채택 시 본 세션 첫 commit 예고:

- `feat(engine-hardening): Step 11.6 — PipelineResult 확장 (recoveryStatus + metaPersistenceFailures)` 단일 commit
- 변경 파일: `pipeline.ts` (인터페이스 + 6 callsite 중 1) + `batch.ts` (callsite 2) + `pipeline.integration.test.ts` (callsite 5) — 6 callsite 일괄
- 병행: `state='completed'` UPDATE try/catch wrap (SF-M-4 — SF-C-3 와 동일 패턴 재적용)

---

**다음 단계:** 진산님 답변 → 답변 채택 후 본 세션 진입 작업 결정.
