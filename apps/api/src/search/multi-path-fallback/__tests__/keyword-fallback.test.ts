/**
 * keyword-fallback 단위 테스트 — Multi-Path Fallback Stage 2 (D-MPF-1=A).
 */

import { describe, expect, it } from 'vitest';
import { EXAM_IDS } from '@thepick/shared';
import { runKeywordFallback, tokenizeQuery } from '../keyword-fallback.js';
import type { UserSearchD1 } from '../../user-search.js';

const exam = EXAM_IDS.SON_HAE_PYEONG_GA_SA;

interface KnRow {
  id: string;
  type: string;
  name: string;
  description: string | null;
  page_ref: string | null;
  truth_weight: number;
  is_current_active: number;
}

function makeMockD1(rows: ReadonlyArray<KnRow>): UserSearchD1 {
  return {
    prepare(_sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async all<T>(): Promise<{ results: ReadonlyArray<T> }> {
              // bind params 는 [likePattern, likePattern] (name LIKE OR description LIKE)
              const pattern = (params[0] as string).replace(/^%|%$/g, '');
              const filtered = rows.filter(
                (r) =>
                  r.is_current_active === 1 &&
                  (r.name.includes(pattern) ||
                    (r.description !== null && r.description.includes(pattern))),
              );
              return { results: filtered as unknown as ReadonlyArray<T> };
            },
          };
        },
      };
    },
  };
}

describe('tokenizeQuery', () => {
  it('공백 기준 분리', () => {
    expect(tokenizeQuery('표본주수 산정 기준')).toEqual(['표본주수', '산정', '기준']);
  });

  it('1자 토큰 제외 (noise 차단)', () => {
    expect(tokenizeQuery('가 나 다라마')).toEqual(['다라마']);
  });

  it('특수문자 제거', () => {
    expect(tokenizeQuery('표본주수?! 산정.')).toEqual(['표본주수', '산정']);
  });

  it('빈 문자열 → []', () => {
    expect(tokenizeQuery('')).toEqual([]);
  });
});

