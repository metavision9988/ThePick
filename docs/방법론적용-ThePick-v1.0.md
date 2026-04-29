# 방법론 적용 — ThePick v1.1

**작성일:** 2026-04-29 (v1.0) / 2026-04-29 (v1.1 외부 cross review 흡수)
**작성자:** Claude (Opus 4.7) — 메인 컨텍스트
**입력 자료:**

- `docs/메타엔진통합설계방법론/` 3종 (VOID Engine Design Constitution v3.0 FINAL + 두 검토서)
- `docs/프로젝트분할개발방법론/` 9종 (00-master-index ~ 08-templates-library)
- `docs/plans/engine-hardening/reviews/` 2종 (DEV COVEN 합동 감사 + UKE 비전 설계)
- `.claude/reports/engine-hardening-midpoint-20260428-{synthesis,vision-analysis}.md` (어제 5-페르소나 + 비전 분석)
- 현 ROADMAP v1.2 (Step 11.6 진행 중)
- **v1.1 추가:** 외부 Claude (다른 채팅) cross review 메타 검토서 (진산님 가져옴, 2026-04-29) — 의문 3건 + 추가 권고 5건

**작성 동기:** 진산님 요청 — "이 두 폴더 문서 분석/검토해서 ThePick에 적용 가능한 방법을 정리. **개발속도 + 집중하고자 하는 것**이 핵심."

**문서 범위:** 두 방법론 흡수 + ThePick 현 상태(Step 11.6) + 다음 4.5주(BATCH-1 진입 → BATCH-1 dry-run → ADR-026/027/029/030 → BATCH-2~3) 매핑.

**v1.0 → v1.1 변경 요지:** 외부 cross review 의문 3건 평가 — 채택 6건 / 부분 채택 1건 / 거부 3건. 주요 변경: §0 정량 정정 (80% → 60%/35%/5%), §2.5 증거 표 신설, §5 +30% margin 명시, §6.6 방법론 paralysis 신호 추가, §7 결정 1에 검증 작업 추가, §8.6 외부 cross review 의무 명시, §9 갱신 트리거 보강. 상세 §10 참조.

---

## 0. TL;DR — 한 페이지

> **두 방법론은 ThePick에 이미 명시 적용 60% + 부분 적용 35% + 미적용 5%.** VOID DEV HARNESS v2 (DEFCON L1/L2/L3 + Reality Anchor + 4-Pass + Engine-First + Counter-Directive) + 5-페르소나 Phase 리뷰 + Hard Rule 15~17 + ExamAdapter 인프라 + Step 11.5/11.6 (recover/snapshot) — 헌법 v3.0 + 분할 방법론 v1.0의 핵심 원칙을 이미 코드로 실행 중이다. 단, "이미 적용" 정량 근거는 §2.5 증거 표 (v1.1 신설) 참조.
>
> **추가 채택 = 7건 (즉시, 비용 0~0.5d)**, **부분 채택 = 4건 (P1 시점, 약 1.5d)**, **비채택 = 5건 (현 단계 ROI 음수)**.
>
> **최우선 차단 가치:** v3.0 Vol XVI "Solo + L3 함정" + 분할 v1.0 "활성 ≤ 3 + 일일 머지" + Vol XIX "Heartbeat Paralysis 경고" 3건. 이 셋은 추가 작업 0d로 의식만 강화. **+ v1.1 추가: §6.6 "본 문서 자체 paralysis" 4번째.**

### 결론

| 카테고리                                    | 건수 |                           비용                           |
| :------------------------------------------ | :--: | :------------------------------------------------------: |
| ✅ 즉시 채택 (P0 — 본 문서 작성과 함께)     |  7   |                          0~0.5d                          |
| 🟡 부분 채택 (P1 — BATCH-1 dry-run 통과 후) |  4   |                          ~1.5d                           |
| 🔴 비채택 (현 단계 ROI 음수)                |  5   |                         0 (회피)                         |
| 합계 영향                                   |  —   | +1.5~2d (4.5주 일정 내, **현실 +30% margin 시 5.8~6주**) |

### v1.0 → v1.1 정량 정정 (외부 cross review §의문 1 흡수)

| 항목                            |      v1.0      |               v1.1 (정정)               |
| :------------------------------ | :------------: | :-------------------------------------: |
| Constitution v3.0 매핑 (11항목) |   "80% 적용"   | ✅ 7 / 🟡 4 / ❌ 0 = **64% / 36% / 0%** |
| Decomposition v1.0 매핑 (9항목) |   "80% 적용"   | ✅ 5 / 🟡 3 / ⚠ 1 = **56% / 33% / 11%** |
| **합계 (20항목)**               | **"이미 80%"** | **✅ 12 / 🟡 7 / ⚠ 1 = 60% / 35% / 5%** |

→ "80% 적용"은 인상 수치였음. 실측은 **명시 적용 60% + 부분 적용 35% + 미적용 5%**.

---

## 1. 두 방법론의 정체성 (1줄 요지)

### 1.1 메타엔진통합설계방법론 (Constitution v3.0)

> **"엔진은 결정성 우리에 비결정론적 야수를 가두는 독립체이며, 7단계 lifecycle + 5종 SLI + 5계층 테스트 + DEFCON × Engine 매트릭스로 자기 진단·복구·증거 기반 진화를 수행한다."**

19 Volume + 5 부록. 핵심:

- **Vol IV** LLM 격리 4계층 (Schema → Constraint → Cross → Graceful)
- **Vol V** 7단계 lifecycle + Resurrection (recover/snapshot 의무)
- **Vol VI** 5종 SLI (Latency/Throughput/Availability/Correctness/**Cost**) + Financial Circuit Breaker
- **Vol VII** 5계층 테스트 (Unit/Integration/Contract/**Property**/Chaos)
- **Vol VIII** DEFCON × Engine 21행 매트릭스 (자동 L3 트리거 7개)
- **Vol XIV~XVIII** 5종 도메인 프로파일 (Build / Library / Solo-Builder / Single-Vendor / Content Generation)
- **Vol XIX** 헌법 메타 진화 ("적용자가 Heartbeat Paralysis에 빠지면 헌법이 잘못된 것")

### 1.2 프로젝트분할개발방법론 (Decomposition v1.0)

