# Phase N 기술부채 리뷰 — backend-architect

- ts: `20260714-012918`
- 관점: 데이터·API 부채 — "2년차에 뭐가 아플까?"
- 합계: CRITICAL 0 / MAJOR 3 / MINOR 3

---

## BE-1 (MAJOR) — 공개 홍보 표면이 examId 경계 완전 우회 → Year 2 shared-D1 멀티종목 zero-cost 전환 파괴 (Rule 16 신규코드 위반)

- 파일: `apps/api/src/public/routes.ts`
- 라인: 65, 245-252, 296-320, 395-402, 538-545

인증 경로(study/routes.ts:811, progress/routes.ts:188, search)는 requireExamId 로 examId 첫 인자 강제(Rule 16 준수). 그러나 2026-07-08~12 신설 공개 4핸들러(overview/next/grade/reveal)는 examId 파라미터 전무, `FIXED_EXAM_TYPE='1st'`(65)+status 로 exam_questions 직접 조회. exam_type 은 손해평가사 내부(1차/2차) 축일 뿐 멀티종목 경계 아님. 핵심 콘텐츠 테이블(knowledge_nodes:169·exam_questions:351·formulas·constants)에 exam_id 컬럼 자체 부재(exam_id 는 engine_telemetry:810·review_queue:1056 ops 테이블만). 멀티트랙 = '공유 D1 + {exam}.thepick.co.kr' → Year 2 전기기사 문항이 동일 exam_questions 적재 시 jeon-gi.thepick.co.kr/api/public/questions/next 가 손해평가사 문항 혼입 서빙. production-quality.md:82 '신규 코드는 예외 대상 포함 금지' 정면 위배.

- **★교차 병합: refactoring REF-3(MINOR, exam_type 하드코딩, 동일 public/routes.ts:65)를 본 발견으로 병합·MAJOR 승격. RC-1 진앙.**
- 반론: 공개 표면은 promo-1st 한시 서비스라 Year 2 전 인증 학습 대체·폐기 가능(부채 소멸). exam_type 을 종목축 재해석 우회 가능. 다만 현재 라이브 + 삭제 계획 문서 부재 → 잔존 확률 높음, MINOR 강등 어려움.
- Horizon: Year 2 전기기사 콘텐츠가 공유 D1 exam_questions 진입 즉시(서브도메인 라우팅 개통). 06-12 category 배선 진행 중 = 멀티종목 임박.
- 권고: 공개 핸들러도 서브도메인/config 파생 examId 를 첫 인자 스레딩하는 requireExamId 게이트(WHERE 는 Year 1 무적용 허용). exam_questions exam_id 컬럼 마이그 slot 예약 + 공개 SQL 4곳 `exam_id = ?` 주입점 주석 seam.

## BE-2 (MAJOR) — append-only 테이블 전수 GC/retention 정책 부재 (D1 무한성장, 특히 rate_limits per-분 행)

- 파일: `migrations/0012_rate_limits.sql` (25-34) + login_history 0030 / status_transitions 0010 / sessions 0009 / engine_telemetry 0017 / study_reviews 0034

전역 grep: append-only 테이블 DELETE/prune/TTL/retention/cleanup cron 0건(session.ts TTL 은 JWT 만기, 행삭제 아님). rate_limits 는 bucket_minute 인덱스(0012:33)만, 만료 버킷 삭제 부재 → user×활동분×버킷당 1행 영구 누적. sessions expires_at 있으나 스윕 없음. status_transitions 는 상태 전이마다 영구 적재. D1 DB당 상한(수 GB~10GB)+full-scan 비용 → 10K DAU 에서 rate_limits 수백만 행 → rate check 스캔 지연 + 스토리지 압박.

- **★교차: performance PE-1(rate_limits write amplification) 동일 테이블 공동 압박. RC-3. + devops DO-3(R2 lifecycle) 와 데이터 수명주기 RC-5 공유.**
- 반론: 인덱스 point-lookup 이면 행수 무관 빠름 → 지연됨. CF 가 D1 상한 상향 중. 그러나 비용·백업(ops.yml R2 덤프) 크기·마이그 시간 선형 증가 불가피.
- Horizon: 10K DAU 6~12개월 누적 시 rate_limits/login_history 부터. 인증 1차 오픈(0044 해소) 후 실사용자 유입과 동시.
- 권고: 테이블별 retention SLO(rate_limits: bucket_minute<now-1h 삭제 / sessions: expired+revoked N일 / status_transitions·login_history: R2 콜드 롤오프). ops.yml 주간 prune cron. 최소 rate_limits 만료 버킷 삭제 즉시.

