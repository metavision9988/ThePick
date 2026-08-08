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
  findLineageAnomalies,
  findWalkUnreachableNodes,
  computeSourceQuoteCoverage,
  fromD1Rows,
  type D1EdgeRow,
  type D1NodeRow,
} from '../production-audit';

const WHITELIST = ['DEPENDS_ON', 'USES_FORMULA'] as const;

/** 계보 불변식 기준일 — 고정값(순수 함수 = 결정적, 시계 미의존). */
const TODAY = '2026-08-07';

function nodeRow(id: string, active = 1, name = id): D1NodeRow {
  return {
    id,
    type: 'CONCEPT',
    name,
    is_current_active: active,
    effective_status: 'draft',
    valid_from: null,
    valid_until: null,
  };
}

/** 서빙 중(approved + active + 창 안) 노드. */
function servedRow(
  id: string,
  extra: Partial<Pick<D1NodeRow, 'valid_from' | 'valid_until' | 'is_current_active'>> = {},
): D1NodeRow {
  return { ...nodeRow(id), effective_status: 'approved', ...extra };
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
      { todayKst: TODAY },
    );
    expect(report.integrity.valid).toBe(true);
    expect(report.staleEdgeRefs).toEqual([]);
    expect(report.lineage.measured).toBe(true);
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
      { todayKst: TODAY },
    );
    expect(report.staleEdgeRefs).toHaveLength(1);
    expect(report.gatePass).toBe(false);
  });

  it('끊긴 엣지(부재 노드) → integrity.valid=false → gatePass=false', () => {
    const report = auditProductionGraph(
      [nodeRow('A'), nodeRow('B')],
      [edgeRow('E-1', 'A', 'B'), edgeRow('E-2', 'A', 'GHOST')],
      WHITELIST,
      { todayKst: TODAY },
    );
    expect(report.integrity.valid).toBe(false);
    expect(report.gatePass).toBe(false);
  });

  it('★기준일 미주입 = 계보 미측정 → gatePass=false (판정 불가를 통과로 바꾸지 않는다)', () => {
    const report = auditProductionGraph(
      [nodeRow('A'), nodeRow('B')],
      [edgeRow('E-1', 'A', 'B')],
      WHITELIST,
    );
    expect(report.integrity.valid).toBe(true);
    expect(report.lineage.measured).toBe(false);
    expect(report.gatePass).toBe(false);
  });

  it('계보 이상 존재 시 gatePass=false', () => {
    const report = auditProductionGraph(
      [servedRow('NEW'), servedRow('OLD')],
      [edgeRow('E-SUP', 'NEW', 'OLD', 'SUPERSEDES')],
      WHITELIST,
      { todayKst: TODAY },
    );
    expect(report.lineage.measured && report.lineage.anomalies).toHaveLength(1);
    expect(report.gatePass).toBe(false);
  });
});

