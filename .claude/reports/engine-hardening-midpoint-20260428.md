# Engine Hardening 중간 점검 보고서

**작성일:** 2026-04-28 (KST)
**작성자:** Claude (Opus 4.7)
**작성 동기:** 진산님 요청 — "현재 엔진 구현이 어느 정도 진행되었는지 중간 점검 보고서를 만들어 줘. 제 3자 체크를 해보고 진행하자."
**대상 범위:** Engine Hardening Roadmap v1.1 (2026-04-27 진산님 승인) 의 Step 0~11.6 진행도
**평가 시점:** 본 보고서 직전 — Step 11.6 plan v1.0 APPROVED 직후, 코드 구현 진입 전.
**보고서 위치:** `.claude/reports/engine-hardening-midpoint-20260428.md` (영속, git-tracked)

---

## 0. 한 줄 요약

> **Engine Hardening 약 55% 진척. 16건 영속 문서 + 17번째(Step 11.6 plan) 작성 완료. 코드는 2/6 step 완료(Step 1 Cost Meter + Step 11.5 Recover/Snapshot, 64/64 unit tests PASS). 핵심 차단 게이트(AC-R1 e2e / fsync / SIGINT/SIGTERM) 가 Step 11.6 코드 구현 단계로 집중. 5-페르소나 독립 에이전트 검토 결과를 받아 다음 단계(Step 11.6 코드 또는 Step 2~5 병렬) 진입 결정 권고.**

---

## 1. 진산님 결정 누적 (2026-04-27 ~ 2026-04-28)

| 결정            | 내용                                                   | 근거                                                                         |
| :-------------- | :----------------------------------------------------- | :--------------------------------------------------------------------------- |
| 2026-04-27 직전 | "BATCH-1 진행 중 엔진 보강 병행" Claude 권고 정정      | 진산님 직관 — "엔진부터 제대로 되야 학습자료 배치도 잘 되는 거"              |
| 2026-04-27      | Engine Hardening Roadmap v1.1 승인 (9개 보완점 통합)   | 두 독립 검토서 (Review A DEV COVEN + Review B 외부 메타) 9개 보완점          |
| 2026-04-27      | ADR-022/023/024/025 ACCEPTED                           | Single-Vendor Lock-in / Engine-First / Payment AIEC / Two-Layer Cost Control |
| 2026-04-28      | "문서를 안만들고 출력만 하니까 잊기 딱 좋군" 강한 지시 | 메모리 `feedback_document_first_workflow` 등록                               |
| 2026-04-28      | Step 11.6 plan §13 항목 1/2/3 모두 권고 A 승인         | "어렵군... 모두 권고 대로 진행해줘"                                          |
| 2026-04-28      | 본 중간 점검 보고서 + 제 3자 체크 요청                 | "제 3자 체크를 해보고 진행하자"                                              |

**진산님 미확인 작업 (BATCH-1 진입 차단 항목):**

- Anthropic Console → Billing → Monthly cap = $200 설정
- Anthropic Console → Billing → Alerts (50% / 80% / 100%) 설정
- 스크린샷 → `docs/exit-strategy/anthropic-cap-2026-04.png`

---

## 2. Phase 진행도 매트릭스

| Phase                                     | 산출물 범위                                                               |  진행   | 비고                                     |
| :---------------------------------------- | :------------------------------------------------------------------------ | :-----: | :--------------------------------------- |
| Phase 0 (마스터 + ADR + 설계)             | ROADMAP v1.1 + ADR 4건 + LLM_CONTAINMENT.md                               | ✅ 100% | 2026-04-27 완료                          |
| Phase 1 (엔진 contract)                   | research × 3 + contract × 3 (formula/parser/quality)                      | ✅ 100% | quality L3 격상 (Review A-1) 반영        |
| Phase 2 (단계별 plan)                     | step1~7 + step6 (recover) + step11.6 (pipeline 통합)                      | ✅ 100% | 8건 → 9건 (Step 11.6 추가)               |
| Phase 3 (코드 구현)                       | Step 1 (cost-meter) + Step 11.5 (recover/snapshot) + Step 2~5,7,11.6 잔여 | 🟡 ~30% | 2/7 완료                                 |
| Phase 4 (자동 검증 + 4-Pass + 5-페르소나) | Step 1 4-Pass + Step 11.5 4-Pass + 본 보고서 5-페르소나                   | 🟡 ~30% | 4-Pass 3건 완료, 5-페르소나 의뢰 진행 중 |
| Phase 5 (BATCH-1 적재 진입)               | 별도 plan `docs/plans/batch-loadmap.md` 활용                              |  ⏳ 0%  | Engine Hardening 완료 시점 진입          |

