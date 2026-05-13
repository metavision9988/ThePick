# ThePick — AESTHETIC.md (프로젝트 디자인 토큰)

> 본 파일은 글로벌 `~/.claude/AESTHETIC.md`를 **상속**한다.
> 글로벌 항목 (1페이지 1강조색, 3-Variant A/B/C 의무, AI 안티패턴 체크리스트 등) 모두 적용된다.
> 본 파일은 **ThePick 고유 토큰**만 누적한다.
> 누적만, 삭제 금지 (글로벌 규칙 §"갱신 규칙").

---

## 1. 프로젝트 정체성

- **이름**: 쪽집게(ThePick)
- **도메인**: 손해평가사 자격시험(1차+2차) AI 학습 PWA
- **사용자**: 한국인 수험생, 모바일 80% / 데스크탑 20%
- **북극성**: "생성물 신뢰성·정확성" (출처 surface UX 1급 기능)
- **분위기**: 시험 공부 — 진지함 / 신뢰감 / 몰입 (게이미피케이션은 표준 강도, 부정 강조 금지)

## 2. lock된 디자인 방향 (Phase 2 baseline)

다음은 Phase 2 Eval MVP에서 **진산 lock된 방향**이다. 본 방향을 위반하는 변경은 금지.

### 2.1 카드 스타일

- **Linear-style 1단 카드** (다열 X, 그라디언트 X)
- `rounded-lg` (rx=8) — 카드 외곽
- `border border-gray-200` — 0.5px 느낌의 얇은 보더
- `bg-white` — 카드 배경 순백 가까이 (`#ffffff` 또는 `gray-50` 배경 위)
- 그림자 최소 사용. 사용 시 `shadow-sm` 이상 금지.

### 2.2 색상 토큰

| 역할           | Tailwind                                                                                                     | 용도                                         |
| :------------- | :----------------------------------------------------------------------------------------------------------- | :------------------------------------------- |
| 주 (primary)   | `indigo-600` (`#4f46e5`)                                                                                     | CTA 버튼, 정확도 강조, 링크                  |
| 주 (deep)      | `indigo-800` (`#1e40af`)                                                                                     | PWA `theme-color` 메타                       |
| 강조 (accent)  | `amber-500` / `amber-100`                                                                                    | 오답 표시 pill, 보조 강조 (1페이지 1회 이하) |
| 성공 (success) | `emerald-100` + `emerald-900` text                                                                           | 정답 표시 pill                               |
| 위험 (error)   | `red-50` + `red-200` border + `red-900` text                                                                 | 에러 박스                                    |
| 회색 9단       | `gray-50` ~ `gray-900`                                                                                       | 텍스트/보더/배경 위계                        |
| 회색 활용      | `gray-500` (label dt) / `gray-900` (값 dd) / `gray-700` (본문 보조) / `gray-100`/`gray-200` (보더/separator) | dl-dt-dd 패턴 일관                           |

**1페이지 1강조색 원칙 유지** — Indigo 외에 Amber 사용은 한 화면에 한 곳만 (예: 오답 pill).

### 2.3 타이포그래피

- **본문 / 한글**: Pretendard (Korean-optimized)
- **제목 (h1)**: `text-2xl font-medium text-gray-900` (font-bold 금지, font-medium만)
- **헤더 라벨**: `text-xs font-medium uppercase tracking-wide text-gray-500`
- **본문**: `text-base leading-relaxed text-gray-900`
- **보조**: `text-sm text-gray-500`
- **마이크로**: `text-xs text-gray-500` (sidebar 라벨, footer)
- **데이터 값**: `text-base font-medium text-gray-900` (정수/카운트)
- **수치 강조**: `text-base font-medium text-indigo-600` (정확도 %)

**font-weight**: 400 (regular) 또는 500 (medium). **bold (700) 금지**.

### 2.4 레이아웃

- `max-w-[1280px]` — 본문 컨테이너 최대 너비
- `mx-auto px-4 py-8` — 외곽 패딩
- 데스크탑 사이드바: `lg:w-[180px]` (글로벌 권고 220px보다 좁게 — 학습 페이지는 진도 surface만)
- 본문 영역: `lg:max-w-[720px]` (행당 한글 ~40자 보장)
- 모서리: `rounded-lg` (rx=8) 또는 `rounded-full` (pill). **그 외 (rounded-xl/2xl) 금지**.

