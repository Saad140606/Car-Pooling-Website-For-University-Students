import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Note: admin.initializeApp() should already be called in index.ts; when
// compiled together the Admin SDK will be initialized once by index.ts.

const db = admin.firestore();

export const cleanupChatsAndCallsOnRideUpdate = functions.firestore
  .document('universities/{univ}/rides/{rideId}')
  .onUpdate(async (change, ctx) => {
    const after = change.after.data();
    if (!after) return null;

    const newStatus = after.status;
    if (newStatus !== 'completed' && newStatus !== 'cancelled' && newStatus !== 'expired') return null;

    const rideId = ctx.params.rideId as string;
    const univId = ctx.params.univ as string;
    console.log(`(cleanup) Ride ${rideId} marked ${newStatus}, cleaning up chats and calls...`);

    try {
      // University-scoped chats
      const uniChatsSnap = await db.collection(`universities/${univId}/chats`).where('rideId', '==', rideId).get();
      for (const c of uniChatsSnap.docs) {
        const chatId = c.id;
        // delete messages
        const msgsSnap = await db.collection(`universities/${univId}/chats/${chatId}/messages`).get();
        const batch = db.batch();
        msgsSnap.forEach(m => batch.delete(m.ref));
        batch.delete(db.doc(`universities/${univId}/chats/${chatId}`));
        await batch.commit();
        console.log(`(cleanup) Deleted university chat ${chatId} and ${msgsSnap.size} messages`);

        // delete signaling call doc and candidates
        try {
          const callDocRef = db.doc(`universities/${univId}/calls/${chatId}`);
          const callSnap = await callDocRef.get();
          if (callSnap.exists) {
            const callerCands = await db.collection(`universities/${univId}/calls/${chatId}/callerCandidates`).get();
            const calleeCands = await db.collection(`universities/${univId}/calls/${chatId}/calleeCandidates`).get();
            const b2 = db.batch();
            callerCands.forEach(d => b2.delete(d.ref));
            calleeCands.forEach(d => b2.delete(d.ref));
            b2.delete(callDocRef);
            await b2.commit();
            console.log(`(cleanup) Deleted call doc and ${callerCands.size + calleeCands.size} candidate docs for chat ${chatId}`);
          }
        } catch (err) {
          console.warn('(cleanup) Failed to clean up call docs for chat', chatId, err);
        }
      }

      // Legacy top-level chats
      const legacyChatsSnap = await db.collection('chats').where('rideId', '==', rideId).get();
      for (const c of legacyChatsSnap.docs) {
        const chatId = c.id;
        const msgsSnap = await db.collection(`chats/${chatId}/messages`).get();
        const batch = db.batch();
        msgsSnap.forEach(m => batch.delete(m.ref));
        batch.delete(db.doc(`chats/${chatId}`));
        await batch.commit();
        console.log(`(cleanup) Deleted legacy chat ${chatId} and ${msgsSnap.size} messages`);

        try {
          const callDocRef = db.doc(`calls/${chatId}`);
          const callSnap = await callDocRef.get();
          if (callSnap.exists) {
            const callerCands = await db.collection(`calls/${chatId}/callerCandidates`).get();
            const calleeCands = await db.collection(`calls/${chatId}/calleeCandidates`).get();
            const b2 = db.batch();
            callerCands.forEach(d => b2.delete(d.ref));
            calleeCands.forEach(d => b2.delete(d.ref));
            b2.delete(callDocRef);
            await b2.commit();
            console.log(`(cleanup) Deleted top-level call ${chatId} and ${callerCands.size + calleeCands.size} candidate docs`);
          }
        } catch (err) {
          console.warn('(cleanup) Failed to clean up top-level call docs for chat', chatId, err);
        }
      }
    } catch (err) {
      console.error('(cleanup) Error while cleaning chats/calls for ride', rideId, err);
    }

    return null;
  });
