# RFP — ThePick Step 3-UX-6 학습 UX 5 컴포넌트 시각 3안

> 본 문서는 외부 디자인 AI (Claude Design 등) 의뢰용 RFP다.
> 진산이 Claude Design에 전체 본문을 제출 → 시각 3안(A/B/C) 수령 → 진산 lock → Claude Code가 도메인 통합 + Tailwind/React 코드화.
> 본 RFP에 포함된 토큰/패턴/안티패턴은 **준수 의무**다. 위반 시 결과물 재요청.

---

## 1. 프로젝트 개요

### 1.1 정체성

- **이름**: 쪽집게 (ThePick)
- **도메인**: 손해평가사 자격시험(1차+2차) AI 학습 PWA
- **사용자**: 한국인 수험생, 모바일 80% / 데스크탑 20%
- **언어**: 한국어 (UI 문자열 한국어 100%)
- **북극성**: 학습 콘텐츠 신뢰성. 정답·해설·출처가 항상 1급 surface. 게이미피케이션은 표준 강도, 부정 강조 금지.
- **분위기**: 진지함 / 신뢰감 / 몰입. 격려성 표현 절제. 시험 도메인이므로 캐주얼한 톤 / 별·트로피·폭죽 애니메이션 모두 부적합.

### 1.2 기술 스택 (참고)

- Astro + React Islands + Tailwind CSS
- 출력 결과는 **PNG mockup + Tailwind class 힌트** 권장 (Figma 가능하나 코드화 라운드트립 길어짐)
- 반응형: 375px (mobile) / 768px (tablet) / 1280px (desktop)

---

## 2. lock된 디자인 토큰 (반드시 준수)

### 2.1 색상

| 역할                       | Tailwind                                     | Hex                               |
| :------------------------- | :------------------------------------------- | :-------------------------------- |
| 주 (primary)               | `indigo-600`                                 | `#4f46e5`                         |
| 주 (deep, PWA theme)       | `indigo-800`                                 | `#1e40af`                         |
| 강조 (accent, 1페이지 1회) | `amber-500` / `amber-100`                    | `#f59e0b` / `#fef3c7`             |
| 성공                       | `emerald-100` + `emerald-900` text           | `#d1fae5` / `#064e3b`             |
| 위험                       | `red-50` / `red-200` border / `red-900` text | `#fef2f2` / `#fecaca` / `#7f1d1d` |
| 회색 9단                   | `gray-50` ~ `gray-900`                       | `#f9fafb` ~ `#111827`             |

**원칙**:

- **1페이지 = 1강조색**. Indigo 외에 Amber 사용은 한 화면 한 곳만.
- 배경: 항상 near-white (`#ffffff` 또는 `gray-50`). 순백/순흑 금지.
- 그라디언트 금지. 단색만.

### 2.2 타이포그래피

- **본문 / 한글**: Pretendard
- **font-weight**: 400 (regular) / 500 (medium). **bold (700) 금지**.
- 제목 h1: `text-2xl font-medium text-gray-900`
- 헤더 라벨: `text-xs font-medium uppercase tracking-wide text-gray-500`
- 본문: `text-base leading-relaxed text-gray-900`
- 보조: `text-sm text-gray-500`
- 마이크로: `text-xs text-gray-500`
- 수치 강조: `text-base font-medium text-indigo-600`
- 줄간격: 1.7 (바디) / 1.3 (제목)
- 행당 한글 35~45자

### 2.3 레이아웃

- max-width: **1280px** (1440px 이상 금지)
- 모서리: **`rounded-lg` (rx=8) 또는 `rounded-full` (pill)만 허용**. `rounded-xl`, `rounded-2xl` 금지.
- 보더: `border-gray-100` (separator) / `border-gray-200` (카드 외곽). 0.5px 느낌의 얇은 보더.
- 그림자: 최소 사용. 사용 시 `shadow-sm` 이상 금지.
- 카드 내부 padding: `px-6 py-{4|5|6}` (수직만 변동)
- 데스크탑 사이드바: `lg:w-[180px]` (학습 페이지 진도 surface만)
- 본문 영역: `lg:max-w-[720px]` (행당 한글 ~40자 보장)

### 2.4 모바일 — Touch Target (★ 80% 사용자)

