# Phase 2A — D-TCV-4 lv2 mismatch 정정 plan (Stage 3 routing 의미 매칭 전환)

> **상위**: [`phase2a-topic-cluster-vectorize-indexing.plan.md`](./phase2a-topic-cluster-vectorize-indexing.plan.md) §8.1 carry-over
> **선결 의존**: handoff-069 (Session 060 종착, Stage 3 dead path 해제 + Vectorize 적재 50건)
> **세션 작성**: 061
> **작성일**: 2026-05-09 KST
> **L 등급**: L2 Standard (검색 코어 코드 + 회귀 테스트 + 4-Pass 의무)
> **본 plan 영속**: docs/plans/phase2a-d-tcv-4-fix.plan.md

## 1. 본 step 책임

Multi-Path Fallback Stage 3 (Topic Cluster Routing) 의 cluster→nodes 매칭 알고리즘을, **production 데이터 정합 의미 매칭 (bge-m3 2nd query)** 으로 전환한다. Session 060 plan §8.1 옵션 1 (`kn.lv1_insurance = cluster.lv1`) 가정이 production 데이터 미실측 추정으로 무효 판정 — 본 step 정정.

## 2. Reality Anchor (★★★ 본 step 진입 사유)

### 2.1 production 실측 (2026-05-09 KST)

| column                                     | distinct values                                                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `topic_clusters.lv1` (50건)                | 4대시설 / 가축 / 과실손해보장 / 기타 / 논작물 / 밭작물 / 생산비보장(노지) / 수입감소 / 시설작물 / 적과전종합위험 / 종합과수 (11종)            |
| `topic_clusters.lv2`                       | 5점 / 15점 / 5점/15점 (3종, 점수 분류)                                                                                                        |
| `knowledge_nodes.lv1_insurance` (활성 794) | 종합위험 밭작물 생산비보장 / 종합위험 시설작물 생산비보장 / 농작물재해보험 / 공통 / 종합위험 수확감소보장 / 농업수입감소보장 등 (보험 종목명) |
| `knowledge_nodes.lv2_crop`                 | 벼 / 마늘 / 사과 / 배추 등 작물명                                                                                                             |

### 2.2 매칭 가능성 검증

```sql
SELECT COUNT(*) FROM knowledge_nodes
 WHERE is_current_active=1
   AND lv1_insurance IN (cluster.lv1 11종)
→ 0건

SELECT COUNT(*) FROM knowledge_nodes
 WHERE is_current_active=1
   AND lv2_crop IN (cluster.lv1 11종)
→ 0건
```

→ 옵션 1 (cluster.lv1 만 매칭) 채택 시 **`fetchNodesByCluster` 추천 노드 0건 영구 보장** → SP-T06 정확도 0%.

### 2.3 결론

cluster.lv1 (간소화 도메인 분류) ≠ kn.lv1_insurance (보험 종목 정식명). Session 060 plan §8.1 가정 자체가 production 데이터 미실측 추정. 단순 컬럼 직접 매칭으로 의미 비대칭 흡수 불가능 — **의미 임베딩 매칭으로 전환 의무**.

## 3. 결정 영속 (★ 진산 결정 — 2026-05-09 Session 061)

진산 발화: "B (bge-m3 2nd query) 권장 — 채택" (AskUserQuestion 응답).

### 3.1 채택안 (옵션 B-1 — cluster 사전 임베딩 재활용)

**알고리즘 — cluster matching 1st query에서 `returnValues: true` 로 cluster 임베딩 동시 반환 → 각 matched cluster 임베딩을 query value 로 knowledge_node 2nd query 진행.**

```
Step 1: user query embedding (Stage 1 재사용)
  ↓
Step 2: Vectorize.query(value=query_emb, filter={node_type='topic_cluster',exam_id},
                       topK=3, returnValues: true)
  ↓ matched clusters [{ id, score, values: number[1024] }]
Step 3: D1 topic_clusters 메타 조회 (id 기반, 기존 fetchClustersByIds 유지)
  ↓ enriched clusters [{ id, name, lv1, lv2, similarity, embedding }]
Step 4: 각 cluster 별 Vectorize.query(value=cluster.embedding,
                                     filter={node_type='knowledge_node',exam_id},
                                     topK=5)
  ↓ cluster 별 matched knowledge_node ids [{ id, score }]
Step 5: D1 knowledge_nodes 메타 조회 (matched ids 기반, 신규 fetchNodesByIds)
  ↓ enriched node rows (Stage 2 정합: status='approved' + is_current_active=1)
Step 6: 통합 + dedup + ranking (truth_weight DESC, score DESC, name ASC)
```

