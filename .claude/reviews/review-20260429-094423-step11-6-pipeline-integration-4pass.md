---
리뷰 방식: 독립 에이전트 (silent-failure-hunter + system-architect + quality-engineer 3개 병렬)
리뷰 일시: 2026-04-29 09:44 KST
리뷰 대상: Step 11.6 (BATCH 파이프라인 recover/checkpoint/CostMeter 통합) 코드 구현 — 본 세션 변경 9건
리뷰자 컨텍스트: 메인 대화 모름 (의도 편향 차단 — 각 페르소나 독립 판정)
plan 근거: docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md v1.1
---

# Step 11.6 코드 구현 — 4-Pass 통합 보고서

## 0. 한 줄 결론

**3 페르소나 모두 `accept_with_caveats` 판정.** CRITICAL 3건 (silent-failure 영역) — 본 세션 정정 vs 명시 이연 결정 의무. system-architect / quality 는 CRITICAL 0건 (양쪽 모두 PASS).

---

## 1. 리뷰 방식

| 페르소나              | 관점                                                              | CRITICAL | MAJOR | MINOR | 판정                |
| :-------------------- | :---------------------------------------------------------------- | :------: | :---: | :---: | :------------------ |
| silent-failure-hunter | 무음 실패 / catch 후 silent drop / fire-and-forget                |  **3**   |   4   |   3   | accept_with_caveats |
| system-architect      | 인터페이스 호환성 / 0015 트리거 정합 / Hard Rule 16/17 / SLO 만족 |    0     |   2   |   4   | accept_with_caveats |
| quality-engineer      | toSnapshot 정확성 / boundary value / mock 격리 / e2e 커버리지     |    0     |   3   |   5   | accept_with_caveats |

3개 보고서 모두 `.claude/reviews/review-20260429-094423-step11-6-pipeline-integration-{persona}.md` 저장. 통합 본 보고서가 review-gate.sh 인식 형식.

---

## 2. CRITICAL 3건 — 모두 silent-failure 영역

### SF-CRITICAL-1 — `runPipeline.finally` removeHandlers throw 시 outer catch 부재

**위치:** `apps/batch/src/pipeline.ts:547-556`
**증거:**

```typescript
} finally {
  removeHandlers();                                    // ← throw 가능, try/catch 없음
  if (ctx.costMeter) {
    try {
      ctx.costMeter.finalize();
    } catch (err) {
      console.error('[Pipeline] CostMeter finalize 실패 (logged only):', err);
    }
  }
}
```

`costMeter.finalize()` 만 try/catch 보호. `removeHandlers()` 가 throw 시 finally 자체가 throw → outer catch 없음 → unhandled rejection. 일관성 부재 + costMeter.finalize 도 호출 안 됨.

**영향:** SIGINT handler cleanup 실패 시 stale handler 누적 + meter resource leak.

**정정 난이도:** 🟢 LOW (try/catch wrap 5줄)

---

### SF-CRITICAL-2 — SIGINT handler `markBatchRunKilled().catch(...)` fire-and-forget 가 process.exit 직전이라 D1 호출 도달 불가

**위치:** `apps/batch/src/pipeline.ts:434-447` + `apps/batch/src/signal-handlers.ts:36-49`
**증거:**

```typescript
// pipeline.ts:434-447 (handler 콜백 안)
markBatchRunKilled(ctx.examId, ctx.batchRunId, ctx.batchRunsDb).catch((err) => {
  console.error('[Pipeline] markBatchRunKilled failed (best-effort):', err);
});

// signal-handlers.ts:36-49 (handler 직후 process.exit)
opts.flushCheckpoint(); // sync return
process.exit(signal === 'SIGINT' ? 130 : 143); // ← microtask flush 안 함
```

`process.exit` 는 pending microtasks/promises 를 flush 하지 않고 즉시 종료. 따라서 `markBatchRunKilled` 의 D1 호출이 시작도 못 함. catch 핸들러도 실행 안 됨 → `console.error` silent.

**영향:** SIGINT 후 batch_runs.state='in_progress' 잔존 → 24h stale lock 까지 다음 recover 시도 시 `concurrent_run_detected` → 무한 루프 가능 (system-architect MINOR m4 지적과 일치).

**정정 난이도:** 🟡 MEDIUM (signal handler async 패턴 — handler 안에서 `await markBatchRunKilled`. 단, D1 client 가 process exit 직전 단절 위험 + 두 번째 SIGTERM 받으면 즉시 강제 종료. 실효성 의문 — best-effort 본질).

---

### SF-CRITICAL-3 — `state='failed'` UPDATE 실패 catch 가 console.error 후 흐름 계속

