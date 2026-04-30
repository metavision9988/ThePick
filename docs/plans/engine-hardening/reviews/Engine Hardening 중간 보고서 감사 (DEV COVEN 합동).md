# Engine Hardening 중간 보고서 감사 (DEV COVEN 합동)

> **검토 대상:** `engine-hardening-midpoint-20260428.md` (v1.0) + `5-페르소나 통합 보고서`
> **작성:** 2026-04-28 (메피스토펠레스 + 작업 파트너 모드)
> **모드:** 칭찬 0, 결함만 — 진산님 요청 "다양한 관점에서 미흡/보완/개선"
> **상위:** [감사 보고서 v2.1](./AUDIT_REPORT_v2_1.md)

---

## 0. 핵심 진단 한 줄

> **"엔지니어링 80점, 비전 정합성 40점.**
> 4-Pass 리뷰의 자기 발견 능력은 인정.
> 5-페르소나 통합도 정직.
> 그러나 **본 보고서 어디에도 '이 엔진의 최종 형태'가 없다.**
> '손해평가사 첫 적재'에 시야가 묶여 있다."

---

## 1. 본 보고서의 강점 (간단히)

DEV COVEN 합의 — 이 5건은 정직하게 인정:

1. **자가 진단 능력**: 진척률 54% 명시, 갭 분석 9건 정직
2. **4-Pass 리뷰 자기 학습**: "1차 리뷰는 거의 항상 CRITICAL 1건 이상 발견" 패턴 인지
3. **5-페르소나 진위 검증**: 14 CRITICAL 중 R-C1 / Q-C1 진위 확인
4. **이연 13건 명시 분류**: Engine 내부 6건 / 외부 7건 책임 명확
5. **현실 vs 비관 시간 추정**: 11d → 13~14d (+18%) 비관 15d 안전 범위 내

이상 5건이 없었다면 본 보고서 자체가 무가치. 그러나:

---

## 2. 결함 8건 (메피스토 모드 — 8 페르소나 합동 발견)

### 🔴 결함 1: 비전 누락 (가장 큰 결함)

**ARCHITECT + ORACLE 합동 분석:**

본 보고서 어디에도 다음 질문이 없습니다:

- "이 엔진의 최종 형태는?"
- "BATCH-14 완료 = Engine 의 어떤 상태?"
- "다음 자격증 진입 = Engine 의 어떤 변화?"
- "북극성을 측정 가능한 KPI 로 어떻게?"

**현 보고서:**

- §0 한 줄 결론: "Engine Hardening 약 55% 진척"
- §2 Phase 진행도: Phase 5 (BATCH 적재) = "별도 plan, 0%"
- §10 다음 결정: A~E 5건 모두 **Step 11.6 코드 / Step 5 plan / ROADMAP / Property test / Anthropic cap** 의 micro-tasks

**비전 부재의 증거:**

- 진산님 메모리 `project_vision_mvp_generalization.md`: "다양한 자격증 범용 엔진"
- 본 보고서: "손해평가사" 만 등장
- 진산님 메모리 `feedback_focus_reliability_not_schedule`: "신뢰성 차원 자체 점검"
- 본 보고서: 일정/진척률 위주

**ORACLE 의 본질적 지적:**

> "북극성 = 생성물 신뢰성·정확성. 그러나 본 보고서는 '신뢰성을 어떻게 측정하는가' 에 답이 없다. 진척률 54% 가 신뢰성과 무슨 관계인가? CBIV 통과율? 학습자 합격률? 출처 정확도? 측정 KPI 부재 = 비전이 추상적인 채로 남음."

**개선 방향:**

- 보고서에 "**비전 정합성 섹션**" 신설:
  - 현재 = 손해평가사 단일 엔진
  - Year 2 = 멀티시험 (이미 명시)
  - Year 3+ = 다양한 도메인 (시험/학습/암기/코딩) — **현 엔진은 가능한가?**
- 측정 가능한 KPI 명시:
  - CBIV 통과율 100%
  - Stage 5 회귀 Golden 100%
  - 학습자 시험 합격률 (BATCH-1 적재 후 진산님 자가 검증)
  - 출처 정확도 (page_ref 일치율 95%+)

---

### 🔴 결함 2: 진척률 54% 의 신뢰성 문제

**HACKER + GHOST 합동 분석:**

§2 진척률 계산 근거:

