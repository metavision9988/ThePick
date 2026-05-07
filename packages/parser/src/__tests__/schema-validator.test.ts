import { describe, it, expect } from 'vitest';
import {
  validateKnowledgeContract,
  type KnowledgeContract,
  type KnowledgeContractTable,
} from '../schema-validator';
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
        book_page: 396,
        pdf_page: 403,
      },
      {
        id: 'F-01',
        type: 'FORMULA',
        title: '보험가입금액 산정',
        content: '보험가입금액 = 표준수확량 × 기준가격',
        truth_weight: 8,
        source_page: 410,
        book_page: 403,
        pdf_page: 410,
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
        source_page: 412,
      },
    ],
    constants: [
      {
        id: 'CONST-001',
        name: '자기부담비율(20%)',
        value: '0.20',
        category: 'deductible',
        source_page: 405,
      },
    ],
  };
}

// --- ontology-registry.ts 헬퍼 단위 테스트 ---

describe('ontology-registry helpers', () => {
  describe('isValidNodeType', () => {
    it('accepts all 11 valid node types (v1.4.0 — 7 domain + 4 table)', () => {
      const types = [
        'LAW',
        'FORMULA',
        'INVESTIGATION',
        'INSURANCE',
        'CROP',
        'CONCEPT',
        'TERM',
        'TABLE',
        'ROW_HEADER',
        'COL_HEADER',
        'CELL',
      ];
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
    it('accepts all 18 valid edge types (v1.5.0 — 13 domain + 4 table + 1 nested)', () => {
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
        'HAS_ROW',
        'HAS_COLUMN',
        'BELONGS_TO_ROW',
        'BELONGS_TO_COLUMN',
        'CONTAINS_TABLE',
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

    it('infers correct types for v1.4.0 Table-as-Micro-KG IDs (ADR-032)', () => {
      expect(inferNodeTypeFromId('TBL-001')).toBe('TABLE');
      expect(inferNodeTypeFromId('TROW-001-01')).toBe('ROW_HEADER');
      expect(inferNodeTypeFromId('TCOL-001-01')).toBe('COL_HEADER');
      expect(inferNodeTypeFromId('TCELL-001-01-01')).toBe('CELL');
    });

    it('returns null for unrecognized IDs', () => {
      expect(inferNodeTypeFromId('ANIMAL-01')).toBeNull();
      expect(inferNodeTypeFromId('random')).toBeNull();
      expect(inferNodeTypeFromId('')).toBeNull();
    });

    it('does not collide TCOL- (COL_HEADER) with TC- (topic_cluster)', () => {
      // ★ ADR-032 D-TABLE-1=α 영속: COL_HEADER prefix = TCOL-
      // topic_cluster_id_pattern = ^TC-\d{3}$ 와 strict anchor 분리
      expect(inferNodeTypeFromId('TCOL-001-01')).toBe('COL_HEADER');
      expect(inferNodeTypeFromId('TC-001')).toBeNull(); // topic_cluster ID는 node_type 아님
    });
  });
});

// --- Enum 동기화 테스트 (registry ↔ shared types 일치 보장) ---

describe('enum synchronization', () => {
  it('registry node_types matches all 11 expected types (v1.4.0 — Table-as-Micro-KG)', () => {
    const expected = [
      'LAW',
      'FORMULA',
      'INVESTIGATION',
      'INSURANCE',
      'CROP',
      'CONCEPT',
      'TERM',
      'TABLE',
      'ROW_HEADER',
      'COL_HEADER',
      'CELL',
    ];
    expect([...registry.node_types].sort()).toEqual([...expected].sort());
  });

  it('registry edge_types matches all 18 expected types (v1.5.0 — 4 table edges + CONTAINS_TABLE 패턴-H)', () => {
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
      'HAS_ROW',
      'HAS_COLUMN',
      'BELONGS_TO_ROW',
      'BELONGS_TO_COLUMN',
      'CONTAINS_TABLE',
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
        tablesValidated: 0,
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
        tablesValidated: 0,
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
            book_page: 1,
            pdf_page: 1,
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
        book_page: 397,
        pdf_page: 404,
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
        book_page: 396,
        pdf_page: 403,
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
            book_page: 0,
            pdf_page: 0,
          },
          {
            id: 'BAD-ID',
            type: 'ANIMAL',
            title: '',
            content: '',
            truth_weight: NaN,
            source_page: 0,
            book_page: 0,
            pdf_page: 0,
          },
        ],
        edges: [{ source_id: '', target_id: '', edge_type: 'FAKE_EDGE' }],
        formulas: [
          {
            id: 'FORMULA-LONG',
            name: '',
            equation_template: '',
            variables_schema: '',
            source_page: 0, // invalid — MISSING_SOURCE_PAGE 에러 기대
          },
        ],
        constants: [
          {
            id: 'BAD',
            name: '',
            value: '',
            category: 'fake',
            source_page: 0, // invalid — MISSING_SOURCE_PAGE 에러 기대
          },
        ],
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
      expect(codes.has('MISSING_SOURCE_PAGE')).toBe(true);
    });
  });
});

