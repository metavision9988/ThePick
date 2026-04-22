/**
 * 쪽집게 Phase 1 전반전 — 실제 사용자 시나리오 검증 (진산님 직접 확인용).
 *
 * 목적: "AI 가 짠 단위 테스트"가 아니라 "실제 사용자가 이 앱을 쓸 때 어떻게 되는가"를
 * 일상어 시나리오로 검증. 실행 결과를 진산님이 눈으로 보고 판단 가능.
 *
 * Step 1-4 리뷰 후 개선 (2026-04-22 review-20260422-171808.md 반영):
 *   - Fake D1 Map → 실제 SQLite (node:sqlite) + migrations 9종 전부 적용
 *     → 15 DB 트리거 (NOT NULL × 4, immutable × 4, revoked_at one-way, status enum 등) 전부 실제 동작
 *   - S17~S21 신규 추가 (Access JWT 위조 / 약한 webhook secret / timing 평탄화 /
 *     IP_PEPPER silent degradation / 페이로드 경계)
 *   - S1/S3 이름 정정 (실제 동작과 일치)
 *
 * 실행 방법:
 *   pnpm --filter @thepick/api test -- --run scenarios
 *
 * 시나리오 목록 (총 21개):
 *   🌟 정상 이용자:     S1 ~ S4 (4개)
 *   🛡️ 보안 방어:       S5 ~ S10 (6개)
 *   💳 결제 알림:        S11 ~ S14 (4개)
 *   ⏰ 경계 시나리오:    S15 ~ S16 (2개)
 *   🔒 엔진 내부 검증:  S17 ~ S21 (5개, Step 1-4 리뷰 M-3/M-4 해소)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_ROTATION_GRACE_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
} from '@thepick/shared';
import { createAuthRoutes } from '../auth/routes.js';
import { createWebhookRoutes } from '../webhooks/payment.js';
import { createRefreshSession, signAccessToken, verifyAccessToken } from '../auth/session.js';
import type { RateLimiter } from '../auth/rate-limit.js';
import { createD1FromSqlite, type SqliteBackedD1 } from './helpers/d1-from-sqlite.js';

// ---------------------------------------------------------------------------
// 공통 상수 + 헬퍼
// ---------------------------------------------------------------------------

const VALID_JWT_SECRET = 'scenarios-jwt-secret-32bytes-plus-v1';
const IP_PEPPER = 'scenarios-ip-pepper-32bytes-plus-v1';
const WEBHOOK_SECRET = 'scenarios-webhook-secret-32bytes-plus-v1';
const STRONG_PASSWORD = 'JinSan-Strong-Pw-2026-!@#$';
const TEST_EMAIL = 'jinsan@example.com';

const allowAll: RateLimiter = { limit: async () => ({ success: true }) };
const denyAll: RateLimiter = { limit: async () => ({ success: false }) };

interface EnvOverrides {
  JWT_SECRET?: string;
  IP_PEPPER?: string;
  ENVIRONMENT?: string;
  AUTH_RATE_LIMITER_IP?: RateLimiter;
  AUTH_RATE_LIMITER_EMAIL?: RateLimiter;
  WEBHOOK_RATE_LIMITER_IP?: RateLimiter;
  WEBHOOK_HMAC_SECRET_MOCK?: string;
}

let ctx: SqliteBackedD1;

beforeEach(() => {
  ctx = createD1FromSqlite();
});

afterEach(() => {
  ctx.close();
  vi.restoreAllMocks();
});

function authEnv(overrides: EnvOverrides = {}) {
  return {
    DB: ctx.db,
    ENVIRONMENT: overrides.ENVIRONMENT ?? 'test',
    AUTH_RATE_LIMITER_IP: overrides.AUTH_RATE_LIMITER_IP ?? allowAll,
    AUTH_RATE_LIMITER_EMAIL: overrides.AUTH_RATE_LIMITER_EMAIL ?? allowAll,
    JWT_SECRET: 'JWT_SECRET' in overrides ? overrides.JWT_SECRET : VALID_JWT_SECRET,
    IP_PEPPER: 'IP_PEPPER' in overrides ? overrides.IP_PEPPER : IP_PEPPER,
  };
}

function webhookEnv(overrides: EnvOverrides = {}) {
  return {
    DB: ctx.db,
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

/** HIBP 모의 — safe (유출 이력 없음). */
function mockHibpSafe() {
  globalThis.fetch = vi
    .fn()
    .mockResolvedValue(new Response('FFFFF99999999999999999999999999999FFFF:1\n', { status: 200 }));
}

