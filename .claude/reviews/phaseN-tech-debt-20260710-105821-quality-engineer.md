# Phase N (promo-1st P0~P4) 기술부채 리뷰 — quality-engineer

- 관점: 테스트 부채 — "프로덕션에서 뭐가 물릴까?"
- 실행 상태: **실행 완료** (발견 7건 = CRITICAL 1 / MAJOR 3 / MINOR 3)
- 통합 인덱스: `phaseN-tech-debt-20260710-105821-INDEX.md`
- 발견 ID 접두: `Q-`

---

## Q-C1 [CRITICAL] 정답 오류 36건 old 행이 인증 학습 경로에서 무방비 서빙·채점 — 공개 표면 M-2 fail-safe 의 인증 표면 부재 + 회귀 테스트 0

- 파일: `apps/api/src/study/routes.ts:681, 936-937, 1114-1124`
- 상세: incident-1st-answer-errors-20260710.md §3 이 인정하듯 old 행 36건은 answer 오답인 채 status='active' 잔존. 인증 study 서빙 WHERE 는 status='active' AND exam_type=? 뿐(routes.ts:936-937)이라 old 행(오답 36 포함)과 신규 {id}-MC 행이 **동일 문항 이중으로** 인증 풀에 공존한다. 결정적으로 채점 경로가 'distractors 부재 또는 parse 실패 → fill_blank fallback (backward-compat)'(routes.ts:681) — 공개 표면이 4-Pass M-2 로 구축·테스트한 MC-in-disguise 거부(public/routes.ts:386-395 + routes.test.ts:297-302)가 인증 표면에는 없고, normalize 가 ②/2/2번을 동치 처리하므로 위치라벨 오답 '2'가 그대로 정답 판정 기준이 된다. 이 비대칭(공개=fail-safe 테스트 2건, 인증=무음 fallback 테스트 0)을 못박는 테스트가 전무 — '정답 100% 계약' 위반이 인증 경로에서 살아있는데 어떤 게이트도 빨간불이 아니다.
- Devil's Advocate: 인시던트 문서가 이미 상태를 정직 기록했고 old 행 정정은 L3 상태머신 plan 대기 = 추적 중인 기지 부채라 MAJOR 강등 가능. 또 현재 인증 학습자는 사실상 테스트 계정뿐이라 실피해 0. 반박: 데이터 정정(L3 결재 대기)과 별개로 '인증 서빙·채점 경로가 오답 36 id 를 소비하지 않는다'는 회귀 테스트는 지금 즉시 자율 작성 가능한데 부재하다. 정답 안전은 CLAUDE.md Hard Stop — 추적 여부와 무관하게 방어선 0 = CRITICAL 유지.
- Horizon: 인증 학습 오픈(런칭) 즉시 — 첫 실사용자가 6·7·8회 기출을 풀는 순간 오답을 정답으로 학습
- 권고: ① answer-corrections.json 의 36 id 를 픽스처로 하는 인증 경로 회귀 테스트(서빙 제외 or 교정값 채점 검증) 즉시 추가. ② 인증 gradeAnswerByType 에 공개 표면과 동일한 parseMcAnswerLabels 가드 이식(별도 L2, backward-compat 영향 명시). ③ old↔-MC 이중 서빙 dedupe 는 L3 plan 에 게이트로 등재.
- INDEX 병합: **B-C1 과 교차 합의 병합 → 통합 CRITICAL C-1** (quality = 오답 채점·회귀 테스트 0 각도 / backend = 이중 진실 행·FSRS 분열·통계 이중 계상 각도)

## Q-M2 [MAJOR] 정답 정본 원장(answer-corrections.json) ↔ production 자동 대조 게이트 부재 — 교정이 일회성 스크립트에만 소비됨

