/**
 * Engine Telemetry 타입 + Zod 검증 스키마.
 *
 * Cloudflare 단일 벤더 정합 (D1 engine_telemetry + admin-web 대시보드).
 * 8 게이지 (Phase 1: 1~7 활성 / Phase 2: learning_slo 활성).
 *
 * 근거: docs/plans/engine-hardening/step19-observability.plan.md §3
 */

import { z } from 'zod';
import { isValidExamId, type ExamId } from '@thepick/shared';

/** 8 게이지 enum — migrations/0017_engine_telemetry.sql CHECK 제약과 동기. */
export const ENGINE_TELEMETRY_GAUGES = [
  'batch_progress',
  'cost',
  'd1_slo',
  'graph_integrity',
  'quality_gate',
  'formula_accuracy',
  'reviewer_queue',
  'learning_slo',
] as const;

export type EngineTelemetryGauge = (typeof ENGINE_TELEMETRY_GAUGES)[number];

/**
 * Phase 1 시점 활성 게이지 (learning_slo 제외 7개). admin-web 표시 정책 + write 측 차단 정책.
 *
 * **wire-up 진척 (Step 037 CRITICAL-DO-S1-1 흡수 시점):**
 *   - Phase 1 초반 wire-up: 6 게이지 (batch_progress / cost / d1_slo / graph_integrity / quality_gate / formula_accuracy)
 *   - Phase 1 후반 wire-up 예약: reviewer_queue (LLM Reviewer 도입 후 — auto-review-protocol.md Cat 8)
 *
 * **admin-web graceful no_data 의무:**
 *   reviewer_queue 슬롯은 LLM Reviewer 도입 전까지 데이터 0건. dashboard 측은 "데이터 없음"
 *   graceful 표시 의무 (영구 no_data 알림 차단). Phase 2 진입 시점에 reviewer_queue 가
 *   여전히 wire-up 부재라면 PHASE_2_GAUGES 로 이동 검토.
 */
export const PHASE_1_GAUGES: ReadonlyArray<EngineTelemetryGauge> = [
  'batch_progress',
  'cost',
  'd1_slo',
  'graph_integrity',
  'quality_gate',
  'formula_accuracy',
  'reviewer_queue',
] as const;

export const PHASE_2_GAUGES: ReadonlyArray<EngineTelemetryGauge> = ['learning_slo'] as const;

/**
 * POST /api/telemetry payload — Zod 검증.
 * - examId: Hard Rule 17 정합 (ALL_EXAM_ID_VALUES allowlist)
 * - metric_value 또는 metric_json 둘 중 최소 1개 필수 (DB CHECK 와 동기)
 */
export const telemetryEventPayloadSchema = z
  .object({
    examId: z.string().refine(isValidExamId, { message: 'Hard Rule 17 — unknown exam_id' }),
    gaugeName: z.enum(ENGINE_TELEMETRY_GAUGES),
    metricValue: z.number().finite().optional(),
    metricJson: z.record(z.string(), z.unknown()).optional(),
    sourceId: z.string().min(1).max(256).optional(),
    batchRunId: z.string().min(1).max(128).optional(),
  })
  .refine((data) => data.metricValue !== undefined || data.metricJson !== undefined, {
    message: 'metricValue 또는 metricJson 중 최소 1개 필수',
    path: ['metricValue'],
  });

export type TelemetryEventPayload = z.infer<typeof telemetryEventPayloadSchema>;

export interface TelemetryEvent {
  readonly id: string;
  readonly examId: ExamId;
  readonly gaugeName: EngineTelemetryGauge;
  readonly metricValue: number | null;
  readonly metricJson: Record<string, unknown> | null;
  readonly sourceId: string | null;
  readonly batchRunId: string | null;
  readonly recordedAt: string;
}

/** GaugeSnapshot — admin-web 대시보드 read 응답. status는 게이지별 임계 평가 결과. */
export interface GaugeSnapshot {
  readonly gauge: EngineTelemetryGauge;
  readonly latest: TelemetryEvent | null;
  readonly count24h: number;
  readonly status: 'ok' | 'warn' | 'critical' | 'no_data';
  readonly phase: 1 | 2;
}

export interface DashboardResponse {
  readonly gauges: GaugeSnapshot[];
  readonly serverTime: string;
}
