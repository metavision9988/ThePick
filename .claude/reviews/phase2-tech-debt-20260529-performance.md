# 기술부채 리뷰 — performance-engineer

- 리뷰 시점: 2026-05-29
- 리뷰 범위 (실제 읽은 파일 23):
  - `apps/api/src/index.ts`
  - `apps/api/src/search/routes.ts`
  - `apps/api/src/search/user-search.ts`
  - `apps/api/src/search/approved-nodes-sql.ts`
  - `apps/api/src/search/graph-search-route.ts`
  - `apps/api/src/search/graph-walk/index.ts`
  - `apps/api/src/search/multi-path-fallback/index.ts`
  - `apps/api/src/search/multi-path-fallback/keyword-fallback.ts`
  - `apps/api/src/search/multi-path-fallback/topic-cluster-router.ts`
  - `apps/api/src/eval/multihop-accuracy.ts`
  - `apps/api/src/study/routes.ts` (전 2051행 2-page)
  - `apps/api/src/auth/password.ts`
  - `apps/api/src/auth/constants.ts`
  - `apps/api/src/auth/rate-limit.ts`
  - `apps/api/src/auth/routes.ts` (요지 부분)
  - `apps/api/src/vectorize/upserter.ts`
  - `packages/formula-engine/src/sandbox.ts`
  - `apps/web/astro.config.mjs` / `apps/web/package.json`
  - `apps/web/src/lib/db.ts`
  - `apps/web/src/components/StudyFlow.tsx` (앞부분)
  - `apps/web/src/components/progress/ProgressViz.tsx`
  - `apps/web/public/sw.js`
  - `migrations/0001 / 0010 / 0013 / 0028 / 0033 / 0034 / 0036 / 0037` (인덱스 grep)
- 부하 모델 가정:
  - 10K MAU. 시험 직전 4주(D-28 ~ D-day) DAU 4K (40%), 평일 야간 22~02시 KST 피크
    동시접속 ≈ 800 (DAU의 20% 1시간 윈도우).
  - 학습자 1세션 평균 30분, 평균 카드 N=30, 각 카드마다 `/study/next` + `/study/grade` 2회
    → 분당 처리 요청 ≈ 800 × 60장/30분 ÷ 60 ≈ **800 req/min** 두 엔드포인트 합계.
    피크 1초 RPS ≈ **27 req/s** (study 그룹만, search/auth 별도).
  - `/api/search` (Multi-Path Fallback 진입 시) Workers AI bge-m3 임베딩 호출이
    request 당 최소 1회, fallback 진입 시 추가 Vectorize 2회 — 시험 직전 검색 트래픽
    하루 30K req (DAU × 8회) 추정.
  - 데이터 규모 (production 라이브, CLAUDE.md "현재 상태"): knowledge_nodes 794 / edges 1274 /
    formulas 157 / constants 193 / exam_questions 545. **2년 horizon**: 다음 시험 회차
    - 1차 확장 → exam_questions 3K~5K, knowledge_nodes 2K, edges 5K, **user_progress
      수십~수백만 row** (10K × 545 × 12개월 review = 65M row 상한, 평균 5M~10M 현실선).
  - Workers paid tier (CPU 30s 상한 가정), D1 paid (rows_read 1B/일 무료).

---

## CRITICAL (시험 시즌 폭발) — 5건

### C-1. `GET /api/study/mode` — 7-쿼리 fan-out + 2개의 cold table SCAN 이 매 사용자 페이지 로드마다 발생

- 파일: `apps/api/src/study/routes.ts:1427-1498`
- 측정/추정:
  - 7개 D1 prepare 가 `Promise.all` 로 묶여 있어 wall-time 은 1-RTT(≈ 30~50ms)지만,
    **rows_read 합계는 모든 쿼리의 합산**. 현재 545 row 기준 1회 호출당 rows_read 추정:
    - 쿼리 ①/② (`exam_questions` COUNT, exam_type 필터) 인덱스 `idx_exam_type` 사용 → 545 row × 2 = ~1.1K rows_read
    - 쿼리 ③/④ (`user_progress JOIN exam_questions WHERE weak_score>0`) — `idx_user_progress_weak` partial index 사용 가능하지만 `eq.exam_type` 컬럼이 인덱스에 없어 **nested loop 후 row-level filter**. 사용자별 user_progress row N (학습 누적, 10K user × 545 평균 = 100~500 row/user 후반) × 545 join = 수만 rows_read
    - 쿼리 ⑤ (confusion_type GROUP BY) — 545 row 전수 스캔, 매 호출마다.
    - 쿼리 ⑥ (streak_records) — PK 1 row.
    - 쿼리 ⑦ (study_reviews COUNT DISTINCT card_id over 24h range) — `idx_study_reviews_user_at`(0034) 사용 OK, 하루 review N (예: 50) row.
