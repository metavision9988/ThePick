/**
 * Vectorize routes — dispatcher 통합 테스트 (P4-M1 흡수, Session 058).
 *
 * 검증:
 *   - X-Admin-Token 부재/오 / ADMIN_API_TOKEN 환경변수 미설정 → 401 마스크
 *   - BootstrapBodySchema validation (zod)
 *   - source enum 4종 dispatcher (knowledge_nodes / table_structures / table_headers / table_cells)
 *   - status + table_* 결합 시 400 reject (P3-M1 schema refinement)
 *   - examId Hard Rule 17 위반 → 400
 *   - D1 throw 시 production/staging 마스킹 vs dev/test cause.message (P3-M2)
 *   - /search 라우트 graceful degradation 플래그 (ADR-008)
 *
 * 근거:
 *   - 4-Pass review-20260508-152059 P4-M1 (3회째 carry-over → 본 step 선결 의무 흡수)
 *   - docs/plans/phase2a-vectorize-table-indexing.plan.md §5 Gate 5.10
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { EXAM_IDS } from '@thepick/shared';
import { createVectorizeRoutes, type VectorizeRouteBindings } from '../routes.js';
import {
  createD1FromAllMigrations,
  type SqliteBackedD1,
} from '../../__tests__/helpers/d1-from-sqlite.js';
import { BGE_M3_DIMENSIONS } from '../upserter.js';

const ADMIN_TOKEN = 'test-admin-vectorize-token-32bytes-aa-v1';

function makeMockAi(): VectorizeRouteBindings['AI'] & { run: ReturnType<typeof vi.fn> } {
  const run = vi.fn(
    async (_model: '@cf/baai/bge-m3', input: { readonly text: ReadonlyArray<string> }) => {
      const data = input.text.map((_, i) => {
        const arr = new Array<number>(BGE_M3_DIMENSIONS);
        for (let j = 0; j < BGE_M3_DIMENSIONS; j++) arr[j] = ((i + j) % 1000) / 1000;
        return arr;
      });
      return { shape: [data.length, BGE_M3_DIMENSIONS], data };
    },
  );
  return { run } as unknown as VectorizeRouteBindings['AI'] & { run: ReturnType<typeof vi.fn> };
}

function makeMockVectorize(): VectorizeRouteBindings['VECTORIZE'] & {
  upsert: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
} {
  const upsert = vi.fn(async () => ({ mutationId: 'mock-mutation-001' }));
  const query = vi.fn(async () => ({
    count: 1,
    matches: [{ id: 'CONCEPT-001', score: 0.85, metadata: { node_id: 'CONCEPT-001' } }],
  }));
  return { upsert, query } as unknown as VectorizeRouteBindings['VECTORIZE'] & {
    upsert: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
}

interface AppEnv {
  Bindings: VectorizeRouteBindings;
}

function buildApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.route('/api/admin/vectorize', createVectorizeRoutes());
  return app;
}

/**
 * 최소 fixture row 적재 — 각 source 별 1건씩 dispatcher 검증용.
 * D1 prepare/run pattern (apps/api 기존 helper 정합).
 */
