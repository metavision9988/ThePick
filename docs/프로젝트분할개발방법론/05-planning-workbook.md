# 📐 05. PLANNING STAGE WORKBOOK

## 기획·설계 단계 워크시트 — Stage -1 ~ Stage 0.8

> **"Planning is the only phase where mistakes are cheap.**
> **Skip it, and every later phase pays the bill."**
>
> — MEPHISTO

> **"기획 단계의 5분이 운영 단계의 5시간을 절약한다."**
>
> — DEV COVEN

---

**버전:** v1.0
**선행 문서:** 01. Diagnosis (PDS 완료) + 02. Pattern Catalog (패턴 결정) + 03. Role Definition (Role Card 완료) + 04. Info Sharing (NOTICE 셋업)
**연계 문서:** 06. Operating Manual, 08. Templates Library
**적용 헌법:** VOID DEV UNIFIED CONSTITUTION v3.3 (ACAP v4)
**소요 시간:** 첫 적용 1주, 재사용 시 1~2일

---

# 0. 이 워크북이 풀려는 문제

## 0.1 핵심 문제

```
"분할 패턴은 결정했는데, 어떻게 실제로 시작하나?"

이 질문에 대한 답:
  헌법 v3.3 ACAP v4의 Stage -1 ~ Stage 0.8을
  Role(Plane/Stage/Domain)별로 적용한 워크시트.
```

## 0.2 ACAP v4 Stage 흐름 (분할 적용 버전)

```
┌─────────────────────────────────────────────────────────────┐
│ Stage -1: Codebase Deep Dive                                │
│   ▶ 각 Role별 research.md 작성                              │
│   ▶ 산출물: docs/plane/{role}/research.md                   │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 0: 북극성 + Hard Limit + Forbidden 선언                │
│   ▶ 프로젝트 SSOT 작성                                      │
│   ▶ 산출물: docs/shared/NORTH_STAR.md, HARD_LIMITS.md       │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 0.3: 후보 도출 (Candidate Generation)                  │
│   ▶ 각 Role별 작업 후보 (Story 단위)                        │
│   ▶ 산출물: 후보 리스트                                     │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 0.5: Counter-Directive 작성                            │
│   ▶ 프로젝트 특화 함정 목록                                 │
│   ▶ 산출물: docs/shared/COUNTER_DIRECTIVES.md               │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 0.7: RAR Cycle (Review-Adjust-Reconfirm)               │
│   ▶ 인간 검토 + 페르소나 검증                               │
│   ▶ 산출물: 갱신된 plan.md (각 Role)                        │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 0.8: Task Contract 작성                                │
│   ▶ 모든 IMPL Task의 Contract.yaml                          │
│   ▶ 산출물: docs/contracts/*.contract.yaml                  │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
                ┌──────────────┐
                │ Stage 1+:    │
                │ Implementation│
                │ (06 Manual)  │
                └──────────────┘
```

## 0.3 패턴별 적용 강도

| Stage     | Pattern 0 (Single) | Pattern 1 (Phase) | Pattern 2 (5-Plane) |  Pattern 3 (Pipeline)   | Pattern 5 (Core-Plugin)  |
| :-------- | :----------------: | :---------------: | :-----------------: | :---------------------: | :----------------------: |
| Stage -1  |        1회         |      Phase별      |    Role별 (6개)     |      Stage별 (4~6)      | Core 1회 + Plugin별 간소 |
| Stage 0   |        간소        |      Phase별      |     1회 (전역)      |       1회 (전역)        |         Core 1회         |
| Stage 0.3 |        1회         |      Phase별      |       Role별        |         Stage별         |    Core + Plugin 묶음    |
| Stage 0.5 |        1회         |      Phase별      |    1회 + Role별     |      1회 + Stage별      |           1회            |
| Stage 0.7 |        1회         |       의무        |        의무         |          의무           |        Core 의무         |
| Stage 0.8 |        선택        |       권장        |        의무         | 의무 (Stage 인터페이스) |      Core API 의무       |

---

# 1. Stage -1: Codebase Deep Dive (각 Role별)

## 1.1 목적

```
"코드를 짜기 전에, 코드베이스를 읽는다."

이 단계 없이 시작하면:
  - 기존 패턴과 충돌하는 새 패턴 도입
  - 이미 있는 모듈을 재발명
  - 도메인 용어 일관성 깨짐
  - TYPE-2 (Hallucination Confluence) 위험
```

