/**
 * BATCH 파이프라인 오케스트레이터
 *
 * 실행 순서:
 *   Stage 1: PDF 추출 (M01)
 *   Stage 2: 섹션 분리 (M06) + 표 추출
 *   Stage 2.5: Vision OCR (선택) — 가-0 에서는 skip 기본
 *   Stage 3: Claude API 배치 구조화 (M07 + M08 검증)
 *   Stage 4: Constants 추출 (M09)
 *   Stage 5: DB 적재 (status='draft') — dry-run 시 JSON 스냅샷
 *   Stage 6: Graph 무결성 검증 (M14)
 *   Stage 7: 인간 검수 (CLI 별도 실행 — 자동 파이프라인은 skipped)
 *   Stage 8: Formula Engine 검증 (M16 Golden)
 *   Stage 9: QG-2 게이트
 *
 * 실패 시: 해당 Stage 에서 status='failed' 기록, 이후 Stage 전부 skipped.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractPdf,
  splitSections,
  extractTables,
  processBatch,
  validateKnowledgeContract,
  selectVisionCandidates,
  enrichConstants,
  type ClaudeClient,
  type KnowledgeContract,
  type BatchInput,
} from '@thepick/parser';
import { validateGraphIntegrity } from '@thepick/quality';
import type { GraphNode, GraphEdge } from '@thepick/quality';
import type { NodeType, EdgeType } from '@thepick/shared';
import {
  runQG2Validation,
  checkFormulaAccuracy,
  type GoldenTestCase,
  type QG2Result,
} from './qg2-validator';
import {
  loadDraft,
  type LoadDraftContext,
  type LoadDraftResult,
  type D1Db,
} from './loader/draft-loader';
import type { VisionClient } from './adapters/vision-client';

export type PipelineStage =
  | 'pdf_extract'
  | 'section_split'
  | 'vision_ocr'
  | 'batch_structurize'
  | 'constants_extract'
  | 'db_load'
  | 'integrity_check'
  | 'human_review'
  | 'formula_verify'
  | 'qg2_gate';

export interface StageResult {
  readonly stage: PipelineStage;
  readonly status: 'success' | 'failed' | 'skipped';
  readonly message: string;
  readonly durationMs: number;
  readonly data?: unknown;
}

export interface PipelineResult {
  readonly batchId: string;
  readonly stages: readonly StageResult[];
  readonly qg2Passed: boolean;
  readonly qg2Result: QG2Result | null;
  readonly contract: KnowledgeContract | null;
  readonly loadResult: LoadDraftResult | null;
}

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  'pdf_extract',
  'section_split',
  'vision_ocr',
  'batch_structurize',
  'constants_extract',
  'db_load',
  'integrity_check',
  'human_review',
  'formula_verify',
  'qg2_gate',
] as const;

/**
 * 배치별 범위 정의
 */
export const BATCH_CONFIGS = {
  'BATCH-1': {
    batchId: 'BATCH-1',
    pageRange: 'p.403~434',
    pageStart: 403,
    pageEnd: 434,
    description: '적과전 종합위험',
    expectedNodes: 60,
    expectedEdges: 200,
    expectedFormulas: 13,
    defaultAppliesTo: '적과전종합위험',
    defaultInsuranceType: '농작물재해보험',
  },
  'BATCH-2': {
    batchId: 'BATCH-2',
    pageRange: 'p.435~500',
    pageStart: 435,
    pageEnd: 500,
    description: '종합위험 수확감소 16종',
    expectedNodes: 80,
    expectedEdges: 300,
    expectedFormulas: 17,
    defaultAppliesTo: '종합위험수확감소',
    defaultInsuranceType: '농작물재해보험',
  },
  'BATCH-3': {
    batchId: 'BATCH-3',
    pageRange: 'p.501~521',
    pageStart: 501,
    pageEnd: 521,
    description: '논작물(벼, 맥류)',
    expectedNodes: 40,
    expectedEdges: 120,
    expectedFormulas: 8,
    defaultAppliesTo: '논작물',
    defaultInsuranceType: '농작물재해보험',
  },
  'BATCH-4': {
    batchId: 'BATCH-4',
    pageRange: 'p.522~576',
    pageStart: 522,
    pageEnd: 576,
    description: '밭작물',
    expectedNodes: 60,
    expectedEdges: 200,
    expectedFormulas: 15,
    defaultAppliesTo: '밭작물',
    defaultInsuranceType: '농작물재해보험',
  },
  'BATCH-5': {
    batchId: 'BATCH-5',
    pageRange: 'p.577~647',
    pageStart: 577,
    pageEnd: 647,
    description: '시설작물 + 수입감소',
    expectedNodes: 60,
    expectedEdges: 200,
    expectedFormulas: 15,
    defaultAppliesTo: '시설작물',
    defaultInsuranceType: '농작물재해보험',
  },
} as const;

