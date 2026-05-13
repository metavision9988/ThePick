# Step 3-UX-6g (ADR-040 §5 #7) — 4-Pass 독립 에이전트 통합 리뷰

**대상:** Playwright E2E 3 시나리오 (happy / restoration / mobile-375)
**일시:** 2026-05-13 22:00 KST (Session 074)
**리뷰 방식:** 3 독립 에이전트 병렬 — silent-failure-hunter (Pass 1) + quality-engineer (Pass 3) + system-architect (Pass 2 + Pass 4)
**리뷰 범위:** 변경 8 파일 (playwright.config.ts, fixtures.ts, mock-api.ts, 3 spec, package.json, .gitignore) + 연관 12 파일 (StudyFlow / QuestionCard / AuthForm / study-api / study.astro / shared constants / api routes / 외)

---

## 통합 판정

| Pass          | Critical | Major  | Minor  | N/A   | 흡수                            |
| :------------ | :------- | :----- | :----- | :---- | :------------------------------ |
| 1 (Surgeon)   | 5        | 7      | 7      | 0     | 5/5 + 부분                      |
| 2 (Architect) | 1        | 4      | 3      | 1     | 1/1 + 부분                      |
| 3 (Advocate)  | 0        | 6      | 5      | 4     | 1/6 + carry-over                |
| 4 (Contract)  | 0        | 2      | 3      | 1     | 1/2 + 부분                      |
| **합계**      | **6**    | **19** | **18** | **6** | **8 즉시 흡수 + 11 carry-over** |

**판정: 완료 가능** — Critical 6건 모두 흡수, 잔여 Major 11건은 ADR-040 §6 carry-over로 영속.

---

## 즉시 흡수 8건 (본 step 종료 전)

### Critical 흡수 (6건)

| ID          | 설명                                                                                                                                | 흡수 위치                                                      |
| :---------- | :---------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| Pass1 C-1   | route 등록 순서 LIFO 정합 명시 (`/session/*` → `/session/*/complete`)                                                               | `apps/web/e2e/helpers/mock-api.ts:140-152`                     |
| Pass1 C-2   | `route.continue()` silent fallthrough → `route.abort('failed')` + `console.error`                                                   | `apps/web/e2e/helpers/mock-api.ts:121-125`                     |
| Pass1 C-3   | happy-path에 `api.counters.progress` 검증 추가 (ProgressViz silent skip 차단)                                                       | `apps/web/e2e/happy-path.spec.ts:32-34`                        |
| Pass1 C-4   | `hideAstroDevToolbar` readyState 분기 + `documentElement` fallback (race 차단)                                                      | `apps/web/e2e/helpers/mock-api.ts:233-249`                     |
| Pass1 C-5   | `callLog: EndpointKey[]` + happy-path 호출 순서 검증 + grade payload validation (`questionId`/`userAnswer`/`inputType` 누락 시 422) | `mock-api.ts:36,41,93,98,171-195` + `happy-path.spec.ts:64-73` |
| Pass2 P2-C1 | mock cookie 이름 `session` → 실제 contract (`tp_access` + `tp_refresh`, Path `/api` + `/api/auth`)                                  | `mock-api.ts:14,55,212-231`                                    |

### Major 흡수 (2건)

| ID                         | 설명                                                                                                   | 흡수 위치                                                |
| :------------------------- | :----------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| Pass1 M-1 + Pass3 MAJOR-A1 | `waitForLoadState('networkidle')` 제거 → React fiber `__reactProps$*` 검출로 결정적 hydration sentinel | `mock-api.ts:217-227` (`waitForReactHydration`) + 3 spec |
| Pass1 M-7                  | `vite-error-overlay` + `vite-plugin-checker-error-overlay`도 catch-all hide                            | `mock-api.ts:236`                                        |
| Pass3 MAJOR-A4             | mobile-375 QuestionCard 시나리오에 "다음 문제" 버튼 44px+ 검증 추가                                    | `mobile-375.spec.ts:101-108`                             |

---

## Carry-over 11건 (ADR-040 §6 영속)

| 우선도                 | ID                           | 설명                                                                                       | 권장 시점            |
| :--------------------- | :--------------------------- | :----------------------------------------------------------------------------------------- | :------------------- |
| ★ Phase 3 launch 차단  | Pass3 MAJOR-A5               | CI 통합 `.github/workflows/ci.yml` + `~/.cache/ms-playwright` cache + HTML report artifact | 본 step 직후         |
| ★ Phase 3 launch 차단  | Pass3 MAJOR-A2 + Pass1 M-2   | error path E2E (429 / 422 / 503 / network) 별도 spec                                       | 본 step 직후         |
| Phase 3 launch 차단    | Pass3 MAJOR-A3               | weakDelta.available=false silent failure surface E2E                                       | 본 step 직후         |
| Phase 3 launch 후 30일 | Pass3 MAJOR-A6 + Pass2 P2-M4 | WebKit (iOS Safari) project — `playwright install webkit` + mobile-375 dual                | Phase 3 launch +30일 |
| Phase 3 launch 후 30일 | Pass2 P2-M2 + P2-M4          | production preview E2E (`astro preview`)                                                   | Phase 3 launch +30일 |
| Major                  | Pass2 P2-M1                  | schema-drift contract layer (`packages/shared/src/contracts/study-api.ts`)                 | 별도 chunk           |
| Major                  | Pass3 Devil's 1              | mock sessionId-aware progression — restoration 후 다음 미응답 문제                         | 별도 chunk           |
| Major                  | Pass2 P2-M3                  | CORS Allow-Origin baseURL 동적 산출 + `installApiMock` 옵션화                              | 별도 chunk           |
| Major                  | Pass1 M-5 + P2-M2            | `pnpm dev` cwd — `pnpm --filter @thepick/web dev` 명시                                     | 별도 chunk           |
| Minor                  | Pass4 P4-M2                  | AESTHETIC.md §3.5 input 요소 44px+ 의무 명시                                               | AESTHETIC 갱신 시    |
| Minor                  | Pass4 P4-m3                  | ADR §5 진척 컬럼 dashboard 패턴 표준화                                                     | 별도 chunk           |

