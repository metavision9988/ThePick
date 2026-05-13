// SessionSummary — A / B / C
// 정답률 큰 숫자, streak 갱신, 약점 영역 변화, 액션 그룹.

function Sparkline({ values, color = '#4f46e5', w = 80, h = 20 }) {
  // tiny single-color sparkline. SVG only.
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// 약점 변화 row — 좌측 영역명, 우측 변화 (-2.4)와 sparkline 단색
function WeakRow({ name, before, after, sparkData }) {
  const diff = (after - before);
  const better = diff < 0; // weak_score 낮을수록 좋음
  return (
    <li className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-900 truncate">{name}</div>
        <div className="text-[11px] text-gray-500 tabular-nums">
          {before.toFixed(1)} <span className="text-gray-300">→</span> {after.toFixed(1)}
        </div>
      </div>
      <div className="flex-none"><Sparkline values={sparkData} /></div>
      <div className={`w-12 text-right text-xs tabular-nums ${better ? 'text-emerald-700' : 'text-gray-500'}`}>
        {better ? '−' : '+'}{Math.abs(diff).toFixed(1)}
      </div>
    </li>
  );
}

const SUMMARY = {
  correct: 12, total: 15,
  timeSec: 14 * 60 + 22,
  avgSec: 57,
  streakBefore: 5, streakAfter: 6, isRecord: false,
  weaks: [
    { name: '적과전 종합위험방식 Ⅱ', before: 6.4, after: 4.8, spark: [6.4, 6.2, 5.9, 5.4, 5.0, 4.8] },
    { name: '품목별 보장기간',       before: 5.1, after: 4.2, spark: [5.1, 5.0, 4.9, 4.6, 4.4, 4.2] },
    { name: '지급보험금 산정',       before: 4.3, after: 4.5, spark: [4.3, 4.1, 4.2, 4.4, 4.5, 4.5] },
  ],
};

function fmtMMSS(s) { const m = Math.floor(s / 60), r = s % 60; return `${m}:${String(r).padStart(2, '0')}`; }

// ─────────────────────────────────────────────────────────────────────────
// A — Textbook. 큰 정답률 → streak → 약점 → 액션. 세로 stack.
// ─────────────────────────────────────────────────────────────────────────
function SessionSummaryA() {
  const s = SUMMARY;
  const pct = Math.round((s.correct / s.total) * 100);
  return (
    <div>
      <header className="mb-5 flex items-center gap-2">
        <span className="block w-2.5 h-2.5 rounded-full" style={{ background: MODES.main.color }} />
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">세션 완료</div>
        <span className="ml-auto text-xs text-gray-500">{MODES.main.label}</span>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white px-5 py-5">
        <div className="flex items-baseline gap-3">
          <span className="tp-tight text-[40px] font-medium text-indigo-600 tabular-nums leading-none">{pct}%</span>
          <span className="text-sm text-gray-500 tabular-nums">{s.correct} / {s.total}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-gray-500">소요 시간</dt>
          <dd className="text-right text-gray-900 tabular-nums">{fmtMMSS(s.timeSec)}</dd>
          <dt className="text-gray-500">평균 응답</dt>
          <dd className="text-right text-gray-900 tabular-nums">{s.avgSec}초</dd>
        </div>
      </section>

      <section className="mt-3 rounded-lg border border-gray-200 bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-amber-700"><Icon.Flame /></span>
          <div className="flex-1">
            <div className="text-sm text-gray-900 tabular-nums">
              {s.streakBefore}일 <span className="text-gray-300">→</span> <span className="font-medium">{s.streakAfter}일</span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">최장 기록 12일</div>
          </div>
          {s.isRecord && <Pill tone="accent">신기록</Pill>}
        </div>
      </section>

      <section className="mt-3 rounded-lg border border-gray-200 bg-white px-5 py-4">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">약점 영역 변화</div>
        <ul>
          {s.weaks.map((w, i) => <WeakRow key={i} name={w.name} before={w.before} after={w.after} sparkData={w.spark} />)}
        </ul>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50" style={{ minHeight: 48 }}>오늘은 여기까지</button>
        <button className="rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 inline-flex items-center justify-center gap-1.5" style={{ minHeight: 48 }}>
          더 학습하기 <Icon.ArrowRight />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// B — Density. 상단 헤더 row 에 결과+시간+streak 합침. 약점 표 압축.
// ─────────────────────────────────────────────────────────────────────────
function SessionSummaryB() {
  const s = SUMMARY;
  const pct = Math.round((s.correct / s.total) * 100);
  return (
    <div>
      <header className="mb-3 flex items-center gap-2">
        <span className="block w-2 h-2 rounded-full" style={{ background: MODES.main.color }} />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">세션 완료</span>
        <span className="ml-auto text-xs text-gray-500">{MODES.main.label} · 18분</span>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white px-5 py-4">
        <div className="flex items-end gap-4 justify-between">
          <div>
            <div className="tp-tight text-[40px] font-medium text-indigo-600 tabular-nums leading-none">{pct}%</div>
            <div className="text-xs text-gray-500 mt-2 tabular-nums">{s.correct} / {s.total} · 평균 {s.avgSec}초</div>
          </div>
          <div className="text-right text-sm text-gray-900 tabular-nums">
            <div className="inline-flex items-center gap-1.5 justify-end">
              <span className="text-amber-700"><Icon.Flame width="14" height="14" /></span>
              <span>5 <span className="text-gray-300">→</span> <span className="font-medium">6</span>일</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">최장 12</div>
          </div>
        </div>
      </section>

      <section className="mt-3 rounded-lg border border-gray-200 bg-white">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">약점 영역 변화</div>
          <div className="text-[11px] text-gray-400">최근 6세션</div>
        </div>
        <ul className="px-5">
          {s.weaks.map((w, i) => <WeakRow key={i} name={w.name} before={w.before} after={w.after} sparkData={w.spark} />)}
        </ul>
      </section>

      <div className="mt-4 flex gap-2">
        <button className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50" style={{ minHeight: 48 }}>오늘은 여기까지</button>
        <button className="flex-1 rounded-lg bg-indigo-600 px-3 py-3 text-sm font-medium text-white hover:bg-indigo-700 inline-flex items-center justify-center gap-1.5" style={{ minHeight: 48 }}>
          더 학습하기 <Icon.ArrowRight />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// C — Radical. 정답률을 화면 hero 로 가져가지 않고, "오늘 점수 누적" 한 줄로
// 표시. 대신 화면 메인은 "약점 변화 표" 가 차지 (학습 신뢰성 surface).
// 안티: 트로피 X / 신호등 색 X / 그라디언트 X.
// ─────────────────────────────────────────────────────────────────────────
function SessionSummaryC() {
  const s = SUMMARY;
  const pct = Math.round((s.correct / s.total) * 100);
  return (
    <div>
      <header className="mb-4 flex items-center gap-2">
        <span className="block w-2 h-2 rounded-full" style={{ background: MODES.main.color }} />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">세션 완료</span>
        <span className="ml-auto text-xs text-gray-500 tabular-nums">{fmtMMSS(s.timeSec)}</span>
      </header>

      {/* one-line result summary */}
      <div className="border-b border-gray-200 pb-4 flex items-baseline gap-3 flex-wrap">
        <span className="text-sm text-gray-500 tabular-nums">정답률</span>
        <span className="text-2xl font-medium text-indigo-600 tabular-nums tp-tight">{pct}%</span>
        <span className="text-sm text-gray-500 tabular-nums">{s.correct} / {s.total}</span>
        <span className="text-gray-300">·</span>
        <span className="inline-flex items-center gap-1 text-sm text-gray-700">
          <span className="text-amber-700"><Icon.Flame width="14" height="14" /></span>
          5 → <span className="text-gray-900 font-medium">6</span>일
        </span>
      </div>

      {/* main: weak delta as primary surface */}
      <section className="mt-4">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">약점 영역 변화</div>
          <div className="text-[11px] text-gray-400">weak_score · 낮을수록 좋음</div>
        </div>
        <ul className="rounded-lg border border-gray-200 bg-white px-4">
          {s.weaks.map((w, i) => <WeakRow key={i} name={w.name} before={w.before} after={w.after} sparkData={w.spark} />)}
        </ul>
      </section>

      {/* secondary: recommend next */}
      <section className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">다음 추천</span>
          <span className="text-sm text-gray-900">쿨다운 · 6문제</span>
          <span className="ml-auto text-xs text-gray-500 tabular-nums">≈ 5분</span>
        </div>
      </section>

      <div className="mt-5 flex gap-2">
        <button className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50" style={{ minHeight: 48 }}>여기까지</button>
        <button className="flex-[1.4] rounded-lg bg-indigo-600 px-3 py-3 text-sm font-medium text-white hover:bg-indigo-700 inline-flex items-center justify-center gap-1.5" style={{ minHeight: 48 }}>
          쿨다운 시작 <Icon.ArrowRight />
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { SessionSummaryA, SessionSummaryB, SessionSummaryC });
