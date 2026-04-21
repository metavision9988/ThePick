/**
 * @thepick/shared/logger — Cloudflare Workers Observability 최적화 구조화 로거.
 *
 * 설계 원칙 (ADR-006 Cloudflare 단일 벤더):
 *   - JSON 한 줄 출력 → Workers Observability Dashboard 자동 필드 파싱·검색
 *   - Error 객체 안전 직렬화 (name/message/stack + cause 체인, 깊이 제한)
 *   - child() 로 요청별 컨텍스트 누적 (requestId, userId 등)
 *   - PII 마스킹: 재귀 + 깊이 제한 + 배열 순회 + 순환 참조 가드
 *   - emit() 전역 try-catch + fallback (silent drop 금지 — CLAUDE.md Hard Rule #3)
 *   - production 에서 stack trace 의 사용자 홈 경로 redact (경로 누출 방지)
 *   - Workers / Node / Vitest 모두 호환 (console API 만 사용)
 *
 * 사용 예:
 *   const log = createLogger({ service: 'thepick-api', environment: 'production' });
 *   log.info('incoming request', { path: '/api/users', method: 'GET' });
 *   const reqLog = log.child({ requestId: 'abc-123', userId: 'u_42' });
 *   reqLog.error('db query failed', err, { query: 'SELECT ...' });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Workers Observability 자동 인덱싱 대상 구조화 컨텍스트. */
export interface LogContext {
  readonly requestId?: string;
  readonly userId?: string;
  readonly path?: string;
  readonly method?: string;
  readonly [key: string]: unknown;
}

export interface SerializedError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly cause?: SerializedError;
}

// --- PII/민감정보 마스킹 정책 ---

/**
 * 값 전체를 [MASKED] 로 치환할 키 (대소문자 무시).
 * 근거: ADR-002 BuyerInfo 주석 + PIPA §23 민감정보 + OWASP Logging Cheat Sheet
 */
const PII_KEY_NAMES: readonly string[] = [
  // 인증/토큰
  'password',
  'pwd',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'authheader',
  'authtoken',
  'bearertoken',
  'jwt',
  'refreshtoken',
  'accesstoken',
  'sessionid',
  'csrftoken',
  'privatekey',
  'encryptionkey',
  'clientsecret',
  'cookie',
  // 결제 (PCI-DSS)
  'cardnumber',
  'pan',
  'cvc',
  'cvv',
  'cardholdername',
  // 한국 개인식별
  'businessregistrationnumber',
  'bizregnumber',
  'ssn',
  'rrn',
  'residentnumber',
  'personalid',
  'passport',
  'driverlicense',
  'nationalid',
];

/**
 * 전체 값이 JSON 블롭이거나 민감 덤프가 확정적인 키.
 * 값 전체를 [REDACTED:raw_dump] 로 치환. Observability 에는 메타만 남김.
 * Phase 1 Step 1-2 "모든 라우트에 구조화 로깅 적용" 시 Hono context 덤프 방어.
 *
 * 주의: `query` 는 제외 (DB SQL 쿼리 로깅과 충돌). 웹 요청 query string 을
 * 덤프할 때는 `queryParams` 또는 `searchParams` 키를 사용할 것.
 */
const RAW_DUMP_KEY_NAMES: readonly string[] = [
  'rawpayload',
  'payload',
  'body',
  'headers',
  'params',
  'raw',
  'formdata',
  'queryparams',
  'searchparams',
];

const PII_KEYS: ReadonlySet<string> = new Set(PII_KEY_NAMES);
const RAW_DUMP_KEYS: ReadonlySet<string> = new Set(RAW_DUMP_KEY_NAMES);

const EMAIL_PATTERN = /^([^@]{1,2})[^@]*(@.*)$/;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

// stack trace 경로 redact (production 에서만 활성)
const HOME_PATH_PATTERNS: readonly RegExp[] = [
  /\/home\/[^/\s]+\//g,
  /\/Users\/[^/\s]+\//g,
  /[A-Z]:\\Users\\[^\\]+\\/g,
];

const MAX_MASK_DEPTH = 6;
const MAX_CAUSE_DEPTH = 8;

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

