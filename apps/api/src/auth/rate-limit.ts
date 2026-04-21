/**
 * Cloudflare Rate Limiting API 바인딩 (4-Pass 리뷰 C-5, Step 1-2 M-2/C-1 확장).
 *
 * Workers Rate Limiting API (beta, Free tier 지원).
 * ADR-006 단일 벤더 원칙 준수 — 외부 SaaS 불필요.
 *
 * 정책:
 *   - AUTH_RATE_LIMITER_IP      : per-IP 20 req/60s (register + login 합산)
 *   - AUTH_RATE_LIMITER_EMAIL   : per-email 5 실패/600s (login 만)
 *   - WEBHOOK_RATE_LIMITER_IP   : per-IP 300 req/60s (PG 대량 합법 트래픽 허용 + DoS 차단)
 *
 * 실제 namespace_id 와 limit/period 는 wrangler.toml `[[unsafe.bindings]]`
 * 에 선언.
 *
 * 파일명은 레거시 이유로 `auth/rate-limit.ts` 이지만 webhook 까지 포함한다.
 * (webhook 전용 파일 분리는 over-engineering — 공통 RateLimiter 타입 재사용)
 */

import type { Context } from 'hono';
import { createLogger, type Logger } from '@thepick/shared';

const logger: Logger = createLogger({ service: 'thepick-api' }).child({ module: 'rate-limit' });

/** Cloudflare Rate Limit API 응답. */
interface RateLimitResponse {
  readonly success: boolean;
}

/** Rate Limit binding 인터페이스 (Cloudflare Workers Runtime). */
export interface RateLimiter {
  limit(opts: { readonly key: string }): Promise<RateLimitResponse>;
}

/**
 * 요청에서 클라이언트 IP 추출.
 * CF-Connecting-IP 는 Cloudflare 엣지에서 신뢰 가능한 헤더 (X-Forwarded-For
 * 불신 — 클라이언트 조작 가능).
 */
export function getClientIp(c: Context): string {
  return c.req.raw.headers.get('CF-Connecting-IP') ?? 'unknown';
}

/**
 * 바인딩 미설정 시 처리 정책:
 * - development/test: fail-open (logger.warn 후 통과) — 로컬 개발 편의
 * - staging/production: fail-closed (false 반환) — 프로덕션 오설정 방어
 *
 * 이유: 프로덕션 배포 시 wrangler.toml binding 오타·누락이 발견 전 실제 트래픽을
 * 받으면 rate limit 부재로 brute force 가 통과. 2차 재리뷰 M-1 해소.
 *
 * Step 1-2 M-2: console.* → @thepick/shared logger (PII 자동 마스킹 + 구조화).
 */
function handleMissingBinding(kind: string, env: string | undefined): boolean {
  const isProduction = env === 'production' || env === 'staging';
  if (isProduction) {
    logger.error(`${kind} binding not configured — fail-closed`, undefined, {
      environment: env,
      policy: 'fail-closed',
    });
    return false;
  }
  logger.warn(`${kind} binding not configured — fail-open (dev)`, {
    environment: env ?? 'unknown',
    policy: 'fail-open',
  });
  return true;
}

/**
 * IP 기반 rate limit 체크. 초과 시 429 반환 트리거.
 * 바인딩 미설정 시 환경별 처리 (handleMissingBinding 참조).
 */
export async function checkIpRateLimit(
  limiter: RateLimiter | undefined,
  ip: string,
  environment?: string,
): Promise<boolean> {
  if (limiter === undefined) {
    return handleMissingBinding('AUTH_RATE_LIMITER_IP', environment);
  }
  const { success } = await limiter.limit({ key: ip });
  return success;
}

/**
 * Email 기반 rate limit (login 실패 반복 방어).
 * 같은 이메일에 대한 여러 IP 의 공격도 추적.
 */
export async function checkEmailRateLimit(
  limiter: RateLimiter | undefined,
  email: string,
  environment?: string,
): Promise<boolean> {
  if (limiter === undefined) {
    return handleMissingBinding('AUTH_RATE_LIMITER_EMAIL', environment);
  }
  const { success } = await limiter.limit({ key: `email:${email}` });
  return success;
}

/**
 * Webhook 전용 IP 기반 rate limit (Step 1-2 C-1 해소, D-1-1 DoS 방어).
 *
 * 목적: `/api/webhooks/payment/:provider` 는 HMAC 검증 전에 전체 body 를
 * 암호 연산(Web Crypto importKey + sign)하므로, 공격자가 invalid signature
 * 로 무제한 요청 시 Workers CPU/요금 폭증. per-IP rate limit 으로 방어.
 *
 * 정책: 300 req/60s 는 PG (Toss/PortOne 등) 정상 운영 시 충분하며 (단일 결제
 * 트래픽은 초당 수 건 이내), 공격자 단일 IP 기준으로는 저지 가능한 값.
 *
 * Key: IP 만 사용 (provider 별 분리 X) — 공격자가 provider 를 돌려가며
 * 우회하는 것을 차단. 합법 PG 는 고정 IP 풀에서 들어오므로 영향 없음.
 */
export async function checkWebhookIpRateLimit(
  limiter: RateLimiter | undefined,
  ip: string,
  environment?: string,
): Promise<boolean> {
  if (limiter === undefined) {
    return handleMissingBinding('WEBHOOK_RATE_LIMITER_IP', environment);
  }
  const { success } = await limiter.limit({ key: `webhook:${ip}` });
  return success;
}
