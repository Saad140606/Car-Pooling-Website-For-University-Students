/**
 * Server-Side Notification Service (Admin SDK)
 *
 * This is the SINGLE centralized pipeline for creating notification documents
 * from API routes. It uses the Firebase Admin SDK (not the client SDK).
 *
 * Why this exists:
 * - API routes run on the server and MUST use firebase-admin
 * - The client-side rideNotificationService.ts uses 'firebase/firestore' (client SDK)
 *   which is INCOMPATIBLE with adminDb — this was the root cause of notifications
 *   not being created from API routes.
 *
 * Architecture:
 *   API Route  →  serverNotificationService (Admin SDK)  →  Firestore doc created
 *   Client     →  NotificationContext listens via onSnapshot  →  UI updates
 *   FCM        →  Cloud Function trigger on doc creation  →  push notification
 */

import admin from 'firebase-admin';

type Firestore = admin.firestore.Firestore;

// ============================================================================
// TYPES
// ============================================================================

export type ServerNotificationType =
  | 'chat'
  | 'booking'
  | 'ride_status'
  | 'ride_request'
  | 'ride_accepted'
  | 'ride_rejected'
  | 'ride_confirmed'
  | 'ride_cancelled'
  | 'ride_expired'
  | 'ride_reminder'
  | 'ride_started'
  | 'ride_completed'
  | 'call_incoming'
  | 'call_missed'
  | 'call_ended'
  | 'system'
  | 'verification';

