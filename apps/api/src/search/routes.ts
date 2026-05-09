/**
 * User search routes — public RAG 검색 라우트 (Phase 2A Step 3 + Multi-Path Fallback).
 *
 * 라우트:
 *   - POST `/api/search` — 학습자 자연어 질문 → 검증된 knowledge_nodes top-K
 *
 * 인증:
 *   - 본 step 인증 0 (public route, MVP). user_session middleware 별도 step
 *
 * 응답:
 *   - 정상 (Stage 1+2+3): `{query, examId, topK, gracefulDegradation, top1Score, results}`
 *   - Multi-Path 진입 (graceful=true OR stage2Count=0): `fallback: {stage, source, ...}`
 *
 * 근거:
 *   - docs/plans/phase2a-user-search-route.plan.md §3.1
 *   - docs/plans/phase2a-multi-path-fallback.plan.md §3.2
 *   - docs/architecture/SEARCH_PIPELINE.md v2.1 §2~§5
 *   - docs/adr/ADR-008-graceful-degradation.md
 *   - docs/adr/ADR-015-multi-path-fallback-pipeline.md
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  ErrorCode,
  assertValidExamId,
  createLogger,
  type ExamId,
  type LoggerEnvironment,
} from '@thepick/shared';
import {
  embedQuery,
  searchKnowledgeNodesForUser,
  UserSearchError,
  DEFAULT_RESULT_TOP_K,
  MAX_RESULT_TOP_K,
  type UserSearchDeps,
  type UserSearchResult,
  type VectorizeQueryBinding,
  type UserSearchD1,
} from './user-search.js';
import type { AiBinding } from '../vectorize/upserter.js';
import { getClientIp, type RateLimiter } from '../auth/rate-limit.js';
import { digestQueryForLog, type QueryDigest } from './log-redact.js';
import {
  runMultiPathFallback,
  type MultiPathFallbackResponse,
} from './multi-path-fallback/index.js';

export interface UserSearchRouteBindings {
  readonly DB: D1Database;
  readonly VECTORIZE: VectorizeQueryBinding;
  readonly AI: AiBinding;
  /** Pass 3 ADVOCATE C1 흡수 (Session 058) — public route DoS 방어 (60 req/60s/IP). */
  readonly SEARCH_RATE_LIMITER_IP?: RateLimiter;
  readonly ENVIRONMENT?: string;
}

const SearchBodySchema = z.object({
  examId: z.string().min(1),
  query: z.string().min(1).max(500),
  topK: z.number().int().min(1).max(MAX_RESULT_TOP_K).default(DEFAULT_RESULT_TOP_K),
});

