/**
 * vectorize-upserter 테스트 — 입력 검증, 임베딩 호출, Vectorize upsert, exam_id 자동 주입,
 * Hard Rule 16/17 정합, AppError 전파, idempotency 보장.
 *
 * 근거: docs/plans/phase2a-vectorize-indexing.plan.md §3.3 + §5 Gate 5.3
 */

import { describe, it, expect, vi } from 'vitest';
import { AppError, EXAM_IDS, type ExamId } from '@thepick/shared';
import {
  upsertNodesToVectorize,
  VectorizeUpsertError,
  VECTORIZE_UPSERT_MAX_BATCH_SIZE,
  BGE_M3_DIMENSIONS,
  type AiBinding,
  type VectorizeBinding,
  type NodeForVectorize,
} from '../upserter.js';

function makeEmbedding(seed: number, dim = BGE_M3_DIMENSIONS): number[] {
  const values = new Array<number>(dim);
  for (let i = 0; i < dim; i++) {
    values[i] = ((seed + i) % 1000) / 1000;
  }
  return values;
}

function makeAiMock(
  responses: ReadonlyArray<ReadonlyArray<number>>,
): AiBinding & { run: ReturnType<typeof vi.fn> } {
  const run = vi.fn().mockResolvedValue({
    shape: [responses.length, BGE_M3_DIMENSIONS],
    data: responses,
  });
  return { run };
}

function makeVectorizeMock(
  mutationId = 'mutation-test-001',
): VectorizeBinding & { upsert: ReturnType<typeof vi.fn> } {
  const upsert = vi.fn().mockResolvedValue({ mutationId });
  return { upsert };
}

function makeNode(id: string, opts: Partial<NodeForVectorize> = {}): NodeForVectorize {
  return {
    id,
    text: opts.text ?? `${id} 임베딩 본문`,
    metadata: {
      node_id: id,
      node_type: 'CONCEPT',
      status: 'draft',
      truth_weight: 5,
      revision_year: 2026,
      source_page: 100,
      is_active: true,
      ...(opts.metadata ?? {}),
    },
  };
}

describe('upsertNodesToVectorize — happy path', () => {
  it('2개 노드 임베딩 + upsert → upserted=2, exam_id 자동 주입', async () => {
    const ai = makeAiMock([makeEmbedding(1), makeEmbedding(2)]);
    const vec = makeVectorizeMock('mutation-happy-001');
    const nodes = [
      makeNode('CONCEPT-001'),
      makeNode('LAW-138', {
        metadata: {
          node_type: 'LAW',
          status: 'approved',
          truth_weight: 10,
          revision_year: 2026,
          source_page: 684,
          is_active: true,
          node_id: 'LAW-138',
        },
      }),
    ];

    const result = await upsertNodesToVectorize(vec, ai, EXAM_IDS.SON_HAE_PYEONG_GA_SA, nodes);

    expect(result.upserted).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.mutationId).toBe('mutation-happy-001');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    expect(ai.run).toHaveBeenCalledTimes(1);
    expect(ai.run).toHaveBeenCalledWith('@cf/baai/bge-m3', {
      text: ['CONCEPT-001 임베딩 본문', 'LAW-138 임베딩 본문'],
    });

    expect(vec.upsert).toHaveBeenCalledTimes(1);
    const upserted = vec.upsert.mock.calls[0][0];
    expect(upserted).toHaveLength(2);
    // Hard Rule 16: exam_id 자동 주입 검증
    expect(upserted[0].metadata.exam_id).toBe(EXAM_IDS.SON_HAE_PYEONG_GA_SA);
    expect(upserted[1].metadata.exam_id).toBe(EXAM_IDS.SON_HAE_PYEONG_GA_SA);
    // 차원 검증
    expect(upserted[0].values).toHaveLength(BGE_M3_DIMENSIONS);
    expect(upserted[1].values).toHaveLength(BGE_M3_DIMENSIONS);
  });

  it('빈 노드 리스트 → zero return, AI/Vectorize 미호출', async () => {
    const ai = makeAiMock([]);
    const vec = makeVectorizeMock();
    const result = await upsertNodesToVectorize(vec, ai, EXAM_IDS.SON_HAE_PYEONG_GA_SA, []);
    expect(result).toEqual({
      upserted: 0,
      skipped: 0,
      mutationId: null,
      durationMs: expect.any(Number),
    });
    expect(ai.run).not.toHaveBeenCalled();
    expect(vec.upsert).not.toHaveBeenCalled();
  });
});

