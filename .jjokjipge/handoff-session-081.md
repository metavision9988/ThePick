# Session 071 종착 핸드오프 — ThePick (쪽집게)

> **본 세션(071) 종착**: ★★★ Step 3-UX-6a 디자인 lock 워크플로우 영속 + **Claude Design 응답 수령 + 검토 완료**. 하이브리드 외주 채택 (ADR-038) — RFP/AESTHETIC.md/ADR 영속 → 진산이 동일 세션 내 Claude Design에 RFP 제출 → 응답 수령 (5 컴포넌트 × 3안 = 15 모바일 아트보드) → Claude Code 검토 결과 ✅ lock 가능 판정.
> **다음 세션(072) 진입 시**: (1) 진산 LOCK 결정 영속 (`docs/design/responses/step-3-ux-6-LOCK.md`) 후 → Step 3-UX-6b 4 input type 컴포넌트 분기 진입 / (2) LOCK 미수령 시 → Step 3-UX-7 distractor BATCH 또는 5-페르소나 MIN carry-over 등 다른 priority 진행
> **본 핸드오프 번호 = 081** (handoff-080 직계 후속, Session 071 종착)

---

## 브랜치 & 컨텍스트

- 브랜치: main (origin/main 일치 — Session 070 전체 push 완료)
- Session 071 entry HEAD: dd39694 (chore(ops): Step 3-UX-5c production deploy report, Session 070 종착)
- Session 071 종착 1 commit (예정):
  1. **(본 commit)** docs(design): Step 3-UX-6a 디자인 외주 하이브리드 워크플로우 영속 — ADR-038 + AESTHETIC.md + RFP + plan §10 sub-step 분해
- 미커밋: 0 (commit 직후 기준)

---

## ★★ 본 세션(071) 한 일 — 1 메이저 chunk

### A. Step 3-UX-6a 디자인 lock 워크플로우 영속 (단일 commit 예정)

**배경**: 진산 발화 (2026-05-13) — "클로드디자인 (Claude Design)을 활용해 디자인 설계 외주 용역 → 원하는 결과 받아 적용하는 것 검토."

**PITR 3안 비교 (Claude Code 권고)**:

| 안                               | 방식                                                 | 채택 여부 |
| :------------------------------- | :--------------------------------------------------- | :-------: |
| A. 인하우스 (Claude Code 직접)   | AESTHETIC.md + 코드 동시 작성                        |    ❌     |
| B. 외주 (Claude Design RFP) 전량 | RFP → 3안 + 코드까지 Claude Design                   |    ❌     |
| **C. 하이브리드 (시각만 외주)**  | 시각 3안만 Claude Design → 도메인 + 코드 Claude Code |    ✅     |

**진산 lock**: 안 C 하이브리드 채택.

**영속 산출물 (4 파일)**:

1. **`docs/design/AESTHETIC.md`** (신규, 220+ 라인) — 프로젝트 디자인 토큰 (글로벌 ~/.claude/AESTHETIC.md 상속 + ThePick 고유 토큰 누적)
   - §2 Phase 2 baseline lock된 토큰 (Indigo 600 / Gray 9단 / rx=8/12 / Pretendard / max-w-[1280px] / 44px touch)
   - §3 ThePick 고유 규칙 (출처 surface 1급, 게이미피케이션 표준 강도, 4 input type + 4 mode 시각 위계, 한국어 톤)
   - §4 AI 디자인 안티패턴 (글로벌 + 학습 도메인 특화 — 동기부여 박스/별 트로피/폭죽 등 금지)
   - §5 3-Variant A/B/C 의무 (혼자 1안 제출 금지)

2. **`docs/design/rfp-step-3-ux-6.md`** (신규, 400+ 라인) — Claude Design 의뢰용 RFP
   - §1 ThePick 정체성 + 기술 스택
   - §2 lock된 디자인 토큰 (색상/타이포/레이아웃/모바일/카드 패턴/인풋 버튼/pill 모두 포함)
   - §3 의뢰 5 컴포넌트 (QuestionCard 4 input type / ModeSelector 4 mode / SessionStart / SessionSummary / ProgressVisualization)
   - §4 AI 디자인 안티패턴 (글로벌 + ThePick 특화 + 마이크로카피 금지 표현)
   - §5 도메인 컨텍스트 (학습 흐름 / 출처 추적성 / FSRS / 모바일 80%)
   - §6 출력 요구 (PNG mockup + Tailwind 힌트, 5 컴포넌트 × 3안 × 3 viewport)
   - §7 평가 기준 7개
   - §8 통합 절차 (RFP 응답 수령 후 8 step)

