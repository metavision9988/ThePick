/** v2 queryBody 파생 — 정본 파이프라인(buildOutputs: 제거전용·answer-leak assert) 재사용, v2 파일 대상. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOutputs } from '/home/soo/ClaudePro/ThePick/scripts/build-querybody-golden.mjs';

const DIR = '/home/soo/ClaudePro/ThePick/docs/plans/s5-6-measurements';
const src = JSON.parse(readFileSync(join(DIR, 'golden-pilot-approved.v2.json'), 'utf-8'));
// answer-leak 내장 문항(동결본에 exclusionReason 명기·measurable=false)은 파생 자체에서 제외 —
// buildBody 가드가 실발화하는 오염 본문이므로 queryBody 산출 대상 아님(무음 아님: 아래 로그).
const excluded = src.items.filter((i) => i.exclusionReason);
src.items = src.items.filter((i) => !i.exclusionReason);
for (const e of excluded) console.log(`⛔ 파생 제외: ${e.questionId} — ${e.exclusionReason}`);
const { rows, measureItems, over500, outJson, outDebugJson, logText } = buildOutputs(src);

writeFileSync(join(DIR, 'golden-pilot-approved.v2.querybody.json'), JSON.stringify(outJson, null, 2));
writeFileSync(join(DIR, 'golden-pilot-approved.v2.querybody.debug.json'), JSON.stringify(outDebugJson, null, 2));
writeFileSync(join(DIR, 'querybody-removal-log.v2.md'), logText);

console.log(`측정 분모 measurable: ${measureItems.length}`);
for (const r of rows) console.log(`  ${r.questionId.padEnd(22)} ${String(r.origLen).padStart(5)} → ${String(r.bodyLen).padStart(5)}  ${r.le500 ? '측정' : '>500제외'}  (hop=${r.hop})`);
console.log(`제외(>500 잔존): ${over500.join(', ') || '없음'}`);
