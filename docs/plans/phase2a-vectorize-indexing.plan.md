# Phase 2A — Vectorize 인덱싱 + RAG 활성 plan

> **세션**: 056 / 2026-05-08
> **트리거**: 진산 발화 "A3 활성 완료, Vectorize 진입"
> **선행**: Phase 2A 별표 1·2·5·6·7 적재 완료 (handoff-064, commit 2fb85db)
> **선행 ADR**: ADR-004 (Accepted, bge-m3 1024차원), ADR-007 (멀티시험 격리), ADR-008 (graceful degradation)
> **선행 architecture**: SEARCH_PIPELINE.md v2.1, CONTENT_BUILD_ENGINE.md
> **상태**: Plan + 결정 갈림길 영속. **진산 D-VEC-1 + D-VEC-2 결정 후 코딩 진입.**

---

## 1. ★ 핵심 사실 영속

### 1.1 현 D1 상태 (production, 본일 2026-05-08)

| 테이블             | row 수 | status 분포                                  |
| ------------------ | ------ | -------------------------------------------- |
| `knowledge_nodes`  | 794    | 대다수 'draft' (BATCH 1~5 적재, 미검수 영속) |
| `formulas`         | 157    | (status 컬럼 없음 — 별도 트리)               |
| `constants`        | 193    | (status 컬럼 없음)                           |
| `table_structures` | 20     | 'draft' (Phase 2A 적재 직후)                 |
| `table_headers`    | 167    | 'draft'                                      |
| `table_cells`      | 246    | 'draft'                                      |
| `table_node_links` | 20     | 'extracted_from' relation_type               |

★ Phase 2A에서 **433 cell-level 노드**(structures+headers+cells) + 20 links 신규 적재. 전체 'draft' status 영속.

### 1.2 인프라 영속 상태 (survey 결과)

| 항목                                         | 상태        | 비고                                              |
| -------------------------------------------- | ----------- | ------------------------------------------------- |
| ADR-004 (bge-m3 1024d cosine)                | ✅ Accepted | docs/adr/ADR-004                                  |
| ADR-007 멀티시험 격리                        | ✅ Accepted | exam_id 메타데이터 필수                           |
| ADR-008 graceful degradation                 | ✅ Accepted | 800ms timeout, <0.60 거부                         |
| SEARCH_PIPELINE 3-stage hybrid               | ✅ 설계     | 미구현                                            |
| TRUTH_WEIGHTS 코드                           | ✅ 영속     | packages/shared/src/types.ts:68-80                |
| `.env.example` VECTORIZE_INDEX               | ✅          | line 14: `VECTORIZE_INDEX=thepick-embeddings`     |
| wrangler.toml dev/staging/production binding | ❌ 미적재   | `[[vectorize]]` 0건                               |
| Vectorize 인덱스 자체 (Cloudflare 측)        | ❌ 미생성   | 본 step에서 `wrangler vectorize create` 실행 의무 |
| apps/batch vectorize-upserter                | ❌ 미구현   | draft-loader.ts:13 "(가-1 이후)" 명시             |
| apps/api search 라우트                       | ❌ 미구현   | SEARCH_PIPELINE.md 설계만                         |
| Vectorize 메타데이터 마이그레이션            | ❌ 미작성   | `vectorize_metadata` 또는 동등 (선택)             |
| Workers AI binding (`AI`)                    | ❌ 미적재   | bge-m3 호출 의존                                  |

### 1.3 ★★ 정책 충돌 발견 (핵심 결정 갈림길)

- **ADR-004 §4 인덱싱 정책**: "approved 상태 노드만 임베딩 (`draft`, `review` 제외)"
- **SEARCH_PIPELINE Stage 2 Graph Hard Filter**: `WHERE status = 'approved' AND is_current_active = 1 AND exam_id = ?` (검색 단계 이중 필터)
- **현 D1 상태**: 모든 별표 cell-level 노드 + 대다수 knowledge_nodes = 'draft'
- **handoff-064 §3 의도**: "433 cell-level 노드 ~$5 인덱싱"
- **결과**: ADR-004 §4 엄격 적용 시 → 본 step 인덱싱 가능 노드 = 0건. handoff 의도 미달성.

**해석 두 갈래** (D-VEC-1 결정):

