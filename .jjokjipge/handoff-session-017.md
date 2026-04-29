# Handoff — Session 017 → Step 11.6 9 AC e2e + 4-Pass 재리뷰 진입 직전

작성일: 2026-04-29 (KST)
직전 세션: 016 (Step 11.6 §A~G 코드 + 4-Pass) → 017 (cap=2 + B1 PipelineResult 확장 + cap=3 흡수 + 단일 commit)

---

## 0. 세션 017 핵심 결정

### 0.1 결정 — handoff-016 §3.3 권고 3건 모두 채택 (1C / 2X / 3ⓐ)

진산님 "권고 대로" 답변. 본 세션은:

- **결정 1 (SF-C-2 SIGINT 도달 불가)** = **옵션 C** — `PipelineResult.metaPersistenceFailures` 가시화 + 운영자 강제 unlock CLI (CLI는 다음 세션 흡수)
- **결정 2 (SF-C-3 + Q-M-2 PipelineResult 확장 시점)** = **시점 X** — 본 세션 첫 작업
- **결정 3 (MINOR 일괄 처리 시점)** = **시점 ⓐ** — 본 plan 끝까지 일괄 (다음 세션 §3.1 C~G 동시 흡수)

### 0.2 결정 — cap=3 추가 정정 본 commit 묶음 흡수

B1 4-Pass 재리뷰에서 발견한 MAJOR 5건 중 3건은 인터페이스 변경 응집성 차원에서 본 commit에 묶음 흡수 (plan §10 SLO 정신):

- **SA-MAJOR-1** index.ts re-export 누락
- **SA-MAJOR-2** ReturnedRecoveryStatus narrowing 부재
- **SF-MAJOR-DA-1** finally push 일관성 (`stage='finalize'` literal + `operation='finalize_handlers'/'finalize_costmeter'` 신규)

나머지 2건 (SF-MAJOR-DA-2/4 SIGINT cosmetic 본질 / Q-MAJOR-B1-1 e2e 갭) 명시 이연.

### 0.3 결정 — 단일 commit (5d3aa50) 후 새 세션 진입

**commit 5d3aa50:** `feat(engine-hardening): Step 11.6 정정 — finally outer catch + exit 4/5 + PipelineResult 확장`

13 files changed (코드 4 + 영속 문서 9). plan §10 SLO ("PipelineResult 인터페이스 변경 + 6 callsite 일괄 갱신, 부분 commit 금지") 객관 만족.

---

## 1. 직전 세션(017)에서 완료한 것

### 1.1 코드 변경 (4 파일, +168/-24)

|  #  | 파일                                                    | 변경                                                                                                                                                                                                                                           | 의도                   |
| :-: | :------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
|  1  | `apps/batch/src/pipeline.ts`                            | `MetaPersistenceFailure` / `ReturnedRecoveryStatus` 신규 export 타입 + `PipelineResult` 2 필드 추가 (recoveryStatus / metaPersistenceFailures) + `runPipeline` 8 try/catch wrap (state UPDATE 4종 + finally 2 + SIGINT closure + recover 흡수) | A0 SF-C-1 + B1 본체    |
|  2  | `apps/batch/bin/batch.ts`                               | `ConcurrentRunError`/`RecoveryFailedError` import + `ExitCode = 0\|1\|2\|4\|5` + JSDoc exit 3 비움 사유 명시 + cmdRun metaFailures alarm + recoveryStatus='already_completed' 시 exit 0 (Q-M-2)                                                | A0 SA-M-2 + B1 + cap=3 |
|  3  | `apps/batch/src/index.ts`                               | `ConcurrentRunError`/`RecoveryFailedError` value re-export + `MetaPersistenceFailure`/`RecoveryStatus`/`ReturnedRecoveryStatus` type re-export                                                                                                 | cap=3 SA-MAJOR-1       |
|  4  | `apps/batch/src/__tests__/pipeline.integration.test.ts` | 5 callsite 모두 `expect(result.recoveryStatus).toBe('no_checkpoint'); expect(result.metaPersistenceFailures).toEqual([])` 추가. dry-run 케이스는 `await` → `const result = await` 변경                                                         | B1 6 callsite SLO      |

