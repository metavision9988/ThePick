# Step 3 — parser 결정성 Property Test (invariant/tolerable 분리)

---

phase: 1
step: engine-hardening-step3
approved_by: 진산 (2026-04-27 Engine Hardening Roadmap v1.1)
risk_level: L2
plan_version: 1.1
scope:

- packages/parser/src/**tests**/determinism.property.test.ts (신규, Step 14a 진행)
- packages/parser/**fixtures**/batch1/ (신규 디렉토리 — Step 14a 1종 + 14b 4종 추가)
- packages/parser/src/normalizer.ts (신규 — invariant/tolerable 분리 로직, Step 14a 진행)
- packages/parser/src/**tests**/normalizer.test.ts (신규 단위 테스트, Step 14a 진행)

---

## 변경 이력

- **v1.0 (2026-04-27)**: 초기 plan, Engine Hardening Roadmap v1.1 진산 승인
- **v1.1 (2026-04-30)**: Step 14 진입 시 plan ↔ 실측 갭 발견 → Step 14a / 14b scope 분할
  영속화 (contract.yaml AC-PA-1 ~ AC-PA-4 phase_partitions 신설과 정합).
  - **근거**: `docs/engines/parser/contract.yaml` `llm_integration.enabled: false` 현 상태에서
    invariant 6/6 (`node_ids`, `edge_dependency_graph`, `formula_AST_hashes`,
    `constants_canonical_forms`) 검증 불가 — LLM 추출 가정 영역.
  - **14a 진행 (2026-04-30)**: section_hierarchy + ontology_registry_match 2/6 invariant +
    AC-PA-3/4 부분 (INVALID_NODE_ID_PATTERN + DANGLING_EDGE_REFERENCE 2/14
    ValidationErrorCode + CONCEPT 1 prefix). PIPELINE_ITERATIONS = 50 (Python subprocess 가속).
    fixture 1종 (`__fixtures__/batch1/exam_scope.pdf` — `docs/manual/손해평가사 자격시험 출제영역.pdf` 사본).
  - **14b 이연 (Phase 1 후반 LLM 통합 직후 의무)**: invariant 4/6 추가 + AC-PA-2 tolerable +
    AC-PA-3/4 ValidationErrorCode 8종 확장 + 7 prefix 확장 + fixture 4종 추가 + iterations 100 복원.
  - **시그니처 변경**: `extractInvariantFields(contract: KnowledgeContract)` →
    `extractInvariantFields(output: ParserOutput)` (ParserOutput = { contract, sections, pageTexts? }).
    section_hierarchy invariant 검증을 위해 Section[] 동시 수용 필수.
  - **runFullPipeline 가정 → runStaticPipeline**: LLM 미통합 시점 mock empty contract 사용.
    14b 진입 시 batch-processor 출력 합성 형태로 격상.
  - **HASH_SEPARATOR + canonicalizeVariablesSchema 추가**: 4-Pass 리뷰 CRITICAL 2건 흡수
    (Pass 3 Advocate / Pass 1 Surgeon). variables_schema 객체 키 순서 비결정성 + equation
    합성 충돌을 normalizer.ts 단계에서 사전 차단.
  - **index.ts normalizer export 보류**: 14a 시점 production 호출 경로 0건 (test only),
    14b LLM 통합 + batch-processor 검증 경로 진입 시 일괄 export 결정.

---

## 목적

parser 출력의 **invariant_fields 100% 결정성** + **tolerable_fields 5% 이하 변동** 검증. **Review B-1 핵심 적용 사례** — PDF 파싱은 100% 재현성이 환상이므로 분할.

| 분류          | 필드                                                                                                                    |   임계    |
| :------------ | :---------------------------------------------------------------------------------------------------------------------- | :-------: |
| **invariant** | node_ids, edge_dependency_graph, formula_AST_hash, ontology_registry_match, constants_canonical_form, section_hierarchy | 100% 동일 |
| **tolerable** | raw_line_breaks, ocr_normalized_whitespace, vision_corrected_text                                                       | ≤ 5% 변동 |

## 근거

- contract.yaml AC-PA-1, AC-PA-2 (`docs/engines/parser/contract.yaml`)
- v3.0 Vol XV.3 #1 (Property Test 의무)
- Engine Hardening Roadmap v1.1 §0.5 B-1 (invariant 분리)
- Review B-1 (재현성 1.0 환상 해체)

---

## 대상 파일

### 신규

- `packages/parser/__tests__/determinism.property.test.ts` — fixture PDF 5종 100회 반복
- `packages/parser/__fixtures__/batch1/` — 5종 fixture PDF (이미 존재 시 재활용 검토)
- `packages/parser/src/normalizer.ts` — `extractInvariantFields()` `extractTolerableFields()` 함수
- `packages/parser/src/__tests__/normalizer.test.ts` — 정규화 함수 단위 테스트