- 모든 인터랙티브 요소: **`min-height: 44px; min-width: 44px;`** (예외 없음)
- 모바일 first 디자인 (375px 너비 baseline)
- 작은 화면 (≤ 360px): `font-size: 14px`
- 가로 스와이프 패턴 사용 시 좌/우 가장자리 16px+ 안전 영역
- 한 손 엄지 도달 영역 (화면 하단 60%) 주 액션 배치 권장

### 2.5 카드 내부 구조 (Phase 2 baseline QuestionCard 패턴)

```
<article rounded-lg border border-gray-200 bg-white>
  <header border-b border-gray-100 px-6 py-4>
    ... 메타 (출처/과목 배지) ...
  </header>
  <div px-6 py-6>
    ... 본문 ...
  </div>
  <div border-t border-gray-100 px-6 py-5>
    ... 입력 / 액션 ...
  </div>
  <section border-t border-gray-100 bg-gray-50 px-6 py-5>
    ... 결과 / 보충 (정답 + 해설 + 출처 + 관련 자료) ...
  </section>
</article>
```

- 섹션 구분: `border-t border-gray-100` (얇은 회색선)
- 결과 영역만 `bg-gray-50` (대비)

### 2.6 인풋 / 버튼 토큰

- 텍스트 입력: `rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed text-gray-900`
  - focus: `focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200`
- 주 버튼: `rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700`
- 보조 버튼: `rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50`

### 2.7 pill / 라벨 토큰

- 정답: `rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900` "정답"
- 오답: `rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900` "오답"
- 과목: `rounded-full bg-gray-100 px-2 py-0.5 text-gray-700` "농업재해보험"
- 메타 (노드 타입): `rounded bg-gray-200 px-1.5 py-0.5 font-mono text-gray-700` "CONCEPT"

---

## 3. 의뢰 컴포넌트 (5개)

각 컴포넌트는 **A / B / C 3안 동시 제출 의무**. 단일 1안 제출 거부.

- **A (교과서)**: Phase 2 baseline에 가장 충실. Linear/Craft 레퍼런스 일관.
- **B (밀도)**: A 대비 30% 정보 밀도 증가. 같은 row에 합칠 수 있는 정보를 합친다.
- **C (급진)**: 관습 1개 의도적으로 깨뜨림. 단 §4 안티패턴은 절대 깨지 않는다.

### 3.1 QuestionCard — 4 input type 분기

**역할**: 학습 단일 문제 카드. 4가지 input type 분기.

**입력 type별 UX**:

| Type              | 입력 컴포넌트                                              | 키보드 단축키 | 비고                                                                         |
| :---------------- | :--------------------------------------------------------- | :------------ | :--------------------------------------------------------------------------- |
| `multiple-choice` | 라디오 카드 5개 (① ② ③ ④ ⑤)                                | 1-5 숫자 키   | 보기는 일자별 셔플 (사용자별 결정성), 큰 터치 영역, 선택 시 indigo 좌측 보더 |
| `fill-blank`      | 단일 라인 `<input type="text">`                            | Enter 채점    | placeholder "정답 입력" — 보통 단답형 (지명/연도/용어)                       |
| `essay`           | `<textarea rows={5}>` + self-grade 라디오 (맞음/모름/틀림) | Ctrl+Enter    | 자동 채점 불가, 사용자 자기 채점                                             |
| `calc`            | `<input type="number">` + 단위 보조 (예: "원" / "%")       | Enter 채점    | 손해평가사 산식 문제, 수치 정확 매칭                                         |

**구조** (Phase 2 QuestionCard 확장):

```
[ header: 출처 (2024년 제10회 제3문) + 과목 pill (농업재해보험) ]
[ body: 문제 본문 (whitespace-pre-wrap) ]
[ input 영역: type별 분기 ]
[ 액션: 채점 버튼 (Ctrl+Enter) + (옵션) 건너뜀 ]
─ graded 후 ─
[ result 영역 (bg-gray-50):
  - 정답/오답 pill + 내가 쓴 답
  - 정답 (always-on)
  - 해설 (always-on)
  - 출처 (교재 페이지 / 법조문 / 기출) — dl-dt-dd 패턴
  - 관련 자료 토글 <details> — 관련 노드 리스트 ]
[ 다음 문제 버튼 (Ctrl+N) ]
```

**중요 요구**:

- 4 input type 모두 동일한 카드 외곽 (`rounded-lg border border-gray-200`) 유지
- input type 분기에서 화면 다른 화면으로 전환하지 말 것 (같은 카드 안에서 type만 변동)
- 출처 영역은 **숨기지 말 것**. 결과 영역에 항상 노출 (`progressive disclosure` 토글은 "관련 자료"만 적용)

