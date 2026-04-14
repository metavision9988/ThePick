/**
 * M14 Graph 무결성 검증기
 *
 * Knowledge Graph의 구조적 무결성을 검증한다:
 *   1. 고아 노드: 어떤 엣지에도 연결되지 않은 노드
 *   2. 끊긴 엣지: from_node 또는 to_node가 존재하지 않는 엣지
 *   3. SUPERSEDES 순환: SUPERSEDES 엣지의 순환 참조
 *
 * D1 직접 의존 없이 순수 데이터 구조로 동작 (DI).
 */

import type { NodeType, EdgeType } from '@thepick/shared';

// --- 입력 타입 ---

export interface GraphNode {
  readonly id: string;
  readonly type: NodeType;
  readonly name: string;
  readonly isActive?: boolean;
}

export interface GraphEdge {
  readonly id: string;
  readonly fromNode: string;
  readonly toNode: string;
  readonly edgeType: EdgeType;
  readonly isActive?: boolean;
}

// --- 검증 결과 ---

export type ViolationType =
  | 'ORPHAN_NODE'
  | 'BROKEN_EDGE'
  | 'SUPERSEDES_CYCLE'
  | 'INVALID_ID'
  | 'DUPLICATE_ID';

export interface Violation {
  readonly type: ViolationType;
  readonly entityId: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export interface IntegrityReport {
  readonly valid: boolean;
  readonly violations: readonly Violation[];
  readonly stats: {
    readonly totalNodes: number;
    readonly totalEdges: number;
    readonly activeNodes: number;
    readonly activeEdges: number;
    readonly orphanNodes: number;
    readonly brokenEdges: number;
    readonly supersedeCycles: number;
  };
}

// --- 검증 함수 ---

/**
 * 고아 노드 탐지: 활성 엣지에 연결되지 않은 활성 노드.
 * 비활성 노드는 SUPERSEDES된 것이므로 고아 검사에서 제외.
 */
export function findOrphanNodes(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): Violation[] {
  const connectedIds = new Set<string>();

  for (const edge of edges) {
    if (edge.isActive !== false) {
      connectedIds.add(edge.fromNode);
      connectedIds.add(edge.toNode);
    }
  }

  const violations: Violation[] = [];
  for (const node of nodes) {
    if (node.isActive === false) continue;
    // TERM 노드는 독립 용어 정의 — 엣지 없이 존재 가능
    if (node.type === 'TERM') continue;
    if (!connectedIds.has(node.id)) {
      violations.push({
        type: 'ORPHAN_NODE',
        entityId: node.id,
        message: `Orphan node: ${node.id} (${node.name}) has no active edges`,
      });
    }
  }

  return violations;
}

/**
 * 끊긴 엣지 탐지: from_node 또는 to_node가 노드 목록에 없는 엣지.
 */
export function findBrokenEdges(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): Violation[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const violations: Violation[] = [];

  for (const edge of edges) {
    if (edge.isActive === false) continue;
    if (!nodeIds.has(edge.fromNode)) {
      violations.push({
        type: 'BROKEN_EDGE',
        entityId: edge.id,
        message: `Broken edge: ${edge.id} references missing from_node '${edge.fromNode}'`,
        details: { missingNode: edge.fromNode, side: 'from' },
      });
    }
    if (!nodeIds.has(edge.toNode)) {
      violations.push({
        type: 'BROKEN_EDGE',
        entityId: edge.id,
        message: `Broken edge: ${edge.id} references missing to_node '${edge.toNode}'`,
        details: { missingNode: edge.toNode, side: 'to' },
      });
    }
  }

  return violations;
}

/**
 * SUPERSEDES 순환 탐지: A→B→C→A 같은 순환이 있으면 어떤 노드가
 * 최신인지 판단할 수 없다.
 *
 * DFS 기반 순환 감지. SUPERSEDES 엣지만 대상.
 */
export function findSupersedeCycles(edges: readonly GraphEdge[]): Violation[] {
  // SUPERSEDES 엣지만 추출하여 인접 리스트 구성
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.edgeType !== 'SUPERSEDES') continue;
    if (edge.isActive === false) continue;
    const list = adj.get(edge.fromNode);
    if (list) {
      list.push(edge.toNode);
    } else {
      adj.set(edge.fromNode, [edge.toNode]);
    }
  }

  const violations: Violation[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  const path: string[] = [];

  function dfs(node: string): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart).concat(node);
      violations.push({
        type: 'SUPERSEDES_CYCLE',
        entityId: node,
        message: `SUPERSEDES cycle detected: ${cycle.join(' → ')}`,
        details: { cycle },
      });
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const neighbors = adj.get(node);
    if (neighbors) {
      for (const next of neighbors) {
        dfs(next);
      }
    }

    path.pop();
    inStack.delete(node);
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return violations;
}

/**
 * 입력 데이터의 ID 유효성 검증: 빈 ID, 중복 ID 감지.
 */
function validateInputIds(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): Violation[] {
  const violations: Violation[] = [];
  const seenNodeIds = new Set<string>();

  for (const node of nodes) {
    if (!node.id) {
      violations.push({
        type: 'INVALID_ID',
        entityId: String(node.id),
        message: `Invalid node ID: ${JSON.stringify(node.id)}`,
      });
      continue;
    }
    if (seenNodeIds.has(node.id)) {
      violations.push({
        type: 'DUPLICATE_ID',
        entityId: node.id,
        message: `Duplicate node ID: ${node.id}`,
      });
    }
    seenNodeIds.add(node.id);
  }

  const seenEdgeIds = new Set<string>();
  for (const edge of edges) {
    if (!edge.id) {
      violations.push({
        type: 'INVALID_ID',
        entityId: String(edge.id),
        message: `Invalid edge ID: ${JSON.stringify(edge.id)}`,
      });
      continue;
    }
    if (seenEdgeIds.has(edge.id)) {
      violations.push({
        type: 'DUPLICATE_ID',
        entityId: edge.id,
        message: `Duplicate edge ID: ${edge.id}`,
      });
    }
    seenEdgeIds.add(edge.id);
  }

  return violations;
}

/**
 * 전체 무결성 검증을 실행하고 보고서를 반환한다.
 */
export function validateGraphIntegrity(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): IntegrityReport {
  // 입력 검증: 빈/중복 ID 감지
  const inputViolations = validateInputIds(nodes, edges);

  const orphans = findOrphanNodes(nodes, edges);
  const broken = findBrokenEdges(nodes, edges);
  const cycles = findSupersedeCycles(edges);

  const violations = [...inputViolations, ...orphans, ...broken, ...cycles];

  let activeNodes = 0;
  for (const n of nodes) {
    if (n.isActive !== false) activeNodes++;
  }
  let activeEdges = 0;
  for (const e of edges) {
    if (e.isActive !== false) activeEdges++;
  }

  return {
    valid: violations.length === 0,
    violations,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      activeNodes,
      activeEdges,
      orphanNodes: orphans.length,
      brokenEdges: broken.length,
      supersedeCycles: cycles.length,
    },
  };
}