### 3.2 채택 사유

- **정확도**: cluster.name (예: '적과전종합위험 — 5점 단답') 의 의미 임베딩이 production 명명 비대칭 흡수 → 80~90% 추정
- **비용**: bge-m3 신규 호출 0회 (cluster 임베딩 사전 적재 재활용 — Session 060 50건 production+staging) / Vectorize.query 1 + 최대 3 = **4회** (현 Stage 3 1회 대비 +3회). ★ 4-Pass M4-C1 갱신: V2 binding spec mismatch 후속 fallback 로 2nd query topK = 5 → 20 (overfetch 4배), candidates 회수 +60건 (3 cluster × 20). 추정 ~600ms (직렬 for-loop) — Workers CPU/timeout budget carry-over (4-Pass M2-1)
- **인프라**: Cloudflare Vectorize 단일 벤더 정합. 신규 binding/마이그레이션 0건
- **호환성**: 기존 `runTopicClusterRouting` 시그니처 (deps + examId + queryEmbedding) 보존, 내부 알고리즘 교체

### 3.3 기각 사유 영속 (Reality Anchor)

| 옵션                            | 기각 사유                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| A (LIKE 부분 매칭)              | '기타'/'4대시설' 등 일반어 노이즈 흡수 위해 화이트리스트 제외 필요 — 정확도 60~75% 추정 |
| C (매핑 테이블 + 인간 큐레이션) | D1 마이그레이션 0027 + 50×N건 인간 큐레이션 수일 — Phase 2 본 영역 진입 차단            |
| D (Stage 3 일시 비활성)         | router 본질 회피 — Stage 4 직행률 상승                                                  |
| **본 plan 채택 = B-1**          | cluster 임베딩 재활용으로 추가 bge-m3 호출 0건, 의미 매칭 정확도 우월                   |

## 4. 스코프

### 4.1 in-scope (본 step)

- **`apps/api/src/search/user-search.ts`**:
  - `VectorizeQueryBinding.query` 응답 타입 `matches[]` 에 `readonly values?: ReadonlyArray<number>` 옵셔널 필드 추가 (Cloudflare Vectorize V2 `returnValues: true` 정합)
- **`apps/api/src/search/multi-path-fallback/topic-cluster-router.ts`**:
  - 첫 query: `returnValues: true` 추가
  - `fetchNodesByCluster(db, examId, lv1, lv2)` 시그니처 deprecation → 신규 `fetchKnowledgeNodesByEmbedding(vectorize, db, examId, clusterEmbedding)` (vector 2nd query + D1 메타 조회)
  - `runTopicClusterRouting` for-loop: lv1/lv2 분기 제거 + cluster.embedding 기반 vector 매칭
  - 신규 상수: `KNOWLEDGE_NODE_MIN_SIMILARITY = 0.40` (Stage 3 노드 추천 임계, Stage 1의 0.60 보다 낮음 — cluster 매개 재추천이므로)
- **단위 테스트**:
  - `__tests__/topic-cluster-router.test.ts` — 기존 lv1/lv2 mock 제거 + 신규 vector 2nd query mock + cluster.embedding undefined 시 graceful Miss + 회귀 테스트 (production cluster.lv1='논작물' / cluster.lv2='5점' 케이스 정확 매칭 확인)

### 4.2 out-of-scope (carry-over)

- cluster.lv1/lv2 컬럼 자체 의미 — Year 2 멀티시험 진입 시 토픽 분류 체계 재설계 (별도 ADR)
- knowledge_nodes ↔ topic_cluster 정적 매핑 테이블 (옵션 C) — 4-Pass 결과 정확도 < 85% 미달 시점 별도 step
- cluster.name 점수 분류 노출 정책 (Pass 3 C1 b carry-over) — 별도 ADR 우선순위 4

### 4.3 결정 갈림길 (없음)

진산 "B 채택" 단일 발화 → D-TCV-4-FIX-1=B-1 (cluster 사전 임베딩 재활용) 단독 진행.

