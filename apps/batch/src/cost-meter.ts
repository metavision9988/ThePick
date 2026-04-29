/**
 * Cost Meter — Two-Layer Cost Control 의 Layer 1 (Application).
 *
 * @runtime Node.js only — Cloudflare Workers 미지원.
 *   process.exit, setTimeout, Number.isInteger 사용. Workers 진입 시
 *   onKillSwitch + applyThrottle 모두 명시 주입하여 폴리필.
 *
 * 책임:
 *   1. BATCH 실행 중 Anthropic 토큰 누적 회계 (정수 마이크로센트, 부동소수점 오차 차단)
 *   2. soft 70% / hard 90% / kill 100% 임계 판정 (단발 거대 호출 시 누적 발화)
 *   3. autoEnforce 모드 시 kill 도달 시 자동 onKillSwitch 호출 (하지만 production 통합 시
 *      caller가 checkpoint flush 후 process.exit 하는 hook 의무 주입)
 *   4. 종료 시 CostReport 출력
 *
 * Layer 2 (Infrastructure): Anthropic 콘솔 monthly cap + git pre-commit hook
 * (ADR-025 §2.4 — 본 코드와 별도, 진산님 수동 설정).
 *
 * 의존성:
 *   - calculateTokenCost (packages/shared/src/constants/claude-pricing.ts) — 비용 계산 재사용
 *   - TokenLogger (apps/batch/src/adapters/token-cost-logger.ts) — JSONL 감사 로깅 (선택)
 *
 * 근거 문서:
 *   - ADR-025 Two-Layer Cost Control Architecture
 *   - docs/plans/engine-hardening/step1-cost-meter.plan.md
 *   - .claude/reviews/review-20260427-194529-step1-cost-meter-4pass.md
 */

import { calculateTokenCost } from '@thepick/shared';
import type { TokenLogger } from './adapters/token-cost-logger.js';
import type { CheckpointCostState } from './checkpoint.js';

export type CostStatus = 'ok' | 'soft_warn' | 'hard_throttle' | 'kill_switch';

export interface CostThresholds {
  /** 0~1 비율. 도달 시 console.warn 만. 기본 0.7 */
  readonly soft: number;
  /** 0~1 비율. 도달 시 다음 호출 throttle. 기본 0.9 */
  readonly hard: number;
  /** 0~1 비율. 도달 시 onKillSwitch 호출 (autoEnforce). 기본 1.0 */
  readonly kill: number;
}

export const DEFAULT_THRESHOLDS: CostThresholds = {
  soft: 0.7,
  hard: 0.9,
  kill: 1.0,
};

/**
 * KillSwitchError — caller 가 catch 하여 checkpoint flush + finalize() 후 종료하는 패턴 지원.
 * 기본 onKillSwitch 가 throw 하므로 try/catch 없으면 process 종료와 동등 (UncaughtException).
 */
export class KillSwitchError extends Error {
  constructor(
    public readonly batchRunId: string,
    public readonly spendUsd: number,
    public readonly budgetUsd: number,
  ) {
    super(
      `[CostMeter] Kill switch triggered — batch=${batchRunId}, ` +
        `spend=$${spendUsd.toFixed(4)}/$${budgetUsd.toFixed(2)} (${((spendUsd / budgetUsd) * 100).toFixed(1)}%)`,
    );
    this.name = 'KillSwitchError';
  }
}

export interface CostMeterOptions {
  /** 1회 BATCH 실행 식별자 */
  readonly batchRunId: string;
  /** 1회 BATCH 실행 비용 상한 (USD). Layer 2 monthly cap 의 1/N (ADR-025 §2.5) */
  readonly dailyBudgetUsd: number;
  /** JSONL 감사 로거 — 미주입 시 토큰 기록만 in-memory */
  readonly logger?: TokenLogger;
  /** 임계 비율 — 기본 0.7 / 0.9 / 1.0 */
  readonly thresholds?: CostThresholds;
  /**
   * true 면 recordTokens() 호출 시 kill 임계 도달 시 자동 onKillSwitch 호출.
   * false (기본) 면 status 반환만, 실행은 호출자가 결정.
   *
   * **중요:** hard_throttle 은 sync recordTokens 에서 자동 await 불가.
   *           caller 가 returned status 를 보고 applyThrottle() 을 await 할 책임.
   *
   * 기본: false (안전). production pipeline 통합 시 명시 true + onKillSwitch 에
   *       checkpoint flush hook 주입 (Step 11.5 통합 의무).
   */
  readonly autoEnforce?: boolean;
  /** 시간 주입 — 테스트용. 기본: Date.now */
  readonly clock?: () => number;
  /**
   * kill switch 발동 시 실행. 기본: throw new KillSwitchError (caller catch 의무).
   * production 에서는 checkpoint flush 후 process.exit 하는 함수 주입.
   */
  readonly onKillSwitch?: () => never;
  /** throttle 시 sleep 함수 — 테스트에서 즉시 resolve 가능. 기본: 1초 */
  readonly throttleSleepMs?: number;
  /**
   * 이전 BATCH 실행에서 누적된 비용 (USD). recover/resume 시 사용.
   * 기본: 0. Idempotency (Step 5) + recover (Step 11.5) 통합 시 활용.
   */
  readonly initialSpendUsd?: number;
}