export type ServerNotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export interface ServerNotificationPayload {
  userId: string;
  type: ServerNotificationType;
  title: string;
  message: string;
  relatedRideId: string;
  relatedBookingId?: string;
  relatedChatId?: string;
  priority?: ServerNotificationPriority;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// ANTI-SPAM DEDUPLICATION
// ============================================================================

const dedupCache = new Map<string, number>();
const DEDUP_WINDOW_MS = 15_000; // 15 seconds

function isDuplicate(userId: string, type: string, relatedId: string): boolean {
  const key = `${userId}:${type}:${relatedId}`;
  const lastSent = dedupCache.get(key);
  const now = Date.now();

  if (lastSent && now - lastSent < DEDUP_WINDOW_MS) {
    return true;
  }

  dedupCache.set(key, now);

  // Periodic cleanup
  if (dedupCache.size > 200) {
    const cutoff = now - DEDUP_WINDOW_MS * 2;
    for (const [k, v] of dedupCache.entries()) {
      if (v < cutoff) dedupCache.delete(k);
    }
  }

  return false;
}

// ============================================================================
// CORE: Write a single notification document
// ============================================================================

async function writeNotification(
  db: Firestore,
  university: string,
  payload: ServerNotificationPayload
): Promise<string | null> {
  // Dedup check
  if (isDuplicate(payload.userId, payload.type, payload.relatedRideId)) {
    console.debug('[ServerNotif] Skipping duplicate:', payload.type, payload.userId);
    return null;
  }

  try {
    const ref = db.collection(`universities/${university}/notifications`).doc();
    await ref.set({
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      relatedRideId: payload.relatedRideId,
      relatedBookingId: payload.relatedBookingId || null,
      relatedChatId: payload.relatedChatId || null,
      isRead: false,
      priority: payload.priority || 'normal',
      actionUrl: payload.actionUrl || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: payload.metadata || {},
    });

    console.log('[ServerNotif] ✅ Created:', {
      id: ref.id,
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
    });

    return ref.id;
  } catch (error: any) {
    console.error('[ServerNotif] ❌ Failed to create notification:', {
      error: error.message,
      userId: payload.userId,
      type: payload.type,
    });
    return null;
  }
}

// Batch write multiple notifications
async function writeNotifications(
  db: Firestore,
  university: string,
  payloads: ServerNotificationPayload[]
): Promise<void> {
  if (payloads.length === 0) return;

  const batch = db.batch();
  let count = 0;

  for (const payload of payloads) {
    if (isDuplicate(payload.userId, payload.type, payload.relatedRideId)) {
      continue;
    }

    const ref = db.collection(`universities/${university}/notifications`).doc();
    batch.set(ref, {
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      relatedRideId: payload.relatedRideId,
      relatedBookingId: payload.relatedBookingId || null,
      relatedChatId: payload.relatedChatId || null,
      isRead: false,
      priority: payload.priority || 'normal',
      actionUrl: payload.actionUrl || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: payload.metadata || {},
    });
    count++;
  }

  if (count > 0) {
    await batch.commit();
    console.log(`[ServerNotif] ✅ Batch created ${count} notifications`);
  }
}

// ============================================================================
// CONVENIENCE METHODS — one per event type
// ============================================================================

/** Notify driver: new ride request from a passenger */
export async function notifyNewRideRequest(
  db: Firestore,
  university: string,
  driverId: string,
  rideId: string,
  passengerName: string,
  rideFrom: string,
  rideTo: string,
  details?: { pickupPoint?: string | null; dropoffPoint?: string | null }
): Promise<void> {
  const pickupPoint = (details?.pickupPoint || '').trim() || rideFrom;
  const dropoffPoint = (details?.dropoffPoint || '').trim() || rideTo;

  await writeNotification(db, university, {
    userId: driverId,
    type: 'ride_request',
    title: 'New Ride Request 🚗',
    message: `${passengerName} requested a ride. Pickup: ${pickupPoint}. Dropoff: ${dropoffPoint}.`,
    relatedRideId: rideId,
    priority: 'high',
    actionUrl: '/dashboard/my-rides',
    metadata: { senderName: passengerName, rideFrom, rideTo, pickupPoint, dropoffPoint },
  });
}

/** Notify passenger: request accepted */
export async function notifyRequestAccepted(
  db: Firestore,
  university: string,
  passengerId: string,
  rideId: string,
  requestId: string,
  ride: { from: string; to: string; departureTime?: any; driverName?: string }
): Promise<void> {
  await writeNotification(db, university, {
    userId: passengerId,
    type: 'ride_accepted',
    title: 'Request Accepted! ✅',
    message: `${ride.driverName || 'Driver'} accepted your request for ${ride.from} → ${ride.to}. Confirm now!`,
    relatedRideId: rideId,
    relatedBookingId: requestId,
    priority: 'critical',
    actionUrl: '/dashboard/my-bookings',
    metadata: { rideFrom: ride.from, rideTo: ride.to, senderName: ride.driverName },
  });
}

/** Notify passenger: request rejected */
export async function notifyRequestRejected(
  db: Firestore,
  university: string,
  passengerId: string,
  rideId: string,
  bookingId: string,
  ride: { from: string; to: string; driverName?: string }
): Promise<void> {
  await writeNotification(db, university, {
    userId: passengerId,
    type: 'ride_rejected',
    title: 'Request Rejected',
    message: `${ride.driverName || 'The driver'} rejected your request for ${ride.from} → ${ride.to}.`,
    relatedRideId: rideId,
    relatedBookingId: bookingId,
    priority: 'normal',
    actionUrl: '/dashboard/rides',
    metadata: { rideFrom: ride.from, rideTo: ride.to, senderName: ride.driverName },
  });
}

/** Notify driver: passenger confirmed seat */
export async function notifyRideConfirmed(
  db: Firestore,
  university: string,
  driverId: string,
  rideId: string,
  bookingId: string,
  passengerName: string,
  ride: { from: string; to: string }
): Promise<void> {
  await writeNotification(db, university, {
    userId: driverId,
    type: 'ride_confirmed',
    title: 'Seat Confirmed! 🎉',
    message: `${passengerName} confirmed the ride from ${ride.from} → ${ride.to}.`,
    relatedRideId: rideId,
    relatedBookingId: bookingId,
    priority: 'high',
    actionUrl: '/dashboard/my-rides',
    metadata: { senderName: passengerName, rideFrom: ride.from, rideTo: ride.to },
  });
}

/** Notify about cancellation */
export async function notifyRideCancelled(
  db: Firestore,
  university: string,
  targetUserId: string,
  rideId: string,
  bookingId: string | undefined,
  cancelledByName: string,
  ride: { from: string; to: string },
  isLateCancellation = false
): Promise<void> {
  const title = isLateCancellation ? 'Late Cancellation ❌' : 'Ride Cancelled';
  const message = isLateCancellation
    ? `${cancelledByName} cancelled the ride from ${ride.from} → ${ride.to} at the last minute.`
    : `${cancelledByName} cancelled the ride from ${ride.from} → ${ride.to}.`;

  await writeNotification(db, university, {
    userId: targetUserId,
    type: 'ride_cancelled',
    title,
    message,
    relatedRideId: rideId,
    relatedBookingId: bookingId,
    priority: isLateCancellation ? 'critical' : 'high',
    actionUrl: '/dashboard/my-bookings',
    metadata: { senderName: cancelledByName, rideFrom: ride.from, rideTo: ride.to, isLateCancellation },
  });
}

/** Notify all passengers when driver cancels the ride */
export async function notifyRideCancelledByDriver(
  db: Firestore,
  university: string,
  passengerIds: string[],
  rideId: string,
  driverName: string,
  rideFrom: string,
  rideTo: string
): Promise<void> {
  const payloads: ServerNotificationPayload[] = passengerIds.map((pid) => ({
    userId: pid,
    type: 'ride_cancelled' as ServerNotificationType,
    title: 'Ride Cancelled ❌',
    message: `${driverName} cancelled the ride from ${rideFrom} → ${rideTo}. Please find another ride.`,
    relatedRideId: rideId,
    priority: 'critical' as ServerNotificationPriority,
    actionUrl: '/dashboard/rides',
    metadata: { senderName: driverName, rideFrom, rideTo },
  }));

  await writeNotifications(db, university, payloads);
}

/** Notify passenger: request expired */
export async function notifyRequestExpired(
  db: Firestore,
  university: string,
  passengerId: string,
  rideId: string,
  bookingId: string,
  ride: { from: string; to: string }
): Promise<void> {
  await writeNotification(db, university, {
    userId: passengerId,
    type: 'ride_expired',
    title: 'Request Expired ⏰',
    message: `You didn't confirm in time. The ride from ${ride.from} → ${ride.to} is no longer available.`,
    relatedRideId: rideId,
    relatedBookingId: bookingId,
    priority: 'normal',
    actionUrl: '/dashboard/rides',
    metadata: { rideFrom: ride.from, rideTo: ride.to },
  });
}

/** Notify passengers: ride started */
export async function notifyRideStarted(
  db: Firestore,
  university: string,
  participantIds: string[],
  rideId: string,
  rideFrom: string,
  rideTo: string,
  driverName: string
): Promise<void> {
  const payloads: ServerNotificationPayload[] = participantIds.map((uid) => ({
    userId: uid,
    type: 'ride_started' as ServerNotificationType,
    title: 'Ride Started! 🚀',
    message: `${driverName}'s ride from ${rideFrom} → ${rideTo} has started. Have a safe trip!`,
    relatedRideId: rideId,
    priority: 'high' as ServerNotificationPriority,
    actionUrl: '/dashboard/my-bookings',
    metadata: { senderName: driverName, rideFrom, rideTo },
  }));

  await writeNotifications(db, university, payloads);
}

/** Notify all participants: ride completed */
export async function notifyRideCompleted(
  db: Firestore,
  university: string,
  participantIds: string[],
  rideId: string,
  rideFrom: string,
  rideTo: string
): Promise<void> {
  const payloads: ServerNotificationPayload[] = participantIds.map((uid) => ({
    userId: uid,
    type: 'ride_completed' as ServerNotificationType,
    title: 'Ride Completed! ✨',
    message: `Your ride from ${rideFrom} → ${rideTo} is complete. Rate your experience!`,
    relatedRideId: rideId,
    priority: 'normal' as ServerNotificationPriority,
    actionUrl: '/dashboard/my-bookings',
    metadata: { rideFrom, rideTo },
  }));

  await writeNotifications(db, university, payloads);
}

/** Notify about new chat message */
export async function notifyChatMessage(
  db: Firestore,
  university: string,
  recipientId: string,
  rideId: string,
  chatId: string,
  senderName: string,
  messagePreview: string
): Promise<void> {
  await writeNotification(db, university, {
    userId: recipientId,
    type: 'chat',
    title: `Message from ${senderName}`,
    message: messagePreview.length > 100 ? messagePreview.slice(0, 100) + '…' : messagePreview,
    relatedRideId: rideId,
    relatedChatId: chatId,
    priority: 'normal',
    actionUrl: '/dashboard/my-bookings',
    metadata: { senderName, messagePreview: messagePreview.slice(0, 200) },
  });
}

/** Generic system notification */
export async function notifySystem(
  db: Firestore,
  university: string,
  userId: string,
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  await writeNotification(db, university, {
    userId,
    type: 'system',
    title,
    message,
    relatedRideId: 'system',
    priority: 'normal',
    metadata,
  });
}
