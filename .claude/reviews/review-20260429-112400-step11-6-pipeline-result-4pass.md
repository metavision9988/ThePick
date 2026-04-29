---
리뷰 방식: 독립 에이전트 (silent-failure-hunter + system-architect + quality-engineer 3개 병렬)
리뷰 일시: 2026-04-29 11:24 KST
리뷰 대상: Step 11.6 B1 — PipelineResult 인터페이스 확장 (recoveryStatus + metaPersistenceFailures), Session 017
리뷰자 컨텍스트: 메인 대화 모름 (의도 편향 차단 — 각 페르소나 독립 판정)
plan 근거: docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md v1.1 §10 SLO
선행 보고서: review-20260429-094423-step11-6-pipeline-integration-4pass.md / review-20260429-104757-step11-6-cap2-4pass.md
선행 결정: .claude/reports/decision-20260429-step11-6-after-cap2.md (권고 1C/2X/3ⓐ 채택)
---

# Step 11.6 B1 PipelineResult 확장 — 4-Pass 통합 보고서

## 0. 한 줄 결론

**3 페르소나 모두 CRITICAL 0건 — B1 정정 PASS.** MAJOR 5건 중 **3건은 본 commit 에 묶음 흡수** (SA-Mn-1 index.ts re-export / SA-Mn-2 ReturnedRecoveryStatus narrowing / SF-Mn-DA-1 finally push 일관성), 나머지 2건은 SF-CRITICAL-2 / Q-M-B1-1 본질 — 이미 다음 세션 §3.1 C~G 흡수 명시.

---

## 1. 리뷰 방식

| 페르소나              | 관점                                                                   | CRITICAL | MAJOR | MINOR | 판정                                   |
| :-------------------- | :--------------------------------------------------------------------- | :------: | :---: | :---: | :------------------------------------- |
| silent-failure-hunter | 무음 실패 / catch 후 silent drop / closure capture 본질                |    0     |   2   |   4   | 완료 가능                              |
| system-architect      | 인터페이스 호환성 / 6 callsite SLO / 타입 설계 / Hard Rule / 운영자 UX |    0     |   2   |   2   | 완료 가능 (조건부)                     |
| quality-engineer      | 137 회귀 객관 + 효과 검증 e2e 갭 + InMemoryBatchRunsDb 정합            |    0     |   1   |   3   | 완료 가능 (조건부)                     |
| **통합**              | **CRITICAL 0** / **MAJOR 5** (중복 0) / **MINOR 9** (중복 일부)        |  **0**   | **5** | **9** | **PASS — 본 commit 묶음 흡수 후 완료** |

3 보고서 산출물:

- `.claude/reviews/review-20260429-112400-step11-6-pipeline-result-silent-failure.md`
- `.claude/reviews/review-20260429-112400-step11-6-pipeline-result-system-architect.md`
- `.claude/reviews/review-20260429-112400-step11-6-pipeline-result-quality.md`

본 통합 보고서가 review-gate.sh 인식 형식.

---

## 2. CRITICAL — **0건**

### B1 PipelineResult 확장의 silent failure / 호환성 / 회귀 영향 PASS

3 페르소나 모두 CRITICAL 0건 — B1 정정은:

- SF-C-3 / SF-M-4 / SF-C-2 옵션 C 모두 **silent drop → 가시화** 전환 완료 (silent-failure)
- 6 callsite 일괄 갱신 PASS — plan §10 SLO 객관 만족 (system-architect)
- 137/137 회귀 0건 + typecheck PASS — production-quality.md 정합 (quality)
- CRITICAL RULE #2/#3 정합 (빈 함수/빈 catch 0건)

---

## 3. MAJOR 5건 — 본 commit 흡수 vs 명시 이연 분류

### 본 commit 에 묶음 흡수 (3건)

#### **SA-MAJOR-1 — `apps/batch/src/index.ts:14-22` MetaPersistenceFailure/RecoveryStatus re-export 누락**

**위치:** `apps/batch/src/index.ts`
**결함:** PipelineResult 는 export 되지만 그 멤버 타입 (`MetaPersistenceFailure`, `RecoveryStatus`) 이 외부에서 명시 import 불가. plan §10 SLO 정신 ("부분 commit 금지") 측면에서 본 B1 commit 에 동시 포함 의무.
**난이도:** 🟢 LOW (5초 — re-export 2줄 추가)
**처리:** **본 세션 즉시 정정**

#### **SA-MAJOR-2 — `recoveryStatus: RecoveryStatus` 타입 narrow 부재**

**위치:** `apps/batch/src/pipeline.ts:79~115` PipelineResult / RecoveryStatus
**결함:** caller 가 PipelineResult 받은 시점 도달 가능한 RecoveryStatus literal 은 4종 (`already_completed` / `no_checkpoint` / `fully_recovered` / `partially_recovered`). `concurrent_run_detected` / `recovery_failed` 는 throw 후 도달 X — JSDoc 자연어 명시되어 있으나 타입 강제 X.
**정정안:**

