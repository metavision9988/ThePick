import { describe, it, expect } from 'vitest';
import type { GraphNode, GraphEdge } from '../graph-integrity';
import {
  findOrphanNodes,
  findBrokenEdges,
  findSupersedeCycles,
  validateGraphIntegrity,
  MAX_SUPERSEDE_CHAIN_DEPTH,
  SupersedeChainTooDeepError,
} from '../graph-integrity';

// --- 테스트 헬퍼 ---

function node(
  id: string,
  name?: string,
  isActive?: boolean,
  type: GraphNode['type'] = 'CONCEPT',
): GraphNode {
  return { id, type, name: name ?? id, isActive };
}

function edge(
  id: string,
  from: string,
  to: string,
  edgeType: GraphEdge['edgeType'] = 'DEPENDS_ON',
  isActive?: boolean,
): GraphEdge {
  return { id, fromNode: from, toNode: to, edgeType, isActive };
}

// --- 고아 노드 ---

describe('findOrphanNodes', () => {
  it('엣지에 연결된 노드는 고아가 아님', () => {
    const nodes = [node('A'), node('B')];
    const edges = [edge('e1', 'A', 'B')];
    expect(findOrphanNodes(nodes, edges)).toEqual([]);
  });

  it('엣지 없는 활성 노드는 고아', () => {
    const nodes = [node('A'), node('B'), node('C')];
    const edges = [edge('e1', 'A', 'B')];
    const result = findOrphanNodes(nodes, edges);
    expect(result).toHaveLength(1);
    expect(result[0].entityId).toBe('C');
    expect(result[0].type).toBe('ORPHAN_NODE');
  });

  it('비활성 노드는 고아 검사 제외', () => {
    const nodes = [node('A'), node('B'), node('C', 'C', false)];
    const edges = [edge('e1', 'A', 'B')];
    expect(findOrphanNodes(nodes, edges)).toEqual([]);
  });

  it('비활성 엣지는 연결로 인정하지 않음', () => {
    const nodes = [node('A'), node('B')];
    const edges = [edge('e1', 'A', 'B', 'DEPENDS_ON', false)];
    const result = findOrphanNodes(nodes, edges);
    expect(result).toHaveLength(2); // A, B 모두 고아
  });

  it('TERM 노드는 엣지 없어도 고아가 아님', () => {
    const nodes = [node('A'), node('B'), node('T1', '자기부담비율', undefined, 'TERM')];
    const edges = [edge('e1', 'A', 'B')];
    expect(findOrphanNodes(nodes, edges)).toEqual([]);
  });

  it('노드 0개, 엣지 0개 → 빈 결과', () => {
    expect(findOrphanNodes([], [])).toEqual([]);
  });
});

// --- 끊긴 엣지 ---

describe('findBrokenEdges', () => {
  it('유효한 엣지는 통과', () => {
    const nodes = [node('A'), node('B')];
    const edges = [edge('e1', 'A', 'B')];
    expect(findBrokenEdges(nodes, edges)).toEqual([]);
  });

  it('from_node 없는 엣지 감지', () => {
    const nodes = [node('B')];
    const edges = [edge('e1', 'A', 'B')];
    const result = findBrokenEdges(nodes, edges);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('BROKEN_EDGE');
    expect(result[0].details).toEqual({ missingNode: 'A', side: 'from' });
  });

  it('to_node 없는 엣지 감지', () => {
    const nodes = [node('A')];
    const edges = [edge('e1', 'A', 'B')];
    const result = findBrokenEdges(nodes, edges);
    expect(result).toHaveLength(1);
    expect(result[0].details).toEqual({ missingNode: 'B', side: 'to' });
  });

  it('양쪽 다 없으면 2건', () => {
    const nodes: GraphNode[] = [];
    const edges = [edge('e1', 'A', 'B')];
    const result = findBrokenEdges(nodes, edges);
    expect(result).toHaveLength(2);
  });

  it('엣지 0개 → 빈 결과', () => {
    expect(findBrokenEdges([node('A')], [])).toEqual([]);
  });

  it('비활성 엣지는 검사 제외', () => {
    const nodes = [node('A')];
    const edges = [edge('e1', 'A', 'MISSING', 'DEPENDS_ON', false)];
    expect(findBrokenEdges(nodes, edges)).toEqual([]);
  });
});

// --- SUPERSEDES 순환 ---