/** HIBP 모의 — pwned (유출 DB 에 있음). SHA-1('password') suffix 반환. */
function mockHibpPwned() {
  globalThis.fetch = vi
    .fn()
    .mockResolvedValue(
      new Response('1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\n', { status: 200 }),
    );
}

async function registerUser(email: string, password: string = STRONG_PASSWORD): Promise<Response> {
  const app = createAuthRoutes();
  return app.request(
    '/register',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    authEnv(),
  );
}

async function login(email: string, password: string = STRONG_PASSWORD): Promise<Response> {
  const app = createAuthRoutes();
  return app.request(
    '/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    authEnv(),
  );
}

/** DB 에서 특정 user 의 활성 세션 수. */
function countActiveSessions(userId: string): number {
  const stmt = ctx.raw.prepare(
    `SELECT COUNT(*) as n FROM sessions WHERE user_id = ? AND revoked_at IS NULL`,
  );
  const row = stmt.get(userId) as { n: number };
  return row.n;
}

function getUserId(email: string): string {
  const row = ctx.raw.prepare(`SELECT id FROM users WHERE email = ?`).get(email) as
    | { id: string }
    | undefined;
  if (!row) throw new Error(`user not found: ${email}`);
  return row.id;
}

// ===========================================================================
// 🌟 정상 이용자 플로우 (S1 ~ S4)
// ===========================================================================