- 파일: `docs/batch-load/promo-mc-distractors/answer-corrections.json` 전체 (소비처 = scripts/promo-p3/build-mc-inserts.ts, rehearse-local.ts 뿐)
- 상세: grep 실측: answer-corrections.json 을 읽는 코드는 일회성 빌드 스크립트 2개뿐, 어떤 반복 실행 테스트/감사 러너도 소비하지 않는다. 프로젝트에는 이미 같은 클래스의 정본 대조 게이트 선례가 있다(packages/quality/src/**tests**/formula-sync.test.ts = 코드↔D1 산식 드리프트 워터마크). 정답에는 그 등가물이 없어, 향후 마이그레이션·재적재·SUPERSEDES 전환에서 교정값이 유실/역전돼도 무감지. 인시던트 §5.3 이 '적재 시점 정답지 실물 대조 게이트 부재 = 근인'이라 자인했으나 재발 방지책은 문서 서술로만 존재하고 구현물 0 — E0-8 P4~P6 갭 적재와 2호 전기기사(CBT 복원 기출 = GT 2계층) 트랙이 동일 파이프라인을 곧 재사용한다.
- Devil's Advocate: -MC 행 521 은 이미 교정 리터럴로 적재됐고 4-Pass + 회차별 독립검증 + 맹검 재확증을 통과 = 현 시점 데이터는 정확. 게이트는 '미래 적재'용이라 지금 없어도 무해하다는 강등 논리 가능. 반박: formula-sync 가 실행 첫 회에 선재 드리프트 55건을 적발한 것이 이 프로젝트의 실측 교훈 — '주장된 정본'은 게이트 없이는 반드시 어긋난다(2026-07-02 갱신 2 §3). 정답은 산식보다 치명도가 높다.
- Horizon: 다음 기출 BATCH 적재 시(E0-8 P4~P6 / 2호 W2 기출 인입) + old 행 정정 마이그 실행 시
- 권고: packages/quality 에 answer-sync 게이트 신설: answer-corrections.json(교정 정본) + 공식 정답지 파생 원장을 단일 진실원으로, production/로컬 스냅샷의 -MC 행 answer 를 전수 대조하는 워터마크 테스트(formula-sync.test.ts 패턴 복제). 적재 플레이북 게이트 G-GAP 류에 '정답지 독립 대조 PASS' 항목 추가.

## Q-M3 [MAJOR] 공개 표면 API 계약 3중 수기 선언 (api/web/e2e-mock) — 경계 횡단 계약 테스트 0 + production 지배 케이스(explanation 부재 0/525) 미커버

- 파일: `apps/web/src/components/public/types.ts:23-50` (↔ apps/api/src/public/routes.ts:81-92 ↔ apps/web/e2e/helpers/fixtures.ts:187+ ↔ e2e/mock-server/server.ts:313-378)
- 상세: PublicNextQuestionOut(api)·PublicQuestion(web)·PublicQuestionFixture(e2e) 가 각각 독립 수기 선언이고 mock-server 핸들러도 응답 shape 를 손으로 복제('routes.ts 정합' 주석 = 사람의 약속일 뿐 컴파일·테스트 강제 없음). 인증 표면 픽스처는 web 타입을 import 해 drift 를 1단 차단하지만(fixtures.ts:10-21), 그 web 타입 자체가 api 와 묶이지 않는 구조는 동일. 구체 드리프트 실물: mock grade/reveal 은 **항상 explanation 을 반환**(server.ts:348,356,370,375)하는데 production 1차는 explanation 0/525(F-5, public/routes.ts:413 주석) — 즉 실서비스의 지배 케이스인 '해설 없음' 렌더 경로를 web 단위 테스트(grep 0건)·E2E 어디서도 실행하지 않는다. api 측 필드 생략 로직만 테스트됨(routes.test.ts:214).
- Devil's Advocate: 모노레포라 api 계약 변경 시 같은 세션이 web 타입도 갱신할 개연성 높고, api routes.test.ts 가 실 SQLite 위에서 계약을 검증하므로 '서버 진실'은 지켜진다 — 프론트 오표시 리스크에 국한된 MINOR 강등 가능. 반박: 이 레포 실측 선례가 정확히 이 클래스다 — 'web E2E 15건이 S2 wired 도입부터 mock 픽스처 미갱신으로 전체 파손'(2026-06-12 갱신 (5)②). 계약 진화가 예정돼 있고(BE-1 보기추출·해설 조달) mock 은 green 을 유지한 채 실서비스만 어긋난다.
- Horizon: 6개월 — BE-1 보기 추출/해설 조달로 공개 계약이 진화하는 시점
- 권고: ① 공개 계약 타입을 packages/shared(또는 api 가 export 하는 contract 모듈)로 단일화해 web·fixtures 가 import. ② mock 픽스처에 explanation-absent 변형 추가 + PublicQuestionCard/FlipDeck 의 해설 빈 상태 단위 테스트 1건. ③ 장기: api routes.test 응답을 zod schema 로 파싱하고 동일 schema 를 web api.ts 가 소비(런타임 계약 단일원).

