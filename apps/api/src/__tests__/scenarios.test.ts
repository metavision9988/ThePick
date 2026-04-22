/**
 * 쪽집게 Phase 1 전반전 — 실제 사용자 시나리오 검증 (진산님 직접 확인용).
 *
 * 목적: "AI 가 짠 단위 테스트"가 아니라 "실제 사용자가 이 앱을 쓸 때 어떻게 되는가"를
 * 일상어 시나리오로 검증. 실행 결과를 진산님이 눈으로 보고 판단 가능.
 *
 * 실행 방법:
 *   pnpm --filter @thepick/api test -- scenarios
 *
 * 시나리오 목록:
 *   🌟 정상 이용자:     S1 ~ S4 (4개)
 *   🛡️ 보안 방어:       S5 ~ S10 (6개)
 *   💳 결제 알림:        S11 ~ S14 (4개)
 *   ⏰ 경계 시나리오:    S15 ~ S16 (2개)
 *
 * 총 16개 시나리오. 각 시나리오는 독립적으로 실행 가능.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_ROTATION_GRACE_SECONDS,
  REFRESH_TOKEN_COOKIE,
} from '@thepick/shared';
import { createAuthRoutes } from '../auth/routes.js';
import { createWebhookRoutes } from '../webhooks/payment.js';
import type { RateLimiter } from '../auth/rate-limit.js';

// ---------------------------------------------------------------------------
// 공통 헬퍼 (모든 시나리오 공용)
// ---------------------------------------------------------------------------

const VALID_JWT_SECRET = 'scenarios-jwt-secret-32bytes-plus-v1';
const IP_PEPPER = 'scenarios-ip-pepper-32bytes-plus-v1';
const WEBHOOK_SECRET = 'scenarios-webhook-secret-32bytes-plus-v1';
const STRONG_PASSWORD = 'JinSan-Strong-Pw-2026-!@#$';

const allowAll: RateLimiter = { limit: async () => ({ success: true }) };
const denyAll: RateLimiter = { limit: async () => ({ success: false }) };

interface FakeUser {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  status: 'active' | 'suspended' | 'deleted';
}

interface FakeSession {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  user_agent: string | null;
  ip_hash: string | null;
}

interface FakeWebhook {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  payload: string;
}

interface FakeDb {
  readonly db: D1Database;
  readonly users: Map<string, FakeUser>;
  readonly sessions: Map<string, FakeSession>;
  readonly webhooks: Map<string, FakeWebhook>;
}

function buildFakeDb(): FakeDb {
  const users = new Map<string, FakeUser>();
  const sessions = new Map<string, FakeSession>();
  const webhooks = new Map<string, FakeWebhook>();

  const db = {
    prepare: (sql: string) => {
      let bound: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => {
          bound = args;
          return stmt;
        },
        run: async () => {
          // users INSERT (register)
          if (/^INSERT INTO users/i.test(sql)) {
            const [id, email, name, password_hash, password_salt, password_iterations, status] =
              bound as [string, string, string | null, string, string, number, FakeUser['status']];
            for (const u of users.values()) {
              if (u.email === email) {
                throw new Error('UNIQUE constraint failed: users.email');
              }
            }
            users.set(id, {
              id,
              email,
              name,
              password_hash,
              password_salt,
              password_iterations,
              status,
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE users SET last_login_at/i.test(sql)) {
            return { success: true, meta: { changes: 1 } };
          }
          // sessions INSERT
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
          // webhooks INSERT (Step 1-2)
          if (/^INSERT INTO webhook_events/i.test(sql)) {
            const [id, provider, event_id, event_type, payload] = bound as [
              string,
              string,
              string,
              string,
              string,
            ];
            const key = `${provider}::${event_id}`;
            if (webhooks.has(key)) {
              throw new Error(
                'UNIQUE constraint failed: webhook_events.provider, webhook_events.event_id',
              );
            }
            webhooks.set(key, { id, provider, event_id, event_type, payload });
            return { success: true, meta: { changes: 1 } };
          }
          throw new Error(`fake db run: unhandled SQL: ${sql}`);
        },
        first: async <T>(): Promise<T | null> => {
          if (/FROM users WHERE email = \?/i.test(sql)) {
            const [email] = bound as [string];
            for (const u of users.values()) {
              if (u.email === email) return u as unknown as T;
            }
            return null;
          }
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
          throw new Error(`fake db first: unhandled SQL: ${sql}`);
        },
      };
      return stmt;
    },
  } as unknown as D1Database;

  return { db, users, sessions, webhooks };
}

interface EnvOverrides {
  JWT_SECRET?: string;
  IP_PEPPER?: string;
  ENVIRONMENT?: string;
  AUTH_RATE_LIMITER_IP?: RateLimiter;
  AUTH_RATE_LIMITER_EMAIL?: RateLimiter;
  WEBHOOK_RATE_LIMITER_IP?: RateLimiter;
  WEBHOOK_HMAC_SECRET_MOCK?: string;
}

function buildAuthEnv(fake: FakeDb, overrides: EnvOverrides = {}) {
  return {
    DB: fake.db,
    ENVIRONMENT: overrides.ENVIRONMENT ?? 'test',
    AUTH_RATE_LIMITER_IP: overrides.AUTH_RATE_LIMITER_IP ?? allowAll,
    AUTH_RATE_LIMITER_EMAIL: overrides.AUTH_RATE_LIMITER_EMAIL ?? allowAll,
    JWT_SECRET: 'JWT_SECRET' in overrides ? overrides.JWT_SECRET : VALID_JWT_SECRET,
    IP_PEPPER: 'IP_PEPPER' in overrides ? overrides.IP_PEPPER : IP_PEPPER,
  };
}

function buildWebhookEnv(fake: FakeDb, overrides: EnvOverrides = {}) {
  return {
    DB: fake.db,
    ENVIRONMENT: overrides.ENVIRONMENT ?? 'test',
    WEBHOOK_RATE_LIMITER_IP: overrides.WEBHOOK_RATE_LIMITER_IP ?? allowAll,
    WEBHOOK_HMAC_SECRET_MOCK:
      'WEBHOOK_HMAC_SECRET_MOCK' in overrides ? overrides.WEBHOOK_HMAC_SECRET_MOCK : WEBHOOK_SECRET,
  };
}

function parseCookie(setCookieHeader: string, name: string): string | null {
  const regex = new RegExp(`${name}=([^;,\\s]+)`);
  const match = setCookieHeader.match(regex);
  return match ? match[1]! : null;
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const bytes = new Uint8Array(sig);
  let hex = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

/** HIBP API 모의 — "safe" 응답 고정 (유출 이력 없음) */
function mockHibpSafe() {
  globalThis.fetch = vi
    .fn()
    .mockResolvedValue(new Response('FFFFF99999999999999999999999999999FFFF:1\n', { status: 200 }));
}

