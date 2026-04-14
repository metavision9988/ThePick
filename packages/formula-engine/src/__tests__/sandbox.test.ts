import { describe, it, expect } from 'vitest';
import { safeParse, safeEvaluate } from '../sandbox';

describe('sandbox', () => {
  describe('safeParse — 정상 수식', () => {
    it('단순 덧셈', () => {
      const r = safeParse('a + b');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.variables).toEqual(['a', 'b']);
      }
    });

    it('사칙연산 + 괄호', () => {
      const r = safeParse('(a - b) * c / d');
      expect(r.ok).toBe(true);
    });

    it('허용 함수: ceil', () => {
      const r = safeParse('ceil(a * (b / c))');
      expect(r.ok).toBe(true);
    });

    it('허용 함수: max', () => {
      const r = safeParse('max(a - b, 0)');
      expect(r.ok).toBe(true);
    });

    it('허용 함수: abs, sqrt, pow', () => {
      const r = safeParse('abs(a) + sqrt(b) + pow(c, 2)');
      expect(r.ok).toBe(true);
    });

    it('음수 리터럴', () => {
      const r = safeParse('1.0115 * x - 0.0014 * y');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.variables).toEqual(['x', 'y']);
      }
    });
  });

  describe('safeParse — 차단 수식', () => {
    it('evaluate 함수 차단', () => {
      const r = safeParse('evaluate("1+1")');
      expect(r.ok).toBe(false);
    });

    it('compile 함수 차단', () => {
      const r = safeParse('compile("1+1")');
      expect(r.ok).toBe(false);
    });

    it('simplify 함수 차단', () => {
      const r = safeParse('simplify("x+x")');
      expect(r.ok).toBe(false);
    });

    it('derivative 함수 차단', () => {
      const r = safeParse('derivative("x^2", "x")');
      expect(r.ok).toBe(false);
    });

    it('import 함수 차단', () => {
      const r = safeParse('import({})');
      expect(r.ok).toBe(false);
    });

    it('허용되지 않은 임의 함수 차단', () => {
      const r = safeParse('sin(x)');
      expect(r.ok).toBe(false);
    });

    it('constructor 심볼 차단', () => {
      const r = safeParse('constructor');
      expect(r.ok).toBe(false);
    });

    it('__proto__ 심볼 차단', () => {
      const r = safeParse('__proto__');
      expect(r.ok).toBe(false);
    });

    it('prototype 심볼 차단', () => {
      const r = safeParse('prototype');
      expect(r.ok).toBe(false);
    });

    it('변수 할당 차단', () => {
      const r = safeParse('x = 1');
      expect(r.ok).toBe(false);
    });

    it('함수 정의 차단', () => {
      const r = safeParse('f(x) = x^2');
      expect(r.ok).toBe(false);
    });

    it('블록 표현식 차단 (세미콜론)', () => {
      const r = safeParse('a; b');
      expect(r.ok).toBe(false);
    });

    it('배열 리터럴 차단 (ArrayNode)', () => {
      const r = safeParse('[1, 2, 3]');
      expect(r.ok).toBe(false);
    });

    it('조건부 표현식 차단 (ConditionalNode)', () => {
      const r = safeParse('a > 0 ? a : 0');
      expect(r.ok).toBe(false);
    });

    it('범위 표현식 차단 (RangeNode)', () => {
      const r = safeParse('1:10');
      expect(r.ok).toBe(false);
    });

    it('문자열 상수 차단 (ConstantNode string)', () => {
      const r = safeParse('"hello"');
      expect(r.ok).toBe(false);
    });

    it('대문자 심볼 차단 (Object.prototype 우회 방지)', () => {
      const r = safeParse('toString');
      expect(r.ok).toBe(false);
    });

    it('__defineGetter__ 심볼 차단', () => {
      const r = safeParse('__defineGetter__');
      expect(r.ok).toBe(false);
    });
  });

  describe('safeEvaluate — 계산', () => {
    it('단순 계산', () => {
      const r = safeParse('a + b');
      expect(r.ok).toBe(true);
      if (r.ok) {
        const val = safeEvaluate(r.node.compile(), { a: 3, b: 4 });
        expect(val).toBe(7);
      }
    });

    it('ceil 함수', () => {
      const r = safeParse('ceil(a * (b / c))');
      expect(r.ok).toBe(true);
      if (r.ok) {
        // 10 * (33/100) = 3.3 → ceil → 4
        const val = safeEvaluate(r.node.compile(), { a: 10, b: 33, c: 100 });
        expect(val).toBe(4);
      }
    });

    it('max 함수', () => {
      const r = safeParse('max(a - b, 0)');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(safeEvaluate(r.node.compile(), { a: 5, b: 3 })).toBe(2);
        expect(safeEvaluate(r.node.compile(), { a: 1, b: 3 })).toBe(0);
      }
    });

    it('부동소수점 계수 계산', () => {
      const r = safeParse('1.0115 * x - 0.0014 * y');
      expect(r.ok).toBe(true);
      if (r.ok) {
        const val = safeEvaluate(r.node.compile(), { x: 0.45, y: 30 });
        // 1.0115 * 0.45 - 0.0014 * 30 = 0.455175 - 0.042 = 0.413175
        expect(val).toBeCloseTo(0.413175, 6);
      }
    });

    it('0 나누기 → 에러', () => {
      const r = safeParse('a / b');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(() => safeEvaluate(r.node.compile(), { a: 1, b: 0 })).toThrow(/Division by zero/);
      }
    });
  });
});
