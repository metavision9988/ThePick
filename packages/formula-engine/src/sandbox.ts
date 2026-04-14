/**
 * M16 Math.js Sandboxed Instance
 *
 * 동적 코드 실행을 원천 차단한 math.js 인스턴스를 제공한다.
 *
 * DEFCON L3: 이 파일 변경 시 반드시 보안 리뷰 필수.
 *
 * 보안 전략:
 *   1. create(all)로 전체 인스턴스 생성
 *   2. parse/compile 참조를 내부에 보관
 *   3. 위험 함수를 throwing stub으로 교체
 *   4. safeParse()에서 AST 노드를 화이트리스트로 검증
 *   5. 외부에는 safeParse + safeEvaluate만 노출
 */

import { create, all, type MathNode } from 'mathjs';

// --- 허용 함수 화이트리스트 ---

const ALLOWED_FUNCTIONS = new Set([
  'add',
  'subtract',
  'multiply',
  'divide',
  'mod',
  'ceil',
  'floor',
  'round',
  'max',
  'min',
  'abs',
  'sqrt',
  'pow',
  'log',
  'unaryMinus',
  'unaryPlus',
]);

// --- 안전 심볼 패턴 (화이트리스트) ---
// 영문 소문자 + 숫자 + 언더스코어만 허용.
const SAFE_SYMBOL_PATTERN = /^[a-z][a-z0-9_]*$/;

// Object.prototype 메서드 중 정규식을 통과하는 위험 이름 차단
const BLOCKED_SYMBOL_NAMES = new Set([
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
]);

// --- math.js 인스턴스 생성 ---

const math = create(all);

// parse 참조를 교체 전에 확보
const internalParse = math.parse;

// 위험 함수를 throwing stub으로 교체
math.import(
  {
    import: function () {
      throw new Error('Disabled: import');
    },
    createUnit: function () {
      throw new Error('Disabled: createUnit');
    },
    reviver: function () {
      throw new Error('Disabled: reviver');
    },
    evaluate: function () {
      throw new Error('Disabled: evaluate');
    },
    parse: function () {
      throw new Error('Disabled: parse');
    },
    simplify: function () {
      throw new Error('Disabled: simplify');
    },
    derivative: function () {
      throw new Error('Disabled: derivative');
    },
    resolve: function () {
      throw new Error('Disabled: resolve');
    },
    compile: function () {
      throw new Error('Disabled: compile');
    },
    chain: function () {
      throw new Error('Disabled: chain');
    },
  },
  { override: true },
);

// --- AST 검증 ---

export class UnsafeExpressionError extends Error {
  constructor(
    message: string,
    public readonly nodeType: string,
    public readonly nodeName: string,
  ) {
    super(message);
    this.name = 'UnsafeExpressionError';
  }
}

// 산식에서 허용되는 AST 노드 타입 (화이트리스트)
const ALLOWED_NODE_TYPES = new Set([
  'ConstantNode',
  'SymbolNode',
  'OperatorNode',
  'ParenthesisNode',
  'FunctionNode',
]);

function validateNode(node: MathNode): void {
  node.traverse((n: MathNode) => {
    const type = n.type;

    // 노드 타입 화이트리스트 검증
    if (!ALLOWED_NODE_TYPES.has(type)) {
      throw new UnsafeExpressionError(`Node type not allowed: ${type}`, type, n.toString());
    }

    if (type === 'FunctionNode') {
      const fn = n as MathNode & { fn: MathNode; name?: string };
      // FunctionNode의 fn이 SymbolNode가 아닌 경우 (동적 호출) 차단
      if (fn.fn.type !== 'SymbolNode') {
        throw new UnsafeExpressionError(
          `Dynamic function call not allowed: ${n.toString()}`,
          type,
          n.toString(),
        );
      }
      const fnName = (fn.fn as MathNode & { name: string }).name;
      if (!ALLOWED_FUNCTIONS.has(fnName)) {
        throw new UnsafeExpressionError(`Not allowed: ${fnName}`, type, fnName);
      }
    }

    // ConstantNode: 숫자 상수만 허용 (문자열 상수 차단)
    if (type === 'ConstantNode') {
      const constant = n as MathNode & { value: unknown };
      if (typeof constant.value !== 'number') {
        throw new UnsafeExpressionError(
          `Non-numeric constant not allowed: ${n.toString()}`,
          type,
          n.toString(),
        );
      }
    }

    // SymbolNode: 안전 패턴(영문 소문자+숫자+_)만 허용 + 위험 이름 차단
    if (type === 'SymbolNode') {
      const sym = n as MathNode & { name: string };
      if (BLOCKED_SYMBOL_NAMES.has(sym.name)) {
        throw new UnsafeExpressionError(`Symbol not allowed: ${sym.name}`, type, sym.name);
      }
      if (!SAFE_SYMBOL_PATTERN.test(sym.name) && !ALLOWED_FUNCTIONS.has(sym.name)) {
        throw new UnsafeExpressionError(`Symbol not allowed: ${sym.name}`, type, sym.name);
      }
    }
  });
}

// --- 공개 API ---

export interface ParseResult {
  readonly ok: true;
  readonly node: MathNode;
  readonly variables: readonly string[];
}

export interface ParseError {
  readonly ok: false;
  readonly message: string;
}

/**
 * 수식 문자열을 안전하게 파싱한다.
 * AST 노드를 순회하여 허용되지 않은 함수/프로퍼티를 차단한다.
 */
const MAX_EXPRESSION_LENGTH = 1024;

export function safeParse(expression: string): ParseResult | ParseError {
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    return {
      ok: false,
      message: `Expression too long (${expression.length} > ${MAX_EXPRESSION_LENGTH})`,
    };
  }

  let node: MathNode;
  try {
    node = internalParse(expression);
  } catch (e) {
    return {
      ok: false,
      message: `Parse failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  try {
    validateNode(node);
  } catch (e) {
    if (e instanceof UnsafeExpressionError) {
      return { ok: false, message: e.message };
    }
    throw e;
  }

  // AST에서 변수명(SymbolNode) 추출
  const variables: string[] = [];
  const seen = new Set<string>();
  node.filter((n: MathNode) => {
    if (n.type === 'SymbolNode') {
      const name = (n as MathNode & { name: string }).name;
      if (!seen.has(name) && !ALLOWED_FUNCTIONS.has(name)) {
        seen.add(name);
        variables.push(name);
      }
    }
    return false;
  });

  return { ok: true, node, variables };
}

/**
 * 사전 컴파일된 수식을 주어진 scope로 평가한다.
 */
export function safeEvaluate(
  compiled: { evaluate: (scope: Record<string, number>) => unknown },
  scope: Record<string, number>,
): number {
  // 선언된 변수만 포함하는 깨끗한 scope 생성
  // 보안: scope 키를 BLOCKED_SYMBOL_NAMES + SAFE_SYMBOL_PATTERN으로 검증
  const safeScope: Record<string, number> = {};
  for (const [key, value] of Object.entries(scope)) {
    if (BLOCKED_SYMBOL_NAMES.has(key) || !SAFE_SYMBOL_PATTERN.test(key)) {
      throw new Error(`Unsafe scope key: ${key}`);
    }
    safeScope[key] = value;
  }

  const result = compiled.evaluate(safeScope);

  if (typeof result !== 'number') {
    throw new Error(`Evaluation result is not a number: ${typeof result}`);
  }

  if (!Number.isFinite(result)) {
    throw new Error('Division by zero or overflow');
  }

  return result;
}