## 1.2 Stage -1 워크시트

각 Role마다 1장 작성:

```yaml
# docs/plane/{role}/research.md (의 frontmatter)
---
role_id: 'P2-engine'
research_date: '2026-04-28'
researcher: 'Claude P2 Session'
---
```

```markdown
# 📚 Research: P2 Engine

## 1. 코드베이스 스캔

### 기존 모듈 (관련 영역)

| 모듈           | 위치                           | 상태    | 활용 가능? |
| :------------- | :----------------------------- | :------ | :--------: |
| QuoteValidator | packages/old/QuoteValidator.ts | 레거시  |    부분    |
| TaxRules       | packages/foundation/tax/       | 사용 중 |     ✓      |
| ...            |                                |         |            |

### 기존 패턴 (이 Role이 따라야 할)

- 에러 처리: `Result<T, E>` 타입 사용
- 비동기: Promise + try/catch
- 의존성 주입: TSyringe
- 테스트: Vitest + Test fixture in tests/fixtures/

### 도메인 용어 (유비쿼터스 언어)

- "견적" = Quote
- "검증" = Validation (15-rule 적용)
- "린터" = Linter (검증 결과를 사람이 보는 형태로)

### Anti-Pattern (이 코드베이스에서 금지된 것)

- ❌ `any` 타입 사용 (eslint 룰)
- ❌ console.log (로거 사용)
- ❌ 직접 DB 호출 (Repository 패턴)

## 2. 외부 의존 분석

### 사용 가능한 라이브러리

- Anthropic SDK (`@anthropic-ai/sdk`)
- Drizzle ORM (P1이 제공)
- Hono (P3에서 노출)

### 사용 금지 라이브러리

- moment.js (date-fns 사용)
- jQuery (불필요)

### 외부 API

- Claude API (제안 생성용)
- 한국 국세청 API (세율 조회)

## 3. 도메인 학습 (이 Role이 깊이 알아야 할)

### 비즈니스 규칙 15개 (15-rule Linter)

1. 모든 견적은 부가세 표기 의무
2. 면세 사업자는 부가세 0%
3. ...

### 법적 요구사항

- 부가세법 시행령 제68조
- ...

## 4. 알 수 없는 것 (Unknown Unknowns)

다음은 **모르는 채로 시작하면 안 됨**:

- [ ] AI 추론 비용 (Claude API): 견적당 평균 토큰 수?
- [ ] DB 부하: 1만 사용자 시 견적 검색 응답 시간?
- [ ] 한국 외 사용자 비율: i18n 우선순위?

→ 시작 전 답을 찾거나, 가정 명시 + 검증 계획.

## 5. 인터페이스 추정 (다른 Role과의 접점)

### upstream에서 받을 것 (P1 Foundation)

- Quote, Customer, LineItem 타입
- QuoteSchema (Zod)

### downstream에 줄 것 (P3 Service)

- validateQuote(quote): ValidationResult
- generateSuggestions(context): Suggestion[]

## 6. 위험 식별

### 높은 위험

- 15-rule이 미래에 변경 (법적 변경 시) → 동적 로드 필요?
- AI 비용 폭발 → Cost Cap 필수

### 중간 위험

- 한국 외 세법 → MVP에서 한국만 제한

## 7. RAR 인풋

### 인간 검토 요청 사항

- 15-rule 정의가 충분한가? 빠진 게 있나?
- AI 사용 정책 (제안만? 자동 수정도?)

### ARCHITECT 검토 요청

- TSyringe vs 함수형 의존성 주입?
- Result 타입 라이브러리 (neverthrow vs ts-results)?
```

## 1.3 Stage -1 체크리스트

```
□ 코드베이스 스캔 (관련 모듈 식별)
□ 기존 패턴 추출 (5~10개 핵심)
□ 도메인 용어 정리 (유비쿼터스 언어)
□ Anti-pattern 명시 (3~5개)
□ 외부 의존 인벤토리
□ 비즈니스 규칙 학습 (도메인 깊이)
□ Unknown Unknowns 식별 (3개+)
□ 인터페이스 추정 (upstream/downstream)
□ 위험 식별 (high/medium 분류)
□ RAR 인풋 준비
```

## 1.4 시간 예산

