# 엔진 보강 마스터 로드맵 (Engine Hardening Roadmap)

**버전:** v1.3 (Step 11.6 코드 ✅ + AC e2e 9건 ✅ + ADR-027 atomic BATCH 흡수)
**작성일:** 2026-04-27 (v1.0/v1.1) / 2026-04-28 (v1.2 패치) / 2026-04-30 (v1.3 진척 갱신)
**상태:** v1.3 — Step 11.6 차단 게이트 통과, Step 13~16 + Step 18 + Step 19 잔여
**작성자:** Claude (Opus 4.7)
**Trigger:** 진산님 직관 — "엔진부터 제대로 되야 학습자료 배치도 잘 되는 거 아닌가? 나중에 배치를 다시 하지 않아도 되잖아."
**근거 헌법:** VOID ENGINE DESIGN CONSTITUTION v3.0 (Vol IV, V, VI, XIV, XV, XVI, XVII)
**근거 메모리:** `project_content_build_engine_as_core` (무결성 위배 시 모든 plan 최우선 차단), `feedback_document_first_workflow` (영속 문서 우선)
**근거 Doctrine:** `/user:engine` (코어 로직 단독 패키지 격리 + 검증 후에야 통합 허용)
**v1.0 → v1.1 변경:** 두 독립 검토서(Review A — DEV COVEN / Review B — 외부 메타 옵저버) 9개 보완점 통합. ThePick 환경(Node.js 로컬 BATCH) 매핑 4건 추가.
**v1.1 → v1.2 변경 (2026-04-28):** Engine Hardening 중간 점검 5-페르소나 + P0 4-Pass + B-C1+B-C2 4-Pass 통합 정정 흡수. Step 11.6 신설 + Step 5 plan v1.1 + 0016 마이그레이션 + recover/checkpoint examId. 명시 이연 9 AC.
**v1.2 → v1.3 변경 (2026-04-30):** Step 11.6 코드 구현 완료 (137→195 tests, 9 AC e2e 흡수). 진산님 §7 결정 4건 응답 ("권고 진행" 2026-04-30) → ADR-027 신설 (Year 1 BATCH = atomic, mid-resume Year 2 이연) + 방법론 v1.2 effective. §3.2 시간 표 + §4 Step 11.6 + §8 완료 기준 갱신. 잔여: Step 13~16 + Step 18 + Step 19.

---

## 0. 핵심 결정 (불변)

> **BATCH-1 적재 진입 전, 의존하는 3개 엔진(formula-engine + parser + quality)의 결정성·재현성·계약을 100% 검증·문서화하고, L3 엔진(`apps/batch`, `formula-engine`, `quality`)에는 `recover()`/`snapshot()`을 의무 구현한 후 적재한다. 시간이 더 걸려도 좋다.**

이전 권고("BATCH 진행 중 엔진 보강 병행")는 Engine-First Doctrine 위배로 폐기.

---

## 0.5 v1.1 9개 보완점 통합 매트릭스

|    #    |     출처     | 분류       | 보완점                                                    | ThePick 매핑 미세 조정                                                                                                                 |
| :-----: | :----------: | :--------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
|   A-1   |   Review A   | 분류       | `quality` L2 → **L3** 격상                                | CBIV 6단계 + Stateful Meta 의존자 = 자동 L3 트리거 2건 해당                                                                            |
|   A-2   |   Review A   | 추정       | 1주 → **7~10일** calibration                              | 메모리 `feedback_focus_reliability_not_schedule` 정합 — 보고가 아니라 자체 재검토 트리거                                               |
|   A-3   |   Review A   | ADR        | ADR-024에 **Pre-trigger Window 14일**                     | 결제 mock → 실결제 전환 14일 전 AIEC 구현 시작                                                                                         |
|   A-4   |   Review A   | 비용       | Step 17 리뷰 비용 명시 + **cap 3**                        | 4-Pass + 5-페르소나 = 9개 리뷰 ≈ $5~18 (1회성)                                                                                         |
|   A-5   |   Review A   | CI         | Step 16 "선택" → **"의무"** + CI 통합                     | contract.yaml AC 자동 검증 = Silent Pivot 차단                                                                                         |
| **B-1** | **Review B** | **결정성** | **`build_reproducibility` invariant/tolerable 분리**      | parser는 PDF 파싱 — 100% 환상. invariant_fields(node_ids/AST/dep_edges)만 1.0, 나머지 5% 허용                                          |
| **B-2** | **Review B** | **복구**   | **L3 엔진 `recover()` 즉시 구현 (이연 불가)**             | ThePick 환경: Workers OOM 아님 → **Node.js 프로세스 비정상 종료 / 세션 90분 타임아웃 / Ctrl+C / 시스템 재부팅** 시나리오               |
| **B-3** | **Review B** | **차단**   | **Two-Layer Cost Control (Application + Infrastructure)** | Layer 2 = Cloudflare API Gateway 아님 → **Anthropic 콘솔 monthly cap + git pre-commit hook + monthly billing alert**로 매핑            |
| **B-4** | **Review B** | **동시성** | **Idempotency 시나리오 4건**                              | ThePick 환경: 사용자 트리거 X → **두 Claude Code 세션 동시 실행 / 진산님 트리거 키워드 중복 / recover 후 이전 인스턴스 잔존** 시나리오 |

🔴 = 즉시 반영 (모두 채택) / Conflict 0건

### 0.5.1 v1.2 통합 정정 매트릭스 (2026-04-28)

