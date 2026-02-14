/**
 * Ride Lifecycle Scheduler — Cloud Functions
 *
 * Server-authoritative scheduler that runs on a cron and:
 * 1. Locks rides at departure time
 * 2. Transitions IN_PROGRESS → COMPLETION_WINDOW
 * 3. Auto-completes rides after completion window
 *
 * CRITICAL: All time checks use server time (admin.firestore.Timestamp.now()).
 * Client clocks are NEVER trusted.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// ============================================================================
// STATUS CONSTANTS (duplicated here to keep functions self-contained)
// ============================================================================

const COMPLETION_WINDOW_OPEN_MINUTES = 5;
const COMPLETION_WINDOW_HOURS = 1;

const RideStatus = {
  CREATED: 'CREATED',
  OPEN: 'OPEN',
  REQUESTED: 'REQUESTED',
  ACCEPTED: 'ACCEPTED',
  CONFIRMED: 'CONFIRMED',
  LOCKED: 'LOCKED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETION_WINDOW: 'COMPLETION_WINDOW',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

// Concrete type representing the string literal union of RideStatus values
type RideStatusType = typeof RideStatus[keyof typeof RideStatus];
/** Map lifecycle status to legacy status */
function toLegacyStatus(status: string): string {
  switch (status) {
    case RideStatus.CREATED:
    case RideStatus.OPEN:
    case RideStatus.REQUESTED:
    case RideStatus.ACCEPTED:
    case RideStatus.CONFIRMED:
    case RideStatus.LOCKED:
    case RideStatus.IN_PROGRESS:
    case RideStatus.COMPLETION_WINDOW:
      return 'active';
    case RideStatus.COMPLETED:
      return 'completed';
    case RideStatus.FAILED:
      return 'expired';
    case RideStatus.CANCELLED:
      return 'cancelled';
    default:
      return 'active';
  }
}

function toMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts.toMillis) return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return new Date(ts).getTime();
}

function normalizeConfirmedPassengers(raw: any[]): Array<{
  userId: string;
  driverReview?: 'arrived' | 'no-show';
  passengerCompletion?: 'completed' | 'cancelled';
  completionReason?: string;
}> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      if (typeof p === 'string') {
        return { userId: p };
      }
      if (!p || typeof p !== 'object') return null;
      return {
        userId: p.userId,
        driverReview: p.driverReview,
        passengerCompletion: p.passengerCompletion,
        completionReason: p.completionReason,
      };
    })
    .filter(Boolean) as Array<{
      userId: string;
      driverReview?: 'arrived' | 'no-show';
      passengerCompletion?: 'completed' | 'cancelled';
      completionReason?: string;
    }>;
}

function areCompletionRequirementsMet(data: any): boolean {
  const confirmed = normalizeConfirmedPassengers(data.confirmedPassengers || []);
  if (confirmed.length === 0) return true;
  return confirmed.every((p) => {
    if (!p.driverReview) return false;
    if (p.driverReview === 'no-show') return true;
    if (!p.passengerCompletion) return false;
    if (p.passengerCompletion === 'cancelled') {
      return Boolean(p.completionReason && String(p.completionReason).trim().length > 0);
    }
    return p.passengerCompletion === 'completed';
  });
}

function getLifecycleStatus(data: any): RideStatusType {
  if (data.lifecycleStatus) return data.lifecycleStatus as RideStatusType;
  // Map from legacy
  switch (data.status) {
    case 'active': return RideStatus.OPEN;
    case 'full': return RideStatus.CONFIRMED;
    case 'completed': return RideStatus.COMPLETED;
    case 'cancelled': return RideStatus.CANCELLED;
    case 'expired': return RideStatus.FAILED;
    default: return RideStatus.OPEN;
  }
}

/** Create notification doc for a user */
async function writeLifecycleNotification(
  db: admin.firestore.Firestore,
  university: string,
  userId: string,
  title: string,
  body: string,
  data: Record<string, string>
) {
  try {
    await db.collection(`universities/${university}/notifications`).add({
      userId,
      type: data.type || 'ride_status',
      title,
      message: body,
      relatedRideId: data.rideId || null,
      isRead: false,
      priority: data.priority || 'normal',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: data,
    });
  } catch (e) {
    console.error('[LifecycleScheduler] Failed to write notification:', e);
  }
}

