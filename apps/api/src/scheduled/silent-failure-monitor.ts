/**
 * silent_failure_monitor — engine_telemetry에서 silent failure 이벤트를 주기 집계.
 *
 * 트리거: Cloudflare Workers Cron `0 3 * * *` (rate-limit GC와 동일 cron 묶음).
 *
 * 배경 (Phase 3 Step 3-UX-6e 5-페르소나 devops CRIT-DO-1 흡수):
 *   /grade의 streak UPSERT 실패는 `streak_silent_failure` event,
 *   /session/:id/complete의 weakDelta 쿼리 실패는 `weak_delta_silent_failure` event를
 *   `learning_slo` 게이지에 emit한다 (apps/api/src/study/routes.ts).
 *   그러나 emit만 되고 운영자 alert path 0건 → 사용자 영향 인지 불가.
 *
 * 본 monitor는 직전 24h 동안 silent_failure 이벤트 카운트 조회 + 임계 초과 시
 * logger.error + console.error 2중 emit (logpush 미설정 환경에서 stderr 즉시 노출).
 *
 * Email Routing / Cloudflare Healthchecks 등 외부 alert path는 ADR-043 §3 carry-over.
 * 본 monitor는 1차 가시화 — 운영자가 wrangler tail 또는 admin-web에서 확인 가능.
 */

import type { Logger } from '@thepick/shared';

/** ADR-043 §2 정합 — 임계값 default. 본 함수 호출 측에서 주입 가능. */
export const SILENT_FAILURE_WARN_THRESHOLD = 5;
export const SILENT_FAILURE_CRITICAL_THRESHOLD = 50;

/** ADR-043 §2 정합 — 추적 이벤트 (apps/api/src/study/routes.ts emit 정합). */
export const SILENT_FAILURE_EVENTS = [
  'streak_silent_failure',
  'weak_delta_silent_failure',
] as const;

export type SilentFailureEvent = (typeof SILENT_FAILURE_EVENTS)[number];

export interface SilentFailureMonitorOptions {
  /** 현재 시각 (테스트 결정론). 기본: 실시간. */
  readonly now?: () => Date;
  /** 조회 범위 (시간). 기본: 24h. */
  readonly windowHours?: number;
  /** WARN 임계. 기본: SILENT_FAILURE_WARN_THRESHOLD. */
  readonly warnThreshold?: number;
  /** CRITICAL 임계. 기본: SILENT_FAILURE_CRITICAL_THRESHOLD. */
  readonly criticalThreshold?: number;
}

export interface SilentFailureCount {
  readonly event: SilentFailureEvent;
  readonly count: number;
}

export interface SilentFailureMonitorResult {
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly counts: ReadonlyArray<SilentFailureCount>;
  readonly totalCount: number;
  readonly severity: 'ok' | 'warn' | 'critical';
}

/**
 * engine_telemetry에서 silent_failure 이벤트 카운트 집계.
 *
 * 단일 쿼리: `WHERE gauge_name = 'learning_slo' AND recorded_at >= ?
 *           AND json_extract(metric_json, '$.event') IN (...)`
 * 인덱스 `idx_engine_telemetry_gauge_recorded(gauge_name, recorded_at)` 활용.
 *
 * 결과 분류:
 * - totalCount === 0: 'ok' (정상)
 * - totalCount <= warnThreshold: 'ok'
 * - warnThreshold < totalCount <= criticalThreshold: 'warn'
 * - totalCount > criticalThreshold: 'critical'
 */
export async function monitorSilentFailures(
  db: D1Database,
  options: SilentFailureMonitorOptions = {},
): Promise<SilentFailureMonitorResult> {
  const now = (options.now ?? (() => new Date()))();
  const windowHours = options.windowHours ?? 24;
  const warnThreshold = options.warnThreshold ?? SILENT_FAILURE_WARN_THRESHOLD;
  const criticalThreshold = options.criticalThreshold ?? SILENT_FAILURE_CRITICAL_THRESHOLD;

  if (!Number.isFinite(windowHours) || windowHours <= 0) {
    throw new Error(`monitorSilentFailures: invalid windowHours=${windowHours} (must be positive)`);
  }
  if (warnThreshold < 0 || criticalThreshold < warnThreshold) {
    throw new Error(
      `monitorSilentFailures: invalid thresholds (warn=${warnThreshold}, crit=${criticalThreshold})`,
    );
  }

  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  const windowEnd = now;

  // 이벤트별 카운트 — IN clause + GROUP BY로 단일 round-trip.
  // metric_json은 TEXT 컬럼, json_extract으로 event 필드 추출.
  const result = await db
    .prepare(
      `SELECT json_extract(metric_json, '$.event') AS event,
              COUNT(*) AS cnt
         FROM engine_telemetry
        WHERE gauge_name = 'learning_slo'
          AND recorded_at >= ?
          AND recorded_at < ?
          AND json_extract(metric_json, '$.event') IN ('streak_silent_failure', 'weak_delta_silent_failure')
        GROUP BY event`,
    )
    .bind(windowStart.toISOString(), windowEnd.toISOString())
    .all<{ event: string; cnt: number }>();

  const countMap = new Map<SilentFailureEvent, number>();
  for (const event of SILENT_FAILURE_EVENTS) {
    countMap.set(event, 0);
  }
  for (const row of result.results) {
    const event = row.event as SilentFailureEvent;
    if (SILENT_FAILURE_EVENTS.includes(event)) {
      countMap.set(event, Number(row.cnt));
    }
  }

  const counts: SilentFailureCount[] = Array.from(countMap.entries()).map(([event, count]) => ({
    event,
    count,
  }));
  const totalCount = counts.reduce((sum, c) => sum + c.count, 0);

  let severity: 'ok' | 'warn' | 'critical';
  if (totalCount > criticalThreshold) severity = 'critical';
  else if (totalCount > warnThreshold) severity = 'warn';
  else severity = 'ok';

  return {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    counts,
    totalCount,
    severity,
  };
}

/**
 * scheduled handler 측 wrapper — 결과를 logger + console로 분기 emit.
 *
 * 임계값 의존성:
 * - severity === 'ok' → logger.info (정상 traffic 분석용)
 * - severity === 'warn' → logger.warn + console.warn (1차 가시화)
 * - severity === 'critical' → logger.error + console.error (운영자 즉시 인지)
 *
 * ADR-043 §3 carry-over — Email Routing / Healthchecks 외부 alert는 별도 인프라.
 */
export async function reportSilentFailures(
  db: D1Database,
  logger: Logger,
  options: SilentFailureMonitorOptions = {},
): Promise<SilentFailureMonitorResult> {
  const result = await monitorSilentFailures(db, options);
  const payload = {
    totalCount: result.totalCount,
    counts: result.counts,
    windowStart: result.windowStart,
    windowEnd: result.windowEnd,
    severity: result.severity,
  };

  if (result.severity === 'critical') {
    logger.error('silent_failure threshold critical — operator alert required', undefined, payload);
    console.error(
      `[scheduled] silent_failure CRITICAL: total=${result.totalCount} (window ${result.windowStart} → ${result.windowEnd})`,
    );
  } else if (result.severity === 'warn') {
    logger.warn('silent_failure threshold warn', payload);
    console.warn(
      `[scheduled] silent_failure WARN: total=${result.totalCount} (window ${result.windowStart} → ${result.windowEnd})`,
    );
  } else {
    logger.info('silent_failure monitor ok', payload);
  }

  return result;
}
