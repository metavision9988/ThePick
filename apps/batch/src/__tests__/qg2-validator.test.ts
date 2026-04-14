/**
 * QG-2 검증기 테스트 — mock 데이터로 검증 로직 확인
 */

import { describe, it, expect } from 'vitest';
import type { GraphNode, GraphEdge } from '@thepick/quality';
import type { GoldenTestCase } from '../qg2-validator';
import {
  checkGraphScale,
  checkFormulaRegistry,
  checkFormulaAccuracy,
  checkGraphIntegrity,
  runQG2Validation,
} from '../qg2-validator';

// --- Mock 데이터 생성 헬퍼 ---

function makeNodes(count: number): GraphNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `N-${String(i + 1).padStart(3, '0')}`,
    type: 'CONCEPT' as const,
    name: `Node ${i + 1}`,
  }));
}

function makeEdges(nodes: GraphNode[], count: number): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (let i = 0; i < count && i < nodes.length - 1; i++) {
    edges.push({
      id: `E-${String(i + 1).padStart(3, '0')}`,
      fromNode: nodes[i].id,
      toNode: nodes[i + 1].id,
      edgeType: 'DEPENDS_ON' as const,
    });
  }
  // 추가 엣지로 count 맞추기
  for (let i = nodes.length - 1; i < count; i++) {
    const from = i % nodes.length;
    const to = (i + 2) % nodes.length;
    if (from !== to) {
      edges.push({
        id: `E-${String(i + 1).padStart(3, '0')}`,
        fromNode: nodes[from].id,
        toNode: nodes[to].id,
        edgeType: 'APPLIES_TO' as const,
      });
    }
  }
  return edges;
}

// --- 테스트 ---

describe('QG-2 Validator', () => {
  describe('checkGraphScale', () => {
    it('60+ 노드, 200+ 엣지 → 통과', () => {
      const nodes = makeNodes(65);
      const edges = makeEdges(nodes, 210);
      const checks = checkGraphScale(nodes, edges);
      expect(checks.every((c) => c.passed)).toBe(true);
    });

    it('노드 부족 → 실패', () => {
      const nodes = makeNodes(30);
      const edges = makeEdges(nodes, 210);
      const checks = checkGraphScale(nodes, edges);
      expect(checks[0].passed).toBe(false);
    });
  });

  describe('checkFormulaRegistry', () => {
    it('BATCH-1 기준 13+ 산식 등록 확인', () => {
      const check = checkFormulaRegistry('BATCH-1');
      expect(check.passed).toBe(true);
      // 68개 전체 등록 (BATCH 1~5)
      expect(Number(check.actual)).toBeGreaterThanOrEqual(13);
    });

    it('BATCH-5 기준 68+ 산식 등록 확인', () => {
      const check = checkFormulaRegistry('BATCH-5');
      expect(check.passed).toBe(true);
      expect(check.actual).toBe('68');
    });
  });

  describe('checkFormulaAccuracy', () => {
    it('Golden test 통과', () => {
      const goldenTests: GoldenTestCase[] = [
        {
          formulaId: 'F-01',
          inputs: { damaged_fruits: 30, normal_fruits: 70 },
          expectedValue: 0.3,
        },
        {
          formulaId: 'F-03',
          inputs: { total_sample: 10, variety_target: 33, total_target: 100 },
          expectedValue: 4,
        },
      ];
      const checks = checkFormulaAccuracy(goldenTests);
      expect(checks.every((c) => c.passed)).toBe(true);
    });

    it('잘못된 기대값 → 실패', () => {
      const goldenTests: GoldenTestCase[] = [
        {
          formulaId: 'F-01',
          inputs: { damaged_fruits: 30, normal_fruits: 70 },
          expectedValue: 0.5,
        },
      ];
      const checks = checkFormulaAccuracy(goldenTests);
      expect(checks[0].passed).toBe(false);
    });
  });

  describe('checkGraphIntegrity', () => {
    it('정상 그래프 → 무결성 통과', () => {
      const nodes = makeNodes(10);
      const edges = makeEdges(nodes, 9);
      const checks = checkGraphIntegrity(nodes, edges);
      expect(checks.every((c) => c.passed)).toBe(true);
    });
  });

  describe('runQG2Validation', () => {
    it('전체 통과 시나리오', () => {
      const nodes = makeNodes(65);
      const edges = makeEdges(nodes, 210);
      const goldenTests: GoldenTestCase[] = [
        {
          formulaId: 'F-01',
          inputs: { damaged_fruits: 30, normal_fruits: 70 },
          expectedValue: 0.3,
        },
      ];
      const result = runQG2Validation(nodes, edges, goldenTests);
      expect(result.passed).toBe(true);
      expect(result.summary).toContain('PASSED');
    });

    it('노드 부족 시 QG-2 실패', () => {
      const nodes = makeNodes(10);
      const edges = makeEdges(nodes, 9);
      const result = runQG2Validation(nodes, edges, []);
      expect(result.passed).toBe(false);
      expect(result.summary).toContain('FAILED');
    });
  });
});
