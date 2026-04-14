/**
 * Graph Visualizer 타입 정의
 */

import type { NodeType, EdgeType, ContentStatus } from '@thepick/shared';

export interface VisNode {
  id: string;
  type: NodeType;
  name: string;
  status: ContentStatus;
  lv1Insurance?: string;
  lv2Crop?: string;
  truthWeight: number;
}

export interface VisEdge {
  id: string;
  source: string;
  target: string;
  edgeType: EdgeType;
  isActive: boolean;
}

export interface SubgraphFilter {
  lv1?: string;
  lv2?: string;
  nodeTypes?: NodeType[];
}