/** Send FCM push to a user */
async function sendPushNotification(
  db: admin.firestore.Firestore,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    const tokenDoc = await db.doc(`fcm_tokens/${userId}`).get();
    if (!tokenDoc.exists) return;
    const token = tokenDoc.data()?.token;
    if (!token) return;

    await admin.messaging().send({
      token,
      notification: { title, body },
      data: data || {},
    });
  } catch (e) {
    // FCM errors are non-critical
    console.warn('[LifecycleScheduler] FCM send error:', e);
  }
}

// ============================================================================
// SCHEDULER 1: LOCK RIDES AT DEPARTURE TIME
// Runs every 1 minute, processes rides that have reached departure time
// ============================================================================

export const lifecycleLockRides = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const nowMs = now.toMillis();

    console.log('[LifecycleLockRides] Running at', now.toDate().toISOString());

    const univDocs = await db.collection('universities').listDocuments();
    let totalLocked = 0;
    let totalFailed = 0;

    for (const univDocRef of univDocs) {
      const university = univDocRef.id;

      // Find active rides where departure time has passed
      // Query rides with non-terminal lifecycle or legacy status
      const ridesSnap = await db.collection(`${univDocRef.path}/rides`)
        .where('departureTime', '<=', now)
        .where('status', 'in', ['active', 'full'])
        .limit(500)
        .get();

      if (ridesSnap.empty) continue;

      for (const rideDoc of ridesSnap.docs) {
        const data = rideDoc.data();
        const currentStatus = getLifecycleStatus(data);

        // Skip already locked/terminal rides
        const skipStatuses: RideStatusType[] = [
          RideStatus.LOCKED,
          RideStatus.IN_PROGRESS,
          RideStatus.COMPLETION_WINDOW,
          RideStatus.COMPLETED,
          RideStatus.FAILED,
          RideStatus.CANCELLED,
        ];
        if (skipStatuses.includes(currentStatus)) continue;

        const departureMs = toMs(data.departureTime);
        if (nowMs < departureMs) continue; // Not yet time

        try {
          const confirmedPassengers = data.confirmedPassengers || [];
          const confirmedCount = confirmedPassengers.length;
          const postLockStatus = confirmedCount > 0 ? RideStatus.IN_PROGRESS : RideStatus.FAILED;

          // Build transition log
          const transitionLog = Array.isArray(data.transitionLog) ? [...data.transitionLog] : [];
          transitionLog.push({
            from: currentStatus,
            to: RideStatus.LOCKED,
            timestamp: now,
            triggeredBy: 'system',
            reason: 'Departure time reached',
          });
          transitionLog.push({
            from: RideStatus.LOCKED,
            to: postLockStatus,
            timestamp: now,
            triggeredBy: 'system',
            reason: postLockStatus === RideStatus.IN_PROGRESS
              ? `${confirmedCount} confirmed passengers`
              : 'No confirmed passengers',
          });

          // Keep only last 50
          if (transitionLog.length > 50) transitionLog.splice(0, transitionLog.length - 50);

          // Auto-cancel all pending requests
          const pendingRequests = data.pendingRequests || [];
          const cancelledPassengers = [
            ...(data.cancelledPassengers || []),
            ...pendingRequests.map((p: any) => ({
              ...p,
              status: 'cancelled',
              timestamp: now,
            })),
          ];

          const updates: Record<string, any> = {
            lifecycleStatus: postLockStatus,
            status: toLegacyStatus(postLockStatus),
            legacyStatus: toLegacyStatus(postLockStatus),
            pendingRequests: [],
            cancelledPassengers,
            reservedSeats: 0,
            transitionLog,
            updatedAt: now,
          };

          if (postLockStatus === RideStatus.IN_PROGRESS) {
            const windowEnd = departureMs + COMPLETION_WINDOW_HOURS * 60 * 60 * 1000;
            updates.completionWindowEnd = admin.firestore.Timestamp.fromMillis(windowEnd);
            totalLocked++;
          } else {
            totalFailed++;
          }

          await rideDoc.ref.update(updates);

          // Auto-cancel pending request docs
          const reqSnap = await db.collection(`${univDocRef.path}/rides/${rideDoc.id}/requests`)
            .where('status', 'in', ['PENDING', 'ACCEPTED'])
            .get();
          if (!reqSnap.empty) {
            const batch = db.batch();
            reqSnap.forEach((r) => {
              batch.update(r.ref, {
                status: 'CANCELLED',
                cancelledAt: now,
                cancelledBy: 'system',
                cancellationReason: 'Ride departed — auto-cancelled',
              });
            });
            await batch.commit();
          }

          // Send notifications
          const driverId = data.driverId;
          const passengerIds = confirmedPassengers.map((p: any) => p.userId).filter(Boolean);

          if (postLockStatus === RideStatus.IN_PROGRESS) {
            // Notify ride started
            const rideFrom = data.from || 'Start';
            const rideTo = data.to || 'Destination';

            await writeLifecycleNotification(db, university, driverId,
              'Ride Started! 🚀',
              `Your ride from ${rideFrom} → ${rideTo} has started.`,
              { type: 'ride_started', rideId: rideDoc.id, priority: 'high' }
            );

            for (const pid of passengerIds) {
              await writeLifecycleNotification(db, university, pid,
                'Ride Started! 🚀',
                `Your ride from ${rideFrom} → ${rideTo} has started. Have a safe trip!`,
                { type: 'ride_started', rideId: rideDoc.id, priority: 'high' }
              );
              await sendPushNotification(db, pid, 'Ride Started! 🚀',
                `Your ride from ${rideFrom} → ${rideTo} has started.`,
                { type: 'ride_started', rideId: rideDoc.id }
              );
            }

            await sendPushNotification(db, driverId, 'Ride Started! 🚀',
              `Your ride from ${rideFrom} → ${rideTo} has started.`,
              { type: 'ride_started', rideId: rideDoc.id }
            );
          } else {
            // Notify ride failed
            await writeLifecycleNotification(db, university, driverId,
              'Ride Failed',
              'No confirmed passengers at departure time.',
              { type: 'ride_status', rideId: rideDoc.id, priority: 'normal' }
            );
          }

          console.log(`[LifecycleLockRides] Ride ${rideDoc.id} @ ${university}: ${currentStatus} → ${postLockStatus}`);
        } catch (err) {
          console.error(`[LifecycleLockRides] Error processing ride ${rideDoc.id}:`, err);
        }
      }
    }

    console.log(`[LifecycleLockRides] Done. Locked: ${totalLocked}, Failed: ${totalFailed}`);
    return null;
  });

