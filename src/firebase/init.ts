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

  const apps = getApps();
  // If no app is present, initialize a new one. Otherwise reuse the first app.
  if (!apps.length && !firebaseApp) {
    const app = initializeApp(firebaseConfig);
    const a = getAuth(app);
    // Ensure auth persistence is explicitly set to LOCAL so sessions survive:
    // - Page close/reopen
    // - App background/foreground
    // - Phone restart
    // This persists tokens in browser local storage with 30-day expiry
    setPersistence(a, browserLocalPersistence).catch((e) => {
      // If local persistence fails, log warning
      console.warn('[Firebase] Local persistence failed (non-fatal):', e);
    });
    const fs = getFirestore(app);

    // assign to module-level variables after local initialization to keep types narrow
    firebaseApp = app;
    auth = a;
    firestore = fs;
  } else {
    // Reuse existing app instance if available.
    const app = apps[0] ?? firebaseApp;
    if (app && !firebaseApp) firebaseApp = app;
    if (firebaseApp && !auth) auth = getAuth(firebaseApp as any);
    if (firebaseApp && !firestore) firestore = getFirestore(firebaseApp as any);
  }
  // In development only, expose these instances to `window` for easy debugging in the browser console.
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).firebaseApp = firebaseApp;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).firebaseAuth = auth;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).firebaseFirestore = firestore;
  }

  console.debug('Firebase initialized:', { app: firebaseApp, authAvailable: !!auth, firestoreAvailable: !!firestore });

  return { firebaseApp, auth, firestore };
}

export { initializeFirebase };
