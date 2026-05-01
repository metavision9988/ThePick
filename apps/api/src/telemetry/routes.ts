/**
 * Telemetry HTTP routes (Hono).
 *
 * 엔드포인트:
 *   - POST /api/telemetry                   — engine 측 write (BATCH 적재 / cost-meter 등)
 *   - GET  /api/telemetry/gauges/:gaugeName — admin-web read (특정 게이지 타임라인)
 *   - GET  /api/telemetry/dashboard         — admin-web read (8 게이지 스냅샷)
 *
 * 인증:
 *   - 모든 라우트 X-Admin-Token 검증 (Phase 1 임시). Cloudflare Access 도입 후 제거.
 *
 * 정책:
 *   - Zod validation → 422
 *   - assertValidExamId 추가 차단 (Hard Rule 17)
 *   - D1 5xx → 503 + Retry-After
 *   - GET 응답 캐시 비활성 (cache-policy 미들웨어가 private/no-store 강제)
 *
 * 근거: docs/plans/engine-hardening/step19-observability.plan.md §4
 */

import { Hono } from 'hono';
import { createLogger, isValidExamId, type Logger, type LoggerEnvironment } from '@thepick/shared';
import { requireAdminToken, type AdminTokenBindings } from './admin-token.js';
import {
  ENGINE_TELEMETRY_GAUGES,
  PHASE_1_GAUGES,
  PHASE_2_GAUGES,
  telemetryEventPayloadSchema,
  type DashboardResponse,
  type EngineTelemetryGauge,
  type GaugeSnapshot,
  type TelemetryEvent,
} from './types.js';
import { writeTelemetryEvent, TelemetryWriteError } from './write-helper.js';

export interface TelemetryBindings extends AdminTokenBindings {
  readonly DB: D1Database;
  readonly ENVIRONMENT?: string;
}

const KNOWN_ENVIRONMENTS: ReadonlySet<LoggerEnvironment> = new Set<LoggerEnvironment>([
  'development',
  'staging',
  'production',
  'test',
]);

function resolveLoggerEnv(envName: string | undefined): LoggerEnvironment {
  return envName !== undefined && KNOWN_ENVIRONMENTS.has(envName as LoggerEnvironment)
    ? (envName as LoggerEnvironment)
    : 'development';
}

function buildLogger(env: TelemetryBindings): Logger {
  return createLogger({
    service: 'thepick-api',
    environment: resolveLoggerEnv(env.ENVIRONMENT),
  }).child({ module: 'telemetry' });
}

interface TelemetryRow {
  readonly id: string;
  readonly exam_id: string;
  readonly gauge_name: string;
  readonly metric_value: number | null;
  readonly metric_json: string | null;
  readonly source_id: string | null;
  readonly batch_run_id: string | null;
  readonly recorded_at: string;
}

const PHASE_1_GAUGE_SET: ReadonlySet<EngineTelemetryGauge> = new Set(PHASE_1_GAUGES);
const PHASE_2_GAUGE_SET: ReadonlySet<EngineTelemetryGauge> = new Set(PHASE_2_GAUGES);

function rowToEvent(row: TelemetryRow): TelemetryEvent {
  let metricJson: Record<string, unknown> | null = null;
  if (row.metric_json !== null) {
    try {
      const parsed = JSON.parse(row.metric_json) as unknown;
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        metricJson = parsed as Record<string, unknown>;
      }
      // 비-object 값은 손상 데이터 — null 로 마스크 (UI 깨짐 방어)
    } catch {
      // 파싱 실패도 null 로 마스크. 원본은 추후 admin-web "raw view" 에서 노출 가능 (Phase 2).
    }
  }
  return {
    id: row.id,
    examId: row.exam_id as TelemetryEvent['examId'],
    gaugeName: row.gauge_name as EngineTelemetryGauge,
    metricValue: row.metric_value,
    metricJson,
    sourceId: row.source_id,
    batchRunId: row.batch_run_id,
    recordedAt: row.recorded_at,
  };
}