|        #        |                        출처                         | 분류         | 결함                                                                                                  | 정정                                                                                                                                       |
| :-------------: | :-------------------------------------------------: | :----------- | :---------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
|     **C-3**     | 5-페르소나 backend (`midpoint-20260428-backend.md`) | 데이터       | 0015 트리거 본문 결함 — `OLD.state NOT IN ('killed','failed')` 가 stale 24h+ in_progress recover 차단 | **Step 11.5 v1.1** — 트리거 본문 `OLD.state = 'completed'` 만 ABORT 정정 (B-C3)                                                            |
|    **R-C1**     |               5-페르소나 refactoring                | 코드         | Step 11.6 plan §4.3.4 `extractCostState(meter)` 자유 함수가 컴파일 에러 (CostMeter 3 getter 미존재)   | `cost-meter.ts:351-361` `toCheckpointCostState()` 인스턴스 메서드 신규 (R-C1)                                                              |
|    **Q-C1**     |                 5-페르소나 quality                  | 코드         | `assertCanonicalSafe` 5종 거부만 — silent collapse 위험 4종 미포함                                    | `checkpoint.ts:188-272` 9종 + circular reference 거부 + WeakSet visited (Q-C1)                                                             |
| **SA-CRITICAL** |          B-C1+B-C2 4-Pass system-architect          | plan         | Step 11.6 plan §10 "caller 없거나 테스트만" 거짓 — 실재 6 callsite                                    | plan §10 정정 + 6 callsite 표 + 코드 진입 첫 commit 일괄 갱신 SLO                                                                          |
|   **SF-M-2**    |           B-C1+B-C2 4-Pass silent-failure           | 코드         | `recover.ts` 의 `checkpoint.exam_id` 일관성 가드 부재 → Year 2 cross-tenant recover silent 통과 위험  | `recover.ts:230-244` 14줄 examId 일관성 가드 추가                                                                                          |
|    **B-C1**     |               5-페르소나 backend C-1                | 마이그레이션 | `knowledge_nodes` 에 `batch_run_id`/`source_id` 컬럼 부재 — Step 5 UNIQUE 인덱스 작동 불가            | **0016 마이그레이션 신규** + Step 5 plan v1.1 (`source_id = {page_ref}#{node_id}` 정의) + 0014 화이트리스트 갱신                           |
|    **B-C2**     |               5-페르소나 backend C-2                | 인터페이스   | `BatchRunsDb` examId 부재 — Hard Rule 16 위반                                                         | `recover.ts` BatchRunsDb 시그니처 + RecoverOptions.examId + BatchCheckpoint.exam_id? + Step 11.6 plan §3.1 PipelineContext.examId required |

🟡 = 후보 B (절충안) — 명시 이연 9 AC (Step 11.6 코드 구현 시 e2e 흡수) — **v1.3: 9 AC 모두 흡수 완료 ✅**

### 0.5.2 v1.3 통합 정정 매트릭스 (2026-04-30, handoff-019 §3 + ADR-027)

|        #        |                        출처                        | 분류      | 결함                                                                                                                                                                                                 | 정정                                                                                                                                                          |
| :-------------: | :------------------------------------------------: | :-------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **AC-R1-CRIT**  | Step 11.6 9 AC e2e 4-Pass quality (handoff-019 §3) | plan-구현 | `pipeline.ts:518-540` resume 시 `state.contract` 재주입 0건 → mid-pipeline resume 진입 시 Stage 6 즉시 throw → AC-R1 plan 의도 ("Stage 6~10 재실행") 와 e2e 검증 (degenerate skip) 사이 silent pivot | **ADR-027 신설** (Year 1 BATCH = atomic, mid-resume Year 2 Step 11.7 후보 이연) + Step 11.6 plan §7 AC-R1 본문 정정 (already_completed Idempotency skip 검증) |
| **방법론 §7-1** |         방법론적용-ThePick v1.1 §7 결정 1          | 방법론    | §3 매트릭스 + §2.5 정량 증거 (적용 60%/35%/5%) 승인 대기                                                                                                                                             | **승인** (진산 2026-04-30 "권고 진행") → 방법론 v1.2 effective                                                                                                |
| **방법론 §7-2** |         방법론적용-ThePick v1.1 §7 결정 2          | 방법론    | 본 문서 영속 위치 결정 대기                                                                                                                                                                          | **현 위치 유지** (디폴트, `feedback_no_granular_decisions` 정합)                                                                                              |
| **방법론 §7-3** |         방법론적용-ThePick v1.1 §7 결정 3          | 방법론    | P1 시점 정의 결정 대기                                                                                                                                                                               | **BATCH-1 dry-run 통과 직후 = P1** (§6.4 정합, B1~B4 부분 채택 ~1.5d 흡수)                                                                                    |

🔴 = 즉시 반영 (모두 채택 / 옵션 A)

---

## 1. 왜 엔진을 먼저 단단하게?

### 1.1 BATCH 적재의 비가역성

BATCH 적재 = D1에 영구 저장되는 지식 그래프의 토대. 그 위에 모든 학습 콘텐츠가 생성됨.

```
BATCH 적재 → D1 INSERT (state=draft) → 인간 검수(approved)
         → study-material-generator (Phase 2) → 사용자 학습(Phase 3)
         → user_progress 누적(Phase 4)
```

엔진 결함이 있는 채로 적재하면:

| 발견 시점              | 비용                                           |
| :--------------------- | :--------------------------------------------- |
| BATCH-1 직후           | 인간 검수 재실행                               |
| BATCH-3 누적 후        | 검수 비용 × 노드 수 + CBIV 회귀 재실행         |
| Phase 2 콘텐츠 생성 후 | + 생성 콘텐츠 폐기 + 재생성                    |
| Phase 3 사용자 학습 후 | + user_progress 마이그레이션 + 옛 노드 ID 매핑 |

**Temporal Graph (UPDATE 금지 + INSERT + SUPERSEDES)**가 일부 보호하지만 — 기하급수 비용.

### 1.2 v3.0 헌법의 명령

| Volume                             | 명령                                                                                          |
| :--------------------------------- | :-------------------------------------------------------------------------------------------- |
| **XIV.4 Build SLO**                | `build_correctness: 0.999`, `build_reproducibility: 1.0` (단 v1.1에서 분할 — invariant만 1.0) |
| **XIV.5 안티패턴**                 | "Non-reproducible Build → seed 고정 + property test"                                          |
| **XV.3 Library 의무 #1**           | "Property Test (Tier 4) — 결정성·회귀 차단 (가장 중요)"                                       |
| **XV.3 #2**                        | "engine.contract.yaml — Silent Pivot 방지"                                                    |
| **V.2 Lifecycle 5종**              | recover/snapshot 의무 (L3 엔진은 이연 불가 — Review B-2)                                      |
| **VI.3 Financial Circuit Breaker** | soft/hard/kill 3단계 + Two-Layer 차단 (Review B-3)                                            |
| **XVII.3 보호 5장치 #1**           | "ADR로 명시 — 5년 {벤더} 종속 수용"                                                           |

### 1.3 진산님 글로벌 CLAUDE.md

> "/user:engine — 코어 로직을 단독 패키지로 격리하고 RTV/AC/Soak로 검증한 후에야 UI/통합 허용"

BATCH 적재 = "통합". 엔진 검증 통과 후 적재 진입.

---

## 2. 작업 범위

### 2.1 차단 대상 엔진 (BATCH-1 의존 = 보강 필수)

| 엔진                      | 도메인 프로파일 (v3.0) |       DEFCON       |       BATCH-1 의존        | 보강 항목                                                        |
| :------------------------ | :--------------------- | :----------------: | :-----------------------: | :--------------------------------------------------------------- |
| `packages/formula-engine` | XV Library             |       **L3**       |      ✅ (산식 다수)       | Property test, contract.yaml, research.md                        |
| `packages/parser`         | XV Library             |         L2         |  ✅ (PDF·섹션·ontology)   | 결정성 test (invariant 분리), contract.yaml, research.md         |
| `packages/quality`        | XV Library             | **L3 (v1.1 격상)** | ✅ (CBIV·graph integrity) | Property test, contract.yaml, research.md                        |
| `apps/batch` (파이프라인) | XIV Batch/Build + XVII |       **L3**       |            ✅             | Cost meter (2-Layer), Reproducibility test, **recover/snapshot** |

> **v1.1 격상 사유 (`quality`):** v3.0 Vol I.3 자동 L3 트리거 2건 해당 — ① 데이터 파이프라인 3단계+ (CBIV는 6단계), ② Stateful Meta가 의존하는 검증자.

### 2.2 차단 대상 인프라 / 문서

| 항목                                       | 도메인 프로파일 | 산출물                                 |
| :----------------------------------------- | :-------------- | :------------------------------------- |
| Single-Vendor Lock-in 정식화               | XVII            | ADR-022                                |
| Engine-First 결정 정식화                   | —               | ADR-023                                |
| 결제 AIEC 트리거 + Pre-trigger Window 14일 | XVI             | ADR-024                                |
| **Two-Layer Cost Control (v1.1 신규)**     | XIV + XVII      | **ADR-025**                            |
| LLM 4계층 격리 설계                        | IV              | `docs/architecture/LLM_CONTAINMENT.md` |

### 2.3 이연 (BATCH-1 의존 X) — v1.1 수정

| 항목                                | 이연 시점                                            | 사유                                                                  |
| :---------------------------------- | :--------------------------------------------------- | :-------------------------------------------------------------------- |
| `packages/ai-adapter` 실구현        | Phase 3 Vision OCR 진입 전                           | BATCH-1~5 = Claude Code Opus 직접 처리                                |
| **Lifecycle 5종 hook (L1/L2 엔진)** | Phase 2 첫 사용자 진입 1주 전                        | Vol XVI Solo-Builder = healthCheck만 권고                             |
| ⚠️ **Lifecycle 5종 hook (L3 엔진)** | **이연 불가 (v1.1 변경)**                            | **Review B-2: L3 자동 격상 우선. `recover()`/`snapshot()` 즉시 구현** |
| OpenTelemetry SDK 통합              | Phase 2 출시 1주 전                                  | Vol XVII = Cloudflare Analytics Engine 백엔드                         |
| AIEC 코드 구현                      | 결제 mock → 실결제 전환 **14일 전** (ADR-024 트리거) | Pre-trigger Window 의무 (Review A-3)                                  |
| Tier 5 Chaos Test (사용자 영향)     | Phase 2 베타 사용자 100명 시점                       | Vol XVI = "시기상조"                                                  |
| Resurrection Chaos R1/R2/R3         | **Step 17 직전 1건만 통과**                          | L3 의무 (단 BATCH-1 진입 전엔 R1만)                                   |
| `study-material-generator` 보강     | Phase 2 Content Generation 진입 전                   | Vol XVIII 별도 프로파일                                               |

