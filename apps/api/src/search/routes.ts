/**
 * User search routes — public RAG 검색 라우트 (Phase 2A Step 3).
 *
 * 라우트:
 *   - POST `/api/search` — 학습자 자연어 질문 → 검증된 knowledge_nodes top-K
 *
 * 인증:
 *   - 본 step 인증 0 (public route, MVP). user_session middleware 별도 step
 *
 * 응답:
 *   - `{query, examId, topK, gracefulDegradation, top1Score, results: [...]}`
 *   - graceful=true → Multi-Path Fallback 진입 신호 (별도 step)
 *
 * 근거:
 *   - docs/plans/phase2a-user-search-route.plan.md §3.1
 *   - docs/architecture/SEARCH_PIPELINE.md v2.1 §2~§4
 *   - docs/adr/ADR-008-graceful-degradation.md
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
  searchKnowledgeNodesForUser,
  UserSearchError,
  DEFAULT_RESULT_TOP_K,
  MAX_RESULT_TOP_K,
  type UserSearchDeps,
  type VectorizeQueryBinding,
  type UserSearchD1,
} from './user-search.js';
import type { AiBinding } from '../vectorize/upserter.js';
import { getClientIp, type RateLimiter } from '../auth/rate-limit.js';
import { digestQueryForLog } from './log-redact.js';

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

    try {
      const result = await searchKnowledgeNodesForUser(deps, examId, query, topK);
      return c.json(result);
    } catch (err) {
      if (err instanceof UserSearchError) {
        // Pass 3 M2 (Session 058) + Pass 3 MAJ-A1 (Session 059) — wrangler dev default
        // ENVIRONMENT='development' 매칭 추가. 'dev'/'development'/'test' 모두 dev 모드.
        const env = c.env.ENVIRONMENT ?? 'production';
        const isDev = env === 'dev' || env === 'development' || env === 'test';
        const safeMessage = isDev ? err.message : err.phase;

        // Pass 1 CRIT-1 흡수 (Session 059) — digestQueryForLog throw 시에도 PII 정책 보존.
        // crypto.subtle 미가용/throw 시 'hash_unavailable' fallback (query 평문 절대 미로깅).
        let queryDigest: { length: number; hash: string };
        try {
          queryDigest = await digestQueryForLog(query);
        } catch {
          queryDigest = { length: query.length, hash: 'hash_unavailable' };
        }

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
