export { extractPdf, extractPdfText } from './pdf-extractor';
export type { ExtractedPage, ExtractionResult, ExtractOptions } from './pdf-extractor';

export { splitSections } from './section-splitter';
export type { Section, SectionLevel, SplitResult } from './section-splitter';

export { extractTables } from './table-extractor';
export type { ExtractedTable, TableExtractionResult } from './table-extractor';

export {
  registry,
  isValidNodeType,
  isValidEdgeType,
  isValidNodeId,
  isValidFormulaId,
  isValidConstantId,
  isValidConstantCategory,
  inferNodeTypeFromId,
} from './ontology-registry';
export type { OntologyRegistry } from './ontology-registry';

export { validateKnowledgeContract } from './schema-validator';
export type {
  KnowledgeContract,
  KnowledgeContractNode,
  KnowledgeContractEdge,
  KnowledgeContractFormula,
  KnowledgeContractConstant,
  ValidationResult,
  ValidationError,
  ValidationErrorCode,
} from './schema-validator';

export { processBatch } from './batch-processor';
export type {
  ClaudeClient,
  ClaudeMessage,
  ClaudeResponse,
  BatchInput,
  BatchConfig,
  BatchResult,
  TokenUsage,
} from './batch-processor';

export {
  enrichConstants,
  parseNumericValue,
  extractUnit,
  tagConfusionLevels,
} from './constants-extractor';
export type { EnrichedConstant, ConstantsExtractionResult } from './constants-extractor';
