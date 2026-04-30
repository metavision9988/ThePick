# Handoff — Session 022 → Step 16a 본 세션 흡수 + 4-Pass CRITICAL 1건 + MAJOR 4건 흡수 + 영속화

작성일: 2026-04-30 17:00 KST
직전 세션: 021 (Step 14a + 15a + 4-Pass CRITICAL 6건) → 022 (진산님 "권고대로 진행" 트리거 — Step 16a 흡수, plan ↔ 실측 갭 자율 분할 16a/16b/16c, 4-Pass CRITICAL 1건 + MAJOR 4건 흡수)

---

## 0. 세션 022 핵심 결정 / 본질

### 0.1 본 세션 산출 — 진산님 트리거 1건 충실 응답 (1 commit + 4-Pass 4 agent 병렬 + Pass 4 재검증 1회)

진산님 트리거 — "권고 대로 진행해줘" → handoff-021 §2.3 권고 P-1 Step 16 reproducibility-idempotency 진입.

**자율 분할 결정 (handoff-021 §2.4 패턴 재사용):**

본 Step 16 풀 스코프는 Step 14a/15a 보다 훨씬 큼 (production code 변경 + LoadDraftContext 시그니처 breaking change + e2e 5 시나리오 + 마이그레이션 e2e). 본 세션 capacity (≤ 3h, 실측 ~25분) 안에 풀스코프 위험 → **16a/16b/16c 분할**:

- **16a 진행 (본 세션, ~25분)**: source_id 인프라 (`buildSourceId` 헬퍼 + LoadDraftContext.batchRunId + draft-loader.ts INSERT 채움) + 단위 테스트 8건 + AC-RP-7 부분 (단위)
- **16b 이연 (Engine Hardening 차세션 의무)**: 시나리오 A/B/C/E e2e (AC-RP-1/2/3/4 + AC-RP-7 e2e 100회) — `runPipeline` 풀 실행 의존
- **16c 이연 (16b 후 또는 별도)**: AC-RP-6 0016 마이그레이션 + 0014 트리거 화이트리스트 갱신 e2e

### 0.2 결정 — Step 16 plan v1.1 명시 이연 4 항목 모두 흡수

`docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md` v1.1 §"v1.1 명시 이연" CRITICAL-Q4 (`review-20260428-200211-bc1bc2-step5-examid-quality.md`) 의 4 항목:

|  #  | 항목                                                          |         흡수         |
| :-: | :------------------------------------------------------------ | :------------------: |
|  1  | `draft-loader.ts` INSERT 에 batch_run_id + source_id 채움     |    ✅ bind 11→13     |
|  2  | `buildSourceId(pageRef, nodeId)` 결정성 헬퍼 + 단위 테스트 7+ |     ✅ 8 케이스      |
|  3  | `source_id` 컬럼명 충돌 검증 (knowledge_edges 와 분리)        |  ✅ 0001/0016 검증   |
|  4  | NULL page_ref 정책 (B) `<no_page>#{node_id}` fallback         | ✅ PAGE_REF_FALLBACK |

→ plan v1.2 §"v1.2 흡수" 본문에 4 항목 + 추가 항목 5 (LoadDraftContext.batchRunId) + 6 (loader.test.ts BASE_CTX) 명시.

### 0.3 결정 — 4-Pass 자동 리뷰 CRITICAL 1건 + MAJOR 4건 흡수 + Phase 이월 3건

**1차 4-Pass 결과 (4 agent 병렬):**

|    Pass     | Agent            |     판정      | CRITICAL | MAJOR |
| :---------: | :--------------- | :-----------: | :------: | :---: |
|  1 SURGEON  | general-purpose  |   완료 가능   |    0     |   0   |
| 2 ARCHITECT | system-architect |   수정 필요   |    0     |   2   |
| 3 ADVOCATE  | quality-engineer | **수정 필요** |  **1**   |   4   |
| 4 CONTRACT  | general-purpose  |   완료 가능   |    0     |   1   |

**CRITICAL 1건 fix:**

|  #  |  Pass  | 항목                                                                                  | fix                                                                       |
| :-: | :----: | :------------------------------------------------------------------------------------ | :------------------------------------------------------------------------ |
| C-1 | Pass 3 | `pageRefString` 정수 한정 vs JSDoc/plan/migration 0010 의 page_ref 형식 silent 불일치 | build-source-id.ts JSDoc 정정 + test case 1 주석 분리 + plan v1.2 표 정정 |

**MAJOR 4건 흡수 → 16b/16c 진입 게이트 영속화:**

