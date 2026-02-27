/**
 * Ride Lifecycle Service — Server-Side (Admin SDK)
 *
 * All ride state mutations go through this service.
 * Uses Firestore transactions for atomicity and race-condition safety.
 * Every transition is logged. Backend is the single source of truth.
 */

import admin from 'firebase-admin';
import {
  RideStatus,
  PassengerStatus,
  LIFECYCLE_CONSTANTS,
  type LifecycleRide,
  type RidePassenger,
  type StateTransition,
  type LifecycleRating,
  type UserRatingStats,
} from './types';
import {
  validateTransition,
  isValidTransition,
  isRideLocked,
  isTerminalState,
  isCancellationAllowed,
  isBookingAllowed,
  canReserveSeat,
  canConfirmSeat,
  calculateSeatsAfterAction,
  computeRideStatusFromPassengers,
  shouldLockRide,
  determinePostLockStatus,
  calculateCompletionWindowEnd,
  calculateCompletionWindowOpenTime,
  createTransitionEntry,
  toLegacyStatus,
  fromLegacyStatus,
  isValidRating,
  canUserRate,
  InvalidTransitionError,
} from './stateMachine';

type Firestore = admin.firestore.Firestore;
type Transaction = admin.firestore.Transaction;
type DocumentReference = admin.firestore.DocumentReference;
type Timestamp = admin.firestore.Timestamp;

// ============================================================================
// HELPERS
// ============================================================================

function now(): Timestamp {
  return admin.firestore.Timestamp.now();
}

function nowMs(): number {
  return Date.now();
}

function normalizeConfirmedPassengers(raw: any[]): RidePassenger[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      if (typeof p === 'string') {
        return {
          userId: p,
          status: PassengerStatus.CONFIRMED,
          timestamp: now(),
        } as RidePassenger;
      }
      if (!p || typeof p !== 'object') return null;
      return p as RidePassenger;
    })
    .filter(Boolean) as RidePassenger[];
}

function isCompletionReady(confirmedPassengers: RidePassenger[]): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const p of confirmedPassengers) {
    if (!p.driverReview) {
      missing.push(p.userId);
      continue;
    }
    if (p.driverReview === 'no-show') {
      continue;
    }
    if (!p.passengerCompletion) {
      missing.push(p.userId);
      continue;
    }
    if (p.passengerCompletion === 'cancelled' && !p.completionReason) {
      missing.push(p.userId);
    }
  }
  return { ready: missing.length === 0, missing };
}

function toMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts.toMillis) return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  if (ts.toDate) return ts.toDate().getTime();
  return new Date(ts).getTime();
}

function rideRef(db: Firestore, university: string, rideId: string): DocumentReference {
  return db.doc(`universities/${university}/rides/${rideId}`);
}

function requestRef(
  db: Firestore,
  university: string,
  rideId: string,
  requestId: string
): DocumentReference {
  return db.doc(`universities/${university}/rides/${rideId}/requests/${requestId}`);
}

function logTransition(
  ride: any,
  from: RideStatus | string,
  to: RideStatus | string,
  triggeredBy: string,
  reason?: string
): StateTransition[] {
  const log: StateTransition[] = Array.isArray(ride.transitionLog)
    ? [...ride.transitionLog]
    : [];
  log.push(createTransitionEntry(from, to, triggeredBy, now(), reason));
  // Keep only last 50 transitions to avoid document bloat
  if (log.length > 50) log.splice(0, log.length - 50);
  return log;
}

// ============================================================================
// LIFECYCLE STATUS FIELD — read with fallback
// ============================================================================

function getLifecycleStatus(rideData: any): RideStatus {
  // Prefer the new lifecycleStatus field
  if (rideData.lifecycleStatus && Object.values(RideStatus).includes(rideData.lifecycleStatus)) {
    return rideData.lifecycleStatus as RideStatus;
  }
  // Fallback to legacy status
  return fromLegacyStatus(rideData.status || 'active');
}

// ============================================================================
// SERVICE: INITIALIZE RIDE LIFECYCLE
// ============================================================================

/**
 * Initialize lifecycle fields on a newly created ride.
 * Call this after ride creation to set up state machine fields.
 */
export async function initializeRideLifecycle(
  db: Firestore,
  university: string,
  rideId: string,
  driverId: string
): Promise<void> {
  const ref = rideRef(db, university, rideId);

  await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Ride not found');

    const data = snap.data()!;
    const timestamp = now();

    const lifecycleFields = {
      lifecycleStatus: RideStatus.OPEN,
      confirmedPassengers: data.confirmedPassengers || [],
      pendingRequests: [],
      cancelledPassengers: [],
      completionWindowEnd: null,
      ratingsOpen: false,
      reservedSeats: data.reservedSeats || 0,
      transitionLog: [
        createTransitionEntry(RideStatus.CREATED, RideStatus.OPEN, driverId, timestamp, 'Ride published'),
      ],
      legacyStatus: 'active',
      updatedAt: timestamp,
    };

    tx.update(ref, lifecycleFields);
  });

  console.log(`[RideLifecycle] Initialized ride ${rideId} → OPEN`);
}

