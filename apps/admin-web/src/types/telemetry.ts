/**
 * Telemetry types — admin-web 측 mirror of apps/api/src/telemetry/types.ts.
 *
 * 별도 패키지화 회피 (Engine-First 분석 §2): 의존 모듈 3개 (admin-web + api + batch)
 * 미만이라 인터페이스 동기화는 수동 검증 (typecheck + 테스트). master-test-checklist
 * §3.1 통합 테스트 단방향 의존성 규칙 정합.
 */

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

export interface TelemetryEvent {
  readonly id: string;
  readonly examId: string;
  readonly gaugeName: EngineTelemetryGauge;
  readonly metricValue: number | null;
  readonly metricJson: Record<string, unknown> | null;
  readonly sourceId: string | null;
  readonly batchRunId: string | null;
  readonly recordedAt: string;
}

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

export const GAUGE_LABELS: Record<EngineTelemetryGauge, string> = {
  batch_progress: 'BATCH 진척',
  cost: 'Cost (Anthropic)',
  d1_slo: 'D1 Latency SLO',
  graph_integrity: 'Graph 무결성',
  quality_gate: '품질 게이트',
  formula_accuracy: 'Formula 정확도',
  reviewer_queue: 'Reviewer 큐',
  learning_slo: '학습 SLO (Phase 2)',
};

export const STATUS_COLORS: Record<GaugeSnapshot['status'], string> = {
  ok: '#16a34a',
  warn: '#eab308',
  critical: '#dc2626',
  no_data: '#94a3b8',
};
