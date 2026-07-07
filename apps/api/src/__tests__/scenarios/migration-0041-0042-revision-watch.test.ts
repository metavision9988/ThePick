/**
 * 마이그레이션 0041/0042 — Revision Watch Phase 0(시행시점 축)·Phase 1(GAP-RW-4 트리거 지뢰) 회귀 테스트.
 *
 * 정책 출처: docs/plans/revision-watch.plan.md §3-C C-1(2단 트리거)·§5(백필 패턴)·§6 G-RW-1/G-RW-2
 *   — §9 위임 결재(2026-07-07). STATUS: 선작성본 검증(production 적용 = 진산 인증 게이트 별도).
 *
 * 하네스: createD1FromAllMigrations() — readdir 자동(0041/0042 포함, 큐레이션 배열 미사용).
 * 핵심 불변식:
 *   [G-RW-1] valid_from/valid_until 은 NULL→값 1회 백필만 허용(0016 선례), 이후 불변.
 *   [G-RW-2] (a) draft superseder 의 SUPERSEDES INSERT 는 approved old 노드를 비활성화하지 않고
 *            (b) 그 superseder 승격 시점에 old 가 flip + 계보 이중 active 0.
 *   실 status 도출 = APPROVED_NODES_STATUS_CORE 미러(최신 status_transitions, 무이력='draft').
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createD1FromAllMigrations, type SqliteBackedD1 } from '../helpers/d1-from-sqlite.js';

let seq = 0;

async function insertNode(backend: SqliteBackedD1, id: string): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page)
       VALUES (?, 'LAW', ?, '법 제1조', 2026, 10, 'draft', 1, 1)`,
    )
    .bind(id, `노드 ${id}`)
    .run();
}

/** 실 status 전이 — transitioned_at 명시(순서 결정성). */
async function transition(
  backend: SqliteBackedD1,
  targetId: string,
  toStatus: string,
): Promise<void> {
  seq += 1;
  await backend.db
    .prepare(
      `INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, transitioned_at)
       VALUES (?, 'node', ?, 'draft', ?, 'jinsan', ?)`,
    )
    .bind(
      `ST-${targetId}-${seq}`,
      targetId,
      toStatus,
      `2026-07-07T00:00:${String(seq).padStart(2, '0')}.000Z`,
    )
    .run();
}

async function insertEdge(
  backend: SqliteBackedD1,
  id: string,
  from: string,
  to: string,
  edgeType = 'SUPERSEDES',
  isActive = 1,
): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, is_active) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, from, to, edgeType, isActive)
    .run();
}

async function activeFlag(backend: SqliteBackedD1, id: string): Promise<number> {
  const row = await backend.db
    .prepare(`SELECT is_current_active AS a FROM knowledge_nodes WHERE id = ?`)
    .bind(id)
    .first<{ a: number }>();
  if (!row) throw new Error(`node ${id} not found`);
  return row.a;
}

async function columns(backend: SqliteBackedD1, table: string): Promise<string[]> {
  const res = await backend.db
    .prepare(`SELECT name FROM pragma_table_info(?)`)
    .bind(table)
    .all<{ name: string }>();
  return (res.results ?? []).map((r) => r.name);
}

