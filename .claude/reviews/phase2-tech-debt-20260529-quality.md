# 기술부채 리뷰 — quality-engineer

- 리뷰 시점: 2026-05-29
- 리뷰 범위 (실 검증):
  - `packages/formula-engine/src/__tests__/` (15 파일 / 2,702 LOC, `batch1~5-golden`, `prc-01-precision-framework`, `sandbox/cha-02/fuz-04`)
  - `packages/parser/src/__tests__/` (7 파일 / 2,661 LOC, `batch-processor`, `constants-extractor`, `schema-validator` 1,229 LOC, `fuz-01/02`)
  - `packages/parser-1st-exam/` (3 src 파일, **테스트 0건**)
  - `packages/quality/src/__tests__/` (5 파일 / 1,143 LOC)
  - `packages/learning-modes/src/__tests__/` (7 파일 / 894 LOC, `multiple-choice/fill-blank/essay/calc/normalize/session-progress/shuffle`)
  - `packages/srs/src/__tests__/` (2 파일 / 328 LOC)
  - `packages/ai-adapter/__tests__/anthropic-adapter.test.ts` (145 LOC — sendMessage/sendVision = NOT_IMPLEMENTED throw 만 검증)
  - `packages/payment/`, `packages/study-material-generator/` (둘 다 `--passWithNoTests`)
  - `apps/api/src/__tests__/scenarios.test.ts` (978 LOC, 27 it), `no-mock-routes.test.ts` (63 LOC)
  - `apps/api/src/__tests__/helpers/d1-from-sqlite.ts` (237 LOC, SCENARIO_MIGRATIONS 33종 vs `createD1FromAllMigrations`)
  - `apps/api/src/eval/multihop-accuracy.ts` (365 LOC) + `eval/__tests__/` (multihop 186 LOC + measure-runner 222 LOC)
  - `apps/api/src/search/__tests__/` (6 파일 / 1,760 LOC) + `search/graph-walk/__tests__/graph-walk.golden.test.ts` (366 LOC)
  - `apps/api/src/study/__tests__/routes.test.ts`
  - `apps/batch/__tests__/` (10 파일) + `apps/batch/src/__tests__/` (6 파일) + `apps/batch/src/fixtures/`
  - `apps/web/e2e/` (5 specs / 491 LOC + mock-server) + `apps/web/playwright.config.ts`
  - `tasks/step-1-5-ga-1.gates.yaml` (유일한 Binary Gate yaml)
  - `docs/quality/master-test-checklist.md`, `docs/quality/test-patterns.md`
  - `migrations/` (36 파일, 0020 의도적 skip — 본 ADR 확인)
- 현 vitest PASS 카운트 가정: apps/api 643 (handoff-091)
- 모노레포 test 파일 합계: **102개** (vitest .test.ts) + 5개 Playwright .spec.ts

---

## CRITICAL (프로덕션 회귀 임박) — 8건

### C-1. G-S5 golden 데이터 부재 = "정답률 측정" 자체가 fabricate 위험 (현재 stage)

- 파일: `apps/api/src/eval/multihop-accuracy.ts:283-300` (`assertRemoteMeasurementInputs`), `docs/plans/s5-6-measurements/golden-pilot-draft.{json,md}` (인간검수 대기)
- 미커버 시나리오: production `exam_questions.related_nodes` 545/545 NULL이 **확인된 상태**에서 (handoff-091) — harness는 READY이나 golden = 진산 인간검수 pilot 12문항만 존재 (≈ 도메인 1/3, 손해평가 영역 한정). 측정 게이트가 통과되면 그 결과를 "G-S5 정답률"로 라벨링하지만, 분모가 12밖에 안 됨 → 통계 유의도 0. 진산이 "graph-augmented hit-rate=58%, baseline=42%" 같은 숫자를 보고 의사결정해도, 실제 표본 통계검정은 불가.
- 첫 회귀 발생 트리거: pilot 결과 → S5-7 A 통합 결재 → 실제로는 도메인 외 question에서 baseline≫graph 인데 학습자에게 graph 노출 결정 → 학습 효과 후퇴
- 6개월/2년 시나리오: Year 2 공인중개사 확장 시 동일 패턴 반복 — 도메인별 golden 12문항으로 "측정 완료" 라벨 영속화 → 누적 측정 부채
- 권장 조치:
  1. `multihop-accuracy.ts`의 `AggregateReport`에 **표본 신뢰구간(95% Wilson)** 필드 강제 추가 — `measured < 30`이면 markdown에 "통계 유의도 불가" 워터마크. 진산이 작은 N으로 결정 못하게.
  2. `aggregate()` 호출부 (measure-runner)에서 `measured < 30` 발견 시 stdout `WARN: low-N`. CI fail은 X (측정 자체는 차단 안함) — surface만 강제.
  3. Phase B (pilot 12 보기별 라벨) 진입 결재서에 "골든 N + 도메인 cov %" 의무 컬럼 추가.
