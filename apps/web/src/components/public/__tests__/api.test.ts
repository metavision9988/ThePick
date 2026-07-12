/**
 * public api — 에러코드 → 사용자 문구 매핑(P4-D6) + PublicApiError 분류 테스트.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUBLIC_ERROR_CODES } from '@thepick/shared';
import { fetchPublicNext, gradePublic, PublicApiError, publicErrorMessage } from '../api';

const realFetch = globalThis.fetch;

function mockFetchOnce(status: number, body: unknown, headers: Record<string, string> = {}): void {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    }),
  );
}

beforeEach(() => {
  // jsdom navigator.onLine 기본 true — 오프라인 케이스는 개별 스텁.
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('publicErrorMessage — 단일 매핑 정본', () => {
  it('shared PUBLIC_ERROR_CODES 전수 한국어 사용자 문구 보유(기술 에러 비노출 — RC-5 계약 정본 소비)', () => {
    for (const code of PUBLIC_ERROR_CODES) {
      const msg = publicErrorMessage(code, 'server');
      expect(msg.length).toBeGreaterThan(5);
      expect(msg).not.toMatch(/[A-Z_]{4,}/); // 코드 원문 노출 금지
    }
  });

  it('미지 코드 → INTERNAL_ERROR 문구 폴백', () => {
    expect(publicErrorMessage('SOMETHING_NEW', 'server')).toBe(
      publicErrorMessage('INTERNAL_ERROR', 'server'),
    );
  });
});

describe('PublicApiError 분류', () => {
  it('404 NO_QUESTION → kind=no_question', async () => {
    mockFetchOnce(404, { error: 'NO_QUESTION' });
    const err = await fetchPublicNext().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PublicApiError);
    expect((err as PublicApiError).kind).toBe('no_question');
    expect((err as PublicApiError).code).toBe('NO_QUESTION');
  });

  it('429 → kind=rate_limited + Retry-After 초 파싱', async () => {
    mockFetchOnce(429, { error: 'TOO_MANY_REQUESTS' }, { 'Retry-After': '60' });
    const err = await gradePublic({ questionId: 'q1', answer: 'x' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PublicApiError);
    expect((err as PublicApiError).kind).toBe('rate_limited');
    expect((err as PublicApiError).retryAfterSec).toBe(60);
  });

  it('fetch reject → kind=network', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await fetchPublicNext().catch((e: unknown) => e);
    expect((err as PublicApiError).kind).toBe('network');
  });

  it('navigator.onLine=false → kind=offline (fetch 미호출)', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const err = await fetchPublicNext().catch((e: unknown) => e);
    onLineSpy.mockRestore();
    expect((err as PublicApiError).kind).toBe('offline');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('200 → 응답 그대로 반환 + 필터 쿼리 직렬화', async () => {
    const q = { id: 'q1', inputType: 'multiple_choice', choices: [] };
    const spy = vi.fn().mockResolvedValue(new Response(JSON.stringify(q), { status: 200 }));
    globalThis.fetch = spy;
    const got = await fetchPublicNext({
      subject: '상법 보험편',
      round: 7,
      inputType: 'multiple_choice',
    });
    expect(got.id).toBe('q1');
    const calledUrl = String(spy.mock.calls[0]![0]);
    expect(calledUrl).toContain('/api/public/questions/next?');
    expect(calledUrl).toContain('round=7');
    expect(calledUrl).toContain('inputType=multiple_choice');
  });
});