describe('마이그레이션 0041 — Revision Watch Phase 0 (시행시점 축 + 백필 가드)', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(() => {
    backend = createD1FromAllMigrations();
    seq = 0;
  });
  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('G-RW-1a — 신규 컬럼 실재: knowledge_nodes/formulas/constants/revision_changes', async () => {
    if (!backend) throw new Error('backend not initialized');
    expect(await columns(backend, 'knowledge_nodes')).toEqual(
      expect.arrayContaining(['valid_from', 'valid_until', 'source_url', 'source_article_code']),
    );
    expect(await columns(backend, 'formulas')).toEqual(
      expect.arrayContaining(['valid_from', 'valid_until']),
    );
    expect(await columns(backend, 'constants')).toEqual(
      expect.arrayContaining(['valid_from', 'valid_until']),
    );
    expect(await columns(backend, 'revision_changes')).toEqual(
      expect.arrayContaining(['effective_date', 'exam_id', 'source_ref', 'status']),
    );
  });

  it('G-RW-1b — valid_from: NULL→값 1회 백필 허용, 값→값·값→NULL 차단 (knowledge_nodes)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-BF');

    // NULL → 값 (Phase 2 백필 경로) = 허용
    await backend.db
      .prepare(`UPDATE knowledge_nodes SET valid_from = '2026-08-15' WHERE id = 'NODE-BF'`)
      .run();
    const row = await backend.db
      .prepare(`SELECT valid_from AS v FROM knowledge_nodes WHERE id = 'NODE-BF'`)
      .first<{ v: string }>();
    expect(row?.v).toBe('2026-08-15');

    // 값 → 다른 값 = ABORT
    await expect(
      backend.db
        .prepare(`UPDATE knowledge_nodes SET valid_from = '2027-01-01' WHERE id = 'NODE-BF'`)
        .run(),
    ).rejects.toThrow(/forbidden/);
    // 값 → NULL = ABORT
    await expect(
      backend.db.prepare(`UPDATE knowledge_nodes SET valid_from = NULL WHERE id = 'NODE-BF'`).run(),
    ).rejects.toThrow(/forbidden/);
  });

  it('G-RW-1c — 기존 가드 보존: 본문(name) UPDATE ABORT / is_current_active flip 허용', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-GUARD');
    await expect(
      backend.db.prepare(`UPDATE knowledge_nodes SET name = '변조' WHERE id = 'NODE-GUARD'`).run(),
    ).rejects.toThrow(/forbidden/);
    await backend.db
      .prepare(`UPDATE knowledge_nodes SET is_current_active = 0 WHERE id = 'NODE-GUARD'`)
      .run();
    expect(await activeFlag(backend, 'NODE-GUARD')).toBe(0);
  });

  it('G-RW-1d — formulas·constants valid_from 백필 패턴 동작', async () => {
    if (!backend) throw new Error('backend not initialized');
    await backend.db
      .prepare(
        `INSERT INTO formulas (id, name, equation_template, variables_schema, version_year, page_ref)
         VALUES ('F-RW-1', '테스트 산식', 'a * b', '{}', 2026, 'p.1')`,
      )
      .run();
    await backend.db
      .prepare(`UPDATE formulas SET valid_from = '2026-08-15' WHERE id = 'F-RW-1'`)
      .run();
    await expect(
      backend.db.prepare(`UPDATE formulas SET valid_from = '2027-01-01' WHERE id = 'F-RW-1'`).run(),
    ).rejects.toThrow(/forbidden/);
    // 기존 본문 가드 보존 (equation_template = L3 서비스 사망 클래스)
    await expect(
      backend.db
        .prepare(`UPDATE formulas SET equation_template = 'a + b' WHERE id = 'F-RW-1'`)
        .run(),
    ).rejects.toThrow(/forbidden/);

    await backend.db
      .prepare(
        `INSERT INTO constants (id, category, name, value, applies_to, version_year, page_ref)
         VALUES ('C-RW-1', 'ratio', '테스트 상수', '65', '전체', 2026, 'p.1')`,
      )
      .run();
    await backend.db
      .prepare(`UPDATE constants SET valid_from = '2026-08-15' WHERE id = 'C-RW-1'`)
      .run();
    await expect(
      backend.db.prepare(`UPDATE constants SET valid_from = NULL WHERE id = 'C-RW-1'`).run(),
    ).rejects.toThrow(/forbidden/);
    await expect(
      backend.db.prepare(`UPDATE constants SET value = '60' WHERE id = 'C-RW-1'`).run(),
    ).rejects.toThrow(/forbidden/);
  });

  it('G-RW-1f — 0019 출처 앵커 4컬럼 + created_at 하드 차단 (리뷰 MAJOR: 선재 구멍 봉합)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-ANCHOR');
    for (const [col, val] of [
      ['book_page', '999'],
      ['pdf_page', '777'],
      ['chapter', `'오염'`],
      ['section', `'오염'`],
      ['created_at', `'2099-01-01'`],
    ] as const) {
      await expect(
        backend.db
          .prepare(`UPDATE knowledge_nodes SET ${col} = ${val} WHERE id = 'NODE-ANCHOR'`)
          .run(),
      ).rejects.toThrow(/forbidden/);
    }
  });

  it('G-RW-1g — WHEN 행 단위 회귀: status 스냅샷 동결 + source_url 백필 후 변조 차단 (뮤테이션 MUT-7/8 킬)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-ROW');
    // status 행 삭제 뮤테이션 킬: 스냅샷 status 직접 변조 = ABORT
    await expect(
      backend.db
        .prepare(`UPDATE knowledge_nodes SET status = 'approved' WHERE id = 'NODE-ROW'`)
        .run(),
    ).rejects.toThrow(/forbidden/);
    // source_url 가드 행 삭제 뮤테이션 킬: NULL→값 1회 후 값→값 = ABORT
    await backend.db
      .prepare(
        `UPDATE knowledge_nodes SET source_url = 'https://law.go.kr/a' WHERE id = 'NODE-ROW'`,
      )
      .run();
    await expect(
      backend.db
        .prepare(
          `UPDATE knowledge_nodes SET source_url = 'https://law.go.kr/b' WHERE id = 'NODE-ROW'`,
        )
        .run(),
    ).rejects.toThrow(/forbidden/);
  });

  it('G-RW-1e — 가드 트리거 3종 재구축 실재 (fail-open/no-op 위양성 차단)', async () => {
    if (!backend) throw new Error('backend not initialized');
    const res = await backend.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'trigger'
          AND name IN ('prevent_knowledge_nodes_update', 'prevent_formulas_update', 'prevent_constants_update')`,
      )
      .all<{ name: string }>();
    expect((res.results ?? []).map((r) => r.name).sort()).toEqual([
      'prevent_constants_update',
      'prevent_formulas_update',
      'prevent_knowledge_nodes_update',
    ]);
  });
});

describe('마이그레이션 0042 — GAP-RW-4 트리거 지뢰 수정 (2단 트리거, G-RW-2)', () => {
  let backend: SqliteBackedD1 | null = null;

  /** 표준 계보 시드: OLD(실 approved·active) ← SUPERSEDES ← NEW(draft). */
  async function seedLineage(): Promise<void> {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'NODE-OLD');
    await transition(backend, 'NODE-OLD', 'approved'); // OLD = 실 approved
    await insertNode(backend, 'NODE-NEW'); // NEW = 무이력 = 실 draft
  }

  beforeEach(() => {
    backend = createD1FromAllMigrations();
    seq = 0;
  });
  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('★G-RW-2a — draft superseder 의 SUPERSEDES INSERT 는 approved old 를 비활성화하지 않는다 (지뢰 수정 본체)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await seedLineage();
    await insertEdge(backend, 'E-RW-1', 'NODE-NEW', 'NODE-OLD');
    // 수정 전(0013 원본)이라면 여기서 OLD 가 즉사(0) — 수정 후 잔존해야 한다.
    expect(await activeFlag(backend, 'NODE-OLD')).toBe(1);
  });

  it('★G-RW-2b — superseder 승격 시점에 old flip + 계보 이중 active 0', async () => {
    if (!backend) throw new Error('backend not initialized');
    await seedLineage();
    await insertEdge(backend, 'E-RW-1', 'NODE-NEW', 'NODE-OLD');
    await transition(backend, 'NODE-NEW', 'approved'); // 승격 → 동반 트리거 발화
    expect(await activeFlag(backend, 'NODE-OLD')).toBe(0);
    expect(await activeFlag(backend, 'NODE-NEW')).toBe(1);
    const dual = await backend.db
      .prepare(
        `SELECT COUNT(*) AS n FROM knowledge_nodes WHERE id IN ('NODE-OLD','NODE-NEW') AND is_current_active = 1`,
      )
      .first<{ n: number }>();
    expect(dual?.n).toBe(1);
  });

  it('G-RW-2c — 이미 approved 인 superseder 의 엣지 INSERT 는 즉시 flip ([1] 경로)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await seedLineage();
    await transition(backend, 'NODE-NEW', 'approved'); // 엣지보다 먼저 승격
    await insertEdge(backend, 'E-RW-1', 'NODE-NEW', 'NODE-OLD');
    expect(await activeFlag(backend, 'NODE-OLD')).toBe(0);
  });

  it('G-RW-2d — is_active=0 엣지는 어느 경로로도 flip 하지 않는다', async () => {
    if (!backend) throw new Error('backend not initialized');
    await seedLineage();
    await insertEdge(backend, 'E-RW-1', 'NODE-NEW', 'NODE-OLD', 'SUPERSEDES', 0);
    expect(await activeFlag(backend, 'NODE-OLD')).toBe(1); // [1] 미발화
    await transition(backend, 'NODE-NEW', 'approved');
    expect(await activeFlag(backend, 'NODE-OLD')).toBe(1); // [2] 도 ke.is_active=1 조건으로 미발화
  });

  it('G-RW-2e — 비 SUPERSEDES 엣지·비 node 승격은 무접촉', async () => {
    if (!backend) throw new Error('backend not initialized');
    await seedLineage();
    await insertEdge(backend, 'E-RW-1', 'NODE-NEW', 'NODE-OLD', 'DEPENDS_ON');
    await transition(backend, 'NODE-NEW', 'approved');
    expect(await activeFlag(backend, 'NODE-OLD')).toBe(1); // DEPENDS_ON 은 flip 대상 아님

    // formula 승격은 노드 무접촉 (target_type 격리)
    seq += 1;
    await backend.db
      .prepare(
        `INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, transitioned_at)
         VALUES (?, 'formula', 'F-ANY', 'draft', 'approved', 'jinsan', ?)`,
      )
      .bind(`ST-F-${seq}`, `2026-07-07T00:01:${String(seq).padStart(2, '0')}.000Z`)
      .run();
    expect(await activeFlag(backend, 'NODE-OLD')).toBe(1);
  });

  it('G-RW-2f — 재승격(중복 transition) = 에러 없음·상태 불변 (idempotency)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await seedLineage();
    await insertEdge(backend, 'E-RW-1', 'NODE-NEW', 'NODE-OLD');
    await transition(backend, 'NODE-NEW', 'approved');
    await transition(backend, 'NODE-NEW', 'approved'); // 중복 — WHERE is_current_active=1 가드로 무해
    expect(await activeFlag(backend, 'NODE-OLD')).toBe(0);
    expect(await activeFlag(backend, 'NODE-NEW')).toBe(1);
  });

  it('G-RW-2g — 다중홉 의미론 고정: A 승격은 직접 엣지(B)만 flip, C 는 불변 (1-hop)', async () => {
    if (!backend) throw new Error('backend not initialized');
    for (const id of ['NODE-A', 'NODE-B', 'NODE-C']) await insertNode(backend, id);
    await insertEdge(backend, 'E-BC', 'NODE-B', 'NODE-C'); // B(draft) sup C → C 잔존
    await insertEdge(backend, 'E-AB', 'NODE-A', 'NODE-B'); // A(draft) sup B → B 잔존
    expect(await activeFlag(backend, 'NODE-C')).toBe(1);
    await transition(backend, 'NODE-A', 'approved');
    expect(await activeFlag(backend, 'NODE-B')).toBe(0); // 직접 엣지 flip
    expect(await activeFlag(backend, 'NODE-C')).toBe(1); // 1-hop 의미론 — C 는 B 승격 시점 소관
  });

  it('G-RW-2i — review 승격은 flip 하지 않는다 (뮤테이션 MUT-6 킬: [2] to_status 게이트)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await seedLineage();
    await insertEdge(backend, 'E-RW-1', 'NODE-NEW', 'NODE-OLD');
    await transition(backend, 'NODE-NEW', 'review'); // 승격 아님 — [2] 미발화여야
    expect(await activeFlag(backend, 'NODE-OLD')).toBe(1);
  });

  it('G-RW-2j — approved superseder 의 비활성 엣지 INSERT 는 flip 하지 않는다 (뮤테이션 MUT-9 킬: [1] is_active 조건)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await seedLineage();
    await transition(backend, 'NODE-NEW', 'approved'); // superseder 실 approved — status 게이트 통과 상태
    await insertEdge(backend, 'E-RW-1', 'NODE-NEW', 'NODE-OLD', 'SUPERSEDES', 0); // 비활성 엣지만
    expect(await activeFlag(backend, 'NODE-OLD')).toBe(1); // is_active=1 조건이 유일 방어선
  });

  it('G-RW-2k — 백데이트 approved INSERT 는 실 최신이 아니면 flip 하지 않는다 (리뷰 MAJOR: [2] 최신성 게이트)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await seedLineage();
    await insertEdge(backend, 'E-RW-1', 'NODE-NEW', 'NODE-OLD');
    // 미래 시각의 flagged 를 먼저 적재 → 그 뒤 과거 시각 approved 를 backdate INSERT
    await backend.db
      .prepare(
        `INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, transitioned_at)
         VALUES ('ST-BD-1', 'node', 'NODE-NEW', 'draft', 'flagged', 'jinsan', '2026-07-07T10:00:00.000Z')`,
      )
      .run();
    await backend.db
      .prepare(
        `INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, transitioned_at)
         VALUES ('ST-BD-2', 'node', 'NODE-NEW', 'draft', 'approved', 'jinsan', '2026-07-07T09:00:00.000Z')`,
      )
      .run();
    // 실 최신 = flagged(10시) → backdate approved(9시) INSERT 는 [2] 미발화
    expect(await activeFlag(backend, 'NODE-OLD')).toBe(1);
  });

  it('G-RW-2l — 동시각 타이 = 삽입순 최후 승 (rowid 타이브레이커, 단일 진실원과 동시 개정)', async () => {
    if (!backend) throw new Error('backend not initialized');
    const TS = '2026-07-07T12:00:00.000Z';
    const insertAt = async (id: string, target: string, to: string) =>
      backend!.db
        .prepare(
          `INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, transitioned_at)
           VALUES (?, 'node', ?, 'draft', ?, 'jinsan', ?)`,
        )
        .bind(id, target, to, TS)
        .run();

    // 케이스 A: approved 후 동시각 review → 최신(삽입순 최후) = review → 이후 엣지 INSERT 미발화
    await insertNode(backend, 'NODE-T1');
    await insertNode(backend, 'NODE-T1S');
    await insertAt('ST-T1-A', 'NODE-T1S', 'approved');
    await insertAt('ST-T1-B', 'NODE-T1S', 'review');
    await insertEdge(backend, 'E-T1', 'NODE-T1S', 'NODE-T1');
    expect(await activeFlag(backend, 'NODE-T1')).toBe(1);

    // 케이스 B: review 후 동시각 approved → 최신 = approved → [2]가 즉시 flip
    await insertNode(backend, 'NODE-T2');
    await insertNode(backend, 'NODE-T2S');
    await insertEdge(backend, 'E-T2', 'NODE-T2S', 'NODE-T2');
    await insertAt('ST-T2-A', 'NODE-T2S', 'review');
    await insertAt('ST-T2-B', 'NODE-T2S', 'approved');
    expect(await activeFlag(backend, 'NODE-T2')).toBe(0);
  });

  it('G-RW-2h — 트리거 2종 실재 + 구 무조건 트리거 부재 (fail-open 차단)', async () => {
    if (!backend) throw new Error('backend not initialized');
    const res = await backend.db
      .prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'mav_%'`)
      .all<{ name: string; sql: string }>();
    const byName = new Map((res.results ?? []).map((r) => [r.name, r.sql]));
    expect(byName.has('mav_supersedes_knowledge_nodes_deactivate')).toBe(true);
    expect(byName.has('mav_promotion_flip_superseded_nodes')).toBe(true);
    // 재구축본은 status 게이트(단일 진실원 미러)를 포함해야 한다 — 0013 원본(무조건) 잔존 = FAIL
    // SQL 핀 강화(뮤테이션 MUT-5 킬): 미러의 구성 요소 3종(COALESCE·'draft' 폴백·rowid 타이브레이커) 전부 실재
    const gate = byName.get('mav_supersedes_knowledge_nodes_deactivate') ?? '';
    expect(gate).toMatch(/status_transitions/);
    expect(gate).toMatch(/COALESCE/i);
    expect(gate).toMatch(/'draft'/);
    expect(gate).toMatch(/rowid DESC/);
    expect(byName.get('mav_promotion_flip_superseded_nodes')).toMatch(/rowid DESC/);
  });
});