**위치:** `apps/batch/src/pipeline.ts:497-512`
**증거:**

```typescript
if (result.status === 'failed') {
  aborted = true;
  try {
    await ctx.batchRunsDb.updateState(ctx.examId, ctx.batchRunId, {
      state: 'failed',
      last_completed_stage: stage,
    });
  } catch (err) {
    console.error(`[Pipeline] batch_runs UPDATE state=failed 실패 (stage=${stage}):`, err);
  }
  continue;
}
```

D1 단절 / 트리거 RAISE(ABORT) 시 batch_runs 'in_progress' 잔존하나 PipelineResult 는 정상 반환 (`stages[i].status='failed'` 만 표시). 운영자에게 메타테이블 드리프트 silent.

**영향:** 운영자 대시보드는 PipelineResult 만 보면 정상. 실 batch_runs.state 와 불일치. quality-engineer MAJOR M-2 지적의 일부 (`PipelineResult.recovery_status` / 메타 드리프트 가시성).

**정정 난이도:** 🔴 HIGH (PipelineResult 인터페이스 변경 → 6 callsite 영향 — plan §10 SLO 추가 갱신 + handoff-session-015 §10 정정 매트릭스 갱신).

---

## 3. MAJOR 9건 통합 정리

### silent-failure-hunter MAJOR (4건)

|   ID   | 위치                    | 요약                                                                                                          | 정정 권고                               |
| :----: | :---------------------- | :------------------------------------------------------------------------------------------------------------ | :-------------------------------------- |
| SF-M-1 | `pipeline.ts:762-766`   | `result.usage` null skip console.warn — 향후 캐시 hit / 0-token 응답 시 비용 silent 누락                      | 다음 세션 (AC-Cost 작성 시)             |
| SF-M-2 | `pipeline.ts:531-536`   | recover.ts:283 `state='recovered'` 직후 첫 stage success 가 'in_progress' 로 덮어씀 → 운영 가시성 silent loss | 다음 세션                               |
| SF-M-3 | `checkpoint.ts:390-419` | `writeCheckpointSync` fsync=false production guard 부재 → power loss 0바이트 silent collapse                  | 본 세션 또는 다음 세션 (plan §5.2 의도) |
| SF-M-4 | `pipeline.ts:541-545`   | `state='completed'` UPDATE try/catch 없음 → SF-CRITICAL-3 와 일관성 부재                                      | SF-CRITICAL-3 와 함께 정정              |

### system-architect MAJOR (2건)

|   ID   | 위치                            | 요약                                                               | 정정 권고                    |
| :----: | :------------------------------ | :----------------------------------------------------------------- | :--------------------------- |
| SA-M-1 | `cost-meter.ts` (스코프 외)     | model ID 정규화 책임 모호                                          | 명시 이연 — Step 1 plan 영역 |
| SA-M-2 | `bin/batch.ts:65-70` main catch | ConcurrentRunError / RecoveryFailedError 미구분 → exit code 일괄 1 | 본 세션 (5분 작업)           |

### quality-engineer MAJOR (3건)

|  ID   | 위치                         | 요약                                                                                                               | 정정 권고                                         |
| :---: | :--------------------------- | :----------------------------------------------------------------------------------------------------------------- | :------------------------------------------------ |
| Q-M-1 | `pipeline.ts:411-447, 528`   | async writeCheckpoint vs sync writeCheckpointSync `.tmp` race → 데이터 손상 X (atomic rename) but 잔존 가능        | 다음 세션 (M-1 cleanup hook)                      |
| Q-M-2 | `pipeline.ts:79-86, 558-566` | `PipelineResult.recovery_status` 누락 → already_completed 시 `qg2Passed=false` → caller exit code 1 false negative | **본 세션 또는 다음 세션 결정** (인터페이스 변경) |
| Q-M-3 | `pipeline.ts:750-767`        | `result.usage` null skip dead code (현 batch-processor 흐름상 도달 불가) → 인터페이스 변경 시 silent budget breach | 다음 세션                                         |

**중복 지적:** SF-M-1 ↔ Q-M-3 (result.usage null skip) — 동일 결함, 다른 angle.

---

## 4. ✅ 확인 항목 통합 (전수 PASS — 18건)

3 페르소나 합산 18건 ✅ 확인. 핵심:

