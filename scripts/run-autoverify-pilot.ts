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
 *     · 출처(chunk)   = stage2-source-quote/source-chunks.json —
 *                       ★**노드가 선언한 주소**(chapter PDF + pdf_page±창)에서만 뽑은 텍스트다.
 *                       인용 문자열도, 인용을 찾아낸 위치도 입력으로 쓰지 않는다
 *                       (`extract_source_quotes.py` §source_chunk 독립성 주석).
 *                       없으면 그 카드는 3-1/3-3 판정 불가(queue).
 *
 * ★이 파일럿에서 3-1/3-3 이 실제로 측정하는 것 = **주소 정합**이다 (2026-08-10 재정의).
 *   STAGE 2 인용은 결정론 PDF 추출물이라 정의상 원본 어딘가에 실재한다 ⇒ "지어낸 인용인가"는
 *   이 표본에서 **측정 불가**이고, 답할 수 있는 질문은 "인용이 선언된 그 페이지에 있는가"다.
 *   직전 판본은 청크를 **인용을 찾은 자리**에서 떠서 `quote ⊆ chunk` 가 항등식이었다
 *   (전건 통과가 수학적으로 보장 = 측정이 아님). 독립 리뷰 §1 처분으로 해소.
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
  /** 추출 경로 서술 — '전 문서 스캔' 이면 기록 pdf_page 미적중(= 주소 드리프트). */
  readonly how: string;
}

