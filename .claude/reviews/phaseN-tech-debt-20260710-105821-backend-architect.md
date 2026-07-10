# Phase N (promo-1st P0~P4) 기술부채 리뷰 — backend-architect

- 관점: 데이터·API 부채 — "2년차에 뭐가 아플까?"
- 실행 상태: **실행 완료** (발견 8건 = CRITICAL 1 / MAJOR 5 / MINOR 2)
- 통합 인덱스: `phaseN-tech-debt-20260710-105821-INDEX.md`
- 발견 ID 접두: `B-`

---

## B-C1 [CRITICAL] 이중 진실 행 체제 — old 525(오답 36 active) + -MC 521 동시 서빙 풀, 인증 학습 경로 무가드

- 파일: `apps/api/src/study/routes.ts:823, 936-938, 1569`
- 상세: P3 가 {oldId}-MC 신규 행 521을 INSERT 하면서 old 1차 525행(오답 36건 잔존, answer=위치라벨·distractors NULL 의 MC-in-disguise)이 status='active' 그대로 남았다. 공개 표면(public/routes.ts:166-177 isServable)은 old 행을 거부하지만, 인증 /study/next 는 WHERE status='active' AND exam_type=? 뿐(:936-938)이고 examType 기본값이 '1st'(:823) — 동일 문항이 old·-MC 두 행으로 이중 서빙되고, old 행의 확정 오답 36건이 학습자에게 정답으로 채점된다(Hard Stop '정답 100%' 계약 위반 상태 지속). 파생: ① user_progress.card_id 가 두 id 로 분열 → FSRS 이력 이원화(복습 스케줄 왜곡) ② /study/mode 통계 COUNT(:1569)·subject 약점 집계가 문항 풀을 이중 계상(525→1046) ③ (exam_type,year,round,question_number) 자연키가 DB 수준에서 중복 — 문항번호 기준 조인/dedup 소비자 전부 앰비규어스. superseded_by 마킹(ADR-046 D-6(a) 나머지 절반)은 'carry-over'로 무기한 이연 = 정본 행이 무엇인지 DB 가 스스로 말하지 못한다.
- Devil's Advocate: 인증 학습 표면은 아직 미런칭(테스트 자동로그인 차단물 잔존)이고, old 행 오답 36 인시던트는 이미 정직하게 문서화·별도 L3 plan 예약됨 — '알려진 부채'로 MAJOR 강등 가능. 반박: 인시던트 문서는 오답 잔존만 다루고 이중 서빙·FSRS 분열·통계 이중 계상은 어느 문서에도 미기재(신규 발견). 또한 /study/next 는 production 에 이미 배포된 경로라 도그푸딩·검수 세션에서도 즉시 재현된다.
- Horizon: 인증 1차 학습 표면 오픈 즉시(내부 도그푸딩 포함). 늦어도 1차 유료 런칭 시점 = 오답 노출 + FSRS 데이터 오염이 사용자 데이터에 영구 각인
- 권고: L3 plan 1건으로 묶어 결재: (1) 인증 /next 에도 서빙 자격 가드(또는 old 1차 행 input_type 재분류로 풀 격리 — 0038 메타 화이트리스트로 UPDATE 가능한 유일 경로) (2) superseded_by 마킹 상태머신 마이그를 '별건'이 아니라 1차 학습 오픈의 선결 게이트로 승격 (3) 정본 행 판별 규칙(뷰 또는 WHERE 규약)을 단일 모듈로 영속
- INDEX 병합: **Q-C1 과 교차 합의 병합 → 통합 CRITICAL C-1**

## B-M2 [MAJOR] 정답 진실원 이원화 — 원 소스 batch-Q JSON 오답 36 미정정, 교정 정본이 promo 국지 오버레이에 고립