function redactHomePaths(stack: string): string {
  let out = stack;
  for (const pat of HOME_PATH_PATTERNS) {
    out = out.replace(pat, '[REDACTED_HOME]/');
  }
  return out;
}

export interface SerializeErrorOptions {
  readonly redactStackPaths?: boolean;
  readonly maxCauseDepth?: number;
}

export function serializeError(err: unknown, opts: SerializeErrorOptions = {}): SerializedError {
  return serializeErrorInner(err, opts, 0);
}

function serializeErrorInner(
  err: unknown,
  opts: SerializeErrorOptions,
  depth: number,
): SerializedError {
  const maxDepth = opts.maxCauseDepth ?? MAX_CAUSE_DEPTH;
  if (depth >= maxDepth) {
    return { name: 'CauseChainTruncated', message: `cause chain exceeded ${maxDepth}` };
  }
  if (err instanceof Error) {
    const stack = err.stack;
    return {
      name: err.name,
      message: err.message,
      stack: stack !== undefined && opts.redactStackPaths ? redactHomePaths(stack) : stack,
      cause: err.cause !== undefined ? serializeErrorInner(err.cause, opts, depth + 1) : undefined,
    };
  }
  // non-Error: 객체면 JSON 시도 (순환 참조/BigInt/Symbol 등 실패 시 String fallback)
  if (err !== null && typeof err === 'object') {
    try {
      return { name: 'NonErrorThrown', message: JSON.stringify(err) };
    } catch {
      return { name: 'NonErrorThrown', message: String(err) };
    }
  }
  return { name: 'NonErrorThrown', message: String(err) };
}

/**
 * 단일 키·값 쌍 마스킹. 재귀 + 깊이 제한 + 순환 참조 가드.
 * - 키 정규화(소문자) 후 PII_KEYS/RAW_DUMP_KEYS 매칭
 * - email 키 + @포함 문자열 → 앞 2글자만 남김. @없으면 [MASKED:email?]
 * - 문자열 값 안에 JWT 패턴 감지 시 토큰만 [MASKED:jwt]
 * - 객체/배열은 깊이 제한까지 재귀
 */
export function maskValue(key: string, value: unknown, depth = 0, seen?: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  const lowerKey = normalizeKey(key);

  if (PII_KEYS.has(lowerKey)) return '[MASKED]';
  if (RAW_DUMP_KEYS.has(lowerKey)) return '[REDACTED:raw_dump]';

  if (typeof value === 'string') {
    if (lowerKey === 'email') {
      if (!value.includes('@')) return '[MASKED:email?]';
      return value.replace(EMAIL_PATTERN, '$1***$2');
    }
    // 값 안에 JWT 감지 → 토큰 부분만 마스킹
    if (JWT_PATTERN.test(value)) {
      JWT_PATTERN.lastIndex = 0; // global regex reset
      return value.replace(JWT_PATTERN, '[MASKED:jwt]');
    }
    return value;
  }

  if (typeof value === 'bigint') return `${value.toString()}n`; // JSON 호환 + 정보 유지
  if (typeof value === 'function' || typeof value === 'symbol') {
    return `[${typeof value}]`;
  }

  if (typeof value === 'object') {
    // 순환 참조 가드
    const tracker = seen ?? new WeakSet<object>();
    if (tracker.has(value as object)) return '[CIRCULAR]';
    if (depth >= MAX_MASK_DEPTH) return '[TRUNCATED:depth]';
    tracker.add(value as object);

    if (Array.isArray(value)) {
      return value.map((v, i) => maskValue(`${lowerKey}[${i}]`, v, depth + 1, tracker));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = maskValue(k, v, depth + 1, tracker);
    }
    return out;
  }

  return value;
}

function maskContext(ctx: LogContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const seen = new WeakSet<object>();
  for (const [k, v] of Object.entries(ctx)) {
    out[k] = maskValue(k, v, 0, seen);
  }
  return out;
}

// --- Logger 계약 ---

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  /** error 는 Error 객체를 두 번째 인자로 받아 자동 직렬화. */
  error(message: string, err?: unknown, context?: LogContext): void;
  /** 컨텍스트를 누적한 새 logger 반환 (원본 유지). */
  child(context: LogContext): Logger;
}

export type LoggerEnvironment = 'development' | 'staging' | 'production' | 'test';

