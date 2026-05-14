/**
 * CORS 정책 상수 — single source for production + mock.
 *
 * 5-페르소나 backend C1+C2 흡수 (Session 077, 2026-05-14) — ADR-040 §8 다음 chunk #1.
 *
 * **drift 방지 원칙:** apps/api (production)와 apps/web/e2e/mock-server (E2E mock) 양쪽이
 * 본 상수를 단일 source로 import. 양쪽 리터럴 분리는 mock이 production보다 "넉넉히" 풀어줘서
 * E2E 녹색 → production 첫 cross-origin 배포에서 preflight block silent miss 유발.
 *
 * **fetch spec WD-2024 정합:** credentialed request (credentials: 'include')에서
 *   - `Access-Control-Allow-Headers: '*'` wildcard 무효 → 명시 enumeration 필수
 *   - `Access-Control-Allow-Origin: '*'` 무효 → 명시 origin 또는 동적 echo 필수
 *   - `Access-Control-Expose-Headers: '*'` 무효 → 명시 enumeration 필수
 *
 * Hono cors middleware option type과 호환 (string[] vs ReadonlyArray<string>):
 *   - `[...CORS_ALLOWED_HEADERS_BASE]` 형태로 spread하여 mutable 복사본 전달.
 */

/**
 * HTTP method allowlist — 인증/학습/관리자 라우트 공통.
 *
 * PUT/DELETE는 본 시스템 contract 외 (Temporal Graph INSERT + SUPERSEDES 패턴).
 * 향후 RESTful UPDATE/DELETE endpoint 도입 시 본 상수 명시 추가 + ADR.
 */
export const CORS_ALLOWED_METHODS: readonly ['GET', 'POST', 'OPTIONS'] = [
  'GET',
  'POST',
  'OPTIONS',
] as const;

/**
 * 인증/학습/공개 라우트 공통 헤더 — 기본 fetch.
 *
 * - Content-Type: application/json POST 본문 + multipart 업로드 대비
 * - Authorization: Bearer scheme 향후 헤더 기반 인증 대비 (현재는 cookie 기반)
 *
 * `Cookie`는 fetch spec forbidden request-header이라 client 명시 불가 → 등재 X.
 */
export const CORS_ALLOWED_HEADERS_BASE: readonly ['Content-Type', 'Authorization'] = [
  'Content-Type',
  'Authorization',
] as const;

/**
 * 관리자 라우트 추가 헤더 — base에 더해 X-Admin-Token.
 *
 * `/api/telemetry/*`, `/api/admin/vectorize/*` 적용 (Step 19 MAJOR-AD-1 / Session 056).
 * Phase 1 임시 — Cloudflare Access 도입 시 제거 (admin-token.ts 정합).
 */
export const CORS_ALLOWED_HEADERS_ADMIN_TOKEN: readonly [
  'Content-Type',
  'Authorization',
  'X-Admin-Token',
] = ['Content-Type', 'Authorization', 'X-Admin-Token'] as const;

/**
 * Response 헤더 expose allowlist — client JS가 접근 가능한 헤더.
 *
 * - Retry-After: 429 rate-limit 응답에서 client retry/back-off 로직용 (현 QuestionCard.tsx:141은
 *   status만 보고 헤더 무시 — ADR-040 §6 carry-over. 향후 client retry 도입 시 활용).
 *
 * `Content-Type`, `Content-Length`는 fetch spec safe-CORS-response-header이라 자동 expose → 등재 불요.
 */
export const CORS_EXPOSED_HEADERS: readonly ['Retry-After'] = ['Retry-After'] as const;

/**
 * Preflight 캐시 시간 (초). 600s = 10분 — 일반적 production 값.
 *
 * mock-server는 캐시 비활성 (0) 권고 — spec test 격리 + dev 빠른 변경 감지.
 */
export const CORS_MAX_AGE_SECONDS = 600;
