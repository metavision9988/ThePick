/**
 * Graph walk PoC — Binary Gate G1~G6 + fail-loud (Engine-First RTV).
 *
 * 근거: docs/plans/graph-walk-poc.plan.md §3 (Binary Gates), §4 S1+S3.
 * 검증 환경: 실 node:sqlite (createD1FromSqlite) — mocked 아님. 적용 migration
 *   = SCENARIO_MIGRATIONS (0001~0019 + 0028~0037, 비연속 — d1-from-sqlite.ts:44).
 *   graph-walk 의존 트리거(status_transitions 0010 / is_current_active 0013 /
 *   temporal·SUPERSEDES 0014 / draft-only 0018 / page_ref 0019) 전부 포함 →
 *   진짜 SQL 순회 검증 (4-Pass Pass1 M-3 흡수: 헤더 사실 정정).
 *
 * 결정성: 고정 시드 그래프 (난수 0). G6 = exact id/depth 배열 golden.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createD1FromSqlite, type SqliteBackedD1 } from '../../../__tests__/helpers/d1-from-sqlite';
import {
  graphWalk,
  GraphWalkError,
  DEFAULT_EDGE_TYPE_WHITELIST,
  MAX_EDGE_TYPE_WHITELIST,
  MAX_ALLOWED_DEPTH,
  type GraphWalkD1,
} from '../index';
import { EXAM_IDS, type ExamId } from '@thepick/shared';

const EXAM_ID: ExamId = EXAM_IDS.SON_HAE_PYEONG_GA_SA; // Hard Rule 17 — 상수 경유

let sqlite: SqliteBackedD1;
let db: GraphWalkD1;

/** draft 노드 INSERT (0018 draft-only / 0019 book_page·pdf_page NOT NULL 정합). */
async function insertNode(id: string, type: string, name: string): Promise<void> {
  await sqlite.db
    .prepare(
      `INSERT INTO knowledge_nodes
         (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page)
       VALUES (?, ?, ?, ?, 2026, 5, 'draft', 1, 1)`,
    )
    .bind(id, type, name, `p.${id}`)
    .run();
}

/** draft → review → approved 전이 (status_transitions CHECK 정합). */
async function approve(id: string): Promise<void> {
  await sqlite.db
    .prepare(
      `INSERT INTO status_transitions
         (id, target_type, target_id, from_status, to_status, reviewer_id, reason, transitioned_at)
       VALUES (?, 'node', ?, 'draft', 'review', 'test-reviewer', NULL, ?)`,
    )
    .bind(`str-${id}`, id, '2026-05-15T00:00:00.000Z')
    .run();
  await sqlite.db
    .prepare(
      `INSERT INTO status_transitions
         (id, target_type, target_id, from_status, to_status, reviewer_id, reason, transitioned_at)
       VALUES (?, 'node', ?, 'review', 'approved', 'test-reviewer', NULL, ?)`,
    )
    .bind(`sta-${id}`, id, '2026-05-15T01:00:00.000Z')
    .run();
}

/** is_current_active=0 (0014 트리거 화이트리스트 — is_current_active UPDATE 만 허용). */
async function deprecate(id: string): Promise<void> {
  await sqlite.db
    .prepare(`UPDATE knowledge_nodes SET is_current_active = 0 WHERE id = ?`)
    .bind(id)
    .run();
}

async function insertEdge(from: string, to: string, edgeType: string): Promise<void> {
  await sqlite.db
    .prepare(
      `INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, condition, priority, is_active)
       VALUES (?, ?, ?, ?, NULL, 0, 1)`,
    )
    .bind(`E-${from}-${edgeType}-${to}`, from, to, edgeType)
    .run();
}

/** approved + active 노드 헬퍼. */
async function approvedNode(id: string, type = 'CONCEPT'): Promise<void> {
  await insertNode(id, type, `name-${id}`);
  await approve(id);
}

beforeEach(() => {
  sqlite = createD1FromSqlite();
  db = sqlite.db as unknown as GraphWalkD1;
});

afterEach(() => {
  sqlite.close();
});

