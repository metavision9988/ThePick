import { describe, it, expect } from 'vitest';
import type { GraphNode, GraphEdge } from '../graph-integrity';
import {
  findOrphanNodes,
  findBrokenEdges,
  findSupersedeCycles,
  validateGraphIntegrity,
} from '../graph-integrity';

// --- 테스트 헬퍼 ---

function node(
  id: string,
  name?: string,
  isActive?: boolean,
  type: GraphNode['type'] = 'CONCEPT',
): GraphNode {
  return { id, type, name: name ?? id, isActive };
}

function edge(
  id: string,
  from: string,
  to: string,
  edgeType: GraphEdge['edgeType'] = 'DEPENDS_ON',
  isActive?: boolean,
): GraphEdge {
  return { id, fromNode: from, toNode: to, edgeType, isActive };
}

// --- 고아 노드 ---

describe('findOrphanNodes', () => {
  it('엣지에 연결된 노드는 고아가 아님', () => {
    const nodes = [node('A'), node('B')];
    const edges = [edge('e1', 'A', 'B')];
    expect(findOrphanNodes(nodes, edges)).toEqual([]);
  });

  it('엣지 없는 활성 노드는 고아', () => {
    const nodes = [node('A'), node('B'), node('C')];
    const edges = [edge('e1', 'A', 'B')];
    const result = findOrphanNodes(nodes, edges);
    expect(result).toHaveLength(1);
    expect(result[0].entityId).toBe('C');
    expect(result[0].type).toBe('ORPHAN_NODE');
  });

  it('비활성 노드는 고아 검사 제외', () => {
    const nodes = [node('A'), node('B'), node('C', 'C', false)];
    const edges = [edge('e1', 'A', 'B')];
    expect(findOrphanNodes(nodes, edges)).toEqual([]);
  });

  it('비활성 엣지는 연결로 인정하지 않음', () => {
    const nodes = [node('A'), node('B')];
    const edges = [edge('e1', 'A', 'B', 'DEPENDS_ON', false)];
    const result = findOrphanNodes(nodes, edges);
    expect(result).toHaveLength(2); // A, B 모두 고아
  });

  it('TERM 노드는 엣지 없어도 고아가 아님', () => {
    const nodes = [node('A'), node('B'), node('T1', '자기부담비율', undefined, 'TERM')];
    const edges = [edge('e1', 'A', 'B')];
    expect(findOrphanNodes(nodes, edges)).toEqual([]);
  });

  it('노드 0개, 엣지 0개 → 빈 결과', () => {
    expect(findOrphanNodes([], [])).toEqual([]);
  });
});

// --- 끊긴 엣지 ---

describe('findBrokenEdges', () => {
  it('유효한 엣지는 통과', () => {
    const nodes = [node('A'), node('B')];
    const edges = [edge('e1', 'A', 'B')];
    expect(findBrokenEdges(nodes, edges)).toEqual([]);
  });

  it('from_node 없는 엣지 감지', () => {
    const nodes = [node('B')];
    const edges = [edge('e1', 'A', 'B')];
    const result = findBrokenEdges(nodes, edges);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('BROKEN_EDGE');
    expect(result[0].details).toEqual({ missingNode: 'A', side: 'from' });
  });

  it('to_node 없는 엣지 감지', () => {
    const nodes = [node('A')];
    const edges = [edge('e1', 'A', 'B')];
    const result = findBrokenEdges(nodes, edges);
    expect(result).toHaveLength(1);
    expect(result[0].details).toEqual({ missingNode: 'B', side: 'to' });
  });

  it('양쪽 다 없으면 2건', () => {
    const nodes: GraphNode[] = [];
    const edges = [edge('e1', 'A', 'B')];
    const result = findBrokenEdges(nodes, edges);
    expect(result).toHaveLength(2);
  });

  it('엣지 0개 → 빈 결과', () => {
    expect(findBrokenEdges([node('A')], [])).toEqual([]);
  });

  it('비활성 엣지는 검사 제외', () => {
    const nodes = [node('A')];
    const edges = [edge('e1', 'A', 'MISSING', 'DEPENDS_ON', false)];
    expect(findBrokenEdges(nodes, edges)).toEqual([]);
  });
});

