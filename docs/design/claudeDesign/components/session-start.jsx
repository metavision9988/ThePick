// SessionStart — A / B / C
// 모드 헤더 + 일일 목표 progress + 이번 세션 메타 + streak + 시작 버튼.

function ProgressBar({ value, max, color = '#4f46e5' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// A — Textbook. 세로 stack. 각 섹션 명확히 분리.
// ─────────────────────────────────────────────────────────────────────────
function SessionStartA() {
  const mode = MODES.main;
  return (
    <div>
      <header className="mb-5 flex items-center gap-2">
        <span className="block w-2.5 h-2.5 rounded-full" style={{ background: mode.color }} />
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">선택한 모드</div>
        <span className="text-sm text-gray-900 font-medium">{mode.label}</span>
      </header>

      {/* 일일 목표 */}
      <section className="rounded-lg border border-gray-200 bg-white px-5 py-4 mb-3">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">오늘 학습</div>
          <div className="text-sm text-gray-900"><span className="font-medium text-indigo-600">7</span> <span className="text-gray-400">/</span> 15</div>
        </div>
        <ProgressBar value={7} max={15} />
      </section>

      {/* 이번 세션 */}
      <section className="rounded-lg border border-gray-200 bg-white px-5 py-4 mb-3">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-3">이번 세션</div>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-gray-500">예상 시간</dt><dd className="text-gray-900 text-right tabular-nums">18분</dd>
          <dt className="text-gray-500">카드 수</dt><dd className="text-gray-900 text-right tabular-nums">15문제</dd>
          <dt className="text-gray-500">약점 비중</dt><dd className="text-gray-900 text-right tabular-nums">2 / 15</dd>
        </dl>
      </section>

      {/* streak */}
      <section className="rounded-lg border border-gray-200 bg-white px-5 py-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-amber-700"><Icon.Flame /></span>
          <div className="flex-1">
            <div className="text-sm text-gray-900">현재 <span className="font-medium">5일</span> 연속</div>
            <div className="text-xs text-gray-500 mt-0.5">최장 기록 12일</div>
          </div>
        </div>
      </section>

      <button className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 inline-flex items-center justify-center gap-2" style={{ minHeight: 48 }}>
        시작 <Icon.ArrowRight />
      </button>
      <p className="text-center text-[11px] text-gray-400 mt-2">⌃Enter</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// B — Density. 1 카드에 모든 메타 정리. 우측 streak inline.
// ─────────────────────────────────────────────────────────────────────────
function SessionStartB() {
  const mode = MODES.main;
  return (
    <div>
      <header className="mb-3 flex items-center gap-2">
        <span className="block w-2 h-2 rounded-full" style={{ background: mode.color }} />
        <span className="text-sm text-gray-900 font-medium">{mode.label}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-gray-700">
          <span className="text-amber-700"><Icon.Flame width="14" height="14" /></span>
          <span className="tabular-nums"><span className="font-medium">5</span>일 연속</span>
          <span className="text-gray-400">· 최장 12</span>
        </span>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white px-5 py-4">
        <div className="flex items-baseline justify-between">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">오늘 학습</div>
          <div className="text-sm text-gray-900"><span className="text-indigo-600 font-medium">7</span> / 15</div>
        </div>
        <div className="mt-2"><ProgressBar value={7} max={15} /></div>

        <div className="mt-4 grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 pt-4">
          <div className="text-center">
            <div className="text-base font-medium text-gray-900 tabular-nums">18<span className="text-xs text-gray-500 ml-0.5">분</span></div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-0.5">예상</div>
          </div>
          <div className="text-center">
            <div className="text-base font-medium text-gray-900 tabular-nums">15</div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-0.5">문제</div>
          </div>
          <div className="text-center">
            <div className="text-base font-medium text-gray-900 tabular-nums">2</div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-0.5">약점</div>
          </div>
        </div>
      </section>

      {/* 약점 영역 미리보기 (메인 모드는 정보로만, review_weak일 때 강조) */}
      <section className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-5 py-3">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">포함된 약점 영역</div>
        <ul className="text-[13px] text-gray-800 space-y-1">
          <li className="flex justify-between"><span>적과전 종합위험방식 Ⅱ</span><span className="tabular-nums text-gray-500">2문제</span></li>
        </ul>
      </section>

      <button className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 inline-flex items-center justify-center gap-2" style={{ minHeight: 48 }}>
        시작 <Icon.ArrowRight />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// C — Radical. 큰 숫자 hero ("7 / 15") 가 화면 상단 절반.
// streak 와 메타는 하단 카드. 시작 버튼은 화면 최하단 엄지존.
// 그라디언트 X, 동기부여 카피 X.
// ─────────────────────────────────────────────────────────────────────────
function SessionStartC() {
  const mode = MODES.main;
  return (
    <div className="flex flex-col" style={{ minHeight: 600 }}>
      <header className="flex items-center gap-2 mb-6">
        <span className="block w-2 h-2 rounded-full" style={{ background: mode.color }} />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">본 학습</span>
        <span className="ml-auto text-xs text-gray-500">2026.05.13</span>
      </header>

      {/* hero 숫자 */}
      <div className="py-2">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">오늘 학습</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="tp-tight text-[64px] font-medium text-indigo-600 tabular-nums leading-none">7</span>
          <span className="text-2xl text-gray-300 leading-none">/</span>
          <span className="text-2xl text-gray-500 tabular-nums leading-none">15</span>
        </div>
        <div className="mt-3"><ProgressBar value={7} max={15} /></div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">이번 세션</span>
          <span className="text-gray-900 tabular-nums">8문제 · 약 9분</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 inline-flex items-center gap-1.5">
            <span className="text-amber-700"><Icon.Flame width="14" height="14" /></span>스트릭
          </span>
          <span className="text-gray-900 tabular-nums">5일 <span className="text-gray-400">· 최장 12</span></span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">약점 비중</span>
          <span className="text-gray-900 tabular-nums">2 / 8</span>
        </div>
      </div>

      <div className="flex-1" />

      <div className="mt-6">
        <button className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-medium text-white hover:bg-indigo-700 inline-flex items-center justify-center gap-2" style={{ minHeight: 52 }}>
          시작
        </button>
        <p className="text-center text-[11px] text-gray-400 mt-2">⌃Enter · 한 손 엄지 도달 영역</p>
      </div>
    </div>
  );
}

Object.assign(window, { SessionStartA, SessionStartB, SessionStartC });
