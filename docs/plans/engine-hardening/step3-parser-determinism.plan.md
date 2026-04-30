# Step 3 — parser 결정성 Property Test (invariant/tolerable 분리)

---

phase: 1
step: engine-hardening-step3
approved_by: TBD
risk_level: L2
scope:

- packages/parser/**tests**/determinism.property.test.ts (신규)
- packages/parser/**fixtures**/ (신규 디렉토리 — 5종 fixture PDF)
- packages/parser/src/normalizer.ts (신규 — invariant/tolerable 분리 로직)

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
