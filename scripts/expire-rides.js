/**
 * scripts/expire-rides.js
 *
 * Admin script that:
 * 1. Marks rides as 'expired' if their departureTime <= now
 * 2. Deletes rides (and related data) if they are 12+ hours past departureTime
 * 
 * Usage:
 *  - Local emulator: set FIRESTORE_EMULATOR_HOST to your emulator endpoint and run
 *  - Production: ensure GOOGLE_APPLICATION_CREDENTIALS is set and run
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

if (!admin.apps.length) {
  // Try to initialize from environment variable or use application default credentials
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✓ Initialized Firebase Admin SDK from FIREBASE_SERVICE_ACCOUNT_JSON');
    } catch (err) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
      process.exit(1);
    }
  } else {
    // Use default credentials
    admin.initializeApp();
    console.log('✓ Initialized Firebase Admin SDK with default credentials');
  }
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

async function deleteExpiredRides() {
  const now = admin.firestore.Timestamp.now();
  // 12 hours in milliseconds
  const twelveHoursMs = 12 * 60 * 60 * 1000;
  const cutoffDate = new Date(now.toDate().getTime() - twelveHoursMs);
  const cutoff = admin.firestore.Timestamp.fromDate(cutoffDate);

  console.log('Running delete expired rides job at', now.toDate().toISOString());
  console.log('Deleting rides with departureTime <=', cutoff.toDate().toISOString());

  const univsSnap = await db.collection('universities').listDocuments();
  let totalDeleted = 0;

  for (const univDocRef of univsSnap) {
    const univId = univDocRef.id;
    
    // Find expired rides that are 12+ hours past departure
    const ridesQuery = db.collection(`${univDocRef.path}/rides`)
      .where('status', '==', 'expired')
      .where('departureTime', '<=', cutoff)
      .limit(500);

    const ridesSnap = await ridesQuery.get();
    if (ridesSnap.empty) {
      console.log(`No expired rides to delete for university: ${univId}`);
      continue;
    }

    console.log(`Found ${ridesSnap.size} expired rides to delete for university: ${univId}`);

    for (const rideDoc of ridesSnap.docs) {
      const rideId = rideDoc.id;
      console.log(`Deleting ride ${rideId}...`);

      try {
        // Delete bookings
        const bookingsSnap = await db.collection(`universities/${univId}/bookings`)
          .where('rideId', '==', rideId)
          .get();
        
        if (!bookingsSnap.empty) {
          const batch = db.batch();
          bookingsSnap.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          console.log(`  Deleted ${bookingsSnap.size} bookings`);
        }

        // Delete requests subcollection
        const reqsSnap = await db.collection(`universities/${univId}/rides/${rideId}/requests`).get();
        if (!reqsSnap.empty) {
          const batch = db.batch();
          reqsSnap.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          console.log(`  Deleted ${reqsSnap.size} requests`);
        }

        // Delete chats and messages
        const chatsSnap = await db.collection(`universities/${univId}/chats`)
          .where('rideId', '==', rideId)
          .get();
        
        if (!chatsSnap.empty) {
          for (const chatDoc of chatsSnap.docs) {
            const chatId = chatDoc.id;
            const messagesSnap = await db.collection(`universities/${univId}/chats/${chatId}/messages`).get();
            
            if (!messagesSnap.empty) {
              const batch = db.batch();
              messagesSnap.forEach((m) => batch.delete(m.ref));
              await batch.commit();
            }
            
            // Delete call signaling docs
            try {
              const callerCands = await db.collection(`universities/${univId}/calls/${chatId}/callerCandidates`).get();
              const calleeCands = await db.collection(`universities/${univId}/calls/${chatId}/calleeCandidates`).get();
              
              if (!callerCands.empty || !calleeCands.empty) {
                const batch = db.batch();
                callerCands.forEach((d) => batch.delete(d.ref));
                calleeCands.forEach((d) => batch.delete(d.ref));
                await batch.commit();
              }
              
              await db.doc(`universities/${univId}/calls/${chatId}`).delete();
            } catch (err) {
              console.warn(`  Warning: Failed to delete call docs for chat ${chatId}:`, err.message);
            }
            
            await chatDoc.ref.delete();
          }
          console.log(`  Deleted ${chatsSnap.size} chats and related data`);
        }

        // Finally delete the ride itself
        await rideDoc.ref.delete();
        totalDeleted++;
        console.log(`  ✓ Ride ${rideId} deleted successfully`);
      } catch (err) {
        console.error(`  ✗ Error deleting ride ${rideId}:`, err.message);
      }
    }
  }

  console.log('Delete job finished. Total rides deleted:', totalDeleted);
}

async function runAll() {
  console.log('=== Starting Ride Cleanup ===\n');
  
  // First expire rides that have passed their departure time
  await expireRides();
  
  console.log('\n=== Starting Deletion of Old Expired Rides ===\n');
  
  // Then delete rides that are 12+ hours past departure
  await deleteExpiredRides();
  
  console.log('\n=== Cleanup Complete ===');
}

if (require.main === module) {
  runAll().catch((err) => {
    console.error('Cleanup job failed:', err);
    process.exitCode = 1;
  });
}

module.exports = { expireRides, deleteExpiredRides, runAll };
