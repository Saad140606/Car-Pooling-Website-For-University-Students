/**
 * scripts/expire-rides-emulator-test.js
 * Quick test to run against the Firestore emulator:
 *  - Start the emulator: `firebase emulators:start --only firestore`
 *  - Run this script: `node scripts/expire-rides-emulator-test.js`
 */

const admin = require('firebase-admin');
const { expireRides } = require('./expire-rides');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test-project' });
}

const db = admin.firestore();

async function seedAndRun() {
  const univRef = db.collection('universities').doc('test-univ');
  await univRef.set({ name: 'Test University' });

  // create a ride in the past
  const pastTs = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60)); // 1 hour ago
  await db.collection('universities/test-univ/rides').add({
    from: 'A',
    to: 'B',
    driverId: 'driver-1',
    status: 'active',
    departureTime: pastTs,
    createdAt: admin.firestore.Timestamp.now(),
  });

  console.log('Seeded test ride. Running expire job...');
  await expireRides();

  const snap = await db.collection('universities/test-univ/rides').get();
  snap.forEach((d) => console.log('Ride:', d.id, d.data()));
}

seedAndRun().catch((err) => {
  console.error(err);
  process.exit(1);
});
