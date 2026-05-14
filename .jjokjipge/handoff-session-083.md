# Session 077 종착 핸드오프 — ThePick (쪽집게)

> **본 세션(077) 종착**: ★★★ ADR-040 §7 B-1 옵션 (iii) 흡수 + §8.2 production CORS sync + payload required — 5-페르소나 backend C1+C2+C3+M2 Critical/Major 완전 해소 + WebKit QuestionCard PASS 영속 (Phase 3 launch ★ +30일 차단 잠재 위험 해소).
> **다음 세션(078) 진입 시**: ADR-040 §8.1 매트릭스 #3~#8 잔여 carry-over 6건 중 선택 또는 Step 3-UX-7b pdfplumber 5지선다 extraction BATCH (L3, 진산 승인 필수).
> **본 핸드오프 번호 = 083** (handoff-082 직계 후속, Session 077 종착)

---

## 브랜치 & 컨텍스트

- 브랜치: main (origin/main 일치, 본 세션 push 미실행 — 진산 결정 위임)
- 마지막 커밋: `1559c9c` feat(shared)+api+web: ADR-040 §8.2 production CORS sync + payload required — 5-페르소나 backend C1+C2+M2 해소
- 미커밋 변경: 0 (clean working tree)

## 이번 세션(077)에서 한 일 — 2 commit 누적

### Commit 1: `588acfb` — ADR-040 §7 B-1 옵션 (iii) 별도 mock server 흡수

- 진산 결정 옵션 (iii) 채택 — 별도 Hono cross-origin mock server (port 8787) 도입
- `apps/web/e2e/mock-server/{types,state,server,start}.ts` 신규 372줄 — Hono v4.12.14 + @hono/node-server v1.13.0 + tsx v4.19.0
- `apps/web/e2e/helpers/mock-api.ts` 전면 마이그레이션 — `page.route()` 전수 제거 + `page.on('response')` 미러링으로 spec 시그니처 호환 유지 (override 비동기 시그니처 1줄 변경)
- `playwright.config.ts` webServer array 전환 (astro:4321 + mock-server:8787 병렬 기동)
- WebKit QuestionCard scenario `mobile-375.spec.ts:74` unskip 영속 → Phase 3 launch ★ +30일 차단 잠재 위험 해소
- **진짜 root cause 확정** — fetch spec WD-2024: credentialed request에서 `Access-Control-Allow-Headers: '*'` + `Allow-Credentials: true` 조합 wildcard 무효 → 명시 enumeration. ADR-040 §6 가설 후보 1 적중. page.route() loose interception에서는 우회 효과 있었으나 실 cross-origin Hono server는 chromium 포함 spec strict.
- 5-페르소나 자율 흡수 2건:
  - **C3 / Q1**: Cookie Path shared 상수 import (`ACCESS_TOKEN_COOKIE_PATH` / `REFRESH_TOKEN_COOKIE_PATH`)
  - **refactor m-5**: `emptyCounters()` DRY 통합 (`state.ts` export → `mock-api.ts` import)

### Commit 2: `1559c9c` — ADR-040 §8.2 production CORS sync + payload required

- 진산 결정 위임 매트릭스 #1+#2 동시 흡수 (5-페르소나 backend Critical 3건 + Major 1건 root cause 해소)
- `packages/shared/src/constants/cors.ts` 신설 — single source 단일 origin:
  - `CORS_ALLOWED_METHODS` (GET/POST/OPTIONS) — Temporal Graph INSERT+SUPERSEDES 정합으로 PUT/DELETE 미허용
  - `CORS_ALLOWED_HEADERS_BASE` (Content-Type, Authorization) — 인증/학습/공개 라우트
  - `CORS_ALLOWED_HEADERS_ADMIN_TOKEN` (+ X-Admin-Token) — `/telemetry`, `/admin/vectorize`
  - `CORS_EXPOSED_HEADERS` (Retry-After) — 429 client retry/back-off 대비
  - `CORS_MAX_AGE_SECONDS` (600) — production preflight 캐시
