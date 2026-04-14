/// <reference lib="webworker" />

const CACHE_VERSION = 'v1';
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
  if (
    url.pathname.startsWith('/api/ai/') ||
    url.pathname.startsWith('/api/payment/') ||
    url.pathname.startsWith('/api/progress/') ||
    url.pathname.startsWith('/api/user/')
  ) {
    return;
  }

  // Strategy 2: StaleWhileRevalidate — learning data API (non-PII)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Strategy 1: CacheFirst — shell, CSS, JS, fonts, images
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
