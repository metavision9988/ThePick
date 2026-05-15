/**
 * Graph walk — knowledge_edges N-hop 순회 엔진 (Engine-First 격리 모듈).
 *
 * 근거: ADR-045 (방향) / ADR-044 (Pattern A 정체성) /
 *   docs/plans/graph-walk-poc.plan.md (L3 plan, 진산 S0 승인).
 *
 * ★ 본 모듈은 검색 라우터에 통합되지 않는다 (PoC 범위 — plan §1 OUT).
 *   기존 user-search / multi-path-fallback 경로 불변. 단독 검증 후 통합은 별도 결재.
 *
 * 불변식 (plan §0 Reality Anchor 대응):
 *   1. Workers CPU 상한 → maxDepth/resultCap hard ceiling 강제 (무제한 순회 차단)
 *   2. 그래프 폭발 → resultCap + 경로 cycle guard + depth cap
 *   3. 엣지 의미 혼재 → edge_type 화이트리스트(기본 SUPERSEDES 제외 — temporal,
 *      semantic relation 아님) + is_current_active=1 + 최신 status='approved' 필터
 *
 * Hard Rule 16: 첫 인자 examId: ExamId 강제 (Year 1 단일 시험이라 WHERE 절은
 *   부재하나 시그니처에 examId 포함 → Year 2 zero-cost 전환). user-search.ts 정합.
 * Hard Rule 17: 시험 ID 리터럴 미사용 (examId 는 호출 측에서 ExamId 타입 경유).
 */

import type { ExamId } from '@thepick/shared';
import { buildApprovedNodesMaterializedCte } from '../approved-nodes-sql.js';

/** D1 인터페이스 (테스트 sqlite-backed wrapper / 실 D1Database 양쪽 구조 호환). */
export interface GraphWalkD1 {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      all<T = Record<string, unknown>>(): Promise<{
        readonly results?: ReadonlyArray<T>;
      }>;
    };
  };
}

/**
 * 기본 edge_type 화이트리스트 — **의미 관계 전체 (SUPERSEDES 만 제외)**.
 *
 * D-1 진산 결재 (★ 북극성, 2026-05-15 Session 086 / measurement.md §3.1):
 *   구 PoC 기본 3종(`DEPENDS_ON,SHARED_WITH,CROSS_REF`)은 비-SUPERSEDES
 *   1263 엣지의 34% 만 커버 → 핵심 추론 엣지(USES_FORMULA 221 / APPLIES_TO
 *   158 / DEFINED_AS 129 / PREREQUISITE 113)가 누락되어 Pattern A multi-hop
 *   추론이 반쪽. 의미 관계 전체를 순회 허용하도록 12종으로 확정.
 *
 * SUPERSEDES 제외: 버전 시계열 관계이지 "연관 지식" semantic relation 이
 *   아니다 (plan §0.3 / ADR-045). 0013 트리거가 superseded 타깃을
 *   is_current_active=0 자동 폐기 → 어차피 approved 필터에서 탈락.
 *
 * 호출 측에서 명시 override 가능 (단 길이 ≤ MAX_EDGE_TYPE_WHITELIST).
 */
export const DEFAULT_EDGE_TYPE_WHITELIST: ReadonlyArray<string> = [
  'DEPENDS_ON',
  'USES_FORMULA',
  'APPLIES_TO',
  'DEFINED_AS',
  'PREREQUISITE',
  'REQUIRES_INVESTIGATION',
  'CROSS_REF',
  'GOVERNED_BY',
  'DIFFERS_FROM',
  'SHARED_WITH',
  'TIME_CONSTRAINT',
  'EXCEPTION',
];

/** PoC 기본값 (plan §1). */
export const DEFAULT_MAX_DEPTH = 2;
export const DEFAULT_RESULT_CAP = 50;

/**
 * Hard ceiling — 호출 측이 더 큰 값을 요청해도 clamp.
 * plan §0 Anchor #1(CPU)·#2(폭발) 강제. 본 상한 자체가 안전선이다.
 *
 * D-2 진산 결재 (2026-05-15 Session 086 / measurement.md §3.1 CO-1 해소):
 *   실 D1 측정 — 12종 화이트리스트 worst-case 시드 + MATERIALIZED 기준
 *   depth4 = 41.5ms (free 50ms 내) / depth5 = 67.3ms (초과). hard ceiling
 *   5→4 하향 → worst+full 에서도 free tier 내. depth5 는 명시적 paid
 *   opt-in / 추가 최적화 전까지 차단 (Reality Anchor #1 강화 = 더 보수적).
 */
export const MAX_ALLOWED_DEPTH = 4;
export const MAX_ALLOWED_RESULT_CAP = 500;

/**
 * edge_type 화이트리스트 길이 상한 (4-Pass Pass3 Major-3 흡수).
 * 호출 측이 거대 배열 전달 시 `IN (?,...×N)` SQL 비대 = DoS 표면 차단.
 * D-1 기본 화이트리스트 12종 ≤ 16 상한 (전체 의미 관계 + 여유). 16 유지.
 */