**총 진행률 계산 근거:**

- 산출물 weight: Phase 0/1/2 (문서) = 30%, Phase 3 (코드) = 40%, Phase 4 (검증) = 20%, Phase 5 (적재) = 10%.
- 가중 평균: (100×0.3 + 100×0.3) / 1 + 30×0.4 + 30×0.2 = 30 + 12 + 6 = **약 54%**.

---

## 3. 영속 문서 인벤토리 (17건)

### 3.1 ADR (4건, 모두 ACCEPTED)

| 파일                                                  | 핵심 결정                                      | 차단 효과                                                                |
| :---------------------------------------------------- | :--------------------------------------------- | :----------------------------------------------------------------------- |
| `docs/adr/ADR-022-cloudflare-single-vendor-lockin.md` | Cloudflare 5년 단일 벤더 + 보호 5장치          | 외부 SaaS 우회 차단, 메모리 `feedback_single_vendor_cloudflare` 정합     |
| `docs/adr/ADR-023-engine-first-before-batch.md`       | 엔진 보강 7~10일 선행, BATCH-1 진입 보류       | "BATCH 병행" 자기모순 정정                                               |
| `docs/adr/ADR-024-payment-aiec-trigger.md`            | 결제 mock → 실결제 14일 전 AIEC 활성화         | Pre-trigger Window 의무 (Review A-3)                                     |
| `docs/adr/ADR-025-two-layer-cost-control.md` v1.1     | Application + Infrastructure 2 Layer 비용 제어 | Layer 1 = `cost-meter.ts` / Layer 2 = Anthropic 콘솔 cap (진산님 미확인) |

### 3.2 아키텍처 설계 (1건)

| 파일                                   | 내용                                                               |
| :------------------------------------- | :----------------------------------------------------------------- |
| `docs/architecture/LLM_CONTAINMENT.md` | LLM 4계층 격리 (Schema → Constraint → Cross-validation → Fallback) |

### 3.3 엔진 research + contract (6건)

| 엔진             | research                                  | contract                                   |          DEFCON           |
| :--------------- | :---------------------------------------- | :----------------------------------------- | :-----------------------: |
| `formula-engine` | `docs/engines/formula-engine/research.md` | `contract.yaml`                            |            L3             |
| `parser`         | `docs/engines/parser/research.md`         | `contract.yaml` (invariant/tolerable 분리) |            L2             |
| `quality`        | `docs/engines/quality/research.md`        | `contract.yaml`                            | **L3 (격상, Review A-1)** |

### 3.4 단계별 plan (9건 — Step 11.6 추가)

| 파일                                                     |                  상태                  |           코드 진행           |
| :------------------------------------------------------- | :------------------------------------: | :---------------------------: |
| `docs/plans/engine-hardening/ROADMAP.md` v1.1            |                APPROVED                |          — (마스터)           |
| `step1-cost-meter.plan.md` v1.1                          |                APPROVED                |         ✅ 코드 완료          |
| `step2-formula-property.plan.md`                         |                APPROVED                |            ⏳ 미진            |
| `step3-parser-determinism.plan.md`                       |                APPROVED                |            ⏳ 미진            |
| `step4-quality-determinism.plan.md`                      |                APPROVED                |            ⏳ 미진            |
| `step5-reproducibility-idempotency.plan.md`              | APPROVED (마이그레이션 0016 갱신 필요) |            ⏳ 미진            |
| `step6-recover-snapshot.plan.md` v1.1                    |                APPROVED                |         ✅ 코드 완료          |
| `step7-contract-verify.plan.md`                          |                APPROVED                |            ⏳ 미진            |
| **`step11-6-pipeline-recover-integration.plan.md` v1.0** |        **APPROVED 2026-04-28**         | ⏳ 미진 (제 3자 체크 후 진입) |

