import { describe, expect, it } from 'vitest';
import { normalizeAnswer } from '../normalize.js';

describe('normalizeAnswer', () => {
  it('동일 입력은 동일 normalize 결과', () => {
    expect(normalizeAnswer('1')).toBe('1');
    expect(normalizeAnswer('②')).toBe('2');
    expect(normalizeAnswer('③번')).toBe('3');
    expect(normalizeAnswer(' 4 번 ')).toBe('4');
  });

  it('원형숫자 ① ~ ⑩ 모두 1~10으로 변환', () => {
    expect(normalizeAnswer('①')).toBe('1');
    expect(normalizeAnswer('②')).toBe('2');
    expect(normalizeAnswer('③')).toBe('3');
    expect(normalizeAnswer('④')).toBe('4');
    expect(normalizeAnswer('⑤')).toBe('5');
    expect(normalizeAnswer('⑥')).toBe('6');
    expect(normalizeAnswer('⑦')).toBe('7');
    expect(normalizeAnswer('⑧')).toBe('8');
    expect(normalizeAnswer('⑨')).toBe('9');
    expect(normalizeAnswer('⑩')).toBe('10');
  });

  it('공백 제거 + lowercase', () => {
    expect(normalizeAnswer('  Hello World  ')).toBe('helloworld');
    expect(normalizeAnswer('보험\t가액')).toBe('보험가액');
  });

  it('"번" 접미사 제거', () => {
    expect(normalizeAnswer('1번')).toBe('1');
    expect(normalizeAnswer('5번')).toBe('5');
    expect(normalizeAnswer('②번')).toBe('2');
  });

  it('"호" 접미사는 carry-over (제거하지 않음)', () => {
    // Pass 1 M1 흡수 정합 — '호$'는 별도 분기 carry-over (1번 ≠ 1호 동/호수)
    expect(normalizeAnswer('1호')).toBe('1호');
  });

  it('서술형 정답도 normalize', () => {
    expect(normalizeAnswer('보험가액의 80%')).toBe('보험가액의80%');
    expect(normalizeAnswer('착과수조사·과중조사')).toBe('착과수조사·과중조사');
  });

  it('빈 문자열은 빈 문자열', () => {
    expect(normalizeAnswer('')).toBe('');
    expect(normalizeAnswer('   ')).toBe('');
  });

  it('① ~ ⑩ 외 character (⑪+)는 그대로 보존 (silent corruption 차단)', () => {
    // regex character class와 circledNumbers string의 어긋남 방어 회귀
    expect(normalizeAnswer('A')).toBe('a');
    expect(normalizeAnswer('test')).toBe('test');
  });
});
