/**
 * M16 Math.js Sandboxed Instance
 *
 * 동적 코드 실행을 원천 차단한 math.js 인스턴스를 제공한다.
 *
 * DEFCON L3: 이 파일 변경 시 반드시 보안 리뷰 필수.
 *
 * 보안 + 번들 최적화 전략:
 *   1. `*Dependencies` 선택 임포트로 필요한 24개 함수 + 내장 상수 2종(pi·e)만 포함
 *      (mathjs custom_bundling). 이전 `create(all)` 패턴은 전체 번들(160KB gz) 포함 → 선택 임포트로 절감.
 *   2. parse 참조를 내부에 보관 (internalParse).
 *   3. 위험 함수(evaluate/compile/simplify 등)를 throwing stub으로 덮어씀.
 *   4. safeParse()에서 AST 노드를 화이트리스트로 검증.
 *   5. 외부에는 safeParse + safeEvaluate만 노출.
 *
 * ALLOWED_FUNCTIONS 와 *Dependencies 리스트는 반드시 1:1 동기 유지.
 * (예외 2종 — formula-engine-expansion.plan.md §3-2:
 *   - `deg2rad` 는 mathjs 내장이 아닌 커스텀 typed 함수 — Dependencies 없음,
 *     stub self-override *이전에* math.import 로 등록 (§2-(h) 초기화 순서 제약).
 *   - `pi`/`e` 는 함수가 아닌 내장 상수 — piDependencies/eDependencies 로 공급,
 *     BUILTIN_CONSTANT_SYMBOLS 로 변수 추출/scope 주입에서 제외·차단.)
 */

import {
  create,
  parseDependencies,
  typedDependencies,
  addDependencies,
  subtractDependencies,
  multiplyDependencies,
  divideDependencies,
  modDependencies,
  ceilDependencies,
  floorDependencies,
  roundDependencies,
  maxDependencies,
  minDependencies,
  absDependencies,
  sqrtDependencies,
  powDependencies,
  logDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
  // Tier 2 확장 (formula-engine-expansion.plan.md §3-2 — 2호 전기기사 삼각·지수)
  sinDependencies,
  cosDependencies,
  tanDependencies,
  asinDependencies,
  acosDependencies,
  atanDependencies,
  expDependencies,
  // Tier 1 확장 (plan §3-1 Q1-(a) — π·e 엔진 내장, constants DB 미적재)
  piDependencies,
  eDependencies,
  type MathNode,
} from 'mathjs';
import { CalculationTimeoutError } from './errors';

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
  // Tier 2 확장 — 삼각 6 + exp (plan §3-2. mathjs trig 는 라디안 전용 — 각도 규약 Q3-A안)
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'exp',
  // 각도 규약 Q3-A안 — 커스텀 typed 함수 (아래 stub 이전 등록 블록 참조)
  'deg2rad',
]);

// --- 내장 상수 심볼 (Tier 1 — plan §3-1 Q1-(a)) ---
// pi/e 는 mathjs 인스턴스 내장값이 정본 (constants DB 미적재 — 이중 진실원 방지).
// 1) safeParse 변수 추출에서 제외 — 미제외 시 모든 π 산식이 "pi 입력 누락" 오류.
// 2) safeEvaluate scope 키로 차단 — scope 주입이 내장 상수를 *무음 shadow* 하는 것 실측
//    확인 (scope {pi:3} → 'pi' 평가 = 3). 값 정확성은 G-FE-7 게이트 (Math.PI/Math.E 동치).
const BUILTIN_CONSTANT_SYMBOLS = new Set(['pi', 'e']);

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

// --- math.js 인스턴스 생성 (선택 임포트) ---

/**
 * ALLOWED_FUNCTIONS 와 1:1 매핑되는 dependency 묶음.
 * parse + typed 는 AST 파서가 반드시 필요.
 * 함수 추가 시 여기 + ALLOWED_FUNCTIONS 양쪽 동기 업데이트.
 */
const math = create({
  parseDependencies,
  typedDependencies,
  addDependencies,
  subtractDependencies,
  multiplyDependencies,
  divideDependencies,
  modDependencies,
  ceilDependencies,
  floorDependencies,
  roundDependencies,
  maxDependencies,
  minDependencies,
  absDependencies,
  sqrtDependencies,
  powDependencies,
  logDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
  // Tier 2 — 삼각 6 + exp
  sinDependencies,
  cosDependencies,
  tanDependencies,
  asinDependencies,
  acosDependencies,
  atanDependencies,
  expDependencies,
  // Tier 1 — 내장 상수 pi·e
  piDependencies,
  eDependencies,
});