/** BATCH 1 호환 alias (기존 외부 참조 유지) */
export const BATCH1_CONFIG = BATCH_CONFIGS['BATCH-1'];

export type BatchId = keyof typeof BATCH_CONFIGS;
export type BatchConfig = (typeof BATCH_CONFIGS)[BatchId];

// ---------------------------------------------------------------------------
// Pipeline Context + Runner
// ---------------------------------------------------------------------------

export interface PipelineContext {
  readonly batchId: BatchId;
  readonly config: BatchConfig;
  readonly pdfPath: string | null;
  readonly claudeClient: ClaudeClient | null;
  readonly visionClient: VisionClient | null;
  readonly db: D1Db | null;
  /** dry-run: Stage 5 에서 실 DB 적재 대신 JSON 덤프. Stage 7 skip. */
  readonly dryRun: boolean;
  /** JSON 스냅샷 출력 디렉터리. */
  readonly outDir: string;
  /** Stage 2.5 Vision OCR 수행 여부 (가-0 기본 false). */
  readonly enableVisionOcr: boolean;
  /** Stage 8 Golden Test 대상 산식/입출력. 가-0 BATCH 1 기준 fixtures 에서 로드. */
  readonly goldenTests: readonly GoldenTestCase[];
  readonly versionYear: number;
  /**
   * Fixture 모드 — 지정 시 Stage 1~4 를 스킵하고 contract 를 직접 주입.
   * 가-0 단계 smoke test 및 통합 테스트용. 실제 Claude API 호출 없음.
   */
  readonly fixtureContract?: KnowledgeContract;
}

/**
 * Pipeline 중간 상태 — stage 간 데이터 전달용. runPipeline 내부에서만 사용.
 */
interface PipelineState {
  pdfPages: Awaited<ReturnType<typeof extractPdf>> | null;
  sections: ReturnType<typeof splitSections> | null;
  tables: ReturnType<typeof extractTables> | null;
  contract: KnowledgeContract | null;
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  loadResult: LoadDraftResult | null;
}

/**
 * 전체 파이프라인 실행.
 * 실패한 Stage 가 있으면 이후 Stage 전부 skipped (데이터 오염 방어).
 */
export async function runPipeline(ctx: PipelineContext): Promise<PipelineResult> {
  const stages: StageResult[] = [];
  const state: PipelineState = {
    pdfPages: null,
    sections: null,
    tables: null,
    contract: null,
    graphNodes: [],
    graphEdges: [],
    loadResult: null,
  };

  let aborted = false;
  let qg2Result: QG2Result | null = null;

  for (const stage of PIPELINE_STAGES) {
    if (aborted) {
      stages.push({
        stage,
        status: 'skipped',
        message: 'Previous stage failed — skipped',
        durationMs: 0,
      });
      continue;
    }

    const result = await runStage(stage, ctx, state);
    if (stage === 'qg2_gate' && result.data) {
      qg2Result = result.data as QG2Result;
    }
    stages.push(result);
    if (result.status === 'failed') {
      aborted = true;
    }
  }

  return {
    batchId: ctx.batchId,
    stages,
    qg2Passed: qg2Result?.passed ?? false,
    qg2Result,
    contract: state.contract,
    loadResult: state.loadResult,
  };
}

