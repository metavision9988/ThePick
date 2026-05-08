# Phase 2A — Multi-Path Fallback (Rule 18 / ADR-015) 구현 plan

> **상위**: [`SEARCH_PIPELINE.md`](../architecture/SEARCH_PIPELINE.md) §5 + [`ADR-015-multi-path-fallback-pipeline.md`](../adr/ADR-015-multi-path-fallback-pipeline.md)
> **선결 의존**: handoff-068 (Phase 2A Step 3 user 검색 라우트 + Pass 3 M1+M2 흡수, 본 step 진입 시점 origin/main = b0beb2b)
> **세션 작성**: 059 (handoff-067 §3 우선순위 2)
> **작성일**: 2026-05-08 KST
> **L 등급**: L2 Standard (기능 확장, 새 모듈 + D1 마이그레이션 후보)
> **본 plan 영속**: docs/plans/phase2a-multi-path-fallback.plan.md

## 1. 본 step 책임

학습자 검색에서 **Stage 1 Vector Recall 실패 또는 Stage 2 Graph Filter 0건** (현 user-search.ts `gracefulDegradation: true`) 시점에서 단일 안내문 (ADR-008 graceful degradation) 으로 끝나지 않고, **Keyword/Topic 다중 경로 재시도** 후 **정직한 거부 (Honest Refusal) + 검수 큐 자동 기록** 까지 보강한다.

핵심 메시지: 운영 'approved' 0건 (production 현 상태) 또는 학습자가 구어체/신조어로 질의해도, 시스템은 무지를 무지로 응답하지 않고 다음 4단계를 거친다.

```
Stage 1 Vector Recall (≥0.60)        ← 본 step 입력 (이미 user-search.ts 적용)
    ↓ Miss (top-1 < 0.60 또는 stage2Count = 0)
Stage 2 Keyword/N-gram Match          ← 본 step 신규
    ↓ Miss
Stage 3 Topic Cluster Routing         ← 본 step 신규 (topic_clusters 50건 활용)
    ↓ Miss
Stage 4 Honest Refusal + 검수 큐 기록  ← 본 step 신규 (telemetry 활용 vs review_queue 신규 — D-MPF-3)
```

## 2. 스코프

### 2.1 in-scope (본 step)

- **multi-path-fallback 모듈** (apps/api/src/search/multi-path-fallback/) 신규:
  - `keyword-fallback.ts` — D1 N-gram/LIKE 기반 키워드 매칭 (Workers 호환 단순 구현, 형태소 분석기 없음)
  - `topic-cluster-router.ts` — bge-m3 임베딩 + topic_clusters 50건 매칭 (Cloudflare 단일 벤더 정합)
  - `honest-refusal.ts` — 거부 응답 + 검수 큐 기록 helper
- **routes.ts 통합**: graceful=true 시 fallback 자동 진입 (gracefulDegradation 응답 신호 활용)
- **Pass 2 MAJ-1 흡수** (Session 059 4-Pass carry-over): `c.set('queryDigest', ...)` Hono context 캐시 도입 (request 당 SHA-256 1회만)
- **단위 테스트**: keyword 매칭 / topic 라우팅 / 정직한 거부 / context 캐시 정합
- **통합 테스트** (SP-T06 + SP-T07): keyword 단독 90%+ 정확 토픽 / 거부율 < 5%
- **Hard Rule 16/17 zero-cost** 유지

### 2.2 out-of-scope (carry-over)

- **kkma/khaiii 형태소 분석기 도입** — Workers 미지원 (JVM/C++ 의존). 사전 빌드 단계 Python subprocess 로 inverted index 적재 후 D1 lookup 패턴 — Year 2 carry-over 또는 별도 ADR.
- **Concurrent Execution + Short-circuit** (Rule 23 / ADR-019) — 본 step 은 graceful=true 진입 후 순차 fallback (Stage 2 → 3 → 4). Concurrent + race 패턴은 별도 step.
- **review_queue 신규 D1 테이블** (D-MPF-3 결정에 따라):
  - 채택 시: 신규 migration + admin G5.5 검수 UI
  - 미채택 시: 기존 telemetry/engine_telemetry 활용 — 본 step 후순위 별도 step
