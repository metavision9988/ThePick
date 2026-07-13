# Phase N 기술부채 리뷰 — refactoring-expert

- ts: `20260714-012918`
- 관점: 코드 품질 부채 — "6개월 뒤 이 코드가 버틸까?"
- 합계: CRITICAL 0 / MAJOR 2 / MINOR 2

---

## REF-1 (MAJOR) — public/routes.ts `/grade`·`/reveal` 핸들러 통째 복붙 (3-way 표류 위험)

- 파일: `apps/api/src/public/routes.ts`
- 라인: 383-607 (핵심: 394-406≡538-545 fetch, 408-414≡551-556 null-answer 가드, 426/562 parseMcChoices, 466-468≡577-580 정답 choiceId 루프, 475-492≡583-588 fill_blank MC-in-disguise)

GradeRow 조회 SQL·바인딩·try/catch·null·빈답 가드 블록이 `/grade`·`/reveal` 에 바이트 단위로 두 번 존재하고, `for (const oi of mc.correctOriginalIndices) correctChoiceIds.push(await issueChoiceId(secret,row.id,oi))` 3줄 루프는 466-468 과 577-580 에 완전 동일 중복. input_type 디스패치와 MC-in-disguise 거부(422)도 두 핸들러 병렬 복제. 경계 강제(`exam_type='1st' AND status='active'`)가 두 곳에 손으로 박혀 있어, 서빙 자격 규칙 1건 변경 시 최소 2곳(overview/next 포함 시 4곳) 동기 수정 필요 — 한 곳 누락 시 채점이 조용히 어긋난다(정답 100% 불변 직격).

