export { extractPdf, extractPdfText, getActivePdfSubprocessCount } from './pdf-extractor';
export type { ExtractedPage, ExtractionResult, ExtractOptions } from './pdf-extractor';

export { PdfParseError, KnowledgeContractValidationError } from './errors';
export type {
  PdfErrorClassification,
  PdfParseErrorMetadata,
  KnowledgeContractErrorClassification,
  KnowledgeContractErrorMetadata,
} from './errors';

export { splitSections } from './section-splitter';
export type { Section, SectionLevel, SplitResult } from './section-splitter';

export { extractTables } from './table-extractor';
export type { ExtractedTable, TableExtractionResult } from './table-extractor';

export { selectVisionCandidates } from './vision-trigger';
export type { VisionCandidate, VisionTriggerOptions } from './vision-trigger';

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

export {
  validateKnowledgeContract,
  validateRawClaudeResponse,
  validateRawResponseSecurity,
} from './schema-validator';
export type {
  KnowledgeContract,
  KnowledgeContractNode,
  KnowledgeContractEdge,
  KnowledgeContractFormula,
  KnowledgeContractConstant,
  KnowledgeContractTable,
  KnowledgeContractTableHeader,
  KnowledgeContractTableCell,
  ValidationResult,
  ValidationError,
  ValidationErrorCode,
  RawResponseValidationOptions,
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