export interface ThresholdBreach {
  readonly threshold: 'soft_warn' | 'hard_throttle' | 'kill_switch';
  readonly at_spend_usd: number;
  readonly at_ratio: number;
  readonly timestamp_ms: number;
  readonly stage: string;
}

export interface PerModelUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface CostReport {
  readonly batch_run_id: string;
  readonly daily_budget_usd: number;
  readonly initial_spend_usd: number;
  readonly total_input_tokens: number;
  readonly total_output_tokens: number;
  readonly total_cost_usd: number;
  readonly per_model: Readonly<Record<string, PerModelUsage>>;
  readonly threshold_breaches: readonly ThresholdBreach[];
  readonly call_count: number;
  readonly duration_ms: number;
  readonly final_status: CostStatus;
}

/** 1 USD = 1,000,000 micro-USD (정수 누적용) */
const MICRO_USD_PER_USD = 1_000_000;

/**
 * Layer 1 Application Cost Meter.
 *
 * 사용 패턴 (production):
 * ```
 * const meter = new CostMeter({
 *   batchRunId,
 *   dailyBudgetUsd: 10,
 *   autoEnforce: true,
 *   onKillSwitch: () => { flushCheckpoint(); process.exit(1); },  // Step 11.5 통합
 * });
 * meter.start();
 * for (const call of apiCalls) {
 *   const usage = await callAnthropic(...);
 *   const status = meter.recordTokens(usage.input_tokens, usage.output_tokens, model, 'batch_structurize');
 *   if (status === 'hard_throttle') await meter.applyThrottle();
 * }
 * const report = meter.finalize();
 * ```
 */
export class CostMeter {
  private readonly batchRunId: string;
  private readonly dailyBudgetUsd: number;
  private readonly dailyBudgetMicroUsd: number;
  private readonly initialSpendMicroUsd: number;
  private readonly logger: TokenLogger | undefined;
  private readonly thresholds: CostThresholds;
  private readonly autoEnforce: boolean;
  private readonly clock: () => number;
  private readonly onKillSwitch: () => never;
  private readonly throttleSleepMs: number;

  private startedAt: number | null = null;
  /** 정수 마이크로센트 누적 — 부동소수점 오차 0 */
  private totalCostMicroUsd = 0;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private callCount = 0;
  private readonly perModelMicro: Map<
    string,
    { inputTokens: number; outputTokens: number; costMicroUsd: number }
  > = new Map();
  private readonly breaches: ThresholdBreach[] = [];
  /** 단일 임계는 1회만 기록 — soft 가 매 호출마다 발화 방지 */
  private firedThresholds: Set<'soft_warn' | 'hard_throttle' | 'kill_switch'> = new Set();

  constructor(options: CostMeterOptions) {
    if (!Number.isFinite(options.dailyBudgetUsd) || options.dailyBudgetUsd <= 0) {
      throw new Error(
        `[CostMeter] dailyBudgetUsd must be > 0 and finite, got ${options.dailyBudgetUsd}`,
      );
    }
    const initialSpend = options.initialSpendUsd ?? 0;
    if (!Number.isFinite(initialSpend) || initialSpend < 0) {
      throw new Error(`[CostMeter] initialSpendUsd must be >= 0 and finite, got ${initialSpend}`);
    }
    this.batchRunId = options.batchRunId;
    this.dailyBudgetUsd = options.dailyBudgetUsd;
    this.dailyBudgetMicroUsd = Math.round(options.dailyBudgetUsd * MICRO_USD_PER_USD);
    this.initialSpendMicroUsd = Math.round(initialSpend * MICRO_USD_PER_USD);
    this.totalCostMicroUsd = this.initialSpendMicroUsd;
    this.logger = options.logger;
    this.thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
    this.validateThresholds(this.thresholds);
    this.autoEnforce = options.autoEnforce ?? false;
    this.clock = options.clock ?? (() => Date.now());
    const batchId = this.batchRunId;
    const budgetUsd = this.dailyBudgetUsd;
    this.onKillSwitch =
      options.onKillSwitch ??
      ((): never => {
        throw new KillSwitchError(batchId, this.totalCostMicroUsd / MICRO_USD_PER_USD, budgetUsd);
      });
    this.throttleSleepMs = options.throttleSleepMs ?? 1000;
  }

