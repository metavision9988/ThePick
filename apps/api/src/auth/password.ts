/**
 * L3 Fortress: PBKDF2-SHA256 password hashing + constant-time verify.
 *
 * 근거: ADR-005 (PBKDF2-SHA256, **OWASP 2024 600000 iterations**).
 * 구현 원칙:
 *   - Workers 런타임: Web Crypto API (`crypto.subtle`) 사용. Node fs/path 불가.
 *   - 저장 포맷: {hash, salt, iterations} 3필드 분리. iteration 업그레이드 추적 가능.
 *   - Timing-safe compare: XOR 누적 방식 (길이 고정 후 상수시간).
 *
 * 이 파일은 `apps/api/src/auth/` L3 경로. 수정 시 plan 확장 + 독립 리뷰 필수.
 */

import { AppError, ErrorCode } from '@thepick/shared';
import {
  PBKDF2_HASH_ALGORITHM,
  PBKDF2_HASH_BYTES,
  PBKDF2_ITERATIONS,
  PBKDF2_SALT_BYTES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './constants.js';
import type { PasswordHashResult } from './types.js';

/**
 * 평문 비밀번호에서 PBKDF2-SHA256 해시를 생성한다.
 *
 * @throws {AppError} ValidationError — 길이 위반
 * @returns `{hash, salt, iterations}` — 모두 DB에 저장해야 verify 가능
 */
export async function hashPassword(plaintext: string): Promise<PasswordHashResult> {
  validatePasswordLength(plaintext);

  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const hashBytes = await derivePbkdf2Bits(plaintext, salt, PBKDF2_ITERATIONS);

  return {
    hash: bytesToBase64(hashBytes),
    salt: bytesToBase64(salt),
    iterations: PBKDF2_ITERATIONS,
  };
}

/**
 * 저장된 해시와 평문을 상수 시간 비교로 검증한다.
 *
 * 실패 사유(입력 오류 vs 해시 디코드 실패 vs 불일치)는 **모두 동일한** `{valid: false}` 로 반환.
 * 호출 측이 로그인 UI에 이유 노출 금지 (enumeration attack 방어).
 *
 * iterations 는 저장값을 사용 — 과거 해시는 낮은 반복 수 그대로 검증하되,
 * 검증 성공 시 호출 측에서 재해시(업그레이드) 수행 권장 (ADR-005 Rotation 절).
 */
export async function verifyPassword(
  plaintext: string,
  stored: PasswordHashResult,
): Promise<boolean> {
  if (plaintext.length < PASSWORD_MIN_LENGTH || plaintext.length > PASSWORD_MAX_LENGTH) {
    return false;
  }
  if (stored.iterations < PBKDF2_ITERATIONS) {
    // 다운그레이드 공격 방어 — 저장값이 현 최소 반복 수 미만이면 거부.
    // 이 경로는 DB 트리거(enforce_users_password_iterations_min)가 차단하지만 2중 방어.
    return false;
  }

  const expectedHash = base64ToBytes(stored.hash);
  const salt = base64ToBytes(stored.salt);
  if (expectedHash.byteLength !== PBKDF2_HASH_BYTES || salt.byteLength !== PBKDF2_SALT_BYTES) {
    return false;
  }

  const candidateHash = await derivePbkdf2Bits(plaintext, salt, stored.iterations);
  return timingSafeEqual(candidateHash, expectedHash);
}

/**
 * 상수 시간 바이트 배열 비교 (Workers 호환).
 *
 * 길이 불일치는 항상 false. 이 경우에도 긴 쪽 길이만큼 루프를 돌려 길이 차이가
 * timing 에 직접 노출되는 것을 완화한다 (XOR 결과를 버림 — 의도적 dummy 루프).
 *
 * 호출 측(`verifyPassword`) 은 이 함수 호출 전 `byteLength` 가드로 진입하므로
 * 실제 실행 경로는 길이 동일 분기만. 그러나 public API 이므로 오용 방어.
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    // timing 평탄화용 dummy 루프 — 결과는 항상 false
    const maxLen = Math.max(a.byteLength, b.byteLength);
    let dummy = 0;
    for (let i = 0; i < maxLen; i++) {
      dummy |= (a[i] ?? 0) ^ (b[i] ?? 0);
    }
    void dummy;
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function validatePasswordLength(plaintext: string): void {
  if (plaintext.length < PASSWORD_MIN_LENGTH) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      400,
    );
  }
  if (plaintext.length > PASSWORD_MAX_LENGTH) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
      400,
    );
  }
}

async function derivePbkdf2Bits(
  plaintext: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(plaintext),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: PBKDF2_HASH_ALGORITHM,
    },
    keyMaterial,
    PBKDF2_HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(encoded: string): Uint8Array {
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return new Uint8Array(0);
  }
}
