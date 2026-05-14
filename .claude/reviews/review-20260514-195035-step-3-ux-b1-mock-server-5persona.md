# 5-페르소나 독립 병렬 리뷰 — ADR-040 §7 B-1 옵션 (iii) 별도 mock server 흡수

**대상:** Step 3-UX-B1 (Session 077, 2026-05-14)
**범위:** test infra 한정 (production 학습 엔진/Graph RAG/Formula Engine 무관)
**리뷰 방식:** Agent tool 독립 서브에이전트 5명 병렬 호출 (자가 편향 차단망)
**4-Pass 자가 리뷰:** 미실행 (5-페르소나로 first pass)

---

## 변경 매트릭스

| 파일                                          | 변경 유형           | 줄수 |
| :-------------------------------------------- | :------------------ | :--- |
| `apps/web/e2e/mock-server/types.ts`           | 신규                | 56   |
| `apps/web/e2e/mock-server/state.ts`           | 신규                | 51   |
| `apps/web/e2e/mock-server/server.ts`          | 신규                | 233  |
| `apps/web/e2e/mock-server/start.ts`           | 신규                | 32   |
| `apps/web/e2e/helpers/mock-api.ts`            | 마이그레이션        | 219  |
| `apps/web/playwright.config.ts`               | webServer array     | +14  |
| `apps/web/package.json`                       | 3 devDep + 1 script | +5   |
| `apps/web/e2e/session-restoration.spec.ts`    | `await` 1줄         | +1   |
| `apps/web/e2e/api-errors.spec.ts`             | `await` 4줄         | +4   |
| `apps/web/e2e/silent-failure-surface.spec.ts` | `await` 2줄         | +2   |
| `apps/web/e2e/mobile-375.spec.ts`             | WebKit unskip       | -5   |
| `docs/adr/ADR-040-...md`                      | §8 close fact       | +95  |

**핵심 root cause 해소** — fetch spec WD-2024: credentialed request에서 `Access-Control-Allow-Headers: '*'` + `Allow-Credentials: true` 조합 wildcard 무효. 명시 enumeration으로 chromium + WebKit 모두 정합. ADR-040 §6 carry-over 가설 후보 1 적중.

---

## 판정 매트릭스 (5-페르소나)

| Persona              | Critical | Major | Minor | 판정          |
| :------------------- | :------- | :---- | :---- | :------------ |
| refactoring-expert   | 0        | 1     | 5     | 완료 가능     |
| performance-engineer | 0        | 1     | 4     | 완료 가능     |
| quality-engineer     | 0        | 4     | 3     | 완료 가능     |
| backend-architect    | **3**    | 3     | 2     | **수정 필요** |
| devops-architect     | 0        | 2     | 3     | 완료 가능     |

---

## Critical 3건 (backend-architect)

본 chunk 자체 결함이 아닌 **이전부터 존재한 contract drift를 본 chunk가 더 키움**. mock-server CORS middleware 명시 enumeration이 production apps/api와 별도 리터럴 → drift 확대.

### C1. CORS allowHeaders drift — production ≠ mock

- **production** (apps/api/src/index.ts:83): `['Content-Type', 'Authorization']` (2개)
- **mock-server** (apps/web/e2e/mock-server/server.ts:64): `['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept']` (5개)
- **Silent risk:** mock이 production보다 넉넉히 풀어줘서 E2E 녹색 → production 첫 cross-origin 배포에서 client 신규 header 추가 시 preflight 차단. 본 chunk의 root cause 해소가 production에 미적용.
- **해소:** `packages/shared/src/constants/cors.ts` 신설 → 양쪽 import. `'Cookie'`는 fetch spec forbidden header이라 dead literal (제거 권고).

### C2. allowMethods drift

- **production** (apps/api/src/index.ts:84): `['GET', 'POST', 'OPTIONS']`
- **mock-server** (server.ts:63): `['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']`
- **Silent risk:** mock에 PUT/DELETE 호출하는 helper 무심 추가 → E2E PASS → prod 405.

### C3. Cookie Path 우연한 일치 — single source 부재

- **production** (apps/api/src/auth/routes.ts:721,728): `ACCESS_TOKEN_COOKIE_PATH`, `REFRESH_TOKEN_COOKIE_PATH` (shared 상수)
- **mock-server** (server.ts:122,127): `Path=/api`, `Path=/api/auth` 하드코딩 (현재 우연히 같은 값)
- **Silent risk:** shared 상수 개정 시 production만 따라가고 mock은 stale → cookie path mismatch E2E silent 실패.

---

## 즉시 자율 흡수 2건 (Session 077, 본 chunk 내 마무리)

### ✅ C3 / Q1 흡수 — Cookie Path constant import

- `apps/web/e2e/mock-server/server.ts:117-131` `Path=/api` → `Path=${ACCESS_TOKEN_COOKIE_PATH}`, `Path=/api/auth` → `Path=${REFRESH_TOKEN_COOKIE_PATH}`.
- `apps/web/e2e/helpers/mock-api.ts` `seedAuthCookie` 동일.
- shared 상수 개정 시 mock 자동 sync.

### ✅ refactor m-5 흡수 — emptyCounters DRY 통합

- `apps/web/e2e/mock-server/state.ts` `emptyCounters()` export 추가.
- `apps/web/e2e/helpers/mock-api.ts` 로컬 정의 제거 + import.
- 단일 source.

**재검증:** typecheck PASS / playwright test 18 PASS (22.3s) 회귀 0.

---

## 진산 결정 위임 (전략 갈림길) — 다음 chunk 우선순위 매트릭스

production 변경 동반 또는 큰 trade-off 결정이 필요한 항목.

