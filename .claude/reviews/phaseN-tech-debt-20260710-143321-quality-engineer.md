# Phase N 기술부채 리뷰 — quality-engineer (테스트 부채)

- 관점: "프로덕션에서 뭐가 물릴까?"
- 스코프: promo-1st P0~P5 테스트·게이트·계약 축
- 일시: 2026-07-10 14:33 (ts 20260710-143321)
- 발견: CRITICAL 1 / MAJOR 4 / MINOR 2

## CRITICAL

### QA-C1. @thepick/web 단위 테스트 전체가 CI 미배선 — 신규 공개 표면·로컬 진도(FSRS) 계층의 회귀 검출 부재

- 위치: `.github/workflows/ci.yml:56-69`
- 상세: CI 'Test (packages with tests)' 필터 목록(shared/formula-engine/parser/quality/batch/api/ai-adapter/admin-web/learning-modes/srs)에 @thepick/web 이 없다. apps/web/package.json:11 에 "test": "vitest run" 이 실재하고, P2~P4 에서 신설된 단위 테스트 — local-progress.test.ts(259줄: FSRS 전이 누적·KST 자정 경계·export/import 봉투 거부 = 학습자 데이터 정확성 직결), api.test.ts(에러코드→문구 매핑·오프라인 분류), rating.test.ts(FSRS rating 매핑), hangul-hint.test.ts, PublicQuestionCard.test.tsx — 전부 CI 에서 한 번도 실행되지 않는다. E2E job 은 Playwright 만 돈다(ci.yml:150). 이는 ci.yml:71 주석에 스스로 기록된 WS-0a 사고(learning-modes·srs 151 테스트 무음 미실행)와 정확히 동일 클래스의 재발이다.
- Devil's Advocate: 로컬 `pnpm test`(turbo run test)는 web 을 포함하므로 세션 규율이 지켜지는 한 잡힌다. E2E(public-practice.spec.ts)가 브라우저 수준 행위를 커버한다. 그러나 이 레포의 실증 이력이 반론을 기각한다 — 동일 필터 누락으로 151 테스트가 수 주간 무음 미실행이었고, 멀티트랙(Opus/Sonnet/Fable 교대) 체제에서 로컬 전수 실행 규율은 세션마다 보장되지 않는다. E2E 는 mock 기반이라 rating/export-import/KST 경계 로직을 관통하지 않는다.
- Horizon: 런칭 스프린트 중 /practice/·로컬 진도 반복 수정 — 수주~3개월 내 무음 회귀 병합
- 권고: ci.yml 테스트 스텝에 `--filter @thepick/web` 1줄 추가. 근본책: 필터 열거 대신 `pnpm -r --if-present test`(또는 turbo) 로 전환해 신규 패키지 자동 포섭 — 동일 클래스 3차 재발 차단.

## MAJOR

### QA-M2. 정답 교정 36건의 영속 기계 게이트 부재 — 교정 지식이 1회성 빌드 스크립트+문서에만 존재

- 위치: `docs/batch-load/promo-mc-distractors/answer-corrections.json:1-15 (_meta)`
- 상세: 공식 정답 불일치 36건의 교정 정본은 answer-corrections.json 이고, 소비자는 build-mc-inserts.ts(1회성 SQL 생성) 뿐이다. production -MC 행이 교정값과 일치하는지의 검증은 2026-07-10 수동 wrangler 검산 1회(REPORT.md §6)로 끝났다. 반면 old 행 36건은 오답인 채 status='active' 로 잔존하며(incident-1st-answer-errors-20260710.md §3), 방어선은 런타임 가드 2곳(public isServable + study serving-guard)뿐이다. 인시던트 §5 가 예고한 old 행 정정 L3 마이그의 선택지 (A)는 0004/0038 트리거의 answer UPDATE 화이트리스트 예외를 뚫는 것인데, 그 순간 '트리거가 불변을 보장한다'는 현 전제가 소멸한다. d1-schema-drift.yml 은 스키마 축만 감시하고 정답 데이터 무결성 축 게이트는 0 이다. 36건이 애초에 들어온 근인도 '적재 시점 정답지 대조 게이트 부재'(인시던트 §5.3)였다 — 같은 공백이 교정 유지 단계에서 반복되고 있다.
- Devil's Advocate: 0004 전면 UPDATE ABORT 하에서 D1 행은 사실상 불변이므로 마이그 없이는 드리프트가 물리적으로 불가능하고, 마이그는 L3 인간 결재 게이트를 거친다. 강등 가능성 있음. 반론의 반론: 그 마이그가 바로 answer 를 만지는 마이그이며, 결재자가 참조할 기계 검증(교정표 대비 assert)이 없으면 검산은 다시 수동·기억 의존이 된다. BE-1(보기 추출) 이 old 행 계열에 distractors 를 채우는 순간 serving-guard 의 차단 전제(parseMcChoices 불능)도 무너진다.
- Horizon: old 행 정정 상태머신 마이그 실행 시 또는 BE-1 보기 추출 트랙 진입 시 (1차 단독 서비스 갭 3 중 하나 — 수개월 내)
- 권고: d1-schema-drift 패턴을 복제한 answer-integrity 검증 스크립트 신설: answer-corrections.json 을 정본으로 (a) `{id}-MC` 행 answer = corrected 36/36, (b) 제외 4건 -MC 부재, (c) mc_total=521 워터마크를 remote SELECT 로 assert. old 행 마이그 plan 의 Binary Gate 에 이 스크립트 PASS 를 선결 조건으로 명기.

