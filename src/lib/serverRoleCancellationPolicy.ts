import admin from 'firebase-admin';
import { formatRideLockMessage, RideActionRole } from '@/lib/rideActionLock';

type AdminDb = FirebaseFirestore.Firestore;
const LAST_MINUTE_WINDOW_MINUTES = 30;

function toDateValue(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value === 'number') return new Date(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumber(value: any, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function normalizeStatus(value: any): string {
  return String(value || '').trim().toLowerCase();
}

function isCompletedStatus(value: any): boolean {
  const status = normalizeStatus(value);
  return status === 'completed';
}

function isCancelledStatus(value: any): boolean {
  const status = normalizeStatus(value);
  return status.includes('cancel');
}

function isLastMinuteCancellation(payload: any): boolean {
  if (payload?.lastMinuteCancellation === true) return true;

  const cancelledAt = toDateValue(payload?.cancelledAt);
  const departureTime =
    toDateValue(payload?.departureTime)
    || toDateValue(payload?.rideDepartureTime)
    || toDateValue(payload?.rideData?.departureTime);

  if (!cancelledAt || !departureTime) return false;
  const diffMinutes = (departureTime.getTime() - cancelledAt.getTime()) / (60 * 1000);
  return diffMinutes >= 0 && diffMinutes <= LAST_MINUTE_WINDOW_MINUTES;
}

function isDriverWholeRideCancellation(ride: any, userId: string): boolean {
  const cancelledBy = String(ride?.cancelledBy || '');
  const status = normalizeStatus(ride?.status || ride?.legacyStatus || ride?.lifecycleStatus);
  const matchesCanceller = !cancelledBy || cancelledBy === userId || cancelledBy.toLowerCase() === 'driver';
  return matchesCanceller && isCancelledStatus(status);
}

function isDriverPassengerRemovalCancellation(booking: any, userId: string): boolean {
  if (!isCancelledStatus(booking?.status)) return false;
  const cancelledBy = String(booking?.cancelledBy || '').toLowerCase();
  const matchesCanceller = cancelledBy === 'driver' || cancelledBy === String(userId).toLowerCase();
  if (!matchesCanceller) return false;

  const scope = normalizeStatus(booking?.cancellationScope);
  if (scope === 'ride_cancelled_by_driver') return false;

  const reason = normalizeStatus(booking?.cancellationReason);
  if (reason.includes('driver cancelled the ride')) return false;

  return booking?.isLateCancellation === true;
}

function isPassengerConfirmedCancellation(booking: any, userId: string): boolean {
  if (!isCancelledStatus(booking?.status)) return false;
  const cancelledBy = String(booking?.cancelledBy || '').toLowerCase();
  const matchesCanceller = cancelledBy === 'passenger' || cancelledBy === String(userId).toLowerCase();
  if (!matchesCanceller) return false;
  return booking?.isLateCancellation === true;
}

function getPolicyField(role: RideActionRole): 'driverCancellationPolicy' | 'passengerCancellationPolicy' {
  return role === 'driver' ? 'driverCancellationPolicy' : 'passengerCancellationPolicy';
}

function getOtherPolicyField(role: RideActionRole): 'driverCancellationPolicy' | 'passengerCancellationPolicy' {
  return role === 'driver' ? 'passengerCancellationPolicy' : 'driverCancellationPolicy';
}

async function countDriverWindowStats(
  db: AdminDb,
  university: string,
  userId: string,
  windowStart: Date
): Promise<{ completedRides: number; cancelledRideUnits: number; cancelledWholeRides: number; cancelledPassengerUnits: number }> {
  const ridesSnap = await db
    .collection(`universities/${university}/rides`)
    .where('driverId', '==', userId)
    .get();

  const rides = ridesSnap.docs.map((doc) => doc.data() as any);

  let completedRides = 0;
  let cancelledWholeRides = 0;
  let cancelledPassengerUnits = 0;

  for (const ride of rides) {
    const completionDate =
      toDateValue(ride?.completedAt)
      || toDateValue(ride?.departureTime)
      || toDateValue(ride?.createdAt);
    if (completionDate && completionDate >= windowStart && isCompletedStatus(ride?.status || ride?.lifecycleStatus || ride?.legacyStatus)) {
      completedRides += 1;
    }

    if (!isDriverWholeRideCancellation(ride, userId)) continue;
    const cancelledAt = toDateValue(ride?.cancelledAt);
    if (!cancelledAt || cancelledAt < windowStart) continue;

    const confirmedCount = toNumber(
      ride?.cancelledConfirmedPassengersCount,
      Array.isArray(ride?.confirmedPassengers) ? ride.confirmedPassengers.length : 0,
    );
    if (confirmedCount < 1) continue;

    const multiplier = isLastMinuteCancellation(ride) ? 2 : 1;
    const units = toNumber(ride?.cancellationPenaltyUnits, multiplier);
    cancelledWholeRides += units;
  }

  const bookingsSnap = await db
    .collection(`universities/${university}/bookings`)
    .where('driverId', '==', userId)
    .get();

  for (const bookingDoc of bookingsSnap.docs) {
    const booking = bookingDoc.data() as any;
    if (!isDriverPassengerRemovalCancellation(booking, userId)) continue;

    const cancelledAt = toDateValue(booking?.cancelledAt);
    if (!cancelledAt || cancelledAt < windowStart) continue;

    const seats = Math.max(1, toNumber(booking?.rideTotalSeats, toNumber(booking?.totalSeats, toNumber(booking?.seats, 4))));
    const multiplier = isLastMinuteCancellation(booking) ? 2 : 1;
    const defaultUnits = (1 / seats) * multiplier;
    const units = toNumber(booking?.cancellationPenaltyUnits, defaultUnits);
    cancelledPassengerUnits += units;
  }

  return {
    completedRides,
    cancelledRideUnits: round2(cancelledWholeRides + cancelledPassengerUnits),
    cancelledWholeRides: round2(cancelledWholeRides),
    cancelledPassengerUnits: round2(cancelledPassengerUnits),
  };
}

async function countPassengerWindowStats(
  db: AdminDb,
  university: string,
  userId: string,
  windowStart: Date
): Promise<{ completedRides: number; cancelledRideUnits: number; cancelledWholeRides: number; cancelledPassengerUnits: number }> {
  const bookingsSnap = await db
    .collection(`universities/${university}/bookings`)
    .where('passengerId', '==', userId)
    .get();

  let completedRides = 0;
  let cancelledPassengerUnits = 0;

  for (const bookingDoc of bookingsSnap.docs) {
    const booking = bookingDoc.data() as any;

    const completionDate =
      toDateValue(booking?.completedAt)
      || toDateValue(booking?.passengerCompletionAt)
      || toDateValue(booking?.createdAt);
    const completedByOutcome = normalizeStatus(booking?.passengerCompletion) === 'completed';
    const completedByStatus = isCompletedStatus(booking?.status || booking?.lifecycleStatus);
    if (completionDate && completionDate >= windowStart && (completedByOutcome || completedByStatus)) {
      completedRides += 1;
    }

    if (!isPassengerConfirmedCancellation(booking, userId)) continue;

    const cancelledAt = toDateValue(booking?.cancelledAt);
    if (!cancelledAt || cancelledAt < windowStart) continue;

    const multiplier = isLastMinuteCancellation(booking) ? 2 : 1;
    const units = toNumber(booking?.cancellationPenaltyUnits, multiplier);
    cancelledPassengerUnits += units;
  }

  return {
    completedRides,
    cancelledRideUnits: round2(cancelledPassengerUnits),
    cancelledWholeRides: 0,
    cancelledPassengerUnits: round2(cancelledPassengerUnits),
  };
}

export interface CancellationPolicyResult {
  locked: boolean;
  lockUntil?: Date;
  lockDays?: number;
  message?: string;
  totalRides: number;
  cancelledRides: number;
  cancellationRate: number;
}

export async function evaluateAndApplyRoleCancellationPolicy(
  db: AdminDb,
  university: string,
  userId: string,
  role: RideActionRole,
  thresholdRate: number = 35,
  minimumRides: number = 3
): Promise<CancellationPolicyResult> {
  const now = new Date();
  const userRef = db.doc(`universities/${university}/users/${userId}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return {
      locked: false,
      totalRides: 0,
      cancelledRides: 0,
      cancellationRate: 0,
    };
  }

  const userData = userSnap.data() as any;
  const policyField = getPolicyField(role);
  const otherPolicyField = getOtherPolicyField(role);
  const policyData = userData?.[policyField] || {};

  const previousWindowStart = toDateValue(policyData?.windowStartAt);
  const previousLockUntil = toDateValue(policyData?.lockUntil);

  let windowStart = previousWindowStart || now;
  if (previousLockUntil && now >= previousLockUntil && windowStart.getTime() < previousLockUntil.getTime()) {
    windowStart = previousLockUntil;
  }

  const counts = role === 'driver'
    ? await countDriverWindowStats(db, university, userId, windowStart)
    : await countPassengerWindowStats(db, university, userId, windowStart);

  const completedRides = counts.completedRides;
  const cancelledRides = round2(counts.cancelledRideUnits);
  const totalRides = round2(completedRides + cancelledRides);

  const cancellationRate = totalRides > 0
    ? round2((cancelledRides / totalRides) * 100)
    : 0;

  const exceedsThreshold = totalRides >= minimumRides && cancellationRate >= thresholdRate;
  const currentStrike = Number(policyData?.strikeLevel || 0);
  const nextStrike = exceedsThreshold ? (currentStrike >= 1 ? 2 : 1) : currentStrike;
  const lockDays = exceedsThreshold ? (nextStrike === 1 ? 7 : 14) : 0;
  const lockUntil = exceedsThreshold
    ? new Date(now.getTime() + lockDays * 24 * 60 * 60 * 1000)
    : undefined;

  const updatedPolicy: Record<string, any> = {
    windowStartAt: admin.firestore.Timestamp.fromDate(windowStart),
    strikeLevel: nextStrike,
    completedRidesWindow: round2(completedRides),
    totalRidesWindow: totalRides,
    cancelledRidesWindow: cancelledRides,
    cancelledWholeRidesWindow: counts.cancelledWholeRides,
    cancelledPassengerUnitsWindow: counts.cancelledPassengerUnits,
    cancellationRate,
    minimumRidesThreshold: minimumRides,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (lockUntil) {
    updatedPolicy.lockUntil = admin.firestore.Timestamp.fromDate(lockUntil);
  } else if (previousLockUntil && now >= previousLockUntil) {
    updatedPolicy.lockUntil = admin.firestore.FieldValue.delete();
  }

  const updates: Record<string, any> = {
    [policyField]: updatedPolicy,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (lockUntil) {
    updates.accountLockUntil = admin.firestore.Timestamp.fromDate(lockUntil);
    updates.accountLockDays = lockDays;
    updates.accountLockRole = role;
    updates.accountLockReason = 'many_cancellations';
  } else {
    const activeOtherRoleLock = toDateValue(userData?.[otherPolicyField]?.lockUntil);
    const activeGenericLock = toDateValue(userData?.accountLockUntil);
    const hasOtherActiveLock = !!activeOtherRoleLock && now < activeOtherRoleLock;
    const hasGenericActiveLock = !!activeGenericLock && now < activeGenericLock;

    if (!hasOtherActiveLock && !hasGenericActiveLock) {
      updates.accountLockUntil = admin.firestore.FieldValue.delete();
      updates.accountLockDays = admin.firestore.FieldValue.delete();
      updates.accountLockRole = admin.firestore.FieldValue.delete();
      updates.accountLockReason = admin.firestore.FieldValue.delete();
    }
  }

  await userRef.set(updates, { merge: true });

  return {
    locked: !!lockUntil,
    lockUntil,
    lockDays: lockUntil ? lockDays : undefined,
    message: lockUntil ? formatRideLockMessage(lockUntil, lockDays) : undefined,
    totalRides,
    cancelledRides,
    cancellationRate,
  };
}
