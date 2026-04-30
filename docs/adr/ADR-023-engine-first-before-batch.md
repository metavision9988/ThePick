# ADR-023: Engine-First Before BATCH-1 — 엔진 보강 선행 결정

- **상태:** Accepted
- **결정일:** 2026-04-27
- **결정자:** 진산
- **관련 헌법:** VOID ENGINE DESIGN CONSTITUTION v3.0 Volume XIV (Batch/Build), XV (Library), Engine-First Doctrine (`/user:engine`)
- **관련 메모리:** `project_content_build_engine_as_core` (무결성 위배 시 모든 plan 최우선 차단), `feedback_no_shortcuts` (땜빵 금지)
- **관련 문서:** `docs/plans/engine-hardening/ROADMAP.md` v1.1
- **트리거:** 진산님 직관 — "엔진부터 제대로 되야 학습자료 배치도 잘 되는 거 아닌가? 나중에 배치를 다시 하지 않아도 되잖아."

---

## 1. Context (맥락)

### 1.1 직전 상황

Phase 1 Step 1-5 (가-1) BATCH-1 적재 진입 대기 중. Claude의 v3.0 헌법 갭 분석 후 직전 권고:

> "C: Cost meter + ADR-022 선행, 나머지 ★2~★4·★6은 BATCH-1~3 적재 동안 병행"

진산님이 다음과 같이 정정:

> "배치는 엔진부터 제대로 되야 학습자료 배치도 잘 되는 거 아닌가? 그래서 엔진부터 제대로 구성해야 나중에 배치를 다시 하지 않아도 되잖아."

### 1.2 직전 권고의 자기모순

Claude의 "병행" 권고는 다음을 위배했다:

| 위배 대상                                     | 위배 내용                                                                                                              |
| :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| `/user:engine` Doctrine                       | "코어 로직을 단독 패키지로 격리하고 RTV/AC/Soak로 검증한 후에야 UI/통합 허용" — BATCH 적재 = 통합. 검증 전 통합은 위배 |
| 메모리 `project_content_build_engine_as_core` | "BATCH 적재 체계는 프로젝트 정체성. 무결성 위배 시 모든 plan 최우선 차단" — 엔진 검증 미완 = 무결성 미보장             |
| v3.0 Vol XIV.4 Build SLO                      | `build_correctness: 0.999`, `build_reproducibility: 1.0` 의무 — 측정 도구(Property test) 미존재 상태에서 적재          |
| v3.0 Vol XV.3 Library 의무 5요소 #1           | "Property Test (Tier 4) — 결정성·회귀 차단 (가장 중요)" — formula-engine은 L3인데 Property test 0건                    |

→ 자기모순 인정, 결정 정정 필요.

### 1.3 BATCH 적재의 비가역성 분석

BATCH 적재는 단순 ETL이 아니라 **D1에 영구 저장되는 지식 그래프의 토대**. 그 위에 모든 학습 콘텐츠가 생성된다:

```
BATCH 적재 → D1 INSERT (state=draft)
         → 인간 검수 (state=approved)
         → study-material-generator (Phase 2 콘텐츠 생성)
         → 사용자 학습 (Phase 3)
         → user_progress 누적 (Phase 4 운영)
```

엔진 결함을 사후 발견 시 비용 (시점 늦을수록 기하급수):

| 발견 시점              | 비용                                                    |
| :--------------------- | :------------------------------------------------------ |
| BATCH-1 직후           | 인간 검수 재실행 (반나절)                               |
| BATCH-3 누적 후        | 인간 검수 × 노드 수 + CBIV 회귀 재실행 (수일)           |
| Phase 2 콘텐츠 생성 후 | + 생성 콘텐츠 폐기 + 재생성 (수주)                      |
| Phase 3 사용자 학습 후 | + user_progress 마이그레이션 + 옛 노드 ID 매핑 (수개월) |

Temporal Graph (UPDATE 금지 + INSERT + SUPERSEDES) 가 일부 보호하지만 — 비용 자체는 막지 못함.

---

## 2. Decision (결정)

