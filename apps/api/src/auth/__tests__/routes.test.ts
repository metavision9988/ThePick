/**
 * Auth routes integration 테스트 (Phase 1 Step 1-4 JWT 세션 발급/rotation/reuse).
 *
 * 시나리오:
 *   - /login 성공 → Set-Cookie 2종 (tp_access + tp_refresh), HttpOnly/Secure/SameSite=Strict
 *   - /logout → refresh 쿠키 읽어 D1 revoke + Clear-Cookie
 *   - /refresh 성공 → 이전 refresh revoke + 새 refresh+access 발급 (rotation)
 *   - /refresh reuse detection → revoked refresh 재사용 → 전체 사용자 세션 파기 + 401
 *   - /refresh 쿠키 없음 → 401
 *   - /refresh AUTH_NOT_CONFIGURED → 500
 */

import { describe, expect, it } from 'vitest';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_ROTATION_GRACE_SECONDS,
  REFRESH_TOKEN_COOKIE,
} from '@thepick/shared';
import { createAuthRoutes } from '../routes.js';
import { hashPassword } from '../password.js';
import type { RateLimiter } from '../rate-limit.js';

const VALID_JWT_SECRET = 'test-jwt-secret-32bytes-plus-for-hs256-v1';
const IP_PEPPER = 'test-ip-pepper-32bytes-plus-for-sha256-v1';
const TEST_PASSWORD = 'TestPassword123!@#';

const allowAll: RateLimiter = { limit: async () => ({ success: true }) };

// ---------------------------------------------------------------------------
// Fake D1 — users + sessions 테이블 최소 시뮬레이션
// ---------------------------------------------------------------------------

interface FakeUserRow {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  status: 'active' | 'suspended' | 'deleted';
}

interface FakeSessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  user_agent: string | null;
  ip_hash: string | null;
}

interface FakeDb {
  readonly db: D1Database;
  readonly users: Map<string, FakeUserRow>;
  readonly sessions: Map<string, FakeSessionRow>;
}

function buildFakeDb(): FakeDb {
  const users = new Map<string, FakeUserRow>();
  const sessions = new Map<string, FakeSessionRow>();

  const db = {
    prepare: (sql: string) => {
      let bound: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => {
          bound = args;
          return stmt;
        },
        run: async () => {
          if (/^INSERT INTO sessions/i.test(sql)) {
            const [id, user_id, refresh_token_hash, expires_at, user_agent, ip_hash] = bound as [
              string,
              string,
              string,
              string,
              string | null,
              string | null,
            ];
            for (const existing of sessions.values()) {
              if (existing.refresh_token_hash === refresh_token_hash) {
                throw new Error('UNIQUE constraint failed: sessions.refresh_token_hash');
              }
            }
            sessions.set(id, {
              id,
              user_id,
              refresh_token_hash,
              expires_at,
              revoked_at: null,
              user_agent,
              ip_hash,
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE sessions SET revoked_at = \? WHERE id = \?/i.test(sql)) {
            const [nowIso, id] = bound as [string, string];
            const row = sessions.get(id);
            if (row && row.revoked_at === null) {
              row.revoked_at = nowIso;
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 0 } };
          }
          if (/UPDATE sessions SET revoked_at = \? WHERE user_id = \?/i.test(sql)) {
            const [nowIso, userId] = bound as [string, string];
            let changes = 0;
            for (const row of sessions.values()) {
              if (row.user_id === userId && row.revoked_at === null) {
                row.revoked_at = nowIso;
                changes++;
              }
            }
            return { success: true, meta: { changes } };
          }
          if (/UPDATE users SET last_login_at/i.test(sql)) {
            return { success: true, meta: { changes: 1 } };
          }
          throw new Error(`fake db: unhandled run SQL: ${sql}`);
        },
        first: async <T>(): Promise<T | null> => {
          if (/FROM users WHERE email = \?/i.test(sql)) {
            const [email] = bound as [string];
            for (const u of users.values()) {
              if (u.email === email) return u as unknown as T;
            }
            return null;
          }
          // C-1 (D-6-2): /refresh 가 user status 재검증 — user_id 기준 SELECT 지원
          if (/SELECT status FROM users WHERE id = \?/i.test(sql)) {
            const [id] = bound as [string];
            const u = users.get(id);
            return u === undefined ? null : ({ status: u.status } as unknown as T);
          }
          if (/FROM sessions WHERE refresh_token_hash = \?/i.test(sql)) {
            const [hash] = bound as [string];
            for (const row of sessions.values()) {
              if (row.refresh_token_hash === hash) {
                return {
                  id: row.id,
                  user_id: row.user_id,
                  revoked_at: row.revoked_at,
                  expires_at: row.expires_at,
                } as unknown as T;
              }
            }
            return null;
          }
          throw new Error(`fake db: unhandled first SQL: ${sql}`);
        },
      };
      return stmt;
    },
  } as unknown as D1Database;

  return { db, users, sessions };
}

