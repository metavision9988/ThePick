/**
 * topic-cluster-router 단위 테스트 — Multi-Path Fallback Stage 3 (D-MPF-2=A).
 */

import { describe, expect, it, vi } from 'vitest';
import { EXAM_IDS } from '@thepick/shared';
import { runTopicClusterRouting } from '../topic-cluster-router.js';
import type { UserSearchD1, VectorizeQueryBinding } from '../../user-search.js';

const exam = EXAM_IDS.SON_HAE_PYEONG_GA_SA;
const BGE_M3_DIM = 1024;

interface ClusterRow {
  id: string;
  name: string;
  lv1: string | null;
  lv2: string | null;
  lv3: string | null;
  exam_frequency: number;
}

interface KnRow {
  id: string;
  type: string;
  name: string;
  description: string | null;
  page_ref: string | null;
  truth_weight: number;
}

function makeMockVectorize(matches: Array<{ id: string; score: number }>): VectorizeQueryBinding {
  const upsert = vi.fn();
  const query = vi.fn(async () => ({ count: matches.length, matches }));
  return { upsert, query } as unknown as VectorizeQueryBinding;
}

function makeMockD1(
  clusters: ReadonlyArray<ClusterRow>,
  nodes: ReadonlyArray<KnRow>,
): UserSearchD1 {
  return {
    prepare(sql: string) {
      const isClusterQuery = sql.includes('topic_clusters');
      const isNodeQuery = sql.includes('knowledge_nodes');
      return {
        bind(...params: unknown[]) {
          return {
            async all<T>(): Promise<{ results: ReadonlyArray<T> }> {
              if (isClusterQuery) {
                const ids = new Set(params as string[]);
                const filtered = clusters.filter((c) => ids.has(c.id));
                return { results: filtered as unknown as ReadonlyArray<T> };
              }
              if (isNodeQuery) {
                const lv1 = params[0] as string;
                // mock: 단순 일치 (전부 반환). 실제 SQL 은 lv1_insurance OR lv2_crop 매칭.
                const filtered = nodes.filter(
                  (n) => n.name.includes(lv1) || (n.description ?? '').includes(lv1),
                );
                return { results: filtered as unknown as ReadonlyArray<T> };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

describe('runTopicClusterRouting', () => {
  const queryEmbedding = new Array<number>(BGE_M3_DIM).fill(0.5);

  it('Hard Rule 16: examId 빈 문자열 throw', async () => {
    const v = makeMockVectorize([]);
    const d = makeMockD1([], []);
    await expect(runTopicClusterRouting(v, d, '' as never, queryEmbedding)).rejects.toThrow(
      /Hard Rule 16/,
    );
  });

  it('queryEmbedding 차원 0 throw', async () => {
    const v = makeMockVectorize([]);
    const d = makeMockD1([], []);
    await expect(runTopicClusterRouting(v, d, exam, [])).rejects.toThrow(/차원 부재/);
  });

  it('Vectorize 매칭 0건 → empty (Stage 4 진입 신호)', async () => {
    const v = makeMockVectorize([]);
    const d = makeMockD1([], []);
    const r = await runTopicClusterRouting(v, d, exam, queryEmbedding);
    expect(r.clusters).toEqual([]);
    expect(r.results).toEqual([]);
  });

  it('similarity < 0.50 차단 (Stage 3 임계)', async () => {
    const v = makeMockVectorize([{ id: 'TOPIC-001', score: 0.45 }]);
    const d = makeMockD1([], []);
    const r = await runTopicClusterRouting(v, d, exam, queryEmbedding);
    expect(r.clusters).toEqual([]);
  });

  it('Vectorize 매칭 + D1 cluster 부재 → empty (drift graceful)', async () => {
    const v = makeMockVectorize([{ id: 'TOPIC-001', score: 0.7 }]);
    const d = makeMockD1([], []);
    const r = await runTopicClusterRouting(v, d, exam, queryEmbedding);
    expect(r.clusters).toEqual([]);
    expect(r.results).toEqual([]);
  });

  // ============================================================
  // Pass 2 CRITICAL-1 + MAJOR-1 흡수 (Session 059) — Vectorize filter 정합
  // ============================================================
  it('Pass 2 CRITICAL-1: Vectorize.query filter 키 = node_type (not type) + exam_id', async () => {
    const queryMock = vi.fn(async () => ({
      count: 0,
      matches: [] as Array<{ id: string; score: number }>,
    }));
    const v = { upsert: vi.fn(), query: queryMock } as unknown as VectorizeQueryBinding;
    const d = makeMockD1([], []);
    await runTopicClusterRouting(v, d, exam, queryEmbedding);
    expect(queryMock).toHaveBeenCalledOnce();
    const callArgs = queryMock.mock.calls[0] as ReadonlyArray<unknown>;
    const opts = callArgs[1] as { filter?: Record<string, string> };
    // filter shape 정합 — upserter.ts VectorizeUpsertMetadata 키 체계
    expect(opts.filter).toEqual({
      node_type: 'topic_cluster',
      exam_id: exam,
    });
  });

  // ============================================================
  // Pass 1 CRIT-3 흡수 (Session 059) — Vectorize.query throw 시 graceful Miss
  // ============================================================
  it('Pass 1 CRIT-3: Vectorize.query throw → graceful Miss (throw 안 함)', async () => {
    const failingV = {
      upsert: vi.fn(),
      query: vi.fn(async () => {
        throw new Error('Vectorize transient');
      }),
    } as unknown as VectorizeQueryBinding;
    const d = makeMockD1([], []);
    const r = await runTopicClusterRouting(failingV, d, exam, queryEmbedding);
    // throw 안 하고 빈 결과 반환 — caller 가 Stage 4 진입
    expect(r.clusters).toEqual([]);
    expect(r.results).toEqual([]);
    expect(r.source).toBe('topic-cluster');
  });

  it('cluster 매칭 + lv1 노드 추천', async () => {
    const v = makeMockVectorize([{ id: 'TOPIC-001', score: 0.75 }]);
    const clusters: ClusterRow[] = [
      {
        id: 'TOPIC-001',
        name: '적과전종합위험 — 5점 단답',
        lv1: '적과전종합위험',
        lv2: '5점',
        lv3: null,
        exam_frequency: 10,
      },
    ];
    const nodes: KnRow[] = [
      {
        id: 'LAW-적과전종합위험-001',
        type: 'LAW',
        name: '적과전종합위험 법령',
        description: '본문',
        page_ref: 'p.100',
        truth_weight: 10,
      },
    ];
    const r = await runTopicClusterRouting(v, makeMockD1(clusters, nodes), exam, queryEmbedding);
    expect(r.clusters.map((c) => c.id)).toEqual(['TOPIC-001']);
    expect(r.clusters[0].similarity).toBe(0.75);
    expect(r.results.length).toBeGreaterThanOrEqual(1);
  });
});
