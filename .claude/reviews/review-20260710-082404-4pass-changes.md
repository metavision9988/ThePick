# 4-Pass 독립 리뷰 보고서 — promo-1st P2 로컬 진도 계층 (local-progress)

- **타임스탬프**: 20260710-082404
- **리뷰 방식**: 독립 에이전트 5개 (scope / Surgeon / Architect / Advocate / Contract) + 발견별 적대적 반증
- **대상 커밋**: 914d47b (promo-1st P2 — apps/web local-progress 신설 + packages/srs type-only import 분리)
- **확정 발견 (반증 통과분만)**: CRITICAL 0 / MAJOR 3 / MINOR 14

## 스코프

**변경 파일 8개**:

- apps/web/package.json
- apps/web/src/lib/\_\_tests\_\_/local-progress.test.ts
- apps/web/src/lib/local-progress/db.ts
- apps/web/src/lib/local-progress/export.ts
- apps/web/src/lib/local-progress/index.ts
- apps/web/src/lib/local-progress/store.ts
- packages/srs/src/fsrs.ts
- pnpm-lock.yaml

**연관 파일 12개**:

- packages/srs/src/index.ts
- packages/srs/src/types.ts
- packages/srs/src/\_\_tests\_\_/fsrs.test.ts
- packages/learning-modes/src/session-progress.ts
- packages/learning-modes/src/index.ts
- packages/learning-modes/src/\_\_tests\_\_/session-progress.test.ts
- apps/web/src/lib/db.ts
- apps/web/vitest.config.ts
- apps/api/src/study/routes.ts
- apps/api/src/db/schema.ts
- docs/plans/promo-1st-free-service-scope-20260708.md
- .jjokjipge/handoff-to-opus-promo-1st-20260708.md

**변경 요약**: promo-1st P2 로컬 진도 계층 신설: `apps/web/src/lib/local-progress/{db,store,export,index}.ts` + 테스트 259줄 (별도 Dexie DB 'thepick-local-progress', 기존 lib/db.ts D1미러 무접촉). FSRS는 @thepick/srs, 스트릭은 @thepick/learning-modes computeStreakUpdate 소비(알고리즘 재구현 0 선언 — 단 KST 일경계 1건 인라인, MAJOR-1 참조), export/import는 v1 버전 봉투 + 검증 실패 시 사유 throw + 전체 교체. 부수로 packages/srs/fsrs.ts의 ts-fsrs Card/Grade를 type-only import로 분리(web verbatimModuleSyntax 호환)하고 apps/web에 @thepick/srs·@thepick/learning-modes·fake-indexeddb 의존성 추가. 소비자(P4 화면)는 아직 미배선.

---

── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 5개 (scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 8개 + 연관 파일 12개 (상단 목록)

Pass 1 (Surgeon): ✅ 17건 확인 / 🔴 0건 / 🟠 0건 / N/A 3건 (MINOR 3건)
확인 (대표, 전체 목록은 §Pass 1 상세):

- apps/web/src/lib/local-progress/store.ts:58-107 — recordReview 단일 'rw' 트랜잭션(4 스토어), 내부 await 전부 Dexie 연산(외부 async 0 = 조기 커밋 함정 없음)
- apps/web/src/lib/local-progress/store.ts:61-62 — cards.get() undefined 시 createFreshCard 폴백, existing?. / ?? 가드 전수 = null 크래시 경로 없음
- apps/web/src/lib/local-progress/export.ts:148-166 — import는 검증(throw) 선행 후 단일 트랜잭션 clear→bulkAdd; 중간 실패 시 트랜잭션 abort = 기존 데이터 원복(테스트 :248-252)
- 실행 증거: pnpm --filter @thepick/web test = 48/48 PASS (local-progress.test.ts 12/12 포함, 리뷰 세션 직접 실행)
  반론: validateExport가 구조(typeof)만 검사 — due='garbage' 등 오염 봉투가 검증을 통과해 지연 크래시/무음 큐 누락 경로 존재 (MINOR-1, Advocate MAJOR-3과 동일 클래스)

Pass 2 (Architect): ✅ 10건 확인 / 🔴 0건 / 🟠 2건 / N/A 4건 (MINOR 5건)
확인 (대표, 전체 목록은 §Pass 2 상세):

- store.ts:13-14, db.ts:18, export.ts:10 — apps/web → packages(srs·learning-modes) 단방향 의존, srs↔learning-modes 순환 0
- lib/db.ts DB명 'thepick'(:184) vs 신규 'thepick-local-progress'(local-progress/db.ts:86) 완전 분리 — 기존 D1→IDB 미러 계약 무접촉
- local-progress/db.ts:33-34 ↔ packages/srs/src/types.ts:20-42 — cards.fsrs = FsrsCardState 직렬화 정본 동일 shape = BE-7 서버 replayReviews 호환
- 실행 증거: packages/srs 35/35 PASS + apps/web tsc --noEmit 클린 (직접 실행)
  반론: @thepick/srs·learning-modes는 main이 원시 TS이고 web에서 workspace 패키지 최초 runtime 소비 — astro build(Vite production) 관통은 소비자 미배선으로 아직 미실행 = P4 배선 시 `astro build` 게이트 필요 (MINOR-8)

Pass 3 (Advocate): ✅ 14건 확인 / 🔴 0건 / 🟠 1건 / N/A 4건 (MINOR 3건)
확인 (대표, 전체 목록은 §Pass 3 상세):

- local-progress 4파일 전수 grep — innerHTML/fetch/XHR/localStorage 0건 = 네트워크/XSS 표면 0, G-1(서버 user 데이터 0) 정합
- store.ts:181-184 유일 catch = console.warn + false 반환(빈 catch 아님) / import 검증 선행 거부 시 DB 무접촉(테스트 :248-252)
- store.ts:173-185 requestPersistentStorage + export/import 안전망 — D-1 A안 '정직 한계+완화' 계약 이행
  반론: import 봉투 검증이 숫자 유한성·날짜 파싱 가능성 미검증 — lastReview='garbage' 오염 카드가 통과 후 scheduleReview에서 RangeError 실증 재현(적대 반증 tsx 직접 구동) = MAJOR-3

Pass 4 (Contract): ✅ 14건 확인 / 🔴 0건 / 🟠 0건 / N/A 4건 (MINOR 3건)
확인 (대표, 전체 목록은 §Pass 4 상세):

- docs/plans/promo-1st-free-service-scope-20260708.md:29 D-1 A안('로컬 쓰기 스토어 신설+@thepick/srs 클라 배선') ↔ store.ts:13-14 문면 일치, fetch/서버 호출 0
- Hard Rule 15/17 — 신규 코드 앱 계층 소재·examId 분기 0·'son-hae-pyeong-ga-sa' 리터럴 0건 (픽스처 '상법'은 Rule 17 예외 해당)
- 커밋 메시지 수치 주장('web 48(+12)·srs 35') = 직접 실행으로 정확 일치 확인 (AI 자기채점 아님)
  반론: 핸드오프 P2 명세의 '세션' 저장 축이 스토어 4종에 없고 결정 기록도 없음 — 저강도 Silent Pivot 여지 (MINOR, P4 착수 시 판정·기록 1줄로 해소 가능)

판정: **완료 가능** (4-Pass CRITICAL 0건. 단 MAJOR 3건은 즉시 수정 또는 다음 단계 초기 태스크로 명시 이월 의무 — §확정 발견 참조)
────────────────────────────────────

---

## 확정 발견 (적대적 반증 통과분)

> 반증 절차: 각 발견에 대해 독립 에이전트가 실코드 대조 + 실행 재현(MAJOR-3은 tsx 직접 구동)으로 격추 시도. 아래 17건은 전부 반증 실패(=발견 유지). 격추된 발견은 본 보고서에 미포함.

### MAJOR (3건)

#### MAJOR-1 [Architect] countReviewsOnKstDate가 KST 일경계 산출을 재구현 — learning-modes 정본 dayBoundsUtc 미소비 (단일 진실원 우회)

- **파일**: apps/web/src/lib/local-progress/store.ts:147-155
- **내용**: 스코프 선언('알고리즘 재구현 0')과 달리 KST YYYY-MM-DD → UTC [start,end) 경계 변환을 ``new Date(`${kstDate}T00:00:00+09:00`)`` + 86_400_000ms 수동 산술로 재구현. 동일 목적의 정본 `dayBoundsUtc(date, offsetHours=9)`가 @thepick/learning-modes에 실재(packages/learning-modes/src/session-progress.ts:74-86, index.ts:82 export)하며, 서버측 동일 기능은 이 정본을 소비(apps/api/src/study/routes.ts:1405). 현재 두 구현은 산술 동치이나, 서버/로컬이 같은 '하루' 정의를 두 곳에서 따로 소유 = Phase2 기술부채 리뷰가 못박은 진앙 #1(단일 진실원 우회) 클래스. store.ts는 이미 learning-modes를 import 중이라 수정 비용 ~3줄.
- **확증**: store.ts:150-153 수동 경계 산출 실재 / session-progress.ts:74-86 정본 실재(동일 [start,end) 계약) / routes.ts:1404-1405 서버 정본 소비 패턴 / store.ts:14 이미 learning-modes import 중
- **반론(Devil's Advocate)**: 두 구현은 수학적으로 동일하고 KST는 DST 없는 고정 오프셋이라 갈라질 물리적 계기가 없다. 그러나 종목 확장에서 offsetHours 정책 파라미터화·경계 특례가 정본에 들어가는 순간 로컬 카운트만 무음으로 구식 하루 정의에 남아 서버 지표와 어긋난다 — 드리프트 리스크(현재 버그 아님).
- **적대 반증 결과**: REFUTED 아님, MAJOR 유지. 4개 확증 전부 실코드 재확인(정본 4곳 소비: routes.ts:1405/1555/1763/1764). 기존 테스트(local-progress.test.ts:160-166)는 로컬 사본 자기 일관성만 가드 — 정본 개정 시 발산 미검출(교차 동치 테스트 부재). store.ts 헤더 "재구현 0" 명시 선언 = 스코프 계약 자체 위반 가중.
- **수정 제안**: `const { startUtc, endUtc } = dayBoundsUtc(kstDate); return db.reviews.where('reviewedAt').between(startUtc, endUtc, true, false).count();` 로 교체(import 1건 추가). 기존 테스트 4건이 동치성 회귀 가드.

#### MAJOR-2 [Architect] srs·learning-modes 패키지 계약 주석 stale — 'apps/web은 type만 import(계산은 server 전용)'이 본 변경으로 거짓이 됨

- **파일**: packages/srs/src/index.ts:10 (+ packages/learning-modes/src/index.ts:10, session-progress.ts:8)
- **내용**: 세 곳의 패키지 수준 소비 계약 주석('apps/web 클라이언트는 type만 import — FSRS 계산/채점은 server 전용')이 이번 store.ts:13-14의 runtime import(createFreshCard/scheduleReview/computeStreakUpdate/todayDateString)로 전부 거짓이 됨. 배선 자체는 promo plan(:18,29 F-4/D-1 A안)+handoff G-1 명시 결재로 정당하나 헤더 미갱신. 본 프로젝트 실수 로그(2026-05-15 G-AUDIT)가 'stale 계약 문서 = 하위 작업 오염 진앙'으로 못박은 클래스 — 차기 리뷰어가 web runtime import를 위반으로 오판하거나, 역으로 '채점도 클라 이동 가능'으로 과잉 일반화 위험. 특히 learning-modes '채점은 server (보안)'은 살아있는 정답 보안 계약이라 FSRS 스케줄(비밀 아님) vs 채점(비밀) 경계 재명시 필요.
- **확증**: 3곳 문구 원문 실재(grep) / store.ts:13-14 runtime import 실재 / plan :18,29 결재 근거 실재(변경 정당)
- **반론(Devil's Advocate)**: 주석은 기계 강제 계약이 아니고 진실은 plan에 있다. 그러나 이 코드베이스의 리뷰 체계는 패키지 헤더를 1차 계약으로 대조하는 관행(본 리뷰 포함)이라 stale 헤더는 리뷰마다 위양성/위음성을 재생산 — G-AUDIT 사고(CRIT-2/3)가 정확히 이 기전.
- **적대 반증 결과**: REFUTED 아님, MAJOR 유지. 3곳 stale 원문 + store.ts:13-14 값 import(type-only 아님) 확증. apps/web에 grade\* runtime import 0건 grep 확증 = 헤더의 '채점=server' 절반은 여전히 참 → 거짓 절반('type만 import')이 실질 위험. 주석 전용 결함이나 G-AUDIT 선례 + 보안 불변식 동봉으로 MAJOR 유지.
- **수정 제안**: 3곳 주석 개정 — 'promo-1st(2026-07-08 G-1 결재) 이후 apps/web local-progress가 FSRS 스케줄·스트릭 계산을 클라 runtime 소비. 단 **채점(grade\*)·정답 데이터는 여전히 server 전용(보안)**' amendment 각주.

#### MAJOR-3 [Advocate] import 봉투 검증이 숫자 유한성·날짜 파싱 가능성을 검증하지 않음 — 오염 파일이 검증 통과·영속 후 recordReview에서 미포착 RangeError 크래시 경로

- **파일**: apps/web/src/lib/local-progress/export.ts:55-107
- **내용**: isFsrsCardState(:55-68)가 due/lastReview를 `typeof === 'string'`, stability/difficulty/reps 등을 `typeof === 'number'`로만 검사. (a) 파싱 불가 날짜 문자열, (b) Infinity(JSON `1e999`로 도달 가능), (c) 음수 카운터, (d) isLocalStreak(:97-107)의 dailyGoal=0 등이 전부 통과·영속 — setDailyGoal(store.ts:126-128)의 1~500 가드를 import가 우회하는 이중 잣대. 모듈 자기 계약(export.ts:7 '검증 실패 = 자세한 사유와 함께 throw — 무음 부분 적재 금지')과 모순. import는 정확히 '데이터를 잃은 사용자의 복구 순간'에 실행되는 안전망.
- **확증**: export.ts:59 typeof-only / :60-63 Number.isFinite 부재 / :105 dailyGoal typeof-only ↔ store.ts:126-128 이중 잣대 / packages/srs/src/fsrs.ts:75-88+:46-48 무검증 new Date()→toISOString / 테스트 :208-246 타입 오염만 커버
- **반론(Devil's Advocate)**: 봉투는 본인 export 산출물이 정상 경로이고 오염 주체는 사용자 자신뿐 — 로컬 전용 표면. 반론의 반론: 검증 함수의 존재 이유가 '손상 파일 거부'인데 손상의 흔한 형태(절단·값 오염)를 통과시키면 목적 자체가 반쪽이며, 크래시가 import 시점이 아닌 수일 뒤 학습 중에 터져 추적 불가.
- **적대 반증 결과**: REFUTED 아님, MAJOR 유지 (서사 세부 2건 정정). 실제 fsrs.ts(ts-fsrs 5.3)를 tsx로 직접 구동해 오염 상태 7종 주입 실측:
  - **확증**: `lastReview='garbage'`(JSON 도달 가능 평문)가 검증 통과 → recordReview → scheduleReview에서 **RangeError: Invalid time value 실제 throw**. stability=NaN·difficulty=NaN 동일. dailyGoal=0/-3/3.7, totalReviews=-5 통과 실증. "지연 미포착 크래시" = 사실.
  - **정정 (a)**: 헤드라인 체인 "due='not-a-date' → new Date → RangeError"는 실측 NO THROW(ts-fsrs 5.x good 경로가 due를 now 기준 재산출). 대신 **무음 데이터 오염**: 오염 due는 getDueCards(store.ts:143) 문자열 비교에서 영구 제외 = 카드가 복습 큐에 영원히 안 뜸(크래시보다 추적 어려운 실패). 크래시 체인 자체는 lastReview 오염으로 실재.
  - **정정 (b)**: NaN은 JSON.parse로 도달 불가(파스 에러) — 단 Infinity는 `1e999`로 도달 가능하며 실측 시 due가 2126년(36500일)으로 오염(no throw, 스케줄 파괴).
  - **감쇄**: 로컬 전용 + P4 미배선 = 현재 실사용자 영향 0 → CRITICAL 아님. 그러나 복구 안전망에서 (i) 지연 RangeError (ii) 무음 due-큐 누락 두 갈래 실증 + 선언 계약 정면 모순 = MAJOR.
- **수정 제안**: isFsrsCardState에 `Number.isFinite(s.stability) && s.stability >= 0` 류 유한성·부호 검사 + `Number.isFinite(Date.parse(s.due))` 날짜 파싱 검사. dailyGoal은 setDailyGoal과 동일 1~500 정수 가드 공유(단일 검증 함수 추출). totalReviews/correctCount/currentStreak = 음이 아닌 정수. ※ due 필드의 실제 위험은 크래시가 아니라 due-큐 무음 누락임을 반영.

### MINOR (14건)

#### MINOR-1 [Surgeon] validateExport 의미 검증 부재 — 손상 봉투가 검증 통과 후 지연 크래시/불투명 에러 경로

- **파일**: apps/web/src/lib/local-progress/export.ts:55-107, 113-142
- 검증이 구조(typeof)만 수행. ① fsrs.due/reviewedAt/updatedAt/lastReview 임의 문자열 통과(:59,65-66,81,93) — due='garbage' 카드는 getDueCards(store.ts:143) 사전식 비교('g'>'2')로 복습 큐 무음 영구 누락, 이후 recordReview 시 toFsrsCard(fsrs.ts:77) new Date(무효)→toIsoString(fsrs.ts:46-48) RangeError 지연 크래시. ② cardId 중복 통과 → bulkAdd(:156) BulkError — 트랜잭션 abort로 데이터 원복되나 계약(:7 '사유와 함께 throw')과 달리 불투명 에러. ③ 카운터 음수 통과. ④ exportedAt 누락 시 거부 대신 '' 무음 대체(:137). 단 JSON.parse 산출물은 NaN 생성 불가라 숫자 오염 경로 제한적.
- **확증**: export.ts:59 / fsrs.ts:46-48,77 / store.ts:143 / 테스트 :208-246 형식 오염·중복 케이스 부재
- **반론**: 봉투는 기계 생성(toISOString 보장)이라 정상 경로 무효값 불가, 발동 = 손편집/외부 변조뿐. 피해 = 본인 로컬 한정 + 재import 복구 가능, 중복 cardId는 abort가 데이터 보존 → MINOR 타당.
- **수정 제안**: ISO 8601 판별 + 카운터 Number.isFinite && >= 0 + Set 기반 cardId 유일성 — 각 실패 사유 포함 throw. (MAJOR-3와 통합 수리 권장)

#### MINOR-2 [Surgeon] countReviewsOnKstDate가 dayBoundsUtc를 재구현 + 무효 입력 시 불투명 RangeError

- **파일**: apps/web/src/lib/local-progress/store.ts:147-155
- 정본 dayBoundsUtc(session-progress.ts:74-86)와 수학적 동치 재구현(직접 검산). 모듈 헤더 '재구현 0'(store.ts:4) 주장과 미세 불일치. 정본은 무효 날짜에 사유 throw(:76-78), 재구현은 사유 없는 RangeError. countReviewsOnKstDate는 index.ts:21 공개 export = P4 직접 소비 예정이라 오입력 시 디버깅 품질 저하.
- **반론**: 유일 내부 호출자 recordReview(store.ts:105)는 todayDateString 산출물만 전달 = 무효 입력 경로 현재 실존하지 않음, 출력 전 케이스 동치 — 순수 위생 이슈일 수 있음.
- **수정 제안**: dayBoundsUtc import 치환 — 중복 제거 + 사유 있는 검증 무상 획득. (MAJOR-1과 동일 수리)

#### MINOR-3 [Surgeon] recordReview 스트릭 write 조건의 dead 분기 (`|| prevStreak.lastStudyDate === null`)

- **파일**: apps/web/src/lib/local-progress/store.ts:101
- computeStreakUpdate(session-progress.ts:147-166)는 lastStudyDate !== today 모든 경우(null 포함, :156-159)에 changed=true — `changed===false && lastStudyDate===null` 조합 도달 불가 = OR 우변 dead code. 무해하나 'changed=false인데 write 경로 존재' 오독 유발, 계약(:133) 신뢰 저하.
- **반론**: computeStreakUpdate의 changed 의미가 향후 바뀌면 실제 방어로 작동 가능 — 제거보다 의도 주석 명시가 더 안전할 수 있음.
- **수정 제안**: `if (update.changed)` 단순화 또는 '도달 불가 방어(엔진 계약 변경 대비)' 주석 명시.

#### MINOR-4 [Architect] import 경로가 store 계층 불변식을 우회 — 오염 봉투로 dailyGoal 0/NaN·음수 streak 주입 가능

- **파일**: apps/web/src/lib/local-progress/export.ts:97-107
- setDailyGoal은 1~500 정수 검증 강제(store.ts:126-128), isLocalStreak는 typeof number만 — NaN·0·음수·소수 통과. currentStreak/longestStreak/totalReviews/correctCount 동일 클래스. 수제 봉투 import 시 FE-7 위젯 목표 진척률 Infinity/NaN 경로. 검증 깊이가 store 불변식과 비대칭.
- **반론**: 정상 경로는 항상 유효값·수동 편집은 자기 책임. 그러나 마이그레이션 버그·부분 손상 파일이 typeof 통과+범위만 깨는 형태로 인입 가능 — P4 배선 전 가드가 싸다.
- **수정 제안**: Number.isFinite + 음수 차단, dailyGoal은 setDailyGoal 가드 함수 공유. (MAJOR-3와 통합)

#### MINOR-5 [Architect] importLocalProgress가 meta.createdAt을 import 시각으로 덮어써 최초 사용 시각 소실

- **파일**: apps/web/src/lib/local-progress/export.ts:160-164
- 봉투에 meta 미포함(:24-31) + import 시 meta.put이 createdAt=now 재기록 — '기기 이동/증발 복구' 용도상 원 프로파일 최초 사용 시각이 매 import마다 리셋. db.ts:63-69 'LocalMeta.createdAt = 최초 사용 시각' 주석 계약과 어긋남. BE-7 계정 이전 시 이용 기간 근거 필드.
- **반증**: createdAt 소비자 현재 0 + v1 봉투를 지금 확장하면 버전 미증가 필드 추가가 더 위험 — 그 경우 최소 db.ts:68 주석을 'import 시 리셋됨'으로 정직화.
- **수정 제안**: 기존 meta 있으면 createdAt 보존(get 후 병합) 또는 주석 정직화 택1.

#### MINOR-6 [Architect] 사용자 노출 예정 오류 문자열 영어 하드코딩 (i18n)

- **파일**: apps/web/src/lib/local-progress/export.ts:113-133 (+store.ts:127)
- throw 사유('import failed: schema mismatch' 등 6곳)는 설계상 UI가 사용자에게 표시(:7, :145-146). 한국 사용자 100% 서비스에서 영어 원문 노출. Pass 2 체크리스트 i18n 항목 해당.
- **반론**: P4 UI가 오류 코드→한국어 매핑 계층을 둘 수도 — 단 그 매핑 계약이 어디에도 미명시라 message 직표시로 갈 확률 높음.
- **수정 제안**: P4 배선 시 오류 코드 enum('SCHEMA_MISMATCH') + UI측 한국어 매핑 계약화 또는 메시지 한국어화.

#### MINOR-7 [Architect] handoff P2 명세의 '세션' 스토어 부재 — 문서화되지 않은 축소

- **파일**: apps/web/src/lib/local-progress/db.ts:8-12
- handoff P2(:47)는 '카드별 FSRS 상태+스트릭+**세션**' 명세, 구현 스토어는 cards/reviews/streak/meta 4종 — 세션 축(computePhaseFromProgress 소비 대상) 없음. 합리적 선택일 수 있으나 결정 미기록(Silent Pivot 여지). 봉투 v1에 세션 없어 추가 시 스키마 버전 증가 필요.
- **반론**: 세션은 본질 휘발성(탭 닫으면 종료)이라 영속이 오히려 과설계 + reviews append-only가 재구성 원천 — 그렇다면 판단 1줄 기록으로 해소.
- **수정 제안**: db.ts 헤더에 '세션 = P4 in-memory (영속 제외 사유)' 1줄 또는 P4 세션 스토어 추가 시 v2 계획 명시. (Contract MINOR-12와 동일 발견 — 교차 확증)

#### MINOR-8 [Architect] Astro 클라이언트 번들에서 workspace TS 소스 패키지 최초 runtime 소비 — astro build 관통 미검증 (P4 게이트)

- **파일**: apps/web/package.json:21-23
- @thepick/srs·learning-modes는 main이 원시 TS이고 web에서 workspace 패키지 runtime 소비 최초 사례(grep: local-progress 외 소비자 0). vitest(esbuild)+tsc는 green 실측했으나 astro build(Vite production) 관통은 소비자 미배선으로 미실행. 부수: workspace:^ 신규 2건 vs 기존 workspace:\*(shared) 지정자 혼용.
- **반론**: Vite의 symlink workspace TS 처리는 표준 동작 + ts-fsrs 브라우저 번들은 plan F-4가 기확증 — 기우 유력. 그래도 '빌드 성공≠동작 확인' 원칙상 P4 첫 배선 커밋에 astro build 1회 = 0원 보험.
- **수정 제안**: P4 배선 Binary Gate에 `pnpm --filter @thepick/web build` 포함 + workspace 지정자 \* 통일.

#### MINOR-9 [Advocate] countReviewsOnKstDate 재구현 — 원본의 입력 검증(명확한 throw)까지 탈락

- **파일**: apps/web/src/lib/local-progress/store.ts:147-155
- dayBoundsUtc는 무효 date에 `invalid date: ... (expected YYYY-MM-DD)` 사유 throw(:76-78), 재구현은 사유 없는 RangeError. 공개 API export(index.ts:21)라 외부 호출자 임의 문자열 인입 가능. '재구현 0' 주장과 미세 불일치. (MAJOR-1·MINOR-2와 동일 지점 — Advocate 렌즈 독립 재발견 = 교차 확증)
- **반론**: 현 호출자는 todayDateString 산출값만 전달 = 비정상 입력 실전 도달 불가, 동작 차이 0 — 순수 재사용·방어깊이 문제.
- **수정 제안**: dayBoundsUtc import 교체.

#### MINOR-10 [Advocate] srs·learning-modes 헤더 stale 계약 주석 — 갱신 누락

- **파일**: packages/srs/src/index.ts:10 (+session-progress.ts:8)
- MAJOR-2와 동일 발견의 Advocate 렌즈 독립 재발견(교차 확증). D-1 A안 이행으로 코드는 결재 방향과 정합 — 주석만 stale. 미래 리뷰어 오판 또는 서버 전용 가정 하 Node 의존 추가 회귀 진앙 가능.
- **반론**: 주석은 규범 아닌 사용처 나열 + D-1 결재 문서가 정본이라 실질 혼선 확률 낮음. srs 자체가 Workers 호환(Node 의존 0) 설계라 브라우저 실행 기술 모순도 없음. 다만 '루트/계약 문서 stale = 오염원' 실수 로그(2026-05-15) 명문화 프로젝트라 저비용 폐색 가치.
- **수정 제안**: 사용처 서술을 'apps/api(서버) + apps/web local-progress(무인증 로컬, D-1)'로 갱신. (MAJOR-2와 통합 수리)

#### MINOR-11 [Advocate] import 실패 사유가 영문·저해상도('invalid cards' — 레코드 위치 불명) + 중복 cardId는 Dexie BulkError 원시 노출

- **파일**: apps/web/src/lib/local-progress/export.ts:125-133
- `cards.every(isLocalCard)` 실패 시 'import failed: invalid cards' 한 줄 — 수천 건 중 어느 레코드인지 진단 불가. cardId 중복은 검증 통과 후 bulkAdd(:156) BulkError = '사유 포함 throw' 계약 밖 원시 예외(트랜잭션 롤백은 되어 부분 적재 없음 — 원자성 PASS). i18n 매핑 계약 미기록.
- **반론**: 정상 경로에서 미발생 + 발생해도 전체 거부+데이터 보존 동일. 사유 해상도 = 지원 비용 문제이지 데이터 안전 문제 아님, P4 시점 처리 가능.
- **수정 제안**: findIndex로 첫 실패 인덱스 사유 포함(`invalid cards[17]`) + cardId Set 유일성 검사 + 에러 코드→i18n 키 매핑 계약을 index.ts JSDoc에 명시.

#### MINOR-12 [Contract] 핸드오프 P2 '세션' 축 미구현 — 결정 기록 없는 스코프 축소 (저강도 Silent Pivot)

- **파일**: apps/web/src/lib/local-progress/db.ts:8-12
- handoff :47 명세 대비 세션 저장 축 부재(MINOR-7과 동일 발견의 Contract 렌즈 재발견 — 교차 확증). reviews는 append-only 이력이지 세션 경계(FE-8 결과 요약) 개념 아님. 커밋 914d47b '결정 기록(위임)' 란은 별도 DB·전체 교체 2건만 기록 — 위임 체제(§1) '갈림길 = 결정+사유 기록' 규약 대비 기록 공백.
- **반론**: '세션'이 reviews 이력으로 충족되는 넓은 의미였다면 축소가 아예 아니며, v2 마이그레이션 경로(export.ts:122 분기 주석) 기예약으로 비용 낮음.
- **수정 제안**: P4(FE-8) 착수 시 세션 축 필요 판정 + 결정 기록 1줄('세션=ephemeral, reviews로 대체' 명문화 또는 v2 스토어 추가).

#### MINOR-13 [Contract] KST 일일 경계 인라인 재구현 — '재구현 0' 주장과 긴장

- **파일**: apps/web/src/lib/local-progress/store.ts:147-155
- MAJOR-1과 동일 지점의 Contract 렌즈 재발견(교차 확증 — Surgeon/Architect/Advocate/Contract 4렌즈 전부 독립 적발). 서버는 ADR-041 KST 주석 동반 정본 소비(routes.ts:1401-1405). 스트릭 날짜는 todayDateString 정본 재사용하면서 경계만 인라인 = 일관성 결여.
- **반론**: KST=UTC+9 고정 offset(ADR-041)이라 발산 시나리오 사실상 없음 + 인라인이 의존 표면 축소 — 다만 반쪽 재사용은 일관성 결여.
- **수정 제안**: dayBoundsUtc(kstDate) 호출 교체(동작 동일). (MAJOR-1 수리로 일괄 해소)

#### MINOR-14 [Contract] 로컬 스토어·export 봉투에 시험(exam) 경계 축 부재 — Hard Rule 16 정신·Year 2 cross-exam import 오염 표면

- **파일**: apps/web/src/lib/local-progress/export.ts:22 (+db.ts:27-39)
- Hard Rule 16은 진도 데이터 조회에 시험 경계 강제 요구. 로컬 스토어는 D1 테이블이 아니라 문면 적용 밖이나 user_progress의 로컬 대응물임에도 examId 축이 스키마·봉투 식별자(EXPORT_SCHEMA_ID) 어디에도 없음. Year 2 멀티트랙에서 런타임 DB는 origin 격리로 자연 분리되나 export 파일은 origin 무관 — 손해평가사 봉투를 전기기사 서브도메인에 import하면 validateExport 통과 = 타 시험 cardId로 진도 오염.
- **반론**: v1은 단일 시험·단일 origin이라 실피해 0 + 봉투 version 필드로 v2 additive 추가+마이그레이션 분기(:122 예약) 가능 — Rule 16 문면상 '위반' 아니며 Year 2 원장 등재로 충분(유력).
- **수정 제안**: BE-7 본편(계정 이전) 설계 시 봉투 v2에 examId 추가 + import 시 현재 서비스 시험 대조 거부를 carry-over 원장에 1줄 등재.

---

## Pass별 확인 항목 전수 (증거 기반 보고 — 규칙 2)

### Pass 1 (Surgeon) — ✅ 17 / N/A 3

1. PASS: store.ts:58-107 — recordReview 단일 'rw' 트랜잭션(4 스토어 배열 인자), 내부 await 전부 Dexie 연산(외부 async 0 = Dexie 트랜잭션 조기 커밋 함정 없음), 반환 = 트랜잭션 promise 그대로
2. PASS: store.ts:61-62 — cards.get() undefined(카드 미존재) 시 createFreshCard 폴백 = null/undefined 크래시 경로 없음; existing?.subject/totalReviews 전부 ?? 가드
3. PASS: store.ts:137-144 — getDueCards: where('fsrs.due') 인덱스 순회 due 오름차순이므로 limit(20) 후 sortBy = '가장 임박한 20건' 의미 정확; due/nowIso 양쪽 toISOString 동일 포맷 = 사전식 비교가 시간순과 동치
4. PASS: store.ts:150-154 + \_\_tests\_\_/local-progress.test.ts:153-171 — KST 경계 [start,end) between(true,false), 자정 직전/직후 분리 집계 테스트 실재; +09:00 명시 오프셋 = 실행환경 타임존 무의존
5. PASS: store.ts:126-128 — setDailyGoal Number.isInteger + 1~500 범위 검증 throw (NaN/음수/소수 차단, 테스트 :148-149 커버)
6. PASS: store.ts:173-185 — requestPersistentStorage: catch는 console.warn + false 반환(빈 catch 아님), navigator/storage/persist 3단 부재 가드, jsdom 폴백 테스트 :255-259
7. PASS: export.ts:148-166 — import는 검증(throw) 선행 후 단일 트랜잭션 내 clear→bulkAdd; 중간 실패(BulkError 등) 미포획 시 트랜잭션 abort = 기존 데이터 원복(무음 부분 적재 없음), 검증 거부 시 DB 무접촉 테스트 :248-252
8. PASS: export.ts:158 — import 시 review.id(auto-increment) 원본 폐기·재발급 = 봉투 간 PK 충돌 차단
9. PASS: db.ts:88-95 — Dexie 스키마: cards PK cardId + 중첩 인덱스 fsrs.due(dotted keypath 정식 지원), reviews '++id' ↔ LocalReview.id?: number(:43) 정합, streak/meta 고정 key 단일행
10. PASS: store.ts:14 + packages/learning-modes/src/shuffle.ts:26 — 이중 todayDateString 의심 추적: index.ts:32는 shuffle.js 경유 export이나 shuffle.ts:26이 session-progress.ts:38 KST 구현을 re-export = 단일 구현 확증 (UTC/KST 분열 없음)
11. PASS: packages/srs/src/fsrs.ts:13-15 — Card/Grade type-only import 분리: 런타임 심볼(FSRS/Rating/State/createEmptyCard/generatorParameters)과 타입 사용처(:25,:56,:75) 대조 = 분류 정확, 동작 diff 0 (git show 914d47b 2줄 변경 확인)
12. PASS: packages/srs/src/\_\_tests\_\_/fsrs.test.ts:57-63,70,162-180 — 결정성·intervalDays>=0·JSON round-trip 기존 커버 유지 (음수 FSRS interval 경계 체크)
13. PASS: 신규 4파일(db/store/export/index) + 테스트 전수 — TODO/HACK/stub/placeholder 0, any 0, 빈 catch 0, 동적 코드 실행 0, console.log 0 (console.warn 1건 = production-quality.md 허용 패턴)
14. PASS: apps/web/src/lib/db.ts:184-206 — 기존 미러 DB 'thepick' 무접촉 확인 (신규 DB명 'thepick-local-progress' db.ts:86, 스토어·버전 체계 완전 분리)
15. PASS: apps/web/package.json:21,23,44 — @thepick/srs·@thepick/learning-modes workspace 의존 + fake-indexeddb devDependencies(테스트 전용) 배치 정확; pnpm-lock.yaml 정합은 테스트 실행 성공으로 간접 확증
16. PASS: 실행 증거 — pnpm --filter @thepick/web test = 48/48 PASS (local-progress.test.ts 12/12 포함, 본 리뷰 세션 직접 실행)
17. PASS: docs/plans/promo-1st-free-service-scope-20260708.md D-1(A안 로컬 전용)·BE-7(export 구조 선확보) 앵커 대조 — 구현 방향(persist 요청 + export/import) 일치 (기획 대조 본심은 Pass 4 소관, Surgeon은 참조 확인만)
18. N/A: D1 .first() null 크래시 경로 — 본 변경은 D1 무접촉: git show 914d47b --stat에 apps/api/src/study/routes.ts·db/schema.ts diff 0줄(관련 파일로만 열람), local-progress는 IndexedDB 전용
19. N/A: Vectorize/Claude API/pdfplumber await 누락 — 본 스코프에 해당 호출 0건 (전 파일 열람 확인)
20. N/A: Formula Engine math.js AST·유사도<0.60 Graceful Degradation·numeric_value vs value 혼용 — 산식/검색 코드 무접촉 (FSRS 계산은 ts-fsrs 라이브러리 위임, 동적 실행 0)

### Pass 2 (Architect) — ✅ 10 / N/A 4

1. PASS — Import 방향: apps/web → packages(srs·learning-modes) 앱→패키지 단방향 (store.ts:13-14, db.ts:18, export.ts:10); packages/srs → ts-fsrs만 의존(fsrs.ts:14-15, package.json), srs→learning-modes 역의존 0 (srs/types.ts:13-14 이관 기록 정합); learning-modes/session-progress.ts:18은 ./types.js만 import — 순환 0
2. PASS — 기존 D1→IDB 미러 무접촉: lib/db.ts DB명 'thepick'(:184) vs 신규 'thepick-local-progress'(local-progress/db.ts:86) 분리, lib/db.ts 파일 자체 변경 0 (9 스토어 스키마 그대로) — 미러 계약 오염 0
3. PASS — Workers 제약: packages/srs/fsrs.ts 변경은 type-only import 분리뿐(:14-15) = apps/api Workers 런타임 영향 0 (srs 테스트 35/35 실측); local-progress는 브라우저 전용 계층으로 Workers 미배포 — navigator 가드 store.ts:175-177 확인
4. PASS — FsrsCardState 직렬화 정합: local cards.fsrs = @thepick/srs FsrsCardState 그대로(local-progress/db.ts:33-34) = D1 user_progress.fsrs_state 직렬화 정본(srs/types.ts:20-42)과 동일 shape → BE-7 계정 이전 시 서버 replayReviews 호환
5. PASS — 스트릭 알고리즘 단일 진실원: computeStreakUpdate·todayDateString 정본 소비(store.ts:14, 86-93) — 서버 routes.ts:1420과 동일 함수·동일 KST 날짜 축(ADR-041). learning-modes index.ts:32 todayDateString은 shuffle.js 경유 re-export(shuffle.ts:26)로 session-progress 정본과 단일 구현 확인
6. PASS — Dexie 인덱스↔쿼리 정합: cards 'fsrs.due' dotted 인덱스(db.ts:90) ↔ getDueCards where('fsrs.due')(store.ts:143); reviews 'reviewedAt' 인덱스(db.ts:92) ↔ between 카운트(store.ts:154)·orderBy export(export.ts:40); due는 toISOString 고정폭 UTC라 사전순=시간순 성립(fsrs.ts:46-48)
7. PASS — 트랜잭션 경계: recordReview rw 트랜잭션에 접촉 4스토어 전부 포함(store.ts:58) + 내부 await 전부 Dexie 연산(비-Dexie promise 0 = zone 이탈 없음); importLocalProgress 검증 선행 후 단일 트랜잭션 전체 교체(export.ts:153-165) — 실패 시 원상 보존 테스트 실측(:248-252)
8. PASS — stub/TODO/빈catch/any: local-progress 4파일 + srs/fsrs.ts grep 0건 (유일 catch는 store.ts:181-184 warn+false 폴백 = 무음 아님)
9. PASS — 테스트/타입 관통 실측: apps/web local-progress.test.ts 12/12 PASS, packages/srs 35/35 PASS, apps/web tsc --noEmit 클린 (본 리뷰 중 직접 실행); pnpm-lock.yaml apps/web 섹션에 srs·learning-modes link + fake-indexeddb@6.2.5 정합 확인
10. PASS — plan 계약 정합(연계 측면): D-1 A안(로컬 전용·서버 user 데이터 0·persist 요청·export/import 선확보) = 구현 일치(plan:29 ↔ store.ts:173-185, export.ts 전체); G-1 위임 결정(handoff:19)과 정합 — D1 쓰기 경로 0 확인
11. N/A — Ontology Lock: 신규 지식 노드/엣지 ID 생성 0 (cardId는 exam_questions.id 참조 사용자 데이터, db.ts:28) — ontology-registry 비대상
12. N/A — truth_weight 정렬: RAG/검색/LLM 주입 경로 무접촉 — 본 변경셋에 해당 표면 없음
13. N/A — Temporal Graph(INSERT+SUPERSEDES): knowledge_nodes/formulas 무접촉. 로컬 사용자 데이터는 Hard Limit 비대상 — reviews는 append-only(db.ts:10) 채택으로 오히려 정합
14. N/A — Hexagonal(modules/ domain→infrastructure): apps/web lib 계층 코드 — modules/ 구조 비대상; ARCHITECTURE.md 오프라인 동기화 절은 미러 DB 대상이라 신규 로컬 DB는 별개 축(MAJOR-2 주석 stale과 함께 후속 문서 반영 권고 수준)

### Pass 3 (Advocate) — ✅ 14 / N/A 4

1. PASS 보안-XSS/네트워크 표면: local-progress 4파일 전수 grep — innerHTML/fetch/XMLHttpRequest/localStorage 0건. 순수 IndexedDB 계층, G-1(서버 user 데이터 0) 정합
2. PASS 보안-API 키/크리덴셜 하드코딩: db.ts:86(DB명)·export.ts:22(스키마 식별자)만 존재 — 비밀값 0건, 4파일+테스트 전수 열람
3. PASS 보안-입력 검증(구조 층): export.ts:113-142 봉투 검증 실패 시 사유 throw + store.ts:126-128 setDailyGoal 1~500 가드 + 테스트 :208-246 거부 케이스 5종 (심층 값 검증 갭 = MAJOR-3 참조)
4. PASS 무음 실패 금지: 빈 catch 0건 — store.ts:181-184 유일 catch가 console.warn + false 반환(폴백 명시), export.ts import는 검증 선행 거부로 DB 무접촉(테스트 :248-252 기존 데이터 보존 확증)
5. PASS 프라이버시-DB 격리: 미러 DB 'thepick'(lib/db.ts:184) vs 신설 'thepick-local-progress'(local-progress/db.ts:86) 분리 + lib/db.ts에 local-progress import 0건(grep) — 미러 계약 무오염
6. PASS 데이터 증발 완화 UX: store.ts:173-185 requestPersistentStorage(미지원/거부 시 false 반환 = 호출측 UI 안내 경로) + export/import 안전망 — D-1 A안 '정직 한계+완화' 계약 이행
7. PASS 트랜잭션 원자성: recordReview store.ts:58 단일 rw 트랜잭션(카드+이력+스트릭) / import export.ts:154-165 clear→bulkAdd 단일 트랜잭션 — 부분 적재 상태 불가
8. PASS 정오 카운트 정확성: store.ts:71 `input.isCorrect === true`만 correctCount 증가(undefined/false/null 미증가), 테스트 :82-83 오답 미증가 확증
9. PASS KST 날짜 축 정합: store.ts:56 todayDateString(ADR-041 KST) 소비 + :148-154 UTC+9 고정 경계, 테스트 :153-170 자정 직전/직후 분리 집계 확증 — 서버 streak_records와 동일 날짜 축
10. PASS 스트릭 알고리즘 재사용: store.ts:86-93 computeStreakUpdate 소비(재구현 0), packages/learning-modes/src/index.ts:32,81 export 실재 확인 — 동일일 idempotent/연속+1/gap reset 테스트 :86-113
11. PASS stub/TODO/placeholder: 변경 8파일 전수 열람 — TODO/HACK/빈 함수 0건, 모든 함수 실 로직 보유
12. PASS FSRS due 인덱스 질의 정합: db.ts:90 'fsrs.due' 인덱스 + store.ts:143 belowOrEqual(nowIso) — 모든 due가 toISOString() 산출(고정 'Z' UTC)이라 문자열 비교 = 시간 비교 성립, 테스트 :123-135
13. PASS 연관 서버 파일 무접촉: git show --stat HEAD = 8파일 — apps/api/src/study/routes.ts·db/schema.ts 무변경(커밋 메시지 'api 765 회귀 0' 정합), 로컬 계층이 서버 스키마와 결합 없음
14. PASS srs type-only import 분리: packages/srs/src/fsrs.ts:14-15 Card/Grade type import 분리 — 런타임 값 import(FSRS/Rating/State 등)와 구분, verbatimModuleSyntax 소비 호환 목적 정합
15. N/A 접근성(터치 44px+/키보드/aria-label): 본 변경에 UI 컴포넌트 0 — local-progress는 순수 데이터 계층, P4 화면 미배선(index.ts:4 소비자 명시)
16. N/A Service Worker 캐싱 전략: 변경셋에 sw.js/캐시 정책 무접촉(git show --stat 8파일) — 로컬 IDB 계층은 SW 캐싱 경로와 독립
17. N/A 정답 안전(OX/빈칸/변형 정답 100%): 정답 콘텐츠 무접촉 — isCorrect는 호출측 채점 결과의 수신·저장만(store.ts:32,80), 채점 로직 자체는 BE-2 서버 소유(plan :46)
18. N/A 에러 UX '교재 O장 참고' Graceful 안내: 콘텐츠 참조 표면 없음 — 본 계층 에러는 import 검증/설정 검증뿐(사유 해상도는 MINOR-11 참조)

### Pass 4 (Contract) — ✅ 14 / N/A 4

1. PASS — 설계서·스코프 대조: D-1 A안(로컬 전용·서버 user 데이터 0) 구현 정합 — local-progress 3파일 전수에 fetch/서버 호출 0, promo-1st-free-service-scope-20260708.md:29(§2 D-1 A안 '로컬 쓰기 스토어 신설+@thepick/srs 클라 배선') ↔ store.ts:13-14 import 대조
2. PASS — 스코프 §2 D-1 완화 장치 2종 이행: navigator.storage.persist() 요청(store.ts:173-185, persisted 선확인+미지원 false) + export/import BE-7 선확보(export.ts:34-51, 148-167) — 스코프 :29 '완화 = persist() 요청 + 진도 내보내기/가져오기' 문면 일치
3. PASS — 지뢰 #7(기존 lib/db.ts read-only 미러 무접촉): 커밋 914d47b stat 8파일에 lib/db.ts 부재 + DB명 분리 확증(lib/db.ts:184 super('thepick') vs local-progress/db.ts:86)
4. PASS — 알고리즘 재구현 0(FSRS·스트릭): FSRS 전이 = @thepick/srs createFreshCard/scheduleReview 소비(store.ts:62-63), 스트릭 = computeStreakUpdate+todayDateString 소비(store.ts:56,86-93) — 서버 study 경로와 동일 정본(apps/api/src/study/routes.ts:37,49) = ADR-041 KST 정합(docs/adr/ADR-041-streak-records-timezone-policy.md 실재 확인). 단 KST 일일 경계만 인라인(MAJOR-1/MINOR-13)
5. PASS — 핸드오프 §1 불변② (검증 실패 무음 금지): validateExport 실패 전건 사유 포함 throw(export.ts:114-133), import는 검증 선행이라 실패 시 DB 무접촉(테스트 :248-252 확증)
6. PASS — 빈 catch·TODO·stub·any·console.log 전수 스캔: local-progress 3파일+index.ts 전문 열람 — 빈 catch 0(store.ts:181-184는 warn 로깅+false 폴백), TODO/HACK 0, any 0(타입가드는 Record<string,unknown> 캐스트), console.log 0(warn만), 빈 함수 stub 0 — 모든 함수 body 실로직
7. PASS — packages/srs/src/fsrs.ts 변경 = type-only import 분리 단독(git show 914d47b 대조: import { Card, Grade } → import type 이동 + 주석 1줄, 런타임 무변경) — srs 35 테스트 실행 PASS로 회귀 0 실측
8. PASS — 테스트 수치 주장 실검증: pnpm --filter @thepick/web test = 48 PASS(local-progress.test.ts 12 포함) / @thepick/srs = 35 PASS — 커밋 메시지 'web 48(+12)·srs 35' 주장과 정확 일치(AI 자기채점 아닌 직접 실행)
9. PASS — Hard Rule 15(범용 계층 시험 특화 분기 금지): 신규 코드는 apps/web 앱 계층 소재(범용 packages/ 아님), packages/srs 변경은 타입 import뿐 — examId 조건 분기 0. 테스트 픽스처 '상법'(:47)은 Rule 17 픽스처 예외 해당
10. PASS — Hard Rule 17(시험 ID 리터럴): 'son-hae-pyeong-ga-sa' 리터럴 grep 대상 8파일 중 0건 — EXAM_IDS 경유 필요 지점 자체 없음
11. PASS — export/import 왕복 무결성·전체 교체 계약: 테스트 :174-206 — JSON 직렬화 왕복 + 기존 데이터('stale') 교체 확인 + review id 재발급(export.ts:158) — 스코프 '전체 교체(반쪽 병합 금지)' 문면 일치
12. PASS — apps/web/package.json 의존 계약: @thepick/srs·@thepick/learning-modes workspace 추가(:21,23) + fake-indexeddb devDep 격리(:44 — 프로덕션 dependencies 아님) — 핸드오프 P2 '@thepick/srs를 web 의존성에 추가' 이행
13. PASS — vitest.config.ts include 'src/\*\*/\*.test.{ts,tsx}'(:28)가 신규 src/lib/\_\_tests\_\_/local-progress.test.ts 커버 — 테스트가 CI 경로에 실배선(고아 테스트 아님)
14. PASS — 관련 파일 무변경 확증(apps/api/src/study/routes.ts·db/schema.ts): 커밋 stat 8파일 한정 — 서버 fsrs_state 직렬화 계약(schema.ts:415) ↔ FsrsCardState(types.ts:25-42) 필드 대응 유지, 서버 streak 경로 동일 정본 소비로 로컬-서버 의미 동치
15. N/A — 수치/임계값 ↔ 교재 원문 대조: 본 변경엔 교재 유래 constants 0건(DEFAULT_DAILY_GOAL 20·dailyGoal 1~500은 제품 파라미터·명명 상수 선언 — db.ts:73, store.ts:126) — constants DB·교재 수치 미관여
16. N/A — BATCH 순서(N 검증 후 N+1): 본 변경은 BATCH 파이프라인 무접촉(D1 write 0, 콘텐츠 적재 0) — git stat 8파일에 batch/마이그레이션 부재
17. N/A — 노드 ID 네이밍(CONCEPT-001/F-01/INS-01): knowledge_nodes·ontology 신규 ID 생성 0건 — cardId는 exam_questions.id 참조 키(db.ts:28 주석)이지 온톨로지 ID 아님. Ontology Lock 무접촉
18. N/A — knowledge_nodes/formulas UPDATE 금지·LLM 수식 계산 금지·동적 실행 금지·draft 적재: 본 변경 D1/LLM/수식 실행 표면 0 — 클라이언트 IndexedDB 전용

---

## 후속 처분 권고 (MAJOR 3건 — 즉시 수정 또는 명시 이월)

| #       | 발견                               | 수리 비용                           | 권고                                                                             |
| ------- | ---------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| MAJOR-1 | KST 경계 재구현 (SSOT 우회)        | ~3줄 (dayBoundsUtc import 교체)     | 즉시 수정 — MINOR-2/-9/-13 동시 해소                                             |
| MAJOR-2 | srs·learning-modes 계약 주석 stale | 주석 3곳 amendment                  | 즉시 수정 — MINOR-10 동시 해소, '채점=server 전용(보안)' 경계 재명시 필수        |
| MAJOR-3 | import 봉투 유한성·날짜 검증 부재  | 타입가드 3함수 보강 + 테스트 케이스 | 즉시 수정 권장(P4 배선 전) — MINOR-1/-4/-11 동시 해소. due 실위험 = 무음 큐 누락 |

MINOR 잔여(수리 후): -3(dead 분기), -5(createdAt), -6(i18n → P4 계약), -7/-12(세션 축 결정 기록 → P4), -8(astro build 게이트 → P4), -14(examId 봉투 v2 → BE-7 원장). P4/BE-7 착수 시 carry-over 원장 등재 권장.

## 판정

**완료 가능** — 4-Pass CRITICAL 0건 (auto-review-protocol.md "4-Pass 모두 Critical 0건이어야 완료 선언 가능" 충족). 단 프로토콜 규칙 4에 따라 MAJOR 3건은 즉시 수정 대상 — 상단 처분 권고 참조.

---

## 처분 (2026-07-10, Fable — 리뷰 직후 반영)

**MAJOR 3 = 즉시 수정 완료:**

- **MAJOR-1 (KST 경계 재구현)** → `countReviewsOnKstDate` 를 learning-modes 정본 `dayBoundsUtc` 소비로 교체 (서버 study 경로와 동일 함수 — 단일 진실원 회복 + 무효 입력 사유 throw 무상 획득). m-2/m-9/m-13 동시 해소.
- **MAJOR-2 (stale 계약 헤더)** → 3곳 개정 (`srs/index.ts`·`learning-modes/index.ts`·`session-progress.ts`): "apps/web local-progress 가 FSRS 스케줄·스트릭을 클라 runtime 소비 (D-1 위임 결재 2026-07-08). ★채점(grade\*)·정답 데이터 = 여전히 server 전용(보안 불변)". m-10 동시 해소.
- **MAJOR-3 (봉투 의미 검증 부재)** → isParseableDate/isFiniteNumber/isNonNegativeInt 도입: due·lastReview·updatedAt·reviewedAt 날짜 파싱 검증(실측 확증된 지연 RangeError·due-큐 무음 누락 벡터 차단) + Infinity/음수 카운터 차단 + dailyGoal = `isValidDailyGoal` 공유 가드(db.ts 이동 — setDailyGoal 과 단일 잣대, m-4 해소) + cardId 유일성 Set 검사(사유 throw, m-11 부분 해소) + 실패 위치 사유(`invalid cards[N]`). 회귀 테스트 ★M-3 6종 벡터 추가.

**MINOR 처분:**

- m-1·m-2·m-4·m-9·m-11(검증 부분)·m-13 = MAJOR 수리로 근원 해소.
- m-3 (dead 분기) = `if (update.changed)` 단순화 + 계약 주석.
- m-5 (createdAt 리셋) = import 시 기존 meta.createdAt 보존 + 회귀 테스트 ★m-5.
- m-6·m-11(i18n) = **carry-over → P4**: 오류 코드→한국어 매핑 계약은 UI 배선 시(현 메시지 = 개발자 로그 용도 명시).
- m-7·m-12 (세션 축) = **결정 기록 영속**(db.ts 헤더): 세션 = P4 in-memory·이력 원천 = reviews append-only·FE-8 요구 시 v2.
- m-8 (astro build 게이트) = **P4 배선 Binary Gate 에 `pnpm --filter @thepick/web build` 포함**(원장 기록) + workspace 지정자 `*` 통일 완료.
- m-14 (봉투 examId 축) = **carry-over → BE-7 본편**: 봉투 v2 에 examId + import 시 현 서비스 시험 대조.

검증: web 50 pass(+2) · api 765 회귀 0 · srs/learning-modes/web typecheck·lint·g1 green.