async function seedUser(fake: FakeDb, email: string, password: string): Promise<string> {
  const hashed = await hashPassword(password);
  const id = crypto.randomUUID();
  fake.users.set(id, {
    id,
    email,
    password_hash: hashed.hash,
    password_salt: hashed.salt,
    password_iterations: hashed.iterations,
    status: 'active',
  });
  return id;
}

interface EnvOverrides {
  readonly JWT_SECRET?: string;
  readonly IP_PEPPER?: string;
  readonly ENVIRONMENT?: string;
}

function buildEnv(fake: FakeDb, overrides: EnvOverrides = {}) {
  return {
    DB: fake.db,
    ENVIRONMENT: overrides.ENVIRONMENT ?? 'test',
    AUTH_RATE_LIMITER_IP: allowAll,
    AUTH_RATE_LIMITER_EMAIL: allowAll,
    JWT_SECRET: 'JWT_SECRET' in overrides ? overrides.JWT_SECRET : VALID_JWT_SECRET,
    IP_PEPPER: 'IP_PEPPER' in overrides ? overrides.IP_PEPPER : IP_PEPPER,
  };
}

function parseCookie(setCookieHeader: string, name: string): string | null {
  // Hono 는 Set-Cookie 를 다중 헤더 또는 쉼표 분리 문자열로 반환.
  // 여기서는 test 용으로 첫 매칭만 추출.
  const regex = new RegExp(`${name}=([^;,]+)`);
  const match = setCookieHeader.match(regex);
  return match ? match[1]! : null;
}

// ---------------------------------------------------------------------------
// /login — Set-Cookie 발급
// ---------------------------------------------------------------------------

describe('POST /api/auth/login → Set-Cookie (Step 1-4)', () => {
  it('success → 200 + Set-Cookie 2종 with HttpOnly/SameSite=Strict', async () => {
    const fake = buildFakeDb();
    await seedUser(fake, 'alice@example.com', TEST_PASSWORD);
    const app = createAuthRoutes();

    const res = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'alice@example.com', password: TEST_PASSWORD }),
      },
      buildEnv(fake),
    );
    expect(res.status).toBe(200);

    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain(ACCESS_TOKEN_COOKIE);
    expect(setCookie).toContain(REFRESH_TOKEN_COOKIE);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    // dev(test) 환경은 Secure 미적용 정책
    expect(setCookie).not.toMatch(/Secure/);

    // D1 sessions 테이블에 1건 INSERT 확인
    expect(fake.sessions.size).toBe(1);
  });

  it('production 환경은 Set-Cookie 에 Secure 플래그 주입', async () => {
    const fake = buildFakeDb();
    await seedUser(fake, 'bob@example.com', TEST_PASSWORD);
    const app = createAuthRoutes();

    const res = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'bob@example.com', password: TEST_PASSWORD }),
      },
      buildEnv(fake, { ENVIRONMENT: 'production' }),
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toMatch(/Secure/);
  });

  it('JWT_SECRET 미설정 시 500 AUTH_NOT_CONFIGURED', async () => {
    const fake = buildFakeDb();
    await seedUser(fake, 'charlie@example.com', TEST_PASSWORD);
    const app = createAuthRoutes();

    const res = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'charlie@example.com', password: TEST_PASSWORD }),
      },
      buildEnv(fake, { JWT_SECRET: undefined }),
    );
    expect(res.status).toBe(500);
    expect(fake.sessions.size).toBe(0); // session 미발급
  });
});

// ---------------------------------------------------------------------------
// /logout — Clear-Cookie + D1 revoke
// ---------------------------------------------------------------------------

