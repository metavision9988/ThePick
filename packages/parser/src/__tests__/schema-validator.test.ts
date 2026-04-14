import { describe, it, expect } from 'vitest';
import { validateKnowledgeContract, type KnowledgeContract } from '../schema-validator';
import {
  registry,
  isValidNodeType,
  isValidEdgeType,
  isValidNodeId,
  isValidFormulaId,
  isValidConstantId,
  isValidConstantCategory,
  inferNodeTypeFromId,
} from '../ontology-registry';

// --- Helpers ---

function validContract(): KnowledgeContract {
  return {
    nodes: [
      {
        id: 'CONCEPT-001',
        type: 'CONCEPT',
        title: '적과전 종합위험 보장 개요',
        content: '적과전 종합위험 보장은...',
        lv1_insurance: '농작물재해보험',
        lv2_crop: '사과',
        truth_weight: 5,
        source_page: 403,
      },
      {
        id: 'F-01',
        type: 'FORMULA',
        title: '보험가입금액 산정',
        content: '보험가입금액 = 표준수확량 × 기준가격',
        truth_weight: 8,
        source_page: 410,
      },
    ],
    edges: [
      {
        source_id: 'CONCEPT-001',
        target_id: 'F-01',
        edge_type: 'USES_FORMULA',
      },
    ],
    formulas: [
      {
        id: 'F-01',
        name: '보험가입금액',
        equation_template: 'standard_yield * base_price',
        variables_schema: '{"standard_yield": "number", "base_price": "number"}',
      },
    ],
    constants: [
      {
        id: 'CONST-001',
        name: '자기부담비율(20%)',
        value: '0.20',
        category: 'deductible',
      },
    ],
  };
}

// --- ontology-registry.ts 헬퍼 단위 테스트 ---

describe('ontology-registry helpers', () => {
  describe('isValidNodeType', () => {
    it('accepts all 7 valid node types', () => {
      const types = ['LAW', 'FORMULA', 'INVESTIGATION', 'INSURANCE', 'CROP', 'CONCEPT', 'TERM'];
      for (const t of types) {
        expect(isValidNodeType(t)).toBe(true);
      }
    });

    it('rejects unknown node types', () => {
      expect(isValidNodeType('ANIMAL')).toBe(false);
      expect(isValidNodeType('')).toBe(false);
      expect(isValidNodeType('law')).toBe(false);
    });
  });

  describe('isValidEdgeType', () => {
    it('accepts all 13 valid edge types', () => {
      const types = [
        'APPLIES_TO',
        'REQUIRES_INVESTIGATION',
        'PREREQUISITE',
        'USES_FORMULA',
        'DEPENDS_ON',
        'GOVERNED_BY',
        'DEFINED_AS',
        'EXCEPTION',
        'TIME_CONSTRAINT',
        'SUPERSEDES',
        'SHARED_WITH',
        'DIFFERS_FROM',
        'CROSS_REF',
      ];
      for (const t of types) {
        expect(isValidEdgeType(t)).toBe(true);
      }
    });

    it('rejects unknown edge types', () => {
      expect(isValidEdgeType('LINKS_TO')).toBe(false);
    });
  });

  describe('isValidNodeId', () => {
    it('validates CONCEPT-NNN pattern', () => {
      expect(isValidNodeId('CONCEPT', 'CONCEPT-001')).toBe(true);
      expect(isValidNodeId('CONCEPT', 'CONCEPT-999')).toBe(true);
      expect(isValidNodeId('CONCEPT', 'CONCEPT-01')).toBe(false);
      expect(isValidNodeId('CONCEPT', 'CONCEPT-1000')).toBe(false);
    });

    it('validates F-NN pattern', () => {
      expect(isValidNodeId('FORMULA', 'F-01')).toBe(true);
      expect(isValidNodeId('FORMULA', 'F-99')).toBe(true);
      expect(isValidNodeId('FORMULA', 'F-1')).toBe(false);
      expect(isValidNodeId('FORMULA', 'FORMULA-01')).toBe(false);
    });

    it('validates INS-NN pattern', () => {
      expect(isValidNodeId('INSURANCE', 'INS-01')).toBe(true);
      expect(isValidNodeId('INSURANCE', 'INS-001')).toBe(false);
    });

    it('validates LAW-NNN pattern', () => {
      expect(isValidNodeId('LAW', 'LAW-001')).toBe(true);
      expect(isValidNodeId('LAW', 'LAW-01')).toBe(false);
    });

    it('validates INV-NNN pattern', () => {
      expect(isValidNodeId('INVESTIGATION', 'INV-001')).toBe(true);
      expect(isValidNodeId('INVESTIGATION', 'INV-01')).toBe(false);
    });

    it('validates CROP-NNN pattern', () => {
      expect(isValidNodeId('CROP', 'CROP-001')).toBe(true);
      expect(isValidNodeId('CROP', 'CROP-01')).toBe(false);
    });

    it('validates TERM-NNN pattern', () => {
      expect(isValidNodeId('TERM', 'TERM-001')).toBe(true);
      expect(isValidNodeId('TERM', 'TERM-01')).toBe(false);
    });

    it('rejects cross-type ID mismatches', () => {
      expect(isValidNodeId('CONCEPT', 'LAW-001')).toBe(false);
      expect(isValidNodeId('LAW', 'CONCEPT-001')).toBe(false);
    });
  });

  describe('isValidFormulaId', () => {
    it('accepts valid formula IDs', () => {
      expect(isValidFormulaId('F-01')).toBe(true);
      expect(isValidFormulaId('F-99')).toBe(true);
    });

    it('rejects invalid formula IDs', () => {
      expect(isValidFormulaId('FORMULA-01')).toBe(false);
      expect(isValidFormulaId('F-1')).toBe(false);
    });
  });

  describe('isValidConstantId', () => {
    it('accepts valid constant IDs', () => {
      expect(isValidConstantId('CONST-001')).toBe(true);
      expect(isValidConstantId('CONST-999')).toBe(true);
    });

    it('rejects invalid constant IDs', () => {
      expect(isValidConstantId('C-01')).toBe(false);
      expect(isValidConstantId('CONST-01')).toBe(false);
    });
  });

  describe('isValidConstantCategory', () => {
    it('accepts all 7 valid categories', () => {
      const cats = [
        'threshold',
        'coefficient',
        'date',
        'ratio',
        'sample',
        'deductible',
        'insurance_rate',
      ];
      for (const c of cats) {
        expect(isValidConstantCategory(c)).toBe(true);
      }
    });

    it('rejects unknown categories', () => {
      expect(isValidConstantCategory('unknown')).toBe(false);
    });
  });

  describe('inferNodeTypeFromId', () => {
    it('infers correct types from valid IDs', () => {
      expect(inferNodeTypeFromId('CONCEPT-001')).toBe('CONCEPT');
      expect(inferNodeTypeFromId('F-01')).toBe('FORMULA');
      expect(inferNodeTypeFromId('LAW-100')).toBe('LAW');
      expect(inferNodeTypeFromId('INV-005')).toBe('INVESTIGATION');
      expect(inferNodeTypeFromId('INS-01')).toBe('INSURANCE');
      expect(inferNodeTypeFromId('CROP-010')).toBe('CROP');
      expect(inferNodeTypeFromId('TERM-050')).toBe('TERM');
    });

    it('returns null for unrecognized IDs', () => {
      expect(inferNodeTypeFromId('ANIMAL-01')).toBeNull();
      expect(inferNodeTypeFromId('random')).toBeNull();
      expect(inferNodeTypeFromId('')).toBeNull();
    });
  });
});