describe('🌟 정상 이용자 플로우', () => {
  beforeEach(() => mockHibpSafe());

  it('S1. 신규 가입자가 이메일로 가입 성공 + 별도 로그인 시 쿠키 발급된다', async () => {
    // 리뷰 M-6 반영: /register 자체는 쿠키 미발급 (201 + user body). 별도 /login 필요.
    const register = await registerUser(TEST_EMAIL);
    expect(register.status, '가입 201 Created').toBe(201);

    const regBody = (await register.json()) as { user: { id: string; email: string } };
    expect(regBody.user.email).toBe(TEST_EMAIL);
    expect(regBody.user.id, 'UUID 형식 id 발급').toMatch(/^[0-9a-f-]{36}$/);

    // DB 실제 저장 확인
    const userRow = ctx.raw
      .prepare(`SELECT email, status FROM users WHERE email = ?`)
      .get(TEST_EMAIL);
    expect(userRow, 'DB users 테이블에 실제 저장').toBeDefined();
    expect((userRow as { status: string }).status).toBe('active');

    // 별도 로그인
    const loginRes = await login(TEST_EMAIL);
    expect(loginRes.status, '로그인 성공 200').toBe(200);

    const setCookie = loginRes.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain(ACCESS_TOKEN_COOKIE);
    expect(setCookie).toContain(REFRESH_TOKEN_COOKIE);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);

    const userId = getUserId(TEST_EMAIL);
    expect(countActiveSessions(userId), '활성 세션 1개').toBe(1);
  });

  it('S2. 가입 후 로그아웃하고 재로그인할 수 있다', async () => {
    await registerUser(TEST_EMAIL);
    const app = createAuthRoutes();

    const login1 = await login(TEST_EMAIL);
    const refresh1 = parseCookie(login1.headers.get('Set-Cookie') ?? '', REFRESH_TOKEN_COOKIE)!;

    const logout = await app.request(
      '/logout',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${refresh1}` },
      },
      authEnv(),
    );
    expect(logout.status, '로그아웃 204').toBe(204);
    expect(logout.headers.get('Set-Cookie') ?? '').toMatch(/Max-Age=0/);

    const userId = getUserId(TEST_EMAIL);
    expect(countActiveSessions(userId), '로그아웃 후 활성 세션 0').toBe(0);

    // 재로그인
    const login2 = await login(TEST_EMAIL);
    expect(login2.status).toBe(200);
    const refresh2 = parseCookie(login2.headers.get('Set-Cookie') ?? '', REFRESH_TOKEN_COOKIE)!;
    expect(refresh2, '새 refresh 토큰').not.toBe(refresh1);
    expect(countActiveSessions(userId), '재로그인 후 활성 세션 1개').toBe(1);
  });

  it('S3. 로그인 후 refresh 호출 시 새 access+refresh 쿠키로 rotation 된다', async () => {
    // 리뷰 M-5 반영: "15분 경과" 는 access 만료의 client 측 트리거.
    // 서버 측 rotation 동작은 /refresh 호출 시점에 무조건 실행 — 이것을 검증.
    await registerUser(TEST_EMAIL);
    const app = createAuthRoutes();
    const loginRes = await login(TEST_EMAIL);
    const oldAccess = parseCookie(loginRes.headers.get('Set-Cookie') ?? '', ACCESS_TOKEN_COOKIE)!;
    const oldRefresh = parseCookie(loginRes.headers.get('Set-Cookie') ?? '', REFRESH_TOKEN_COOKIE)!;

    const refreshRes = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${oldRefresh}` },
      },
      authEnv(),
    );
    expect(refreshRes.status).toBe(200);

    const newSetCookie = refreshRes.headers.get('Set-Cookie') ?? '';
    const newAccess = parseCookie(newSetCookie, ACCESS_TOKEN_COOKIE);
    const newRefresh = parseCookie(newSetCookie, REFRESH_TOKEN_COOKIE);
    expect(newAccess).not.toBeNull();
    expect(newRefresh).not.toBeNull();
    expect(newAccess, '새 access').not.toBe(oldAccess);
    expect(newRefresh, '새 refresh').not.toBe(oldRefresh);

    // 이전 세션은 revoked, 새 세션은 active — 총 2개 row, active 1개
    const userId = getUserId(TEST_EMAIL);
    expect(countActiveSessions(userId)).toBe(1);
  });

  it('S4. PC + 모바일 동시 로그인 → 두 세션 독립 유지', async () => {
    await registerUser(TEST_EMAIL);
    const app = createAuthRoutes();

    const pc = await app.request(
      '/login',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; PC)',
        },
        body: JSON.stringify({ email: TEST_EMAIL, password: STRONG_PASSWORD }),
      },
      authEnv(),
    );
    const mobile = await app.request(
      '/login',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (iPhone; Mobile)',
        },
        body: JSON.stringify({ email: TEST_EMAIL, password: STRONG_PASSWORD }),
      },
      authEnv(),
    );
    expect(pc.status).toBe(200);
    expect(mobile.status).toBe(200);

    const userId = getUserId(TEST_EMAIL);
    expect(countActiveSessions(userId), '활성 세션 2개').toBe(2);

    // PC 로그아웃
    const pcRefresh = parseCookie(pc.headers.get('Set-Cookie') ?? '', REFRESH_TOKEN_COOKIE)!;
    await app.request(
      '/logout',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${pcRefresh}` },
      },
      authEnv(),
    );

    expect(countActiveSessions(userId), 'PC 로그아웃 후 모바일만 활성').toBe(1);
  });
});

// ===========================================================================
// 🛡️ 보안 방어 시나리오 (S5 ~ S10)
// ===========================================================================

describe('🛡️ 보안 방어 시나리오', () => {
  it('S5. 유출된 비밀번호 "password" 로 가입 시도 → HIBP 감지로 거부', async () => {
    mockHibpPwned();
    const register = await registerUser(TEST_EMAIL, 'password');
    expect(register.status).toBe(422);
    expect(await register.json()).toMatchObject({ error: 'PASSWORD_PWNED' });

    // DB 저장 안 됨 확인
    const row = ctx.raw.prepare(`SELECT id FROM users WHERE email = ?`).get(TEST_EMAIL);
    expect(row, '거부되어 DB 저장 안 됨').toBeUndefined();
  });

  it('S6. 로그인 무차별 대입 → rate-limit 차단', async () => {
    mockHibpSafe();
    const app = createAuthRoutes();
    const res = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'any@example.com', password: STRONG_PASSWORD }),
      },
      authEnv({ AUTH_RATE_LIMITER_IP: denyAll }),
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'TOO_MANY_REQUESTS' });
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('S7. 이메일 열거 방어 — 없는 이메일 vs 틀린 비밀번호 응답 완전 동일', async () => {
    mockHibpSafe();
    await registerUser('real@example.com');

    const ghost = await login('ghost@example.com', STRONG_PASSWORD);
    const wrongPw = await login('real@example.com', 'TotallyWrongPassword!@#');

    expect(ghost.status).toBe(401);
    expect(wrongPw.status).toBe(401);
    expect(await ghost.json()).toEqual(await wrongPw.json());
  });

  it('S8. 탈취된 refresh 토큰 재사용 (grace 60초 초과) → 전체 세션 파기', async () => {
    mockHibpSafe();
    await registerUser(TEST_EMAIL);
    const app = createAuthRoutes();

    // 2개 세션 생성 (정상 다기기)
    const login1 = await login(TEST_EMAIL);
    await login(TEST_EMAIL);
    const stolen = parseCookie(login1.headers.get('Set-Cookie') ?? '', REFRESH_TOKEN_COOKIE)!;

    // 첫 rotation 성공
    await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${stolen}` },
      },
      authEnv(),
    );

    // grace 초과 시점으로 revoked_at 이동 (실제 D1 에서도 허용 — immutable 아님)
    const pastIso = new Date(
      Date.now() - (REFRESH_ROTATION_GRACE_SECONDS + 10) * 1000,
    ).toISOString();
    ctx.raw.prepare(`UPDATE sessions SET revoked_at = ? WHERE revoked_at IS NOT NULL`).run(pastIso);

    // 탈취 재사용
    const attack = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${stolen}` },
      },
      authEnv(),
    );
    expect(attack.status).toBe(401);
    expect(await attack.json()).toMatchObject({ reason: 'revoked' });

    const userId = getUserId(TEST_EMAIL);
    expect(countActiveSessions(userId), '탈취 감지 → 전체 세션 파기').toBe(0);
  });

  it('S9. 관리자가 계정 정지 → 다음 refresh 시 즉시 차단 + 전체 세션 파기', async () => {
    mockHibpSafe();
    await registerUser(TEST_EMAIL);
    const loginRes = await login(TEST_EMAIL);
    const refresh = parseCookie(loginRes.headers.get('Set-Cookie') ?? '', REFRESH_TOKEN_COOKIE)!;

    // 관리자가 계정 정지 (users 테이블 상태 변경)
    ctx.raw.prepare(`UPDATE users SET status = 'suspended' WHERE email = ?`).run(TEST_EMAIL);

    const app = createAuthRoutes();
    const res = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${refresh}` },
      },
      authEnv(),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ reason: 'user_not_active' });

    const userId = getUserId(TEST_EMAIL);
    expect(countActiveSessions(userId), '정지 시 전체 세션 파기').toBe(0);
  });

  it('S10. 가짜 refresh 토큰으로 세션 갱신 시도 → 즉시 거부', async () => {
    const app = createAuthRoutes();
    const res = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: {
          cookie: `${REFRESH_TOKEN_COOKIE}=totally-forged-refresh-token-never-issued`,
        },
      },
      authEnv(),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ reason: 'not_found' });
  });
});