// parse 참조를 교체 전에 확보
const internalParse = math.parse;

// --- deg2rad 커스텀 함수 등록 (각도 규약 Q3-A안 — plan §4) ---
// ★ 초기화 순서 제약 (plan §2-(h)): 아래 throwing stub 블록이 math.import 자체를
//   self-override 하므로, 커스텀 함수 등록은 반드시 stub 설치 *이전* 이어야 한다.
//   (stub 설치 후 math.import 호출 = 'Disabled: import' throw — 테스트로 확증.)
// mathjs trig 는 라디안 전용 — 도(°) 단위 문항은 `sin(deg2rad(theta_deg))` 형태로
// 단위 변환이 식 안에서 자기서술된다. typed 함수라 비숫자 인자는 fail-loud throw.
// Math.PI 사용: mathjs 내장 pi 와 완전 동치 (G-FE-7 게이트가 자릿수 동치 검증).
math.import({
  deg2rad: math.typed('deg2rad', {
    number: (deg: number): number => (deg * Math.PI) / 180,
  }),
});

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
 *
 * Sprint 1 §5.3 CHA-02 — AST 복잡도/깊이 사전 차단:
 *   - MAX_AST_NODE_COUNT: 노드 총수 한도. 정상 산식 (F-01~F-68) 모두 ≤ 50.
 *     Sprint 1 §5.4 흡수 (Pass 3 MAJOR-10): 500 → 200 보수화 (4× 여유).
 *     "1+1+1+..." 100+ 반복 같은 폭탄 차단 즉시 발화.
 *   - MAX_AST_DEPTH: 트리 깊이 한도. 정상 산식 모두 ≤ 10.
 *     Sprint 1 §5.4 흡수 (Pass 3 MAJOR-10): 30 → 15 보수화 (1.5× 여유).
 *     `((((...))))` 같은 중첩 폭탄 차단 즉시 발화.
 *   - 한도 초과 시 CalculationTimeoutError throw → engine.calculate() 가
 *     COMPUTE_TIMEOUT FormulaError 로 매핑.
 *   - 한도 변경 절차: ADR-029 §2.4 (cache invalidation + 회귀 게이트 + Decision Log).
 */
const MAX_EXPRESSION_LENGTH = 1024;
export const MAX_AST_NODE_COUNT = 200;
export const MAX_AST_DEPTH = 15;

/**
 * AST 깊이 계산 — iterative DFS (Sprint 1 §5.4 흡수 — Pass 1 M4).
 *
 * 이전 순수 재귀 구현은 V8 stack overflow 시 RangeError 가 engine.ts catch 우회 throw
 * propagate 가능. iterative + 명시 stack 으로 stack-safe 변환.
 *
 * 결과: 동일 (모든 노드의 depth = root 부터 leaf 까지 최장 경로 + 1).
 */
function computeAstDepth(root: MathNode): number {
  // stack: [node, depth] — DFS pre-order
  const stack: { node: MathNode; depth: number }[] = [{ node: root, depth: 1 }];
  let maxDepth = 0;

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) break;
    const { node, depth } = frame;
    if (depth > maxDepth) maxDepth = depth;
    node.forEach((child: MathNode) => {
      stack.push({ node: child, depth: depth + 1 });
    });
  }

  return maxDepth;
}

