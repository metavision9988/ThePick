# API Reference — Build-time + Runtime + Library

본 문서는 [`README.md`](./README.md) §6 의 깊이 보강. 다른 프로젝트의 Claude Code 가 엔진과 통신할 때 참조.

---

## 1. Library API (TypeScript 패키지 직접 호출)

### 1.1 `@thepick/parser`

#### `processBatch(options)` — 통합 추출+검증 파이프라인

```typescript
import { processBatch } from '@thepick/parser';

const result = await processBatch({
  pdfPath: './manual.pdf',
  pages: '396-427', // 페이지 범위
  examAdapter: REALTOR_ADAPTER, // ExamAdapter 인스턴스
  aiAdapter: claudeAdapter, // ai-adapter 인스턴스
  options: {
    chapterInitSeed: '제1장 농업재해보험 손해평가 개관', // 첫 페이지 chapter 부재 시
    pageOffset: 7, // book_page = pdf_page - offset
    visionFallback: true, // Claude Vision 그림 분석
  },
});
// result: { graph: KnowledgeGraph, raw: ExtractedPage[], stats: BatchStats }
```

#### `extractPdf(path, options)` — PDF 텍스트 + 메타

```typescript
import { extractPdf, type ExtractedPage } from '@thepick/parser';

const pages: ExtractedPage[] = await extractPdf('./manual.pdf', {
  pages: '1-50',
  includeImages: true,
  includeTables: true,
});
// 각 page: { pageNumber, text, tables, images, fractions }
```

#### `splitSections(text, adapter)` — 챕터/절 분할

```typescript
import { splitSections, type Section } from '@thepick/parser';

const sections: Section[] = splitSections(rawText, {
  chapterPattern: /^제\s*(\d+)\s*장/,
  sectionPattern: /^제\s*(\d+)\s*절/,
  forwardFill: true, // 페이지 경계 forward-fill
});
// section: { level, title, content, startPage, endPage }
```

#### `extractTables(page)` — pdfplumber 표 + cell merge

```typescript
import { extractTables, type ExtractedTable } from '@thepick/parser';

const tables: ExtractedTable[] = await extractTables(pdfPage, {
  cellMerge: true, // 병합 셀 자동 감지
  nestedTables: true, // 중첩 표 감지
});
```

#### `selectVisionCandidates(pages, options)` — Vision 후보 선정

```typescript
import { selectVisionCandidates, type VisionCandidate } from '@thepick/parser';

const candidates: VisionCandidate[] = selectVisionCandidates(pages, {
  minImageArea: 50000, // 50000 픽셀 이상
  ocrThreshold: 0.7, // OCR 신뢰도 임계
});
// candidate: { page, imageBbox, suggestedPrompt }
```

#### `schemaValidator(graph, registry)` — 스키마 검증

```typescript
import { schemaValidator, getOntologyRegistry } from '@thepick/parser';

const registry = getOntologyRegistry('./ontology-registry.realtor.json');
const validation = await schemaValidator(graph, registry);
// validation: { valid: boolean, errors: SchemaError[] }
```

### 1.2 `@thepick/formula-engine`

#### `calculate(formulaId, vars, options)` — 산식 평가

```typescript
import { calculate } from '@thepick/formula-engine';

const result = calculate(
  'F-01',
  {
    area: 10000,
    ratio: 0.65,
  },
  {
    constantsProvider: myConstantsProvider,
    timeoutMs: 100,
  },
);
// result: { value: 6500, display: 'A × r = 10000 × 0.65 = 6500', steps: [...] }
```

#### `getFormula(id)` / `getAllFormulas()` — 산식 메타 조회

```typescript
import { getFormula, getAllFormulas, BATCH1_FORMULAS } from '@thepick/formula-engine';

const f = getFormula('F-01');
// { id: 'F-01', name: '...', equation_template: '...', variables_schema: {...} }

const all = getAllFormulas(); // 등록된 모든 산식
const batch1 = BATCH1_FORMULAS; // BATCH-1 영역 13개 (도메인 별 fork 시 재정의)
```

#### `InMemoryConstantsProvider` — 테스트/임시 상수 주입

```typescript
import { InMemoryConstantsProvider } from '@thepick/formula-engine';

const provider = new InMemoryConstantsProvider({
  'CONST-001': { id: 'CONST-001', value: '0.65', numeric_value: 0.65, category: 'coefficient' },
  'CONST-002': { id: 'CONST-002', value: '1.0115', numeric_value: 1.0115, category: 'coefficient' },
});

const result = calculate('F-06', { ... }, { constantsProvider: provider });
```

### 1.3 `@thepick/quality`

#### `checkGraphIntegrity(graph)` — 무결성 검사

```typescript
import { checkGraphIntegrity } from '@thepick/quality';

const integrity = checkGraphIntegrity(graph);
// integrity: {
//   orphanNodes: string[],     // 들어오는 엣지/나가는 엣지 모두 0
//   brokenEdges: { id, missingNode }[],  // from/to 노드 부재
//   supersedesCycles: string[][],         // 순환 발견
//   passed: boolean,
// }
```

