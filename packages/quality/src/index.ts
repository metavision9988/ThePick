/**
 * @thepick/quality — 품질 검증 패키지
 */

export {
  validateGraphIntegrity,
  findOrphanNodes,
  findBrokenEdges,
  findSupersedeCycles,
  // Sprint 1 §5.1 CRITICAL-1 흡수 (Pass 2/3 동일, 2026-05-01) — caller 측 instanceof
  // 검사 가능화. error.code === 'SUPERSEDE_CHAIN_TOO_DEEP' 비교 외에 instanceof 권장.
  MAX_SUPERSEDE_CHAIN_DEPTH,
  SupersedeChainTooDeepError,
} from './graph-integrity';

export type {
  GraphNode,
  GraphEdge,
  Violation,
  ViolationType,
  IntegrityReport,
} from './graph-integrity';

// design-audit WS-2a (확장 게이트 E0-2) — production 누적 무결성 감사 코어 (2026-06-11).
export {
  auditProductionGraph,
  findActiveEdgesToInactiveNodes,
  findWalkUnreachableNodes,
  fromD1Rows,
} from './production-audit';

export type {
  D1NodeRow,
  D1EdgeRow,
  StaleEdgeRef,
  UnreachableNode,
  ProductionAuditReport,
} from './production-audit';
