/**
 * Access Token 검증 미들웨어 (Phase 1 Step 1-4 — ADR-005 §Addendum).
 *
 * 쿠키 `tp_access` 에서 JWT 를 읽어 검증 후 `c.set('userId', ...)` / `c.set('sessionId', ...)`.
 * 실패 시 401 + `WWW-Authenticate: Bearer`.
 *
 * ADR-008 §8 준수: 인증 라우트 응답에 `Cache-Control: private, no-store`, `Vary: Cookie`
 * 적용은 상위 `cachePolicyMiddleware` 가 담당. 본 미들웨어는 header 조작 없음.
 */

import type { Context, MiddlewareHandler, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Logger } from '@thepick/shared';
import { ACCESS_TOKEN_COOKIE } from '@thepick/shared';
import { verifyAccessToken } from '../session.js';

/**
 * `c.var.userId`, `c.var.sessionId` 를 downstream handler 에서 사용.
 * Hono 의 타입 추론을 위해 `Variables` generic 에 병합 필요.
 */
export interface RequireAuthVariables {
  readonly userId: string;
  readonly sessionId: string;
}

export interface RequireAuthEnv {
  readonly Bindings: {
    readonly JWT_SECRET?: string;
    readonly ENVIRONMENT?: string;
  };
  readonly Variables: RequireAuthVariables;
}

/**
 * require-auth 미들웨어 팩토리.
 * @param logger request-scoped logger 주입 (Step 1-3 M-5 원칙 — 모듈 레벨 logger 금지).
 */
export function requireAuth(logger: Logger): MiddlewareHandler<RequireAuthEnv> {
  return async (c: Context<RequireAuthEnv>, next: Next) => {
    const secret = c.env.JWT_SECRET;
    if (secret === undefined || secret.length === 0) {
      // fail-closed: secret 미주입 시 인증 불가 상태로 간주. secret 내용 로그 금지.
      logger.error('JWT_SECRET not configured — require-auth fail-closed');
      c.header('WWW-Authenticate', 'Bearer');
      return c.json({ error: 'AUTH_NOT_CONFIGURED' }, 500);
    }

    const token = getCookie(c, ACCESS_TOKEN_COOKIE);
    if (token === undefined || token.length === 0) {
      c.header('WWW-Authenticate', 'Bearer');
      return c.json({ error: 'UNAUTHORIZED' }, 401);
    }

    const result = await verifyAccessToken(token, secret);
    if (!result.ok) {
      // 사유별 로그 레벨 — expired 는 정상 흐름, invalid/malformed 는 의심 신호.
      if (result.reason === 'expired') {
        logger.info('access token expired');
      } else {
        logger.warn('access token rejected', { reason: result.reason });
      }
      c.header('WWW-Authenticate', 'Bearer');
      return c.json({ error: 'UNAUTHORIZED', reason: result.reason }, 401);
    }

    c.set('userId', result.payload.sub);
    c.set('sessionId', result.payload.sid);
    await next();
    return;
  };
}
