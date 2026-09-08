const CACHE_NAME = 'nexus-crm-v2.13';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/favicon-16.png',
  '/favicon-32.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
];

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, cache fallback for navigation
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET
  if (request.method !== 'GET') return;

  // Skip API requests
  if (request.url.includes('/api/')) return;

  // Skip socket.io
  if (request.url.includes('/socket.io/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful navigation responses
        if (request.mode === 'navigate' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback — serve cached page
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return caches.match(request);
      })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'NEXUS CRM', body: 'Новое уведомление' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: data.tag || 'nexus-notification',
      data: data,
      vibrate: [200, 100, 200],
    })
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.link || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.visibilityState === 'visible');
      if (existing) {
        existing.focus();
        existing.navigate(url);
      } else {
        self.clients.openWindow(url);
      }
    })
  );
});
