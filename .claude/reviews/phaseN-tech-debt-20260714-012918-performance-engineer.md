# Phase N 기술부채 리뷰 — performance-engineer

- ts: `20260714-012918`
- 관점: 런타임 부채 — "10K 사용자에서 뭐가 터지나?"
- 합계: CRITICAL 0 / MAJOR 3 / MINOR 2

---

## PE-1 (MAJOR) — 인증 hot path 전건이 rate-limit 용 D1 write 발생 (네이티브 바인딩 미사용, write amplification)

- 파일: `apps/api/src/study/routes.ts`
- 라인: 1035, 782

`/grade`(1035)·read 4종(`enforceStudyReadRateLimit`, 782)이 매 요청마다 `checkAndIncrementRateLimit(c.env.DB,...)` 호출 = `rate_limits` UPSERT+RETURNING = **요청당 D1 write 1건**. 공개 표면은 이미 Cloudflare 네이티브 Rate Limiting 바인딩(public/rate-limit.ts:33, D1 미접촉) 사용 → 동일 목적 두 구현 공존, 인증 경로만 D1 쓰기. 10K 학습 세션이면 정상 트래픽만으로 초당 수십~수백 rate_limits write → D1 write 예산·writer 경합 잠식.

- **★교차: backend BE-2(GC/retention)와 동일 테이블(rate_limits) 공동 압박점. RC-3 진앙.**
- 반론: UPSERT+RETURNING 1 round-trip 최적화 완료(CR-2), 현 규모 무해. 네이티브 바인딩은 per-user 세분·429 retryAfter 유연성이 D1 만 못할 수 있어 단순 교체 아님 → 규모 전 MINOR 강등 가능.
- Horizon: 10K 동시 학습 유저 진입 시 — D1 write QPS/과금 + writer 경합으로 grade p95 상승.
- 권고: 인증 rate-limit 도 네이티브 바인딩 통일(key=`${userId}:grade`/`${userId}:study-read`). D1 rate_limits 는 감사·장기 카운팅 경로만 잔존.

## PE-2 (MAJOR) — `/study/grade` 단일 채점이 D1 8~10 왕복 직렬 chain (subject 집계 JOIN 매 grade 추가)

- 파일: `apps/api/src/study/routes.ts`
- 라인: 1035→1066→1097→1145→1181→1218

rate-limit write → session → question → existing progress → subject 집계 JOIN(ADR-048, 1181) → UPDATE → study_reviews INSERT → streak → session advance 직렬. Edge→D1 RTT ~30~50ms × 8~10 ≈ 300~500ms/grade. subject 집계는 FSRS 계산과 독립인데 직렬. enrichRelatedNodes(1136)도 독립인데 순차. `/study/next` 는 이미 Promise.all 병렬화(981)했으나 grade 경로 미적용.

- 반론: chain 상당수는 본질적 직렬(question→채점, existing→FSRS). 병렬 여지는 enrichRelatedNodes+subject집계 2~3 왕복. subject 집계는 단일유저 progress(≤525행) 유계 → latency 품질 이슈에 근접(MINOR 근접).
- Horizon: launch 후 헤비 학습자 + 모바일 고RTT / Year 2 progress 수백행 누적.
- 권고: 독립 read 를 existing-progress lookup 과 Promise.all 병렬화. subject 집계는 정답률 캐시 컬럼(user_subject_stats) 물질화 또는 weak_score 재계산 waitUntil 로 임계경로 분리.

## PE-3 (MAJOR) — 최다호출 공개 서빙 `/questions/next` 가 `ORDER BY RANDOM()` (인덱스 정렬 불가 + no-store)

- 파일: `apps/api/src/public/routes.ts`
- 라인: 319

`... ORDER BY RANDOM() LIMIT 10`. SQLite/D1 에서 RANDOM() 정렬 = WHERE 매칭 전 행에 RANDOM() 산출 → 전량 materialize+filesort, idx_exam_questions_active_subject 무력. 최다 hot endpoint 이며 cache-policy.ts:77-79 로 no-store(매 요청 셔플). 후보 10행에 대형 content TEXT 조회. 0037 주석 자체가 '미래 5K+' 전망 → 그 규모에서 매 서빙 O(N log N) + 대형 컬럼 전송이 Workers 50ms CPU 예산 잠식.

