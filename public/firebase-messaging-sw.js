// Minimal service worker to show incoming FCM push notifications.
// Place this file in /public so it's served at /firebase-messaging-sw.js.
// This worker doesn't use the Firebase SDK; it simply shows push payloads
// as notifications. For richer handling use the firebase-messaging-sw.js example
// from Firebase docs and initialize messaging inside the worker.

self.addEventListener('push', function(event) {
  const toText = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  };

  const firstNonEmpty = (...values) => {
    for (const value of values) {
      const text = toText(value);
      if (text) return text;
    }
    return '';
  };

  const contextualBody = (payload = {}) => {
    const type = toText(payload.type).toLowerCase();
    const actor = firstNonEmpty(payload.senderName, payload.actorName, payload.driverName, payload.passengerName, payload.fromName, payload.from);

    if (type.includes('chat') || type.includes('message')) {
      const preview = firstNonEmpty(payload.messagePreview, payload.message, payload.content, payload.text, payload.body);
      if (preview) return actor ? `${actor}: ${preview}` : preview;
      return actor ? `${actor} sent you a message` : 'You received a new message';
    }

    if (type.includes('cancel')) {
      return actor ? `${actor} cancelled your ride` : 'Your ride was cancelled';
    }

    if (type.includes('accept')) {
      return actor ? `${actor} accepted your ride request` : 'Your ride request was accepted';
    }

    if (type.includes('call')) {
      const callKind = toText(payload.mode).toLowerCase() === 'video' ? 'video call' : 'call';
      return actor ? `${actor} is calling you (${callKind})` : `Incoming ${callKind}`;
    }

    return firstNonEmpty(payload.message, payload.content, payload.text, payload.description, payload.body);
  };

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.warn('Push event had no JSON payload', e);
  }

  const payloadData = { ...(data.data || {}), ...data };
  const title = firstNonEmpty(data?.notification?.title, payloadData.title, payloadData.heading, 'Campus Rides');
  const body = firstNonEmpty(data?.notification?.body, payloadData.body, payloadData.message, contextualBody(payloadData), 'Open the app to view updates');
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
