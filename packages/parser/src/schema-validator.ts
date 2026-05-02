/**
 * M08 Schema Validator — Knowledge Contract JSON 검증기
 *
 * Claude API 배치 프로세서(M07)가 생성한 Knowledge Contract JSON이
 * Ontology Registry의 ID 체계를 준수하는지 검증한다.
 * 미등록 ID → 거부 + 전체 에러 목록 반환 (재수행 효율).
 *
 * 필드 매핑 참고 (Knowledge Contract → DB):
 *   title → name, content → description, source_page → page_ref
 *   매핑은 DB 적재 단계(Step 0-9)에서 처리.
 */

import type { NodeType } from '@thepick/shared';
import { EXAM_IDS } from '@thepick/shared';
import {
  registry,
  isValidNodeType,
  isValidEdgeType,
  isValidNodeId,
  isValidFormulaId,
  isValidConstantId,
  isValidConstantCategory,
  inferNodeTypeFromId,
} from './ontology-registry';
import { KnowledgeContractValidationError } from './errors';

// --- Knowledge Contract types ---

export interface KnowledgeContractNode {
  id: string;
  type: string;
  title: string;
  content: string;
  lv1_insurance?: string;
  lv2_crop?: string;
  lv3_investigation?: string;
  truth_weight: number;
  source_page: number;
}

export interface KnowledgeContractEdge {
  source_id: string;
  target_id: string;
  edge_type: string;
  condition?: string;
}

export interface KnowledgeContractFormula {
  id: string;
  name: string;
  equation_template: string;
  variables_schema: string;
  /** 출처 페이지 — 북극성(출처 추적성) 강제. 비어 있으면 MISSING_SOURCE_PAGE 에러. */
  source_page: number;
}

export interface KnowledgeContractConstant {
  id: string;
  name: string;
  value: string;
  category: string;
  /** 출처 페이지 — 북극성(출처 추적성) 강제. 비어 있으면 MISSING_SOURCE_PAGE 에러. */
  source_page: number;
}

export interface KnowledgeContract {
  nodes: KnowledgeContractNode[];
  edges: KnowledgeContractEdge[];
  formulas: KnowledgeContractFormula[];
  constants: KnowledgeContractConstant[];
}

// --- Validation result types ---

export type ValidationErrorCode =
  | 'INVALID_NODE_TYPE'
  | 'INVALID_NODE_ID_PATTERN'
  | 'INVALID_EDGE_TYPE'
  | 'INVALID_EDGE_SOURCE_ID'
  | 'INVALID_EDGE_TARGET_ID'
  | 'INVALID_FORMULA_ID'
  | 'INVALID_CONSTANT_ID'
  | 'INVALID_CONSTANT_CATEGORY'
  | 'MISSING_REQUIRED_FIELD'
  | 'MISSING_SOURCE_PAGE'
  | 'INVALID_TRUTH_WEIGHT'
  | 'DANGLING_EDGE_REFERENCE'
  | 'DUPLICATE_NODE_ID'
  | 'INVALID_CONTRACT_STRUCTURE';

export interface ValidationError {
  path: string;
  code: ValidationErrorCode;
  message: string;
  value: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  stats: {
    nodesValidated: number;
    edgesValidated: number;
    formulasValidated: number;
    constantsValidated: number;
  };
}

// --- Helpers ---

function err(
  path: string,
  code: ValidationErrorCode,
  message: string,
  value: unknown,
): ValidationError {
  return { path, code, message, value };
}

const emptyStats = {
  nodesValidated: 0,
  edgesValidated: 0,
  formulasValidated: 0,
  constantsValidated: 0,
};

/**
 * 출처 페이지 검증 — 양의 정수만 허용 (0, 음수, NaN, Infinity, null, undefined 거부).
 * 북극성(출처 추적성) 1차 방어선으로, schema-validator 단계에서 먼저 걸러 DB 트리거 의존을 줄인다.
 */
function isValidSourcePage(value: unknown): boolean {
  return (
    typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
  );
}

// --- Validator ---

