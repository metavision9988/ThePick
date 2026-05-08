/**
 * user-search 단위 테스트 — SEARCH_PIPELINE.md Stage 1+2+3 + ADR-008.
 *
 * 검증:
 *   - Stage 1 Vector Recall similarity ≥ 0.60 필터
 *   - Stage 2 Graph Hard Filter (status='approved' AND is_current_active=1)
 *   - Stage 3 Truth Weight Re-rank (LAW > FORMULA > CONCEPT, 동일 weight 내 vector 보존)
 *   - ADR-008 graceful degradation (top-1 < 0.60 → flag true)
 *   - ADR-008 timeout 800ms
 *   - ADR-008 1 retry on network error
 *   - Hard Rule 16/17 정합 (examId 첫 인자 + EXAM_IDS 경유)
 *
 * 근거: docs/plans/phase2a-user-search-route.plan.md §3.2 + §5
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXAM_IDS } from '@thepick/shared';
import {
  searchKnowledgeNodesForUser,
  ADR_008_GRACEFUL_THRESHOLD,
  STAGE1_VECTOR_RECALL_MIN_SIMILARITY,
  type UserSearchDeps,
  type UserSearchD1,
  type VectorizeQueryBinding,
} from '../user-search.js';
import type { AiBinding } from '../../vectorize/upserter.js';

const exam = EXAM_IDS.SON_HAE_PYEONG_GA_SA;
const BGE_M3_DIM = 1024;

function makeMockAi(): AiBinding & { run: ReturnType<typeof vi.fn> } {
  const run = vi.fn(async () => ({
    shape: [1, BGE_M3_DIM],
    data: [new Array<number>(BGE_M3_DIM).fill(0.5)],
  }));
  return { run };
}

interface VectorMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

function makeMockVectorize(
  matches: ReadonlyArray<VectorMatch>,
): VectorizeQueryBinding & { query: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> } {
  const upsert = vi.fn();
  const query = vi.fn(async () => ({ count: matches.length, matches }));
  return { upsert, query } as unknown as VectorizeQueryBinding & {
    query: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
}

interface KnRow {
  id: string;
  type: string;
  name: string;
  description: string | null;
  page_ref: string | null;
  truth_weight: number;
  /** 현재 status — production 에서는 status_transitions 최신 to_status (없으면 'draft'). 테스트 단순화. */
  status: string;
  is_current_active: number;
}

function makeMockD1(rows: ReadonlyArray<KnRow>): UserSearchD1 {
  // Stage 2 hard filter 시뮬레이션 — production 은 status_transitions LEFT JOIN 으로 현재 status 추출.
  // 본 mock 은 KnRow.status 를 "이미 도출된 현재 status" 로 가정 (단위 테스트 단순화).
  return {
    prepare(_sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async all<T>(): Promise<{ results: ReadonlyArray<T> }> {
              const ids = new Set(params as string[]);
              const filtered = rows.filter(
                (r) => ids.has(r.id) && r.status === 'approved' && r.is_current_active === 1,
              );
              return { results: filtered as unknown as ReadonlyArray<T> };
            },
          };
        },
      };
    },
  };
}

function makeDeps(
  ai: AiBinding,
  vectorize: VectorizeQueryBinding,
  db: UserSearchD1,
): UserSearchDeps {
  return { ai, vectorize, db };
}

