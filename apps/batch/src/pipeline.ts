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
import { validateGraphIntegrity, SupersedeChainTooDeepError } from '@thepick/quality';
import type { GraphNode, GraphEdge } from '@thepick/quality';
import {
  assertValidExamId,
  createLogger,
  type ExamId,
  type Logger,
  type LoggerEnvironment,
  type NodeType,
  type EdgeType,
} from '@thepick/shared';
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
import {
  buildCheckpoint,
  writeCheckpoint,
  writeCheckpointSync,
  type PipelineStateSnapshot,
} from './checkpoint.js';
import { recoverBatch, type BatchRunsDb, type RecoveryStatus } from './recover.js';
import { CostMeter } from './cost-meter.js';
import { installSignalHandlers } from './signal-handlers.js';
import type { TelemetryClient } from './adapters/telemetry-client.js';

// Step 18 MINOR-A3 — 모듈 스코프 logger. 9건 console.error/warn 교체 + Workers Observability JSON.
const VALID_LOGGER_ENVS: ReadonlySet<string> = new Set([
  'development',
  'staging',
  'production',
  'test',
]);
const _envName = process.env.NODE_ENV;
const pipelineLog: Logger = createLogger({
  service: 'thepick-batch-pipeline',
  environment:
    _envName !== undefined && VALID_LOGGER_ENVS.has(_envName)
      ? (_envName as LoggerEnvironment)
      : 'development',
});

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

/**
 * batch_runs 메타테이블 영구화 실패 — 운영 드리프트 가시화 (Step 11.6 SF-C-3 / SF-M-4 / SF-C-2 옵션 C / SF-DA-1).
 *
 * 발생 시점:
 *   - stage 실패 후 `state='failed'` UPDATE 가 throw (D1 단절 / 0015 트리거 RAISE(ABORT))
 *   - 정상 완료 후 `state='completed'` UPDATE 가 throw
 *   - stage 성공 후 `state='in_progress'` UPDATE 가 throw
 *   - SIGINT/SIGTERM handler 의 `state='killed'` UPDATE 가 process.exit 직전 도달 못 함
 *   - finally `removeHandlers()` / `costMeter.finalize()` throw — process listener leak / meter resource leak
 *
 * caller (CLI / 모니터링) 는 `metaPersistenceFailures.length > 0` 시 alarm 의무 — 24h stale lock 위험.
 */
export interface MetaPersistenceFailure {
  readonly stage: PipelineStage | 'completed_transition' | 'sigint_kill' | 'finalize';
  readonly operation:
    | 'state_failed'
    | 'state_completed'
    | 'state_in_progress'
    | 'state_killed'
    | 'finalize_handlers'
    | 'finalize_costmeter'
    | 'finalize_telemetry';
  readonly reason: string;
}

/**
 * PipelineResult.recoveryStatus 가 도달 가능한 4 literal — caller exhaustive switch 검증용.
 * `concurrent_run_detected` / `recovery_failed` 는 throw 후 도달 X (PipelineResult 미반환) → 타입에서 제외.
 */
export type ReturnedRecoveryStatus = Exclude<
  RecoveryStatus,
  'concurrent_run_detected' | 'recovery_failed'
>;

export interface PipelineResult {
  readonly batchId: string;
  readonly stages: readonly StageResult[];
  readonly qg2Passed: boolean;
  readonly qg2Result: QG2Result | null;
  readonly contract: KnowledgeContract | null;
  readonly loadResult: LoadDraftResult | null;
  /**
   * recover() 분기 결과 — caller 가 'already_completed' Idempotency skip 을 'qg2 fail' 로
   * 오분류하는 false negative 차단 (Step 11.6 Q-M-2 정정).
   * 4 literal narrow (ReturnedRecoveryStatus) — throw 케이스 2종 자동 제외.
   */
  readonly recoveryStatus: ReturnedRecoveryStatus;
  /**
   * batch_runs UPDATE 영구화 실패 누적 — 빈 배열 = 메타 일관 유지.
   * 1건 이상 = caller alarm 의무 (24h stale lock 차단). 위 MetaPersistenceFailure JSDoc 참조.
   */
  readonly metaPersistenceFailures: readonly MetaPersistenceFailure[];
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
  /**
   * PDF pages 주입 (non-fixture 통합 테스트용 — CR-5b).
   * 실제 pdfplumber subprocess 호출 없이 Stage 1 을 injected 상태로 표시한 뒤
   * Stage 2 (section_split) / Stage 3 (batch_structurize) 를 **실경로로** 수행한다.
   * fixtureContract 가 있으면 본 필드는 무시된다.
   */
  readonly pdfPagesOverride?: Awaited<ReturnType<typeof extractPdf>>;

