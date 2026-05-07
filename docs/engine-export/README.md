# ThePick Knowledge Graph Engine (KGE) — Portable Reuse Guide

**다른 프로젝트의 Claude Code 에이전트가 이 문서를 먼저 읽으세요.**

본 문서는 ThePick (손해평가사 AI 학습 서비스) 에서 구현한 **지식 그래프 형성 엔진(KGE)** 을 **도메인 무관 portable 컴포넌트** 로 분리해서 다른 자격증/도메인 프로젝트에 도입할 때의 진입점입니다. 한 번 읽으면 엔진의 정체·구성·활용·확장·검증이 모두 잡힙니다.

---

## 0. 이 엔진은 무엇인가 (TL;DR)

**한 줄**: 도메인 교재(PDF) → **검증 가능한 지식 그래프 + 산식 + 상수 DB** 로 자동 변환하는 **build-time 엔진**. Cloudflare Edge 인프라 위에서 동작.

**왜 만들었는가** (ThePick 맥락):

- 손해평가사 자격증 시험 = 교재 800+ 페이지 / 산식 13~70개 / 법령 3건 / 상수(매직넘버) 수십개
- LLM 직접 답변 = 환각·계산 오류·근거 부재 → 상용 학습 서비스 불가
- 해결: 교재를 **사실 단위(노드/엣지/산식/상수)** 로 분해 → 그래프 RAG + 산식은 AST로 직접 계산 → LLM 은 자연어 생성에만 사용
- 결과: **합격률 60%+ 가능 수준의 정확성·근거 추적성** 확보

**다른 프로젝트가 가져다 쓸 수 있는 형태**:

1. **engine-only mode**: 교재 → 그래프 자동 생성 + 검증만 사용 (상위 학습/평가/시각화 자체 구현)
2. **full-stack mode**: 본 ThePick 의 Workers API + admin-web + 학습 PWA 까지 fork 후 도메인 어댑터만 교체

대부분의 경우 **engine-only mode** 가 정합 — 본 문서는 그 경로를 1급 시민으로 안내.

---

## 1. 5분 만에 이해하기

### 1.1 엔진의 입력과 출력

```
[입력]
  교재 PDF (예: 손해평가사 이론서 835p, 또는 공인중개사 / 전기기사 / 소방기사 등 임의 자격증)
  + 도메인 어댑터 (NodeType / EdgeType / ID 패턴 + 시험 ID 리터럴 1곳)
  + ontology-registry.json (허용 ID 목록 — 무한 생성 차단)

[엔진]
  1. 추출 (PDF → JSON, page/chapter/section 자동 인식 + 표 + 그림 + 분수)
  2. 정규화 (chapter/section forward-fill, 페이지 표기 정합 book_page vs pdf_page)
  3. Knowledge Graph 합성 (LLM-aided, status='draft')
  4. 검증 (schema-validator + graph-integrity + ontology-registry lock + Hard Rule 체크)
  5. 적재 (D1 SQLite + Vectorize 임베딩, 멱등 INSERT OR IGNORE)

[출력]
  - knowledge_nodes (사실 단위 노드, 7 type 분류 + truth_weight 우선순위)
  - knowledge_edges (관계 엣지, 13 edge_type)
  - formulas (math.js AST 산식, 동적 코드 실행 금지)
  - constants (매직 넘버 레지스트리, LLM 추론 금지)
  - batch_runs (실행 추적 + Idempotency)
```

### 1.2 핵심 보장 사항 (어떤 도메인이든)

| 보장        | 메커니즘                                                                    |
| :---------- | :-------------------------------------------------------------------------- |
| 환각 차단   | `ontology-registry.json` 에 등록된 ID 만 생성 가능 (외부 ID 거부)           |
| 근거 추적   | 모든 노드는 `book_page` + `pdf_page` + `chapter` + `section` 4 메타 필수    |
| 검수 게이트 | AI 생성 = `status='draft'` 강제 (0018 트리거), 인간 승인 후 `approved` 전이 |
| 시계열 안전 | UPDATE 금지 (Hard Limit), 개정 시 신규 노드 + `SUPERSEDES` 엣지             |
| 산식 정확성 | math.js AST 만 허용, 동적 코드 평가 금지, 변수명·단위·범위 schema 강제      |
| 멱등성      | `INSERT OR IGNORE` + `(batch_run_id, source_id)` 유니크 + state machine     |
| 도메인 격리 | Hard Rule 15-17 (시험 ID 리터럴 1곳 + 데이터 조회 examId 의무)              |