> **"솔로 개발자가 대형 프로젝트를 복수 Claude Code 세션으로 안전하게 분할하기 위한 진단(PDS) → 패턴 선택(7종) → 역할 정의(Role Card 8섹션) → 정보 동기화(NOTICE) → 기획(Stage -1~0.8) → 운영(활성 ≤3) → 검증(9 Gate)의 7단계 체계."**

핵심 7개 분할 패턴:

```
P0 Single Module (Tiny~Small + Monolithic)
P1 Phase-based ★ (시간축 명확 + 학습 의존성)
P2 5-Plane Hybrid (SaaS — 책임 영역 다양)
P3 Pipeline Stage ★ (데이터 변환 체인)
P4 Domain Vertical (DDD Bounded Context)
P5 Core-Plugin (핵심 안정 + 확장 무한)
P6 Hybrid Composite (XLarge + 복수 특성)
```

★ = ThePick에 직결 (§3 매트릭스 참조).

---

## 2. ThePick 현 상태 — 명시 60% + 부분 35% + 미적용 5% (v1.1 정정)

| Constitution v3.0 항목                | ThePick 현재                                                                                                                                             |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vol IV LLM 격리 4계층                 | ✅ `docs/architecture/LLM_CONTAINMENT.md` 명시. parser batch-processor가 schema/constraint 검증, study-material-generator(Phase 2 예정)는 cross/graceful |
| Vol V 7단계 lifecycle                 | 🟡 partial — Step 11.6에서 `apps/batch` recover/snapshot 구현 중 (B-2 권고 흡수)                                                                         |
| Vol VI 5종 SLI + Cost Circuit Breaker | ✅ Step 1 cost-meter.ts (Application Layer) + ADR-025 Two-Layer (Anthropic Console cap)                                                                  |
| Vol VII 5계층 테스트                  | 🟡 partial — Property test가 Step 2~4에서 진입 예정                                                                                                      |
| Vol VIII DEFCON × Engine              | ✅ ROADMAP §0.5.1 + 5-페르소나 권고로 quality L2→L3 격상 + apps/batch L3 자동                                                                            |
| Vol XIV Build Engine Profile          | ✅ ROADMAP v1.2 §0.5 B-1: build_reproducibility invariant/tolerable 분리 명시                                                                            |
| Vol XV Library Engine Profile         | ✅ formula-engine + parser + quality 모두 packages/ 단독 (Engine-First Doctrine)                                                                         |
| Vol XVI Solo-Builder Profile          | ✅ 명시 인지 + L3 함정 회피 (Step 11.5에서 recover 즉시 구현, 이연 불가)                                                                                 |
| Vol XVII Single-Vendor Lock-in        | ✅ ADR-022 Cloudflare 5년 종속 수용 + OTel SDK 의무                                                                                                      |
| Vol XVIII Content Generation          | 🟡 Phase 2 study-material-generator 예정 (현 단계 미구현)                                                                                                |
| Vol XIX 헌법 메타 진화                | ✅ Reality Anchor + Counter-Directive + ADR 진화 패턴                                                                                                    |

| Decomposition v1.0 항목                        | ThePick 현재                                                                        |
| :--------------------------------------------- | :---------------------------------------------------------------------------------- |
| Pattern 1 Phase-based                          | ✅ 12-Step Engine Hardening Roadmap (Step 1 → 17, 시간축 명확)                      |
| Pattern 3 Pipeline Stage                       | ✅ BATCH 10단계 파이프라인 (parser → quality → study-material-generator)            |
| Stage 0.8 Task Contract                        | ✅ engine.contract.yaml × 3 (Step 1 cost-meter 등)                                  |
| Counter-Directive                              | ✅ CLAUDE.md "Hard Rule 15~17" + ".claude/rules/production-quality.md"              |
| RAR Cycle (인간 검수 → AI 반영)                | ✅ "기획과 다르면 인간 보고" 규칙 + 5-페르소나 → 진산님 결정 → v1.2 패치 흐름       |
| 핸드오프 (`.jjokjipge/handoff-session-NNN.md`) | ✅ session-013/014/015/016/017 영속 — NOTICE 시스템의 솔로 변형                     |
| 9 Gate 검증                                    | 🟡 partial — 4-Pass + 5-페르소나 = G0/G1/G2/G3/G4 + G5 부분 충족, G4.5/G5.5/G7 미정 |
| 활성 세션 ≤ 3 룰                               | 🟡 명시 안 됨 — 진산님 1인 + Claude 1 = 자연 ≤ 2                                    |
| 일일 머지 의무                                 | ⚠ 부분 — git commit은 자주, 단 main으로 매일 머지는 미관행 (현 main 작업)           |

**메시지:** 두 방법론은 "새로운 도입"이 아니다. **이미 적용된 것을 명시화 + 4건 보강 + 5건 의도적 거부**.

### 2.5 적용 증거 표 (v1.1 신설 — 외부 cross review §의문 1 + 권고 A 흡수)

✅/🟡/⚠ 분류의 정량 근거. 각 항목의 증거 파일/commit/규칙 위치 명시.

#### Constitution v3.0 (11항목)

| 분류 | Volume                                   | 증거 위치                                                                                          | 적용 강도                                                                                   |
| :--: | :--------------------------------------- | :------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
|  ✅  | Vol IV LLM 격리 4계층                    | `docs/architecture/LLM_CONTAINMENT.md`                                                             | 명시 — 설계 문서 + parser batch-processor 구현                                              |
|  ✅  | Vol VI Cost SLI + Circuit Breaker        | `apps/batch/src/cost-meter.ts` (Step 1) + `docs/adr/ADR-025-two-layer-cost-control.md`             | 명시 — Application Layer 코드 + ADR 영속                                                    |
|  ✅  | Vol VIII DEFCON × Engine                 | `~/.claude/CLAUDE.md` DEFCON 정책 + ROADMAP v1.2 §0.5.1 quality L3 격상                            | 명시 — 글로벌 규칙 + 로드맵                                                                 |
|  ✅  | Vol XIV Build Engine Profile             | ROADMAP v1.2 §0.5 B-1 (build_reproducibility invariant/tolerable 분리)                             | 명시 — 로드맵                                                                               |
|  ✅  | Vol XV Library Engine Profile            | `packages/{formula-engine,parser,quality,shared}/` 단독 패키지                                     | 명시 — 디렉토리 + Engine-First Doctrine                                                     |
|  ✅  | Vol XVI Solo-Builder + L3 함정 회피      | Step 11.5/11.6 plan + `apps/batch/src/checkpoint.ts` recover() 코드 진입 중                        | 명시 — plan + 코드                                                                          |
|  ✅  | Vol XVII Single-Vendor Lock-in           | `docs/adr/ADR-022-cloudflare-single-vendor-lockin.md` + 메모리 `feedback_single_vendor_cloudflare` | 명시 — ADR + 메모리                                                                         |
|  🟡  | Vol V 7단계 lifecycle (recover/snapshot) | Step 11.6 코드 진입 중 (`writeCheckpointSync` / `recover.ts`)                                      | 부분 — 5종 hook 중 recover/snapshot 미완                                                    |
|  🟡  | Vol VII 5계층 테스트 (Property/Chaos)    | Step 2~4 (Property test) Step 12 진입 예정                                                         | 부분 — Tier 1~2 ✅, Tier 3 contract Step 7 예정, Tier 4 Step 12 예정, Tier 5 Solo 보류 (R3) |
|  🟡  | Vol XVIII Content Generation Profile     | Phase 2 study-material-generator 미구현                                                            | 부분 — 설계 문서만                                                                          |
|  🟡  | Vol XIX 헌법 메타 진화                   | Reality Anchor + ADR 진화 패턴 (ADR-007/022/025 등) 적용 중                                        | 부분 — 패턴 적용 중, 헌법 메타 self-audit 미정기화                                          |

