# 🔍 01. PROJECT DIAGNOSIS FRAMEWORK

## 내 프로젝트는 분할이 필요한가, 어떻게 분할해야 하나

> **"잘못 진단하면, 좋은 약이 독이 된다."**
>
> — SENTINEL

---

**버전:** v1.0
**연계 문서:** 02. Pattern Catalog (진단 후 패턴 선택), 05. Planning Workbook
**소요 시간:** 30~60분 (1회/프로젝트)
**산출물:** Project Diagnosis Sheet (PDS)

---

# 0. 이 문서의 사용법

## 0.1 언제 사용하나

```
✅ 새 프로젝트 시작 직전 (필수)
✅ 진행 중인 프로젝트가 막혔을 때 (재진단)
✅ 분할 패턴을 결정하기 전
✅ 다른 사람의 프로젝트를 인수받을 때
```

## 0.2 출력물

이 문서를 따라 진행하면 다음 PDS(Project Diagnosis Sheet)가 완성된다:

```yaml
# docs/methodology-output/PDS-{project_name}.yaml

project: 'VOID BILL'
diagnosis_date: '2026-05-01'

# 1. 규모 진단
size:
  estimated_duration: '4 weeks'
  story_count: '20~30'
  classification: 'Medium' # Tiny | Small | Medium | Large | XLarge

# 2. 도메인 진단
domain:
  type: 'SaaS' # SaaS | Pipeline | Library | Hub | Tool | Mixed
  business_critical: true
  ai_inference_involved: true
  payment_involved: true

# 3. 인지 부하 진단
cognitive:
  parallelizable_work: 'high'
  dependency_complexity: 'medium'
  context_required_per_area: 'narrow'

# 4. DEFCON 결정
defcon:
  default: 'L2'
  forced_l3: ['payment', 'auth']

# 5. 분할 결정
split_decision: 'YES' # YES | NO | DEFER
recommended_pattern: '5-Plane Hybrid' # → 02. Pattern Catalog 참조
estimated_split_units: 5
```

---

# 1. 진단의 5단계 흐름

```
┌──────────────────────────────────────────────────────────┐
│  Stage A: 규모 진단    ← "얼마나 큰가?"                   │
└──────────────────┬───────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────┐
│  Stage B: 도메인 진단  ← "어떤 종류의 프로젝트인가?"      │
└──────────────────┬───────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────┐
│  Stage C: 인지 부하 진단 ← "동시 작업이 의미 있나?"        │
└──────────────────┬───────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────┐
│  Stage D: DEFCON 결정  ← "통제 강도는?"                   │
└──────────────────┬───────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────┐
│  Stage E: 분할 결정 + 패턴 후보 → 02. Pattern Catalog로  │
└──────────────────────────────────────────────────────────┘
```

---

# 2. Stage A: 규모 진단 (Size Assessment)

## 2.1 5단계 분류

| 분류       | 예상 소요 | Story 수 |        분할 권장도         |
| :--------- | :-------- | :------- | :------------------------: |
| **Tiny**   | < 3일     | 1~3      | ❌ 분할 금지 (오히려 손해) |
| **Small**  | 3일 ~ 2주 | 4~10     |    ❌ 분할 보통 불필요     |
| **Medium** | 2~6주     | 10~30    |     ⚠️ Phase 분할 정도     |
| **Large**  | 6주~3개월 | 30~80    |     ✅ 분할 강력 권장      |
| **XLarge** | 3개월+    | 80+      |        ✅ 분할 필수        |

## 2.2 규모 측정 방법

### 직관 추정의 함정

```
✗ "이거 1주면 끝나" — 솔로 개발자의 평균 추정 오차 +180%
✓ "직관 추정 × 2.5" — 헌법 v3.3 현실주의 2계명 적용
```

### 산출 공식

```
1. 기능 목록을 30분 동안 작성
2. 각 기능을 1~5점으로 복잡도 평가
   1점: 단순 CRUD, 표준 패턴
   2점: 약간의 비즈니스 로직
   3점: 외부 연동 또는 알고리즘
   4점: AI/ML 추론 또는 복잡 상태
   5점: 새 도메인, 학습 필요
3. 합계 × 1일 = "낙관 시나리오"
4. 낙관 시나리오 × 2.5 = "현실 시나리오"
```

### 예시 적용

