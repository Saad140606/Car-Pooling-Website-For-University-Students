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


/**
 * Firestore trigger: when a call document is created under
 * `universities/{univ}/calls/{chatId}`, send an FCM push notification to the
 * other chat participant(s) so they are alerted even if not currently in the chat.
 */
export const notifyOnCall = functions.firestore
  .document('universities/{univ}/calls/{callId}')
  .onCreate(async (snap, ctx) => {
    try {
      const data = snap.data();
      const univ = ctx.params.univ as string;
      const callId = ctx.params.callId as string; // chatId used as call doc id

      // read chat meta to determine participants
      const chatRef = db.doc(`universities/${univ}/chats/${callId}`);
      const chatSnap = await chatRef.get();
      if (!chatSnap.exists) return null;
      const chat = chatSnap.data() as any;

      // caller uid saved on the call doc (who initiated)
      const caller = data.caller as string | undefined;
      const mode = data.mode as string | undefined; // 'audio'|'video'

      // collect target UIDs (participants excluding caller)
      const participants: string[] = [];
      if (Array.isArray(chat.participants)) participants.push(...chat.participants.filter((p: string) => p !== caller));
      if (chat.passengerId && chat.passengerId !== caller) participants.push(chat.passengerId);
      if (chat.providerId && chat.providerId !== caller) participants.push(chat.providerId);

      // dedupe
      const targets = Array.from(new Set(participants));
      if (targets.length === 0) return null;

      // gather FCM tokens for each target from users/{uid}/fcmTokens
      const tokens: string[] = [];
      for (const uid of targets) {
        const tSnap = await db.collection(`users/${uid}/fcmTokens`).get();
        tSnap.forEach(doc => {
          const d = doc.data(); if (d && d.token) tokens.push(d.token as string);
        });
      }

      if (tokens.length === 0) return null;

      const title = 'Incoming call';
      const body = mode === 'video' ? 'Video call — tap to join' : 'Audio call — tap to join';

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: { title, body },
        data: {
          callId: callId,
          chatId: callId,
          univ,
          mode: mode || 'audio',
          caller: caller || ''
        },
        webpush: {
          fcmOptions: {
            // deep link into the app when user taps the notification
            link: `/dashboard/chats/${callId}`
          }
        }
      };

      const resp = await admin.messaging().sendMulticast(message);
      console.log('notifyOnCall sent', resp.successCount, 'messages, failures:', resp.failureCount);
    } catch (err) {
      console.error('notifyOnCall error', err);
    }
    return null;
  });