→ ✅ 7건 (64%) / 🟡 4건 (36%) / ❌ 0건 (0%).

#### Decomposition v1.0 (9항목)

| 분류 | 항목                            | 증거 위치                                                                                   | 적용 강도                                          |
| :--: | :------------------------------ | :------------------------------------------------------------------------------------------ | :------------------------------------------------- |
|  ✅  | Pattern 1 Phase-based           | `docs/plans/engine-hardening/ROADMAP.md` v1.2 (12 Step 로드맵)                              | 명시 — 로드맵                                      |
|  ✅  | Pattern 3 Pipeline Stage        | `apps/batch/` BATCH 10단계 파이프라인 + `apps/batch/src/process-batch.ts`                   | 명시 — 코드                                        |
|  ✅  | Stage 0.8 Task Contract         | `docs/plans/engine-hardening/step{1,5,11-6}-*.plan.md` (engine.contract.yaml 포함)          | 명시 — plan                                        |
|  ✅  | Counter-Directive               | `~/.claude/CLAUDE.md` Hard Rule 7건 + `.claude/rules/production-quality.md` Hard Rule 15~17 | 명시 — 글로벌 + 프로젝트 규칙                      |
|  ✅  | RAR Cycle (인간 검수 → AI 반영) | 5-페르소나 → 진산님 결정 → ROADMAP v1.2 패치 흐름 (영속 보고서)                             | 명시 — 워크플로우                                  |
|  🟡  | 핸드오프 시스템                 | `.jjokjipge/handoff-session-{013,014,015,016,017}.md` (NOTICE의 솔로 변형)                  | 부분 — NOTICE 풀 구현 X (R2 거부), 핸드오프 패턴만 |
|  🟡  | 9 Gate 검증                     | 4-Pass + 5-페르소나 = G0/G1/G2/G3/G4 + G5 부분, G4.5/G5.5/G7 미정                           | 부분 — A7로 P0 채택                                |
|  🟡  | 활성 세션 ≤ 3 룰                | 명시 안 됨 — 진산 1인 + Claude 1 = 자연 ≤ 2 (A6에서 명시화)                                 | 부분 — 자연 적용                                   |
|  ⚠   | 일일 머지 의무                  | git commit은 자주, 단 main 직커밋 + plane 브랜치 미관행                                     | 미적용 — A6에서 정정 (브랜치 정책 채택)            |

→ ✅ 5건 (56%) / 🟡 3건 (33%) / ⚠ 1건 (11%).

#### 통합

| 합계   |      ✅      |     🟡      |     ⚠      |
| :----- | :----------: | :---------: | :--------: |
| 20항목 | **12 (60%)** | **7 (35%)** | **1 (5%)** |

→ "이미 적용 80%"는 인상 수치였음. 정량 측정 결과 **명시 60% + 부분 35% + 미적용 5%**. 단 "미적용 1건"은 §3.1 A6으로 정정 채택.

---

## 3. ThePick 적용 매트릭스 — 채택/조정/비채택

### 3.1 ✅ 즉시 채택 (P0 — 추가 비용 0~0.5d)

|   #    | 항목                                               |               출처                | ThePick 적용                                                                                                                                                                                                         |                비용                |
| :----: | :------------------------------------------------- | :-------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------: |
| **A1** | **Volume XIV Build SLI 4종 명시**                  |        헌법 v3.0 Vol XIV.3        | apps/batch + parser + quality의 contract.yaml에 `build_time / build_cost / build_correctness / build_reproducibility(invariant/tolerable)` 4종 표면화. v1.2 ROADMAP에 이미 부분 반영 — Step 5 plan v1.1 작성 시 명시 |       0d (Step 5 작업 흡수)        |
| **A2** | **Volume XVI Solo + L3 트랩 인지**                 |         헌법 v3.0 Vol XVI         | "Solo이지만 L3 (apps/batch + formula-engine + quality)는 의무 이연 X" 원칙. **Step 11.5/11.6의 recover/snapshot이 정확히 이 트랩 회피.** 본 문서 §6 위험 신호에 영구 명시                                            |            0d (의식만)             |
| **A3** | **Volume XIX Heartbeat Paralysis 경고**            |        헌법 v3.0 Vol XIX.1        | "엔진 보강 1주 추가는 paralysis 아님 — 비가역성 비용 명확". 단, **다음 P1 (ADR-026/027/029/030 작성 시) 이 패러독스 진입 위험**. 4.5주 일정에서 P1 시간 box (≤4.5d) 의무                                             |            0d (의식만)             |
| **A4** | **Decomposition Pattern 1+3 Hybrid 공식 채택**     | Decomp v1.0 Pattern Catalog §1+§3 | 현 12-Step 로드맵 = Pattern 1 (Phase). BATCH 10단계 = Pattern 3 (Pipeline). 두 패턴 Hybrid 공식 채택 — 5-Plane은 거부(§3.3 R3 참조)                                                                                  |         0d (이미 진행 중)          |
| **A5** | **Stage 0.8 Task Contract → contract.yaml 의무화** |   Decomp v1.0 §6 + 헌법 Vol VII   | Step 16 = "선택" → "의무" 격상은 ROADMAP v1.2에서 흡수 완료. 추가로 **Step 11.6 / Step 5 / Step 6 / Step 7 모두 contract.yaml AC × 6 의무 명시** (5-페르소나 A-5 권고 정합)                                          | 0.2d (Step 11.6 plan v1.1에 흡수)  |
| **A6** | **분할 v1.0 §6 일일 머지 의무 + 활성 ≤ 2**         |         Decomp v1.0 §3+§7         | "main 머지 1일 1회 의무 + 충돌 폭발 방지". 솔로 + AI 페어 환경에서 활성 세션 ≤ 2 (메인 + 보조) 자연 적용. **다중 main 작업 시 plane/{topic}-{date} 브랜치 패턴 채택** (현재 main 직커밋 → 위험)                      |      0.2d (브랜치 정책 명시)       |
| **A7** | **9 Gate 중 G4.5 + G5.5 + G7 채택**                |    Decomp v1.0 §7 verification    | G4.5 = Cross-Plane(=Cross-Domain) E2E 테스트 (BATCH-1 dry-run에 매핑). G5.5 = 진산님 직접 사용 (인간 검수). G7 = BATCH-1 적재 가능 상태. **G0~G4는 4-Pass + Hard Rule이 이미 흡수 — 신규 도입 X**                    | 0.1d (BATCH-1 dry-run 명세에 흡수) |