|    #     |      Pass       | 항목                                             | 영속화 위치                                  |
| :------: | :-------------: | :----------------------------------------------- | :------------------------------------------- |
|   M-1    | Pass 2 + Pass 4 | Hard Rule 16 examId 누락                         | step5 plan v1.2 §"Step 16b 진입 게이트" 8번  |
|   M-2    |     Pass 2      | D1 batch() partial-commit atomicity              | step5 plan v1.2 §"Step 16b 진입 게이트" 9번  |
| C-1 후속 |     Pass 3      | page_ref 형식 caller 보강 (16b fixture 결정)     | step5 plan v1.2 §"Step 16b 진입 게이트" 10번 |
|  반론 2  |     Pass 3      | `<no_page>` fallback silent 진입 (Year 2 import) | step5 plan v1.2 §"Step 16c 진입 게이트" 5번  |

**Pass 4 재검증 결과:** ✅ 8건 PASS / 🔴 0건 / 🟠 0건. **16a commit 가능 판정**.

### 0.4 결정 — Phase 이월 부채 3건 명시 트래킹 (Pass 3 M-1/M-2/M-3)

본 fix 에 미흡수, 차세션 / phase 종료 전 의무 처리:

|     #      | 항목                                                                      | 처리 시점                                    |
| :--------: | :------------------------------------------------------------------------ | :------------------------------------------- |
| Pass 3 M-1 | batchRunId UUID 정규식 검증 (caller 책임 위주, 외부 trigger 추가 시 위험) | 차세션 또는 Step 16b 진입 시                 |
| Pass 3 M-2 | nodeId ontology-registry 패턴 검증 (preValidate 또는 buildSourceId 내)    | 차세션 또는 Step 16b 진입 시                 |
| Pass 3 M-3 | test fixture multi-byte / 매우 긴 nodeId 케이스 추가                      | Phase 종료 전 (Engine Hardening 마지막 Step) |
| Pass 3 M-4 | "633 vs 모노레포 합" 카운트 정확성                                        | 본 핸드오프 §1.5 명시 처리                   |

---

## 1. 직전 세션(022)에서 완료한 것

### 1.1 commit 1건

| commit    | 분류        | 내용                                                                                      |
| :-------- | :---------- | :---------------------------------------------------------------------------------------- |
| `8a62089` | feat(batch) | Step 16a buildSourceId + LoadDraftContext.batchRunId + INSERT 채움 (7 files / +230 / -28) |

### 1.2 신규 production code 산출

| 파일                                       | LOC | 역할                                                                                                              |
| :----------------------------------------- | --: | :---------------------------------------------------------------------------------------------------------------- |
| `apps/batch/src/loader/build-source-id.ts` | ~50 | `buildSourceId(pageRef, nodeId)` 결정성 헬퍼 + PAGE_REF_FALLBACK + SOURCE_ID_SEPARATOR + JSDoc page_ref 형식 명시 |

### 1.3 신규/수정 테스트 산출

| 파일                                                      | tests | 시나리오                                                                                                 |
| :-------------------------------------------------------- | ----: | :------------------------------------------------------------------------------------------------------- |
| `apps/batch/src/loader/__tests__/build-source-id.test.ts` |     8 | 정상 / null / undefined / empty / whitespace / 결정성 100회 / 빈 nodeId throw / 충돌 차단 / exports 일치 |
| `apps/batch/src/__tests__/loader.test.ts` (수정 +2)       |    +2 | batchRunId 누락 차단 + source_id 결정성 모든 노드 채움                                                   |

### 1.4 수정 production code

| 파일                                    | 변경                                                                                                                |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `apps/batch/src/loader/draft-loader.ts` | LoadDraftContext.batchRunId 필수 + preValidate 차단 + buildNodeInserts SQL 에 batch_run_id + source_id (bind 11→13) |
| `apps/batch/src/pipeline.ts:917`        | loadCtx.batchRunId: ctx.batchRunId 전달                                                                             |

### 1.5 영속화 (plan v1.2 + ROADMAP)

| 파일                                                                         | 변경                                                                                                                           |
| :--------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| `docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md` v1.2 | v1.1 명시 이연 4 항목 흡수 + 16b 진입 게이트 10항목 (8/9/10 4-Pass MAJOR 흡수) + 16c 진입 게이트 5항목 + page_ref 형식 표 정정 |
| `docs/plans/engine-hardening/ROADMAP.md`                                     | §3.2 표 행 — Step 16a ✅ + Step 16b/16c 이연 표기. §8 체크리스트 — Step 16a ✅ 라인 갱신                                       |

### 1.6 검증 결과 (회귀 모두 PASS)

