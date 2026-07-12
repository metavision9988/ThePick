#!/usr/bin/env node
/* eslint-env node */
/**
 * verify-old-rows-retirement — 0044 마이그 Binary Gate 검산 (plan §5 G-OLD-1·2·4·5).
 *
 * 사용:
 *   node scripts/verify-old-rows-retirement.mjs pre  [--env production|staging]
 *   node scripts/verify-old-rows-retirement.mjs post [--env production|staging]
 *
 * wrangler d1 execute --remote --json 으로 SELECT-only 검산 (쓰기 0).
 * ★분모 하드 검증(525/521/36/4)은 production 전용 — staging 은 데이터 분포가 다르므로
 *   상대 불변식(교집합 0·짝 실재·active=MC)만 판정하고 분모는 리포트만 한다.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const phase = process.argv[2];
const envIdx = process.argv.indexOf('--env');
const env = envIdx >= 0 ? process.argv[envIdx + 1] : 'production';
if (!['pre', 'post'].includes(phase) || !['production', 'staging'].includes(env)) {
  console.error('usage: node scripts/verify-old-rows-retirement.mjs <pre|post> [--env production|staging]');
  process.exit(1);
}
const DB = env === 'production' ? 'thepick-db-production' : 'thepick-db-staging';
const isProd = env === 'production';

const results = [];
let failed = false;
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? ` — ${detail}` : ''}`);
}

function d1(sql) {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB, '--env', env, '--remote', '--json', '--command', sql],
    { cwd: join(ROOT, 'apps', 'api'), encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
  );
  const parsed = JSON.parse(out.slice(out.indexOf('[')));
  return parsed[0].results;
}

const OLD_PRED = "exam_type='1st' AND input_type='fill_blank' AND id NOT LIKE '%-MC'";
const corrections = JSON.parse(
  readFileSync(join(ROOT, 'docs/batch-load/promo-mc-distractors/answer-corrections.json'), 'utf-8'),
);
const EXCLUSIONS = corrections.exclusions.map((e) => e.id ?? e);

// ── G-OLD-1: answer-integrity (pre/post 동일 — D-14 영속 게이트)
{
  check('G-OLD-1a corrections 정본 무결(pending 0)', (corrections._meta?.pending ?? corrections.pending ?? []).length === 0);
  check('G-OLD-1b corrections 36건', corrections.corrections.length === 36, String(corrections.corrections.length));
  check('G-OLD-1c exclusions 4건', EXCLUSIONS.length === 4, EXCLUSIONS.join(','));
  const ids = corrections.corrections.map((c) => `'${c.id}-MC'`).join(',');
  const rows = d1(`SELECT id, answer FROM exam_questions WHERE id IN (${ids})`);
  const byId = new Map(rows.map((r) => [r.id, r.answer]));
  const mismatch = corrections.corrections.filter((c) => byId.get(`${c.id}-MC`) !== c.corrected);
  if (isProd) {
    check(
      'G-OLD-1d -MC answer == corrected 36/36',
      rows.length === 36 && mismatch.length === 0,
      mismatch.length > 0 ? `mismatch: ${mismatch.slice(0, 3).map((m) => m.id).join(',')}` : `rows=${rows.length}`,
    );
  } else {
    // staging = -MC 미적재 환경(P3 는 production 전용) — 교정 검산은 리포트만.
    check('G-OLD-1d(staging) -MC 교정 리포트만', true, `rows=${rows.length}/36`);
  }
}

// ── 상태 스냅샷 (공용)
const [snap] = d1(`SELECT
  (SELECT COUNT(*) FROM exam_questions WHERE ${OLD_PRED}) AS old_total,
  (SELECT COUNT(*) FROM exam_questions WHERE ${OLD_PRED} AND status='active') AS old_active,
  (SELECT COUNT(*) FROM exam_questions WHERE ${OLD_PRED} AND status='deprecated') AS old_deprecated,
  (SELECT COUNT(*) FROM exam_questions WHERE exam_type='1st' AND id LIKE '%-MC') AS mc_total,
  (SELECT COUNT(*) FROM exam_questions WHERE exam_type='1st' AND status='active') AS active_1st,
  (SELECT COUNT(*) FROM exam_questions WHERE exam_type='1st' AND status='active' AND input_type<>'multiple_choice') AS active_1st_non_mc`);
console.log(`snapshot(${env}):`, JSON.stringify(snap));

if (phase === 'pre') {
  // ── G-OLD-2: 워터마크 (production 하드 분모 / staging 리포트)
  if (isProd) {
    check('G-OLD-2a old 분모 == 525 (전부 active)', snap.old_total === 525 && snap.old_active === 525, `total=${snap.old_total} active=${snap.old_active}`);
    check('G-OLD-2b -MC == 521', snap.mc_total === 521, String(snap.mc_total));
  } else {
    check('G-OLD-2(staging) 분모 리포트만', true, `old=${snap.old_total} mc=${snap.mc_total}`);
  }
  // G-OLD-2c 교집합 0 (D-30): old 술어(id NOT LIKE '%-MC') ↔ -MC(id LIKE '%-MC') 는
  // 정의상 상보 — DB 판정으로 명문화(plan §5 3항 1:1) + corrections↔exclusions disjoint.
  const [inter] = d1(
    `SELECT COUNT(*) AS n FROM exam_questions WHERE ${OLD_PRED} AND id LIKE '%-MC'`,
  );
  const corrIds = new Set(corrections.corrections.map((c) => c.id));
  const overlap = EXCLUSIONS.filter((id) => corrIds.has(id));
  check('G-OLD-2c 교집합 0 (old∩MC=0 + corrections∩exclusions=0)', inter.n === 0 && overlap.length === 0, `db=${inter.n} corr=${overlap.length}`);
  // ── G-OLD-3: 오프사이트 백업 — pre 게이트가 백업 스크립트를 직접 실행·판정
  //    (스냅샷 "실재 확인"보다 강한 보장: 이 시점 RPO 확보. 런북 §10 정합)
  if (isProd) {
    let backupOk = false;
    let detail = '';
    try {
      const out = execFileSync('bash', [join(ROOT, 'scripts', 'backup-d1-to-r2.sh')], {
        encoding: 'utf-8',
        maxBuffer: 16 * 1024 * 1024,
      });
      backupOk = out.includes('backup complete');
      detail = out.trim().split('\n').at(-1) ?? '';
    } catch (err) {
      detail = String(err).slice(0, 120);
    }
    check('G-OLD-3 오프사이트 백업 실행(backup-d1-to-r2.sh)', backupOk, detail);
  }
} else {
  // ── G-OLD-4: 전이 완결성
  const expectedOld = isProd ? 525 : snap.old_total;
  check('G-OLD-4a old 전부 deprecated (active 0)', snap.old_active === 0 && snap.old_deprecated === expectedOld, `deprecated=${snap.old_deprecated}/${expectedOld} active=${snap.old_active}`);
  const [links] = d1(`SELECT
    (SELECT COUNT(*) FROM exam_questions o
      WHERE o.exam_type='1st' AND o.input_type='fill_blank' AND o.id NOT LIKE '%-MC'
        AND o.status='deprecated' AND o.superseded_by IS NOT NULL
        AND EXISTS (SELECT 1 FROM exam_questions m WHERE m.id = o.superseded_by
                      AND m.status='active' AND m.input_type='multiple_choice')) AS linked_ok,
    (SELECT COUNT(*) FROM exam_questions o
      WHERE o.exam_type='1st' AND o.input_type='fill_blank' AND o.id NOT LIKE '%-MC'
        AND o.status='deprecated' AND o.superseded_by IS NULL) AS null_links`);
  if (isProd) {
    check('G-OLD-4b superseded_by 521건 전부 active -MC 짝 실재', links.linked_ok === 521, String(links.linked_ok));
    const nullRows = d1(`SELECT id FROM exam_questions WHERE ${OLD_PRED} AND status='deprecated' AND superseded_by IS NULL ORDER BY id`);
    const nullIds = nullRows.map((r) => r.id).sort();
    const expected = [...EXCLUSIONS].sort();
    check('G-OLD-4c NULL 4건 == 구조훼손 목록', JSON.stringify(nullIds) === JSON.stringify(expected), nullIds.join(','));
  } else {
    // 상대 불변식(분포 무관): 비NULL superseded_by 는 전부 active MC 짝으로 해소돼야 함
    // — linked_ok + null_links == deprecated 전량 (dangling 링크 = FAIL). 4-Pass MAJOR-1/5.
    check(
      'G-OLD-4(staging) dangling 링크 0 (linked+null == deprecated)',
      links.linked_ok + links.null_links === snap.old_deprecated,
      `linked=${links.linked_ok} null=${links.null_links} deprecated=${snap.old_deprecated}`,
    );
  }
  // ── G-OLD-5: active 1차 = 전부 MC
  if (isProd) {
    check('G-OLD-5 active 1st == 521 == 전부 MC', snap.active_1st === 521 && snap.active_1st_non_mc === 0, `active=${snap.active_1st} nonMc=${snap.active_1st_non_mc}`);
  } else {
    check('G-OLD-5(staging) active 1st 비MC == 0', snap.active_1st_non_mc === 0, `active=${snap.active_1st}`);
  }
  // 트리거 재생성 확인
  const trig = d1(`SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='exam_questions'`);
  const names = trig.map((t) => t.name);
  check('G-OLD-post 트리거 재생성(prevent_exam_questions_body_update)', names.includes('prevent_exam_questions_body_update'), names.join(','));
}

const pass = results.filter((r) => r.ok).length;
console.log(`\n${failed ? '🔴 FAIL' : '🟢 PASS'} — ${pass}/${results.length} checks (${phase}, ${env})`);
process.exit(failed ? 1 : 0);
