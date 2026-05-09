/**
 * multi-path-fallback/index 단위 테스트 — Stage 2 → 3 → 4 routing.
 */

import { describe, expect, it, vi } from 'vitest';
import { EXAM_IDS } from '@thepick/shared';
import { runMultiPathFallback } from '../index.js';
import type { UserSearchD1, VectorizeQueryBinding } from '../../user-search.js';

const exam = EXAM_IDS.SON_HAE_PYEONG_GA_SA;
const BGE_M3_DIM = 1024;
const queryEmbedding = new Array<number>(BGE_M3_DIM).fill(0.5);
const queryDigest = { length: 5, hash: 'cafebabecafe' };

interface MockMatch {
  id: string;
  score: number;
  values?: ReadonlyArray<number>;
}

/** 모든 query 호출에 동일 응답 (Stage 4 진입 시나리오 — cluster 매칭 0건). */
function makeVectorize(matches: ReadonlyArray<MockMatch>): VectorizeQueryBinding {
  return {
    upsert: vi.fn(),
    query: vi.fn(async () => ({ count: matches.length, matches })),
  } as unknown as VectorizeQueryBinding;
}

/**
 * Sequential mock — D-TCV-4-FIX-1=B-1 정합 (Session 061).
 * cluster 1st query → cluster.embedding 으로 knowledge_node 2nd query.
 */
function makeSequentialVectorize(
  responses: ReadonlyArray<ReadonlyArray<MockMatch>>,
): VectorizeQueryBinding {
  let callIdx = 0;
  return {
    upsert: vi.fn(),
    query: vi.fn(async () => {
      const matches = responses[callIdx] ?? [];
      callIdx += 1;
      return { count: matches.length, matches };
    }),
  } as unknown as VectorizeQueryBinding;
}

interface PreparedRow {
  [key: string]: unknown;
}

/**
 * SQL 종류별 결과를 분기로 구성하는 mock D1.
 * - keywordFallbackRows: name/description LIKE 매칭 후보
 * - clusterRows: topic_clusters 메타 (Stage 3.b)
 * - clusterNodeRows: knowledge_nodes 메타 (Stage 3.c, fetchNodesByIds 결과)
 * - reviewQueueInsertSpy: review_queue INSERT 호출 spy
 *
 * D-TCV-4-FIX-1=B-1 정합 (Session 061): clusterNodeRows 분기를 'kn.id IN' 으로 변경
 * (이전 'lv1_insurance' → 'kn.id IN' 으로 fetchNodesByIds 정합).
 */
