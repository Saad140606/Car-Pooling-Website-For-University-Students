/**
 * Ride Cancellation Service
 *
 * Comprehensive cancellation system handling:
 * - Passenger request/booking cancellation
 * - Driver ride cancellation with automatic passenger notification
 * - Departure time validation
 * - Cancellation tracking for abuse prevention
 * - Account locking for high cancellation rates
 * - Edge case handling (double-click, network retries, etc.)
 */

import { Firestore, Timestamp, doc, getDoc, updateDoc, query, where, collection, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';

function snapshotExists(snapshot: any): boolean {
  if (!snapshot) return false;
  if (typeof snapshot.exists === 'function') return snapshot.exists();
  return !!snapshot.exists;
}

export interface CancellationValidationResult {
  allowed: boolean;
  reason?: string;
  hasStarted?: boolean;
  minutesUntilDeparture?: number;
}

export interface CancellationResult {
  success: boolean;
  message: string;
  accountLocked?: boolean;
  lockExpiresAt?: Date;
  cancellationRate?: number;
}

/**
 * Validate cancellation permission based on departure time
 * Returns false if ride has already started
 */
export async function validateCancellationPermission(
  firestoreOrDb: any, // Firestore instance or admin database
  university: string,
  rideId: string,
  isAdminContext: boolean = false
): Promise<CancellationValidationResult> {
  try {
    const rideRef = doc(firestoreOrDb, `universities/${university}/rides/${rideId}`);
    const rideSnap = isAdminContext 
      ? await (firestoreOrDb as any).doc(rideRef.path).get() 
      : await getDoc(rideRef);

    if (!snapshotExists(rideSnap)) {
      return {
        allowed: false,
        reason: 'Ride not found'
      };
    }

    const ride = rideSnap.data() as any;
    const departureTime = ride.departureTime;

    if (!departureTime) {
      return {
        allowed: false,
        reason: 'Ride departure time not set'
      };
    }

    // Convert Firestore Timestamp to Date
    const departureDateMs = typeof departureTime === 'number'
      ? departureTime
      : (departureTime?.seconds ? departureTime.seconds * 1000 : new Date(departureTime).getTime());

    const now = Date.now();
    const minutesUntilDeparture = Math.floor((departureDateMs - now) / 1000 / 60);

    // Cancellation not allowed after departure
    if (now >= departureDateMs) {
      return {
        allowed: false,
        reason: 'Cannot cancel - ride has already started',
        hasStarted: true,
        minutesUntilDeparture: Math.max(-minutesUntilDeparture, 0)
      };
    }

    return {
      allowed: true,
      hasStarted: false,
      minutesUntilDeparture
    };
  } catch (error) {
    console.error('[validateCancellationPermission] Error:', error);
    return {
      allowed: false,
      reason: 'Failed to validate cancellation permission'
    };
  }
}

/**
 * Check if user account is locked due to high cancellation rate
 */
export async function isAccountLocked(
  firestoreOrDb: any,
  university: string,
  userId: string,
  isAdminContext: boolean = false
): Promise<{ locked: boolean; expiresAt?: Date; minutesRemaining?: number }> {
  try {
    const userRef = doc(firestoreOrDb, `universities/${university}/users/${userId}`);
    const userSnap = isAdminContext
      ? await (firestoreOrDb as any).doc(userRef.path).get()
      : await getDoc(userRef);

    if (!snapshotExists(userSnap)) {
      return { locked: false };
    }

    const user = userSnap.data() as any;
    const lockUntil = user.accountLockUntil;

    if (!lockUntil) {
      return { locked: false };
    }

    const lockMs = typeof lockUntil === 'number'
      ? lockUntil
      : (lockUntil?.seconds ? lockUntil.seconds * 1000 : new Date(lockUntil).getTime());

    const now = Date.now();

    if (now >= lockMs) {
      // Lock has expired - auto-unlock by returning false
      // Note: We don't clear the field here; backend should handle
      return { locked: false };
    }

    const minutesRemaining = Math.ceil((lockMs - now) / 1000 / 60);

    return {
      locked: true,
      expiresAt: new Date(lockMs),
      minutesRemaining
    };
  } catch (error) {
    console.error('[isAccountLocked] Error:', error);
    return { locked: false };
  }
}

/**
 * Calculate cancellation rate for a user
 */
export async function calculateCancellationRate(
  firestoreOrDb: any,
  university: string,
  userId: string,
  isAdminContext: boolean = false
): Promise<{ rate: number; cancellations: number; participations: number }> {
  try {
    const userRef = doc(firestoreOrDb, `universities/${university}/users/${userId}`);
    const userSnap = isAdminContext
      ? await (firestoreOrDb as any).doc(userRef.path).get()
      : await getDoc(userRef);

    if (!snapshotExists(userSnap)) {
      return { rate: 0, cancellations: 0, participations: 0 };
    }

    const user = userSnap.data() as any;
    const cancellations = user.totalCancellations ?? 0;
    const participations = user.totalParticipations ?? 0;

    const rate = participations > 0 ? Math.round((cancellations / participations) * 100) : 0;

    return { rate, cancellations, participations };
  } catch (error) {
    console.error('[calculateCancellationRate] Error:', error);
    return { rate: 0, cancellations: 0, participations: 0 };
  }
}

/**
 * Check if user has reached abuse threshold and should be locked
 * Threshold: > 30-40% cancellation rate AND >= 3 participations
 */
export function shouldLockAccount(
  cancellationRate: number,
  totalParticipations: number,
  thresholdRate: number = 35, // 35% default
  minimumParticipations: number = 3
): boolean {
  return totalParticipations >= minimumParticipations && cancellationRate >= thresholdRate;
}

/**
 * Get lock expiration date (7 days from now)
 */
export function getLockExpirationDate(): Date {
  const lockDate = new Date();
  lockDate.setDate(lockDate.getDate() + 7);
  return lockDate;
}

/**
 * Check if a cancellation is considered "late" (ride is CONFIRMED status)
 */
export function isLateCancellation(status: string): boolean {
  return status?.toUpperCase() === 'CONFIRMED';
}

/**
 * Check for duplicate cancellation (idempotency)
 * Returns true if request/booking has already been cancelled
 */
export async function isDuplicateCancellation(
  firestoreOrDb: any,
  university: string,
  rideId: string,
  requestId: string,
  isAdminContext: boolean = false
): Promise<boolean> {
  try {
    // Check request subcollection
    try {
      const requestRef = doc(firestoreOrDb, `universities/${university}/rides/${rideId}/requests/${requestId}`);
      const requestSnap = isAdminContext
        ? await (firestoreOrDb as any).doc(requestRef.path).get()
        : await getDoc(requestRef);

      if (snapshotExists(requestSnap)) {
        const request = requestSnap.data() as any;
        const status = request.status?.toUpperCase();
        // Already cancelled if status is CANCELLED, AUTO_CANCELLED, etc.
        return status === 'CANCELLED' || status === 'AUTO_CANCELLED';
      }
    } catch (e) {
      // Ignore - request might not exist
    }

    // Check booking collection
    try {
      const bookingRef = doc(firestoreOrDb, `universities/${university}/bookings/${requestId}`);
      const bookingSnap = isAdminContext
        ? await (firestoreOrDb as any).doc(bookingRef.path).get()
        : await getDoc(bookingRef);

      if (snapshotExists(bookingSnap)) {
        const booking = bookingSnap.data() as any;
        return booking.status?.toUpperCase() === 'CANCELLED';
      }
    } catch (e) {
      // Ignore - booking might not exist
    }

    return false;
  } catch (error) {
    console.error('[isDuplicateCancellation] Error:', error);
    return false;
  }
}

/**
 * Calculate next time user can cancel (cooldown)
 * Applied after 3 late cancellations
 */
export function getCooldownExpirationDate(): Date {
  const cooldownDate = new Date();
  cooldownDate.setHours(cooldownDate.getHours() + 24); // 24 hour cooldown
  return cooldownDate;
}

/**
 * Format cancellation error message for UI display
 */
export function formatCancellationError(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    if (error.message.includes('departed')) {
      return 'Cannot cancel - this ride has already departed';
    }
    if (error.message.includes('not found')) {
      return 'Ride or booking not found';
    }
    if (error.message.includes('locked')) {
      return 'Your account is temporarily locked due to high cancellation rate. Please try again later.';
    }
    if (error.message.includes('already cancelled')) {
      return 'This ride has already been cancelled';
    }
    return error.message;
  }

  return 'Failed to cancel ride. Please try again.';
}