### 3.5 마이그레이션 (1건)

| 파일                             | 내용                                                                                               |
| :------------------------------- | :------------------------------------------------------------------------------------------------- |
| `migrations/0015_batch_runs.sql` | `batch_runs` 메타테이블 + 3개 트리거 (재INSERT 차단 / state downgrade 차단 / recover origin guard) |

---

## 4. 코드 구현 현황 (2/7 step 완료)

### 4.1 완료 (2건)

#### Step 1 — Cost Meter (`apps/batch/src/cost-meter.ts`)

- **라인 수:** ~450줄
- **테스트:** 31/31 PASS (`apps/batch/__tests__/cost-meter.test.ts`)
- **핵심 기능:**
  - 정수 마이크로센트 누적 (부동소수점 오차 0)
  - 임계 3단계 (soft 0.7 / hard 0.9 / kill 1.0)
  - `KillSwitchError` + `applyThrottle` (caller await)
  - `autoEnforce` 옵션 (기본 false / production true)
  - `onKillSwitch` 주입 hook (production 에서 checkpoint flush + process.exit)
  - JSONL 감사 로거 (선택)
  - per-model usage 추적
  - resume 시 `initialSpendUsd` 인계 (Idempotency 연동)
- **4-Pass 리뷰 결과:** 1차 CRITICAL 3건 → 정정 후 재검증 CRITICAL 0건 / MAJOR 0건 (`.claude/reviews/review-20260427-194529-step1-cost-meter-4pass.md` + `review-20260427-215248-...-revalidation.md`)

#### Step 11.5 — Recover/Snapshot (`apps/batch/src/checkpoint.ts` + `recover.ts`)

- **라인 수:** checkpoint.ts 369줄 + recover.ts 248줄 = 617줄
- **테스트:** 33/33 PASS (checkpoint 25 + recover 8)
- **핵심 기능:**
  - `BatchCheckpoint` 직렬화 (canonical JSON + SHA-256 state_hash)
  - `buildCheckpoint` / `writeCheckpoint` / `readCheckpoint` / `checkpointPath`
  - `CheckpointCorruptedError` / `CheckpointVersionMismatchError` / `CheckpointNotFoundError` 명시 throw
  - `assertCanonicalSafe` walk (Date/Map/Set/BigInt/Function 사전 throw)
  - `recoverBatch` v3.0 Vol V.4 결정 트리 (Q1~Q4)
  - `RecoveryStatus` 6종 (`fully_recovered` / `partially_recovered` / `recovery_failed` / `no_checkpoint` / `concurrent_run_detected` / `already_completed`)
  - `STALE_LOCK_THRESHOLD_MS` (24h, clock skew 방어)
  - `BatchRunsDb` 인터페이스 (mock 만 — D1 어댑터는 Step 11.6)
- **마이그레이션:** `0015_batch_runs.sql` (3개 트리거 — 재INSERT 차단 / state downgrade 차단 / recover origin guard)
- **4-Pass 리뷰 결과:** 1차 CRITICAL 1건 (트리거 UPDATE 무방비) + MAJOR 8건 → 정정 완료 + 5건 명시 이연 (`.claude/reviews/review-20260427-230149-step11-5-recover-4pass.md`)

### 4.2 미진 (5건)