### 1.4 `@thepick/shared` — 공통 타입

```typescript
import {
  type NodeType,
  type EdgeType,
  type ContentStatus,
  type ExamScope,
  type ConstantCategory,
  type ConfusionType,
  type ConfusionLevel,
  type ExamId,
  type ExamAdapter,
  TRUTH_WEIGHTS,
  SIMILARITY_THRESHOLD,
  MAX_SUBGRAPH_NODES,
  EXAM_IDS,
  defineExamAdapter,
  AppError,
  ValidationError,
  NotFoundError,
} from '@thepick/shared';
```

### 1.5 `@thepick/ai-adapter` — Claude API wrapper

```typescript
import { ClaudeAdapter } from '@thepick/ai-adapter';

const adapter = new ClaudeAdapter({
  apiKey: env.ANTHROPIC_API_KEY,
  model: 'claude-haiku-4-5-20251001', // 배치 구조화용
  visionModel: 'claude-sonnet-4-6', // 그림 분석용
});

const structured = await adapter.structureBatch(rawText, {
  prompt: '교재 페이지에서 사실 단위 노드 추출',
  maxRetries: 3,
  timeoutMs: 30000,
});
```

---

## 2. Build-time API (Python + 명령어)

### 2.1 `scripts/extract-batch-pages.py`

```bash
python3 scripts/extract-batch-pages.py \
  --pdf docs/manual/manual.pdf \
  --pages 396-427 \
  --output docs/batch-load/batch-1-v2/ \
  --chapter-init "제1장 농업재해보험 손해평가 개관" \
  --page-offset 7 \
  --vision-fallback
```

**출력**:

- `docs/batch-load/batch-1-v2/pages/p{NNN}.json` — 페이지별 JSON
- `docs/batch-load/batch-1-v2/batch-1-extract.json` — 통합 JSON
- `docs/batch-load/batch-1-v2/images/p{ID}-im{XX}.png` — 추출 그림

### 2.2 `scripts/json-to-sql-batch.py`

```bash
python3 scripts/json-to-sql-batch.py \
  --json docs/batch-load/batch-1-v2/batch-1-knowledge-graph.json \
  --batch-id BATCH-1 \
  --version-year 2025 \
  --output docs/batch-load/batch-1-v2/batch-1-insert.sql
```

**특징**: 멱등 `INSERT OR IGNORE` + status='draft' 강제 + BEGIN/COMMIT 미emit (D1 자동 wrap 정합).

### 2.3 `scripts/verify-engine-contracts.ts`

```bash
pnpm tsx scripts/verify-engine-contracts.ts --json > .claude/reports/verify-${SESSION_ID}.json
```

**출력 JSON 구조**:

```json
{
  "timestamp": "2026-05-04T...",
  "repoRoot": "/home/soo/ClaudePro/ThePick",
  "summary": {
    "total": 6,
    "pass": 5,
    "fail": 0,
    "skip": 1,
    "overallStatus": "PASS"
  },
  "categories": [
    { "id": 1, "name": "단위 + 모듈 + 통합 테스트", "status": "PASS", "numerics": [...] },
    { "id": 2, "name": "E2E 테스트", "status": "PASS" },
    { "id": 3, "name": "Cat 5A — P0 시나리오 매트릭스", "status": "PASS" },
    { "id": 4, "name": "품질 테스트", "status": "PASS" },
    { "id": 5, "name": "보안 테스트", "status": "PASS" },
    { "id": 6, "name": "출력 검증", "status": "SKIP" }
  ]
}
```

### 2.4 wrangler 명령 (Cloudflare D1)

```bash
# 마이그레이션 적용 (staging → production)
cd apps/api
yes | wrangler d1 migrations apply DB --env staging --remote
yes | wrangler d1 migrations apply DB --env production --remote

# BATCH 적재
wrangler d1 execute DB --env staging --remote \
  --file=../../docs/batch-load/batch-1-v2/batch-1-insert.sql

# 검증 SELECT
wrangler d1 execute DB --env production --remote --json \
  --command="SELECT COUNT(*) FROM knowledge_nodes WHERE batch_id='BATCH-1'"
```

---

## 3. Runtime API (Cloudflare Workers + Hono)

### 3.1 인증 / 공통

모든 엔드포인트는 다음 헤더 의무:

```
Authorization: Bearer <JWT>
X-Exam-Id: <ExamId>           # Hard Rule 16 의무 (Year 1+)
Content-Type: application/json
```

응답은 `{ data: ..., meta: { requestId, timing } }` 또는 `{ error: { code, message } }`.

### 3.2 노드 조회

```http
GET /api/v1/nodes/:id
```

**Response (200)**:

```json
{
  "data": {
    "id": "F-01",
    "type": "FORMULA",
    "name": "...",
    "description": "...",
    "page_ref": "본문 p.415 / 제1장 제3절",
    "book_page": 415,
    "pdf_page": 422,
    "chapter": "제1장 농업재해보험 손해평가 개관",
    "section": "제3절 현지조사 내용",
    "truth_weight": 8,
    "version_year": 2025,
    "status": "approved"
  }
}
```

```http
GET /api/v1/nodes?type=LAW&lv1_insurance=과수
GET /api/v1/nodes?book_page_min=400&book_page_max=430
```

### 3.3 엣지 조회

```http
GET /api/v1/edges/:fromNode      # 특정 노드에서 나가는 엣지
GET /api/v1/edges?edge_type=USES_FORMULA
```

### 3.4 산식 조회 / 계산

```http
GET /api/v1/formulas/:id
```

```http
POST /api/v1/formulas/:id/calc
Content-Type: application/json

{
  "vars": { "area": 10000, "ratio": 0.65 }
}
```

**Response**:

```json
{
  "data": {
    "value": 6500,
    "display": "A × r = 10000 × 0.65 = 6500",
    "steps": [
      { "label": "면적", "value": 10000, "unit": "m²" },
      { "label": "인정피해율", "value": 0.65, "unit": "ratio" },
      { "label": "결과", "value": 6500, "unit": "m²" }
    ]
  }
}
```

### 3.5 상수 조회

```http
GET /api/v1/constants/:id
GET /api/v1/constants?category=coefficient&applies_to=단감
```

### 3.6 BATCH 실행 추적

```http
GET /api/v1/batch-runs/:batchRunId
POST /api/v1/batch-runs/:batchRunId/recover    # 24h stale lock 시 resume
```

### 3.7 텔레메트리 (Observability)

```http
GET /api/v1/telemetry/dashboard          # 8 게이지 종합
GET /api/v1/telemetry/gauge/graph-integrity
GET /api/v1/telemetry/gauge/formula-accuracy
```

### 3.8 검수 워크플로우 (admin)

```http
POST /api/v1/admin/status-transitions
Content-Type: application/json

{
  "target_type": "node",
  "target_id": "F-01",
  "from_status": "draft",
  "to_status": "approved",
  "reason": "검수자 승인 (page 415 원문 일치 확인)"
}
```

---

## 4. 에러 코드 체계

```typescript
// @thepick/shared/errors
export type ErrorCode =
  | 'VALIDATION_ERROR' // 입력 스키마 위반
  | 'NOT_FOUND' // 노드/엣지/산식 없음
  | 'ONTOLOGY_VIOLATION' // ID 패턴 / 등록 외
  | 'STATUS_TRANSITION_DENIED' // draft → published 직접 전이 등
  | 'FORMULA_TIMEOUT' // 산식 평가 50ms 초과
  | 'FORMULA_VALIDATION' // variables_schema 위반
  | 'GRAPH_INTEGRITY' // 고아/끊긴/순환
  | 'EXAM_ID_REQUIRED' // Hard Rule 16 위반
  | 'IDEMPOTENCY_VIOLATION' // batch_run completed 후 재 INSERT
  | 'INTERNAL';
```

---

## 5. CLI 도구 (선택 도입)

### 5.1 BATCH 적재 helper

```bash
# 설계상 명령 (현재는 wrangler 직접 사용)
pnpm kge batch:load BATCH-1 --env staging
pnpm kge batch:verify BATCH-1 --env production
pnpm kge batch:diff staging production
```

### 5.2 ontology 검사

```bash
pnpm kge ontology:lint packages/parser-realtor/src/ontology-registry.realtor.json
pnpm kge ontology:diff registry-2025.json registry-2026.json
```

### 5.3 산식 sanity

```bash
pnpm kge formula:sanity F-01 --vars area=10000,ratio=0.65
# expect: value=6500
```

(위 CLI 일부는 ThePick 미구현 — 다른 프로젝트가 자체 wrapper 작성 가능)

---

## 6. 멀티시험 진입 시 API 변경 (Year 2)

Hard Rule 16 의 zero-cost 전환:

**Year 1 (단일 시험)**:

```typescript
const nodes = await db.select().from(knowledge_nodes).where(eq(knowledge_nodes.type, 'LAW'));
// Year 1: 단일 시험이므로 examId 필터 불필요
```

**Year 2 (멀티시험, exam_id 컬럼 추가 후)**:

```typescript
const nodes = await db
  .select()
  .from(knowledge_nodes)
  .where(
    and(
      eq(knowledge_nodes.type, 'LAW'),
      eq(knowledge_nodes.exam_id, examId), // ★ 자동 주입
    ),
  );
```

**호출 측 변경 0건** — 래퍼 함수가 examId 인자를 Year 1 부터 받고 있으므로.

---

본 api-reference.md 는 통신 시그니처 골격. 실제 구현은 `apps/api/src/` 코드 + `packages/{parser,formula-engine,quality}/src/index.ts` 참조.