- 우선순위 근거: G-S5는 Phase 2 진입 차단 게이트. 측정 도구가 통계 유의도 없는 N으로 G-S5 PASS 라벨 출력하면 모든 후속 단계의 거짓 전제 = CLAUDE.md "CRIT-5 5-Layer 환각 증폭" 패턴 재발.
- 현 테스트가 막을 가능성: ZERO. `multihop-accuracy.test.ts:117~144` aggregate 가 N=2~4 sample 에서 PASS — N≥30 게이트 0건.

### C-2. `parser-1st-exam` 패키지 테스트 0건 — 545 기출문항 파서가 검증 없이 production 적재 완료

- 파일: `packages/parser-1st-exam/src/exam-question-parser.ts` (252 LOC), `types.ts` (45 LOC), `index.ts` (8 LOC). 디렉토리 `src/__tests__` **부재 확인** (`ls` exit 2).
- 미커버 시나리오: `QUESTION_RE = /^\s*(\d{1,2})\.\s+(.+)/`, `CHOICE_RE = /^\s*([①②③④⑤])\s*(.+)/`, `INLINE_CHOICES_RE`, `FILENAME_RE`, `FOOTER_RE` — 5개 정규식 상태머신이 7회분(제5~11회) × 평균 ~78문항 = 545문항을 파싱했는데, **단 1개 회귀 테스트도 없음**. master-test-checklist.md §1.1 카운트에 `parser-1st-exam` 누락된 상태 (parser 136만 표기).
- 첫 회귀 발생 트리거:
  - 2027년 제12회 신규 기출 추가 시 — PDF 레이아웃 미세 변경 (footer 정규식 매칭 실패, 보기 인라인 분리 ON/OFF) → 골든 fixture 없으니 silent miss.
  - 교재 개정 시 "(1-1)" 형태 footer pattern 변경 → `FOOTER_RE` 통과 → choice 오염 → 문항 정답 어긋남.
  - Year 2 공인중개사 확장 시 — `① ~ ⑤` 외에 `1) ~ 5)` 또는 `가, 나, 다` 형식 변동 → 본 파서 적용 불가 발견이 BATCH 적재 한참 후.
- 6개월/2년 시나리오: 손해평가사 545 + 공인중개사 ~800 + … = 1,000+ 문항 골든 회귀 없이 매년 개정. 진산이 학습자 신고("정답 ①인데 ②로 채점")로 발견 → 어느 회차 / 어느 문항 / 어느 정규식이 문제인지 디버깅 불가.
- 권장 조치:
  1. `packages/parser-1st-exam/src/__tests__/exam-question-parser.test.ts` 신규 — 회차당 첫 3문항 + 마지막 3문항 + 보기 인라인 케이스 1건 + footer 케이스 1건 = 회차당 8 fixture × 7회 = 56 골든 케이스 최소.
  2. fixture는 `packages/parser-1st-exam/src/__tests__/fixtures/{year}-{round}/sample-page.json` — production 적재 결과 (knowledge_nodes/exam_questions) 와 1:1 검증.
  3. `master-test-checklist.md §1.1`에 `@thepick/parser-1st-exam` 행 추가, required ≥ 56.
- 우선순위 근거: 기출문항 정답 = 학습 신뢰성의 1순위 보장. "Hard Stop 조건" (CLAUDE.md "정답 100% 정확") 직접 영향. parser 136 / quality 41 / formula 251 다 갖춰진 상태에서 **하필 학습자 직접 노출 데이터의 파서가 0** = 표면 통과율로 가린 부채.
- 현 테스트가 막을 가능성: ZERO. `parser` 패키지 fuz-01/02는 PDF malicious/Claude malformed 대상이며 `exam-question-parser.ts`를 호출하지 않음.

### C-3. `learning-modes`에 OX/True-False input type 미구현 — Hard Stop 조건의 1/3 미존재

