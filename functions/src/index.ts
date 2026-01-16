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
   * Booking deleted -> clean up associated chat and messages (best-effort).
   * This ensures when a booking document is removed (for example passenger cancels),
   * any chat created for that booking is also removed to avoid orphaned chat docs.
   */
  export const cleanupChatOnBookingDelete = functions.firestore
    .document('universities/{univ}/bookings/{bookingId}')
    .onDelete(async (snap, ctx) => {
      const univ = ctx.params.univ as string;
      const bookingId = ctx.params.bookingId as string;
      const db = admin.firestore();
      try {
        const chatRef = db.doc(`universities/${univ}/chats/${bookingId}`);
        const chatSnap = await chatRef.get();
        if (chatSnap.exists) {
          const msgsRef = db.collection(`universities/${univ}/chats/${bookingId}/messages`);
          const msgsSnap = await msgsRef.get();
          // delete messages in batches
          const chunkSize = 400;
          const docs = msgsSnap.docs;
          for (let i = 0; i < docs.length; i += chunkSize) {
            const batch = db.batch();
            docs.slice(i, i + chunkSize).forEach(d => batch.delete(d.ref));
            batch.delete(chatRef);
            await batch.commit();
          }
          console.log(`Deleted chat ${bookingId} and ${docs.length} messages for university ${univ}`);
        } else {
          // try legacy top-level chat collection
          const legacyChatRef = db.doc(`chats/${bookingId}`);
          const legacySnap = await legacyChatRef.get();
          if (legacySnap.exists) {
            const msgsSnap = await db.collection(`chats/${bookingId}/messages`).get();
            const chunkSize = 400;
            const docs = msgsSnap.docs;
            for (let i = 0; i < docs.length; i += chunkSize) {
              const batch = db.batch();
              docs.slice(i, i + chunkSize).forEach(d => batch.delete(d.ref));
              batch.delete(legacyChatRef);
              await batch.commit();
            }
            console.log(`Deleted legacy chat ${bookingId} and ${docs.length} messages`);
          }
        }
      } catch (err) {
        console.error('cleanupChatOnBookingDelete error', err);
      }
      return null;
    });

  /**
   * Notification helpers + triggers
   */

  // Helper: get FCM tokens for a user
  async function getUserTokens(uid: string) {
    const tokens: { id: string; token: string }[] = [];
    const docRef = db.doc(`fcm_tokens/${uid}`);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data() as any;
      if (data && data.token) tokens.push({ id: snap.id, token: data.token as string });
    }
    return tokens;
  }

  // Helper: remove a token doc
  async function removeToken(uid: string, tokenDocId: string) {
    try {
      // With the single-token-per-user design we store tokens at `fcm_tokens/{uid}`
      await db.doc(`fcm_tokens/${uid}`).delete();
    } catch (e) {
      console.warn('Failed removing token doc', tokenDocId, e);
    }
  }

  // Helper: create notification doc and send FCM
  async function createAndSendNotification(targetUid: string, payload: { title: string; body: string; data?: any }, opts?: { excludeSender?: string; throttleKey?: string; throttleSeconds?: number }) {
    if (!targetUid) return;

    // Throttle support stored per-user
    if (opts?.throttleKey && opts?.throttleSeconds) {
      const throttleRef = db.doc(`users/${targetUid}/notificationThrottles/${opts.throttleKey}`);
      await db.runTransaction(async (tx) => {
        const tSnap = await tx.get(throttleRef);
        const now = admin.firestore.Timestamp.now();
        if (tSnap.exists) {
          const last = tSnap.data()?.lastSent as admin.firestore.Timestamp | undefined;
          if (last && (now.toMillis() - last.toMillis()) < opts.throttleSeconds! * 1000) {
            // skip sending due to throttle
            return;
          }
        }
        tx.set(throttleRef, { lastSent: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      });
    }

    // create notification in central collection
    try {
      await db.collection('notifications').add({
        userId: targetUid,
        title: payload.title,
        body: payload.body,
        type: payload.data?.type || 'general',
        relatedId: payload.data?.relatedId || payload.data?.bookingId || payload.data?.rideId || null,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.error('Failed to write notification doc', e);
    }

    // send FCM
    const tokens = await getUserTokens(targetUid);
    if (!tokens || tokens.length === 0) return;

    const fcmTokens = tokens.map(t => t.token);
    // exclude sender's tokens if requested
    let finalTokens = fcmTokens;
    if (opts?.excludeSender) {
      // If sender specified, remove any tokens that belong to that sender (best-effort)
      // We assume sender tokens are in their own users/{sender}/fcmTokens, so only relevant if same uid
      if (opts.excludeSender === targetUid) finalTokens = [];
    }

    if (finalTokens.length === 0) return;

    const message: admin.messaging.MulticastMessage = {
      tokens: finalTokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
    };

    try {
      const resp = await admin.messaging().sendMulticast(message);
      // cleanup invalid tokens
      resp.responses.forEach((r, idx) => {
        if (!r.success) {
          const err = r.error;
          const tokenDoc = tokens[idx];
          if (err && (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token')) {
            removeToken(targetUid, tokenDoc.id);
          }
        }
      });
    } catch (err) {
      console.error('FCM send error', err);
    }
  }

  // Helper: send to multiple users
  async function notifyUsers(uids: string[], payload: { title: string; body: string; data?: any }, opts?: { excludeSender?: string; throttleKey?: string; throttleSeconds?: number }) {
    const promises: Promise<any>[] = [];
    const uniq = Array.from(new Set(uids.filter(Boolean)));
    for (const uid of uniq) {
      if (opts?.excludeSender && uid === opts.excludeSender) continue;
      promises.push(createAndSendNotification(uid, payload, opts));
    }
    await Promise.all(promises);
  }

  /**
   * Booking request created under ride requests -> notify ride owner
   */
  export const notifyOnBookingRequest = functions.firestore
    .document('universities/{univ}/rides/{rideId}/requests/{requestId}')
    .onCreate(async (snap, ctx) => {
      const data = snap.data() as any;
      const univ = ctx.params.univ as string;
      const rideId = ctx.params.rideId as string;
      try {
        const rideRef = db.doc(`universities/${univ}/rides/${rideId}`);
        const rideSnap = await rideRef.get();
        if (!rideSnap.exists) return null;
        const ride = rideSnap.data() as any;
        const driverId = ride.driverId as string | undefined;
        const requester = data?.passengerId as string | undefined;
        if (!driverId || driverId === requester) return null;

        await createAndSendNotification(driverId, {
          title: 'New Booking Request 🚗',
          body: 'A student requested to join your ride',
          data: { type: 'booking', bookingId: snap.id, rideId }
        }, { excludeSender: requester });
      } catch (err) {
        console.error('notifyOnBookingRequest error', err);
      }
      return null;
    });

  /**
   * Booking created/updated -> notify passenger about acceptance/rejection
   */
  export const notifyOnBookingCreate = functions.firestore
    .document('universities/{univ}/bookings/{bookingId}')
    .onCreate(async (snap, ctx) => {
      const data = snap.data() as any;
      const univ = ctx.params.univ as string;
      try {
        const passenger = data?.passengerId as string | undefined;
        const driverId = data?.driverId as string | undefined;
        if (passenger) {
          await createAndSendNotification(passenger, {
            title: 'Booking Accepted ✅',
            body: 'Your booking has been accepted',
            data: { type: 'booking', bookingId: snap.id, rideId: data?.rideId }
          }, { excludeSender: driverId });
        }
        // also notify driver that booking was created (optional)
        if (driverId) {
          await createAndSendNotification(driverId, {
            title: 'Booking Confirmed',
            body: 'A seat has been booked on your ride',
            data: { type: 'booking', bookingId: snap.id, rideId: data?.rideId }
          }, { excludeSender: passenger });
        }
      } catch (err) {
        console.error('notifyOnBookingCreate error', err);
      }
      return null;
    });

  export const notifyOnBookingUpdate = functions.firestore
    .document('universities/{univ}/bookings/{bookingId}')
    .onUpdate(async (change, ctx) => {
      const before = change.before.data() as any;
      const after = change.after.data() as any;
      if (!before || !after) return null;
      try {
        if (before.status !== after.status) {
          const passenger = after.passengerId as string | undefined;
          const driver = after.driverId as string | undefined;
          if (after.status === 'accepted' && passenger) {
            await createAndSendNotification(passenger, {
              title: 'Booking Accepted ✅',
              body: 'Your booking request was accepted',
              data: { type: 'booking', bookingId: ctx.params.bookingId, rideId: after.rideId }
            }, { excludeSender: driver });
          } else if (after.status === 'rejected' && passenger) {
            await createAndSendNotification(passenger, {
              title: 'Booking Rejected ❌',
              body: 'Your booking request was rejected',
              data: { type: 'booking', bookingId: ctx.params.bookingId, rideId: after.rideId }
            }, { excludeSender: driver });
          }
        }
      } catch (err) {
        console.error('notifyOnBookingUpdate error', err);
      }
      return null;
    });

  /**
   * Ride updates: cancelled, completed, availableSeats changes -> notify passengers
   */
  export const notifyOnRideUpdate = functions.firestore
    .document('universities/{univ}/rides/{rideId}')
    .onUpdate(async (change, ctx) => {
      const before = change.before.data() as any;
      const after = change.after.data() as any;
      if (!after) return null;
      const univ = ctx.params.univ as string;
      const rideId = ctx.params.rideId as string;
      try {
        // status changes
        if (before.status !== after.status) {
          if (after.status === 'cancelled' || after.status === 'completed' || after.status === 'expired') {
            // notify all accepted passengers
            const bookingsSnap = await db.collection(`universities/${univ}/bookings`).where('rideId', '==', rideId).where('status', '==', 'accepted').get();
            const uids: string[] = [];
            bookingsSnap.forEach(b => { const d = b.data() as any; if (d?.passengerId) uids.push(d.passengerId); });
            const title = after.status === 'cancelled' ? 'Ride Cancelled' : 'Ride Completed';
            const body = after.status === 'cancelled' ? 'A ride you were booked on was cancelled' : 'Your ride has been marked completed';
            await notifyUsers(uids, { title, body, data: { type: 'ride', rideId } });
          }
        }

        // available seats change
        if (before.availableSeats !== after.availableSeats) {
          // notify driver about seats change and accepted passengers
          const driver = after.driverId as string | undefined;
          const bookingsSnap = await db.collection(`universities/${univ}/bookings`).where('rideId', '==', rideId).where('status', '==', 'accepted').get();
          const passengers: string[] = [];
          bookingsSnap.forEach(b => { const d = b.data() as any; if (d?.passengerId) passengers.push(d.passengerId); });
          const title = 'Seat availability updated';
          const body = `Available seats: ${after.availableSeats}`;
          if (driver) await createAndSendNotification(driver, { title, body, data: { type: 'ride', rideId } });
          if (passengers.length > 0) await notifyUsers(passengers, { title, body, data: { type: 'ride', rideId } });
        }
      } catch (err) {
        console.error('notifyOnRideUpdate error', err);
      }
      return null;
    });

  /**
   * Chat created -> notify participants (exclude creator)
   */
  export const notifyOnChatCreate = functions.firestore
    .document('universities/{univ}/chats/{chatId}')
    .onCreate(async (snap, ctx) => {
      const data = snap.data() as any;
      const participants: string[] = Array.isArray(data?.participants) ? data.participants : [];
      const creator = data?.createdBy as string | undefined;
      try {
        if (participants.length === 0 && data?.bookingId) {
          // fallback: read booking to notify driver/passenger
          const bSnap = await db.doc(`universities/${ctx.params.univ}/bookings/${data.bookingId}`).get();
          if (bSnap.exists) {
            const b = bSnap.data() as any;
            if (b?.driverId) participants.push(b.driverId);
            if (b?.passengerId) participants.push(b.passengerId);
          }
        }
        await notifyUsers(participants, {
          title: 'New Chat Created',
          body: 'A chat was created for your booking',
          data: { type: 'chat', chatId: snap.id, bookingId: data?.bookingId }
        }, { excludeSender: creator });
      } catch (err) {
        console.error('notifyOnChatCreate error', err);
      }
      return null;
    });

  /**
   * New chat message -> notify other participants with throttling
   */
  export const notifyOnMessageCreate = functions.firestore
    .document('universities/{univ}/chats/{chatId}/messages/{msgId}')
    .onCreate(async (snap, ctx) => {
      const data = snap.data() as any;
      const univ = ctx.params.univ as string;
      const chatId = ctx.params.chatId as string;
      const sender = data?.senderId as string | undefined;
      try {
        const chatRef = db.doc(`universities/${univ}/chats/${chatId}`);
        const chatSnap = await chatRef.get();
        if (!chatSnap.exists) return null;
        const chat = chatSnap.data() as any;
        let participants: string[] = Array.isArray(chat?.participants) ? chat.participants : [];
        if (participants.length === 0 && chat?.bookingId) {
          const bSnap = await db.doc(`universities/${univ}/bookings/${chat.bookingId}`).get();
          if (bSnap.exists) {
            const b = bSnap.data() as any;
            if (b?.driverId) participants.push(b.driverId);
            if (b?.passengerId) participants.push(b.passengerId);
          }
        }

        const others = participants.filter((p: string) => p && p !== sender);
        if (others.length === 0) return null;

        const isMedia = data?.type === 'image' || data?.type === 'video' || !!data?.mediaUrl;
        const title = isMedia ? 'New media message' : 'New message';
        const body = isMedia ? 'Sent a photo or video' : (data?.content || 'Sent a new message');

        // Notify each recipient with chat throttle (10s)
        for (const uid of Array.from(new Set(others))) {
          await createAndSendNotification(uid, { title, body, data: { type: 'chat', chatId, messageId: snap.id } }, { excludeSender: sender, throttleKey: 'chat', throttleSeconds: 10 });
        }
      } catch (err) {
        console.error('notifyOnMessageCreate error', err);
      }
      return null;
    });

  /**
   * Scheduled reminders: notify users 30 and 10 minutes before ride departure
   */
  export const rideReminders = functions.pubsub
    .schedule('every 1 minutes')
    .onRun(async () => {
      const now = admin.firestore.Timestamp.now();
      const in30 = admin.firestore.Timestamp.fromMillis(now.toMillis() + 30 * 60 * 1000);
      const in10 = admin.firestore.Timestamp.fromMillis(now.toMillis() + 10 * 60 * 1000);

      // Helper to query rides within +/- 60s window around target
      async function notifyWindow(targetTs: admin.firestore.Timestamp, label: string) {
        const start = admin.firestore.Timestamp.fromMillis(targetTs.toMillis() - 60 * 1000);
        const end = admin.firestore.Timestamp.fromMillis(targetTs.toMillis() + 60 * 1000);
        const ridesSnap = await db.collectionGroup('rides').where('departureTime', '>=', start).where('departureTime', '<=', end).get();
        for (const r of ridesSnap.docs) {
          const ride = r.data() as any;
          const ridePath = r.ref.path; // universities/{univ}/rides/{rideId}
          // extract university and rideId from path
          const parts = ridePath.split('/');
          const univ = parts[1];
          const rideId = parts[3];

          // notify driver and accepted passengers
          const driver = ride.driverId as string | undefined;
          const bookingsSnap = await db.collection(`universities/${univ}/bookings`).where('rideId', '==', rideId).where('status', '==', 'accepted').get();
          const passengers: string[] = [];
          bookingsSnap.forEach(b => { const d = b.data() as any; if (d?.passengerId) passengers.push(d.passengerId); });

          const title = `Ride starting ${label}`;
          const body = `Your ride departs in ${label}. Please prepare to depart.`;
          if (driver) await createAndSendNotification(driver, { title, body, data: { type: 'reminder', rideId } });
          if (passengers.length > 0) await notifyUsers(passengers, { title, body, data: { type: 'reminder', rideId } });
        }
      }

      try {
        await notifyWindow(in30, '30 minutes');
        await notifyWindow(in10, '10 minutes');
      } catch (err) {
        console.error('rideReminders error', err);
      }
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

      // gather FCM tokens for each target from root `fcm_tokens/{uid}` docs
      const tokens: string[] = [];
      for (const uid of targets) {
        const tDoc = await db.doc(`fcm_tokens/${uid}`).get();
        if (tDoc.exists) {
          const d = tDoc.data() as any;
          if (d && d.token) tokens.push(d.token as string);
        }
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