---

## 3. 의존성 그래프 + 시간 추정

### 3.1 의존성 그래프 (v1.2 — Step 11.6 + B-C1/B-C2 흡수)

```
[Step 0] 마스터 로드맵 v1.2 (본 문서) ─── 진산님 승인
   │
   ├──[Step 1] ADR-022 Cloudflare Lock-in
   ├──[Step 2] ADR-023 Engine-First Sequencing
   ├──[Step 3] ADR-024 결제 AIEC 트리거 (+ Pre-trigger Window 14일)
   ├──[Step 4] ADR-025 Two-Layer Cost Control (v1.1 신규)
   ├──[Step 5] LLM_CONTAINMENT.md 설계
   │
   └──[Step 6] 엔진 3종 research.md + contract.yaml
              (build_reproducibility = invariant_fields/tolerable_fields 분리)
            │
            ├──[Step 7] step1-cost-meter.plan (2-Layer)
            ├──[Step 8] step2-formula-property.plan
            ├──[Step 9] step3-parser-determinism.plan (invariant 분리)
            ├──[Step 10] step4-quality-determinism.plan
            ├──[Step 11] step5-reproducibility.plan v1.1 (Idempotency 4 시나리오 + source_id 정의 + 0016 마이그레이션)
            ├──[Step 11.5] step6-recover-snapshot.plan (v1.1, L3 의무)
            ├──[Step 11.6] step11-6-pipeline-recover-integration.plan v1.1 (NEW — pipeline.ts ↔ recover/snapshot/cost-meter 통합)
            └──[Step 12~17] 코드 구현 (각 plan별, 6 callsite 일괄 갱신 + AC e2e 9건 흡수)
                       │
                       └──[Step 18] contract.yaml 자동 검증 스크립트 (의무)
                                │
                                └──[Step 19] 4-Pass + 5-페르소나 독립 리뷰
                                         │
                                         └──[Step 20] BATCH-1 적재 진입
```

**v1.2 신규 Step 11.6 — pipeline.ts 통합:**

- Step 11.5 (`checkpoint.ts` / `recover.ts`) + Step 1 (`cost-meter.ts`) 산출물을 `pipeline.ts` 실행 경로에 통합
- AC-R1 e2e ("BATCH 50% 진행 → kill → recover → 정확 재개") 를 mock 이 아닌 실제 파이프라인 흐름에서 통과
- 6 callsite 일괄 갱신 + `PipelineContext.examId/batchRunId/checkpointBaseDir/batchRunsDb/engineVersion` required
- Q1/Q2/Q4 단위 테스트 + AC-Cost/AC-Snapshot'/AC-T3/AC-ExamId/AC-RP-6/AC-RP-7 e2e 9건 흡수 (후보 B 명시 이연)

### 3.2 시간 추정 (v1.3 갱신 — Step 11.6 코드 ✅ + AC e2e 9건 ✅ + ADR-027 흡수 반영)

| 단계                                                                    |   낙관    | 현실 (×1.5)  | 비관 (×2.0) |            진행 상태            |
| :---------------------------------------------------------------------- | :-------: | :----------: | :---------: | :-----------------------------: |
| Step 0~5 (마스터 + ADR 4건 + LLM 도식)                                  |   1.5d    |     2.5d     |     3d      |             ✅ 완료             |
| Step 6 (엔진 3종 research + contract)                                   |    1d     |     1.5d     |     2d      |             ✅ 완료             |
| Step 7~11.5 (plan 6건)                                                  |    1d     |     1.5d     |     2d      |             ✅ 완료             |
| Step 11.6 plan v1.1 + B-C1+B-C2 정정 (v1.2)                             |   0.3d    |     0.5d     |    0.7d     |      ✅ 완료 (2026-04-28)       |
| Step 12 (cost-meter 코드)                                               |   0.5d    |     0.7d     |     1d      |             ✅ 완료             |
| Step 17 (checkpoint/recover 코드 + R-C1/Q-C1/B-C3 정정)                 |   0.7d    |      1d      |    1.5d     |             ✅ 완료             |
| **Step 11.6 코드 (v1.2 NEW — pipeline 통합 + 6 callsite + AC e2e 9건)** |   2.6d    |   3.1~3.5d   |    4.5d     |    **✅ 완료 (2026-04-29)**     |
| **ADR-027 + 방법론 v1.2 (v1.3 NEW — atomic BATCH 정책 영속화)**         |   0.1d    |     0.2d     |    0.3d     |    **✅ 완료 (2026-04-30)**     |
| Step 13~16 (formula/parser/quality property + reproducibility 코드)     |   1.8d    |     2.5d     |    3.5d     | 🟡 진행 (Step 13 ✅ 2026-04-30) |
| Step 18 (자동 검증 스크립트 + CI)                                       |   0.5d    |      1d      |    1.5d     |             ⏳ 잔여             |
| Step 19 (4-Pass + 5-페르소나 cap=3)                                     |   0.5d    |      1d      |    1.5d     |             ⏳ 잔여             |
| Step 20 (BATCH-1 적재 진입)                                             |    1d     |     1.5d     |     2d      |    ⏳ 잔여 (Step 19 통과 후)    |
| **v1.3 합계**                                                           | **11.5d** | **16.5~17d** |   **23d**   |         **약 50% 진행**         |
| v1.2 합계 (참고)                                                        |   10.4d   |  15.3~15.8d  |    21.2d    |                —                |

