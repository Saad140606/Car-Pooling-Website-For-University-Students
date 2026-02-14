// src/firebase/init.ts
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

let firebaseApp: ReturnType<typeof initializeApp> | undefined;
let auth: ReturnType<typeof getAuth> | undefined;
let firestore: ReturnType<typeof getFirestore> | undefined;

function initializeFirebase(): { firebaseApp?: ReturnType<typeof initializeApp>; auth?: ReturnType<typeof getAuth>; firestore?: ReturnType<typeof getFirestore> } {
  if (typeof window === 'undefined') {
    return { firebaseApp, auth, firestore };
  }

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('[Firebase] Missing required config.');
  }

  const apps = getApps();
  if (!apps.length && !firebaseApp) {
    const app = initializeApp(firebaseConfig);
    const a = getAuth(app);
    // Set persistence (fire-and-forget, non-blocking)
    setPersistence(a, browserLocalPersistence).catch(() => {});
    
    // Initialize Firestore and attempt to enable persistence if available
    let fs: ReturnType<typeof getFirestore>;
    try {
      fs = getFirestore(app);
      // Try enabling persistence via dynamic import if supported
      import('firebase/firestore').then((m: any) => {
        try {
          if (typeof m.enableIndexedDbPersistence === 'function') {
            m.enableIndexedDbPersistence(fs).catch((err: any) => {
              if (err?.code === 'failed-precondition') {
                console.warn('[Firebase] Multiple tabs open, persistence disabled');
              } else if (err?.code === 'unimplemented') {
                console.warn('[Firebase] Browser does not support persistence');
              }
            });
          }
        } catch (_) {}
      }).catch(() => {});
    } catch (e) {
      // If any error, fall back to getFirestore
      fs = getFirestore(app);
    }

    firebaseApp = app;
    auth = a;
    firestore = fs;
  } else {
    const app = apps[0] ?? firebaseApp;
    if (app && !firebaseApp) firebaseApp = app;
    if (firebaseApp && !auth) auth = getAuth(firebaseApp as any);
    if (firebaseApp && !firestore) firestore = getFirestore(firebaseApp as any);
  }

  return { firebaseApp, auth, firestore };
}

export { initializeFirebase };