describe('Graph walk — G1 깊이 cap', () => {
  it('depth=2 → 3-hop 노드 미포함', async () => {
    // SEED →(DEPENDS_ON) A1 →(SHARED_WITH) B1 →(CROSS_REF) C1(3-hop)
    for (const n of ['SEED', 'A1', 'B1', 'C1']) await approvedNode(n);
    await insertEdge('SEED', 'A1', 'DEPENDS_ON');
    await insertEdge('A1', 'B1', 'SHARED_WITH');
    await insertEdge('B1', 'C1', 'CROSS_REF');

    const r = await graphWalk(EXAM_ID, db, 'SEED', { maxDepth: 2 });
    expect(r.nodes.map((n) => n.id)).toEqual(['A1', 'B1']);
    expect(r.nodes.find((n) => n.id === 'A1')?.depth).toBe(1);
    expect(r.nodes.find((n) => n.id === 'B1')?.depth).toBe(2);
    expect(r.nodes.some((n) => n.id === 'C1')).toBe(false);
  });
});

describe('Graph walk — G2 폐기 노드 차단', () => {
  it('경로상 is_current_active=0 노드 결과 제외', async () => {
    for (const n of ['SEED', 'DEP']) await approvedNode(n);
    await insertEdge('SEED', 'DEP', 'DEPENDS_ON');
    await deprecate('DEP');

    const r = await graphWalk(EXAM_ID, db, 'SEED');
    expect(r.nodes).toEqual([]);
  });

  it('시드 자신이 폐기면 빈 결과 (anchor approved 강제)', async () => {
    for (const n of ['SEED', 'A1']) await approvedNode(n);
    await insertEdge('SEED', 'A1', 'DEPENDS_ON');
    await deprecate('SEED');

    const r = await graphWalk(EXAM_ID, db, 'SEED');
    expect(r.nodes).toEqual([]);
  });

  it('approved 전이 없는 draft 노드 제외', async () => {
    await approvedNode('SEED');
    await insertNode('DRAFTONLY', 'CONCEPT', 'draft-only'); // approve() 미호출
    await insertEdge('SEED', 'DRAFTONLY', 'DEPENDS_ON');

    const r = await graphWalk(EXAM_ID, db, 'SEED');
    expect(r.nodes).toEqual([]);
  });
});

describe('Graph walk — G3 edge_type 화이트리스트', () => {
  it('기본 화이트리스트는 SUPERSEDES 미순회', async () => {
    for (const n of ['SEED', 'SUP']) await approvedNode(n);
    await insertEdge('SEED', 'SUP', 'SUPERSEDES');

    const r = await graphWalk(EXAM_ID, db, 'SEED');
    expect(r.edgeTypeWhitelist).toEqual(DEFAULT_EDGE_TYPE_WHITELIST);
    expect(r.nodes).toEqual([]);
  });

  // 양방향 증명: 비기본 edge_type 도 명시 화이트리스트면 순회됨.
  // SUPERSEDES 는 0013 트리거가 to_node 를 is_current_active=0 자동 폐기시켜
  // (temporal graph semantic — superseded 타깃은 정의상 비활성) 픽스처로 부적합.
  // → 트리거 부작용 없는 비기본 타입 'RELATES_TO' 로 화이트리스트 포함 동작 증명.
  it('명시 화이트리스트 [RELATES_TO] → 비기본 타입 순회됨 (양방향 증명)', async () => {
    for (const n of ['SEED', 'REL']) await approvedNode(n);
    await insertEdge('SEED', 'REL', 'RELATES_TO');

    const excluded = await graphWalk(EXAM_ID, db, 'SEED'); // 기본 화이트리스트
    expect(excluded.nodes).toEqual([]); // RELATES_TO ∉ 기본 → 미순회

    const included = await graphWalk(EXAM_ID, db, 'SEED', {
      edgeTypeWhitelist: ['RELATES_TO'],
    });
    expect(included.nodes.map((n) => n.id)).toEqual(['REL']);
  });
});

describe('Graph walk — G4 결과 cap + truncated', () => {
  it('팬아웃 > cap → 정확히 cap 개 + truncated=true', async () => {
    await approvedNode('HUB');
    for (let i = 1; i <= 8; i++) {
      const id = `N${i}`;
      await approvedNode(id);
      await insertEdge('HUB', id, 'DEPENDS_ON');
    }
    const r = await graphWalk(EXAM_ID, db, 'HUB', { resultCap: 3 });
    expect(r.nodes).toHaveLength(3);
    expect(r.truncated).toBe(true);
  });

  it('팬아웃 ≤ cap → truncated=false', async () => {
    await approvedNode('HUB');
    for (let i = 1; i <= 2; i++) {
      const id = `N${i}`;
      await approvedNode(id);
      await insertEdge('HUB', id, 'DEPENDS_ON');
    }
    const r = await graphWalk(EXAM_ID, db, 'HUB', { resultCap: 3 });
    expect(r.nodes).toHaveLength(2);
    expect(r.truncated).toBe(false);
  });
});