// ============================================================================
// SERVICE: TRANSITION RIDE STATUS
// ============================================================================

/**
 * Transition a ride to a new status with full validation.
 * Only admin or system scheduler should call this directly.
 */
export async function transitionRideStatus(
  db: Firestore,
  university: string,
  rideId: string,
  targetStatus: RideStatus,
  triggeredBy: string,
  reason?: string
): Promise<{ success: boolean; previousStatus: RideStatus; newStatus: RideStatus }> {
  const ref = rideRef(db, university, rideId);

  const result = await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Ride not found');

    const data = snap.data()!;
    const currentStatus = getLifecycleStatus(data);

    // Validate the transition
    validateTransition(currentStatus, targetStatus);

    const transLog = logTransition(data, currentStatus, targetStatus, triggeredBy, reason);

    const updates: Record<string, any> = {
      lifecycleStatus: targetStatus,
      status: toLegacyStatus(targetStatus),
      legacyStatus: toLegacyStatus(targetStatus),
      transitionLog: transLog,
      updatedAt: now(),
    };

    // Handle specific transitions
    if (targetStatus === RideStatus.COMPLETION_WINDOW) {
      const departureMs = toMs(data.departureTime);
      updates.completionWindowEnd = admin.firestore.Timestamp.fromMillis(
        calculateCompletionWindowEnd(departureMs)
      );
    }

    if (targetStatus === RideStatus.COMPLETED) {
      updates.ratingsOpen = true;
    }

    tx.update(ref, updates);

    return { previousStatus: currentStatus, newStatus: targetStatus };
  });

  console.log(
    `[RideLifecycle] Ride ${rideId}: ${result.previousStatus} → ${result.newStatus} (by ${triggeredBy})`
  );

  return { success: true, ...result };
}

// ============================================================================
// SERVICE: PASSENGER REQUEST (BOOKING)
// ============================================================================

/**
 * Handle a new passenger seat request.
 * Updates ride lifecycle status if needed.
 */
export async function handlePassengerRequest(
  db: Firestore,
  university: string,
  rideId: string,
  passengerId: string,
  requestId: string
): Promise<{ success: boolean }> {
  const ref = rideRef(db, university, rideId);

  await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Ride not found');

    const data = snap.data()!;
    const currentStatus = getLifecycleStatus(data);

    // Check if booking is allowed
    if (!isBookingAllowed(currentStatus)) {
      throw new Error(`Booking not allowed in status: ${currentStatus}`);
    }

    // Check seats
    if ((data.availableSeats ?? 0) <= 0) {
      throw new Error('No seats available');
    }

    // Add to pending requests
    const pendingRequests: RidePassenger[] = Array.isArray(data.pendingRequests)
      ? [...data.pendingRequests]
      : [];

    // Prevent duplicate requests
    if (pendingRequests.some((p) => p.userId === passengerId)) {
      throw new Error('Duplicate request — passenger already has a pending request');
    }

    pendingRequests.push({
      userId: passengerId,
      status: PassengerStatus.REQUESTED,
      timestamp: now(),
      requestId,
    });

    // Compute new ride status
    const newStatus = computeRideStatusFromPassengers({
      confirmedPassengers: data.confirmedPassengers || [],
      pendingRequests,
      status: currentStatus,
    });

    const updates: Record<string, any> = {
      pendingRequests,
      updatedAt: now(),
    };

    // Only transition if status actually changes and is valid
    if (newStatus !== currentStatus && isValidTransition(currentStatus, newStatus)) {
      updates.lifecycleStatus = newStatus;
      updates.status = toLegacyStatus(newStatus);
      updates.transitionLog = logTransition(data, currentStatus, newStatus, passengerId, 'Passenger requested seat');
    }

    tx.update(ref, updates);
  });

  console.log(`[RideLifecycle] Passenger ${passengerId} requested seat on ride ${rideId}`);
  return { success: true };
}

// ============================================================================
// SERVICE: ACCEPT PASSENGER REQUEST
// ============================================================================

/**
 * Driver accepts a passenger request. Reserves a seat atomically.
 */
