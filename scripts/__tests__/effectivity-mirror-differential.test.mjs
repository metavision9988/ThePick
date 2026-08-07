/**
 * 시행시점 창 — **차등 테스트**: 서빙 SQL(실 SQLite 실행) ↔ 감사 코어 TS 미러.
 *
 * ★왜 이 파일이 존재하는가 (2026-08-07 리뷰 3라운드):
 *   `packages/quality` 의 `isServedToday`/`normalizeDate` 는
 *   `apps/api/src/search/approved-nodes-sql.ts` 의 `buildEffectivityWindowSql` 을 **손으로 옮긴 미러**다.
 *   그 미러가 **세 라운드 연속으로 fail-open 을 재도입**했다:
 *     1R: trim()+slice(0,10)        → ' 2026-08-07' · '2026-08-07x' 통과
 *     2R: tail 을 `(?:[T ].*)?` 로 개방 → '2026-08-15 시행' · '...T99:99:99' · '...+0900' 통과
 *         ★정상 ISO 오프셋 '+09:00' 에서도 갈림(SQLite 는 UTC 환산 → 날짜 하루 밀림)
 *   매번 **손으로 고른 문자열 2~3개**로만 검증했기 때문에 같은 사각지대가 살아남았다.
 *
 *   fail-open 이 위험한 이유: 서빙에서 사라진 행을 감사 코어가 "서빙 중"으로 보면
 *   `LINEAGE_GAP`·`LINEAGE_LAPSE` 가 둘 다 침묵하고 게이트가 초록이 된다(= 무증상 blackout).
 *
 * ⇒ 손 미러를 손으로 검증하지 않는다. **실제 SQLite 에 서빙 SQL 을 돌려** 그 결과와 대조한다.
 *   불일치가 있어도 **fail-closed 방향(SQL=서빙 / TS=미서빙)만 허용**한다 — 시끄러운 것은 안전하고
 *   조용한 것이 위험하다. fail-open 이 1건이라도 나오면 red.
 *
 * 이 파일이 scripts/ 에 있는 이유: 두 축(apps/api 서빙 SQL · packages/quality 감사 코어)을 동시에
 * 소비하는 지점이 무결성 러너(scripts/run-graph-integrity-production.ts)이기 때문이다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** TS 미러 판정을 tsx 로 1회 호출해 배치로 받는다 (프로세스 기동 비용 1회). */
function tsMirrorVerdicts(values, todayKst) {
  const script = `
import { findLineageAnomalies } from '${join(ROOT, 'packages/quality/src/production-audit.ts').replace(/\\/g, '/')}';
const values = ${JSON.stringify(values)};
const today = ${JSON.stringify(todayKst)};
const out = values.map((v, i) => {
  const rows = [{ id: 'N' + i, type: 'CONCEPT', name: 'n', is_current_active: 1,
                  effective_status: 'approved', valid_from: v.from, valid_until: v.until }];
  const r = findLineageAnomalies(rows, [], today);
  // LAPSE 가 나오면 = 미서빙 판정
  return r.measured && r.anomalies.length === 0;
});
process.stdout.write(JSON.stringify(out));
`;
  const res = execFileSync(join(ROOT, 'packages/quality/node_modules/.bin/tsx'), ['--eval', script], {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(res.trim().split('\n').pop());
}

/** 서빙 SQL 판정 — 실제 SQLite 에 buildEffectivityWindowSql 규약을 그대로 실행. */
function sqlVerdicts(values) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE t (id TEXT PRIMARY KEY, valid_from TEXT, valid_until TEXT)');
  const ins = db.prepare('INSERT INTO t (id, valid_from, valid_until) VALUES (?, ?, ?)');
  values.forEach((v, i) => ins.run('N' + i, v.from, v.until));
  // apps/api/src/search/approved-nodes-sql.ts buildEffectivityWindowSql 과 동일 규약
  const rows = db
    .prepare(
      `SELECT id FROM t
        WHERE (valid_from  IS NULL OR date(valid_from)  <= date('now','+9 hours'))
          AND (valid_until IS NULL OR date(valid_until) >  date('now','+9 hours'))`,
    )
    .all();
  const served = new Set(rows.map((r) => r.id));
  const today = db.prepare(`SELECT date('now','+9 hours') AS d`).get().d;
  db.close();
  return { served: values.map((_, i) => served.has('N' + i)), today };
}

test('시행시점 창 미러 — 서빙 SQL ↔ 감사 코어: fail-open 0 (fail-closed 만 허용)', () => {
  const base = [
    null,
    '', // 빈 문자열
    '   ',
    '2026-08-15',
    '2026-8-15', // 무패딩
    '20260815',
    '2026-13-45', // 범위 초과
    '2026-02-30', // SQLite 는 3/2 로 정규화
    '2026-02-29', // 비윤년
    'now',
    '언젠가',
    ' 2026-08-15', // 앞 공백 (1R 구멍)
    '2026-08-15 ', // 뒤 공백
    '2026-08-15x', // 뒤 오염 (1R 구멍)
    '2026-08-15 시행', // 실물 백필 오염 (2R 구멍)
    '2026-08-15 (시행)',
    '2026-08-15 00:00:00 KST',
    '2026-08-15T00:00:00Z',
    '2026-08-15T00:00:00',
    '2026-08-15 00:00:00',
    '2026-08-15T00:00',
    '2026-08-15T99:99:99', // 시각 범위 초과 (2R 구멍)
    '2026-08-15T00:00:00+09:00', // ★정상 ISO 오프셋 — SQLite 는 UTC 환산 (2R 구멍)
    '2026-08-15T00:00:00+0900',
    '2026-08-15T00:00:00.123Z',
    '0000-01-01',
    '9999-12-31',
  ];

  // valid_from 축 · valid_until 축 양쪽 전수
  const values = [
    ...base.map((v) => ({ from: v, until: null })),
    ...base.map((v) => ({ from: null, until: v })),
  ];

  const { served: sqlServed, today } = sqlVerdicts(values);
  const tsServed = tsMirrorVerdicts(values, today);

  assert.equal(tsServed.length, values.length, 'TS 미러 판정 개수 불일치');

  const failOpen = [];
  const failClosed = [];
  values.forEach((v, i) => {
    if (sqlServed[i] === tsServed[i]) return;
    const label = `from=${JSON.stringify(v.from)} until=${JSON.stringify(v.until)}`;
    if (tsServed[i] === true) failOpen.push(label); // SQL=미서빙인데 TS=서빙 → 침묵 위험
    else failClosed.push(label);
  });

  assert.deepEqual(
    failOpen,
    [],
    `★fail-open 발견 — 서빙 SQL 은 감추는데 감사 코어가 "서빙 중"으로 봤다.\n` +
      `이 방향은 GAP·LAPSE 를 침묵시켜 무증상 blackout 을 만든다.\n` +
      `해당: ${failOpen.join(' | ')}`,
  );
  // fail-closed 는 허용(시끄러운 방향)이나, 몇 건인지는 기록으로 남긴다.
  assert.ok(failClosed.length >= 0);
});