**A1~A7 합계:** 0.5d 추가. 4.5주 일정의 1.6%.

### 3.2 🟡 부분 채택 (P1 — BATCH-1 dry-run 통과 후, ~1.5d)

|   #    | 항목                                                                |                출처                 | 적용 형태                                                                                                                                                                                    |                P1 비용                 |
| :----: | :------------------------------------------------------------------ | :---------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------: |
| **B1** | **헌법 Vol XIV.4 build_reproducibility 분리 의무화 (CI 차단)**      |          헌법 + Review B-1          | 현재는 ROADMAP v1.2에 명시만 됨. P1 시점에 **CI 의무 — invariant_fields 1.0 미만이면 PR 자동 차단**. ADR-027 (CBIV self-test)에 통합                                                         |                  0.5d                  |
| **B2** | **Decomposition v1.0 § Stage 0.5 Counter-Directive 전역 8개+ 명시** |           Decomp v1.0 §4            | 현재 CLAUDE.md "Hard Rule 15~17" + production-quality.md 분산. **단일 `docs/shared/COUNTER_DIRECTIVES.md` (UKE 시 universal 친화) 통합** — ADR-026 (Engine vs Service Boundary) 작성 시 흡수 |          0.3d (ADR-026 흡수)           |
| **B3** | **헌법 Vol XV Library Engine Profile 명시 → packages/quality 격상** | 헌법 v3.0 Vol XV.3 + 5-페르소나 A-1 | quality L2→L3 격상은 v1.2에 명시. P1에 **Property Test (Vol VII Tier 4) 100% 단위 커버리지** 의무화. ADR-026 또는 별도 ADR-031                                                               | 0.5d (Step 4 quality determinism 흡수) |
| **B4** | **Decomposition v1.0 NOTICE 시스템의 솔로 변형 명시**               |           Decomp v1.0 §4            | NOTICE는 멀티 세션 전제 — 솔로에서는 과잉. 단, **`docs/shared/` SSOT 위치 명시 + 변경 시 ADR 자동 발행** 패턴 (이미 부분 적용)을 명시화. ADR-026 흡수                                        |          0.2d (ADR-026 흡수)           |

**B1~B4 합계:** 1.5d. P1 (BATCH-1 dry-run 통과 후 1주) 작업 list (4.5d) 내 흡수.

### 3.3 🔴 비채택 (현 단계 ROI 음수 — 의도적 거부)

|   #    | 항목                                                  |               출처               | 거부 사유                                                                                                                                                                                                                                                                                                  |
| :----: | :---------------------------------------------------- | :------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | **5-Plane Hybrid 도입**                               |      Decomp v1.0 Pattern 2       | 솔로 + AI 페어 환경 + 12 Step 중간점에 5-Plane은 **셋업 비용 5~7일** (분할 v1.0 §0.1 표). 현 Pattern 1+3 Hybrid가 같은 가치 + 비용 0d. **Pattern 2는 Year 2 멀티시험 진입 시점 재평가**                                                                                                                    |
| **R2** | **NOTICE 시스템 풀 구현 (.claude/notices/)**          |      Decomp v1.0 §4 매체 2       | 솔로 + AI 페어에서 NOTICE의 비동기 알림 가치 0. 핸드오프(.jjokjipge/handoff-session-NNN.md) 패턴이 솔로 변형 — 이미 적용 중. **NOTICE 풀 구현은 Year 3+ 도메인 plugin 개발자 추가 시점**                                                                                                                   |
| **R3** | **Volume IX Chaos Test (Tier 5)**                     |  헌법 v3.0 Vol VII.1 + Vol VIII  | Solo-Builder 차등표(Vol XVI) 명시 — "Production canary 의무 / Solo는 시기상조". apps/batch L3이지만 사용자 0명 단계. **Phase 2 study-material-generator 진입 + 베타 사용자 모집 시점에 활성**                                                                                                              |
| **R4** | **8/11 페르소나 review (P1 시점)**                    | DEV COVEN 결함 3 + UKE 비전 § 3  | DEV COVEN 권고 8명 / 메타 감사 권고 11명. **현 5 페르소나(refactoring/performance/quality/backend/devops) + product-strategist + economist + ux-researcher = 8명**으로 P1 시점 1회. 11명 일괄은 sampling 한계 흡수 효과 미미. **단계적 (P1=8 / BATCH-3=+2 / BATCH-7=+1) 채택** — 메타 감사 §11.6 권고 정합 |
| **R5** | **헌법 Vol IX 안티패턴 카탈로그 #17 동시성 의무 e2e** | 헌법 v3.0 Vol IX.17 + Review B-4 | Idempotency 4 시나리오는 ThePick 환경(사용자 트리거 X)에서 솔로 변형 (두 Claude Code 세션 동시 / 진산님 트리거 키워드 중복 / recover 후 잔존)으로 매핑됨 — Step 5 / Step 11.6 명시 이연 9 AC 흡수. **풀 e2e 의무화는 멀티 사용자 진입 시점**                                                               |