- 반론(Devil's Advocate): 핸들러가 별도 응답 계약(PublicGradeResult vs PublicRevealResult)·별도 AE 이벤트를 가져 '완전 동일 함수'는 아님. 다만 조회 블록·정답 choiceId 루프는 계약 무관 순수 중복이라 추출 가치 존속.
- Horizon: BE-1 보기추출 랜딩 또는 2차 공개 표면 추가 시점 (수주~수개월). 경계 규칙 1건 변경이 다중 지점 동기 수정을 요구하는 순간 오채점으로 발현.
- 권고: 조회·정답 choiceId 재발급·MC 계약 파싱을 파일 스코프 헬퍼 3종(`fetchGradableRow`/`reissueCorrectChoiceIds`/`parseMcOrRefuse`)으로 추출 → `/grade`·`/reveal`·`/next` 가 단일 정본 소비. 계약/이벤트 차이는 핸들러 잔류.

## REF-2 (MAJOR) — study/routes.ts God 모듈 (2242행 단일 파일, `/grade` 단독 ~519행)

- 파일: `apps/api/src/study/routes.ts`
- 라인: 798-2242 (createStudyRoutes 내 7 핸들러) 중 `/grade` 1019-1538

createStudyRoutes 하나에 7 라우트 핸들러 + 모듈 스코프 헬퍼 20여 개가 2242행 응집. `/grade` 는 519행 단일 함수(채점 타입 분기·FSRS·UPSERT·텔레메트리·출처 surface 적층). 라우트별 파일 분할·핸들러 내부 단계 추출 부재 → 멀티트랙(worktree) 병행 시 상시 머지 충돌 표면.

- 반론: 이번 diff 도입 부채 아닌 선재. 최근 변경은 오히려 parseMcChoices 를 packages/learning-modes 단일 정본으로 공유(순증 아님). 스코프를 최근 변경분으로 좁히면 MINOR 강등 가능. 그럼에도 519행 단일 함수는 어떤 기준으로도 장기 부채.
- Horizon: 6개월 유지보수 + 멀티트랙 병합 충돌 상시. Year 2 exams/ 분리 시 첫 해체 대상.
- 권고: 라우트별 파일 분리(`study/routes/{next,grade,mode,progress,session}.ts`) + `/grade` 내부를 채점 디스패치·진도 UPSERT·텔레메트리 3단 추출. M1 plan 과 시퀀싱.

## REF-3 (MINOR) — 공개 표면 전체가 exam_type='1st' 하드코딩

- 파일: `apps/api/src/public/routes.ts`
- 라인: 65-66 (FIXED_EXAM_TYPE/FIXED_STATUS), 사용처 248·301·401·541

공개 promo 라우터가 손해평가사 1차 전용으로 미파라미터화. exam_type 은 Rule 17 cross-exam 리터럴이 아니라 시험 내 스코프(→ 규칙 위반 아님, MINOR)이나 2호 전기기사가 동일 무인증 promo 표면을 원하면 610행 파일 통째 복제 대상.

- **★교차 병합: 본 발견은 backend BE-1(MAJOR)과 동일 file:line(public/routes.ts:65)·동일 근본증상(공개 표면 examId 미파라미터화)으로 INDEX 에서 BE-1 로 병합(MAJOR 승격). RC-1 진앙.**
- 반론: A안 멀티트랙은 종목별 exams/ + 서브도메인 격리 명시 → 종목별 독립 promo 라우터(복제) 설계상 허용 가능, 현재 소비자 1개라 조기추상화 YAGNI 소지.
- Horizon: Year 2 / 2호 promo 착수 시.
- 권고: 2호 promo 착수 결재 시 `createPublicRoutes(config:{examType,servableTypes})` 승격 + exams/{id} 어댑터 주입. 지금은 'Year2 어댑터 주입 대상' 주석만.

## REF-4 (MINOR) — overview/next 가 SERVABLE 조건 + 사후 isServable 필터 각자 인라인 조립

- 파일: `apps/api/src/public/routes.ts`
- 라인: 245-259(overview) vs 296-333(next)

두 핸들러 모두 status/exam_type 고정 + `input_type IN (...)` placeholder 전개 + 조회 후 `filter/find(isServable)` 동일 2단 패턴 반복. 서빙 자격 SQL 조건 증가 시 두 곳 동기 수정.

- 반론: overview 전건 집계 / next 단건 선택이라 공통화 시 분기 인자 발생. 규모 작음(각 ~15행), REF-1 조회 추출에 흡수 가능.
- Horizon: 낮음 — REF-1 해소와 함께 처리.
- 권고: `buildBaseServeWhere(filters)` 로 단일화(REF-1 리팩터와 묶음).

---

## checkedItems (증거 기반 PASS/N-A)

- PASS — Rule 17(examId 런타임 리터럴 단일선언): grep `son-hae-pyeong-ga-sa` 전 소스 = exam-ids.ts 외 매치는 vectorize/upserter.ts:7·exam-adapter.ts:20/22 JSDoc/주석뿐, 런타임 리터럴 0
- PASS — Rule 15(범용 계층 examId=== 분기): grep `examId ===` packages/formula-engine·parser·shared = 0건
- PASS — serving-guard.ts 삭제(b6f2a9f G-OLD-8 폐기) dangling 참조: grep `serving-guard|isMisgradableRow|servingGuard` = 0건, 죽은 import 없음
- PASS — choice-id.ts secret 해석 seam(D-22): resolvePublicChoiceSecret 단일 함수(41-43)로 3핸들러 통합, hmacKeyCache(60) evict 로직(69-72) 검증
- PASS — scripts/lib/public-analytics-reader.mjs(D-20): 순수 로직 + 오케스트레이터 분리, 102행 테스트, 복붙 0
- PASS — apps/web/scripts/deploy-lib.mjs(D-21): 순수 함수 + 입력검증 throw, 104행 테스트 커버
- PASS — streak-strip.ts(D-29): 단일 순회 통합 + NaN 방어(36), 68행 테스트 부여
- N/A — CF API 헬퍼 중복: read-public-analytics.mjs 단일 소비자, 2번째 소비자 등장 시 추출 후보로 carry
- 확인 — study/routes.ts God 모듈: 라우트 등록 7건 + 모듈 헬퍼 20여 + 2242행, /grade 519행 단일 함수 실측
