/**
 * 진도 API (Phase 1 Step 1-5 나) — 엔진 통합 검증.
 *
 * require-auth 미들웨어를 실제 보호 라우트에 **처음 마운트**. 지금까지 구축한
 * 인증 엔진(Access JWT + D1 Refresh + rotation)이 E2E 로 동작함을 증명한다.
 *
 * 엔드포인트:
 *   - GET  /api/progress/summary — 사용자 누적 진도 집계
 *   - POST /api/progress/review  — 카드 리뷰 기록 (UPSERT)
 *   - GET  /api/progress/due     — 오늘 복습 대상 목록
 *
 * 정책:
 *   - 인증 필수 (require-auth → userId / sessionId 주입)
 *   - 모든 D1 쿼리 `WHERE user_id = ?` 로 사용자 격리 강제
 *   - Zod 입력 검증 (422)
 *   - Dangling FK 차단: POST /review 의 nodeId 는 knowledge_nodes 에 실재 필수 (404)
 *   - write-path 5xx → 503 + Retry-After (ADR-008 §5)
 *
 * 출처 추적성 준비 (Phase 2 본격):
 *   - user_progress.node_id 는 knowledge_nodes FK. Step 1-5 (가) 교재 Graph 적재 후
 *     `knowledge_nodes.page_ref` 를 응답에 surface 할 수 있는 경로 예약.
 *   - Step 1-5 (나) 현 시점에는 knowledge_nodes 테이블이 비어 있어 모든 review 요청이
 *     404 로 응답한다 — 이것이 정상 동작. 테스트에서는 fixture 로 node 를 선주입한다.
 *
 * FSRS 알고리즘은 Phase 2 이월. 현 Step 은 total_reviews / correct_count 카운트만 증가.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createLogger, type Logger, type LoggerEnvironment } from '@thepick/shared';
import { requireAuth, type RequireAuthVariables } from '../auth/middleware/require-auth.js';
import { D1_UNIQUE_CONSTRAINT_PATTERN, withRetry } from '../middleware/retry.js';
import { checkAndIncrementRateLimit, RateLimitExceeded, sleepJitter } from './rate-limit.js';

const KNOWN_ENVIRONMENTS: ReadonlySet<LoggerEnvironment> = new Set<LoggerEnvironment>([
  'development',
  'staging',
  'production',
  'test',
]);

function resolveLoggerEnv(envName: string | undefined): LoggerEnvironment {
  return envName !== undefined && KNOWN_ENVIRONMENTS.has(envName as LoggerEnvironment)
    ? (envName as LoggerEnvironment)
    : 'development';
}

export interface ProgressBindings {
  readonly DB: D1Database;
  readonly ENVIRONMENT?: string;
  readonly JWT_SECRET?: string;
}

function buildLogger(env: ProgressBindings): Logger {
  return createLogger({
    service: 'thepick-api',
    environment: resolveLoggerEnv(env.ENVIRONMENT),
  }).child({ module: 'progress' });
}

/** /due 응답 상한 — Phase 2 FSRS 본격 도입 전 방어적 상한. */
const DUE_LIMIT = 50;

/**
 * schema.ts CARD_TYPES 와 동기. Zod enum 은 인라인 문자열 리터럴 튜플을 요구하므로
 * 여기서도 리터럴로 유지한다 (mismatch 발생 시 typecheck 가 schema.ts 쪽과 충돌을 드러냄).
 */
const reviewSchema = z.object({
  nodeId: z.string().min(1).max(128),
  cardType: z.enum(['flashcard', 'ox', 'blank', 'exam', 'calculation']),
  correct: z.boolean(),
});

interface SummaryAggregate {
  readonly total_cards: number | null;
  readonly total_reviews: number | null;
  readonly total_correct: number | null;
}

interface ProgressDueRow {
  readonly id: string;
  readonly node_id: string | null;
  readonly card_type: string;
  readonly fsrs_next_review: string | null;
}

interface ProgressExistingRow {
  readonly id: string;
  readonly total_reviews: number | null;
  readonly correct_count: number | null;
}

type ProgressEnv = {
  readonly Bindings: ProgressBindings;
  readonly Variables: RequireAuthVariables;
};

