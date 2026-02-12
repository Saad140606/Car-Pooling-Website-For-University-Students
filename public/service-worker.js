// Campus Rides PWA Service Worker
// Handles app installation, caching, offline support, and background tasks

const CACHE_NAME = 'campus-rides-v2';
const RUNTIME_CACHE = 'campus-rides-runtime-v2';
const API_CACHE = 'campus-rides-api-v2';
const IMAGE_CACHE = 'campus-rides-images-v2';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/styles/globals.css',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first, fall back to network
  cacheFirst: async (request) => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    
    try {
      const response = await fetch(request);
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return new Response('Offline - Resource not available', {
        status: 503,
        statusText: 'Service Unavailable',
      });
    }
  },

  // Network first, fall back to cache
  networkFirst: async (request) => {
    try {
      const response = await fetch(request);
      if (response && response.status === 200) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      
      return new Response('Offline - Please check your connection', {
        status: 503,
        statusText: 'Service Unavailable',
      });
    }
  },

  // Stale while revalidate
  staleWhileRevalidate: async (request) => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);

    const fetchPromise = fetch(request).then(response => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    });

    return cached || fetchPromise;
  },
};

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch(error => {
          console.warn('[SW] Some static assets failed to cache:', error);
        });
      })
      .then(() => {
        console.log('[SW] Service worker installed successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (
              cacheName !== CACHE_NAME &&
              cacheName !== RUNTIME_CACHE &&
              cacheName !== API_CACHE &&
              cacheName !== IMAGE_CACHE
            ) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - intelligent caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests - network first with fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      CACHE_STRATEGIES.networkFirst(request)
    );
    return;
  }

  // Firebase and external API calls - network first
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com')
  ) {
    event.respondWith(
      CACHE_STRATEGIES.networkFirst(request)
    );
    return;
  }

  // Images - cache first
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE)
        .then(cache => {
          return cache.match(request).then(cached => {
            const fetchPromise = fetch(request).then(response => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            }).catch(() => cached);

            return cached || fetchPromise;
          });
        })
        .catch(() => new Response('Image not available', { status: 503 }))
    );
    return;
  }

  // CSS, JS, fonts - cache first
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      CACHE_STRATEGIES.cacheFirst(request)
    );
    return;
  }

  // HTML documents - network first
  if (request.destination === 'document' || request.mode === 'navigate') {
    event.respondWith(
      CACHE_STRATEGIES.networkFirst(request)
    );
    return;
  }

  // Default - stale while revalidate
  event.respondWith(
    CACHE_STRATEGIES.staleWhileRevalidate(request)
  );
});

/**
 * Background sync for ride requests and messages
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-rides') {
    event.waitUntil(
      syncRideData()
        .then(() => console.log('[SW] Ride sync completed'))
        .catch(error => console.error('[SW] Ride sync failed:', error))
    );
  }

  if (event.tag === 'sync-messages') {
    event.waitUntil(
      syncMessages()
        .then(() => console.log('[SW] Message sync completed'))
        .catch(error => console.error('[SW] Message sync failed:', error))
    );
  }
});

/**
 * Handle push notifications
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  let notificationData = {
    title: 'Campus Rides',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'campus-rides-notification',
    requireInteraction: false,
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
      };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData,
      actions: [
        {
          action: 'open',
          title: 'Open App',
        },
        {
          action: 'close',
          title: 'Dismiss',
        },
      ],
    })
  );
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Check if window is already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

/**
 * Handle notification close
 */
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification dismissed');
});

/**
 * Message handler for client communication
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then(cacheNames => {
          return Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
        })
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
    );
  }

  if (event.data && event.data.type === 'PRELOAD_ROUTE') {
    const route = event.data.route;
    event.waitUntil(
      fetch(route)
        .then(response => {
          if (response && response.status === 200) {
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(route, response.clone());
            });
          }
        })
        .catch(error => console.log('[SW] Preload failed:', error))
    );
  }
});

/**
 * Sync ride data (placeholder for actual implementation)
 */
async function syncRideData() {
  // This would sync pending ride requests, updates, etc.
  console.log('[SW] Syncing ride data...');
  // Implementation depends on your Firebase/API structure
}

/**
 * Sync messages (placeholder for actual implementation)
 */
async function syncMessages() {
  // This would sync pending messages
  console.log('[SW] Syncing messages...');
  // Implementation depends on your Firebase/API structure
}
