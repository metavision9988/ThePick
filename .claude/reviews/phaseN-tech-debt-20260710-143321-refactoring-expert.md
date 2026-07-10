# Phase N 기술부채 리뷰 — refactoring-expert (코드 품질 부채)

- 관점: "6개월 뒤 이 코드가 버틸까?"
- 스코프: promo-1st P0~P5 변경(공개 학습 표면 BE+FE, serving-guard, MC 적재 스크립트) 중심
- 일시: 2026-07-10 14:33 (ts 20260710-143321)
- 발견: CRITICAL 0 / MAJOR 6 / MINOR 5

## MAJOR

### RF-M1. ExamType('1st'|'2nd') 유니온·리터럴이 6곳+ 독립 선언 — Hard Rule 15/16/17 계열 부채가 신규 코드에서 증식

- 위치: `apps/api/src/public/routes.ts:48` (+ `apps/api/src/study/serving-guard.ts:31`, `apps/api/src/study/routes.ts:125`, `apps/api/src/db/schema.ts:136`, `apps/web/src/components/session/types.ts:16`, `apps/web/src/components/StudyFlow.tsx:47`, `packages/parser-1st-exam/src/types.ts:8`)
- 상세: packages/shared 에 ExamType 선언이 0건(grep 'ExamType|EXAM_TYPES' shared = 무출력)인데 '1st'|'2nd' 유니온/enum/Set 이 api·web·parser 에 최소 7개 사이트로 독립 선언돼 있고, 이번 promo 작업이 FIXED_EXAM_TYPE(public/routes.ts:48)과 GUARDED_EXAM_TYPES(serving-guard.ts:31 — stringly-typed ReadonlySet<string>) 2개 사이트를 추가했다. 또한 public/routes.ts 의 exam_questions 조회 4곳(243,312,390,517)은 전부 핸들러 인라인 raw SQL — Hard Rule 16 의 'examId 첫 인자 래퍼' 시그니처가 0건이라 Rule 16 본문 기준 'Year 1 시점에 이미 위반 판정' 클래스다. 이는 07-04 엔진분리 리뷰가 못박은 '오염 진앙 = shared 유니온 3중선언'과 동일 패턴의 재생산이며, M1 plan 의 탈오염 표적 4심볼(NodeType 등)에 exam_type 축은 미포함이라 방치 시 잔존한다.
- Devil's Advocate: exam_type 은 손해평가사 내부의 1차/2차 축이지 exam_id('son-hae-pyeong-ga-sa')가 아니므로 Hard Rule 17 문면 위반은 아니다. 공개 표면의 '1st' 고정은 보안 경계(클라 치환 불가)라는 제품 요건 자체이기도 하다. 다만 2호 전기기사(필기/실기 체계 상이)가 공개 표면·serving-guard 를 재사용하는 순간 7개 사이트 전수 수정이 필요하므로 '경계 고정'과 '선언 단일화'는 별개 — 강등 사유가 되지 못한다.
- Horizon: 2호 전기기사 트랙이 공개 표면/학습 표면을 재사용하는 시점(M1 이후 ~6개월) — 사이트 하나라도 누락 시 stringly Set 은 컴파일 에러 없이 무음 미가드
- 권고: packages/shared 에 EXAM_TYPES/ExamType 단일 선언 후 7개 사이트 전부 import 로 수렴(기계적 치환, 동작 불변). createPublicRoutes 를 examType 파라미터 팩토리로(기본값 상수 주입 = 경계 고정 유지). 인라인 SQL 은 최소 public 모듈 내 query 헬퍼로 묶어 Rule 16 시그니처(examId 첫 인자) 확보.

### RF-M2. /api/public/grade ↔ /api/public/reveal 약 110줄 준중복 — 이미 드리프트 시작(defect AE 이벤트 비대칭)

