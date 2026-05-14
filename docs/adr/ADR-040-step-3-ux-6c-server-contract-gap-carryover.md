# ADR-040: Step 3-UX-6c LOCK §1 vs 서버 contract 격차 carry-over

- **상태:** Fully Resolved (G-1 + G-2 + G-3 모두 흡수)
- **결정일:** 2026-05-13 (Session 071 carry-over) → 2026-05-13 Step 3-UX-6c-2 G-1/G-2 흡수 → 2026-05-13 Step 3-UX-6c-3 G-3 흡수
- **결정자:** Claude Opus 4.7 (4-Pass 독립 리뷰 발견) + 진산 (carry-over 채택 → 우선순위 진행 위임 → G-3 옵션 A 채택)
- **관련 영역:** SessionStart "일일 목표 progress" (✅ 완료) + SessionSummary "약점 영역 변화" (✅ 완료) + 세션 복원 (✅ sessionStorage + 자동 복원 채택)

---

## 맥락 (Context)

Step 3-UX-6c 4-Pass 독립 리뷰에서 LOCK §1 (`docs/design/responses/step-3-ux-6-LOCK.md`) 명세 vs 서버 contract 사이 **데이터 격차 3건** 발견:

| 격차 | LOCK §1 명세                           | 서버 contract 현재                                               | 클라이언트 영향                                                      |
| :--- | :------------------------------------- | :--------------------------------------------------------------- | :------------------------------------------------------------------- |
| G-1  | SessionStart "일일 목표 progress"      | GET /api/study/mode 응답에 streak / dailyGoal block 부재         | SessionStart 진입 시 일일 목표 surface 불가                          |
| G-2  | SessionSummary "약점 영역 변화"        | SessionCompleteResponse에 weak delta / before-after 필드 부재    | 세션 후 약점 변화 surface 불가                                       |
| G-3  | (LOCK 미명시이지만 PWA 정합) 세션 복원 | GET /api/study/session/:id 엔드포인트 존재하나 클라이언트 미호출 | 페이지 새로고침 시 진행 중 세션 유실 → D1 study_sessions 고아 레코드 |

**근본 원인** — LOCK §1은 UI 명세이며 서버 endpoint 확장 선결 조건을 명시하지 않음. Session 070 (Step 3-UX-5c) deploy 시점에 본 SLO surface 자료를 GET /mode 응답에 포함하지 않았음. 본 ADR은 본 격차를 carry-over로 영속하여 회귀 방지.

---

## 결정 (Decision)

**Step 3-UX-6c 본 step 종료 후 다음 chunk으로 carry-over**:

### 1. G-1 + G-2: 서버 endpoint 확장 후 클라이언트 surface

**Step 3-UX-6c-2 (carry-over)** — 다음 sub-step:

- **G-1 fix**: GET /api/study/mode 응답에 `streak: {current, longest, dailyGoalProgress}` 추가 + (선택) `dailyGoal: number` 추가. SessionStart에서 streak / 일일 목표 progress surface 즉시 가능.
- **G-2 fix**: SessionCompleteResponse에 `weakDelta: {beforeAvg, afterAvg, deltaCount}` 또는 `weakBreakdown: ReadonlyArray<{subject, before, after}>` 추가. SessionSummary에서 약점 영역 변화 surface.

본 server 변경은 마이그레이션 0036 (선택) + apps/api routes 확장 + tests + production deploy 의무.

### 2. G-3: 세션 복원 (별도 step 또는 별도 plan)

**Step 3-UX-6c-3 (carry-over) 또는 Step 3-UX-6e 검증 chain**:

- URL hash 또는 sessionStorage에 진행 중 sessionId 보존
- StudyFlow init 시 보존된 sessionId가 있고 phase !== 'completed'인 경우 GET /api/study/session/:id 호출하여 복원
- 복원 실패 (FORBIDDEN / NOT_FOUND) 시 graceful fall-back to mode-select

**또는** 의도적 정책 (세션 = volatile, 새로고침 시 유실)으로 ADR 영속하고 클라이언트 변경 없음.

### 3. Step 3-UX-6c 본 step 종결 정책

Critical 2건 (LOCK §1 위반) carry-over 명시로 흡수 — 본 step에서는 **5 mode 채택 + UI 구조 영속**을 우선 deliver. 데이터 surface 항목은 서버 endpoint 확장 후속 chunk에서 처리.

---

## 채택 근거

1. **서버 endpoint 변경은 본 step 범위 초과** — production Worker `390a7eb7` 변경 필요 + 마이그레이션 0036 + tests + smoke. Step 3-UX-6c scope (UI 컴포넌트 3종 + 통합 흐름)를 초과.
2. **LOCK §1 UI 구조는 본 step에서 완전 영속** — 5 mode + 카드/streak/액션 layout 모두 영속. surface 데이터만 carry-over → 데이터 채워지면 즉시 동작 (UI 변경 0).
3. **세션 복원 (G-3)은 Phase 3 PWA 정합** — 별도 plan 또는 Step 3-UX-6e 검증 chain 정합. PWA Background Sync 정합 검토 의무.

---

## 영향 (Consequences)

### 1. 본 step (3-UX-6c) 영속 항목 (모두 완료)

- ✅ ADR-039 (mode/phase 정합 5 mode contract)
- ✅ AESTHETIC.md §3.3b (5 mode 표 + 좌측 컬러 보더 + 추천 amber pill)
- ✅ apps/web/src/lib/study-api.ts (fetch wrapper + StudyApiError class)
- ✅ apps/web/src/components/session/types.ts (5 mode MODE_META + ModeStatsResponse 외 4종)
- ✅ apps/web/src/components/session/ModeSelector.tsx (5 mode 세로 stack)
- ✅ apps/web/src/components/session/SessionStart.tsx (cards 입력 + streak 영역 placeholder)
- ✅ apps/web/src/components/session/SessionSummary.tsx (정답률 hero + streak + 액션)
- ✅ apps/web/src/components/StudyFlow.tsx (state machine 통합)
- ✅ apps/web/src/components/QuestionCard.tsx (onGraded + onExhausted callback 추가)
- ✅ apps/web/src/pages/study.astro (QuestionCard → StudyFlow 교체)

