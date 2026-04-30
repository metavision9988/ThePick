# Universal Knowledge Engine — 비전 설계

> **답변 대상:** 진산님 비전: "여러 국가 자격증 + 다양한 도메인 (시험/학습/암기/코딩) 까지 가능한 엔진"
>
> **핵심 진단:** 현 엔진 = 자격증 도메인 단일 엔진. 진산님 비전 실현을 위해서는 **2개 코어 모듈 추가** + **3-Layer 아키텍처 재정의** 필요.
>
> **모드:** 메피스토펠레스 + 작업 파트너 — 비전을 받되, 함정도 보여드림
>
> **상위:** [중간 보고서 감사](./MIDPOINT_AUDIT_20260428.md)

---

## 0. ORACLE 의 사전 인정

> **"진산님 비전을 받았습니다.**
>
> **'손해평가사 → 다양한 자격증 → 시험/학습/암기/코딩 등'**
>
> 이는 ContentBuildEngine v2.1 의 capability 를 **15~20 배** 확장하는 의미.
>
> 현 엔진의 abstraction level 은 '시험 도메인' 에 묶여 있음.
>
> 비전 실현을 위해서는 abstraction level 자체 변경 필요. 본 문서가 그 청사진."

---

## 1. 비전 해석 (의도 추출)

진산님 발언의 4가지 차원 추출:

### 차원 1: Vertical (자격증 확장)

손해평가사 → 공인중개사 → 변호사 → 의사고시 → 회계사 → 변리사 → ...

→ ContentBuildEngine v2.1 의 멀티시험 plan 으로 일부 대응

### 차원 2: Horizontal (시험 외 도메인)

- 학교 교과 (초/중/고/대학)
- 코딩 학습 (LeetCode, 알고리즘, 디자인 패턴)
- 어학 (TOEFL, TOEIC, OPIc)
- 일반 암기 (역사, 지리, 인물)
- 의료 케이스 학습
- 법률 판례 학습
- 일반 교양 (책 학습, 강의 학습)

→ **현 엔진으로 직접 처리 불가**

### 차원 3: Depth (서비스 형태)

- 단순 적재 (현)
- 학습자 UX (Phase 2)
- 자동 콘텐츠 생성 (플래시카드, 모의시험)
- AI 튜터 (대화형 학습)
- B2B SaaS (기업 교육)

→ Service layer 영역, 엔진과 분리 필요

### 차원 4: Reach (사용자 확장)

- 진산님 단독 (현)
- 손해평가사 응시자 (~10K)
- 모든 자격증 응시자 (~수십만)
- 학생/직장인 (~수백만)
- B2B 고객 (~수만 기업)

→ 시스템 scalability 영역

---

## 2. 도메인 다양성 매트릭스

각 도메인의 특성 + 엔진 적용 가능성 분석:

| 도메인                  | 입력                   | 정답 명확성               | 출처                | 검증 방식               | 엔진 적용                     |
| ----------------------- | ---------------------- | ------------------------- | ------------------- | ----------------------- | ----------------------------- |
| **자격증 시험**         | 교재 + 기출 + 법령     | 매우 명확                 | page_ref            | 기출 자동 풀이          | ✅ **현 엔진 즉시**           |
| **학교 교과**           | 교과서 + 문제집        | 매우 명확                 | page_ref + 학년     | 학년별 문제 풀이        | ✅ 즉시 (학년 메타 추가)      |
| **법률 판례**           | 법령 + 판례 + 해석     | 명확 (조항) + 모호 (해석) | 법조문 + 판례 번호  | 판례 비교 추론          | ✅ 즉시 (현 엔진과 유사)      |
| **일반 암기**           | 자유 자료 (역사 등)    | 사실 명확                 | 책/논문/페이지      | 사실 일치율             | ✅ 즉시 (시간/공간 차원 강화) |
| **어학 학습**           | 교재 + 음성 + 영상     | 명확 (어휘) + 모호 (작문) | 교재 + 사전         | 원어민 검토 + 자동 평가 | 🟡 **부분** (음성/영상 처리)  |
| **코딩 학습**           | 코드 저장소 + 알고리즘 | 명확 (테스트 통과)        | GitHub URL + commit | **코드 실행 결과 비교** | 🟡 **부분** (실행 환경)       |
| **B2B 기업 교육**       | 회사 매뉴얼 + 정책     | 명확                      | 문서 + 버전         | 컴플라이언스 위반 시뮬  | ✅ 가능 (권한 + 다국적 강화)  |
| **의료 케이스**         | 임상 가이드 + 케이스   | 모호 (확률적)             | 논문 DOI + 가이드   | 임상의 검증             | 🔴 **변형 큼** (확률적 추론)  |
| **일반 교양 (책/강의)** | 책 + 강의 영상         | 매우 모호                 | 페이지 + 시점       | 학습자 자가 평가        | 🔴 **변형 큼** (정답 모호)    |