- 폭발 트리거:
  - exam_questions 가 545 → 5K (Year 2) 가 되면 ①/② 가 항상 5K scan,
    confusion GROUP BY (⑤) 도 동일.
  - user_progress 가 10K user × 평균 200 row = 2M row 시점에서 ③/④ 의 join cardinality
    는 user 당 200 row × eq 5K (인덱스에 exam_type 없으면 더 큼).
  - 학습자 1명이 `/mode` 페이지를 5분에 1회 새로고침 (StudyFlow 마운트 + tab visibility),
    피크 800 동시 사용자 → 분당 **5,600 sub-쿼리** = D1 RPS ≈ 90.
- 6개월/2년 시나리오:
  - 6개월: exam_questions 1K, user_progress per user 300 → ⑤ 2배 부하, ③/④ 변동.
  - 2년: exam_questions 5K, user_progress 5M row → 단일 `/mode` 호출이 100~500ms wall, peak 에서 D1 CPU saturation.
- 권장 조치:
  1. 정적 쿼리 (①/②/⑤) 결과를 **edge KV/Cache API 로 60s 캐싱** — 사용자 무관 통계라 cross-user share 가능.
  2. ③/④ 합본: `SELECT COUNT(*) AS weak_count, ... (SELECT subject, weak_score) FROM ...` 하나로 묶고 `idx_user_progress_weak` 사용을 강제하기 위해 `examType` 필터를 inner subquery 끝에 두는 SQL 재작성.
  3. ⑦ COUNT DISTINCT 는 `/grade` 응답 streak block 으로 이미 산출 — `/mode` 는 streak_records 영속값만 읽고 dailyGoalProgress 는 클라이언트가 grade 응답 누적치로 산출.
- 우선순위 근거: `/mode` 는 학습자가 study 진입 시 **반드시 첫 호출**. 단일 사용자 페이지 로드가 D1 7개 쿼리 → 분당 5600 쿼리는 시험 시즌 D1 saturation 의 가장 빠른 진앙.
- 반론 (실측 무문제 시나리오): D1 v3 에서 SQLite query planner 가 `exam_type+status` 인덱스(0037)와 `idx_user_progress_weak` 를 동시에 효과적으로 활용하고, 545 row × 2 = 1100 rows_read 이 10K user × 5분 ≈ 분당 13M rows_read 가 paid tier 한도(25B/일 = 17M/분) 아래라면 비용 측면은 OK. 단, **CPU 50ms hot path** 와 D1 RTT × 7 회 (병렬이라 동시) 의 wallclock 30~50ms 는 정상 — 진짜 위험은 **rows_read 누적 비용**(매월 D1 청구) 과 user_progress 가 본격 누적되기 시작하는 Year 1 말 ~ Year 2 초.

### C-2. `/api/search` Multi-Path Fallback 진입 시 Stage 1 + Stage 2 keyword + Stage 3 cluster-then-node 가 직렬 chain — 최악 7회 외부 RTT

- 파일: `apps/api/src/search/routes.ts:107-141` + `multi-path-fallback/index.ts:58-99` + `multi-path-fallback/topic-cluster-router.ts:241-382`
- 측정/추정:
  - 정상 Stage 1+2+3 hit: **3 외부 호출** (bge-m3 ≈ 100~200ms + Vectorize.query ≈ 50~150ms + D1 ≈ 20~50ms) = wall **170~400ms**.
  - graceful (top-1 < 0.6) 또는 stage2Count=0 → Multi-Path 진입:
    - Stage 2 keyword: token N × D1 LIKE (Promise.all 병렬, +1 RTT ≈ 50ms)
    - Stage 3.a: Vectorize.query (cluster 검색, returnValues:true) +1
    - Stage 3.b: D1 fetchClustersByIds +1
    - Stage 3.c: 매칭 cluster M 개 (≤3) **각각 직렬** Vectorize.query + D1 fetchNodesByIds (topic-cluster-router.ts:314-382 `for...await` **시리얼 loop**) → 2M 외부 호출
    - Stage 4: review_queue INSERT +1
  - 최악 (M=3): Stage 1 1 + Stage 2 1 + Stage 3.a 1 + Stage 3.b 1 + (Stage 3.c Vectorize 3 + D1 3) + Stage 4 = **13 외부 round-trip**. 직렬 부분만 봐도 wall 700~1500ms.
