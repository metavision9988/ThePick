# Phase 2A — topic_clusters Vectorize 적재 (Stage 3 활성화) plan

> **상위**: [`SEARCH_PIPELINE.md`](../architecture/SEARCH_PIPELINE.md) §5 + [`ADR-015`](../adr/ADR-015-multi-path-fallback-pipeline.md) + [`phase2a-multi-path-fallback.plan.md`](./phase2a-multi-path-fallback.plan.md) §10
> **선결 의존**: handoff-068 (Multi-Path Fallback 4 모듈 + migration 0027 + 4-Pass 2회 흡수)
> **세션 작성**: 060 (handoff-068 §3 우선순위 1)
> **작성일**: 2026-05-08 KST
> **L 등급**: L2 Standard (기존 admin route 확장 + Vectorize 적재 + 영속 50건)
> **본 plan 영속**: docs/plans/phase2a-topic-cluster-vectorize-indexing.plan.md

---

## 1. 본 step 책임

handoff-068 §주의사항 "Stage 3 dead path 위험"을 해제한다. 현 production Vectorize 1227 vector는 모두 `knowledge_nodes`/`table_*` 메타이며 `node_type='topic_cluster'`는 0건 — Multi-Path Fallback Stage 3 (`runTopicClusterRouting`)이 영구 graceful Miss. 모든 graceful=true query가 Stage 4 honest_refusal 직행 → SP-T07 (거부율 ≤ 5%) 영구 위반 위험.

본 step에서 production D1의 `topic_clusters` 50건을 bge-m3 임베딩 후 Vectorize에 metadata `node_type='topic_cluster'` + `exam_id` 로 적재한다. 적재 후 Stage 3 활성화 + SP-T06/T07 측정 가능 상태 도달.

```
production D1 topic_clusters (50건)
    ↓ bge-m3 (1024d)
Vectorize index (1227 → 1277 vector, +50)
    ↓ filter: node_type='topic_cluster' + exam_id
Multi-Path Stage 3 활성화 (현 dead path 해제)
```

## 2. 스코프

### 2.1 in-scope (본 step)

- **`apps/api/src/vectorize/topic-cluster-fetcher.ts`** (NEW) — D1 topic_clusters → `NodeForVectorize` 변환
- **`apps/api/src/vectorize/routes.ts`** 확장 — `BOOTSTRAP_SOURCES` 에 `'topic_clusters'` 추가 + dispatcher 분기 (D-TCV-3=A 채택 시)
- **단위 테스트 +6 ~ +8** — fetcher (lv1/lv2/lv3 결합 + exam_id 자동 주입 + status 'approved' 고정 + truth_weight 매핑)
- **staging+production 실제 적재 실행** — `wrangler` 통한 admin endpoint 호출 또는 직접 binding 호출
- **vectorCount 정합** — staging+production 양쪽 1227 → 1277 (+50) 검증
- **Stage 3 e2e smoke** — production Multi-Path Fallback 가 graceful=true 시 source='topic-cluster' 응답 1건 이상 생성 (수동 query 1회)

### 2.2 out-of-scope (carry-over)

- **★ lv2 의미 mismatch 정정** (★★ Reality Anchor 발견): production `topic_clusters.lv2`는 **점수 분류** (`'5점'`/`'15점'`/`'5점/15점'`)이지 작물명이 아님. 현 `topic-cluster-router.ts:fetchNodesByCluster` 의 `kn.lv2_crop = ?` 매칭은 **의미 mismatch** (knowledge_nodes.lv2_crop은 작물명 '벼'/'마늘' 등). 본 step 후 별도 step에서 `fetchNodesByCluster` 정정 의무 (lv1만 매칭 또는 새로운 lv2_score 매핑 도입).
- **NodeType union 'TOPIC_CLUSTER' 추가** — Hard Rule 15 Year 1 한시 예외 확장 + ontology-registry v1.6.0 + ADR 별도. 본 step은 metadata.node_type='topic_cluster' string 만 적재 (NodeType union 미수정 — TRUTH_WEIGHTS lookup fallback 도입).
- **SP-T06/T07 측정 fixture** — 우선순위 2 별도 step.
- **dedup INSERT** — `review_queue` UNIQUE 제약은 별도 step (admin G5.5 진입 전).
- **Concurrent Execution + Short-circuit** (Rule 23 / ADR-019) — 우선순위 4 별도 step.
- **i18n key 등록** (`fallback.honest_refusal.out_of_scope`) — apps/web 작업 step 진입 시.