## BE-3 (MAJOR) — exam_questions 상태 전이가 마이그레이션 전용 mutable (런타임 문항 폐기/플래그 경로 부재)

- 파일: `migrations/0044_exam_questions_old_rows_retirement.sql` (33-46 trigger drop-bracket) + schema.ts:342-349 (0038 default-deny)

0038 트리거 prevent*exam_questions_body_update 가 status/superseded_by/valid*\* UPDATE 전면 ABORT. knowledge_nodes/formulas/constants 는 status_transitions append-only 로그로 상태 외부화(schema.ts:39-43)하는데, exam_questions.status 는 로그 미사용 in-place mutable 이나 트리거로 잠김. 문항 1건 deprecated/flagged 전이 = 매번 (1)트리거 drop 브래킷 (2)UPDATE (3)0038 byte-동일 재생성 (4)rollback (5)G-OLD 게이트 신규 마이그 필요(0044 가 36 오답에 정확히 이 절차 소비). 상용 '매년 개정' 빈도에서 수동 마이그 풀사이클 = 운영 병목.

- **★교차: RC-5 데이터 수명주기·상태전이 비대칭(BE-2 와 묶음).**
- 반론: L3 콘텐츠 불변성은 '65%→60% 오입력=서비스 사망' 방지 의도, 트리거 브래킷은 감사추적 강제 = 안전장치. 그러나 knowledge_nodes 는 append-only 전이 허용하며 exam_questions 만 마이그 전용 = 비대칭 부채. 36건 인시던트로 빈도 실증.
- Horizon: 매 콘텐츠 정정·개정(07-10 이미 1회). 2차 문항 대량 적재·검수 승급 시 반복.
- 권고: exam_questions 상태 전이도 status_transitions(또는 전용 exam_question_status_log) append-only 외부화 — 본문 불변(0038)은 유지, status 전이만 로그 기반 런타임 경로. ADR 로 knowledge_nodes 패턴 정합.

## BE-4 (MINOR) — 종목/차수 스코핑이 nullable·default='2nd' 단일 텍스트 컬럼 의존 (silent mis-scoping foot-gun)

- 파일: `apps/api/src/db/schema.ts` (366 examType default '2nd' NOT NULL 아님 + 225 knowledge_nodes examScope default '2nd')

exam_questions.examType 이 `.default('2nd')` 이고 notNull 아님. exam_id 부재 상태에서 종목·차수 스코핑 전체가 이 nullable defaulted 컬럼 하나 의존. 1차 콘텐츠를 exam_type 명시 없이 INSERT 하면 조용히 '2nd' → 공개 1차 표면에서 소실, 반대 오분류도 무에러. 0044 retirement 도 WHERE exam_type='1st' 의존 — 스코프 오염 시 대상 행 선정 틀어짐.

- 반론: 적재 파이프라인이 항상 명시하면 무문제(grep 상 런타임 INSERT 0 = BATCH/SQL 적재만). 방어선이 '적재자 실수 안 함'뿐, DB 제약(NOT NULL/CHECK) 부재 = Rule 16 '소스 계층 경계 확정' 미달.
- Horizon: 신규 종목/차수 대량 적재(2차 BATCH, 전기기사 온보딩). 오분류 무음 → 발견 지연.
- 권고: examType NOT NULL + CHECK 승격(또는 default 제거 명시 강제). exam_id 도입 시 동일.

## BE-5 (MINOR) — 마이그 번호 수동 단조 카운터 + 예약-공번(0020/0039/0040/0043) (이중 worktree 조율 리스크)

- 파일: `migrations/` (gaps: 0019→0021, 0038→0041, 0042→0044)

번호 구멍(0020/0039/0040/0043) 일부는 결재대기 plan 예약 슬롯(WS-2b 0039·WS-6c 0040·RW 0043). 수동 단조 카운터 + git worktree 이중 트랙 병행. 트랙 경계로 2호는 migrations/ 미접촉이나, 예약-공번은 다음 작성자가 0045 대신 빈 0039 를 '자유'로 오인하거나 두 미커밋 plan 이 같은 번호 각자 채택할 여지. wrangler apply 는 파일명 순차 → 충돌·역전 시 적용 실패/유령.

