// src/firebase/provider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { initializeFirebase } from './init';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { initMessaging } from './messaging';

interface FirebaseContextValue {
  firebaseApp: FirebaseApp | undefined;
  auth: Auth | undefined;
  firestore: Firestore | undefined;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  // Initialize synchronously during render on the client so consuming components
  // (like auth forms) can access `auth`/`firestore` immediately and avoid
  // race conditions with `useEffect` initialization.
  const initial = typeof window !== 'undefined' ? initializeFirebase() : { firebaseApp: undefined, auth: undefined, firestore: undefined };
  const [firebaseInstances] = useState<FirebaseContextValue>({
    firebaseApp: initial.firebaseApp as any,
    auth: initial.auth as any,
    firestore: initial.firestore as any,
  });

  // Register service worker for push notifications if available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Register a minimal firebase messaging service worker if present in /public
    navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js').then((reg) => {
      if (!reg) {
        navigator.serviceWorker.register('/firebase-messaging-sw.js').then(() => {
          console.debug('Registered firebase-messaging-sw.js');
        }).catch((e) => console.debug('SW registration failed (optional):', e));
      } else {
        console.debug('firebase-messaging-sw.js already registered');
      }
    }).catch((e) => {
      console.debug('SW getRegistration failed:', e);
    });
  }, []);

  // Initialize foreground messaging listener
  useEffect(() => {
    try {
      initMessaging();
    } catch (e) {
      console.debug('initMessaging failed (non-fatal):', e);
    }
  }, []);

  return (
    <FirebaseContext.Provider value={firebaseInstances}>
      <FirebaseErrorListener />
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
