/**
 * M11 Normalizer — invariant / tolerable 분리 (Step 14 Engine Hardening)
 *
 * parser 출력의 결정적 필드(invariant)와 허용 분산 필드(tolerable)를 분리하여
 * AC-PA-1 (invariant 100% 동일) / AC-PA-2 (tolerable ≤ 5% 변동) 검증을 가능하게 한다.
 *
 * Phase 1 후반 LLM 통합 시 KnowledgeContract 의 nodes/edges/formulas/constants 가
 * 채워지면 본 normalizer 의 모든 invariant 필드가 의미를 가진다. Step 14a (현 시점)
 * 에서는 LLM 미통합 상태이므로 section_hierarchy + ontology_registry_match 가
 * 결정적 핵심이며, 나머지 invariant 는 빈 contract 입력 시 빈 결과를 반환한다.
 */

import { createHash } from 'node:crypto';
import { validateKnowledgeContract } from './schema-validator';
import type { KnowledgeContract, ValidationErrorCode } from './schema-validator';
import type { Section } from './section-splitter';

// --- Types ---

export interface ParserOutput {
  contract: KnowledgeContract;
  sections: Section[];
  /** 페이지별 raw text (tolerable 비교용) */
  pageTexts?: string[];
}

export interface InvariantSnapshot {
  /** 알파벳 정렬된 모든 노드 ID */
  node_ids: string[];
  /** 정렬된 엣지 그래프의 canonical JSON 직렬 */
  edge_dependency_graph: string;
  /** formula_id → SHA-256(equation_template + variables_schema) */
  formula_AST_hashes: Record<string, string>;
  /** 모든 ID/타입/카테고리가 ontology-registry 일치 여부 */
  ontology_registry_match: boolean;
  /** const_id → "value|category" canonical form */
  constants_canonical_forms: Record<string, string>;
  /** 섹션 트리의 canonical JSON 직렬 */
  section_hierarchy: string;
}

export interface TolerableSnapshot {
  raw_line_break_count: number;
  /** 페이지당 공백 비율 (0 ~ 1) */
  whitespace_density: number;
  /** Phase 3 Vision 통합 후 채워짐 — 현재 빈 배열 */
  vision_corrected_segments: string[];
}

export type InvariantCompareResult = 'equal' | 'differs';

export interface TolerableCompareResult {
  /** 0 ~ 1 정규화 분산 (1 = 100% 차이) */
  variance: number;
  /** variance ≤ threshold */
  passed: boolean;
}

// --- Constants ---

/** AC-PA-2 기본 임계 (contract.yaml tolerance_threshold = 0.05) */
export const DEFAULT_TOLERABLE_THRESHOLD = 0.05;

/** formula_AST_hashes 합성 시 equation_template 와 variables_schema 사이 충돌 방지 구분자. */
const HASH_SEPARATOR = '|::|';

/** ontology_registry_match 위반 코드 */
const ONTOLOGY_VIOLATION_CODES: ReadonlySet<ValidationErrorCode> = new Set<ValidationErrorCode>([
  'INVALID_NODE_TYPE',
  'INVALID_NODE_ID_PATTERN',
  'INVALID_EDGE_TYPE',
  'INVALID_FORMULA_ID',
  'INVALID_CONSTANT_ID',
  'INVALID_CONSTANT_CATEGORY',
]);

// --- Helpers ---

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * variables_schema (KnowledgeContractFormula 의 string 필드) 는 LLM 출력 시점에 객체 키
 * 순서가 비결정일 수 있다. AC-PA-1 결정성 보장을 위해 JSON.parse 후 canonicalJson 으로
 * 정규화한다. parse 실패 시 (schema-validator 가 별도 검증) raw 문자열 그대로 사용해
 * 결정성 hole 없이 합법 입력만 정규화한다.
 */
function canonicalizeVariablesSchema(schema: string): string {
  try {
    return canonicalJson(JSON.parse(schema));
  } catch {
    return schema;
  }
}

/** 객체 키 정렬 + 배열 직렬을 보장하는 canonical JSON */
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value ?? null);
  }
  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const parts = keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(record[k]));
  return '{' + parts.join(',') + '}';
}

interface SerializedSection {
  level: Section['level'];
  heading: string;
  startPage: number;
  endPage: number;
  children: SerializedSection[];
}

function serializeSection(section: Section): SerializedSection {
  return {
    level: section.level,
    heading: section.heading,
    startPage: section.startPage,
    endPage: section.endPage,
    children: section.children.map(serializeSection),
  };
}

