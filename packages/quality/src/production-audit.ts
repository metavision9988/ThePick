/**
 * @thepick/quality/production-audit — production 지식 그래프 누적 무결성 감사 코어.
 *
 * 근거: design-audit RC-1 (2026-06-10) — "검증 기계는 로컬 전용, production
 * 794노드/1274엣지는 한 번도 기계 검증 안 됨" + 확장 게이트 E0-2 (결재 #16).
 * 마스터 플랜 WS-2a: validateGraphIntegrity(순수 DI)에 production D1 read-only
 * 덤프를 입력으로 먹이는 경로. 본 모듈은 **순수 코어** (IO 무의존, Workers-safe)
 * — D1 덤프 읽기/리포트 쓰기는 scripts/run-graph-integrity-production.ts 가 담당.
 *
 * 기존 validateGraphIntegrity(고아/끊긴엣지/SUPERSEDES 순환/ID 중복)에 RC-1 이
 * 식별한 미커버 2종을 추가한다:
 *   ① 활성 엣지 → 비활성 노드 참조 (findBrokenEdges 는 "부재 노드"만 검출 —
 *      0013 자동 비활성 트리거와 결합 시 활성 엣지가 유령 참조로 남는 기전)
 *   ② 항해성(navigability): whitelist 활성 엣지 기준 in-degree 0 인 활성 노드
 *      — graph-walk 는 forward-only(from→to) 순회이므로 to 로 등장하지 않는
 *      노드는 시드로 직접 잡히지 않는 한 graph 확장이 영구 도달 불가
 *      (CONCEPT-023 클래스, 기보고 데이터 천장 — navigability-gate-absent).
 *
 * Hard Rule 15 정합: whitelist 는 본 모듈이 소유하지 않는다 (도메인/검색 정책
 * 지식) — 호출 측(scripts)이 graph-walk 단일 진실원에서 주입.
 */

import type { NodeType, EdgeType } from '@thepick/shared';
import {
  validateGraphIntegrity,
  type GraphNode,
  type GraphEdge,
  type IntegrityReport,
} from './graph-integrity';

// --- D1 row 형태 (wrangler d1 execute --json 출력의 results[] 항목) ---

/** knowledge_nodes SELECT row — 감사에 필요한 최소 컬럼만 (read-only 추출). */
export interface D1NodeRow {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  /** migrations/0013 — superseded 시 트리거가 0 으로 자동 폐기. */
  readonly is_current_active: number;
}

/** knowledge_edges SELECT row. */
export interface D1EdgeRow {
  readonly id: string;
  readonly from_node: string;
  readonly to_node: string;
  readonly edge_type: string;
  readonly is_active: number;
}

/**
 * D1 row → quality 코어 타입 변환.
 *
 * type/edge_type 은 string 으로 도착(raw SQL) — 코어 검증(validateGraphIntegrity)
 * 은 ID 패턴·연결성만 보므로 캐스트로 충분하며, 타입 어휘 검증은 schema-validator
 * (ontology-registry 위임) 소관이라 여기서 중복하지 않는다.
 */
