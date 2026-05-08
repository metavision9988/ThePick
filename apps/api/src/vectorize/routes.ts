/**
 * Vectorize admin routes — Phase 2A 인덱싱 + RAG smoke test 진입점.
 *
 * 라우트:
 *   - POST /bootstrap — D1 노드 fetch + bge-m3 임베딩 + Vectorize upsert
 *   - POST /search    — query 임베딩 + Vectorize.query (smoke test)
 *
 * 보호:
 *   - `requireAdminToken` 미들웨어 (X-Admin-Token 헤더 또는 admin_session 쿠키)
 *   - ADMIN_API_TOKEN 부재 / 길이 < 16 시 401 마스크
 *
 * Phase 2A PoC 범위 (plan §3.4):
 *   - 인덱싱 대상: `knowledge_nodes` 만 (text = `name + '\n' + description`)
 *   - table_cells/headers/structures + formulas 는 별도 step carry-over (JOIN/template 정책 미결정)
 *
 * 근거:
 *   - docs/plans/phase2a-vectorize-indexing.plan.md §3.4 §3.5
 *   - ADR-004 §3 메타데이터 + §4 Addendum (2026-05-08)
 *   - ADR-007 멀티시험 격리 (Hard Rule 16/17)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { ErrorCode, assertValidExamId, type ExamId } from '@thepick/shared';
import { requireAdminToken, type AdminTokenBindings } from '../telemetry/admin-token.js';
import {
  upsertNodesToVectorize,
  BGE_M3_DIMENSIONS,
  VectorizeUpsertError,
  type AiBinding,
  type VectorizeBinding,
  type NodeForVectorize,
  type VectorizeUpsertMetadata,
} from './upserter.js';

/**
 * 검색 시 추가로 의존하는 `query` 메서드 — upserter.ts 인터페이스 확장 (라우트 전용).
 * Cloudflare Vectorize binding 의 실제 메서드 시그니처 정합.
 */
interface VectorizeBindingForRoute extends VectorizeBinding {
  query(
    values: ReadonlyArray<number>,
    options: {
      readonly topK: number;
      readonly filter?: Record<string, string | number | boolean>;
      readonly returnMetadata?: 'none' | 'indexed' | 'all';
      readonly returnValues?: boolean;
    },
  ): Promise<{
    readonly count: number;
    readonly matches: ReadonlyArray<{
      readonly id: string;
      readonly score: number;
      readonly values?: ReadonlyArray<number>;
      readonly metadata?: Record<string, unknown>;
    }>;
  }>;
}

export interface VectorizeRouteBindings extends AdminTokenBindings {
  readonly DB: D1Database;
  readonly VECTORIZE: VectorizeBindingForRoute;
  readonly AI: AiBinding;
}

const BootstrapBodySchema = z.object({
  examId: z.string().min(1),
  source: z.enum(['knowledge_nodes']).default('knowledge_nodes'),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  status: z.string().min(1).optional(),
  dryRun: z.boolean().default(false),
});

const SearchBodySchema = z.object({
  examId: z.string().min(1),
  query: z.string().min(1).max(500),
  topK: z.number().int().min(1).max(20).default(5),
  statusFilter: z.string().min(1).optional(),
});

/** ADR-008 §"Graceful Degradation 임계값" — top1 similarity < 0.60 시 거부/안내. */
const ADR_008_GRACEFUL_THRESHOLD = 0.6;

interface KnowledgeNodeRow {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly description: string | null;
  readonly lv1_insurance: string | null;
  readonly lv2_crop: string | null;
  readonly page_ref: string | null;
  readonly version_year: number;
  readonly truth_weight: number;
  readonly status: string;
}