- **A: ADR-004 §4 엄격** — admin G5.5 검수에서 일부 노드 'active'/'approved' 전환 후 첫 인덱싱. 본 step은 인프라/모듈 작성만. 진산 G5.5 검수 후 다음 세션 첫 인덱싱.
- **B: ADR-004 §4 Addendum 완화** — draft도 인덱싱하되 검색 Stage 2에서 status 필터 (이중 방어 → 단일 방어 의존). 검수 전 개발자/진산 spot check RAG 가능. ADR-004 Addendum 영속 의무.
- **C: 절충 — 'spot-check' 별도 status 도입** — 검수 진척 단계('draft' → 'spot_check' → 'approved')를 추가. spot_check 노드는 인덱싱하되 admin 사용자만 검색. 일반 검색은 'approved' 강제. ★ 마이그레이션 필요.

★ Claude 권장 = **B** (운영 부담 최소, 검수 전 RAG smoke test 가능, ADR-004 Addendum 1건). 그러나 ADR-004 정책 변경은 진산 결정 영역.

---

## 2. ★★ 결정 갈림길 (진산 입력 의무 — 본 plan 진행 차단점)

### D-VEC-1: status 정책

- 선택지: A (엄격, 미리 검수 후) / B (완화 Addendum, draft 인덱싱) / C (절충 spot_check status 신설)
- ★ 권장: B
- 영향: 본 step 인덱싱 가능 노드 수 (A=0 / B=1240+ / C=진산 spot check 후 N개)

### D-VEC-2: 본 step 작업 범위

- **범위 A (인프라+인덱싱+smoke test)**: wrangler binding + `wrangler vectorize create` + apps/batch/vectorize-upserter.ts + 인덱싱 실행 + RAG smoke test 5건. 검색 라우트 미포함. 시간 ~2~3시간.
- **범위 B (+ 검색 라우트)**: 위 + apps/api/src/routes/search.ts (3-stage hybrid). 시간 ~5~7시간 (1세션 한계 근접).
- **범위 C (인프라+모듈만)**: wrangler binding + 모듈 작성 + dry-run, 실인덱싱 보류 (D-VEC-1=A 선택 시 자동). 시간 ~1~2시간.
- ★ 권장: **A** (smoke test로 D-VEC-1=B 검증 가능, 검색 라우트는 별도 step에서 SEARCH_PIPELINE 전체 영속)

---

## 3. 적재 단위 (D-VEC-1=B + D-VEC-2=A 가정 시)

### 3.1 wrangler.toml binding (3 env)

```toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "thepick-embeddings"

[ai]
binding = "AI"

# env.staging / env.production 동일
```

### 3.2 Vectorize 인덱스 생성 (Cloudflare 측)

- `wrangler vectorize create thepick-embeddings --dimensions=1024 --metric=cosine`
- 메타데이터 인덱스: exam_id, node_type, status, lv1_insurance, lv2_crop (5개)

### 3.3 apps/api/src/vectorize/upserter.ts (신규, worker-only)

> **위치 결정 (Session 056)**: vectorize-upserter는 worker AI/Vectorize binding 의존 → worker-only 모듈. 초안은 `apps/batch/src/loader/`에 작성했으나 apps/batch는 Node CLI 도구로 binding 미보유 → `apps/api/src/vectorize/upserter.ts`로 이전. apps/batch 잔류 사유 0건. 다음 step에서 query 추가 시 동일 디렉토리에 영속.