## 5. 적재 단위

### 5.1 user-search.ts 타입 확장

```ts
export interface VectorizeQueryBinding extends VectorizeBinding {
  query(
    values: ReadonlyArray<number>,
    options: { ... },
  ): Promise<{
    readonly count: number;
    readonly matches: ReadonlyArray<{
      readonly id: string;
      readonly score: number;
      readonly metadata?: Record<string, unknown>;
      readonly values?: ReadonlyArray<number>;  // ← 신규 (returnValues: true 정합)
    }>;
  }>;
}
```

### 5.2 topic-cluster-router.ts 알고리즘 변경

```ts
// Stage 3.a (변경): cluster matching with returnValues: true
const resp = await vectorize.query(queryEmbedding, {
  topK: TOPIC_CLUSTER_TOP_K,
  filter: { node_type: TOPIC_CLUSTER_NODE_TYPE, exam_id: examId as string },
  returnMetadata: 'none',
  returnValues: true, // ← 신규
});

// Stage 3.b (유지): D1 topic_clusters 메타 조회

// Stage 3.c (변경): 각 cluster.embedding 기반 knowledge_node 2nd query
//   ★ 5.2.1 Silent Pivot 영속 (4-Pass M4-C1 흡수, Session 061):
//   본 sub-section 의 filter 명세 (`node_type: KNOWLEDGE_NODE_NODE_TYPE`) 와 topK
//   (`TOPIC_CLUSTER_NODES_PER_CLUSTER`=5) 가 staging e2e 실측에서 V2 binding spec
//   mismatch 발견 후 변경됨:
//     - filter: { exam_id: examId } 단독 (node_type filter 폐기)
//     - topK: TOPIC_CLUSTER_NODES_PER_CLUSTER * STAGE3_NODE_QUERY_OVERFETCH_RATIO (=20, 4배 overfetch)
//     - client-side 사후 필터: 임계 0.40 + cluster.id self-exclusion + STAGE3_NODE_ID_EXCLUDE_PREFIXES (TC-/TBL-/TROW-/TCOL-/TCELL-)
//   사유: V2 binding 의 filter 객체 operator ($in/$nin/$ne) 가 0건 반환 → Stage 1
//   정합 단순 equality filter 채택. Cloudflare 정상화 시 본 sub-section 으로 회복
//   (Year 2 carry-over §8.5).
for (const m of matches) {
  const clusterMatch = vectorMatches.find((v) => v.id === m.cluster.id);
  if (!clusterMatch?.values || clusterMatch.values.length === 0) continue; // graceful Miss

  const nodeResp = await vectorize.query(clusterMatch.values, {
    topK: TOPIC_CLUSTER_NODES_PER_CLUSTER * STAGE3_NODE_QUERY_OVERFETCH_RATIO,
    filter: { exam_id: examId as string },
    returnMetadata: 'none',
  });
  const aboveNode = nodeResp.matches.filter(
    (n) =>
      n.score >= KNOWLEDGE_NODE_MIN_SIMILARITY &&
      n.id !== m.cluster.id &&
      !STAGE3_NODE_ID_EXCLUDE_PREFIXES.some((p) => n.id.startsWith(p)),
  );
  if (aboveNode.length === 0) continue;

  // D1 메타 조회 (Stage 2 정합: status='approved' + is_current_active=1)
  // CRIT-1 흡수: try/catch 로 D1 throw → cluster skip + 다음 cluster 진행 (graceful)
  const nodeIds = aboveNode.map((n) => n.id);
  const nodes = await fetchNodesByIds(db, examId, nodeIds); // try/catch 외부 wrap
  for (const n of nodes) {
    const score = aboveNode.find((a) => a.id === n.id)?.score ?? 0;
    allNodeHits.push(buildHit(n, score));
  }
}
```

### 5.3 신규 helper