## Q-M4 [MAJOR] 무인증 표면의 유일한 남용 방어선(IP rate limit)이 전 경로 무테스트 — fail-closed 정책·429 미들웨어 계약 검증 0

- 파일: `apps/api/src/public/rate-limit.ts:19-35` (+ public/routes.ts:210-224, auth/rate-limit.ts:54-69)
- 상세: grep 실측: checkPublicIpRateLimit·handleMissingBinding 을 참조하는 테스트 파일 0건. public routes.test.ts 는 전 케이스를 limiter=undefined + ENVIRONMENT='test'(fail-open 경로)로만 통과시켜, ① limiter 초과 시 429 + Retry-After: 60 헤더 계약(routes.ts:219-222) ② production/staging 에서 바인딩 누락 시 fail-closed(auth/rate-limit.ts:59-65) ③ IP_PEPPER 유무에 따른 키 분기(rate-limit.ts:29-32) 가 전부 한 번도 실행된 적 없다. 무인증 공개 표면은 D1 RANDOM() 쿼리를 익명 트래픽에 직결하는 구조라 rate limit 이 유일한 비용·남용 방어선인데, 정책 함수 리팩토링(예: env 문자열 비교 변경)이 무음으로 fail-open 을 만들 수 있다.
- Devil's Advocate: wrangler unsafe binding 은 로컬 vitest 에서 실물 재현 불가라 stub 테스트의 검증력이 제한적이고, handleMissingBinding 은 auth 표면에서 이미 운영 검증된 재사용 코드다 — MINOR 강등 가능. 반박: stub RateLimiter({limit:()=>{success:false}}) 로 미들웨어 429 계약은 완전 검증 가능하고, fail-closed 분기는 순수 함수라 단위 테스트 비용이 10분이다. '재사용이라 안전'은 회귀를 막지 못한다 — 이 표면은 P5 배포로 인터넷에 직접 노출된다.
- Horizon: P5 공개 배포 직후 — 홍보 트래픽/봇 스파이크 첫날
- 권고: public/**tests**/rate-limit.test.ts 신설: stub limiter 로 429+Retry-After 미들웨어 관통 1건, handleMissingBinding production/staging fail-closed·dev fail-open 각 1건, pepper 유무 키 분기 1건. 배포 스모크에 PUBLIC_RATE_LIMITER_IP 바인딩 존재 확인 추가.

## Q-m5 [MINOR] SERVE_CANDIDATE_LIMIT=10 이 production 실비율(무필터 풀 결함행 ≈50%)에서 미모델링 — 간헐 헛 404 확률을 잣대 없이 배포