### 1.2 4-Pass 독립 에이전트 리뷰 — 2회 진행 (총 6 페르소나 리뷰 + 2 통합)

| 단계                           | CRITICAL | MAJOR | MINOR | 판정                 |
| :----------------------------- | :------: | :---: | :---: | :------------------- |
| **A0 cap=2** (SF-C-1 + SA-M-2) |    0     |   3   |   7   | PASS                 |
| **B1 PipelineResult 확장**     |    0     |   5   |   9   | PASS (cap=3 흡수 후) |

산출물 9건 (본 commit에 포함):

- `.claude/reports/decision-20260429-step11-6-after-cap2.md`
- `.claude/reviews/review-20260429-104757-step11-6-cap2-{silent-failure,system-architect,quality,4pass}.md` (4건)
- `.claude/reviews/review-20260429-112400-step11-6-pipeline-result-{silent-failure,system-architect,quality,4pass}.md` (4건)

### 1.3 검증 결과

- **typecheck PASS** (`pnpm -C apps/batch typecheck`) — A0 / B1 / cap=3 정정 후 모두 PASS
- **137/137 tests PASS** (회귀 0건, 1.41s 최종)
- **plan §10 SLO PASS** — PipelineResult 인터페이스 변경 + 6 callsite 일괄, 부분 commit 금지
- **Hard Rule 16/17 PASS** — 시험 ID 리터럴 신규 도입 0건
- **CRITICAL RULE #2/#3 PASS** — 빈 함수 / 빈 catch 0건

### 1.4 단일 commit

```
5d3aa50 feat(engine-hardening): Step 11.6 정정 — finally outer catch + exit 4/5 + PipelineResult 확장
13 files changed, 2171 insertions(+), 24 deletions(-)
```

lint-staged hook 이 prettier로 보고서 reformat 자동 적용 (마크다운 테이블 alignment 정렬 — 본질 변경 X).

---

## 2. 다음 세션 작업 — Step 11.6 9 AC e2e + 4-Pass 재리뷰 ⭐⭐

### 2.1 작업 분해 (1.85d 추정 — handoff-016 §3.1 C~J 잔여)