3. **`docs/adr/ADR-038-step-3-ux-6-design-hybrid-outsource.md`** (신규) — 결정 영속
   - PITR 3안 비교표
   - 채택 근거 3개 (이미 lock된 tokens / 도메인 특수성 / 출력 형식 매칭 비용)
   - 통합 워크플로우 8 step
   - 게이트 4개
   - carry-over (Year 2 다른 시험 도메인 학습 UX 시 본 패턴 재사용 검토)

4. **`docs/plans/phase3-learning-ux-modes.plan.md`** (수정) — Step 3-UX-6 sub-step 분해 추가
   - 3-UX-6a (★ 진행 중) 디자인 lock / 6b 4 input type / 6c mode 생명주기 / 6d progress viz / 6e 검증
   - ADR-038 참조 추가

**워크플로우 (Session 071 진행 상태)**:

```
[1] ✅ Claude Code: RFP 영속 (Session 071 — 본 세션)
[2] ✅ 진산: Claude Design에 RFP 본문 제출 (Session 071 동일 세션 내)
[3] ✅ 진산: Claude Design 응답 수령 + docs/design/claudeDesign/ 영속
[4] ✅ Claude Code: 응답 검토 완료 — docs/design/responses/step-3-ux-6-review.md 영속 (lock 가능 판정 + 권고 조합 안)
[5] ☐ 진산: LOCK 결정 → docs/design/responses/step-3-ux-6-LOCK.md (신규)
[6] ☐ Claude Code (다음 세션): LOCK된 안 → Tailwind/React 코드화 (Step 3-UX-6b 진입)
[7] ☐ Claude Code: AESTHETIC.md 누적 갱신
[8] ☐ Step 3-UX-6e: 4-Pass + 5-페르소나 부채 리뷰
```

### B. Claude Design 응답 수령 + 검토 (Session 071 추가 작업)

**진산 발화**: "클로드디자인 (Claude Design)을 활용해 외주 용역" → 즉시 의뢰 진행. `docs/design/claudeDesign/`에 응답 영속.

**응답 산출물 (9 파일, ~1450 라인)**:

- `index.html` (54 라인) — Pretendard CDN + Tailwind Play CDN + React 18 + Babel
- `design-canvas.jsx` (966 라인) — DC framework scaffolding
- `app.jsx` (473 라인) — 메인 App + 5 컴포넌트 × 3안 + 토큰 카드 + 안티패턴 카드 + 데스크탑 참고
- `components/shared.jsx` — Icon / Pill / MetaTag / MODES / SAMPLE_Q (실제 도메인 데이터: 적과전 종합위험방식 Ⅱ / 농어업재해보험법 시행령 제12조)
- `components/question-card.jsx` (313 라인) — QuestionCardA/B/C + InputTypeCard 4 type
- `components/mode-selector.jsx` (159 라인) — ModeSelectorA/B/C
- `components/session-start.jsx` — SessionStartA/B/C
- `components/session-summary.jsx` — SessionSummaryA/B/C
- `components/progress-viz.jsx` (243 라인) — ProgressVizA/B/C + Ring/MiniWeek/HBar SVG primitives

**검토 결과** (`docs/design/responses/step-3-ux-6-review.md` 영속):

| RFP §7 기준                                |                     결과                      |
| :----------------------------------------- | :-------------------------------------------: |
| §2 토큰 준수 (색상/타이포/모서리/보더)     |                    ✅ 100%                    |
| §3 5 컴포넌트 명세 충족                    |                    ✅ 100%                    |
| §4 안티패턴 회피                           | ✅ 0건 (반대로 AntiPatterns 카드 응답에 포함) |
| §5 도메인 정합 (실제 손해평가사 도메인)    |                    ✅ 정확                    |
| 3안 차별성 (A 안정 / B 밀도 / C 관습 깨기) |                    ✅ 명확                    |
| 모바일 우선 (375px baseline)               |                    ✅ 100%                    |
| 44px touch target                          |                    ✅ 100%                    |

**Claude Code 권고 lock 조합 안**:

| 컴포넌트              | 권고 안                                      | 근거                                                               |
| :-------------------- | :------------------------------------------- | :----------------------------------------------------------------- |
| QuestionCard          | A 기본 + **C의 context strip (출처 inline)** | Phase 2 baseline 안정성 + 북극성 "출처 추적성 1급" 강화            |
| ModeSelector          | **A 단독 (세로 stack)**                      | 모바일 80% 정합 (B 2×2는 374px에서 좁음, C 타임라인은 결정성 부족) |
| SessionStart          | **A 단독 (교과서)**                          | streak/일일 목표/예상 시간 위계 명확                               |
| SessionSummary        | **A 단독 (교과서)**                          | 정답률 hero + streak 갱신 + 약점 변화 균형                         |
| ProgressViz sidebar   | **A (3 카드 stack)**                         | 사이드바 180px 자연 통합                                           |
| ProgressViz full page | **C (30일 dot strip)** carry-over            | sidebar 좁아 못 들어가는 30일 추세 → 별도 진도 페이지              |