describe('Graph walk — G5 CPU 예산 (in-memory 측정)', () => {
  it('최악 시드(허브 depth=2) 실행 < 250ms (in-memory 기준)', async () => {
    // ⚠️ in-memory sqlite 측정. 실 Workers CPU(50ms free)와 다름 —
    // 본 게이트는 "측정 + sane bound" PoC 목적. 실 budget 은 통합 시 별도 측정.
    await approvedNode('HUB');
    for (let i = 1; i <= 30; i++) {
      const id = `H${i}`;
      await approvedNode(id);
      await insertEdge('HUB', id, 'DEPENDS_ON');
      for (let j = 1; j <= 3; j++) {
        const leaf = `L${i}_${j}`;
        await approvedNode(leaf);
        await insertEdge(id, leaf, 'SHARED_WITH');
      }
    }
    const t0 = performance.now();
    const r = await graphWalk(EXAM_ID, db, 'HUB', { maxDepth: 2, resultCap: 500 });
    const elapsed = performance.now() - t0;
    expect(r.nodes.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(250);
  });
});

describe('Graph walk — G6 golden (결정성)', () => {
  it('고정 시드 그래프 → exact id/depth 배열', async () => {
    // 다이아몬드 + 분기 + cycle + 폐기 + SUPERSEDES 혼재 고정 그래프
    for (const n of ['G', 'X1', 'X2', 'Y1', 'Y2', 'Z1', 'OLD', 'SUPN']) {
      await approvedNode(n);
    }
    await deprecate('OLD');
    await insertEdge('G', 'X1', 'DEPENDS_ON');
    await insertEdge('G', 'X2', 'SHARED_WITH');
    await insertEdge('X1', 'Y1', 'CROSS_REF');
    await insertEdge('X1', 'Y2', 'DEPENDS_ON');
    await insertEdge('X2', 'Y2', 'SHARED_WITH'); // Y2 다중 경로 (depth=2 동일)
    await insertEdge('Y1', 'Z1', 'DEPENDS_ON'); // Z1 = 3-hop (depth=2 컷)
    await insertEdge('Y1', 'G', 'DEPENDS_ON'); // cycle → seed 제외 + 무한루프 X
    await insertEdge('G', 'OLD', 'DEPENDS_ON'); // 폐기 → 제외
    await insertEdge('G', 'SUPN', 'SUPERSEDES'); // 비화이트리스트 → 제외

    const r = await graphWalk(EXAM_ID, db, 'G', { maxDepth: 2 });
    expect(r.nodes.map((n) => ({ id: n.id, depth: n.depth }))).toEqual([
      { id: 'X1', depth: 1 },
      { id: 'X2', depth: 1 },
      { id: 'Y1', depth: 2 },
      { id: 'Y2', depth: 2 },
    ]);
    // 출처 추적 동반 (source citation requirement)
    expect(r.nodes.every((n) => n.pageRef !== null)).toBe(true);
  });
});

describe('Graph walk — C-1 회귀: dense 양방향 그래프 bounded 종료', () => {
  it('완전 양방향 그래프(구 path 방식이면 경로 폭발) → bounded·정확·고속', async () => {
    // N개 노드 완전 양방향 연결. 구 `path` 문자열 방식이면 단순경로 수가
    // 계승적 폭발(hang). (node_id,depth) UNION dedup + depth cap 으로
    // 프론티어 ≤ N×(maxDepth+1) 상한 → 즉시 종료해야 함.
    const N = 12;
    const ids = Array.from({ length: N }, (_, i) => `D${i}`);
    for (const id of ids) await approvedNode(id);
    for (const a of ids) {
      for (const b of ids) {
        if (a !== b) await insertEdge(a, b, 'DEPENDS_ON');
      }
    }
    const t0 = performance.now();
    const r = await graphWalk(EXAM_ID, db, 'D0', {
      maxDepth: MAX_ALLOWED_DEPTH,
      resultCap: 500,
    });
    const elapsed = performance.now() - t0;
    // 완전 그래프: D0 제외 나머지 N-1 노드 전부 depth=1 (직접 연결)
    expect(r.nodes).toHaveLength(N - 1);
    expect(r.nodes.every((n) => n.depth === 1)).toBe(true);
    expect(r.truncated).toBe(false);
    expect(elapsed).toBeLessThan(500); // 폭발이면 수 초+ → hang
  });

  it('자기참조 엣지(from=to) 무한루프 없이 종료', async () => {
    for (const n of ['S', 'A']) await approvedNode(n);
    await insertEdge('S', 'S', 'DEPENDS_ON'); // self-loop
    await insertEdge('S', 'A', 'DEPENDS_ON');
    await insertEdge('A', 'A', 'DEPENDS_ON'); // self-loop
    const r = await graphWalk(EXAM_ID, db, 'S', { maxDepth: MAX_ALLOWED_DEPTH });
    expect(r.nodes.map((n) => n.id)).toEqual(['A']); // S 자신 제외, A depth1
    expect(r.nodes[0]?.depth).toBe(1);
  });
});

describe('Graph walk — clamp / whitelist 엣지 (Pass3 Major-3 흡수)', () => {
  it('maxDepth=0 → clamp 1 (silent 0 아님, 반환값에 노출)', async () => {
    for (const n of ['S', 'A', 'B']) await approvedNode(n);
    await insertEdge('S', 'A', 'DEPENDS_ON');
    await insertEdge('A', 'B', 'DEPENDS_ON');
    const r = await graphWalk(EXAM_ID, db, 'S', { maxDepth: 0 });
    expect(r.maxDepth).toBe(1); // clamp 값이 결과에 노출 → 호출자 검사 가능
    expect(r.nodes.map((n) => n.id)).toEqual(['A']); // 1-hop만
  });

  it('maxDepth 음수/NaN, resultCap=0 → clamp 하한', async () => {
    for (const n of ['S', 'A']) await approvedNode(n);
    await insertEdge('S', 'A', 'DEPENDS_ON');
    const neg = await graphWalk(EXAM_ID, db, 'S', { maxDepth: -3 });
    expect(neg.maxDepth).toBe(1);
    const nan = await graphWalk(EXAM_ID, db, 'S', { maxDepth: Number.NaN });
    expect(nan.maxDepth).toBe(1);
    const cap0 = await graphWalk(EXAM_ID, db, 'S', { resultCap: 0 });
    expect(cap0.resultCap).toBe(1);
  });

  it('whitelist 중복 → 무해 (정상 순회)', async () => {
    for (const n of ['S', 'A']) await approvedNode(n);
    await insertEdge('S', 'A', 'DEPENDS_ON');
    const r = await graphWalk(EXAM_ID, db, 'S', {
      edgeTypeWhitelist: ['DEPENDS_ON', 'DEPENDS_ON'],
    });
    expect(r.nodes.map((n) => n.id)).toEqual(['A']);
  });

  it('whitelist 길이 상한 초과 → GraphWalkError(input) (DoS 표면 차단)', async () => {
    await approvedNode('S');
    const huge = Array.from({ length: MAX_EDGE_TYPE_WHITELIST + 1 }, (_, i) => `T${i}`);
    await expect(graphWalk(EXAM_ID, db, 'S', { edgeTypeWhitelist: huge })).rejects.toMatchObject({
      name: 'GraphWalkError',
      phase: 'input',
    });
  });
});

describe('Graph walk — fail-loud (빈 결과로 삼키지 않음)', () => {
  it('examId 누락 → GraphWalkError(input)', async () => {
    await expect(graphWalk('' as ExamId, db, 'SEED')).rejects.toBeInstanceOf(GraphWalkError);
  });

  it('seedNodeId 누락 → GraphWalkError(input)', async () => {
    await expect(graphWalk(EXAM_ID, db, '   ')).rejects.toBeInstanceOf(GraphWalkError);
  });

  it('edgeTypeWhitelist 빈 문자 → GraphWalkError(input)', async () => {
    await approvedNode('SEED');
    await expect(
      graphWalk(EXAM_ID, db, 'SEED', { edgeTypeWhitelist: ['  '] }),
    ).rejects.toBeInstanceOf(GraphWalkError);
  });

  it('D1 실행 실패 → GraphWalkError(query) 전파 (silent empty 금지)', async () => {
    const brokenDb: GraphWalkD1 = {
      prepare() {
        return {
          bind() {
            return {
              all() {
                return Promise.reject(new Error('D1 disconnect simulated'));
              },
            };
          },
        };
      },
    };
    await expect(graphWalk(EXAM_ID, brokenDb, 'SEED')).rejects.toMatchObject({
      name: 'GraphWalkError',
      phase: 'query',
    });
  });

  it('seedNodeId 미존재 → 빈 결과 (에러 아님, 정상 graceful)', async () => {
    await approvedNode('SEED');
    const r = await graphWalk(EXAM_ID, db, 'NONEXISTENT');
    expect(r.nodes).toEqual([]);
    expect(r.truncated).toBe(false);
  });
});