### 1.3 엔진이 해주지 않는 것 (가져가는 쪽 책임)

- 도메인 ontology 설계 (NodeType/EdgeType 의미 정의는 도메인 전문가 영역)
- 교재 원문의 정확성 자체 (entry quality = 사람 검수 책임)
- 학습 UI / 시험지 생성 / 평가 알고리즘 (별도 layer)
- 다국어 / 음성 / 영상 콘텐츠 (Year 2+ 영역)

---

## 2. 패키지 구조와 의존 관계

ThePick 은 pnpm workspaces 모노레포. **engine-only 도입 시 가져갈 패키지** 와 **놔두고 갈 패키지** 를 분리.

### 2.1 가져갈 패키지 (Engine Core, 7개)

| 패키지                    | 책임                                                                                                                                       | 의존성             |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------- | :----------------- |
| `@thepick/shared`         | 도메인 무관 타입 (NodeType, EdgeType, TRUTH_WEIGHTS, ContentStatus, ExamScope, ConstantCategory) + ExamAdapter pattern + logger + messages | 없음 (zero-dep)    |
| `@thepick/parser`         | PDF 추출 + section/table 분할 + ontology-registry + schema-validator + batch-processor + normalizer                                        | shared, ai-adapter |
| `@thepick/formula-engine` | math.js AST 파서 + sandbox + constants-resolver + variable-mapper                                                                          | shared             |
| `@thepick/quality`        | graph-integrity (고아노드/끊긴엣지/SUPERSEDES 순환)                                                                                        | shared             |
| `@thepick/ai-adapter`     | Claude API 호출 (Haiku 배치 구조화 + Vision OCR)                                                                                           | shared             |
| `apps/batch`              | Build pipeline tool (Workers 외부, Python subprocess + extract-batch-pages.py)                                                             | parser, ai-adapter |
| `migrations/`             | D1 SQLite 스키마 19개 (0001 initial → 0019 page/chapter meta)                                                                              | (D1 종속)          |

### 2.2 도메인 특화 — 교체 또는 신규 작성

| 패키지                                                       | ThePick 의 구현                                | 다른 도메인 진입 시                        |
| :----------------------------------------------------------- | :--------------------------------------------- | :----------------------------------------- |
| `@thepick/parser-1st-exam`                                   | 1차 시험 도메인 (Year 1 한시 예외)             | **교체** (예: `@yourdomain/parser-domain`) |
| `packages/parser/src/ontology-registry.json`                 | LAW-001 / F-01 / INV-001 패턴                  | **교체** (도메인 ID 패턴)                  |
| `packages/parser/src/constants-extractor.ts`                 | 손해평가사 매직넘버 (인정피해율, 자기부담비율) | **교체** (도메인 매직넘버)                 |
| `packages/formula-engine/src/formulas/batch1-definitions.ts` | 적과전 종합위험 13 산식                        | **교체** (도메인 산식)                     |
| `packages/shared/src/constants/exam-ids.ts`                  | EXAM_IDS.SON_HAE_PYEONG_GA_SA                  | **추가** (`EXAM_IDS.YOUR_DOMAIN`)          |

### 2.3 엔진 외부 (UI/서비스, 도입 시 선택)

- `apps/web` — Astro + React PWA (학습 UI)
- `apps/admin-web` — 관리자 대시보드 (검수 워크플로우)
- `apps/api` — Cloudflare Workers + Hono (인증, 결제, FSRS 스케줄링)
- `packages/study-material-generator` — 학습 자료 생성 (Year 2 영역)
- `packages/payment` — 결제

**engine-only 도입자는 위 5개를 가져가지 않아도 됨**. 자체 학습 layer 구현 자유.

---

## 3. 데이터 모델 (Knowledge Graph 스키마)