- 위치: `apps/api/src/public/routes.ts:378-499 vs 505-587`
- 상세: 두 핸들러가 동일 SELECT SQL(391-394 vs 518-521 자구 동일), answer 부재 422 분기, MC 계약 파싱+correctChoiceIds 재발급 루프(445-448 vs 556-559), MC-in-disguise 검사, Record<string,unknown> body 조립까지 복제한다. 드리프트 실증: grade 의 fill_blank 위치라벨 경로(455-471)는 recordPublicEvent('defect', {defectReason:'mc_in_disguise_or_numeric_short_answer'}) 를 기록하지만 reveal 의 동일 경로(562-566)는 로그만 남기고 AE defect 이벤트가 없다 — M-19 가 'AE = 유일 결함율 집계 원천'이라 명시했으므로 reveal 경유 결함은 이미 집계에서 새고 있다.
- Devil's Advocate: reveal 은 카드플립·힌트 소비 경로라 결함율 분모가 달라 의도적 생략일 수 있고, 2개 엔드포인트 중복은 '3회 반복부터 추상화' 휴리스틱상 조기 추상화 반론이 가능하다. 그러나 주석·원장 어디에도 생략 의도 기록이 없고(P4-D1 원장은 AE 'card' 이벤트만 언급), BE-1 보기 추출 승급 시 answer 계약 처리가 바뀌면 두 곳 동기 수정 의무가 생기므로 fetch+자격판정+정답표현 조립을 공통 함수로 뽑는 것은 과추상화가 아니다.
- Horizon: BE-1(보기 추출) 승급 또는 old 행 상태머신 마이그 시(~6개월) 한쪽만 수정되는 무음 비대칭 — 그 전에도 결함율 지표는 지금부터 reveal 몫만큼 과소집계
- 권고: loadGradableRow(db, questionId) + buildAnswerPayload(row, secret) 공통 함수 추출(경계 WHERE·422 분기·correctChoiceIds 재발급 단일화), reveal 경로에도 defect AE 기록 추가(또는 생략 사유를 코드 주석으로 명문화).

### RF-M3. 서빙 자격 판정 이원화 — public isServable(양성형) vs study isMisgradableRow(음성형) 두 벌 유지

- 위치: `apps/api/src/public/routes.ts:166-177` (vs `apps/api/src/study/serving-guard.ts:41-49`)
- 상세: 동일한 데이터 결함(MC-in-disguise old 525행)을 막는 술어가 두 모듈에 극성·범위가 다르게 존재한다: public isServable 은 exam_type 무검사·essay/calc=false 양성 화이트리스트, study isMisgradableRow 는 GUARDED_EXAM_TYPES('1st') 한정·essay/calc 통과 음성 블랙리스트. 둘 다 learning-modes 의 parseMcChoices/parseMcAnswerLabels 를 감싸는 앱 계층 술어인데 정본 패키지(learning-modes)가 아닌 apps/api 두 폴더에 흩어져 있고, overview 엔드포인트(229-280)는 isServable 을 전 행 재파싱으로 세 번째 소비까지 한다. serving-guard.ts 헤더 스스로 '공개 표면 isServable 의 인증판 비대칭 해소'라고 비대칭을 자인한다.
- Devil's Advocate: 의미가 실제로 다르다 — 인증 표면은 essay/calc 를 정규 지원하므로 단일 술어로 합치면 '2차 계약 테스트 37건 파손' 실측이 재현될 수 있고(serving-guard 주석), 무리한 단일화가 오히려 오차단을 낳는다. 타당한 반론이나, 그렇다면 최소한 '위치라벨 answer × 보기 계약 성립 여부'라는 공통 코어 판정을 learning-modes 로 내리고 표면별 정책(대상 input_type·exam_type)만 파라미터로 남기는 계층화는 여전히 성립한다.
- Horizon: old 행 상태머신 마이그/BE-1 승급 시(~6개월) 세 소비 지점(next·grade·overview + study 2곳) 중 일부만 갱신 → 표면 간 서빙 수치·채점 가능 집합 무음 불일치
- 권고: learning-modes 에 assessGradability(row) 코어 판정(위치라벨×계약 성립) 신설, isServable/isMisgradableRow 는 이를 소비하는 표면 정책 어댑터로 축소. old 행 상태머신 마이그가 착지하면 두 술어를 status 조건으로 대체하는 폐기 경로를 주석에 명시.

### RF-M4. 웹 픽커 과목·회차 하드코딩 — 같은 화면의 overview API 와 이중 진실원, 매년 개정 직격

