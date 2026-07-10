# Phase N (promo-1st P0~P4) 기술부채 리뷰 — refactoring-expert

- 관점: 코드 품질 부채 — "6개월 뒤 이 코드가 버틸까?"
- 실행 상태: **실행 완료** (발견 8건 = MAJOR 4 / MINOR 4, CRITICAL 0)
- 통합 인덱스: `phaseN-tech-debt-20260710-105821-INDEX.md`
- 발견 ID 접두: `R-`

---

## R-M1 [MAJOR] 신규 public 라우트 3핸들러가 Hard Rule 16 위반 — exam 경계 조건을 wrapper 없이 인라인 raw SQL 로 3중 복제, examId 파라미터 부재

- 파일: `apps/api/src/public/routes.ts:236-260, 328-335, 440-447`
- 상세: production-quality.md Rule 16 은 exam 지식 테이블 조회를 'examId 첫 인자 wrapper' 로 강제하고 '신규 코드는 Year 1 예외 대상 포함 금지'라고 명시한다. /questions/next·/grade·/reveal 은 전부 핸들러 안 인라인 prepare 로 exam_questions 를 직접 조회하며, 경계 조건(status='active' AND exam_type='1st')이 3곳에 각각 복제돼 있고 exam_id 축은 어디에도 없다(FIXED_EXAM_TYPE 은 1차/2차 stage 축이지 종목 축이 아님). 07-04 R5 결재로 '플랫폼 공유 D1 + 통합 계정'이 확정된 상태 — 2호 전기기사 문항이 같은 exam_questions 에 적재되는 순간(전기기사도 exam_type '1st' 상당 stage 보유 가능) 이 무인증 홍보 표면이 타 종목 문항을 그대로 서빙·채점한다. exam_id 컬럼 마이그레이션 시점에는 wrapper 부재로 public 3핸들러 + study 라우트 전 지점을 개별 수정해야 하며 한 곳이라도 누락되면 무음 교차 누수다.
- Devil's Advocate: Year 1 현재 exam_questions 는 손해평가사 단일 종목이라 즉시 결함은 아니고, 선재 study/routes.ts 도 동일 인라인 패턴이라 '기존 관례 답습'으로 볼 수 있다. 그러나 CLAUDE.md 가 '기존 나쁜 패턴 복제 금지'를 명시하고 Rule 16 이 신규 코드 예외를 봉쇄했으므로 강등 근거가 약하다. 강등하려면 최소한 fetchPublicQuestion(examId, ...) 형태 단일 접근 함수로 3중 복제만이라도 수렴해야 한다.
- Horizon: Year 2 exam_id 마이그레이션 착수 즉시(수정 전파면 3+N곳) / 2호 전기기사 문항 공유 D1 적재 시 무음 교차 서빙
- 권고: public/queries.ts 로 fetchServeCandidates(examId, filter)·fetchGradableQuestion(examId, questionId) 2개 wrapper 추출(첫 인자 ExamId, 내부는 현 SQL 그대로). 경계 조건 문자열이 1곳으로 수렴되고 Rule 16 zero-cost 전환 계약을 회복한다. ~1h, 행위 불변.
- INDEX 병합: **B-M6 과 교차 합의 병합 → 통합 M-1** (refactoring + backend)

## R-M2 [MAJOR] /grade 와 /reveal 핸들러 ~75줄 동형 중복 — 조회·경계·MC 계약 파싱·correctChoiceIds 재발급·응답 조립이 2벌