- **응답 body `query` echo 정책** (Pass 3 MAJ-A2 carry-over) — 별도 ADR 의무. 본 step 진입 전 권장.
- **valid_from time-based effectivity** (Pass 4 C1, Session 058 carry-over) — Year 2.

### 2.3 결정 갈림길 (★ 진산님 보고 의무)

| ID      | 항목                                   | 옵션 A (권장 기본값)                                                                              | 옵션 B                                                                                   | 옵션 C                                                                    |
| ------- | -------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| D-MPF-1 | Stage 2 Keyword 매칭 알고리즘          | **D1 LIKE/substring 기반 단순 매칭** — Workers 즉시 가동, 형태소 의존 0, MVP 정합                 | bge-m3 reranking (vector top-K 후보 → query 키워드와 cross-encoder) — 비용 ↑ 정확도 ↑    | Python subprocess 빌드 시 형태소 inverted index — Year 2 (2.2 carry-over) |
| D-MPF-2 | Stage 3 Topic Cluster 매칭 데이터 소스 | **기존 `topic_clusters` 50건 + bge-m3 임베딩 매칭** — Vectorize 재활용, Cloudflare 단일 벤더 정합 | Workers AI bge-reranker-base — 새 binding, 비용 검토                                     | Claude Haiku zero-shot 분류 — 비용/지연 ↑                                 |
| D-MPF-3 | Stage 4 검수 큐 영속 위치              | **신규 `review_queue` D1 테이블 + migration 0027** — admin G5.5 와 통합, 명시적 큐                | 기존 `engine_telemetry` 활용 (gauge='honest_refusal') — migration 0건, 검수 UI 추가 작업 | console.error 만 (영속 X) — 임시 PoC, 운영 부적합                         |
| D-MPF-4 | 본 step 범위                           | **Stage 2 + 3 + 4 모두** — Multi-Path 의 정의 자체 (단일 step 가능 추정)                          | Stage 2 + 3 만 (Stage 4 별도 step) — review_queue 결정 대기                              | Stage 2 만 (Stage 3 + 4 별도 step) — 점진적 PoC                           |

**권장 조합**: D-MPF-1=A + D-MPF-2=A + D-MPF-3=A + D-MPF-4=A → 단일 step 으로 Stage 2/3/4 완성 + review_queue migration 0027 추가. PoC 가 아닌 운영 전제 구현.

**우려 보고 (Reality Anchor)**:

- D-MPF-1 옵션 A 의 한계: D1 LIKE 는 한국어 어미 변화 (조사/어절) 미대응. "낙엽률이 이상하게" → "낙엽률" 추출 필요. 단순 substring 으로는 정확도 70~80% 추정. 정확도 < 85% (SP-T06 기준) 미달 시 옵션 B 보강 의무.
- D-MPF-2 옵션 A 의 한계: topic_clusters 50건은 농학 역공학 단일 시험 (Hard Rule 15 Year 1 한시 예외). Year 2 멀티시험 진입 시 examId 필터 필수 — 본 step 에서 examId 컬럼 추가 검토.
- D-MPF-3 옵션 A 의 운영 비용: review_queue → admin G5.5 검수 UI → 검수자 워크플로우. 학습자 거부율 < 5% 가정 시 일 50~100 건 검수 — 인간 부담 가능.

## 2.4 결정 영속 (진산 결정 시 갱신)

- D-MPF-1: \_\_\_ (대기)
- D-MPF-2: \_\_\_ (대기)
- D-MPF-3: \_\_\_ (대기)
- D-MPF-4: \_\_\_ (대기)

