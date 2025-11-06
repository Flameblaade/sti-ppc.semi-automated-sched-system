// Service Worker for Offline Access
// Bump versions to invalidate old caches and force new SW to take effect
const CACHE_NAME = 'sched-system-v3';
const API_CACHE_NAME = 'sched-system-api-v3';
const STATIC_CACHE_NAME = 'sched-system-static-v3';

// Assets to cache on install (only same-origin resources)
// NOTE: JavaScript files are EXCLUDED from pre-cache to ensure they're always fetched fresh
// This prevents hard refresh issues when code changes are made
const STATIC_ASSETS = [
  '/',
  // CSS files can be cached (less frequently changed)
  '/css/schedule.css',
  '/css/main.css',
  '/css/superadmin.css',
  '/css/admin.css',
  '/css/login.css',
  '/css/signup.css',
  '/css/modals.css',
  // JavaScript files are NOT pre-cached - they use network-first strategy
  // This ensures code changes work immediately without hard refresh
  '/assets/sti.png',
  '/manifest.json'
  // External resources (CDN) will be handled by browser cache, not service worker cache
];

// API endpoints to cache (GET requests only)
const API_ENDPOINTS_TO_CACHE = [
  '/api/schedule',
  '/api/departments',
  '/api/rooms',
  '/api/subjects',
  '/api/courses',
  '/api/strands',
  '/api/faculty'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      // Only cache same-origin resources
      const sameOriginAssets = STATIC_ASSETS.filter(url => 
        url.startsWith('/') || url.startsWith(location.origin)
      );
      return cache.addAll(sameOriginAssets.map(url => new Request(url, { credentials: 'same-origin' }))).catch((err) => {
        console.warn('[Service Worker] Some assets failed to cache:', err);
        // Cache what we can, continue even if some fail
        return Promise.resolve();
      });
    })
  );
  // Force activation of new service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== API_CACHE_NAME && 
              cacheName !== STATIC_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Only handle same-origin requests in service worker
  // External CDN resources will be handled by browser cache
  if (url.origin !== location.origin) {
    return; // Let browser handle external resources normally
  }

  // Always network-first for navigation/HTML requests to avoid stale UI
  const isNavigation = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // For API endpoints, always do network-first; only cache whitelisted endpoints
  if (url.pathname.startsWith('/api/')) {
    const shouldCache = API_ENDPOINTS_TO_CACHE.includes(url.pathname);
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (shouldCache && response.ok) {
            const responseToCache = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // For JavaScript files, use network-first strategy to ensure fresh code
  const isJavaScript = url.pathname.endsWith('.js');
  if (isJavaScript) {
    event.respondWith(
      fetch(request, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
        .then((response) => {
          // Only cache for offline use (network succeeded)
          if (response.ok && url.origin === location.origin) {
            const responseToCache = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache).catch(err => {
                console.warn('[Service Worker] Failed to cache JS for offline:', err);
              });
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed (offline), try cache as fallback
          console.log('[Service Worker] Network failed for JS, trying cache:', request.url);
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[Service Worker] Serving JS from cache (offline):', request.url);
              return cachedResponse;
            }
            // No cache available, return network error
            return new Response('JavaScript file unavailable (offline)', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
        })
    );
    return;
  }

  // For other static assets (CSS, images), use cache-first but still check network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // For CSS and other static assets, try network first to check for updates
      return fetch(request, { cache: 'no-cache' })
        .then((response) => {
          // Cache successful same-origin responses for offline use
          if (response.ok && url.origin === location.origin) {
            const responseToCache = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache).catch(err => {
                console.warn('[Service Worker] Failed to cache response:', err);
              });
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, use cache if available
          if (cachedResponse) {
            console.log('[Service Worker] Serving from cache (offline):', request.url);
            return cachedResponse;
          }
          // Network failed and no cache, return error
          if (url.origin === location.origin) {
            return caches.match('/index.html');
          }
          return fetch(request);
        });
    })
  );
});

// Message event - handle messages from the page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CACHE_API') {
    // Cache specific API response
    const { url, data } = event.data;
    event.waitUntil(
      caches.open(API_CACHE_NAME).then((cache) => {
        return cache.put(
          new Request(url),
          new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
          })
        );
      })
    );
  }
});