상세는 [`data-schema.md`](./data-schema.md). 여기서는 핵심만:

### 3.1 4 핵심 테이블

```sql
-- migrations/0001 + 0019 정합
knowledge_nodes  (id, type, name, description, page_ref, batch_id, version_year,
                  superseded_by, truth_weight, status, book_page, pdf_page, chapter, section,
                  lv1_insurance, lv2_crop, lv3_investigation)  -- 도메인별 lv* 의미 재해석

knowledge_edges  (id, from_node, to_node, edge_type, condition, priority, is_active)

formulas         (id, name, equation_template, equation_display, variables_schema,
                  constraints, expected_inputs, graceful_degradation, page_ref, node_id,
                  version_year, superseded_by)

constants        (id, category, name, value, numeric_value, applies_to, insurance_type,
                  confusion_risk, confusion_level)
```

### 3.2 7 NodeType (도메인 별 재해석 가능)

|      Type       | ThePick 의 의미 | 일반화                     |
| :-------------: | :-------------- | :------------------------- |
|      `LAW`      | 법령 조문       | 강제 규범 (법률·규칙·기준) |
|    `FORMULA`    | 산식            | 계산 로직 (정량 산출)      |
| `INVESTIGATION` | 조사 절차       | 절차/프로세스 단위         |
|   `INSURANCE`   | 보험 상품       | 도메인 1차 분류 (대분류)   |
|     `CROP`      | 작물            | 도메인 2차 분류 (중분류)   |
|    `CONCEPT`    | 개념            | 정의·이론 단위             |
|     `TERM`      | 용어            | 어휘·축약어                |

**다른 도메인 진입 시**: 7 type 의미를 재정의 (예: 전기기사 → INSURANCE → "공사 종류", CROP → "회로 분류", INVESTIGATION → "측정 절차"). type 자체는 변경 불가 (Hard Rule 17 정합 — 시험 ID 리터럴 1곳 정책 확장).

### 3.3 13 EdgeType

`APPLIES_TO` / `REQUIRES_INVESTIGATION` / `PREREQUISITE` / `USES_FORMULA` / `DEPENDS_ON` / `GOVERNED_BY` / `DEFINED_AS` / `EXCEPTION` / `TIME_CONSTRAINT` / `SUPERSEDES` / `SHARED_WITH` / `DIFFERS_FROM` / `CROSS_REF`

**SUPERSEDES** 가 시계열 핵심 — 개정 시 UPDATE 대신 신규 노드 + `SUPERSEDES` 엣지로 연결.

### 3.4 Truth Weight (RAG 정렬 우선순위)

```typescript
const TRUTH_WEIGHTS = {
  LAW: 10, // 법령 = 절대 기준
  FORMULA: 8, // 산식 = 계산 정확성
  INVESTIGATION: 7, // 절차 = 운영 정확성
  INSURANCE: 6,
  CROP: 6, // 도메인 분류
  CONCEPT: 5, // 일반 개념
  TERM: 3, // 용어
};
```

LLM 컨텍스트 주입 시 이 가중치 순서대로 정렬 → 충돌 시 LAW 우선.

### 3.5 ID 패턴 (Ontology Lock)

```json
{
  "node_id_patterns": {
    "LAW": "^LAW-\\d{3}$",
    "FORMULA": "^F-\\d{2}$",
    "INVESTIGATION": "^INV-\\d{3}$",
    "INSURANCE": "^INS-\\d{2}$",
    "CROP": "^CROP-\\d{3}$",
    "CONCEPT": "^CONCEPT-\\d{3}$",
    "TERM": "^TERM-\\d{3}$"
  },
  "formula_id_pattern": "^F-\\d{2}$",
  "constant_id_pattern": "^CONST-\\d{3}$"
}
```

**LLM 이 위 패턴 외 ID 를 생성하면 schema-validator 가 reject**. 도메인 변경 시 패턴 자체는 그대로, 등록된 ID 목록만 도메인 별로 관리.

---

## 4. 활용 패턴 — 다른 도메인 적용 시나리오

### 4.1 시나리오 A: 단일 자격증 신규 적용 (예: 공인중개사)

