/**
 * Payment Webhook Receiver (L3 Fortress) — Phase 1 Step 1-2 Replay/Idempotency.
 *
 * 엔드포인트:
 *   - POST /api/webhooks/payment/:provider
 *
 * Phase 1 Step 1-2 범위 (인프라만):
 *   - HMAC-SHA256 서명 검증 (timing-safe compare, Web Crypto)
 *   - 원본 payload + event_id 영속화 (webhook_events 테이블)
 *   - UNIQUE (provider, event_id) = Replay 공격 차단
 *   - Write-path 503 + Retry-After (ADR-008 §5)
 *   - 구조화 로깅 (@thepick/shared logger, PII 자동 마스킹)
 *
 * Phase 3 실구현 (본 파일 범위 외):
 *   - PaymentProvider.verifyWebhook 호출
 *   - subscription/payment_events 테이블 반영
 *   - 사용자 구독 상태 갱신
 *
 * 설계 근거:
 *   - ADR-002 §Migrations 연결 — webhook 수신 로그 PG-중립 분리
 *   - ADR-006 Cloudflare 단일 벤더 (Web Crypto only, 외부 HMAC 라이브러리 금지)
 *   - ADR-008 §5 Write-path 503 + §6 Graceful Degradation 메시지
 *   - ADR-009 PII 마스킹 (payload 원본 저장 주의: PG 어댑터가 PCI-DSS 마스킹 선행)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createLogger, type Logger, type LoggerEnvironment } from '@thepick/shared';
import { timingSafeEqual } from '../auth/password.js';
import { checkWebhookIpRateLimit, getClientIp, type RateLimiter } from '../auth/rate-limit.js';
import { D1_UNIQUE_CONSTRAINT_PATTERN, withRetry } from '../middleware/retry.js';

/** 지원 PG. schema.ts WEBHOOK_PROVIDERS 과 동기화 필수. */
const SUPPORTED_PROVIDERS = ['mock', 'polar', 'portone', 'tosspayments'] as const;
type WebhookProvider = (typeof SUPPORTED_PROVIDERS)[number];

/** Provider 별 HMAC 서명 secret 환경변수 키. */
const WEBHOOK_SECRET_ENV_KEYS: Readonly<Record<WebhookProvider, string>> = {
  mock: 'WEBHOOK_HMAC_SECRET_MOCK',
  polar: 'WEBHOOK_HMAC_SECRET_POLAR',
  portone: 'WEBHOOK_HMAC_SECRET_PORTONE',
  tosspayments: 'WEBHOOK_HMAC_SECRET_TOSSPAYMENTS',
};

/** HMAC hex 문자열 길이 (SHA-256 = 32바이트 = 64 hex chars). */
const HMAC_SHA256_HEX_LENGTH = 64;

/**
 * Webhook HMAC secret 최소 길이 (Step 1-3 M-4, D-3-1 해소).
 *
 * 32 = HMAC-SHA256 key entropy 하한 (256-bit). 이보다 짧은 secret (예: "test",
 * "abc123") 이 주입되면 공격자가 전수 조사로 valid HMAC 생성 가능.
 * 모든 환경에서 fail-closed (500 WEBHOOK_WEAK_SECRET).
 *
 * 측정 단위 주의 (Step 1-3 D-3 Minor): `secret.length` 는 UTF-16 code unit 수.
 * ASCII 운영 정책에서는 `length === UTF-8 byte`. 비-ASCII (한글/이모지) secret
 * 운영 시 length 는 code unit 이므로 실제 byte 는 더 크며 entropy 충분.
 * 상수명 `_BYTES` 는 ASCII 전제 — `wrangler secret put` 운영 가이드에 ASCII 권장.
 */
const MIN_WEBHOOK_SECRET_BYTES = 32;

/** webhook payload 최대 크기 — 32KB (ADR-002 §PaymentEvent.rawPayload 주석 권고). */
const PAYLOAD_MAX_BYTES = 32 * 1024;

/** event_id 필드 최대 길이. */
const EVENT_ID_MAX_LENGTH = 128;

