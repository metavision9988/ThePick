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
  // Pass 3 M1 PII log sanitize (Session 059)
  // ============================================================
  describe('Pass 3 M1 PII log sanitize', () => {
    it('console.error 에 query 평문 비로깅 (length + hash 만)', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingEnv: UserSearchRouteBindings = {
        ...env,
        VECTORIZE: {
          upsert: vi.fn(),
          query: vi.fn(async () => {
            throw new Error('persistent failure');
          }),
        } as unknown as UserSearchRouteBindings['VECTORIZE'],
        ENVIRONMENT: 'production',
      };
      const sensitiveQuery = '내 사회보장번호 999-88-7777 관련 질문';
      await postSearch(
        { examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: sensitiveQuery },
        failingEnv,
      );
      expect(errorSpy).toHaveBeenCalled();
      const allLogs = errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(allLogs).not.toContain('999-88-7777');
      expect(allLogs).not.toContain('사회보장번호');
      expect(allLogs).not.toContain(sensitiveQuery);
      // 구조화 로그에 length/hash 포함
      expect(allLogs).toMatch(/queryLength/);
      expect(allLogs).toMatch(/queryHash/);
      errorSpy.mockRestore();
    });

    it('canonical logger JSON 구조: message + service + phase + examId + queryLength + queryHash', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingEnv: UserSearchRouteBindings = {
        ...env,
        VECTORIZE: {
          upsert: vi.fn(),
          query: vi.fn(async () => {
            throw new Error('boom');
          }),
        } as unknown as UserSearchRouteBindings['VECTORIZE'],
        ENVIRONMENT: 'production',
      };
      await postSearch(
        { examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: '표본주수 산정 기준' },
        failingEnv,
      );
      expect(errorSpy).toHaveBeenCalled();
      const logged = errorSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logged) as Record<string, unknown>;
      // canonical createLogger schema (Pass 4 MAJ-1 흡수, Session 059)
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('user_search_failed');
      expect(parsed.service).toBe('thepick-api');
      expect(parsed.environment).toBe('production');
      expect(typeof parsed.timestamp).toBe('string');
      // search 모듈 context fields
      expect(parsed.module).toBe('search/user');
      expect(parsed.phase).toBe('query');
      expect(parsed.examId).toBe(EXAM_IDS.SON_HAE_PYEONG_GA_SA);
      expect(parsed.queryLength).toBe('표본주수 산정 기준'.length);
      expect(parsed.queryHash).toMatch(/^[0-9a-f]{12}$/);
      // err 인자 미전달 (Pass 1 MAJ-1 carry-over) — error 필드 부재 확인
      expect(parsed.error).toBeUndefined();
      errorSpy.mockRestore();
    });

    it('Pass 1 CRIT-1: digestQueryForLog throw 시 hash_unavailable fallback (PII 정책 보존)', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // crypto.subtle.digest mock throw — globalThis 타입은 Workers/Node 런타임에서
      // crypto 를 포함하나 TS lib 정의에 따라 미선언. 명시적 cast 로 안전 접근.
      const subtle = (globalThis as unknown as { crypto: { subtle: SubtleCrypto } }).crypto.subtle;
      const digestSpy = vi
        .spyOn(subtle, 'digest')
        .mockRejectedValue(new Error('webcrypto unavailable'));
      const failingEnv: UserSearchRouteBindings = {
        ...env,
        VECTORIZE: {
          upsert: vi.fn(),
          query: vi.fn(async () => {
            throw new Error('boom');
          }),
        } as unknown as UserSearchRouteBindings['VECTORIZE'],
        ENVIRONMENT: 'production',
      };
      const sensitive = '민감 query 평문';
      const res = await postSearch(
        { examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: sensitive },
        failingEnv,
      );
      // catch 블록이 throw 자체를 발산하지 않고 정상 500 응답
      expect(res.status).toBe(500);
      // 로그에 평문 미노출 (PII 정책 보존)
      const allLogs = errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(allLogs).not.toContain(sensitive);
      // hash 필드는 fallback 값
      const logged = errorSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logged) as Record<string, unknown>;
      expect(parsed.queryHash).toBe('hash_unavailable');
      expect(parsed.queryLength).toBe(sensitive.length);
      digestSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('Pass 3 MAJ-A1: ENVIRONMENT="development" 매칭 → dev mode response (full err.message)', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingEnv: UserSearchRouteBindings = {
        ...env,
        VECTORIZE: {
          upsert: vi.fn(),
          query: vi.fn(async () => {
            throw new Error('boom');
          }),
        } as unknown as UserSearchRouteBindings['VECTORIZE'],
        ENVIRONMENT: 'development', // wrangler dev default
      };
      const res = await postSearch(
        { examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: '질문' },
        failingEnv,
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as { message: string; phase: string };
      expect(body.phase).toBe('query');
      // dev mode: full err.message (phase + 시도 횟수). production 이면 phase 만.
      expect(body.message).toContain('Vectorize.query 실패');
      errorSpy.mockRestore();
    });
  });

  // ============================================================
  // Pass 3 M2 SQL 구조 마스킹 (Session 059)
  // ============================================================
  describe('Pass 3 M2 SQL 구조 마스킹', () => {
    it('console.error 에 SQL 키워드 (LEFT JOIN / ROW_NUMBER / status_transitions) 미노출', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingEnv: UserSearchRouteBindings = {
        ...env,
        DB: {
          prepare: () => ({
            bind: () => ({
              all: () =>
                Promise.reject(
                  new Error(
                    'no such column near "LEFT JOIN status_transitions ROW_NUMBER OVER PARTITION"',
                  ),
                ),
            }),
          }),
        } as unknown as D1Database,
        VECTORIZE: makeMockVectorize([{ id: 'LAW-X', score: 0.9, metadata: {} }]),
        ENVIRONMENT: 'production',
      };
      await postSearch({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: '질문' }, failingEnv);
      expect(errorSpy).toHaveBeenCalled();
      const allLogs = errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(allLogs).not.toMatch(/LEFT JOIN/i);
      expect(allLogs).not.toMatch(/ROW_NUMBER/i);
      expect(allLogs).not.toMatch(/status_transitions/i);
      expect(allLogs).not.toMatch(/PARTITION/i);
      errorSpy.mockRestore();
    });

    it('UserSearchError.message (filter phase) 에 SQL keyword 미포함', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingEnv: UserSearchRouteBindings = {
        ...env,
        DB: {
          prepare: () => ({
            bind: () => ({
              all: () => Promise.reject(new Error('SELECT FROM WHERE LEFT JOIN syntax error')),
            }),
          }),
        } as unknown as D1Database,
        VECTORIZE: makeMockVectorize([{ id: 'LAW-X', score: 0.9, metadata: {} }]),
        ENVIRONMENT: 'test', // dev: full err.message in response
      };
      const res = await postSearch(
        { examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: '질문' },
        failingEnv,
      );
      const body = (await res.json()) as { message: string; phase: string };
      expect(body.phase).toBe('filter');
      // dev 환경 response 에도 SQL keyword 미노출 (UserSearchError.message 자체가 sanitized)
      expect(body.message).not.toMatch(/LEFT JOIN|SELECT|FROM|WHERE/i);
      expect(body.message).toContain('Stage 2 graph filter 실패');
      errorSpy.mockRestore();
    });
  });

  // ============================================================
  // Multi-Path Fallback e2e (Session 059, D-MPF-1~4=A)
  // ============================================================
  describe('Multi-Path Fallback e2e', () => {
    it('graceful=true (top-1 < 0.60) → fallback 자동 진입 (Stage 4 honest_refusal)', async () => {
      // 모든 매칭 score < 0.60 → graceful=true → fallback. Stage 2 keyword "존재안함" 매칭 0건,
      // Stage 3 topic_clusters Vectorize filter type='topic_cluster' 결과 0건
      // → Stage 4 honest_refusal
      const lowEnv: UserSearchRouteBindings = {
        ...env,
        VECTORIZE: makeMockVectorize([{ id: 'LAW-TEST-001', score: 0.55, metadata: {} }]),
      };
      const res = await postSearch(
        { examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: '존재안함존재안함', topK: 3 },
        lowEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        gracefulDegradation: boolean;
        fallback: { stage: number; source: string };
      };
      expect(body.gracefulDegradation).toBe(true);
      expect(body.fallback).toBeDefined();
      expect(body.fallback.stage).toBe(4);
      expect(body.fallback.source).toBe('honest-refusal');
    });

    it('Stage 2 매칭 시 fallback.stage=2 응답 (graceful=true 후 keyword 발견)', async () => {
      const lowEnv: UserSearchRouteBindings = {
        ...env,
        VECTORIZE: makeMockVectorize([{ id: 'NONEXISTENT', score: 0.55, metadata: {} }]),
      };
      const res = await postSearch(
        { examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: '법령 본문', topK: 3 },
        lowEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        fallback: { stage: number; source: string; results: Array<{ id: string }> };
      };
      expect(body.fallback.stage).toBe(2);
      expect(body.fallback.source).toBe('keyword-fallback');
      expect(body.fallback.results.map((r) => r.id)).toContain('LAW-TEST-001');
    });

    it('Stage 4 honest_refusal 시 review_queue INSERT 정합 (PII hash + length 만)', async () => {
      const lowEnv: UserSearchRouteBindings = {
        ...env,
        VECTORIZE: makeMockVectorize([{ id: 'NONEXISTENT', score: 0.5, metadata: {} }]),
      };
      const sensitiveQuery = '내 사번 12345678';
      const res = await postSearch(
        { examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: sensitiveQuery },
        lowEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        fallback: { stage: number; reviewQueueId?: string };
      };
      expect(body.fallback.stage).toBe(4);

      // review_queue INSERT 검증 — query 평문 미저장 (Pass 3 M1 정합)
      const rows = await backend.db
        .prepare('SELECT exam_id, query_hash, query_length, reason FROM review_queue')
        .all<{
          exam_id: string;
          query_hash: string;
          query_length: number;
          reason: string;
        }>();
      expect(rows.results?.length).toBe(1);
      const r = rows.results![0];
      expect(r.exam_id).toBe(EXAM_IDS.SON_HAE_PYEONG_GA_SA);
      expect(r.query_hash).toMatch(/^[0-9a-f]{12}$/);
      expect(r.query_length).toBe(sensitiveQuery.length);
      expect(r.reason).toBe('honest_refusal');
      const allFields = `${r.exam_id}|${r.query_hash}|${r.query_length}|${r.reason}`;
      expect(allFields).not.toContain(sensitiveQuery);
      expect(allFields).not.toContain('12345678');
    });

    it('정상 stage 1+2+3 (graceful=false) → fallback 미진입', async () => {
      const res = await postSearch({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        query: '법령 본문',
        topK: 3,
      });
      const body = (await res.json()) as {
        gracefulDegradation: boolean;
        fallback?: unknown;
        results: Array<{ id: string }>;
      };
      expect(body.gracefulDegradation).toBe(false);
      expect(body.fallback).toBeUndefined();
      expect(body.results.length).toBeGreaterThan(0);
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
