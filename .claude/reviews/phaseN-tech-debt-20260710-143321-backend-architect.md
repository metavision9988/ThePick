# Phase N 기술부채 리뷰 — backend-architect (데이터·API 부채)

- 관점: "2년차에 뭐가 아플까?"
- 스코프: promo-1st P4 후반(80fc218)~P5(6481590) 변경셋 + 잔존 데이터 부채. 직전 backend 보고서(phaseN-tech-debt-20260710-105821-backend-architect.md B-C1~B-m8)와 중복 배제, C-1 처분 **이후** 신규 발생분 중심
- 일시: 2026-07-10 14:33 (ts 20260710-143321)
- 발견: CRITICAL 1 / MAJOR 2 / MINOR 3

## CRITICAL

### BE-C1. C-1 서빙 가드 × 결정적 ORDER BY 조합 = 인증 /study/next 조기 거짓 exhausted — 미시도 old 행이 오버샘플 창을 영구 점유

- 위치: `apps/api/src/study/routes.ts:879-888, 930-955`
- 상세: C-1 처분(80fc218)이 isMisgradableRow 사후 필터를 이식했으나, orderClause 는 결정적(`(up.id IS NULL) DESC … eq.id ASC`, :881-888)이고 old 525행은 가드로 영원히 서빙되지 않아 user_progress 가 생기지 않음 = '미시도 우선' 최상위 티어를 영구 점유한다. id 는 `Q-2019-05-001`(old) < `Q-2019-05-001-MC` < `Q-2019-05-002` 로 쌍별 인터리브(insert-round-5.sql:8 실측) — MC k개를 풀면 미시도 상위가 old1..old(k+1) 연속 블록이 된다. LIMIT = count×OVERSAMPLE(3) 이므로 count=1 이면 **MC 2문항 풀이 후 3번째 /next 부터**, count=5 여도 14문항 후, 창 전체가 misgradable → filter 후 0건 → `exhausted:true`(:972) 거짓 반환. 이후 FSRS due 복습 카드도 미시도 old 티어에 밀려 영구 도달 불가 = 인증 1차 학습 루프 전체 사망. 주석의 '유자격 ≈50% → ×3 여유'(:929)는 비율 논리로, 결정적 정렬 하의 **위치 편중**을 간과한 오류다.
- Devil's Advocate: 인증 1차 표면은 미런칭(자동로그인 차단물 잔존)이고 old 행 상태머신 마이그가 성사되면 자동 소멸 — '단기 버그'로 4-Pass 관할이라 강등 주장 가능. 반박: 6481590 의 4-Pass 리뷰는 이를 미포착했고(보고서 확인), production 배포 완료 경로라 첫 도그푸딩 세션에서 즉시 재현된다. 상태머신 마이그는 L3 결재 대기로 시점 미정 — 그 전 기간 전체가 노출 창이다.
- Horizon: 인증 1차 도그푸딩 첫 세션 즉시(문항 2~14개 풀이 후). 상태머신 마이그 전까지 지속
- 권고: 단기: 필터를 SQL 로 근사(-MC 계열 우선 서빙 = `AND (eq.exam_type != '1st' OR eq.id LIKE '%-MC' OR eq.input_type NOT IN ('fill_blank','multiple_choice'))` 류) 또는 미시도 티어 내 2차 정렬을 RANDOM() 으로 + 오버샘플 미충족 시 재조회 루프. 정본: old 행 superseded 상태머신 마이그를 인증 1차 오픈 선결 게이트로 승격(직전 B-C1 권고 (2) 재확인)

## MAJOR

### BE-M2. 통계·categoryAvailable 이중 계상 잔존 + ':1668 동치 불변식' 주석이 C-1 가드로 파손 — 공개(521) vs 인증(1,046) 수치 발산