describe('upsertNodesToVectorize — 입력 검증 (Hard Rule 16/17 + idempotency)', () => {
  it('examId 빈 문자열 → VectorizeUpsertError(validate)', async () => {
    const ai = makeAiMock([makeEmbedding(1)]);
    const vec = makeVectorizeMock();
    await expect(
      upsertNodesToVectorize(vec, ai, '' as ExamId, [makeNode('CONCEPT-001')]),
    ).rejects.toMatchObject({ name: 'VectorizeUpsertError', phase: 'validate' });
  });

  it(`nodes.length > ${VECTORIZE_UPSERT_MAX_BATCH_SIZE} → VectorizeUpsertError(validate)`, async () => {
    const ai = makeAiMock([]);
    const vec = makeVectorizeMock();
    const nodes = Array.from({ length: VECTORIZE_UPSERT_MAX_BATCH_SIZE + 1 }, (_, i) =>
      makeNode(`CONCEPT-${String(i).padStart(3, '0')}`),
    );
    await expect(
      upsertNodesToVectorize(vec, ai, EXAM_IDS.SON_HAE_PYEONG_GA_SA, nodes),
    ).rejects.toMatchObject({ name: 'VectorizeUpsertError', phase: 'validate' });
  });

  it('동일 batch 내 duplicate id → VectorizeUpsertError(validate)', async () => {
    const ai = makeAiMock([]);
    const vec = makeVectorizeMock();
    const nodes = [makeNode('CONCEPT-001'), makeNode('CONCEPT-001')];
    const promise = upsertNodesToVectorize(vec, ai, EXAM_IDS.SON_HAE_PYEONG_GA_SA, nodes);
    await expect(promise).rejects.toMatchObject({
      name: 'VectorizeUpsertError',
      phase: 'validate',
    });
    await expect(promise).rejects.toThrow(/duplicate node id/);
  });

  it('빈 text → VectorizeUpsertError(validate)', async () => {
    const ai = makeAiMock([]);
    const vec = makeVectorizeMock();
    await expect(
      upsertNodesToVectorize(vec, ai, EXAM_IDS.SON_HAE_PYEONG_GA_SA, [makeNode('X', { text: '' })]),
    ).rejects.toMatchObject({ name: 'VectorizeUpsertError', phase: 'validate' });
  });

  it('빈 node_type → VectorizeUpsertError(validate)', async () => {
    const ai = makeAiMock([]);
    const vec = makeVectorizeMock();
    await expect(
      upsertNodesToVectorize(vec, ai, EXAM_IDS.SON_HAE_PYEONG_GA_SA, [
        makeNode('X', {
          metadata: {
            node_id: 'X',
            node_type: '',
            status: 'draft',
            truth_weight: 5,
            revision_year: 2026,
            source_page: 1,
            is_active: true,
          },
        }),
      ]),
    ).rejects.toMatchObject({ name: 'VectorizeUpsertError', phase: 'validate' });
  });

  it('빈 status → VectorizeUpsertError(validate)', async () => {
    const ai = makeAiMock([]);
    const vec = makeVectorizeMock();
    await expect(
      upsertNodesToVectorize(vec, ai, EXAM_IDS.SON_HAE_PYEONG_GA_SA, [
        makeNode('X', {
          metadata: {
            node_id: 'X',
            node_type: 'CONCEPT',
            status: '',
            truth_weight: 5,
            revision_year: 2026,
            source_page: 1,
            is_active: true,
          },
        }),
      ]),
    ).rejects.toMatchObject({ name: 'VectorizeUpsertError', phase: 'validate' });
  });
});