- 위치: `apps/web/src/components/public/constants.ts:50-57`
- 상세: FIRST_EXAM_SUBJECTS(과목명 3개 문자열)·FIRST_EXAM_ROUNDS([5..11])가 '2026-07-10 production 실측' 스냅샷으로 하드코딩돼 PracticePicker(45,61)에 공급되는데, 같은 picker phase 에 렌더되는 PracticeMap(FE-6)은 P5 에서 신설된 GET /api/public/questions/overview 로 subject×round 를 라이브 수신한다(PublicPracticeApp.tsx:224-227). 주석의 '서버가 subject 목록 API 를 제공하지 않으므로(v1 스코프)' 전제는 P5 BE-3 착지로 이미 무효 — 한 화면 안에서 필터 목록의 진실원이 2벌이다. production-quality.md '하드코딩 금지(개정 시 코드 수정 불필요)' 원칙 위반.
- Devil's Advocate: 값 불일치 시 NO_QUESTION 정직 강하가 설계돼 있어 무음 오동작은 아니고, 제12회 기출 적재는 진산 결재 사안이라 시점 불확실 — MINOR 강등 논리 가능. 그러나 '신규 회차가 지도에는 보이는데 픽커에서는 선택 불가'는 코드 수정 없이는 해소 불가능한 구조적 stale 이고, 과목명은 교재·법령 개정 시 문자열이 바뀌는 축이므로(개정 대응은 이 서비스의 핵심 요구) MAJOR 유지.
- Horizon: 제12회 기출 적재 시점(연 1회 주기, ~6개월~1년) 즉시 — 픽커 회차 목록 stale; 과목명 개정 시 해당 과목 필터가 영구 빈 풀
- 권고: PracticePicker 가 overview 응답(subjects[].subject / rounds[].round)을 필터 옵션 원천으로 소비(이미 캐시 5분 공용). FIRST_EXAM_SUBJECTS/ROUNDS 는 overview 실패 시 폴백으로 강등하거나 삭제.

### RF-M5. PracticeMap.tsx 소스에 리터럴 NUL(0x00) 바이트 — git 이 .tsx 를 바이너리로 취급, diff/blame/리뷰 표면 상실

- 위치: `apps/web/src/components/public/PracticeMap.tsx:69` (byte offset 2584)
- 상세: React key sentinel `key={s.subject ?? '\x00null'}` 에 이스케이프가 아닌 **원시 NUL 문자**가 박혀 있다(python 바이트 검사로 확증: has NUL = True, 제어문자 1건). 그 결과 git 이 파일 전체를 바이너리로 판정(`git diff --numstat` = `- -`, 커밋 4824f02 diff --stat 에 'Bin 0 -> 4349 bytes') — 이 파일의 모든 후속 변경은 diff·blame·PR 리뷰·4-Pass diff 스코핑에서 불투명해진다. 이 프로젝트의 품질 하네스(4-Pass/5-페르소나)가 git diff 기반이므로 리뷰 인프라 자체를 무력화하는 유지보수 부채.
- Devil's Advocate: 런타임 동작은 동일하고(esbuild/TS 는 문자열 내 NUL 허용) 단일 파일 한정이라 '버그'는 아니다 — 4-Pass 소관 단기 결함으로 볼 수도 있다. 그러나 기능 결함이 아니라 향후 6개월간 이 파일의 변경 추적성이 계속 죽어 있는 문제이므로 기술부채 축이 맞고, 실제로 이번 리뷰에서도 P4→P5 사이 PracticeMap 변경 내용을 diff 로 확인할 수 없었다(실증).
- Horizon: 즉시~지속 — 다음 PracticeMap 수정 커밋부터 리뷰 불능 누적
- 권고: 이스케이프 문자열(`' null'`)로 치환(동작 동일·1줄). 재발 방지로 lint 또는 quality-gate.sh 에 제어문자(0x00-0x08,0x0B,0x0C,0x0E-0x1F) 감지 추가.

### RF-M6. 확정 오답 36건 포함 old 525행이 status='active' 로 잔존 — 차단이 소비자별 JS 술어에 위탁된 shotgun 책임 구조

