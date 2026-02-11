// =============================================================================
// TINLYLINK SERVICE WORKER - Enhanced Offline Support
// =============================================================================

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `tinlylink-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `tinlylink-dynamic-${CACHE_VERSION}`;
const API_CACHE = `tinlylink-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `tinlylink-images-${CACHE_VERSION}`;

// Static assets to pre-cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/offline.html',
];

// API endpoints to cache for offline (GET only)
const CACHEABLE_API = [
  '/api/v1/account/profile/',
  '/api/v1/links/',
  '/api/v1/campaigns/',
  '/api/v1/analytics/overview/',
];

// Install - Pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => !key.includes(CACHE_VERSION))
          .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// Fetch - Smart caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) return;

  // API requests - Network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    if (request.method === 'GET') {
      event.respondWith(networkFirstWithCache(request, API_CACHE));
    }
    return;
  }

  // Images - Cache first
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Static assets - Cache first, network fallback
  event.respondWith(cacheFirstWithNetwork(request));
});

// Network first, cache fallback (for API)
async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Return offline response for API
    return new Response(JSON.stringify({ 
      error: 'You are offline',
      offline: true 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Cache first (for images)
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 404 });
  }
}

// Cache first with network fallback (for static)
async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Update cache in background
    fetch(request).then(response => {
      if (response.ok) {
        caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, response));
      }
    }).catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return offline page for navigation
    if (request.mode === 'navigate') {
      return caches.match('/offline.html') || caches.match('/index.html');
    }
    return new Response('Offline', { status: 503 });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-links') {
    event.waitUntil(syncOfflineLinks());
  }
});

async function syncOfflineLinks() {
  // Get pending actions from IndexedDB
  const db = await openDB();
  const pendingActions = await db.getAll('pending-actions');
  
  for (const action of pendingActions) {
    try {
      await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body,
      });
      await db.delete('pending-actions', action.id);
    } catch {
      // Will retry on next sync
    }
  }
}

// IndexedDB helper
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tinlylink-offline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('pending-actions', { keyPath: 'id', autoIncrement: true });
    };
  });
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'default',
    renotify: true,
    data: { url: data.url || '/', ...data },
    actions: [
      { action: 'open', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'TinlyLink', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Focus existing window
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window
        return clients.openWindow(url);
      })
  );
});

// Message handling for client communication
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_URLS') {
    caches.open(DYNAMIC_CACHE).then(cache => {
      cache.addAll(event.data.urls);
    });
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => {
      keys.forEach(key => caches.delete(key));
    });
  }
});