/** event_type 필드 최대 길이. */
const EVENT_TYPE_MAX_LENGTH = 64;

const KNOWN_ENVIRONMENTS: ReadonlySet<LoggerEnvironment> = new Set<LoggerEnvironment>([
  'development',
  'staging',
  'production',
  'test',
]);

export interface WebhookBindings {
  readonly DB: D1Database;
  readonly ENVIRONMENT?: string;
  /**
   * per-IP webhook rate limiter (Step 1-2 C-1 — D-1-1 DoS 방어).
   * 미설정 시 dev fail-open / staging+production fail-closed (rate-limit.ts).
   */
  readonly WEBHOOK_RATE_LIMITER_IP?: RateLimiter;
  /**
   * Provider 별 HMAC secret. wrangler.toml `[vars]` 또는 `wrangler secret put` 경유 주입.
   * 미설정 시 해당 provider 요청은 500 (fail-closed).
   */
  readonly WEBHOOK_HMAC_SECRET_MOCK?: string;
  readonly WEBHOOK_HMAC_SECRET_POLAR?: string;
  readonly WEBHOOK_HMAC_SECRET_PORTONE?: string;
  readonly WEBHOOK_HMAC_SECRET_TOSSPAYMENTS?: string;
}

const webhookPayloadSchema = z
  .object({
    event_id: z.string().min(1).max(EVENT_ID_MAX_LENGTH).optional(),
    event_type: z.string().min(1).max(EVENT_TYPE_MAX_LENGTH),
  })
  .passthrough();

function resolveLoggerEnv(envName: string | undefined): LoggerEnvironment {
  return envName !== undefined && KNOWN_ENVIRONMENTS.has(envName as LoggerEnvironment)
    ? (envName as LoggerEnvironment)
    : 'development';
}

function buildLogger(env: WebhookBindings): Logger {
  return createLogger({
    service: 'thepick-api',
    environment: resolveLoggerEnv(env.ENVIRONMENT),
  }).child({ module: 'webhooks/payment' });
}

function isSupportedProvider(value: string): value is WebhookProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Provider 별 HMAC secret 조회. 미설정 시 undefined → fail-closed (500).
 *
 * secret 자체는 절대 로그/응답에 노출하지 않는다 (AppError 메시지도 금지).
 */
function getSecret(env: WebhookBindings, provider: WebhookProvider): string | undefined {
  const key = WEBHOOK_SECRET_ENV_KEYS[provider];
  return env[key as keyof WebhookBindings] as string | undefined;
}

/**
 * HMAC-SHA256(secret, body) → hex 문자열.
 * Web Crypto only — Workers/Node/Vitest 모두 호환.
 */