- 파일 (없는 것): `packages/learning-modes/src/input-types/{true-false,ox}.ts` 부재 확인. 존재하는 것: `multiple-choice.ts`, `fill-blank.ts`, `essay.ts`, `calc.ts` (4종).
- 미커버 시나리오: `production-quality.md` Phase 3 채점 Hard Stop 조건 = "OX/빈칸/변형 문제의 정답이 100% 정확한가". 빈칸(`fill-blank`) ✅, 변형(`multiple-choice` 셔플) ✅, OX = 부재. `grep -r "TrueFalse\|OX\|true_false"` = 1 hit (exam-adapter 인터페이스 주석만), 구현/테스트 0건.
- 첫 회귀 발생 트리거: 학습자 UX 진산 발화 (Session 065 "객관식 라디오/주관식 분류/보기 랜덤/학습 모드 다양화") 요청 시 OX 모드 즉시 요구 → 즉석 구현 → 골든 테스트 없이 production 출시.
- 6개월/2년 시나리오: 손해평가사 2차 실기에서 "옳다/그르다" 변형 (단답 ○/×) 출제 빈도 多. OX 채점 함수가 늦게 들어오면서 다른 input-type 패턴(`gradeFillBlank`)을 카피하다가 정답 false-positive 발생. 학습자 "이건 X인데 O로 채점"=신뢰 영구 손실 (자격증 학습 서비스 단일 결정타).
- 권장 조치:
  1. `packages/learning-modes/src/input-types/true-false.ts` + `__tests__/true-false.test.ts` 사전 작성. 골든 케이스 최소 8건: O/X 매칭, 공백 정답, "예/아니오" 변형, "옳다/그르다" 변형, null expected → 오답, 입력 normalize 일관, 다중 토큰 거부.
  2. `exam_questions.input_type` enum에 `true_false` 추가 검증 (migrations/0032 이미 컬럼 존재 — 값 범위 확인 필요).
  3. CLAUDE.md "테스트 전략 — 7개 100% 필수 항목" 체크리스트에 명시.
- 우선순위 근거: 미구현 자체는 부채가 아니나 "Hard Stop 조건" 1/3 missing이 master-test-checklist에 surface 0 = 부재가 부재로 인식 안됨 = 출시 임박에 "OX도 되네?" 즉석 구현 = 정답 정확도 회귀 path 1순위.
- 현 테스트가 막을 가능성: ZERO. `learning-modes` 패키지가 OX를 인지조차 안 함.

### C-4. `SCENARIO_MIGRATIONS` 정적 배열 — 0021~0027 (Table-as-Micro-KG + review-queue) 시나리오 미커버

- 파일: `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:44-84`
- 미커버 시나리오: SCENARIO_MIGRATIONS 33개 = 0001~0019 + 0028~0037. **0021_table_as_micro_kg / 0022~0026 (Table 관련 5종) / 0027_review_queue 누락** (의도 0020 제외와 다름 — 0020은 비어있는 슬롯). `scenarios.test.ts` 21 시나리오가 Table-as-Micro-KG가 없는 D1 위에서 돌아간다. ADR-032 (Table-as-Micro-KG = 손해평가 핵심) / ADR-015 Honest Refusal review_queue 회귀가 시나리오 e2e 분류에서 빠진다.
- 첫 회귀 발생 트리거:
  - `migration-0024-pattern-h.test.ts` 가 `createD1FromAllMigrations` 사용 = 전체 migration 적용 = OK. 그러나 `scenarios.test.ts`는 `createD1FromSqlite()` 기본 = SCENARIO_MIGRATIONS only.
  - 학습자 직접 노출 routes (study/, search/) 변경이 table\_\* 스키마 의존 코드를 추가하면, scenarios.test.ts가 silent green (테이블 없음 → 코드 분기 미진입) → production에서 첫 학습자 표 검색 시 `no such table: table_structures` 500 error.
- 6개월/2년 시나리오: SCENARIO_MIGRATIONS 정적 배열 = 매 마이그레이션 추가 시 갱신 의무 부채. 헬퍼 내부 주석에 이미 명시 ("TD-API-001 Sprint 2 초기 자동 readdir 통합 의무"). Sprint 2 도래 == Phase 2 = 지금. 그러나 SCENARIO_MIGRATIONS는 여전히 정적. 사람 갱신 누락 → 회귀 silent miss.
- 권장 조치:
  1. `SCENARIO_MIGRATIONS` 정적 배열 폐기 → `scenarios.test.ts`도 `createD1FromAllMigrations()` 사용 (성능 측정: migrations 36개 적용 ~1-2초 추정, 기존 21개 ~0.6초 → 허용 범위).
  2. `d1-from-sqlite.ts`에 "스킵 슬롯" 명시 enum (`SKIPPED_MIGRATIONS = ['0020']` 단일 진실원) — 비어있는 슬롯이 미래에 채워지면 자동 포함.
  3. CI에 `migrations/` 디렉토리 추가 PR 시 `SCENARIO_MIGRATIONS` diff 강제 hook (또는 1번 채택으로 hook 불요).
