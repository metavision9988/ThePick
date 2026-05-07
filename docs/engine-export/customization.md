# Customization — 새 도메인 적용 + ExamAdapter + 멀티시험

본 문서는 [`README.md`](./README.md) §4 시나리오 + §7 플러그인 포인트의 깊이 보강. 다른 프로젝트가 본 엔진을 자기 도메인에 적용할 때의 step-by-step.

---

## 1. 5단계 도메인 적용 워크플로우

### Step 1 — 패키지 fork

```bash
# ThePick 저장소 clone 후 도메인 패키지 신설
git clone <thepick-url> kge-realtor
cd kge-realtor

# 도메인 parser 패키지 신규 (ThePick parser-1st-exam 패턴 따라)
mkdir -p packages/parser-realtor/{src,__tests__}
cp packages/parser-1st-exam/package.json packages/parser-realtor/
cp packages/parser-1st-exam/tsconfig.json packages/parser-realtor/

# package.json 의 name 만 교체
# "name": "@yourdomain/parser-realtor"
```

### Step 2 — ExamId 추가

```typescript
// packages/shared/src/constants/exam-ids.ts
export const EXAM_IDS = {
  SON_HAE_PYEONG_GA_SA: 'son-hae-pyeong-ga-sa', // ThePick (기존)
  REALTOR: 'realtor', // ★ 신규
} as const;

export type ExamId = (typeof EXAM_IDS)[keyof typeof EXAM_IDS];
```

### Step 3 — ExamAdapter 작성

```typescript
// packages/parser-realtor/src/adapter.ts
import { defineExamAdapter, type ExamAdapter } from '@thepick/shared';
import { EXAM_IDS } from '@thepick/shared/constants/exam-ids';

export const REALTOR_ADAPTER: ExamAdapter = defineExamAdapter({
  examId: EXAM_IDS.REALTOR,

  // ontology-registry 위치
  ontologyRegistryPath: './ontology-registry.realtor.json',

  // PDF 페이지 vs 본문 페이지 차이 (book_page = pdf_page - offset)
  pageOffset: 12,

  // 챕터/절 정규식 (도메인 별)
  chapterPattern: /^제\s*(\d+)\s*편\s+(.+)$/,
  sectionPattern: /^제\s*(\d+)\s*장\s+(.+)$/,
  // (ThePick 손해평가사 = "제N장" 챕터 / "제N절" 섹션)
  // (공인중개사 = "제N편" 편 / "제N장" 장 — 1단계 깊음)

  // (선택) 산식 ID 패턴 변형
  formulaIdGenerator: (seq: number) => `F-RE-${String(seq).padStart(2, '0')}`,
  // F-RE-01 (Realtor 영역 산식 prefix)

  // (선택) 도메인 매직 넘버 loader
  constantsLoader: () => REALTOR_CONSTANTS,
});

const REALTOR_CONSTANTS = [
  {
    id: 'CONST-RE-001',
    category: 'ratio',
    name: '중개수수료 한도',
    value: '0.6%',
    numeric_value: 0.006,
  },
  // ...
];
```

### Step 4 — Ontology Registry

```bash
# packages/parser-realtor/src/ontology-registry.realtor.json
```