### 관찰

- **현 엔진이 즉시 적용 가능**: 자격증, 학교 교과, 법률 판례, 일반 암기 (전체 9개 중 4개)
- **부분 변형 필요**: 어학 (음성/영상), 코딩 (실행 환경) (2개)
- **본격 변형 필요**: B2B (권한), 의료 (확률), 교양 (모호) (3개)

### 권고 확장 순서 (Year 2~5)

```
Year 2 (단계 1): 자격증 도메인 본격 멀티
  ├─ 손해평가사 (현)
  ├─ 공인중개사 (Year 2 첫 추가)
  └─ 변호사 / 의사고시 (Year 2 후반)

Year 3 (단계 2): 자격증 + 인접 도메인
  ├─ 학교 교과 (학년 메타 추가)
  └─ 법률 판례 (현 엔진 그대로)

Year 4 (단계 3): 부분 변형 도메인
  ├─ 코딩 학습 (코드 실행 환경 + AST 평가)
  └─ 어학 학습 (음성/영상 plugin)

Year 5+ (단계 4): 본격 변형 도메인
  ├─ B2B 기업 교육 (권한 + 멀티 테넌트)
  ├─ 의료 케이스 (확률적 추론)
  └─ 일반 교양 (정답 모호 처리)
```

---

## 3. Universal Knowledge Engine 의 3-Layer 아키텍처

진산님 비전을 시스템에 새기려면 **3-Layer 분리** 필수:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│ Layer 3: Service Adapters (도메인별 서비스 형태)                  │
│                                                                  │
│  ├─ 쪽집게 (자격증 학습 앱) — 현재                                │
│  ├─ 학교 교과 학습 앱                                             │
│  ├─ 코딩 인터뷰 학습 앱                                           │
│  ├─ 어학 학습 앱                                                  │
│  ├─ 기업 교육 LMS (B2B)                                           │
│  └─ ...                                                           │
│                                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ uses (HTTP/RPC)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│ Layer 2: Domain Adapters (도메인별 plugin)                        │
│                                                                  │
│  packages/domains/                                                │
│   ├─ son-hae-pyeong-ga-sa (현)                                   │
│   ├─ gong-in-jung-gae-sa (Year 2)                                │
│   ├─ school-math-grade-3                                         │
│   ├─ coding-interview-leetcode                                   │
│   ├─ english-toefl                                               │
│   ├─ legal-precedent-civil                                       │
│   ├─ corporate-compliance-{company-id}                           │
│   └─ ...                                                          │
│                                                                  │
│  각 도메인 plugin = ontology-extension + computational +          │
│                     source-citation + validation hook            │
│                                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │ uses (TypeScript interface)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│ Layer 1: Universal Knowledge Engine Core (변경 0)                 │
│                                                                  │
│  packages/uke-core/                                               │
│   ├─ ontology/             (Ontology Lock + Adaptive Threshold)  │
│   ├─ validation/           (4단계 검증 framework)                 │
│   ├─ version-management/   (Temporal Graph + Materialized View)  │
│   ├─ loader/               (state-machine + audit log)            │
│   ├─ cbiv/                 (Cross-Batch 회귀)                     │
│   ├─ source-citation/      (★ 추상화: page_ref / URL / DOI 등)    │
│   ├─ computational/        (★ 추상화: math.js / AST / 확률 등)    │
│   └─ search-pipeline/      (Hybrid Search + Multi-Path Fallback) │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 핵심 차이 (현 vs 비전)

| 측면            | 현 ContentBuildEngine v2.1         | UKE (Universal Knowledge Engine)                   |
| --------------- | ---------------------------------- | -------------------------------------------------- |
| Naming          | "Content Build" (시험 콘텐츠 적재) | "Universal Knowledge" (지식 일반)                  |
| Computational   | math.js (산식만)                   | **plugin: math.js / AST / Bayesian**               |
| Source Citation | page_ref (책만)                    | **plugin: page_ref / URL / DOI / commit hash**     |
| Validation      | "기출 자동 풀이"                   | **plugin: 도메인별 검증 hook**                     |
| Year 2 가정     | 멀티시험 단일 시나리오             | 4 시나리오 분기 (자격증 / 도메인 / B2B / 멀티언어) |