- 우선순위 근거: Table-as-Micro-KG는 ADR-032에서 "본 프로젝트 핵심" 명시 (memory `project_table_processing_core_capability`). 핵심 도메인이 시나리오 e2e 21개의 D1 환경에서 부재 = 보안/인증 시나리오 전반에 잠재적 silent miss.
- 현 테스트가 막을 가능성: ZERO. `scenarios.test.ts:120` `INSERT INTO exam_questions` 패턴은 다른 시나리오. Table 관련 회귀를 잡으려면 별도 e2e 필요.

### C-5. `AnthropicAdapter` 실 Claude API 호출 부재 — `NOT_IMPLEMENTED` throw만 테스트 + master-checklist 마저 `🟡` 미표시

- 파일: `packages/ai-adapter/src/anthropic-adapter.ts` + `__tests__/anthropic-adapter.test.ts:89-145`
- 미커버 시나리오: sendMessage / sendVision 두 핵심 함수가 production에서 호출되는데 테스트는 "throw NOT_IMPLEMENTED" 검증만. 실제 응답 shape(stop_reason / content blocks / token usage) / SSE 스트리밍 / 429 rate limit / 503 / overloaded / cache_control header — 0건 검증.
- 첫 회귀 발생 트리거: BATCH-1 적재 후 (이미 완료) `apps/batch/src/index.ts` 가 실 Claude 호출 → 응답 stop_reason='max_tokens' / 'tool_use' 같은 경계 응답을 batch-processor.ts가 `parseContractJson`으로 전달 → 코드펜스 중복 / 내부 잘림 / 빈 응답에서 (parser FUZ-02는 cover) 처리 시 contract 손실. 즉, **adapter 자체의 응답 디스패치 회귀는 cover 0**.
- 6개월/2년 시나리오: Claude API 응답 shape 변경 (예: Sonnet 4.6 → 4.7 input_tokens 포맷 변경, prompt caching response 새 필드) — ai-adapter는 무방어. master-checklist.md §1.1 `@thepick/ai-adapter` 행 = 13/30+ "LLM 통합 후 +17" 라벨 = 영구 carry-over. 실 호출 발생했음에도 적용 안됨.
- 권장 조치:
  1. `anthropic-adapter.test.ts`에 `globalThis.fetch` mock 패턴 (hibp.test.ts 처럼) + Anthropic API 응답 fixture 5종 (성공/잘림/tool_use/429/503) → sendMessage 호출 → 응답 파싱 검증.
  2. master-checklist v3 게재: `@thepick/ai-adapter` 행 30+로 갱신 의무. 본 13/30+ `🟡`를 numeric으로 강제 (현재 LLM 통합 후 +17 = 표시만이며 강제력 0).
  3. ADR-028 Workers vitest pool 도입 시점 (Phase 2 진입 직전 재검토 = 지금) MSW로 자동 Anthropic 응답 fixture.
- 우선순위 근거: ai-adapter는 BATCH 적재의 단일 의존점 + Phase 2 Claude Vision OCR + Phase 3 학습자 LLM 응답 전부 경유. 단일 점 = 단일 회귀가 모든 BATCH/생성 데이터에 침투. CLAUDE.md Hard Limit "LLM에게 수식 계산 절대 금지" 위반 검출도 응답 파서가 우선 검증해야 가능.
- 현 테스트가 막을 가능성: ZERO. NOT_IMPLEMENTED만 던지는 stub 4건이 통과 → fetch 실호출 경로 검증 0.

### C-6. 암기법 역방향 검증 = master-checklist 체크박스 `[ ]` + 코드 부재 + 테스트 부재

- 파일 (없는 것): `packages/study-material-generator/src/` 디렉토리 전체 = `index.ts` 1개 빈 파일. `mnemonic` 관련 .test.ts grep 0건.
- 미커버 시나리오: CLAUDE.md Hard Limit "암기법 역방향 검증 실패 시 폐기 (두문자어→원래 항목 복원)" + master-checklist §6.1 `- [ ] **암기법 역방향 검증** (BATCH-1 mnemonic 생성 후)` — BATCH-1~7 적재가 완료된 현 시점에 여전히 체크 안됨.
- 첫 회귀 발생 트리거: Phase 3 학습 UX 진입 = mnemonic_cards 학습자 노출 시작 → AI 생성 두문자어가 원본 노드 항목과 안 맞는 케이스 (예: "사화재폭" → "사고/화재/재해/폭우" 인데 원본은 "사고/화재/재해/풍수해") → 학습자가 외운 두문자가 시험에서 작동 안 함 = 학습 효과 영(零) = 자격증 서비스 단일 결정타.
- 6개월/2년 시나리오: 매년 개정마다 신규 mnemonic 생성 → 역방향 검증 없이 적재 → 누적 N% (N=AI 생성 폭) 비율로 잘못된 암기법 = 수험생 신뢰 영구 손실 + 환불 요청 폭증.
- 권장 조치:
  1. `packages/study-material-generator/src/mnemonic-reverse-validator.ts` 신규: 두문자어 → token 분해 → 원본 노드 lookup → unicode normalize 비교 → 한 글자도 어긋나면 false.
  2. `__tests__/mnemonic-reverse-validator.test.ts` 골든 케이스 15+ (정상복원/부분복원/순서변경/오타/공백/조사 다름/한자혼용/숫자혼용).
  3. mnemonic_cards INSERT 시 `status='draft'` 강제 + reverse-validator PASS 트리거 = `approved` 게이트.
  4. master-checklist §6.1 항목 numeric으로 변환.
