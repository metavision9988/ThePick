/**
 * Phase 1-D lexical fusion — Binary Gate G-1D 테스트 (plan rev3 §5).
 *
 * 검증:
 *   - G-1D-2  : mode 미지정 = 기존 graph 계약 (응답에 lexicalFusion 키 부재 — additive 격리)
 *   - G-1D-2b : lex 전원 0 → lexicalRerank ≡ compareByTruthWeightThenScore 완전 동치(동점 포함·ε 무관)
 *               + ε=0 정확 동점에서 lex 개입 = 의도 동작(별도 테스트 — rev3 M-N1 분리)
 *   - G-1D-3′ : 전순서 property — 랜덤 풀 × 입력 순열 셔플 ≥50회 → **정렬키-시퀀스 유일**
 *               (전키 동률 원소의 입력순 잔존 = 안정정렬 의도, rev3 m-N1) + 인접 불변식
 *   - rev1 C-1 순환 반례(A/B/C) = 단일 출력 (쌍별 ε-band 비교자 폐기 근거의 회귀 가드)
 *   - route: mode='lexical' ∧ ¬debug → 400 / +debug → 200 + lexicalFusion + graphExpansion
 *            계약({applied,truncated} — 채점 코어 M-1) / 시드 0건 → no_approved_seed 동일 술어
 *
 * 근거: docs/plans/lexical-fusion-phase1d.plan.md rev3 + 리뷰 2회(review-20260707-*-lexical-plan-*).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { EXAM_IDS } from '@thepick/shared';
import {
  createGraphSearchRoutes,
  lexicalRerank,
  lexicalSortKey,
  LEXICAL_MAX_QUERY_TOKENS,
  type GraphSearchRouteBindings,
} from '../graph-search-route.js';
import { compareByTruthWeightThenScore, type UserSearchHit } from '../user-search.js';
import {
  createD1FromAllMigrations,
  type SqliteBackedD1,
} from '../../__tests__/helpers/d1-from-sqlite.js';

const BGE_M3_DIM = 1024;

function makeMockAi(): GraphSearchRouteBindings['AI'] {
  const run = vi.fn(async () => ({
    shape: [1, BGE_M3_DIM],
    data: [new Array(BGE_M3_DIM).fill(0.5)],
  }));
  return { run } as unknown as GraphSearchRouteBindings['AI'];
}

function makeMockVectorize(
  matches: Array<{ id: string; score: number }>,
): GraphSearchRouteBindings['VECTORIZE'] {
  return {
    upsert: vi.fn(),
    query: vi.fn(async () => ({ count: matches.length, matches })),
  } as unknown as GraphSearchRouteBindings['VECTORIZE'];
}

interface AppEnv {
  Bindings: GraphSearchRouteBindings;
}

function hit(id: string, truthWeight: number, score: number): UserSearchHit {
  return {
    id,
    score,
    type: 'CONCEPT',
    truthWeight,
    pageRef: 1,
    name: `n-${id}`,
    description: `d-${id}`,
  };
}

/** 결정적 의사난수 (Math.random 회피 — 재현성). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 정렬키 = route 의 lexicalSortKey **단일 진실원 소비** (P5-M2 — 테스트 내 산식 사본 = 드리프트 서식지 제거). */
function sortKeyOf(h: UserSearchHit, lex: ReadonlyMap<string, number>, eps: number): string {
  return lexicalSortKey(h, lex, eps).join('|');
}