**v1.3 증가 사유 (+1.1~1.8d):**

- ADR-027 + 방법론 v1.2 (0.1~0.3d) — handoff-019 §3 결정 4 + 진산님 §7 결정 3건 영속화
- Step 20 (BATCH-1 적재 진입) 시간 추정 신규 추가 (1d / 1.5d / 2d) — batch-loadmap.md §"진산님 워크플로우 트리거" 의 7-step 자동 진행 + Level 1~3 검수 + handoff-batch-1.md

**v1.3 진척 갱신:**

- Step 11.6 ✅ — 195/195 tests / 9 AC e2e 모두 흡수 / 4-Pass quality CRITICAL 1건 (AC-R1) 은 ADR-027 으로 해소
- ADR-027 ✅ — Year 1 atomic BATCH 정책 명문화 / mid-resume 인프라 보존 (Year 2 Step 11.7 후보)
- 방법론 v1.2 ✅ — §7 결정 4건 영속화 (효력 발생 2026-04-30)

**의사결정 트리거 (v1.2 갱신):**

- 18일 초과 시 본 로드맵 자체 재검토 (스코프 축소 / 우선순위 재조정 / 진산님 보고)
- 메모리 `feedback_focus_reliability_not_schedule` 정합 — 일정 보고가 아니라 신뢰성·항상성 차원의 자체 점검
- 5-페르소나 §3.2 시간 추정 underestimate 패턴 (quality 권고 1.5~2배 보정 권고 — handoff-session-014 §5.5)

---

## 4. 단계별 산출물 명세

### Step 0 — 본 마스터 로드맵 v1.1 (현재)

- 파일: `docs/plans/engine-hardening/ROADMAP.md`
- 게이트: 진산님 승인

### Step 1 — ADR-022 Cloudflare Single-Vendor Lock-in

- 파일: `docs/adr/ADR-022-cloudflare-single-vendor-lockin.md`
- 내용: 5년 종속 수용, 데이터 export 형식 (JSON + 마이그레이션 SQL), 1년 1회 export 테스트, 비용 모니터링 트리거
- 근거: v3.0 Vol XVII.3 보호 5장치 #1, 메모리 `feedback_single_vendor_cloudflare`, 기존 ADR-006 보강

### Step 2 — ADR-023 Engine-First Before BATCH-1

- 파일: `docs/adr/ADR-023-engine-first-before-batch.md`
- 내용: 엔진 보강 7~10일 선행 결정, 대안(병행/후행) 기각 사유, 재적재 비용 분석 (Section 1.1 비가역성 표 인용), Engine-First Doctrine 정합

### Step 3 — ADR-024 Payment AIEC Trigger (v1.1 강화)

- 파일: `docs/adr/ADR-024-payment-aiec-trigger.md`
- 내용:
  - 결제 mock(현재) → 실결제 전환 시점에 AIEC 자동 활성화 의무
  - **Pre-trigger Window 14일** (Review A-3):
    - Day -14: HMAC 키 발급 + nonce store (Cloudflare KV) 구축
    - Day -7: capability 매트릭스 정의 + 통합 테스트
    - Day -3: Tier 3 (Contract) + Tampering Chaos 통과
    - Day 0: 실결제 활성화 + AIEC 활성화 동시
    - Day +30: AIEC 차단 로그 일일 점검

### Step 4 — ADR-025 Two-Layer Cost Control (v1.1 신규)

- 파일: `docs/adr/ADR-025-two-layer-cost-control.md`
- 내용:
  - **Layer 1 (Application)**: `apps/batch/src/cost-meter.ts` — 도메인 컨텍스트 풍부, 회계 정확
  - **Layer 2 (Infrastructure / ThePick 매핑)**:
    - Anthropic 콘솔 monthly billing cap (예: $200)
    - Anthropic monthly billing alert (50%/80%/100%)
    - git pre-commit hook — 대용량 SQL 변경 차단 (Cloudflare D1 무료 한도 보호)
    - Cloudflare Workers outbound rate limit (Phase 2 진입 시)
  - 트레이드오프: Layer 2가 Cloudflare API Gateway 아닌 **외부 SaaS 콘솔 + 로컬 hook 조합** 인정
  - Layer 1만으론 비동기 in-flight 차단 불가 → Layer 2가 안전망

### Step 5 — LLM_CONTAINMENT.md

- 파일: `docs/architecture/LLM_CONTAINMENT.md`
- 내용: 4계층 격리 도식 (Schema → Constraint → Cross-validation → Fallback)
- ThePick 도메인 매핑:
  - Layer 1: 산식 변수명 schema 검증, 노드 ID 패턴 검증
  - Layer 2: 산식 결과 범위 검증 (보험가액 > 0, 면적 > 0, 비율 ≤ 1)
  - Layer 3: 기출 정답 ↔ 그래프 해설 cross-validation, BATCH N ↔ N-1 회귀 (CBIV)
  - Layer 4: LLM 실패 → 인간 검수 큐 (Hard Stop)

### Step 6 — 엔진 3종 research.md + contract.yaml (v1.1 강화)

파일:

- `docs/engines/formula-engine/research.md` + `contract.yaml`
- `docs/engines/parser/research.md` + `contract.yaml`
- `docs/engines/quality/research.md` + `contract.yaml`

