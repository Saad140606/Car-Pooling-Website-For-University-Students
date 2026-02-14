/**
 * Ride Lifecycle Notification Triggers
 *
 * Maps lifecycle events to notification dispatches.
 * Works with both the client-side notification service and
 * Cloud Functions FCM delivery.
 */

import admin from 'firebase-admin';

type Firestore = admin.firestore.Firestore;

// ============================================================================
// NOTIFICATION EVENT TYPES
// ============================================================================

export enum LifecycleNotificationEvent {
  BOOKING_REQUEST     = 'lifecycle_booking_request',
  REQUEST_ACCEPTED    = 'lifecycle_request_accepted',
  SEAT_CONFIRMED      = 'lifecycle_seat_confirmed',
  PASSENGER_CANCELLED = 'lifecycle_passenger_cancelled',
  RIDE_CANCELLED      = 'lifecycle_ride_cancelled',
  RIDE_LOCKED         = 'lifecycle_ride_locked',
  RIDE_STARTED        = 'lifecycle_ride_started',
  COMPLETION_WINDOW   = 'lifecycle_completion_window',
  RIDE_COMPLETED      = 'lifecycle_ride_completed',
  RIDE_FAILED         = 'lifecycle_ride_failed',
  PASSENGER_NO_SHOW   = 'lifecycle_passenger_no_show',
  RATING_REQUEST      = 'lifecycle_rating_request',
}

// ============================================================================
// NOTIFICATION PAYLOADS
// ============================================================================