export function createVectorizeRoutes(): Hono<{ Bindings: VectorizeRouteBindings }> {
  const app = new Hono<{ Bindings: VectorizeRouteBindings }>();

  app.use('*', requireAdminToken<{ Bindings: VectorizeRouteBindings }>());

  app.post('/bootstrap', async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = BootstrapBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: ErrorCode.VALIDATION_ERROR, details: parsed.error.format() }, 400);
    }
    const { examId: rawExamId, source, limit, offset, status, dryRun } = parsed.data;

    let examId: ExamId;
    try {
      examId = assertValidExamId(rawExamId);
    } catch {
      return c.json({ error: ErrorCode.VALIDATION_ERROR, message: 'INVALID_EXAM_ID' }, 400);
    }

    if (source !== 'knowledge_nodes') {
      return c.json({ error: ErrorCode.VALIDATION_ERROR, message: 'UNSUPPORTED_SOURCE' }, 400);
    }

    const baseSelect =
      'SELECT id, type, name, description, lv1_insurance, lv2_crop, page_ref, version_year, truth_weight, status FROM knowledge_nodes';
    const sql =
      typeof status === 'string'
        ? `${baseSelect} WHERE status = ? ORDER BY id LIMIT ? OFFSET ?`
        : `${baseSelect} ORDER BY id LIMIT ? OFFSET ?`;
    const params: unknown[] =
      typeof status === 'string' ? [status, limit, offset] : [limit, offset];

    // Pass 1 SURGEON M1 흡수 — D1 SDK 는 실패 시 throw 로 보고 (D1Result.success literal true).
    // 따라서 try-catch 로 silent skip 차단 — Hono onError 일반 500 우회 + cause 메시지 전파.
    let d1Result: D1Result<KnowledgeNodeRow>;
    try {
      d1Result = await c.env.DB.prepare(sql)
        .bind(...params)
        .all<KnowledgeNodeRow>();
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      return c.json(
        { error: ErrorCode.INTERNAL_ERROR, message: 'D1_QUERY_FAILED', details: msg },
        500,
      );
    }
    const rows = d1Result.results ?? [];

    if (rows.length === 0) {
      return c.json({
        fetched: 0,
        upserted: 0,
        skipped: 0,
        mutationId: null,
        durationMs: 0,
        sampleNodeIds: [],
        dryRun,
      });
    }

    if (dryRun) {
      return c.json({
        fetched: rows.length,
        dryRun: true,
        sampleNodeIds: rows.slice(0, 5).map((r) => r.id),
      });
    }

    const nodes: NodeForVectorize[] = rows.map((r) => buildNodeForVectorize(r));

    let upsertResult;
    try {
      upsertResult = await upsertNodesToVectorize(c.env.VECTORIZE, c.env.AI, examId, nodes);
    } catch (err) {
      if (err instanceof VectorizeUpsertError) {
        return c.json(
          {
            error: ErrorCode.AI_GENERATION_ERROR,
            phase: err.phase,
            message: err.message,
          },
          err.statusCode === 400 ? 400 : 500,
        );
      }
      throw err;
    }

    return c.json({
      fetched: rows.length,
      ...upsertResult,
      sampleNodeIds: nodes.slice(0, 5).map((n) => n.id),
    });
  });

  app.post('/search', async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = SearchBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: ErrorCode.VALIDATION_ERROR, details: parsed.error.format() }, 400);
    }
    const { examId: rawExamId, query, topK, statusFilter } = parsed.data;

    let examId: ExamId;
    try {
      examId = assertValidExamId(rawExamId);
    } catch {
      return c.json({ error: ErrorCode.VALIDATION_ERROR, message: 'INVALID_EXAM_ID' }, 400);
    }

    // Pass 1 SURGEON C1 흡수 — AI 호출 try-catch + cause 전파 (silent 500 차단)
    let aiResp: Awaited<ReturnType<AiBinding['run']>>;
    try {
      aiResp = await c.env.AI.run('@cf/baai/bge-m3', { text: [query] });
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      return c.json({ error: ErrorCode.AI_GENERATION_ERROR, phase: 'embed', message: msg }, 500);
    }

    const queryVector = aiResp.data[0];
    if (
      !Array.isArray(queryVector) ||
      queryVector.length !== BGE_M3_DIMENSIONS ||
      aiResp.data.length !== 1
    ) {
      return c.json(
        {
          error: ErrorCode.AI_GENERATION_ERROR,
          phase: 'embed',
          message: 'EMBEDDING_DIMENSION_MISMATCH',
        },
        500,
      );
    }

    const filter: Record<string, string> = { exam_id: examId as string };
    if (typeof statusFilter === 'string') filter.status = statusFilter;

    // Pass 1 SURGEON C2 흡수 — Vectorize.query try-catch + matches null 가드
    let queryResult: Awaited<ReturnType<VectorizeBindingForRoute['query']>>;
    try {
      queryResult = await c.env.VECTORIZE.query(queryVector, {
        topK,
        filter,
        returnMetadata: 'all',
      });
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      return c.json({ error: ErrorCode.AI_GENERATION_ERROR, phase: 'query', message: msg }, 500);
    }

    const matches = queryResult.matches ?? [];
    const top1Score = matches[0]?.score ?? 0;

    // Pass 2 ARCHITECT M1 흡수 — ADR-008 graceful degradation (top1 < 0.60 시 플래그)
    // 검색단 클라이언트가 graceful 응답 반영 (사용자 안내 멘트 / Multi-Path Fallback 진입)
    const gracefulDegradation = top1Score < ADR_008_GRACEFUL_THRESHOLD;

    return c.json({
      query,
      examId,
      topK,
      filter,
      gracefulDegradation,
      top1Score,
      matches: matches.map((m) => ({
        id: m.id,
        score: m.score,
        metadata: m.metadata ?? null,
      })),
    });
  });

  return app;
}