---

## 4. 신규 코어 모듈 2개 (현 5 → 7)

### 4.1 Domain Adapter Interface (신규 6번째 모듈)

**책임:** 도메인 plugin 의 표준 인터페이스 정의

```typescript
// packages/uke-core/src/domain-adapter/interface.ts

export interface DomainAdapter {
  // 도메인 식별
  readonly domainId: string; // 'son-hae-pyeong-ga-sa', 'leetcode-py', ...
  readonly domainType: DomainType; // 'exam', 'school', 'coding', 'language', ...
  readonly version: string; // semver

  // 도메인별 ontology 확장
  readonly ontology: {
    nodeTypes: NodeTypeDefinition[];
    edgeRelations: EdgeRelation[];
    deduplicationThresholds: Record<string, number>;
  };

  // 도메인별 computational engine
  readonly computational: ComputationalEngine;

  // 도메인별 source citation
  readonly sourceCitation: SourceCitation;

  // 도메인별 validation hook
  readonly validationHooks: {
    level3LearningEffect: (batchData) => Promise<ValidationResult>;
    sampleQuestions: () => Question[];
  };

  // 도메인별 BATCH 적재 metadata
  readonly batchMetadata: {
    expectedBatchCount: number;
    totalScope: string;
    primaryLanguage: string;
  };
}

export type DomainType =
  | 'exam' // 자격증 / 학교 시험
  | 'school-curriculum' // 학교 교과
  | 'coding-practice' // 코딩 학습
  | 'language-learning' // 어학
  | 'memorization' // 일반 암기
  | 'legal-precedent' // 법률 판례
  | 'corporate-training' // 기업 교육
  | 'medical-cases' // 의료 케이스
  | 'general-education'; // 일반 교양
```

### 4.2 Computational Plugin (신규 7번째 모듈)

**책임:** 도메인별 계산/평가 추상화

```typescript
// packages/uke-core/src/computational/interface.ts

export interface ComputationalEngine {
  readonly type: ComputationalType;

  // 표현식 검증 (도메인별 정의)
  validate(expression: string): ValidationResult;

  // 표현식 평가
  evaluate(expression: string, inputs: Record<string, any>): EvaluationResult;

  // 표현식 정규화 (canonical form)
  canonicalize(expression: string): string;

  // 두 표현식 동등성 비교
  equals(a: string, b: string): boolean;
}

export type ComputationalType =
  | 'mathematical' // math.js (현 산식)
  | 'code-execution' // 코드 실행 환경 (Python, JS, ...)
  | 'ast-comparison' // AST 비교 (코딩 학습)
  | 'probabilistic' // Bayesian (의료)
  | 'logical' // 논리 연산 (법률 추론)
  | 'language-model'; // LLM 평가 (작문, 어학)

// 구현 예시
export class MathjsComputationalEngine implements ComputationalEngine {
  type = 'mathematical' as const;
  // 현 formula-engine 그대로
}

export class CodeExecutionEngine implements ComputationalEngine {
  type = 'code-execution' as const;
  // Docker/WASM 기반 격리 실행 (Year 4 추가)
}

export class AstComparisonEngine implements ComputationalEngine {
  type = 'ast-comparison' as const;
  // tree-sitter 기반 (Year 4 추가)
}
```

### 4.3 Source Citation Plugin (확장)

**현재:** `page_ref` 단일 필드

**변경:** plugin 패턴

```typescript
// packages/uke-core/src/source-citation/interface.ts

export interface SourceCitation {
  readonly type: SourceCitationType;

  // 출처 검증
  validate(citation: any): ValidationResult;

  // 출처 → 학습자 UI 표시
  renderForLearner(citation: any): SourceCitationView;

  // 출처 → 외부 link (가능한 경우)
  resolveUrl(citation: any): string | null;
}

export type SourceCitationType =
  | 'page-reference'        // page_ref (책)
  | 'url'                   // URL (웹 자료)
  | 'doi'                   // DOI (논문)
  | 'commit-hash'           // GitHub commit (코드)
  | 'video-timestamp'       // 영상 시점 (강의)
  | 'audio-timestamp'       // 음성 시점 (어학)
  | 'composite';            // 복합 (e.g. URL + page)

// 도메인별 구현
class PageReferenceCitation { type = 'page-reference'; ... }
class UrlCitation { type = 'url'; ... }
class CommitHashCitation { type = 'commit-hash'; ... }
```