- 파일: `apps/api/src/public/routes.ts:316-422 vs 428-504`
- 상세: 두 핸들러가 (1) 동일 SELECT+bind(328-335 ≡ 440-447), (2) row null/answer 빈값 404/422 분기(341-347 ≡ 453-458), (3) parseMcChoices 거부 로깅+422(359-366 ≡ 464-471), (4) correctOriginalIndices→issueChoiceId 재발급 루프(376-379 ≡ 473-476), (5) explanation 조건부 동봉 body 조립(414-421 ≡ 496-503) 을 그대로 반복한다. 경계 정책 변경(예: status 집합 확대, 신규 게이트, exam_id 축 추가)이나 MC 계약 처분 변경 시 두 곳을 동기 수정해야 하고, reveal 은 grade 대비 사용 빈도가 낮아 드리프트가 테스트 그물을 늦게 통과할 표면이다. 이미 P4-D1 에서 reveal 을 추가하며 grade 본문을 사실상 복붙한 것이 드리프트 1회차다.
- Devil's Advocate: 각 핸들러 응답 의미(채점 vs 공개)와 AE 이벤트 종류가 달라 '우연한 유사'로 볼 여지가 있고, 507줄 단일 파일에서 2벌 중복은 아직 인지 가능 범위다. 그러나 (1)~(5) 는 의미까지 동일한 계약 코드라 우연이 아니며, 파일 헤더 스스로 '경계 강제 = /grade 와 동일'이라고 선언해 동기 의무를 자인하고 있다.
- Horizon: 6개월 내 경계·계약 정책 첫 변경 시(reveal 측 누락 = 무음 정책 우회)
- 권고: loadPublicQuestion(db, questionId): {row}|{errorResponse} + issueCorrectChoiceIds(secret, row, mc) + buildAnswerBody(row, correctChoiceIds) 3함수 추출. grade 고유부(제출 해석·isCorrect)만 잔류. ~1h.

## R-M3 [MAJOR] 공개 표면 과목·회차 목록이 production 1회 SELECT 스냅샷의 프론트 하드코딩 — 연 1회 회차 적재마다 무음 stale

- 파일: `apps/web/src/components/public/constants.ts:50-57`
- 상세: FIRST_EXAM_SUBJECTS(3과목 문자열)·FIRST_EXAM_ROUNDS([5..11])가 '2026-07-10 production 실측' 주석과 함께 번들에 하드코딩돼 PracticePicker 필터의 유일한 원천이다. production-quality.md 금지표 1행이 '하드코딩 → Constants DB 또는 config' 이고 이 프로젝트의 핵심 전제가 '매년 개정·매년 신규 회차'다. 제12회 문항이 적재돼도 회차 픽커에는 영원히 안 뜨고(코드 배포 필요), subject 문자열이 개정판 재적재에서 한 글자라도 바뀌면 해당 과목 필터는 전부 NO_QUESTION 빈 상태로 강하한다 — 주석이 자인하듯 '정직 강하'지만 학습자에게는 콘텐츠 소실과 구분 불가한 무음 회귀다. 2호 전기기사 공개 표면 복제 시에도 이 상수 계층부터 종목별 포크가 강제된다.
- Devil's Advocate: v1 홍보 스코프에서 서버 subject 목록 API 부재를 문서화한 의도적 트레이드오프이고, 다음 회차(제12회)까지 시간 여유가 있으며 실패 모드가 오답이 아닌 빈 상태라 안전하다. 강등 논거로 유효 — 다만 '배포 없이는 신규 콘텐츠가 필터에 안 뜬다'는 결합은 홍보 서비스의 콘텐츠 신선도 자체를 코드 릴리스에 묶는 구조라 6개월 유지보수 부채로는 실재한다.
- Horizon: 제12회(차기 연례 회차) production 적재 시 + 과목 라벨 개정 재적재 시
- 권고: GET /api/public/meta (SELECT DISTINCT subject, round WHERE 서빙 경계 동일) 1엔드포인트 추가 + 60s public 캐시, 프론트 상수는 fetch 실패 폴백으로 강등. Cloudflare 단일 벤더 정합, ~2h.

## R-M4 [MAJOR] local-progress export/import·getDueCards·setDailyGoal 이 작성·테스트·공개 export 됐지만 UI 소비자 0 — '최종 안전망' 주석 주장과 실체 불일치

