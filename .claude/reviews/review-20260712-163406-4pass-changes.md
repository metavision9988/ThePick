# 4-Pass 독립 에이전트 리뷰 — RC-5 공개 학습 계약 shared 단일화 + 0044 old 행 처분 plan

- **일시**: 2026-07-12 16:34:06
- **리뷰 방식**: 독립 에이전트 5개 (scope / Surgeon / Architect / Advocate / Contract) + **발견별 적대적 반증** (MAJOR 후보 전건 CONFIRMED/REFUTED 판정 — REFUTED 0, 강등 3)
- **프로토콜**: `.claude/rules/auto-review-protocol.md` 4-Pass (규칙 0 독립 에이전트 / 규칙 1 전체 범위 / 규칙 2 증거 기반 / 규칙 3 반론 의무)
- **최종 판정**: **CRITICAL 0 / MAJOR 3 / MINOR 17** → **완료 가능** (단, MAJOR 3 은 프로토콜 규칙 4에 따라 즉시 수정 대상 — §3 참조)

---

## 0. 리뷰 스코프

**변경 요약 (A트랙 2건)**:

1. **RC-5 공개 학습 계약 shared 단일화** — `packages/shared/src/public-learning-contract.ts` 신설(PublicChoice/PublicNextQuestion/PublicGradeResult/PublicRevealResult/PublicOverview/PUBLIC_ERROR_CODES + 불변식 테스트). api routes.ts 인라인 interface 제거, web types.ts re-export 전환, api.ts ERROR_MESSAGES Record 컴파일 강제, e2e fixtures 정본 alias 전환 — 와이어 shape 3표면(api/web/e2e) 단일 정본 수렴 (순삭감 −54줄).
2. **`docs/plans/old-rows-retirement-0044.plan.md` 신설** — old 525행 처분 L3 plan (DRAFT, 코드/SQL 0줄, 마이그 슬롯 0044 배정). 트리거·CHECK·인덱스 인용의 실코드 정합이 리뷰 축.

**변경 파일 9개**:

- `packages/shared/src/public-learning-contract.ts`
- `packages/shared/src/__tests__/public-learning-contract.test.ts`
- `packages/shared/src/index.ts`
- `apps/api/src/public/routes.ts`
- `apps/web/src/components/public/types.ts`
- `apps/web/src/components/public/api.ts`
- `apps/web/src/components/public/__tests__/api.test.ts`
- `apps/web/e2e/helpers/fixtures.ts`
- `docs/plans/old-rows-retirement-0044.plan.md`

**연관 파일 28개** (계약 심볼 소비처 전수 grep 실측 + plan 인용 대조 마이그레이션):

- `apps/api/src/public/__tests__/routes.test.ts`, `choice-id.ts`, `analytics.ts`, `rate-limit.ts`
- `apps/api/src/study/serving-guard.ts`, `apps/api/src/db/schema.ts`
- `packages/learning-modes/src/types.ts`, `packages/shared/src/types.ts`, `exam-adapter.ts`
- `apps/web/src/components/public/` — PublicPracticeApp / PublicQuestionCard / FlipDeck / BlankNote / LandingEmbed / PracticePicker / PracticeSummary / constants.ts / `__tests__/PublicQuestionCard.test.tsx`
- `apps/web/e2e/` — happy-path / session-restoration / silent-failure-surface spec 3종 + `mock-server/server.ts`
- `migrations/` — 0004 / 0037 / 0038 + `migrations-v2/revision-watch/` 0001·0002

---

## 1. 4-PASS REVIEW 블록

── 4-PASS REVIEW ──────────────────
리뷰 방식: 독립 에이전트 5개 (scope/Surgeon/Architect/Advocate/Contract) + 발견별 적대적 반증
리뷰 범위: 변경 파일 9개 + 연관 파일 28개 (상기 §0 목록)

**Pass 1 (Surgeon)**: ✅ 19건 확인 / 🔴 0건 / 🟠 2건(MAJOR) / MINOR 4건 / N/A 3건
확인 (대표 3, 전수는 §4.1):

- `apps/api/src/public/routes.ts:397-399, 524-525` — D1 `.first()` null → 명시 404, 크래시 경로 없음. `:384-395/:510-521` try-catch + logger.error + 500
- `apps/api/src/public/routes.ts:192, 333, 431-436, 441, 552` + `choice-id.ts:45-53` — await 누락 전수 0 (issueChoiceId/buildPublicChoices/resolveChoiceId/crypto.subtle)
- routes.ts 발행 에러코드 10종 ⊆ `PUBLIC_ERROR_CODES` 10종 — `shared/errors.ts:8,27` enum 값 문자열 일치 실측
  반론: /grade·/reveal·/overview 응답이 `Record<string, unknown>`/인라인 객체라 shared 계약 필드 개명 시 서버·서버 테스트·e2e 컴파일 전부 무경고 통과 → web 런타임(`as T` 무검증 단언)에서만 발현 — MAJOR-1 로 보고.

**Pass 2 (Architect)**: ✅ 17건 확인 / 🔴 0건 / 🟠 1건(MAJOR) / MINOR 4건 / N/A 3건
확인 (대표 3, 전수는 §4.2):

- packages/shared package.json workspace 의존 0 (grep 실측) — import 방향 단방향 (learning-modes→shared, api·web→shared+learning-modes, 역방향 0)
- `apps/api/src/db/schema.ts:351-377` examQuestions 컬럼 ↔ routes.ts ServeRow(:63-73)·GradeRow(:75-82)·SELECT 4곳 shape 전수 일치
- 0044 plan 인용 실코드 대조 전수 — 0004:39-43 트리거 / 0038:42-64 default-deny / 0001:128 status CHECK / 0010:27 target_type 'exam' 부재 / 0037 partial index / 슬롯 0039·0040·0043 부재 = 전항 정확 (라인 오프셋 1건만 MINOR)
  반론: `wrangler d1 migrations apply` 는 pending 전부 순차 적용 — 예약 슬롯 0039/0040/0043 이 0044 결재~production 적용 사이 실파일화되면 Q3 결재 고지 범위 밖 마이그가 동일 불가역 배치에 실린다 (MINOR-7).

**Pass 3 (Advocate)**: ✅ 17건 확인 / 🔴 0건 / 🟠 0건 / MINOR 5건 / N/A 3건
확인 (대표 3, 전수는 §4.3):

- 공개 컴포넌트 전수 grep — innerHTML/dangerouslySetInnerHTML/eval/document.write 0건. 본문 렌더 전부 React 텍스트 노드
- 서빙 projection 에 answer/explanation 부재(`routes.ts:349-359`) + 비노출 회귀 테스트(`routes.test.ts:106-107, 380-383`) — 정답은 채점/reveal 에서만 (F-3)
- 전 인터랙션 44px+ / fieldset·legend / sr-only 라디오·정오 라벨 / aria-live=polite / role=alert / 키보드 단축키-포커스 충돌 가드 (파일:라인 §4.3)
  반론: JWT_SECRET 회전 순간의 in-flight 문항은 진성 사용자가 정답을 골라도 무음 오답 판정 + 셔플과 불일치하는 원본 위치라벨('정답 2') 노출 — 적대 반증 결과 발동 창이 좁고(문항 1개 자가치유·영속 오염 0) MAJOR→MINOR 강등 (MINOR-13).

**Pass 4 (Contract)**: ✅ 17건 확인 / 🔴 0건 / 🟠 0건 / MINOR 4건 / N/A 3건
확인 (대표 3, 전수는 §4.4):