async function runStage(
  stage: PipelineStage,
  ctx: PipelineContext,
  state: PipelineState,
): Promise<StageResult> {
  const started = Date.now();
  try {
    switch (stage) {
      case 'pdf_extract':
        return await stagePdfExtract(ctx, state, started);
      case 'section_split':
        return await stageSectionSplit(ctx, state, started);
      case 'vision_ocr':
        return await stageVisionOcr(ctx, state, started);
      case 'batch_structurize':
        return await stageBatchStructurize(ctx, state, started);
      case 'constants_extract':
        return await stageConstantsExtract(ctx, state, started);
      case 'db_load':
        return await stageDbLoad(ctx, state, started);
      case 'integrity_check':
        return await stageIntegrityCheck(ctx, state, started);
      case 'human_review':
        return stageHumanReview(ctx, started);
      case 'formula_verify':
        return await stageFormulaVerify(ctx, started);
      case 'qg2_gate':
        return await stageQg2Gate(ctx, state, started);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      stage,
      status: 'failed',
      message: msg,
      durationMs: Date.now() - started,
    };
  }
}

// ---------------------------------------------------------------------------
// Stage implementations
// ---------------------------------------------------------------------------

async function stagePdfExtract(
  ctx: PipelineContext,
  state: PipelineState,
  started: number,
): Promise<StageResult> {
  if (ctx.fixtureContract) {
    state.contract = ctx.fixtureContract;
    return {
      stage: 'pdf_extract',
      status: 'skipped',
      message: 'Fixture mode: contract injected directly',
      durationMs: Date.now() - started,
    };
  }
  if (!ctx.pdfPath) throw new Error('pdfPath is required (or use fixtureContract)');
  const pagesArg = `${ctx.config.pageStart}-${ctx.config.pageEnd}`;
  const extracted = await extractPdf(ctx.pdfPath, { pages: pagesArg });
  state.pdfPages = extracted;
  return {
    stage: 'pdf_extract',
    status: 'success',
    message: `Extracted ${extracted.extractedPages}/${extracted.totalPages} pages (range ${pagesArg})`,
    durationMs: Date.now() - started,
  };
}

async function stageSectionSplit(
  ctx: PipelineContext,
  state: PipelineState,
  started: number,
): Promise<StageResult> {
  if (ctx.fixtureContract) {
    return {
      stage: 'section_split',
      status: 'skipped',
      message: 'Fixture mode',
      durationMs: Date.now() - started,
    };
  }
  if (!state.pdfPages) throw new Error('Section split requires PDF extract result');
  const sections = splitSections(state.pdfPages.pages);
  const tables = extractTables(state.pdfPages.pages);
  state.sections = sections;
  state.tables = tables;
  return {
    stage: 'section_split',
    status: 'success',
    message: `Split ${sections.sections.length} sections, ${tables.tables.length} tables`,
    durationMs: Date.now() - started,
  };
}

async function stageVisionOcr(
  ctx: PipelineContext,
  state: PipelineState,
  started: number,
): Promise<StageResult> {
  if (!ctx.enableVisionOcr || ctx.visionClient === null) {
    return {
      stage: 'vision_ocr',
      status: 'skipped',
      message: 'Vision OCR disabled (enableVisionOcr=false or visionClient=null)',
      durationMs: Date.now() - started,
    };
  }
  if (!state.pdfPages || !state.tables) {
    throw new Error('Vision OCR requires pdf_extract + section_split');
  }
  const candidates = selectVisionCandidates(state.pdfPages.pages, state.tables.tables);
  // 가-0: processVisionPage 는 NotImplementedError throw — 의도된 가드.
  // 실제 호출은 가-1 에서 활성. 여기서는 candidate 통계만 보고.
  return {
    stage: 'vision_ocr',
    status: 'skipped',
    message: `${candidates.length} vision candidates detected (real call deferred to 가-1)`,
    durationMs: Date.now() - started,
    data: candidates,
  };
}

