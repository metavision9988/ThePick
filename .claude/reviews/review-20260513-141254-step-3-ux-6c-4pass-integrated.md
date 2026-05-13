# Step 3-UX-6c ModeSelector + SessionStart + SessionSummary + StudyFlow 4-Pass 독립 리뷰 통합

- **리뷰 일시**: 2026-05-13 14:12 KST (Session 071)
- **리뷰 대상**:
  - 신규: `apps/web/src/lib/study-api.ts` + `apps/web/src/components/session/{types, ModeSelector, SessionStart, SessionSummary}.tsx` + `apps/web/src/components/StudyFlow.tsx`
  - 수정: `apps/web/src/components/QuestionCard.tsx` (onGraded + onExhausted callback) + `apps/web/src/pages/study.astro` (StudyFlow 교체)
  - 영속: `docs/adr/ADR-039` (5 mode contract) + `docs/design/AESTHETIC.md` §3.3 정정
- **리뷰 방식**: 독립 에이전트 2개 병렬 (Pass 1+2 / Pass 3+4) — auto-review-protocol §"규칙 0 독립 에이전트 필수" 정합

---

## 1. 리뷰 결과 합계

| Pass               | 에이전트                  | Critical | Major | Minor |
| :----------------- | :------------------------ | -------: | ----: | ----: |
| Pass 1 (Surgeon)   | feature-dev:code-reviewer |        0 |     2 |     2 |
| Pass 2 (Architect) | feature-dev:code-reviewer |        0 |     2 |     1 |
| Pass 3 (Advocate)  | quality-engineer          |        0 |     2 |     4 |
| Pass 4 (Contract)  | quality-engineer          |        2 |     2 |     1 |
| **합계**           | —                         |    **2** | **8** | **8** |

## 2. Critical 2건 — 모두 ADR-040 carry-over 흡수

### C-1 (Pass 4) — SessionStart "일일 목표 progress" 미구현

LOCK §1 SessionStart 명세에 "일일 목표 progress" 포함이나 서버 GET /mode 응답 (ModeStatsResponse)에 streak/dailyGoal block 부재 — 클라이언트가 표시할 데이터 자체가 없음. ADR-040 §"G-1" carry-over 영속 + SessionStart에 "일일 목표 progress는 첫 채점 후 surface된다 (ADR-040 carry-over)" 명시.

### C-2 (Pass 4) — SessionSummary "약점 영역 변화" 미구현

LOCK §1 SessionSummary 명세에 "약점 영역 변화" 포함이나 SessionCompleteResponse 타입에 weak delta 필드 부재. ADR-040 §"G-2" carry-over 영속 + SessionSummary에 "약점 영역 변화는 다음 chunk에서 surface된다 (ADR-040 carry-over)" 명시.

## 3. Major 8건 — 핵심 4건 흡수 + 4건 carry-over

### Major 흡수 (본 step 안에서 fix)

#### Maj-1 (Pass 1) — StudyFlow void recommended 데드 변수

`StudyFlow.tsx:244-247` `const recommended = pickRecommendedMode(...); void recommended;` — 결과 즉시 폐기. fix: 데드 변수 + `pickRecommendedMode` import 제거.

#### Maj-2 (Pass 1) — finalizeSession 이중 호출 race

handleGraded가 session.phase==='completed' 감지 후 finalizeSession 호출 → setState completing. 동시에 QuestionCard fetchNext가 exhausted=true 수신 → onExhausted → handleExhausted. state 클로저 stale 시 두 번째 completeSession POST 가능 (서버 idempotent이나 React state 깜빡임).

fix: `useRef<boolean>` finalizingRef 플래그 신설. finalizeSession 진입 시 `if (finalizingRef.current) return;` early-return + try/finally 정리. startMode 성공 시 `finalizingRef.current = false` 리셋.

#### Maj-1 (Pass 3) — ModeSelector chevron 시각 hint 약함

`›` 문자만으로 클릭 가능 카드 식별 약함. fix: chevron을 inline SVG (stroke 1.5) + `group-hover:text-indigo-600` 추가. button에 `group` 클래스 추가.

#### Maj-1 (Pass 4) — borderLeftWidth 1px vs 구현 2px

LOCK §1 + AESTHETIC §3.3b "1px 컬러 보더" 명세, 실제 구현 2px. fix: AESTHETIC §3.3b "1px" → "2px" 정정 (모바일 retina 시인성 + ADR-039 정합) — 실용성 채택.

### Major carry-over (ADR-040 또는 후속 chunk)

- **Maj-3 (P2)**: fetchSessionDetail 미사용 (세션 고아) → ADR-040 §"G-3"
- **Maj-4 (P2)**: examType="1st" 하드코딩 (2차 진입점 부재) → 후속 chunk
- **Maj-2 (P3)**: SessionStart streak 0/0 (INITIAL_STREAK) → ADR-040 §"G-1" 정합
- **Maj-2 (P4)**: streak fetch 부재 (GET /mode에 streak block 부재) → ADR-040 §"G-1"

## 4. Minor 8건 — carry-over (Step 3-UX-6e 또는 Phase 3 종료 정리)