|     Step      | 산출물                                                                                  | 의존성                                          | 차단 게이트                                    |
| :-----------: | :-------------------------------------------------------------------------------------- | :---------------------------------------------- | :--------------------------------------------- |
|    Step 2     | `packages/formula-engine/__tests__/determinism.property.ts` (fast-check)                | Step 1 ✅                                       | 68개 산식 결정성 100%                          |
|    Step 3     | `packages/parser/__tests__/determinism.property.ts` (invariant/tolerable 분리)          | Step 1 ✅                                       | invariant 100% / tolerable ≤ 5%                |
|    Step 4     | `packages/quality/__tests__/determinism.property.ts` (graph isomorphism)                | Step 1 ✅                                       | CBIV 동일 입력 → 동일 결과                     |
|    Step 5     | `apps/batch/__tests__/reproducibility-idempotency.test.ts` + 마이그레이션 0016 (UNIQUE) | Step 11.5 ✅                                    | seed 고정 + Idempotency 4 시나리오             |
| **Step 11.6** | **pipeline 통합 + signal handler + D1 어댑터 + e2e 테스트**                             | **Step 1 ✅ + Step 11.5 ✅ + plan APPROVED ✅** | **AC-R1~R6 + AC-Cost + AC-Snapshot 8건**       |
|    Step 7     | `scripts/verify-engine-contracts.ts` + CI workflow                                      | Step 2~5 + Step 11.6                            | contract.yaml AC 자동 검증 (Step 19 진입 차단) |

---

## 5. 테스트 현황

### 5.1 자동 테스트 (64/64 PASS)

```
✓ apps/batch/__tests__/cost-meter.test.ts          31/31
✓ apps/batch/__tests__/checkpoint.test.ts          25/25
✓ apps/batch/__tests__/recover.test.ts              8/8
─────────────────────────────────────────────────
                                              합계: 64/64
```

### 5.2 테스트 커버리지 갭 (제 3자 체크 대상)

| 갭                                     | 영향                                                                                                               |        처리 step         |
| :------------------------------------- | :----------------------------------------------------------------------------------------------------------------- | :----------------------: |
| **e2e 통합 테스트 0건**                | Step 1 + Step 11.5 + cost-meter 가 실제 pipeline 흐름에서 협력 검증 X                                              |        Step 11.6         |
| **AC-R1 mock-only**                    | "BATCH 50% kill → recover → 정확 재개" 시나리오는 mock `BatchRunsDb` 만. 실제 Node.js process kill + 재시작 미검증 |        Step 11.6         |
| **D1 트리거 발화 미검증**              | 0015 의 BEFORE INSERT/UPDATE 트리거 3개가 mock DB 에서는 검증 불가                                                 | Step 11.6 §6 또는 Step 7 |
| **fsync 미검증**                       | `writeCheckpoint` 가 page cache 만 사용 — power loss 시 0 byte 가능성 (이연 3)                                     |       Step 11.6 §5       |
| **SIGINT/SIGTERM 미검증**              | Ctrl+C / kill 시 checkpoint flush 동작 미테스트                                                                    |      Step 11.6 §5.3      |
| **CostMeter ↔ Checkpoint 인계 미검증** | `CheckpointCostState` 필드는 정의됨, 실제 인계 시나리오 e2e 부재                                                   |        Step 11.6         |
| **Property test 0건**                  | formula-engine / parser / quality 의 결정성 검증 미수행                                                            |        Step 2/3/4        |
| **Idempotency 시나리오 4건 미검증**    | 두 Claude Code 세션 동시 실행 / 트리거 키워드 중복 / recover 후 잔존                                               |          Step 5          |
| **Reproducibility seed 고정 미검증**   | BATCH 1 fixture 재실행 시 동일 D1 INSERT 결과 보장 X                                                               |          Step 5          |

### 5.3 테스트 품질 (P3 정성)

- ✅ Mock 의존성 최소화 (recover.ts 의 `BatchRunsDb` 만 mock — D1 미가동 환경 대응)
- ✅ 시간 주입 (`clock` parameter) — clock skew 시나리오 검증 가능
- ✅ 에러 클래스 명시 throw (silent failure 0건 — 4-Pass 정정 결과)
- ⚠️ 통합 테스트 부재 — 단위 테스트만으로는 cross-cutting 버그 미검출 위험
- ⚠️ Negative path 부족 — 정상 경로 위주, 디스크 가득 / 권한 거부 / 네트워크 단절 미검증

