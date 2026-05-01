/**
 * BATCH 파이프라인 Recovery — recover() 결정 트리.
 *
 * @runtime Node.js only — checkpoint.ts + D1Db 의존.
 *
 * v3.0 Vol V.4 결정 트리 4단계:
 *   Q1. checkpoint 파일 존재? NO → 처음부터 시작 (no_checkpoint)
 *   Q2. SHA-256 무결성 PASS? NO → 거부 + 사용자 알림 (recovery_failed)
 *   Q3. engine_version major 동일? 아님 → 거부 + Migration 권고 (recovery_failed)
 *   Q4. 의존 체크포인트 모두 존재? 아님 → recovery_failed (Phase 1 후반 multi-engine 도입 전엔 명시 거부)
 *   모두 OK → fully_recovered
 *
 * Idempotency 통합 (Step 5 연동):
 *   - batch_runs 테이블의 state='in_progress' 행 검사 → 동시 실행 차단 (AC-R4)
 *   - 동일 batch_run_id 재실행 시 이미 'completed' 면 skip (AC-R3 — Step 5)
 *
 * v1.1 정정 (4-Pass review):
 *   - depends_on 발견 시 명시적 거부 (CRITICAL RULE #2 stub 금지, P1-M4)
 *   - 24h stale lock 임계를 STALE_LOCK_THRESHOLD_MS 상수로 추출 (P1-m2)
 *
 * 근거:
 *   - docs/plans/engine-hardening/step6-recover-snapshot.plan.md AC-R1~R5
 *   - .claude/reviews/review-20260427-230149-step11-5-recover-4pass.md
 */

import { createLogger, type ExamId, type Logger, type LoggerEnvironment } from '@thepick/shared';
import {
  CheckpointCorruptedError,
  CheckpointNotFoundError,
  CheckpointVersionMismatchError,
  STALE_LOCK_THRESHOLD_MS,
  readCheckpoint,
  type BatchCheckpoint,
} from './checkpoint.js';
import type { PipelineStage } from './pipeline.js';

// Step 18 MINOR-A3 — recover 결정 트리 7개 status 분기 logger.info/warn/error 강화.
// 운영자/Observability 가 어느 분기로 빠졌는지 즉시 추적 가능 (silent decision tree 차단).
const VALID_LOGGER_ENVS: ReadonlySet<string> = new Set([
  'development',
  'staging',
  'production',
  'test',
]);
const _envName = process.env.NODE_ENV;
const recoverLog: Logger = createLogger({
  service: 'thepick-batch-recover',
  environment:
    _envName !== undefined && VALID_LOGGER_ENVS.has(_envName)
      ? (_envName as LoggerEnvironment)
      : 'development',
});

export type BatchRunState = 'in_progress' | 'completed' | 'failed' | 'recovered' | 'killed';

export interface BatchRunRow {
  readonly batch_run_id: string;
  readonly started_at: string;
  readonly completed_at: string | null;
  readonly last_completed_stage: PipelineStage;
  readonly last_node_id: string | null;
  readonly state: BatchRunState;
  readonly resume_count: number;
  readonly fixture_path: string;
  readonly state_hash: string;
  readonly engine_version: string;
}

/**
 * D1 어댑터 — recover.ts 가 batch_runs 테이블에 접근하는 최소 인터페이스.
 *
 * Hard Rule 16 (Year 1 한시 예외) 적용:
 *   모든 메서드는 첫 인자로 `examId: ExamId` 를 받는다. Year 1 (현재) 단일
 *   시험이라 내부 SQL 의 WHERE 절에 exam_id 미주입이지만, 시그니처 자체가
 *   examId 포함이라 Year 2 Phase 4 마이그레이션 0005 도입 시 zero-cost 전환
 *   가능 (호출 측 코드 변경 X, 어댑터 내부만 WHERE exam_id = ? 추가).
 *
 * 근거:
 *   - .claude/rules/production-quality.md Hard Rule 16
 *   - .claude/reviews/midpoint-20260428-backend.md C-2
 */
