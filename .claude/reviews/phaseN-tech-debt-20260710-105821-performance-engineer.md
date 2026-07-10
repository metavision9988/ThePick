# Phase N (promo-1st P0~P4) 기술부채 리뷰 — performance-engineer

- 관점: 런타임 부채 — "10K 사용자에서 뭐가 터지나?"
- 실행 상태: **실행 완료** (발견 7건 = MAJOR 4 / MINOR 3, CRITICAL 0)
- 통합 인덱스: `phaseN-tech-debt-20260710-105821-INDEX.md`
- 발견 ID 접두: `P-`

---

## P-M1 [MAJOR] 홍보 hot path /questions/next 가 ORDER BY RANDOM() = 요청당 매칭 풀 전체 스캔 (O(pool) rows_read × 트래픽)

- 파일: `apps/api/src/public/routes.ts:256-260`
- 상세: 무인증 공개 서빙의 최다 호출 엔드포인트가 `ORDER BY RANDOM() LIMIT 10` — SQLite 는 WHERE 매칭 전 행에 RANDOM() 을 평가·정렬하므로 D1 rows_read = 매칭 풀 전체(현 1차 active ≈ 1,046행: MC 521 + 구 fill_blank 525)를 매 요청 소모한다. 프론트 중복회피 재시도(최대 3회, PublicPracticeApp.tsx:62)까지 곱하면 문항 1개 전진에 최대 ~3,000 rows_read. 추정: 10K DAU × 30문항/일 ≈ /next 35만 req/일 × ~1,000행 = 월 ~10B rows_read (D1 paid 포함분 25B 의 40%, 성장 2.5배면 초과 과금 + 지연 선형 증가). 2호 전기기사 등 멀티시험 확장으로 풀이 수만 행이 되면 요청당 rows_read 가 10~50K 로 뛰어 즉시 한도 초과 궤도. 부수: (exam_type,status,input_type) 복합 인덱스 부재 — 0037 partial index 는 subject 미지정 기본 경로(subject IS NOT NULL 미함의)를 커버하지 못하고 단일컬럼 인덱스+행 필터로 동작. 단, 인덱스는 필터 비용만 줄일 뿐 ORDER BY RANDOM() 의 풀 스캔 자체는 못 없앤다. 처방: 사전 계산 random-key 컬럼(범위 픽) 또는 COUNT+OFFSET 랜덤 픽 + (exam_type,status,input_type) 복합 인덱스.
- Devil's Advocate: 현 풀 ~1K 행에서 스캔+정렬은 SQLite 로 1ms 미만·과금도 무료 한도 내 — '지금' 은 아무 문제 없다. 또 promo 가 10K DAU 에 못 미치면 영원히 안 터질 수 있다. 그러나 이 엔드포인트는 종목 확장 시 그대로 재사용될 서빙 골격(랜덤 픽 패턴)이라 풀 크기 × 트래픽 두 축이 동시에 자라는 구조 — MINOR 강등은 2호 풀 적재가 시작되는 순간 무효.
- Horizon: 홍보 스파이크(10K DAU) 시 D1 과금·지연 체감 / 2호 멀티시험 풀 적재 즉시 요청당 rows_read 10배+
- 권고: ① 마이그: exam_questions 에 random_key REAL 컬럼(적재 시 부여) + (exam_type,status,input_type,random_key) 인덱스 → `WHERE ... AND random_key >= ?` 범위 픽(요청당 rows_read ≤ LIMIT). ② 최소안: 복합 partial index (exam_type,status,input_type) WHERE status='active' 추가 + SERVE 후보를 id 서브쿼리 랜덤 픽으로 교체.
- INDEX 병합: **D-m7 과 교차 합의 병합 → 통합 M-8** (performance MAJOR + devops MINOR 반향 — 캐시 0·free tier 임계 관측 포함)

## P-M2 [MAJOR] 서빙 자격(isServable) 앱측 사후 필터 + 구 525 active 행 풀 잔류 — fill_blank 모드는 전량 스캔 후 상시 404, 혼합 풀은 죽은 후보 50%

