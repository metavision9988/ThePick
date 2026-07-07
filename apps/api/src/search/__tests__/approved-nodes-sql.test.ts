/**
 * approved-nodes-sql — CO-4 단일 진실원 / NEW drift 0 회귀 테스트.
 *
 * 근거: docs/plans/graph-walk-s5-integration.plan.md §1 CO-4 + §3 G-S4.
 *
 * 검증 목표: graph-walk `approved` CTE 와 user-search Stage 2 filter 가
 *   status 도출 코어를 **문자 단위 동일**하게 공유함을 기계적으로 못박는다.
 *   향후 한쪽만 status 정책을 바꾸면(= 코어 문자열이 갈리면) 본 테스트가
 *   즉시 실패 → drift 구조적 차단 (G-S4 단일 진실원 게이트).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  APPROVED_NODES_STATUS_CORE,
  buildApprovedNodesQuery,
  buildApprovedNodesMaterializedCte,
} from '../approved-nodes-sql';
import {
  createD1FromAllMigrations,
  type SqliteBackedD1,
} from '../../__tests__/helpers/d1-from-sqlite.js';

// 실 호출 측이 주입하는 projection (graph-walk/index.ts·user-search.ts 와 동일 문자열).
const GRAPH_WALK_PROJECTION =
  'kn.id AS id, kn.type AS type, kn.name AS name, kn.truth_weight AS truth_weight, kn.page_ref AS page_ref';
const USER_SEARCH_PROJECTION =
  'kn.id, kn.type, kn.name, kn.description, kn.page_ref, kn.truth_weight, kn.status, kn.is_current_active';

describe('approved-nodes-sql — CO-4 단일 진실원', () => {
  it('status 코어는 호출 측(projection/후보 한정)과 무관하게 byte-identical', () => {
    const graphWalkSql = buildApprovedNodesMaterializedCte('approved', GRAPH_WALK_PROJECTION);
    const userSearchSql = buildApprovedNodesQuery({
      projection: USER_SEARCH_PROJECTION,
      candidateFilter: 'kn.id IN (?,?,?)',
    });

    // 양쪽 SQL 이 동일 status 코어 문자열을 *포함* → drift 0 (복제 아닌 공유).
    expect(graphWalkSql).toContain(APPROVED_NODES_STATUS_CORE);
    expect(userSearchSql).toContain(APPROVED_NODES_STATUS_CORE);

    // 코어 = status_transitions ROW_NUMBER 최신 도출 + COALESCE default draft 차단.
    // 정책 개정(2026-07-07, wf_83d2aa9a MAJOR): rowid DESC 타이브레이커 — 0042 트리거·state-machine 과 동시 개정(동시각=삽입순 최후 승).
    expect(APPROVED_NODES_STATUS_CORE).toContain(
      'ROW_NUMBER() OVER (PARTITION BY target_id ORDER BY transitioned_at DESC, rowid DESC) AS rn',
    );
    expect(APPROVED_NODES_STATUS_CORE).toContain(
      "COALESCE(latest.to_status, 'draft') = 'approved'",
    );
    expect(APPROVED_NODES_STATUS_CORE).toContain('kn.is_current_active = 1');
  });

  it('projection 만 호출 측이 주입 — 코어 SQL 불변', () => {
    const a = buildApprovedNodesQuery({ projection: GRAPH_WALK_PROJECTION });
    const b = buildApprovedNodesQuery({ projection: USER_SEARCH_PROJECTION });
    // projection 제거 후 잔여(코어)는 완전히 동일해야 한다.
    expect(a.replace(`SELECT ${GRAPH_WALK_PROJECTION}`, '')).toBe(
      b.replace(`SELECT ${USER_SEARCH_PROJECTION}`, ''),
    );
  });

  it('candidateFilter 는 status 코어 *뒤* AND 결합 (교환법칙 → 결과 집합 불변)', () => {
    const withFilter = buildApprovedNodesQuery({
      projection: USER_SEARCH_PROJECTION,
      candidateFilter: 'kn.id IN (?,?)',
    });
    expect(withFilter.endsWith('AND kn.id IN (?,?)')).toBe(true);
    // 후보 한정은 코어의 status 술어 *다음*에 온다 (status 도출과 무관).
    const coreEnd = withFilter.indexOf("COALESCE(latest.to_status, 'draft') = 'approved'");
    const filterAt = withFilter.indexOf('kn.id IN (?,?)');
    expect(coreEnd).toBeGreaterThan(-1);
    expect(filterAt).toBeGreaterThan(coreEnd);
  });

  it('candidateFilter 미지정/공백 → 코어에서 정확히 종료 (graph-walk anchor = 전체 approved)', () => {
    // 후보 한정 미부착 = SQL 이 status 코어 끝(approved 술어)에서 정확히 종료.
    const noFilter = buildApprovedNodesQuery({ projection: 'kn.id' });
    const blankFilter = buildApprovedNodesQuery({ projection: 'kn.id', candidateFilter: '   ' });
    expect(noFilter.endsWith("COALESCE(latest.to_status, 'draft') = 'approved'")).toBe(true);
    expect(blankFilter.endsWith("COALESCE(latest.to_status, 'draft') = 'approved'")).toBe(true);
    expect(noFilter).toBe(blankFilter);
  });

  it('MATERIALIZED CTE 는 D-2 `AS MATERIALIZED` 강제 + 코어 포함', () => {
    const cte = buildApprovedNodesMaterializedCte('approved', GRAPH_WALK_PROJECTION);
    expect(cte.startsWith('approved AS MATERIALIZED (')).toBe(true);
    expect(cte).toContain(APPROVED_NODES_STATUS_CORE);
    expect(cte.trimEnd().endsWith(')')).toBe(true);
  });
});

// ── S5-5 흡수: 실 SQLite 행동 동치 (string containment 만으로는 불충분) ──
//   quality-engineer C-1 (4 호출 측 approved 집합 동치 미검증) + C-2
//   (MATERIALIZED 행동 동일성 미검증) + backend-architect C-1 (flagged 격리
//   positive 테스트 부재) 흡수. node:sqlite 실 엔진 + 전 migration.
describe('approved-nodes-sql — 실 SQLite 행동 동치 (S5-5 CRITICAL 흡수)', () => {
  let backend: SqliteBackedD1;

  async function insertNode(id: string, name: string, desc: string): Promise<void> {
    await backend.db
      .prepare(
        'INSERT INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, page_ref, book_page, pdf_page, version_year, truth_weight, status) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)',
      )
      .bind(id, 'CONCEPT', name, desc, `p.${id}`, 10, 11, 2026, 5, 'draft')
      .run();
  }
  async function transition(id: string, from: string, to: string, at: string): Promise<void> {
    await backend.db
      .prepare(
        "INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason, transitioned_at) VALUES (?, 'node', ?, ?, ?, 'r', NULL, ?)",
      )
      .bind(`st-${id}-${to}`, id, from, to, at)
      .run();
  }

  beforeEach(async () => {
    backend = createD1FromAllMigrations();
    // 5 상태 픽스처 — 'approved' 1건만 통과해야 한다.
    await insertNode('N-APPROVED', '승인노드', '본문');
    await transition('N-APPROVED', 'draft', 'review', '2026-05-15T00:00:00.000Z');
    await transition('N-APPROVED', 'review', 'approved', '2026-05-15T01:00:00.000Z');
    await insertNode('N-DRAFT', '초안노드', '본문'); // 전이 0 → 'draft' default
    await insertNode('N-REVIEW', '검수노드', '본문');
    await transition('N-REVIEW', 'draft', 'review', '2026-05-15T00:00:00.000Z');
    await insertNode('N-FLAGGED', '격리노드', '본문'); // approved 후 flagged (결함 격리)
    await transition('N-FLAGGED', 'draft', 'review', '2026-05-15T00:00:00.000Z');
    await transition('N-FLAGGED', 'review', 'approved', '2026-05-15T01:00:00.000Z');
    await transition('N-FLAGGED', 'approved', 'flagged', '2026-05-15T02:00:00.000Z');
    await insertNode('N-INACTIVE', '구버전노드', '본문'); // approved 이나 비활성
    await transition('N-INACTIVE', 'draft', 'review', '2026-05-15T00:00:00.000Z');
    await transition('N-INACTIVE', 'review', 'approved', '2026-05-15T01:00:00.000Z');
    await backend.db
      .prepare('UPDATE knowledge_nodes SET is_current_active = 0 WHERE id = ?')
      .bind('N-INACTIVE')
      .run();
  });
  afterEach(() => backend.close());

  const ALL = ['N-APPROVED', 'N-DRAFT', 'N-REVIEW', 'N-FLAGGED', 'N-INACTIVE'];

  it('C-1 — 4 호출 측 형태 전부 동일 approved 집합 {N-APPROVED} (flagged/review/draft/inactive 배제)', async () => {
    // (1) user-search 형태: IN(...) candidateFilter
    const inSql = buildApprovedNodesQuery({
      projection: 'kn.id',
      candidateFilter: `kn.id IN (${ALL.map(() => '?').join(',')})`,
    });
    const r1 = await backend.db
      .prepare(inSql)
      .bind(...ALL)
      .all<{ id: string }>();
    expect((r1.results ?? []).map((x) => x.id).sort()).toEqual(['N-APPROVED']);

    // (2) keyword-fallback 형태: (name LIKE ? OR description LIKE ?) — AND/OR
    //     precedence 안전성 (status 코어 뒤 AND 결합) 실증. 격리(flagged)
    //     노드 이름이 LIKE 매칭돼도 배제돼야 한다.
    const likeSql = buildApprovedNodesQuery({
      projection: 'kn.id',
      candidateFilter: '(kn.name LIKE ? OR kn.description LIKE ?)',
    });
    const r2 = await backend.db.prepare(likeSql).bind('%노드%', '%없음%').all<{ id: string }>();
    expect((r2.results ?? []).map((x) => x.id).sort()).toEqual(['N-APPROVED']);

    // (3) graph-walk 형태: MATERIALIZED CTE 래핑 후 approved 전체
    const cteSql = `WITH ${buildApprovedNodesMaterializedCte('approved', 'kn.id AS id')} SELECT id FROM approved ORDER BY id`;
    const r3 = await backend.db.prepare(cteSql).all<{ id: string }>();
    expect((r3.results ?? []).map((x) => x.id)).toEqual(['N-APPROVED']);

    // (4) topic-cluster 형태: IN(...) 다른 projection — 동일 집합
    const tcSql = buildApprovedNodesQuery({
      projection: 'kn.id, kn.type, kn.name, kn.description, kn.page_ref, kn.truth_weight',
      candidateFilter: `kn.id IN (${ALL.map(() => '?').join(',')})`,
    });
    const r4 = await backend.db
      .prepare(tcSql)
      .bind(...ALL)
      .all<{ id: string }>();
    expect((r4.results ?? []).map((x) => x.id).sort()).toEqual(['N-APPROVED']);
  });

  it('backend C-1 — flagged 노드(active=1, 최신 approved→flagged)는 positively 배제', async () => {
    const sql = buildApprovedNodesQuery({
      projection: 'kn.id',
      candidateFilter: `kn.id = ?`,
    });
    const r = await backend.db.prepare(sql).bind('N-FLAGGED').all<{ id: string }>();
    expect(r.results ?? []).toEqual([]); // flagged ≠ approved — 격리 정책 실증
  });

  it('C-2 — MATERIALIZED vs 非-MATERIALIZED 동일 행 (D-2 keyword 가 결과 불변)', async () => {
    const proj = 'kn.id AS id, kn.type AS type, kn.truth_weight AS tw';
    const matSql = `WITH ${buildApprovedNodesMaterializedCte('approved', proj)} SELECT id, type, tw FROM approved ORDER BY id`;
    // 非물질화 변형 = 동일 코어, MATERIALIZED 키워드만 제거.
    const nonMatSql = `WITH approved AS (${buildApprovedNodesQuery({ projection: proj })}) SELECT id, type, tw FROM approved ORDER BY id`;
    const mat = await backend.db.prepare(matSql).all<{ id: string; type: string; tw: number }>();
    const nonMat = await backend.db
      .prepare(nonMatSql)
      .all<{ id: string; type: string; tw: number }>();
    expect(mat.results ?? []).toEqual(nonMat.results ?? []);
    expect((mat.results ?? []).map((x) => x.id)).toEqual(['N-APPROVED']);
  });
});