내용: v3.0 부록 A 양식. 4축 분류, domain_profile=library, AC 5+개, invariants, Build SLO, Library 식별 3문항.

**v1.1 강화 — `build_reproducibility` 분할 (Review B-1):**

```yaml
slo:
  build_reproducibility:
    invariant_fields: # 100% 의무
      - 'node_ids'
      - 'edge_dependency_graph'
      - 'formula_AST'
      - 'ontology_registry_match'
      - 'constants_canonical_form'
    invariant_threshold: 1.0

    tolerable_fields: # 5% 허용 (PDF 파싱 노이즈)
      - 'raw_line_breaks'
      - 'ocr_normalized_whitespace'
      - 'vision_corrected_text'
    tolerance_threshold: 0.05

    test_method: 'property_test'
    test_iterations: 100
    seed_fixed: true
```

→ formula-engine/quality는 `tolerable_fields`가 비어있음 (결정성 100%). parser만 분할 적용.

### Step 7~11 — 단계별 plan 5건

파일:

- `docs/plans/engine-hardening/step1-cost-meter.plan.md` (Two-Layer 명세)
- `docs/plans/engine-hardening/step2-formula-property.plan.md`
- `docs/plans/engine-hardening/step3-parser-determinism.plan.md` (invariant 분리)
- `docs/plans/engine-hardening/step4-quality-determinism.plan.md`
- `docs/plans/engine-hardening/step5-reproducibility-idempotency.plan.md` (Idempotency 4 시나리오)

양식: `docs/plans/TEMPLATE.plan.md`. 각 plan에 Binary Gates (`/user:gates`).

### Step 11.5 — apps/batch recover() + snapshot() plan (v1.1 신규)

파일: `docs/plans/engine-hardening/step6-recover-snapshot.plan.md` (v1.1 정정 완료)

내용 (Review B-2):

- 산출물 (✅ 완료):
  - `apps/batch/src/checkpoint.ts` (snapshot 직렬화 + R-C1/Q-C1 정정)
  - `apps/batch/src/recover.ts` (재개 로직 + B-C2 examId 시그니처 + SF-M-2 가드)
  - `migrations/0015_batch_runs.sql` (B-C3 트리거 정정 + SA-M2 idempotency)
- AC (mock PASS, e2e 후보 B 이연):
  - **AC-R1~R6** mock PASS — production e2e 검증 Step 11.6 흡수

### Step 11.6 — pipeline.ts ↔ recover/snapshot/cost-meter 통합 (v1.2 신규)

파일: `docs/plans/engine-hardening/step11-6-pipeline-recover-integration.plan.md` (v1.1 APPROVED)

내용:

- 산출물 (다음 단계):
  - `apps/batch/src/pipeline.ts` 수정 — `runPipeline` 흐름에 recover/checkpoint/cost-meter 통합
  - `apps/batch/src/checkpoint.ts` 수정 — fsync 옵션 + writeCheckpointSync (이연 3 처리)
  - `apps/batch/src/signal-handlers.ts` 신규 — SIGINT/SIGTERM handler
  - `apps/batch/src/d1-batch-runs-db.ts` 신규 — BatchRunsDb D1 어댑터 실구현
  - `migrations/0016_knowledge_nodes_batch_idempotency.sql` ✅ 완료 (v1.2 — B-C1)
  - `apps/batch/__tests__/pipeline-integration.test.ts` 신규 — AC-R1 e2e
  - `apps/batch/__tests__/signal-handlers.test.ts` 신규 — SIGINT/SIGTERM 보장
  - `apps/batch/__tests__/d1-trigger-verify.test.ts` 신규 — 0015/0016 트리거 발화 e2e (AC-R6, AC-RP-6)
- AC e2e 9건 일괄 흡수 (후보 B 명시 이연):
  - AC-R1~R6 (Step 11.5 mock → 실제 e2e 격상)
  - AC-Cost (toCheckpointCostState 7 케이스)
  - AC-Snapshot' (canonicalJson 9종+circular 13 케이스)
  - AC-T3 (state transition matrix 5×7 + race window)
  - AC-ExamId (BatchRunsDb examId 분기 검증)
  - AC-RP-6 (0016 마이그레이션 트리거 갱신 e2e)
  - AC-RP-7 (source_id 결정성)
- 6 callsite 일괄 갱신 (batch.ts CLI 1건 + integration test 5건)

### Step 12~17 — 코드 구현 (plan 승인 후)

| Step | 산출물                                                      | 작업                                           |
| :--- | :---------------------------------------------------------- | :--------------------------------------------- |
| 12   | `apps/batch/src/cost-meter.ts` + 테스트                     | Layer 1 회계 + soft/hard/kill                  |
| 13   | `packages/formula-engine/__tests__/determinism.property.ts` | fast-check, 68개 산식 결정성 100%              |
| 14   | `packages/parser/__tests__/determinism.property.ts`         | invariant_fields 100% / tolerable_fields ≤ 5%  |
| 15   | `packages/quality/__tests__/determinism.property.ts`        | CBIV 동일 입력 → 동일 결과 (graph isomorphism) |
| 16   | `apps/batch/__tests__/reproducibility-idempotency.test.ts`  | seed 고정 + Idempotency 4 시나리오 (B-4)       |
| 17   | `apps/batch/src/checkpoint.ts` + `recover.ts` + 테스트      | Step 11.5 plan 구현                            |

### Step 18 — 자동 검증 스크립트 (v1.1 의무화 — Review A-5)