describe('POST /api/auth/logout → Clear-Cookie (Step 1-4)', () => {
  it('active refresh → revoked + cookies cleared', async () => {
    const fake = buildFakeDb();
    await seedUser(fake, 'alice@example.com', TEST_PASSWORD);
    const app = createAuthRoutes();

    // 로그인 → 쿠키 획득
    const login = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'alice@example.com', password: TEST_PASSWORD }),
      },
      buildEnv(fake),
    );
    const loginCookies = login.headers.get('Set-Cookie') ?? '';
    const refreshToken = parseCookie(loginCookies, REFRESH_TOKEN_COOKIE)!;
    expect(refreshToken).not.toBeNull();

    // 로그아웃
    const res = await app.request(
      '/logout',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}` },
      },
      buildEnv(fake),
    );
    expect(res.status).toBe(204);

    const clearCookie = res.headers.get('Set-Cookie') ?? '';
    expect(clearCookie).toContain(ACCESS_TOKEN_COOKIE);
    expect(clearCookie).toContain(REFRESH_TOKEN_COOKIE);
    expect(clearCookie).toMatch(/Max-Age=0/);

    // D1 에서 세션 revoked_at 설정 확인
    const activeSessions = Array.from(fake.sessions.values()).filter((s) => s.revoked_at === null);
    expect(activeSessions.length).toBe(0);
  });

  it('cookie 없이 logout → 204 + cookies cleared (idempotent)', async () => {
    const fake = buildFakeDb();
    const app = createAuthRoutes();

    const res = await app.request('/logout', { method: 'POST' }, buildEnv(fake));
    expect(res.status).toBe(204);
    const clearCookie = res.headers.get('Set-Cookie') ?? '';
    expect(clearCookie).toContain(ACCESS_TOKEN_COOKIE);
    expect(clearCookie).toContain(REFRESH_TOKEN_COOKIE);
  });
});

// ---------------------------------------------------------------------------
// /refresh — rotation + reuse detection
// ---------------------------------------------------------------------------

describe('POST /api/auth/refresh (Step 1-4 rotation + reuse detection)', () => {
  async function loginAndGetRefresh(fake: FakeDb): Promise<string> {
    await seedUser(fake, 'alice@example.com', TEST_PASSWORD);
    const app = createAuthRoutes();
    const login = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'alice@example.com', password: TEST_PASSWORD }),
      },
      buildEnv(fake),
    );
    const loginCookies = login.headers.get('Set-Cookie') ?? '';
    return parseCookie(loginCookies, REFRESH_TOKEN_COOKIE)!;
  }

  it('valid refresh → 200 + 이전 세션 revoke + 새 access+refresh 발급', async () => {
    const fake = buildFakeDb();
    const refreshToken = await loginAndGetRefresh(fake);
    const app = createAuthRoutes();

    const sessionCountBefore = fake.sessions.size;
    expect(sessionCountBefore).toBe(1);

    const res = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}` },
      },
      buildEnv(fake),
    );
    expect(res.status).toBe(200);

    // 새 쿠키 발급
    const newCookies = res.headers.get('Set-Cookie') ?? '';
    const newAccess = parseCookie(newCookies, ACCESS_TOKEN_COOKIE);
    const newRefresh = parseCookie(newCookies, REFRESH_TOKEN_COOKIE);
    expect(newAccess).not.toBeNull();
    expect(newRefresh).not.toBeNull();
    expect(newRefresh).not.toBe(refreshToken); // rotation

    // sessions 테이블: 이전 revoked + 새 active
    expect(fake.sessions.size).toBe(2);
    const active = Array.from(fake.sessions.values()).filter((s) => s.revoked_at === null);
    const revoked = Array.from(fake.sessions.values()).filter((s) => s.revoked_at !== null);
    expect(active.length).toBe(1);
    expect(revoked.length).toBe(1);
  });

  it('cookie 없음 → 401 missing_refresh', async () => {
    const fake = buildFakeDb();
    const app = createAuthRoutes();
    const res = await app.request('/refresh', { method: 'POST' }, buildEnv(fake));
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string; reason: string };
    expect(json.reason).toBe('missing_refresh');
  });

  it('unknown refresh → 401 not_found + Clear-Cookie', async () => {
    const fake = buildFakeDb();
    const app = createAuthRoutes();
    const res = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=totally-fake-token` },
      },
      buildEnv(fake),
    );
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string; reason: string };
    expect(json.reason).toBe('not_found');
  });

  it('reuse detection: grace 초과 후 revoked refresh 재사용 → 전체 사용자 세션 파기 + 401 revoked', async () => {
    const fake = buildFakeDb();
    const refreshToken = await loginAndGetRefresh(fake);
    const userId = Array.from(fake.users.values())[0]!.id;
    const app = createAuthRoutes();

    // 추가 세션 2개 생성 (정상 사용자가 여러 기기에서 로그인 중인 상황)
    await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'alice@example.com', password: TEST_PASSWORD }),
      },
      buildEnv(fake),
    );
    await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'alice@example.com', password: TEST_PASSWORD }),
      },
      buildEnv(fake),
    );

    // 첫 refresh 성공 → 이전 session revoked
    await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}` },
      },
      buildEnv(fake),
    );

    const activeBefore = Array.from(fake.sessions.values()).filter(
      (s) => s.user_id === userId && s.revoked_at === null,
    );
    expect(activeBefore.length).toBeGreaterThanOrEqual(2);

    // C-2 grace window: revoked 직후 재사용은 'rotated_recently' 로 분류되므로
    // reuse detection 을 트리거하려면 grace 초과 상태를 강제로 만든다.
    // 직접 revoked_at 을 과거로 조작하여 "오래된 revoked 재사용" 시나리오 시뮬레이션.
    const pastIso = new Date(
      Date.now() - (REFRESH_ROTATION_GRACE_SECONDS + 10) * 1000,
    ).toISOString();
    for (const session of fake.sessions.values()) {
      if (session.revoked_at !== null) {
        session.revoked_at = pastIso;
      }
    }

    // REUSE: grace 초과한 revoked token 재사용 = 탈취 시나리오
    const reuseRes = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}` },
      },
      buildEnv(fake),
    );
    expect(reuseRes.status).toBe(401);
    const reuseJson = (await reuseRes.json()) as { error: string; reason: string };
    expect(reuseJson.reason).toBe('revoked');

    // 사용자 전체 세션 파기 확인 (revoked_at 이 한번 set 된 세션은 revokeAll 의 no-op 대상이지만,
    // 이미 활성이었던 세션들은 이번 revokeAllUserSessions 로 revoked 된다)
    const activeAfter = Array.from(fake.sessions.values()).filter(
      (s) => s.user_id === userId && s.revoked_at === null,
    );
    expect(activeAfter.length).toBe(0);
  });

  it('rotated_recently: grace 이내 동일 refresh 재사용 → 401 reason=rotated_recently + 전체 세션 유지 (C-2)', async () => {
    const fake = buildFakeDb();
    const refreshToken = await loginAndGetRefresh(fake);
    const userId = Array.from(fake.users.values())[0]!.id;
    const app = createAuthRoutes();

    // 추가 세션 1개 (정상 다른 기기)
    await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'alice@example.com', password: TEST_PASSWORD }),
      },
      buildEnv(fake),
    );

    // 첫 refresh 성공
    await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}` },
      },
      buildEnv(fake),
    );

    // 즉시 동일 refresh 재사용 — 네트워크 재시도 시나리오 (grace 이내)
    const retryRes = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}` },
      },
      buildEnv(fake),
    );
    expect(retryRes.status).toBe(401);
    const retryJson = (await retryRes.json()) as { error: string; reason: string };
    expect(retryJson.reason).toBe('rotated_recently');

    // 중요: 전체 세션 파기되지 않음 — 첫 rotation 결과 + 다른 기기 세션 모두 유지
    const activeAfter = Array.from(fake.sessions.values()).filter(
      (s) => s.user_id === userId && s.revoked_at === null,
    );
    expect(activeAfter.length).toBeGreaterThanOrEqual(2);
  });

  it('BAN 우회 방지 (C-1 / D-6-2): user.status=suspended 시 /refresh 401 user_not_active + 전체 세션 파기', async () => {
    const fake = buildFakeDb();
    const refreshToken = await loginAndGetRefresh(fake);
    const userId = Array.from(fake.users.values())[0]!.id;
    const app = createAuthRoutes();

    // 관리자가 사용자 정지
    fake.users.get(userId)!.status = 'suspended';

    const res = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}` },
      },
      buildEnv(fake),
    );
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string; reason: string };
    expect(json.reason).toBe('user_not_active');

    // 전체 세션 파기 확인 (BAN 된 사용자의 모든 기기 자동 로그아웃)
    const activeAfter = Array.from(fake.sessions.values()).filter(
      (s) => s.user_id === userId && s.revoked_at === null,
    );
    expect(activeAfter.length).toBe(0);
  });

  it('JWT_SECRET 미설정 → 500', async () => {
    const fake = buildFakeDb();
    const app = createAuthRoutes();
    const res = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=anything` },
      },
      buildEnv(fake, { JWT_SECRET: undefined }),
    );
    expect(res.status).toBe(500);
  });
});