- 반론: 현 521행 마이크로초급, 실측 영향 0(현 MINOR). D1 이 LIMIT 아래 정렬 부분최적화 가능성. 진성 병목은 N 확장 후.
- Horizon: 1차 코퍼스 5K+ 확장 + 런칭 트래픽 동시 도래 시 서빙 CPU/latency 선형 악화.
- 권고: 인덱스 활용 랜덤 픽 — (a) COUNT 후 `OFFSET floor(rand*count) LIMIT 1` 또는 (b) rowid 상한 피벗 샘플링. projection 불필요 컬럼 최소화.

## PE-4 (MINOR) — `/questions/overview` cache-miss 마다 active 코퍼스 전량 JS JSON.parse (Worker 응답 헤더만으론 edge 캐시 안 됨)

- 파일: `apps/api/src/public/routes.ts`
- 라인: 245, 259

지형도 집계가 active 1st 전량 조회 후 `rows.filter(isServable)` 로 매 행 parseMcChoices(JSON.parse) JS 수행. cache-policy.ts:68-70 `public, max-age=300` 은 **브라우저** 캐시일 뿐 — Worker 생성 응답은 헤더만으론 edge 미저장(caches.default 명시 필요). 신규 방문자·5분마다 origin 전 코퍼스 스캔+N회 parse 재수행.

- 반론: max-age=300 이 동일유저 반복 로드 흡수, 521행 parse 수 ms. 진짜 부담은 코퍼스 5K+ & 유니크 방문자 폭증 동시. routes.test.ts:434 가 헤더 부재를 의도 문서화.
- Horizon: 코퍼스 확장 + 랜딩 유니크 방문자 급증 시.
- 권고: servable count 를 subject×round 사전 물질화 또는 caches.default 로 edge 실캐시. 최소 SQL 집계(COUNT GROUP BY)로 JS 전량 필터 제거.

## PE-5 (MINOR) — `/study/next` weak 모드 ORDER BY 가 COALESCE 계산식 정렬 (LEFT JOIN 전량 filesort)

- 파일: `apps/api/src/study/routes.ts`
- 라인: 880

`ORDER BY (up.id IS NULL) DESC, COALESCE(up.weak_score,0) DESC, ...`. driving table = exam_questions 후 계산식 정렬 → idx_user_progress_weak 정렬 단계 무력, 조인 결과 전량 filesort. 매 /next 발생.

- 반론: LIMIT ≤5, exam_questions 수백행 규모 filesort 현재 무시가능. weak 모드 소수 호출.
- Horizon: 코퍼스 + user_progress 수천행 누적 시.
- 권고: user_progress(weak_score DESC) 인덱스 선두 스캔 + 미시도분 UNION 2단, 또는 세션 시작 시 후보 큐 사전산출.

---

## checkedItems (증거 기반 PASS/N-A)

- PASS — idx_exam_questions_active_subject partial 인덱스 존재 (migrations/0037:20)
- PASS — enrichRelatedNodes fan-out 유계 RELATED_NODES_MAX=20 slice (routes.ts:106,550,559)
- PASS — /study/next N+1 이미 Promise.all 병렬화 (routes.ts:981-1010, C-07 흡수)
- PASS — 공개 rate-limit 네이티브 바인딩(D1 무접촉) limiter.limit (public/rate-limit.ts:33)
- PASS — choiceId HMAC importKey 캐시(60-76), keyMaterial 극소 Map 무한성장 없음
- PASS — 성능 회귀 CI 게이트 존재 PRF-01/PRF-02 + graph-integrity N=5000 (1494fa7/1b01254) ※단 CI ×3 slack 이슈는 quality QA-2 참조
- PASS — study rate-limit UPSERT+RETURNING 1 round-trip 원자화(CR-2) — 단 D1 write 자체 잔존(PE-1)
- PASS — overview 200 한정 공용캐시, 429/500 은 no-store 강하 (cache-policy.ts:66-70)
- N/A — Vectorize/graph-walk hot path: /api/search/graph 옵션 C 격리(학습자 비노출, G-S5 측정중) → 서빙 부하 대상 아님
- PASS — knowledge_nodes IN 조회 is_current_active=1 + idx_knowledge_nodes_active (routes.ts:559)