// ===========================================================================
// 💳 결제 알림 시나리오 (S11 ~ S14)
// ===========================================================================

describe('💳 결제 알림 시나리오', () => {
  it('S11. 정상 결제 알림 수신 → webhook_events DB 기록', async () => {
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
      webhookEnv(),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; replayed: boolean };
    expect(json.ok).toBe(true);
    expect(json.replayed).toBe(false);

    // 실제 DB row 검증 (이전 Fake 의 size 확인보다 엄격)
    const row = ctx.raw
      .prepare(`SELECT provider, event_id, event_type, status FROM webhook_events`)
      .get() as {
      provider: string;
      event_id: string;
      event_type: string;
      status: string;
    };
    expect(row).toMatchObject({
      provider: 'mock',
      event_id: 'evt_payment_001',
      event_type: 'payment.approved',
      status: 'received',
    });
  });

  it('S12. 같은 결제 알림 중복 수신 → 두 번째는 replayed=true (중복 청구 방지)', async () => {
    const app = createWebhookRoutes();
    const body = JSON.stringify({
      event_id: 'evt_replay_fixture',
      event_type: 'payment.approved',
      amount: 50000,
    });
    const sig = await hmacSha256Hex(WEBHOOK_SECRET, body);

    const first = await app.request(
      '/payment/mock',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-payment-signature': sig },
        body,
      },
      webhookEnv(),
    );
    expect(first.status).toBe(200);
    expect(((await first.json()) as { replayed: boolean }).replayed).toBe(false);

    const second = await app.request(
      '/payment/mock',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-payment-signature': sig },
        body,
      },
      webhookEnv(),
    );
    expect(second.status).toBe(200);
    expect(((await second.json()) as { replayed: boolean }).replayed).toBe(true);

    // DB 엔 여전히 1건 — UNIQUE(provider, event_id) 제약 검증
    const count = (
      ctx.raw.prepare(`SELECT COUNT(*) as n FROM webhook_events`).get() as { n: number }
    ).n;
    expect(count, '중복 저장 없음').toBe(1);
  });

  it('S13. 해커가 위조 서명으로 가짜 결제 알림 → HMAC 검증 실패 거부', async () => {
    const app = createWebhookRoutes();
    const body = JSON.stringify({
      event_id: 'evt_forged',
      event_type: 'payment.approved',
      amount: 99999999,
    });
    const forgedSig = await hmacSha256Hex('attacker-fake-secret-32bytes-plus', body);

    const res = await app.request(
      '/payment/mock',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-payment-signature': forgedSig },
        body,
      },
      webhookEnv(),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'INVALID_SIGNATURE' });

    const count = (
      ctx.raw.prepare(`SELECT COUNT(*) as n FROM webhook_events`).get() as { n: number }
    ).n;
    expect(count, '위조 알림 DB 저장 없음').toBe(0);
  });

  it('S14. 32KB 초과 페이로드 → HMAC 계산 이전 413 거부', async () => {
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
      webhookEnv(),
    );
    expect(res.status).toBe(413);
  });
});

