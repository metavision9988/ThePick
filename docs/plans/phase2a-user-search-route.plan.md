# Phase 2A — 정식 user 검색 라우트 plan (Step 3)

> **세션**: 058 / 2026-05-08
> **트리거**: handoff-066 §3 권장 C — SEARCH*PIPELINE Stage 2/3 정식 user 검색 라우트
> **선행 step**: Phase 2A Step 2 (table*\* 인덱싱 433 + 4-Pass MAJOR 6건 흡수, commit 5d3b039)
> **선행 ADR**: ADR-004 §4 Addendum (검색단 단일 방어), ADR-007 (Hard Rule 16/17), ADR-008 (graceful degradation), ADR-012 (3-Stage Hybrid), ADR-013 (Materialized Active View Rule 16)
> **선행 architecture**: SEARCH_PIPELINE.md v2.1 §2~§4 + §7 SP-T01~SP-T10
> **상태**: Plan + 구현 + 단위 테스트 PASS → production smoke 는 admin G5.5 검수 후 carry-over

---

## 1. ★ 핵심 사실 영속

### 1.1 현 production 상태 (2026-05-08)

| 항목                                 | 값                                                     |
| ------------------------------------ | ------------------------------------------------------ |
| Vectorize index `thepick-embeddings` | vectorCount=1227 (knowledge_nodes 794 + table\_\* 433) |
| knowledge_nodes status 분포          | 794건 모두 'draft' (검수 미완료, admin G5.5 차단점)    |
| table_structures status 분포         | 20건 모두 'draft'                                      |
| `is_current_active` 컬럼             | 모든 노드 default 1 (migrations/0013, ADR-013)         |

★ Stage 2 hard filter `status='approved' AND is_current_active=1` 강제 시 본 시점 결과 0건 — admin G5.5 검수 워크플로우 차단점. 본 step 단위 테스트 fixture 'approved' 전환으로 검증.

### 1.2 직전 step 인프라 (재사용)

- `apps/api/src/vectorize/upserter.ts` (BGE_M3 임베딩, idempotent)
- `apps/api/src/vectorize/routes.ts` `/search` (admin route, 본 step 분리/확장 — user 전용 신규 라우트)
- `apps/api/src/vectorize/page-ref.ts` (DRY 단일 출처)
- TRUTH_WEIGHTS v3 (LAW=10/FORMULA=8/TABLE=8/INVESTIGATION=7/ROW_HEADER=COL_HEADER=7/INSURANCE=CROP=CELL=6/CONCEPT=5/TERM=3)

---

## 2. ★★ 본 step 범위 (Claude 결정, 최상 품질 기본값)

### 2.1 포함 (in-scope)

- **Stage 1 Vector Recall** (top-K=20, similarity ≥ 0.60) — 직전 admin /search 동등 임베딩 호출
- **Stage 2 Graph Hard Filter** (Rule 16, ADR-013):
  - `WHERE id IN (...) AND exam_id = ? AND is_current_active = 1 AND status = 'approved'`
  - knowledge_nodes 만 적용 (table\_\* status는 부모 추론 — Stage 2 hard filter 는 knowledge_nodes 자체 status 만 신뢰. 본 step PoC carry-over 명시)
- **Stage 3 Truth Weight Re-rank** (TRUTH_WEIGHTS 가중치 정렬, 동일 weight 내 vector similarity 보존)
- **ADR-008 timeout/retry/graceful**:
  - 800ms hard timeout (Vectorize.query)
  - 1 retry (network blip)
  - top-1 < 0.60 → `gracefulDegradation: true` 응답 + Multi-Path Fallback 진입 carry-over 플래그
- **public route** `POST /api/search`:
  - 인증 0 (admin token 미요구) — Phase 2A MVP. user_session middleware는 별도 step
  - rate-limit 0 (P3-m1 carry-over 별도 step)
  - CORS 허용 (web/admin-web 공통)
- **단위 테스트**: Stage 2 hard filter (draft 차단 + approved 통과 + exam_id 격리), Truth Weight rerank 정합, timeout/retry 동작, graceful degradation 플래그
- **Hard Rule 16/17 zero-cost 전환**: examId 첫 인자 강제 (라우트 진입점) + EXAM_IDS 경유 100%

