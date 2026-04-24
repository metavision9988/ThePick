/**
 * draft-loader 테스트 — KnowledgeContract 적재, page_ref 강제, idempotent, SUPERSEDES 기본 흐름.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { KnowledgeContract } from '@thepick/parser';
import { loadDraft, DraftLoadError } from '../loader/draft-loader';
import { openLocalDb, type LocalD1 } from '../loader/local-db';

function minimalContract(): KnowledgeContract {
  return {
    nodes: [
      {
        id: 'CONCEPT-001',
        type: 'CONCEPT',
        title: '적과전 종합위험',
        content: '적과 전까지 종합위험 방식 적용',
        truth_weight: 5,
        source_page: 403,
      },
      {
        id: 'FORMULA-001',
        type: 'FORMULA',
        title: '유과타박률 산식',
        content: 'F-01 산식 래퍼',
        truth_weight: 8,
        source_page: 414,
      },
    ],
    edges: [
      {
        source_id: 'CONCEPT-001',
        target_id: 'FORMULA-001',
        edge_type: 'USES_FORMULA',
      },
    ],
    formulas: [
      {
        id: 'F-01',
        name: '유과타박률',
        equation_template: 'damaged / (damaged + normal)',
        variables_schema: '{"damaged":"number","normal":"number"}',
        source_page: 414,
      },
    ],
    constants: [
      {
        id: 'CONST-001',
        name: '자기부담비율',
        value: '0.20',
        category: 'deductible',
        source_page: 405,
      },
    ],
  };
}

const BASE_CTX = {
  batchId: 'BATCH-1',
  versionYear: 2026,
  pageRangeStart: 403,
  pageRangeEnd: 434,
  defaultAppliesTo: '적과전종합위험',
  defaultInsuranceType: '농작물재해보험',
} as const;

describe('draft-loader', () => {
  let ctx: LocalD1;

  beforeEach(() => {
    ctx = openLocalDb({ path: ':memory:' });
  });

  afterEach(() => {
    ctx.close();
  });

  it('정상 contract 4개 테이블에 모두 INSERT', async () => {
    const result = await loadDraft(ctx.db, minimalContract(), BASE_CTX);
    expect(result.nodesInserted).toBe(2);
    expect(result.edgesInserted).toBe(1);
    expect(result.formulasInserted).toBe(1);
    expect(result.constantsInserted).toBe(1);
    expect(result.skippedIds).toHaveLength(0);

    const nodeRow = ctx.raw
      .prepare('SELECT id, page_ref, status, batch_id FROM knowledge_nodes WHERE id = ?')
      .get('CONCEPT-001');
    expect(nodeRow).toMatchObject({
      id: 'CONCEPT-001',
      page_ref: '403',
      status: 'draft',
      batch_id: 'BATCH-1',
    });
  });

  it('idempotent — 동일 contract 재적재 시 skip + 카운트 0', async () => {
    await loadDraft(ctx.db, minimalContract(), BASE_CTX);
    const second = await loadDraft(ctx.db, minimalContract(), BASE_CTX);
    expect(second.nodesInserted).toBe(0);
    expect(second.skippedIds.length).toBeGreaterThanOrEqual(2);
  });

  it('node 에 source_page=0 → DraftLoadError (validate phase)', async () => {
    const c = minimalContract();
    c.nodes[0].source_page = 0;
    await expect(loadDraft(ctx.db, c, BASE_CTX)).rejects.toBeInstanceOf(DraftLoadError);
  });

  it('formula 에 source_page 없음 → DraftLoadError', async () => {
    const c = minimalContract();
    // @ts-expect-error — 런타임 방어선 테스트
    c.formulas[0].source_page = undefined;
    await expect(loadDraft(ctx.db, c, BASE_CTX)).rejects.toMatchObject({
      phase: 'validate',
    });
  });

  it('constant 에 source_page 음수 → DraftLoadError', async () => {
    const c = minimalContract();
    c.constants[0].source_page = -1;
    await expect(loadDraft(ctx.db, c, BASE_CTX)).rejects.toThrow(/invalid source_page/);
  });

  it('batchId 비어있으면 DraftLoadError', async () => {
    await expect(
      loadDraft(ctx.db, minimalContract(), { ...BASE_CTX, batchId: '' }),
    ).rejects.toThrow(/batchId is required/);
  });

  it('versionYear < 2020 거부', async () => {
    await expect(
      loadDraft(ctx.db, minimalContract(), { ...BASE_CTX, versionYear: 2015 }),
    ).rejects.toThrow(/versionYear/);
  });

  it('defaultAppliesTo 비어있으면 거부', async () => {
    await expect(
      loadDraft(ctx.db, minimalContract(), { ...BASE_CTX, defaultAppliesTo: '' }),
    ).rejects.toThrow(/defaultAppliesTo/);
  });

  it('node page_ref 트리거 방어선 — 직접 INSERT 는 차단됨 (0010 마이그레이션)', () => {
    expect(() =>
      ctx.raw
        .prepare(
          `INSERT INTO knowledge_nodes (id, type, name, version_year, truth_weight, status)
           VALUES ('X-001', 'CONCEPT', '테스트', 2026, 5, 'draft')`,
        )
        .run(),
    ).toThrow(/page_ref is required/);
  });

  it('빈 contract 도 처리 (nothing to load)', async () => {
    const empty: KnowledgeContract = { nodes: [], edges: [], formulas: [], constants: [] };
    const result = await loadDraft(ctx.db, empty, BASE_CTX);
    expect(result.nodesInserted).toBe(0);
    expect(result.edgesInserted).toBe(0);
    expect(result.formulasInserted).toBe(0);
    expect(result.constantsInserted).toBe(0);
  });
});
