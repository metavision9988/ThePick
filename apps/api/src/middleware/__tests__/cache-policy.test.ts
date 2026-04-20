import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { cachePolicyMiddleware } from '../cache-policy.js';

function createAppWithMiddleware(): Hono {
  const app = new Hono();
  app.use('*', cachePolicyMiddleware());
  app.get('/api/auth/login', (c) => c.json({ ok: true }));
  app.get('/api/user/profile', (c) => c.json({ ok: true }));
  app.get('/api/progress/today', (c) => c.json({ ok: true }));
  app.get('/api/payment/history', (c) => c.json({ ok: true }));
  app.get('/api/content/manual', (c) => c.json({ ok: true }));
  app.get('/api/search/rag', (c) => c.json({ ok: true }));
  app.get('/api/other/misc', (c) => c.json({ ok: true }));
  return app;
}

describe('cachePolicyMiddleware', () => {
  it('applies private/no-store to /api/auth/*', async () => {
    const app = createAppWithMiddleware();
    const res = await app.request('/api/auth/login');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('Vary')).toBe('Authorization, Cookie');
  });

  it('applies private/no-store to /api/user/*', async () => {
    const app = createAppWithMiddleware();
    const res = await app.request('/api/user/profile');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('applies private/no-store to /api/progress/*', async () => {
    const app = createAppWithMiddleware();
    const res = await app.request('/api/progress/today');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('applies private/no-store to /api/payment/*', async () => {
    const app = createAppWithMiddleware();
    const res = await app.request('/api/payment/history');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('applies public/max-age=300 to /api/content/*', async () => {
    const app = createAppWithMiddleware();
    const res = await app.request('/api/content/manual');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(res.headers.get('Vary')).toBeNull();
  });

  it('applies public/max-age=60 to /api/search/*', async () => {
    const app = createAppWithMiddleware();
    const res = await app.request('/api/search/rag');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
  });

  it('applies no-store fallback for unmatched paths (4-Pass C-4 security floor)', async () => {
    const app = createAppWithMiddleware();
    const res = await app.request('/api/other/misc');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('applies no-store fallback for 404 paths', async () => {
    const app = createAppWithMiddleware();
    const res = await app.request('/api/unknown/path');
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('overrides route handler Cache-Control (intentional security floor)', async () => {
    const app = new Hono();
    app.use('*', cachePolicyMiddleware());
    app.get('/api/auth/risky', (c) => {
      c.header('Cache-Control', 'public, max-age=3600');
      return c.json({ ok: true });
    });

    const res = await app.request('/api/auth/risky');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });
});