```json
{
  "version": "1.0.0",
  "exam_id": "realtor",
  "node_types": ["LAW", "FORMULA", "INVESTIGATION", "INSURANCE", "CROP", "CONCEPT", "TERM"],
  "_node_types_meaning": {
    "LAW": "공인중개사법 / 부동산거래신고법 등 법조문",
    "FORMULA": "중개수수료 산식 / 양도세 산식",
    "INVESTIGATION": "현장 조사 절차",
    "INSURANCE": "(미사용 — 도메인 N/A) 또는 1차 분류 재해석",
    "CROP": "(미사용) 또는 2차 분류 재해석 (예: 부동산 종류)",
    "CONCEPT": "권리 / 등기 / 거래 등 개념",
    "TERM": "전세 / 월세 / 임차권 등 용어"
  },
  "edge_types": [
    "APPLIES_TO",
    "REQUIRES_INVESTIGATION",
    "PREREQUISITE",
    "USES_FORMULA",
    "DEPENDS_ON",
    "GOVERNED_BY",
    "DEFINED_AS",
    "EXCEPTION",
    "TIME_CONSTRAINT",
    "SUPERSEDES",
    "SHARED_WITH",
    "DIFFERS_FROM",
    "CROSS_REF"
  ],
  "node_id_patterns": {
    "LAW": "^LAW-\\d{3}$",
    "FORMULA": "^F-RE-\\d{2}$",
    "INVESTIGATION": "^INV-\\d{3}$",
    "INSURANCE": "^INS-\\d{2}$",
    "CROP": "^CROP-\\d{3}$",
    "CONCEPT": "^CONCEPT-\\d{3}$",
    "TERM": "^TERM-\\d{3}$"
  },
  "formula_id_pattern": "^F-RE-\\d{2}$",
  "constant_id_pattern": "^CONST-RE-\\d{3}$",
  "constant_categories": [
    "threshold",
    "coefficient",
    "date",
    "ratio",
    "sample",
    "deductible",
    "insurance_rate"
  ],
  "node_types_meta": {
    "LAW": { "deduplication_threshold": 0.88, "confusion_priority": "critical" },
    "FORMULA": { "deduplication_threshold": 0.95, "confusion_priority": "critical" },
    "INVESTIGATION": { "deduplication_threshold": 0.9, "confusion_priority": "high" },
    "INSURANCE": { "deduplication_threshold": 0.93, "confusion_priority": "high" },
    "CROP": { "deduplication_threshold": 0.97, "confusion_priority": "medium" },
    "CONCEPT": { "deduplication_threshold": 0.85, "confusion_priority": "medium" },
    "TERM": { "deduplication_threshold": 0.88, "confusion_priority": "low" }
  },
  "registered_ids": {
    "LAW": ["LAW-001", "LAW-002", "LAW-003"],
    "FORMULA": ["F-RE-01", "F-RE-02"],
    "_": "도메인 별 ID 목록 — BATCH 적재 시 누적"
  }
}
```

### Step 5 — 도메인 산식 정의

```typescript
// packages/parser-realtor/src/formulas/batch1-definitions.ts
import { type FormulaDef } from '@thepick/formula-engine';

export const REALTOR_BATCH1_FORMULAS: FormulaDef[] = [
  {
    id: 'F-RE-01',
    name: '중개수수료 (매매)',
    equation_template: 'price * rate',
    equation_display: '거래금액 × 요율',
    variables_schema: {
      price: { type: 'number', unit: 'KRW', range: [0, 1e12], required: true },
      rate: { type: 'number', unit: 'ratio', range: [0, 0.01], required: true },
    },
    constraints: { rate: 'between 0 and 0.01 (1% 한도)' },
    expected_inputs: { price: 500000000, rate: 0.005 },
    page_ref: '본문 p.45 / 제1편 제3장',
    node_id: 'CONCEPT-RE-001',
    version_year: 2026,
  },
  // ...
];
```

---

## 2. 5 플러그인 포인트 상세

### 2.1 ExamAdapter (도메인 메타 어댑터)

**인터페이스** (`@thepick/shared/exam-adapter.ts`):

```typescript
export interface ExamAdapter {
  readonly examId: ExamId;

  // 추출 단계
  readonly ontologyRegistryPath: string;
  readonly pageOffset: number;
  readonly chapterPattern: RegExp;
  readonly sectionPattern: RegExp;

  // (선택) 산식 / 상수
  formulaIdGenerator?: (seq: number) => string;
  constantsLoader?: () => ConstantsBatch[];

  // (선택) Vision trigger 정책
  visionThresholds?: { minImageArea: number; ocrThreshold: number };

  // (선택) 혼동 유형 활성화 (8 ConfusionType 중 도메인 적합)
  enabledConfusionTypes?: ConfusionType[];

  // (선택) NodeType 의미 재해석 (문서화 only — 코드는 그대로)
  nodeTypeSemantics?: Record<NodeType, string>;
}
```

**기본 구현** (`defineExamAdapter`):