describe('findLineageAnomalies — 계보 정합 (결정 #9 (C) §3-4 / §2-(D))', () => {
  const SUP = (id: string, from: string, to: string, active = 1): D1EdgeRow =>
    edgeRow(id, from, to, 'SUPERSEDES', active);

  it('LINEAGE_DUAL_ACTIVE — 구·신 동시 서빙 검출', () => {
    const r = findLineageAnomalies(
      [servedRow('NEW'), servedRow('OLD')],
      [SUP('E-1', 'NEW', 'OLD')],
      TODAY,
    );
    expect(r.measured).toBe(true);
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_DUAL_ACTIVE']);
    expect(r.anomalies[0]).toMatchObject({ newNodeId: 'NEW', oldNodeId: 'OLD', edgeId: 'E-1' });
  });

  it('★LINEAGE_GAP — 구본 은퇴 + 신본 미발효 = blackout (0045 가 막는 바로 그 상태)', () => {
    const r = findLineageAnomalies(
      [servedRow('NEW', { valid_from: '2026-09-01' }), servedRow('OLD', { is_current_active: 0 })],
      [SUP('E-1', 'NEW', 'OLD')],
      TODAY,
    );
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_GAP']);
    expect(r.anomalies[0]!.detail).toContain('2026-09-01');
  });

  it('LINEAGE_GAP — 신본 강등(flagged)으로 인한 공백도 잡는다 (0042 §10 후속 원장 ②)', () => {
    const r = findLineageAnomalies(
      [
        { ...servedRow('NEW'), effective_status: 'flagged' },
        servedRow('OLD', { is_current_active: 0 }),
      ],
      [SUP('E-1', 'NEW', 'OLD')],
      TODAY,
    );
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_GAP']);
  });

  it('LINEAGE_GAP — 신본 만료(valid_until 도래)도 잡는다 (트리거가 원리상 못 잡는 시각 경과형)', () => {
    const r = findLineageAnomalies(
      [servedRow('NEW', { valid_until: '2026-08-01' }), servedRow('OLD', { is_current_active: 0 })],
      [SUP('E-1', 'NEW', 'OLD')],
      TODAY,
    );
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_GAP']);
  });

  it('정상 승계(신본만 서빙 · 구본 은퇴) = 이상 0', () => {
    const r = findLineageAnomalies(
      [servedRow('NEW'), servedRow('OLD', { is_current_active: 0 })],
      [SUP('E-1', 'NEW', 'OLD')],
      TODAY,
    );
    expect(r.anomalies).toEqual([]);
  });

  it('개정 준비 상태(둘 다 draft · 구본 미은퇴) = 이상 0 (노이즈 차단)', () => {
    const r = findLineageAnomalies(
      [nodeRow('NEW'), nodeRow('OLD')],
      [SUP('E-1', 'NEW', 'OLD')],
      TODAY,
    );
    expect(r.anomalies).toEqual([]);
  });

  it('draft 신본 + 서빙 중 구본 = 이상 0 (0042 [1] 이 발화하지 않는 정상 대기 상태)', () => {
    const r = findLineageAnomalies(
      [nodeRow('NEW'), servedRow('OLD')],
      [SUP('E-1', 'NEW', 'OLD')],
      TODAY,
    );
    expect(r.anomalies).toEqual([]);
  });

  it('비활성 SUPERSEDES 엣지·비 SUPERSEDES 엣지는 범위 밖', () => {
    expect(
      findLineageAnomalies([servedRow('N'), servedRow('O')], [SUP('E-1', 'N', 'O', 0)], TODAY)
        .anomalies,
    ).toEqual([]);
    expect(
      findLineageAnomalies(
        [servedRow('N'), servedRow('O')],
        [edgeRow('E-1', 'N', 'O', 'DEPENDS_ON')],
        TODAY,
      ).anomalies,
    ).toEqual([]);
  });

  it('부재 노드 참조는 건너뛴다 (findBrokenEdges 소관 — 중복 보고 금지)', () => {
    const r = findLineageAnomalies([servedRow('N')], [SUP('E-1', 'N', 'GHOST')], TODAY);
    expect(r.anomalies).toEqual([]);
  });

  it('★effective_status 컬럼 부재 = measured:false (가짜 PASS 금지)', () => {
    const bare: D1NodeRow = { id: 'N', type: 'CONCEPT', name: 'N', is_current_active: 1 };
    const r = findLineageAnomalies([bare], [SUP('E-1', 'N', 'N')], TODAY);
    expect(r.measured).toBe(false);
    expect(r.measured === false && r.reason).toContain('effective_status');
  });

  it('★해석 불가한 시행일 = 미서빙으로 계산 (fail-closed — 서빙 SQL 과 동일 방향)', () => {
    const r = findLineageAnomalies(
      [servedRow('NEW', { valid_from: '언젠가' }), servedRow('OLD', { is_current_active: 0 })],
      [SUP('E-1', 'NEW', 'OLD')],
      TODAY,
    );
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_GAP']);
  });

  it('창 경계 = 반개구간 [from, until) — 서빙 코어 규약 미러', () => {
    // valid_from = 오늘 → 서빙 / valid_until = 오늘 → 미서빙
    const startsToday = findLineageAnomalies(
      [servedRow('NEW', { valid_from: TODAY }), servedRow('OLD')],
      [SUP('E-1', 'NEW', 'OLD')],
      TODAY,
    );
    expect(startsToday.anomalies.map((a) => a.type)).toEqual(['LINEAGE_DUAL_ACTIVE']);

    const endsToday = findLineageAnomalies(
      [servedRow('NEW', { valid_until: TODAY }), servedRow('OLD', { is_current_active: 0 })],
      [SUP('E-1', 'NEW', 'OLD')],
      TODAY,
    );
    expect(endsToday.anomalies.map((a) => a.type)).toEqual(['LINEAGE_GAP']);
  });
});

