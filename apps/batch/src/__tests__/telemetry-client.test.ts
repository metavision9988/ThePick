/**
 * Telemetry Client 단위 테스트 — Step 037 CRITICAL-DO-S1-1.
 *
 * 검증 범위:
 *   1. NoopTelemetryClient — emit/flush 안전 (production fallback)
 *   2. createTelemetryClientFromEnv — ENV 미설정 시 noop + warn
 *   3. HttpTelemetryClient — POST /api/telemetry payload + 헤더 정합
 *   4. retry 정책 — 503 / network error 만 retry, 4xx 즉시 fail
 *   5. timeout — AbortController 5s 후 retry
 *   6. flushPending — in-flight Promise 완료 대기
 *   7. metricValue/metricJson 둘 다 부재 시 reject (refine 정합)
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { EXAM_IDS, createLogger, type Logger } from '@thepick/shared';
import {
  createTelemetryClient,
  createTelemetryClientFromEnv,
  createNoopTelemetryClient,
  TELEMETRY_GAUGES,
  type TelemetryClient,
} from '../adapters/telemetry-client.js';

// 테스트용 silent logger (실제 출력 없음)
function createTestLogger(): Logger & { errorCalls: unknown[][]; warnCalls: unknown[][] } {
  const errorCalls: unknown[][] = [];
  const warnCalls: unknown[][] = [];
  const base = createLogger({ service: 'test', environment: 'test' });
  return {
    ...base,
    error: (msg: string, err?: unknown, ctx?: Record<string, unknown>) => {
      errorCalls.push([msg, err, ctx]);
    },
    warn: (msg: string, ctx?: Record<string, unknown>) => {
      warnCalls.push([msg, ctx]);
    },
    info: () => {},
    debug: () => {},
    child: () => createTestLogger(),
    errorCalls,
    warnCalls,
  } as Logger & { errorCalls: unknown[][]; warnCalls: unknown[][] };
}

describe('TelemetryClient — TELEMETRY_GAUGES enum 정합', () => {
  it('apps/api ENGINE_TELEMETRY_GAUGES 와 1:1 매칭 (8 게이지)', () => {
    expect(TELEMETRY_GAUGES).toEqual([
      'batch_progress',
      'cost',
      'd1_slo',
      'graph_integrity',
      'quality_gate',
      'formula_accuracy',
      'reviewer_queue',
      'learning_slo',
    ]);
  });
});

describe('NoopTelemetryClient', () => {
  it('emit() 호출 시 throw 없음 + 부작용 없음', () => {
    const client = createNoopTelemetryClient();
    expect(() =>
      client.emit({
        gaugeName: 'cost',
        metricValue: 1.23,
      }),
    ).not.toThrow();
  });

  it('flushPending() 즉시 resolve', async () => {
    const client = createNoopTelemetryClient();
    await expect(client.flushPending()).resolves.toBeUndefined();
  });
});

describe('createTelemetryClientFromEnv — ENV 미설정 시 NoopTelemetryClient', () => {
  let originalApiBase: string | undefined;
  let originalToken: string | undefined;

  beforeEach(() => {
    originalApiBase = process.env.THEPICK_TELEMETRY_API_BASE;
    originalToken = process.env.THEPICK_TELEMETRY_ADMIN_TOKEN;
    delete process.env.THEPICK_TELEMETRY_API_BASE;
    delete process.env.THEPICK_TELEMETRY_ADMIN_TOKEN;
  });

  afterEach(() => {
    if (originalApiBase !== undefined) process.env.THEPICK_TELEMETRY_API_BASE = originalApiBase;
    else delete process.env.THEPICK_TELEMETRY_API_BASE;
    if (originalToken !== undefined) process.env.THEPICK_TELEMETRY_ADMIN_TOKEN = originalToken;
    else delete process.env.THEPICK_TELEMETRY_ADMIN_TOKEN;
  });

  it('두 ENV 모두 부재 시 warn 1회 + emit 안전', async () => {
    const logger = createTestLogger();
    const client = createTelemetryClientFromEnv({
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      batchRunId: 'test-run-id',
      logger,
    });
    expect(logger.warnCalls.length).toBe(1);
    expect(logger.warnCalls[0][0]).toContain('telemetry disabled');
    client.emit({ gaugeName: 'cost', metricValue: 1 });
    await expect(client.flushPending()).resolves.toBeUndefined();
  });

  it('apiBase 만 있고 token 부재 시 noop', () => {
    process.env.THEPICK_TELEMETRY_API_BASE = 'http://localhost:8787';
    const logger = createTestLogger();
    createTelemetryClientFromEnv({
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      batchRunId: 'test-run-id',
      logger,
    });
    expect(logger.warnCalls.length).toBe(1);
  });
});

describe('HttpTelemetryClient — POST payload + 헤더 정합', () => {
  it('emit() → POST /api/telemetry, X-Admin-Token 헤더 + JSON body', async () => {
    const fetchCalls: { url: string; init: RequestInit }[] = [];
    const fakeFetch: typeof fetch = async (input, init = {}) => {
      fetchCalls.push({ url: String(input), init });
      return new Response(null, { status: 201 });
    };
    const logger = createTestLogger();
    const client: TelemetryClient = createTelemetryClient({
      apiBase: 'http://localhost:8787/',
      adminToken: 'test-token',
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      batchRunId: 'run-1',
      logger,
      fetchImpl: fakeFetch,
    });
    client.emit({
      gaugeName: 'batch_progress',
      metricValue: 50,
      metricJson: { stage: 'pdf_extract' },
      sourceId: 'pipeline:pdf_extract',
    });
    await client.flushPending();

    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toBe('http://localhost:8787/api/telemetry'); // trailing slash 제거
    expect(fetchCalls[0].init.method).toBe('POST');
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Admin-Token']).toBe('test-token');
    const body = JSON.parse(fetchCalls[0].init.body as string);
    expect(body).toMatchObject({
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      gaugeName: 'batch_progress',
      metricValue: 50,
      metricJson: { stage: 'pdf_extract' },
      sourceId: 'pipeline:pdf_extract',
      batchRunId: 'run-1',
    });
    expect(logger.errorCalls.length).toBe(0);
  });

  it('metricValue/metricJson 둘 다 부재 시 fetch 미호출 + error 1회', async () => {
    const fetchCalls: { url: string }[] = [];
    const fakeFetch: typeof fetch = async (input) => {
      fetchCalls.push({ url: String(input) });
      return new Response(null, { status: 201 });
    };
    const logger = createTestLogger();
    const client = createTelemetryClient({
      apiBase: 'http://localhost:8787',
      adminToken: 'test',
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      batchRunId: 'run-1',
      logger,
      fetchImpl: fakeFetch,
    });
    client.emit({ gaugeName: 'cost' });
    await client.flushPending();
    expect(fetchCalls.length).toBe(0);
    expect(logger.errorCalls.length).toBe(1);
    expect(logger.errorCalls[0][0]).toContain('refine 위반');
  });
});

describe('HttpTelemetryClient — retry 정책', () => {
  it('4xx 응답 시 retry 미수행 + error 1회', async () => {
    let callCount = 0;
    const fakeFetch: typeof fetch = async () => {
      callCount++;
      return new Response(JSON.stringify({ error: 'VALIDATION_ERROR' }), {
        status: 422,
        statusText: 'Unprocessable Entity',
      });
    };
    const logger = createTestLogger();
    const client = createTelemetryClient({
      apiBase: 'http://localhost:8787',
      adminToken: 'test',
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      batchRunId: 'run-1',
      logger,
      fetchImpl: fakeFetch,
      sleepImpl: () => Promise.resolve(),
    });
    client.emit({ gaugeName: 'cost', metricValue: 1 });
    await client.flushPending();
    expect(callCount).toBe(1); // 4xx 즉시 fail (retry 안 함)
    expect(logger.errorCalls.length).toBe(1);
    expect(logger.errorCalls[0][0]).toContain('telemetry emit failed');
  });

  it('503 응답 시 maxAttempts 회 retry 후 error 1회', async () => {
    let callCount = 0;
    const fakeFetch: typeof fetch = async () => {
      callCount++;
      return new Response(null, { status: 503, statusText: 'Service Unavailable' });
    };
    const logger = createTestLogger();
    const client = createTelemetryClient({
      apiBase: 'http://localhost:8787',
      adminToken: 'test',
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      batchRunId: 'run-1',
      logger,
      maxAttempts: 3,
      fetchImpl: fakeFetch,
      sleepImpl: () => Promise.resolve(),
    });
    client.emit({ gaugeName: 'cost', metricValue: 1 });
    await client.flushPending();
    expect(callCount).toBe(3); // 1 + 2 retry
    expect(logger.errorCalls.length).toBe(1);
  });

  it('첫 시도 503 → 두 번째 시도 201 시 retry 성공 + error 0건', async () => {
    let callCount = 0;
    const fakeFetch: typeof fetch = async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(null, { status: 503 });
      }
      return new Response(null, { status: 201 });
    };
    const logger = createTestLogger();
    const client = createTelemetryClient({
      apiBase: 'http://localhost:8787',
      adminToken: 'test',
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      batchRunId: 'run-1',
      logger,
      maxAttempts: 2,
      fetchImpl: fakeFetch,
      sleepImpl: () => Promise.resolve(),
    });
    client.emit({ gaugeName: 'cost', metricValue: 1 });
    await client.flushPending();
    expect(callCount).toBe(2);
    expect(logger.errorCalls.length).toBe(0);
  });

  it('네트워크 throw 시 retry + 모두 실패 시 error 1회 (BATCH non-fatal)', async () => {
    let callCount = 0;
    const fakeFetch: typeof fetch = async () => {
      callCount++;
      throw new Error('network unreachable');
    };
    const logger = createTestLogger();
    const client = createTelemetryClient({
      apiBase: 'http://localhost:8787',
      adminToken: 'test',
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      batchRunId: 'run-1',
      logger,
      maxAttempts: 2,
      fetchImpl: fakeFetch,
      sleepImpl: () => Promise.resolve(),
    });
    client.emit({ gaugeName: 'cost', metricValue: 1 });
    await client.flushPending();
    expect(callCount).toBe(2);
    expect(logger.errorCalls.length).toBe(1);
  });
});

describe('HttpTelemetryClient — flushPending', () => {
  it('여러 emit 동시 발사 후 flushPending 모두 대기', async () => {
    const completed: string[] = [];
    const fakeFetch: typeof fetch = async (_input, init) => {
      const body = JSON.parse((init?.body as string) ?? '{}') as { gaugeName: string };
      // 의도적으로 약간 지연
      await new Promise((resolve) => setTimeout(resolve, 5));
      completed.push(body.gaugeName);
      return new Response(null, { status: 201 });
    };
    const logger = createTestLogger();
    const client = createTelemetryClient({
      apiBase: 'http://localhost:8787',
      adminToken: 'test',
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      batchRunId: 'run-1',
      logger,
      fetchImpl: fakeFetch,
    });
    client.emit({ gaugeName: 'cost', metricValue: 1 });
    client.emit({ gaugeName: 'batch_progress', metricValue: 50 });
    client.emit({ gaugeName: 'd1_slo', metricValue: 100 });
    expect(completed.length).toBe(0); // flushPending 전에는 미완료
    await client.flushPending();
    expect(completed.sort()).toEqual(['batch_progress', 'cost', 'd1_slo']);
  });

  it('flushPending 호출 시점에 in-flight 0건이면 즉시 resolve', async () => {
    const logger = createTestLogger();
    const client = createTelemetryClient({
      apiBase: 'http://localhost:8787',
      adminToken: 'test',
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      batchRunId: 'run-1',
      logger,
      fetchImpl: async () => new Response(null, { status: 201 }),
    });
    await expect(client.flushPending()).resolves.toBeUndefined();
  });
});

describe('HttpTelemetryClient — 0 가드 (constructor)', () => {
  it('timeoutMs=0 → throw', () => {
    const logger = createTestLogger();
    expect(() =>
      createTelemetryClient({
        apiBase: 'http://localhost:8787',
        adminToken: 'test',
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        batchRunId: 'r',
        logger,
        timeoutMs: 0,
      }),
    ).toThrow(/timeoutMs must be > 0/);
  });

  it('maxAttempts=0 → throw', () => {
    const logger = createTestLogger();
    expect(() =>
      createTelemetryClient({
        apiBase: 'http://localhost:8787',
        adminToken: 'test',
        examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
        batchRunId: 'r',
        logger,
        maxAttempts: 0,
      }),
    ).toThrow(/maxAttempts must be >= 1/);
  });
});

describe('HttpTelemetryClient — timeout (AbortController)', () => {
  it('timeout 도달 시 AbortError → retry 후 fail (BATCH non-fatal)', async () => {
    let callCount = 0;
    const fakeFetch: typeof fetch = async (_input, init) => {
      callCount++;
      // signal abort 시 즉시 throw
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        const onAbort = () => reject(new Error('AbortError'));
        if (signal?.aborted) onAbort();
        else signal?.addEventListener('abort', onAbort);
        // 절대 resolve 안함 — abort 만 기다림
      });
    };
    const logger = createTestLogger();
    const client = createTelemetryClient({
      apiBase: 'http://localhost:8787',
      adminToken: 'test',
      examId: EXAM_IDS.SON_HAE_PYEONG_GA_SA,
      batchRunId: 'run-1',
      logger,
      timeoutMs: 50,
      maxAttempts: 2,
      fetchImpl: fakeFetch,
      sleepImpl: () => Promise.resolve(),
    });
    client.emit({ gaugeName: 'cost', metricValue: 1 });
    await client.flushPending();
    expect(callCount).toBe(2); // timeout → retry
    expect(logger.errorCalls.length).toBe(1);
  });
});