/**
 * Prepare notification payload for ride cancellation
 */
export interface CancellationNotificationPayload {
  type: 'driver_cancelled_ride' | 'passenger_cancelled_booking';
  title: string;
  message: string;
  rideFrom: string;
  rideTo: string;
  cancelledByName: string;
  isLateCancellation: boolean;
}

export function generateCancellationNotification(
  cancellerRole: 'driver' | 'passenger',
  cancellerName: string,
  rideFrom: string,
  rideTo: string,
  isLateCancellation: boolean
): CancellationNotificationPayload {
  if (cancellerRole === 'driver') {
    return {
      type: 'driver_cancelled_ride',
      title: isLateCancellation ? 'Driver Cancelled - Last Minute ❌' : 'Ride Cancelled by Driver',
      message: isLateCancellation
        ? `${cancellerName} cancelled your ride from ${rideFrom} to ${rideTo} at the last minute.`
        : `${cancellerName} cancelled your ride from ${rideFrom} to ${rideTo}.`,
      rideFrom,
      rideTo,
      cancelledByName: cancellerName,
      isLateCancellation
    };
  }

  return {
    type: 'passenger_cancelled_booking',
    title: isLateCancellation ? 'Passenger Cancelled - Last Minute ❌' : 'Passenger Cancelled',
    message: isLateCancellation
      ? `${cancellerName} cancelled their booking from ${rideFrom} to ${rideTo} at the last minute. A seat is now available.`
      : `${cancellerName} cancelled their booking from ${rideFrom} to ${rideTo}.`,
    rideFrom,
    rideTo,
    cancelledByName: cancellerName,
    isLateCancellation
  };
}

