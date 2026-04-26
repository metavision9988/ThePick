# ADR-019: Concurrent Execution + Short-circuit Pattern

작성일: 2026-04-26
상태: Accepted
관련: ADR-015 (Multi-Path Fallback)
검토서 v2.1 §2 MR-2 (P0 Critical)

## Context

ADR-015 의 4단계 폴백 (Vector → Keyword → Topic → Honest Refusal) 은 logical sequence 옳음. 하지만 implementation sequence 가 **재앙**:

- Vectorize 호출 (~150ms) + D1 키워드 검색 (~50ms) + 분류기 (~100ms) = 300ms+ (Latency Waterfall)
- 모바일 4G 환경에서 학습자 인지 한계 (200ms) 초과
- 응답 지연 누적 → 사용자 신뢰 즉사

## Decision

모든 RAG 폴백 경로는 **Promise.all 병렬 실행 + Short-circuit 조기 반환**.

```typescript
export async function concurrentSearch(query: string): Promise<SearchResult> {
  const [vectorPromise, keywordPromise, topicPromise] = [
    runVectorSearch(query),
    runKeywordSearch(query),
    runTopicCluster(query),
  ];

  return new Promise((resolve) => {
    let resolved = false;

    // Short-circuit: 키워드가 매우 강한 경우 (exact match) → 조기 반환
    keywordPromise.then((b) => {
      if (!resolved && b.confidence > 0.95 && b.exactMatch) {
        resolved = true;
        resolve({ source: 'keyword-fast', ...b });
      }
    });

    // 모든 결과 도착 후 최적 선택
    Promise.all([vectorPromise, keywordPromise, topicPromise]).then(([a, b, c]) => {
      if (resolved) return;
      resolved = true;
      resolve(selectBest(a, b, c));
    });

    // 안전 timeout: 800ms 초과 시 honest refusal
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ source: 'timeout-refusal' });
      }
    }, 800);
  });
}
```

**Hard Rule 26**: 모든 RAG 폴백 경로는 Concurrent Execution + Short-circuit 패턴 의무. 순차 호출 (Latency Waterfall) 금지.

## Consequences

### 긍정적

- 응답 시간 50% percentile 200ms 이내
- 응답 시간 95% percentile 500ms 이내
- 키워드 exact match 시 100ms 이내 조기 반환
- 모바일 사용자 신뢰 회복

### Trade-offs

- 호출당 비용 1.5~2배 증가 — Vectorize + D1 동시 호출
- Workers sub-request limit (50/request) 내 안전 (1 쿼리당 ≤ 5 호출)

### 테스트 기준

| ID      | 통과 기준                         |
| :------ | :-------------------------------- |
| MPF-T06 | 50% percentile 200ms / 95% 500ms  |
| MPF-T07 | 키워드 exact match 시 100ms 이내  |
| MPF-T08 | 800ms 초과 시 honest refusal 즉시 |
| MPF-T09 | 1 쿼리당 외부 호출 ≤ 5            |
