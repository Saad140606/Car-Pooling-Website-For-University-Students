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
  
  // Validate Firebase config has required values
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('[Firebase] Missing required config values. Check environment variables:', {
      hasApiKey: !!firebaseConfig.apiKey,
      hasProjectId: !!firebaseConfig.projectId,
      hasAuthDomain: !!firebaseConfig.authDomain,
    });
  }
  
  if (!getApps().length && !app) {
    app = initApp(firebaseConfig);
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    
    firestore = getFirestore(app);
    
    // Configure Firestore settings
    if (firestore) {
      try {
        // Enable offline persistence for better resilience
        // This helps with network timeouts
        const settings = {
          cacheSizeBytes: 50 * 1024 * 1024, // 50MB cache
        };
        
        // Try to enable persistence (fails gracefully if not supported)
        import('firebase/firestore').then((m: any) => {
          try {
            if (typeof m.enableIndexedDbPersistence === 'function') {
              m.enableIndexedDbPersistence(firestore!).catch((err: any) => {
                if (err?.code === 'failed-precondition') {
                  console.warn('[Firebase] Multiple tabs open, persistence disabled');
                } else if (err?.code === 'unimplemented') {
                  console.warn('[Firebase] Browser does not support persistence');
                }
              });
            }
          } catch (error) {
            console.debug('[Firebase] Persistence setup skipped:', error);
          }
        }).catch(() => {});
      } catch (error) {
        console.debug('[Firebase] Could not configure persistence:', error);
      }
      
      // Enable logging in development for debugging (optional)
      if (process.env.NODE_ENV === 'development') {
        import('firebase/firestore').then((m: any) => {
          try {
            if (typeof m.enableLogging === 'function') m.enableLogging(true);
          } catch (_) {}
        }).catch(() => {});
      }
    }
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