### 2. carry-over (본 ADR-040)

- ☑ **Step 3-UX-6c-2 (server contract)** — GET /mode + SessionCompleteResponse 확장 **— 완료 (Session 072, 2026-05-13)**
  - ☑ apps/api/src/study/routes.ts GET /mode 응답 `streak: {current, longest, dailyGoalProgress}` + `dailyGoal: number` 추가
  - ☑ apps/api/src/study/routes.ts SessionCompleteResponse `weakDelta: {available, cardsReviewed, stillWeakCount, bySubject}` 추가
  - ☑ apps/web ModeStatsResponse + SessionCompleteResponse type 갱신 + StreakSummary 단일 재사용
  - ☑ SessionStart 일일 목표 progress bar (NaN 가드 포함) 영속
  - ☑ SessionSummary 약점 잔존 bySubject 5건 list + silent failure 안내 영속
- ☑ **Step 3-UX-6c-3 (session 복원)** — sessionStorage + 자동 복원 채택. **완료 (Session 072, 2026-05-13)** — 진산 옵션 A 결정.
  - ☑ `ACTIVE_SESSION_KEY = 'thepick:active-session'` + PersistedSession (sessionId/examType/baselineLongest) 영속
  - ☑ loadModes 진입 시 GET /session/:id → phase !== 'completed' 시 questioning 복원, completed/401/403/404/network graceful fallback
  - ☑ handleStart 성공 시 영속, finalizeSession 성공 시 정리 (실패 시 의도적 유지 — 재시도 path 보존)
  - ☑ baselineLongest 영속 → 신기록 hero UX 정합 (4-Pass M-3 흡수)
  - ☑ readActiveSession JSON.parse 실패 시 dev 로깅 + 자동 정리 (4-Pass M-2 흡수)
- ☑ **streak 일관성** — loadModes 시 stats.streak 으로 초기화 + 복원 시 sessionStorage baselineLongest 적용 (Session 072)

### 2.1 Step 3-UX-6c-2 실구현 채택 사유 영속 (4-Pass M-3 흡수)

**G-2 weakDelta 응답 shape 채택 사유** — 본 ADR §"결정 §1" 옵션 (`{beforeAvg, afterAvg, deltaCount}` 또는 `weakBreakdown {subject, before, after}`)이 아닌 **제3 옵션** 채택:

```ts
weakDelta: {
  available: boolean,             // silent failure를 정상 0건과 구분 (4-Pass C-1 흡수)
  cardsReviewed: number,          // 본 세션 distinct card 수 (GROUP BY card_id)
  stillWeakCount: number,         // weak_score > 0 잔존 카드 수
  bySubject: [{subject, reviewed, stillWeak}]
}
```

근거: **before 스냅샷 부재**. 본 시스템은 weak_score를 user_progress.weak_score 단일 row로 영속하므로 "session 시작 시점 weak_score" 스냅샷이 보유되지 않는다. 단순 delta(개선치)는 산출 불가 — 거짓 delta 산출보다 **잔존 약점 surface로 사용자가 직접 reviewed 대비 stillWeak 비교** 가능하게 한다 (정직성 우선).

**dailyGoalProgress 산식 채택** — DISTINCT card_id COUNT (4-Pass M-3 흡수):

```sql
SELECT COUNT(DISTINCT card_id) AS cnt FROM study_reviews
 WHERE user_id = ? AND reviewed_at >= ? AND reviewed_at < ?
```

근거: 같은 카드 N회 review = N% 진척이 아닌 1장 학습 진척. 사용자 진척 정직성 정합. /mode + /grade 두 endpoint 동일 식.

**dailyGoalProgress examType 무필터 결정** — 본 쿼리는 user_id + reviewed_at만 필터링하며 examType 무관 (1차+2차 통합 일일 목표 진척). 수험생 입장 "오늘 학습량"은 시험 구분 없이 통합 표현이 자연스러우며, Year 2 멀티시험 확장 시 별도 ADR로 재결정.

**streak 표시 시점** — GET /mode 응답은 streak_records 영속값 그대로 반환. 사용자가 어제 학습 후 오늘 첫 grade 전이면 어제 시점 current_streak 표시. /grade 응답에서 today 기준 갱신값으로 자동 surface. ADR 명시 의무 영속 (4-Pass M-7).

### 2.2 4-Pass 리뷰 carry-over 항목 (다음 step 이월)

본 step (3-UX-6c-2 + 3-UX-6c-3) 4-Pass 독립 에이전트 리뷰 결과 carry-over (Step 3-UX-6e 검증 chain 또는 별도 ADR):

**Step 3-UX-6c-2 carry-over:**

- ☐ **/mode 503 영향 면적** (silent M-1) — Promise.allSettled 도입으로 streak 부분 실패 시 graceful degradation. 본 step은 7 쿼리 fail-fast 유지.
- ☐ **subject NULL 데이터 노출 정책** (silent M-5) — exam_questions.subject NULL 카드가 사용자에게 "미분류" 라벨 surface. 데이터 품질 게이트 추가 또는 UI 분리 표시.
- ☐ **SessionStart 빈 입력 silent ignore** (silent Mi-1) — `Number.parseInt('abc')` 시 사용자 시각 피드백 부재.
- ☐ **ModeStatsResponse runtime validation** (silent Mi-3) — Zod 또는 manual guard로 서버 응답 shape 검증.
- ☐ **AESTHETIC §2.2 emerald-500 토큰 등록** (quality m-1) — progress 달성 색 토큰화.
- ☐ **text-[11px] 비표준 토큰 사용** (quality m-2) — SessionStart/SessionSummary 미세 텍스트 토큰화 또는 text-xs 통일.