export function assertWithinComplexityBudget(node: MathNode): void {
  let nodeCount = 0;
  node.traverse(() => {
    nodeCount++;
  });
  if (nodeCount > MAX_AST_NODE_COUNT) {
    throw new CalculationTimeoutError(
      'ast_too_complex',
      `Expression too complex: ${nodeCount} AST nodes (limit ${MAX_AST_NODE_COUNT})`,
      { nodeCount, limit: MAX_AST_NODE_COUNT },
    );
  }
  const depth = computeAstDepth(node);
  if (depth > MAX_AST_DEPTH) {
    throw new CalculationTimeoutError(
      'ast_too_deep',
      `Expression too deep: ${depth} AST levels (limit ${MAX_AST_DEPTH})`,
      { depth, limit: MAX_AST_DEPTH },
    );
  }
}

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

  // CHA-02 — 복잡도/깊이 한도 (CalculationTimeoutError 는 catch 하지 않고 propagate).
  // engine.calculate() 가 catch 하여 COMPUTE_TIMEOUT 매핑 의무.
  assertWithinComplexityBudget(node);

  try {
    validateNode(node);
  } catch (e) {
    if (e instanceof UnsafeExpressionError) {
      return { ok: false, message: e.message };
    }
    throw e;
  }

  // AST에서 변수명(SymbolNode) 추출
  // BUILTIN_CONSTANT_SYMBOLS(pi/e) 는 엔진 내장 상수 — 입력 변수로 추출하지 않는다
  // (미제외 시 registry 교차검증/variable-mapper 가 "pi 입력 누락"으로 전 π 산식 거부).
  const variables: string[] = [];
  const seen = new Set<string>();
  node.filter((n: MathNode) => {
    if (n.type === 'SymbolNode') {
      const name = (n as MathNode & { name: string }).name;
      if (!seen.has(name) && !ALLOWED_FUNCTIONS.has(name) && !BUILTIN_CONSTANT_SYMBOLS.has(name)) {
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
 *
 * Sprint 1 §5.3 CHA-02 — wall-clock 사후 차단:
 *   compiled.evaluate 는 sync — sync 코드 preempt 불가. 따라서 사전 (AST 복잡도) +
 *   사후 (실 elapsed) 이중 방어. MAX_EVAL_MS 초과 시 CalculationTimeoutError throw.
 *   sandbox.ts AST 검증이 정상 동작 시 evaluate 는 항상 < 1ms — eval_timeout 발생 자체가
 *   defense-in-depth signal (mathjs 라이브러리 회귀 / 미예측 vector 조기 경보).
 *
 * 4-Pass Pass 1 M3 / Pass 3 M2 흡수:
 *   `Date.now()` 는 vi.useFakeTimers 활성 시 mock 됨 → CHA-04 가 보호하는 NTP skew 가
 *   CHA-02 측정에 그대로 노출. `performance.now()` 는 fake timer 영향 없는 monotonic clock —
 *   Node 22 + Workers 양쪽 가용. globalThis.performance fallback 으로 환경 호환.
 */
export const MAX_EVAL_MS = 50;

function nowMs(): number {
  // performance.now() 는 monotonic, fake timer 영향 X (Node 22 / Workers 모두 가용).
  // Workers compatibility_date 2024+ 는 globalThis.performance 보장. Node 22 도 동일.
  return typeof globalThis.performance !== 'undefined' &&
    typeof globalThis.performance.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

export function safeEvaluate(
  compiled: { evaluate: (scope: Record<string, number>) => unknown },
  scope: Record<string, number>,
): number {
  // 선언된 변수만 포함하는 깨끗한 scope 생성
  // 보안: scope 키를 BLOCKED_SYMBOL_NAMES + SAFE_SYMBOL_PATTERN으로 검증.
  // 추가로 내장 상수(pi/e)·허용 함수명은 scope 주입 시 mathjs 네임스페이스를
  // *무음 shadow* 하므로 (실측: {pi:3} → 'pi' 평가 = 3 — 65↔60 동급 무음 오답 클래스)
  // fail-loud 차단한다. 코드 68식 변수명과 충돌 0건 실측 (G-FE-6) — 회귀 없음.
  const safeScope: Record<string, number> = {};
  for (const [key, value] of Object.entries(scope)) {
    if (BLOCKED_SYMBOL_NAMES.has(key) || !SAFE_SYMBOL_PATTERN.test(key)) {
      throw new Error(`Unsafe scope key: ${key}`);
    }
    if (BUILTIN_CONSTANT_SYMBOLS.has(key) || ALLOWED_FUNCTIONS.has(key)) {
      throw new Error(`Unsafe scope key (shadows builtin constant/function): ${key}`);
    }
    safeScope[key] = value;
  }

  // CHA-02 — wall-clock 측정 (performance.now 우선, fake timer 우회).
  const startMs = nowMs();
  const result = compiled.evaluate(safeScope);
  const elapsedMs = nowMs() - startMs;

  if (elapsedMs > MAX_EVAL_MS) {
    throw new CalculationTimeoutError(
      'eval_timeout',
      `Evaluation timeout: ${elapsedMs}ms (limit ${MAX_EVAL_MS}ms)`,
      { elapsedMs, limitMs: MAX_EVAL_MS },
    );
  }

  if (typeof result !== 'number') {
    throw new Error(`Evaluation result is not a number: ${typeof result}`);
  }

  if (!Number.isFinite(result)) {
    throw new Error('Division by zero or overflow');
  }

  return result;
}
