/**
 * Smoke test — vitest + jsdom 인프라 동작 확인.
 *
 * ADR-040 §5 #1 흡수 검증.
 */

import { describe, it, expect } from 'vitest';

describe('vitest infrastructure', () => {
  it('jsdom 환경 sessionStorage 존재', () => {
    expect(typeof sessionStorage).toBe('object');
    sessionStorage.setItem('test', 'value');
    expect(sessionStorage.getItem('test')).toBe('value');
    sessionStorage.clear();
  });

  it('jsdom 환경 document 존재', () => {
    expect(document).toBeDefined();
    const div = document.createElement('div');
    div.textContent = 'hello';
    expect(div.textContent).toBe('hello');
  });
});