describe('findSupersedeCycles', () => {
  it('순환 없는 SUPERSEDES 체인 통과', () => {
    // A → B → C (선형)
    const edges = [edge('e1', 'A', 'B', 'SUPERSEDES'), edge('e2', 'B', 'C', 'SUPERSEDES')];
    expect(findSupersedeCycles(edges)).toEqual([]);
  });

  it('A→B→A 순환 감지', () => {
    const edges = [edge('e1', 'A', 'B', 'SUPERSEDES'), edge('e2', 'B', 'A', 'SUPERSEDES')];
    const result = findSupersedeCycles(edges);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('SUPERSEDES_CYCLE');
  });

  it('A→B→C→A 3노드 순환 감지', () => {
    const edges = [
      edge('e1', 'A', 'B', 'SUPERSEDES'),
      edge('e2', 'B', 'C', 'SUPERSEDES'),
      edge('e3', 'C', 'A', 'SUPERSEDES'),
    ];
    const result = findSupersedeCycles(edges);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].type).toBe('SUPERSEDES_CYCLE');
  });

  it('SUPERSEDES 아닌 엣지는 무시', () => {
    const edges = [edge('e1', 'A', 'B', 'DEPENDS_ON'), edge('e2', 'B', 'A', 'DEPENDS_ON')];
    expect(findSupersedeCycles(edges)).toEqual([]);
  });

  it('엣지 0개 → 빈 결과', () => {
    expect(findSupersedeCycles([])).toEqual([]);
  });

  it('자기 참조 순환 감지 (A→A)', () => {
    const edges = [edge('e1', 'A', 'A', 'SUPERSEDES')];
    const result = findSupersedeCycles(edges);
    expect(result).toHaveLength(1);
  });

  it('비활성 SUPERSEDES 엣지는 순환 검사 제외', () => {
    const edges = [
      edge('e1', 'A', 'B', 'SUPERSEDES', false),
      edge('e2', 'B', 'A', 'SUPERSEDES', false),
    ];
    expect(findSupersedeCycles(edges)).toEqual([]);
  });
});

// --- 통합 검증 ---

describe('validateGraphIntegrity', () => {
  it('정상 그래프 → valid: true', () => {
    const nodes = [node('A'), node('B'), node('C')];
    const edges = [edge('e1', 'A', 'B'), edge('e2', 'B', 'C'), edge('e3', 'A', 'C')];
    const report = validateGraphIntegrity(nodes, edges);
    expect(report.valid).toBe(true);
    expect(report.violations).toHaveLength(0);
    expect(report.stats.totalNodes).toBe(3);
    expect(report.stats.totalEdges).toBe(3);
    expect(report.stats.orphanNodes).toBe(0);
    expect(report.stats.brokenEdges).toBe(0);
    expect(report.stats.supersedeCycles).toBe(0);
  });

  it('복합 위반: 고아 + 끊긴 엣지 동시 감지', () => {
    const nodes = [node('A'), node('B'), node('ORPHAN')];
    const edges = [
      edge('e1', 'A', 'B'),
      edge('e2', 'A', 'MISSING'), // 끊긴 엣지
    ];
    const report = validateGraphIntegrity(nodes, edges);
    expect(report.valid).toBe(false);
    expect(report.stats.orphanNodes).toBe(1); // ORPHAN
    expect(report.stats.brokenEdges).toBe(1); // MISSING
  });

  it('SUPERSEDES 체인 + 비활성 노드 정상', () => {
    const nodes = [node('V1', 'Old', false), node('V2', 'Current')];
    const edges = [edge('e1', 'V2', 'V1', 'SUPERSEDES')];
    const report = validateGraphIntegrity(nodes, edges);
    expect(report.valid).toBe(true);
    expect(report.stats.activeNodes).toBe(1);
  });

  it('중복 노드 ID 감지', () => {
    const nodes = [node('A'), node('A', 'A-dup')];
    const edges = [edge('e1', 'A', 'A')];
    const report = validateGraphIntegrity(nodes, edges);
    expect(report.valid).toBe(false);
    const dupViolation = report.violations.find((v) => v.type === 'DUPLICATE_ID');
    expect(dupViolation).toBeDefined();
  });
});

// --- Sprint 1 §5.1 CRITICAL-N1 회귀 — iterative DFS deep chain stack overflow 차단 ---

