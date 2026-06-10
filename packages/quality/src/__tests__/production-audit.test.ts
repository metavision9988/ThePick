/**
 * production-audit 코어 검증 — design-audit WS-2a (E0-2 게이트의 채점기).
 *
 * 합성 픽스처 4종(정상/stale 참조/도달불가/고립) + D1 row 변환 + 게이트 판정.
 * CONCEPT-023 "기지 양성"은 production 덤프에서만 확인 가능 — 본 테스트는
 * 그 검출 술어(in-degree 0)가 합성 그래프에서 정확함을 고정한다.
 */

import { describe, expect, it } from 'vitest';
import {
  auditProductionGraph,
  findActiveEdgesToInactiveNodes,
  findWalkUnreachableNodes,
  fromD1Rows,
  type D1EdgeRow,
  type D1NodeRow,
} from '../production-audit';

const WHITELIST = ['DEPENDS_ON', 'USES_FORMULA'] as const;

function nodeRow(id: string, active = 1, name = id): D1NodeRow {
  return { id, type: 'CONCEPT', name, is_current_active: active };
}
function edgeRow(
  id: string,
  from: string,
  to: string,
  type: string = 'DEPENDS_ON',
  active = 1,
): D1EdgeRow {
  return { id, from_node: from, to_node: to, edge_type: type, is_active: active };
}

describe('fromD1Rows — D1 row 변환', () => {
  it('is_current_active/is_active 1↔0 을 isActive boolean 으로', () => {
    const { nodes, edges } = fromD1Rows(
      [nodeRow('CONCEPT-001', 1), nodeRow('CONCEPT-002', 0)],
      [edgeRow('E-1', 'CONCEPT-001', 'CONCEPT-002', 'DEPENDS_ON', 0)],
    );
    expect(nodes[0]!.isActive).toBe(true);
    expect(nodes[1]!.isActive).toBe(false);
    expect(edges[0]!.isActive).toBe(false);
  });
});

describe('findActiveEdgesToInactiveNodes — 활성 엣지 → 비활성 노드 (RC-1 미커버 ①)', () => {
  it('활성 엣지가 superseded(비활성) 노드를 참조하면 검출 (from/to 양측)', () => {
    const { nodes, edges } = fromD1Rows(
      [nodeRow('A'), nodeRow('B', 0), nodeRow('C', 0)],
      [edgeRow('E-1', 'A', 'B'), edgeRow('E-2', 'C', 'A')],
    );
    const refs = findActiveEdgesToInactiveNodes(nodes, edges);
    expect(refs).toEqual([
      { edgeId: 'E-1', edgeType: 'DEPENDS_ON', side: 'to', nodeId: 'B' },
      { edgeId: 'E-2', edgeType: 'DEPENDS_ON', side: 'from', nodeId: 'C' },
    ]);
  });

  it('비활성 엣지의 비활성 노드 참조는 무위반', () => {
    const { nodes, edges } = fromD1Rows(
      [nodeRow('A'), nodeRow('B', 0)],
      [edgeRow('E-1', 'A', 'B', 'DEPENDS_ON', 0)],
    );
    expect(findActiveEdgesToInactiveNodes(nodes, edges)).toEqual([]);
  });

  it('★ 활성 SUPERSEDES 엣지 → 비활성 to_node = 무위반 (리뷰 CRITICAL-1 — 0013 트리거의 설계된 steady-state)', () => {
    // 개정: NEW 가 OLD 를 supersede → 0013 트리거가 OLD 를 비활성화, SUPERSEDES 엣지는 활성 잔존.
    const { nodes, edges } = fromD1Rows(
      [nodeRow('NEW'), nodeRow('OLD', 0), nodeRow('PEER')],
      [
        edgeRow('E-SUP', 'NEW', 'OLD', 'SUPERSEDES'), // 정상 시계열 — 위반 아님
        edgeRow('E-SEM', 'PEER', 'OLD', 'DEPENDS_ON'), // 의미 엣지의 비활성 참조 — 진짜 유령
        edgeRow('E-KEEP', 'NEW', 'PEER'), // NEW·PEER 연결 유지 (고아 회피)
      ],
    );
    const refs = findActiveEdgesToInactiveNodes(nodes, edges);
    expect(refs).toEqual([{ edgeId: 'E-SEM', edgeType: 'DEPENDS_ON', side: 'to', nodeId: 'OLD' }]);
  });
});