/** HIBP API 모의 — "pwned" 응답 (유출 DB 에 있음) */
function mockHibpPwned() {
  // SHA-1('password') = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
  // prefix 5BAA6, suffix 1E4C9B93F3F0682250B6CF8331B7EE68FD8
  globalThis.fetch = vi
    .fn()
    .mockResolvedValue(
      new Response('1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\n', { status: 200 }),
    );
}

// ---------------------------------------------------------------------------
// 🌟 정상 이용자 플로우 (S1 ~ S4)
// ---------------------------------------------------------------------------

describe('🌟 정상 이용자 플로우', () => {
  beforeEach(() => mockHibpSafe());
  afterEach(() => vi.restoreAllMocks());

  it('S1. 신규 가입자가 이메일로 가입하고 자동 로그인된다', async () => {
    const fake = buildFakeDb();
    const app = createAuthRoutes();
    const email = 'jinsan@example.com';

    // 가입 요청
    const register = await app.request(
      '/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD, name: '진산' }),
      },
      buildAuthEnv(fake),
    );
    expect(register.status, '가입 요청은 201 Created 를 반환해야 함').toBe(201);

    // DB 에 사용자 실제로 저장됐는지
    expect(fake.users.size, '사용자 1명이 DB에 저장되어야 함').toBe(1);

    // 로그인 → 쿠키 발급 확인
    const login = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    expect(login.status, '로그인은 200 OK').toBe(200);

    const cookieHeader = login.headers.get('Set-Cookie') ?? '';
    expect(cookieHeader, '로그인 시 access 쿠키 발급').toContain(ACCESS_TOKEN_COOKIE);
    expect(cookieHeader, '로그인 시 refresh 쿠키 발급').toContain(REFRESH_TOKEN_COOKIE);
    expect(cookieHeader, 'HttpOnly 보안 속성').toMatch(/HttpOnly/i);
    expect(cookieHeader, 'SameSite=Strict 보안 속성').toMatch(/SameSite=Strict/i);

    // 세션 1개 활성
    expect(fake.sessions.size, '세션 DB 에 1건 생성').toBe(1);
  });

  it('S2. 가입 후 로그아웃하고 재로그인할 수 있다', async () => {
    const fake = buildFakeDb();
    const app = createAuthRoutes();
    const email = 'jinsan@example.com';

    await app.request(
      '/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );

    // 첫 로그인
    const login1 = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    const refresh1 = parseCookie(login1.headers.get('Set-Cookie') ?? '', REFRESH_TOKEN_COOKIE)!;

    // 로그아웃
    const logout = await app.request(
      '/logout',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${refresh1}` },
      },
      buildAuthEnv(fake),
    );
    expect(logout.status, '로그아웃은 204 No Content').toBe(204);
    expect(logout.headers.get('Set-Cookie') ?? '', '로그아웃 시 쿠키 삭제 (Max-Age=0)').toMatch(
      /Max-Age=0/,
    );

    // 재로그인
    const login2 = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    expect(login2.status, '재로그인 성공').toBe(200);
    const refresh2 = parseCookie(login2.headers.get('Set-Cookie') ?? '', REFRESH_TOKEN_COOKIE)!;
    expect(refresh2, '새 refresh 토큰이 이전과 달라야 함').not.toBe(refresh1);
  });

  it('S3. 로그인 후 15분 경과 시점에 세션이 자동 갱신된다', async () => {
    const fake = buildFakeDb();
    const app = createAuthRoutes();
    const email = 'jinsan@example.com';

    await app.request(
      '/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    const login = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    const oldRefresh = parseCookie(login.headers.get('Set-Cookie') ?? '', REFRESH_TOKEN_COOKIE)!;
    const oldAccess = parseCookie(login.headers.get('Set-Cookie') ?? '', ACCESS_TOKEN_COOKIE)!;

    // 15분 경과 → /refresh 호출 (클라이언트가 자동으로 하는 동작)
    const refresh = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${oldRefresh}` },
      },
      buildAuthEnv(fake),
    );
    expect(refresh.status, '세션 갱신 요청은 200 OK').toBe(200);

    const newSetCookie = refresh.headers.get('Set-Cookie') ?? '';
    const newAccess = parseCookie(newSetCookie, ACCESS_TOKEN_COOKIE);
    const newRefresh = parseCookie(newSetCookie, REFRESH_TOKEN_COOKIE);
    expect(newAccess, '새 access 토큰 발급').not.toBeNull();
    expect(newRefresh, '새 refresh 토큰 발급').not.toBeNull();
    expect(newAccess, '새 access 가 이전과 달라야 함').not.toBe(oldAccess);
    expect(newRefresh, '새 refresh 가 이전과 달라야 함').not.toBe(oldRefresh);
  });

  it('S4. PC와 모바일에서 동시 로그인해도 두 세션 모두 정상 유지된다', async () => {
    const fake = buildFakeDb();
    const app = createAuthRoutes();
    const email = 'jinsan@example.com';

    await app.request(
      '/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );

    // PC 로그인
    const pc = await app.request(
      '/login',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; PC)',
        },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    // 모바일 로그인
    const mobile = await app.request(
      '/login',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (iPhone; Mobile)',
        },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    expect(pc.status).toBe(200);
    expect(mobile.status).toBe(200);
    expect(fake.sessions.size, '활성 세션 2개').toBe(2);

    // PC 로그아웃
    const pcRefresh = parseCookie(pc.headers.get('Set-Cookie') ?? '', REFRESH_TOKEN_COOKIE)!;
    await app.request(
      '/logout',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${pcRefresh}` },
      },
      buildAuthEnv(fake),
    );

    // 모바일 세션은 여전히 활성
    const activeAfter = Array.from(fake.sessions.values()).filter((s) => s.revoked_at === null);
    expect(activeAfter.length, 'PC 로그아웃 후 모바일 세션은 유지').toBe(1);
    expect(activeAfter[0]!.user_agent, '남은 세션은 모바일').toContain('iPhone');
  });
});

// ---------------------------------------------------------------------------
// 🛡️ 보안 방어 시나리오 (S5 ~ S10)
// ---------------------------------------------------------------------------

describe('🛡️ 보안 방어 시나리오', () => {
  afterEach(() => vi.restoreAllMocks());

  it('S5. 유출된 비밀번호 "password" 로 가입 시도 → 거부된다', async () => {
    mockHibpPwned(); // HIBP 가 이 비밀번호를 "유출" 로 응답
    const fake = buildFakeDb();
    const app = createAuthRoutes();

    const register = await app.request(
      '/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'jinsan@example.com',
          password: 'password',
        }),
      },
      buildAuthEnv(fake),
    );
    expect(register.status, '유출 비밀번호 422 Unprocessable').toBe(422);
    const body = await register.json();
    expect(body).toMatchObject({ error: 'PASSWORD_PWNED' });
    expect(fake.users.size, '거부되었으므로 DB 에 저장 안 됨').toBe(0);
  });

  it('S6. 같은 IP 에서 로그인 무차별 대입 → rate-limit 으로 429 차단', async () => {
    mockHibpSafe();
    const fake = buildFakeDb();
    const app = createAuthRoutes();

    // IP rate-limiter 가 차단하도록 설정
    const login = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'any@example.com',
          password: STRONG_PASSWORD,
        }),
      },
      buildAuthEnv(fake, { AUTH_RATE_LIMITER_IP: denyAll }),
    );
    expect(login.status, '429 Too Many Requests').toBe(429);
    const body = await login.json();
    expect(body).toMatchObject({ error: 'TOO_MANY_REQUESTS' });
    expect(login.headers.get('Retry-After'), 'Retry-After 헤더로 재시도 시간 안내').toBeTruthy();
  });

  it('S7. 이메일 열거 방어 — 존재하지 않는 계정과 틀린 비밀번호가 완전히 동일한 응답', async () => {
    mockHibpSafe();
    const fake = buildFakeDb();
    const app = createAuthRoutes();
    const existingEmail = 'real@example.com';

    await app.request(
      '/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: existingEmail, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );

    // 경로 1: 존재 안 하는 이메일
    const ghost = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'ghost@example.com',
          password: STRONG_PASSWORD,
        }),
      },
      buildAuthEnv(fake),
    );
    // 경로 2: 존재하는 이메일 + 틀린 비밀번호
    const wrongPw = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: existingEmail,
          password: 'TotallyWrongPassword!@#',
        }),
      },
      buildAuthEnv(fake),
    );

    expect(ghost.status, '존재하지 않는 계정 → 401').toBe(401);
    expect(wrongPw.status, '틀린 비밀번호 → 401').toBe(401);

    const ghostBody = await ghost.json();
    const wrongPwBody = await wrongPw.json();
    expect(ghostBody, '두 경로 응답 본문이 정확히 동일').toEqual(wrongPwBody);
  });

  it('S8. 탈취된 refresh 토큰 재사용 (grace 60초 경과) → 전체 세션 파기', async () => {
    mockHibpSafe();
    const fake = buildFakeDb();
    const app = createAuthRoutes();
    const email = 'jinsan@example.com';

    await app.request(
      '/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );

    // 정상 사용자가 PC + 모바일 로그인 (2 세션)
    const login1 = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );

    const stolenRefresh = parseCookie(
      login1.headers.get('Set-Cookie') ?? '',
      REFRESH_TOKEN_COOKIE,
    )!;

    // 정상 사용자의 첫 번째 refresh → rotation 성공
    await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${stolenRefresh}` },
      },
      buildAuthEnv(fake),
    );

    // grace 초과 시점으로 revoked_at 강제 이동 (공격자가 한참 뒤 탈취한 토큰 사용)
    const pastIso = new Date(
      Date.now() - (REFRESH_ROTATION_GRACE_SECONDS + 10) * 1000,
    ).toISOString();
    for (const s of fake.sessions.values()) {
      if (s.revoked_at !== null) s.revoked_at = pastIso;
    }

    // 공격자가 탈취한 토큰 재사용
    const attack = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${stolenRefresh}` },
      },
      buildAuthEnv(fake),
    );
    expect(attack.status, '탈취 감지 → 401 거부').toBe(401);
    const body = await attack.json();
    expect(body).toMatchObject({ reason: 'revoked' });

    // 사용자의 전체 세션이 파기되었는지
    const stillActive = Array.from(fake.sessions.values()).filter((s) => s.revoked_at === null);
    expect(stillActive.length, '전체 기기 강제 로그아웃').toBe(0);
  });

  it('S9. 관리자가 계정 정지 → 다음 세션 갱신 시 즉시 차단 + 전체 세션 파기', async () => {
    mockHibpSafe();
    const fake = buildFakeDb();
    const app = createAuthRoutes();
    const email = 'jinsan@example.com';

    await app.request(
      '/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    const login = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    const refresh = parseCookie(login.headers.get('Set-Cookie') ?? '', REFRESH_TOKEN_COOKIE)!;

    // 관리자가 계정 정지
    const user = Array.from(fake.users.values())[0]!;
    user.status = 'suspended';

    const refreshTry = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${refresh}` },
      },
      buildAuthEnv(fake),
    );
    expect(refreshTry.status, '정지 계정의 세션 갱신 거부').toBe(401);
    const body = await refreshTry.json();
    expect(body).toMatchObject({ reason: 'user_not_active' });

    const active = Array.from(fake.sessions.values()).filter((s) => s.revoked_at === null);
    expect(active.length, '정지 시 전체 세션 파기').toBe(0);
  });

  it('S10. 해커가 가짜 JWT 로 세션 갱신 시도 → 즉시 거부', async () => {
    const fake = buildFakeDb();
    const app = createAuthRoutes();

    // JWT 서명은 검증이 refresh cookie 에 대해서이지만, 여기서는 "아무 refresh 토큰이나"
    // 시도하는 위조 공격 시뮬레이션 — not_found 로 거부되어야
    const attack = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: {
          cookie: `${REFRESH_TOKEN_COOKIE}=totally-forged-refresh-token-that-was-never-issued`,
        },
      },
      buildAuthEnv(fake),
    );
    expect(attack.status, '위조 토큰 → 401').toBe(401);
    const body = await attack.json();
    expect(body).toMatchObject({ reason: 'not_found' });
  });
});

