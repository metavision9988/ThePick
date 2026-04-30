/**
 * Step 14a normalizer.ts 단위 테스트.
 *
 * AC-PA-1 invariant / AC-PA-2 tolerable 분리 함수의 정렬·canonical·비교 동작
 * 보장. property test (determinism.property.test.ts) 의 도구 무결성 1차 방어선.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TOLERABLE_THRESHOLD,
  compareInvariant,
  compareTolerable,
  extractInvariantFields,
  extractTolerableFields,
} from '../normalizer';
import type { InvariantSnapshot, ParserOutput, TolerableSnapshot } from '../normalizer';
import type { KnowledgeContract } from '../schema-validator';
import type { Section } from '../section-splitter';

function emptyContract(): KnowledgeContract {
  return { nodes: [], edges: [], formulas: [], constants: [] };
}

function emptyOutput(): ParserOutput {
  return { contract: emptyContract(), sections: [], pageTexts: [] };
}

function validContract(): KnowledgeContract {
  return {
    nodes: [
      {
        id: 'CONCEPT-002',
        type: 'CONCEPT',
        title: '둘째',
        content: '내용2',
        truth_weight: 5,
        source_page: 10,
      },
      {
        id: 'CONCEPT-001',
        type: 'CONCEPT',
        title: '첫째',
        content: '내용1',
        truth_weight: 4,
        source_page: 5,
      },
    ],
    edges: [{ source_id: 'CONCEPT-001', target_id: 'CONCEPT-002', edge_type: 'CROSS_REF' }],
    formulas: [
      {
        id: 'F-01',
        name: '보험가입금액',
        equation_template: 'a * b',
        variables_schema: '{"a":"number","b":"number"}',
        source_page: 12,
      },
    ],
    constants: [
      {
        id: 'CONST-001',
        name: '자기부담비율',
        value: '0.20',
        category: 'deductible',
        source_page: 5,
      },
    ],
  };
}

function leafSection(heading: string, page: number): Section {
  return {
    level: 'subsection',
    heading,
    body: '',
    startPage: page,
    endPage: page,
    children: [],
  };
}

// ---------------- extractInvariantFields ----------------

describe('extractInvariantFields', () => {
  it('returns sorted node_ids regardless of input order', () => {
    const snap = extractInvariantFields({ ...emptyOutput(), contract: validContract() });
    expect(snap.node_ids).toEqual(['CONCEPT-001', 'CONCEPT-002']);
  });

  it('edge_dependency_graph is independent of input order', () => {
    const a = validContract();
    const b: KnowledgeContract = {
      ...a,
      edges: [...a.edges].reverse(),
    };
    b.edges.push({ source_id: 'CONCEPT-002', target_id: 'CONCEPT-001', edge_type: 'CROSS_REF' });
    a.edges.push({ source_id: 'CONCEPT-002', target_id: 'CONCEPT-001', edge_type: 'CROSS_REF' });

    const snapA = extractInvariantFields({ ...emptyOutput(), contract: a });
    const snapB = extractInvariantFields({ ...emptyOutput(), contract: b });
    expect(snapA.edge_dependency_graph).toBe(snapB.edge_dependency_graph);
  });

  it('formula_AST_hashes는 동일 (template, schema) 입력에 동일 해시 반환', () => {
    const c1 = validContract();
    const c2 = validContract();
    const snap1 = extractInvariantFields({ ...emptyOutput(), contract: c1 });
    const snap2 = extractInvariantFields({ ...emptyOutput(), contract: c2 });
    expect(snap1.formula_AST_hashes['F-01']).toBe(snap2.formula_AST_hashes['F-01']);
    expect(snap1.formula_AST_hashes['F-01']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('formula_AST_hashes는 equation_template 변경 시 다른 해시', () => {
    const c1 = validContract();
    const c2 = validContract();
    c2.formulas[0].equation_template = 'a + b';
    const snap1 = extractInvariantFields({ ...emptyOutput(), contract: c1 });
    const snap2 = extractInvariantFields({ ...emptyOutput(), contract: c2 });
    expect(snap1.formula_AST_hashes['F-01']).not.toBe(snap2.formula_AST_hashes['F-01']);
  });

  it('formula_AST_hashes는 variables_schema 키 순서 변경에 불변 (canonicalJson 정규화)', () => {
    const c1 = validContract();
    const c2 = validContract();
    c1.formulas[0].variables_schema = '{"a":"number","b":"number"}';
    c2.formulas[0].variables_schema = '{"b":"number","a":"number"}';
    const snap1 = extractInvariantFields({ ...emptyOutput(), contract: c1 });
    const snap2 = extractInvariantFields({ ...emptyOutput(), contract: c2 });
    expect(snap1.formula_AST_hashes['F-01']).toBe(snap2.formula_AST_hashes['F-01']);
  });

  it('formula_AST_hashes는 equation_template 와 variables_schema 합성 충돌을 차단', () => {
    const c1 = validContract();
    const c2 = validContract();
    // c1: 정상. c2: equation_template 에 schema 텍스트를 흡수시키고 schema 를 빈 객체로 변경.
    // HASH_SEPARATOR (|::|) 가 양쪽을 명시 구분하므로 합성 결과가 달라야 한다.
    c1.formulas[0].equation_template = 'a + b';
    c1.formulas[0].variables_schema = '{"a":"number"}';
    c2.formulas[0].equation_template = 'a + b{"a":"number"}';
    c2.formulas[0].variables_schema = '{}';
    const snap1 = extractInvariantFields({ ...emptyOutput(), contract: c1 });
    const snap2 = extractInvariantFields({ ...emptyOutput(), contract: c2 });
    expect(snap1.formula_AST_hashes['F-01']).not.toBe(snap2.formula_AST_hashes['F-01']);
  });

  it('formula_AST_hashes는 variables_schema 가 invalid JSON 일 때 raw fallback (schema-validator 가 별도 검증)', () => {
    const c = validContract();
    c.formulas[0].variables_schema = 'NOT_JSON_AT_ALL';
    const snap = extractInvariantFields({ ...emptyOutput(), contract: c });
    expect(snap.formula_AST_hashes['F-01']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ontology_registry_match=true for valid contract', () => {
    const snap = extractInvariantFields({ ...emptyOutput(), contract: validContract() });
    expect(snap.ontology_registry_match).toBe(true);
  });

  it('ontology_registry_match=false for INVALID_NODE_ID_PATTERN', () => {
    const c = validContract();
    c.nodes[0].id = 'INVALID-XYZ-999';
    const snap = extractInvariantFields({ ...emptyOutput(), contract: c });
    expect(snap.ontology_registry_match).toBe(false);
  });

  it('ontology_registry_match=true for missing source_page (not an ontology violation)', () => {
    const c = validContract();
    c.nodes[0].source_page = 0;
    const snap = extractInvariantFields({ ...emptyOutput(), contract: c });
    expect(snap.ontology_registry_match).toBe(true);
  });

  it('section_hierarchy serializes nested tree deterministically', () => {
    const sections: Section[] = [
      {
        level: 'chapter',
        heading: '제1장',
        body: '',
        startPage: 1,
        endPage: 10,
        children: [leafSection('제1절', 1), leafSection('제2절', 5)],
      },
    ];
    const snap = extractInvariantFields({ ...emptyOutput(), sections });
    expect(snap.section_hierarchy).toContain('제1장');
    expect(snap.section_hierarchy).toContain('제1절');
    expect(snap.section_hierarchy).toContain('제2절');

    const snap2 = extractInvariantFields({ ...emptyOutput(), sections });
    expect(snap.section_hierarchy).toBe(snap2.section_hierarchy);
  });

  it('빈 contract + 빈 sections → 빈 invariant 필드', () => {
    const snap = extractInvariantFields(emptyOutput());
    expect(snap.node_ids).toEqual([]);
    expect(snap.edge_dependency_graph).toBe('[]');
    expect(snap.formula_AST_hashes).toEqual({});
    expect(snap.constants_canonical_forms).toEqual({});
    expect(snap.section_hierarchy).toBe('[]');
  });
});

// ---------------- extractTolerableFields ----------------

describe('extractTolerableFields', () => {
  it('whitespace_density=0 for empty pageTexts', () => {
    const tol = extractTolerableFields(emptyOutput());
    expect(tol.whitespace_density).toBe(0);
    expect(tol.raw_line_break_count).toBe(0);
  });

  it('counts line breaks across pages', () => {
    const tol = extractTolerableFields({
      ...emptyOutput(),
      pageTexts: ['line1\nline2\n', 'line3\n'],
    });
    expect(tol.raw_line_break_count).toBe(3);
  });

  it('whitespace_density 계산: 공백/총문자', () => {
    const tol = extractTolerableFields({
      ...emptyOutput(),
      pageTexts: ['ab cd'], // 5 chars, 1 space → 0.2
    });
    expect(tol.whitespace_density).toBeCloseTo(0.2, 5);
  });

  it('vision_corrected_segments는 현재 빈 배열', () => {
    const tol = extractTolerableFields({ ...emptyOutput(), pageTexts: ['x'] });
    expect(tol.vision_corrected_segments).toEqual([]);
  });
});

// ---------------- compareInvariant ----------------

describe('compareInvariant', () => {
  function snapshotOf(c: KnowledgeContract): InvariantSnapshot {
    return extractInvariantFields({ ...emptyOutput(), contract: c });
  }

  it('equal for identical contracts', () => {
    const a = snapshotOf(validContract());
    const b = snapshotOf(validContract());
    expect(compareInvariant(a, b)).toBe('equal');
  });

  it('differs when single node id changes', () => {
    const a = snapshotOf(validContract());
    const c2 = validContract();
    c2.nodes[0].id = 'CONCEPT-099';
    const b = snapshotOf(c2);
    expect(compareInvariant(a, b)).toBe('differs');
  });

  it('differs when constant value changes', () => {
    const a = snapshotOf(validContract());
    const c2 = validContract();
    c2.constants[0].value = '0.30';
    const b = snapshotOf(c2);
    expect(compareInvariant(a, b)).toBe('differs');
  });
});

// ---------------- compareTolerable ----------------

describe('compareTolerable', () => {
  const baseline: TolerableSnapshot = {
    raw_line_break_count: 100,
    whitespace_density: 0.2,
    vision_corrected_segments: [],
  };

  it('passed=true when both metrics identical', () => {
    const result = compareTolerable(baseline, { ...baseline });
    expect(result.variance).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('passed=true when variance under threshold', () => {
    const slight: TolerableSnapshot = {
      raw_line_break_count: 102, // 2% diff
      whitespace_density: 0.201, // 0.5% diff
      vision_corrected_segments: [],
    };
    const result = compareTolerable(baseline, slight);
    expect(result.passed).toBe(true);
    expect(result.variance).toBeLessThanOrEqual(DEFAULT_TOLERABLE_THRESHOLD);
  });

  it('passed=false when variance exceeds threshold', () => {
    const big: TolerableSnapshot = {
      raw_line_break_count: 200, // 50% diff
      whitespace_density: 0.4, // 50% diff
      vision_corrected_segments: [],
    };
    const result = compareTolerable(baseline, big);
    expect(result.passed).toBe(false);
    expect(result.variance).toBeGreaterThan(DEFAULT_TOLERABLE_THRESHOLD);
  });

  it('threshold 인자 override', () => {
    const moderate: TolerableSnapshot = {
      raw_line_break_count: 110, // 10% diff
      whitespace_density: 0.22, // 10% diff
      vision_corrected_segments: [],
    };
    expect(compareTolerable(baseline, moderate, 0.05).passed).toBe(false);
    expect(compareTolerable(baseline, moderate, 0.2).passed).toBe(true);
  });
});
