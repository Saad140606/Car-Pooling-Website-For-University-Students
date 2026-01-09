// scripts/set-admin.js
// Usage: set the env var GOOGLE_APPLICATION_CREDENTIALS to your service account JSON
// then run: node scripts/set-admin.js <USER_UID> [true|false]
const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();
const uid = process.argv[2];
const arg = process.argv[3]; // either an email or the keyword 'remove'

if (!uid) {
  console.error('Usage: node scripts/set-admin.js <ADMIN_UID> [email|remove]');
  process.exit(1);
}

(async () => {
  const ref = db.collection('admins').doc(uid);
  if (arg === 'remove') {
    await ref.delete().catch(() => {});
    console.log(`Removed admins/${uid}`);
  } else {
    const email = arg || null;
    await ref.set({ email, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    console.log(`Created admins/${uid}${email ? ' (' + email + ')' : ''}`);
  }
  process.exit(0);
})().catch((e) => {
  console.error('Failed to modify admins collection:', e);
  process.exit(1);
});
