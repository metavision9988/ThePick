/**
 * Step 14a (Engine Hardening Roadmap v1.3) — parser 결정성 Property Test.
 *
 * AC-PA-1 invariant 100% 동일 (현 시점 검증 가능 부분: section_hierarchy +
 * ontology_registry_match. node_ids/edge_dependency_graph/formula_AST_hashes/
 * constants_canonical_forms 는 LLM 통합 후 14b 에서 5/6 invariant 검증 추가).
 * AC-PA-3/AC-PA-4 ontology Lock 위반 차단.
 *
 * fixture: __fixtures__/batch1/exam_scope.pdf (2 페이지, ≈ 516 + N 문자).
 * iterations: 50 (plan §"위험 분석" — pdfplumber Python subprocess 가속).
 *
 * contract.yaml AC-PA-1, AC-PA-3, AC-PA-4 (`docs/engines/parser/contract.yaml`).
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPdf } from '../pdf-extractor';
import { splitSections } from '../section-splitter';
import { validateKnowledgeContract } from '../schema-validator';
import { compareInvariant, extractInvariantFields } from '../normalizer';
import type { ParserOutput } from '../normalizer';
import type { KnowledgeContract } from '../schema-validator';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '../../__fixtures__/batch1/exam_scope.pdf');

const PIPELINE_ITERATIONS = 50;
const SCHEMA_NUM_RUNS = 50;
const PIPELINE_TIMEOUT_MS = 5 * 60 * 1000;

async function runStaticPipeline(): Promise<ParserOutput> {
  const result = await extractPdf(FIXTURE_PATH);
  const split = splitSections(result.pages);
  // Phase 1 후반 LLM 통합 시 KnowledgeContract.{nodes,edges,formulas,constants} 가
  // 채워진다. Step 14a 시점은 LLM 미통합 상태이므로 빈 contract 로 고정.
  const contract: KnowledgeContract = { nodes: [], edges: [], formulas: [], constants: [] };
  return {
    contract,
    sections: split.sections,
    pageTexts: result.pages.map((p) => p.text),
  };
}

describe('parser invariant determinism (AC-PA-1, section_hierarchy + ontology subset)', () => {
  it(
    `splitSections + ontology_registry_match invariant — ${PIPELINE_ITERATIONS} iterations`,
    async () => {
      const baseline = await runStaticPipeline();
      const baselineSnap = extractInvariantFields(baseline);

      // 사전 검증: fixture 가 의미 있는 섹션 트리를 만들어내는지 확인 — 빈 트리만 비교하면
      // 결정성 검증이 무의미해지는 silent failure 회피.
      expect(baselineSnap.section_hierarchy.length).toBeGreaterThan(2);

      for (let i = 0; i < PIPELINE_ITERATIONS; i++) {
        const current = await runStaticPipeline();
        const currentSnap = extractInvariantFields(current);
        expect(compareInvariant(baselineSnap, currentSnap)).toBe('equal');
      }
    },
    PIPELINE_TIMEOUT_MS,
  );
});

describe('parser ontology Lock 위반 차단 (AC-PA-3 — INVALID_NODE_ID_PATTERN)', () => {
  it(`rejects ontology-registry 외 node id (${SCHEMA_NUM_RUNS} runs)`, () => {
    const validIdPattern = /^(CONCEPT|F|INS|CROP|TERM|LAW|INV)-\d+$/;
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !validIdPattern.test(s)),
        (badId) => {
          const contract: KnowledgeContract = {
            nodes: [
              {
                id: badId,
                type: 'CONCEPT',
                title: 'x',
                content: 'y',
                truth_weight: 5,
                source_page: 1,
              },
            ],
            edges: [],
            formulas: [],
            constants: [],
          };
          const validation = validateKnowledgeContract(contract);
          return (
            !validation.valid &&
            validation.errors.some(
              (e) => e.code === 'INVALID_NODE_ID_PATTERN' || e.code === 'INVALID_NODE_TYPE',
            )
          );
        },
      ),
      { numRuns: SCHEMA_NUM_RUNS },
    );
  });
});

describe('parser ontology Lock 위반 차단 (AC-PA-4 — DANGLING_EDGE_REFERENCE)', () => {
  it(`rejects dangling edge references (${SCHEMA_NUM_RUNS} runs)`, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { id: 'CONCEPT-001', type: 'CONCEPT' as const },
          { id: 'F-01', type: 'FORMULA' as const },
          { id: 'INS-01', type: 'INSURANCE' as const },
        ),
        fc.integer({ min: 100, max: 999 }).map((n) => `CONCEPT-${String(n).padStart(3, '0')}`),
        (declared, dangling) => {
          if (declared.id === dangling) return true;
          const contract: KnowledgeContract = {
            nodes: [
              {
                id: declared.id,
                type: declared.type,
                title: 'x',
                content: 'y',
                truth_weight: 5,
                source_page: 1,
              },
            ],
            edges: [
              {
                source_id: declared.id,
                target_id: dangling,
                edge_type: 'CROSS_REF',
              },
            ],
            formulas: [],
            constants: [],
          };
          const validation = validateKnowledgeContract(contract);
          return (
            !validation.valid && validation.errors.some((e) => e.code === 'DANGLING_EDGE_REFERENCE')
          );
        },
      ),
      { numRuns: SCHEMA_NUM_RUNS },
    );
  });
});
