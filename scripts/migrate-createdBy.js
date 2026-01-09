/*
Migration script: backfill createdBy on rides from driverId when missing.
Usage:
  node scripts/migrate-createdBy.js           # dry-run (no writes)
  node scripts/migrate-createdBy.js --apply   # perform updates
  node scripts/migrate-createdBy.js --univ fast --apply  # limit to one university

This uses the Firebase Admin SDK and is intended to be run against the emulator
or a production project with appropriate admin credentials.
*/

const adminPkg = require('firebase-admin');
const argv = require('minimist')(process.argv.slice(2));

const APPLY = !!argv.apply;
const TARGET_UNIV = argv.univ || argv.university || null;

async function main() {
  if (!adminPkg || !adminPkg.initializeApp) {
    console.error('firebase-admin not installed. Run: npm i firebase-admin --save-dev');
    process.exit(1);
  }

  // If running against an emulator, make sure FIRESTORE_EMULATOR_HOST is set.
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.warn('No FIRESTORE_EMULATOR_HOST detected. This will run against the real Firestore.');
    console.warn('Set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 to target the emulator.');
  }

  adminPkg.initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'demo-project' });
  const db = adminPkg.firestore();

  // If an emulator host was provided (env or arg), apply settings to the client
  const emulatorHost = argv.emulatorHost || process.env.FIRESTORE_EMULATOR_HOST;
  if (emulatorHost) {
    const hostValue = emulatorHost.includes(':') ? emulatorHost : `${emulatorHost}:8080`;
    console.log('Connecting to Firestore emulator at', hostValue);
    db.settings({ host: hostValue, ssl: false });
  }

  const universities = [];
  if (TARGET_UNIV) {
    universities.push(TARGET_UNIV);
  } else {
    // List top-level collections and find 'universities'
    const cols = await db.listCollections();
    const univCol = cols.find(c => c.id === 'universities');
    if (!univCol) {
      console.error('No top-level `universities` collection found. Nothing to migrate.');
      process.exit(1);
    }

    // list university documents
    const docs = await univCol.listDocuments();
    for (const d of docs) {
      universities.push(d.id);
    }
  }

  console.log(`Universities to scan: ${universities.join(', ')}`);

  let totalChecked = 0;
  let totalUpdated = 0;
  const samples = [];

  for (const univ of universities) {
    console.log(`Scanning universities/${univ}/rides ...`);
    const ridesSnap = await db.collection('universities').doc(univ).collection('rides').get();
    console.log(`  found ${ridesSnap.size} rides`);
    for (const doc of ridesSnap.docs) {
      totalChecked++;
      const data = doc.data();
      if (!('createdBy' in data) || data.createdBy === null || data.createdBy === '') {
        if (data.driverId) {
          samples.push({ id: doc.id, university: univ, driverId: data.driverId });
          console.log(`  WILL UPDATE: ${univ}/rides/${doc.id} -> createdBy = ${data.driverId}`);
          if (APPLY) {
            await doc.ref.update({ createdBy: data.driverId });
            totalUpdated++;
            console.log(`    updated`);
          }
        } else {
          console.log(`  SKIP (no driverId): ${univ}/rides/${doc.id}`);
        }
      }
    }
  }

  console.log('Migration complete. Summary:');
  console.log(`  total rides scanned: ${totalChecked}`);
  console.log(`  total updates performed: ${totalUpdated}`);
  if (samples.length > 0) console.log('  example entries to update (first 10):', samples.slice(0, 10));

  if (!APPLY) {
    console.log('\nDry-run complete. Run with --apply to perform updates.');
  }

  process.exit(0);
}

main().catch((err) => { console.error('Migration failed', err); process.exit(1); });