export function createUserSearchRoutes(): Hono<{ Bindings: UserSearchRouteBindings }> {
  const app = new Hono<{ Bindings: UserSearchRouteBindings }>();

  app.post('/', async (c) => {
    // Pass 3 ADVOCATE C1 흡수 (Session 058) — public route rate-limit 1차 방어선.
    // 60 req/60s/IP — 정상 학습자 (분당 1초 1 query) 충분, abuse (Workers AI 비용 폭증) 저지.
    // binding 미설정 시 (test 환경 등) skip — 운영 staging/production 만 강제.
    const limiter = c.env.SEARCH_RATE_LIMITER_IP;
    if (limiter !== undefined) {
      const ip = getClientIp(c);
      const { success } = await limiter.limit({ key: ip });
      if (!success) {
        c.header('Retry-After', '60');
        return c.json({ error: 'TOO_MANY_REQUESTS' }, 429);
      }
    }

    const raw = await c.req.json().catch(() => null);
    const parsed = SearchBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: ErrorCode.VALIDATION_ERROR, details: parsed.error.format() }, 400);
    }
    const { examId: rawExamId, query, topK } = parsed.data;

    let examId: ExamId;
    try {
      examId = assertValidExamId(rawExamId);
    } catch {
      return c.json({ error: ErrorCode.VALIDATION_ERROR, message: 'INVALID_EXAM_ID' }, 400);
    }

    const deps: UserSearchDeps = {
      ai: c.env.AI,
      vectorize: c.env.VECTORIZE,
      db: c.env.DB as unknown as UserSearchD1,
    };

    // Pass 4 MAJ-B 흡수 (Session 059) — queryDigest 1회 계산 + Hono context 캐시.
    // fallback 진입 path 와 catch path 가 모두 본 변수 재사용 → request 당 SHA-256 1회.
    // Pass 1 CRIT-1 정합: safeQueryDigest 가 'hash_unavailable' fallback 보장.
    const queryDigest = await safeQueryDigest(query);

    try {
      // Pass 2 MAJ-1 흡수 (Session 059 → Multi-Path step) — bge-m3 임베딩 1회.
      // Stage 1 + Multi-Path Stage 3 양쪽에 precomputedEmbedding 재사용 (호출 절감).
      const queryEmbedding = await embedQuery(c.env.AI, query);
      const result = await searchKnowledgeNodesForUser(deps, examId, query, topK, {
        precomputedEmbedding: queryEmbedding,
      });

      // Multi-Path Fallback 진입 조건 (gracefulDegradation=true 또는 stage2Count=0)
      // - graceful=true: top-1 < 0.60 (Stage 1 임계 미달)
      // - stage2Count=0: Stage 2 hard filter 후 0건 (production 'approved' 0건 정합)
      if (result.gracefulDegradation || result.stage2Count === 0) {
        const fallback = await runMultiPathFallback(
          { db: deps.db, vectorize: deps.vectorize },
          examId,
          query,
          queryDigest,
          queryEmbedding,
        );
        // Pass 3 CRIT-3 흡수 (Session 061 4-Pass): production 응답에서 stage3Diagnostics
        // strip — telemetry leak (Vectorize index 분포 / 임계값 역산 / infra
        // fingerprinting) 차단. NIST SP 800-53 SI-11 (Error Handling) 정합.
        // staging/development/test 는 SP-T06/T07 측정 + 운영 진단용 보존.
        const env = c.env.ENVIRONMENT ?? 'production';
        const allowDiagnostics =
          env === 'dev' || env === 'development' || env === 'test' || env === 'staging';
        const sanitizedFallback = allowDiagnostics ? fallback : stripStage3Diagnostics(fallback);
        return c.json(buildMultiPathResponse(result, sanitizedFallback));
      }

      return c.json(result);
    } catch (err) {
      if (err instanceof UserSearchError) {
        // Pass 3 M2 (Session 058) + Pass 3 MAJ-A1 (Session 059) — wrangler dev default
        // ENVIRONMENT='development' 매칭 추가. 'dev'/'development'/'test' 모두 dev 모드.
        const env = c.env.ENVIRONMENT ?? 'production';
        const isDev = env === 'dev' || env === 'development' || env === 'test';
        const safeMessage = isDev ? err.message : err.phase;

        // Pass 4 MAJ-1 흡수 (Session 059) — canonical createLogger 도입 (schema 통일).
        // err 인자 의도적 미전달: serializeError 가 cause chain 자동 surface 시
        // underlying D1/Vectorize error.message (SQL keyword 등) 가 logRecord 에 노출
        // → Pass 3 M2 (Session 058) 마스킹 정책과 충돌. causeName 만 surface.
        // Pass 1 MAJ-1 (cause message 운영 디버깅 surface) 는 별도 step carry-over —
        // canonical logger 의 serializeError 에 SQL keyword 패턴 redact 추가 후 진입.
        const cause = (err as { cause?: unknown }).cause;
        const causeName = cause instanceof Error ? cause.name : undefined;
        const logger = createLogger({
          service: 'thepick-api',
          environment: env as LoggerEnvironment,
        });
        logger.error('user_search_failed', undefined, {
          module: 'search/user',
          phase: err.phase,
          examId,
          queryLength: queryDigest.length,
          queryHash: queryDigest.hash,
          // err.message 는 Pass 3 M2 (Session 058) 흡수 후 public-safe.
          errMessage: err.message,
          causeName,
        });
        return c.json(
          {
            error: ErrorCode.AI_GENERATION_ERROR,
            phase: err.phase,
            message: safeMessage,
          },
          err.statusCode === 504 ? 504 : 500,
        );
      }
      throw err;
    }
  });

  return app;
}

/**
 * digestQueryForLog 안전 호출 — Pass 1 CRIT-1 흡수 (Session 059).
 *
 * crypto.subtle 미가용/throw 시 'hash_unavailable' fallback. PII 정책 (query 평문
 * 절대 미로깅) 보존.
 */
async function safeQueryDigest(query: string): Promise<QueryDigest> {
  try {
    return await digestQueryForLog(query);
  } catch {
    return { length: query.length, hash: 'hash_unavailable' };
  }
}

/**
 * Multi-Path Fallback 응답 build — Stage 1 결과 + fallback 결과 조합.
 *
 * UserSearchResult shape 보존 (gracefulDegradation/top1Score/stage1Count/stage2Count) +
 * fallback 메타 추가 (Multi-Path Fallback 진입 시점 학습자 UI 분기 신호).
 */
interface MultiPathHttpResponse extends UserSearchResult {
  readonly fallback: MultiPathFallbackResponse;
}

function buildMultiPathResponse(
  stage123: UserSearchResult,
  fallback: MultiPathFallbackResponse,
): MultiPathHttpResponse {
  return { ...stage123, fallback };
}

/**
 * Pass 3 CRIT-3 흡수 (Session 061 4-Pass) — production 응답에서 stage3Diagnostics
 * 제거. Stage 3 (matching hit) 응답의 diagnostics 필드는 routes.ts 응답 build 시
 * 별도 strip 미수행 (현재 honest-refusal 응답에만 stage3Diagnostics? optional 노출).
 * Stage 3 hit 시 TopicClusterRouterResult.diagnostics 는 production 에서도 surface
 * 되나 results.length > 0 이라 전체 응답 의미가 달라짐 — 별도 step carry-over.
 */
function stripStage3Diagnostics(fallback: MultiPathFallbackResponse): MultiPathFallbackResponse {
  if (fallback.stage === 4 && fallback.stage3Diagnostics !== undefined) {
    const sanitized: Omit<typeof fallback, 'stage3Diagnostics'> = {
      source: fallback.source,
      honestRefusal: fallback.honestRefusal,
      messageKey: fallback.messageKey,
      reviewQueueId: fallback.reviewQueueId,
      results: fallback.results,
      stage: fallback.stage,
    };
    return sanitized as MultiPathFallbackResponse;
  }
  return fallback;
}
