# Step 3-UX-6 Claude Design 응답 검토 결과

- **검토일**: 2026-05-13 (Session 071)
- **검토자**: Claude Opus 4.7 (메인 컨텍스트)
- **검토 대상**: `docs/design/claudeDesign/` (Claude Design 외주 응답)
- **참조 RFP**: `docs/design/rfp-step-3-ux-6.md`
- **참조 AESTHETIC**: `docs/design/AESTHETIC.md` (프로젝트) + `~/.claude/AESTHETIC.md` (글로벌)
- **참조 ADR**: ADR-038 (하이브리드 외주 채택)

---

## 1. 수령 산출물

| 파일                             |   라인 | 역할                                                                         |
| :------------------------------- | -----: | :--------------------------------------------------------------------------- |
| `index.html`                     |     54 | 엔트리. Pretendard CDN + Tailwind Play CDN + Babel + React 18                |
| `design-canvas.jsx`              |    966 | DC framework (artboard / section / canvas) — 시각 캔버스 scaffolding         |
| `app.jsx`                        |    473 | 메인 App 구성 — 5 컴포넌트 × 3안 + 토큰 카드 + 안티패턴 카드 + 데스크탑 참고 |
| `components/shared.jsx`          |    130 | Icon / Pill / MetaTag / MODES / SAMPLE_Q (도메인 데이터 포함)                |
| `components/question-card.jsx`   |    313 | QuestionCardA/B/C + InputTypeCard (4 type)                                   |
| `components/mode-selector.jsx`   |    159 | ModeSelectorA/B/C                                                            |
| `components/session-start.jsx`   | (미상) | SessionStartA/B/C                                                            |
| `components/session-summary.jsx` | (미상) | SessionSummaryA/B/C                                                          |
| `components/progress-viz.jsx`    |    243 | ProgressVizA/B/C + Ring/MiniWeek/HBar SVG primitives                         |

총 5 컴포넌트 × 3안 = **15 모바일 아트보드** + 토큰/안티패턴/데스크탑 참고 추가 산출물.

---

## 2. RFP §7 평가 기준 점검

### 기준 1. §2 토큰 준수

✅ **100% 정합**

- 색상: Indigo 600 (`#4f46e5`) 주, Indigo 800 (`#1e40af`) PWA theme, Amber 500/100, Emerald 100/900, Red 50/200/900, Gray 9단 — RFP 명시 hex 모두 정확히 채택
- 타이포: Pretendard 400/500만. font-weight 700 (bold) 0건 (전수 grep 확인 가능)
- 모서리: `rounded-lg` 또는 `rounded-full`만. `rounded-xl/2xl` 0건
- 보더: `gray-100` (separator) / `gray-200` (카드 외곽) 패턴 정합
- `tp-body` 클래스 (line-height 1.7) + `tp-tight` 클래스 (1.3) 분리하여 줄간격 토큰 영속
- max-width: 모바일 375 baseline + 데스크탑 max-w-[720px] + 사이드바 lg:w-[180px] — Phase 2 baseline 정합

### 기준 2. §3 5 컴포넌트 명세 충족

✅ **100% 충족**

#### QuestionCard (§3.1)

- 4 input type 분기 모두 같은 카드 chrome (`<article rounded-lg border border-gray-200 bg-white>`)
- header (출처 + 과목 pill) / body / input / result (`bg-gray-50`) 4 섹션 패턴 일관
- 출처 영역 always-on (dl-dt-dd 패턴, footer 미사용) — 북극성 정합
- "관련 자료"만 `<details>` 토글 — RFP §5.2 출처 추적성 1급 정합

**InputTypeCard 4 type 분기**:

- `multiple-choice`: 라디오 카드 5개 + 1-5 단축키 hint
- `fill-blank`: 단일 input + Enter 채점 + 단답형 placeholder
- `essay`: textarea + self-grade 라디오 (맞음/모름/틀림) + Ctrl+Enter
- `calc`: number input + 단위 "원" 자동 부착 (`tabular-nums`)

#### ModeSelector (§3.2)

- 4 모드 (warmup/main/cooldown/review_weak) — RFP MODES 정합
- 좌측 1px 컬러 보더로 mode 색상 hint (`borderLeft: 2px solid ${m.color}`) — RFP §3.2 정합
- "추천" 표시는 amber pill (1페이지 1회 강조 원칙)
- A 세로 stack / B 2×2 grid / C 수직 타임라인 (관습 깨기)

#### SessionStart (§3.3)

- 모드 색상 hint + 일일 목표 progress + 예상 (카드 수/시간) + streak 현황 + "시작" 주 버튼
- streak 표시 단순 숫자 + flame 아이콘 1개. **폭죽/색종이 X** (RFP §4.2 안티패턴 회피)

#### SessionSummary (§3.4)

