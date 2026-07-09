/**
 * safe-redirect 단위 테스트 — 개방 리다이렉트 차단 (4-Pass M-1).
 */

import { describe, expect, it } from 'vitest';
import { resolveSafeNext } from '../safe-redirect';

describe('resolveSafeNext', () => {
  it('내부 경로는 통과', () => {
    expect(resolveSafeNext('?next=/study/')).toBe('/study/');
    expect(resolveSafeNext('?next=/public/quiz?subject=x')).toBe('/public/quiz?subject=x');
  });

  it('★개방 리다이렉트 차단 — 스킴/프로토콜-상대/백슬래시 전부 fallback', () => {
    expect(resolveSafeNext('?next=https://evil.com')).toBe('/study/');
    expect(resolveSafeNext('?next=//evil.com')).toBe('/study/');
    // %5C = 백슬래시 — URLSearchParams 디코드 후 `/\evil.com` → WHATWG `\`→`/` 정규화 우회
    expect(resolveSafeNext('?next=/%5Cevil.com')).toBe('/study/');
    expect(resolveSafeNext('?next=/\\evil.com')).toBe('/study/');
    expect(resolveSafeNext('?next=javascript:alert(1)')).toBe('/study/');
  });

  it('빈 값/미지정 → fallback', () => {
    expect(resolveSafeNext('')).toBe('/study/');
    expect(resolveSafeNext('?next=')).toBe('/study/');
    expect(resolveSafeNext('?foo=bar')).toBe('/study/');
  });

  it('bare "/" (경로 없음) → fallback (두 번째 문자 부재)', () => {
    expect(resolveSafeNext('?next=/')).toBe('/study/');
  });

  it('커스텀 fallback 존중', () => {
    expect(resolveSafeNext('?next=//evil.com', '/home')).toBe('/home');
  });
});