### 2.5 모바일 — Touch Target

- 모든 인터랙티브 요소: `min-height: 44px; min-width: 44px;` (이미 BaseLayout global style)
- 모바일 우선 (`base` Tailwind 클래스가 mobile, `lg:` 이후가 데스크탑)
- 작은 화면 미디어쿼리: `@media (max-width: 360px)` 시 `font-size: 14px`

### 2.6 카드 내부 구조 (QuestionCard 패턴)

```
<article rounded-lg border border-gray-200 bg-white>
  <header border-b border-gray-100 px-6 py-4> ... 메타 (출처/과목) ... </header>
  <div px-6 py-6> ... 본문 ... </div>
  <div border-t border-gray-100 px-6 py-5> ... 입력 / 액션 ... </div>
  <section border-t border-gray-100 bg-gray-50 px-6 py-5> ... 결과 / 보충 ... </section>
</article>
```

- 섹션 구분: `border-t border-gray-100` (얇은 회색선)
- 결과 영역만 `bg-gray-50` (대비)
- 내부 padding: `px-6 py-{4|5|6}` (수직만 변동)

### 2.7 인풋 / 버튼

- 텍스트 입력: `rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed text-gray-900`
  - focus: `focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200`
  - disabled: `disabled:bg-gray-50 disabled:text-gray-500`
- 주 버튼: `rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-300`
- 보조 버튼: `rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50`

### 2.8 라벨 / 상태 (pill)

- 정답: `rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900`
- 오답: `rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900`
- 과목: `rounded-full bg-gray-100 px-2 py-0.5 text-gray-700`
- 노드 타입 (메타): `rounded bg-gray-200 px-1.5 py-0.5 font-mono text-gray-700`

## 3. ThePick 고유 디자인 규칙 (글로벌 + 추가)

### 3.1 출처 추적성 UX 1급 (★ 북극성)

memory `project_source_citation_requirement.md` 정합 — 모든 학습 콘텐츠는 **출처 surface 가능 해야 한다**.

- 정답/해설/풀이/오답 후보는 **교재 페이지 / 법조문 / 기출 문항**을 명시
- "근거 보기" 토글이 1급 UX 기능 (숨기지 말 것)
- 출처 영역은 `dl-dt-dd` 패턴 사용, 절대 footer로 밀어내지 말 것
- 데이터 형식 예시:
  ```
  <dt>교재 출처</dt>  <dd>p.234 · p.567</dd>
  <dt>법조문</dt>     <dd>농업재해보험법 제8조</dd>
  <dt>기출</dt>       <dd>2024년 제10회 제3문</dd>
  ```

### 3.2 게이미피케이션 — 표준 강도 (부정 강조 X)

memory `project_ux_north_star_phase3.md` + plan §6.5 정합:

- **streak (연속 학습일)**: 표시 OK, 숫자 + 불꽃 아이콘 (lucide `flame` 권장)
- **일일 목표 진척**: 표시 OK, 막대/원형 progress
- **마스터 (정답률 추이)**: 표시 OK, sparkline 또는 막대 chart
- **금지**: 랭킹 보드, leaderboard, 별점, 트로피, 배지 그리드 → **부정 강조 인상 → 시험 도메인 부적합**

### 3.3 학습 모드 (4 mode) 시각 위계

`/api/study/mode`에서 반환되는 4 mode:

| Mode          | 의미                        | 권고 색상 (1 mode 1 hint) |
| :------------ | :-------------------------- | :------------------------ |
| `warmup`      | 워밍업 (쉬운 카드 우선)     | gray (중성)               |
| `main`        | 본 학습 (FSRS 큐)           | indigo-600 (주)           |
| `cooldown`    | 쿨다운 (난이도 ↓ 회복)      | emerald (차분)            |
| `review_weak` | 약점 복습 (weak_score 높음) | amber (주의)              |

- Mode 카드 4개: 같은 카드 톤 + **좌측 1px 컬러 보더**로 mode 구분 (전체 배경 컬러 X)

### 3.4 학습 단계 (phase) 표현

세션 내부 phase: `warmup / main / cooldown / completed`