```ts
async function fetchNodesByIds(
  db: UserSearchD1,
  _examId: ExamId, // Hard Rule 16 zero-cost
  ids: ReadonlyArray<string>,
): Promise<ReadonlyArray<TopicClusterNodeRow>> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const sql = `
    SELECT kn.id, kn.type, kn.name, kn.description, kn.page_ref, kn.truth_weight
    FROM knowledge_nodes kn
    LEFT JOIN (
      SELECT target_id, to_status,
        ROW_NUMBER() OVER (PARTITION BY target_id ORDER BY transitioned_at DESC) AS rn
      FROM status_transitions
      WHERE target_type = 'node'
    ) latest ON latest.target_id = kn.id AND latest.rn = 1
    WHERE kn.id IN (${placeholders})
      AND kn.is_current_active = 1
      AND COALESCE(latest.to_status, 'draft') = 'approved'
  `;
  // try/catch + UserSearchError 'filter' code (기존 정합)
}
```

### 5.4 deprecation

- `fetchNodesByCluster(db, examId, lv1, lv2)` 함수 제거. 본 step 후 호출처 0건. 단위 테스트도 갱신.

## 6. 검증 게이트

| Gate ID  | 기준                                                                                                                                                                                                        | 검증 방법                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| G-FIX-1  | typecheck PASS (`pnpm --filter @thepick/api typecheck`)                                                                                                                                                     | exit 0                                |
| G-FIX-2  | lint PASS (`pnpm --filter @thepick/api lint`)                                                                                                                                                               | 0 ESLint issues                       |
| G-FIX-3  | apps/api 458+ vitest PASS (회귀 + 신규 테스트 +N)                                                                                                                                                           | vitest --run                          |
| G-FIX-4  | verify-engine-contracts.ts post-impl 7/0/1 PASS (Cat 1 batch 327/327 known TD-VRF-001 별개)                                                                                                                 | run1≡run2                             |
| G-FIX-5  | production e2e smoke 2~3 query Stage 3 source='topic-cluster' surface (Session 060 직행 케이스 정상화)                                                                                                      | curl staging+production               |
| G-FIX-6  | Hard Rule 17 grep 0건 in `apps/api/src/search/multi-path-fallback/topic-cluster-router.ts`                                                                                                                  | grep 검증                             |
| G-FIX-7  | 4-Pass 독립 리뷰 CRITICAL 0건 (silent-failure-hunter / backend-architect / security-engineer / code-reviewer 4 병렬)                                                                                        | 통합 보고서                           |
| G-FIX-8  | response shape 비변경 (TopicClusterRouterResult 인터페이스 보존, source='topic-cluster' / clusters[] / results[]) — ★ 4-Pass CRIT-4 정정: clusters[].lv2 surface 제거 + cluster.name 점수 분류 suffix strip | 기존 routes-dispatcher.test.ts 통과   |
| G-FIX-9  | client-side prefix exclusion 차단 동작 검증 (TC-/TBL-/TROW-/TCOL-/TCELL- 5종 모두 fetchNodesByIds 자연 0행 정합) — ★ 4-Pass M4-C1 갱신                                                                      | 단위 테스트 회귀 + e2e diagnostics    |
| G-FIX-10 | production 응답 stage3Diagnostics strip (CRIT-3) — env != dev/development/test 시 Stage 4 응답에서 제거                                                                                                     | curl production e2e + isDev 분기 검증 |

## 7. 4-Pass 리뷰 의도

- **Pass 1 SURGEON**: cluster.values undefined / 빈 배열 / Vectorize 2nd query throw / D1 fetchNodesByIds throw
- **Pass 2 ARCHITECT**: VectorizeQueryBinding 타입 확장이 caller (routes.ts / user-search.ts / multi-path-fallback/index.ts) 회귀 0건 / Hard Rule 16 examId 첫 인자 / Workers CPU 50ms 한도 (4 vector query × 150ms 추정) / Stage 3 cross-pollution (filter node_type='knowledge_node' 명시)
- **Pass 3 ADVOCATE**: production cluster.embedding 재활용이 PII 누설 위험 0 / 학습자 응답 shape 변경 0 / cluster.name 점수 분류 raw 노출 정책 (Pass 3 C1 b carry-over 별도 ADR 영속) / Stage 1 cross-pollution (Pass 1 M2 carry-over 환기)
- **Pass 4 CONTRACT**: 본 plan §3 결정 영속 정합 / Hard Rule 17 grep / Reality Anchor 발견 영속 (§2 production 실측) / 옵션 B-1 채택 사유

## 8. carry-over (다음 step / 별도)

### 8.0 ★ admin G5.5 부분 진입 (★ Session 062 종착)