- 파일: `docs/batch-load/promo-mc-distractors/answer-corrections.json` 전체 (incident-1st-answer-errors-20260710.md §5.3)
- 상세: 교정 36건의 유일 정본이 promo-mc-distractors/ 디렉토리의 오버레이 JSON 이고, 원 적재 소스(docs/batch-load/batch-Q-_/batch-Q-_.json — production old 행의 '정본 소스')는 오답 그대로다. 인시던트 재발방지 §5.3 은 '향후 기출 BATCH 게이트'만 명시하고 기존 소스 JSON 정정은 무계획. batch-Q JSON 을 재소비하는 미래 경로가 최소 3개 실재: 골든 평가셋 확대(0b N≥30), 보기별 출처 라벨 Phase C(545 전수 BATCH), 2호 전기기사 콘텐츠 파이프라인의 1호 템플릿 복제. 이들 중 어느 것도 promo 디렉토리의 오버레이를 알지 못하면 오답 36이 새 산출물로 재유입된다 — G-AUDIT stale 오염(단일 오염원→5-Layer 증폭)과 동일 클래스.
- Devil's Advocate: incident 문서·REPORT 가 크로스링크돼 있어 성실한 후속 작업자는 오버레이를 발견할 것이고, 소스 JSON 직접 수정은 '원 산출물 불변' 원칙과 충돌할 수 있다. 반박: 발견 가능성이 '문서를 읽었는가'에 의존하는 구조 자체가 부채다. 06-12 실수 로그가 증명하듯 stale/미검증 전제는 반복 재발했다.
- Horizon: 다음 batch-Q JSON 소비 시점 — 골든 0b 확대(결재 대기 중, 수주 내) 또는 Phase C 545 전수 BATCH
- 권고: corrections 오버레이를 batch-Q 소스 옆(docs/batch-load/ 루트 또는 각 회차 디렉토리)으로 승격 + batch JSON 소비 스크립트 공통 진입점에 오버레이 필수 적용 가드(부재 시 throw — P3 빌더의 하드 사전조건 패턴 재사용)

## B-M3 [MAJOR] 스키마 선언 ↔ production 트리거 드리프트 — schema.ts 는 0038 화이트리스트를 현행으로 동결 선언, production 은 0004 전면 ABORT

