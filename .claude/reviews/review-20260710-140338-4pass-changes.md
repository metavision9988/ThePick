# 4-Pass 독립 리뷰 — promo-1st P5 변경 집합 (공개 표면 overview·PracticeMap·배포 게이트)

- **일시**: 2026-07-10 14:03:38
- **리뷰 방식**: 독립 에이전트 5개 (scope / Surgeon / Architect / Advocate / Contract) + 발견별 적대적 반증 (verify pass)
- **확정 발견 (반증 통과분만)**: CRITICAL **0** / MAJOR **6** / MINOR **16** (raw 발견 중 반증 격추·하향 반영 후)
- **판정**: **완료 가능** (CRITICAL 0 — 단 MAJOR 6은 규칙상 즉시 수정 또는 명시 이월 대상)

## 리뷰 범위

**변경 파일 17개** (+230/-4, 수정 14 + 신규 3):

- apps/api/src/middleware/cache-policy.ts
- apps/api/src/public/routes.ts
- apps/api/src/public/analytics.ts
- apps/api/src/public/**tests**/routes.test.ts
- apps/web/src/components/public/PracticeMap.tsx
- apps/web/src/components/public/PublicPracticeApp.tsx
- apps/web/src/components/public/api.ts
- apps/web/src/components/public/types.ts
- apps/web/src/layouts/BaseLayout.astro
- apps/web/package.json
- apps/web/scripts/check-deploy-env.mjs
- scripts/smoke-public-surface.mjs
- apps/web/e2e/mock-server/server.ts
- apps/web/e2e/mock-server/state.ts
- apps/web/e2e/mock-server/types.ts
- apps/web/e2e/helpers/mock-api.ts
- apps/web/e2e/public-practice.spec.ts

**연관 파일 16개**:

- apps/api/src/index.ts
- apps/api/src/middleware/**tests**/cache-policy.test.ts
- apps/api/src/public/rate-limit.ts
- apps/api/src/public/choice-id.ts
- apps/api/src/public/**tests**/choice-id.test.ts
- apps/api/src/auth/rate-limit.ts
- apps/api/src/telemetry/routes.ts
- apps/api/wrangler.toml
- packages/learning-modes/src/index.ts
- packages/learning-modes/src/input-types/
- apps/web/src/pages/practice.astro
- apps/web/src/components/public/constants.ts
- apps/web/src/components/public/PracticePicker.tsx
- apps/web/src/components/public/**tests**/api.test.ts
- apps/web/src/lib/study-api.ts
- apps/web/astro.config.mjs

**변경 요약**: API 측 — GET /api/public/questions/overview 신설(subject×round 집계, isServable 서버측 정확 판정으로 공개 서빙과 동일 잣대) + analytics.ts 'defect' 이벤트 kind/defectReason blob 추가 + cache-policy.ts 에 overview 단일 경로 `public, max-age=300` carve-out(기존 /api/public no-store 기본 유지). Web 측 — PracticeMap.tsx(지형도 MOC 아웃라인, aria-expanded) 신설 + PublicPracticeApp/api/types 배선 + BaseLayout CF Web Analytics 비콘(env 주입) + 배포 게이트 스크립트 2종(smoke-public-surface.mjs 배포 후 스모크 / check-deploy-env.mjs PUBLIC_API_BASE_URL Binary Gate) + mock server overview 핸들러 및 E2E 지도 테스트.

---

── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 5개 (scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 17개 + 연관 파일 16개 (상단 목록)

**Pass 1 (Surgeon): ✅ 19건 확인 / 🔴 0건 / 🟠 2건 / (MINOR 4건) / N/A 3건**
확인 (발췌 3+):

- apps/api/src/public/routes.ts:389-405 — D1 `.first()` null 반환 명시 처리(row===null → 404 QUESTION_NOT_FOUND), null 크래시 경로 없음 (reveal 동일 513-529)
- apps/api/src/public/routes.ts:242-254, 318-327, 398-401, 523-526 — 스코프 내 D1 쿼리 4곳 전부 await + try/catch + logger.error + 500 반환, 빈 catch 0건
- apps/api/src/public/choice-id.ts:43-54,75 — 빈 secret 폴백 + 제출 choiceId 위조 거부 → isCorrect=false 수렴(왕복·위조 테스트 choice-id.test.ts:21-42 고정)
- 테스트 실행 실측 — apps/api src/public + src/middleware 4파일 **60 tests PASS** (routes.test.ts 28 포함, 원문 출력 확인)
- (전체 확인 항목 22건 — §Pass별 전체 확인 항목 참조)
  반론: mock overview 픽스처(total 521 vs Σ subjects 346)에 FE 가 합산 검증 로직을 추가하는 순간 E2E 가 실서버와 다른 세계를 검증하는 무음 드리프트가 된다 — 오늘 깨지는 테스트는 없으나 픽스처 정합성 부채.

**Pass 2 (Architect): ✅ 17건 확인 / 🔴 0건 / 🟠 1건 / (MINOR 4건) / N/A 4건**
확인 (발췌 3+):

- apps/api/src/public/routes.ts:22-33 + packages/learning-modes/src/index.ts:1-93 — Import 방향 단방향(packages→apps 역류 0), parseMcChoices 등 계약 시그니처 원본 일치
- apps/api/node_modules/hono/dist/middleware/cors/index.js:83-85 — cors 가 non-'\*' origin 응답에 `Vary: Origin` append → overview 공용 캐시(max-age=300)에도 오리진 교차 캐시 오염 없음 확인
- migrations/0032_exam_questions_input_type.sql ↔ overview/serve/grade SQL 컬럼 전수 일치(raw prepared statement 만 — NC-1 정합)
- apps/api/wrangler.toml — PUBLIC_RATE_LIMITER_IP + PUBLIC_ANALYTICS dataset 3환경 전수 선언, index.ts:61-62 Bindings 타입 정합
  반론: cache-policy 의 exact-match(:66) → prefix(:75) 순서는 현재 정확하나 기계 강제(테스트)가 없다 — 순서 재배열 리팩터 한 번이면 전체 green 인 채 carve-out 이 무음 소실된다 (MAJOR-4/MINOR 로 보고).

**Pass 3 (Advocate): ✅ 22건 확인 / 🔴 0건 / 🟠 0건 / (MINOR 5건) / N/A 2건**
확인 (발췌 3+):

- apps/api/src/public/routes.ts:166-177, 455-479 — 정답 안전 Hard Stop: isServable 단일 정본 + MC-in-disguise 양방향 채점 거부 + essay/calc 문자열 폴백 금지 (routes.test.ts:154-183, 297-309 회귀 고정)
- apps/web/src/components/public/api.ts:19-30 + api.test.ts:29-47 — 전 서버 에러코드 → 한국어 사용자 문구 단일 매핑, 코드 원문(`[A-Z_]{4,}`) 노출 금지 단언
- apps/api/src/public/analytics.ts:50-63 — AE 기록 차원 = kind/subject/round/inputType/examType/defectReason 뿐, IP·userId·문항 본문·정답 텍스트 미기록 (PII 0)
- 스코프 17파일 전수 — innerHTML/dangerouslySetInnerHTML 0, TODO/HACK/placeholder 0, 유일 무음 catch = PracticeMap.tsx:39 (MINOR 로 보고)
  반론: 세션 내 중복 회피 재시도(최대 3배 증폭)가 60 req/min 공개 rate limit 과 간섭 가능 — 정상 속도면 한도 내이나 카드플립 연타 사용자는 429 강하에 닿을 수 있다(강하 UX 는 정상, 관측 항목만 확보 권고).

**Pass 4 (Contract): ✅ 21건 확인 / 🔴 0건 / 🟠 3건 / (MINOR 3건) / N/A 4건**
확인 (발췌 3+):

- docs/plans/promo-1st-free-service-scope-20260708.md §3 BE-3 ↔ routes.ts:229-280 — 기출 축(subject×round)만 집계, knowledge_nodes 접촉 0 = 스코프 정합
- Hard Rule 15/16/17 — 범용 계층 무변경 + 시험 특화 분기 0 + 'son-hae-pyeong-ga-sa' 런타임 리터럴 0 (FIXED_EXAM_TYPE='1st' 는 차수 컬럼 값), examId 미수용 = P1 기결 carry-over(BE-7 봉투) 정합
- G-1(서버 user 기록 0)·G-5(도메인 하드코딩 금지) 불변 — user_progress 무접촉·진도 로컬 전용 + PUBLIC_SITE_URL env 주입
- P4 원장 :74 MINOR 처분(P5 배포 Binary Gate 명기) 이행 — check-deploy-env.mjs + package.json:10 deploy:production 선두 배선 확인
  반론: BE-6③ 비콘 pivot 은 기술적으로 우월한 선택일 개연성이 높다 — 그러나 정당성과 무관하게 본 프로젝트 거버넌스는 갈림길의 '기록'을 요구하며 기록 비용은 1줄이다 (MAJOR-5).

**판정: 완료 가능** (4-Pass 전체 CRITICAL 0건 — MAJOR 6건은 즉시 수정 또는 명시 이월 필요)
────────────────────────────────────

---

## 확정 발견 상세 (적대적 반증 통과분)

### MAJOR (6건)

#### MAJOR-1 [Surgeon] overview 공용 캐시 carve-out 이 응답 status 무감각 — 429/500 에러 응답에도 `public, max-age=300` 스탬프

- **파일**: apps/api/src/middleware/cache-policy.ts:66-69
- applyCachePolicy 는 path 만 보고 c.res.status 를 보지 않는다. 공개 라우터 per-IP rate-limit(routes.ts:210-224)의 429, D1 실패 500(routes.ts:251-254)이 모두 `Cache-Control: public, max-age=300` 을 달고 나간다. 임시 vitest 실측 재현: 429 → `public, max-age=300` / 500 → `public, max-age=300`. RFC 9111 상 명시적 freshness 는 상태코드 무관 캐시 저장 허용 → 다운스트림 캐시가 에러를 5분 재사용 → 정상 복구 후에도 PracticeMap 5분 collapsed 고정 가능.
- **수정**: carve-out 분기를 `path === '/api/public/questions/overview' && c.res.status === 200` 으로 게이트, 비-200 은 /api/public no-store 분기로 강하. (기존 /api/content·/api/search 도 동일 클래스지만 선재 — 별건 처분 가능.)
- **확인 증거**: cache-policy.ts:54-89 status 검사 부재 / routes.ts:210-224 429 경로 실재 / index.ts:137-140 전역 등록·덮어쓰기 의도 주석 / 임시 테스트 실측(재현 후 삭제)
- **반론(Devil's Advocate)**: Workers 응답은 Cache API 미사용 시 엣지 자동 캐시 없음 + 브라우저는 429/500 재사용에 보수적 — 실피해 확률 낮고 최악 영향도 '지도 5분 비노출' 한정이라 CRITICAL 아닌 MAJOR.
- **반증 판정**: CONFIRMED / refuted=false / severity keep. 429·500 경로가 설계된 경로(rate limiter 선행)임을 실코드로 재확증, 완화 요인은 이미 MAJOR 등급에 반영. 캐싱 보안-floor 미들웨어 내 결함 + 1줄 수정.

#### MAJOR-2 [Surgeon] cache-policy 신규 규칙 2건(/api/public/\* no-store + overview carve-out)의 단위 회귀 테스트 0건

- **파일**: apps/api/src/middleware/**tests**/cache-policy.test.ts:5-81
- 테스트 파일은 auth/user/progress/payment/content/search/기타만 커버 — `/api/public` 문자열 0건(grep 확인). routes.test.ts:325 는 `Cache-Control null` 단언으로 미들웨어 계층 명시적 스코프 아웃. 유일 검증 = 배포 후 수동 스모크. 코드 주석 스스로 '지뢰 #5(공개 서빙/채점 응답 공용 캐시 유출)' 경고하면서 규칙 순서 재배열·prefix 추가 회귀를 기계 차단하는 테스트가 없다. '테스트 없이 완료 금지' 위반 클래스.
- **수정**: cache-policy.test.ts 에 3케이스 — ① GET overview → 'public, max-age=300' ② GET /api/public/questions/next → 'no-store' ③ POST /api/public/grade → 'no-store'. MAJOR-1 수정 시 429/500 케이스 동봉.
- **확인 증거**: cache-policy.test.ts:8-14 라우트 7개에 public 계열 부재(전문 열람) / grep 'questions/overview' → 테스트 히트 = routes.test.ts 뿐 / routes.test.ts:325 명시적 위임 / smoke-public-surface.mjs:37-53 배포 후 수동 전용
- **반론**: 스모크가 배포 게이트라면 결국 잡힌다 — 그러나 수동 호출(package.json 미배선)이고 로컬 검출이 비용 1/100.
- **반증 판정**: CONFIRMED / keep. PUBLIC_PATH_TTL 추가 단일 변경은 :75 no-store 조기 반환이 구조적으로 차단하나, 그 가드 자체가 순서 의존·미테스트이고 carve-out 은 1줄 재배열로 회귀(무검출). 보안 경계 신규 diff 의 배포 전 검증 0 = MAJOR 유지.

#### MAJOR-3 [Architect] cache-policy overview carve-out 상태코드 무시 — 429/500 에 `public, max-age=300` (에러 5분 캐시 오염, MAJOR-1 과 동일 결함의 독립 재발견)

- **파일**: apps/api/src/middleware/cache-policy.ts:66-69
- Architect 렌즈 독립 재발견(교차 확증). 추가 관측: 429 응답의 `Retry-After: 60` 과 `max-age=300` 의미 충돌 동봉. 선재 PUBLIC_PATH_TTL_SECONDS(/api/content, /api/search)에도 동일 클래스 존재(선재분) — 이번 diff 가 새 인스턴스를 추가.
- **수정**: MAJOR-1 과 동일(carve-out 에 `c.res.status === 200` 게이트) + 선재분 동일 게이트 적용 검토(별건 처분 가능).
- **확인 증거**: cache-policy.ts:54-69 pathname 만 검사 / routes.ts:219-222 Retry-After 60 동봉 429 / routes.ts:251-254 동일 path 500 / index.ts:135-140 등록 순서로 전 public 응답 통과 확인
- **반론**: 현재 공유 캐시 미가동(Cache API/Cache Rules 미사용) + 브라우저 보수적 — 그러나 Cache Rules 도입 한 번이면 즉시 발현하는 지뢰이고 수리 1줄.
- **반증 판정**: CONFIRMED / keep. 429/500 양 경로 전부 실코드 재현, 반증 시도(서브라우터 조기 반환 우회 / onError 신응답 / 기존 테스트 검출) 전부 실패. ADR-008 §8 캐시 계약·no-store floor 파일에 신규 결함 클래스 유입 = MAJOR.

#### MAJOR-4 [Contract] cache-policy 신규 보안 경계 분기 2개에 유닛 회귀 테스트 0 — 지뢰 #5 클래스 회귀가 머지 시점 무음 통과 (MAJOR-2 와 동일 갭의 독립 재발견)

- **파일**: apps/api/src/middleware/**tests**/cache-policy.test.ts:1-81
- Contract 렌즈 독립 재발견(교차 확증). 핵심 위험 = carve-out 매칭 완화(=== → startsWith)·순서 이동 시 `public, max-age=300` 이 /next(요청별 셔플)·/grade(정답 노출)로 확장되는 시나리오 — 기본 no-store fallback(:88)이 못 막는 방향.
- **수정**: MAJOR-2 의 3케이스 + (선택) overview 가 PRIVATE_PATH_PREFIXES 뒤에 평가됨(순서) assert.
- **확인 증거**: cache-policy.test.ts:5-15 public 경로 미등록 / grep 전수 → public 캐시 헤더 assert 테스트 0건 / routes.test.ts:325 위임 / index.ts:140·176 — 미들웨어가 이 경로의 유일한 캐시 방어선
- **반론**: 스모크(P5 blocking)가 결국 잡는다 — 그러나 배포 후·수동이라 CI 시점 무음 통과를 못 막고, 스모크 실패 시점엔 이미 라이브 노출 후.
- **반증 판정**: CONFIRMED / keep. 발견 확인사항 4건 전부 실코드 재확증. "carve-out 확장" 방향 회귀는 fallback 무방어 — 정답 노출 응답의 공유 캐시 유입을 지키는 유일한 기계 게이트 부재 + 수정 비용 3케이스 극소 = MAJOR 유지.

#### MAJOR-5 [Contract] BE-6③ 'Web Analytics(Pages 스니펫, 코드 0줄)' → 수동 비콘(코드 18줄+env 토큰) 구현 — 위임 결정 기록 부재 (Silent Pivot 클래스)

- **파일**: apps/web/src/layouts/BaseLayout.astro:20-23, 80-92
- scope 정본(promo-1st-free-service-scope-20260708.md:50)은 'Pages 스니펫, 코드 0줄' 명시 — 구현은 beacon.min.js 수동 스니펫 + PUBLIC_CF_BEACON_TOKEN env 조건부 출력. 코드 주석에 기술 근거는 있으나 P4-D1~D8 패턴(결정+사유+기각 대안+'위임' 라벨)의 P5 결정 기록이 docs/plans 어디에도 없다(P5 원장 파일 자체 부재). CRITICAL RULE #1 클래스.
- **수정**: P5 원장(또는 P4 원장 append)에 위임 결정 1건 기록 — 결정(수동 비콘+env 게이트) / 사유(미설정 무음 방지·환경별 제어) / 기각 대안(Pages 자동 주입 = 코드 0줄이나 미설정 무음) / '위임' 라벨. 최종 보고 1줄 포함.
- **확인 증거**: scope doc :50 원문 / BaseLayout.astro:83-92 구현 실재 / docs 전체·.jjokjipge·.claude/reviews 재수색 결정 기록 0건 / check-deploy-env.mjs:22-24 경고 배선(구현 자체는 완결적)
- **반론**: env 게이트형 수동 스니펫이 기술적으로 우월할 개연성 높음 — 그러나 정당성과 무관하게 거버넌스는 '기록'을 요구하며 비용은 1줄.
- **반증 판정**: CONFIRMED / keep. 핸드오프 문구는 과업 나열일 뿐 pivot 승인 아님. 구현이 기록보다 먼저 존재하는 순서 역전 발생. 런타임 위험 0 이라 CRITICAL 아님 — 프로젝트가 1급으로 다루는 Silent Pivot 클래스 실위반이므로 MAJOR 유지.

#### MAJOR-6 [Contract] RC-5 'P5 전 정리 카드'(공개 계약 타입 shared 단일화·/api/public/meta) 무언 미이행 — PublicOverview 계약이 오히려 3곳 중복으로 확대

- **파일**: docs/plans/promo-1st-p4-frontend-ledger.md:90
- P4 원장 :90 'RC-5 → P5 전 정리 카드' 명시. P5 변경 집합은 미이행(packages/shared·learning-modes 에 Public\* 계약 타입 0건 — grep) + 생략 처분 기록도 없음. 오히려 overview 계약이 ①routes.ts:265-279 inline ②web types.ts:53-61 ③mock server.ts:313-331 3중 수기 선언으로 drift 표면 확대. 시점 조건('P5 전') 무언 소멸 = Silent Pivot 클래스.
- **수정**: (a) RC-5 를 P5 후속 카드로 명시 이월 + 사유 1줄, 또는 (b) 공개 계약 타입 shared 단일화 소건 커밋. 최소선 = (a).
- **확인 증거**: 원장 :90 원문 / grep PublicOverview → packages 0건 / 동일 계약 3중 선언 실코드 대조
- **반론**: RC-5 는 blocking 승격 아닌 정리 카드였고 통합 테스트+E2E 가 drift 를 잡는다 — 그래도 시한부 자기 처분의 무기록 이월은 카드 무한 이월 전례가 된다.
- **반증 판정**: CONFIRMED / keep. types.ts 가 'P5 BE-3' 자기 라벨 = 시점 조건 도래 확정. E2E 는 mock 을 치므로 mock↔real drift 무커버. 같은 매트릭스의 RC-3 blocking 승격이 RC-5 도 실처분임을 방증. 프로세스 클래스 MAJOR 적정.

### MINOR (16건)

| #   | Pass      | 제목                                                                                                                                              | 파일:라인                                                                      | 처분 요지                                                                                                                |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | Surgeon   | E2E mock overview 픽스처 불변식 위반 — total 521 vs Σ subjects 346                                                                                | apps/web/e2e/mock-server/server.ts:313-331                                     | total 346 정정 또는 subjects 파생 계산으로 불변식 코드 고정                                                              |
| 2   | Surgeon   | smoke-public-surface.mjs fetch 5곳 전부 타임아웃 부재 — 배포 게이트가 네트워크 스톨 시 무한 대기                                                  | scripts/smoke-public-surface.mjs:33-93                                         | 각 fetch 에 `AbortSignal.timeout(15_000)` (Node 18+ 내장, 의존성 0)                                                      |
| 3   | Surgeon   | 진성 숫자 단답(fill_blank answer '1'~'5' 등)이 MC-in-disguise 오분류 — 서빙·채점·reveal 거부 + defect 지표 오염                                   | apps/api/src/public/routes.ts:173-176, 455-470, 560-565                        | fail-safe 유지 타당 — BE-1 승급 검수 시 별도 분류 + defectReason 정직화('mc_in_disguise_or_numeric_short_answer')        |
| 4   | Surgeon   | PracticeMap subject key 충돌 잠재 — null subject 와 실제 과목명 '기타' 공존 시 React 중복 key                                                     | apps/web/src/components/public/PracticeMap.tsx:68, 84                          | key 를 `s.subject ?? '__null__'` sentinel 분리(라벨 폴백 '기타' 유지)                                                    |
| 5   | Architect | mock overview 픽스처 불변식 위반(독립 재발견, #1 동일) — 계약 정합 자기선언과 모순                                                                | apps/web/e2e/mock-server/server.ts:313-331                                     | #1 과 동일 처분(총계 346 정정 또는 재배학 175 추가)                                                                      |
| 6   | Architect | mock overview 핸들러 override 미지원 — 빈 지도·오류 강하 경로 e2e 검증 불가                                                                       | apps/web/e2e/mock-server/server.ts:313-315                                     | publicOverviewResponse override 추가 또는 PracticeMap unit 테스트 2건(빈 응답/reject → null 렌더)                        |
| 7   | Architect | cache-policy 신규 규칙 회귀 테스트 0건 (반증 verify 에서 MAJOR→**MINOR 하향**: no-store floor 가 fail-safe 이중 방어)                             | apps/api/src/middleware/**tests**/cache-policy.test.ts:18-81                   | MAJOR-2/4 의 3케이스 추가로 함께 해소                                                                                    |
| 8   | Architect | overview 집계 잣대(MC+fill_blank) ↔ 회차 탭 소비 잣대(mc 단독) 불일치 (반증 verify 에서 MAJOR→**MINOR 하향**: 현 데이터 영향 0·발현 시 정직 강하) | apps/web/src/components/public/PublicPracticeApp.tsx:226                       | BE-1 승급 게이트 선결 조건으로 per-inputType 카운트 또는 부채 원장 등재                                                  |
| 9   | Advocate  | PracticeMap overview 실패 무음 접힘 — catch 로깅 0 (동일 변경셋 '무음 금지 warn' 정책과 불일치)                                                   | apps/web/src/components/public/PracticeMap.tsx:39-41                           | `console.warn('[public] overview fetch failed', err)` 1줄 추가                                                           |
| 10  | Advocate  | E2E 지도 실패/빈 응답 강하 시나리오 미커버 + mock override 부재(#6 연동)                                                                          | apps/web/e2e/public-practice.spec.ts:109-127                                   | SerializedOverrides 에 publicOverviewResponse 추가 + spec 1건(overview 500 → 지도 비노출 && 픽커 노출)                   |
| 11  | Advocate  | 중복 회피 재시도(최대 3배 증폭) × 60 req/min rate limit 간섭 가능 — 회차 세션 후반 429 강하 시나리오                                              | apps/web/src/components/public/PublicPracticeApp.tsx:61-72                     | 당장 수정 불요 — AE 에서 공개 표면 429 비율 관측 항목만 확보(P5 배포 후)                                                 |
| 12  | Advocate  | 배포 스모크가 production AE 에 합성 이벤트 주입(serve·grade·card 각 1건/배포) — 홍보 지표 원천 미세 오염                                          | scripts/smoke-public-surface.mjs:44-80                                         | 수정 불요(기록만) — 필요 시 blob smoke 마커 차원 선택지                                                                  |
| 13  | Advocate  | cache-policy carve-out/no-store unit 테스트 0건 (반증 verify 에서 MAJOR→**MINOR 하향**: 위험 방향은 테스트된 no-store floor + POST 비캐시가 받침) | apps/api/src/middleware/**tests**/cache-policy.test.ts:18-81                   | MAJOR-2/4 의 테스트 케이스 추가로 함께 해소                                                                              |
| 14  | Contract  | 지형도 수치 잣대 ≠ 회차 탭 세션 잣대(#8 동일 클래스, 독립 재발견) — BE-1 승급 후 잠재 수치 불일치                                                 | apps/web/src/components/public/PracticeMap.tsx:20 (+PublicPracticeApp.tsx:226) | 택1: overview inputType 분해 / 표기 의미 정렬 / BE-1 게이트 체크리스트 1줄 등재(최소선)                                  |
| 15  | Contract  | mock overview 픽스처 불변식 위반(#1/#5 동일, 독립 재발견)                                                                                         | apps/web/e2e/mock-server/server.ts:313-331                                     | 픽스처 1줄 수정                                                                                                          |
| 16  | Contract  | P5 배포 blocking 체크리스트(RC-3 승격분) 중 비코드 항목 — 알림 1채널(Email Routing)·DR runbook 매핑 미확인 리마인드                               | docs/plans/promo-1st-p4-frontend-ledger.md:88                                  | 배포 직전 체크리스트에 2항목 상태 명기(① Email Routing 활성 여부 — 진산 행위 ② runbook 에 공개 표면·Pages env 롤백 반영) |

> 중복 발견 주석: MINOR #1/#5/#15(mock 픽스처)와 #8/#14(잣대 불일치), MAJOR-1/-3(캐시 status)과 MAJOR-2/-4(캐시 테스트)는 각각 서로 다른 Pass 렌즈의 **독립 재발견 = 교차 확증**으로, 수정은 각 1건이면 동시 해소된다. 실효 고유 이슈 수 = MAJOR 4클래스(캐시 status 게이트 / 캐시 테스트 / BE-6③ 기록 / RC-5 이월) + MINOR 11클래스.

---

## Pass별 전체 확인 항목 (증거 원장)

### Pass 1 — SURGEON (✅ 19 / N/A 3)

1. PASS apps/api/src/public/routes.ts:389-405 — D1 .first() null 명시 처리(404 QUESTION_NOT_FOUND), reveal 동일 513-529
2. PASS routes.ts:242-254, 318-327, 398-401, 523-526 — D1 쿼리 4곳 await + try/catch + logger.error + 500, 빈 catch 0
3. PASS routes.ts:329-332 + routes.test.ts:347-353 — 빈 후보 배열 → 404 NO_QUESTION / overview 0건 → total 0 + subjects []
4. PASS routes.ts:196-203, 445-448, 554-557 — issueChoiceId 루프 3곳 await 존재(crypto.subtle Promise 누락 없음)
5. PASS routes.ts:144-153 — cryptoShuffle i>0 → randomIntBelow(≥2)만 호출, % 0 불가, 표시 셔플 전용(채점은 choiceId)
6. PASS apps/api/src/public/analytics.ts:49-67 — writeDataPoint try/catch + warn(무음 금지), fire-and-forget, defectReason blob[5] 고정
7. PASS apps/api/src/public/choice-id.ts:43-54,75 — 빈 secret 폴백 + 위조 choiceId 조기 null → isCorrect=false (choice-id.test.ts:21-42)
8. PASS packages/learning-modes/src/input-types/mc-choices.ts:66-88 — distractors JSON.parse try/catch + 무음 filter 금지 + 중복 보기 거부
9. PASS packages/learning-modes/src/types.ts:15-18 — resolveInputType null/미지값 폴백이 fail-safe 수렴(SQL IN 제외·422)
10. PASS apps/api/src/public/rate-limit.ts:26-34 + auth/rate-limit.ts:54-72 — production/staging fail-closed, dev/test fail-open(warn), 테스트 실측
11. PASS apps/api/wrangler.toml:108-117, 180-189, 253-262 — rate limiter 네임스페이스 분리 + AE dataset 3환경, Bindings 타입 정합
12. PASS apps/api/src/index.ts:135-140, 176 — /api/public CORS credentials:false + cachePolicy 전역 등록 + 마운트, FK PRAGMA 에러 500
13. PASS apps/web/src/components/public/api.ts:73-104 — offline 선검사 → fetch 분류 → PublicApiError 단일화, Retry-After NaN → null 강하
14. PASS apps/web/src/components/public/PracticeMap.tsx:27-47 — cancelled 플래그 unmount 가드, 실패/빈 → collapsed(픽커 불차단)
15. PASS apps/web/src/components/public/PublicPracticeApp.tsx:56-98, 195 — sessionGen 세대 가드 stale 응답 폐기, persistReview warn
16. PASS apps/web/scripts/check-deploy-env.mjs:11-20 + package.json:10 — PUBLIC_API_BASE_URL 미설정/localhost/비-https exit 1, deploy 선행 배선
17. PASS apps/web/e2e/mock-server/server.ts:353-379, 400-404 — grade body 가드 + unhandled fail-loud 404, state reset 격리
18. PASS apps/web/e2e/public-practice.spec.ts:109-127 + StatusPanels.tsx:41-48 — FE-6 지도 E2E + FE-9 빈 패널 문구 실코드 일치
19. PASS 테스트 실행 실측 — apps/api src/public + src/middleware 4파일 60 tests PASS(원문 확인)
20. N/A 산식 정밀도·Formula Engine 동적 실행 — 산식 연산 경로 0(essay/calc 422 거부로 원천 차단 확인)
21. N/A Vectorize/Claude API/pdfplumber await — 스코프 내 해당 호출 0(외부 I/O = D1 + AE 뿐)
22. N/A FSRS 음수 interval — 공개 표면 서버측 user_progress 기록 0(G-1), FSRS 는 본 diff 무접촉

### Pass 2 — ARCHITECT (✅ 17 / N/A 4)

1. PASS Import 단방향 — routes.ts:22-33 / learning-modes/index.ts:1-93 (packages→apps 역류 0)
2. PASS learning-modes 계약 실재 — parseMcChoices/parseMcAnswerLabels/resolveInputType/gradeFillBlank export + 인자 순서 원본 일치
3. PASS Workers 제약 — fs/path 0, Web Crypto 만, overview 전량 스캔은 현 규모 CPU 여유 + 캐시·rate-limit 억제
4. PASS D1 스키마 일치 — SQL 컬럼 ↔ migrations/0032 실재, raw prepared statement 만(NC-1 정합)
5. N/A Ontology Lock — knowledge_nodes/edges ID 생성·참조 0(read-only SELECT 만)
6. N/A truth_weight 정렬 — RAG→LLM 주입 경로 스코프 밖(search/graph 무접촉)
7. N/A Temporal Graph — 전부 SELECT read-only, UPDATE/INSERT 0(전수 열람)
8. N/A IndexedDB↔D1 동기화 — local-progress 무변경, 서버 기록 = AE fire-and-forget 뿐
9. PASS Hexagonal/마운트 격리 — /api/public 별도 라우터, study 우회 마운트 없음(지뢰 #2), credentials:false
10. PASS CORS×공용캐시 Vary 정합 — hono cors 가 Vary: Origin append(node_modules 실코드), cors→cachePolicy 순서로 최종 부착
11. PASS cache-policy 매칭 순서 — exact(:66) 가 prefix(:75) 선행, 현 코드 정확(기계 강제 부재는 발견으로 보고)
12. PASS wrangler.toml 바인딩 3환경 정합 — PUBLIC_ANALYTICS + PUBLIC_RATE_LIMITER_IP 전수, 타입 일치
13. PASS AE blob 스키마 안정성 — defectReason 후미 append, 기존 blob[0..4]·doubles[0] 불변, indexes[0] 재사용
14. PASS 서빙 projection 정답 비노출 — PublicNextQuestionOut 에 answer/explanation 부재 + overview count 만
15. PASS isServable 서버측 단일 잣대 — overview(:256)·serve(:329) 동일 함수 공유
16. PASS 배포 Binary Gate 배선 — check-deploy-env.mjs 차단 + deploy:production 선행(localhost 폴백 무음 배포 차단)
17. PASS E2E mock 배선 정합 — mapToEndpointKey publicOverview(next 보다 선행 검사) + 카운터 + 지도 spec 연쇄
18. PASS CF 비콘 env 게이트 — 토큰 미설정 시 미출력 + check-deploy-env 경고 표면화, SRI 미적용 사유 주석
19. PASS i18n/에러 UX — 에러코드 → 한국어 단일 매핑 + 코드 원문 비노출 테스트, 인라인 한국어는 기존 관례 정합(신규 위반 아님)
20. PASS 접근성/터치 — aria-expanded·minHeight 44·role=status + BaseLayout 전역 44px 상속
21. PASS 스모크 게이트 설계 — 전 체크 실패 exit 1, 정답 비노출·no-store·공용 캐시·경계 404 라이브 검증(CI 아님은 발견 참조)

### Pass 3 — ADVOCATE (✅ 22 / N/A 2)

1. PASS 정답 안전(Hard Stop) — isServable 단일 정본 + MC-in-disguise 양방향 거부 + essay/calc 폴백 금지(테스트 고정)
2. PASS 정답 비노출 projection — 응답 + 테스트 + 스모크 3중 확인
3. PASS overview 정보 최소화 — examType+count 트리만(보기 텍스트 부재 단언)
4. PASS XSS — 17파일 전수 innerHTML/dangerouslySetInnerHTML 0, 비콘 JSON.stringify + Astro 이스케이프
5. PASS 입력 검증 — zod 스키마(길이 상한) + subject 100자·round 양의 정수·inputType 화이트리스트, 전 SQL bind
6. PASS 캐시 보안 경계 — exact carve-out + /api/public no-store + 폴백 no-store floor + Vary:Origin 자동
7. PASS rate limit — 전 핸들러 선행 + Retry-After 60 + SHA-256(IP||pepper) 해시(PII 0) + production fail-closed
8. PASS CORS 격리 — credentials:false(쿠키 미전송, 인증 표면 분리)
9. PASS 에러 UX — 전 서버 코드 → 한국어 문구 단일 매핑 + '코드 원문 노출 금지' 단언 + role=alert
10. PASS 상태 4종 — 로딩(role=status)/빈(no_question)/에러/오프라인 분기 전부 실재 + e2e 회귀
11. PASS 접근성 44px+ — 전역 규칙 + inline minHeight 이중 보장
12. PASS 접근성 시맨틱 — section aria-label·aria-expanded·sr-only 라벨, 키보드 = 네이티브 요소
13. PASS 오프라인 전략 — no-store(SW 캐시 비대상 정합) + OfflineIndicator + 오프라인 전용 문구 + IndexedDB 로컬 진도
14. PASS PII 0(AE) — 기록 차원 6종뿐, IP·userId·본문·정답·questionId 미기록(주석 계약 일치)
15. PASS 시크릿 하드코딩 0 — 비콘 토큰·API_BASE env 주입, choice-id 폴백 상수 보안 무영향 근거 주석
16. PASS 배포 Binary Gate — exit 1 차단 + 선행 배선 + 비콘 미설정 경고(무음 폴백 아님)
17. PASS 스모크 계약 검증 — 5축 + 정답 choiceId ∈ 서빙 집합 + 경계 404 + 실패 exit 1 원문 출력
18. PASS mock ↔ 실서버 계약 정합 — 4핸들러 shape 일치 + unhandled fail-loud + state reset 격리
19. PASS 지도→세션 배선 — onPick → startSession('mc') + e2e 연쇄 회귀
20. PASS 세션 레이스 가드 — sessionGen 세대 카운터로 모드 불일치 문항 렌더 차단
21. PASS 텔레메트리 경계 불변 — X-Admin-Token 인증 + /api/telemetry private 유지(본 변경 무접촉)
22. PASS stub/TODO/빈 catch 스캔 — 전 파일 0건, 유일 무음 catch = PracticeMap.tsx:39(MINOR #9 로 보고)
23. N/A Formula Engine/동적 실행 — essay/calc 422 거부로 수식 연산 경로 부재
24. N/A IndexedDB↔D1 동기화 — 공개 표면 진도 = G-1 로컬 전용(서버 기록 0)

### Pass 4 — CONTRACT (✅ 21 / N/A 4)

1. PASS BE-3 기출 축 스코프(G-4) — overview = subject×round 집계만, knowledge_nodes 접촉 0
2. PASS overview isServable = 공개 서빙 동일 잣대 — 서빙 경로와 같은 함수, SQL 근사 아님
3. PASS 경계 강제 서버 고정 — WHERE status/exam_type + SERVABLE IN, 클라 치환 경로 0
4. PASS 정답·보기 비노출 — count 트리만 + 테스트 assert
5. PASS cache carve-out 최소 표면 — exact 단일 경로 + no-store 기본 + private 선행 + 지뢰 #5 주석
6. PASS overview TTL 300s = 기존 /api/content 공용 캐시 클래스 일관
7. PASS Hard Rule 17 — 'son-hae-pyeong-ga-sa' 런타임 리터럴 0(FIXED_EXAM_TYPE='1st' 는 차수 컬럼 값)
8. PASS Hard Rule 15 — 범용 계층 무변경, 시험 특화 분기 신설 0
9. PASS Hard Rule 16 이월 정합 — examId 미수용 = P1 기결 carry-over(BE-7 봉투), examType 동봉으로 봉투 유지
10. PASS 단일 벤더(Cloudflare) — 비콘 = 호스팅 벤더 자신 + AE, 외부 SaaS 0
11. PASS PII 0 — blobs 사유 코드 문자열만(문항 id·본문·IP 미포함)
12. PASS AE 바인딩 3환경 전수 — dev/staging/production dataset 선언
13. PASS PUBLIC_API_BASE_URL Binary Gate — P4 원장 :74 처분 이행 확인
14. PASS 배포 후 스모크 5축 — P4 원장 :88 RC-3 'smoke blocking' 이행 확인
15. PASS overview 계약 통합 테스트 — 결함행 집계 제외 + 빈 상태 200 + 비노출
16. PASS E2E 지도 배선 — aria-expanded 토글 → 회차 탭 → 세션 진입 + mock 카운터
17. PASS FE-6 = 지형도 방법론 모바일 기본값(MOC 아웃라인) 정합 — 실패 시 접힘 = 픽커 불차단
18. PASS 접근성/상태 UX — aria·44px·에러코드 매핑(기술 에러 비노출)
19. PASS stub/TODO/placeholder/빈 catch 0 — 변경 17파일 전수(catch 전부 분류·warn·error 처리)
20. PASS G-1(서버 user 기록 0) 불변 — user_progress 무접촉, 진도 로컬 전용
21. PASS G-5 도메인 하드코딩 금지 — PUBLIC_SITE_URL env 주입 + Astro.site 파생, thepick.app 부활 없음
22. N/A 수치/임계값 constants ↔ 교재 원문 — 도메인 상수·산식·constants DB 접촉 0(mock 수치 = Rule 17 픽스처 예외)
23. N/A BATCH 순서 — 데이터 적재 없음(P3 기적재분 MC 521 소비만)
24. N/A 노드 ID 네이밍 — knowledge_nodes/edges/formulas 접촉 0
25. N/A Formula Engine/LLM 수식 계산 금지 — 수식 연산 경로 없음(공개 표면 422 거부)

---

## 판정

- **4-Pass 전체 CRITICAL: 0건** → 프로토콜 기준 **"완료 가능"**.
- 단, **MAJOR 6건(실효 4클래스)은 규칙 4(즉시 수정) 대상**:
  1. 캐시 carve-out status 게이트 1줄 (MAJOR-1/-3)
  2. cache-policy.test.ts 3케이스 추가 (MAJOR-2/-4, MINOR #7/#13 동시 해소)
  3. BE-6③ 비콘 위임 결정 1건 원장 기록 (MAJOR-5)
  4. RC-5 명시 이월 또는 shared 단일화 소건 커밋 (MAJOR-6)
- MINOR 16건은 보고·처분 기록(즉시 수정 3건 권장: mock 픽스처 1줄 / smoke 타임아웃 / PracticeMap warn 1줄, 나머지는 BE-1 게이트·배포 체크리스트·관측 항목으로 원장 등재).