- `packages/shared/src/index.ts` re-export 추가
- `apps/api/src/index.ts` buildCorsOptions → 신설 상수 import (production sync) + `/telemetry` + `/admin/vectorize` override 정합
- `apps/web/e2e/mock-server/server.ts` cors middleware → 동일 상수 import (drift 0)
- `apps/web/e2e/helpers/mock-api.ts` CORS_HEADERS → 동일 상수 `.join(', ')` 재구성
- `apps/web/e2e/mock-server/server.ts` grade payload required `['questionId', 'userAnswer', 'inputType']` → `['questionId', 'userAnswer']` (production zod schema:158 `inputType.optional()` 정합)

## 수정/신규 파일 (이번 세션 누적)

### 신규

- `apps/web/e2e/mock-server/types.ts` — SerializedOverrides / GradeResponseEntry / EndpointKey
- `apps/web/e2e/mock-server/state.ts` — process-scoped counters + callLog + overrides + emptyCounters()
- `apps/web/e2e/mock-server/server.ts` — Hono cors + 8 라우트 + admin 4 endpoint
- `apps/web/e2e/mock-server/start.ts` — @hono/node-server serve + SIGTERM/SIGINT shutdown
- `packages/shared/src/constants/cors.ts` — single source 단일 origin
- `.claude/reviews/review-20260514-195035-step-3-ux-b1-mock-server-5persona.md` — 5-페르소나 통합 보고서

### 수정

- `apps/web/e2e/helpers/mock-api.ts` — page.route() 제거 + page.on('response') 미러링 + CORS_HEADERS 재구성
- `apps/web/playwright.config.ts` — webServer array
- `apps/web/package.json` — 3 devDep (hono / @hono/node-server / tsx) + e2e:mock-server script
- `apps/web/e2e/{session-restoration,api-errors,silent-failure-surface}.spec.ts` — `await api.override(...)` 시그니처 정합
- `apps/web/e2e/mobile-375.spec.ts` — WebKit QuestionCard scenario unskip
- `apps/api/src/index.ts` — buildCorsOptions shared 상수 import
- `packages/shared/src/index.ts` — cors.ts re-export
- `docs/adr/ADR-040-step-3-ux-6c-server-contract-gap-carryover.md` — §8 close fact + §8.1 매트릭스 + §8.2 흡수 영속
- `pnpm-lock.yaml` — 3 devDep 추가 반영

## 주요 결정 / 발견

### 진산 결정 (이번 세션)

1. **ADR-040 §7 B-1 옵션 (iii) 채택** — 별도 Hono mock server (cross-origin 유지)
2. **다음 chunk #1 production CORS sync 진행** — `packages/shared/src/constants/cors.ts` 신설로 backend C1+C2+M2 root cause 해소
3. **세션 077 종착 핸드오프 생성** (~4시간 경과 임계)

### 5-페르소나 독립 병렬 리뷰 결과 (자가 편향 차단망 표준 패턴)

- 통합 보고서: `.claude/reviews/review-20260514-195035-step-3-ux-b1-mock-server-5persona.md`
- Critical 3건 (backend) — 모두 본 세션 close
- Major 11건 — 자율 흡수 2건 (Q1+m-5) + 매트릭스 #1+#2 흡수 → 잔여 6건 carry-over

### 검증된 fact (Year 2 reusable foundation 가치)

- fetch spec WD-2024: credentialed wildcard 무효 root cause 검증 완료. page.route() 인터셉트 vs 실 cross-origin server 차이 fact 영속
- WebKit cross-origin POST preflight — Hono mock server에서 정상 동작 (chromium 동일 enumeration 정합으로 해소)
- single source 단일 origin (`packages/shared/src/constants/cors.ts`)로 mock vs production drift 영구 차단
- production 코드 (apps/api/src/index.ts buildCorsOptions) 변경 후 vitest 566 PASS 회귀 0

## 다음 할 일 (우선순위 — ADR-040 §8.1 매트릭스 carry-over)

### 진산 결정 위임 (전략 갈림길)