export function validateKnowledgeContract(contract: KnowledgeContract): ValidationResult {
  // 0. Structural validation — crash 방지
  if (!contract || typeof contract !== 'object') {
    return {
      valid: false,
      errors: [
        err('', 'INVALID_CONTRACT_STRUCTURE', 'Contract is null or not an object', contract),
      ],
      stats: emptyStats,
    };
  }

  const structErrors: ValidationError[] = [];
  if (!Array.isArray(contract.nodes)) {
    structErrors.push(
      err('nodes', 'INVALID_CONTRACT_STRUCTURE', 'nodes must be an array', contract.nodes),
    );
  }
  if (!Array.isArray(contract.edges)) {
    structErrors.push(
      err('edges', 'INVALID_CONTRACT_STRUCTURE', 'edges must be an array', contract.edges),
    );
  }
  if (!Array.isArray(contract.formulas)) {
    structErrors.push(
      err('formulas', 'INVALID_CONTRACT_STRUCTURE', 'formulas must be an array', contract.formulas),
    );
  }
  if (!Array.isArray(contract.constants)) {
    structErrors.push(
      err(
        'constants',
        'INVALID_CONTRACT_STRUCTURE',
        'constants must be an array',
        contract.constants,
      ),
    );
  }
  if (structErrors.length > 0) {
    return { valid: false, errors: structErrors, stats: emptyStats };
  }

  const errors: ValidationError[] = [];
  const declaredNodeIds = new Set<string>();

  // 1. Validate nodes
  for (let i = 0; i < contract.nodes.length; i++) {
    const node = contract.nodes[i];
    const prefix = `nodes[${i}]`;

    if (!node.id) {
      errors.push(err(`${prefix}.id`, 'MISSING_REQUIRED_FIELD', 'Node ID is required', node.id));
      continue;
    }

    if (!node.type) {
      errors.push(
        err(`${prefix}.type`, 'MISSING_REQUIRED_FIELD', 'Node type is required', node.type),
      );
      continue;
    }

    // Duplicate ID check
    if (declaredNodeIds.has(node.id)) {
      errors.push(
        err(`${prefix}.id`, 'DUPLICATE_NODE_ID', `Duplicate node ID: "${node.id}"`, node.id),
      );
    }

    if (!isValidNodeType(node.type)) {
      errors.push(
        err(
          `${prefix}.type`,
          'INVALID_NODE_TYPE',
          `Unknown node type: "${node.type}". Allowed: ${registry.node_types.join(', ')}`,
          node.type,
        ),
      );
    } else if (!isValidNodeId(node.type as NodeType, node.id)) {
      errors.push(
        err(
          `${prefix}.id`,
          'INVALID_NODE_ID_PATTERN',
          `ID "${node.id}" does not match pattern for type ${node.type}: ${registry.node_id_patterns[node.type as NodeType]}`,
          node.id,
        ),
      );
    }

    // title, content 필수 필드
    if (!node.title) {
      errors.push(
        err(`${prefix}.title`, 'MISSING_REQUIRED_FIELD', 'Node title is required', node.title),
      );
    }
    if (!node.content) {
      errors.push(
        err(
          `${prefix}.content`,
          'MISSING_REQUIRED_FIELD',
          'Node content is required',
          node.content,
        ),
      );
    }

    // truth_weight: 필수 + 정수 + 범위 1~10
    if (
      node.truth_weight == null ||
      typeof node.truth_weight !== 'number' ||
      !Number.isFinite(node.truth_weight)
    ) {
      errors.push(
        err(
          `${prefix}.truth_weight`,
          'MISSING_REQUIRED_FIELD',
          'truth_weight is required and must be a finite number',
          node.truth_weight,
        ),
      );
    } else if (
      !Number.isInteger(node.truth_weight) ||
      node.truth_weight < 1 ||
      node.truth_weight > 10
    ) {
      errors.push(
        err(
          `${prefix}.truth_weight`,
          'INVALID_TRUTH_WEIGHT',
          `truth_weight must be an integer 1-10, got ${node.truth_weight}`,
          node.truth_weight,
        ),
      );
    }

    // source_page: 출처 추적성 강제 (북극성). 정수 + 양수.
    if (!isValidSourcePage(node.source_page)) {
      errors.push(
        err(
          `${prefix}.source_page`,
          'MISSING_SOURCE_PAGE',
          'source_page is required (source citation). Must be a positive integer.',
          node.source_page,
        ),
      );
    }

    declaredNodeIds.add(node.id);
  }

  // 2. Validate edges
  for (let i = 0; i < contract.edges.length; i++) {
    const edge = contract.edges[i];
    const prefix = `edges[${i}]`;

    // source_id, target_id 필수 필드
    if (!edge.source_id) {
      errors.push(
        err(
          `${prefix}.source_id`,
          'MISSING_REQUIRED_FIELD',
          'Edge source_id is required',
          edge.source_id,
        ),
      );
    }
    if (!edge.target_id) {
      errors.push(
        err(
          `${prefix}.target_id`,
          'MISSING_REQUIRED_FIELD',
          'Edge target_id is required',
          edge.target_id,
        ),
      );
    }

    if (!isValidEdgeType(edge.edge_type)) {
      errors.push(
        err(
          `${prefix}.edge_type`,
          'INVALID_EDGE_TYPE',
          `Unknown edge type: "${edge.edge_type}". Allowed: ${registry.edge_types.join(', ')}`,
          edge.edge_type,
        ),
      );
    }

    // 패턴 + dangling 체크는 source_id/target_id가 있을 때만
    if (edge.source_id) {
      if (!inferNodeTypeFromId(edge.source_id)) {
        errors.push(
          err(
            `${prefix}.source_id`,
            'INVALID_EDGE_SOURCE_ID',
            `source_id "${edge.source_id}" does not match any known node ID pattern`,
            edge.source_id,
          ),
        );
      }
      if (!declaredNodeIds.has(edge.source_id)) {
        errors.push(
          err(
            `${prefix}.source_id`,
            'DANGLING_EDGE_REFERENCE',
            `source_id "${edge.source_id}" not found in declared nodes`,
            edge.source_id,
          ),
        );
      }
    }

    if (edge.target_id) {
      if (!inferNodeTypeFromId(edge.target_id)) {
        errors.push(
          err(
            `${prefix}.target_id`,
            'INVALID_EDGE_TARGET_ID',
            `target_id "${edge.target_id}" does not match any known node ID pattern`,
            edge.target_id,
          ),
        );
      }
      if (!declaredNodeIds.has(edge.target_id)) {
        errors.push(
          err(
            `${prefix}.target_id`,
            'DANGLING_EDGE_REFERENCE',
            `target_id "${edge.target_id}" not found in declared nodes`,
            edge.target_id,
          ),
        );
      }
    }
  }

  // 3. Validate formulas
  for (let i = 0; i < contract.formulas.length; i++) {
    const formula = contract.formulas[i];
    const prefix = `formulas[${i}]`;

    if (!isValidFormulaId(formula.id)) {
      errors.push(
        err(
          `${prefix}.id`,
          'INVALID_FORMULA_ID',
          `Formula ID "${formula.id}" does not match pattern: ${registry.formula_id_pattern}`,
          formula.id,
        ),
      );
    }

    if (!isValidSourcePage(formula.source_page)) {
      errors.push(
        err(
          `${prefix}.source_page`,
          'MISSING_SOURCE_PAGE',
          'source_page is required (source citation). Must be a positive integer.',
          formula.source_page,
        ),
      );
    }
  }

  // 4. Validate constants
  for (let i = 0; i < contract.constants.length; i++) {
    const constant = contract.constants[i];
    const prefix = `constants[${i}]`;

    if (!isValidConstantId(constant.id)) {
      errors.push(
        err(
          `${prefix}.id`,
          'INVALID_CONSTANT_ID',
          `Constant ID "${constant.id}" does not match pattern: ${registry.constant_id_pattern}`,
          constant.id,
        ),
      );
    }

    if (!isValidConstantCategory(constant.category)) {
      errors.push(
        err(
          `${prefix}.category`,
          'INVALID_CONSTANT_CATEGORY',
          `Unknown constant category: "${constant.category}". Allowed: ${registry.constant_categories.join(', ')}`,
          constant.category,
        ),
      );
    }

    if (!isValidSourcePage(constant.source_page)) {
      errors.push(
        err(
          `${prefix}.source_page`,
          'MISSING_SOURCE_PAGE',
          'source_page is required (source citation). Must be a positive integer.',
          constant.source_page,
        ),
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      nodesValidated: contract.nodes.length,
      edgesValidated: contract.edges.length,
      formulasValidated: contract.formulas.length,
      constantsValidated: contract.constants.length,
    },
  };
}

// --- Raw Claude response validation (FUZ-02) ---

/**
 * 응답 임계값 — D1 single transaction 1 MB 한도 보호.
 * 본 시점 100 KB 로 보수적 설정 (대부분 BATCH 출력은 30~50 KB 이내).
 */
const DEFAULT_MAX_RESPONSE_SIZE_BYTES = 100 * 1024;

/**
 * JSON 깊이 임계값 — V8 의 default JSON.parse 한계 (~10K) 도달 전 거부.
 * 50 단계는 정상 KnowledgeContract (nodes/edges/formulas/constants 평면 구조)
 * 보다 충분히 깊다.
 */
const DEFAULT_MAX_JSON_DEPTH = 50;

/**
 * XSS payload 정규식 — content / title 필드의 raw HTML / JavaScript URI 차단.
 * raw 응답 단계 검사 (parse 전) — DB 적재 / UI 렌더링 전 1차 방어선.
 */
const XSS_PAYLOAD_PATTERNS = [
  /<script\b/i,
  /javascript:/i,
  /\bon\w+\s*=/i, // onerror, onclick, onload, ...
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
];

/**
 * Hard Rule 17 위반 — examId literal 직접 인용 차단.
 * production-quality.md §"Hard Rule 17" 정합 — 응답 raw 단계에서 거부.
 *
 * EXAM_IDS catalogue 의 runtime values 를 그대로 차단 패턴으로 사용 — Year 2
 * 시험 추가 시 EXAM_IDS 만 갱신하면 자동 확장 (단일 진실 소스).
 */
const HARD_RULE_17_LITERALS: ReadonlyArray<string> = Object.values(EXAM_IDS);

export interface RawResponseValidationOptions {
  /** Maximum response size in bytes (default 100 KB) */
  maxSizeBytes?: number;
  /** Maximum JSON nesting depth (default 50) */
  maxDepth?: number;
}

/**
 * raw 응답 단계 character-level depth 측정 — JSON.parse 진입 전 stack overflow 보호.
 * 문자열 안의 brace / bracket 은 무시 (escape 처리 포함).
 */
function computeMaxJsonDepth(raw: string): number {
  let depth = 0;
  let max = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{' || c === '[') {
      depth++;
      if (depth > max) max = depth;
    } else if (c === '}' || c === ']') {
      depth--;
    }
  }
  return max;
}

/**
 * structural validation 결과 → KnowledgeContractValidationError 매핑.
 * 우선순위: ONTOLOGY_UNREGISTERED_ID > MISSING_REQUIRED_FIELD > 기타 (PARSE_ERROR).
 */
function mapValidationErrorsToClassification(
  errors: ValidationError[],
  raw: string,
): KnowledgeContractValidationError {
  const ontologyErr = errors.find(
    (e) => e.code === 'INVALID_NODE_ID_PATTERN' || e.code === 'INVALID_NODE_TYPE',
  );
  if (ontologyErr) {
    return new KnowledgeContractValidationError(
      'ONTOLOGY_UNREGISTERED_ID',
      `Ontology unregistered ID at ${ontologyErr.path}: ${ontologyErr.message}`,
      {
        id: typeof ontologyErr.value === 'string' ? ontologyErr.value : String(ontologyErr.value),
        field: ontologyErr.path,
        allErrors: errors,
      },
    );
  }

  const missingErr = errors.find((e) => e.code === 'MISSING_REQUIRED_FIELD');
  if (missingErr) {
    return new KnowledgeContractValidationError(
      'MISSING_REQUIRED_FIELD',
      `Missing required field at ${missingErr.path}: ${missingErr.message}`,
      { field: missingErr.path, allErrors: errors },
    );
  }

  return new KnowledgeContractValidationError(
    'PARSE_ERROR',
    `Validation failed: ${errors[0].message}`,
    { field: errors[0].path, allErrors: errors, rawSnippet: raw.slice(0, 200) },
  );
}

/**
 * raw Claude / LLM 응답 검증 — 8종 변조 응답 (FUZ-02) graceful 분류 throw.
 *
 * 검사 순서 (실패 시 즉시 throw):
 * 1. EMPTY_RESPONSE — 빈 응답
 * 2. RESPONSE_SIZE_EXCEEDED — 임계 초과 (D1 transaction 보호)
 * 3. XSS_PAYLOAD_DETECTED — script / javascript: / event handler
 * 4. HARD_RULE_17_VIOLATION — examId literal 인용
 * 5. JSON_DEPTH_EXCEEDED — 50 단계 초과
 * 6. PARSE_ERROR — JSON.parse 실패
 * 7. structural validation (validateKnowledgeContract 위임) — 실패 시 ONTOLOGY_UNREGISTERED_ID /
 *    MISSING_REQUIRED_FIELD 등으로 매핑
 *
 * @throws {KnowledgeContractValidationError} 분류된 에러
 */
export function validateRawClaudeResponse(
  raw: string,
  options: RawResponseValidationOptions = {},
): KnowledgeContract {
  const maxSize = options.maxSizeBytes ?? DEFAULT_MAX_RESPONSE_SIZE_BYTES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_JSON_DEPTH;

  // 1. EMPTY_RESPONSE
  if (raw == null || raw.trim().length === 0) {
    throw new KnowledgeContractValidationError(
      'EMPTY_RESPONSE',
      'Empty Claude response (0 bytes or whitespace only)',
      { rawSnippet: typeof raw === 'string' ? raw.slice(0, 200) : '' },
    );
  }

  // 2. RESPONSE_SIZE_EXCEEDED
  const size = Buffer.byteLength(raw, 'utf-8');
  if (size > maxSize) {
    throw new KnowledgeContractValidationError(
      'RESPONSE_SIZE_EXCEEDED',
      `Claude response size ${size} bytes exceeds maximum ${maxSize} bytes (D1 1MB transaction protection)`,
      { size, maxAllowed: maxSize },
    );
  }

  // 3. XSS_PAYLOAD_DETECTED
  for (const pattern of XSS_PAYLOAD_PATTERNS) {
    const match = raw.match(pattern);
    if (match) {
      throw new KnowledgeContractValidationError(
        'XSS_PAYLOAD_DETECTED',
        `XSS payload detected in raw response: "${match[0]}"`,
        { rawSnippet: raw.slice(0, 200), field: 'raw', pattern: pattern.source },
      );
    }
  }

  // 4. HARD_RULE_17_VIOLATION
  for (const literal of HARD_RULE_17_LITERALS) {
    if (raw.includes(literal)) {
      throw new KnowledgeContractValidationError(
        'HARD_RULE_17_VIOLATION',
        `Hard Rule 17 violation: examId literal '${literal}' in raw response (must use EXAM_IDS catalogue)`,
        { rawSnippet: raw.slice(0, 200), field: 'raw', literal },
      );
    }
  }

  // 5. JSON_DEPTH_EXCEEDED
  const depth = computeMaxJsonDepth(raw);
  if (depth > maxDepth) {
    throw new KnowledgeContractValidationError(
      'JSON_DEPTH_EXCEEDED',
      `JSON depth ${depth} exceeds maximum ${maxDepth} (V8 stack overflow protection)`,
      { depth, maxAllowed: maxDepth },
    );
  }

  // 6. PARSE_ERROR
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const e = err as Error;
    throw new KnowledgeContractValidationError('PARSE_ERROR', `JSON parse failed: ${e.message}`, {
      rawSnippet: raw.slice(0, 200),
    });
  }

  // 7. structural validation 위임
  const result = validateKnowledgeContract(parsed as KnowledgeContract);
  if (!result.valid) {
    throw mapValidationErrorsToClassification(result.errors, raw);
  }

  return parsed as KnowledgeContract;
}
