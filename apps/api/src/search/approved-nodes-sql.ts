/**
 * approved 노드 도출 SQL — 단일 진실원 (CO-4 해소).
 *
 * 배경: "현재 status='approved' + is_current_active=1" 도출 SQL 이 검색 경로
 *   전반에 **문자 단위 복제**되어 있었다 (graph-walk-s5-integration.plan.md
 *   §1 CO-4 + S5-5 Pass2 MAJOR-1). 진실원은 동일했으나 *복제*이므로 status
 *   정책 개정 시 일부만 갱신되는 split-brain drift 위험이 잠재.
 *
 * 해소: 본 모듈이 status 도출 정책의 **유일 출처**. status 코어를 복제하던
 *   호출 측이 전부 `buildApprovedNodesQuery`/`buildApprovedNodesMaterializedCte`
 *   만 호출 → 코어 SQL 이 1곳에만 존재, drift 구조적 불가 (G-S4 게이트):
 *     1. graph-walk `approved` CTE (`graph-walk/index.ts`)
 *     2. user-search Stage 2 (`user-search.ts` fetchApprovedNodes)
 *     3. multi-path-fallback keyword (`keyword-fallback.ts` fetchTokenMatches)
 *     4. multi-path-fallback topic-cluster (`topic-cluster-router.ts` fetchNodesByIds)
 *     5. **study 출처 표면 (`study/routes.ts` enrichRelatedNodes) — 2026-08-06 편입.**
 *        그전까지 `is_current_active=1` 만 보는 자체 SQL 이었다(= 승인·시행 미확인 누출 경로).
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
 * "오늘"의 단일 정의 — **KST 기준**.
 *
 * D1(SQLite) `date('now')` 는 UTC 다. 시험 도메인의 시행일은 한국 관보 기준이라
 * UTC 로 판정하면 시행 당일 09:00(KST) 이전 9시간 동안 미시행으로 오판한다.
 * 반대로 만료도 9시간 늦게 걸린다. → `+9 hours` 보정을 **단일 상수**로 고정한다.
 */
export const TODAY_KST_SQL = `date('now','+9 hours')`;

/**
 * 시행시점 창 필터 — **반개구간 `[valid_from, valid_until)`**.
 *
 * ⚠️★ **이 함수와 `TODAY_KST_SQL` 을 바꾸면 DB 트리거를 함께 새 마이그레이션으로 재생성해야 한다.**
 *   같은 술어의 SQL 사본이 `migrations/0045`(트리거 6) · `migrations/0046`(트리거 4)에 있고,
 *   적용된 마이그는 불변이므로 in-place 수정이 불가능하다. 미러가 갈라지면 증상은
 *   "서빙에는 보이는데 승격이 ABORT" 처럼 원인 추적이 어려운 형태로 나타난다.
 *   TS 미러 1벌(`packages/quality/src/production-audit.ts` `isServedToday`)도 같이 본다.
 *   ★경고를 여기(의존의 **상류**)에 두는 이유: 2026-08-07 리뷰가 "경고가 트리거 파일에만 있고,
 *     그 파일은 코어를 고치는 사람이 열지 않는 파일"이라고 지적했다(MAJOR, 2개 렌즈 수렴).
 *
 * 경계 규약(본 커밋에서 명문화 — 그전까지 소비자가 없어 미정의였다):
 *   - `valid_from` **포함**: "시행 2026.8.15" = 8/15 당일부터 유효.
 *   - `valid_until` **미포함**: 그 시점에 효력이 끝난다(= 후속본의 `valid_from` 과 같은 값을 써서
 *     계보를 빈틈·겹침 없이 잇는다). 선례 = migrations/0044 가 `exam_questions` 은퇴 시
 *     `valid_until` 을 "이 시점에 현행이 아니게 됨" 스탬프로 사용.
 *   - **NULL = 무제한**(양쪽 다). 현 production 은 857/857 이 NULL 이라 이 필터의 오늘자 효과는 0 —
 *     즉 무회귀. 값이 채워지는 시점부터 발효된다(백필은 별건·진산 인증 게이트).
 *
 * ★독립 리뷰 수리 (2026-08-06) — **포맷 내성**:
 *   초판은 컬럼을 TEXT 사전순으로 직접 비교했다. 그런데 이 컬럼들의 문자열 포맷은 어디에도
 *   강제돼 있지 않고(0041 은 그냥 TEXT), 주석이 선례로 든 0044 는 실제로 **datetime** 을 찍는다.
 *   `'2026-08-15T00:00:00Z' <= '2026-08-15'` 는 거짓이라 **시행 당일 하루를 통째로 놓치고**,
 *   만료 쪽은 반대로 하루 더 노출된다. 게다가 0041 가드가 값→값 UPDATE 를 막아 **사후 교정도 불가**다.
 *   → `date()` 로 정규화해 비교한다. `date()` 는 'YYYY-MM-DD' 와 'YYYY-MM-DDTHH:MM:SSZ' 를 모두
 *   같은 날짜로 환원하고, **해석 불가한 값이면 NULL 을 돌려준다** → 비교가 참이 되지 않아 그 행은
 *   제외된다(fail-closed: 유효기간을 못 읽는 콘텐츠는 보여주지 않는다).
 *   ※ 대가: `date(...)` 때문에 `idx_knowledge_nodes_valid_from` 을 못 탄다. 현재 값이 전부 NULL 이라
 *     실효 영향 0이고, 백필 규모가 커지면 생성 컬럼+인덱스로 재검토한다(부채 기록).
 *
 * @param alias `knowledge_nodes` 의 테이블 별칭 (예: 'kn')
 */
export function buildEffectivityWindowSql(alias: string): string {
  return (
    `(${alias}.valid_from IS NULL OR date(${alias}.valid_from) <= ${TODAY_KST_SQL})` +
    `\n      AND (${alias}.valid_until IS NULL OR date(${alias}.valid_until) > ${TODAY_KST_SQL})`
  );
}

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
 *
 * 정책 개정(2026-08-06, 역이식 STAGE 0-4): **시행시점 축 배선**. 0041 이 `valid_from`/`valid_until`
 *   컬럼을 만들면서 헤더에 "학습자 경로 필터 배선 = Phase 0 후속 코드(별건 커밋)"로 명시 이월했고
 *   그 후속이 미착수였다 → 본 커밋이 그 배선이다. {@link buildEffectivityWindowSql} 참조.
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
      AND COALESCE(latest.to_status, 'draft') = 'approved'
      AND ${buildEffectivityWindowSql('kn')}`;

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