- 폭발 트리거:
  - 검색 어려운 자유로운 질의 (graceful 진입 빈도) 가 시험 시즌 학습자에게서 빈번 (수험생은 표준 용어로 질문하지 않음). graceful 비율 20% 가정 시 검색 30K req/일 → 6K req/일 가 multi-path 진입.
  - Stage 3.c 의 `for (const m of matches)` (topic-cluster-router.ts:314) **시리얼** 외부 호출은 부하 곡선이 cluster 매칭 수에 선형 비례.
- 6개월/2년 시나리오:
  - 6개월: Vectorize 인덱스 noise 증가 (cluster 미스율 상승) → multi-path 진입율 20%→30%.
  - 2년: 시험 항목 5K, cluster 수 200+ → Stage 3 매칭 후 Stage 3.c 시리얼 chain 의 평균 M 증가 → p95 ≥ 2초.
- 권장 조치:
  1. Stage 3.c 의 `for...await` 를 `Promise.all` 병렬화 — cluster 매칭은 독립적이고, dedup 은 사후 처리.
  2. Stage 3 (cluster 매칭 + node fetch) 를 Stage 2 keyword 와 **병렬 race**(early-return 짧은 쪽). ADR-019 패턴 적용 — concurrent + short-circuit.
  3. Vectorize V2 binding 의 `$in`/`$ne` 가 정상화되면 STAGE3_NODE_QUERY_OVERFETCH_RATIO=4 제거 → top-K=5 직접 → 1회 호출당 latency -25%.
- 우선순위 근거: 학습자가 직접 경험하는 p95 latency. 1초+ 응답은 검색 신뢰도 폭락 — Phase 3 학습 UX 북극성(`project_ux_north_star_phase3`) 직접 침해.
- 반론 (실측 무문제 시나리오): graceful 진입율이 5% 미만이고 (Stage 1 임계 0.6 이 보수적이라 hit-rate 가 충분히 높으면) Stage 3.c 직렬 chain 자체가 거의 안 일어남. 단 SP-T06 실측 시점에 graceful 분포 측정 필요.

### C-3. Graph walk WITH RECURSIVE 의 depth4 측정치 (41.5ms) 가 Workers free 50ms CPU 와 거의 동률 — paid tier 가정에서도 동시성 부하 발생 시 큐잉

- 파일: `apps/api/src/search/graph-walk/index.ts:79 (MAX_ALLOWED_DEPTH=4)` + `:220-247 (CTE SQL)` + `graph-search-route.ts:75 (GRAPH_SEED_WALK_LIMIT=5)` + `:230-249 (시리얼 5-seed loop)`
- 측정/추정:
  - measurement.md §3.1 실측: depth4 = 41.5ms (단일 시드, MATERIALIZED). depth5 = 67.3ms.
  - `/api/search/graph` 는 baseline top-K (최대 5) **각 시드마다 별도 graphWalk 호출** (graph-search-route.ts:230 `for (const seed of seeds)` 시리얼).
  - 5 seeds × 41.5ms (depth4) = **207ms D1 시간만**. 추가로 baseline (Stage 1+2+3 ≈ 200ms) + 임베딩 ≈ 100~200ms.
  - 합계 wall ≈ **500~700ms 정상 경로**. CPU 측면은 Workers paid 30s 이내 OK 하나 D1 query duration 누적이 위험.
- 폭발 트리거:
  - 시험 시즌 동시 요청 50 RPS × 5 graphWalk = D1 250 추가 쿼리/s. D1 QPS 한도 (수천)에 닿지는 않으나 **CTE materialized 가 메모리 압박** (D1 SQLite 단일 shard 의 메모리).
  - knowledge_edges 가 1274 → 2년 horizon 5K → recursive CTE 의 walk 프론티어가 N × (depth+1) 로 폭증. depth4 × 5K edges 한도 = 25K 프론티어 / walk → 41ms→**200ms+**.
- 6개월/2년 시나리오:
  - 6개월: edges 2K 로 +50% → depth4 측정치 60~70ms = paid OK 이나 free 한도 초과.
  - 2년: edges 5K + 노드 2K → depth4 = 150~250ms = paid 도 동시 50건 시 CPU 큐잉.