### 2.3 결정 갈림길 (★ 진산 보고 의무 — 권장진로순 진행 발화 정합 시 권장 기본값 채택)

| ID      | 항목                   | 옵션 A (권장 기본값)                                                                                                  | 옵션 B                                                                                       | 옵션 C                                                                         |
| ------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| D-TCV-1 | 임베딩 텍스트 구성     | **`cluster.name` 단독** — 이미 lv1+세부주제 결합 형태 ("적과전종합위험 — 5점 단답/계산"). 자연어 query 매칭 정합      | `lv1 + ' / ' + name` — lv1 강조 (도메인 라우팅 정확도 ↑ 가능)                                | `name + lv1 + lv2 + lv3` 결합 — 메타 풍부, 노이즈 ↑ ("5점" 임베딩 노이즈 우려) |
| D-TCV-2 | TRUTH_WEIGHTS 매핑     | **5 고정 (CONCEPT 수준 sentinel)** — NodeType union 미수정, lookup fallback 도입. Year 1 minimal change               | NodeType 'TOPIC_CLUSTER' 추가 + TRUTH_WEIGHTS 7 (라우팅 가중치) — ontology v1.6.0 + ADR 필요 | 0 (truth_weight 무관) — Vectorize metadata 보존만, ranking 영향 0              |
| D-TCV-3 | 적재 진입점            | **`BOOTSTRAP_SOURCES` 확장** — 기존 `/admin/vectorize/bootstrap` 라우트에 `source='topic_clusters'` 추가. 패턴 일관성 | 별도 endpoint `/admin/vectorize/bootstrap-topic-clusters` — 격리, 변경 0                     | 별도 batch script (Workers 외부) — 일회성, 운영자 가시성 ↓                     |
| D-TCV-4 | lv2 의미 mismatch 처리 | **본 step 보류 + plan §10 carry-over 영속** — 적재 + Stage 3 dead path 해제만. fetchNodesByCluster 정정 별도 step     | 본 step에서 fetchNodesByCluster 동시 정정 (lv1만 매칭) — 스코프 확대                         | Year 2 carry-over (Phase 4 ontology refactor 시점)                             |

**권장 조합**: D-TCV-1=A + D-TCV-2=A + D-TCV-3=A + D-TCV-4=A → 적재 단일 책임. lv2 mismatch는 발견 영속 후 별도 step (책임 분리 원칙).

**우려 보고 (Reality Anchor)**:

- **D-TCV-1 옵션 A 한계**: cluster.name이 "5점 단답/계산" 등 시험 메타 포함 → 학습자 query "낙엽률 산정"과 cosine similarity ≥ 0.50 매칭 불확실. SP-T06 측정에서 정확도 < 85% 미달 시 옵션 B (lv1 강조) 보강 의무.
- **D-TCV-2 옵션 A 한계**: TRUTH_WEIGHTS lookup fallback 코드 추가 — `topic-cluster-router.ts:buildHit`의 `TRUTH_WEIGHTS[row.type as NodeType]`가 undefined 시 row.truth_weight 사용 (현 구현). 본 step 영향 0 (적재 metadata 측만).
- **D-TCV-4 옵션 A 한계**: Stage 3 활성화 후에도 fetchNodesByCluster의 lv2_crop = '5점' 매칭은 production knowledge_nodes에 매칭 0건 보장 → cluster matching 후 results=[] 반환 → SP-T06 정확도 측정에서 cluster 매칭은 hit이지만 nodes 추천은 0건. 본 step의 1차 목표 (Stage 3 dead path 해제, source='topic-cluster' 응답 surface)는 달성. node 추천 정확도는 별도 step.

## 2.4 결정 영속 (★ 진산 결정 — 발화 "권장진로순 진행" 정합)