// --- SUPERSEDES 순환 ---

describe('findSupersedeCycles', () => {
  it('순환 없는 SUPERSEDES 체인 통과', () => {
    // A → B → C (선형)
    const edges = [edge('e1', 'A', 'B', 'SUPERSEDES'), edge('e2', 'B', 'C', 'SUPERSEDES')];
    expect(findSupersedeCycles(edges)).toEqual([]);
  });

  it('A→B→A 순환 감지', () => {
    const edges = [edge('e1', 'A', 'B', 'SUPERSEDES'), edge('e2', 'B', 'A', 'SUPERSEDES')];
    const result = findSupersedeCycles(edges);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('SUPERSEDES_CYCLE');
  });

  it('A→B→C→A 3노드 순환 감지', () => {
    const edges = [
      edge('e1', 'A', 'B', 'SUPERSEDES'),
      edge('e2', 'B', 'C', 'SUPERSEDES'),
      edge('e3', 'C', 'A', 'SUPERSEDES'),
    ];
    const result = findSupersedeCycles(edges);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].type).toBe('SUPERSEDES_CYCLE');
  });

  it('SUPERSEDES 아닌 엣지는 무시', () => {
    const edges = [edge('e1', 'A', 'B', 'DEPENDS_ON'), edge('e2', 'B', 'A', 'DEPENDS_ON')];
    expect(findSupersedeCycles(edges)).toEqual([]);
  });

  it('엣지 0개 → 빈 결과', () => {
    expect(findSupersedeCycles([])).toEqual([]);
  });

  it('자기 참조 순환 감지 (A→A)', () => {
    const edges = [edge('e1', 'A', 'A', 'SUPERSEDES')];
    const result = findSupersedeCycles(edges);
    expect(result).toHaveLength(1);
  });

  it('비활성 SUPERSEDES 엣지는 순환 검사 제외', () => {
    const edges = [
      edge('e1', 'A', 'B', 'SUPERSEDES', false),
      edge('e2', 'B', 'A', 'SUPERSEDES', false),
    ];
    expect(findSupersedeCycles(edges)).toEqual([]);
  });
});

// --- 통합 검증 ---

describe('validateGraphIntegrity', () => {
  it('정상 그래프 → valid: true', () => {
    const nodes = [node('A'), node('B'), node('C')];
    const edges = [edge('e1', 'A', 'B'), edge('e2', 'B', 'C'), edge('e3', 'A', 'C')];
    const report = validateGraphIntegrity(nodes, edges);
    expect(report.valid).toBe(true);
    expect(report.violations).toHaveLength(0);
    expect(report.stats.totalNodes).toBe(3);
    expect(report.stats.totalEdges).toBe(3);
    expect(report.stats.orphanNodes).toBe(0);
    expect(report.stats.brokenEdges).toBe(0);
    expect(report.stats.supersedeCycles).toBe(0);
  });

  it('복합 위반: 고아 + 끊긴 엣지 동시 감지', () => {
    const nodes = [node('A'), node('B'), node('ORPHAN')];
    const edges = [
      edge('e1', 'A', 'B'),
      edge('e2', 'A', 'MISSING'), // 끊긴 엣지
    ];
    const report = validateGraphIntegrity(nodes, edges);
    expect(report.valid).toBe(false);
    expect(report.stats.orphanNodes).toBe(1); // ORPHAN
    expect(report.stats.brokenEdges).toBe(1); // MISSING
  });

  it('SUPERSEDES 체인 + 비활성 노드 정상', () => {
    const nodes = [node('V1', 'Old', false), node('V2', 'Current')];
    const edges = [edge('e1', 'V2', 'V1', 'SUPERSEDES')];
    const report = validateGraphIntegrity(nodes, edges);
    expect(report.valid).toBe(true);
    expect(report.stats.activeNodes).toBe(1);
  });

  it('중복 노드 ID 감지', () => {
    const nodes = [node('A'), node('A', 'A-dup')];
    const edges = [edge('e1', 'A', 'A')];
    const report = validateGraphIntegrity(nodes, edges);
    expect(report.valid).toBe(false);
    const dupViolation = report.violations.find((v) => v.type === 'DUPLICATE_ID');
    expect(dupViolation).toBeDefined();
  });
});
