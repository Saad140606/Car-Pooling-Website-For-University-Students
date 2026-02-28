import admin from 'firebase-admin';
import { formatRideLockMessage, RideActionRole } from '@/lib/rideActionLock';

type AdminDb = FirebaseFirestore.Firestore;

function toDateValue(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value === 'number') return new Date(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isDriverPreDepartureCancellation(ride: any, userId: string): boolean {
  const cancelledBy = String(ride?.cancelledBy || '');
  const status = String(ride?.status || ride?.legacyStatus || ride?.lifecycleStatus || '').toLowerCase();
  const matchesCanceller = !cancelledBy || cancelledBy === userId || cancelledBy.toLowerCase() === 'driver';
  if (!matchesCanceller || !status.includes('cancel')) return false;
  if (ride?.cancelledBeforeDeparture === true) return true;

  const cancelledAt = toDateValue(ride?.cancelledAt);
  const departureTime = toDateValue(ride?.departureTime);
  if (cancelledAt && departureTime) {
    return cancelledAt.getTime() < departureTime.getTime();
  }
  return false;
}

function isPassengerPreDepartureCancellation(request: any, userId: string): boolean {
  const cancelledBy = String(request?.cancelledBy || '');
  const status = String(request?.status || '').toLowerCase();
  const matchesCanceller = !cancelledBy || cancelledBy === userId || cancelledBy.toLowerCase() === 'passenger';
  if (!matchesCanceller || !status.includes('cancel')) return false;
  if (request?.cancelledBeforeDeparture === true) return true;
  if (request?.isLateCancellation === false) return true;
  return false;
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
): Promise<{ totalRides: number; cancelledRides: number }> {
  const startTs = admin.firestore.Timestamp.fromDate(windowStart);
  const ridesSnap = await db
    .collection(`universities/${university}/rides`)
    .where('driverId', '==', userId)
    .where('createdAt', '>=', startTs)
    .get();

  const rides = ridesSnap.docs.map((doc) => doc.data());
  const cancelledRides = rides.filter((ride) => isDriverPreDepartureCancellation(ride, userId)).length;
  return { totalRides: rides.length, cancelledRides };
}

async function countPassengerWindowStats(
  db: AdminDb,
  university: string,
  userId: string,
  windowStart: Date
): Promise<{ totalRides: number; cancelledRides: number }> {
  const requestsSnap = await db.collectionGroup('requests').where('passengerId', '==', userId).get();

  const requests = requestsSnap.docs
    .filter((doc) => doc.ref.path.includes(`/universities/${university}/`))
    .map((doc) => doc.data())
    .filter((request) => {
      const createdAt = toDateValue((request as any)?.createdAt);
      return !!createdAt && createdAt.getTime() >= windowStart.getTime();
    });

  const cancelledRides = requests.filter((request) => isPassengerPreDepartureCancellation(request, userId)).length;
  return { totalRides: requests.length, cancelledRides };
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

  const { totalRides, cancelledRides } = role === 'driver'
    ? await countDriverWindowStats(db, university, userId, windowStart)
    : await countPassengerWindowStats(db, university, userId, windowStart);

  const cancellationRate = totalRides > 0
    ? Math.round((cancelledRides / totalRides) * 100)
    : 0;

  const exceedsThreshold = totalRides >= minimumRides && cancellationRate > thresholdRate;
  const currentStrike = Number(policyData?.strikeLevel || 0);
  const nextStrike = exceedsThreshold ? (currentStrike >= 1 ? 2 : 1) : currentStrike;
  const lockDays = exceedsThreshold ? (nextStrike === 1 ? 7 : 14) : 0;
  const lockUntil = exceedsThreshold
    ? new Date(now.getTime() + lockDays * 24 * 60 * 60 * 1000)
    : undefined;

  const updatedPolicy: Record<string, any> = {
    windowStartAt: admin.firestore.Timestamp.fromDate(windowStart),
    strikeLevel: nextStrike,
    totalRidesWindow: totalRides,
    cancelledRidesWindow: cancelledRides,
    cancellationRate,
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
