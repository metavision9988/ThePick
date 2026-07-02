# 5-페르소나 독립 병렬 리뷰 보고서 — WS-5a/5c 변경셋

- **일자**: 2026-06-12
- **스코프**: WS-5a/5c 변경셋 (4-Pass 후속 5-페르소나, enforce-review hook 발동)
- **선행 리뷰**: `review-20260612-141347` (4-Pass, C0/M5/m19 + 해소 기록) — 기보고 발견(MAJOR-1~5, MINOR-1~19) 및 그 해소분은 재보고 배제, **신규 발견만** 수록
- **리뷰 방식**: 독립 페르소나 5개 병렬 (자가 리뷰 아님, auto-review-protocol 규칙 0 준수) + 확정 발견 전건 적대적 반증(4축: ⓐ인용 실재 ⓑ경로 도달성 ⓒ기존 가드 부재 ⓓ직전 리뷰 중복 여부)

---

## 0. 결과 요약

| 구분                    | 건수 |
| :---------------------- | :--: |
| 🔴 CRITICAL 확정        |  0   |
| 🟠 MAJOR 확정           |  4   |
| MINOR (보고만)          |  26  |
| 적대 반증 기각          |  0   |
| ✅ 정상 확인(PASS) 표본 |  30  |

### 판정

**완료 가능(확정 MAJOR 는 메인 세션 즉시 수정 대상)** — CRITICAL 확정 0건.

### 교차 수렴 (독립 페르소나 합의 — 신뢰도 강화 신호)

- **F-1(렌즈②) ≒ F-4(렌즈⑤)**: "mock `/mode/start` body 미독취 + category E2E 0건 + StudyFlow 단위 테스트 부재 → category modeParams 와이어 회귀가 전 스위트 green 인 채 production 422" 표면을 두 렌즈가 **독립 적발** — 동일 수리(mock 422 분기 + category e2e 1건)로 일괄 해소 가능.
- **DueQueue stale 카운트(mount 1회 fetch, refetch 경로 0)**: 렌즈 ①(m-04)·②(m-08)·③(m-16)·④(m-20) **4개 렌즈 독립 수렴** — MINOR 중 최우선 수선 후보.
- **cardsPlanned 하향 클램프 영구 잔존**: 렌즈 ③(m-15)·⑤(m-24) 수렴.
- **mock `/due` override 미지원**: 렌즈 ②(m-07)·⑤(m-25) 수렴.
- **DueQueue 카운트 이중 표기 + en 복수형 미처리**: 렌즈 ①(m-02)·⑤(m-22) 수렴 (+③ m-11 en 단수 축).

---

## 1. 페르소나별 섹션

### 렌즈 ① — 정합성/메모리·리소스 전담 리뷰어

