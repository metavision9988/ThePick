/**
 * Telemetry routes — POST/GET integration test (real SQLite + migrations 0017 적용).
 *
 * 검증:
 *   - X-Admin-Token 부재/오 → 401
 *   - Zod validation → 422
 *   - examId Hard Rule 17 위반 → 422 (refine 차단)
 *   - 8 게이지 INSERT → SELECT 라운드트립
 *   - metric_value/metric_json 둘 다 NULL → 422
 *   - GET /gauges/:gaugeName 미지 게이지 → 404
 *   - GET /dashboard 8 게이지 모두 응답 (no_data → ok 전이)
 *   - UPDATE/DELETE 시도 → 트리거 RAISE(ABORT)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { EXAM_IDS } from '@thepick/shared';
import { createTelemetryRoutes, type TelemetryBindings } from '../routes.js';
import {
  createD1FromAllMigrations,
  type SqliteBackedD1,
} from '../../__tests__/helpers/d1-from-sqlite.js';
import type { DashboardResponse, TelemetryEvent } from '../types.js';

const ADMIN_TOKEN = 'test-admin-token-32bytes-plus-secret-v1';

interface AppEnv {
  Bindings: TelemetryBindings;
}

function buildApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.route('/api/telemetry', createTelemetryRoutes());
  return app;
}

describe('Telemetry routes — Step 19 Engine Observability v1', () => {
  let backend: SqliteBackedD1;
  let app: Hono<AppEnv>;
  let env: TelemetryBindings;

  beforeEach(() => {
    backend = createD1FromAllMigrations();
    env = {
      DB: backend.db,
      ADMIN_API_TOKEN: ADMIN_TOKEN,
      ENVIRONMENT: 'test',
    };
    app = buildApp();
  });

  afterEach(() => {
    backend.close();
  });

  async function req(
    path: string,
    init: RequestInit = {},
    overrideEnv: TelemetryBindings = env,
  ): Promise<Response> {
    return await app.request(path, init, overrideEnv);
  }

  async function authedPost(
    body: unknown,
    overrideEnv: TelemetryBindings = env,
  ): Promise<Response> {
    return await req(
      '/api/telemetry',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': ADMIN_TOKEN },
        body: JSON.stringify(body),
      },
      overrideEnv,
    );
  }

  async function authedGet(path: string, overrideEnv: TelemetryBindings = env): Promise<Response> {
    return await req(path, { headers: { 'X-Admin-Token': ADMIN_TOKEN } }, overrideEnv);
  }

  // ===== admin-token 게이트 =====
  describe('admin-token 게이트', () => {
    it('X-Admin-Token 부재 → 401', async () => {
      const res = await req('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });

    it('X-Admin-Token 불일치 → 401', async () => {
      const res = await req('/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': 'wrong-token-32bytes-plus-secret-aa',
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });

    it('ADMIN_API_TOKEN 환경변수 부재 → 401 (production misconfig 방어)', async () => {
      const res = await authedGet('/api/telemetry/dashboard', {
        DB: backend.db,
        ENVIRONMENT: 'test',
      });
      expect(res.status).toBe(401);
    });

    it('ADMIN_API_TOKEN 길이 < 16 → 401 (production misconfig 방어)', async () => {
      const res = await req(
        '/api/telemetry/dashboard',
        { headers: { 'X-Admin-Token': 'short' } },
        { DB: backend.db, ADMIN_API_TOKEN: 'short', ENVIRONMENT: 'test' },
      );
      expect(res.status).toBe(401);
    });
  });

  // ===== POST validation =====
  describe('POST /api/telemetry — Zod validation', () => {
    it('빈 body → 422', async () => {
      const res = await authedPost({});
      expect(res.status).toBe(422);
    });

    it('미지 examId → 422 (Hard Rule 17 refine)', async () => {
      const res = await authedPost({
        examId: 'unknown-exam',
        gaugeName: 'cost',
        metricValue: 100,
      });
      expect(res.status).toBe(422);
    });

    it('미지 gaugeName → 422', async () => {
      const res = await authedPost({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        gaugeName: 'unknown_gauge',
        metricValue: 100,
      });
      expect(res.status).toBe(422);
    });

    it('metricValue + metricJson 둘 다 부재 → 422 (CHECK 동기 refine)', async () => {
      const res = await authedPost({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        gaugeName: 'batch_progress',
      });
      expect(res.status).toBe(422);
    });

    it('NaN metricValue → 422 (z.finite)', async () => {
      const res = await authedPost({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        gaugeName: 'cost',
        metricValue: Number.NaN,
      });
      expect(res.status).toBe(422);
    });
  });

  // ===== POST happy path =====
  describe('POST /api/telemetry — 8 게이지 INSERT 라운드트립', () => {
    const ALL_GAUGES = [
      'batch_progress',
      'cost',
      'd1_slo',
      'graph_integrity',
      'quality_gate',
      'formula_accuracy',
      'reviewer_queue',
      'learning_slo',
    ] as const;

    it.each(ALL_GAUGES)('gauge=%s INSERT 성공', async (gauge) => {
      const res = await authedPost({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        gaugeName: gauge,
        metricValue: 0.5,
        metricJson: { test: true, gauge },
        sourceId: `test-${gauge}`,
        batchRunId: `batch-${gauge}`,
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as TelemetryEvent;
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.gaugeName).toBe(gauge);
      expect(body.metricValue).toBe(0.5);
      expect(body.metricJson).toEqual({ test: true, gauge });
      expect(body.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('metricValue 만 (metricJson 부재) 허용', async () => {
      const res = await authedPost({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        gaugeName: 'cost',
        metricValue: 12345,
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as TelemetryEvent;
      expect(body.metricValue).toBe(12345);
      expect(body.metricJson).toBeNull();
    });

    it('metricJson 만 (metricValue 부재) 허용', async () => {
      const res = await authedPost({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        gaugeName: 'graph_integrity',
        metricJson: { orphan_nodes: 0, broken_edges: 0 },
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as TelemetryEvent;
      expect(body.metricValue).toBeNull();
      expect(body.metricJson).toEqual({ orphan_nodes: 0, broken_edges: 0 });
    });
  });

  // ===== GET gauges/:name =====
  describe('GET /api/telemetry/gauges/:gaugeName', () => {
    it('미지 게이지 → 404', async () => {
      const res = await authedGet('/api/telemetry/gauges/unknown_gauge');
      expect(res.status).toBe(404);
    });

    it('데이터 부재 시 빈 events 배열', async () => {
      const res = await authedGet('/api/telemetry/gauges/cost');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { events: TelemetryEvent[] };
      expect(body.events).toEqual([]);
    });

    it('limit 파라미터 적용 + 최신순 정렬', async () => {
      for (let i = 0; i < 3; i++) {
        await authedPost({
          examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
          gaugeName: 'cost',
          metricValue: i * 100,
        });
      }
      const res = await authedGet('/api/telemetry/gauges/cost?limit=2');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { events: TelemetryEvent[] };
      expect(body.events).toHaveLength(2);
    });

    it('과대 limit (>500) 자동 클램프', async () => {
      const res = await authedGet('/api/telemetry/gauges/cost?limit=99999');
      expect(res.status).toBe(200);
    });
  });

  // ===== GET /dashboard =====
  describe('GET /api/telemetry/dashboard', () => {
    it('초기 상태 8 게이지 모두 no_data', async () => {
      const res = await authedGet('/api/telemetry/dashboard');
      expect(res.status).toBe(200);
      const body = (await res.json()) as DashboardResponse;
      expect(body.gauges).toHaveLength(8);
      for (const g of body.gauges) {
        expect(g.status).toBe('no_data');
        expect(g.latest).toBeNull();
        expect(g.count24h).toBe(0);
      }
    });

    it('learning_slo phase=2 + 나머지 phase=1', async () => {
      const res = await authedGet('/api/telemetry/dashboard');
      const body = (await res.json()) as DashboardResponse;
      const learningSlo = body.gauges.find((g) => g.gauge === 'learning_slo');
      expect(learningSlo?.phase).toBe(2);
      const others = body.gauges.filter((g) => g.gauge !== 'learning_slo');
      for (const g of others) {
        expect(g.phase).toBe(1);
      }
    });

    it('INSERT 후 latest + count24h 갱신', async () => {
      await authedPost({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        gaugeName: 'cost',
        metricValue: 7777,
      });
      const res = await authedGet('/api/telemetry/dashboard');
      const body = (await res.json()) as DashboardResponse;
      const cost = body.gauges.find((g) => g.gauge === 'cost');
      expect(cost?.status).toBe('ok');
      expect(cost?.latest?.metricValue).toBe(7777);
      expect(cost?.count24h).toBe(1);
    });
  });

  // ===== append-only 트리거 검증 =====
  describe('engine_telemetry append-only 트리거 (defense-in-depth)', () => {
    it('UPDATE 시도 → RAISE(ABORT)', async () => {
      const insertRes = await authedPost({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        gaugeName: 'cost',
        metricValue: 100,
      });
      expect(insertRes.status).toBe(201);
      const event = (await insertRes.json()) as TelemetryEvent;

      expect(() => {
        backend.raw
          .prepare('UPDATE engine_telemetry SET metric_value = 999 WHERE id = ?')
          .run(event.id);
      }).toThrow(/UPDATE on engine_telemetry is forbidden \(append-only fact table\)\. Use INSERT/);
    });

    it('DELETE 시도 → RAISE(ABORT)', async () => {
      const insertRes = await authedPost({
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        gaugeName: 'cost',
        metricValue: 100,
      });
      const event = (await insertRes.json()) as TelemetryEvent;

      expect(() => {
        backend.raw.prepare('DELETE FROM engine_telemetry WHERE id = ?').run(event.id);
      }).toThrow(
        /DELETE on engine_telemetry is forbidden \(append-only fact table\)\. Phase 2 GC plan/,
      );
    });
  });

  // ===== Phase B (handoff-028) — login / logout / cookie 경로 =====
  describe('Phase B — admin_session HttpOnly cookie (v1.1 §10.7 #9 흡수)', () => {
    function parseSetCookie(res: Response): Map<string, string> {
      const result = new Map<string, string>();
      const header = res.headers.get('Set-Cookie');
      if (!header) return result;
      for (const segment of header.split(';')) {
        const trimmed = segment.trim();
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx <= 0) {
          result.set(trimmed, '');
        } else {
          result.set(trimmed.slice(0, eqIdx), trimmed.slice(eqIdx + 1));
        }
      }
      return result;
    }

    describe('POST /login', () => {
      it('정확한 토큰 → 200 + Set-Cookie admin_session (HttpOnly + SameSite=Strict)', async () => {
        const res = await req('/api/telemetry/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: ADMIN_TOKEN }),
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; expiresInSeconds: number };
        expect(body.ok).toBe(true);
        expect(body.expiresInSeconds).toBe(86400);

        const cookieAttrs = parseSetCookie(res);
        expect(cookieAttrs.get('admin_session')).toBe(ADMIN_TOKEN);
        expect(cookieAttrs.has('HttpOnly')).toBe(true);
        expect(cookieAttrs.get('SameSite')).toBe('Strict');
        expect(cookieAttrs.get('Path')).toBe('/');
        expect(cookieAttrs.get('Max-Age')).toBe('86400');
        // ENVIRONMENT='test' → Secure 미부착
        expect(cookieAttrs.has('Secure')).toBe(false);
      });

      it('production ENVIRONMENT → Set-Cookie 에 Secure 추가', async () => {
        const res = await req(
          '/api/telemetry/login',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: ADMIN_TOKEN }),
          },
          { DB: backend.db, ADMIN_API_TOKEN: ADMIN_TOKEN, ENVIRONMENT: 'production' },
        );
        expect(res.status).toBe(200);
        const cookieAttrs = parseSetCookie(res);
        expect(cookieAttrs.has('Secure')).toBe(true);
      });

      it('staging ENVIRONMENT → Set-Cookie 에 Secure 추가', async () => {
        const res = await req(
          '/api/telemetry/login',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: ADMIN_TOKEN }),
          },
          { DB: backend.db, ADMIN_API_TOKEN: ADMIN_TOKEN, ENVIRONMENT: 'staging' },
        );
        expect(res.status).toBe(200);
        expect(parseSetCookie(res).has('Secure')).toBe(true);
      });

      it('잘못된 토큰 → 401 + Set-Cookie 미발급', async () => {
        const res = await req('/api/telemetry/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'wrong-token-32bytes-plus-secret-aa' }),
        });
        expect(res.status).toBe(401);
        expect(res.headers.get('Set-Cookie')).toBeNull();
      });

      it('길이 mismatch 토큰 → 401 (timing-safe 정합 — information leak 마스크)', async () => {
        const res = await req('/api/telemetry/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'short' }),
        });
        expect(res.status).toBe(401);
      });

      it('body 부재 → 401', async () => {
        const res = await req('/api/telemetry/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-json',
        });
        expect(res.status).toBe(401);
      });

      it('token 필드 부재 → 401', async () => {
        const res = await req('/api/telemetry/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        expect(res.status).toBe(401);
      });

      it('ADMIN_API_TOKEN 환경변수 부재 → 401 (production misconfig 방어)', async () => {
        const res = await req(
          '/api/telemetry/login',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: ADMIN_TOKEN }),
          },
          { DB: backend.db, ENVIRONMENT: 'test' },
        );
        expect(res.status).toBe(401);
      });
    });

    describe('POST /logout', () => {
      it('Set-Cookie admin_session= Max-Age=0 (idempotent — 인증 미요구)', async () => {
        const res = await req('/api/telemetry/logout', { method: 'POST' });
        expect(res.status).toBe(200);
        const cookieAttrs = parseSetCookie(res);
        expect(cookieAttrs.get('admin_session')).toBe('');
        expect(cookieAttrs.get('Max-Age')).toBe('0');
        expect(cookieAttrs.has('HttpOnly')).toBe(true);
        expect(cookieAttrs.get('SameSite')).toBe('Strict');
      });

      it('production ENVIRONMENT → logout 도 Secure 부착', async () => {
        const res = await req(
          '/api/telemetry/logout',
          { method: 'POST' },
          { DB: backend.db, ADMIN_API_TOKEN: ADMIN_TOKEN, ENVIRONMENT: 'production' },
        );
        expect(parseSetCookie(res).has('Secure')).toBe(true);
      });
    });

    describe('미들웨어 cookie 인증 경로', () => {
      it('Cookie admin_session 정확 → 200 (X-Admin-Token 헤더 없이 접근 성공)', async () => {
        const res = await req('/api/telemetry/dashboard', {
          headers: { Cookie: `admin_session=${ADMIN_TOKEN}` },
        });
        expect(res.status).toBe(200);
      });

      it('Cookie admin_session 오 → 401', async () => {
        const res = await req('/api/telemetry/dashboard', {
          headers: { Cookie: `admin_session=wrong-token-32bytes-plus-secret-aa` },
        });
        expect(res.status).toBe(401);
      });

      it('Cookie 우선 — Cookie OK + Header 오 → 200 (cookie 채택)', async () => {
        const res = await req('/api/telemetry/dashboard', {
          headers: {
            Cookie: `admin_session=${ADMIN_TOKEN}`,
            'X-Admin-Token': 'wrong-token-32bytes-plus-secret-aa',
          },
        });
        expect(res.status).toBe(200);
      });

      it('Header fallback — Cookie 부재 + Header OK → 200', async () => {
        const res = await req('/api/telemetry/dashboard', {
          headers: { 'X-Admin-Token': ADMIN_TOKEN },
        });
        expect(res.status).toBe(200);
      });

      it('Cookie 부재 + Header 부재 → 401', async () => {
        const res = await req('/api/telemetry/dashboard');
        expect(res.status).toBe(401);
      });

      it('login 후 발급된 cookie 로 dashboard 접근 성공 (e2e)', async () => {
        const loginRes = await req('/api/telemetry/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: ADMIN_TOKEN }),
        });
        expect(loginRes.status).toBe(200);
        const setCookieHeader = loginRes.headers.get('Set-Cookie') ?? '';
        const cookieValue = setCookieHeader.split(';')[0]; // "admin_session=<token>"

        const dashRes = await req('/api/telemetry/dashboard', {
          headers: { Cookie: cookieValue },
        });
        expect(dashRes.status).toBe(200);
      });

      it('빈 Cookie 값 → header fallback 시도', async () => {
        const res = await req('/api/telemetry/dashboard', {
          headers: { Cookie: 'admin_session=', 'X-Admin-Token': ADMIN_TOKEN },
        });
        expect(res.status).toBe(200);
      });

      it('multi-cookie 헤더에서 admin_session 추출 성공', async () => {
        const res = await req('/api/telemetry/dashboard', {
          headers: { Cookie: `other=foo; admin_session=${ADMIN_TOKEN}; another=bar` },
        });
        expect(res.status).toBe(200);
      });
    });
  });
});
