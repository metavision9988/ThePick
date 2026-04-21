/**
 * JWT 세션 상수 (Phase 1 Step 1-4 — ADR-005 §Addendum).
 *
 * Access JWT (HS256) + Refresh Token (opaque, D1-backed, rotation) 하이브리드.
 * 본 상수는 `apps/api/src/auth/session.ts` 및 클라이언트 PWA (Phase 2+) 공용.
 */

/** Access JWT TTL — 15분 (stateless 검증, 만료 시 /api/auth/refresh 호출). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Refresh Token TTL — 30일 (D1-backed, rotation). */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Access Token 쿠키 이름. Path=/api (API 경로 전체에서 유효). */
export const ACCESS_TOKEN_COOKIE = 'tp_access';

/** Refresh Token 쿠키 이름. Path=/api/auth (auth 라우트 제한). */
export const REFRESH_TOKEN_COOKIE = 'tp_refresh';

/** 쿠키 Path 속성. */
export const ACCESS_TOKEN_COOKIE_PATH = '/api';
export const REFRESH_TOKEN_COOKIE_PATH = '/api/auth';

/**
 * JWT 서명 키 최소 길이 (HS256 entropy 하한, Step 1-3 M-4 동일 원칙).
 * 운영자가 짧은 secret 주입 시 fail-closed.
 */
export const MIN_JWT_SECRET_BYTES = 32;

/**
 * IP 해시 pepper 최소 길이. D1 덤프만으로 IP 역산 불가하도록 Cloudflare secret 저장.
 */
export const MIN_IP_PEPPER_BYTES = 32;

/** JWT 알고리즘 (HS256 고정 — 대칭 키, Cloudflare Workers Web Crypto 호환). */
export const JWT_ALG = 'HS256' as const;

/** Refresh Token 바이트 수 (crypto.getRandomValues → base64url). 32B = 256-bit. */
export const REFRESH_TOKEN_BYTES = 32;

/**
 * Access Token 검증 시 clock skew 허용폭 (서버/클라이언트 시간 불일치 완화).
 * iat / exp 검증에 ±60s leeway.
 */
export const JWT_CLOCK_SKEW_SECONDS = 60;

/** User-Agent 헤더 저장 시 잘림 길이 (감사용, 과도 저장 방지). */
export const USER_AGENT_MAX_LENGTH = 256;

/** Refresh token reuse 감지 시 전체 사용자 세션 파기 여부 (보안 기본값). */
export const REFRESH_REUSE_REVOKE_ALL = true;

/**
 * Rotation grace window (초) — reuse detection false positive 방어.
 *
 * 네트워크 재시도 / React 18 Strict Mode / SPA 중복 마운트 시 같은 refresh token
 * 이 잠깐 사이 2회 POST 되는 것이 현실 (OAuth 2.0 Security BCP §4.12.1).
 * rotation 직후 60초 이내 revoked token 재사용은 "방금 rotation 된 것을 또 전송"
 * 으로 판단하여 전체 세션 파기 대신 401+clear-cookie 만 반환.
 * 실제 공격자 탈취 재사용은 대부분 60초를 넘는다 (토큰 분석 시간 소요).
 */
export const REFRESH_ROTATION_GRACE_SECONDS = 60;
