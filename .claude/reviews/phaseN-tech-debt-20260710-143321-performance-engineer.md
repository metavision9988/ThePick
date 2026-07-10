# Phase N 기술부채 리뷰 — performance-engineer (런타임 부채)

- 관점: "10K 사용자에서 뭐가 터지나?"
- 스코프: promo-1st P0~P5 공개 무인증 표면 hot path 중심
- 일시: 2026-07-10 14:33 (ts 20260710-143321)
- 발견: CRITICAL 0 / MAJOR 4 / MINOR 3

## MAJOR

### PF-M1. 공개 서빙 /questions/next = ORDER BY RANDOM() 전 풀 스캔/요청 — rows-read 소진·지연이 문항 뱅크에 선형

- 위치: `apps/api/src/public/routes.ts:312-316`
- 상세: 무인증 hot path가 매 요청 `ORDER BY RANDOM() LIMIT 10` — 인덱스(0001:132-133, 0002:34, 0032:25)는 WHERE 축소만 하고 RANDOM 정렬은 일치 전 행(현 MC 521 / flip 1,046)을 스캔·정렬한다. no-store(cache-policy.ts:77-80)라 캐시 완충 0. 산정: 10K DAU × 세션 1회 ≈ 일 78M rows read. Workers/D1 무료 플랜이면 일일 rows-read 한도(≈5M/day)로 **~600 DAU 수준에서 D1 오류 = 홍보 표면 전면 다운**, 유료면 비용은 여유이나 p95 지연이 뱅크 크기에 선형 성장. 특히 '통합 계정 = 플랫폼 공유 D1' 결재(2026-07-04) 하에 2호 전기기사 문항이 동일 exam_questions에 적재되면 WHERE exam_type 인덱스로도 RANDOM 스캔 분모가 수천 행으로 커진다.
- Devil's Advocate: 현 뱅크 ~1K행은 SQLite에겐 미미(스캔 수 ms)하고, 유료 플랜이라면 25B rows/월 포함량의 ~10% 이내라 '터진다'는 무료 플랜 가정에 의존한다 — production 플랜 확인 시 MINOR 강등 가능. 단 플랜이 repo에서 확인 불가하다는 사실 자체가 홍보 트래픽 앞 미검증 전제.
- Horizon: 무료 플랜이면 홍보 바이럴 ~600 DAU 즉시 / 유료면 2호 공유 D1 적재 + 문항 뱅크 5~10배 성장 시(6~12개월)
- 권고: ① production Workers/D1 플랜 실측 확인(즉시) ② servable 문항 id 리스트를 Worker isolate 메모리(TTL 5분) 또는 KV에 캐시 → 랜덤 픽 후 `WHERE id = ?` 단건 조회로 rows-read O(1)화 ③ 서빙 exclude 파라미터(PF-M4 와 동시 해소)

### PF-M2. overview '5분 공용 캐시' 전제가 workers.dev에서 미실현 — 실제는 브라우저 캐시뿐, 매 방문자당 전 행 전송 + O(N) JSON.parse

- 위치: `apps/api/src/middleware/cache-policy.ts:63-71`
- 상세: cache-policy는 `Cache-Control: public, max-age=300` 헤더만 설정한다. API Worker는 커스텀 도메인 없이 workers.dev 서빙(wrangler.toml에 route/custom_domain 부재, index.ts:32 CORS도 pages.dev만) — workers.dev 응답은 Cloudflare 공유 엣지 캐시를 타지 않고, 커스텀 도메인이어도 JSON 동적 응답은 Cache Rule 또는 Cache API 명시 없이는 엣지 캐시 안 된다. 즉 '공용 캐시 5분 무해' 설계 전제(routes.ts:227 주석)가 인프라에서 실현되지 않아, **유니크 방문자마다** overview가 1,046행 전량(SELECT에 distractors JSON 블롭 포함, routes.ts:242-249) D1→Worker 전송 + 행별 parseMcChoices JSON.parse(isServable, routes.ts:256)를 수행한다. 방문자 = 랜딩 진입 + picker 복귀마다 PracticeMap이 호출(PracticeMap.tsx:27-29). CPU도 O(N): 뱅크 5배 성장 시 행별 파스 합계가 무료 플랜 CPU 한도(10ms/요청)에 근접.
- Devil's Advocate: 브라우저 캐시(max-age=300)만으로도 1인당 5분 1회로 억제되고 overview는 세션당 1~2회뿐이라 총량은 /next 대비 부차적 — PF-M1 을 고치면 이 항목의 rows-read 기여는 10~15% 수준이라 MINOR 강등 여지. 단 '공용 캐시'라는 설계 주석과 실배포 인프라의 괴리는 후속 결정(TTL 연장 등)을 오염시키는 문서-현실 드리프트라 독립 가치가 있다.
- Horizon: 서브도메인 전환({exam}.thepick.co.kr) 시 캐시 룰 미설정이면 그대로 이월 — 10K DAU 진입 + 문항 뱅크 성장(6~12개월) 시 CPU·rows-read 양축
- 권고: ① 커스텀 도메인 전환 시 overview 경로 Cache Rule(또는 Worker 내 caches.default put/match) 명시 ② 단기: overview를 SQL GROUP BY 근사 + servable 정밀 카운트를 5분 TTL Worker 메모리 캐시로 ③ SELECT projection에서 distractors 블롭 대신 필요 최소 컬럼 검토