**R1~R5 회피 가치:** 5~7d 셋업 비용 + 2~3d 정기 작업 = **약 10d 절감**. 4.5주 일정의 33%.

---

## 4. 통합 맵 — 12 Step 로드맵 + 방법론 적용

```
                                                                        Decomp v1.0
                  Constitution v3.0                                      Pattern 1 (Phase)
                  Volume 매핑                                            Pattern 3 (Pipeline)
                                                                         9 Gate 매핑
─────────────────────────────────────────────────────────────────────────────────────────
Step 1   Cost meter ──────────────── Vol VI (Cost SLI + 2-Layer)         G0 (lint/type)
Step 2   Formula property test ───── Vol VII Tier 4 + Vol XV Library     G3 (test 진실성)
Step 3   Parser determinism ──────── Vol VII Tier 4 + Vol XIV Build      G3
Step 4   Quality determinism ─────── Vol XV Library (L3 격상)             G3
Step 5   Reproducibility/Idemp ───── Vol XIV.4 invariant/tolerable        G2 (intent-code)
Step 6   Recover snapshot ────────── Vol V (Resurrection 의무)             G1 (Counter-Dir)
Step 7   Contract verify ─────────── Vol VII Tier 3 + Stage 0.8 Contract  G2
─────────────────────── 현재 위치 (Step 11.6 진행 중) ──────────────────────
Step 11.5 batch_runs DB + 0015 ────── Vol V Resurrection                  G1
Step 11.6 pipeline integration ────── Vol V + Vol XIV + Vol XVI Solo+L3   G2 + G4
─────────────────────── BATCH-1 진입 ──────────────────────────────────────
Step 12  Property test 회귀 ───────── Vol VII Tier 4                      G3
Step 13  Contract verify CI ────────── Vol VII Tier 3 (CI 차단)           G0+G2
Step 14  Reproducibility CI ────────── Vol XIV.4 (invariant 1.0 차단)     G2
Step 15  Idempotency e2e ────────────── Vol IX #17 (솔로 변형 4 시나리오) G3
Step 16  Contract.yaml 의무화 ─────── Stage 0.8 + Vol VII Tier 3          G0
Step 17  4-Pass + 5-페르소나 정기 ──── 헌법 Vol XIX 메타 진화             G1+G6
─────────────────────── BATCH-1 dry-run 통과 ── P1 진입 ───────────────────
P1     ADR-026 (Engine vs Service) ─── DEV COVEN 결함 4              ──── G6
P1     ADR-027 (CBIV self-test) ─────── 메타 감사 결함 2 (P2→P1)      ──── G6
P1     ADR-029 (북극성 KPI) ──────────── DEV COVEN 결함 8                G7
P1     ADR-030 (UKE Vision) ─────────── UKE 비전 + Year 2 (a~d) 분기    G6+G7
P1     8 페르소나 1회 ──────────────── DEV COVEN 결함 3 (단계적 8/10/11)
─────────────────────── P1 통과 ── BATCH-2~7 진입 ─────────────────────────
P2     Year 1 후반 ────────────────── 헌법 Vol XV Library 정기 review     G5
P2     packages/uke-core/ 분리 ─────── UKE Phase C
─────────────────────── Year 2 진입 ──────────────────────────────────────
P3     첫 새 도메인 plugin ─────────── UKE Phase D + Decomp Pattern 5
        (Core-Plugin 진입)
```

---

## 5. 다음 4.5주 — 일자별 배치

진산님 우선순위(개발속도 + 집중)에 맞춰 P0~P1을 시간 box.

### 5.0 일정 base-line vs 현실 (v1.1 추가 — 외부 cross review §의문 2 흡수)

본 문서 §8.2가 이미 인정한 낙관 편향을 §5 본문에 표면화:

| 시나리오                   |         기간         | 가정                                                                |
| :------------------------- | :------------------: | :------------------------------------------------------------------ |
| Best case (현 일자별 배치) |  **4.5주 (D1~D30)**  | 모든 box 정확 + 의외 사건 0                                         |
| 현실 (+30% margin)         | **5.8~6주 (D1~D40)** | ADR-030 box 초과 / dry-run 1차 실패 / Step 11.6 4-Pass 정정 1라운드 |
| 비관 (+50% margin)         | **6.7~7주 (D1~D45)** | dry-run 2차 실패 + UKE 비전 분기 plan 추가 작업                     |

**적용 규칙 (v1.1):**

- 일자별 box는 base-line. 진산님이 D14 (BATCH-1 dry-run 시점), D21 (P1 종료 시점) 두 체크포인트에서 box 초과율 측정.
- box 초과율 > 30% → §6 Heartbeat Paralysis 신호 활성. P1 작업 list 우선순위 재정렬.
- 진산님 capacity 보호는 메모리 `feedback_focus_reliability_not_schedule` 정합 — 일정 자체가 아니라 신뢰성 자가 점검 트리거. 본 문서는 일정 강제 X.

### Week 1 — Step 11.6 코드 진입 + BATCH-1 진입 게이트

| 일자      | 작업                                                              | 산출물                                                                    |     방법론 적용      |
| :-------- | :---------------------------------------------------------------- | :------------------------------------------------------------------------ | :------------------: |
| D1 (오늘) | 본 문서 v1.0 + 진산님 결정 (§7)                                   | `docs/방법론적용-ThePick-v1.0.md`                                         |      A1~A7 명시      |
| D2~D3     | Step 11.6 plan v1.1 (5-페르소나 14 CRITICAL 흡수) + 코드 구현     | `apps/batch/src/{signal-handlers,d1-batch-runs-db,checkpoint,recover}.ts` |      A1, A2, A5      |
| D4        | Step 11.6 4-Pass 독립 에이전트 리뷰                               | `.claude/reviews/step11-6-4pass-{date}.md`                                |          A5          |
| D5        | Step 12 Property test 회귀 자동화                                 | `packages/quality/test/property/*.test.ts`                                |     A1 (CI 의무)     |
| D6        | Step 13 contract verify CI 통합                                   | `.github/workflows/contract-verify.yml`                                   | A5 (Step 16 의무화)  |
| D7        | Step 14 Reproducibility CI + 0016 마이그레이션 + Step 5 plan v1.1 | `migrations/0016_*.sql` + Step 5 e2e                                      | A1, A6 (브랜치 정책) |