- 위치: `apps/api/src/study/routes.ts:1589, 1653-1662, 1668-1674`
- 상세: C-1 처분은 서빙·채점만 가드했고 /study/mode 통계는 무처분: total COUNT(:1589) = old 525 + MC 521 = 1,046(실 서빙 풀의 2배), subject 픽커 카운트(:1653)도 과목별 2배다. 결정적으로 :1668-1670 주석이 'categoryAvailable = /next 의 eq.subject 필터와 **동치**(G1 게이트 근거)'를 선언하는데, 80fc218 이후 /next 는 isMisgradableRow 를 추가 적용하므로 이 문서화된 불변식 자체가 거짓이 됐다(available ≈ 2× 실제 풀 → S9 G1·G-WS5 ① 게이트가 기대는 전제 오염). 공개 표면 overview 는 isServable 정확 판정으로 521 을 반환(public/routes.ts:256)하므로 홍보 지도(521)와 인앱 통계(1,046)가 사용자 눈앞에서 발산한다.
- Devil's Advocate: 직전 B-C1 파생 ②(통계 이중 계상)의 재탕이라는 강등 주장 가능. 반박: 신규 요소 2개 — (a) C-1 '처분 완료' 처리 후에도 이 축은 미해소로 잔존함을 확정하는 델타 보고, (b) :1668 동치 주석·G1 게이트 파손은 80fc218 이 **새로 만든** 드리프트로 어느 보고서에도 미기재. 또한 공개 overview 가 생기며 발산이 크로스-표면으로 가시화된 것도 P5 신규.
- Horizon: 인증 표면 도그푸딩 즉시(픽커 수치 2배) + 모드 게이트(G1) 재검증 시점. 상태머신 마이그 전까지 지속
- 권고: 통계 4쿼리(:1589/:1594/:1623/:1653)에 서빙 자격 조건을 동일 적용(단기 SQL 근사 or servable 물질화 소비) + :1668 주석을 현행 사실로 정정하고 G1 게이트 정의를 '가드 적용 후 풀'로 재고정

### BE-M3. 서빙 자격이 비물질화 코드 파생 상태 — 술어 2종(isServable/isMisgradableRow)이 3개 표면에 분산, overview 는 요청당 전 행 answer·distractors 풀스캔

- 위치: `apps/api/src/public/routes.ts:229-256` (+ `study/serving-guard.ts:41-48`)
- 상세: '이 행이 서빙 가능한가'가 DB 어디에도 표현되지 않고(플래그 컬럼·뷰 0) 런타임 JS 파싱으로만 존재한다. 소비자 3곳이 각자 판정: 공개 isServable(routes.ts:166), 인증 isMisgradableRow(의도적으로 다른 술어 — essay/calc 통과), overview(:256). 결과 ① overview 는 캐시 미스마다 active 1st 전 행(현 1,046행)의 answer+distractors 전문을 fetch 해 JS 재파싱 — Workers 응답은 기본 엣지 미캐시라 max-age=300 은 사실상 브라우저 재방문에만 유효 = 랜딩 방문자당 1회 풀스캔. D1 rows_read 가 콘텐츠 × 트래픽에 곱셈 성장(Phase C 545 전수 보기화 + 2호 확장 시 행수 수천). ② BE-1(보기 추출)·상태머신 마이그가 랜딩하면 술어 의미가 바뀌는데 갱신 지점이 최소 3곳 + SQL 근사(:246 input_type IN)까지 4곳 — 동기 누락 = 무음 수치 발산(BE-M2 의 일반형).
- Devil's Advocate: 현 스케일(1,046행, 홍보 트래픽)에선 D1 무료 티어 rows_read 한도(5M/일)조차 일 ~4,800 방문까지 여유고, '정확 판정 = SQL 근사 금지'는 의도된 트레이드오프로 주석에 명기됨. MINOR 강등 여지. 반박: 문제는 오늘의 비용이 아니라 자격 판정의 **정본 부재** — BE-C1·BE-M2 둘 다 이 구조가 낳은 사고이며, 시험 시즌 스파이크 + 콘텐츠 성장이 겹치는 2년차에 스캔 비용과 술어 동기 비용이 동시에 온다.
- Horizon: 시험 시즌 홍보 스파이크(수천 DAU) 시 D1 예산 + BE-1/상태머신 마이그 랜딩 시 술어 동기 사고 — 6개월~1년
- 권고: 서빙 자격을 물질화: 적재·마이그 시점에 계산되는 servable/serving_class 컬럼(0038 화이트리스트에 등재) 또는 최소한 packages/learning-modes 에 술어 단일 모듈 + 소비 지점 등록부 주석. overview 는 물질화 후 GROUP BY 단일 쿼리로 강하

