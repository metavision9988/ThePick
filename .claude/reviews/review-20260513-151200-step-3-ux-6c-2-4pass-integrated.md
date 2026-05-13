# Step 3-UX-6c-2 4-Pass 독립 에이전트 리뷰 통합 보고

- **일자:** 2026-05-13 (Session 072)
- **범위:** ADR-040 G-1 + G-2 흡수 (GET /mode streak/dailyGoal + SessionComplete weakDelta + UI wiring)
- **변경 파일 6개 (392+/39-) → 흡수 후 7개 (508+/45-, migration 0036 추가)**
- **리뷰 방식:** 독립 에이전트 3개 병렬 호출 (auto-review-protocol §"규칙 0" 정합)
  - feature-dev:code-reviewer (Pass 1 Surgeon + Pass 2 Architect)
  - quality-engineer (Pass 3 Advocate + Pass 4 Contract)
  - pr-review-toolkit:silent-failure-hunter (silent failure 전용 audit)

---

## 결과 요약

| Pass / Agent                                  | Critical | Major | Minor |
| :-------------------------------------------- | :------- | :---- | :---- |
| Pass 1 (Surgeon, feature-dev:code-reviewer)   | 0        | 0     | 0     |
| Pass 2 (Architect, feature-dev:code-reviewer) | 0        | 2     | 1     |
| Pass 3 (Advocate, quality-engineer)           | 0        | 2     | 2     |
| Pass 4 (Contract, quality-engineer)           | 0        | 2     | 1     |
| Silent Failure Hunter                         | 2        | 5     | 3     |
| **통합 (중복 제거)**                          | **2**    | **7** | **5** |

---

## CRITICAL 흡수 (2건, 본 step 즉시 fix)

### C-1 — weakDelta catch 빈 fallback이 정상 0건과 응답 동일 (silent failure)

- **위치:** `apps/api/src/study/routes.ts` computeWeakDelta catch 블록
- **문제:** `{cardsReviewed: 0, stillWeakCount: 0, bySubject: []}` 가 silent failure와 정상 review 0건 시나리오에서 응답 비트 단위 동일. 운영 환경에서 D1 장애를 사용자/관리자 모두 인지 불가.
- **흡수:**
  - 응답 shape 확장 — `available: boolean` flag 추가
  - catch 시 `available: false` 반환 + `event: 'weak_delta_silent_failure'` telemetry emit (streak silent failure 패턴 정합)
  - SessionSummary.tsx — `weakDeltaUnavailable` 분기로 "약점 영역 집계를 불러오지 못했습니다" 안내 surface

### C-2 — SessionStart progress bar NaN/Infinity 미가드

- **위치:** `apps/web/src/components/session/SessionStart.tsx:50-52`
- **문제:** `Math.min(1, NaN) === NaN`. `Math.round(NaN * dailyGoal) === NaN` → DOM "NaN / 20" 표시 + `width: NaN%` invalid CSS.
- **흡수:** `Number.isFinite()` guard + safeProgress / safeDailyGoal 분리. clamp되지 않은 원본 사용 차단.

---

## MAJOR 흡수 (5건 즉시 + 2건 carry-over)

### 즉시 흡수

**M-3 (silent + quality) — dailyGoalProgress count vs distinct**

- **위치:** `routes.ts:1426` GET /mode + `:1255` /grade 두 endpoint
- **문제:** `SELECT COUNT(*) FROM study_reviews` — 같은 카드 5회 review = 100% 달성 표시 가능 (review 횟수 ≠ 학습 진척).
- **흡수:** `COUNT(DISTINCT card_id)` 변경. /mode + /grade 일관성. 테스트 신규 1건 ("같은 카드 5회 = 10% 진척").

**M-4 (code-reviewer P2-M2) — computeWeakDelta examId 시그니처 누락 (Hard Rule 16 위반)**

- **위치:** `routes.ts:1614` 함수 시그니처
- **문제:** Hard Rule 16 "데이터 조회 래퍼 함수는 첫 번째 인자로 examId: ExamId" 위반. Year 2 zero-cost 전환 불가.
- **흡수:** `computeWeakDelta(db, userId, sessionId, examId, logger)` 시그니처 변경. 호출 측 `EXAM_IDS.SON_HAE_PYEONG_GA_SA` 주입. Year 1 단일 시험 정합 `void examId` + 주석으로 Year 2 활성화 명시.

**M-5 (code-reviewer P2-M1) — study_reviews(session_id, user_id) 인덱스 부재**

- **위치:** `migrations/0034_study_reviews.sql`
- **문제:** computeWeakDelta `WHERE session_id = ? AND user_id = ?` 가 user_id lookup 후 session_id post-filter 비용 발생. 활성 사용자 누적 시 응답 지연.
- **흡수:** `migrations/0036_study_reviews_session_index.sql` 신규 (`CREATE INDEX idx_study_reviews_session_user ON study_reviews(session_id, user_id)`). d1-from-sqlite.ts SCENARIO_MIGRATIONS 갱신.

**M-7 (silent M-4) — computeWeakDelta DISTINCT semantics 강화**

- **위치:** `routes.ts:1634` SELECT DISTINCT 쿼리
- **문제:** `SELECT DISTINCT (card_id, subject, weak_score)` 3-tuple 기준 dedupe. user_progress 중복 row 발생 시 (예: migration race) 동일 카드 2회 카운트 가능.
- **흡수:** `GROUP BY sr.card_id` + `MIN(eq.subject)` / `MAX(weak_score)` 로 변경. 단일 row per card 보장 → cardsReviewed = distinct card 수.

**M-6 — ADR-040 본문 영속 + LOCK §4.1 완료 영속 (quality M-3 + M-4)**