export async function handleAcceptRequest(
  db: Firestore,
  university: string,
  rideId: string,
  requestId: string,
  driverId: string
): Promise<{ success: boolean; passengerId: string }> {
  const ref = rideRef(db, university, rideId);
  const reqRef = requestRef(db, university, rideId, requestId);

  const result = await db.runTransaction(async (tx: Transaction) => {
    const [rideSnap, reqSnap] = await Promise.all([tx.get(ref), tx.get(reqRef)]);

    if (!rideSnap.exists) throw new Error('Ride not found');
    if (!reqSnap.exists) throw new Error('Request not found');

    const rideData = rideSnap.data()!;
    const reqData = reqSnap.data()!;
    const currentStatus = getLifecycleStatus(rideData);

    // Authorization
    const rideDriverId = rideData.driverId || rideData.createdBy;
    if (rideDriverId !== driverId) {
      throw new Error('FORBIDDEN: Only the ride owner can accept requests');
    }

    // Check ride is not locked
    if (isRideLocked(currentStatus)) {
      throw new Error('Ride is locked — cannot accept new requests');
    }

    // Idempotency
    if (reqData.status === 'ACCEPTED') {
      return { passengerId: reqData.passengerId, idempotent: true };
    }

    if (reqData.status !== 'PENDING') {
      throw new Error('Only PENDING requests can be accepted');
    }

    // Seat check
    const seatCheck = canReserveSeat({
      availableSeats: rideData.availableSeats ?? 0,
      totalSeats: rideData.totalSeats ?? 0,
      reservedSeats: rideData.reservedSeats ?? 0,
      status: currentStatus,
    });
    if (!seatCheck.allowed) throw new Error(seatCheck.reason!);

    const passengerId = reqData.passengerId;
    const seats = calculateSeatsAfterAction(
      'reserve',
      rideData.availableSeats ?? 0,
      rideData.reservedSeats ?? 0,
      rideData.totalSeats ?? 0
    );

    // Update pending requests array
    const pendingRequests: RidePassenger[] = Array.isArray(rideData.pendingRequests)
      ? rideData.pendingRequests.map((p: RidePassenger) =>
          p.userId === passengerId
            ? { ...p, status: PassengerStatus.ACCEPTED, timestamp: now() }
            : p
        )
      : [];

    // Compute new status
    const newStatus = computeRideStatusFromPassengers({
      confirmedPassengers: rideData.confirmedPassengers || [],
      pendingRequests,
      status: currentStatus,
    });

    const rideUpdates: Record<string, any> = {
      reservedSeats: seats.reservedSeats,
      pendingRequests,
      updatedAt: now(),
    };

    if (newStatus !== currentStatus && isValidTransition(currentStatus, newStatus)) {
      rideUpdates.lifecycleStatus = newStatus;
      rideUpdates.status = toLegacyStatus(newStatus);
      rideUpdates.transitionLog = logTransition(
        rideData,
        currentStatus,
        newStatus,
        driverId,
        'Driver accepted request'
      );
    }

    tx.update(ref, rideUpdates);
    tx.update(reqRef, {
      status: 'ACCEPTED',
      acceptedAt: now(),
      updatedAt: now(),
    });

    return { passengerId, idempotent: false };
  });

  if (!result.idempotent) {
    console.log(
      `[RideLifecycle] Driver ${driverId} accepted request ${requestId} for passenger ${result.passengerId}`
    );
  }

  return { success: true, passengerId: result.passengerId };
}

// ============================================================================
// SERVICE: CONFIRM SEAT
// ============================================================================

/**
 * Passenger confirms their seat. Seat is deducted atomically.
 */
export async function handleConfirmSeat(
  db: Firestore,
  university: string,
  rideId: string,
  requestId: string,
  passengerId: string
): Promise<{ success: boolean }> {
  const ref = rideRef(db, university, rideId);
  const reqRef = requestRef(db, university, rideId, requestId);

  await db.runTransaction(async (tx: Transaction) => {
    const [rideSnap, reqSnap] = await Promise.all([tx.get(ref), tx.get(reqRef)]);

    if (!rideSnap.exists) throw new Error('Ride not found');
    if (!reqSnap.exists) throw new Error('Request not found');

    const rideData = rideSnap.data()!;
    const reqData = reqSnap.data()!;
    const currentStatus = getLifecycleStatus(rideData);

    // Authorization
    if (reqData.passengerId !== passengerId) {
      throw new Error('FORBIDDEN: Only the passenger can confirm this request');
    }

    // Idempotency
    if (reqData.status === 'CONFIRMED') {
      return;
    }

    if (reqData.status !== 'ACCEPTED') {
      throw new Error('Only ACCEPTED requests can be confirmed');
    }

    // Check ride is not locked
    if (isRideLocked(currentStatus)) {
      throw new Error('Ride is locked — cannot confirm seats');
    }

    // Seat check
    const seatCheck = canConfirmSeat({
      availableSeats: rideData.availableSeats ?? 0,
      status: currentStatus,
    });
    if (!seatCheck.allowed) throw new Error(seatCheck.reason!);

    // Atomic seat deduction
    const seats = calculateSeatsAfterAction(
      'confirm',
      rideData.availableSeats ?? 0,
      rideData.reservedSeats ?? 0,
      rideData.totalSeats ?? 0
    );

    // Move from pendingRequests to confirmedPassengers
    const pendingRequests: RidePassenger[] = (rideData.pendingRequests || []).filter(
      (p: RidePassenger) => p.userId !== passengerId
    );

    const confirmedPassengers: RidePassenger[] = [
      ...(rideData.confirmedPassengers || []),
      {
        userId: passengerId,
        status: PassengerStatus.CONFIRMED,
        timestamp: now(),
        requestId,
        pickupPoint: reqData.pickupPoint || null,
        pickupPlaceName: reqData.pickupPlaceName || null,
      },
    ];

    // Compute new status
    const newStatus = computeRideStatusFromPassengers({
      confirmedPassengers,
      pendingRequests,
      status: currentStatus,
    });

    const rideUpdates: Record<string, any> = {
      availableSeats: seats.availableSeats,
      reservedSeats: seats.reservedSeats,
      confirmedPassengers,
      pendingRequests,
      updatedAt: now(),
    };

    // Mark as full if no seats
    if (seats.availableSeats === 0) {
      rideUpdates.status = 'full';
    }

    if (newStatus !== currentStatus && isValidTransition(currentStatus, newStatus)) {
      rideUpdates.lifecycleStatus = newStatus;
      if (seats.availableSeats > 0) {
        rideUpdates.status = toLegacyStatus(newStatus);
      }
      rideUpdates.transitionLog = logTransition(
        rideData,
        currentStatus,
        newStatus,
        passengerId,
        'Passenger confirmed seat'
      );
    }

    tx.update(ref, rideUpdates);
    tx.update(reqRef, {
      status: 'CONFIRMED',
      confirmedAt: now(),
      updatedAt: now(),
    });
  });

  console.log(`[RideLifecycle] Passenger ${passengerId} confirmed seat on ride ${rideId}`);
  return { success: true };
}