```typescript
/** PipelineResult.recoveryStatus 가 도달 가능한 4 literal — throw 케이스 2종 제외. */
export type ReturnedRecoveryStatus = Exclude<
  RecoveryStatus,
  'concurrent_run_detected' | 'recovery_failed'
>;

export interface PipelineResult {
  // ...
  readonly recoveryStatus: ReturnedRecoveryStatus; // narrowed
  // ...
}
```

**난이도:** 🟢 LOW (5분 — 타입 alias + interface 1 라인)
**처리:** **본 세션 즉시 정정** (caller exhaustive check 가치 + 미래 e2e 작성 시 narrow type 활용)

#### **SF-MAJOR-DA-1 — finally `removeHandlers`/`costMeter.finalize` 실패 push 누락**

**위치:** `apps/batch/src/pipeline.ts:537-549` finally 블록
**결함:** B1 정정으로 metaPersistenceFailures 누적 패턴 도입했으나 finally 의 두 try/catch 블록 (removeHandlers + costMeter.finalize) 은 console.error 만 — push 누락. **B1 패턴 일관성 어긋남**.
**정정안:** finally catch 양쪽에 push 추가 — `stage` 는 'completed_transition' 차용 또는 신규 'finalize' literal 추가. 권고: `MetaPersistenceFailure.stage` 에 `'finalize'` literal 추가 + finally push.

**난이도:** 🟡 LOW-MED (10분 — type union 1 literal + finally 2곳 push + 신규 operation literal 검토)
**처리:** **본 세션 즉시 정정** (B1 패턴 일관성)

### 명시 이연 (2건)

#### **SF-MAJOR-DA-2/4 묶음 — SIGINT closure push 가 process.exit 직전 도달 X (cosmetic)**

**본질:** SF-CRITICAL-2 (signal handler async 패턴) 의 본 정정 후에도 잔존 — process.exit 가 microtask flush 안 함. 옵션 C 의 closure push 자체가 SIGINT 경로에서는 도달 못 함. **단, console.error stderr 출력은 stderr 버퍼링 즉시 flush 되므로 운영 가시화는 PASS** (Linux/macOS line-buffered stderr).
**처리:** **명시 이연** — handoff-016 §3.1 D `signal-handlers.test.ts` 작성 시 e2e 검증 + SF-CRITICAL-2 옵션 C 확정 (현 채택)

#### **Q-MAJOR-B1-1 — metaPersistenceFailures push 4 시점 + recoveryStatus 3 literal e2e 0건**

**본질:** 137 회귀 PASS 는 객관. 그러나 5 통합 테스트 모두 정상 경로 — `metaPersistenceFailures.length > 0` 경로 도달 0. 본 정정 핵심 기능 (옵션 C 가시화) 효과 미검증.
**처리:** **명시 이연** — handoff-016 §3.1 D / E / F / C 작업에 ~95분 (17% 추가) 흡수로 7 매핑 (5 throw 시점 + 2 RecoveryStatus literal) 모두 검증 가능. plan §3.1 갱신 권고.

---

## 4. ✅ 확인 항목 통합 (전수 PASS — 38건)

3 페르소나 합산 38건 ✅ 확인. 핵심:

- **SF-C-3 silent drop 차단** — `state='failed'` UPDATE catch 후 `console.error + reason 정규화 + push` 일관 패턴 (silent-failure)
- **SF-M-4 일관성 PASS** — `state='completed'` / `state='in_progress'` 동일 패턴 적용 (silent-failure)
- **SF-C-2 옵션 C 가시화** — SIGINT closure 가 console.error stderr 출력 + push (cosmetic 한계는 명시 이연) (silent-failure)
- **신규 silent failure 도입 0건** — try/catch 패턴 모두 reason 정규화 + console.error + push (silent-failure)
- **6 callsite 일괄 갱신 SLO** — typecheck PASS 가 callsite 누락 차단 객관 (system-architect)
- **MetaPersistenceFailure.stage union 4 push 사이트 1:1 정합** (system-architect)
- **Hard Rule 16/17 무위반** (system-architect)
- **CRITICAL RULE #2/#3 정합** (system-architect)
- **137/137 회귀 0건 + typecheck PASS** (quality 재실행 검증)
- **Q-M-2 정합 해결 확인** — `bin/batch.ts` recoveryStatus === 'already_completed' 시 exit 0 분기 (quality)
- **production-quality.md 정합** — 빈 catch 0건 + console.error 사용 (quality)
- **expect 패턴 일관성** — 5 callsite `toEqual([])` (quality)

---

## 5. Devil's Advocate 통합 (10 시나리오)

3 페르소나 합산 10 시나리오 + 격상 위험 평가:

|  #  | 시나리오                                                                 | 출처 | 격상 위험 | 처리                                            |
| :-: | :----------------------------------------------------------------------- | :--- | :-------: | :---------------------------------------------- |
|  1  | finally removeHandlers/costMeter.finalize 실패 push 누락                 | SF   |  🟡 MED   | **본 세션 정정** (SF-MAJOR-DA-1)                |
|  2  | SIGINT process.exit microtask flush 안 함 → closure push cosmetic        | SF   |  🟢 LOW   | 명시 이연 (옵션 C 채택, stderr 가시화 PASS)     |
|  3  | metaPersistenceFailures push 후 다음 stage 성공 시 caller 과거 결함 망각 | SF   |  🟢 LOW   | 운영자 alarm 책임 (PipelineResult 가시화)       |
|  4  | metaPersistenceFailures closure capture race                             | SF   |  🟢 LOW   | runPipeline single thread → race 0건            |
|  5  | finally throw 시 PipelineResult 미반환 → metaPersistenceFailures 손실    | SF   |  🟡 MED   | cap=2 정정 SF-C-1 으로 차단됨 (재확인)          |
|  6  | index.ts re-export 누락                                                  | SA   |  🟡 MED   | **본 세션 정정** (SA-MAJOR-1)                   |
|  7  | recoveryStatus narrowing 부재 → exhaustive switch 위험                   | SA   |  🟡 MED   | **본 세션 정정** (SA-MAJOR-2)                   |
|  8  | force-unlock CLI 미구현 → broken UX 가능                                 | SA   |  🟢 LOW   | 다음 세션 §3.1 G 흡수 (안내 텍스트 그대로 유지) |
|  9  | readonly 배열 vitest mutation 우회                                       | Q    |  🟢 LOW   | TS 컴파일 보호 + readonly JSDoc 명시            |
| 10  | InMemoryBatchRunsDb vs D1 트리거 lockstep 깨질 위험                      | Q    |  🟡 MED   | 다음 세션 §3.1 F `d1-trigger-verify.test.ts`    |

**🔴 HIGH 0건** — 모든 시나리오 LOW/MED. 본 세션 정정 3건 (#1, #6, #7) 후 단일 commit.

---

## 6. 본 세션 추가 정정 (cap=3 흡수)

본 4-Pass 가 발견한 MAJOR 3건은 **본 B1 commit 에 묶음 흡수** — 단일 commit + plan §10 SLO 정신 ("부분 commit 금지", 인터페이스 일관성):

| ID                | 정정                                                                                                                                                                       | 분량 |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
| **SA-MAJOR-1**    | `apps/batch/src/index.ts` 에 `MetaPersistenceFailure`, `RecoveryStatus`, `ReturnedRecoveryStatus` re-export 추가                                                           | 5초  |
| **SA-MAJOR-2**    | `pipeline.ts` 에 `ReturnedRecoveryStatus = Exclude<RecoveryStatus, 'concurrent_run_detected' \| 'recovery_failed'>` 타입 alias + `PipelineResult.recoveryStatus` 타입 변경 | 5분  |
| **SF-MAJOR-DA-1** | `MetaPersistenceFailure.stage` union 에 `'finalize'` literal 추가 + finally 2 catch 에 push (operation `'state_finalize_handlers'` `'state_finalize_costmeter'` 신규)      | 10분 |

총 추가 분량: 15분.

---

## 7. 통합 판정

**판정:** **PASS — 본 세션 cap=3 추가 정정 (15분) 후 단일 commit 완료 가능**

**조건:**

1. CRITICAL 0건 — B1 정정의 silent failure / 호환성 / 회귀 영향 모두 PASS
2. MAJOR 3건 본 세션 흡수 (SA-MAJOR-1/2 + SF-MAJOR-DA-1) — plan §10 SLO 정신 만족
3. MAJOR 2건 명시 이연 (SF-MAJOR-DA-2/4 SIGINT 본질 / Q-MAJOR-B1-1 e2e 갭) — 다음 세션 §3.1 C~G 흡수

**검증 결과 (객관 사실):**

- typecheck PASS (`pnpm -C apps/batch typecheck`)
- 137/137 tests PASS (회귀 0건, 1.26s)
- plan §10 SLO 만족 (6 callsite 일괄 갱신)
- Hard Rule 16/17 PASS

**다음 세션 차단 게이트:**

- cap=3 정정 후 typecheck + 회귀 재검증 → 단일 commit
- Q-MAJOR-B1-1 의 e2e 검증은 §3.1 C~G 작성 시 흡수 (분량 +95분, plan §3.1 갱신 권고)

---

## 8. 진산님 보고 요약

본 B1 검증:

- ✅ typecheck PASS + 137/137 회귀 0건
- ✅ 3 페르소나 모두 CRITICAL 0건
- ⚠️ MAJOR 5건 — 3건 본 commit 묶음 흡수 (15분), 2건 명시 이연

**본 세션 추가 정정 (15분 분량 — 단일 commit 정합):**

1. SA-MAJOR-1 — index.ts re-export 추가
2. SA-MAJOR-2 — ReturnedRecoveryStatus narrowing
3. SF-MAJOR-DA-1 — finally push 일관성

**다음 세션 첫 결정 (변경 없음):**

- plan §3.1 C~G 작성 + Q-MAJOR-B1-1 e2e 흡수 (3 페르소나 합의)

---

**보고서 작성자:** Claude (Opus 4.7) — 메인 컨텍스트
**근거:** 3 독립 에이전트 보고서 통합 (silent-failure / system-architect / quality)
**다음 작업:** 본 세션 cap=3 정정 (15분) → typecheck + 회귀 → 단일 commit → 다음 세션 §3.1 C~G
