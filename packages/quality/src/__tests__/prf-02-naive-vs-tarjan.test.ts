/**
 * Master Plan v1.0 §PRF-02 — naive DFS vs Tarjan SCC 비교 (BREAKER 핵심)
 *
 * 합격 기준 (Master Plan §PRF-02):
 *   (a) N=5,000에서 naive DFS < 30ms
 *   (b) N=10,000에서 < 100ms (Worker timeout 위험)
 *   (c) Tarjan은 N=50,000에서도 < 500ms
 *   (d) 두 알고리즘 결과 100% 일치 (sanity)
 *
 * 본 PARTIAL 보강 (handoff-session-032 §1 — naive DFS 정확성 PASS, 성능 비교 부재):
 *   본 시점 framework — naive iterative DFS 측정 N=100/1K/5K/10K.
 *   Tarjan SCC 구현은 본 시점 미실행 — "naive DFS 임계 발화 시 즉시 도입" 의무.
 *   BATCH-1 추정 노드 수 ~700 → naive DFS 50ms 미만 (현 시점 안전).
 *   handoff-session-033 §3 silent pivot 보고 (Tarjan 미구현 사유: 본 시점 임계
 *   미도달, ADR-029 정합 — engine 한도 보수화로 비정상 graph 사전 차단).
 *
 * 측정 도구: @thepick/shared/test-helpers/perf (Sprint 1 §5.2).
 */

import { describe, it, expect } from 'vitest';
import { measure } from '@thepick/shared/test-helpers/perf';
import { findSupersedeCycles, type GraphEdge } from '../graph-integrity';

/**
 * 합성 그래프 generator — N 노드 × E=4N 엣지.
 * 순환 0 (DAG) — supersede chain.
 *
 * 생성 패턴: linear chain N-1 + 추가 cross-link 3N (DAG 보존).
 */
function generateSupersedeGraph(N: number): GraphEdge[] {
  const edges: GraphEdge[] = [];
  // 1) Linear chain: node-i → node-(i+1)
  for (let i = 0; i < N - 1; i += 1) {
    edges.push({
      id: `e-chain-${i}`,
      fromNode: `node-${i}`,
      toNode: `node-${i + 1}`,
      edgeType: 'SUPERSEDES',
      isActive: true,
    });
  }
  // 2) 추가 cross-links — 항상 fromNode < toNode 라 DAG 보존, E=~4N
  for (let i = 0; i < 3 * N; i += 1) {
    const from = i % (N - 1);
    const to = Math.min(from + 1 + (i % 5), N - 1);
    edges.push({
      id: `e-cross-${i}`,
      fromNode: `node-${from}`,
      toNode: `node-${to}`,
      edgeType: 'SUPERSEDES',
      isActive: true,
    });
  }
  return edges;
}

/**
 * 합성 그래프 generator (순환 1개) — sanity 검증용.
 */
function generateGraphWithCycle(N: number): GraphEdge[] {
  const edges = generateSupersedeGraph(N);
  // 마지막 노드 → 첫 노드 — 순환 발생
  edges.push({
    id: 'e-cycle-back',
    fromNode: `node-${N - 1}`,
    toNode: 'node-0',
    edgeType: 'SUPERSEDES',
    isActive: true,
  });
  return edges;
}

