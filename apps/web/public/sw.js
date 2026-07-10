/// <reference lib="webworker" />

const CACHE_VERSION = 'v3';
const SHELL_CACHE = `thepick-shell-${CACHE_VERSION}`;
const DATA_CACHE = `thepick-data-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/manifest.json',
];

// --- Install: pre-cache app shell ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.error('[SW] Install failed — shell asset pre-cache error:', err);
        throw err;
      })
  );
});

// --- Activate: clean old caches ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// --- Fetch: 4 caching strategies ---
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Strategy 4: NetworkOnly — AI tutor, payment, admin API, user data (PII)
  // + /api/public/ (P4-D7): 랜덤 서빙 /next 가 SWR 캐시에 물리면 같은 문항 재서빙 —
  //   공개 학습 표면은 항상 네트워크 직행.
  if (
    url.pathname.startsWith('/api/ai/') ||
    url.pathname.startsWith('/api/payment/') ||
    url.pathname.startsWith('/api/progress/') ||
    url.pathname.startsWith('/api/public/') ||
    url.pathname.startsWith('/api/user/')
  ) {
    return;
  }

  // Strategy 2: StaleWhileRevalidate — learning data API (non-PII)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Navigation(HTML 문서) → NetworkFirst: 새 배포 HTML 즉시 반영(옛 HTML→옛 번들 해시 고착 방지).
  // 오프라인 시 캐시 폴백. (CacheFirst 가 옛 HTML→옛 study-api 번들→localhost 호출 고착시키던 버그 해소.)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Strategy 1: CacheFirst — 해시 자산(/_astro/*.[hash].js·css)·폰트·이미지 (콘텐츠 해시 = 불변, 변경 시 새 URL).
  event.respondWith(cacheFirst(request));
});

// --- Background Sync: offline actions ---
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

// --- Strategy implementations ---

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone()).catch((err) => {
        console.error('[SW] cacheFirst cache.put failed:', request.url, err);
      });
    }
    return response;
  } catch (err) {
    console.error('[SW] cacheFirst fetch failed:', request.url, err);
    return new Response(
      JSON.stringify({ error: 'offline', url: request.url }),
      { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()).catch((err) => {
        console.error('[SW] networkFirst cache.put failed:', request.url, err);
      });
    }
    return response;
  } catch (err) {
    console.warn('[SW] networkFirst fetch failed — falling back to cache:', request.url, err);
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match('/');
    if (shell) return shell;
    return new Response(
      '<!doctype html><meta charset="utf-8"><h1>오프라인</h1><p>네트워크 연결 후 다시 시도해 주세요.</p>',
      { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone()).catch((err) => {
          console.error('[SW] staleWhileRevalidate cache.put failed:', request.url, err);
        });
      }
      return response;
    })
    .catch((err) => {
      console.warn('[SW] staleWhileRevalidate fetch failed:', request.url, err);
      if (cached) return cached;
      return new Response(
        JSON.stringify({ error: 'offline', url: request.url }),
        { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'application/json' } }
      );
    });

  return cached || fetchPromise;
}

async function syncOfflineActions() {
  // NOT IMPLEMENTED — offline actions remain queued in IndexedDB.
  // The browser will retry this sync event on next connectivity change.
  // Real implementation: Step 2-11 (오프라인 동기화)
  console.warn('[SW] syncOfflineActions: NOT IMPLEMENTED — offline actions remain queued');
}
