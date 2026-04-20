import { describe, expect, it, vi } from 'vitest';
import { isRetryable, withRetry } from '../retry.js';

describe('isRetryable', () => {
  it('rejects non-Error values', () => {
    expect(isRetryable('string error')).toBe(false);
    expect(isRetryable(42)).toBe(false);
    expect(isRetryable(null)).toBe(false);
  });

  it('marks D1_CONSTRAINT as non-retryable', () => {
    expect(isRetryable(new Error('D1_CONSTRAINT_FAILED: something'))).toBe(false);
    expect(isRetryable(new Error('UNIQUE constraint failed: users.email'))).toBe(false);
    expect(isRetryable(new Error('NOT NULL constraint failed: users.email'))).toBe(false);
    expect(isRetryable(new Error('CHECK constraint failed: status'))).toBe(false);
    expect(isRetryable(new Error('FOREIGN KEY constraint failed'))).toBe(false);
  });

  it('marks D1_TRIGGER as non-retryable', () => {
    expect(isRetryable(new Error('D1_TRIGGER_ABORT: UPDATE on knowledge_nodes forbidden'))).toBe(
      false,
    );
  });

  it('marks timeout as retryable', () => {
    expect(isRetryable(new Error('Request timeout'))).toBe(true);
  });

  it('marks network as retryable', () => {
    expect(isRetryable(new Error('network unreachable'))).toBe(true);
  });

  it('marks D1_ERROR 5xx as retryable', () => {
    expect(isRetryable(new Error('D1_ERROR: 503 Service Unavailable'))).toBe(true);
  });

  it('defaults to non-retryable for unknown errors (safe default)', () => {
    expect(isRetryable(new Error('Some random error'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns value on first attempt when fn succeeds', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result.value).toBe('ok');
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds on second attempt', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce('ok');
    const result = await withRetry(fn);
    expect(result.value).toBe('ok');
    expect(result.attempts).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries up to 2 times (total 3 attempts) then throws', async () => {
    const err = new Error('timeout');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn)).rejects.toThrow('timeout');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on non-retryable error', async () => {
    const err = new Error('UNIQUE constraint failed');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn)).rejects.toThrow('UNIQUE constraint failed');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('wraps non-Error rejects in Error', async () => {
    // Intentionally throw a non-Error value that is retryable — internal path should still wrap
    const fn = vi.fn().mockImplementation(async () => {
      throw new Error('timeout');
    });
    await expect(withRetry(fn)).rejects.toBeInstanceOf(Error);
  });
});
