/**
 * topic-cluster-fetcher — Multi-Path Stage 3 dead path 해제 (handoff-068 우선순위 1).
 *
 * 검증:
 *   - examId 첫 인자 강제 (Hard Rule 16)
 *   - text = row.name 단독 (D-TCV-1=A)
 *   - metadata.node_type='topic_cluster' string 고정
 *   - metadata.status='approved' 고정 (topic_clusters 컬럼 부재)
 *   - metadata.truth_weight=5 sentinel (D-TCV-2=A)
 *   - lv1/lv2 conditional spread (null 시 키 부재)
 *   - is_covered=0 row 제외
 *   - row.name 빈 string throw (임베딩 대상 부재)
 *
 * 근거:
 *   - docs/plans/phase2a-topic-cluster-vectorize-indexing.plan.md §3.3
 */

import { describe, expect, it, vi } from 'vitest';
import { EXAM_IDS, type ExamId } from '@thepick/shared';
import {
  fetchTopicClustersForVectorize,
  TOPIC_CLUSTER_TRUTH_WEIGHT,
  TOPIC_CLUSTER_NODE_TYPE,
  TOPIC_CLUSTER_STATUS,
} from '../topic-cluster-fetcher.js';
import type { D1Reader } from '../table-fetcher.js';

interface MockRow {
  id: string;
  name: string;
  lv1: string | null;
  lv2: string | null;
  lv3: string | null;
}

function makeMockDb(rows: ReadonlyArray<MockRow>): D1Reader & {
  prepare: ReturnType<typeof vi.fn>;
} {
  const all = vi.fn(async () => ({ results: rows }));
  const bind = vi.fn(() => ({ all }));
  const prepare = vi.fn(() => ({ bind }));
  return { prepare } as D1Reader & { prepare: ReturnType<typeof vi.fn> };
}

describe('fetchTopicClustersForVectorize', () => {
  const examId = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

  it('빈 examId → throw (Hard Rule 16)', async () => {
    const db = makeMockDb([]);
    // Pass 1 SURGEON m2 흡수 (Session 060) — `as unknown as ExamId` (ExamId 타입 변경 시 silent break 방지).
    await expect(
      fetchTopicClustersForVectorize(db, '' as unknown as ExamId, { limit: 50, offset: 0 }),
    ).rejects.toThrow(/examId is required/);
  });

  it('limit > 100 → throw (Pass 1 SURGEON m1 흡수)', async () => {
    const db = makeMockDb([]);
    await expect(
      fetchTopicClustersForVectorize(db, examId, { limit: 101, offset: 0 }),
    ).rejects.toThrow(/exceeds VECTORIZE_UPSERT_MAX_BATCH_SIZE/);
  });

  it('row.name 빈 string → throw (임베딩 대상 부재)', async () => {
    const db = makeMockDb([{ id: 'TC-001', name: '   ', lv1: '논작물', lv2: '5점', lv3: null }]);
    await expect(
      fetchTopicClustersForVectorize(db, examId, { limit: 10, offset: 0 }),
    ).rejects.toThrow(/name must be non-empty/);
  });

  it('text = row.name 단독 (D-TCV-1=A)', async () => {
    const db = makeMockDb([
      {
        id: 'TC-001',
        name: '적과전종합위험 — 5점 단답/계산',
        lv1: '적과전종합위험',
        lv2: '5점',
        lv3: null,
      },
    ]);
    const nodes = await fetchTopicClustersForVectorize(db, examId, { limit: 10, offset: 0 });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('TC-001');
    expect(nodes[0].text).toBe('적과전종합위험 — 5점 단답/계산');
  });

  it('metadata 고정값: node_type=topic_cluster + status=approved + truth_weight=5', async () => {
    const db = makeMockDb([
      {
        id: 'TC-007',
        name: '논작물(벼) — 5점',
        lv1: '논작물',
        lv2: '5점',
        lv3: null,
      },
    ]);
    const nodes = await fetchTopicClustersForVectorize(db, examId, { limit: 10, offset: 0 });
    expect(nodes[0].metadata.node_id).toBe('TC-007');
    expect(nodes[0].metadata.node_type).toBe(TOPIC_CLUSTER_NODE_TYPE);
    expect(nodes[0].metadata.node_type).toBe('topic_cluster');
    expect(nodes[0].metadata.status).toBe(TOPIC_CLUSTER_STATUS);
    expect(nodes[0].metadata.status).toBe('approved');
    expect(nodes[0].metadata.truth_weight).toBe(TOPIC_CLUSTER_TRUTH_WEIGHT);
    expect(nodes[0].metadata.truth_weight).toBe(5);
    expect(nodes[0].metadata.revision_year).toBe(0);
    expect(nodes[0].metadata.source_page).toBe(0);
    expect(nodes[0].metadata.is_active).toBe(true);
  });

  it('lv1/lv2 conditional spread: 값 있으면 키 포함, null이면 키 부재', async () => {
    const db = makeMockDb([
      {
        id: 'TC-A',
        name: 'cluster A',
        lv1: '논작물',
        lv2: '5점',
        lv3: null,
      },
      {
        id: 'TC-B',
        name: 'cluster B',
        lv1: null,
        lv2: null,
        lv3: null,
      },
    ]);
    const nodes = await fetchTopicClustersForVectorize(db, examId, { limit: 10, offset: 0 });
    expect(nodes[0].metadata.lv1_insurance).toBe('논작물');
    // ★ Reality Anchor 영속: lv2_crop 키에 점수 분류 적재 (D-TCV-4 carry-over)
    expect(nodes[0].metadata.lv2_crop).toBe('5점');
    expect('lv1_insurance' in nodes[1].metadata).toBe(false);
    expect('lv2_crop' in nodes[1].metadata).toBe(false);
  });

  it('SQL은 is_covered=1 필터 + ORDER BY id + limit/offset 바인드', async () => {
    const db = makeMockDb([]);
    await fetchTopicClustersForVectorize(db, examId, { limit: 25, offset: 10 });
    const prepareMock = db.prepare as ReturnType<typeof vi.fn>;
    expect(prepareMock).toHaveBeenCalledTimes(1);
    const sql = prepareMock.mock.calls[0][0] as string;
    expect(sql).toContain('FROM topic_clusters');
    expect(sql).toContain('is_covered');
    expect(sql).toContain('ORDER BY id');
    expect(sql).toContain('LIMIT ? OFFSET ?');
  });

  it('빈 결과 → 빈 배열 (graceful)', async () => {
    const db = makeMockDb([]);
    const nodes = await fetchTopicClustersForVectorize(db, examId, { limit: 10, offset: 0 });
    expect(nodes).toEqual([]);
  });
});