- 파일: `apps/api/src/public/routes.ts:166-177, 254-277`
- 상세: 서빙 가능 여부(MC 계약 통과 / MC-in-disguise 아님)가 SQL 로 표현 불가라 후보 10행을 뽑아 앱에서 isServable 로 거른다. 현 production 상태(incident 20260710: 구 525행 = input_type='fill_blank'·answer=위치라벨·여전히 active, 정정 = 상태머신 마이그 별도 plan 이연)에서: (a) 빵꾸노트 모드(inputType=fill_blank)는 서빙 자격 행이 사실상 0 인데 매 요청 525행 전체 스캔+정렬 후 404 — 프론트가 3개 학습 모드 중 하나로 전면 노출 중이라 무의미 스캔이 상시 발생. (b) 카드플립 모드(inputType 미지정, IN 양타입)는 풀의 ~50%가 죽은 후보 — LIMIT 10 표본이 전부 부적격일 확률 ≈0.1% 로 유효 문항이 있어도 간헐 404(확률적 기아). 풀에 부적격 행 비율이 높아질수록(향후 essay/calc 적재, 타 종목 draft 혼입) 스캔 낭비와 404 확률이 함께 악화되는 구조적 부채 — '서빙 자격' 이 데이터 컬럼이 아니라 코드 술어인 것이 진앙.
- Devil's Advocate: BE-1(보기 추출 BATCH) 승급 + 구 행 상태머신 마이그가 완료되면 풀이 정화되어 (a)(b) 모두 자연 해소된다 — 이건 과도기 상태이지 설계 부채가 아니라는 반론 가능. 단 그 마이그 자체가 '별도 plan' 으로 이연돼 있고, 자격 술어가 코드에만 있는 한 다음 콘텐츠 적재 때마다 같은 클래스가 재발한다(부적격 행이 active 로 풀에 들어오는 것을 스키마가 막지 못함).
- Horizon: 현재 상시(빵꾸노트 모드 무의미 스캔+404) — 구 행 상태머신 마이그 전까지 지속, 콘텐츠 적재 회차마다 재발 위험
- 권고: 구 525행 상태 분리 마이그(별도 plan 기결 궤도)에 'servable 파생 컬럼(또는 serving 전용 status)' 을 함께 넣어 WHERE 로 밀어내리고, isServable 는 최후 방어선으로 강등. 승급 전 임시로는 빵꾸노트 모드 픽커 비활성(NO_QUESTION 상시인 모드를 유료 스캔으로 확인시키지 않기).
- INDEX 병합: **Q-m5(SERVE_CANDIDATE_LIMIT 통계 미모델링)를 흡수 → 통합 M-9** (동일 file·동일 확률적 404 증상 — quality 는 '잣대 부재' 각도)

## P-M3 [MAJOR] LandingEmbed client:load — below-the-fold 임베드가 랜딩 뷰마다 즉시 hydration + /next API 호출 (최다 트래픽 페이지의 무조건 fan-out)

- 파일: `apps/web/src/pages/index.astro:98` (+ LandingEmbed.tsx:19-34)
- 상세: 라이브 1문항 임베드가 히어로·통계·모드 3섹션 아래(뷰포트 밖 확률 높음)에 있는데 `client:load` 라 랜딩 페이지뷰마다 ① React island 즉시 hydration(134KB rating 청크 — Dexie+FSRS 포함, dist/\_astro/rating.C1HgX1ur.js 실측 134,121B) ② /api/public/questions/next 1회(= P-M1 의 풀 전체 스캔) ③ AE 'serve' 이벤트 1건이 스크롤 여부와 무관하게 발생한다. 홍보 캠페인 특성상 랜딩 뷰 : 실제 체험 비율이 크게 벌어지므로(이탈 다수) API·D1 소모가 참여와 무관하게 뷰 수에 비례. 부수 부채: 안 본 임베드도 'serve' 로 기록돼 서빙 지표가 체험률 대비 과대 — 홍보 성과 측정(과목별 정답률 등 AE 원천)의 분모 오염.
- Devil's Advocate: 720px 본문에서 모바일 첫 뷰포트가 길면 임베드가 fold 안에 걸릴 수 있고, 요청 1건 자체는 싸다(수 ms). 또 즉시 로드가 스크롤 도달 시 지연 0 이라는 UX 이점도 있다. 그러나 client:visible 은 도달 직전 로드로 체감 차이가 거의 없고, 지표 오염(serve 이벤트) 문제는 시점 지연과 무관하게 visible 전환만이 해소한다.
- Horizon: 홍보 스파이크(랜딩 유입 폭증) 시 — 뷰당 무조건 1 API 호출이 P-M1 과 곱연산
- 권고: `<LandingEmbed client:visible />` 로 전환(hydration+fetch 를 가시 도달로 이연). AE serve 이벤트에 origin(landing/practice) blob 차원 추가는 선택.

## P-M4 [MAJOR] 공개 표면 per-IP rate limit 60req/60s — 한국 CGNAT·공용망 공유 IP 에서 정상 사용자 집단 429

