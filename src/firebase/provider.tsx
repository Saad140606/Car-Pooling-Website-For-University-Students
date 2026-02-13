// src/firebase/provider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { initializeFirebase } from './init';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { NetworkErrorListener } from '@/components/NetworkErrorListener';

interface FirebaseContextValue {
  firebaseApp: FirebaseApp | undefined;
  auth: Auth | undefined;
  firestore: Firestore | undefined;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  // Initialize synchronously during render on the client 
  const initial = typeof window !== 'undefined' ? initializeFirebase() : { firebaseApp: undefined, auth: undefined, firestore: undefined };
  const [firebaseInstances] = useState<FirebaseContextValue>({
    firebaseApp: initial.firebaseApp as any,
    auth: initial.auth as any,
    firestore: initial.firestore as any,
  });

  // Register service worker (fire-and-forget, non-blocking)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js').then((reg) => {
      if (!reg) {
        navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // ── PERF: Removed duplicate initMessaging() call ──
  // FCM foreground listener is already in NotificationContext

  return (
    <FirebaseContext.Provider value={firebaseInstances}>
      <FirebaseErrorListener />
      <NetworkErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => useContext(FirebaseContext);
export const useFirebaseApp = () => {
  const ctx = useContext(FirebaseContext);
  if (ctx?.firebaseApp) return ctx.firebaseApp;
  if (typeof window !== 'undefined') return initializeFirebase().firebaseApp;
  return undefined;
};
export const useAuth = () => {
  const ctx = useContext(FirebaseContext);
  if (ctx?.auth) return ctx.auth;
  if (typeof window !== 'undefined') return initializeFirebase().auth;
  return undefined;
};
export const useFirestore = () => {
  const ctx = useContext(FirebaseContext);
  if (ctx?.firestore) return ctx.firestore;
  if (typeof window !== 'undefined') return initializeFirebase().firestore;
  return undefined;
};