- 세그먼트 progress bar로 표현 (예: `▓▓▓░░░░░░░ 30%` 분할)
- 색상은 위 mode 색상 활용
- 텍스트는 평서체 짧게: "워밍업 3/10" / "본 학습 5/15" / "쿨다운 2/8" / "완료"

### 3.5 4 input type 시각 위계

문제 형식별 입력 UX:

| Input type        | 입력 컴포넌트                                                 | 키보드 단축키 |
| :---------------- | :------------------------------------------------------------ | :------------ |
| `multiple-choice` | 라디오 카드 5개 (① ~ ⑤) — 큰 터치 영역, 셔플 시드 결정성 표시 | 1-5 숫자 키   |
| `fill-blank`      | 단일 라인 `<input>` — placeholder "정답 입력"                 | Enter 채점    |
| `essay`           | `<textarea rows={5}>` — self-grade 라디오 (맞음/모름/틀림)    | Ctrl+Enter    |
| `calc`            | `<input type="number">` + 단위 보조 라벨                      | Enter 채점    |

- **항상 1단 카드 안에 배치** (다열/스플릿 X)
- 키보드 단축키 hint는 버튼 라벨에 `(Ctrl+Enter)` 형태로 표기 (Linear 패턴)

### 3.6 한국어 톤 (마이크로카피)

글로벌 §"자주 쓰는 톤" 상속 + 추가:

- 평서체 짧게: "정답입니다" 보다 "정답"
- 격려는 절제: "잘 했어요!" 같은 표현 금지. "정답" / "오답" / "넘어감"으로 충분
- 메타 라벨은 명사 위주: "교재 출처" / "법조문" / "관련 자료" / "오늘의 학습"
- 시간 표현: "12:34" (24시간제) — "오후 12시 34분" 금지
- 진척 표현: "5/10" / "30%" — "5개 중 5개 완료" 같이 늘이지 말 것

## 4. AI 디자인 안티패턴 (ThePick 특화 추가)

글로벌 안티패턴 체크리스트 (보라/파랑 그라디언트, 3열 Feature, "Trusted by" 로고, Emoji feature 등) 모두 적용 + 추가:

- [ ] 학습 화면에 "오늘의 명언" 같은 동기부여 박스?
- [ ] 진척률을 별/하트/트로피로 표현?
- [ ] streak 표시에 폭죽/색종이 애니메이션?
- [ ] 정답 시 신호등 색상 (red/yellow/green) 한꺼번에 사용?
- [ ] 카드에 그라디언트 배경?
- [ ] 모드 선택을 슬라이더 / dial로?
- [ ] 학습 화면 하단에 SNS 공유 버튼?
- [ ] 광고 형식의 "프리미엄 업그레이드" 띠 배너?

해당 2개 이상 → 작업 중단, AESTHETIC.md + Phase 2 베이스라인 재확인.

## 5. 3-Variant 출력 의무 (글로벌 상속)

모든 새 화면 디자인은 **A / B / C 3안 동시 제출**:

- **A (교과서)**: Phase 2 QuestionCard와 가장 유사한 베이스라인 충실
- **B (밀도)**: A 대비 30% 정보 밀도 증가 (예: progress + streak을 같은 row에 합치기)
- **C (급진)**: 관습 1개 의도적으로 깨뜨림 (예: 모드 선택을 카드가 아닌 segmented control로)

혼자 있는 1안 제출 금지.

## 6. 갱신 규칙

- 본 파일은 누적만. 기존 항목 삭제 금지 (글로벌 규칙 상속).
- 새 컴포넌트 lock 시 §2 / §3에 토큰 추가.
- Phase 종료 시 글로벌 `~/.claude/AESTHETIC.md`에 ThePick에서 발견한 일반화 가능한 취향 항목 역류 가능 (예: "학습 도메인은 게이미피케이션 부정 강조 X").

---

# 참조

- 글로벌: `~/.claude/AESTHETIC.md` (반드시 먼저 읽기)
- Plan: `docs/plans/phase3-learning-ux-modes.plan.md` §5 "디자인 A 채택" (Linear-style 1단 카드)
- Memory: `project_source_citation_requirement.md` / `project_ux_north_star_phase3.md`
- 기존 컴포넌트: `apps/web/src/components/QuestionCard.tsx` (token 추출 원본)