- 파일: `apps/api/src/public/routes.ts:156, 254-277`
- 상세: production 공개 풀 = 유효 MC 521 + 결함(위치라벨 fill_blank) 525 ≈ 결함률 50%. flip 모드(inputType 미필터, constants.ts:45)는 이 혼합 풀에서 RANDOM() 10 후보를 뽑으므로 후보 전원이 결함행일 확률 ≈ 0.5^10 ≈ 0.1%/요청 → 유효 문항이 있는데도 NO_QUESTION 404. 테스트는 2행 장난감 픽스처(routes.test.ts:161-183)로 메커니즘만 검증하고 production 형상 비율에서의 통계적 충분성(LIMIT 10 vs 20)은 어디에도 산정·기록 없음. subject×round 필터 조합이 좁아질수록 악화.
- Devil's Advocate: mc 모드(주력)는 input_type='multiple_choice' SQL 필터로 결함행이 후보에 아예 안 들어와 영향 0이고, blank 모드는 전량 404 가 이미 정직 기록됨 — 실노출은 flip 모드 0.1%뿐이며 FE-9 빈 패널+재시도 UX 가 흡수한다. 사실상 무해해 보고 가치 자체가 의문. 반박(유지 사유): '확률이 낮다'가 산정된 곳이 코드 주석·테스트 어디에도 없다는 것 자체가 부채 — BE-1 후 풀 구성이 바뀌면 아무도 재계산하지 않는다.
- Horizon: 홍보 트래픽 스파이크(시험 시즌) — 대략 1/1000 flip 요청이 헛 빈 상태
- 권고: production 비율(50% 결함) 시뮬레이션 테스트 1건(시드 500+500, 100회 요청 404율 상한 assert) 또는 SQL 단계에서 결함행 배제(-MC suffix 아닌 old 행의 input_type 재분류 = 인시던트 처분 C안과 합류).
- INDEX 병합: **P-M2 에 흡수 → 통합 M-9** (동일 file·동일 확률적 404 증상 — quality 는 '통계 잣대 부재' 각도로 반향)

## Q-m6 [MINOR] share-image.ts(캔버스 공유 이미지 138줄) 테스트 0 + E2E 공개 표면 adverse-path(429 UX·오프라인·세션 중단) 0

- 파일: `apps/web/src/lib/share-image.ts:1-138` (+ apps/web/e2e/public-practice.spec.ts:17-107)
- 상세: share-image.ts 는 테스트 파일 부재(grep 0건) — 캔버스 좌표/텍스트 오버플로 회귀가 비가시. E2E 5건은 전부 happy path(랜딩·MC·빵꾸·플립·빈상태)로, 429 rate-limit UX(클라이언트 파싱은 api.test.ts:65 에서 단위 커버되나 화면 관통 0), 오프라인 전환, 세션 중간 네트워크 실패 시 AttemptRecord/스트릭 정합이 브라우저 수준에서 미검증.
- Devil's Advocate: share-image 는 순수 표시 기능(학습 정확성 무관)이고 캔버스는 jsdom 에서 실렌더 검증이 어렵다. E2E adverse-path 는 mock-server override(publicNextResponse 강제)가 이미 있어 추가 비용이 낮은 만큼 '부채'라기보다 '증분 백로그'가 정확할 수 있음. MINOR 가 적정 상한.
- Horizon: 6개월 유지보수 — 디자인 리터치/Tailwind 업그레이드 시 공유 이미지 무음 파손
- 권고: share-image 는 레이아웃 계산 함수를 분리해 순수 단위 테스트(문자열 절단·좌표 경계). E2E 는 mock override 로 429 시퀀스 1건 + 오프라인(context.setOffline) 1건 추가.

## Q-m7 [MINOR] 모드별 라이브 데이터 존재 smoke 게이트 부재 — blank 모드 '라이브 0'은 정직 기록됐으나 이후 승급·회귀를 감지할 기계 장치가 없음

- 파일: `docs/plans/promo-1st-p4-frontend-ledger.md:43, 52` (+ apps/web/src/components/public/constants.ts:22-47)
- 상세: 빵꾸노트(fill_blank) 모드는 production 서빙 자격 문항 0으로 출시되며 이는 원장에 명시됐다(무음 아님). 그러나 '각 PRACTICE_MODE 가 라이브에서 ≥1 문항을 서빙한다/못한다'를 주기적으로 확인하는 smoke 가 없어, ① 후속 콘텐츠 트랙이 fill_blank 를 승급해도 모드가 여전히 죽어있는 회귀(예: isServable 조건 변화) ② 반대로 MC 풀이 마이그레이션으로 비는 회귀를 배포 후 아무도 모른다. E2E 는 mock 이 항상 문항을 주므로 영원히 green.
- Devil's Advocate: 출시 전 1회성 수동 확인으로 충분하고, /status/ 라이브 페이지 관행이 이미 있어 운영 축(devops 페르소나) 소관일 수 있음 — 페르소나 경계상 devops 와 중복 위험. 테스트 부채 관점 지분은 'E2E green ≠ 라이브 기능 생존' 간극에 한정.
- Horizon: fill_blank 콘텐츠 승급 트랙 착수 시(수개월) + 이후 모든 exam_questions 마이그레이션
- 권고: 배포 후 smoke 스크립트에 모드×3 GET /api/public/questions/next 실호출을 추가해 기대 상태(mc=200, blank=404[현행 기대], flip=200)를 명시 assert — 기대가 바뀌는 순간 스크립트 갱신이 강제되는 living contract 로.