async function computeHmacSha256Hex(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const bytes = new Uint8Array(sig);
  let hex = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * 서명 형식·길이 → bytes 디코드 실패도 timing-safe 하게 처리.
 * 길이 불일치 / 비-hex 는 dummy compare 수행 후 false.
 */
async function verifySignature(
  secret: string,
  rawBody: string,
  providedHex: string,
): Promise<boolean> {
  // defense in depth: 호출 측 체크(getSecret, length > 0)를 신뢰하지 않는다.
  // 빈 secret 으로 HMAC 계산 시 Web Crypto 는 고정 결과를 반환하므로
  // 공격자가 사전 계산한 서명을 통과시킬 수 있다.
  if (secret.length === 0) return false;

  const expectedHex = await computeHmacSha256Hex(secret, rawBody);
  const expectedBytes = hexToBytes(expectedHex);
  if (expectedBytes === null) return false;

  const providedBytes =
    providedHex.length === HMAC_SHA256_HEX_LENGTH ? hexToBytes(providedHex) : null;

  if (providedBytes === null) {
    // timing-safe dummy compare — 길이/형식 불일치도 정상 경로와 동일 CPU 소비
    timingSafeEqual(expectedBytes, new Uint8Array(expectedBytes.byteLength));
    return false;
  }
  return timingSafeEqual(expectedBytes, providedBytes);
}

interface RouteDeps {
  /** D1 prepare/run 재시도 정책 — 테스트에서 주입 가능. */
  readonly run?: typeof defaultRun;
}

async function defaultRun<T>(fn: () => Promise<T>): Promise<T> {
  const result = await withRetry(fn);
  return result.value;
}

interface ParsedPayload {
  readonly eventType: string;
  readonly idempotencyKey: string;
}

/**
 * 전용 에러 — 호출자 측 400/401 응답 분기용.
 */
class WebhookParseError extends Error {
  constructor(
    public readonly httpStatus: 400 | 401,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'WebhookParseError';
  }
}

function parseAndValidate(
  rawBody: string,
  idempotencyHeader: string | null | undefined,
): ParsedPayload {
  if (rawBody.length === 0) {
    throw new WebhookParseError(400, 'EMPTY_PAYLOAD', 'empty body');
  }
  // byte-based size guard 는 라우트 진입부에서 arrayBuffer.byteLength 로 수행됨.
  // 여기서는 해당 없음 (rawBody 는 이미 검증된 decoded 문자열).

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    throw new WebhookParseError(400, 'INVALID_JSON', 'JSON parse failed');
  }

  const zodResult = webhookPayloadSchema.safeParse(parsedJson);
  if (!zodResult.success) {
    throw new WebhookParseError(400, 'INVALID_PAYLOAD', 'Zod validation failed');
  }

  const bodyEventId = zodResult.data.event_id;
  const headerEventId =
    idempotencyHeader !== null && idempotencyHeader !== undefined ? idempotencyHeader.trim() : '';
  const idempotencyKey = bodyEventId ?? (headerEventId.length > 0 ? headerEventId : null);

  if (idempotencyKey === null) {
    throw new WebhookParseError(
      400,
      'MISSING_IDEMPOTENCY_KEY',
      'event_id in body or Idempotency-Key header required',
    );
  }
  if (idempotencyKey.length > EVENT_ID_MAX_LENGTH) {
    throw new WebhookParseError(
      400,
      'IDEMPOTENCY_KEY_TOO_LONG',
      `exceeded ${EVENT_ID_MAX_LENGTH} chars`,
    );
  }

  return {
    eventType: zodResult.data.event_type,
    idempotencyKey,
  };
}

