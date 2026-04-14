import { describe, it, expect } from 'vitest';
import { calculate } from '../engine';

describe('engine', () => {
  describe('에러 처리', () => {
    it('존재하지 않는 산식 → FORMULA_NOT_FOUND', () => {
      const r = calculate('F-99', {});
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe('FORMULA_NOT_FOUND');
      }
    });

    it('필수 변수 누락 → VARIABLE_MISSING', () => {
      const r = calculate('F-01', { damaged_fruits: 10 });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe('VARIABLE_MISSING');
      }
    });

    it('타입 불일치 → VARIABLE_TYPE_MISMATCH', () => {
      const r = calculate('F-03', {
        total_sample: 10.5, // integer 필요
        variety_target: 33,
        total_target: 100,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe('VARIABLE_TYPE_MISMATCH');
      }
    });

    it('제약조건 위반 → CONSTRAINT_VIOLATION', () => {
      const r = calculate('F-06', {
        defoliation_rate: 1.5, // 0~1 범위 위반
        elapsed_days: 30,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe('CONSTRAINT_VIOLATION');
      }
    });

    it('0 나누기 → DIVISION_BY_ZERO', () => {
      // F-02: defoliated / (defoliated + attached)
      // defoliated=0, attached=0 → 0/(0+0) = 0/0
      const r = calculate('F-02', { defoliated: 0, attached: 0 });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe('DIVISION_BY_ZERO');
        expect(r.message).toContain('낙엽률');
      }
    });
  });

  describe('정상 계산', () => {
    it('F-01 유과타박률', () => {
      const r = calculate('F-01', { damaged_fruits: 30, normal_fruits: 70 });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value).toBe(0.3);
        expect(r.formulaName).toBe('유과타박률');
      }
    });

    it('F-03 적정표본주수 — ceil 적용', () => {
      const r = calculate('F-03', {
        total_sample: 10,
        variety_target: 33,
        total_target: 100,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        // 10 * (33/100) = 3.3 → ceil → 4
        expect(r.value).toBe(4);
      }
    });

    it('F-11 나무손해보험금 — 피해율 < 5% 시 0 (자기부담 공제)', () => {
      const r = calculate('F-11', {
        insured_amount: 10000000,
        damage_rate: 0.03, // 3% < 5% → max(0.03-0.05, 0) = 0
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value).toBe(0);
      }
    });

    it('F-13 일소 감수과실수 — 6% 미달 시 0', () => {
      const r = calculate('F-13', {
        sunburn_fruits: 50,
        fruits_after_thinning: 1000,
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        // max(50 - 1000*0.06, 0) = max(50 - 60, 0) = 0
        expect(r.value).toBe(0);
      }
    });

    it('결과에 warnings 포함', () => {
      const r = calculate('F-01', { damaged_fruits: 30, normal_fruits: 70 });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.warnings).toEqual([]);
      }
    });
  });
});
