// src/firebase/messaging.ts
'use client';

import { getMessaging, onMessage, type MessagePayload } from 'firebase/messaging';

/**
 * Initialize foreground FCM handling.
 * - Displays a browser notification when the app is in the foreground.
 * - Emits a global `fcm_message` window event with the raw payload so UI components can react.
 */
export function initMessaging() {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
    console.debug('VAPID key missing; skipping FCM init');
    return;
  }

  try {
    const messaging = getMessaging();
    onMessage(messaging, (payload: MessagePayload) => {
      try {
        if (payload.notification && 'Notification' in window && Notification.permission === 'granted') {
          const { title, body } = payload.notification as any;
          // Show a transient browser notification while app is foregrounded.
          // Rely on service worker / backend for background notifications.
          // Keep this minimal; clicking behavior should be handled by app deep-linking.
          new Notification(title || 'Notification', { body: body || undefined });
        }
      } catch (e) {
        console.debug('Foreground notification display failed:', e);
      }

      try {
        window.dispatchEvent(new CustomEvent('fcm_message', { detail: payload }));
      } catch (e) {
        /* ignore */
      }
    });
    console.debug('FCM foreground listener initialized');
  } catch (e) {
    console.debug('Failed to initialize FCM foreground listener (non-fatal):', e);
  }
}