  // === Step 11.6 신규 필드 — recover/checkpoint/CostMeter 통합 ===

  /**
   * 시험 식별자 — Hard Rule 16/17 정합 (Year 1 한시 예외).
   *
   * Year 1: required, 단일 시험 (`EXAM_IDS.SON_HAE_PYEONG_GA_SA`).
   * Year 2 Phase 4: BatchRunsDb 내부 SQL 의 `WHERE exam_id = ?` 자동 활성 — 호출 측 코드 변경 0건.
   *
   * 본 필드 부재가 backend-architect C-2 결함 정정의 핵심 (Year 2 cross-tenant recover 차단).
   */
  readonly examId: ExamId;
  /** 1회 BATCH 실행 식별 UUID. recover 시 동일 ID 로 재진입. */
  readonly batchRunId: string;
  /** Checkpoint 저장 베이스 디렉토리 (예: `.checkpoint/`). */
  readonly checkpointBaseDir: string;
  /** D1 batch_runs 테이블 어댑터. recover/insertNewRun/updateState 에 사용. */
  readonly batchRunsDb: BatchRunsDb;
  /** 패키지 버전 — checkpoint engine_version 필드 + recover 시 major 비교. */
  readonly engineVersion: string;
  /** CostMeter 주입 — 미주입 시 비용 계측 없이 실행 (테스트용 허용, production 의무). */
  readonly costMeter?: CostMeter;
  /** SIGINT/SIGTERM 시 checkpoint flush 활성화 (기본 true). 테스트에서 false 가능. */
  readonly enableSignalHandlers?: boolean;
  /** writeCheckpoint fsync 강제 (기본 true). 테스트에서 false 가능. */
  readonly fsyncCheckpoint?: boolean;
  /**
   * TelemetryClient 주입 — POST /api/telemetry 8 게이지 emit (Step 037 CRITICAL-DO-S1-1).
   * 미주입 시 emit silently skip. production 의무 (memory project_engine_observability).
   * createTelemetryClientFromEnv() 가 ENV 미설정 시 NoopTelemetryClient 반환하므로
   * caller 는 항상 한 인스턴스 주입 권장 (production 8 게이지 활성, dev/test 자동 noop).
   */
  readonly telemetryClient?: TelemetryClient;
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
 * PipelineState → PipelineStateSnapshot 변환 helper (Step 11.6).
 *
 * 직렬화 가능한 부분만 추출: last_inserted_node_id / last_completed_stage /
 * nodes_processed / edges_processed / stage_results.
 *
 * pdfPages / sections / tables / graphNodes / graphEdges 등은 외부 라이브러리
 * 객체 또는 derived state — checkpoint 에 포함하지 않고 resume 시 재계산.
 *
 * last_inserted_node_id 우선순위:
 *   1. state.loadResult.lastInsertedNodeId (Step 5 deterministic 적재 채움)
 *   2. state.contract.nodes 마지막 ID (폴백)
 *   3. null (contract 부재 또는 빈 nodes)
 */
function toSnapshot(
  state: PipelineState,
  stages: readonly StageResult[],
  lastCompletedStage: PipelineStage,
): PipelineStateSnapshot {
  const lastNode = state.contract?.nodes[state.contract.nodes.length - 1];
  const last_inserted_node_id = state.loadResult?.lastInsertedNodeId ?? lastNode?.id ?? null;

  const stage_results = Object.fromEntries(
    PIPELINE_STAGES.map((s) => {
      const result = stages.find((r) => r.stage === s);
      return [
        s,
        {
          status: result?.status ?? ('pending' as const),
          durationMs: result?.durationMs ?? 0,
        },
      ];
    }),
  ) as PipelineStateSnapshot['stage_results'];

  return {
    last_inserted_node_id,
    last_completed_stage: lastCompletedStage,
    nodes_processed: state.contract?.nodes.length ?? 0,
    edges_processed: state.contract?.edges.length ?? 0,
    stage_results,
  };
}

/**
 * recover() 분기 결과 — 동시 실행 차단 (concurrent_run_detected) 시 throw.
 * caller (CLI / 통합 테스트) 가 별도 catch 후 진산님 결정 트리거.
 */
export class ConcurrentRunError extends Error {
  constructor(
    public readonly batchRunId: string,
    message: string,
  ) {
    super(message);
    this.name = 'ConcurrentRunError';
  }
}

/**
 * recover() 분기 결과 — 무결성 검증 실패 / 버전 불일치 / depends_on 미구현 시 throw.
 * caller 가 별도 catch 후 진산님 검수 트리거.
 */
export class RecoveryFailedError extends Error {
  constructor(
    public readonly batchRunId: string,
    message: string,
  ) {
    super(message);
    this.name = 'RecoveryFailedError';
  }
}

/**
 * already_completed (Idempotency skip) 시 반환할 PipelineResult.
 * 모든 stage 를 'skipped' 로 표기 — 재실행 호출자가 정상 결과처럼 처리 가능.
 */
function buildSkipResult(ctx: PipelineContext, message: string): PipelineResult {
  return {
    batchId: ctx.batchId,
    stages: PIPELINE_STAGES.map((stage) => ({
      stage,
      status: 'skipped' as const,
      message,
      durationMs: 0,
    })),
    qg2Passed: false,
    qg2Result: null,
    contract: null,
    loadResult: null,
    recoveryStatus: 'already_completed',
    metaPersistenceFailures: [],
  };
}

/**
 * SIGINT/SIGTERM handler 가 fire-and-forget 으로 호출 — process.exit 직전 await 불가.
 * 실패 시 pipelineLog.error 로 가시화 (silent failure 차단, CRITICAL RULE #3).
 */
async function markBatchRunKilled(
  examId: ExamId,
  batchRunId: string,
  batchRunsDb: BatchRunsDb,
): Promise<void> {
  await batchRunsDb.updateState(examId, batchRunId, { state: 'killed' });
}

/**
 * 전체 파이프라인 실행 — recover/checkpoint/CostMeter 통합 (Step 11.6).
 *
 * 실행 흐름:
 *   0.  recoverBatch() 호출 → 5가지 status 분기
 *       - already_completed → buildSkipResult 즉시 반환 (Idempotency)
 *       - concurrent_run_detected → ConcurrentRunError throw
 *       - recovery_failed → RecoveryFailedError throw
 *       - no_checkpoint → batch_runs INSERT (insertNewRun)
 *       - fully_recovered / partially_recovered → resume from last_completed_stage+1
 *   0.7 SIGINT/SIGTERM handler 등록 (lastSnapshot closure flush)
 *   0.9 CostMeter.start()
 *   1~9 stage loop:
 *       - resume index 이전 stage 는 'Resumed from later stage' 로 skip
 *       - aborted (이전 stage failed) 면 'Previous stage failed' 로 skip
 *       - runStage 호출 → success/failed
 *       - failed: batch_runs state='failed' + aborted=true
 *       - success: toSnapshot + buildCheckpoint + writeCheckpoint(fsync) + state='in_progress'
 *   10. 정상 완료 시 batch_runs state='completed'
 *   finally: removeHandlers + costMeter.finalize()
 */
export async function runPipeline(ctx: PipelineContext): Promise<PipelineResult> {
  // === 0. caller 진입점 EXAM_IDS allowlist 검증 (Hard Rule 17 외부 입력 방어선) ===
  // brand type ExamId 는 컴파일 타임 보호만 제공. JSON deserialization / `as ExamId`
  // 캐스팅 / `@ts-expect-error` 우회 시 임의 string 진입 가능. runPipeline 진입 1회
  // strict 차단 후 internal 코드 경로는 brand type 보호만으로 안전 보장.
  // 근거: .claude/reviews/step16b-pass12-20260430-110057.md Pass 2 반론 흡수 (Step 16c).
  assertValidExamId(ctx.examId);

  // Step 19 MINOR-A1 흡수: pipelineLog.child() 1회 생성 + 매 호출 inline context 제거.
  // batchRunId/examId 컨텍스트는 child 에 누적, 호출 측은 stage/operation 등 이벤트별 컨텍스트만 명시.
  const log = pipelineLog.child({ batchRunId: ctx.batchRunId, examId: ctx.examId });

  // === 0.1 recover 시도 ===
  const recovery = await recoverBatch({
    examId: ctx.examId,
    batchRunId: ctx.batchRunId,
    baseDir: ctx.checkpointBaseDir,
    currentEngineVersion: ctx.engineVersion,
    batchRunsDb: ctx.batchRunsDb,
  });

  if (recovery.status === 'already_completed') {
    return buildSkipResult(ctx, recovery.message);
  }
  if (recovery.status === 'concurrent_run_detected') {
    throw new ConcurrentRunError(ctx.batchRunId, recovery.message);
  }
  if (recovery.status === 'recovery_failed') {
    throw new RecoveryFailedError(ctx.batchRunId, recovery.message);
  }

  // resume 시 last_completed_stage 의 *다음* stage 부터 재시작 (Plan §4.2)
  const resumeFromStageIndex =
    (recovery.status === 'fully_recovered' || recovery.status === 'partially_recovered') &&
    recovery.resumed_from_stage !== null
      ? PIPELINE_STAGES.indexOf(recovery.resumed_from_stage) + 1
      : 0;

  // === 0.5 batch_runs INSERT (no_checkpoint) — recover.ts 가 이미 'recovered' UPDATE 수행 ===
  if (recovery.status === 'no_checkpoint') {
    if (!ctx.batchRunsDb.insertNewRun) {
      throw new Error(
        '[runPipeline] BatchRunsDb.insertNewRun is required for new run path. ' +
          'D1BatchRunsDb implements; mocks must add insertNewRun for new run scenarios.',
      );
    }
    // 0015 BEFORE INSERT 트리거 가 completed 재INSERT 시 RAISE(ABORT) — caller 에 throw 전파.
    await ctx.batchRunsDb.insertNewRun(ctx.examId, {
      batchRunId: ctx.batchRunId,
      fixturePath: ctx.pdfPath ?? '<fixture>',
      engineVersion: ctx.engineVersion,
    });
  }

  // === metaPersistenceFailures 누적 — runPipeline 종료 시 PipelineResult 에 포함 ===
  const metaPersistenceFailures: MetaPersistenceFailure[] = [];

  // === 0.7 SIGINT/SIGTERM handler 등록 ===
  let lastSnapshot: PipelineStateSnapshot | null = null;
  const removeHandlers =
    ctx.enableSignalHandlers !== false
      ? installSignalHandlers({
          flushCheckpoint: () => {
            if (lastSnapshot === null) return;
            const cp = buildCheckpoint({
              examId: ctx.examId,
              batchRunId: ctx.batchRunId,
              engineVersion: ctx.engineVersion,
              currentStage: lastSnapshot.last_completed_stage,
              currentStageIndex: PIPELINE_STAGES.indexOf(lastSnapshot.last_completed_stage),
              totalStages: PIPELINE_STAGES.length,
              snapshot: lastSnapshot,
              costState: ctx.costMeter ? ctx.costMeter.toCheckpointCostState() : undefined,
            });
            writeCheckpointSync(cp, ctx.checkpointBaseDir, {
              fsync: ctx.fsyncCheckpoint ?? true,
            });
            // best-effort — process.exit 직전이라 await 불가. 실패 시 logger.error + metaPersistenceFailures 누적
            // (옵션 C: caller 가 PipelineResult 미수신해도 JSON 로그가 운영 alarm 트리거).
            markBatchRunKilled(ctx.examId, ctx.batchRunId, ctx.batchRunsDb).catch((err) => {
              const reason = err instanceof Error ? err.message : String(err);
              log.error('markBatchRunKilled failed (best-effort)', err, {
                stage: 'sigint_kill',
                bestEffort: true,
              });
              metaPersistenceFailures.push({
                stage: 'sigint_kill',
                operation: 'state_killed',
                reason,
              });
            });
          },
        })
      : () => {
          /* test mode — handler 미등록 */
        };

  // === 0.9 CostMeter start ===
  ctx.costMeter?.start();

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

  try {
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      const stage = PIPELINE_STAGES[i] as PipelineStage;

      // resume 시 이전 stage 들 skip
      if (i < resumeFromStageIndex) {
        stages.push({
          stage,
          status: 'skipped',
          message: 'Resumed from later stage',
          durationMs: 0,
        });
        continue;
      }

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
        try {
          await ctx.batchRunsDb.updateState(ctx.examId, ctx.batchRunId, {
            state: 'failed',
            last_completed_stage: stage,
          });
        } catch (err) {
          // 0015 트리거 (state='completed' 차단 등) 가 RAISE(ABORT) 가능 — 가시화 + 누적 후 흐름 계속 (SF-C-3 정정)
          const reason = err instanceof Error ? err.message : String(err);
          log.error('batch_runs UPDATE state=failed 실패', err, {
            stage,
            operation: 'state_failed',
          });
          metaPersistenceFailures.push({ stage, operation: 'state_failed', reason });
        }
        continue;
      }

      if (result.status === 'success') {
        lastSnapshot = toSnapshot(state, stages, stage);
        // === Step 037 telemetry — batch_progress emit (success 시 1회) ===
        // 단위: 0~1 ratio (migrations/0017_engine_telemetry.sql:26 정의 정합).
        // admin-web 표시 시 percent 변환은 dashboard 측 책임.
        ctx.telemetryClient?.emit({
          gaugeName: 'batch_progress',
          metricValue: (i + 1) / PIPELINE_STAGES.length,
          metricJson: {
            currentStage: stage,
            stageIndex: i,
            totalStages: PIPELINE_STAGES.length,
            durationMs: result.durationMs,
          },
          sourceId: `pipeline:${stage}`,
        });
        const cp = buildCheckpoint({
          examId: ctx.examId,
          batchRunId: ctx.batchRunId,
          engineVersion: ctx.engineVersion,
          currentStage: stage,
          currentStageIndex: i,
          totalStages: PIPELINE_STAGES.length,
          snapshot: lastSnapshot,
          costState: ctx.costMeter ? ctx.costMeter.toCheckpointCostState() : undefined,
        });
        await writeCheckpoint(cp, ctx.checkpointBaseDir, {
          fsync: ctx.fsyncCheckpoint ?? true,
        });
        try {
          await ctx.batchRunsDb.updateState(ctx.examId, ctx.batchRunId, {
            state: 'in_progress',
            last_completed_stage: stage,
            last_node_id: lastSnapshot.last_inserted_node_id,
            state_hash: cp.state_hash,
          });
        } catch (err) {
          // SF-M-4 일관성 — checkpoint 는 이미 쓴 후라 파이프라인 진행 가능. 메타만 가시화 + 누적.
          const reason = err instanceof Error ? err.message : String(err);
          log.error('batch_runs UPDATE state=in_progress 실패', err, {
            stage,
            operation: 'state_in_progress',
          });
          metaPersistenceFailures.push({ stage, operation: 'state_in_progress', reason });
        }
      }
    }