**Step 1 — 패키지 fork**:

```bash
# ThePick 저장소 clone
git clone <thepick-url> kge-base
cd kge-base
pnpm install

# 도메인 패키지 신규 작성
mkdir -p packages/parser-realtor
cp -r packages/parser-1st-exam/{package.json,src,tsconfig.json} packages/parser-realtor/
# package.json name 만 @yourdomain/parser-realtor 로 교체
```

**Step 2 — 도메인 어댑터 작성** (상세는 [`customization.md`](./customization.md)):

```typescript
// packages/shared/src/constants/exam-ids.ts 에 추가
export const EXAM_IDS = {
  SON_HAE_PYEONG_GA_SA: 'son-hae-pyeong-ga-sa',
  REALTOR: 'realtor', // ★ 신규
} as const;

// packages/parser-realtor/src/adapter.ts 신규
import { defineExamAdapter } from '@thepick/shared';
export const REALTOR_ADAPTER = defineExamAdapter({
  examId: EXAM_IDS.REALTOR,
  ontologyRegistryPath: './ontology-registry.realtor.json',
  pageOffset: 12, // book_page = pdf_page - offset
  chapterPattern: /^제\s*(\d+)\s*편/, // 도메인 별 정규식
});
```

**Step 3 — ontology-registry 정의**:

```bash
# 도메인 ID 목록 작성 (LAW-001~030, F-01~F-25, CONCEPT-001~200 등)
# 패턴은 그대로, ID 목록만 도메인 별
vim packages/parser-realtor/src/ontology-registry.realtor.json
```

**Step 4 — BATCH-1 적재 시범**:

```bash
# scripts/extract-batch-pages.py 재사용 (도메인 무관)
python3 scripts/extract-batch-pages.py \
  --pdf docs/manual/realtor-2026.pdf \
  --pages 1-50 \
  --output docs/batch-load/realtor-batch-1/

# scripts/json-to-sql-batch.py 재사용
python3 scripts/json-to-sql-batch.py \
  --json docs/batch-load/realtor-batch-1/knowledge-graph.json \
  --batch-id REALTOR-BATCH-1 \
  --version-year 2026 \
  --output docs/batch-load/realtor-batch-1/insert.sql

# wrangler d1 적용 (staging → production)
wrangler d1 migrations apply DB --env staging --remote
wrangler d1 execute DB --env staging --remote --file=insert.sql
```

**Step 5 — 검증**:

```bash
# verify-engine-contracts.ts 재사용 (도메인 무관)
pnpm tsx scripts/verify-engine-contracts.ts --json > verify.json
```

### 4.2 시나리오 B: 멀티 자격증 (Year 2 정합)

ThePick 은 Year 1 = 손해평가사 단일, Year 2 = 멀티시험 확장 설계 (ADR-007/008/009 + Hard Rule 15-17).

**핵심 정합**:

- `examId: ExamId` 파라미터를 모든 데이터 조회 함수에 의무화 (Year 1 시점부터)
- Year 2 진입 시 D1 컬럼에 `exam_id` 추가 + WHERE 절 자동 주입 → 호출 측 코드 변경 0건
- Vectorize 메타데이터 `exam_id` 필수 주입 (ADR-004)

상세는 [`customization.md` §3 멀티시험 적용](./customization.md).

### 4.3 시나리오 C: engine-only 라이브러리화

**의도**: 본 ThePick 의 학습 PWA / 결제 / FSRS 가 아닌, **그래프 형성 엔진 자체** 만 라이브러리로 사용.

**최소 도입 패키지**:

- `@thepick/shared` (타입 + ExamAdapter)
- `@thepick/parser` (추출 + 검증)
- `@thepick/formula-engine` (산식)
- `@thepick/quality` (그래프 무결성)
- `migrations/0001` ~ `migrations/0019` (D1 스키마)

이 5개만 가져가서 자체 프로젝트의 D1/Postgres에 적재. 학습 layer 는 자유 구현.