- 위치: `apps/api/src/study/serving-guard.ts:15-17` (+ `public/routes.ts:162-163`)
- 상세: incident-1st-answer-errors-20260710 의 old 행(오답 36 포함)이 데이터 계층에서는 여전히 active 이고, 서빙 차단은 exam_questions 를 읽는 **모든** 소비자가 isServable/isMisgradableRow 를 기억해 호출해야만 성립한다. 현재 소비자는 grep 실측 2모듈(study/routes.ts:955,1127 + public/routes.ts)로 커버리지 100%이나, 이 불변식을 강제하는 기계 장치(뷰·트리거·lint)가 없어 세 번째 소비자(관리자 조회·통계·export·RAG golden 추출 등)가 추가되는 순간 가드 누락이 기본값이 된다. old 행 처분 정본이 '별도 L3 plan(진산 결재)'로 명시 이월돼 있음은 확인 — 본 지적은 이월 기간 동안의 구조 리스크 기록이다.
- Devil's Advocate: 이미 인시던트 문서+주석으로 정직 기록된 승인된 carry-over 이고, L3(마이그) 영역이라 페르소나가 즉시 수정을 요구할 수 없다 — 중복 보고라는 반론. 다만 기존 기록은 'old 행 정정'의 이월만 다루고 '이월 기간 중 신규 소비자의 가드 누락 리스크'와 그 완화(읽기 뷰 단일화)는 어디에도 없어 신규 관점이다.
- Horizon: exam_questions 의 세 번째 소비자 추가 시점(관리자 화면·지표·export 중 먼저 오는 것, ~3-6개월) — 가드 누락 = 확정 오답 36 재노출
- 권고: L3 마이그 전 임시 완화: servable 조건을 SQL 스니펫 상수(또는 D1 VIEW exam_questions_servable)로 단일화하고 '신규 소비자는 이 뷰만 읽는다' 규칙을 dev-guide 에 1줄 추가. 상태머신 마이그 착지 시 뷰/술어 동시 폐기.

## MINOR

### RF-m1. choiceId secret 해석 로직 분산 — `c.env.JWT_SECRET ?? ''` 3회 반복 + 폴백 상수는 choice-id 내부 은닉

- 위치: `apps/api/src/public/routes.ts:338, 436, 555` (+ `public/choice-id.ts:44`)
- 상세: 핸들러 3곳이 각자 `?? ''` 를 쓰고 실제 폴백(CHOICE_ID_FALLBACK_KEY)은 hmacHex 안에서 빈 문자열을 다시 치환한다 — secret 결정이 2단 분산돼 있어, 향후 키 로테이션/종목별 키 도입 시 4곳을 만져야 한다.
- DA: F-3(정답 어차피 공개) 하에서 이 secret 은 hygiene 용이라 보안 영향 0 이 문서화돼 있고, 반복이 3회뿐이라 비용이 작다.
- 권고: choiceIdSecret(env: PublicRouteBindings): string 헬퍼 1개로 수렴하고 폴백 결정을 한 곳으로. (Horizon: 6개월+, 키 로테이션·2호 공개 표면 도입 시)

### RF-m2. 공개 API 에러코드 문자열이 서버·클라 이중 선언 — 공유 타입/상수 부재

- 위치: `apps/web/src/components/public/api.ts:19-30` (vs `apps/api/src/public/routes.ts` 의 'NO_QUESTION' 등 리터럴 8종)
- 상세: 서버는 'QUESTION_NOT_GRADABLE' 등 raw 리터럴을 반환하고 클라 ERROR_MESSAGES 는 같은 문자열을 키로 재선언한다. 서버가 코드를 추가/개명하면 클라는 컴파일 에러 없이 INTERNAL_ERROR 문구로 폴백 — 오타 1자도 무음.
- DA: 폴백이 graceful 하고 코드 수가 10개 내외라 실해가 작다. web 이 apps/api 타입을 직접 import 하지 않는 현 구조상 공유 지점 신설 비용이 있다.
- 권고: packages/shared 에 PUBLIC_ERROR_CODES as const 선언 후 양측 import. (Horizon: 6개월 유지보수)

### RF-m3. sourceTextOf 유틸이 PublicQuestionCard 컴포넌트 파일에 기생 — BlankNote/FlipDeck 이 카드 컴포넌트에 역의존

- 위치: `apps/web/src/components/public/BlankNote.tsx:16` (FlipDeck.tsx:18 동일)
- 상세: 출처 표기 포매터가 컴포넌트 파일에서 export 되어 형제 모드 컴포넌트 2개가 UI 컴포넌트 파일을 import 한다 — 모듈 경계가 '카드가 포매터의 집'이라는 우연에 결합.
- DA: 3파일 내부 응집이고 순환 없음 — 실질 비용 미미. 권고: format.ts(또는 types.ts 인접)로 이동.

### RF-m4. Analytics Engine blob 위치 스키마 무버전 — 차원 추가 시 과거 데이터와 해석 어긋남