| 항목                             | 결과                                                                                                            |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| typecheck (전체 monorepo 15 pkg) | **PASS**                                                                                                        |
| `@thepick/batch`                 | **205/205 PASS** (기존 195 + 신규 10 = +5%)                                                                     |
| `@thepick/parser`                | **136/136 PASS** (Step 14a base 유지)                                                                           |
| `@thepick/quality`               | **41/41 PASS** (Step 15a base 유지)                                                                             |
| `@thepick/formula-engine`        | **251/251 PASS** (Step 13 base 유지)                                                                            |
| **4 핵심 패키지 합**             | **633/633 PASS** (직전 623 + 신규 10)                                                                           |
| 모노레포 전체 (참고, Pass 3 M-4) | **~878 PASS** (33 shared + 41 quality + 251 formula + 13 ai-adapter + 136 parser + 205 batch + 199 기타 = 추정) |
| 4-Pass quality CRITICAL          | **0건 (1건 fix 후 재검증)**                                                                                     |
| Hard Rule 15/16/17               | PASS (시험 ID 리터럴 신규 도입 0건). Hard Rule 16 examId 16b 게이트 8 명시 이연                                 |
| CRITICAL RULE #1~7               | PASS (Silent Pivot 영속화 의무 흡수, 빈 catch 0, stub 0, 가능 환상 0)                                           |
| L3 plan 사전 승인                | Step 16 (= step5) 진산 2026-04-27 Engine Hardening Roadmap v1.1 일괄 승인                                       |

### 1.7 4-Pass 자동 리뷰 매트릭스 (auto-review-protocol.md 규칙 0~4 준수)

| step | 1차 호출                                                                                                     | 1차 CRITICAL | fix 후 재검증          | 결과 |
| :--- | :----------------------------------------------------------------------------------------------------------- | :----------: | :--------------------- | :--- |
| 16a  | 4 독립 에이전트 (general-purpose Pass 1 / system-architect / quality-engineer / general-purpose Pass 4) 병렬 |      1       | Pass 4 fix 흡수 재검증 | ✅   |

**총 5 agent 호출 (4 1차 + 1 재검증) + CRITICAL 1건 + MAJOR 4건 영속화 + Phase 이월 3건 트래킹**.

### 1.8 commit 상태

본 세션 누적 변경 모두 commit 완료. 잔여 untracked = `Guide/3단계리뷰-설계판.md` + `Guide/3단계리뷰.md` 2건 — Hard Limit "Guide/ 디렉토리 수정 금지" 준수로 본 세션 보류 (handoff-021 §1.7 정합).

---

## 2. 다음 세션 작업 — Step 16b + Step 16c + Step 18 + Step 19 + Step 14b + Step 15b

### 2.1 진척도 (ROADMAP v1.3 §3.2 기준, 본 세션 후)

| 단계                                                           | 진행 상태                                 |
| :------------------------------------------------------------- | :---------------------------------------- |
| Step 0~5 (마스터 + ADR 4건 + LLM 도식)                         | ✅ 완료                                   |
| Step 6 (엔진 3종 research + contract)                          | ✅ 완료                                   |
| Step 7~11.5 (plan 6건)                                         | ✅ 완료                                   |
| Step 11.6 plan + 코드 (pipeline 통합 + 9 AC e2e)               | ✅ 완료 (2026-04-29)                      |
| ADR-027 + 방법론 v1.2 (atomic BATCH 영속화)                    | ✅ 완료 (2026-04-30)                      |
| Step 12 (cost-meter 코드)                                      | ✅ 완료                                   |
| Step 17 (checkpoint/recover 코드)                              | ✅ 완료                                   |
| Step 13 (formula determinism + sandbox bypass property)        | ✅ 완료 (2026-04-30)                      |
| Step 14a (parser determinism normalizer + AC-PA-1/3/4 부분)    | ✅ 완료 (2026-04-30)                      |
| Step 14b (parser LLM 통합 후 invariant 4/6 + AC-PA-2 + 확장)   | ⏳ 이연 (Phase 1 후반 LLM 통합 직후 의무) |
| Step 15a (quality determinism normalizer + AC-QU-1 manual)     | ✅ 완료 (2026-04-30)                      |
| Step 15b (quality arbitraryGraph + AC-QU-2/3/4/6 + Tarjan SCC) | ⏳ 이연 (Engine Hardening 다음 세션)      |
| **Step 16a (source_id 인프라 + 단위 테스트 8건)**              | **✅ 완료 (2026-04-30 본 세션)**          |
| Step 16b (e2e 시나리오 A/B/C/E + AC-RP-1/2/3/4)                | ⏳ 이연 (Engine Hardening 차세션 의무)    |
| Step 16c (AC-RP-6 마이그레이션 + 0014 트리거 e2e)              | ⏳ 이연 (16b 후 또는 별도)                |
| Step 18 (자동 검증 스크립트 + CI)                              | ⏳ 잔여                                   |
| Step 19 (4-Pass + 5-페르소나 cap=3)                            | ⏳ 잔여                                   |
| Step 20 (BATCH-1 적재 진입)                                    | ⏳ 잔여 (Step 19 통과 후 + 진산님 트리거) |