### PF-M3. 읽기 전용 공개 hot path에 매 요청 PRAGMA foreign_keys exec = 불필요한 직렬 D1 RTT +1 (선재 코드가 무인증 스케일에 노출)

- 위치: `apps/api/src/index.ts:145-162`
- 상세: 전역 미들웨어가 모든 요청에서 `DB.exec('PRAGMA foreign_keys = ON')`을 await 한 뒤에야 본 쿼리를 실행한다. 공개 표면은 SELECT 전용(routes.ts /next·/grade·/reveal·/overview 전부 읽기)이라 FK 강제는 이 경로에서 무의미한데, 요청당 직렬 체인이 [rate-limiter RTT → PRAGMA RTT → SELECT RTT] 3홉이 된다. D1 왕복 ~5-20ms 기준 공개 표면 p50에 ~수-수십 ms 순수 가산 + D1 쿼리 수 2배. 선재 코드(2026-04 작성)지만 당시는 인증 저트래픽 전제 — promo-1st가 무인증 고트래픽 표면을 이 체인 위에 신규 마운트하며 노출 배율이 바뀌었다.
- Devil's Advocate: PRAGMA는 rows read 0이라 비용 영향은 없고 지연만이며, D1이 FK를 기본 활성한다면(문서 확인 필요) 이 exec 자체가 no-op에 가깝다 — '터진다'가 아니라 '느리다' 축이므로 MINOR 강등 가능. 반론의 반론: 무인증 표면의 첫인상 지연은 홍보 전환율에 직결되고, 제거 비용이 거의 0(경로 조건 분기 1줄)인 부채를 방치할 이유가 없다.
- Horizon: 홍보 트래픽 스파이크 시 즉시 p95 체감(치명 아님·누적 UX 부채) — 6개월 내 공개 표면 트래픽 성장과 함께
- 권고: 쓰기 라우트(auth/progress/webhooks/telemetry)에만 PRAGMA 미들웨어 적용하거나, D1 FK 기본 동작 실측 확인 후 전역 제거. L3 아님(스키마 무접촉)이나 무결성 원칙 관련이라 변경 시 회귀 테스트 동반

### PF-M4. 클라이언트 중복 회피 = 최대 3회 직렬 /next 재호출 — 서버 exclude 부재로 좁은 필터 세션에서 요청·스캔 3배 증폭

