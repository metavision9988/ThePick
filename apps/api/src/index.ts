import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createLogger, type LoggerEnvironment } from '@thepick/shared';
import type { RateLimiter } from './auth/rate-limit.js';
import { createAuthRoutes } from './auth/routes.js';
import { cachePolicyMiddleware } from './middleware/cache-policy.js';
import { createProgressRoutes } from './progress/routes.js';
import { purgeOldRateLimits } from './scheduled/rate-limit-gc.js';
import { reportSilentFailures } from './scheduled/silent-failure-monitor.js';
import { createTelemetryRoutes } from './telemetry/routes.js';
import { createVectorizeRoutes, type VectorizeRouteBindings } from './vectorize/routes.js';
import { createUserSearchRoutes } from './search/routes.js';
import { createStudyRoutes } from './study/routes.js';
import { createWebhookRoutes } from './webhooks/payment.js';

/**
 * 허용 Origin 목록 (Level 3 감사 M-A4 해소, 2026-04-22).
 *
 * - dev: localhost:4321 (Astro) + 127.0.0.1:4321
 * - staging: thepick-staging.pages.dev (Cloudflare Pages 기본)
 * - production: thepick.app (도메인 확정 시 업데이트)
 *
 * 웹훅 경로는 CORS 대상 아님 (PG 서버 → 서버, 브라우저 무관).
 */
const CORS_ALLOWED_ORIGINS: readonly string[] = [
  'http://localhost:4321',
  'http://127.0.0.1:4321',
  // Step 19 — admin-web (Astro) 개발 포트 4322 (apps/admin-web/astro.config.mjs)
  'http://localhost:4322',
  'http://127.0.0.1:4322',
  'https://thepick-staging.pages.dev',
  'https://thepick.app',
  // Step 19 — admin-web Cloudflare Pages 도메인 (production 배포 후 갱신)
  'https://thepick-admin.pages.dev',
  // Phase 2 Eval MVP Step 5-A — apps/web production Pages (thepick-web 글로벌 점유 충돌 회피, Session 065)
  'https://thepick-study.pages.dev',
];

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
  JWT_SECRET?: string;
  IP_PEPPER?: string;
  // Step 19 — Engine Observability v1 admin token (Phase 1 임시, Cloudflare Access 도입 후 제거)
  ADMIN_API_TOKEN?: string;
  // Phase 2A Session 056 — Vectorize 인덱싱 + RAG smoke test (ADR-004 §3 + plan phase2a-vectorize-indexing)
  VECTORIZE: VectorizeRouteBindings['VECTORIZE'];
  AI: VectorizeRouteBindings['AI'];
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

// CORS — Level 3 감사 M-A4 해소 (2026-04-22) + Step 1-5 (나) Pass 1 C-1 확장 (2026-04-23)
// 인증 쿠키 기반 보호 라우트 전체에 적용. webhook 은 서버→서버라 CORS 불필요.
// credentials=true: tp_access / tp_refresh 쿠키 전송 필수.
function buildCorsOptions() {
  return {
    origin: (origin: string | undefined): string | null => {
      if (!origin) return null;
      return CORS_ALLOWED_ORIGINS.includes(origin) ? origin : null;
    },
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    exposeHeaders: ['Retry-After'],
    maxAge: 600,
  };
}
app.use('/api/auth/*', cors(buildCorsOptions()));
app.use('/api/progress/*', cors(buildCorsOptions()));
// Phase 2 Eval MVP (phase2-eval-mvp.plan §6.2/§6.3) — 진산님 직접 평가 환경 학습 라우트.
app.use('/api/study/*', cors(buildCorsOptions()));
// Step 19 MAJOR-AD-1 흡수 — admin-web /telemetry 페이지 ↔ apps/api 크로스-오리진 보장.
// X-Admin-Token 커스텀 헤더 사용으로 OPTIONS preflight 의무 → CORS 미설정 시 100% 차단.
// Phase B (handoff-028) 흡수 — admin_session HttpOnly 쿠키 인증 추가.
//   credentials: true (buildCorsOptions 상속) → admin-web `credentials: 'include'` fetch 호환.
//   allowHeaders 에서 X-Admin-Token 유지 — server-to-server / curl / BATCH wire-up fallback.
app.use(
  '/api/telemetry/*',
  cors({ ...buildCorsOptions(), allowHeaders: ['Content-Type', 'X-Admin-Token'] }),
);
// Pass 3 ADVOCATE C1 흡수 (Session 056) — admin/vectorize CSRF preflight 강제.
// X-Admin-Token 커스텀 헤더 사용으로 OPTIONS preflight 의무 → CORS 미설정 시 simple-request CSRF 시나리오.
app.use(
  '/api/admin/vectorize/*',
  cors({ ...buildCorsOptions(), allowHeaders: ['Content-Type', 'X-Admin-Token'] }),
);
// Phase 2A Step 3 (Session 058) — public user search route (인증 0, MVP).
// rate-limit 별도 step (P3-m1 carry-over). user_session 인증 별도 step.
app.use('/api/search', cors(buildCorsOptions()));

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
app.route('/api/progress', createProgressRoutes());
app.route('/api/telemetry', createTelemetryRoutes());
app.route('/api/webhooks', createWebhookRoutes());
app.route('/api/admin/vectorize', createVectorizeRoutes());
app.route('/api/search', createUserSearchRoutes());
app.route('/api/study', createStudyRoutes());

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