---

## 5. 손해평가사 → UKE 전환 plan

### Phase A: BATCH-1 dry-run 통과까지 (현)

- 변경 0
- 현 ContentBuildEngine v2.1 그대로

### Phase B: BATCH-1 통과 직후 (1주, P1)

- 본 비전 ADR 작성 (ADR-030: Universal Knowledge Engine Vision)
- 8 페르소나 review
- 진산님 승인

### Phase C: BATCH-3 적재 시점 (Year 1 중반)

- `packages/uke-core/` 디렉토리 신설
- 현 코드의 점진적 이전 (변경 0, 단순 디렉토리 이동)
- 신규 코드는 uke-core 에 작성

### Phase D: Year 2 진입 시

- DomainAdapter Interface 본격 구현
- 손해평가사 = 첫 instance: `packages/domains/son-hae-pyeong-ga-sa/`
- 두 번째 도메인 plugin 추가 (공인중개사 또는 PoC 도메인)

### Phase E: Year 3+ (확장)

- 인접 도메인 (학교 교과, 법률 판례) 추가
- Year 4: 부분 변형 도메인 (코딩, 어학) PoC
- Year 5+: 본격 변형 도메인 (B2B, 의료, 교양)

---

## 6. 실현 가능성 평가 (메피스토 모드 — 함정 명시)

### 🟢 강점

1. **현 엔진의 universal 친화성**: 코어 모듈 5개 중 4개 (Ontology / Validation / Version / CBIV) 가 이미 도메인 무관
2. **Year 1 한시 예외 (Hard Rule 15)** 가 Year 2 분리 가정 — 진산님 메모리에 정합
3. **검수 UI**: 큐 1/2/3 패턴이 도메인 무관 (Merge / Reject / Keep Both 는 universal)
4. **Hybrid Search**: 도메인 무관 (`exam_id` 필터만 변경하면 universal)

### 🔴 함정 (반드시 인지)

#### 함정 1: Year 1 의 시험 도메인 가정이 깊다

- 현 코드 `packages/parser/src/ontology-registry.ts` 의 NodeType: INSURANCE / CROP / INV
- production-quality.md Hard Rule 15: "신규 코드는 예외 대상에 포함 금지"
- → BATCH-1 적재 직전까지 추가되는 코드도 시험 가정 흡수
- **해결:** Phase B (1주, P1) 에서 즉시 정리

#### 함정 2: math.js 의 closeness

- `formula-engine` 이 math.js 에 직접 import + AST 노출
- 코딩 학습 같은 도메인은 다른 computational engine 필요
- **해결:** ComputationalEngine interface 추가 + math.js 는 instance 1개

#### 함정 3: BATCH 의 의미 변형

- 현재 BATCH = 교재 페이지 그룹 (1~14)
- 코딩 학습 BATCH = ? (알고리즘 카테고리? 난이도? GitHub 저장소?)
- → BATCH 의 정의가 도메인별 다름
- **해결:** BatchMetadata interface (DomainAdapter 의 일부)

#### 함정 4: 검증 비용 폭증

- CBIV Stage 5 (회귀 Golden) 의 비용
- 현재: 손해평가사 14 BATCH × ~1000 Golden = ~30초/회귀
- 비전: 100 도메인 × 100 BATCH × ~10000 Golden = **수일/회귀**
- **해결:** 도메인별 격리 + 회귀 범위 sharding

#### 함정 5: 검수자 SPOF 의 본질적 한계

- 진산님 1인 = 손해평가사만 검수 가능
- 다른 도메인 (의료, 어학) = 도메인 전문가 필요
- 검수자 매핑: 도메인 → 자격 있는 검수자
- **해결:** 도메인 전문가 네트워크 구축 (Year 3+)

#### 함정 6: Cost Meter 의 도메인 격리

- 현재: 단일 cost-meter (전체 적재 비용)
- 비전: 도메인별 cost-meter (자격증별/회사별 격리)
- **해결:** Cost Meter scope 추가 (`scope: 'global' | 'domain' | 'tenant'`)

#### 함정 7: ROI 검증 부재

- 진산님 비전 = 100 도메인 + B2B 매출
- 그러나 현 ROI 측정 부재
- 손해평가사 응시자 ~10K, 시장 ~100억 (추정)
- 100 도메인 × 평균 매출 = 누적 효율?
- **해결:** Phase B 에서 economist 페르소나 추가 + ROI 산정

