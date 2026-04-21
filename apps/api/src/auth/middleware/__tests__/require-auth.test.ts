/**
 * require-auth 미들웨어 테스트 (Phase 1 Step 1-4).
 *
 * 시나리오:
 *   - 유효 access token → 통과 + c.var.userId/sessionId 설정
 *   - 쿠키 없음 → 401 + WWW-Authenticate
 *   - 서명 위조 → 401 + reason='invalid'
 *   - 만료 → 401 + reason='expired'
 *   - JWT_SECRET 미설정 → 500 AUTH_NOT_CONFIGURED
 */

import { describe, expect, it, vi } from 'vitest';
import { Hono, type Context } from 'hono';
import type { Logger } from '@thepick/shared';
import { ACCESS_TOKEN_COOKIE, ACCESS_TOKEN_TTL_SECONDS } from '@thepick/shared';
import { requireAuth, type RequireAuthEnv } from '../require-auth.js';
import { signAccessToken } from '../../session.js';

const VALID_SECRET = 'test-jwt-secret-32bytes-plus-for-hs256-v1';

function mockLogger(): Logger & {
  readonly _warn: ReturnType<typeof vi.fn>;
  readonly _error: ReturnType<typeof vi.fn>;
  readonly _info: ReturnType<typeof vi.fn>;
} {
  const warn = vi.fn();
  const error = vi.fn();
  const info = vi.fn();
  const debug = vi.fn();
  const l = {
    warn,
    error,
    info,
    debug,
    child: () => l,
    _warn: warn,
    _error: error,
    _info: info,
  };
  return l as unknown as Logger & {
    readonly _warn: ReturnType<typeof vi.fn>;
    readonly _error: ReturnType<typeof vi.fn>;
    readonly _info: ReturnType<typeof vi.fn>;
  };
}

function buildApp(logger: Logger): Hono<RequireAuthEnv> {
  const app = new Hono<RequireAuthEnv>();
  app.use('/protected', requireAuth(logger));
  app.get('/protected', (c: Context<RequireAuthEnv>) => {
    return c.json({
      userId: c.var.userId,
      sessionId: c.var.sessionId,
    });
  });
  return app;
}

async function req(
  app: ReturnType<typeof buildApp>,
  cookie: string | null,
  env: { JWT_SECRET?: string; ENVIRONMENT?: string } = { JWT_SECRET: VALID_SECRET },
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (cookie !== null) headers.cookie = cookie;
  return app.request('/protected', { method: 'GET', headers }, env);
}

describe('requireAuth middleware', () => {
  it('passes with valid access token + populates c.var.userId/sessionId', async () => {
    const log = mockLogger();
    const app = buildApp(log);
    const token = await signAccessToken('user-1', 'session-1', VALID_SECRET);
    const res = await req(app, `${ACCESS_TOKEN_COOKIE}=${token}`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { userId: string; sessionId: string };
    expect(json.userId).toBe('user-1');
    expect(json.sessionId).toBe('session-1');
  });

  it('rejects with 401 when cookie missing', async () => {
    const log = mockLogger();
    const app = buildApp(log);
    const res = await req(app, null);
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe('Bearer');
    const json = await res.json();
    expect(json).toEqual({ error: 'UNAUTHORIZED' });
  });

  it('rejects with 401 reason=invalid when signature wrong', async () => {
    const log = mockLogger();
    const app = buildApp(log);
    const token = await signAccessToken('user-1', 'session-1', 'wrong-secret-32bytes-plus-xxxxxx');
    const res = await req(app, `${ACCESS_TOKEN_COOKIE}=${token}`);
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string; reason: string };
    expect(json.reason).toBe('invalid');
    expect(log._warn).toHaveBeenCalled();
  });

  it('rejects with 401 reason=expired when token past exp + leeway', async () => {
    const log = mockLogger();
    const app = buildApp(log);
    const past = Math.floor(Date.now() / 1000) - ACCESS_TOKEN_TTL_SECONDS - 3600;
    const token = await signAccessToken('user-1', 'session-1', VALID_SECRET, past);
    const res = await req(app, `${ACCESS_TOKEN_COOKIE}=${token}`);
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string; reason: string };
    expect(json.reason).toBe('expired');
    expect(log._info).toHaveBeenCalled();
  });

  it('rejects with 401 reason=malformed on garbage token', async () => {
    const log = mockLogger();
    const app = buildApp(log);
    const res = await req(app, `${ACCESS_TOKEN_COOKIE}=not-a-jwt`);
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string; reason: string };
    expect(['malformed', 'invalid']).toContain(json.reason);
  });

  it('returns 500 AUTH_NOT_CONFIGURED when JWT_SECRET undefined', async () => {
    const log = mockLogger();
    const app = buildApp(log);
    const token = await signAccessToken('user-1', 'session-1', VALID_SECRET);
    const res = await req(app, `${ACCESS_TOKEN_COOKIE}=${token}`, {
      JWT_SECRET: undefined,
    });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: 'AUTH_NOT_CONFIGURED' });
    expect(log._error).toHaveBeenCalled();
  });
});
