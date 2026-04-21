/**
 * Webhook /api/webhooks/payment/:provider 테스트.
 *
 * 범위:
 *   - 서명 유효/무효/형식오류 각 분기
 *   - Replay 감지 (동일 event_id 재수신)
 *   - Idempotency-Key 헤더 폴백
 *   - Zod validation 실패 분기
 *   - D1 일시 장애 → 503 + Retry-After
 *   - 지원 provider 목록 외 → 400
 *   - secret 미설정 → 500 fail-closed
 */

import { describe, expect, it } from 'vitest';
import { createWebhookRoutes, type WebhookBindings } from '../payment.js';
import type { RateLimiter } from '../../auth/rate-limit.js';

const PROVIDER = 'mock';
/** Step 1-3 M-4 — MIN_WEBHOOK_SECRET_BYTES(32) 를 충족하는 32+ 바이트 secret. */
const SECRET = 'test-webhook-secret-32bytes-plus-v1';

/** 항상 허용하는 limiter — 대부분의 테스트에서 rate-limit 비관여. */
const allowAllLimiter: RateLimiter = {
  limit: async () => ({ success: true }),
};

/** 항상 차단하는 limiter — rate-limit 경로 전용 테스트. */
const denyAllLimiter: RateLimiter = {
  limit: async () => ({ success: false }),
};

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

/** D1Database prepared statement fake — INSERT UNIQUE 제약 시뮬레이션. */
interface FakeRunResult {
  readonly success: boolean;
  readonly meta: Record<string, unknown>;
}

interface InsertedRow {
  readonly provider: string;
  readonly eventId: string;
}

function buildFakeDb(
  opts: {
    throwOnRun?: Error;
  } = {},
): {
  readonly db: D1Database;
  readonly inserts: InsertedRow[];
  readonly seenEventIds: Set<string>;
} {
  const inserts: InsertedRow[] = [];
  const seenEventIds = new Set<string>();
  const db = {
    prepare: (_sql: string) => {
      let boundArgs: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => {
          boundArgs = args;
          return stmt;
        },
        run: async (): Promise<FakeRunResult> => {
          if (opts.throwOnRun !== undefined) {
            throw opts.throwOnRun;
          }
          const provider = String(boundArgs[1]);
          const eventId = String(boundArgs[2]);
          const key = `${provider}::${eventId}`;
          if (seenEventIds.has(key)) {
            throw new Error(
              'UNIQUE constraint failed: webhook_events.provider, webhook_events.event_id',
            );
          }
          seenEventIds.add(key);
          inserts.push({ provider, eventId });
          return { success: true, meta: {} };
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
  return { db, inserts, seenEventIds };
}

function buildBindings(overrides: Partial<WebhookBindings> = {}): WebhookBindings {
  return {
    DB: overrides.DB ?? buildFakeDb().db,
    ENVIRONMENT: 'test',
    WEBHOOK_HMAC_SECRET_MOCK: SECRET,
    WEBHOOK_RATE_LIMITER_IP: overrides.WEBHOOK_RATE_LIMITER_IP ?? allowAllLimiter,
    ...overrides,
  };
}

function buildPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    event_id: overrides.event_id ?? 'evt_fixture_001',
    event_type: overrides.event_type ?? 'payment.approved',
    amount: overrides.amount ?? 10000,
    ...overrides,
  });
}

async function postWebhook(
  app: ReturnType<typeof createWebhookRoutes>,
  env: WebhookBindings,
  body: string,
  headers: Record<string, string>,
  provider: string = PROVIDER,
): Promise<Response> {
  return app.request(
    `/payment/${provider}`,
    {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', ...headers },
    },
    env,
  );
}