파일:

- `scripts/verify-engine-contracts.ts`
- `.github/workflows/contract-verify.yml`

기능:

- 모든 `engine.contract.yaml`의 AC 자동 체크
- `function_exists` / `test_passes` / `metric_check` / `file_exists` 검증
- 실패 시 Step 19 진입 차단

### Step 19 — 독립 리뷰 (v1.1 비용 명시 — Review A-4)

```yaml
review_cost_estimate:
  per_review_usd: 0.5 ~ 2.0
  total_reviews: 9 # 4-Pass(4) + 5-페르소나(5)
  estimated_total_usd: 5 ~ 18
  note: 'BATCH-1 비용 ≤ $10의 50~180%, 1회성이므로 수용'

review_failure_loop_cap: 3 # 무한 루프 방지
```

리뷰 통과 기준: CRITICAL 0건. 3회 실패 시 진산님 보고 + 스코프 재검토.

### Step 20 — BATCH-1 적재 진입

본 로드맵의 결론. 별도 plan은 `docs/plans/batch-loadmap.md` 기존 활용.

---

## 5. Build SLO Tier (v1.1 — Review B-1 분할)

```yaml
slo:
  tier: 'Build'
  build_time_max_minutes: 60
  build_cost_max_usd: 10
  build_correctness: 0.999

  build_reproducibility:
    invariant_fields: # 절대 변하면 안 됨
      - 'node_ids'
      - 'edge_dependency_graph'
      - 'formula_AST'
      - 'ontology_registry_match'
      - 'constants_canonical_form'
    invariant_threshold: 1.0

    tolerable_fields: # PDF 파싱 노이즈 허용
      - 'raw_line_breaks'
      - 'ocr_normalized_whitespace'
    tolerance_threshold: 0.05

    test_method: 'property_test'
    test_iterations: 100
    seed_fixed: true

  retry_on_failure: 1

# v1.1 추가
review_cost_estimate:
  per_review_usd: 0.5 ~ 2.0
  total_reviews: 9
  estimated_total_usd: 5 ~ 18
  review_failure_loop_cap: 3

# v1.1 추가 — Two-Layer Cost Control 명시
cost_control:
  layer_1_application: 'apps/batch/src/cost-meter.ts'
  layer_2_infrastructure:
    - 'Anthropic console monthly cap'
    - 'Anthropic billing alert 50/80/100'
    - 'git pre-commit hook (large SQL guard)'
```

---

## 6. ThePick 환경 매핑 4건 (v1.1 미세 조정)

Review B 4개 권고를 ThePick 실제 환경(Node.js 로컬 BATCH, Cloudflare Workers 아님)에 맞춰 조정:

| Review B 권고            | 원안 시나리오               | ThePick 매핑                                                                                       |
| :----------------------- | :-------------------------- | :------------------------------------------------------------------------------------------------- |
| **B-1 재현성 1.0 분리**  | 일반론 (모든 SaaS)          | parser만 분할 적용. formula-engine/quality는 100% 결정성                                           |
| **B-2 recover/snapshot** | Workers OOM / CPU 50ms      | Node.js 비정상 종료 / Ctrl+C / 노트북 슬립 / 시스템 재부팅 / Claude Code 90분 세션 단절            |
| **B-3 Two-Layer Cost**   | Cloudflare API Gateway 차단 | Anthropic 콘솔 cap + monthly alert + git pre-commit hook (Cloudflare API Gateway는 Phase 2에 추가) |
| **B-4 Idempotency**      | 사용자 트리거 / Cron        | 두 Claude Code 세션 동시 실행 / 진산님 트리거 키워드 중복 / recover 후 이전 인스턴스 잔존          |

---

## 7. 위험 / 트레이드오프 (v1.1 갱신)

| 위험                                | 완화                                                                    |
| :---------------------------------- | :---------------------------------------------------------------------- |
| BATCH-1 적재 7~12일 지연            | 재적재 시 인간 검수 비용 × N배 절약. 진산님 직관과 정합                 |
| 문서 작업 중 컨텍스트 폭발          | 단계별 분할, 한 세션당 1~2 step, 핸드오프 적극 활용                     |
| Premature documentation (v3.0 IX.9) | 본 로드맵은 BATCH-1 직전 Engine-First 점검 = Justified (Vol XIX.2 정합) |
| Solo-Builder 시기에 과도?           | Vol XV Library 식별 3문항 + Vol XIV Build SLO + L3 자동 격상만 적용     |
| **Review B 4건 미세조정 누락**      | **본 v1.1에서 Section 6에 명시 매핑 — 누락 시 헌법 v3.1 패치 후보**     |
| Step 11.5 (recover) 학습 곡선       | Cloudflare KV 미사용 → 로컬 파일 + D1 메타 = 단순                       |
| 시간 12일 초과                      | 본 로드맵 자체 재검토 (스코프 축소 / 진산님 보고 X — 메모리 정합)       |

---

## 8. 완료 기준 (Done Criteria) — v1.2 갱신

본 로드맵이 "완료" 선언되려면 모두 충족:

- [x] Step 0 마스터 로드맵 v1.2 진산님 승인 (v1.1 승인 + v1.2 후보 B 채택)
- [x] Step 1~4 ADR 4건 ACCEPTED (022, 023, 024, **025 v1.1**)
- [x] Step 5 LLM_CONTAINMENT.md 진산님 검토
- [x] Step 6 엔진 3종 research.md + contract.yaml 작성 + BREAKER 검증
- [x] Step 7~11.5 plan 6건 + Step 11.6 plan v1.1 + Step 5 plan v1.1 + 0016 마이그레이션
- [x] Step 12 (cost-meter) + Step 17 (checkpoint/recover) 코드 + R-C1/Q-C1/B-C3/SF-M-2 정정 + 137/137 PASS
- [x] **Step 11.6 코드 구현 (v1.2 신규 — pipeline 통합)**: 6 callsite 갱신 + AC e2e 9건 흡수 + 195/195 PASS (2026-04-29)
- [x] **ADR-027 신설 (v1.3 — Year 1 atomic BATCH + mid-resume Year 2 이연)** + 방법론 v1.2 effective (2026-04-30)
- [ ] Step 13~16 코드 구현 — Step 13 ✅ formula determinism + sandbox bypass property (2026-04-30, 251/251 PASS) / Step 14~16 잔여 (parser/quality property + reproducibility)
- [ ] Step 18 자동 검증 스크립트 PASS (의무화)
- [ ] Step 19 4-Pass + 5-페르소나 리뷰 CRITICAL 0건 (cap 3회)
- [ ] Build SLO 모든 축 측정 가능 + Step 12 (Cost meter Layer 1) 가동
- [ ] **Layer 2 Cost Control 활성** (Anthropic 콘솔 cap 진산님 설정 — Phase 2 진입 시 의무, 메모리 `project_anthropic_cap_pre_install`)
- [ ] BATCH-1 fixture 재실행 → seed 고정 시 동일 D1 INSERT 결과 (invariant_fields 100%)
- [x] **AC-R1 e2e 통과** (atomic 정책, ADR-027): 마지막 stage 후 kill → already_completed Idempotency skip 검증 (mid-resume Year 2 Step 11.7 후보 이연)
- [x] **AC-R3 e2e 통과**: 동시 트리거 → 중복 INSERT 0건
- [x] **AC-T3 신규**: batch_runs state transition matrix 5×7 e2e 통과 (B-C3 트리거 갱신 검증)
- [x] **AC-RP-6 신규**: 0016 마이그레이션 + 0014 화이트리스트 갱신 e2e 통과 (B-C1)
- [x] **AC-RP-7 신규**: source_id 결정성 (`{page_ref}#{node_id}` 100회 반복 동일)
- [x] **AC-ExamId 신규**: BatchRunsDb examId 시그니처 검증 + SF-M-2 cross-tenant 가드 발화 검증
- [x] **AC-Snapshot 신규**: canonicalJson 4 시나리오 (self/mutual/diamond/deep DAG) 통과 + ancestor-only 추적 fix (handoff-019)
- [x] **AC-Cost 신규**: CostMeter onKillSwitch flush + toCheckpointCostState 7 케이스 직렬화

위 모두 충족 후 → BATCH-1 적재 진입 승인.

---

## 9. 진산님 승인 체크포인트 (변경 없음)

다음 결정만 진산님 명시 승인 필요. 나머지는 v3.0 헌법 + 메모리 + 본 로드맵 기준으로 자율 진행:

1. **본 로드맵 v1.1 전체 방향** (9개 보완점 통합 후 1주~2주 선행)
2. **각 ADR ACCEPTED 시점** (4건 묶음 또는 개별)
3. **Step 19 리뷰 통과 후 BATCH-1 진입 명령** (트리거 키워드 "BATCH-1 적재 진입")

세부 plan/contract/research/code는 본 로드맵 승인 시 자율 진행.

---

## 10. v3.1 헌법 패치 후보 (Review B 부산물)

본 분석으로 도출된 v3.0 헌법 자체의 v3.1 패치 후보 (참고용 — 별도 작업):

| 패치 후보                                        | 출처       | 내용                                                  |
| :----------------------------------------------- | :--------- | :---------------------------------------------------- |
| `build_reproducibility` invariant/tolerable 분리 | Review B-1 | Vol XIV.4 SLO 양식 강화                               |
| Solo + L3 조합 차등 강화                         | Review B-2 | Vol XVI 차등표에 'L3 우선' 명시                       |
| Two-Layer Cost Control 명시                      | Review B-3 | Vol VI.3 Financial Circuit Breaker '어디서 차단' 추가 |
| Concurrent Trigger를 6번째 함정으로 추가         | Review B-4 | Vol III.3 5대 함정 → 6대 함정                         |

→ ThePick BATCH 보강과 v3.1 헌법 패치는 동시 진행 가능. ThePick이 v3.1 헌법의 첫 사용처가 됨.

---

## 11. 다음 액션

진산님 v1.1 승인 시 **즉시 Step 1~5 (ADR 4건 + LLM_CONTAINMENT.md)** 동시 작성 진입.

---

**문서 버전:** v1.2 (5-페르소나 + P0 4-Pass + B-C1+B-C2 4-Pass 통합 정정 흡수)
**v1.0 → v1.1 변경 라인 수:** ~150줄
**v1.1 → v1.2 변경 라인 수:** ~120줄 (§0.5.1 매트릭스 + §3.1 의존성 + §3.2 시간 + §4 Step 11.6 + §8 완료 기준)
**다음 업데이트:** Step 11.6 코드 완료 + 4-Pass 통과 후 v1.3
**아카이브:** 본 로드맵 완료 후 `docs/plans/archive/2026MMDD-engine-hardening.plan.md`
