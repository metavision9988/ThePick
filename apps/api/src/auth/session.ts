/**
 * JWT Access Token + Refresh Session (Phase 1 Step 1-4 — ADR-005 §Addendum).
 *
 * Access Token:
 *   - HS256 JWT, 15분 TTL
 *   - payload: `{ sub: userId, sid: sessionId, iat, exp }`
 *   - stateless 검증 (`hono/utils/jwt` + Clock skew 60s leeway)
 *
 * Refresh Token:
 *   - 32-byte opaque, base64url, 30일 TTL
 *   - D1 `sessions` 테이블에 SHA-256 해시만 저장 (원본 미저장)
 *   - Rotation: 매 refresh 시 이전 session.revoked_at UPDATE + 새 session INSERT
 *   - Reuse detection: revoked session 의 refresh token 재사용 감지 시 전체 사용자 세션 파기
 *
 * 보안 원칙:
 *   - JWT secret 길이 하한 32B (Step 1-3 M-4 동일 원칙, `MIN_JWT_SECRET_BYTES`)
 *   - IP 는 SHA-256(ip + IP_PEPPER) 해시만 저장 (PII 최소화)
 *   - secret/token 본문 절대 로그 미기록
 */

import { sign, verify, decode } from 'hono/utils/jwt/jwt';
import { JwtTokenSignatureMismatched, JwtTokenInvalid } from 'hono/utils/jwt/types';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_ALG,
  JWT_CLOCK_SKEW_SECONDS,
  MIN_JWT_SECRET_BYTES,
  REFRESH_ROTATION_GRACE_SECONDS,
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_TTL_SECONDS,
  USER_AGENT_MAX_LENGTH,
} from '@thepick/shared';

/** Access JWT payload — minimal by design. 추가 클레임은 downstream 조회로 획득. */
export interface AccessTokenPayload {
  readonly sub: string; // user_id
  readonly sid: string; // session_id
  readonly iat: number;
  readonly exp: number;
}

/** verifyAccessToken 결과 — 명시적 실패 사유 전달. */
export type AccessTokenVerifyResult =
  | { readonly ok: true; readonly payload: AccessTokenPayload }
  | { readonly ok: false; readonly reason: 'invalid' | 'expired' | 'malformed' };

/**
 * JWT secret 검증 (호출 측 fail-closed 방어).
 * 빈 문자열/undefined/짧은 secret 은 즉시 에러.
 */
export function assertJwtSecret(secret: string | undefined): asserts secret is string {
  if (secret === undefined || secret.length === 0) {
    throw new Error('JWT_SECRET_NOT_CONFIGURED');
  }
  if (secret.length < MIN_JWT_SECRET_BYTES) {
    throw new Error('JWT_SECRET_TOO_SHORT');
  }
}

/**
 * Access Token 발급 (HS256, 15min TTL).
 * now 파라미터는 테스트 편의 — 프로덕션은 Date.now() 기본.
 */
export async function signAccessToken(
  userId: string,
  sessionId: string,
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  assertJwtSecret(secret);
  // fail-fast — 빈 userId/sessionId 로 서명된 JWT 는 verify 측에서 거부되지만,
  // 발급 단계 차단이 내부 버그 감지에 유리 (Phase A #4 M-2 해소).
  if (userId.length === 0) throw new Error('SIGN_EMPTY_USER_ID');
  if (sessionId.length === 0) throw new Error('SIGN_EMPTY_SESSION_ID');
  // hono JWTPayload 의 index signature 요구 충족 위해 Record 로 선언 후 전달.
  const payload: Record<string, unknown> = {
    sub: userId,
    sid: sessionId,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  };
  return sign(payload, secret, JWT_ALG);
}

/**
 * Access Token 검증.
 * 서명 위조/형식 오류/만료/불완전 payload 모두 구분하여 반환 — 미들웨어에서
 * 로그 레벨/응답 코드 분기 가능.
 *
 * Clock skew: iat/exp 검증에 ±60s leeway (ADR-005 §Addendum).
 */
