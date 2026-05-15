# Session 078 종착 핸드오프 — ThePick (쪽집게)

> **본 핸드오프 = 084** (handoff-083 직계 후속, Session 078 종착).
> **작성 경위**: Session 078 작업(`1f34b0d`)은 커밋·푸시·검증까지 완료되었으나 시스템 셧다운으로 핸드오프 미작성. Session 084 진입 시 사후 보강 작성.
> **본 세션(078) 종착**: ★ ADR-040 §8.1 잔여 carry-over 매트릭스 #3~#8 6건 단일 묶음 흡수 — fail-loud 강화 (작은 부채부터 큰 부채 순). §8.1 진산 결정 위임 매트릭스 **전부 해소**.
> **다음 세션(085) 진입 시**: Step 3-UX-7b pdfplumber 5지선다 distractor extraction BATCH (L3, 진산 승인 필수) 또는 ADR-040 §8.3 잔여 Year 2 carry-over.

---

## 브랜치 & 컨텍스트

- 브랜치: `main` (origin/main **완전 동기화** — ahead 0, behind 0)
- 마지막 커밋: `1f34b0d` feat(web)+test(api)+infra: ADR-040 §8.1 carry-over #3~#8 흡수 — fail-loud 강화 묶음 6건
- 미커밋 변경: **0** (clean working tree)
- 직전 핸드오프: `handoff-session-083.md` (Session 077 종착)

## 이번 세션(078)에서 한 일 — 1 commit (`1f34b0d`)

진산 결정 "ADR-040 §8.1 carry-over 흡수" (Session 078 진입) 채택. 5-페르소나 잔여 매트릭스 6 chunk를 단일 묶음으로 흡수 — 작은 부채부터 큰 부채 순서.

- ✅ **#5** `page.on('response')` listener cleanup — `page.once('close', off)`로 closure leak 차단 (`apps/web/e2e/helpers/mock-api.ts`). Phase 3 spec 50건+ 시 listener 누적 차단.
- ✅ **#8** mock-server admin endpoint negative regression — `apps/api/src/__tests__/no-mock-routes.test.ts` 신설. `apps/api/src` 트리 전체 `__mock` 문자열 0건 정적 검증. mock-server admin endpoint가 production 번들 누출 시 공격 표면 생성 → 회귀 fail-loud.
- ✅ **#3** `workers: 1` local 강제 — `apps/web/playwright.config.ts` `workers: CI ? 1 : undefined` → `workers: 1`. mock-server in-memory state가 process-scoped → workers>1 시 cross-test pollution silent green 차단. multi-tenant `X-Test-Session` 정공법(4h)은 Year 2 carry-over 유지.
- ✅ **#7** SameSite=None + Secure production HTTPS profile E2E — `apps/api/src/auth/__tests__/routes.test.ts` 신규 4 테스트: (a) production login tp_access+tp_refresh `SameSite=None; Secure` (b) staging 동일 (c) `AUTH_COOKIE_SAMESITE=Strict` override → `Strict + Secure` (Phase 3 launch toggle) (d) production logout clear cookie도 `SameSite=None; Secure` 유지. 기존 routes.test.ts:297 `/Secure/`만 검증 → `SameSite=None` 누락 silent regression 차단.
- ✅ **#4** e2e/ ESLint type-aware scope — `apps/web/e2e/tsconfig.json` + `apps/web/.eslintrc.json` 신설. `no-floating-promises` + `await-thenable` 활성화. 사전 type 위반 3건 동시 흡수.
- ✅ **#6** webServer timeout 통일 — `WEB_SERVER_TIMEOUT_MS` 상수 hoist (120s), `apps/web/playwright.config.ts`.

→ handoff-083 §"다음 할 일" 진산 결정 위임 매트릭스 **#3~#8 전부 해소**. §8.1 매트릭스 잔여 0.

## 수정/신규 파일 (`1f34b0d` 커밋)

### 신규

- `apps/api/src/__tests__/no-mock-routes.test.ts` — `__mock` 정적 0건 검증 (63 lines)
- `apps/web/.eslintrc.json` — e2e type-aware lint override (15 lines)
- `apps/web/e2e/tsconfig.json` — e2e 전용 tsconfig (9 lines)

### 수정

- `apps/api/src/auth/__tests__/routes.test.ts` — SameSite=None+Secure 4 테스트 추가 (+113 lines)
- `apps/web/e2e/helpers/mock-api.ts` — listener cleanup `page.once('close', off)` (+57/-22)
- `apps/web/playwright.config.ts` — workers:1 + WEB_SERVER_TIMEOUT_MS hoist (+25)
- `apps/web/package.json` — devDep 1건 조정
- `docs/adr/ADR-040-step-3-ux-6c-server-contract-gap-carryover.md` — §8.3 흡수 영속 (+39 lines)