describe('POST /api/webhooks/payment/:provider', () => {
  it('rejects with 401 on missing signature', async () => {
    const app = createWebhookRoutes();
    const env = buildBindings();
    const body = buildPayload();
    const res = await postWebhook(app, env, body, {});
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ error: 'INVALID_SIGNATURE' });
  });

  it('rejects with 401 on wrong signature', async () => {
    const app = createWebhookRoutes();
    const env = buildBindings();
    const body = buildPayload();
    const res = await postWebhook(app, env, body, {
      'x-payment-signature': 'a'.repeat(64),
    });
    expect(res.status).toBe(401);
  });

  it('rejects with 401 on malformed signature (not hex)', async () => {
    const app = createWebhookRoutes();
    const env = buildBindings();
    const body = buildPayload();
    const res = await postWebhook(app, env, body, {
      'x-payment-signature': 'not-a-hex-string',
    });
    expect(res.status).toBe(401);
  });

  it('accepts with 200 on valid signature', async () => {
    const app = createWebhookRoutes();
    const fake = buildFakeDb();
    const env = buildBindings({ DB: fake.db });
    const body = buildPayload();
    const sig = await hmacSha256Hex(SECRET, body);
    const res = await postWebhook(app, env, body, { 'x-payment-signature': sig });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; replayed: boolean; id?: string };
    expect(json.ok).toBe(true);
    expect(json.replayed).toBe(false);
    expect(json.id).toBeTypeOf('string');
    expect(fake.inserts).toHaveLength(1);
    expect(fake.inserts[0]!.provider).toBe(PROVIDER);
    expect(fake.inserts[0]!.eventId).toBe('evt_fixture_001');
  });

  it('returns 200 replayed=true on duplicate event_id (UNIQUE constraint)', async () => {
    const app = createWebhookRoutes();
    const fake = buildFakeDb();
    const env = buildBindings({ DB: fake.db });
    const body = buildPayload({ event_id: 'evt_replay_fixture' });
    const sig = await hmacSha256Hex(SECRET, body);

    const first = await postWebhook(app, env, body, { 'x-payment-signature': sig });
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as { replayed: boolean };
    expect(firstJson.replayed).toBe(false);

    const second = await postWebhook(app, env, body, { 'x-payment-signature': sig });
    expect(second.status).toBe(200);
    const secondJson = (await second.json()) as { replayed: boolean };
    expect(secondJson.replayed).toBe(true);
    expect(fake.inserts).toHaveLength(1);
  });

  it('uses Idempotency-Key header when body.event_id missing', async () => {
    const app = createWebhookRoutes();
    const fake = buildFakeDb();
    const env = buildBindings({ DB: fake.db });
    const body = JSON.stringify({ event_type: 'payment.approved', amount: 500 });
    const sig = await hmacSha256Hex(SECRET, body);
    const res = await postWebhook(app, env, body, {
      'x-payment-signature': sig,
      'idempotency-key': 'header-fallback-evt-001',
    });
    expect(res.status).toBe(200);
    expect(fake.inserts[0]!.eventId).toBe('header-fallback-evt-001');
  });

  it('returns 400 when neither body.event_id nor Idempotency-Key provided', async () => {
    const app = createWebhookRoutes();
    const env = buildBindings();
    const body = JSON.stringify({ event_type: 'payment.approved' });
    const sig = await hmacSha256Hex(SECRET, body);
    const res = await postWebhook(app, env, body, { 'x-payment-signature': sig });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ error: 'MISSING_IDEMPOTENCY_KEY' });
  });

  it('returns 400 on invalid JSON', async () => {
    const app = createWebhookRoutes();
    const env = buildBindings();
    const body = '{not-a-valid-json';
    const sig = await hmacSha256Hex(SECRET, body);
    const res = await postWebhook(app, env, body, { 'x-payment-signature': sig });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ error: 'INVALID_JSON' });
  });

  it('returns 400 on Zod validation failure (missing event_type)', async () => {
    const app = createWebhookRoutes();
    const env = buildBindings();
    const body = JSON.stringify({ event_id: 'evt_no_type' });
    const sig = await hmacSha256Hex(SECRET, body);
    const res = await postWebhook(app, env, body, { 'x-payment-signature': sig });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ error: 'INVALID_PAYLOAD' });
  });

  it('returns 400 on unknown provider', async () => {
    const app = createWebhookRoutes();
    const env = buildBindings();
    const body = buildPayload();
    const sig = await hmacSha256Hex(SECRET, body);
    const res = await postWebhook(app, env, body, { 'x-payment-signature': sig }, 'unknown-pg');
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ error: 'UNKNOWN_PROVIDER' });
  });

  it('returns 500 when provider secret not configured (fail-closed)', async () => {
    const app = createWebhookRoutes();
    const env: WebhookBindings = {
      DB: buildFakeDb().db,
      ENVIRONMENT: 'test',
      WEBHOOK_RATE_LIMITER_IP: allowAllLimiter,
      // WEBHOOK_HMAC_SECRET_MOCK 미설정
    };
    const body = buildPayload();
    const sig = await hmacSha256Hex(SECRET, body);
    const res = await postWebhook(app, env, body, { 'x-payment-signature': sig });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: 'WEBHOOK_NOT_CONFIGURED' });
  });

  it('returns 500 WEBHOOK_WEAK_SECRET when secret shorter than 32 bytes (Step 1-3 M-4)', async () => {
    const app = createWebhookRoutes();
    const weakSecret = 'short-secret-10b'; // 16 bytes < 32
    const env: WebhookBindings = {
      DB: buildFakeDb().db,
      ENVIRONMENT: 'test',
      WEBHOOK_RATE_LIMITER_IP: allowAllLimiter,
      WEBHOOK_HMAC_SECRET_MOCK: weakSecret,
    };
    const body = buildPayload({ event_id: 'evt_weak_secret' });
    // 공격자 관점: weak secret 을 안다 해도 응답은 여전히 500 (valid signature 로 시도).
    const sig = await hmacSha256Hex(weakSecret, body);
    const res = await postWebhook(app, env, body, { 'x-payment-signature': sig });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: 'WEBHOOK_WEAK_SECRET' });
  });

  it('accepts when secret length exactly at MIN_WEBHOOK_SECRET_BYTES threshold (boundary)', async () => {
    const app = createWebhookRoutes();
    const exactlyMinSecret = 'a'.repeat(32); // 정확히 32 바이트
    const env: WebhookBindings = {
      DB: buildFakeDb().db,
      ENVIRONMENT: 'test',
      WEBHOOK_RATE_LIMITER_IP: allowAllLimiter,
      WEBHOOK_HMAC_SECRET_MOCK: exactlyMinSecret,
    };
    const body = buildPayload({ event_id: 'evt_boundary_secret' });
    const sig = await hmacSha256Hex(exactlyMinSecret, body);
    const res = await postWebhook(app, env, body, { 'x-payment-signature': sig });
    expect(res.status).toBe(200);
  });

  it('returns 503 + Retry-After on D1 transient failure', async () => {
    const app = createWebhookRoutes({
      run: async <T>(_fn: () => Promise<T>): Promise<T> => {
        throw new Error('D1_ERROR: Network timeout');
      },
    });
    const env = buildBindings();
    const body = buildPayload({ event_id: 'evt_d1_fail' });
    const sig = await hmacSha256Hex(SECRET, body);
    const res = await postWebhook(app, env, body, { 'x-payment-signature': sig });
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    const json = await res.json();
    expect(json).toEqual({ error: 'SERVICE_UNAVAILABLE' });
  });

  it('returns 413 when ASCII payload exceeds 32KB (byte-based guard, HMAC 이전)', async () => {
    const app = createWebhookRoutes();
    const env = buildBindings();
    const hugePadding = 'x'.repeat(33 * 1024);
    const body = JSON.stringify({
      event_id: 'evt_huge',
      event_type: 'payment.approved',
      padding: hugePadding,
    });
    const sig = await hmacSha256Hex(SECRET, body);
    const res = await postWebhook(app, env, body, { 'x-payment-signature': sig });
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json).toEqual({ error: 'PAYLOAD_TOO_LARGE' });
  });

  it('returns 413 when multibyte payload byte-size exceeds 32KB even if char-length is smaller (C-2 regression)', async () => {
    const app = createWebhookRoutes();
    const env = buildBindings();
    // 한글 1자 = UTF-8 3바이트. 11000자 ≈ 33KB > 32KB.
    // 단 rawBody.length (UTF-16 code units) ≈ 11000 < 32768 → 과거 구현은 통과시킴.
    const multibytePadding = '가'.repeat(11_000);
    const body = JSON.stringify({
      event_id: 'evt_multibyte',
      event_type: 'payment.approved',
      padding: multibytePadding,
    });
    expect(body.length).toBeLessThan(32 * 1024); // char length 는 32KB 미만
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(32 * 1024); // byte 는 32KB 초과
    const sig = await hmacSha256Hex(SECRET, body);
    const res = await postWebhook(app, env, body, { 'x-payment-signature': sig });
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json).toEqual({ error: 'PAYLOAD_TOO_LARGE' });
  });

  it('returns 429 when per-IP rate limit exceeded (C-1 DoS 방어)', async () => {
    const app = createWebhookRoutes();
    const env = buildBindings({ WEBHOOK_RATE_LIMITER_IP: denyAllLimiter });
    const body = buildPayload({ event_id: 'evt_rate_limit' });
    const sig = await hmacSha256Hex(SECRET, body);
    const res = await postWebhook(app, env, body, { 'x-payment-signature': sig });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    const json = await res.json();
    expect(json).toEqual({ error: 'TOO_MANY_REQUESTS' });
  });

  it('returns 400 on empty body', async () => {
    const app = createWebhookRoutes();
    const env = buildBindings();
    const body = '';
    const sig = await hmacSha256Hex(SECRET, body);
    const res = await postWebhook(app, env, body, { 'x-payment-signature': sig });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ error: 'EMPTY_PAYLOAD' });
  });

  it('same body with different signatures: only valid one persists', async () => {
    const app = createWebhookRoutes();
    const fake = buildFakeDb();
    const env = buildBindings({ DB: fake.db });
    const body = buildPayload({ event_id: 'evt_sig_check' });

    // Invalid signature first
    const bad = await postWebhook(app, env, body, { 'x-payment-signature': 'f'.repeat(64) });
    expect(bad.status).toBe(401);
    expect(fake.inserts).toHaveLength(0);

    // Valid signature after
    const validSig = await hmacSha256Hex(SECRET, body);
    const good = await postWebhook(app, env, body, { 'x-payment-signature': validSig });
    expect(good.status).toBe(200);
    expect(fake.inserts).toHaveLength(1);
  });
});