export function fromD1Rows(
  nodeRows: readonly D1NodeRow[],
  edgeRows: readonly D1EdgeRow[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = nodeRows.map((r) => ({
    id: r.id,
    type: r.type as NodeType,
    name: r.name,
    isActive: r.is_current_active === 1,
  }));
  const edges = edgeRows.map((r) => ({
    id: r.id,
    fromNode: r.from_node,
    toNode: r.to_node,
    edgeType: r.edge_type as EdgeType,
    isActive: r.is_active === 1,
  }));
  return { nodes, edges };
}

// --- 추가 검사 ① 활성 엣지 → 비활성 노드 ---

export interface StaleEdgeRef {
  readonly edgeId: string;
  /** triage 용 — 리뷰 CRITICAL-1 추적이 ID 패턴 추정에 의존했던 결손 해소. */
  readonly edgeType: string;
  readonly side: 'from' | 'to';
  readonly nodeId: string;
}

/**
 * 활성 **의미 관계** 엣지가 비활성(superseded) 노드를 참조하는 지점 전수.
 * findBrokenEdges(부재 노드)와 상보 — 둘 다 0 이어야 활성 그래프가 닫힌 집합.
 *
 * ★ SUPERSEDES 엣지 제외 (리뷰 CRITICAL-1, 2026-06-11): "활성 SUPERSEDES 엣지 →
 *   비활성 to_node" 는 위반이 아니라 Temporal Graph 의 설계된 steady-state 다 —
 *   migrations/0013:102-109 트리거가 SUPERSEDES INSERT 시 to_node 를
 *   is_current_active=0 으로 자동 폐기하므로 개정 1건당 1개씩 필연 발생
 *   (Hard Limit "개정 = 신규 노드 + SUPERSEDES 엣지"). 이를 산입하면 Hard Limit
 *   준수 그래프에서 게이트가 영구 통과 불능 + 시계열 기록이 "수리 대상"으로
 *   오도된다. SUPERSEDES 의 계보 정합(순환)은 findSupersedeCycles 가 별도 담당.
 */
export function findActiveEdgesToInactiveNodes(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): StaleEdgeRef[] {
  const inactiveIds = new Set(nodes.filter((n) => n.isActive === false).map((n) => n.id));
  const refs: StaleEdgeRef[] = [];
  for (const edge of edges) {
    if (edge.isActive === false) continue;
    if (edge.edgeType === 'SUPERSEDES') continue; // 설계된 시계열 기록 (위 주석)
    if (inactiveIds.has(edge.fromNode)) {
      refs.push({ edgeId: edge.id, edgeType: edge.edgeType, side: 'from', nodeId: edge.fromNode });
    }
    if (inactiveIds.has(edge.toNode)) {
      refs.push({ edgeId: edge.id, edgeType: edge.edgeType, side: 'to', nodeId: edge.toNode });
    }
  }
  return refs;
}

// --- 추가 검사 ② 항해성 (graph-walk 도달성) ---

export interface UnreachableNode {
  readonly nodeId: string;
  readonly name: string;
  /** whitelist 활성 엣지에서 to 로 등장한 횟수 (0 = forward-walk 도달 불가). */
  readonly inDegree: number;
  /** whitelist 활성 엣지에서 from 으로 등장한 횟수. */
  readonly outDegree: number;
}

/**
 * forward-only graph-walk 기준 도달 불가 활성 노드 전수.
 *
 * 판정: whitelist 활성 엣지 중 **from 노드가 활성인 것**(유효 경로) 기준
 * in-degree 0 인 활성 노드 — 시드로 직접 회수되지 않는 한 어떤 확장 경로로도
 * 도달 불가. from 이 비활성(superseded) 노드인 엣지는 walk 가 그 노드를 시드로도
 * 확장으로도 못 잡으므로 도달 기여 0 (2026-06-11 production 1차 실측 정정 —
 * INS-12(비활성)→CONCEPT-023 엣지가 in-degree 를 허수로 채우던 결함).
 * out-degree 동봉으로 "고립(0/0)" vs "출발 전용(0/N)" 구분.
 *
 * ★ 술어 한계 (리뷰 MAJOR-1, 2026-06-11): 본 판정의 "활성" = is_current_active
 *   만이며, 실제 graph-walk 자격은 active **AND** status=approved
 *   (approved-nodes-sql.ts — production 활성 783 vs approved ~488). 즉 본 리스트는
 *   **하한(전부 진양성)** 이고, 보완집합("도달 가능")은 approved 차원 미검증 단정이
 *   된다. status_transitions 도출을 덤프에 추가하는 walk-eligible 정밀화는 후속
 *   (D1NodeRow 확장 + 덤프 SQL JOIN — E0-4 골든 확대와 동시 검토).
 */
export function findWalkUnreachableNodes(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  edgeTypeWhitelist: ReadonlyArray<string>,
): UnreachableNode[] {
  const allowed = new Set(edgeTypeWhitelist);
  const activeNodeIds = new Set(nodes.filter((n) => n.isActive !== false).map((n) => n.id));
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  for (const edge of edges) {
    if (edge.isActive === false) continue;
    if (!allowed.has(edge.edgeType)) continue;
    // 유효 경로 = from 노드 활성 (비활성 발 엣지는 walk 도달 기여 0)
    if (!activeNodeIds.has(edge.fromNode)) continue;
    outDeg.set(edge.fromNode, (outDeg.get(edge.fromNode) ?? 0) + 1);
    inDeg.set(edge.toNode, (inDeg.get(edge.toNode) ?? 0) + 1);
  }
  const result: UnreachableNode[] = [];
  for (const node of nodes) {
    if (node.isActive === false) continue;
    const inDegree = inDeg.get(node.id) ?? 0;
    if (inDegree === 0) {
      result.push({
        nodeId: node.id,
        name: node.name,
        inDegree,
        outDegree: outDeg.get(node.id) ?? 0,
      });
    }
  }
  return result;
}

// --- 종합 ---

export interface ProductionAuditReport {
  readonly integrity: IntegrityReport;
  readonly staleEdgeRefs: readonly StaleEdgeRef[];
  /** whitelist 기준 forward-walk 도달 불가 활성 노드 (정보 지표 — 위반 아님). */
  readonly walkUnreachable: readonly UnreachableNode[];
  /**
   * 게이트 판정 — integrity.valid AND staleEdgeRefs 0.
   * walkUnreachable 은 게이트 불산입: 도달 불가 = 엣지 밀도(데이터 천장) 신호로
   * BATCH 보강 대상이지 무결성 위반이 아니다 (기보고 CONCEPT-023 = 정상 적재 노드).
   */
  readonly gatePass: boolean;
}

export function auditProductionGraph(
  nodeRows: readonly D1NodeRow[],
  edgeRows: readonly D1EdgeRow[],
  edgeTypeWhitelist: ReadonlyArray<string>,
): ProductionAuditReport {
  const { nodes, edges } = fromD1Rows(nodeRows, edgeRows);
  const integrity = validateGraphIntegrity(nodes, edges);
  const staleEdgeRefs = findActiveEdgesToInactiveNodes(nodes, edges);
  const walkUnreachable = findWalkUnreachableNodes(nodes, edges, edgeTypeWhitelist);
  return {
    integrity,
    staleEdgeRefs,
    walkUnreachable,
    gatePass: integrity.valid && staleEdgeRefs.length === 0,
  };
}
