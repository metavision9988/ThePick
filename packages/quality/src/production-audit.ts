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
  /**
   * 실 status — `status_transitions` 최신 레코드의 `to_status` (전이 무이력 = 'draft').
   * 덤프 SQL 이 JOIN 으로 주입한다 (`knowledge_nodes.status` 스냅샷은 신뢰하지 않는다 — 0018).
   * **부재하면 계보 불변식은 `measured:false`** — 가짜 PASS 를 만들지 않는다.
   */
  readonly effective_status?: string | null;
  /** migrations/0041 시행시점 축. 부재/NULL = 무제한. */
  readonly valid_from?: string | null;
  readonly valid_until?: string | null;
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

// --- 추가 검사 ③ 계보 정합 (시행시점 축 ↔ 승계) ---

/**
 * 계보 이상 2종 — 결정 카드 `decision-card-20260807-supersedes-effectivity.md` §3-4·§2-(D).
 *
 * ★ 왜 "관측"이 필요한가: (C) 정책의 기계 가드(마이그 0045)는 **이벤트 시점**만 막는다.
 *   `valid_until` 도래처럼 **시각 경과로 발생하는 실패는 어떤 트리거로도 못 잡는다**
 *   (SQLite 에 시간 기반 트리거 부재 — 카드 §0 이 (a)안을 기각한 바로 그 이유).
 *   그래서 사후 관측이 이 부류의 유일한 방어선이다.
 */
export type LineageAnomalyType =
  /** 구·신이 **동시에 서빙**된다 — 학습자가 무엇이 현행인지 알 수 없다. */
  | 'LINEAGE_DUAL_ACTIVE'
  /** 계보 전체가 서빙에서 사라졌다 — 그 주제가 화면에서 없어진 상태(blackout). */
  | 'LINEAGE_GAP'
  /**
   * 승인·활성인데 **오늘 서빙되지 않는** 노드 — 엣지와 무관한 단독 관측.
   *
   * ★이 불변식이 왜 따로 필요한가 (2026-08-07 독립 리뷰 CRITICAL 처분):
   *   0045/0046 헤더가 "트리거로 원리상 못 잡는 잔여 위험 = 시각 경과형(valid_until 도래로
   *   **후속본 없이** 만료)" 을 계보 불변식에 위임했는데, 초판 `LINEAGE_GAP` 은 **활성 SUPERSEDES
   *   엣지가 있는 계보만** 순회했다. 후속본이 없으면 엣지도 없으므로 루프가 그 노드를 한 번도
   *   쳐다보지 않았다 — 위임받은 바로 그 부류가 사각지대였다(3개 렌즈 독립 수렴, 실측 재현).
   *   본 불변식은 **노드 전수 스캔**이라 엣지 유무와 무관하게 그 상태를 잡는다.
   */
  | 'LINEAGE_LAPSE';

/** 엣지 계보(활성 SUPERSEDES) 범위의 이상. */
export interface LineageEdgeAnomaly {
  readonly type: 'LINEAGE_DUAL_ACTIVE' | 'LINEAGE_GAP';
  readonly edgeId: string;
  /** SUPERSEDES 엣지의 from = 승계자(신본). */
  readonly newNodeId: string;
  /** SUPERSEDES 엣지의 to = 피승계자(구본). */
  readonly oldNodeId: string;
  readonly detail: string;
}

/** 엣지와 무관한 단독 노드 이상 (시각 경과·미발효·해석 불가 날짜). */
export interface LineageNodeAnomaly {
  readonly type: 'LINEAGE_LAPSE';
  readonly nodeId: string;
  readonly detail: string;
}

export type LineageAnomaly = LineageEdgeAnomaly | LineageNodeAnomaly;

/** 리포트 표기용 — 엣지/노드 어느 쪽이든 "무엇에 대한 이상인지" 한 칸으로 뽑는다. */
export function lineageAnomalySubject(anomaly: LineageAnomaly): string {
  return anomaly.type === 'LINEAGE_LAPSE' ? anomaly.nodeId : anomaly.edgeId;
}

export type LineageAudit =
  | { readonly measured: false; readonly reason: string; readonly anomalies: readonly [] }
  | { readonly measured: true; readonly anomalies: readonly LineageAnomaly[] };