- 위치: `apps/api/src/public/analytics.ts:50-63`
- 상세: blobs[0..5] 의미가 위치 관례로만 고정(주석)이고 스키마 버전 blob 이 없다. blobs[0]=kind 는 indexes[0] 과 중복. AE 는 append-only 라 미래에 차원을 중간 삽입하면 기존 집계 쿼리가 무음으로 다른 의미를 읽는다.
- DA: AE 쿼리는 어차피 운영자 소관 SQL 이고 append(끝에 추가) 규율만 지키면 안전 — devops 페르소나 영역과 접경.
- 권고: blobs 말미에 스키마 버전('v1') 고정 + '차원은 append-only' 주석 규약 1줄. (Horizon: 1년)

### RF-m5. study/routes.ts 2,252줄 God 모듈 지속 성장 — 이번 phase 에도 +135줄 in-place 추가

- 위치: `apps/api/src/study/routes.ts:1-2252`
- 상세: 라우트 7개 + 셔플/채점/서빙가드 배선 + 진도까지 한 파일. 이번 promo 작업은 serving-guard·mc-choices 를 밖으로 뽑은 좋은 방향과 동시에 본체에도 +135줄을 얹었다(diff --stat). 신규 public/ 모듈이 590줄로 잘 분할된 것과 대비되는 잔존 부채.
- DA: M1 plan·기존 5-페르소나 리뷰에서 이미 인지된 선재 부채라 신규 보고 가치가 낮고, 이번 변경만 보면 추출(guard/mc-choices)이 순방향이다 — 그래서 MINOR.
- 권고: 다음 study 표면 작업 시 채점 경로(gradeAnswerByType+buildShuffledChoices)를 grading.ts 로 분리하는 소규모 추출을 동반(빅뱅 금지, plan 승인 범위 내). (Horizon: 6개월~Year 2)

## 검증 증거 (checkedItems)

- PASS — packages/learning-modes/src/input-types/mc-choices.ts:55-111 parseMcChoices 단일 정본이 인증(study/routes.ts:437 buildShuffledChoices)·공개(public/routes.ts:172,188,421,541) 양 경로에서 공유됨 — 보기 파싱 복붙 0 확증
- PASS — apps/api/src/public/choice-id.ts:43-81 무상태 HMAC choiceId 단일 책임 모듈, 셔플시드 이중화 없음(설계 주석과 구현 일치)
- PASS — grep(any|as any|TODO|HACK|console.log) apps/api/src/public + apps/web/src/components/public + serving-guard.ts = 0건 (테스트 제외)
- PASS — exam_questions 소비자 전수 grep = study/routes.ts + public/routes.ts 2모듈뿐이며 양쪽 모두 자격 술어 배선 확인(study/routes.ts:955 필터, 1127 채점 가드) — 현 시점 가드 커버리지 100%
- PASS — apps/web/src/components/public/api.ts:73-104 fetch 래퍼 단일화(오프라인/네트워크/429 분류 일원), 에러 문구 매핑 단일 정본
- PASS — apps/web/src/components/public/rating.ts FSRS 매핑이 순수 함수로 분리(easy 는 자평 전용 정책이 코드 주석으로 명문화)
- PASS — scripts/promo-p3/build-mc-inserts.ts:136-145 교정 오버레이 부재/pending/자기일관성 위반 시 throw(fail-loud) — 무음 skip 경로 0 확인
- PASS — apps/api/src/index.ts:135,176 공개 라우트가 credentials:false CORS + 별도 라우터로 마운트, 인증 study 라우터 우회 마운트 없음(지뢰 #2 준수)
- N/A — Formula Engine/constants(L3) 영역: 이번 변경셋(promo-1st P0~P5)에 packages/formula-engine·\*_/constants_ 접촉 없음(git diff --stat ec7744e..HEAD 실측 — eca0222/95fc644 은 스코프 이전 커밋)
- N/A — Drizzle 런타임 쿼리 여부: public/routes.ts 는 raw prepared statement 만 사용(NC-1 정합) — drizzle-kit/런타임 쿼리 도입 없음
- 확인 — apps/web/src/components/public/PracticeMap.tsx byte 2584 = 0x00 (python 바이너리 검사 + git diff --numstat '- -' 바이너리 판정 재현)
- 확인 — public/routes.ts /grade(378-499) vs /reveal(505-587) SQL·분기 구조 대조: reveal fill_blank MC-in-disguise 경로(562-566)에 recordPublicEvent defect 부재(그레이드 경로 463-470 은 존재) — 드리프트 실증
- 확인 — apps/web/src/components/public/constants.ts:5-6 주석 '서버가 subject 목록 API 를 제공하지 않으므로' ↔ P5 overview API(public/routes.ts:229) 실재 — 전제 무효화 실증