### 3.2 ModeSelector — 4 학습 모드 카드

**역할**: 학습 시작 시 사용자가 모드를 선택. `/api/study/mode` 응답을 표시.

**4 모드** (1 mode 1 색상 hint, 좌측 1px 컬러 보더로 구분 — 전체 배경 컬러 X):

| Mode ID       | 표시명    | 설명 (마이크로카피)           | 색상 hint                     |
| :------------ | :-------- | :---------------------------- | :---------------------------- |
| `warmup`      | 워밍업    | 쉬운 카드부터 천천히          | gray (중성)                   |
| `main`        | 본 학습   | FSRS 큐 — 오늘 풀어야 할 카드 | indigo-600 (주)               |
| `cooldown`    | 쿨다운    | 난이도 낮추며 마무리          | emerald (차분)                |
| `review_weak` | 약점 복습 | weak_score 높은 카드만        | amber (주의, 한 화면 한 곳만) |

**구조** (모드 카드 4개):

```
[ 모드 카드 1개:
  - 좌측 1px 컬러 보더 (mode 색상 hint)
  - 모드명 (text-base font-medium text-gray-900)
  - 설명 (text-sm text-gray-500)
  - 예상 카드 수 / 예상 시간 (예: "15분 · 12문제")
  - 추천 배지 (서버에서 추천 mode 표시 시) ]
```

**중요 요구**:

- 모바일에서는 4 카드 세로 stack
- 데스크탑에서는 2x2 grid 또는 1x4 row (B/C 변형에서 결정)
- 각 카드 전체가 터치 영역 (44px+ 보장)
- "추천" 표시는 amber pill (1페이지 1회 강조 원칙 정합)

### 3.3 SessionStart — 세션 진입 화면

**역할**: 모드 선택 후 세션 시작 직전. 일일 목표 진척 + 예상 효과 표시.

**구조**:

```
[ header: 선택한 모드 + 모드 색상 hint ]
[ 일일 목표 진척:
  - "오늘 학습 7/15"  (text-base font-medium text-gray-900)
  - progress bar (indigo-600) ]
[ 이번 세션:
  - 예상 카드 수 / 예상 시간
  - 약점 영역 비중 (선택사항, mode == review_weak 일 때 강조) ]
[ streak 현황:
  - "현재 5일 연속" (lucide flame 아이콘 + 숫자)
  - "최장 기록 12일" (gray-500 보조) ]
[ 액션: "시작" 주 버튼 (indigo) ]
```

**중요 요구**:

- 일일 목표 progress bar는 1선만 사용 (다중 라인 X)
- streak 표시는 단순 숫자 + flame 아이콘 1개. **폭죽/색종이/움직임 금지**.
- "시작" 버튼은 화면 하단 (모바일 엄지 도달 영역)

### 3.4 SessionSummary — 세션 종료 화면

**역할**: 세션 완료 후 결과 요약 + 다음 추천.

**구조**:

```
[ header: "세션 완료" + 모드 색상 hint ]
[ 결과 카드:
  - 정답률 (큰 숫자, text-3xl font-medium text-indigo-600) + 옆에 "12 / 15" 표시
  - 소요 시간 / 평균 응답 시간 ]
[ streak 갱신:
  - "5일 → 6일" (오늘 학습 완료로 +1 — gray-900)
  - 신규 최장 기록 시 amber pill "신기록" (1페이지 1회) ]
[ 약점 영역 변화:
  - 상위 3개 약점 영역 비교 (이전 weak_score vs 현재)
  - 한 라인 sparkline 또는 막대 ]
[ 액션 그룹:
  - "더 학습하기" (주 버튼, indigo)
  - "오늘은 여기까지" (보조 버튼, gray) ]
```

**중요 요구**:

- 정답률을 강조하되 **percentage 자체만 큰 글씨** (전체 결과 영역에 그라디언트 X)
- streak 갱신은 단순한 숫자 변화 표시. **트로피/배지 X**.
- 약점 영역 sparkline은 indigo 단색 (다색 X)

### 3.5 ProgressVisualization — 진도 시각화 컴포넌트

**역할**: /study 페이지 사이드바 또는 별도 페이지에서 진도 종합 시각화. 기존 `ProgressSummary.tsx`의 확장.

