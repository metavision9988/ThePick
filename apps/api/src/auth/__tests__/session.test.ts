/**
 * session.ts 단위 테스트 (Phase 1 Step 1-4 — ADR-005 §Addendum).
 *
 * 범위:
 *   - signAccessToken / verifyAccessToken (서명 + clock skew + payload 구조)
 *   - assertJwtSecret (fail-closed 정책)
 *   - generateRefreshToken / hashRefreshToken / hashIp (암호 유틸)
 *   - createRefreshSession / lookupRefreshSession / revokeSession / revokeAllUserSessions
 *   - decodeAccessTokenUnsafe (감사용)
 *
 * D1 fake: 메모리 내 Map 기반, sessions 스키마 핵심 제약만 시뮬레이션.
 */

import { describe, expect, it } from 'vitest';
import {
  assertJwtSecret,
  createRefreshSession,
  decodeAccessTokenUnsafe,
  generateRefreshToken,
  hashIp,
  hashRefreshToken,
  lookupRefreshSession,
  revokeAllUserSessions,
  revokeSession,
  signAccessToken,
  truncateUserAgent,
  verifyAccessToken,
} from '../session.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_CLOCK_SKEW_SECONDS,
  MIN_JWT_SECRET_BYTES,
  REFRESH_ROTATION_GRACE_SECONDS,
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_TTL_SECONDS,
  USER_AGENT_MAX_LENGTH,
} from '@thepick/shared';

const VALID_SECRET = 'test-jwt-secret-32bytes-plus-for-hs256-v1';
const OTHER_SECRET = 'different-jwt-secret-32bytes-plus-hs256-v2';

describe('assertJwtSecret (fail-closed)', () => {
  it('throws on undefined', () => {
    expect(() => assertJwtSecret(undefined)).toThrow('JWT_SECRET_NOT_CONFIGURED');
  });
  it('throws on empty string', () => {
    expect(() => assertJwtSecret('')).toThrow('JWT_SECRET_NOT_CONFIGURED');
  });
  it('throws on short secret (< MIN_JWT_SECRET_BYTES)', () => {
    const short = 'a'.repeat(MIN_JWT_SECRET_BYTES - 1);
    expect(() => assertJwtSecret(short)).toThrow('JWT_SECRET_TOO_SHORT');
  });
  it('passes on exactly MIN_JWT_SECRET_BYTES (boundary)', () => {
    const exact = 'a'.repeat(MIN_JWT_SECRET_BYTES);
    expect(() => assertJwtSecret(exact)).not.toThrow();
  });
});

describe('signAccessToken + verifyAccessToken (HS256)', () => {
  const now = 1_000_000_000;

  it('round-trip: sign then verify returns same payload fields', async () => {
    const token = await signAccessToken('user-1', 'session-1', VALID_SECRET, now);
    const result = await verifyAccessToken(token, VALID_SECRET, now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.sub).toBe('user-1');
      expect(result.payload.sid).toBe('session-1');
      expect(result.payload.iat).toBe(now);
      expect(result.payload.exp).toBe(now + ACCESS_TOKEN_TTL_SECONDS);
    }
  });

  it('returns reason=invalid when secret is wrong', async () => {
    const token = await signAccessToken('user-1', 'session-1', VALID_SECRET, now);
    const result = await verifyAccessToken(token, OTHER_SECRET, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid');
    }
  });

  it('returns reason=expired when now > exp + leeway', async () => {
    const token = await signAccessToken('user-1', 'session-1', VALID_SECRET, now);
    const farFuture = now + ACCESS_TOKEN_TTL_SECONDS + JWT_CLOCK_SKEW_SECONDS + 1;
    const result = await verifyAccessToken(token, VALID_SECRET, farFuture);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('expired');
    }
  });

  it('accepts token within clock skew leeway (now = exp + leeway)', async () => {
    const token = await signAccessToken('user-1', 'session-1', VALID_SECRET, now);
    const withinLeeway = now + ACCESS_TOKEN_TTL_SECONDS + JWT_CLOCK_SKEW_SECONDS;
    const result = await verifyAccessToken(token, VALID_SECRET, withinLeeway);
    expect(result.ok).toBe(true);
  });

  it('returns reason=invalid when iat is in the future beyond leeway (clock skew attack)', async () => {
    const future = now + 600; // 10분 미래
    const token = await signAccessToken('user-1', 'session-1', VALID_SECRET, future);
    const result = await verifyAccessToken(token, VALID_SECRET, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid');
    }
  });

  it('returns reason=malformed on garbage token', async () => {
    const result = await verifyAccessToken('not-a-jwt-at-all', VALID_SECRET, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(['malformed', 'invalid']).toContain(result.reason);
    }
  });

  it('decodeAccessTokenUnsafe extracts payload without signature verification', async () => {
    const token = await signAccessToken('user-x', 'session-y', VALID_SECRET, now);
    const decoded = decodeAccessTokenUnsafe(token);
    expect(decoded?.sub).toBe('user-x');
    expect(decoded?.sid).toBe('session-y');
  });

  it('decodeAccessTokenUnsafe returns null on garbage', () => {
    expect(decodeAccessTokenUnsafe('invalid')).toBeNull();
  });
});

