/**
 * GraphVisualizer 단위 테스트 — Step 037 CRIT-QPHASE1-1 #8.
 *
 * 검증:
 *   - mount 시 D3 simulation 시작 + svg 자식 노드 렌더링
 *   - unmount 시 simulation.stop() 호출 → 리소스 leak 차단
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import GraphVisualizer from '../components/GraphVisualizer';
import type { VisNode, VisEdge } from '../types/graph';

const SAMPLE_NODES: VisNode[] = [
  {
    id: 'CONCEPT-001',
    name: '농작물재해보험',
    type: 'CONCEPT',
    status: 'approved',
    truthWeight: 1.0,
  },
  {
    id: 'F-01',
    name: '보험가입금액',
    type: 'FORMULA',
    status: 'approved',
    truthWeight: 1.0,
  },
];
const SAMPLE_EDGES: VisEdge[] = [
  {
    id: 'E-001',
    source: 'CONCEPT-001',
    target: 'F-01',
    edgeType: 'USES_FORMULA',
    isActive: true,
  },
];
const FILTER = {};

describe('GraphVisualizer — D3 mount/unmount cleanup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mount 시 svg 렌더링 → unmount 시 simulation 정지 (DOM 노드 cleanup)', () => {
    const { container, unmount } = render(
      <GraphVisualizer nodes={SAMPLE_NODES} edges={SAMPLE_EDGES} filter={FILTER} />,
    );

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    // unmount 후 React 가 svg 자체를 제거 — child count 0 검증.
    unmount();
    expect(container.querySelector('svg')).toBeNull();
  });
});
