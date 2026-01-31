/**
 * Comprehensive notification types for Campus Rides
 * Covers: Ride lifecycle, Chat messages, Calls, System alerts
 */
export type NotificationType = 
  | 'chat'                    // New chat message
  | 'booking'                 // General booking-related
  | 'ride_status'             // Ride status changes
  | 'ride_request'            // New ride request (for driver)
  | 'ride_accepted'           // Request accepted (for passenger)
  | 'ride_rejected'           // Request rejected (for passenger)
  | 'ride_confirmed'          // Passenger confirmed the ride
  | 'ride_cancelled'          // Ride/request cancelled
  | 'ride_expired'            // Request expired
  | 'ride_reminder'           // Departure reminder (30/10 min)
  | 'ride_started'            // Ride has started
  | 'ride_completed'          // Ride completed
  | 'call_incoming'           // Incoming call
  | 'call_missed'             // Missed call
  | 'call_ended'              // Call ended
  | 'system'                  // System notifications
  | 'verification';           // Verification-related

/**
 * Priority levels for notification display
 */
export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  relatedRideId: string;
  relatedChatId?: string;
  relatedBookingId?: string;
  relatedCallId?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: any; // Firestore Timestamp
  priority?: NotificationPriority;
  expiresAt?: any; // Optional expiration for time-sensitive notifications
  actionUrl?: string; // Deep link to relevant screen
  metadata?: {
    senderName?: string;
    senderId?: string;
    senderPhoto?: string;
    senderVerified?: boolean;
    rideFrom?: string;
    rideTo?: string;
    ridePrice?: number;
    bookingStatus?: string;
    callType?: 'audio' | 'video';
    callDuration?: number;
    messagePreview?: string;
    messageType?: 'text' | 'image' | 'video' | 'voice';
  };
}

export interface NotificationCount {
  total: number;
  chat: number;
  booking: number;
  ride_status: number;
  ride_request: number;
  call_missed: number;
}

/**
 * Premium notification display configuration
 */
export interface PremiumNotificationConfig {
  type: NotificationType;
  title: string;
  message: string;
  duration?: number; // 0 = persistent until dismissed
  sound?: 'notification' | 'ringtone' | 'success' | 'error' | 'none';
  vibrate?: boolean;
  avatar?: string;
  senderName?: string;
  verified?: boolean;
  actions?: {
    label: string;
    action: () => void;
    variant?: 'default' | 'destructive';
  }[];
}