- `assertCanonicalSafe` 9종 silent collapse 차단 + circular reference 차단 (silent-failure)
- `recover.ts` 4종 catch 분기 모두 명시 라벨 + reason 보존 (silent-failure)
- exam_id 일관성 검증 (B-C2 SF-M-2 정정 정합 반영) (silent-failure)
- 6 callsite 일괄 갱신 SLO 만족 (typecheck 0 errors) (system-architect)
- 0015 트리거 3종 InMemory invariant 1:1 매핑 (system-architect)
- D1 INSERT 8 컬럼 스키마 정합 (system-architect)
- BatchRunsDb.insertNewRun? optional → 8 mock 회귀 0건 (system-architect)
- Hard Rule 16/17 PASS (`'son-hae-pyeong-ga-sa'` 리터럴 0건 — batch.ts EXAM_IDS 경유) (system-architect)
- examId 일관성 7 hop 전파 검증 (system-architect)
- toSnapshot lastInsertedNodeId Step 5 deferred fallback 동작 (system-architect + quality)
- typecheck PASS + 137/137 기존 tests PASS (회귀 0건) (quality)
- plan v1.1 §3.3 흐름 충실 반영 (quality)
- Q-C1 false positive 정정 (Object.fromEntries 매 entry 새 object literal) (quality)
- CRITICAL RULE #2/#3/#5 모두 정합 (quality)

---

## 5. Devil's Advocate 종합 (10 시나리오)

3 페르소나 합산 10 시나리오. CRITICAL 격상 가능성 평가:

|  #  | 시나리오                                                   | 출처       | 격상 위험 | 다음 세션 처리                 |
| :-: | :--------------------------------------------------------- | :--------- | :-------: | :----------------------------- |
|  1  | SIGINT 직후 재시도 → 24h concurrent_run_detected 무한 루프 | SF + SA-m4 |  🔴 HIGH  | SF-CRITICAL-2 정정 시 e2e 검증 |
|  2  | 0016 backfill 진행 중 race                                 | SA         |  🟡 MED   | Step 5 plan v1.1 책임          |
|  3  | outDir 혼재 (checkpointBaseDir == outDir)                  | SA         |  🟢 LOW   | 운영 plan                      |
|  4  | RAISE(ABORT) driver throw 형태 결정                        | SA         |  🟡 MED   | AC-R6 e2e                      |
|  5  | recover UPDATE 후 handler 등록 전 SIGTERM                  | Q          |  🟢 LOW   | 명시 이연                      |
|  6  | async writeCheckpoint vs sync handler race                 | Q          |  🟢 LOW   | atomic rename 보장             |
|  7  | InMemoryBatchRunsDb stale 24h 시뮬레이션 부재              | Q          |  🟡 MED   | AC-T3 e2e 시 clock injection   |
|  8  | recordTokens(0, 0) silent zero accumulation                | Q          |  🟢 LOW   | AC-Cost golden                 |
|  9  | stage failed 후 batch_runs UPDATE 트리거 충돌              | Q          |  🟢 LOW   | catch 가시화                   |
| 10  | engineVersion path dist 빌드 깨짐                          | SA-m1      |  🟢 LOW   | Step 14 회귀                   |

