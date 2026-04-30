/**
 * Step 13 (Engine Hardening Roadmap v1.3) — sandbox 우회 차단 Property Test (AC-FE-3).
 *
 * `safeParse` 가 무작위 우회 시도를 100% 거부함을 검증한다.
 * step2-formula-property.plan.md §"Sandbox 우회 차단" 5 시나리오 전부.
 *
 * 우회 표면 (sandbox.ts:42-82, 165-222):
 *   1. AssignmentNode (`f := expr`) — ALLOWED_NODE_TYPES 외
 *   2. BLOCKED_SYMBOL_NAMES (constructor / __proto__ / prototype 등)
 *   3. ALLOWED_FUNCTIONS 외 함수 호출 (evaluate / compile / import 등)
 *   4. SAFE_SYMBOL_PATTERN 외 심볼 (대문자 / 숫자 시작 / 하이픈 / 한글)
 *   5. MAX_EXPRESSION_LENGTH = 1024 초과
 */

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { safeParse } from '../sandbox';

const ITERATIONS = 100;

const BLOCKED_SYMBOLS = [
  'constructor',
  'prototype',
  '__proto__',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
];

const DISALLOWED_FUNCTIONS = [
  'evaluate',
  'compile',
  'import',
  'createUnit',
  'reviver',
  'parse',
  'simplify',
  'derivative',
  'resolve',
  'chain',
  'eval',
  'Function',
];

function expectRejected(expression: string): void {
  const result = safeParse(expression);
  if (result.ok) {
    throw new Error(`Expected rejection but parsed successfully: ${expression}`);
  }
  expect(result.ok).toBe(false);
}

describe('formula-engine sandbox bypass property (AC-FE-3)', () => {
  it(`AssignmentNode 거부 (f := ... ${ITERATIONS}회)`, () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9_]*$/).filter((s) => s.length > 0 && s.length < 16),
        fc.integer({ min: 1, max: 1_000 }),
        (lhs, rhs) => {
          expectRejected(`${lhs} = ${rhs}`);
        },
      ),
      { numRuns: ITERATIONS, endOnFailure: true },
    );
  });

  it(`BLOCKED_SYMBOL_NAMES 거부 (${ITERATIONS}회)`, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BLOCKED_SYMBOLS),
        fc.integer({ min: 0, max: 1_000 }),
        (sym, n) => {
          expectRejected(`${sym} + ${n}`);
        },
      ),
      { numRuns: ITERATIONS, endOnFailure: true },
    );
  });

  it(`ALLOWED_FUNCTIONS 외 함수 호출 거부 (${ITERATIONS}회)`, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DISALLOWED_FUNCTIONS),
        fc.integer({ min: 1, max: 1_000 }),
        (fn, arg) => {
          expectRejected(`${fn}(${arg})`);
        },
      ),
      { numRuns: ITERATIONS, endOnFailure: true },
    );
  });

  it(`SAFE_SYMBOL_PATTERN 외 심볼 거부 — 대문자 시작 (${ITERATIONS}회)`, () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Z][A-Za-z0-9_]*$/).filter((s) => s.length > 0 && s.length < 32),
        (sym) => {
          expectRejected(`${sym} + 1`);
        },
      ),
      { numRuns: ITERATIONS, endOnFailure: true },
    );
  });

  // "숫자 시작 심볼" (예: 3cr) 시나리오는 mathjs 의 implicit multiplication 으로
  // "3 * cr" 로 해석되므로 우회 표면 아님. 본 test 제외.
  // 비ASCII 심볼 거부는 별도 unit test (sandbox.test.ts) 에서 검증.

  it('MAX_EXPRESSION_LENGTH = 1024 초과 거부 (length boundary)', () => {
    // length 검증은 sandbox.ts:244 의 단순 비교 (`expression.length > MAX_EXPRESSION_LENGTH`).
    // property test 가치 낮음 — boundary 1건 + 큰 값 1건 만 검증.
    const justOver = '1' + ' + 1'.repeat(257); // 1 + 4*257 = 1029 char
    expect(justOver.length).toBeGreaterThan(1024);
    expectRejected(justOver);

    const huge = '1' + ' + 1'.repeat(1024); // 1 + 4*1024 = 4097 char
    expectRejected(huge);
  });

  it('정상 표현식은 통과한다 (golden — 회귀 차단)', () => {
    const result = safeParse('damaged_fruits / (damaged_fruits + normal_fruits)');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([...result.variables].sort()).toEqual(['damaged_fruits', 'normal_fruits']);
    }
  });
});