| 프로젝트            | 기능 합계 | 낙관 | 현실 (×2.5)  |  분류  |
| :------------------ | :-------: | :--: | :----------: | :----: |
| VOID BILL Phase A   |   16점    | 16일 |  40일 (8주)  | Large  |
| VOID TIME Burn      |    7점    | 7일  | 17일 (3.5주) | Medium |
| VOID UTIL 단일 도구 |    3점    | 3일  |     8일      | Small  |

## 2.3 규모 진단 시트

```yaml
# Stage A 출력
size_assessment:
  feature_inventory:
    - name: '(기능명)'
      complexity: 1-5
  total_complexity_points: ~
  optimistic_days: ~
  realistic_days: ~ # × 2.5
  classification: 'Tiny | Small | Medium | Large | XLarge'

  split_signal:
    - if Tiny → "분할 금지. 단일 세션."
    - if Small → "분할 보통 X. Phase 단위만 고려."
    - if Medium → "Phase 분할 또는 2~3 Plane."
    - if Large → "5-Plane 또는 패턴 적용."
    - if XLarge → "분할 필수. 단, Phase 단위로 쪼갠 후 적용."
```

---

# 3. Stage B: 도메인 진단 (Domain Type)

## 3.1 6가지 프로젝트 유형

| 유형                    | 핵심 특성                  | 예시                   | 권장 패턴 (02 참조)                |
| :---------------------- | :------------------------- | :--------------------- | :--------------------------------- |
| **SaaS Service**        | 사용자 + DB + Admin + 결제 | VOID BILL, VOID CODEX  | 5-Plane Hybrid                     |
| **Pipeline / ETL**      | 데이터 변환 체인 (다단계)  | ScoreForge, VOID MIX   | Pipeline Stage                     |
| **Library / Engine**    | 재사용 가능한 코어         | VOID GUARD, 라이브러리 | Single Module 또는 Domain Vertical |
| **Hub / Marketplace**   | 코어 + 다수 플러그인       | VOID UTIL, VOID DROP   | Core-Plugin                        |
| **Single-Purpose Tool** | 작은 단일 도구             | VOID TIME Burn, 계산기 | Single Module (분할 X)             |
| **Mixed / Hybrid**      | 위 둘 이상 결합            | VOID Synesthesia       | Hybrid (02 참조)                   |

## 3.2 유형 결정 진단 질문

```
질문 1: 사용자가 직접 가입/로그인/결제하는가?
  YES → SaaS Service 가능성 높음

질문 2: 입력 데이터가 여러 변환 단계를 거쳐 출력으로 가는가?
  YES → Pipeline / ETL

질문 3: 다른 프로젝트가 이걸 import해서 쓸 가능성이 있는가?
  YES → Library / Engine

질문 4: 핵심 기능 + 무한 확장 가능한 부속 기능인가?
  YES → Hub / Marketplace

질문 5: 한 가지 일만 잘하면 되는가?
  YES → Single-Purpose Tool

질문 6: 위 중 2개 이상 해당하는가?
  YES → Mixed / Hybrid (02 Catalog의 Hybrid 패턴)
```

## 3.3 도메인 특성 추가 진단

```yaml
domain_characteristics:
  business_critical: true | false
  # 출력 품질이 비즈니스 핵심? (G5.5 인간 검증 의무)

  ai_inference_involved: true | false
  # AI/ML 추론 포함? (DEFCON L3 자동 + Cost Cap)

  payment_involved: true | false
  # 결제 처리? (DEFCON L3 + PCI DSS)

  pii_handling: true | false
  # 개인정보 처리? (CRMF Risk #1 + GDPR/CCPA)

  multi_user: true | false
  # 다중 사용자? (인증/권한 = CC 필수)

  data_pipeline_stages: 0 | 1 | 2 | 3+
  # 데이터 변환 단계 수 (3+ 시 Lineage 의무)

  external_integrations: ~
  # 외부 서비스 연동 수 (Polar, Resend, Anthropic API 등)
```

---

# 4. Stage C: 인지 부하 진단 (Cognitive Load)

## 4.1 분할이 의미 있으려면

```
분할 = 한 영역을 깊이 파면, 다른 영역을 잠시 잊어도 되는 구조.

진짜 분할 가능한 프로젝트:
  ✓ 영역 A의 코드를 짤 때 영역 B의 디테일을 몰라도 됨
  ✓ 영역 간 인터페이스만 알면 됨

가짜 분할 (분할 = 손해):
  ✗ 영역 A를 짜다가 매번 영역 B의 디테일 확인 필요
  ✗ 결국 한 사람이 6개 영역 다 머리에 들고 있어야 함
```

