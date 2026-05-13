# ADR-040: Step 3-UX-6c LOCK §1 vs 서버 contract 격차 carry-over

- **상태:** Partially Resolved (G-1 + G-2 흡수, G-3 carry-over 유지)
- **결정일:** 2026-05-13 (Session 071 carry-over) → 2026-05-13 Step 3-UX-6c-2에서 G-1/G-2 흡수
- **결정자:** Claude Opus 4.7 (4-Pass 독립 리뷰 발견) + 진산 (carry-over 채택 → 우선순위 진행 위임)
- **관련 영역:** SessionStart "일일 목표 progress" (✅ 완료) + SessionSummary "약점 영역 변화" (✅ 완료) + 세션 복원 (☐ G-3 carry-over)

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
- ☐ **Step 3-UX-6c-3 (session 복원)** — sessionStorage / URL hash 영속 + 복원 (carry-over 유지)
- ☑ **streak 일관성** — loadModes 시 stats.streak 으로 초기화 (Session 072)

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

본 step (3-UX-6c-2) 4-Pass 독립 에이전트 리뷰 결과 carry-over (Step 3-UX-6e 검증 chain 또는 별도 ADR):

- ☐ **/mode 503 영향 면적** (silent M-1) — Promise.allSettled 도입으로 streak 부분 실패 시 graceful degradation. 본 step은 7 쿼리 fail-fast 유지.
- ☐ **subject NULL 데이터 노출 정책** (silent M-5) — exam_questions.subject NULL 카드가 사용자에게 "미분류" 라벨 surface. 데이터 품질 게이트 추가 또는 UI 분리 표시.
- ☐ **SessionStart 빈 입력 silent ignore** (silent Mi-1) — `Number.parseInt('abc')` 시 사용자 시각 피드백 부재.
- ☐ **ModeStatsResponse runtime validation** (silent Mi-3) — Zod 또는 manual guard로 서버 응답 shape 검증.
- ☐ **AESTHETIC §2.2 emerald-500 토큰 등록** (quality m-1) — progress 달성 색 토큰화.
- ☐ **text-[11px] 비표준 토큰 사용** (quality m-2) — SessionStart/SessionSummary 미세 텍스트 토큰화 또는 text-xs 통일.

### 3. LOCK §1 보정 (본 ADR 동시 영속)

- LOCK §"4. 보정 / 추가 지시" 섹션에 본 ADR-040 참조 명시
- LOCK §1 SessionStart "일일 목표 progress" 항목 → "(ADR-040 carry-over)" 주석
- LOCK §1 SessionSummary "약점 영역 변화" 항목 → "(ADR-040 carry-over)" 주석

### 4. 게이트 / 검증 (Step 3-UX-6 종료 의무)

- [x] Step 3-UX-6c-2 (server contract 확장) 완료 후 SessionStart 일일 목표 progress UI 영속 확인 (2026-05-13)
- [x] Step 3-UX-6c-2 완료 후 SessionSummary 약점 영역 변화 UI 영속 확인 (2026-05-13)
- [ ] Step 3-UX-6c-3 결정 (복원 구현 or 의도적 volatile 정책 ADR) — 진산 결정 대기
- [ ] Step 3-UX-6e 검증 chain에서 본 carry-over 모두 fix 확인 (4-Pass + 5-페르소나)

### 5. 위험 / 미해소 사항

- **D1 study_sessions 고아 row** — 사용자가 questioning 중 새로고침 시 ended_at = NULL phase != 'completed' 레코드 영속. 운영 dashboard에서 가시화 의무 (memory `project_engine_observability` 정합).
- **클라이언트 fallback streak 표시 "0일 · 최장 0"** — 첫 grade 응답 전에는 사용자에게 부정확한 streak 표시. SessionStart UX 손상. 본 ADR carry-over로 후속 처리.

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
