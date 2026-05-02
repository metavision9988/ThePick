/**
 * TokenForm 단위 테스트 — Step 037 CRIT-QPHASE1-1 #1.
 *
 * 검증:
 *   - 토큰 입력 → submit → POST /api/telemetry/login (credentials='include')
 *   - 200 응답 → onAuthenticated 콜백 호출
 *   - 401 응답 → '토큰이 일치하지 않습니다' 에러 표시 + onAuthenticated 미호출
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TokenForm } from '../components/TelemetryDashboard';

describe('TokenForm — POST /api/telemetry/login + cookie 모드', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('16자 이상 토큰 입력 → submit → POST /login (credentials="include") → onAuthenticated 호출', async () => {
    const fetchCalls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = vi.fn(async (input, init = {}) => {
      fetchCalls.push({ url: String(input), init: init as RequestInit });
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const onAuthenticated = vi.fn();
    render(<TokenForm apiBase="http://localhost:8787" onAuthenticated={onAuthenticated} />);

    const input = screen.getByPlaceholderText('X-Admin-Token');
    const submitButton = screen.getByRole('button', { name: /저장/ });

    await userEvent.type(input, 'a'.repeat(16));
    await userEvent.click(submitButton);

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe('http://localhost:8787/api/telemetry/login');
    expect(fetchCalls[0].init.method).toBe('POST');
    expect(fetchCalls[0].init.credentials).toBe('include');
    const body = JSON.parse(fetchCalls[0].init.body as string);
    expect(body).toEqual({ token: 'a'.repeat(16) });
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });
});