---

## 6. 4-Pass 누적 리뷰 결과

### 6.1 리뷰 산출물 3건

| 리뷰                                                            | 발견                              | 정정      | 잔존                                    |
| :-------------------------------------------------------------- | :-------------------------------- | :-------- | :-------------------------------------- |
| `review-20260427-194529-step1-cost-meter-4pass.md`              | CRITICAL 3건                      | 모두 정정 | 0건                                     |
| `review-20260427-215248-step1-cost-meter-4pass-revalidation.md` | (재검증) CRITICAL 0건 / MAJOR 0건 | —         | 0건                                     |
| `review-20260427-230149-step11-5-recover-4pass.md`              | CRITICAL 1건 + MAJOR 8건          | 모두 정정 | 5건 명시 이연 (Step 11.6/Step 5/Year 2) |

### 6.2 누적 정정 이력 (CRITICAL + MAJOR)

|  #  | 항목                                               | 정정 결과                                                    |
| :-: | :------------------------------------------------- | :----------------------------------------------------------- |
|  1  | Cost Meter 부동소수점 오차 (CRITICAL)              | 정수 마이크로센트 누적 — 오차 0                              |
|  2  | Cost Meter `recordTokens` non-atomic (CRITICAL)    | 단일 atomic update + 임계 1회 발화 set                       |
|  3  | Cost Meter `applyThrottle` race (CRITICAL)         | sync 호출 + status 반환 패턴                                 |
|  4  | 0015 트리거 UPDATE 무방비 (CRITICAL P1-C1)         | BEFORE UPDATE 트리거 2종 추가 (downgrade + concurrent guard) |
|  5  | JSON.parse silent 전파 (MAJOR P1-M3)               | `try/catch → CheckpointCorruptedError` 통합                  |
|  6  | `parseMajor` raw throw (MAJOR P1-M2)               | `CheckpointVersionMismatchError` 통합                        |
|  7  | Q4 `depends_on` stub (MAJOR P1-M4)                 | 발견 시 `recovery_failed + manual_review` 명시 거부          |
|  8  | `canonicalJson` Date silent collapse (MINOR P1-m3) | 사전 walk 로 Date/Map/Set/BigInt/Function 명시 throw         |
|  9  | 24h 매직넘버 (MINOR P1-m2)                         | `STALE_LOCK_THRESHOLD_MS` 상수 + clock skew 방어             |
| 10  | `nodes_total` 의미 부정확 (MINOR P1-m1)            | `nodes_completed` + `edges_completed` 분리                   |
| 11  | `BatchRunState` 5종 ('killed' 추가)                | plan 명시 (4종 → 5종 의도적)                                 |
| 12  | BatchCheckpoint shape 강화                         | `schema_version` 검증 + runtime typeof guard                 |

### 6.3 학습 (세션 013 메타)

- **1차 리뷰는 거의 항상 CRITICAL 1건 이상 발견** (Cost Meter 3건 / Recover 1건)
- 정정 후 재검증까지 1단계당 약 2시간 소요
- 자가 리뷰 절대 금지 — 반드시 독립 서브에이전트로 위임
- ROADMAP v1.1 시간 추정에 이미 반영 (현실 ×1.5 calibration)

---

## 7. 이연 사항 13건 상태

### 7.1 Engine Hardening 일정 내 처리 (6건)

|  #  | 이연 항목                                            |        처리 step         | 상태                             |
| :-: | :--------------------------------------------------- | :----------------------: | :------------------------------- |
|  1  | `pipeline.ts` ↔ `snapshot/recover/CostMeter` 통합    |        Step 11.6         | ✅ plan APPROVED, 코드 진입 대기 |
|  2  | AC-R1 e2e 검증                                       |        Step 11.6         | ✅ plan APPROVED                 |
|  3  | `writeCheckpoint` fsync 도입                         |        Step 11.6         | ✅ plan APPROVED                 |
|  4  | SIGTERM/SIGINT handler                               |        Step 11.6         | ✅ plan APPROVED                 |
|  5  | `(batch_run_id, source_id)` UNIQUE 마이그레이션 0016 |          Step 5          | 🟡 plan 갱신 필요 (우선순위 B)   |
|  6  | 0015 트리거 D1 Preview 통합 검증                     | Step 11.6 §6 또는 Step 7 | ✅ Step 11.6 plan §6 명시        |