// ============================================================================
// SERVICE: CANCEL PASSENGER
// ============================================================================

/**
 * Cancel a passenger booking/request with seat restoration.
 * Validates timing rules — cancellation blocked after lock.
 */
export async function handleCancelPassenger(
  db: Firestore,
  university: string,
  rideId: string,
  requestId: string,
  cancelledBy: string,
  reason?: string
): Promise<{ success: boolean; wasConfirmed: boolean; seatRestored: boolean }> {
  const ref = rideRef(db, university, rideId);
  const reqRef = requestRef(db, university, rideId, requestId);

  const result = await db.runTransaction(async (tx: Transaction) => {
    const [rideSnap, reqSnap] = await Promise.all([tx.get(ref), tx.get(reqRef)]);

    if (!rideSnap.exists) throw new Error('Ride not found');
    if (!reqSnap.exists) throw new Error('Request not found');

    const rideData = rideSnap.data()!;
    const reqData = reqSnap.data()!;
    const currentStatus = getLifecycleStatus(rideData);

    // Check if ride is locked — no cancellation after lock
    if (isRideLocked(currentStatus)) {
      throw new Error('Cannot cancel — ride is locked');
    }

    // Check departure time (server-side validation)
    const departureMs = toMs(rideData.departureTime);
    const currentMs = nowMs();
    if (currentMs >= departureMs) {
      throw new Error('Cannot cancel — ride has already departed');
    }

    // Authorization: Only the passenger or the driver can cancel
    const passengerId = reqData.passengerId;
    const driverId = rideData.driverId || rideData.createdBy;
    if (cancelledBy !== passengerId && cancelledBy !== driverId) {
      throw new Error('FORBIDDEN: Only participant or driver can cancel');
    }

    // Idempotency
    if (reqData.status === 'CANCELLED') {
      return { wasConfirmed: false, seatRestored: false, idempotent: true };
    }

    const wasAccepted = reqData.status === 'ACCEPTED';
    const wasConfirmed = reqData.status === 'CONFIRMED';
    let seatRestored = false;

    // Determine seat action
    let seats = {
      availableSeats: rideData.availableSeats ?? 0,
      reservedSeats: rideData.reservedSeats ?? 0,
    };

    if (wasConfirmed) {
      seats = calculateSeatsAfterAction(
        'cancel_confirmed',
        rideData.availableSeats ?? 0,
        rideData.reservedSeats ?? 0,
        rideData.totalSeats ?? 0
      );
      seatRestored = true;
    } else if (wasAccepted) {
      seats = calculateSeatsAfterAction(
        'cancel_reserved',
        rideData.availableSeats ?? 0,
        rideData.reservedSeats ?? 0,
        rideData.totalSeats ?? 0
      );
      seatRestored = true;
    }

    // Update ride arrays
    const pendingRequests = (rideData.pendingRequests || []).filter(
      (p: RidePassenger) => p.userId !== passengerId
    );

    const confirmedPassengers = (rideData.confirmedPassengers || []).filter(
      (p: RidePassenger) => p.userId !== passengerId
    );

    const cancelledPassengers: RidePassenger[] = [
      ...(rideData.cancelledPassengers || []),
      {
        userId: passengerId,
        status: PassengerStatus.CANCELLED,
        timestamp: now(),
        requestId,
      },
    ];

    // Compute new status
    const newStatus = computeRideStatusFromPassengers({
      confirmedPassengers,
      pendingRequests,
      status: currentStatus,
    });

    const rideUpdates: Record<string, any> = {
      availableSeats: seats.availableSeats,
      reservedSeats: seats.reservedSeats,
      pendingRequests,
      confirmedPassengers,
      cancelledPassengers,
      updatedAt: now(),
    };

    if (newStatus !== currentStatus && isValidTransition(currentStatus, newStatus)) {
      rideUpdates.lifecycleStatus = newStatus;
      rideUpdates.status = toLegacyStatus(newStatus);
      rideUpdates.transitionLog = logTransition(
        rideData,
        currentStatus,
        newStatus,
        cancelledBy,
        reason || 'Passenger cancelled'
      );
    }

    tx.update(ref, rideUpdates);
    tx.update(reqRef, {
      status: 'CANCELLED',
      cancelledAt: now(),
      cancelledBy,
      cancellationReason: reason || 'No reason provided',
      isLateCancellation: wasConfirmed,
      updatedAt: now(),
    });

    return { wasConfirmed, seatRestored, idempotent: false };
  });

  console.log(
    `[RideLifecycle] Cancelled passenger on ride ${rideId} (confirmed=${result.wasConfirmed}, seatRestored=${result.seatRestored})`
  );

  return { success: true, wasConfirmed: result.wasConfirmed, seatRestored: result.seatRestored };
}