**Step 3-UX-6c-3 carry-over:**

- ☐ **useEffect cleanup / AbortController 패턴** (code-reviewer + silent M-1) — examType prop 변경 race 시 stale setState 가능. study-api safeFetch에 AbortSignal 확장 동반 필요 (변경 표면 큼).
- ☐ **SessionDetail.examType 필드 추가** (code-reviewer Pass 2 M-4) — 서버 응답에 examType 포함하여 클라이언트 sessionStorage 외 D1-source 이중 검증. API 계약 변경 동반.
- ☐ **Object.hasOwn / UUID v4 regex hardening** (silent m-2/m-3) — readActiveSession type guard 강화 (현재 prototype pollution 차단 OK, 추가 robustness).
- 🟡 **sessionStorage E2E Playwright 시나리오** (silent Devil's Advocate) — Step 3-UX-6g §5 #7 흡수로 **부분 영속** (2026-05-13):
  - ✅ 학습 중 새로고침 → sessionStorage 복원 (`session-restoration.spec.ts`)
  - ✅ examType mismatch 자동 정리
  - ✅ completed phase fallback
  - ☐ private mode (sessionStorage throws) — 별도 chunk carry-over
  - ☐ 다중 탭 격리 — 별도 chunk carry-over
  - ☐ iOS Safari 탭 언로드 / background unload — WebKit project 도입 의무 (P3 launch 후 30일 carry-over)

### 3. LOCK §1 보정 (본 ADR 동시 영속)

- LOCK §"4. 보정 / 추가 지시" 섹션에 본 ADR-040 참조 명시
- LOCK §1 SessionStart "일일 목표 progress" 항목 → "(ADR-040 carry-over)" 주석
- LOCK §1 SessionSummary "약점 영역 변화" 항목 → "(ADR-040 carry-over)" 주석

### 4. 게이트 / 검증 (Step 3-UX-6 종료 의무)

- [x] Step 3-UX-6c-2 (server contract 확장) 완료 후 SessionStart 일일 목표 progress UI 영속 확인 (2026-05-13)
- [x] Step 3-UX-6c-2 완료 후 SessionSummary 약점 영역 변화 UI 영속 확인 (2026-05-13)
- [x] Step 3-UX-6c-3 결정 — 진산 옵션 A 채택 (sessionStorage + 자동 복원). 구현 완료 (2026-05-13)
- [x] Step 3-UX-6e 검증 chain 4-Pass + 5-페르소나 완료 (Session 072, 2026-05-13). 통합 보고서: `.claude/reviews/phase3-tech-debt-20260513-163000.md`
- [x] **Step 3-UX-6g §5 #7 Playwright E2E 3 시나리오 흡수 (2026-05-13)** — `apps/web/e2e/` 7건 PASS (happy 1 + restoration 3 + mobile-375 3). 4-Pass 독립 리뷰 3 에이전트 (silent-failure-hunter / quality-engineer / system-architect) 병렬 — Critical 5건 + Major 13건 흡수. 통합 보고서: `.claude/reviews/review-20260513-step-3-ux-6g-4pass-integrated.md`

### 5. Phase 3 launch toggle 차단 의무 매트릭스 (5-페르소나 흡수)

★ Phase 3 launch toggle 전 의무 흡수 (총 ~25h, 1 sprint):

| #   | 항목                                                                              | 비용 | Persona          | 위치                        | 진척                          |
| :-- | :-------------------------------------------------------------------------------- | :--- | :--------------- | :-------------------------- | :---------------------------- |
| 1   | apps/web vitest + jsdom 인프라                                                    | 6h   | quality C1       | `apps/web/vitest.config.ts` | ✅ Session 073 흡수           |
| 2   | 4-Pass 흡수 결함 3건 회귀 차단망 (choices=null / NaN guard / weakDelta available) | 4h   | quality C3       | apps/web units              | ✅ Session 073 흡수           |
| 3   | /mode + /progress + /session/:id rate-limit (DoS 차단)                            | 30분 | backend M-D1     | apps/api routes             | ✅ a403cb9 흡수               |
| 4   | streak_records timezone schema (KST/UTC mismatch 차단)                            | 1h   | backend C-D2     | migration 0038 + ADR-041    | ✅ a403cb9 흡수               |
| 5   | silent_failure telemetry alert path (Cron + Email Routing)                        | 3h   | devops CRIT-DO-1 | ADR-043                     | ✅ 1050247 흡수               |
| 6   | Worker rollback + D1 migration mismatch ADR (deploy ordering)                     | 2h   | devops CRIT-DO-2 | ADR-042                     | ✅ 1050247 흡수               |
| 7   | Playwright E2E 3 시나리오 (happy / restoration / 모바일 375px)                    | 8h   | quality M3 격상  | `apps/web/e2e/`             | ✅ Session 074 (3-UX-6g) 흡수 |

☆ Phase 3 launch 후 30일 내:

- secret rotation 분기 정책 (devops CRIT-DO-3) — 1h
- master-dashboard.md v2 Phase 3 wire-up (devops MAJOR-DO-4) — 4h
- /health/deep + synthetic check (devops MAJOR-DO-3) — 2h

Year 2 / Phase 4 carry-over:

- routes.ts 1962 LOC 분할 (refactoring R-C1) — 8h
- /grade 480 LOC 분할 (refactoring R-C2) — 12h
- /grade D1 batch API (performance C-P2) — telemetry 1주 측정 후 결정
- study_reviews daily_aggregate (performance C-P4) — Year 2 진입 전
- study_reviews.card_id polymorphic FK (backend C-D1) — 매년 교재 개정 시점

### 5. 위험 / 미해소 사항

- **D1 study_sessions 고아 row** — 사용자가 questioning 중 새로고침 시 ended_at = NULL phase != 'completed' 레코드 영속. 운영 dashboard에서 가시화 의무 (memory `project_engine_observability` 정합).
- **클라이언트 fallback streak 표시 "0일 · 최장 0"** — 첫 grade 응답 전에는 사용자에게 부정확한 streak 표시. SessionStart UX 손상. 본 ADR carry-over로 후속 처리.

### 6. Step 3-UX-6g §5 #7 흡수 후 carry-over (2026-05-13, Session 074)

본 step 4-Pass 독립 리뷰 (3 에이전트 병렬) 결과 Major 흡수 후 잔여 carry-over:

- ✅ **error path E2E 시나리오 — Session 075 (2026-05-14) 흡수** (quality MAJOR-A2 + silent M-2): `apps/web/e2e/api-errors.spec.ts` 5 시나리오 (HTTP 429 rate-limit + role=alert + 다시 시도 → 다음 문제 회복 풀체인, HTTP 422 QUESTION_HAS_NO_ANSWER, HTTP 422 generic validation, HTTP 503 service unavailable, network error fetch abort). mock-api에 `gradeSequence` override 추가 (status + body 시퀀스) + payload 가드. 사용자 빈도 1순위 분기 회귀 차단망 발동.
- ✅ **silent_failure surface E2E — Session 075 (2026-05-14) 흡수** (quality MAJOR-A3): `apps/web/e2e/silent-failure-surface.spec.ts` 3 시나리오 (`weakDelta.available=false` "약점 영역 집계를 불러오지 못했습니다" 안내 + 정상 happy path 비교 + cardsReviewed=0 정상 0건 구분). mock-api에 `completeResponse` override 추가. SessionSummary 4-Pass C-1 흡수 영속 회귀 차단.
  - 4-Pass 독립 리뷰 (quality-engineer): Critical 0건 + Major 4건 + Minor 5건. 4건 즉시 흡수 (MAJOR-S1+AD1 회복 path 풀체인 + MAJOR-A1 payload 가드 + MINOR-A2 import 순서 + MINOR-AD2 role=alert). 잔여 carry-over:
- ✅ **gradeSequence body discriminated union — Session 076 (2026-05-14) 흡수** (quality MAJOR-C1): `GradeResponseEntry` type 도입 (`{status: 200, body: GradeResponse}` | `{status: 4xx/5xx, body: {error: string}}`). 200 응답은 server contract `GradeResponse` 강제 → happy response 추가 시 schema drift TypeScript 단계 차단. 4xx/5xx body는 `error` field 필수 → QuestionCard.tsx:147 정합.
- ✅ **CORS_HEADERS / handlePreflight 헬퍼 export — Session 076 (2026-05-14) 흡수** (quality MINOR-AD2): `mock-api.ts`에서 `CORS_HEADERS` (Object.freeze + Readonly) + `handlePreflight` export. `api-errors.spec.ts` network abort 시나리오 inline CORS 복제 5줄 제거 → `handlePreflight(route)` 1줄. CORS_HEADERS 변경 시 spec 전수 sync 자동.
- ✅ **Retry-After 헤더 mock — Session 076 (2026-05-14) 흡수** (quality MINOR-AD3): `GradeResponseEntry.headers?` optional field 추가. 429 시나리오 `{ headers: { 'Retry-After': '30' } }` 주입 + `page.on('response')` 캡처 → contract 회귀 차단. 클라이언트가 헤더 기반 retry/back-off 로직 도입 시 mock fail-loud.
- ☐ **schema-drift contract layer** (architect P2-M1) — `packages/shared/src/contracts/study-api.ts`에 client/server/mock 공통 type 단일 source. mock fixture가 frozen snapshot 되는 silent risk 차단.
- 🟡 **WebKit (iOS Safari) project 부분 도입 — Session 075 (2026-05-14)** (quality MAJOR-A6): `mobile-webkit` project 신규 (devices.iPhone SE = webkit + 375x667 + iOS UA + touch). CI ci.yml e2e job `--with-deps chromium webkit` 동시 설치. CORS_HEADERS `Access-Control-Allow-Headers: '*'` + Max-Age 제거로 WebKit 정합 강화 시도.

  | 시나리오                                            | webkit 상태          | 비고                                  |
  | :-------------------------------------------------- | :------------------- | :------------------------------------ |
  | ModeSelector — overflow + 모드 버튼 44px+           | ✅ PASS              | iOS UA + touch + GET preflight 통과   |
  | SessionStart — overflow + 시작/뒤로/입력 44px+      | ✅ PASS              | iOS UA + touch + GET preflight 통과   |
  | QuestionCard — overflow + 채점/라벨/다음 문제 44px+ | 🟡 skip (carry-over) | cross-origin POST preflight 처리 차이 |

- ☐ **WebKit cross-origin POST preflight 호환성 (QuestionCard scenario)** (Session 075 carry-over) — `page.route().fulfill()` cross-origin POST preflight 처리가 chromium과 다름.
  - **root cause 후보 1 (가장 유력)**: fetch spec WD-2024 — `Access-Control-Allow-Headers: '*'` + `Allow-Credentials: true` 조합은 credentialed request에서 wildcard 무효화. chromium은 spec보다 관대해 통과, WebKit은 엄격 enforce. 명시 enumeration `'Content-Type, Authorization, Cookie, X-Requested-With'` 복원으로 해소 가능성.
  - **root cause 후보 2**: WebKit ITP (Intelligent Tracking Prevention)가 cross-origin POST + credentials 차단. 클라이언트 `credentials: 'include'` 동작 차이.
  - **별도 chunk 흡수 path**: (a) ACA-Headers 명시 enumeration 복원 → 재시도, 또는 (b) `PUBLIC_API_BASE_URL=` empty (same-origin) E2E 모드, 또는 (c) Astro dev middleware로 `/api/*` proxy.
- ✅ **CI 통합 — Session 075 (2026-05-14) 흡수** (quality MAJOR-A5): `.github/workflows/ci.yml`에 신규 `e2e` job 추가 (`pnpm --filter @thepick/web exec playwright test`) + `~/.cache/ms-playwright` cache (key: `hashFiles('apps/web/package.json')` — Playwright 버전 회전 자동 invalidate) + `playwright-report/` artifact (always 14일) + `test-results/` artifact (failure 시 7일, trace/video/screenshot 보존). quality-gate test filter에도 `--filter @thepick/web` 추가 (vitest 16건 회귀 차단). PR마다 자동 실행 발동.
  - 4-Pass 독립 리뷰 (devops-architect): Critical 1건 + Major 6건 + Minor 3건. 2건 즉시 흡수 (M2 webServer.command `--filter @thepick/web dev` 명시 + M3 timeout 60→120s + m2 CI 시 stdout pipe). 잔여 7건 carry-over:
- ☐ **C1 — `e2e` job `needs: quality-gate` 결정** (architect Pass 2 Critical) — 진산 결정 위임: 옵션 A 병렬 유지(빠른 피드백, 현재) vs 옵션 B 직렬 전환(typecheck fail 시 e2e 부팅 비용 절감). ADR-040 §6 명세 외 운영 trade-off. 본 carry-over 등재 후 진산 결정.
- ✅ **M1 — cache key broad restore-keys 추가 — Session 076 (2026-05-14) 흡수** (devops surgeon Pass 1): `.github/workflows/ci.yml` Cache Playwright browsers step에 `restore-keys: playwright-${{ runner.os }}-` partial fallback 추가. Playwright 무관 devDep 변경 시 exact-match 실패해도 직전 버전 cache 재사용 → 평균 ~50% 다운로드 절감. `playwright install`이 동일 버전 검증 후 skip하므로 회귀 위험 0.
- ☐ **M4 — `astro dev` vs `astro preview` (Phase 3 launch 직전)** (architect Pass 2) — 현재 dev mode 검증은 HMR/toolbar/SSR fallback이 prod build와 다름. `webServer.command: 'pnpm --filter @thepick/web build && pnpm --filter @thepick/web preview'` 전환으로 prod-like 회귀 catch 강화. Phase 3 launch 직전 흡수.
- ☐ **M5 — flaky retry silent green detection** (advocate Pass 3) — `retries: 2`가 race condition을 silently 흡수. `--reporter=blob` artifact + retry 횟수 사후 분석 또는 `--max-failures=N` tightening. Phase 3 launch 후 carry-over.
- ☐ **M6 — trace 디버깅 가이드 부재** (advocate Pass 3) — `ci.yml`에 `if: failure()` notice step 추가하여 `npx playwright show-trace <trace.zip>` PR Checks UI에 자동 안내. 별도 chunk.
- ☐ **production preview E2E** (architect P2-M2/M4) — `astro preview` 기반 production build에서 동일 시나리오 검증. dev artifact (toolbar / Tailwind purge 차이) silent miss 차단.
- ☐ **mock sessionId-aware progression** (quality Devil's Advocate 1) — restoration 후 다음 미응답 문제 노출 검증. 현 mock은 counters.next 단순 increment → 복원 직후 동일 문제 silent re-show 검출 불가.
- ☐ **CORS Allow-Origin baseURL 동적 산출** (architect P2-M3) — `installApiMock(page, { allowedOrigin })` 옵션화. staging/preview baseURL 변경 시 cross-origin block 차단.
- ☐ **webServer.command 모노레포 cwd 안전** (silent M-5 + architect P2-M2) — `pnpm --filter @thepick/web dev` 명시 또는 `cwd` 옵션. monorepo root에서 호출 시 turbo race 회피.
- ☐ **AESTHETIC.md §3.5 input 요소 44px+ 의무 명시** (contract P4-M2) — 현 mobile-375 spec이 input.height ≥ 44를 검증하나 AESTHETIC 본문은 button/a/label만 명시. 양방향 동기.
- ☐ **ADR-040 §5 진척 컬럼 dashboard 확장** (contract P4-m3) — §5 매트릭스 진척 컬럼이 본 step 신규 추가. 향후 ADR carry-over 매트릭스 패턴 표준화 (별도 chunk).

### 7. 5-페르소나 자가 편향 감사 후 흡수 (2026-05-14, Session 076)

진산 직접 지시 — 직전 code-reviewer 단일 에이전트 0/0/0 판정이 자가 확인 편향 의심. refactoring-expert + performance-engineer + quality-engineer + backend-architect + devops-architect 5개 독립 병렬 페르소나 심층 점검 결과 **unique Critical 7건 발견** (5-페르소나 통합 보고서: `.claude/reviews/review-20260514-110702-5persona-step3-ux-6f-bias-audit.md`).

**즉시 자율 흡수 6건 (Session 076):**

- ✅ **A-1 RATE_LIMIT_EXCEEDED 실 서버 contract 정합** (backend C1): `api-errors.spec.ts:34` literal을 `'RATE_LIMITED'` → `'RATE_LIMIT_EXCEEDED'` (실 서버 `routes.ts:723,929` truth와 sync). 본 PR 신규 도입 위험 즉시 차단 — 향후 client error code 분기 시 mock/server silent divergence 0.
- ✅ **A-2 Retry-After tautology 제거** (refactor C-1 / quality M1): `expect(retryAfterHeader).toBe('30')` + `page.on('response')` listener 삭제. mock 자기 inject 헤더 자기 검증 = client(QuestionCard.tsx:141-144 헤더 무시) 회귀 차단 가치 0. mock impl 동결 차단 + listener leak 차단. 헤더 자체는 mock에 유지 + TODO 주석으로 client retry/back-off 도입 시 setTimeout/retry path 검증 의무 명시.
- ✅ **B-2 examId fail-loud 전수** (backend C2 / Hard Rule 16): mock-api에 `requireExamId(route)` helper + `/mode`, `/progress`, `/next`, `/grade` 모든 라우트에 `if (!(await requireExamId(route))) return` 가드. 누락 시 console.error + 422 `VALIDATION_ERROR`. 실 서버 `routes.ts:105-119` 정합. session 라우트(path-based, examId 불요)는 예외 명시. **Hard Rule 16 위반 spec 수준 last line of defense 영속.**
- ✅ **B-3 gradeSequence overflow fail-loud** (quality C2): `counters.grade >= seq.length` 시점에 console.error로 N번째 호출 + sequence length surface. 마지막 항목 silent 반복은 유지하되 회귀 가능성 명시. `fetchNext` → `submit` 오타 silent pass 차단.
- ✅ **B-4 gradeSequence empty fail-loud** (quality C3): `seq.length === 0` 시점에 console.error + 422 fulfill. 의도-동작 mismatch (reset vs ignore) 차단. `override({})`이 reset 정확 패턴임을 console message로 surface.
- ✅ **C-1 `.gitignore .claude/scheduled_tasks.lock`** (devops C-D1): 머신 간 PID/procStart 의미가 다른 세션-로컬 mutex가 우연 add → stale lock 영구 cron 차단 위험. .gitignore 영속.

**진산 결정 갈림길 3건 — 2026-05-14 결정 완료 (Session 076):**

- 🟡 **A-3 mutable singleton `overrides.current` 안전성 구조 강제** (refactor C-2) — **진산 결정 (a) carry-over 채택**. 현재 page-scoped라 safe + Year 2 reusable foundation은 production 코드 (학습 엔진/Graph RAG/Formula Engine/사용자 앱 골격)이고 E2E mock-api 자체는 다른 시험 프로젝트에서 각자 별도 mock 패턴이 예상되므로 우선순위 낮음. refactor M-1 (mock-api 348줄 SRP 분리) chunk에서 state machine 패턴과 함께 통합 결정.
- 🟡 **B-1 WebKit QuestionCard 시나리오 영구 skip silent miss** (quality C1) — **진산 결정 (a) carry-over + ADR 보강 + 다음 chunk 최우선 등재 채택**. 본 ADR §7에 다음 fact 명시 영속:
  - **"본 ADR §6 회귀 차단망 14건 측정은 chromium 한정"** — mobile-webkit project가 실제로 cover하는 시나리오는 ModeSelector + SessionStart (GET 응답만) 2건. QuestionCard 핵심 progress action (채점 → 다음 문제 버튼) cover 0건.
  - **Phase 3 launch 차단 잠재 위험 등급** — 실 사용자 95%+ iOS Safari (모바일 80% × Safari 95%+)의 핵심 진행 path가 회귀 검출 없이 production 노출. `position: sticky` / `100vh` viewport / scroll bounce / virtual keyboard overlay 등 iOS-specific 회귀가 chromium에서 PASS + production에서만 발현 가능.
  - **Session 076 same-origin proxy 도입 시도 결과** (롤백):
    - 시도: Astro `vite.server.proxy` `/api/*` → `localhost:8787` + `.env.development` `PUBLIC_API_BASE_URL=http://localhost:4321` (same-origin absolute URL).
    - 증상: e2e 전수 18 fail. mobile-375 project (chromium)에서도 workers=1 직렬 실행 시 **1 PASS (ModeSelector first) / 2 fail (SessionStart, QuestionCard) deterministic**. "네트워크 오류 — 잠시 후 다시 시도해 주세요." alert. mock이 fetch를 intercept 못 함.
    - 가설 후보:
      - (1) Playwright `page.route('**/api/...')` glob 매칭이 same-origin URL과 fragile — cross-origin URL (`http://localhost:8787/...`)에서는 OK였던 패턴이 same-origin (`http://localhost:4321/...`)에서 매칭 실패. minimatch glob 구현의 host 처리 차이 의심.
      - (2) Vite proxy가 first request만 intercept + 이후 캐시/race로 mock route 우회.
      - (3) Worker reuse 시 mock isolation issue + page.route 등록 시점 race.
    - 결정: 본 chunk **롤백 + carry-over** (CRITICAL RULE #5 정합). 시도 fact + 가설 영속 → 다음 chunk에서 root cause 분석 reference.
  - **다음 chunk 최우선 등재** — root cause 분석 우선:
    - (i) mock-api `page.route` glob을 regex로 전환 (`/\/api\/study\/(mode|grade|next)/` 등 host 무관 매칭)
    - (ii) 또는 same-origin 도입 전 `page.route` 등록 시점을 `beforeAll` (context-level)로 이전
    - (iii) 또는 `page.route` 자체를 우회하여 webServer 환경에서 mock service 별도 구동 (port 8787에 mock server)
    - 옵션 c (Allow-Headers enumeration 복원)는 ITP root cause 가능성 + 향후 custom header 동기화 부담으로 여전히 폐기. (iii) 옵션이 cross-origin 유지로 가장 안전.
- ✅ **C-2 `retries: 2` silent flaky cushion 강등** (devops C-D2 ≡ perf M-P1) — **진산 결정 (a) 2→1 즉시 강등 채택, Session 076 흡수**. `playwright.config.ts:23` `retries: CI ? 2 : 0` → `retries: CI ? 1 : 0` 1줄 변경. 본 Session 076 examId fail-loud 검증 중 mobile-webkit SessionStart가 retry로 silent green되는 실 사례 검증된 fact 영속 차단. fail-loud 원칙 (Hard Rule + production-quality.md "빈 catch 금지" 동일 맥락) + Year 2 확장 reference로 fail-loud 기본값 확정. false positive mitigation은 ADR §6 M5 (flaky retry silent green detection) 우선순위 상향 carry-over에서 retry 시계열 추적 + 진짜 transient 분리 별도 처리.

**신규 carry-over 12건 등재 (다음 chunk 또는 phase 종료 정리):**

- ☐ **refactor M-1 mock-api.ts 348줄 SRP 분리** — `helpers/mock-api/{cors,routes,state}.ts` + `helpers/playwright/{hydration,dev-toolbar}.ts` + `helpers/auth.ts`. 600줄 임계 도달 전 분리 권고.
- ☐ **refactor M-2 `Object.freeze` + `Readonly<T>` 이중 가드 일관성** — `as const` 또는 freeze 제거. cargo-cult 확산 차단.
- ☐ **refactor M-5 CI cache restore-keys silent contamination 검증** — `actions/cache@v4` partial restore + `playwright install` skip 동작 가정 미검증. version mismatch silent 우려.
- ☐ **perf M-P2 cache key Playwright 버전 단독화** — `hashFiles('apps/web/package.json')` → `@playwright/test` 버전만 hash. devDep 무관 invalidation 차단.
- ☐ **perf M-P3 HTML report 조건부 upload** — `if: always()` → `if: failure()` 또는 retention 14d → 3d. GitHub Actions storage budget 임박 시.
- ☐ **devops M-D2 `cancel-in-progress: true` + `retries: 2` 비용 곱셈** — e2e job에서는 cancel 비용 vs 회수 trade-off 검토.
- ☐ **devops M-D3 e2e `needs: quality-gate` ADR 종결** — 진산 결정 위임 carry-over의 ADR 영속화 의무 (현 §6 C1 항목과 통합).
- ☐ **quality M2 401 redirect spec 누락** — production critical (token 만료 30분 주기). `api-errors.spec.ts` 401 시나리오 1건 추가.
- ☐ **quality M4 sessionId-aware mock progression** — restoration 후 동일 문제 silent re-show 검출 (§6 기존 carry-over 우선순위 상향).
- ☐ **backend M2 4xx body type 풍부화** — `GradeErrorBody` discriminated union으로 `VALIDATION_ERROR{issues}` / `QUESTION_HAS_NO_ANSWER{questionId}` / `CONCURRENT_UPDATE` (409 신규) 등 실 서버 풍부 shape 반영.
- ☐ **backend M3 cookie Secure flag profile sync** — production HTTPS 환경에서 `Secure` 필수. `seedAuthCookie`에 `secure: baseURL.startsWith('https')` 추가.
- ☐ **m-D7 gitleaks mock token false-positive 방지** — `.gitleaks.toml` allowlist에 `mock-(access|refresh)-token-e2e` 사전 등록.

### 8. B-1 옵션 (iii) 별도 mock server 흡수 — close (2026-05-14, Session 077)

진산 결정 (Session 076 §7) 옵션 (iii) 채택. `apps/web/e2e/mock-server/` (Hono + @hono/node-server + tsx) 별도 process 도입 + WebKit QuestionCard scenario unskip 영속 → **mobile-webkit 18 PASS 전수 통과**.

**채택 결과:**

- ✅ `apps/web/e2e/mock-server/{server,state,start,types}.ts` 신규 — 실 `apps/api` Hono stack 정합 + 단일 벤더 정합. 8 라우트 (auth/login + study 7) + admin (`/__mock/{health,state,override,reset}`).
- ✅ `playwright.config.ts` `webServer` array 전환 — astro:4321 + mock-server:8787 병렬 기동. mock-server readiness는 `/__mock/health`로 폴링.
- ✅ `apps/web/e2e/helpers/mock-api.ts` 마이그레이션 — `page.route()` 전수 제거. `page.on('response')` 미러링으로 counters/callLog 시그니처 호환 유지. `override()` async 시그니처 (admin POST await 의무 → spec 4건 `await api.override(...)` sync).
- ✅ WebKit QuestionCard scenario unskip — Phase 3 launch 차단 잠재 위험 해소. 실 iOS Safari 95%+ 사용자 환경 핵심 progress action 회귀 차단망 영속.
- ✅ 새 devDep: `hono ^4.12.14` (apps/api 동일 버전), `@hono/node-server ^1.13.0`, `tsx ^4.19.0`.

**진짜 root cause 확정 (chromium에서도 발현):**

§7 B-1 가설 후보 3종 중 **후보 1 (Allow-Headers wildcard 무효)이 chromium spec strict에서도 실제 발현**. page.route() 인터셉트 응답에서는 wildcard가 우회 효과로 통과했으나, 실 cross-origin Hono server 응답에서는 fetch spec WD-2024 strict enforcement.

```
# 시도 1 — page.route() (Session 074~076)
Access-Control-Allow-Headers: *          ← chromium loose passed
Access-Control-Expose-Headers: *
Access-Control-Allow-Credentials: true

# 시도 2 — Hono cross-origin server (Session 077 trace)
Access-Control-Allow-Headers: *          ← chromium spec strict rejected → "네트워크 오류"
+ credentialed request → wildcard 무효
```

**해소책 — 명시 enumeration:**

```
Access-Control-Allow-Headers: Content-Type, Authorization, Cookie, X-Requested-With, Accept
Access-Control-Expose-Headers: Retry-After, Content-Type, Content-Length
```

`mock-server/server.ts` Hono cors middleware + `mock-api.ts` CORS_HEADERS 동기 (spec page.route() abort 시나리오 정합).

**§7 carry-over 해소:**

- ☑ **B-1 WebKit QuestionCard 시나리오 영구 skip silent miss** (quality C1) → unskip 영속.
- ☑ **refactor M-1 mock-api.ts 348줄 SRP 분리** → mock-server/{server,state,start,types}.ts + mock-api.ts (helpers + page.on 미러링) 5 파일 분산. 본 chunk 동시 흡수.

**신규 carry-over (다음 chunk):**

- ☐ **mock-server multi-tenant isolation** — 현재 process-scoped state + workers=1 강제. fully-parallel 지원은 X-Test-Session 헤더 기반 `Map<sessionId, State>` 또는 fork-per-spec. Year 2 reusable foundation 외이나 local dev 속도 ↓ 우려 시 도입.
- ☐ **e2e/ ESLint scope 확장** — 현재 `eslint src --ext .ts,.tsx`로 e2e/ 미커버. mock-server/\*.ts + mock-api.ts + spec 5개 정합성 lint 누락. eslint config + glob 확장 의무.
- ☐ **e2e dependency budget** — hono + @hono/node-server + tsx 3 devDep 추가. CI cold install 시간 ~5s 가산. cache invalidation 주의.
- ☐ **mock server cookie cross-port consistency** — localhost host 기반 cookie share + SameSite=Lax cross-port 동작이 production HTTPS 환경 (apps/web Cloudflare Pages → apps/api Workers) cross-origin 동작과 1:1 매핑 의무. preview 환경 검증 carry-over.
- ☐ **mock-server stateful 동적 응답** — 현재 sessionDetailResponse / completeResponse는 단일 객체. 호출마다 다른 응답이 필요해지면 sequence 또는 별도 admin endpoint 필요.

**검증 게이트:**

- ✅ `pnpm --filter @thepick/web typecheck` PASS
- ✅ `pnpm --filter @thepick/web lint` (src) PASS
- ✅ `pnpm --filter @thepick/web exec playwright test` — 18 PASS (chromium 12 + mobile-375 3 + mobile-webkit 3)

### 8.1 5-페르소나 독립 병렬 리뷰 결과 (2026-05-14, Session 077)

진산 표준 패턴 정합 — 단일 code-reviewer 자가 편향 차단망 의무. refactoring-expert + performance-engineer + quality-engineer + backend-architect + devops-architect 5명 독립 병렬 호출. 통합 보고서: `.claude/reviews/review-20260514-step-3-ux-b1-mock-server-5persona.md`

**판정 매트릭스:**

| Persona              | Critical | Major | Minor | 판정                                  |
| :------------------- | :------- | :---- | :---- | :------------------------------------ |
| refactoring-expert   | 0        | 1     | 5     | 완료 가능                             |
| performance-engineer | 0        | 1     | 4     | 완료 가능                             |
| quality-engineer     | 0        | 4     | 3     | 완료 가능 (Major 4건 carry-over)      |
| backend-architect    | **3**    | 3     | 2     | **수정 필요** (production CORS drift) |
| devops-architect     | 0        | 2     | 3     | 완료 가능                             |

**backend-architect Critical 3건의 본질**: 본 chunk 자체 결함이 아닌 **이전부터 존재한 contract drift를 본 chunk가 더 키움**. mock-server allowHeaders `['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept']` (5개) vs production apps/api/src/index.ts:83 `['Content-Type', 'Authorization']` (2개). mock이 production보다 "넉넉히" 풀어줘서 E2E 녹색 → production 첫 배포 시 cross-origin block 가능. **production 변경 동반 필요 → 진산 결정 위임 별도 chunk**.

**즉시 자율 흡수 2건 (Session 077):**

- ✅ **backend C3 / quality Q1** — Cookie Path 리터럴 → shared 상수 import. `mock-server/server.ts:117-131` `Path=/api` → `Path=${ACCESS_TOKEN_COOKIE_PATH}`, `Path=/api/auth` → `Path=${REFRESH_TOKEN_COOKIE_PATH}`. `helpers/mock-api.ts` seedAuthCookie도 동일. shared 상수 개정 시 mock 자동 sync.
- ✅ **refactor m-5** — `emptyCounters()` 함수 중복 제거. `mock-server/state.ts`에서 export → `helpers/mock-api.ts`에서 import. DRY 단일 source.

자율 흡수 후 재검증: typecheck PASS / playwright test 18 PASS (22.3s) 회귀 0.

**진산 결정 위임 (전략 갈림길) — 다음 chunk 우선순위 매트릭스:**

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

**Year 2 carry-over:**

- `requireExamId` 화이트리스트 검증 logic을 `packages/shared/exam-adapter.ts`로 추출 (backend Mi1) — Hard Rule 16 WHERE 절 주입 시점 동시 발동
- fixture per-exam 분리 (`fixtures/{examId}/`) — ADR-009 멀티시험 정합 (backend Mi2)
- multi-tenant `X-Test-Session` mock-server isolation — fully-parallel 4-worker로 24.8s → 6-10s 단축 (refactor/perf carry-over)
- mock-server vs apps/api endpoint 추가 시 자동 sync (M-1 contract drift) — single contract source가 본 chunk 외 별도 PR

---

## 관련 문서

- LOCK 본문: `docs/design/responses/step-3-ux-6-LOCK.md` §1 (본 ADR가 §"4. 보정"에 carry-over 영속 보정)
- AESTHETIC: `docs/design/AESTHETIC.md` §3.2 (streak / 일일 목표 표현 권고)
- ADR-039 (mode contract 5 mode)
- 4-Pass 리뷰: `.claude/reviews/review-{YYYYMMDD-HHMMSS}-step-3-ux-6c-4pass-integrated.md` (본 ADR 동시 영속)
- 서버 endpoint: `apps/api/src/study/routes.ts:1324-1670`

---

## 결정 책임

본 ADR은 다음만 lock:

- ✅ Step 3-UX-6c 본 step에서 LOCK §1 데이터 surface 항목 carry-over 명시
- ✅ Step 3-UX-6c-2 (server contract 확장) 후속 chunk 정의
- ✅ Step 3-UX-6c-3 (세션 복원) 후속 결정 carry-over

다음은 lock 안 함:

- ❌ Step 3-UX-6c-2 마이그레이션 0036 schema (서버 chunk 진입 시 결정)
- ❌ Step 3-UX-6c-3 세션 복원 vs volatile 정책 (별도 ADR 또는 plan에서 결정)