export function createWebhookRoutes(deps: RouteDeps = {}): Hono<{ Bindings: WebhookBindings }> {
  const router = new Hono<{ Bindings: WebhookBindings }>();
  const run = deps.run ?? defaultRun;

  router.post('/payment/:provider', async (c) => {
    const logger = buildLogger(c.env);
    const providerParam = c.req.param('provider');

    if (!isSupportedProvider(providerParam)) {
      return c.json({ error: 'UNKNOWN_PROVIDER' }, 400);
    }
    const provider: WebhookProvider = providerParam;
    const reqLog = logger.child({ provider });

    // [C-1] 가장 먼저 per-IP rate limit 체크 — HMAC 계산 이전에 차단하여
    //       공격자가 암호 연산 CPU 를 소비하지 못하도록.
    const ip = getClientIp(c);
    const ipAllowed = await checkWebhookIpRateLimit(
      c.env.WEBHOOK_RATE_LIMITER_IP,
      ip,
      c.env.ENVIRONMENT,
      reqLog,
    );
    if (!ipAllowed) {
      reqLog.warn('webhook rate limit exceeded', { ip });
      c.header('Retry-After', '60');
      return c.json({ error: 'TOO_MANY_REQUESTS' }, 429);
    }

    const secret = getSecret(c.env, provider);
    if (secret === undefined || secret.length === 0) {
      // fail-closed — 운영자 주입 누락 시 요청 거부. secret 내용 절대 로깅 금지.
      reqLog.error('webhook secret not configured', undefined, {
        envKey: WEBHOOK_SECRET_ENV_KEYS[provider],
      });
      return c.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, 500);
    }
    // M-4 — secret 길이 하한 검증. 약한 secret 은 공격자가 전수 조사 가능.
    //       secret 내용/길이 절대 로그에 기록 금지 (envKey 만).
    if (secret.length < MIN_WEBHOOK_SECRET_BYTES) {
      reqLog.error('webhook secret below minimum length', undefined, {
        envKey: WEBHOOK_SECRET_ENV_KEYS[provider],
        minBytes: MIN_WEBHOOK_SECRET_BYTES,
      });
      return c.json({ error: 'WEBHOOK_WEAK_SECRET' }, 500);
    }

    // [C-2] byte-based size guard — HMAC 연산 이전에 수행하여 CPU amplification 방어.
    //       String.length 는 UTF-16 code unit 수이므로 멀티바이트 payload 가
    //       32KB 제한을 우회할 수 있다. arrayBuffer 로 실제 바이트 측정.
    const bodyBuffer = await c.req.arrayBuffer();
    if (bodyBuffer.byteLength > PAYLOAD_MAX_BYTES) {
      reqLog.warn('webhook payload rejected', {
        code: 'PAYLOAD_TOO_LARGE',
        httpStatus: 413,
        bodyBytes: bodyBuffer.byteLength,
      });
      return c.json({ error: 'PAYLOAD_TOO_LARGE' }, 413);
    }
    const rawBody = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false }).decode(bodyBuffer);

    const signatureHeader = c.req.header('x-payment-signature');
    const idempotencyHeader = c.req.header('idempotency-key');

    // 서명 검증은 항상 full HMAC 계산을 수행하여 timing leak 차단.
    // 서명 없음도 "빈 문자열" 로 간주하여 dummy compare 진입.
    const providedSignature = signatureHeader ?? '';
    const signatureValid = await verifySignature(secret, rawBody, providedSignature);

    if (!signatureValid) {
      reqLog.warn('webhook signature rejected', {
        hasHeader: signatureHeader !== undefined && signatureHeader.length > 0,
        bodyBytes: bodyBuffer.byteLength,
      });
      return c.json({ error: 'INVALID_SIGNATURE' }, 401);
    }

    let parsed: ParsedPayload;
    try {
      parsed = parseAndValidate(rawBody, idempotencyHeader ?? null);
    } catch (err) {
      if (err instanceof WebhookParseError) {
        reqLog.warn('webhook payload rejected', {
          code: err.errorCode,
          httpStatus: err.httpStatus,
          bodyBytes: bodyBuffer.byteLength,
        });
        return c.json({ error: err.errorCode }, err.httpStatus);
      }
      // 예상 외 throw → 500 + 로깅. silent drop 금지.
      reqLog.error('webhook parse unexpected error', err);
      return c.json({ error: 'INTERNAL_ERROR' }, 500);
    }

    const rowId = crypto.randomUUID();

    try {
      await run(() =>
        c.env.DB.prepare(
          `INSERT INTO webhook_events (id, provider, event_id, event_type, payload, signature, status)
           VALUES (?, ?, ?, ?, ?, ?, 'received')`,
        )
          .bind(
            rowId,
            provider,
            parsed.idempotencyKey,
            parsed.eventType,
            rawBody,
            providedSignature,
          )
          .run(),
      );
    } catch (err) {
      // M-8: retry.ts 의 NON_RETRYABLE 패턴과 공유 상수 사용 (silent drift 방지).
      if (err instanceof Error && D1_UNIQUE_CONSTRAINT_PATTERN.test(err.message)) {
        // Replay — 동일 (provider, event_id) 재수신.
        reqLog.info('webhook replay detected', {
          eventType: parsed.eventType,
          idempotencyKey: parsed.idempotencyKey,
        });
        return c.json({ ok: true, replayed: true }, 200);
      }
      reqLog.error('webhook persist failed', err, {
        eventType: parsed.eventType,
        idempotencyKey: parsed.idempotencyKey,
      });
      c.header('Retry-After', '30');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }

    reqLog.info('webhook received', {
      eventType: parsed.eventType,
      idempotencyKey: parsed.idempotencyKey,
      rowId,
    });
    return c.json({ ok: true, replayed: false, id: rowId }, 200);
  });

  return router;
}
