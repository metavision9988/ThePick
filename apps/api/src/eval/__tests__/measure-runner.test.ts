/**
 * S5-6a Binary Gate (통합) — local-smoke end-to-end (G-6a-1 결정성 /
 * G-6a-3 손계산) + G-6a-5 자격증명 게이트.
 *
 * 근거: docs/plans/graph-walk-s5-6a-eval-harness.plan.md §3/§4.
 *   본 테스트는 apps/api 내부 패턴(graph-search-route.test.ts 와 동일 D1
 *   wiring)으로 합성 픽스처를 in-process Hono + sqlite + stub Vectorize 로
 *   끝까지 채점한다. scripts/ runner 는 동일 **순수 코어**(scoreQuestion/
 *   aggregate/assertRemoteMeasurementInputs)를 공유 — 방법론 drift 0
 *   (wiring 은 환경 plumbing, 채점·게이트 정책은 단일 진실원).
 *   ★ 정답률 수치는 합성 stub 산물 = G-S5 아님 (plan §0 Anchor #2).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';
import { EXAM_IDS } from '@thepick/shared';
import { createGraphSearchRoutes } from '../../search/graph-search-route.js';
import {
  createD1FromAllMigrations,
  type SqliteBackedD1,
} from '../../__tests__/helpers/d1-from-sqlite.js';
import {
  parseRelatedNodes,
  scoreQuestion,
  aggregate,
  assertRemoteMeasurementInputs,
  type EvalGoldenItem,
  type GraphSearchResponseShape,
  type PerQuestionResult,
} from '../multihop-accuracy.js';

const BGE_M3_DIM = 1024;

interface FixtureNode {
  id: string;
  type: string;
  name: string;
  description: string;
  truthWeight: number;
  pageRef: string;
}
interface FixtureQuestion {
  id: string;
  content: string;
  relatedNodes?: string[];
  relatedNodesRaw?: string;
  vectorMatches: Array<{ id: string; score: number }>;
}
interface SmokeFixture {
  nodes: FixtureNode[];
  edges: Array<{ from: string; to: string; type: string }>;
  questions: FixtureQuestion[];
}

const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, '../../../../../scripts/fixtures/s5-6-eval-smoke.json'), 'utf-8'),
) as SmokeFixture;

/** scripts/runLocal 과 동일 순서의 D1 wiring (채점은 공유 순수 코어). */
async function runLocalSmoke(
  backend: SqliteBackedD1,
): Promise<{ per: PerQuestionResult[]; golden: EvalGoldenItem[] }> {
  for (const n of FIXTURE.nodes) {
    await backend.db
      .prepare(
        'INSERT INTO knowledge_nodes (id, type, name, description, lv1_insurance, lv2_crop, page_ref, book_page, pdf_page, version_year, truth_weight, status) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)',
      )
      .bind(n.id, n.type, n.name, n.description, n.pageRef, 100, 105, 2026, n.truthWeight, 'draft')
      .run();
    await backend.db
      .prepare(
        "INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason, transitioned_at) VALUES (?, 'node', ?, 'draft', 'review', 'r', NULL, ?)",
      )
      .bind(`stA-${n.id}`, n.id, '2026-05-15T00:00:00.000Z')
      .run();
    await backend.db
      .prepare(
        "INSERT INTO status_transitions (id, target_type, target_id, from_status, to_status, reviewer_id, reason, transitioned_at) VALUES (?, 'node', ?, 'review', 'approved', 'r', NULL, ?)",
      )
      .bind(`stB-${n.id}`, n.id, '2026-05-15T01:00:00.000Z')
      .run();
  }
  for (const e of FIXTURE.edges) {
    await backend.db
      .prepare(
        'INSERT INTO knowledge_edges (id, from_node, to_node, edge_type, condition, priority, is_active) VALUES (?, ?, ?, ?, NULL, 0, 1)',
      )
      .bind(`E-${e.from}-${e.type}-${e.to}`, e.from, e.to, e.type)
      .run();
  }

  let currentMatches: Array<{ id: string; score: number; metadata: Record<string, unknown> }> = [];
  const env = {
    DB: backend.db,
    AI: {
      run: vi.fn(async () => ({ shape: [1, BGE_M3_DIM], data: [new Array(BGE_M3_DIM).fill(0.5)] })),
    },
    VECTORIZE: {
      upsert: vi.fn(),
      query: vi.fn(async () => ({ count: currentMatches.length, matches: currentMatches })),
    },
    ENVIRONMENT: 'test',
  } as unknown as Parameters<ReturnType<typeof createGraphSearchRoutes>['request']>[2];

  const app = new Hono();
  app.route('/api/search/graph', createGraphSearchRoutes());

  const approvedSet = new Set(FIXTURE.nodes.map((n) => n.id));
  const per: PerQuestionResult[] = [];
  const golden: EvalGoldenItem[] = [];
  for (const q of FIXTURE.questions) {
    const raw =
      q.relatedNodesRaw !== undefined ? q.relatedNodesRaw : JSON.stringify(q.relatedNodes ?? []);
    const parsed = parseRelatedNodes(raw);
    const item: EvalGoldenItem = {
      questionId: q.id,
      content: q.content,
      expected: parsed.ids.filter((id) => approvedSet.has(id)),
      relatedRawCount: parsed.ids.length,
      relatedMalformed: parsed.malformed,
    };
    golden.push(item);
    currentMatches = q.vectorMatches.map((m) => ({ ...m, metadata: {} }));
    const res = await app.request(
      '/api/search/graph',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA, query: q.content, topK: 5 }),
      },
      env,
    );
    expect(res.status).toBe(200);
    per.push(scoreQuestion(item, (await res.json()) as GraphSearchResponseShape));
  }
  return { per, golden };
}

