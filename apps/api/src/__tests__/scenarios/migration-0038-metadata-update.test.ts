/**
 * 마이그레이션 0038 — exam_questions 메타데이터 UPDATE 허용 (TR-0) 회귀 테스트.
 *
 * 목적: 0004 전면 ABORT → 0038 default-deny(보호 16 ABORT / 메타 화이트리스트 6 허용)
 *   재설계가 raw D1(node:sqlite + foreign_keys=ON, 전 마이그 자동 적용) 위에서 정확히
 *   동작함을 검증. related_nodes 백필은 허용하되 본문/상태/답안안전/불변 보호는 유지.
 *
 * 정책 출처: docs/adr/ADR-046-exam-questions-metadata-update-policy.md (진산 결재 2026-05-29)
 *   plan: docs/plans/tr-0-backend-c7-trigger-redesign.plan.md §5.1 G-TR0-1~12
 *
 * 하네스: createD1FromAllMigrations() — readdir 자동(0038 포함). G-TR0-12 정합
 *   (SCENARIO_MIGRATIONS 큐레이션 배열 미사용 — 0038 누락 위양성 차단).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createD1FromAllMigrations, type SqliteBackedD1 } from '../helpers/d1-from-sqlite.js';

const SEED_ID = 'Q-TEST-0038-001';

/** 보호(ABORT) 컬럼 — 본문 8 + 상태 4 + 답안안전 2 + 불변 2 = 16. */
const BODY_IMMUTABLE = [
  ['content', `'바뀐 본문'`],
  ['answer', `'②'`],
  ['explanation', `'바뀐 해설'`],
  ['subject', `'바뀐 과목'`],
  ['year', `2020`],
  ['round', `6`],
  ['question_number', `99`],
  ['exam_type', `'1st'`],
  ['id', `'Q-TEST-0038-RENAMED'`],
  ['created_at', `'2099-01-01T00:00:00Z'`],
] as const;
const STATE_MACHINE = [
  ['status', `'deprecated'`],
  ['superseded_by', `'Q-OTHER'`],
  ['valid_until', `'2030-01-01'`],
  ['valid_from', `'2030-01-01'`],
] as const;
const ANSWER_SAFETY = [
  ['distractors', `'["오답1","오답2","오답3","오답4"]'`],
  ['calc_variables', `'{"x":1}'`],
] as const;
/** 허용(메타 화이트리스트) 6. confusion_type/input_type 은 실제 유효값 사용. */
const WHITELIST = [
  ['related_nodes', `'["LAW-002"]'`],
  ['related_constants', `'["CONST-01"]'`],
  ['topic_cluster', `'TC-001'`],
  ['memorization_type', `'acronym'`],
  ['confusion_type', `'numeric'`],
  ['input_type', `'fill_blank'`],
] as const;

async function seed(backend: SqliteBackedD1, id: string = SEED_ID): Promise<void> {
  await backend.db
    .prepare(
      `INSERT INTO exam_questions
         (id, year, round, question_number, subject, content, answer, explanation,
          status, exam_type, topic_cluster, memorization_type, confusion_type, input_type,
          related_nodes, related_constants, distractors, calc_variables, created_at)
       VALUES
         (?, 2019, 5, 31, '농어업재해보험법령', '문제 본문 원문', '①', '해설 원문',
          'active', '2nd', NULL, NULL, NULL, 'multiple_choice',
          NULL, NULL, NULL, NULL, '2026-01-01T00:00:00Z')`,
    )
    .bind(id)
    .run();
}

