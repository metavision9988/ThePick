/**
 * M08 Ontology Registry — 타입 안전 래퍼
 *
 * ontology-registry.json을 타입화하고, ID 패턴 검증 헬퍼를 제공.
 * Workers 호환 (fs 미사용 — JSON import는 esbuild가 번들링).
 */

import registryData from './ontology-registry.json';
import type { NodeType, EdgeType, ConstantCategory } from '@thepick/shared';

// --- Registry types ---

export interface OntologyRegistry {
  version: string;
  node_types: readonly NodeType[];
  edge_types: readonly EdgeType[];
  node_id_patterns: Record<NodeType, string>;
  formula_id_pattern: string;
  constant_id_pattern: string;
  constant_categories: readonly ConstantCategory[];
}

// --- Runtime validation (as unknown as 대신 구조 검증) ---

function assertRegistryShape(data: unknown): OntologyRegistry {
  const r = data as Record<string, unknown>;

  if (!r.node_types || !Array.isArray(r.node_types)) {
    throw new Error('ontology-registry.json: missing or invalid "node_types"');
  }
  if (!r.edge_types || !Array.isArray(r.edge_types)) {
    throw new Error('ontology-registry.json: missing or invalid "edge_types"');
  }
  if (!r.node_id_patterns || typeof r.node_id_patterns !== 'object') {
    throw new Error('ontology-registry.json: missing or invalid "node_id_patterns"');
  }
  if (typeof r.formula_id_pattern !== 'string') {
    throw new Error('ontology-registry.json: missing or invalid "formula_id_pattern"');
  }
  if (typeof r.constant_id_pattern !== 'string') {
    throw new Error('ontology-registry.json: missing or invalid "constant_id_pattern"');
  }
  if (!r.constant_categories || !Array.isArray(r.constant_categories)) {
    throw new Error('ontology-registry.json: missing or invalid "constant_categories"');
  }

  return data as OntologyRegistry;
}

/** Singleton typed registry */
export const registry: OntologyRegistry = assertRegistryShape(registryData);

// --- Precompiled RegExp cache (built once at module load) ---

function compilePattern(label: string, pattern: string): RegExp {
  try {
    return new RegExp(pattern);
  } catch (err) {
    throw new Error(
      `ontology-registry: Invalid regex for "${label}": "${pattern}" — ${err instanceof Error ? err.message : err}`,
    );
  }
}

const nodePatternCache = new Map<NodeType, RegExp>();
for (const [type, pattern] of Object.entries(registry.node_id_patterns)) {
  nodePatternCache.set(type as NodeType, compilePattern(`node_id_patterns.${type}`, pattern));
}
const formulaPattern = compilePattern('formula_id_pattern', registry.formula_id_pattern);
const constantPattern = compilePattern('constant_id_pattern', registry.constant_id_pattern);

// --- Public API ---

export function isValidNodeType(type: string): type is NodeType {
  return (registry.node_types as readonly string[]).includes(type);
}

export function isValidEdgeType(type: string): type is EdgeType {
  return (registry.edge_types as readonly string[]).includes(type);
}

export function isValidNodeId(type: NodeType, id: string): boolean {
  const re = nodePatternCache.get(type);
  return re ? re.test(id) : false;
}

export function isValidFormulaId(id: string): boolean {
  return formulaPattern.test(id);
}

export function isValidConstantId(id: string): boolean {
  return constantPattern.test(id);
}

export function isValidConstantCategory(category: string): category is ConstantCategory {
  return (registry.constant_categories as readonly string[]).includes(category);
}

/**
 * ID 문자열로부터 NodeType을 역추론.
 * 엣지의 source_id/target_id에는 타입 선언이 없으므로 패턴 매칭으로 추론한다.
 */
export function inferNodeTypeFromId(id: string): NodeType | null {
  for (const [type, re] of nodePatternCache.entries()) {
    if (re.test(id)) return type;
  }
  return null;
}