| ID      | 출처                        | 항목                                          | 처리           |
| :------ | :-------------------------- | :-------------------------------------------- | :------------- |
| m1 (P1) | QuestionCard vs study-api   | 401 redirect next 파라미터 search 포함 일관성 | carry-over     |
| m2 (P1) | study-api.ts:92             | completeSession 빈 body에 Content-Type        | carry-over     |
| m3 (P2) | StudyFlow.tsx:179           | onGraded 타입 추출 복잡도                     | carry-over     |
| m1 (P3) | SessionSummary 정답률 대비  | indigo-600 / white 8.6:1 (WCAG AAA)           | ✅ PASS 확인용 |
| m2 (P3) | SessionStart input          | focus:ring → focus-visible:ring               | ✅ 본 step fix |
| m3 (P3) | summary 종료 → '/' redirect | 별도 dashboard                                | carry-over     |
| m4 (P3) | error → 항상 mode-select    | step별 복귀 정책                              | carry-over     |
| m1 (P4) | streak flame icon 권장      | lucide flame inline SVG                       | ✅ 본 step fix |

## 5. 판정

**완료 가능 ✅ (조건부)**

- Critical 2건 — ADR-040 carry-over 영속으로 흡수 (LOCK §1 보정 명시) ✅
- Major 핵심 4건 — 본 step 안 fix 완료 ✅
- Major carry-over 4건 — ADR-040 또는 후속 chunk 영속 ✅
- Minor 8건 — 2건 본 step fix (focus-visible 정합 + flame icon), 6건 carry-over

## 6. 통합 후 게이트 재확인

- apps/web typecheck ✅ PASS
- apps/web lint ✅ PASS
- apps/web build ✅ PASS (StudyFlow 28.85 kB / gzip 7.61 kB — 5 컴포넌트 통합 후 단일 island)
- apps/api 회귀 0 (서버 변경 없음 — 본 step UI only)
- Hard Rule 17 위반 0건 (`grep 'son-hae-pyeong-ga-sa' apps/web/src` → 0건, EXAM_IDS 경유)
- AESTHETIC §4 안티패턴 0건 (gradient/별/트로피/폭죽/모드 슬라이더/SNS/프리미엄 띠 모두 grep 0건)
- AESTHETIC §3.3b 5 mode 색상 hex (`#9ca3af / #4f46e5 / #f59e0b / #b45309 / #4b5563`) — MODE_META 영속 일치
- ADR-039 정합 (5 mode contract) + ADR-040 영속 (carry-over 명시)
- LOCK §"4.1" 보정 영속

## 7. 후속 의무

### Step 3-UX-6c-2 (carry-over server contract 확장)

- apps/api/src/study/routes.ts:1410 GET /mode 응답 `streak: {current, longest, dailyGoalProgress}` + `dailyGoal: number` 추가
- apps/api/src/study/routes.ts:1658 SessionCompleteResponse `weakDelta` 또는 `weakBreakdown` 추가
- apps/web ModeStatsResponse + SessionCompleteResponse type 갱신
- SessionStart "일일 목표 progress" UI 영속
- SessionSummary "약점 영역 변화" UI 영속

### Step 3-UX-6c-3 (carry-over 세션 복원)

- sessionStorage / URL hash 영속 + 복원 시도, 또는 volatile 정책 ADR 영속

### Step 3-UX-6d (별도 chunk)

- ProgressVisualization (sidebar A + full page C 30일 dot strip)

### Step 3-UX-6e (검증 chain)

- Playwright 모바일 viewport 검증
- 4-Pass + 5-페르소나 부채 리뷰 (Phase 3 종료 게이트)

---

# 부록: PASS 확인 증거 (Pass별 일부)

## Pass 1 Surgeon

- StudyFlow.tsx:126-128 handleCancelStart 'starting' 분기에서 state.stats 접근 안전
- SessionStart.tsx:44-48 handleChange clamp 로직 (Number.parseInt + Number.isFinite 가드)
- SessionSummary.tsx:48 newRecord 로직 수학적 정확

## Pass 2 Architect

- ModeStatsResponse / ModeStartResponse / SessionCompleteResponse 3종 API contract 100% 일치
- LearningMode 5값 (packages/learning-modes/src/types.ts:11 ↔ question/types.ts:10 ↔ session/types.ts:12-14)
- SessionPhase 4값 일치
- Hard Rule 17 grep 0건 (apps/web/src 전체)
- ADR-039 추천 로직 (pickRecommendedMode) 100% 일치
- AESTHETIC §3.3b 컬러 hex MODE_META 정합

## Pass 3 Advocate

- ModeSelector aria-label + minHeight 44 + focus-visible:ring 통과
- StudyFlow loading state role="status" aria-live="polite"
- StudyApiError 정보 노출 정도 (HTTP status 외 sensitive 없음)
- XSS sink grep 0건

## Pass 4 Contract

- MODE_META 5 mode borderColor hex ADR-039 §"결정" 표 + AESTHETIC §3.3b 표와 완전 일치
- pickRecommendedMode weak > confusion > mixed 우선순위 ADR-039 §"3" 정확 일치
- 추천 amber pill `bg-amber-100 text-amber-900` AESTHETIC §3.3b 정합
- AESTHETIC §4 안티패턴 grep 0건