- **D-TCV-1**: **옵션 A** (cluster.name 단독)
- **D-TCV-2**: **옵션 A** (5 고정, NodeType union 미수정)
- **D-TCV-3**: **옵션 A** (BOOTSTRAP_SOURCES 확장)
- **D-TCV-4**: **옵션 A** (본 step 보류 + carry-over 영속)

진산 발화: "권장진로순 진행" (Session 060 entry).

---

## 3. 적재 단위

### 3.1 신규 모듈

**`apps/api/src/vectorize/topic-cluster-fetcher.ts`** (NEW):

```typescript
export async function fetchTopicClustersForVectorize(
  db: D1Database,
  examId: ExamId,
  pagination: { limit: number; offset: number },
): Promise<ReadonlyArray<NodeForVectorize>>;
```

- D1 SQL: `SELECT id, name, lv1, lv2, lv3, exam_frequency FROM topic_clusters WHERE COALESCE(is_covered, 1) = 1 ORDER BY id LIMIT ? OFFSET ?`
- text = `row.name` (D-TCV-1=A)
- metadata:
  - `node_id` = row.id (예: `'TC-001'`)
  - `node_type` = `'topic_cluster'` (★ Vectorize string metadata, NodeType union 미수정)
  - `status` = `'approved'` (topic_clusters에 status 컬럼 부재, 운영 데이터로 'approved' 고정)
  - `truth_weight` = `5` (D-TCV-2=A, CONCEPT 수준 sentinel)
  - `revision_year` = `0` (sentinel — topic_clusters 컬럼 부재)
  - `source_page` = `0` (sentinel)
  - `is_active` = `true`
  - `lv1_insurance` = row.lv1 (string | null) — 메타 보존 (Year 2 zero-cost)
  - `lv2_crop` = row.lv2 (★ ★ 의미 mismatch 영속 — '5점'/'15점' 등. D-TCV-4=A carry-over)
- exam_id는 `upsertNodesToVectorize`가 자동 주입 (Hard Rule 16/17 정합)

### 3.2 routes.ts 변경 (최소)

- `BOOTSTRAP_SOURCES` const에 `'topic_clusters'` 추가
- `fetchNodesBySource` switch에 `case 'topic_clusters': return fetchTopicClustersForVectorize(db, examId, pagination);` 추가
- `BootstrapBodySchema.refine` 정합: `status` 필터는 `knowledge_nodes`만 — `topic_clusters` 도 status 컬럼 부재 → refine 조건 그대로 (silent ignore 차단 정합)
- exhaustiveness check (`_exhaustive: never`) — TypeScript 컴파일 시 자동 검증

### 3.3 단위 테스트 (예상 +6~8)

`apps/api/src/vectorize/__tests__/topic-cluster-fetcher.test.ts` (NEW):

1. D1 mock 50건 → 50 NodeForVectorize 변환 정합 (id/text/metadata)
2. lv1/lv2/lv3 null 보존 (lv3가 null 시 metadata에 lv3 키 부재 — knowledge_nodes 패턴 정합)
3. is_covered=0 row 제외 (현 production 50건 모두 1, mock에서 검증)
4. examId 첫 인자 강제 (Hard Rule 16) — 빈 string throw
5. text = row.name 단독 (D-TCV-1=A) — name 빈 string throw 또는 fallback (TBD)
6. metadata.node_type = 'topic_cluster' 고정 + status='approved' 고정 + truth_weight=5 고정
7. metadata.lv2_crop = row.lv2 (★ '5점' 영속 — D-TCV-4 carry-over 명시 주석)
8. pagination.limit > 100 시 caller 책임 (upserter.ts MAX 100 정합)

`apps/api/src/vectorize/__tests__/routes-dispatcher.test.ts` (수정):

- BOOTSTRAP_SOURCES에 'topic_clusters' 포함 검증
- source='topic_clusters' POST 시 fetcher 호출 + upsertNodesToVectorize 호출 정합

### 3.4 staging+production 적재 실행 (Step 5)

1. **staging**:
   - `wrangler dev` 또는 staging deploy 후 `POST /admin/vectorize/bootstrap` body=`{examId: 'son-hae-pyeong-ga-sa', source: 'topic_clusters', limit: 50, offset: 0}`
   - 결과: `{fetched: 50, upserted: 50, skipped: 0, mutationId: '...', durationMs: ...}`
   - `wrangler vectorize info thepick-embeddings-staging` → vectorCount 1227 → 1277 검증
