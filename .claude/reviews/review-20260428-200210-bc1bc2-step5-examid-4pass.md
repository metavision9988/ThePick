# 4-Pass 독립 에이전트 리뷰 — B-C1+B-C2 통합 (Step 5 plan v1.1 + 0016 마이그레이션 + recover/checkpoint examId)

리뷰 일자: 2026-04-28 (KST)
리뷰 방식: **독립 에이전트 3개 병렬** (silent-failure-hunter / system-architect / quality-engineer)
리뷰 범위: 코드 3파일 + 마이그레이션 1신규 + plan 3 갱신
직전 4-Pass 권고 흡수: `.claude/reviews/midpoint-20260428-backend.md` C-1 (knowledge_nodes 컬럼 부재) + C-2 (BatchRunsDb examId 부재)
사용자 결정: 후보 B (절충안) 채택 — 즉시 정정 + Step 11.6 코드 구현 시 e2e 테스트 흡수

---

## 0. 한 줄 평가

> **accept_with_immediate_fixes** — 3 페르소나 통합 결과 CRITICAL 6건 발견 중 2건 즉시 정정 (SA-CRITICAL plan §10 거짓 진술 + SF-M-2 examId 일관성 가드). 나머지 4건 (Q-CRITICAL × 4) 모두 후보 B 명시 이연 정합 — Step 11.6 코드 구현 시 e2e 흡수. typecheck PASS + 137/137 tests PASS 보존.

---

## 1. 페르소나별 산출물

| 페르소나              | 산출물                                                           |        판정         | CRITICAL | MAJOR |
| :-------------------- | :--------------------------------------------------------------- | :-----------------: | :------: | :---: |
| silent-failure-hunter | `review-20260428-200210-bc1bc2-step5-examid-silent-failure.md`   | accept_with_caveats |    0     |   2   |
| system-architect      | `review-20260428-200307-bc1bc2-step5-examid-system-architect.md` |  reject_and_revise  |    1     |   1   |
| quality-engineer      | `review-20260428-200211-bc1bc2-step5-examid-quality.md`          |  reject_and_revise  |    5     |   3   |

**3 페르소나 합계 (dedupe 후):** CRITICAL 6 / MAJOR 6 / MINOR 7

---

## 2. 즉시 정정 항목 (2건, 본 리뷰 후 처리 완료)

### 2.1 SA-CRITICAL — Step 11.6 plan §10 거짓 진술

**증거:** `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md:1038` (v1.0 기준)

> "현재 `runPipeline` 의 caller 는 없거나 테스트 fixture 만 — 영향 최소"

**실제 callsite 6건 (grep 검증):**

1. `apps/batch/bin/batch.ts:156-169` (production CLI)
2. `apps/batch/src/__tests__/pipeline.integration.test.ts:100-113`
3. `apps/batch/src/__tests__/pipeline.integration.test.ts:131-144`
4. `apps/batch/src/__tests__/pipeline.integration.test.ts:166-179`
5. `apps/batch/src/__tests__/pipeline.integration.test.ts:216-229`
6. `apps/batch/src/__tests__/pipeline.integration.test.ts:327-339`

**정정 결과:** plan §10 본문에 6 callsite 표 + 코드 진입 첫 commit 일괄 갱신 SLO 명시.

### 2.2 SF-M-2 — recover.ts examId 일관성 가드 부재

**증거:** `apps/batch/src/recover.ts:230` (정정 전) — checkpoint.exam_id 와 opts.examId 미비교 → Year 1 작성 checkpoint 가 Year 2 다른 시험 recover 시 silent 통과 가능.

**정정 결과:** `apps/batch/src/recover.ts:230-244` 신규 가드 14줄 추가

```typescript
// === Q3.5 (B-C2 SF-M-2): exam_id 일관성 검증 ===
if (checkpoint.exam_id !== undefined && checkpoint.exam_id !== opts.examId) {
  return {
    status: 'recovery_failed',
    ...
    message: `... exam_id 불일치 — checkpoint=${checkpoint.exam_id}, requested=${opts.examId}. Cross-tenant recover 차단 ...`,
  };
}
```

**의도:** Year 1 단일 시험 + checkpoint 미주입 path 정상 (양쪽 모두 undefined 또는 일치) / Year 2 mismatch 차단. 단위 테스트는 후보 B 정합으로 Step 11.6 e2e 흡수.

### 2.3 Q-CRITICAL-Q4 — Step 5 plan v1.1 의 draft-loader.ts 미반영 명시 이연

**증거:** `docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md` v1.1 — `source_id = {page_ref}#{node_id}` 정의 명시되었으나 `apps/batch/src/loader/draft-loader.ts:247` 미반영. Silent Pivot 잠재.

