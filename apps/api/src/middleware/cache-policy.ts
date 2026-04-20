/**
 * Cache-Control 헤더 자동 주입 미들웨어 (ADR-008 §8).
 *
 * L1 Edge Cache 보안 경계 강제:
 *   - 사용자별 경로(`/api/auth/*`, `/api/user/*`, `/api/progress/*`, `/api/payment/*`)
 *     → `Cache-Control: private, no-store` + `Vary: Authorization, Cookie`
 *   - 공용 경로(`/api/content/*`, `/api/search/*`)
 *     → `Cache-Control: public, max-age=N`
 *   - 기타 경로 → 기본값(헤더 미설정, 응답 생성 측 책임)
 *
 * 근거:
 *   - ADR-008 §8 L1 Edge Cache 헤더 정책
 *   - ARCHITECTURE.md §7 Hard Limit (사용자 데이터 공유 캐시 금지)
 *   - Devil's Advocate 시나리오 차단 (Alice→Bob 응답 바디 leak)
 */

import type { Context, MiddlewareHandler, Next } from 'hono';

/** 사용자별 경로 prefix. private no-store 강제. */
const PRIVATE_PATH_PREFIXES: readonly string[] = [
  '/api/auth/',
  '/api/user/',
  '/api/progress/',
  '/api/payment/',
];

/** 공용 경로 TTL 매핑 (초). */
const PUBLIC_PATH_TTL_SECONDS: ReadonlyArray<{ readonly prefix: string; readonly ttl: number }> = [
  { prefix: '/api/content/', ttl: 300 },
  { prefix: '/api/search/', ttl: 60 },
];

/**
 * Hono 미들웨어 — 응답 직전 Cache-Control 헤더 주입.
 *
 * 순서 중요: `app.use('*', cachePolicyMiddleware())` 를 **마지막** 미들웨어로 등록하면
 * route handler 가 설정한 Cache-Control 을 덮어쓴다. 보안 정책이 개별 핸들러 실수를
 * 커버해야 하므로 **덮어쓰기가 의도적** 이다.
 */
export function cachePolicyMiddleware(): MiddlewareHandler {
  return async (c: Context, next: Next): Promise<void> => {
    await next();
    applyCachePolicy(c);
  };
}

function applyCachePolicy(c: Context): void {
  const path = new URL(c.req.url).pathname;

  if (isPrivatePath(path)) {
    c.header('Cache-Control', 'private, no-store');
    c.header('Vary', 'Authorization, Cookie');
    return;
  }

  const publicMatch = matchPublicPath(path);
  if (publicMatch !== undefined) {
    c.header('Cache-Control', `public, max-age=${publicMatch.ttl}`);
    return;
  }

  // 기본 floor (4-Pass C-4): 매칭 실패한 경로 — 404 포함 — 는 shared cache 금지.
  // 개별 라우트가 명시적 캐시 원하면 `public, max-age=...` 로 이 값을 덮어쓰면 됨.
  c.header('Cache-Control', 'no-store');
}

function isPrivatePath(path: string): boolean {
  for (const prefix of PRIVATE_PATH_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

function matchPublicPath(
  path: string,
): { readonly prefix: string; readonly ttl: number } | undefined {
  for (const rule of PUBLIC_PATH_TTL_SECONDS) {
    if (path.startsWith(rule.prefix)) return rule;
  }
  return undefined;
}
