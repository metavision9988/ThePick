// QuestionCard — A / B / C variants
// All variants must satisfy RFP §3.1: same outer chrome rounded-lg border,
// header (출처+과목) / body / input / result(bg-gray-50), no view switch
// across the 4 input types, 출처 always-on in result.

// ─────────────────────────────────────────────────────────────────────────
// shared sub-components used across A/B/C
// ─────────────────────────────────────────────────────────────────────────

function ChoiceRow({ index, text, selected, correct, isAnswer, dense }) {
  // visual states post-grade:
  //   - the user's pick: indigo border if right, amber if wrong
  //   - the correct one (if user got it wrong): emerald left border
  let ring = 'border-l-2 border-l-transparent';
  let bg = 'bg-white';
  if (correct === 'right' && selected) ring = 'border-l-2 border-l-indigo-600';
  if (correct === 'wrong' && selected) { ring = 'border-l-2 border-l-amber-500'; bg = 'bg-amber-50'; }
  if (correct === 'wrong' && isAnswer) { ring = 'border-l-2 border-l-emerald-500'; bg = 'bg-emerald-50/40'; }
  const pad = dense ? 'py-2.5 px-3' : 'py-3 px-3';
  return (
    <li className={`flex items-start gap-3 rounded-lg border border-gray-200 ${ring} ${bg} ${pad}`} style={{ minHeight: 44 }}>
      <span className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border ${
        selected ? 'border-indigo-600 text-indigo-600' : 'border-gray-300 text-gray-500'
      } text-xs font-medium`}>{['①','②','③','④','⑤'][index]}</span>
      <span className="tp-body text-[15px] text-gray-900 flex-1">{text}</span>
      {correct === 'wrong' && isAnswer && (
        <span className="flex-none text-emerald-700 mt-0.5"><Icon.Check width="14" height="14" /></span>
      )}
      {correct === 'wrong' && selected && (
        <span className="flex-none text-amber-700 mt-0.5"><Icon.X width="14" height="14" /></span>
      )}
    </li>
  );
}

function ResultBlock({ q, dense }) {
  return (
    <section className={`bg-gray-50 ${dense ? 'px-5 py-4' : 'px-6 py-5'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Pill tone="wrong">오답</Pill>
        <span className="text-xs text-gray-500">내가 쓴 답 <span className="text-gray-900 font-medium">②</span></span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-500">정답 <span className="text-emerald-800 font-medium">④</span></span>
      </div>

      <dl className={`grid gap-3 ${dense ? 'grid-cols-[64px_1fr]' : 'grid-cols-[72px_1fr]'} text-sm`}>
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 pt-0.5">해설</dt>
        <dd className="tp-body text-gray-900">{q.explanation}</dd>

        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 pt-0.5">출처</dt>
        <dd className="space-y-1">
          {q.refs.map((r, i) => (
            <div key={i} className="flex items-baseline gap-2 text-[13px] text-gray-700">
              <span className="text-xs text-gray-500 w-10 flex-none">{r.kind}</span>
              <span className="tp-body">{r.text}</span>
            </div>
          ))}
        </dd>
      </dl>

      <details className="mt-4 group">
        <summary className="flex items-center justify-between cursor-pointer list-none text-xs font-medium uppercase tracking-wide text-gray-500 select-none" style={{ minHeight: 32 }}>
          <span>관련 자료 · {q.related.length}</span>
          <span className="text-gray-400 group-open:rotate-90 transition-transform"><Icon.Chevron /></span>
        </summary>
        <ul className="mt-2 space-y-1.5">
          {q.related.map((r, i) => (
            <li key={i} className="flex items-baseline gap-2 text-[13px] text-gray-800">
              <MetaTag>{r.type}</MetaTag>
              <span className="tp-body">{r.text}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// A — Textbook. Phase 2 baseline. Generous spacing, vertical flow.
// ─────────────────────────────────────────────────────────────────────────
function QuestionCardA({ q = SAMPLE_Q }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-3">
        <div className="text-xs text-gray-500">{q.source}</div>
        <Pill tone="subject">{q.subject}</Pill>
      </header>

      <div className="px-6 py-6">
        <p className="tp-body text-[15px] text-gray-900 whitespace-pre-wrap">{q.body}</p>
      </div>

      <div className="border-t border-gray-100 px-6 py-5">
        <ul className="space-y-2.5">
          {q.choices.map((c, i) => (
            <ChoiceRow key={i} index={i} text={c} selected={i === q.userAnswer} isAnswer={i === q.answer} correct="wrong" />
          ))}
        </ul>
      </div>

      <ResultBlock q={q} />

      <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between bg-white">
        <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50" style={{ minHeight: 44 }}>건너뜀</button>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 inline-flex items-center gap-1.5" style={{ minHeight: 44 }}>
          다음 문제
          <span className="text-indigo-200 text-[11px] font-mono">⌃N</span>
        </button>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// B — Density. ~30% more info per row. Meta strip combined,
// choices use tighter rows + inline 단축키 hint, side-by-side meta in result.
// ─────────────────────────────────────────────────────────────────────────
function QuestionCardB({ q = SAMPLE_Q }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <header className="border-b border-gray-100 px-5 py-3 flex items-center gap-3">
        <Pill tone="subject">{q.subject}</Pill>
        <span className="text-xs text-gray-500">{q.source}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-400">
          <Icon.Clock width="12" height="12" /> 00:42
        </span>
      </header>

      <div className="px-5 pt-5 pb-3">
        <p className="tp-body text-[15px] text-gray-900 whitespace-pre-wrap">{q.body}</p>
      </div>

      <div className="px-5 pb-4">
        <ul className="space-y-1.5">
          {q.choices.map((c, i) => (
            <ChoiceRow key={i} index={i} text={c} selected={i === q.userAnswer} isAnswer={i === q.answer} correct="wrong" dense />
          ))}
        </ul>
        <div className="mt-2 text-[11px] text-gray-400">숫자 키 <span className="font-mono">1–5</span> · ⌃Enter 채점</div>
      </div>

      <ResultBlock q={q} dense />

      <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between bg-white">
        <div className="text-xs text-gray-500">7 / 15</div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50" style={{ minHeight: 44, minWidth: 44 }}>건너뜀</button>
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 inline-flex items-center gap-1.5" style={{ minHeight: 44 }}>
            다음 <span className="text-indigo-200 text-[11px] font-mono">⌃N</span>
          </button>
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// C — Radical. Convention break: progress chip + 정답 메타가 헤더로 승격,
// 보기는 키캡 좌측 정렬, 출처는 본문 상단 inline "맥락 strip"으로 노출
// (밀어내지 않고 더 가깝게). 안티패턴은 위반하지 않음.
// ─────────────────────────────────────────────────────────────────────────
function QuestionCardC({ q = SAMPLE_Q }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* sticky progress strip — 1선만 */}
      <div className="h-0.5 bg-gray-100">
        <div className="h-full bg-indigo-600" style={{ width: '47%' }} />
      </div>

      <header className="px-5 pt-4 pb-3 flex items-center gap-2">
        <Pill tone="subject">{q.subject}</Pill>
        <span className="text-xs text-gray-500">7 / 15</span>
        <span className="ml-auto inline-flex items-center gap-2">
          <Pill tone="wrong">오답</Pill>
        </span>
      </header>

      {/* context strip: 출처가 본문 위에 inline */}
      <div className="px-5 pb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 border-b border-gray-100">
        <span>{q.source}</span>
        <span className="text-gray-300">·</span>
        <span>약관 별표1</span>
        <span className="text-gray-300">·</span>
        <span>법 시행령 §12</span>
      </div>

      <div className="px-5 pt-4 pb-3">
        <p className="tp-body text-[15px] text-gray-900 whitespace-pre-wrap">{q.body}</p>
      </div>

      {/* keycap-led choices */}
      <div className="px-5 pb-4">
        <ul className="space-y-1.5">
          {q.choices.map((c, i) => {
            const sel = i === q.userAnswer;
            const ans = i === q.answer;
            let cls = 'border-gray-200';
            let bg = 'bg-white';
            if (sel) { cls = 'border-amber-300'; bg = 'bg-amber-50'; }
            if (ans) { cls = 'border-emerald-300'; bg = 'bg-emerald-50/60'; }
            return (
              <li key={i} className={`flex items-stretch gap-0 rounded-lg border ${cls} ${bg} overflow-hidden`} style={{ minHeight: 44 }}>
                <span className={`flex items-center justify-center w-9 flex-none border-r ${cls} font-mono text-xs ${
                  ans ? 'text-emerald-800 bg-emerald-100' :
                  sel ? 'text-amber-800 bg-amber-100' :
                  'text-gray-500 bg-gray-50'
                }`}>{i + 1}</span>
                <span className="tp-body text-[15px] text-gray-900 flex-1 px-3 py-2.5 flex items-center">{c}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <ResultBlock q={q} dense />

      <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-end gap-2 bg-white">
        <button className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50" style={{ minHeight: 44 }}>건너뜀</button>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 inline-flex items-center gap-1.5" style={{ minHeight: 44 }}>
          다음 문제 <Icon.ArrowRight width="14" height="14" />
        </button>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Mini cards demonstrating the 4 input types within the SAME card chrome.
// Used in a secondary "input type" row in the canvas. Pre-grade view so
// the input chrome itself is visible.
// ─────────────────────────────────────────────────────────────────────────

function InputTypeCard({ type }) {
  // common chrome — header (출처+과목) / body / input / action
  const headers = {
    'multiple-choice': { src: '2024년 제10회 제3문', subj: '농업재해보험', body: '적과전 종합위험방식 Ⅱ의 보장 종료일에 관한 다음 설명 중 옳지 않은 것은?' },
    'fill-blank':      { src: '2024년 제10회 제7문', subj: '농작물재해보험', body: '농업재해보험법 제8조에 따라 보험사업자는 매 사업연도 결산 결과 발생한 잉여금을 (    )에 적립하여야 한다.' },
    'essay':           { src: '2023년 제9회 제2문',  subj: '농업재해보험', body: '농작물재해보험의 “적과종료 이전 보장재해”의 정의와 보상하는 손해의 범위를 약술하시오.' },
    'calc':            { src: '2024년 제10회 제11문', subj: '농업재해보험', body: '가입금액 5,000만원, 자기부담비율 20%인 사과 농가에서 피해율 35%로 산정된 경우 지급보험금은 얼마인가?' },
  };
  const h = headers[type];
  return (
    <article className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <header className="border-b border-gray-100 px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <MetaTag>{type.replace('-', '_').toUpperCase()}</MetaTag>
          <span className="text-xs text-gray-500 truncate">{h.src}</span>
        </div>
        <Pill tone="subject">{h.subj}</Pill>
      </header>

      <div className="px-5 py-4">
        <p className="tp-body text-[14px] text-gray-900">{h.body}</p>
      </div>

      <div className="border-t border-gray-100 px-5 py-4 bg-white">
        {type === 'multiple-choice' && (
          <ul className="space-y-1.5">
            {['사과·배: 판매개시연도 11월 30일','단감·떫은감: 10월 31일','복숭아: 이듬해 7월 31일'].map((t, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5" style={{ minHeight: 44 }}>
                <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border border-gray-300 text-xs text-gray-500">{['①','②','③'][i]}</span>
                <span className="tp-body text-[14px] text-gray-900 flex-1">{t}</span>
              </li>
            ))}
            <li className="text-[11px] text-gray-400 pl-1">+ ④ ⑤ … <span className="font-mono">1–5</span> 키</li>
          </ul>
        )}

        {type === 'fill-blank' && (
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">정답 입력</label>
            <div className="flex items-center gap-2">
              <input type="text" defaultValue="" placeholder="단답형 입력" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none" style={{ minHeight: 44 }} />
              <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white" style={{ minHeight: 44 }}>채점</button>
            </div>
            <div className="mt-2 text-[11px] text-gray-400">Enter 채점</div>
          </div>
        )}

        {type === 'essay' && (
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">서술형 답안</label>
            <textarea rows={5} placeholder="답안을 입력하세요" className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none resize-none" />
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <span className="text-xs font-medium uppercase tracking-wide">자기 채점</span>
              {['맞음','모름','틀림'].map((t, i) => (
                <button key={i} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-50" style={{ minHeight: 32 }}>{t}</button>
              ))}
              <span className="ml-auto text-[11px] text-gray-400">⌃Enter</span>
            </div>
          </div>
        )}

        {type === 'calc' && (
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">수치 입력</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center rounded-lg border border-gray-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200">
                <input type="text" inputMode="numeric" defaultValue="7,500,000" className="flex-1 bg-transparent px-3 py-2 text-sm tabular-nums text-gray-900 outline-none" style={{ minHeight: 44 }} />
                <span className="pr-3 text-sm text-gray-500">원</span>
              </div>
              <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white" style={{ minHeight: 44 }}>채점</button>
            </div>
            <div className="mt-2 text-[11px] text-gray-400">단위 자동 부착 · Enter 채점</div>
          </div>
        )}
      </div>
    </article>
  );
}

Object.assign(window, { QuestionCardA, QuestionCardB, QuestionCardC, InputTypeCard });