| #   | 항목                                                             | 비용       | 위험 등급                                      |
| :-- | :--------------------------------------------------------------- | :--------- | :--------------------------------------------- |
| 3   | `workers: 1` local 강제 OR multi-tenant `X-Test-Session` 격상    | 30분 OR 4h | ☆ local dev flaky silent miss                  |
| 4   | e2e/ ESLint scope 확장 + floating-promises rule                  | 1h         | ☆ `await api.override(...)` 누락 silent race   |
| 5   | `page.on('response')` listener cleanup (`page.on('close', off)`) | 10분       | ☆ Phase 3 spec 50건+ 시 listener leak          |
| 6   | webServer timeout 통일 + log artifact 분리                       | 1h         | ☆ CI flaky / on-call 디버깅 단서 부재          |
| 7   | SameSite=None + Secure production HTTPS profile E2E              | 30분       | ★ Phase 3 launch 직전 의무                     |
| 8   | mock-server admin endpoint negative regression test              | 15분       | ☆ production binding `__mock` prefix 부재 검증 |

### Year 2 carry-over

- `requireExamId` 화이트리스트 검증 logic을 `packages/shared/exam-adapter.ts`로 추출 (backend Mi1)
- fixture per-exam 분리 (`fixtures/{examId}/`) — ADR-009 멀티시험 정합 (backend Mi2)
- multi-tenant `X-Test-Session` mock-server isolation — fully-parallel 4-worker 24.8s → 6-10s 단축
- mock-server vs apps/api endpoint 자동 sync (M-1 contract drift) — 본 chunk가 단일 source CORS만 해소. endpoint 자체 contract single source는 별도 PR

### 다른 priority 옵션

- **Step 3-UX-7b pdfplumber 5지선다 extraction BATCH (L3, 진산 승인 필수 — 자율 X)** — plan §11.6 distractor BATCH 진입
- Step 3-UX-7c~7f distractor BATCH 잔여

## 주의사항

### 자율 결정 갈림길에 진산 의사 결정 필수 영역

- L3 영역 (`packages/formula-engine/`, `**/constants*`, `**/ontology-registry*`, DB schema, user_progress) 변경 시 plan + 진산 승인 의무
- production 코드 변경 동반 chunk (apps/api/src/\*) 시 진산 위임 권고 (본 세션은 진산 직접 결정 후 진행)
- 5-페르소나 Critical 0/0/0 단일 code-reviewer 보고 시 자가 확인 편향 의심 → 5-페르소나 (refactor/performance/quality/backend/devops) 독립 병렬 의무

### fail-loud 강화 상태 영속

- retries=1 (Session 076 진산 결정 C-2)
- gradeSequence overflow/empty fail-loud
- examId fail-loud 전수 (Hard Rule 16)
- mock-server unhandled route 404 fail-loud + console.error
- payload required `['questionId', 'userAnswer']` (inputType은 production optional 정합)

### CORS single source 영속 (본 세션 신규)

- `packages/shared/src/constants/cors.ts` 변경 시 production + mock 양쪽 자동 sync
- CORS_ALLOWED_METHODS는 GET/POST/OPTIONS 한정 (PUT/DELETE 미허용, Temporal Graph 정합)
- `/telemetry` + `/admin/vectorize`는 ADMIN_TOKEN spread 명시 패턴 유지

### 검증 명령 (모든 carry-over 흡수 후 의무)

- `pnpm --filter @thepick/shared typecheck` (해당 없음 — 본 패키지는 직접 typecheck script 부재)
- `pnpm --filter @thepick/api typecheck && pnpm --filter @thepick/api lint && pnpm --filter @thepick/api test`
- `pnpm --filter @thepick/web typecheck && pnpm --filter @thepick/web lint`
- `CI=1 pnpm --filter @thepick/web exec playwright test --reporter=list` (18 PASS 기대)

### 검증된 fact (Year 2 도입 시 환기 trigger)

- WebKit cross-origin POST preflight 호환성 — Hono mock server CORS middleware로 해소 (Year 2 멀티시험 도입 시 mock-server fixture per-exam 분리 carry-over 발동)
- mock-server in-memory state — workers=1 강제. fully-parallel은 multi-tenant X-Test-Session 격상 (carry-over #3)
- page.on('response') listener leak — Phase 3 spec 50건+ 시점에 cleanup carry-over 발동 (#5)

### 다른 task list 참고

- TaskList로 #1~#10까지 본 세션 task 흔적 확인 가능 (#1~#5 = B-1 옵션 iii, #6~#10 = §8.2 CORS sync)

이 핸드오프 프롬프트를 읽고 프로젝트 CLAUDE.md를 확인한 후 작업을 이어가세요.
