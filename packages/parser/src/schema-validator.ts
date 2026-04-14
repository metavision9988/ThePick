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
}

export interface KnowledgeContractConstant {
  id: string;
  name: string;
  value: string;
  category: string;
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
