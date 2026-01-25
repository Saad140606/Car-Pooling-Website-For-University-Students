import admin from 'firebase-admin';

// Initialize firebase-admin once using either the application default
// credentials or JSON provided in environment.
function initAdmin() {
  if (admin.apps && admin.apps.length) return admin;

  // If a service account JSON is provided via env (as string), prefer it.
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (svc) {
    try {
      const parsed = JSON.parse(svc);
      admin.initializeApp({ credential: admin.credential.cert(parsed) });
      return admin;
    } catch (e) {
      // avoid logging raw secret material
    }
  }

  // Try loading a local service account file (useful for local dev)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    const path = require('path');
    const p = path.resolve(process.cwd(), 'src', 'firebase', 'serviceAccount.json');
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        admin.initializeApp({ credential: admin.credential.cert(parsed) });
        return admin;
      } catch (e) {
        // suppress detailed parsing errors to avoid leaking file contents
      }
    }
  } catch (e) {
    // ignore fs errors in environments where require('fs') isn't available
  }

  // Fall back to Application Default Credentials (e.g., GOOGLE_APPLICATION_CREDENTIALS)
  try {
    admin.initializeApp();
  } catch (e) {
    // initialization may fail if no ADC available; consumers should handle missing admin SDK
  }
  return admin;
}

const adminApp = initAdmin();

// Convenience exports for Firestore/Auth when admin SDK is available.
// These may be undefined if initialization failed (e.g., missing creds), so
// callers should handle that case when used outside controlled environments.
export const adminDb = (() => {
  try { return adminApp.firestore(); } catch (_) { return undefined as any; }
})();

export const adminAuth = (() => {
  try { return adminApp.auth(); } catch (_) { return undefined as any; }
})();

export default adminApp;