describe('generateRefreshToken + hashRefreshToken', () => {
  it('generates base64url token without padding', () => {
    const token = generateRefreshToken();
    expect(token).not.toContain('=');
    expect(token).not.toContain('+');
    expect(token).not.toContain('/');
    expect(token.length).toBeGreaterThanOrEqual(Math.ceil((REFRESH_TOKEN_BYTES * 4) / 3) - 2);
  });

  it('two consecutive generations are different (randomness)', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
  });

  it('hashRefreshToken produces 64-char hex (SHA-256)', async () => {
    const hash = await hashRefreshToken('some-refresh-token-plaintext');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashRefreshToken is deterministic', async () => {
    const a = await hashRefreshToken('same-input');
    const b = await hashRefreshToken('same-input');
    expect(a).toBe(b);
  });
});

describe('hashIp', () => {
  it('returns empty string when pepper is empty (no silent unsalted hash)', async () => {
    const hash = await hashIp('1.2.3.4', '');
    expect(hash).toBe('');
  });

  it('returns 64-char hex when pepper provided', async () => {
    const hash = await hashIp('1.2.3.4', 'test-pepper-secret-32bytes-plus-v1');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different peppers produce different hashes for same IP', async () => {
    const h1 = await hashIp('1.2.3.4', 'pepper-one-32bytes-plus-test-v1');
    const h2 = await hashIp('1.2.3.4', 'pepper-two-32bytes-plus-test-v2');
    expect(h1).not.toBe(h2);
  });
});

describe('truncateUserAgent', () => {
  it('returns null for null/undefined/empty', () => {
    expect(truncateUserAgent(null)).toBeNull();
    expect(truncateUserAgent(undefined)).toBeNull();
    expect(truncateUserAgent('')).toBeNull();
  });
  it('passes through under limit', () => {
    expect(truncateUserAgent('Mozilla/5.0')).toBe('Mozilla/5.0');
  });
  it('truncates over limit', () => {
    const long = 'x'.repeat(USER_AGENT_MAX_LENGTH + 100);
    const out = truncateUserAgent(long);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(USER_AGENT_MAX_LENGTH);
  });
});

// ---------------------------------------------------------------------------
// D1 fake 기반 CRUD 테스트
// ---------------------------------------------------------------------------

interface FakeSessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  user_agent: string | null;
  ip_hash: string | null;
}

function buildFakeDb(): { db: D1Database; rows: Map<string, FakeSessionRow> } {
  const rows = new Map<string, FakeSessionRow>();

  const db = {
    prepare: (sql: string) => {
      let bound: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => {
          bound = args;
          return stmt;
        },
        run: async () => {
          if (/^INSERT INTO sessions/i.test(sql)) {
            const [id, user_id, refresh_token_hash, expires_at, user_agent, ip_hash] = bound as [
              string,
              string,
              string,
              string,
              string | null,
              string | null,
            ];
            // UNIQUE(refresh_token_hash) 시뮬레이션
            for (const existing of rows.values()) {
              if (existing.refresh_token_hash === refresh_token_hash) {
                throw new Error('UNIQUE constraint failed: sessions.refresh_token_hash');
              }
            }
            rows.set(id, {
              id,
              user_id,
              refresh_token_hash,
              expires_at,
              revoked_at: null,
              user_agent,
              ip_hash,
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/UPDATE sessions SET revoked_at = \? WHERE id = \?/i.test(sql)) {
            const [nowIso, id] = bound as [string, string];
            const row = rows.get(id);
            if (row && row.revoked_at === null) {
              row.revoked_at = nowIso;
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 0 } };
          }
          if (/UPDATE sessions SET revoked_at = \? WHERE user_id = \?/i.test(sql)) {
            const [nowIso, userId] = bound as [string, string];
            let changes = 0;
            for (const row of rows.values()) {
              if (row.user_id === userId && row.revoked_at === null) {
                row.revoked_at = nowIso;
                changes++;
              }
            }
            return { success: true, meta: { changes } };
          }
          throw new Error(`fake db: unhandled run SQL: ${sql}`);
        },
        first: async <T>(): Promise<T | null> => {
          if (/SELECT .* FROM sessions WHERE refresh_token_hash = \?/i.test(sql)) {
            const [hash] = bound as [string];
            for (const row of rows.values()) {
              if (row.refresh_token_hash === hash) {
                return {
                  id: row.id,
                  user_id: row.user_id,
                  revoked_at: row.revoked_at,
                  expires_at: row.expires_at,
                } as unknown as T;
              }
            }
            return null;
          }
          throw new Error(`fake db: unhandled first SQL: ${sql}`);
        },
      };
      return stmt;
    },
  } as unknown as D1Database;

  return { db, rows };
}