function buildNodeForVectorize(row: KnowledgeNodeRow): NodeForVectorize {
  const description = row.description?.trim() ?? '';
  const text = description.length > 0 ? `${row.name}\n${description}` : row.name;

  const pageRefParse = parsePageRefToInt(row.page_ref);
  if (!pageRefParse.parsed && typeof row.page_ref === 'string' && row.page_ref.trim() !== '') {
    // Pass 1 SURGEON M3 흡수 — page_ref 가 비어 있지 않은데 정수 추출 실패 시 운영자 detect.
    console.warn(
      `parsePageRefToInt: failed to extract integer from '${row.page_ref}' for node ${row.id} (source_page=0 sentinel)`,
    );
  }

  const metadata: Omit<VectorizeUpsertMetadata, 'exam_id'> = {
    node_id: row.id,
    node_type: row.type,
    status: row.status,
    truth_weight: row.truth_weight,
    revision_year: row.version_year,
    source_page: pageRefParse.value,
    // Phase 2A PoC 단순화 — `superseded_by IS NULL` 기반 is_active 도출은 별도 step
    // (Pass 2 ARCHITECT m1 / Pass 4 CONTRACT MINOR-1 carry-over).
    is_active: true,
    ...(row.lv1_insurance ? { lv1_insurance: row.lv1_insurance } : {}),
    ...(row.lv2_crop ? { lv2_crop: row.lv2_crop } : {}),
  };

  return { id: row.id, text, metadata };
}

/**
 * page_ref 문자열에서 첫 정수만 추출. 'p.123-125' / '684' / null 모두 처리.
 *
 * Pass 1 SURGEON M3 흡수 — `page_ref` 가 string 인데 정수 추출 실패 시
 * `0` sentinel 로 silent fallback 되면 검색 결과 출처 표시 시 'p.0' 으로
 * 사용자 혼란. caller (`buildNodeForVectorize`) 가 nodeId 와 함께 console.warn
 * 출력하여 운영자 detect 가능하도록 분리.
 */
function parsePageRefToInt(pageRef: string | null | undefined): {
  value: number;
  parsed: boolean;
} {
  if (typeof pageRef !== 'string' || pageRef.trim() === '') {
    return { value: 0, parsed: false };
  }
  const match = pageRef.match(/\d+/);
  if (match === null) {
    return { value: 0, parsed: false };
  }
  return { value: Number.parseInt(match[0], 10), parsed: true };
}
