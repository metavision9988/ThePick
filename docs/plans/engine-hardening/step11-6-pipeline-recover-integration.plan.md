# Step 11.6 — pipeline.ts ↔ recover/snapshot/cost-meter 통합

---

phase: 1
step: engine-hardening-11.6
version: v1.1
approved_by: 진산님 2026-04-28 — §13 항목 1/2/3 모두 권고 A 승인 ("어렵군... 모두 권고 대로 진행해줘")
v1_1_revision_by: 진산님 2026-04-28 후보 B 채택 — P0 4-Pass quality CRITICAL 4건 + system-architect MAJOR 4건 정정 흡수
risk_level: L3
scope:

- apps/batch/src/pipeline.ts (수정 — checkpoint/recover/CostMeter 통합)
- apps/batch/src/checkpoint.ts (수정 — `writeCheckpoint` fsync 옵션)
- apps/batch/src/signal-handlers.ts (신규 — SIGINT/SIGTERM handler)
- apps/batch/src/d1-batch-runs-db.ts (신규 — `BatchRunsDb` D1 어댑터 실구현)
- apps/batch/**tests**/pipeline-integration.test.ts (신규 — AC-R1 e2e)
- apps/batch/**tests**/signal-handlers.test.ts (신규 — SIGINT/SIGTERM 보장)
- migrations/0015_batch_runs.sql (D1 Preview 통합 검증만 — 신규 변경 없음)

---

## 0. 본 plan 의 한 줄 정의

> **Step 11.5 산출물(`checkpoint.ts` / `recover.ts`) 과 Step 1 산출물(`cost-meter.ts`) 을 `pipeline.ts` 의 실 실행 경로에 통합하고, AC-R1 e2e ("BATCH 50% 진행 → kill → recover → 정확 재개") 를 단위 테스트가 아닌 실제 파이프라인 흐름에서 통과시킨다.**

본 plan 이전까지의 Step 11.5 / Step 1 검증은 모두 **mock 기반 unit test**. 본 plan 이 **integration test** 로 격상하고, BATCH-1 적재 진입 직전 마지막 차단 게이트를 통과시킨다.

---

## 1. 목적 및 위치

### 1.1 직접 동기 (Step 11.5 v1.1 정정 §"명시 이연 사항")

Step 11.5 4-Pass 리뷰 결과 (`.claude/reviews/review-20260427-230149-step11-5-recover-4pass.md`) 에서 다음 5건이 **명시 이연** 으로 분리되었고, 그 중 3건이 본 plan 의 차단 게이트:

| 이연 # | 항목                                              | 본 plan 처리                     |
| :----: | :------------------------------------------------ | :------------------------------- |
| 이연 1 | `pipeline.ts` ↔ `snapshot/recover/CostMeter` 통합 | **§4 핵심**                      |
| 이연 3 | `writeCheckpoint` fsync 누락 (P1-M1)              | **§5 처리**                      |
| 이연 5 | 0015 트리거 D1 Preview 통합 검증                  | **§6 처리**                      |
| 이연 2 | `(batch_run_id, source_id)` UNIQUE 제약           | Step 5 책임 (본 plan 외)         |
| 이연 4 | `exam_id` 격리 (Hard Rule 16)                     | Year 2 Phase 4 책임 (본 plan 외) |

또 본 plan 은 다음을 신규 처리:

- **SIGINT / SIGTERM handler** (Step 11.5 §"위험 분석" 의 "Node.js 비정상 종료 / Ctrl+C / 시스템 재부팅" 시나리오 실 대응)
- **`BatchRunsDb` 의 D1 어댑터 실구현** (현재 `recover.ts` 는 인터페이스만, 테스트는 mock)
- **`PipelineState` → `PipelineStateSnapshot` 직렬화 변환** (현재 `pipeline.ts` 의 `PipelineState` 는 `Awaited<ReturnType<typeof extractPdf>>` 등 직렬화 불가능 객체 포함 가능성)

### 1.2 ROADMAP v1.1 위치

```
[Step 11.5] step6-recover-snapshot.plan ──── 코드 구현 완료 (Step 17 ✅)
        │
        └──[Step 11.6] step11-6-pipeline-recover-integration.plan ←── 본 plan
                  │
                  └──[Step 12~17 잔여] formula-property / parser-determinism / quality-determinism / reproducibility-idempotency
                            │
                            └──[Step 18] contract verify
                                     │
                                     └──[Step 19] 4-Pass + 5-페르소나 리뷰
                                              │
                                              └──[Step 20] BATCH-1 적재 진입
```

본 plan 이 통과하지 않으면 Step 19 5-페르소나 리뷰 (devops-architect 의 "새벽 3시 on-call 시나리오" 관점) 에서 CRITICAL 발생 보장. 따라서 BATCH-1 진입 전 의무.

### 1.3 근거 문서

- v3.0 헌법 Vol V.2 (Lifecycle 5종 hook — recover/snapshot 의무)
- v3.0 헌법 Vol V.4 (Recovery 결정 트리 4단계)
- v3.0 헌법 Vol VII.5 R1 (OOM 부활 시나리오)
- ADR-023 (Engine-First Before BATCH-1)
- ADR-025 v1.1 (Two-Layer Cost Control — `onKillSwitch` checkpoint flush hook 의무)
- Engine Hardening Roadmap v1.1 §0.5 보완점 B-2
- step6-recover-snapshot.plan.md v1.1 정정 §"명시 이연 사항" 1/3/5번
- 핸드오프 session-013 §2.3

---

## 2. 현 상태 진단

### 2.1 통합 대상 3개 모듈 시그니처 (확정)

본 plan 은 **신규 시그니처 설계 X**. Step 11.5 / Step 1 이 이미 production-ready 시그니처를 노출했으므로, `pipeline.ts` 가 그것을 **호출**하는 위치를 결정하고 직렬화 변환 brigde 만 추가한다.

#### `apps/batch/src/checkpoint.ts` (Step 11.5 산출물)

```typescript
export const CHECKPOINT_SCHEMA_VERSION = 1 as const;
export const STALE_LOCK_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export interface PipelineStateSnapshot {
  readonly last_inserted_node_id: string | null;
  readonly last_completed_stage: PipelineStage;
  readonly nodes_processed: number;
  readonly edges_processed: number;
  readonly stage_results: Readonly<
    Record<PipelineStage, { status: 'success'|'failed'|'skipped'|'pending'; durationMs: number }>
  >;
}

export interface CheckpointCostState {
  readonly initial_spend_usd: number;
  readonly call_count: number;
  readonly threshold_breaches: readonly {...}[];
}

export interface BatchCheckpoint { /* schema_version, engine_*, batch_run_id, ... */ }

export function buildCheckpoint(input: SnapshotInput): BatchCheckpoint;
export async function writeCheckpoint(checkpoint, baseDir, options?): Promise<void>;
export async function readCheckpoint(batchRunId, baseDir, options): Promise<BatchCheckpoint>;
export function checkpointPath(baseDir, batchRunId): string;

export class CheckpointCorruptedError extends Error { ... }
export class CheckpointVersionMismatchError extends Error { ... }
export class CheckpointNotFoundError extends Error { ... }
```

#### `apps/batch/src/recover.ts` (Step 11.5 산출물)

```typescript
export type BatchRunState = 'in_progress'|'completed'|'failed'|'recovered'|'killed';
export interface BatchRunRow { /* batch_run_id, started_at, ... */ }
export interface BatchRunsDb {
  selectByRunId(batchRunId: string): Promise<BatchRunRow | null>;
  updateState(batchRunId, update): Promise<void>;
}
export interface RecoveryResult { status, resumed_from_stage, data_loss_estimate, ..., checkpoint? }
export async function recoverBatch(opts: RecoverOptions): Promise<RecoveryResult>;
```

#### `apps/batch/src/cost-meter.ts` (Step 1 산출물)

```typescript
export class CostMeter {
  constructor(options: CostMeterOptions); // batchRunId, dailyBudgetUsd, autoEnforce, onKillSwitch, ...
  start(): void;
  recordTokens(input, output, model, stage): CostStatus;
  applyThrottle(): Promise<void>;
  finalize(): CostReport;
  getInitialSpendUsd(): number;
  getThresholdBreaches(): readonly ThresholdBreach[];
  getCallCount(): number;
}
```