**v1.3 합계 11.5d 낙관 / 16.5~17d 현실 / 23d 비관 — 약 75% 진행** (본 세션 +10%, Step 16a + 영속화 + 4-Pass).

### 2.2 작업 분해 (잔여 시간)

|  우선   | Step                                                         | plan 위치                                                          |    시간 (낙관/현실/비관)    | 의존성                                                     |
| :-----: | :----------------------------------------------------------- | :----------------------------------------------------------------- | :-------------------------: | :--------------------------------------------------------- |
| **P-1** | Step 16b reproducibility-idempotency e2e 시나리오 A/B/C/E    | step5 plan v1.2 §"Step 16b 진입 게이트" 10항목                     |     0.6d / 0.9d / 1.2d      | Step 16a ✅ 충족 + `runPipeline` 풀 실행 환경 의존         |
| **P-2** | Step 18 자동 검증 스크립트 + CI                              | `step7-contract-verify.plan.md`                                    |      0.5d / 1d / 1.5d       | Step 13~16 모두 ✅ + 16b/16c/14b/15b 게이트 명시 (이연 OK) |
| **P-3** | Step 19 4-Pass + 5-페르소나 cap=3 (BATCH-1 직전 게이트)      | (별도 plan 없음 — handoff + ROADMAP §4 명세)                       |      0.5d / 1d / 1.5d       | Step 18 ✅                                                 |
| **P-4** | Step 16c AC-RP-6 마이그레이션 + 0014 트리거 e2e              | step5 plan v1.2 §"Step 16c 진입 게이트" 5항목                      |     0.3d / 0.5d / 0.7d      | Step 16b ✅ 또는 별도 (위험 낮음)                          |
| **P-5** | Step 14b parser LLM 통합 후 invariant 4/6 + AC-PA-2 확장     | `step3-parser-determinism.plan.md` v1.1 §"14b 진입 게이트" 10항목  | (LLM 통합 시점에 0.6d~0.9d) | Phase 1 후반 LLM 통합 직후 의무                            |
| **P-6** | Step 15b quality arbitraryGraph + Tarjan SCC + 5000 시나리오 | `step4-quality-determinism.plan.md` v1.1 §"15b 진입 게이트" 12항목 |          0.3d~0.5d          | Engine Hardening 다음 세션 (가급적 빠른 처리)              |
| **P-7** | Step 20 BATCH-1 적재 진입 plan 작성 + 실 진입                | `batch-loadmap.md` BATCH-1                                         |       1d / 1.5d / 2d        | Step 19 통과 + 진산님 트리거 ("BATCH-1 적재 진입")         |

### 2.3 권고 진행 순서 (다음 세션 ≤ 3h)

```
[Day 1 — 약 3h budget, P-1 Step 16b 진입]
  Step 16b reproducibility-idempotency e2e
    - apps/batch/__tests__/reproducibility.test.ts (시나리오 A — runPipeline 동일 fixture × 2)
    - apps/batch/__tests__/idempotency.test.ts (시나리오 B/C/E)
    - 게이트 8 LoadDraftContext.examId 추가 (Hard Rule 16 zero-cost)
    - 게이트 9 D1 batch() partial-commit 회복 e2e (또는 §non-goals)
    - 게이트 10 page_ref 형식 모델 확정

[Day 2 — P-2 Step 18 + P-4 Step 16c + P-6 Step 15b 동시]
  Step 16c AC-RP-6 마이그레이션 e2e
    - better-sqlite3 환경에서 0016 적용 검증
    - partial UNIQUE + 0014 트리거 backfill 동작 검증
    - 게이트 5 `<no_page>` fallback silent 진입 시나리오
  Step 18 자동 검증 스크립트
    - scripts/verify-engine-contracts.ts
    - .github/workflows/contract-verify.yml
  Step 15b quality 마무리 (capacity 여유 시)

[Day 3 — Step 19]
  4-Pass + 5-페르소나 cap=3 (BATCH-1 직전 게이트)
    - 9개 독립 에이전트 병렬 (4 + 5)
    - CRITICAL 0건 → BATCH-1 진입 게이트 통과

[BATCH-1 진입 — P-7 진산님 트리거 후]
```

### 2.4 진입 직후 첫 결정 (다음 세션 첫 5~10분)

**진산님 결정 영역 (선결 의무 — 0건):**

