// Minimal service worker to show incoming FCM push notifications.
// Place this file in /public so it's served at /firebase-messaging-sw.js.
// This worker doesn't use the Firebase SDK; it simply shows push payloads
// as notifications. For richer handling use the firebase-messaging-sw.js example
// from Firebase docs and initialize messaging inside the worker.

self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.warn('Push event had no JSON payload', e);
  }

  const title = (data.notification && data.notification.title) || data.title || 'Incoming Call';
  const body = (data.notification && data.notification.body) || data.body || 'Tap to open';
  const badge = data.notification?.badge || undefined;
  const icon = data.notification?.icon || '/icons/icon-192x192.png';

  const options = {
    body,
    icon,
    badge,
    data: data.data || data || {},
    requireInteraction: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data && (event.notification.data.url || event.notification.data.link) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Try to focus existing client
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