**판정**: ✅ **lock 가능. 수정 요청 불필요**. Step 3-UX-6b 즉시 진입 가능 상태.

---

## 게이트 상태 (Session 071 종착)

- 코드 변경 0: tests/typecheck/lint 회귀 0 (apps/api 539 PASS / 2 skip + learning-modes 116 + srs 35 + shared 64 유지)
- production Worker: 변경 0 — Version 390a7eb7-93d9-421e-b979-4d4b96cef5f4 유지 (Session 070 종착 baseline)
- production D1: 변경 0 — 35 마이그레이션 적용 유지
- Hard Rule 17 위반: 0건 (디자인 문서만 영속)
- ADR-038 영속 + plan §10 sub-step 분해 본격화 + Claude Design 응답 영속 + 검토 영속

---

## 주요 결정 / 발견

- **디자인 평균 수렴 위험 차단**: 진산 발화 "디자인 단계 — 외주 검토" 자체가 인하우스 시 평균 수렴 우려 시그널. 하이브리드 안 C는 외부 AI 풍부도 + 인하우스 도메인 깊이 결합 → 평균 수렴 회피.
- **Phase 2 baseline 코드 자체가 design token 권위**: QuestionCard.tsx (`Linear-style 1단 카드 + Indigo 600 + Gray 9단 + rx=8`) 추출 → AESTHETIC.md §2 영속. RFP §2에 그대로 전달 → Claude Design 결과 평가 시 토큰 위반 기계적 판정 가능.
- **출처 추적성 1급 surface 재확인**: memory `project_source_citation_requirement.md` + plan §6.5 (disclosure) 정합. AESTHETIC.md §3.1 + RFP §5.2에 명시. Claude Design 응답이 출처 영역을 footer로 밀어내거나 숨기면 거부 사유.
- **모바일 80% touch target 영속**: BaseLayout.astro 글로벌 style이 이미 `min-height: 44px; min-width: 44px;` 강제. AESTHETIC.md §2.5 + RFP §2.4 명시. Step 3-UX-6e Playwright + 실 device 검증 carry-over.
- **anti-pattern 학습 도메인 특화 추가**: 글로벌 AESTHETIC.md 안티패턴 (보라/파랑 그라디언트, 3열 Feature 등) + 학습 도메인 특화 (동기부여 박스, 별/트로피, 폭죽 애니메이션, leaderboard 등) 추가. 진산 발화 메모리 (`project_ux_north_star_phase3.md`: "부정 강조 금지") 정합.

---

## 다음 할 일 (우선순위)

### 시나리오 A — 진산 LOCK 결정 후 (★★★ 최우선, 본 세션 검토 완료로 즉시 진입 가능)

1. **Step 3-UX-6b — 4 input type 컴포넌트 분기**
   - 진산 LOCK 결정 (`docs/design/responses/step-3-ux-6-LOCK.md`) 읽기 — 본 세션 검토 §3 권고 조합 안 참조
   - `docs/design/responses/step-3-ux-6-review.md` §4.2 통합 절차 정합
   - QuestionCard.tsx 4 input type 분기 리팩토링
     - `MultipleChoice` 컴포넌트 (라디오 카드 5개, 1-5 단축키, 셔플 시드 결정성)
     - `FillBlank` 컴포넌트 (단일 라인 input, Enter 채점)
     - `Essay` 컴포넌트 (textarea + self-grade 라디오)
     - `Calc` 컴포넌트 (number input + 단위 보조 라벨)
   - `/api/study/next` 응답의 `inputType` 분기 → 컴포넌트 선택
   - `/api/study/grade` 응답 처리 — 정답/오답 pill + 결과 영역 (기존 패턴 유지)
   - AESTHETIC.md §2 토큰 100% 준수
   - 4-Pass 독립 에이전트 리뷰 + Critical 0건 (auto-review-protocol §"규칙 0 독립 에이전트 필수" 의무)

2. **Step 3-UX-6c — ModeSelector + SessionStart + SessionSummary** (Step 6b 완료 후)
   - `/api/study/mode` 응답 매핑 layer (apps/web/src/lib/api-client.ts 신규)
   - 3 신규 컴포넌트
   - study.astro 진입 시 ModeSelector 표시, 모드 선택 시 SessionStart → QuestionCard 흐름

3. **Step 3-UX-6d — ProgressVisualization** (Step 6b/c 병렬 가능)
   - ProgressSummary.tsx 확장 또는 별도 컴포넌트
   - streak / 일일 / 마스터 chart (SVG 직접 그리기, 외부 chart 라이브러리 추가 회피)

4. **Step 3-UX-6e — 검증** (6b-d 완료 후)
   - Playwright 모바일 viewport (375px) touch target 44px+ 검증
   - 실 device 검증 (진산 모바일 확인)
   - 4-Pass + 5-페르소나 부채 리뷰 (Phase 3 종료 게이트 정합)

