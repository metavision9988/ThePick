/**
 * /api/search/graph 라우트 통합 테스트 (옵션 C — 독립 graph-augmented 검색).
 *
 * 검증:
 *   - zod validation (examId/query/topK 경계) + Hard Rule 17
 *   - graceful: approved 시드 0건 → graphExpansion.applied=false (검색 무중단,
 *     plan §3 G-S6) — baseline 그대로 반환, silent 실패 아님
 *   - end-to-end: vector 시드 → graph N-hop 확장 노드가 results 에 편입,
 *     baseline(vector-only) 보존 (S5-6 A/B 비교 격리)
 *   - 단일 진실원: 기본 화이트리스트 12종 (D-1) — SUPERSEDES 미순회
 *
 * 근거: docs/plans/graph-walk-s5-integration.plan.md §2/§3/§4 S5-3.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { EXAM_IDS } from '@thepick/shared';
import { createGraphSearchRoutes, type GraphSearchRouteBindings } from '../graph-search-route.js';
import {
  createD1FromAllMigrations,
  type SqliteBackedD1,
} from '../../__tests__/helpers/d1-from-sqlite.js';

const BGE_M3_DIM = 1024;

function makeMockAi(): GraphSearchRouteBindings['AI'] {
  const run = vi.fn(async () => ({
    shape: [1, BGE_M3_DIM],
    data: [new Array(BGE_M3_DIM).fill(0.5)],
  }));
  return { run } as unknown as GraphSearchRouteBindings['AI'];
}

function makeMockVectorize(
  matches: Array<{ id: string; score: number; metadata?: Record<string, unknown> }>,
): GraphSearchRouteBindings['VECTORIZE'] {
  return {
    upsert: vi.fn(),
    query: vi.fn(async () => ({ count: matches.length, matches })),
  } as unknown as GraphSearchRouteBindings['VECTORIZE'];
}

interface AppEnv {
  Bindings: GraphSearchRouteBindings;
}

async function insertApproved(
  db: D1Database,
  id: string,
  type: string,
  truthWeight: number,
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, page_ref, book_page, pdf_page, version_year, truth_weight, status) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id, type, `name-${id}`, `desc-${id}`, `p.${id}`, 100, 105, 2026, truthWeight, 'draft')
    .run();
  await db
    .prepare(
      "INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason, transitioned_at) VALUES (?, 'node', ?, 'draft', 'review', 'r', NULL, ?)",
    )
    .bind(`stA-${id}`, id, '2026-05-15T00:00:00.000Z')
    .run();
  await db
    .prepare(
      "INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason, transitioned_at) VALUES (?, 'node', ?, 'review', 'approved', 'r', NULL, ?)",
    )
    .bind(`stB-${id}`, id, '2026-05-15T01:00:00.000Z')
    .run();
}

async function insertEdge(
  db: D1Database,
  from: string,
  to: string,
  edgeType: string,
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, condition, priority, is_active) VALUES (?, ?, ?, ?, NULL, 0, 1)',
    )
    .bind(`E-${from}-${edgeType}-${to}`, from, to, edgeType)
    .run();
}

describe('/api/search/graph route', () => {
  let backend: SqliteBackedD1;
  let app: Hono<AppEnv>;
  let env: GraphSearchRouteBindings;

  beforeEach(async () => {
    backend = createD1FromAllMigrations();
    app = new Hono<AppEnv>();
    app.route('/api/search/graph', createGraphSearchRoutes());
  });

  afterEach(() => {
    backend.close();
    vi.restoreAllMocks();
  });

  async function post(body: unknown, overrideEnv?: Partial<GraphSearchRouteBindings>) {
    return app.request(
      '/api/search/graph',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      { ...env, ...(overrideEnv ?? {}) },
    );
  }

  describe('zod validation + Hard Rule 17', () => {
    beforeEach(() => {
      env = {
        DB: backend.db,
        VECTORIZE: makeMockVectorize([]),
        AI: makeMockAi(),
        ENVIRONMENT: 'test',
      };
    });
    it('examId 부재 → 400', async () => {
      expect((await post({ query: 'q' })).status).toBe(400);
    });
    it('query 길이 > 500 → 400', async () => {
      const res = await post({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: 'a'.repeat(501) });
      expect(res.status).toBe(400);
    });
    it('allowlist 외 examId → 400 INVALID_EXAM_ID', async () => {
      const res = await post({ examId: 'bad-exam', query: 'q' });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { message: string }).message).toBe('INVALID_EXAM_ID');
    });
    it('maxDepth > 엔진 ceiling(MAX_ALLOWED_DEPTH=4) → 400 정직 거부 (silent clamp 아님)', async () => {
      const res = await post({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: 'q', maxDepth: 5 });
      expect(res.status).toBe(400);
    });
    it('maxDepth = ceiling(4) → 통과 (200)', async () => {
      await insertApproved(backend.db, 'SD-D4', 'LAW', 10);
      env = {
        DB: backend.db,
        VECTORIZE: makeMockVectorize([{ id: 'SD-D4', score: 0.9, metadata: {} }]),
        AI: makeMockAi(),
        ENVIRONMENT: 'test',
      };
      const res = await post({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: 'q', maxDepth: 4 });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { graphExpansion: { maxDepth: number } };
      expect(body.graphExpansion.maxDepth).toBe(4);
    });
    it('resultCap > 엔진 ceiling(MAX_ALLOWED_RESULT_CAP=500) → 400', async () => {
      const res = await post({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: 'q', resultCap: 501 });
      expect(res.status).toBe(400);
    });
  });

  it('G-S6 Graceful — approved 시드 0건이어도 200 + 검색 무중단 (확장 미적용 명시)', async () => {
    // vector match 가 draft 노드만 → Stage 2 후 0건 → 시드 없음.
    await backend.db
      .prepare(
        'INSERT INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, page_ref, book_page, pdf_page, version_year, truth_weight, status) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)',
      )
      .bind('DRAFT-1', 'CONCEPT', 'n', 'd', 'p.1', 1, 1, 2026, 5, 'draft')
      .run();
    env = {
      DB: backend.db,
      VECTORIZE: makeMockVectorize([{ id: 'DRAFT-1', score: 0.9, metadata: {} }]),
      AI: makeMockAi(),
      ENVIRONMENT: 'test',
    };
    const res = await post({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: 'q', topK: 3 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      graphExpansion: { applied: boolean; reason?: string };
      results: unknown[];
    };
    expect(body.graphExpansion.applied).toBe(false);
    expect(body.graphExpansion.reason).toBe('no_approved_seed');
    expect(body.results).toEqual([]); // baseline 도 0건 (graceful)
  });

  it('end-to-end — vector 시드에서 graph N-hop 확장 노드 편입 + baseline 보존', async () => {
    // SEED(vector hit, approved) →(DEPENDS_ON) EXP(approved, vector hit 아님)
    await insertApproved(backend.db, 'SEED-1', 'LAW', 10);
    await insertApproved(backend.db, 'EXP-1', 'CONCEPT', 5);
    await insertEdge(backend.db, 'SEED-1', 'EXP-1', 'DEPENDS_ON');
    env = {
      DB: backend.db,
      VECTORIZE: makeMockVectorize([{ id: 'SEED-1', score: 0.88, metadata: {} }]),
      AI: makeMockAi(),
      ENVIRONMENT: 'test',
    };
    const res = await post({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: 'q', topK: 5 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      baseline: { results: Array<{ id: string }> };
      graphExpansion: { applied: boolean; expandedNodeCount: number; edgeTypeWhitelist: string[] };
      results: Array<{ id: string }>;
    };
    // baseline = vector-only (SEED-1 만) — 보존
    expect(body.baseline.results.map((h) => h.id)).toEqual(['SEED-1']);
    // graph 확장으로 EXP-1 편입
    expect(body.graphExpansion.applied).toBe(true);
    expect(body.graphExpansion.expandedNodeCount).toBe(1);
    const ids = body.results.map((h) => h.id).sort();
    expect(ids).toEqual(['EXP-1', 'SEED-1']);
    // D-1: 기본 화이트리스트 12종 (SUPERSEDES 제외)
    expect(body.graphExpansion.edgeTypeWhitelist).toHaveLength(12);
    expect(body.graphExpansion.edgeTypeWhitelist).not.toContain('SUPERSEDES');
  });

  it('D-1 — SUPERSEDES 엣지는 기본 화이트리스트에서 미순회 (확장 0)', async () => {
    await insertApproved(backend.db, 'SEED-2', 'LAW', 10);
    await insertApproved(backend.db, 'SUP-2', 'CONCEPT', 5);
    await insertEdge(backend.db, 'SEED-2', 'SUP-2', 'SUPERSEDES');
    env = {
      DB: backend.db,
      VECTORIZE: makeMockVectorize([{ id: 'SEED-2', score: 0.9, metadata: {} }]),
      AI: makeMockAi(),
      ENVIRONMENT: 'test',
    };
    const res = await post({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: 'q', topK: 5 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      graphExpansion: { applied: boolean; expandedNodeCount: number };
      results: Array<{ id: string }>;
    };
    expect(body.graphExpansion.expandedNodeCount).toBe(0);
    expect(body.results.map((h) => h.id)).toEqual(['SEED-2']);
  });
});
