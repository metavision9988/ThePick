# ADR-021: Adaptive Deduplication Threshold by Ontology Type

작성일: 2026-04-26
상태: Accepted
관련: ADR-014 (CBIV)
검토서 v2.1 §2 MR-4 (P0 Critical)

## Context

CBIV Stage 2 (의미 중복 감지) 의 단일 임계값 0.85 = **거짓 양성의 늪**.

손해평가사 도메인은 "비슷한 이름, 다른 의미" 가 흔함:

- `사과 낙엽률 산식 (F-04)` 과 `단감 낙엽률 산식 (F-06)` — 텍스트 99% 동일, 다른 산식
- 단일 0.85 임계값 → 모두 flag → 검수자 피로 누적 → 진짜 중복 놓침 (alert fatigue)

## Decision

**Ontology 타입별 Adaptive Threshold** + Constants 별도 정책 (exact-match).

### `ontology-registry.json` 확장

```json
{
  "node_types": {
    "LAW": { "deduplication_threshold": 0.88, "confusion_priority": "critical" },
    "FORMULA": { "deduplication_threshold": 0.95, "confusion_priority": "critical" },
    "INVESTIGATION": { "deduplication_threshold": 0.9, "confusion_priority": "high" },
    "INSURANCE": { "deduplication_threshold": 0.93, "confusion_priority": "high" },
    "CROP": { "deduplication_threshold": 0.97, "confusion_priority": "medium" },
    "CONCEPT": { "deduplication_threshold": 0.85, "confusion_priority": "medium" },
    "TERM": { "deduplication_threshold": 0.88, "confusion_priority": "low" }
  },
  "constants_dedup_policy": {
    "strategy": "exact_match",
    "fields": ["name", "valid_from", "valid_to"],
    "rationale": "Constants are exact-match domain — 임계값 무관"
  }
}
```

### CBIV Stage 2 적용

```typescript
const threshold = ontologyRegistry.node_types[newNode.type].deduplication_threshold;
const sameTypeExisting = existingNodes.filter(n => n.type === newNode.type);

for (const existing of sameTypeExisting) {
  const similarity = await cosineSimilarity(newNode.embedding, existing.embedding);
  if (similarity > threshold) {
    flags.push({ ..., recommendation: generateRecommendation(newNode, existing, similarity) });
  }
}

function generateRecommendation(a, b, sim) {
  if (sim > 0.99) return 'LIKELY_DUPLICATE — strongly recommend MERGE';
  if (sim > 0.97) return 'POSSIBLY_DUPLICATE — review carefully';
  return 'SIMILAR_BUT_DISTINCT — likely keep both';
}
```

### Constants 별도 정책

```typescript
// 같은 name + 겹치는 valid_from~valid_to + 다른 numeric_value → 충돌 (임계값 무관)
const conflicting = existingConstants.filter(
  (existing) =>
    existing.name === newConst.name &&
    timeRangeOverlaps(existing, newConst) &&
    existing.numeric_value !== newConst.numeric_value,
);
```

**Hard Rule 28**: 의미 중복 검증은 Ontology 타입별 적응형 임계값 사용. 단일 스칼라 임계값 사용 금지. Constants 는 임계값 무관 exact-match 정책.

## Consequences

### 긍정적

- False Positive 폭증 차단 — alert fatigue 회피
- True Positive 보장 (의도적 중복 100% flag)
- 도메인 본질 (FORMULA 0.95 vs CONCEPT 0.85) 시스템에 새김
- Year 2 plugin 추가 시 도메인별 임계값 자유 설정 가능

### Trade-offs

- ontology-registry.json 갱신 의무
- 임계값 튜닝 — 운영 후 실측 기반 조정 (적절성 검증)

### 테스트 기준

| ID       | 통과 기준                                              |
| :------- | :----------------------------------------------------- |
| CBIV-T02 | 7개 노드 타입별 임계값 정확 적용                       |
| CBIV-T10 | 사과 낙엽률 vs 단감 낙엽률 → flag 안 됨 (FORMULA 0.95) |
| CBIV-T11 | 의도적 중복 5건 (각 타입) → 100% flag                  |
| CBIV-T12 | Constants 임계값 무관 exact-match 100%                 |