---

## 3. 적재 단위

### 3.1 신규 모듈 (D-MPF-1=A + D-MPF-2=A + D-MPF-4=A 가정)

**`apps/api/src/search/multi-path-fallback/keyword-fallback.ts`** (NEW):

- `runKeywordFallback(deps, examId, query): Promise<KeywordFallbackResult>`
- D1 SQL: `WHERE knowledge_nodes.name LIKE ? OR description LIKE ?` (substring 매칭) + `is_current_active=1` + `status='approved'` + Stage 2 정합
- 의존성: `UserSearchD1` (재사용)
- Hard Rule 16: examId 첫 인자 강제

**`apps/api/src/search/multi-path-fallback/topic-cluster-router.ts`** (NEW):

- `runTopicClusterRouting(deps, examId, queryEmbedding): Promise<TopicClusterResult>`
- 입력: 이미 계산된 query 임베딩 (Stage 1 단계의 bge-m3 결과 재활용 — Pass 2 MAJ-1 정합)
- D1: topic_clusters 50건 전수 조회 (50건 정도면 in-memory 비교 충분)
- 비교: bge-m3 임베딩 cosine similarity → top-3 cluster + cluster 내 노드 (knowledge_nodes JOIN via lv1/lv2 매칭)
- 출력: `{ clusters: [{id, name, lv1, lv2, similarity}], nodes: [...] }`

**`apps/api/src/search/multi-path-fallback/honest-refusal.ts`** (NEW):

- `recordHonestRefusal(deps, examId, queryDigest, reason): Promise<void>` — 검수 큐 INSERT (D-MPF-3=A → review_queue, =B → engine_telemetry, =C → console.error)
- `buildHonestRefusalResponse(query, examId): UserSearchResult` — 응답 페이로드 (results=[] + gracefulDegradation=true + honestRefusal=true)

**`apps/api/src/search/multi-path-fallback/index.ts`** (NEW):

- `runMultiPathFallback(deps, ctx, examId, query, queryEmbedding): Promise<UserSearchResult>` — 4 단계 순차 진입 + 각 단계 Miss 시 다음 단계
- 응답에 `source: 'keyword-fallback' | 'topic-cluster' | 'honest-refusal'` 표기

### 3.2 routes.ts 통합

- `searchKnowledgeNodesForUser` 결과 `gracefulDegradation: true` 또는 `stage2Count: 0` 시 `runMultiPathFallback` 호출
- queryDigest Hono context 캐시 (Pass 2 MAJ-1 흡수): `c.set('queryDigest', ...)` 한 번만 계산 → fallback 내부 honest_refusal 기록에 재사용

### 3.3 user-search.ts 변경 (최소)

- `searchKnowledgeNodesForUser` 가 stage 1 임베딩을 응답에 surface (Multi-Path 가 재사용하기 위해) — 단, 내부 응답 인터페이스만 추가 (UserSearchResult public shape 변경 0)

### 3.4 D1 마이그레이션 0027 (D-MPF-3=A 채택 시)

```sql
-- migrations/0027_review_queue.sql
CREATE TABLE IF NOT EXISTS review_queue (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  query_hash TEXT NOT NULL,            -- 12-hex SHA-256 (Pass 3 M1 정합)
  query_length INTEGER NOT NULL,
  reason TEXT NOT NULL,                -- 'honest_refusal' / 'topic_uncertain' / 등
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,                     -- NULL = 미검수, NOT NULL = 검수 완료
  reviewer_id TEXT,
  reviewer_action TEXT                  -- 'add_keyword' / 'expand_topic' / 'out_of_scope' 등
);
CREATE INDEX IF NOT EXISTS idx_review_queue_unreviewed ON review_queue(reviewed_at) WHERE reviewed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_review_queue_exam ON review_queue(exam_id);
CREATE INDEX IF NOT EXISTS idx_review_queue_hash ON review_queue(query_hash);  -- 동일 query 그룹핑
```