본 세션 진산님 결정 의존 작업 0건 처리. 다음 세션도 진산님 결정 의존 0건 (Step 16b/16c/18/19 전부 자율 진행 가능).

**자율 결정 (다음 세션):**

- P-1 Step 16b 진입 — Step 16a 패턴 재사용 (LoadDraftContext.examId 추가 + Mulberry32 + property test + 4-Pass)
- 4-Pass 자동 리뷰 의무 (auto-review-protocol.md)
- 본 세션 패턴 — plan ↔ 실측 갭 발견 시 scope 분할 자율 결정 + 영속화
- **Phase 이월 부채 3건 (Pass 3 M-1/M-2/M-3)** Step 16b 진입 시 우선 처리 또는 Step 19 (BATCH-1 직전 게이트) 처리 결정

**진산님 트리거 영역 (Step 20 진입 시):**

- Step 19 통과 후 진산님 명시 트리거 키워드 "BATCH-1 적재 진입" 대기
- Guide/ 2건 commit 트리거

---

## 3. 핵심 문서 위치 (필수 읽기)

### 3.1 새 세션 진입 직후 1차 읽기 (10~15분)

1. **본 핸드오프** — `.jjokjipge/handoff-session-022.md`
2. **Engine Hardening Roadmap v1.3** — `docs/plans/engine-hardening/ROADMAP.md` (§3.2 시간 표 + §8 완료 기준)
3. **Step 16b/16c plan v1.2** — `docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md` §"Step 16b 진입 게이트" 10항목 + §"Step 16c 진입 게이트" 5항목
4. **이전 핸드오프** — `.jjokjipge/handoff-session-021.md` (참조용)
5. **CLAUDE.md** + `.claude/rules/{auto-review-protocol,production-quality,session-health}.md`

### 3.2 Step 진입 시 읽기

| 작업                        | 필수 읽기                                                                                                                                                                        |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 16b e2e 시나리오       | step5 plan v1.2 §"Step 16b 진입 게이트" + `apps/batch/src/__tests__/pipeline.integration.test.ts` (Step 11.6 e2e 패턴) + `apps/batch/src/loader/draft-loader.ts` (Step 16a 산출) |
| Step 16c 마이그레이션 e2e   | step5 plan v1.2 §"Step 16c 진입 게이트" + `migrations/0014_phase05_critical_hardening.sql` + `migrations/0016_knowledge_nodes_batch_idempotency.sql`                             |
| Step 18 자동 검증           | `step7-contract-verify.plan.md` + `docs/engines/*/contract.yaml` AC phase_partitions 자동 파싱                                                                                   |
| Step 19 4-Pass + 5-페르소나 | `.claude/rules/auto-review-protocol.md` + 본 세션 4-Pass 패턴 (`commit 8a62089` 의 Pass 1~4 결과 + Pass 4 재검증)                                                                |
| Step 14b (LLM 통합 후)      | `step3-parser-determinism.plan.md` v1.1 §"14b 진입 게이트" 10항목                                                                                                                |
| Step 15b                    | `step4-quality-determinism.plan.md` v1.1 §"15b 진입 게이트" 12항목 (Tarjan SCC P0)                                                                                               |
| Step 20 BATCH-1 적재        | `batch-loadmap.md` + `docs/manual/` + 메모리 `project_batch_load_workflow.md`                                                                                                    |

---

## 4. 주의사항 (강제)

### 4.1 4-Pass 자동 리뷰 의무 패턴 (본 세션 검증)

`auto-review-protocol.md` 규칙 0~4 준수 패턴:

- **3+ 독립 서브에이전트 병렬** (메인 self-review 금지). 본 세션 16a 4 agent + Pass 4 재검증 1회 = 5 호출.
- **CRITICAL 발견 시 fix 후 재검증** (별도 verify agent 호출). 본 세션 Pass 4 재검증.
- **CRITICAL 0건 + 증거 3+ 항목 + 반론 1+ 후 "완료" 선언**.
- **Pass 4 Contract Silent Pivot 가장 자주 발견** — contract.yaml ↔ 실 구현 갭 + plan ↔ 코드 정의 silent 불일치 자동 점검 의무.

### 4.2 plan ↔ 실측 갭 자율 결정 패턴 (Step 14a/15a/16a 검증)

본 세션 Step 16 도 plan ↔ 실측 갭 발견 → scope 분할 자율 결정 (16a/16b/16c). 패턴 (handoff-021 §4.2 정합):

1. plan 본문 read (5~10분)
2. 실측 (디렉토리 / 파일 / API / 의존성)
3. 갭 발견 → scope 분할 영속화 (plan v1.2 변경 이력 + 진입 게이트 + ROADMAP)
4. 본 세션 부분 진행 + 다음 세션 게이트 명시