## 4.2 인지 부하 진단 질문

각 질문에 1~5점 (1=완전 부정, 5=완전 동의)

```
Q1. 이 프로젝트는 명확히 다른 책임 영역으로 나눌 수 있다.
Q2. 한 영역을 작업할 때 다른 영역의 디테일을 거의 모를 수 있다.
Q3. 영역 간 통신이 명시적 인터페이스로 가능하다 (DB 직접 접근 같은 암묵적 결합 없음).
Q4. 한 영역의 변경이 다른 영역의 코드 변경을 거의 안 일으킨다.
Q5. 영역별로 테스트가 독립적으로 작성/실행 가능하다.
Q6. 영역별로 성능 예산/SLA가 다르게 정의될 수 있다.
Q7. 영역별로 다른 사람이 작업한다고 가정해도 어색하지 않다 (Conway's Law).
Q8. 영역의 경계가 6개월 후에도 안 변할 가능성이 높다.

총점:
  - 32점 이상: 분할 가치 매우 높음
  - 24~31점: 분할 가치 있음
  - 16~23점: 부분 분할 (Phase 등) 가능
  - 16점 미만: 분할 = 손해. 단일 모듈 권장
```

## 4.3 인지 부하 분류

| 분류                       | 의미                   | 권장                      |
| :------------------------- | :--------------------- | :------------------------ |
| **Naturally Decomposable** | 32점+ 자연적 분할 가능 | 5-Plane / Domain Vertical |
| **Partially Decomposable** | 24~31점 부분 분할      | Phase-based / Hybrid      |
| **Tightly Coupled**        | 16~23점 밀접 결합      | 분할 신중. Phase만        |
| **Monolithic by Nature**   | 16점 미만              | 단일 모듈. 분할 X         |

---

# 5. Stage D: DEFCON 결정 (헌법 v3.3 Part 1.6)

## 5.1 프로젝트 전체 DEFCON 기본값

```
프로젝트 시작 시 명시 의무:

  L1 (Rapid):
    ✓ PoC, 프로토타입
    ✓ 단순 단일 도구
    ✓ Library 형식

  L2 (Standard):
    ✓ 일반 SaaS
    ✓ 비즈니스 로직 있는 Service
    ✓ 대부분의 프로젝트 기본값

  L3 (Fortress):
    ✓ 결제 처리 프로젝트
    ✓ 인증/PII 핵심
    ✓ AI 추론이 비즈니스 핵심
    ✓ 법적 규제 영역
```

## 5.2 자동 L3 강제 트리거

다음 중 하나라도 해당하면 프로젝트 자동 L3:

```
□ 결제/정산/환불/구독 처리
□ 인증/인가 (OAuth, 세션 관리)
□ 개인정보 처리 (PII, PHI, 위치)
□ 3+단계 데이터 변환 파이프라인 (Lineage 의무)
□ AI/ML 추론이 출력 품질의 핵심
□ 법적 규제 (GDPR, CCPA, 저작권)
□ Exit/M&A 실사 대상
```

## 5.3 부분 L3 (Mixed DEFCON)

전체는 L2지만 특정 영역만 L3:

```yaml
defcon_assignment:
  default: 'L2'
  forced_l3:
    - area: 'payment'
      reason: 'PCI DSS'
    - area: 'auth'
      reason: '보안 핵심'
  l1_relaxed:
    - area: 'static_pages'
      reason: '콘텐츠만, 로직 없음'
```

이 부분 L3은 **5-Plane 패턴**과 자연스럽게 매핑된다 (P3 Admin = L3, P4 Experience = L1).

---

# 6. Stage E: 분할 결정 + 패턴 후보

## 6.1 분할 결정 매트릭스

위 4단계 진단 결과를 종합:

| Size   | Cognitive       | Domain   | 결정          | 패턴 후보 (02 참조)            |
| :----- | :-------------- | :------- | :------------ | :----------------------------- |
| Tiny   | 임의            | 임의     | NO            | Single Module                  |
| Small  | Monolithic      | 임의     | NO            | Single Module                  |
| Small  | Decomposable    | 임의     | DEFER         | 단일 모듈로 시작, 필요 시 분할 |
| Medium | Tightly Coupled | 임의     | NO 또는 Phase | Phase-based                    |
| Medium | Partially       | SaaS     | YES           | Phase + 부분 Plane             |
| Medium | Decomposable    | Pipeline | YES           | Pipeline Stage                 |
| Large  | Tightly Coupled | 임의     | 재진단        | 분할 어려움 — 도메인 재정의    |
| Large  | Partially       | 임의     | YES           | Hybrid 패턴                    |
| Large  | Decomposable    | SaaS     | YES           | 5-Plane Hybrid                 |
| Large  | Decomposable    | Pipeline | YES           | Pipeline Stage                 |
| Large  | Decomposable    | Hub      | YES           | Core-Plugin                    |
| XLarge | 임의            | 임의     | YES (필수)    | Phase 분할 + Pattern           |