describe('G-6a-1/3 — local-smoke end-to-end (손계산 고정 + 결정성)', () => {
  let backend: SqliteBackedD1;
  beforeEach(() => {
    backend = createD1FromAllMigrations();
  });
  afterEach(() => {
    backend.close();
    vi.restoreAllMocks();
  });

  it('per-question 채점이 손계산과 정확 일치', async () => {
    const { per, golden } = await runLocalSmoke(backend);
    const byId = new Map(per.map((p) => [p.questionId, p]));

    const q1 = byId.get('SMOKE-Q1')!; // expected {LAW-1,FORMULA-1}, baseline=[LAW-1]
    expect(q1.excluded).toBeNull();
    expect(q1.baselineHit).toBe(true);
    expect(q1.graphHit).toBe(true);
    expect(q1.graphOnlyRecovery).toBe(false);
    expect(q1.recallBaseline).toBeCloseTo(0.5, 10);
    expect(q1.recallGraph).toBeCloseTo(1, 10);

    const q2 = byId.get('SMOKE-Q2')!; // expected {CONCEPT-2}, baseline=[LAW-1] 미회수
    expect(q2.baselineHit).toBe(false);
    expect(q2.graphHit).toBe(true);
    expect(q2.graphOnlyRecovery).toBe(true);
    expect(q2.regression).toBe(false);

    const q3 = byId.get('SMOKE-Q3')!; // 시드 TERM-1 outgoing 0 → 확장 0
    expect(q3.baselineHit).toBe(true);
    expect(q3.graphHit).toBe(true);
    expect(q3.graphOnlyRecovery).toBe(false);

    expect(byId.get('SMOKE-Q4-unmeasurable')!.excluded).toBe('unmeasurable');
    expect(byId.get('SMOKE-Q5-malformed')!.excluded).toBe('unmeasurable');
    expect(golden.find((g) => g.questionId === 'SMOKE-Q5-malformed')!.relatedMalformed).toBe(true);
  });

  it('aggregate 손계산 — measured=3, baseline 2/3, graph 3/3, graphOnly 1(Q2)', async () => {
    const { per, golden } = await runLocalSmoke(backend);
    const agg = aggregate(per, golden, 'LOCAL fixture');
    expect(agg.total).toBe(5);
    expect(agg.excludedUnmeasurable).toBe(2);
    expect(agg.excludedNoSeed).toBe(0);
    expect(agg.relatedMalformed).toBe(1);
    expect(agg.overall.measured).toBe(3);
    expect(agg.overall.baselineHitRate).toBeCloseTo(2 / 3, 10);
    expect(agg.overall.graphHitRate).toBeCloseTo(1, 10);
    expect(agg.overall.graphOnlyRecoveryCount).toBe(1);
    expect(agg.overall.graphOnlyRecoveryIds).toEqual(['SMOKE-Q2']);
    expect(agg.overall.regressionCount).toBe(0);
  });

  it('G-6a-1 — 2회 실행 결과 deep-equal (비결정 0)', async () => {
    const a = await runLocalSmoke(backend);
    backend.close();
    backend = createD1FromAllMigrations();
    const b = await runLocalSmoke(backend);
    expect(a.per).toEqual(b.per);
    expect(a.golden).toEqual(b.golden);
  });
});

describe('G-6a-5 — REMOTE 자격증명 게이트 (순수 코어, fabricate 차단)', () => {
  it('apiBase 미설정 → throw (수치 fabricate 아닌 명시 실패)', () => {
    expect(() => assertRemoteMeasurementInputs(undefined, 'g.json')).toThrow(
      /THEPICK_API_BASE 미설정/,
    );
    expect(() => assertRemoteMeasurementInputs('   ', 'g.json')).toThrow(/THEPICK_API_BASE 미설정/);
  });
  it('apiBase 있고 golden 미제공 → throw (실 평가셋 = 진산 인증 산출)', () => {
    expect(() => assertRemoteMeasurementInputs('https://x.invalid', null)).toThrow(
      /--golden .* 필수/,
    );
  });
  it('둘 다 충족 → trim 된 입력 반환 (정상 경로)', () => {
    expect(assertRemoteMeasurementInputs(' https://x.invalid ', 'g.json')).toEqual({
      apiBase: 'https://x.invalid',
      goldenPath: 'g.json',
    });
  });
});