### 2.2 `pipeline.ts` 현 구조 (apps/batch/src/pipeline.ts:215-259)

```typescript
export async function runPipeline(ctx: PipelineContext): Promise<PipelineResult> {
  const stages: StageResult[] = [];
  const state: PipelineState = { pdfPages: null, sections: null, ... };
  let aborted = false;
  let qg2Result: QG2Result | null = null;

  for (const stage of PIPELINE_STAGES) {
    if (aborted) { stages.push({ ..., status: 'skipped' }); continue; }
    const result = await runStage(stage, ctx, state);
    if (stage === 'qg2_gate' && result.data) qg2Result = result.data as QG2Result;
    stages.push(result);
    if (result.status === 'failed') aborted = true;
  }
  return { batchId: ctx.batchId, stages, qg2Passed: ..., qg2Result, contract, loadResult };
}
```

**문제점 (본 plan 이 해결할 항목):**

1. **`PipelineState` 가 직렬화 불가 객체 포함**
   - `pdfPages: Awaited<ReturnType<typeof extractPdf>> | null` — 외부 라이브러리 반환 객체 (가능)
   - `sections: ReturnType<typeof splitSections> | null` — 동일
   - `tables: ReturnType<typeof extractTables> | null` — 동일
   - `graphNodes: GraphNode[]` / `graphEdges: GraphEdge[]` — 직렬화 가능
   - `contract: KnowledgeContract | null` — 직렬화 가능 (스키마 검증된 plain object)
   - `loadResult: LoadDraftResult | null` — 직렬화 가능 (의심 시 검증 필요)
   - **결론:** `PipelineState` 전체를 그대로 snapshot 하지 말고, `last_inserted_node_id` / `last_completed_stage` / `nodes_processed` / `edges_processed` / `stage_results` 만 추출해서 `PipelineStateSnapshot` 형태로 변환.

2. **`batchRunId` 미보유**
   - 현재 `PipelineContext` 에 `batchRunId` (UUID) 가 없음 — `BatchId` (`'BATCH-1'` 등) 만 있음.
   - Step 11.5 의 `batch_run_id` 는 1회 실행 식별 UUID. 따라서 `PipelineContext` 에 신규 필드 추가 필요.

3. **CostMeter 미주입**
   - 현재 `stageBatchStructurize` 가 `processBatch(claudeClient, input)` 호출하지만 토큰 사용량 미계측.
   - CostMeter 를 주입해서 매 Claude 호출마다 `recordTokens()` 호출 + `onKillSwitch` 시 checkpoint flush.

4. **checkpoint 미발행**
   - 현재 `runStage` 후 단순히 `stages.push(result)` 만. checkpoint 호출 없음.
   - 매 stage 성공 후 `buildCheckpoint() + writeCheckpoint()` 추가.

5. **recover() 미호출**
   - 현재 `runPipeline` 진입 시 처음부터 시작. recover 시도 없음.
   - 진입 시 `recoverBatch()` 호출 → 결과에 따라 분기 (`fully_recovered` / `concurrent_run_detected` / `already_completed` / `no_checkpoint` / `recovery_failed`).

---

## 3. 통합 설계 — 인터페이스 변경

### 3.1 `PipelineContext` 확장

```typescript
export interface PipelineContext {
  // === 기존 필드 (유지) ===
  readonly batchId: BatchId;
  readonly config: BatchConfig;
  readonly pdfPath: string | null;
  readonly claudeClient: ClaudeClient | null;
  readonly visionClient: VisionClient | null;
  readonly db: D1Db | null;
  readonly dryRun: boolean;
  readonly outDir: string;
  readonly enableVisionOcr: boolean;
  readonly goldenTests: readonly GoldenTestCase[];
  readonly versionYear: number;
  readonly fixtureContract?: KnowledgeContract;
  readonly pdfPagesOverride?: Awaited<ReturnType<typeof extractPdf>>;

  // === Step 11.6 신규 필드 ===

  /**
   * 시험 식별자 — Hard Rule 16 정합 (Year 1 한시 예외).
   *
   * Year 1: required, 단일 시험 (DEFAULT_EXAM_ID = 'son-hae-pyeong-ga-sa').
   * Year 2 Phase 4: BatchRunsDb 내부 SQL 의 WHERE exam_id = ? 자동 활성.
   *
   * 본 필드 부재가 backend-architect C-2 결함 정정의 핵심 — Year 2 진입 시
   * 모든 callsite 시그니처 재작성 비용을 차단.
   */
  readonly examId: ExamId;

  /** 1회 BATCH 실행 식별 UUID. recover 시 동일 ID 로 재진입. */
  readonly batchRunId: string;

  /** Checkpoint 저장 베이스 디렉토리 (기본 `.checkpoint/`) */
  readonly checkpointBaseDir: string;

  /** D1 batch_runs 테이블 어댑터. recover/finalize 에 사용. */
  readonly batchRunsDb: BatchRunsDb;

  /** CostMeter 주입 — 미주입 시 비용 계측 없이 실행 (테스트용 허용, production 의무). */
  readonly costMeter?: CostMeter;

  /** 패키지 버전 — checkpoint engine_version 필드 + recover 시 비교. */
  readonly engineVersion: string;

  /** SIGINT/SIGTERM 시 checkpoint flush 활성화 (기본 true). 테스트에서 false 가능. */
  readonly enableSignalHandlers?: boolean;

  /** writeCheckpoint fsync 강제 (기본 production=true / test=false). */
  readonly fsyncCheckpoint?: boolean;
}
```

### 3.2 `PipelineState` ↔ `PipelineStateSnapshot` 변환 함수 신규

```typescript
// apps/batch/src/pipeline.ts (신규 helper)
function toSnapshot(
  state: PipelineState,
  stages: readonly StageResult[],
  lastCompletedStage: PipelineStage,
): PipelineStateSnapshot {
  // last_inserted_node_id — loadResult 가 있으면 마지막 INSERT 노드 ID 추적
  //   (LoadDraftResult.lastInsertedNodeId 가 있다면 사용, 없다면 contract.nodes 마지막)
  const last_inserted_node_id =
    state.loadResult?.lastInsertedNodeId ??
    state.contract?.nodes[state.contract.nodes.length - 1]?.id ??
    null;

  // stage_results — PIPELINE_STAGES 전체에 대해 status 매핑.
  //   stages 배열에 없으면 'pending' 으로 채움.
  const stage_results = Object.fromEntries(
    PIPELINE_STAGES.map((s) => {
      const result = stages.find((r) => r.stage === s);
      return [
        s,
        {
          status: result?.status ?? 'pending',
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
```

### 3.3 `runPipeline` 신규 흐름