/**
 * Cloudflare Workers Cron Trigger 핸들러 (NC-2 + F4 보강).
 *
 * 스케줄: wrangler.toml [triggers] crons = ["0 3 * * *"] (매일 UTC 03:00 = KST 12:00).
 * 작업: rate_limits 테이블의 2일 이전 bucket 삭제 (D1 10GB 한도 포화 방지).
 *
 * ## Silent failure 방어 (F4, 3차 리뷰)
 *
 * scheduled 는 Workers 런타임에서 at-most-once — 실패 시 자동 재시도 없음. 이 함수
 * 내부에서 throw 를 삼키면 NC-2 본래의 가용성 보장이 silent 무력화되므로:
 *
 * 1. 미지 cron 은 명시적 warn 후 early-return (silent over-execution 방지)
 * 2. 실패 시 `console.error` 동시 호출 → wrangler tail / Cloudflare Logs 에 stderr 즉시
 *    노출 (logger.error 가 logpush 미설정 환경에서 휘발될 위험 대비 2차 방어선)
 * 3. 정상 실행에서도 `deletedCount` 가 비정상적으로 큰 경우(>2일치 상한) warn — 연속
 *    실패 후 catch-up 상황 감지
 *
 * 완전한 운영 모니터링(Email Routing / 외부 알림)은 별도 인프라 작업 — tech-debt
 * 이월 (TD-Scheduled-Monitoring). 본 방어선은 앱 레벨 최대치.
 */
const CRON_GC_DAILY = '0 3 * * *';
const GC_DELETE_COUNT_WARN_THRESHOLD = 30_000_000; // 2일치(28.8M) 초과 시 누적 의심

async function scheduled(
  event: ScheduledEvent,
  env: Bindings,
  ctx: ExecutionContext,
): Promise<void> {
  const logger = createLogger({
    service: 'thepick-api',
    environment: resolveLoggerEnv(env.ENVIRONMENT),
  }).child({ module: 'scheduled', cron: event.cron });

  if (event.cron !== CRON_GC_DAILY) {
    logger.warn('unknown cron fired — skipping', { received: event.cron });
    return;
  }

  ctx.waitUntil(
    (async () => {
      try {
        const result = await purgeOldRateLimits(env.DB);
        if (result.deletedCount > GC_DELETE_COUNT_WARN_THRESHOLD) {
          // 연속 실패 후 catch-up 가능성 — 운영자 즉시 확인 필요.
          logger.warn('rate_limits GC deleted unusually large row count', {
            deleted: result.deletedCount,
            threshold: GC_DELETE_COUNT_WARN_THRESHOLD,
            cutoff: result.cutoffBucket,
          });
          console.warn(
            `[scheduled] rate_limits GC anomaly: deleted=${result.deletedCount} > threshold=${GC_DELETE_COUNT_WARN_THRESHOLD}`,
          );
        } else {
          logger.info('rate_limits GC complete', {
            deleted: result.deletedCount,
            cutoff: result.cutoffBucket,
          });
        }
      } catch (err) {
        // logger.error + console.error 이중 — logpush 미설정 환경에서도 stderr 로 노출.
        logger.error('rate_limits GC failed', err);
        console.error('[scheduled] rate_limits GC failed', err);
        // throw 재전파는 하지 않음 (waitUntil 은 throw 해도 Workers 가 재시도 안 함).
        // 운영 모니터링(Email Routing 등) 은 별도 인프라 TD 로 이월.
      }

      // ADR-043 (CRIT-DO-1 흡수) — silent_failure 임계 모니터.
      // 직전 24h engine_telemetry에서 streak_silent_failure / weak_delta_silent_failure 카운트
      // 집계 후 임계 초과 시 logger.error + console.error (Email Routing 활성은 ADR-043 §3 carry-over).
      try {
        await reportSilentFailures(env.DB, logger);
      } catch (err) {
        logger.error('silent_failure monitor failed', err);
        console.error('[scheduled] silent_failure monitor failed', err);
      }
    })(),
  );
}

export default {
  fetch: app.fetch,
  scheduled,
};