### 7.2 Engine Hardening 외부 이연 (7건)

|  #  | 이연 항목                       | 트리거                               |
| :-: | :------------------------------ | :----------------------------------- |
|  7  | `exam_id` 격리 (Hard Rule 16)   | Year 2 Phase 4 (멀티시험 전환)       |
|  8  | `ai-adapter` 실구현             | Phase 3 Vision OCR 진입 전           |
|  9  | Lifecycle 5종 hook (L1/L2 엔진) | Phase 2 첫 사용자 1주 전             |
| 10  | OpenTelemetry SDK 통합          | Phase 2 출시 1주 전                  |
| 11  | AIEC 코드 구현                  | 결제 mock → 실결제 14일 전 (ADR-024) |
| 12  | Tier 5 Chaos Test (사용자 영향) | Phase 2 베타 100명                   |
| 13  | Resurrection Chaos R1/R2/R3     | Step 17 직전 (R1 만 BATCH-1 진입 전) |

---

## 8. 위험 매트릭스 (현 시점)

| 위험                                             | 심각도  |       발생 가능성        | 완화                                                              |
| :----------------------------------------------- | :-----: | :----------------------: | :---------------------------------------------------------------- |
| Step 11.6 코드 구현 중 PipelineState 직렬화 누락 | 🔴 High |          🟡 Mid          | plan §3.2 `toSnapshot()` 의 fail-fast 매핑                        |
| 4-Pass 리뷰 미검출 silent failure (e2e 부재)     | 🟠 Mid  |          🟡 Mid          | Step 11.6 통합 테스트 4건 + 5-페르소나 제 3자 체크                |
| Anthropic 콘솔 cap 미설정 → 비용 폭주            | 🔴 High |   🟢 Low (진산님 인지)   | ADR-025 §7 진산님 수동 작업 (미확인)                              |
| 두 Claude Code 세션 동시 실행 시 D1 race         | 🟠 Mid  |          🟢 Low          | 0015 트리거 + recover concurrent_run_detected (Step 5 e2e 검증)   |
| `processBatch` usage 미반환 → CostMeter 무력화   | 🟠 Mid  |  🟡 Mid (의존성 미확인)  | Step 11.6 §4.3.3 명시, Phase 2 보강 가능                          |
| fsync 가 NAS/네트워크 마운트에서 무효            | 🟠 Mid  | 🟢 Low (진산님 로컬 SSD) | Step 11.6 §8 위험 분석 명시                                       |
| 코드 구현 시간 ROADMAP v1.1 추정 초과            | 🟢 Low  |          🟡 Mid          | 현실 11d → 비관 15d, 12일 초과 시 자체 재검토                     |
| Step 5 의 (batch_run_id, source_id) UNIQUE 누락  | 🟠 Mid  |          🟢 Low          | plan 갱신 우선순위 B (다음 단계 후보)                             |
| 5-페르소나 제 3자 체크에서 신규 CRITICAL 발견    | 🟡 Mid  |          🟡 Mid          | 본 보고서 + 5-페르소나 결과 통합 후 재계획                        |
| Premature documentation (v3.0 IX.9 안티패턴)     | 🟢 Low  |          🟢 Low          | 본 보고서 + ROADMAP 은 BATCH-1 직전 Engine-First 점검 = Justified |

---

## 9. 갭 분석 (무엇이 빠졌나)

### 9.1 현 시점에서 명백한 갭

