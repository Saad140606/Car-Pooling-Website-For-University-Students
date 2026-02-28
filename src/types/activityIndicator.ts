/**
 * Activity Indicator Types
 * Used for real-time activity tracking across the app
 */

export interface ActivityIndicatorState {
  bookings: boolean;
  rides: boolean;
  analytics: boolean;
  chat: boolean;
  notifications: boolean;
}

export interface ActivityIndicatorTimestamps {
  bookingsLastViewed?: number;
  ridesLastViewed?: number;
  analyticsLastViewed?: number;
  chatLastViewed?: number;
  notificationsLastViewed?: number;
}

export type ActivitySection = 'bookings' | 'rides' | 'analytics' | 'chat' | 'notifications';

export interface UnreadActivityEvent {
  eventId: string;
  targetSection: ActivitySection;
  userId: string;
  unreadFlag: boolean;
  timestamp: any;
}

export const ACTIVITY_STORAGE_KEY = 'campus_rides_activity_indicators';
export const LAST_VIEWED_STORAGE_KEY = 'campus_rides_last_viewed';
