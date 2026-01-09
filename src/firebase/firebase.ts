// Lightweight client Firebase helper. Ensures a single initialized app and
// exports ready-to-use `auth` and `firestore` instances.
import { initializeApp as initApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

let app: ReturnType<typeof initApp> | undefined;
let auth: ReturnType<typeof getAuth> | undefined;
let firestore: ReturnType<typeof getFirestore> | undefined;

export function initializeFirebaseClient() {
  if (typeof window === 'undefined') return { app, auth, firestore };
  if (!getApps().length && !app) {
    app = initApp(firebaseConfig);
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    firestore = getFirestore(app);
  } else if (!app) {
    // reuse
    app = getApps()[0] as any;
    auth = getAuth(app as any);
    firestore = getFirestore(app as any);
  }

  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    // Expose for local debugging (non-production only)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).firebaseApp = app;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).firebaseAuth = auth;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).firebaseFirestore = firestore;
  }

  return { app, auth, firestore };
}

export function getClientAuth() {
  const inst = initializeFirebaseClient();
  return inst.auth;
}

export function getClientFirestore() {
  const inst = initializeFirebaseClient();
  return inst.firestore;
}

export default initializeFirebaseClient;