async function seedFixtures(db: D1Database): Promise<void> {
  // ADR-030 / migrations/0019 — book_page + pdf_page NOT NULL 트리거 강제
  await db
    .prepare(
      'INSERT INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, page_ref, book_page, pdf_page, version_year, truth_weight, status) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      'CONCEPT-TEST-001',
      'CONCEPT',
      'Test Concept',
      'integration test fixture',
      'p.100',
      100,
      105,
      2026,
      5,
      'draft',
    )
    .run();

  await db
    .prepare(
      'INSERT INTO table_structures (id, source_node_id, title, pattern_type, row_count, col_count, source, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind('TBL-998', 'CONCEPT-TEST-001', 'Test Table', 'A_simple', 2, 2, 'test fixture', 'draft')
    .run();

  await db
    .prepare(
      'INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES (?, ?, ?, ?, ?, NULL, ?)',
    )
    .bind('TROW-998-01', 'TBL-998', 'row', 1, 1, 'row label')
    .run();

  await db
    .prepare(
      'INSERT INTO table_headers (id, table_id, axis, level, index_pos, parent_id, text) VALUES (?, ?, ?, ?, ?, NULL, ?)',
    )
    .bind('TCOL-998-01', 'TBL-998', 'column', 1, 1, 'col label')
    .run();

  await db
    .prepare(
      'INSERT INTO table_cells (id, table_id, row_id, col_id, value_text, value_type) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind('TCELL-998-01-01', 'TBL-998', 'TROW-998-01', 'TCOL-998-01', 'cell value', 'text')
    .run();

  await db
    .prepare(
      'INSERT INTO topic_clusters (id, name, lv1, lv2, lv3, exam_frequency, is_covered, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind('TC-998', '논작물 — 표본구간 수확량산정', '논작물', '5점', null, 7, 1, 'test fixture')
    .run();
}

describe('Vectorize routes — dispatcher 통합 (P4-M1 흡수)', () => {
  let backend: SqliteBackedD1;
  let app: Hono<AppEnv>;
  let env: VectorizeRouteBindings;

  beforeEach(async () => {
    backend = createD1FromAllMigrations();
    await seedFixtures(backend.db);
    env = {
      DB: backend.db,
      VECTORIZE: makeMockVectorize(),
      AI: makeMockAi(),
      ADMIN_API_TOKEN: ADMIN_TOKEN,
      ENVIRONMENT: 'test',
    };
    app = buildApp();
  });

  afterEach(() => {
    backend.close();
    vi.restoreAllMocks();
  });

  async function authedPost(
    path: string,
    body: unknown,
    overrideEnv?: Partial<VectorizeRouteBindings>,
  ): Promise<Response> {
    const usedEnv = { ...env, ...(overrideEnv ?? {}) };
    return await app.request(
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': ADMIN_TOKEN },
        body: JSON.stringify(body),
      },
      usedEnv,
    );
  }

  // ============================================================
  // admin-token 게이트 (401 마스크)
  // ============================================================
  describe('admin-token 게이트', () => {
    it('X-Admin-Token 부재 → 401', async () => {
      const res = await app.request(
        '/api/admin/vectorize/bootstrap',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
            source: 'knowledge_nodes',
          }),
        },
        env,
      );
      expect(res.status).toBe(401);
    });

    it('X-Admin-Token 불일치 → 401', async () => {
      const res = await app.request(
        '/api/admin/vectorize/bootstrap',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': 'wrong-token-but-32-bytes-aaaaaaaa',
          },
          body: JSON.stringify({
            examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
            source: 'knowledge_nodes',
          }),
        },
        env,
      );
      expect(res.status).toBe(401);
    });

    it('ADMIN_API_TOKEN 미설정 (production misconfig) → 401', async () => {
      const res = await authedPost(
        '/api/admin/vectorize/bootstrap',
        { examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, source: 'knowledge_nodes' },
        { ADMIN_API_TOKEN: undefined },
      );
      expect(res.status).toBe(401);
    });

    it('ADMIN_API_TOKEN 길이 < 16 → 401 마스크', async () => {
      const shortToken = 'short';
      const res = await app.request(
        '/api/admin/vectorize/bootstrap',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Token': shortToken },
          body: JSON.stringify({
            examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
            source: 'knowledge_nodes',
          }),
        },
        { ...env, ADMIN_API_TOKEN: shortToken },
      );
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // BootstrapBodySchema validation
  // ============================================================
  describe('BootstrapBodySchema validation', () => {
    it('source 미지원 값 → 400 (zod enum)', async () => {
      const res = await authedPost('/api/admin/vectorize/bootstrap', {
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        source: 'unknown_source',
      });
      expect(res.status).toBe(400);
    });

    it('limit > 100 → 400', async () => {
      const res = await authedPost('/api/admin/vectorize/bootstrap', {
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        source: 'knowledge_nodes',
        limit: 101,
      });
      expect(res.status).toBe(400);
    });

    it('P3-M1 schema refinement: source=table_cells + status → 400 + 명확한 메시지', async () => {
      const res = await authedPost('/api/admin/vectorize/bootstrap', {
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        source: 'table_cells',
        status: 'draft',
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string; details: unknown };
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(body.details)).toContain(
        'status filter is only supported with source=knowledge_nodes',
      );
    });

    it('P3-M1: source=knowledge_nodes + status → PASS (refinement 통과)', async () => {
      const res = await authedPost('/api/admin/vectorize/bootstrap', {
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        source: 'knowledge_nodes',
        status: 'draft',
        dryRun: true,
      });
      expect(res.status).toBe(200);
    });

    it('P3-M1: source=topic_clusters + status → 400 (status filter 거부)', async () => {
      const res = await authedPost('/api/admin/vectorize/bootstrap', {
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        source: 'topic_clusters',
        status: 'approved',
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string; details: unknown };
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(body.details)).toContain(
        'status filter is only supported with source=knowledge_nodes',
      );
    });

    it('P3-M1: source=table_headers + no status → PASS', async () => {
      const res = await authedPost('/api/admin/vectorize/bootstrap', {
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        source: 'table_headers',
        dryRun: true,
      });
      expect(res.status).toBe(200);
    });

    it('Hard Rule 17 위반 (allowlist 외 examId) → 400', async () => {
      const res = await authedPost('/api/admin/vectorize/bootstrap', {
        examId: 'invalid-exam-id',
        source: 'knowledge_nodes',
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { message: string };
      expect(body.message).toBe('INVALID_EXAM_ID');
    });
  });

  // ============================================================
  // source dispatcher (4종 분기)
  // ============================================================
  describe('source dispatcher 4종 분기', () => {
    const examId = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

    it('source=knowledge_nodes (default) → CONCEPT-TEST-001 dryRun', async () => {
      const res = await authedPost('/api/admin/vectorize/bootstrap', {
        examId,
        source: 'knowledge_nodes',
        dryRun: true,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { fetched: number; sampleNodeIds: string[] };
      expect(body.fetched).toBe(1);
      expect(body.sampleNodeIds).toContain('CONCEPT-TEST-001');
    });

    it('source=table_structures → TBL-998 dryRun + source 응답 명시', async () => {
      const res = await authedPost('/api/admin/vectorize/bootstrap', {
        examId,
        source: 'table_structures',
        dryRun: true,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        fetched: number;
        source: string;
        sampleNodeIds: string[];
      };
      expect(body.fetched).toBe(1);
      expect(body.source).toBe('table_structures');
      expect(body.sampleNodeIds).toContain('TBL-998');
    });

    it('source=table_headers → TROW/TCOL dryRun', async () => {
      const res = await authedPost('/api/admin/vectorize/bootstrap', {
        examId,
        source: 'table_headers',
        dryRun: true,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { fetched: number; sampleNodeIds: string[] };
      expect(body.fetched).toBe(2);
      expect(body.sampleNodeIds).toEqual(expect.arrayContaining(['TCOL-998-01', 'TROW-998-01']));
    });

    it('source=table_cells → TCELL dryRun (merged_ref WHERE 차단 정합)', async () => {
      const res = await authedPost('/api/admin/vectorize/bootstrap', {
        examId,
        source: 'table_cells',
        dryRun: true,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { fetched: number; sampleNodeIds: string[] };
      expect(body.fetched).toBe(1);
      expect(body.sampleNodeIds).toContain('TCELL-998-01-01');
    });

    it('source=topic_clusters → TC-998 dryRun + source 응답 명시', async () => {
      const res = await authedPost('/api/admin/vectorize/bootstrap', {
        examId,
        source: 'topic_clusters',
        dryRun: true,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        fetched: number;
        source: string;
        sampleNodeIds: string[];
      };
      expect(body.fetched).toBe(1);
      expect(body.source).toBe('topic_clusters');
      expect(body.sampleNodeIds).toContain('TC-998');
    });

    it('source=topic_clusters (실제 upsert) → metadata.node_type=topic_cluster + exam_id 자동 주입', async () => {
      const res = await authedPost('/api/admin/vectorize/bootstrap', {
        examId,
        source: 'topic_clusters',
        dryRun: false,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        fetched: number;
        upserted: number;
        mutationId: string;
        sampleNodeIds: string[];
      };
      expect(body.fetched).toBe(1);
      expect(body.upserted).toBe(1);
      expect(body.mutationId).toBe('mock-mutation-001');
      expect(body.sampleNodeIds).toContain('TC-998');

      const vectorizeMock = env.VECTORIZE as unknown as { upsert: ReturnType<typeof vi.fn> };
      expect(vectorizeMock.upsert).toHaveBeenCalledTimes(1);
      const upsertCall = vectorizeMock.upsert.mock.calls[0][0] as Array<{
        id: string;
        metadata: Record<string, unknown>;
      }>;
      expect(upsertCall[0].id).toBe('TC-998');
      expect(upsertCall[0].metadata.exam_id).toBe(examId);
      expect(upsertCall[0].metadata.node_type).toBe('topic_cluster');
      expect(upsertCall[0].metadata.status).toBe('approved');
      expect(upsertCall[0].metadata.truth_weight).toBe(5);
      expect(upsertCall[0].metadata.lv1_insurance).toBe('논작물');
      // ★ Reality Anchor 영속: lv2_crop = '5점' (점수 분류, 의미 mismatch — D-TCV-4 carry-over)
      expect(upsertCall[0].metadata.lv2_crop).toBe('5점');
    });

    it('source=table_cells (실제 upsert) → AI + Vectorize.upsert 호출 + sampleNodeIds', async () => {
      const res = await authedPost('/api/admin/vectorize/bootstrap', {
        examId,
        source: 'table_cells',
        dryRun: false,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        fetched: number;
        upserted: number;
        mutationId: string;
        sampleNodeIds: string[];
      };
      expect(body.fetched).toBe(1);
      expect(body.upserted).toBe(1);
      expect(body.mutationId).toBe('mock-mutation-001');
      expect(body.sampleNodeIds).toContain('TCELL-998-01-01');

      // Vectorize.upsert called once with metadata containing exam_id (Hard Rule 16 zero-cost)
      const vectorizeMock = env.VECTORIZE as unknown as { upsert: ReturnType<typeof vi.fn> };
      expect(vectorizeMock.upsert).toHaveBeenCalledTimes(1);
      const upsertCall = vectorizeMock.upsert.mock.calls[0][0] as Array<{
        metadata: Record<string, unknown>;
      }>;
      expect(upsertCall[0].metadata.exam_id).toBe(examId);
      expect(upsertCall[0].metadata.node_type).toBe('CELL');
      expect(upsertCall[0].metadata.parent_table_id).toBe('TBL-998');
    });
  });

  // ============================================================
  // P3-M2 D1 details masking
  // ============================================================
  describe('P3-M2 D1 details masking', () => {
    /**
     * D1 throw 유도용 mock — fetcher 가 호출하는 prepare/bind/all 단계에서 throw.
     * raw SQLite close 대신 사용 (afterEach 중복 close 회피).
     */
    function makeFailingDb(errorMessage: string): D1Database {
      return {
        prepare(_sql: string) {
          return {
            bind(..._args: unknown[]) {
              const throwErr = async (): Promise<never> => {
                throw new Error(errorMessage);
              };
              return {
                first: throwErr,
                run: throwErr,
                all: throwErr,
                raw: throwErr,
              };
            },
          };
        },
      } as unknown as D1Database;
    }

    it('test 환경: cause.message 노출 (dev/test 만 허용)', async () => {
      const failingMessage = 'D1_ERROR: detailed inner SELECT FROM knowledge_nodes WHERE failed';
      const res = await authedPost(
        '/api/admin/vectorize/bootstrap',
        { examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, source: 'knowledge_nodes' },
        { DB: makeFailingDb(failingMessage), ENVIRONMENT: 'test' },
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string; message: string; details: string };
      expect(body.message).toBe('D1_QUERY_FAILED');
      expect(body.details).toContain('detailed inner SELECT');
    });

    it('production 환경: SQL 구조 마스킹 (SQLITE_* 코드 또는 INTERNAL_ERROR 만)', async () => {
      const failingMessage = 'D1_ERROR: detailed inner SELECT FROM knowledge_nodes WHERE failed';
      const res = await authedPost(
        '/api/admin/vectorize/bootstrap',
        { examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, source: 'knowledge_nodes' },
        { DB: makeFailingDb(failingMessage), ENVIRONMENT: 'production' },
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as { details: string };
      const isMasked = /^SQLITE_[A-Z_]+$/.test(body.details) || body.details === 'INTERNAL_ERROR';
      expect(isMasked).toBe(true);
      expect(body.details).not.toMatch(/SELECT|FROM|JOIN|WHERE/i);
    });

    it('production 환경: SQLITE_* 코드 surface (SQLite native 에러 메시지 포함 시)', async () => {
      const failingMessage = 'SQLITE_BUSY: database locked';
      const res = await authedPost(
        '/api/admin/vectorize/bootstrap',
        { examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, source: 'knowledge_nodes' },
        { DB: makeFailingDb(failingMessage), ENVIRONMENT: 'production' },
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as { details: string };
      expect(body.details).toBe('SQLITE_BUSY');
    });
  });

  // ============================================================
  // /search 라우트 (graceful degradation)
  // ============================================================
  describe('/search 라우트 — ADR-008 graceful degradation', () => {
    it('top1 score >= 0.60 → gracefulDegradation=false', async () => {
      // mock 기본 score=0.85
      const res = await authedPost('/api/admin/vectorize/search', {
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        query: '표본주수 산정 기준',
        topK: 5,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { gracefulDegradation: boolean; top1Score: number };
      expect(body.gracefulDegradation).toBe(false);
      expect(body.top1Score).toBeGreaterThanOrEqual(0.6);
    });

    it('top1 score < 0.60 → gracefulDegradation=true', async () => {
      const vectorize = env.VECTORIZE as unknown as { query: ReturnType<typeof vi.fn> };
      vectorize.query.mockResolvedValueOnce({
        count: 1,
        matches: [{ id: 'CONCEPT-001', score: 0.45, metadata: {} }],
      });
      const res = await authedPost('/api/admin/vectorize/search', {
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        query: 'irrelevant query',
        topK: 5,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { gracefulDegradation: boolean; top1Score: number };
      expect(body.gracefulDegradation).toBe(true);
    });

    it('Vectorize.query throw → 500 + AI_GENERATION_ERROR (Pass 1 SURGEON C2 흡수)', async () => {
      const vectorize = env.VECTORIZE as unknown as { query: ReturnType<typeof vi.fn> };
      vectorize.query.mockRejectedValueOnce(new Error('vectorize timeout'));
      const res = await authedPost('/api/admin/vectorize/search', {
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        query: 'test',
        topK: 3,
      });
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string; phase: string };
      expect(body.error).toBe('AI_GENERATION_ERROR');
      expect(body.phase).toBe('query');
    });
  });
});