// --- Table-as-Micro-KG (ADR-032 v1.4.0 + v1.5.0 D-PHASE2-7=α 패턴-H) ---
// MAJOR-A 흡수: validateTablesSection 본문 검증 + 패턴-H 정합

function validTableA(): KnowledgeContractTable {
  // 패턴-A 단순 그리드 1×2 (text 셀만). Session 052 CRIT-D: book_page/pdf_page 필수.
  return {
    id: 'TBL-001',
    source_node_id: 'CONCEPT-001',
    title: '테스트 패턴-A 표',
    pattern_type: 'A_simple',
    row_count: 1,
    col_count: 2,
    source: 'test_fixture',
    book_page: 100,
    pdf_page: 100,
    headers: [
      { id: 'TROW-001-01', axis: 'row', level: 1, index_pos: 1, text: '1행' },
      { id: 'TCOL-001-01', axis: 'column', level: 1, index_pos: 1, text: '1열' },
      { id: 'TCOL-001-02', axis: 'column', level: 1, index_pos: 2, text: '2열' },
    ],
    cells: [
      {
        id: 'TCELL-001-01-01',
        row_id: 'TROW-001-01',
        col_id: 'TCOL-001-01',
        value_text: '값1',
        value_type: 'text',
      },
      {
        id: 'TCELL-001-01-02',
        row_id: 'TROW-001-01',
        col_id: 'TCOL-001-02',
        value_text: '값2',
        value_type: 'text',
      },
    ],
  };
}

function contractWithTables(tables: KnowledgeContractTable[]): KnowledgeContract {
  return {
    nodes: [
      {
        id: 'CONCEPT-001',
        type: 'CONCEPT',
        title: '표 소속 노드',
        content: '본문',
        truth_weight: 5,
        source_page: 100,
        book_page: 100,
        pdf_page: 100,
      },
    ],
    edges: [],
    formulas: [
      {
        id: 'F-01',
        name: 'test',
        equation_template: 'a + b',
        variables_schema: '{"a":"number","b":"number"}',
        source_page: 100,
      },
    ],
    constants: [],
    tables,
  };
}