describe('createRefreshSession + lookupRefreshSession (rotation + revoke)', () => {
  it('creates session + lookup returns ok with same sessionId/userId', async () => {
    const { db } = buildFakeDb();
    const created = await createRefreshSession(db, 'user-1', {
      userAgent: 'Mozilla/5.0',
      ipHash: 'abc',
    });
    expect(created.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.refreshToken.length).toBeGreaterThan(20);

    const looked = await lookupRefreshSession(db, created.refreshToken);
    expect(looked.ok).toBe(true);
    if (looked.ok) {
      expect(looked.sessionId).toBe(created.sessionId);
      expect(looked.userId).toBe('user-1');
    }
  });

  it('lookup returns not_found for unknown token', async () => {
    const { db } = buildFakeDb();
    const looked = await lookupRefreshSession(db, 'totally-fake-token-never-issued');
    expect(looked.ok).toBe(false);
    if (!looked.ok) {
      expect(looked.reason).toBe('not_found');
    }
  });

  it('revokeSession then immediate lookup returns reason=rotated_recently (C-2 grace window, D-5-1)', async () => {
    const { db } = buildFakeDb();
    const created = await createRefreshSession(db, 'user-2', { userAgent: null, ipHash: null });
    await revokeSession(db, created.sessionId);
    const looked = await lookupRefreshSession(db, created.refreshToken);
    expect(looked.ok).toBe(false);
    if (!looked.ok) {
      // grace window 이내 재사용은 rotated_recently — reuse detection 회피 (네트워크 재시도 오탐 방지)
      expect(looked.reason).toBe('rotated_recently');
      expect(looked.sessionId).toBe(created.sessionId);
      expect(looked.userId).toBe('user-2');
    }
  });

  it('revokeSession + grace window 초과 후 lookup 은 reason=revoked (reuse detection 활성)', async () => {
    const { db } = buildFakeDb();
    const created = await createRefreshSession(db, 'user-2', { userAgent: null, ipHash: null });
    await revokeSession(db, created.sessionId);
    // now 를 grace 초과 시점으로 주입 → reuse detection 대상
    const future = Date.now() + (REFRESH_ROTATION_GRACE_SECONDS + 5) * 1000;
    const looked = await lookupRefreshSession(db, created.refreshToken, future);
    expect(looked.ok).toBe(false);
    if (!looked.ok) {
      expect(looked.reason).toBe('revoked');
    }
  });

  it('lookup returns reason=expired when expires_at passed', async () => {
    const { db, rows } = buildFakeDb();
    const created = await createRefreshSession(db, 'user-3', { userAgent: null, ipHash: null });
    // 강제로 expires_at 과거로 변경
    const row = rows.get(created.sessionId)!;
    row.expires_at = new Date(Date.now() - 1000).toISOString();

    const looked = await lookupRefreshSession(db, created.refreshToken);
    expect(looked.ok).toBe(false);
    if (!looked.ok) {
      expect(looked.reason).toBe('expired');
    }
  });

  it('revokeAllUserSessions revokes all active sessions for user (reuse detection)', async () => {
    const { db } = buildFakeDb();
    await createRefreshSession(db, 'victim', { userAgent: null, ipHash: null });
    await createRefreshSession(db, 'victim', { userAgent: null, ipHash: null });
    await createRefreshSession(db, 'victim', { userAgent: null, ipHash: null });
    await createRefreshSession(db, 'other-user', { userAgent: null, ipHash: null });

    const changes = await revokeAllUserSessions(db, 'victim');
    expect(changes).toBe(3);

    // other-user 는 영향 없음
    const untouched = await createRefreshSession(db, 'other-user', {
      userAgent: null,
      ipHash: null,
    });
    const looked = await lookupRefreshSession(db, untouched.refreshToken);
    expect(looked.ok).toBe(true);
  });

  it('new session has expires_at ~30day from now (TTL)', async () => {
    const { db, rows } = buildFakeDb();
    const before = Date.now();
    const created = await createRefreshSession(db, 'user-ttl', {
      userAgent: null,
      ipHash: null,
    });
    const row = rows.get(created.sessionId)!;
    const expiresAt = Date.parse(row.expires_at);
    const expected = before + REFRESH_TOKEN_TTL_SECONDS * 1000;
    // 허용 오차 5초
    expect(Math.abs(expiresAt - expected)).toBeLessThan(5000);
  });
});