## MINOR

### BE-m4. local-progress reviews 스토어 append-only 무한 성장 — GC/컴팩션·export 상한 정책 부재

- 위치: `apps/web/src/lib/local-progress/db.ts:46-57, 100-108`
- 상세: reviews('++id', append-only)가 'FSRS replay 원천 + export 백본'으로 선언됐으나 보존 상한·컴팩션·아카이브 정책이 0. 일 50리뷰 헤비 유저 2년 = ~36K 행이 IndexedDB 에 누적되고 export 봉투가 전량 동봉이면 JSON 수 MB — import replay 비용도 선형 성장. cards 는 상한이 문항 수로 자연 바운드되지만 reviews 는 유일한 무한 축.
- DA: 36K 행·수 MB 는 IndexedDB 용량(GB급)과 모바일 성능에서 실질 무해하고, 홍보 표면 사용자의 평균 수명은 짧다. 유료 전환 시 로컬→서버 이관 설계(직전 B-m8)에서 어차피 재설계된다 — 실피해 확률 낮음, MINOR 유지가 정당.
- 권고: reviews 에 보존 정책 1줄 결정(예: 카드당 최근 N건 + FSRS 상태는 cards 가 정본이므로 replay 는 보조)을 export 스키마 v2 예약란에 등재. (Horizon: 헤비 유저 1~2년 / 유료 전환 이관 설계 시)

### BE-m5. cache-policy 의 overview 예외가 정확 경로 리터럴 결합 — 라우트 마운트 경로와 이중 선언

- 위치: `apps/api/src/middleware/cache-policy.ts:68`
- 상세: '/api/public/questions/overview' 정확 문자열이 미들웨어에 하드코딩 — 라우트 정의(public/routes.ts app.get('/questions/overview') + index.ts 마운트)와 경로 진실이 2곳으로 갈라진다. 경로 개편(종목 서브도메인 전개 시 /api/{exam}/public/… 재구성 가능성 — 07-04 R5)이나 오타 리네임 시 캐시가 무음으로 no-store 강하.
- DA: 실패 방향이 fail-safe(캐시 소실이지 유출 아님)이고 회귀 테스트(cache-policy.test.ts 신설 49행)가 현 경로를 고정한다 — 실사고 확률 낮음. 다만 2호 종목 공개 표면 복제 시 이 예외를 복붙할 표면이 하나 더 생기는 건 사실.
- 권고: 경로 상수를 public 모듈에서 export 해 cache-policy 가 import(단일 선언) 하거나, 응답 측에서 Cache-Control 을 명시하고 미들웨어는 화이트리스트 헤더 존중 방식으로 전환. (Horizon: 6개월~1년)

### BE-m6. serving-guard GUARDED_EXAM_TYPES('1st')·OVERSAMPLE(3) = 데이터 상태 결부 상수 — 해제 조건·수명 미정의