2. **production**: 동일 패턴 실행. vectorCount 1227 → 1277 검증
3. **e2e smoke**: production `POST /api/search` body=`{query: '낙엽률 산정', examId: 'son-hae-pyeong-ga-sa'}` → graceful=true OR top1<0.60 시 fallback 진입 → Stage 3 source='topic-cluster' 또는 Stage 4 'honest-refusal' surface 확인

---

## 4. ADR / 정합 검증

- **ADR-004** (bge-m3 1024d cosine) — 본 step 준수. 메타 schema 동일 (VectorizeUpsertMetadata).
- **ADR-007** 멀티시험 격리 (Hard Rule 16/17) — examId 자동 주입, 리터럴 0건.
- **ADR-008** graceful degradation — 본 step은 적재만, query 정책 변경 0.
- **ADR-015** Multi-Path Fallback (Hard Rule 18 + 21) — 본 step이 Stage 3 dead path 해제.
- **Hard Rule 16** (시험 경계 강제) — fetcher 시그니처 examId 첫 인자, Year 1 SQL 미반영 (Year 2 zero-cost).
- **Hard Rule 17** (EXAM_IDS 경유) — 신규 코드 리터럴 0건 (테스트 fixture 외).

---

## 5. Hard Rules 정합

- **Hard Rule 15** — 범용 분기 0건. fetcher는 손해평가사 특화 코드 0 (Year 2 멀티시험 진입 시 examId WHERE 절만 활성).
- **Hard Rule 16** — fetcher (`db, examId, pagination`) 시그니처 정합.
- **Hard Rule 17** — 본 step EXAM_IDS 경유 의무, 테스트 fixture 내 리터럴은 예외.
- **상용 품질** — any 0건, console.log 0건, TODO 0건, 빈 catch 0건, import \* 0건.
- **Workers 호환** — fs/path/node:\* 0건. D1 + Vectorize binding만.

---

## 6. Gates (binary 검증)

| Gate ID  | 기준                                                                                                                                                                                                                                                        | 검증 방법                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| G-TCV-1  | typecheck PASS (`pnpm --filter @thepick/api typecheck`)                                                                                                                                                                                                     | exit 0                                               |
| G-TCV-2  | lint PASS (`pnpm --filter @thepick/api lint`)                                                                                                                                                                                                               | 0 ESLint issues                                      |
| G-TCV-3  | 단위 테스트 +6~8 PASS (apps/api 447 → 453+)                                                                                                                                                                                                                 | vitest --run                                         |
| G-TCV-4  | staging Vectorize vectorCount 1227 → 1277 (+50)                                                                                                                                                                                                             | `wrangler vectorize info thepick-embeddings-staging` |
| G-TCV-5  | production Vectorize vectorCount 1227 → 1277 (+50)                                                                                                                                                                                                          | `wrangler vectorize info thepick-embeddings`         |
| G-TCV-6  | Hard Rule 17 grep 0건 in `apps/api/src/vectorize/topic-cluster-fetcher.ts`                                                                                                                                                                                  | grep 검증                                            |
| G-TCV-7  | e2e smoke: production graceful=true query 1건 fallback 응답에 fallback 필드 surface (source='topic-cluster' 또는 'honest-refusal') — Stage 3 hit 자체는 SP-T06 측정 carry-over (D-TCV-4 lv2 mismatch + cosine < 0.50 의심으로 본 step에서는 부분 PASS 허용) | 수동 curl 1회                                        |
| G-TCV-8  | verify-engine-contracts.ts 7/0/1 불변                                                                                                                                                                                                                       | post-impl run1≡run2                                  |
| G-TCV-9  | 4-Pass 독립 리뷰 CRITICAL 0건                                                                                                                                                                                                                               | 4 에이전트 병렬 + 통합 보고서                        |
| G-TCV-10 | response shape 비변경 (BOOTSTRAP_SOURCES 확장만)                                                                                                                                                                                                            | 기존 routes-dispatcher.test.ts 통과                  |