// ============================================================================
// SERVICE: LOCK RIDE (called by scheduler)
// ============================================================================

/**
 * Lock a ride when departure time is reached.
 * Transitions to LOCKED → IN_PROGRESS or FAILED based on passenger count.
 */
export async function lockRideAtDeparture(
  db: Firestore,
  university: string,
  rideId: string
): Promise<{
  success: boolean;
  finalStatus: RideStatus;
  confirmedCount: number;
}> {
  const ref = rideRef(db, university, rideId);

  const result = await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Ride not found');

    const data = snap.data()!;
    const currentStatus = getLifecycleStatus(data);

    // Already locked or beyond — skip
    if (isRideLocked(currentStatus) || isTerminalState(currentStatus)) {
      return {
        finalStatus: currentStatus,
        confirmedCount: (data.confirmedPassengers || []).length,
        alreadyProcessed: true,
      };
    }

    // Verify departure time has passed (SERVER time)
    const departureMs = toMs(data.departureTime);
    const currentMs = nowMs();
    if (!shouldLockRide(departureMs, currentMs)) {
      throw new Error('Departure time has not been reached yet');
    }

    const confirmedPassengers: RidePassenger[] = data.confirmedPassengers || [];
    const confirmedCount = confirmedPassengers.length;

    // Step 1: Lock the ride
    let transLog = logTransition(data, currentStatus, RideStatus.LOCKED, 'system', 'Departure time reached');

    // Step 2: Determine post-lock status
    const postLockStatus = determinePostLockStatus(confirmedCount);

    transLog = [
      ...transLog,
      createTransitionEntry(RideStatus.LOCKED, postLockStatus, 'system', now(),
        postLockStatus === RideStatus.IN_PROGRESS
          ? `${confirmedCount} confirmed passengers`
          : 'No confirmed passengers'
      ),
    ];

    // Auto-cancel all pending requests
    const pendingRequests: RidePassenger[] = (data.pendingRequests || []).map(
      (p: RidePassenger) => ({
        ...p,
        status: PassengerStatus.CANCELLED,
        timestamp: now(),
      })
    );

    const cancelledPassengers: RidePassenger[] = [
      ...(data.cancelledPassengers || []),
      ...pendingRequests,
    ];

    const updates: Record<string, any> = {
      lifecycleStatus: postLockStatus,
      status: toLegacyStatus(postLockStatus),
      legacyStatus: toLegacyStatus(postLockStatus),
      pendingRequests: [],
      cancelledPassengers,
      reservedSeats: 0, // No more reserved seats after lock
      transitionLog: transLog,
      updatedAt: now(),
    };

    // If IN_PROGRESS, set completion window
    if (postLockStatus === RideStatus.IN_PROGRESS) {
      updates.completionWindowEnd = admin.firestore.Timestamp.fromMillis(
        calculateCompletionWindowEnd(departureMs)
      );
    }

    tx.update(ref, updates);

    return { finalStatus: postLockStatus, confirmedCount, alreadyProcessed: false };
  });

  if (!result.alreadyProcessed) {
    console.log(
      `[RideLifecycle] Ride ${rideId} locked → ${result.finalStatus} (${result.confirmedCount} passengers)`
    );
  }

  return {
    success: true,
    finalStatus: result.finalStatus,
    confirmedCount: result.confirmedCount,
  };
}

// ============================================================================
// SERVICE: COMPLETION WINDOW CHECK (called by scheduler)
// ============================================================================

/**
 * Transition ride to COMPLETION_WINDOW when timing is right.
 */
export async function openCompletionWindow(
  db: Firestore,
  university: string,
  rideId: string
): Promise<{ success: boolean }> {
  const ref = rideRef(db, university, rideId);

  await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Ride not found');

    const data = snap.data()!;
    const currentStatus = getLifecycleStatus(data);

    if (currentStatus !== RideStatus.IN_PROGRESS) {
      return; // Only IN_PROGRESS rides can enter completion window
    }

    const departureMs = toMs(data.departureTime);
    const windowOpen = calculateCompletionWindowOpenTime(departureMs);
    const windowEnd = calculateCompletionWindowEnd(departureMs);

    if (nowMs() < windowOpen) {
      return;
    }

    // The window opens once the ride has been in progress for a reasonable time
    // For now, we open it immediately after IN_PROGRESS for driver action
    const transLog = logTransition(
      data,
      currentStatus,
      RideStatus.COMPLETION_WINDOW,
      'system',
      'Completion window opened'
    );

    tx.update(ref, {
      lifecycleStatus: RideStatus.COMPLETION_WINDOW,
      status: toLegacyStatus(RideStatus.COMPLETION_WINDOW),
      completionWindowEnd: admin.firestore.Timestamp.fromMillis(windowEnd),
      transitionLog: transLog,
      updatedAt: now(),
    });
  });

  console.log(`[RideLifecycle] Ride ${rideId} → COMPLETION_WINDOW`);
  return { success: true };
}

