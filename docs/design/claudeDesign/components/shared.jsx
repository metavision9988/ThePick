// Shared icons (inline SVG, stroke-based, 16/20px) + sample data + tokens.
// All icons use currentColor so they inherit from the surrounding text color.

const Icon = {
  Flame: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}>
      <path d="M10 17.5c3 0 5.5-2.3 5.5-5.3 0-2-1-3.5-2.5-4.7C12 6.5 11.5 5 11.5 3.5c0-.5-.1-1-.3-1.5-1.5 1-3 3-3 5.2 0 1-.5 1.8-1.3 2.3-1 .7-1.4 1.8-1.4 2.7 0 3 2.5 5.3 4.5 5.3Z" />
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}>
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  ),
  X: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" width="16" height="16" {...p}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  ),
  ArrowRight: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}>
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  ),
  Chevron: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" {...p}>
      <path d="m7 5 5 5-5 5" />
    </svg>
  ),
  Clock: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14" {...p}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 2" strokeLinecap="round" />
    </svg>
  ),
  Stack: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" width="14" height="14" {...p}>
      <path d="M3.5 6.5 10 3l6.5 3.5L10 10 3.5 6.5Z" />
      <path d="M3.5 10 10 13.5 16.5 10" />
      <path d="M3.5 13.5 10 17l6.5-3.5" />
    </svg>
  ),
  Book: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" width="14" height="14" {...p}>
      <path d="M4 4h5a2 2 0 0 1 2 2v10a2 2 0 0 0-2-2H4V4Z" />
      <path d="M16 4h-5a2 2 0 0 0-2 2v10a2 2 0 0 1 2-2h5V4Z" />
    </svg>
  ),
  Target: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14" {...p}>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.5" />
      <circle cx="10" cy="10" r="0.8" fill="currentColor" />
    </svg>
  ),
  Sparkle: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" {...p}>
      <path d="M10 3v4M10 13v4M3 10h4M13 10h4" />
    </svg>
  ),
};

// RFP-locked pills
function Pill({ tone = 'gray', children, className = '' }) {
  const tones = {
    correct: 'bg-emerald-100 text-emerald-900',
    wrong: 'bg-amber-100 text-amber-900',
    accent: 'bg-amber-100 text-amber-900',
    subject: 'bg-gray-100 text-gray-700',
    gray: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

// Mono meta tag (CONCEPT, FORMULA…)
function MetaTag({ children }) {
  return (
    <span className="inline-flex items-center rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[10px] text-gray-700">
      {children}
    </span>
  );
}

// Mode tokens (single source for accent border + label color)
const MODES = {
  warmup:      { id: 'warmup',      label: '워밍업',    hint: '쉬운 카드부터 천천히',           color: '#9ca3af', tone: 'text-gray-700' },
  main:        { id: 'main',        label: '본 학습',   hint: 'FSRS 큐 — 오늘 풀어야 할 카드', color: '#4f46e5', tone: 'text-indigo-700' },
  cooldown:    { id: 'cooldown',    label: '쿨다운',    hint: '난이도 낮추며 마무리',           color: '#10b981', tone: 'text-emerald-700' },
  review_weak: { id: 'review_weak', label: '약점 복습', hint: 'weak_score 높은 카드만',         color: '#f59e0b', tone: 'text-amber-700' },
};

// Sample question (재해보험 도메인)
const SAMPLE_Q = {
  source: '2024년 제10회 제3문',
  subject: '농업재해보험',
  type: 'multiple-choice',
  body:
    '농작물재해보험에서 적과전 종합위험방식 Ⅱ의 보장 개시일은 ' +
    '계약체결일 24시이며, 보장 종료일에 관한 다음 설명 중 옳지 ' +
    '않은 것은?',
  choices: [
    '사과·배: 판매개시연도 11월 30일',
    '단감·떫은감: 판매개시연도 10월 31일',
    '복숭아: 이듬해 7월 31일',
    '포도: 판매개시연도 10월 10일',
    '자두: 이듬해 6월 30일',
  ],
  answer: 3, // index — 복숭아 (correct: 이듬해 8월 31일이 아니라 보기는 잘못됨; sample only)
  userAnswer: 1, // user picked 2번 — 오답
  explanation:
    '단감·떫은감의 보장 종료일은 ‘판매개시연도 11월 30일’이다. ' +
    '약관 별표1의 품목별 보장기간표를 정확히 암기해야 한다. ' +
    '특히 사과·배와 단감·떫은감의 종료일 차이를 혼동하기 쉽다.',
  refs: [
    { kind: '교재',   text: '농업재해보험 표준약관 별표1 p.234' },
    { kind: '법조문', text: '농어업재해보험법 시행령 제12조' },
    { kind: '기출',   text: '2023년 제9회 제5문 유사' },
  ],
  related: [
    { type: 'CONCEPT', text: '적과전 종합위험방식 Ⅱ' },
    { type: 'CONCEPT', text: '보장개시일 / 보장종료일' },
    { type: 'TABLE',   text: '품목별 보장기간 표' },
  ],
};

Object.assign(window, { Icon, Pill, MetaTag, MODES, SAMPLE_Q });