// ===========================================================================
// ⏰ 경계 시나리오 (S15 ~ S16)
// ===========================================================================

describe('⏰ 경계 시나리오', () => {
  beforeEach(() => mockHibpSafe());

  it('S15. 네트워크 재시도 — grace 60초 내 같은 refresh 재사용 → 세션 유지 (오탐 방지)', async () => {
    await registerUser(TEST_EMAIL);
    await login(TEST_EMAIL);
    const login1 = await login(TEST_EMAIL);
    const originalRefresh = parseCookie(
      login1.headers.get('Set-Cookie') ?? '',
      REFRESH_TOKEN_COOKIE,
    )!;

    const app = createAuthRoutes();

    // 첫 rotation
    await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${originalRefresh}` },
      },
      authEnv(),
    );

    // 즉시 같은 refresh 재사용 — 네트워크 재시도 시뮬레이션 (grace 이내)
    const retry = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${originalRefresh}` },
      },
      authEnv(),
    );
    expect(retry.status).toBe(401);
    expect(await retry.json()).toMatchObject({ reason: 'rotated_recently' });

    // 전체 세션 유지 (탈취 오판 없음)
    const userId = getUserId(TEST_EMAIL);
    expect(countActiveSessions(userId), '오탐 방지 — 세션 유지').toBeGreaterThanOrEqual(2);
  });

  it('S16. 30일 경과 refresh 토큰 → 만료 응답', async () => {
    await registerUser(TEST_EMAIL);
    const userId = getUserId(TEST_EMAIL);

    // 리뷰 C-2 반영: 직접 expires_at 을 조작할 수 없음 (immutable 트리거).
    // createRefreshSession 에 과거 now 를 넘겨 "이미 만료된" 세션 생성.
    const pastNow = Date.now() - (REFRESH_TOKEN_TTL_SECONDS + 10) * 1000;
    const expired = await createRefreshSession(
      ctx.db,
      userId,
      { userAgent: null, ipHash: null },
      pastNow,
    );

    const app = createAuthRoutes();
    const res = await app.request(
      '/refresh',
      {
        method: 'POST',
        headers: { cookie: `${REFRESH_TOKEN_COOKIE}=${expired.refreshToken}` },
      },
      authEnv(),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ reason: 'expired' });
  });
});

// ===========================================================================
// 🔒 엔진 내부 검증 (S17 ~ S21, 리뷰 M-3/M-4 해소)
// ===========================================================================