### 2.1 핵심

**BATCH-1 적재 진입 전, 의존하는 3개 엔진(`packages/formula-engine` + `packages/parser` + `packages/quality`)의 결정성·재현성·계약을 100% 검증·문서화하고, L3 엔진(`apps/batch`, `formula-engine`, `quality`)에는 `recover()`/`snapshot()`을 의무 구현한 후 적재한다.**

### 2.2 의존성 사슬

```
formula-engine + parser + quality (Library 3종, BATCH-1 직접 의존)
  ↓
apps/batch (Pipeline 오케스트레이터, L3, recover/snapshot 의무)
  ↓
BATCH-1 적재 (= 통합)
  ↓
D1 영구 저장 → 학습 콘텐츠 생성 → 사용자 학습
```

엔진 검증 통과 후에만 다음 단계 진입 — 일방향 게이트.

### 2.3 일정 영향

| 추정                    | 일수                                |
| :---------------------- | :---------------------------------- |
| 낙관                    | 6.5일                               |
| 현실 (×1.5 calibration) | 11일                                |
| 비관 (×2.0)             | 15일                                |
| 12일 초과 시            | 본 로드맵 자체 재검토 (스코프 축소) |

세부 단계는 `docs/plans/engine-hardening/ROADMAP.md` Section 3.2 참조.

### 2.4 차단 / 이연 분리

| 항목                                    | 차단 (보강 필수) |                   이연                    |
| :-------------------------------------- | :--------------: | :---------------------------------------: |
| formula-engine Property test            |        ✅        |                                           |
| parser 결정성 test (invariant 분리)     |        ✅        |                                           |
| quality (CBIV) Property test            |        ✅        |                                           |
| `apps/batch` Cost meter (Layer 1+2)     |        ✅        |                                           |
| `apps/batch` recover/snapshot (L3 의무) |        ✅        |                                           |
| Reproducibility + Idempotency test      |        ✅        |                                           |
| engine.contract.yaml × 3                |        ✅        |                                           |
| ADR 022/023/024/025                     |        ✅        |                                           |
| LLM_CONTAINMENT.md                      |        ✅        |                                           |
| ai-adapter 실구현                       |                  |        Phase 3 Vision OCR 진입 전         |
| Lifecycle 5종 (L1/L2 엔진)              |                  |         Phase 2 첫 사용자 1주 전          |
| OpenTelemetry SDK                       |                  |            Phase 2 출시 1주 전            |
| AIEC 코드 구현                          |                  | 결제 mock → 실결제 전환 14일 전 (ADR-024) |
| Tier 5 Chaos Test (사용자 영향)         |                  |          Phase 2 베타 100명 시점          |
| study-material-generator                |                  |    Phase 2 Content Generation 진입 전     |

---

## 3. Consequences (결과)

### 긍정적

- 재적재 비용 (수일~수개월) 사전 차단 — ROI 명백히 양수
- v3.0 헌법 Vol XIV/XV 정합 100%
- 진산님 Engine-First 직관 = `/user:engine` Doctrine = v3.0 Vol XV.3 = 메모리 `project_content_build_engine_as_core` 4중 정합
- BATCH-1 적재 = "신뢰할 수 있는 첫 박동" (v3.0 Vol XIII.5 정의)

### 부정적

- BATCH-1 적재 진입 11일 (현실 추정) 지연
- 진산님이 일정에 민감하지 않다 명시했으므로 (메모리 `feedback_focus_reliability_not_schedule`) 수용 가능

### 책임 / 향후 변경 트리거

| 트리거                                                             | 행동                                    |
| :----------------------------------------------------------------- | :-------------------------------------- |
| 엔진 보강 12일 초과                                                | 본 ADR 보강 ADR 작성 (스코프 축소 결정) |
| 엔진 보강 중 더 큰 결함 발견                                       | Engine Hardening Roadmap v1.2 패치      |
| Phase 2~3 진입 시 추가 엔진(study-material-generator 등) 보강 필요 | 본 ADR 패턴 재적용 — 새 ADR 작성        |

