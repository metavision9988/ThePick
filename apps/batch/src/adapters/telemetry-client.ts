/**
 * Telemetry Client — apps/batch → POST /api/telemetry emit helper.
 *
 * @runtime Node.js only. fetch() Node 18+ 내장 사용.
 *
 * 책임:
 *   1. 8 게이지 enum (apps/api/src/telemetry/types.ts:14-23 와 1:1 정합) emit
 *   2. fire-and-forget queue + flushPending() — runPipeline finally 에서 in-flight drain
 *   3. timeout (5s 기본) + 1회 retry (네트워크/503 만, 4xx 즉시 fail)
 *   4. 실패 시 logger.error + non-fatal — BATCH 진행 차단 금지
 *   5. ENV (THEPICK_TELEMETRY_API_BASE / THEPICK_TELEMETRY_ADMIN_TOKEN) 미설정 시 noop
 *      + 1회 warn (production 의무, 테스트/dev 허용)
 *
 * 인증:
 *   X-Admin-Token 헤더 (apps/api/src/telemetry/admin-token.ts:74-83 fallback 경로).
 *   apps/admin-web 은 admin_session HttpOnly cookie 우선이지만 batch (Node) 는 헤더 직행.
 *
 * Hard Rule 17 정합:
 *   examId 는 caller 가 EXAM_IDS 경유 주입 — 본 모듈은 ExamId brand type 만 receive.
 *
 * 의존:
 *   - apps/api/src/telemetry/types.ts (게이지 enum + payload schema 정합)
 */

import type { ExamId, Logger } from '@thepick/shared';

/**
 * 8 게이지 enum — apps/api/src/telemetry/types.ts ENGINE_TELEMETRY_GAUGES 와 1:1 정합.
 * 변경 시 apps/api 측 동시 갱신 의무.
 */
export const TELEMETRY_GAUGES = [
  'batch_progress',
  'cost',
  'd1_slo',
  'graph_integrity',
  'quality_gate',
  'formula_accuracy',
  'reviewer_queue',
  'learning_slo',
] as const;
export type TelemetryGauge = (typeof TELEMETRY_GAUGES)[number];

export interface TelemetryEmitInput {
  readonly gaugeName: TelemetryGauge;
  /** metricValue 또는 metricJson 중 최소 1개 필수 (apps/api types.ts:53-55 refine 정합) */
  readonly metricValue?: number;
  readonly metricJson?: Readonly<Record<string, unknown>>;
  /** 호출 출처 식별자 — 예: 'pipeline:qg2_gate' */
  readonly sourceId?: string;
}

export interface TelemetryClient {
  /** fire-and-forget — 즉시 return, in-flight Promise 는 내부 queue 에 누적. */
  emit(input: TelemetryEmitInput): void;
  /** 모든 in-flight emit 완료 대기. runPipeline finally 에서 호출 의무. */
  flushPending(): Promise<void>;
}

export interface TelemetryClientOptions {
  readonly apiBase: string;
  readonly adminToken: string;
  readonly examId: ExamId;
  readonly batchRunId: string;
  readonly logger: Logger;
  /** 기본 5000ms */
  readonly timeoutMs?: number;
  /** 기본 2 (초기 + 1회 재시도) */
  readonly maxAttempts?: number;
  /** 테스트 주입용 — 미주입 시 globalThis.fetch */
  readonly fetchImpl?: typeof fetch;
  /** 테스트 주입용 — 미주입 시 setTimeout (재시도 backoff) */
  readonly sleepImpl?: (ms: number) => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 500;

class HttpTelemetryClient implements TelemetryClient {
  private readonly options: Required<Omit<TelemetryClientOptions, 'fetchImpl' | 'sleepImpl'>> & {
    readonly fetchImpl: typeof fetch;
    readonly sleepImpl: (ms: number) => Promise<void>;
  };
  private readonly pending = new Set<Promise<void>>();