interface NotificationTarget {
  userId: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

// ============================================================================
// SERVER-SIDE NOTIFICATION WRITER (Admin SDK)
// ============================================================================

/**
 * Create notification documents in Firestore.
 * Cloud Functions pickup these docs for FCM delivery.
 */
async function writeNotifications(
  db: Firestore,
  university: string,
  targets: NotificationTarget[]
): Promise<void> {
  if (targets.length === 0) return;

  const batch = db.batch();

  for (const target of targets) {
    // Write to university-scoped notifications
    const ref = db.collection(`universities/${university}/notifications`).doc();
    batch.set(ref, {
      userId: target.userId,
      type: target.data.type || 'ride_status',
      title: target.title,
      message: target.body,
      relatedRideId: target.data.rideId || null,
      relatedBookingId: target.data.requestId || null,
      relatedChatId: null,
      isRead: false,
      priority: target.data.priority || 'normal',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: target.data,
    });
  }

  await batch.commit();
}

// ============================================================================
// LIFECYCLE NOTIFICATION DISPATCHERS
// ============================================================================

/**
 * Notify driver about a new booking request.
 */
export async function notifyBookingRequest(
  db: Firestore,
  university: string,
  driverId: string,
  rideId: string,
  passengerName: string,
  rideFrom: string,
  rideTo: string
): Promise<void> {
  await writeNotifications(db, university, [
    {
      userId: driverId,
      title: 'New Ride Request 🚗',
      body: `${passengerName} wants to join your ride from ${rideFrom} to ${rideTo}`,
      data: {
        type: 'ride_request',
        rideId,
        priority: 'high',
        event: LifecycleNotificationEvent.BOOKING_REQUEST,
      },
    },
  ]);
}

/**
 * Notify passenger that their request was accepted.
 */
export async function notifyRequestAccepted(
  db: Firestore,
  university: string,
  passengerId: string,
  rideId: string,
  requestId: string,
  driverName: string,
  rideFrom: string,
  rideTo: string
): Promise<void> {
  await writeNotifications(db, university, [
    {
      userId: passengerId,
      title: 'Request Accepted! ✅',
      body: `${driverName} accepted your request for ${rideFrom} → ${rideTo}. Confirm now!`,
      data: {
        type: 'ride_accepted',
        rideId,
        requestId,
        priority: 'critical',
        event: LifecycleNotificationEvent.REQUEST_ACCEPTED,
      },
    },
  ]);
}

/**
 * Notify driver that a passenger confirmed their seat.
 */
export async function notifySeatConfirmed(
  db: Firestore,
  university: string,
  driverId: string,
  rideId: string,
  passengerName: string,
  rideFrom: string,
  rideTo: string
): Promise<void> {
  await writeNotifications(db, university, [
    {
      userId: driverId,
      title: 'Seat Confirmed! 🎉',
      body: `${passengerName} confirmed their seat for ${rideFrom} → ${rideTo}.`,
      data: {
        type: 'ride_confirmed',
        rideId,
        priority: 'high',
        event: LifecycleNotificationEvent.SEAT_CONFIRMED,
      },
    },
  ]);
}

/**
 * Notify about passenger cancellation.
 */
export async function notifyPassengerCancelled(
  db: Firestore,
  university: string,
  targetUserId: string,
  rideId: string,
  cancellerName: string,
  rideFrom: string,
  rideTo: string,
  isLateCancellation: boolean
): Promise<void> {
  const title = isLateCancellation ? 'Late Cancellation ❌' : 'Ride Cancelled';
  const body = isLateCancellation
    ? `${cancellerName} cancelled their seat on ${rideFrom} → ${rideTo} at the last minute.`
    : `${cancellerName} cancelled their booking for ${rideFrom} → ${rideTo}.`;

  await writeNotifications(db, university, [
    {
      userId: targetUserId,
      title,
      body,
      data: {
        type: 'ride_cancelled',
        rideId,
        priority: isLateCancellation ? 'critical' : 'high',
        event: LifecycleNotificationEvent.PASSENGER_CANCELLED,
        isLateCancellation: String(isLateCancellation),
      },
    },
  ]);
}

/**
 * Notify all passengers that the ride was cancelled by driver.
 */
export async function notifyRideCancelledByDriver(
  db: Firestore,
  university: string,
  passengerIds: string[],
  rideId: string,
  driverName: string,
  rideFrom: string,
  rideTo: string
): Promise<void> {
  const targets: NotificationTarget[] = passengerIds.map((pid) => ({
    userId: pid,
    title: 'Ride Cancelled ❌',
    body: `${driverName} cancelled the ride from ${rideFrom} → ${rideTo}. Please find another ride.`,
    data: {
      type: 'ride_cancelled',
      rideId,
      priority: 'critical',
      event: LifecycleNotificationEvent.RIDE_CANCELLED,
    },
  }));

  await writeNotifications(db, university, targets);
}

/**
 * Notify participants that ride is locked.
 */
export async function notifyRideLocked(
  db: Firestore,
  university: string,
  driverId: string,
  passengerIds: string[],
  rideId: string,
  rideFrom: string,
  rideTo: string
): Promise<void> {
  const allTargets: NotificationTarget[] = [
    {
      userId: driverId,
      title: 'Ride Locked 🔒',
      body: `Your ride from ${rideFrom} → ${rideTo} is now locked. No more changes allowed.`,
      data: {
        type: 'ride_status',
        rideId,
        priority: 'high',
        event: LifecycleNotificationEvent.RIDE_LOCKED,
      },
    },
    ...passengerIds.map((pid) => ({
      userId: pid,
      title: 'Ride Locked 🔒',
      body: `The ride from ${rideFrom} → ${rideTo} is now locked. Get ready!`,
      data: {
        type: 'ride_status',
        rideId,
        priority: 'high',
        event: LifecycleNotificationEvent.RIDE_LOCKED,
      },
    })),
  ];

  await writeNotifications(db, university, allTargets);
}

/**
 * Notify participants that ride has started.
 */
export async function notifyRideStarted(
  db: Firestore,
  university: string,
  driverId: string,
  passengerIds: string[],
  rideId: string,
  rideFrom: string,
  rideTo: string
): Promise<void> {
  const targets: NotificationTarget[] = [
    {
      userId: driverId,
      title: 'Ride Started! 🚀',
      body: `Your ride from ${rideFrom} → ${rideTo} has started. Drive safely!`,
      data: {
        type: 'ride_started',
        rideId,
        priority: 'high',
        event: LifecycleNotificationEvent.RIDE_STARTED,
      },
    },
    ...passengerIds.map((pid) => ({
      userId: pid,
      title: 'Ride Started! 🚀',
      body: `Your ride from ${rideFrom} → ${rideTo} has started. Have a safe trip!`,
      data: {
        type: 'ride_started',
        rideId,
        priority: 'high',
        event: LifecycleNotificationEvent.RIDE_STARTED,
      },
    })),
  ];

  await writeNotifications(db, university, targets);
}

/**
 * Notify participants that completion window is open.
 */
export async function notifyCompletionWindowOpen(
  db: Firestore,
  university: string,
  driverId: string,
  passengerIds: string[],
  rideId: string,
  rideFrom: string,
  rideTo: string
): Promise<void> {
  const targets: NotificationTarget[] = [
    {
      userId: driverId,
      title: 'Mark Ride Complete ✨',
      body: `Your ride from ${rideFrom} → ${rideTo} can now be marked as completed.`,
      data: {
        type: 'ride_status',
        rideId,
        priority: 'high',
        event: LifecycleNotificationEvent.COMPLETION_WINDOW,
      },
    },
    ...passengerIds.map((pid) => ({
      userId: pid,
      title: 'Ride Ending Soon',
      body: `The ride from ${rideFrom} → ${rideTo} is nearing completion.`,
      data: {
        type: 'ride_status',
        rideId,
        priority: 'normal',
        event: LifecycleNotificationEvent.COMPLETION_WINDOW,
      },
    })),
  ];

  await writeNotifications(db, university, targets);
}

/**
 * Notify participants that ride is completed and ratings are open.
 */
export async function notifyRideCompleted(
  db: Firestore,
  university: string,
  driverId: string,
  passengerIds: string[],
  rideId: string,
  rideFrom: string,
  rideTo: string
): Promise<void> {
  const targets: NotificationTarget[] = [
    {
      userId: driverId,
      title: 'Ride Completed! ✅',
      body: `Your ride from ${rideFrom} → ${rideTo} is complete. Rate your passengers!`,
      data: {
        type: 'ride_completed',
        rideId,
        priority: 'normal',
        event: LifecycleNotificationEvent.RIDE_COMPLETED,
      },
    },
    ...passengerIds.map((pid) => ({
      userId: pid,
      title: 'Ride Completed! ✅',
      body: `Your ride from ${rideFrom} → ${rideTo} is complete. Rate your experience!`,
      data: {
        type: 'ride_completed',
        rideId,
        priority: 'normal',
        event: LifecycleNotificationEvent.RATING_REQUEST,
      },
    })),
  ];

  await writeNotifications(db, university, targets);
}

/**
 * Notify driver that ride failed (no confirmed passengers at departure).
 */
export async function notifyRideFailed(
  db: Firestore,
  university: string,
  driverId: string,
  rideId: string,
  rideFrom: string,
  rideTo: string
): Promise<void> {
  await writeNotifications(db, university, [
    {
      userId: driverId,
      title: 'Ride Failed',
      body: `Your ride from ${rideFrom} → ${rideTo} had no confirmed passengers and has been marked as failed.`,
      data: {
        type: 'ride_status',
        rideId,
        priority: 'normal',
        event: LifecycleNotificationEvent.RIDE_FAILED,
      },
    },
  ]);
}

/**
 * Notify passenger about no-show record.
 */
export async function notifyPassengerNoShow(
  db: Firestore,
  university: string,
  passengerId: string,
  rideId: string
): Promise<void> {
  await writeNotifications(db, university, [
    {
      userId: passengerId,
      title: 'Marked as No-Show',
      body: 'The driver marked you as a no-show for the ride. This may affect your account standing.',
      data: {
        type: 'ride_status',
        rideId,
        priority: 'high',
        event: LifecycleNotificationEvent.PASSENGER_NO_SHOW,
      },
    },
  ]);
}