```
첫 번째 Role의 research.md: 4~8시간
이후 Role의 research.md: 2~4시간/개

전체 5-Plane 프로젝트: 약 2~3일

★ 이 단계를 1일 안에 끝내려는 시도는 위험.
  Stage -1 부실 = 코딩 단계의 카오스.
```

---

# 2. Stage 0: 북극성 + Hard Limit + Forbidden 선언

## 2.1 목적

```
"이 프로젝트의 절대 진실을 선언한다."

선언된 진실은 SSOT(docs/shared/)에 영속화.
모든 Role이 이 진실에 종속.
```

## 2.2 Stage 0 워크시트

### docs/shared/NORTH_STAR.md (작성)

```markdown
# 🌟 North Star

## 1. 프로젝트 정의 (1문장)

"한국 1인 사업자가 법적으로 완벽한 견적서를 30초에 만들 수 있다."

## 2. 비즈니스 가치 (왜 존재하나)

- 한국 1인 사업자 50만 명 시장
- 견적 작성에 평균 30분 소요 (시장 조사)
- 법적 오류 발견 늦어 분쟁 발생

## 3. 골든 스레드

"15-rule 린터의 정확도가 100%여야 한다.
99.5%는 출시 불가. 사용자가 법적으로 보호받지 못한다."

## 4. 성공 정의 (어떻게 알 수 있나)

- 베타 사용자 100명 모집 (4주 내)
- 견적 1건당 평균 작성 시간 3분 미만
- 사용자 NPS > 40

## 5. 실패 정의 (어떻게 멈출 수 있나)

- 4주 베타 후 NPS < 0 → 프로젝트 중단
- 6주 동안 paid 전환율 < 1% → 피벗
```

### docs/shared/HARD_LIMITS.md (작성)

```markdown
# 🚧 Hard Limits

다음은 절대 위반 불가:

## 1. 비용 제약

- 월 인프라 비용 < $50 (Cloudflare 프리티어 + Polar)
- AI 추론 비용/사용자/월 < $0.50

## 2. 성능 제약

- 견적 검증 응답 시간 < 500ms (P95)
- 견적 페이지 로드 < 2초 (3G)
- AI 제안 생성 < 3초

## 3. 법적 제약

- GDPR + 한국 PIPL 100% 준수
- 사용자 데이터 EU 외 전송 금지
- 견적 데이터 AI 학습 무단 사용 금지

## 4. 비즈니스 제약

- 프리 티어 월 50건 무료
- Pro 티어 월 ₩5,000 (아래로 내릴 수 없음)
- 모든 결제는 Polar 통해서 (직접 카드 처리 금지)

## 5. 기술 제약

- 단일 region (서울)
- Astro 5 + Cloudflare Workers + D1
- TypeScript strict 모드
```

### docs/shared/FORBIDDEN.md (작성)

```markdown
# ⛔ Forbidden List

이 프로젝트에서 절대 안 함:

## 1. 코드 수준

- ❌ `any` 타입 (eslint error)
- ❌ console.log (logger 사용)
- ❌ 직접 DB 쿼리 (Repository 패턴)
- ❌ 동기 파일 I/O

## 2. 비즈니스 수준

- ❌ "괜찮을 거예요"식 견적 검증
- ❌ 법적 오류 침묵 처리
- ❌ 사용자 동의 없이 데이터 수집

## 3. 운영 수준

- ❌ 직접 운영 환경 배포 (CI 통해서만)
- ❌ Hard-coded API 키
- ❌ 비밀번호 평문 저장
```

## 2.3 페르소나 검증 — 필수

```
ORACLE 검증:
  □ 북극성이 비즈니스 가치와 일치?
  □ 성공/실패 정의가 측정 가능?
  □ 시장 가정이 합리적?

ARCHITECT 검증:
  □ Hard Limit이 기술적으로 달성 가능?
  □ 시스템 제약과 일관?

SENTINEL 검증:
  □ 법적 제약 빠진 것 없음?
  □ 보안 함정 없음?
```

## 2.4 시간 예산

```
NORTH_STAR.md: 2시간 (혼자 + 페르소나 빠른 회고)
HARD_LIMITS.md: 1시간
FORBIDDEN.md: 30분

합계: 3.5시간
```

---

# 3. Stage 0.3: 후보 도출 (Story 단위)