  constructor(options: TelemetryClientOptions) {
    // 명시 가드: nullish coalescing (??) 은 0 통과 시키므로 명시 throw 의무.
    // timeoutMs <= 0 → AbortController 즉시 abort → 영구 fail. 의도된 사용 0.
    // maxAttempts < 1 → loop 진입 안 함 → throw 'unknown'. 의도된 사용 0.
    if (options.timeoutMs !== undefined && options.timeoutMs <= 0) {
      throw new Error(`[TelemetryClient] timeoutMs must be > 0 (got ${options.timeoutMs})`);
    }
    if (options.maxAttempts !== undefined && options.maxAttempts < 1) {
      throw new Error(`[TelemetryClient] maxAttempts must be >= 1 (got ${options.maxAttempts})`);
    }
    this.options = {
      apiBase: options.apiBase.replace(/\/+$/, ''),
      adminToken: options.adminToken,
      examId: options.examId,
      batchRunId: options.batchRunId,
      logger: options.logger,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      fetchImpl: options.fetchImpl ?? globalThis.fetch.bind(globalThis),
      sleepImpl:
        options.sleepImpl ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms))),
    };
  }

  emit(input: TelemetryEmitInput): void {
    if (input.metricValue === undefined && input.metricJson === undefined) {
      this.options.logger.error(
        'telemetry emit rejected — metricValue/metricJson 둘 다 부재 (apps/api refine 위반)',
        undefined,
        { gauge: input.gaugeName, sourceId: input.sourceId },
      );
      return;
    }
    const promise = this.send(input).catch((err: unknown) => {
      const reason = err instanceof Error ? err.message : String(err);
      this.options.logger.error('telemetry emit failed (non-fatal)', err, {
        gauge: input.gaugeName,
        sourceId: input.sourceId,
        reason,
      });
    });
    this.pending.add(promise);
    void promise.finally(() => {
      this.pending.delete(promise);
    });
  }

  async flushPending(): Promise<void> {
    const snapshot = [...this.pending];
    if (snapshot.length === 0) return;
    await Promise.allSettled(snapshot);
  }

  private async send(input: TelemetryEmitInput): Promise<void> {
    const url = `${this.options.apiBase}/api/telemetry`;
    const body = JSON.stringify({
      examId: this.options.examId,
      gaugeName: input.gaugeName,
      ...(input.metricValue !== undefined ? { metricValue: input.metricValue } : {}),
      ...(input.metricJson !== undefined ? { metricJson: input.metricJson } : {}),
      ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
      batchRunId: this.options.batchRunId,
    });

    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
      // nonRetryable: 4xx 응답 — retry 의미 없음 (VALIDATION_ERROR / UNAUTHORIZED).
      // catch 가 throw 를 다시 잡으면 retry loop 진입하므로 별도 flag 사용.
      let nonRetryable = false;
      try {
        const res = await this.options.fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': this.options.adminToken,
          },
          body,
          signal: controller.signal,
        });
        if (res.ok) {
          return;
        }
        lastErr = new Error(
          `telemetry POST ${res.status} ${res.statusText} (gauge=${input.gaugeName})`,
        );
        if (res.status >= 400 && res.status < 500) {
          nonRetryable = true;
        }
      } catch (err) {
        // AbortError (timeout) 또는 network err — retry 대상
        lastErr = err;
      } finally {
        clearTimeout(timer);
      }

      if (nonRetryable) break;
      if (attempt < this.options.maxAttempts) {
        await this.options.sleepImpl(RETRY_BACKOFF_MS * attempt);
      }
    }
    throw lastErr ?? new Error('telemetry emit failed (unknown)');
  }
}

class NoopTelemetryClient implements TelemetryClient {
  emit(): void {
    /* noop */
  }
  async flushPending(): Promise<void> {
    /* noop */
  }
}

/**
 * 명시 옵션으로 TelemetryClient 생성 (테스트 + production 진입점).
 */
export function createTelemetryClient(options: TelemetryClientOptions): TelemetryClient {
  return new HttpTelemetryClient(options);
}

/**
 * ENV (THEPICK_TELEMETRY_API_BASE / THEPICK_TELEMETRY_ADMIN_TOKEN) 기반 생성.
 * 미설정 시 NoopTelemetryClient 반환 + 1회 warn.
 *
 * @example
 * const client = createTelemetryClientFromEnv({
 *   examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
 *   batchRunId: 'uuid-...',
 *   logger,
 * });
 */
export function createTelemetryClientFromEnv(args: {
  readonly examId: ExamId;
  readonly batchRunId: string;
  readonly logger: Logger;
}): TelemetryClient {
  const apiBase = process.env.THEPICK_TELEMETRY_API_BASE;
  const adminToken = process.env.THEPICK_TELEMETRY_ADMIN_TOKEN;
  if (
    typeof apiBase !== 'string' ||
    apiBase.length === 0 ||
    typeof adminToken !== 'string' ||
    adminToken.length === 0
  ) {
    args.logger.warn(
      'telemetry disabled — THEPICK_TELEMETRY_API_BASE/THEPICK_TELEMETRY_ADMIN_TOKEN 미설정',
      {
        apiBaseSet: typeof apiBase === 'string' && apiBase.length > 0,
        adminTokenSet: typeof adminToken === 'string' && adminToken.length > 0,
      },
    );
    return new NoopTelemetryClient();
  }
  return new HttpTelemetryClient({ apiBase, adminToken, ...args });
}

/**
 * 테스트/명시 noop 진입점 — production 코드에서 직접 호출 금지.
 */
export function createNoopTelemetryClient(): TelemetryClient {
  return new NoopTelemetryClient();
}