- 파일: `apps/api/wrangler.toml:108-112`
- 상세: 무인증이라 키가 IP 해시뿐인데 한도가 60/min. 활성 학습자 1인의 소비 = 문항당 serve 1(중복 시 최대 3, PublicPracticeApp.tsx:62-71 직렬 재시도) + grade/reveal 1 ≈ 분당 4~8 req(빠른 풀이 시 그 이상) + 랜딩 임베드 serve 도 같은 예산 차감. 한국 이동통신 CGNAT·학교·스터디카페는 다수 사용자가 단일 공인 IP 를 공유하고, 국내 트래픽은 대부분 ICN 콜로로 수렴하므로 'per-colo 라 한도가 분산된다' 는 완화가 작동하지 않는다 → NAT IP 당 동시 학습자 ~8~15명 선에서 집단 429. 홍보 대상(수험 커뮤니티·학원 단위 유입)이 정확히 이 공유망 패턴이라 시험 시즌 스파이크에서 가장 좋은 유입 코호트부터 막힌다.
- Devil's Advocate: 실측 없는 추정이다 — 이통사 CGNAT 는 IP 풀이 커서 동일 IP 뒤 동시 활성 사용자가 생각보다 적을 수 있고, 429 는 Retry-After 60s 로 UX 처리도 돼 있다(api.ts:19). DoS 방어 관점에선 보수적 한도가 옳다는 반론도 성립. 다만 한도 상향(예: 120~180/min)이나 엔드포인트별 분리(serve vs grade)는 방어력 손실이 거의 없어 트레이드오프가 싸다 — 강등하더라도 런칭 전 실측 항목으로는 남겨야 한다.
- Horizon: 시험 시즌 홍보 스파이크 — 학원/커뮤니티 단위 공유망 유입 시점
- 권고: ① 한도 120~180/min 상향 또는 serve/grade 네임스페이스 분리. ② 429 발생률을 AE 이벤트로 계측해 런칭 첫 주 실측 후 조정(계기판 항목 추가).

## P-m5 [MINOR] choice-id HMAC 이 호출마다 crypto.subtle.importKey 재수행 — MC grade 1회당 최대 ~7회 키 재생성

- 파일: `apps/api/src/public/choice-id.ts:43-54`
- 상세: hmacHex 가 매 호출 importKey+sign. MC grade = resolveChoiceId ≤5회 + correctChoiceIds 재발급 1~5회 = 요청당 최대 ~10 importKey. secret 은 요청 간 불변이므로 CryptoKey 를 모듈 레벨(secret 키드) 메모이즈하면 공짜 절감. Workers CPU 50ms 예산 대비 현재는 무시 가능(µs 단위)하나 hot path 누적 낭비.
- Devil's Advocate: importKey 는 마이크로초대라 10K 사용자에서도 CPU 한도 근처에 못 간다 — 순수 hygiene 이며 MINOR 가 상한이 맞다. isolate 재활용 전제의 모듈 캐시는 콜드스타트 시 이득 0 이라는 점도 효과를 더 깎는다.
- Horizon: 6개월+ — 트래픽 성장 시 CPU 미세 누적 (단독으로는 안 터짐)
- 권고: 모듈 스코프 `Map<string, Promise<CryptoKey>>` 로 importKey 1회화.

## P-m6 [MINOR] 클라 중복회피 = 최대 3회 직렬 /next 재시도 — 필터 풀이 작을수록 문항 전진 지연 RTT×3 + 서버 스캔 3배 상시화

- 파일: `apps/web/src/components/public/PublicPracticeApp.tsx:60-71`
- 상세: 서버가 무상태 랜덤이라 세션 내 중복을 클라가 재요청으로 회피한다. subject+round 동시 필터 시 풀 ≈ 20~30문항 — 10문항 세션 후반부 중복 확률 ~40% 로 재시도가 상시화되어 사용자 대기 = 직렬 2~3 RTT(모바일 ~300ms×3), 서버 = P-M1 스캔 ×3. 세션당 낭비 요청이 구조에 내장돼 있고 풀 확장 전까지 소풀 필터에서 항상 재현.
- Devil's Advocate: 무필터·MC 기본 흐름(풀 521)에선 중복 확률 ~2% 로 재시도가 거의 안 일어난다 — 주 흐름 기준 실질 영향 미미. 또 서버 상태 도입은 G-1(무상태) 결재와 충돌하므로 exclude 파라미터 방식만이 유효한 개선.
- Horizon: 6개월 — 과목·회차 필터 사용 비중이 늘거나 세션 길이 확대 시 체감
- 권고: /next 에 `exclude=id1,id2,...`(≤10개) 쿼리 파라미터 → SQL `AND id NOT IN (...)` 로 서버측 1회 해결(무상태 유지). P-M1 처방과 같은 마이그에 동승 가능.

## P-m7 [MINOR] Pretendard 가변폰트 main 505KB rel=preload + ext 1.35MB — 모바일 첫 방문 대역폭 과대 (사용 웨이트는 400/500뿐)