### QA-M3. 공개 API 계약의 이원 수작업 정의 + E2E 수기 mock — 계약 드리프트가 전 테스트 green 인 채 진행 가능

- 위치: `apps/web/src/components/public/types.ts:8-69`
- 상세: 공개 표면 응답 shape 이 두 곳에서 독립 수작업 정의된다: apps/api/src/public/routes.ts:81-92(PublicNextQuestionOut 등 인라인) vs apps/web/src/components/public/types.ts(learning-modes 에서 InputType 만 import, 나머지 수기 복제). 웹 단위 테스트는 fetch 전면 mock(api.test.ts:10-17), E2E 는 수기 mock 서버(mock-api.ts:125-128, `pub-{i}-cid-2` 규약 창작)라서 API 가 필드를 개명·의미 변경(예: explanation 생략 규칙, correctChoiceIds 정렬)해도 웹 측 테스트는 전부 green 을 유지한다. 실 계약 관통 검증은 수동 스모크 1개뿐. 이 레포는 동일 기전의 실증 전례가 있다 — 'web E2E 전체 15건이 S2(wired 도입)부터 파손(mock 픽스처 미갱신)' (CLAUDE.md 06-12 갱신). 그때는 시끄럽게 깨졌지만, 더 나쁜 모드는 mock 이 stale 인 채 조용히 통과하는 것이다.
- Devil's Advocate: 공개 API 는 의도적으로 좁고(4 엔드포인트) 홍보용이라 진화 빈도가 낮을 수 있으며, TypeScript 구조적 타이핑이라 shape 차이는 소비 지점 컴파일 에러로 일부 잡힌다. 강등 가능성 있음. 반론의 반론: 컴파일은 web 쪽 '자기 선언'과의 정합만 검사하지 서버 실응답과는 무관하고, 2호 전기기사 확장 시 이 표면이 종목 파라미터화되며 반드시 진화한다(examType 고정 해제 등).
- Horizon: 6개월 — 2호 확장·BE-1 승급으로 공개 API 계약이 진화하는 시점
- 권고: 공개 응답 타입을 packages/shared(또는 learning-modes)로 단일 정본화해 api·web 양쪽이 import. 차선: apps/api 라우트 테스트의 실응답 JSON 을 스냅샷으로 export 하고 web 테스트가 동일 픽스처를 소비하는 계약 픽스처 공유.

### QA-M4. 배포 스모크 게이트가 관례 전용 — smoke-public-surface.mjs 가 어떤 자동 파이프라인에도 미배선

- 위치: `scripts/smoke-public-surface.mjs:1-17`
- 상세: P5 blocking 게이트로 설계된 스모크(정답 비노출·캐시 헤더·경계 404 등 14 체크)가 package.json 스크립트·turbo·CI 어디에도 등록돼 있지 않다(grep 0건 — 루트/api/web package.json, turbo.json, .github/). api 배포는 수동 wrangler 이고 Git 자동배포가 없으므로, 다음 배포자가 이 스크립트의 존재를 기억해야만 실행된다. 07-10 배포는 커밋 메시지(d2d04b5)로만 '스모크 14/14' 가 증빙된 1회성 이벤트다. 멀티트랙 체제(Fable/Opus 교대·2호 worktree 병행·동시 deploy 금지 규율)에서 '기억 의존 게이트' 는 정확히 새벽 배포 1회 누락으로 무효화된다.
- Devil's Advocate: 배포 자체가 진산 인증 게이트 뒤의 저빈도 수동 행위이고, 배포 기록 문서에 스모크가 체크리스트로 존재한다. devops 페르소나 소관과 중첩될 수 있음(→ INDEX 에서 DO-m5 와 병합). 강등 여지 있으나, '정답 비노출' assert 를 포함한 스모크라 정답 안전 축 소관이 맞다 — 서빙 projection 회귀(answer 필드 유출)는 배포 후에만 실물 검증 가능하다.
- Horizon: 다음 wrangler deploy 를 다른 세션/모델이 수행하는 첫 회 (수주~수개월)
- 권고: 루트 package.json 에 `smoke:public` 스크립트 등록 + apps/api deploy:production 스크립트를 `wrangler deploy && node scripts/smoke-public-surface.mjs <URL>` 체인으로 재정의(실패 시 exit 1 로 배포 세션에서 즉시 시끄럽게). 배포 플레이북 체크리스트에도 명기.