```
Phase 0/1 (문서) = 30%, Phase 2 (plan) = 30%,
Phase 3 (코드) = 40%, Phase 4 (검증) = 20%,
Phase 5 (BATCH 적재) = 10%
```

**문제: weight 자의적 + Phase 5 = 10% 비현실적**

**HACKER 의 분석:**

- BATCH 적재 = **첫 production 검증**
- 코드 64/64 PASS = 단순 unit test
- 두 가지가 같은 weight (10% vs 40%) 는 산업 상식 위반
- 표준: production 검증 = 30~50% weight

**GHOST 의 분석:**

- 본 보고서의 진척률 54% 는 "**문서 + 코드 = 90%**"
- 그러나 production 검증 0건
- "**0건 production 검증** 은 실제로 0% 진척" 일 수 있음

**BREAKER 의 함정 지적:**

> "진척률 54% 라는 표현이 진산님에게 '거의 절반 왔으니 Year 2 까지 멀지 않다' 는 잘못된 인상을 준다. 실제로 BATCH-1 dry-run 통과 = 신뢰성 30~40% 진입. 그 이후 BATCH-2~14 + 첫 자격증 사용자 검증 + 다음 도메인 시도 = 90% 까지 멀다."

**개선 방향:**

- 진척률 정의 재검토:
  - Phase 5 (BATCH 적재) = **30~50% weight**
  - 새 KPI: "**Production-validated 진척률**" 신설
- 정직한 진척률 추정:
  - 현재 = "**인프라 70% / production 검증 0% / 비전 진척 5%**"

---

### 🔴 결함 3: 5-페르소나 sampling 한계

**MEPHISTO 의 분석:**

5-페르소나 = refactoring/performance/quality/backend/devops
**모두 엔지니어링 페르소나**

**누락된 페르소나:**

| 페르소나               | 핵심 질문                                               | 본 보고서에서의 영향 |
| ---------------------- | ------------------------------------------------------- | -------------------- |
| **product-strategist** | "이 엔진이 1년 후 손해평가사 외에 무엇을 할 수 있는가?" | 비전 정합성 검증     |
| **economist/CFO**      | "엔진 개발 비용 vs 손해평가사 + 향후 도메인 매출?"      | ROI 미측정           |
| **ux-researcher**      | "학습자가 이 엔진의 산출물로 합격하는가?"               | 사용자 영향 미검증   |
| **legal/compliance**   | "26→27→28년 매년 개정 시 법적 보존 의무?"               | 데이터 정책          |
| **content-strategist** | "BATCH-1~14 = 손해평가사. BATCH-15+ 는?"                | 콘텐츠 로드맵        |
| **domain-expert**      | "손해평가사 강사가 이 KG 를 보고 OK 하는가?"            | 콘텐츠 정확성        |

**ORACLE 의 본질적 지적:**

> "5명 모두 '코드가 안전한가' 만 묻는다. '시스템이 진산님의 비전을 향해 가는가' 묻는 페르소나가 0명. 결과: 본 보고서 = 엔지니어링 안전성 검증 보고서. 비전 정합성 검증 보고서가 아니다."

**개선 방향:**

- 다음 중간 보고서 = **8-페르소나** (위 추가)
- product-strategist + economist 는 BATCH-1 적재 후 즉시 작성 권고
- domain-expert = 손해평가사 강사 (외부 인력) 1명 의뢰 — 진산님 외부 검수 의뢰 필요

---

### 🔴 결함 4: Engine vs Service 경계 모호

**ARCHITECT + ADVOCATE 합동:**

**현 보고서의 모순:**

- §3.1 ADR-024 (Payment AIEC) = **결제 = 서비스 영역**
- §7 이연 7건 중 "Lifecycle 5종 hook (L1/L2 엔진)" = **엔진?**
- §7 이연 "AIEC 코드 구현" = **서비스?**

**핵심 질문:**

- "엔진의 boundary 는 어디까지?"
- 결제, 인증, FSRS = 서비스
- LLM Containment, Cost Meter, Pipeline Recover = 엔진?

**ADVOCATE 의 분석:**

- 진산님 비전 (Universal Engine) 을 위해서는 boundary 명확 필수
- 현 boundary 흐림 = 엔진이 service-specific 코드 흡수 → universal 무력화

**제안 boundary:**

