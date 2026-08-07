/**
 * 마이그레이션 0045 — 시행시점 정합 승격 게이트 회귀 테스트.
 *
 * 정책 출처: docs/plans/decision-card-20260807-supersedes-effectivity.md ((C) 채택, 진산 2026-08-07)
 *   + docs/plans/current.plan.md §검증 계획 G-0045-1~8.
 *   STATUS: 선작성본 검증 (production 적용 = 별도 게이트).
 *
 * 불변식 한 문장: **오늘 유효하지 않은 판본은 approved 상태로 서빙 자격을 얻을 수 없다.**
 *   [A] 승격 게이트 — status_transitions INSERT(to_status='approved')
 *   [B] 백필 게이트 — 서빙 중인 행을 오늘 무효로 만드는 valid_* 백필
 *
 * ★ 본 파일의 핵심은 G-0045-7 이다: 트리거 단독 동작이 아니라 **서빙 코어(단일 진실원)와
 *   같은 결론에 도달하는지**를 end-to-end 로 본다. 결정 카드가 기각한 (a) 안의 실패 모드
 *   (blackout / 구·신 동시 노출)가 실제로 0 인지를 서빙 결과 집합으로 직접 확인한다.
 *
 * 하네스: createD1FromAllMigrations() — readdir 자동(0045 포함).
 * 시각 의존: 트리거가 date('now','+9 hours') 를 쓰므로 픽스처 날짜를 **KST 오늘 기준 상대값**으로 생성한다
 *   (하드코딩 날짜는 그날이 지나면 조용히 의미가 뒤집힌다).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createD1FromAllMigrations, type SqliteBackedD1 } from '../helpers/d1-from-sqlite.js';
import { buildApprovedNodesQuery } from '../../search/approved-nodes-sql.js';

/** KST 오늘 (트리거의 date('now','+9 hours') 와 동일 기준). */
function kstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** KST 오늘 ± n일 — 'YYYY-MM-DD'. */
function kstShift(days: number): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000 + days * 86_400_000).toISOString().slice(0, 10);
}

const TODAY = kstToday();
const FUTURE = kstShift(30);
const PAST = kstShift(-30);

let seq = 0;

async function insertNode(
  backend: SqliteBackedD1,
  id: string,
  validFrom: string | null = null,
  validUntil: string | null = null,
): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page, valid_from, valid_until)
       VALUES (?, 'LAW', ?, '법 제1조', 2026, 10, 'draft', 1, 1, ?, ?)`,
    )
    .bind(id, `노드 ${id}`, validFrom, validUntil)
    .run();
}

async function insertFormula(
  backend: SqliteBackedD1,
  id: string,
  validFrom: string | null = null,
): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO formulas (id, name, equation_template, variables_schema, version_year, page_ref, valid_from)
       VALUES (?, '테스트 산식', 'a * b', '{}', 2026, 'p.1', ?)`,
    )
    .bind(id, validFrom)
    .run();
}

