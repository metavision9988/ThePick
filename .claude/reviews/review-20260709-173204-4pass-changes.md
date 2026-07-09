# 4-Pass Review — promo-1st P0+P1 (무인증 공개 홍보 표면)

- 리뷰 일시: 2026-07-09 17:32:04
- 대상 라벨: `review-20260709-173204-4pass-changes`

## 스코프

**변경 파일 (16):**

- `apps/api/src/public/routes.ts`
- `apps/api/src/public/choice-id.ts`
- `apps/api/src/public/analytics.ts`
- `apps/api/src/public/rate-limit.ts`
- `apps/api/src/public/__tests__/routes.test.ts`
- `apps/api/src/public/__tests__/choice-id.test.ts`
- `apps/api/src/index.ts`
- `apps/api/src/middleware/cache-policy.ts`
- `apps/api/src/auth/rate-limit.ts`
- `apps/api/src/study/routes.ts`
- `apps/api/wrangler.toml`
- `apps/web/src/components/AuthForm.tsx`
- `packages/learning-modes/src/input-types/mc-choices.ts`
- `packages/learning-modes/src/__tests__/mc-choices.test.ts`
- `packages/learning-modes/src/index.ts`
- `packages/learning-modes/src/types.ts`

**연관 파일 (10):**

- `packages/learning-modes/src/input-types/mc-answer.ts`
- `packages/learning-modes/src/normalize.ts`
- `packages/learning-modes/src/input-types/fill-blank.ts`
- `packages/learning-modes/src/shuffle.ts`
- `apps/api/src/auth/session.ts`
- `apps/api/src/db/schema.ts`
- `apps/api/src/search/graph-search-route.ts`
- `apps/api/src/search/routes.ts`
- `.jjokjipge/handoff-to-opus-promo-1st-20260708.md`
- `docs/plans/promo-1st-free-service-scope-20260708.md`

**요약:** promo-1st P0+P1 — 무인증 공개 홍보 표면 신설. P0 = `AuthForm.tsx` 자동로그인 크리덴셜 블록 전면 제거 + `index.ts` CORS 에서 미보유 도메인 `thepick.app` 제거. P1 = 신규 `/api/public/*` Hono 라우터(serve `/questions/next` + 채점 `/grade`)로 `exam_type='1st' AND status='active'` 서버 고정 경계 강제, 서빙 projection 에서 answer/explanation 비노출, 무상태 HMAC 불투명 choiceId 로 셔플시드 대체, 해시 IP rate limit + 익명 Analytics Engine 이벤트(PII 0). MC 채점 계약 파싱을 `study/routes.ts` `buildShuffledChoices` 인라인에서 `packages/learning-modes` `parseMcChoices`(+`resolveInputType` `types.ts` 이관) 단일 정본으로 추출해 인증·공개 경로 공유. `wrangler.toml` 에 `PUBLIC_RATE_LIMITER_IP` unsafe binding + `PUBLIC_ANALYTICS` dataset(dev/staging/production) 추가, cache-policy 는 `/api/public/*` no-store 강제.

---

── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 5개(scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 16개 + 연관 파일 10개 (상단 스코프 목록)

## Pass 1 (Surgeon): ✅ 11건 확인 / 🔴 0건 / 🟠 0건 / N/A 2건

**확인:**

- PASS Null/`.first()`: `routes.ts:225-237` serve row null→404 `NO_QUESTION`, `:297-300` grade row null→404 `QUESTION_NOT_FOUND`, `:301-303` answer null/''→422 `QUESTION_HAS_NO_ANSWER` — 모든 `.first<T>()` 반환 null 분기 처리됨
- PASS Async await: `routes.ts:227`(serve query),`:243`(buildPublicChoices),`:284`(grade query),`:324`(resolveChoiceId),`:334`(issueChoiceId) 전부 await; issueChoiceId/resolveChoiceId 내부 `crypto.subtle` importKey/sign 도 await(`choice-id.ts:45,52,77`) — 누락 없음. recordPublicEvent(`:262,:344`)는 동기 void 라 await 불필요(`analytics.ts:36-59`)
- PASS 경계값(빈배열/0건): parseMcChoices 가 answerLabelsFitChoices(`mc-answer.ts:78-84`)로 choiceCount>=2 보장 → cryptoShuffle(`routes.ts:138-147`) 루프 i>0 안전, originalTexts[idx]! 항상 유효. serve 0건은 `:235`→404
- PASS 경계값(음수/파싱): normalizeRoundParam(`routes.ts:118-123`) n<=0·비정수 null 처리, normalizeSubjectParam(`:110-115`) 길이 가드 MAX 100, GradeBodySchema(`:93-99`) min/max 바운드. FSRS interval 음수 = N/A(public 표면에 FSRS/산식 연산 없음)
- PASS 빈 catch 금지: `routes.ts:230-233`(logger.error+500),`:292-295`(logger.error+500),`:274`(json parse .catch→null 후 Zod 검증) / `analytics.ts:55-58`(console.warn) / rate-limit fail-open·closed 명시(`auth/rate-limit.ts:54-72`) — 무음 삼킴 0건
- PASS Graceful degradation: grade MC 계약 위반 시 `routes.ts:316-322`→422 `QUESTION_NOT_GRADABLE`(무음 skip 아님), serve MC 계약 위반 시 `:244-247`→404 `QUESTION_UNAVAILABLE`, 위조 choiceId(`choice-id.ts:75-80` null)→isCorrect false(`:330`)
- PASS 정답 비노출(answer leak): serve projection PublicNextQuestionOut(`routes.ts:80-91`)에 answer/explanation/distractors 없음, out 조립 `:250-260` 도 미포함 — `routes.test.ts:106-107` 로 검증. 정답은 `/grade` 응답에서만(`:351` correctAnswer)
- PASS SQL injection: serve conditions(`routes.ts:204-217`) 전부 정적 리터럴 문자열, 값은 `.bind(...params)` 파라미터 바인딩; grade(`:284-291`) 고정 SQL + bind — 사용자 입력 문자열 연결 0건
- PASS choiceId 결정성/왕복: issue/resolve 동일 (secret,qId,idx) 의존(`choice-id.ts:57-81`), serve·grade 양쪽 `c.env.JWT_SECRET ?? ''` 동일 폴백(`routes.ts:242,323`) — 날짜 무의존, 자정 재셔플 오채점 없음(`choice-id.test.ts:21-42` 왕복 검증)
- PASS 경계 강제(exam_type/status 서버고정): FIXED_EXAM_TYPE='1st'/FIXED_STATUS='active'(`routes.ts:47-48`) serve(`:204-205`)·grade(`:287,:290`) 양쪽 WHERE 고정. EXAM_TYPES=['1st','2nd'], EXAM_QUESTION_STATUSES 확인(`schema.ts:71,136`). exam_type nullable(default '2nd') 이나 `= '1st'` 비교가 NULL·'2nd' 안전 배제 — `routes.test.ts:148-152,241-246` 회귀
- PASS stub/TODO/any: grep 결과 `apps/api/src/public/` + `mc-choices.ts` 내 TODO/FIXME/HACK/placeholder/any 0건, 모든 함수 실로직 보유
- PASS 테스트 green: `pnpm --filter @thepick/api test src/public` → 22 passed(routes 17 + choice-id 5), `mc-choices.test.ts` 회귀 계약 고정(단 essay/calc 서빙 풀 유입 케이스는 미커버 — 하단 MINOR)
- N/A Formula Engine 동적 코드 실행: public 표면에 equation_template/math.js 평가 경로 없음. choice-id 는 `crypto.subtle.sign`(HMAC) 만 사용, eval/Function 0건
- N/A 산식 정밀도(부동소수점/numeric_value): public serve/grade 는 문자열 채점(gradeFillBlank normalize 동치, `fill-blank.ts:24-37`)·집합 멤버십(`routes.ts:330`)만, 수치 연산 없음

**반론:** serve `/questions/next` 기본 쿼리가 `SERVABLE_INPUT_TYPES` 를 무조건 WHERE 로 강제하지 않아(`routes.ts:204-217`), 클라이언트가 `inputType` 파라미터를 주지 않으면 `ORDER BY RANDOM() LIMIT 1` 이 essay/calc(또는 오태깅) 행까지 뽑을 수 있고, resolveInputType→gradeFillBlank 경로에서 서술형 정답을 문자열 동치 채점해 오채점된다. 회귀 테스트에 essay/calc 시드 케이스가 없어 이 경로는 미커버(→ MINOR).

## Pass 2 (Architect): ✅ 12건 확인 / 🔴 0건 / 🟠 0건 / N/A 4건

**확인:**

- PASS Import 방향 단방향: `apps/api` → `@thepick/learning-modes` → `@thepick/shared` 확인. `packages/learning-modes/package.json:24` 는 `@thepick/shared` 만 의존, 역방향(packages→apps) grep 결과 코드 참조 0(주석뿐). `public/routes.ts:22-32` · `study/routes.ts:44-57` 모두 packages 에서 import
- PASS 단일 정본 공유(무음 오채점 재발 차단): parseMcChoices 를 인증 buildShuffledChoices(`study/routes.ts:436`)·공개 serve(`public/routes.ts:159`)·공개 grade(`public/routes.ts:315`) 세 경로가 동일 함수로 호출. git diff 로 study/routes.ts 추출이 behavior-preserving 확인
- PASS resolveInputType 이관: `study/routes.ts:411` 주석 + `types.ts:15` 단일 정의를 study·public 양쪽이 import. 구 로컬 정의 삭제(diff 확인), INPUT_TYPES 는 `study/routes.ts:161` 에서 여전히 사용(unused import 아님)
- PASS D1 스키마 enum 일치: exam_type enum ['1st','2nd'](`schema.ts:136`) — 필터 FIXED_EXAM_TYPE='1st' 유효. status enum ['active','deprecated','flagged'](`schema.ts:71`) — FIXED_STATUS='active' 유효. examType 컬럼 default '2nd'·nullable → 필터 '1st' 이 NULL/'2nd' 배제 = fail-closed 경계
- PASS 경계 강제 서버 고정: serve(`routes.ts:204-205`)·grade(`routes.ts:287-290`) 양쪽 WHERE 에 exam_type=? AND status=? 를 서버 상수(47-48)로 바인딩 — client 파라미터 경로 없음. 회귀 테스트 2건(`routes.test.ts:148`,`:241`) 존재
- PASS 서빙 projection answer/explanation 비노출: PublicNextQuestionOut(`routes.ts:80-91`)·serve out 객체(250-260)에 answer/distractors/explanation 필드 부재. `routes.test.ts:106-107` not.toHaveProperty 검증
- PASS Workers 런타임 제약: fs/path 미사용. Web Crypto(`choice-id.ts:45-52`, `routes.ts:132-134`)만 사용. HMAC 재계산 문항당 ≤5회(MC_MAX_CHOICES `mc-answer.ts:27`) = CPU 예산 무리 없음. Node 전용 API 0
- PASS cache-policy 정합: `/api/public/` → Cache-Control:no-store 강제(`cache-policy.ts:67-70`). 미들웨어는 post-next 적용(마지막 덮어쓰기, `cache-policy.ts:48-51`)이라 핸들러 실수도 커버
- PASS CORS 격리: public 은 credentials:false 별도 정책(`index.ts:135`) — auth 쿠키 경로와 분리. origin 은 buildCorsOptions allowlist(`index.ts:38-49`) 제한. P0: 미보유 도메인 thepick.app 제거 확인
- PASS rate-limit binding 배선: PUBLIC_RATE_LIMITER_IP unsafe binding 이 dev/staging/production 3환경 모두 선언(`wrangler.toml:108-112·180-184·252-257`). PUBLIC_ANALYTICS dataset 도 3환경. checkPublicIpRateLimit 은 fail-open(dev)/fail-closed(prod) via handleMissingBinding(`rate-limit.ts:26-28`)
- PASS auth/rate-limit.ts 변경 안전성: handleMissingBinding 을 export 로만 변경(git diff HEAD) — 로직·시그니처 불변, 기존 호출부 영향 0
- PASS PII 0 / 무상태(G-1): choiceId 는 HMAC(secret, qId:idx) 무상태(`choice-id.ts:57-63`). rate-limit 키는 SHA-256(IP||PEPPER)(`rate-limit.ts:29-32`) 원문 IP 미보관. AE 이벤트는 subject/round/inputType/정오만(`analytics.ts:43-54`)
- PASS i18n: public API 응답 error 는 기계 코드(TOO_MANY_REQUESTS/NO_QUESTION 등, `routes.ts:191·236·299`) — 한국어 하드코딩 노출 아님
- PASS 무음 실패 금지: analytics writeDataPoint 실패는 console.warn(`analytics.ts:55-58`), serve/grade query 실패는 logger.error+500, MC 계약 위반은 logger.warn/error 후 404/422. 빈 catch·TODO·stub 0
- N/A Temporal Graph: public 라우트는 전량 read-only SELECT(`routes.ts:227·284`) — write 0. 0038 distractors UPDATE ABORT 트리거와 무충돌
- N/A Ontology Lock: 신규 node/edge ID 생성 0. choiceId 는 위치 식별자(HMAC hex)로 대상 아님
- N/A truth_weight 정렬: public 라우트는 RAG/LLM 주입·노드 랭킹 미수행(v1 노드기능 제외 G-4). 채점·서빙만
- N/A IndexedDB↔D1 동기화: public 표면은 무상태·서버 채점 — 오프라인 큐/Background Sync 경로 미접촉

**반론:** serve `ORDER BY RANDOM() LIMIT 1` 로 뽑은 단일 MC 행이 distractors 계약 위반이면 재추첨 없이 404 `QUESTION_UNAVAILABLE`(`routes.ts:219-247`). 무음 skip 금지 원칙엔 부합하나, BE-1(P3) 보기 추출 BATCH 부분 라이브 시점에 '아직 제외 목록에 오르지 않은 결함 active MC 행'이 잔존하면 서빙 가능한 다른 MC 가 있어도 간헐 404 발생 가능(→ MINOR).

## Pass 3 (Advocate): ✅ 17건 확인 / 🔴 0건 / 🟠 1건 / N/A 2건

**확인:**

- PASS 경계 강제(서빙): `routes.ts:204-205` status·exam_type 서버 고정, 클라 파라미터 경로 없음 — `routes.test.ts:135-152`(flagged·2차 서빙 제외) 통과
- PASS 경계 강제(채점): `routes.ts:287-290` WHERE id=? AND exam_type=? AND status=? 양쪽 강제 — `routes.test.ts:241-252` 검증
- PASS SQL 인젝션: serve/grade 모두 prepare().bind(...params) 파라미터 바인딩(`routes.ts:227-229, 284-291`), 사용자 값 직접 삽입 0
- PASS 입력 검증: GradeBodySchema(`routes.ts:93-99`) questionId≤128·choiceId≤64·answer≤2000, query 정규화(110-129)
- PASS 서빙 정답 비노출: PublicNextQuestionOut(`routes.ts:80-91`)에 answer/explanation 필드 없음 — `routes.test.ts:106-107,125` 검증
- PASS 캐시 경계: `cache-policy.ts:67-70` `/api/public/*` no-store 강제 + 78-80 기본 floor no-store, PUBLIC_PATH_TTL_SECONDS 공유캐시 미포함(지뢰 #5 방지 주석)
- PASS CORS 격리: `index.ts:133-135` `/api/public/*` credentials:false 별도 정책, origin allowlist(97-100)
- PASS rate-limit fail-closed: `public/rate-limit.ts:26-28` → `auth/rate-limit.ts:54-72` handleMissingBinding staging/prod false(fail-closed), dev fail-open; 429+Retry-After(`routes.ts:189-192`)
- PASS PII 0: `analytics.ts:41-58` IP/userId/본문/정답 미기록; rate-limit 키=SHA-256(IP+IP_PEPPER)(`rate-limit.ts:29-32`, `session.ts:201-208`)
- PASS P0 자동로그인 제거: `AuthForm.tsx` 내 PUBLIC*TEST*\* 크리덴셜 블록 삭제(127-130 NOTE만 잔존), grep 결과 실코드 참조 0건
- PASS thepick.app 제거: `index.ts:38-49` CORS 목록에서 미보유 도메인 제거(36 NOTE) — 잔존은 .wrangler 빌드캐시(stale)·admin-web .env.example 문서뿐
- PASS 불투명 choiceId: `choice-id.ts:56-81` HMAC 위치 식별자, 길이불일치·위조·타문항 → null(75-80) — `choice-id.test.ts:28-36` 검증
- PASS 복수정답 채점: `mc-answer.ts:44-72` 위치집합 파싱 + `routes.ts:330-335` correctOriginalIndices.has — `routes.test.ts:186-201`('2,3') 검증
- PASS 정답 계약 단일 정본: parseMcChoices(`mc-choices.ts`) 인증·공개 grade 공유, 무음 filter 금지·위치 정합·동치 거부(`mc-choices.ts:72-108`) — 복붙 0
- PASS 오류 시 안전 실패: parseMcChoices 위반 시 서빙 404·채점 422 = 오채점 대신 거부(무음 오채점 차단)
- PASS 빈 catch/stub/TODO 0: catch 는 logger.error+500 / console.warn(무음 금지 주석), 신규 4파일에 TODO/HACK 0
- PASS 부동소수점/산식: public 표면 문자열 채점만 — 수치 연산 부재
- 🟠 MAJOR AuthForm resolveNext 개방 리다이렉트: `AuthForm.tsx:106-113,151` 가드가 startsWith('//')만 검사(백슬래시 미검사) → `?next=/%5Cevil.com`(디코드 `/\evil.com`)이 가드 통과 후 `window.location.href` 로 전달, WHATWG special-scheme 파서가 `\`→`/` 정규화 → `//evil.com` → `https://evil.com` 외부 리다이렉트. promo-1st 로 AuthForm 이 공개 로그인 표면화되며 노출면 확대(적대 반증 CONFIRMED, severity keep)
- N/A XSS: 렌더링 프론트엔드 미존재(`apps/web/src` 에 `/api/public` 소비 컴포넌트 grep 0건) — 프론트 구현 시 재검토 이월
- N/A 오프라인/Service Worker: 이번 변경셋에 sw.js·PWA 캐싱 수정 없음, 공개 표면 no-store 정책과 정합

**반론:** BE 콘텐츠에 `exam_type='1st' AND status='active' AND input_type='calc'` 행이 하나라도 적재되면 서버 채점이 계산 정답을 문자열 normalize 비교로 판정 → 수치 표현 차이(`'1,000'` vs `'1000'`)로 양방향 오채점. Formula Engine 을 거치지 않는 폴백 경로라 L3 정답계약과 상충(현재 1차 데이터엔 부재 → MINOR·carry-over).

## Pass 4 (Contract): ✅ 12건 확인 / 🔴 0건 / 🟠 0건 / N/A 4건

**확인:**

- PASS P0 자동로그인 제거: `AuthForm.tsx:127-130` PUBLIC*TEST*\* 자동로그인 블록이 주석 원장만 남기고 전면 제거(크리덴셜 번들 인라인 0). 핸드오프 §3-P0 정합
- PASS P0 CORS thepick.app 제거: `index.ts:36` NOTE + CORS_ALLOWED_ORIGINS(`:38-49`)에 thepick.app 부재, thepick-study.pages.dev 유지(G-5 정합)
- PASS 경계 강제(서빙): `routes.ts:204-205` status=? AND exam_type=? 서버 바인딩, 클라 파라미터 경로 없음. 회귀 `routes.test.ts:135-152`
- PASS 경계 강제(채점): `routes.ts:284-291` WHERE id=? AND exam_type=? AND status=? 강제 → 지뢰 #4 해소. 회귀 `routes.test.ts:241-252`
- PASS 서빙 projection 비노출: PublicNextQuestionOut(`routes.ts:80-91`)에 answer/explanation/distractors 부재. `routes.test.ts:106-107`
- PASS 불투명 choiceId 무상태 HMAC: `choice-id.ts:43-63` HMAC-SHA256(secret, qId:idx) 24-hex, 저장 0·날짜 무의존(자정 재셔플 지뢰 #8 해소)
- PASS parseMcChoices 단일 정본 재사용(복붙 0): `mc-choices.ts` 격리, `study/routes.ts:436`·public `routes.ts:158·315` 공유. index.ts export 배선 확인
- PASS 해시 IP rate limit 전용 네임스페이스: `rate-limit.ts:29-33` SHA-256(IP||PEPPER) + PUBLIC_RATE_LIMITER_IP 바인딩(`wrangler.toml` namespace 1005/2005/3005), D1 rate_limits 미사용(지뢰 #6 정합)
- PASS Analytics PII 0: `analytics.ts:22-58` IP·userId·본문·정답 미기록, blobs=이벤트종류/과목/회차/inputType/1st·doubles=정오만
- PASS cache-policy /api/public/\* no-store: `cache-policy.ts:67-70` + `index.ts:135` credentials:false 별도 CORS
- PASS G-1 로컬 전용: public routes 전체에 user_progress/knowledge_nodes/formulas write 0, 조회는 exam_questions read-only. Hard Limit 무접촉
- PASS 무음 skip 금지 정합: parseMcChoices 무음 원소 filter 금지(`mc-choices.ts:72-77`), 서빙 MC 계약 위반 시 404 fail-loud
- PASS 빈 catch/스텁/TODO/동적실행 0: catch 는 logger.error+전파, 동적 코드 실행 0, Formula Engine 무관
- N/A 노드 ID 컨벤션: P0/P1 스코프에 knowledge_nodes/edges/ontology-registry 생성·수정 0(G-4 v1=기출-only)
- N/A 수치/임계값 constants↔교재: 본 변경셋에 산식/Constants DB 값 신규·수정 0
- N/A BATCH N→N+1 순서: BE-1 보기 추출 BATCH(P3)는 본 리뷰 파일셋 미포함
- N/A Hard Rule 17 examId 리터럴: 본 변경셋에 'son-hae-pyeong-ga-sa' 런타임 리터럴 0(exam_type '1st'/'2nd' 는 별개 축)

**반론:** 기획(스코프 §3 BE-6③ + 핸드오프 §3-P1.5)은 익명 이벤트 3종(serve/grade/**card**)을 명시하나, `analytics.ts:20` PublicEventKind 에 'card' 가 선언·처리 구현됐지만 `routes.ts` 실제 호출은 serve(`:262`)·grade(`:344`) 2종뿐 — 'card' 발화 caller 부재(grep 0건). FE-5 카드플립이 P4/P5 스코프라 미배선은 계획 정합이나 '3종 배선 완료'로 오인 여지(→ MINOR).

판정: **완료 가능** (CRITICAL 0건 — MAJOR 2·MINOR 9 는 이월/후속 처분)
────────────────────────────────────

---

## 확정 발견 요약 (적대적 반증 통과분)

**CRITICAL 0 / MAJOR 2 / MINOR 9**

### MAJOR

| #   | Pass     | 파일:라인                                                 | 제목                                                                                                                                                                                               |
| --- | -------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-1 | Advocate | `apps/web/src/components/AuthForm.tsx:106-113,151`        | resolveNext 개방 리다이렉트 — `?next=/\evil.com` 백슬래시 우회로 로그인 후 피싱 사이트 리다이렉트 (반증 CONFIRMED·keep)                                                                            |
| M-2 | Advocate | `apps/api/src/public/routes.ts:204-223, 239-248, 336-341` | 공개 서빙에 SERVABLE_INPUT_TYPES/데이터 준비 가드 부재 — 현 프로덕션(distractors 전량 NULL·input_type 전량 fill_blank·answer=위치라벨) 서빙 시 무선택지 빈칸 + 양방향 오채점 (반증 CONFIRMED·keep) |

**M-1 상세:** resolveNext() 가드(`:111`)는 `if (!next.startsWith('/') || next.startsWith('//')) return '/study/'` 뿐. `?next=/%5Cevil.com` → URLSearchParams 디코드 → `next="/\evil.com"`: startsWith('/')=true, startsWith('//')=false 로 가드 통과 → `:151 window.location.href = resolveNext()` 에서 WHATWG special-scheme 백슬래시 정규화(`\`→`/`) → `//evil.com` network-path reference → `https://evil.com`. Chromium/Firefox/Safari(모바일 80% 타깃) 재현. promo-1st 로 AuthForm 이 공개 로그인 표면화 = 노출면 확대. 피싱 한정·사용자 상호작용+조작 링크 필요(직접 크리덴셜/세션 탈취 아님)라 MAJOR. **수정:** `const u = new URL(next, window.location.origin); if (u.origin !== window.location.origin) return '/study/'; return u.pathname + u.search + u.hash;` (또는 최소 `/^\/[^/\\]/.test(next)`, 백슬래시 포함 시 무조건 기본값).

**M-2 상세:** serve 기본 WHERE(`:204-217`)는 status·exam_type·(선택)subject/round/inputType 만 걸고 SERVABLE_INPUT_TYPES(`:51`)는 클라 필터 검증(normalizeInputTypeParam)에만 쓰임. scope F-1(`promo-1st-free-service-scope-20260708.md:15`) = 현 프로덕션 1차 525문항 distractors 전량 NULL·input_type 전량 fill_blank, `mc-answer.ts:12` = answer 가 plain 숫자 519 + 복수정답 6(위치라벨). 지금 프론트를 물리면 525문항이 fill_blank·choices=null 서빙(`:239-248`) + gradeFillBlank(expected='2') 채점(`:336-341`) → (a) 보기 없는 빈칸, (b) 우연 '2' 입력=거짓 정답, (c) 보기 텍스트 입력=거짓 오답 = 양방향 오채점. 데이터 서빙 자격 가드 없이 안전은 오직 프로세스 게이트(BE-1 후 런칭)에만 의존. 현재 프론트 미연결(`apps/web` 에 `/api/public` 소비 컴포넌트 0건)이라 즉시 노출 0이나, 무인증 public 라우트가 direct URL 로 도달 가능(`index.ts:176`)하고 부분 라이브 시 fail-safe 부재 = Hard Stop(정답 100%·무음 skip 0)과 충돌 → MAJOR(latent). **수정:** serve WHERE 에 `input_type='multiple_choice' AND distractors IS NOT NULL`(또는 진성 fill_blank) 서빙 자격 강제 + 위치라벨 answer·distractors NULL 행 서빙/채점 제외.

### MINOR (9)

| #   | Pass      | 파일:라인                       | 제목                                                                                                                                                   |
| --- | --------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| m-1 | Surgeon   | `routes.ts:204-223, 239-248`    | serve 기본 쿼리가 SERVABLE_INPUT_TYPES 미강제 → essay/calc(또는 오태깅) 행 서빙 풀 유입 (essay/calc 뽑히면 choices=null + gradeFillBlank 오채점)       |
| m-2 | Architect | `routes.ts:219-247`             | `ORDER BY RANDOM() LIMIT 1` + 결함 MC 행 = 서빙 가능 문항 남아도 404(간헐 가용성 엣지)                                                                 |
| m-3 | Architect | `routes.ts:336-342`             | grade essay/calc 방어 폴백이 gradeFillBlank 채점 — 1차에 서술/계산형 존재 시 오채점(현재 이론적)                                                       |
| m-4 | Advocate  | `routes.ts:240-247`             | 서빙 RANDOM() 이 결함 MC 행 적중 시 유효 문항 남아도 404(재시도/스킵 없음) (반증 CONFIRMED)                                                            |
| m-5 | Advocate  | `choice-id.ts:56-63, 20-22`     | choiceId 전역 결정적·불변(세션 nonce 없음) — 1회 채점으로 정답 choiceId 가 전역 상수화 → 서빙 비노출 약화(문서상 수용된 트레이드오프) (반증 CONFIRMED) |
| m-6 | Advocate  | `AuthForm.tsx:237-243, 246-252` | 모바일 터치 타겟 44px 미만(제출 py-2 text-sm ≈36px, 토글 text-xs) — 공개 로그인 표면 접근성(모바일 80%) (반증 CONFIRMED)                               |
| m-7 | Contract  | `analytics.ts:20, 45-54`        | 'card' 이벤트 종류 선언·처리됐으나 발화 caller 부재(기획 3종 중 1종 미배선, FE-5 게이트)                                                               |
| m-8 | Contract  | `routes.ts:51, 204-217`         | SERVABLE_INPUT_TYPES 상수가 기본 서빙 WHERE 에 미적용 — 이름의 계약이 쿼리에 강제 안 됨                                                                |
| m-9 | Contract  | `analytics.ts:51`               | exam_type '1st' 리터럴 2개 파일 중복 하드코딩(FIXED_EXAM_TYPE 미경유 — 드리프트 표면)                                                                  |

---

## 판정

- 4-Pass CRITICAL **0건** → **완료 가능**
- MAJOR 2건(M-1 open redirect / M-2 서빙 자격 가드 부재)은 promo-1st 런칭 전 **must-fix 또는 명시 이월**. M-2 는 현 프론트 미연결로 즉시 영향 0이나, 부분 라이브 전 데이터 서빙 자격 가드 또는 프로세스 게이트(BE-1 승급 조건)로 fail-safe 확보 필요.
- MINOR 9건은 후속/이월 처분(대부분 서빙 자격 가드 M-2 로 근원 해소, FE 디자인 리디자인·carry-over 원장 기록).

---

## 처분 (2026-07-09, Opus — 리뷰 직후 반영)

**MAJOR 2 = 즉시 수정 완료 (커밋 후속):**

- **M-1 (open redirect)** → `apps/web/src/lib/safe-redirect.ts` 신설(`resolveSafeNext`, 순수·테스트 가능) + `AuthForm.resolveNext` 가 이를 경유. 가드 = `/^\/[^/\\]/` (프로토콜-상대 `//`·백슬래시 `/\`·스킴 전부 fallback). 단위 테스트 `safe-redirect.test.ts` 5건(우회 벡터 4종 검증).
- **M-2 (서빙 자격 가드 부재)** → `isServable(row)` 도입: **정확히 채점 가능한 문항만 서빙/채점**. MC=parseMcChoices.ok / fill_blank=answer 가 위치라벨(MC-in-disguise) 아닌 진성 텍스트 / essay·calc=미지원. 서빙은 SERVABLE input_type SQL 제약 + 후보 N(=10)개 자격판정으로 첫 유효행 선택(간헐 404 방지). 채점은 위치라벨 fill_blank → 422 `QUESTION_NOT_GRADABLE`, essay/calc → 422(문자열 폴백 제거). ⇒ 현 1차 525(BE-1 전 = answer 위치라벨·distractors NULL)는 **서빙/채점 대상 0** = 오채점 fail-safe. 회귀 테스트 4건 추가.

**MINOR 처분:**

- m-1·m-3·m-8 = M-2 서빙 자격 가드로 **근원 해소**(SERVABLE SQL 제약 + essay/calc 422).
- m-2·m-4 = 후보 N개 자격판정 서빙으로 **해소**(결함행 적중해도 유효행 서빙).
- m-9 = `examType` 를 AE 이벤트 필드로 주입(FIXED_EXAM_TYPE 경유) — 리터럴 중복 제거.
- m-5 (choiceId 전역 결정성) = **carry-over**: 홍보 범위 = 문서화된 수용(F-3 정답 공개). 유료/경쟁 기능 도입 시 서명 nonce 결합 옵션.
- m-6 (AuthForm 44px 터치 타겟) = **carry-over → P4**: FE-9 접근성 리디자인에서 처리(공개 로그인 화면 스타일 재설계 대상).
- m-7 ('card' 이벤트 미배선) = **carry-over → P4/P5**: FE-5 카드플립 배선 시점(전방 선언, 계획 정합).

검증: api 765 pass/2 skip(+4 회귀) · web 36(+5) · typecheck·lint·g1 green.