```
Engine (universal, 도메인 무관):
  - Ontology, Validation, Version Management, Loader
  - CBIV, Source Citation
  - Computational plugin (산식 / 코드 평가 / 확률)

Service (domain-specific):
  - 학습자 UX (FSRS, 진도 추적)
  - 결제, 인증
  - AIEC, 운영 RAG
  - admin-web (검수 UI 는 엔진 인접)
```

**개선 방향:**

- ADR-026 신설: "Engine vs Service Boundary"
- 현 ADR 들의 분류:
  - ADR-022 (Cloudflare 단일 벤더) = **Infrastructure**
  - ADR-023 (Engine-First) = **Engine**
  - ADR-024 (Payment AIEC) = **Service** ← 별도 그룹
  - ADR-025 (Two-Layer Cost) = **Engine + Infrastructure**

---

### 🟠 결함 5: CBIV 의 self-reflection 부재

**BREAKER 의 본질적 지적:**

5-페르소나 통합 §4 Devil's Advocate (quality):

> "Step 4 quality determinism + Step 5 reproducibility + Step 11.6 e2e 가 함께 PASS 해야 진정한 e2e"

그러나 본 보고서 어디에도 **"CBIV 자체에 대한 메타 검증"** 부재.

**가능한 시나리오:**

- CBIV Stage 5 (회귀 Golden) 가 false positive 못 잡으면?
- CBIV Stage 2 (의미 중복) 의 AI 추천이 99% 신뢰도라면?
- CBIV root-cause-analyzer 가 잘못된 정정안 제안하면?
- CBIV 의 6단계 모두 통과하나 실제 학습자가 시험 못 풀면?

**HACKER 의 분석:**

- CBIV-Self-Test 패턴 부재
- Meta-validator 가 CBIV 의 결과를 검증하는 layer 0건

**SENTINEL 의 보안 관점:**

- CBIV 가 시스템의 마지막 자동 검증 line
- CBIV 자체 fail 시 복구 메커니즘 부재
- = single point of failure

**개선 방향:**

- 신규 모듈: **CBIV-Self-Test**
  - CBIV 의 의도된 fail 시나리오 1000건 자동 주입
  - "CBIV Stage 5 가 모두 100건의 의도적 회귀 시나리오를 잡는가?"
  - 매 BATCH 적재 후 자동 실행
- ADR-027: "CBIV Meta-Validation"

---

### 🟠 결함 6: Domain-agnosticism 명시 부재

**ORACLE 의 본질적 지적:**

ContentBuildEngine.md v2.1:

- §5 Year 1/Year 2 전환 = "멀티시험"
- §3.1 입력: "교재/기출/법령/개정사항"
- §1 Year 1 한시 예외: INSURANCE/CROP/INV (시험 도메인)

**현 엔진의 implicit 가정:**

1. 입력 = 교재 PDF
2. 출력 = 산식 + 법령 + 개념
3. 검증 = 기출 정답 자동 풀이
4. 사용자 = 시험 응시자

**진산님 비전 (다양한 도메인):**

- 입력 = 교재 / 코드 저장소 / 강의 영상 / 매뉴얼 / 논문
- 출력 = 다양한 형태
- 검증 = 도메인별 (코드 실행, 원어민 검토, 임상 검증)
- 사용자 = 시험 / 학습 / 암기 / 코딩 / 일반 교양

**ARCHITECT 의 분석:**

> "현 엔진의 abstraction level 이 '시험 도메인' 에 묶여 있다. Year 2 멀티시험 = 같은 abstraction level 내 확장. 진산님 비전 = abstraction level 자체 변경 = 엔진 재설계 필요."

**개선 방향:**

- ADR-028: "Domain-Agnostic Engine Abstraction"
- 현 5 코어 모듈 중 의문 영역 식별:
  - Computational plugin = math.js 만 (산식만)
  - Source Citation = page_ref 만 (책만)
- 추상화 layer 신설:
  - `IComputationalEngine` (math.js / AST / Bayesian 구현체)
  - `ISourceCitation` (page_ref / URL / DOI 구현체)

---

### 🟠 결함 7: Year 2 의 implicit 가정

**MEPHISTO 의 분석:**

본 보고서 + 산출물 모두 "Year 2 = 멀티시험" 단일 시나리오.

**그러나 Year 2 가능 시나리오 4가지:**