async function insertConstant(
  backend: SqliteBackedD1,
  id: string,
  validFrom: string | null = null,
): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO constants (id, category, name, value, applies_to, version_year, page_ref, valid_from)
       VALUES (?, 'ratio', '테스트 상수', '65', '전체', 2026, 'p.1', ?)`,
    )
    .bind(id, validFrom)
    .run();
}

/** 상태 전이 INSERT — transitioned_at 명시(순서 결정성). */
async function transition(
  backend: SqliteBackedD1,
  targetId: string,
  toStatus: string,
  targetType = 'node',
  fromStatus = 'draft',
): Promise<void> {
  seq += 1;
  await backend.db
    .prepare(
      `INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, transitioned_at)
       VALUES (?, ?, ?, ?, ?, 'jinsan', ?)`,
    )
    .bind(
      `ST-${targetId}-${seq}`,
      targetType,
      targetId,
      fromStatus,
      toStatus,
      `2026-08-07T00:00:${String(seq).padStart(2, '0')}.000Z`,
    )
    .run();
}

/** 서빙 자격 노드 id 전수 — 단일 진실원(status + active + 시행시점 창) 그대로. */
async function servedNodeIds(backend: SqliteBackedD1): Promise<string[]> {
  const sql = `${buildApprovedNodesQuery({ projection: 'kn.id AS id' })} ORDER BY kn.id`;
  const res = await backend.db.prepare(sql).all<{ id: string }>();
  return (res.results ?? []).map((r) => r.id);
}

describe('마이그레이션 0045 [A] 승격 게이트 — 오늘 유효하지 않은 판본은 승인 불가', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(() => {
    backend = createD1FromAllMigrations();
    seq = 0;
  });
  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('G-0045-1a — 미래 valid_from 노드의 approved 전이 = ABORT', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-FUTURE', FUTURE);
    await expect(transition(backend, 'NODE-FUTURE', 'approved')).rejects.toThrow(
      /Promotion blocked/,
    );
  });

  it('G-0045-1b — 시행 당일(valid_from = 오늘) 승격 = 통과 (반개구간 하한 포함)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-TODAY', TODAY);
    await transition(backend, 'NODE-TODAY', 'approved');
    expect(await servedNodeIds(backend)).toEqual(['NODE-TODAY']);
  });

  it('G-0045-1c — 과거 valid_from 승격 = 통과', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-PAST', PAST);
    await transition(backend, 'NODE-PAST', 'approved');
    expect(await servedNodeIds(backend)).toEqual(['NODE-PAST']);
  });

  it('G-0045-1d — datetime 포맷도 동일 판정 (date() 정규화 = 서빙 창과 동일 내성)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-ISO-FUTURE', `${FUTURE}T00:00:00Z`);
    await expect(transition(backend, 'NODE-ISO-FUTURE', 'approved')).rejects.toThrow(
      /Promotion blocked/,
    );
    // 같은 포맷이라도 오늘이면 통과해야 한다 — 포맷이 아니라 날짜가 판정 기준
    await insertNode(backend, 'NODE-ISO-TODAY', `${TODAY}T00:00:00Z`);
    await transition(backend, 'NODE-ISO-TODAY', 'approved');
    expect(await servedNodeIds(backend)).toEqual(['NODE-ISO-TODAY']);
  });

  it('G-0045-2 — 만료(valid_until 과거) 승격 = ABORT / 미래 valid_until = 통과', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-EXPIRED', null, PAST);
    await expect(transition(backend, 'NODE-EXPIRED', 'approved')).rejects.toThrow(
      /Promotion blocked/,
    );

    await insertNode(backend, 'NODE-LIVE', null, FUTURE);
    await transition(backend, 'NODE-LIVE', 'approved');
    expect(await servedNodeIds(backend)).toEqual(['NODE-LIVE']);
  });

  it('G-0045-2b — valid_until = 오늘 은 이미 만료 (반개구간 상한 미포함)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-ENDS-TODAY', null, TODAY);
    await expect(transition(backend, 'NODE-ENDS-TODAY', 'approved')).rejects.toThrow(
      /Promotion blocked/,
    );
    // ★리뷰 처분(미러 핀 비대칭): 초판은 ABORT 여부만 봤다. 그러면 코어가 상한을 포함구간으로
    //   바꿔도(`>` → `>=`) 이 테스트는 green 이라 drift 가 침묵한다 — 하한(1b)만 서빙 대조로
    //   묶여 있었다. 상한도 **서빙 결과 집합**으로 묶어 양방향을 e2e 로 고정한다.
    await insertNode(backend, 'NODE-ENDS-TOMORROW', null, kstShift(1));
    await transition(backend, 'NODE-ENDS-TOMORROW', 'approved');
    expect(await servedNodeIds(backend)).toEqual(['NODE-ENDS-TOMORROW']);
  });

  it('★G-0045-3 — valid_* 전부 NULL(현 production 857/857) = 무회귀 통과', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-NULL');
    await transition(backend, 'NODE-NULL', 'approved');
    expect(await servedNodeIds(backend)).toEqual(['NODE-NULL']);
  });

  it('★G-0045-4 — 해석 불가한 날짜 = ABORT (fail-closed / SQLite 3값 논리 fail-open 차단)', async () => {
    if (!backend) throw new Error('backend not initialized');
    // date('언젠가') = NULL. COALESCE 로 붕괴시키지 않으면 WHEN 이 NULL 이라 미발화(=통과)한다.
    // 서빙 창은 이런 값을 감추므로(fail-closed), 승격도 같은 방향이어야 한다.
    await insertNode(backend, 'NODE-GARBAGE', '언젠가');
    await expect(transition(backend, 'NODE-GARBAGE', 'approved')).rejects.toThrow(
      /Promotion blocked/,
    );
    // 실제로 서빙에서도 감춰지는지 대조 (트리거 ↔ 서빙 동일 방향 확인)
    await insertNode(backend, 'NODE-OK');
    await transition(backend, 'NODE-OK', 'approved');
    expect(await servedNodeIds(backend)).toEqual(['NODE-OK']);
  });

  it('G-0045-5a — 승격 외 전이(review/flagged)는 무접촉', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-REVIEW', FUTURE);
    await transition(backend, 'NODE-REVIEW', 'review'); // 통과해야 한다
    await transition(backend, 'NODE-REVIEW', 'flagged', 'node', 'review'); // 통과
    // 그러나 review → approved 는 여전히 차단 (경로가 달라도 승격은 승격)
    await insertNode(backend, 'NODE-REVIEW2', FUTURE);
    await transition(backend, 'NODE-REVIEW2', 'review');
    await expect(transition(backend, 'NODE-REVIEW2', 'approved', 'node', 'review')).rejects.toThrow(
      /Promotion blocked/,
    );
  });

  it('G-0045-5b — formula·constant 대칭 동작 (미래 = ABORT / NULL = 통과)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertFormula(backend, 'F-FUTURE', FUTURE);
    await expect(transition(backend, 'F-FUTURE', 'approved', 'formula')).rejects.toThrow(
      /Promotion blocked: formula/,
    );
    await insertFormula(backend, 'F-NULL');
    await transition(backend, 'F-NULL', 'approved', 'formula');

    await insertConstant(backend, 'C-FUTURE', FUTURE);
    await expect(transition(backend, 'C-FUTURE', 'approved', 'constant')).rejects.toThrow(
      /Promotion blocked: constant/,
    );
    await insertConstant(backend, 'C-NULL');
    await transition(backend, 'C-NULL', 'approved', 'constant');
  });

  it('G-0045-5c — 대상 행 부재 전이는 통과 (본 트리거는 참조 무결성 담당이 아니다)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await transition(backend, 'NODE-ABSENT', 'approved');
    const n = await backend.db
      .prepare(`SELECT COUNT(*) AS n FROM status_transitions WHERE target_id = 'NODE-ABSENT'`)
      .first<{ n: number }>();
    expect(n?.n).toBe(1);
  });
});

describe('마이그레이션 0045 [B] 백필 게이트 — 서빙 중인 행을 오늘 무효로 만들 수 없다', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(() => {
    backend = createD1FromAllMigrations();
    seq = 0;
  });
  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('★G-0045-6a — approved+active 노드에 미래 valid_from 백필 = ABORT (STAGE 2 가 여는 두 번째 문)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-SERVED');
    await transition(backend, 'NODE-SERVED', 'approved');
    expect(await servedNodeIds(backend)).toEqual(['NODE-SERVED']);

    await expect(
      backend.db
        .prepare(`UPDATE knowledge_nodes SET valid_from = ? WHERE id = 'NODE-SERVED'`)
        .bind(FUTURE)
        .run(),
    ).rejects.toThrow(/Effectivity backfill blocked/);
    // 차단됐으므로 서빙 집합 불변 (blackout 미발생)
    expect(await servedNodeIds(backend)).toEqual(['NODE-SERVED']);
  });

  it('G-0045-6b — approved+active 노드에 과거 valid_until 백필 = ABORT / 미래 valid_until = 통과', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-S1');
    await transition(backend, 'NODE-S1', 'approved');
    await expect(
      backend.db
        .prepare(`UPDATE knowledge_nodes SET valid_until = ? WHERE id = 'NODE-S1'`)
        .bind(PAST)
        .run(),
    ).rejects.toThrow(/Effectivity backfill blocked/);

    await insertNode(backend, 'NODE-S2');
    await transition(backend, 'NODE-S2', 'approved');
    await backend.db
      .prepare(`UPDATE knowledge_nodes SET valid_until = ? WHERE id = 'NODE-S2'`)
      .bind(FUTURE)
      .run();
    expect((await servedNodeIds(backend)).sort()).toEqual(['NODE-S1', 'NODE-S2']);
  });

  it('★G-0045-6c — draft 행의 미래 시행일 백필은 통과 (0041 이 예고한 정상 경로 = 미시행 4노드)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-DRAFT');
    await backend.db
      .prepare(`UPDATE knowledge_nodes SET valid_from = ? WHERE id = 'NODE-DRAFT'`)
      .bind(FUTURE)
      .run();
    const row = await backend.db
      .prepare(`SELECT valid_from AS v FROM knowledge_nodes WHERE id = 'NODE-DRAFT'`)
      .first<{ v: string }>();
    expect(row?.v).toBe(FUTURE);
    // 그리고 그 노드는 [A] 때문에 시행일 전까지 승격되지 않는다 (두 게이트의 접합)
    await expect(transition(backend, 'NODE-DRAFT', 'approved')).rejects.toThrow(
      /Promotion blocked/,
    );
  });

  it('G-0045-6d — approved 행이라도 과거 valid_from 백필은 통과 (오늘 유효성 유지)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-BF-PAST');
    await transition(backend, 'NODE-BF-PAST', 'approved');
    await backend.db
      .prepare(`UPDATE knowledge_nodes SET valid_from = ? WHERE id = 'NODE-BF-PAST'`)
      .bind(PAST)
      .run();
    expect(await servedNodeIds(backend)).toEqual(['NODE-BF-PAST']);
  });

  it('G-0045-6e — 은퇴(비활성) 행은 백필 게이트 무접촉 / 0041 NULL→값 1회 규약 무회귀', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-RETIRED');
    await transition(backend, 'NODE-RETIRED', 'approved');
    await backend.db
      .prepare(`UPDATE knowledge_nodes SET is_current_active = 0 WHERE id = 'NODE-RETIRED'`)
      .run();
    // 서빙되지 않는 행이므로 미래 시행일을 넣어도 학습자 영향이 없다 → 통과
    await backend.db
      .prepare(`UPDATE knowledge_nodes SET valid_from = ? WHERE id = 'NODE-RETIRED'`)
      .bind(FUTURE)
      .run();
    // 0041 의 값→값 차단은 그대로 (본 마이그가 완화하지 않았다)
    await expect(
      backend.db
        .prepare(`UPDATE knowledge_nodes SET valid_from = ? WHERE id = 'NODE-RETIRED'`)
        .bind(PAST)
        .run(),
    ).rejects.toThrow(/forbidden/);
  });

  it('G-0045-6f — formula·constant 백필 게이트 대칭', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertFormula(backend, 'F-SERVED');
    await transition(backend, 'F-SERVED', 'approved', 'formula');
    await expect(
      backend.db
        .prepare(`UPDATE formulas SET valid_from = ? WHERE id = 'F-SERVED'`)
        .bind(FUTURE)
        .run(),
    ).rejects.toThrow(/Effectivity backfill blocked/);

    await insertConstant(backend, 'C-SERVED');
    await transition(backend, 'C-SERVED', 'approved', 'constant');
    await expect(
      backend.db
        .prepare(`UPDATE constants SET valid_until = ? WHERE id = 'C-SERVED'`)
        .bind(PAST)
        .run(),
    ).rejects.toThrow(/Effectivity backfill blocked/);
  });

  it('G-0045-6g — is_current_active 플립은 백필 게이트를 발화시키지 않는다 (UPDATE OF 범위)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-FLIP');
    await transition(backend, 'NODE-FLIP', 'approved');
    await backend.db
      .prepare(`UPDATE knowledge_nodes SET is_current_active = 0 WHERE id = 'NODE-FLIP'`)
      .run();
    const row = await backend.db
      .prepare(`SELECT is_current_active AS a FROM knowledge_nodes WHERE id = 'NODE-FLIP'`)
      .first<{ a: number }>();
    expect(row?.a).toBe(0);
  });
});

describe('★마이그레이션 0045 G-0045-7 — 계보 end-to-end: blackout 0 · 구·신 동시 노출 0', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(() => {
    backend = createD1FromAllMigrations();
    seq = 0;
  });
  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('시행 전 — 승격이 차단되고 서빙은 OLD 단독 (결정 카드 §0 표의 blackout 이 발생하지 않는다)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'LAW-OLD');
    await transition(backend, 'LAW-OLD', 'approved');
    await insertNode(backend, 'LAW-NEW', FUTURE);
    // 개정 준비물(SUPERSEDES 엣지)은 미리 걸어 둘 수 있다 — 0042 [1] 은 draft superseder 에 미발화
    await backend.db
      .prepare(
        `INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, is_active) VALUES ('E-SUP', 'LAW-NEW', 'LAW-OLD', 'SUPERSEDES', 1)`,
      )
      .run();
    expect(await servedNodeIds(backend)).toEqual(['LAW-OLD']);

    await expect(transition(backend, 'LAW-NEW', 'approved')).rejects.toThrow(/Promotion blocked/);

    // 승격이 없었으므로 0042 [2] 도 발화하지 않는다 = 구본 은퇴 없음 = blackout 없음
    expect(await servedNodeIds(backend)).toEqual(['LAW-OLD']);
  });

  it('시행일 도래 — 승격 통과 → 0042 정상 발화 → 서빙은 NEW 단독 (동시 노출 0)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'LAW-OLD');
    await transition(backend, 'LAW-OLD', 'approved');
    await insertNode(backend, 'LAW-NEW', TODAY); // 시행일 = 오늘
    await backend.db
      .prepare(
        `INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, is_active) VALUES ('E-SUP', 'LAW-NEW', 'LAW-OLD', 'SUPERSEDES', 1)`,
      )
      .run();

    await transition(backend, 'LAW-NEW', 'approved');

    expect(await servedNodeIds(backend)).toEqual(['LAW-NEW']);
    const oldFlag = await backend.db
      .prepare(`SELECT is_current_active AS a FROM knowledge_nodes WHERE id = 'LAW-OLD'`)
      .first<{ a: number }>();
    expect(oldFlag?.a).toBe(0); // 0042 [2] 승격 동반 flip
  });
});

describe('마이그레이션 0045 G-0045-8 — 트리거 실재 + 판정식 미러 핀 (fail-open 차단)', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(() => {
    backend = createD1FromAllMigrations();
  });
  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('6종 트리거 실재', async () => {
    if (!backend) throw new Error('backend not initialized');
    const res = await backend.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='trigger'
           AND (name LIKE 'enforce_promotion_within_effectivity_%'
             OR name LIKE 'enforce_effectivity_backfill_keeps_serving_%')`,
      )
      .all<{ name: string }>();
    expect((res.results ?? []).map((r) => r.name).sort()).toEqual([
      'enforce_effectivity_backfill_keeps_serving_constants',
      'enforce_effectivity_backfill_keeps_serving_formulas',
      'enforce_effectivity_backfill_keeps_serving_nodes',
      'enforce_promotion_within_effectivity_constants',
      'enforce_promotion_within_effectivity_formulas',
      'enforce_promotion_within_effectivity_nodes',
    ]);
  });

  it('★판정식이 서빙 코어의 미러다 — KST 보정·date() 정규화·3값 논리 붕괴 3요소 전부 실재', async () => {
    if (!backend) throw new Error('backend not initialized');
    const res = await backend.db
      .prepare(
        `SELECT name, sql FROM sqlite_master WHERE type='trigger'
           AND (name LIKE 'enforce_promotion_within_effectivity_%'
             OR name LIKE 'enforce_effectivity_backfill_keeps_serving_%')`,
      )
      .all<{ name: string; sql: string }>();
    const rows = res.results ?? [];
    expect(rows.length).toBe(6);
    for (const r of rows) {
      // TODAY_KST_SQL 미러 — UTC 로 판정하면 시행 당일 9시간을 오판한다
      expect(r.sql, `${r.name}: KST 보정 부재`).toMatch(/\+9 hours/);
      // buildEffectivityWindowSql 미러 — 포맷 내성(문자 사전순 비교 금지)
      expect(r.sql, `${r.name}: date() 정규화 부재`).toMatch(/date\(/);
      // 해석 불가 값에서 WHEN 이 NULL 이 되어 미발화(fail-open)하는 것을 막는 붕괴
      expect(r.sql, `${r.name}: COALESCE 3값 논리 붕괴 부재`).toMatch(/COALESCE\(/);
    }
    // 백필 게이트는 "서빙 중" 판정에 단일 진실원 미러(최신 전이 + rowid 타이브레이커)를 쓴다
    for (const r of rows.filter((x) => x.name.includes('backfill'))) {
      expect(r.sql, `${r.name}: 실 status 도출 미러 부재`).toMatch(/status_transitions/);
      expect(r.sql, `${r.name}: rowid 타이브레이커 부재`).toMatch(/rowid DESC/);
    }
  });
});