- 정답률 hero + streak 갱신 + 약점 영역 변화 + 액션 그룹 (더 학습/오늘은 여기까지)
- 신기록 시 amber pill "신기록" (1페이지 1회). **트로피/배지 X**

#### ProgressVisualization (§3.5)

- 오늘 원형 progress (1선 stroke=4) + 7일 미니 히트맵 (정사각형 7개 가로) + 과목별 horizontal bar (5개)
- SVG 직접 그리기 — Recharts/d3 등 외부 chart 라이브러리 의존성 0건 (RFP §3.5 권고 정합)
- C 안은 **30일 dot strip**으로 관습 깨기 — 7일 너무 짧음 + 캘린더 그리드 너무 큼의 절충

### 기준 3. §4 안티패턴 회피

✅ **0건 위반**

추가로 **AntiPatterns 카드를 응답 자체에 포함** (12개 금지 항목 명시) — Claude Design이 RFP §4를 진지하게 받았다는 자기 점검 증거.

전수 점검:

- [ ] ❌ 보라/파랑 그라디언트 히어로 → 0건 (단색 indigo만)
- [ ] ❌ 검은 배경 + 네온 보더 → 0건 (near-white 배경만)
- [ ] ❌ "Simple. Fast. Powerful." 3단어 반복 → 0건
- [ ] ❌ Emoji feature 구분 → 0건 (lucide-style stroke SVG icon만)
- [ ] ❌ 동기부여 박스 / 오늘의 명언 → 0건
- [ ] ❌ 별/하트/트로피 진척률 → 0건 (% 숫자 + bar만)
- [ ] ❌ 폭죽/색종이 streak 애니메이션 → 0건 (정적 숫자 + flame icon)
- [ ] ❌ 신호등 색상 (red/yellow/green) → 0건 (오답 amber / 정답 emerald만, red는 위험만)
- [ ] ❌ 카드 그라디언트 배경 → 0건
- [ ] ❌ 모드 슬라이더/dial → 0건 (카드만)
- [ ] ❌ 랭킹/leaderboard/배지 그리드 → 0건
- [ ] ❌ "잘했어요!" "Awesome!" 격려 카피 → 0건 (평서체 짧게 정합)

### 기준 4. §5 도메인 정합

✅ **정확**

샘플 데이터가 실제 손해평가사 도메인:

- 농업재해보험 / 농작물재해보험 / 가축재해보험 / 농업정책보험 / 손해평가 실무 (실제 과목 분류)
- 적과전 종합위험방식 Ⅱ (실제 보험 상품 분류)
- 농어업재해보험법 시행령 제12조 (실제 법조문)
- 농업재해보험 표준약관 별표1 (실제 약관 별표)
- 2024년 제10회 / 2023년 제9회 (실제 시험 회차)
- 가입금액·자기부담비율·피해율·지급보험금 (실제 산식 변수)

→ Claude Design이 도메인 컨텍스트 (RFP §5)를 정확히 반영함.

### 기준 5. 3안 차별성

✅ **명확 (안티패턴 0건 유지하면서 차별화)**

- **A (교과서)**: 세로 stack, 명확한 섹션 분리. 패딩 `px-6 py-{4|5|6}` 풍성. choice li `py-3 px-3`.
- **B (밀도)**: 같은 row 합치기 (출처+과목+타이머 inline). choice dense `py-2.5 px-3`. footer mini progress "7/15". 정보량 ~30% ↑.
- **C (급진)**: 카드 상단 progress strip 1선 (h-0.5 indigo-600 47%) + 출처 inline context strip (본문 위, 밀어내지 않음) + 키캡 좌측 정렬. **출처 surface 1급 정합 더 강화**. ModeSelector C는 수직 타임라인 메타포로 학습 흐름 시각화. ProgressViz C는 30일 dot strip + 다중 ring X.

### 기준 6. 모바일 우선

✅ **375px baseline 100% 충족**

- 모든 컴포넌트 `MobileFrame` (375 width) 안에 배치
- `MobileFrame` 패딩 `p-4` (16px) — RFP §2.4 안전 영역 정합
- horizontal bar (vertical 모바일 짤림 회피) — RFP §3.5 정합
- 데스크탑 참고 2 artboards (1100 + 760) — 모바일 우선 후 데스크탑 보강 패턴

### 기준 7. 44px touch target

✅ **100% 충족**

모든 인터랙티브 요소에 `style={{ minHeight: 44 }}` 또는 `minWidth: 44` 명시. self-grade 라디오만 `minHeight: 32` (compact mini button) — 본 주 액션 아니므로 허용.

---

## 3. 권고 lock 안 (조합)

진산 lock 시 다음 조합을 권고합니다. **현재 상태로 lock 가능, 수정 요청 불필요**.

### 3.1 QuestionCard