- 파일: `apps/web/src/layouts/BaseLayout.astro:53-60`
- 상세: 자가호스팅 전환(P4-D8) 자체는 옳으나 main 서브셋이 wght 45~930 가변 전축 505KB(실측 516,948B)로 preload 최고 우선순위 다운로드 — 랜딩 island JS(134KB)·API 호출과 대역폭 경합. UI 는 font-weight 400/500(+제목 medium)만 사용하므로 정적 2웨이트 서브셋이면 ~150~250KB 로 절반 이하. ext 1.35MB 는 unicode-range 조건부라 양호. font-display:swap + SW CacheFirst 재방문 캐시로 LCP 차단은 없어 MINOR.
- Devil's Advocate: swap 이라 텍스트는 폴백으로 즉시 렌더되고 재방문은 SW 캐시 — 실질 피해는 첫 방문 1회 전송량뿐. 가변 1파일이 향후 웨이트 추가 시 재작업 0 이라는 유지보수 이점도 있어, 홍보 랜딩의 첫인상 대역폭을 얼마나 무겁게 보느냐의 가치판단.
- Horizon: 홍보 첫 방문 모바일(3G/약 LTE) 코호트 — 상시이나 체감은 회선 하위 분위
- 권고: pyftsubset 으로 wght 400·500 정적 인스턴스 2파일 서브셋 재생성(재생성 절차 P4 원장 §2 존재) 또는 가변 유지 시 axis 를 400~700 으로 절단.

---

## 확인 항목 (증거 기반)

- PASS — /grade·/reveal 은 PK 단건 SELECT LIMIT 1 (apps/api/src/public/routes.ts:328-335, 440-447) — N+1·fan-out 없음
- PASS — SW 가 /api/public/\* 를 캐시 제외(NetworkOnly 계열) (apps/web/public/sw.js:50-56) — 랜덤 서빙 SWR 고착·재서빙 오염 없음
- PASS — CORS preflight 캐시 maxAge=600s (packages/shared/src/constants/cors.ts:71, index.ts:135 public 라우트 상속) — POST grade/reveal 의 preflight RTT 가 10분 단위로 상각
- PASS — AE recordPublicEvent 는 writeDataPoint fire-and-forget 동기 호출 (apps/api/src/public/analytics.ts:38-61) — 응답 경로 비차단, waitUntil 불요
- PASS — local-progress Dexie 인덱스 설계 (apps/web/src/lib/local-progress/db.ts:101-108: cards fsrs.due / reviews reviewedAt) — 복습큐 getDueCards·countReviewsOnKstDate 전부 인덱스 범위 쿼리 (store.ts:139-154)
- PASS — recordReview = 단일 rw 트랜잭션(cards+reviews+streak+meta) (store.ts:59) — 문항당 IDB 왕복 최소화, streak 는 changed 시에만 write (store.ts:103-105)
- PASS — StreakPanel 은 picker phase 에서만 렌더 + 최근 31일 인덱스 범위 조회 (apps/web/src/components/public/StreakPanel.tsx:33-35) — 문항마다 전체 reviews 스캔 없음
- PASS — share-image 는 800×420 클라 canvas 순수 그리기 (apps/web/src/lib/share-image.ts:17-79) — 서버 무접촉, 요약 화면 1회성이라 CPU 무시 가능
- PASS — 공개 라우터 rate-limit 미들웨어가 전 핸들러 선행 (routes.ts:210-224) — 스캔 비용이 한도 뒤에 위치 (한도 크기 자체는 P-M4)
- 확인 — exam_questions 인덱스 전수: idx_exam_year/status (migrations/0001:132-133), idx_exam_type/topic (0002:34-35), idx_input_type (0032:25), 0037 partial(exam_type,status,subject WHERE status='active' AND subject IS NOT NULL) — (exam_type,status,input_type) 복합 부재 확인 (P-M1 부수)
- 확인 — PUBLIC_RATE_LIMITER_IP simple={limit:60,period:60} (apps/api/wrangler.toml:108-112) — P-M4 근거
- 확인 — 공개 island 번들 실측 134KB (apps/web/dist/\_astro/rating.C1HgX1ur.js = 134,121B), 폰트 main 516,948B / ext 1,348,452B (apps/web/public/fonts/) — P-M3·P-m7 수치 근거
- N/A — Workers CPU 50ms 한도: 공개 표면 요청당 연산 = HMAC ≤10회 + zod 파싱 + JSON 직렬화 (µs~수 ms) — Formula Engine·임베딩 등 중연산 경로가 공개 표면에 없음
- N/A — 콜드스타트 번들: 이번 변경의 api 추가분은 public/ 4파일 684 LOC + zod(기존 의존) — Worker 번들 증분 미미, 신규 무거운 의존 0 (package 추가 없음, pnpm-lock 증분은 web 측 Dexie 계열)
- 제외(4-Pass 중복 회피) — fill_blank 모드 상시 404 의 '기능' 측면은 기지 상태(BE-1 대기, 핸드오프 명기)라 신규 버그로 보고하지 않고 성능·데이터 상태 부채 측면만 P-M2 로 한정
