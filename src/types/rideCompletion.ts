/**
 * Ride Completion Workflow Types
 * 
 * Production-grade type definitions for the ride completion system.
 * Covers both Provider and Passenger flows with persistence,
 * analytics sync, and edge case handling.
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// TRIGGER CONFIG
// ============================================================================

export const COMPLETION_TRIGGER_DELAY_MS = 5 * 60 * 1000; // 5 minutes after departure

// ============================================================================
// PASSENGER ATTENDANCE
// ============================================================================

export type PassengerArrivalStatus = 'arrived' | 'did_not_arrive';

export type PassengerNotArrivedReason =
  | 'passenger_late'
  | 'cancelled'
  | 'no_show'
  | 'other';

export interface PassengerAttendanceRecord {
  passengerId: string;
  passengerName: string;
  pickupLocation?: string;
  arrivalStatus: PassengerArrivalStatus;
  // For arrived passengers
  rating?: number;       // 1-5
  review?: string;
  // For did-not-arrive passengers
  notArrivedReason?: PassengerNotArrivedReason;
  notArrivedReasonCustom?: string;
}

// ============================================================================
// PROVIDER NOT-COMPLETED REASONS
// ============================================================================

export type ProviderNotCompletedReason =
  | 'vehicle_issue'
  | 'emergency'
  | 'late_arrival'
  | 'route_problem'
  | 'custom';

// ============================================================================
// PASSENGER NOT-COMPLETED REASONS
// ============================================================================

export type PassengerNotCompletedReason =
  | 'provider_didnt_arrive'
  | 'passenger_emergency'
  | 'route_issue'
  | 'custom';

// ============================================================================
// WORKFLOW STEPS
// ============================================================================

export type ProviderWorkflowStep =
  | 'summary'
  | 'decision'
  | 'not_completed_reason'
  | 'passenger_attendance'
  | 'passenger_feedback'  // rating per arrived passenger
  | 'not_arrived_reasons' // reasons per not-arrived passenger
  | 'submitting'
  | 'complete';

export type PassengerWorkflowStep =
  | 'summary'
  | 'decision'
  | 'not_completed_reason'
  | 'provider_rating'
  | 'submitting'
  | 'complete';

export type WorkflowStep = ProviderWorkflowStep | PassengerWorkflowStep;

// ============================================================================
// RIDE SUMMARY DATA (shown at top of workflow)
// ============================================================================

export interface RideSummary {
  rideId: string;
  providerName: string;
  from: string;
  to: string;
  totalSeats: number;
  totalBookings: number;
  departureTime: Date;
  price: number;
  transportMode: 'car' | 'bike';
  // Computed
  hasConfirmedPassengers: boolean;
  rideStatusLabel: string; // "Ride Confirmed" or empty
}

// ============================================================================
// CONFIRMED PASSENGER INFO (for provider flow)
// ============================================================================

export interface ConfirmedPassengerInfo {
  id: string;
  name: string;
  email?: string;
  pickupLocation?: string;
  bookingId: string;
  price: number;
}

// ============================================================================
// WORKFLOW FORM DATA
// ============================================================================

export interface ProviderFormData {
  rideCompleted: boolean | null;
  notCompletedReason?: ProviderNotCompletedReason;
  notCompletedReasonCustom?: string;
  attendanceRecords: Record<string, PassengerAttendanceRecord>;
  // Per-passenger feedback (arrived passengers)
  passengerRatings: Record<string, number>;
  passengerReviews: Record<string, string>;
  // Per-passenger not-arrived reasons
  notArrivedReasons: Record<string, PassengerNotArrivedReason>;
  notArrivedReasonsCustom: Record<string, string>;
}

export interface PassengerFormData {
  rideCompleted: boolean | null;
  notCompletedReason?: PassengerNotCompletedReason;
  notCompletedReasonCustom?: string;
  providerRating?: number;
  providerReview?: string;
}

// ============================================================================
// PENDING WORKFLOW (detected by manager)
// ============================================================================

export interface PendingCompletionWorkflow {
  rideId: string;
  oderId: string; // unique key: rideId-role
  userId: string;
  userRole: 'provider' | 'passenger';
  university: string;
  rideSummary: RideSummary;
  confirmedPassengers: ConfirmedPassengerInfo[];
  // Persistence state
  detectedAt: number; // timestamp ms
  localCacheKey: string;
}

// ============================================================================
// FIRESTORE: Ride Completion Document
// Stored at: universities/{univ}/rideCompletions/{rideId}
// ============================================================================

export interface RideCompletionDoc {
  rideId: string;
  university: string;
  createdAt: Timestamp | any;
  
  // Provider workflow
  providerWorkflowPending: boolean;
  providerWorkflowCompleted: boolean;
  providerCompletedAt?: Timestamp | any;
  providerDecision?: 'completed' | 'not_completed';
  providerNotCompletedReason?: ProviderNotCompletedReason;
  providerNotCompletedReasonCustom?: string;
  
  // Per-passenger attendance (provider submitted)
  passengerAttendance?: Record<string, {
    status: PassengerArrivalStatus;
    rating?: number;
    review?: string;
    notArrivedReason?: PassengerNotArrivedReason;
    notArrivedReasonCustom?: string;
  }>;
  
  // Passenger workflow (per passenger)
  passengerWorkflows?: Record<string, {
    pending: boolean;
    completed: boolean;
    completedAt?: Timestamp | any;
    decision?: 'completed' | 'not_completed';
    notCompletedReason?: PassengerNotCompletedReason;
    notCompletedReasonCustom?: string;
    providerRating?: number;
    providerReview?: string;
  }>;
  
  // Analytics sync flags
  analyticsProcessed: boolean;
  analyticsProcessedAt?: Timestamp | any;
}

// ============================================================================
// WORKFLOW STATE (managed by context)
// ============================================================================

export interface CompletionWorkflowState {
  // Current workflow being displayed
  currentWorkflow: PendingCompletionWorkflow | null;
  allPendingWorkflows: PendingCompletionWorkflow[];
  
  // Current step
  currentStep: WorkflowStep;
  
  // Form data
  providerForm: ProviderFormData;
  passengerForm: PassengerFormData;
  
  // UI state
  loading: boolean;
  submitting: boolean;
  error: string | null;
  
  // Current passenger being rated (provider flow)
  currentPassengerIndex: number;
}

// ============================================================================
// LOCAL CACHE SHAPE
// ============================================================================

export interface CompletionLocalCache {
  pendingWorkflows: Array<{
    rideId: string;
    userId: string;
    userRole: 'provider' | 'passenger';
    university: string;
    detectedAt: number;
  }>;
  formDrafts: Record<string, ProviderFormData | PassengerFormData>;
  lastChecked: number;
}

// ============================================================================
// ANALYTICS UPDATE PAYLOAD
// ============================================================================

export interface CompletionAnalyticsPayload {
  rideId: string;
  university: string;
  providerId: string;
  providerDecision: 'completed' | 'not_completed';
  passengerResults: Array<{
    passengerId: string;
    arrived: boolean;
    fare: number;
    ratingGivenToProvider?: number;
    ratingReceivedFromProvider?: number;
  }>;
}

// ============================================================================
// HELPER: Default form states
// ============================================================================

export function createDefaultProviderForm(): ProviderFormData {
  return {
    rideCompleted: null,
    attendanceRecords: {},
    passengerRatings: {},
    passengerReviews: {},
    notArrivedReasons: {},
    notArrivedReasonsCustom: {},
  };
}

export function createDefaultPassengerForm(): PassengerFormData {
  return {
    rideCompleted: null,
  };
}

// ============================================================================
// HELPER: Check if workflow should trigger
// ============================================================================

export function shouldTriggerWorkflow(departureTime: Date | Timestamp | any): boolean {
  if (!departureTime) return false;
  
  let date: Date;
  if (departureTime instanceof Date) {
    date = departureTime;
  } else if (departureTime?.toDate && typeof departureTime.toDate === 'function') {
    date = departureTime.toDate();
  } else if (departureTime?.seconds) {
    date = new Date(departureTime.seconds * 1000);
  } else if (typeof departureTime === 'number') {
    date = new Date(departureTime);
  } else {
    return false;
  }
  
  return Date.now() >= date.getTime() + COMPLETION_TRIGGER_DELAY_MS;
}

export function toSafeDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (ts?.toDate && typeof ts.toDate === 'function') return ts.toDate();
  if (ts?.seconds) return new Date(ts.seconds * 1000);
  if (typeof ts === 'number') return new Date(ts);
  return null;
}