| 시나리오                         | 엔진 영향                                   | 현 plan 정합성 |
| -------------------------------- | ------------------------------------------- | -------------- |
| (a) 새 자격증 (공인중개사)       | 도메인 plugin 추가                          | ✅ 정합        |
| (b) 자격증 외 도메인 (코딩 학습) | computational plugin + source citation 변경 | 🔴 부정합      |
| (c) B2B (기업 교육)              | 멀티 테넌트 + 권한 + 격리                   | 🔴 부정합      |
| (d) 멀티 언어 (영어 자격증)      | I18N + 번역 검증                            | 🔴 부정합      |

**진산님 비전 = (a) + (b) + (c) + (d) 모두 가능해야 함**

**개선 방향:**

- Year 2 시나리오별 분기 plan
- 각 시나리오의 엔진 영향 분석
- 우선순위:
  - Year 1 후반 = (a) 멀티시험 plan 본격
  - Year 2 초 = (b) 다른 도메인 PoC (1건만)
  - Year 2 중 = (c) B2B 검토
  - Year 2 후 = (d) 멀티 언어

---

### 🟡 결함 8: 북극성의 측정 가능성 부재

**MEPHISTO + ORACLE + HACKER 합동:**

진산님 메모리: 북극성 = "생성물 신뢰성·정확성"

**측정 메트릭 부재:**

- 신뢰성 = ?
- 정확성 = ?
- "이 엔진은 신뢰할 만한가?" 판정 기준 모호

**측정 가능한 KPI 제안:**

| KPI                          | 정의                                     | 측정 시점      | 목표     |
| ---------------------------- | ---------------------------------------- | -------------- | -------- |
| **CBIV 통과율**              | BATCH 적재 시도 중 CBIV 통과 비율        | BATCH 적재마다 | 100%     |
| **Stage 5 회귀 Golden 100%** | 회귀 Golden Test 일치율                  | BATCH 적재마다 | 100%     |
| **학습자 합격률**            | 적재 후 학습자가 모의시험 합격 비율      | 분기 1회       | 60%+     |
| **출처 정확도**              | page_ref 무작위 sampling 일치율          | BATCH 적재 후  | 95%+     |
| **응답 시간**                | 운영 RAG p95 응답 시간                   | 일일           | < 2초    |
| **검수자 효율성**            | 평균 결정 시간                           | 일일           | < 6초/건 |
| **CBIV Self-Test 통과율**    | 의도적 fail 시나리오 차단 비율           | 매 코드 변경   | 100%     |
| **도메인 plugin 추가 비용**  | 새 자격증 / 도메인 추가 시 코어 변경 LOC | Year 2         | 0 LOC    |

**개선 방향:**

- ADR-029: "북극성 KPI 정의 + 측정 cadence"
- 매 BATCH 적재 후 KPI dashboard 자동 갱신
- 분기 1회 진산님 KPI review

---

## 3. 종합 평가 매트릭스

| 차원                      | 점수       | 근거                                          |
| ------------------------- | ---------- | --------------------------------------------- |
| **엔지니어링 안전성**     | **80/100** | 4-Pass 리뷰 + 5-페르소나 + CBIV — 인프라 견고 |
| **자가 진단 능력**        | **70/100** | 진척률, 갭 분석, 이연 분류 — 정직             |
| **시간 추정 정직성**      | **75/100** | 비관 15d 안전 범위, +18% 명시                 |
| **비전 정합성**           | **40/100** | 손해평가사 시야, 시험 도메인 묶임             |
| **측정 가능성**           | **30/100** | KPI 부재, 북극성 추상적                       |
| **확장성 (multi-domain)** | **20/100** | abstraction level 미달                        |
| **종합**                  | **52/100** | 인프라 우수, 비전 미흡                        |

---

## 4. 보완 권고 (우선순위별)

### P0: BATCH-1 dry-run 진입 전 (이번 1주)

5-페르소나 통합 보고서의 권고 그대로 진행:

- D-C1: Anthropic Console cap 설정 (5분)
- 0.5d CRITICAL 정정 (R-C1 / Q-C1 / B-C3)
- 1.5d Step 5 plan 갱신 + 0016 마이그레이션 + B-C2 examId 시그니처
- 0.2d ROADMAP v1.2 패치
- 2.6~3d Step 11.6 코드 구현
- 1d 4-Pass 리뷰

→ **현 5-페르소나 권고는 P0 합리적, 그대로 진행**