## 6.2 분할 결정의 3가지 결과

### Result A: NO — 분할하지 마라

```
조건:
  - Tiny 또는 Small + Monolithic
  - 또는 인지 부하 16점 미만

권장:
  - 단일 Claude Code 세션
  - 헌법 v3.3 ACAP v4 적용
  - CLAUDE.md만 잘 관리
  - 분할 시도하면 셋업 비용 > 절감

다음 단계:
  → 02. Pattern Catalog의 "Pattern 0: Single Module" 참조
  → 05. Planning Workbook 간소 적용
```

### Result B: DEFER — 일단 단일로 시작, 신호 시 분할

```
조건:
  - Small + Decomposable (분할 가능하지만 작음)
  - 또는 도메인이 아직 모호 (탐색 단계)

권장:
  - 단일 모듈로 시작
  - 다음 신호 발생 시 재진단:
    * 한 파일이 1000줄 초과
    * 한 폴더에 모듈 10개 초과
    * 동일 영역 수정 빈도 폭증
    * 컨텍스트 스위칭 비용 명확히 느껴짐

다음 단계:
  → 신호 감지를 위한 메트릭 셋업
  → 3개월 후 재진단
```

### Result C: YES — 분할하라

```
조건:
  - Medium 이상 + Decomposable
  - 또는 도메인이 복수 Bounded Context

권장:
  - Stage E의 패턴 후보 따라
  - 02. Pattern Catalog로 진행

다음 단계:
  → 02. Pattern Catalog
  → 05. Planning Workbook (Stage -1 ~ Stage 0.8)
```

---

# 7. 진단 시트 (Project Diagnosis Sheet) 표준 양식

## 7.1 PDS YAML 템플릿

```yaml
# docs/methodology-output/PDS-{project_name}.yaml
# 진단 시트 — Stage A~E 결과 기록

meta:
  project: '(프로젝트명)'
  diagnosis_date: '(YYYY-MM-DD)'
  diagnosis_by: '(진단자)'
  version: 'v1.0'

# Stage A: 규모
size_assessment:
  feature_inventory:
    - name: ''
      complexity: 0
  total_complexity_points: 0
  optimistic_days: 0
  realistic_days: 0 # × 2.5
  classification: 'Tiny | Small | Medium | Large | XLarge'

# Stage B: 도메인
domain_diagnosis:
  type: 'SaaS | Pipeline | Library | Hub | Tool | Mixed'
  characteristics:
    business_critical: false
    ai_inference_involved: false
    payment_involved: false
    pii_handling: false
    multi_user: false
    data_pipeline_stages: 0
    external_integrations: []

# Stage C: 인지 부하
cognitive_load:
  q1_clear_responsibilities: 0 # 1~5
  q2_isolation_possible: 0
  q3_explicit_interfaces: 0
  q4_change_locality: 0
  q5_test_independence: 0
  q6_different_slas: 0
  q7_conway_natural: 0
  q8_boundary_stability: 0
  total: 0
  classification: 'Naturally Decomposable | Partially | Tightly Coupled | Monolithic'

# Stage D: DEFCON
defcon:
  default: 'L1 | L2 | L3'
  forced_l3_areas: []
  l1_relaxed_areas: []
  reasoning: ''

# Stage E: 분할 결정
split_decision:
  result: 'YES | NO | DEFER'
  reasoning: ''
  recommended_pattern: '' # 02. Pattern Catalog ID
  estimated_units: 0

  if_no:
    monitoring_signals: [] # DEFER인 경우 재진단 트리거

  if_yes:
    next_steps:
      - '02. Pattern Catalog로 → 패턴 상세 검토'
      - '05. Planning Workbook → Stage -1 시작'

# Stage F (선택): 페르소나 검증
persona_review:
  oracle_check: '' # 비즈니스 가치 부합?
  architect_check: '' # 분할이 기술적으로 타당?
  advocate_check: '' # 인지 부하가 솔로에게 맞나?
  breaker_check: '' # 어떻게 깨질까?
```