/**
 * 2026-08-07 5-페르소나 독립 리뷰 처분 — 판정축 교정 회귀 고정.
 * 아래 4종은 **초판이 전부 놓쳤거나 잘못 보고하던** 케이스다(3개 렌즈 독립 수렴 + 실측 재현).
 * 보고서: .claude/reviews/review-20260807-5persona-0045.md
 */
describe('findLineageAnomalies — 리뷰 처분: 판정축 교정 (과소보고·과대보고 양쪽)', () => {
  const SUP = (id: string, from: string, to: string, active = 1): D1EdgeRow =>
    edgeRow(id, from, to, 'SUPERSEDES', active);

  it('★과소보고 해소 — 후속본 없이 만료(엣지 0건) = LINEAGE_LAPSE', () => {
    // 0045/0046 헤더가 "트리거로 원리상 불가 → 계보 불변식에 위임" 이라 지목한 바로 그 부류.
    // 초판은 엣지 루프뿐이라 이 노드를 한 번도 쳐다보지 않았다(구조적 사각지대).
    const r = findLineageAnomalies([servedRow('LAW-1', { valid_until: '2026-08-01' })], [], TODAY);
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_LAPSE']);
    expect(r.anomalies[0]!.detail).toContain('2026-08-01');
  });

  it('★과소보고 해소 — 구본이 active=1 인 채 만료 + 신본 미발효 = 계보 공백', () => {
    // 시각 경과형에서는 구본을 은퇴시킬 이벤트가 없어 is_current_active 가 1로 남는다.
    // 초판 조건(`is_current_active !== 1`)은 그래서 영영 참이 되지 않았다.
    const r = findLineageAnomalies(
      [
        servedRow('NEW', { valid_from: '2026-09-01' }),
        servedRow('OLD', { valid_until: '2026-08-01' }),
      ],
      [SUP('E-1', 'NEW', 'OLD')],
      TODAY,
    );
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_GAP']);
  });

  it('★과대보고 해소 — 다중홉 체인(A sup B sup C)에서 A 가 서빙 중이면 이상 0', () => {
    // 0042 헤더가 명시 지원하는 체인. 초판은 엣지 국소 판정이라 E-BC 를 공백으로 오탐했고,
    // gatePass 가 anomalies 0 을 요구하므로 **두 번째 개정이 생기는 순간 영구 FAIL** 이었다.
    const r = findLineageAnomalies(
      [
        servedRow('A'),
        servedRow('B', { is_current_active: 0 }),
        servedRow('C', { is_current_active: 0 }),
      ],
      [SUP('E-AB', 'A', 'B'), SUP('E-BC', 'B', 'C')],
      TODAY,
    );
    expect(r.anomalies).toEqual([]);
  });

  it('과대보고 해소 후에도 체인 전체가 사라지면 1건으로 보고한다 (억제가 아니라 수렴)', () => {
    const r = findLineageAnomalies(
      [
        servedRow('A', { valid_from: '2026-09-01' }),
        servedRow('B', { is_current_active: 0 }),
        servedRow('C', { is_current_active: 0 }),
      ],
      [SUP('E-AB', 'A', 'B'), SUP('E-BC', 'B', 'C')],
      TODAY,
    );
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_GAP']);
    expect(r.anomalies.map((a) => (a.type === 'LINEAGE_LAPSE' ? a.nodeId : a.edgeId))).toEqual([
      'E-AB',
    ]);
  });

  it('★빈 문자열 valid_from = 미서빙 (서빙 SQL 과 같은 방향 — 초판만 반대였다)', () => {
    // 서빙 SQL: `IS NULL` 거짓 + date('') = NULL → 행 배제. 초판 관측기만 "무제한"으로 봤다.
    const r = findLineageAnomalies([servedRow('LAW-2', { valid_from: '' })], [], TODAY);
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_LAPSE']);
  });

  it('해석 불가 날짜는 엣지가 없어도 단독 보고된다 (DUAL 방향 과소보고의 안전망)', () => {
    // SQLite date() 는 '2026-02-30' 을 3/2 로 정규화하지만 관측기는 거부한다 → DUAL 을 놓칠 수 있다.
    // 그 누락이 조용히 사라지지 않도록 LAPSE 로 표면화한다.
    const r = findLineageAnomalies([servedRow('LAW-3', { valid_from: '2026-02-30' })], [], TODAY);
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_LAPSE']);
  });

  it('무회귀 — 정상 서빙 노드만 있으면 이상 0 (현 production 전량 valid_* NULL)', () => {
    const r = findLineageAnomalies(
      [servedRow('LAW-4'), servedRow('LAW-5'), nodeRow('DRAFT-1')],
      [],
      TODAY,
    );
    expect(r.anomalies).toEqual([]);
  });
});

