# 4-Pass 독립 리뷰 — Session 098 미커밋·라이브배포 변경셋

- 리뷰 일시: 2026-06-06 08:20:05 (ts=20260606-082005)
- 리뷰 방식: 독립 에이전트 5개(scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
- 확정 발견(반증 통과분만): **CRITICAL 0 / MAJOR 1 / MINOR 8**

## 리뷰 스코프

**변경 파일 (4):**

- `apps/web/src/components/AuthForm.tsx`
- `apps/web/src/pages/status.astro`
- `scripts/measure-s5-6-multihop-accuracy.ts`
- `apps/api/src/eval/multihop-accuracy.ts`

**연관 파일 (10):**

- `apps/web/src/pages/auth/login.astro`
- `apps/api/src/auth/routes.ts`
- `apps/web/src/lib/study-api.ts`
- `apps/web/src/components/QuestionCard.tsx`
- `apps/api/src/search/graph-search-route.ts`
- `apps/api/src/search/user-search.ts`
- `apps/api/src/search/graph-walk/index.ts`
- `apps/api/src/eval/__tests__/measure-runner.test.ts`
- `apps/api/src/eval/__tests__/multihop-accuracy.test.ts`
- `docs/plans/s5-6-measurements/golden-pilot-approved.querybody.json`

**변경 요약:** Session 098 미커밋·라이브배포된 코드변경 3건(+리포트텍스트 1건).
(1) `AuthForm.tsx`: `PUBLIC_TEST_AUTOLOGIN=1` 게이트 테스트 자동로그인 useEffect — env 미설정 시 early-return no-op, `PUBLIC_TEST_EMAIL`/`PASSWORD` 로 `/api/auth/login` 자동 POST(credentials include), 성공 시 `resolveNext()` 리다이렉트, cancelled 레이스가드, 실패/예외 시 `setPhase('idle')` 수동폼 폴백. 서버 인증 불변.
(2) `measure-s5-6-multihop-accuracy.ts`: `--maxDepth` 인자(정규식 정수검사+1..4 route 계약 범위 fail-loud, 무음 clamp/절단 차단) + `fetchGraphWithRetry`(5xx backoff 재시도·4xx 즉시 fail-loud·소진 fail-loud·stderr 로깅, ADR-008 800ms 504 흡수, 채점본문 불변) + maxDepth coverage provenance.
(3) `status.astro` URL 정정(thepick-web→thepick-study, trivial).
부수: `eval/multihop-accuracy.ts` 는 리포트 출력 텍스트만 변경(mean-recall@5 헤드라인 격상 + hit-rate 단독해석 경고), 채점/집계 로직 불변.

---

── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 5개(scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 4개 + 연관 파일 10개 (위 스코프 목록)

### Pass 1 (Surgeon): ✅ 15건 확인 / 🔴 0건 / 🟠 0건(MINOR 3) / N/A 4건

**관점: "이 코드 단독으로 터지는 경로가 있는가?"**

확인:

- PASS Null/Undefined — `AuthForm.tsx:134` autologin env 가드(`auto!=='1' || tEmail===undefined || tPassword===undefined → return`), `183-184` `errBody?.error ?? 'UNKNOWN'` 옵셔널 체이닝, `multihop-accuracy.ts:52-54` relatedNodesJson null/undefined/'' → `{ids:[],malformed:false}` 명시 처리 — null 크래시 경로 없음
- PASS D1 `.first()` null 크래시 — N/A·확인: 변경 파일에 `.first()` 호출 0건. `user-search.ts:482`/`graph-walk/index.ts:262` 는 `.all()` 사용 + `result.results ?? []` 폴백(`user-search.ts:483`, `graph-walk:263`) — 빈 결과 안전 처리 확인
- PASS Async await 누락 — `measure-runner.ts:194` `await fetchGraphWithRetry`, `:131` `await fetch`, `:136` `await r.json()`, `AuthForm.tsx:139` `await fetch` / `:183` `await res.json().catch` — 모든 Promise 반환에 await 확인. `graph-search-route.ts:177` `await embedQuery`, `:178` `await searchKnowledgeNodesForUser`, `:231` `await graphWalk` 확인
- PASS 빈 catch 금지 — `AuthForm.tsx:152` `catch{ if(!cancelled) setPhase('idle') }` 비어있지 않음(폴백 로직), `:183` `.catch(()=>null)` 의도적 null 폴백(주석 명시), `measure-runner.ts:231` catch 에 stderr 로깅+exitCode=1, `multihop-accuracy.ts:58` catch→`{ids:[],malformed:true}`(silent 아님, 호출측 집계) — 무음 삭제 0건
- PASS 경계값 빈 배열/음수 — `measure-runner.ts:83` `--limit n<=0` throw, `:92-102` `--maxDepth` 정규식+1..4 범위 throw(무음 clamp 차단), `multihop-accuracy.ts:133` `expected.length===0` → unmeasurable 분모 제외, `:199` `measured===0` → 0 폴백 버킷, `graph-walk/index.ts:149-155` clampInt min/max 가드 확인
- PASS NaN 가드 — `user-search.ts:341-342` buildHit 의 `Number.isFinite(rawTruthWeight)?...:0` 폴백(graph 확장 NaN truth_weight 정렬 불능 차단), `AuthForm.tsx:25` `!Number.isFinite(parsed)` 폴백, `:96` formatRateLimitMessage `Number.isFinite` 가드 — 산식 NaN 전파 차단 확인
- PASS 에러 처리 fail-loud — `measure-runner.ts:139-141` 4xx 즉시 throw / `:143-149` 5xx backoff 재시도 / `:151-154` 소진 throw, `graph-search-route.ts:290-342` typed 에러 분기 후 unhandled 는 로깅 후 rethrow(`:342`) — 빈 결과 은폐 0, fabricate 차단 확인
- PASS Graceful Degradation 임계 — `user-search.ts:36` `STAGE1_VECTOR_RECALL_MIN_SIMILARITY=0.6`, `:39` `ADR_008_GRACEFUL_THRESHOLD=0.6`, `:242` `top1Score<0.60→gracefulDegradation true` — 유사도<0.60 거부 정합(변경 파일이 이 로직 미수정) 확인
- PASS 산식 정밀도/numeric_value 혼용 — N/A: 변경 3파일(AuthForm/status.astro/multihop report-text)에 산식 연산 0건. `multihop-accuracy.ts:228-231` hit-rate=bHit/measured 단순 분율(부동소수 누적 없음), 테스트 `toBeCloseTo(...,10)` 통과 확인
- PASS Formula Engine 동적 실행 — N/A·확인: 변경 파일에 eval/Function/math.js 호출 0건. measure-runner.ts 는 fetch IO + JSON.parse 만, multihop-accuracy.ts 는 Set/Map 집계만 — 동적 코드 실행 표면 없음
- PASS report-text 변경 무해성 — `multihop-accuracy.ts:351-359` 판정기준 문자열 4줄 추가(mean-recall@5 헤드라인 격상 + hit-rate 단독해석 경고). scoreQuestion/aggregate/buildBucket 채점·집계 로직 byte-unchanged(git diff 확인). 골든 테스트 `multihop-accuracy.test.ts:177-185` 워터마크만 assert → 22 tests PASS 실측
- PASS 타입 안전성 any 0건 — API `tsc --noEmit` exit 0 / WEB `tsc --noEmit` exit 0 실측. requestBody `{examId;query;topK;maxDepth?}` 가 route GraphSearchBodySchema(`graph-search-route.ts:77-89`)와 구조 호환 확인
- PASS golden querybody JSON 정합 — 6 items 전부 content.length<500(node 실측: 76/336/192/181/270/398) → route query.max(500) 통과, excludedStillOver500=[Q-2025-11-2ND-004](items 미포함), measurementSubset 'measurable 6' 일관 확인
- PASS status.astro 변경 — `:98-99` thepick-web→thepick-study URL 문자열만(href+span.url 2곳), 로직/스크립트 0 — trivial 텍스트 확인
- PASS connected files 회귀 — `QuestionCard.tsx:91/130` fetch 401→redirectToLogin 경로, `study-api.ts:53-64` safeFetch StudyApiError 분류, `login.astro:1-11` AuthForm client:load — 이번 변경(autologin)이 이들 정상 경로 불변(AuthForm 신규 effect 는 additive) 확인
- PASS 테스트 게이트 — `pnpm --filter @thepick/api test src/eval`: 2 files / 22 tests PASS(measure-runner 6 + multihop-accuracy 16). G-6a-1 결정성/G-6a-3 손계산/G-6a-5 자격증명 게이트 전부 green 실측

반론(Devil's Advocate):

- **MINOR (Surgeon)** — `AuthForm.tsx:130-159` autologin useEffect 의 fetch 에 `AbortSignal.timeout` 부재. env 충족 시 `setPhase('submitting')`(136) 후 fetch(139)를 await 하는데, 응답이 resolve/reject 안 하고 _영구 pending_(프록시 hang, keep-alive 무응답)이면 submit 버튼(268 `disabled=phase==='submitting'`)이 영구 비활성 → 수동 폼 진입 불가. 일반 handleSubmit 에도 동일 timeout 부재이나 autologin 은 진입 즉시 자동 발화라 표면이 더 넓다. **반증**: 브라우저 fetch 는 OS/네트워크 스택 레벨에서 결국 TCP 타임아웃으로 reject 되므로 '영구' pending 은 실무상 드물고, env 미설정 production 에서는 line134 early-return 으로 no-op → 정식 사용자 도달 불가. 테스트 환경 편의 한정 ⇒ MINOR 유지.
- **MINOR (Surgeon)** — `AuthForm.tsx:145-153` 자동로그인 실패/실패분기 set-state 가 cancelled 단일 가드(145) 직후라 현 구조 무해하나, React 18 StrictMode dev 이중 마운트 시 첫 effect cleanup(cancelled=true) 후 두 번째 effect 가 새 fetch 재발사 → dev 에서 `/api/auth/login` 2회 POST(login_history 2행) 가능. **반증**: production Astro 빌드는 StrictMode 기본 비활성(개발 전용)이라 이중 POST 는 dev 한정이고, 서버 login 은 멱등(재로그인=세션 쿠키 재발급)이라 데이터 손상 없음 ⇒ MINOR 유지.
- **MINOR (Surgeon)** — `measure-s5-6-multihop-accuracy.ts:60-65` `MAX_DEPTH_CEILING=4` 가 route `MAX_ALLOWED_DEPTH`(graph-walk/index.ts:79)의 물리적 사본. desync 시 worst case 는 '측정 거부'(안전측 실패)지 잘못된 수치 산출 아님. `fetchGraphWithRetry`(139-141)가 4xx(route 400 거부)를 즉시 fail-loud → fabricate 차단. **반증**: 러너는 별 패키지라 import 가 빌드 경계 복잡도를 늘릴 수 있고 권위 게이트가 route 자신이므로 안전성 유지 ⇒ MAJOR 아님, MINOR 유지.

### Pass 2 (Architect): ✅ 18건 확인 / 🔴 0건 / 🟠 0건(MINOR 2) / N/A 1건

**관점: "이 코드가 다른 모듈과 만나면 터지는가?"**

확인:

- PASS Import 방향 단방향 — `scripts/measure-s5-6-multihop-accuracy.ts:32-41` 가 `apps/api/src/eval/multihop-accuracy.js`(순수 코어)·`@thepick/shared` 만 import. 역방향(eval 코어가 runner import) 0건: `grep 'measure-s5-6-multihop' apps/ packages/` → 0건 = 어떤 모듈도 runner 를 import 하지 않음(remote-only 격리 주석 사실 확인)
- PASS Workers 제약(fs/path 금지) — `apps/api/src/eval/multihop-accuracy.ts` 전수: node:fs/node:path/network import 0건, 순수 함수만(parseRelatedNodes/scoreQuestion/aggregate/format/assertRemoteMeasurementInputs). fs/path 는 runner(scripts/, Node 전용, `measure-runner.test.ts:28-29` in-process 검증)에만 격리 → Worker 번들 안전
- PASS Workers CPU 상한 — `graph-walk/index.ts:79` `MAX_ALLOWED_DEPTH=4`(D-2 실측 depth4=41.5ms<free50ms), `:80` `MAX_ALLOWED_RESULT_CAP=500`, `route:75` `GRAPH_SEED_WALK_LIMIT=5`; runner `--maxDepth 1..4`(scripts:98) 가 이 상한 내로 강제 → 측정이 CPU 예산 위반 요청 불가
- PASS runner↔route 응답 계약 일치 — GraphSearchResponseShape(`multihop-accuracy.ts:85-89`: baseline.results/graphExpansion.applied/truncated/results) 가 route 실제 응답(`graph-search-route.ts:201-208,280-287`)의 부분집합. scoreQuestion 이 소비하는 필드 전부 route 가 제공 확인
- PASS topK 계약 — runner requestBody topK:5(scripts:190) ≤ route `MAX_RESULT_TOP_K=10`(user-search.ts:54, route schema:80). route results=merged.slice(0,baseline.topK) 로 5건 반환 → scoreQuestion expected 채점과 정합
- PASS query ≤500 계약 — route GraphSearchBodySchema query.max(500)(`graph-search-route.ts:79`). golden 6문항 content 길이 76/336/192/181/270/398 전부 ≤398 (python3 측정) → 400 거부 없음. golden measurementSubset 주석('≤500 measurable')과 일치
- PASS maxDepth 계약 desync 안전 — runner `MAX_DEPTH_CEILING=4`(scripts:65) 가 route `MAX_ALLOWED_DEPTH=4`(graph-search-route.ts:86) 사본. 주석(scripts:60-63)이 desync 가능성을 known-MINOR 로 명시하고 route 가 권위 게이트(>4→400)임을 보장 → 사본이 틀려도 측정은 안전 거부
- PASS retry 의미론 — fetchGraphWithRetry(scripts:124-155): 5xx 재시도(504 timeout=ADR-008 800ms flaky / 500 deterministic 도 4회 후 fail-loud), 4xx 즉시 throw. route 상태코드 매핑 확인: 504(user-search.ts:149 timeout), 500(기타), 400(graph-walk input err·validation), 429(rate-limit). 재시도 소진 시 빈결과 삼킴 없이 throw(scripts:152)
- PASS 빈 catch / fail-loud — `graph-search-route.ts:290-343` catch 가 빈 catch 아님(GraphWalkError/UserSearchError 분기 로깅 + 미지정 err 는 logger.error 후 rethrow:342). `user-search.ts:484-488`·`graph-walk:264-267` 모두 cause 보존 throw. `AuthForm.tsx:152` catch 는 빈 catch 아닌 setPhase('idle') 폴백(테스트 자동로그인 graceful)
- PASS eval 코어 변경이 채점 로직 불변 — git diff `apps/api/src/eval/multihop-accuracy.ts`: formatReportMarkdown 마크다운 헤드라인 텍스트만 변경(판정기준 §2→§2+감사§5#6, hit-rate 단독해석 경고 추가). scoreQuestion/aggregate/buildBucket 무변경. 회귀 검증: `pnpm test src/eval` → 22/22 PASS
- PASS truth_weight 정렬 단일 진실원 — compareByTruthWeightThenScore(`user-search.ts:330-333`) 가 정상 Stage3 + graph 경로 공유. `graph-search-route.ts:269` merged.sort(compareByTruthWeightThenScore) = 2차 정책 생성 없음(CO-3). buildHit:341-342 Number.isFinite 가드로 NaN truth_weight 정렬불능 차단
- PASS Temporal Graph(UPDATE 금지) — 본 스코프 변경 파일 중 knowledge_nodes/edges UPDATE 0건. graph-walk SQL(`index.ts:224-247`)·user-search fetchApprovedNodes(`:472-476`) 전부 SELECT(read-only). status 도출은 status_transitions 최신 레코드 기반(approved-nodes-sql 단일 진실원), is_current_active=1 필터로 SUPERSEDES 폐기노드 자동 배제
- N/A Ontology Lock — 본 스코프는 신규 노드/엣지 ID 생성 0건(측정 harness·인증 UI·status URL). golden relatedNodesRaw 의 ID(LAW-002,INS-08,F-103 등)는 기존 exam_questions.related_nodes 추출본이지 신규 생성 아님 → ontology-registry 등록 의무 비해당
- PASS i18n 하드코딩 — 본 프로젝트는 i18n 키 체계 미도입(검색 시 i18n 인프라 부재), 한국어 직접 노출이 현 표준. AuthForm.tsx/QuestionCard.tsx/status.astro 한국어 문자열은 기존 패턴과 동일 = drift 아님. 단 carry-over 항목(memory project_launch_legal_bundle_deferred 정합)
- PASS AuthForm 자동로그인 통합 안전 — `AuthForm.tsx:130-159`: env 게이트(auto!=='1'||tEmail/tPassword undefined → early return no-op)가 setPhase 앞에 위치(`:134`), cancelled 레이스가드(`:135,145,153`), 실패/422 시 setPhase('idle') 수동폼 폴백. 서버 인증 불변(manual submit 과 동일 `/api/auth/login` POST credentials:include). resolveNext(`:106-113`) open-redirect 가드(//·non-/ 거부) 유지. production launch 시 env 미설정 = 트리쉐이크 no-op
- PASS cross-origin 쿠키 흐름 — autologin POST 가 API_BASE(workers.dev)로 credentials:'include'. 서버 authCookieSameSite(`routes.ts:699-707`) production='None'+Secure 반환 → cross-site(pages.dev↔workers.dev) 쿠키 정합. 신규 계약 아님(기존 manual login 과 byte-동일 경로)
- PASS QuestionCard 401/422/429 분기 — `QuestionCard.tsx:92-101,136-161` 가 401→login redirect, 429→안내, 422 QUESTION_HAS_NO_ANSWER 분기, 빈 choices(`:254,278`) graceful alert. study-api.ts fromHttp(`:43-51`) 상태코드→kind 매핑 일관. 본 스코프 무변경 연관파일이나 누적검증 PASS
- PASS 측정 fabricate 차단 게이트 — assertRemoteMeasurementInputs(`multihop-accuracy.ts:283-300`) env THEPICK_API_BASE+golden 둘 다 필수, 미충족 명시 throw. `measure-runner.test.ts:204-222` G-6a-5 가 이 가드 검증(3 케이스 PASS). runner(scripts:163-166)·테스트가 동일 순수 가드 공유 = 게이트 정책 drift 0
- PASS golden 파일 구조 계약 — golden-pilot-approved.querybody.json items[].{questionId,content,relatedNodesRaw} 가 runner GoldenFile 인터페이스(scripts:46-50)와 일치. relatedNodesRaw JSON string[] 형식이 parseRelatedNodes 계약(`multihop-accuracy.ts:51-66`) 정합. examId 키 부재 시 EXAM_IDS 폴백(scripts:168) — Hard Rule 17 EXAM_IDS 경유 확인

반론(Devil's Advocate):

- **MINOR (Architect)** — `status.astro:200` 자기참조 주석이 존재하지 않는 파일(`apps/web/public/status/index.html`)을 가리킴. 실제로 `/status/` 는 본 status.astro 가 렌더하며 public/status/index.html 은 부재(find/ls 확인). 이번 URL 정정과 무관한 기존 드리프트지만 동일 파일 수정으로 누적검증 대상(규칙1). **반증**: astro 는 src/pages/status.astro 를 dist/status/index.html 로 빌드하지 public/ 로 복사하지 않음 → 런타임에도 해당 경로 부재, 주석은 사실과 불일치. 동작 무관 ⇒ MINOR 유지.
- **MINOR (Architect)** — `measure-s5-6-multihop-accuracy.ts:138-141` 가 route 429(rate-limit)를 비재시도 4xx 로 즉시 fail-loud → 측정 중도 abort 가능. 429 는 의미상 transient(Retry-After:60, `graph-search-route.ts:128-130`)라 5xx 백오프가 더 정합. **반증**: production `SEARCH_RATE_LIMITER_IP`=300/60s(`wrangler.toml:160-161`)이고 현 golden measurable=6(워터마크 12) << 300 이라 실질 트립 불가 → 현 측정 시나리오 차단 아님, 설계상 robustness 갭일 뿐 ⇒ MINOR 유지(carry-over).

### Pass 3 (Advocate): ✅ 13건 확인 / 🔴 0건 / 🟠 1건(MAJOR) + MINOR 1 / N/A 2건

**관점: "수험생과 공격자, 둘 다 만족하는가?"**

확인:

- PASS 에러 UX(기술에러 노출 차단) — `AuthForm.tsx:52-59` ERROR_MESSAGES 코드맵 + `70-104` extractValidationMessage/formatRateLimitMessage 가 422 issues·429 Retry-After 를 사용자 친화 한국어로 변환, `196` fallback `요청 실패 (HTTP ${res.status})` — raw stack/SQL 미노출. `QuestionCard.tsx:147-160` 422 QUESTION_HAS_NO_ANSWER → '정답이 등록되지 않았습니다' graceful
- PASS 상태표현(로딩/빈데이터/에러/exhausted) — `QuestionCard.tsx:208-218` loading role=status, `220-237` error role=alert+재시도, `239-248` exhausted 빈상태, `278-285` choicesMissing(보기 누락) amber alert — 4상태 UI 모두 존재. `AuthForm.tsx:268-271` submitting disabled 스피너
- PASS 정답 안전(Hard Stop) — `QuestionCard.tsx` 는 채점을 서버 `/api/study/grade` 에 위임(클라 정답 비교 0) — 클라이언트에서 OX/빈칸 정답을 판정/노출하지 않음. graph-search-route/user-search/multihop-accuracy 변경은 검색·측정 경로로 정답 채점 로직 무관(scoreQuestion 은 노드 recall 채점이지 문항 정답 아님)
- PASS 보안 XSS(innerHTML/dangerouslySetInnerHTML) — AuthForm.tsx·QuestionCard.tsx·status.astro 전수 — innerHTML/dangerouslySetInnerHTML 0건. status.astro 는 정적 HTML(사용자 입력 보간 0), question.content 는 {…} JSX 텍스트 바인딩(이스케이프됨, `QuestionCard.tsx:273`)
- PASS open-redirect(autologin next) — `AuthForm.tsx:106-113` resolveNext() 가 `!next.startsWith('/') || next.startsWith('//')` 로 외부/프로토콜-상대 URL 차단 후에만 리다이렉트 — autologin 성공경로(`147` window.location.href=resolveNext())도 이 가드 경유. `QuestionCard.tsx:93/137` 은 encodeURIComponent(pathname) 만 사용
- PASS 서버 인증 불변(autologin 은 클라 편의) — `AuthForm.tsx:139-144` autologin 은 기존 `/api/auth/login` 을 동일 계약(credentials:include)으로 호출 — `auth/routes.ts:274-479` login 핸들러(Zod 422/rate-limit 429/enumeration 401 단일화/PBKDF2 verify) 무변경, 서버측 검증 게이트가 최종 권위 유지
- PASS 접근성(터치44px/aria/키보드) — `QuestionCard.tsx:231,328,338` 버튼 style minHeight:44, `211/259-261` aria-live, MultipleChoice 1-5 단축키·Ctrl+Enter/Ctrl+N(`183-206`). `AuthForm.tsx:258-259` role=alert aria-live=polite, `219-240` input type=email/password + autoComplete + minLength
- PASS 빈 catch 금지 — `AuthForm.tsx:152-154` catch 에 setPhase('idle') 폴백 존재(무음삭제 아님). measure-runner script `232` catch 가 stderr 로깅+exitCode=1. `multihop-accuracy.ts:58` parseRelatedNodes catch 는 malformed:true 반환(상위서 집계) — RULE #3 부합
- PASS fail-loud 측정 무결성(fabricate 차단) — `measure-s5-6-multihop-accuracy.ts:124-155` fetchGraphWithRetry 가 4xx 즉시 throw·5xx backoff 재시도·소진 시 throw(빈결과 삼킴 0), `145-147` stderr 로깅(무음 아님). `multihop-accuracy.ts:283-300` assertRemoteMeasurementInputs env/golden 미충족 시 throw(수치 fabricate 차단, RULE #4/#5)
- PASS 입력 검증(silent clamp 금지) — `measure-s5-6-multihop-accuracy.ts:87-103` --maxDepth 가 정규식 `^[0-9]+$`(소수 무음절단 차단)+1..4 route 계약 범위 강제 throw, `80-86` --limit 양정수 강제. `graph-search-route.ts:86` maxDepth z.number().int().min(1).max(MAX_ALLOWED_DEPTH) HTTP 400 정직거부(서버 권위 게이트)
- PASS status.astro URL 정정(trivial·noindex) — `status.astro:98-99` thepick-web→thepick-study 텍스트/href 단순 정정, 6행 meta robots noindex,nofollow 유지 — 사용자 입력 보간 없는 정적 페이지, XSS/리다이렉트 표면 무관
- N/A 오프라인 Service Worker 캐싱 전략 — 본 변경 4파일에 SW 등록·캐시 전략 코드 없음. PWA SW 는 변경 범위 외 — 본 리뷰 스코프에서 평가 대상 없음
- N/A 산식 정밀도/Formula Engine — 변경 파일에 산식 연산·math.js 호출 없음(multihop-accuracy 는 recall=hit/expected.size 정수비율, 부동소수 임계 비교 없음). 검색·측정·인증·UI 경로 한정
- PASS 테스트 동치(테스트통과=안전 가정 배제 후 확인) — `multihop-accuracy.test.ts:46-186` + `measure-runner.test.ts:141-222` 가 scoreQuestion/aggregate/assertRemoteMeasurementInputs/parseRelatedNodes 골든·결정성·자격증명게이트 검증 — 단 신규 --maxDepth/fetchGraphWithRetry 인자파싱·재시도 분기 단위테스트는 부재(스크립트 CLI 라 vitest 미커버) = known gap, runner 변경의 회귀 안전망은 route 서버측 z.schema(`graph-search-route.ts:86`)가 최종 보강
- PASS golden 답안키 분리(정답 안전·출처) — golden-pilot-approved.querybody.json `:6` policy=정답값·해설 제외, query=발문+보기+자료표, `:3-4` 독립검증 answer-VALUE leak 0 — relatedNodesRaw(노드 라벨)는 채점 ground-truth 이지 문항 정답값 아님 → 측정 입력에서 정답 누출 차단 확인

반론(Devil's Advocate) + 적대적 반증 판정:

- **🟠 MAJOR (Advocate)** — **테스트 자동로그인이 `PUBLIC_TEST_PASSWORD` 평문을 클라이언트 번들에 인라인할 수 있음 (공격자 관점 — 기계 강제 부재)**. `AuthForm.tsx:130-159` (특히 131-134, 143).
  - **상세**: Astro의 `import.meta.env.PUBLIC_*` 는 빌드타임에 클라이언트 번들로 인라인된다(서버 비밀이 아님). useEffect 는 `PUBLIC_TEST_AUTOLOGIN==='1'` + `PUBLIC_TEST_EMAIL`/`PASSWORD` 정의 시 `body: JSON.stringify({ email: tEmail, password: tPassword })` 로 자동 POST 한다. 즉 autologin이 켜진 빌드를 배포하면 유효한 평가 계정 자격증명(이메일+평문 비밀번호)이 공개 JS 번들에 그대로 박힌다 — anonymous 사용자가 DevTools/Sources 에서 추출해 그 계정으로 로그인 가능. 현 차단은 `AuthForm.tsx:127` 주석 'production launch 시 미설정' 한 줄 = 사람의 빌드 규율에만 의존. (1) PUBLIC*TEST*\* 를 .gitignore/.env.example/wrangler 에서 막거나 production 빌드에서 비우는 기계 강제가 grep 0건, (2) 거버넌스 문서(handoff-098, docs)에 본 env 의 위험·해제 의무 기록 0건. 메모리 feedback_test_env_password_dont_nag 는 '4자리 비밀번호 정책 길이'에 대한 nag 금지이지 '작동하는 자격증명을 공개 번들에 임베드하는 메커니즘'을 면제하지 않음 — 후자는 production-quality.md §8 '보안: API 키 클라이언트 노출 금지' 클래스.
  - **확인 증거**:
    - `AuthForm.tsx:131-133` — `import.meta.env.PUBLIC_TEST_*` 3종을 읽어 자동로그인 분기. Astro PUBLIC\_ prefix = 빌드타임 클라이언트 인라인(서버 비밀 아님)
    - `AuthForm.tsx:143` — `password: tPassword` 가 평문으로 fetch body 에 직렬화 → 번들 내 문자열로 잔존 가능
    - grep PUBLIC_TEST .gitignore/.env.example/wrangler = 거버넌스 매치 0건 (기계 강제 부재 확인); status.astro:98 thepick-study.pages.dev LIVE 200 = 배포 표면 실재
  - **Devil's Advocate(발견 자체 명시)**: production Pages 프로젝트(thepick-study)에 PUBLIC_TEST_AUTOLOGIN 이 실제로 설정돼 있지 않다면 번들에 password 가 인라인되지 않으므로 현 라이브 노출은 0일 수 있음(주석대로 '미설정'이면 무해). 그러나 이는 Cloudflare Pages 대시보드 env 설정이라 코드/레포에서 검증 불가 = 리뷰어가 안전을 단정할 수 없음. 평가 계정은 794노드 검색·학습 데이터만 접근(결제·PII 코어 아님)이라 피해 범위 제한적이라는 반론도 가능 — 단 login_history/user_progress 등 타 사용자 데이터 경계는 별도 검토 필요.
  - **적대적 반증 판정: refuted=false / severityAdjust=keep (MAJOR 유지)**.
    - 【실코드 검증 — 발견대로 터지는가: YES】`AuthForm.tsx:130-159` useEffect 가 정확히 서술대로 동작: 131-133 env 3종 읽기, 134 `auto !== '1'` 가드, 143 평문 직렬화 POST. Astro `PUBLIC_*` prefix = 빌드타임 클라이언트 번들 인라인은 정확. autologin 빌드 배포 시 평문 자격증명이 공개 JS 에 박힌다는 인과는 코드상 참.
    - 【기계 강제 부재 — 이미 가드가 막는가: NO】(1) `grep PUBLIC_TEST` 전 레포 = AuthForm.tsx 4건이 전부, 거버넌스 매치 0건. (2) 기존 시크릿 스캐너 2종이 이 위험과 직교: (a) `scripts/check-no-secrets.sh` PATTERNS(18-61)는 sk-ant/JWT/PEM/DB-URL/API토큰만 매치 — `PUBLIC_TEST_PASSWORD` 변수명·4자리 평가 비번 못 잡고 staged diff 만 검사(.env* 는 staged 안 됨). (b) `ci.yml:159` gitleaks 도 커밋 diff 스캔이라 Cloudflare Pages 대시보드 env 값은 애초에 못 봄. ⇒ 두 가드 모두 차단 불가. (3) `apps/web/package.json` `build: "astro build"` 플레인 — PUBLIC*TEST** 비우는 단계 없음. (4) 거버넌스 기록 0(handoff-098 grep 0건). 유일 차단선은 주석 한 줄.
    - 【배포 표면 실재】status.astro:98 thepick-study.pages.dev LIVE 200 확인.
    - 【적대적 반증의 한계】가장 강한 반증(대시보드 env 미설정이면 인라인 0)은 타당하나 (a) 대시보드 env 는 레포 검증 불가 → '안전' 단정 불가, (b) 발견의 주장은 '현재 누출 중'이 아니라 '인라인 가능 + 기계 강제 0 + 거버넌스 0' 잠재·거버넌스 결함이며 검증 결과 100% 참 ⇒ 반증 실패.
    - 【severity 판정: keep MAJOR】CRITICAL 미승격: 활성 익스플로잇 미확인·조건부(대시보드 미설정이면 노출 0), 피해 범위 평가 환경(결제·PII 코어 비포함), 확정 라이브 누출 아님. MINOR/refute 미강등: 평문 자격증명 직렬화 메커니즘 + 막는 기계 강제·CI·gitignore·거버넌스 전무 + 타 사용자 데이터 경계 미검토 → 사람 빌드 규율 단일 의존은 production-quality 보안 클래스 결함. ⇒ MAJOR 유지가 정확.
  - **권고 수정**: (1) 빌드 가드 — production 빌드/CI 에서 PUBLIC_TEST_AUTOLOGIN/EMAIL/PASSWORD set 시 fail 하는 체크 추가(quality-gate 류). (2) .env.example 에 '⚠️ 이 3종은 로컬 평가 전용 — production Pages env 에 절대 주입 금지(번들 인라인)' 명시. (3) 가능하면 password 비-번들 경로(평가 전용 magic-link/dev-only 엔드포인트)로 대체 — Phase 3 carry-over. 최소한 handoff/ADR 에 '해제 의무'를 ADR-034/036 §복원 의무 패턴으로 못박을 것.

- **MINOR (Advocate)** — `AuthForm.tsx:145-154` autologin 실패(!res.ok/네트워크 예외) 시 `setEmail(tEmail)`+`setPhase('idle')` 로 조용히 폴백, errorMsg 미설정 → 사용자가 '왜 자동 진입 실패'인지 안내 못 받고 빈 비밀번호 폼만 봄. catch 는 빈 catch 아님(폴백 동작 존재) → RULE #3 부합. **반증**: 평가 편의 기능에 실패 안내까지 넣으면 평가자에게 노이즈, 수동 폼 자체가 명확한 폴백이라 추가 문구가 군더더기일 수 있고, 잘못된 자격증명은 보통 빌드 설정 문제(평가자 조치 불가)라 침묵 폴백 합리적. 129행에 '조용히 폴백' 명시됨 → 사실상 문서화 충족 ⇒ MINOR(보고만).

### Pass 4 (Contract): ✅ 21건 확인 / 🔴 0건 / 🟠 0건(MINOR 2) / N/A 3건

**관점: "구현 재정립서/결재 카드 대로 만들었는가?"**

확인:

- PASS queryBody 분리가 결재 카드 #2(A안+자료표 포함) 정책과 정합 — `scripts/build-querybody-golden.mjs:36-67` RULES 가 정답값(➡역병/①120/=19,600,000원)·중복정답표·해설(※)만 제거, 발문+보기+빈칸+자료표 유지. decision-card-q2-querybody-separation.md:93-98 결재란과 1:1
- PASS answer-leak 가드 실효 — `build-querybody-golden.mjs:92-97` leakTokens 잔존 throw. 실데이터 검증(node 스크립트): queryBody 6건에 정답토큰 0건 잔존
- PASS 정답지(relatedNodesRaw) 바이트 무변경 — golden-pilot-approved.json(원본) vs golden-pilot-approved.querybody.json relatedNodesRaw 6건 전부 동일(mismatch 0). 원본 derivedFrom '무변경' 주장 실증
- PASS queryBody ⊂ content(추가·수정 0, 제거전용) — 6 items 모든 비공백 라인이 원본 content 부분열(NOT-SUBSET 0건). normalize 는 공백만 조정(build script:70-77)
- PASS measurable 4→6 회복 + Q-004 정직 제외 — 재실행 결정적(byte-identical 재생성). Q-014(501→270)·Q-015(922→398) 회복, Q-004(595→583) >500 유지로 excludedStillOver500 정직 기록. decision-card §6 추정과 정합
- PASS route query.max(500) 계약 준수 — golden-pilot-approved.querybody.json items 6건 전부 content.length≤500(76/336/192/181/270/398). 측정 시 400 거부 0
- PASS maxDepth 러너 인자가 route 계약(1..MAX_ALLOWED_DEPTH=4) 정합 — `measure-s5-6:87-103` 정수문자열만 허용+1..4 강제 fail-loud, 무음 clamp/절단 0. route `graph-search-route.ts:86` + `graph-walk index.ts:79` MAX_ALLOWED_DEPTH=4 와 일치
- PASS fetchGraphWithRetry fabricate 차단 — `measure-s5-6:124-155` 5xx backoff 재시도/4xx 즉시 fail-loud/소진 fail-loud/각 재시도 stderr 로깅(무음 아님). 채점 본문(scoreQuestion) 불변. ADR-008 800ms 504 흡수 근거 명시
- PASS multihop-accuracy.ts 변경은 리포트 텍스트만(채점·집계 로직 불변) — git diff 확인 — formatReportMarkdown 의 판정기준 헤더 + hit-rate 단독해석 경고 추가만. scoreQuestion/aggregate/buildBucket 미변경
- PASS 22 eval 테스트 전부 통과(measure-runner 6 + multihop-accuracy 16) — formatReportMarkdown 결정성 골든 테스트 포함. 리포트텍스트 변경이 MODE 워터마크 substring 어서션 미파괴
- PASS status.astro 북극성 수치가 2026-06-05 실측 분석과 일치(fabricate 0) — baseline 83.3% / depth1 0% / depth2 −20% / graphOnlyRecovery 0 = s5-6-g-s5-2026-06-05-querybody-analysis.md §1 표와 1:1. RULE #4/#5(AI 자기채점·판정 금지) 준수 — 푸터 '판정은 진산' 명시
- PASS status.astro URL 정정(thepick-web→thepick-study) = ADR-036 실배포 정합 — docs/adr/ADR-036:26 + phase2-eval-mvp.plan.md:233 모두 thepick-study.pages.dev 를 apps/web 라이브 URL 로 명시. 구 thepick-web 은 deploy 셋업가이드 잔재
- PASS AuthForm 자동로그인 env-게이트 no-op — `AuthForm.tsx:134` early-return(auto!=='1'||tEmail/tPassword undefined)이 setPhase('submitting')(136)보다 선행 → env 미설정 시 spurious 로딩상태 0. cancelled 레이스가드(135,145,153), 실패/예외 시 setPhase('idle') 수동폼 폴백
- PASS 서버 인증 불변(클라이언트 편의일 뿐) — `AuthForm.tsx:139-144` 자동로그인이 동일 `/api/auth/login` 엔드포인트·credentials include 사용 = 실세션 쿠키 발급. handleSubmit(161-205) 수동 경로 미변경
- PASS 테스트 자격증명 repo 평문 0(Hard Limit .env* 커밋 금지 준수) — grep PUBLIC*TEST** — AuthForm.tsx 의 import.meta.env 참조만, .env/.toml/.ts 하드코딩 0건
- PASS Hard Rule 17(exam-id 리터럴 단일선언) 준수 — `measure-s5-6:168` examId 는 EXAM_IDS.SON_HAE_PYEONG_GA_SA 경유, 라이브 리터럴 0. golden JSON 의 examId:'son-hae-pyeong-ga-sa' 는 데이터파일(Rule 17 예외)
- PASS 노드 ID 컨벤션(LAW-xxx/INS-xx/INV-xxx/CROP-xxx/CONCEPT-xxx/F-xxx/TERM-xxx) 정합 — golden querybody.json relatedNodesRaw 전 ID 가 컨벤션 준수. 측정코드는 ID 패턴 무관(문자열 채점)
- PASS 빈 catch/stub/TODO/placeholder 0 — `AuthForm.tsx:152` catch 는 setPhase('idle') 폴백(무음 아님), measure-s5-6 catch `232` stderr 로깅+exitCode 1. `multihop-accuracy.ts` parseRelatedNodes catch:58 malformed=true 반환(silent 아님). TODO/HACK grep 0
- PASS API 타입체크 클린 — cd apps/api && tsc --noEmit → TSC_EXIT=0. multihop-accuracy.ts 변경 컴파일 오류 0
- PASS GraphSearchResponseShape 계약이 실 route 응답과 정합 — `multihop-accuracy.ts:85-89`(baseline.results/graphExpansion.applied,truncated/results) = `graph-search-route.ts:108-117` GraphSearchResponse + 91-106 GraphExpansionMeta shape 일치
- PASS build script 결정성(재생성 byte-identical) — node scripts/build-querybody-golden.mjs 재실행 시 golden-pilot-approved.querybody.json diff 0. 측정 입력 재현성 확보
- N/A Formula Engine/동적코드실행/constants 수치 — 본 변경셋은 측정 harness+인증UI+상태페이지로 산식·상수 미접촉(graph-search-route 채점은 노드 ID 문자열 매칭, 수식 계산 0)
- N/A DB 스키마/마이그레이션 변경 — Session 098 변경에 마이그레이션·schema.ts 무. golden 은 read-only 측정입력, 백필/0038 은 별건(진산 전용, 본 셋 미포함)
- N/A BATCH 순서 게이트 — 본 변경은 콘텐츠 적재 아님(측정·UI). knowledge_nodes/exam_questions write 0

반론(Devil's Advocate):

- **MINOR (Contract)** — `status.astro:200` 자체-위치 푸터가 실제 소스 경로와 불일치(`apps/web/public/status/index.html` 참조하나 실파일은 `src/pages/status.astro`, public/status/ 디렉토리 부재; dist/status/index.html 은 빌드 산출물). Session 098 URL 정정 diff(98-99)와 무관한 기존 텍스트 부정확이나 리뷰 범위 파일 내. **반증**: /status/ 라우트 표기는 맞아도 소스 파일 표기는 명백히 stale — 차세션이 잘못된 파일을 편집할 위험(Silent Pivot 인접) ⇒ MINOR(URL 정정과 동일 trivial 묶음 처리 가능).
- **MINOR (Contract)** — 러너 `MAX_DEPTH_CEILING=4`(`measure-s5-6:65`)가 route `MAX_ALLOWED_DEPTH`(graph-search-route.ts:86 / graph-walk/index.ts:79)의 물리적 사본 = 수동 동기 의무. 현재 값 일치(4=4=4) 확인. 주석(62-63)이 권위 게이트는 route 자신(>4→400)이라 desync 돼도 측정은 안전 거부임을 명시, known MINOR(검증 wf_f5b13834)로 자체 고지. **반증**: ceiling 상향(5) 시 false reject(측정 거부=안전측 실패), 하향(3) 시 route 400 거부→fetchGraphWithRetry 4xx 즉시 throw(fail-loud) — 양방향 모두 무음 오염 불가. 러너는 별 패키지라 import 시 빌드 경계 이슈 ⇒ 현 주석+wf 트래킹으로 충분(수정 불요, carry-over).

판정: **수정 필요 아님 — 완료 가능** (CRITICAL 0건). MAJOR 1건(테스트 자동로그인 평문 자격증명 번들 인라인 — 기계 강제 부재)은 phase 종료 전 해결 또는 다음 phase 초기 태스크로 **명시 이월**. MINOR 8건은 보고/carry-over.

────────────────────────────────────

## 확정 발견 요약 (반증 통과분만)

| #   | Severity  | Pass      | Title                                                                                               | File:Line                   |
| --- | --------- | --------- | --------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | **MAJOR** | Advocate  | 테스트 자동로그인이 PUBLIC_TEST_PASSWORD 평문을 클라이언트 번들에 인라인할 수 있음 (기계 강제 부재) | AuthForm.tsx:130-159        |
| 2   | MINOR     | Surgeon   | autologin fetch timeout 부재 → 영구 pending 시 폼 영구 '처리 중…' 잠김                              | AuthForm.tsx:130-159        |
| 3   | MINOR     | Surgeon   | autologin StrictMode dev 이중 effect → /api/auth/login 2회 POST 가능                                | AuthForm.tsx:145-153        |
| 4   | MINOR     | Surgeon   | 러너 MAX_DEPTH_CEILING 이 route MAX_ALLOWED_DEPTH 와 물리적 분리(desync 시 안전측 실패)             | measure-s5-6...ts:60-65     |
| 5   | MINOR     | Architect | status.astro:200 주석이 존재하지 않는 파일(public/status/index.html) 참조 — 문서 드리프트           | status.astro:200            |
| 6   | MINOR     | Architect | 러너가 route 429(rate-limit)를 비재시도 4xx 로 즉시 fail-loud(현 분모 N=6 위험 낮음)                | measure-s5-6...ts:138-141   |
| 7   | MINOR     | Advocate  | autologin 실패 시 사용자 안내 문구 부재(침묵 폴백, 빈 catch 아님)                                   | AuthForm.tsx:145-154        |
| 8   | MINOR     | Contract  | status.astro:200 자체-위치 푸터가 실제 소스 경로와 불일치                                           | status.astro:200            |
| 9   | MINOR     | Contract  | 러너 MAX_DEPTH_CEILING(4) 수동 동기 의무(자체 고지된 known MINOR)                                   | measure-s5-6...ts:65,86-103 |

**최종 판정: CRITICAL 0 / MAJOR 1 / MINOR 8 → 완료 가능 (MAJOR 1건 명시 이월 의무)**