// ---------------------------------------------------------------------------
// 💳 결제 알림 시나리오 (S11 ~ S14)
// ---------------------------------------------------------------------------

describe('💳 결제 알림 시나리오', () => {
  afterEach(() => vi.restoreAllMocks());

  it('S11. 정상 결제 알림 수신 → DB 에 기록', async () => {
    const fake = buildFakeDb();
    const app = createWebhookRoutes();
    const body = JSON.stringify({
      event_id: 'evt_payment_001',
      event_type: 'payment.approved',
      amount: 10000,
    });
    const sig = await hmacSha256Hex(WEBHOOK_SECRET, body);

    const res = await app.request(
      '/payment/mock',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-payment-signature': sig },
        body,
      },
      buildWebhookEnv(fake),
    );
    expect(res.status, '정상 결제 알림 200').toBe(200);
    const json = (await res.json()) as { ok: boolean; replayed: boolean };
    expect(json.ok).toBe(true);
    expect(json.replayed).toBe(false);
    expect(fake.webhooks.size, 'DB 에 결제 이벤트 1건 저장').toBe(1);
  });

  it('S12. 같은 결제 알림 중복 수신 → 두 번째는 이미 처리됨 응답 (중복 청구 방지)', async () => {
    const fake = buildFakeDb();
    const app = createWebhookRoutes();
    const body = JSON.stringify({
      event_id: 'evt_replay_fixture',
      event_type: 'payment.approved',
      amount: 50000,
    });
    const sig = await hmacSha256Hex(WEBHOOK_SECRET, body);

    // 첫 번째
    const first = await app.request(
      '/payment/mock',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-payment-signature': sig },
        body,
      },
      buildWebhookEnv(fake),
    );
    expect(first.status).toBe(200);
    expect(((await first.json()) as { replayed: boolean }).replayed).toBe(false);

    // 두 번째 (동일)
    const second = await app.request(
      '/payment/mock',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-payment-signature': sig },
        body,
      },
      buildWebhookEnv(fake),
    );
    expect(second.status, '중복도 200 (PG 재시도 고려)').toBe(200);
    const secondJson = (await second.json()) as { ok: boolean; replayed: boolean };
    expect(secondJson.replayed, '두 번째는 replayed=true 로 표시').toBe(true);
    expect(fake.webhooks.size, 'DB 엔 여전히 1건 (중복 저장 없음)').toBe(1);
  });

  it('S13. 해커가 위조 서명으로 가짜 결제 알림 → HMAC 검증 실패 거부', async () => {
    const fake = buildFakeDb();
    const app = createWebhookRoutes();
    const body = JSON.stringify({
      event_id: 'evt_forged',
      event_type: 'payment.approved',
      amount: 99999999,
    });
    // 올바른 secret 이 아닌 다른 값으로 서명
    const forgedSig = await hmacSha256Hex('attacker-fake-secret', body);

    const res = await app.request(
      '/payment/mock',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-payment-signature': forgedSig },
        body,
      },
      buildWebhookEnv(fake),
    );
    expect(res.status, '위조 서명 → 401').toBe(401);
    const json = await res.json();
    expect(json).toMatchObject({ error: 'INVALID_SIGNATURE' });
    expect(fake.webhooks.size, 'DB 에 저장 안 됨').toBe(0);
  });

  it('S14. 32KB 초과 거대 페이로드 → HMAC 계산 이전 거부 (CPU 공격 방어)', async () => {
    const fake = buildFakeDb();
    const app = createWebhookRoutes();
    const huge = 'x'.repeat(33 * 1024);
    const body = JSON.stringify({
      event_id: 'evt_huge',
      event_type: 'payment.approved',
      padding: huge,
    });
    const sig = await hmacSha256Hex(WEBHOOK_SECRET, body);

    const res = await app.request(
      '/payment/mock',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-payment-signature': sig },
        body,
      },
      buildWebhookEnv(fake),
    );
    expect(res.status, '413 Payload Too Large').toBe(413);
    expect(fake.webhooks.size, 'DB 저장 없음').toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ⏰ 경계 시나리오 (S15 ~ S16)
// ---------------------------------------------------------------------------

describe('⏰ 경계 시나리오', () => {
  beforeEach(() => mockHibpSafe());
  afterEach(() => vi.restoreAllMocks());

  it('S15. 네트워크 재시도로 60초 내 같은 refresh 재사용 → 세션 유지 (오탐 방지)', async () => {
    const fake = buildFakeDb();
    const app = createAuthRoutes();
    const email = 'jinsan@example.com';

    await app.request(
      '/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    const login = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    // 다른 기기에서 동시 로그인 — 총 세션 2개
    await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    const originalRefresh = parseCookie(
      login.headers.get('Set-Cookie') ?? '',
      REFRESH_TOKEN_COOKIE,
    )!;

    // 정상 rotation
    await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${originalRefresh}` },
      },
      buildAuthEnv(fake),
    );

    // 즉시 같은 refresh 재사용 (네트워크 재시도 시뮬레이션)
    const retry = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${originalRefresh}` },
      },
      buildAuthEnv(fake),
    );
    expect(retry.status, '재시도는 401 반환').toBe(401);
    const body = await retry.json();
    expect(body, '재시도로 분류되어 rotated_recently').toMatchObject({
      reason: 'rotated_recently',
    });

    // 전체 세션은 유지 (탈취로 오판하지 않음)
    const userId = Array.from(fake.users.values())[0]!.id;
    const active = Array.from(fake.sessions.values()).filter(
      (s) => s.user_id === userId && s.revoked_at === null,
    );
    expect(active.length, '오탐 방지 — 세션 유지').toBeGreaterThanOrEqual(2);
  });

  it('S16. 30일 경과한 refresh 토큰 → 만료 응답 (재로그인 필요)', async () => {
    const fake = buildFakeDb();
    const app = createAuthRoutes();
    const email = 'jinsan@example.com';

    await app.request(
      '/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    const login = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      },
      buildAuthEnv(fake),
    );
    const refresh = parseCookie(login.headers.get('Set-Cookie') ?? '', REFRESH_TOKEN_COOKIE)!;

    // expires_at 을 과거로 강제 (30일 경과 시뮬레이션)
    for (const s of fake.sessions.values()) {
      s.expires_at = new Date(Date.now() - 1000).toISOString();
    }

    const expired = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${refresh}` },
      },
      buildAuthEnv(fake),
    );
    expect(expired.status, '만료 → 401').toBe(401);
    const body = await expired.json();
    expect(body).toMatchObject({ reason: 'expired' });
  });
});