- 권장 조치:
  1. **시드 walk 병렬화** — graph-search-route.ts:230 의 `for...of` 를 `Promise.all` 로. CPU 동일하지만 wall-time 1/5.
  2. graphWalk 결과를 **요청별 inMemory dedup 후 단일 union query** 로 batch: WHERE seed IN (...) 로 묶어 D1 RTT 5→1.
  3. 시험 시즌 직전에 edges 의 (`from_node`, `edge_type`, `is_active`) **복합 인덱스 추가** — 현재는 `idx_edges_from`/`idx_edges_type`/`idx_edges_active` 단일 컬럼만이라 query planner 가 한 개만 사용, 나머지는 row-level filter (재귀 매 iteration 반복 → 누적 비용 큼).
  4. MAX_ALLOWED_DEPTH=4 는 D-2 진산 결재 안전선이나, S5-7 통합 후 Stage 2.5 에 들어가면 학습자 모든 검색마다 부담 → 통합 시점에 **maxDepth=2 기본** 으로 강하 후 cache 도입.
- 우선순위 근거: S5-7 결재가 §7 GO 조건 충족 시 학습자 정상 경로에 편입 = 검색 hot path 의 CPU 가 5배. Year 2 데이터 규모 도달 시 paid tier 큐잉 사건이 시험 시즌에 발생.
- 반론: 옵션 C 격리(S5-3) 현 시점 학습자 미노출 — production 영향 0. S5-7 통합이 결재 보류 또는 maxDepth=2 로 항상 사용된다면 wallclock 합산 100ms 이내.

### C-4. `/api/study/grade` 한 요청당 8+ D1 쿼리 직렬 chain — FSRS 채점 hot path

- 파일: `apps/api/src/study/routes.ts:916-1380` (POST /grade)
- 측정/추정:
  - 단일 grade 호출:
    1. `checkAndIncrementRateLimit` (1 D1 round-trip)
    2. `sessionRow` lookup (sessionId 제공 시, 1 RTT)
    3. `question` lookup (1 RTT)
    4. `existing` user_progress lookup (1 RTT)
    5. user_progress UPDATE 또는 INSERT (1 RTT, withRetry 가 최대 3회 retry)
    6. `study_reviews` INSERT (1 RTT)
    7. `study_sessions` UPDATE RETURNING (1 RTT, sessionId 시)
    8. `streak_records` SELECT (1 RTT)
    9. `streak_records` INSERT ON CONFLICT (1 RTT)
    10. `study_reviews COUNT DISTINCT` today (1 RTT)
    11. `enrichRelatedNodes` knowledge_nodes IN 조회 (1 RTT)
  - **모두 await 직렬**. RTT 가 평균 30ms 면 총 wallclock ≈ **330ms**. peak 시 D1 트랜잭션 락 충돌도 가능.
- 폭발 트리거:
  - 동시 사용자 800 × 카드 평균 2분에 1장 풀이 → grade RPS ≈ 7. D1 RPS ≈ 80 (×11).
  - exam_questions/user_progress 가 커지면 ④/⑤ 의 unique_constraint 충돌 비율 증가 → withRetry triggered (1 회당 +30ms × 3 = 90ms backoff).
- 6개월/2년 시나리오:
  - 6개월: 사용자 누적 → user_progress per user 평균 200 row. `uniq_progress_user_card` 인덱스 (0029) hit 정상이지만 INSERT 시 인덱스 갱신 비용 증가.
  - 2년: study_reviews 가 수십M row → ⑩ COUNT DISTINCT range scan (24h) 가 user-partition 내 100~500 row 라 OK, 하지만 글로벌 인덱스 페이지 fragmentation 시 latency 증가.
- 권장 조치:
  1. `enrichRelatedNodes` (knowledge_nodes IN) 를 **응답 후처리 후 background 또는 클라이언트 캐시**로 분리 — grade 결과(isCorrect+correctAnswer+explanation) 는 question 행에 이미 존재. relatedNodes 는 클라이언트가 이미 /next 단계에서 받았으므로 grade 응답에서 redundant.
  2. `streak_records` ⑧+⑨ 를 단일 `INSERT ... ON CONFLICT DO UPDATE RETURNING current_streak,...` 로 **2→1 round-trip** (현재 select-then-upsert 패턴은 read-modify-write race 가능성도 있음).
  3. ④+⑤ UPSERT 를 D1 batch 또는 `INSERT ... ON CONFLICT DO UPDATE` 단일 statement 로 통합 (uniq_progress_user_card 인덱스 활용) — RTT 1회 절감 + race 자체 차단.
  4. 채점 자체(`gradeAnswerByType`)는 CPU 인프라가 아닌 D1 chain 이 hot path — 직렬 chain 길이 자체를 ≤ 6 으로 축소하는 것이 최우선.