### 2.2 비스코프 (out-of-scope, carry-over)

- **Multi-Path Fallback** (Rule 18 / ADR-015) — keyword search + topic cluster routing — 별도 step (Stage 2/3 PoC PASS 후)
- **Concurrent Execution** (Rule 23 / ADR-019) — Vector + Keyword + Topic 동시 — 별도 step
- **user_session 인증** — auth 영역 별도 step. 본 step은 rate-limit (60 req/60s/IP) 만 적용
- **table\_\* status hard filter** (table\_\* 자체 status 부재 — 부모 table_structures.status JOIN 추론은 Stage 2 hard filter 시 별도 SQL 분기 필요)
- **production smoke test (approved 노드 응답)** — admin G5.5 검수 후 일부 노드 'approved' 전환 후 별도 step
- **valid_from time-based effectivity 필터** (★ Pass 4 C1 재평가, Session 058):
  - SEARCH_PIPELINE.md §4 line 62 + ADR-012 §Decision Stage 2 가 `knowledge_nodes.valid_from` 컬럼 존재 가정
  - 그러나 현 schema (migrations 0001~0026) 에는 `valid_from` 컬럼이 `exam_questions` / `revision_changes` 에만 존재
  - 본 step은 `is_current_active=1` (Materialized Active View, ADR-013) 가 활성-버전 semantic 캡슐화 — SUPERSEDES 트리거 자동 비활성화
  - Year 2 별도 step: `knowledge_nodes` ADD COLUMN valid_from + revision_changes JOIN 도입 검토
- **Pass 3 M1+M2 흡수 4-Pass 잔여 carry-over** (★ Session 059, `.claude/reviews/review-20260508-172630-session-059-pass3-m1m2-4pass.md`):
  - **Pass 3 MAJ-A2** UserSearchResult.query 응답 body echo — Cloudflare Logs / CDN edge log / Service Worker 캐시 등 surface 에서 PII leak 재발 가능. 응답 body `query` 필드 제거 vs hash 대체 vs UX 보존 trade-off 결정 — 별도 ADR.
  - **Pass 1 MAJ-1** UserSearchError cause.message 운영 디버깅 surface — canonical logger `serializeError` 에 SQL keyword pattern redact 추가 후 진입. 본 step 은 causeName 만 surface (causeMessage 미surface).
  - **Pass 2 MAJ-1** Multi-Path Fallback step 에서 `c.set('queryDigest', ...)` Hono context 캐시 패턴 도입 (request 당 SHA-256 재계산 회피).
  - **Pass 3 MIN-1** SHA-256 unsalted → 짧은 query (사번/학번 7~8자리 ID) dictionary attack 가능 → HMAC-with-pepper 검토 (Year 1 carry-over).

### 2.3 결정 영속 (진산 결정 갈림길 0건)

- D-USER-1 (인증): public route, 본 step 인증 0 — Phase 2A MVP 정합 (Multi-Path Fallback step 진입 시 user_session middleware 추가 검토)
- D-USER-2 (top-K 응답): default 3 (SEARCH_PIPELINE.md §4 운영 RAG 기본값) + max 10
- D-USER-3 (status 필터): `'approved'` 단일 (ADR-004 §4 Addendum 단일 방어 contract). admin /search 라우트는 status 무관 전수 (검수자 운영 — 직전 step 정합)
- D-USER-4 (Multi-Path Fallback 위치): 별도 step (carry-over). 본 step 은 graceful 플래그 + 클라이언트 fallback 진입 신호만 전송
- D-USER-5 (Concurrent): 별도 step (carry-over). 본 step 은 단일 Vector path 만

---

## 3. 적재 단위

### 3.1 신규 모듈

- **`apps/api/src/search/user-search.ts`** (NEW):
  - `searchKnowledgeNodesForUser(deps, examId, query, topK)` 핵심 함수
  - 책임: 임베딩 → Vectorize.query → Stage 2 D1 hard filter → Stage 3 truth_weight rerank → 응답 변환
  - 의존성: AiBinding + VectorizeBinding + D1Reader (테스트 mock 호환)
  - 첫 인자 `examId: ExamId` 강제 (Hard Rule 16)