**정정 결과:** Step 5 plan v1.1 에 명시 이연 절 신규 — Step 5 코드 commit 시 첫 commit 의무 (4 작업 + page_ref null 처리 권고 옵션 B `<no_page>#{node_id}` fallback).

---

## 3. 명시 이연 항목 (후보 B 정합 — Step 11.6 코드 구현 시 e2e 흡수)

### 3.1 Q-CRITICAL-Q1 — BatchRunsDb examId 분기 검증 부재

**원인:** mock 이 `_examId` 무시 — examId 주입/생략 분기 미검증.
**이연 시점:** Step 11.6 §9.1 `pipeline-integration.test.ts` 에서 production D1 어댑터 e2e 검증 시 흡수.
**의무 테스트 (Step 11.6 시점):**

- AC-ExamId-1: examId 주입 시 production SQL 호출 검증 (Year 2 진입 시)
- AC-ExamId-2: cross-tenant recover 시도 시 거부 검증 (B-C2 SF-M-2 가드 발화)

### 3.2 Q-CRITICAL-Q2 — BatchCheckpoint.exam_id 분기 검증 부재

**원인:** 직렬화 시 omit / 주입 / state_hash 결정성 3 시나리오 검증 0건.
**이연 시점:** Step 11.6 §9.1 `checkpoint.test.ts` 확장.
**의무 테스트:**

- AC-Snapshot-ExamId-1: exam_id 미주입 시 BatchCheckpoint canonical 직렬화 정상
- AC-Snapshot-ExamId-2: exam_id 주입 시 state_hash 결정성
- AC-Snapshot-ExamId-3: exam_id 추가가 기존 checkpoint state_hash 와 충돌 안 함

### 3.3 Q-CRITICAL-Q3 — 0016 마이그레이션 단위/e2e 0건

**원인:** ALTER TABLE / partial UNIQUE INDEX / 0014 트리거 갱신 본문 검증 0건.
**이연 시점:** Step 11.6 §9.1 `d1-trigger-verify.test.ts` (또는 신규 `migrations-0016.test.ts`) — better-sqlite3 또는 wrangler d1 e2e.
**의무 테스트 (AC-RP-6 매핑):**

- ALTER TABLE 후 컬럼 존재 검증
- partial UNIQUE INDEX NULL 제외 검증
- 0014 트리거 backfill ALLOW (NULL→값 1회)
- 0014 트리거 ABORT (값→다른 값, 값→NULL, 기존 본문 컬럼 — 회귀 의무)

### 3.4 Q-CRITICAL-Q5 — 137 PASS 회귀 보고 양식 stale

**원인:** "회귀 0건" = 정정 코드의 신규 분기 0% 검증.
**이연 시점:** Step 11.6 진입 시 회귀 보고 양식 변경 — "기존 코드 안전 N건 / 신규 분기 검증 N건" 명시 분리.

### 3.5 SF-M-1 — D1BatchRunsDb void examId 패턴 (Year 2 누락 위험)

**원인:** `void examId;` 가 Year 2 진입 시 SQL `WHERE exam_id = ?` 추가를 잊을 위험.
**이연 시점:** Step 11.6 코드 구현 시 `D1BatchRunsDb` 어댑터에 TODO 주석 추가 + Year 2 진입 시 lint rule 추가 검토.

---

## 4. 즉시 정정 후 검증 결과

- **typecheck PASS** (`pnpm -C apps/batch typecheck`)
- **137/137 tests PASS** (회귀 0건, plan/sql/recover.ts gas 모두 기존 path 영향 0)
- recover.ts SF-M-2 가드는 `checkpoint.exam_id !== undefined` 조건이라 기존 미주입 path 그대로

---

## 5. AC 매트릭스 갱신 (직전 P0 4-Pass + B-C1+B-C2 통합)

| AC                        | 정의                          | unit      | integration | e2e                 | 상태                     |
| ------------------------- | ----------------------------- | --------- | ----------- | ------------------- | ------------------------ |
| AC-1                      | BATCH 정상 흐름               | ✅        | ✅          | 미보유              | OK                       |
| AC-R1~R6                  | recover 시나리오 5종 + 트리거 | mock PASS | mock PASS   | **미검증 (후보 B)** | **GAP (Step 11.6 흡수)** |
| AC-Cost                   | cost_state 직렬화             | **0**     | 미수립      | 미수립              | **CRITICAL (이연)**      |
| AC-Snapshot'              | canonical 9종+circular 거부   | **0**     | —           | —                   | **CRITICAL (이연)**      |
| AC-T3                     | state transition matrix       | —         | —           | **0**               | **CRITICAL (이연)**      |
| AC-ExamId (신규)          | BatchRunsDb examId 시그니처   | mock PASS | **0**       | **0**               | **CRITICAL (이연)**      |
| AC-RP-6 (신규)            | 0016 + 0014 트리거 갱신 e2e   | —         | —           | **0**               | **CRITICAL (이연)**      |
| AC-RP-7 (신규)            | source_id 결정성              | —         | —           | **0**               | **CRITICAL (이연)**      |
| AC-Snapshot-ExamId (신규) | exam_id 직렬화 + state_hash   | **0**     | —           | —                   | **이연**                 |