### 🟡 트레이드오프

| 결정                     | 비전 우선                   | 현실 우선                   |
| ------------------------ | --------------------------- | --------------------------- |
| **언제 universal 진입?** | Year 2 즉시                 | Year 3 (안정 후)            |
| **Year 2 첫 새 도메인?** | 코딩 학습 (다양성)          | 공인중개사 (현 엔진 그대로) |
| **B2B 진입?**            | Year 3 (현금 흐름)          | Year 5 (안정 후)            |
| **검수자 확보?**         | Year 1 후반 (네트워크 구축) | Year 3 (도메인 진입 시)     |

---

## 7. 측정 가능 KPI (Universal Engine 진척도)

진산님 비전의 진척을 측정 가능하게:

| KPI                        | 정의                                  | 단계별 목표                                          |
| -------------------------- | ------------------------------------- | ---------------------------------------------------- |
| **Domain count**           | 적재된 도메인 수                      | Year 1 = 1, Year 2 = 2~3, Year 3 = 5~7, Year 5 = 20+ |
| **Coverage breadth**       | DomainType 다양성                     | Year 1 = 1, Year 3 = 3, Year 5 = 6~9                 |
| **Core change LOC**        | 새 도메인 추가 시 코어 변경 LOC       | Year 2 = 0, Year 3 = 0, Year 5 = 0                   |
| **Plugin reuse rate**      | 도메인 plugin 의 코어 사용 비율       | 90%+ (90% 코어 + 10% plugin)                         |
| **CBIV cross-domain**      | 도메인 간 CBIV 회귀 통과율            | 100%                                                 |
| **Knowledge transfer**     | 도메인 A → B 의 학습 패턴 전이 성공률 | Year 4+ 측정 가능                                    |
| **Service template count** | Layer 3 (Service) 의 template 수      | Year 1 = 1 (쪽집게), Year 5 = 5+                     |

---

## 8. 권고 행동 (시점별)

### 즉시 (BATCH-1 dry-run 진입 전)

- ❌ **본 비전 ADR 작성 금지** — BATCH-1 적재 검증이 우선
- ✅ 5-페르소나 통합 보고서 §3.2 권고 진행 (D-C1 → CRITICAL → Step 5 → ROADMAP → Step 11.6 → Step 2~4)

### BATCH-1 dry-run 통과 직후 (1주)

- ✅ **ADR-030 작성: Universal Knowledge Engine Vision** (본 문서 기반)
- ✅ 8 페르소나 review (product-strategist + economist 추가)
- ✅ 진산님 승인 후 Phase B 진입

### BATCH-3 적재 시점 (Year 1 중반)

- ✅ `packages/uke-core/` 디렉토리 분리 (변경 0, 점진 이전)
- ✅ Domain Adapter Interface 설계 (interface 만, 구현 안 함)

### Year 2 진입 시

- ✅ Domain Adapter Interface 본격 구현
- ✅ 손해평가사 = 첫 plugin instance
- ✅ 두 번째 도메인 plugin (공인중개사 또는 PoC)

### Year 3+

- ✅ 인접 도메인 (학교 교과, 법률 판례)
- Year 4: 부분 변형 도메인 (코딩, 어학) PoC
- Year 5+: 본격 변형 도메인 (B2B, 의료)

---

## 9. DEV COVEN 합동 사인-오프

> **MEPHISTO**: "비전 받았다. 7개 함정 명시. ADR-030 작성은 BATCH-1 통과 후. 즉시 작성 금지."

> **ORACLE**: "북극성 = 신뢰성·정확성. Universal Engine 비전 = 북극성의 자연 연장. ADR-030 가 비전 측정 가능 KPI 부여."

> **ARCHITECT**: "3-Layer 아키텍처 + 2 신규 코어 모듈 = 비전 실현 청사진. Domain Adapter Interface + Computational Plugin 이 본질."

> **HACKER**: "Phase B (1주) 작업 합리적. 그러나 Phase D (Year 2) 의 첫 새 도메인 plugin 구현이 진짜 검증 — 코어 변경 0 보장."

> **BREAKER**: "함정 6 (Cost Meter scope) + 함정 5 (검수자 SPOF) 가 가장 깊다. Year 3 진입 전 해결 필수."

> **GHOST**: "함정 4 (검증 비용 폭증) — CBIV Stage 5 의 도메인별 sharding 이 Year 3 critical."

