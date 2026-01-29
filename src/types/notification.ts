export type NotificationType = 'chat' | 'booking' | 'ride_status';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  relatedRideId: string;
  relatedChatId?: string;
  relatedBookingId?: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: any; // Firestore Timestamp
  metadata?: {
    senderName?: string;
    senderId?: string;
    rideFrom?: string;
    rideTo?: string;
    bookingStatus?: string;
  };
}

export interface NotificationCount {
  total: number;
  chat: number;
  booking: number;
  ride_status: number;
}