---

## 7. 4-Pass 리뷰 의도 (자동 트리거 — 적재 step도 L2)

- **Pass 1 SURGEON**: D1 throw / 임베딩 fail / Vectorize fail / 50건 한 번에 적재 (max 100 정합)
- **Pass 2 ARCHITECT**: BOOTSTRAP_SOURCES 확장 시 dispatcher exhaustiveness / topic-cluster-router.ts와 metadata schema 정합 (`node_type='topic_cluster'` 필수)
- **Pass 3 ADVOCATE**: production 쓰기 권한 / dryRun 옵션 보장 / 적재 실패 시 idempotent 재진입 / 학습자 노출 (Stage 3 hit 시 page_ref=0 sentinel surface — 안내 contract 확인)
- **Pass 4 CONTRACT**: plan §3 적재 단위 정합 / Hard Rule 17 grep / lv2 mismatch 발견 영속 (§10 carry-over) / D-TCV-1~4 결정 영속 정합

---

## 8. carry-over (다음 step / 별도)

### 8.1 본 step 발견 (Reality Anchor)

- **★★★ lv2 의미 mismatch 정정** (D-TCV-4=A carry-over):
  - 현 `apps/api/src/search/multi-path-fallback/topic-cluster-router.ts:235~276` `fetchNodesByCluster`가 `kn.lv2_crop = ?` 로 매칭하나 production cluster.lv2는 '5점'/'15점' (점수)이라 영구 매칭 0건 보장.
  - 정정 옵션:
    1. `cluster.lv1` 만 lv1_insurance 매칭 (cluster.lv2 무시 — 현재 가장 안전)
    2. cluster.lv2 → exam_questions 점수 필터로 분리 (스코프 확대)
    3. topic_clusters 스키마에 새 컬럼 (예: lv2_topic) 추가 (마이그레이션 필요)
  - 별도 step에서 옵션 결정 + 4-Pass 리뷰.

### 8.2 우선순위 2 (다음 step 의무)

- **SP-T06 fixture 50건 + 정확도 ≥ 85%** 측정 (handoff-068 우선순위 2)
- **SP-T07 fixture 100건 + 거부율 ≤ 5%** 측정

### 8.3 우선순위 3 (운영 안전성)

- review_queue dedup `INSERT ... ON CONFLICT(exam_id, query_hash)` UNIQUE 제약
- Stage 2/3/4 timeout 통합 (ADR-008 800ms)
- fallback path별 cost-aware rate-limit 분리

### 8.4 우선순위 4 (기능 확장)

- Concurrent Execution + Short-circuit (Rule 23 / ADR-019)

### 8.5 우선순위 5 (UI/통보)

- apps/web `fallback.honest_refusal.out_of_scope` i18n 키 + 한국어/영문 매핑
- reviewQueueId client 보관 + 검수 결과 통보 endpoint

### 8.6 Year 2 carry-over

- NodeType union 'TOPIC_CLUSTER' 추가 + ontology-registry v1.6.0 + ADR
- topic_clusters에 exam_id 컬럼 추가 (멀티시험 진입 시)
- TRUTH_WEIGHTS lookup safe-default (현 fallback `row.truth_weight` 으로 무사하나 명시 정합)

### 8.7 Session 060 4-Pass carry-over (CRITICAL 2 + MAJOR 1 + MINOR 2 즉시 흡수, MAJOR 8 + MINOR 8 carry-over)

**즉시 흡수 (본 step)**:

- Pass 2 ARCHITECT C1: `routes.ts:90-96` refine 메시지에 `(table_*/topic_clusters는 자체 status 컬럼 부재 — 자동 sentinel 'approved')` 명기
- Pass 3 ADVOCATE C1 (a): `apps/web/src/i18n/{types,locales/ko,locales/en}.ts` 에 `fallback.honest_refusal.out_of_scope` 키 등록 (ko 25자 + en 영문)
- Pass 4 CONTRACT M1: `topic-cluster-fetcher.ts` `TopicClusterRow` interface 에서 `exam_frequency`/`is_covered` 미사용 필드 제거 + SQL SELECT 절 정리
- Pass 1 SURGEON m1: `topic-cluster-fetcher.ts` `pagination.limit > VECTORIZE_UPSERT_MAX_BATCH_SIZE` 가드 추가 (table-fetcher 정합)
- Pass 1 SURGEON m2: 테스트 `'' as never` → `'' as unknown as ExamId` (ExamId 타입 변경 시 silent break 방지)