---

## 4. 데이터 모델

### 4.1 활용 기존

- `topic_clusters` (50건, 농학 역공학) — Stage 3 Topic Cluster Routing
- `knowledge_nodes` (794건) + `status_transitions` — Stage 2 keyword 매칭 + 정합 필터
- Vectorize index `thepick-embeddings` (1227 벡터) — Stage 1 (이미 활용)
- bge-m3 임베딩 (1024d) — Stage 1 + Stage 3 재활용

### 4.2 신규 (D-MPF-3=A 채택 시)

- `review_queue` (위 schema)

### 4.3 결정 영향

- D-MPF-1=B (bge-m3 reranking) 시: topic_clusters 와 동일 cosine similarity 패턴 — 코드 재사용 가능
- D-MPF-3=B (engine_telemetry) 시: 새 gauge_name='honest_refusal' 추가, value=1 INSERT, metadata JSON 에 query_hash + reason

---

## 5. 단위 테스트 (예상 +20건)

### 5.1 keyword-fallback.test.ts

- LIKE 매칭 정확도 (단어 1개 / 2개 / 3개 조합)
- examId 격리 (Hard Rule 16)
- status_transitions JOIN 정합 (approved 만)
- 빈 query → throw (UserSearchError)
- 매칭 0건 → empty array

### 5.2 topic-cluster-router.test.ts

- bge-m3 임베딩 cosine similarity 정렬
- top-3 cluster + cluster 내 knowledge_nodes JOIN
- topic_clusters 0건 시 throw vs empty (정책 결정)
- examId 격리 (Year 2 멀티시험 가정 — 본 step examId 컬럼 미존재 시 무관)

### 5.3 honest-refusal.test.ts

- D-MPF-3=A: review_queue INSERT 정합 (query_hash + length + reason)
- 응답 페이로드 정합 (results=[] + honestRefusal=true)

### 5.4 multi-path-fallback/index.test.ts

- Stage 2 매칭 시 Stage 3 미진입
- Stage 2 Miss → Stage 3 매칭
- 모두 Miss → Stage 4 honest_refusal
- queryDigest context 재사용 (Stage 4 review_queue INSERT 시 새 hash 계산 X)

### 5.5 routes.test.ts (e2e 추가)

- gracefulDegradation 응답 → fallback 자동 진입
- Stage 2 매칭 시 source='keyword-fallback' 응답
- 모두 Miss → source='honest-refusal' 응답
- Hard Rule 17 grep 0건

---

## 6. 통합 테스트 (SEARCH_PIPELINE.md §7)

- **SP-T06**: 키워드 단독 50건 → 90%+ 정확 토픽 (D-MPF-1 옵션 A 정확도 측정)
- **SP-T07**: 정상 질문 100건 → 거부율 < 5% (Stage 4 honest_refusal 빈도)

본 step 에서 SP-T06/07 정확도 < 기준 시 D-MPF-1=B 보강 의무.

---

## 7. ADR / 정합 검증

- **ADR-008** graceful degradation — 본 step 이 graceful=true 진입점에서 Multi-Path 자동 fallback 으로 확장. 응답 contract 변경 0 (gracefulDegradation 플래그 유지).
- **ADR-012** 3-stage hybrid — 본 step 은 Stage 1 Miss 시 진입, Stage 2 hard filter 와 별개 경로.
- **ADR-013** Materialized Active View — Stage 2 keyword 매칭도 `is_current_active=1` 강제 (Multi-Path 도 활성 노드만).
- **ADR-015** Multi-Path Fallback — 본 step 의 정의 source.
- **ADR-019** Concurrent Execution — 본 step 미적용 (순차). 별도 step.
- **Hard Rule 18** — 본 step 의 흡수 의무 항목.
- **Hard Rule 21** — 거부 시 검수 큐 자동 기록 (D-MPF-3=A 채택 시 정합).

