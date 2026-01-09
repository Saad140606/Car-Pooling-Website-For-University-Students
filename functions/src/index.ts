import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize the admin SDK
admin.initializeApp();

const db = admin.firestore();

/**
 * Scheduled function that marks past rides as 'expired'.
 * Runs every 5 minutes by default.
 */
export const expireRides = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    console.log('Expire job running at', now.toDate().toISOString());

    const univDocs = await db.collection('universities').listDocuments();
    let totalUpdated = 0;

    for (const univDocRef of univDocs) {
      const q = db.collection(`${univDocRef.path}/rides`)
        .where('status', '==', 'active')
        .where('departureTime', '<=', now)
        .limit(500);

      const snap = await q.get();
      if (snap.empty) continue;

      const batch = db.batch();
      snap.forEach((doc) => {
        batch.update(doc.ref, { status: 'expired', expiredAt: now });
        totalUpdated++;
      });

      await batch.commit();
      console.log(`Updated ${snap.size} rides for ${univDocRef.id}`);
    }

    console.log('Expire job finished. Total updated:', totalUpdated);
    return null;
  });

/**
 * Firestore trigger: when a ride's status becomes 'completed' or 'cancelled',
 * delete related chat rooms and their messages to keep chats temporary.
 */
export const cleanupChatsOnRideUpdate = functions.firestore
  .document('universities/{univ}/rides/{rideId}')
  .onUpdate(async (change, ctx) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!after) return null;

    const newStatus = after.status;
    if (newStatus !== 'completed' && newStatus !== 'cancelled' && newStatus !== 'expired') return null;

    const db = admin.firestore();
    const rideId = ctx.params.rideId;
    console.log(`Ride ${rideId} marked ${newStatus}, cleaning up chats...`);

    // Delete chats under the same university first (newer shape)
    const univId = ctx.params.univ as string;
    const uniChatsSnap = await db.collection(`universities/${univId}/chats`).where('rideId', '==', rideId).get();
    for (const c of uniChatsSnap.docs) {
      const chatId = c.id;
      const msgsSnap = await db.collection(`universities/${univId}/chats/${chatId}/messages`).get();
      const batch = db.batch();
      msgsSnap.forEach(m => batch.delete(m.ref));
      batch.delete(db.doc(`universities/${univId}/chats/${chatId}`));
      await batch.commit();
      console.log(`Deleted university-scoped chat ${chatId} and ${msgsSnap.size} messages`);
    }

    // Also clean up any legacy top-level chats that reference this ride
    const legacyChatsSnap = await db.collection('chats').where('rideId', '==', rideId).get();
    for (const c of legacyChatsSnap.docs) {
      const chatId = c.id;
      const msgsSnap = await db.collection(`chats/${chatId}/messages`).get();
      const batch = db.batch();
      msgsSnap.forEach(m => batch.delete(m.ref));
      batch.delete(db.doc(`chats/${chatId}`));
      await batch.commit();
      console.log(`Deleted legacy chat ${chatId} and ${msgsSnap.size} messages`);
    }

    return null;
  });