- 파일: `apps/web/src/lib/local-progress/export.ts:1-206` (index.ts:31-37, store.ts:9-10·127-146·169)
- 상세: exportLocalProgress/importLocalProgress/validateExport(206줄)·getDueCards·setDailyGoal 은 index.ts 로 공개 export 되고 테스트(335줄)까지 갖췄지만 컴포넌트 소비자가 0이다(grep: StreakPanel=getStreak, PublicPracticeApp=recordReview 뿐). store.ts:169 는 'export 가 최종 안전망(Safari ITP 7일 증발 대비)'이라 주장하고 store.ts:10 은 소비자로 '복습 큐'를 명시하지만 공개 표면에 복습 큐 화면·export 버튼·목표 설정 UI 는 존재하지 않는다. G-1(서버 진도 0) 체제에서 로컬 데이터 증발의 유일한 방어선이 코드로만 존재하고 사용자 도달 경로가 없다 — 6개월 뒤에는 '배선된 줄 알았던' 주석·export 표면이 신뢰 불가한 지도(map-territory 불일치)가 된다.
- Devil's Advocate: P4 원장에서 export UI 를 후속 패키지로 의도 이연했을 수 있고, Vite 트리쉐이킹으로 번들 비용은 0이며, 미리 검증된 계층을 두는 것은 나쁜 설계가 아니다. 강등 여지 있음 — 단 그 경우에도 주석의 '소비자 = 복습 큐 / export = 안전망' 서술은 현재형 거짓이라 최소 주석 정정 + 배선 carry-over 명시 등재가 필요하다(sw.js syncOfflineActions stub 정직 표기 전례와 동일 클래스).
- Horizon: 홍보 트래픽 유입 수주~수개월 내 Safari/프라이빗 모드 유저 진도 증발 민원 시 안전망 부재 노출 / 6개월 유지보수 시 주석-실체 불일치 혼선
- 권고: (a) PracticeSummary 또는 StreakPanel 에 export/import 진입점 1버튼 배선(≤0.5d), 또는 (b) 즉시 배선이 스코프 밖이면 store.ts:9-10·169 주석을 '미배선 — carry-over' 로 정정하고 P5 원장에 등재. 방치(무언의 dead export)는 불가.

## R-m5 [MINOR] 공개 프론트 컴포넌트군 행위·표현 중복 — doGrade 흐름 2벌, 키보드 가드 2벌(이미 동일 수정을 2곳 적용한 전력), 카드 헤더 3벌, 버튼 스타일 인라인 ~22곳

- 파일: `apps/web/src/components/public/PublicQuestionCard.tsx:67-96·107-112` (BlankNote.tsx:65-88, FlipDeck.tsx:56-62·85-92)
- 상세: (1) 채점 흐름(grading 상태→gradePublic→onGraded record→PublicApiError 폴백 문구)이 PublicQuestionCard.doGrade 와 BlankNote.doGrade 에 2벌. (2) 키 핸들러의 버튼-포커스 가드 블록이 FlipDeck:61 과 PublicQuestionCard:110 에 2벌 — 주석 스스로 '4-Pass MAJOR-2 동형 가드'라 적어, 하나의 버그 수정을 이미 2곳에 병렬 적용해야 했음을 실증한다(중복의 실비용 발생 이력). (3) sourceTextOf+subject 배지 헤더가 FlipDeck:85-92·BlankNote:95-102·PublicQuestionCard 에 3벌. (4) '…다시 시도해 보자' 폴백 문구 5곳, minHeight 44/48 인라인 + 동일 버튼 클래스 문자열 ~22곳 — 스택 선언(shadcn/ui)과 달리 공유 프리미티브 0. 터치 타겟 정책이나 디자인 토큰 변경 시 전 파일 수동 순회다.
- Devil's Advocate: 컴포넌트당 100~250줄로 아직 작고 응집적이며, React 에서 조기 추상화가 더 나쁜 결합을 만들 수 있다. 홍보 표면이 단명 스코프라면 중복 수용이 합리적일 수 있음 — 다만 키보드 가드 2벌은 이미 이중 수정 비용을 1회 지불했으므로 최소 그 훅(useCardHotkeys)과 CardHeader/GradeButton 2개만이라도 추출 가치가 있다.
- Horizon: 6개월 내 디자인 토큰/접근성 정책 변경 또는 키 핸들링 3번째 버그 수정 시
- 권고: useCardHotkeys 훅 + PublicCardShell(헤더·푸터 슬롯) + Button 프리미티브 추출, 폴백 문구는 api.ts ERROR_MESSAGES 옆으로 이동. ~0.5d.

## R-m6 [MINOR] 공용 유틸(sourceTextOf·correctChoiceTexts)이 컴포넌트 파일에 거주 — 형제 컴포넌트들이 컴포넌트 파일을 유틸 소스로 import