---

## Normalizer 설계

```typescript
// packages/parser/src/normalizer.ts
export interface InvariantSnapshot {
  node_ids: string[]; // sorted
  edge_dependency_graph: string; // serialized DAG (canonical form)
  formula_AST_hashes: Record<string, string>; // formula_id → SHA-256
  ontology_registry_match: boolean; // 모든 ID가 registry에 존재
  constants_canonical_forms: Record<string, string>; // canonical_value + unit
  section_hierarchy: string; // sorted JSON tree
}

export interface TolerableSnapshot {
  raw_line_break_count: number;
  whitespace_density: number; // 페이지당 공백 비율
  vision_corrected_segments: string[];
}

export function extractInvariantFields(contract: KnowledgeContract): InvariantSnapshot;
export function extractTolerableFields(contract: KnowledgeContract): TolerableSnapshot;
export function compareInvariant(a: InvariantSnapshot, b: InvariantSnapshot): 'equal' | 'differs';
export function compareTolerable(
  a: TolerableSnapshot,
  b: TolerableSnapshot,
): { variance: number; passed: boolean };
```

---

## Test Strategy

### 1. Invariant 100% Property Test (AC-PA-1)

```typescript
import fc from 'fast-check';
import { extractPdf, splitSections, validateKnowledgeContract } from '../src';
import { extractInvariantFields, compareInvariant } from '../src/normalizer';

const fixtures = [
  '__fixtures__/batch1/jejae_1pg.pdf',
  '__fixtures__/batch1/jejae_section_5pg.pdf',
  '__fixtures__/batch1/formula_definition.pdf',
  '__fixtures__/batch1/table_extraction.pdf',
  '__fixtures__/batch1/mixed_image_text.pdf',
];

for (const fixturePath of fixtures) {
  test(`parser invariant determinism — ${fixturePath} (100 iterations)`, async () => {
    const pdfBytes = readFileSync(fixturePath);
    const contracts: KnowledgeContract[] = [];
    for (let i = 0; i < 100; i++) {
      const contract = await runFullPipeline(pdfBytes);
      contracts.push(contract);
    }
    const baseline = extractInvariantFields(contracts[0]);
    for (let i = 1; i < 100; i++) {
      const current = extractInvariantFields(contracts[i]);
      expect(compareInvariant(baseline, current)).toBe('equal');
    }
  });
}
```

### 2. Tolerable ≤ 5% Property Test (AC-PA-2)

```typescript
test(`parser tolerable variance — ${fixturePath} (100 iterations, ≤ 5%)`, async () => {
  // ... 100회 실행 후 tolerableSnapshot 수집
  const baseline = extractTolerableFields(contracts[0]);
  let totalVariance = 0;
  for (let i = 1; i < 100; i++) {
    const current = extractTolerableFields(contracts[i]);
    const result = compareTolerable(baseline, current);
    totalVariance += result.variance;
  }
  const avgVariance = totalVariance / 99;
  expect(avgVariance).toBeLessThanOrEqual(0.05); // ≤ 5%
});
```

### 3. Schema Violation Property Test (AC-PA-3, AC-PA-4)

| 시나리오                          | 검증                             |
| :-------------------------------- | :------------------------------- |
| ontology-registry.json 외 ID 생성 | `SCHEMA_INVALID_NODE_ID` throw   |
| Broken edge reference             | `SCHEMA_BROKEN_REFERENCE` throw  |
| Duplicate node ID                 | `SCHEMA_DUPLICATE_NODE` throw    |
| Invalid edge type                 | `SCHEMA_INVALID_EDGE_TYPE` throw |

각 시나리오 50회 무작위 입력으로 차단 검증.

---

## 위험 분석

| 위험                                                           | 완화                                                                   |
| :------------------------------------------------------------- | :--------------------------------------------------------------------- |
| Fixture PDF 5종이 ThePick 자료 다양성을 대표 못함              | Phase 1 후반 (BATCH-3 시점) fixture 추가 — 현재는 BATCH-1 fixture 활용 |
| Tolerable 임계 5%가 실제 PDF 노이즈보다 엄격                   | 100회 반복 후 실측 → 필요 시 contract.yaml 임계 갱신 (ADR 트리거)      |
| pdfplumber Python subprocess 느림 (fixture × 100 = 500회 호출) | 1) 캐싱 적용, 2) numRuns 50으로 축소 검토, 3) CI 환경에서만 100회 실행 |
| Vision OCR 결과 비결정성 (Phase 3)                             | 본 plan 시점엔 Vision 미사용 — `vision_corrected_segments` 빈 배열     |
| `extractInvariantFields()` 자체 결함 (예: ID 정렬 누락)        | `normalizer.test.ts` 별도 검증                                         |

