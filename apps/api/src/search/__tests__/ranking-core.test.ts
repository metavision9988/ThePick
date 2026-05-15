/**
 * Stage 3 랭킹 코어 단위 테스트 — `compareByTruthWeightThenScore` + `buildHit`.
 *
 * 근거: review-20260515-202957-graph-walk-s5-2-s5-3.md §4 CO6-4
 *   (d) 비교자 독립 골든 / (b) score-0 동 weight tie 순서 /
 *   (e) NaN·NULL truth_weight 가드 (graph 확장이 노출 확대 → 정렬 불능 차단).
 *
 * 본 비교자/빌더는 정상 Stage 3 와 graph-walk 경로(`/api/search/graph`)의
 * **단일 진실원**(CO-3). 라우트 통합 테스트(graph-search-route.test.ts)와
 * 별개로, 랭킹 로직 자체를 입력→출력으로 못박는다 (Binary Gate).
 */

import { describe, expect, it } from 'vitest';
import {
  buildHit,
  compareByTruthWeightThenScore,
  type UserSearchHit,
  type NodeHitSource,
} from '../user-search.js';

function hit(id: string, truthWeight: number, score: number): UserSearchHit {
  return { id, score, type: 'X', truthWeight, pageRef: 0, name: id, description: null };
}

describe('compareByTruthWeightThenScore — CO6-4(d) 독립 골든', () => {
  it('truth_weight 내림차순 우선, 동일 weight 내 score 내림차순 (결정적 골든)', () => {
    // 의도적 셔플 입력 → 고정 기대 출력.
    const input = [
      hit('term-lo', 3, 0.9),
      hit('law-hi', 10, 0.2),
      hit('concept-a', 5, 0.4),
      hit('law-lo', 10, 0.95),
      hit('concept-b', 5, 0.7),
      hit('formula', 8, 0.1),
    ];
    const out = [...input].sort(compareByTruthWeightThenScore).map((h) => h.id);
    expect(out).toEqual([
      'law-lo', // 10, 0.95
      'law-hi', // 10, 0.20
      'formula', // 8
      'concept-b', // 5, 0.70
      'concept-a', // 5, 0.40
      'term-lo', // 3
    ]);
  });

  it('CO6-4(b) — 동일 weight + score 0 동률은 비교자 0 반환 (안정 정렬 = 삽입 순서 보존)', () => {
    const a = hit('exp-1', 5, 0);
    const b = hit('exp-2', 5, 0);
    expect(compareByTruthWeightThenScore(a, b)).toBe(0);
    expect(compareByTruthWeightThenScore(b, a)).toBe(0);
    // 확장 노드는 전부 score=0 → 동 weight 군 내 순서 = 입력(Map dedup =
    // graph-walk depth ASC, id ASC) 순서가 V8 stable sort 로 보존됨을 고정.
    const ordered = [a, b, hit('exp-3', 5, 0)];
    expect([...ordered].sort(compareByTruthWeightThenScore).map((h) => h.id)).toEqual([
      'exp-1',
      'exp-2',
      'exp-3',
    ]);
  });

  it('비교자 자체는 NaN 미차단 — NaN 비교가 NaN 반환 (가드가 buildHit 측 전제임을 입증)', () => {
    // 반증: 비교자는 NaN 을 막지 않는다. truthWeight NaN 이면 `!==`(NaN!==5
    // =true) → `b.truthWeight - a.truthWeight` = 5 - NaN = **NaN** 반환.
    // 비교자가 NaN 을 반환하면 Array.sort 는 비결정 — 즉 정렬 안전은
    // 전적으로 buildHit 의 finite 가드(아래 (e))에 의존한다는 계약을
    // tautology 아닌 사실로 못박는다.
    const cmp = compareByTruthWeightThenScore(hit('a', NaN, 0), hit('b', 5, 0));
    expect(Number.isNaN(cmp)).toBe(true);
    // 역방향도 NaN (대칭적으로 정렬 불능).
    expect(Number.isNaN(compareByTruthWeightThenScore(hit('b', 5, 0), hit('a', NaN, 0)))).toBe(
      true,
    );
  });
});

describe('buildHit — CO6-4(e) NaN/NULL truth_weight 가드', () => {
  function src(type: string, truthWeight: number): NodeHitSource {
    return {
      id: `n-${type}`,
      type,
      name: 'n',
      description: null,
      page_ref: null,
      truth_weight: truthWeight,
    };
  }

  it('TRUTH_WEIGHTS 미등록 type + NULL truth_weight → 0 폴백 (NaN/null 정렬 불능 차단)', () => {
    const row = {
      id: 'x',
      type: 'UNKNOWN_TYPE',
      name: 'n',
      description: null,
      page_ref: null,
      truth_weight: null as unknown as number,
    } satisfies NodeHitSource;
    const h = buildHit(row, 0);
    expect(h.truthWeight).toBe(0);
    expect(Number.isFinite(h.truthWeight)).toBe(true);
  });

  it('미등록 type + NaN truth_weight → 0 폴백 (`?? 0` 만으로는 NaN 미차단)', () => {
    const h = buildHit(src('UNKNOWN_TYPE', NaN), 0);
    expect(h.truthWeight).toBe(0);
  });

  it('미등록 type + 유한 truth_weight → raw 값 보존 (가드가 정상값을 깨지 않음)', () => {
    const h = buildHit(src('UNKNOWN_TYPE', 4), 0);
    expect(h.truthWeight).toBe(4);
  });

  it('등록 type(LAW) 은 truth_weight NULL 이어도 TRUTH_WEIGHTS(10) 우선', () => {
    const h = buildHit(src('LAW', null as unknown as number), 0);
    expect(h.truthWeight).toBe(10);
  });

  it('가드 후 비교자 정렬 결정성 — 결측 truth_weight 노드가 최하위로 안정 배치', () => {
    const a = buildHit(src('LAW', 10), 0.5); // 10
    const b = buildHit(src('UNKNOWN_TYPE', NaN), 0.9); // → 0
    const c = buildHit(src('CONCEPT', 5), 0.1); // 5
    const out = [b, a, c].sort(compareByTruthWeightThenScore).map((h) => h.id);
    expect(out).toEqual(['n-LAW', 'n-CONCEPT', 'n-UNKNOWN_TYPE']);
  });
});