| #   | 항목                                                                          | Persona                      | 비용       | 위험 등급                                      |
| :-- | :---------------------------------------------------------------------------- | :--------------------------- | :--------- | :--------------------------------------------- |
| 1   | **production CORS sync** (`packages/shared/src/constants/cors.ts` 신설)       | backend C1+C2 + refactor M-1 | 1-2h       | ★ production 첫 배포 cross-origin block 잠재   |
| 2   | **payload required drift** (mock `inputType` required vs production optional) | backend M2                   | 30분       | ★ production에서 통과할 payload가 mock에서 422 |
| 3   | **`workers: 1` local 강제** OR multi-tenant `X-Test-Session` 격상             | quality Q2 + perf M-P5       | 30분 OR 4h | ☆ local dev flaky silent miss                  |
| 4   | **e2e/ ESLint scope 확장** + floating-promises rule                           | quality Q3+Q4                | 1h         | ☆ `await api.override(...)` 누락 silent race   |
| 5   | **page.on('response') listener cleanup** (`page.on('close', off)`)            | perf PE-M1                   | 10분       | ☆ Phase 3 spec 50건+ 시 listener leak          |
| 6   | **webServer timeout 통일 + log artifact 분리**                                | devops DO-1+DO-2             | 1h         | ☆ CI flaky / on-call 디버깅 단서 부재          |
| 7   | **SameSite=None + Secure production HTTPS profile E2E**                       | backend M1                   | 30분       | ★ Phase 3 launch 직전 의무 (carry-over)        |
| 8   | **mock-server admin endpoint negative regression test**                       | backend M3                   | 15분       | ☆ production binding `__mock` prefix 부재 검증 |

---

## Devil's Advocate 통합 (5명 각 1건)

1. **refactor**: workers=1 모순 → 누군가 `--workers=2`로 실행 시 즉시 깨짐 (이미 carry-over 확인됨)
2. **performance**: dev local 2 터미널 동시 실행 시 port 8787 EADDRINUSE 충돌
3. **quality**: production HTTPS SameSite=None + Secure 전환 시 mock-server `SameSite=Lax` hardcode → 로그인 무한루프 (C1과 동일 root cause)
4. **backend**: 2027-Q1 공인중개사 도입 시 production CORS allowHeaders 변경 → mock drift로 E2E 녹색 → Firefox 사용자만 preflight 차단 → 베타 오픈 후 티켓 폭주
5. **devops**: WebKit hydration 5-10s 추가로 chromium보다 늦은 reset → race (workers=1로 차단됨, 단 카나리)

**통합 시사점:** 모든 Devil's Advocate가 **contract drift 또는 isolation 부재**로 수렴. 본 chunk가 제거한 race (page.route() 인터셉트)를 다른 차원에서 재발현 가능.

---

## 본 chunk 영속 결과

### ✅ 흡수 완료 (Session 077)

- Hono cross-origin mock server (port 8787) 도입 → `page.route()` race 제거
- `page.on('response')` 미러링으로 spec 시그니처 호환 유지 (override 비동기 시그니처 1줄 변경)
- WebKit QuestionCard scenario unskip → Phase 3 launch 차단 잠재 위험 해소
- CORS allowHeaders/exposeHeaders 명시 enumeration (root cause 해소, chromium + WebKit 정합)
- Cookie Path shared 상수 import (자율 흡수 — 5-페르소나 backend C3 + quality Q1)
- emptyCounters DRY 통합 (자율 흡수 — 5-페르소나 refactor m-5)

### ☐ Carry-over (ADR-040 §8 등재)

다음 chunk 우선순위 매트릭스 8건 + Year 2 4건 — 진산 우선순위 결정 위임.

---

## 검증 게이트

- ✅ `pnpm --filter @thepick/web typecheck` PASS
- ✅ `pnpm --filter @thepick/web lint` (src) PASS
- ✅ `pnpm --filter @thepick/web exec playwright test` — **18 PASS** (chromium 12 + mobile-375 3 + mobile-webkit 3) 22.3s
- ✅ Critical 0건 (backend C1/C2/C3는 본 chunk 자체 결함이 아닌 이전부터 존재한 drift 확장 — production sync 별도 chunk)
- ✅ 5-페르소나 독립 병렬 (자가 편향 차단망 의무 충족)

**판정:** 본 chunk 완료 가능. backend Critical 3건은 ADR-040 §8 다음 chunk 우선순위 #1 (production CORS sync)로 격상.

---

## 관련 파일 (절대 경로)

- `/home/soo/ClaudePro/ThePick/apps/web/e2e/mock-server/{types,state,server,start}.ts`
- `/home/soo/ClaudePro/ThePick/apps/web/e2e/helpers/mock-api.ts`
- `/home/soo/ClaudePro/ThePick/apps/web/playwright.config.ts`
- `/home/soo/ClaudePro/ThePick/apps/web/package.json`
- `/home/soo/ClaudePro/ThePick/apps/web/e2e/{happy-path,session-restoration,api-errors,silent-failure-surface,mobile-375}.spec.ts`
- `/home/soo/ClaudePro/ThePick/docs/adr/ADR-040-step-3-ux-6c-server-contract-gap-carryover.md` §8
- `/home/soo/ClaudePro/ThePick/apps/api/src/index.ts` (C1+C2 drift 대상 production 코드)
- `/home/soo/ClaudePro/ThePick/apps/api/src/auth/routes.ts` (C3 / M1 drift 대상)
- `/home/soo/ClaudePro/ThePick/packages/shared/src/constants/auth.ts` (cookie path single source)
- `/home/soo/ClaudePro/ThePick/packages/shared/src/constants/cors.ts` (신설 권고 — 다음 chunk #1)