describe('lexicalRerank — ε-양자화 밴드키 전순서 (G-1D-2b·3′)', () => {
  it('G-1D-2b — lex 전원 0 → compareByTruthWeightThenScore 완전 동치 (동점 포함·ε 무관)', () => {
    const rnd = lcg(42);
    for (const eps of [0.01, 0.03, 0.05, 0]) {
      for (let trial = 0; trial < 30; trial++) {
        const pool = Array.from({ length: 12 }, (_, i) => {
          // 동점 20% 주입 (정확 동점에서의 안정성까지 동치 검증)
          const score =
            trial % 5 === 0 && i % 4 === 0 ? 0.65 : 0.6 + Math.round(rnd() * 150) / 1000;
          const tw = [10, 9, 6, 5][Math.floor(rnd() * 4)] as number;
          return hit(`N-${trial}-${i}`, tw, score);
        });
        const expected = [...pool].sort(compareByTruthWeightThenScore).map((h) => h.id);
        const actual = lexicalRerank(pool, new Map(), eps).map((h) => h.id);
        expect(actual).toEqual(expected);
      }
    }
  });

  it('ε=0 — 정확 동점에서만 lex 개입 (순수 tiebreak 의도 동작, rev3 M-N1 분리 테스트)', () => {
    const pool = [hit('P', 6, 0.65), hit('Q', 6, 0.65), hit('R', 6, 0.6)];
    const lex = new Map([['Q', 1.0]]);
    // 동점 P/Q 에서 lexScore 가 Q 를 앞세움 — CO-3 위반 아님(격리 경로 의도 동작)
    expect(lexicalRerank(pool, lex, 0).map((h) => h.id)).toEqual(['Q', 'P', 'R']);
    // 동점 부재면 ε=0 은 원 정렬과 동일
    const pool2 = [hit('P', 6, 0.66), hit('Q', 6, 0.65), hit('R', 6, 0.6)];
    expect(lexicalRerank(pool2, lex, 0).map((h) => h.id)).toEqual(
      [...pool2].sort(compareByTruthWeightThenScore).map((h) => h.id),
    );
  });

  it('rev1 C-1 순환 반례 — 쌍별 비교자가 3종 출력을 내던 입력이 단일 출력으로 수렴', () => {
    const A = hit('A', 6, 0.66);
    const B = hit('B', 6, 0.62);
    const C = hit('C', 6, 0.64);
    const lex = new Map([
      ['B', 1.0],
      ['C', 0.5],
    ]);
    const perms: UserSearchHit[][] = [
      [A, B, C],
      [A, C, B],
      [B, A, C],
      [B, C, A],
      [C, A, B],
      [C, B, A],
    ];
    const outputs = new Set(
      perms.map((p) =>
        lexicalRerank(p, lex, 0.03)
          .map((h) => h.id)
          .join(','),
      ),
    );
    expect(outputs.size).toBe(1); // 쌍별 ε-band 였다면 3종 (리뷰 실증) — 양자화 키 = 유일
  });

  it('G-1D-3′ — property: 랜덤 풀 × 순열 셔플 60회 → 정렬키-시퀀스 유일 + 인접 불변식', () => {
    const rnd = lcg(7);
    for (let pool_i = 0; pool_i < 20; pool_i++) {
      const pool = Array.from({ length: 10 }, (_, i) =>
        hit(
          `X-${pool_i}-${i}`,
          [10, 9, 6][Math.floor(rnd() * 3)] as number,
          0.6 + Math.round(rnd() * 150) / 1000,
        ),
      );
      const lex = new Map(
        pool.filter(() => rnd() < 0.4).map((h) => [h.id, Math.round(rnd() * 3) / 3]),
      );
      const eps = [0.01, 0.03, 0.05][pool_i % 3] as number;

      const keySeqs = new Set<string>();
      for (let shuffle = 0; shuffle < 60; shuffle++) {
        const arr = [...pool];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(rnd() * (i + 1));
          [arr[i], arr[j]] = [arr[j]!, arr[i]!];
        }
        const out = lexicalRerank(arr, lex, eps);
        // 인접 불변식: sortKey(out[i]) ≥ sortKey(out[i+1]) (사전식 DESC)
        for (let i = 0; i + 1 < out.length; i++) {
          const ka = lexicalSortKey(out[i]!, lex, eps); // 단일 진실원 (P5-M2 — eps>0 가드 사본 불일치 해소)
          const kb = lexicalSortKey(out[i + 1]!, lex, eps);
          const cmp = ka.map((v, k) => v - kb[k]!).find((d) => d !== 0) ?? 0;
          expect(cmp).toBeGreaterThanOrEqual(0);
        }
        keySeqs.add(out.map((h) => sortKeyOf(h, lex, eps)).join(' > '));
      }
      expect(keySeqs.size).toBe(1); // 키-시퀀스 유일 (rev3 m-N1 — id 아닌 정렬키 비교)
    }
  });
});