- 위치: `apps/api/src/study/serving-guard.ts:31` (+ `study/routes.ts:930`)
- 상세: 가드는 'BE-1 이전 old 행'이라는 **일시적 데이터 상태**에 결부된 로직인데 해제 조건이 코드·plan 어디에도 기계화돼 있지 않다: ① old 행이 superseded 마이그로 정리된 뒤에도 전 1차 서빙 요청이 가드 파싱 + ×3 오버샘플 비용을 영구 지불 ② 2호 전기기사가 동일 과도기(보기 미추출 원행)를 거치면 exam_type 리터럴 Set 수동 확장 — 신규 코드의 exam 축 부재는 직전 B-M6 과 동류 클래스가 인증 측에 하나 더 생긴 것. exam_type('1st') 은 차수 축이라 종목 경계 표현이 여전히 0.
- DA: 주석이 '데이터 상태에 결부된 가드이므로 종목 한정이 정확하다'고 명시하고 2차 테스트 37건 파손 실측까지 남겼다 — 의도·근거가 문서화된 한시 코드다. 상태머신 마이그 plan 이 성사되면 가드 제거가 자연 항목이 될 것. MINOR 가 적정.
- 권고: 상태머신 마이그 L3 plan 의 완료 게이트에 'serving-guard 제거(또는 no-op 확인) + OVERSAMPLE 원복' 항목 1줄 등재. (Horizon: 6개월~1년)

## 검증 증거 (checkedItems)

- PASS apps/api/wrangler.toml:115-116,187-188,260-261 — AE dataset 이 dev/staging/production 3환경 분리(thepick*public_events*{env}) — 지표 교차 오염 없음
- PASS apps/api/src/middleware/cache-policy.ts:68-71,88-91 — overview 공용 캐시 200 한정(429/500 고착 차단) + 매칭 실패 경로 no-store floor — 캐시 유출 방향 안전
- PASS apps/api/src/public/routes.ts:242-256 — overview 가 공개 서빙과 동일 isServable 술어 사용 = 지도 수치(521)와 공개 서빙 풀 정합(old 525 미계상)
- PASS apps/api/src/study/serving-guard.ts:22-31,41-48 — 가드가 1차·fill_blank/MC 한정으로 2차 진성 수치 정답('3' 등) 오차단 방지 — 2차 계약 테스트 37건 파손 실측 근거 주석 동봉
- PASS docs/batch-load/promo-mc-distractors/insert-round-5.sql:6-11 — 순수 INSERT…SELECT + WHERE answer 가드 + old 행 무접촉 재확인(append-only 준수, BE-C1 의 id 인터리브 근거 실측)
- N/A Temporal Graph SUPERSEDES 무결성 — P4 후반~P5 변경셋(80fc218·6481590·d2d04b5 git stat 전수) knowledge_nodes/edges 무접촉, 신규 리스크 없음(exam_questions superseded_by 미마킹은 직전 B-C1 기존재 항목)
- N/A Drizzle↔D1 스키마 drift — 신규 쿼리 전부 raw prepared statement(overview 포함), NC-1(타입 파생 전용) 준수·drizzle-kit 미사용
- 확인 apps/api/src/study/routes.ts:879-888,926-955,972 — 결정적 orderClause + OVERSAMPLE 사후필터 + exhausted 경로 (BE-C1 실코드 근거)
- 확인 apps/api/src/study/routes.ts:1589,1653-1662,1668-1674 — 통계 COUNT 무가드 + 'categoryAvailable = /next 동치' 주석 stale (BE-M2 실코드 근거)
- 확인 apps/web/src/lib/local-progress/db.ts:46-57,100-108 — reviews append-only·무 GC (BE-m4 근거)
- 확인 .claude/reviews/phaseN-tech-debt-20260710-105821-backend-architect.md 전문 — 직전 backend 발견 B-C1~B-m8 과의 중복 배제 기준으로 사용(B-M2 정답 진실원 이원화·B-M3 트리거 드리프트·B-M4 -MC related_nodes·B-M5 AE 보존/blob 무버전·B-M6 Rule16·B-m7 -MC 규약·B-m8 cardId 결합 = 본 보고서에서 재보고하지 않음, 전부 여전히 유효한 잔존 부채)
