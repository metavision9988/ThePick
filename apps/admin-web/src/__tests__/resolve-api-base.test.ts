/**
 * resolveApiBase 단위 테스트 — Step 037 CRIT-QPHASE1-1 #7.
 *
 * 검증 (env 인자 DI 주입):
 *   - production 환경 (DEV=false, MODE!=development) + PUBLIC_API_BASE_URL 미설정 → throw
 *   - dev 환경 → localhost fallback
 *   - PUBLIC_API_BASE_URL 설정 → 우선 (env / mode 무관)
 */

import { describe, it, expect } from 'vitest';
import { resolveApiBase } from '../components/TelemetryDashboard';

describe('resolveApiBase — env DI 주입 검증', () => {
  it('production 환경 + PUBLIC_API_BASE_URL 미설정 → throw', () => {
    const env = {
      DEV: false,
      MODE: 'production',
      PUBLIC_API_BASE_URL: undefined,
    } as unknown as ImportMetaEnv;
    expect(() => resolveApiBase(env)).toThrow(/PUBLIC_API_BASE_URL not configured/);
  });

  it('PUBLIC_API_BASE_URL 설정 시 production 환경에서도 정상 반환', () => {
    const env = {
      DEV: false,
      MODE: 'production',
      PUBLIC_API_BASE_URL: 'https://api.thepick.app',
    } as unknown as ImportMetaEnv;
    expect(resolveApiBase(env)).toBe('https://api.thepick.app');
  });

  it('dev 환경 + PUBLIC_API_BASE_URL 미설정 → localhost fallback', () => {
    const env = {
      DEV: true,
      MODE: 'development',
      PUBLIC_API_BASE_URL: undefined,
    } as unknown as ImportMetaEnv;
    expect(resolveApiBase(env)).toBe('http://localhost:8787');
  });
});
