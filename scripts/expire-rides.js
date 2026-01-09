/**
 * scripts/expire-rides.js
 *
 * Simple admin script that marks rides as 'expired' if their departureTime <= now
 * Usage:
 *  - Local emulator: set FIRESTORE_EMULATOR_HOST and POINT to your emulator endpoint and run
 *  - Production: ensure GOOGLE_APPLICATION_CREDENTIALS is set and run
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function expireRides() {
  const now = admin.firestore.Timestamp.now();
  console.log('Running expire job at', now.toDate().toISOString());

  // Iterate universities (top-level collection)
  const univsSnap = await db.collection('universities').listDocuments();
  let totalUpdated = 0;

  for (const univDocRef of univsSnap) {
    const ridesQuery = db.collection(univDocRef.path + '/rides')
      .where('status', '==', 'active')
      .where('departureTime', '<=', now)
      .limit(500);

    const ridesSnap = await ridesQuery.get();
    if (ridesSnap.empty) continue;

    const batch = db.batch();
    ridesSnap.forEach((doc) => {
      batch.update(doc.ref, { status: 'expired', expiredAt: now });
      totalUpdated++;
    });

    await batch.commit();
    console.log(`Updated ${ridesSnap.size} rides for university: ${univDocRef.id}`);
  }

  console.log('Expire job finished. Total updated:', totalUpdated);
}

if (require.main === module) {
  expireRides().catch((err) => {
    console.error('Expire job failed:', err);
    process.exitCode = 1;
  });
}

module.exports = { expireRides };