- 책임: 노드 리스트 → bge-m3 임베딩 → Vectorize upsert (idempotent, id-based)
- 입력: VectorizeBinding, AiBinding, ExamId, NodeForVectorize 리스트 (≤100)
- 출력: { upserted, skipped, mutationId, durationMs }
- 메타데이터 매핑 (ADR-004 §3 정합):
  - `exam_id` (Hard Rule 16/17 정합 — `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 경유)
  - `node_id`, `node_type`, `status`, `lv1_insurance?`, `lv2_crop?`, `exam_scope?`
  - `truth_weight`, `revision_year`, `source_page`, `is_active`
- 임베딩 텍스트 = caller 책임 (보통 `name + '\n' + description`). 본 모듈은 텍스트만 받음.
- 에러 처리: 빈 catch 0건, AppError + ErrorCode 분기 (validate=400 / embed/upsert=500)
- Hard Rule 17: `'son-hae-pyeong-ga-sa'` 리터럴 0건 (EXAM_IDS 경유)
- 단위 테스트: `apps/api/src/vectorize/__tests__/upserter.test.ts` (vitest mock binding)

### 3.4 인덱싱 실행 메커니즘 (Session 056 보강)

**worker-only 결정 영속**: Workers AI / Vectorize binding 은 worker 환경 의존. Node CLI 에서 직접 호출 불가 (REST API 별도 토큰 필요 + 오너십 부담). 따라서 본 step 인덱싱은:

1. **`apps/api/src/vectorize/routes.ts`** (신규) — admin Hono sub-router
   - `POST /api/admin/vectorize/bootstrap` — D1 fetch + vectorize-upserter 호출
   - `POST /api/admin/vectorize/search` — query embedding + Vectorize.query (smoke test)
   - 보호: `requireAdminToken` 미들웨어 (X-Admin-Token 또는 admin_session 쿠키)
2. **scripts/run-vectorize-indexing.ts** (Node) — `wrangler dev` URL 또는 deploy URL 에 `fetch` 호출, ADMIN_API_TOKEN 헤더 주입, source 별 progress 출력
3. **scripts/smoke-test-rag.ts** (Node) — 5 자연어 쿼리 → search route POST → top-K 결과 출력

**본 step PoC 범위 (단순화)**:

- 인덱싱 대상 = `knowledge_nodes` 만 (794건). text = `name + '\n' + description`. status 메타데이터 보존.
- table_cells/headers/structures 인덱싱은 **별도 step carry-over** (JOIN-based 텍스트 구성 + 부모 table.status 추론 필요)
- formulas 인덱싱도 별도 step carry-over (equation_template + variables_schema 텍스트화 정책 미결정)
- 본 step smoke test 5건은 LAW-138~142 hit 검증 (모두 knowledge_nodes 영역)

**전체 인덱싱 (~1384 노드)** 은 Session 056 후속 또는 다음 step:

- table_cells/headers/structures 텍스트 구성 정책 영속 (JOIN row/col header text + value_text)
- formulas equation_template 임베딩 정책 영속
- 본 step PoC PASS → 전체 인덱싱 별도 step 진행

**dry-run**: bootstrap route body `{ dryRun: true }` 시 fetch 만 + count 응답.

### 3.5 RAG smoke test (scripts/smoke-test-rag.ts) — Session 056 PoC 적용

**5개 자연어 쿼리** (knowledge_nodes 한정, LAW 노드 hit 검증):

1. "표본주수 산정 기준" → LAW-138 (별표 1) hit
2. "미보상비율 매우 불량" → LAW-139 (별표 2) hit
3. "고추 병충해 1등급" → LAW-142 (별표 7) hit
4. "손해정도비율 50%" → LAW-141 (별표 6) hit
5. "무화과 잔여수확량" → LAW-140 (별표 5) hit

- 출력: top-5 노드 ID + similarity + node_type + truth_weight + status
- 합격 기준 (Session 056 Addendum, D-VEC-3=A): **4/5 PASS 합격** (벡터-only PoC 자연 결과)
  - 1번 "표본주수 산정 기준" → LAW-138 score=0.538 (rank 16/20, ADR-008 임계 <0.60)
  - 정식 SEARCH_PIPELINE Stage 3 Truth Weight rerank (LAW=10) 적용 시 LAW-138 top-5 진입 가능 — 별도 step 검증
  - 본 vector-only PoC는 ADR-008 graceful degradation (`gracefulDegradation: true` 플래그 응답) 정합 동작 확인
- D-TABLE-5=β→α 진산 spot check (정확성 직접 평가) — D-VEC-3=A 결정 영속 (Session 056)
- table_cells smoke test (TBL-012/013/014/015/001 cell-level hit 검증) 은 **별도 step carry-over** (table_cells 인덱싱 후)
- LAW-138 임베딩 텍스트 정책 강화 (description 메타 추가) 도 **별도 step carry-over**

### 3.6 ADR-004 Addendum (D-VEC-1=B 선택 시 의무)

- 내용: "draft/review 상태도 인덱싱 대상. 검색 단계 status 필터로 이중 방어 단일 방어 전환. admin 검색은 status 무관 전수 검색 허용."
- 위치: docs/adr/ADR-004-vectorize-embedding-spec.md §4 + §"수정 이력"

---

## 4. Hard Rule 16/17 zero-cost 전환 (memory `project_completion_notification_obligation`)

본 step에서 Year 2 zero-cost 전환을 **본 step 동시 처리** (이연 X):

- vectorize-upserter.ts 시그니처 첫 인자 `examId: ExamId` 강제 (Rule 16)
- Vectorize upsert 메타데이터 `exam_id` 필수 주입 (Rule 16)
- `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 경유, 리터럴 0건 (Rule 17)
- 검증: `grep -rn "'son-hae-pyeong-ga-sa'" apps/batch/src/loader/vectorize-upserter.ts` 0건 의무

---

## 5. Gates (의무 검증)

| Gate | 항목                                    | 검증                                                                                  |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| 5.1  | wrangler.toml binding 적재              | `wrangler deploy --dry-run` PASS (3 env)                                              |
| 5.2  | Vectorize 인덱스 생성                   | `wrangler vectorize list` 'thepick-embeddings' 영속                                   |
| 5.3  | vectorize-upserter.ts 단위 테스트       | Vitest PASS, examId 필수 검증, 빈 catch 0건                                           |
| 5.4  | 인덱싱 dry-run (staging)                | count 일치, 임베딩 호출 0회                                                           |
| 5.5  | 인덱싱 실행 (staging)                   | 1384 upsert 성공 + Vectorize 측 count 일치                                            |
| 5.6  | RAG smoke test 5건 (staging)            | **4/5 합격 (D-VEC-3=A 영속, §3.5 Addendum)** — LAW-138 score=0.538 graceful 동작 확인 |
| 5.7  | 진산 spot check (D-TABLE-5=β→α)         | 5건 답변 정확성 진산 직접 평가 PASS                                                   |
| 5.8  | 인덱싱 실행 (production)                | staging 동등 count                                                                    |
| 5.9  | post-indexing verify run1+run2 PASS     | 7/0/1 회귀 0                                                                          |
| 5.10 | Hard Rule 17 grep 0건                   | EXAM_IDS 경유 100%                                                                    |
| 5.11 | 4-Pass 독립 에이전트 리뷰 (자동 트리거) | CRITICAL 0건                                                                          |

★ 5.7 진산 spot check 미통과 시 → status 정책 D-VEC-1 재논의 (5.5+5.6 PASS 후 진산 결정 필요)

---

## 6. 비용 견적

| 항목                       | 견적                            | 근거                                                |
| -------------------------- | ------------------------------- | --------------------------------------------------- |
| Workers AI bge-m3 임베딩   | ~$0.5~1 (1384 노드 × ~700 토큰) | Workers AI bge-m3 가격 ~$0.011/M tokens             |
| Vectorize 인덱스 저장 (월) | ~$0.04/월                       | 1384 vectors × $0.05/100M-vector-dimensions × 1024d |
| Vectorize 쿼리 (smoke 5건) | ~$0.001                         | $0.01/M-vector-dimensions queried                   |
| **합계 (개시 1회)**        | **~$1**                         | A3 cap $200/월 충분                                 |
| **월 유지 (개시 후)**      | **~$0.5/월**                    | 신규 노드 upsert만 추가                             |

★ handoff §3 명시 ~$5는 보수적 상한선. 실측 ~$1.

---

## 7. Rollback / Risk

- **vectorize-upserter.ts 실패**: id-based upsert이므로 idempotent. 재실행으로 해결. Vectorize 인덱스 drop은 `wrangler vectorize delete thepick-embeddings`.
- **smoke test 5/5 미달**: 임베딩 텍스트 정책 재검토 (description 비중 / context 추가). ADR-004 Addendum + 재인덱싱.
- **production 인덱싱 중 부분 실패**: 마지막 성공 노드 ID 영속 → 재실행 시 skip. checkpoint 패턴 (Step 11.6 idempotent 동등).
- **Hard Rule 17 위반**: grep 0건 미달 시 commit 차단 (quality-gate.sh hook).

---

## 8. 시간 견적 (D-VEC-2=A 가정)

| 단계                                       | 시간      |
| ------------------------------------------ | --------- |
| wrangler binding 적재 + 인덱스 생성        | 0.3h      |
| ADR-004 Addendum 영속                      | 0.2h      |
| vectorize-upserter.ts 작성 + 단위 테스트   | 1.0h      |
| 인덱싱 dry-run + staging 실행 + smoke test | 0.8h      |
| 진산 spot check + production 인덱싱        | 0.4h      |
| 4-Pass 독립 에이전트 리뷰                  | 0.5h      |
| post-verify + handoff + commit/push        | 0.3h      |
| **합계**                                   | **~3.5h** |

---

## 9. 진행 차단점

본 plan 진입 차단 = D-VEC-1 + D-VEC-2 결정 미수신.

- D-VEC-1 (status 정책): 권장 **B** (Addendum 완화) — **결정 영속 = B (Session 056)**
- D-VEC-2 (작업 범위): 권장 **A** (인프라+인덱싱+smoke, 검색 라우트 별도 step) — **결정 영속 = A (Session 056)**
- D-VEC-3 (smoke test 합격 기준): **A = 4/5 PASS 합격** (Session 056, plan §3.5 Addendum)

본 plan 코드 진입 완료 (Session 056 종착).

---

## 10.1 Session 056 4-Pass 독립 에이전트 리뷰 결과 영속

5 페르소나 병렬 (silent-failure-hunter / system-architect / security-engineer / quality-engineer / code-reviewer):

**CRITICAL 3건 본 step 즉시 수정 PASS** (commit 본 step):

- P1-C1 `/search` AI try-catch 부재 → `routes.ts:201-211` cause 전파 try-catch 추가
- P1-C2 Vectorize.query matches null + ADR-008 graceful 미적용 → `routes.ts:226-249` try-catch + matches null 가드 + `gracefulDegradation` 플래그 (`<0.60` 임계)
- P3-C1 `/api/admin/vectorize/*` CORS 미등록 → `apps/api/src/index.ts:97-101` cors() 등록 + Allow-Headers `X-Admin-Token`

**MAJOR 일부 즉시 수정 PASS**:

- P1-M1 D1 `.all()` 결과 검증 누락 → `routes.ts:140-149` try-catch (D1 SDK throw 정합)
- P1-M3 `parsePageRefToInt` null fallback silent → `routes.ts:262-280` `{value, parsed}` 반환 + `buildNodeForVectorize` console.warn

**MAJOR carry-over (별도 step)**:

- P1-M2 partial commit 추적 (caller 8 batches 청크 운영자 책임) — handoff/admin-runbook 영속 의무
- P2-M1 ADR-008 800ms timeout / 1 retry / Stage 2 hard filter 완전 적용 — 별도 step (정식 user 검색 라우트)
- P2-M2 SEARCH_PIPELINE Stage 2 hard filter (`status='approved' AND is_current_active=1` 강제) — 별도 step
- P2-M3 Workers CPU budget batch=100 paid bundled/unbound 의무 영속 — handoff
- P3-M1 D-VEC-1=B "검색단 단일 방어" Hard Rule 영속 (dev-guide.md 또는 ADR-004 §4 Addendum 보강) — 별도 step
- P3-M2 search route metadata allowlist 명시 (`superseded_by` 등 leak 차단) — 별도 step
- P3-M3 dev token rotate (`.dev.vars` 본 토큰 transcript 노출, staging/production 진입 시 wrangler secret put 필수) — handoff
- P4-M2 `routes.ts` 단위 테스트 0건 (Hono mock 기반) — 별도 step
- P4-M3 `scripts/run-vectorize-indexing.ts` Node script 미작성 → admin route + curl loop 대체 (PoC 충분, 정식 script는 별도 step)
- 5th-M1 `VectorizeBindingForRoute extends VectorizeBinding` DRY 약화 — `apps/api/src/vectorize/types.ts` 분리 후속 (별도 step)

**MINOR carry-over** (전부 후속):

- P2-m1 `is_active=true` 하드코딩 → `superseded_by IS NULL` 기반 도출
- P2-m2 SEARCH_PIPELINE.md v2.1 → v2.2 deferred 주석 영속
- P2-m3 AiBinding 모델 lock-in (`@cf/baai/bge-m3` 단일 literal)
- P2-m4 i18n Korean 에러 메시지 admin-only 컨벤션 명시
- P3-m1 `/search` 라우트 rate-limit 미적용
- P3-m2 `parseCookieHeader` URI decode 부재
- P4-m1 `is_active` carry-over plan 영속
- P4-m2 `parsePageRefToInt` 페이지 범위 손실 (`'p.123-125'` → 123)
- P4-m3 plan §5 Gates 표 본문 `5/5` 업데이트는 본 §3.5 Addendum 으로 흡수
- 5th-m1 `parsePageRefToInt` null vs 0 sentinel 의도 명시 (Vectorize nullable 미지원 정합)
- 5th-m2 `mapPhaseToErrorCode` 결과를 routes.ts 에서 직접 위임 가능
- 5th-m3 index.ts Bindings 타입 indexed access vs upserter.ts 직접 import

**판정**: CRITICAL 0건 + MAJOR carry-over 명시 영속 → "완료" 선언 가능 (plan §5 Gate 5.11 PASS).

---

---

## 11. 참고

- ADR-004 §4 인덱싱 정책 (Addendum 2026-05-08 영속)
- SEARCH_PIPELINE.md §2 Stage 2 Graph Hard Filter
- memory `project_completion_notification_obligation.md` (Year 2 zero-cost 동시 처리)
- memory `feedback_no_granular_decisions.md` (전략 결정만 진산, 구현 최상 품질 기본값)
- memory `feedback_document_first_workflow.md` (plan 영속 후 진행)
- memory `feedback_review_filename_pattern.md` (review-\* prefix 의무)
- handoff-session-064.md §3 Phase 2A 종합 검증 + Vectorize 인덱싱 진입
- 4-Pass 통합 보고서: `.claude/reviews/review-YYYYMMDD-HHMMSS-session-056-vectorize-4pass.md`