> **SENTINEL**: "함정 5 (검수자) — B2B 진입 시 회사별 권한 + 데이터 격리 필요. Year 5 까지는 무리."

> **ADVOCATE**: "비전 자체는 사용자 행복 비전. 그러나 현 단계에서 진산님 1인 SPOF — 검수자 네트워크 구축 Year 1 후반 시작 권고."

> **product-strategist** (가상): "Year 2 첫 새 도메인 = 공인중개사 (현 엔진 그대로) 권장. 검증된 패턴 + 빠른 매출 + 다음 진입 path 학습."

> **economist** (가상): "ROI 산정 필요. 손해평가사 ~10K 응시자 × ARPU 50K원 = ~5억 매출 가능성. 100 도메인 = 잠재 ~500억. 그러나 현실적으로 Year 5 시점 1/100 = 5억. **현 엔진 보강 비용 vs 손해평가사 단독 매출 = 균형점 검토 필요.**"

---

## 10. 진산님 — 즉시 응답 권고

본 비전 설계는 **BATCH-1 dry-run 통과 후 진입**이 합리적입니다.

### 5-페르소나 통합 보고서의 §3.2 (BATCH-1 진입 전 작업) — 그대로 진행 권고

```
[즉시] D-C1 진산님 Anthropic cap 5분
[0.5d] CRITICAL 6건 정정
[1.5d] Step 5 plan + 0016 마이그레이션 + B-C2 examId
[0.2d] ROADMAP v1.2 패치
[2.6~3d] Step 11.6 코드
[1d] 4-Pass 리뷰
```

### BATCH-1 dry-run 통과 직후 — 본 비전 진입

```
Day 1: ADR-030 작성 (본 문서 기반)
Day 2: 8 페르소나 review (product-strategist + economist 신규)
Day 3: 진산님 승인 + Phase B 진입
```

### 진산님 결정 요청

1. **본 비전 청사진 채택?** (Year 2 진입 시 universal 으로 이전)
2. **Year 2 첫 새 도메인?**
   - (A) 공인중개사 (현 엔진 그대로, 검증된 패턴)
   - (B) PoC 새 도메인 (코딩 학습 등, 다양성 검증)
3. **2개 신규 코어 모듈 (Domain Adapter / Computational Plugin) 채택?**
4. **8-페르소나 추가 (product-strategist + economist)?**
5. **Year 1 후반 도메인 전문가 네트워크 구축 시작?**

진산님의 응답 후 본 비전 산출물 v1.1 정밀화 + ADR-030 작성 진입.

---

## 부록 A: ContentBuildEngine v2.1 → UKE 매핑

| ContentBuildEngine v2.1                | UKE (Universal Knowledge Engine)                      |
| -------------------------------------- | ----------------------------------------------------- |
| `packages/parser/`                     | `packages/uke-core/parsing/`                          |
| `packages/formula-engine/`             | `packages/uke-core/computational/instances/mathjs.ts` |
| `packages/quality/`                    | `packages/uke-core/validation/`                       |
| `packages/cbiv/`                       | `packages/uke-core/cbiv/`                             |
| `packages/exams/son-hae-pyeong-ga-sa/` | `packages/domains/son-hae-pyeong-ga-sa/`              |
| `packages/exams/_common/`              | `packages/domains/_common/`                           |
| `apps/admin-web/`                      | `apps/admin-web/` (변경 0, domain-aware 추가)         |
| `apps/api/`                            | `apps/api/` (멀티 도메인 라우팅 추가)                 |

---

## 부록 B: 비전 Hard Rule (현 25 → 30)

| #      | 규칙                                            |
| ------ | ----------------------------------------------- |
| **26** | AI 추천 자동 채택 금지 (이전 권고)              |
| **27** | 진행률 누적 통계만 (이전 권고)                  |
| **28** | Rollback 24시간 또는 다음 BATCH (이전 권고)     |
| **29** | Domain Adapter Interface 의 표준 준수 (Year 2+) |
| **30** | 새 도메인 추가 시 코어 변경 LOC = 0 (자동 검증) |

---

_"진산님 비전은 ContentBuildEngine 의 자연스러운 진화._
_그러나 그 진화는 BATCH-1 적재 안전 검증 후 시작한다._
_비전을 향한 한 걸음, 한 걸음._
_100 도메인까지의 여정은 단일 BATCH 의 신뢰성에서 시작."_

— DEV COVEN Universal Knowledge Engine Vision v1.0