```typescript
export async function runPipeline(ctx: PipelineContext): Promise<PipelineResult> {
  // === [신규] 0. recover 시도 ===
  const recovery = await recoverBatch({
    examId: ctx.examId,                        // Hard Rule 16 — Year 1 한시 예외
    batchRunId: ctx.batchRunId,
    baseDir: ctx.checkpointBaseDir,
    currentEngineVersion: ctx.engineVersion,
    batchRunsDb: ctx.batchRunsDb,
  });

  // 분기:
  // - already_completed: 즉시 skip (Idempotency, AC-R3)
  // - concurrent_run_detected: 즉시 reject (AC-R4)
  // - recovery_failed: 인간 결정 의무 (AC-R2)
  // - no_checkpoint: 처음부터 시작 (정상 신규 실행)
  // - fully_recovered / partially_recovered: 해당 stage 부터 재개 (AC-R1)
  if (recovery.status === 'already_completed') {
    return buildSkipResult(ctx, '이미 완료된 BATCH (Idempotency skip)');
  }
  if (recovery.status === 'concurrent_run_detected') {
    throw new ConcurrentRunError(recovery.message);
  }
  if (recovery.status === 'recovery_failed') {
    throw new RecoveryFailedError(recovery.message);
  }

  const resumeFromStageIndex =
    recovery.status === 'fully_recovered' || recovery.status === 'partially_recovered'
      ? PIPELINE_STAGES.indexOf(recovery.resumed_from_stage!)
      : 0;

  // === [신규] 0.5 batch_runs INSERT (신규) 또는 UPDATE (resume) ===
  // Hard Rule 16 — 모든 BatchRunsDb 메서드는 첫 인자 examId 의무.
  if (recovery.status === 'no_checkpoint') {
    await ctx.batchRunsDb.insertNewRun(ctx.examId, {
      batchRunId: ctx.batchRunId,
      fixturePath: ctx.pdfPath ?? '<fixture>',
      engineVersion: ctx.engineVersion,
    });  // 0015 BEFORE INSERT trigger 가 completed 재INSERT 차단 (AC-R3 SQL 레벨)
  } else {
    await ctx.batchRunsDb.updateState(ctx.examId, ctx.batchRunId, {
      state: 'recovered',  // 0015 BEFORE UPDATE trigger 가 completed→recovered 차단 (T5)
      resume_count_increment: 1,
      last_completed_stage: recovery.resumed_from_stage!,
    });
  }

  // === [신규] 0.7 SIGINT/SIGTERM handler 등록 ===
  let lastSnapshot: PipelineStateSnapshot | null = null;
  const removeHandlers = ctx.enableSignalHandlers !== false
    ? installSignalHandlers({
        flushCheckpoint: () => {
          if (lastSnapshot === null) return;
          const cp = buildCheckpoint({
            examId: ctx.examId,                  // Hard Rule 16 — Year 1 한시 예외
            batchRunId: ctx.batchRunId,
            engineVersion: ctx.engineVersion,
            currentStage: lastSnapshot.last_completed_stage,
            currentStageIndex: PIPELINE_STAGES.indexOf(lastSnapshot.last_completed_stage),
            totalStages: PIPELINE_STAGES.length,
            snapshot: lastSnapshot,
            costState: ctx.costMeter ? ctx.costMeter.toCheckpointCostState() : undefined,
          });
          // sync fs API only — process exit 직전에 await 불가
          writeCheckpointSync(cp, ctx.checkpointBaseDir, { fsync: true });
          markBatchRunKilled(ctx.batchRunId, ctx.batchRunsDb).catch(() => { /* best-effort */ });
        },
      })
    : () => { /* noop */ };

  // === [신규] 0.9 CostMeter start ===
  ctx.costMeter?.start();

  const stages: StageResult[] = [];
  const state: PipelineState = { pdfPages: null, ..., loadResult: null };

  // === [신규] recovery 성공 시 checkpoint 의 PipelineStateSnapshot 으로 state 부분 복원 ===
  //   (단, contract / pdfPages 는 복원 불가 — 해당 stage 부터 재실행)
  //   → resume 정책: fully_recovered 의 경우 last_completed_stage 다음 stage 부터 재시작.
  //   → 그 이전 stage 들의 산출물(예: contract) 은 stageBatchStructurize 가 fixtureContract 로
  //     주입하지 않는 한 재계산. resume 의 안전성은 stage 들이 deterministic 일 때만 보장 (Step 5 의 책임).

  let aborted = false;
  let qg2Result: QG2Result | null = null;

  try {
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      const stage = PIPELINE_STAGES[i];

      // [신규] resume 시 이전 stage 들 skip
      if (i < resumeFromStageIndex) {
        stages.push({ stage, status: 'skipped', message: 'Resumed from later stage', durationMs: 0 });
        continue;
      }

      if (aborted) { stages.push({ stage, status: 'skipped', message: '...', durationMs: 0 }); continue; }

      const result = await runStage(stage, ctx, state);
      if (stage === 'qg2_gate' && result.data) qg2Result = result.data as QG2Result;
      stages.push(result);

      if (result.status === 'failed') {
        aborted = true;
        await ctx.batchRunsDb.updateState(ctx.examId, ctx.batchRunId, {
          state: 'failed',
          last_completed_stage: stage,
        });
        continue;
      }

      // === [신규] stage 성공 시 checkpoint 발행 ===
      if (result.status === 'success') {
        lastSnapshot = toSnapshot(state, stages, stage);
        const cp = buildCheckpoint({
          examId: ctx.examId,                    // Hard Rule 16 — Year 1 한시 예외
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
        await ctx.batchRunsDb.updateState(ctx.examId, ctx.batchRunId, {
          state: 'in_progress',
          last_completed_stage: stage,
          last_node_id: lastSnapshot.last_inserted_node_id,
          state_hash: cp.state_hash,
        });
      }
    }

    // === [신규] 정상 완료 시 'completed' 전이 ===
    if (!aborted) {
      await ctx.batchRunsDb.updateState(ctx.examId, ctx.batchRunId, {
        state: 'completed',
        completed_at: new Date().toISOString(),
      });
    }
  } finally {
    removeHandlers();
    if (ctx.costMeter) {
      const report = ctx.costMeter.finalize();
      // report 는 PipelineResult 에 포함하지 않음 (별도 audit log)
      // 또는 PipelineResult 에 costReport 필드 추가 (선택)
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
```

---

## 4. 핵심 통합 항목 (이연 1 처리)

### 4.1 매 stage 종료 시 snapshot()

§3.3 의 "stage 성공 시 checkpoint 발행" 블록.

**예외 처리:**

- `writeCheckpoint` 실패 시 stage 자체는 success 로 보고하되, 다음 stage 진입 전 retry 1회. 2회째 실패 시 `aborted=true` + `state='failed'`.
  - 이유: checkpoint 발행 실패 = 이후 비정상 종료 시 데이터 손실 위험. 차라리 정지가 안전.
- `state_hash` 계산 중 `assertCanonicalSafe` throw (Date/Map/Set/BigInt) 시: stage 의 산출물에 직렬화 불가 객체 혼입 = 버그. `aborted=true` + 에러 상세 로그.

### 4.2 시작 시 recover()

§3.3 의 "0. recover 시도" 블록.

**5가지 recovery status 분기:**

| status                    | 의미                                                   | 본 plan 처리                                  |
| :------------------------ | :----------------------------------------------------- | :-------------------------------------------- |
| `no_checkpoint`           | 신규 실행 (정상)                                       | 처음부터 시작 + `batch_runs` INSERT           |
| `fully_recovered`         | checkpoint 무결 + 버전 일치                            | `resumed_from_stage` 다음 stage 부터 재개     |
| `partially_recovered`     | checkpoint 일부 손실 (현재 미발생 — 향후 multi-engine) | 동일 처리 + warning log                       |
| `already_completed`       | Idempotency skip (AC-R3)                               | `runPipeline` 즉시 return (skip 결과)         |
| `concurrent_run_detected` | 다른 인스턴스 진행 중 (AC-R4)                          | `ConcurrentRunError` throw — 진산님 결정 의무 |
| `recovery_failed`         | 무결성 / 버전 / Q4 stub 등                             | `RecoveryFailedError` throw — 인간 검수 의무  |

### 4.3 CostMeter 통합

#### 4.3.1 주입

```typescript
// production 호출 패턴 (BATCH-1 진입 직전)
const meter = new CostMeter({
  batchRunId,
  dailyBudgetUsd: 10,  // ADR-025 §2.5 — Layer 2 monthly cap $200 의 1/N
  autoEnforce: true,
  onKillSwitch: () => {
    // checkpoint flush sync (process.exit 직전이라 await 불가)
    if (lastSnapshot) {
      const cp = buildCheckpoint({ ... });
      writeCheckpointSync(cp, ctx.checkpointBaseDir, { fsync: true });
    }
    process.exit(1);
  },
});
const ctx: PipelineContext = { ..., costMeter: meter };
await runPipeline(ctx);
```

#### 4.3.2 stage 내부 호출 (`stageBatchStructurize` 수정)

```typescript
async function stageBatchStructurize(ctx, state, started): Promise<StageResult> {
  // ... (생략 — fixture/precondition 체크) ...

  const result = await processBatch(ctx.claudeClient, input);

  // === [신규] CostMeter 통합 ===
  if (ctx.costMeter && result.usage) {
    const status = ctx.costMeter.recordTokens(
      result.usage.input_tokens,
      result.usage.output_tokens,
      result.usage.model,
      'batch_structurize',
    );
    if (status === 'hard_throttle') {
      await ctx.costMeter.applyThrottle();
    }
    // 'kill_switch' 는 autoEnforce=true 면 onKillSwitch throw 됨 — 여기 도달 X.
  }

  // ... (생략 — validation + state.contract 할당) ...
}
```