- 우선순위 근거: Hard Limit 명시 + master-checklist 미체크 + 패키지 빈 상태. BATCH 적재 완료 + Phase 3 UX 임박 = 다음 단계가 그대로 부채에 부딪힘.
- 현 테스트가 막을 가능성: ZERO. `study-material-generator/package.json` = `--passWithNoTests` + src 0건.

### C-7. payment 패키지 = `--passWithNoTests` + production 트래픽 받을 영역 = 회귀 검출 인프라 0

- 파일: `packages/payment/package.json:13` + `packages/payment/src/{index.ts, providers/, types.ts}` (3 파일). `__tests__` 디렉토리 부재 (`find -name "*.test.ts"` 0 hit).
- 미커버 시나리오: webhook receiver 시그니처는 `apps/api/src/webhooks/payment.ts`에서 `createWebhookRoutes` + scenarios.test.ts S11~S14 4건 cover (HMAC 약한 시크릿 / replay / timing 등). 그러나 **provider adapter (PortOne 등) 자체** = 0 cover. 결제 결과 webhook 검증 라이브러리 자체가 mock provider (`./providers/mock.ts`)밖에 export.
- 첫 회귀 발생 트리거: Phase 3 launch 직전 PortOne provider 추가 — 본 패키지에 실 provider impl. 라이브러리 자체 골든 0건이라 webhook payload shape mismatch silent miss. apps/api scenarios.test.ts는 mock provider 가정.
- 6개월/2년 시나리오: PortOne 응답 schema 변경 (PortOne v2 → v3 마이그레이션, 한국 PG 매년 빈번) → provider parsing 회귀 → webhook은 정상 처리되었다고 응답 → 결제 누락 OR 중복 처리.
- 권장 조치:
  1. `packages/payment/src/__tests__/providers/mock.test.ts` + 신규 PortOne provider 추가 시 `portone.test.ts` 의무화.
  2. `package.json scripts.test = "vitest run"` (passWithNoTests 제거 — production 영역에서는 빈 통과 X).
  3. master-checklist에 payment 행 추가 (현재 부재).
- 우선순위 근거: 결제 = 사용자 데이터 + 환불 직결 + L3 영역 (`L3 영역` 헤더 CLAUDE.md). 0 test 상태로 Phase 3 launch 진입 차단 필요.
- 현 테스트가 막을 가능성: ZERO. scenarios.test.ts S11~S14는 HMAC + replay (webhook receiver 인프라) 측 — provider adapter는 별 layer.

### C-8. Playwright E2E = 모두 mock-server 기반 — apps/api 실 Worker와의 contract drift 검출 0

- 파일: `apps/web/playwright.config.ts:95-114` (webServer = `pnpm --filter @thepick/web dev` + `pnpm --filter @thepick/web e2e:mock-server`), `apps/web/e2e/mock-server/server.ts`, `apps/web/e2e/happy-path.spec.ts:13` (`installApiMock(page)`)
- 미커버 시나리오: 4 E2E 스펙(happy-path, session-restoration, mobile-375, api-errors) 모두 `localhost:8787` Hono mock server를 경유. 실 `apps/api` Worker는 한 번도 띄우지 않음. mock-server 는 apps/api와 "동일 Hono stack" (playwright.config.ts 주석) 라고 표기하나 라우트 핸들러는 완전 분리 = contract drift 자동 검출 0.
- 첫 회귀 발생 트리거:
  - apps/api 라우트 (`/api/study/next` 응답 shape) 변경 + apps/web 클라이언트 (questionStore) 갱신 → mock-server 응답 fixture 갱신 누락 → E2E happy-path 통과 → production 배포 → 실 Worker 응답이 mock과 다름 → 학습자 빈 화면.
  - cookie path 변경 (ACCESS_TOKEN_COOKIE_PATH) → apps/api Set-Cookie 와 mock-server Set-Cookie drift → 클라이언트 인증 실패가 production에서 첫 노출.