```typescript
// 예: 라이브러리 스타일 호출
import { processBatch, schemaValidator } from '@thepick/parser';
import { calculate } from '@thepick/formula-engine';
import { checkGraphIntegrity } from '@thepick/quality';

const result = await processBatch({
  pdfPath: './manual.pdf',
  pages: '1-50',
  examAdapter: REALTOR_ADAPTER,
  aiAdapter: { provider: 'claude', model: 'haiku-4.5' },
});

const validation = await schemaValidator(result.graph);
const integrity = await checkGraphIntegrity(result.graph);

const ans = calculate('F-01', { area: 10000, ratio: 0.65 });
```

---

## 5. 검증 체계 (4-Pass + Level 1~3 + verify-engine-contracts)

상세는 [`quality-gates.md`](./quality-gates.md). 여기서는 골격만:

### 5.1 Level 1 — 표면 검증 (Claude LOCAL D1 dry-run)

- **schema-validator**: ID 패턴 / NodeType / EdgeType / 필수 컬럼 / status='draft' 강제
- **graph-integrity**: 고아 노드 0 / 끊긴 엣지 0 / SUPERSEDES 순환 0
- **ontology-registry lock**: 등록 외 ID reject

### 5.2 Level 2 — 내용 정확성 (Golden Test)

- **page_ref 범위**: 노드 page_ref 가 BATCH 본문 페이지 범위 내
- **변수명 매핑**: 산식 variables_schema 와 raw text 일치
- **공식 정답 100% 일치**: 기출 문제 적용 시 — 불일치 1건이라도 원인 규명

### 5.3 Level 3 — 학습 효과 역검증 (BATCH 누적 후)

- 기출 문제 자동 풀이 → 정답률 측정
- 혼동 유형 자동 감지 (8 ConfusionType) → 학습자 함정 노출
- 누락 페이지 식별 → BATCH 보강 트리거

### 5.4 verify-engine-contracts.ts (Sprint 1 §5.5 자동화)

`scripts/verify-engine-contracts.ts` — 모노레포 전체 1200 테스트 합산 + 8 카테고리 PASS/FAIL 판정. 매 세션 entry / 매 step 완료 시 의무 실행 (TD-VRF-001 결정성 부채는 batch 326/327 flaky 로 알려져 있음).

```bash
pnpm tsx scripts/verify-engine-contracts.ts --json > .claude/reports/verify-${SESSION_ID}.json
# 6 카테고리 PASS / 1 SKIP (Phase 2 영역) → overallStatus: PASS
```

### 5.5 4-Pass 자동 리뷰 (코드 영역 변경 시)

L2+ 코드 변경 후 의무. Agent tool 로 독립 서브에이전트 4개 병렬 호출 (자가 리뷰 금지):

- **Pass 1 SURGEON** — 코드 정합성 (null/async/경계값/에러처리)
- **Pass 2 ARCHITECT** — 모듈 간 연계 (import 방향/Workers 제약/D1 스키마/Hexagonal)
- **Pass 3 ADVOCATE** — UX + 보안 (에러 UX/접근성/XSS/정답 안전)
- **Pass 4 CONTRACT** — 기획 대조 (Silent Pivot 탐지 / Hard Rules 31개)

상세는 [`quality-gates.md` §4](./quality-gates.md).

### 5.6 5-페르소나 기술부채 심층 리뷰 (Phase 마일스톤)

Phase 0/1/2/3 각 완료 시 의무. 5개 독립 에이전트 병렬:

- `refactoring-expert` (코드 품질 부채)
- `performance-engineer` (런타임 부채)
- `quality-engineer` (테스트 부채)
- `backend-architect` (데이터·API 부채)
- `devops-architect` (운영 부채)

---

## 6. 커뮤니케이션 API

상세는 [`api-reference.md`](./api-reference.md). 여기서는 두 layer 만 소개:

### 6.1 Build-time API (Python + TypeScript)