export async function verifyAccessToken(
  token: string,
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): Promise<AccessTokenVerifyResult> {
  assertJwtSecret(secret);

  // hono verify 내부 exp/iat 체크 비활성 → 수동 leeway 적용 후 판정
  let rawPayload: unknown;
  try {
    rawPayload = await verify(token, secret, {
      alg: JWT_ALG,
      exp: false,
      iat: false,
      nbf: false,
    });
  } catch (err) {
    if (err instanceof JwtTokenSignatureMismatched) {
      return { ok: false, reason: 'invalid' };
    }
    if (err instanceof JwtTokenInvalid) {
      return { ok: false, reason: 'malformed' };
    }
    return { ok: false, reason: 'invalid' };
  }

  if (!isAccessTokenPayload(rawPayload)) {
    return { ok: false, reason: 'malformed' };
  }

  // Clock skew 허용 범위 내에서만 통과
  if (rawPayload.exp + JWT_CLOCK_SKEW_SECONDS < now) {
    return { ok: false, reason: 'expired' };
  }
  if (rawPayload.iat - JWT_CLOCK_SKEW_SECONDS > now) {
    // 미래 시점 iat → 시계 조작 의심. 'invalid' 로 분류.
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, payload: rawPayload };
}

function isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['sub'] === 'string' &&
    obj['sub'].length > 0 &&
    typeof obj['sid'] === 'string' &&
    obj['sid'].length > 0 &&
    typeof obj['iat'] === 'number' &&
    Number.isFinite(obj['iat']) &&
    typeof obj['exp'] === 'number' &&
    Number.isFinite(obj['exp'])
  );
}

/**
 * decode payload 만 추출 (서명 검증 없음). 로깅/감사 전용, 인증에 사용 금지.
 */
export function decodeAccessTokenUnsafe(token: string): AccessTokenPayload | null {
  try {
    const { payload } = decode(token);
    return isAccessTokenPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Refresh Token (opaque, D1-backed, rotation)
// ---------------------------------------------------------------------------

/** base64url 인코딩 (padding 제거). RFC 4648 §5. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 새 Refresh Token 생성 (32B 난수 → base64url). */
export function generateRefreshToken(): string {
  const bytes = new Uint8Array(REFRESH_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** hex 인코딩 (SHA-256 출력). */
function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

/** SHA-256(token) hex — D1 저장용 (원본 미저장). */
export async function hashRefreshToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toHex(new Uint8Array(buf));
}

/**
 * SHA-256(ip + pepper) hex — D1 저장용.
 * pepper 는 Cloudflare secret (`IP_PEPPER`). 단일 leak 으로는 IP 역산 불가.
 */
export async function hashIp(ip: string, pepper: string): Promise<string> {
  if (pepper.length === 0) {
    // pepper 없으면 해시 자체가 의미 없음. null 대신 빈 문자열로 호출 측에서 판단.
    return '';
  }
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + pepper));
  return toHex(new Uint8Array(buf));
}

export function truncateUserAgent(ua: string | null | undefined): string | null {
  if (ua === null || ua === undefined) return null;
  if (ua.length === 0) return null;
  return ua.length > USER_AGENT_MAX_LENGTH ? ua.substring(0, USER_AGENT_MAX_LENGTH) : ua;
}

// ---------------------------------------------------------------------------
// D1 CRUD — sessions 테이블 조작 (migrations/0009 참조)
// ---------------------------------------------------------------------------

export interface SessionContext {
  readonly userAgent: string | null;
  readonly ipHash: string | null;
}

export interface CreatedRefreshSession {
  readonly sessionId: string;
  readonly refreshToken: string; // 평문 (cookie 에 주입, D1 에는 해시만)
  readonly expiresAtIso: string;
}

/**
 * 새 Refresh Session 생성 (로그인 + refresh rotation 공용).
 *
 * - 원자적 INSERT — UNIQUE(refresh_token_hash) 충돌 시 (극도로 낮은 확률) 에러.
 * - expires_at 은 서버 시계 기준 ISO8601 (D1 DEFAULT 와 동일 포맷).
 */
export async function createRefreshSession(
  db: D1Database,
  userId: string,
  ctx: SessionContext,
  now: number = Date.now(),
): Promise<CreatedRefreshSession> {
  const sessionId = crypto.randomUUID();
  const refreshToken = generateRefreshToken();
  const hash = await hashRefreshToken(refreshToken);
  const expiresAtIso = new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString();

  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, user_agent, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(sessionId, userId, hash, expiresAtIso, ctx.userAgent, ctx.ipHash)
    .run();

  return { sessionId, refreshToken, expiresAtIso };
}

export type RefreshLookupResult =
  | { readonly ok: true; readonly sessionId: string; readonly userId: string }
  | {
      readonly ok: false;
      readonly reason: 'not_found' | 'revoked' | 'expired' | 'rotated_recently';
      readonly sessionId?: string;
      readonly userId?: string;
    };

export interface StoredSessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly revoked_at: string | null;
  readonly expires_at: string;
}