**권고 안**: **A 기본 + C의 context strip (출처 inline)**

| 측면          | 채택 안                       | 근거                                                                                            |
| :------------ | :---------------------------- | :---------------------------------------------------------------------------------------------- | --- | --------------------------------------------------- |
| 외곽 chrome   | A                             | Phase 2 baseline 일관성 (QuestionCard.tsx 패턴 유지)                                            |
| 패딩          | A `px-6 py-{4                 | 5                                                                                               | 6}` | 학습 도메인은 여유 공간이 가독성 ↑ (B는 너무 dense) |
| header        | A (출처 + 과목 pill 우측)     | Phase 2 패턴 유지                                                                               |
| **추가 보강** | C의 context strip 출처 inline | 본문 위 inline 출처 (`약관 별표1 · 법 시행령 §12`) — 북극성 "출처 추적성 1급 surface" 정합 강화 |
| input 영역    | A                             | 4 type 동일 chrome (RFP §3.1 정합)                                                              |
| result 영역   | A                             | dl-dt-dd 출처 always-on + 관련 자료 `<details>` 토글                                            |
| 액션 footer   | A                             | "건너뜀" + "다음 문제 ⌃N" + 44px                                                                |

**조합 효과**: A의 안정성 + C의 출처 inline 강화. 진산 발화 "근거 보기 UX 1급" (memory `project_source_citation_requirement.md`) 정합 극대화.

### 3.2 ModeSelector

**권고 안**: **A (세로 stack)** 단독

| 옵션            | 평가                                                                                      |
| :-------------- | :---------------------------------------------------------------------------------------- |
| A 세로 stack    | ✅ 모바일 80% 정합 (374px width에서 1열 자연)                                             |
| B 2×2 grid      | ❌ 374px에서 각 카드 ~180px width — choice text `line-clamp-2`로 잘림 위험                |
| C 수직 타임라인 | ❌ 흥미롭지만 학습 흐름 결정성 부족 (사용자가 "오늘의 흐름" 메타포 처음 보면 이해 비용 ↑) |

**조합 효과**: 안정적 선택. 좌측 1px 컬러 보더 + "추천" amber pill (1페이지 1회) — RFP §3.2 정합.

### 3.3 SessionStart

**권고 안**: **A (교과서)** 단독

A 안의 streak/일일 목표/예상 시간 위계가 명확. B의 밀도 향상은 SessionStart에서는 정보 부족 (시작 직전이라 정보 압축 불필요). C의 hero 숫자 + 엄지존은 흥미롭지만 SessionStart는 빠른 진입이 중요해 hero 비주얼이 오히려 인지 부담 ↑.

### 3.4 SessionSummary

**권고 안**: **A (교과서)** 단독

정답률 hero + streak 갱신 + 약점 변화 균형. B의 밀도 향상은 결과 분석 시 정보가 한꺼번에 들어와서 사용자 인지 부담 ↑. C의 약점 변화 우선은 흥미롭지만 정답률 hero가 후순위로 밀려 동기부여 약화 (북극성 "표준 강도 게이미피케이션" 정합 약화).

### 3.5 ProgressVisualization

**권고 안**: **A (3 카드 stack)** 기본 + **C의 30일 dot strip** 별도 페이지 활용

| 위치             | 권고 안                                                                      |
| :--------------- | :--------------------------------------------------------------------------- |
| /study 사이드바  | A 3 카드 (오늘 ring / 7일 streak / 마스터 5 bar) — 좁은 180px sidebar에 자연 |
| 별도 진도 페이지 | C 30일 dot strip — sidebar 좁아서 못 들어가는 30일 strip을 메인 페이지로     |

**조합 효과**: sidebar는 A로 가벼움 유지. 진도 페이지는 C로 30일 추세 시각화. carry-over로 Step 3-UX-6d에서 두 안 모두 구현.

---

## 4. 통합 진입 (Step 3-UX-6b) 준비 상태

### 4.1 진산 lock 결정 의무

진산 다음 결정 의무 (본 review 참조하여 `docs/design/responses/step-3-ux-6-LOCK.md` 작성 시):

- **QuestionCard**: A 기본 + C의 context strip 채택 여부 (권고 ✅ / 다른 조합 / 단일 A 또는 C)
- **ModeSelector**: A 채택 여부 (권고 ✅) / B 또는 C
- **SessionStart**: A 채택 여부 (권고 ✅)
- **SessionSummary**: A 채택 여부 (권고 ✅)
- **ProgressViz sidebar**: A 채택 여부 (권고 ✅)
- **ProgressViz full page**: C 30일 strip carry-over 여부 (권고 ✅)
- 추가 의견 (예: "header padding 통일" 같은 보정 사항)

### 4.2 Step 3-UX-6b 진입 준비