export function createProgressRoutes(): Hono<ProgressEnv> {
  const router = new Hono<ProgressEnv>();

  // require-auth 마운트 — /api/progress/* 전체 보호 (엔진 첫 실전 마운트).
  // logger 는 요청 범위로 생성 (Step 1-3 M-5 — 모듈 레벨 logger 금지).
  // Env 를 ProgressEnv 로 명시 — Hono MiddlewareHandler 의 Env invariance 회피.
  router.use('*', async (c, next) => {
    const logger = buildLogger(c.env).child({ route: 'require-auth' });
    const middleware = requireAuth<ProgressEnv>(logger);
    return middleware(c, next);
  });

  router.get('/summary', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'summary' });
    const userId = c.var.userId;
    try {
      const row = await c.env.DB.prepare(
        `SELECT
           COUNT(*) AS total_cards,
           COALESCE(SUM(total_reviews), 0) AS total_reviews,
           COALESCE(SUM(correct_count), 0) AS total_correct
         FROM user_progress
         WHERE user_id = ?`,
      )
        .bind(userId)
        .first<SummaryAggregate>();

      const totalCards = Number(row?.total_cards ?? 0);
      const totalReviews = Number(row?.total_reviews ?? 0);
      const totalCorrect = Number(row?.total_correct ?? 0);
      const accuracy = totalReviews > 0 ? totalCorrect / totalReviews : 0;

      return c.json({
        totalCards,
        totalReviews,
        correctCount: totalCorrect,
        accuracy: Number(accuracy.toFixed(4)),
      });
    } catch (err) {
      logger.error('summary query failed', err, { userId });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }
  });

  router.post('/review', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'review' });
    const userId = c.var.userId;

    // TD-030 방어선 1: per-user 분당 요청 상한. enumeration oracle 열거 속도 제한.
    // review 라우트는 hot-path enumeration 표적 — 기본 60/min 대신 20/min 으로 보수 하향 (CR-2).
    try {
      await checkAndIncrementRateLimit(c.env.DB, userId, { limitPerMinute: 20 });
    } catch (err) {
      if (err instanceof RateLimitExceeded) {
        // 429 응답 전 jitter — 404 경로와 동일 타이밍 분포로 oracle 차단 (MAJOR 방어).
        // 공격자가 "429 = 한도 도달 직전 요청 있었음" 을 타이밍 차이로 감지하는 경로 봉쇄.
        await sleepJitter();
        c.header('Retry-After', String(err.retryAfterSeconds));
        return c.json({ error: 'RATE_LIMIT_EXCEEDED' }, 429);
      }
      logger.error('rate-limit check failed', err, { userId });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }

    const parsed = reviewSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues }, 422);
    }
    const { nodeId, cardType, correct } = parsed.data;

    // Dangling FK 차단 — nodeId 가 knowledge_nodes 에 실재해야 UPSERT 허용.
    // Step 1-5 (가) 교재 Graph 적재 전에는 빈 테이블이라 모든 요청 404 로 응답.
    let nodeRow: { id: string } | null;
    try {
      nodeRow = await c.env.DB.prepare(`SELECT id FROM knowledge_nodes WHERE id = ? LIMIT 1`)
        .bind(nodeId)
        .first<{ id: string }>();
    } catch (err) {
      logger.error('node lookup failed', err, { userId, nodeId });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }
    if (nodeRow === null) {
      // TD-030 방어선 2: 404 응답 전 50~150ms 무작위 지연 (타이밍 oracle 방어).
      await sleepJitter();
      return c.json({ error: 'NODE_NOT_FOUND' }, 404);
    }

    try {
      const existing = await c.env.DB.prepare(
        `SELECT id, total_reviews, correct_count FROM user_progress
         WHERE user_id = ? AND node_id = ? AND card_type = ?
         LIMIT 1`,
      )
        .bind(userId, nodeId, cardType)
        .first<ProgressExistingRow>();

      if (existing !== null) {
        const newTotal = Number(existing.total_reviews ?? 0) + 1;
        const newCorrect = Number(existing.correct_count ?? 0) + (correct ? 1 : 0);
        const updateResult = await withRetry(() =>
          c.env.DB.prepare(
            `UPDATE user_progress
               SET total_reviews = ?,
                   correct_count = ?,
                   updated_at = datetime('now')
             WHERE id = ?`,
          )
            .bind(newTotal, newCorrect, existing.id)
            .run(),
        );
        if (!updateResult.value.success) {
          throw new Error('D1_UPDATE_FAILED');
        }
        return c.json({ ok: true, progressId: existing.id, created: false });
      }

      const progressId = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const insertResult = await withRetry(() =>
        c.env.DB.prepare(
          `INSERT INTO user_progress
             (id, user_id, node_id, card_type, fsrs_difficulty, fsrs_stability, fsrs_interval,
              fsrs_next_review, total_reviews, correct_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0.3, 1.0, 1, NULL, 1, ?, ?, ?)`,
        )
          .bind(progressId, userId, nodeId, cardType, correct ? 1 : 0, nowIso, nowIso)
          .run(),
      );
      if (!insertResult.value.success) {
        throw new Error('D1_INSERT_FAILED');
      }
      return c.json({ ok: true, progressId, created: true }, 201);
    } catch (err) {
      if (err instanceof Error && D1_UNIQUE_CONSTRAINT_PATTERN.test(err.message)) {
        // 동시 요청 INSERT 경합 — 클라이언트 재시도 유도. Phase 2 FSRS 설계 시
        // 복합 UNIQUE (user_id, node_id, card_type) + UPSERT 로 단순화 예정.
        return c.json({ error: 'CONCURRENT_UPDATE' }, 409);
      }
      logger.error('review write failed', err, { userId, nodeId, cardType });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }
  });

  router.get('/due', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'due' });
    const userId = c.var.userId;
    try {
      const result = await c.env.DB.prepare(
        `SELECT id, node_id, card_type, fsrs_next_review
         FROM user_progress
         WHERE user_id = ?
           AND (fsrs_next_review IS NULL OR fsrs_next_review <= datetime('now'))
         ORDER BY fsrs_next_review IS NULL, fsrs_next_review ASC
         LIMIT ?`,
      )
        .bind(userId, DUE_LIMIT)
        .all<ProgressDueRow>();

      const items = result.results.map((row) => ({
        id: row.id,
        nodeId: row.node_id,
        cardType: row.card_type,
        fsrsNextReview: row.fsrs_next_review,
      }));
      return c.json({ items, count: items.length });
    } catch (err) {
      logger.error('due query failed', err, { userId });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }
  });

  return router;
}