- 6개월/2년 시나리오: 마이크로서비스 분리 / 라우트 prefix 변경 / CORS 정책 변경 시 mock-server 갱신이 PR review에서 누락 → "테스트 다 통과합니다" + production 첫 클릭에 401.
- 권장 조치:
  1. 추가 E2E 1건 (`apps/web/e2e/real-api.spec.ts`) — mock-server 끄고 실 `apps/api` (wrangler dev) 와 happy-path 1건만 검증. CI nightly 한정 (속도 부담).
  2. apps/api routes의 응답 schema를 `@thepick/shared/api-contracts.ts` (Zod schema) 단일 정본화 → mock-server / apps/api 둘 다 import. contract drift = 컴파일 에러로 surface.
  3. `mock-server/server.ts` 라우트 정의에 "apps/api/src/.../routes.ts:NN cross-ref" 주석 의무 + ESLint rule (또는 코드리뷰 체크리스트).
- 우선순위 근거: 진산 발화 "신뢰성·항상성 집중" + 학습자 골든 패스 = 서비스 단일 노출점. mock-server 격리는 속도 ↑ 이나 contract drift = production 첫 노출 회귀의 1순위 경로.
- 현 테스트가 막을 가능성: PARTIAL. `apps/web/e2e/helpers/mock-api.ts:85-91` CORS_HEADERS가 `@thepick/shared/constants/cors.ts` 단일 진실원 import = drift 부분 차단. 그러나 라우트 응답 shape (성공 응답 body)는 자체 fixture = drift 인지 0.

---

## MAJOR — 6건

### M-1. `it.skip` 2건 (password.test.ts:29, scenarios.test.ts:332) — ADR-034 평가 정책으로 영구 dormant 위험

- 위치: `apps/api/src/auth/__tests__/password.test.ts:29` (PASSWORD_MIN_LENGTH=8 복원 시 unskip 의무), `apps/api/src/__tests__/scenarios.test.ts:332` (HIBP 'pwned' 복원)
- 회귀 시나리오: Phase 3 launch 직전 ADR-034 §"복원 의무" §7 자동 처리되어야 하나, `it.skip`은 IDE/CI에 silent. handoff 갱신 누락 시 영구 dormant → 약한 비번/유출 비번 허용.
- 권장: `it.todo()` 사용 (vitest TODO surface) + ADR-034 §"복원 의무" 트리거 자동 검출 hook 추가 (예: ENVIRONMENT==='production' 시 `it.skip` 발견하면 fail).

### M-2. `cha-04-clock-skew.test.ts`만 `vi.useFakeTimers` 사용 — `crypto.randomUUID` 의존 50+ test는 결정성 회귀 가능

- 위치: scenarios.test.ts:916/944, study/**tests**/routes.test.ts, progress/**tests**/routes.test.ts 등 7 파일
- 회귀 시나리오: 동일 batch 내 동시 INSERT (race) 시 UUID 충돌 0.0000…1% — 본격 회귀는 X 이지만 reproducibility 테스트(`reproducibility-idempotency.test.ts:204` canonicalJson dryRun snapshot)에서 같은 시드 부재 = 결과 byte-identical 보장 약함.
- 권장: `crypto.randomUUID` 의존 테스트에 `beforeEach`에서 deterministic UUID factory (mulberry32 기반) 주입 옵션 — 기본은 randomUUID, vitest seed mode 시 deterministic.

### M-3. Formula Engine PRC-01 = "119/255 = 47% PARTIAL" 자기 명시 — Phase 2 진입 차단 조건이 self-bypass

- 위치: `packages/formula-engine/src/__tests__/prc-01-precision-framework.test.ts:117-132`
- 회귀 시나리오: master-test-checklist v2 §6.1 = "Formula Engine 산식 정확도 100% (251 tests PASS)" 라고 표기 (PASS 라벨), 그러나 PRC-01 합격 기준 (a) 255건 = 51 산식 × 5 시나리오 중 119건만 cover. 산식 51개 중 일부는 5 시나리오 cover 부재 = 교재 예시값 외 edge case 미검증. 부동소수점 epsilon이 "프레임워크는 됐다" 라벨로 통과.
- 권장: BATCH-1~7 적재 완료 = 산식 fixture 도출 가능. `PRC-01_PROGRESS_TARGET = 255` 상수 + `it("framework: ${observed}/255 = PASS")` 강제 fail unless observed===255. 부분 PARTIAL은 별 commit / 별 ADR.

### M-4. Tarjan SCC 회귀 = master-checklist `[ ]` (Step 15b 이연) — graph-integrity 본체 검증의 sanity-check 부재