/** 노드가 선언한 pdf_page 로 조문을 찾지 못해 전 문서 스캔으로 회수한 = 주소 드리프트 후보. */
function isAddressMiss(row: QuoteRow): boolean {
  return row.how.includes('전 문서 스캔');
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

  // --- 정합 관측: 3-1/3-3 실패 집합 vs 주소 미적중 집합 ---
  // ★**이 일치는 "독립 확증"이 아니다**(독립 리뷰 C-3, 2026-08-10 철회).
  //   추출 1차 탐색 창(pdf_page −1..+3)과 청크 창(−1..+2)은 **둘 다 pdf_page 만을 입력으로 하는
  //   같은 술어**이고 청크 창 ⊂ 추출 창이다 ⇒ 집합 일치는 ±1페이지 경계 케이스를 빼면 **구조적으로
  //   거의 보장**된다. 같은 원인을 두 번 물은 것이지 두 증거가 수렴한 것이 아니다.
  // 그래도 찍는 이유: **어긋나는 순간이 이상 신호**이기 때문이다 —
  //   (a) 주소는 맞는데 인용이 청크 창 밖 → 창/추출 불일치  (b) 드리프트가 창보다 작음.
  // 어느 쪽이든 **수치를 고치지 말고 사실대로 적는다**(창을 넓혀 green 만드는 것이 사고 재발 경로).
  const addressMiss = new Set(quotes.filter(isAddressMiss).map((q) => q.id));
  const failedOf = (check: string): Set<string> =>
    new Set(
      verdicts
        .filter((v) => v.findings.some((f) => f.check === check && !f.pass))
        .map((v) => v.cardId),
    );
  const f31 = failedOf('S3-1-quote');
  const f33 = failedOf('S3-3-splice');
  const sameSet = (a: Set<string>, b: Set<string>): boolean =>
    a.size === b.size && [...a].every((x) => b.has(x));

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
    '- ★**3-1·3-3 이 이 표본에서 측정하는 것은 "인용 진위"가 아니라 "주소 정합"이다.**',
    '  STAGE 2 인용은 결정론 PDF 추출물이라 정의상 원본 어딘가에 실재한다 ⇒ 위조 검출력은',
    '  이 표본에서 **측정 불가**이고, AI 가 저작한 인용 코퍼스에서 비로소 측정된다.',
    '  여기서 답할 수 있는 질문은 **"인용이 노드가 선언한 그 페이지에 있는가"** 뿐이다.',
    '- description 은 요약·편집본이라 인용과 축자 일치할 이유가 없다. 3-2·3-4 의 "실패"는',
    '  **카드가 틀렸다**는 뜻일 수도, **인용이 짧다**는 뜻일 수도 있다 — 처분이 `queue`(사람)인 이유다.',
    '',
    '## 정합 관측 — 3-1·3-3 실패 집합 vs 주소 미적중 집합',
    '',
    '> ⚠️ **이 일치는 "독립 확증"이 아니다.** 추출 1차 탐색 창(`pdf_page` −1..+3)과 청크 창(−1..+2)은',
    '> 둘 다 `pdf_page` 만을 입력으로 하는 **같은 술어**이고 청크 창 ⊂ 추출 창이므로, 일치는',
    '> 경계 케이스를 빼면 **구조적으로 거의 보장**된다. 같은 원인의 두 표현이지 두 증거의 수렴이 아니다.',
    '> 이 절의 값어치는 **어긋나는 순간이 이상 신호**라는 데 있다(회귀 감시용).',
    '',
    `- 주소 미적중(전 문서 스캔으로 회수): **${addressMiss.size}건**`,
    `- 3-1 실패 ${f31.size}건 · 3-3 실패 ${f33.size}건`,
    `- 3-1 실패 == 주소 미적중: ${sameSet(f31, addressMiss) ? '일치' : '❌ 불일치'} / ` +
      `3-3 실패 == 주소 미적중: ${sameSet(f33, addressMiss) ? '일치' : '❌ 불일치'}`,
    sameSet(f31, addressMiss)
      ? '  ⇒ 예상대로. (말할 수 있는 것은 "08-08 의 58/58 항등식은 깨졌다"까지다 —' +
        ' 적중 49건의 1.000 은 여전히 구조적으로 보장된다.)'
      : '  ⇒ ★불일치. 창/추출 불일치 또는 창보다 작은 드리프트 — **창을 넓히지 말고 원인을 규명할 것.**',
    '',
    '- ★**검사 축 종속 관계**: `lcs === 1 ⟹ 인용은 청크의 부분문자열 ⟹ cov === 1`.',
    '  즉 **3-3 이 통과하면 3-1 은 반드시 통과한다** — 3-1 은 독립 축이 아니라 3-3 의 하위다.',
    `- ★**노드 귀속은 검증되지 않는다**: 청크가 조문 단위가 아니라 페이지 창(median ~5천자, 조문 여러 개)이라`,
    '  이웃 조문 인용도 "통짜로 존재"로 통과한다(실측 48/58 이 다른 노드 청크에도 적중).',
    '  ⇒ **3-1·3-3 의 pass 를 "이 노드의 조문에서 왔다"는 증거로 읽지 말 것.**',
    '',
    `- 미적중 목록: ${[...addressMiss].join(', ') || '(없음)'}`,
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
    `| 3-1 인용↔청크 (이 표본에서는 **주소 정합**) | ${s.byCheck['S3-1-quote']} |`,
    `| 3-2 수치 정합 | ${s.byCheck['S3-2-value']} |`,
    `| 3-3 짜깁기 (LCS 정확 포함) | ${s.byCheck['S3-3-splice']} |`,
    `| 3-4 앵커 충분성 | ${s.byCheck['S3-4-anchor']} |`,
    '',
    '## reject 상세 (주장↔인용 수치 불일치)',
    '',
    '> ⚠️ **"카드가 틀렸다"로 읽지 말 것.** 08-08 독립 리뷰가 이 버킷을 전수 재분류한 결과는',
    '> **카드 오류 0 / 인용 부족 8 / 순수 과탐 3** 이었다. 즉 진앙 다수는 카드가 아니라',
    '> **STAGE 2 인용이 짧게 잘린 것**이다(LAW-145·148·162·172·173·179·195·198).',
    '> 처분 등급(`reject` = 카드 반려)이 진앙과 어긋나 있다는 것은 **미해소 결함**이며,',
    '> STAGE 4 자동 라우터를 붙이기 전에 `queue`(인용 보강)로 분리해야 한다.',
    '> 아래 카드에 `S3-1`/`S3-3` 실패가 함께 붙어 있으면 그 건의 진앙은 **주소 드리프트**다.',
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