async function stageBatchStructurize(
  ctx: PipelineContext,
  state: PipelineState,
  started: number,
): Promise<StageResult> {
  if (ctx.fixtureContract) {
    // contract 이미 stagePdfExtract 에서 주입됨 — 재검증만 수행 (무음 실패 방어)
    const validation = validateKnowledgeContract(ctx.fixtureContract);
    if (!validation.valid) {
      throw new Error(
        `Fixture contract invalid: ${validation.errors.length} errors. ` +
          `First: ${validation.errors[0]?.path}: ${validation.errors[0]?.code}`,
      );
    }
    return {
      stage: 'batch_structurize',
      status: 'skipped',
      message: `Fixture mode: contract re-validated (${validation.stats.nodesValidated} nodes)`,
      durationMs: Date.now() - started,
    };
  }

  if (!state.sections || !state.tables) {
    throw new Error('Batch structurize requires section_split result');
  }
  if (!ctx.claudeClient) {
    throw new Error('Batch structurize requires claudeClient');
  }

  const input: BatchInput = {
    sections: state.sections.sections,
    tables: state.tables.tables,
    batchId: ctx.batchId,
    pageRange: { start: ctx.config.pageStart, end: ctx.config.pageEnd },
  };

  const result = await processBatch(ctx.claudeClient, input);
  if (result.error) {
    throw new Error(`batch-processor: ${result.error}`);
  }
  if (!result.contract) {
    throw new Error('batch-processor returned null contract without error');
  }

  // 2차 검증 (processBatch 내부에서 이미 수행되었으나 방어적 재검증)
  const validation = validateKnowledgeContract(result.contract);
  if (!validation.valid) {
    throw new Error(
      `contract validation failed: ${validation.errors.length} errors. ` +
        `First: ${validation.errors[0]?.path}: ${validation.errors[0]?.code}`,
    );
  }

  state.contract = result.contract;
  return {
    stage: 'batch_structurize',
    status: 'success',
    message:
      `Contract: ${result.contract.nodes.length} nodes / ${result.contract.edges.length} edges / ` +
      `${result.contract.formulas.length} formulas / ${result.contract.constants.length} constants`,
    durationMs: Date.now() - started,
  };
}

async function stageConstantsExtract(
  _ctx: PipelineContext,
  state: PipelineState,
  started: number,
): Promise<StageResult> {
  if (!state.contract) throw new Error('Constants extract requires contract');
  const enriched = enrichConstants(state.contract.constants);
  return {
    stage: 'constants_extract',
    status: 'success',
    message:
      `Enriched ${enriched.stats.total} constants | ` +
      `danger=${enriched.stats.danger} warn=${enriched.stats.warn} safe=${enriched.stats.safe}`,
    durationMs: Date.now() - started,
    data: enriched,
  };
}

async function stageDbLoad(
  ctx: PipelineContext,
  state: PipelineState,
  started: number,
): Promise<StageResult> {
  if (!state.contract) throw new Error('DB load requires contract');

  if (ctx.dryRun) {
    mkdirSync(ctx.outDir, { recursive: true });
    const outPath = join(ctx.outDir, `${ctx.batchId}-contract.json`);
    writeFileSync(outPath, JSON.stringify(state.contract, null, 2), 'utf-8');
    return {
      stage: 'db_load',
      status: 'success',
      message: `Dry-run: contract snapshot → ${outPath}`,
      durationMs: Date.now() - started,
    };
  }

  if (!ctx.db) throw new Error('DB load requires db handle (dryRun=false)');

  const loadCtx: LoadDraftContext = {
    batchId: ctx.batchId,
    versionYear: ctx.versionYear,
    pageRangeStart: ctx.config.pageStart,
    pageRangeEnd: ctx.config.pageEnd,
    defaultAppliesTo: ctx.config.defaultAppliesTo,
    defaultInsuranceType: ctx.config.defaultInsuranceType,
  };
  const loadResult = await loadDraft(ctx.db, state.contract, loadCtx);
  state.loadResult = loadResult;

  return {
    stage: 'db_load',
    status: 'success',
    message:
      `Loaded draft: ${loadResult.nodesInserted} nodes / ${loadResult.edgesInserted} edges / ` +
      `${loadResult.formulasInserted} formulas / ${loadResult.constantsInserted} constants ` +
      `(${loadResult.skippedIds.length} skipped idempotent)`,
    durationMs: Date.now() - started,
  };
}

