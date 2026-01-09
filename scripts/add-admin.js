// scripts/add-admin.js
// Usage:
//  node scripts/add-admin.js --email user@example.com
//  node scripts/add-admin.js --uid <UID>

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

async function initAdmin() {
  if (admin.apps && admin.apps.length) return admin;

  const svc = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (svc) {
    try {
      const parsed = JSON.parse(svc);
      admin.initializeApp({ credential: admin.credential.cert(parsed) });
      console.log('[add-admin] initialized from FIREBASE_SERVICE_ACCOUNT_JSON');
      return admin;
    } catch (e) {
      console.warn('[add-admin] failed to parse FIREBASE_SERVICE_ACCOUNT_JSON', e);
    }
  }

  // try local file
  const p = path.resolve(process.cwd(), 'src', 'firebase', 'serviceAccount.json');
  if (fs.existsSync(p)) {
    try {
      const raw = fs.readFileSync(p, 'utf8');
      const parsed = JSON.parse(raw);
      admin.initializeApp({ credential: admin.credential.cert(parsed) });
      console.log('[add-admin] initialized from src/firebase/serviceAccount.json');
      return admin;
    } catch (e) {
      console.warn('[add-admin] failed to parse local serviceAccount.json', e);
    }
  }

  // fallback to ADC
  try {
    admin.initializeApp();
    console.log('[add-admin] initialized with application default credentials');
    return admin;
  } catch (e) {
    console.error('[add-admin] failed to initialize firebase-admin', e);
    process.exit(1);
  }
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email' && argv[i+1]) { out.email = argv[i+1]; i++; }
    else if (a === '--uid' && argv[i+1]) { out.uid = argv[i+1]; i++; }
    else if (a === '--help') { out.help = true; }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  if (args.help || (!args.uid && !args.email)) {
    console.log('Usage: node scripts/add-admin.js --email user@example.com   OR   --uid <UID>');
    process.exit(0);
  }

  await initAdmin();
  const auth = admin.auth();
  const db = admin.firestore();

  let uid = args.uid;
  if (!uid && args.email) {
    try {
      const user = await auth.getUserByEmail(args.email);
      uid = user.uid;
      console.log('[add-admin] resolved email to uid=', uid);
    } catch (e) {
      console.error('[add-admin] failed to find user by email:', e.message || e);
      process.exit(1);
    }
  }

  if (!uid) {
    console.error('No uid available');
    process.exit(1);
  }

  try {
    await db.collection('admins').doc(uid).set({ createdAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log('[add-admin] created admins/' + uid);
  } catch (e) {
    console.error('[add-admin] failed to write admins doc:', e);
    process.exit(1);
  }

  process.exit(0);
}

main();