// --- Enum 동기화 테스트 (registry ↔ shared types 일치 보장) ---

describe('enum synchronization', () => {
  it('registry node_types matches all 7 expected types', () => {
    const expected = ['LAW', 'FORMULA', 'INVESTIGATION', 'INSURANCE', 'CROP', 'CONCEPT', 'TERM'];
    expect([...registry.node_types].sort()).toEqual([...expected].sort());
  });

  it('registry edge_types matches all 13 expected types', () => {
    const expected = [
      'APPLIES_TO',
      'REQUIRES_INVESTIGATION',
      'PREREQUISITE',
      'USES_FORMULA',
      'DEPENDS_ON',
      'GOVERNED_BY',
      'DEFINED_AS',
      'EXCEPTION',
      'TIME_CONSTRAINT',
      'SUPERSEDES',
      'SHARED_WITH',
      'DIFFERS_FROM',
      'CROSS_REF',
    ];
    expect([...registry.edge_types].sort()).toEqual([...expected].sort());
  });

  it('registry constant_categories matches all 7 expected categories', () => {
    const expected = [
      'threshold',
      'coefficient',
      'date',
      'ratio',
      'sample',
      'deductible',
      'insurance_rate',
    ];
    expect([...registry.constant_categories].sort()).toEqual([...expected].sort());
  });

  it('every node_type has a corresponding node_id_pattern', () => {
    for (const nodeType of registry.node_types) {
      expect(registry.node_id_patterns[nodeType]).toBeDefined();
      expect(typeof registry.node_id_patterns[nodeType]).toBe('string');
    }
  });
});

// --- schema-validator 통합 테스트 ---