- 위치: master-checklist §6.1 "Tarjan SCC vs naive DFS 비교 ← Step 15b 의무 (이연)" — Phase 2 진입했는데 여전히 부재
- 회귀 시나리오: `packages/quality/src/__tests__/prf-02-naive-vs-tarjan.test.ts:185 LOC` 존재 (perf 비교) — 본 결과 동치 검증은 일부지만 SUPERSEDES 순환 detection에서 Tarjan implementation의 SCC 결과가 naive와 다른 corner case (self-loop + ε-cycle) 검증 부재.
- 권장: `__tests__/tarjan-equivalence.test.ts` 신규 — random graph 100개 (seeded mulberry32) × Tarjan / naive 둘 다 실행 → SCC 결과 동일 검증.

### M-5. SCENARIO_MIGRATIONS 정적 배열 — 매 마이그레이션 추가 시 사람 갱신 의무 (이미 0030~0037 누적)

- 위치: `apps/api/src/__tests__/helpers/d1-from-sqlite.ts:44-84` (내부 주석 "TD-API-001 Sprint 2 초기 자동 readdir 통합 의무")
- 회귀 시나리오: C-4와 별개로, **사람 갱신 누락** = 신규 마이그레이션 추가 → 갱신 누락 → 다음 마이그레이션이 같은 ID 재사용 시 ID 충돌 silent miss.
- 권장: C-4 채택 (`createD1FromAllMigrations` 통일) — TD-API-001 완전 해소.

### M-6. `process.env` 환경 의존 테스트 4건 — env 변동 시 silent skip/error

- 위치: `apps/api/src/scheduled/__tests__/silent-failure-monitor.test.ts`, `vectorize/__tests__/table-fetcher.test.ts`, `vectorize/__tests__/page-ref.test.ts`, `search/__tests__/routes.test.ts`
- 회귀 시나리오: CI runner OS / Node 버전 변경 시 process.env가 다르게 inject → 환경 분기 다른 path 통과.
- 권장: `vi.stubEnv` / `vi.unstubEnv` 패턴 일관화 (현 mixed) + 전역 helper.

---

## MINOR — 4건

- **M-7**: vitest 단일 워크스페이스 config 없음 (`vitest.workspace.ts` 부재) — 일관된 reporter / coverage 부재.
- **M-8**: `apps/web/playwright.config.ts:48` `workers: 1` 강제 — 속도 부담. mock-server multi-tenant 격상은 30분 vs 4h trade-off 적용 후 carry-over.
- **M-9**: `apps/web/e2e/silent-failure-surface.spec.ts` 단일 — 학습자가 마주칠 silent failure (e.g., 빈 응답 / 200 OK + body 빈 array)에서 UI 메시지 누출 검증은 1건뿐.
- **M-10**: `revision_changes` (R1/R2 적재 추가 — handoff-091) 테스트 cover 0. `grep "revision" --include="*.test.ts"` = 2 hit (qg2-validator SUPERSEDES, d1-trigger UPDATE 차단)만 — 개정 데이터 라우팅 회귀 부재.

---

## Devil's Advocate (반론 의무)

- C-1: 현 PASS는 `aggregate()` 손계산 N=2~4에서 정확하니 "수학적 정합"은 보장. 통계 유의도는 measurement 본질 외 — 분리 책임론 가능. 그러나 진산이 결정에 쓰는 순간 분리 안됨.
- C-2: parser-1st-exam은 production 적재가 **이미 완료**된 코드 = 회귀 회피? — 아니다. 매년 개정 + 신규 회차 추가로 재호출. 적재 시 1회 검증 ≠ 매 호출 결정성 보장.
- C-3: OX 미구현이 부재한 것이 부채? — 진산 발화 (Session 065)에서 학습 모드 다양화 명시 = 시간 문제. 미리 안 만든 게 부채가 아니라, master-checklist에 surface 0 (= 부재가 인지 안됨)이 부채.
- C-4: createD1FromAllMigrations 사용 시 ~1s 추가 = CI 부담 — 사실. 그러나 시나리오 21개 × 100ms 추가 ≤ 1.5s 누적 = 무시 가능 vs Table-as-Micro-KG silent miss 위험.
- C-5: Anthropic SDK가 자체 mock 제공하니 우리가 fetch mock까지 짜는 게 과한 것 아닌가? — Anthropic SDK는 vendor lock-in 회피 위해 미사용 (단일 fetch 직접). 즉 우리 책임.
- C-6: 패키지 자체가 미구현 = "없는 걸 테스트하라"는 비현실 — 사실. 본 finding은 "패키지 존재 + master-checklist 체크박스 + Hard Limit 명시" 3 조건 동시 충족 시 surface 0이라 부채.
- C-7: payment provider는 PortOne SDK가 자체 cover — production에서 PortOne callback validation 책임은 우리 코드. 분리 불가.
- C-8: real-api e2e는 wrangler 부담이 큼 — nightly 1회 한정으로 trade-off 조정 가능.

