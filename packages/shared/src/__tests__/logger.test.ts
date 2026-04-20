import { describe, it, expect } from 'vitest';
import { createLogger, serializeError, maskValue, type LogSink, type Logger } from '../logger.js';

// --- sink helper ---

interface CapturedSink extends LogSink {
  readonly logs: string[];
  readonly errors: string[];
}

function captureSink(): CapturedSink {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    logs,
    errors,
    log: (msg) => {
      logs.push(msg);
    },
    error: (msg) => {
      errors.push(msg);
    },
  };
}

function makeLogger(
  sink: LogSink,
  overrides: {
    minLevel?: 'debug' | 'info' | 'warn' | 'error';
    environment?: 'development' | 'staging' | 'production' | 'test';
  } = {},
): Logger {
  return createLogger({
    service: 'test-svc',
    environment: overrides.environment ?? 'test',
    minLevel: overrides.minLevel ?? 'debug',
    sink,
  });
}

function parseLast(sink: CapturedSink): Record<string, unknown> {
  const all = [...sink.logs, ...sink.errors];
  const line = all[all.length - 1];
  if (!line) throw new Error('No log line captured');
  return JSON.parse(line) as Record<string, unknown>;
}

// --- tests ---

describe('createLogger', () => {
  it('emits JSON with required fields', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    log.info('hello', { path: '/api/x' });
    const rec = parseLast(sink);
    expect(rec.level).toBe('info');
    expect(rec.message).toBe('hello');
    expect(rec.service).toBe('test-svc');
    expect(rec.environment).toBe('test');
    expect(rec.path).toBe('/api/x');
    expect(typeof rec.timestamp).toBe('string');
    expect(Date.parse(rec.timestamp as string)).not.toBeNaN();
  });

  it('routes debug/info to sink.log, warn/error to sink.error', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(sink.logs).toHaveLength(2);
    expect(sink.errors).toHaveLength(2);
  });

  it('respects minLevel filter', () => {
    const sink = captureSink();
    const log = makeLogger(sink, { minLevel: 'warn' });
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(sink.logs).toHaveLength(0);
    expect(sink.errors).toHaveLength(2);
  });

  it('falls back to info when invalid minLevel is injected', () => {
    const sink = captureSink();
    // 잘못된 env 주입 시뮬레이션
    const log = createLogger({
      service: 'test',
      sink,
      minLevel: 'verbose' as unknown as 'info',
    });
    log.debug('d');
    log.info('i');
    log.warn('w');
    // info 이상만 통과
    expect(sink.logs).toHaveLength(1);
    expect(sink.errors).toHaveLength(1);
  });

  it('child() accumulates context without mutating parent', () => {
    const sink = captureSink();
    const parent = makeLogger(sink);
    const child = parent.child({ requestId: 'req-1', userId: 'u-42' });

    parent.info('from parent');
    child.info('from child', { path: '/x' });

    const parentRec = JSON.parse(sink.logs[0] ?? '{}') as Record<string, unknown>;
    const childRec = JSON.parse(sink.logs[1] ?? '{}') as Record<string, unknown>;

    expect(parentRec.requestId).toBeUndefined();
    expect(parentRec.userId).toBeUndefined();

    expect(childRec.requestId).toBe('req-1');
    expect(childRec.userId).toBe('u-42');
    expect(childRec.path).toBe('/x');
  });

  it('child() of child() merges context cumulatively', () => {
    const sink = captureSink();
    const root = makeLogger(sink);
    const req = root.child({ requestId: 'r1' });
    const user = req.child({ userId: 'u1' });
    user.info('nested');

    const rec = parseLast(sink);
    expect(rec.requestId).toBe('r1');
    expect(rec.userId).toBe('u1');
  });

  it('error() serializes Error with name/message/stack', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    const err = new Error('db down');
    err.name = 'DatabaseError';
    log.error('query failed', err, { query: 'SELECT 1' });

    const rec = parseLast(sink);
    const serialized = rec.error as { name: string; message: string; stack?: string };
    expect(serialized.name).toBe('DatabaseError');
    expect(serialized.message).toBe('db down');
    expect(typeof serialized.stack).toBe('string');
    expect(rec.query).toBe('SELECT 1');
  });

  it('error() serializes non-Error throws (string, object)', () => {
    const sink = captureSink();
    const log = makeLogger(sink);

    log.error('string throw', 'oops');
    const stringRec = parseLast(sink);
    const stringSer = stringRec.error as { name: string; message: string };
    expect(stringSer.name).toBe('NonErrorThrown');
    expect(stringSer.message).toBe('oops');

    log.error('object throw', { code: 500 });
    const objRec = parseLast(sink);
    const objSer = objRec.error as { name: string; message: string };
    expect(objSer.name).toBe('NonErrorThrown');
    expect(objSer.message).toContain('500');
  });

  it('error() serializes nested Error.cause chain', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    const root = new Error('root cause');
    const wrapped = new Error('wrapper', { cause: root });
    log.error('chained', wrapped);

    const rec = parseLast(sink);
    const serialized = rec.error as { cause?: { message: string } };
    expect(serialized.cause?.message).toBe('root cause');
  });

  it('error() truncates excessive cause chain', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    // 깊이 12 체인 — 기본 MAX_CAUSE_DEPTH=8
    let chain: Error = new Error('depth-0');
    for (let i = 1; i < 12; i++) {
      chain = new Error(`depth-${i}`, { cause: chain });
    }
    log.error('deep', chain);
    const rec = parseLast(sink);
    // cause 체인을 따라 내려가면 어느 지점에서 CauseChainTruncated 가 나와야 함
    const serialized = rec.error as { cause?: unknown };
    let cur: { name?: string; cause?: unknown } = serialized;
    let found = false;
    for (let i = 0; i < 20 && cur?.cause; i++) {
      cur = cur.cause as typeof cur;
      if (cur.name === 'CauseChainTruncated') {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('redacts stack /home/<user>/ paths in production environment', () => {
    const sink = captureSink();
    const prod = makeLogger(sink, { environment: 'production' });
    const err = new Error('boom');
    err.stack = 'Error: boom\n    at /home/soo/ClaudePro/ThePick/apps/api/src/x.ts:1:1';
    prod.error('w', err);
    const rec = parseLast(sink);
    const serialized = rec.error as { stack?: string };
    expect(serialized.stack).toContain('[REDACTED_HOME]');
    expect(serialized.stack).not.toContain('/home/soo/');
  });

  it('does NOT redact stack paths in development environment', () => {
    const sink = captureSink();
    const dev = makeLogger(sink, { environment: 'development' });
    const err = new Error('boom');
    err.stack = 'Error: boom\n    at /home/soo/x.ts:1:1';
    dev.error('w', err);
    const rec = parseLast(sink);
    const serialized = rec.error as { stack?: string };
    expect(serialized.stack).toContain('/home/soo/');
  });

  it('masks PII keys in context (case-insensitive)', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    log.info('secret field', {
      password: 'hunter2',
      Password: 'hunter3',
      TOKEN: 'jwt-abc',
      businessRegistrationNumber: '123-45-67890',
      cardNumber: '4111111111111111',
      jwt: 'x.y.z',
      refreshToken: 'r1',
      sessionId: 's1',
    });
    const rec = parseLast(sink);
    expect(rec.password).toBe('[MASKED]');
    expect(rec.Password).toBe('[MASKED]');
    expect(rec.TOKEN).toBe('[MASKED]');
    expect(rec.businessRegistrationNumber).toBe('[MASKED]');
    expect(rec.cardNumber).toBe('[MASKED]');
    expect(rec.jwt).toBe('[MASKED]');
    expect(rec.refreshToken).toBe('[MASKED]');
    expect(rec.sessionId).toBe('[MASKED]');
  });

  it('masks raw-dump keys (rawPayload/body/headers/queryParams/params)', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    log.info('route dump', {
      rawPayload: '{"cardNumber":"4111..."}',
      body: { password: 'x' },
      headers: { authorization: 'Bearer xyz' },
      queryParams: { token: 'q' },
      params: { userId: 'u1' },
    });
    const rec = parseLast(sink);
    expect(rec.rawPayload).toBe('[REDACTED:raw_dump]');
    expect(rec.body).toBe('[REDACTED:raw_dump]');
    expect(rec.headers).toBe('[REDACTED:raw_dump]');
    expect(rec.queryParams).toBe('[REDACTED:raw_dump]');
    expect(rec.params).toBe('[REDACTED:raw_dump]');
  });

  it('does NOT redact the "query" key (DB SQL logging compatibility)', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    log.info('db', { query: 'SELECT 1' });
    const rec = parseLast(sink);
    expect(rec.query).toBe('SELECT 1');
  });

  it('recursively masks nested PII (2-depth objects)', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    log.info('order', {
      buyer: { businessRegistrationNumber: '123-45-67890', email: 'a@b.com', name: 'Alice' },
    });
    const rec = parseLast(sink);
    const buyer = rec.buyer as Record<string, unknown>;
    expect(buyer.businessRegistrationNumber).toBe('[MASKED]');
    expect(buyer.email).toBe('a***@b.com');
    expect(buyer.name).toBe('Alice');
  });

  it('recursively masks arrays of objects', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    log.info('users', {
      users: [
        { password: 'x1', name: 'A' },
        { password: 'x2', name: 'B' },
      ],
    });
    const rec = parseLast(sink);
    const users = rec.users as Array<Record<string, unknown>>;
    expect(users[0]?.password).toBe('[MASKED]');
    expect(users[0]?.name).toBe('A');
    expect(users[1]?.password).toBe('[MASKED]');
  });

  it('masks JWT-like strings inside arbitrary string values', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    log.info('auth header note', {
      note: 'Received header: eyJhbGciOiJIUzI1NiIsInR5cCI.abcdef.xyz987',
    });
    const rec = parseLast(sink);
    expect(rec.note).toBe('Received header: [MASKED:jwt]');
  });

  it('masks email with no @ as [MASKED:email?]', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    log.info('malformed', { email: '010-1234-5678' });
    const rec = parseLast(sink);
    expect(rec.email).toBe('[MASKED:email?]');
  });

  it('guards against circular reference without crashing', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    const obj: Record<string, unknown> = { name: 'root' };
    obj.self = obj; // 순환
    log.info('cycle', { data: obj });
    // sink 에 정확히 1개 라인 기록, 크래시 없음
    expect(sink.logs).toHaveLength(1);
    const rec = parseLast(sink);
    const data = rec.data as Record<string, unknown>;
    expect(data.self).toBe('[CIRCULAR]');
    expect(data.name).toBe('root');
  });

  it('does not silent-drop log on BigInt context (emit fallback)', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    // maskValue 는 bigint → string 변환하므로 JSON.stringify 는 통과해야 함
    log.info('bigint', { id: 12345678901234567890n });
    const rec = parseLast(sink);
    expect(rec.id).toBe('12345678901234567890n');
  });

  it('applies fallback when JSON.stringify would fail after masking (defensive)', () => {
    // sink 자체가 throw하게 만들어 emit 의 fallback 트리거 검증
    const brokenSink: LogSink = {
      log() {
        throw new Error('sink broken');
      },
      error() {
        throw new Error('sink broken');
      },
    };
    const brokenLog = createLogger({ service: 'x', sink: brokenSink, minLevel: 'debug' });
    // 호출 자체는 throw 하지 않아야 (emit 이 catch 로 최종 방어)
    expect(() => brokenLog.info('m')).not.toThrow();
  });

  it('preserves non-PII fields untouched', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    log.info('normal', { userId: 'u-42', count: 3, active: true });
    const rec = parseLast(sink);
    expect(rec.userId).toBe('u-42');
    expect(rec.count).toBe(3);
    expect(rec.active).toBe(true);
  });

  it('defaults environment to "development" when omitted', () => {
    const sink = captureSink();
    const log = createLogger({ service: 'x', sink, minLevel: 'debug' });
    log.info('m');
    const rec = parseLast(sink);
    expect(rec.environment).toBe('development');
  });

  it('emits exactly one JSON line per call (no multi-line)', () => {
    const sink = captureSink();
    const log = makeLogger(sink);
    log.info('single line', { note: 'line1\nline2' });
    expect(sink.logs).toHaveLength(1);
    const line = sink.logs[0] ?? '';
    expect(line.includes('\n')).toBe(false);
  });
});

