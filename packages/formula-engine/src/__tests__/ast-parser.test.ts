import { describe, it, expect, beforeEach } from 'vitest';
import { parseFormula, extractVariables, clearCache } from '../ast-parser';

describe('ast-parser', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('parseFormula', () => {
    it('정상 수식 파싱 성공', () => {
      const r = parseFormula('a + b');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.cached).toBe(false);
        expect(r.variables).toEqual(['a', 'b']);
      }
    });

    it('같은 수식은 캐시에서 반환', () => {
      const r1 = parseFormula('a + b');
      const r2 = parseFormula('a + b');
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      if (r1.ok && r2.ok) {
        expect(r1.cached).toBe(false);
        expect(r2.cached).toBe(true);
      }
    });

    it('잘못된 수식은 에러 반환', () => {
      const r = parseFormula('a +');
      expect(r.ok).toBe(false);
    });

    it('위험 함수 포함 수식은 에러 반환', () => {
      const r = parseFormula('evaluate("1")');
      expect(r.ok).toBe(false);
    });

    it('복잡한 산식 (F-06 형태)', () => {
      const r = parseFormula('1.0115 * defoliation_rate - 0.0014 * elapsed_days');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.variables).toEqual(['defoliation_rate', 'elapsed_days']);
      }
    });

    it('ceil 포함 산식 (F-03 형태)', () => {
      const r = parseFormula('ceil(total_sample * (variety_target / total_target))');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.variables).toEqual(['total_sample', 'variety_target', 'total_target']);
      }
    });
  });

  describe('extractVariables', () => {
    it('변수 목록 추출', () => {
      const vars = extractVariables('a * b + c');
      expect(vars).toEqual(['a', 'b', 'c']);
    });

    it('파싱 실패 시 null', () => {
      const vars = extractVariables('invalid +++');
      expect(vars).toBeNull();
    });

    it('중복 변수는 한 번만', () => {
      const vars = extractVariables('a + a * a');
      expect(vars).toEqual(['a']);
    });
  });
});