// --- Invariant 추출 ---

export function extractInvariantFields(output: ParserOutput): InvariantSnapshot {
  const { contract, sections } = output;

  const nodeIds = contract.nodes.map((n) => n.id).sort();

  const sortedEdges = [...contract.edges].sort((a, b) => {
    const sa = a.source_id ?? '';
    const sb = b.source_id ?? '';
    if (sa !== sb) return sa < sb ? -1 : 1;
    const ta = a.target_id ?? '';
    const tb = b.target_id ?? '';
    if (ta !== tb) return ta < tb ? -1 : 1;
    const ea = a.edge_type ?? '';
    const eb = b.edge_type ?? '';
    if (ea !== eb) return ea < eb ? -1 : 1;
    const ca = a.condition ?? '';
    const cb = b.condition ?? '';
    return ca < cb ? -1 : ca > cb ? 1 : 0;
  });
  const edgeDependencyGraph = canonicalJson(
    sortedEdges.map((e) => ({
      source_id: e.source_id ?? null,
      target_id: e.target_id ?? null,
      edge_type: e.edge_type ?? null,
      condition: e.condition ?? null,
    })),
  );

  const formulaAstHashes: Record<string, string> = {};
  for (const f of contract.formulas) {
    // variables_schema 는 schema-validator 시점에 string (JSON 직렬) 이지만 LLM 출력 단계에서
    // 객체 키 순서가 비결정일 수 있으므로 canonicalJson 으로 정규화 후 합성. equation_template
    // 텍스트와 schema 텍스트를 명시적 SEPARATOR 로 구분해 합성 충돌을 차단한다.
    const eq = f.equation_template;
    const vs = canonicalizeVariablesSchema(f.variables_schema);
    formulaAstHashes[f.id] = sha256Hex(`${eq}${HASH_SEPARATOR}${vs}`);
  }

  const validation = validateKnowledgeContract(contract);
  const ontologyMatch = !validation.errors.some((e) => ONTOLOGY_VIOLATION_CODES.has(e.code));

  const constantCanonicalForms: Record<string, string> = {};
  for (const c of contract.constants) {
    constantCanonicalForms[c.id] = `${c.value}|${c.category}`;
  }

  const sectionHierarchy = canonicalJson(sections.map(serializeSection));

  return {
    node_ids: nodeIds,
    edge_dependency_graph: edgeDependencyGraph,
    formula_AST_hashes: formulaAstHashes,
    ontology_registry_match: ontologyMatch,
    constants_canonical_forms: constantCanonicalForms,
    section_hierarchy: sectionHierarchy,
  };
}

// --- Tolerable 추출 ---

export function extractTolerableFields(output: ParserOutput): TolerableSnapshot {
  const pageTexts = output.pageTexts ?? [];

  let lineBreakCount = 0;
  let totalChars = 0;
  let whitespaceChars = 0;

  for (const text of pageTexts) {
    for (const ch of text) {
      totalChars++;
      if (ch === '\n') {
        lineBreakCount++;
        whitespaceChars++;
      } else if (/\s/.test(ch)) {
        whitespaceChars++;
      }
    }
  }

  return {
    raw_line_break_count: lineBreakCount,
    whitespace_density: totalChars > 0 ? whitespaceChars / totalChars : 0,
    vision_corrected_segments: [],
  };
}

// --- 비교 ---

export function compareInvariant(
  a: InvariantSnapshot,
  b: InvariantSnapshot,
): InvariantCompareResult {
  return canonicalJson(a) === canonicalJson(b) ? 'equal' : 'differs';
}

export function compareTolerable(
  a: TolerableSnapshot,
  b: TolerableSnapshot,
  threshold: number = DEFAULT_TOLERABLE_THRESHOLD,
): TolerableCompareResult {
  const lineBreakDenom = Math.max(a.raw_line_break_count, b.raw_line_break_count, 1);
  const lineBreakDiff = Math.abs(a.raw_line_break_count - b.raw_line_break_count) / lineBreakDenom;

  const whitespaceDenom = Math.max(a.whitespace_density, b.whitespace_density, 1e-6);
  const whitespaceDiff = Math.abs(a.whitespace_density - b.whitespace_density) / whitespaceDenom;

  const variance = (lineBreakDiff + whitespaceDiff) / 2;
  return {
    variance,
    passed: variance <= threshold,
  };
}