- **`apps/api/src/search/routes.ts`** (NEW):
  - `createUserSearchRoutes()` — Hono sub-router
  - `POST /` — public route (인증 미들웨어 0)
  - body: `{examId, query, topK?}` (zod validation)
  - 응답: `{query, examId, topK, gracefulDegradation, top1Score, results: [{id, score, type, page_ref, truth_weight, name}]}`
  - ADR-008 timeout 800ms (`AbortSignal.timeout(800)`) + 1 retry on network error
- **`apps/api/src/index.ts` 통합**: `app.route('/api/search', createUserSearchRoutes())` 등록 + CORS 허용 (X-Admin-Token 불필요)

### 3.2 단위 테스트

- **`apps/api/src/search/__tests__/user-search.test.ts`** (NEW):
  - Stage 1 Vector Recall (mock Vectorize.query top-K=20 similarity ≥ 0.60 정합)
  - Stage 2 Hard Filter:
    - draft 노드 차단 (real D1 fixture: 1 draft + 1 approved → approved 만 응답)
    - is_current_active=0 차단
    - exam_id 격리 (다른 exam_id 노드 차단)
  - Stage 3 Truth Weight rerank:
    - LAW(10) > FORMULA(8) > CONCEPT(5) 순서 검증 (vector similarity 무관)
    - 동일 weight 내 vector similarity 보존
  - ADR-008 graceful degradation:
    - top-1 ≥ 0.60 → flag false
    - top-1 < 0.60 → flag true
  - timeout 800ms (mock Vectorize.query 의도적 1s delay → AbortError)
  - retry on Vectorize network error (1회 retry 후 PASS or fail surface)
  - Hard Rule 16: examId 빈 문자열 throw
  - Hard Rule 17: 리터럴 0건 (EXAM_IDS 경유)

- **`apps/api/src/search/__tests__/routes.test.ts`** (NEW):
  - public route POST `/api/search` 200 (인증 미들웨어 0)
  - zod validation (examId 부재 / query 부재 / topK > 10 → 400)
  - Hard Rule 17 (allowlist 외 examId → 400)
  - end-to-end (실 D1 fixture + mock VECTORIZE/AI → top-3 응답 + page_ref 포함)

목표 vitest PASS 12건+.

---

## 4. Hard Rule 16/17 zero-cost 전환