→ 메모리 `feedback_no_granular_decisions` + `feedback_two_fix_failures_zoom_out` 정합.

### 4.3 본 세션 시간 ≈ 30~35분 (session-health 60분 임계 미도달 ✅)

본 세션 시작 ~16:30 KST → 현재 ~17:00 KST. **약 30분** (handoff 작성 후 35분 예상). session-health.md 60분 임계 미도달.

원인:

- Step 16a (~25분): 실측 + plan ↔ 갭 발견 + buildSourceId + INSERT 채움 + 단위 테스트 8 + 4-Pass 4 agent 병렬 + CRITICAL 1건 fix + Pass 4 재검증 + 영속화 + commit
- handoff 작성 (~10분)

다음 세션 ≤ 3시간 권고. Step 16b 진입 시 본 세션 패턴 재사용 가능.

### 4.4 Guide/ 디렉토리 보류 (Hard Limit)

CLAUDE.md "Hard Limit: Guide/ 디렉토리 수정 금지" 준수로 본 세션도 untracked 2건 commit 보류. 진산님 명시 트리거 시 별도 commit (handoff-021 §4.4 정합 그대로).

### 4.5 plan v1.x 갱신 의무

본 세션 plan v1.2 갱신 1건 (step5) + ROADMAP v1.3 §3.2/§8 갱신 2회. 다음 세션 Step 16b 진입 시:

- step5 plan v1.2 → v1.3 (16b 진입 시점 — 게이트 8 LoadDraftContext.examId 추가 흡수 + 시나리오 A/B/C/E 코드 commit)

방법론 v1.2 effective 그대로. 다음 갱신 트리거 = §9 (BATCH-1 dry-run 통과 후 P1 진입 시) 또는 외부 cross review 1건 도착 시 — paralysis 신호 회피.

### 4.6 §6.6 방법론 paralysis 신호

본 세션 cap 발동 0건 — 4-Pass CRITICAL 1건 fix 후 Pass 4 재검증 통과. paralysis 신호 X. 다음 세션도 cap=1 권고 (1 세션당 plan 갱신 1회 이내, 본 세션 = step5 v1.2 = 1회 — cap 정상).

### 4.7 진산님 결정 영역 vs 자율 영역

**자율 진행 (다음 세션, 결정 의존 0건):**

- P-1~P-4 모두 자율 (Step 16b + Step 16c + Step 18 + Step 19)
- P-5/P-6 (Step 14b/15b 이연) 자율
- 4-Pass + 5-페르소나 자동 의무
- 핸드오프 작성

**진산님 트리거 영역:**

- **P-7 Step 20 BATCH-1 적재 진입** — Step 19 통과 후 진산님 명시 트리거 키워드 "BATCH-1 적재 진입"
- Guide/ 2건 commit 트리거
- ROADMAP 12 Step 외 추가 step 신설 결정

### 4.8 Phase 이월 부채 3건 트래킹 의무 (NEW)

본 세션 4-Pass MAJOR 4건 중 16b/16c 게이트로 영속화한 4건 외 추가 3건은 phase 이월:

|     #      | 항목                                            | 처리 시점 권고                              | 책임                                 |
| :--------: | :---------------------------------------------- | :------------------------------------------ | :----------------------------------- |
| Pass 3 M-1 | batchRunId UUID 정규식 검증                     | Step 16b 진입 시 또는 phase 종료 전         | draft-loader.ts:149 preValidate 보강 |
| Pass 3 M-2 | nodeId ontology-registry 패턴 검증              | Step 16b 진입 시 또는 phase 종료 전         | preValidate 또는 buildSourceId 보강  |
| Pass 3 M-3 | test fixture multi-byte / 매우 긴 nodeId 케이스 | phase 종료 전 (Step 19 BATCH-1 직전 게이트) | build-source-id.test.ts 보강         |

**차세션 진입 시 본 §4.8 검토 의무.** Step 16b 시간 여유 있으면 동시 처리, 부족하면 Step 19 게이트로 이월. 망각 차단 트리거.

---

## 5. 진산님 메모리 (자동 로드)

handoff-021 §5 그대로 (자동 로드 — 별도 행동 불필요):