**구조**:

```
[ section: 오늘
  - 일일 목표 진척 원형 (indigo-600 stroke, gray-100 배경)
  - "7 / 15" 중앙 텍스트
  - 옆에 "53%" 보조 ]
[ section: 스트릭
  - 현재 streak + 최장 streak
  - 7일 미니 히트맵 (학습한 날 indigo-600, 안 한 날 gray-100) ]
[ section: 마스터
  - 과목별 정답률 5개 막대 (Horizontal bar)
  - 각 막대 indigo-600 (단색), gray-100 배경
  - 라벨 좌측 (과목명), 수치 우측 (%) ]
```

**중요 요구**:

- 원형 progress: 1선만 (다중 ring X), `stroke-width: 4px` 권장
- 7일 히트맵은 정사각형 7개 가로 배열 (월간 캘린더 그리드 X — 너무 큼)
- 막대 chart는 horizontal (vertical 막대는 모바일에서 짤림)
- chart 라이브러리는 SVG 직접 그리기 권장 (Recharts/d3 의존성 추가 회피)

---

## 4. AI 디자인 안티패턴 (절대 금지 — 위반 시 결과물 거부)

### 4.1 글로벌 안티패턴 (모든 도메인)

- [ ] 보라/파랑 그라디언트 히어로 텍스트
- [ ] 검은 배경 + 네온 보더 대시보드
- [ ] "Simple. Fast. Powerful." 류 3단어 반복
- [ ] Emoji로 feature 구분 (⚡️🚀✨)
- [ ] 둥근 pill "New" 라벨
- [ ] 하단 거대 CTA 박스 + 그라디언트 배경
- [ ] "Trusted by" 로고 그리드
- [ ] Testimonial + 별 5개 + 아바타
- [ ] 3열 Feature 카드 (아이콘+제목+2줄설명)
- [ ] Lucide + 얕은 box-shadow + 둥근 카드 조합 (SaaS 클론 DNA)
- [ ] 과잉 애니메이션 (hover마다 scale, fade, shine)
- [ ] 스크롤 jacking / 페럴랙스 남발

### 4.2 ThePick 학습 도메인 특화 안티패턴

- [ ] 학습 화면에 "오늘의 명언" 동기부여 박스
- [ ] 진척률을 별/하트/트로피로 표현
- [ ] streak 표시에 폭죽/색종이 애니메이션
- [ ] 정답 시 신호등 색상 (red/yellow/green) 한꺼번에 사용
- [ ] 카드에 그라디언트 배경
- [ ] 모드 선택을 슬라이더 / dial로
- [ ] 학습 화면 하단에 SNS 공유 버튼
- [ ] 광고 형식의 "프리미엄 업그레이드" 띠 배너
- [ ] 랭킹 / leaderboard / 배지 그리드
- [ ] 카지노식 슬롯머신 애니메이션 (정답 시 돌아가는 숫자 등)

### 4.3 마이크로카피 금지 표현

- 형용사 과잉: "혁신적", "차세대", "궁극의", "완벽한", "incredible"
- 격려성 늘림: "잘했어요!", "대단해요!", "당신은 천재!"
- 영어 혼용: "Great job!", "Awesome!"
- 늘인 표현: "정답입니다!" → **"정답"** 한 단어로 충분

### 4.4 톤 가이드 (반드시 준수)

- 평서체 짧게: "만듭니다" → "만든다", "~이다"
- 명사·동사 위주. 형용사 최소.
- 숫자/단위 명확: "5/10" / "30%" / "12분" (절대 "약 12분 정도" 같이 늘이지 말 것)
- 시간은 24시간제: "12:34" (절대 "오후 12시 34분"으로 늘이지 말 것)

---

## 5. 도메인 컨텍스트 (디자인 결정 시 참조)

### 5.1 사용자 행동 (학습 단일 세션 흐름)

```
1. /study 페이지 진입
2. ModeSelector — 4 mode 중 선택 (or 서버 추천 모드 자동 선택)
3. SessionStart — 일일 목표 / streak / 예상 시간 확인 → 시작
4. QuestionCard 반복 (10-30 카드)
   - 문제 보고 → 입력 → 채점 → 결과 확인 → 다음 문제
   - 4 input type 중 문제별로 다름
5. SessionSummary — 결과 요약 + 다음 추천
6. /study 페이지로 돌아감 (ProgressVisualization 업데이트 반영)
```