- 위치: `apps/web/src/components/public/PublicPracticeApp.tsx:61-72`
- 상세: fetchNext가 servedIds 중복이면 fetchPublicNext를 **직렬로** 최대 3회 재호출한다. 서버는 무상태 랜덤(exclude 파라미터 없음, routes.ts:283-333)이라 지도 진입(subject×round) 풀은 회차당 ~25문항 수준 — 세션 10문항 진행 후반부 중복 확률 ~36%+로 재시도가 상시 발동한다. 효과: ① 사용자 체감 지연 = RTT×3 직렬(모바일 ~1초+) ② 서버 ORDER BY RANDOM() 스캔 3배(PF-M1 증폭) ③ per-IP 60/min rate limit 예산 소모 가속(wrangler.toml:112) — 빠른 학습자가 세션 중반 429에 걸리는 경계. 세션 길이 확대(DEFAULT_SESSION_SIZE 10→20, constants.ts:63)나 문항 적은 회차에서 즉시 악화.
- Devil's Advocate: 증폭이 ×3으로 유계이고 재시도는 중복 적중 시에만 발동하므로 광역 필터(전체 랜덤)에서는 드물다 — 평균 배율은 1.1~1.3× 수준일 수 있어 MINOR 강등 여지. 단 '회차 탭 = 좁은 풀' UX(PracticeMap onPick)가 1급 진입 동선이라 최빈 경로가 곧 최악 경로.
- Horizon: 좁은 필터(회차 탭) 세션에서 즉시 발현, 홍보 트래픽에서 서버 부하 배율로 확대 (0~3개월)
- 권고: ① /next에 `exclude=id1,id2,...`(상한 ~20) 쿼리 파라미터 추가 → SQL `AND id NOT IN(...)` ② 또는 세션 시작 시 후보 10문항 일괄 서빙(1 RTT) 후 클라이언트 순회 — rate limit 예산·지연·스캔 동시 해소

## MINOR

### PF-m1. choice-id HMAC — 호출마다 importKey 재수행 + 보기별 직렬 await (버스트 시 CPU 미세 누적)

- 위치: `apps/api/src/public/choice-id.ts:43-54`
- 상세: hmacHex가 매 호출 crypto.subtle.importKey를 반복한다(CryptoKey 캐시 없음). MC 서빙 = 보기 5개 직렬 발급(routes.ts:196-203), 채점 = resolveChoiceId ≤5회 + 정답 choiceId 재발급 직렬(routes.ts:437-448) → 요청당 최대 ~10회 importKey+sign 직렬 await. 건당 수십 μs라 현재 무해하나, 무료 플랜 CPU 10ms/요청 예산에서 오버뷰·zod 파스와 합산되는 고정비이며 isolate 재활용 시 키 캐시로 전부 제거 가능한 낭비.
- DA: 총합 <1ms로 예산 대비 1~10% — 측정 없이 최적화하지 말라는 원칙상 가장 강등 가능한 항목. 기록 목적.
- 권고: 모듈 레벨 `Map<secret, Promise<CryptoKey>>` 캐시 + 발급 루프 Promise.all 병렬화 (동작 동일·결정성 불변). (Horizon: 12개월+)

### PF-m2. blank 모드 = 현 데이터에서 항상 404이나 매 시도마다 525행 전량 스캔 (dead-weight 쿼리)

- 위치: `apps/api/src/public/routes.ts:292-333`
- 상세: fill_blank 풀 = 구 525행 전부 MC-in-disguise = isServable 전부 false(routes.ts:162-177 주석 자인) → blank 모드 /next는 525행 RANDOM 스캔 후 후보 10개 전원 탈락 → 404. 기능 갭(BE-1 대기)은 알려진 사실이나 성능 각도는 별건: '항상 실패하는데 항상 최대 비용'인 쿼리 패턴이 UI에 모드 버튼으로 상시 노출돼 있어, BE-1 승급 전까지 클릭당 낭비 스캔 + 사용자당 NO_QUESTION 재시도 트래픽을 생산한다.
- DA: overview가 servable 정밀 카운트를 이미 계산하므로 프론트가 그 수치로 모드 버튼을 비활성화하면 UI 레벨에서 자연 해소 — 별도 서버 수정 불필요할 수 있음. BE-1 완료 시 자동 소멸하는 한시 부채.
- 권고: PracticePicker가 overview의 servable 카운트(inputType 축 추가 필요)로 빈 모드 버튼을 '준비 중' 비활성 표시 — 낭비 스캔과 빈 상태 UX 동시 해소. (Horizon: BE-1 승급 전 홍보 기간 0~3개월 한시)

### PF-m3. StreakPanel — 매 채점마다 최근 31일 리뷰 전량 toArray 재조회 (헤비 유저 모바일 jank 누적)

