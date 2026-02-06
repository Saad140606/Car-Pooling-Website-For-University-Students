// src/lib/postRideTypes.ts
// Types for post-ride features: ratings, earnings, and analytics

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// RATING TYPES
// ============================================================================

export interface RideRating {
  id: string;                    // Same as booking ID for easy lookup
  rideId: string;
  driverId: string;
  passengerId: string;
  rating: number;                // 1-5 stars
  createdAt: Timestamp;
  rideCompletedAt: Timestamp;    // When the ride was completed
}

export interface PendingRating {
  rideId: string;
  bookingId: string;
  driverId: string;
  driverName: string;
  from: string;
  to: string;
  departureTime: Date;
  rideCompletedAt: Date;         // departureTime + 2 hours
  ratingDueAt: Date;             // When rating popup should show
  price: number;
}

// ============================================================================
// EARNINGS TYPES
// ============================================================================

export interface RideEarnings {
  id: string;                    // Same as ride ID
  rideId: string;
  driverId: string;
  university: string;
  totalEarnings: number;         // bookedSeats * pricePerSeat
  bookedSeats: number;
  pricePerSeat: number;
  passengersServed: string[];    // Array of passenger IDs
  calculatedAt: Timestamp;
  rideCompletedAt: Timestamp;
  from: string;
  to: string;
  departureTime: Timestamp;
}

export interface DriverAnalyticsSummary {
  totalEarnings: number;
  totalRidesCompleted: number;
  totalPassengersServed: number;
  averageRating: number;
  totalRatingsCount: number;
  earningsPerRide: { rideId: string; earnings: number; date: Date; from: string; to: string }[];
  ratingsPerRide: { rideId: string; rating: number; date: Date }[];
  lastUpdated: Timestamp;
}

// ============================================================================
// PASSENGER SPENDING TYPES
// ============================================================================

export interface PassengerSpending {
  id: string;                    // bookingId
  bookingId: string;
  rideId: string;
  passengerId: string;
  driverId: string;
  amount: number;                // Price paid
  calculatedAt: Timestamp;
  rideCompletedAt: Timestamp;
  from: string;
  to: string;
  departureTime: Timestamp;
}

export interface PassengerAnalyticsSummary {
  totalSpent: number;
  totalRidesTaken: number;
  averageSpentPerRide: number;
  spendingPerRide: { rideId: string; amount: number; date: Date; from: string; to: string }[];
  lastUpdated: Timestamp;
}

// ============================================================================
// RIDE COMPLETION STATUS
// ============================================================================

export interface RideCompletionStatus {
  rideId: string;
  isCompleted: boolean;
  departureTime: Date;
  completedAt: Date | null;      // departureTime + 2 hours
  ratingEligibleAt: Date | null; // departureTime + 2 hours
  earningsCalculatedAt: Date | null;
  hoursAfterDeparture: number;
}

// ============================================================================
// HELPER CONSTANTS
// ============================================================================

export const POST_RIDE_CONSTANTS = {
  // Hours after departure for ride to be considered "completed"
  COMPLETION_HOURS: 2,
  
  // Hours after departure when rating popup should appear
  RATING_ELIGIBLE_HOURS: 2,
  
  // Hours after departure when earnings should be calculated
  EARNINGS_CALCULATION_HOURS: 4,
  
  // Maximum hours after departure to allow rating
  MAX_RATING_HOURS: 168, // 7 days
  
  // Minimum rating value
  MIN_RATING: 1,
  
  // Maximum rating value
  MAX_RATING: 5,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate if a ride is completed (2+ hours after departure)
 */
export function isRideCompleted(departureTime: Date | Timestamp | any): boolean {
  if (!departureTime) return false;
  
  let date: Date;
  if (departureTime instanceof Date) {
    date = departureTime;
  } else if (departureTime.toDate && typeof departureTime.toDate === 'function') {
    date = departureTime.toDate();
  } else if (departureTime.seconds) {
    date = new Date(departureTime.seconds * 1000);
  } else {
    return false;
  }
  
  const completionTime = new Date(date.getTime() + POST_RIDE_CONSTANTS.COMPLETION_HOURS * 60 * 60 * 1000);
  return Date.now() >= completionTime.getTime();
}

/**
 * Calculate if rating is eligible (exactly 2 hours after departure)
 */
export function isRatingEligible(departureTime: Date | Timestamp | any): boolean {
  if (!departureTime) return false;
  
  let date: Date;
  if (departureTime instanceof Date) {
    date = departureTime;
  } else if (departureTime.toDate && typeof departureTime.toDate === 'function') {
    date = departureTime.toDate();
  } else if (departureTime.seconds) {
    date = new Date(departureTime.seconds * 1000);
  } else {
    return false;
  }
  
  const ratingEligibleTime = new Date(date.getTime() + POST_RIDE_CONSTANTS.RATING_ELIGIBLE_HOURS * 60 * 60 * 1000);
  const maxRatingTime = new Date(date.getTime() + POST_RIDE_CONSTANTS.MAX_RATING_HOURS * 60 * 60 * 1000);
  const now = Date.now();
  
  return now >= ratingEligibleTime.getTime() && now <= maxRatingTime.getTime();
}

/**
 * Calculate if earnings should be calculated (4-5 hours after departure)
 */
export function shouldCalculateEarnings(departureTime: Date | Timestamp | any): boolean {
  if (!departureTime) return false;
  
  let date: Date;
  if (departureTime instanceof Date) {
    date = departureTime;
  } else if (departureTime.toDate && typeof departureTime.toDate === 'function') {
    date = departureTime.toDate();
  } else if (departureTime.seconds) {
    date = new Date(departureTime.seconds * 1000);
  } else {
    return false;
  }
  
  const earningsTime = new Date(date.getTime() + POST_RIDE_CONSTANTS.EARNINGS_CALCULATION_HOURS * 60 * 60 * 1000);
  return Date.now() >= earningsTime.getTime();
}

/**
 * Get hours elapsed since departure
 */
export function getHoursAfterDeparture(departureTime: Date | Timestamp | any): number {
  if (!departureTime) return 0;
  
  let date: Date;
  if (departureTime instanceof Date) {
    date = departureTime;
  } else if (departureTime.toDate && typeof departureTime.toDate === 'function') {
    date = departureTime.toDate();
  } else if (departureTime.seconds) {
    date = new Date(departureTime.seconds * 1000);
  } else {
    return 0;
  }
  
  const elapsed = Date.now() - date.getTime();
  return elapsed / (60 * 60 * 1000);
}