- 우선순위 근거: grade 는 학습자가 매 카드 마다 호출 = 가장 빈번한 쓰기 hot path. 330ms wallclock 은 정답 표시 지연 = 학습 흐름 파괴 (학습 UX 북극성).
- 반론: 현재 grade 응답 SLO 가 500ms 정도라면 ms 마진 충분. 실측 wrangler tail 으로 p50/p95/p99 잡고 GO/NO-GO 결정 필요. 또한 D1 batch 가 Workers SDK 에서 transactional 보장이 아니므로 batch 화 시 idempotency 검토 필요.

### C-5. `app.use('*', PRAGMA foreign_keys=ON)` 가 **요청마다 D1 PRAGMA 호출** — 모든 요청에 추가 RTT

- 파일: `apps/api/src/index.ts:136-153`
- 측정/추정:
  - 모든 라우트(health 제외) 진입 직전 `await c.env.DB.exec('PRAGMA foreign_keys = ON')` — D1 연결 풀에서 connection-scoped 라 매 isolate invocation 마다 실행.
  - D1 prepared statement RTT 20~40ms 추정 (paid tier, edge→D1 region).
- 폭발 트리거:
  - 학습자 1세션이 30분간 60+ API 호출 → 매 호출 +30ms = **누적 1.8초** 의 PRAGMA 오버헤드.
  - 시험 시즌 50 RPS × 30ms = D1 동시 PRAGMA 쿼리 1.5 RPS 추가.
- 6개월/2년 시나리오:
  - 데이터 규모 무관. **요청 수만 따라간다**. 10K user × 시험 직전 60 req = 600K req/day 의 PRAGMA = 매월 D1 비용 노이즈.
- 권장 조치:
  1. **Cloudflare D1 의 FK 는 connection 단위가 아니라 query 단위로 발현**. 매 prepare 시 FK 가 적용되도록 D1 binding 의 기본 동작 확인 필요. 만약 D1 가 PRAGMA 적용 connection 을 cache 한다면 isolate 당 1회로 충분 — `globalThis` flag 캐싱.
  2. 또는 D1 의 wrangler.toml binding 설정에 PRAGMA 정적 적용 옵션 (있다면) 채택.
  3. 최악의 경우 PRAGMA 없이도 **FK constraint 가 D1 default 인가** 확인 → default ON 이면 본 미들웨어 자체 제거. (D1 docs: "PRAGMA foreign_keys is per-connection" — D1 의 connection 추상화는 Workers 의 isolate 와 다른 layer 이며, 매 prepare 마다 FK 가 적용되는지 확인 필요. 본 patch 는 안전을 위한 보수적 선택이나 실측 비용은 정량화 의무.)
- 우선순위 근거: 모든 요청에 영향 — 가장 넓은 면적의 부채. 30ms × 10K user 의 누적은 단일 endpoint 최적화보다 큰 임팩트.
- 반론: PRAGMA 가 D1 측에서 caching 되어 실제 RTT 무영향일 수 있음 (D1 가 connection pool 을 wrangler 내부에서 hot-reuse). 실측 필요 — Cloudflare D1 trace 로 PRAGMA round-trip 시간 확인.

---

## MAJOR — 8건

### M-1. `embedQuery` (Workers AI bge-m3) 호출 캐싱 부재 — 동일 query 반복 시 매번 fresh embedding

- 파일: `apps/api/src/search/user-search.ts:183-193` + `routes.ts:110`, `graph-search-route.ts:177`
- 추정: bge-m3 호출 100~200ms (Workers AI 자체), 토큰 비용 있음.
- 학습자가 동일 검색 (다른 카드 시도 도중 같은 키워드 재검색) 시점에 캐시 없음 — request-scoped 만 재사용 (routes.ts 의 Pass 2 MAJ-1).
- 권장: query string + examId 해시 키로 **Workers Cache API 300s 캐싱**. embedding 자체는 stateless 이므로 PII 우려 0.

### M-2. `keyword-fallback` 토큰별 `LIMIT 50` × N tokens — 토큰 N=5 일 때 사실상 D1 250 candidate scan/req

- 파일: `apps/api/src/search/multi-path-fallback/keyword-fallback.ts:36 (KEYWORD_PER_TOKEN_LIMIT=50)` + `:189-214`
- 추정: 한국어 자연 query 토큰 평균 3~5. 토큰별 D1 LIKE `%token%` 매칭은 **인덱스 미사용** (`LIKE '%...%'` 는 SQLite 에서 full scan). knowledge_nodes 794 → 5K (Year 2) 시점에 매 호출 5K × 5 토큰 = 25K rows_scanned. graceful 진입 비율 20% 가정 시 분당 누적 scan 비용 큼.
- 권장: knowledge_nodes 에 **FTS5 가상 테이블** (`name`, `description` 인덱싱) 도입. D1 가 SQLite FTS5 지원. LIKE 매칭이 inverted index 로 sub-ms 변경.

