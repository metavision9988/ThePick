/**
 * Phase 1 5-페르소나 CRIT-QPHASE1-3 흡수 — Hard Rule 13 e2e 검증.
 *
 * 마이그레이션 0018_enforce_draft_only_insert.sql 의 두 트리거 동작 검증:
 *   1) prevent_non_draft_insert — status != 'draft' INSERT 차단
 *   2) enforce_page_ref_on_insert — page_ref NULL INSERT 차단
 *
 * 메모리 정합:
 *   - CLAUDE.md Hard Rule 13: AI 생성 데이터는 draft 상태로만 적재
 *   - project_source_citation_requirement: 근거 0건 = approved 차단
 *
 * 근거: .claude/reviews/phase1-tech-debt-20260502-quality.md CRIT-QPHASE1-3
 */

import { describe, expect, it, afterEach } from 'vitest';
import { createD1FromAllMigrations, type SqliteBackedD1 } from '../helpers/d1-from-sqlite.js';

describe('Hard Rule 13 — knowledge_nodes draft-only INSERT 강제 (마이그레이션 0018)', () => {
  let backend: SqliteBackedD1 | null = null;

  afterEach(() => {
    backend?.close();
    backend = null;
  });

  // ADR-030 / migrations/0019: 본 4 테스트는 0018 트리거 (Hard Rule 13 / page_ref) 검증이
  // 목적이므로, book_page / pdf_page 를 명시 채워 0019 트리거를 의도적으로 비켜간다.
  // 0019 자체 검증은 별도 시나리오로 분리 가능 (Phase 2 이월 후보).

  it('status=approved INSERT → trigger ABORT (prevent_non_draft_insert)', async () => {
    backend = await createD1FromAllMigrations();

    await expect(
      backend.db
        .prepare(
          `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page)
           VALUES ('TEST-RULE13-APPROVED', 'CONCEPT', 'test', '교재 1쪽', 2026, 5, 'approved', 1, 1)`,
        )
        .run(),
    ).rejects.toThrow(/Hard Rule 13/);
  });

  it('status=published INSERT → trigger ABORT', async () => {
    backend = await createD1FromAllMigrations();

    await expect(
      backend.db
        .prepare(
          `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page)
           VALUES ('TEST-RULE13-PUBLISHED', 'CONCEPT', 'test', '교재 1쪽', 2026, 5, 'published', 1, 1)`,
        )
        .run(),
    ).rejects.toThrow(/Hard Rule 13/);
  });

  it('page_ref NULL INSERT → trigger ABORT (enforce_page_ref_on_insert)', async () => {
    backend = await createD1FromAllMigrations();

    await expect(
      backend.db
        .prepare(
          `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page)
           VALUES ('TEST-RULE13-NULLPAGE', 'CONCEPT', 'test', NULL, 2026, 5, 'draft', 1, 1)`,
        )
        .run(),
    ).rejects.toThrow(/page_ref/);
  });

  it('status=draft + page_ref 있는 정상 INSERT → 통과', async () => {
    backend = await createD1FromAllMigrations();

    const result = await backend.db
      .prepare(
        `INSERT INTO knowledge_nodes (id, type, name, page_ref, version_year, truth_weight, status, book_page, pdf_page)
         VALUES ('TEST-RULE13-OK', 'CONCEPT', 'test', '교재 100쪽', 2026, 5, 'draft', 100, 107)`,
      )
      .run();
    expect(result.success).toBe(true);

    const row = await backend.db
      .prepare('SELECT id, status, page_ref FROM knowledge_nodes WHERE id = ?')
      .bind('TEST-RULE13-OK')
      .first<{ id: string; status: string; page_ref: string }>();
    expect(row).not.toBeNull();
    expect(row?.status).toBe('draft');
    expect(row?.page_ref).toBe('교재 100쪽');
  });

  it('두 트리거 등록 확인 (운영 무결성 검증)', async () => {
    backend = await createD1FromAllMigrations();

    const triggers = await backend.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='trigger'
         AND name IN ('prevent_non_draft_insert', 'enforce_page_ref_on_insert')
         ORDER BY name`,
      )
      .all<{ name: string }>();
    expect(triggers.results).toHaveLength(2);
    expect(triggers.results.map((r) => r.name).sort()).toEqual([
      'enforce_page_ref_on_insert',
      'prevent_non_draft_insert',
    ]);
  });
});