---

## 4. Alternatives Considered (대안)

| 대안                                                                        | 장점                     | 단점                                                               | 미선택 이유                                       |
| :-------------------------------------------------------------------------- | :----------------------- | :----------------------------------------------------------------- | :------------------------------------------------ |
| **A. 즉시 BATCH-1 적재 + 엔진 보강 후행**                                   | 빠른 첫 박동 (1일)       | 결함 발견 시 재적재 비용 폭발                                      | Engine-First Doctrine 위배, 진산님 직관 위배      |
| **B. BATCH-1 적재 + 엔진 보강 병행**                                        | 일정 압축                | "병행"이지만 사실상 검증 미완 적재 = A와 동일                      | 직전 Claude 권고 — 자기모순 인정 후 폐기          |
| **C. 엔진 보강 7~10일 선행 + 적재** (본 ADR)                                | 재적재 위험 0, 헌법 정합 | 적재 진입 11일 지연                                                | **선택 — 진산님 직관 + 헌법 4중 정합**            |
| **D. 엔진 풀스택 (Lifecycle hook + OTel + AIEC + Chaos) 모두 보강 후 적재** | 헌법 100% 적용           | Premature Generalization (v3.0 Vol IX.9), Solo-Builder 단계엔 과도 | v3.0 Vol XVI Solo-Builder 차등표 활용 — L3만 우선 |

---

## 5. Migration / Backward Compatibility

해당 없음 — 본 ADR은 작업 순서 결정. 코드 변경 없음.

단, 본 ADR 작성 후 즉시 발생하는 작업:

- ADR-022, 024, 025 동시 작성 (Engine Hardening Roadmap Step 1, 3, 4)
- `docs/architecture/LLM_CONTAINMENT.md` 작성 (Step 5)
- `docs/engines/{formula-engine,parser,quality}/` 디렉토리 활용 (Step 6)

---

## 6. SLO Impact

본 ADR 자체는 작업 순서 결정 → SLO 변경 없음.

단, 본 ADR이 명령하는 엔진 보강 결과로 다음 SLO가 처음으로 측정 가능해짐:

| SLO                                         | 보강 전 (현재) | 보강 후 (목표)                        |
| :------------------------------------------ | :------------- | :------------------------------------ |
| `build_correctness`                         | Golden 5건만   | 0.999 (Property + Golden + 인간 검수) |
| `build_reproducibility.invariant_threshold` | 미측정         | 1.0 (100%)                            |
| `build_reproducibility.tolerance_threshold` | 미측정         | 0.05 (5% — parser PDF 노이즈)         |
| `build_cost_max_usd`                        | 미측정         | ≤ $10 (BATCH-1 1회 실행)              |
| `build_time_max_minutes`                    | 미측정         | ≤ 60분                                |

---

## 7. Human Decision Required

- [x] Approved (진산님 2026-04-27 — Engine Hardening Roadmap v1.1 승인 메시지)
- [ ] Rejected
- [ ] Modified

**Reviewer:** 진산
**Date:** 2026-04-27

---

## 8. 부록 — 진산님 직관의 헌법 4중 정합

본 ADR은 1개 권고를 4개 독립 출처가 동일하게 명령했다는 사실을 기록:

| 출처                                          | 명령                                                                                             |
| :-------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| 진산님 직관                                   | "엔진부터 제대로 되야 학습자료 배치도 잘 되는 거 아닌가? 나중에 배치를 다시 하지 않아도 되잖아." |
| `/user:engine` Doctrine (글로벌)              | "코어 로직을 단독 패키지로 격리하고 검증한 후에야 통합 허용"                                     |
| v3.0 Vol XV.3 #1                              | "Property Test — 결정성·회귀 차단 (가장 중요)"                                                   |
| 메모리 `project_content_build_engine_as_core` | "BATCH 적재 체계는 프로젝트 정체성. 무결성 위배 시 모든 plan 최우선 차단"                        |

→ Reality Anchor 차원에서 "이 결정이 틀릴 가능성"이 매우 낮음.