### QA-M5. choiceId HMAC secret 회전 시 무음 오채점 — resolve 실패의 텔레메트리·테스트 0

- 위치: `apps/api/src/public/routes.ts:436-448`
- 상세: choiceId 는 HMAC(secret, qId:index) 무상태 스킴(choice-id.ts:57-81)이라 서빙~채점 사이에 JWT_SECRET 이 회전(또는 미설정 폴백 상수 ↔ 실키 전환, choice-id.ts:32,44)되면 제출 choiceId 가 resolve 불가 → submittedIndex=null → isCorrect=false 로 조용히 처리된다(routes.ts:443). 정답을 고른 학습자가 '오답' 판정을 받고, 재발급된 correctChoiceIds 는 새 secret 기준이라 화면의 어떤 보기와도 매칭 안 돼 정답 하이라이트도 실패한다. resolve null 은 위조와 구분되는 어떤 이벤트도 기록하지 않아(grade defect 이벤트는 MC 계약 위반만, routes.ts:428) 사후 진단이 불가능하고, 테스트는 위조 거부(routes.test.ts:234-242)만 있고 secret 불일치 시나리오는 없다. 런칭 차단 과제([[project_test_autologin_launch_blocker]])가 env 재정비를 예고하고 있어 JWT_SECRET 최초 설정/회전은 예정된 사건이다.
- Devil's Advocate: 영향 창은 회전 시점에 서빙돼 있던 in-flight 문항뿐(분 단위)이고, 무인증 홍보 표면이라 새로고침으로 자가 복구된다. MINOR 강등 여지 실재. 다만 '정답 100% 정확성' 계약은 학습자 관점 판정 기준이고, 텔레메트리 0 이라 '간헐 오채점' 신고가 들어와도 영구 재현 불가 미스터리로 남는다 — 진단 불능성이 심각도를 지탱한다.
- Horizon: JWT_SECRET 최초 설정·회전 시점 = 런칭 직전 보안 하드닝 스프린트
- 권고: resolveChoiceId null 시 AE defect 이벤트(reason: choice_id_unresolved) 기록 + 응답을 isCorrect=false 대신 410/422 '문항 갱신됨, 다시 서빙' 으로 구분(프론트는 자동 재서빙). secret 불일치 회귀 테스트 1건 추가.

## MINOR

### QA-m6. old 525 + -MC 521 이원 행 공존의 데이터 불변식(워터마크) 테스트 부재 — 미래 집계·감사 분모 오염

- 위치: `docs/batch-load/promo-mc-distractors/REPORT.md §6-§7`
- 상세: 동일 문항이 exam_questions 에 old 행과 `{id}-MC` 행으로 이중 존재한다(둘 다 status='active'·exam_type='1st'). 서빙 경로 2곳은 가드로 old 를 배제하지만, 그 외 소비자 — 관리자 집계, 진도율 분모, E0-8 류 커버리지 감사(545 기준 수치가 다수 문서에 박제), 향후 G-S5 골든 확장, distractor BATCH — 는 1,046 행을 이중 카운트하거나 old 행(오답 36 포함)을 무심코 표본화할 수 있다. '-MC 행 521 = well-formed·old 무접촉 525' 불변식이 1회 검산으로만 존재하고 영속 테스트(N=12 워터마크 영속과 같은 기존 패턴)가 없다.
- DA: old 행 처분 L3 plan(옵션 C = -MC 정본화 + old 재분류)이 곧 이 이원 상태 자체를 해소할 예정이라 과도기 부채일 수 있다. 학습자 노출 경로는 이미 전부 가드됨. 그래서 MINOR — 단 plan 이 지연되면(결재 큐 적체 이력상 개연성 있음) 과도기가 반년을 넘길 수 있다.
- 권고: QA-M2 의 answer-integrity 스크립트에 이원 행 워터마크(old=525·MC=521·id LIKE '%-MC' 전단사) assert 를 동봉하고, 문항 수를 소비하는 신규 쿼리 작성 시 '-MC 이원 행' 각주를 batch-loadmap 정본에 명기. (Horizon: 3~9개월)

### QA-m7. SERVE_CANDIDATE_LIMIT=10 하 결함행 밀집 버킷의 확률적 404 — 테스트가 5회 반복 관측으로만 커버(비결정)