describe('validateKnowledgeContract', () => {
  describe('structural validation', () => {
    it('rejects null contract', () => {
      const result = validateKnowledgeContract(null as unknown as KnowledgeContract);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_CONTRACT_STRUCTURE');
    });

    it('rejects contract with non-array nodes', () => {
      const result = validateKnowledgeContract({
        nodes: 'not-array',
        edges: [],
        formulas: [],
        constants: [],
      } as unknown as KnowledgeContract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_CONTRACT_STRUCTURE', path: 'nodes' }),
      );
    });

    it('accepts an empty contract (all arrays empty)', () => {
      const result = validateKnowledgeContract({
        nodes: [],
        edges: [],
        formulas: [],
        constants: [],
      });
      expect(result.valid).toBe(true);
      expect(result.stats).toEqual({
        nodesValidated: 0,
        edgesValidated: 0,
        formulasValidated: 0,
        constantsValidated: 0,
      });
    });
  });

  describe('valid contracts', () => {
    it('accepts a well-formed contract', () => {
      const result = validateKnowledgeContract(validContract());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stats).toEqual({
        nodesValidated: 2,
        edgesValidated: 1,
        formulasValidated: 1,
        constantsValidated: 1,
      });
    });

    it('accepts a contract with only nodes', () => {
      const contract: KnowledgeContract = {
        nodes: [
          {
            id: 'LAW-001',
            type: 'LAW',
            title: '농어업재해보험법',
            content: '법률 내용',
            truth_weight: 10,
            source_page: 1,
          },
        ],
        edges: [],
        formulas: [],
        constants: [],
      };
      const result = validateKnowledgeContract(contract);
      expect(result.valid).toBe(true);
    });
  });

  describe('node validation', () => {
    it('rejects unknown node type', () => {
      const contract = validContract();
      contract.nodes[0].type = 'ANIMAL';

      const result = validateKnowledgeContract(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_NODE_TYPE', path: 'nodes[0].type' }),
      );
    });

    it('rejects node ID not matching type pattern', () => {
      const contract = validContract();
      contract.nodes[0].id = 'LAW-001'; // CONCEPT type but LAW ID

      const result = validateKnowledgeContract(contract);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_NODE_ID_PATTERN', path: 'nodes[0].id' }),
      );
    });

    it('rejects truth_weight outside 1-10', () => {
      const contract = validContract();
      contract.nodes[0].truth_weight = 0;

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_TRUTH_WEIGHT', path: 'nodes[0].truth_weight' }),
      );
    });

    it('rejects truth_weight = 11 (above range)', () => {
      const contract = validContract();
      contract.nodes[0].truth_weight = 11;

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_TRUTH_WEIGHT' }),
      );
    });

    it('accepts truth_weight boundary values (1 and 10)', () => {
      const contract = validContract();
      contract.nodes[0].truth_weight = 1;
      contract.nodes[1].truth_weight = 10;

      const result = validateKnowledgeContract(contract);
      const twErrors = result.errors.filter((e) => e.code === 'INVALID_TRUTH_WEIGHT');
      expect(twErrors).toHaveLength(0);
    });

    it('rejects truth_weight = NaN', () => {
      const contract = validContract();
      contract.nodes[0].truth_weight = NaN;

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_REQUIRED_FIELD', path: 'nodes[0].truth_weight' }),
      );
    });

    it('rejects truth_weight = null/undefined as MISSING_REQUIRED_FIELD', () => {
      const contract = validContract();
      (contract.nodes[0] as unknown as Record<string, unknown>).truth_weight = null;

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_REQUIRED_FIELD', path: 'nodes[0].truth_weight' }),
      );
    });

    it('rejects fractional truth_weight', () => {
      const contract = validContract();
      contract.nodes[0].truth_weight = 5.5;

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_TRUTH_WEIGHT' }),
      );
    });

    it('rejects node missing required id', () => {
      const contract = validContract();
      contract.nodes[0].id = '';

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_REQUIRED_FIELD', path: 'nodes[0].id' }),
      );
    });

    it('rejects node missing required type', () => {
      const contract = validContract();
      contract.nodes[0].type = '';

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_REQUIRED_FIELD', path: 'nodes[0].type' }),
      );
    });

    it('rejects node with empty title', () => {
      const contract = validContract();
      contract.nodes[0].title = '';

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_REQUIRED_FIELD', path: 'nodes[0].title' }),
      );
    });

    it('rejects node with empty content', () => {
      const contract = validContract();
      contract.nodes[0].content = '';

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_REQUIRED_FIELD', path: 'nodes[0].content' }),
      );
    });

    it('detects duplicate node IDs', () => {
      const contract = validContract();
      contract.nodes.push({
        id: 'CONCEPT-001', // duplicate
        type: 'CONCEPT',
        title: '중복 노드',
        content: '중복 내용',
        truth_weight: 5,
        source_page: 404,
      });

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_NODE_ID' }));
    });
  });

  describe('edge validation', () => {
    it('rejects unknown edge type', () => {
      const contract = validContract();
      contract.edges[0].edge_type = 'LINKS_TO';

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_EDGE_TYPE', path: 'edges[0].edge_type' }),
      );
    });

    it('rejects edge with empty source_id', () => {
      const contract = validContract();
      contract.edges[0].source_id = '';

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_REQUIRED_FIELD', path: 'edges[0].source_id' }),
      );
    });

    it('rejects edge with empty target_id', () => {
      const contract = validContract();
      contract.edges[0].target_id = '';

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_REQUIRED_FIELD', path: 'edges[0].target_id' }),
      );
    });

    it('rejects edge with source_id not matching any pattern', () => {
      const contract = validContract();
      contract.nodes.push({
        id: 'TERM-001',
        type: 'TERM',
        title: 'test',
        content: 'test',
        truth_weight: 3,
        source_page: 403,
      });
      contract.edges.push({
        source_id: 'INVALID-99',
        target_id: 'TERM-001',
        edge_type: 'DEFINED_AS',
      });

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_EDGE_SOURCE_ID', path: 'edges[1].source_id' }),
      );
    });

    it('rejects edge with target_id not matching any pattern', () => {
      const contract = validContract();
      contract.edges.push({
        source_id: 'CONCEPT-001',
        target_id: 'BOGUS-123',
        edge_type: 'DEFINED_AS',
      });

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_EDGE_TARGET_ID', path: 'edges[1].target_id' }),
      );
    });

    it('reports DANGLING_EDGE_REFERENCE when source_id not in declared nodes', () => {
      const contract = validContract();
      contract.edges.push({
        source_id: 'LAW-001', // valid pattern, but not declared in nodes
        target_id: 'CONCEPT-001',
        edge_type: 'GOVERNED_BY',
      });

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'DANGLING_EDGE_REFERENCE', path: 'edges[1].source_id' }),
      );
    });

    it('reports DANGLING_EDGE_REFERENCE when target_id not in declared nodes', () => {
      const contract = validContract();
      contract.edges.push({
        source_id: 'CONCEPT-001',
        target_id: 'LAW-001', // valid pattern, but not declared in nodes
        edge_type: 'GOVERNED_BY',
      });

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'DANGLING_EDGE_REFERENCE', path: 'edges[1].target_id' }),
      );
    });
  });

  describe('formula validation', () => {
    it('rejects formula with invalid ID', () => {
      const contract = validContract();
      contract.formulas[0].id = 'FORMULA-01';

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_FORMULA_ID', path: 'formulas[0].id' }),
      );
    });

    it('accepts formula with valid ID', () => {
      const contract = validContract();
      const result = validateKnowledgeContract(contract);
      const formulaErrors = result.errors.filter((e) => e.path.startsWith('formulas'));
      expect(formulaErrors).toHaveLength(0);
    });
  });

  describe('constant validation', () => {
    it('rejects constant with invalid ID', () => {
      const contract = validContract();
      contract.constants[0].id = 'C-01';

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_CONSTANT_ID', path: 'constants[0].id' }),
      );
    });

    it('rejects constant with unknown category', () => {
      const contract = validContract();
      contract.constants[0].category = 'unknown_cat';

      const result = validateKnowledgeContract(contract);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_CONSTANT_CATEGORY',
          path: 'constants[0].category',
        }),
      );
    });
  });

  describe('comprehensive error collection', () => {
    it('collects all violations, not just the first', () => {
      const contract: KnowledgeContract = {
        nodes: [
          {
            id: '',
            type: '',
            title: '',
            content: '',
            truth_weight: 0,
            source_page: 0,
          },
          {
            id: 'BAD-ID',
            type: 'ANIMAL',
            title: '',
            content: '',
            truth_weight: NaN,
            source_page: 0,
          },
        ],
        edges: [{ source_id: '', target_id: '', edge_type: 'FAKE_EDGE' }],
        formulas: [{ id: 'FORMULA-LONG', name: '', equation_template: '', variables_schema: '' }],
        constants: [{ id: 'BAD', name: '', value: '', category: 'fake' }],
      };

      const result = validateKnowledgeContract(contract);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(8);

      const codes = new Set(result.errors.map((e) => e.code));
      expect(codes.has('MISSING_REQUIRED_FIELD')).toBe(true);
      expect(codes.has('INVALID_NODE_TYPE')).toBe(true);
      expect(codes.has('INVALID_EDGE_TYPE')).toBe(true);
      expect(codes.has('INVALID_FORMULA_ID')).toBe(true);
      expect(codes.has('INVALID_CONSTANT_ID')).toBe(true);
      expect(codes.has('INVALID_CONSTANT_CATEGORY')).toBe(true);
    });
  });
});