---

## 다른 페르소나가 못 볼 각도 (quality 독점)

- **golden 분모 N의 통계 유의도**: refactoring-expert는 "코드는 깨끗"으로 통과, performance-engineer는 "측정은 빠름"으로 통과, backend-architect는 "스키마는 정합"으로 통과. quality만 "분모 N=12로 결정 못함"을 지적.
- **mock 격리의 contract drift**: devops-architect는 "CI 빠르고 안정"으로 OK, quality만 "production 첫 노출 회귀의 1순위"라고 본다.
- **부재 부채 (test가 없는 것 자체)**: backend-architect는 ADR-014 cross-batch validator를 봄, quality는 master-checklist 빈 체크박스 4건이 영구 carry-over 되는 패턴을 본다.
- **Hard Stop / Hard Limit과 테스트 부재의 매핑**: CLAUDE.md "정답 100% 정확 (OX/빈칸/변형)" / "암기법 역방향 검증" / "기출 정답 100%" 3건 모두 인간이 자동 검증 못함 = 테스트 부재 = 부채.
- **검증 도구 자체의 검증 (G-6a-5)**: assertRemoteMeasurementInputs는 자체 골든 1건 (multihop-accuracy.test.ts:162 결정성 byte-identical 2회 실행) — 그러나 "도구가 맞다"의 sanity는 통계적 표본 위에서 확인 필요. 본 도구가 N=12를 N=12로 측정하는지 검증은 가능 (코드 logic). N=12 결과를 G-S5 PASS로 라벨링하는 의사결정 부재 = quality.

---

## 권장 Golden Test 목록 (즉시 추가)

1. **`packages/parser-1st-exam/src/__tests__/exam-question-parser.test.ts`** — 회차 7 × 8 fixture = 56 골든 케이스. fixture: production 적재 결과 1:1 검증 (현재 적재 완료 활용).
2. **`packages/learning-modes/src/input-types/true-false.test.ts`** — OX 채점 8 골든 케이스 (양/부정/공백/null/normalize).
3. **`packages/study-material-generator/src/__tests__/mnemonic-reverse-validator.test.ts`** — 두문자어 역방향 복원 15 골든 케이스 (정상/부분/순서/오타/조사 다름).
4. **`packages/ai-adapter/__tests__/anthropic-real-shape.test.ts`** — `globalThis.fetch` mock + 5 응답 fixture (성공/잘림/tool_use/429/503) → sendMessage 응답 파싱 검증.
5. **`apps/api/src/eval/__tests__/low-N-warning.test.ts`** — `aggregate({measured: 12})` 결과에 `coverageNote` "통계 유의도 불가" 워터마크 강제.
6. **`packages/quality/src/__tests__/tarjan-equivalence.test.ts`** — random graph 100개 seeded × Tarjan vs naive SCC 동일 검증.
7. **`packages/payment/src/__tests__/providers/mock.test.ts`** — webhook payload shape 5종 + signature verification 골든.
8. **`apps/web/e2e/real-api.spec.ts`** — wrangler dev + 1건 happy-path, CI nightly 한정.
9. **`apps/api/src/__tests__/scenarios/table-as-micro-kg-coverage.test.ts`** — Table-as-Micro-KG 스키마 e2e 시나리오 (현 0021~0027 SCENARIO_MIGRATIONS 누락 해소).
10. **`packages/parser-1st-exam/src/__tests__/regulation-revision.test.ts`** — R1/R2 개정 적재 후 SUPERSEDES 엣지가 학습자 노출 라우트에 정확 반영되는지 (revision_changes 회귀).

---

## 진산 결정 갈림길

A. **C-1 통계 유의도 게이트** = G-S5 측정 시점에 추가 / Phase 후 추가 — A1 (지금) 권장 = 결정 직전 surface.
B. **C-3 OX input type** = 사전 골든 작성 후 구현 / 학습 UX 결재 시점에 동시 — B2 (UX 결재 동시) 권장 = 진산 발화 정합.
C. **C-4 SCENARIO_MIGRATIONS 통일** = 즉시 (테스트 1.5s 추가) / Sprint 2 진입 시 — C1 (즉시) 권장 = TD-API-001 영구 해소.
D. **C-8 real-api e2e** = CI nightly 1건 / PR 매 빌드 1건 — D1 (nightly) 권장 = 속도 부담 vs 효용 trade-off.
