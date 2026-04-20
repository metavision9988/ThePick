import { describe, expect, it } from 'vitest';
import { PBKDF2_HASH_BYTES, PBKDF2_ITERATIONS, PBKDF2_SALT_BYTES } from '../constants.js';
import { hashPassword, timingSafeEqual, verifyPassword } from '../password.js';

describe('hashPassword', () => {
  it('produces salt + hash + iterations', async () => {
    const result = await hashPassword('correct-horse-battery-staple');

    expect(result.iterations).toBe(PBKDF2_ITERATIONS);
    expect(base64ByteLength(result.salt)).toBe(PBKDF2_SALT_BYTES);
    expect(base64ByteLength(result.hash)).toBe(PBKDF2_HASH_BYTES);
  });

  it('produces different salt each call', async () => {
    const a = await hashPassword('correct-horse-battery-staple');
    const b = await hashPassword('correct-horse-battery-staple');

    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('rejects passwords shorter than minimum', async () => {
    await expect(hashPassword('short')).rejects.toThrow(/at least/);
  });

  it('rejects passwords longer than maximum (DoS 방어)', async () => {
    const oversized = 'a'.repeat(2000);
    await expect(hashPassword(oversized)).rejects.toThrow(/at most/);
  });
});

describe('verifyPassword', () => {
  it('returns true for matching password', async () => {
    const stored = await hashPassword('correct-horse-battery-staple');
    const result = await verifyPassword('correct-horse-battery-staple', stored);
    expect(result).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const stored = await hashPassword('correct-horse-battery-staple');
    const result = await verifyPassword('wrong-password-here', stored);
    expect(result).toBe(false);
  });

  it('returns false for tampered hash', async () => {
    const stored = await hashPassword('correct-horse-battery-staple');
    const tampered = { ...stored, hash: base64FlipFirstByte(stored.hash) };
    const result = await verifyPassword('correct-horse-battery-staple', tampered);
    expect(result).toBe(false);
  });

  it('returns false for iterations below OWASP minimum (downgrade attack)', async () => {
    const stored = await hashPassword('correct-horse-battery-staple');
    const downgraded = { ...stored, iterations: 10000 };
    const result = await verifyPassword('correct-horse-battery-staple', downgraded);
    expect(result).toBe(false);
  });

  it('returns false for corrupted salt (wrong length)', async () => {
    const stored = await hashPassword('correct-horse-battery-staple');
    const corrupt = { ...stored, salt: 'dGVzdA==' }; // 4 bytes instead of 16
    const result = await verifyPassword('correct-horse-battery-staple', corrupt);
    expect(result).toBe(false);
  });

  it('returns false for password shorter than minimum (guard before hash)', async () => {
    const stored = await hashPassword('correct-horse-battery-staple');
    const result = await verifyPassword('short', stored);
    expect(result).toBe(false);
  });

  it('returns false for password longer than maximum (DoS guard)', async () => {
    const stored = await hashPassword('correct-horse-battery-staple');
    const oversized = 'a'.repeat(2000);
    const result = await verifyPassword(oversized, stored);
    expect(result).toBe(false);
  });
});

describe('timingSafeEqual', () => {
  it('returns true for identical arrays', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(timingSafeEqual(a, b)).toBe(true);
  });

  it('returns false for differing arrays of same length', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 5]);
    expect(timingSafeEqual(a, b)).toBe(false);
  });

  it('returns false for arrays of different lengths', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3]);
    expect(timingSafeEqual(a, b)).toBe(false);
  });

  it('returns false for empty vs non-empty', () => {
    const a = new Uint8Array(0);
    const b = new Uint8Array([1]);
    expect(timingSafeEqual(a, b)).toBe(false);
  });

  it('returns true for both empty', () => {
    const a = new Uint8Array(0);
    const b = new Uint8Array(0);
    expect(timingSafeEqual(a, b)).toBe(true);
  });
});

function base64ByteLength(encoded: string): number {
  const binary = atob(encoded);
  return binary.length;
}

function base64FlipFirstByte(encoded: string): string {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  bytes[0] = (bytes[0]! ^ 0xff) & 0xff;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]!);
  }
  return btoa(out);
}