describe('upsertNodesToVectorize — embed phase 실패', () => {
  it('AI run reject → VectorizeUpsertError(embed) + cause 전파', async () => {
    const cause = new Error('AI binding 503');
    const ai: AiBinding = { run: vi.fn().mockRejectedValue(cause) };
    const vec = makeVectorizeMock();
    try {
      await upsertNodesToVectorize(vec, ai, EXAM_IDS.SON_HAE_PYEONG_GA_SA, [makeNode('X')]);
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(VectorizeUpsertError);
      expect(err).toBeInstanceOf(AppError);
      expect((err as VectorizeUpsertError).phase).toBe('embed');
      expect((err as VectorizeUpsertError).cause).toBe(cause);
    }
  });

  it('AI 응답 길이 불일치 → VectorizeUpsertError(embed)', async () => {
    const ai = makeAiMock([makeEmbedding(1)]); // 1 응답
    const vec = makeVectorizeMock();
    const nodes = [makeNode('A'), makeNode('B')]; // 2 노드 입력
    await expect(
      upsertNodesToVectorize(vec, ai, EXAM_IDS.SON_HAE_PYEONG_GA_SA, nodes),
    ).rejects.toMatchObject({ name: 'VectorizeUpsertError', phase: 'embed' });
  });

  it('AI 응답 차원 불일치 → VectorizeUpsertError(embed)', async () => {
    const ai = makeAiMock([makeEmbedding(1, 512)]); // 512d (잘못)
    const vec = makeVectorizeMock();
    const promise = upsertNodesToVectorize(vec, ai, EXAM_IDS.SON_HAE_PYEONG_GA_SA, [makeNode('A')]);
    await expect(promise).rejects.toMatchObject({ name: 'VectorizeUpsertError', phase: 'embed' });
    await expect(promise).rejects.toThrow(new RegExp(`expected ${BGE_M3_DIMENSIONS}`));
  });
});

describe('upsertNodesToVectorize — upsert phase 실패', () => {
  it('Vectorize upsert reject → VectorizeUpsertError(upsert) + cause 전파', async () => {
    const cause = new Error('Vectorize 502');
    const ai = makeAiMock([makeEmbedding(1)]);
    const vec: VectorizeBinding = { upsert: vi.fn().mockRejectedValue(cause) };
    try {
      await upsertNodesToVectorize(vec, ai, EXAM_IDS.SON_HAE_PYEONG_GA_SA, [makeNode('A')]);
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(VectorizeUpsertError);
      expect((err as VectorizeUpsertError).phase).toBe('upsert');
      expect((err as VectorizeUpsertError).cause).toBe(cause);
    }
  });
});

describe('upsertNodesToVectorize — 메타데이터 정합 (ADR-004 §3)', () => {
  it('optional 필드 (lv1_insurance, lv2_crop, exam_scope) 보존', async () => {
    const ai = makeAiMock([makeEmbedding(1)]);
    const vec = makeVectorizeMock();
    const node: NodeForVectorize = {
      id: 'CROP-RICE-CELL-1',
      text: '벼 표본주수 3구간',
      metadata: {
        node_id: 'CROP-RICE-CELL-1',
        node_type: 'CELL',
        status: 'draft',
        truth_weight: 6,
        revision_year: 2026,
        source_page: 691,
        is_active: true,
        lv1_insurance: '농업재해보험',
        lv2_crop: 'rice',
        exam_scope: '2차_실무',
      },
    };
    await upsertNodesToVectorize(vec, ai, EXAM_IDS.SON_HAE_PYEONG_GA_SA, [node]);

    const upserted = vec.upsert.mock.calls[0][0][0];
    expect(upserted.metadata).toEqual({
      ...node.metadata,
      exam_id: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
    });
  });
});