## 7.2 PDS 작성 시간 예산

| 단계           |   시간   | 활동                    |
| :------------- | :------: | :---------------------- |
| Stage A 규모   |   15분   | 기능 목록 + 복잡도 평가 |
| Stage B 도메인 |   10분   | 6가지 유형 매칭         |
| Stage C 인지   |   10분   | 8문항 자가 평가         |
| Stage D DEFCON |   5분    | 트리거 체크             |
| Stage E 결정   |   10분   | 매트릭스 적용           |
| Stage F 검증   |   10분   | 페르소나 빠른 회고      |
| **합계**       | **60분** | **1회/프로젝트**        |

---

# 8. 진단 후 분기점

```
                  ┌──────────────────────────┐
                  │  PDS 작성 완료            │
                  └────────────┬─────────────┘
                               ▼
                  ┌──────────────────────────┐
                  │  split_decision 결과는?   │
                  └────────────┬─────────────┘
                ┌──────────────┼──────────────┐
              NO              DEFER           YES
                │              │              │
                ▼              ▼              ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │ Pattern 0    │  │ Pattern 0    │  │ 02. Pattern  │
        │ Single Module│  │ + 모니터링   │  │ Catalog로    │
        │              │  │ 신호 셋업    │  │              │
        └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
               │                  │                  │
               ▼                  ▼                  ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │ 05. Planning │  │ 단일 시작 +  │  │ 패턴 결정 후 │
        │ 간소 적용    │  │ 3개월 재진단 │  │ 05. Planning │
        └──────────────┘  └──────────────┘  └──────────────┘
```

---

# 9. 진단 안티패턴

| 안티패턴                | 왜 위험                                 | 정직한 대안             |
| :---------------------- | :-------------------------------------- | :---------------------- |
| 진단 건너뛰고 바로 분할 | 잘못된 패턴 = 재시작 비용               | 1시간 진단 = 1주일 절약 |
| "5-Plane이 표준이니까"  | 모든 프로젝트에 같은 도구               | 도메인에 맞는 패턴      |
| 직관 추정만             | 평균 +180% 오차                         | 복잡도 점수 × 2.5       |
| 인지 부하 무시          | 분할해도 머리가 6개 영역 들고 있어야 함 | 8문항 자가 평가         |
| DEFCON 안 정함          | 통제 강도 모호                          | 시작 시 명시            |
| Tiny/Small에 분할       | 셋업 비용 > 절감                        | 분할 안 함이 정답       |

---

# 10. 페르소나 COT 검증 (이 문서 자체)

## 🔮 ORACLE

> "진단이 비즈니스 가치 판단으로 시작하는가? Stage B에서 business_critical, payment_involved 등이 다뤄짐. ✓"

## 🏛️ ARCHITECT

> "5단계 흐름이 의존성 순서로 구성됐는가? Size → Domain → Cognitive → DEFCON → Decision. ✓ 인지 부하가 도메인 다음인 게 핵심."

## 👤 ADVOCATE

> "솔로 개발자가 1시간 안에 끝낼 수 있나? 8문항 자가 평가 + 매트릭스. ✓ 60분 예산 명시."

## 🔨 BREAKER

> "진단이 틀릴 가능성? Cognitive Q1~8이 자기 평가라 편향 위험. 페르소나 검증(Stage F)으로 보완 ✓"

## 🛡️ SENTINEL

> "DEFCON 결정에서 PII/결제/인증을 자동 L3로? ✓ CRMF v1.0과 일관."

## 👻 GHOST

> "DEFCON 부분 적용이 5-Plane과 매핑되는가? ✓ Mixed DEFCON 명시."

## 🎩 MEPHISTO

> "이 진단 자체가 무거우면 진단을 안 한다. 60분이 적절. ✓ 단, '직관 패스' 옵션은 의도적으로 안 줌 — 모든 프로젝트는 진단 의무."

---

# 11. 다음 단계

```
이 문서 완료 후:
  → split_decision = YES → 02. Pattern Catalog
  → split_decision = NO  → 02. Pattern 0 (Single Module) 섹션만
  → split_decision = DEFER → 단일 시작 + 신호 모니터링 셋업
```

---

**END OF 01. PROJECT DIAGNOSIS FRAMEWORK**

_"Diagnose first, decompose second. Reverse the order at your peril."_