// ============================================================================
// SERVICE: MARK RIDE COMPLETED
// ============================================================================

/**
 * Driver marks ride as completed. Opens ratings.
 */
export async function markRideCompleted(
  db: Firestore,
  university: string,
  rideId: string,
  driverId: string
): Promise<{ success: boolean }> {
  const ref = rideRef(db, university, rideId);

  await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Ride not found');

    const data = snap.data()!;
    const currentStatus = getLifecycleStatus(data);

    // Authorization
    const rideDriver = data.driverId || data.createdBy;
    if (rideDriver !== driverId) {
      throw new Error('FORBIDDEN: Only the driver can mark ride as completed');
    }

    // Must be in COMPLETION_WINDOW (or IN_PROGRESS for flexibility)
    if (currentStatus !== RideStatus.COMPLETION_WINDOW && currentStatus !== RideStatus.IN_PROGRESS) {
      throw new Error(`Cannot complete ride in status: ${currentStatus}`);
    }

    const normalized = normalizeConfirmedPassengers(data.confirmedPassengers || []);
    const completionCheck = isCompletionReady(normalized);
    if (!completionCheck.ready) {
      throw new Error(`Cannot complete ride — pending passenger actions: ${completionCheck.missing.join(', ')}`);
    }

    const transLog = logTransition(
      data,
      currentStatus,
      RideStatus.COMPLETED,
      driverId,
      'Driver marked ride as completed'
    );

    tx.update(ref, {
      lifecycleStatus: RideStatus.COMPLETED,
      status: 'completed',
      legacyStatus: 'completed',
      postRideFormRequired: true,
      postRideFormSubmitted: false,
      postRideSubmittedAt: null,
      confirmedPassengers: normalized,
      ratingsOpen: true,
      transitionLog: transLog,
      updatedAt: now(),
      completedAt: now(),
    });
  });

  console.log(`[RideLifecycle] Ride ${rideId} → COMPLETED by driver ${driverId}`);
  return { success: true };
}

// ============================================================================
// SERVICE: MARK PASSENGER NO-SHOW
// ============================================================================

/**
 * Driver marks a passenger as no-show during completion window.
 */
export async function markPassengerNoShow(
  db: Firestore,
  university: string,
  rideId: string,
  driverId: string,
  passengerId: string
): Promise<{ success: boolean }> {
  const ref = rideRef(db, university, rideId);

  await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Ride not found');

    const data = snap.data()!;
    const currentStatus = getLifecycleStatus(data);

    // Authorization
    const rideDriver = data.driverId || data.createdBy;
    if (rideDriver !== driverId) {
      throw new Error('FORBIDDEN: Only the driver can mark no-shows');
    }

    // Must be in COMPLETION_WINDOW or IN_PROGRESS
    if (currentStatus !== RideStatus.COMPLETION_WINDOW && currentStatus !== RideStatus.IN_PROGRESS) {
      throw new Error(`Cannot mark no-show in status: ${currentStatus}`);
    }

    // Find passenger in confirmed list
    const confirmedPassengers: RidePassenger[] = (data.confirmedPassengers || []).map(
      (p: RidePassenger) => {
        if (p.userId === passengerId) {
          return {
            ...p,
            status: PassengerStatus.NO_SHOW,
            timestamp: now(),
            driverReview: 'no-show',
            driverReviewAt: now(),
          };
        }
        return p;
      }
    );

    // Verify the passenger was actually found and updated
    const foundPassenger = confirmedPassengers.find((p) => p.userId === passengerId);
    if (!foundPassenger) {
      throw new Error('Passenger not found in confirmed list');
    }

    tx.update(ref, {
      confirmedPassengers,
      updatedAt: now(),
    });
  });

  console.log(`[RideLifecycle] Passenger ${passengerId} marked as NO_SHOW on ride ${rideId}`);
  return { success: true };
}

// ============================================================================
// SERVICE: DRIVER REVIEW PASSENGER (ARRIVED / NO-SHOW)
// ============================================================================

