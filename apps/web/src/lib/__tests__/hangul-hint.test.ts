/**
 * hangul-hint — M9 힌트 사다리 순수 파생 골든 테스트.
 */

import { describe, expect, it } from 'vitest';
import {
  buildHintLadder,
  charCountHint,
  choseongHint,
  firstCharHint,
  firstWordHint,
  HINT_LEVELS,
  HINT_MASK,
} from '../hangul-hint';

describe('choseongHint (1단계 초성)', () => {
  it('완성형 한글 → 초성', () => {
    expect(choseongHint('보험가액')).toBe('ㅂㅎㄱㅇ');
    expect(choseongHint('손해평가')).toBe('ㅅㅎㅍㄱ');
  });

  it('된소리 초성 정확 분해', () => {
    expect(choseongHint('쪽집게')).toBe('ㅉㅈㄱ');
  });

  it('공백 유지, 비한글(숫자·영문)은 마스킹', () => {
    expect(choseongHint('제3 보험')).toBe(`ㅈ${HINT_MASK} ㅂㅎ`);
    expect(choseongHint('FSRS')).toBe(HINT_MASK.repeat(4));
  });
});

describe('firstCharHint (2단계 첫 글자)', () => {
  it('첫 글자만 공개, 나머지 마스킹(공백 유지)', () => {
    expect(firstCharHint('보험가액')).toBe(`보${HINT_MASK}${HINT_MASK}${HINT_MASK}`);
    expect(firstCharHint('적과 전')).toBe(`적${HINT_MASK} ${HINT_MASK}`);
  });
});

describe('charCountHint (3단계 글자수)', () => {
  it('공백 제외 글자 수', () => {
    expect(charCountHint('보험가액')).toBe(4);
    expect(charCountHint('적과 전')).toBe(3);
    expect(charCountHint('')).toBe(0);
  });
});

describe('firstWordHint (4단계 첫 어절)', () => {
  it('첫 어절 공개 + 나머지 어절 글자수만큼 마스킹', () => {
    expect(firstWordHint('보험 목적물')).toBe(`보험 ${HINT_MASK.repeat(3)}`);
    expect(firstWordHint('단일어절')).toBe('단일어절');
    expect(firstWordHint('')).toBe('');
  });
});

describe('buildHintLadder', () => {
  it('4단계 오름차순(초성→첫 글자→글자수→첫 어절)', () => {
    const ladder = buildHintLadder('위험보장');
    expect(ladder).toHaveLength(HINT_LEVELS);
    expect(ladder.map((h) => h.label)).toEqual(['초성', '첫 글자', '글자수', '첫 어절']);
    expect(ladder[0]!.text).toBe('ㅇㅎㅂㅈ');
    expect(ladder[1]!.text).toBe(`위${HINT_MASK.repeat(3)}`);
    expect(ladder[2]!.text).toBe('4글자');
    expect(ladder[3]!.text).toBe('위험보장');
  });
});
