import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '@thepick/shared';
import {
  checkEmailRateLimit,
  checkIpRateLimit,
  checkWebhookIpRateLimit,
  type RateLimiter,
} from '../rate-limit.js';

/**
 * `Logger` 인터페이스를 strict 하게 구현한 mock (Step 1-3 M-5).
 * child() 는 자기 자신을 반환하여 `.child({...}).warn(...)` 체인도 검증 가능.
 */
function createMockLogger(): Logger & {
  readonly _warn: ReturnType<typeof vi.fn>;
  readonly _error: ReturnType<typeof vi.fn>;
  readonly _info: ReturnType<typeof vi.fn>;
  readonly _debug: ReturnType<typeof vi.fn>;
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
    _info: info,
    _debug: debug,
  };
  return logger as unknown as Logger & {
    readonly _warn: ReturnType<typeof vi.fn>;
    readonly _error: ReturnType<typeof vi.fn>;
    readonly _info: ReturnType<typeof vi.fn>;
    readonly _debug: ReturnType<typeof vi.fn>;
  };
}

describe('checkIpRateLimit', () => {
  it('fail-open when binding undefined in development', async () => {
    const log = createMockLogger();
    const allowed = await checkIpRateLimit(undefined, '1.2.3.4', 'development', log);
    expect(allowed).toBe(true);
    expect(log._warn).toHaveBeenCalledWith(
      'AUTH_RATE_LIMITER_IP binding not configured — fail-open (dev)',
      { environment: 'development', policy: 'fail-open' },
    );
  });

  it('fail-closed when binding undefined in production (M-1 해소)', async () => {
    const log = createMockLogger();
    const allowed = await checkIpRateLimit(undefined, '1.2.3.4', 'production', log);
    expect(allowed).toBe(false);
    expect(log._error).toHaveBeenCalled();
  });

  it('fail-closed when binding undefined in staging', async () => {
    const log = createMockLogger();
    const allowed = await checkIpRateLimit(undefined, '1.2.3.4', 'staging', log);
    expect(allowed).toBe(false);
    expect(log._error).toHaveBeenCalled();
  });

  it('returns true when binding allows', async () => {
    const log = createMockLogger();
    const limiter: RateLimiter = { limit: vi.fn().mockResolvedValue({ success: true }) };
    const allowed = await checkIpRateLimit(limiter, '1.2.3.4', 'production', log);
    expect(allowed).toBe(true);
    expect(limiter.limit).toHaveBeenCalledWith({ key: '1.2.3.4' });
  });

  it('returns false when binding rejects (rate limit exceeded)', async () => {
    const log = createMockLogger();
    const limiter: RateLimiter = { limit: vi.fn().mockResolvedValue({ success: false }) };
    const allowed = await checkIpRateLimit(limiter, '1.2.3.4', 'production', log);
    expect(allowed).toBe(false);
  });
});

describe('checkEmailRateLimit', () => {
  it('uses email: prefix in key to avoid collision with IP keys', async () => {
    const log = createMockLogger();
    const limiter: RateLimiter = { limit: vi.fn().mockResolvedValue({ success: true }) };
    await checkEmailRateLimit(limiter, 'alice@example.com', 'production', log);
    expect(limiter.limit).toHaveBeenCalledWith({ key: 'email:alice@example.com' });
  });

  it('fail-open when binding undefined in development', async () => {
    const log = createMockLogger();
    const allowed = await checkEmailRateLimit(undefined, 'alice@example.com', 'development', log);
    expect(allowed).toBe(true);
  });

  it('fail-closed when binding undefined in production', async () => {
    const log = createMockLogger();
    const allowed = await checkEmailRateLimit(undefined, 'alice@example.com', 'production', log);
    expect(allowed).toBe(false);
  });

  it('rejects when limit exceeded', async () => {
    const log = createMockLogger();
    const limiter: RateLimiter = { limit: vi.fn().mockResolvedValue({ success: false }) };
    const allowed = await checkEmailRateLimit(limiter, 'alice@example.com', 'production', log);
    expect(allowed).toBe(false);
  });
});

describe('checkWebhookIpRateLimit (Step 1-2 C-1)', () => {
  it('uses webhook: prefix to namespace from auth rate-limit keys', async () => {
    const log = createMockLogger();
    const limiter: RateLimiter = { limit: vi.fn().mockResolvedValue({ success: true }) };
    await checkWebhookIpRateLimit(limiter, '5.6.7.8', 'production', log);
    expect(limiter.limit).toHaveBeenCalledWith({ key: 'webhook:5.6.7.8' });
  });

  it('fail-open in development', async () => {
    const log = createMockLogger();
    const allowed = await checkWebhookIpRateLimit(undefined, '5.6.7.8', 'development', log);
    expect(allowed).toBe(true);
    expect(log._warn).toHaveBeenCalled();
  });

  it('fail-closed in production', async () => {
    const log = createMockLogger();
    const allowed = await checkWebhookIpRateLimit(undefined, '5.6.7.8', 'production', log);
    expect(allowed).toBe(false);
    expect(log._error).toHaveBeenCalled();
  });
});

describe('Step 1-3 M-5 — logger 는 필수 파라미터', () => {
  it('logger 가 request-scoped 인스턴스로 주입되어야 한다 (environment 고정 회귀 방지)', async () => {
    // TypeScript 에서 logger 미주입 시 컴파일 에러가 발생해야 한다.
    // (런타임 검증은 불가능 — 타입 시스템이 선제 감지)
    const log = createMockLogger();
    const allowed = await checkIpRateLimit(undefined, '0.0.0.0', 'production', log);
    expect(allowed).toBe(false);
    // logger 가 실제로 사용되었는지 확인
    expect(log._error).toHaveBeenCalled();
  });
});