// ============================================================================
// SCHEDULER 2: MANAGE COMPLETION WINDOW
// Runs every 2 minutes, transitions IN_PROGRESS → COMPLETION_WINDOW
// and auto-completes after window expires
// ============================================================================

export const lifecycleCompletionManager = functions.pubsub
  .schedule('every 2 minutes')
  .onRun(async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const nowMs = now.toMillis();

    console.log('[LifecycleCompletionManager] Running at', now.toDate().toISOString());

    const univDocs = await db.collection('universities').listDocuments();
    let totalTransitioned = 0;

    for (const univDocRef of univDocs) {
      const university = univDocRef.id;

      // Find IN_PROGRESS rides
      const inProgressSnap = await db.collection(`${univDocRef.path}/rides`)
        .where('lifecycleStatus', '==', RideStatus.IN_PROGRESS)
        .limit(200)
        .get();

      for (const rideDoc of inProgressSnap.docs) {
        const data = rideDoc.data();
        const departureMs = toMs(data.departureTime);
        const windowEnd = departureMs + COMPLETION_WINDOW_HOURS * 60 * 60 * 1000;

        // Transition to COMPLETION_WINDOW if reasonable time has passed
        // (at least 10 minutes after departure, or driver can mark early)
        const minutesAfterDeparture = (nowMs - departureMs) / (60 * 1000);
        if (minutesAfterDeparture >= COMPLETION_WINDOW_OPEN_MINUTES) {
          try {
            const transitionLog = Array.isArray(data.transitionLog) ? [...data.transitionLog] : [];
            transitionLog.push({
              from: RideStatus.IN_PROGRESS,
              to: RideStatus.COMPLETION_WINDOW,
              timestamp: now,
              triggeredBy: 'system',
              reason: 'Completion window opened by scheduler',
            });

            await rideDoc.ref.update({
              lifecycleStatus: RideStatus.COMPLETION_WINDOW,
              completionWindowEnd: admin.firestore.Timestamp.fromMillis(windowEnd),
              transitionLog,
              updatedAt: now,
            });

            const driverId = data.driverId;
            const passengerIds = (data.confirmedPassengers || []).map((p: any) => p.userId).filter(Boolean);

            await writeLifecycleNotification(db, university, driverId,
              'Mark Ride Complete ✨',
              'You can now mark your ride as completed.',
              { type: 'ride_status', rideId: rideDoc.id, priority: 'high' }
            );

            for (const pid of passengerIds) {
              await writeLifecycleNotification(db, university, pid,
                'Ride Nearing End',
                'Your ride will be completed soon. Prepare to rate your experience!',
                { type: 'ride_status', rideId: rideDoc.id, priority: 'normal' }
              );
            }

            totalTransitioned++;
            console.log(`[LifecycleCompletionManager] Ride ${rideDoc.id}: IN_PROGRESS → COMPLETION_WINDOW`);
          } catch (err) {
            console.error(`[LifecycleCompletionManager] Error transitioning ride ${rideDoc.id}:`, err);
          }
        }
      }

      // Find COMPLETION_WINDOW rides that have expired — auto-complete them
      const windowSnap = await db.collection(`${univDocRef.path}/rides`)
        .where('lifecycleStatus', '==', RideStatus.COMPLETION_WINDOW)
        .where('completionWindowEnd', '<=', now)
        .limit(200)
        .get();

      for (const rideDoc of windowSnap.docs) {
        try {
          const data = rideDoc.data();
          if (!areCompletionRequirementsMet(data)) {
            console.log(`[LifecycleCompletionManager] Ride ${rideDoc.id}: completion requirements not met`);
            continue;
          }
          const transitionLog = Array.isArray(data.transitionLog) ? [...data.transitionLog] : [];
          transitionLog.push({
            from: RideStatus.COMPLETION_WINDOW,
            to: RideStatus.COMPLETED,
            timestamp: now,
            triggeredBy: 'system',
            reason: 'Completion window expired — auto-completed',
          });

          await rideDoc.ref.update({
            lifecycleStatus: RideStatus.COMPLETED,
            status: 'completed',
            legacyStatus: 'completed',
            ratingsOpen: true,
            completedAt: now,
            transitionLog,
            updatedAt: now,
          });

          const driverId = data.driverId;
          const passengerIds = (data.confirmedPassengers || []).map((p: any) => p.userId).filter(Boolean);
          const rideFrom = data.from || 'Start';
          const rideTo = data.to || 'Destination';

          // Notify completion and rating
          await writeLifecycleNotification(db, university, driverId,
            'Ride Completed! ✅',
            `Your ride from ${rideFrom} → ${rideTo} is complete. Rate your passengers!`,
            { type: 'ride_completed', rideId: rideDoc.id, priority: 'normal' }
          );

          for (const pid of passengerIds) {
            await writeLifecycleNotification(db, university, pid,
              'Ride Completed! ✅',
              `Your ride from ${rideFrom} → ${rideTo} is complete. Rate your experience!`,
              { type: 'ride_completed', rideId: rideDoc.id, priority: 'normal' }
            );
          }

          totalTransitioned++;
          console.log(`[LifecycleCompletionManager] Ride ${rideDoc.id}: COMPLETION_WINDOW → COMPLETED`);
        } catch (err) {
          console.error(`[LifecycleCompletionManager] Error completing ride ${rideDoc.id}:`, err);
        }
      }
    }

    console.log(`[LifecycleCompletionManager] Done. Transitioned: ${totalTransitioned}`);
    return null;
  });

// ============================================================================
// FIRESTORE TRIGGER: On ride status change → notify & enforce lifecycle
// ============================================================================

export const onRideLifecycleChange = functions.firestore
  .document('universities/{univ}/rides/{rideId}')
  .onUpdate(async (change, ctx) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after) return null;

    const prevLifecycle = before.lifecycleStatus;
    const newLifecycle = after.lifecycleStatus;

    // Only act on lifecycle status changes
    if (!newLifecycle || prevLifecycle === newLifecycle) return null;

    // Log transition
    console.log(`[onRideLifecycleChange] Ride ${ctx.params.rideId}: ${prevLifecycle} → ${newLifecycle}`);

    return null;
  });