    // === 정상 완료 시 'completed' 전이 ===
    if (!aborted) {
      try {
        await ctx.batchRunsDb.updateState(ctx.examId, ctx.batchRunId, {
          state: 'completed',
          completed_at: new Date().toISOString(),
        });
      } catch (err) {
        // SF-M-4 — completed UPDATE 실패 시 PipelineResult 는 정상 반환하되 metaPersistenceFailures 로 가시화.
        const reason = err instanceof Error ? err.message : String(err);
        log.error('batch_runs UPDATE state=completed 실패', err, {
          operation: 'state_completed',
        });
        metaPersistenceFailures.push({
          stage: 'completed_transition',
          operation: 'state_completed',
          reason,
        });
      }
      // === Step 037 telemetry — cost emit (정상 완료 시 1회) ===
      // 단위: micro_cents 정수 (migrations/0017_engine_telemetry.sql:27 정의 정합).
      // 1 USD = 100 cents = 100_000_000 micro_cents (정수 회계 표준).
      // metricJson 에 USD float 동시 보존 — admin-web 측 표시 편의.
      if (ctx.costMeter) {
        const costState = ctx.costMeter.toCheckpointCostState();
        ctx.telemetryClient?.emit({
          gaugeName: 'cost',
          metricValue: Math.round(costState.initial_spend_usd * 100_000_000),
          metricJson: {
            spendUsd: costState.initial_spend_usd,
            callCount: costState.call_count,
            thresholdBreaches: costState.threshold_breaches.length,
            breaches: costState.threshold_breaches,
          },
          sourceId: 'pipeline:completed',
        });
      }
    }
  } finally {
    try {
      removeHandlers();
    } catch (err) {
      // SF-DA-1 일관성 — B1 패턴 그대로 push (process listener leak 가시화)
      const reason = err instanceof Error ? err.message : String(err);
      log.error('removeHandlers 실패 (logged only)', err, {
        operation: 'finalize_handlers',
      });
      metaPersistenceFailures.push({
        stage: 'finalize',
        operation: 'finalize_handlers',
        reason,
      });
    }
    if (ctx.costMeter) {
      try {
        ctx.costMeter.finalize();
      } catch (err) {
        // SF-DA-1 일관성 — meter resource leak 가시화
        const reason = err instanceof Error ? err.message : String(err);
        log.error('CostMeter finalize 실패 (logged only)', err, {
          operation: 'finalize_costmeter',
        });
        metaPersistenceFailures.push({
          stage: 'finalize',
          operation: 'finalize_costmeter',
          reason,
        });
      }
    }
    // === Step 037 telemetry — flushPending (in-flight emit drain) ===
    // emit 은 fire-and-forget 이므로 finally 단계에서 모든 in-flight Promise 대기.
    // 미주입 또는 NoopTelemetryClient 시 즉시 resolve.
    //
    // try/catch defensive only: flushPending 내부는 Promise.allSettled 사용 — 정상 경로에서
    // throw 도달 불가능 (모든 emit 실패는 logger.error 로 swallow). 본 catch 는 미래
    // 구현 변경 (예: allSettled → all 회귀) 시 BATCH crash 차단용 방어선.
    // SIGINT 경로 누수: signal-handlers.ts 의 process.exit 직전에는 flushPending 미호출 —
    // best-effort 로 in-flight emit 손실 허용 (BATCH 비정상 종료 = 운영 alarm 로 가시화).
    if (ctx.telemetryClient) {
      try {
        await ctx.telemetryClient.flushPending();
      } catch (err) {
        // SF-DA-1 일관성 — telemetry leak 가시화 (best-effort, BATCH 결과에 영향 없음)
        const reason = err instanceof Error ? err.message : String(err);
        log.error('TelemetryClient flushPending 실패 (logged only)', err, {
          operation: 'finalize_telemetry',
        });
        metaPersistenceFailures.push({
          stage: 'finalize',
          operation: 'finalize_telemetry',
          reason,
        });
      }
    }
  }

  return {
    batchId: ctx.batchId,
    stages,
    qg2Passed: qg2Result?.passed ?? false,
    qg2Result,
    contract: state.contract,
    loadResult: state.loadResult,
    recoveryStatus: recovery.status,
    metaPersistenceFailures,
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
  if (ctx.pdfPagesOverride) {
    // non-fixture 통합 테스트 경로 (CR-5b) — pdfplumber subprocess 우회 후
    // Stage 2/3 는 실경로로 진행.
    state.pdfPages = ctx.pdfPagesOverride;
    return {
      stage: 'pdf_extract',
      status: 'success',
      message: `Injected ${ctx.pdfPagesOverride.extractedPages}/${ctx.pdfPagesOverride.totalPages} pages (test override)`,
      durationMs: Date.now() - started,
    };
  }
  if (!ctx.pdfPath)
    throw new Error('pdfPath is required (or use fixtureContract / pdfPagesOverride)');
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

  // === CostMeter 통합 (Step 11.6 §4.3.2) ===
  // processBatch 가 usage 미반환 시 (result.usage===null) skip + warn — silent failure 차단.
  if (ctx.costMeter) {
    if (result.usage) {
      const status = ctx.costMeter.recordTokens(
        result.usage.inputTokens,
        result.usage.outputTokens,
        result.usage.model,
        'batch_structurize',
      );
      if (status === 'hard_throttle') {
        await ctx.costMeter.applyThrottle();
      }
      // 'kill_switch' 는 autoEnforce=true 시 onKillSwitch 콜백이 throw — 여기 도달 X.
    } else {
      // Step 19 MINOR-A1 잔존 (의도) — stageBatchStructurize 는 runPipeline 외부 함수라
      // log child 비공유. inline context 유지가 의도된 패턴 (stage 헬퍼는 ctx 만 받음).
      pipelineLog.warn('processBatch returned null usage — CostMeter skip for this call', {
        batchRunId: ctx.batchRunId,
        examId: ctx.examId,
        stage: 'batch_structurize',
      });
    }
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
    examId: ctx.examId,
    batchId: ctx.batchId,
    batchRunId: ctx.batchRunId,
    versionYear: ctx.versionYear,
    pageRangeStart: ctx.config.pageStart,
    pageRangeEnd: ctx.config.pageEnd,
    defaultAppliesTo: ctx.config.defaultAppliesTo,
    defaultInsuranceType: ctx.config.defaultInsuranceType,
  };
  const loadResult = await loadDraft(ctx.db, state.contract, loadCtx);
  state.loadResult = loadResult;

  // === Step 037 telemetry — d1_slo emit (D1 batch insert latency, ms) ===
  ctx.telemetryClient?.emit({
    gaugeName: 'd1_slo',
    metricValue: loadResult.durationMs,
    metricJson: {
      nodesInserted: loadResult.nodesInserted,
      edgesInserted: loadResult.edgesInserted,
      formulasInserted: loadResult.formulasInserted,
      constantsInserted: loadResult.constantsInserted,
      skipped: loadResult.skippedIds.length,
    },
    sourceId: 'pipeline:db_load',
  });

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
  ctx: PipelineContext,
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

  // Sprint 1 §5.1 4-Pass CRITICAL-1 흡수 (Pass 2/3, 2026-05-01): SupersedeChainTooDeepError
  // 명시 분기 — error code/depth/maxDepth 메타데이터 손실 차단. caller 가 일반 Error
  // 로 강등되어 admin-web/SIEM 추적 불가능했던 silent breaking change 해소.
  let report;
  try {
    report = validateGraphIntegrity(nodes, edges);
  } catch (err) {
    if (err instanceof SupersedeChainTooDeepError) {
      throw new Error(
        `Graph integrity violation [SUPERSEDE_CHAIN_TOO_DEEP]: ` +
          `chain depth>=${err.depth} (max=${err.maxDepth}). ` +
          `Fixture corruption or malicious input — manual review required.`,
      );
    }
    throw err;
  }
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

  // === Step 037 telemetry — graph_integrity emit (성공 분기 전용) ===
  // 단위: violations_count (migrations/0017_engine_telemetry.sql:29 정의 정합).
  // 0 = PASS, ≥1 = violation count. 위반 분기는 throw 후 runStage 가 status='failed' 로 wrap.
  // 본 emit 은 성공 분기에 도달 = orphan + broken + cycles 모두 0 — metricValue 항상 0.
  const violations =
    report.stats.orphanNodes + report.stats.brokenEdges + report.stats.supersedeCycles;
  ctx.telemetryClient?.emit({
    gaugeName: 'graph_integrity',
    metricValue: violations,
    metricJson: {
      totalNodes: report.stats.totalNodes,
      totalEdges: report.stats.totalEdges,
      activeNodes: report.stats.activeNodes,
      activeEdges: report.stats.activeEdges,
      orphanNodes: report.stats.orphanNodes,
      brokenEdges: report.stats.brokenEdges,
      supersedeCycles: report.stats.supersedeCycles,
    },
    sourceId: 'pipeline:integrity_check',
  });

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

  // === Step 037 telemetry — quality_gate + formula_accuracy emit ===
  // quality_gate 단위: pass_count (migrations/0017_engine_telemetry.sql:30 정의 정합) — 0~totalChecks.
  // formula_accuracy 단위: 1.0 (PASS) / 0.0 (FAIL) binary (migrations/0017_engine_telemetry.sql:31 정의 정합).
  const passCount = result.checks.filter((c) => c.passed).length;
  ctx.telemetryClient?.emit({
    gaugeName: 'quality_gate',
    metricValue: passCount,
    metricJson: {
      totalChecks: result.checks.length,
      passCount,
      failCount: result.checks.length - passCount,
      passed: result.passed,
      summary: result.summary,
    },
    sourceId: 'pipeline:qg2_gate',
  });
  // formula_accuracy: QG-2 checks 중 'Formula ' prefix (checkFormulaAccuracy 산출) 만 추출.
  const formulaChecks = result.checks.filter((c) => c.name.startsWith('Formula '));
  if (formulaChecks.length > 0) {
    const formulaPassCount = formulaChecks.filter((c) => c.passed).length;
    const allPassed = formulaPassCount === formulaChecks.length;
    ctx.telemetryClient?.emit({
      gaugeName: 'formula_accuracy',
      metricValue: allPassed ? 1.0 : 0.0,
      metricJson: {
        formulaChecksTotal: formulaChecks.length,
        formulaPassCount,
        formulaFailCount: formulaChecks.length - formulaPassCount,
        ratio: formulaPassCount / formulaChecks.length,
      },
      sourceId: 'pipeline:qg2_gate',
    });
  }

  return {
    stage: 'qg2_gate',
    status: result.passed ? 'success' : 'failed',
    message: result.summary,
    durationMs: Date.now() - started,
    data: result,
  };
}
