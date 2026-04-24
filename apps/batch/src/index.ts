/**
 * @thepick/batch — 배치 파이프라인 오케스트레이터 + QG-2 게이트
 */

export {
  runQG2Validation,
  checkGraphScale,
  checkFormulaRegistry,
  checkFormulaAccuracy,
  checkGraphIntegrity,
} from './qg2-validator';
export type { QG2Result, QG2Check, GoldenTestCase } from './qg2-validator';

export { runPipeline, PIPELINE_STAGES, BATCH_CONFIGS, BATCH1_CONFIG } from './pipeline';
export type {
  PipelineStage,
  PipelineContext,
  PipelineResult,
  StageResult,
  BatchId,
  BatchConfig,
} from './pipeline';

export { loadDraft, DraftLoadError } from './loader/draft-loader';
export type { LoadDraftContext, LoadDraftResult, D1Db, D1Stmt } from './loader/draft-loader';

export {
  transitionStatus,
  getCurrentStatus,
  isValidTransition,
  InvalidTransitionError,
  TargetNotFoundError,
} from './loader/state-machine';
export type {
  TransitionInput,
  TransitionResult,
  TransitionTargetType,
  TransitionStatus,
} from './loader/state-machine';

export { createAnthropicClient, AnthropicNonRetryableError } from './adapters/anthropic-client';
export type { AnthropicClientOptions, UsageHook } from './adapters/anthropic-client';

export { createVisionClient, NotImplementedError } from './adapters/vision-client';
export type {
  VisionClient,
  VisionClientOptions,
  VisionPageInput,
  VisionExtractionResult,
} from './adapters/vision-client';

export { createTokenCostLogger } from './adapters/token-cost-logger';
export type {
  TokenLogger,
  TokenLoggerOptions,
  TokenLoggerInput,
  TokenUsageRecord,
} from './adapters/token-cost-logger';
