/**
 * draft-loader 테스트 — KnowledgeContract 적재, page_ref 강제, idempotent, SUPERSEDES 기본 흐름.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { KnowledgeContract } from '@thepick/parser';
import { EXAM_IDS } from '@thepick/shared';
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
        id: 'F-99',
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
        target_id: 'F-99',
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
  examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
  batchId: 'BATCH-1',
  batchRunId: 'batch-run-test-0001',
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
      .prepare(
        'SELECT id, page_ref, status, batch_id, batch_run_id, source_id FROM knowledge_nodes WHERE id = ?',
      )
      .get('CONCEPT-001');
    expect(nodeRow).toMatchObject({
      id: 'CONCEPT-001',
      page_ref: '403',
      status: 'draft',
      batch_id: 'BATCH-1',
      batch_run_id: 'batch-run-test-0001',
      source_id: '403#CONCEPT-001',
    });
  });

  it('Step 5 plan v1.1 — batchRunId 누락 시 DraftLoadError (idempotency 키 부재 차단)', async () => {
    await expect(
      loadDraft(ctx.db, minimalContract(), { ...BASE_CTX, batchRunId: '' }),
    ).rejects.toThrow(/batchRunId is required/);
  });

  it('Pass 3 M-1 흡수 — batchRunId safe identifier 패턴 위반 차단 (^[a-zA-Z0-9_-]{8,128}$)', async () => {
    // 길이 부족 (7자)
    await expect(
      loadDraft(ctx.db, minimalContract(), { ...BASE_CTX, batchRunId: 'short01' }),
    ).rejects.toThrow(/safe identifier pattern/);
    // 특수문자 ('!')
    await expect(
      loadDraft(ctx.db, minimalContract(), { ...BASE_CTX, batchRunId: 'batch!run!001' }),
    ).rejects.toThrow(/safe identifier pattern/);
    // 한글 (multi-byte)
    await expect(
      loadDraft(ctx.db, minimalContract(), { ...BASE_CTX, batchRunId: '배치실행001' }),
    ).rejects.toThrow(/safe identifier pattern/);
  });

  it('Pass 3 M-2 흡수 — nodeId ontology-registry 패턴 위반 차단 (schema-validator 우회 fixture 차단)', async () => {
    const c = minimalContract();
    c.nodes[0] = { ...c.nodes[0], id: 'INVALID-001' };
    await expect(loadDraft(ctx.db, c, BASE_CTX)).rejects.toThrow(
      /does not match ontology-registry pattern/,
    );
  });

  it('Step 5 plan v1.1 — source_id 결정성 (`{page_ref}#{node_id}`) 모든 노드 채움', async () => {
    await loadDraft(ctx.db, minimalContract(), BASE_CTX);
    const rows = ctx.raw
      .prepare('SELECT id, source_id, batch_run_id FROM knowledge_nodes ORDER BY id')
      .all() as Array<{ id: string; source_id: string; batch_run_id: string }>;
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.source_id)).toEqual(['403#CONCEPT-001', '414#F-99']);
    for (const row of rows) {
      expect(row.batch_run_id).toBe('batch-run-test-0001');
    }
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

  it('Step 16b 게이트 ⑧ — examId 누락 시 DraftLoadError (Hard Rule 16 시험 경계 강제)', async () => {
    await expect(
      loadDraft(ctx.db, minimalContract(), {
        ...BASE_CTX,
        // @ts-expect-error — 런타임 방어선 테스트 (시그니처 우회 시도)
        examId: '',
      }),
    ).rejects.toThrow(/examId is required.*Hard Rule 16/);
  });

  it('Pass 3 M-1 + R-1 흡수 — batchRunId 에러 메시지에 nanoid hint 포함 (caller UX)', async () => {
    await expect(
      loadDraft(ctx.db, minimalContract(), { ...BASE_CTX, batchRunId: 'short01' }),
    ).rejects.toThrow(/Recommended generators.*crypto\.randomUUID.*nanoid/);
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

  it('node page_ref 트리거 방어선 — 직접 INSERT 는 차단됨 (0010 + 0018 마이그레이션 의도된 redundancy)', () => {
    expect(() =>
      ctx.raw
        .prepare(
          `INSERT INTO knowledge_nodes (id, type, name, version_year, truth_weight, status)
           VALUES ('X-001', 'CONCEPT', '테스트', 2026, 5, 'draft')`,
        )
        .run(),
    ).toThrow(/page_ref is required|Hard Rule 13 violation/);
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