### Week 2 — Step 15~17 + BATCH-1 dry-run

| 일자    | 작업                                                            |  방법론 적용   |
| :------ | :-------------------------------------------------------------- | :------------: |
| D8~D9   | Step 15 Idempotency 솔로 변형 4 시나리오 e2e                    |     A1, A7     |
| D10     | Step 16 contract.yaml 의무화 (CI 차단)                          |       A5       |
| D11     | Step 17 4-Pass + 5-페르소나 결과 정기화                         |     A5, A7     |
| D12~D14 | **BATCH-1 dry-run** — apps/batch 첫 인간 검수 5건 + Golden Test | A7 (G7 게이트) |

### Week 3 — P1 진입 (BATCH-1 dry-run 통과 시)

| 일자    | 작업                                                                                                         | 산출물                                |  방법론 적용  |
| :------ | :----------------------------------------------------------------------------------------------------------- | :------------------------------------ | :-----------: |
| D15     | ADR-026 Engine vs Service Boundary                                                                           | `docs/adr/ADR-026-*.md`               |    B2, B4     |
| D16     | ADR-027 CBIV-Self-Test (설계만)                                                                              | `docs/adr/ADR-027-*.md`               |      B1       |
| D17~D18 | ADR-029 북극성 KPI 정의                                                                                      | `docs/adr/ADR-029-*.md`               |      B2       |
| D19~D20 | ADR-030 UKE Vision + Year 2 (a~d) 분기 plan                                                                  | `docs/adr/ADR-030-*.md`               |      B2       |
| D21~D22 | 8 페르소나 review 1회 (5 페르소나 병렬 + 3 추가 + 합성) — **1d → 2d 정정 (v1.1, 외부 cross review §권고 D)** | `.claude/reviews/8-persona-{date}.md` | A7, R4 단계적 |

### Week 4 — BATCH-2~3 진입 + 운영 안정화

| 일자    | 작업                                                                | 방법론 적용 |
| :------ | :------------------------------------------------------------------ | :---------: |
| D23~D25 | BATCH-2 적재 (검증 통과 후) — D21 1d 추가 흡수로 1일 시프트         |   A1, A7    |
| D26~D27 | BATCH-3 적재 + 진산님 G5.5 인간 검증                                |     A7      |
| D28~D29 | 운영 모니터링 셋업 (Cloudflare Workers Logs + Anthropic 콘솔 alert) |     B2      |

### Week 4.5 — 회고 + Phase 2 진입 결정

| 일자    | 작업                                                                                        |
| :------ | :------------------------------------------------------------------------------------------ |
| D30~D31 | Phase 1 → Phase 2 (study-material-generator) 진입 결정 + 회고 + 본 문서 v1.2 (P1 결과 흡수) |

**합계 (v1.1 정정):** base-line 4.5주 (D1~D31, D21 8 페르소나 2d 흡수로 +1d). 현실 +30% margin 시 5.8~6주 (D1~D40). 추가 비용 1.5~2d (P0 0.5d + P1 1.5d). 메모리 `feedback_focus_reliability_not_schedule` 정합 — 일정 보고가 아니라 자체 신뢰성 점검 트리거.

---

## 6. 위험 신호 — 어떤 시점에 무엇 활성화

### 6.1 Solo + L3 함정 (헌법 Vol XVI + 본 문서 §3.1 A2)

```
신호: apps/batch L3 자동이지만 사용자 0명 → Lifecycle 5종 중 healthCheck만 충분?
오답: "사용자 없으니 recover 이연"
정답: "L3 의무 이연 X — Step 11.5/11.6에서 recover/snapshot 즉시 구현 (이미 진행 중)"

체크 시점: Step 11.6 4-Pass 리뷰 (D4). recover() AC × 3 (R1~R3) 통과 의무.
```

### 6.2 Heartbeat Paralysis (헌법 Vol XIX + 본 문서 §3.1 A3)

```
신호 1: P1 시점 ADR 4건 작성에 5d+ 소요 (예상 4.5d)
오답: "완벽한 ADR 만들 때까지 BATCH-2 진입 보류"
정답: "ADR-026/029는 0.5d/1d box. ADR-030은 1d box. 초안 → ADR-030 v0.1 (incomplete) → P1.5에서 v1.0로 진화"

신호 2: 본 문서가 자기증식하여 v1.0 → v1.5 → v2.0 → v3.0 (paralysis)
오답: "방법론을 더 정교하게"
정답: "v1.1 (P1 통과 후 검증 결과 흡수) 1회만. 그 외는 ADR 작성 시 본 문서 reference로 사용"

체크 시점: D14 (BATCH-1 dry-run 통과 시) + D21 (P1 종료 시).
```

### 6.3 활성 세션 ≤ 2 위반 (분할 v1.0 §3 + 본 문서 §3.1 A6)

```
신호: 진산님이 "동시에 BATCH-2 적재 + ADR-030 작성 + Phase 2 진입 검토" 트리거
오답: "Claude Code 세션 3개 동시 활성"
정답: "메인 1 + 보조 1 (≤2). 3번째 작업은 큐에 대기. 매일 머지 의무로 충돌 0건 유지"

체크 시점: 매일 세션 시작 시 (CLAUDE.md 세션 규율 정합).
```

### 6.4 Premature ADR-030 (UKE 비전 분석 §10 + 본 문서 §3.1 A3)

```
신호: P1 진입 전 진산님 "UKE 비전 ADR-030 지금 쓰자" 요청
오답: "지금 쓰겠습니다 (BATCH-1 dry-run 차단)"
정답: "DEV COVEN + UKE 비전 둘 다 'BATCH-1 dry-run 통과 후 1주' 명시. P1 시점이 합리적. P0 작업 완료 + 본 문서 §6.2 Heartbeat Paralysis 회피 차원에서도 보류 권고"

체크 시점: 진산님 트리거 시 즉시.
```

### 6.5 5-Plane 도입 유혹 (분할 v1.0 Pattern 2 + 본 문서 §3.3 R1)

```
신호: ThePick 복잡도가 Pattern 1+3로 처리 안 된다고 느낌
오답: "5-Plane으로 마이그레이션"
정답: "복잡도가 Pattern 1+3로 안 되는 게 아니라 활성 ≤ 2 룰 위반. 세션 분할 (RAG/Gen/UI/Ops)이 아니라 시간 분할 (D1, D2, ...)이 솔로 + AI 페어의 답"

체크 시점: 사용자 100명+ 도달 시점 (Phase 3 베타).
```

