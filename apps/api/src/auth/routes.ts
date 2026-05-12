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
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  getPasswordMinLength,
  isHibpEnabled,
} from './constants.js';
import { performDummyVerify } from './dummy-verify.js';
import { checkPwned } from './hibp.js';
import { hashPassword, verifyPasswordWithUpgrade } from './password.js';
import {
  checkEmailRateLimit,
  checkIpRateLimit,
  checkRegisterEmailRateLimit,
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
  /** C-03 env 분기 — Phase 3 launch 직전 '8' toggle. 미설정 시 RELAXED(4). */
  readonly PASSWORD_MIN_LENGTH?: string;
  /** C-03 env 분기 — Phase 3 launch 직전 'true' toggle. 미설정 시 disabled. */
  readonly HIBP_ENABLED?: string;
  /** C-03 env 분기 — ADR-036 §"복원 의무" Phase 3 launch 직전 'Strict' toggle. */
  readonly AUTH_COOKIE_SAMESITE?: 'Strict' | 'Lax' | 'None';
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

// Zod 스키마는 정책 floor(`PASSWORD_MIN_LENGTH` = RELAXED)만 검증. 환경별 정책 추가 enforcement는
// `enforcePasswordPolicy()` 로 분리 (C-03 env 분기 — Phase 3 launch 직전 '8' toggle 자동화).
const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  name: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

/**
 * 환경 기반 password 정책 enforcement (C-03 env 분기).
 *
 * Zod 스키마 통과 후 env.PASSWORD_MIN_LENGTH 정책을 추가 검증.
 * 미충족 시 Zod와 동일 형식의 422 `VALIDATION_ERROR` 응답을 위한 issue 반환.
 *
 * @returns `null` (통과) 또는 issue 객체 (정책 위반)
 */
function enforcePasswordPolicy(
  password: string,
  env: AuthBindings,
): { code: 'too_small'; minimum: number; message: string } | null {
  const minimum = getPasswordMinLength(env.PASSWORD_MIN_LENGTH);
  if (password.length >= minimum) {
    return null;
  }
  return {
    code: 'too_small',
    minimum,
    message: `Password must contain at least ${minimum} character(s)`,
  };
}

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

    // C-04 (Phase 3 launch chain, Stage B) — register endpoint per-email rate-limit.
    // 다중 IP 풀 brute-force 차단 (login과 별도 key prefix `register:` 사용 — 4-Pass MAJOR-A1 흡수).
    // 정책: 5 attempts/600s (login 정책 동일 binding 공유, counter 독립). legitimate 가입 1회로 충분.
    const registerEmailAllowed = await checkRegisterEmailRateLimit(
      c.env.AUTH_RATE_LIMITER_EMAIL,
      normalizedEmail,
      c.env.ENVIRONMENT,
      logger,
    );
    if (!registerEmailAllowed) {
      c.header('Retry-After', '600');
      return c.json({ error: 'TOO_MANY_REQUESTS' }, 429);
    }

    // C-03 env 분기 — Zod floor 통과 후 환경별 정책 추가 검증.
    const policyIssue = enforcePasswordPolicy(password, c.env);
    if (policyIssue !== null) {
      return c.json(
        { error: 'VALIDATION_ERROR', issues: [{ path: ['password'], ...policyIssue }] },
        422,
      );
    }

    // Stage E P-α C-α-1 흡수 — HIBP timing oracle 차단.
    // checkPwned는 항상 호출 (audit logging 보존), hashPassword도 항상 실행 (timing 평탄화).
    // env=true/false 응답 시간 차이로 HIBP_ENABLED 상태 enumerate 차단 (Phase 3 toggle 시각 보호).
    // 흐름: checkPwned 호출 → hashPassword 실행 → HIBP 분기 (env=true + 'pwned' → reject) → INSERT
    const pwned = await checkPwned(password, logger);

    let hashed;
    try {
      hashed = await hashPassword(password);
    } catch (err) {
      logger.error('hashPassword failed', err, { email: normalizedEmail });
      return c.json({ error: 'HASH_ERROR' }, 500);
    }

    // C-03 env 분기 — HIBP 'pwned' 응답 처리 (ADR-034 §"복원 의무" 자동화).
    //   - env.HIBP_ENABLED 미설정/'false' → 호출 + logging 보존, register 통과 (Phase 2 default)
    //   - env.HIBP_ENABLED = 'true' → 'pwned' 응답 시 422 reject (Phase 3 toggle)
    // ★ hashPassword 후 분기 — env 상태 timing leak 차단 (P-α C-α-1).
    if (isHibpEnabled(c.env.HIBP_ENABLED) && pwned.status === 'pwned') {
      return c.json(
        { error: 'PASSWORD_PWNED', message: AUTH_MESSAGES.REGISTER_PASSWORD_PWNED },
        422,
      );
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

    const verifyResult = await verifyPasswordWithUpgrade(password, {
      hash: row.password_hash,
      salt: row.password_salt,
      iterations: row.password_iterations,
    });
    if (!verifyResult.valid) {
      return c.json(genericFailure, 401);
    }

    const now = new Date().toISOString();

    // Stage E P-α C-α-3 — PBKDF2 iterations upgrade chain.
    // verify 성공 + needsRehash=true (stored < PBKDF2_ITERATIONS target) → 재해시 + UPDATE.
    // 기존 100k user가 미래 toggle (예: 600k) 후 login 시점에 자동 upgrade.
    if (verifyResult.needsRehash) {
      try {
        const rehashed = await hashPassword(password);
        await withRetry(() =>
          c.env.DB.prepare(
            `UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ? WHERE id = ?`,
          )
            .bind(rehashed.hash, rehashed.salt, rehashed.iterations, now, row.id)
            .run(),
        );
        logger.info('password rehashed to current iterations target', {
          userId: row.id,
          oldIterations: row.password_iterations,
          newIterations: rehashed.iterations,
        });
      } catch (err) {
        // 재해시 실패는 login 자체 보존 — 다음 login 시 재시도
        logger.warn('password rehash failed (login proceeds with old hash)', {
          userId: row.id,
          cause: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // C-12 (Phase 3 launch chain, Stage C) — login_history audit trail.
    // 기존 UPDATE users SET last_login_at은 audit 단절 (덮어쓰기). migration 0030 login_history
    // 테이블에 INSERT 누적 — incident forensics + GDPR/PIPA 정합.
    // IP_PEPPER 미설정 시 ipHash NULL 허용 (PII 최소수집), user_agent는 truncate.
    const ipPepperForHistory = c.env.IP_PEPPER;
    let ipHashForHistory: string | null = null;
    if (ipPepperForHistory !== undefined && ipPepperForHistory.length > 0) {
      try {
        ipHashForHistory = await hashIp(ip, ipPepperForHistory);
      } catch (err) {
        // ipHash 실패는 audit trail 누락만 — login 성공 보존
        logger.warn('login_history ip hash failed', {
          userId: row.id,
          cause: err instanceof Error ? err.message : String(err),
        });
      }
    }
    const userAgentForHistory = truncateUserAgent(c.req.header('user-agent'));

    try {
      await withRetry(() =>
        c.env.DB.prepare(
          `INSERT INTO login_history (id, user_id, login_at, ip_hash, user_agent, event_type) VALUES (?, ?, ?, ?, ?, ?)`,
        )
          .bind(crypto.randomUUID(), row.id, now, ipHashForHistory, userAgentForHistory, 'login')
          .run(),
      );
    } catch (err) {
      // Stage D CRIT-P5-1 흡수 — schema drift (login_history 테이블 부재) 자동 감지.
      // 코드 deploy 후 migration 0030 미적용 시 'no such table: login_history' throw.
      // graceful catch (login 자체는 성공) + schema drift는 CRITICAL 로깅으로 격리.
      const errMsg = err instanceof Error ? err.message : String(err);
      const isSchemaDrift = /no such table.*login_history/i.test(errMsg);
      if (isSchemaDrift) {
        logger.error('login_history schema drift — migration 0030 not applied', err, {
          userId: row.id,
          severity: 'critical',
          remediation:
            'Run: wrangler d1 migrations apply thepick-db-production --remote (migrations/0030_login_history.sql + 0031_login_history_event_type.sql)',
        });
      } else {
        // transient D1 error (timeout / lock 등) — 관찰성 손실만
        logger.warn('login_history insert failed (transient)', {
          userId: row.id,
          cause: errMsg,
        });
      }
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

      // Stage E P-α C-α-2 흡수 — refresh rotation audit trail.
      // 기존 코드는 refresh 시 login_history 미기록 → stolen refresh token으로 30일 silent
      // rotation 가능. event_type='refresh' INSERT로 forensic 추적 가능.
      // graceful (refresh 자체 성공 보존, drift 시 critical 로깅).
      const refreshNow = new Date().toISOString();
      try {
        await withRetry(() =>
          c.env.DB.prepare(
            `INSERT INTO login_history (id, user_id, login_at, ip_hash, user_agent, event_type) VALUES (?, ?, ?, ?, ?, ?)`,
          )
            .bind(
              crypto.randomUUID(),
              lookup.userId,
              refreshNow,
              ipHashValue,
              refreshCtx.userAgent,
              'refresh',
            )
            .run(),
        );
      } catch (auditErr) {
        const errMsg = auditErr instanceof Error ? auditErr.message : String(auditErr);
        const isSchemaDrift = /no such (table|column)/i.test(errMsg);
        if (isSchemaDrift) {
          logger.error(
            'login_history schema drift on refresh — migration 0030/0031 not applied',
            auditErr,
            {
              userId: lookup.userId,
              severity: 'critical',
              remediation:
                'Run: wrangler d1 migrations apply thepick-db-production --remote (migrations/0030 + 0031)',
            },
          );
        } else {
          logger.warn('login_history refresh audit failed (transient)', {
            userId: lookup.userId,
            cause: errMsg,
          });
        }
      }

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
// ADR-005 §Addendum: HttpOnly + Secure + SameSite (환경별 분기, ADR-036)
// dev 환경: Secure 완화 (wrangler dev http://localhost:8787) + SameSite=Lax (same-origin)
// staging/production: cross-origin (apps/web *.pages.dev ↔ apps/api *.workers.dev)
//   → SameSite=None + Secure (Phase 3 launch 시 custom domain same-site 강화 carry-over, ADR-036)
// ---------------------------------------------------------------------------

type AuthContext = Context<{ Bindings: AuthBindings }>;

function isSecureCookieEnv(environment: string | undefined): boolean {
  return environment === 'staging' || environment === 'production';
}

/**
 * SameSite 환경별 분기 (ADR-036 + C-03 env override).
 *
 * 우선순위:
 *   1. `env.AUTH_COOKIE_SAMESITE` (Strict|Lax|None) — Phase 3 launch 직전 toggle
 *   2. 환경 기본값:
 *      - production/staging: 'None' (cross-origin pages.dev ↔ workers.dev). Secure 강제.
 *      - dev/test: 'Lax' (same-origin localhost, CSRF 방어 + GET top-level OK)
 *
 * Phase 3 launch 직전 custom domain 통합 시 `AUTH_COOKIE_SAMESITE='Strict'` env 주입으로 복원 (ADR-036 §"복원 의무").
 */
function authCookieSameSite(
  environment: string | undefined,
  override?: 'Strict' | 'Lax' | 'None',
): 'Strict' | 'Lax' | 'None' {
  if (override === 'Strict' || override === 'Lax' || override === 'None') {
    return override;
  }
  return isSecureCookieEnv(environment) ? 'None' : 'Lax';
}

function setAuthCookies(
  c: AuthContext,
  accessToken: string,
  refreshToken: string,
  environment: string | undefined,
): void {
  const secure = isSecureCookieEnv(environment);
  const sameSite = authCookieSameSite(environment, c.env.AUTH_COOKIE_SAMESITE);
  setCookie(c, ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: ACCESS_TOKEN_COOKIE_PATH,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  setCookie(c, REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: REFRESH_TOKEN_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

function clearAuthCookies(c: AuthContext, environment: string | undefined): void {
  const secure = isSecureCookieEnv(environment);
  const sameSite = authCookieSameSite(environment, c.env.AUTH_COOKIE_SAMESITE);
  deleteCookie(c, ACCESS_TOKEN_COOKIE, {
    path: ACCESS_TOKEN_COOKIE_PATH,
    secure,
    sameSite,
  });
  deleteCookie(c, REFRESH_TOKEN_COOKIE, {
    path: REFRESH_TOKEN_COOKIE_PATH,
    secure,
    sameSite,
  });
}