## 3.1 목적

```
"무엇을 만들 것인가의 목록을 모은다."

이 단계의 산출물 = Story 후보 리스트.
모든 후보를 다 만들지는 않음 (다음 단계에서 우선순위).
```

## 3.2 Story 후보 워크시트

### Role별 후보 도출 (예: P2 Engine)

```yaml
# docs/plane/p2-engine/stories-candidates.yaml

candidates:
  - story_id: 'P2-S1'
    title: '기본 검증 엔진 골격'
    description: 'Validator interface + Result 타입'
    estimated_complexity: 2
    dependencies: []
    business_value: '필수 — 모든 검증의 토대'

  - story_id: 'P2-S2'
    title: 'Rule 1: 부가세 표기 검증'
    description: '모든 line item에 tax_rate 필수'
    estimated_complexity: 1
    dependencies: ['P2-S1']
    business_value: '법적 필수'

  - story_id: 'P2-S3'
    title: 'Rule 2: 면세 사업자 검증'
    description: '면세 사업자는 tax_rate=0%'
    estimated_complexity: 2
    dependencies: ['P2-S1', 'P1-S5 (Customer 모델)']
    business_value: '법적 필수'

  # ... Rule 3~15

  - story_id: 'P2-S16'
    title: 'AI 제안 생성 (Anthropic 호출)'
    description: '사용자 입력 → 빈칸 자동 채움 제안'
    estimated_complexity: 4
    dependencies: ['P2-S1', 'CC-S3 (Cost Tracker)']
    business_value: '차별화 — Pro 티어 핵심'

  - story_id: 'P2-S17'
    title: 'Cost Cap (AI 비용 한도)'
    description: '사용자별 월 토큰 한도'
    estimated_complexity: 3
    dependencies: ['P2-S16']
    business_value: 'Hard Limit — 비용 폭발 방지'
```

### Story 우선순위 매트릭스

```
       높은 가치 ↑
              │
   ┌──────────┼──────────┐
   │  Quick   │  핵심     │
   │  Wins    │  (먼저)   │
   │ (P2-S2)  │ (P2-S1)  │
   ├──────────┼──────────┤
   │  나중에   │  검토     │
   │  (S99)   │ (S16)    │
   └──────────┼──────────┘
              │
       낮은 가치 ↓
              ←─ 복잡도 →
        간단         복잡
```

## 3.3 Epic으로 묶기

Story들을 Epic 단위로 그룹화 (헌법 v3.3 Part 7.4):

```yaml
epics:
  - epic_id: 'P2-E1'
    title: 'Validator 골격 + 5 Core Rules'
    stories: ['P2-S1', 'P2-S2', 'P2-S3', 'P2-S4', 'P2-S5', 'P2-S6']
    estimated_duration: '1 week'
    completion_criteria: '5 Core Rules가 unit test 100% pass'

  - epic_id: 'P2-E2'
    title: '10 Extended Rules'
    stories: ['P2-S7', 'P2-S8', ..., 'P2-S15']
    estimated_duration: '1 week'

  - epic_id: 'P2-E3'
    title: 'AI 제안 + Cost Cap'
    stories: ['P2-S16', 'P2-S17']
    estimated_duration: '1 week'
```

## 3.4 시간 예산

```
Story 후보 도출 (Role 1개): 2~3시간
Epic 그룹화: 1시간/Role
전체 5-Plane: 1.5일
```

---

# 4. Stage 0.5: Counter-Directive 작성

## 4.1 목적

```
"이 프로젝트에서 자주 빠질 함정을 명시한다."

헌법 v3.3 Part 5.3의 Counter-Directive를 프로젝트 특화.
```

## 4.2 Counter-Directive 워크시트

### docs/shared/COUNTER_DIRECTIVES.md

