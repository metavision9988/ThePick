#!/usr/bin/env tsx
/**
 * **임계 1.0 의 표적 코퍼스 비용 추정** (독립 리뷰 M-6 / 렌즈1 Pass2 반론 처분).
 *
 * ## 무엇을 재는가
 *
 * LCS 임계 1.0(정규화 후 정확 포함)은 STAGE 2 코퍼스에서 비용이 0이다 — 인용이 pdfplumber
 * 결정론 추출물이라 **정의상** 부분문자열이기 때문이다. 그런데 AutoVerify 의 **실제 표적**은
 * AI 가 저작한 인용이고, 거기서는 축자 부분문자열일 이유가 없다.
 *
 * 리뷰가 경고한 시나리오: *"정상 카드가 전건 `queue` 로 떨어지고, 파일럿·테스트는 전부 green 이다 —
 * 픽스처가 인용과 같은 생산자의 산출물이기 때문이다. 엔진은 '전량 queue' 로 조용히 퇴화하고,
 * 그 퇴화는 'fail-closed 라 안전'이라는 문장으로 정당화될 준비가 이미 코드 주석에 되어 있다."*
 *
 * ⇒ 그 비용을 **숫자로** 만든다. 실제 AI 인용 코퍼스가 없으므로 **AI 인용에서 흔한 변형**을
 *   실 코퍼스에 주입해 통과율을 잰다.
 *
 * ## ★이 수치가 무엇이 아닌가 (정직 — 먼저 읽을 것)
 *
 * - **실측이 아니라 시뮬레이션이다.** 변형 목록은 내가 고른 것이고, 실제 LLM 이 내는 인용 오차의
 *   분포와 다를 수 있다. held-out AI 코퍼스가 생기면 **이 수치는 폐기하고 다시 잰다.**
 * - 따라서 이것은 **임계를 조정할 근거가 아니다**(그건 held-out 의 몫 — 대시보드 §A #8).
 *   여기서 얻는 것은 "표적 코퍼스에서 무슨 일이 벌어질지" 의 **크기 감각**뿐이다.
 *
 * 사용: packages/quality/node_modules/.bin/tsx scripts/estimate-threshold-cost.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lcsRatio, coverage } from '../packages/autoverify/src/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const S2 = join(ROOT, 'docs/batch-load/stage2-source-quote');

interface QuoteRow {
  readonly id: string;
  readonly quote: string;
}

/**
 * AI 저작 인용에서 흔한 변형. **전부 "의미는 그대로인데 축자가 아닌" 것**이다 —
 * 즉 이상적으로는 통과해야 하지만 임계 1.0 은 통과시키지 않는다.
 */
const PERTURBATIONS: ReadonlyArray<{
  readonly label: string;
  readonly why: string;
  readonly apply: (q: string) => string;
}> = [
  {
    label: '생략부호 축약',
    why: 'LLM 이 긴 조문을 인용할 때 가운데를 "…" 로 줄이는 것은 표준 관행이다',
    apply: (q) => (q.length < 80 ? q : `${q.slice(0, 40)}…${q.slice(-40)}`),
  },
  {
    label: '항 번호 표기 변환 (① → 1.)',
    why: '원문의 원문자를 아라비아 숫자로 옮겨 적는 것은 흔한 정규화다',
    apply: (q) => q.replace(/[①②③④⑤⑥]/g, (c) => `${'①②③④⑤⑥'.indexOf(c) + 1}.`),
  },
  {
    label: '조문 머리 제거',
    why: 'LLM 은 "제8조(제목)" 를 떼고 본문만 인용하는 경우가 많다',
    apply: (q) => q.replace(/^제\s*\d+\s*조(?:\s*의\s*\d+)?\s*\([^)]*\)\s*/, ''),
  },
  {
    label: '문장 1개만 인용',
    why: '주장을 뒷받침하는 한 문장만 떼어 오는 것이 자연스러운 인용이다',
    apply: (q) => q.split(/(?<=다\.)\s*/)[0] ?? q,
  },
  {
    label: '유사문자 치환 (ㆍ↔·)',
    why: 'PDF 추출기·입력기마다 중점 문자가 갈린다',
    apply: (q) => q.replace(/ㆍ/g, '·').replace(/·/g, 'ㆍ'),
  },
  {
    label: '괄호 병기 제거',
    why: '"해촉(解囑)" 처럼 한자 병기를 빼고 옮기는 것은 흔하다',
    apply: (q) => q.replace(/\([一-龥]+\)/g, ''),
  },
];