- 파일: `apps/web/src/components/public/PublicQuestionCard.tsx:25-40` (FlipDeck.tsx:18, BlankNote.tsx:16 import)
- 상세: 순수 함수 sourceTextOf/correctChoiceTexts 가 최대 컴포넌트 파일(254줄) 안에 선언되고 FlipDeck·BlankNote 가 './PublicQuestionCard' 에서 import 한다. 컴포넌트 간 수평 import 가 유틸 때문에 생겨 의존 그래프가 오독되고(카드가 카드에 의존?), PublicQuestionCard 리팩토링·이동 시 무관한 두 컴포넌트가 연쇄된다. types.ts·rating.ts·constants.ts 로 유틸을 분리해 둔 이 디렉토리 자체 관례와도 불일치.
- Devil's Advocate: 3파일 규모에서 실해는 미미하고 순환 import 도 아니어서 배치 취향 문제로 볼 수 있다. 다만 수정 비용이 5분이라 방치할 이유도 없다.
- Horizon: 6개월 유지보수 — 컴포넌트 분리/이동 첫 시도 시
- 권고: 두 함수를 format.ts(또는 기존 types.ts 인접 신규 유틸 파일)로 이동, import 경로 3곳 갱신.

## R-m7 [MINOR] -MC 이중 행 체제 장기화 리스크 — 인증 study /next 가 old(오채점 경로)·-MC 쌍둥이를 둘 다 무필터 서빙 (기등재 carry-over 의 시한 환기)

- 파일: `apps/api/src/study/routes.ts:927-941`
- 상세: P3 가 521 개 {oldId}-MC 행을 순수 INSERT 하면서 old 525 행은 status='active' 그대로다(0004/0038 트리거상 UPDATE 불가 — 의도된 기결). 인증 /study/next 쿼리(WHERE status='active' AND exam_type=? 뿐)는 두 행을 모두 서빙하므로 유료 학습자는 같은 기출을 (a) 보기 인라인 fill_blank + 위치라벨 answer 오채점 유사 경로, (b) 정상 MC 로 두 번 만난다. old 행 처분(SUPERSEDES 상태머신 마이그)은 incident 정본에 '별도 plan' 으로 이연돼 있으나 시한·차단 게이트가 없어, 이 이중 상태가 6개월 표류하면 문항 수 왜곡(545→1,066급)·FSRS 중복 카드·통계 오염이 인증 표면의 상시 특성으로 굳는다.
- Devil's Advocate: 이미 docs/audit/incident-1st-answer-errors-20260710.md 에 carry-over 로 등재된 기지 사안이라 중복 지적 소지가 있고, 현 서비스는 공개(무인증) 표면 중심이라 인증 경로 노출 실사용자가 적다. 본 보고는 신규 발견이 아니라 '별도 plan 에 시한 없음' 이라는 부채 이자 관점의 환기로 한정한다.
- Horizon: 인증 학습 표면 실사용 개시 시점 즉시(런칭 스프린트) — 별도 plan 이 6개월 밀리면 상시 결함화
- 권고: old 행 처분 plan 에 착수 게이트(예: 인증 표면 공개 전 필수)를 로드맵 결재 큐에 명시. 코드 땜빵(WHERE id NOT LIKE '%-MC' 류) 은 금지 — 상태머신 마이그가 정도.
- INDEX 병합: **통합 CRITICAL C-1 에 흡수** (quality/backend CRITICAL 과 동일 뿌리·동일 표면 — refactoring 은 MINOR 수위로 반향)

## R-m8 [MINOR] 시험 stage 리터럴 '1st'|'2nd' 유니온이 다중 선언 — EXAM_IDS 류 단일 선언 부재, 신규 public 표면이 선언 지점 1곳 추가

