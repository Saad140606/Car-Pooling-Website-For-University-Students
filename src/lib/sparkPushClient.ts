'use client';

import { getMessaging, getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp, Firestore } from 'firebase/firestore';

export interface RegisterSparkPushParams {
  firestore: Firestore;
  uid: string;
  university: string;
  vapidKey: string;
}

export async function registerSparkPush({ firestore, uid, university, vapidKey }: RegisterSparkPushParams): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!vapidKey) throw new Error('Missing VAPID key');

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  if (!('Notification' in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const swRegistration = await navigator.serviceWorker.register('/service-worker.js', {
    scope: '/',
    updateViaCache: 'none',
  });

  const messaging = getMessaging();
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swRegistration,
  });

  if (!token) return null;

  await setDoc(
    doc(firestore, 'universities', university, 'users', uid),
    {
      fcmToken: token,
      fcmTokenUpdatedAt: serverTimestamp(),
      pushEnabled: true,
    },
    { merge: true }
  );

  return token;
}