export async function reviewPassengerArrival(
  db: Firestore,
  university: string,
  rideId: string,
  driverId: string,
  passengerId: string,
  review: 'arrived' | 'no-show'
): Promise<{ success: boolean }> {
  const ref = rideRef(db, university, rideId);

  await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Ride not found');

    const data = snap.data()!;
    const currentStatus = getLifecycleStatus(data);

    const rideDriver = data.driverId || data.createdBy;
    if (rideDriver !== driverId) {
      throw new Error('FORBIDDEN: Only the driver can review passengers');
    }

    if (currentStatus !== RideStatus.COMPLETION_WINDOW && currentStatus !== RideStatus.IN_PROGRESS) {
      throw new Error(`Cannot review passengers in status: ${currentStatus}`);
    }

    const normalized = normalizeConfirmedPassengers(data.confirmedPassengers || []);
    let found = false;

    const updated = normalized.map((p) => {
      if (p.userId !== passengerId) return p;
      found = true;
      return {
        ...p,
        status: review === 'no-show' ? PassengerStatus.NO_SHOW : PassengerStatus.CONFIRMED,
        driverReview: review,
        driverReviewAt: now(),
      };
    });

    if (!found) {
      throw new Error('Passenger not found in confirmed list');
    }

    tx.update(ref, {
      confirmedPassengers: updated,
      updatedAt: now(),
    });
  });

  console.log(`[RideLifecycle] Driver reviewed passenger ${passengerId} as ${review} on ride ${rideId}`);
  return { success: true };
}

// ============================================================================
// SERVICE: PASSENGER COMPLETION / CANCEL WITH REASON
// ============================================================================

export async function submitPassengerCompletion(
  db: Firestore,
  university: string,
  rideId: string,
  passengerId: string,
  action: 'completed' | 'cancelled',
  reason?: string
): Promise<{ success: boolean }> {
  const ref = rideRef(db, university, rideId);

  if (action === 'cancelled' && (!reason || !String(reason).trim())) {
    throw new Error('Cancellation reason required');
  }

  await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Ride not found');

    const data = snap.data()!;
    const currentStatus = getLifecycleStatus(data);

    if (currentStatus !== RideStatus.COMPLETION_WINDOW && currentStatus !== RideStatus.IN_PROGRESS) {
      throw new Error(`Cannot submit completion in status: ${currentStatus}`);
    }

    const normalized = normalizeConfirmedPassengers(data.confirmedPassengers || []);
    let found = false;

    const updated = normalized.map((p) => {
      if (p.userId !== passengerId) return p;
      found = true;
      const updated: any = {
        ...p,
        status: action === 'cancelled' ? PassengerStatus.CANCELLED : PassengerStatus.COMPLETED,
        passengerCompletion: action,
        passengerCompletionAt: now(),
      };
      // Only include completionReason if action is 'cancelled' to avoid undefined values
      if (action === 'cancelled') {
        updated.completionReason = reason;
      }
      return updated;
    });

    if (!found) {
      throw new Error('Passenger not found in confirmed list');
    }

    tx.update(ref, {
      confirmedPassengers: updated,
      updatedAt: now(),
    });
  });

  console.log(`[RideLifecycle] Passenger ${passengerId} submitted ${action} for ride ${rideId}`);
  return { success: true };
}

// ============================================================================
// SERVICE: SUBMIT RATING
// ============================================================================

/**
 * Submit a rating. Server-side validation ensures only participants can rate.
 * Ratings are anonymous — only aggregate scores exposed.
 */
export async function submitRating(
  db: Firestore,
  university: string,
  rideId: string,
  raterId: string,
  ratedUserId: string,
  raterRole: 'driver' | 'passenger',
  rating: number
): Promise<{ success: boolean }> {
  // Validate rating value
  if (!isValidRating(rating)) {
    throw new Error(`Invalid rating: must be between ${LIFECYCLE_CONSTANTS.MIN_RATING} and ${LIFECYCLE_CONSTANTS.MAX_RATING}`);
  }

  const ref = rideRef(db, university, rideId);
  const ratingId = `${rideId}_${raterId}_${ratedUserId}`;
  const ratingRef = db.doc(`universities/${university}/lifecycle_ratings/${ratingId}`);
  const statsRef = db.doc(`universities/${university}/user_rating_stats/${ratedUserId}`);

  await db.runTransaction(async (tx: Transaction) => {
    const [rideSnap, existingRating, statsSnap] = await Promise.all([
      tx.get(ref),
      tx.get(ratingRef),
      tx.get(statsRef),
    ]);

    if (!rideSnap.exists) throw new Error('Ride not found');

    // Prevent duplicate ratings
    if (existingRating.exists) {
      throw new Error('You have already rated this user for this ride');
    }

    const rideData = rideSnap.data()!;

    // Validate this user can rate
    const check = canUserRate(raterId, {
      driverId: rideData.driverId,
      confirmedPassengers: rideData.confirmedPassengers || [],
      status: getLifecycleStatus(rideData),
      ratingsOpen: rideData.ratingsOpen ?? false,
    });

    if (!check.allowed) {
      throw new Error(check.reason!);
    }

    // For driver rating passengers, verify the rated user is a confirmed passenger
    if (raterRole === 'driver') {
      const isPassenger = (rideData.confirmedPassengers || []).some(
        (p: RidePassenger) => p.userId === ratedUserId
      );
      if (!isPassenger) {
        throw new Error('Can only rate confirmed passengers');
      }
    }

    // For passenger rating driver, verify the rated user is the driver
    if (raterRole === 'passenger') {
      if (ratedUserId !== rideData.driverId) {
        throw new Error('Passengers can only rate the driver');
      }
    }

    // Create rating document (anonymous)
    const ratingDoc: LifecycleRating = {
      id: ratingId,
      rideId,
      raterId,
      ratedUserId,
      raterRole,
      rating,
      createdAt: now(),
      anonymous: true,
    };

    tx.set(ratingRef, ratingDoc);

    // Update aggregate stats
    const currentStats = statsSnap.exists ? (statsSnap.data() as Partial<UserRatingStats>) : {};

    if (raterRole === 'passenger') {
      // Passenger rated a driver → update driver stats
      const currentTotal = (currentStats.driverTotalRating || 0) + rating;
      const currentCount = (currentStats.driverRatingCount || 0) + 1;
      tx.set(
        statsRef,
        {
          driverTotalRating: currentTotal,
          driverRatingCount: currentCount,
          driverAverageRating: currentTotal / currentCount,
          lastUpdated: now(),
        },
        { merge: true }
      );
    } else {
      // Driver rated a passenger → update passenger stats
      const currentTotal = (currentStats.passengerTotalRating || 0) + rating;
      const currentCount = (currentStats.passengerRatingCount || 0) + 1;
      tx.set(
        statsRef,
        {
          passengerTotalRating: currentTotal,
          passengerRatingCount: currentCount,
          passengerAverageRating: currentTotal / currentCount,
          lastUpdated: now(),
        },
        { merge: true }
      );
    }
  });

  console.log(
    `[RideLifecycle] Rating submitted: ${raterId} (${raterRole}) rated ${ratedUserId} with ${rating}/5 on ride ${rideId}`
  );

  return { success: true };
}