### 6.6 본 문서 자체의 paralysis (v1.1 추가 — 외부 cross review §권고 C 흡수)

```
신호: 본 문서가 v1.0 → v1.1 → v1.5 → v2.0 자기 증식 (paralysis)
오답: "더 정교한 분석 매트릭스 / 더 많은 페르소나 review / 더 많은 증거 표"
정답: "본 문서는 §9 후속 갱신 트리거에 명시된 4건 외 갱신 금지.
       그 외는 ADR 작성 시 본 문서를 reference로만 사용.
       방법론 자체가 헌법 v3.0 Vol XIX Heartbeat Paralysis의 변형 — 자기 증식 차단 의무"

체크 시점: 매 v1.x 갱신 트리거 시. 진산님 응답 또는 P1/Phase 진입 외 갱신 X.

참조: §8.4 (강제 X, 참조 O) + §9 (4번 갱신 트리거).
```

---

## 7. 진산님 결정 요청

본 문서 v1.1 효력 발생을 위해 다음 3건 응답 필요:

### 결정 1 — 본 문서 §3 매트릭스 + §2.5 정량 증거 승인

본 문서 §3 (✅ 7건 / 🟡 4건 / 🔴 5건) 분류 + §2.5 증거 표 (적용 60% / 35% / 5%) 승인 여부.

응답 후보:

- **"승인 — §3 + §2.5 그대로"** → 본 문서 v1.1 효력 발생
- **"조정 — X건 재분류 또는 증거 보강"** → 본 문서 v1.2 정정
- **"중단 — 두 방법론 원문 재검토 후 결정"** → 외부 입력 권위 가정 자체 보류

### 결정 2 — 본 문서의 영속 위치 + 우선순위

응답 후보:

- **"`docs/방법론적용-ThePick-v1.0.md` 유지 (현 위치)"**
- **"`docs/architecture/방법론적용/ThePick-v1.1.md`로 이동"**
- **"`CLAUDE.md`에 본 문서 §6 위험 신호 6건만 요약 인용"** (v1.1 §6.6 추가 — 6건으로 증가)

### 결정 3 — P1 시점 정의

응답 후보:

- **"BATCH-1 dry-run 통과 직후 = P1 (현 plan)"**
- **"BATCH-1 본 적재 통과 후 = P1 (1주 추가 지연)"**
- **"P1 작업을 P0 (현재) 와 병행"** (Heartbeat Paralysis 위험 — 권고하지 않음)

---

## 8. 본 문서 자기 한계 명시

메인 컨텍스트의 본 문서 작성 자체에 대한 Devil's Advocate (Vol XIX 메타 진화 정합):

1. **자기 확인 편향 가능성:** 본 문서가 "이미 적용됨"을 결론. 그러나 본 문서 작성 전 ROADMAP v1.2 + 5-페르소나 + DEV COVEN + UKE 비전 모두 메인 컨텍스트가 작성 — **방어 본능 가능**. 진산님 두 방법론 원문 직접 sampling 권고. **v1.1 정정:** 외부 cross review §의문 1이 정확히 이 함정 발견 — "80% 적용" 인상 수치 → 정량 측정으로 60%/35%/5%로 정정. §8.6의 외부 cross review가 §8.1의 자연 보호 장치임을 확인.

2. **추가 비용 1.5~2d 추정의 낙관성:** P0 0.5d + P1 1.5d는 box 추정. 실제 P1 ADR 4건 작성 시 1건당 box 초과 시 5d+ 가능. **Heartbeat Paralysis 신호 (§6.2) + §5.0 +30% margin (v1.1 추가)** 가 그 보호.

3. **R1~R5 비채택의 과신:** 5-Plane / NOTICE / Chaos / 11 페르소나 / Idempotency e2e 의 "현 단계 ROI 음수" 판정은 솔로 + AI 페어 + Phase 1 가정. **Phase 2 (베타 사용자) 진입 시 R3 (Chaos), R5 (Idempotency e2e) 재평가 의무**.

4. **본 문서의 적용 의무 명시 부재:** 본 문서는 **참조 문서** — 강제 X. CLAUDE.md / production-quality.md / ROADMAP v1.2 만 강제. 진산님이 본 문서를 강제 문서로 격상 원할 시 결정 2 옵션 3 (CLAUDE.md 인용) 채택.

5. **방법론 v1.0 / v1.0 두 외부 문서의 권위 가정:** Constitution v3.0 + Decomposition v1.0 자체가 진산님 외부 입력 — **진산님 본인이 작성/검수했는지 미명시**. 본 문서는 두 문서가 권위 있다 가정. 권위 가정 거부 시 본 문서 §3 매트릭스 재검토.

6. **외부 cross review의 자연 작동 (v1.1 추가):** §8.1의 "방어 본능" 회피 책으로 v1.0은 "진산님 원문 sampling 권고"만 명시 — 외부 cross review가 정확히 §8.1 의도의 자연 작동임에도 강제 X. v1.0 → v1.1 변경 자체가 외부 cross review의 가치 증명. **§9 후속 갱신 트리거에 "외부 cross review 1회 권고"를 영속화** — 강제 X (메모리 `feedback_focus_reliability_not_schedule` 정합), 단 진산님 capacity 허용 시 v1.x 갱신 시 권고.

---

## 9. 후속 갱신 트리거 (v1.1 보강)

| 트리거                       | 갱신 종류                                           |   외부 cross review    |
| :--------------------------- | :-------------------------------------------------- | :--------------------: |
| 진산님 §7 결정 1~3 응답      | v1.1 → v1.1 효력 발생 (변경 0) 또는 v1.2 (조정)     |           —            |
| BATCH-1 dry-run 통과 (D14)   | v1.2 — P1 진입 결정 + 8 페르소나 결과 흡수          |          권고          |
| P1 통과 (D21~D22)            | v1.3 — ADR-026/027/029/030 결과 흡수 + R3/R5 재평가 | **권고 (의문 3 정합)** |
| Phase 2 진입 결정 (D30~D31)  | v2.0 — 베타 사용자 진입 시 본 문서 전면 재검토      |        **의무**        |
| **§6.6 paralysis 신호 활성** | v1.x 갱신 차단                                      |           —            |

