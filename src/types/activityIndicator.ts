/**
 * Activity Indicator Types
 * Used for real-time activity tracking across the app
 */

export interface ActivityIndicatorState {
  bookings: boolean;
  rides: boolean;
  chat: boolean;
}

export interface ActivityIndicatorTimestamps {
  bookingsLastViewed?: number;
  ridesLastViewed?: number;
  chatLastViewed?: number;
}

export const ACTIVITY_STORAGE_KEY = 'campus_rides_activity_indicators';
export const LAST_VIEWED_STORAGE_KEY = 'campus_rides_last_viewed';