- **흡수:**
  - ADR-040 §"상태" "Partially Resolved (G-1 + G-2 흡수)"
  - §2 carry-over 체크박스 ☑
  - §2.1 신규 — G-2 채택 사유 + dailyGoalProgress DISTINCT + examType 무필터 + streak 표시 시점 영속
  - §2.2 신규 — 4-Pass carry-over 항목 6건 명시
  - §4 게이트 G-1/G-2 [x]
  - LOCK §4.1 ✅ + 라벨 "약점 영역 변화 → 약점 잔존" 정정 영속

### Carry-over (Step 3-UX-6e 검증 chain 또는 별도 ADR)

**M-1 (silent) — /mode 503 영향 면적 확대**

- 7 쿼리 Promise.all fail-fast → streak/today review 부분 실패 시 전체 ModeSelector 503. /grade의 inner try-catch 패턴 미적용 (일관성 위반).
- carry-over: Promise.allSettled 도입 후 streak 부분 실패 graceful degradation 패턴 변경.

**M-2 (silent) — streak 표시 의도성**

- GET /mode는 어제 잠긴 streak / /grade 후 +1 갱신. UX 의도 ADR 부재.
- 흡수 영속 (ADR-040 §2.1) — 표시는 어제 값 유지, 첫 grade에서 자동 surface. 추가 변경 불필요.

**M-5 (silent) — subject NULL 노출 정책**

- exam_questions.subject NULL 카드가 "미분류" 라벨로 surface. 데이터 품질 게이트 또는 UI 분리.
- carry-over: 본 step 안 흡수 (UI 변경 미세).

---

## MINOR carry-over (5건)

| 항목                                                | Agent   | 처리                          |
| :-------------------------------------------------- | :------ | :---------------------------- |
| Mi-1 SessionStart 입력 silent ignore                | silent  | carry-over (UX 미세)          |
| Mi-2 격리 테스트 production 발생 불가 시나리오 주석 | silent  | carry-over (테스트 주석 추가) |
| Mi-3 ModeStatsResponse runtime validation           | silent  | carry-over (Zod 도입 필요)    |
| m-1 emerald-500 토큰 §2.2 미등록                    | quality | carry-over (AESTHETIC 갱신)   |
| m-2 text-[11px] 비표준 토큰                         | quality | carry-over (토큰 정합)        |

---

## 확인 증거 (auto-review-protocol §"규칙 2 증거 기반 보고")

각 Agent별 실제 확인 증거 3개+ 제공됨:

- **feature-dev:code-reviewer** — `routes.ts:1264-1265`, `routes.ts:1668-1674`, `routes.ts:1418-1434`, `SessionStart.tsx:50-51`, `routes.test.ts:753-760`, `routes.test.ts:977-1005` (6건)
- **quality-engineer** — `SessionStart.tsx:106-149`, `SessionStart.tsx:136-148`, `routes.ts:1418-1424 + 1426-1434 + 1644-1645`, `routes.test.ts:1007-1020`, ADR-040 §"결정 §1", LOCK §"1", AESTHETIC §"3.2/§3.3" (7건)
- **silent-failure-hunter** — `routes.ts:1668-1675`, `SessionStart.tsx:50-52`, `routes.ts:1471-1475`, `routes.ts:1218-1271 + 1437-1469`, `routes.ts:1426-1434`, `routes.ts:1632-1648`, `routes.ts:1722-1740`, `StudyFlow.tsx:107-108 + 183-184` (8건)

---

## 반론 (Devil's Advocate, 각 Agent별)

- **code-reviewer**: 동일 탭 두 grade 이벤트 동시 fire 시 finalizingRef race — 검증 OK
- **quality-engineer**: user_progress.node_id NULL 가정 깨질 경우 weakDelta join 0건 회귀 가능 (silent failure 후보) — 흡수 후 telemetry로 가시화 OK
- **silent-failure-hunter**: D1 connection / migration mismatch / ORM type coercion 등 catch가 삼킬 수 있는 hidden errors 7종 명시 — telemetry emit으로 운영 측 가시화 OK

---

## 판정

**완료 가능** (Critical 0건, Major 본 step 흡수 5건 + carry-over 영속 2건, Minor carry-over 5건).

apps/api 게이트:

- typecheck PASS
- lint PASS
- tests **545 PASS / 2 skipped** (Session 071 539 → +6 신규 — streak 2 + weakDelta 3 + dailyGoalProgress distinct 1)
- 회귀 0건 (learning-modes 116 / srs 35 / shared 64 모두 PASS)

apps/web 게이트:

- typecheck PASS
- lint PASS
- build PASS (StudyFlow ~35 kB / gzip ~9 kB 추정 — 검증 의무)

production deploy 게이트 통과. 본 step 다음 단계: wrangler deploy + smoke (GET /mode 신규 필드 + SessionComplete weakDelta 확인) + production migration 0036 적용.

---

## 후속 carry-over 매트릭스 (Step 3-UX-6e 검증 chain)

| 항목                                 | 출처            | 처리 시점                                                 |
| :----------------------------------- | :-------------- | :-------------------------------------------------------- |
| /mode 503 graceful degradation       | silent M-1      | Step 3-UX-6e + ADR                                        |
| subject NULL 노출 정책               | silent M-5      | Step 3-UX-7 distractor BATCH 보강 또는 데이터 품질 게이트 |
| ModeStatsResponse runtime validation | silent Mi-3     | Phase 3 종료 / Zod 도입                                   |
| emerald-500 / text-[11px] 토큰화     | quality m-1+m-2 | AESTHETIC 정합 chain                                      |
| 격리 테스트 주석 보강                | silent Mi-2     | 후속 step                                                 |
| SessionStart 입력 시각 피드백        | silent Mi-1     | UX 미세 chain                                             |