/** 테스트·어댑터용 sink 인터페이스. 기본 구현은 console.* 사용. */
export interface LogSink {
  log(message: string): void;
  error(message: string): void;
}

export interface LoggerConfig {
  readonly service: string;
  readonly environment?: LoggerEnvironment;
  readonly minLevel?: LogLevel;
  readonly sink?: LogSink;
}

class JsonLogger implements Logger {
  private readonly config: LoggerConfig;
  private readonly baseContext: LogContext;
  private readonly minRank: number;
  private readonly redactStackPaths: boolean;

  constructor(config: LoggerConfig, baseContext: LogContext = {}) {
    this.config = config;
    this.baseContext = baseContext;

    // minLevel 런타임 방어: 잘못된 값 주입 시 silent drop 대신 info 폴백
    const requested = config.minLevel;
    const validLevel: LogLevel =
      requested !== undefined && requested in LEVEL_RANK ? requested : 'info';
    this.minRank = LEVEL_RANK[validLevel];

    // production 환경에서만 stack 경로 redaction (개발 디버깅 편의성 보존)
    this.redactStackPaths = (config.environment ?? 'development') === 'production';
  }

  private emit(level: LogLevel, message: string, extra: LogContext, err?: unknown): void {
    if (LEVEL_RANK[level] < this.minRank) return;

    const sink: LogSink = this.config.sink ?? defaultSink;
    const writeLine = (line: string): void => {
      if (level === 'error' || level === 'warn') {
        sink.error(line);
      } else {
        sink.log(line);
      }
    };

    // emit 은 절대 throw 하지 않는다 (로깅 실패가 호출자를 죽이면 안 됨).
    // 3단계 방어: (1) 정상 직렬화, (2) 최소 필드 fallback, (3) 원시 console 최후 폴백.
    try {
      const merged: LogContext = { ...this.baseContext, ...extra };
      const maskedCtx = maskContext(merged);

      const record: Record<string, unknown> = {
        level,
        message,
        service: this.config.service,
        environment: this.config.environment ?? 'development',
        timestamp: new Date().toISOString(),
        ...maskedCtx,
      };
      if (err !== undefined) {
        record.error = serializeError(err, { redactStackPaths: this.redactStackPaths });
      }
      writeLine(JSON.stringify(record));
      return;
    } catch (serErr) {
      // 1차 실패 (직렬화 or sink) → 최소 필드 fallback 시도
      try {
        const fallback = JSON.stringify({
          level,
          message,
          service: this.config.service,
          environment: this.config.environment ?? 'development',
          timestamp: new Date().toISOString(),
          _serializationError: serErr instanceof Error ? serErr.message : String(serErr),
        });
        writeLine(fallback);
        return;
      } catch {
        // 2차도 실패 — sink 자체가 무너진 상황
      }
    }

    // 최종 방어선: sink 우회, 원시 console 로만 기록. 그것도 실패하면 완전 swallow.
    // 로그 손실은 최악이지만, 애플리케이션 중단보다는 낫다 (Hard Rule #3 예외적 수용).
    try {
      const lastResort = `{"level":"${level}","message":"LOG_EMIT_FAILED","service":"${this.config.service}"}`;
      // eslint-disable-next-line no-console
      console.error(lastResort);
    } catch {
      // 완전 swallow. 이 지점에 오면 런타임 환경 자체가 망가진 상태.
    }
  }

  debug(message: string, context: LogContext = {}): void {
    this.emit('debug', message, context);
  }
  info(message: string, context: LogContext = {}): void {
    this.emit('info', message, context);
  }
  warn(message: string, context: LogContext = {}): void {
    this.emit('warn', message, context);
  }
  error(message: string, err?: unknown, context: LogContext = {}): void {
    this.emit('error', message, context, err);
  }
  child(context: LogContext): Logger {
    return new JsonLogger(this.config, { ...this.baseContext, ...context });
  }
}

const defaultSink: LogSink = {
  log: (msg) => {
    // eslint-disable-next-line no-console
    console.log(msg);
  },
  error: (msg) => {
    // eslint-disable-next-line no-console
    console.error(msg);
  },
};

export function createLogger(config: LoggerConfig): Logger {
  return new JsonLogger(config);
}
