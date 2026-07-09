/**
 * public/rate-limit — 무인증 공개 표면 IP rate limit (해시 IP 키, PII 0).
 *
 * 전용 네임스페이스 `PUBLIC_RATE_LIMITER_IP`(wrangler unsafe binding) 사용 —
 * D1 `rate_limits` 는 (user_id, bucket) PK 전제라 무인증 표면에 부적합(지뢰 #6).
 * 키 = **SHA-256(IP || IP_PEPPER)** — 원문 IP 미보관(PII 최소화, G-1 정합).
 * 바인딩 미설정 시 auth 와 동일 fail-open(dev)/fail-closed(prod) 정책 재사용.
 */

import type { Logger } from '@thepick/shared';
import { handleMissingBinding, type RateLimiter } from '../auth/rate-limit.js';
import { hashIp } from '../auth/session.js';

/**
 * 공개 표면 per-IP rate limit. 초과 시 false → 호출 측 429.
 *
 * @param pepper IP_PEPPER — 미설정 시 `public:<ip>` raw 키 폴백(dev 편의, 여전히 per-IP).
 */
export async function checkPublicIpRateLimit(
  limiter: RateLimiter | undefined,
  ip: string,
  pepper: string | undefined,
  environment: string | undefined,
  logger: Logger,
): Promise<boolean> {
  if (limiter === undefined) {
    return handleMissingBinding('PUBLIC_RATE_LIMITER_IP', environment, logger);
  }
  const key =
    pepper !== undefined && pepper.length > 0
      ? `public:${await hashIp(ip, pepper)}`
      : `public:${ip}`;
  const { success } = await limiter.limit({ key });
  return success;
}