---

## 확인 항목 (증거 기반)

- PASS — apps/api/src/public/**tests**/routes.test.ts:1-366: 공개 표면 통합 테스트가 실 SQLite+마이그레이션 위에서 경계 회귀(2차 id 거부:272-277, flagged 제외:135-146,279-283), 서빙 projection 정답·해설 비노출(105-107), reveal 전 분기(312-365), MC-in-disguise fail-safe(154-159,297-302), choiceId 위조 거부(234-242)까지 커버 — 공개 표면 자체의 테스트 품질은 높음
- PASS — apps/web/src/lib/**tests**/local-progress.test.ts:9-11: fake-indexeddb/auto 로 실제 Dexie 트랜잭션 위 검증(스토리지 mock 아님), FSRS 전이·스트릭 idempotent·KST 경계·export/import 왕복·봉투 검증 거부 커버 — 로컬 진도 계층 테스트 견고
- PASS — apps/web/e2e/mock-server/server.ts:380-384: unhandled route fail-loud 404 + gradeSequence empty/overflow fail-loud(215-230) — mock 무음 fall-through 차단 패턴 유지
- PASS — packages/learning-modes/src/**tests**/mc-choices.test.ts(86줄) + apps/api/src/public/**tests**/choice-id.test.ts(51줄): 채점 계약 단일 정본(parseMcChoices)과 불투명 choiceId HMAC 이 각각 독립 테스트 보유
- PASS — apps/web/src/components/public/**tests**/: api.test.ts(에러코드→사용자 문구 전수 + 429 Retry-After 파싱:65-66), rating.test.ts(FSRS 매핑), PublicQuestionCard.test.tsx, hangul-hint.test.ts(초성 힌트) — 프론트 순수 로직 단위 커버 존재
- PASS — docs/plans/promo-1st-p4-frontend-ledger.md:52: 빵꾸노트 라이브 데이터 0 을 '무음 아님 — 최종 보고에 명시'로 정직 기록 (Silent Pivot 아님 확인)
- PASS — scripts/promo-p3/build-mc-inserts.ts:304-305: -MC 신규 행 적재가 old 행 무접촉 INSERT(0004 트리거 회피 정합) + rehearse-local.ts 리허설 존재 확인
- N/A — G-S5 golden N=19 통계 유의도: 기존 리뷰 체인(06-02 감사·07-07 3차 실측)에서 이미 등재·진산 R5 대기 중인 기지 부채 — 본 리뷰 스코프(promo-1st 최근 변경)에서 중복 보고 제외
- N/A — cryptoShuffle modulo bias(public/routes.ts:137-141): 2^32 % n 편향은 n≤5 에서 무시 가능 수준 + 채점 무관(choiceId) — 4-Pass 급 단기 이슈로도 성립 안 함, 보고 제외
- 확인 — apps/api/src/study/routes.ts:681 'distractors 부재 또는 parse 실패 → fill_blank fallback' + :936-937 인증 서빙 WHERE(status/exam_type 만) = Q-C1 근거 실코드 확인
- 확인 — grep 전수: answer-corrections.json 소비처 = scripts/promo-p3 2파일뿐(테스트/게이트 0), checkPublicIpRateLimit·handleMissingBinding 테스트 참조 0건, apps/web public **tests** 내 explanation 부재 케이스 0건
- 확인 — apps/api/src/auth/rate-limit.ts:54-69 handleMissingBinding = production/staging fail-closed 정책 실재(코드상 안전) — 단 테스트 핀 없음(Q-M4 근거)
