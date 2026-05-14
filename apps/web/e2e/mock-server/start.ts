/**
 * mock-server entry — Playwright `webServer` 또는 `pnpm --filter @thepick/web e2e:mock-server`로 기동.
 *
 * port: MOCK_PORT 환경변수 (default 8787).
 * shutdown: SIGINT / SIGTERM 정상 종료.
 *
 * console.log는 process lifecycle 진단 의도 — eslint no-console 파일 단위 disable.
 */
/* eslint-disable no-console */

import { serve } from '@hono/node-server';

import { app } from './server';

const port = Number.parseInt(process.env.MOCK_PORT ?? '8787', 10);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[mock-server] listening on http://localhost:${info.port}`);
});

function shutdown(signal: string): void {
  console.log(`[mock-server] ${signal} → shutting down...`);
  server.close((err) => {
    if (err !== undefined && err !== null) {
      console.error('[mock-server] shutdown error:', err);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
