/**
 * Step 15a (Engine Hardening Roadmap v1.3) — quality 결정성 Property Test (AC-QU-1).
 *
 * `validateGraphIntegrity(nodes, edges)` 출력은 입력 nodes/edges 배열 순서에 의존한다
 * (`findBrokenEdges` / `validateInputIds` for loop, `findSupersedeCycles` Map keys).
 * normalizer.ts 의 정규화를 거치면 입력 순서 무관하게 동일 NormalizedReport 가 나와야 한다.
 *
 * Step 15a 본 세션: manual fixture 5종 × shuffle × 100 iter = 500 시나리오.
 * Step 15b 이연: arbitraryGraph generator (50 random graphs × 100 iter = 5000 시나리오)
 *               + AC-QU-2/3/4/6 (orphan/broken/cycle 5종/성능 1000 노드).
 *
 * contract.yaml AC-QU-1 (`docs/engines/quality/contract.yaml`).
 */

import { describe, it, expect } from 'vitest';
import { validateGraphIntegrity } from '../graph-integrity';
import { compareReports } from '../normalizer';
import type { GraphNode, GraphEdge } from '../graph-integrity';

const ITERATIONS = 100;

interface ManualFixture {
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** 검증 의도 — silent fixture 회피용 */
  expectedViolationTypes: ReadonlyArray<
    'ORPHAN_NODE' | 'BROKEN_EDGE' | 'SUPERSEDES_CYCLE' | 'INVALID_ID' | 'DUPLICATE_ID'
  >;
}

const fixtures: ManualFixture[] = [
  {
    name: 'clean — 5 nodes 4 edges, no violations',
    nodes: [
      { id: 'CONCEPT-001', type: 'CONCEPT', name: 'A' },
      { id: 'CONCEPT-002', type: 'CONCEPT', name: 'B' },
      { id: 'F-01', type: 'FORMULA', name: 'C' },
      { id: 'F-02', type: 'FORMULA', name: 'D' },
      { id: 'INS-01', type: 'INSURANCE', name: 'E' },
    ],
    edges: [
      { id: 'E-01', fromNode: 'CONCEPT-001', toNode: 'CONCEPT-002', edgeType: 'CROSS_REF' },
      { id: 'E-02', fromNode: 'CONCEPT-002', toNode: 'F-01', edgeType: 'USES_FORMULA' },
      { id: 'E-03', fromNode: 'F-01', toNode: 'F-02', edgeType: 'DEPENDS_ON' },
      { id: 'E-04', fromNode: 'INS-01', toNode: 'CONCEPT-001', edgeType: 'APPLIES_TO' },
    ],
    expectedViolationTypes: [],
  },
  {
    name: 'orphan — 1 isolated CONCEPT (TERM 노드는 고아 제외)',
    nodes: [
      { id: 'CONCEPT-001', type: 'CONCEPT', name: 'A' },
      { id: 'CONCEPT-002', type: 'CONCEPT', name: 'B (orphan)' },
      { id: 'F-01', type: 'FORMULA', name: 'C' },
      { id: 'TERM-001', type: 'TERM', name: 'D (TERM 독립 OK)' },
    ],
    edges: [{ id: 'E-01', fromNode: 'CONCEPT-001', toNode: 'F-01', edgeType: 'USES_FORMULA' }],
    expectedViolationTypes: ['ORPHAN_NODE'],
  },
  {
    name: 'broken — 2 broken edges (missing from + missing to)',
    nodes: [
      { id: 'CONCEPT-001', type: 'CONCEPT', name: 'A' },
      { id: 'CONCEPT-002', type: 'CONCEPT', name: 'B' },
    ],
    edges: [
      { id: 'E-01', fromNode: 'CONCEPT-001', toNode: 'CONCEPT-002', edgeType: 'CROSS_REF' },
      { id: 'E-02', fromNode: 'GHOST-NODE', toNode: 'CONCEPT-001', edgeType: 'CROSS_REF' },
      { id: 'E-03', fromNode: 'CONCEPT-001', toNode: 'GHOST-NODE-2', edgeType: 'CROSS_REF' },
    ],
    expectedViolationTypes: ['BROKEN_EDGE'],
  },
  {
    name: 'cycle — 3-cycle SUPERSEDES (A→B→C→A)',
    nodes: [
      { id: 'CONCEPT-001', type: 'CONCEPT', name: 'A' },
      { id: 'CONCEPT-002', type: 'CONCEPT', name: 'B' },
      { id: 'CONCEPT-003', type: 'CONCEPT', name: 'C' },
    ],
    edges: [
      { id: 'E-01', fromNode: 'CONCEPT-001', toNode: 'CONCEPT-002', edgeType: 'SUPERSEDES' },
      { id: 'E-02', fromNode: 'CONCEPT-002', toNode: 'CONCEPT-003', edgeType: 'SUPERSEDES' },
      { id: 'E-03', fromNode: 'CONCEPT-003', toNode: 'CONCEPT-001', edgeType: 'SUPERSEDES' },
    ],
    expectedViolationTypes: ['SUPERSEDES_CYCLE'],
  },
  {
    name: 'mixed — orphan + broken + 2-cycle',
    nodes: [
      { id: 'CONCEPT-001', type: 'CONCEPT', name: 'A' },
      { id: 'CONCEPT-002', type: 'CONCEPT', name: 'B' },
      { id: 'CONCEPT-003', type: 'CONCEPT', name: 'C (orphan)' },
      { id: 'F-01', type: 'FORMULA', name: 'D' },
      { id: 'F-02', type: 'FORMULA', name: 'E' },
    ],
    edges: [
      { id: 'E-01', fromNode: 'CONCEPT-001', toNode: 'CONCEPT-002', edgeType: 'CROSS_REF' },
      { id: 'E-02', fromNode: 'GHOST', toNode: 'F-01', edgeType: 'CROSS_REF' },
      { id: 'E-03', fromNode: 'F-01', toNode: 'F-02', edgeType: 'SUPERSEDES' },
      { id: 'E-04', fromNode: 'F-02', toNode: 'F-01', edgeType: 'SUPERSEDES' },
    ],
    expectedViolationTypes: ['ORPHAN_NODE', 'BROKEN_EDGE', 'SUPERSEDES_CYCLE'],
  },
];

