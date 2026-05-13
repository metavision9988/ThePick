# ADR-039: LearningMode 5개 (서버 contract) 채택 — RFP 4 mode 재해석

- **상태:** Accepted
- **결정일:** 2026-05-13 (Session 071)
- **결정자:** 진산 (5 mode 채택) + Claude Opus 4.7 (mismatch 발견 + 권고)
- **관련 영역:** Step 3-UX-6c ModeSelector 컴포넌트 + AESTHETIC §3.3 정정

---

## 맥락 (Context)

Step 3-UX-6c (ModeSelector + SessionStart + SessionSummary) 진입 시 서버 API contract vs RFP/Claude Design 응답 사이 **mode 정의 mismatch** 발견:

| 출처                                                            | mode 정의                                                   | 갯수 |
| :-------------------------------------------------------------- | :---------------------------------------------------------- | ---: |
| 서버 `packages/learning-modes/src/types.ts:11` `LEARNING_MODES` | `'category' \| 'topic' \| 'confusion' \| 'weak' \| 'mixed'` |    5 |
| 서버 `apps/api/src/study/routes.ts:1410-1419` GET /mode 응답    | 5 mode + available count                                    |    5 |
| RFP `docs/design/rfp-step-3-ux-6.md` §3.2                       | `warmup` / `main` / `cooldown` / `review_weak`              |    4 |
| Claude Design 응답 `components/mode-selector.jsx`               | 동일 4 mode                                                 |    4 |
| AESTHETIC.md §3.3 (4 mode 색상 hint)                            | 동일 4 mode                                                 |    4 |

**근본 원인** (Reality Anchor 회피 실패):

RFP 작성 시 Claude Code가 `warmup/main/cooldown` (이는 **SessionPhase**: 세션 내부 진행 단계) + `review_weak`를 mode로 혼동. 실제로:

- **SessionPhase** (4값): `warmup` → `main` → `cooldown` → `completed` — 세션 안 진행 단계
- **LearningMode** (5값): `category` / `topic` / `confusion` / `weak` / `mixed` — 학습 분류 정책

→ RFP가 phase를 mode로 잘못 정의 → Claude Design은 RFP를 충실히 따라 4 mode UI 산출. AESTHETIC.md §3.3은 동일 오류 영속.

production Worker는 이미 Session 070 deploy 완료 (`390a7eb7`) — 서버 contract 변경 불가.

---

## 결정 (Decision)

**서버 contract (LearningMode 5개) 채택**:

| LearningMode | 한국어 라벨 | 설명                                                    | 좌측 1px 보더 색상 hint           |
| :----------- | :---------- | :------------------------------------------------------ | :-------------------------------- |
| `category`   | 과목별      | 과목 단위 학습 (재해보험 일반 / 농업재해 / 가축재해 등) | `gray-400` (`#9ca3af`) 중립       |
| `topic`      | 주제별      | concept 단위 학습 (특정 개념 집중)                      | `indigo-600` (`#4f46e5`) 본격     |
| `confusion`  | 헷갈림      | `confusion_type` 카드만 (cross_crop 등)                 | `amber-500` (`#f59e0b`) 주의      |
| `weak`       | 약점 복습   | `weak_score > 0` 카드만 (FSRS 기반)                     | `amber-700` (`#b45309`) 주의 강화 |
| `mixed`      | 통합 학습   | 모든 카드 혼합 (default 추천)                           | `gray-600` (`#4b5563`) 종합       |

**RFP/AESTHETIC §3.3은 본 ADR에 의해 무효화** — 5 mode 표로 교체.

---

## 채택 근거

1. **서버 production deploy 완료** — Worker `390a7eb7`이 5 mode contract로 영속. RFP/Claude Design을 따르려면 production 재배포 + migration 변경 → 회귀 위험.
2. **mode vs phase는 의미적으로 다름** — RFP의 `warmup/main/cooldown`은 SessionPhase로 이미 별도 영속. ModeSelector를 phase 카드 4개로 만들면 사용자에게 "phase = mode = 모드"라는 혼동을 강화.
3. **5 mode가 학습 다양성 표현** — `category`(과목 집중) / `topic`(개념 집중) / `confusion`(약점 영역 1) / `weak`(약점 영역 2) / `mixed`(추천) — 학습자 선택지 풍부.
4. **AESTHETIC.md 누적 갱신 정합** — AESTHETIC §"갱신 규칙"은 "누적만, 삭제 금지". 기존 §3.3 4 mode 표는 §3.3a로 deprecate 명시 + §3.3b 5 mode 신규. 글로벌 ~/.claude/AESTHETIC.md 정합.

