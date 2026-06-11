> ⚠️ **STALE 정정 캐비엇 (2026-06-11, design-audit RC-5 동기 — 전면 개정 전 임시 정본 표식)**
> 본 문서는 ADR-045(N-hop graph-walk) 이후 미개정 상태로 실코드와 3축에서 어긋난다:
> ① §6 코드 위치 `packages/content-build-engine/search/` → 실코드 = `apps/api/src/search/`
> ② §2-3 Concurrent Pipeline(Promise.all) → 실코드 = 순차 vector→fallback (`routes.ts:107-142`)
> ③ "재귀 CTE 금지" vow → 실코드 = WITH RECURSIVE 채택 (ADR-045 결재, `graph-walk/index.ts`)
> 또한 본문 §2~3 의 lexical/keyword 융합 서술(ADR-019)은 **미구현 스펙**이다 (실코드 = 순차 폴백 전용, 동시 fusion 0건) (S5-8 plan D안 비교군 — 결재 #7/#8).
> 실코드와 충돌 시 **실코드가 정본**. 전면 개정 = ADR-045 정합화 별도 단위.

# Search Pipeline — Hybrid + Multi-Path + Concurrent 통합 명세 (v2.1)

> 운영 RAG 검색의 통합 명세. Rule 15 + 18 + 23 의 결합 흐름.
> 본 문서는 감사 보고서 R-4 + R-13 의 응답.
> 상위: [`CONTENT_BUILD_ENGINE.md`](./CONTENT_BUILD_ENGINE.md)

---

## 1. 본 모듈의 책임

학습자 질문 → 검증된 Knowledge Graph 노드 + 산식 + 출처 (`page_ref`) 의 답변.

3개 패턴 결합:

1. **3-Stage Hybrid Search** (Rule 15 / ADR-012) — 폐기 정보 노출 차단
2. **Multi-Path Fallback** (Rule 18 / ADR-015) — 단일 안내문 회피
3. **Concurrent Execution + Short-circuit** (Rule 23 / ADR-019) — Latency Waterfall 회피

---

## 2. 통합 흐름 (R-13 권고: Concurrent → Hybrid 분리)

```
[학습자 질문]
    ↓
┌─────────────────────────────────────────────────────────────────┐
│  Concurrent Pipeline (Promise.all + Short-circuit, Rule 23)      │
│   ├─ Vector Search    (Vectorize, ~150ms)                       │
│   ├─ Keyword Search   (D1 N-gram, ~50ms)                        │
│   └─ Topic Cluster    (zero-shot 분류, ~100ms)                  │
└─────────────────────┬───────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Race + Short-circuit + Threshold 분기 (Rule 18 진입)             │
│                                                                  │
│  - 키워드 exact match (confidence > 0.95)                        │
│      → 100ms 이내 즉시 반환 (Stage 2 keyword-fast)               │
│                                                                  │
│  - Vector ≥ 0.75                                                 │
│      → Hybrid 3-Stage 진입 (정상 경로, Rule 15)                  │
│                                                                  │
│  - Vector 0.60~0.75                                              │
│      → Hybrid + Keyword 결합 (가장 안전한 답변)                   │
│                                                                  │
│  - Vector < 0.60                                                 │
│      → Multi-Path Fallback (Rule 18)                            │
│                                                                  │
│  - 모두 fail (800ms timeout)                                     │
│      → Honest Refusal (검수 큐 자동 기록)                         │
└─────────────────────┬───────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Hybrid 3-Stage (Rule 15 / ADR-012) — Vector ≥ 0.60 인 경우만    │
│                                                                  │
│  Stage 1: Vector Recall                                          │
│   └─ top-K=20, similarity ≥ 0.60                                 │
│                                                                  │
│  Stage 2: Graph Hard Filter (ADR-013, Rule 16)                   │
│   ├─ WHERE is_current_active = 1                                 │
│   ├─ AND status = 'approved'                                     │
│   ├─ AND exam_id = ?                                             │
│   └─ AND (valid_from IS NULL OR valid_from <= today)             │
│                                                                  │
│  Stage 3: Truth Weight Re-rank                                   │
│   └─ LAW=10 > FORMULA=8 > INVESTIGATION=7 > CONCEPT=5            │
└─────────────────────┬───────────────────────────────────────────┘
                      ▼
[answer with page_ref + revision_change_id]
```

---

## 3. Concurrent Execution + Short-circuit (Rule 23)

### 3.1 구현 패턴

```typescript
// packages/content-build-engine/search/concurrent-pipeline.ts

export async function concurrentSearch(query: string, examId: string): Promise<SearchResult> {
  const [vectorPromise, keywordPromise, topicPromise] = [
    runVectorSearch(query, examId),
    runKeywordSearch(query, examId),
    runTopicCluster(query),
  ];

  return new Promise((resolve) => {
    let resolved = false;

    // Short-circuit: 키워드 exact match → 100ms 조기 반환
    keywordPromise.then((b) => {
      if (!resolved && b.confidence > 0.95 && b.exactMatch) {
        resolved = true;
        resolve({ source: 'keyword-fast', ...b });
      }
    });

    // 모든 결과 도착 후 분기
    Promise.all([vectorPromise, keywordPromise, topicPromise]).then(([a, b, c]) => {
      if (resolved) return;
      resolved = true;
      resolve(routeBest(a, b, c, examId));
    });

    // Safety timeout: 800ms
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ source: 'timeout-refusal' });
      }
    }, 800);
  });
}

function routeBest(
  a: VectorResult,
  b: KeywordResult,
  c: TopicResult,
  examId: string,
): SearchResult {
  if (a.similarity >= 0.75) {
    return runHybrid3Stage(a, examId); // Stage 1 정상 경로
  }
  if (a.similarity >= 0.6 && b.matched) {
    return combineHybridAndKeyword(a, b, examId);
  }
  if (b.matched) {
    return { source: 'multi-path-keyword', ...b, warning: 'low_vector_confidence' };
  }
  if (c.classified) {
    return { source: 'multi-path-topic', ...c };
  }
  return { source: 'honest-refusal' };
}
```

---

## 4. Hybrid 3-Stage (Rule 15)

```typescript
// packages/content-build-engine/search/hybrid-pipeline.ts

export async function runHybrid3Stage(
  vectorResult: VectorResult,
  examId: string,
): Promise<SearchResult> {
  // Stage 1: Vector Recall (이미 완료)
  const candidateIds = vectorResult.candidates.map((c) => c.id);

  // Stage 2: Graph Hard Filter (Rule 16, ADR-013)
  const filtered = await db
    .select()
    .from(knowledgeNodes)
    .where(
      and(
        inArray(knowledgeNodes.id, candidateIds),
        eq(knowledgeNodes.examId, examId),
        eq(knowledgeNodes.isCurrentActive, 1), // ★ Rule 16
        eq(knowledgeNodes.status, 'approved'),
        or(isNull(knowledgeNodes.validFrom), lte(knowledgeNodes.validFrom, today())),
      ),
    );

  // Stage 3: Truth Weight Re-rank
  const reranked = filtered.sort((a, b) => {
    if (a.truthWeight !== b.truthWeight) return b.truthWeight - a.truthWeight;
    // 동일 weight 내 vector similarity 보존
    const simA = vectorResult.candidates.find((c) => c.id === a.id)?.similarity ?? 0;
    const simB = vectorResult.candidates.find((c) => c.id === b.id)?.similarity ?? 0;
    return simB - simA;
  });

  return {
    source: 'hybrid-3stage',
    nodes: reranked.slice(0, 3), // top-3 (운영 RAG)
    pageRefs: reranked.map((n) => n.pageRef),
  };
}
```

---

## 5. Multi-Path Fallback (Rule 18)

Vector < 0.60 시 진입.

```typescript
// packages/content-build-engine/search/multi-path-fallback.ts

// Stage 1 Vector Search 가 이미 0.60 미만 → 다음 단계로
// Stage 2 Keyword Match: kkma/khaiii 형태소 분석
//   - 매칭 시: 노드 + 인접 SUBGRAPH + "유사 토픽일 수 있습니다" 안내
// Stage 3 Topic Cluster Routing: zero-shot 분류
//   - 분류 시: "BATCH-1 (적과전) 영역 같습니다. 관련 산식 5개 보기" + 영역 노드 목록
// Stage 4 Honest Refusal:
//   - 검수 큐 자동 기록 (Hard Rule 21)
//   - "이 질문은 손해평가사 범위 밖일 수 있습니다."
```

---

## 6. 코드 위치

```
packages/content-build-engine/search/
├── concurrent-pipeline.ts      # Rule 23 (Concurrent + Short-circuit)
├── hybrid-pipeline.ts          # Rule 15 (3-Stage Hybrid)
├── stages/
│   ├── vector-recall.ts        # Stage 1 (Vector ≥ 0.60)
│   ├── graph-filter.ts         # Stage 2 (is_current_active + exam_id, Rule 16)
│   ├── truth-rerank.ts         # Stage 3 (LAW > FORMULA > CONCEPT)
│   └── keyword-search.ts       # D1 N-gram 매칭
├── multi-path-fallback/        # Rule 18
│   ├── keyword-fallback.ts     # Stage 2
│   ├── topic-cluster-router.ts # Stage 3
│   └── honest-refusal.ts       # Stage 4
└── types.ts
```

Year 1: `packages/parser/src/search/` (코어 분산).
Year 2: `packages/content-build-engine/search/` (코어 추출).

---

## 7. 통합 테스트 기준

| ID     | 항목                       | 통과 기준                                    |
| :----- | :------------------------- | :------------------------------------------- |
| SP-T01 | Concurrent 동시 실행       | 50% percentile 200ms / 95% 500ms (Rule 23)   |
| SP-T02 | Short-circuit              | 키워드 exact match 시 100ms 이내             |
| SP-T03 | Hybrid Stage 2 (활성 필터) | top-K 에 `is_current_active=0` 0건 (Rule 16) |
| SP-T04 | Hybrid 26년 시나리오       | "손해정도비율" 질문 → CONST-901 (10%) 우선   |
| SP-T05 | Truth Weight 정렬          | LAW > FORMULA > CONCEPT 100% 준수            |
| SP-T06 | Multi-Path Stage 2         | 키워드 단독 50건 → 90%+ 정확 토픽            |
| SP-T07 | Multi-Path Stage 4 거부    | 정상 질문 → 거부율 < 5%                      |
| SP-T08 | Timeout 안전               | 800ms 초과 시 honest refusal 즉시            |
| SP-T09 | 격리 검증                  | exam_id A 질문 → exam_id B 노드 0건 반환     |
| SP-T10 | 출처 보존                  | 모든 결과에 page_ref 또는 revision_change_id |

---

## 8. 본 모듈의 무결성 (Vows)

- ❌ Vectorize 단독 결과 사용 (Rule 15)
- ❌ `is_current_active` 필터 누락 (Rule 16)
- ❌ 재귀 CTE 직접 사용 (Rule 16)
- ❌ 단일 안내문 폴백 (Rule 18)
- ❌ 순차 호출 폴백 (Rule 23)
- ❌ exam_id 누락 (멀티시험 격리 위반)
- ❌ page_ref / revision_change_id 누락된 결과 반환

본 무결성이 깨지면 **북극성 (생성물 신뢰성·정확성) 직접 위반** — 본 프로젝트 의미 0.