**carry-over (별도 step)**:

- **★★★ Pass 1 M1 / Pass 3 Mi1**: SP-T06 측정 후 정확도 < 85% 시 D-TCV-1=B (lv1 강조 또는 lv1+name 결합) 보강
- **Pass 1 M2**: Stage 1 vector 검색 cross-pollution 차단 — `node_type=knowledge_node` 화이트리스트 또는 `node_type != 'topic_cluster'` (별도 검색 필터 정책 step)
- **★★★ Pass 2 M1 / Pass 3 M3**: D-TCV-4 lv2 mismatch 정정 (`fetchNodesByCluster` lv1만 매칭 또는 metadata schema에 `lv2_topic` 추가) — **SP-T06 진입 전 의무 환기 (정확도 0% 위험)**
- **Pass 2 M2**: `topic-cluster-router.ts:280` `buildHit` 에 "topic_cluster sentinel과 무관 — knowledge_nodes 정상 lookup" 주석 1줄
- **Pass 2 M3**: plan §3.1 에 `lv3` 미적재 사유 (사용처 0건) 명기 또는 `VectorizeUpsertMetadata` 에 `lv3_subtopic?` optional 키 추가
- **Pass 3 C1 (b)**: cluster.name 점수 분류 노출 정책 (Stage 3 hit 시 학습자 응답에 `'5점'/'15점'` raw 노출 시 출제자 의도 누설 우려) — 별도 ADR
- **Pass 3 M1**: `/search` query echo XSS 가드 (Session 058 Pass 3 MAJ-A2 carry-over 영속, 별도 step 1주 내 흡수 의무 환기)
- **Pass 3 M2**: `routes.ts` body schema 에 `confirmEnvironment?: 'staging' | 'production'` 옵션 추가, `c.env.ENVIRONMENT !== confirmEnvironment` 시 400 reject
- **Pass 1 m3**: `routes-dispatcher.test.ts:415` upsert metadata 에 `is_active=true` / `revision_year=0` / `source_page=0` sentinel 단언 1줄 추가 (회귀 보호)
- **Pass 2 m1**: 상수 export 3종 (`TOPIC_CLUSTER_NODE_TYPE` / `_TRUTH_WEIGHT` / `_STATUS`) 의 router 공유성 vs fetcher 내부 전용성 분리 검토 (`vectorize/constants/topic-cluster.ts`)
- **Pass 2 m2**: `routes.ts:73-79` BOOTSTRAP_SOURCES 5종 비대칭 명시 주석 1줄 (knowledge_nodes 동적 vs topic_clusters 50건 fixed 등)
- **Pass 3 Mi2**: `reviewQueueId` 학습자 외부 노출 시 row 존재 추측 — 정보 leak 미미, PASS
- **Pass 3 Mi3**: `admin-token.ts` `timingSafeEqual` 길이 leak — `ADMIN_MIN_TOKEN_LENGTH=16` 강제로 영향 미미, PASS
- **Pass 4 m2**: 본 §6 G-TCV-7 부분 PASS 조건 plan 영속 (본 step 즉시 흡수)
- **Silent Pivot 보고**: ADMIN_API_TOKEN 회전이 plan 미명시 — 단순 운영 행위로 분류하나 향후 운영 행위 반복 가능성 고려 plan 또는 별도 ops checklist 에 "토큰 회전 시 영향 범위 점검 + carry-over 영속" 절차 추가 (Pass 4 반론)

---

**작성**: Claude (Opus 4.7 1M context) — Session 060
**효력**: 진산 "권장진로순 진행" 발화 정합 → §2.4 영속 + §3 적재 단위 코드 진입
**예상 다음 세션**: 060 종착 — 적재 + 4-Pass + Stage 3 활성 검증 완료 후 우선순위 2 (SP-T06/T07) 진입
