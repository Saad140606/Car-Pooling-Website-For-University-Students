/*
Local admin script to remove orphaned chat documents that reference non-existent bookings.
Run with: FIREBASE_CONFIG or application default credentials available.
Example (emulator):
  export FIRESTORE_EMULATOR_HOST=localhost:8080
  node scripts/cleanup-orphan-chats.js

CAUTION: This will permanently delete chat docs and their messages. Review before running.
*/

const admin = require('firebase-admin');

try {
  admin.initializeApp();
} catch (e) {
  // already initialized
}

const db = admin.firestore();

async function deleteChatAndMessages(chatRef) {
  const chatId = chatRef.id;
  console.log('Deleting chat', chatRef.path);
  const msgsRef = chatRef.collection('messages');
  const msgsSnap = await msgsRef.get();
  const batchLimit = 400;
  const docs = msgsSnap.docs;
  for (let i = 0; i < docs.length; i += batchLimit) {
    const batch = db.batch();
    docs.slice(i, i + batchLimit).forEach(d => batch.delete(d.ref));
    batch.delete(chatRef);
    await batch.commit();
  }
}

(async () => {
  try {
    const univDocs = await db.collection('universities').listDocuments();
    for (const univRef of univDocs) {
      const univ = univRef.id;
      console.log('Checking university', univ);
      const chatsSnap = await db.collection(`universities/${univ}/chats`).get();
      for (const c of chatsSnap.docs) {
        const data = c.data();
        const bookingId = data?.bookingId;
        if (bookingId) {
          const bSnap = await db.doc(`universities/${univ}/bookings/${bookingId}`).get();
          if (!bSnap.exists) {
            console.log(`Orphan chat found: ${c.id} (booking ${bookingId} not found)`);
            await deleteChatAndMessages(c.ref);
          }
        }
      }
    }

    // Also scan top-level legacy chats
    const legacySnap = await db.collection('chats').get();
    for (const c of legacySnap.docs) {
      const data = c.data();
      const bookingId = data?.bookingId;
      if (bookingId) {
        const bSnap = await db.doc(`universities/${data?.univ || 'fast'}/bookings/${bookingId}`).get();
        if (!bSnap.exists) {
          console.log(`Orphan legacy chat found: ${c.id} (booking ${bookingId} not found)`);
          await deleteChatAndMessages(c.ref);
        }
      }
    }

    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error('Error', err);
    process.exit(1);
  }
})();
