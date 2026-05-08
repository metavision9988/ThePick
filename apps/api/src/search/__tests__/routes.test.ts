/**
 * /api/search 라우트 통합 테스트 (Hono mock + zod validation + Hard Rule 17).
 *
 * 검증:
 *   - public route (인증 미들웨어 0)
 *   - zod validation (examId / query / topK 경계)
 *   - Hard Rule 17 (allowlist 외 examId → 400)
 *   - end-to-end (실 D1 fixture + mock VECTORIZE/AI → top-3 응답)
 *   - production 환경 details masking (P3-M2 정합)
 *
 * 근거: docs/plans/phase2a-user-search-route.plan.md §3.2 + §5
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { EXAM_IDS } from '@thepick/shared';
import { createUserSearchRoutes, type UserSearchRouteBindings } from '../routes.js';
import {
  createD1FromAllMigrations,
  type SqliteBackedD1,
} from '../../__tests__/helpers/d1-from-sqlite.js';

const BGE_M3_DIM = 1024;

function makeMockAi(): UserSearchRouteBindings['AI'] & { run: ReturnType<typeof vi.fn> } {
  const run = vi.fn(async () => ({
    shape: [1, BGE_M3_DIM],
    data: [new Array<number>(BGE_M3_DIM).fill(0.5)],
  }));
  return { run } as unknown as UserSearchRouteBindings['AI'] & {
    run: ReturnType<typeof vi.fn>;
  };
}

function makeMockVectorize(
  matches: Array<{ id: string; score: number; metadata?: Record<string, unknown> }>,
): UserSearchRouteBindings['VECTORIZE'] & {
  query: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
} {
  const upsert = vi.fn();
  const query = vi.fn(async () => ({ count: matches.length, matches }));
  return { upsert, query } as unknown as UserSearchRouteBindings['VECTORIZE'] & {
    query: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
}

interface AppEnv {
  Bindings: UserSearchRouteBindings;
}

function buildApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.route('/api/search', createUserSearchRoutes());
  return app;
}

async function seedApprovedFixture(db: D1Database): Promise<void> {
  // Hard Rule 13 (migrations/0018): knowledge_nodes INSERT 는 status='draft' 만 허용.
  // 'approved' 전이는 status_transitions append-only 로그 (migrations/0010).

  await db
    .prepare(
      'INSERT INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, page_ref, book_page, pdf_page, version_year, truth_weight, status) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)',
    )
    .bind('LAW-TEST-001', 'LAW', 'Approved Law', '법령 본문', 'p.300', 300, 305, 2026, 10, 'draft')
    .run();
  // draft → review → approved 전이 (CHECK 정합)
  await db
    .prepare(
      "INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason, transitioned_at) VALUES (?, 'node', ?, 'draft', 'review', 'test-reviewer', ?, ?)",
    )
    .bind('st-001a', 'LAW-TEST-001', '검수 진입', '2026-05-08T00:00:00.000Z')
    .run();
  await db
    .prepare(
      "INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason, transitioned_at) VALUES (?, 'node', ?, 'review', 'approved', 'test-reviewer', ?, ?)",
    )
    .bind('st-001b', 'LAW-TEST-001', '검수 통과', '2026-05-08T01:00:00.000Z')
    .run();

  await db
    .prepare(
      'INSERT INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, page_ref, book_page, pdf_page, version_year, truth_weight, status) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      'CONCEPT-TEST-002',
      'CONCEPT',
      'Approved Concept',
      '개념 본문',
      'p.400',
      400,
      405,
      2026,
      5,
      'draft',
    )
    .run();
  await db
    .prepare(
      "INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason, transitioned_at) VALUES (?, 'node', ?, 'draft', 'review', 'test-reviewer', NULL, ?)",
    )
    .bind('st-002a', 'CONCEPT-TEST-002', '2026-05-08T00:00:00.000Z')
    .run();
  await db
    .prepare(
      "INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason, transitioned_at) VALUES (?, 'node', ?, 'review', 'approved', 'test-reviewer', NULL, ?)",
    )
    .bind('st-002b', 'CONCEPT-TEST-002', '2026-05-08T01:00:00.000Z')
    .run();

  // draft 노드 (status_transitions 0건 → 현재 status 'draft' default → Stage 2 차단 대상)
  await db
    .prepare(
      'INSERT INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, page_ref, book_page, pdf_page, version_year, truth_weight, status) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)',
    )
    .bind('LAW-TEST-002', 'LAW', 'Draft Law', '초안', 'p.500', 500, 505, 2026, 10, 'draft')
    .run();
}

describe('/api/search route', () => {
  let backend: SqliteBackedD1;
  let app: Hono<AppEnv>;
  let env: UserSearchRouteBindings;

  beforeEach(async () => {
    backend = createD1FromAllMigrations();
    await seedApprovedFixture(backend.db);
    env = {
      DB: backend.db,
      VECTORIZE: makeMockVectorize([
        { id: 'LAW-TEST-001', score: 0.85, metadata: {} },
        { id: 'CONCEPT-TEST-002', score: 0.8, metadata: {} },
        { id: 'LAW-TEST-002', score: 0.75, metadata: {} }, // draft → Stage 2 차단
      ]),
      AI: makeMockAi(),
      ENVIRONMENT: 'test',
    };
    app = buildApp();
  });

  afterEach(() => {
    backend.close();
    vi.restoreAllMocks();
  });

  async function postSearch(
    body: unknown,
    overrideEnv?: Partial<UserSearchRouteBindings>,
  ): Promise<Response> {
    const usedEnv = { ...env, ...(overrideEnv ?? {}) };
    return await app.request(
      '/api/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      usedEnv,
    );
  }

  // ============================================================
  // Public route (인증 0)
  // ============================================================
  it('public route (인증 미들웨어 0) — Authorization/X-Admin-Token 부재여도 200', async () => {
    const res = await postSearch({
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      query: '표본주수',
      topK: 3,
    });
    expect(res.status).toBe(200);
  });

  // ============================================================
  // zod validation
  // ============================================================
  describe('zod validation', () => {
    it('examId 부재 → 400', async () => {
      const res = await postSearch({ query: '표본주수' });
      expect(res.status).toBe(400);
    });

    it('query 부재 → 400', async () => {
      const res = await postSearch({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA });
      expect(res.status).toBe(400);
    });

    it('query 길이 > 500 → 400', async () => {
      const res = await postSearch({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        query: 'a'.repeat(501),
      });
      expect(res.status).toBe(400);
    });

    it('topK > 10 → 400 (MAX_RESULT_TOP_K)', async () => {
      const res = await postSearch({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        query: '질문',
        topK: 11,
      });
      expect(res.status).toBe(400);
    });

    it('Hard Rule 17 (allowlist 외 examId) → 400 INVALID_EXAM_ID', async () => {
      const res = await postSearch({ examId: 'invalid-exam-id', query: '질문' });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { message: string };
      expect(body.message).toBe('INVALID_EXAM_ID');
    });
  });

  // ============================================================
  // End-to-end (실 D1 fixture + mock VECTORIZE/AI)
  // ============================================================
  describe('end-to-end Stage 1+2+3 통합', () => {
    it('approved 노드 top-K 응답 (draft 차단 + Truth Weight rerank)', async () => {
      const res = await postSearch({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        query: '법령 본문',
        topK: 3,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        results: Array<{ id: string; truthWeight: number; pageRef: number }>;
        stage1Count: number;
        stage2Count: number;
        gracefulDegradation: boolean;
      };
      expect(body.stage1Count).toBe(3); // 3 candidates ≥ 0.60
      expect(body.stage2Count).toBe(2); // 2 approved (LAW-TEST-001, CONCEPT-TEST-002)
      // Stage 3 LAW(10) > CONCEPT(5)
      expect(body.results.map((r) => r.id)).toEqual(['LAW-TEST-001', 'CONCEPT-TEST-002']);
      expect(body.results[0].truthWeight).toBe(10);
      expect(body.results[0].pageRef).toBe(300);
      expect(body.gracefulDegradation).toBe(false);
    });

    it('approved 노드 0건 시나리오 (production 현 상태) → graceful=true', async () => {
      // 모든 후보 draft 시뮬레이션 (Stage 2 차단)
      const draftOnlyEnv: UserSearchRouteBindings = {
        ...env,
        VECTORIZE: makeMockVectorize([
          { id: 'LAW-TEST-002', score: 0.85, metadata: {} }, // draft
        ]),
      };
      const res = await postSearch(
        {
          examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
          query: '초안 질문',
          topK: 3,
        },
        draftOnlyEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        results: unknown[];
        gracefulDegradation: boolean;
      };
      expect(body.results).toEqual([]);
      expect(body.gracefulDegradation).toBe(true);
    });
  });

  // ============================================================
  // P3-M2 details masking (production 환경)
  // ============================================================
  describe('P3-M2 production 환경 details masking', () => {
    it('test 환경: error.message 노출', async () => {
      // Vectorize.query 강제 실패
      const failingEnv: UserSearchRouteBindings = {
        ...env,
        VECTORIZE: {
          upsert: vi.fn(),
          query: vi.fn(async () => {
            throw new Error('detailed inner error message');
          }),
        } as unknown as UserSearchRouteBindings['VECTORIZE'],
        ENVIRONMENT: 'test',
      };
      const res = await postSearch(
        { examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: '질문' },
        failingEnv,
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as { message: string };
      expect(body.message).toContain('Vectorize.query 실패');
    });

    it('production 환경: phase 만 surface (cause.message 미노출)', async () => {
      const failingEnv: UserSearchRouteBindings = {
        ...env,
        VECTORIZE: {
          upsert: vi.fn(),
          query: vi.fn(async () => {
            throw new Error('SECRET internal SELECT FROM knowledge_nodes WHERE');
          }),
        } as unknown as UserSearchRouteBindings['VECTORIZE'],
        ENVIRONMENT: 'production',
      };
      const res = await postSearch(
        { examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: '질문' },
        failingEnv,
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as { message: string };
      expect(body.message).toBe('query'); // phase 만 노출
      expect(body.message).not.toMatch(/SELECT|FROM|WHERE|SECRET/i);
    });
  });
});
