require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');

const PORT = Number(process.env.PORT || 8080);
const WATCH_MODE = process.env.PUSH_WATCH_MODE || 'snapshot';
const POLL_INTERVAL_MS = Number(process.env.PUSH_POLL_INTERVAL_MS || 5000);
const WORKER_API_KEY = process.env.WORKER_API_KEY || '';

function initFirebaseAdmin() {
  if (admin.apps.length) return admin.app();

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
  }

  return admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

initFirebaseAdmin();
const db = admin.firestore();
const messaging = admin.messaging();

const app = express();
app.use(express.json());

function toStringOrNull(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function fetchTokensForUsers(userIds) {
  const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean)));
  if (!uniqueIds.length) return [];

  const chunks = [];
  for (let index = 0; index < uniqueIds.length; index += 10) {
    chunks.push(uniqueIds.slice(index, index + 10));
  }

  const tokens = [];
  for (const idsChunk of chunks) {
    const snap = await db
      .collectionGroup('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', idsChunk)
      .get();

    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const single = toStringOrNull(data.fcmToken);
      if (single) tokens.push(single);

      if (Array.isArray(data.fcmTokens)) {
        for (const value of data.fcmTokens) {
          const candidate = toStringOrNull(value);
          if (candidate) tokens.push(candidate);
        }
      }
    });
  }

  return Array.from(new Set(tokens));
}

async function sendPushBatch(tokens, payload) {
  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, responses: [] };
  }

  const chunks = [];
  for (let index = 0; index < tokens.length; index += 500) {
    chunks.push(tokens.slice(index, index + 500));
  }

  let successCount = 0;
  let failureCount = 0;
  const failedTokenCodes = [];

  for (const chunkTokens of chunks) {
    const response = await messaging.sendEachForMulticast({
      tokens: chunkTokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      webpush: {
        headers: { Urgency: payload.priority === 'high' ? 'high' : 'normal' },
        fcmOptions: {
          link: payload.link || '/dashboard/notifications',
        },
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          requireInteraction: payload.priority === 'high',
        },
      },
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((entry, i) => {
      if (!entry.success) {
        failedTokenCodes.push({ token: chunkTokens[i], code: entry.error?.code || 'unknown' });
      }
    });
  }

  return { successCount, failureCount, failedTokenCodes };
}

function buildRideRequestPayload(rideId, rideData) {
  const from = rideData.from || rideData.pickupLocation || 'Starting point';
  const to = rideData.to || rideData.dropoffLocation || 'Destination';
  const requesterName = rideData.requesterName || rideData.passengerName || 'A student';

  return {
    title: 'New Ride Request 🚗',
    body: `${requesterName} requested a ride from ${from} → ${to}`,
    priority: 'high',
    link: '/dashboard/my-rides',
    data: {
      type: 'ride_request',
      rideId,
      from,
      to,
      requesterName,
    },
  };
}

async function processRideRequest(rideDoc) {
  const rideData = rideDoc.data() || {};

  if (rideData.notificationSent === true) {
    return;
  }

  const recipientUserIds = Array.from(new Set([
    ...(Array.isArray(rideData.targetUserIds) ? rideData.targetUserIds : []),
    rideData.driverId,
    rideData.providerId,
  ].filter(Boolean)));

  if (!recipientUserIds.length) {
    await rideDoc.ref.set({
      notificationSent: false,
      notificationStatus: 'skipped_no_recipients',
      notificationAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }

  const tokens = await fetchTokensForUsers(recipientUserIds);
  if (!tokens.length) {
    await rideDoc.ref.set({
      notificationSent: false,
      notificationStatus: 'skipped_no_tokens',
      notificationAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }

  const payload = buildRideRequestPayload(rideDoc.id, rideData);
  const sendResult = await sendPushBatch(tokens, payload);

  await rideDoc.ref.set({
    notificationSent: sendResult.successCount > 0,
    notificationStatus: sendResult.failureCount === 0
      ? 'sent'
      : sendResult.successCount > 0
        ? 'partial_failure'
        : 'failed',
    notificationAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
    notificationSentAt: sendResult.successCount > 0
      ? admin.firestore.FieldValue.serverTimestamp()
      : null,
    notificationSuccessCount: sendResult.successCount,
    notificationFailureCount: sendResult.failureCount,
  }, { merge: true });
}

async function processPendingRideRequestsOnce() {
  const snap = await db
    .collection('rides')
    .where('type', '==', 'request')
    .limit(100)
    .get();

  for (const rideDoc of snap.docs) {
    try {
      await processRideRequest(rideDoc);
    } catch (error) {
      await rideDoc.ref.set({
        notificationStatus: 'failed',
        notificationError: error instanceof Error ? error.message : String(error),
        notificationAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }
}

function startSnapshotWatcher() {
  console.log('[PushWorker] Starting Firestore snapshot watcher on rides collection...');
  return db.collection('rides').where('type', '==', 'request').onSnapshot(
    async (snapshot) => {
      const addedDocs = snapshot.docChanges().filter((change) => change.type === 'added');
      for (const change of addedDocs) {
        try {
          await processRideRequest(change.doc);
        } catch (error) {
          console.error('[PushWorker] Snapshot processing error:', error);
        }
      }
    },
    (error) => {
      console.error('[PushWorker] Snapshot listener error:', error);
    }
  );
}

function startPollingWatcher() {
  console.log(`[PushWorker] Starting polling watcher (every ${POLL_INTERVAL_MS}ms)...`);
  const interval = setInterval(() => {
    processPendingRideRequestsOnce().catch((error) => {
      console.error('[PushWorker] Polling processing error:', error);
    });
  }, POLL_INTERVAL_MS);

  return () => clearInterval(interval);
}

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    mode: WATCH_MODE,
    ts: new Date().toISOString(),
  });
});

app.post('/send-test', async (req, res) => {
  try {
    if (WORKER_API_KEY) {
      const provided = req.headers['x-worker-key'];
      if (provided !== WORKER_API_KEY) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }
    }

    const { userIds, title, body, data, link } = req.body || {};
    const tokens = await fetchTokensForUsers(Array.isArray(userIds) ? userIds : []);
    const result = await sendPushBatch(tokens, {
      title: title || 'Campus Rides Test',
      body: body || 'Test push notification',
      data: data || { type: 'test' },
      link: link || '/dashboard/notifications',
      priority: 'high',
    });

    return res.status(200).json({ ok: true, ...result, tokenCount: tokens.length });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

app.listen(PORT, () => {
  console.log(`[PushWorker] Running on port ${PORT}`);

  if (WATCH_MODE === 'poll') {
    startPollingWatcher();
  } else {
    startSnapshotWatcher();
  }
});
