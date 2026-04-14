import { describe, it, expect } from 'vitest';
import { mapVariables } from '../variable-mapper';
import type { FormulaDefinition } from '../types';

const BASE_DEF: FormulaDefinition = {
  id: 'F-TEST',
  name: 'Test Formula',
  equationTemplate: 'a + b',
  equationDisplay: 'a + b',
  variablesSchema: [
    { name: 'a', displayName: 'A값', type: 'number', required: true },
    { name: 'b', displayName: 'B값', type: 'number', required: true },
  ],
  constraints: [],
  versionYear: 2025,
  resultPrecision: 4,
};

describe('variable-mapper', () => {
  describe('필수 변수 검증', () => {
    it('모든 변수 제공 시 성공', () => {
      const r = mapVariables(BASE_DEF, { a: 1, b: 2 });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.scope).toEqual({ a: 1, b: 2 });
      }
    });

    it('필수 변수 누락 시 에러', () => {
      const r = mapVariables(BASE_DEF, { a: 1 });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0].code).toBe('VARIABLE_MISSING');
      }
    });

    it('여러 변수 누락 시 모든 에러 누적', () => {
      const r = mapVariables(BASE_DEF, {});
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors).toHaveLength(2);
      }
    });
  });

  describe('타입 검증', () => {
    it('숫자가 아닌 값 → 에러', () => {
      const r = mapVariables(BASE_DEF, { a: 'hello', b: 2 });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors[0].code).toBe('VARIABLE_TYPE_MISMATCH');
      }
    });

    it('integer 변수에 소수 → 에러', () => {
      const def: FormulaDefinition = {
        ...BASE_DEF,
        variablesSchema: [{ name: 'a', displayName: 'A값', type: 'integer', required: true }],
      };
      const r = mapVariables(def, { a: 3.5 });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors[0].code).toBe('VARIABLE_TYPE_MISMATCH');
      }
    });

    it('ratio 범위 벗어나면 경고 (에러 아님)', () => {
      const def: FormulaDefinition = {
        ...BASE_DEF,
        variablesSchema: [{ name: 'a', displayName: 'A값', type: 'ratio', required: true }],
      };
      const r = mapVariables(def, { a: 1.5 });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.warnings).toHaveLength(1);
      }
    });
  });

  describe('constraints 검증', () => {
    it('non_negative 위반', () => {
      const def: FormulaDefinition = {
        ...BASE_DEF,
        constraints: [{ variable: 'a', rule: 'non_negative', message: 'a must be >= 0' }],
      };
      const r = mapVariables(def, { a: -1, b: 2 });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors[0].code).toBe('CONSTRAINT_VIOLATION');
        expect(r.errors[0].message).toBe('a must be >= 0');
      }
    });

    it('positive 위반 (0은 양수가 아님)', () => {
      const def: FormulaDefinition = {
        ...BASE_DEF,
        constraints: [{ variable: 'b', rule: 'positive', message: 'b must be > 0' }],
      };
      const r = mapVariables(def, { a: 1, b: 0 });
      expect(r.ok).toBe(false);
    });

    it('range 위반', () => {
      const def: FormulaDefinition = {
        ...BASE_DEF,
        constraints: [
          { variable: 'a', rule: 'range', min: 0, max: 100, message: 'a must be 0-100' },
        ],
      };
      const r = mapVariables(def, { a: 150, b: 2 });
      expect(r.ok).toBe(false);
    });
  });
});