```markdown
# 🚨 Counter-Directives (프로젝트 특화 함정)

## CD-1: 15-rule이 동적으로 변경 가능해야 한다는 함정

**증상:** "Rule을 DB에 저장해서 동적으로..."
**왜 함정:** 법적 정확성 100%가 골든 스레드. 동적 변경 = 검증 불가.
**올바른 답:** 15-rule은 코드로. 변경 시 ADR + 새 버전 배포.

## CD-2: AI 제안을 자동 적용하는 함정

**증상:** "사용자가 클릭하면 AI 제안이 바로 적용되도록..."
**왜 함정:** AI는 틀릴 수 있음 + 사용자가 검증하지 못함.
**올바른 답:** AI 제안은 명시적 "수락" 액션 필요. 사용자가 항상 본 후 결정.

## CD-3: i18n을 처음부터 한/영 모두 지원하는 함정

**증상:** "글로벌 SaaS니까 처음부터..."
**왜 함정:** 한국 법규/세율이 핵심 가치. 영어 시장은 별개 도메인.
**올바른 답:** MVP는 한국만. 영어는 Phase 3+에서 검토.

## CD-4: 견적 데이터를 AI 학습에 무단 사용하는 함정

**증상:** "익명화하면 괜찮지 않나..."
**왜 함정:** 사용자 동의 없으면 GDPR + PIPL 위반.
**올바른 답:** 명시적 opt-in. 기본값 = 학습 사용 안 함.

## CD-5: Cost Cap을 나중에 추가하는 함정

**증상:** "일단 만들고 비용 모니터링부터..."
**왜 함정:** AI 비용 폭발은 분 단위로 발생. 사후 대응 불가.
**올바른 답:** Story P2-S16과 P2-S17 동시 출시. Cost Cap 없이 AI 호출 금지.

## CD-6: Quote 상태 머신을 enum으로만 표현하는 함정

**증상:** "status: 'draft' | 'sent' | ..."
**왜 함정:** 상태 전이 규칙이 코드 곳곳에 흩어짐.
**올바른 답:** State Machine 라이브러리 (XState 또는 단순 함수형 FSM).

## CD-7: Test fixture에 실제 사업자번호 사용하는 함정

**증상:** "테스트니까 그냥 1234567890..."
**왜 함정:** 사업자번호는 실제로 검증 가능. 누군가의 실제 번호일 수 있음.
**올바른 답:** 명시적 테스트 패턴 (예: 000-00-00000 + 명시적 "TEST" prefix).

## CD-8: Polar webhook 검증 안 하는 함정

**증상:** "내부 통신이니까..."
**왜 함정:** Webhook은 외부에서 호출 가능. signature 검증 필수.
**올바른 답:** 모든 webhook에 signature 검증. signature 라이브러리 활용.
```

## 4.3 Counter-Directive 도출 방법

```
4가지 소스에서 도출:

1. ORACLE 검증: "비즈니스 함정"
   - 시장 가정이 틀릴 수 있는 부분
   - 사용자가 잘못 이해할 수 있는 부분

2. ARCHITECT 검증: "기술 함정"
   - 아키텍처 결정의 비가역성
   - 미래 확장의 막힘

3. BREAKER 검증: "운영 함정"
   - 시스템이 깨질 수 있는 시나리오
   - 데이터 손실 위험

4. SENTINEL 검증: "법적/보안 함정"
   - 규제 위반 가능성
   - 보안 취약점
```

## 4.4 Role별 Counter-Directive (선택)

전역 CD에 더해 Role별 특화 CD:

```yaml
# docs/plane/p2-engine/counter-directives.md

CD-E1: 다른 Plane의 internal import (캡슐화 깨짐)
CD-E2: AI 호출 전 Cost Cap 체크 누락
CD-E3: Validator를 sync로 만들면 AI 호출 시 폭발
CD-E4: Test fixture에 실제 데이터 사용
```

## 4.5 시간 예산

```
전역 Counter-Directive: 3시간 (페르소나 4명 검토)
Role별 Counter-Directive: 1시간/Role

합계: 5~8시간
```

---

# 5. Stage 0.7: RAR Cycle (Review-Adjust-Reconfirm)

## 5.1 목적

```
"AI의 답을 그대로 받지 않는다.
 인간이 주석을 단다.
 AI가 반영한다.
 인간이 다시 본다."

이게 RAR Cycle의 본질.
헌법 v3.3 Part 8.3.
```

## 5.2 RAR Cycle 절차

```
Step 1: REVIEW (인간 검토)
  - Stage -1 ~ Stage 0.5의 산출물 정독
  - 의문/이의/누락 마킹
  - "왜?"에 대한 답 부족한 부분 식별

Step 2: ADJUST (Claude 수정)
  - 인간 마킹을 받아 산출물 수정
  - 수정 사유 명시
  - 새 정보 추가

Step 3: RECONFIRM (인간 재확인)
  - 수정된 산출물 재정독
  - 만족? → 진행
  - 불만족? → Step 1로

Step 4: 반복
  - 보통 2~3회 cycle
  - 5회 초과 시 → 패턴 자체 재검토
```