- 파일: `apps/api/src/db/schema.ts:342-349`
- 상세: schema.ts 헤더 주석이 '메타 화이트리스트(UPDATE 허용): relatedNodes/relatedConstants/topicCluster/memorizationType/confusionType/inputType' 를 0038 트리거와 '1:1 동결'로 문서화하나, production 은 0038 미적용(incident §4 실증: 0004 prevent_exam_questions_update 전면 UPDATE ABORT 만 적용). P3 리허설은 in-memory SQLite 에 0004+0038 을 **둘 다** 적용해 검증(REPORT §4) — 즉 로컬 검증 환경과 production 의 트리거 계약이 다르다. 6개월 뒤 유지보수자가 schema.ts 주석을 믿고 메타 UPDATE(예: related_nodes 백필, inputType 재분류)를 로컬 리허설 통과 후 production 실행하면 ABORT. 부수: .claude/reports/production-migration-status.md 는 0035까지만 기록(CLAUDE.md 는 0037 적용 주장) — 마이그 상태 정본 자체가 이중 stale.
- Devil's Advocate: 0038 production 적용은 '게이트 #3 = 진산 인증 게이트'로 명시 예약돼 있어 의도된 대기 상태다. 반박: 의도된 대기여도 schema.ts 주석에 'production 미적용' 라벨이 없고, 검증 환경이 0038-적용 세계를 전제하는 순간 드리프트는 문서가 아닌 사고로 발견된다. 상태 정본(migration-status.md) 3개 버전 불일치는 변명 불가.
- Horizon: related_nodes 백필 실행 시(게이트 #3, E0-8 승급 체인과 결합 — 수주~수개월 내) 또는 old 행 inputType 재분류 시도 시
- 권고: schema.ts 헤더에 'production 현행 = 0004 전면 ABORT, 0038 미적용(게이트 #3)' 1줄 명시 + production-migration-status.md 를 0036~0038 현황으로 동기(CLAUDE.md '현재 상태' 동기 의무와 동일 규칙 적용)

## B-M4 [MAJOR] 출처 추적성 파이프라인이 old id 축 — 서빙 정본(-MC 행)은 related_nodes NULL 동결, 백필 계획 미커버

- 파일: `docs/plans/s5-6-measurements/backfill-related-nodes-pilot.draft.sql:1-30` (grep 'MC' = 0건 실측)
- 상세: -MC 행은 INSERT...SELECT 로 old 행의 related_nodes 를 승계했는데(insert-round-5.sql:8) old 1차 행은 전부 NULL — 즉 서빙 행 521의 근거 라벨이 NULL 로 동결됐다. 한편 백필 draft·golden pilot·Phase B/C 545 전수 계획은 전부 P3 이전 산출물로 old id 만 표적(draft SQL 에 MC 참조 0건). 향후 모든 메타 보강(related_nodes, topic_cluster 채움, confusion_type)이 두 행 계열에 이중 실행돼야 하나 동기 메커니즘·의무 기재가 어디에도 없다. 결과: '근거 보기' 1급 UX(출처 추적성 필수 — 근거 0건 = approved 불가 원칙)가 정작 학습자가 실제 소비하는 -MC 행에서 영구 공백. 4-way sync(D1 old ↔ D1 MC ↔ 소스 JSON ↔ 골든 파일) 중 D1 내부 두 계열 간 sync 가 설계 부재.
- Devil's Advocate: 현 백필 pilot 은 measurable 7건(대부분 2차)이라 -MC(1차 전용)와 실제 교집합은 재해법령 3건 수준 — 당장의 충돌 면적은 작다. 또 0038 화이트리스트상 related_nodes 는 UPDATE 가능하므로 -MC 행 사후 백필도 기술적으로 열려 있다. 반박: 면적이 작을 때 규약을 못 박지 않으면 Phase C 545 전수 시점에 1046행 × 메타 4컬럼의 이중 관리가 무규약 상태로 도래한다.
- Horizon: Phase B/C 보기별 출처 라벨 BATCH 착수 시(1차 학습 UX 오픈 전제 조건) — 6개월 내
- 권고: 백필/메타 보강 런북에 '표적 = old id 계열 + (존재 시) {id}-MC 동반 갱신' 불변 규칙 1줄 등재 + 이중 계열 존재를 검증하는 무결성 러너 항목 추가(old 와 -MC 의 메타 컬럼 발산 감지)

## B-M5 [MAJOR] Analytics Engine = G-1 하 유일 서버측 기록인데 보존 한계 + 무버전 위치 기반 blob 스키마

- 파일: `apps/api/src/public/analytics.ts:45-56`
- 상세: G-1(서버 user 데이터 0) 설계에서 공개 표면의 서버측 유일 기록이 AE 인데, 문서 헤더가 이를 '홍보 지표·오답 통계 원천(과목별 정답률 등)'으로 선언한다. 두 천장: ① Cloudflare AE 는 장기 보존 스토어가 아니다(SQL API 조회 가능 기간 약 3개월) — 분기 단위 홍보 성과 비교·문항 난이도 축적(오답 통계는 콘텐츠 개선 원천)이 조용히 증발한다. D1 롤업 영속 경로가 0. ② blobs 가 위치 기반 배열(kind, subject, round, inputType, examType 순)이고 스키마 버전 필드가 없다 — 필드 1개 추가 시 기존 데이터와 신규 데이터의 해석이 갈리고, 대시보드 쿼리가 무음으로 오집계된다(doubles[0]=-1 센티널 방식도 동일 취약).
- Devil's Advocate: 홍보 표면은 한시적일 수 있고, 필요 지표가 '최근 몇 주 전환율' 수준이라면 3개월 보존으로 충분하다. AE 보존 기간은 요금제·시점에 따라 다를 수 있어 '약 3개월'은 재확인 필요. 반박: '오답 통계 원천'이라는 선언이 이미 장기 소비를 약속했고, 증발은 알림 없이 일어난다 — 반년 뒤 '작년 동월 대비'를 물을 때 데이터가 없다.
- Horizon: 첫 데이터 유입 후 약 3개월 — 2026-10월경 최초 구간 소실 시작
- 권고: 주기 롤업(cron Worker → AE SQL API → D1 집계 테이블, Cloudflare 단일 벤더 정합) 1개 + blobs[0] 또는 전용 blob 에 스키마 버전 태그('v1') 주입
- INDEX 병합: **D-m5(AE write-only 소비자 0)를 흡수 → 통합 M-14** (동일 file·동일 90일 보존창 증발 증상 — devops 는 '소비 경로 0' 각도)

## B-M6 [MAJOR] 공개 라우트 신규 코드의 Hard Rule 16 위반 시그널 — examId 무경유 인라인 쿼리 + 모듈 상수 경계

- 파일: `apps/api/src/public/routes.ts:48, 236-237, 256-260`
- 상세: production-quality.md Rule 16: '데이터 조회 함수에 examId 파라미터가 없다 = Year 1 시점에 이미 위반 판정'이고 Rule 15 예외는 '신규 코드 포함 금지'를 명시한다. public/routes.ts 는 신규 코드(07-09~10)인데 exam_questions 조회 3곳 전부 인라인 SQL + FIXED_EXAM_TYPE 모듈 상수(:48)로 경계를 하드코딩 — ExamId 경유·래퍼 함수·examId 파라미터 0. '1st'는 exam_type(차수 축)이지 exam_id(종목 축)가 아니므로 종목 경계는 아예 표현이 없다. 07-04 R5 결재로 {exam}.thepick.co.kr 종목별 공개 표면이 확정된 상태 — 2호 전기기사 공개 표면 착수 시 이 라우터는 복붙 분기(재오염, M1 plan C1 이 경고한 바로 그 패턴) 압력을 받는다.
- Devil's Advocate: 공개 표면의 '서버 고정 경계'는 보안 요구(클라 파라미터 불가)라 examId 를 요청 파라미터로 받는 것은 오히려 설계 후퇴다 — mount 시점 config 주입(createPublicRoutes(examConfig))으로 충족 가능하며 retrofit 비용도 낮다. 파일이 500줄 단일 모듈이라 이전 비용도 아직 작다. MAJOR→MINOR 강등 여지 있으나, '신규 코드 엄격 준수' 명문 규칙 위반이므로 MAJOR 유지.
- Horizon: 2호 전기기사 공개 표면 착수 시(W2 자료 인입 후 — 수개월 내). 방치 시 종목 수만큼 라우터 복제
- 권고: createPublicRoutes(config: { examType, examId }) 팩토리 파라미터화(현 시그니처가 이미 팩토리라 diff 극소) — 요청 파라미터가 아닌 mount 주입으로 Rule 16 취지와 서버 고정 경계 양립
- INDEX 병합: **R-M1 과 교차 합의 병합 → 통합 M-1** (refactoring = wrapper 부재·3중 복제 각도 / backend = 종목 축 부재·팩토리 주입 처방 각도)

## B-m7 [MINOR] '-MC' 접미사 ID 규약의 임시성 — 패턴 등록부 부재, LIKE '%-MC' 가 유일 계열 식별자

- 파일: `docs/batch-load/promo-mc-distractors/REPORT.md:63` (롤백 SQL), insert-round-5.sql:8
- 상세: 행 계열(서빙용 파생 행)이라는 시맨틱이 전용 컬럼이 아닌 id 문자열 접미사에 인코딩됐고, 식별 수단이 `id LIKE '%-MC'` 문자열 매칭뿐이다. 파생 이슈: ① Q-YYYY-RR-NNN 패턴을 전제한 기존 소비자(정규식 파싱 스크립트·골든 도구)가 -MC 행을 미인식 또는 오파싱 ② -MC 행 자체에 교정이 필요해지면(0004 트리거 하 UPDATE 불가) 후속 접미사(-MC2?) 규약이 미정의 ③ 공식 롤백 수단이 DELETE(append-only 원칙과 문면 충돌) ④ 2호 종목에서 동일 필요 발생 시 규약 재발명. exam_questions id 는 ontology-registry 관할 밖이라 기계 강제 지점도 없다.
- Devil's Advocate: ADR-046 D-6(a) 정합으로 명시 결재된 전략이고, 521행 단발 적재의 실용 해법으로 타당했다. 상태머신 마이그가 성사되면 -MC 체제 자체가 과도기 산물로 정리될 수 있어 규약 투자가 매몰될 수도 있다.
- Horizon: -MC 행 첫 교정 필요 시점 또는 2호 파생 행 필요 시점 — 6개월~1년
- 권고: old 행 정정 L3 plan(인시던트 후속)에 'id 파생 접미사 규약(1회 한정인지, 세대 규칙인지)' 결정 항목 1개 동봉

## B-m8 [MINOR] local-progress cardId 가 -MC id 에 결합 — 정본화 방향 결정 시 로컬 FSRS 이력 고아화 리스크

- 파일: `apps/web/src/lib/local-progress/db.ts:33-34`
- 상세: 무인증 로컬 진도의 카드 PK 가 exam_questions.id(= 공개 표면에서 서빙되는 -MC id)다. 인시던트 후속 옵션 A/B(old 행 정본화·-MC 정리)가 채택되거나 상태머신 마이그로 id 체계가 재편되면, 홍보 기간에 축적된 사용자 로컬 FSRS 이력이 통째로 고아가 된다. 또한 홍보→유료 전환 시 로컬 이력을 서버 user_progress 로 이관하는 매핑 경로가 없다(G-1 의도이나, card_id 어휘가 서버 인증 경로의 old id 와 이미 다르다는 점은 전환 설계 시 복병).
- Devil's Advocate: G-1 로컬 전용은 명시 결재(D-1)된 스코프 축소고, export 봉투에 스키마 버전 + 마이그레이션 분기가 예약돼 있어(:26) id 매핑 마이그레이션을 뒤에 붙일 여지는 확보돼 있다. 홍보 사용자 이탈률을 감안하면 실 피해 규모는 작을 수 있다.
- Horizon: old 행 정정 plan 실행 또는 홍보→계정 전환 기능 설계 시 — 6개월~1년
- 권고: 인시던트 후속 plan 의 옵션 평가 기준에 '공개 표면 로컬 이력의 card_id 연속성'을 명시 항목으로 추가(옵션 C 가 이 축에서 유리하다는 사실 기재)

---

## 확인 항목 (증거 기반)

- PASS apps/api/src/public/routes.ts:236-237,325-334 — exam_type='1st'·status='active' 서버 고정이 서빙·채점·reveal 3곳 WHERE 전부에 존재(경계 강제 확인, 2차/flagged 누출 없음)
- PASS apps/api/src/public/routes.ts:166-177 — isServable fail-safe 가 MC-in-disguise(old 525)·essay/calc 를 공개 서빙·채점 양방향 차단(정답 100% 계약 보수적 준수)
- PASS apps/api/src/public/choice-id.ts:43-54,69-81 — 무상태 HMAC choiceId 설계 건전(서버 세션 0, 자정 재셔플 지뢰 해소), 폴백 키 도메인 분리 상수 — F-3(정답 어차피 노출) 하 보안 영향 0 논거 타당
- PASS apps/api/src/public/analytics.ts:44-56 — PII 0 확인(IP/userId/문항 본문/정답 텍스트 미기록, 집계 차원만)
- PASS docs/batch-load/promo-mc-distractors/insert-round-5.sql:6-11 — 순수 INSERT + old 무접촉 + WHERE answer 가드(INSERT...SELECT 조건 불일치 시 0행 = 무음 오적재 차단), 0004/0038 트리거 정합
- PASS docs/batch-load/promo-mc-distractors/REPORT.md §4·§6 — 리허설 R1~R5 byte-동등 + production 카운트 검산 521/525/36 정확(적재 절차 자체의 품질은 우수)
- PASS apps/web/src/lib/local-progress/db.ts:26,101-108 — 스키마 버전 상수 + export/import 마이그레이션 분기 예약 + 기존 미러 DB 와 격리(지뢰 #7 준수)
- 확인 apps/api/src/study/routes.ts:823,936-938,1569 — 인증 /next 기본 examType='1st' + input_type/서빙자격 무가드 + mode stats COUNT (B-C1 근거 실측)
- 확인 docs/plans/s5-6-measurements/backfill-related-nodes-pilot.draft.sql — grep 'MC' = 0건 (백필 계획의 -MC 미커버 실측)
- 확인 apps/api/src/db/schema.ts:342-377 — 0038 화이트리스트 주석 vs incident §4 'production 0038 미적용' 대조 (드리프트 실측)
- 확인 .claude/reports/production-migration-status.md — 기록 상한 0035 (CLAUDE.md 0037 주장과 불일치, 상태 정본 stale 실측)
- N/A Vectorize/graph-walk/knowledge_nodes — promo-1st P0~P4 변경셋은 벡터·그래프 경로 무접촉(git stat 전수 확인), Temporal Graph SUPERSEDES 무결성은 이번 변경 범위에서 신규 리스크 없음(단 exam_questions 의 superseded_by 미마킹은 B-C1 에 포함)
- N/A Drizzle 런타임 쿼리 드리프트 — NC-1(타입 파생 전용) 준수 확인: 신규 public/routes.ts 전부 raw prepared statement, drizzle-kit 미사용
