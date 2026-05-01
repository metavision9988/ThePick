/**
 * Telemetry admin-token 게이트 (Phase 1 임시).
 *
 * 본 게이트는 Cloudflare Access (Zero Trust) 정책 등록 전 임시 차단 layer.
 * 진산님 Cloudflare Access 정책 등록 후 별도 ADR + 본 미들웨어 제거 의무.
 *
 * 정책 (handoff-028 Phase B 흡수, v1.1 §10.7 #9):
 *   - admin_session 쿠키 우선 (HttpOnly + Secure + SameSite=Strict — XSS 1건에 토큰 노출 차단)
 *   - X-Admin-Token 헤더 fallback 유지 (server-to-server / curl / BATCH wire-up 호환)
 *   - timing-safe equal — 길이 다른 경우 즉시 거부
 *   - ADMIN_API_TOKEN 환경변수 부재 / 길이 < 16 시 401 마스크 (production 운영 실수 방어)
 *
 * 근거: docs/plans/engine-hardening/step19-observability.plan.md §0.A.1 + §5.3
 *      + ENGINE_HARDENING_COMPLETION_REPORT.md v1.1 §10.7 #9 (Sentinel 권고)
 */

import type { Context, MiddlewareHandler } from 'hono';

export interface AdminTokenBindings {
  readonly ADMIN_API_TOKEN?: string;
  readonly ENVIRONMENT?: string;
}

export const MIN_TOKEN_LENGTH = 16;

/** Phase B — admin-web ↔ apps/api 인증 cookie 이름. */
export const ADMIN_SESSION_COOKIE = 'admin_session';

/** Phase B — login 시 발급되는 쿠키 만료 (24h). Phase 2 Cloudflare Access 도입 후 무관. */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * timing-safe 문자열 비교 (Web Crypto subtle 미사용 — 토큰 길이가 작아 native loop 충분).
 * 길이가 다를 경우 즉시 false 반환은 information leak 가능하나, 운영자가 의도한 토큰을
 * 사용한다면 실제 비교에서만 시간 차이 노출 → MIN_TOKEN_LENGTH 강제로 < 16 차단.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Cookie 헤더 파싱 — RFC 6265 형식 `name1=value1; name2=value2`.
 * 값에 `=` 가 포함될 수 있어 indexOf 기반 splitN(2) 사용.
 */
function parseCookieHeader(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  if (typeof header !== 'string' || header.length === 0) return cookies;
  for (const segment of header.split(';')) {
    const trimmed = segment.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = trimmed.slice(0, eqIdx);
    const value = trimmed.slice(eqIdx + 1);
    if (name.length > 0) cookies.set(name, value);
  }
  return cookies;
}

/**
 * 요청에서 admin token 추출 — 쿠키 우선, 헤더 fallback.
 * 둘 다 부재 시 null. 추출만 하며 검증은 호출 측 담당.
 */
export function extractAdminToken(c: Context): string | null {
  const cookies = parseCookieHeader(c.req.header('Cookie'));
  const fromCookie = cookies.get(ADMIN_SESSION_COOKIE);
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;

  const fromHeader = c.req.header('X-Admin-Token');
  if (typeof fromHeader === 'string' && fromHeader.length > 0) return fromHeader;

  return null;
}

/**
 * Set-Cookie 문자열 생성 — admin_session 쿠키 발급/만료.
 *
 * Phase B 정책:
 *   - HttpOnly: JS 접근 차단 (XSS 1건에 토큰 노출 차단 — Sentinel CRITICAL 흡수)
 *   - SameSite=Strict: CSRF 차단
 *   - Path=/: 전 경로
 *   - Max-Age 86400 (24h): Phase 2 Cloudflare Access 도입 전 임시 만료
 *   - Secure: production / staging 만 (dev http://localhost 호환)
 *
 * @param value 쿠키 값 (login = 토큰 자체, logout = 빈 문자열)
 * @param maxAgeSeconds 0 = 즉시 만료(logout), 86400 = 24h(login)
 * @param environment ENVIRONMENT 환경변수 (dev/staging/production/test)
 */
export function buildAdminSessionCookie(
  value: string,
  maxAgeSeconds: number,
  environment: string | undefined,
): string {
  const isSecureEnv = environment === 'production' || environment === 'staging';
  const parts: string[] = [
    `${ADMIN_SESSION_COOKIE}=${value}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (isSecureEnv) parts.push('Secure');
  return parts.join('; ');
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
    const provided = extractAdminToken(c);
    if (provided === null || !timingSafeEqual(provided, expected)) {
      return c.json({ error: 'UNAUTHORIZED' }, 401);
    }
    return next();
  };
}