describe('serializeError', () => {
  it('handles undefined cause', () => {
    const err = new Error('x');
    const s = serializeError(err);
    expect(s.cause).toBeUndefined();
  });

  it('wraps non-Error primitives to NonErrorThrown', () => {
    expect(serializeError(42).name).toBe('NonErrorThrown');
    expect(serializeError(42).message).toBe('42');
    expect(serializeError(null).message).toBe('null');
  });

  it('wraps non-Error objects via JSON.stringify', () => {
    const s = serializeError({ code: 500 });
    expect(s.name).toBe('NonErrorThrown');
    expect(s.message).toContain('500');
  });

  it('falls back to String() for circular non-Error object', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    const s = serializeError(obj);
    expect(s.name).toBe('NonErrorThrown');
    expect(typeof s.message).toBe('string');
  });
});

describe('maskValue', () => {
  it('returns null/undefined untouched', () => {
    expect(maskValue('password', null)).toBeNull();
    expect(maskValue('password', undefined)).toBeUndefined();
  });

  it('masks single-char email local part safely', () => {
    expect(maskValue('email', 'a@b.com')).toBe('a***@b.com');
  });

  it('handles non-string email values (malformed context) by recursing', () => {
    const result = maskValue('email', { nested: true });
    // email 이라는 key 에 객체가 오면 재귀 → {nested: true} (nested 는 PII 아니므로 유지)
    expect((result as Record<string, unknown>).nested).toBe(true);
  });

  it('truncates deeply nested structures at MAX_MASK_DEPTH', () => {
    // 8-depth 중첩
    let deep: unknown = 'leaf';
    for (let i = 0; i < 10; i++) {
      deep = { next: deep };
    }
    const result = maskValue('root', deep);
    // 재귀 따라 내려가면 어느 지점에서 [TRUNCATED:depth] 를 만나야 함
    let cur: unknown = result;
    let found = false;
    for (let i = 0; i < 15; i++) {
      if (cur === '[TRUNCATED:depth]') {
        found = true;
        break;
      }
      if (cur && typeof cur === 'object' && 'next' in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>).next;
      } else {
        break;
      }
    }
    expect(found).toBe(true);
  });
});