/**
 * 2026-08-07 **2라운드** 독립 검증 처분 — 1R 처분(터미널 승계자 규칙)이 만든 결함 고정.
 * 판정 단위를 엣지 → **약연결 성분**으로 올린 뒤에도 아래가 전부 성립해야 한다.
 * 보고서: .claude/reviews/review-20260807-5persona-0045.md §2R
 */
describe('findLineageAnomalies — 2R 처분: 성분 단위 판정', () => {
  const SUP = (id: string, from: string, to: string, active = 1): D1EdgeRow =>
    edgeRow(id, from, to, 'SUPERSEDES', active);

  it('★CRITICAL 회귀 — 체인 중간이 approved 가 아니어도 공백을 보고한다 (위임 증발 차단)', () => {
    // 1R 의 터미널 규칙은 상류를 하류에 위임했는데, 하류가 자기 조건(구본 approved)에 걸리지 않으면
    // 위임을 거절해 **공백이 통째로 증발**했다. 실제 시퀀스: OLD 승격 → NEW 승격(구본 은퇴) →
    // NEW 강등(flagged) → 운영자가 복구용 FIX(draft) 준비. 그 순간 알람이 꺼졌다.
    const r = findLineageAnomalies(
      [
        { ...servedRow('LAW-FIX'), effective_status: 'draft' },
        { ...servedRow('LAW-NEW'), effective_status: 'flagged' },
        servedRow('LAW-OLD', { is_current_active: 0 }),
      ],
      [SUP('E-FIX-NEW', 'LAW-FIX', 'LAW-NEW'), SUP('E-NEW-OLD', 'LAW-NEW', 'LAW-OLD')],
      TODAY,
    );
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_GAP']);
    // 대표 엣지는 결정적(id 최소)이고 detail 이 성분 전원의 상태를 담는다
    expect(r.anomalies[0]!.detail).toContain('LAW-OLD');
    expect(r.anomalies[0]!.detail).toContain('LAW-FIX');
  });

  it('★draft 사슬만으로도 공백이 보고된다 (A-1/A-5 클래스)', () => {
    const r = findLineageAnomalies(
      [
        { ...servedRow('D2'), effective_status: 'draft' },
        { ...servedRow('D1'), effective_status: 'draft' },
        servedRow('OLD', { is_current_active: 0 }),
      ],
      [SUP('E-D2-D1', 'D2', 'D1'), SUP('E-D1-OLD', 'D1', 'OLD')],
      TODAY,
    );
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_GAP']);
  });

  it('★분기 승계 오탐 0 — 형제 가지가 죽어도 주제가 살아 있으면 공백 아님', () => {
    // A(서빙) sup B ; C(draft 개정 준비) sup B — 1R 규칙은 E-CB 를 공백으로 오탐해 게이트를 FAIL 시켰다.
    const r = findLineageAnomalies(
      [
        servedRow('A'),
        servedRow('B', { is_current_active: 0 }),
        { ...servedRow('C'), effective_status: 'draft' },
      ],
      [SUP('E-AB', 'A', 'B'), SUP('E-CB', 'C', 'B')],
      TODAY,
    );
    expect(r.anomalies).toEqual([]);
  });

  it('분기에서 형제가 approved+미발효면 GAP 은 없고 LAPSE 만 (0045 가 막는 상태의 잔재 표면화)', () => {
    // 주제는 A 로 살아 있으므로 **계보 공백은 아니다**. 그러나 C 는 "승인+미시행" 이라
    // 0045 [A]/0046 [C-2] 가 애초에 만들지 못하게 하는 상태이며, 선재 잔재라면 드러나야 한다.
    const r = findLineageAnomalies(
      [
        servedRow('A'),
        servedRow('B', { is_current_active: 0 }),
        servedRow('C', { valid_from: '2026-09-01' }),
      ],
      [SUP('E-AB', 'A', 'B'), SUP('E-CB', 'C', 'B')],
      TODAY,
    );
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_LAPSE']);
    expect(r.anomalies.map((a) => (a.type === 'LINEAGE_LAPSE' ? a.nodeId : a.edgeId))).toEqual([
      'C',
    ]);
  });

  it('★병합 승계 = 사건당 1건으로 수렴 (구본 3개를 한 신본이 승계)', () => {
    const r = findLineageAnomalies(
      [
        servedRow('M', { valid_from: '2026-09-01' }),
        servedRow('O1', { is_current_active: 0 }),
        servedRow('O2', { is_current_active: 0 }),
        servedRow('O3', { is_current_active: 0 }),
      ],
      [SUP('E-1', 'M', 'O1'), SUP('E-2', 'M', 'O2'), SUP('E-3', 'M', 'O3')],
      TODAY,
    );
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_GAP']);
    expect(r.anomalies[0]!.type === 'LINEAGE_GAP' && r.anomalies[0].edgeId).toBe('E-1');
  });

  it('★순환 계보도 침묵하지 않는다 (A sup B, B sup A 둘 다 은퇴)', () => {
    const r = findLineageAnomalies(
      [servedRow('A', { is_current_active: 0 }), servedRow('B', { is_current_active: 0 })],
      [SUP('E-AB', 'A', 'B'), SUP('E-BA', 'B', 'A')],
      TODAY,
    );
    expect(r.anomalies.map((a) => a.type)).toEqual(['LINEAGE_GAP']);
  });

  it('★fail-open 차단 — 앞 공백·뒤 오염 날짜는 서빙 SQL 과 같이 "미서빙" 으로 본다', () => {
    // SQLite: date(' 2026-08-07') = NULL, date('2026-08-07x') = NULL → 서빙 제외.
    // 1R 의 trim()+slice(0,10) 은 둘 다 통과시켜 관측기만 "서빙 중"으로 봤다(= 무증상).
    const lead = findLineageAnomalies([servedRow('L-1', { valid_from: ` ${TODAY}` })], [], TODAY);
    expect(lead.anomalies.map((a) => a.type)).toEqual(['LINEAGE_LAPSE']);
    const trail = findLineageAnomalies([servedRow('L-2', { valid_from: `${TODAY}x` })], [], TODAY);
    expect(trail.anomalies.map((a) => a.type)).toEqual(['LINEAGE_LAPSE']);
    // ISO datetime 은 종전대로 허용 (서빙 SQL 의 date() 정규화와 동일)
    const iso = findLineageAnomalies(
      [servedRow('L-3', { valid_from: `${TODAY}T00:00:00Z` })],
      [],
      TODAY,
    );
    expect(iso.anomalies).toEqual([]);
  });

  it('무회귀 — 다중홉 체인에서 상류가 서빙 중이면 여전히 이상 0', () => {
    const r = findLineageAnomalies(
      [
        servedRow('A'),
        servedRow('B', { is_current_active: 0 }),
        servedRow('C', { is_current_active: 0 }),
      ],
      [SUP('E-AB', 'A', 'B'), SUP('E-BC', 'B', 'C')],
      TODAY,
    );
    expect(r.anomalies).toEqual([]);
  });
});