describe('🔒 엔진 내부 검증', () => {
  it('S17. 위조 Access JWT 검증 — verifyAccessToken 이 invalid 로 거부', async () => {
    // 리뷰 M-3 해소: access JWT 검증 경로 검증 (require-auth 미들웨어 마운트 전)
    // 다른 secret 으로 서명한 토큰 → 현재 secret 으로 verify 시 invalid 반환.
    const forged = await signAccessToken(
      'attacker-user-id',
      'attacker-session-id',
      'attacker-secret-32bytes-plus-different',
    );

    const result = await verifyAccessToken(forged, VALID_JWT_SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid');
    }
  });

  it('S18. webhook secret 이 31자(< 32) → 500 WEBHOOK_WEAK_SECRET', async () => {
    // 리뷰 M-4 해소: payment.ts MIN_WEBHOOK_SECRET_BYTES 검증 경로
    const weakSecret = 'a'.repeat(31);
    const body = JSON.stringify({ event_id: 'evt_weak', event_type: 'payment.approved' });
    // 약한 secret 으로 올바른 서명을 만들어도 길이 검증에서 거부되어야 함
    const sig = await hmacSha256Hex(weakSecret, body);

    const app = createWebhookRoutes();
    const res = await app.request(
      '/payment/mock',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-payment-signature': sig },
        body,
      },
      webhookEnv({ WEBHOOK_HMAC_SECRET_MOCK: weakSecret }),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'WEBHOOK_WEAK_SECRET' });
  });

  it('S19. 로그인 타이밍 평탄화 — 없는 이메일과 틀린 비밀번호 응답 시간 차이 미미', async () => {
    // 리뷰 M-4 해소: dummy-verify.ts 의 timing 평탄화 (Step 1-1 핵심 보안)
    mockHibpSafe();
    await registerUser(TEST_EMAIL);

    const runs = 3;
    const ghostTimes: number[] = [];
    const wrongPwTimes: number[] = [];

    for (let i = 0; i < runs; i++) {
      const t0 = performance.now();
      await login('ghost-unknown@example.com', STRONG_PASSWORD);
      ghostTimes.push(performance.now() - t0);

      const t1 = performance.now();
      await login(TEST_EMAIL, 'WrongPassword-Long-Enough-123!');
      wrongPwTimes.push(performance.now() - t1);
    }

    const avgGhost = ghostTimes.reduce((a, b) => a + b, 0) / runs;
    const avgWrong = wrongPwTimes.reduce((a, b) => a + b, 0) / runs;

    // 두 경로 모두 PBKDF2 600k 를 실행해야 함 → 평균 차이가 절대 시간 대비 작아야
    // 환경별 편차 크므로 "한쪽이 다른쪽의 10배 이상 빠른 경우" 만 실패
    const ratio = Math.max(avgGhost, avgWrong) / Math.max(Math.min(avgGhost, avgWrong), 1);
    expect(
      ratio,
      `평균 시간 비율 ghost=${avgGhost.toFixed(0)}ms vs wrong=${avgWrong.toFixed(0)}ms`,
    ).toBeLessThan(10);
  });

  it('S20. IP_PEPPER 미설정 상태 로그인 → sessions.ip_hash = null 저장', async () => {
    // 리뷰 M-4 해소: IP_PEPPER silent degradation 명시 검증
    mockHibpSafe();
    await registerUser(TEST_EMAIL);

    const app = createAuthRoutes();
    const loginRes = await app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: STRONG_PASSWORD }),
      },
      authEnv({ IP_PEPPER: undefined }),
    );
    expect(loginRes.status, '로그인 자체는 성공 (IP hash 는 부가 기능)').toBe(200);

    const row = ctx.raw
      .prepare(`SELECT ip_hash FROM sessions ORDER BY created_at DESC LIMIT 1`)
      .get() as { ip_hash: string | null };
    expect(row.ip_hash, 'pepper 없으면 ip_hash 는 null 저장').toBeNull();
  });

  it('S21. 페이로드 경계 검증 — 정확히 32KB 는 통과, 32KB+1byte 는 413', async () => {
    // 리뷰 m-2 해소: 경계값 정밀 검증
    const app = createWebhookRoutes();
    const buildBody = (paddingBytes: number): string => {
      const meta = JSON.stringify({
        event_id: `evt_${paddingBytes}`,
        event_type: 'payment.approved',
        padding: '',
      });
      // meta 바이트 수 계산 후 padding 으로 정확히 target 크기 채우기
      const metaBytes = new TextEncoder().encode(meta).byteLength;
      const paddingNeeded = paddingBytes - metaBytes;
      return JSON.stringify({
        event_id: `evt_${paddingBytes}`,
        event_type: 'payment.approved',
        padding: 'x'.repeat(Math.max(0, paddingNeeded)),
      });
    };

    // 정확히 32KB 바로 아래
    const underLimit = buildBody(32 * 1024 - 10);
    const sigUnder = await hmacSha256Hex(WEBHOOK_SECRET, underLimit);
    const resUnder = await app.request(
      '/payment/mock',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-payment-signature': sigUnder },
        body: underLimit,
      },
      webhookEnv(),
    );
    expect(resUnder.status, '32KB 미만 → 통과').toBe(200);

    // 32KB 초과
    const overLimit = buildBody(32 * 1024 + 10);
    const sigOver = await hmacSha256Hex(WEBHOOK_SECRET, overLimit);
    const resOver = await app.request(
      '/payment/mock',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-payment-signature': sigOver },
        body: overLimit,
      },
      webhookEnv(),
    );
    expect(resOver.status, '32KB 초과 → 413').toBe(413);
  });
});