### M-3. `study/routes.ts /next` 의 ORDER BY 는 user_progress JOIN 가 LIMIT 1 케이스에서도 매번 full scan-then-sort

- 파일: `apps/api/src/study/routes.ts:819-848`
- ORDER BY `(up.id IS NULL) DESC, COALESCE(up.correct_count, 0) ASC, COALESCE(up.total_reviews, 0) ASC, eq.id ASC` — **세 컬럼 모두 NULL-safe COALESCE**, planner 가 인덱스 사용 못 함 → 전수 LEFT JOIN 후 sort.
- exam_questions 545 → 5K 시점에 **매 /next 호출이 5K row sort** = 50~100ms wall.
- 권장: `WHERE up.id IS NULL` 우선 query → 0건이면 두 번째 query 로 fallback. D1 query planner 가 COALESCE+OR 를 인덱스로 못 푸는 SQLite 한계.

### M-4. `/api/study/progress` 의 daily strftime+CASE GROUP BY 가 study_reviews 의 인덱스 부분 활용에 그침

- 파일: `apps/api/src/study/routes.ts:1621-1633`
- `strftime('%Y-%m-%d', reviewed_at, '+9 hours') AS date` 를 GROUP BY 키로 사용 — function 결과는 인덱스 무관, 전체 range scan 후 메모리 group.
- 사용자별 study_reviews 가 6개월 후 수천 row, 1년 후 만 단위 → 30일 range scan 후 GROUP BY 가 CPU 부담.
- 권장:
  1. **`reviewed_date_kst` (TEXT YYYY-MM-DD) 컬럼 추가 + 인덱스** — INSERT 시 KST date 산출(grade 핸들러 todayDateString 이미 있음).
  2. 또는 sub-aggregation: 일별 distinct card 카운트를 별도 `study_reviews_daily` materialized view 로 매일 cron 으로 집계.

### M-5. Workers PBKDF2 100k iterations × constant-time verify + 매 login 마다 dummy-verify (timing 평탄화) = login p99 100ms+

- 파일: `apps/api/src/auth/password.ts:159-183` + `routes.ts:334-355` + `constants.ts:35 (PBKDF2_ITERATIONS=100000)`
- ADR-035 §"Workers 영향" 명시: 약 20~30ms CPU per hash. login 1회 = 1 hash (성공) 또는 dummy hash (실패) = 20~30ms CPU.
- needsRehash=true 경로 (PBKDF2_ITERATIONS toggle 후) = **추가 hash 1회** + UPDATE 1 RTT = +30ms 이상.
- 시험 시즌 첫 진입 동시 800 로그인 = D1+CPU 동시 부하 spike.
- 권장:
  1. CPU 자체는 50ms 한도 내 안전. 단 동시 800 로그인 spike 시 isolate cold-start 와 결합되면 p99 가 무너짐 → **Cloudflare Cache 사전 warmup** 으로 isolate 보존.
  2. ADR-035 §"복원 의무" 의 Argon2id 검토를 Phase 3 launch chain 직전 carry-over 영속 — 실패 시 100k 영구 약점.

### M-6. `/api/search/graph` 의 baseline 응답을 **응답 body 에 포함** (전체 `UserSearchResult` 그대로)

- 파일: `apps/api/src/search/graph-search-route.ts:108-117 (GraphSearchResponse)` + `:280-287 (resp body)`
- baseline.results 의 description 필드는 본문 텍스트 — 한국어 평균 100~500 byte × top-K 5 = 2KB 이지만, **graph 확장 results 와 중복 surface** (results 안에 baseline 도 다시 포함). 응답 페이로드 ≈ 4~10 KB.
- A/B 비교 측정용으로 필요한 baseline 메타만 노출하고 (top-1 score, count), description 같은 텍스트는 measurement 후 strip — Phase 2 측정 종료 후 carry-over 명시.
- Workers 응답 페이로드 cost: outbound bandwidth 는 무료(현재)이나 JSON 직렬화 CPU + heap 가 비용. heap 측면: 동시 50 요청 × 10KB = 500KB heap.

### M-7. Astro `client:load` 3개 island 동시 hydration — study 페이지 첫 진입 시 main thread 차단