describe('runKeywordFallback', () => {
  it('Hard Rule 16: examId 빈 문자열 throw', async () => {
    const db = makeMockD1([]);
    await expect(runKeywordFallback(db, '' as never, '질문')).rejects.toThrow(/Hard Rule 16/);
  });

  it('빈 query throw', async () => {
    const db = makeMockD1([]);
    await expect(runKeywordFallback(db, exam, '')).rejects.toThrow(/non-empty/);
  });

  it('토큰 0건 (모두 1자) → empty 응답', async () => {
    const db = makeMockD1([]);
    const r = await runKeywordFallback(db, exam, '가 나 다');
    expect(r.matchedTokens).toEqual([]);
    expect(r.results).toEqual([]);
  });

  it('단일 토큰 매칭 시 source=keyword-fallback', async () => {
    const rows: KnRow[] = [
      {
        id: 'LAW-001',
        type: 'LAW',
        name: '낙엽률 산정 기준',
        description: null,
        page_ref: 'p.100',
        truth_weight: 10,
        is_current_active: 1,
      },
    ];
    const r = await runKeywordFallback(makeMockD1(rows), exam, '낙엽률');
    expect(r.source).toBe('keyword-fallback');
    expect(r.matchedTokens).toContain('낙엽률');
    expect(r.results.map((h) => h.id)).toEqual(['LAW-001']);
    expect(r.results[0].score).toBe(1); // 1/1 토큰 매칭
  });

  it('여러 토큰 매칭 시 일치 토큰 수 DESC 정렬', async () => {
    const rows: KnRow[] = [
      // 2 토큰 매칭
      {
        id: 'LAW-001',
        type: 'LAW',
        name: '낙엽률 산정',
        description: null,
        page_ref: 'p.100',
        truth_weight: 10,
        is_current_active: 1,
      },
      // 1 토큰 매칭
      {
        id: 'CONCEPT-001',
        type: 'CONCEPT',
        name: '낙엽률 정의',
        description: null,
        page_ref: 'p.50',
        truth_weight: 5,
        is_current_active: 1,
      },
    ];
    const r = await runKeywordFallback(makeMockD1(rows), exam, '낙엽률 산정');
    // LAW-001 (2 토큰 매칭) > CONCEPT-001 (1 토큰)
    expect(r.results.map((h) => h.id)).toEqual(['LAW-001', 'CONCEPT-001']);
    expect(r.results[0].score).toBe(1); // 2/2
    expect(r.results[1].score).toBe(0.5); // 1/2
  });

  it('동일 토큰 매칭 수 시 truth_weight DESC', async () => {
    const rows: KnRow[] = [
      {
        id: 'CONCEPT-001',
        type: 'CONCEPT',
        name: '낙엽률 개념',
        description: null,
        page_ref: 'p.10',
        truth_weight: 5,
        is_current_active: 1,
      },
      {
        id: 'LAW-001',
        type: 'LAW',
        name: '낙엽률 법령',
        description: null,
        page_ref: 'p.20',
        truth_weight: 10,
        is_current_active: 1,
      },
    ];
    const r = await runKeywordFallback(makeMockD1(rows), exam, '낙엽률');
    expect(r.results.map((h) => h.id)).toEqual(['LAW-001', 'CONCEPT-001']);
  });

  it('매칭 0건 → empty 응답', async () => {
    const r = await runKeywordFallback(makeMockD1([]), exam, '존재하지않는질문');
    expect(r.results).toEqual([]);
    expect(r.matchedTokens).toEqual([]);
  });

  // ============================================================
  // Pass 1 CRIT-2 흡수 (Session 059) — per-token 격리 + 부분 결과 보존
  // ============================================================
  it('Pass 1 CRIT-2: 일부 토큰 throw 시 정상 토큰 결과 보존', async () => {
    const rows = [
      {
        id: 'LAW-001',
        type: 'LAW',
        name: '낙엽률 산정',
        description: null,
        page_ref: 'p.100',
        truth_weight: 10,
        is_current_active: 1,
      },
    ];
    let callCount = 0;
    const flakyDb: UserSearchD1 = {
      prepare(_sql: string) {
        return {
          bind(...params: unknown[]) {
            return {
              async all<T>(): Promise<{ results: ReadonlyArray<T> }> {
                callCount++;
                // 두 번째 토큰 호출 시 throw — 첫 토큰 결과는 살아있어야 함
                if (callCount === 2) throw new Error('D1 transient');
                const pattern = (params[0] as string).replace(/^%|%$/g, '');
                const filtered = rows.filter((r) => r.name.includes(pattern));
                return { results: filtered as unknown as ReadonlyArray<T> };
              },
            };
          },
        };
      },
    };
    const r = await runKeywordFallback(flakyDb, exam, '낙엽률 산정');
    // 정상 토큰 결과 보존 (전체 throw 아님)
    expect(r.results.map((h) => h.id)).toContain('LAW-001');
  });

  it('Pass 1 CRIT-2: 모든 토큰 throw → 전체 실패 throw (조용한 0건 금지)', async () => {
    const failingDb: UserSearchD1 = {
      prepare(_sql: string) {
        return {
          bind(..._p: unknown[]) {
            return {
              async all<T>(): Promise<{ results: ReadonlyArray<T> }> {
                throw new Error('D1 dead');
              },
            };
          },
        };
      },
    };
    await expect(runKeywordFallback(failingDb, exam, '낙엽률 산정')).rejects.toMatchObject({
      name: 'UserSearchError',
      phase: 'filter',
      message: 'Stage 2 keyword fallback 전체 실패',
    });
  });

  // ============================================================
  // Pass 1 MAJ-1 + Pass 3 M3 흡수 (Session 059) — 한국어 어미·특수문자
  // ============================================================
  it('Pass 3 M3: 한국어 조사 제거 ("낙엽률이" → "낙엽률")', () => {
    expect(tokenizeQuery('낙엽률이 산정되는 기준이')).toContain('낙엽률');
  });

  it('Pass 1 MAJ-1: 한국어 특수문자 제거 (가운뎃점 · / 인용부호)', () => {
    expect(tokenizeQuery('보험·금융 "산정"')).toEqual(['보험금융', '산정']);
  });
});
