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
 * 기본 edge_type 화이트리스트. SUPERSEDES 의도적 제외 —
 * SUPERSEDES 는 버전 시계열 관계이지 "연관 지식" semantic relation 이 아니다
 * (plan §0.3). 호출 측에서 명시 override 가능.
 */
export const DEFAULT_EDGE_TYPE_WHITELIST: ReadonlyArray<string> = [
  'DEPENDS_ON',
  'SHARED_WITH',
  'CROSS_REF',
];

/** PoC 기본값 (plan §1). */
export const DEFAULT_MAX_DEPTH = 2;
export const DEFAULT_RESULT_CAP = 50;

/**
 * Hard ceiling — 호출 측이 더 큰 값을 요청해도 clamp.
 * plan §0 Anchor #1(CPU)·#2(폭발) 강제. 본 상한 자체가 안전선이다.
 */
export const MAX_ALLOWED_DEPTH = 5;
export const MAX_ALLOWED_RESULT_CAP = 500;

/**
 * edge_type 화이트리스트 길이 상한 (4-Pass Pass3 Major-3 흡수).
 * 호출 측이 거대 배열 전달 시 `IN (?,...×N)` SQL 비대 = DoS 표면 차단.
 * 실 edge_type 종류는 한 자릿수 (CROSS_REF/DEPENDS_ON/SHARED_WITH/SUPERSEDES 등).
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

  // WITH RECURSIVE — D1 SQLite (= SQLite 코어). ROW_NUMBER() OVER 는
  // user-search.ts:431-441 가 이미 D1 production 경로에서 사용 (지원 확인).
  //
  // ★ 폭발 차단 설계 (4-Pass C-1 흡수): walk 튜플을 (node_id, depth) 로 한정.
  //   `path` 문자열 미사용 → 다중 경로로 같은 (node,depth) 도달 시 UNION 집합
  //   dedup 으로 1행 collapse. CTE 프론티어 상한 = N_reachable × (maxDepth+1)
  //   ≤ N × (MAX_ALLOWED_DEPTH+1). 지수 경로 폭발 불가 (plan §0 불변식 #1/#2).
  //   cycle 안전 = depth 단조 증가 + `w.depth < maxDepth` 종료 (path guard 불요)
  //   → 노드 ID 의 '/' 포함 여부와 무관 (구 instr 가드의 M-2 결함 동시 소멸).
  //   LIMIT 은 최종 SELECT 결과 cap. CTE 자체가 이미 N×depth 로 bounded.
  const sql = `
    WITH RECURSIVE approved AS (
      SELECT kn.id AS id, kn.type AS type, kn.name AS name,
             kn.truth_weight AS truth_weight, kn.page_ref AS page_ref
      FROM knowledge_nodes kn
      LEFT JOIN (
        SELECT target_id, to_status,
          ROW_NUMBER() OVER (PARTITION BY target_id ORDER BY transitioned_at DESC) AS rn
        FROM status_transitions
        WHERE target_type = 'node'
      ) latest ON latest.target_id = kn.id AND latest.rn = 1
      WHERE kn.is_current_active = 1
        AND COALESCE(latest.to_status, 'draft') = 'approved'
    ),
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
           a3.name AS name, a3.truth_weight AS truth_weight, a3.page_ref AS page_ref
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
      truthWeight: r.truth_weight,
      pageRef: r.page_ref ?? null,
    })),
  };
}
