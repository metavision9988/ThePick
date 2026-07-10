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

/**
 * promo-1st P5 — 공개 표면 캐시 경계 회귀 (4-Pass MAJOR-2/4, 지뢰 #5 기계 차단).
 * 불변식: 정답·셔플 노출 경로(next/grade/reveal)는 어떤 status 든 no-store /
 * overview 만 200 한정 공용 캐시(에러 status 는 no-store 강하).
 */
describe('cachePolicyMiddleware — /api/public/* (promo-1st)', () => {
  function createPublicApp(): Hono {
    const app = new Hono();
    app.use('*', cachePolicyMiddleware());
    app.get('/api/public/questions/overview', (c) => c.json({ total: 3 }));
    app.get('/api/public/questions/overview-429', (c) => c.json({ total: 0 })); // 미사용 방어
    app.get('/api/public/questions/next', (c) => c.json({ id: 'q' }));
    app.post('/api/public/grade', (c) => c.json({ isCorrect: true }));
    app.post('/api/public/reveal', (c) => c.json({ correctAnswer: 'x' }));
    return app;
  }

  it('overview 200 → public, max-age=300 (지형도 집계만 예외 공용 캐시)', async () => {
    const res = await createPublicApp().request('/api/public/questions/overview');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
  });

  it('★MAJOR-1/3 회귀: overview 비-200(429/500) → no-store (에러 5분 캐시 오염 차단)', async () => {
    const app = new Hono();
    app.use('*', cachePolicyMiddleware());
    app.get('/api/public/questions/overview', (c) => c.json({ error: 'TOO_MANY_REQUESTS' }, 429));
    const res429 = await app.request('/api/public/questions/overview');
    expect(res429.status).toBe(429);
    expect(res429.headers.get('Cache-Control')).toBe('no-store');

    const app500 = new Hono();
    app500.use('*', cachePolicyMiddleware());
    app500.get('/api/public/questions/overview', (c) => c.json({ error: 'INTERNAL_ERROR' }, 500));
    const res500 = await app500.request('/api/public/questions/overview');
    expect(res500.headers.get('Cache-Control')).toBe('no-store');
  });

  it('★지뢰 #5 회귀: next/grade/reveal 은 no-store (정답·셔플 응답 공유 캐시 절대 금지)', async () => {
    const app = createPublicApp();
    const next = await app.request('/api/public/questions/next');
    expect(next.headers.get('Cache-Control')).toBe('no-store');
    const grade = await app.request('/api/public/grade', { method: 'POST' });
    expect(grade.headers.get('Cache-Control')).toBe('no-store');
    const reveal = await app.request('/api/public/reveal', { method: 'POST' });
    expect(reveal.headers.get('Cache-Control')).toBe('no-store');
  });
});
