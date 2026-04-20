import { describe, expect, it, vi } from 'vitest';
import { checkEmailRateLimit, checkIpRateLimit, type RateLimiter } from '../rate-limit.js';

describe('checkIpRateLimit', () => {
  it('fail-open when binding undefined in development', async () => {
    const allowed = await checkIpRateLimit(undefined, '1.2.3.4', 'development');
    expect(allowed).toBe(true);
  });

  it('fail-closed when binding undefined in production (M-1 해소)', async () => {
    const allowed = await checkIpRateLimit(undefined, '1.2.3.4', 'production');
    expect(allowed).toBe(false);
  });

  it('fail-closed when binding undefined in staging', async () => {
    const allowed = await checkIpRateLimit(undefined, '1.2.3.4', 'staging');
    expect(allowed).toBe(false);
  });

  it('returns true when binding allows', async () => {
    const limiter: RateLimiter = {
      limit: vi.fn().mockResolvedValue({ success: true }),
    };
    const allowed = await checkIpRateLimit(limiter, '1.2.3.4', 'production');
    expect(allowed).toBe(true);
    expect(limiter.limit).toHaveBeenCalledWith({ key: '1.2.3.4' });
  });

  it('returns false when binding rejects (rate limit exceeded)', async () => {
    const limiter: RateLimiter = {
      limit: vi.fn().mockResolvedValue({ success: false }),
    };
    const allowed = await checkIpRateLimit(limiter, '1.2.3.4', 'production');
    expect(allowed).toBe(false);
  });
});

describe('checkEmailRateLimit', () => {
  it('uses email: prefix in key to avoid collision with IP keys', async () => {
    const limiter: RateLimiter = {
      limit: vi.fn().mockResolvedValue({ success: true }),
    };
    await checkEmailRateLimit(limiter, 'alice@example.com', 'production');
    expect(limiter.limit).toHaveBeenCalledWith({ key: 'email:alice@example.com' });
  });

  it('fail-open when binding undefined in development', async () => {
    const allowed = await checkEmailRateLimit(undefined, 'alice@example.com', 'development');
    expect(allowed).toBe(true);
  });

  it('fail-closed when binding undefined in production', async () => {
    const allowed = await checkEmailRateLimit(undefined, 'alice@example.com', 'production');
    expect(allowed).toBe(false);
  });

  it('rejects when limit exceeded', async () => {
    const limiter: RateLimiter = {
      limit: vi.fn().mockResolvedValue({ success: false }),
    };
    const allowed = await checkEmailRateLimit(limiter, 'alice@example.com', 'production');
    expect(allowed).toBe(false);
  });
});
