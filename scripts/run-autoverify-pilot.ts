#!/usr/bin/env tsx
/**
 * STAGE 3 · 3-6 파일럿 — 법령 카드에 검사기를 **실제로** 돌린다.
 *
 * 완료 판정(체크리스트): **실제 오류가 몇 건 나왔는지 숫자로 보고. 0건이면 그것도 결과**
 * (다만 3-5 적대 10/10 이 먼저 통과해야 의미가 있다 — 그건 패키지 테스트가 고정한다).
 *
 * ★입력은 **로컬 산출물**이다 (plan §설계 결정 ④): production DB 는 0047 미적용이라 원문이 0건이므로
 *   거기서 읽을 것이 없다. 파일럿에 필요한 것은 (주장, 인용, 출처청크) 3쌍뿐이고 전부 파일로 있다:
 *     · 주장(claim)   = gap-P1|P2 insert.sql 의 description  (카드가 학습자에게 말하는 내용)
 *     · 인용(quote)   = stage2-source-quote/source-quotes.json (STAGE 2 축자 추출물)
 *     · 출처(chunk)   = 같은 파일의 quote 를 원본 PDF 에서 재추출한 것 —
 *                       ★인용 자신을 출처로 쓰면 3-1 이 항상 1.0 이 되어 무의미하므로,
 *                       **PDF 재추출본**을 쓴다. 없으면 그 카드는 3-1/3-3 판정 불가(queue).
 *
 * production 무접촉 — 읽기만 한다. 쓰기 0.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  verifyCard,
  summarize,
  type CardInput,
  type CardVerdict,
} from '../packages/autoverify/src/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const S2 = join(ROOT, 'docs/batch-load/stage2-source-quote');
const OUT_DIR = join(ROOT, 'docs/audit/autoverify-pilot');

function fail(msg: string): never {
  process.stderr.write(`\n[autoverify-pilot] 측정 불가 — ${msg}\n`);
  process.stderr.write('[autoverify-pilot] fabricate 차단: 입력 없이 수치를 만들지 않습니다.\n');
  process.exit(1);
}

/** gap-P1|P2 insert.sql 에서 id -> description 결정론 파싱 (STAGE 2 게이트와 동일 방식). */
function loadClaims(): Map<string, string> {
  const out = new Map<string, string>();
  for (const pack of ['gap-P1/gap-P1-insert.sql', 'gap-P2/gap-P2-insert.sql']) {
    const path = join(ROOT, 'docs/batch-load', pack);
    if (!existsSync(path)) fail(`적재 SQL 부재: ${path}`);
    for (const line of readFileSync(path, 'utf-8').split('\n')) {
      if (!line.startsWith('INSERT OR IGNORE INTO knowledge_nodes')) continue;
      const m = /VALUES \('(LAW-\d+)', 'LAW', '(?:[^']|'')*', '((?:[^']|'')*)'/.exec(line);
      if (m) out.set(m[1]!, m[2]!.replace(/''/g, "'"));
    }
  }
  return out;
}

interface QuoteRow {
  readonly id: string;
  readonly name: string;
  readonly quote: string;
}

function main(): void {
  const quotePath = join(S2, 'source-quotes.json');
  if (!existsSync(quotePath)) fail(`STAGE 2 추출물 부재: ${quotePath}`);
  const quotes = JSON.parse(readFileSync(quotePath, 'utf-8')) as QuoteRow[];
  if (quotes.length === 0) fail('추출물 0행');

  const claims = loadClaims();
  const chunkPath = join(S2, 'source-chunks.json');
  const chunks: Record<string, string> = existsSync(chunkPath)
    ? (JSON.parse(readFileSync(chunkPath, 'utf-8')) as Record<string, string>)
    : {};

  const cards: CardInput[] = quotes.map((q) => ({
    id: q.id,
    claim: claims.get(q.id) ?? '',
    quote: q.quote,
    // 출처 청크 = PDF 재추출본. 부재 시 null → 3-1/3-3 은 queue(자동 통과 금지).
    sourceText: chunks[q.id] ?? null,
  }));

  const missingClaim = cards.filter((c) => c.claim === '').map((c) => c.id);
  if (missingClaim.length > 0)
    fail(`description 미매칭 ${missingClaim.length}건: ${missingClaim.join(', ')}`);

  const verdicts: CardVerdict[] = cards.map(verifyCard);
  const s = summarize(verdicts);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  mkdirSync(OUT_DIR, { recursive: true });

  const chunkCount = Object.keys(chunks).length;
  const md = [
    `# autoverify 파일럿 리포트 — ${stamp}`,
    '',
    '> STAGE 3 · 3-6 · 러너 `scripts/run-autoverify-pilot.ts` (read-only) / 코어 `@thepick/autoverify`',
    `> 입력: 인용 ${quotes.length}건 · 주장(description) ${claims.size}건 · 출처 청크 ${chunkCount}건`,
    '> ★production 무접촉 — 로컬 산출물만 읽는다(0047 미적용이라 DB 에는 원문이 0건).',
    '',
    '## ⚠️ 이 수치가 말하지 않는 것 (먼저 읽을 것)',
    '',
    '- **표본 편향**: 대상은 2026-07-14 위임 일괄 승격분(P1+P2)이다 = 결재 대시보드 §A #8 이',
    '  "이미 승격된 행이라 자기 채점"으로 지목한 **burned 코퍼스**. 따라서 아래 수치는',
    '  "이 엔진이 **이 표본에서** 무엇을 잡았나"이고 **엔진의 일반 성능이 아니다.**',
    chunkCount === 0
      ? '- ★**출처 청크가 0건**이라 3-1(인용 진위)·3-3(짜깁기)은 **전건 판정 불가(queue)** 다.' +
        ' 이 리포트의 실질 측정은 3-2(수치 정합)·3-4(앵커 충분성) 두 축뿐이다.'
      : `- 출처 청크 ${chunkCount}/${quotes.length} — 나머지는 3-1·3-3 판정 불가(queue).`,
    '- description 은 요약·편집본이라 인용과 축자 일치할 이유가 없다. 3-2·3-4 의 "실패"는',
    '  **카드가 틀렸다**는 뜻일 수도, **인용이 짧다**는 뜻일 수도 있다 — 처분이 `queue`(사람)인 이유다.',
    '',
    '## 결과',
    '',
    '| 항목 | 값 |',
    '|---|---|',
    `| 대상 카드 | ${s.total} |`,
    `| pass | ${s.pass} |`,
    `| queue (사람 확인) | ${s.queue} |`,
    `| **reject (수치 불일치)** | **${s.reject}** |`,
    '',
    '### 검사별 실패 건수',
    '',
    '| 검사 | 실패 |',
    '|---|---|',
    `| 3-1 인용 진위 | ${s.byCheck['S3-1-quote']} |`,
    `| 3-2 수치 정합 | ${s.byCheck['S3-2-value']} |`,
    `| 3-3 짜깁기 | ${s.byCheck['S3-3-splice']} |`,
    `| 3-4 앵커 충분성 | ${s.byCheck['S3-4-anchor']} |`,
    '',
    '## reject 상세 (수치 불일치 — 카드 내용 재확인 필요)',
    '',
    ...(verdicts.filter((v) => v.disposition === 'reject').length === 0
      ? ['(없음)']
      : verdicts
          .filter((v) => v.disposition === 'reject')
          .flatMap((v) => [
            `### ${v.cardId}`,
            ...v.findings.filter((f) => !f.pass).map((f) => `- [${f.check}] ${f.evidence}`),
            '',
          ])),
    '',
    '## queue 상세 (사람 확인 대상)',
    '',
    ...verdicts
      .filter((v) => v.disposition === 'queue')
      .map((v) => {
        const reasons = v.findings
          .filter((f) => !f.pass)
          .map((f) => f.check)
          .join(', ');
        return `- ${v.cardId} — ${reasons}`;
      }),
    '',
  ].join('\n');

  const outPath = join(OUT_DIR, `pilot-${stamp}.md`);
  writeFileSync(outPath, md);
  writeFileSync(
    join(OUT_DIR, `pilot-${stamp}.json`),
    JSON.stringify({ summary: s, verdicts }, null, 1),
  );

  process.stdout.write(
    `[autoverify-pilot] 대상 ${s.total} · pass ${s.pass} · queue ${s.queue} · reject ${s.reject}\n` +
      `  검사별 실패: 3-1 ${s.byCheck['S3-1-quote']} / 3-2 ${s.byCheck['S3-2-value']} / ` +
      `3-3 ${s.byCheck['S3-3-splice']} / 3-4 ${s.byCheck['S3-4-anchor']}\n` +
      `  리포트: ${outPath}\n`,
  );
}

main();
