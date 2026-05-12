import { describe, it, expect } from 'vitest';
import {
  PASSWORD_MIN_LENGTH_RELAXED,
  PASSWORD_MIN_LENGTH_STRICT,
  PASSWORD_MAX_LENGTH,
  getPasswordMinLength,
  isHibpEnabled,
} from '../constants/password-policy.js';

describe('password-policy constants', () => {
  it('RELAXED < STRICT, both ≤ MAX', () => {
    expect(PASSWORD_MIN_LENGTH_RELAXED).toBe(4);
    expect(PASSWORD_MIN_LENGTH_STRICT).toBe(8);
    expect(PASSWORD_MAX_LENGTH).toBe(1024);
    expect(PASSWORD_MIN_LENGTH_RELAXED).toBeLessThan(PASSWORD_MIN_LENGTH_STRICT);
    expect(PASSWORD_MIN_LENGTH_STRICT).toBeLessThan(PASSWORD_MAX_LENGTH);
  });
});

describe('getPasswordMinLength', () => {
  it('returns RELAXED when env undefined (Phase 2 default)', () => {
    expect(getPasswordMinLength(undefined)).toBe(PASSWORD_MIN_LENGTH_RELAXED);
  });

  it('returns RELAXED when env empty string', () => {
    expect(getPasswordMinLength('')).toBe(PASSWORD_MIN_LENGTH_RELAXED);
  });

  it('returns parsed value when env = "8" (Phase 3 toggle)', () => {
    expect(getPasswordMinLength('8')).toBe(PASSWORD_MIN_LENGTH_STRICT);
  });

  it('returns parsed value when env = "12" (custom strict)', () => {
    expect(getPasswordMinLength('12')).toBe(12);
  });

  it('falls back to RELAXED on non-numeric input', () => {
    expect(getPasswordMinLength('not-a-number')).toBe(PASSWORD_MIN_LENGTH_RELAXED);
    expect(getPasswordMinLength('NaN')).toBe(PASSWORD_MIN_LENGTH_RELAXED);
  });

  it('falls back to RELAXED on below-floor value (defense-in-depth)', () => {
    expect(getPasswordMinLength('0')).toBe(PASSWORD_MIN_LENGTH_RELAXED);
    expect(getPasswordMinLength('3')).toBe(PASSWORD_MIN_LENGTH_RELAXED);
    expect(getPasswordMinLength('-5')).toBe(PASSWORD_MIN_LENGTH_RELAXED);
  });

  it('falls back to RELAXED on above-MAX value', () => {
    expect(getPasswordMinLength('99999')).toBe(PASSWORD_MIN_LENGTH_RELAXED);
  });

  it('accepts boundary value (RELAXED itself, MAX itself)', () => {
    expect(getPasswordMinLength('4')).toBe(4);
    expect(getPasswordMinLength('1024')).toBe(1024);
  });
});

describe('isHibpEnabled', () => {
  it('returns false on undefined (Phase 2 default)', () => {
    expect(isHibpEnabled(undefined)).toBe(false);
  });

  it('returns true on "true" (Phase 3 toggle)', () => {
    expect(isHibpEnabled('true')).toBe(true);
  });

  it('returns true case-insensitively', () => {
    expect(isHibpEnabled('TRUE')).toBe(true);
    expect(isHibpEnabled('True')).toBe(true);
  });

  it('returns false on other truthy strings (strict literal)', () => {
    expect(isHibpEnabled('1')).toBe(false);
    expect(isHibpEnabled('yes')).toBe(false);
    expect(isHibpEnabled('enabled')).toBe(false);
  });

  it('returns false on "false" / empty', () => {
    expect(isHibpEnabled('false')).toBe(false);
    expect(isHibpEnabled('')).toBe(false);
  });
});