describe('validateTablesSection — Table-as-Micro-KG', () => {
  describe('happy path', () => {
    it('accepts a contract without tables[] (Phase 1 호환 — optional 필드)', () => {
      const result = validateKnowledgeContract(validContract());
      expect(result.valid).toBe(true);
      expect(result.stats.tablesValidated).toBe(0);
    });

    it('accepts a well-formed pattern-A simple table', () => {
      const result = validateKnowledgeContract(contractWithTables([validTableA()]));
      expect(result.valid).toBe(true);
      expect(result.stats.tablesValidated).toBe(1);
    });

    it('accepts a pattern-H nested table (CELL → TABLE)', () => {
      const inner = validTableA();
      inner.id = 'TBL-002';
      inner.title = 'inner nested';
      inner.headers = inner.headers.map((h) => ({
        ...h,
        id: h.id.replace('001', '002'),
      }));
      inner.cells = inner.cells.map((c) => ({
        ...c,
        id: c.id.replace('001', '002'),
        row_id: c.row_id.replace('001', '002'),
        col_id: c.col_id.replace('001', '002'),
      }));

      const outer = validTableA();
      // outer 셀 1개를 nested_table로 — A_simple → 패턴 정합 위해 H 패턴 의무는 아니므로
      // 본 테스트는 'pattern_type' 일관성보다는 'nested_table_id 정합'을 목표
      // → outer를 다른 패턴으로 변경하지 않고, A_simple cell 중 1개만 nested_table로 변경 시
      //   pattern_type ↔ value_type cross-validation에서 reject 의무 (별도 테스트)
      // → 본 happy path는 outer에 G_temporal 등을 부여
      outer.pattern_type = 'G_temporal';
      outer.cells[0] = {
        id: 'TCELL-001-01-01',
        row_id: 'TROW-001-01',
        col_id: 'TCOL-001-01',
        value_type: 'nested_table',
        nested_table_id: 'TBL-002',
      };

      const result = validateKnowledgeContract(contractWithTables([outer, inner]));
      if (!result.valid) console.error('nested table errors:', result.errors);
      expect(result.valid).toBe(true);
      expect(result.stats.tablesValidated).toBe(2);
    });
  });

  describe('table ID validation', () => {
    it('rejects invalid TBL ID pattern (INVALID_TABLE_ID)', () => {
      const t = validTableA();
      t.id = 'TABLE-001';
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_TABLE_ID', path: 'tables[0].id' }),
      );
    });
  });

  describe('header validation', () => {
    it('rejects axis="row" with TCOL prefix (INVALID_TABLE_HEADER_ID)', () => {
      const t = validTableA();
      t.headers[0] = { id: 'TCOL-001-01', axis: 'row', level: 1, index_pos: 1, text: 'x' };
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_TABLE_HEADER_ID',
          path: 'tables[0].headers[0].id',
        }),
      );
    });

    it('rejects header.index_pos gap (TABLE_HEADER_INDEX_GAP)', () => {
      const t = validTableA();
      // col_count=2, but only index_pos=1 column header (missing index 2)
      t.headers = t.headers.filter((h) => !(h.axis === 'column' && h.index_pos === 2));
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'TABLE_HEADER_INDEX_GAP' }),
      );
    });
  });

  describe('cell validation', () => {
    it('rejects invalid TCELL ID (INVALID_TABLE_CELL_ID)', () => {
      const t = validTableA();
      t.cells[0].id = 'CELL-001';
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_TABLE_CELL_ID',
          path: 'tables[0].cells[0].id',
        }),
      );
    });

    it('rejects unknown value_type (INVALID_TABLE_VALUE_TYPE)', () => {
      const t = validTableA();
      // Unknown literal — cast 의무 (TS strict)
      (t.cells[0] as { value_type: string }).value_type = 'unknown_type';
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_TABLE_VALUE_TYPE' }),
      );
    });

    it('rejects formula cell missing formula_id (MISSING_REQUIRED_FIELD)', () => {
      const t = validTableA();
      t.pattern_type = 'F_formula';
      t.cells[0] = {
        id: 'TCELL-001-01-01',
        row_id: 'TROW-001-01',
        col_id: 'TCOL-001-01',
        value_type: 'formula',
      };
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_REQUIRED_FIELD',
          path: 'tables[0].cells[0].formula_id',
        }),
      );
    });

    it('rejects nested_table cell missing nested_table_id (MISSING_REQUIRED_FIELD, 패턴-H)', () => {
      const t = validTableA();
      t.pattern_type = 'G_temporal';
      t.cells[0] = {
        id: 'TCELL-001-01-01',
        row_id: 'TROW-001-01',
        col_id: 'TCOL-001-01',
        value_type: 'nested_table',
      };
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_REQUIRED_FIELD',
          path: 'tables[0].cells[0].nested_table_id',
        }),
      );
    });

    it('rejects formula_id pointing to undeclared formula (DANGLING_TABLE_CELL_REFERENCE)', () => {
      const t = validTableA();
      t.pattern_type = 'F_formula';
      t.cells[0] = {
        id: 'TCELL-001-01-01',
        row_id: 'TROW-001-01',
        col_id: 'TCOL-001-01',
        value_type: 'formula',
        formula_id: 'F-99', // 미선언
      };
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DANGLING_TABLE_CELL_REFERENCE',
          path: 'tables[0].cells[0].formula_id',
        }),
      );
    });

    it('rejects nested_table_id pointing to undeclared table (DANGLING_NESTED_TABLE_REFERENCE)', () => {
      const t = validTableA();
      t.pattern_type = 'G_temporal';
      t.cells[0] = {
        id: 'TCELL-001-01-01',
        row_id: 'TROW-001-01',
        col_id: 'TCOL-001-01',
        value_type: 'nested_table',
        nested_table_id: 'TBL-999', // 미선언
      };
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DANGLING_NESTED_TABLE_REFERENCE',
          path: 'tables[0].cells[0].nested_table_id',
        }),
      );
    });

    it("rejects cell.row_id not in this table's row headers (DANGLING_TABLE_CELL_REFERENCE)", () => {
      const t = validTableA();
      t.cells[0].row_id = 'TROW-999-01'; // 미선언
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DANGLING_TABLE_CELL_REFERENCE',
          path: 'tables[0].cells[0].row_id',
        }),
      );
    });
  });

  describe('pattern_type cross-validation', () => {
    it('rejects F_formula table with no formula cell (TABLE_PATTERN_VALUETYPE_MISMATCH)', () => {
      const t = validTableA();
      t.pattern_type = 'F_formula';
      // cells 모두 text — formula 0건
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'TABLE_PATTERN_VALUETYPE_MISMATCH',
          path: 'tables[0].pattern_type',
        }),
      );
    });

    it('rejects A_simple table with nested_table cell (TABLE_PATTERN_VALUETYPE_MISMATCH)', () => {
      const inner = validTableA();
      inner.id = 'TBL-002';
      inner.headers = inner.headers.map((h) => ({ ...h, id: h.id.replace('001', '002') }));
      inner.cells = inner.cells.map((c) => ({
        ...c,
        id: c.id.replace('001', '002'),
        row_id: c.row_id.replace('001', '002'),
        col_id: c.col_id.replace('001', '002'),
      }));

      const outer = validTableA();
      // outer는 A_simple로 두지만 cells에 nested_table 포함 → cross-validation 실패 의무
      outer.cells[0] = {
        id: 'TCELL-001-01-01',
        row_id: 'TROW-001-01',
        col_id: 'TCOL-001-01',
        value_type: 'nested_table',
        nested_table_id: 'TBL-002',
      };

      const result = validateKnowledgeContract(contractWithTables([outer, inner]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'TABLE_PATTERN_VALUETYPE_MISMATCH',
          path: 'tables[0].pattern_type',
        }),
      );
    });
  });

  // Session 052 entry 4-Pass 흡수 — CRIT-A/B/C/D 회귀 테스트
  describe('CRIT-A — pattern_type H_nested whitelist + cross-validation', () => {
    function validInnerTable(): KnowledgeContractTable {
      const inner = validTableA();
      inner.id = 'TBL-002';
      inner.title = 'inner nested';
      inner.headers = inner.headers.map((h) => ({ ...h, id: h.id.replace('001', '002') }));
      inner.cells = inner.cells.map((c) => ({
        ...c,
        id: c.id.replace('001', '002'),
        row_id: c.row_id.replace('001', '002'),
        col_id: c.col_id.replace('001', '002'),
      }));
      return inner;
    }

    it('accepts pattern_type=H_nested with ≥1 nested_table cell (happy path)', () => {
      const inner = validInnerTable();
      const outer = validTableA();
      outer.pattern_type = 'H_nested';
      outer.cells[0] = {
        id: 'TCELL-001-01-01',
        row_id: 'TROW-001-01',
        col_id: 'TCOL-001-01',
        value_type: 'nested_table',
        nested_table_id: 'TBL-002',
      };

      const result = validateKnowledgeContract(contractWithTables([outer, inner]));
      if (!result.valid) console.error('H_nested happy path errors:', result.errors);
      expect(result.valid).toBe(true);
      expect(result.stats.tablesValidated).toBe(2);
    });

    it('rejects pattern_type=H_nested without any nested_table cell (TABLE_PATTERN_VALUETYPE_MISMATCH)', () => {
      const t = validTableA();
      t.pattern_type = 'H_nested';
      // cells 모두 text — nested_table 0건
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'TABLE_PATTERN_VALUETYPE_MISMATCH',
          path: 'tables[0].pattern_type',
        }),
      );
    });
  });

  describe('CRIT-B — pattern_type whitelist (INVALID_TABLE_PATTERN_TYPE)', () => {
    it('rejects unknown pattern_type literal (LLM hallucination)', () => {
      const t = validTableA();
      // Unknown literal — cast 의무 (TS strict)
      (t as { pattern_type: string }).pattern_type = 'Z_unknown';
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_TABLE_PATTERN_TYPE',
          path: 'tables[0].pattern_type',
        }),
      );
    });
  });

  describe('CRIT-C — nested_table cycle / self-reference', () => {
    it('rejects self-loop nested_table_id (NESTED_TABLE_SELF_REFERENCE)', () => {
      const t = validTableA();
      t.pattern_type = 'H_nested';
      t.cells[0] = {
        id: 'TCELL-001-01-01',
        row_id: 'TROW-001-01',
        col_id: 'TCOL-001-01',
        value_type: 'nested_table',
        nested_table_id: 'TBL-001', // 자기 참조
      };
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'NESTED_TABLE_SELF_REFERENCE',
          path: 'tables[0].cells[0].nested_table_id',
        }),
      );
    });

    it('rejects 2-cycle A→B→A (NESTED_TABLE_CYCLE_DETECTED)', () => {
      const a = validTableA();
      a.pattern_type = 'H_nested';
      a.cells[0] = {
        id: 'TCELL-001-01-01',
        row_id: 'TROW-001-01',
        col_id: 'TCOL-001-01',
        value_type: 'nested_table',
        nested_table_id: 'TBL-002',
      };

      const b: KnowledgeContractTable = {
        id: 'TBL-002',
        source_node_id: 'CONCEPT-001',
        title: 'B (cycle target)',
        pattern_type: 'H_nested',
        row_count: 1,
        col_count: 1,
        source: 'fixture',
        book_page: 101,
        pdf_page: 101,
        headers: [
          { id: 'TROW-002-01', axis: 'row', level: 1, index_pos: 1, text: 'r' },
          { id: 'TCOL-002-01', axis: 'column', level: 1, index_pos: 1, text: 'c' },
        ],
        cells: [
          {
            id: 'TCELL-002-01-01',
            row_id: 'TROW-002-01',
            col_id: 'TCOL-002-01',
            value_type: 'nested_table',
            nested_table_id: 'TBL-001', // A로 다시 참조 = 2-cycle
          },
        ],
      };

      const result = validateKnowledgeContract(contractWithTables([a, b]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'NESTED_TABLE_CYCLE_DETECTED',
          path: 'tables',
        }),
      );
    });
  });

  describe('CRIT-D — book_page / pdf_page strict source citation', () => {
    it('rejects table missing book_page (MISSING_SOURCE_PAGE)', () => {
      const t = validTableA();
      (t as { book_page: unknown }).book_page = 0; // 0 invalid — isValidSourcePage false
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_SOURCE_PAGE',
          path: 'tables[0].book_page',
        }),
      );
    });

    it('rejects table missing pdf_page (MISSING_SOURCE_PAGE)', () => {
      const t = validTableA();
      (t as { pdf_page: unknown }).pdf_page = -1; // 음수 invalid
      const result = validateKnowledgeContract(contractWithTables([t]));
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_SOURCE_PAGE',
          path: 'tables[0].pdf_page',
        }),
      );
    });
  });
});