async function stageIntegrityCheck(
  _ctx: PipelineContext,
  state: PipelineState,
  started: number,
): Promise<StageResult> {
  if (!state.contract) throw new Error('Integrity check requires contract');

  // schema-validator 통과 후이므로 type/edge_type 캐스트 안전.
  const nodes: GraphNode[] = state.contract.nodes.map((n) => ({
    id: n.id,
    type: n.type as NodeType,
    name: n.title,
    isActive: true,
  }));
  const edges: GraphEdge[] = state.contract.edges.map((e, i) => ({
    id: `E-${i}`,
    fromNode: e.source_id,
    toNode: e.target_id,
    edgeType: e.edge_type as EdgeType,
    isActive: true,
  }));
  state.graphNodes = nodes;
  state.graphEdges = edges;

  const report = validateGraphIntegrity(nodes, edges);
  if (
    report.stats.orphanNodes > 0 ||
    report.stats.brokenEdges > 0 ||
    report.stats.supersedeCycles > 0
  ) {
    throw new Error(
      `Graph integrity violation: orphans=${report.stats.orphanNodes} ` +
        `broken=${report.stats.brokenEdges} cycles=${report.stats.supersedeCycles}`,
    );
  }

  return {
    stage: 'integrity_check',
    status: 'success',
    message: 'Graph integrity OK: 0 orphans / 0 broken edges / 0 SUPERSEDES cycles',
    durationMs: Date.now() - started,
  };
}

function stageHumanReview(ctx: PipelineContext, started: number): StageResult {
  // 자동 파이프라인에서는 항상 skipped. CLI `thepick-batch status` 로 별도 전이.
  return {
    stage: 'human_review',
    status: 'skipped',
    message: ctx.dryRun
      ? 'Human review skipped (dry-run)'
      : 'Human review deferred to CLI `thepick-batch status`',
    durationMs: Date.now() - started,
  };
}

async function stageFormulaVerify(ctx: PipelineContext, started: number): Promise<StageResult> {
  if (ctx.goldenTests.length === 0) {
    return {
      stage: 'formula_verify',
      status: 'skipped',
      message: 'No golden tests provided',
      durationMs: Date.now() - started,
    };
  }
  const checks = checkFormulaAccuracy(ctx.goldenTests);
  const failed = checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    throw new Error(
      `Formula verify failed: ${failed.length}/${checks.length} ` +
        `(sample: ${failed[0].name} expected=${failed[0].expected} actual=${failed[0].actual})`,
    );
  }
  return {
    stage: 'formula_verify',
    status: 'success',
    message: `Formula golden tests 100% passed (${checks.length}/${checks.length})`,
    durationMs: Date.now() - started,
  };
}

async function stageQg2Gate(
  ctx: PipelineContext,
  state: PipelineState,
  started: number,
): Promise<StageResult> {
  const nodes = state.graphNodes.length > 0 ? state.graphNodes : [];
  const edges = state.graphEdges.length > 0 ? state.graphEdges : [];
  const result = runQG2Validation(nodes, edges, ctx.goldenTests);

  return {
    stage: 'qg2_gate',
    status: result.passed ? 'success' : 'failed',
    message: result.summary,
    durationMs: Date.now() - started,
    data: result,
  };
}
