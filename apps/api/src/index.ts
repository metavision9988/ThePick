import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable FK enforcement on every D1 connection (PRAGMA is per-connection in SQLite)
// FK 실패 시 요청 거부 — 데이터 무결성 비타협 원칙
app.use('*', async (c, next): Promise<void | Response> => {
  if (!c.env.DB) {
    console.error('[api] DB binding not configured');
    return c.json({ error: 'Database not configured' }, 500);
  }
  try {
    await c.env.DB.exec('PRAGMA foreign_keys = ON');
  } catch (e) {
    console.error('[api] Failed to enable FK enforcement:', e);
    return c.json({ error: 'Database initialization failed' }, 500);
  }
  await next();
});

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
