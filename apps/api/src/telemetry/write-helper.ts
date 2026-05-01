/**
 * Telemetry D1 write helper.
 *
 * 책임:
 *   1. validated payload → engine_telemetry INSERT
 *   2. UUID v4 (Web Crypto crypto.randomUUID — Workers + Node 22+ 양쪽 호환)
 *   3. metric_json 직렬화 (JSON.stringify + 실패 시 throw — silent drop 차단)
 *   4. assertValidExamId 추가 검증 (Zod 통과 후에도 brand type 강제 — defense-in-depth)
 *
 * 결정성:
 *   - 동일 입력 → 다른 id (UUID 무작위) — 의도적 (telemetry는 매 호출 신규 이벤트)
 *   - recorded_at 은 D1 default (strftime UTC) — 호스트 시계 의존 일관
 *
 * 근거: docs/plans/engine-hardening/step19-observability.plan.md §4
 */

import type { Logger } from '@thepick/shared';
import { assertValidExamId } from '@thepick/shared';
import type { TelemetryEventPayload, TelemetryEvent } from './types.js';

export interface WriteTelemetryDeps {
  readonly db: D1Database;
  readonly logger: Logger;
  /** UUID 주입 가능 (테스트 결정성). 기본 crypto.randomUUID. */
  readonly generateId?: () => string;
}

export class TelemetryWriteError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TelemetryWriteError';
  }
}

/**
 * INSERT 후 신규 이벤트 row 반환. 호출자는 응답 body 에 그대로 직렬화 가능.
 * Throw 시 caller (routes.ts) 가 503 응답 + Retry-After 헤더.
 */
export async function writeTelemetryEvent(
  payload: TelemetryEventPayload,
  deps: WriteTelemetryDeps,
): Promise<TelemetryEvent> {
  // brand type 진입 게이트 — Zod refine 우회 시도 시 두 번째 차단 (Hard Rule 17 다층 방어)
  const examId = assertValidExamId(payload.examId);

  const id = (deps.generateId ?? (() => crypto.randomUUID()))();

  let metricJsonText: string | null = null;
  if (payload.metricJson !== undefined) {
    try {
      metricJsonText = JSON.stringify(payload.metricJson);
    } catch (err) {
      throw new TelemetryWriteError('metricJson serialization failed', err);
    }
    if (metricJsonText.length > 64 * 1024) {
      // 64KB 이상 = 비정상 페이로드 — Workers CPU 시간 + D1 row size 방어
      throw new TelemetryWriteError(
        `metricJson too large (${metricJsonText.length} bytes > 65536)`,
      );
    }
  }

  const metricValue = payload.metricValue ?? null;
  const sourceId = payload.sourceId ?? null;
  const batchRunId = payload.batchRunId ?? null;

  try {
    const result = await deps.db
      .prepare(
        `INSERT INTO engine_telemetry
           (id, exam_id, gauge_name, metric_value, metric_json, source_id, batch_run_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         RETURNING recorded_at`,
      )
      .bind(id, examId, payload.gaugeName, metricValue, metricJsonText, sourceId, batchRunId)
      .first<{ recorded_at: string }>();

    if (!result) {
      throw new TelemetryWriteError('INSERT returned no row (engine_telemetry)');
    }

    return {
      id,
      examId,
      gaugeName: payload.gaugeName,
      metricValue,
      metricJson: payload.metricJson ?? null,
      sourceId,
      batchRunId,
      recordedAt: result.recorded_at,
    };
  } catch (err) {
    if (err instanceof TelemetryWriteError) throw err;
    deps.logger.error('engine_telemetry INSERT failed', err, {
      gaugeName: payload.gaugeName,
      examId,
    });
    throw new TelemetryWriteError('D1 INSERT failed', err);
  }
}