- 파일: `apps/web/src/pages/study.astro:20 (ProgressViz client:load)`, `:27 (StudyFlow client:load)`, `:30 (OfflineIndicator client:load)`
- `client:load` = 페이지 load 즉시 React hydration 시작 = JS parse + react render 가 main thread 차지. 모바일 80% (CLAUDE.md 명시) 환경에서 **저사양 폰의 첫 페인트 후 인터랙티브 까지 LCP+TBT 가 1~2초** 가능.
- StudyFlow + ProgressViz 가 각각 fetch (`/study/mode` + `/study/progress`) **동시 호출** → 클라이언트 동시 2 round-trip + 위 C-1 의 7-쿼리 부하 fan-out.
- 권장:
  - `ProgressViz` → `client:idle` 또는 `client:visible` (스크롤되어야 보이면 충분).
  - `OfflineIndicator` → `client:idle` (오프라인이 되어야 의미 있음, 초기 1초는 무관).
  - StudyFlow 만 `client:load` 유지.

### M-8. `apps/web` 번들 — Dexie 4 + React 19 + Zustand + Tailwind + Dexie 의 IndexedDB schema 9 stores 가 첫 페이지 모두 import

- 파일: `apps/web/package.json` + `apps/web/src/lib/db.ts:172-204`
- Dexie 4 ≈ 30KB gz, React 19 ≈ 45KB gz, Zustand ≈ 1KB gz, Tailwind (purged) 작음. 총 클라이언트 번들 추정 100KB gz 이내 정상이지만,
- `db.ts` 가 페이지 진입 시 9 store 정의 + IndexedDB connection 오픈 = idle 비용. 학습자 첫 진입에서 IndexedDB read 가 필요하지 않은 경로 (login, /next 단순 호출) 도 db 인스턴스 ready 비용.
- 권장: `db.ts` 를 동적 import (`const { db } = await import('@/lib/db')`) 로 분리. 인증/온보딩 페이지 번들에서 Dexie 제거.

---

## MINOR — 5건

### m-1. `apps/api/src/search/multi-path-fallback/index.ts:97` `topicResult.diagnostics` 가 production 응답에서도 항상 surface

`topic-cluster-router.ts` 의 `TopicClusterDiagnostics` 가 7 개의 카운터를 직접 노출 — 운영자 진단용으로는 OK 이나 응답 페이로드 +200B/req. 운영 측정 종료 후 environment 분기 strip 의무 carry-over (이미 routes.ts:135 `stripStage3Diagnostics` 정합 패턴 있음).

### m-2. `apps/api/src/search/multi-path-fallback/keyword-fallback.ts:73-84` `tokenizeQuery` 가 매 호출 정규식 컴파일

`KOREAN_PARTICLE_PATTERN` 은 모듈-스코프 const 라 1회 컴파일 OK. 단 `.replace(/[\p{P}\p{S}]/gu, '')` 는 inline literal 라 V8 가 캐시할 수도 있으나 micro-bench 차원 한 자리 µs 절약 가능. 우선순위 낮음.

### m-3. `apps/api/src/search/graph-walk/index.ts:220-247` SQL 의 ORDER BY 가 `depth ASC, a3.id ASC` — id 가 TEXT 라 SQLite 가 정렬 비용 (string compare) 발생

resultCap 50 기준 string sort 50 entries = sub-ms. 단 cap 500 시 가시화. 부하 작아 minor.

### m-4. `formula-engine/sandbox.ts:265-281 computeAstDepth` 는 iterative DFS OK 이나 `node.forEach` 가 child 배열 생성 — 깊은 AST 에서 GC 부담

MAX_AST_DEPTH=15 + 정상 산식 ≤ 10 라 GC 영향 무시 가능. 단 추후 LLM 생성 산식 분석 (ADR-029) 시 검토 carry-over.

### m-5. `apps/web/src/components/progress/ProgressViz.tsx:212-302` 의 SVG ring + dot strip 은 매 state 변경 시 재렌더 — useMemo 부재

학습 중 1분에 1회 정도 변경이라 영향 미미. 단 grade 응답 후 `/progress` refetch 시 hydration mismatch 가능성 carry-over.

---

## Devil's Advocate (각 CRITICAL 별 반론 한 줄 + 종합)