/**
 * Track a cancellation in user profile
 * Updates totalCancellations, lateCancellations, and checks for lock threshold
 */
export interface CancellationTrackingUpdate {
  totalCancellations: number;
  lastCancellationAt: Timestamp;
  lateCancellations?: number;
  accountLockUntil?: Timestamp;
  cooldownUntil?: Timestamp;
}

/**
 * Build cancellation tracking update for user profile.
 * 
 * NOTE: This function is designed for CLIENT-side Firestore usage.
 * For server-side (admin SDK) usage, use buildCancellationTrackingUpdateAdmin() instead.
 * 
 * @param currentUser - current user data from Firestore
 * @param wasConfirmed - whether the booking/request status was CONFIRMED when cancelled (late cancellation)
 * @param thresholdRate - cancellation rate threshold for account lock (default 35%)
 * @param minimumParticipations - minimum participations before lock can trigger (default 3)
 */
export function buildCancellationTrackingUpdate(
  currentUser: any,
  wasConfirmed: boolean,
  thresholdRate: number = 35,
  minimumParticipations: number = 3
): CancellationTrackingUpdate & { cancellationRate: number } {
  const totalCancellations = (currentUser?.totalCancellations ?? 0) + 1;
  const lateCancellations = wasConfirmed
    ? (currentUser?.lateCancellations ?? 0) + 1
    : (currentUser?.lateCancellations ?? 0);
  // DO NOT increment totalParticipations here — it tracks rides created/booked, not cancellations
  const totalParticipations = currentUser?.totalParticipations ?? 0;
  const cancellationRate = totalParticipations > 0
    ? Math.round((totalCancellations / totalParticipations) * 100)
    : 0;

  const update: CancellationTrackingUpdate & { cancellationRate: number } = {
    totalCancellations,
    lastCancellationAt: serverTimestamp() as any as Timestamp,
    lateCancellations,
    cancellationRate,
  };

  // Apply account lock if threshold exceeded (7 days from now)
  if (shouldLockAccount(cancellationRate, totalParticipations, thresholdRate, minimumParticipations)) {
    const lockDate = getLockExpirationDate(); // 7 days from now
    update.accountLockUntil = Timestamp.fromDate(lockDate);
  }

  // Apply cooldown if 3+ late cancellations (24 hours from now)
  if (lateCancellations >= 3) {
    const cooldownDate = getCooldownExpirationDate(); // 24 hours from now
    update.cooldownUntil = Timestamp.fromDate(cooldownDate);
  }

  return update;
}
