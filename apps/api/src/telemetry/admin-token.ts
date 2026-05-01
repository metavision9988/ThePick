/**
 * Telemetry admin-token 게이트 (Phase 1 임시).
 *
 * 본 게이트는 Cloudflare Access (Zero Trust) 정책 등록 전 임시 차단 layer.
 * 진산님 Cloudflare Access 정책 등록 후 별도 ADR + 본 미들웨어 제거 의무.
 *
 * 정책:
 *   - X-Admin-Token 헤더 비교 (timing-safe equal — 길이 다른 경우 즉시 거부)
 *   - ADMIN_API_TOKEN 환경변수 부재 시 503 (production 운영 실수 방어)
 *   - 토큰 길이 < 16 시 환경변수 misconfiguration → 503 (test 토큰 production 누출 방어)
 *
 * 근거: docs/plans/engine-hardening/step19-observability.plan.md §0.A.1 + §5.3
 */

import type { MiddlewareHandler } from 'hono';

export interface AdminTokenBindings {
  readonly ADMIN_API_TOKEN?: string;
}

const MIN_TOKEN_LENGTH = 16;

/**
 * timing-safe 문자열 비교 (Web Crypto subtle 미사용 — 토큰 길이가 작아 native loop 충분).
 * 길이가 다를 경우 즉시 false 반환은 information leak 가능하나, 운영자가 의도한 토큰을
 * 사용한다면 실제 비교에서만 시간 차이 노출 → MIN_TOKEN_LENGTH 강제로 < 16 차단.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Hono 미들웨어. 본 미들웨어를 통과한 요청은 ADMIN_API_TOKEN 검증 완료 상태.
 * 토큰 부재/오 응답 시 401 (information leak 방지 — 토큰 misconfiguration 도 401 마스크).
 */
export function requireAdminToken<
  E extends { Bindings: AdminTokenBindings } = { Bindings: AdminTokenBindings },
>(): MiddlewareHandler<E> {
  return async (c, next) => {
    const expected = c.env.ADMIN_API_TOKEN;
    if (typeof expected !== 'string' || expected.length < MIN_TOKEN_LENGTH) {
      // 환경변수 부재/짧음 = production misconfig. 401 로 마스크 (운영자 의도와 무관하게 거부).
      return c.json({ error: 'UNAUTHORIZED' }, 401);
    }
    const provided = c.req.header('X-Admin-Token');
    if (typeof provided !== 'string' || !timingSafeEqual(provided, expected)) {
      return c.json({ error: 'UNAUTHORIZED' }, 401);
    }
    return next();
  };
}
