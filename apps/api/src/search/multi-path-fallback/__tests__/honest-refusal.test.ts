/**
 * honest-refusal 단위 테스트 — Multi-Path Fallback Stage 4 (D-MPF-3=A).
 */

import { describe, expect, it, vi } from 'vitest';
import { EXAM_IDS } from '@thepick/shared';
import { buildHonestRefusalResponse, recordHonestRefusal } from '../honest-refusal.js';
import type { UserSearchD1 } from '../../user-search.js';

const exam = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

describe('recordHonestRefusal', () => {
  function makeMockDb(allImpl: () => Promise<{ results: unknown[] }>) {
    const bindMock: ReturnType<typeof vi.fn> = vi.fn(() => ({
      all: vi.fn(allImpl),
    }));
    const prepareMock: ReturnType<typeof vi.fn> = vi.fn((_sql: string) => ({
      bind: bindMock,
    }));
    const db = { prepare: prepareMock } as unknown as UserSearchD1;
    return { db, bindMock, prepareMock };
  }

  it('review_queue INSERT (id + exam_id + query_hash + query_length + reason)', async () => {
    const { db, bindMock, prepareMock } = makeMockDb(async () => ({ results: [] }));

    await recordHonestRefusal(db, {
      id: 'rq_test_001',
      examId: exam,
      queryDigest: { length: 12, hash: 'abc123def456' },
      reason: 'honest_refusal',
    });

    expect(prepareMock).toHaveBeenCalledOnce();
    const sql = String(prepareMock.mock.calls[0]?.[0] ?? '');
    expect(sql).toMatch(/INSERT INTO review_queue/);
    expect(bindMock).toHaveBeenCalledWith(
      'rq_test_001',
      exam,
      'abc123def456',
      12,
      'honest_refusal',
    );
  });

  it('PII 정합 — query 평문 미저장 (hash + length 만)', async () => {
    const { db, bindMock } = makeMockDb(async () => ({ results: [] }));

    const sensitive = '내 사회보장번호 999-88-7777';
    await recordHonestRefusal(db, {
      id: 'rq_test_002',
      examId: exam,
      queryDigest: { length: sensitive.length, hash: 'safe_hash_12' },
      reason: 'honest_refusal',
    });

    const bindArgs = (bindMock.mock.calls[0] ?? []) as ReadonlyArray<unknown>;
    for (const arg of bindArgs) {
      expect(String(arg)).not.toContain(sensitive);
      expect(String(arg)).not.toContain('999-88-7777');
    }
  });

  it('D1 throw 시 UserSearchError(filter) + cause 보존', async () => {
    const { db } = makeMockDb(async () => {
      throw new Error('D1 SQLITE_CONSTRAINT: NOT NULL exam_id');
    });

    await expect(
      recordHonestRefusal(db, {
        id: 'rq_test_003',
        examId: exam,
        queryDigest: { length: 5, hash: 'aaaaaaaaaaaa' },
        reason: 'honest_refusal',
      }),
    ).rejects.toMatchObject({
      name: 'UserSearchError',
      phase: 'filter',
      message: 'Stage 4 review_queue INSERT 실패', // Pass 3 M2 정합 — SQL keyword 미포함
    });
  });
});

describe('buildHonestRefusalResponse', () => {
  it('source=honest-refusal + honestRefusal=true + results=[]', () => {
    const r = buildHonestRefusalResponse('rq_test_004');
    expect(r.source).toBe('honest-refusal');
    expect(r.honestRefusal).toBe(true);
    expect(r.reviewQueueId).toBe('rq_test_004');
    expect(r.results).toEqual([]);
  });

  // Pass 3 ADVOCATE C1 흡수 (Session 059)
  it('Pass 3 C1: messageKey i18n contract 포함 (fallback.honest_refusal.out_of_scope)', () => {
    const r = buildHonestRefusalResponse('rq_test_005');
    expect(r.messageKey).toBe('fallback.honest_refusal.out_of_scope');
  });
});