describe('마이그레이션 0038 — exam_questions 메타데이터 UPDATE 정책 (TR-0 / ADR-046)', () => {
  let backend: SqliteBackedD1 | null = null;

  beforeEach(async () => {
    backend = createD1FromAllMigrations();
    await seed(backend);
  });

  afterEach(() => {
    backend?.close();
    backend = null;
  });

  // ── G-TR0-6: 트리거 교체 검증 (fail-open 차단) ──
  it('G-TR0-6 — 신 trigger 존재 AND 구 trigger 부재 (no-op/생성실패 위양성 차단)', async () => {
    if (!backend) throw new Error('backend not initialized');
    const present = await backend.db
      .prepare(
        `SELECT COUNT(*) AS c FROM sqlite_master WHERE type='trigger' AND name='prevent_exam_questions_body_update'`,
      )
      .first<{ c: number }>();
    const old = await backend.db
      .prepare(
        `SELECT COUNT(*) AS c FROM sqlite_master WHERE type='trigger' AND name='prevent_exam_questions_update'`,
      )
      .first<{ c: number }>();
    expect(present?.c).toBe(1);
    expect(old?.c).toBe(0);
  });

  // ── G-TR0-1: 본문 8 + 불변 2 = 10 컬럼 단독 UPDATE ABORT ──
  it.each(BODY_IMMUTABLE)('G-TR0-1 — 본문/불변 컬럼 [%s] 단독 UPDATE ABORT', async (col, val) => {
    if (!backend) throw new Error('backend not initialized');
    await expect(
      backend.db
        .prepare(`UPDATE exam_questions SET ${col} = ${val} WHERE id = ?`)
        .bind(SEED_ID)
        .run(),
    ).rejects.toThrow(/forbidden|ADR-046/i);
  });

  // ── G-TR0-4: 상태 머신 4 컬럼 ABORT (D-2 = status 동결 유지) ──
  it.each(STATE_MACHINE)('G-TR0-4 — 상태머신 컬럼 [%s] UPDATE ABORT (D-2)', async (col, val) => {
    if (!backend) throw new Error('backend not initialized');
    await expect(
      backend.db
        .prepare(`UPDATE exam_questions SET ${col} = ${val} WHERE id = ?`)
        .bind(SEED_ID)
        .run(),
    ).rejects.toThrow(/forbidden|ADR-046/i);
  });

  // ── G-TR0-9: 답안안전 2 컬럼(distractors/calc_variables) ABORT (default-deny 자동 보호) ──
  it.each(ANSWER_SAFETY)(
    'G-TR0-9 — 답안안전 컬럼 [%s] UPDATE ABORT (D-1 default-deny / D-3)',
    async (col, val) => {
      if (!backend) throw new Error('backend not initialized');
      await expect(
        backend.db
          .prepare(`UPDATE exam_questions SET ${col} = ${val} WHERE id = ?`)
          .bind(SEED_ID)
          .run(),
      ).rejects.toThrow(/forbidden|ADR-046/i);
    },
  );

  // ── G-TR0-2: 메타 화이트리스트 6 컬럼 단독 UPDATE 성공 + 값 반영 ──
  it.each(WHITELIST)('G-TR0-2 — 메타 화이트리스트 [%s] 단독 UPDATE 성공', async (col, val) => {
    if (!backend) throw new Error('backend not initialized');
    await backend.db
      .prepare(`UPDATE exam_questions SET ${col} = ${val} WHERE id = ?`)
      .bind(SEED_ID)
      .run();
    const row = await backend.db
      .prepare(`SELECT ${col} AS v FROM exam_questions WHERE id = ?`)
      .bind(SEED_ID)
      .first<{ v: string }>();
    expect(row?.v).toBe(val.replace(/^'|'$/g, ''));
  });

  // ── G-TR0-3: 혼합 UPDATE(본문+메타) ABORT + NULL-safe ──
  it('G-TR0-3 — 혼합 UPDATE(related_nodes + content) ABORT (보안 회피 차단)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await expect(
      backend.db
        .prepare(
          `UPDATE exam_questions SET related_nodes = '["LAW-002"]', content = '변조' WHERE id = ?`,
        )
        .bind(SEED_ID)
        .run(),
    ).rejects.toThrow(/forbidden|ADR-046/i);
    // 혼합 ABORT 시 related_nodes 도 반영 안 됨 (statement 전체 롤백)
    const row = await backend.db
      .prepare(`SELECT related_nodes AS rn, content AS c FROM exam_questions WHERE id = ?`)
      .bind(SEED_ID)
      .first<{ rn: string | null; c: string }>();
    expect(row?.rn).toBeNull();
    expect(row?.c).toBe('문제 본문 원문');
  });

  it('G-TR0-3 — NULL-safe: nullable 본문(answer) NULL↔값 전이도 ABORT (IS NOT)', async () => {
    if (!backend) throw new Error('backend not initialized');
    // answer 를 NULL 로 만든 행을 별도 seed (whitelist 경로로는 answer 를 못 바꾸므로 INSERT 로)
    await backend.db
      .prepare(
        `INSERT INTO exam_questions (id, year, content, answer, status, exam_type, input_type, created_at)
         VALUES ('Q-TEST-0038-NULLANS', 2019, '본문', NULL, 'active', '2nd', 'fill_blank', '2026-01-01T00:00:00Z')`,
      )
      .run();
    await expect(
      backend.db
        .prepare(`UPDATE exam_questions SET answer = '①' WHERE id = 'Q-TEST-0038-NULLANS'`)
        .run(),
    ).rejects.toThrow(/forbidden|ADR-046/i);
  });

  // ── G-TR0-10: backfill 의도 — NULL→값(백필) + 값→값(덮어쓰기) 모두 허용 ──
  it('G-TR0-10 — related_nodes NULL→값(백필) 및 값→값(덮어쓰기) 허용', async () => {
    if (!backend) throw new Error('backend not initialized');
    await backend.db
      .prepare(`UPDATE exam_questions SET related_nodes = '["LAW-002"]' WHERE id = ?`)
      .bind(SEED_ID)
      .run();
    await backend.db
      .prepare(`UPDATE exam_questions SET related_nodes = '["LAW-003","LAW-004"]' WHERE id = ?`)
      .bind(SEED_ID)
      .run();
    const row = await backend.db
      .prepare(`SELECT related_nodes AS rn FROM exam_questions WHERE id = ?`)
      .bind(SEED_ID)
      .first<{ rn: string }>();
    expect(row?.rn).toBe('["LAW-003","LAW-004"]');
  });

  // ── G-TR0-5: 행 수 보존 (whitelist UPDATE 후 count 불변) ──
  it('G-TR0-5 — 메타 UPDATE 후 행 수 보존', async () => {
    if (!backend) throw new Error('backend not initialized');
    const before = await backend.db
      .prepare(`SELECT COUNT(*) AS c FROM exam_questions`)
      .first<{ c: number }>();
    await backend.db
      .prepare(`UPDATE exam_questions SET related_nodes = '["LAW-002"]' WHERE id = ?`)
      .bind(SEED_ID)
      .run();
    const after = await backend.db
      .prepare(`SELECT COUNT(*) AS c FROM exam_questions`)
      .first<{ c: number }>();
    expect(after?.c).toBe(before?.c);
  });

  // ── G-TR0-11: 멀티행 원자성 — 1행이라도 본문 변동 시 전체 ABORT, 어떤 행도 미변경 ──
  it('G-TR0-11 — 멀티행 단일 UPDATE 본문 변동 시 전체 ABORT (원자성)', async () => {
    if (!backend) throw new Error('backend not initialized');
    await seed(backend, 'Q-TEST-0038-002');
    await expect(
      backend.db.prepare(`UPDATE exam_questions SET content = '일괄변조'`).run(),
    ).rejects.toThrow(/forbidden|ADR-046/i);
    const rows = await backend.db
      .prepare(`SELECT content AS c FROM exam_questions WHERE id IN (?, ?)`)
      .bind(SEED_ID, 'Q-TEST-0038-002')
      .all<{ c: string }>();
    expect(rows.results.every((r) => r.c === '문제 본문 원문')).toBe(true);
  });
});