- **전담**: D1 쿼리 정합(bind 수/타입·SQL 주입 표면·인덱스), React 상태/이펙트 누수(cancelled 가드·cleanup), fetch 경합, mock-server 상태 오염, 픽스처-실서버 drift, 수치 경계(count/cardsPlanned/클램프 NaN). 직전 4-Pass(review-20260612-141347, C0/M5/m19 + 해소 기록) 전문 선독 — 기보고 발견 및 해소분 재보고 배제, 신규 발견만 보고.
- **결과**: 🔴 0 / 🟠 0 / MINOR 4 (m-01~m-04)
- **확인(PASS) 표본**: §6 #1~#7, #12 — /due ISO bind 수리 정합·/next category 배선 정합·/mode Promise.all 정렬·0037 인덱스 커버·DueQueue 이펙트/경합 안전·mock 표면 drift 점검·수치 경계·fsrs_next_review 포맷 단일성.
- **반론(Devil's Advocate)**: 신설 MAJOR-1 회귀 가드 테스트 자체가 시계 의존이라 **UTC 00:00~01:00(KST 09:00~10:00) 일일 1시간 사각 창**에서는 구 결함 predicate 로도 PASS — "가드 존재 = 안전" 가정이 깨지는 시나리오 (m-01).

### 렌즈 ② — 아키텍처/결합도/경계 전담 독립 리뷰어

- **전담**: 모듈 경계·웹↔API 계약 단일 진실원·Hard Rule 15/16/17·e2e mock contract drift·WIRED_MODES 침식 경로·버전 스큐. 직전 4-Pass 기보고/해소 24건 제외, 신규 발견만.
- **결과**: 🔴 0 / 🟠 **1 (F-1)** / MINOR 6 (m-05~m-10)
- **확인(PASS) 표본**: §6 #9~#11, #13~#15 — categorySubjects 버전 스큐 4분면 안전·WIRED_MODES 런타임 단일 진실원 무침식·Hard Rule 16/17 신규 표면 전수 PASS·/next category WHERE 경계 안전·Import 방향/Hexagonal 신규 위반 0·직전 4-Pass 해소 기록 5건 실코드 반영.
- **반론(Devil's Advocate)**: 런타임 체인은 건강하나 e2e 계층에 WIRED_MODES 수기 사본 2개(fixture wired 플래그 + mobile-375 고정 카운트)가 잔존 — **이미 'S2부터 E2E 전체 파손' 사고 이력이 있는 클래스**가 topic 배선 시점에 그대로 재발할 조건 (m-06).

### 렌즈 ③ — UX·접근성·보안 (Advocate)

- **전담**: 과목 픽커/DueQueue 상태·터치·aria·키보드·XSS·입력검증·에러UX·i18n.
- **결과**: 🔴 0 / 🟠 **1 (F-2)** / MINOR 6 (m-11~m-16)
- **확인(PASS) 표본**: §6 #16~#24 — subject SQL 인젝션/와일드카드 표면 없음·XSS 0건·/due 인증/격리/allowlist·직전 리뷰 MAJOR-1 및 MAJOR-2/3/5 해소 실코드 확인·터치 타겟 44px 전수·모드 미배선 정직성 UI 계약·에러 UX 기술용어 비노출·i18n 신규 키 3계층 동기.
- **반론(Devil's Advocate)**: "인증이 있으니 read rate-limit 불요" 반론은 본 프로젝트 자체 방어선(backend M-D1 흡수 — study read 전부 60/min)과 모순 — 인증 세션 하나로 스크립트 루프 시 `/api/progress/due` 무상한 D1 read 가능 (F-2).

### 렌즈 ④ — 요구사항 대조 / Silent Pivot 감사관

- **전담**: 플레이북 S9 스펙(OPUS48_EXECUTION_PLAYBOOK §3 S9) · ADR-039 · 결재 #1 위임 범위 · CLAUDE.md 갱신 블록 사실성. 직전 4-Pass 기보고 24건 + 해소 8건 제외, 신규 발견만.
- **결과**: 🔴 0 / 🟠 **1 (F-3)** / MINOR 4 (m-17~m-20)
- **확인(PASS) 표본**: §6 #8, #25~#30 — 문서-코드 정합 스폿체크·topic 미배선 = Silent Pivot 아님(정직 보고)·due CTA '복습 시작' 참칭 없음·ADR-039 계약↔구현 일치·결재 #1 위임 범위 내 + RULE #5 보존·CLAUDE.md 갱신 블록 수치/사실 교차검증 PASS·직전 4-Pass 해소 주장 실코드 확인.
- **반론(Devil's Advocate)**: G1 게이트는 "아직 안 만든 테스트"가 아니라 **만들면 현 구현의 available 의미 결정(NULL subject 포함 여부)을 강제하는 게이트** — 미기록 상태로 두면 차세션이 충족된 것으로 오독(본 레포 stale 문서 오염 이력과 동일 클래스, F-3).

### 렌즈 ⑤ — 기술부채/유지보수성 전담 독립 리뷰어

- **전담**: 중복·매직값·테스트 취약성·확장성·픽스처 동기 부채.
- **결과**: 🔴 0 / 🟠 **1 (F-4)** / MINOR 6 (m-21~m-26)
- **확인(PASS) 표본**: §6 #6, #15, #20, #30 (픽스처 동기·직전 해소분 실코드 반영 — 타 렌즈 관할과 공유 표본).
- **반론(Devil's Advocate)**: 현행 코드는 정상 동작(라이브 결함 없음)이지만, 신규 핵심 계약(category modeParams 와이어)의 **단일점 무음 회귀 표면**이 테스트 피라미드 전 계층에서 비가시 — `/grade` 에는 "payload contract drift 차단" 패턴을 자기 선언해 두고 modeStart 에는 미적용한 비대칭이 부채의 증거 (F-4).

---

## 2. 확정 발견 표 (적대적 반증 통과분)

| ID  | 심각도 | 제목(요약)                                                                                                                   | 파일:라인                                                                               | 페르소나 |
| :-- | :----: | :--------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- | :------: |
| F-1 | MAJOR  | category 시작 체인(web modeParams → 서버 422 계약) 횡단 무검증 — mock body 무시 + StudyFlow 테스트 0 + category e2e 부재     | `apps/web/e2e/mock-server/server.ts:154-159` (+ `StudyFlow.tsx:274-278`, `state.ts:29`) |  렌즈 ②  |
| F-2 | MAJOR  | `/api/progress/due`(및 `/summary`) read rate-limit 부재 — WS-5c 가 hot path 승격, study-read 60/min 방어선과 비대칭          | `apps/api/src/progress/routes.ts:305-348` (대조 `study/routes.ts:795-825` 외)           |  렌즈 ③  |
| F-3 | MAJOR  | S9 완료 게이트 G1(모드별 /next 풀 = available 카운트 E2E = G-WS5 ①) 충족 증거 0건인데 게이트 상태 미기록 채 '배선 완료' 선언 | `OPUS48_EXECUTION_PLAYBOOK.md:198` + `MASTER_PLAN.md:173` + `CLAUDE.md:243-261`         |  렌즈 ④  |
| F-4 | MAJOR  | category modeParams 클라→서버 와이어 전송 무검증 — 회귀 시 전 스위트 green 인 채 production category 시작 전면 422           | `apps/web/e2e/mock-server/server.ts:154-159` (+ `StudyFlow.tsx:277`)                    |  렌즈 ⑤  |

> F-1·F-4 는 동일 표면의 독립 수렴(§0 참조) — 수리 1회로 동시 해소.

---

## 3. 확정 발견 상세

### F-1 [MAJOR] category 시작 체인(web modeParams → 서버 422 계약)이 횡단 무검증 — e2e mock /mode/start 가 body 를 전부 무시하고, StudyFlow 단위 테스트 0건, category e2e spec 부재

- **파일**: `/home/soo/ClaudePro/ThePick/apps/web/e2e/mock-server/server.ts:154-159` (+ `apps/web/src/components/StudyFlow.tsx:274-278`, `apps/web/e2e/mock-server/state.ts:29`)
- **페르소나**: 렌즈 ②

**내용**: 본 변경셋의 본체인 category 배선의 web→API 계약 전달 고리가 어느 계층에서도 검증되지 않는다. (1) mock-server POST /api/study/mode/start 핸들러는 ensureExamId 후 body 를 한 글자도 읽지 않고 makeStartResponse() 를 무조건 200 반환 — 실 서버의 신규 422 계약 2종(MODE_NOT_AVAILABLE — 미배선 mode / MODE_PARAMS_INVALID — category subject 누락, study/routes.ts:1878-1899)이 mock 에 전혀 표면화되지 않는다. callLog 도 EndpointKey 열거(state.ts:29)뿐이라 body 단언 자체가 불가능. (2) category 흐름 e2e spec 이 없다(6개 spec 중 mode start 를 치는 것은 happy-path/mobile-375 뿐 — 둘 다 category 미경유). (3) StudyFlow 단위 테스트 파일이 아예 없어(grep '\*.test.tsx' 0건) handleStart 의 modeParams spread(StudyFlow.tsx:274-278 `...(modeParams !== undefined ? { modeParams } : {})`)는 SessionStart 단위 테스트(onStart mock 호출 인자 단언)보다 위 어떤 계층에서도 실행되지 않는다. 결과: 이 spread 한 줄이 회귀(삭제/오타)해도 api 694·web 31·E2E 19·typecheck 전부 green 을 유지하고(modeParams 는 optional 이라 컴파일도 통과), 실 사용자만 production 에서 422 를 맞는다. **수리 권고(소형)**: mock modeStart 에 'category && modeParams.subject 부재 → 422' 분기 1개 + category 시작 e2e 1건(또는 callLog 에 body 기록 후 단언). 향후 WIRED_MODES 확장(topic) 시 같은 클래스가 모드마다 반복될 표면이므로 지금 닫는 것이 저렴하다.

**증거**: mock-server/server.ts:154-159 — `app.post('/api/study/mode/start', (c) => { const violation = ensureExamId(c); if (violation !== null) return violation; recordCall('modeStart'); return c.json(makeStartResponse()); })` (body 미접촉·무조건 200). 실 서버 대조: study/routes.ts:1878-1899 (422 2종). StudyFlow 테스트 부재: `grep -rln StudyFlow apps/web/src --include='*.test.*'` → 0건. category e2e 부재: e2e/\*.spec.ts 6개 중 mode start 경유는 happy-path·mobile-375 뿐(grep), due-queue.spec 은 위젯 한정.

**적대적 반증 기록 (통과)**: 반증 4축 전부 실패 → 발견 확정. (a) 인용 4곳 실코드 일치: mock server.ts:154-159 body 미접촉 무조건 200(makeStartResponse), 실서버 routes.ts:1878-1899 422 2종(MODE_NOT_AVAILABLE/MODE_PARAMS_INVALID) 실재, StudyFlow.tsx:277 modeParams spread 실재, state.ts:29 callLog=EndpointKey[]라 body 단언 불가. (b) 경로 도달 가능: category 는 WIRED_MODES(routes.ts:196-200) 등재 + UI 노출(mobile-375:44 'wired 3 = weak/mixed/category'), ModeStartRequest.modeParams optional(session/types.ts:72) → spread 회귀 시 typecheck green + mock 200 green = production 사용자만 422 라는 주장 성립. (c) 기존 가드 부재 확인: StudyFlow _.test._ 0건(grep exit 1), e2e 6 spec 중 mode/start 경유는 happy-path·mobile-375 뿐이며 둘 다 통합학습(mixed) 경유 — category e2e 0건, SessionStart.category.test.tsx 는 onStart mock 인자 단언(하위 계층)만, mock 어느 계층도 mode/start body 파싱 0건(c.req.json 은 \_\_mock/configure·grade 만), api routes.test 는 서버측 422 만 검증 = web body 조립 미검증. (d) 직전 4-Pass(review-20260612-141347) 24건(MAJOR-1~5 /due·DueItem 체인, MINOR-1~19) 전수 대조 — 본 발견(mock body-ignore/category e2e 부재/StudyFlow 테스트 부재)과 중복 0건(최근접 MINOR-18 은 fixture cardType 값 충실도로 별건), 해소 기록도 무관. **심각도**: 변경셋 본체 계약의 회귀가 전체 테스트 피라미드에 비가시인 커버리지 공백 = MAJOR 유지 타당(현재 코드는 정상 동작·라이브 결함 없음이므로 CRITICAL 승급 부적절, 변경셋 핵심 계약이므로 MINOR 강등도 부적절).

### F-2 [MAJOR] /api/progress/due (및 /summary) read rate-limit 부재 — WS-5c 가 hot path 로 승격했는데 study-read 60/min 방어선과 비대칭

- **파일**: `apps/api/src/progress/routes.ts:305-348` (대조: `apps/api/src/study/routes.ts:795-825, 1526/1709/1858/1954/2105`)
- **페르소나**: 렌즈 ③

**내용**: study 라우트는 backend M-D1 흡수로 모든 read(/mode·/progress·/session/:id·/complete)에 enforceStudyReadRateLimit(60/min) + 429/Retry-After + sleepJitter 를 적용했고 그 사유를 '인증 사용자 무제한 호출 시 D1 비용 폭증 / DoS / scraping'으로 명문화했다(routes.ts:795-804). 그런데 동일 위협 모델의 GET /api/progress/due 는 rate-limit 0이며(progress 라우터에서 limiter 호출은 POST /review 20/min 단 1곳 — :210), 본 변경셋의 DueQueue 위젯이 /study 페이지 로드마다 이 엔드포인트를 호출하는 첫 사용자 노출 hot path 로 승격시켰다(DueQueue.tsx:33). 쿼리는 LIMIT 50 행 SELECT 라 호출당 비용은 작지만, 인증 세션 하나로 스크립트 루프 시 무상한 D1 read 이며 프로젝트 자체 방어 기준(M-D1)과 비대칭이다. GET /summary 도 동일 공백(집계 SUM 쿼리). **수정은 기존 헬퍼 재사용 1줄 수준**: progress 라우터에 study-read 동형 그룹 suffix(예: ':progress-read', 60/min) 적용 + 429 테스트 1건. MAJOR-1과 동일하게 '선재 결함이나 본 변경셋이 첫 소비자를 배선하며 표면화'(auto-review-protocol 규칙 1 누적 검증 대상) 클래스.

**증거**: grep checkAndIncrementRateLimit: progress/routes.ts 는 :210(POST /review 20/min) 1곳뿐 — /due(:305-348)·/summary(:145-189) 핸들러 내 limiter 호출 0. study/routes.ts 는 :811 helper + 5개 read 라우트 전부 경유(:1526,:1709,:1858,:1954,:2105). DueQueue.tsx:29-48 mount 시 fetchDueQueue() 호출 = 페이지 로드당 1회 hot path 신설. routes.ts:795-804 주석이 동일 위협 모델을 자기 문서화.

**적대적 반증 기록 (통과)**: 반증 4각도 전부 실패 — 발견 확증. (a) 인용 전부 실재: progress/routes.ts 의 limiter 호출은 :210 (POST /review 20/min) 단 1곳, /summary(:145-189)·/due(:305-348) 핸들러 내 0건 (grep + Read 재확인). study/routes.ts:805-825 enforceStudyReadRateLimit + :795-804 주석("무제한 호출 시 D1 비용 폭증 / DoS / scraping... 분당 60 cap... 429+Retry-After+sleepJitter")이 동일 위협 모델 자기 문서화, 5개 read 호출처 :1526/:1709/:1858/:1954/:2105 정확 일치. DueQueue.tsx:29-48 mount 시 fetchDueQueue() → study-api.ts:151 /api/progress/due 확인. (b) 도달 가능: index.ts:156 마운트, 라우터 미들웨어는 requireAuth(:139-143) 단 1개 — router.use 그 외 0건. DueQueue 는 study.astro 탑재 = 페이지 로드당 hot path 실재. (c) 기존 가드 부재: wrangler.toml edge ratelimit 바인딩은 AUTH(1001-2)/WEBHOOK(1003)/SEARCH(1004) 전용 — progress 미커버. requireAuth 는 호출량 제한이 아니며, 프로젝트 자체 M-D1 기준이 동일하게 인증된 read 에 60/min 을 적용했으므로 "인증 있으니 충분" 반론은 자체 방어선과 모순. 수정 소규모 주장도 성립 — progress/rate-limit.ts 가 같은 디렉토리에 checkAndIncrementRateLimit/RateLimitExceeded/sleepJitter export 중. (d) 중복 아님: review-20260612-141347-4pass-changes.md 발견 헤더 전수(MAJOR-1~5, MINOR-1~19) 확인 — MAJOR-1=datetime 포맷, MAJOR-2/3/5=DueItem 타입 드리프트, MAJOR-4/5=PITR 문서 오류로 본 발견과 전부 별건. 해당 보고서 Advocate PASS #11(:376)은 study 라우트 rate-limit 만 확인했고 progress read 공백은 미보고. **심각도**: 프로젝트가 동일 클래스를 backend M-D1 MAJOR 로 흡수·명문화 + 본 변경셋의 첫 소비자 배선으로 hot path 승격(직전 MAJOR-1 과 동일 '선재 결함 표면화' 클래스 = MAJOR 유지 선례) → keep. LIMIT 50 저비용 read + 인증 게이트라 CRITICAL 승격 사유는 없음.

### F-3 [MAJOR] S9 완료 게이트 G1(모드별 /next 풀 = available 카운트 E2E = G-WS5 ①) — 충족 증거 0건인데 게이트 상태가 어떤 산출물에도 미기록된 채 '배선 완료' 선언

- **파일**: `docs/plans/master-remediation-20260610/OPUS48_EXECUTION_PLAYBOOK.md:198` (G1 정의) + `MASTER_PLAN.md:173` (G-WS5 ①) + `CLAUDE.md` 신규 블록 :243-261
- **페르소나**: 렌즈 ④

**내용**: 플레이북 S9 완료 게이트는 'G1: 모드별 /next 풀 = available 카운트 E2E'를 명시하고, MASTER_PLAN G-WS5 ①도 동일 게이트('모순 해소 E2E')를 둔다. 본 변경셋의 E2E 6 spec 19건 전수 grep 결과 pool==available 단언은 0건이고, api 통합 테스트도 '/next category subject 필터'(routes.test.ts:1300대)와 '/mode categorySubjects breakdown'(:1370대)을 각각 검증할 뿐 둘을 묶는 단언이 없다. 신설 due-queue.spec.ts:2 는 스스로 'G2' 라벨을 달아 게이트 추적을 한 반면, G1 은 라벨 테스트도, '미충족·이월' 기록도 없다. 그 상태에서 CLAUDE.md 갱신 블록은 'WS-5a/5c 배선 완료 (S9)'를 선언한다. 특히 G1 을 문자 그대로 구현하면 현 코드 의미론과 충돌이 드러난다: category available = total(subject NULL 포함, routes.ts:1656 'mixed', available: total 인접 — 기보고 MINOR-9)인데 /next category 풀은 subject NOT NULL 매칭만이라, NULL subject 데이터에서 G1 E2E 는 FAIL 한다(현 production 534/534 populate 라 우연 통과). 즉 G1 은 '아직 안 만든 테스트'가 아니라 '만들면 현 구현의 available 의미 결정을 강제하는 게이트'인데, 이 상태가 미기록이라 차세션이 G1 을 충족된 것으로 오독할 표면이다(CRITICAL RULE #7 '게이트 전부 통과 전 완료 선언 금지'의 정신 + 본 레포의 stale 문서 오염 이력과 동일 클래스).

**증거**: OPUS48_EXECUTION_PLAYBOOK.md:198 '[완료 게이트] G1: 모드별 /next 풀 = available 카운트 E2E.' / grep 'available' apps/web/e2e/\*.spec.ts → silent-failure-surface(weakDelta.available)뿐, 모드 풀 단언 0건 / due-queue.spec.ts:2 '(플레이북 S9 완료 게이트 G2: due UI 노출 E2E)' — G1 라벨 부재 / CLAUDE.md diff '(4) WS-5a/5c 배선 완료 (S9, [L2] 결재 #1 위임)' — G1 언급 0 / routes.test.ts:1378-1390 categorySubjects 단언과 category.available 단언이 분리(합치 단언 없음).

**적대적 반증 기록 (통과)**: 반증 실패 — 발견 확정. (a) 인용 전부 실재·정확: OPUS48_EXECUTION_PLAYBOOK.md:198 '[완료 게이트] G1: 모드별 /next 풀 = available 카운트 E2E' / MASTER_PLAN.md:173 G-WS5 ① '모순 해소 E2E' / CLAUDE.md:251 '(4) WS-5a/5c 배선 완료 (S9, [L2] 결재 #1 위임)' — 블록(:243-261) 내 G1 언급 0. (b) 충족 증거 0건 사실: apps/web/e2e 6 spec 전수 grep 에서 available 단언은 silent-failure-surface(weakDelta.available)·mock 픽스처뿐이고 모드 풀=available 등치 단언 0건; due-queue.spec.ts:2 는 'S9 완료 게이트 G2' 자가 라벨인 반면 G1 라벨 테스트 전무; api routes.test.ts 도 /next category 필터(:1300-1318)와 categorySubjects breakdown(:1370-1390, category.available 은 미단언 — wired 만 단언)이 별도 픽스처로 분리되어 pool==available 결합 단언 없음. (c) 의미론 충돌도 실코드 확증: routes.ts:1562-1566 totalRow 는 subject 무필터(NULL 포함) → :1653 category available=total, 반면 categorySubjects(:1627-1633)는 IS NOT NULL·/next category 풀은 subject 등치 매칭만(테스트가 eq-cat-null-1 제외 확인) — NULL subject 데이터에서 문자 그대로의 G1 E2E 는 FAIL, 현 production 534/534 populate 로만 우연 통과(직전 리뷰 wrangler 원격 실측 인용). G1 상태(미충족/이월) 기록은 전 산출물 grep 0건 — MINOR-15 가 권고한 MASTER_PLAN 5a 행 갱신도 미적용. (d) 중복 아님: 직전 review-20260612-141347 은 MINOR-9(available 의미론)·MINOR-15(5a 행 stale)·MINOR-16(G-WS5 ① 장차 모순)으로 구성 요소만 인접 보고(MINOR=보고만, 미해소)했고 'S9 게이트 G1 충족 증거 0 + 미기록 + 완료 선언' 프레임은 미보고; CLAUDE.md 선언 블록 자체가 그 4-Pass 이후 작성(블록이 리포트를 인용)이라 선언-게이트 불일치는 직전 리뷰 커버 불가. 유일 반박(선언이 'S9 완료'가 아닌 '배선 완료' 스코프 한정 + topic 미배선 정직 표기)은 G1 이 정확히 5a 배선의 완료 게이트이고 G2 만 라벨 추적되는 비대칭이 차세션 오독 표면을 실증하므로 기각. **심각도**: 런타임 결함이 아닌 게이트 추적·문서 정합 결함 + 충돌은 현재 잠재(production 0건)이므로 CRITICAL 승급은 부적절, 레포의 stale 문서 오염 이력(2026-05-15)과 동일 클래스 + CRITICAL RULE #7 정신 위반이므로 MINOR 강등도 부적절 — MAJOR 유지.

### F-4 [MAJOR] category modeParams 의 클라→서버 와이어 전송이 어떤 계층에서도 검증되지 않음 — mock-server /mode/start 가 body 를 읽지 않고 category E2E 0건 → 회귀 시 전 스위트 green 인 채 production category 시작 전면 422

- **파일**: `apps/web/e2e/mock-server/server.ts:154-159` (+ `apps/web/src/components/StudyFlow.tsx:277`)
- **페르소나**: 렌즈 ⑤

**내용**: 신규 배선의 핵심 계약(category 는 modeParams.subject 동반, 누락 시 서버 422)이 정확히 한 지점 — StudyFlow.handleStart 의 spread(StudyFlow.tsx:277 `...(modeParams !== undefined ? { modeParams } : {})`) → startMode JSON.stringify — 를 거치는데, 이 와이어 구간을 커버하는 테스트가 0건이다. 커버리지 체인: ① SessionStart.category.test.tsx 는 onStart 콜백 인자까지만 단언(컴포넌트 경계에서 종료) ② StudyFlow 단위 테스트에 startMode 호출 인자 단언 부재(grep 'modeParams' in apps/web tests = SessionStart.category.test 한정) ③ e2e mock-server 의 POST /api/study/mode/start 핸들러(server.ts:154-159)는 examId 만 보고 request body 를 한 번도 읽지 않은 채 makeStartResponse() 200 반환 ④ category 흐름 e2e spec 자체가 0건(grep 결과 mobile-375 주석뿐). 따라서 spread 1줄이 회귀(예: 리팩토링 중 누락)해도 api 694/web 31/E2E 19 전부 green 인 채 production 에서만 category 시작이 100% 422 로 실패한다. 같은 mock-server 가 /grade 에는 "payload contract drift 차단 (Pass 1 C-5 정합)" 패턴을 명시 보유하면서 modeStart 에는 미적용 — 자기 선언 패턴의 비대칭. **부수**: MASTER_PLAN.md:173 Binary Gate G-WS5 ①("모드별 /next 응답이 available 카운트와 동일 풀 — 모순 해소 E2E")은 mock /next 가 mode/subject 를 무시하고 고정 시퀀스를 반환(server.ts:169-183)하는 현 인프라로는 표현 자체가 불가능 — 게이트 충족 시도 시점에 mock 보강이 선결인데 그 부채가 어디에도 기록돼 있지 않다.

**증거**: mock-server/server.ts:154-159 — `app.post('/api/study/mode/start', (c) => { ensureExamId; recordCall('modeStart'); return c.json(makeStartResponse()); })` body 미독취 / StudyFlow.tsx:277 spread 가 유일 전송 지점, startMode 는 body 그대로 직렬화(study-api.ts:107-115) / grep "modeParams" apps/web 테스트 = SessionStart.category.test.tsx 한정(StudyFlow·study-api 단언 0) / grep "category" apps/web/e2e/\*.spec.ts = mobile-375 주석 2줄뿐 / MASTER_PLAN.md:173 G-WS5 ① E2E 게이트 원문.

**적대적 반증 기록 (통과)**: 반증 실패 — 발견은 4개 축 모두에서 실코드로 확증됨. (a) 인용 전부 실재·정확: server.ts:154-159 modeStart 핸들러는 body 미독취(ensureExamId+recordCall+makeStartResponse 200), StudyFlow.tsx:277 spread = 유일 전송점, study-api.ts:107-115 직렬화 통과, /grade 핸들러(server.ts:226-240)의 'payload contract drift 차단' 패턴 비대칭 실재, MASTER_PLAN G-WS5 ① 원문 일치 + mock /next(server.ts:170-183)는 mode/subject 무시 고정 시퀀스이고 mock 보강 부채 기록 부재(grep 'mock' MASTER_PLAN = exam_questions draft 스테이징 무관 건뿐). (b) 도달 가능: apps/api routes.ts ~:1891 category+subject 누락→422 MODE_PARAMS_INVALID 실재, ModeStartRequest.modeParams 는 optional(types.ts:70-74)이라 spread 제거 회귀가 타입체크 통과 → production category 시작 전면 422. (c) 기존 가드 부재: StudyFlow 테스트 파일 0건(find 실측), grep modeParams web 테스트 = SessionStart.category.test.tsx 한정(onStart 콜백 경계 단언, :53-62), fixtures.ts:129 은 응답 픽스처일 뿐, api routes.test.ts:1259+ 는 서버측 전용(클라 회귀에도 green), category e2e spec 0건(mobile-375 주석뿐)+mock 무검증 200 → '전 스위트 green' 주장 성립. (d) 직전 4-Pass 보고서(review-20260612-141347) 발견 전수 대조: MAJOR-1~5(/due 계열)·MINOR-1~19 중 와이어 커버리지 갭/mock body 미독취/category E2E 부재/G-WS5 mock 부채 보고 0건 — MINOR-7/11 은 modeParams 크기 제한(별건), PASS #349/#380 은 구현 검증만 하고 테스트 비대칭 미적발 → 중복 아님. **심각도**: 현행 코드는 정상 동작(라이브 결함 없음)이므로 CRITICAL 아님, 그러나 신규 핵심 계약의 단일점 무음 회귀 표면 + 자기 선언 패턴 비대칭 + 레포 관례(타입 계약 드리프트류 MAJOR 분류, Golden Test 의무)에 비추어 MAJOR 유지 적정.

---

## 4. 기각 기록

**기각 0건.** 5개 페르소나가 상신한 확정 후보 전건(MAJOR 4)이 4축 적대적 반증(인용 실재 / 경로 도달성 / 기존 가드 부재 / 직전 4-Pass 중복)을 통과해 확정됐고, 반증 단계에서 탈락(허위 인용·도달 불가·기보고 중복)으로 기각된 발견은 없다.

---

## 5. MINOR 목록 (26건 — 보고만, 수정 의무 아님)

### 렌즈 ① (m-01~m-04)

- **m-01** `apps/api/src/progress/__tests__/routes.test.ts:444-462` — **MAJOR-1 회귀 가드 테스트의 일일 1시간 사각 창**: 가드가 fsrsNextReview = 현재−1시간 ISO 를 시드하는데, 구 결함 predicate(datetime('now') 바이트 비교)는 '같은 날짜 접두사'에서만 당일 due 누락(전날 날짜 접두사 ISO 는 정상 매칭 — 직전 리뷰 node:sqlite 재현 {dueYesterday:1} 이 대조군). 실행 시각이 UTC 00:00~01:00(KST 09:00~10:00 = CI/로컬 빈발 시간대)이면 now−1h 가 전날 UTC 날짜로 떨어져 구 결함 코드에서도 PASS — 회귀 가드가 매일 1시간 무력. G-6a-1 결정성 원칙과 어긋나는 시계 의존 가드. 권고: vi.useFakeTimers + vi.setSystemTime 으로 날짜 경계에서 먼 시각 고정(또는 같은 UTC 날짜가 수학적으로 보장되는 due 시각 구성).
- **m-02** `apps/web/src/components/review/DueQueue.tsx:73-79` (+ `i18n/locales/en.ts:58`, `ko.ts:58`) — **카운트 이중 표기('2 복습 예정 2장') + en 복수형 미처리('1 cards due')**: 큰 숫자 {state.count} 직후 t('learning.dueCards', { count }) 병기로 숫자 2회 노출("2 2 cards due"), use-translation t() 는 {{}} 단순 치환뿐이라 en count=1 시 문법 오류, 스크린리더 중복 낭독(numeral aria-hidden 없음). 권고: dueCards 문구에서 {{count}} 제거 또는 numeral aria-hidden + en 단/복수 키 분리.
- **m-03** `apps/web/e2e/mock-server/server.ts:273-279` — **/api/progress/due 핸들러만 recordCall 이 ensureExamId 보다 선행(형제 6개 핸들러와 역순)**: examId 누락(Hard Rule 16 위반) 요청도 카운트되어 '카운터 = 유효 호출 수' 의미가 엔드포인트별로 drift. 부수: truthiness `if (invalid)` 스타일 비일관. 권고: ensureExamId 선행 통일(+ `!== null` 비교).
- **m-04** `apps/web/src/components/review/DueQueue.tsx:29-48` — **카운트 1회성 fetch — 세션 학습/채점 후 stale (refetch 경로 0)**: /grade 가 FSRS 스케줄을 갱신해도 사이드바 카운트는 reload 전까지 고정인데, '로드 시점 스냅샷' 계약이 코드·문서 어디에도 미표기. 권고: (a) 세션 완료 시 refetch, (b) 최소한 주석/PITR 에 스냅샷 계약 1줄 명시. ※ ②③④와 4-렌즈 수렴.

### 렌즈 ② (m-05~m-10)

- **m-05** `apps/web/e2e/helpers/fixtures.ts:91-99` (헤더 :2-5, 대조 import :21) — **DueQueueFixture 가 계약 타입을 로컬 재선언 — 파일 자신의 헤더 원칙('type drift 방지 위해 shared types import') 자기 위반**: 6종은 src import 인데 신설 DueQueueFixture 만 수기 동형 재선언 = 같은 계약의 3번째 사본. 직전 4-Pass 의 nodeId 널러빌리티 드리프트(MAJOR-2/3/5)는 import 했다면 typecheck 가 컴파일 타임 차단했을 클래스. 권고: `import type { DueQueueResponse } from '../../src/lib/study-api'` + `makeDueQueue(): DueQueueResponse` 로 교체.
- **m-06** `apps/web/e2e/helpers/fixtures.ts:39-43` (서버 진실원 `apps/api/src/study/routes.ts:196-200`, 카운트 핀 `apps/web/e2e/mobile-375.spec.ts:48-50`) — **WIRED_MODES 진실이 3곳 수기 사본**: 런타임 체인은 건강하나 e2e fixture wired 플래그 + mobile-375 고정 카운트(3+2)가 수기 사본 — 'WS-0d 시 fixture 미갱신 → S2부터 E2E 전체 파손' 사고 이력 클래스가 topic 배선 시 재발 예고. 권고(택1): (a) WIRED_MODES 리터럴을 packages/learning-modes 로 승격해 양쪽 import, (b) 최소 3좌표 상호 참조 주석 + 배선 변경 체크리스트.
- **m-07** `apps/web/e2e/mock-server/server.ts:273-277` (override 관례 :174, :190, :259, :265) — **/api/progress/due 만 override 미지원**: 타 상태 엔드포인트는 전부 `state.overrides.X ?? 기본값` 패턴인데 /due 만 고정 픽스처 — DueQueue 의 0건/에러/미인증 분기를 e2e 가 영구 검증 불가(happy path 1본에 갇힘). 권고: SerializedOverrides 에 dueResponse 추가(~3줄). ※ ⑤ m-25 와 수렴.
- **m-08** `apps/web/src/components/review/DueQueue.tsx:29-48` + `apps/web/src/pages/study.astro:19-27` — **교차-island 상태 정합 부재**: island 3개(StudyFlow·ProgressViz·DueQueue) 간 통신 채널 0 — 세션 완료로 실제 due 가 줄어도 사이드바 stale. 부수: island 별 자체 I18nProvider 라 locale state 분산(현 setLocale 소비자 0 = 무해, 언어 전환 UI 도입 시 desync 표면화). 권고: 세션 완료 시 `window.dispatchEvent(new CustomEvent('thepick:session-completed'))` + DueQueue listener refetch(~10줄, 이벤트 명 named const).
- **m-09** `apps/web/src/components/session/types.ts:70-74` (+ SessionStart.tsx:26,225 + StudyFlow.tsx:264) — **modeParams 가 web 전 계층에서 Record<string, unknown> 약타입**: category 실계약 `{ subject: string }`(서버 extractCategorySubject + ADR-039)이 타입으로 비표현 — 키 오타·형상 변경이 컴파일 통과, 서버 422 가 첫 검출점(F-1/F-4 와 결합 시 production 런타임까지 밀림). 권고(additive): `interface CategoryModeParams { readonly subject: string }` + union 확장형 `type ModeParams` 적용 — 서버 zod 권위 유지.
- **m-10** `apps/web/src/components/review/DueQueue.tsx:82` (대상 id: `study.astro:26`) — **재사용 컴포넌트에 페이지 전용 DOM anchor('#study-main') 하드코딩**: components/review/ 일반 위젯이 pages/study.astro 의 main id 를 역방향 인지 — 타 페이지(dashboard 등) 탑재 시 CTA 무음 no-op(콘솔 에러도 없음). 권고: `ctaHref?: string` prop 으로 페이지 지식을 호출측에 반납(e2e href 단언 유효 유지).

### 렌즈 ③ (m-11~m-16)

- **m-11** `apps/web/src/i18n/locales/en.ts:58` (대조: use-translation.ts:33-37, DueQueue.tsx:78) — **en dueCards 단수 미처리 — count=1 시 '1 cards due'**: i18n 시스템에 plural 분기 부재(단순 치환만). due 1장은 일상 상태. ko 는 무영향. 권고: 수량 중립 문구('cards due: {{count}}' 류)로 재작성.
- **m-12** `apps/web/src/components/review/DueQueue.tsx:35-43, 65-67` — **에러 상태가 오프라인/네트워크 미구분 + 재시도 수단 부재**: study-api.ts:58 이 kind 'network' 판별 + ko.ts:76 errors.networkError 키 실재(구분 비용 0)인데 전부 errors.generic 으로 접힘. error 상태 재시도 버튼 없음(회복 = 전체 새로고침) — 동일 변경셋 StudyFlow error UI(재시도 :382-389)와 비일관. Pass 3 체크리스트('로딩/빈/에러/오프라인 UI')의 오프라인 축이 generic 에 흡수된 상태.
- **m-13** `apps/web/src/components/review/DueQueue.tsx:63, 66, 70` (+ `SessionStart.tsx:106`) — **신규 상태 텍스트 text-gray-400(≈2.84:1)·12px — WCAG 1.4.3 AA(4.5:1) 미달**: 로딩/에러/복습 0건/'선택할 수 있는 과목이 없습니다' 4종 전부 상태 전달 텍스트 = 명암비 의무 대상. 에러가 빈 상태와 동일 회색 = '실패'가 '없음'처럼 읽히는 시맨틱 평탄화 동반. 권고: text-gray-500(≈4.83:1)로 상향.
- **m-14** `apps/web/src/pages/study.astro:26` (대조: DueQueue.tsx:81-87) — **CTA 앵커 타겟 #study-main 에 tabindex="-1" 부재**: 비포커스블 main 으로의 fragment 이동 — 일부 Safari/VoiceOver·모바일 AT 조합에서 포커스가 링크에 잔류, 키보드·SR 사용자에게 CTA 약속이 절반만 이행. 권고: main 에 tabindex="-1" 1속성(또는 클릭 핸들러 focus()).
- **m-15** `apps/web/src/components/session/SessionStart.tsx:64-68` (대조: 51-52, 146-157) — **과목 전환 시 cardsPlanned 하향 클램프 영구 잔존 + 프로그램적 값 변경 무고지**: 2차 과목(9문제) 선택 → 15→9 강제 후 큰 과목으로 바꿔도 9 잔존(클램프 부산물이 사용자 의도로 미복원), input 값 무고지 변경(aria-live 없음) — 세션 중에야 카드 수 감소 인지. 권고: 클램프 시 'N장으로 조정됨' aria-live polite 안내, 또는 dirty flag 기반 Math.min(DEFAULT_CARDS, available) 재계산. ※ ⑤ m-24 와 수렴.
- **m-16** `apps/web/src/components/review/DueQueue.tsx:29-48` (대조: study.astro:21-31) — **세션 수행 후 카운트 미갱신 — island 간 갱신 신호 부재로 stale 상시 노출**: '복습 예정 12장'을 끝낸 직후에도 12장 표시 = 신뢰 손상 표면. 최소 수선 = SessionSummary 도달 시 CustomEvent dispatch → DueQueue refetch(또는 visibilitychange refetch). PITR(B안 복습 모드) 채택 시 어차피 필요한 배선 = 선투자 가치. ※ ①②④와 4-렌즈 수렴.

### 렌즈 ④ (m-17~m-20)

- **m-17** `OPUS48_EXECUTION_PLAYBOOK.md:196` (5c 문언) + `docs/plans/ws-5c-study-next-due-pitr.md:3-7` — **S9 5c 스펙 문언 내부 모순(최소선 '(최소: due 카운트 + due 카드 우선 학습 진입)' vs PITR 게이트)을 플레이북 직접 수정으로 닫지 않음**: due 우선 진입은 어떤 형태든 PITR 선택지 그 자체 = 두 문장 모순. 구현은 후자 독해(카운트+일반 CTA+PITR 상신)를 채택했고 DueQueue.tsx:5-7 주석 + PITR 머리말('1차는 카운트+CTA까지다')로 정직 명기 = Silent Pivot 아님. 그러나 플레이북 운영 규칙 6(괴리 발견 시 본 문서 직접 수정 + 이력)에 따른 5c 문언 정정이 없고 CLAUDE.md 블록에도 '스펙 최소선 대비 축소' 명시 부재 — 결재자가 원문만 보면 '최소선 충족'으로 오독 가능.
- **m-18** `OPUS48_EXECUTION_PLAYBOOK.md:239-290` (실행 기록 섹션) + `CLAUDE.md:251-254` — **S9 집행이 플레이북 '실행 기록(세션별)' 관례(S1~S4·S6 실재)에 미등재 + '5d 제외(결재 #10 대기)' 명시 부재**: 플레이북 파일 자체가 본 변경셋에서 무변경(횡단 규칙 5 위배 표면). 5d 제외는 횡단 규칙 2 로 정당하나 CLAUDE.md (4)항이 '배선 완료 (S9)'로만 적어 카드 #10 상신 항목과 교차해야만 추론 가능. 기보고 MINOR-15 와 같은 클래스이나 대상 파일·사실이 다른 신규 표면.
- **m-19** `apps/api/src/progress/routes.ts:321-333` (ISO bind predicate) — **/due predicate 수정 = user_progress 데이터 처리 경로 변경인데 CLAUDE.md L3 목록('사용자 데이터 처리 (user_progress)')과의 경계 해석(읽기 서빙 = L2)이 미명문**: 본 수정은 운영 관례(L3 = 쓰기/스키마/PII 한정, 직전 리뷰 Pass4 #16 판정과 일관)에 맞는 올바른 버그 수리이나, 경계 해석 명문이 없어 차기 세션이 읽기 경로를 L3 로 오판(과잉 차단)하거나 쓰기 인접 경로를 L2 로 오판할 양방향 표면 잔존.
- **m-20** `apps/web/src/components/review/DueQueue.tsx:29-48` — **due 카운트 mount 1회 fetch 후 고정 — 같은 페이지 세션 완료(/grade FSRS 재스케줄) 후에도 미갱신**: DueQueue 는 별도 island(StudyFlow 와 무통신)라 재조회 경로 없음. WS-5c 존재 이유('정확한 due 카운트 surface' — 직전 MAJOR-1 논거)상, 같은 화면에서 학습 직후가 가장 카운트가 틀려 있는 순간이 되는 구조. ※ ①②③과 4-렌즈 수렴.

### 렌즈 ⑤ (m-21~m-26)

- **m-21** `apps/web/e2e/mobile-375.spec.ts:48-50` — **하드코딩 카운트(3/2) + e2e 픽스처 wired 플래그 수동 동기 — 방금 수리한 S2 파손과 동일 클래스 재발 조건 재영속**: 근원인 '서버 WIRED_MODES ↔ e2e 픽스처 ↔ spec 기대값' 3중 수동 동기가 수리 후에도 그대로. topic 배선(routes.ts:191-194 'populate 후 재상신' 명시 예정) 시 최소 2파일 재수동 동기 확정 부채. 권고: 기대값을 픽스처에서 파생(`makeModeStats().modes.filter(m => m.wired).length`) — spec-픽스처 축 자동 동기화. ※ ② m-06 과 수렴.
- **m-22** `apps/web/src/components/review/DueQueue.tsx:73-79` — **카운트 이중 표기('2' + '복습 예정 2장') + en 복수형 미처리 — dueCards 키 설계가 헤드라인 숫자와 중복**: ko "2 복습 예정 2장" / en "2 2 cards due", en count=1 시 "1 cards due" 문법 오류(use-translation 단순 치환). 캡션 키를 count 비포함으로 바꾸거나 큰 숫자를 키 내부로 흡수하는 단일 표기로 정리해야 카피 변경 시 두 곳 드리프트 방지. ※ ① m-02 와 수렴.
- **m-23** `apps/api/src/study/routes.ts:852, 1909-1914` — **category 세션이 examType 을 영속하지 않음 — subject 는 examType 종속 값인데 /next examType 은 query 파라미터(기본 '1st') → 교차 불일치 시 무음 빈 풀**: study_sessions INSERT 가 exam_type 미저장(schema.ts:454-461 컬럼 부재) + /next examType 은 세션 무관 query 파라미터 — 2차 과목 subject 세션에 examType=1st(또는 생략) 호출 시 WHERE 0건 → 422 아닌 정직 exhausted 무음 종료. 현 클라이언트 '1st' 단일 고정 = 실경로 0이나, 2차 UI 개방 순간 '세션의 subject·examType 결합 불변식 미강제' 설계 틈이 사용자 경로가 됨. 선재 구조(세션 examType 비영속)와 신규 배선(subject 필터)의 교차로 이번 변경셋에서 처음 생긴 결합.
- **m-24** `apps/web/src/components/session/SessionStart.tsx:65-68` — **cardsPlanned 하향 래칫 — 작은 과목→큰 과목 재선택 시 클램프 값 미복원**: 기본 20 → 9문제 과목 선택 시 9 클램프 → 175문제 과목으로 바꿔도 9 유지. 클램프 부산물과 사용자 직접 입력을 구분하지 않는 단방향 상태 전이(과목 둘러보기만 해도 세션 길이 비가역 축소). 권고: 명시 입력 플래그 또는 과목 전환 시 min(DEFAULT_CARDS, available) 재계산. ※ ③ m-15 와 수렴.
- **m-25** `apps/web/e2e/mock-server/types.ts:55-60` (SerializedOverrides) — **progressDue override 부재 + due-queue.spec 의 '2' 가 makeDueQueue() 기본값과 암묵 결합 + ko 리터럴 셀렉터 결합**: due 0건·5xx 를 e2e 에서 구동 불가(현재 unit 4건 대체 커버), spec '2'(due-queue.spec.ts:27)는 픽스처 기본 count=2 와 두 파일 암묵 결합(기본값 변경 시 원인 불명 파손), 셀렉터가 ko 카피 리터럴('복습 예정'/'학습 시작')에 결합 — i18n 카피 수정 시 기록 없는 동반 수정 의무. 픽스처 3중 보관 중 due 축은 unit/e2e 픽스처가 별도 수동 작성으로 출발. ※ ② m-07 과 수렴.
- **m-26** `apps/api/src/study/routes.ts:918-971` — **/next category 분기 — 조건부 SQL 조각(subjectClause) + 병렬 binds 배열 수동 동기 + mode_params JSON 파싱 인라인(~20줄)**: 현 구현은 정확(bind 순서 테스트 고정·extractCategorySubject 단일 함수)하나, topic 배선 시 두 번째 조건 필터가 들어오면 clause×binds 조합 2^n 증식 + parse 블록 복제 유혹 — 그 시점에 `parseModeParams(json)` + '필터 조각·bind 쌍 동반 반환 헬퍼' 추출 선행 없이는 bind 순서 불일치류 무음 결함 표면 확대. **지금은 기록만, 집행은 topic 배선 착수 시점이 적기.**

---

## 6. 정상 확인(PASS) 표본 30건 (0건 보고의 증거 — 규칙 2)

1. **[/due ISO bind 수리 정합]** apps/api/src/progress/routes.ts:321-333 — placeholder 3개(user_id=?, fsrs_next_review<=?, LIMIT ?) ↔ .bind(userId, new Date().toISOString(), DUE_LIMIT) 순서/수 일치. 저장 포맷 혼재 부재 전수 grep 확정: fsrs_next_review 쓰기 경로는 study/routes.ts:1211·1228(UPDATE)/1248·1265(INSERT, nextState.due ISO)와 progress/routes.ts:283(INSERT 리터럴 NULL)뿐 — SQLite datetime 포맷 writer 0건 = ISO 사전순 비교 전 행 유효. progress 테스트 22/22 PASS 직접 재실행(당일 due 가드 포함).
2. **[/next category 배선 정합]** apps/api/src/study/routes.ts:921-972 — categorySubject 추출 실패 시 422 정직 거부(무필터 폴백 없음), subjectClause 고정 문자열 2값 택1('' | 'AND eq.subject = ?')로 SQL 주입 표면 0(값은 bind), nextBinds ↔ placeholder 순서 일치. sessionless /next 는 nextMode=null 이라 category 분기 미도달(우회 경로 아님). routes.test.ts 신설 7케이스로 교차 확인.
3. **[/mode Promise.all 정렬 정합]** apps/api/src/study/routes.ts:1552-1640 — 구조분해 8요소와 Promise.all 배열 8쿼리 순서 1:1(categorySubjects 양쪽 모두 말미), categorySubjects 쿼리 subject IS NOT NULL 필터로 `.all<{subject: string}>` 타입 계약과 값 수준 일치.
4. **[0037 인덱스 ↔ 신규 쿼리 양쪽 커버]** migrations/0037 — partial index (exam_type, status, subject) WHERE status='active' AND subject IS NOT NULL. /mode categorySubjects 는 predicate 문언 일치, /next category 의 `eq.subject = ?` 는 partial-index 정리(implies IS NOT NULL)로 사용 가능 — 인덱스 사각 없음(현 545행 규모 비차단).
5. **[DueQueue 이펙트/경합 안전]** DueQueue.tsx:29-48 — cancelled 플래그 + cleanup 으로 unmount 후 setState 차단, 4상태 판별 유니온 전수 분기(unauthenticated 는 null 렌더로 redirect 비트리거), 단위 4건 + SessionStart.category 6건 = 10/10 PASS 직접 재실행.
6. **[mock 표면 drift 점검]** mock-api.ts:117 mapToEndpointKey — '/api/study/progress' vs '/api/progress/due' 포함 관계 충돌 없음, 매 테스트 \_\_mock/reset 초기화 + progressDue 키 state.ts/types.ts 양쪽 동기. makeDueQueue 호출마다 새 객체(공유 가변 상태 0) + count=items.length 서버 계약 동형, node/exam 행 값 의미 정합(직전 MINOR-18 해소 확인).
7. **[수치 경계]** SessionStart.tsx:30-32 MIN_CARDS=1 — handleSelectSubject(:67)·handleChange(:82) 클램프가 선택 가능 과목 풀 초과 생산 불가(NaN 은 Number.isFinite 가드, parseInt 실패 시 상태 불변). effectiveAvailable 0 시 입력·시작 동시 disabled.
8. **[문서-코드 정합 스폿체크]** CLAUDE.md 2026-06-12 블록·MASTER_PLAN §6 #7/#11 행·S5-8 plan Phase 1-D 등재 diff ↔ 검증 코드 상태 대조 — graph-walk DEFAULT_MAX_DEPTH=1 유지, Phase 1-D §9 체크박스 공란(RULE #5 비우회), 'api 694/E2E 19' 표본(progress 22 + web 10) 직접 재현 일치. ws-5c PITR §사실 'card_type 무필터' 정정 완료(직전 MAJOR-4/5 해소 실재).
9. **[categorySubjects 버전 스큐 4분면 전수 안전]** — 신web+구server: optional 타입 + 픽커 빈 안내·시작 disabled(graceful 테스트 실재) + 구server category wired=false 라 /mode/start 422 이중 차단; 구web+신server: categorySubjects additive 필드·구web 미참조·category disabled 표시 — 어느 배포 순서로도 무필터 category 세션 생성 불가.
10. **[WIRED_MODES 런타임 단일 진실원 무침식]** — routes.ts:196-200 Set → /mode 응답 5모드 전부 WIRED_MODES.has() 경유(:1653-1657, 하드코딩 bool 0) → /mode/start 비배선 422 + wiredModes 배열 [...WIRED_MODES] 파생(:1878-1883) → web 은 서버 wired 만 소비 — 제2의 배선 목록 부재(침식은 e2e mock 사본 한정 = 본 보고 MINOR).
11. **[Hard Rule 16/17 신규 표면 전수 PASS]** — fetchDueQueue examId 주입(study-api.ts:150-153, EXAM_IDS 경유) + mock-server ensureExamId 422 패리티(server.ts:78-91) + categorySubjects SQL exam_type bind 시험 경계 유지(routes.ts:1626-1634) + 변경/신규 파일 전수 grep 'son-hae-pyeong-ga-sa' 런타임 리터럴 0건(fixtures.ts:8,23 도 EXAM_IDS 경유).
12. **[fsrs_next_review 포맷 단일성 실증]** — 쓰기 경로 전수 grep: progress/routes.ts:283(NULL 시드)·study/routes.ts:1166/1211/1248(전부 nextState.due ISO bind) 외 writer 0건, datetime('now') 포맷 writer 0건 → /due 신규 ISO bind predicate 와 저장 포맷 전 행 정합, 혼합 포맷 비교 왜곡 잔존 경로 없음.
13. **[/next category WHERE 배선 경계 안전]** — subjectClause 고정 리터럴 2값 분기(routes.ts:949) + subject 값 bind 전용(:950-952, 문자열 보간 0) = 인젝션 표면 0; bind 순서 [userId, examType, subject, count] placeholder 일치, 타과목·NULL subject 제외 테스트 교차 검증.
14. **[Import 방향·Hexagonal 신규 위반 0]** — 변경분 apps/api·apps/web·docs 한정, packages/ 무변경(git status 전수); apps→packages 단방향 유지(신규 import 는 ./types·@/i18n·@/lib 내부 한정); mock-server CORS 상수 @thepick/shared 단일 source 재사용(server.ts:20-27).
15. **[직전 4-Pass 해소 기록 5건 실코드 반영]** — /due ISO bind(+당일 due 회귀 테스트 신설), DueItem.nodeId string|null + 'node 카드 기반' 주석 제거(study-api.ts:132-141), 픽스처 cardType 실값화('flashcard'/'exam'), SessionStart effectiveAvailable 표기 통일(:151,:163), StudyFlow deps [state, streak.longest](:304-306) — 재보고 대상 아님 확정.
16. **[subject SQL 인젝션/와일드카드 표면 없음]** — study/routes.ts:964-972 `AND eq.subject = ?` 정확일치 bind(LIKE 0건, 라우트 전수 grep) + extractCategorySubject(:210-219) trim·비문자열 거부·100자 상한, /mode/start(:1898-1906)·/next(:921-947) 이중 검증 동치(양쪽 trim — 패딩 우회 불가).
17. **[XSS 0건]** — apps/web/src 전체 grep innerHTML/dangerouslySetInnerHTML 0건. 동적 값(entry.subject, due count, 에러 문구) 전부 React 텍스트 노드 렌더.
18. **[/api/progress/due 인증·격리·allowlist]** — requireAuth 전역 마운트(progress/routes.ts:139-143), WHERE user_id = ? 사용자 격리(:328), examId isValidExamId allowlist(:127, 임의 문자열 SQL 미도달).
19. **[직전 리뷰 MAJOR-1 해소 실코드 확인]** — /due predicate ISO bind 통일(progress/routes.ts:325-333) + fsrs_next_review 전체 writer 검증(grep): study/routes.ts:1211/1248 ISO bind, progress/routes.ts:284 NULL 시드 — 혼합 포맷 잔존 행 경로 없음(당일 due 회귀 테스트 포함, api 694 PASS).
20. **[직전 리뷰 MAJOR-2/3/5 해소 실코드 확인]** — DueItem.nodeId: string|null 정정 + 'card_type 무필터(node+exam)' 정직 주석(study-api.ts:130-142), e2e 픽스처 cardType 실 enum 값 + nodeId null 혼합(fixtures.ts:101-110).
21. **[터치 타겟 44px 전수]** — DueQueue CTA(:84), SessionStart 과목 라디오(:124)·카드수 input(:156)·뒤로(:219)·시작(:235) 전부 minHeight 44 + mobile-375.spec.ts:48-57 boundingBox ≥44 전수 검증(WS-0d 이후 stale 였던 '5개 enabled' 계약 정정 확인).
22. **[모드 미배선 정직성 UI 계약]** — e2e 픽스처 wired 실서버 정합 수리(fixtures.ts:36-47) + mock-server /api/progress/due examId 검증·fail-loud 404 유지(server.ts:269-277, app.all '\*' 직전 등록 — 라우트 충돌 없음 확인).
23. **[에러 UX 기술용어 비노출]** — StudyFlow formatApiError(:162-180) kind 별 한국어 안내(HTTP 상태/스택 미노출), 401 전 경로 redirectToLogin, DueQueue 미인증 시 null 렌더(주 흐름 위임 :50-52).
24. **[i18n 신규 키 3계층 동기]** — types.ts:65-69 ↔ ko.ts:58-59 ↔ en.ts:58-59 동시 추가, DueQueue 사용 키 6종 전부 양 locale 실존.
25. **[topic 미배선 = Silent Pivot 아님 (정직 보고)]** — routes.ts WIRED_MODES 주석 'topic_cluster 0/534 → populate(BATCH) 후 재상신' 명기 + CLAUDE.md 블록 "기획 'category·topic' 대비 축소 — 보고 사항" 명시 + 'topic wired=false' 고정 단언 + production 실측(0/534) 직전 4-Pass wrangler --remote 독립 재검증.
26. **[due CTA '복습 시작' 참칭 없음 (3중 확인)]** — DueQueue.tsx:5-7 정직성 주석 + CTA = '학습 시작'(ko.ts:38) + due-queue.spec 라벨·#study-main 앵커 계약 단언 + ws-5c PITR 머리말 '/study/next 는 due 를 모른다' 명기.
27. **[ADR-039 계약 ↔ 구현 일치]** — 'category = 과목 단위 학습' ↔ /next `AND eq.subject = ?` 필터 + /mode/start modeParams.subject 필수 검증(422) + categorySubjects 픽커 데이터 서버 공급(과목명 하드코딩 0) + 무필터 폴백 금지 테스트 6종.
28. **[결재 #1 위임 범위 내 + RULE #5 보존]** — 변경 코드 전부 [L2] WS-5a/5c·선재 결함 수리·e2e/mock 한정(L3 코드 0줄), 결재 카드 9종 확인란 전부 ☐ 공란, S5-8 plan §9 진산 전용란 공란 — AI 가 GO/채택 대신 결정한 흔적 0건. 결재 #7 집행도 '등재만'(D안 구현 코드 0줄).
29. **[CLAUDE.md 갱신 블록 수치·사실 교차검증 PASS]** — ①결재 카드 9종 산술 1:1 ②'E2E 19' playwright projects 실증(chromium 13 + mobile-375 3 + mobile-webkit 3) ③'고아 24·유령 0' integrity 리포트 일치 ④approved 488 + draft 306 = 794 합치 ⑤MASTER_PLAN #20 체크박스 실상태 1:1 ⑥'커밋 = 진산 지시 대기' 플레이북 §1.9 원문 정합.
30. **[직전 4-Pass MAJOR 5건·MINOR 3건 해소 주장 실코드 확인]** — ISO bind 통일 + 당일 due 회귀 가드(구 predicate 에서 FAIL 하는 설계, 마스킹 원리 주석) + DueItem.nodeId 정정 + study-api.ts:130 주석 정직화 + PITR §사실 동기 정정 + 픽스처 cardType 실 enum + effectiveAvailable 표기 + StudyFlow deps.

---

## 7. 판정

```
── 5-PERSONA REVIEW ────────────────────────────
리뷰 방식: 독립 페르소나 5개 병렬 (자가 리뷰 아님) + 확정 전건 적대적 반증 4축
스코프: WS-5a/5c 변경셋 (직전 4-Pass review-20260612-141347 기보고/해소분 제외, 신규만)

렌즈 ① 정합성/리소스 : 🔴 0 / 🟠 0 / MINOR 4 / ✅ PASS 표본 8
렌즈 ② 아키텍처/경계 : 🔴 0 / 🟠 1 (F-1) / MINOR 6 / ✅ PASS 표본 6
렌즈 ③ UX·접근성·보안: 🔴 0 / 🟠 1 (F-2) / MINOR 6 / ✅ PASS 표본 9
렌즈 ④ 요구사항/Pivot : 🔴 0 / 🟠 1 (F-3) / MINOR 4 / ✅ PASS 표본 7
렌즈 ⑤ 기술부채       : 🔴 0 / 🟠 1 (F-4) / MINOR 6 / ✅ PASS 표본 (공유)

합계: CRITICAL 확정 0 / MAJOR 확정 4 / MINOR 26 / 기각 0

판정: 완료 가능(확정 MAJOR 는 메인 세션 즉시 수정 대상)
─────────────────────────────────────────────────
```

### 확정 MAJOR 수리 우선순위 (메인 세션 즉시 수정 대상)

1. **F-1 + F-4 (일괄)**: mock modeStart 에 'category && modeParams.subject 부재 → 422' 분기 + category 시작 e2e 1건(또는 callLog body 기록 후 단언) — 두 렌즈 독립 수렴 표면 동시 해소.
2. **F-2**: progress 라우터에 study-read 동형 rate-limit(60/min, ':progress-read' suffix) 적용 + 429 테스트 1건 — 기존 헬퍼 재사용 소형 수정.
3. **F-3**: G1 게이트 상태(미충족·이월 + available 의미 결정 의존)를 MASTER_PLAN/플레이북에 명시 기록 — 코드 무변경, 문서 정합 수리(차세션 오독 차단).

---

## 해소 기록 (메인 세션, 2026-06-12 — 리뷰 직후)

확정 MAJOR 4건(근원 3개) 전부 즉시 해소:

1. **category 와이어 횡단 무검증 (MAJOR 1+4 동근원)** — ① mock-server `/api/study/mode/start` 가 실 서버 422 계약 동형 검증(WIRED 미등재 → MODE_NOT_AVAILABLE / category subject 누락 → MODE_PARAMS_INVALID, body 파싱 + mode echo) ② `e2e/category-start.spec.ts` 신설 — 픽커→StudyFlow spread→fetch body→mock 검증 전 구간 기계 증거 (spread 회귀 시 422 → spec FAIL).
2. **progress read rate-limit 부재 (MAJOR 2)** — `enforceProgressReadRateLimit`(60/min, `:progress-read` group suffix, 429+Retry-After+sleepJitter — study M-D1 동형) 를 `/summary`·`/due` 에 적용.
3. **G1 게이트 미충족·미기록 (MAJOR 3)** — ① `/mode` category available = subject NOT NULL 풀(Σ categorySubjects)로 정합(구 total 의미는 NULL subject 데이터에서 게이트 정의 충돌 — 기존 테스트 2건 신 계약으로 갱신) ② 통합 테스트 "G1 — 모드별 /next 풀 = available 카운트(category subject별 + mixed)" 신설 = G1 의 API 통합 수준 충족 증거. **정직 기록**: 브라우저 수준 G1 은 mock `/next` 가 mode/subject 를 무시하는 현 인프라 한계로 미충족 — mock /next 모드 인지 보강이 선결 부채로 잔존 (본 보고서 원문 발견 유지).

재검증: api **695** PASS(44 files, G1 테스트 +1) / web 31 / E2E **20**(category-start +1) / typecheck·lint·g1·build PASS. MINOR 26건은 본 보고서가 carry-over 기록처.