**🔴 HIGH 1건 (#1)** — SF-CRITICAL-2 정정과 직접 연결. SIGINT 시 markBatchRunKilled 가 도달 못 하면 다음 recover 시도 시 24h 동안 차단 → 진산님 운영 부담 직결.

---

## 6. 정정 vs 명시 이연 매트릭스 — 진산님 결정 의무

### 본 세션 정정 권고 (cap=2 정정 규칙 — 최대 2건)

|        ID         |       난이도       | 영향           | 권고                           |
| :---------------: | :----------------: | :------------- | :----------------------------- |
| **SF-CRITICAL-1** |    🟢 LOW (5줄)    | finally 일관성 | **본 세션 즉시 정정**          |
|    **SA-M-2**     | 🟢 LOW (분기 추가) | exit code 명시 | **본 세션 즉시 정정** (CLI UX) |

cap=2 정정 규칙은 본 plan §9.3 명시. 본 세션은 시간 부담 있으나 위 2건은 5~10분 분량.

### 다음 세션 (Day 3 e2e + 정정) 이연

|           ID           | 정정 시 인터페이스 영향                          | 정정 시기                                                  |
| :--------------------: | :----------------------------------------------- | :--------------------------------------------------------- |
|     SF-CRITICAL-2      | signal handler async 패턴 변경                   | AC-R4 e2e 작성 시                                          |
|     SF-CRITICAL-3      | PipelineResult 인터페이스 변경 → 6 callsite 영향 | Q-M-2 와 함께 PipelineResult 확장 (다음 세션 시작 첫 결정) |
| SF-M-1, SF-M-2, SF-M-3 | 코드 단독 — 인터페이스 X                         | 9 AC e2e 작성 시 동시                                      |
|         SF-M-4         | SF-CRITICAL-3 와 함께                            | 동시                                                       |
|      Q-M-1, Q-M-3      | 코드 단독                                        | 다음 세션                                                  |
|         SA-M-1         | 다른 plan 영역 (cost-meter Step 1)               | 별도 plan                                                  |

### 진산님 결정 영역 (메모리 §5.5 정합)

다음 항목은 진산님 결정 필요 (큰 방향 전환 가능성):

1. **SF-CRITICAL-3 + Q-M-2 정정 (PipelineResult 인터페이스 확장)** — 본 세션 정정 vs 다음 세션 이연. 인터페이스 변경 → 6 callsite 갱신 의무 추가 → plan §10 SLO 추가 정정.
2. **SF-CRITICAL-2 정정 시점** — 본 세션 시도 vs 다음 세션 AC-R4 e2e 작성 시. signal handler async 패턴은 unhandled SIGTERM 두 번째 race 등 second-order risk 존재 — 본 세션 정정 시도 X 권고.
3. **MINOR 12건 일괄 처리 시점** — 모두 다음 세션 권고.

---

## 7. 명시 이연 9 AC (handoff-session-015 §2.3)

본 4-Pass 는 **코드 구현** 완성도만 평가. 9 AC e2e 미작성은 사전 약속대로 CRITICAL 분류 X (3 페르소나 모두 명시 처리).

다음 세션 (Day 3) 작성 의무:

- AC-Cost (toCheckpointCostState 7 케이스)
- AC-Snapshot' (canonicalJson 9종+circular 13 케이스)
- AC-T3 (batch_runs state transition matrix 5×7 + race window — InMemoryBatchRunsDb clock injection 의무)
- AC-R1~R6 (mock → production e2e 격상)
- AC-ExamId (BatchRunsDb examId 시그니처 + SF-M-2 가드)
- AC-RP-6 (0016 마이그레이션 + 0014 화이트리스트 e2e)
- AC-RP-7 (source_id 결정성 100회 반복)
- AC-Snapshot-ExamId (exam_id 직렬화 + state_hash 영향)

본 4-Pass MAJOR 9건 + MINOR 12건 중 인터페이스 영향 있는 SF-CRITICAL-3 / Q-M-2 는 다음 세션 첫 결정으로 일괄 처리 권고.

---

## 8. 통합 판정

**판정:** `accept_with_caveats`

**조건:**

1. 본 세션 즉시 정정 — SF-CRITICAL-1 + SA-M-2 (cap=2 만족)
2. 다음 세션 이연 — SF-CRITICAL-2 / SF-CRITICAL-3 / Q-M-2 + MAJOR 7건 + MINOR 12건 (정정 매트릭스 §6 명시)
3. 진산님 결정 — §6 결정 영역 3건

**검증 결과 (객관 사실):**

- typecheck PASS (`pnpm -C apps/batch typecheck`)
- 137/137 기존 tests PASS (회귀 0건, 1.36s)
- plan §10 SLO 만족 (6 callsite 일괄 갱신)
- Hard Rule 16/17 PASS

**다음 세션 차단 게이트:**

- SF-CRITICAL-2 / SF-CRITICAL-3 정정 e2e 검증 (AC-R4 / AC-R5)
- M-2 PipelineResult 인터페이스 변경 + caller 일괄 갱신
- AC-T3 e2e + InMemoryBatchRunsDb clock injection
- AC-Cost CostMeter(0,0) golden + recordTokens null skip 검증

---

## 9. 진산님 보고 요약

본 세션 코드 구현 검증:

- ✅ typecheck PASS + 137/137 회귀 0건
- ✅ system-architect / quality-engineer CRITICAL 0건
- ⚠️ silent-failure-hunter CRITICAL 3건 (모두 fault-tolerance 영역 — process.exit / D1 단절 / signal race)

진산님 결정 의무 3건:

1. SF-CRITICAL-1 + SA-M-2 본 세션 즉시 정정 vs 다음 세션 이연 (권고: **본 세션 정정** — 5~10분)
2. SF-CRITICAL-3 + Q-M-2 PipelineResult 인터페이스 변경 시점 (권고: **다음 세션 첫 결정** — 6 callsite 영향)
3. SF-CRITICAL-2 signal handler async 패턴 시도 시점 (권고: **다음 세션 AC-R4 e2e 시** — second-order risk)

cap=2 정정 시 본 세션 합격. cap 초과 시 명시 이연 매트릭스 §6 적용.

---

**보고서 작성자:** Claude (Opus 4.7) — 메인 컨텍스트
**근거:** 3 독립 에이전트 보고서 통합 (silent-failure / system-architect / quality)
**다음 작업:** 진산님 결정 → cap=2 정정 → 핸드오프 session-016 작성 → BATCH-1 적재 진입 (Step 11.6 완료 후)
