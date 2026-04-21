/**
 * 인증 라우트 (L3 Fortress) — Hono 엔드포인트.
 *
 * 엔드포인트:
 *   - POST /api/auth/register
 *   - POST /api/auth/login
 *   - POST /api/auth/logout
 *
 * 정책:
 *   - Zod 입력 검증 (422)
 *   - Rate Limit (IP + email 복합, 429) — ADR-006 Cloudflare Workers Rate Limit API
 *   - HIBP 체크 (회원가입 시) — unavailable 허용, 사용자 안내 포함
 *   - PBKDF2 600k 해시 (ADR-005 OWASP 2024)
 *   - 상수시간 검증 + 더미 verify (timing enum 방어, 4-Pass C-1)
 *   - enumeration 일관화: 모든 로그인 실패 (row 없음/password 불일치/suspended/deleted)
 *     는 401 `INVALID_CREDENTIALS` 단일 응답 (Pass 1 C-2, Pass 3 C-1)
 *   - write-path 5xx → 503 + Retry-After (ADR-008 §5)
 *   - D1 재시도 (ADR-008 §1)
 *
 * 근거:
 *   - ADR-005 인증 PBKDF2-SHA256 600,000 iterations
 *   - ADR-006 Cloudflare 단일 벤더 (Rate Limit API)
 *   - ADR-008 Graceful Degradation + L1 Edge Cache
 *   - ADR-009 PII 마스킹
 *   - v3.0 §7.1 users.name 컬럼
 *   - Step 1-1 4-Pass 리뷰 Critical 9건 해소
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { AUTH_MESSAGES, createLogger, type Logger, type LoggerEnvironment } from '@thepick/shared';
import { withRetry } from '../middleware/retry.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './constants.js';
import { performDummyVerify } from './dummy-verify.js';
import { checkPwned } from './hibp.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  checkEmailRateLimit,
  checkIpRateLimit,
  getClientIp,
  type RateLimiter,
} from './rate-limit.js';

interface AuthBindings {
  readonly DB: D1Database;
  readonly AUTH_RATE_LIMITER_IP?: RateLimiter;
  readonly AUTH_RATE_LIMITER_EMAIL?: RateLimiter;
  readonly ENVIRONMENT?: string;
}

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

function buildLogger(env: AuthBindings): Logger {
  return createLogger({
    service: 'thepick-api',
    environment: resolveLoggerEnv(env.ENVIRONMENT),
  }).child({ module: 'auth' });
}

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  name: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

interface StoredUserRow {
  readonly id: string;
  readonly email: string;
  readonly password_hash: string;
  readonly password_salt: string;
  readonly password_iterations: number;
  readonly status: 'active' | 'suspended' | 'deleted';
}

export function createAuthRoutes(): Hono<{ Bindings: AuthBindings }> {
  const router = new Hono<{ Bindings: AuthBindings }>();

  router.post('/register', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'register' });
    const ip = getClientIp(c);
    const ipAllowed = await checkIpRateLimit(c.env.AUTH_RATE_LIMITER_IP, ip, c.env.ENVIRONMENT);
    if (!ipAllowed) {
      c.header('Retry-After', '60');
      return c.json({ error: 'TOO_MANY_REQUESTS' }, 429);
    }

    const parsed = registerSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues }, 422);
    }

    const { email, password, name } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const pwned = await checkPwned(password);
    if (pwned.status === 'pwned') {
      return c.json(
        { error: 'PASSWORD_PWNED', message: AUTH_MESSAGES.REGISTER_PASSWORD_PWNED },
        422,
      );
    }

    let hashed;
    try {
      hashed = await hashPassword(password);
    } catch (err) {
      logger.error('hashPassword failed', err, { email: normalizedEmail });
      return c.json({ error: 'HASH_ERROR' }, 500);
    }

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      const result = await withRetry(() =>
        c.env.DB.prepare(
          `INSERT INTO users (id, email, name, password_hash, password_salt, password_iterations, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            userId,
            normalizedEmail,
            name ?? null,
            hashed.hash,
            hashed.salt,
            hashed.iterations,
            'active',
            now,
            now,
          )
          .run(),
      );
      if (!result.value.success) {
        throw new Error('D1_INSERT_FAILED');
      }
    } catch (err) {
      if (err instanceof Error && /UNIQUE constraint failed/.test(err.message)) {
        return c.json({ error: 'EMAIL_TAKEN', message: AUTH_MESSAGES.REGISTER_EMAIL_TAKEN }, 409);
      }
      logger.error('register write failed', err, { email: normalizedEmail });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }

    const responseBody: {
      user: { id: string; email: string; name: string | null };
      hibpStatus: string;
      hibpMessage?: string;
    } = {
      user: { id: userId, email: normalizedEmail, name: name ?? null },
      hibpStatus: pwned.status,
    };
    if (pwned.status === 'unavailable') {
      responseBody.hibpMessage = AUTH_MESSAGES.HIBP_UNAVAILABLE;
    }

    return c.json(responseBody, 201);
  });

  router.post('/login', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'login' });
    const ip = getClientIp(c);
    const ipAllowed = await checkIpRateLimit(c.env.AUTH_RATE_LIMITER_IP, ip, c.env.ENVIRONMENT);
    if (!ipAllowed) {
      c.header('Retry-After', '60');
      return c.json({ error: 'TOO_MANY_REQUESTS' }, 429);
    }

    const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues }, 422);
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const emailAllowed = await checkEmailRateLimit(
      c.env.AUTH_RATE_LIMITER_EMAIL,
      normalizedEmail,
      c.env.ENVIRONMENT,
    );
    if (!emailAllowed) {
      c.header('Retry-After', '600');
      return c.json({ error: 'TOO_MANY_REQUESTS' }, 429);
    }

    let row: StoredUserRow | null;
    try {
      const retrieval = await withRetry(() =>
        c.env.DB.prepare(
          `SELECT id, email, password_hash, password_salt, password_iterations, status FROM users WHERE email = ? LIMIT 1`,
        )
          .bind(normalizedEmail)
          .first<StoredUserRow>(),
      );
      row = retrieval.value;
    } catch (err) {
      logger.error('login read failed', err, { email: normalizedEmail });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }

    // 모든 실패 케이스 (row 없음 / 상태 비활성 / 패스워드 불일치) 를 단일 응답으로 통일.
    // Timing 평탄화: row 없을 때도 PBKDF2 verify 를 실행 (dummy hash) 하여 응답 시간을
    // 정상 경로와 동일하게 맞춤. 계정 존재 여부 식별 공격 차단.
    const genericFailure = {
      error: 'INVALID_CREDENTIALS',
      message: AUTH_MESSAGES.LOGIN_INVALID_CREDENTIALS,
    } as const;

    if (row === null) {
      // dummy verify 실패가 발생해도 timing 평탄화는 best-effort 이므로 swallow.
      // catch 없으면 500 누수 → account enumeration 재개 (D-7-3).
      try {
        await performDummyVerify(password);
      } catch (err) {
        logger.warn('dummy verify failed on missing-row branch', {
          cause: err instanceof Error ? err.message : String(err),
        });
      }
      return c.json(genericFailure, 401);
    }

    if (row.status !== 'active') {
      // suspended / deleted 모두 동일한 401 generic 응답 (enumeration 방어).
      // 더미 verify 로 timing 평탄화 유지.
      try {
        await performDummyVerify(password);
      } catch (err) {
        logger.warn('dummy verify failed on inactive-status branch', {
          cause: err instanceof Error ? err.message : String(err),
        });
      }
      return c.json(genericFailure, 401);
    }

    const valid = await verifyPassword(password, {
      hash: row.password_hash,
      salt: row.password_salt,
      iterations: row.password_iterations,
    });
    if (!valid) {
      return c.json(genericFailure, 401);
    }

    const now = new Date().toISOString();
    try {
      await withRetry(() =>
        c.env.DB.prepare(`UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`)
          .bind(now, now, row.id)
          .run(),
      );
    } catch (err) {
      // 로그인 자체는 성공 — last_login_at 업데이트 실패는 관찰성 손실만
      logger.warn('last_login_at update failed', {
        userId: row.id,
        cause: err instanceof Error ? err.message : String(err),
      });
    }

    return c.json({
      user: { id: row.id, email: row.email },
    });
  });

  router.post('/logout', async (c) => {
    // Phase 1 Step 1-1: JWT/Cookie 발급 없음 → 서버 측 세션 상태도 없음.
    // 클라이언트 토큰 폐기는 Phase 2 JWT 도입 이후. 본 라우트는 idempotent stub.
    return c.body(null, 204);
  });

  return router;
}