- user-search.ts 첫 인자 `examId: ExamId` 강제 (Year 2 zero-cost 전환 정합)
- routes.ts `assertValidExamId(rawExamId)` 진입점 검증 (직전 step admin route 동일 패턴)
- D1 Stage 2 SQL `WHERE exam_id = ?` (Year 1 컬럼 부재 → 본 step Year 1 한시 inline 무효화)
- ★ 본 step 은 Year 1 시점 → SQL `WHERE exam_id = ?` 삭제 / 함수 시그니처 examId 강제만 (Hard Rule 16 정의 "Year 1 (exam_id 컬럼 부재 상태)" 명시 허용)
- `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 경유 100%, 리터럴 0건 (Rule 17)
- 검증: `grep -rn "'son-hae-pyeong-ga-sa'" apps/api/src/search/` 0건

---

## 5. Gates (의무 검증)

| Gate | 항목                                        | 검증                                                            |
| ---- | ------------------------------------------- | --------------------------------------------------------------- |
| 5.1  | user-search.ts + routes.ts 단위 테스트 PASS | Vitest 12건+, Stage 2/3 정합 + ADR-008 + Hard Rule 16/17        |
| 5.2  | Stage 2 hard filter draft 차단 검증         | Real D1 fixture (draft + approved 혼합) → approved 만 응답      |
| 5.3  | Stage 3 truth_weight rerank 검증            | LAW(10) > FORMULA(8) > CONCEPT(5) 순서 (vector similarity 무관) |
| 5.4  | ADR-008 timeout 800ms 검증                  | Vectorize.query 1s delay → AbortError + 응답 graceful=true      |
| 5.5  | ADR-008 graceful degradation 플래그         | top-1 < 0.60 → flag true, ≥ 0.60 → flag false                   |
| 5.6  | exam_id 격리 검증 (Hard Rule 16)            | exam A 질문 → exam B 노드 0건 응답 (SP-T09)                     |
| 5.7  | apps/api 회귀 0                             | 370 → 380+ PASS (단위 테스트 추가만, 기존 회귀 0)               |
| 5.8  | Hard Rule 17 grep 0건                       | EXAM_IDS 경유 100%                                              |
| 5.9  | post-implementation verify run1≡run2        | 7/0/1 PASS (regression 0)                                       |
| 5.10 | 4-Pass 5 페르소나 독립 에이전트 리뷰        | CRITICAL 0건                                                    |
| 5.11 | staging deploy + dry-run smoke (1 query)    | 200 OK + gracefulDegradation=true (현 prod approved 0건 → 정합) |

---

## 6. 비용 견적

| 항목                     | 견적            | 근거                                          |
| ------------------------ | --------------- | --------------------------------------------- |
| Workers AI bge-m3 임베딩 | ~$0.00001/query | query 1건 × ~30 토큰 × $0.011/M               |
| Vectorize 쿼리           | ~$0.00001/query | top-K=20 × 1024d × $0.01/M-vector-dimensions  |
| D1 Stage 2 hard filter   | ~$0.00001/query | top-K=20 IN clause + status filter            |
| **합계 (개시 1회)**      | **~$1**         | A3 cap $200/월 충분 — 1만 query/월 × ~$0.0001 |

---

## 7. Rollback / Risk

- **Stage 2 status filter 미스매치**: production 모든 노드 'draft' 시 결과 0건 → graceful degradation true (정상 동작, 클라이언트 안내). admin G5.5 검수 후 일부 'approved' 전환으로 해소.
- **Vectorize timeout**: 800ms 초과 시 graceful=true. 향후 ADR-019 Concurrent Pipeline 진입 시 Multi-Path Fallback 자동 진입 (별도 step).
- **D1 Stage 2 query failure**: try-catch + cause 전파 (Pass 1 SURGEON M1 정합) + 500 응답 (P3-M2 details masking 정합).
- **public route 남용**: rate-limit 부재 → 별도 step (P3-m1 carry-over). 본 step 은 cap A3 $200 monthly + Workers limit 의존.

---

## 8. 시간 견적

| 단계                                       | 시간      |
| ------------------------------------------ | --------- |
| user-search.ts + routes.ts + index.ts 통합 | 1.0h      |
| 단위 테스트 12건+                          | 0.7h      |
| staging deploy + dry-run smoke + verify    | 0.3h      |
| 4-Pass 5 페르소나 독립 에이전트 리뷰       | 0.5h      |
| MAJOR carry-over 흡수 (필요 시)            | 0.3h      |
| handoff + commit + push                    | 0.2h      |
| **합계**                                   | **~3.0h** |

---

## 9. 진산 결정 갈림길 0건

본 plan 코드 진입 차단점 = 0건. memory `feedback_no_granular_decisions` 정합 — 모든 결정이 SEARCH_PIPELINE.md + ADR-004 §4 Addendum + ADR-008 + ADR-013 명세에서 도출.

---

## 10. 참고

- `docs/architecture/SEARCH_PIPELINE.md` v2.1 §2~§4 (3-Stage Hybrid + Concurrent + Multi-Path)
- `docs/adr/ADR-004-vectorize-embedding-spec.md` §4 Addendum (검색단 단일 방어)
- `docs/adr/ADR-008-graceful-degradation.md` (timeout 800ms / retry 1 / similarity < 0.60 거부)
- `docs/adr/ADR-012-three-stage-hybrid-search.md` (Stage 1/2/3 분리)
- `docs/adr/ADR-013-materialized-active-view.md` (`is_current_active` 컬럼 + Rule 16)
- `migrations/0013_active_view_and_review_decisions.sql` (is_current_active schema)
- handoff-session-066.md §3 권장 C
- 4-Pass 통합 보고서 (산출 의무): `review-YYYYMMDD-HHMMSS-session-058-user-search-4pass.md`
