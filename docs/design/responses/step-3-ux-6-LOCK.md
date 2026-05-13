# Step 3-UX-6 디자인 LOCK 결정

- **lock 일**: 2026-05-13 (Session 071)
- **lock 결정자**: 진산 (Claude Code 권고 조합 안 채택)
- **참조**: `docs/design/responses/step-3-ux-6-review.md` §3 권고 조합 안

---

## 1. lock된 안 (컴포넌트별)

| 컴포넌트                  | lock 안                             | 비고                                                                                                                                                                                       |
| :------------------------ | :---------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **QuestionCard**          | **A 기본 + C의 context strip 통합** | A의 Phase 2 baseline chrome 유지 + C의 본문 위 inline 출처 strip (`약관 별표1 · 법 시행령 §12` 형식). 결과 영역 (`bg-gray-50`)의 dl 출처는 always-on 유지, "관련 자료"는 `<details>` 토글. |
| **ModeSelector**          | **A 단독 (세로 stack)**             | 4 모드 1열 stack + 좌측 1px 컬러 보더 + 추천 amber pill. 모바일 80% 정합.                                                                                                                  |
| **SessionStart**          | **A 단독 (교과서)**                 | 모드 색상 hint + 일일 목표 progress + streak 현황 + "시작" 주 버튼.                                                                                                                        |
| **SessionSummary**        | **A 단독 (교과서)**                 | 정답률 hero + streak 갱신 + 약점 영역 변화 + 액션 그룹.                                                                                                                                    |
| **ProgressViz sidebar**   | **A (3 카드 stack)**                | 오늘 ring + 7일 streak + 마스터 5 bar. /study 페이지 사이드바 통합.                                                                                                                        |
| **ProgressViz full page** | **C (30일 dot strip) carry-over**   | sidebar 좁아 못 들어가는 30일 추세를 별도 진도 페이지에서 활용. Step 3-UX-6d 후반 또는 별도 step.                                                                                          |

## 2. lock 근거 (review.md §3 권고대로)

- **QuestionCard A+C**: Phase 2 baseline 안정성 + 북극성 "출처 추적성 1급 surface" 정합 극대화 (memory `project_source_citation_requirement.md`).
- **Mode/Start/Summary A 단독**: 모바일 80% 정합, 안정성 우선, 학습 흐름 결정성 확보.
- **Progress sidebar A + full page C**: 좁은 sidebar는 A 3 카드 자연 통합. 30일 strip은 별도 페이지에서 진정한 가치 발휘.

## 3. 통합 진입 (Step 3-UX-6b)

본 LOCK 영속 후 Claude Code 즉시 Step 3-UX-6b 진입:

1. apps/web/src/components/QuestionCard.tsx 리팩토링 — 4 input type 분기
2. 신규 sub-components (MultipleChoice / FillBlank / Essay / Calc / ContextStrip / ResultSection)
3. inputType prop 분기 (서버 `/api/study/next` 응답의 `inputType` 활용)
4. Phase 2 baseline 유지 (header / body / result 패턴)
5. C의 context strip 통합 (본문 위 inline 출처)

---

## 4. 보정 / 추가 지시

### 4.1 ADR-040 carry-over (2026-05-13 Session 071 4-Pass 리뷰 후속)

본 LOCK §1의 다음 항목은 서버 endpoint 확장 의존 → ADR-040으로 carry-over 명시:

- **SessionStart "일일 목표 progress"** — GET /api/study/mode 응답에 streak/dailyGoal block 부재. ADR-040 §"G-1" 정합 Step 3-UX-6c-2에서 처리.
- **SessionSummary "약점 영역 변화"** — SessionCompleteResponse에 weak delta 필드 부재. ADR-040 §"G-2" 정합 Step 3-UX-6c-2에서 처리.
- **세션 복원 (PWA 정합)** — GET /api/study/session/:id 엔드포인트 존재하나 클라이언트 미호출. ADR-040 §"G-3" 정합 Step 3-UX-6c-3 또는 별도 plan.

본 carry-over는 LOCK §1 변경이 아닌 **데이터 surface 의무 보정**. UI 구조는 LOCK §1 영속.

### 4.2 본 LOCK 외 진산 추가 지시

(없음 — Claude Code 권고 조합 안 그대로 채택, ADR-040 carry-over는 4-Pass 리뷰 발견 자동 흡수)

---

# 참조

- 권고 review: `docs/design/responses/step-3-ux-6-review.md`
- 응답 산출물: `docs/design/claudeDesign/` (15 mobile artboards)
- RFP: `docs/design/rfp-step-3-ux-6.md`
- AESTHETIC.md: `docs/design/AESTHETIC.md`
- ADR-038
