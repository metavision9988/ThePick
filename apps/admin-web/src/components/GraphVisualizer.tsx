/**
 * M28 Graph Visualizer — D3.js Force Graph (경량 버전)
 *
 * Hairball 방지:
 *   - LV1(보장방식) 또는 LV2(품목) 기준 서브그래프 선택
 *   - 한 화면 최대 100노드
 *   - 전체 그래프 렌더링 금지
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { VisNode, VisEdge, SubgraphFilter } from '../types/graph';
import type { NodeType } from '@thepick/shared';

const MAX_NODES = 100;

const NODE_COLORS: Record<NodeType, string> = {
  LAW: '#ef4444',
  FORMULA: '#f97316',
  INVESTIGATION: '#eab308',
  INSURANCE: '#22c55e',
  CROP: '#06b6d4',
  CONCEPT: '#8b5cf6',
  TERM: '#6b7280',
};

const STATUS_STROKE: Record<string, string> = {
  draft: '#fbbf24',
  review: '#60a5fa',
  approved: '#34d399',
  published: '#10b981',
  flagged: '#ef4444',
};

interface Props {
  nodes: VisNode[];
  edges: VisEdge[];
  filter: SubgraphFilter;
  onNodeClick?: (node: VisNode) => void;
}

function filterSubgraph(
  nodes: VisNode[],
  edges: VisEdge[],
  filter: SubgraphFilter,
): { nodes: VisNode[]; edges: VisEdge[] } {
  let filtered = nodes;

  if (filter.lv1) {
    filtered = filtered.filter((n) => n.lv1Insurance === filter.lv1);
  }
  if (filter.lv2) {
    filtered = filtered.filter((n) => n.lv2Crop === filter.lv2);
  }
  if (filter.nodeTypes && filter.nodeTypes.length > 0) {
    const types = new Set(filter.nodeTypes);
    filtered = filtered.filter((n) => types.has(n.type));
  }

  // MAX_NODES 제한 (truthWeight 높은 순 우선)
  if (filtered.length > MAX_NODES) {
    filtered = filtered.sort((a, b) => b.truthWeight - a.truthWeight).slice(0, MAX_NODES);
  }

  const nodeIds = new Set(filtered.map((n) => n.id));
  const filteredEdges = edges.filter(
    (e) => e.isActive && nodeIds.has(e.source) && nodeIds.has(e.target),
  );

  return { nodes: filtered, edges: filteredEdges };
}

type SimNode = VisNode & d3.SimulationNodeDatum;
type SimLink = d3.SimulationLinkDatum<SimNode> & { edgeType: string };

export default function GraphVisualizer({ nodes, edges, filter, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: VisNode } | null>(null);

  const renderGraph = useCallback(() => {
    if (!svgRef.current) return;

    // 이전 simulation 정리 (메모리 누수 방지)
    simulationRef.current?.stop();
    simulationRef.current = null;

    const { nodes: subNodes, edges: subEdges } = filterSubgraph(nodes, edges, filter);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const rect = svgRef.current.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;

    // Zoom
    const g = svg.append('g');
    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => g.attr('transform', event.transform)),
    );

    const simNodes: SimNode[] = subNodes.map((n) => ({ ...n }));
    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    const simLinks: SimLink[] = subEdges
      .map((e) => {
        const source = nodeMap.get(e.source);
        const target = nodeMap.get(e.target);
        if (!source || !target) return null;
        return { source, target, edgeType: e.edgeType } as SimLink;
      })
      .filter((l): l is SimLink => l !== null);

    // Force simulation
    const simulation = d3
      .forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    simulationRef.current = simulation;

    // Edges
    const link = g
      .append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#arrowhead)');

    // Arrowhead marker
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#94a3b8');

    // Nodes
    const node = g
      .append('g')
      .selectAll('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', (d) => 6 + d.truthWeight)
      .attr('fill', (d) => NODE_COLORS[d.type] ?? '#6b7280')
      .attr('stroke', (d) => STATUS_STROKE[d.status] ?? '#9ca3af')
      .attr('stroke-width', 2.5)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => onNodeClick?.(d))
      .on('mouseenter', (event, d) => {
        setTooltip({ x: event.pageX, y: event.pageY, node: d });
      })
      .on('mouseleave', () => setTooltip(null))
      .call(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (d3.drag<SVGCircleElement, SimNode>() as any)
          .on('start', (event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode>, d: SimNode) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode>, d: SimNode) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode>, d: SimNode) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    // Labels
    const labels = g
      .append('g')
      .selectAll('text')
      .data(simNodes)
      .join('text')
      .text((d) => (d.name.length > 12 ? d.name.slice(0, 12) + '…' : d.name))
      .attr('font-size', '11px')
      .attr('fill', '#334155')
      .attr('dx', 14)
      .attr('dy', 4);

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);
      node.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0);
      labels.attr('x', (d) => d.x ?? 0).attr('y', (d) => d.y ?? 0);
    });
  }, [nodes, edges, filter, onNodeClick]);

  useEffect(() => {
    renderGraph();
    return () => {
      simulationRef.current?.stop();
    };
  }, [renderGraph]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', minHeight: '500px', background: '#f8fafc' }}
      />
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            background: '#1e293b',
            color: '#f1f5f9',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <div style={{ fontWeight: 600 }}>{tooltip.node.name}</div>
          <div>
            {tooltip.node.type} · {tooltip.node.status}
          </div>
        </div>
      )}
    </div>
  );
}