export interface BatchRunsDb {
  selectByRunId(examId: ExamId, batchRunId: string): Promise<BatchRunRow | null>;
  updateState(
    examId: ExamId,
    batchRunId: string,
    update: {
      state: BatchRunState;
      resume_count_increment?: number;
      last_completed_stage?: PipelineStage;
      last_node_id?: string | null;
      state_hash?: string;
      completed_at?: string | null;
    },
  ): Promise<void>;
  /**
   * 신규 BATCH 실행 INSERT — Step 11.6 통합 (no_checkpoint 분기) 에서만 호출.
   *
   * recover.ts 자체는 본 메서드 미사용 — pipeline.ts 가 진입 시 호출. 따라서
   * `optional`. 기존 8개 recover.test.ts mock 영향 X (insertNewRun 미구현 mock 도
   * recover 호출만 검증하면 PASS).
   *
   * D1BatchRunsDb 구현 의무 — production 흐름에서 missing 시 runPipeline 진입 직후
   * 명시적 Error throw (silent failure 차단).
   */
  insertNewRun?(
    examId: ExamId,
    input: {
      readonly batchRunId: string;
      readonly fixturePath: string;
      readonly engineVersion: string;
    },
  ): Promise<void>;
}

export type RecoveryStatus =
  | 'fully_recovered'
  | 'partially_recovered'
  | 'recovery_failed'
  | 'no_checkpoint'
  | 'concurrent_run_detected'
  | 'already_completed';

export interface RecoveryResult {
  readonly status: RecoveryStatus;
  readonly resumed_from_stage: PipelineStage | null;
  readonly data_loss_estimate: {
    readonly nodes_lost: number;
    readonly stages_skipped: number;
    readonly severity: 'none' | 'minor' | 'major' | 'critical';
  };
  readonly fallback_strategy?: 'restart' | 'manual_review_required';
  readonly user_notification_required: boolean;
  /** 사용자(진산님) 에게 표시할 한글 메시지 */
  readonly message: string;
  /** 복구 성공 시 로드된 checkpoint (caller 가 pipeline state 복원에 사용) */
  readonly checkpoint?: BatchCheckpoint;
}

export interface RecoverOptions {
  /** Hard Rule 16 — 시험 경계 강제. Year 1 단일 시험이라 내부 WHERE 미주입이나, 시그니처 포함 의무. */
  readonly examId: ExamId;
  readonly batchRunId: string;
  readonly baseDir: string;
  readonly currentEngineVersion: string;
  readonly batchRunsDb: BatchRunsDb;
  /** 처음부터 다시 시작할 때 caller 가 자동 진행할지 / 인간 승인 대기할지 */
  readonly autoRestartOnNoCheckpoint?: boolean;
  /** stale lock 임계 ms (기본 STALE_LOCK_THRESHOLD_MS = 24h). 테스트 주입용 */
  readonly staleLockThresholdMs?: number;
}

/**
 * v3.0 Vol V.4 Recovery 결정 트리 실행.
 *
 * @param opts.batchRunId 복구 대상 BATCH 실행 ID
 * @returns RecoveryResult — 결과 + caller 가 다음 행동 결정 가능한 정보
 */
