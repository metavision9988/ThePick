/**
 * golden v2 병합·동결 — pilot 12(동결본 불변) + 확대 22(진산 일괄 승인 2026-07-07).
 * 원본 파일 무변경. 산출 = golden-pilot-approved.v2.json (approved 스키마 정합).
 * 본문 조립 = batch-load 로컬 적재본 stem+options (정답·해설 원천 미포함 = answer-leak 구조 차단).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { globSync } from 'node:fs';

const ROOT = '/home/soo/ClaudePro/ThePick';
const DIR = join(ROOT, 'docs/plans/s5-6-measurements');

const pilot = JSON.parse(readFileSync(join(DIR, 'golden-pilot-approved.json'), 'utf-8'));
const draft = JSON.parse(readFileSync(join(DIR, 'golden-expansion-draft-20260702.json'), 'utf-8'));

// batch-load 전수에서 문항 본문 인덱스 구축
import { readdirSync, statSync } from 'node:fs';
function* walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.json')) yield p;
  }
}
const bodies = new Map();
for (const f of walk(join(ROOT, 'docs/batch-load'))) {
  let data;
  try { data = JSON.parse(readFileSync(f, 'utf-8')); } catch { continue; }
  const qs = Array.isArray(data) ? data : (data.questions ?? data.items ?? []);
  if (!Array.isArray(qs)) continue;
  for (const q of qs) {
    const qid = q?.id ?? q?.questionId;
    const hasBody = (q?.stem && Array.isArray(q?.options)) || typeof q?.content === 'string';
    if (qid && hasBody && !bodies.has(qid)) bodies.set(qid, q);
  }
}

const MARK = ['①', '②', '③', '④', '⑤'];
// hop 축 정정(2026-07-07 표적 재검 — 스팟검증 FIX 1 + 21문항 재판정 5 FLIP = 6건 multi→single.
// 기전 = 코퍼스 중복 인코딩 착시(동일 판별 지식이 2~3 노드에 완결 수록). 채점 무관·세그먼트 해석 전용).
const HOP_FLIPS = new Set(['Q-2019-05-050', 'Q-2020-06-050', 'Q-2021-07-048', 'Q-2022-08-049', 'Q-2024-10-044', 'Q-2025-11-046']);
const newItems = draft.items.map((it) => {
  const src = bodies.get(it.questionId);
  if (!src) throw new Error(`본문 미회수: ${it.questionId}`);
  // 1차 = stem+options 조립 / 2차 = 출제 본문(content) 그대로 — 정답·해설은 별도 필드라 원천 미유입.
  const content = src.stem
    ? `${src.stem}\n\n${src.options.map((o, i) => `${MARK[i]}. ${o}`).join('\n')}`
    : src.content;
  const m = it.questionId.match(/^Q-(\d{4})-(\d{2})-(?:2ND-)?(\d{3})$/) ?? [];
  const [, yy, rr, nn] = m;
  // 정직 제외(Q-004 선례): cleaned-extract content 에 모범 풀이 내장(➡·'따라서…=값원' — answer-leak
  // 가드 실발화 확증) = 제거 불가/고비용 → 측정 분모에서 제외, 라벨은 보존(후속 원문 재추출 시 복귀 가능).
  const leakEmbedded = it.questionId === 'Q-2025-11-2ND-006';
  return {
    questionId: it.questionId,
    meta: { year: Number(yy), round: Number(rr), questionNumber: Number(nn), subject: it.subject },
    content,
    contentExcerpt: content.slice(0, 300),
    measurable: leakEmbedded ? false : it.measurable,
    ...(leakEmbedded ? { exclusionReason: 'answer-leak 내장(모범 풀이가 content 에 병합된 추출 오염) — 가드 실발화, 정직 제외' } : {}),
    expected: it.expected.map((e) => ({ id: e.nodeId, name: e.nodeName })),
    why: it.labelNote ?? '',
    hopGuess: HOP_FLIPS.has(it.questionId) ? 'single' : it.hopGuess,
    ...(HOP_FLIPS.has(it.questionId) ? { hopNote: 'multi→single 정정(2026-07-07 hop 표적 재검 — 중복 인코딩 착시)' } : {}),
    confidence: it.expected[0]?.confidence ?? 'high',
    jinsanReview: 'BULK-APPROVED',
    approximateGolden: true,
    relatedNodesRaw: JSON.stringify(it.expected.map((e) => e.nodeId)),
  };
});

const out = {
  ...pilot,
  $schema: 'S5-6b golden approved v2 (N=34)',
  generatedAt: '2026-07-07',
  method: `${pilot.method} + expansion-draft 22 병합(build=golden-expansion-draft-20260702, 독립 적대검증 APPROVE 21/FIX 1 반영본)`,
  jinsanReview:
    '★일괄 승인(2026-07-07 진산 발화 "그냥 고고") — 행당 인간 검수 생략. 대체 백스톱 = AI 도메인 렌즈 스팟 5문항 적대검증(카드 #3/#7/#12/#16/#21). ' +
    '측정 결과 캐비앳 의무: 신규 22 라벨 = AI 생성 + AI 적대검증(인간 무검수) — 순환편향 잔여 리스크는 GO/NO-GO 판단 시 고지. 대체 백스톱 실행 결과 = 스팟 5문항 라벨 실체 5/5 반증 실패 + hop 축 전량 재검(6 flip 반영).',
  summary: { pilotN: pilot.items.length, expansionN: newItems.length, totalN: pilot.items.length + newItems.length },
  items: [...pilot.items, ...newItems],
};

writeFileSync(join(DIR, 'golden-pilot-approved.v2.json'), JSON.stringify(out, null, 2));
console.log(`동결: N=${out.items.length} (pilot ${pilot.items.length} + 확대 ${newItems.length}) → golden-pilot-approved.v2.json`);
console.log(`measurable: ${out.items.filter((i) => i.measurable).length}`);