- 반론: 트랙 경계 + 예약 slot 문서화 + apply IF NOT EXISTS 방어 → 실사고 확률 낮음. schema.ts 헤더 1:1 대조로 테이블 드리프트 포착. 순수 인덱스/트리거 번호 충돌만 잔여.
- Horizon: 6개월 내 다수 미커밋 plan(0039/0040/0043) 동시 진행 또는 2호가 코어 스키마 이관 필요 발견 시.
- 권고: 예약 slot 을 빈 placeholder 파일(주석만) 물리 생성해 점유 가시화 또는 timestamp prefix 검토. 번호 할당 단일 원장(FRAMEWORK.md) 기록.

## BE-6 (MINOR) — 공개 choiceId HMAC 이 auth JWT_SECRET 재사용 (시크릿 회전 주기가 공개 채점 정합성과 결합, CHOICE_ID_SECRET 분리 미이행)

- 파일: `apps/api/src/public/choice-id.ts` (41-43 resolvePublicChoiceSecret→env.JWT_SECRET) + routes.ts:441

choiceId = HMAC-SHA256(JWT_SECRET, 'qId:originalIndex') 로 auth 서명 키 재사용. secret-rotation.md:20-25·38 이 결합 인지하고 'JWT_SECRET 회전 직후 choice_id_unresolved 스파이크 = 예상된 양성' 수용 → 회전 시 in-flight 공개 MC 제출 resolveChoiceId=null → isCorrect=false 오채점(grace window 없음 하드 컷오버). seam(CHOICE_ID_SECRET 분리, choice-id.ts:34-39) 미이행 → JWT_SECRET 공격적 회전이 공개 채점 정합성에 발목.

- **★교차: RC-6 운영 자격증명·DR 성숙도(devops DO-2~7 과 묶음).**
- 반론: choiceId 수명 초 단위, 재로드로 신선 획득. runbook 문서화·수용된 known 부채(숨은 리스크 아님) → MINOR 로도 과할 수 있음. 다만 회전 도구(D-36) 구축하며 dual-key 창 미설정은 정합성 공백.
- Horizon: 첫 JWT_SECRET 회전 이벤트(유출 강제 또는 정기).
- 권고: CHOICE_ID_SECRET 분리(seam 준비됨)로 디커플. 분리 전이면 회전 시 구·신 secret 이중 수용 창(≤수분).

---

## checkedItems (증거 기반 PASS/N-A)

- PASS — 단일 진실원(approved nodes): search/approved-nodes-sql.ts + 테스트, 우회 없음
- PASS — Rule 16 인증 경로 준수: study/routes.ts:811·progress/routes.ts:188·graph-search-route.ts:496 requireExamId/examId 첫 인자
- PASS — Vectorize 종목 경계: upserter.ts:148·table-fetcher.ts:142 requireExamId + user-search.test.ts:145 exam_id 메타 필터(이중 방어)
- PASS — Temporal Graph append-only: schema.ts:35-43 knowledge_nodes/formulas/constants UPDATE 차단, status_transitions 외부화
- PASS — RC-5 공개 계약 단일화: shared/public-learning-contract.ts 3표면 1정본
- PASS — choiceId 무상태: (qId,originalIndex,secret) 결정성으로 날짜시드 자정 오채점 회피, 서버 저장 0
- N/A — 4-way IDB↔D1 동기화: sw.js syncOfflineActions 문서화 stub(RC-3), 본 변경셋 밖(별도 트랙)
- 확인 — exam_id 컬럼 실측: core 콘텐츠 테이블 부재, ops 테이블(engine_telemetry:810·review_queue:1056)만 = Year 1 exam_id-absent 확증
- 확인 — GC 부재 실측: apps/api/src + migrations 전역 grep retention/TTL/DELETE FROM/prune/cleanup = append-only 대상 0건
- 확인 — 0044 = exam_questions status 직접 UPDATE(트리거 drop 33-46), status_transitions 미경유 = knowledge_nodes 패턴 비대칭 확증
- 확인 — 마이그 번호 gap: 0019→0021, 0038→0041, 0042→0044 (0020/0039/0040/0043 공번, 일부 예약)
