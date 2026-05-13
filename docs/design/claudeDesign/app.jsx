// Main app — Design Canvas with all variants laid out by component.
// 5 components × A/B/C = 15 mobile artboards, plus a tokens section.

const { useState } = React;

// ─────────────────────────────────────────────────────────────────────────
// Artboard chrome: wraps each component in a near-white mobile screen.
// 375 width baseline. Padding mirrors a real /study page container.
// ─────────────────────────────────────────────────────────────────────────
function MobileFrame({ children, bg = 'bg-gray-50', pad = 'p-4', topbar }) {
  return (
    <div className={`tp-art ${bg} h-full overflow-hidden`}>
      {topbar}
      <div className={pad}>{children}</div>
    </div>
  );
}

function TopBar({ title, sub }) {
  return (
    <div className="px-4 pt-4 pb-2 flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</span>
      {sub && <span className="text-xs text-gray-400">· {sub}</span>}
    </div>
  );
}

// Token swatch (Colors section)
function Swatch({ name, hex, twClass }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex-none border border-gray-200" style={{ background: hex }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-900 truncate">{name}</div>
        <div className="text-[10px] text-gray-500 font-mono truncate">{twClass}</div>
      </div>
      <div className="text-[10px] text-gray-500 font-mono tabular-nums flex-none">{hex}</div>
    </div>
  );
}

function TokensColor() {
  const colors = [
    { name: '주 primary',         hex: '#4f46e5', twClass: 'indigo-600' },
    { name: '주 deep (PWA)',      hex: '#1e40af', twClass: 'indigo-800' },
    { name: '강조 accent',        hex: '#f59e0b', twClass: 'amber-500'  },
    { name: '강조 배경',          hex: '#fef3c7', twClass: 'amber-100'  },
    { name: '성공 배경',          hex: '#d1fae5', twClass: 'emerald-100'},
    { name: '성공 텍스트',        hex: '#064e3b', twClass: 'emerald-900'},
    { name: '위험 배경',          hex: '#fef2f2', twClass: 'red-50'     },
    { name: '위험 보더',          hex: '#fecaca', twClass: 'red-200'    },
    { name: '본문 텍스트',        hex: '#111827', twClass: 'gray-900'   },
    { name: '보조 텍스트',        hex: '#6b7280', twClass: 'gray-500'   },
    { name: '보더 (카드)',        hex: '#e5e7eb', twClass: 'gray-200'   },
    { name: '보더 (구분선)',      hex: '#f3f4f6', twClass: 'gray-100'   },
    { name: '배경 near-white',    hex: '#f9fafb', twClass: 'gray-50'    },
    { name: '카드 배경',          hex: '#ffffff', twClass: 'white'      },
  ];
  return (
    <div className="tp-art p-5 bg-white h-full">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Colors</div>
      <h2 className="tp-tight text-lg font-medium text-gray-900 mb-4">색상 토큰</h2>
      <div className="space-y-2.5">
        {colors.map((c, i) => <Swatch key={i} {...c} />)}
      </div>
      <p className="tp-body text-[11px] text-gray-500 mt-4 leading-relaxed">
        1페이지 = 1강조색. Amber 는 한 화면 한 곳만. 그라디언트 금지.
      </p>
    </div>
  );
}

function TokensType() {
  return (
    <div className="tp-art p-5 bg-white h-full">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Typography</div>
      <h2 className="tp-tight text-lg font-medium text-gray-900 mb-4">Pretendard 400 / 500</h2>

      <div className="space-y-4">
        <div className="border-b border-gray-100 pb-3">
          <div className="text-2xl font-medium text-gray-900 tp-tight">제목 · text-2xl 500</div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">h1 · 24/29 · tracking-normal</div>
        </div>
        <div className="border-b border-gray-100 pb-3">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">헤더 라벨 · text-xs UPPER</div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">section label · 12/16 · tracking-wide</div>
        </div>
        <div className="border-b border-gray-100 pb-3">
          <div className="tp-body text-base text-gray-900">본문 텍스트는 1.7 줄간격으로 한 줄에 한글 35~45자가 들어오도록 한다.</div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">text-base · leading-relaxed (1.7) · gray-900</div>
        </div>
        <div className="border-b border-gray-100 pb-3">
          <div className="text-sm text-gray-500">보조 텍스트 · 출처/메타 정보</div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">text-sm · gray-500</div>
        </div>
        <div className="border-b border-gray-100 pb-3">
          <div className="text-base font-medium text-indigo-600 tabular-nums">7 / 15 · 47%</div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">수치 강조 · text-base 500 · indigo-600</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">마이크로 · 단축키 ⌃Enter</div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">text-xs · gray-500</div>
        </div>
      </div>

      <p className="tp-body text-[11px] text-gray-500 mt-4 leading-relaxed">
        font-weight 400 / 500 만 사용. 700 (bold) 금지.
      </p>
    </div>
  );
}