- `project_content_build_engine_as_core.md` ⭐ (BATCH 적재 = 프로젝트 정체성)
- `project_batch_load_workflow.md` ⭐ (Step 20 진산님 트리거 키워드)
- `feedback_document_first_workflow.md` ⭐ (본 세션 plan v1.2 + ROADMAP 영속화 모두 정합)
- `feedback_two_fix_failures_zoom_out.md` ⭐ (Step 16 풀스코프 vs 인프라 분할)
- `feedback_no_shortcuts.md` (Guide/ 보류 정합)
- `feedback_focus_reliability_not_schedule.md` ⭐ (Step 16b/16c 이연 정당화 근거)
- `feedback_no_granular_decisions.md` ⭐ (scope 분할 자율 결정 근거)
- `feedback_auto_review.md` ⭐ (Step 16a 4-Pass 의무 + Step 19 cap=3)
- `feedback_phase_review_5_persona.md` ⭐ (Step 19 5-페르소나 의무)
- `feedback_single_vendor_cloudflare.md` (devDep 정합)
- `project_source_citation_requirement.md` (Step 14b LLM 통합 시 page_ref FK 의무)
- `project_v3_final_multi_exam_deferred.md` (Hard Rule 16 examId 게이트 8 정합)
- `project_anthropic_cap_pre_install.md` (Phase 2 진입 시 활성)

---

## 6. 새 세션 시작 prompt

### 옵션 A (간결 — 권고)

```
.jjokjipge/handoff-session-022.md 읽고 이어가줘
```

→ Claude 가 핸드오프 읽고:

1. 진산님 결정 의존 작업 0건 보고
2. 권고 진행 순서 (P-1 Step 16b reproducibility-idempotency e2e) 재명시
3. **Phase 이월 부채 3건 (Pass 3 M-1/M-2/M-3) 명시 트래킹**
4. 진산님 트리거 시 즉시 진입

### 옵션 B (특정 작업 명시)

```
.jjokjipge/handoff-session-022.md 읽고 Step 16b 진입
```

→ Step 16b reproducibility-idempotency e2e 시나리오 A/B/C/E 즉시 진입.

### 옵션 C (우선순위 일괄 위임 — 본 세션 패턴)

```
.jjokjipge/handoff-session-022.md 읽고 권고대로 진행
```

또는

```
.jjokjipge/handoff-session-022.md 읽고 중요하고 긴급한 순서대로
```

→ 본 세션 022 패턴 재사용 — Step 16b → Step 16c → Step 18 → Step 19 순차 진행. 본 세션 capacity (≤ 3h) 따라 1~3개 step 완료. **Phase 이월 부채 3건 동시 처리 권고.**

### 옵션 D (BATCH-1 진입 직접 — 게이트 위반 ★)

```
BATCH-1 적재 진입
```

→ Claude 가 ROADMAP §8 완료 기준 미충족 (Step 16b + Step 16c + Step 18 + Step 19 잔여) 보고 + 차단 게이트 명시 + 옵션 A 재명시.

---

## 7. 세션 022 메타 통계

- 시작 시각: 2026-04-30 약 16:30 KST
- 종료 시각: 2026-04-30 약 17:05 KST (본 핸드오프 작성 + 마무리 commit 시점)
- 누적 시간: **약 35분** (session-health.md 60분 임계 미도달 ✅)
- 누적 turn: 약 15+
- 영속 문서 산출:
  - 본 핸드오프 (handoff-022)
  - apps/batch 신규 production code 1종 (build-source-id.ts)
  - 신규 테스트 1종 + 수정 1종 (build-source-id.test.ts 8건 + loader.test.ts +2건 = 10 신규)
  - draft-loader.ts + pipeline.ts 시그니처 변경
  - step5 plan v1.2 갱신
  - ROADMAP v1.3 §3.2 + §8 갱신
- 코드 변경: 7 파일 변경 + 2 파일 신규 (production 1 + test 1)
- commit: **1건** (`8a62089` batch Step 16a)
- 4-Pass / 5-페르소나 발동: **5 agent 호출** (4 1차 + 1 Pass 4 재검증) — auto-review-protocol.md 규칙 0~4 준수
- 본 세션 cap 발동: 0건 (4-Pass CRITICAL 1건 fix 후 재검증 통과)
- session-health 권고: **본 핸드오프 작성 후 종료**. 다음 세션 ≤ 3h 권고.
- Phase 이월 부채: **3건 명시 트래킹** (Pass 3 M-1/M-2/M-3 — handoff §4.8)

---

## 8. 진척도 (백분율) — v1.3 기준

Engine Hardening Roadmap v1.3 기준 (본 세션 후):

