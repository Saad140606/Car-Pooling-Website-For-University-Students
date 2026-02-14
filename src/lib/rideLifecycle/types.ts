/**
 * Ride Lifecycle Types
 *
 * Canonical data model for the deterministic ride lifecycle engine.
 * Backend is the source of truth — no client-side state transitions.
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// RIDE STATUS ENUM — strict ordering, no skipping
// ============================================================================

export enum RideStatus {
  CREATED      = 'CREATED',
  OPEN         = 'OPEN',
  REQUESTED    = 'REQUESTED',
  ACCEPTED     = 'ACCEPTED',
  CONFIRMED    = 'CONFIRMED',
  LOCKED       = 'LOCKED',
  IN_PROGRESS  = 'IN_PROGRESS',
  COMPLETION_WINDOW = 'COMPLETION_WINDOW',
  COMPLETED    = 'COMPLETED',
  FAILED       = 'FAILED',
  CANCELLED    = 'CANCELLED',
}

/** Ordered list for sequential validation */
export const RIDE_STATUS_ORDER: RideStatus[] = [
  RideStatus.CREATED,
  RideStatus.OPEN,
  RideStatus.REQUESTED,
  RideStatus.ACCEPTED,
  RideStatus.CONFIRMED,
  RideStatus.LOCKED,
  RideStatus.IN_PROGRESS,
  RideStatus.COMPLETION_WINDOW,
  RideStatus.COMPLETED,
];

// ============================================================================
// VALID STATE TRANSITIONS
// ============================================================================

export const VALID_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  [RideStatus.CREATED]:           [RideStatus.OPEN, RideStatus.CANCELLED],
  [RideStatus.OPEN]:              [RideStatus.REQUESTED, RideStatus.LOCKED, RideStatus.CANCELLED],
  [RideStatus.REQUESTED]:         [RideStatus.ACCEPTED, RideStatus.OPEN, RideStatus.LOCKED, RideStatus.CANCELLED],
  [RideStatus.ACCEPTED]:          [RideStatus.CONFIRMED, RideStatus.REQUESTED, RideStatus.OPEN, RideStatus.LOCKED, RideStatus.CANCELLED],
  [RideStatus.CONFIRMED]:         [RideStatus.LOCKED, RideStatus.CANCELLED],
  [RideStatus.LOCKED]:            [RideStatus.IN_PROGRESS, RideStatus.FAILED],
  [RideStatus.IN_PROGRESS]:       [RideStatus.COMPLETION_WINDOW],
  [RideStatus.COMPLETION_WINDOW]: [RideStatus.COMPLETED],
  [RideStatus.COMPLETED]:         [],
  [RideStatus.FAILED]:            [],
  [RideStatus.CANCELLED]:         [],
};

// ============================================================================
// TERMINAL STATES — no further transitions possible
// ============================================================================

export const TERMINAL_STATES: RideStatus[] = [
  RideStatus.COMPLETED,
  RideStatus.FAILED,
  RideStatus.CANCELLED,
];

// ============================================================================
// PASSENGER STATUS
// ============================================================================

export enum PassengerStatus {
  REQUESTED  = 'requested',
  ACCEPTED   = 'accepted',
  CONFIRMED  = 'confirmed',
  CANCELLED  = 'cancelled',
  NO_SHOW    = 'no-show',
  COMPLETED  = 'completed',
}

// ============================================================================
// PASSENGER OBJECT
// ============================================================================

export interface RidePassenger {
  userId: string;
  status: PassengerStatus;
  timestamp: any; // Firestore Timestamp or admin Timestamp
  requestId?: string;
  pickupPoint?: { lat: number; lng: number } | null;
  pickupPlaceName?: string | null;
  driverReview?: 'arrived' | 'no-show';
  driverReviewAt?: any;
  passengerCompletion?: 'completed' | 'cancelled';
  passengerCompletionAt?: any;
  completionReason?: string;
}

// ============================================================================
// LIFECYCLE RIDE DOCUMENT
// ============================================================================

export interface LifecycleRide {
  rideId: string;
  driverId: string;
  status: RideStatus;
  departureTime: any; // Firestore Timestamp
  createdAt: any;
  updatedAt: any;
  totalSeats: number;
  availableSeats: number;
  reservedSeats: number;

  // Passenger tracking
  confirmedPassengers: RidePassenger[];
  pendingRequests: RidePassenger[];
  cancelledPassengers: RidePassenger[];

  // Completion window
  completionWindowEnd: any | null; // Firestore Timestamp
  ratingsOpen: boolean;

  // Ride info (denormalized for notifications)
  from: string;
  to: string;
  price: number;
  transportMode: 'car' | 'bike';
  genderAllowed: 'male' | 'female' | 'both';

  // State transition log
  transitionLog: StateTransition[];

  // Legacy compat — keep the old status field synchronized
  legacyStatus?: string;
}

// ============================================================================
// STATE TRANSITION LOG ENTRY
// ============================================================================

export interface StateTransition {
  from: RideStatus | string;
  to: RideStatus | string;
  timestamp: any; // Firestore Timestamp
  triggeredBy: string; // userId or 'system'
  reason?: string;
}

// ============================================================================
// LIFECYCLE CONSTANTS
// ============================================================================

export const LIFECYCLE_CONSTANTS = {
  /** Hours after departure for completion window to open */
  COMPLETION_WINDOW_HOURS: 1,
  /** Minutes after departure to open completion window (testing default) */
  COMPLETION_WINDOW_OPEN_MINUTES: 5,
  /** Maximum hours after departure to allow rating */
  MAX_RATING_HOURS: 168, // 7 days
  /** Minutes before departure to lock the ride */
  LOCK_BEFORE_DEPARTURE_MINUTES: 0, // lock at exact departure time
  /** Minimum rating value */
  MIN_RATING: 1,
  /** Maximum rating value */
  MAX_RATING: 5,
};

// ============================================================================
// RATING TYPES
// ============================================================================

export interface LifecycleRating {
  id: string;
  rideId: string;
  raterId: string;
  ratedUserId: string;
  raterRole: 'driver' | 'passenger';
  rating: number; // 1-5
  createdAt: any;
  anonymous: boolean; // always true
}

export interface UserRatingStats {
  driverAverageRating: number;
  driverRatingCount: number;
  driverTotalRating: number;
  passengerAverageRating: number;
  passengerRatingCount: number;
  passengerTotalRating: number;
  ratingHistory: { rideId: string; rating: number; role: string; timestamp: any }[];
  lastUpdated: any;
}

// ============================================================================
// COMPLETION ACTION TYPES
// ============================================================================

export interface DriverCompletionAction {
  type: 'mark_completed' | 'mark_no_show';
  passengerId?: string; // required for no_show
  rideId: string;
  driverId: string;
}

export interface PassengerCompletionAction {
  type: 'confirm_completion' | 'report_issue';
  rideId: string;
  passengerId: string;
  issueDescription?: string; // for report_issue
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface TransitionRequest {
  university: string;
  rideId: string;
  targetStatus: RideStatus;
  reason?: string;
}

export interface SeatActionRequest {
  university: string;
  rideId: string;
  requestId: string;
  passengerId: string;
}

export interface RatingRequest {
  university: string;
  rideId: string;
  ratedUserId: string;
  raterRole: 'driver' | 'passenger';
  rating: number;
}

export interface CompletionActionRequest {
  university: string;
  rideId: string;
  action: DriverCompletionAction | PassengerCompletionAction;
}