- 위치: `apps/web/src/components/public/StreakPanel.tsx:33-44`
- 상세: persistReview 성공마다 progressKey 증가(PublicPracticeApp.tsx:117-118) → StreakPanel이 IndexedDB에서 31일치 reviews 전량을 toArray 후 JS 집계한다. 하루 100문항 헤비 유저 = 월 ~3,000행을 **답변 1건마다** 전량 로드·Date 파싱. 저사양 모바일(사용자 80% 모바일)에서 채점 직후 프레임 드랍으로 누적. 서버 무관·로컬 한정이나 G-1 로컬 진도 계층이 정식 경로라 데이터는 계속 성장한다.
- DA: StreakPanel은 picker 화면에서만 렌더(PublicPracticeApp.tsx:222-228)라 세션 중 채점마다 실제 쿼리가 도는지는 마운트 여부에 달렸다 — picker 복귀 시에만 재조회라면 발현 빈도 대폭 감소로 사실상 무해. 마운트 경로 재확인 후 강등 가능.
- 권고: 날짜 버킷 카운트를 별도 IDB 테이블(일자→건수)로 증분 유지하거나, 최소 count() 쿼리로 전환 + 세션 중 재조회 스로틀. (Horizon: 6개월+)

## 검증 증거 (checkedItems)

- apps/api/src/public/routes.ts:312-316 — /next ORDER BY RANDOM() LIMIT 10 실쿼리 확인 (스캔 분모 = WHERE 일치 전 행)
- apps/api/src/public/routes.ts:242-249,256 — overview 전 행 SELECT(distractors 블롭 포함) + JS측 isServable 행별 JSON 파스 확인
- apps/api/src/public/routes.ts:390-397,517-524 — PASS: /grade·/reveal 은 PK 단건 LIMIT 1 조회 = N+1·fan-out 없음
- apps/api/src/public/analytics.ts:43-63 — PASS: AE writeDataPoint fire-and-forget(await 없음) = 응답 경로 비차단, 요청당 D1 쓰기 0
- apps/api/src/public/rate-limit.ts:19-35 + apps/api/wrangler.toml:105-112 — PASS: PUBLIC_RATE_LIMITER_IP 네이티브 바인딩(60/60s) = D1 rate_limits 테이블 미사용(요청당 D1 write 0, 지뢰 #6 회피 정합)
- apps/api/src/public/choice-id.ts:1-81 — PASS: choiceId 무상태 HMAC = 서빙당 저장 0 (상태 저장형 셔플시드 대비 D1 부하 0)
- migrations/0001_initial_schema.sql:132-133 + 0002:34 + 0032:25 + 0037:20 — PASS: exam_questions에 status/exam_type/input_type/active_subject 인덱스 실재 (WHERE 축은 인덱스 가능 — 병목은 RANDOM 정렬 스캔뿐)
- apps/api/src/middleware/cache-policy.ts:63-91 — PASS: overview 200 한정 public 캐시 + /api/public/\* no-store + 매칭실패 no-store floor (에러 5분 고착 지뢰 사전 차단 확인) / 단 공유캐시 실현성은 PF-M2
- apps/api/src/index.ts:135,140,164-176 — PASS: 공개 라우트 CORS credentials:false 분리 + cachePolicy 최우선 등록 + Hono trie 라우팅 (콜드스타트에 무거운 신규 import 없음 — public/routes 의존 = hono/zod/shared/learning-modes 기존 번들)
- apps/web/src/components/public/api.ts:73-104 — PASS: publicFetch 단건 요청 래퍼 자체엔 재시도·폴링 없음 (증폭은 호출측 PublicPracticeApp 루프 = PF-M4)
- apps/web/src/components/public/PracticeMap.tsx:27-29 — overview 소비처 확인 (picker 마운트마다 호출, 브라우저 max-age=300 완충)
- apps/api/src/index.ts:210-267 — N/A: scheduled cron(rate_limits GC)은 waitUntil 비동기 + 일 1회 = 공개 hot path 무관
- packages/formula-engine 최근 확장(95fc644·eca0222) — N/A: 런타임 계산 소비자 0 실측(WS-3c, CLAUDE.md) = 10K 유저 hot path 미접촉, 테스트·빌드 전용
- apps/web/src/components/public/PublicPracticeApp.tsx:56-85 — 중복 회피 직렬 3회 재시도 루프 실코드 확인 (PF-M4 근거)
- wrangler.toml route/custom_domain 부재 확인 (grep 결과 [env.*] 블록에 route 없음) — workers.dev 서빙 = 공유 엣지 캐시 미적용 근거