### 5.2 출처 추적성 (★ 1급 surface)

모든 학습 콘텐츠는 **출처를 surface 가능**해야 한다:

- 교재 페이지 번호 (예: p.234)
- 법조문 (예: 농업재해보험법 제8조)
- 기출 문항 (예: 2024년 제10회 제3문)
- 관련 지식 노드 (Graph RAG 기반 — 관련 개념/공식/판례)

→ QuestionCard.result 영역에 **항상 노출**. footer로 밀어내지 말 것.
→ "관련 자료" (graph related nodes)만 `<details>` 토글 가능.

### 5.3 FSRS (간격반복) 컨텍스트

- 카드별 다음 복습 일자가 자동 계산됨 (사용자에게는 노출 X — 단순화)
- weak_score: 약점 영역 점수 (사용자에게는 "약점 복습" 모드로 surface)
- streak: 연속 학습일 — 사용자 동기부여 핵심 (★ 단, 부정 강조 X)

### 5.4 모바일 80% 컨텍스트

- 한국 수험생 80% 모바일 학습 (지하철, 카페, 집)
- 한 손 엄지 사용 비중 높음 → 주 액션 하단 60% 영역
- 짧은 세션 (5-10분) 빈도 높음 → 진입/종료 빠름이 핵심
- 가로 스크롤 절대 금지 (모바일에서 가로 스크롤 = 사용 포기)

---

## 6. 출력 요구 사항

### 6.1 형식

- **PNG mockup** (375px / 768px / 1280px 3 크기 각 안마다)
- **Tailwind class 힌트** (가능 시 — 텍스트 사이드 노트 또는 별도 파일)
- (옵션) Figma 링크 (제공 시 환영하나 필수 아님)

### 6.2 컴포넌트별 출력

5 컴포넌트 × 3 안 (A/B/C) × 3 viewport (375/768/1280) = **총 45 mockup**

만약 viewport별 차이가 거의 없다면 mobile (375) + desktop (1280) 2개만으로도 가능.

### 6.3 추가 자료 (선택)

- 토큰 매핑표 (Figma → Tailwind 변환)
- 컴포넌트 간 일관성 노트 (예: "QuestionCard와 SessionStart의 header padding 통일")
- 마이크로카피 변형 제안 (위 §4.4 톤 가이드 준수)

---

## 7. 평가 기준 (진산 lock 시 판단)

각 안에 대해 다음 기준으로 평가:

1. **§2 토큰 준수**: 색상/타이포/모서리/보더가 위반 없는가
2. **§3 5 컴포넌트 명세 충족**: 각 컴포넌트가 의도대로 구성되었는가
3. **§4 안티패턴 회피**: 금기 항목 0건
4. **§5 도메인 정합**: 출처 surface / 모바일 first / 학습 흐름 자연스러움
5. **3안 차별성**: A/B/C가 서로 의미 있게 다른가 (밀도/구조/관습 깨기)
6. **모바일 우선 작동**: 375px에서 100% 작동
7. **44px touch target**: 모든 인터랙티브 요소

---

## 8. 통합 절차 (RFP 응답 수령 후)

진산 → Claude Design 응답 수령 → Claude Code 통합 절차:

1. 진산이 3안 (A/B/C) 중 lock 결정 (or "A 기본 + C의 X 요소" 같이 조합 지시)
2. Claude Code가 lock된 안을 Tailwind/React 코드화
3. AESTHETIC.md (`docs/design/AESTHETIC.md`) 갱신 — 새로 발견된 토큰/패턴 누적
4. Step 3-UX-6b (4 input type) → 6c (mode 생명주기) → 6d (progress viz) → 6e (검증) 진입
5. 4-Pass + 5-페르소나 부채 리뷰 (Phase 3 종료 게이트 정합)

---

## 9. 부록: Phase 2 baseline 참조

QuestionCard.tsx 현재 구조 (Phase 2 Eval MVP):

- 단일 textarea input (4 input type 분기 없음)
- header (출처 + 과목 pill) + body (문제) + input + 액션 + result
- result 영역에 정답/해설/교재 출처/법조문/관련 자료 표시
- 채점 결과 시 emerald pill (정답) 또는 amber pill (오답)
- bg-gray-50 result 영역 분리

Step 3-UX-6은 이 baseline을 확장 (4 input type 분기 + 모드 생명주기 + progress viz 분리).

---

# RFP 끝
