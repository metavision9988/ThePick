/**
 * approved 노드 도출 SQL — 단일 진실원 (CO-4 해소).
 *
 * 배경: "현재 status='approved' + is_current_active=1" 도출 SQL 이 검색 경로
 *   전반에 **문자 단위 복제**되어 있었다 (graph-walk-s5-integration.plan.md
 *   §1 CO-4 + S5-5 Pass2 MAJOR-1). 진실원은 동일했으나 *복제*이므로 status
 *   정책 개정 시 일부만 갱신되는 split-brain drift 위험이 잠재.
 *
 * 해소: 본 모듈이 status 도출 정책의 **유일 출처**. status 코어를 복제하던
 *   4 호출 측이 전부 `buildApprovedNodesQuery`/`buildApprovedNodesMaterializedCte`
 *   만 호출 → 코어 SQL 이 1곳에만 존재, drift 구조적 불가 (G-S4 게이트):
 *     1. graph-walk `approved` CTE (`graph-walk/index.ts`)
 *     2. user-search Stage 2 (`user-search.ts` fetchApprovedNodes)
 *     3. multi-path-fallback keyword (`keyword-fallback.ts` fetchTokenMatches)
 *     4. multi-path-fallback topic-cluster (`topic-cluster-router.ts` fetchNodesByIds)
 *
 * 정책 정합:
 *   - migrations/0010 — status_transitions CHECK = **4-state**
 *     (`draft`,`review`,`approved`,`flagged`). 정상 전이 draft→review→approved
 *     단방향 + 임의 상태 `→flagged` 일방(0010:98,106). flagged 는 종착 —
 *     트리거(0010:101-106)가 flagged→{draft,review,approved} 전이를 ABORT.
 *   - **격리 계약(positive):** 본 코어는 `latest.to_status = 'approved'` 만
 *     통과시킨다. `flagged`(결함 발견 격리)·`review`·`draft` 는 *전부 의도적
 *     배제* — 'flagged'≠'approved' 우연이 아니라 명시 정책. 학습 서비스의
 *     정답 정확성 Hard Stop 상, 격리(flagged) 노드의 결과/그래프 순회 편입은
 *     절대 불가 (4 호출 측 공통 보장).
 *   - migrations/0013 — is_current_active (Materialized Active View, ADR-013)
 *   - migrations/0018 — draft-only INSERT (status 컬럼은 초기 스냅샷 전용)
 *   - SEARCH_PIPELINE.md §4 / ADR-012 §Decision Stage 2
 *
 * Hard Limit 정합: SELECT only — knowledge_nodes/status_transitions 무변경.
 */

/**
 * status 도출 코어 — 호출 측(projection/후보 한정)과 **무관하게 불변**.
 *
 * 현재 상태 = `status_transitions` 최신 레코드(`ROW_NUMBER() OVER PARTITION`)의
 * `to_status`, 전이 이력이 없으면 `COALESCE` default `'draft'` 차단.
 * `knowledge_nodes.status` 컬럼은 INSERT 초기 스냅샷일 뿐 신뢰하지 않는다.
 *
 * ★ 이 문자열이 status 도출 정책의 단일 진실원이다. 정책 개정은 오직 여기서.
 *   graph-walk·user-search 가 이 동일 문자열을 공유 → drift 0 (CO-4).
 *
 * 정책 개정(2026-07-07, 독립 리뷰 wf_83d2aa9a MAJOR): `rowid DESC` 타이브레이커 도입 —
 *   동일 transitioned_at 타이에서 본 도출·0042 트리거·state-machine 이 서로 다른 행을
 *   선택하는 발산이 실측 재현됨(벌크 전이 시 실현 가능). 의미 = "동시각 = 삽입순 최후 승".
 *   타이 부재 데이터에서는 관측 동등(무회귀). 0042 트리거·state-machine·batch 도출과 동시 개정.
 */
export const APPROVED_NODES_STATUS_CORE = `
    FROM knowledge_nodes kn
    LEFT JOIN (
      SELECT target_id, to_status,
        ROW_NUMBER() OVER (PARTITION BY target_id ORDER BY transitioned_at DESC, rowid DESC) AS rn
      FROM status_transitions
      WHERE target_type = 'node'
    ) latest ON latest.target_id = kn.id AND latest.rn = 1
    WHERE kn.is_current_active = 1
      AND COALESCE(latest.to_status, 'draft') = 'approved'`;

export interface ApprovedNodesQueryOptions {
  /**
   * SELECT 절 컬럼 목록 (호출 측 projection — `kn` alias 기준).
   * 예) graph-walk: `kn.id AS id, kn.type AS type, ...`
   *     user-search: `kn.id, kn.type, kn.name, kn.description, ...`
   */
  readonly projection: string;
  /**
   * 후보 한정 WHERE fragment (옵션). status 코어 *뒤*에 `AND` 로 결합 —
   * AND 교환법칙으로 결과 집합 불변(원 user-search `kn.id IN(...) AND ...`와 동치).
   *   - user-search: `kn.id IN (?,?,...)`  (status 무관 = 진실원 분기 아님)
   *   - graph-walk : 미지정 (전체 approved 집합 = 재귀 anchor)
   */
  readonly candidateFilter?: string;
}

/**
 * approved 노드 SELECT 생성 — status 코어는 {@link APPROVED_NODES_STATUS_CORE}
 * 단일 출처를 공유. projection / candidateFilter 만 호출 측이 주입한다
 * (둘 다 status 도출과 무관 = 진실원 분기 아님).
 */
export function buildApprovedNodesQuery(options: ApprovedNodesQueryOptions): string {
  const { projection, candidateFilter } = options;
  const tail =
    candidateFilter !== undefined && candidateFilter.trim() !== ''
      ? `\n      AND ${candidateFilter}`
      : '';
  return `SELECT ${projection}${APPROVED_NODES_STATUS_CORE}${tail}`;
}

/**
 * graph-walk `approved` CTE — `buildApprovedNodesQuery` 를 MATERIALIZED CTE 로 래핑.
 *
 * D-2 (S5-1 CO-1 해소, measurement.md §3.1): `AS MATERIALIZED` 강제.
 * 다중 참조 CTE(재귀 매 iteration + 최종 join)가 비물질화되면 rows_read 폭증
 * — 실 D1 측정 195.5ms → 67.3ms (2.9x). D1 SQLite `AS MATERIALIZED` 지원 확인.
 */
export function buildApprovedNodesMaterializedCte(cteName: string, projection: string): string {
  return `${cteName} AS MATERIALIZED (\n      ${buildApprovedNodesQuery({ projection })}\n    )`;
}