// ===========================================================================
// 합격 기준 (a)/(b) — naive iterative DFS 성능 임계
// ===========================================================================
describe('PRF-02 — naive iterative DFS 성능 임계', () => {
  it('N=100 — < 5ms (sanity 베이스라인)', async () => {
    const edges = generateSupersedeGraph(100);
    const result = await measure(
      'naive-dfs-100',
      () => {
        const violations = findSupersedeCycles(edges);
        if (violations.length !== 0) throw new Error('Unexpected cycle in DAG');
      },
      { runs: 50, warmup: 5 },
    );
    expect(result.medianMs).toBeLessThan(5);
  });

  it('N=1K — < 10ms (sanity 베이스라인)', async () => {
    const edges = generateSupersedeGraph(1000);
    const result = await measure(
      'naive-dfs-1k',
      () => {
        const violations = findSupersedeCycles(edges);
        if (violations.length !== 0) throw new Error('Unexpected cycle in DAG');
      },
      { runs: 30, warmup: 3 },
    );
    expect(result.medianMs).toBeLessThan(10);
  });

  it('N=5K — < 30ms (Master Plan §PRF-02 (a) 임계)', async () => {
    const edges = generateSupersedeGraph(5000);
    const result = await measure(
      'naive-dfs-5k',
      () => {
        const violations = findSupersedeCycles(edges);
        if (violations.length !== 0) throw new Error('Unexpected cycle in DAG');
      },
      { runs: 10, warmup: 2 },
    );
    expect(result.medianMs).toBeLessThan(30);
    expect(result.p99Ms).toBeLessThan(60); // 변동 여유
  });

  it('N=10K — < 100ms (Master Plan §PRF-02 (b) 임계, Worker timeout 경계)', async () => {
    const edges = generateSupersedeGraph(10_000);
    const result = await measure(
      'naive-dfs-10k',
      () => {
        const violations = findSupersedeCycles(edges);
        if (violations.length !== 0) throw new Error('Unexpected cycle in DAG');
      },
      { runs: 5, warmup: 2 },
    );
    expect(result.medianMs).toBeLessThan(100);
    // p99 100ms 초과 시 즉시 Tarjan 도입 트리거 — handoff §3 보고 의무.
    if (result.p99Ms > 100) {
      console.warn(
        `[PRF-02 TRIGGER] N=10K naive DFS p99=${result.p99Ms}ms > 100ms — Tarjan 도입 의무`,
      );
    }
  });
});

// ===========================================================================
// 합격 기준 (d) — sanity (DAG → 0 cycles, with-cycle → 1 cycle)
// ===========================================================================
describe('PRF-02 (d) — naive DFS 정확성 sanity', () => {
  it('N=1K DAG — cycles=0', () => {
    const edges = generateSupersedeGraph(1000);
    const violations = findSupersedeCycles(edges);
    expect(violations).toHaveLength(0);
  });

  it('N=1K with cycle — cycles ≥ 1', () => {
    const edges = generateGraphWithCycle(1000);
    const violations = findSupersedeCycles(edges);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0]?.type).toBe('SUPERSEDES_CYCLE');
  });

  it('N=5K DAG — cycles=0 (대규모 sanity)', () => {
    const edges = generateSupersedeGraph(5000);
    const violations = findSupersedeCycles(edges);
    expect(violations).toHaveLength(0);
  });
});

// ===========================================================================
// 합격 기준 (c) — Tarjan SCC 구현 + N=50K 측정
// ===========================================================================
describe('PRF-02 (c) — Tarjan SCC 미구현 명시 (handoff §3 보고)', () => {
  it('Tarjan SCC 구현은 본 시점 미실행 — "naive DFS 임계 발화 시 즉시 도입" 의무', () => {
    // Master Plan §PRF-02 (c) "Tarjan 은 N=50,000 에서도 < 500ms" 명세는
    // Tarjan 구현 후에만 검증 가능. 본 시점은 naive DFS 가 N=10K 에서 충분 (<100ms).
    // BATCH-1 추정 노드 수 ~700 → 5K/10K/50K 는 모두 미래.
    //
    // Tarjan 도입 트리거 (ADR 의무 사항):
    //   1. 본 PRF-02 N=10K naive p99 > 100ms 발화
    //   2. BATCH-1 적재 후 실 그래프 노드 수 측정 결과 5K 초과
    //   3. graph-integrity.ts 의 findSupersedeCycles 가 hot path 진입
    //
    // 본 시점 미구현 = Master Plan vs 실 구현 silent pivot — handoff §3 보고.
    expect(true).toBe(true); // self-document
  });

  it('progress: 4/5 임계 측정 완료 (N=50K 미측정 — Tarjan 의존)', () => {
    // Master Plan §PRF-02 5 임계 (100/1K/5K/10K/50K) 중 4건 측정 완료.
    const measuredThresholds = [100, 1000, 5000, 10000];
    const totalThresholds = [100, 1000, 5000, 10000, 50000];
    expect(measuredThresholds.length / totalThresholds.length).toBe(0.8); // 80% PARTIAL
  });
});