/**
 * Mulberry32 PRNG. contract.yaml `seed_fixed: true` 정합을 위해 결정적 seed 고정.
 * iter 별로 seed = SEED_BASE + i 사용 → 매 iter 다른 순열, 그러나 실행 간 동일.
 */
function makeSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded Fisher-Yates shuffle. */
function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SEED_BASE = 0x15a; // Step 15a (의도적 magic number — seed 고정 가독성)

describe('quality determinism property (AC-QU-1)', () => {
  for (const fixture of fixtures) {
    it(`${fixture.name} — input shuffle × ${ITERATIONS} iter`, () => {
      const baseline = validateGraphIntegrity(fixture.nodes, fixture.edges);

      // 사전 검증: fixture 가 의도된 violation type 을 발생시키는지 — silent fixture 회피.
      const baseTypes = new Set(baseline.violations.map((v) => v.type));
      for (const expected of fixture.expectedViolationTypes) {
        expect(baseTypes.has(expected)).toBe(true);
      }
      if (fixture.expectedViolationTypes.length === 0) {
        expect(baseline.valid).toBe(true);
      }

      for (let i = 0; i < ITERATIONS; i++) {
        const rng = makeSeededRandom(SEED_BASE + i);
        const shuffledNodes = shuffle(fixture.nodes, rng);
        const shuffledEdges = shuffle(fixture.edges, rng);
        const current = validateGraphIntegrity(shuffledNodes, shuffledEdges);
        expect(compareReports(baseline, current)).toBe('equal');
      }
    });
  }
});