describe('/api/search/graph mode=lexical — route 계약 (G-1D-1·2 + M-1)', () => {
  let backend: SqliteBackedD1;
  let app: Hono<AppEnv>;
  let env: GraphSearchRouteBindings;

  beforeEach(() => {
    backend = createD1FromAllMigrations();
    app = new Hono<AppEnv>();
    app.route('/api/search/graph', createGraphSearchRoutes());
  });
  afterEach(() => {
    backend.close();
    vi.restoreAllMocks();
  });

  async function post(body: unknown) {
    return app.request(
      '/api/search/graph',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      env,
    );
  }

  async function insertApproved(id: string, type: string, tw: number): Promise<void> {
    await backend.db
      .prepare(
        'INSERT INTO knowledge_nodes (id, type, name, description, page_ref, book_page, pdf_page, version_year, truth_weight, status) VALUES (?, ?, ?, ?, ?, 100, 105, 2026, ?, ?)',
      )
      .bind(id, type, `유과타박률 조사 ${id}`, `설명 ${id}`, `p.${id}`, tw, 'draft')
      .run();
    await backend.db
      .prepare(
        "INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, transitioned_at) VALUES (?, 'node', ?, 'draft', 'approved', 'r', ?)",
      )
      .bind(`st-${id}`, id, '2026-05-15T01:00:00.000Z')
      .run();
  }

  it("mode='lexical' ∧ debug 미지정 → 400 (측정 전용 게이트)", async () => {
    env = {
      DB: backend.db,
      VECTORIZE: makeMockVectorize([]),
      AI: makeMockAi(),
      ENVIRONMENT: 'test',
    };
    const res = await post({
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      query: '유과타박률',
      mode: 'lexical',
    });
    expect(res.status).toBe(400);
  });

  it('mode 미지정 → 응답에 lexicalFusion 키 부재 (G-1D-2 additive 격리)', async () => {
    env = {
      DB: backend.db,
      VECTORIZE: makeMockVectorize([]),
      AI: makeMockAi(),
      ENVIRONMENT: 'test',
    };
    const res = await post({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: '유과타박률' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect('lexicalFusion' in body).toBe(false);
    // eps 는 graph 경로 미독 — 지정해도 무시(400 아님, rev3 m-N2)
    const res2 = await post({
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      query: '유과타박률',
      eps: 0.05,
    });
    expect(res2.status).toBe(200);
  });

  it("mode='lexical'+debug → 200 + lexicalFusion + graphExpansion 계약({applied:true, truncated:false}) — M-1", async () => {
    await insertApproved('N-1', 'LAW', 10);
    await insertApproved('N-2', 'CONCEPT', 6);
    env = {
      DB: backend.db,
      VECTORIZE: makeMockVectorize([
        { id: 'N-1', score: 0.9 },
        { id: 'N-2', score: 0.8 },
      ]),
      AI: makeMockAi(),
      ENVIRONMENT: 'test',
    };
    const res = await post({
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      query: '유과타박률 조사',
      mode: 'lexical',
      debug: true,
      topK: 2,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      graphExpansion: {
        applied: boolean;
        truncated: boolean;
        seedWalkCount: number;
        maxDepth: number;
      };
      lexicalFusion: {
        eps: number;
        poolSize: number;
        lexMatchedCount: number;
        displacedBaselineHits: number;
      };
      results: Array<{ id: string }>;
      baseline: { results: Array<{ id: string }> };
    };
    expect(body.graphExpansion.applied).toBe(true); // 채점 코어 no_seed 제외 안 됨 (M-1)
    expect(body.graphExpansion.truncated).toBe(false);
    expect(body.graphExpansion.seedWalkCount).toBe(0);
    expect(body.graphExpansion.maxDepth).toBe(0);
    expect(body.lexicalFusion.eps).toBe(0.03);
    expect(body.lexicalFusion.poolSize).toBeGreaterThan(0);
    expect(body.results.length).toBeLessThanOrEqual(2);
    // 주입 없음(M-2): results ⊆ pool(=vector 결과) — lexical-only id 가 결과에 등장 금지
    const poolIds = new Set(['N-1', 'N-2']);
    for (const r of body.results) expect(poolIds.has(r.id)).toBe(true);
  });

  it('토큰 dedupe + 상한 cap — 팬아웃 차단 (P1-M2/P3-M1) + meta surface', async () => {
    await insertApproved('N-1', 'LAW', 10);
    env = {
      DB: backend.db,
      VECTORIZE: makeMockVectorize([{ id: 'N-1', score: 0.9 }]),
      AI: makeMockAi(),
      ENVIRONMENT: 'test',
    };
    // 상한 초과 상이 토큰 (81개 × 고유 2자+) — cap 발동 + 요청 성공(거부 아닌 절단 surface)
    const manyTokens = Array.from(
      { length: LEXICAL_MAX_QUERY_TOKENS + 1 },
      (_, i) => `토큰${i}`,
    ).join(' ');
    const res = await post({
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      query: manyTokens,
      mode: 'lexical',
      debug: true,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      lexicalFusion: { queryTokenCount: number; tokenCapApplied: boolean };
    };
    expect(body.lexicalFusion.queryTokenCount).toBe(LEXICAL_MAX_QUERY_TOKENS + 1);
    expect(body.lexicalFusion.tokenCapApplied).toBe(true);
    // 중복 토큰은 dedupe — cap 미발동
    const dupTokens = Array.from({ length: 200 }, () => '유과타박률').join(' ');
    const res2 = await post({
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      query: dupTokens,
      mode: 'lexical',
      debug: true,
    });
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as {
      lexicalFusion: { queryTokenCount: number; tokenCapApplied: boolean };
    };
    expect(body2.lexicalFusion.queryTokenCount).toBe(1);
    expect(body2.lexicalFusion.tokenCapApplied).toBe(false);
  });

  it('vector 0건 → graph 와 동일한 no_approved_seed 술어 (제외집합 구성적 동일 — M-1)', async () => {
    env = {
      DB: backend.db,
      VECTORIZE: makeMockVectorize([]),
      AI: makeMockAi(),
      ENVIRONMENT: 'test',
    };
    const res = await post({
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      query: '존재하지 않는 질의어',
      mode: 'lexical',
      debug: true,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { graphExpansion: { applied: boolean; reason?: string } };
    expect(body.graphExpansion.applied).toBe(false);
    expect(body.graphExpansion.reason).toBe('no_approved_seed');
  });
});