```
[Python — Build Pipeline (Workers 외부)]
  scripts/extract-batch-pages.py     # PDF → JSON
  scripts/json-to-sql-batch.py       # JSON → D1 SQL
  scripts/verify-engine-contracts.ts # 검증

[TypeScript — Library (Workers 내부 OK, build 외부 OK)]
  @thepick/parser
    - processBatch()           — 통합 추출+검증+적재 파이프라인
    - extractPdf()             — PDF 텍스트 + 메타
    - splitSections()          — 챕터/절 분할
    - extractTables()          — pdfplumber 표 + cell merge
    - selectVisionCandidates() — Claude Vision 후보 선정
    - schemaValidator()        — 노드/엣지 스키마 검증
    - getOntologyRegistry()    — ontology lock 조회
  @thepick/formula-engine
    - calculate(formulaId, vars) — math.js AST 평가
    - getFormula(id)             — 산식 메타 조회
  @thepick/quality
    - checkGraphIntegrity(graph) — 고아/끊긴/순환 검사
```

### 6.2 Runtime API (Cloudflare Workers + Hono)

```
[apps/api/src/]
  GET    /api/v1/nodes/:id         — 노드 조회 (examId 필수)
  GET    /api/v1/nodes?type=LAW    — 노드 검색
  GET    /api/v1/edges/:fromNode   — 엣지 조회
  GET    /api/v1/formulas/:id      — 산식 조회
  POST   /api/v1/formulas/:id/calc — 산식 평가 (math.js AST)
  GET    /api/v1/constants?category=coefficient — 상수 조회
  GET    /api/v1/batch-runs/:id    — BATCH 실행 상태
  POST   /api/v1/batch-runs/:id/recover — 24h stale lock 감지 후 resume
  GET    /api/v1/telemetry/dashboard — 8 게이지 observability
```

**examId 강제**: 모든 데이터 조회는 `examId: ExamId` 파라미터 필수 (Hard Rule 16). Year 2 진입 시 zero-cost 전환.

---

## 7. 커스터마이징 / 플러그인 (도메인 특화)

상세는 [`customization.md`](./customization.md). 핵심 플러그인 포인트 5개:

### 7.1 ExamAdapter (도메인 메타)

```typescript
// packages/shared/src/exam-adapter.ts
export interface ExamAdapter {
  examId: ExamId;
  ontologyRegistryPath: string;
  pageOffset: number; // book_page = pdf_page - offset
  chapterPattern: RegExp;
  sectionPattern: RegExp;
  // Year 2 +
  formulaIdGenerator?: (seq: number) => string; // F-NN 외 패턴 허용
  constantsLoader?: () => ConstantsBatch[];
}
```

### 7.2 Ontology Registry (ID 목록 + 패턴)

도메인 별 `ontology-registry.{domain}.json` 작성. 본 가이드 §3.5 참조.

### 7.3 Constants Provider (산식용 매직넘버)

```typescript
// 산식 계산 시 상수 주입 — InMemoryConstantsProvider 또는 D1ConstantsProvider
import { InMemoryConstantsProvider } from '@thepick/formula-engine';

const provider = new InMemoryConstantsProvider({
  'CONST-001': { value: 0.65, numeric_value: 0.65, category: 'coefficient' },
});
```

### 7.4 Vision Trigger (그림 분석 정책)

```typescript
// packages/parser/src/vision-trigger.ts
export function selectVisionCandidates(
  pages: ExtractedPage[],
  options: { minImageArea?: number; ocrThreshold?: number },
): VisionCandidate[];
```

도메인별 그림 의존도 다름 (예: 손해평가사 = 낮음, 전기기사 = 높음). minImageArea 임계 조정.

### 7.5 Confusion Detection (혼동 유형 감지)

8 ConfusionType (`numeric` / `decimal_coefficient` / `date_period` / `positive_negative` / `exception` / `procedure_order` / `cross_crop` / `list_omission`) 중 도메인 별 적용 정책. `cross_crop` 같은 손해평가사 특화 type 은 도메인 적합성 검토 후 비활성.

---

## 8. Hard Limit (절대 위반 금지)

엔진 사용자가 어떤 도메인이든 반드시 지켜야 하는 8 항목:

1. **knowledge_nodes UPDATE 금지** — 개정 시 신규 노드 + `SUPERSEDES` 엣지 (Temporal Graph)
2. **formulas UPDATE 금지** — 동일 (산식 정확성 보존)
3. **AI 생성 데이터는 status='draft' 만 INSERT** (0018 트리거 강제)
4. **LLM 에게 산식 계산 절대 금지** — math.js AST 만 사용
5. **동적 코드 평가 금지** — `eval` / 동적 함수 생성자 / `vm.run` 등 모든 임의 코드 실행 차단. equation_template 도 정적 파싱만 허용
6. **Constants 는 DB 쿼리로만 조회** — LLM 추론 금지
7. **Ontology Lock**: ontology-registry.json 외 ID 생성 금지
8. **BATCH 순차 실행** — 전 배치 검증 없이 다음 배치 금지

위반 시: 엔진의 정확성·신뢰성 보장이 깨집니다. 본 엔진의 가치는 **이 8 제약을 일관되게 강제**하는 데서 옵니다.

---

## 9. 운영 (Observability + 부채 관리)

### 9.1 8 게이지 (자동차 계기판 메타포)

ThePick 은 엔진 신뢰성을 8 게이지로 상시 모니터링:

| 게이지         | 측정                                          |
| :------------- | :-------------------------------------------- |
| BATCH 진척     | Layer 1~6 BATCH N/M 완료율                    |
| Cost           | Anthropic API 누적 비용 (Phase 2 의무 활성)   |
| D1 SLO         | 쿼리 p95 / Error rate / Storage               |
| Graph 무결성   | 고아 노드 / 끊긴 엣지 / SUPERSEDES 순환       |
| 품질           | schema-validator PASS율 / 4-Pass CRITICAL 0건 |
| Formula 정확도 | 기출 정답 일치율 / Golden Test PASS           |
| Reviewer       | 검수 큐 깊이 / draft → approved 전이 시간     |
| 학습 효과      | 기출 자동 풀이 정답률 / 혼동 유형 노출률      |

상세는 `docs/observability/` (ThePick 내부, engine-export 이월 대상).

### 9.2 부채 ledger 패턴

ThePick handoff-NNN.md 패턴 — 매 세션 종료 시 후속 부채 ID 영속 (TD-S40-1, TD-VRF-001 등). 다른 프로젝트 도입 시 동일 패턴 권장.

---

## 10. 다음 읽을 문서

진입점은 본 README. 깊이 있는 활용은 아래 5 문서:

| 문서                                     | 언제 읽나                                              |
| :--------------------------------------- | :----------------------------------------------------- |
| [`architecture.md`](./architecture.md)   | 패키지 의존성·데이터 흐름·Hexagonal 경계가 궁금할 때   |
| [`data-schema.md`](./data-schema.md)     | 노드/엣지/산식/상수 스키마 + ontology-registry 작성 시 |
| [`api-reference.md`](./api-reference.md) | Workers HTTP API + 핵심 패키지 함수 시그니처           |
| [`customization.md`](./customization.md) | 새 도메인 적용 / ExamAdapter 작성 / 멀티시험 진입      |
| [`quality-gates.md`](./quality-gates.md) | 4-Pass + Level 1~3 + verify-engine-contracts 운영      |

---

## 11. 라이센스 / 출처

- 본 엔진은 ThePick (쪽집게, 손해평가사 AI 학습 서비스) 의 핵심 컴포넌트입니다.
- ThePick 저장소: (TBD — 진산님 결정 의존)
- ADR / WBS / 핸드오프 영속 패턴: `docs/adr/`, `docs/plans/`, `.jjokjipge/handoff-session-NNN.md`
- 본 엔진의 도입 / 포팅 / 활용 문의: 진산님 (taeksoo6432@gmail.com)

---

**진입점 영속**: `docs/engine-export/README.md` — 본 문서. 다른 프로젝트의 Claude Code 에이전트는 이 문서 + 5 보조 문서만 읽으면 엔진을 안전하게 도입할 수 있습니다.

**작성**: Claude (Opus 4.7 1M context) — Session 041 (2026-05-04)
**대상**: 다른 자격증 / 도메인 프로젝트의 Claude Code 에이전트
**검증 책임**: 도입자가 자체 프로젝트 환경에서 verify-engine-contracts.ts 실행 후 PASS 확인 의무