/**
 * 게이지 status 평가 — Phase 1 시점 단순 임계 + 추후 master-dashboard.md alarm rule 고도화.
 * 현재는 latest 부재 → no_data, latest 존재 → ok (실제 임계는 Phase 2 alarm rule 활성).
 */
function evaluateStatus(latest: TelemetryEvent | null): GaugeSnapshot['status'] {
  if (latest === null) return 'no_data';
  return 'ok';
}

function determinePhase(gauge: EngineTelemetryGauge): 1 | 2 {
  if (PHASE_1_GAUGE_SET.has(gauge)) return 1;
  if (PHASE_2_GAUGE_SET.has(gauge)) return 2;
  // 위 두 셋의 합집합이 ENGINE_TELEMETRY_GAUGES 전체 — 도달 불가능, 타입 좁히기용.
  return 1;
}

export function createTelemetryRoutes(): Hono<{ Bindings: TelemetryBindings }> {
  const router = new Hono<{ Bindings: TelemetryBindings }>();

  router.use('*', requireAdminToken<{ Bindings: TelemetryBindings }>());

  // ===== POST /api/telemetry — write =====
  router.post('/', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'write' });
    const raw: unknown = await c.req.json().catch(() => null);
    const parsed = telemetryEventPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues }, 422);
    }
    try {
      const event = await writeTelemetryEvent(parsed.data, { db: c.env.DB, logger });
      return c.json(event, 201);
    } catch (err) {
      if (err instanceof TelemetryWriteError) {
        logger.error('telemetry write failed', err, { gauge: parsed.data.gaugeName });
        c.header('Retry-After', '5');
        return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
      }
      logger.error('telemetry write unexpected error', err);
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }
  });

  /**
   * Step 19 MAJOR-A1 흡수 (Pass 1+2): GET 엔드포인트 examId optional query 도입.
   *
   * Year 1 (현): examId 부재 시 시험 격리 없이 전체 row 조회 (단일 시험이라 동일 결과).
   * Year 2 (multi-tenant): 본 함수는 그대로 두고, 호출 측이 examId 필수 의무화 — Hard Rule
   * 16 zero-cost 전환 정합. 호출 측이 examId 항상 전달하면 격리 자동 작동.
   *
   * examId 명시 시 검증 (Hard Rule 17 — EXAM_IDS allowlist 외 입력 차단).
   */
  function parseExamIdQuery(value: string | undefined): {
    examId: string | null;
    error: string | null;
  } {
    if (value === undefined || value === '') return { examId: null, error: null };
    if (!isValidExamId(value)) return { examId: null, error: `Invalid examId: ${value}` };
    return { examId: value, error: null };
  }

  // ===== GET /api/telemetry/gauges/:gaugeName — single gauge timeline =====
  router.get('/gauges/:gaugeName', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'gauge-timeline' });
    const gauge = c.req.param('gaugeName');
    if (!ENGINE_TELEMETRY_GAUGES.includes(gauge as EngineTelemetryGauge)) {
      return c.json({ error: 'UNKNOWN_GAUGE' }, 404);
    }
    const examIdParam = parseExamIdQuery(c.req.query('examId'));
    if (examIdParam.error) {
      return c.json({ error: 'VALIDATION_ERROR', message: examIdParam.error }, 422);
    }
    const limitRaw = c.req.query('limit');
    const limit = (() => {
      const n = limitRaw === undefined ? 100 : Number.parseInt(limitRaw, 10);
      if (!Number.isFinite(n) || n < 1) return 100;
      return Math.min(n, 500);
    })();

    try {
      // examId 명시 시 격리 (Year 2 정합), 부재 시 전체 (Year 1 단일 시험 통과)
      const result = examIdParam.examId
        ? await c.env.DB.prepare(
            `SELECT id, exam_id, gauge_name, metric_value, metric_json,
                    source_id, batch_run_id, recorded_at
             FROM engine_telemetry
             WHERE gauge_name = ? AND exam_id = ?
             ORDER BY recorded_at DESC
             LIMIT ?`,
          )
            .bind(gauge, examIdParam.examId, limit)
            .all<TelemetryRow>()
        : await c.env.DB.prepare(
            `SELECT id, exam_id, gauge_name, metric_value, metric_json,
                    source_id, batch_run_id, recorded_at
             FROM engine_telemetry
             WHERE gauge_name = ?
             ORDER BY recorded_at DESC
             LIMIT ?`,
          )
            .bind(gauge, limit)
            .all<TelemetryRow>();

      const events = (result.results ?? []).map(rowToEvent);
      return c.json({ gauge, events, limit });
    } catch (err) {
      logger.error('gauge timeline query failed', err, { gauge });
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }
  });

  // ===== GET /api/telemetry/dashboard — 8 gauge snapshot =====
  router.get('/dashboard', async (c) => {
    const logger = buildLogger(c.env).child({ route: 'dashboard' });
    const examIdParam = parseExamIdQuery(c.req.query('examId'));
    if (examIdParam.error) {
      return c.json({ error: 'VALIDATION_ERROR', message: examIdParam.error }, 422);
    }
    try {
      // 게이지별 latest + 24h count — Year 1 단일 시험이라 examId 부재 시 무차별. Year 2
      // multi-tenant 시점에 호출 측이 examId 항상 전달하면 격리 자동 작동 (Hard Rule 16 zero-cost).
      // round-trip = 게이지(8) × 2 = 16 sequential D1 prepared statement (Workers CPU < 50ms 가정).
      // 향후 UNION ALL 단일 쿼리 최적화 가능 (Phase 2 — MINOR 트래킹).
      const snapshots: GaugeSnapshot[] = [];
      for (const gauge of ENGINE_TELEMETRY_GAUGES) {
        const latestRow = examIdParam.examId
          ? await c.env.DB.prepare(
              `SELECT id, exam_id, gauge_name, metric_value, metric_json,
                      source_id, batch_run_id, recorded_at
               FROM engine_telemetry
               WHERE gauge_name = ? AND exam_id = ?
               ORDER BY recorded_at DESC
               LIMIT 1`,
            )
              .bind(gauge, examIdParam.examId)
              .first<TelemetryRow>()
          : await c.env.DB.prepare(
              `SELECT id, exam_id, gauge_name, metric_value, metric_json,
                      source_id, batch_run_id, recorded_at
               FROM engine_telemetry
               WHERE gauge_name = ?
               ORDER BY recorded_at DESC
               LIMIT 1`,
            )
              .bind(gauge)
              .first<TelemetryRow>();

        const countRow = examIdParam.examId
          ? await c.env.DB.prepare(
              `SELECT COUNT(*) AS count_24h
               FROM engine_telemetry
               WHERE gauge_name = ? AND exam_id = ?
                 AND recorded_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')`,
            )
              .bind(gauge, examIdParam.examId)
              .first<{ count_24h: number | null }>()
          : await c.env.DB.prepare(
              `SELECT COUNT(*) AS count_24h
               FROM engine_telemetry
               WHERE gauge_name = ?
                 AND recorded_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')`,
            )
              .bind(gauge)
              .first<{ count_24h: number | null }>();

        const latest = latestRow ? rowToEvent(latestRow) : null;
        snapshots.push({
          gauge,
          latest,
          count24h: Number(countRow?.count_24h ?? 0),
          status: evaluateStatus(latest),
          phase: determinePhase(gauge),
        });
      }

      const response: DashboardResponse = {
        gauges: snapshots,
        serverTime: new Date().toISOString(),
      };
      return c.json(response);
    } catch (err) {
      logger.error('dashboard aggregate failed', err);
      c.header('Retry-After', '5');
      return c.json({ error: 'SERVICE_UNAVAILABLE' }, 503);
    }
  });

  return router;
}
