/**
 * Ride Lifecycle State Machine
 *
 * Deterministic, server-authoritative state machine for ride lifecycle.
 * Validates transitions, prevents invalid states, logs every change.
 *
 * This module is pure logic — no Firestore dependency.
 * It can run on both client (for UI prediction) and server (for enforcement).
 */

import {
  RideStatus,
  VALID_TRANSITIONS,
  TERMINAL_STATES,
  RIDE_STATUS_ORDER,
  PassengerStatus,
  LIFECYCLE_CONSTANTS,
  type StateTransition,
  type LifecycleRide,
  type RidePassenger,
} from './types';

// ============================================================================
// TRANSITION VALIDATION
// ============================================================================

export class InvalidTransitionError extends Error {
  public readonly from: RideStatus;
  public readonly to: RideStatus;

  constructor(from: RideStatus, to: RideStatus, reason?: string) {
    super(
      `Invalid ride status transition: ${from} → ${to}${reason ? ` (${reason})` : ''}`
    );
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
}

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(from: RideStatus, to: RideStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Validate a transition and throw if invalid.
 */
export function validateTransition(from: RideStatus, to: RideStatus): void {
  if (!isValidTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

/**
 * Get the index of a status in the ordered list (for sequential checks).
 */
export function getStatusIndex(status: RideStatus): number {
  return RIDE_STATUS_ORDER.indexOf(status);
}

/**
 * Check if a ride is in a terminal (final) state.
 */
export function isTerminalState(status: RideStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

/**
 * Check if a ride is locked (no modifications allowed).
 */
export function isRideLocked(status: RideStatus): boolean {
  const lockedIndex = getStatusIndex(RideStatus.LOCKED);
  const currentIndex = getStatusIndex(status);
  // Terminal states are also "locked" — no modifications
  return currentIndex >= lockedIndex || isTerminalState(status);
}

/**
 * Check if cancellation is allowed for the current status.
 */
export function isCancellationAllowed(status: RideStatus): boolean {
  // Cannot cancel once ride is LOCKED or beyond, or already terminal
  if (isRideLocked(status)) return false;
  if (isTerminalState(status)) return false;
  return VALID_TRANSITIONS[status]?.includes(RideStatus.CANCELLED) ?? false;
}

/**
 * Check if booking (new passenger request) is allowed.
 */
export function isBookingAllowed(status: RideStatus): boolean {
  // Booking is only allowed in OPEN, REQUESTED, ACCEPTED, CONFIRMED states  
  const bookableStates: RideStatus[] = [
    RideStatus.OPEN,
    RideStatus.REQUESTED,
    RideStatus.ACCEPTED,
    RideStatus.CONFIRMED,
  ];
  return bookableStates.includes(status);
}

// ============================================================================
// RIDE STATUS COMPUTATION
// ============================================================================

/**
 * Compute what the ride status SHOULD be based on its passenger states.
 * This is the core logic that derives ride status from passenger data.
 *
 * Rules:
 *   - No passengers at all → OPEN
 *   - Has pending requests → REQUESTED
 *   - Has accepted (not yet confirmed) requests → ACCEPTED
 *   - Has confirmed passengers → CONFIRMED
 */
export function computeRideStatusFromPassengers(
  ride: Pick<LifecycleRide, 'confirmedPassengers' | 'pendingRequests' | 'status'>
): RideStatus {
  const currentStatus = ride.status;

  // Don't override LOCKED+ states or terminal states
  if (isRideLocked(currentStatus) || isTerminalState(currentStatus)) {
    return currentStatus;
  }

  const hasConfirmed = ride.confirmedPassengers.length > 0;
  const hasPending = ride.pendingRequests.length > 0;

  if (hasConfirmed) return RideStatus.CONFIRMED;

  // Check pending requests for accepted ones
  const hasAccepted = ride.pendingRequests.some(
    (p) => p.status === PassengerStatus.ACCEPTED
  );
  if (hasAccepted) return RideStatus.ACCEPTED;

  if (hasPending) return RideStatus.REQUESTED;

  return RideStatus.OPEN;
}

// ============================================================================
// DEPARTURE TIME LOGIC
// ============================================================================

/**
 * Check if a ride should be locked based on server time.
 * @param departureTimeMs - Departure time in milliseconds (server time)
 * @param nowMs - Current server time in milliseconds
 */
export function shouldLockRide(departureTimeMs: number, nowMs: number): boolean {
  return nowMs >= departureTimeMs;
}

/**
 * Determine what happens after lock based on confirmed passengers.
 */
export function determinePostLockStatus(confirmedCount: number): RideStatus {
  return confirmedCount > 0 ? RideStatus.IN_PROGRESS : RideStatus.FAILED;
}

/**
 * Calculate the completion window end time.
 * @param departureTimeMs - Departure time in milliseconds
 * @returns Completion window end in milliseconds
 */
export function calculateCompletionWindowEnd(departureTimeMs: number): number {
  return departureTimeMs + LIFECYCLE_CONSTANTS.COMPLETION_WINDOW_HOURS * 60 * 60 * 1000;
}

/**
 * Check if we are within the completion window.
 */
export function isInCompletionWindow(departureTimeMs: number, nowMs: number): boolean {
  const windowEnd = calculateCompletionWindowEnd(departureTimeMs);
  return nowMs >= departureTimeMs && nowMs <= windowEnd;
}

// ============================================================================
// SEAT VALIDATION
// ============================================================================

/**
 * Validate that a seat can be reserved (request accepted).
 */
export function canReserveSeat(
  ride: Pick<LifecycleRide, 'availableSeats' | 'totalSeats' | 'reservedSeats' | 'status'>
): { allowed: boolean; reason?: string } {
  if (isRideLocked(ride.status)) {
    return { allowed: false, reason: 'Ride is locked — no seat modifications allowed' };
  }

  if (ride.availableSeats <= 0) {
    return { allowed: false, reason: 'No seats available' };
  }

  return { allowed: true };
}

/**
 * Validate that a seat can be confirmed (passenger confirms).
 */
export function canConfirmSeat(
  ride: Pick<LifecycleRide, 'availableSeats' | 'status'>
): { allowed: boolean; reason?: string } {
  if (isRideLocked(ride.status)) {
    return { allowed: false, reason: 'Ride is locked — no seat modifications allowed' };
  }

  if (ride.availableSeats <= 0) {
    return { allowed: false, reason: 'Ride is full' };
  }

  return { allowed: true };
}

/**
 * Calculate available seats after an atomic operation.
 */
export function calculateSeatsAfterAction(
  action: 'reserve' | 'confirm' | 'cancel_reserved' | 'cancel_confirmed',
  currentAvailable: number,
  currentReserved: number,
  totalSeats: number
): { availableSeats: number; reservedSeats: number } {
  switch (action) {
    case 'reserve':
      // Reserving: increment reserved count (but available stays the same until confirm)
      return {
        availableSeats: currentAvailable,
        reservedSeats: currentReserved + 1,
      };
    case 'confirm':
      // Confirming: decrement available, decrement reserved
      return {
        availableSeats: Math.max(0, currentAvailable - 1),
        reservedSeats: Math.max(0, currentReserved - 1),
      };
    case 'cancel_reserved':
      // Cancel a reserved-but-not-confirmed seat: decrement reserved
      return {
        availableSeats: currentAvailable,
        reservedSeats: Math.max(0, currentReserved - 1),
      };
    case 'cancel_confirmed':
      // Cancel a confirmed seat: increment available
      return {
        availableSeats: Math.min(totalSeats, currentAvailable + 1),
        reservedSeats: currentReserved,
      };
    default:
      return { availableSeats: currentAvailable, reservedSeats: currentReserved };
  }
}

// ============================================================================
// TRANSITION LOG BUILDER
// ============================================================================

/**
 * Create a state transition log entry.
 */
export function createTransitionEntry(
  from: RideStatus | string,
  to: RideStatus | string,
  triggeredBy: string,
  timestamp: any,
  reason?: string
): StateTransition {
  return { from, to, timestamp, triggeredBy, reason };
}

// ============================================================================
// LEGACY STATUS MAPPING
// ============================================================================

/**
 * Map lifecycle status to legacy status for backward compatibility.
 * The existing UI expects: 'active' | 'full' | 'completed' | 'cancelled' | 'expired'
 */
export function toLegacyStatus(status: RideStatus): string {
  switch (status) {
    case RideStatus.CREATED:
    case RideStatus.OPEN:
    case RideStatus.REQUESTED:
    case RideStatus.ACCEPTED:
    case RideStatus.CONFIRMED:
      return 'active';
    case RideStatus.LOCKED:
    case RideStatus.IN_PROGRESS:
    case RideStatus.COMPLETION_WINDOW:
      return 'active'; // still active from UI perspective
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

/**
 * Map legacy status to lifecycle status (best-effort).
 */
export function fromLegacyStatus(legacyStatus: string): RideStatus {
  switch (legacyStatus) {
    case 'active':
      return RideStatus.OPEN;
    case 'full':
      return RideStatus.CONFIRMED;
    case 'completed':
      return RideStatus.COMPLETED;
    case 'cancelled':
      return RideStatus.CANCELLED;
    case 'expired':
      return RideStatus.FAILED;
    default:
      return RideStatus.OPEN;
  }
}

// ============================================================================
// RATING VALIDATION
// ============================================================================

/**
 * Check if ratings are allowed for a ride.
 */
export function areRatingsAllowed(
  rideStatus: RideStatus,
  ratingsOpen: boolean
): boolean {
  return rideStatus === RideStatus.COMPLETED && ratingsOpen;
}

/**
 * Validate a rating value.
 */
export function isValidRating(rating: number): boolean {
  return (
    Number.isInteger(rating) &&
    rating >= LIFECYCLE_CONSTANTS.MIN_RATING &&
    rating <= LIFECYCLE_CONSTANTS.MAX_RATING
  );
}

/**
 * Check if a user is a confirmed participant and can rate.
 */
export function canUserRate(
  userId: string,
  ride: Pick<LifecycleRide, 'driverId' | 'confirmedPassengers' | 'status' | 'ratingsOpen'>
): { allowed: boolean; role: 'driver' | 'passenger'; reason?: string } {
  if (!areRatingsAllowed(ride.status, ride.ratingsOpen)) {
    return { allowed: false, role: 'passenger', reason: 'Ratings are not open for this ride' };
  }

  if (userId === ride.driverId) {
    return { allowed: true, role: 'driver' };
  }

  const isConfirmedPassenger = ride.confirmedPassengers.some(
    (p) => p.userId === userId && p.status === PassengerStatus.CONFIRMED
  );

  if (isConfirmedPassenger) {
    return { allowed: true, role: 'passenger' };
  }

  return { allowed: false, role: 'passenger', reason: 'Only confirmed participants can rate' };
}
