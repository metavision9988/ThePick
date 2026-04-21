import { Hono } from 'hono';
import { createLogger, type LoggerEnvironment } from '@thepick/shared';
import type { RateLimiter } from './auth/rate-limit.js';
import { createAuthRoutes } from './auth/routes.js';
import { cachePolicyMiddleware } from './middleware/cache-policy.js';
import { createWebhookRoutes } from './webhooks/payment.js';

type Bindings = {
  DB: D1Database;
  ENVIRONMENT?: string;
  AUTH_RATE_LIMITER_IP?: RateLimiter;
  AUTH_RATE_LIMITER_EMAIL?: RateLimiter;
  WEBHOOK_RATE_LIMITER_IP?: RateLimiter;
  WEBHOOK_HMAC_SECRET_MOCK?: string;
  WEBHOOK_HMAC_SECRET_POLAR?: string;
  WEBHOOK_HMAC_SECRET_PORTONE?: string;
  WEBHOOK_HMAC_SECRET_TOSSPAYMENTS?: string;
};

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

const app = new Hono<{ Bindings: Bindings }>();

// L1 Edge Cache 헤더 자동 주입 (ADR-008 §8) — 4-Pass C-3 반영
// **첫 번째** 미들웨어로 등록: 어떤 경로에서 어떤 이유로 early-return 되어도
// private/no-store 헤더가 반드시 적용되도록 보장 (보안 floor).
app.use('*', cachePolicyMiddleware());

// Enable FK enforcement on every D1 connection (PRAGMA is per-connection in SQLite)
// D1.exec 는 SQL prepared API 이며 child_process.exec 과 무관. 정적 PRAGMA 문자열만 전달.
// FK 실패 시 요청 거부 — 데이터 무결성 비타협 원칙
app.use('*', async (c, next): Promise<void | Response> => {
  const logger = createLogger({
    service: 'thepick-api',
    environment: resolveLoggerEnv(c.env.ENVIRONMENT),
  }).child({ module: 'bootstrap' });

  if (!c.env.DB) {
    logger.error('DB binding not configured');
    return c.json({ error: 'Database not configured' }, 500);
  }
  try {
    await c.env.DB.exec('PRAGMA foreign_keys = ON');
  } catch (err) {
    logger.error('Failed to enable FK enforcement', err);
    return c.json({ error: 'Database initialization failed' }, 500);
  }
  await next();
});

app.route('/api/auth', createAuthRoutes());
app.route('/api/webhooks', createWebhookRoutes());

app.get('/', (c) => {
  return c.json({
    name: 'ThePick API',
    version: '0.1.0',
    status: 'ok',
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'healthy' });
});

export default app;