- 위치: `apps/api/src/public/routes.ts:156, 310-333`
- 상세: /questions/next 는 RANDOM() LIMIT 10 후보 중 첫 isServable 행을 고른다. 특정 subject×round 버킷에 결함행이 10개 초과 밀집하고 유자격 행이 소수면, 유자격 행이 존재함에도 요청별 확률적 404(NO_QUESTION)가 발생한다. 현 데이터(MC 521 전량 유자격)에선 무해하나, 미래 BATCH 가 결함행을 대량 유입하면(36건 사태가 보여준 개연성) 간헐 404 = 재현 불가 신고 클래스가 된다. 기존 테스트(routes.test.ts:161-183)는 결함 1+유효 1 시드 5회 반복이라 이 경계(결함>10)를 커버하지 않는다.
- DA: 요청마다 RANDOM 재추첨이라 사용자는 재시도로 자가 복구되고, 결함행 대량 유입 자체가 빌드 게이트 V1~V5 로 선차단된다 — 이중 방어 뒤의 3차 시나리오라 MINOR 가 정당하며 WON'T FIX 도 방어 가능.
- 권고: 결함행 11+유효 1 시드로 다수 요청 중 200 도달을 확인하는 경계 테스트 1건 또는 isServable 탈락 시 후보 재조회 1회 폴백. 후순위. (Horizon: 6개월+)

## 검증 증거 (checkedItems)

- PASS — apps/api/src/public/**tests**/routes.test.ts:1-449: 공개 표면 서빙·채점·reveal·overview 를 실 SQLite+마이그레이션 위에서 통합 검증(정답 비노출 projection, 2차/flagged 경계 회귀 2건, MC-in-disguise 서빙·채점·reveal 거부, 복수정답, choiceId 위조 거부) — mock 아닌 실 DB 계약 테스트
- PASS — scripts/promo-p3/build-mc-inserts.ts:128-176,335-345: 교정 오버레이 fail-loud 사전조건(파일 부재·pending 잔존·confirmed 불일치·교정∩제외 겹침·id 중복 throw) + V5 고아 검출(오타 id 무음 미적용 차단) — 1회성 게이트로서는 모범
- PASS — apps/api/src/study/**tests**/routes.test.ts:2166-2240: C-1 서빙 가드 인증 표면 회귀 4건(old 행 서빙 제외·유자격 0 정직 exhausted·old 행 채점 422·-MC/2차 텍스트 정답 비대상) 실 DB 검증
- PASS — apps/api/src/study/serving-guard.ts:31: GUARDED_EXAM_TYPES 1차 한정의 근거가 주석에 실측(무분별 적용 시 2차 계약 테스트 37건 파손)으로 명문화 — 휴리스틱 오차단 방지
- PASS — apps/web/src/lib/**tests**/local-progress.test.ts:40-331: FSRS 전이 누적·스트릭 3분기·KST 자정 경계·export/import 왕복·오염 봉투 의미 검증(Infinity/음수/중복 cardId) — 내용은 충실 (단 CI 미배선 = QA-C1)
- PASS — apps/web/src/lib/**tests**/hangul-hint.test.ts + rating.test.ts: 힌트 사다리 순수함수·FSRS rating 매핑 단위 테스트 존재 ('easy'는 자평 전용 = 자동 채점 과대 간격 방지 설계 확인)
- PASS — apps/api/src/public/rate-limit.ts:26-27: 바인딩 미설정 시 auth 와 동일 fail-open(dev)/fail-closed(prod) 정책 재사용 — 무음 무제한 스크래핑 경로 없음
- PASS — apps/web/e2e/public-practice.spec.ts: 랜딩 임베드·4지선다·빵꾸노트 힌트 플로우 E2E 존재 + mock 호출 카운터로 실 소비 확인 (단 수기 mock = QA-M3 의 드리프트 표면)
- PASS — scripts/smoke-public-surface.mjs:34-97: 스모크 자체는 정답 비노출·캐시 헤더·경계 404 까지 14 체크로 잘 설계됨 (배선 부재만 문제 = QA-M4)
- N/A — gradeFillBlank 복수 정답/유의어 미지원: packages/learning-modes 선재 설계로 이번 변경분 아님 — 신규 부채로 미계상
- N/A — cryptoShuffle modulo bias(routes.ts:137-141): 4지 표시 순서 편향은 이론상 존재하나 채점 무관(choiceId 기반)·체감 불가 — 4-Pass 급 지적으로 분류 제외
- 확인 — .github/workflows/ci.yml:56-69 필터 목록에 @thepick/web 부재 실측 (apps/web/package.json:11 test 스크립트 실재 대조) = QA-C1 증거
- 확인 — .github/workflows/d1-schema-drift.yml: 드리프트 게이트는 스키마 축(sqlite_master)만 — 정답 데이터 무결성 축 게이트 부재 = QA-M2 보강 증거
- 확인 — apps/api/src/public/choice-id.ts:32,44 폴백 상수 + routes.ts:436-448 resolve null → isCorrect=false 무기록 경로 = QA-M5 증거
