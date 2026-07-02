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
import {
  createGraphSearchRoutes,
  GRAPH_QUERY_DEBUG_MAX_LENGTH,
  GRAPH_QUERY_PUBLIC_MAX_LENGTH,
  type GraphExpansionDebugNode,
  type GraphSearchRouteBindings,
} from '../graph-search-route.js';
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
    it('maxDepth 미지정 → 기본 1 (S5-8 Phase 0a 결재 #6 — depth2 순손실 실측 회귀 차단)', async () => {
      await insertApproved(backend.db, 'SD-D1', 'LAW', 10);
      env = {
        DB: backend.db,
        VECTORIZE: makeMockVectorize([{ id: 'SD-D1', score: 0.9, metadata: {} }]),
        AI: makeMockAi(),
        ENVIRONMENT: 'test',
      };
      const res = await post({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: 'q' });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { graphExpansion: { maxDepth: number } };
      // 기본값이 2 로 되돌아가면(depth2 순손실 재도입) 본 단언이 깨진다.
      expect(body.graphExpansion.maxDepth).toBe(1);
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

  it('CO6-1 — 확장 노드가 description 동봉 (잉여 2차 fetchApprovedNodes 제거 입증)', async () => {
    await insertApproved(backend.db, 'SEED-D', 'LAW', 10);
    await insertApproved(backend.db, 'EXP-D', 'CONCEPT', 5);
    await insertEdge(backend.db, 'SEED-D', 'EXP-D', 'DEPENDS_ON');
    env = {
      DB: backend.db,
      VECTORIZE: makeMockVectorize([{ id: 'SEED-D', score: 0.9, metadata: {} }]),
      AI: makeMockAi(),
      ENVIRONMENT: 'test',
    };
    const res = await post({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: 'q', topK: 5 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: Array<{ id: string; description: string | null }>;
    };
    const exp = body.results.find((h) => h.id === 'EXP-D');
    // insertApproved 는 description = `desc-${id}` 적재 → graph-walk projection
    // 이 description 을 실어와 buildHit 에 그대로 전달됐음을 입증 (2차 조회 X).
    expect(exp?.description).toBe('desc-EXP-D');
  });

  it('CO6-2 — resultCap 초과 시 graphExpansion.truncated=true surface (silent 절단 차단)', async () => {
    await insertApproved(backend.db, 'SEED-T', 'LAW', 10);
    await insertApproved(backend.db, 'EXP-T1', 'CONCEPT', 5);
    await insertApproved(backend.db, 'EXP-T2', 'CONCEPT', 5);
    await insertEdge(backend.db, 'SEED-T', 'EXP-T1', 'DEPENDS_ON');
    await insertEdge(backend.db, 'SEED-T', 'EXP-T2', 'DEPENDS_ON');
    env = {
      DB: backend.db,
      VECTORIZE: makeMockVectorize([{ id: 'SEED-T', score: 0.9, metadata: {} }]),
      AI: makeMockAi(),
      ENVIRONMENT: 'test',
    };
    // resultCap=1 → 시드가 2 노드 도달 → graph-walk 절단(cap+1 조회 판정).
    const res = await post({
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      query: 'q',
      topK: 5,
      resultCap: 1,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { graphExpansion: { truncated: boolean } };
    expect(body.graphExpansion.truncated).toBe(true);
  });

  it('CO6-4(a) — baseline∩expanded 충돌 시 baseline 실 vector score 보존 (확장 score=0 미덮어씀)', async () => {
    // SEED-A, SEED-B 둘 다 vector hit(baseline). SEED-A →(DEPENDS_ON) SEED-B.
    // graph-walk 가 SEED-B 를 재도달하지만 baseline 교집합 → 확장 제외,
    // baseline 의 실 score(0.71) 보존돼야 한다 (확장 0 으로 덮이면 안 됨).
    await insertApproved(backend.db, 'SEED-A', 'LAW', 10);
    await insertApproved(backend.db, 'SEED-B', 'LAW', 10);
    await insertEdge(backend.db, 'SEED-A', 'SEED-B', 'DEPENDS_ON');
    env = {
      DB: backend.db,
      VECTORIZE: makeMockVectorize([
        { id: 'SEED-A', score: 0.92, metadata: {} },
        { id: 'SEED-B', score: 0.71, metadata: {} },
      ]),
      AI: makeMockAi(),
      ENVIRONMENT: 'test',
    };
    const res = await post({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: 'q', topK: 5 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      graphExpansion: { expandedNodeCount: number };
      results: Array<{ id: string; score: number }>;
    };
    // SEED-B 는 baseline 이라 확장 집합에서 제외 (충돌 → baseline 우선).
    expect(body.graphExpansion.expandedNodeCount).toBe(0);
    const sb = body.results.find((h) => h.id === 'SEED-B');
    expect(sb?.score).toBeCloseTo(0.71, 5); // 실 vector score 보존 (0 아님)
  });

  it('CO6-4(c) — mid-loop graphWalk 실패는 fail-loud (부분 확장 degrade 금지, 5xx)', async () => {
    // 2 시드 — 2번째 시드 walk 에서 D1 주입 실패 → 전체 요청 5xx (부분 200 아님).
    await insertApproved(backend.db, 'MS-1', 'LAW', 10);
    await insertApproved(backend.db, 'MS-2', 'LAW', 10);
    await insertApproved(backend.db, 'MS-1X', 'CONCEPT', 5);
    await insertEdge(backend.db, 'MS-1', 'MS-1X', 'DEPENDS_ON');
    let walkCalls = 0;
    const failingDb = {
      prepare(sql: string) {
        const stmt = backend.db.prepare(sql);
        if (!sql.includes('WITH RECURSIVE')) return stmt;
        return {
          bind(...args: unknown[]) {
            const bound = stmt.bind(...args);
            return {
              all: async <T>() => {
                walkCalls += 1;
                if (walkCalls >= 2) throw new Error('injected D1 walk failure (seed #2)');
                return bound.all<T>();
              },
            };
          },
        };
      },
    } as unknown as D1Database;
    env = {
      DB: failingDb,
      VECTORIZE: makeMockVectorize([
        { id: 'MS-1', score: 0.9, metadata: {} },
        { id: 'MS-2', score: 0.85, metadata: {} },
      ]),
      AI: makeMockAi(),
      ENVIRONMENT: 'test',
    };
    const res = await post({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: 'q', topK: 5 });
    // graph-walk query 실패 → GraphWalkError(phase=query) → 500 (200 partial 아님).
    expect(res.status).toBe(500);
    expect(walkCalls).toBeGreaterThanOrEqual(2); // 1번째 성공 후 2번째에서 throw (mid-loop)
    const body = (await res.json()) as { error: string; phase?: string };
    expect(body.error).toBeTruthy();
    expect(body.phase).toBe('query');
  });

  describe('debug 플래그 (MASTER_PLAN WS-4 4c — expandedNodes surface + query 천장 측정 우회)', () => {
    it('debug 미지정(기본 off) → expandedNodes 필드 부재 (응답 계약 불변)', async () => {
      await insertApproved(backend.db, 'SEED-DBG0', 'LAW', 10);
      await insertApproved(backend.db, 'EXP-DBG0', 'CONCEPT', 5);
      await insertEdge(backend.db, 'SEED-DBG0', 'EXP-DBG0', 'DEPENDS_ON');
      env = {
        DB: backend.db,
        VECTORIZE: makeMockVectorize([{ id: 'SEED-DBG0', score: 0.9, metadata: {} }]),
        AI: makeMockAi(),
        ENVIRONMENT: 'test',
      };
      const res = await post({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: 'q', topK: 5 });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { graphExpansion: Record<string, unknown> };
      expect('expandedNodes' in body.graphExpansion).toBe(false);
    });

    it('debug=true → graphExpansion.expandedNodes 확장 전체집합 surface (랭크미달 vs 미도달 재료)', async () => {
      // SEED →(1hop) EXP-A, EXP-B. topK=1 로 EXP 가 top-K 밖이어도(랭크미달)
      // expandedNodes 에는 전체집합이 남아야 진단 가능.
      await insertApproved(backend.db, 'SEED-DBG1', 'LAW', 10);
      await insertApproved(backend.db, 'EXP-DBG-A', 'CONCEPT', 5);
      await insertApproved(backend.db, 'EXP-DBG-B', 'CONCEPT', 5);
      await insertEdge(backend.db, 'SEED-DBG1', 'EXP-DBG-A', 'DEPENDS_ON');
      await insertEdge(backend.db, 'SEED-DBG1', 'EXP-DBG-B', 'USES_FORMULA');
      env = {
        DB: backend.db,
        VECTORIZE: makeMockVectorize([{ id: 'SEED-DBG1', score: 0.9, metadata: {} }]),
        AI: makeMockAi(),
        ENVIRONMENT: 'test',
      };
      const res = await post({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        query: 'q',
        topK: 1,
        debug: true,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        graphExpansion: { expandedNodes?: GraphExpansionDebugNode[] };
        results: Array<{ id: string }>;
      };
      // top-K(1) = SEED 만 — EXP 2건은 랭크미달이나 확장 전체집합엔 존재
      expect(body.results.map((h) => h.id)).toEqual(['SEED-DBG1']);
      const expanded = body.graphExpansion.expandedNodes ?? [];
      expect(expanded.map((n) => n.id).sort()).toEqual(['EXP-DBG-A', 'EXP-DBG-B']);
      for (const n of expanded) {
        expect(n.depth).toBe(1);
        expect(n.truthWeight).toBe(5);
        expect(typeof n.name).toBe('string');
        // 진단 뷰는 description 미포함 (payload 비대 차단 — GraphExpansionDebugNode)
        expect('description' in n).toBe(false);
      }
    });

    it('debug=true + baseline 교집합 → expandedNodes 에서 제외 (baseline.results 로 관측)', async () => {
      // CO6-4(a) 시나리오 재사용 — 둘 다 baseline 인 SEED-A→SEED-B 는 확장 집합 밖.
      await insertApproved(backend.db, 'SEED-DBG-A', 'LAW', 10);
      await insertApproved(backend.db, 'SEED-DBG-B', 'LAW', 10);
      await insertEdge(backend.db, 'SEED-DBG-A', 'SEED-DBG-B', 'DEPENDS_ON');
      env = {
        DB: backend.db,
        VECTORIZE: makeMockVectorize([
          { id: 'SEED-DBG-A', score: 0.92, metadata: {} },
          { id: 'SEED-DBG-B', score: 0.71, metadata: {} },
        ]),
        AI: makeMockAi(),
        ENVIRONMENT: 'test',
      };
      const res = await post({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        query: 'q',
        topK: 5,
        debug: true,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        graphExpansion: { expandedNodes?: GraphExpansionDebugNode[] };
      };
      expect(body.graphExpansion.expandedNodes).toEqual([]);
    });

    it('debug=true + 시드 0건 → expandedNodes=[] (플래그 on 이면 필드 상시 존재)', async () => {
      env = {
        DB: backend.db,
        VECTORIZE: makeMockVectorize([]),
        AI: makeMockAi(),
        ENVIRONMENT: 'test',
      };
      const res = await post({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        query: 'q',
        debug: true,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        graphExpansion: { applied: boolean; expandedNodes?: GraphExpansionDebugNode[] };
      };
      expect(body.graphExpansion.applied).toBe(false);
      expect(body.graphExpansion.expandedNodes).toEqual([]);
    });

    it('query 501자 + debug=true → 200 (측정 경로 한정 우회 — Q-004 583자 영구 제외 해소)', async () => {
      env = {
        DB: backend.db,
        VECTORIZE: makeMockVectorize([]),
        AI: makeMockAi(),
        ENVIRONMENT: 'test',
      };
      const res = await post({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        query: 'a'.repeat(GRAPH_QUERY_PUBLIC_MAX_LENGTH + 83), // 583 = Q-004 실측 길이
        debug: true,
      });
      expect(res.status).toBe(200);
    });

    it('query 501자 + debug 명시 false → 400 (공개 계약 500 유지)', async () => {
      env = {
        DB: backend.db,
        VECTORIZE: makeMockVectorize([]),
        AI: makeMockAi(),
        ENVIRONMENT: 'test',
      };
      const res = await post({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        query: 'a'.repeat(GRAPH_QUERY_PUBLIC_MAX_LENGTH + 1),
        debug: false,
      });
      expect(res.status).toBe(400);
    });

    it('query > 절대 상한(GRAPH_QUERY_DEBUG_MAX_LENGTH) → debug=true 여도 400', async () => {
      env = {
        DB: backend.db,
        VECTORIZE: makeMockVectorize([]),
        AI: makeMockAi(),
        ENVIRONMENT: 'test',
      };
      const res = await post({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        query: 'a'.repeat(GRAPH_QUERY_DEBUG_MAX_LENGTH + 1),
        debug: true,
      });
      expect(res.status).toBe(400);
    });
  });

  it('ADR-047 — 표 벡터가 vector 후보에 섞여도 baseline 후보·top1Score 에서 제외', async () => {
    await insertApproved(backend.db, 'SEED-TBL', 'LAW', 10);
    env = {
      DB: backend.db,
      VECTORIZE: makeMockVectorize([
        { id: 'TBL-001', score: 0.99, metadata: {} }, // 표 벡터 — 제외 대상
        { id: 'SEED-TBL', score: 0.9, metadata: {} },
      ]),
      AI: makeMockAi(),
      ENVIRONMENT: 'test',
    };
    const res = await post({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: 'q', topK: 5 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      baseline: { top1Score: number; results: Array<{ id: string }> };
    };
    expect(body.baseline.results.map((h) => h.id)).toEqual(['SEED-TBL']);
    expect(body.baseline.top1Score).toBeCloseTo(0.9, 5); // 0.99(표) 아님
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