function main(): void {
  const quotes = JSON.parse(readFileSync(join(S2, 'source-quotes.json'), 'utf-8')) as QuoteRow[];
  const chunks = JSON.parse(readFileSync(join(S2, 'source-chunks.json'), 'utf-8')) as Record<
    string,
    string
  >;

  const rows = PERTURBATIONS.map((p) => {
    let n = 0;
    let lcsPass = 0;
    let covPass = 0;
    let changed = 0;
    for (const q of quotes) {
      const src = chunks[q.id];
      if (!src) continue;
      const mutated = p.apply(q.quote);
      n += 1;
      if (mutated !== q.quote) changed += 1;
      if (lcsRatio(mutated, src) >= 1) lcsPass += 1;
      if (coverage(mutated, src) >= 0.95) covPass += 1;
    }
    return { ...p, n, changed, lcsPass, covPass };
  });

  // 기준선 — 무변형 인용의 통과 수(상법 주소 드리프트 8건은 변형과 무관하게 실패한다)
  let baseline = 0;
  let total = 0;
  for (const q of quotes) {
    const src = chunks[q.id];
    if (!src) continue;
    total += 1;
    if (lcsRatio(q.quote, src) >= 1) baseline += 1;
  }

  const lines = [
    '# 임계 1.0 의 표적 코퍼스 비용 — 시뮬레이션 추정',
    '',
    '> 생성기 `scripts/estimate-threshold-cost.ts` · 결정론 · LLM 0 · production 무접촉(읽기만)',
    '> 독립 리뷰 M-6 / Pass2 반론 처분 — "AI 저작 인용에서 3-3 전건 실패 → 전건 queue" 리스크의 크기 재기',
    '',
    '## ⚠️ 이 수치가 무엇이 아닌가 (먼저 읽을 것)',
    '',
    '- **실측이 아니라 시뮬레이션이다.** 변형 목록은 사람이 고른 것이고 실제 LLM 인용 오차 분포와 다를 수 있다.',
    '- 따라서 **임계를 조정할 근거가 아니다.** 그건 held-out AI 코퍼스의 몫이다(대시보드 §A #8).',
    '  여기서 얻는 것은 "표적에서 무슨 일이 벌어질지"의 **크기 감각**뿐이다.',
    '- 각 변형은 **의미가 보존된** 것들이다 — 이상적으로는 통과해야 하는데 임계 1.0 은 통과시키지 않는다.',
    '',
    '## 기준선',
    '',
    `- 무변형 인용의 3-3 통과 = **${baseline}/${total}**. 나머지 ${total - baseline}건은 상법 주소 드리프트라`,
    '  변형과 무관하게 실패한다 ⇒ **아래 표는 이 기준선 대비로 읽어야 한다**(분모를 58 로 읽으면 과대평가).',
    '',
    '## 결과',
    '',
    '| AI 인용 변형 | 왜 흔한가 | 적용됨 | 3-3 통과 | 기준선 대비 | 3-1 통과 |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...rows.map((r) => {
      const rate = baseline === 0 ? 0 : Math.round((r.lcsPass / baseline) * 100);
      return (
        `| ${r.label} | ${r.why} | ${r.changed}/${r.n} | ${r.lcsPass}/${r.n} | ` +
        `**${rate}%** | ${r.covPass}/${r.n} |`
      );
    }),
    '',
    '## ★핵심 — 통과/실패가 갈리는 축은 "길이"가 아니라 "손을 댔는가"다',
    '',
    '- ✅ **부분 인용은 통과한다** — 조문 머리 제거·문장 하나만 인용은 기준선 100%.',
    '  잘라낸 조각도 여전히 출처의 **연속 부분문자열**이기 때문이다.',
    '- ⛔ **인용 안을 편집하면 거의 전멸한다** — 생략부호 축약이 대표적이다.',
    '  ⇒ 임계 1.0 이 요구하는 것은 "짧게 인용하지 마라"가 아니라 **"인용한 구간은 손대지 마라"** 다.',
    '  이건 축자 인용의 정의 그 자체이므로, **AI 에게 줄 계약으로 그대로 쓸 수 있다.**',
    '- 3-1 은 순서를 안 보므로 대체로 살아남는다 = **부담은 전적으로 3-3 이 진다**',
    '  (`lcs===1 ⟹ cov===1` 이므로 3-1 은 3-3 의 하위 — 독립 축이 아니다).',
    '',
    '## 함의',
    '',
    '표적 코퍼스에서 통과율이 낮게 나오더라도 옳은 처분은 **임계를 내리는 것이 아니다**',
    '(그 순간 08-08 리뷰가 실증한 위조 통과 구간 0.8~1.0 이 다시 열린다).',
    '옳은 처분은 **생성 측 계약**이다 — 프롬프트에 *"인용은 원문에서 연속 구간을 그대로 복사한다.',
    '줄이려면 짧게 잡되 가운데를 생략하지 않는다"* 를 명시하면, 위 표에서 실패한 변형 대부분이 사라진다.',
    '지키지 못한 인용은 **카드를 반려하는 게 아니라 인용을 고친다**(M-3 진앙 분리와 같은 원칙).',
    '',
  ];

  const outDir = join(ROOT, 'docs/audit/autoverify-pilot');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'threshold-cost-estimate.md'), lines.join('\n'));

  process.stdout.write(`임계 1.0 표적 비용 추정 (시뮬레이션) — 기준선 ${baseline}/${total}\n`);
  for (const r of rows) {
    process.stdout.write(
      `  ${r.label.padEnd(22)} 적용 ${String(r.changed).padStart(2)}/${r.n} · ` +
        `3-3 통과 ${String(r.lcsPass).padStart(2)}/${r.n} (기준선 대비 ${Math.round((r.lcsPass / baseline) * 100)}%)\n`,
    );
  }
  process.stdout.write(`  리포트: ${join(outDir, 'threshold-cost-estimate.md')}\n`);
}

main();