describe('findSupersedeCycles — Sprint 1 §5.1 CRITICAL-N1 (iterative DFS)', () => {
  /**
   * 깊이 N 의 단일 SUPERSEDES chain (V1 → V2 → V3 → ... → Vn) 생성.
   * 재귀 DFS 였다면 N=10K 에서 V8 stack overflow.
   */
  function generateDeepChain(depth: number): GraphEdge[] {
    const edges: GraphEdge[] = [];
    for (let i = 0; i < depth - 1; i++) {
      edges.push(edge(`e-${i}`, `n-${i}`, `n-${i + 1}`, 'SUPERSEDES'));
    }
    return edges;
  }

  it('N=10,000 deep chain — iterative DFS 통과 (재귀 였다면 stack overflow)', () => {
    const edges = generateDeepChain(10_000);
    const t0 = performance.now();
    const violations = findSupersedeCycles(edges);
    const elapsed = performance.now() - t0;
    expect(violations).toEqual([]); // chain 은 cycle 없음
    expect(elapsed).toBeLessThan(500); // 충분히 빠름 (iterative O(V+E))
  });

  it('N=20,000 deep chain — V8 stack 한계 초과 영역에서도 안전', () => {
    const edges = generateDeepChain(20_000);
    const violations = findSupersedeCycles(edges);
    expect(violations).toEqual([]);
  });

  it('N=10,000 deep chain + 끝에서 시작으로 cycle → 정확 감지', () => {
    const edges = generateDeepChain(10_000);
    edges.push(edge('e-cycle', 'n-9999', 'n-0', 'SUPERSEDES'));
    const violations = findSupersedeCycles(edges);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('SUPERSEDES_CYCLE');
    const cycle = violations[0].details?.cycle;
    expect(Array.isArray(cycle)).toBe(true);
    expect((cycle as string[]).length).toBeGreaterThan(9_000); // 거의 전체 chain
  });

  it('MAX_SUPERSEDE_CHAIN_DEPTH 초과 시 SupersedeChainTooDeepError throw', () => {
    const overLimit = MAX_SUPERSEDE_CHAIN_DEPTH + 10;
    const edges = generateDeepChain(overLimit);
    expect(() => findSupersedeCycles(edges)).toThrow(SupersedeChainTooDeepError);
  });

  it('SupersedeChainTooDeepError — code / depth / maxDepth 필드 정합', () => {
    const overLimit = MAX_SUPERSEDE_CHAIN_DEPTH + 10;
    const edges = generateDeepChain(overLimit);
    try {
      findSupersedeCycles(edges);
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(SupersedeChainTooDeepError);
      const e = err as SupersedeChainTooDeepError;
      expect(e.code).toBe('SUPERSEDE_CHAIN_TOO_DEEP');
      expect(e.depth).toBeGreaterThan(MAX_SUPERSEDE_CHAIN_DEPTH);
      expect(e.maxDepth).toBe(MAX_SUPERSEDE_CHAIN_DEPTH);
      // Sprint 1 §5.1 4-Pass MAJOR-2-M1 흡수 (Pass 1, 2026-05-01) — error message 가
      // "exceeded" → "cut off at sentinel" 로 변경 (depth 가 lower bound 임을 명시).
      expect(e.message).toContain('cut off at MAX_SUPERSEDE_CHAIN_DEPTH');
      expect(e.message).toContain('fixture corruption or malicious input');
      expect(e.message).toContain('actual depth may be larger');
    }
  });

  it('shallow random DAG N=5000 — Sprint 0 baseline 회귀 (시간 < 50ms)', () => {
    // Sprint 0 baseline microbench 결과: shallow DAG N=5K @ 3ms median.
    // 본 테스트는 iterative 전환 후에도 동일 성능 회귀 방어.
    const edges: GraphEdge[] = [];
    let seed = 42;
    const N = 5000;
    const fanout = 4;
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < fanout; k++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff; // LCG
        const offset = 1 + (seed % Math.min(50, N - i - 1 || 1));
        const target = i + offset;
        if (target < N) {
          edges.push(edge(`e-${i}-${k}`, `n-${i}`, `n-${target}`, 'SUPERSEDES'));
        }
      }
    }
    const t0 = performance.now();
    const violations = findSupersedeCycles(edges);
    const elapsed = performance.now() - t0;
    expect(violations).toEqual([]); // shallow forward-only DAG → cycle 없음
    // Worker 50ms CPU 한도 정합 — 단 wall-clock 측정이라 공유 CI 러너에서 ~2× 편차
    // 실측(2026-07-10 CI 99.5ms, 로컬 <50ms). 로컬 기준 유지 + CI 만 상한 완화
    // (지수적 퇴행 회귀 검출 목적은 보존).
    const wallClockLimitMs = process.env['CI'] === 'true' ? 250 : 50;
    expect(elapsed).toBeLessThan(wallClockLimitMs);
  });

  it('병렬 chain 2개 (서로 독립) 정상 처리', () => {
    const edges: GraphEdge[] = [];
    // chain A: a0 → a1 → ... → a999
    for (let i = 0; i < 999; i++) {
      edges.push(edge(`ea-${i}`, `a-${i}`, `a-${i + 1}`, 'SUPERSEDES'));
    }
    // chain B: b0 → b1 → ... → b999 + cycle b999 → b500
    for (let i = 0; i < 999; i++) {
      edges.push(edge(`eb-${i}`, `b-${i}`, `b-${i + 1}`, 'SUPERSEDES'));
    }
    edges.push(edge('eb-cycle', 'b-999', 'b-500', 'SUPERSEDES'));

    const violations = findSupersedeCycles(edges);
    expect(violations).toHaveLength(1); // chain B 의 cycle 만 감지
    expect(violations[0].entityId).toBe('b-500');
  });
});
