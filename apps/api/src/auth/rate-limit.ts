/**
 * Cloudflare Rate Limiting API 바인딩 (4-Pass 리뷰 C-5).
 *
 * Workers Rate Limiting API (beta, Free tier 지원).
 * ADR-006 단일 벤더 원칙 준수 — 외부 SaaS 불필요.
 *
 * 정책 (auth 전용):
 *   - AUTH_RATE_LIMITER_IP: per-IP 20 req/60s (register + login 합산)
 *   - AUTH_RATE_LIMITER_EMAIL: per-email 5 실패/600s (login 만)
 *
 * 실제 namespace_id 와 limit/period 는 wrangler.toml `[[unsafe.bindings]]`
 * 에 선언.
 */

import type { Context } from 'hono';

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
 * - development/test: fail-open (console.warn 로깅 후 통과) — 로컬 개발 편의
 * - staging/production: fail-closed (false 반환) — 프로덕션 오설정 방어
 *
 * 이유: 프로덕션 배포 시 wrangler.toml binding 오타·누락이 발견 전 실제 트래픽을
 * 받으면 rate limit 부재로 brute force 가 통과. 2차 재리뷰 M-1 해소.
 */
function handleMissingBinding(kind: string, env: string | undefined): boolean {
  const isProduction = env === 'production' || env === 'staging';
  if (isProduction) {
    console.error(`[rate-limit] ${kind} binding not configured in ${env} — fail-closed`);
    return false;
  }
  console.warn(
    `[rate-limit] ${kind} binding not configured in ${env ?? 'unknown'} — fail-open (dev)`,
  );
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