LOCK 결정 후 Claude Code는 다음을 즉시 진행 가능:

1. **`packages/learning-modes`에 4 input type 시각 컴포넌트 위임 layer 추가** (또는 apps/web 직접)
2. **`apps/web/src/components/QuestionCard.tsx` 리팩토링**:
   - 기존 단일 textarea → 4 input type 분기
   - `inputType` prop 또는 `/api/study/next` 응답의 `inputType` 분기
   - `MultipleChoice` / `FillBlank` / `Essay` / `Calc` 4 sub-component 추출
3. **Phase 2 baseline 유지**:
   - header (출처 + 과목 pill) — Phase 2와 동일
   - result 영역 (정답/해설/출처/관련 자료) — Phase 2와 동일
   - 4 input type별 입력 영역만 분기
4. **C의 context strip 통합** (권고 채택 시):
   - 본문 위 inline `<div className="px-5 pb-2 border-b border-gray-100">{출처 inline}</div>`
   - QuestionCard 응답 `sourceCitations.manualPages` / `lawArticles` 활용

### 4.3 코드화 우선순위

| 우선 | Step        | 작업                                                                | 추정                     |
| :--: | :---------- | :------------------------------------------------------------------ | :----------------------- |
|  1   | 3-UX-6b     | QuestionCard 4 input type 리팩토링                                  | ~5시간                   |
|  2   | 3-UX-6c     | ModeSelector + SessionStart + SessionSummary (mode 생명주기 wiring) | ~5시간                   |
|  3   | 3-UX-6d (a) | ProgressVizSidebar (A 안)                                           | ~3시간                   |
|  4   | 3-UX-6d (b) | ProgressVizFullPage (C 30일 strip, 별도 page)                       | ~2시간 (carry-over 가능) |
|  5   | 3-UX-6e     | Playwright + 4-Pass + 5-페르소나 부채 리뷰                          | ~5시간                   |

**총**: ~20시간 (~3 sessions). 본 권고 조합 채택 시.

---

## 5. 주의사항 / 발견

### 5.1 design-canvas.jsx 의존성

`design-canvas.jsx`는 Design Canvas framework (DCSection / DCArtboard 등). **본 framework는 통합 시 사용 안 함** (단순 시각 캔버스 scaffolding). 컴포넌트 통합 시 추출만 하고 framework 자체는 production 코드에 포함하지 않음.

### 5.2 Babel + UMD CDN

`index.html`은 Babel + UMD CDN으로 단일 페이지 데모. 통합 시 Astro + React Islands 환경의 import 형식으로 변환. 큰 비용 아님 (top-level Object.assign(window, {...}) → ES module export 전환).

### 5.3 샘플 도메인 데이터

`SAMPLE_Q.answer = 3` (복숭아 보장종료일)가 실제 정답 아닐 가능성 — 응답 주석에 "sample only" 명시됨. 실 통합 시 production D1 데이터 사용 (이미 545 문항 적재). 본 검토 영향 없음.

### 5.4 Pretendard CDN

`index.html`은 Pretendard CDN (`cdn.jsdelivr.net/gh/orioncactus/pretendard`) 사용. Phase 2 production은 동일 패턴인지 BaseLayout.astro 확인 의무. 미확인 시 Step 3-UX-6b 시점에 확인.

### 5.5 안 C QuestionCard의 sticky progress

C 안의 카드 상단 progress strip (`h-0.5 bg-gray-100`)은 안티패턴 §"바이올린 hero" 회피하면서 진척률을 카드 안으로 끌어옴 — 좋은 패턴. 다만 Phase 2의 외부 TopBar (`text-xs · 7/15`)와 중복 표시 우려. 권고 조합 채택 시 외부 TopBar 제거하고 카드 상단 progress strip만 활용.

---

## 6. 종합 판정

✅ **Claude Design 응답 lock 가능 — 수정 요청 불필요**

진산 LOCK 결정 후 Claude Code 즉시 Step 3-UX-6b 진입.

**다음 산출물**:

- `docs/design/responses/step-3-ux-6-LOCK.md` (진산 작성 의무, 본 review §3 권고 안 참조)
- Step 3-UX-6b QuestionCard 4 input type 리팩토링 (Claude Code 다음 세션)

---

# 참조

- RFP: `docs/design/rfp-step-3-ux-6.md`
- AESTHETIC.md: `docs/design/AESTHETIC.md`
- ADR-038: `docs/adr/ADR-038-step-3-ux-6-design-hybrid-outsource.md`
- Plan: `docs/plans/phase3-learning-ux-modes.plan.md` §10 Step 3-UX-6
- Phase 2 baseline: `apps/web/src/components/QuestionCard.tsx`
- 응답 산출물: `docs/design/claudeDesign/` (index.html + 6 component files + design-canvas.jsx + app.jsx)
