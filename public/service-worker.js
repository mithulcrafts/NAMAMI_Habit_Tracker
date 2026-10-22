const CACHE_PREFIX = 'namami-cache';
const CACHE_VERSION = 'v7';
const RUNTIME_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const NAV_CACHE = `${CACHE_PREFIX}-nav-${CACHE_VERSION}`;
const OFFLINE_FALLBACK = '/';

const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icons/namami-icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.addAll(PRECACHE);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== RUNTIME_CACHE && key !== NAV_CACHE)
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

const isNavigationRequest = (request) =>
  request.mode === 'navigate' ||
  (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

const isAssetRequest = (request) =>
  request.destination === 'script' ||
  request.destination === 'style' ||
  request.destination === 'worker' ||
  request.destination === 'document';

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request, { cache: 'no-store' });
          const copy = networkResponse.clone();
          const cache = await caches.open(NAV_CACHE);
          cache.put(request, copy);
          return networkResponse;
        } catch {
          const navigationCache = await caches.open(NAV_CACHE);
          const cached = await navigationCache.match(request) || await navigationCache.match(OFFLINE_FALLBACK);
          if (cached) return cached;
          const runtimeCache = await caches.open(RUNTIME_CACHE);
          return runtimeCache.match(OFFLINE_FALLBACK);
        }
      })()
    );
    return;
  }

  if (isAssetRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request, { cache: 'no-store' });
          const copy = networkResponse.clone();
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, copy);
          return networkResponse;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match(OFFLINE_FALLBACK);
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) {
        fetch(request)
          .then((networkResponse) =>
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, networkResponse.clone()))
          )
          .catch(() => {});
        return cached;
      }

      try {
        const networkResponse = await fetch(request);
        const copy = networkResponse.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return networkResponse;
      } catch {
        return caches.match(OFFLINE_FALLBACK);
      }
    })()
  );
});