function makeRouterMockD1(opts: {
  readonly keywordFallbackRows?: ReadonlyArray<PreparedRow>;
  readonly clusterRows?: ReadonlyArray<PreparedRow>;
  readonly clusterNodeRows?: ReadonlyArray<PreparedRow>;
  readonly reviewQueueInsertSpy?: (...params: unknown[]) => void;
}): UserSearchD1 {
  return {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async all<T>(): Promise<{ results: ReadonlyArray<T> }> {
              if (sql.includes('INSERT INTO review_queue')) {
                opts.reviewQueueInsertSpy?.(...params);
                return { results: [] };
              }
              if (sql.includes('topic_clusters')) {
                return { results: (opts.clusterRows ?? []) as ReadonlyArray<T> };
              }
              if (sql.includes('kn.id IN')) {
                return { results: (opts.clusterNodeRows ?? []) as ReadonlyArray<T> };
              }
              if (sql.includes('LIKE ?')) {
                return { results: (opts.keywordFallbackRows ?? []) as ReadonlyArray<T> };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

describe('runMultiPathFallback', () => {
  it('Stage 2 매칭 시 stage=2 즉시 반환 (Stage 3+4 미진입)', async () => {
    const reviewSpy = vi.fn();
    const d = makeRouterMockD1({
      keywordFallbackRows: [
        {
          id: 'LAW-001',
          type: 'LAW',
          name: '낙엽률 산정',
          description: null,
          page_ref: 'p.100',
          truth_weight: 10,
          is_current_active: 1,
        },
      ],
      reviewQueueInsertSpy: reviewSpy,
    });
    const v = makeVectorize([]);
    const r = await runMultiPathFallback(
      { db: d, vectorize: v },
      exam,
      '낙엽률 산정',
      queryDigest,
      queryEmbedding,
    );
    expect(r.stage).toBe(2);
    expect(r.source).toBe('keyword-fallback');
    expect(reviewSpy).not.toHaveBeenCalled();
  });

  it('Stage 2 Miss → Stage 3 매칭 (review_queue 미INSERT, D-TCV-4-FIX-1=B-1)', async () => {
    const reviewSpy = vi.fn();
    const clusterEmbedding = new Array<number>(BGE_M3_DIM).fill(0.7);
    const d = makeRouterMockD1({
      keywordFallbackRows: [],
      clusterRows: [
        {
          id: 'TOPIC-001',
          name: '적과전 5점',
          lv1: '적과전',
          lv2: '5점',
          lv3: null,
          exam_frequency: 10,
        },
      ],
      clusterNodeRows: [
        {
          id: 'LAW-001',
          type: 'LAW',
          name: '적과전 법령',
          description: null,
          page_ref: 'p.50',
          truth_weight: 10,
        },
      ],
      reviewQueueInsertSpy: reviewSpy,
    });
    // 1st query (cluster matching): TOPIC-001 with values
    // 2nd query (knowledge_node matching by cluster.embedding): LAW-001
    const v = makeSequentialVectorize([
      [{ id: 'TOPIC-001', score: 0.7, values: clusterEmbedding }],
      [{ id: 'LAW-001', score: 0.55 }],
    ]);
    const r = await runMultiPathFallback(
      { db: d, vectorize: v },
      exam,
      '존재 안하는 토픽',
      queryDigest,
      queryEmbedding,
    );
    expect(r.stage).toBe(3);
    expect(r.source).toBe('topic-cluster');
    expect(reviewSpy).not.toHaveBeenCalled();
  });

  it('모두 Miss → Stage 4 honest_refusal + review_queue INSERT', async () => {
    const reviewSpy = vi.fn();
    const d = makeRouterMockD1({
      keywordFallbackRows: [],
      clusterRows: [],
      reviewQueueInsertSpy: reviewSpy,
    });
    const v = makeVectorize([]);
    const r = await runMultiPathFallback(
      { db: d, vectorize: v },
      exam,
      '완전 모르는 질문',
      queryDigest,
      queryEmbedding,
    );
    expect(r.stage).toBe(4);
    expect(r.source).toBe('honest-refusal');
    if (r.stage === 4) {
      expect(r.honestRefusal).toBe(true);
      expect(r.reviewQueueId).toMatch(/^rq_/);
    }
    expect(reviewSpy).toHaveBeenCalledOnce();
    const callArgs = reviewSpy.mock.calls[0];
    // bind args: id, exam_id, query_hash, query_length, reason
    expect(callArgs[2]).toBe(queryDigest.hash);
    expect(callArgs[3]).toBe(queryDigest.length);
    expect(callArgs[4]).toBe('honest_refusal');
  });

  it('reviewQueueId UUID v4 패턴 (rq_ prefix)', async () => {
    const d = makeRouterMockD1({});
    const v = makeVectorize([]);
    const r = await runMultiPathFallback(
      { db: d, vectorize: v },
      exam,
      '질문',
      queryDigest,
      queryEmbedding,
    );
    if (r.stage === 4) {
      expect(r.reviewQueueId).toMatch(
        /^rq_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }
  });

  // ============================================================
  // Pass 1 CRIT-1 흡수 (Session 059) — review_queue INSERT 실패 시 graceful 응답
  // ============================================================
  it('Pass 1 CRIT-1: review_queue INSERT 실패해도 honest-refusal 응답 정상 (graceful)', async () => {
    // INSERT 실행 시 throw 하는 D1 mock
    const failingD: UserSearchD1 = {
      prepare(sql: string) {
        return {
          bind(..._params: unknown[]) {
            return {
              async all<T>(): Promise<{ results: ReadonlyArray<T> }> {
                if (sql.includes('INSERT INTO review_queue')) {
                  throw new Error('SQLITE_CONSTRAINT: review_queue dead');
                }
                return { results: [] };
              },
            };
          },
        };
      },
    };
    const v = makeVectorize([]);
    const r = await runMultiPathFallback(
      { db: failingD, vectorize: v },
      exam,
      '질문',
      queryDigest,
      queryEmbedding,
    );
    // throw 없이 graceful honest_refusal 응답
    expect(r.stage).toBe(4);
    expect(r.source).toBe('honest-refusal');
    if (r.stage === 4) {
      expect(r.honestRefusal).toBe(true);
      expect(r.reviewQueueId).toMatch(/^rq_/);
      expect(r.messageKey).toBe('fallback.honest_refusal.out_of_scope');
    }
  });
});