describe('searchKnowledgeNodesForUser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // Hard Rule 16 / Input validation
  // ============================================================
  it('Hard Rule 16: examId 빈 문자열 throw', async () => {
    const deps = makeDeps(makeMockAi(), makeMockVectorize([]), makeMockD1([]));
    await expect(searchKnowledgeNodesForUser(deps, '' as never, 'q', 3)).rejects.toThrow(
      /Hard Rule 16/,
    );
  });

  it('빈 query throw', async () => {
    const deps = makeDeps(makeMockAi(), makeMockVectorize([]), makeMockD1([]));
    await expect(searchKnowledgeNodesForUser(deps, exam, '', 3)).rejects.toThrow(
      /query must be non-empty/,
    );
  });

  // ============================================================
  // Stage 1 Vector Recall (similarity ≥ 0.60 필터)
  // ============================================================
  describe('Stage 1 Vector Recall', () => {
    it('similarity < 0.60 후보 차단 (ADR-008 임계)', async () => {
      const matches = [
        { id: 'LAW-001', score: 0.55, metadata: {} }, // 차단
        { id: 'CONCEPT-001', score: 0.45, metadata: {} }, // 차단
      ];
      const deps = makeDeps(makeMockAi(), makeMockVectorize(matches), makeMockD1([]));
      const result = await searchKnowledgeNodesForUser(deps, exam, '질문', 3);
      expect(result.stage1Count).toBe(0);
      expect(result.gracefulDegradation).toBe(true);
      expect(result.results).toEqual([]);
    });

    it('Vectorize.query exam_id 필터 메타데이터 전달 (Hard Rule 16 정합)', async () => {
      const matches = [{ id: 'LAW-001', score: 0.7, metadata: {} }];
      const vectorize = makeMockVectorize(matches);
      const deps = makeDeps(makeMockAi(), vectorize, makeMockD1([]));
      await searchKnowledgeNodesForUser(deps, exam, '질문', 3);
      expect(vectorize.query).toHaveBeenCalledTimes(1);
      const callArgs = vectorize.query.mock.calls[0];
      expect(callArgs[1].filter).toEqual({ exam_id: exam });
      expect(callArgs[1].topK).toBe(20); // STAGE1_TOP_K
    });
  });

  // ============================================================
  // Stage 2 Graph Hard Filter (draft 차단 + is_current_active 차단)
  // ============================================================
  describe('Stage 2 Graph Hard Filter', () => {
    it('draft 노드 차단 (status=approved 강제)', async () => {
      const matches = [
        { id: 'LAW-001', score: 0.85, metadata: {} },
        { id: 'LAW-002', score: 0.8, metadata: {} },
      ];
      const rows: KnRow[] = [
        {
          id: 'LAW-001',
          type: 'LAW',
          name: 'Approved law',
          description: null,
          page_ref: 'p.100',
          truth_weight: 10,
          status: 'approved',
          is_current_active: 1,
        },
        {
          id: 'LAW-002',
          type: 'LAW',
          name: 'Draft law',
          description: null,
          page_ref: 'p.200',
          truth_weight: 10,
          status: 'draft', // 차단 대상
          is_current_active: 1,
        },
      ];
      const deps = makeDeps(makeMockAi(), makeMockVectorize(matches), makeMockD1(rows));
      const result = await searchKnowledgeNodesForUser(deps, exam, '질문', 3);
      expect(result.stage1Count).toBe(2);
      expect(result.stage2Count).toBe(1);
      expect(result.results.map((r) => r.id)).toEqual(['LAW-001']);
    });

    it('is_current_active=0 차단 (Rule 16 ADR-013)', async () => {
      const matches = [{ id: 'LAW-001', score: 0.85, metadata: {} }];
      const rows: KnRow[] = [
        {
          id: 'LAW-001',
          type: 'LAW',
          name: 'Inactive',
          description: null,
          page_ref: 'p.100',
          truth_weight: 10,
          status: 'approved',
          is_current_active: 0, // 차단 대상
        },
      ];
      const deps = makeDeps(makeMockAi(), makeMockVectorize(matches), makeMockD1(rows));
      const result = await searchKnowledgeNodesForUser(deps, exam, '질문', 3);
      expect(result.stage2Count).toBe(0);
      expect(result.results).toEqual([]);
      // Stage 1 에서 후보 발견했으나 Stage 2 가 차단 → graceful=true 강제
      expect(result.gracefulDegradation).toBe(true);
    });

    it('Stage 2 결과 0건 → graceful=true 강제 (Multi-Path Fallback 진입 신호)', async () => {
      const matches = [{ id: 'LAW-001', score: 0.85, metadata: {} }];
      const rows: KnRow[] = []; // approved 노드 0건 (production 현 상태 시뮬레이션)
      const deps = makeDeps(makeMockAi(), makeMockVectorize(matches), makeMockD1(rows));
      const result = await searchKnowledgeNodesForUser(deps, exam, '질문', 3);
      expect(result.gracefulDegradation).toBe(true);
      expect(result.results).toEqual([]);
    });
  });

  // ============================================================
  // Stage 3 Truth Weight Re-rank
  // ============================================================
  describe('Stage 3 Truth Weight Re-rank', () => {
    it('LAW(10) > FORMULA(8) > CONCEPT(5) 순서 (vector similarity 무관)', async () => {
      const matches = [
        // CONCEPT 가 vector 기준 top-1 이지만 truth_weight 낮아 후순위
        { id: 'CONCEPT-001', score: 0.95, metadata: {} },
        { id: 'FORMULA-001', score: 0.85, metadata: {} },
        { id: 'LAW-001', score: 0.75, metadata: {} },
      ];
      const rows: KnRow[] = [
        {
          id: 'CONCEPT-001',
          type: 'CONCEPT',
          name: 'concept',
          description: null,
          page_ref: 'p.10',
          truth_weight: 5,
          status: 'approved',
          is_current_active: 1,
        },
        {
          id: 'FORMULA-001',
          type: 'FORMULA',
          name: 'formula',
          description: null,
          page_ref: 'p.20',
          truth_weight: 8,
          status: 'approved',
          is_current_active: 1,
        },
        {
          id: 'LAW-001',
          type: 'LAW',
          name: 'law',
          description: null,
          page_ref: 'p.30',
          truth_weight: 10,
          status: 'approved',
          is_current_active: 1,
        },
      ];
      const deps = makeDeps(makeMockAi(), makeMockVectorize(matches), makeMockD1(rows));
      const result = await searchKnowledgeNodesForUser(deps, exam, '질문', 3);
      expect(result.results.map((r) => r.id)).toEqual(['LAW-001', 'FORMULA-001', 'CONCEPT-001']);
      expect(result.results.map((r) => r.truthWeight)).toEqual([10, 8, 5]);
    });

    it('동일 truth_weight 내 vector similarity 보존', async () => {
      const matches = [
        { id: 'LAW-001', score: 0.7, metadata: {} },
        { id: 'LAW-002', score: 0.85, metadata: {} },
        { id: 'LAW-003', score: 0.65, metadata: {} },
      ];
      const rows: KnRow[] = ['LAW-001', 'LAW-002', 'LAW-003'].map((id) => ({
        id,
        type: 'LAW',
        name: id,
        description: null,
        page_ref: 'p.100',
        truth_weight: 10,
        status: 'approved',
        is_current_active: 1,
      }));
      const deps = makeDeps(makeMockAi(), makeMockVectorize(matches), makeMockD1(rows));
      const result = await searchKnowledgeNodesForUser(deps, exam, '질문', 3);
      // 동일 weight=10 내 vector score DESC: LAW-002 (0.85) > LAW-001 (0.70) > LAW-003 (0.65)
      expect(result.results.map((r) => r.id)).toEqual(['LAW-002', 'LAW-001', 'LAW-003']);
    });

    it('topK 응답 제한 (default 3)', async () => {
      const matches = ['LAW-001', 'LAW-002', 'LAW-003', 'LAW-004', 'LAW-005'].map((id, i) => ({
        id,
        score: 0.9 - i * 0.05,
        metadata: {},
      }));
      const rows: KnRow[] = matches.map((m) => ({
        id: m.id,
        type: 'LAW',
        name: m.id,
        description: null,
        page_ref: 'p.100',
        truth_weight: 10,
        status: 'approved',
        is_current_active: 1,
      }));
      const deps = makeDeps(makeMockAi(), makeMockVectorize(matches), makeMockD1(rows));
      const result = await searchKnowledgeNodesForUser(deps, exam, '질문'); // topK 미지정 = 3
      expect(result.results).toHaveLength(3);
      expect(result.topK).toBe(3);
    });
  });

  // ============================================================
  // ADR-008 graceful degradation
  // ============================================================
  describe('ADR-008 graceful degradation', () => {
    it('top-1 score >= 0.60 → flag false', async () => {
      const matches = [{ id: 'LAW-001', score: 0.75, metadata: {} }];
      const rows: KnRow[] = [
        {
          id: 'LAW-001',
          type: 'LAW',
          name: 'L',
          description: null,
          page_ref: 'p.1',
          truth_weight: 10,
          status: 'approved',
          is_current_active: 1,
        },
      ];
      const deps = makeDeps(makeMockAi(), makeMockVectorize(matches), makeMockD1(rows));
      const result = await searchKnowledgeNodesForUser(deps, exam, '질문', 3);
      expect(result.gracefulDegradation).toBe(false);
    });

    it('top-1 score < 0.60 → flag true', async () => {
      const matches = [{ id: 'LAW-001', score: 0.55, metadata: {} }];
      const deps = makeDeps(makeMockAi(), makeMockVectorize(matches), makeMockD1([]));
      const result = await searchKnowledgeNodesForUser(deps, exam, '질문', 3);
      expect(result.gracefulDegradation).toBe(true);
    });

    it('임계값 정합 (0.60)', () => {
      expect(STAGE1_VECTOR_RECALL_MIN_SIMILARITY).toBe(0.6);
      expect(ADR_008_GRACEFUL_THRESHOLD).toBe(0.6);
    });
  });

  // ============================================================
  // ADR-008 timeout 800ms
  // ============================================================
  describe('ADR-008 timeout', () => {
    it('Vectorize.query 5s delay → UserSearchError(phase=timeout) at 800ms', async () => {
      // 5s delay >> 800ms timeout — system load 무관 안정 마진 (CI 환경 대응)
      const slowVectorize = {
        upsert: vi.fn(),
        query: vi.fn(
          () =>
            new Promise((resolve) => setTimeout(() => resolve({ count: 0, matches: [] }), 5000)),
        ),
      } as unknown as VectorizeQueryBinding;
      const deps = makeDeps(makeMockAi(), slowVectorize, makeMockD1([]));
      await expect(searchKnowledgeNodesForUser(deps, exam, '질문', 3)).rejects.toMatchObject({
        name: 'UserSearchError',
        phase: 'timeout',
      });
    }, 6000);
  });

  // ============================================================
  // ADR-008 1 retry on network error
  // ============================================================
  describe('ADR-008 retry', () => {
    it('첫 호출 실패 → 1회 retry 후 PASS', async () => {
      let callCount = 0;
      const flakyVectorize = {
        upsert: vi.fn(),
        query: vi.fn(async () => {
          callCount++;
          if (callCount === 1) throw new Error('network blip');
          return {
            count: 1,
            matches: [{ id: 'LAW-001', score: 0.85, metadata: {} }],
          };
        }),
      } as unknown as VectorizeQueryBinding;
      const rows: KnRow[] = [
        {
          id: 'LAW-001',
          type: 'LAW',
          name: 'L',
          description: null,
          page_ref: 'p.1',
          truth_weight: 10,
          status: 'approved',
          is_current_active: 1,
        },
      ];
      const deps = makeDeps(makeMockAi(), flakyVectorize, makeMockD1(rows));
      const result = await searchKnowledgeNodesForUser(deps, exam, '질문', 3);
      expect(callCount).toBe(2); // 1 fail + 1 retry PASS
      expect(result.results.map((r) => r.id)).toEqual(['LAW-001']);
    });

    it('2회 모두 실패 → UserSearchError(phase=query)', async () => {
      const failingVectorize = {
        upsert: vi.fn(),
        query: vi.fn(async () => {
          throw new Error('persistent network failure');
        }),
      } as unknown as VectorizeQueryBinding;
      const deps = makeDeps(makeMockAi(), failingVectorize, makeMockD1([]));
      await expect(searchKnowledgeNodesForUser(deps, exam, '질문', 3)).rejects.toMatchObject({
        name: 'UserSearchError',
        phase: 'query',
      });
    });
  });
});