- C-1 반론: rows_read 가 D1 paid 무료 한도(25B/일) 와 비교해 sub-percent 이면 단순 비용 무문제. 단 wallclock 측면도 측정해야 — 실측 wrangler tail 후 의사결정.
- C-2 반론: graceful 진입율이 실측 5% 미만이면 직렬 chain wallclock 평균은 무문제. 단 진입 시 p99 가 학습자 신뢰에 결정적 — 평균 아닌 p99 측정 필수.
- C-3 반론: S5-7 결재가 보류되어 옵션 C 격리 유지되면 학습자 영향 0. 단 S5-7 결재가 통과되는 순간 즉시 노출 — 통합 게이트에 본 항목 필수 점검.
- C-4 반론: 학습자가 grade 후 즉시 다음 카드로 넘어가는 흐름이 500ms 까지 허용된다면 (학습 UX 관점) OK. 단 grade 결과 표시 후 retention(설명 읽기) 동안 background prefetch /next 가 작동하면 체감 latency 무관 — 클라이언트 prefetch 패턴 도입이 grade 최적화보다 효율적일 수도 있음.
- C-5 반론: D1 가 isolate-local connection pool 을 갖고 있어 PRAGMA 가 첫 호출만 RTT 발생하고 이후 cached 라면 실제 비용 0. **본 항목은 실측이 가장 시급**.

종합 반론: 본 리뷰는 production traffic 실측 부재 — 모든 수치가 **모델 가정 기반**. 시험 시즌 진입 전 SP-T06/T07 측정 + wrangler analytics 데이터 1주일 수집 후 CRITICAL 재분류 필수.

---

## 다른 페르소나가 못 볼 각도

- **WITH RECURSIVE CTE 의 D1 paid tier rows_read 청구**: refactoring/quality 는 SQL 가독성만 보고, backend-architect 는 schema 모델링을 보지만, "depth4 측정치 41.5ms × 동시 50 RPS = D1 단일 shard CPU contention" 은 performance 만의 관점.
- **PRAGMA foreign_keys 비용 (C-5)**: 보안/품질/스키마 관점에서는 "당연한 안전선"이지만 매 요청 비용 관점이 누락. devops 도 운영 청구를 보지만 코드 path 의 hot loop 가 어디서 발생하는지는 코드 정독 필요.
- **시리얼 for-await 두 곳**(C-2 Stage 3.c, C-3 시드 walk): refactoring 는 "코드 정합성" 으로 통과시키지만 동시성 부족이 부하 곡선의 기울기를 결정.
- **Workers AI bge-m3 캐싱 부재 (M-1)**: backend-architect 가 캐시 layer 를 보더라도 embedding 자체는 의미가 일정해 cache 가능하다는 도메인 사실은 검색 hot path 분석에서만 보임.
- **Astro client:load 3중 동시 hydration (M-7)**: quality 는 RPM 안 봄, refactoring 는 React 컴포넌트 형태 보지만 SSR hydration 비용 모름. 모바일 80% 환경에서 LCP 의 직접 침해.

---

## 측정 권고 (우선순위 순)

1. **wrangler tail `/api/search` + `/api/search/graph` + `/api/study/*` 실 p50/p95/p99 latency 1주간 수집** — 본 리뷰의 모든 wallclock 추정치 검증 1차 데이터.
2. **D1 analytics 의 rows_read per endpoint per hour** — C-1 (mode 7-쿼리 fan-out) / C-4 (grade chain) 의 실제 D1 단가 측정.
3. **PRAGMA foreign_keys 의 D1 RTT 분포** (C-5) — wrangler logs 의 첫 D1 호출과 두번째 호출 RTT delta 측정. 동일하면 connection-cached, 큰 차이면 매 isolate 마다 RTT 발생.
4. **Workers AI bge-m3 호출 분포** — 동일 query digest (`log-redact.ts`) 가 N분 내 재호출되는 비율 → M-1 캐싱 ROI 산출.
5. **Multi-Path graceful 진입율** (Stage 1 < 0.6 또는 stage2Count=0 비율) — C-2 우선순위 재정렬 기준.
6. **knowledge_edges 의 (`from_node`, `edge_type`, `is_active`) 복합 인덱스 EXPLAIN QUERY PLAN** — C-3 의 graph walk 가 인덱스 hit 인지 row-level filter 인지 확정.
7. **Lighthouse mobile LCP/TBT** — Astro 빌드 후 production URL 에서 측정. M-7 (3중 client:load) 의 영향 정량화.
8. **`/api/study/grade` end-to-end p95** 분해 — D1 쿼리별 wallclock breakdown 으로 C-4 의 8+ chain 중 실제 병목 식별.

부족한 측정은 fabricate 금지 (CLAUDE.md RULE #4/#5) — 본 리뷰 수치는 "10K 부하 모델 가정 + 코드 패턴 분석"이며 실측 wallclock 은 진산 운영 시점 데이터 의무.
