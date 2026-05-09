/**
 * topic-cluster-router 단위 테스트 — Multi-Path Fallback Stage 3.
 *
 * D-MPF-2=A 채택 (Session 059): Vectorize 재활용.
 * D-TCV-4-FIX-1=B-1 채택 (Session 061, plan phase2a-d-tcv-4-fix.plan.md §3):
 *   cluster matching 1st query 의 returnValues:true → cluster 임베딩 재활용 →
 *   knowledge_node 2nd vector query 로 의미 매칭.
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

type VectorMatch = {
  id: string;
  score: number;
  values?: ReadonlyArray<number>;
};

/**
 * sequential mock: Vectorize.query 호출 순서대로 응답 반환 (cluster 1st → node 2nd × N).
 * D-TCV-4-FIX-1=B-1 정합 — cluster top-K 매칭 후 cluster 별 knowledge_node 2nd query.
 */
function makeSequentialVectorize(
  responses: ReadonlyArray<ReadonlyArray<VectorMatch>>,
): VectorizeQueryBinding & { query: ReturnType<typeof vi.fn> } {
  let callIdx = 0;
  const upsert = vi.fn();
  const query = vi.fn(async () => {
    const matches = responses[callIdx] ?? [];
    callIdx += 1;
    return { count: matches.length, matches };
  });
  return { upsert, query } as unknown as VectorizeQueryBinding & {
    query: ReturnType<typeof vi.fn>;
  };
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
                const ids = new Set(params as string[]);
                const filtered = nodes.filter((n) => ids.has(n.id));
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

describe('runTopicClusterRouting (D-TCV-4-FIX-1=B-1)', () => {
  const queryEmbedding = new Array<number>(BGE_M3_DIM).fill(0.5);
  const clusterEmbedding = new Array<number>(BGE_M3_DIM).fill(0.7);

  it('Hard Rule 16: examId 빈 문자열 throw', async () => {
    const v = makeSequentialVectorize([[]]);
    const d = makeMockD1([], []);
    await expect(
      runTopicClusterRouting(v, d, '' as unknown as typeof exam, queryEmbedding),
    ).rejects.toThrow(/Hard Rule 16/);
  });

  it('queryEmbedding 차원 0 throw', async () => {
    const v = makeSequentialVectorize([[]]);
    const d = makeMockD1([], []);
    await expect(runTopicClusterRouting(v, d, exam, [])).rejects.toThrow(/차원 부재/);
  });

  it('Vectorize cluster 매칭 0건 → empty (Stage 4 진입 신호)', async () => {
    const v = makeSequentialVectorize([[]]);
    const d = makeMockD1([], []);
    const r = await runTopicClusterRouting(v, d, exam, queryEmbedding);
    expect(r.clusters).toEqual([]);
    expect(r.results).toEqual([]);
  });

  it('cluster similarity < 0.50 차단 (Stage 3 임계)', async () => {
    const v = makeSequentialVectorize([[{ id: 'TC-001', score: 0.45, values: clusterEmbedding }]]);
    const d = makeMockD1([], []);
    const r = await runTopicClusterRouting(v, d, exam, queryEmbedding);
    expect(r.clusters).toEqual([]);
  });

  it('Vectorize cluster 매칭 + D1 cluster 부재 → empty (drift graceful)', async () => {
    const v = makeSequentialVectorize([[{ id: 'TC-001', score: 0.7, values: clusterEmbedding }]]);
    const d = makeMockD1([], []);
    const r = await runTopicClusterRouting(v, d, exam, queryEmbedding);
    expect(r.clusters).toEqual([]);
    expect(r.results).toEqual([]);
  });

  it('Pass 2 CRITICAL-1: cluster 1st query filter 키 = node_type + exam_id, returnValues=true', async () => {
    const v = makeSequentialVectorize([[]]);
    const d = makeMockD1([], []);
    await runTopicClusterRouting(v, d, exam, queryEmbedding);
    expect(v.query).toHaveBeenCalledOnce();
    const callArgs = v.query.mock.calls[0] as ReadonlyArray<unknown>;
    const opts = callArgs[1] as {
      filter?: Record<string, string>;
      returnValues?: boolean;
    };
    expect(opts.filter).toEqual({ node_type: 'topic_cluster', exam_id: exam });
    expect(opts.returnValues).toBe(true);
  });

  it('Pass 1 CRIT-3: Vectorize.query throw → graceful Miss (throw 안 함)', async () => {
    const failingV = {
      upsert: vi.fn(),
      query: vi.fn(async () => {
        throw new Error('Vectorize transient');
      }),
    } as unknown as VectorizeQueryBinding;
    const d = makeMockD1([], []);
    const r = await runTopicClusterRouting(failingV, d, exam, queryEmbedding);
    expect(r.clusters).toEqual([]);
    expect(r.results).toEqual([]);
    expect(r.source).toBe('topic-cluster');
  });

  it('★ D-TCV-4-FIX-1=B-1: cluster matching + cluster.embedding 으로 knowledge_node 2nd query 정상 매칭', async () => {
    // 1st query: 1 cluster matched / 2nd query: 2 knowledge_node matched
    const v = makeSequentialVectorize([
      [{ id: 'TC-001', score: 0.75, values: clusterEmbedding }],
      [
        { id: 'CONCEPT-001', score: 0.82 },
        { id: 'LAW-001', score: 0.71 },
      ],
    ]);
    const clusters: ClusterRow[] = [
      {
        id: 'TC-001',
        name: '적과전종합위험 — 5점 단답',
        lv1: '적과전종합위험',
        lv2: '5점',
        lv3: null,
        exam_frequency: 10,
      },
    ];
    const nodes: KnRow[] = [
      {
        id: 'CONCEPT-001',
        type: 'CONCEPT',
        name: '적과전 손해평가',
        description: '본문',
        page_ref: 'p.396',
        truth_weight: 6,
      },
      {
        id: 'LAW-001',
        type: 'LAW',
        name: '적과전종합위험 약관',
        description: '본문',
        page_ref: 'p.398',
        truth_weight: 10,
      },
    ];
    const r = await runTopicClusterRouting(v, makeMockD1(clusters, nodes), exam, queryEmbedding);
    expect(r.clusters.map((c) => c.id)).toEqual(['TC-001']);
    expect(r.results.length).toBe(2);
    // truth_weight DESC → LAW(10) > CONCEPT(6)
    expect(r.results[0].id).toBe('LAW-001');
    expect(r.results[1].id).toBe('CONCEPT-001');
  });

  it('★ D-TCV-4-FIX-1=B-1: knowledge_node 2nd query similarity < 0.40 → 결과 제외', async () => {
    const v = makeSequentialVectorize([
      [{ id: 'TC-001', score: 0.75, values: clusterEmbedding }],
      [
        { id: 'CONCEPT-001', score: 0.5 },
        { id: 'CONCEPT-002', score: 0.35 }, // 임계 미달
      ],
    ]);
    const clusters: ClusterRow[] = [
      {
        id: 'TC-001',
        name: '논작물 — 5점',
        lv1: '논작물',
        lv2: '5점',
        lv3: null,
        exam_frequency: 8,
      },
    ];
    const nodes: KnRow[] = [
      {
        id: 'CONCEPT-001',
        type: 'CONCEPT',
        name: '논작물 표본',
        description: null,
        page_ref: 'p.500',
        truth_weight: 6,
      },
      {
        id: 'CONCEPT-002',
        type: 'CONCEPT',
        name: '비관련',
        description: null,
        page_ref: 'p.700',
        truth_weight: 6,
      },
    ];
    const r = await runTopicClusterRouting(v, makeMockD1(clusters, nodes), exam, queryEmbedding);
    expect(r.results.map((h) => h.id)).toEqual(['CONCEPT-001']);
  });

  it('★ Reality Anchor 회귀 검증: production cluster.lv1=논작물 / cluster.lv2=5점 케이스 정상 매칭', async () => {
    // production realistic: cluster.lv1 (간소화 도메인) ≠ kn.lv1_insurance (보험 종목명)
    // → 직접 컬럼 매칭 0건 보장. cluster 임베딩 의미 매칭으로 흡수 검증.
    const v = makeSequentialVectorize([
      [{ id: 'TC-007', score: 0.62, values: clusterEmbedding }],
      [{ id: 'CONCEPT-100', score: 0.68 }],
    ]);
    const clusters: ClusterRow[] = [
      {
        id: 'TC-007',
        name: '논작물(벼) — 5점',
        lv1: '논작물',
        lv2: '5점',
        lv3: null,
        exam_frequency: 8,
      },
    ];
    const nodes: KnRow[] = [
      {
        id: 'CONCEPT-100',
        type: 'CONCEPT',
        name: '벼 표본구간 수확량 조사',
        description: '논작물 표본구간 수확량 조사 방법',
        page_ref: 'p.500',
        truth_weight: 6,
      },
    ];
    const r = await runTopicClusterRouting(v, makeMockD1(clusters, nodes), exam, queryEmbedding);
    expect(r.results.length).toBe(1);
    expect(r.results[0].id).toBe('CONCEPT-100');
    // ★ 4-Pass CRIT-4 흡수: lv2 surface 제거 + cluster.name 점수 분류 suffix strip
    expect(r.clusters[0].lv1).toBe('논작물');
    expect(r.clusters[0]).not.toHaveProperty('lv2');
    expect(r.clusters[0].name).toBe('논작물(벼)'); // ' — 5점' suffix 제거
  });

  it('★ 4-Pass CRIT-4: cluster.name 점수 분류 suffix 정규식 strip', async () => {
    const v = makeSequentialVectorize([
      [
        { id: 'TC-001', score: 0.85, values: clusterEmbedding },
        { id: 'TC-002', score: 0.72, values: clusterEmbedding },
        { id: 'TC-003', score: 0.61, values: clusterEmbedding },
      ],
      [{ id: 'CONCEPT-001', score: 0.55 }],
      [{ id: 'CONCEPT-002', score: 0.5 }],
      [{ id: 'CONCEPT-003', score: 0.45 }],
    ]);
    const clusters: ClusterRow[] = [
      {
        id: 'TC-001',
        name: '적과전종합위험 — 5점 단답',
        lv1: '적과전종합위험',
        lv2: '5점',
        lv3: null,
        exam_frequency: 1,
      },
      {
        id: 'TC-002',
        name: '논작물(벼) — 15점',
        lv1: '논작물',
        lv2: '15점',
        lv3: null,
        exam_frequency: 1,
      },
      {
        id: 'TC-003',
        name: '시설작물 — 5점/15점',
        lv1: '시설작물',
        lv2: '5점/15점',
        lv3: null,
        exam_frequency: 1,
      },
    ];
    const nodes: KnRow[] = [
      {
        id: 'CONCEPT-001',
        type: 'CONCEPT',
        name: 'N1',
        description: null,
        page_ref: 'p.1',
        truth_weight: 6,
      },
      {
        id: 'CONCEPT-002',
        type: 'CONCEPT',
        name: 'N2',
        description: null,
        page_ref: 'p.2',
        truth_weight: 6,
      },
      {
        id: 'CONCEPT-003',
        type: 'CONCEPT',
        name: 'N3',
        description: null,
        page_ref: 'p.3',
        truth_weight: 6,
      },
    ];
    const r = await runTopicClusterRouting(v, makeMockD1(clusters, nodes), exam, queryEmbedding);
    expect(r.clusters.map((c) => c.name)).toEqual(['적과전종합위험', '논작물(벼)', '시설작물']);
    r.clusters.forEach((c) => expect(c).not.toHaveProperty('lv2'));
  });

  it('★ 4-Pass CRIT-2: truth_weight NULL 시 NaN 정렬 방지 (TRUTH_WEIGHT_NAN_GUARD=0 fallback)', async () => {
    const v = makeSequentialVectorize([
      [{ id: 'TC-001', score: 0.75, values: clusterEmbedding }],
      [
        { id: 'UNKNOWN-001', score: 0.7 },
        { id: 'CONCEPT-001', score: 0.5 },
      ],
    ]);
    const clusters: ClusterRow[] = [
      { id: 'TC-001', name: '테스트', lv1: 'A', lv2: '5점', lv3: null, exam_frequency: 1 },
    ];
    const nodes: KnRow[] = [
      // 비-NodeType row.type + truth_weight null 동시 — TRUTH_WEIGHTS lookup 실패 + row 값도 부재
      {
        id: 'UNKNOWN-001',
        type: 'UNKNOWN_TYPE',
        name: 'A',
        description: null,
        page_ref: null,
        truth_weight: null as unknown as number,
      },
      {
        id: 'CONCEPT-001',
        type: 'CONCEPT',
        name: 'B',
        description: null,
        page_ref: null,
        truth_weight: 6,
      },
    ];
    const r = await runTopicClusterRouting(v, makeMockD1(clusters, nodes), exam, queryEmbedding);
    // truth_weight 결정성 보장 — NaN 정렬 차단 (실제 정렬 결과는 결정적이어야 함)
    expect(r.results.length).toBe(2);
    // CONCEPT-001 truthWeight=TRUTH_WEIGHTS.CONCEPT (5) > UNKNOWN-001 truthWeight=0 (NAN_GUARD)
    expect(r.results[0].id).toBe('CONCEPT-001');
    expect(r.results[0].truthWeight).toBeGreaterThan(0);
    expect(r.results[1].id).toBe('UNKNOWN-001');
    expect(r.results[1].truthWeight).toBe(0); // TRUTH_WEIGHT_NAN_GUARD (NaN 차단)
    // 핵심 회귀 검증: NaN 비교 제거 — Number.isFinite 모든 truth_weight
    r.results.forEach((h) => expect(Number.isFinite(h.truthWeight)).toBe(true));
  });

  it('★ 4-Pass CRIT-1: fetchClustersByIds throw → graceful Miss (Stage 4 진입)', async () => {
    const v = makeSequentialVectorize([[{ id: 'TC-001', score: 0.75, values: clusterEmbedding }]]);
    const failingD: UserSearchD1 = {
      prepare(sql: string) {
        return {
          bind() {
            return {
              async all() {
                if (sql.includes('topic_clusters')) {
                  throw new Error('SQLITE_BUSY');
                }
                return { results: [] };
              },
            };
          },
        };
      },
    };
    const r = await runTopicClusterRouting(v, failingD, exam, queryEmbedding);
    expect(r.clusters).toEqual([]);
    expect(r.results).toEqual([]);
    expect(r.source).toBe('topic-cluster');
  });

  it('★ 4-Pass CRIT-1: fetchNodesByIds throw → 단일 cluster skip + 다음 cluster 진행', async () => {
    const v = makeSequentialVectorize([
      [
        { id: 'TC-001', score: 0.75, values: clusterEmbedding },
        { id: 'TC-002', score: 0.65, values: clusterEmbedding },
      ],
      [{ id: 'CONCEPT-001', score: 0.55 }],
      [{ id: 'CONCEPT-002', score: 0.55 }],
    ]);
    let nodeQueryCallCount = 0;
    const partialFailingD: UserSearchD1 = {
      prepare(sql: string) {
        return {
          bind(...params: unknown[]) {
            return {
              async all<T>(): Promise<{ results: ReadonlyArray<T> }> {
                if (sql.includes('topic_clusters')) {
                  const ids = new Set(params as string[]);
                  return {
                    results: [
                      {
                        id: 'TC-001',
                        name: 'C1',
                        lv1: 'A',
                        lv2: '5점',
                        lv3: null,
                        exam_frequency: 1,
                      },
                      {
                        id: 'TC-002',
                        name: 'C2',
                        lv1: 'B',
                        lv2: '5점',
                        lv3: null,
                        exam_frequency: 1,
                      },
                    ].filter((c) => ids.has(c.id)) as unknown as ReadonlyArray<T>,
                  };
                }
                if (sql.includes('kn.id IN')) {
                  nodeQueryCallCount += 1;
                  if (nodeQueryCallCount === 1) {
                    throw new Error('D1 transient');
                  }
                  return {
                    results: [
                      {
                        id: 'CONCEPT-002',
                        type: 'CONCEPT',
                        name: 'N2',
                        description: null,
                        page_ref: 'p.2',
                        truth_weight: 6,
                      },
                    ] as unknown as ReadonlyArray<T>,
                  };
                }
                return { results: [] };
              },
            };
          },
        };
      },
    };
    const r = await runTopicClusterRouting(v, partialFailingD, exam, queryEmbedding);
    // TC-002 만 정상 진행 → 1 hit
    expect(r.results.map((h) => h.id)).toEqual(['CONCEPT-002']);
  });

  it('cluster.values 미반환 (returnValues 부재) → graceful Miss + 다음 cluster 진행', async () => {
    // 1st query: 2 cluster — TC-001 values 없음 / TC-002 values 있음 (2nd query 진행)
    const v = makeSequentialVectorize([
      [
        { id: 'TC-001', score: 0.7 }, // values 없음
        { id: 'TC-002', score: 0.65, values: clusterEmbedding },
      ],
      [{ id: 'CONCEPT-001', score: 0.55 }],
    ]);
    const clusters: ClusterRow[] = [
      {
        id: 'TC-001',
        name: 'C1',
        lv1: 'A',
        lv2: '5점',
        lv3: null,
        exam_frequency: 1,
      },
      {
        id: 'TC-002',
        name: 'C2',
        lv1: 'B',
        lv2: '5점',
        lv3: null,
        exam_frequency: 1,
      },
    ];
    const nodes: KnRow[] = [
      {
        id: 'CONCEPT-001',
        type: 'CONCEPT',
        name: 'N1',
        description: null,
        page_ref: 'p.100',
        truth_weight: 6,
      },
    ];
    const r = await runTopicClusterRouting(v, makeMockD1(clusters, nodes), exam, queryEmbedding);
    // TC-002 만 2nd query 진행 → 1 hit
    expect(r.results.length).toBe(1);
    expect(r.results[0].id).toBe('CONCEPT-001');
    // cluster 1st query (1) + cluster 2nd query (TC-002 만, 1) = 총 2회
    expect(v.query).toHaveBeenCalledTimes(2);
  });

  it('cluster id 가 2nd query 결과에 포함되어도 fetchNodesByIds 자연 0행으로 차단', async () => {
    // 2nd query 결과에 cluster id 'TC-001' 포함 — knowledge_nodes 테이블에 없음 → 자연 제외
    const v = makeSequentialVectorize([
      [{ id: 'TC-001', score: 0.75, values: clusterEmbedding }],
      [
        { id: 'TC-001', score: 0.99 }, // self-match (cluster id), 자연 제외
        { id: 'CONCEPT-001', score: 0.6 },
      ],
    ]);
    const clusters: ClusterRow[] = [
      {
        id: 'TC-001',
        name: 'C1',
        lv1: '논작물',
        lv2: '5점',
        lv3: null,
        exam_frequency: 1,
      },
    ];
    const nodes: KnRow[] = [
      {
        id: 'CONCEPT-001',
        type: 'CONCEPT',
        name: 'N1',
        description: null,
        page_ref: 'p.100',
        truth_weight: 6,
      },
    ];
    const r = await runTopicClusterRouting(v, makeMockD1(clusters, nodes), exam, queryEmbedding);
    expect(r.results.map((h) => h.id)).toEqual(['CONCEPT-001']);
  });

  it('2nd query throw → 해당 cluster skip + 다음 cluster 정상 진행', async () => {
    // 1st: 2 cluster / 2nd-1 throw / 2nd-2 정상
    const queryMock = vi
      .fn()
      .mockResolvedValueOnce({
        count: 2,
        matches: [
          { id: 'TC-001', score: 0.7, values: clusterEmbedding },
          { id: 'TC-002', score: 0.65, values: clusterEmbedding },
        ],
      })
      .mockRejectedValueOnce(new Error('Vectorize 2nd transient'))
      .mockResolvedValueOnce({
        count: 1,
        matches: [{ id: 'CONCEPT-002', score: 0.55 }],
      });
    const v = { upsert: vi.fn(), query: queryMock } as unknown as VectorizeQueryBinding;
    const clusters: ClusterRow[] = [
      {
        id: 'TC-001',
        name: 'C1',
        lv1: 'A',
        lv2: '5점',
        lv3: null,
        exam_frequency: 1,
      },
      {
        id: 'TC-002',
        name: 'C2',
        lv1: 'B',
        lv2: '5점',
        lv3: null,
        exam_frequency: 1,
      },
    ];
    const nodes: KnRow[] = [
      {
        id: 'CONCEPT-002',
        type: 'CONCEPT',
        name: 'N2',
        description: null,
        page_ref: 'p.200',
        truth_weight: 6,
      },
    ];
    const r = await runTopicClusterRouting(v, makeMockD1(clusters, nodes), exam, queryEmbedding);
    expect(r.results.map((h) => h.id)).toEqual(['CONCEPT-002']);
  });
});