  private validateThresholds(t: CostThresholds): void {
    if (!(t.soft > 0 && t.soft < t.hard && t.hard < t.kill && t.kill <= 1.0)) {
      throw new Error(
        `[CostMeter] Invalid thresholds — must satisfy 0 < soft < hard < kill <= 1.0. ` +
          `Got soft=${t.soft}, hard=${t.hard}, kill=${t.kill}`,
      );
    }
  }

  /** BATCH 시작 시 호출. duration 측정 시작점. */
  start(): void {
    if (this.startedAt !== null) {
      throw new Error('[CostMeter] start() called twice');
    }
    this.startedAt = this.clock();
  }

  /**
   * 매 Anthropic API 호출 직후 호출.
   *
   * @returns 호출 후 status. autoEnforce=false 인 경우 호출자가 status 보고 행동 결정.
   *          autoEnforce=true 인 경우 kill 도달 시 onKillSwitch (never) 호출.
   *
   *  **caller 책임:** status === 'hard_throttle' 시 applyThrottle() 을 await.
   *                    sync recordTokens 안에서 자동 await 불가.
   */
  recordTokens(
    inputTokens: number,
    outputTokens: number,
    model: string,
    stage: string,
  ): CostStatus {
    if (this.startedAt === null) {
      throw new Error('[CostMeter] recordTokens() before start()');
    }
    if (
      !Number.isFinite(inputTokens) ||
      !Number.isFinite(outputTokens) ||
      !Number.isInteger(inputTokens) ||
      !Number.isInteger(outputTokens) ||
      inputTokens < 0 ||
      outputTokens < 0
    ) {
      throw new Error(
        `[CostMeter] Invalid tokens — input=${inputTokens}, output=${outputTokens}. ` +
          `Must be finite non-negative integers.`,
      );
    }

    const { costUsd } = calculateTokenCost(model, inputTokens, outputTokens);
    if (!Number.isFinite(costUsd) || costUsd < 0) {
      throw new Error(
        `[CostMeter] calculateTokenCost returned invalid (${costUsd}) for model=${model}. ` +
          `Check pricing registry — fallback may have failed.`,
      );
    }
    const costMicroUsd = Math.round(costUsd * MICRO_USD_PER_USD);

    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;
    this.totalCostMicroUsd += costMicroUsd;
    this.callCount += 1;

    const existing = this.perModelMicro.get(model);
    if (existing) {
      existing.inputTokens += inputTokens;
      existing.outputTokens += outputTokens;
      existing.costMicroUsd += costMicroUsd;
    } else {
      this.perModelMicro.set(model, {
        inputTokens,
        outputTokens,
        costMicroUsd,
      });
    }

    if (this.logger) {
      // NOTE (P2-M3 ARCHITECT review): token-cost-logger 내부에서 calculateTokenCost 를
      //   다시 호출 — 단가 갱신 race 가능. Step 11.5 통합 시점에 logger 인터페이스 확장하여
      //   costUsd 주입 형태로 전환 (TokenLoggerInput 에 costUsdOverride 옵션 추가).
      this.logger.record({
        batchId: this.batchRunId,
        model,
        inputTokens,
        outputTokens,
        retries: 0,
        stopReason: null,
        stage,
        error: null,
      });
    }

    return this.evaluateAndEnforce(stage);
  }

  /** 현재 누적 비용 (USD). initialSpend 포함. */
  getCurrentSpend(): number {
    return this.totalCostMicroUsd / MICRO_USD_PER_USD;
  }

  /** 현재 status — recordTokens 호출 사이에 외부 조회용 */
  getStatus(): CostStatus {
    return this.classifyRatio(this.ratio());
  }

  /** 현재 비율 (0 ~ ∞) — kill 초과 가능 */
  ratio(): number {
    return this.totalCostMicroUsd / this.dailyBudgetMicroUsd;
  }