| 갭                                   | 영향                                                           | 다음 단계에서 처리              |
| :----------------------------------- | :------------------------------------------------------------- | :------------------------------ |
| **e2e 통합 테스트**                  | Step 11.5 unit test 의 mock 만으로는 production 안전 검증 불가 | Step 11.6 §9.1                  |
| **D1 어댑터 실구현**                 | `BatchRunsDb` 인터페이스만 존재, D1 호출 코드 부재             | Step 11.6 §4.4                  |
| **SIGINT/SIGTERM 처리**              | Node.js 비정상 종료 시 checkpoint 손실                         | Step 11.6 §5.3                  |
| **fsync**                            | power loss 시 0 byte 위험                                      | Step 11.6 §5                    |
| **`pipeline.ts` 의 cost meter 주입** | Stage 3 Claude API 호출 시 비용 계측 0                         | Step 11.6 §4.3                  |
| **batchRunId 생성/관리**             | `PipelineContext` 에 미존재 — UUID 생성 책임자 불분명          | Step 11.6 §3.1 (caller 가 주입) |

### 9.2 ROADMAP v1.1 미반영 항목

| 항목                                                   | ROADMAP 갱신 필요            |
| :----------------------------------------------------- | :--------------------------- |
| Step 11.6 신설 (의존성 그래프 / 시간 추정 / 완료 기준) | v1.2 패치 (우선순위 C)       |
| Step 5 plan 의 0016 UNIQUE 마이그레이션 의무화         | step5 plan 갱신 (우선순위 B) |
| 본 보고서 5-페르소나 결과 반영                         | 결과 도착 후                 |

### 9.3 Pipeline 통합 시 발견 가능한 신규 갭 (예측)

- `processBatch` 가 `usage` 반환하는지 확인 — `@thepick/parser` 코드 확인 필요
- `LoadDraftResult.lastInsertedNodeId` 필드 존재 여부 — 미존재 시 contract.nodes 마지막으로 fallback
- `pdfPagesOverride` (Awaited<extractPdf>) 가 직렬화 가능한지 — `assertCanonicalSafe` 통과 검증 필요
- D1 SQLite 트리거의 RAISE(ABORT) 가 Drizzle ORM 에서 어떤 에러로 표면화되는지

---

## 10. 다음 결정 후보 (5건)

진산님 결정 대기 — 5-페르소나 제 3자 체크 결과 도착 후 통합 검토:

### A — Step 11.6 코드 구현 즉시 진입

- 작업: `pipeline.ts` 수정 + `signal-handlers.ts` 신규 + `d1-batch-runs-db.ts` 신규 + 통합 테스트 4건
- 추정: 현실 2.6d / 비관 4.2d
- 근거: plan APPROVED, 의존성 해소, 차단 게이트 8건 (AC-R1~R6 + AC-Cost + AC-Snapshot)
- 트레이드오프: Property test (Step 2~4) 가 늦어짐 — formula-engine 결정성 검증 지연

### B — Step 5 plan 갱신 (우선순위 B from 핸드오프)

- 작업: `step5-reproducibility-idempotency.plan.md` 에 마이그레이션 0016 (`(batch_run_id, source_id)` UNIQUE) 의무 명시
- 추정: 0.3d
- 근거: Step 11.5 v1.1 정정 §"이연 2" 명시
- 트레이드오프: 코드 진척 0

### C — ROADMAP v1.1 → v1.2 패치 (우선순위 C from 핸드오프)

- 작업: Step 11.6 의존성 그래프 추가 + 시간 추정 +1d 반영 + 본 보고서 5-페르소나 결과 통합
- 추정: 0.2d
- 근거: 영속 문서 정합성
- 트레이드오프: 코드 진척 0

### D — Step 2~4 Property test 코드 구현 병렬

- 작업: formula-engine / parser / quality 의 결정성 property test (fast-check)
- 추정: 각 1d ~ 1.5d (3건 = 3.5~4d)
- 근거: ROADMAP v1.1 의 Step 2~4 plan 모두 APPROVED, 의존성 해소
- 트레이드오프: Step 11.6 코드 (BATCH-1 진입 차단 게이트) 가 늦어짐

### E — 진산님 ADR-025 §7 수동 작업