#### 4.3.3 `processBatch` 의 usage 반환 의존성

현재 `@thepick/parser` 의 `processBatch` 가 `result.usage` 를 반환하는지 확인 필요. 미반환 시 본 plan 의 §"Phase 2 작업" 으로 분리.

**가정:** `processBatch` 가 `{ contract, error, usage? }` 형태. `usage` 미주입이면 CostMeter 호출 skip + warn log.

#### 4.3.4 `meter.toCheckpointCostState()` 인스턴스 메서드 (R-C1 정정 반영)

> **v1.1 정정 (2026-04-28, P0-SA-M1):** plan v1.0 의 자유 함수 `extractCostState(meter)` 는 R-C1 정정으로 `CostMeter` 인스턴스 메서드 `toCheckpointCostState()` 로 통합됨 (`apps/batch/src/cost-meter.ts:351-361`). caller 가 3개 getter (`getInitialSpendUsd` / `getCallCount` / `getThresholdBreaches`) 로 분리 접근하는 대신, 단일 직렬화 메서드로 흡수 — encapsulation 향상 (Tell, Don't Ask 정합).

```typescript
// apps/batch/src/cost-meter.ts (구현 완료)
class CostMeter {
  toCheckpointCostState(): CheckpointCostState {
    return {
      initial_spend_usd: this.getCurrentSpend(),
      call_count: this.callCount,
      threshold_breaches: this.breaches.map((b) => ({
        threshold: b.threshold,
        at_spend_usd: b.at_spend_usd,
        at_ratio: b.at_ratio,
      })),
    };
  }
}
```

호출 패턴 (§3.3 / §4.3.1 / §5.3 모두 통일):

```typescript
costState: ctx.costMeter ? ctx.costMeter.toCheckpointCostState() : undefined,
```

**도메인 책임자 비대칭 명시 (M3 완화):** `CheckpointCostState` 의 정의 위치는 `apps/batch/src/checkpoint.ts:60-68`. cost-meter 는 이 shape 의 **변환 책임만** 보유하고 정의의 source 는 checkpoint (`BatchCheckpoint.cost_state` 의 owning 모듈). cost-meter.ts:30 `import type { CheckpointCostState } from './checkpoint.js'` 는 type-only — runtime 의존성 0, 단방향 의존성 유지.

### 4.4 `BatchRunsDb` D1 어댑터 실구현 (v1.1 정정 — Hard Rule 16 정합)

> **v1.1 정정 (2026-04-28, P0-B-C2):** backend-architect C-2 결함 정정 — 모든 메서드의 첫 인자에 `examId: ExamId` 추가. Year 1 단일 시험이라 내부 SQL 의 `WHERE exam_id = ?` 미주입이지만, 시그니처 자체가 examId 포함이라 Year 2 Phase 4 진입 시 zero-cost 전환 보장.

```typescript
// apps/batch/src/d1-batch-runs-db.ts (신규)
import type { D1Database } from '@cloudflare/workers-types';
import type { ExamId } from '@thepick/shared';
import type { BatchRunsDb, BatchRunRow, BatchRunState } from './recover';
import type { PipelineStage } from './pipeline';

export class D1BatchRunsDb implements BatchRunsDb {
  constructor(private readonly db: D1Database) {}

  async selectByRunId(examId: ExamId, batchRunId: string): Promise<BatchRunRow | null> {
    // Year 1: examId 미사용 (단일 시험). Year 2 Phase 4 진입 시 'WHERE exam_id = ?' 추가.
    void examId;
    const row = await this.db
      .prepare('SELECT * FROM batch_runs WHERE batch_run_id = ?')
      .bind(batchRunId)
      .first<BatchRunRow>();
    return row ?? null;
  }

  async insertNewRun(
    examId: ExamId,
    input: {
      batchRunId: string;
      fixturePath: string;
      engineVersion: string;
    },
  ): Promise<void> {
    // Year 1: examId 미사용. Year 2 진입 시 INSERT 컬럼에 exam_id 추가.
    void examId;
    // 0015 BEFORE INSERT trigger 가 completed 재INSERT 차단 — caller 는 catch 후 별도 처리
    await this.db
      .prepare(
        `INSERT INTO batch_runs
         (batch_run_id, started_at, last_completed_stage, state, resume_count, fixture_path, state_hash, engine_version)
         VALUES (?, ?, ?, 'in_progress', 0, ?, '', ?)`,
      )
      .bind(
        input.batchRunId,
        new Date().toISOString(),
        'pdf_extract', // 시작 stage
        input.fixturePath,
        input.engineVersion,
      )
      .run();
  }

  async updateState(
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
  ): Promise<void> {
    // Year 1: examId 미사용. Year 2 진입 시 'AND exam_id = ?' 추가.
    void examId;
    // 동적 SQL 생성 — undefined 필드는 제외
    const sets: string[] = ['state = ?'];
    const vals: unknown[] = [update.state];
    if (update.resume_count_increment !== undefined) {
      sets.push('resume_count = resume_count + ?');
      vals.push(update.resume_count_increment);
    }
    if (update.last_completed_stage !== undefined) {
      sets.push('last_completed_stage = ?');
      vals.push(update.last_completed_stage);
    }
    if (update.last_node_id !== undefined) {
      sets.push('last_node_id = ?');
      vals.push(update.last_node_id);
    }
    if (update.state_hash !== undefined) {
      sets.push('state_hash = ?');
      vals.push(update.state_hash);
    }
    if (update.completed_at !== undefined) {
      sets.push('completed_at = ?');
      vals.push(update.completed_at);
    }
    vals.push(batchRunId);
    await this.db
      .prepare(`UPDATE batch_runs SET ${sets.join(', ')} WHERE batch_run_id = ?`)
      .bind(...vals)
      .run();
    // 0015 BEFORE UPDATE 트리거가 비정상 전이 차단 — D1 RAISE(ABORT) 가 throw 됨
  }
}
```

**`BatchRunsDb` 인터페이스 확장:** `recover.ts` 의 현 `BatchRunsDb` 에 `insertNewRun(examId, input)` 메서드 추가 (recover 자체는 select/update 만 사용하지만, pipeline 통합용). 모든 메서드 첫 인자 `examId: ExamId` 의무.

---

## 5. fsync 도입 (이연 3 처리)

### 5.1 현 `writeCheckpoint` (apps/batch/src/checkpoint.ts)

```typescript
// 현재 — Step 11.5 v1.1
export async function writeCheckpoint(checkpoint: BatchCheckpoint, baseDir: string): Promise<void> {
  await mkdir(baseDir, { recursive: true });
  const tmp = checkpointPath(baseDir, checkpoint.batch_run_id) + '.tmp';
  const final = checkpointPath(baseDir, checkpoint.batch_run_id);
  await writeFile(tmp, JSON.stringify(checkpoint, null, 2), 'utf-8');
  await rename(tmp, final);
}
```

**문제:** Linux/macOS 의 `writeFile` 는 page cache 쓰기 후 즉시 return. power loss 시 0 byte 가능성 (이연 3, P1-M1).

### 5.2 본 plan 의 정정

```typescript
// Step 11.6 — fsync 옵션 추가
export interface WriteCheckpointOptions {
  /** fsync 강제 (기본 true). 테스트에서 false 가능. */
  readonly fsync?: boolean;
}

export async function writeCheckpoint(
  checkpoint: BatchCheckpoint,
  baseDir: string,
  options: WriteCheckpointOptions = {},
): Promise<void> {
  const fsync = options.fsync ?? true;
  await mkdir(baseDir, { recursive: true });
  const tmp = checkpointPath(baseDir, checkpoint.batch_run_id) + '.tmp';
  const final = checkpointPath(baseDir, checkpoint.batch_run_id);

  // Node.js 21+ flush option (writeFile + fsync atomic)
  // 미지원 환경: open + write + fsync + close 명시 패턴
  if (fsync) {
    const fh = await fs.open(tmp, 'w');
    try {
      await fh.writeFile(JSON.stringify(checkpoint, null, 2), 'utf-8');
      await fh.sync(); // fsync(2) — kernel buffer → disk
    } finally {
      await fh.close();
    }
  } else {
    await writeFile(tmp, JSON.stringify(checkpoint, null, 2), 'utf-8');
  }

  await rename(tmp, final);

  // rename 후 디렉토리 entry 도 fsync (POSIX 보장)
  if (fsync) {
    const dh = await fs.open(baseDir, 'r');
    try {
      await dh.sync();
    } finally {
      await dh.close();
    }
  }
}

// SIGINT/SIGTERM handler 용 sync 버전 (process.exit 직전 await 불가)
export function writeCheckpointSync(
  checkpoint: BatchCheckpoint,
  baseDir: string,
  options: WriteCheckpointOptions = {},
): void {
  const fsync = options.fsync ?? true;
  mkdirSync(baseDir, { recursive: true });
  const tmp = checkpointPath(baseDir, checkpoint.batch_run_id) + '.tmp';
  const final = checkpointPath(baseDir, checkpoint.batch_run_id);

  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, JSON.stringify(checkpoint, null, 2));
    if (fsync) fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, final);
  if (fsync) {
    const dfd = openSync(baseDir, 'r');
    try {
      fsyncSync(dfd);
    } finally {
      closeSync(dfd);
    }
  }
}
```

### 5.3 SIGINT/SIGTERM handler

```typescript
// apps/batch/src/signal-handlers.ts (신규)
export interface SignalHandlerOptions {
  flushCheckpoint: () => void; // sync — process.exit 직전 await 불가
}

export function installSignalHandlers(opts: SignalHandlerOptions): () => void {
  const handler = (signal: NodeJS.Signals) => () => {
    try {
      console.error(`[Pipeline] ${signal} received — flushing checkpoint before exit`);
      opts.flushCheckpoint();
    } catch (err) {
      console.error(`[Pipeline] Checkpoint flush failed during ${signal}:`, err);
    }
    process.exit(signal === 'SIGINT' ? 130 : 143); // POSIX exit codes
  };

  const sigintHandler = handler('SIGINT');
  const sigtermHandler = handler('SIGTERM');

  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigtermHandler);

  return () => {
    process.off('SIGINT', sigintHandler);
    process.off('SIGTERM', sigtermHandler);
  };
}
```

**위험:**

- `process.on('SIGINT', ...)` 다중 등록 — `runPipeline` 가 다중 호출되면 stale handler 누적. → `installSignalHandlers` 가 `removeHandlers` 함수 반환 + `runPipeline` finally 에서 호출.
- handler 내부 throw 시 process 가 좀비 상태. → `try/catch` 필수, `console.error` 만.

---

## 6. 0015 트리거 D1 Preview 통합 검증 (이연 5 처리)

### 6.1 검증 시나리오 (v1.1 정정 P0-B-C3 반영)

> **v1.1 정정 (2026-04-28, P0-B-C3):** 트리거 본문 정정 (`OLD.state = 'completed'` 만 ABORT) 으로 T3 의미 재정의 + T5 신규 추가.

ADR-018 D1 Preview 환경 (또는 better-sqlite3 로컬) 에서 다음 5건 통과 확인:

|  #  | 시나리오                                                        | 기대 결과                                                  |
| :-: | :-------------------------------------------------------------- | :--------------------------------------------------------- |
| T1  | `state='completed'` 행에 동일 PK 재INSERT                       | `RAISE(ABORT, 'cannot re-insert completed')`               |
| T2  | `state='completed'` → `state='in_progress'` UPDATE              | `RAISE(ABORT, 'cannot transition out of completed')`       |
| T3  | `state='in_progress'` (24h+ stale) → `state='recovered'` UPDATE | **ALLOW** (정정 의도 — application 차단이 24h 미만만 막음) |
| T4  | `state='killed'` → `state='recovered'` UPDATE                   | ALLOW (recover 정상 경로)                                  |
| T5  | `state='completed'` → `state='recovered'` UPDATE (신규)         | `RAISE(ABORT, 'cannot recover completed run')`             |

### 6.2 검증 위치

**옵션 A — 본 plan 내 통합 테스트:** `apps/batch/__tests__/d1-trigger-verify.test.ts` 신규.

- 장점: pipeline 통합과 동시 검증.
- 단점: D1 Preview 의존성. local mock 사용 시 트리거 자체 검증 불가.

**옵션 B — Step 7 contract verify 로 이관:** `scripts/verify-engine-contracts.ts` 의 일부.

- 장점: D1 Preview 가동 환경에서 1회 검증.
- 단점: 본 plan 차단 게이트가 늦춰짐.

**결정:** **옵션 A 우선**. 본 plan 의 `__tests__/pipeline-integration.test.ts` 안에 트리거 발화 테스트 4건 포함. 단, D1 Preview 미가동 환경(로컬 vitest)에서는 `wrangler d1 execute --local --persist-to=.wrangler/state` 의 SQLite 파일 직접 사용 (Drizzle/D1 client 가 동일 SQL 발행).

### 6.3 mock 한계 명시

현재 Step 11.5 의 `recover.test.ts` 8개 PASS 는 모두 mock `BatchRunsDb`. 본 plan 통합 후 진짜 D1 SQLite 파일에서 트리거 발화 + RAISE(ABORT) 가 throw 되는지 검증.

---

## 7. AC (Acceptance Criteria) — 본 plan 의 차단 게이트

### AC-1: Pipeline 통합 — 정상 흐름

- BATCH-1 fixture (`apps/batch/src/fixtures/batch-1-contract.json`) 로 `runPipeline` 호출
- **검증:**
  - 모든 stage 성공
  - `batch_runs` 테이블에 1건 INSERT, 최종 `state='completed'`
  - `.checkpoint/{batch_run_id}.json` 파일 존재 + `pipeline_stage='qg2_gate'`
  - `state_hash` 가 계산된 `computeStateHash` 결과와 일치
  - CostMeter 미주입 시 비용 계측 skip + 정상 완료
  - CostMeter 주입 시 finalize() 호출 + JSONL 로그 1건 이상

### AC-R1 (e2e): BATCH kill → recover → atomic 멱등 재실행

> **v1.2 정정 (2026-04-30, handoff-019 §3 결정 4 옵션 A 채택, ADR-027 신설):**
> Year 1 BATCH 1회는 **atomic**. SIGTERM/SIGINT 발생 시 재실행은 처음부터 (mid-pipeline state 재구성 미지원). 멱등성은 **Step 5 source_id UNIQUE** 가 중복 INSERT 차단으로 보장. 본 e2e 는 `already_completed` Idempotency skip 분기만 검증한다. mid-pipeline resume (Stage 6~10 부분 재실행) 은 Year 2 Step 11.7 후보로 명시 이연.

**Step 11.5 unit test 의 mock 버전을 실제 pipeline 통합으로 격상.**

- BATCH 진행 → kill → 동일 `batchRunId` 로 `runPipeline` 재호출
- **검증 (atomic 정책, Year 1):**
  - 마지막 stage (`qg2_gate`) 완료 후 kill → 재실행 시 `recoverBatch` 가 `status='already_completed'` 반환
  - `runPipeline` 즉시 skip → `batch_runs` 중복 INSERT 0건
  - 최종 INSERT된 노드 수 = 정상 1회 실행과 동일 (data_loss=0)
  - `batch_runs.resume_count = 1` (재실행 1회 카운트)
- **mid-pipeline resume (Year 2 Step 11.7 후보, 본 e2e 미검증):**
  - Stage 5 (`db_load`) 후 kill → state.contract / state.graphNodes 등 재구성 → Stage 6~10 재실행 → `state='completed'`
  - `pipeline.ts:518-540` 의 `fully_recovered` / `partially_recovered` 분기 + §3 의사코드 + §4 상태 머신 표 + §6 분기 표 + line 481-483 은 Year 2 mid-resume 도입을 위해 **보존**
  - canonicalJson + checkpoint 인프라 (Step 11.5 산출, 본 plan §7 AC-Snapshot 4 시나리오 검증 완료) 도 Year 2 재활용 위해 보존

### AC-R2: Checkpoint 변조 감지 (e2e)

- BATCH 50% 진행 후 `.checkpoint/{batch_run_id}.json` 1바이트 외부 수정
- `runPipeline` 재호출
- **검증:**
  - `RecoveryFailedError` throw + `message` 에 "체크포인트 무결성 검증 실패" 포함
  - 자동 재시작 X (`autoRestartOnNoCheckpoint=false` 기본)
  - `batch_runs` 상태 변경 X (recover 자체가 거부)

### AC-R3: 동시 실행 차단 (e2e)

- BATCH 진행 중 (state='in_progress') 두 번째 `runPipeline` 트리거 (다른 프로세스 시뮬레이션)
- **검증:**
  - 두 번째 호출이 `ConcurrentRunError` throw
  - 첫 번째 호출 영향 X
  - 첫 번째 정상 완료 후 두 번째 재시도 시 `already_completed` 분기 (skip)

### AC-R4: SIGINT (Ctrl+C) handler

- `runPipeline` 진행 중 `process.kill(process.pid, 'SIGINT')`
- **검증:**
  - SIGINT handler 가 sync 로 checkpoint flush
  - `.checkpoint/{batch_run_id}.json` 파일 정상 (state_hash 검증 통과)
  - process exit code = 130
  - `batch_runs.state='killed'` (best-effort, 실패해도 file checkpoint 는 존재)
  - 재실행 시 `fully_recovered` 가능

### AC-R5: fsync 보장

- `writeCheckpoint(cp, dir, { fsync: true })` 호출 직후 강제 종료 시뮬레이션 (별도 process 에서 검증)
- **검증:**
  - 파일 크기 > 0
  - 파일 내용이 valid JSON
  - `computeStateHash` 결과가 저장된 `state_hash` 와 일치

### AC-R6: 0015 트리거 D1 Preview 발화 (v1.1 정정 P0-B-C3 반영)

> **v1.1 정정 (2026-04-28, P0-B-C3):** 0015 트리거 본문 정정 — `OLD.state NOT IN ('killed', 'failed')` → `OLD.state = 'completed'` 만 ABORT. stale 24h+ 'in_progress' 의 정상 recover 경로 허용. 따라서 T3 의미 재정의 + T5 신규 추가.

- T1~T5 (§6.1 갱신) 5건 모두 통과
- **검증:**
  - T1 (completed 재INSERT) → `Error` throw + "cannot re-insert completed"
  - T2 (completed → in_progress) → throw + "cannot transition out of completed"
  - T3 (stale 24h+ in_progress → recovered) → **ALLOW** (정정 의도 — application 레벨이 24h 미만은 차단)
  - T4 (killed → recovered) → ALLOW (recover 정상 경로)
  - T5 (completed → recovered) → throw + "cannot recover completed run"

### AC-T3 (신규, v1.1, P0-Q3): batch_runs state transition matrix

> **v1.1 신규 (2026-04-28, P0-Q3):** 0015 트리거 정정 (B-C3) + recover.ts 의 application 레벨 24h 차단의 결합 검증을 명시 매트릭스로 분리. quality-engineer 권고 (CRITICAL-Q4) 반영.

`OLD.state` × `NEW.state` 전이 매트릭스 e2e 검증:

| OLD \ NEW            |  in_progress  |     completed     |    failed    |               recovered                |      killed       |
| :------------------- | :-----------: | :---------------: | :----------: | :------------------------------------: | :---------------: |
| (insert 신규)        |   ✅ ALLOW    | (skip — 0015 T1)  |      —       |                   —                    |         —         |
| `in_progress` (<24h) |       —       |  ✅ ALLOW (정상)  |   ✅ ALLOW   | **App 차단** (concurrent_run_detected) | ✅ ALLOW (SIGINT) |
| `in_progress` (≥24h) |       —       |     ✅ ALLOW      |   ✅ ALLOW   |        ✅ ALLOW (stale recover)        |     ✅ ALLOW      |
| `completed`          | ❌ ABORT (T2) |   (idempotent)    |   ❌ ABORT   |             ❌ ABORT (T5)              |     ❌ ABORT      |
| `failed`             |       —       | ✅ ALLOW (재시도) | (idempotent) |           ✅ ALLOW (recover)           |     ✅ ALLOW      |
| `killed`             |       —       |         —         |   ✅ ALLOW   |             ✅ ALLOW (T4)              |   (idempotent)    |
| `recovered`          |       —       |     ✅ ALLOW      |   ✅ ALLOW   |           ✅ ALLOW (재진입)            |     ✅ ALLOW      |

- **검증 의무:**
  - 위 매트릭스의 모든 ❌ 표시 셀 (5건) e2e 검증 — `better-sqlite3` 또는 `wrangler d1 execute --local --persist-to=.wrangler/state` 사용
  - 위 매트릭스의 **App 차단** 셀 (1건) — recover.ts:131-149 의 elapsedMs vs `STALE_LOCK_THRESHOLD_MS` 비교 — race window 검증 포함 (`fork(child_process)` 또는 `setTimeout` 기반)
  - 위 매트릭스의 ✅ 표시 셀 (대표 5~6건) sample 검증
- **mock 한계 명시:** `recover.test.ts` 의 mock `BatchRunsDb` 는 `RAISE(ABORT)` 시뮬레이션 X — application 분기만 검증. AC-T3 는 **반드시 진짜 SQLite (better-sqlite3 또는 D1 Preview)** 에서 검증.

### AC-Cost: CostMeter kill switch → checkpoint flush

- `CostMeter` 에 `dailyBudgetUsd=0.001` (즉시 kill 도달) 주입
- `runPipeline` 호출
- **검증:**
  - Stage 3 (batch_structurize) 1회 호출 후 `kill_switch` 발동
  - `onKillSwitch` 콜백이 checkpoint flush 실행
  - `.checkpoint/{batch_run_id}.json` 존재 + 마지막 완료 stage 까지 기록
  - `process.exit(1)` (테스트는 mock onKillSwitch 로 throw 처리)

### AC-Snapshot: 직렬화 안정성 — 9종 + circular 거부 (v1.1 정정 P0-Q3)

> **v1.1 정정 (2026-04-28, P0-Q3):** plan v1.0 은 5종 (`BigInt`/`Function`/`Date`/`Map`/`Set`) 거부만 명시. Q-C1 정정 (`apps/batch/src/checkpoint.ts:188-272`) 으로 거부 영역이 9종 + circular reference 까지 확장. AC-Snapshot 본문이 ground truth 를 반영해야 향후 회귀 차단 (CRITICAL RULE #1 — 기획 ≠ 구현 차단).

- `PipelineState` 또는 `PipelineStateSnapshot` 에 다음 9종 + circular 혼입 시도:

|  #  | 거부 타입                                 | 위험 (silent collapse 시나리오)                                             |
| :-: | :---------------------------------------- | :-------------------------------------------------------------------------- |
|  1  | `bigint`                                  | JSON.stringify TypeError → silent drop 가능                                 |
|  2  | `Function`                                | JSON.stringify 시 undefined 전환 → 메서드 의미 손실                         |
|  3  | `Date` instance                           | ISO string 자동 변환 가능하나 타입 정보 손실 (timestamp 필드는 string 의무) |
|  4  | `Map`                                     | `{}` 직렬화 → entry 손실                                                    |
|  5  | `Set`                                     | `{}` 직렬화 → 멤버 손실                                                     |
|  6  | `Symbol` (값 또는 키)                     | 직렬화 시 silent drop — 의미 손실                                           |
|  7  | `WeakMap` / `WeakSet`                     | non-enumerable, `{}` 직렬화                                                 |
|  8  | `Promise` (resolved or pending)           | `{}` 직렬화 — 비동기 의미 손실 (await 누락 시 혼입 위험)                    |
|  9  | TypedArray / `DataView` / Node Buffer     | index-keyed object 변환 → state_hash 결정성 OK 라 silent collapse           |
| 10  | Circular reference (self / mutual / deep) | stack overflow 차단 의무                                                    |

- **검증:**
  - `assertCanonicalSafe` throw + 명확한 path 표시 (예: `[canonicalJson] Symbol not allowed at $.contract.meta.tag`)
  - throw 메시지가 `CheckpointCorruptedError(batchRunId, reason)` 로 변환되어 caller 에 전파 (M2 후속 정정 의무 — Step 11.6 코드 진입 시)
  - pipeline `aborted=true` + `state='failed'` 전이
  - 다음 stage 실행 X
- **False positive 방지 검증 (필수):**
  - Diamond DAG (`{a: shared, b: shared}` where shared 는 plain object) 가 false-positive throw 발생 X — `seen.has` 가 첫 진입 시점 add 후 sibling reference 에서 throw 하는 false-positive 패턴 차단 검증
  - 대안 가드: `toSnapshot()` 의 `Object.fromEntries(PIPELINE_STAGES.map((s) => [s, { status: ..., durationMs: ... }]))` 패턴이 매 entry 새 object literal 보장 — sibling reference 미발생 (plan §3.2 보강)

---

## 8. 위험 분석

| 위험                                                                              | 영향                                                | 완화                                                                                                  |
| :-------------------------------------------------------------------------------- | :-------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| `PipelineState` 직렬화 누락 (예: 새 필드 추가 시 stage_results 매핑 누락)         | checkpoint 부분 손실 → recover 시 data_loss         | `toSnapshot()` 의 `PipelineStateSnapshot` 변환을 fail-fast (모든 stage 명시 매핑, missing 시 throw)   |
| SIGINT handler 다중 등록                                                          | stale handler 가 stale snapshot flush → 데이터 오염 | `installSignalHandlers` 가 cleanup 함수 반환 + `runPipeline` finally 호출                             |
| `writeCheckpointSync` 에서 `mkdirSync` 실패 (권한)                                | SIGINT 시 flush 실패 → 데이터 손실                  | catch 후 `console.error` + `process.exit(1)` (이미 fault path)                                        |
| `processBatch` 의 `usage` 미반환                                                  | CostMeter 무력화                                    | warn log + skip. 별도 P1 이슈로 `@thepick/parser` 보강 (Phase 2)                                      |
| `D1BatchRunsDb.updateState` 가 트리거 RAISE(ABORT) throw                          | pipeline 멈춤                                       | catch 후 명시 로그 + `state='failed'` 전이 시도 (트리거가 차단해도 best-effort)                       |
| `recover` 가 `partially_recovered` 반환 (현재 로직상 미발생)                      | 향후 multi-engine 진입 시 부분 복구 처리 미정       | 본 plan 은 `partially_recovered === 'fully_recovered'` 동등 처리 + warn. 향후 plan 으로 분리          |
| Concurrent run 시 양쪽 모두 `in_progress` 직전 race                               | DB 트리거 race window                               | 0015 트리거가 동시 INSERT 시 RAISE(ABORT) 보장. 단, 두 INSERT 가 microsecond 차이면 SQLite WAL 직렬화 |
| fsync 가 실제 디스크에 닿지 않는 경우 (NAS/네트워크 마운트)                       | power loss 시 손실 가능                             | 본 plan 범위 외. 진산님 환경 (로컬 SSD) 가정 + 위험 명시 문서화                                       |
| Stage 재실행 시 deterministic 가정 위배 (예: `processBatch` 가 매번 다른 결과)    | resume 결과 다른 기존과 다름                        | Step 5 (reproducibility) 책임. 본 plan 은 "deterministic 가정 위배 시 data_loss" 명시만               |
| `extractPdf` 결과의 직렬화 불가능 객체 (예: Buffer) 가 `state.pdfPages` 에 들어감 | `assertCanonicalSafe` throw                         | `toSnapshot()` 가 pdfPages 를 snapshot 에 포함하지 않음 (last_completed_stage 만 기록) — 의도적       |
| `BatchRunsDb.insertNewRun` 추가가 `recover.ts` 시그니처 호환성 깨짐               | 기존 8개 테스트 fail                                | 본 plan 은 `BatchRunsDb` 인터페이스 확장 (`insertNewRun?` optional) — 기존 mock 영향 X                |

---

## 9. 검증 계획

### 9.1 단계별 자동 테스트

- [ ] `apps/batch/__tests__/pipeline-integration.test.ts` — AC-1, AC-R1, AC-R2, AC-R3 (e2e)
- [ ] `apps/batch/__tests__/signal-handlers.test.ts` — AC-R4, SIGINT/SIGTERM handler 격리 테스트
- [ ] `apps/batch/__tests__/cost-meter-pipeline-kill.test.ts` — AC-Cost (CostMeter kill 시 checkpoint flush)
- [ ] `apps/batch/__tests__/d1-trigger-verify.test.ts` — AC-R6 (0015 트리거 발화 4건)
- [ ] `apps/batch/__tests__/checkpoint.test.ts` 확장 — fsync 옵션 분기 (AC-R5)
- [ ] 기존 64/64 테스트 (cost-meter 31 + checkpoint 25 + recover 8) 회귀 0건

### 9.2 typecheck / lint

- [ ] `pnpm -C apps/batch typecheck` PASS
- [ ] `pnpm -C apps/batch lint` PASS
- [ ] CLAUDE.md any 0건 / TODO 0건 / 빈 catch 0건 확인 (quality-gate.sh)

### 9.3 4-Pass 독립 에이전트 리뷰 (의무)

본 plan 의 코드 구현 완료 시 다음 3개 독립 에이전트 병렬 리뷰:

- `silent-failure-hunter` — SIGINT handler 내부 silent error / fsync 실패 / `BatchRunsDb` race
- `system-architect` — `PipelineContext` 확장의 호환성 / `BatchRunsDb` 인터페이스 확장 / 0015 트리거 발화 패턴
- `quality-engineer` — AC-R1~R6 + AC-Cost 의 e2e 커버리지 / 직렬화 안정성 엣지케이스

산출물: `.claude/reviews/review-YYYYMMDD-HHMMSS-step11-6-pipeline-integration-4pass.md`

CRITICAL 0건 + MAJOR 0건 (또는 명시 이연) 후 "완료" 선언 가능.

### 9.4 5-페르소나 Phase 단위 리뷰는 본 plan 단독으로 실행 X

5-페르소나는 Phase 0 / 1 / 2 단위. 본 plan 완료 시점은 Phase 1 중간 — Step 11.6 단독으로 5-페르소나 호출 X. Step 18 (contract verify) + Step 19 (4-Pass + 5-페르소나) 시점에 통합 진입.

---

## 10. 롤백 전략

본 plan 구현 중 또는 후 결함 발견 시:

- `apps/batch/src/pipeline.ts` 의 신규 추가 코드 (recover 호출 / checkpoint 발행 / SIGINT handler / CostMeter 통합) revert (git)
- `apps/batch/src/signal-handlers.ts` / `apps/batch/src/d1-batch-runs-db.ts` 파일 삭제
- `apps/batch/__tests__/pipeline-integration.test.ts` / `signal-handlers.test.ts` / `cost-meter-pipeline-kill.test.ts` / `d1-trigger-verify.test.ts` 삭제
- `apps/batch/src/checkpoint.ts` 의 `writeCheckpointSync` 와 `WriteCheckpointOptions` revert (writeCheckpoint 만 보존)
- `apps/batch/src/recover.ts` 의 `BatchRunsDb.insertNewRun?` optional 메서드 revert
- `migrations/0015_batch_runs.sql` 변경 없음 (revert 불필요)
- D1 `batch_runs` 테이블 데이터는 그대로 보존 — 향후 재구현 시 활용

영향 범위: 본 plan 은 **신규 통합** — Step 11.5 / Step 1 산출물의 호출 위치 추가. 기존 BATCH 파이프라인 동작 변경 없음 (recover/checkpoint/CostMeter 미주입 시 기존 흐름 동등).

**호환 보장:**

- `PipelineContext` 의 신규 필드 중 `costMeter` / `enableSignalHandlers` / `fsyncCheckpoint` 는 optional.
- `examId` / `batchRunId` / `checkpointBaseDir` / `batchRunsDb` / `engineVersion` 는 **required** — 기존 caller 6건 모두 수정 의무.

> **v1.1 정정 (2026-04-28, P0-SA-CRITICAL):** v1.0 의 "현재 `runPipeline` 의 caller 는 없거나 테스트 fixture 만 — 영향 최소" 진술은 사실과 다름. system-architect 페르소나 독립 리뷰 (`.claude/reviews/review-20260428-200307-bc1bc2-step5-examid-system-architect.md`) 가 발견한 **실재 callsite 6건**을 본 plan 코드 진입 시 일괄 갱신 의무:

**실재 caller 6건 (Step 11.6 코드 진입 시 모두 갱신):**

|  #  | 파일:라인                                                       | 종류                     | 변경                                                              |
| :-: | :-------------------------------------------------------------- | :----------------------- | :---------------------------------------------------------------- |
|  1  | `apps/batch/bin/batch.ts:156-169`                               | production CLI 진입점    | `examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA` 등 5개 required 필드 추가 |
|  2  | `apps/batch/src/__tests__/pipeline.integration.test.ts:100-113` | fixture dry-run          | 동일                                                              |
|  3  | `apps/batch/src/__tests__/pipeline.integration.test.ts:131-144` | contract JSON snapshot   | 동일                                                              |
|  4  | `apps/batch/src/__tests__/pipeline.integration.test.ts:166-179` | 합성 대규모 contract     | 동일                                                              |
|  5  | `apps/batch/src/__tests__/pipeline.integration.test.ts:216-229` | 실패 경로                | 동일                                                              |
|  6  | `apps/batch/src/__tests__/pipeline.integration.test.ts:327-339` | non-fixture 통합 (CR-5b) | 동일                                                              |

**갱신 의무 SLO:**

- Step 11.6 코드 진입 첫 commit 에서 6 callsite 모두 갱신 PASS — 부분 commit 금지
- typecheck 가 6 callsite 모두 컴파일 통과 검증
- pipeline.integration.test 5건 + batch.ts CLI 1건 통합 회귀 검증

---

## 11. 의존성

- **Blocked by:**
  - Step 11.5 ✅ 완료 (`checkpoint.ts` / `recover.ts` 산출물)
  - Step 1 (Cost Meter) ✅ 완료 (`cost-meter.ts` 산출물)
  - Step 5 (`(batch_run_id, source_id)` UNIQUE 제약) — **블록 X** (본 plan 은 batch_runs 메타테이블만 의존, knowledge_nodes UNIQUE 는 Step 5 책임)
- **Blocks:**
  - Step 19 (4-Pass + 5-페르소나 리뷰) — devops-architect 의 "새벽 3시 on-call" 관점이 본 plan 통과를 요구
  - Step 20 (BATCH-1 적재 진입) — 본 plan 의 AC-R1 e2e 통과가 차단 게이트
- **참조:**
  - ADR-023 (Engine-First Before BATCH-1)
  - ADR-025 v1.1 (Two-Layer Cost Control)
  - Engine Hardening Roadmap v1.1 §0.5 B-2
  - step6-recover-snapshot.plan.md v1.1 정정 §"명시 이연 사항" 1/3/5
  - 핸드오프 session-013 §2.3

---

## 12. 작업 추정

| 단계                                            |   낙관    | 현실 (×1.5) | 비관 (×2.0) |
| :---------------------------------------------- | :-------: | :---------: | :---------: |
| §3 PipelineContext 확장 + toSnapshot            |   0.1d    |    0.15d    |    0.2d     |
| §4.1 매 stage checkpoint 발행                   |   0.15d   |    0.2d     |    0.3d     |
| §4.2 시작 시 recover 분기                       |   0.15d   |    0.2d     |    0.3d     |
| §4.3 CostMeter 통합 (processBatch usage 의존)   |   0.2d    |    0.3d     |    0.5d     |
| §4.4 D1BatchRunsDb 어댑터                       |   0.15d   |    0.2d     |    0.3d     |
| §5 fsync + writeCheckpointSync                  |   0.15d   |    0.2d     |    0.3d     |
| §5.3 SIGINT/SIGTERM handler                     |   0.1d    |    0.15d    |    0.2d     |
| §6 0015 트리거 D1 Preview 검증                  |   0.15d   |    0.2d     |    0.3d     |
| §9.1 통합 테스트 4건 작성                       |   0.3d    |    0.5d     |    0.8d     |
| §9.3 4-Pass 독립 에이전트 리뷰 + 정정 (cap 2회) |   0.3d    |    0.5d     |     1d      |
| **합계**                                        | **1.65d** |  **2.6d**   |  **4.2d**   |

**ROADMAP v1.1 시간 추정 영향:** 본 plan 추가로 Step 12~17 합계가 현실 3.5d → 5d 증가 가능 (ROADMAP v1.2 패치 시 반영).

---

## 13. 진산님 승인 체크포인트

본 plan 의 다음 항목만 진산님 명시 승인 필요. 나머지는 v3.0 헌법 + 메모리 + ROADMAP v1.1 기준 자율 진행:

1. **본 plan 전체 방향** (Step 11.6 신설 + 통합 시점 + AC 6건)
2. **§3.1 `PipelineContext` 확장 4개 required 필드** (`batchRunId` / `checkpointBaseDir` / `batchRunsDb` / `engineVersion`)
3. **§5.3 SIGINT/SIGTERM 처리에서 `process.exit(130/143)` 호출** (handler 가 process 종료 결정)

세부 시그니처 / 테스트 / 4-Pass 정정 / 작업 추정은 본 plan 승인 시 자율 진행.

---

## 14. 승인 기록

- Claude 독립 리뷰: Step 11.6 4-Pass — 코드 구현 완료 후 (현재 plan 단계 → 미실행)
- **진산님 승인 메시지:** 2026-04-28 "어렵군... 모두 권고 대로 진행해줘"
  - §13 항목 1 (본 plan 전체 방향) → 권고 A (Step 11.6 단독 plan + 통합 테스트 4건 1번에 작성) 승인
  - §13 항목 2 (`PipelineContext` 4개 required 필드) → 권고 A (4개 모두 required) 승인
  - §13 항목 3 (SIGINT/SIGTERM `process.exit` 호출) → 권고 A (handler 가 종료 결정, exit 130/143) 승인
- **2026-04-28 추가 결정:** 진산님 "현재 엔진 구현이 어느 정도 진행되었는지 중간 점검 보고서 + 제 3자 체크" 요청 → `.claude/reports/engine-hardening-midpoint-20260428.md` 작성 + 5-페르소나 독립 에이전트 리뷰 수행 후 다음 단계 진입.
- **2026-04-28 v1.1 정정 (진산님 후보 B 채택):** P0 정정 4-Pass 결과 (`.claude/reviews/review-20260428-171431-p0-fixes-r1q1b3-4pass.md`) 흡수. quality-engineer CRITICAL 4건 (Q1~Q4) + system-architect MAJOR 4건 (M1~M4) 중 즉시 정정 항목:
  - **§4.3.4** — 자유 함수 `extractCostState(meter)` → 인스턴스 메서드 `meter.toCheckpointCostState()` 교체 (P0-SA-M1)
  - **§3.3** — runPipeline 흐름 내 호출 2곳 (line 342, 401) 갱신 (P0-SA-M1)
  - **§7 AC-Snapshot** — 5종 → 9종 + circular 거부 명시 (P0-Q3, Q-C1 정정 반영)
  - **§7 AC-T3 신규** — batch_runs state transition matrix e2e 검증 의무 (P0-Q3 / Q-C4)
  - **§7 AC-R6** — T3 의미 재정의 + T5 신규 (B-C3 트리거 정정 반영)
  - **§6.1** — 시나리오 표 4건 → 5건 갱신
  - 잔여 (Q1/Q2/Q4 단위 테스트) 는 Step 11.6 코드 구현 시 e2e 흡수 (후보 B 명시 이연)
  - 0015 마이그레이션 P0-SA-M2 정정: `DROP TRIGGER IF EXISTS trg_batch_runs_recover_only_from_terminal;` 한 줄 추가 (idempotency 안전망)

---

**문서 버전:** v1.1 (APPROVED, 2026-04-28 — P0 정정 흡수)
**다음 업데이트:** Step 11.6 코드 구현 완료 + 4-Pass + AC-T3/AC-R6/AC-Snapshot e2e 통과 후 v1.2 (또는 archive)
**아카이브:** 본 plan 완료 후 `docs/plans/archive/2026MMDD-step11-6-pipeline-integration.plan.md`