function TokensComponents() {
  return (
    <div className="tp-art p-5 bg-white h-full">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Pills & buttons</div>
      <h2 className="tp-tight text-lg font-medium text-gray-900 mb-4">상태 토큰</h2>

      <div className="space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-medium mb-2">결과 pill</div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="correct">정답</Pill>
            <Pill tone="wrong">오답</Pill>
            <Pill tone="accent">신기록</Pill>
            <Pill tone="accent">추천</Pill>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-medium mb-2">과목 pill</div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="subject">농업재해보험</Pill>
            <Pill tone="subject">농작물재해보험</Pill>
            <Pill tone="subject">가축재해보험</Pill>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-medium mb-2">메타 tag (mono)</div>
          <div className="flex flex-wrap gap-2">
            <MetaTag>CONCEPT</MetaTag>
            <MetaTag>FORMULA</MetaTag>
            <MetaTag>LAW</MetaTag>
            <MetaTag>TABLE</MetaTag>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-medium mb-2">버튼</div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">주 버튼</button>
            <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900">보조</button>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-medium mb-2">텍스트 입력</div>
          <input type="text" placeholder="단답형 입력" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" style={{ minHeight: 44 }} />
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 font-medium mb-2">모서리</div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg w-12 h-12 border border-gray-300 bg-white" />
            <div className="text-xs text-gray-500">
              <div className="font-mono">rounded-lg (8px)</div>
              <div className="font-mono">rounded-full (pill)</div>
              <div className="text-red-700 font-mono line-through opacity-70">rounded-xl/2xl 금지</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Anti-pattern card (text-only). Lives next to tokens.
function AntiPatterns() {
  const items = [
    '보라/파랑 그라디언트 히어로',
    '검은 배경 + 네온 보더',
    '"Simple. Fast. Powerful." 류 3단어 반복',
    'Emoji feature 구분 (⚡️🚀✨)',
    '하단 거대 CTA 박스 + 그라디언트',
    '진척률을 별/하트/트로피로',
    'streak 폭죽 / 색종이 애니메이션',
    '정답 신호등 색상 (red/yellow/green)',
    '카드 그라디언트 배경',
    '모드 선택 슬라이더 / dial',
    '랭킹 / leaderboard / 배지 그리드',
    '"잘했어요!" "Awesome!" 격려 카피',
  ];
  return (
    <div className="tp-art p-5 bg-white h-full">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Anti-patterns</div>
      <h2 className="tp-tight text-lg font-medium text-gray-900 mb-4">절대 금지 (RFP §4)</h2>
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-gray-700 tp-body">
            <span className="text-red-700 mt-0.5 flex-none"><Icon.X width="13" height="13" /></span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <p className="tp-body text-[11px] text-gray-500 mt-4 leading-relaxed">
        톤: 평서체, 명사·동사 위주. "정답입니다!" → "정답".
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Notes panel — Selection guide. Stays at top of canvas.
// ─────────────────────────────────────────────────────────────────────────
function NotesCard() {
  return (
    <div className="tp-art p-5 bg-white h-full">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">RFP 응답</div>
      <h2 className="tp-tight text-lg font-medium text-gray-900 mb-3">선택 가이드</h2>
      <dl className="space-y-3 text-[13px] tp-body text-gray-700">
        <div>
          <dt className="text-gray-900 font-medium">A · 교과서</dt>
          <dd className="text-gray-600 mt-0.5">Phase 2 baseline 확장. 세로 stack, 명확한 섹션 분리. 안전 선택지.</dd>
        </div>
        <div>
          <dt className="text-gray-900 font-medium">B · 밀도</dt>
          <dd className="text-gray-600 mt-0.5">동일 row 합치기, 메타 inline. 모바일 한 화면 정보량 ↑.</dd>
        </div>
        <div>
          <dt className="text-gray-900 font-medium">C · 급진</dt>
          <dd className="text-gray-600 mt-0.5">관습 1개 의도적으로 깨뜨림. 안티패턴은 0건 유지.</dd>
        </div>
      </dl>
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="text-[10px] uppercase tracking-wide font-medium text-gray-500 mb-1">진산 lock 후</div>
        <p className="text-[12px] text-gray-600 tp-body">"A 기본 + C 의 X 요소" 같이 조합 지시도 가능. Claude Code 가 Tailwind/React 코드화.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main canvas
// ─────────────────────────────────────────────────────────────────────────
const W = 375; // mobile baseline

function App() {
  return (
    <DesignCanvas>
      <DCSection
        id="intro"
        title="ThePick · Step 3-UX-6"
        subtitle="학습 UX 5 컴포넌트 시각 3안 · 모바일 375px baseline · Pretendard 400/500"
      >
        <DCArtboard id="notes" label="선택 가이드" width={300} height={360}>
          <NotesCard />
        </DCArtboard>
        <DCArtboard id="anti" label="안티패턴" width={300} height={460}>
          <AntiPatterns />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="tokens"
        title="Design Tokens"
        subtitle="RFP §2 lock 토큰 · 색상 / 타이포 / 컴포넌트"
      >
        <DCArtboard id="tk-color" label="Colors" width={320} height={680}>
          <TokensColor />
        </DCArtboard>
        <DCArtboard id="tk-type" label="Typography" width={320} height={560}>
          <TokensType />
        </DCArtboard>
        <DCArtboard id="tk-comp" label="Components" width={320} height={680}>
          <TokensComponents />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="question"
        title="QuestionCard"
        subtitle="§3.1 · 4 input type 분기 · graded multiple-choice 상태"
      >
        <DCArtboard id="q-a" label="A · 교과서" width={W} height={900}>
          <MobileFrame topbar={<TopBar title="문제 · 7 / 15" sub="본 학습" />}>
            <QuestionCardA />
          </MobileFrame>
        </DCArtboard>
        <DCArtboard id="q-b" label="B · 밀도" width={W} height={860}>
          <MobileFrame topbar={<TopBar title="문제 · 7 / 15" sub="본 학습" />}>
            <QuestionCardB />
          </MobileFrame>
        </DCArtboard>
        <DCArtboard id="q-c" label="C · 급진" width={W} height={860}>
          <MobileFrame topbar={<TopBar title="문제" sub="진척 inline" />}>
            <QuestionCardC />
          </MobileFrame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="input-types"
        title="QuestionCard · 4 input type"
        subtitle="동일 카드 외곽 유지 · 같은 카드 안에서 type 만 변동"
      >
        <DCArtboard id="it-mc"    label="multiple-choice" width={W} height={520}>
          <MobileFrame topbar={<TopBar title="MULTIPLE_CHOICE" sub="① ② ③ ④ ⑤ · 1-5 키" />}>
            <InputTypeCard type="multiple-choice" />
          </MobileFrame>
        </DCArtboard>
        <DCArtboard id="it-fb"    label="fill-blank" width={W} height={420}>
          <MobileFrame topbar={<TopBar title="FILL_BLANK" sub="단답형 · Enter 채점" />}>
            <InputTypeCard type="fill-blank" />
          </MobileFrame>
        </DCArtboard>
        <DCArtboard id="it-es"    label="essay" width={W} height={560}>
          <MobileFrame topbar={<TopBar title="ESSAY" sub="서술형 · self-grade" />}>
            <InputTypeCard type="essay" />
          </MobileFrame>
        </DCArtboard>
        <DCArtboard id="it-calc"  label="calc" width={W} height={420}>
          <MobileFrame topbar={<TopBar title="CALC" sub="수치 · 단위 자동 부착" />}>
            <InputTypeCard type="calc" />
          </MobileFrame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="mode"
        title="ModeSelector"
        subtitle="§3.2 · 4 학습 모드 · 좌측 1px 컬러 보더 · 추천 amber pill"
      >
        <DCArtboard id="m-a" label="A · 교과서" width={W} height={620}>
          <MobileFrame topbar={<TopBar title="/study" sub="모드 선택" />}>
            <ModeSelectorA />
          </MobileFrame>
        </DCArtboard>
        <DCArtboard id="m-b" label="B · 밀도 (2×2)" width={W} height={500}>
          <MobileFrame topbar={<TopBar title="/study" sub="모드 선택" />}>
            <ModeSelectorB />
          </MobileFrame>
        </DCArtboard>
        <DCArtboard id="m-c" label="C · 수직 타임라인" width={W} height={560}>
          <MobileFrame topbar={<TopBar title="/study" sub="오늘의 흐름" />}>
            <ModeSelectorC />
          </MobileFrame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="start"
        title="SessionStart"
        subtitle="§3.3 · 모드 선택 직후 · 일일 목표 / 예상 / streak"
      >
        <DCArtboard id="s-a" label="A · 교과서" width={W} height={680}>
          <MobileFrame topbar={<TopBar title="세션 시작" sub="본 학습" />}>
            <SessionStartA />
          </MobileFrame>
        </DCArtboard>
        <DCArtboard id="s-b" label="B · 밀도" width={W} height={560}>
          <MobileFrame topbar={<TopBar title="세션 시작" sub="본 학습" />}>
            <SessionStartB />
          </MobileFrame>
        </DCArtboard>
        <DCArtboard id="s-c" label="C · hero 숫자 + 엄지존" width={W} height={680}>
          <MobileFrame topbar={<TopBar title="세션 시작" sub="본 학습" />}>
            <SessionStartC />
          </MobileFrame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="summary"
        title="SessionSummary"
        subtitle="§3.4 · 세션 종료 · 정답률 · streak 갱신 · 약점 변화"
      >
        <DCArtboard id="su-a" label="A · 교과서" width={W} height={760}>
          <MobileFrame topbar={<TopBar title="결과" sub="세션 12 / 15" />}>
            <SessionSummaryA />
          </MobileFrame>
        </DCArtboard>
        <DCArtboard id="su-b" label="B · 밀도" width={W} height={620}>
          <MobileFrame topbar={<TopBar title="결과" sub="세션 12 / 15" />}>
            <SessionSummaryB />
          </MobileFrame>
        </DCArtboard>
        <DCArtboard id="su-c" label="C · 약점 변화 우선" width={W} height={680}>
          <MobileFrame topbar={<TopBar title="결과" sub="다음 추천 inline" />}>
            <SessionSummaryC />
          </MobileFrame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="progress"
        title="ProgressVisualization"
        subtitle="§3.5 · 오늘 / 스트릭 / 마스터 — SVG 직접, 단색 indigo"
      >
        <DCArtboard id="p-a" label="A · 교과서 (3 카드)" width={W} height={680}>
          <MobileFrame topbar={<TopBar title="/study" sub="진도" />}>
            <ProgressVizA />
          </MobileFrame>
        </DCArtboard>
        <DCArtboard id="p-b" label="B · 1 카드 통합" width={W} height={560}>
          <MobileFrame topbar={<TopBar title="/study" sub="진도" />}>
            <ProgressVizB />
          </MobileFrame>
        </DCArtboard>
        <DCArtboard id="p-c" label="C · 30일 dot strip" width={W} height={620}>
          <MobileFrame topbar={<TopBar title="/study" sub="진도" />}>
            <ProgressVizC />
          </MobileFrame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="desktop"
        title="데스크탑 참고 (1280)"
        subtitle="모바일 first · 데스크탑은 본문 max-w-[720px] + 사이드바 lg:w-[180px]"
      >
        <DCArtboard id="d-study" label="study 페이지 — A 안 조합" width={1100} height={760}>
          <div className="tp-art bg-gray-50 h-full overflow-hidden">
            <div className="px-8 pt-6 pb-3 border-b border-gray-100 bg-white flex items-center gap-4">
              <span className="text-base font-medium text-gray-900">쪽집게</span>
              <nav className="flex items-center gap-4 text-sm text-gray-500">
                <span className="text-gray-900">학습</span>
                <span>진도</span>
                <span>오답 노트</span>
              </nav>
              <span className="ml-auto text-xs text-gray-500 tabular-nums">5일 연속 · 7/15</span>
            </div>
            <div className="grid grid-cols-[1fr_180px] gap-6 px-8 py-6 h-[calc(100%-57px)] overflow-hidden">
              <div className="max-w-[720px] mx-auto w-full">
                <QuestionCardA />
              </div>
              <aside className="space-y-3">
                <ProgressVizA />
              </aside>
            </div>
          </div>
        </DCArtboard>
        <DCArtboard id="d-mode" label="모드 선택 — B 안 2×4" width={760} height={520}>
          <div className="tp-art bg-gray-50 h-full p-8">
            <div className="max-w-[640px] mx-auto">
              <header className="mb-5">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">학습 시작</div>
                <h1 className="tp-tight text-2xl font-medium text-gray-900 mt-1">모드 선택</h1>
              </header>
              <div className="grid grid-cols-4 gap-3">
                {[MODES.warmup, MODES.main, MODES.cooldown, MODES.review_weak].map((m) => (
                  <button key={m.id} className="text-left rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-4" style={{ borderLeft: `2px solid ${m.color}`, minHeight: 120 }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-medium text-gray-900">{m.label}</span>
                      {m.id === 'main' && <Pill tone="accent">추천</Pill>}
                    </div>
                    <p className="tp-body text-[13px] text-gray-500 mt-1 leading-snug">{m.hint}</p>
                    <div className="mt-2 text-[11px] text-gray-500 tabular-nums">
                      {m.id === 'warmup' ? '8분 · 10문제' : m.id === 'main' ? '18분 · 15문제' : m.id === 'cooldown' ? '5분 · 6문제' : '12분 · 8문제'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