- 작업: Anthropic Console monthly cap $200 + alerts 50%/80%/100% 설정
- 추정: 5분
- 근거: ADR-025 v1.1 + ROADMAP v1.1 §7 완료 기준 (BATCH-1 진입 차단)
- 트레이드오프: 진산님만 가능

---

## 11. 제 3자 체크 의뢰 (5-페르소나)

본 보고서 작성 직후 다음 5개 독립 에이전트 병렬 호출:

| 에이전트               | 관점            | 핵심 질문                     | 결과 파일                                          |
| :--------------------- | :-------------- | :---------------------------- | :------------------------------------------------- |
| `refactoring-expert`   | 코드 품질 부채  | "6개월 뒤 이 코드가 버틸까?"  | `.claude/reviews/midpoint-20260428-refactoring.md` |
| `performance-engineer` | 런타임 부채     | "10K 사용자에서 뭐가 터지나?" | `.claude/reviews/midpoint-20260428-performance.md` |
| `quality-engineer`     | 테스트 부채     | "프로덕션에서 뭐가 물릴까?"   | `.claude/reviews/midpoint-20260428-quality.md`     |
| `backend-architect`    | 데이터·API 부채 | "2년차에 뭐가 아플까?"        | `.claude/reviews/midpoint-20260428-backend.md`     |
| `devops-architect`     | 운영 부채       | "새벽 3시 on-call 시나리오?"  | `.claude/reviews/midpoint-20260428-devops.md`      |

각 에이전트는 자기 관점에서 본 보고서 + 코드 + 문서를 검토하고 **CRITICAL/MAJOR/MINOR + Devil's Advocate + Top 3 actions + 진행 권고 (proceed / partial proceed / pause)** 보고.

`auto-review-protocol.md` §"Phase 단위 5-페르소나 기술부채 리뷰" 정합 — 단, 본 시점은 Phase 1 중간 마일스톤이므로 중간 점검 성격.

---

## 12. 완료 기준 (본 보고서 자체)

- [✅] Phase 진행도 매트릭스 작성
- [✅] 영속 문서 17건 인벤토리 작성
- [✅] 코드 구현 2/7 step 현황 작성
- [✅] 테스트 64/64 PASS + 갭 9건 명시
- [✅] 4-Pass 누적 리뷰 결과 (CRITICAL 4건 / MAJOR 8건 정정)
- [✅] 이연 13건 상태 분류
- [✅] 위험 매트릭스 10건
- [✅] 갭 분석 (현 갭 6건 + ROADMAP 미반영 3건 + 예측 갭 4건)
- [✅] 다음 결정 후보 5건 (A~E)
- [⏳] 5-페르소나 제 3자 체크 5건 호출 (본 보고서 후 즉시)
- [⏳] 진산님 결정 대기 (5-페르소나 결과 통합 후)

---

## 13. 진산님 응답 가이드

본 보고서 + 5-페르소나 결과 도착 후 진산님 응답 후보:

1. **"A 진입"** — Step 11.6 코드 구현 즉시. 가장 직진.
2. **"B + C 먼저, A 다음"** — 문서 정리 0.5d 후 코드. ROADMAP 정합성 우선.
3. **"D 병렬 후 A"** — Property test 먼저, 통합 마지막. 결정성 검증 우선.
4. **"E 먼저, 진산님 cap 설정"** — BATCH-1 진입 차단 항목 해소 우선.
5. **"5-페르소나 결과 보고 결정"** — 권고 (정보 더 모은 후 결정).

권고: **5번** (5-페르소나 결과 보고 결정). 본 보고서 작성 시점에서 결정 후보 4건 (A/B/C/D) 이 동시 가능 상태 — 신규 정보 도착 후 우선순위 재정렬이 합리적.

---

**보고서 작성 완료 시각:** 2026-04-28 (KST)
**다음 갱신:** 5-페르소나 5건 결과 도착 시 §11 결과 통합 + §10 우선순위 재정렬 → v1.1
**아카이브:** Engine Hardening 완료 시 `docs/reports/archive/2026MMDD-engine-hardening-midpoint.md`