## 5.3 RAR 입력 양식

```markdown
# RAR Cycle Input — Iteration 2

## 검토자: 진산

## 검토 산출물:

- docs/shared/NORTH_STAR.md
- docs/shared/HARD_LIMITS.md
- docs/plane/p2-engine/research.md

## 의문점

1. "월 $50 인프라 비용"의 근거는? Cloudflare 프리티어 한도 확인했나?
2. "베타 100명" — 어떻게 모집? 친구? 광고?
3. AI 추론 비용 추정이 너무 낙관적 — Claude API 가격 재계산 필요

## 누락

- 데이터 백업 정책 빠짐
- 테스트 커버리지 목표 명시 안 됨

## 수정 요청

- HARD_LIMITS에 "월간 백업 의무" 추가
- NORTH_STAR에 베타 모집 채널 명시
- research.md에 Claude API 가격 표 추가

## 페르소나 검토 요청

- ARCHITECT: D1 vs Postgres 결정 합리적?
- ORACLE: 베타 100명이 PMF 신호로 충분?
```

## 5.4 RAR Cycle 시간 예산

```
Iteration 1: 인간 검토 1시간 + Claude 수정 30분 + 재확인 30분 = 2시간
Iteration 2: 1시간 (보통 더 빠름)
Iteration 3: 30분 (마무리)

총 3~5시간 (대부분 프로젝트)
```

## 5.5 RAR Cycle 종료 조건

```
다음 조건 중 모두 충족 시 종료:

✓ 인간이 "이대로 시작해도 된다"고 명시
✓ 페르소나 검토 모두 통과
✓ Counter-Directive에 명시 안 된 함정이 발견되지 않음 (3회 검토)
✓ Stage -1 ~ Stage 0.5의 모든 체크리스트 완료

→ 종료 시 Implementation Lock 🔓 UNLOCK 가능
```

---

# 6. Stage 0.8: Task Contract 작성

## 6.1 목적

```
"코딩 시작 전, 모든 IMPL Task의 명세를 확정한다."

헌법 v3.3 Part 7.4.
```

## 6.2 Task Contract 템플릿

```yaml
# docs/contracts/P2-E1-S2-T1.contract.yaml
# (Plane-Epic-Story-Task)

contract_id: 'P2-E1-S2-T1'
task_type: 'IMPL'
plane: 'P2'
epic: 'P2-E1'
story: 'P2-S2'
task: 'Rule 1 검증 함수 구현'

# ─── 입력 명세 ───
inputs:
  - name: 'lineItems'
    type: 'LineItem[]'
    contract: 'packages/foundation/contracts/LineItemSchema.ts'
    constraints:
      - '최소 1개 이상'
      - '각 item에 id 존재'

# ─── 출력 명세 ───
outputs:
  - name: 'ValidationResult'
    type: 'Result<RuleViolation[], RuleEngineError>'
    contract: 'packages/engine/contracts/ValidationResultSchema.ts'
    constraints:
      - 'violations 배열 (빈 배열 = 통과)'
      - '각 violation에 lineItemId 포함'

# ─── 부수 효과 ───
side_effects:
  - 'Logger 호출 (CC.logger.info)'
  - 'Cost Tracker 호출 — AI 사용 안 하므로 0'

# ─── 외부 의존 ───
external_deps:
  - 'P1.LineItem (type)'
  - 'P1.Customer (type)'
  - 'CC.logger'

# 외부 의존 금지
forbidden_deps:
  - 'P3.* (Service Layer는 Engine에 의존, 반대 X)'
  - 'P4.* (UI)'
  - 'Direct DB access'

# ─── 성능 SLA ───
performance:
  p50: '< 5ms'
  p95: '< 20ms'
  p99: '< 50ms'
  memory: '< 1MB per call'

# ─── 검증 ───
verification:
  unit_tests:
    - test_id: 'T1-UT-1'
      scenario: '모든 line item에 tax_rate가 있으면 통과'
    - test_id: 'T1-UT-2'
      scenario: 'tax_rate가 없는 item이 있으면 violation 생성'
    - test_id: 'T1-UT-3'
      scenario: '면세 사업자의 0% tax_rate는 통과'

  bdd_scenarios:
    - 'GIVEN 견적이 작성됨, WHEN 모든 항목에 부가세 표기, THEN 검증 통과'
    - 'GIVEN 견적이 작성됨, WHEN 일부 항목에 부가세 누락, THEN violation 생성'

# ─── 완료 정의 ───
done_when:
  - 'unit test 3개 모두 통과'
  - 'BDD 2개 시나리오 통과'
  - 'P3에서 사용 가능 (export from index.ts)'
  - 'Counter-Directive CD-2 위반 없음'
  - 'Task Contract Verification (헌법 v3.3 Part 9.4)'

# ─── 페르소나 ───
primary_persona: 'ARCHITECT'
secondary_persona: 'HACKER'

# ─── 시간 추정 ───
estimated_hours: 4
realistic_hours: 10 # × 2.5 (헌법 현실주의)
```

