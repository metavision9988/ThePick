/**
 * page-ref 모듈 테스트 — 정수 추출, 비정상 입력 시 console.warn (운영자 detect).
 *
 * 근거: Session 057 5th MAJOR-1 (parsePageRefToInt DRY 단일화)
 *      + Pass 1 SURGEON M1 흡수 (operator detect)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { parsePageRefToInt, parsePageRefWithWarn } from '../page-ref.js';

describe('parsePageRefToInt', () => {
  it('정상 입력: "p.524" → 524', () => {
    expect(parsePageRefToInt('p.524')).toEqual({ value: 524, parsed: true });
  });

  it('범위 입력: "p.123-125" → 123 (첫 정수)', () => {
    expect(parsePageRefToInt('p.123-125')).toEqual({ value: 123, parsed: true });
  });

  it('숫자만: "684" → 684', () => {
    expect(parsePageRefToInt('684')).toEqual({ value: 684, parsed: true });
  });

  it('null → 0 sentinel + parsed=false', () => {
    expect(parsePageRefToInt(null)).toEqual({ value: 0, parsed: false });
  });

  it('undefined → 0 sentinel + parsed=false', () => {
    expect(parsePageRefToInt(undefined)).toEqual({ value: 0, parsed: false });
  });

  it('빈 문자열 → 0 sentinel + parsed=false', () => {
    expect(parsePageRefToInt('')).toEqual({ value: 0, parsed: false });
  });

  it('정수 미포함 "없음" → 0 sentinel + parsed=false', () => {
    expect(parsePageRefToInt('없음')).toEqual({ value: 0, parsed: false });
  });

  it('"부록" → 0 sentinel + parsed=false', () => {
    expect(parsePageRefToInt('부록')).toEqual({ value: 0, parsed: false });
  });
});

describe('parsePageRefWithWarn', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('정상 입력: warn 출력 없음 + value 반환', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parsePageRefWithWarn('p.524', 'TBL-001');
    expect(result).toBe(524);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('null/undefined: warn 출력 없음 (정상 부재) + 0 sentinel', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parsePageRefWithWarn(null, 'TBL-099')).toBe(0);
    expect(parsePageRefWithWarn(undefined, 'TBL-099')).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('비정상 입력 ("없음"): warn 출력 + nodeId 포함 + 0 sentinel', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parsePageRefWithWarn('없음', 'TCELL-001-01-01');
    expect(result).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('TCELL-001-01-01');
    expect(warnSpy.mock.calls[0][0]).toContain("'없음'");
  });
});