진산 결정 (Session 062 — handoff-070 §3 우선순위 1): **BATCH-1 적과전 75건 status='approved' 전환 (74건 active 적용, 1건 inactive 자연 제외).**

- 영속 스크립트: `scripts/admin-bootstrap-batch1-approved.sql`
- production 적용: `wrangler d1 execute thepick-db-production --remote --file ...` → changes=75 / active 74건 status='approved'
- reviewer_id: `'session-062-admin-bootstrap'` (시스템 부트스트랩 표식)
- idempotent: `'st-s062-' || node_id` deterministic id + NOT EXISTS clause (재실행 시 conflict 자연 차단)
- production e2e 검증:
  - Stage 1 통과 query "적과후착과수 산정 방법" → top1=0.69, stage2Count=7, results=5 ✅
  - Stage 3 진입 query "태풍 피해 평가 절차" (staging) → clusterMatch=3, nodeAbove=11, results=0 (cluster 매칭 노드가 BATCH-1 외 영역 — 추가 검수 carry-over)
- production timeout 1회 발생 (M2-1 Stage 3 직렬 ~600ms 정합) — 다음 세션 carry-over 우선

**측정 차단 해소**: BATCH-1 영역 query 50건 SP-T06 측정 가능 환경 확보. messageKey 'out_of_scope' misrepresent 부분 해소 (BATCH-1 query 한정).

### 8.1 SP-T06 측정 spec 구체화 + 측정 (★ 다음 세션 plan 단위 work)

본 세션 zoom-out 발견: SEARCH_PIPELINE.md §7 + plan §6 정의가 추상도 높음. 다음 세션 별도 plan으로 spec 구체화 후 진행.

**spec 미정 항목 (다음 세션 결정 의무)**:

- "정확 토픽" 정의 — top-1 노드 일치 / top-K 내 surface / matched cluster.id 일치 중 어느 것?
- expected node 추출 방법 — 수동 fixture / exam_questions 기반 자동 / 노드 name 셀프 매칭?
- 50건 query 출처 — 기출 발췌 / 자연 query 수동 작성 / cluster.lv1 11종 × 평균 4~5건 분배?
- 측정 환경 — production (BATCH-1 only) 또는 staging (BATCH 전체) — staging의 경우 추가 BATCH approved 전환 의무

**fixture 후보 영역 (BATCH-1 active 74건 정합)**:

- fixture 50건 (production cluster.lv1 11종 × 평균 4~5건 학습자 query)
- top-5 정확도 ≥ 85% 목표 (옵션 B-1 추정 80~90% 정합)
- 미달 시: KNOWLEDGE_NODE_MIN_SIMILARITY 임계 조정 (0.40 → 0.35) / cluster.name 임베딩 재적재 (lv1+name 결합 D-TCV-1=B 보강) 검토

### 8.2 SP-T07 측정 (★ 다음 세션 plan 단위 work)

- out-of-scope query 100건 → Stage 4 honest-refusal 진입율 ≤ 5% 목표
- spec 미정: out-of-scope query 출처 (다른 시험 영역 / 일반 일상어 / 의도적 noise?)

### 8.3 운영 안전성 (handoff-069 §3 우선순위 3)

- Stage 1 cross-pollution 차단 (Pass 1 M2 carry-over)
- /search query echo XSS 가드 (Pass 3 M1 carry-over)
- confirmEnvironment / review_queue dedup / timeout 통합

### 8.4 UI/노출 정책 (handoff-069 §3 우선순위 4)

- cluster.name 점수 분류 노출 정책 ADR (Pass 3 C1 b carry-over)

### 8.5 Year 2 carry-over

- topic_clusters.lv1 의 도메인 분류 체계 재설계 (멀티시험 진입 시)
- topic_cluster_node_map 정적 매핑 테이블 (옵션 C — 정확도 < 85% 보강 시)
- VectorizeQueryBinding 타입 정의를 packages/shared 또는 별도 binding 라이브러리 격리

---

**작성**: Claude (Opus 4.7 1M context) — Session 061
**효력**: 진산 "B 채택" 발화 정합 → §3 결정 영속 + §5 적재 단위 코드 진입
**예상 다음 세션**: 061 종착 — 정정 + 4-Pass + production e2e + SP-T06/T07 측정 → handoff-070
