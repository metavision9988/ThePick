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

import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_COOKIE_PATH,
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_MESSAGES,
  REFRESH_REUSE_REVOKE_ALL,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
  REFRESH_TOKEN_TTL_SECONDS,
  createLogger,
  type Logger,
  type LoggerEnvironment,
} from '@thepick/shared';
import { D1_UNIQUE_CONSTRAINT_PATTERN, withRetry } from '../middleware/retry.js';
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
import {
  createRefreshSession,
  hashIp,
  lookupRefreshSession,
  revokeAllUserSessions,
  revokeSession,
  signAccessToken,
  truncateUserAgent,
} from './session.js';

interface AuthBindings {
  readonly DB: D1Database;
  readonly AUTH_RATE_LIMITER_IP?: RateLimiter;
  readonly AUTH_RATE_LIMITER_EMAIL?: RateLimiter;
  readonly ENVIRONMENT?: string;
  readonly JWT_SECRET?: string;
  readonly IP_PEPPER?: string;
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
    const ipAllowed = await checkIpRateLimit(
      c.env.AUTH_RATE_LIMITER_IP,
      ip,
      c.env.ENVIRONMENT,
      logger,
    );
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

    const pwned = await checkPwned(password, logger);
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
      // M-8 — retry.ts 공유 상수 사용 (D1 에러 포맷 변경 시 silent drift 방지).
      if (err instanceof Error && D1_UNIQUE_CONSTRAINT_PATTERN.test(err.message)) {
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
    const ipAllowed = await checkIpRateLimit(
      c.env.AUTH_RATE_LIMITER_IP,
      ip,
      c.env.ENVIRONMENT,
      logger,
    );
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
      logger,
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

    // Step 1-4 — Access JWT + Refresh Session 발급 (ADR-005 §Addendum)
    const jwtSecret = c.env.JWT_SECRET;
    const ipPepper = c.env.IP_PEPPER;
    if (jwtSecret === undefined || jwtSecret.length === 0) {
      logger.error('JWT_SECRET not configured — login cannot issue tokens');
      return c.json({ error: 'AUTH_NOT_CONFIGURED' }, 500);
    }

    try {
      // M-4 (D-7-1): IP_PEPPER silent degradation 방지
      let ipHashValue: string | null = null;
      if (ipPepper !== undefined && ipPepper.length > 0) {
        ipHashValue = await hashIp(ip, ipPepper);
      } else {
        logger.warn('IP_PEPPER not configured — session.ip_hash will be null', {
          userId: row.id,
        });
      }
      const refreshCtx = {
        userAgent: truncateUserAgent(c.req.header('User-Agent') ?? null),
        ipHash: ipHashValue,
      };
      const session = await createRefreshSession(c.env.DB, row.id, refreshCtx);
      const accessToken = await signAccessToken(row.id, session.sessionId, jwtSecret);

      setAuthCookies(c, accessToken, session.refreshToken, c.env.ENVIRONMENT);

      return c.json({
        user: { id: row.id, email: row.email },
      });
    } catch (err) {
      logger.error('session issuance failed', err, { userId: row.id });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }
  });

  router.post('/logout', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'logout' });
    // 쿠키에서 refresh 추출 → D1 revoke (best-effort). 쿠키 없어도 204.
    const refreshToken = getCookie(c, REFRESH_TOKEN_COOKIE);
    if (refreshToken !== undefined && refreshToken.length > 0) {
      try {
        const lookup = await lookupRefreshSession(c.env.DB, refreshToken);
        // 유효/만료/revoked/rotated_recently 모두 sessionId 존재하면 revoke (idempotent; one-way 트리거)
        // Phase A #1/C-M1: 무의미한 삼항 제거 — lookup.sessionId 가 두 분기 모두 같은 필드.
        const sessionId = lookup.sessionId;
        if (sessionId !== undefined) {
          await revokeSession(c.env.DB, sessionId);
        }
      } catch (err) {
        // 로그아웃은 사용자 의도 — D1 실패해도 204 + cookie clear. 관찰성만 기록.
        logger.warn('logout revoke failed (cookies still cleared)', {
          cause: err instanceof Error ? err.message : String(err),
        });
      }
    }
    clearAuthCookies(c, c.env.ENVIRONMENT);
    return c.body(null, 204);
  });

  router.post('/refresh', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'refresh' });
    const ip = getClientIp(c);

    const jwtSecret = c.env.JWT_SECRET;
    if (jwtSecret === undefined || jwtSecret.length === 0) {
      logger.error('JWT_SECRET not configured — refresh cannot issue tokens');
      return c.json({ error: 'AUTH_NOT_CONFIGURED' }, 500);
    }

    const ipAllowed = await checkIpRateLimit(
      c.env.AUTH_RATE_LIMITER_IP,
      ip,
      c.env.ENVIRONMENT,
      logger,
    );
    if (!ipAllowed) {
      c.header('Retry-After', '60');
      return c.json({ error: 'TOO_MANY_REQUESTS' }, 429);
    }

    const refreshToken = getCookie(c, REFRESH_TOKEN_COOKIE);
    if (refreshToken === undefined || refreshToken.length === 0) {
      return c.json({ error: 'UNAUTHORIZED', reason: 'missing_refresh' }, 401);
    }

    let lookup;
    try {
      lookup = await lookupRefreshSession(c.env.DB, refreshToken);
    } catch (err) {
      logger.error('refresh lookup failed', err);
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }

    if (!lookup.ok) {
      // Reuse detection: revoked 인데 grace 초과 재사용 → 탈취 의심 → 전체 세션 파기
      // 'rotated_recently' 는 grace 이내 재사용 (네트워크 재시도/Strict Mode) → 전체 파기 X (C-2).
      if (lookup.reason === 'revoked' && lookup.userId !== undefined) {
        logger.warn('refresh token reuse detected — revoking all user sessions', {
          userId: lookup.userId,
          sessionId: lookup.sessionId,
        });
        if (REFRESH_REUSE_REVOKE_ALL) {
          try {
            // M-6: withRetry 로 감싸 일시 장애 시 탈취 차단 실패 방지.
            await withRetry(() => revokeAllUserSessions(c.env.DB, lookup.userId!));
          } catch (err) {
            logger.error('revokeAllUserSessions failed after retries', err, {
              userId: lookup.userId,
            });
          }
        }
      } else {
        // not_found / expired / rotated_recently — 일반 401
        logger.info('refresh token rejected', { reason: lookup.reason });
      }
      clearAuthCookies(c, c.env.ENVIRONMENT);
      return c.json({ error: 'UNAUTHORIZED', reason: lookup.reason }, 401);
    }

    // C-1 (D-6-2): user status 재검증 — BAN 우회 방지.
    // /login 은 이미 status 체크하나 /refresh 는 최대 30일간 발급 가능 → 중간에 suspended/deleted
    // 로 전환된 사용자가 영구 refresh 로 access 갱신 가능한 구멍 있음.
    let userStatus: 'active' | 'suspended' | 'deleted' | null = null;
    try {
      const userRow = await c.env.DB.prepare(`SELECT status FROM users WHERE id = ? LIMIT 1`)
        .bind(lookup.userId)
        .first<{ status: 'active' | 'suspended' | 'deleted' }>();
      userStatus = userRow?.status ?? null;
    } catch (err) {
      logger.error('user status lookup failed during refresh', err, {
        userId: lookup.userId,
      });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }
    if (userStatus !== 'active') {
      logger.warn('refresh rejected — user not active', {
        userId: lookup.userId,
        status: userStatus,
      });
      // 해당 사용자 전체 세션 파기 (관리자가 suspended 처리한 경우 기존 세션도 정리)
      try {
        await withRetry(() => revokeAllUserSessions(c.env.DB, lookup.userId));
      } catch (err) {
        logger.error('revokeAllUserSessions on inactive user failed', err, {
          userId: lookup.userId,
        });
      }
      clearAuthCookies(c, c.env.ENVIRONMENT);
      return c.json({ error: 'UNAUTHORIZED', reason: 'user_not_active' }, 401);
    }

    // Rotation: 이전 session revoke + 새 session INSERT + 새 access+refresh 쿠키
    try {
      await revokeSession(c.env.DB, lookup.sessionId);
      const ipPepper = c.env.IP_PEPPER;
      // M-4 (D-7-1): IP_PEPPER 미설정 silent 방지 — production/staging 은 fail-closed 대상이나
      // 현 Step 범위에서는 warn 으로 기록 (fail-closed 전환은 Step 1-5 이월).
      let ipHashValue: string | null = null;
      if (ipPepper !== undefined && ipPepper.length > 0) {
        ipHashValue = await hashIp(ip, ipPepper);
      } else {
        logger.warn('IP_PEPPER not configured — session.ip_hash will be null', {
          userId: lookup.userId,
        });
      }
      const refreshCtx = {
        userAgent: truncateUserAgent(c.req.header('User-Agent') ?? null),
        ipHash: ipHashValue,
      };
      const newSession = await createRefreshSession(c.env.DB, lookup.userId, refreshCtx);
      const accessToken = await signAccessToken(lookup.userId, newSession.sessionId, jwtSecret);
      setAuthCookies(c, accessToken, newSession.refreshToken, c.env.ENVIRONMENT);

      return c.json({ ok: true });
    } catch (err) {
      logger.error('refresh rotation failed', err, { userId: lookup.userId });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }
  });

  return router;
}

