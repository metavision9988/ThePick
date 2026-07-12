/**
 * 마이그레이션 0044 — exam_questions old 행 처분 상태머신 회귀 테스트.
 *
 * 목적: 오답 잔존 old 행(1차·fill_blank·비-MC id)이 0044 적용으로
 *   ① status='deprecated' + valid_until 스탬프 ② -MC 짝 실재 시 superseded_by 백링크
 *   ③ 짝 없으면(구조훼손 클래스) superseded_by NULL ④ 0038 트리거가 byte-동일 정책으로
 *   재생성(전이 후에도 body/state UPDATE ABORT 유지) ⑤ 비대상(2차·MC·기전이 행) 무접촉
 *   을 전부 만족함을 raw D1(node:sqlite) 위에서 검증.
 *
 * 재현 구조: 전 마이그(0044 제외) 적용 → old/MC 시드 → 0044 SQL 원문 적용 → 검산.
 *   (createD1FromAllMigrations 는 빈 DB 라 0044 UPDATE 가 no-op — 전이 검증 불가 →
 *    본 테스트가 0044 의 유일한 전이 재현 지점.)
 *
 * 정책 출처: docs/plans/old-rows-retirement-0044.plan.md (진산 결재 2026-07-12 §9 Q1~Q5).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createD1FromSqlite, type SqliteBackedD1 } from '../helpers/d1-from-sqlite.js';

const MIGRATIONS_DIR = join(__dirname, '../../../../../migrations');
const MIGRATION_0044 = '0044_exam_questions_old_rows_retirement.sql';

let ctx: SqliteBackedD1;

beforeEach(() => {
  const before0044 = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && f < MIGRATION_0044)
    .sort();
  ctx = createD1FromSqlite(before0044);
});

afterEach(() => {
  ctx.close();
});

function seedRow(params: {
  id: string;
  examType?: string;
  inputType?: string;
  status?: string;
  answer?: string;
  distractors?: string | null;
}): void {
  ctx.raw
    .prepare(
      `INSERT INTO exam_questions
         (id, year, round, question_number, subject, content, answer,
          status, exam_type, input_type, distractors)
       VALUES (?, 2023, 9, 1, '상법 보험편', '본문', ?, ?, ?, ?, ?)`,
    )
    .run(
      params.id,
      params.answer ?? '2',
      params.status ?? 'active',
      params.examType ?? '1st',
      params.inputType ?? 'fill_blank',
      params.distractors ?? null,
    );
}

function apply0044(): void {
  ctx.raw.exec(readFileSync(join(MIGRATIONS_DIR, MIGRATION_0044), 'utf-8'));
}

function row(id: string): {
  status: string;
  superseded_by: string | null;
  valid_until: string | null;
} {
  return ctx.raw
    .prepare('SELECT status, superseded_by, valid_until FROM exam_questions WHERE id = ?')
    .get(id) as never;
}

describe('마이그 0044 — old 행 처분 상태머신 (plan §2 목표 상태)', () => {
  it('★전이: -MC 짝 있는 old 행 → deprecated + superseded_by 백링크 + valid_until 스탬프', () => {
    seedRow({ id: 'Q-OLD-1', answer: '2' }); // old (오답 클래스 재현)
    seedRow({ id: 'Q-OLD-1-MC', inputType: 'multiple_choice', distractors: '["a","b","c","d"]' });
    apply0044();
    const r = row('Q-OLD-1');
    expect(r.status).toBe('deprecated');
    expect(r.superseded_by).toBe('Q-OLD-1-MC');
    expect(r.valid_until).not.toBeNull();
    // -MC 서빙 정본은 무접촉
    expect(row('Q-OLD-1-MC').status).toBe('active');
  });

  it('★전이: -MC 짝 없는 old 행(구조훼손 클래스) → deprecated + superseded_by NULL (§9 Q2)', () => {
    seedRow({ id: 'Q-BROKEN-1' });
    apply0044();
    const r = row('Q-BROKEN-1');
    expect(r.status).toBe('deprecated');
    expect(r.superseded_by).toBeNull();
  });

  it('비대상 무접촉: 2차 행 / 1차 MC 행 / 기(旣) deprecated 행 / flagged 행', () => {
    seedRow({ id: 'Q-2ND', examType: '2nd', answer: '서술 정답' });
    seedRow({
      id: 'Q-1ST-MC-ONLY-MC',
      inputType: 'multiple_choice',
      distractors: '["a","b","c","d"]',
    });
    seedRow({ id: 'Q-ALREADY-DEP', status: 'deprecated' });
    seedRow({ id: 'Q-FLAGGED', status: 'flagged' });
    apply0044();
    expect(row('Q-2ND').status).toBe('active');
    expect(row('Q-1ST-MC-ONLY-MC').status).toBe('active');
    expect(row('Q-ALREADY-DEP').superseded_by).toBeNull(); // 기전이 행 재기입 없음
    expect(row('Q-FLAGGED').status).toBe('flagged');
  });

  it('★트리거 재생성: 전이 후에도 0038 정책 불변 — status/answer UPDATE ABORT + 메타 화이트리스트 허용', () => {
    seedRow({ id: 'Q-OLD-2' });
    apply0044();
    // 상태머신 컬럼 UPDATE = ABORT (0038 D-2 default-deny 유지)
    expect(() =>
      ctx.raw.prepare(`UPDATE exam_questions SET status='active' WHERE id='Q-OLD-2'`).run(),
    ).toThrow(/forbidden/);
    expect(() =>
      ctx.raw.prepare(`UPDATE exam_questions SET answer='3' WHERE id='Q-OLD-2'`).run(),
    ).toThrow(/forbidden/);
    // 메타 화이트리스트는 허용 (0038 계약 동일)
    expect(() =>
      ctx.raw
        .prepare(`UPDATE exam_questions SET related_nodes='["LAW-001"]' WHERE id='Q-OLD-2'`)
        .run(),
    ).not.toThrow();
  });

  it('트리거 원문 byte-동일: 0044 재생성 본문 == 0038 원본 CREATE TRIGGER (드리프트 0)', () => {
    const extract = (file: string): string => {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
      const m = sql.match(
        /CREATE TRIGGER IF NOT EXISTS prevent_exam_questions_body_update[\s\S]*?END;/,
      );
      expect(m).not.toBeNull();
      return m![0];
    };
    expect(extract(MIGRATION_0044)).toBe(extract('0038_exam_questions_metadata_update_allow.sql'));
  });

  it('멱등성: 0044 재적용 시 오류 없음 + 결과 불변 (재실행 안전)', () => {
    seedRow({ id: 'Q-OLD-3' });
    seedRow({ id: 'Q-OLD-3-MC', inputType: 'multiple_choice', distractors: '["a","b","c","d"]' });
    apply0044();
    const first = row('Q-OLD-3');
    expect(() => apply0044()).not.toThrow();
    const second = row('Q-OLD-3');
    expect(second.status).toBe(first.status);
    expect(second.superseded_by).toBe(first.superseded_by);
  });
});
