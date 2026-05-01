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