// ---------------------------------------------------------------------------
// Cookie helpers (Step 1-4)
// ADR-005 §Addendum: HttpOnly + Secure + SameSite=Strict
// dev 환경은 Secure 완화 (wrangler dev 는 http://localhost:8787)
// ---------------------------------------------------------------------------

type AuthContext = Context<{ Bindings: AuthBindings }>;

function isSecureCookieEnv(environment: string | undefined): boolean {
  return environment === 'staging' || environment === 'production';
}

function setAuthCookies(
  c: AuthContext,
  accessToken: string,
  refreshToken: string,
  environment: string | undefined,
): void {
  const secure = isSecureCookieEnv(environment);
  setCookie(c, ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'Strict',
    path: ACCESS_TOKEN_COOKIE_PATH,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  setCookie(c, REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'Strict',
    path: REFRESH_TOKEN_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

function clearAuthCookies(c: AuthContext, environment: string | undefined): void {
  const secure = isSecureCookieEnv(environment);
  deleteCookie(c, ACCESS_TOKEN_COOKIE, {
    path: ACCESS_TOKEN_COOKIE_PATH,
    secure,
  });
  deleteCookie(c, REFRESH_TOKEN_COOKIE, {
    path: REFRESH_TOKEN_COOKIE_PATH,
    secure,
  });
}
