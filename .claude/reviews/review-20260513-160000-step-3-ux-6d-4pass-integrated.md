# Step 3-UX-6d 4-Pass 독립 에이전트 리뷰 통합 보고

- **일자:** 2026-05-13 (Session 072)
- **범위:** ProgressVisualization sidebar A (3 카드 stack) + full page C (30일 dot strip). LOCK §1 완전 정합.
- **변경 7 파일:** server endpoint + 7 tests / client lib + 2 컴포넌트 + 2 페이지 + study.astro sidebar 교체
- **리뷰 방식:** 독립 에이전트 2개 병렬 호출 (auto-review-protocol §"규칙 0" 정합)
  - feature-dev:code-reviewer (Pass 1+2+3+4 전수)
  - pr-review-toolkit:silent-failure-hunter (silent failure 전용 audit)

---

## 결과 요약

| Pass / Agent                                  | Critical | Major / Important | Minor |
| :-------------------------------------------- | :------- | :---------------- | :---- |
| Pass 1 (Surgeon, feature-dev:code-reviewer)   | 0        | 2 Minor           | —     |
| Pass 2 (Architect, feature-dev:code-reviewer) | 0        | 1 Important       | —     |
| Pass 3 (Advocate, feature-dev:code-reviewer)  | 0        | 2 (1 Important)   | —     |
| Pass 4 (Contract, feature-dev:code-reviewer)  | 0        | 1 Important       | —     |
| Silent Failure Hunter                         | 0        | 4 Major           | 7     |
| **통합 (중복 제거)**                          | **0**    | **6 즉시 흡수**   | **4** |

---

## 본 step 즉시 흡수 (6건)

### I-1 — AESTHETIC §2.4 sidebar 너비 Silent Pivot 차단 (code-reviewer Pass 4)

- **위치:** `docs/design/AESTHETIC.md:61` 토큰 `lg:w-[180px]` vs `apps/web/src/pages/study.astro:10` 실제 `lg:w-[260px]`
- **문제:** AESTHETIC 토큰 선언과 실제 구현 불일치 — CRITICAL RULE #1 Silent Pivot 우려.
- **흡수:** AESTHETIC.md §2.4 토큰 `lg:w-[260px]`로 갱신 + 사유 영속 (ProgressViz A 3 카드 stack 88px ring + 5 HBar 시인성 정합). "누적만, 삭제 금지" 규칙 정합.

### I-2 — SUBJECT_LIMIT_FULL=8 vs 서버 5 dead code (code-reviewer Pass 2)

- **위치:** `apps/api/src/study/routes.ts:1496` 서버 5 vs `apps/web/src/components/progress/ProgressVizFull.tsx:24` 클라이언트 8
- **문제:** 서버가 항상 max 5 반환 → 클라이언트 slice(0, 8) 무효 연산.
- **흡수:** 서버 SUBJECT_MASTERY_LIMIT = 8로 통일. sidebar는 5건 slice / full page는 8건 slice 정합.

### I-3 — network 오프라인 메시지 부재 (code-reviewer Pass 3)

- **위치:** `apps/web/src/components/progress/ProgressViz.tsx:148-164` + `ProgressVizFull.tsx:39-46`
- **문제:** `StudyApiError.kind === 'network'`이 일반 "진도 로딩 실패"와 동일. 수험생 지하철 시나리오 UX 회귀.
- **흡수:** formatApiError에 'network' + 'validation' kind 분기 추가. "오프라인 — 연결 후 다시 시도해 주세요." surface.

### M-2 — examType raw echo (silent-failure-hunter)

- **위치:** `apps/api/src/study/routes.ts:1515` 변경 전 `` `Invalid examType: ${examTypeRaw}` ``
- **문제:** 사용자 입력 echo back 안티패턴 (XSS 직접 X, reflected 정보 노출).
- **흡수:** `'examType must be 1st or 2nd'` enum 후보 명시.

### M-3 — validation kind 분기 부재 (silent-failure-hunter)

- **위치:** 동일 (clientside formatApiError)
- **흡수:** I-3과 동시 처리 — 'validation' kind에 "요청 형식 오류" surface.

### Pass 1 Minor 1 — masteryPct clamp 미적용 (code-reviewer)

- **위치:** `apps/web/src/components/progress/ProgressVizFull.tsx:190`
- **문제:** 서버 race / 데이터 적재 오류 시 masteryPct > 1 → width:101% 가능 (overflow-hidden은 시각 차단이나 aria-label 오용).
- **흡수:** `Math.min(100, Math.round(Math.max(0, s.masteryPct) * 100))` clamp 보강.

---

## Carry-over (Step 3-UX-6e 또는 별도 step)

### Major carry-over

- **M-1 (silent) — Promise.all 단일 503 collapse**: `/progress` 3 쿼리 fail-fast. streak_records null fallback OK이나 study_reviews / exam_questions transient 실패 시 전체 503. Promise.allSettled 패턴 변경은 영향 면적 큼 → carry-over (Step 3-UX-6e 또는 ADR 영속).
- **M-4 (silent) — safeFetch message 활용**: 서버 422/503 응답 body의 `{error, message}` 무시. `HTTP ${status}`로 collapse. carry-over (study-api.ts 확장 필요).

### Minor carry-over