  /**
   * Hard throttle 적용 — 다음 호출 전 N ms sleep.
   * status === 'hard_throttle' 인 경우 caller 가 await 호출.
   */
  async applyThrottle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.throttleSleepMs));
  }

  /**
   * Kill switch — 기본은 KillSwitchError throw (caller catch 의무).
   * production 에서는 onKillSwitch 옵션으로 checkpoint flush 후 process.exit 주입.
   * 호출 후 반환되지 않음 (never).
   */
  triggerKillSwitch(): never {
    return this.onKillSwitch();
  }

  /**
   * Checkpoint 발행용 cost state 스냅샷.
   *
   * Step 11.6 통합 — `apps/batch/src/checkpoint.ts` 의 `BatchCheckpoint.cost_state`
   * 필드에 직렬화 가능한 형태로 인계. 매 stage 종료 시 호출 가능 (finalize 와 무관).
   *
   * recover 시 `CostMeterOptions.initialSpendUsd` 로 재진입 — `initial_spend_usd` 는
   * 최초 BATCH 의 spend 누적을 보존 (현 BATCH instance 의 `getCurrentSpend()` 와 다름).
   *
   * 타입 일관성: `CheckpointCostState.threshold_breaches` 는 `ThresholdBreach` 의
   * 3 필드 부분집합 (timestamp_ms / stage 제외). 본 메서드가 매핑 책임 보유.
   */
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

  /** BATCH 종료 시 호출. CostReport 반환. */
  finalize(): CostReport {
    if (this.startedAt === null) {
      throw new Error('[CostMeter] finalize() before start()');
    }
    const duration = this.clock() - this.startedAt;
    const perModelObj: Record<string, PerModelUsage> = {};
    for (const [k, v] of this.perModelMicro) {
      perModelObj[k] = {
        inputTokens: v.inputTokens,
        outputTokens: v.outputTokens,
        costUsd: v.costMicroUsd / MICRO_USD_PER_USD,
      };
    }
    return {
      batch_run_id: this.batchRunId,
      daily_budget_usd: this.dailyBudgetUsd,
      initial_spend_usd: this.initialSpendMicroUsd / MICRO_USD_PER_USD,
      total_input_tokens: this.totalInputTokens,
      total_output_tokens: this.totalOutputTokens,
      total_cost_usd: this.totalCostMicroUsd / MICRO_USD_PER_USD,
      per_model: perModelObj,
      threshold_breaches: [...this.breaches],
      call_count: this.callCount,
      duration_ms: duration,
      final_status: this.classifyRatio(this.ratio()),
    };
  }

  // === 내부 ===

  private classifyRatio(ratio: number): CostStatus {
    if (ratio >= this.thresholds.kill) return 'kill_switch';
    if (ratio >= this.thresholds.hard) return 'hard_throttle';
    if (ratio >= this.thresholds.soft) return 'soft_warn';
    return 'ok';
  }

  /**
   * 현재 ratio 기준 status 판정 + 임계 1회성 기록.
   *
   * 단발 거대 호출 시(SOFT 건너뛰고 KILL 도달) 누락된 lower 임계도 함께 기록.
   * autoEnforce=true 인 경우 kill 시 onKillSwitch 호출 (never 반환).
   *
   * NOTE: throttle 은 sync 라 await 불가 — caller 책임 (recordTokens 의 docstring 참조).
   */
  private evaluateAndEnforce(stage: string): CostStatus {
    const ratio = this.ratio();
    const status = this.classifyRatio(ratio);

    // SOFT 임계 도달 (단발 거대 호출 시 KILL 도달 후라도 기록)
    if (ratio >= this.thresholds.soft && !this.firedThresholds.has('soft_warn')) {
      this.firedThresholds.add('soft_warn');
      this.recordBreach('soft_warn', stage);
      console.warn(
        `[CostMeter] SOFT_WARN — spend=$${this.getCurrentSpend().toFixed(4)} / ` +
          `$${this.dailyBudgetUsd.toFixed(2)} (${(ratio * 100).toFixed(1)}%). ` +
          `BATCH continues.`,
      );
    }

    // HARD 임계 도달
    if (ratio >= this.thresholds.hard && !this.firedThresholds.has('hard_throttle')) {
      this.firedThresholds.add('hard_throttle');
      this.recordBreach('hard_throttle', stage);
      console.warn(
        `[CostMeter] HARD_THROTTLE — spend=$${this.getCurrentSpend().toFixed(4)} / ` +
          `$${this.dailyBudgetUsd.toFixed(2)} (${(ratio * 100).toFixed(1)}%). ` +
          `Caller must await applyThrottle() before next call.`,
      );
    }

    // KILL 임계 도달 — autoEnforce 시 onKillSwitch 호출
    if (ratio >= this.thresholds.kill && !this.firedThresholds.has('kill_switch')) {
      this.firedThresholds.add('kill_switch');
      this.recordBreach('kill_switch', stage);
      console.error(
        `[CostMeter] KILL_SWITCH — spend=$${this.getCurrentSpend().toFixed(4)} / ` +
          `$${this.dailyBudgetUsd.toFixed(2)} (${(ratio * 100).toFixed(1)}%). ` +
          `Triggering shutdown.`,
      );
      if (this.autoEnforce) {
        this.triggerKillSwitch();
      }
    }

    return status;
  }

  private recordBreach(
    threshold: 'soft_warn' | 'hard_throttle' | 'kill_switch',
    stage: string,
  ): void {
    this.breaches.push({
      threshold,
      at_spend_usd: this.getCurrentSpend(),
      at_ratio: this.ratio(),
      timestamp_ms: this.clock(),
      stage,
    });
  }
}
