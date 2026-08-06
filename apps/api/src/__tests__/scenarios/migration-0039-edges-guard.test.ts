/**
 * 마이그레이션 0039 — knowledge_edges UPDATE/DELETE 가드 + knowledge_nodes 부활(0→1) 차단 회귀 테스트.
 *
 * 정책 출처: docs/plans/ws-2b-knowledge-edges-guard.plan.md (D-1=A안 · D-2=(a) · Amendment 2026-08-06)
 *   + docs/plans/catchall-역이식-분석-20260806.md §3-C.
 *   STATUS: 선작성본 검증 — production 적용(wrangler --remote)은 진산 인증 게이트 별도.
 *
 * 하네스: createD1FromAllMigrations() — readdir 자동(0039 포함, 큐레이션 배열 미사용).
 *
 * 핵심 불변식:
 *   [G-WS2b-1] 엣지 본문 7컬럼 UPDATE = ABORT
 *   [G-WS2b-2] 엣지 is_active 플립(1→0, 0→1) = 허용 — 그래프 수리 경로 보존
 *   [G-WS2b-3] 엣지 DELETE = ABORT
 *   [G-WS2b-4] 엣지 INSERT = 무영향 (Track B 고아 수리 = INSERT-only)
 *   [G-NODE-1] 노드 부활 0→1 = ABORT   ← 0041 WHEN 절 공백 봉합
 *   [G-NODE-2] 노드 은퇴 1→0 = 허용    ← 0042 동반 은퇴 경로 보존
 *   [G-NODE-3] 0041 백필(NULL→값 1회)은 그대로 살아 있다 — 본 마이그가 잠식하지 않음
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createD1FromAllMigrations, type SqliteBackedD1 } from '../helpers/d1-from-sqlite.js';

let backend: SqliteBackedD1;

async function insertNode(id: string): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page)
       VALUES (?, 'LAW', ?, '법 제1조', 2026, 10, 'draft', 1, 1)`,
    )
    .bind(id, `노드 ${id}`)
    .run();
}

async function insertEdge(id: string, from: string, to: string): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, condition, priority, is_active)
       VALUES (?, ?, ?, 'RELATED_TO', '조건', 3, 1)`,
    )
    .bind(id, from, to)
    .run();
}

beforeEach(async () => {
  backend = createD1FromAllMigrations();
  await insertNode('LAW-A');
  await insertNode('LAW-B');
  await insertEdge('E-1', 'LAW-A', 'LAW-B');
});

afterEach(() => {
  backend.close();
});

describe('0039 — knowledge_edges 가드', () => {
  it('[G-WS2b-1] 본문 컬럼 UPDATE 는 전부 ABORT', async () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['from_node', `'LAW-B'`],
      ['to_node', `'LAW-A'`],
      ['edge_type', `'PREREQUISITE'`],
      ['condition', `'변조된 조건'`],
      ['priority', `99`],
      ['id', `'E-9'`],
      ['created_at', `'2000-01-01'`],
    ];
    for (const [col, val] of cases) {
      await expect(
        backend.db.prepare(`UPDATE knowledge_edges SET ${col} = ${val} WHERE id = 'E-1'`).run(),
      ).rejects.toThrow(/forbidden/i);
    }
  });

  it('[G-WS2b-2] is_active 플립은 양방향 허용 (그래프 수리 경로 보존)', async () => {
    await backend.db.prepare(`UPDATE knowledge_edges SET is_active = 0 WHERE id = 'E-1'`).run();
    const off = await backend.db
      .prepare(`SELECT is_active FROM knowledge_edges WHERE id = 'E-1'`)
      .first<{ is_active: number }>();
    expect(off?.is_active).toBe(0);

    // 엣지는 노드와 달리 재활성화를 막지 않는다 — stale 정리의 되돌림이 정당 운영 경로
    await backend.db.prepare(`UPDATE knowledge_edges SET is_active = 1 WHERE id = 'E-1'`).run();
    const on = await backend.db
      .prepare(`SELECT is_active FROM knowledge_edges WHERE id = 'E-1'`)
      .first<{ is_active: number }>();
    expect(on?.is_active).toBe(1);
  });

  it('[G-WS2b-3] DELETE 는 ABORT (감사 이력 보존)', async () => {
    await expect(
      backend.db.prepare(`DELETE FROM knowledge_edges WHERE id = 'E-1'`).run(),
    ).rejects.toThrow(/forbidden/i);
    const row = await backend.db
      .prepare(`SELECT COUNT(*) AS c FROM knowledge_edges`)
      .first<{ c: number }>();
    expect(row?.c).toBe(1);
  });

  it('[G-WS2b-4] INSERT 는 무영향 — Track B 고아 수리(INSERT-only) 경로 보존', async () => {
    await insertEdge('E-2', 'LAW-B', 'LAW-A');
    const row = await backend.db
      .prepare(`SELECT COUNT(*) AS c FROM knowledge_edges`)
      .first<{ c: number }>();
    expect(row?.c).toBe(2);
  });
});

describe('0039 — knowledge_nodes 부활 차단', () => {
  it('[G-NODE-2] 은퇴 1→0 은 허용 (0042 동반 은퇴 경로)', async () => {
    await backend.db
      .prepare(`UPDATE knowledge_nodes SET is_current_active = 0 WHERE id = 'LAW-A'`)
      .run();
    const row = await backend.db
      .prepare(`SELECT is_current_active FROM knowledge_nodes WHERE id = 'LAW-A'`)
      .first<{ is_current_active: number }>();
    expect(row?.is_current_active).toBe(0);
  });

  it('★[G-NODE-1] 부활 0→1 은 ABORT — 은퇴한 구본이 되살아나지 못한다', async () => {
    await backend.db
      .prepare(`UPDATE knowledge_nodes SET is_current_active = 0 WHERE id = 'LAW-A'`)
      .run();
    await expect(
      backend.db
        .prepare(`UPDATE knowledge_nodes SET is_current_active = 1 WHERE id = 'LAW-A'`)
        .run(),
    ).rejects.toThrow(/Reactivating a retired knowledge_node/i);
    const row = await backend.db
      .prepare(`SELECT is_current_active FROM knowledge_nodes WHERE id = 'LAW-A'`)
      .first<{ is_current_active: number }>();
    expect(row?.is_current_active).toBe(0); // 여전히 은퇴 상태
  });

  it('[G-NODE-3] 0041 백필(NULL→값 1회)은 계속 동작 — 본 마이그가 잠식하지 않음', async () => {
    await backend.db
      .prepare(`UPDATE knowledge_nodes SET valid_from = '2026-08-15' WHERE id = 'LAW-A'`)
      .run();
    const row = await backend.db
      .prepare(`SELECT valid_from FROM knowledge_nodes WHERE id = 'LAW-A'`)
      .first<{ valid_from: string }>();
    expect(row?.valid_from).toBe('2026-08-15');

    // 값 → 다른 값은 여전히 차단 (0041 계약 무회귀)
    await expect(
      backend.db
        .prepare(`UPDATE knowledge_nodes SET valid_from = '2027-01-01' WHERE id = 'LAW-A'`)
        .run(),
    ).rejects.toThrow(/forbidden/i);
  });
});