export const MAX_EDGE_TYPE_WHITELIST = 16;

export interface GraphWalkOptions {
  /** 순회 최대 깊이 (hop). [1, MAX_ALLOWED_DEPTH] 로 clamp. 기본 2. */
  readonly maxDepth?: number;
  /** 결과 노드 상한. [1, MAX_ALLOWED_RESULT_CAP] 로 clamp. 기본 50. */
  readonly resultCap?: number;
  /** 순회 허용 edge_type. 비우면 기본 화이트리스트. */
  readonly edgeTypeWhitelist?: ReadonlyArray<string>;
}

export interface GraphWalkNode {
  readonly id: string;
  /** 시드로부터 최단 hop 거리 (1 이상 — 시드 자신은 결과에서 제외). */
  readonly depth: number;
  readonly type: string;
  readonly name: string;
  /** 노드 본문 — UserSearchHit 동형(잉여 2차 조회 제거, S5-5 CO6-1). 없으면 null. */
  readonly description: string | null;
  readonly truthWeight: number;
  /** 출처 추적 (source citation requirement) — 없으면 null. */
  readonly pageRef: string | null;
}

export interface GraphWalkResult {
  readonly seedNodeId: string;
  readonly examId: ExamId;
  readonly maxDepth: number;
  readonly resultCap: number;
  readonly edgeTypeWhitelist: ReadonlyArray<string>;
  /**
   * resultCap 초과로 잘렸는가 (cap+1 조회로 판정).
   * truncation 정책 (4-Pass Pass2 M1 명시): `ORDER BY depth ASC, id ASC` →
   * 잘리는 것은 항상 "가장 먼 hop의 큰 id" 노드. 가까운 hop 우선 보존.
   * ★ S5 검색 라우터 통합 결재 시 truth_weight 가중 보존 정책 재검토 carry-over.
   */
  readonly truncated: boolean;
  readonly nodes: ReadonlyArray<GraphWalkNode>;
}