/** 'YYYY-MM-DD' 정규화. 해석 불가 = null (호출 측에서 fail-closed 로 소비). */
function normalizeDate(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  // ★리뷰 처분 3라운드 — 이 함수는 **fail-open 을 두 번 재도입했다**. 기록해 둔다:
  //   [1R] `trim()` + `slice(0,10)` → 앞 공백(' 2026-08-07')·뒤 오염('2026-08-07x')을 통과시킴
  //   [2R] tail 을 `(?:[T ].*)?` 로 열어 둠 → 구분자 뒤 **임의 문자열**을 통과시킴
  //        ('2026-08-15 시행', '...T99:99:99', '...+0900' 전부 SQLite 는 NULL = 미서빙)
  //        ★가장 나쁜 것: **정상 ISO 오프셋** '2026-08-08T00:00:00+09:00' 에서도 갈렸다 —
  //          SQLite 는 UTC 로 환산해 '2026-08-07' 로 보는데 관측기는 앞 10자만 읽어 하루 밀렸다.
  //   fail-open 이 위험한 이유: 서빙에서 사라진 행을 관측기가 "서빙 중"으로 보면
  //   GAP·LAPSE 둘 다 침묵하고 gatePass 가 초록이 된다(= 무증상 blackout).
  //
  // ⇒ 규칙: **SQLite date() 가 확실히 같은 답을 주는 형태만 받는다.** 나머지는 전부 null(=미서빙 판정,
  //   fail-closed). 관측기가 시끄러운 것은 안전하고, 조용한 것은 위험하다.
  //   · 'YYYY-MM-DD'                         → 그대로
  //   · 'YYYY-MM-DD' + [T|공백] + HH:MM[:SS[.f]] + 선택적 'Z'  → date() 가 앞 날짜를 그대로 돌려줌
  //   · **오프셋 표기(+09:00·+0900)는 거부** — SQLite 는 UTC 로 환산해 날짜가 바뀔 수 있다
  //   · 시각 범위(HH>23·MM>59·SS>59)도 거부 — SQLite 가 NULL 을 돌려주는 구간
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?Z?)?$/.exec(value);
  if (m === null) return null;
  const head = m[1]!;
  const [hh, mi, ss] = [m[2], m[3], m[4]];
  if (hh !== undefined) {
    if (Number(hh) > 23 || Number(mi) > 59) return null;
    if (ss !== undefined && Number(ss) > 59) return null;
  }
  // round-trip 검증 — '2026-13-45' 류 배제.
  const parsed = new Date(`${head}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== head ? null : head;
}

/**
 * "오늘 학습자에게 서빙되는가" — `APPROVED_NODES_STATUS_CORE` + `buildEffectivityWindowSql`
 * (apps/api/src/search/approved-nodes-sql.ts) 의 **TS 미러**.
 *   active=1 AND 실 status='approved' AND 반개구간 [valid_from, valid_until) 안.
 *
 * ★ 미러의 알려진 차이 (의도·기록 — 2026-08-07 리뷰로 문면 정정):
 *   SQLite `date()` 는 '2026-02-30'·'now' 를 **해석**하지만 본 관측기는 거부한다.
 *   ★단 "항상 더 엄격"이라고 쓰지 않는다 — 1R·2R 이 각각 그렇게 적었다가 실측으로 반증됐다.
 *   현 규약은 **"SQLite 와 같은 답이 확실한 형태만 수용, 나머지는 미서빙(fail-closed)"** 이다.
 *   초판 주석은 이를 "일관되게 과대보고 방향"이라고 적었으나 **사실이 아니다** —
 *   `LINEAGE_GAP` 방향으로는 과대보고지만 `LINEAGE_DUAL_ACTIVE` 방향으로는 **과소보고**다
 *   (SQL 은 서빙, 관측기는 미서빙 → 동시 서빙을 놓친다). 그 누락을 메우는 것이 `LINEAGE_LAPSE` 다:
 *   해석 불가 날짜를 가진 approved+active 행은 어느 방향이든 **단독 이상으로 보고**되므로
 *   조용히 사라지지 않는다.
 *
 * ★ 빈 문자열('')·앞뒤 오염 취급 (리뷰 MAJOR 처분): 초판은 `!== ''` + `trim()` 으로 관대했는데,
 *   서빙 SQL 은 `IS NULL` 이 거짓 + `date(...)` = NULL 이라 **행을 배제**한다(fail-closed).
 *   즉 초판만 반대 방향이었다 → `normalizeDate` 일원화로 SQL 과 같은 방향(배제)으로 맞춘다.
 */
function isServedToday(row: D1NodeRow, todayKst: string): boolean {
  if (row.is_current_active !== 1) return false;
  if ((row.effective_status ?? 'draft') !== 'approved') return false;

  // NULL/undefined = 컬럼 무제한. 그 외(빈 문자열 포함)는 전부 날짜로 해석해야 하며
  // 해석 불가 = fail-closed (서빙 SQL 과 동일 방향).
  if (row.valid_from !== null && row.valid_from !== undefined) {
    const from = normalizeDate(row.valid_from);
    if (from === null || !(from <= todayKst)) return false;
  }
  if (row.valid_until !== null && row.valid_until !== undefined) {
    const until = normalizeDate(row.valid_until);
    if (until === null || !(until > todayKst)) return false;
  }
  return true;
}

/**
 * 활성 SUPERSEDES 계보의 서빙 상태 이상 전수.
 *
 * 판정 대상 = **활성**(`is_active=1`) SUPERSEDES 엣지 — 0042 두 트리거의 발화 전제와 동일 범위.
 * 비활성 SUPERSEDES 엣지는 "철회된 승계 주장"이라 계보 클레임으로 보지 않는다(범위 밖·기록).
 *
 * - `LINEAGE_DUAL_ACTIVE` = 신·구 **둘 다 서빙** (엣지 국소 판정)
 * - `LINEAGE_GAP` = **활성 SUPERSEDES 성분** 전체가 서빙에서 사라짐 (성분 단위 판정)
 * - `LINEAGE_LAPSE` = (엣지 무관) 승인·활성인데 오늘 서빙 안 됨 — 노드 전수 스캔
 *
 * ★ 2026-08-07 독립 리뷰 처분 2라운드 (판정축·판정단위 교정):
 *   [1R] 초판 GAP 은 `oldNode.is_current_active !== 1` 을 조건으로 삼았는데, 시각 경과형
 *        (`valid_until` 도래)에서는 **구본을 은퇴시킬 이벤트가 없어** 그 값이 계속 1 이다 —
 *        헤더가 이 관측기에 위임한 부류가 정작 조건에서 빠져 있었다(과소보고). 동시에 판정이
 *        엣지 국소라 다중홉 체인에서 오탐했다(과대보고 → 두 번째 개정이 생기면 게이트 영구 FAIL).
 *   [2R] 1R 이 도입한 "터미널 승계자에서만 보고" 규칙은 **상류를 하류에 위임**하는 구조라,
 *        하류가 자기 조건에 걸리지 않으면 위임을 거절해 **공백이 통째로 증발**했다(실측 재현).
 *        분기 승계에서는 죽은 형제 가지마다 새 오탐도 냈다.
 *   ⇒ 판정을 **약연결 성분**으로 올린다. "한 주제가 화면에서 사라졌는가"는 애초에 성분의 성질이지
 *     엣지의 성질이 아니었다. 다중홉 수렴·위임 증발·분기 오탐·병합 중복·순환 계보가 동시에 해소된다.
 *
 * "둘 다 draft" 처럼 애초에 아무도 승인된 적 없는 계보는 제외(노이즈 차단).
 * 양끝 노드가 덤프에 없으면 건너뛴다 (부재 노드 = `findBrokenEdges` 소관, 중복 보고 금지).
 */
export function findLineageAnomalies(
  nodeRows: readonly D1NodeRow[],
  edgeRows: readonly D1EdgeRow[],
  todayKst: string,
): LineageAudit {
  // 컬럼 **부재**(undefined)만 미측정으로 본다. 값이 NULL 인 것은 부재가 아니라
  // "전이 이력 없음" = 정책상 'draft' (APPROVED_NODES_STATUS_CORE 의 COALESCE 기본값과 동일 해석).
  const missingStatus = nodeRows.some((r) => r.effective_status === undefined);
  if (missingStatus) {
    return {
      measured: false,
      reason:
        'knowledge_nodes 덤프에 effective_status 컬럼이 없습니다 — 계보 불변식은 실 status 없이 판정 불가. ' +
        "덤프 SELECT 에 status_transitions 최신 전이를 COALESCE(...,'draft') 로 JOIN 하세요 (러너 헤더 사용법 참조).",
      anomalies: [],
    };
  }

  const byId = new Map(nodeRows.map((r) => [r.id, r]));
  const anomalies: LineageAnomaly[] = [];

  // 덤프에 양끝이 모두 있는 **활성 SUPERSEDES** 엣지 = 계보 클레임.
  const claims = edgeRows.filter(
    (e) =>
      e.edge_type === 'SUPERSEDES' &&
      e.is_active === 1 &&
      byId.has(e.from_node) &&
      byId.has(e.to_node),
  );

  // --- ① 동시 서빙 = 엣지 국소 판정 (이 엣지가 "구본"이라 주장하는 것이 아직 서빙된다) ---
  for (const edge of claims) {
    const newNode = byId.get(edge.from_node)!;
    const oldNode = byId.get(edge.to_node)!;
    if (isServedToday(newNode, todayKst) && isServedToday(oldNode, todayKst)) {
      anomalies.push({
        type: 'LINEAGE_DUAL_ACTIVE',
        edgeId: edge.id,
        newNodeId: newNode.id,
        oldNodeId: oldNode.id,
        detail: `구·신 동시 서빙 — 학습자가 현행을 판별할 수 없음 (신 ${newNode.id} / 구 ${oldNode.id})`,
      });
    }
  }

  // --- ② 계보 공백 = **성분(connected component) 단위** 판정 ---
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while ((parent.get(root) ?? root) !== root) root = parent.get(root)!;
    let cur = x;
    while ((parent.get(cur) ?? cur) !== cur) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const edge of claims) {
    if (!parent.has(edge.from_node)) parent.set(edge.from_node, edge.from_node);
    if (!parent.has(edge.to_node)) parent.set(edge.to_node, edge.to_node);
    union(edge.from_node, edge.to_node);
  }

  interface Component {
    readonly members: string[];
    readonly edges: D1EdgeRow[];
  }
  const components = new Map<string, Component>();
  for (const id of parent.keys()) {
    const root = find(id);
    const comp = components.get(root) ?? { members: [], edges: [] };
    comp.members.push(id);
    components.set(root, comp);
  }
  for (const edge of claims) components.get(find(edge.from_node))!.edges.push(edge);

  const gapMembers = new Set<string>();
  for (const comp of components.values()) {
    const rows = comp.members.map((id) => byId.get(id)!);
    // 성분 안에 오늘 서빙되는 노드가 하나라도 있으면 그 주제는 살아 있다 = 공백 아님.
    if (rows.some((r) => isServedToday(r, todayKst))) continue;
    // 성분에 **현재 approved 인 구성원이 하나도 없으면** 제외 — 애초에 아무도 서빙된 적 없는
    // 개정 준비 계보(전부 draft)의 노이즈를 막는다.
    // ★판정은 "승인 이력"이 아니라 **현재 스냅샷**이다(3R 지적으로 문면 정정): 성분 전원이 강등
    //   (flagged)된 경우는 여기서 걸러진다 — 그 부류는 status_transitions 이력을 봐야 하며 별건이다.
    if (!rows.some((r) => (r.effective_status ?? 'draft') === 'approved')) continue;

    // 대표 엣지 = id 최소 (결정적). 타입 shape 을 유지해 소비자 변경을 없앤다.
    const rep = comp.edges.reduce((a, b) => (a.id <= b.id ? a : b));
    const sorted = [...comp.members].sort();
    // 성분 구성원별 상태 — 운영자가 "왜 사라졌는지"를 리포트 한 줄에서 판단할 수 있어야 한다.
    // 리포트 한 줄이 무제한으로 길어지지 않도록 상한 (3R: 1만 노드 단일 성분에서 536KB 한 줄 실측)
    const MEMBER_DETAIL_CAP = 20;
    const memberDetail = sorted
      .slice(0, MEMBER_DETAIL_CAP)
      .map((id) => {
        const r = byId.get(id)!;
        return (
          `${id}(status=${r.effective_status ?? 'draft'} · active=${r.is_current_active}` +
          `${r.valid_from == null ? '' : ` · from=${r.valid_from}`}` +
          `${r.valid_until == null ? '' : ` · until=${r.valid_until}`})`
        );
      })
      .join(' / ')
      .concat(
        sorted.length > MEMBER_DETAIL_CAP ? ` / …외 ${sorted.length - MEMBER_DETAIL_CAP}개` : '',
      );
    for (const id of comp.members) gapMembers.add(id);
    anomalies.push({
      type: 'LINEAGE_GAP',
      edgeId: rep.id,
      newNodeId: rep.from_node,
      oldNodeId: rep.to_node,
      detail:
        `계보 공백 — 활성 SUPERSEDES 성분 ${sorted.length}노드 중 오늘 서빙 0개 ` +
        `(approved 구성원 있음 · 기준일 ${todayKst} · 대표 엣지 ${rep.id}): ${memberDetail}. ` +
        `학습자 화면에서 이 주제가 통째로 사라진 상태다.`,
    });
  }

  // --- ③ 엣지 무관 단독 관측 (승인·활성인데 오늘 창 밖) ---
  //
  // 시각 경과형(후속본 없는 만료)·미발효 잔재·해석 불가 날짜가 전부 여기로 들어온다.
  // ★중복 억제: GAP 으로 이미 보고된 성분의 노드는 다시 세지 않는다(같은 사건을 두 줄로 내면
  //   게이트 신호가 부풀고 리포트 독자가 규모를 오독한다). DUAL 당사자는 정의상 서빙 중이라
  //   아래 `isServedToday` 에서 자연 제외되므로 별도 억제가 필요 없다.
  for (const row of nodeRows) {
    if (row.is_current_active !== 1) continue;
    if ((row.effective_status ?? 'draft') !== 'approved') continue;
    if (isServedToday(row, todayKst)) continue;
    if (gapMembers.has(row.id)) continue;
    anomalies.push({
      type: 'LINEAGE_LAPSE',
      nodeId: row.id,
      detail:
        `승인·활성인데 본 관측기 기준 오늘 서빙되지 않음 ` +
        `(valid_from=${row.valid_from ?? '-'} · valid_until=${row.valid_until ?? '-'} · 기준일 ${todayKst}). ` +
        `대개는 시각 경과형(트리거로 원리상 감지 불가)이라 후속본이 없으면 무증상 소멸이다. ` +
        `단 날짜 문자열이 해석 불가한 경우에는 서빙 SQL 이 더 관대해 **반대로 노출 중**일 수 있으므로 ` +
        `(SQLite date() 는 '2026-02-30'·'now' 를 해석한다) 값 자체를 먼저 확인할 것.`,
    });
  }

  return { measured: true, anomalies };
}

// --- 종합 ---

export interface ProductionAuditReport {
  readonly integrity: IntegrityReport;
  readonly staleEdgeRefs: readonly StaleEdgeRef[];
  /** whitelist 기준 forward-walk 도달 불가 활성 노드 (정보 지표 — 위반 아님). */
  readonly walkUnreachable: readonly UnreachableNode[];
  /** 활성 SUPERSEDES 계보의 서빙 상태 이상 (2026-08-07 결정 #9 (C) §3-4). */
  readonly lineage: LineageAudit;
  /**
   * 게이트 판정 — integrity.valid AND staleEdgeRefs 0 AND 계보 이상 0(**측정된 상태로**).
   * walkUnreachable 은 게이트 불산입: 도달 불가 = 엣지 밀도(데이터 천장) 신호로
   * BATCH 보강 대상이지 무결성 위반이 아니다 (기보고 CONCEPT-023 = 정상 적재 노드).
   * ★ 계보 **미측정은 통과가 아니다** — 덤프 결손을 조용한 PASS 로 바꾸지 않는다(러너 fabricate 차단 정합).
   */
  readonly gatePass: boolean;
}

export interface ProductionAuditOptions {
  /**
   * 계보 불변식의 "오늘" — KST `YYYY-MM-DD` (서빙 코어 `TODAY_KST_SQL` 미러).
   * 순수 코어 유지를 위해 **주입**한다 (내부에서 시계를 읽지 않는다 = 결정적).
   */
  readonly todayKst?: string;
}

export function auditProductionGraph(
  nodeRows: readonly D1NodeRow[],
  edgeRows: readonly D1EdgeRow[],
  edgeTypeWhitelist: ReadonlyArray<string>,
  options: ProductionAuditOptions = {},
): ProductionAuditReport {
  const { nodes, edges } = fromD1Rows(nodeRows, edgeRows);
  const integrity = validateGraphIntegrity(nodes, edges);
  const staleEdgeRefs = findActiveEdgesToInactiveNodes(nodes, edges);
  const walkUnreachable = findWalkUnreachableNodes(nodes, edges, edgeTypeWhitelist);
  const lineage =
    options.todayKst === undefined
      ? ({
          measured: false,
          reason:
            'todayKst 미주입 — 계보 불변식은 기준일 없이 판정 불가 (호출 측이 KST 오늘을 주입해야 한다).',
          anomalies: [],
        } as const)
      : findLineageAnomalies(nodeRows, edgeRows, options.todayKst);
  return {
    integrity,
    staleEdgeRefs,
    walkUnreachable,
    lineage,
    gatePass:
      integrity.valid &&
      staleEdgeRefs.length === 0 &&
      lineage.measured &&
      lineage.anomalies.length === 0,
  };
}
