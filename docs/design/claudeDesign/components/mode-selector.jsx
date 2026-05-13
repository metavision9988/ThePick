// ModeSelector — A / B / C
// 4 modes: warmup / main / cooldown / review_weak
// Color hint: left 1px border only, no full-card tint.

const MODE_DATA = [
  { ...MODES.warmup,      mins: 8,  cards: 10, recommended: false },
  { ...MODES.main,        mins: 18, cards: 15, recommended: true  },
  { ...MODES.cooldown,    mins: 5,  cards: 6,  recommended: false },
  { ...MODES.review_weak, mins: 12, cards: 8,  recommended: false, weakAreas: 3 },
];

function RecommendPill() {
  return <Pill tone="accent">추천</Pill>;
}

function MetaRow({ mins, cards, className = '' }) {
  return (
    <div className={`flex items-center gap-3 text-xs text-gray-500 ${className}`}>
      <span className="inline-flex items-center gap-1"><Icon.Clock width="12" height="12" />{mins}분</span>
      <span className="text-gray-300">·</span>
      <span className="inline-flex items-center gap-1"><Icon.Stack width="12" height="12" />{cards}문제</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// A — Textbook. 세로 stack, 1 카드 1행, 좌측 1px 컬러 보더.
// ─────────────────────────────────────────────────────────────────────────
function ModeSelectorA() {
  return (
    <div>
      <header className="mb-5">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">학습 시작</div>
        <h1 className="tp-tight text-2xl font-medium text-gray-900 mt-1">오늘은 어떻게 학습할까요</h1>
      </header>

      <ul className="space-y-3">
        {MODE_DATA.map((m) => (
          <li key={m.id}>
            <button
              className="w-full text-left rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors px-5 py-4 flex items-start gap-4"
              style={{ borderLeft: `2px solid ${m.color}`, minHeight: 44 }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-gray-900">{m.label}</span>
                  {m.recommended && <RecommendPill />}
                </div>
                <p className="tp-body text-sm text-gray-500 mt-1">{m.hint}</p>
                <MetaRow mins={m.mins} cards={m.cards} className="mt-2" />
              </div>
              <span className="text-gray-400 mt-1 flex-none"><Icon.Chevron /></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// B — Density. 2x2 grid (모바일도 2열), 메타를 하단 1줄로 합쳐 행수 ↓.
// ─────────────────────────────────────────────────────────────────────────
function ModeSelectorB() {
  return (
    <div>
      <header className="mb-4 flex items-end justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">학습 시작</div>
          <h1 className="tp-tight text-2xl font-medium text-gray-900 mt-1">모드 선택</h1>
        </div>
        <span className="text-xs text-gray-500">7 / 15 · 오늘</span>
      </header>

      <ul className="grid grid-cols-2 gap-2">
        {MODE_DATA.map((m) => (
          <li key={m.id}>
            <button
              className="relative w-full h-full text-left rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors px-4 py-3"
              style={{ borderLeft: `2px solid ${m.color}`, minHeight: 96 }}
            >
              {m.recommended && (
                <span className="absolute top-2 right-2"><RecommendPill /></span>
              )}
              <div className="text-[15px] font-medium text-gray-900">{m.label}</div>
              <p className="tp-body text-[12px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{m.hint}</p>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500 tabular-nums">
                <span>{m.mins}분</span>
                <span className="text-gray-300">·</span>
                <span>{m.cards}문제</span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">오늘 추천</div>
        <p className="tp-body text-sm text-gray-900 mt-1">본 학습 — FSRS 큐에 오늘 풀어야 할 카드 15개가 쌓였다.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// C — Radical. 관습 깨기:
//   "수직 타임라인" 메타포 — 4 모드를 학습 강도 순서(워밍업→본→약점→쿨다운)
//   대신 "오늘의 흐름" 으로 배치. 각 모드가 leftmost 점으로 연결.
//   안티패턴 어느 것도 위반하지 않음 (그라디언트 X, 트로피 X, 1page 1색).
// ─────────────────────────────────────────────────────────────────────────
function ModeSelectorC() {
  const ordered = [
    MODE_DATA.find(m => m.id === 'warmup'),
    MODE_DATA.find(m => m.id === 'main'),
    MODE_DATA.find(m => m.id === 'review_weak'),
    MODE_DATA.find(m => m.id === 'cooldown'),
  ];
  return (
    <div>
      <header className="mb-5">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">오늘의 흐름</div>
        <h1 className="tp-tight text-2xl font-medium text-gray-900 mt-1">시작 지점을 고르세요</h1>
        <p className="tp-body text-sm text-gray-500 mt-2">이전 단계는 건너뛸 수 있다. 추천 단계는 본 학습이다.</p>
      </header>

      <ol className="relative">
        {/* spine */}
        <div className="absolute left-[11px] top-3 bottom-3 w-px bg-gray-200" />
        {ordered.map((m, i) => (
          <li key={m.id} className="relative pl-8 pb-3 last:pb-0">
            <span
              className="absolute left-[6px] top-4 w-[11px] h-[11px] rounded-full bg-white"
              style={{ boxShadow: `inset 0 0 0 2px ${m.color}` }}
            />
            <button
              className="w-full text-left rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-3 flex items-center gap-3"
              style={{ minHeight: 60 }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono text-gray-400 tabular-nums">0{i+1}</span>
                  <span className="text-base font-medium text-gray-900">{m.label}</span>
                  {m.recommended && <RecommendPill />}
                </div>
                <p className="tp-body text-[13px] text-gray-500 mt-0.5">{m.hint}</p>
              </div>
              <div className="flex-none text-right text-[12px] text-gray-500 tabular-nums">
                <div>{m.mins}분</div>
                <div className="text-gray-400">{m.cards}문제</div>
              </div>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

Object.assign(window, { ModeSelectorA, ModeSelectorB, ModeSelectorC });