### 시나리오 B — 진산 Claude Design 응답 미수령 시

다음 priority 중 선택 (handoff-080 §"다음 할 일" 정합):

- **★★ Step 3-UX-7 distractor BATCH 보강** (★ 진산 + admin 1-2주, plan §13 D1 정합)
  - 기출 원문 5지선다 추출 (pdfplumber + admin UI 검수)
  - adminUI에서 distractor 검수 + approved
  - production seed (별도 BATCH)

- **5-페르소나 MIN carry-over (Phase 3 launch chain 또는 Year 2)**
  - study_sessions/streak_records/study_reviews에 exam_id 컬럼 추가 (ADR-007 Year 2 Phase 4)
  - POST /mode/start 멱등성 (Idempotency-Key)
  - daily_goal PATCH endpoint
  - /grade 5-step 본격 분리 (phase 3 안정화 후)
  - modeStartSchema discriminatedUnion (mode별 modeParams 검증)
  - Workers Cache API for /mode (5분 stale 권장)
  - 운영 admin API (streak 보정 / session force-complete)

- **C-10 TD-VRF-001 100회 누적 동정** (메타 안정성)

- **ADR-034/035/036 복원 (Phase 3 launch toggle, custom domain 통합 후)**
  - PASSWORD_MIN_LENGTH = "8"
  - HIBP_ENABLED = "true"
  - AUTH_COOKIE_SAMESITE = "Strict" (custom domain 통합 후)

---

## 주의사항

- **본 핸드오프(081)는 handoff-080보다 짧다** — Session 070 메가 (Step 3-UX-5c 통합 + 5-페르소나 리뷰 흡수 + production deploy)와 달리 본 세션(071)은 단일 chunk (디자인 외주 워크플로우 영속). 깊이는 ADR-038 + RFP + AESTHETIC.md 본문 참조.
- **진산이 Claude Design에 제출할 RFP는 `docs/design/rfp-step-3-ux-6.md` 본문 전체**. 별도 가공 불요. PNG mockup + Tailwind 힌트 요구가 명시되어 있음.
- **`docs/design/responses/` 디렉토리는 미생성 상태**. 진산이 응답 수령 시 신규 생성하여 영속 (예: `docs/design/responses/step-3-ux-6-A/`, `-B/`, `-C/`, `step-3-ux-6-LOCK.md`).
- **AESTHETIC.md (글로벌 + 프로젝트) 모두 누적만, 삭제 금지** — 새 토큰 발견 시 추가만. 향후 Phase 3 종료 후 ThePick에서 발견한 일반화 가능 토큰 (예: "학습 도메인 부정 강조 X")은 글로벌 ~/.claude/AESTHETIC.md 역류 후보.
- **테스트 baseline (Session 072 진입 시)**: apps/api 539 PASS / 2 skip + learning-modes 116 + srs 35 + shared 64. 회귀 detection 정합 (변경 0이므로 유지).
- **memory 우선 참조**: `project_ux_north_star_phase3.md` (Phase 3 학습 UX 북극성) / `project_source_citation_requirement.md` (출처 추적성 1급) / `feedback_full_autonomy.md` (자동화 가능 영역 묻지 말고 즉시 실행) / `feedback_no_granular_decisions.md` (지엽 결정 X, 전략 갈림길만) / `project_launch_legal_bundle_deferred.md` (Phase 1/2 중 차단 요소 재언급 금지).
- **auto-review-protocol §"규칙 0 독립 에이전트 필수"**: 다음 세션 Step 3-UX-6b 본격 코드 작성 후 4-Pass 시 메인 컨텍스트 자가 검증 금지, 독립 서브에이전트 위임 의무.
- **Hard Rule 16/17 정합 진척 ~35%** (Session 070 backend-architect 진단 유지). Hard Rule 17 100% (리터럴 0건). Hard Rule 16 함수 시그니처 40%. 데이터 모델 0% (exam_id 컬럼 5개 테이블 누락). Year 2 zero-cost 전환 비용 1.5-2일 → 5-7일 팽창 추정. MIN carry-over로 명시 영속.
- **production Worker `390a7eb7-93d9-421e-b979-4d4b96cef5f4` 활성** (Step 3-UX-5a/5b/5c 일괄 deploy 완료). URL: https://thepick-api-production.metavision9988.workers.dev. 본 세션 Worker 변경 0.
- **production D1 row baseline (Session 070 종착 유지)**: user_progress 18 / exam_questions 545 / login_history 2 / study_sessions 1 / streak_records 1 / study_reviews 3 / engine_telemetry +5. Session 072 작업 시 무회귀 확인 의무.

이 핸드오프 프롬프트를 읽고 프로젝트 CLAUDE.md를 확인한 후 작업을 이어가세요.