- 파일: `apps/web/src/components/session/types.ts:16` (StudyFlow.tsx:47·95·140, apps/api/src/public/routes.ts:48)
- 상세: 종목 축은 Rule 17 로 EXAM_IDS 단일 선언이 강제돼 잘 지켜지지만(신규 코드 리터럴 0 확인), stage 축('1st'|'2nd')은 web session/types.ts ExamType, StudyFlow 인라인 유니온 2곳, api FIXED_EXAM_TYPE, shared ExamScope('1st_sub1'…) 등에 흩어져 있고 이번 public 표면이 리터럴 선언 지점을 하나 더 늘렸다. 2호 전기기사(1·2차 구조 상이 가능)나 stage 값 스키마 변경 시 grep 기반 전수 수색이 필요한 축이다.
- Devil's Advocate: 대부분 선재이고 '1st' 는 D1 CHECK 로 보호되는 안정 값이라 드리프트 확률이 낮다. FIXED_EXAM_TYPE 처럼 명명 상수로 감싼 것 자체는 올바른 국소 관행 — 진짜 필요한 것은 shared 에 ExamStage 타입+상수 1곳이며 긴급도는 낮다.
- Horizon: 2호 전기기사 stage 모델링 확정 시(M1 exams/ 골격 작업과 자연 병합 가능)
- 권고: packages/shared 에 EXAM_STAGES = ['1st','2nd'] as const + ExamStage 타입 단일 선언, 각 선언 지점을 참조로 교체. M1(exams/ 골격) plan 에 1줄 편승.

---

## 확인 항목 (증거 기반 — 0건 아님을 실측한 항목 포함)

- PASS: packages/learning-modes/src/input-types/mc-choices.ts:55-111 — MC 보기 계약 파싱이 단일 정본으로 추출되고 study/routes.ts diff 에서 구 buildShuffledChoices 인라인 ~60줄이 실제 삭제·위임됨(중복 해소 방향 정확, 복붙 0 주장 실코드 확증)
- PASS: packages/learning-modes/src/types.ts:15-19 — resolveInputType 이 study/routes.ts 로컬 구현에서 단일 정본으로 이관, 공개·인증 경로 공유 확인
- PASS: Hard Rule 17 — grep 'son-hae-pyeong-ga-sa' 가 apps/api/src/public·apps/web/src/components/public·lib/local-progress·mc-choices.ts 에서 0건(rc=1)
- PASS: Hard Rule 15 — packages/learning-modes·packages/srs 신규/변경분(parseMcChoices, resolveInputType, fsrs type-only import)에 examId 분기·시험 특화 리터럴 0. srs/index.ts·session-progress.ts 의 '클라 runtime 소비' 계약 개정이 위임 결재 근거와 함께 주석 명문화됨
- PASS: apps/api/src/public/choice-id.ts:1-82 — 단일 목적 응집 모듈, HMAC 폴백 상수의 보안 무해 논거(F-3) 문서화, 죽은 코드 0
- PASS: apps/api/src/public/rate-limit.ts:19-35 — auth/rate-limit.ts handleMissingBinding 재사용(fail-open/closed 정책 복제 대신 export 승격 — 올바른 재사용 방향)
- PASS: apps/api/src/middleware/cache-policy.ts:63-70 — /api/public/\* no-store 가드에 미래 지뢰 경고(공용 캐시 금지) 주석 동봉
- PASS: scripts/promo-p3/build-mc-inserts.ts — 일회성 스크립트가 parseMcChoices 단일 정본 재사용 + answer 가드 fail-loud + 정직 제외 목록(무음 skip 0), 하드코딩 리터럴은 SQL 생성물 명세로 정당
- N/A: apps/api/wrangler.toml 3중 환경 블록(dev/staging/production 바인딩 반복) — wrangler 상속 미지원의 플랫폼 고유 패턴, 리팩토링 대상 아님
- 확인(강등): apps/api/src/public/analytics.ts:45-56 — AE blobs 위치 기반 스키마에 버전 필드 없음. 추후 차원 추가는 append-only 로 흡수 가능해 findings 미등재
- 확인: apps/web/src/components/public/StreakPanel.tsx:33-43 — DAY_MS 산술 날짜 버킷은 KST(DST 없음) 전제에서 안전, todayDateString 정본 재사용 확인
- 확인: 공개 표면 dead export 검증 — grep 결과 getStreak/recordReview/requestPersistentStorage 만 소비, exportLocalProgress·importLocalProgress·validateExport·getDueCards·setDailyGoal 소비자 0 (R-M4 근거)
- 확인: apps/api/src/study/routes.ts:927-941 — 인증 /next WHERE 가 status+exam_type 뿐, -MC 쌍둥이 무필터 서빙 (R-m7 근거, incident 정본 carry-over 와 교차 확인)