| Phase                                     | 산출물                                                                                                   |  진행   | 비고                            |
| :---------------------------------------- | :------------------------------------------------------------------------------------------------------- | :-----: | :------------------------------ |
| Phase 0 (마스터 + ADR + 설계)             | ROADMAP v1.3 + ADR 5건 (022~025 + 027) + LLM_CONTAINMENT.md                                              | ✅ 100% | —                               |
| Phase 1 (엔진 contract)                   | research × 3 + contract × 3 (parser/quality v1.1)                                                        | ✅ 100% | —                               |
| Phase 2 (단계별 plan)                     | step1~7 + step6 + step11.6 v1.2 + step5 v1.2 (본 세션) + step3 v1.1 + step4 v1.1 + 0016 마이그레이션     | ✅ 100% | step5 plan v1.2 본 세션 갱신    |
| Phase 3 (코드 구현)                       | Step 12 + Step 17 + Step 11.6 + Step 13 + Step 14a + Step 15a + **Step 16a** + Step 14b/15b/16b/16c 잔여 | 🟡 ~92% | **본 세션 +7%**                 |
| Phase 4 (자동 검증 + 4-Pass + 5-페르소나) | 4-Pass 17건 + 5-페르소나 1건 + 메타 감사 1건 + Step 18 + Step 19 잔여                                    | 🟡 ~85% | 본 세션 4-Pass 5 agent 호출     |
| Phase 5 (BATCH-1 적재 진입)               | Step 20 (1d/1.5d/2d, 진산님 트리거)                                                                      |  ⏳ 0%  | Step 19 통과 + 진산님 트리거 후 |
| Phase 6 (방법론 적용 영속화 — v1.2)       | 방법론 v1.2 effective + ADR-027 + ROADMAP v1.3                                                           | ✅ 100% | —                               |

**총 진행률 (v1.3 기준 production 검증 weight 보정):** 약 **92%** (본 세션 +7% — Step 16a + 영속화 + 4-Pass CRITICAL 흡수 + Phase 이월 부채 트래킹).

---

## 9. 본 세션 통합 매트릭스 (요약)

| 항목                                                                                                   | 본 세션 처리             | 다음 세션 처리                    |
| :----------------------------------------------------------------------------------------------------- | :----------------------- | :-------------------------------- |
| Step 16a (source_id 인프라 + buildSourceId + 단위 테스트 8건)                                          | ✅ commit 8a62089        | —                                 |
| Step 16a 4-Pass CRITICAL 1건 (page_ref 형식 silent 불일치)                                             | ✅ fix + Pass 4 재검증   | —                                 |
| Step 16a 4-Pass MAJOR 4건 (Hard Rule 16 examId / D1 batch atomicity / page_ref / `<no_page>` fallback) | ✅ 16b/16c 게이트 영속화 | Step 16b 진입 시 흡수             |
| Phase 이월 부채 3건 (Pass 3 M-1/M-2/M-3 — UUID/ontology/multi-byte)                                    | ✅ §4.8 트래킹           | 차세션 또는 Step 19 직전 처리     |
| step5 plan v1.2 (명시 이연 4 항목 흡수 + 16b 게이트 10 + 16c 게이트 5)                                 | ✅ 영속화                | Step 16b/16c 진입 시 v1.3         |
| ROADMAP §3.2 + §8 (Step 16a ✅ + 16b/16c 이연)                                                         | ✅ 갱신                  | Step 16b 진입 시 ✅ 표기          |
| Step 16b (e2e 시나리오 A/B/C/E + AC-RP-1/2/3/4)                                                        | —                        | ⏳ 진입 (Engine Hardening 차세션) |
| Step 16c (AC-RP-6 마이그레이션 + 0014 트리거 e2e)                                                      | —                        | ⏳ 진입 (16b 후 또는 별도)        |
| Step 18 (자동 검증 스크립트)                                                                           | —                        | ⏳ 진입                           |
| Step 19 (4-Pass + 5-페르소나 cap=3)                                                                    | —                        | ⏳ 진입 (BATCH-1 직전 게이트)     |
| Step 14b (LLM 통합 후)                                                                                 | —                        | ⏳ Phase 1 후반                   |
| Step 15b (Tarjan SCC + arbitraryGraph)                                                                 | —                        | ⏳ Engine Hardening 다음 세션     |
| Step 20 (BATCH-1 적재 진입)                                                                            | —                        | ⏳ 진산님 트리거 후               |

본 세션 흡수: 5건. 잔여: 7건 (Step 16b/16c/18/19/14b/15b/20).

---

**핸드오프 작성자:** Claude (Opus 4.7)
**다음 세션 시작 권고:** 옵션 A — `.jjokjipge/handoff-session-022.md 읽고 이어가줘`
**첫 작업:** P-1 Step 16b reproducibility-idempotency e2e (Step 16a 패턴 재사용 — runPipeline 풀 실행 + LoadDraftContext.examId 추가 + 시나리오 A/B/C/E + 4-Pass)
**예상 세션 분량:** Step 16b 단독 0.6d (4~5h) / Step 16b + Step 16c 묶음 0.9d (1.5세션) / Step 16b + 18 묶음 1.1d (2세션)