---

## 영향 (Consequences)

### 1. AESTHETIC.md 정정 의무 (본 ADR 동시 영속)

- §3.3 (4 mode 색상 hint 표) → §3.3a "deprecated, ADR-039 정합" + §3.3b "5 mode contract (현재)" 추가
- §3.4 phase 표는 유지 (정확)

### 2. ModeSelector 컴포넌트 구현 (Step 3-UX-6c)

- 5 카드 세로 stack (모바일 80% 정합)
- 각 카드: 좌측 1px 컬러 보더 + 라벨 + hint + 예상시간 + 카드수 + (recommended일 경우) amber pill "추천"
- LOCK §1 "A 단독 (세로 stack + 좌측 1px 컬러 보더 + 추천 amber pill)" 정합

### 3. Recommended 정책

서버 GET /mode는 단순 `{mode, available}` 5건만 반환. 추천 mode 자동 결정 로직 부재. 클라이언트 측에서 다음 우선순위로 추천 결정:

1. `weak.available > 0` → `weak` 추천 (FSRS 약점 복습이 가장 효과적)
2. 아니면 `confusion.available > 0` → `confusion` 추천
3. 아니면 `mixed` 추천 (default)

본 추천 로직은 Step 3-UX-6c carry-over로 서버 측 추천 알고리즘 (Step 3-UX-6 종료 후 또는 별도 plan)으로 이전 권고. 본 ADR 결정 시점은 클라이언트 측 단순 우선순위 채택.

### 4. RFP / Claude Design 응답 보존 정합

- `docs/design/rfp-step-3-ux-6.md` §3.2 4 mode 표는 history로 보존 (수정하지 않음, 작성 시점 의도 영속)
- `docs/design/claudeDesign/` 응답 4 mode UI도 보존 (mockup history)
- 새 영속 표는 본 ADR §"결정" 5 mode 정합

### 5. carry-over

- **서버 mode 추천 알고리즘 신설** (Step 3-UX-6 종료 후 또는 별도 plan) — GET /mode 응답에 `recommendedMode: LearningMode` 필드 추가
- **AESTHETIC.md §3.5 일부 mode 표현 (warmup/main/cooldown/review_weak)** → SessionPhase 시각화 표현으로 의미 재정의 검토 (Step 3-UX-6d ProgressVisualization 시점)
- **Year 2 멀티시험 도입 시** — LearningMode가 시험별로 다를 수 있음 (`packages/learning-modes/`는 examId 인자 받는 구조 이미 존재) → Year 2 마이그레이션 시 mode set per exam 검토

---

## 관련 문서

- 서버 contract: `packages/learning-modes/src/types.ts:11` `LEARNING_MODES`
- 서버 endpoint: `apps/api/src/study/routes.ts:1333` GET /mode
- AESTHETIC.md §3.3 → 본 ADR로 정정
- Plan `docs/plans/phase3-learning-ux-modes.plan.md` §4.3 — 5 mode 정의 원본 (정합)
- ADR-038 (디자인 외주 하이브리드) — 본 ADR이 mismatch 발견 결과

---

## 결정 책임

본 ADR은 다음만 lock:

- ✅ ModeSelector UI는 5 mode (서버 LearningMode contract 정합)
- ✅ AESTHETIC.md §3.3 정정 (4 mode 표 deprecated, 5 mode 표 신설)
- ✅ 추천 mode 선택 로직 (클라이언트 측 단순 우선순위, weak > confusion > mixed)

다음은 lock 안 함:

- ❌ 5 mode 별 정확한 색상 hex (본 ADR 권고 매핑은 가이드, 진산 추가 lock 시 갱신 가능)
- ❌ 서버 측 추천 알고리즘 (carry-over)