/**
 * STAGE 2 · 2-5 — 원문 인용 커버리지 (게이트 불산입 지표).
 * ★"일부만 검사하고 전부 검사한 것처럼 보이는 상태"가 이 프로젝트가 두 번 다친 클래스다.
 */
describe('computeSourceQuoteCoverage — 검사 가능 범위 표기', () => {
  it('서빙 중인 노드만 분모 — draft·은퇴·창밖은 제외', () => {
    const r = computeSourceQuoteCoverage(
      [
        { ...servedRow('A'), source_quote: '원문 A' },
        { ...servedRow('B'), source_quote: null },
        { ...nodeRow('DRAFT'), source_quote: null }, // draft = 분모 밖
        { ...servedRow('RETIRED', { is_current_active: 0 }), source_quote: null }, // 은퇴 = 분모 밖
        { ...servedRow('FUTURE', { valid_from: '2026-09-01' }), source_quote: null }, // 창밖 = 분모 밖
      ],
      TODAY,
    );
    expect(r).toEqual({ measured: true, servedTotal: 2, withQuote: 1, withoutQuote: 1 });
  });

  it('★공백만 채운 값은 보유로 세지 않는다 (0047 INSERT 게이트와 같은 판정)', () => {
    const r = computeSourceQuoteCoverage(
      [
        { ...servedRow('A'), source_quote: '' },
        { ...servedRow('B'), source_quote: '   ' },
        { ...servedRow('C'), source_quote: '\n\t' },
        { ...servedRow('D'), source_quote: '진짜 원문' },
      ],
      TODAY,
    );
    expect(r).toEqual({ measured: true, servedTotal: 4, withQuote: 1, withoutQuote: 3 });
  });

  it('★컬럼 부재 = measured:false (0047 미적용 DB 에서도 러너는 돌아야 한다)', () => {
    const r = computeSourceQuoteCoverage([servedRow('A')], TODAY);
    expect(r.measured).toBe(false);
  });

  it('커버리지는 게이트 판정에 불산입 — 0% 여도 gatePass 는 다른 조건만 본다', () => {
    const report = auditProductionGraph(
      [
        { ...servedRow('A'), source_quote: null },
        { ...servedRow('B'), source_quote: null },
      ],
      [edgeRow('E-1', 'A', 'B')],
      WHITELIST,
      { todayKst: TODAY },
    );
    expect(report.sourceQuoteCoverage).toEqual({
      measured: true,
      servedTotal: 2,
      withQuote: 0,
      withoutQuote: 2,
    });
    expect(report.gatePass).toBe(true); // 커버리지 0% 는 위반이 아니다 — 검사 범위 지표일 뿐
  });
});