### P1: BATCH-1 dry-run 통과 직후 (1주~2주)

본 감사에서 발견한 결함 8건의 수정:

| 결함          | 작업                                              | 시간        |
| ------------- | ------------------------------------------------- | ----------- |
| **결함 1, 8** | "비전 정합성" 섹션 + 측정 가능 KPI 정의 (ADR-029) | 1d          |
| **결함 4**    | Engine vs Service Boundary (ADR-026)              | 0.5d        |
| **결함 5**    | CBIV-Self-Test 모듈 설계 (ADR-027)                | 1d (설계만) |
| **결함 7**    | Year 2 시나리오별 분기 plan                       | 0.5d        |

→ **약 3d 작업, BATCH-1 dry-run 통과 후 즉시 진행**

### P2: Year 1 후반 (BATCH-7 적재 시점)

본 감사 결함 + 추가:

| 결함       | 작업                                                         | 시간    |
| ---------- | ------------------------------------------------------------ | ------- |
| **결함 3** | 8-페르소나 (product-strategist + economist 추가) 정기 review | 매 분기 |
| **결함 6** | Domain-Agnostic Engine Abstraction (ADR-028) — 본격 설계     | 2d      |
| **결함 5** | CBIV-Self-Test 모듈 구현                                     | 3d      |
| **결함 7** | Year 2 시나리오 (b) 다른 도메인 PoC                          | 1주     |

### P3: Year 2 진입 시

- 손해평가사 외 첫 도메인 (자격증 또는 코딩 학습) 적재
- 코어 변경 0 검증
- universal engine 비전 첫 production 검증

---

## 5. DEV COVEN 합동 사인-오프

> **MEPHISTO**: "엔지니어링은 80점. 그러나 진산님 비전을 시스템에 새기지 않으면 BATCH-14 후 새 도메인 진입 시 엔진 재작성. 결함 1, 6, 8 이 본질."

> **ORACLE**: "북극성 = 신뢰성·정확성. 그러나 측정 KPI 부재 = 비전 추상적. ADR-029 (KPI 정의) 가 BATCH-1 통과 직후 1순위."

> **ARCHITECT**: "Engine vs Service boundary 흐림 + Domain-agnosticism 부재 = universal 비전 위협. ADR-026 + ADR-028 신설 필수."

> **BREAKER**: "CBIV 의 self-reflection 부재 = single point of failure. CBIV-Self-Test 모듈 (결함 5) 이 가장 깊은 결함."

> **HACKER**: "5-페르소나 권고 P0 작업은 합리적. 그러나 진척률 54% 는 misleading — 진산님이 'Year 2 멀지 않다' 오인 가능."

> **GHOST**: "Production 검증 0건 = 실제 진척 30%. 보고서의 54% 는 인프라 진척률, 비전 진척률은 5% 미만."

> **SENTINEL**: "엔지니어링 페르소나 5명만 검토 = 보안/법적/사용자 영향 영역 검증 부재. 8-페르소나 확장 권고."

> **ADVOCATE**: "BATCH-1 적재 후 학습자가 실제로 합격할까? 외부 도메인 전문가 (손해평가사 강사) 검수 의뢰 필요."

---

## 6. 진산님께 — 즉시 응답 권고

본 감사는 **방어가 아닌 진화** 의 정신:

- ❌ 5-페르소나 + 4-Pass 리뷰의 우수성 부정 안 함
- ✅ 그러나 비전 정합성 측면에서 8건 결함 명시
- ✅ P0 (BATCH-1 진입 전) = 5-페르소나 권고 그대로
- ✅ P1 (BATCH-1 통과 직후) = 본 감사 결함 1/4/5/8 처리

**최종 권고:**

> **5-페르소나 통합 보고서의 §3.2 재정렬 순서 그대로 진행** (D-C1 → CRITICAL 정정 → Step 5 + 0016 → ROADMAP v1.2 → Step 11.6 → Step 2~4 병렬)
>
> **BATCH-1 dry-run 통과 직후, 본 감사의 P1 작업 (3d)** 즉시 진입

---

_"엔지니어링이 80점일 때 멈춘다면, 비전은 영원히 40점이다._
_비전 80점이 인프라 80점에 합치는 길은 본 감사의 P1 작업뿐이다."_

— DEV COVEN 8 페르소나 합동 감사 보고서
