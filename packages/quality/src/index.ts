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
  findLineageAnomalies,
  findWalkUnreachableNodes,
  fromD1Rows,
  lineageAnomalySubject,
} from './production-audit';

export type {
  D1NodeRow,
  D1EdgeRow,
  StaleEdgeRef,
  UnreachableNode,
  LineageAnomaly,
  LineageAnomalyType,
  LineageEdgeAnomaly,
  LineageNodeAnomaly,
  LineageAudit,
  ProductionAuditOptions,
  ProductionAuditReport,
} from './production-audit';

// WS-3c (G-WS3 ⑤) — 코드 산식 레지스트리 ↔ D1 formulas 동기 대조 코어 (2026-07-02).
export {
  buildFormulaSyncManifest,
  equationTemplateFingerprint,
  expectedEngineBackedFormulaIds,
  normalizeEquationTemplate,
  CODE_VERSION_YEAR_DEAD_NOTE,
  EXPECTED_ENGINE_BACKED_FORMULA_COUNT,
} from './formula-sync';

export type {
  BuildFormulaSyncManifestOptions,
  CodeFormulaEntry,
  D1FormulaSyncRow,
  DisplayOnlyEntry,
  EngineBackedComparison,
  FormulaDriftEntry,
  FormulaDriftKind,
  FormulaSyncManifest,
  UnpopulatedColumnStats,
} from './formula-sync';