- 계약 파일 Rule 15 준수 — 런타임 코드에 시험 특화 리터럴 0 / Rule 17 — e2e fixtures `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 경유, 'son-hae-pyeong-ga-sa' 런타임 리터럴 0
- 정답 안전(Hard Stop) — 채점 = learning-modes 단일 정본, MC-in-disguise fail-safe 서빙·채점·reveal 3경로 + 복수정답 '2,3' 처리 테스트 실재
- 0044 plan RULE #5/L3 준수 — DRAFT 라벨·코드/SQL 0줄·§9 결재란 5항 전부 미체크(☐)·트리거 우회 사실 숨김 없이 결재란 명시·PITR 4안 비교
  반론: 0044 A안(트리거 브래킷)은 ADR-046 D-2('상태 4 ABORT 유지') 취지에 마이그 예외 선례를 만든다 — Amendment 명문화 없이는 후속 감사가 0044 를 ADR-046 위반으로 오독 가능 (MINOR-15).

판정: **완료 가능** (CRITICAL 0 — 단 MAJOR 3 즉시 수정 대상, §5)
────────────────────────────────────

---

## 2. 적대적 반증 요약

MAJOR 후보 6건 전건에 독립 반증 에이전트를 붙여 실코드 재대조·트리거 분석·가드 실재 검증을 수행했다.

| 후보                                             | 반증 결과                                                                                         | 처분                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------- |
| /grade·/reveal·/overview 계약 미타이핑 (Surgeon) | CONFIRMED (반증 실패)                                                                             | **MAJOR-1 keep**      |
| SERVABLE_INPUT_TYPES 재선언 (Surgeon)            | CONFIRMED (반증 실패)                                                                             | **MAJOR-2 keep**      |
| RC-5 컴파일 강제 1/4 (Architect)                 | CONFIRMED (반증 실패)                                                                             | **MAJOR-3 keep**      |
| SERVABLE 이중 선언 (Architect 중복 발견)         | CONFIRMED, 완화 3중 확증(isServable 게이트·채점 경로 단언 미사용·현 값 동결)                      | MINOR 강등 (MINOR-8)  |
| choiceId 키 불일치 무음 오답 (Advocate)          | CONFIRMED, 트리거 과대평가 확인(동일 Worker 동일 바인딩·in-flight 1문항 자가치유·user_progress 0) | MINOR 강등 (MINOR-13) |
| RC-5 서버 표면 2축 미강제 (Contract)             | CONFIRMED, 런타임 가드·클라 폴백 실재 + 현 결함 0 확인                                            | MINOR 강등 (MINOR-17) |

REFUTED(거짓 양성) 0건 — 발견의 사실 주장은 전건 실코드로 확증됐다.

---

## 3. 확정 발견 — MAJOR 3 (즉시 수정 대상)

### MAJOR-1 [Surgeon] /grade·/reveal·/overview 응답이 계약 타입 미적용 — RC-5 '컴파일 강제'가 서버 4엔드포인트 중 /next 1곳만 실재

- **파일**: `apps/api/src/public/routes.ts:485-492, 573-580, 268-272`
- **내용**: RC-5 의 목적은 '계약 변경 = shared 1곳 → 세 표면 컴파일 강제'(public-learning-contract.ts:8)인데, 서버측은 /questions/next 만 `const out: PublicNextQuestion`(routes.ts:349)으로 타입 강제되고, /grade 는 `const body: Record<string, unknown>`(:485), /reveal 도 `Record<string, unknown>`(:573), /overview 는 무주석 inline 객체(:268-272)로 반환한다. shared 에서 PublicGradeResult.correctChoiceIds 를 개명/필드 추가해도 서버는 컴파일 통과 → web(계약 타입 소비)과 런타임 shape drift. routes.test.ts 도 응답을 `Record<string, unknown>` 캐스트로 검증하므로 계약 개명 시 서버 테스트는 여전히 PASS — 드리프트는 web 런타임에서만 발현.
- **확인 증거**:
  - routes.ts:349 — /next 만 `const out: PublicNextQuestion` 타입 강제 실재
  - routes.ts:485 `const body: Record<string, unknown> = { isCorrect, correctAnswer }` — PublicGradeResult 미참조 (grep: 파일 내 import 0)
  - routes.ts:573 /reveal 동일 패턴 — PublicRevealResult 미참조
  - routes.ts:268-272 /overview inline 객체 — PublicOverview 미참조
  - public-learning-contract.ts:8 '계약 변경 = 여기 1곳 → 세 표면 컴파일 강제' 선언과 불일치
- **반론(Devil's Advocate)**: optional 필드 생략(explanation 없으면 필드 자체 생략) 때문에 Record 를 쓴 것이고, e2e mock 이 현행 shape 를 고정하므로 주요 플로우 드리프트는 e2e 에서 발현될 수 있다. 다만 mock 도 untyped inline 이라 '컴파일' 강제는 아니며, 조건부 스프레드 + `satisfies PublicGradeResult` 로 생략 의미를 유지한 채 타입 강제가 가능하므로 반론이 해소책을 무효화하지 못한다.
- **적대 반증 판정: CONFIRMED (keep MAJOR)** — 발견의 모든 확인 항목 재확증. 서버 테스트는 `as Record<string, unknown>` 캐스트 7곳(:100,:122,:198,:210,:228,:406,:417)으로 계약 타입 참조 0 — 계약 필드 개명 시 컴파일·런타임 모두 PASS. web 소비측은 `publicFetch<PublicGradeResult>` typed generic + 런타임 검증(zod) 없음 → 드리프트 시 web 이 undefined 를 조용히 읽는다(예: correctChoiceIds 개명 → MC 정답 하이라이트 무음 소실). e2e mock server(:354~399)도 무타입 inline — grade/reveal/overview 컴파일 강제는 e2e 표면에도 없다. 현행 응답 shape 는 계약과 정합(활성 버그 아님·잠복 결함)이나, ① RC-5 핵심 보증이 서버 3/4 에서 허구 = 문서가 거짓 안전감 부여 ② 드리프트 시 검출 체인 전체(typecheck→api test→e2e compile) 무음 통과·무인증 공개 표면 web 런타임에서만 발현 ③ 수정이 국소·무위험 — MAJOR 유지.
- **수정안**: `const body = { isCorrect, correctAnswer, ...(explanationOk ? { explanation } : {}), ...(correctChoiceIds ? { correctChoiceIds } : {}) } satisfies PublicGradeResult;` 패턴으로 3개 핸들러 전환 (reveal=PublicRevealResult, overview=PublicOverview).

### MAJOR-2 [Surgeon] SERVABLE_INPUT_TYPES 리터럴 재선언 — shared PUBLIC_SERVABLE_INPUT_TYPES 를 api 가 소비하지 않아 '재선언 해소' 목적의 잔여 이중선언 + 무검증 캐스트

- **파일**: `apps/api/src/public/routes.ts:60, 329`
- **내용**: routes.ts:60 이 `const SERVABLE_INPUT_TYPES: readonly InputType[] = ['multiple_choice', 'fill_blank']` 로 서빙 가능 목록을 재선언한다. grep 실측: apps/ 전체에서 shared `PUBLIC_SERVABLE_INPUT_TYPES` 소비 0건(정의·자체 테스트뿐). 계약 파일 헤더(:13-14)의 '동치는 각 소비 측 테스트가 고정' 약속에 해당하는 api 측 동치 고정 테스트도 부재. 계약에 타입을 추가하면 서버 SQL IN 필터(:239, :291)는 stale 인 채 :329 의 `as PublicServableInputType` 단언이 컴파일 에러를 은폐한다. api 는 이미 @thepick/shared 를 import 하므로(:22-30) 상수 직접 소비 가능 — 역의존 제약이 적용되지 않는 위치다.
- **확인 증거**:
  - routes.ts:60 — 리터럴 재선언 실재 (InputType[] 타이핑, PUBLIC_SERVABLE_INPUT_TYPES 미소비)
  - grep 'PUBLIC_SERVABLE_INPUT_TYPES' apps/ packages/ → hit = shared 정의(:18-19) + shared 자체 테스트뿐 (api/web 소비 0)
  - routes.ts:329 `resolveInputType(row.input_type) as PublicServableInputType` — 무검증 타입 단언
  - public-learning-contract.ts:13-14 '동치는 각 소비 측 테스트가 고정' — api 측 해당 테스트 부재 (routes.test.ts 전문 확인)
- **반론(Devil's Advocate)**: 현재 두 목록 값은 동일하고, 서빙 가능 타입이 늘어나는 변경(예: essay 공개 지원)은 어차피 isServable·채점 분기 대공사라 리스트 하나 놓칠 가능성은 낮다는 반론이 가능하다. 그러나 그 대공사 시점이야말로 다중 선언이 하나 누락되는 전형적 드리프트 창이며, import 1줄로 제거 가능한 표면을 남길 이유가 없다.
- **적대 반증 판정: CONFIRMED (keep MAJOR)** — 4개 확증 전건 재확인. :60 타이핑이 learning-modes 4원소 광의 유니온이라 'essay' 추가가 컴파일 에러를 내지 않음. routes.ts:84-85 자체 주석("PublicServableInputType 을 그대로 소비 — 인라인 재선언 금지")과 값 목록 재선언의 내부 긴장 실재. isServable 런타임 가드로 오늘 터지는 경로는 없으나(계약 축소 드리프트 시 404 = fail-safe 방향), 직전 기술부채 처분(RC-5/M-06)의 명시 보장이 거짓인 상태 + 약속된 테스트 부재 + 1줄로 제거 가능한 드리프트 표면 = MAJOR 유지.
- **수정안**: routes.ts:60 을 `import { PUBLIC_SERVABLE_INPUT_TYPES } from '@thepick/shared'` 소비로 교체 (`readonly PublicServableInputType[]` ⊂ `readonly InputType[]` 이라 SQL 바인딩·find 사용처 무수정 호환). :329 캐스트는 유지하되 근거 주석이 계약 상수와 동일 원천임을 명시.

### MAJOR-3 [Architect] RC-5 컴파일 강제가 /next 한 경로에만 실현 — shared 계약 변경이 서버·mock 에서 무경고 통과

- **파일**: `apps/api/src/public/routes.ts:485, 573, 268-272` (+ `apps/web/e2e/mock-server/server.ts:328-331, 373-379, 392-398`)
- **내용**: MAJOR-1 과 동일 결함을 Architect 렌즈(연계 표면)에서 독립 발견 — e2e mock-server 의 overview/grade/reveal 도 인라인 무타입 객체(타입 경유는 next 픽스처 fixtures.ts:235 만). 클라이언트는 api.ts:107 `(await res.json()) as T` 단언 소비이므로 shared 에서 grade/reveal/overview shape 변경 시 서버·mock 은 컴파일 그대로 통과, 클라 런타임에서 undefined 로 터진다 — RC-5 가 해소했다고 주장하는 바로 그 드리프트 클래스가 3/4 응답에 잔존.
- **확인 증거**:
  - routes.ts:22-30 — shared import 목록에 PublicChoice/PublicNextQuestion/PublicServableInputType 만 존재, GradeResult/RevealResult/Overview 부재
  - routes.ts:349 — /next 만 타입 강제 확인
  - api.ts:107,130,138,142 — 클라가 세 타입을 `as T` 단언 소비 (런타임 검증 0)
  - mock-server/server.ts:373-379,392-398 — mock grade/reveal 응답 인라인 객체(계약 타입 미경유)
- **반론(Devil's Advocate)**: routes.test.ts 449줄이 실제 응답 shape 을 행위 수준으로 고정하므로 현 시점 드리프트는 테스트가 잡을 가능성이 있다. 그러나 테스트는 shared 계약이 아닌 서버 자체 기대값을 고정하므로 shared 개정 시 양쪽이 함께 구식화되는 시나리오는 못 잡는다.
- **적대 반증 판정: CONFIRMED (keep MAJOR)** — "테스트가 잡는다" 가설 격추(routes.test.ts 는 shared 계약 타입 import 0 — 계약 개정 시 서버와 테스트가 함께 구식화되어 green 유지). "E2E 가 잡는다" 가설 격추(mock 도 무타입 stale — 컴파일 게이트 대체 불가, 커버 플로우 한정 런타임 발현뿐). "옵셔널 생략 의미론 때문에 불가" 가설 격추(JSON.stringify 가 undefined 자연 생략 + 조건부 스프레드 양립). 현 시점 정합(활성 버그 아님)이나 헤더 선언이 1/4 만 진실인 문서-실코드 불일치는 후속 세션이 검증을 건너뛰게 만드는 오염원 클래스(CLAUDE.md 실수 로그의 stale 정본 패턴) — MAJOR 유지.
- **수정안**: MAJOR-1 수정안과 동일 + mock-server 의 grade/reveal/overview 핸들러 반환값에 `satisfies PublicGradeResult` 등 적용.

> **수렴 참고**: MAJOR-1(Surgeon)과 MAJOR-3(Architect)은 동일 결함의 독립 이중 발견(코드 정합성 축 / 연계 표면 축)이다 — 수정은 1회 작업으로 양건 동시 해소(routes.ts 3핸들러 satisfies + mock-server 3핸들러 satisfies).

---

## 4. 확정 발견 — MINOR 17 (보고, 처분 권고 포함)

### Pass 1 — Surgeon (4건)

**MINOR-1** `apps/web/src/components/public/api.ts:67` — publicErrorMessage 의 `code in ERROR_MESSAGES` 가 프로토타입 체인 키('toString','constructor','valueOf' 등)에 true → `ERROR_MESSAGES[code as PublicErrorCode]` 가 함수를 반환하는 타입 거짓 경로. code 는 서버 body.error 원문(:90-91)이라 현행 서버는 해당 코드를 발행하지 않지만 방어선이 얇다.

- 확인: api.ts:67 `in` 연산자 실재(ERROR_MESSAGES 는 일반 객체 리터럴 :23-34) / api.ts:88-93 code = 서버 응답 원문 / api.test.ts:38-42 미지 코드 폴백 테스트는 'SOMETHING_NEW' 만 커버(프로토타입 키 미커버)
- 반론: 공격자가 응답 body 를 통제하려면 이미 MITM 성립 — 실전 발현 확률 극히 낮음(그래서 MINOR). 단 함수가 문자열화되어 노출되면 '기술 에러 비노출' 원칙이 깨진다.
- 수정안: `Object.hasOwn(ERROR_MESSAGES, code)` 로 교체.

**MINOR-2** `docs/plans/old-rows-retirement-0044.plan.md:63` — §4 ③ '0038:41-64 원문 복제' 인용 라인 오프셋: 실코드 대조 결과 0038:41 은 주석행, CREATE TRIGGER 본문은 42-64행. 'byte-수준 동일 유지 의무'까지 명시하는 plan 이라 복제 범위 모호 시 G-OLD 게이트 byte-diff 기준이 흔들린다. 그 외 인용(0004:39-43 / 0001:128 / 0010 'exam' 부재 / 0037 / 0042 / 슬롯 0039·0040·0043 부재)은 전수 실코드 일치.

- 확인: 0038:41 주석행·:42 CREATE TRIGGER 시작·:64 END; 실측 / 0001:128 status CHECK 인용 정확 / 0010:27 target_type CHECK 인용 정확 / migrations/ ls — 0039/0040/0043 부재 + 0041/0042 실재 = plan §6 정합
- 반론: §4 헤더의 '작성 시점 migrations/ 재실측 의무'가 있어 실작성자가 재확인할 것 — 실해 없음 유력. 다만 byte-match 게이트 기계화 시 문서가 정본이 되므로 지금 고정이 싸다.
- 수정안: §4 를 '0038:42-64 (CREATE TRIGGER~END;) 원문 복제, WHEN enumeration byte-동일' 로 정정.

**MINOR-3** `apps/web/src/components/public/PublicPracticeApp.tsx:61-72` — fetchNext 중복 회피 루프가 문항당 최대 3회 순차 /next 호출 → 무인증 per-IP rate limit 버짓 배속 소모. 429 시 사용자는 원인(재시도 관성) 불명의 '요청이 많다' 문구만 본다. 크래시 아님·loadError 정직 표시 = MINOR.

- 확인: :63-72 for i<3 + 3회 전부 중복 시 마지막 후보 수용(무한루프 없음) / routes.ts:203-217 rate limit 전 핸들러 선행 / api.ts:39,71-75 429→'rate_limited'→ErrorPanel 경로 실재
- 반론: 한도가 넉넉하면(60/min 급) 체감 불가·소풀 필터에서 3회 풀소진 드묾. 반대로 한도 하향 운영 변경 시 첫 번째로 터지는 지점.
- 수정안: servedIds 포화(overview 집계 활용) 판단 시 재시도 생략 또는 상한 1회 축소.

**MINOR-4** `apps/web/src/components/public/constants.ts:19` — PracticeModeMeta.inputType 이 광폭 InputType(essay/calc 포함 4-유니온) — 계약의 PublicServableInputType 미사용으로 'essay' 오기입을 컴파일이 못 잡고, 서버 normalizeInputTypeParam(routes.ts:125-128)이 null(미필터) 무음 강하해 해당 모드가 의도와 다른 타입을 서빙.

- 확인: constants.ts:9,19 실측 / public-learning-contract.ts:19 PublicServableInputType 존재(web types.ts 미재수출) / routes.ts:125-128 무음 강하 확인
- 반론: 현행 메타 3건 값 전부 정확(mc/blank/flip) + 모드 추가 빈도 낮음 — 실해 0. 다만 무음 강하와 결합된 광폭 타입이라 오기입 발견 경로가 UX 관찰뿐.
- 수정안: `PublicServableInputType | null` 로 협소화 + types.ts re-export 추가.

### Pass 2 — Architect (4건)

**MINOR-5** `apps/api/src/public/routes.ts:214, 325, 345, 399, 402, 413, 428, 445, 465, 474` — 서버 에러코드 발행이 미타이핑 raw 리터럴 — 발행 코드 ⊆ PUBLIC_ERROR_CODES 를 강제하는 장치가 api 측에 없음. 서버가 shared 미등재 코드를 발행하는 방향의 드리프트는 어디서도 안 잡힘. 완화: 클라 publicErrorMessage 가 미지 코드를 INTERNAL_ERROR 문구로 폴백 = graceful.

- 확인: raw string c.json 발행 실재 / shared/errors.ts:8,27 — 현재 클라 매핑과 값 일치(우연 아닌 값 일치) 확인 / api.test.ts:38-42 미지 코드 폴백 테스트 실재
- 반론: 폴백이 있어 최악도 '부정확하지만 무해한 안내'. 단 kind 분류(api.ts:73)가 코드 문자열 결합이라 미등재 코드가 분류 오류(no_question→server)로 이어지면 재시도 UX 가 달라진다.
- 수정안: `const errJson = (c, code: PublicErrorCode, status) => c.json({ error: code }, status)` 헬퍼로 발행측 컴파일 강제.

**MINOR-6** `apps/web/src/components/public/constants.ts:5, 50-54` — '서버가 subject 목록 API 를 제공하지 않으므로' 주석이 /questions/overview(subjects 제공)와 모순 — 과목 진실원 이원화(하드코딩 픽커 vs 서버 집계 지도)가 같은 화면(picker phase)에 동시 렌더. D1 subject 개정 시 지도에는 보이는 과목이 픽커 필터로는 NO_QUESTION 비대칭.

- 확인: public-learning-contract.ts:59-67 PublicOverview.subjects / routes.ts:222-273 overview 실반환 / PublicPracticeApp.tsx:224-226 동시 렌더
- 반론: 불일치 시 NO_QUESTION 정직 강하 = 무음 오동작 아님 + 1차 3과목 사실상 불변. 그래도 정본(overview)이 같은 표면에 있으므로 통일이 저비용.
- 수정안: 픽커 과목 옵션을 fetchPublicOverview 파생(실패 시 상수 폴백) + 주석 현행화.

**MINOR-7** `docs/plans/old-rows-retirement-0044.plan.md:86 (§6), 39 (§4)` — §6 pending 마이그 고지(0038·0041·0042·0044)가 시점 의존 — 예약 슬롯 0039/0040/0043 이 production 적용 전 실파일화되면 Q3 결재 고지 범위 밖 마이그가 동일 배치로 적용됨. §4 재실측 의무는 슬롯 충돌만 다루고 §6 시퀀스 고지 범위 재확인은 미명시.

- 확인: migrations/ 실측 0038→0041,0042 (0039/0040/0043 부재) / wrangler.toml:51,148,221 3환경 단일 migrations_dir / §6:86 서술이 현 스냅샷 기준으로만 참
- 반론: 세 슬롯은 각자 별도 L3 결재 게이트 보유 + staging 선적용에서 발각될 것. 그래도 '결재된 것 = 적용되는 것' 불변식을 절차 우연에 맡기는 형태.
- 수정안: §6 에 'production 적용 직전 `wrangler d1 migrations list` pending 실측 → Q3 고지 목록 불일치 시 STOP' 1행 추가(G-OLD pre 게이트 편입 가능).

**MINOR-8** `apps/api/src/public/routes.ts:60, 329` — [MAJOR→MINOR 적대 반증 강등] SERVABLE_INPUT_TYPES 이중 선언 잔존(Architect 렌즈 독립 발견, MAJOR-2 와 동일 표면). 반증에서 확증된 완화 3중: (a) isServable(:159-170)이 진짜 서빙 게이트 — :60 단일 편집만으로는 와이어 오염 불가(2+개소 협조 편집 전제, 드리프트 시 404 NO_QUESTION fail-safe) (b) 채점 경로(/grade :405, /reveal :531)는 단언 미사용 + essay/calc 명시 422 거부 — 관통해도 오채점 아닌 채점 거부 = 정답 100% 불변 비침해 (c) 두 목록 현 값 일치(2원소 동결) = 현시점 결함 0. 순수 잠재 드리프트 부채로 강등.

- 확인: grep 전수 PUBLIC_SERVABLE_INPUT_TYPES 소비 = shared 자기 테스트뿐 / routes.ts:60,127,239-241,291-292 로컬 리터럴이 실 진실원 / routes.test.ts 449줄 SERVABLE 대조 0건
- 수정안: MAJOR-2 수정과 동일 작업으로 동시 해소 (`const SERVABLE_INPUT_TYPES: readonly InputType[] = PUBLIC_SERVABLE_INPUT_TYPES;` + 동치 테스트 1건).

### Pass 3 — Advocate (5건)

**MINOR-9** `apps/web/src/components/public/constants.ts:5-6, 50-57` — PracticePicker 과목 하드코딩의 근거 주석이 실코드와 모순(overview API 실재) — 드리프트 시 필터 영구 빈 상태(정직 강하이나 사용자 원인 불명). production-quality '하드코딩 금지' 문면 긴장. (MINOR-6 과 동일 주제의 UX 축 발견)

- 확인: constants.ts:5-6 주석 원문 / routes.ts:222-273 overview subject×round 트리 / PracticePicker.tsx:44-66 하드코딩 select / :5 '정직 강하' 자인 주석
- 반론: 과목·회차 제도상 사실상 불변 + 빈 상태 정직 강하 = v1 스코프 결정으로 정당화 가능. overview 전환 시 실패 처리 코드 증가 반론도 성립.
- 수정안: overview 응답을 옵션 소스로(5분 공용 캐시라 비용 0) + 상수는 로딩 전 폴백 강등. 최소 주석 정정.

**MINOR-10** `apps/api/src/public/routes.ts:377, 504` — 공개 무인증 표면의 VALIDATION_ERROR 응답에 zod `error.format()` 내부 구조 원문 노출 — 클라는 details 미소비라 순수 잉여 노출(공격자 정찰 편의 + 계약 밖 필드 위생).

- 확인: :377 grade / :504 reveal 동일 패턴 / api.ts:87-99 클라 body.error 만 파싱 / 계약 정본 에러 와이어 = {error: code} 축만
- 반론: 필드명은 요청 형식으로 자명 + 디버깅 유용. 다만 같은 파일이 404 통합으로 '정보 노출 최소'(:398)를 스스로 실천하는 것과 비대칭.
- 수정안: details 제거 또는 `ENVIRONMENT !== 'production'` 한정 동봉.

**MINOR-11** `apps/web/src/components/public/PublicPracticeApp.tsx:61-71, 130-141, 156-163` — 세션 루프 엣지 2건: ① '건너뜀'만 반복 시 attempts 미집계로 진행 '1/10' 고착 = 세션 영구 미종료(요약 도달 불가, 탈출구는 ← 모드 선택뿐) ② 문항당 최대 3연속 /next 재시도의 rate limit 소모(MINOR-3 과 동일 기전의 UX 축).

- 확인: :156-163 skipped → advance(attempts.length) 증가 없음 / :130-141 summary 전이 조건 / :61-71 3회 재시도 / routes.ts:203-217 선행 rate limit
- 반론: 무한 건너뜀은 실사용 드묾 + 탈출구 상시 노출. 재시도도 중복 수용 폴백이 있어 기능 실패 아님. rate limit 실설정값은 본 리뷰 스코프 밖 미확인.
- 수정안: 건너뜀 N회 누적 시 요약 유도 또는 '건너뜀 제외' 힌트 / 재시도 축소.

**MINOR-12** `apps/web/src/components/public/PracticeSummary.tsx:58` — 공유 카드 siteUrl 폴백에 배포 URL 하드코딩(`import.meta.env.SITE ?? 'https://thepick-study.pages.dev'`) — '루트 도메인 미정, config 주입·하드코딩 금지'(CLAUDE.md 멀티트랙) 문면 긴장. 공유 PNG 는 외부 확산 자산이라 잘못된 URL 각인은 회수 불가.

- 확인: :58 폴백 실재 / :63-69 drawShareCard 로 PNG 각인 / api.ts:17 대비(API_BASE 는 env 주입 + localhost 폴백 = 개발 한정 무해)
- 반론: 현 실배포가 실제 thepick-study.pages.dev(memory: 배포 실체)라 지금은 정확한 값 + Astro 빌드는 SITE 통상 주입. 도메인 확정 시 일괄 교체 — 최소 grep 마커는 필요.
- 수정안: 폴백을 빈 문자열(URL 줄 생략) 또는 SITE 미설정 fail-loud(astro config assert) 승격.

**MINOR-13** `apps/api/src/public/routes.ts:430-442` — [MAJOR→MINOR 적대 반증 강등] choiceId 키 불일치(JWT_SECRET 회전) 시 무음 오답 판정 + 정답 표시가 셔플과 불일치하는 원본 위치라벨('정답 2')로 강하. resolveChoiceId null → 에러 아닌 isCorrect=false(:437), correctChoiceIds 는 새 secret 재발급(:439-442)이라 서빙분과 전부 불일치 → 클라 correctChoiceTexts 가 위치라벨 원문 폴백(PublicQuestionCard.tsx:35,39), 화면 보기는 cryptoShuffle 재배열(:196) — 오답 학습 유도 UX. 반증에서 트리거 과대평가 확인: 서빙·채점 동일 Worker 동일 바인딩이라 환경 분기 실경로 부재, 유일 실트리거 = 회전 순간 in-flight 문항 1개(다음 서빙 자가치유, user_progress 0 = 영속 오염 없음) → 강등.

- 확인: :431-437 무음 오답(에러 분기 없음) / choice-id.ts:43-54,75-80 HMAC secret 결정성(키버전 없음) / PublicQuestionCard.tsx:34-40 위치라벨 폴백(테스트 :53-60 이 '3' 노출을 계약으로 고정) / :136-146,196 셔플-라벨 불일치 확정
- 반론: 회전은 드문 운영 이벤트 + 무인증 무료 표면 = 피해 창 좁음. 위조 choiceId 오답 처리는 유효성 오라클 비제공 장점 — 단 정답은 채점 후 공개(F-3)라 오라클 가치 없음 = 반론 약함.
- 수정안: ① resolveChoiceId null 을 별도 4xx(CHOICE_ID_INVALID 등재 + '문제를 새로 불러온 뒤 다시' 문구) fail-loud ② choiceId 키 버전 접두. 최소한 위치라벨 원문 폴백을 정직 문구로 교체(셔플 불일치 라벨 비노출).

### Pass 4 — Contract (4건)

**MINOR-14** `apps/web/src/components/public/constants.ts:5, 50-57` — 하드코딩 근거 문장 stale('서버가 subject 목록 API 를 제공하지 않으므로' vs /questions/overview 실재) — '하드코딩 금지' 원칙의 예외 근거가 stale 존치되면 후속 감사가 오판(MINOR-6/9 와 동일 표면의 기획 대조 축: 고칠 것이 코드가 아니라도 주석 1줄 정직화는 필수).

- 확인: constants.ts:5 원문 / routes.ts:222-273 / api.ts:137-139 fetchPublicOverview 실재 / PracticePicker.tsx:45,61 상수 소비 지속
- 반론: picker 의 '전체 과목 즉시 표시(네트워크 0)' UX 는 상수가 더 나을 수 있음 — 그렇다면 고칠 것은 주석 한 줄뿐, 심각도 MINOR 그대로.
- 수정안: 주석 정직화('overview API 실재하나 picker 는 v1 표시 상수 유지 — 후속 전환 후보') 또는 overview 전환.

**MINOR-15** `docs/plans/old-rows-retirement-0044.plan.md:32, 109` — 0044 A안(트리거 브래킷)이 ADR-046 D-2('상태 4 ABORT 유지', 0038:9,15-17,53-55) 문면과 긴장 — plan §3 은 '정책 불변' 판정 + §9 결재란에 숨김 없이 상신(RULE #5 준수)했으나, D-2 취지에 마이그 예외 선례가 생기므로 ADR-046 Amendment 명문화 없이는 후속 감사가 0044 를 위반으로 오독 가능. §9 실행 순서(:109)에 ADR-046 갱신 항목 부재.

- 확인: 0038:9,15-17,53-55 D-2 문면 / plan:32(정책 불변 판정),44-45(DROP 브래킷),109(ADR 갱신 부재) / plan:103-107 §9 Q1~Q5 에 우회 사실 명시(숨김 없음)
- 반론: '트리거는 런타임 실수 차단용, 마이그는 DDL 컨텍스트'는 업계 표준 + byte-동일 재생성이면 정책 실체 불변 — 결재 기록이 감사 추적 제공 = 문서 위생 수준.
- 수정안: §9 실행 순서에 'ADR-046 Amendment note(D-2 는 런타임 경로 차단, 결재된 마이그 브래킷은 예외) 추가' 1항 삽입 — W1 문면 정합(ADR-007/036 Amendment) 패턴 재사용.

**MINOR-16** `apps/web/src/components/public/PracticeSummary.tsx:58` — siteUrl 폴백 배포 URL 리터럴 인라인(MINOR-12 와 동일 표면의 기획 대조 축: 서브도메인 {exam}.thepick.co.kr 전환 시 SITE 미설정 빌드가 구 pages.dev 워터마크를 유포물에 각인 — 잔존 수명 김. 현 배포 실체와는 일치 = 동작 결함 아님).

- 확인: :58 리터럴 원문 / CLAUDE.md 멀티트랙 '도메인 config 주입·하드코딩 금지' 문면 / memory project_deployment_reality — 값 자체는 현재 정확
- 반론: import.meta.env.SITE 는 Astro 표준 config 주입 + 서브도메인 전환은 빌드 설정 일괄 변경 동반 = 실사고 창 좁음.
- 수정안: 폴백을 공용 상수 모듈로 승격(단일 선언화) 또는 SITE 미설정 시 상대 표기 강하.

**MINOR-17** `apps/api/src/public/routes.ts:60, 84-85, 329` — [MAJOR→MINOR 적대 반증 강등] RC-5 '세 표면 컴파일 강제' 선언 대비 서버 표면 2개 축 미강제: ① 서빙 타입 값 배열 이중 선언(MAJOR-2 표면) ② 서버 발행 에러코드 리터럴 비강제(15곳 — :214,325,345,399,402,413,428,445,465,474,525,528,547,560,564. api.ts:21 '서버가 코드를 추가하면 여기 컴파일 에러로 강제' 주석은 서버 자발 등재 시에만 성립 = 단방향) ③ web api.ts:113 NextQuestionFilter.inputType 광폭. 반증에서 완화 3중 확증(isServable 게이트로 :329 캐스트 실안전 / 현 발행 코드 전수 정본 등재 = 현시점 드리프트 0 / 미등재 코드도 클라 폴백 = 크래시 아닌 문구 저하) — 결함 본질은 선언 정직성 + 미래 드리프트 위생 → 강등.

- 확인: public-learning-contract.ts:8,18-19 선언+정본 / routes.ts:60 이중 선언·:329 캐스트·:84-85 '인라인 재선언 금지' 자기 주석 / grep 전수 소비처 = shared 자체 테스트뿐 / routes.test.ts 동치 assert 부재 / api.ts:23,113 — 클라측 Record 강제는 이행 + Filter 광폭
- 반론: 현 시점 값 3표면 전부 일치 + shared 불변식 테스트 리터럴 고정 = 정본 변경 시 인간이 반드시 테스트를 만짐 → 실질 드리프트 확률 낮음. 그러나 그 방어는 routes.ts:84-85 자기 주석 및 RC-5 처분 명분과 정면 모순 — 코드를 고치든 선언을 정직화하든 한쪽 정합은 필요.
- 수정안: ① 정본 소비 교체(MAJOR-2 와 동일 작업) ② `satisfies PublicErrorCode` 또는 typed helper ③ Filter 협소화(MINOR-4 와 동일 작업).

> **처분 묶음 참고**: MAJOR-1=MAJOR-3(동일 수정), MAJOR-2=MINOR-8=MINOR-17① (동일 수정), MINOR-4=MINOR-17③ (동일 수정), MINOR-6=MINOR-9=MINOR-14 (동일 표면), MINOR-12=MINOR-16 (동일 표면), MINOR-3≈MINOR-11② (동일 기전) — 실제 수정 작업 단위는 크게 8~10개.

---

## 4-2. Pass별 확인 증거 전수 (규칙 2 — 0건/PASS 근거)

### 4.1 Pass 1 — Surgeon (PASS 19 / N/A 3)

- PASS: D1 .first() null 경로 — apps/api/src/public/routes.ts:397-399, 524-525 (row===null → 명시 404, 크래시 경로 없음), :384-395/:510-521 try-catch + logger.error + 500
- PASS: D1 .all() 실패 경로 — routes.ts:234-247 (overview), :312-320 (next) try-catch → INTERNAL_ERROR 500, 빈 catch 0
- PASS: await 누락 — routes.ts:192 issueChoiceId await, :333 buildPublicChoices await, :431-436 resolveChoiceId await, :441/:552 정답 choiceId 재발급 루프 await, choice-id.ts:45-53 crypto.subtle 전부 await — 누락 0
- PASS: 빈 배열/경계값 — routes.ts:322-326 candidates.find 실패 → NO_QUESTION 404, overview servable 0건 → total 0 + subjects [] (routes.test.ts '서빙 가능 문항 0' 케이스 실재), cryptoShuffle length≤1 루프 미진입(routes.ts:139)
- PASS: randomIntBelow — routes.ts:130-134 maxExclusive 는 항상 i+1≥1 이라 %0 NaN 경로 없음 (2^32 모듈로 편향은 보기≤5 표시셔플 용도로 무해)
- PASS: NaN 가드 — routes.ts:117-122 normalizeRoundParam parseInt→Number.isInteger+양수 검증, api.ts:96-99 Retry-After Number.isFinite 가드
- PASS: 에러 처리(무음 금지) — analytics.ts:49-67 try-catch → console.warn(빈 catch 아님), api.ts:84-85 fetch 실패 → PublicApiError('network') 전파, :89-94 JSON 파싱 실패 → code=null 폴백(일반 문구), LandingEmbed.tsx:27-30 실패 → collapsed(P4-D2 문서화 폴백), PublicPracticeApp.tsx:49-51/:119-121 warn — 전 파일 빈 catch 0
- PASS: 에러코드 전수 정합 — routes.ts 발행 10종(NO_QUESTION/QUESTION_NOT_FOUND/QUESTION_UNAVAILABLE/QUESTION_HAS_NO_ANSWER/QUESTION_NOT_GRADABLE/TOO_MANY_REQUESTS/CHOICE_ID_REQUIRED/ANSWER_REQUIRED + ErrorCode.VALIDATION_ERROR/INTERNAL_ERROR) ⊆ PUBLIC_ERROR_CODES 10종 — shared/errors.ts:8,27 enum 값 문자열 일치 실측
- PASS: shared index 배선 — packages/shared/src/index.ts:12 public-learning-contract 수출, 심볼명 기존 수출과 충돌 0 (messages.ts/errors.ts grep PUBLIC\_ 0건)
- PASS: 계약 불변식 테스트 — packages/shared/src/**tests**/public-learning-contract.test.ts:12 (2종 고정), :16-19 (중복 0·대문자 형식) — 단 api 측 동치 고정 부재는 MAJOR-2 로 별도 보고
- PASS: choice-id — choice-id.ts:75 길이 불일치 조기 null, :76-80 ≤5회 HMAC 재계산 매칭 실패 → null → 호출측 오답 처리(routes.ts:437), 위조 choiceId 테스트 실재(routes.test.ts 'MC 위조/손상')
- PASS: rate-limit — rate-limit.ts:26-28 바인딩 미설정 시 handleMissingBinding(auth 와 동일 fail-open dev / fail-closed prod 재사용), pepper 미설정 폴백 documented
- PASS: 서빙 자격 fail-safe — routes.ts:159-170 isServable + serving-guard.ts:41-49 (answer null 조기 false = 별도 422 경로 보존, GUARDED_EXAM_TYPES 1차 한정으로 2차 숫자 정답 오차단 방지), learning-modes parseMcChoices 무음 filter 금지·중복 보기 거부 실측(mc-choices.ts:55-)
- PASS: cache 주석↔실코드 — routes.ts:221 '5분 공용 캐시' 는 index.ts:140 cachePolicyMiddleware + middleware/cache-policy.ts:68-71 (overview 200 한정 public max-age=300, 그 외 /api/public/\* no-store :77-80) 로 실재 — 핸들러 내 미설정은 의도(마운트 계층 소관, routes.test.ts 주석 정합)
- PASS: 경계 강제 회귀 테스트 — routes.test.ts flagged 서빙 제외·2차 서빙 제외·2차 id 채점 404·flagged 채점 404·reveal 동일 경계·MC-in-disguise 서빙/채점/reveal 422 전부 실재 (449줄 전문 열람)
- PASS: web fixtures 정본 alias — e2e/helpers/fixtures.ts:235 PublicQuestionFixture = PublicNextQuestion (인라인 재선언 제거), happy-path/session-restoration/silent-failure 3 spec grep 'public' 0건 = 파급 0
- PASS: mock-server 카운터 키 — state.ts:24-27 publicNext/publicGrade/publicReveal/publicOverview 등재, recordCall 미등록 키 크래시 경로 없음; unhandled 라우트 fail-loud 404 (server.ts:401-404)
- PASS: React 상태 경계 — PublicPracticeApp.tsx:45,73,79,83 sessionGen 세대 가드(구세션 in-flight 응답 폐기), :56-85 fetchNext 중 loading 전환으로 카드 unmount→재mount = 문항 상태 초기화 이중 방어(useEffect [question.id] 병행), PracticeSummary.tsx:51 total>0 0-나눗셈 가드, BlankNote.tsx:62 hintsUsed 상한 Math.min
- PASS: 플랜 인용 실코드 대조 — 0004:39-43 prevent_exam_questions_update 전면 ABORT / 0038:39 DROP+42-64 default-deny(상태 4컬럼 ABORT 유지) / 0001:128 CHECK('active','deprecated','flagged') / 0010:27 target_type CHECK 'exam' 부재 / 0037 partial index WHERE status='active' / 0042 트리거 2단 = knowledge_nodes·knowledge_edges·status_transitions 전용(exam_questions 무관) / migrations/ 0039·0040·0043 부재 = 슬롯 예약 서술 정합 — 전부 일치 (라인 오프셋 1건만 MINOR 보고)
- N/A: 산식 정밀도(numeric_value vs value 혼용) — 본 변경셋에 수치 연산·formulas 접촉 0 (공개 표면은 essay/calc 서빙·채점 명시 거부, routes.ts:168-169/:469-475)
- N/A: Formula Engine 동적 실행 — 변경셋 grep eval/Function/new Function 0건, math.js 미접촉 (formula-engine 패키지 무변경)
- N/A: Vectorize/Claude API/pdfplumber await — 본 변경셋 해당 호출 0건 (D1 + crypto.subtle + fetch 만)

### 4.2 Pass 2 — Architect (PASS 17 / N/A 3)

- PASS — Import 방향 단방향: packages/shared/package.json deps에 workspace 의존 0(grep 실측) / learning-modes→shared(:24) / api·web→shared+learning-modes — 역방향(shared→learning-modes) 없음. 계약 모듈은 리터럴 재선언(public-learning-contract.ts:13-14)으로 역의존 회피, shared 테스트(:4-5)가 리터럴 동결
- PASS — Workers 제약: apps/api/src/public/routes.ts:132 crypto.getRandomValues / choice-id.ts:45,52 crypto.subtle(Web Crypto) — fs/path·Node 전용 API 0. /grade MC 경로 HMAC 재계산 ≤5회+재발급 ≤5회(:431-441) = CPU 상수 상한
- PASS — D1 스키마 ↔ 쿼리 shape: apps/api/src/db/schema.ts:351-377 examQuestions 컬럼(id/year/round/question_number/subject/content/input_type/answer/distractors/explanation/status/exam_type)과 routes.ts ServeRow(:63-73)·GradeRow(:75-82)·SELECT(:236,305,385,512) 전부 실컬럼 일치. status enum·inputType enum(INPUT_TYPES) 정합
- PASS — 라우트 마운트·CORS 경계: apps/api/src/index.ts:135 `/api/public/*` cors credentials:false + :176 app.route('/api/public', createPublicRoutes()) — 인증 study 라우터와 완전 분리 확인
- PASS — 캐시 경계: middleware/cache-policy.ts:68-71 overview 만 200 한정 public max-age=300, :77-80 그 외 /api/public/\* no-store(셔플 서빙·정답 노출 응답 공유캐시 금지) — routes.ts:221 주석의 '5분 공용 캐시'가 실배선으로 존재
- PASS — 경계 강제(exam_type/status): routes.ts:56-57 FIXED_EXAM_TYPE/FIXED_STATUS 서버 고정, 서빙(:285-286)·채점(:387)·reveal(:514)·overview(:238) 4경로 전부 WHERE 포함 — 클라 파라미터 경로 없음
- PASS — 에러코드 값 일치: shared/errors.ts:8,27 ErrorCode.VALIDATION_ERROR='VALIDATION_ERROR'/INTERNAL_ERROR='INTERNAL_ERROR' — routes.ts 의 enum 경유 발행 2종이 PUBLIC_ERROR_CODES(:73-84) 문자열과 일치 → 클라 매핑(api.ts:23-34) 적중 확인
- PASS — 클라 매핑 전수 테스트: apps/web/src/components/public/**tests**/api.test.ts:30-36 PUBLIC_ERROR_CODES 전수 문구 보유 + 코드 원문 비노출 검증, :38-42 미지 코드 폴백 — RC-5 클라측 강제 실재
- PASS — e2e fixtures 정본 전환: apps/web/e2e/helpers/fixtures.ts:8,234-235 PublicQuestionFixture = PublicNextQuestion(shared 직수입) — 인라인 shape 재선언 제거 확인. mock-server next 응답(:342,344)이 이 픽스처 경유 = /next 계약 컴파일 강제 성립
- PASS — e2e 스펙 3종(happy-path/session-restoration/silent-failure-surface): makePublic\*/pub-q/api/public 참조 0건(grep 실측) — fixtures 개정의 파급 없음, 기존 인증 픽스처 경로 불변
- PASS — serving-guard ↔ public isServable 비대칭 정합: study/serving-guard.ts:31 GUARDED_EXAM_TYPES 1차 한정(2차 계산답 '3' 오차단 방지 근거 :25-29 주석) / public isServable(routes.ts:159-170)은 서빙 2타입 한정 — 두 가드의 판정 로직이 동일 정본(parseMcChoices/parseMcAnswerLabels/resolveInputType, learning-modes)을 공유
- PASS — 0044 plan 인용 실코드 대조: 0004:39-43 prevent_exam_questions_update 실재 / 0038:42-64 body_update 트리거 + status·superseded_by·valid\_\* ABORT(:53-56) / 0001_initial_schema.sql:128 CHECK('active','deprecated','flagged') / 0010:27 status_transitions target_type CHECK('node','formula','constant') = 'exam' 부재 / 0037:20-22 partial index active 한정 — plan §1 표 전항 정확
- PASS — 0044 슬롯·마이그 배선: migrations/ 실측 = 0038 다음 0041,0042 존재(0039/0040/0043 예약 공백) — plan §4 슬롯 배정 정합. migrations-v2/revision-watch/0001·0002 는 migrations/0041·0042 와 헤더 주석 2줄 외 동일(diff 실측) = 이원 정본 아님(동치본 라벨)
- PASS — Temporal Graph: 공개 표면 코드에 exam_questions UPDATE 0건(SELECT only — routes.ts 전수). 0044 plan 의 UPDATE 전이는 트리거 브래킷+PITR 4안 비교+§9 인간 결재 대기(RULE #5 준수)로 정직 공개 — DRAFT 라벨·코드 0줄 확인
- PASS — G-1(무기록) 정합: routes.ts:15 user_progress 기록 0 — 서버측 기록은 analytics.ts recordPublicEvent(PII 0: IP·id·본문 미기록 :52-62)뿐. 클라 진도 = local-progress(IndexedDB, PublicPracticeApp.tsx:11,110) 로컬 전용
- PASS — Rule 15/17: public-learning-contract.ts examType=string(시험 특화 리터럴 0, :11-12 주석 명시) / fixtures.ts:23 EXAM_IDS.SON_HAE_PYEONG_GA_SA 경유('son-hae' 리터럴 0). '1st' 리터럴은 exam_type(Rule 17 대상 exam_id 아님)+서버 FIXED 상수(:56) 단일 선언
- PASS — 클라 계약 소비 정합: PublicQuestionCard.tsx:35-37 correctChoiceIds→서빙 보기 텍스트 역해석(옵셔널 가드) / FlipDeck.tsx:101 reveal correctChoiceIds 옵셔널 처리 / BlankNote.tsx:52,70 reveal·grade 경유 — 계약 옵셔널 필드('없으면 생략') 전부 undefined-safe 소비
- N/A — Ontology Lock: 본 변경셋은 knowledge_nodes/edges ID 신규 생성 0(공개 표면은 exam_questions 소비만) — ontology-registry 대조 대상 없음
- N/A — truth_weight 정렬(LAW>FORMULA>CONCEPT): 공개 표면은 RAG/graph 검색 미경유(D1 exam_questions 직쿼리) — 정렬 규칙 비적용
- N/A — IndexedDB↔D1 동기화: 공개 표면 진도는 설계상 로컬 전용(G-1) — 동기화 큐 비대상(인증 표면 sw.js stub 이슈는 본 변경셋 밖)

### 4.3 Pass 3 — Advocate (PASS 17 / N/A 3)

- PASS 보안/XSS: 공개 컴포넌트 전수 grep — innerHTML/dangerouslySetInnerHTML/eval/document.write 0건 (PublicPracticeApp·PublicQuestionCard·FlipDeck·BlankNote·LandingEmbed·PracticePicker·PracticeSummary·ChoiceRow·ResultBlock·StatusPanels + lib/share-image·hangul-hint). 본문 렌더는 React 텍스트 노드(PublicQuestionCard.tsx:148, FlipDeck.tsx:95, BlankNote.tsx:105)
- PASS 보안/API키: 클라 하드코딩 시크릿 0 — API_BASE 는 env 주입(api.ts:17), choice-id 폴백 상수는 비밀 아님을 파일 자체가 문서화(choice-id.ts:29-32 'F-3 하 보안 영향 0') + production 은 JWT_SECRET 바인딩(index.ts:66)
- PASS 정답 안전/비노출: 서빙 projection 에 answer/explanation 부재(routes.ts:349-359) + 회귀 테스트 명시(routes.test.ts:106-107, 380-383 overview 정답·보기 텍스트 비노출), 정답은 채점/reveal 에서만(F-3)
- PASS 정답 안전/오채점 차단: MC-in-disguise(위치라벨 answer) 서빙·채점·reveal 3면 422/제외(routes.ts:159-170, 449-466, 556-561) + 테스트(routes.test.ts:154-159, 297-302, 433-438) + essay/calc 문자열 폴백 채점 금지(routes.ts:468-475, test 304-309) + 인증판 가드 serving-guard.ts:41-49 (1차 한정 사유 주석 실측 정합)
- PASS 정답 안전/복수정답: '2,3' 어느 보기든 정답 + correctChoiceIds 전체 표식(routes.test.ts:217-232, PublicQuestionCard.tsx:126-133 나머지 정답 보기 표식 유지)
- PASS 에러 UX: PUBLIC_ERROR_CODES 전수 → 한국어 사용자 문구 Record 컴파일 강제(api.ts:23-34) + 미지 코드 INTERNAL_ERROR 폴백(api.ts:64-69) + 코드 원문 비노출 테스트(api.test.ts:30-43) + 컴포넌트는 PublicApiError.message 만 표시(PublicQuestionCard.tsx:90-92, StatusPanels.tsx:36-43)
- PASS 상태 4종: 로딩(LoadingCard role=status, StatusPanels.tsx:8-29) / 빈 데이터(NO_QUESTION → '풀 수 있는 문제가 없다' StatusPanels.tsx:41,48 + e2e public-practice.spec.ts:129-141) / 에러(role=alert + 다시 시도 44px) / 오프라인(navigator.onLine 선검사 api.ts:78-79, kind=offline 문구 StatusPanels.tsx:42,48) / 429 Retry-After 초 표기(StatusPanels.tsx:43,52 + api.ts:95-99)
- PASS 오프라인/캐싱: sw.js:50-56 — /api/public/ SW 캐시 제외(랜덤 /next 재서빙 방지 P4-D7) + cache-policy.ts:63-78 — overview 만 public max-age=300(200 한정, 에러는 no-store), 나머지 공개 경로 no-store. routes.ts:220 주석의 '5분 공용 캐시'가 마운트 계층에서 실재함을 대조 확인(routes.test.ts:360 소관 분리 명시)
- PASS 접근성: 전 인터랙션 44px+ (PublicQuestionCard.tsx:202,218,226,246 / FlipDeck.tsx:169,178,199 / BlankNote.tsx:122,146,187 / PracticePicker.tsx:42,58,98 / StatusPanels.tsx:59 / PracticeSummary.tsx:150,171,178) + fieldset/legend(PublicQuestionCard.tsx:152-158) + sr-only 라디오·정오 라벨(ChoiceRow.tsx:48-54,69-86) + aria-live=polite 결과층(ResultBlock.tsx:22, FlipDeck.tsx:136) + role=alert 에러(PublicQuestionCard.tsx:205, BlankNote.tsx:136,166) + 키보드 단축키(1–5/Space/Ctrl+Enter)와 버튼 포커스 충돌 가드(PublicQuestionCard.tsx:107-113, FlipDeck.tsx:57-63 — '건너뜀 포커스 Space 정답 강제공개' 경로 차단 주석 실측)
- PASS 입력 검증: zod GradeBodySchema/RevealBodySchema min/max(routes.ts:87-98) + 쿼리 파라미터 정규화(subject 100자 가드/round 양의 정수/inputType 화이트리스트, routes.ts:109-128) + exam_type='1st'·status='active' 서버 고정으로 클라 파라미터 우회 경로 0(routes.ts:56-57,285-286,387-390,517) + 경계 회귀 테스트(2차/flagged 서빙·채점·reveal 거부, routes.test.ts:135-152,272-283,423-431)
- PASS rate limit/PII: 전 핸들러 선행 미들웨어 + 429/Retry-After(routes.ts:203-217) + SHA-256(IP||pepper) 해시 키(rate-limit.ts:29-33) + 바인딩 미설정 시 dev fail-open/prod fail-closed 재사용(rate-limit.ts:26-28) + AE 익명 이벤트 blobs 에 IP·userId·본문·정답 텍스트 부재(analytics.ts:50-63) + writeDataPoint 실패 무음 금지 warn(analytics.ts:64-67)
- PASS RC-5 계약 단일화: shared 정본 export(packages/shared/src/index.ts:12) → api 소비(routes.ts:27-29 + 84-85 인라인 재선언 금지 주석) → web re-export(types.ts:15-24, UI 전용 타입만 잔류) → e2e fixtures alias(fixtures.ts:8,234-235) 3표면 수렴 실측 + 불변식 테스트(public-learning-contract.test.ts:11-20 서빙 2종·에러코드 중복 0)
- PASS 계약 동치 드리프트 가드: PUBLIC_SERVABLE_INPUT_TYPES(shared) ↔ SERVABLE_INPUT_TYPES(routes.ts:60) ↔ learning-modes INPUT_TYPES(packages/learning-modes/src/types.ts:8) 값 일치 실측 + 서버 응답 유니온 축소는 isServable 통과 후에만(routes.ts:328-329)
- PASS 0044 plan 인용 실코드 정합(Advocate 소관 = 사용자 영향 축): status CHECK ('active','deprecated','flagged') = 0001_initial_schema.sql:128 실측 일치 / 0004:39-43 전면 ABORT 트리거 실측 일치 / 0038:42-64 화이트리스트 6·보호 16 실측 일치(status/superseded_by/valid_until ABORT 유지 = plan §1 '어느 쪽이든 전이 불가' 주장 참) / 0037 partial index active 한정 실측 일치 / deprecated 전이 시 공개 표면은 status='active' 필터로 자연 배제(routes.ts:238,387) = plan §2-3 주장 참. B안 불가(SQLite 저장 프로시저 부재) 판정 정확. 코드/SQL 0줄 DRAFT — stub 아닌 계획 문서로 적합
- PASS 세션 상태 경합: 세대 카운터로 이전 세션 in-flight 응답 폐기(PublicPracticeApp.tsx:44-45,73,79,83,195) + 문항 교체 시 입력 상태 초기화(PublicQuestionCard.tsx:56-62, FlipDeck.tsx:33-37, BlankNote.tsx:34-42) + LandingEmbed unmount cancelled 가드(LandingEmbed.tsx:20-34)
- PASS 무음 실패 금지: 로컬 진도 기록 실패 warn + 학습 흐름 유지(PublicPracticeApp.tsx:119-122, LandingEmbed.tsx:43-45) + 공유 이미지 실패 상태 표면화(PracticeSummary.tsx:83-88,159) + 데이터 결함 AE defect 이벤트 집계(routes.ts:339-345,422-428,457-464) + e2e 빈 상태/mock unhandled fail-loud(server.ts:400-404)
- PASS stub/TODO/빈 catch: 공개 표면 전수 grep TODO/HACK/FIXME/placeholder 0건. catch 는 전부 로깅+폴백 또는 의도 명시(api.ts:84-85 network 분류, api.ts:92-94 body 파싱 실패 code=null, LandingEmbed.tsx:27-30 접힘 축퇴 주석)
- N/A Service Worker 신규 변경: 본 변경셋에 SW 코드 수정 없음 — 기존 sw.js 의 /api/public/ 제외 정책이 신규 표면과 정합함만 확인(sw.js:50-56)
- N/A i18n 키 체계: 공개 표면은 한국어 단일 서비스로 ERROR_MESSAGES 단일 매핑이 사실상의 i18n 계층(api.ts:21-34) — 별도 i18n 프레임워크 미도입은 프로젝트 전반 상태로 본 변경셋 소관 아님
- N/A Formula Engine/동적 실행: 공개 표면은 essay/calc 를 서빙·채점 자체에서 배제(routes.ts:157,168-169,468-475)하므로 수식 연산 경로 부재

### 4.4 Pass 4 — Contract (PASS 17 / N/A 3)

- PASS: 계약 단일 정본 실재 + 3표면 소비 — packages/shared/src/public-learning-contract.ts:22-67(5개 심볼) / index.ts:12 barrel export / api routes.ts:27-29 import / web types.ts:11-24 re-export / e2e fixtures.ts:8,235 alias — grep 전수로 인라인 shape 재선언(interface) 소멸 확인
- PASS: 계약 파일 Rule 15 준수 — public-learning-contract.ts 런타임 코드에 시험 특화 리터럴 0('1st'는 12행 주석뿐), examType=string·'1st' 고정은 routes.ts:56 서버 소관으로 격리('1st'는 exam_id 아닌 exam_type 축 = Rule 17 비대상, exam-ids.ts:16 단일 선언 별도 확인)
- PASS: Rule 17 — e2e fixtures.ts:8,23 EXAM_IDS.SON_HAE_PYEONG_GA_SA 경유(픽스처는 예외 대상임에도 준수), 스코프 내 'son-hae-pyeong-ga-sa' 런타임 리터럴 0
- PASS: 정답 안전(Hard Stop) — 서빙 projection answer/explanation 비노출(routes.ts:305,349-359 + routes.test.ts:106-107,125), 채점=learning-modes 단일 정본(parseMcChoices/gradeFillBlank, routes.ts:165,415,467), MC-in-disguise fail-safe 서빙·채점·reveal 3경로(routes.ts:167,449,556 + 테스트 154,297,433), 복수정답 '2,3' 처리(routes.test.ts:217-232)
- PASS: LLM 수식 계산 금지 정합 — essay/calc 공개 표면 문자열 폴백 채점 차단(routes.ts:468-475 + routes.test.ts:304-309), Formula Engine 미경유 오채점 경로 0
- PASS: 에러코드 값 정합 — ErrorCode.VALIDATION_ERROR/INTERNAL_ERROR 문자열 값이 PUBLIC_ERROR_CODES 와 일치(packages/shared/src/errors.ts:8,27 ↔ public-learning-contract.ts:80,83), 클라 Record<PublicErrorCode,string> 컴파일 강제 + 전수 문구 테스트(api.ts:23-34, api.test.ts:30-36) + 미지 코드 INTERNAL 폴백(api.test.ts:38-42)
- PASS: 0044 plan 인용 실코드 정합(전수 대조) — ① 0004 전면 ABORT 트리거(0004:39-43) ② 0004:13-14 저장 프로시저 구상 주석 ③ 0038 트리거 본문·보호 16컬럼(0038:42-64, status/superseded_by/valid_until 포함 = 브래킷 필요성 성립) ④ 0001:128 status CHECK ('active','deprecated','flagged') = 'deprecated' 기존재 ⑤ status_transitions target_type CHECK 'exam' 부재(0010:27 node/formula/constant + 0013:131 +edge) ⑥ 0042 트리거 = knowledge_nodes/knowledge_edges/status_transitions 전용(0002_supersedes_draft_gate.sql:38-80) ⑦ 슬롯: migrations/ 최종 파일 0042, 0039/0040/0043 미존재(예약) = 0044 가용
- PASS: 0044 plan 참조 산출물 실재 — answer-corrections.json(docs/batch-load/promo-mc-distractors/), scripts/backup-d1-to-r2.sh, scripts/smoke-public-surface.mjs, 구조훼손 4 ID(Q-2019-05-021/Q-2024-10-048/Q-2025-11-047/Q-2025-11-048)·525행·36건 = incident-1st-answer-errors-20260710.md:9,23 일치
- PASS: 0044 plan RULE #5/L3 준수 — DRAFT 라벨·코드/SQL 0줄·§9 결재란 5항 전부 미체크(☐)·Q3 에 TR-0 #3/RW 게이트 동시 해소 명시(숨김 없음)·PITR 4안 비교(§3, B안 SQLite 저장 프로시저 불가 판정 정확)·Binary Gate G-OLD-1~8 기계 판정형
- PASS: serving-guard 종목 한정 정합 — GUARDED_EXAM_TYPES=1st 한정 근거(2차 계산 정답 '3' 오차단 방지) 문서화·essay/calc 비대상(serving-guard.ts:12-13,31,44) = isServable(routes.ts:159-170)과 비대칭 사유 명시
- PASS: InputType 동치 — learning-modes INPUT_TYPES(types.ts:8) ⊃ PUBLIC_SERVABLE_INPUT_TYPES, shared 불변식 테스트가 리터럴 고정(public-learning-contract.test.ts:12) + 역의존(shared→learning-modes) 금지 사유 문서화(계약 파일 12-14행) — 단 api 측 동치 테스트 부재는 MAJOR 에 귀속
- PASS: e2e mock 계약 정합 — mock-server/server.ts:313-399 public 4라우트가 실서버와 동일 코드 문자열(VALIDATION_ERROR/ANSWER_REQUIRED/CHOICE_ID_REQUIRED) + {choiceId,text} shape + overview total=Σ 불변식 파생 계산 / fixtures PublicQuestionFixture=PublicNextQuestion alias(fixtures.ts:235) 컴파일 강제
- PASS: 경계 강제 회귀 — exam_type='1st' AND status='active' 를 서빙·채점·reveal 3경로 WHERE 에 + 회귀 테스트(routes.test.ts:135-152,272-283,423-431), rate-limit 전 핸들러 선행(routes.ts:203-217)
- PASS: G-1(무인증 로컬 진도) 정합 — user_progress 기록 0, 서버 기록 = AE 익명 이벤트만(analytics.ts PII 0 문서화·id 미기록:34), 클라 = local-progress IndexedDB(PublicPracticeApp.tsx:11,101-124)
- PASS: 노드 ID 네이밍 — 스코프 내 신규 노드/엣지 ID 생성 0, 픽스처 CONCEPT-00N(fixtures.ts:105)만 = 컨벤션 정합. Ontology Lock 비대상
- PASS: stub/TODO/빈 catch/any 스캔 — 스코프 전 파일 grep: TODO/HACK/FIXME/as any/: any 0건, 빈 catch 0건(api.ts:84-85 throw 전파, :92-94 code=null 폴백 후 INTERNAL 문구 = 문서화된 graceful, LandingEmbed.tsx:27-30 접힘 강하 = P4-D2 주석 근거)
- PASS: schema.ts 정책 헤더 — 26 tables·NC-1 타입 파생 전용·트리거는 주석 표현 원칙 확인(schema.ts:1-46), 본 변경셋 스키마 무접촉
- N/A: constants 수치 ↔ 교재 원문 대조 — 본 변경셋에 교재 수치/임계값 신규 없음(web constants.ts 과목 3종·회차 5~11 은 CLAUDE.md '기출 7회분(제5~11회)' 및 production 실측 표기와 정합 확인)
- N/A: BATCH 순서 게이트 — 콘텐츠 적재 없음(0044 plan 은 SQL 0줄 DRAFT, 코드 변경은 계약 리팩터·front 전용)
- N/A: 구현 재정립서 v2.0 직접 대조 — 공개 학습 표면은 재정립서 이후 promo-1st 트랙 산출(정본 = promo-1st-free-service-scope-20260708.md §3 BE-2, routes.ts:17 인용)·재정립서 Hard Limit 축(knowledge_nodes/formulas UPDATE 금지 등)은 본 변경셋 무접촉 — 위반 신호 0

---

## 5. 최종 판정

| 등급     | 건수 | 처분                                                                                                               |
| -------- | ---- | ------------------------------------------------------------------------------------------------------------------ |
| CRITICAL | 0    | —                                                                                                                  |
| MAJOR    | 3    | 즉시 수정 대상 (프로토콜 규칙 4). MAJOR-1/3 = 동일 수정 1회, MAJOR-2 = import 1줄 + 동치 테스트 — 전건 국소·무위험 |
| MINOR    | 17   | 보고 + 처분 권고 기록 (중복 표면 묶으면 실작업 8~10개)                                                             |

**판정: 완료 가능** (4-Pass CRITICAL 0건 기준 충족)

- MAJOR 3 은 '완료' 선언 유지 조건으로 즉시 수정(또는 명시 이월 기록)이 프로토콜상 요구된다. 3건 모두 활성 버그가 아닌 잠복 방호 공백(현행 응답 shape 는 계약과 정합)이며, 수정은 `satisfies` 3핸들러 + shared 상수 소비 1줄 + 동치 테스트 1건으로 국소적이다.
- 적대 반증 결과 REFUTED 0 — 본 리뷰의 발견은 전건 실코드 확증분이다.
- 0044 plan 은 DRAFT·SQL 0줄·§9 결재란 전항 미체크 — L3 코드 착수는 진산 결재 후(RULE #5 준수 확인).
