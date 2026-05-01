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

/**
 * SUPERSEDES chain 의 최대 허용 깊이 (Sprint 1 §5.1 CRITICAL-N1 흡수, 2026-05-01).
 *
 * Sprint 0 baseline microbench 결과 — naive recursive DFS 는 V8 default stack
 * (~10K frames) 한계로 N=10K deep chain 에서 stack overflow. 본 모듈은 iterative
 * DFS 로 전환되어 stack overflow 차단되나, 100K+ 깊이 chain 은 정상 데이터로 보기
 * 어려우므로 명시 sentinel 로 차단 — fixture 실수 / 악의적 입력 / 데이터 부패 방어.
 *
 * 합리적 상한: 10년 × 매년 100건 개정 × 평균 2회 SUPERSEDES = 2,000 깊이 — 50,000
 * 으로 보수적 설정. 초과 시 SupersedeChainTooDeepError throw (CRITICAL RULE #5).
 */
export const MAX_SUPERSEDE_CHAIN_DEPTH = 50_000;

/**
 * SUPERSEDES chain depth 한계 초과 시 throw. recover.ts CheckpointCorruptedError 와
 * 동일 패턴 — 정상 흐름이 아니므로 silent return 대신 명시 throw.
 *
 * **error.depth 의미 (Sprint 1 §5.1 4-Pass MAJOR-2-M1 흡수, 2026-05-01)**:
 * `depth` 는 sentinel 발화 시점의 stack 길이 (= MAX_SUPERSEDE_CHAIN_DEPTH + 1)이며,
 * 입력 chain 의 **실제 총 깊이가 아니다**. 입력 chain 이 1M depth 여도 동일하게
 * `depth = 50_001` 로 보고됨. "최소 이 깊이는 확실하다"는 lower bound 만 보장.
 * 실제 chain 깊이 측정은 별도 sanity check 함수로 처리해야 함 (현 시점 미구현).
 */
export class SupersedeChainTooDeepError extends Error {
  readonly code = 'SUPERSEDE_CHAIN_TOO_DEEP' as const;
  /** sentinel 발화 시점 stack 길이. 실제 chain 의 lower bound (정확값 아님). */
  readonly depth: number;
  readonly maxDepth: number;
  constructor(depth: number, maxDepth: number, sampleNodeId: string) {
    super(
      `SUPERSEDES chain has at least ${depth} nodes (cut off at MAX_SUPERSEDE_CHAIN_DEPTH=${maxDepth} sentinel; ` +
        `actual depth may be larger) near node '${sampleNodeId}'. ` +
        `This indicates fixture corruption or malicious input. ` +
        `Investigate revision_changes table or BATCH source for unbounded chain.`,
    );
    this.name = 'SupersedeChainTooDeepError';
    this.depth = depth;
    this.maxDepth = maxDepth;
  }
}

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
 * **iterative DFS** (explicit stack) 기반 순환 감지. SUPERSEDES 엣지만 대상.
 *
 * Sprint 1 §5.1 CRITICAL-N1 흡수 (2026-05-01): 본 함수는 원래 재귀 dfs() 였으나
 * V8 default stack (~10K frames) 한계로 N=10K deep chain 에서 stack overflow 발생
 * (Sprint 0 baseline microbench 검증). iterative 전환으로 stack overflow 차단 +
 * MAX_SUPERSEDE_CHAIN_DEPTH sentinel 로 비정상 데이터 명시 throw.
 *
 * @throws {SupersedeChainTooDeepError} chain 깊이가 MAX_SUPERSEDE_CHAIN_DEPTH 초과 시
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

  /**
   * 명시 stack frame — 재귀 호출 1회를 1 frame 으로 매핑.
   * neighbors 를 미리 캐싱 + index 로 진행하여 동일 frame 에서 next neighbor 처리 시
   * `adj.get()` 재호출 비용 회피.
   */
  interface Frame {
    readonly node: string;
    readonly neighbors: readonly string[];
    index: number;
  }
  const stack: Frame[] = [];

  for (const root of adj.keys()) {
    if (visited.has(root)) continue;

    // root entering — 재귀 dfs(root) 의 visited/inStack/path push 동치
    visited.add(root);
    inStack.add(root);
    path.push(root);
    stack.push({ node: root, neighbors: adj.get(root) ?? [], index: 0 });

    while (stack.length > 0) {
      // sentinel: stack 깊이 = path 깊이 = 현재 chain depth
      if (stack.length > MAX_SUPERSEDE_CHAIN_DEPTH) {
        throw new SupersedeChainTooDeepError(
          stack.length,
          MAX_SUPERSEDE_CHAIN_DEPTH,
          stack[stack.length - 1].node,
        );
      }

      const frame = stack[stack.length - 1];

      if (frame.index >= frame.neighbors.length) {
        // 모든 자식 처리 완료 — exit (재귀 dfs() 의 path.pop / inStack.delete 동치)
        stack.pop();
        inStack.delete(frame.node);
        path.pop();
        continue;
      }

      const next = frame.neighbors[frame.index];
      frame.index += 1;

      if (inStack.has(next)) {
        // cycle detected — 재귀 코드의 'return' 동치 (next 는 frame 미생성)
        const cycleStart = path.indexOf(next);
        const cycle = path.slice(cycleStart).concat(next);
        violations.push({
          type: 'SUPERSEDES_CYCLE',
          entityId: next,
          message: `SUPERSEDES cycle detected: ${cycle.join(' → ')}`,
          details: { cycle },
        });
        // 재귀 코드와 동일 — 다음 neighbor 로 진행 (frame.index 이미 증가)
      } else if (!visited.has(next)) {
        // 새 노드 entering — 재귀 dfs(next) 호출 동치
        visited.add(next);
        inStack.add(next);
        path.push(next);
        stack.push({ node: next, neighbors: adj.get(next) ?? [], index: 0 });
      }
      // visited && !inStack — 이미 다른 경로에서 처리 완료, skip (재귀 코드 line 168)
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
 *
 * @throws {SupersedeChainTooDeepError} `findSupersedeCycles` 가 chain 깊이 한계
 *   `MAX_SUPERSEDE_CHAIN_DEPTH` 초과 시 throw. caller 는 try/catch 로 감싸서
 *   `recovery_failed` / `passed: false, actual: 'CHAIN_TOO_DEEP'` 등 graceful
 *   degradation 처리 의무 (Sprint 1 §5.1 4-Pass CRITICAL-1 흡수, 2026-05-01).
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