```typescript
export function defineExamAdapter(
  partial: Partial<ExamAdapter> & Pick<ExamAdapter, 'examId'>,
): ExamAdapter {
  return {
    pageOffset: 0,
    chapterPattern: /^제\s*(\d+)\s*장/,
    sectionPattern: /^제\s*(\d+)\s*절/,
    visionThresholds: { minImageArea: 50000, ocrThreshold: 0.7 },
    enabledConfusionTypes: [
      'numeric',
      'decimal_coefficient',
      'date_period',
      'positive_negative',
      'exception',
      'procedure_order',
      'list_omission',
    ],
    ...partial,
  };
}
```

### 2.2 Ontology Registry

[`data-schema.md §5`](./data-schema.md) 참조. 도메인 별 ID 목록 + 패턴.

**중요 결정**:

- **node_id_patterns 변경 권장 X** (정합성). FORMULA 만 도메인 prefix 추가 (`F-RE-NN`) 정도가 권장.
- **registered_ids 는 BATCH 적재 시 누적**. 첫 BATCH 진입 시 빈 배열 → BATCH-1 적재 후 등록 → BATCH-2 시 추가.
- strict mode: registered_ids 외 ID 모두 reject (production)
- lenient mode: 패턴만 매칭 (development)

### 2.3 Constants Provider

`@thepick/formula-engine/constants-resolver.ts` 의 인터페이스:

```typescript
export interface ConstantsProvider {
  get(id: string): Promise<Constant | null>;
  getMany(ids: string[]): Promise<Constant[]>;
  getByCategory(category: ConstantCategory, examId: ExamId): Promise<Constant[]>;
}
```

**구현 옵션**:

#### `InMemoryConstantsProvider` — 테스트 / 빌드 타임

```typescript
import { InMemoryConstantsProvider } from '@thepick/formula-engine';

const provider = new InMemoryConstantsProvider({
  'CONST-001': { id: 'CONST-001', value: '0.65', numeric_value: 0.65, category: 'coefficient' },
});
```

#### `D1ConstantsProvider` — 런타임 (Workers)

```typescript
import type { ConstantsProvider } from '@thepick/formula-engine';

export class D1ConstantsProvider implements ConstantsProvider {
  constructor(
    private db: D1Database,
    private examId: ExamId,
  ) {}

  async get(id: string) {
    return await this.db.prepare('SELECT * FROM constants WHERE id = ?').bind(id).first();
  }
  // ...
}
```

#### 다른 DB (Postgres / MySQL) — 자유 구현

인터페이스만 만족하면 D1 외 어떤 DB 든 사용 가능.

### 2.4 Vision Trigger 정책

`@thepick/parser/vision-trigger.ts`:

```typescript
export function selectVisionCandidates(
  pages: ExtractedPage[],
  options: {
    minImageArea?: number;
    ocrThreshold?: number;
    examAdapter?: ExamAdapter;
  },
): VisionCandidate[];
```

**도메인 별 임계값 권장**:

| 도메인               | minImageArea | ocrThreshold | 비고                  |
| :------------------- | :----------: | :----------: | :-------------------- |
| 손해평가사 (ThePick) |    50000     |     0.7      | 그림 의존 낮음        |
| 공인중개사           |    30000     |     0.6      | 부동산 사진 다수      |
| 전기기사             |    20000     |     0.5      | 회로도 의존 매우 높음 |
| 소방기사             |    25000     |     0.55     | 도면 + 표 다수        |
| 의료 자격증          |    10000     |     0.5      | 영상/사진 critical    |

### 2.5 Confusion Detection (8 ConfusionType)

도메인 별 활성화 정책:

| ConfusionType         | 의미        | 손해평가사 | 공인중개사 | 전기기사 |
| :-------------------- | :---------- | :--------: | :--------: | :------: |
| `numeric`             | 수치 혼동   |     ✅     |     ✅     |    ✅    |
| `decimal_coefficient` | 소수 계수   |     ✅     |     ⚠️     |    ✅    |
| `date_period`         | 기간 혼동   |     ✅     |     ✅     |    ⚠️    |
| `positive_negative`   | 부정문 함정 |     ✅     |     ✅     |    ✅    |
| `exception`           | 예외 조항   |     ✅     |     ✅     |    ⚠️    |
| `procedure_order`     | 절차 순서   |     ✅     |     ✅     |    ✅    |
| `cross_crop`          | 작물 교차   |     ✅     |     ❌     |    ❌    |
| `list_omission`       | 목록 누락   |     ✅     |     ✅     |    ✅    |

`cross_crop` 같은 도메인 특화는 비활성. ExamAdapter `enabledConfusionTypes` 에서 제어.

---

## 3. 멀티시험 진입 (Year 2 정합)

ThePick 의 ADR-007/008/009 + Hard Rule 15-17 패턴을 **다른 프로젝트도 그대로 적용** 권장.

### 3.1 핵심 정합

1. **시험 ID 리터럴 1곳만** (`packages/shared/src/constants/exam-ids.ts`). 나머지는 `EXAM_IDS.X` 경유.
2. **데이터 조회 함수에 examId 파라미터 의무** (Year 1 시점부터):

   ```typescript
   // ❌ Year 1 만 단일 시험이라고 examId 생략
   async function findNodesByType(type: NodeType): Promise<Node[]>;

   // ✅ Year 1 부터 examId 필수 (Year 2 zero-cost)
   async function findNodesByType(examId: ExamId, type: NodeType): Promise<Node[]>;
   ```

3. **D1 컬럼 추가는 Year 2 진입 시** (마이그레이션 0020+):
   ```sql
   ALTER TABLE knowledge_nodes ADD COLUMN exam_id TEXT;
   CREATE INDEX idx_nodes_exam_id ON knowledge_nodes(exam_id);
   ```
4. **Vectorize 메타데이터 exam_id 필수**:
   ```typescript
   await vectorize.upsert([
     {
       id: nodeId,
       values: embedding,
       metadata: { exam_id: examId, type, version_year },
     },
   ]);
   ```

### 3.2 한시 예외 (Year 1)

ThePick 은 Year 1 시점에 다음 예외 허용:

- `packages/shared/src/types.ts` 의 `NodeType` 에 도메인 특화 리터럴 (`INSURANCE`, `CROP`) 포함 — Year 2 Phase 4 에 분리
- `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 하드코딩 (다른 도메인 진입 시 추가만, 기존 코드 변경 X)
- `ConstantCategory.insurance_rate` 손해평가사 특화 — Year 2 분리

다른 프로젝트도 동일 패턴 권장: **Year 1 시점에 단일 도메인 특화 type 허용 + Year 2 진입 시 분리**.

### 3.3 위반 시그널 자동 감지

ESLint 규칙 (Phase 1+ 도입 시):

```typescript
// .eslintrc — Hard Rule 17 강제
{
  "no-restricted-syntax": ["error",
    {
      "selector": "Literal[value=/^(son-hae-pyeong-ga-sa|realtor|...)$/]",
      "message": "Use EXAM_IDS.X 경유 — 시험 ID 리터럴 단일 선언 정책 (Hard Rule 17)"
    }
  ]
}
// 단, exam-ids.ts 는 allowlist
```

---

## 4. AI Adapter 교체 (Claude → 다른 LLM)

`@thepick/ai-adapter` 의 인터페이스:

```typescript
export interface AiAdapter {
  structureBatch(rawText: string, options: StructureOptions): Promise<StructuredResult>;
  vision(imagePath: string, prompt: string): Promise<string>;
  embed(text: string): Promise<number[]>;
}
```

**ClaudeAdapter** (ThePick 기본):

```typescript
import Anthropic from '@anthropic-ai/sdk';
export class ClaudeAdapter implements AiAdapter { ... }
```

**OpenAI 어댑터** (자유 구현):

```typescript
import OpenAI from 'openai';
export class OpenAiAdapter implements AiAdapter { ... }
```

**로컬 LLM** (Llama / SLM):

```typescript
export class LocalLlmAdapter implements AiAdapter { ... }
// 메모리 project_slm_lora_deferred_2027 정합 — 2027-04 시장 성숙 후 도입 의무
```

**중요**: AI 가 답변하는 것은 자연어 텍스트만. **산식 계산은 절대 LLM 위임 금지** (Hard Limit 4) — math.js AST 만 사용.

---

## 5. PDF Reader 교체 (pdfplumber → 다른 라이브러리)

`@thepick/parser/pdf-extractor.ts` 인터페이스:

```typescript
export interface PdfReader {
  extract(path: string, options: ExtractOptions): Promise<ExtractedPage[]>;
}
```

**기본** (`PdfPlumberReader` — Python subprocess):

- 표 cell merge 정확도 ⭐⭐⭐
- 그림 추출 ⭐⭐⭐
- 분수 인식 ⭐⭐⭐ (regex 보강)
- 속도 ⭐⭐ (Python subprocess 오버헤드)

**대안** (`MupdfReader`):

- 속도 ⭐⭐⭐
- 표 cell merge ⭐⭐ (정확도 낮음)
- 그림 추출 ⭐⭐⭐

**대안** (`PdfJsReader` — 순수 JS):

- Workers 호환 ⭐⭐⭐ (subprocess 불요)
- 표 cell merge ⭐ (매우 약함)
- 그림 추출 ⭐⭐

**선택 기준**: 도메인 별 표/그림 의존도. 손해평가사 = 표 critical → pdfplumber. 단순 텍스트 도메인 = mupdf 또는 pdfjs 가능.

---

## 6. D1 → 다른 DB 교체

ThePick 은 Cloudflare D1 (SQLite) 기본. 다른 DB 도입 시:

| DB                            |   호환성    | 변경 필요                                |
| :---------------------------- | :---------: | :--------------------------------------- |
| D1 (Cloudflare)               | ⭐⭐⭐ 기본 | 0건                                      |
| Turso (libSQL)                |   ⭐⭐⭐    | drizzle-orm/libsql 어댑터만              |
| SQLite (로컬)                 |   ⭐⭐⭐    | drizzle-orm/better-sqlite3               |
| Postgres                      |    ⭐⭐     | 트리거 SQL 재작성 (PL/pgSQL) + UUID 타입 |
| MySQL                         |    ⭐⭐     | 트리거 SQL 재작성                        |
| Vectorize → Pinecone/Weaviate |    ⭐⭐     | 메타데이터 필터 표현 변경                |

**Postgres 전환 시 주의**:

- 트리거 (0018, 0019) 를 SQL → PL/pgSQL 변환
- `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`
- `datetime('now')` → `now()`
- `RAISE(ABORT, ...)` → `RAISE EXCEPTION ...`

ThePick 은 D1 specific 영역이 트리거에 집중 — 트리거만 재작성하면 80% 호환.

---

## 7. 다른 프로젝트의 Claude Code 가 이 가이드를 받았을 때

본 customization.md 를 받은 다른 프로젝트의 Claude Code 는 다음 순서로 진행:

```
1. README.md 읽기 (5분) — 엔진 정체 + 패키지 구조 + 보장 사항
2. data-schema.md 읽기 — 7 NodeType / 13 EdgeType / 4 메타 / Hard Lock
3. customization.md (본 문서) 읽기 — Step 1~5 적용
4. ExamAdapter 작성 + ontology-registry 정의 (도메인 전문가 협의)
5. BATCH-1 시범 적재 (extract-batch-pages.py 재사용)
6. verify-engine-contracts.ts 실행 → PASS 확인
7. 진산 (또는 도메인 책임자) 검수 → status='draft' → 'approved' 전이
8. BATCH-2~N 누적 진입
```

**의무 게이트**:

- BATCH 적재 후 검증 SELECT 4건 (knowledge_nodes / knowledge_edges / formulas / constants) PASS
- orphan_edges 0 / status='draft' 위반 0
- 4-Pass 자동 리뷰 (코드 변경 시) — 자가 리뷰 금지, 독립 서브에이전트 사용

---

본 customization.md 는 도메인 적용 step-by-step. 검증 체계는 [`quality-gates.md`](./quality-gates.md).
