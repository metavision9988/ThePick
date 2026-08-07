/**
 * 마이그레이션 0046 — 세 번째 문(전이 선행 우회) 봉쇄 회귀 테스트.
 *
 * 출처: .claude/reviews/review-20260807-5persona-0045.md (5-페르소나 독립 병렬 리뷰).
 *   3개 렌즈가 서로 모르는 채 같은 구멍에 수렴했고 메인 세션이 직접 재현했다:
 *     ①노드 부재 상태로 approved 전이 INSERT (0045 [A] 의 EXISTS 가 거짓 → 통과)
 *     ②그 id 로 미시행 노드 INSERT (0045 는 INSERT 무대상 → 통과)
 *     ③SUPERSEDES 엣지 INSERT → 0042 [1] 이 도출 status 만 보고 구본 은퇴
 *     ⇒ blackout, 그리고 0039 부활 차단으로 복구 불가.
 *
 * 본 파일이 고정하는 것:
 *   [C-1] 승계자가 오늘 유효하지 않으면 구본을 은퇴시키지 못한다 (0042 [1] 재생성)
 *   [C-2] 이미 approved 전이가 있는 id 는 오늘 무효인 행으로 INSERT 될 수 없다 (3종 대칭)
 *   그리고 **정상 경로 무회귀** — 오늘 유효한 승계자는 종전대로 구본을 은퇴시킨다.
 *
 * ★ 판정은 트리거 동작이 아니라 **서빙 코어(단일 진실원)의 결과 집합**으로 확인한다.
 *   blackout 0 · 구·신 동시 노출 0 이 이 마이그의 존재 이유이기 때문이다.
 *
 * 시각 의존: 픽스처 날짜는 KST 오늘 기준 상대값 (하드코딩 날짜는 그날이 지나면 의미가 뒤집힌다).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createD1FromAllMigrations,
  createD1FromSqlite,
  SCENARIO_MIGRATIONS,
  type SqliteBackedD1,
} from '../helpers/d1-from-sqlite.js';
import { buildApprovedNodesQuery } from '../../search/approved-nodes-sql.js';

function kstShift(days: number): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000 + days * 86_400_000).toISOString().slice(0, 10);
}

const TODAY = kstShift(0);
const FUTURE = kstShift(30);
const PAST = kstShift(-30);

let seq = 0;

async function insertNode(
  backend: SqliteBackedD1,
  id: string,
  validFrom: string | null = null,
  validUntil: string | null = null,
): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page, valid_from, valid_until)
       VALUES (?, 'LAW', ?, '법 제1조', 2026, 10, 'draft', 1, 1, ?, ?)`,
    )
    .bind(id, `노드 ${id}`, validFrom, validUntil)
    .run();
}

async function insertFormula(
  backend: SqliteBackedD1,
  id: string,
  validFrom: string | null = null,
): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO formulas (id, name, equation_template, variables_schema, version_year, page_ref, valid_from)
       VALUES (?, '테스트 산식', 'a * b', '{}', 2026, 'p.1', ?)`,
    )
    .bind(id, validFrom)
    .run();
}

async function insertConstant(
  backend: SqliteBackedD1,
  id: string,
  validFrom: string | null = null,
): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO constants (id, category, name, value, applies_to, version_year, page_ref, valid_from)
       VALUES (?, 'ratio', '테스트 상수', '65', '전체', 2026, 'p.1', ?)`,
    )
    .bind(id, validFrom)
    .run();
}

async function transition(
  backend: SqliteBackedD1,
  targetId: string,
  toStatus: string,
  targetType = 'node',
): Promise<void> {
  seq += 1;
  await backend.db
    .prepare(
      `INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, transitioned_at)
       VALUES (?, ?, ?, 'draft', ?, 'jinsan', ?)`,
    )
    .bind(
      `ST-${targetId}-${seq}`,
      targetType,
      targetId,
      toStatus,
      `2026-08-07T00:00:${String(seq).padStart(2, '0')}.000Z`,
    )
    .run();
}

async function supersedes(
  backend: SqliteBackedD1,
  newId: string,
  oldId: string,
  isActive = 1,
): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, is_active)
       VALUES (?, ?, ?, 'SUPERSEDES', ?)`,
    )
    .bind(`EDGE-${newId}-${oldId}`, newId, oldId, isActive)
    .run();
}

async function servedNodeIds(backend: SqliteBackedD1): Promise<string[]> {
  const sql = `${buildApprovedNodesQuery({ projection: 'kn.id AS id' })} ORDER BY kn.id`;
  const res = await backend.db.prepare(sql).all<{ id: string }>();
  return (res.results ?? []).map((r) => r.id);
}

async function isActive(backend: SqliteBackedD1, id: string): Promise<number | null> {
  const row = await backend.db
    .prepare('SELECT is_current_active AS a FROM knowledge_nodes WHERE id = ?')
    .bind(id)
    .first<{ a: number }>();
  return row?.a ?? null;
}

describe('마이그레이션 0046 [C-2] INSERT 게이트 — 승인 기록이 앞선 미발효 행 차단', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(() => {
    backend = createD1FromAllMigrations();
    seq = 0;
  });
  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('G-0046-1a — approved 전이가 선행한 id 로 미래 valid_from 노드 INSERT = ABORT', async () => {
    if (!backend) throw new Error('backend not initialized');
    await transition(backend, 'NODE-GHOST', 'approved');
    await expect(insertNode(backend, 'NODE-GHOST', FUTURE)).rejects.toThrow(/Insert blocked/);
  });

  it('G-0046-1b — 같은 조건에서 과거 valid_until 도 ABORT (반개구간 반대쪽 대칭)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await transition(backend, 'NODE-EXPIRED', 'approved');
    await expect(insertNode(backend, 'NODE-EXPIRED', null, PAST)).rejects.toThrow(/Insert blocked/);
  });

  it('G-0046-1c — 해석 불가 날짜도 ABORT (fail-closed — 서빙 창과 같은 방향)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await transition(backend, 'NODE-GARBAGE', 'approved');
    await expect(insertNode(backend, 'NODE-GARBAGE', '언젠가')).rejects.toThrow(/Insert blocked/);
  });

  it('G-0046-2 — ★무회귀: 전이 이력이 없으면(정상 순서) 미시행 노드 INSERT 는 자유', async () => {
    if (!backend) throw new Error('backend not initialized');
    // 개정본을 미리 만들어 두는 정상 경로 — 막으면 안 된다.
    await insertNode(backend, 'NODE-DRAFT-FUTURE', FUTURE);
    expect(await isActive(backend, 'NODE-DRAFT-FUTURE')).toBe(1);
    // valid_* 가 NULL 인 현 production 전량도 무회귀
    await insertNode(backend, 'NODE-NULLS');
    expect(await isActive(backend, 'NODE-NULLS')).toBe(1);
  });

  it('G-0046-3 — 전이가 approved 가 아니면(review/flagged) 미발화', async () => {
    if (!backend) throw new Error('backend not initialized');
    await transition(backend, 'NODE-REVIEW', 'review');
    await insertNode(backend, 'NODE-REVIEW', FUTURE);
    expect(await isActive(backend, 'NODE-REVIEW')).toBe(1);
  });

  it('G-0046-4 — formula·constant 대칭 (차단 + 정상 경로 통과)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await transition(backend, 'F-GHOST', 'approved', 'formula');
    await expect(insertFormula(backend, 'F-GHOST', FUTURE)).rejects.toThrow(/Insert blocked/);
    await transition(backend, 'C-GHOST', 'approved', 'constant');
    await expect(insertConstant(backend, 'C-GHOST', FUTURE)).rejects.toThrow(/Insert blocked/);
    // 전이 없는 정상 순서는 통과
    await insertFormula(backend, 'F-OK', FUTURE);
    await insertConstant(backend, 'C-OK', FUTURE);
  });
});

describe('마이그레이션 0046 [C-1] 승계 은퇴 게이트 — 미발효 승계자는 구본을 은퇴시키지 못한다', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(() => {
    backend = createD1FromAllMigrations();
    seq = 0;
  });
  afterEach(() => {
    backend?.close();
    backend = null;
  });

  it('G-0046-5 — ★세 번째 문 e2e: 전이 선행 우회를 시도해도 서빙이 비지 않는다', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'LAW-OLD');
    await transition(backend, 'LAW-OLD', 'approved');
    expect(await servedNodeIds(backend)).toEqual(['LAW-OLD']);

    // ① 전이 선행 (0045 [A] 는 대상 부재라 통과 — 참조 무결성 담당이 아니라는 설계 그대로)
    await transition(backend, 'LAW-NEW', 'approved');
    // ② 미시행 노드 INSERT → [C-2] 가 여기서 잘라낸다
    await expect(insertNode(backend, 'LAW-NEW', FUTURE)).rejects.toThrow(/Insert blocked/);
    // ③ 노드 자체가 없으므로 엣지도 못 건다(FK) — 서빙은 구본 단독 유지 = blackout 0
    expect(await servedNodeIds(backend)).toEqual(['LAW-OLD']);
    expect(await isActive(backend, 'LAW-OLD')).toBe(1);
  });

  it('G-0046-6 — ★0045 미적용 DB(전이 선행 순서)에서도 미발효 승계자는 은퇴를 못 일으킨다', async () => {
    // 이 케이스만 **0045 를 뺀 DB** 를 쓴다. 이유: "승인됐지만 미발효" 행은 0045 [A] 적용 후에는
    // 구성 자체가 불가능하고(그게 [A] 의 목적), 그러나 **0045 적용 전에 이미 생긴 행**과
    // 0045 미적용 환경(2호 초기 D1·staging·백업 복원본)에는 실재할 수 있다.
    // 그 상태에서 [C-1] 이 마지막 방어선인지를 본다.
    // ★테스트 안에서 트리거를 DROP 하지 않는다 — fixture 구성으로 의도를 드러낸다.
    const legacy = createD1FromSqlite(SCENARIO_MIGRATIONS.filter((m) => !m.startsWith('0045_')));
    try {
      await insertNode(legacy, 'LAW-OLD2');
      await transition(legacy, 'LAW-OLD2', 'approved');
      await insertNode(legacy, 'LAW-NEW2', FUTURE);
      await transition(legacy, 'LAW-NEW2', 'approved'); // 0045 부재 → 통과 = 선재 상태 재현
      await supersedes(legacy, 'LAW-NEW2', 'LAW-OLD2');

      // ★[C-1]: 승계자가 오늘 유효하지 않으므로 구본은 살아 있어야 한다
      expect(await isActive(legacy, 'LAW-OLD2')).toBe(1);
      expect(await servedNodeIds(legacy)).toEqual(['LAW-OLD2']); // blackout 0
    } finally {
      legacy.close();
    }
  });

  it('G-0046-9 — ★2R MAJOR: 엣지 선행 → 나중 승격(0042[2] 경로)에서도 blackout 0', async () => {
    // 1R 의 0046 은 [1](엣지 INSERT)에만 조건을 달아 [2](승격 flip)가 열려 있었다.
    // AI draft 표준 워크플로가 바로 이 순서(엣지 선작성 → 검수 → 승격)라 오히려 더 흔하다.
    // 0045 를 뺀 DB 로 "0045 미적용 환경"을 구성해 [C-3] 이 단독 방어선인지 본다.
    const legacy = createD1FromSqlite(SCENARIO_MIGRATIONS.filter((m) => !m.startsWith('0045_')));
    try {
      await insertNode(legacy, 'LAW-OLD9');
      await transition(legacy, 'LAW-OLD9', 'approved');
      await insertNode(legacy, 'LAW-NEW9', FUTURE);
      await supersedes(legacy, 'LAW-NEW9', 'LAW-OLD9'); // 엣지 먼저
      await transition(legacy, 'LAW-NEW9', 'approved'); // 승격 나중 → 0042[2] 발화 시도

      expect(await isActive(legacy, 'LAW-OLD9')).toBe(1);
      expect(await servedNodeIds(legacy)).toEqual(['LAW-OLD9']); // blackout 0
    } finally {
      legacy.close();
    }
  });

  it('G-0046-10 — ★2R MAJOR: 비활성(is_current_active=0) 승계자는 구본을 은퇴시키지 못한다', async () => {
    if (!backend) throw new Error('backend not initialized');
    // INSERT 시 is_current_active 에는 어떤 가드도 없다(손작성 --file 경로가 실재).
    // 조건이 valid_* 뿐이면 approved·오늘 유효라 EXISTS 를 통과해 구본만 은퇴 = 구 0·신 0.
    await insertNode(backend, 'LAW-OLD10');
    await transition(backend, 'LAW-OLD10', 'approved');
    await backend.db
      .prepare(
        `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page, is_current_active)
         VALUES ('LAW-NEW10', 'LAW', '노드 LAW-NEW10', '법 제1조', 2026, 10, 'draft', 1, 1, 0)`,
      )
      .run();
    await transition(backend, 'LAW-NEW10', 'approved');
    await supersedes(backend, 'LAW-NEW10', 'LAW-OLD10');

    expect(await isActive(backend, 'LAW-OLD10')).toBe(1);
    expect(await servedNodeIds(backend)).toEqual(['LAW-OLD10']); // blackout 0
  });

  it('G-0046-7 — ★무회귀: 오늘 유효한 승계자는 종전대로 구본을 은퇴시킨다 (서빙 = 신본 단독)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await insertNode(backend, 'LAW-OLD3');
    await transition(backend, 'LAW-OLD3', 'approved');
    await insertNode(backend, 'LAW-NEW3', TODAY);
    await transition(backend, 'LAW-NEW3', 'approved');
    await supersedes(backend, 'LAW-NEW3', 'LAW-OLD3');

    expect(await isActive(backend, 'LAW-OLD3')).toBe(0);
    expect(await servedNodeIds(backend)).toEqual(['LAW-NEW3']); // 동시 노출 0
  });

  it('G-0046-11 — ★3R: 승격 순서가 계보 순서와 다르면 구식 원본이 함께 노출된다 (택한 대가 고정)', async () => {
    if (!backend) throw new Error('backend not initialized');
    // A sup B sup C 에서 최신본 A 가 **먼저** 승인되면 B 는 그 시점에 은퇴한다. 이후 B 를 승격해도
    // [C-1]/[C-3] 의 is_current_active=1 조건 때문에 B 는 C 를 은퇴시키지 못한다 → 서빙 = [A, C].
    // 0046 이전에는 [A] 단독이었다. 즉 **stale 노출은 0046 이 만든 대가**다.
    // 조건을 빼면 반대로 blackout 이 나므로(G-0046-10) 알고 택한 트레이드오프이며,
    // 이 테스트는 그 사실을 "몰랐다"가 아니라 "고정했다"로 남기기 위한 것이다.
    await insertNode(backend, 'N-C');
    await transition(backend, 'N-C', 'approved');
    await insertNode(backend, 'N-B');
    await insertNode(backend, 'N-A');
    await transition(backend, 'N-A', 'approved'); // 최신본 먼저 승인
    await supersedes(backend, 'N-A', 'N-B'); // A sup B → B 은퇴
    expect(await isActive(backend, 'N-B')).toBe(0);

    await supersedes(backend, 'N-B', 'N-C'); // B sup C (B 는 이미 비활성)
    await transition(backend, 'N-B', 'approved'); // 뒤늦은 B 승격

    // ★현재 동작: C 가 은퇴하지 않아 A 와 함께 노출된다
    expect(await isActive(backend, 'N-C')).toBe(1);
    expect(await servedNodeIds(backend)).toEqual(['N-A', 'N-C']);
    // blackout 은 아니다 — 최신본 A 는 살아 있다
    expect(await isActive(backend, 'N-A')).toBe(1);
  });

  it('G-0046-8 — 트리거 5종 실재 + [C-1]·[C-3] 이 승계자 유효성 조건을 담고 있다', async () => {
    if (!backend) throw new Error('backend not initialized');
    const res = await backend.db
      .prepare(
        `SELECT name, sql FROM sqlite_master
          WHERE type='trigger'
            AND (name LIKE 'enforce_insert_within_effectivity_%'
                 OR name IN ('mav_supersedes_knowledge_nodes_deactivate',
                             'mav_promotion_flip_superseded_nodes'))
          ORDER BY name`,
      )
      .all<{ name: string; sql: string }>();
    const rows = res.results ?? [];
    expect(rows.map((r) => r.name)).toEqual([
      'enforce_insert_within_effectivity_constants',
      'enforce_insert_within_effectivity_formulas',
      'enforce_insert_within_effectivity_nodes',
      'mav_promotion_flip_superseded_nodes',
      'mav_supersedes_knowledge_nodes_deactivate',
    ]);
    for (const r of rows) {
      // 서빙 코어 미러 구성요소 (fail-open 차단 + KST + 포맷 내성)
      expect(r.sql, `${r.name}: KST 보정 부재`).toMatch(/\+9 hours/);
      expect(r.sql, `${r.name}: date\\(\\) 정규화 부재`).toMatch(/date\(/);
      expect(r.sql, `${r.name}: COALESCE 3값 논리 붕괴 부재`).toMatch(/COALESCE\(/);
    }
    // ★0046 의 핵심 — 재생성된 은퇴 트리거 **양쪽 모두** 승계자 유효성 EXISTS 를 포함해야 한다.
    //   (0042 원본에는 이 절이 없다. red 면 0046 이 유실됐거나 0042 재실행으로 revert 된 것 —
    //    0042 를 나중에 재실행하면 무음 revert 되므로 이 단언이 그 유일한 경보다.)
    for (const name of [
      'mav_supersedes_knowledge_nodes_deactivate',
      'mav_promotion_flip_superseded_nodes',
    ]) {
      const t = rows.find((r) => r.name === name);
      expect(t?.sql, `${name}: 유효성 EXISTS 부재`).toMatch(
        /EXISTS\s*\(\s*SELECT 1 FROM knowledge_nodes/,
      );
      expect(t?.sql, `${name}: is_current_active 조건 부재`).toMatch(/kn\.is_current_active = 1/);
      expect(t?.sql, `${name}: rowid 타이브레이커 부재`).toMatch(/rowid DESC/);
    }
  });
});