(8 files changed, 301 insertions, 22 deletions)

## 검증 결과 (`1f34b0d` 커밋 시점)

- `apps/api` vitest **571 PASS**
- `apps/web` typecheck **PASS**
- lint **PASS** (src + e2e 양쪽)
- chromium e2e **12 PASS**
- 회귀 0

## 주요 결정 / 발견

### 진산 결정 (Session 078)

- **ADR-040 §8.1 carry-over 흡수 채택** — #3~#8 6건 단일 묶음, fail-loud 강화 우선순위 (작은 부채 → 큰 부채)

### 발견 / 영속 fact

- mock-server in-memory state는 process-scoped → workers>1이면 cross-test pollution. local `workers:1`로 결정성 확보 (fail-loud는 확보, 성능 최적화 정공법은 Year 2 carry-over)
- 기존 `routes.test.ts:297`는 `/Secure/`만 검증 → `SameSite=None` 속성 누락을 silent하게 통과시키던 contract drift 회귀 hole 봉합
- `apps/api/src` 트리 `__mock` 정적 0건 검증으로 mock-server admin endpoint의 production 번들 누출을 회귀 단계에서 fail-loud화

## 다음 할 일 (우선순위)

### 진산 결정 위임 (전략 갈림길)

1. **Step 3-UX-7b pdfplumber 5지선다 distractor extraction BATCH** — **L3, 진산 승인 필수 (자율 진행 X)**. plan §11.6 distractor BATCH 진입. plan 작성 → 인간 승인 → 코딩.
2. Step 3-UX-7c~7f distractor BATCH 잔여

### ADR-040 §8.3 잔여 Year 2 carry-over (지금 불필요, 환기 trigger용)

- multi-tenant `X-Test-Session` mock-server isolation — fully-parallel 4-worker 24.8s → 6-10s 단축 (Year 2)
- `requireExamId` 화이트리스트 검증 logic → `packages/shared/exam-adapter.ts` 추출 (backend Mi1)
- fixture per-exam 분리 (`fixtures/{examId}/`) — ADR-009 멀티시험 정합 (backend Mi2)
- mock-server vs apps/api endpoint contract single source (M-1 contract drift, 별도 PR)
- mock server cookie cross-port consistency — production HTTPS preview 환경 검증 (ADR-040 §8.1:325)

### 문서 정합 (본 세션 084에서 처리)

- ✅ 본 핸드오프 084 작성 (Session 078 사후 보강)
- WBS 대시보드 footer/Executive Summary sync (Session 069 시점 → Session 078 반영)

## 주의사항

### 자율 결정 갈림길 진산 의사 결정 필수 영역

- L3 영역 (`packages/formula-engine/`, `**/constants*`, `**/ontology-registry*`, DB schema, user_progress) 변경 시 plan + 진산 승인 의무
- Step 3-UX-7b는 pdfplumber BATCH = L3. 자율 진입 절대 금지.
- production 코드 변경 동반 chunk (apps/api/src/\*) 시 진산 위임 권고

### fail-loud 강화 상태 영속 (Session 078 신규 누적)

- retries=1 (Session 076 진산 결정 C-2)
- gradeSequence overflow/empty fail-loud
- examId fail-loud 전수 (Hard Rule 16)
- mock-server unhandled route 404 fail-loud + console.error
- payload required `['questionId', 'userAnswer']` (inputType production optional 정합)
- **(078 신규)** `workers:1` local 강제 — state pollution silent miss 차단
- **(078 신규)** `__mock` 정적 0건 — admin endpoint production 누출 회귀
- **(078 신규)** SameSite=None+Secure 4 테스트 — cookie 정책 contract drift 회귀

### CORS single source 영속 (Session 077~)

- `packages/shared/src/constants/cors.ts` 변경 시 production + mock 양쪽 자동 sync
- CORS_ALLOWED_METHODS는 GET/POST/OPTIONS 한정 (PUT/DELETE 미허용, Temporal Graph 정합)
- `/telemetry` + `/admin/vectorize`는 ADMIN_TOKEN spread 명시 패턴 유지

### 검증 명령 (carry-over 흡수 후 의무)

- `pnpm --filter @thepick/api typecheck && pnpm --filter @thepick/api lint && pnpm --filter @thepick/api test`
- `pnpm --filter @thepick/web typecheck && pnpm --filter @thepick/web lint`
- `CI=1 pnpm --filter @thepick/web exec playwright test --reporter=list`

이 핸드오프 프롬프트를 읽고 프로젝트 CLAUDE.md를 확인한 후 작업을 이어가세요.
