// ProgressVisualization — A / B / C
// 오늘 (원형) / 스트릭 (7일 미니 히트맵) / 마스터 (과목별 horizontal bar)

// shared SVG primitives
function Ring({ value = 7, max = 15, size = 96, stroke = 4, color = '#4f46e5', track = '#f3f4f6' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value / max);
  const dash = c * pct;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
    </svg>
  );
}

// 7일 미니 히트맵 — 정사각형 7개
function MiniWeek({ data, size = 24, gap = 6 }) {
  return (
    <div className="flex" style={{ gap }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div
            className="rounded"
            style={{
              width: size, height: size,
              background: d.done ? '#4f46e5' : '#f3f4f6',
              border: d.today ? '1px solid #1e40af' : '1px solid transparent',
            }}
            title={d.label}
          />
          <span className={`text-[10px] tabular-nums ${d.today ? 'text-indigo-700 font-medium' : 'text-gray-500'}`}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function HBar({ label, value, max = 100 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px] mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-900 tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-indigo-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const WEEK = [
  { label: '월', done: true,  today: false },
  { label: '화', done: true,  today: false },
  { label: '수', done: true,  today: false },
  { label: '목', done: false, today: false },
  { label: '금', done: true,  today: false },
  { label: '토', done: true,  today: false },
  { label: '일', done: true,  today: true  },
];

const SUBJECTS = [
  { name: '농업재해보험',   value: 78 },
  { name: '농작물재해보험', value: 64 },
  { name: '가축재해보험',   value: 52 },
  { name: '농업정책보험',   value: 41 },
  { name: '손해평가 실무',  value: 33 },
];

// ─────────────────────────────────────────────────────────────────────────
// A — Textbook. 3 섹션 세로 stack. 카드 외곽 동일.
// ─────────────────────────────────────────────────────────────────────────
function ProgressVizA() {
  return (
    <div className="space-y-3">
      {/* 오늘 */}
      <section className="rounded-lg border border-gray-200 bg-white px-5 py-4">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-3">오늘</div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Ring value={7} max={15} size={88} stroke={4} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-medium text-gray-900 tabular-nums leading-none">7 / 15</span>
              <span className="text-[10px] text-gray-500 tabular-nums mt-0.5">47%</span>
            </div>
          </div>
          <div className="flex-1 text-sm tp-body text-gray-700">
            <div className="text-gray-900">남은 카드 <span className="font-medium tabular-nums">8</span></div>
            <div className="text-gray-500 text-xs mt-1 tabular-nums">예상 9분 · 본 학습 큐</div>
          </div>
        </div>
      </section>

      {/* 스트릭 */}
      <section className="rounded-lg border border-gray-200 bg-white px-5 py-4">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">스트릭</div>
          <div className="text-xs text-gray-500 tabular-nums">
            <span className="text-gray-900 font-medium">5일</span> · 최장 12
          </div>
        </div>
        <MiniWeek data={WEEK} size={28} gap={8} />
      </section>

      {/* 마스터 */}
      <section className="rounded-lg border border-gray-200 bg-white px-5 py-4">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">과목별 마스터</div>
          <div className="text-xs text-gray-500">최근 30일</div>
        </div>
        <div className="space-y-2.5">
          {SUBJECTS.map((s, i) => <HBar key={i} label={s.name} value={s.value} />)}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// B — Density. 1 카드에 3 섹션을 inline grid 로 합침.
// ─────────────────────────────────────────────────────────────────────────
function ProgressVizB() {
  return (
    <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <header className="px-5 py-3 border-b border-gray-100 flex items-baseline justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">진도</div>
        <div className="text-xs text-gray-500">2026.05.13</div>
      </header>

      {/* 상단 row: 오늘 ring + streak */}
      <div className="px-5 py-4 grid grid-cols-[auto_1fr] gap-5 items-center border-b border-gray-100">
        <div className="relative">
          <Ring value={7} max={15} size={72} stroke={4} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-medium text-gray-900 tabular-nums leading-none">7 / 15</span>
            <span className="text-[10px] text-gray-500 mt-0.5">47%</span>
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">스트릭</div>
            <div className="text-xs text-gray-700 tabular-nums">
              <span className="text-gray-900 font-medium">5일</span> · 12
            </div>
          </div>
          <MiniWeek data={WEEK} size={20} gap={6} />
        </div>
      </div>

      {/* 하단: 과목별 horizontal bar */}
      <div className="px-5 py-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-3">과목별 마스터</div>
        <div className="space-y-2">
          {SUBJECTS.map((s, i) => <HBar key={i} label={s.name} value={s.value} />)}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// C — Radical. 관습 깨기: 원형 ring 을 버리고 "오늘 = 큰 분수 표기"
// 다음 슬롯에는 30일 dot strip (1행 30점) — 학습 일관성을 한눈에.
// 마스터는 단순한 % 리스트 (bar 없음, 라벨 + 숫자 정렬).
// 안티: 다중 ring X / 캘린더 그리드 X / 다색 X — 모두 회피.
// ─────────────────────────────────────────────────────────────────────────
function ProgressVizC() {
  const days30 = Array.from({ length: 30 }, (_, i) => {
    // 가짜 30일 — 마지막 7일은 WEEK에 맞춤
    const idx = i;
    let done = [0,2,3,5,6,8,9,11,12,13,15,17,18,20,21,23,24,25,26,28].includes(idx);
    if (idx >= 23) done = WEEK[idx - 23]?.done ?? done;
    const today = idx === 29;
    return { done, today };
  });
  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-gray-200 bg-white px-5 py-5">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">오늘 학습</div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="tp-tight text-[44px] font-medium text-indigo-600 tabular-nums leading-none">7</span>
          <span className="text-xl text-gray-300 leading-none">/</span>
          <span className="text-xl text-gray-500 tabular-nums leading-none">15</span>
          <span className="ml-auto text-xs text-gray-500 tabular-nums">남은 8 · 9분</span>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-indigo-600" style={{ width: '47%' }} />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white px-5 py-4">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">최근 30일</div>
          <div className="text-xs text-gray-700 tabular-nums">
            현재 <span className="text-gray-900 font-medium">5일</span> · 최장 12
          </div>
        </div>
        <div className="grid grid-cols-[repeat(30,1fr)] gap-[3px]">
          {days30.map((d, i) => (
            <div
              key={i}
              className="rounded-sm aspect-square"
              style={{
                background: d.done ? '#4f46e5' : '#f3f4f6',
                outline: d.today ? '1.5px solid #1e40af' : 'none',
                outlineOffset: '1px',
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-gray-400 tabular-nums">
          <span>−29일</span><span>오늘</span>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white px-5 py-4">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">과목별 마스터</div>
        <ul className="divide-y divide-gray-100">
          {SUBJECTS.map((s, i) => (
            <li key={i} className="flex items-baseline justify-between py-2">
              <span className="text-sm text-gray-700">{s.name}</span>
              <div className="flex items-center gap-3">
                <div className="w-20 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-indigo-600" style={{ width: `${s.value}%` }} />
                </div>
                <span className="text-sm text-gray-900 tabular-nums w-9 text-right">{s.value}%</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

Object.assign(window, { ProgressVizA, ProgressVizB, ProgressVizC });