**v1.1 추가 규칙:**

- "외부 cross review 권고/의무"는 강제 X. 진산님 capacity 허용 시 다른 채팅의 Claude 또는 외부 모델 1회 통과.
- 매 v1.x 갱신 시 §6.6 (방법론 paralysis 신호) 점검 — 본 문서 자기 증식 차단 의무.

---

## 10. 외부 cross review 흡수 종합 (v1.1 신설)

### 10.1 외부 검토서의 의문 3건 평가

|   #    | 의문                        |                평가                 | v1.1 반영                                                                |
| :----: | :-------------------------- | :---------------------------------: | :----------------------------------------------------------------------- |
| 의문 1 | "80% 적용" 정량 근거 부재   |      ✅ 강한 비판 — 매우 타당       | §0 정정 (80% → 60%/35%/5%) + §2.5 증거 표 신설 + 결정 1에 정량 검증 명시 |
| 의문 2 | D1~D30 일정 낙관 편향       |   🟡 부분 타당 — §8.2가 이미 인정   | §5.0 +30% margin 명시 추가 (v1.1)                                        |
| 의문 3 | "진산님 sampling 권고" 약함 | 🟡 부분 타당 — 진산님 capacity 한계 | §8.6 + §9 외부 cross review 권고 명시 추가 (v1.1)                        |

### 10.2 외부 검토서의 추가 권고 5건 평가

|   #    | 권고                                         |     평가     | v1.1 반영                                                                                                                                                                                                  |
| :----: | :------------------------------------------- | :----------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 권고 A | §2 매트릭스 증거 파일 30분 검증              |   ✅ 채택    | §2.5 증거 표 신설 (v1.1) — 의문 1과 통합                                                                                                                                                                   |
| 권고 B | §9에 "외부 cross review 의무" 추가           | 🟡 부분 채택 | §9 트리거 표에 권고 명시 (의무 X — 메모리 정합)                                                                                                                                                            |
| 권고 C | §6.6 "방법론 paralysis" 신호 추가            |   ✅ 채택    | §6.6 신설 (v1.1)                                                                                                                                                                                           |
| 권고 D | D21 8 페르소나 1d → 2d                       |   ✅ 채택    | §5 Week 3 정정 (D21~D22), Week 4~4.5 1일 시프트                                                                                                                                                            |
| 권고 E | ADR-030 작성 전 UKE 비전 별도 review session |   🔴 거부    | UKE 비전 분석 보고서 (`engine-hardening-vision-analysis-20260428.md` v1.1)가 이미 영속 입력. 별도 session은 §6.6 paralysis 위험. ADR-030 작성 시 그 보고서를 reference 의무로만 명시 (P1 작업 list에 추가) |

### 10.3 외부 검토서의 명시적 거부 항목

|   #    | 항목                                       | 거부 사유                                                                                                  |
| :----: | :----------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| 거부 1 | 검토서의 §7 결정 가이드 (Claude 권고 채택) | 메모리 `feedback_no_granular_decisions` 정합 — 진산님 결정 영역. v1.1 §7은 결정 후보만 유지, Claude 권고 X |
| 거부 2 | fluxbeam plan 비교 매트릭스                | fluxbeam은 본 작업과 무관 프로젝트 — 메모리에 부재. 비교 흡수 시 본질 분석 약화                            |
| 거부 3 | MEPHISTO 페르소나 종합 판결 형식           | 본 문서는 진산님 결정 도구 — 페르소나 장식 거부. 사실 + 매트릭스 + 결정 후보로 한정                        |

### 10.4 외부 검토서가 발견한 본 문서 강점 (자기 확인용 — 채택 X)

검토서가 "fluxbeam plan 대비 우수"로 평가한 5건 — 본 문서 §8 자기 한계 명시 / §6 위험 신호 / §3.3 비채택 명시 / §7 결정 후보 / §9 갱신 트리거. 단 **자기 강점 인용은 §8 자기 확인 편향 #1과 직결** — 본 §10.4는 외부 검토자의 평가만 기록, 본 문서가 자기를 우수로 평가하지 않음.

### 10.5 v1.0 → v1.1 변경 종합

| 섹션           |         v1.0         |                                  v1.1                                   |
| :------------- | :------------------: | :---------------------------------------------------------------------: |
| 헤더           |      작성일 1건      |       작성일 2건 + 입력 자료에 외부 검토서 추가 + 변경 요지 명시        |
| §0 TL;DR       | "80% 적용" 인상 수치 |                     정량 정정 표 + 60%/35%/5% 명시                      |
| §2 매핑 표     | 11+9 항목 매트릭스만 |            + §2.5 증거 표 (각 항목의 commit/파일/규칙 위치)             |
| §5 일자별 배치 |  best case 4.5주만   | + §5.0 base-line vs 현실 (+30% margin 5.8~6주) + D21 8 페르소나 1d → 2d |
| §6 위험 신호   |   5건 (§6.1~§6.5)    |                      6건 (+ §6.6 방법론 paralysis)                      |
| §7 결정 1      |   매트릭스 승인만    |                       + §2.5 정량 증거 승인 통합                        |
| §8 자기 한계   |         5건          |                6건 (+ §8.6 외부 cross review 자연 작동)                 |
| §9 갱신 트리거 |         4건          |   5건 (+ §6.6 paralysis 신호 차단 명시) + 외부 cross review 권고 컬럼   |
| §10 (NEW)      |         없음         |                       외부 cross review 흡수 종합                       |

---

**문서 위치:** `docs/방법론적용-ThePick-v1.0.md` (v1.1 갱신 — 파일명 유지, semver minor)
**선조 문서:**

- `docs/메타엔진통합설계방법론/VOID_ENGINE_DESIGN_CONSTITUTION_v3.0_FINAL.md`
- `docs/프로젝트분할개발방법론/00-master-index.md`
- `docs/plans/engine-hardening/ROADMAP.md` (v1.2)
- `.claude/reports/engine-hardening-midpoint-20260428-synthesis.md`
- `.claude/reports/engine-hardening-vision-analysis-20260428.md` (v1.1)

**v1.1 입력:** 외부 Claude (다른 채팅) 메타 검토서 (2026-04-29, 진산님 가져옴)

**아카이브:** Phase 1 종료 시 `docs/reports/archive/2026{MMDD}-방법론적용-v1.x.md`