## 6.3 Contract 작성 규모

```
모든 IMPL Task에 Contract 의무 (헌법 v3.3 Part 7.4 강제).

평균 프로젝트:
  Story 30개 × Task 3~5개/Story = Task 90~150개

모든 Task에 Contract = 90~150개 .contract.yaml

★ 이게 무거워 보이지만:
  - 자동 생성 도구 활용 (08. Templates)
  - 평균 작성 시간 5분/Contract
  - 합계: 7~12시간 (1~2일)

이 시간이 운영 단계에서 5배 이상 절감.
```

## 6.4 Contract 자동 생성 (시작점)

```bash
# scripts/generate-contract.sh
#!/usr/bin/env bash

TASK_ID=$1  # 예: P2-E1-S2-T1
PLANE=$(echo $TASK_ID | cut -d'-' -f1)

cat > "docs/contracts/${TASK_ID}.contract.yaml" <<EOF
contract_id: "${TASK_ID}"
task_type: "IMPL"
plane: "${PLANE}"

# 작성 필요:
inputs: []
outputs: []
side_effects: []
external_deps: []
forbidden_deps: []
performance: {}
verification: {}
done_when: []
primary_persona: ""
estimated_hours: 0
realistic_hours: 0
EOF

echo "✅ Contract 생성됨: docs/contracts/${TASK_ID}.contract.yaml"
echo "📋 다음: 위 빈 필드를 채우세요."
```

---

# 7. Implementation Lock — UNLOCK 조건

## 7.1 LOCK/UNLOCK 의미 (헌법 v3.3 Part 6.1)

```
🔒 LOCKED: 코딩 시작 안 됨
🔓 UNLOCKED: 코딩 시작 가능

UNLOCK은 자동 안 됨. 인간이 명시적으로 선언.
```

## 7.2 UNLOCK 체크리스트

```
모든 항목 체크되어야 UNLOCK 가능:

Stage -1 (Codebase Deep Dive):
  □ 모든 Role의 research.md 작성 완료
  □ Unknown Unknowns 답변 또는 가정 명시

Stage 0 (북극성 + Hard Limit):
  □ NORTH_STAR.md 작성
  □ HARD_LIMITS.md 작성
  □ FORBIDDEN.md 작성
  □ ORACLE/ARCHITECT/SENTINEL 검증 통과

Stage 0.3 (후보 도출):
  □ 모든 Role의 Story 후보 작성
  □ Epic 그룹화 완료
  □ 첫 Sprint Story 결정

Stage 0.5 (Counter-Directive):
  □ 전역 Counter-Directive 작성 (8개+ 권장)
  □ Role별 Counter-Directive 작성

Stage 0.7 (RAR Cycle):
  □ Iteration 1 완료
  □ Iteration 2 완료 (대부분 프로젝트)
  □ 인간이 "시작해도 된다" 명시

Stage 0.8 (Task Contract):
  □ 첫 Sprint의 모든 IMPL Task에 Contract 작성
  □ Contract Hash 검증 시스템 동작

추가 셋업:
  □ 03. Role Definition 완료 (Role Card 6장)
  □ 04. Information Sharing 완료 (NOTICE 시스템 동작)
  □ Ownership Matrix 작성
  □ pre-commit hook 동작 확인
  □ Plane Dashboard 동작 확인

→ 모두 ✓ → 인간이 .project/state.json에 implementation_lock = "🔓 UNLOCKED"
```