| 항목                                                         | Agent                  | 처리                                      |
| :----------------------------------------------------------- | :--------------------- | :---------------------------------------- |
| m-1 boundary tests (days=abc/1.5/-1/examType=invalid/days=1) | silent                 | Step 3-UX-6e (Playwright + 통합)          |
| m-2 KST 자정 race 통합 테스트                                | silent + code-reviewer | Step 3-UX-6e                              |
| m-3 subject NULL 미분류 안내                                 | silent                 | 데이터 품질 게이트 step                   |
| m-5 KST_OFFSET_HOURS 하드코딩 (`+9 hours`)                   | silent                 | Year 2 멀티 timezone step                 |
| m-6 startDate cursor 산출 코드 중복                          | silent                 | refactor step                             |
| Pass 3 AESTHETIC flame 아이콘 미적용                         | code-reviewer          | LOCK §1 dot 패턴 정합 — 의도 검토 후 영속 |

---

## 확인 증거 (auto-review-protocol §"규칙 2 증거 기반 보고")

### feature-dev:code-reviewer (Pass 1+2+3+4)

- Pass 1: `routes.ts:1558-1568 strftime KST 변환`, `:1542-1544 startDate UTC`, `ProgressViz.tsx:40-41 safeMax clamp`, `:71-74 toWeekdayLabel UTC`, `:218 todayCount fallback`, `:1575 LEFT JOIN SUM CASE`, `:1614 masteryPct 0 가드`, `ProgressVizFull.tsx:51-73 useEffect cleanup`, `:1625-1629 catch logger.error + 503`
- Pass 2: `study-api.ts:8,22 EXAM_IDS Hard Rule 17`, `routes.ts:1502 requireExamId Hard Rule 16`, `schema.ts:385 mastered_at`, `:402-416 study_reviews`, `:437-443 streak_records`, `ProgressViz/Full lib/study-api 단일 경유 Hexagonal`, `Promise.all 3 D1 indexed query`, `session-progress.ts:74-86 dayBoundsUtc 정합`
- Pass 3: `Ring aria-hidden`, `MiniWeek title`, `ProgressVizFull 30일 grid role=img aria-label`, `progressbar aria-*`, `safeFetch 401-503 분류`, `role=alert / role=status aria-live`
- Pass 4: LOCK §1 sidebar A + full page C 영속, AESTHETIC §3.2 정합, ADR-040 G-3 완료 표기, Hard Rule 17 0건, 명명 상수 (SIDEBAR_DAYS/SUBJECT_LIMIT/FULL_DAYS/DEFAULT_DAILY_GOAL)

### pr-review-toolkit:silent-failure-hunter

- 14건 안전 패턴 — `division by zero 가드 3경로`, `WHERE user_id 사용자 격리`, `router.use('*') 인증 강제`, `prepared statement SQL injection 차단`, `examType Zod safeParse`, `isToday 단일 기준`, `KST UTC 변환 정합`, `빈 catch 0건`, `COUNT(DISTINCT card_id)`, `useEffect cancelled cleanup`, `ARIA 다층 적용`, `subject NULL 차단`, `requireExamId Hard Rule 16`, `타입 안전 readonly + generic`

---

## 반론 (Devil's Advocate)

### code-reviewer

- transient D1 throttle 시 sidebar 차단 시나리오 (M-1 권고와 일치, carry-over)
- 30일 dot strip 신규 사용자 빈 grid surface — placeholder 안내 부재 (UX 미세)
- D1 LEFT JOIN exam_questions 10K row 시 cost 재측정 carry-over

### silent-failure-hunter

- streak_records 부재 + dailyGoal change race (eventual consistency 의도 OK)
- 자정 경계 KST/UTC race — isToday 단일 기준으로 안전 (m-2 통합 테스트 carry-over)
- 신규 endpoint라 회귀 0이나 Promise.all fail-fast 패턴은 streak/today review 부분 실패 영향 면적 확대 (M-1 carry-over)

---

## 판정

**완료 가능** (Critical 0건, Important/Major 본 step 흡수 6건 + carry-over 2건, Minor carry-over 6건).

### Gates

apps/api:

- typecheck PASS / lint PASS
- tests **553 PASS / 2 skipped** (Session 071 539 → +14 누적, 신규 progress 8건 모두 통과)
- 회귀 0 (learning-modes 116 / srs 35 / shared 64)

apps/web:

- typecheck PASS / lint PASS / build PASS
- ProgressViz 5.75 kB / gzip 2.31 kB
- ProgressVizFull 5.26 kB / gzip 2.00 kB
- StudyFlow 32.96 kB / gzip 8.66 kB (sidebar 교체로 변경 0)

Production deploy 의무 (서버 endpoint 신설). study.astro sidebar 교체로 ProgressSummary 컴포넌트는 deprecated 영속 (carry-over: 별도 step 삭제).

---

## 후속 carry-over 매트릭스 (Step 3-UX-6e 이월)

| 항목                                  | 출처                      | 처리 시점                  |
| :------------------------------------ | :------------------------ | :------------------------- |
| /progress Promise.allSettled          | silent M-1                | Step 3-UX-6e + ADR         |
| safeFetch message 활용                | silent M-4                | study-api 확장 step        |
| boundary 통합 테스트                  | silent m-1 + m-2          | Step 3-UX-6e Playwright    |
| KST 자정 경계 통합 테스트             | silent + code-reviewer    | Step 3-UX-6e               |
| subject NULL 미분류 안내              | silent m-3                | 데이터 품질 게이트         |
| KST_OFFSET_HOURS 하드코딩             | silent m-5                | Year 2 멀티 timezone       |
| flame 아이콘 sidebar 적용 (AESTHETIC) | code-reviewer Pass 3      | LOCK §1 dot 패턴 정합 검토 |
| 30일 dot strip placeholder 안내       | code-reviewer Devil's Adv | UX 미세 chain              |
