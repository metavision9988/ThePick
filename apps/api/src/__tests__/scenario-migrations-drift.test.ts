/**
 * SCENARIO_MIGRATIONS 재-stale 방지 가드 (2026-08-06 신설).
 *
 * 배경: `d1-from-sqlite.ts` 의 SCENARIO_MIGRATIONS 는 **수동 배열**이라, 새 마이그레이션이
 *   추가되면 사람이 기억해서 등재해야 한다. 그 부채(TD-API-001)가 실제로 터졌다 —
 *   배열이 0037 에서 멈춰 있는 동안 production 은 0038·0041·0042·0044 까지 적용돼 있었고,
 *   시행시점 축을 SELECT 에 배선하자 테스트 19건이 `no such column: kn.valid_from` 로 red 였다.
 *   즉 "테스트가 production 보다 낡았는데 아무도 몰랐다."
 *
 * 이 테스트는 그 망각을 **기계가 잡게** 한다. 배열을 현행화하는 것만으로는 재발을 못 막는다 —
 * 다음에 또 잊으면 똑같아지므로, 잊는 순간 red 가 되게 만드는 것이 실제 해소다.
 *
 * 규약: migrations/ 의 모든 .sql 은 SCENARIO_MIGRATIONS 에 있어야 한다.
 *   의도적으로 제외하려면 아래 INTENTIONALLY_EXCLUDED 에 **사유와 함께** 등재한다
 *   (무음 누락과 의도적 제외를 구분 — 침묵으로 빠지는 경로를 남기지 않는다).
 */

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SCENARIO_MIGRATIONS } from './helpers/d1-from-sqlite.js';

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'migrations',
);

/** 의도적 제외 — key = 파일명, value = 사유. 비어 있는 것이 정상 상태다. */
const INTENTIONALLY_EXCLUDED: Readonly<Record<string, string>> = {};

describe('SCENARIO_MIGRATIONS 드리프트 가드', () => {
  it('migrations/ 의 모든 .sql 이 배열에 등재돼 있다 (누락 = 테스트 스키마가 낡는다)', () => {
    const onDisk = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    const registered = new Set(SCENARIO_MIGRATIONS);
    const missing = onDisk.filter(
      (f) => !registered.has(f) && INTENTIONALLY_EXCLUDED[f] === undefined,
    );
    expect(
      missing,
      `migrations/ 에 있으나 SCENARIO_MIGRATIONS 에 없음: ${missing.join(', ')}\n` +
        `→ d1-from-sqlite.ts 의 배열에 추가하거나, 의도적 제외라면 본 테스트의 ` +
        `INTENTIONALLY_EXCLUDED 에 사유와 함께 등재하라.`,
    ).toEqual([]);
  });

  it('배열에 실재하지 않는 파일이 없다 (유령 등재 = 로딩 실패)', () => {
    const onDisk = new Set(readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')));
    const ghosts = SCENARIO_MIGRATIONS.filter((f) => !onDisk.has(f));
    expect(ghosts, `배열에 있으나 파일 부재: ${ghosts.join(', ')}`).toEqual([]);
  });

  it('적용 순서가 파일명 사전순이다 (번호 역전 = 적용 순서 혼동)', () => {
    const sorted = [...SCENARIO_MIGRATIONS].sort();
    expect(SCENARIO_MIGRATIONS).toEqual(sorted);
  });
});