## 7.3 UNLOCK 선언 절차

```
1. 위 체크리스트 모두 검증
2. 마지막 RAR Cycle 진행 — "이대로 시작?"
3. .project/state.json 갱신:
   {
     "implementation_lock": "🔓 UNLOCKED",
     "unlocked_at": "2026-05-08T10:00:00Z",
     "unlocked_by": "jinsan",
     "checklist_completed": true
   }
4. 모든 Role의 plane-states/{role}.json도 갱신
5. 첫 코드 작성 시작 (Stage 1+)

→ 06. Operating Manual로 진행
```

---

# 8. 시간 예산 합계 (5-Plane Hybrid 기준)

```
Stage -1 Codebase Deep Dive:    2~3일
Stage 0 북극성+Hard Limit:       0.5일
Stage 0.3 후보 도출:             1.5일
Stage 0.5 Counter-Directive:     0.5~1일
Stage 0.7 RAR Cycle (2~3 iter):  0.5~1일
Stage 0.8 Task Contract:         1~2일
─────────────────────────────────
합계:                           6~9일 (약 1주)

★ 첫 적용 1주 셋업 비용
★ 두 번째 프로젝트는 1~2일 (재사용)
★ 운영 단계에서 5배 절감 보장
```

## 패턴별 단축

```
Pattern 0 (Single Module): 0.5일
Pattern 1 (Phase-based): 1~2일
Pattern 2 (5-Plane): 1주
Pattern 3 (Pipeline): 4일
Pattern 4 (Domain Vertical): 5일
Pattern 5 (Core-Plugin): Core 4일 + Plugin마다 1시간
Pattern 6 (Hybrid): 1주+
```

---

# 9. 안티패턴

| 안티패턴                | 위험                   | 회피                       |
| :---------------------- | :--------------------- | :------------------------- |
| Stage -1 건너뛰기       | TYPE-2 환각, 패턴 충돌 | 의무 — 패턴 0도 간소 적용  |
| 북극성 모호             | 모든 결정 흔들림       | 1문장으로 압축 강제        |
| Hard Limit 사후 추가    | 비용 폭발              | 첫날 작성, 변경 시 ADR     |
| Counter-Directive 1~2개 | 함정 못 잡음           | 페르소나 4명 협력으로 8개+ |
| RAR Cycle 1회           | 검증 불충분            | 최소 2회, 권장 3회         |
| Contract 사후 작성      | Silent Pivot 폭발      | UNLOCK 전 의무             |
| UNLOCK 자동             | 검증 누락              | 인간 명시적 선언           |
| 빠른 시작 우선          | 운영 단계 카오스       | 1주 셋업 = 5배 절감        |

---

# 10. 페르소나 COT 검증 (이 워크북)

## 🎩 MEPHISTO

> "Stage -1 ~ 0.8 흐름이 헌법 v3.3 ACAP v4와 일치? ✓ Stage 1+ 의 'Implementation' 단계 직전까지 커버."

## 🏛️ ARCHITECT

> "각 Stage 산출물이 다음 Stage 입력? ✓ 의존 명확."

## 🔮 ORACLE

> "북극성이 모든 결정 기준? ✓ Stage 0의 골든 스레드가 모든 후속 Stage에 영향."

## 👤 ADVOCATE

> "솔로 1주 셋업이 부담? — 운영 단계 5배 절감으로 회수. 짧은 프로젝트는 패턴 0 권장."

## 🔨 BREAKER

> "UNLOCK 전 모든 체크 의무? ✓ 자동 UNLOCK 금지로 안전."

## 🛡️ SENTINEL

> "법적 제약이 Stage 0에서 명시? ✓ HARD_LIMITS + FORBIDDEN."

## 💻 HACKER

> "Contract가 IMPL Task 명확하게? ✓ 입출력+성능+검증 일체."

## 👻 GHOST

> "이 워크북이 CI/CD 호환? ✓ Contract Hash 검증 자동화."

---

# 11. 다음 단계

```
이 워크북 완주 후:
  → 06. Operating Manual (Stage 1+ 일일 운영)
  → 07. Verification Standard (Stage 4~5 통합 검증)
```

---

**END OF 05. PLANNING STAGE WORKBOOK**

_"Plan thoroughly, code briefly. The reverse is the road to chaos."_