/**
 * Refresh token 의 D1 상태 조회.
 *
 * 반환:
 *   - ok=true: 유효한 세션 (revoked_at NULL + expires_at > now)
 *   - reason='not_found': 해당 해시 없음 (위조/이미 삭제)
 *   - reason='revoked': revoked_at + 오래됨 (grace 초과) → **reuse detection 대상** (탈취 의심)
 *   - reason='rotated_recently': revoked_at 이나 grace 이내 → 네트워크 재시도 오탐 완화 (전체 세션 파기 X)
 *   - reason='expired': 존재하나 expires_at 경과 (또는 파싱 불가 시 fail-safe)
 *
 * Phase 1 Step 1-4 C-2/C-3 해소:
 *   - grace window (REFRESH_ROTATION_GRACE_SECONDS) 적용으로 정상 사용자 강제 로그아웃 방지
 *   - Date.parse NaN 은 fail-safe 하게 expired 처리 (C-3: A-2 방어)
 */
export async function lookupRefreshSession(
  db: D1Database,
  refreshToken: string,
  now: number = Date.now(),
): Promise<RefreshLookupResult> {
  const hash = await hashRefreshToken(refreshToken);
  const row = await db
    .prepare(
      `SELECT id, user_id, revoked_at, expires_at FROM sessions WHERE refresh_token_hash = ? LIMIT 1`,
    )
    .bind(hash)
    .first<StoredSessionRow>();

  if (row === null) {
    return { ok: false, reason: 'not_found' };
  }
  if (row.revoked_at !== null) {
    // Grace window: rotation 직후 N 초 이내 revoked token 재사용은
    // 네트워크 재시도/Strict Mode 중복 요청일 가능성이 높다 (false positive).
    const revokedAt = Date.parse(row.revoked_at);
    const withinGrace =
      Number.isFinite(revokedAt) && now - revokedAt <= REFRESH_ROTATION_GRACE_SECONDS * 1000;
    return {
      ok: false,
      reason: withinGrace ? 'rotated_recently' : 'revoked',
      sessionId: row.id,
      userId: row.user_id,
    };
  }
  // fail-safe: parse 실패(NaN) 도 expired 로 처리 (C-3: A-2 방어 — 스키마 손상/관리자 조작 시 세션 영구 유효 방지)
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return {
      ok: false,
      reason: 'expired',
      sessionId: row.id,
      userId: row.user_id,
    };
  }
  return { ok: true, sessionId: row.id, userId: row.user_id };
}

/** 개별 세션 revoke (로그아웃/rotation 시 이전 세션). */
export async function revokeSession(
  db: D1Database,
  sessionId: string,
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  await db
    .prepare(`UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`)
    .bind(nowIso, sessionId)
    .run();
}

/**
 * 사용자 전체 활성 세션 파기 (refresh token 탈취 감지 / 환불 / 계정 정지).
 * revoked_at 이 이미 있는 행은 건드리지 않음 (one-way 전이 트리거 준수).
 */
export async function revokeAllUserSessions(
  db: D1Database,
  userId: string,
  nowIso: string = new Date().toISOString(),
): Promise<number> {
  const result = await db
    .prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
    .bind(nowIso, userId)
    .run();
  // D1Result.meta.changes 는 런타임 런타임에 따라 undefined 가능
  const changes = result.meta?.changes;
  return typeof changes === 'number' ? changes : 0;
}
