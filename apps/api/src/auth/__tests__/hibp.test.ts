import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from '@thepick/shared';
import { checkPwned, parsePwnedResponse } from '../hibp.js';

/** Step 1-3 M-5 — request-scoped logger 주입 검증용 mock. */
function createMockLogger(): Logger & {
  readonly _warn: ReturnType<typeof vi.fn>;
  readonly _error: ReturnType<typeof vi.fn>;
} {
  const warn = vi.fn();
  const error = vi.fn();
  const info = vi.fn();
  const debug = vi.fn();
  const logger = {
    warn,
    error,
    info,
    debug,
    child: () => logger,
    _warn: warn,
    _error: error,
  };
  return logger as unknown as Logger & {
    readonly _warn: ReturnType<typeof vi.fn>;
    readonly _error: ReturnType<typeof vi.fn>;
  };
}

describe('parsePwnedResponse', () => {
  // SHA-1 of 'password' is 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8 (40 hex chars).
  // First 5 chars (prefix sent to HIBP): 5BAA6
  // Remaining 35 chars (suffix matched from response): 1E4C9B93F3F0682250B6CF8331B7EE68FD8
  const PASSWORD_SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';

  it('returns pwned with count when suffix matches', () => {
    const body = `${PASSWORD_SUFFIX}:9545824\nAAAAA11111111111111111111111111111AAAA:2`;
    const result = parsePwnedResponse(body, PASSWORD_SUFFIX);
    expect(result.status).toBe('pwned');
    expect(result.count).toBe(9545824);
  });

  it('returns safe when suffix absent', () => {
    const body =
      'AAAAA11111111111111111111111111111AAAA:2\nBBBBB222222222222222222222222222222BBBB:5';
    const result = parsePwnedResponse(body, PASSWORD_SUFFIX);
    expect(result.status).toBe('safe');
    expect(result.count).toBe(0);
  });

  it('handles CRLF line endings', () => {
    const body = `${PASSWORD_SUFFIX}:100\r\nCCCCC33333333333333333333333333333CCCC:1\r\n`;
    const result = parsePwnedResponse(body, PASSWORD_SUFFIX);
    expect(result.status).toBe('pwned');
    expect(result.count).toBe(100);
  });

  it('ignores padding lines with count=0', () => {
    const body = `${PASSWORD_SUFFIX}:0\nAAAAA11111111111111111111111111111AAAA:5`;
    const result = parsePwnedResponse(body, PASSWORD_SUFFIX);
    expect(result.status).toBe('safe');
  });

  it('returns safe on malformed count', () => {
    const body = `${PASSWORD_SUFFIX}:not-a-number\n`;
    const result = parsePwnedResponse(body, PASSWORD_SUFFIX);
    expect(result.status).toBe('safe');
  });

  it('returns unavailable on empty body (fail-observable)', () => {
    const result = parsePwnedResponse('', PASSWORD_SUFFIX);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable on whitespace-only body', () => {
    const result = parsePwnedResponse('   \n  \r\n  ', PASSWORD_SUFFIX);
    expect(result.status).toBe('unavailable');
  });

  it('is case-insensitive on suffix matching', () => {
    const body = `${PASSWORD_SUFFIX.toLowerCase()}:42\n`;
    const result = parsePwnedResponse(body, PASSWORD_SUFFIX);
    expect(result.status).toBe('pwned');
    expect(result.count).toBe(42);
  });
});

describe('checkPwned', () => {
  const originalFetch = globalThis.fetch;

  // Step 1-3 M-5 — console.error spy 제거. 주입된 mock logger 로 직접 검증.

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns pwned when HIBP 200 + matching suffix', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\n', { status: 200 }),
      );

    const result = await checkPwned('password', createMockLogger());
    expect(result.status).toBe('pwned');
    expect(result.count).toBeGreaterThan(0);
  });

  it('returns safe when HIBP 200 + no matching suffix', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('FFFFF99999999999999999999999999999FFFF:1\n', { status: 200 }),
      );

    const result = await checkPwned('password', createMockLogger());
    expect(result.status).toBe('safe');
  });

  it('returns unavailable on HIBP 5xx + logs warn on injected logger (Step 1-3 M-5)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    const log = createMockLogger();

    const result = await checkPwned('password', log);
    expect(result.status).toBe('unavailable');
    expect(log._warn).toHaveBeenCalledWith('hibp non-2xx response', { status: 503 });
  });

  it('returns unavailable on fetch network error + logs warn on injected logger', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network fail'));
    const log = createMockLogger();

    const result = await checkPwned('password', log);
    expect(result.status).toBe('unavailable');
    expect(log._warn).toHaveBeenCalled();
    const call = log._warn.mock.calls[0];
    expect(call?.[0]).toBe('hibp fetch failed');
    expect(call?.[1]).toMatchObject({ cause: 'network fail' });
  });
});