추가 ADR-040 §"2.2 sessionStorage E2E" 갱신:

- ✅ 새로고침 복원 / examType mismatch / completed cleanup — 본 step 흡수
- ☐ private mode (sessionStorage throws) / 다중 탭 / iOS Safari background unload — carry-over

---

## 검증 완료 증거 (Pass 별 3건+)

### Pass 1 (Surgeon) — PASS 5건

1. `/api/auth/login` handlePreflight + counter + cookie set (mock-api.ts:101-105) ↔ AuthForm.handleSubmit:138-148
2. `/api/study/grade` phase 전환 contract (3건 후 completed) — `makeGradeResponse(cardsCompleted >= 3 ? 'completed' : 'main')`, StudyFlow.handleGraded 자동 finalize
3. examType mismatch silent corruption 차단 (StudyFlow:230-233 ↔ restoration.spec.ts:70-91)
4. CORS preflight handler — 모든 cross-origin credentials='include' 정합
5. `readActiveSession` schema validation — JSON.parse fail / 빈 sessionId / 비-1st/2nd examType cleanup

### Pass 2 (Architect) — PASS 5건

1. happy-path 셀렉터 정합 — ModeSelector aria-label ↔ mobile spec regex 매칭
2. API endpoint 매칭 — study-api.ts 5 endpoint 모두 mock 등록
3. Astro page mount 종속성 — ProgressViz + StudyFlow + OfflineIndicator 모두 client:load mock 등록
4. vitest와 e2e 격리 — vitest.config.ts include 패턴이 e2e/ 자동 제외
5. tp_access cookie를 require-auth 미들웨어가 실제 검사 (P2-C1 흡수 근거)

### Pass 3 (Advocate) — PASS 5건

1. CORS preflight + Set-Cookie 응답 — cross-origin credentials 정합
2. sessionStorage key 일치 (`thepick:active-session`) — fixture ↔ StudyFlow 1:1
3. examType mismatch 자동 정리 — study.astro examType="1st" ↔ persisted "2nd" cleanup
4. horizontal overflow 1px 허용 — 반올림 케이스 결정성
5. counter 기반 호출 횟수 보장 — `expect.poll(api.counters.X)` race 차단

### Pass 4 (Contract) — PASS 6건

1. ADR-040 §5 #7 본문 명세 정합 — happy/restoration/mobile-375 3 시나리오 + `apps/web/e2e/` 위치
2. memory feedback_review_filename_pattern 정합 — `review-YYYYMMDD-HHMMSS-step-3-ux-6g-4pass-integrated.md` prefix
3. Hard Rule 17 정합 — e2e 디렉토리 리터럴 0건, `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 경유
4. ADR-039 5 mode contract — makeModeStats 5 mode 모두 영속
5. ADR-007 멀티시험 Year 2 — examType '1st'|'2nd' literal 정합
6. production-quality.md no-shortcuts — reusable mock infrastructure + counters + override

---

## Devil's Advocate (각 Pass 1건+)

- **Pass 1**: apps/api dev 서버가 떠있는 상태에서 mock 패턴 누락 시 `route.continue()`가 실제 server로 fall-through → silent contract drift. **→ C-2 흡수로 차단** (`route.abort('failed')` + console.error).
- **Pass 2**: 본 E2E는 dev mode 의존 — 6개월 뒤 cookie 이름 회전 / Astro page server-side guard 추가 시 frozen snapshot이 새 contract 위반 silent 통과. **→ P2-C1 즉시 흡수 + P2-M1 schema-drift carry-over**.
- **Pass 3**: mock이 sessionId-aware하지 않아 복원 후 동일 문제 재노출을 검증 못 함. webServer.timeout 60s가 CI cold start 부족 가능. **→ carry-over (§6)**.
- **Pass 4**: ADR-040 §"상태: Fully Resolved" vs §5 매트릭스 진척 columns 불일치 → 6개월 뒤 sentry 감사 silent pivot 의심. **→ §5 진척 컬럼 추가로 §6 영속**.

---

## 검증 결과 (최종)

```
$ pnpm -F @thepick/web exec playwright test
Running 7 tests using 3 workers
  ✓  [chromium] happy-path.spec.ts (2.3s)
  ✓  [chromium] session-restoration.spec.ts (1.8s × 3)
  ✓  [mobile-375] mobile-375.spec.ts (0.6-0.9s × 3)
  7 passed (7.8s)

$ pnpm -F @thepick/web typecheck
> tsc --noEmit  # OK

$ pnpm -F @thepick/web test
Test Files  3 passed (3)
     Tests  16 passed (16)
```

판정: **완료 가능 — Critical 0건, Major 흡수 8건 + carry-over 11건 (ADR-040 §6 영속)**.