export class GraphWalkError extends Error {
  readonly phase: 'input' | 'query';
  readonly statusCode: number;
  constructor(message: string, phase: 'input' | 'query', cause?: unknown) {
    super(message);
    this.name = 'GraphWalkError';
    this.phase = phase;
    this.statusCode = phase === 'input' ? 400 : 500;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

interface WalkRow {
  readonly id: string;
  readonly depth: number;
  readonly type: string;
  readonly name: string;
  readonly description: string | null;
  readonly truth_weight: number;
  readonly page_ref: string | null;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const floored = Math.floor(value);
  if (floored < min) return min;
  if (floored > max) return max;
  return floored;
}

/**
 * 시드 노드에서 knowledge_edges 를 N-hop 순회. approved + is_current_active=1
 * 노드만, edge_type 화이트리스트 + is_active=1 엣지만, cycle 차단, 결과 cap.
 *
 * @throws GraphWalkError phase='input' — examId/seed 누락, whitelist 빈 배열
 * @throws GraphWalkError phase='query' — D1 실행 실패 (silent empty 금지, 전파)
 */
export async function graphWalk(
  examId: ExamId,
  db: GraphWalkD1,
  seedNodeId: string,
  options: GraphWalkOptions = {},
): Promise<GraphWalkResult> {
  // Hard Rule 16 — examId 강제 (user-search.ts:205-206 정합)
  if (!examId || (examId as string).trim() === '') {
    throw new GraphWalkError('examId is required (Hard Rule 16 시험 경계 강제)', 'input');
  }
  if (!seedNodeId || seedNodeId.trim() === '') {
    throw new GraphWalkError('seedNodeId is required', 'input');
  }

  const maxDepth = clampInt(options.maxDepth ?? DEFAULT_MAX_DEPTH, 1, MAX_ALLOWED_DEPTH);
  const resultCap = clampInt(options.resultCap ?? DEFAULT_RESULT_CAP, 1, MAX_ALLOWED_RESULT_CAP);

  const whitelist =
    options.edgeTypeWhitelist && options.edgeTypeWhitelist.length > 0
      ? options.edgeTypeWhitelist
      : DEFAULT_EDGE_TYPE_WHITELIST;
  if (whitelist.some((t) => typeof t !== 'string' || t.trim() === '')) {
    throw new GraphWalkError('edgeTypeWhitelist 에 빈/비문자 항목', 'input');
  }
  if (whitelist.length > MAX_EDGE_TYPE_WHITELIST) {
    throw new GraphWalkError(
      `edgeTypeWhitelist 길이 ${whitelist.length} > 상한 ${MAX_EDGE_TYPE_WHITELIST}`,
      'input',
    );
  }

  const edgePlaceholders = whitelist.map(() => '?').join(',');

  // approved 노드 도출은 approved-nodes-sql.ts 단일 진실원 (CO-4) + D-2
  // `AS MATERIALIZED`(rows_read 폭증 차단, measurement.md §3.1). user-search
  // Stage 2 와 동일 status 코어를 *공유* (복제 아님 → status 정책 drift 0).
  //
  // WITH RECURSIVE — D1 SQLite (= SQLite 코어). ROW_NUMBER() OVER 는
  // user-search.ts 가 이미 D1 production 경로에서 사용 (지원 확인).
  //
  // ★ 폭발 차단 설계 (4-Pass C-1 흡수): walk 튜플을 (node_id, depth) 로 한정.
  //   `path` 문자열 미사용 → 다중 경로로 같은 (node,depth) 도달 시 UNION 집합
  //   dedup 으로 1행 collapse. CTE 프론티어 상한 = N_reachable × (maxDepth+1)
  //   ≤ N × (MAX_ALLOWED_DEPTH+1). 지수 경로 폭발 불가 (plan §0 불변식 #1/#2).
  //   cycle 안전 = depth 단조 증가 + `w.depth < maxDepth` 종료 (path guard 불요)
  //   → 노드 ID 의 '/' 포함 여부와 무관 (구 instr 가드의 M-2 결함 동시 소멸).
  //   LIMIT 은 최종 SELECT 결과 cap. CTE 자체가 이미 N×depth 로 bounded.
  // S5-5 CO6-1: `description` 를 projection 에 포함 → 호출 측(graph-search-route)
  // 의 잉여 2차 fetchApprovedNodes(windowed scan) 제거 (subrequest -1, 측정
  // 비용 정확). approved CTE 가 이미 MATERIALIZED 라 컬럼 추가 비용은 무시 가능.
  //
  // ★ S5-5 Pass2 Devil's Advocate 흡수: 최종 SELECT 의 description 은 GROUP BY
  //   key 가 아니라 `MIN(a3.description)` 집계다. GROUP BY 가 id(PK)+FD 컬럼이라
  //   그룹 내 description 은 전부 동일 → MIN 은 그 값을 정확 반환(동치)하면서,
  //   긴 법령 본문 텍스트를 group-key 비교에서 제외해 D-2(measurement.md §3.1
  //   depth4=41.5ms free 50ms) CPU 마진 잠식을 차단(측정 무결성 직결).
  const approvedCte = buildApprovedNodesMaterializedCte(
    'approved',
    'kn.id AS id, kn.type AS type, kn.name AS name, kn.description AS description, kn.truth_weight AS truth_weight, kn.page_ref AS page_ref',
  );
  const sql = `
    WITH RECURSIVE ${approvedCte},
    walk(node_id, depth) AS (
      SELECT a.id, 0
      FROM approved a
      WHERE a.id = ?
      UNION
      SELECT e.to_node, w.depth + 1
      FROM walk w
      JOIN knowledge_edges e ON e.from_node = w.node_id AND e.is_active = 1
      JOIN approved a2 ON a2.id = e.to_node
      WHERE w.depth < ?
        AND e.edge_type IN (${edgePlaceholders})
    )
    SELECT a3.id AS id, MIN(w.depth) AS depth, a3.type AS type,
           a3.name AS name, MIN(a3.description) AS description,
           a3.truth_weight AS truth_weight, a3.page_ref AS page_ref
    FROM walk w
    JOIN approved a3 ON a3.id = w.node_id
    WHERE w.node_id <> ?
    GROUP BY a3.id, a3.type, a3.name, a3.truth_weight, a3.page_ref
    ORDER BY depth ASC, a3.id ASC
    LIMIT ?
  `;

  const binds: unknown[] = [
    seedNodeId, // anchor: WHERE a.id = ?
    maxDepth, // recursive: WHERE w.depth < ?
    ...whitelist, // recursive: e.edge_type IN (?,...)
    seedNodeId, // final: WHERE w.node_id <> ?
    resultCap + 1, // final: LIMIT ? (cap+1 → truncated 판정)
  ];

  let rows: ReadonlyArray<WalkRow>;
  try {
    const res = await db
      .prepare(sql)
      .bind(...binds)
      .all<WalkRow>();
    rows = res.results ?? [];
  } catch (err) {
    // 빈 결과로 삼키지 않는다 — 전파 (CLAUDE.md 빈 catch 금지 / fail-loud).
    throw new GraphWalkError('graph walk 쿼리 실패', 'query', err);
  }

  const truncated = rows.length > resultCap;
  const capped = truncated ? rows.slice(0, resultCap) : rows;

  return {
    seedNodeId,
    examId,
    maxDepth,
    resultCap,
    edgeTypeWhitelist: whitelist,
    truncated,
    nodes: capped.map((r) => ({
      id: r.id,
      depth: r.depth,
      type: r.type,
      name: r.name,
      description: r.description ?? null,
      truthWeight: r.truth_weight,
      pageRef: r.page_ref ?? null,
    })),
  };
}
