# 쪽집게(ThePick) — 구현 재정립서 v3.0 FINAL

> **멀티시험 AI 학습 SaaS 플랫폼 — 실행 가능한 상용 설계서**
>
> **본 문서의 성격:** 이 문서는 선언문이 아니라 **실행 계약서**이다.
> 모든 Phase는 주차별 체크리스트로 분해되며, 모든 판정 기준은 정량화되어 있다.
> Claude Code가 이 문서 하나만으로 Phase 0부터 착수할 수 있어야 한다.
>
> **전략 요약 (3 핵심 원칙):**
>
> 1. **Hardest-First** — 손해평가사(가장 복잡)로 엔진 검증 → 공인중개사/전기기사/소방기사 확장
> 2. **Pilot First, Platform Second** — Year 1은 손해평가사만 집중. 플랫폼 추상화는 Year 2 실증 후
> 3. **Extract After Two, Not After One** — 2개 실제 사례 본 후에만 범용 추상화
>
> 작성일: 2026-04-17
> 버전: v3.0 FINAL
> 이전 문서: v2.0 (단일 시험), v3.0 (초안) 전면 대체

---

## 목차

**Part I — 전략과 정체성**

1. [프로젝트 정의](#1-프로젝트-정의)
2. [Hardest-First 전략](#2-hardest-first-전략)
3. [비즈니스 모델](#3-비즈니스-모델)

**Part II — 기술 아키텍처** 4. [기술 스택 (12개 검증됨)](#4-기술-스택) 5. [Universal Engine + Adapter](#5-universal-engine--adapter) 6. [4-Level 메타데이터 범용화](#6-4-level-메타데이터-범용화) 7. [DB 스키마 멀티시험 재설계 (11개 테이블)](#7-db-스키마) 8. [프론트엔드 아키텍처](#8-프론트엔드-아키텍처) 9. [디렉토리 구조](#9-디렉토리-구조)

**Part III — 거버넌스** 10. [Hard Rules 17개](#10-hard-rules-17개) 11. [DEFCON 체계](#11-defcon-체계) 12. [DEV COVEN 페르소나](#12-dev-coven-페르소나)

**Part IV — 실행 계획** 13. [Phase -1: 사업 타당성 검증 (2주)](#13-phase--1-사업-타당성-검증) 14. [Year 1 Phase 0~3 주차별 체크리스트 (16주)](#14-year-1-phase-0~3) 15. [Year 2 Phase 4~6 (공인중개사 확장, 24주)](#15-year-2-phase-4~6) 16. [Year 3+ 지속 확장](#16-year-3-지속-확장)

**Part V — 품질과 리스크** 17. [품질 게이트 8 + 3 (멀티시험)](#17-품질-게이트) 18. [100% 필수 테스트 (시험별 독립)](#18-100-필수-테스트) 19. [리스크 레지스터 + 대응 절차](#19-리스크-레지스터)

**Part VI — 정량 판정** 20. [Go/No-Go 판정 기준](#20-gono-go-판정-기준) 21. [v2.0 → v3.0 변경 이력](#21-변경-이력)

---

---

# Part I — 전략과 정체성

---

## 1. 프로젝트 정의

### 1.1 본질

**쪽집게(ThePick)** — **AI 기반 자격시험 학습 SaaS 플랫폼**

```
핵심 가치 명제:
  "혼자 공부하는 수험생의 약점을
   Graph RAG 지식망과 FSRS 간격반복으로 정확히 타격하는
   AI 학습 파트너"

차별화 3대 축:
  1. Graph RAG (해설 환각 구조적 차단)
  2. 혼동 유형 자동 감지 (8종)
  3. 암기법 자동 매칭 (시험 특성에 맞춰)

타겟 포트폴리오:
  Year 1: 손해평가사 (R&D 파일럿, 1만 명 시장)
  Year 2: 공인중개사 (15만 명) + 전기기사 (5만 명)
  Year 3+: 소방기사, 주택관리사, 세무사 등
  합계 잠재 시장: 연간 ~28.5만 명 수험생
```

### 1.2 파일럿 대상의 선택 — 왜 손해평가사인가

손해평가사는 **극한의 복잡성을 가진 법령+산식 시험**이다:

| 복잡성 요소    | 손해평가사               | 공인중개사 | 전기기사      |
| -------------- | ------------------------ | ---------- | ------------- |
| 법령 계층      | 3계층 (본법+시행령+고시) | 2계층      | 0             |
| 산식 수        | 80+ 조건 분기 포함       | 2~3개      | 50+           |
| 매년 개정      | 2~5회                    | 1~2회      | 드묾          |
| 조건 분기      | 재해×보장×품목           | 단순       | 거의 없음     |
| 정답 허용 오차 | 0원                      | 0건        | 0.01          |
| 문제 유형      | 객관식 + 계산 + 서술     | 객관식     | 객관식 + 계산 |

**가장 복잡한 시험의 엔진은 다른 시험에 자연스럽게 이식 가능. 역방향은 불가능.**

### 1.3 Year별 목표 (정량)

```
Year 1 (손해평가사 파일럿):
  산출물: 손해평가사 베타 서비스
  지표:
    - 베타 사용자: 100명
    - 유료 전환율: 30% (30명)
    - 월 매출: 60만 원
    - 기출 정답률: 100% (!)
    - 오답 신고: 월 2건 이하
  본질: "수익" 아닌 "엔진 검증"

Year 2 (플랫폼 전환):
  산출물: 3개 시험 (손해평가사 + 공인중개사 + 전기기사)
  지표:
    - MAU: 1,000명+
    - 유료: 400명+
    - 월 매출: 2,500만 원
    - 연 매출: 3억
  본질: "SaaS 검증"

Year 3 (확장):
  산출물: 6개 시험
  지표:
    - MAU: 5,000명+
    - 월 매출: 1억+
    - 연 매출: 12~15억
  본질: "포트폴리오 사업화"
```

---

## 2. Hardest-First 전략

### 2.1 핵심 원칙 3개 (Non-negotiable)

#### 원칙 1: Pilot First, Platform Second

```
Year 1 전체 = 손해평가사 단일 서비스 완성에만 집중
Year 2 Q1 시점에 "2번째 시험 = 공인중개사" 작업 시작
  → 이때 비로소 Universal Engine 본격 추출
Year 2 Q2~ = 공인중개사 Adapter 완성 + 런칭

조기 추상화 함정 회피:
  "범용 엔진"을 2번째 사례 없이 설계하면 90% 잘못된다.
  손해평가사만 보고 만든 추상화는 공인중개사에서 대부분 폐기된다.
```

#### 원칙 2: Extract After Two

```
1개 사례로는 "시험별 고유 vs 범용" 판별 불가능
2개 사례가 있어야 공통점 추출 가능
그래서 Year 2 Phase 4(리팩토링)가 존재

단, 코드 "구조"는 Year 1부터 격리:
  exams/son-hae-pyeong-ga-sa/ 디렉토리 사전 구축
  ExamAdapter 인터페이스 사전 정의
  DB 스키마에 exam_id 사전 도입
  → Year 2 리팩토링 비용을 8주 이내로 제한
```

#### 원칙 3: Vertical Before Horizontal

```
1개 시험을 100% 완성 → 베타 → 유료 검증 → 확장
동시 다중 시험 개발 금지
  (스타트업이 망하는 가장 흔한 패턴)

Year 1에 손해평가사만 팀. Year 2 전까지 공인중개사 코드 한 줄도 없다.
Year 2 Phase 5 착수 전에 Phase 4 리팩토링 100% 완료 필수.
```

### 2.2 Adapter 사전 격리 전략 (Year 1의 타협)

Year 1에 완전한 플랫폼을 만들지 않되, **Year 2 리팩토링 비용을 최소화**하는 격리 구조를 미리 구축:

```
Year 1 구현:
  ✅ exams/son-hae-pyeong-ga-sa/ 디렉토리 사용
  ✅ ExamAdapter 인터페이스 정의 (손해평가사만 구현)
  ✅ DB 스키마에 exam_id 컬럼 전면 도입
  ✅ API 라우트 /api/exams/:exam/... 구조
  ✅ engine/ 디렉토리는 있되, 손해평가사 특화 로직 섞여도 OK (Year 2에 정리)
  ✅ Hard Rule 15~17 "느슨하게" 적용 (Year 2에 엄격화)

Year 2 Phase 4 (8주) 작업:
  - engine/ 내 손해평가사 특화 로직 식별 → exams/{id}/로 이동
  - Universal Engine 인터페이스 재설계
  - 공인중개사 Adapter를 작성하며 인터페이스 검증
  - 손해평가사 회귀 테스트 (기능 동일성 100%)
```

이것이 v3.0의 핵심 타협점이다. **"지금 당장 완벽한 플랫폼"** 과 **"나중에 안 만들어지는 플랫폼"** 사이의 현실적 중간 지점.

---

## 3. 비즈니스 모델

### 3.1 플랜 구조

| 플랜           | 월 가격   | 연 가격 (16.5% 할인) | 포함                        | 타겟             |
| -------------- | --------- | -------------------- | --------------------------- | ---------------- |
| **Free Trial** | 0원 (7일) | -                    | 전체 기능 체험, 기출 10문항 | 신규             |
| **Single**     | 19,900원  | 199,000원            | 1개 시험                    | 단일 시험 준비생 |
| **Combo**      | 29,900원  | 299,000원            | 3개 시험                    | 관련 시험 묶음   |
| **All-Access** | 39,900원  | 399,000원            | 전체 시험                   | 평생 학습자      |

### 3.2 무료/유료 경계

```
[Free - 로그인 불필요]
- 시험 소개 (합격률/일정/과목)
- 샘플 기출 3문항 (해설 미포함)
- 공개 블로그 (SEO)

[Free Trial - 7일]
- 전체 기능 체험
- 기출 10문항 완전 해설
- 플래시카드 20장
- AI 튜터 5회

[Paid - 구독 중]
- 전체 기출 풀이 (회차별)
- 전체 플래시카드
- AI 튜터 (월 100회 상한)
- FSRS 스케줄
- 대시보드 + 합격 예측
- 모의시험
- 암기법 생성
- 오프라인 모드
```

### 3.3 환불 정책

```
7일 이내: 전액 환불 (전자상거래법 준수)
7~30일: 사용 내역 비례 환불
30일 이후: 환불 불가 (약관 명시)
합격 환급 이벤트: 합격 증명 제출 시 마지막 달 요금 환급 (마케팅)
```

### 3.4 운영 경제성 (검증 필요 — Phase -1)

```
Year 1 (사용자 100명 기준):
  수익: 30명 × 19,900 × 6개월 = 360만 원
  비용:
    Cloudflare: $5/월 = 7만 원 × 12 = 84만 원
    Claude API: 파이프라인 $2 + 튜터 30명×$3 = 120만 원/년
    변호사 자문 + 도메인 + 기타: 50만 원
    → 비용 총합: ~254만 원
  손익: +106만 원 (검증 성공)
  ** Year 1은 인건비 제외. 인건비 포함 시 적자는 당연.
  ** 목표는 수익이 아닌 "엔진 검증"

Year 2 (MAU 1,000명 기준):
  수익: 연 3억
  비용:
    Cloudflare: $50/월 = 720만 원
    Claude API: 월 $500~1,000 = 연 1,000만 원
    인건비 (진산 + 파트타임 1인): 월 600만 원 = 연 7,200만 원
    마케팅: 연 3,000만 원
    기타: 1,000만 원
    → 비용 총합: ~1.3억
  손익: +1.7억 (확장 자금 확보)
```

**Phase -1에서 이 수치의 근거를 검증해야 함.**

---

---

# Part II — 기술 아키텍처

---

## 4. 기술 스택

12개 핵심 기술 전부 리서치 완료 (`CORE_TECH_RESEARCH_v1.md`). 최종 판정:

| #   | 기술                  | 판정    | 역할       | 핵심 제약                            |
| --- | --------------------- | ------- | ---------- | ------------------------------------ |
| 1   | Cloudflare D1         | ⚠️ 채택 | 구조화 DB  | 10GB/DB, 단일 스레드 쓰기            |
| 2   | Cloudflare Vectorize  | ⚠️ 채택 | 벡터 검색  | **dimension 변경 불가 (PoC 필수)**   |
| 3   | Astro + React Islands | ✅ 확정 | 프론트엔드 | Islands 과다 금지                    |
| 4   | Drizzle ORM           | ✅ 확정 | DB 접근    | D1 네이티브                          |
| 5   | math.js AST           | ⚠️ 채택 | 산식 실행  | **위험 함수 비활성화 필수**          |
| 6   | FSRS-5 (ts-fsrs)      | ✅ 확정 | 간격반복   | Python 참조 100% 일치 검증           |
| 7   | pdfplumber (Python)   | ⚠️ 채택 | PDF 파싱   | **한글 테스트 필수**, 실패시 PyMuPDF |
| 8   | IndexedDB + Dexie.js  | ✅ 확정 | 오프라인   | iOS 7일 규칙 주의                    |
| 9   | Zustand               | ✅ 확정 | 상태관리   | -                                    |
| 10  | Hono                  | ✅ 확정 | 백엔드     | -                                    |
| 11  | Claude API (Haiku)    | ⚠️ 채택 | AI 구조화  | Ontology 준수 검증 필수              |
| 12  | PWA + Service Worker  | ✅ 확정 | 앱         | iOS Safari 제한 인지                 |

**Phase 0 PoC 필수 검증 5개:**

1. 한국어 임베딩 모델 선정 (Vectorize dimension 확정)
2. math.js 부동소수점 정밀도 (산식 100% 정확)
3. pdfplumber 한글 PDF 호환성
4. D1 복합 쿼리 성능 (<100ms)
5. FSRS TypeScript 정확도 (Python 참조 100%)

### 4.1 Vectorize 인덱스 전략 (멀티시험 대응)

**결정: 단일 인덱스 + `exam_id` 메타데이터 필터.**

```
이유:
  - 5M 벡터 한도 = 10개 시험 × 50만 벡터 가능
  - 인덱스 관리 단순
  - 시험 간 공유 개념 검색 가능성 확보

격리:
  모든 upsert/query에 exam_id 메타데이터 필수
  쿼리 시 filter: { exam_id: 'son-hae-pyeong-ga-sa' }
  크로스 시험 검색은 명시적으로만 허용
```

---

## 5. Universal Engine + Adapter

### 5.1 2계층 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│              Universal Learning Engine (engine/)              │
│                  시험 지식 無 · 범용 로직 only                  │
│                                                                │
│  Graph RAG · Formula · FSRS · Confusion · Mnemonic · Exam     │
└──────────────────────────────────────────────────────────────┘
                      ▲ ExamAdapter 인터페이스
                      │
┌─────────────────────┴────────────────────────────────────────┐
│             Exam-Specific Adapters (exams/{id}/)              │
│                                                                │
│  ┌─────────────────────┐  ┌─────────────────────┐            │
│  │ son-hae-pyeong-ga-sa│  │ (Year 2)            │            │
│  │ (손해평가사)        │  │ gong-in-jung-gae-sa │            │
│  └─────────────────────┘  └─────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 ExamAdapter 인터페이스 (완전판)

```typescript
// packages/shared/src/exam-adapter.ts

/** 시험별 Adapter가 구현해야 할 완전한 계약 */
export interface ExamAdapter {
  // ============ 식별 ============
  readonly id: string; // 'son-hae-pyeong-ga-sa'
  readonly name: LocalizedString; // { ko: '손해평가사', en: 'Loss Assessor' }
  readonly version: string; // '1.0.0'
  readonly status: 'alpha' | 'beta' | 'live' | 'archived';

  // ============ 계층 구조 ============
  readonly hierarchy: {
    lv1: HierarchyLevel; // Exam Domain (보장방식, 법률 분야, 이론 분야...)
    lv2: HierarchyLevel; // Sub-Category
    lv3: HierarchyLevel; // Process/Procedure
  };

  // ============ Ontology ============
  readonly ontology: {
    nodeTypes: readonly NodeType[]; // CONCEPT | LAW | FORMULA | ...
    edgeTypes: readonly EdgeType[]; // APPLIES_TO | REQUIRES | ...
    idPatterns: Record<NodeType, RegExp>;
  };

  // ============ 산식 (있는 시험만) ============
  readonly formulas?: readonly FormulaDefinition[];

  // ============ 파서 규칙 ============
  readonly parserRules: {
    textbook: ParserRuleSet; // 교재 구조화 규칙
    law: ParserRuleSet; // 법령 구조화 규칙
    examQuestion: ParserRuleSet; // 기출 파싱 규칙
  };

  // ============ 혼동 패턴 ============
  readonly confusionPatterns: readonly ConfusionPattern[];

  // ============ 암기법 템플릿 ============
  readonly mnemonicTemplates: readonly MnemonicTemplate[];

  // ============ 100% 필수 테스트 ============
  readonly criticalTests: readonly string[];

  // ============ 저작권 상태 ============
  readonly licenseStatus: LicenseStatus;

  // ============ 메서드 (시험별 특수 로직) ============

  /** 이 시험 특유 데이터 로딩 */
  loadExamData?(): Promise<void>;

  /** 이 시험 특유 UI 커스터마이징 훅 */
  getCustomComponents?(): CustomComponentMap;

  /** 이 시험 특유 혼동 감지 보강 */
  detectCustomConfusion?(input: string, target: KnowledgeNode): ConfusionResult[];
}

// 보조 타입들
export type LocalizedString = { ko: string; en?: string };

export interface HierarchyLevel {
  label: LocalizedString;
  values: readonly string[];
  description?: LocalizedString;
}

export type NodeType =
  | 'CONCEPT'
  | 'LAW'
  | 'FORMULA'
  | 'CONSTANT'
  | 'INVESTIGATION'
  | 'CASE_LAW'
  | 'CIRCUIT';

export type EdgeType = 'APPLIES_TO' | 'REQUIRES' | 'CONTRADICTS' | 'REFERENCES' | 'SUPERSEDES';

export interface FormulaDefinition {
  id: string;
  name: string;
  equation: string; // 'base * (1 - deductible_rate)'
  variables: VariableSchema[];
  constraints?: string[]; // 'base > 0', 'deductible_rate <= 1'
  expectedExamples: ExampleCase[]; // 교재 예시값 (100% 대조용)
}

export interface ParserRuleSet {
  sectionPatterns: RegExp[];
  tableExtractionStrategy: 'pdfplumber' | 'pymupdf' | 'custom';
  encodingFallback: string[];
  validationRules: ValidationRule[];
}

export interface ConfusionPattern {
  id: string;
  type: ConfusionType;
  description: LocalizedString;
  detectionLogic: (input: string, target: KnowledgeNode) => boolean;
}

export type ConfusionType =
  | 'numeric_similarity' // 5% vs 50%
  | 'scope_confusion' // 해당 vs 비해당
  | 'temporal_confusion' // 이전 vs 이후
  | 'conditional_confusion' // AND vs OR
  | 'synonym_confusion' // 유사 용어
  | 'hierarchy_confusion' // 상위 vs 하위
  | 'exception_confusion' // 원칙 vs 예외
  | 'negation_confusion'; // 긍정 vs 부정

export interface MnemonicTemplate {
  id: string;
  method: 'acronym' | 'peg' | 'palace' | 'story' | 'rhyme';
  targetConfusion: ConfusionType[];
  template: string;
  example: string;
}

export type LicenseStatus =
  | 'owned' // 자체 제작
  | 'licensed' // 출판사 계약
  | 'public' // 공개 자료 (법제처, Q-Net)
  | 'fair-use' // 저작권법 28조 (인용)
  | 'pending'; // 확인 중
```

### 5.3 Engine 구조

```typescript
// engine/content/application/SearchGraphUseCase.ts (예시)

export class SearchGraphUseCase {
  constructor(
    private nodeRepo: KnowledgeNodeRepository,
    private vectorSearch: VectorSearchService,
    private adapterRegistry: AdapterRegistry,
  ) {}

  async execute(params: {
    examId: string;
    query: string;
    filters?: SearchFilters;
  }): Promise<SearchResult> {
    // 1. Adapter 로드
    const adapter = this.adapterRegistry.get(params.examId);
    if (!adapter) throw new ExamNotFoundError(params.examId);

    // 2. Ontology 검증 (adapter.ontology 사용)
    const allowedTypes = adapter.ontology.nodeTypes;

    // 3. 검색 실행 (exam_id 필터 필수)
    const vectorResults = await this.vectorSearch.query({
      query: params.query,
      filter: {
        exam_id: params.examId,
        ...params.filters,
      },
      topK: 20,
    });

    // 4. Truth Weight 정렬
    const sorted = sortByTruthWeight(vectorResults);

    // 5. Graceful Degradation (유사도 < 0.60)
    const filtered = sorted.filter((r) => r.similarity >= 0.6);

    return { results: filtered, adapter: adapter.id };
  }
}
```

**핵심:** `engine/` 내부에 `if (examId === '손해평가사')` 같은 분기 절대 금지. 모든 시험별 분기는 `adapter` 객체를 경유.

---

## 6. 4-Level 메타데이터 범용화

### 6.1 문제 정의

v2.0은 손해평가사 용어로 하드코딩:

```
LV1: 보장방식 (8종)          ← 손해평가사 전용
LV2: 품목/작물군 (70+)       ← 손해평가사 전용
LV3: 조사 종류 (16종)        ← 손해평가사 전용
LV4: 구성요소
```

공인중개사 적용 불가 (해당 개념 없음).

### 6.2 v3.0 범용 정의

```
LV1: Exam Domain (시험 영역)
  → 시험의 최상위 분류
  → 의미는 adapter.hierarchy.lv1이 정의

LV2: Sub-Category (하위 분류)
  → LV1 아래 세부 분류
  → 의미는 adapter.hierarchy.lv2가 정의

LV3: Process/Procedure (절차/과정)
  → 수행 행위 또는 문제 유형 분류
  → 의미는 adapter.hierarchy.lv3가 정의

LV4: Concrete Unit (구체 단위)
  → 개별 개념/산식/절차 (모든 시험 공통)
```

### 6.3 시험별 매핑 (참고 예시)

| Level | 손해평가사        | 공인중개사                 | 전기기사                   | 소방기사       |
| ----- | ----------------- | -------------------------- | -------------------------- | -------------- |
| LV1   | 보장방식 (8)      | 법률 분야 (4)              | 이론 분야 (5)              | 법령 분야 (3)  |
| LV2   | 품목/작물군 (70+) | 법령 조문군 (300+)         | 주제 영역 (30)             | 설비 유형 (20) |
| LV3   | 조사 종류 (16)    | 문제 유형 (조문/판례/계산) | 문제 유형 (계산/이론/회로) | 계산/이론/실무 |
| LV4   | 산식/상수         | 조문/판례                  | 공식/회로                  | 설비 규정      |

### 6.4 Engine의 LV 사용 원칙

```
Engine은 LV 의미를 모른다.
  - 쿼리: WHERE lv1 = ? AND lv2 = ? (단순 동등 비교)
  - UI: adapter.hierarchy에서 label + values 읽어 동적 생성
  - 검색 우선순위: lv1 → lv2 → lv3 범위 순서 (의미 아닌 계층)
```

---

## 7. DB 스키마

### 7.1 전체 테이블 (11개)

11개 테이블 = 콘텐츠 9개 + 시험 메타 1개 + 사용자 1개.

```sql
-- ==============================================================
-- 1. exams (시험 메타 — 신규)
-- ==============================================================
CREATE TABLE exams (
  id TEXT PRIMARY KEY,                  -- 'son-hae-pyeong-ga-sa'
  name_ko TEXT NOT NULL,
  name_en TEXT,
  status TEXT NOT NULL DEFAULT 'alpha', -- alpha|beta|live|archived
  launched_at TEXT,
  hierarchy_json TEXT NOT NULL,         -- LV1~LV3 정의 (JSON)
  ontology_json TEXT NOT NULL,          -- 허용 ID/타입 (JSON)
  license_status TEXT NOT NULL,         -- owned|licensed|public|fair-use
  adapter_version TEXT NOT NULL,        -- '1.0.0'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ==============================================================
-- 2. knowledge_nodes (INSERT-only, UPDATE 금지 — Hard Rule #1)
-- ==============================================================
CREATE TABLE knowledge_nodes (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id),  -- ★ 멀티시험 격리
  type TEXT NOT NULL,                          -- CONCEPT|LAW|FORMULA|...
  name TEXT NOT NULL,
  description TEXT,
  lv1 TEXT, lv2 TEXT, lv3 TEXT,                -- 범용 4-Level
  page_ref TEXT,
  batch_id TEXT,
  version_year INTEGER NOT NULL,
  superseded_by TEXT,                          -- 개정 시 새 노드 ID
  truth_weight INTEGER NOT NULL DEFAULT 5,     -- LAW=10 > FORMULA=8 > INV=7 > CONCEPT=5
  status TEXT NOT NULL DEFAULT 'draft',        -- draft|reviewed|published|flagged
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_nodes_exam ON knowledge_nodes(exam_id);
CREATE INDEX idx_nodes_exam_type ON knowledge_nodes(exam_id, type);
CREATE INDEX idx_nodes_exam_lv1 ON knowledge_nodes(exam_id, lv1);
CREATE INDEX idx_nodes_exam_status ON knowledge_nodes(exam_id, status);
CREATE INDEX idx_nodes_superseded ON knowledge_nodes(superseded_by)
  WHERE superseded_by IS NOT NULL;

-- ==============================================================
-- 3. knowledge_edges (INSERT-only)
-- ==============================================================
CREATE TABLE knowledge_edges (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id),
  from_node TEXT NOT NULL REFERENCES knowledge_nodes(id),
  to_node TEXT NOT NULL REFERENCES knowledge_nodes(id),
  edge_type TEXT NOT NULL,              -- APPLIES_TO|REQUIRES|CONTRADICTS|...
  condition TEXT,                       -- 조건부 엣지
  priority INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_edges_exam ON knowledge_edges(exam_id);
CREATE INDEX idx_edges_exam_from ON knowledge_edges(exam_id, from_node);
CREATE INDEX idx_edges_exam_type ON knowledge_edges(exam_id, edge_type);

-- ==============================================================
-- 4. formulas (INSERT-only)
-- ==============================================================
CREATE TABLE formulas (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id),
  name TEXT NOT NULL,
  equation_template TEXT NOT NULL,      -- 'base * rate'
  equation_display TEXT,                -- KaTeX 렌더링용
  variables_schema TEXT NOT NULL,       -- JSON
  expected_inputs TEXT,                 -- 교재 예시 (JSON)
  constraints TEXT,                     -- 'base > 0'
  graceful_degradation TEXT,            -- 계산 실패 시 사용자 안내 메시지
  page_ref TEXT,
  node_id TEXT REFERENCES knowledge_nodes(id),
  version_year INTEGER NOT NULL,
  superseded_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_formulas_exam ON formulas(exam_id);

-- ==============================================================
-- 5. constants (보험요율, 자기부담율 등 — 직접 DB 조회만, LLM 추론 금지)
-- ==============================================================
CREATE TABLE constants (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  numeric_value REAL,
  unit TEXT,
  applies_to TEXT NOT NULL,             -- JSON
  lv1_context TEXT,
  confusion_risk TEXT,
  confusion_level TEXT DEFAULT 'normal', -- normal|warning|danger
  page_ref TEXT,
  version_year INTEGER NOT NULL,
  exam_frequency INTEGER DEFAULT 0,
  related_formula TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_const_exam ON constants(exam_id);
CREATE INDEX idx_const_exam_category ON constants(exam_id, category);
CREATE INDEX idx_const_exam_confusion ON constants(exam_id, confusion_level);

-- ==============================================================
-- 6. revision_changes (개정 이력)
-- ==============================================================
CREATE TABLE revision_changes (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id),
  version_year INTEGER NOT NULL,
  revision_date TEXT NOT NULL,
  category TEXT NOT NULL,
  target_section TEXT,
  target_scope TEXT,                    -- JSON
  change_type TEXT NOT NULL,            -- added|modified|deleted|superseded
  before_value TEXT,
  after_value TEXT,
  exam_priority INTEGER DEFAULT 10,     -- 기출 출제 중요도
  related_constants TEXT,
  related_nodes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_rev_exam ON revision_changes(exam_id);
CREATE INDEX idx_rev_exam_version ON revision_changes(exam_id, version_year);

-- ==============================================================
-- 7. exam_questions (기출 문제)
-- ==============================================================
CREATE TABLE exam_questions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id),
  year INTEGER NOT NULL,
  round INTEGER,
  question_number INTEGER,
  subject TEXT,
  content TEXT NOT NULL,
  answer TEXT,
  explanation TEXT,
  valid_from TEXT,
  valid_until TEXT,                     -- 개정으로 무효화된 경우
  superseded_by TEXT,
  exam_type TEXT,                       -- 1차|2차|기타
  topic_cluster TEXT,
  memorization_type TEXT,
  confusion_type TEXT,                  -- 8종 중 하나
  related_nodes TEXT,                   -- JSON
  related_constants TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active|flagged|archived
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_q_exam ON exam_questions(exam_id);
CREATE INDEX idx_q_exam_year ON exam_questions(exam_id, year);
CREATE INDEX idx_q_exam_subject ON exam_questions(exam_id, subject);
CREATE INDEX idx_q_exam_status ON exam_questions(exam_id, status);

-- ==============================================================
-- 8. mnemonic_cards (암기법 카드)
-- ==============================================================
CREATE TABLE mnemonic_cards (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id),
  target_id TEXT NOT NULL,              -- 대상 노드/상수/산식
  target_type TEXT NOT NULL,            -- node|constant|formula
  confusion_type TEXT,
  memorization_method TEXT NOT NULL,    -- acronym|peg|palace|story|rhyme
  content TEXT NOT NULL,
  reverse_verified INTEGER DEFAULT 0,   -- 역방향 복원 검증 완료 여부
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_mnemonic_exam ON mnemonic_cards(exam_id);
CREATE INDEX idx_mnemonic_exam_target ON mnemonic_cards(exam_id, target_id);

-- ==============================================================
-- 9. user_progress (학습 진도)
-- ==============================================================
CREATE TABLE user_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  exam_id TEXT NOT NULL REFERENCES exams(id),
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,            -- card|question|formula
  fsrs_difficulty REAL,
  fsrs_stability REAL,
  fsrs_interval INTEGER,
  fsrs_next_review TEXT,
  last_confusion_type TEXT,
  total_reviews INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  last_reviewed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_progress_user_exam ON user_progress(user_id, exam_id);
CREATE INDEX idx_progress_next_review
  ON user_progress(user_id, exam_id, fsrs_next_review);

-- ==============================================================
-- 10. topic_clusters (토픽 클러스터링)
-- ==============================================================
CREATE TABLE topic_clusters (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id),
  name TEXT NOT NULL,
  lv1 TEXT, lv2 TEXT, lv3 TEXT,
  exam_frequency INTEGER DEFAULT 0,     -- 기출 출제 빈도
  is_covered INTEGER DEFAULT 1,         -- 미출제 영역 여부 (Hard Rule #12)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_cluster_exam ON topic_clusters(exam_id);

-- ==============================================================
-- 11. users (사용자 + 구독)
-- ==============================================================
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  subscription_plan TEXT,               -- single|combo|all-access
  subscribed_exams TEXT,                -- JSON array
  subscription_started_at TEXT,
  subscription_expires_at TEXT,
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_plan ON users(subscription_plan);
```

### 7.2 Vectorize 메타데이터

```typescript
// 모든 upsert에 exam_id 포함
const vectorMeta = {
  exam_id: 'son-hae-pyeong-ga-sa', // ★ 필수
  node_id: 'CONCEPT-001',
  type: 'CONCEPT',
  lv1: 'INS-01',
  lv2: 'CROP-APPLE',
  lv3: 'INV-01',
  truth_weight: 5,
};

// 모든 query에 exam_id 필터
const results = await env.VECTORIZE.query(embedding, {
  filter: { exam_id: currentExamId },
  topK: 20,
});
```

### 7.3 마이그레이션 전략

```
Year 1 초기 (Phase 0):
  migrations/0001_initial_schema.sql  ← 위 11개 테이블 전체

Year 1 중:
  migrations/000N_xxx.sql  ← 필요 시 세부 조정

Year 2 Phase 4 (리팩토링):
  단일 시험 데이터 이미 exam_id='son-hae-pyeong-ga-sa'로 들어있음
  → 추가 마이그레이션 없이 공인중개사 데이터 INSERT만 하면 됨
  (exam_id 전면 도입의 장점)
```

---

## 8. 프론트엔드 아키텍처

### 8.1 라우팅 구조

```
apps/web/src/pages/
├── index.astro                          # 시험 선택 허브
├── exams/
│   ├── index.astro                      # 전체 시험 목록
│   └── [exam]/                          # 동적 라우트
│       ├── index.astro
│       ├── study/
│       │   ├── flashcard.astro
│       │   ├── exam.astro
│       │   ├── weakness.astro
│       │   └── mock.astro
│       └── dashboard.astro
├── account/
│   ├── subscription.astro
│   └── settings.astro
└── auth/
    ├── login.astro
    ├── signup.astro
    └── callback.astro
```

### 8.2 컴포넌트 구조

```
apps/web/src/components/
├── shared/                              # 시험 무관
│   ├── SwipeCard.tsx
│   ├── ProgressBar.tsx
│   ├── BottomNav.tsx
│   ├── OfflineIndicator.tsx
│   └── ExamSwitcher.tsx                # 시험 전환
├── engine/                              # Engine 연동
│   ├── FlashCard.tsx                    # adapter 경유
│   ├── ExamQuiz.tsx
│   ├── MnemonicDisplay.tsx
│   ├── FormulaCalculator.tsx
│   └── GraphRAGResult.tsx
├── exams/                               # 시험별 특수
│   └── son-hae-pyeong-ga-sa/
│       ├── InvestigationFlowchart.tsx
│       ├── CropSelector.tsx
│       └── InsuranceTypeMatrix.tsx
└── layouts/
    ├── ExamLayout.astro
    └── HubLayout.astro
```

### 8.3 IndexedDB (Dexie.js) 스키마

```typescript
// apps/web/src/lib/local-db.ts
import Dexie, { type EntityTable } from 'dexie';

interface LocalExam {
  id: string;
  name_ko: string;
  subscribed: boolean;
}
interface LocalNode {
  exam_id: string;
  id: string;
  type: string;
  lv1: string; /* ... */
}
// ... 기타 타입

export const db = new Dexie('thepick') as Dexie & {
  exams: EntityTable<LocalExam, 'id'>;
  nodes: EntityTable<LocalNode, ['exam_id', 'id']>;
  // ...
};

db.version(1).stores({
  exams: 'id, name_ko, subscribed',
  nodes: '[exam_id+id], exam_id, type, lv1',
  constants: '[exam_id+id], exam_id, category',
  questions: '[exam_id+id], exam_id, year',
  progress: '[exam_id+id], exam_id, fsrs_next_review',
  flashcards: '[exam_id+id], exam_id, fsrs_next_review',
  mnemonics: '[exam_id+id], exam_id',
  offline_actions: 'id, exam_id, created_at, synced',
  user: 'id', // 1-row
});
```

**복합 인덱스 `[exam_id+id]`** 로 시험별 격리 + 빠른 쿼리.

### 8.4 상태 관리 (Zustand)

```typescript
// apps/web/src/stores/exam-store.ts
interface ExamState {
  activeExamId: string | null;
  availableExams: ExamSummary[];
  subscribedExams: ExamSummary[];

  switchExam: (examId: string) => Promise<void>;
  getAdapter: () => ExamAdapter | null;
  canAccess: (examId: string) => boolean;
}

// apps/web/src/stores/progress-store.ts (exam_id 컨텍스트)
interface ProgressState {
  // 현재 활성 시험의 진도만 메모리 보관
  // 시험 전환 시 IndexedDB에서 재로드
}
```

---

## 9. 디렉토리 구조

### 9.1 완전한 트리

```
ThePick/
├── .jjokjipge/                          # 세션 상태 (Claude Code 복구용)
│   ├── state.json
│   ├── completed.md
│   ├── blockers.md
│   └── decisions.md
│
├── apps/
│   ├── web/                             # 학습자 PWA (Astro)
│   ├── admin-web/                       # 관리자 CMS (Astro, 번들 분리)
│   ├── api/                             # Cloudflare Workers (Hono)
│   └── batch/                           # 파이프라인 (로컬/CI)
│
├── engine/                              # Universal Learning Engine ⭐
│   ├── content/
│   │   ├── domain/           # 순수 도메인 로직 (프레임워크 無)
│   │   ├── application/      # 유스케이스
│   │   └── infrastructure/   # D1, Vectorize 어댑터
│   ├── formula/              # math.js AST 래핑
│   ├── learning/             # FSRS, Confusion, Mnemonic
│   └── exam/                 # 모의시험, 채점
│
├── exams/                               # 시험별 Adapter ⭐
│   ├── _template/                       # 새 시험 생성 템플릿
│   │   ├── README.md
│   │   ├── adapter.ts
│   │   ├── ontology.json
│   │   ├── hierarchy.ts
│   │   ├── parser-rules.ts
│   │   └── tests/
│   ├── son-hae-pyeong-ga-sa/           # 손해평가사 (Year 1)
│   │   ├── adapter.ts                   # ExamAdapter 구현
│   │   ├── ontology.json
│   │   ├── hierarchy.ts
│   │   ├── formulas/
│   │   │   ├── index.ts
│   │   │   ├── fruit.ts
│   │   │   ├── rice.ts
│   │   │   └── livestock.ts
│   │   ├── parsers/
│   │   │   ├── textbook.ts
│   │   │   ├── law.ts
│   │   │   └── exam-question.ts
│   │   ├── confusion-patterns.ts
│   │   ├── mnemonic-templates.ts
│   │   └── tests/
│   │       ├── formula-accuracy.test.ts
│   │       ├── ontology-compliance.test.ts
│   │       ├── parser-accuracy.test.ts
│   │       └── constants-precision.test.ts
│   └── (Year 2+) gong-in-jung-gae-sa/
│
├── packages/
│   ├── shared/                          # 공통 타입/유틸
│   │   └── src/
│   │       ├── exam-adapter.ts          # ExamAdapter 인터페이스
│   │       ├── errors.ts
│   │       ├── types.ts
│   │       └── i18n-keys.ts
│   ├── parser/                          # 범용 파이프라인
│   ├── study-material-generator/        # 범용 생성기
│   └── quality/                         # 범용 품질 검증
│
├── migrations/
│   └── 0001_initial_schema.sql
│
├── docs/
│   ├── architecture/
│   │   ├── ENGINE_ADAPTER_BOUNDARY.md
│   │   ├── MULTI_EXAM_DATA_FLOW.md
│   │   └── ADAPTER_CONTRACT.md
│   ├── decisions/                       # ADR (최소 15개)
│   ├── epics/                           # Phase 완료 시 1개씩
│   └── runbooks/
│       ├── ADD_NEW_EXAM.md
│       ├── PIPELINE_EXECUTION.md
│       ├── INCIDENT_RESPONSE.md
│       └── DISASTER_RECOVERY.md
│
├── Guide/                               # VOID DEV HARNESS 원본 (수정 금지)
├── .claude/rules/
├── CLAUDE.md                            # Hard Rules 17개 + DEFCON + COVEN
├── package.json                         # pnpm workspace
├── turbo.json                           # Turborepo 설정
└── tsconfig.base.json
```

### 9.2 디렉토리별 책임

| 디렉토리      | 역할                 | 시험 지식              |
| ------------- | -------------------- | ---------------------- |
| `engine/`     | Universal Engine     | ❌ 금지 (Hard Rule 15) |
| `exams/{id}/` | 시험별 Adapter       | ✅ 집중                |
| `packages/`   | 범용 유틸/파이프라인 | ❌ 금지                |
| `apps/`       | 진입점 (API, Web)    | Adapter 경유만         |

---

---

# Part III — 거버넌스

---

## 10. Hard Rules 17개

### 10.1 기본 규칙 14개 (v2.0 유지)

```
Rule 1:  UPDATE 금지 (knowledge_nodes, formulas는 INSERT-only + superseded_by)
Rule 2:  LLM 연산 금지 (산식 계산은 Formula Engine만)
Rule 3:  Truth Weight 강제 정렬 (LAW 10 > FORMULA 8 > INVESTIGATION 7 > CONCEPT 5)
Rule 4:  Graceful Degradation (유사도 < 0.60 → 해설 거부, 사용자에 안내)
Rule 5:  Constants 직접 조회 (LLM 숫자 추론 금지, DB 조회만)
Rule 6:  배치 순서 엄수 (BATCH N 검증 없이 N+1 금지)
Rule 7:  인간 검수 필수 (AI 생성은 status='draft', 검수 후 'published')
Rule 8:  Ontology Lock (허용 ID 외 거부 + 재수행 요청)
Rule 9:  eval() 금지 (math.js AST만, 위험 함수 비활성화)
Rule 10: Hairball 방지 (Graph Visualizer 서브그래프 단위만)
Rule 11: 기출 정답 최우선 (Graph ↔ 기출 충돌 → flagged, 인간 조정)
Rule 12: 미출제 영역 라벨링 (topic_clusters.is_covered=false 명시)
Rule 13: 공유 노드 무결성 (수정 시 영향 범위 검토)
Rule 14: 암기법 역방향 검증 (복원 실패 시 reverse_verified=0, 폐기)
```

### 10.2 멀티시험 규칙 3개 (v3.0 신규)

```
Rule 15: 시험 종속성 고립
  engine/ 코드는 특정 시험의 용어, 도메인, 산식을 하드코딩하지 않는다.
  모든 시험별 지식은 exams/{exam-id}/ 에만 존재한다.

  금지 예시:
    if (examId === 'son-hae-pyeong-ga-sa') { /* ... */ }
    const INSURANCE_TYPES = ['적과전', '적과후', ...];  // engine/ 내
    function 적과후착과수조사() { ... }  // engine/ 내

  허용 예시:
    const adapter = adapterRegistry.get(examId);
    const insuranceTypes = adapter.hierarchy.lv1.values;

Rule 16: Ontology 플러그인화
  ontology는 exams/{exam-id}/ontology.json에 격리된다.
  시험 간 ID 네임스페이스 오염 절대 금지.

  ID 충돌 방지:
    각 시험 ID는 prefix 사용: 'SHPGS-CONCEPT-001', 'GIJGS-LAW-42'
    또는 compound key: (exam_id, local_id)

Rule 17: 테스트 플러그인화
  100% 필수 테스트는 exams/{exam-id}/tests/에 독립 존재한다.
  한 시험의 테스트 실패가 다른 시험 배포를 막지 않는다.

  CI 구조:
    - engine/tests/                → 모든 PR에서 실행
    - exams/son-hae-pyeong-ga-sa/tests/ → 손해평가사 관련 PR만
    - exams/gong-in-jung-gae-sa/tests/ → 공인중개사 관련 PR만
```

---

## 11. DEFCON 체계

### 11.1 레벨 정의

| Level  | 조건           | Claude Code 동작               |
| ------ | -------------- | ------------------------------ |
| **L1** | 일반 코드 작성 | Red-Green-Refactor 자동 진행   |
| **L2** | 설계 영향 있음 | plan 제시 후 진행 (자동 승인)  |
| **L3** | 치명적 영역    | plan 제시 → **인간 승인 대기** |

### 11.2 L3 영역 (인간 승인 필수)

```
DB Schema:
  - migrations/*.sql 신규/수정
  - knowledge_nodes, formulas 스키마 변경
  - exam_id 관련 필드 변경

Formula Engine:
  - engine/formula/ 내부 로직 변경
  - math.js 설정 변경
  - 위험 함수 활성화

Ontology:
  - exams/{id}/ontology.json 변경
  - packages/shared/src/exam-adapter.ts 변경

Security:
  - 인증/인가 로직
  - JWT 관련
  - API rate limit

Hard Rules:
  - CLAUDE.md 규칙 변경
  - Hard Rule 추가/삭제

Cross-Exam:
  - engine/ 내 시험 종속성 의심 코드
  - adapter registry 변경
```

### 11.3 L3 절차

```
1. Claude Code가 L3 영역 감지
2. 작업 중단 → plan 작성
3. 인간 승인 대기 (진산)
4. 승인 후 진행
5. 완료 후 docs/decisions/ADR_XXX.md 작성 필수
```

---

## 12. DEV COVEN 페르소나

7인 전문가 집단. 각 페르소나는 특정 관점에서 검토/결정.

```
MEPHISTO — 조율자 (전체 조망, 균형)
ORACLE — 제품 비전 (사용자 니즈, 타겟)
ARCHITECT — 시스템 설계 (구조, 확장성)
HACKER — 구현 (속도, 실용)
BREAKER — QA (엣지 케이스, 파괴)
GHOST — 인프라 (운영, 관찰 가능성)
ADVOCATE — UX (접근성, 사용성)
SENTINEL — 보안 (위협 모델링)
```

### 12.1 Phase별 주도 페르소나

| Phase                     | 주도               | 조언           |
| ------------------------- | ------------------ | -------------- |
| Phase -1 (사업 타당성)    | ORACLE + MEPHISTO  | ADVOCATE       |
| Phase 0 (PoC)             | HACKER + ARCHITECT | BREAKER, GHOST |
| Phase 1 (Data+Engine)     | ARCHITECT + HACKER | BREAKER        |
| Phase 2 (Content+Service) | HACKER + ADVOCATE  | BREAKER        |
| Phase 3 (Launch)          | SENTINEL + GHOST   | MEPHISTO       |
| Phase 4 (Refactor)        | ARCHITECT          | BREAKER        |

### 12.2 의사결정 패턴

```
기술 결정 → ARCHITECT + HACKER 합의
보안 결정 → SENTINEL 거부권
UX 결정 → ADVOCATE + ORACLE 합의
품질 결정 → BREAKER 거부권
충돌 시 → MEPHISTO 최종 판정
```

---

---

# Part IV — 실행 계획

---

## 13. Phase -1: 사업 타당성 검증

### 13.1 목적

**기술 개발 착수 전, 사업이 성립하는지 검증.** 이 단계를 생략하면 16주 개발 후 "시장 없음" 발견 리스크.

### 13.2 기간: 2주 / 예산: 40만 원

### 13.3 Week A — 시장 조사

#### [B-1] 시장 조사 심화 (2일)

```
□ Q-Net 연도별 응시자 통계 수집 (2019~2024)
  대상: 손해평가사, 공인중개사, 전기기사, 소방기사
  산출: docs/research/MARKET_DATA.md

□ 경쟁 서비스 5개 조사
  대상: 박문각, 에듀플러스, 해커스, 듀오링고 (교육 앱), 패스원
  조사: 가격, 기능, 사용자 수, 차별점
  산출: docs/research/COMPETITOR_ANALYSIS.md

□ 네이버 카페/당근 커뮤니티 글 100개 분석
  수험생 페인포인트, 현재 공부법, 지불 의사 수집
  산출: docs/research/COMMUNITY_INSIGHTS.md

완료 조건:
  - 시장 규모 정량 확인 (손해평가사 1만, 공인중개사 15만 등)
  - 경쟁 서비스 대비 차별점 3개 이상 도출
```

#### [B-2] 수험생 인터뷰 5명 (3일)

```
□ 네이버 카페/당근 공고 게시 (1인 10,000원 사례비)
  조건: 손해평가사 2차 응시 경험자 우선
  모집: 5명

□ 각 1시간 심층 인터뷰
  질문 10개:
    1. 현재 어떤 서비스/학원으로 공부하시나요?
    2. 월 평균 학습 비용은 얼마인가요?
    3. 가장 어려운 과목/영역은?
    4. 가장 불만족스러운 학습 방식은?
    5. 스마트폰 vs PC 학습 비율?
    6. 오프라인 학습 선호도는?
    7. AI 기반 학습 도구에 대한 의견은?
    8. 혼동 유형별 암기법이 있다면 유용할까?
    9. 월 19,900원 / 29,900원 / 39,900원 각각에 대한 반응?
    10. 합격 환급 이벤트가 있다면 결제 의향 변화?

□ 페르소나 3종 도출
  - 1차 신규 응시자 (20~30대)
  - 2차 재수생 (40~50대)
  - 합격 후 확장 (공인중개사 등)

완료 조건:
  - 5명 인터뷰 완료
  - 페르소나 3종 문서화
  - 구매 의향 데이터 수집
```

#### [B-3] 경쟁 분석 (1일)

```
□ 박문각/에듀플러스/해커스 샘플 강의 시청
□ SWOT 분석 작성
□ 우리 차별점 검증

산출: docs/research/COMPETITIVE_ANALYSIS.md
```

### 13.4 Week B — 법률 + 비즈니스

#### [L-1] IT 전문 변호사 자문 1회 (1일, 30만 원)

```
□ 변호사 사전 섭외 (법무법인 로앤컴퍼니, 테크앤로 등)

□ 자문 질의서 전달
  질문 8개:
    1. 상용 교재를 AI로 구조화/해설 생성 시 저작권 침해 성립 가능성?
    2. 2차 저작물 해당 여부?
    3. Q-Net 기출 문제 영리 서비스 활용 합법성?
    4. "합격 보장", "적중률 99%" 광고의 학원법/표시광고법 저촉?
    5. 개인정보보호법(PIPA) 필수 조치는?
    6. 이용약관/PIPA 동의/환불정책 필수 조항?
    7. AI 생성 콘텐츠의 저작권 귀속?
    8. 멀티시험 확장 시 각 시험마다 리스크 다른가?

□ 자문 결과 GO/NO-GO/PIVOT 판정
  GO: 저작권 문제 해결 가능 (라이선스 or 자체 제작)
  PIVOT: 교재 대체 전략 필요 (기획 30% 수정)
  NO-GO: 법적 리스크 과도

산출: docs/research/LEGAL_RISK_ASSESSMENT.md
```

#### [L-2] 출판사 라이선스 접촉 (2일)

```
□ 「농업재해보험 손해평가 이론과 실무」 출판사 확인
□ 라이선스 제안 서한 발송
  옵션 A: 연 라이선스 계약 (우리 수익의 10~15%)
  옵션 B: 일회성 라이선스 (협상)
  옵션 C: 공동 브랜딩

□ 답변 대기 (보통 1~2주, 비동기 진행)

산출: docs/research/LICENSE_NEGOTIATION.md
```

#### [B-4] 비즈니스 모델 확정 (2일)

```
□ 가격 민감도 최종 결정
  Single 19,900원 / Combo 29,900원 / All-Access 39,900원 확정

□ 무료/유료 경계 확정
□ 환불 정책 초안 (변호사 검토 반영)
□ 결제 수단: 토스페이먼츠 계약 신청
□ 손익분기 모델 스프레드시트 작성

산출:
  - docs/BUSINESS_MODEL.md
  - docs/FINANCIAL_MODEL.xlsx
```

#### [B-5] Go/Pivot/No-Go 판정 (1일)

Phase 0 착수 여부 최종 결정. 기준은 §20 참조.

### 13.5 Phase -1 산출물 체크리스트

```
□ docs/research/MARKET_DATA.md
□ docs/research/COMPETITOR_ANALYSIS.md
□ docs/research/COMMUNITY_INSIGHTS.md
□ docs/research/USER_INTERVIEWS.md (페르소나 3종 포함)
□ docs/research/LEGAL_RISK_ASSESSMENT.md
□ docs/research/LICENSE_NEGOTIATION.md
□ docs/BUSINESS_MODEL.md
□ docs/FINANCIAL_MODEL.xlsx
□ docs/GO_NOGO_DECISION.md  ★ 최종
```

---

## 14. Year 1 Phase 0~3

### 14.1 전체 타임라인 (16주)

```
Phase 0 (Week 1-4):  Foundation + PoC
Phase 1 (Week 5-10): Data Pipeline + Core Engine
Phase 2 (Week 11-14): Content + Service
Phase 3 (Week 15-16): Launch Ready + 베타
```

### 14.2 Phase 0: Foundation (Week 1-4)

**목표:** 인프라 + 멀티시험 구조 격리 + BATCH 1 PoC 성공

#### Week 1

```
[Mon-Tue] Step 0-1: 모노레포 초기화
  □ pnpm workspace + Turborepo 설정
  □ TypeScript strict + ESLint + Prettier
  □ .claude/rules/ 규칙 배치
  □ CLAUDE.md 작성 (Hard Rules 17개 + DEFCON + COVEN)
  □ Git 초기화 + 첫 커밋
  완료 조건: pnpm install 성공, pnpm turbo build 성공

[Wed-Thu] Step 0-2: DB 스키마 (L3 ⚠️)
  □ migrations/0001_initial_schema.sql 작성 (11개 테이블)
  □ Drizzle ORM 스키마 TS 작성 (packages/shared/src/db-schema.ts)
  □ wrangler d1 create thepick-db
  □ wrangler d1 migrations apply thepick-db
  □ Seed 데이터: exams 테이블에 'son-hae-pyeong-ga-sa' INSERT
  완료 조건: D1에 11개 테이블 존재, exams 1행

[Fri] Step 0-3: PWA 셸 + 시험 허브 뼈대
  □ Astro + React + Tailwind 프로젝트 생성 (apps/web)
  □ manifest.json + sw.js (기본 오프라인 캐싱)
  □ 시험 선택 허브 UI 프로토타입
  □ Cloudflare Pages 연결 + 첫 배포
  완료 조건: 로컬 + 프로덕션 URL 접근 가능
```

#### Week 2

```
[Mon-Tue] Step 0-4: ExamAdapter 인터페이스 (L2)
  □ packages/shared/src/exam-adapter.ts 작성 (§5.2 전체)
  □ 타입 테스트 (tsc --noEmit)
  □ 문서: docs/architecture/ADAPTER_CONTRACT.md
  완료 조건: 인터페이스 컴파일 성공

[Wed] Step 0-5: 손해평가사 Adapter 스켈레톤
  □ exams/son-hae-pyeong-ga-sa/ 디렉토리 생성
  □ adapter.ts, ontology.json, hierarchy.ts 빈 구조
  □ hierarchy: LV1 보장방식 8종 입력
  완료 조건: adapter.ts export 가능

[Thu-Fri] Step 0-6: M01 PDF 추출기 (PoC 시작)
  □ pdfplumber 설치, 한글 PDF 테스트 (교재 샘플 5쪽)
  □ 실패 시 PyMuPDF로 대체
  □ packages/parser/src/pdf-extractor.ts
  □ CLI: pnpm batch parse-pdf --exam son-hae-pyeong-ga-sa --input xxx.pdf
  완료 조건: 한글 추출 깨짐 0건
```

#### Week 3

```
[Mon-Tue] Step 0-7: M03 기출 파서 + QG-1 ⭐
  □ 2024년 1차 기출 25문항 파싱
  □ 정답 대조 100% 확인
  □ exam_questions 테이블에 INSERT
  완료 조건: 기출 정답률 100% ← QG-1 통과

[Wed] Step 0-8: M02 법령 수집기
  □ 법제처 API로 농어업재해보험법 수집
  □ 시행령, 고시 수집
  □ knowledge_nodes에 INSERT (type=LAW)

[Thu-Fri] Step 0-9: Ontology + Schema Validator (L3 ⚠️)
  □ exams/son-hae-pyeong-ga-sa/ontology.json 완성
  □ packages/parser/src/schema-validator.ts
  □ adapter.ontology 읽어서 ID 검증
  완료 조건: 잘못된 ID 입력 시 거부 + 로그
```

#### Week 4

```
[Mon] Step 0-10: M07 Claude API 배치 프로세서
  □ Haiku 배치 호출 래퍼
  □ 재시도 + 지수 백오프
  □ 토큰 비용 로깅

[Tue] Step 0-11: M09 Constants 추출기
  □ 교재에서 상수값 추출 (자기부담율, 보험요율 등)
  □ constants 테이블 INSERT
  □ 교재 예시값과 대조 (100% 일치)

[Wed-Thu] Step 0-12: M16 Formula Engine PoC (L3 ⚠️)
  □ engine/formula/AstParser.ts (math.js 래핑)
  □ 위험 함수 비활성화 (eval, parse, simplify 등)
  □ 2024년 BATCH 1 산식 15개 구현
  □ 교재 예시값 소수점 6자리까지 대조
  완료 조건: 15개 산식 정답률 100%

[Fri] Step 0-13: Vectorize 임베딩 모델 선정 (PoC-TECH-1)
  □ bge-m3 vs bge-small-en 비교 테스트
  □ 한국어 교재 50개 샘플로 유사도 측정
  □ 최종 모델 결정 → Vectorize 인덱스 생성 (dimension 확정)
  완료 조건: 모델 선정 완료, 인덱스 생성

[Weekend] BATCH 1 통합 실행 → QG-2 ⭐
  □ 교재 1챕터 전체 파이프라인 실행
  완료 조건:
    - 60+ 노드 생성
    - 200+ 엣지 생성
    - 산식 15개 100% 정답
    - Ontology 위반 0건
    ← QG-2 통과

[Phase 0 완료]
  □ docs/epics/EPIC-P0.md 작성
  □ .jjokjipge/state.json 업데이트
  □ 회고: 다음 Phase 리스크 식별
```

### 14.3 Phase 1: Data Pipeline + Core Engine (Week 5-10)

**목표:** 교재 전체 구조화 + Core Engine 5개 모듈 완성

#### Week 5-6: BATCH 2~5

```
[Week 5]
□ BATCH 2: 과수 16종 (사과, 배, 복숭아, ...)
□ BATCH 3: 논작물 (벼, 보리, ...)
□ M10 Revision 감지기 (2026년 개정사항 반영)
□ 상법 보험편 Graph 구축

[Week 6]
□ BATCH 4: 밭작물
□ BATCH 5: 시설원예 + 수입감소
□ M13 기출 정답 대조기 → QG-3 ⭐
  완료 조건: 825문항 Graph 매칭률 100%
```

#### Week 7-8: 농학 + 법령 보강

```
[Week 7]
□ 농어업재해보험법 + 시행령 + 고시 Graph
□ M04 Vision OCR (농학개론 스캔본)
□ M11 토픽 클러스터러 (기출 출제 빈도 맵핑)

[Week 8]
□ M05 웹 보강 (미커버 영역 검색)
□ M12 삼각 교차 검증기 → QG-4 ⭐
  완료 조건: 1차 3과목 삼각 검증 통과
```

#### Week 9-10: Core Engine 5개

```
[Week 9]
□ M15 Graph RAG 검색 엔진 (engine/content/)
  - Vectorize 쿼리 + Truth Weight 정렬 + Graceful Degradation
□ M16 Formula Engine 확장 → 125 산식 (L3 ⚠️)
□ M17 FSRS 엔진 (engine/learning/)
  - ts-fsrs 패키지 사용, Python 참조 100% 일치 검증 (PoC-TECH-5)

[Week 10]
□ M18 혼동 감지 엔진 (8종 패턴)
□ M19 암기법 매칭 엔진 → QG-5 ⭐
  완료 조건: 엔진 5개 통합 테스트 통과

[Phase 1 완료]
  □ docs/epics/EPIC-P1.md
```

### 14.4 Phase 2: Content + Service (Week 11-14)

#### Week 11-12: 콘텐츠 생성

```
□ M20 플래시카드 생성기 (Haiku 배치)
□ M21 OX/빈칸 생성기 (정답 100% 필수)
□ M22 기출 변형 생성기 (변형 후 100% 필수)
□ M23 암기법 생성기 (역방향 검증)
□ M24 산식 계산기 + 플로우차트 → QG-6 ⭐
  완료 조건: 생성 콘텐츠 정답률 100%
```

#### Week 13-14: 서비스 UI

```
[Week 13]
□ M25 기출 풀이 서비스 (/exams/son-hae-pyeong-ga-sa/study/exam)
□ M26 복습/약점 공략 (FSRS 기반)
□ M27 모의시험 + 대시보드

[Week 14]
□ M28 관리자 CMS 완성
□ API 통합 (Hono, exam-context 미들웨어)
□ 오프라인 동기화 엔진 → QG-7 ⭐
  완료 조건: 통합 테스트 8건 통과

[Phase 2 완료]
  □ docs/epics/EPIC-P2.md
```

### 14.5 Phase 3: Launch Ready (Week 15-16)

#### Week 15: 최종 검증

```
□ 825문항 E2E 검증 (정답 100%)
□ Formula Engine 전수 검증 (125개)
□ 성능 최적화 (P95 < 3초, Lighthouse 90+)
□ 보안 점검 (THREAT_MODEL.md 7개 위협 대응)
□ 접근성 (WCAG AA)
□ 이용약관, PIPA, 환불정책 최종화
```

#### Week 16: 베타 + 런칭

```
□ 수험생 베타 모집 (10명, Phase -1 인터뷰 대상 우선)
□ 3일간 베타 테스트
□ 피드백 반영 (critical 버그만)
□ 런칭 체크리스트 → QG-8 ⭐
  완료 조건: 오답 신고 0건, P95 < 3초, 보안 점검 완료

[Phase 3 완료 = Year 1 완료]
  □ docs/epics/EPIC-P3.md
  □ 정식 런칭
```

---

## 15. Year 2 Phase 4~6

### 15.1 Phase 4: 엔진/어댑터 리팩토링 (8주)

**목표:** 손해평가사 특화 코드를 Universal Engine + Adapter로 본격 분리.

```
Week 1-2: 리팩토링 계획
  □ 손해평가사 코드 전수 검토
  □ "범용" vs "시험 특화" 분류
  □ 리팩토링 PR 계획 작성 (10~15개 PR)

Week 3-5: Universal Engine 추출
  □ engine/content/, engine/formula/, engine/learning/ 구조 실질화
  □ 손해평가사 특화 로직을 exams/{id}/로 이동
  □ 회귀 테스트: 리팩토링 전후 동작 100% 동일

Week 6-7: ExamAdapter 완성
  □ 손해평가사 Adapter 완전 구현
  □ 공인중개사 Adapter 스켈레톤
  □ docs/architecture/ADAPTER_CONTRACT.md 완성

Week 8: QG-M1 ⭐
  □ 손해평가사 100% 회귀 테스트
  □ 성능 저하 0%
```

### 15.2 Phase 5: 공인중개사 Adapter (12주)

```
Week 1-3: 콘텐츠 수집
  □ 교재 라이선스 확보 (또는 자체 제작)
  □ 35회차 기출 수집
  □ 민법/공법/세법/부동산학 법령

Week 4-6: 파싱 + 구조화
  □ exams/gong-in-jung-gae-sa/parsers/
  □ 판례 DB 스키마 설계 (공인중개사 특수)
  □ BATCH 파이프라인 실행

Week 7-9: Graph RAG
  □ 공인중개사 Ontology
  □ 판례 + 조문 Graph
  □ 민법 ↔ 공법 상호 참조

Week 10-11: UI 특화
  □ components/exams/gong-in-jung-gae-sa/
  □ 판례 뷰어, 법률 타임라인

Week 12: 통합 → QG-M2 ⭐
  □ Combo 플랜 활성화
  □ 베타 100명
```

### 15.3 Phase 6: 검증 + 학습 (4주)

```
Week 1-2: 공인중개사 베타 피드백
Week 3: Adapter 패턴 효용성 평가
Week 4: Year 3 (전기기사) 사전 리서치
```

**Year 2 종료 시:** Year 1 대비 Adapter 작성 시간 50% 이내 달성 목표.

---

## 16. Year 3+ 지속 확장

### 16.1 새 시험 추가 표준 프로세스 (6~8주)

```
[1주차] 시장 조사 (Phase -1 축소판)
  □ 응시자 수, 합격률
  □ 경쟁 서비스
  □ 수험생 인터뷰 3명
  → GO/NO-GO

[2주차] 저작권 + 법률
  □ 교재 확인
  □ 변호사 자문 (필요 시)

[3-4주차] Adapter 설계
  □ exams/_template/ 복사
  □ hierarchy.ts, ontology.json, adapter.ts

[5-7주차] 콘텐츠 구축
  □ 교재 파싱
  □ 기출 파싱
  □ Graph 구축 + 인간 검수

[8주차] UI + 베타
```

### 16.2 이식 가능성 상시 점검 (Year 1~2 동안)

```
매주 회고 시 체크:
  □ 이 로직이 engine/? adapter? 올바른 위치?
  □ DB 컬럼에 exam_id 포함?
  □ API가 :exam 파라미터 받음?
  □ UI가 시험별 데이터 받아 동작?
  □ 손해평가사 용어가 engine/에 없음?
```

---

---

# Part V — 품질과 리스크

---

## 17. 품질 게이트

### 17.1 Year 1 품질 게이트 8개

| 게이트 | Phase | Week | 통과 조건                              |
| ------ | ----- | ---- | -------------------------------------- |
| QG-1   | P0    | W3   | 기출 정답 100%                         |
| QG-2   | P0    | W4   | BATCH 1 산식 100%, 60+ 노드, 200+ 엣지 |
| QG-3   | P1    | W6   | 기출↔Graph 100%                        |
| QG-4   | P1    | W8   | 1차 3과목 삼각 검증                    |
| QG-5   | P1    | W10  | 엔진 5개 모듈 통합 통과                |
| QG-6   | P2    | W12  | 생성 콘텐츠 정답 100%                  |
| QG-7   | P2    | W14  | 통합 테스트 8건 통과                   |
| QG-8   | P3    | W16  | 오답 신고 0건, P95 < 3초               |

### 17.2 Year 2 멀티시험 품질 게이트 3개

| 게이트 | Phase  | 통과 조건                                   |
| ------ | ------ | ------------------------------------------- |
| QG-M1  | P4 W8  | 리팩토링 후 손해평가사 100% 동일 동작       |
| QG-M2  | P5 W12 | 공인중개사 Adapter가 engine/ 수정 없이 동작 |
| QG-M3  | P5+    | 시험 간 데이터 격리 0건 오염                |

### 17.3 게이트 실패 시

```
1. 작업 즉시 중단
2. 실패 원인 .jjokjipge/blockers.md 기록
3. 인간 검토 후 수정 계획 (DEFCON L3 수준 논의)
4. 수정 완료 후 게이트 재시도
5. 다음 Phase 진입 금지
```

---

## 18. 100% 필수 테스트

### 18.1 시험별 독립 테스트 (Hard Rule 17)

```
exams/son-hae-pyeong-ga-sa/tests/
├── parser-accuracy.test.ts        [100% 필수] 기출 정답률
├── constants-precision.test.ts    [100% 필수] 수치/날짜 정확성
├── graph-integrity.test.ts        [100% 필수] Graph ↔ 기출 매칭
├── formula-accuracy.test.ts       [100% 필수] 125 산식 정확성
├── fsrs-compatibility.test.ts     [100% 필수] Python 참조 일치
├── ox-correctness.test.ts         [100% 필수] OX 정답률
└── variation-correctness.test.ts  [100% 필수] 변형 후 정답률
```

### 18.2 99% 허용 테스트 + 신고 시스템

```
M23 암기법 (역방향 검증) → 99% + 신고
M18 혼동 감지 → 95% + 사용자 피드백
M26 약점 분석 → 경향성, 정답 개념 없음
```

### 18.3 신고 → 수정 프로세스

```
1. 사용자 "신고" 버튼 클릭
2. GitHub Issue 자동 생성 (exam_id, 문항 ID 포함)
3. 24시간 내 검토 (진산)
4. 수정 PR → 배포 (즉시 반영)
5. 신고한 사용자에게 알림
```

---

## 19. 리스크 레지스터

### 19.1 Year 1 주요 리스크

| ID  | 리스크                | 확률 | 영향        | 감지 지표                     | 대응 절차                           |
| --- | --------------------- | ---- | ----------- | ----------------------------- | ----------------------------------- |
| R1  | Ontology 오염         | 중   | 높          | Schema Validator 거부율 > 10% | 재프롬프트, 패턴 보강               |
| R2  | 산식 부동소수점 오차  | 높   | 높          | 교재 예시값 불일치 1건 이상   | math.js BigNumber 도입              |
| R3  | **교재 저작권**       | 중   | **매우 높** | 출판사 연락                   | **Phase -1 변호사 자문 + 라이선스** |
| R4  | 농학 커버리지 부족    | 높   | 중          | 토픽 클러스터 미커버 > 20%    | 역공학 + is_covered=false           |
| R5  | Workers CPU 초과      | 중   | 낮          | 500ms 에러 발생               | Paid plan, 쿼리 최적화              |
| R6  | IndexedDB 동기화 충돌 | 낮   | 낮          | 사용자 신고                   | LWW + 타임스탬프                    |
| R7  | iOS PWA 제한          | 중   | 낮          | iOS 사용자 이탈               | 이메일 알림 폴백                    |
| R8  | **조기 추상화**       | 중   | 높          | engine/ 내 if (examId) 발견   | Hard Rule 15 엄격 집행              |
| R9  | 한국어 임베딩 품질    | 높   | 매우 높     | Phase 0 PoC 유사도 < 0.7      | bge-m3 → text-embedding-3 교체      |
| R10 | 베타 사용자 저조      | 높   | 중          | Week 16 베타 5명 미만         | 네이버 카페 집중 모집               |

### 19.2 Year 2+ 멀티시험 리스크

| ID  | 리스크                        | 확률    | 영향    | 대응                            |
| --- | ----------------------------- | ------- | ------- | ------------------------------- |
| MR1 | Engine 수정이 손해평가사 회귀 | 중      | 높      | 시험별 CI 병렬 실행             |
| MR2 | 시험 간 데이터 오염           | 낮      | 매우 높 | exam_id 전수 검증, Hard Rule 16 |
| MR3 | 공인중개사 경쟁 (박문각 등)   | 매우 높 | 높      | 차별화 (암기법, 판례 Graph)     |
| MR4 | 새 시험 콘텐츠 구축 지연      | 높      | 중      | 템플릿화 + 자동화 확대          |
| MR5 | Adapter 인터페이스 불완전     | 중      | 중      | Phase 4에서 재설계              |

### 19.3 리스크 모니터링

```
매주 금요일: 리스크 레지스터 업데이트
  - 새 리스크 추가
  - 기존 리스크 확률/영향 재평가
  - 대응 진행 상황 기록
산출: .jjokjipge/risk-log.md
```

---

---

# Part VI — 정량 판정

---

## 20. Go/No-Go 판정 기준

### 20.1 Phase -1 종료 시점 (Phase 0 착수 여부)

```
✅ GO 조건 (모두 충족 시)
  □ 손해평가사 시장 규모 연간 응시자 5,000명 이상 확인
  □ 수험생 5명 중 3명 이상 "월 19,900원 이상 낼 의향" 응답
  □ 경쟁 서비스 대비 명확한 차별점 3개 이상
  □ 교재 저작권 이슈 해결 경로 확보
    (라이선스 or 자체 제작 or 법적 허용 인용)
  □ 비즈니스 모델 확정 + 손익 모델 검증

⚠️ PIVOT 조건 (1~2개 미충족)
  □ 타겟 재조정 or 기능 축소 or 교재 대체
  → 기획서 일부 수정 후 재판정

❌ NO-GO 조건 (3개 이상 미충족 or 저작권 해결 불가)
  □ 프로젝트 중단 or 다른 시험으로 전환
```

### 20.2 QG-2 (Phase 0 Week 4) 실패 시

```
BATCH 1 통합 실행 실패 조건:
  - 산식 정확도 < 100%
  - 노드 생성 60개 미만
  - Ontology 위반 발생

→ Phase 0 연장 (최대 2주)
→ 재시도 실패 시 기술 스택 재검토
→ 여전히 실패 시 프로젝트 재평가
```

### 20.3 QG-8 (Phase 3 Week 16) 실패 시

```
런칭 체크리스트 실패:
  - 오답 신고 1건 이상 → 수정 후 재테스트
  - P95 > 3초 → 성능 최적화
  - 보안 점검 미통과 → 수정 후 재점검

→ Phase 3 연장 (최대 2주)
→ 여전히 실패 시 MVP 기능 축소 + 재런칭 계획
```

### 20.4 Year 1 종료 시점 (Year 2 진입)

```
✅ Year 2 진입 조건
  □ Year 1 베타 100명 이상 확보
  □ 유료 전환 30명 이상
  □ 월 매출 50만 원 이상
  □ 오답 신고 주 2건 이하
  □ 기술 부채 측정 (refactoring 소요 시간 < 8주 추정)

⚠️ PIVOT 조건
  □ 사용자 확보 실패 → 마케팅 전략 수정 후 3개월 추가

❌ EXIT 조건
  □ 6개월 이상 유료 사용자 < 10명
  □ 기술 부채로 Year 2 리팩토링 불가능
```

---

## 21. 변경 이력

### 21.1 v2.0 → v3.0 FINAL 핵심 변경

| 영역                   | v2.0                   | v3.0 FINAL                     |
| ---------------------- | ---------------------- | ------------------------------ |
| **정체성**             | 손해평가사 단일 서비스 | 멀티시험 SaaS 플랫폼           |
| **시장 규모**          | 1만 명                 | 6개 시험 28.5만 명             |
| **아키텍처**           | 단일 도메인 Hexagonal  | Universal Engine + Adapter     |
| **4-Level 메타데이터** | 손해평가사 특화        | 범용 (Adapter가 의미 정의)     |
| **Hard Rules**         | 14개                   | **17개**                       |
| **DB 스키마**          | 9개 테이블             | **11개 테이블 + exam_id 전면** |
| **디렉토리**           | `modules/`             | `engine/` + `exams/{id}/`      |
| **Phase 구성**         | 16주 단일              | Year 1 (16주) + Year 2~3 확장  |
| **비즈니스 모델**      | 단일 시험 구독         | Single/Combo/All-Access        |
| **Phase -1**           | 없음                   | **2주 사업 타당성 검증**       |
| **수익 목표**          | 2.4억 상한             | Year 2 3억, Year 3 12~15억     |

### 21.2 v3.0 → v3.0 FINAL 개선 사항

```
🆕 Part별 재구성 (6 Part, 21 섹션)
🆕 주차별 실행 체크리스트 (Week 1~16 전체)
🆕 ExamAdapter 완전 TypeScript 코드
🆕 Phase -1 구체적 실행 계획 (비용, 기간, 산출물)
🆕 각 리스크별 감지 지표 + 대응 절차
🆕 Go/No-Go 정량 기준 (4개 시점)
🆕 DEV COVEN Phase별 주도 페르소나
🆕 DEFCON L3 영역 명시화
```

### 21.3 유지된 핵심 자산

```
✅ Graph RAG 3계층 아키텍처
✅ 방어 장치 4종 (Truth Weight, Temporal Graph, Graceful Degradation, Constants 직접 조회)
✅ FSRS-5 + 클라이언트 로컬 실행
✅ PWA + IndexedDB + Service Worker
✅ Cloudflare 기술 스택
✅ Drizzle ORM
✅ math.js AST 파서
✅ 혼동 유형 8종 × 암기법 매칭 매트릭스
✅ TDD Micro-Task 분해 패턴
✅ 8개 품질 게이트
✅ 100% 필수 테스트 7개
✅ DEV COVEN 페르소나 체계
✅ Epic 문서화 프로세스
```

---

## 맺음말

**v3.0 FINAL의 본질**

이 문서는 두 가지 긴장을 해결한다:

```
긴장 1: "단일 시험 완성" vs "멀티시험 플랫폼"
  해결: Pilot First, Platform Second
       Year 1은 손해평가사에만 집중하되,
       Adapter 구조는 미리 격리해서 Year 2 리팩토링 비용 최소화

긴장 2: "완벽한 사전 설계" vs "조기 추상화 함정"
  해결: Extract After Two
       2번째 시험(공인중개사)을 실제 작성하며
       범용 엔진 추출 (Year 2 Phase 4)

긴장 3: "기술 우수성" vs "사업 검증"
  해결: Phase -1 (2주, 40만 원)
       16주 개발 착수 전 시장/법률/수익 검증
       투자 대비 기대값 100배
```

**Year 1의 진짜 목표**

"손해평가사로 수익을 내는 것"이 아니라
**"Universal Engine이 가장 복잡한 시험을 다룰 수 있는지 검증"하는 것**.

이 검증이 성공하면, Year 2에 공인중개사 15만 명 시장으로 들어가고,
Year 3에 전기기사/소방기사/주택관리사로 확장한다.

**이것이 진산님이 "1만 명 시장이지만 R&D로 삼는다"고 말한 순간,
이 프로젝트가 장난감에서 사업으로 전환된 지점이다.**

---

> "가장 어려운 시험을 풀면, 쉬운 시험은 저절로 풀린다.
> 가장 복잡한 엔진을 만들면, 단순한 엔진은 부분 집합이다.
> Hardest-First는 기술의 지름길이자, 사업의 안전장치다."

— **DEV COVEN Implementation Master v3.0 FINAL**
— 2026-04-17

_다음 단계: Phase -1 착수 여부 결정 → 승인 시 Week A 실행 체크리스트에 따라 시작_