---

## 8. Hard Rules 정합

- **Hard Rule 15** — 범용 계층 분기 금지: multi-path-fallback 코드 내 `if (examId === 'son-hae-pyeong-ga-sa')` 0건. examId 는 ExamId 타입 변수만.
- **Hard Rule 16** — examId 첫 인자 강제: 모든 신규 함수 시그니처 `(deps, examId, ...)` 정합.
- **Hard Rule 17** — EXAM_IDS 경유: 리터럴 0건 (테스트 fixture 외).
- **상용 품질** — any 0건, console.log 0건, TODO 0건, 빈 catch 0건, import \* 0건.
- **Workers 호환** — fs/path/node: 0건. Web Crypto + D1 + Vectorize 만.

---

## 9. Gates (binary 검증 기준)

| Gate ID  | 기준                                                                | 검증 방법                                |
| -------- | ------------------------------------------------------------------- | ---------------------------------------- |
| G-MPF-1  | typecheck PASS (`pnpm --filter @thepick/api typecheck`)             | exit 0                                   |
| G-MPF-2  | lint PASS (`pnpm --filter @thepick/api lint`)                       | 0 ESLint issues                          |
| G-MPF-3  | 단위 테스트 +20 PASS (apps/api 410 → 430+)                          | vitest --run                             |
| G-MPF-4  | SP-T06 정확도 ≥ 85% (키워드 50건)                                   | fixture + 정확도 계산                    |
| G-MPF-5  | SP-T07 거부율 ≤ 5% (정상 질문 100건)                                | fixture + 거부 카운트                    |
| G-MPF-6  | Hard Rule 17 grep 0건 in `apps/api/src/search/multi-path-fallback/` | grep 검증                                |
| G-MPF-7  | Pass 2 MAJ-1 흡수: queryDigest Hono context 캐시 1회 계산           | 단위 테스트 (호출 횟수 spy)              |
| G-MPF-8  | D-MPF-3=A 채택 시: migration 0027 적용 + review_queue INSERT 검증   | wrangler d1 execute + 단위 테스트        |
| G-MPF-9  | verify-engine-contracts.ts 7/0/1 불변                               | post-impl run1≡run2                      |
| G-MPF-10 | 4-Pass 독립 리뷰 CRITICAL 0건                                       | 5개 에이전트 병렬 + 통합 보고서          |
| G-MPF-11 | response shape 비변경 (gracefulDegradation/honestRefusal 추가만)    | 기존 routes.test.ts 통과 + 신규 contract |

---

## 10. carry-over (다음 step / 별도)

- **Concurrent Execution + Short-circuit** (Rule 23 / ADR-019) — Vector + Keyword + Topic 동시 + race + 800ms timeout. 본 step 후순위.
- **kkma/khaiii 형태소 분석기** — Year 2 또는 별도 ADR. Python subprocess 빌드 시 inverted index 사전 적재.
- **응답 body `query` echo 정책** (Pass 3 MAJ-A2) — 별도 ADR 결정 의무 (본 step 진입 전 권장).
- **canonical logger serializeError SQL keyword pattern redact** (Pass 1 MAJ-1) — 본 step 의 multi-path-fallback console.error 도 동일 정책 적용 가능.
- **valid_from time-based effectivity** (Pass 4 C1) — Year 2.
- **Pass 3 MIN-1 HMAC-with-pepper** — Year 1 carry-over.
- **G-MPF-7 Hono context queryDigest 캐시 — 단위 테스트 spy 의무**.

---

**작성**: Claude (Opus 4.7 1M context) — Session 059
**효력**: 진산 결정 (D-MPF-1~4) 후 §2.4 영속 + §3 적재 단위 코드 진입
**예상 다음 세션**: 060 — D-MPF 결정 갈림길 4건 영속 후 multi-path-fallback 모듈 구현 + 4-Pass 리뷰