describe('findWalkUnreachableNodes — forward-walk 도달성 (RC-1 미커버 ② / CONCEPT-023 술어)', () => {
  it('whitelist 활성 엣지의 to 로 등장하지 않는 활성 노드 = 도달 불가', () => {
    // A → B → C 체인: A 는 in-degree 0 (출발 전용), B/C 는 도달 가능
    const { nodes, edges } = fromD1Rows(
      [nodeRow('A'), nodeRow('B'), nodeRow('C'), nodeRow('ISOLATED')],
      [edgeRow('E-1', 'A', 'B'), edgeRow('E-2', 'B', 'C')],
    );
    const un = findWalkUnreachableNodes(nodes, edges, WHITELIST);
    expect(un.map((u) => u.nodeId).sort()).toEqual(['A', 'ISOLATED']);
    const a = un.find((u) => u.nodeId === 'A')!;
    expect(a.outDegree).toBe(1); // A 발 whitelist 활성 엣지 = E-1 단건 (리뷰 P4-6 표기 정리)
    const iso = un.find((u) => u.nodeId === 'ISOLATED')!;
    expect(iso.inDegree).toBe(0);
    expect(iso.outDegree).toBe(0); // 고립 vs 출발 전용 구분
  });

  it('whitelist 밖 edge_type 의 inbound 는 도달성에 불산입 (SUPERSEDES 류)', () => {
    // X 의 유일한 inbound 가 whitelist 밖 → 여전히 도달 불가 (CONCEPT-023 기전)
    const { nodes, edges } = fromD1Rows(
      [nodeRow('SEED'), nodeRow('X')],
      [edgeRow('E-1', 'SEED', 'X', 'SUPERSEDES')],
    );
    const un = findWalkUnreachableNodes(nodes, edges, WHITELIST);
    expect(un.map((u) => u.nodeId)).toContain('X');
  });

  it('비활성 엣지·비활성 노드는 계산에서 제외', () => {
    const { nodes, edges } = fromD1Rows(
      [nodeRow('A'), nodeRow('B'), nodeRow('DEAD', 0)],
      [edgeRow('E-1', 'A', 'B', 'DEPENDS_ON', 0)], // 비활성 엣지 → B 도달성 기여 없음
    );
    const un = findWalkUnreachableNodes(nodes, edges, WHITELIST);
    expect(un.map((u) => u.nodeId).sort()).toEqual(['A', 'B']); // DEAD(비활성)는 미등재
  });

  it('비활성 from 노드 발 엣지는 유효 경로가 아님 (production 1차 실측 정정 — INS-12→CONCEPT-023 기전)', () => {
    // DEAD(비활성) → X 활성 엣지만 inbound 인 X = walk 도달 불가 (DEAD 는 시드·확장 불가)
    const { nodes, edges } = fromD1Rows(
      [nodeRow('DEAD', 0), nodeRow('X'), nodeRow('LIVE'), nodeRow('Y')],
      [
        edgeRow('E-1', 'DEAD', 'X'), // 활성 엣지지만 from 비활성 = 무효 경로
        edgeRow('E-2', 'LIVE', 'Y'), // 대조군: 유효 경로
      ],
    );
    const un = findWalkUnreachableNodes(nodes, edges, WHITELIST);
    expect(un.map((u) => u.nodeId)).toContain('X'); // 허수 in-degree 차단
    expect(un.map((u) => u.nodeId)).not.toContain('Y');
  });
});

describe('auditProductionGraph — 종합 게이트', () => {
  it('정상 그래프: gatePass=true, 도달불가는 정보 지표로만', () => {
    const report = auditProductionGraph(
      [nodeRow('A'), nodeRow('B')],
      [edgeRow('E-1', 'A', 'B')],
      WHITELIST,
    );
    expect(report.integrity.valid).toBe(true);
    expect(report.staleEdgeRefs).toEqual([]);
    expect(report.gatePass).toBe(true);
    // A 는 in-degree 0 이지만 게이트 불산입 (데이터 천장 신호)
    expect(report.walkUnreachable.map((u) => u.nodeId)).toEqual(['A']);
  });

  it('stale 참조 존재 시 gatePass=false (integrity.valid 여도)', () => {
    const report = auditProductionGraph(
      [nodeRow('A'), nodeRow('B', 0), nodeRow('C')],
      // A→B(비활성 참조) + A→C (A·C 연결 유지로 고아 회피)
      [edgeRow('E-1', 'A', 'B'), edgeRow('E-2', 'A', 'C')],
      WHITELIST,
    );
    expect(report.staleEdgeRefs).toHaveLength(1);
    expect(report.gatePass).toBe(false);
  });

  it('끊긴 엣지(부재 노드) → integrity.valid=false → gatePass=false', () => {
    const report = auditProductionGraph(
      [nodeRow('A'), nodeRow('B')],
      [edgeRow('E-1', 'A', 'B'), edgeRow('E-2', 'A', 'GHOST')],
      WHITELIST,
    );
    expect(report.integrity.valid).toBe(false);
    expect(report.gatePass).toBe(false);
  });
});
