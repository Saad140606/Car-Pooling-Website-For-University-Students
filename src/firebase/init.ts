// src/firebase/init.ts
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
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
    
    // Use the modern persistent cache API instead of deprecated enableIndexedDbPersistence
    let fs: ReturnType<typeof getFirestore>;
    try {
      fs = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch (e) {
      // If Firestore was already initialized (e.g. by another module), fall back to getFirestore
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
