/**
 * M16 AST Parser — equation_template 문자열을 math.js AST로 변환
 *
 * 모든 수식은 이 모듈을 통해서만 파싱된다.
 * 파싱 + 컴파일 결과를 캐싱하여 반복 계산 시 재파싱/재컴파일을 방지한다.
 */

import type { MathNode, EvalFunction } from 'mathjs';
import { safeParse, type ParseResult, type ParseError } from './sandbox';

const MAX_CACHE_SIZE = 200;

interface CachedParse {
  readonly node: MathNode;
  readonly compiled: EvalFunction;
  readonly variables: readonly string[];
}

const cache = new Map<string, CachedParse>();

export interface AstParseSuccess {
  readonly ok: true;
  readonly node: MathNode;
  readonly compiled: EvalFunction;
  readonly variables: readonly string[];
  readonly cached: boolean;
}

export interface AstParseFailure {
  readonly ok: false;
  readonly message: string;
}

export type AstParseResult = AstParseSuccess | AstParseFailure;

/**
 * equation_template를 파싱+컴파일하고 캐시한다.
 * 같은 수식은 한 번만 파싱되며, 이후 캐시에서 반환한다.
 */
export function parseFormula(equationTemplate: string): AstParseResult {
  const cached = cache.get(equationTemplate);
  if (cached) {
    return {
      ok: true,
      node: cached.node,
      compiled: cached.compiled,
      variables: cached.variables,
      cached: true,
    };
  }

  const result: ParseResult | ParseError = safeParse(equationTemplate);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const compiled = result.node.compile();

  // 캐시 크기 제한 (defense-in-depth)
  if (cache.size >= MAX_CACHE_SIZE) {
    cache.clear();
  }

  cache.set(equationTemplate, { node: result.node, compiled, variables: result.variables });
  return { ok: true, node: result.node, compiled, variables: result.variables, cached: false };
}

/**
 * 수식에서 사용된 변수명 목록을 반환한다.
 * 파싱 실패 시 null을 반환한다.
 */
export function extractVariables(equationTemplate: string): readonly string[] | null {
  const result = parseFormula(equationTemplate);
  return result.ok ? result.variables : null;
}

/** 테스트용: 캐시를 비운다. */
export function clearCache(): void {
  cache.clear();
}