---

## 검증 계획 (Acceptance Criteria)

### AC-PA-1: Invariant 100%

- 5 fixture × 100 iterations = 500 시나리오
- 모든 시나리오에서 `compareInvariant(baseline, current) === "equal"`

### AC-PA-2: Tolerable ≤ 5%

- 5 fixture × 100 iterations
- 평균 분산 ≤ 5% (각 fixture별)

### AC-PA-3: ontology Lock 위반 차단

- 50 시나리오 모두 `SCHEMA_INVALID_NODE_ID` throw

### AC-PA-4: broken edge 차단

- 50 시나리오 모두 `SCHEMA_BROKEN_REFERENCE` throw

### Coverage

- `packages/parser/src/schema-validator.ts` — 100%
- `packages/parser/src/normalizer.ts` (신규) — 100%

---

## 롤백 전략

- 새 test/fixture 파일 삭제
- `normalizer.ts` 삭제 (사용처 없음 — 신규)
- 기존 schema-validator/ontology-registry는 보존

---

## 승인 기록

- 의존성: contract.yaml AC-PA-1/2/3/4 정의 → 본 plan 구현
- 진산님 승인: 2026-04-27 Engine Hardening Roadmap v1.1

---

## 의존성

- **Blocked by:** Step 6 (parser contract.yaml — 완료)
- **Blocks:** Step 18 (자동 검증 스크립트)
- **참조:** Review B-1, contract.yaml `build_reproducibility` 분할

---

## 작업 추정

- 낙관: 1d (fixture 재활용 + normalizer 작성)
- 현실: 1.5d (×1.5 — Python subprocess 통합 디버깅 + 임계 조정)
- 비관: 2d

### v1.1 실측 (Step 14a 본 세션)

- 14a 본 세션 실측: ≈ 0.4d (3시간) — normalizer.ts (180 LOC) + normalizer.test.ts (23 tests) +
  determinism.property.test.ts (3 tests, 50 PDF iter + 100 schema 시나리오 = 24.7초) +
  fixture 1종 복사 + contract.yaml v0.2 + plan v1.1 갱신.
- 14b 추정 (LLM 통합 직후): ≈ 0.6d~0.9d (fixture 4종 + iterations 100 복원 + 8 ValidationErrorCode
  확장 + AC-PA-2 tolerable + invariant 4/6 추가 + index.ts export + ParserOutput 위치 재평가).

---

## 14b 진입 게이트 (의무)

Phase 1 후반 LLM 통합 (apps/batch batch-processor 활성 + DEFCON L3 격상) 직전 다음 항목 일괄 진행.
이 게이트를 통과하지 않은 채 LLM 통합을 진행하면 normalizer 의 결정성 hole 이 silent regression 으로
누적된다.

1. **fixture 4종 추가**: jejae_1pg / jejae_section_5pg / formula_definition / table_extraction /
   mixed_image_text — 교재 다양성 (표/이미지/법령/산식) 반영
2. **PIPELINE_ITERATIONS 50 → 100 복원** (contract.yaml AC-PA-1.iterations 정합)
3. **invariant 4/6 추가 검증** — node_ids / edge_dependency_graph / formula_AST_hashes /
   constants_canonical_forms (LLM 출력 합성 contract 입력)
4. **AC-PA-2 tolerable ≤ 5% property test 활성** — fixture 5종 × 100 iter
5. **AC-PA-3/4 ValidationErrorCode 8종 확장**: INVALID_EDGE_TYPE / DUPLICATE_NODE_ID /
   INVALID_TRUTH_WEIGHT / INVALID_FORMULA_ID / INVALID_CONSTANT_ID / INVALID_CONSTANT_CATEGORY /
   MISSING_REQUIRED_FIELD / MISSING_SOURCE_PAGE
6. **AC-PA-4 7 prefix 확장**: F-/INS-/CROP-/TERM-/LAW-/INV-/CONCEPT- dangling
7. **normalizer.ts → packages/parser/src/index.ts 일괄 export** — 14a 보류분 흡수
8. **canonicalizeVariablesSchema 회귀 시점**: LLM 출력 객체 입력에서도 결정성 유지 검증
   (14a 가 string mock 으로만 검증)
9. **Section.body invariant 포함 여부 결정**: 현재 hierarchy 메타 (level/heading/startPage/endPage/
   children) 만 — body 변동이 검출되지 않는 것이 의도인지 14b 시점 재평가
10. **ParserOutput 타입 위치 재평가**: 현 normalizer.ts vs 신규 parser-output.ts 분리 vs
    schema-validator 옆 — batch-processor output 통합 시점에 결정
