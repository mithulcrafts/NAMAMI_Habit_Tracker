const CACHE_PREFIX = 'namami-cache';
const CACHE_VERSION = 'v8';
const RUNTIME_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const NAV_CACHE = `${CACHE_PREFIX}-nav-${CACHE_VERSION}`;
const OFFLINE_FALLBACK = '/';
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/namami-icon.svg'];

self.addEventListener('install', event => {
  // Use the normal waiting lifecycle. An update must not reload an open app
  // while a check-in is being saved or a form contains unsaved edits.
  event.waitUntil(caches.open(RUNTIME_CACHE).then(cache => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(`${CACHE_PREFIX}-`) &&
      key !== RUNTIME_CACHE && key !== NAV_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

// Deliberately ignore the old app's SKIP_WAITING message. That version also
// reloads on controllerchange, which could discard an in-flight save.
const isNavigationRequest = request => request.mode === 'navigate' ||
  (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
const isAssetRequest = request => ['script', 'style', 'worker', 'document'].includes(request.destination);

const canCache = (request, response) => {
  if (!response.ok) return false;
  const type = response.headers.get('content-type') || '';
  if (isNavigationRequest(request)) return type.includes('text/html');
  if (['script', 'worker'].includes(request.destination)) return /javascript|ecmascript/.test(type);
  if (request.destination === 'style') return type.includes('text/css');
  if (request.destination === 'image') return type.startsWith('image/');
  return true;
};

const match = async (name, request) => {
  try { return await (await caches.open(name)).match(request); }
  catch { return undefined; }
};
const put = async (name, request, response) => {
  try { await (await caches.open(name)).put(request, response.clone()); }
  catch { /* A cache quota failure must not turn a good network response into an error. */ }
};
const fallback = async request => {
  if (!isNavigationRequest(request)) return (await match(RUNTIME_CACHE, request)) || Response.error();
  return (await match(NAV_CACHE, request)) || (await match(NAV_CACHE, OFFLINE_FALLBACK)) ||
    (await match(RUNTIME_CACHE, OFFLINE_FALLBACK)) || Response.error();
};

const networkFirst = async request => {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (canCache(request, response)) {
      await put(isNavigationRequest(request) ? NAV_CACHE : RUNTIME_CACHE, request, response);
      return response;
    }
    const cached = await fallback(request);
    return cached.type !== 'error' ? cached : (response.ok ? Response.error() : response);
  } catch { return fallback(request); }
};

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (isNavigationRequest(request) || isAssetRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }
  // Keep background refresh alive until its checked cache write is finished.
  const refresh = (async () => {
    try {
      const response = await fetch(request);
      if (canCache(request, response)) await put(RUNTIME_CACHE, request, response);
      return response;
    } catch { return Response.error(); }
  })();
  event.waitUntil(refresh);
  event.respondWith((async () => (await match(RUNTIME_CACHE, request)) || (await refresh))());
});