| 우선  | 작업                                                                                                                                                                   | 시간  | 의존                        |
| :---: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---: | :-------------------------- |
| **C** | F1 `pipeline-integration.test.ts` 확장 (AC-1 + AC-R1~R3 e2e + AC-Snapshot-ExamId) — Q-MAJOR-B1-1 흡수 (recoveryStatus 'fully_recovered'/'partially_recovered' 검증)    | 0.3d  | — (commit 5d3aa50 baseline) |
| **D** | F2 `signal-handlers.test.ts` 신규 (AC-R4 SIGINT/SIGTERM 격리) — Q-MAJOR-B1-1 흡수 (markBatchRunKilled push 검증 + SF-MAJOR-DA-2/4 cosmetic 본질 e2e)                   | 0.15d | —                           |
| **E** | F3 `cost-meter-pipeline-kill.test.ts` 신규 (AC-Cost — toCheckpointCostState 7 케이스 + kill switch checkpoint flush)                                                   | 0.2d  | —                           |
| **F** | F4 `d1-trigger-verify.test.ts` 신규 (AC-R6 + AC-T3 + AC-RP-6 — better-sqlite3 e2e 0015/0016 트리거 5×7 + race window) — Q-MAJOR-B1-1 흡수 (state UPDATE throw push)    | 0.3d  | better-sqlite3 dep          |
| **G** | F5 `checkpoint.test.ts` 확장 (AC-Snapshot' canonicalJson 9종+circular 13 케이스 + diamond DAG false-positive 차단 + AC-R5 fsync 보장) — 강제 unlock CLI 옵션 동시 추가 | 0.2d  | —                           |
| **H** | InMemoryBatchRunsDb clock injection 추가 (AC-T3 stale 24h 시뮬레이션) + intentional throw 옵션 (Q-MAJOR-B1-1 e2e용)                                                    | 0.1d  | F                           |
| **I** | typecheck + 137+/137+ + 신규 5건 PASS 확인                                                                                                                             | 0.1d  | C/D/E/F/G                   |
| **J** | Step 11.6 4-Pass 재리뷰 (정정 cap=2) + MINOR 16건 일괄 흡수                                                                                                            | 0.5d  | I                           |

총 추정: **1.85d** (현실 ×1.5 = 2.8d 비관)

### 2.2 권고 진행 순서

```
[Day 1]   C (pipeline-integration.test.ts 확장 + AC-R1~R3 + Snapshot-ExamId)   0.3d
          D (signal-handlers.test.ts 신규)                                    0.15d
          E (cost-meter-pipeline-kill.test.ts 신규)                            0.2d
          → 총 0.65d

[Day 2]   F (d1-trigger-verify.test.ts 신규)                                   0.3d
          G (checkpoint.test.ts 확장 + force-unlock CLI)                       0.2d
          H (InMemoryBatchRunsDb clock injection + throw 옵션)                 0.1d
          I (typecheck + 회귀)                                                 0.1d
          → 총 0.7d

[Day 3]   J (4-Pass 재리뷰 + cap=2 + MINOR 16건 흡수)                          0.5d
          → 총 0.5d
```

### 2.3 진입 직후 첫 결정 (다음 세션 첫 5~10분)

**진산님 결정 영역 0건** — 본 세션 모든 결정 처리 완료.

다음 세션은 자율 진행 (cap=2 정정 발생 시에만 진산님 보고):

1. **C 작업 진입 직전 plan v1.2 갱신** — handoff-017 §2.1 의 Q-MAJOR-B1-1 흡수 매트릭스를 plan §3.1 에 명시 (자율 결정)
2. **better-sqlite3 dep 추가** (F 작업) — Workers 호환 X 이나 테스트 전용. `apps/batch/package.json` devDependencies 추가 (자율 결정)
3. **force-unlock CLI 옵션 명세** (G 작업) — `bin/batch.ts unlock <batch_run_id>` 또는 `run --force-unlock` 형식. 자율 결정 권고: `unlock` 별도 명령어 (run 흐름 분리)

---

## 3. 명시 이연 (다음 세션 §3.1 C~G 흡수 의무)

### 3.1 본 세션 4-Pass 의 명시 이연 항목

|                            ID                            | 흡수 위치                                                                                          |        분량         |
| :------------------------------------------------------: | :------------------------------------------------------------------------------------------------- | :-----------------: |
|         **SF-MAJOR-DA-2/4** SIGINT cosmetic 본질         | D `signal-handlers.test.ts` (markBatchRunKilled stderr 가시화 검증 + closure push 도달 X 본질 e2e) |        포함         |
| **Q-MAJOR-B1-1** metaPersistenceFailures push 4 시점 e2e | C/D/F (5 throw 시점 매핑)                                                                          | 포함 (~95분, +0.2d) |
|      **Q-MAJOR-B1-1** recoveryStatus 3 literal e2e       | C `pipeline-integration.test.ts` (already_completed/fully_recovered/partially_recovered)           |        포함         |

### 3.2 MINOR 16건 (cap=2 7 + B1 9, 중복 1)

본 plan 끝까지 일괄 흡수 — Step 11.6 §3.1 J 4-Pass 재리뷰 전 cleanup. 핵심 항목:

- silent-failure: deduplicate / reason category enum / runbook / JSDoc 보강 (4건)
- system-architect: Mn-2 메시지 보강 + JSDoc invariant (RecoveryFailedError 외부 wrapping 금지) (3건)
- quality: stack trace 누락 / readonly 배열 freeze / JSDoc invariant cleanup (5건 + 4건)

### 3.3 명시 이연 — 별도 plan/step 영역

|       ID       | 본질                                    | 처리 시점        |
| :------------: | :-------------------------------------- | :--------------- |
| **SF-MAJOR-1** | logger 추상화 (console.error 직접 호출) | Step 18 cleanup  |
| **SA-MAJOR-1** | model ID 정규화 책임 모호 (cost-meter)  | Step 1 plan 영역 |

---

## 4. 핵심 문서 위치 (필수 읽기)

### 4.1 새 세션 진입 직후 1차 읽기 (10~15분)

1. **본 핸드오프** — `.jjokjipge/handoff-session-017.md`
2. **본 세션 commit 5d3aa50** — `git show 5d3aa50 --stat` + `git show 5d3aa50 apps/batch/src/pipeline.ts`
3. **B1 4-Pass 통합 보고서** — `.claude/reviews/review-20260429-112400-step11-6-pipeline-result-4pass.md` (특히 §3 정정 매트릭스 + §6 흡수 사항)
4. **결정 보고서** — `.claude/reports/decision-20260429-step11-6-after-cap2.md` (권고 채택 근거 보존)
5. **Step 11.6 plan v1.1** — `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md` (§3.3 흐름 + §7 AC + §10 SLO + §3.1 갱신 권고)
6. **handoff-session-016** — §3.1 작업 매트릭스 (본 핸드오프 §2.1 의 원본)
7. **CLAUDE.md** + `.claude/rules/{auto-review-protocol,production-quality,session-health}.md`

### 4.2 작업 진입 시 읽기

| 작업                                  | 필수 읽기                                                                                                                                                                                         |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C (pipeline-integration.test.ts 확장) | 본 핸드오프 §3.1 + handoff-015 §2.3 (AC-1, R1~R3, Snapshot-ExamId 매핑) + `apps/batch/src/__tests__/pipeline.integration.test.ts` 5 testcase 패턴                                                 |
| D (signal-handlers.test.ts 신규)      | `apps/batch/src/signal-handlers.ts` 전체 + Node `process.kill` API + B1 통합 보고서 §5 #2 (SIGINT cosmetic 본질)                                                                                  |
| E (cost-meter-pipeline-kill.test.ts)  | `apps/batch/src/cost-meter.ts:340-361` (toCheckpointCostState) + `pipeline.ts:807-827` (recordTokens 통합) + cost-meter.test.ts 31 testcase 패턴                                                  |
| F (d1-trigger-verify.test.ts)         | `migrations/0015_batch_runs.sql` + `migrations/0016_*.sql` + `apps/batch/src/d1-batch-runs-db.ts` + better-sqlite3 docs (context7 활용)                                                           |
| G (checkpoint.test.ts 확장)           | `apps/batch/src/checkpoint.ts:188-310` + `.claude/reviews/midpoint-20260428-p0fix-quality.md` Q-C1 13 케이스 + force-unlock CLI 명세 (`bin/batch.ts unlock <batch_run_id>` 또는 `--force-unlock`) |
| H (InMemoryBatchRunsDb 확장)          | `apps/batch/src/in-memory-batch-runs-db.ts` 전체 + B1 통합 보고서 §5 #10 (D1 vs InMemory lockstep)                                                                                                |
| J (4-Pass 재리뷰)                     | `.claude/rules/auto-review-protocol.md` + 본 4-Pass 통합 보고서 2건 + `.claude/reviews/review-20260429-094423-step11-6-pipeline-integration-4pass.md`                                             |

---

## 5. 주의사항 (강제)

### 5.1 review-gate.sh Stop Hook 자동 발동 (재확인)

본 세션도 코드 변경 후 Stop Hook 차단됨. cap=2 + B1 두 차례. 다음 세션 9 AC e2e 작성 후도 동일 — **3+ 독립 서브에이전트 병렬 호출 의무**, 통합 보고서 review-gate.sh 형식.

### 5.2 cap=2 정정 규칙 (auto-review-protocol.md §"규칙 4")

다음 세션 4-Pass 재리뷰 (작업 J) 에서 또 CRITICAL 발견 시 cap=2 정정 후 재검증. **본 세션은 cap=3 흡수했으나 모두 MAJOR 영역** — 인터페이스 응집성 SLO 정신 (plan §10) 의 예외적 흡수. 다음 세션은 cap=2 엄격 적용 권고.

### 5.3 본 세션은 1시간 내 종료 (양호)

본 세션 약 1시간 5분 (cap=2 30분 + B1 본체 30분 + cap=3 15분 + commit/handoff 10분). session-health.md 90분 임계 미만. **다음 세션도 ≤ 3시간 권고** — 9 AC e2e 5건 + 4-Pass 재리뷰는 분량 큼, Day 단위 분리 권고.

### 5.4 plan v1.2 갱신 의무

본 세션 변경으로 plan v1.1 의 SLO 매트릭스 갱신 필요:

- §3.1 — Q-MAJOR-B1-1 흡수 매트릭스 추가 (~95분, 17% 추가)
- §10 SLO — "PipelineResult 인터페이스 + 6 callsite 일괄 commit" 객관 PASS 명시
- §"명시 이연" — 본 세션 새 명시 이연 (SF-MAJOR-DA-2/4 SIGINT cosmetic / Q-MAJOR-B1-1 e2e) 추가

다음 세션 C 작업 진입 전 plan v1.2 갱신 1차 commit 권고.

### 5.5 force-unlock CLI 명세 (G 작업)

본 세션 결정 1 옵션 C 채택의 핵심 — 운영자 강제 unlock 권한. CLI 명세 권고:

```bash
thepick-batch unlock <batch_run_id> --reason="<text>"
# → batch_runs.state='killed' UPDATE + audit log 기록
```

또는 `run --force-unlock` 옵션 (run 진입 직전 자동 unlock 시도). 자율 결정 권고: **별도 `unlock` 명령어** (run 흐름과 책임 분리). 다음 세션 G 작업 시 confirmed.

### 5.6 better-sqlite3 dep 추가 (F 작업)

`d1-trigger-verify.test.ts` 는 0015/0016 트리거 invariant 를 better-sqlite3 로 e2e 검증 (D1 호환 SQLite engine, Workers production 무관). `apps/batch/package.json` devDependencies 추가 — Cloudflare 단일 벤더 원칙 (`feedback_single_vendor_cloudflare.md`) 무관 (테스트 전용, production 번들 X).

### 5.7 진산님 결정 영역 vs 자율 영역

**자율 진행 (다음 세션):**

- 9 AC e2e 작성 (C~G)
- InMemoryBatchRunsDb 확장 (H)
- typecheck + 회귀 (I)
- 4-Pass 재리뷰 호출 + 통합 보고서 (J)
- 핸드오프 작성
- plan v1.2 갱신
- force-unlock CLI 명세 자율 결정
- better-sqlite3 dep 추가

**진산님 결정 영역 (다음 세션 발생 시 보고):**

- J 4-Pass 재리뷰에서 신규 CRITICAL 발견 → cap=2 정정 또는 후보 A 재검토 (handoff-015 §5.3)
- 9 AC e2e 작성 중 plan §3.3 의 본질적 흐름 변경 의문 발견 시
- BATCH-1 적재 진입 결정 (Step 11.6 4-Pass PASS 후)

---

## 6. 진산님 메모리 (자동 로드)

자동 로드되는 핵심 메모리 — 별도 행동 불필요:

- `project_content_build_engine_as_core.md`
- `project_batch_load_workflow.md`
- `feedback_document_first_workflow.md` ⭐ (본 세션 결정 보고서 + 4-Pass 영속화 정합)
- `feedback_two_fix_failures_zoom_out.md`
- `project_anthropic_cap_pre_install.md`
- `feedback_no_shortcuts.md`
- `feedback_focus_reliability_not_schedule.md`
- `feedback_no_granular_decisions.md`
- `feedback_auto_review.md` (cap=2 + B1 두 차례 4-Pass 정합)
- `feedback_phase_review_5_persona.md`
- `feedback_single_vendor_cloudflare.md` (better-sqlite3 dep 예외 처리 정합)
- `project_source_citation_requirement.md`
- `project_v3_final_multi_exam_deferred.md`
- `project_vision_mvp_generalization.md`

---

## 7. 새 세션 시작 prompt

### 옵션 A (간결 — 권고)

```
.jjokjipge/handoff-session-017.md 읽고 이어가줘
```

→ Claude 가 핸드오프 읽고 §2.1 의 우선 C (pipeline-integration.test.ts 확장) 자동 진입 + plan v1.2 갱신 1차 commit.

### 옵션 B (특정 작업)

```
.jjokjipge/handoff-session-017.md 읽고 plan v1.2 갱신부터
```

또는

```
.jjokjipge/handoff-session-017.md 읽고 D signal-handlers.test.ts부터 (SIGINT cosmetic 본질 e2e)
```

또는

```
.jjokjipge/handoff-session-017.md 읽고 F d1-trigger-verify.test.ts부터 (better-sqlite3 dep 추가 + 0015/0016 트리거 e2e)
```

또는

```
.jjokjipge/handoff-session-017.md 읽고 J 4-Pass 재리뷰부터 (C~I 모두 완료된 가정)
```

### 옵션 C (진산님 직접 baseline 확인)

```
.jjokjipge/handoff-session-017.md 읽고 commit 5d3aa50 결과만 검증해줘
```

→ Claude 가 commit 5d3aa50 의 변경 내역 + 4-Pass 통합 보고서 2건 + 검증 결과를 보고. 다음 작업 진입 X.

---

## 8. 세션 017 메타 통계

- 시작 시각: 2026-04-29 약 10:25 KST (handoff-016 종료 후 즉시)
- 종료 시각: 2026-04-29 약 11:35 KST (handoff-017 작성 완료 시점 추정)
- 누적 시간: **약 1시간 10분** (session-health.md 90분 임계 미만 — 양호)
- 누적 turn: 약 15+
- 영속 문서 산출: 9건 (4-Pass 8 + 결정 보고서 1) + handoff-017 본 문서
- 코드 변경: 4 파일 (+168/-24)
- commit: 1건 (5d3aa50, 13 files / +2171/-24 — 보고서 9 + 코드 4)
- 4-Pass 결과:
  - cap=2: CRITICAL 0 / MAJOR 3 / MINOR 7 (PASS)
  - B1: CRITICAL 0 / MAJOR 5 / MINOR 9 (PASS, cap=3 흡수 후)
- 본 세션 정정: cap=2 (2건) + B1 본체 + cap=3 (3건) = 총 6건 정정
- session-health 권고: ≤ 3시간 다음 세션

---

## 9. 진척도 (백분율) — v1.2 기준

Engine Hardening Roadmap v1.2 기준 (본 세션 후):

| Phase                                     | 산출물                                                                                                                                                                        |  진행   | 비고                                         |
| :---------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-----: | :------------------------------------------- |
| Phase 0 (마스터 + ADR + 설계)             | ROADMAP v1.2 + ADR 4건 + LLM_CONTAINMENT.md                                                                                                                                   | ✅ 100% | —                                            |
| Phase 1 (엔진 contract)                   | research × 3 + contract × 3                                                                                                                                                   | ✅ 100% | —                                            |
| Phase 2 (단계별 plan)                     | step1~7 + step6 + step11.6 v1.1 + step5 v1.1 + 0016 마이그레이션                                                                                                              | ✅ 100% | plan v1.2 갱신 다음 세션 의무                |
| Phase 3 (코드 구현)                       | Step 12 + Step 17 + R-C1/Q-C1/B-C3/SF-M-2 + B-C2 examId / Step 11.6 §A~G 코드 / **Step 11.6 cap=2 + B1 + cap=3 정정 (본 세션)** / 13~16 잔여 + Step 11.6 9 AC e2e (다음 세션) | 🟡 ~62% | Step 11.6 코드 정정 완료, e2e 잔여           |
| Phase 4 (자동 검증 + 4-Pass + 5-페르소나) | 4-Pass 8건 + 5-페르소나 1건 + 메타 감사 1건                                                                                                                                   | 🟡 ~67% | **본 세션 4-Pass 2건 추가**                  |
| Phase 5 (BATCH-1 적재 진입)               | —                                                                                                                                                                             |  ⏳ 0%  | Step 11.6 9 AC e2e + J 4-Pass 재리뷰 통과 후 |

**총 진행률 (v1.2 기준 production 검증 weight 보정):** 약 **70~75%**

---

## 10. 본 세션 통합 정정 매트릭스 (요약)

| 출처                                       | 결함                                                               |              본 세션 처리              |             다음 세션 처리              |
| :----------------------------------------- | :----------------------------------------------------------------- | :------------------------------------: | :-------------------------------------: |
| 직전 4-Pass §2.1 SF-CRITICAL-1             | finally `removeHandlers()` outer catch 부재                        |                ✅ 완료                 |                    —                    |
| 직전 4-Pass §3 SA-MAJOR-2                  | main catch ConcurrentRunError/RecoveryFailedError 미구분           |                ✅ 완료                 |                    —                    |
| 직전 4-Pass §2.3 SF-CRITICAL-2 → 옵션 C    | SIGINT handler markBatchRunKilled 도달 불가                        | ✅ 옵션 C 채택 (가시화 + closure push) |  SF-MAJOR-DA-2/4 cosmetic 본질 e2e (D)  |
| 직전 4-Pass §2.4 SF-CRITICAL-3 + Q-MAJOR-2 | state='failed' UPDATE silent + recoveryStatus 누락                 |     ✅ 완료 (PipelineResult 확장)      |                    —                    |
| cap=2 4-Pass §3 SA-MAJOR-Mn-1              | ExitCode JSDoc exit 3 비움 사유 미명시                             |                ✅ 완료                 |                    —                    |
| cap=2 4-Pass §3 Q-MAJOR-1                  | SF-C-1 / SA-M-2 정정 효과 e2e 갭                                   |                   —                    | D `signal-handlers.test.ts` + G CLI e2e |
| cap=2 4-Pass §3 SF-MAJOR-1                 | logger 추상화 부재                                                 |                   —                    |       Step 18 cleanup (별도 plan)       |
| B1 4-Pass §3 SA-MAJOR-1                    | index.ts re-export 누락                                            |                ✅ 완료                 |                    —                    |
| B1 4-Pass §3 SA-MAJOR-2                    | ReturnedRecoveryStatus narrowing 부재                              |                ✅ 완료                 |                    —                    |
| B1 4-Pass §3 SF-MAJOR-DA-1                 | finally push 일관성                                                |                ✅ 완료                 |                    —                    |
| B1 4-Pass §3 SF-MAJOR-DA-2/4               | SIGINT closure push process.exit cosmetic                          |                   —                    |  D `signal-handlers.test.ts` 본질 e2e   |
| B1 4-Pass §3 Q-MAJOR-B1-1                  | metaPersistenceFailures push 4 시점 + recoveryStatus 3 literal e2e |                   —                    |        C/D/F 흡수 (~95분, +0.2d)        |
| **본 세션 MINOR 16건**                     | (cap=2 7 + B1 9, 중복 1)                                           |                   —                    |  J 4-Pass 재리뷰 전 일괄 흡수 (시점 ⓐ)  |

---

**핸드오프 작성자:** Claude (Opus 4.7)
**다음 세션 시작 권고:** 옵션 A — `.jjokjipge/handoff-session-017.md 읽고 이어가줘`
**첫 작업:** plan v1.2 갱신 1차 commit → §2.1 C (pipeline-integration.test.ts 확장 + Q-MAJOR-B1-1 일부 흡수)
**예상 세션 분량:** Day 1 (C+D+E, 약 0.65d) ≤ 3시간 권고. 다음 세션 ≤ 3시간 종료.