// ============================================================================
// SERVICE: CANCEL RIDE (by driver)
// ============================================================================

/**
 * Driver cancels entire ride. Restores all seats, notifies all passengers.
 */
export async function cancelRide(
  db: Firestore,
  university: string,
  rideId: string,
  driverId: string,
  reason?: string
): Promise<{ success: boolean; affectedPassengers: string[] }> {
  const ref = rideRef(db, university, rideId);

  const result = await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Ride not found');

    const data = snap.data()!;
    const currentStatus = getLifecycleStatus(data);

    // Authorization
    const rideDriver = data.driverId || data.createdBy;
    if (rideDriver !== driverId) {
      throw new Error('FORBIDDEN: Only the driver can cancel the ride');
    }

    // Cannot cancel after lock
    if (isRideLocked(currentStatus)) {
      throw new Error('Cannot cancel — ride is locked');
    }

    if (!isCancellationAllowed(currentStatus)) {
      throw new Error(`Cannot cancel ride in status: ${currentStatus}`);
    }

    // Collect all affected passengers
    const allPassengers = [
      ...(data.confirmedPassengers || []),
      ...(data.pendingRequests || []),
    ];
    const affectedPassengerIds = allPassengers.map((p: RidePassenger) => p.userId);

    const transLog = logTransition(
      data,
      currentStatus,
      RideStatus.CANCELLED,
      driverId,
      reason || 'Driver cancelled ride'
    );

    tx.update(ref, {
      lifecycleStatus: RideStatus.CANCELLED,
      status: 'cancelled',
      legacyStatus: 'cancelled',
      availableSeats: data.totalSeats ?? 0,
      reservedSeats: 0,
      pendingRequests: [],
      confirmedPassengers: [],
      cancelledPassengers: [
        ...(data.cancelledPassengers || []),
        ...allPassengers.map((p: RidePassenger) => ({
          ...p,
          status: PassengerStatus.CANCELLED,
          timestamp: now(),
        })),
      ],
      cancelledAt: now(),
      cancelledBy: driverId,
      cancellationReason: reason || 'Driver cancelled',
      transitionLog: transLog,
      ratingsOpen: false,
      updatedAt: now(),
    });

    return { affectedPassengerIds };
  });

  console.log(
    `[RideLifecycle] Ride ${rideId} CANCELLED by driver ${driverId}, ${result.affectedPassengerIds.length} passengers affected`
  );

  return { success: true, affectedPassengers: result.affectedPassengerIds };
}

// ============================================================================
// SERVICE: GET RIDE LIFECYCLE STATE
// ============================================================================

/**
 * Read the current lifecycle state of a ride.
 */
export async function getRideLifecycleState(
  db: Firestore,
  university: string,
  rideId: string
): Promise<LifecycleRide | null> {
  const ref = rideRef(db, university, rideId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const data = snap.data()!;
  return {
    rideId,
    driverId: data.driverId,
    status: getLifecycleStatus(data),
    departureTime: data.departureTime,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    totalSeats: data.totalSeats ?? 0,
    availableSeats: data.availableSeats ?? 0,
    reservedSeats: data.reservedSeats ?? 0,
    confirmedPassengers: data.confirmedPassengers || [],
    pendingRequests: data.pendingRequests || [],
    cancelledPassengers: data.cancelledPassengers || [],
    completionWindowEnd: data.completionWindowEnd || null,
    ratingsOpen: data.ratingsOpen ?? false,
    from: data.from || '',
    to: data.to || '',
    price: data.price ?? 0,
    transportMode: data.transportMode || 'car',
    genderAllowed: data.genderAllowed || 'both',
    transitionLog: data.transitionLog || [],
  };
}