export async function recoverBatch(opts: RecoverOptions): Promise<RecoveryResult> {
  const staleThreshold = opts.staleLockThresholdMs ?? STALE_LOCK_THRESHOLD_MS;

  // Step 19 MINOR-A1 흡수: recoverLog.child() 1회 생성 + 매 호출 inline context 제거.
  // 진입점 컨텍스트 (batchRunId/examId) 는 child 에 누적, 호출 측은 decision/cause 등만 명시.
  const log = recoverLog.child({ batchRunId: opts.batchRunId, examId: opts.examId });

  // === Pre-check: D1 batch_runs 상태 ===
  const row = await opts.batchRunsDb.selectByRunId(opts.examId, opts.batchRunId);

  // Idempotency — 이미 completed 면 skip (AC-R3)
  if (row && row.state === 'completed') {
    log.info('recover skip — already_completed (Idempotency)', {
      decision: 'already_completed',
    });
    return {
      status: 'already_completed',
      resumed_from_stage: null,
      data_loss_estimate: { nodes_lost: 0, stages_skipped: 0, severity: 'none' },
      user_notification_required: false,
      message: `batch_run_id=${opts.batchRunId} 는 이미 완료됨 (skip).`,
    };
  }

  // 동시 실행 차단 — state='in_progress' 면 다른 인스턴스가 진행 중 (AC-R4)
  if (row && row.state === 'in_progress') {
    // clock skew 방어 — 음수 elapsed 는 0 으로 보정
    const elapsedMs = Math.max(0, Date.now() - new Date(row.started_at).getTime());
    if (elapsedMs < staleThreshold) {
      log.warn('recover blocked — concurrent_run_detected (state=in_progress)', {
        decision: 'concurrent_run_detected',
        startedAt: row.started_at,
        elapsedMs,
        staleThresholdMs: staleThreshold,
      });
      return {
        status: 'concurrent_run_detected',
        resumed_from_stage: null,
        data_loss_estimate: { nodes_lost: 0, stages_skipped: 0, severity: 'none' },
        user_notification_required: true,
        message:
          `batch_run_id=${opts.batchRunId} 는 다른 인스턴스가 실행 중 ` +
          `(started_at=${row.started_at}). ${Math.floor(staleThreshold / 1000 / 60 / 60)}` +
          `시간 후 재시도 또는 강제 종료 후 recover.`,
      };
    }
  }

  // === Q1: Checkpoint 파일 존재? ===
  let checkpoint: BatchCheckpoint;
  try {
    checkpoint = await readCheckpoint(opts.batchRunId, opts.baseDir, {
      currentEngineVersion: opts.currentEngineVersion,
    });
  } catch (err) {
    if (err instanceof CheckpointNotFoundError) {
      log.info('recover branch — no_checkpoint (new run path)', {
        decision: 'no_checkpoint',
        autoRestart: opts.autoRestartOnNoCheckpoint ?? false,
      });
      return {
        status: 'no_checkpoint',
        resumed_from_stage: null,
        data_loss_estimate: {
          nodes_lost: row?.last_node_id ? 1 : 0,
          stages_skipped: 0,
          severity: 'minor',
        },
        fallback_strategy: opts.autoRestartOnNoCheckpoint ? 'restart' : 'manual_review_required',
        user_notification_required: true,
        message:
          `batch_run_id=${opts.batchRunId} 의 checkpoint 파일을 찾을 수 없습니다. ` +
          (opts.autoRestartOnNoCheckpoint
            ? '처음부터 자동 재시작합니다.'
            : '진산님 결정 후 처음부터 재시작 필요.'),
      };
    }

    // === Q2: 무결성 검증 실패 (JSON.parse / shape / SHA-256 mismatch 모두 포함) ===
    if (err instanceof CheckpointCorruptedError) {
      log.error('recover failed — checkpoint corrupted (SHA-256 mismatch)', err, {
        decision: 'recovery_failed',
        cause: 'corrupted',
        reason: err.reason,
      });
      return {
        status: 'recovery_failed',
        resumed_from_stage: null,
        data_loss_estimate: {
          nodes_lost: row?.last_node_id ? 1 : 0,
          stages_skipped: 0,
          severity: 'critical',
        },
        fallback_strategy: 'manual_review_required',
        user_notification_required: true,
        message:
          `batch_run_id=${opts.batchRunId} 체크포인트 무결성 검증 실패: ${err.reason}. ` +
          `진산님 검토 후 처음부터 재시작 결정.`,
      };
    }

    // === Q3: 버전 불일치 ===
    if (err instanceof CheckpointVersionMismatchError) {
      log.warn('recover failed — engine version mismatch', {
        decision: 'recovery_failed',
        cause: 'version_mismatch',
        checkpointVersion: err.checkpointVersion,
        currentVersion: err.currentVersion,
      });
      return {
        status: 'recovery_failed',
        resumed_from_stage: null,
        data_loss_estimate: { nodes_lost: 0, stages_skipped: 0, severity: 'minor' },
        fallback_strategy: 'manual_review_required',
        user_notification_required: true,
        message:
          `batch_run_id=${opts.batchRunId} 엔진 버전 불일치 — ` +
          `checkpoint=${err.checkpointVersion}, current=${err.currentVersion}. ` +
          `Migration 가이드 참조 후 처음부터 재시작 결정.`,
      };
    }

    // 기타 에러 — silent failure 금지, 그대로 전파
    log.error('recover throw — unexpected error from readCheckpoint', err, {
      decision: 'throw',
    });
    throw err;
  }

  // === Q3.5 (B-C2 SF-M-2): exam_id 일관성 검증 ===
  // checkpoint.exam_id 가 명시된 경우 opts.examId 와 일치 의무. Year 2 cross-tenant
  // recover 차단. Year 1 단일 시험에서는 양쪽 모두 동일 ExamId 또는 checkpoint 가
  // exam_id 미주입 (legacy). 후자는 통과, 전자에서 mismatch 만 거부.
  if (checkpoint.exam_id !== undefined && checkpoint.exam_id !== opts.examId) {
    log.error('recover failed — cross-tenant exam_id mismatch (SF-M-2)', undefined, {
      decision: 'recovery_failed',
      cause: 'exam_id_mismatch',
      checkpointExamId: checkpoint.exam_id,
    });
    return {
      status: 'recovery_failed',
      resumed_from_stage: null,
      data_loss_estimate: { nodes_lost: 0, stages_skipped: 0, severity: 'critical' },
      fallback_strategy: 'manual_review_required',
      user_notification_required: true,
      message:
        `batch_run_id=${opts.batchRunId} exam_id 불일치 — ` +
        `checkpoint=${checkpoint.exam_id}, requested=${opts.examId}. ` +
        `Cross-tenant recover 차단 — 진산님 검토 후 처음부터 재시작 결정.`,
    };
  }

  // === Q4: 의존 체크포인트 검증 ===
  // v1.1 정정 (P1-M4): stub 제거. multi-engine 의존성은 Phase 1 후반 도입 — 그 전엔 명시 거부.
  if (checkpoint.depends_on && checkpoint.depends_on.length > 0) {
    log.warn('recover failed — depends_on present (multi-engine deferred to Phase 1 후반)', {
      decision: 'recovery_failed',
      cause: 'depends_on_present',
      dependsOnCount: checkpoint.depends_on.length,
    });
    return {
      status: 'recovery_failed',
      resumed_from_stage: null,
      data_loss_estimate: { nodes_lost: 0, stages_skipped: 0, severity: 'major' },
      fallback_strategy: 'manual_review_required',
      user_notification_required: true,
      message:
        `batch_run_id=${opts.batchRunId} 의존 체크포인트(depends_on)이 발견됨. ` +
        `Multi-engine 의존성 검증은 Phase 1 후반 도입 — 본 단계에서 처리 불가. ` +
        `진산님 검토 후 처음부터 재시작 결정.`,
    };
  }

  // === 모든 검증 통과 — fully_recovered ===
  await opts.batchRunsDb.updateState(opts.examId, opts.batchRunId, {
    state: 'recovered',
    resume_count_increment: 1,
  });

  log.info('recover success — fully_recovered', {
    decision: 'fully_recovered',
    resumedFromStage: checkpoint.pipeline_state_snapshot.last_completed_stage,
    nodesCompleted: checkpoint.progress.nodes_completed,
    edgesCompleted: checkpoint.progress.edges_completed,
    currentStageIndex: checkpoint.progress.current_stage_index,
    totalStages: checkpoint.progress.total_stages,
  });

  return {
    status: 'fully_recovered',
    resumed_from_stage: checkpoint.pipeline_state_snapshot.last_completed_stage,
    data_loss_estimate: { nodes_lost: 0, stages_skipped: 0, severity: 'none' },
    user_notification_required: false,
    message:
      `batch_run_id=${opts.batchRunId} 정상 복구. ` +
      `재개 stage=${checkpoint.pipeline_state_snapshot.last_completed_stage} ` +
      `(노드 ${checkpoint.progress.nodes_completed}, 엣지 ${checkpoint.progress.edges_completed}, ` +
      `stage ${checkpoint.progress.current_stage_index}/${checkpoint.progress.total_stages}).`,
    checkpoint,
  };
}