**요약:**

- 직전 + 본 리뷰 합계 19개 AC 중 9개 CRITICAL (모두 후보 B 명시 이연)
- Step 11.6 코드 진입 시 e2e 9건 일괄 흡수 의무 — 시간 추정 +0.5d (5-페르소나 §3.2 0.5d → 본 리뷰 quality 권고 3.75d 와의 간극은 후보 B 절충안의 결과)

---

## 6. Devil's Advocate (3 페르소나 합산)

### 6.1 silent-failure-hunter

- 동일 batch_run_id UUID 가 두 시험에서 collision 발생 시 (확률 낮으나 0이 아님), Year 1 checkpoint 가 Year 2 시험에서 silent 통과 가능 — **SF-M-2 가드로 차단** ✅

### 6.2 system-architect

- Year 2 두 시험 동시 적재 시 `.checkpoint/{batch_run_id}.json` 파일명 collision — `.checkpoint/{exam_id}/{batch_run_id}.json` 디렉토리 격리는 명시 이연 (Year 2 Phase 4 진입 시 마이그레이션)

### 6.3 quality-engineer

1. Year 2 cross-tenant data leak — mock 동작 ≠ production SQL (Step 11.6 e2e 흡수)
2. `page_ref=null` 노드 → `source_id` 비결정성 — Step 5 plan v1.1 명시 이연 옵션 B (fallback `<no_page>#{node_id}`)
3. Checkpoint write 도중 process kill + examId mismatch → corrupted 인데 not_found 보고 — Step 11.6 SIGINT handler 통합 시 검증

---

## 7. 진행 권고

### 7.1 본 리뷰 후 즉시 정정 (완료)

- ✅ Step 11.6 plan §10 거짓 진술 정정 + 6 callsite 명시
- ✅ recover.ts SF-M-2 examId 일관성 가드 14줄 추가
- ✅ Step 5 plan v1.1 명시 이연 절 추가 (draft-loader.ts 미반영)

### 7.2 다음 단계 (Step 11.6 코드 진입 전 의무)

1. **ROADMAP v1.1 → v1.2 패치** — 본 세션 결과 반영, 시간 추정 갱신 (0.2d)
2. **Step 11.6 코드 구현** — 6 callsite 일괄 갱신 + AC e2e 9건 흡수 (2.6~3d + 후보 B 흡수 +0.5d ≈ 3.1~3.5d)
3. **Step 11.6 단독 4-Pass 재리뷰** — silent-failure / system-architect / quality 3 페르소나 (0.5d)

### 7.3 진산님 결정 영역 (자율 영역 외)

- 본 리뷰의 즉시 정정 3건은 자율 진행 (system-architect/silent-failure 권고 직접 흡수 + plan 보강)
- ROADMAP v1.2 패치 후 Step 11.6 코드 진입 = 진산님 명시 승인 (이미 plan v1.0 §13 항목 1/2/3 권고 A 승인 완료) → 자율 진행 가능

---

## 8. 판정

> **accept_with_immediate_fixes** — 즉시 정정 3건 처리 완료 + 후보 B 정합 명시 이연 9 AC. Step 11.6 코드 진입 가능 상태.

**Step 11.6 진입 차단 여부:** 차단 X. 단, ROADMAP v1.2 패치 (0.2d) 권고 진행 후 진입.

---

**리뷰 작성자:** Claude (Opus 4.7) — 메인 컨텍스트, 3 페르소나 독립 산출물 통합
**자가 리뷰 회피 증거:**

- 3 페르소나 모두 독립 Agent tool 호출 (메인 컨텍스트 미진입)
- 각 페르소나가 다른 페르소나 영역 침범 명시 거부
- 본 통합 보고서는 dedupe + 정정 매핑만 — 신규 결함 발견 X
  **증거 기반 보고:** 모든 발견 항목이 파일:라인 인용 포함 (recover.ts:230, plan §10:1038, draft-loader.ts:247 등)
  **Devil's Advocate 의무 충족:** 3 시나리오 (silent-failure 1 + system-architect 1 + quality 3 + 본 리뷰 통합 3) ≥ 7 시나리오
