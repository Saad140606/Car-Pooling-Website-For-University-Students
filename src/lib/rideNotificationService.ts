/**
 * Ride Notification Service
 * 
 * Handles client-side notification creation for all ride-related events.
 * Works in conjunction with Cloud Functions for push notifications.
 * 
 * Events covered:
 * - Ride request created (driver notification)
 * - Request accepted/rejected (passenger notification)
 * - Ride confirmed by passenger (driver notification)
 * - Ride/request cancelled (both parties)
 * - Request expired (passenger notification)
 * - Ride reminders (30/10 min before departure)
 * - Ride started (passenger notification)
 * - Ride completed (both parties)
 */

import { Firestore, doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { NotificationType, NotificationPriority } from '@/types/notification';

interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedRideId: string;
  relatedBookingId?: string;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
}

interface RideInfo {
  from: string;
  to: string;
  departureTime: any;
  price?: number;
  driverId: string;
  driverName?: string;
}

interface PassengerInfo {
  uid: string;
  fullName: string;
  email?: string;
}

/**
 * Anti-spam deduplication cache
 * Key: `${userId}:${type}:${relatedId}`, Value: timestamp
 */
const notificationCache = new Map<string, number>();
const DEDUP_WINDOW_MS = 30000; // 30 seconds between duplicate notifications

function isDuplicate(userId: string, type: string, relatedId: string): boolean {
  const key = `${userId}:${type}:${relatedId}`;
  const lastSent = notificationCache.get(key);
  const now = Date.now();
  
  if (lastSent && (now - lastSent) < DEDUP_WINDOW_MS) {
    return true;
  }
  
  notificationCache.set(key, now);
  
  // Cleanup old entries periodically
  if (notificationCache.size > 100) {
    const cutoff = now - DEDUP_WINDOW_MS * 2;
    for (const [k, v] of notificationCache.entries()) {
      if (v < cutoff) notificationCache.delete(k);
    }
  }
  
  return false;
}

async function createNotificationDoc(
  firestore: Firestore,
  university: string,
  payload: NotificationPayload
): Promise<void> {
  // Check for duplicate
  if (isDuplicate(payload.userId, payload.type, payload.relatedRideId)) {
    console.debug('[RideNotificationService] Skipping duplicate notification:', payload.type);
    return;
  }
  
  const notificationsRef = collection(firestore, 'universities', university, 'notifications');
  
  await addDoc(notificationsRef, {
    userId: payload.userId,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    relatedRideId: payload.relatedRideId,
    relatedBookingId: payload.relatedBookingId || null,
    relatedChatId: null,
    isRead: false,
    priority: payload.priority || 'normal',
    createdAt: serverTimestamp(),
    metadata: payload.metadata || {}
  });
}

/**
 * Notify driver when a new ride request is received
 */
export async function notifyNewRideRequest(
  firestore: Firestore,
  university: string,
  driverId: string,
  rideId: string,
  passenger: PassengerInfo,
  ride: Pick<RideInfo, 'from' | 'to'>
): Promise<void> {
  await createNotificationDoc(firestore, university, {
    userId: driverId,
    type: 'ride_request',
    title: 'New Ride Request 🚗',
    message: `${passenger.fullName} wants to join your ride from ${ride.from} to ${ride.to}`,
    relatedRideId: rideId,
    priority: 'high',
    metadata: {
      senderId: passenger.uid,
      senderName: passenger.fullName,
      rideFrom: ride.from,
      rideTo: ride.to
    }
  });
}

/**
 * Notify passenger when their request is accepted by driver
 */
export async function notifyRequestAccepted(
  firestore: Firestore,
  university: string,
  passengerId: string,
  rideId: string,
  bookingId: string,
  ride: Pick<RideInfo, 'from' | 'to' | 'departureTime' | 'driverName'>
): Promise<void> {
  await createNotificationDoc(firestore, university, {
    userId: passengerId,
    type: 'ride_accepted',
    title: 'Request Accepted! ✅',
    message: `${ride.driverName || 'Driver'} accepted your request for ${ride.from} → ${ride.to}. Confirm now!`,
    relatedRideId: rideId,
    relatedBookingId: bookingId,
    priority: 'critical',
    metadata: {
      rideFrom: ride.from,
      rideTo: ride.to,
      senderName: ride.driverName
    }
  });
}

/**
 * Notify passenger when their request is rejected
 */
export async function notifyRequestRejected(
  firestore: Firestore,
  university: string,
  passengerId: string,
  rideId: string,
  bookingId: string,
  ride: Pick<RideInfo, 'from' | 'to'>
): Promise<void> {
  await createNotificationDoc(firestore, university, {
    userId: passengerId,
    type: 'ride_rejected',
    title: 'Request Declined',
    message: `Your request for ${ride.from} → ${ride.to} was not accepted. Find another ride.`,
    relatedRideId: rideId,
    relatedBookingId: bookingId,
    priority: 'normal',
    metadata: {
      rideFrom: ride.from,
      rideTo: ride.to
    }
  });
}

/**
 * Notify driver when passenger confirms the ride
 */
export async function notifyRideConfirmed(
  firestore: Firestore,
  university: string,
  driverId: string,
  rideId: string,
  bookingId: string,
  passenger: PassengerInfo,
  ride: Pick<RideInfo, 'from' | 'to'>
): Promise<void> {
  await createNotificationDoc(firestore, university, {
    userId: driverId,
    type: 'ride_confirmed',
    title: 'Ride Confirmed! 🎉',
    message: `${passenger.fullName} confirmed the ride from ${ride.from} → ${ride.to}. You can now chat!`,
    relatedRideId: rideId,
    relatedBookingId: bookingId,
    priority: 'high',
    metadata: {
      senderId: passenger.uid,
      senderName: passenger.fullName,
      rideFrom: ride.from,
      rideTo: ride.to
    }
  });
}

/**
 * Notify about ride/request cancellation
 */
export async function notifyRideCancelled(
  firestore: Firestore,
  university: string,
  targetUserId: string,
  rideId: string,
  bookingId: string | undefined,
  cancelledByName: string,
  ride: Pick<RideInfo, 'from' | 'to'>,
  isLateCancellation = false
): Promise<void> {
  const title = isLateCancellation ? 'Ride Cancelled (Late) ❌' : 'Ride Cancelled';
  const message = isLateCancellation
    ? `${cancelledByName} cancelled the ride from ${ride.from} → ${ride.to} at the last minute.`
    : `${cancelledByName} cancelled the ride from ${ride.from} → ${ride.to}.`;
  
  await createNotificationDoc(firestore, university, {
    userId: targetUserId,
    type: 'ride_cancelled',
    title,
    message,
    relatedRideId: rideId,
    relatedBookingId: bookingId,
    priority: isLateCancellation ? 'critical' : 'high',
    metadata: {
      senderName: cancelledByName,
      rideFrom: ride.from,
      rideTo: ride.to,
      isLateCancellation
    }
  });
}

/**
 * Notify passenger when their request expires
 */
export async function notifyRequestExpired(
  firestore: Firestore,
  university: string,
  passengerId: string,
  rideId: string,
  bookingId: string,
  ride: Pick<RideInfo, 'from' | 'to'>
): Promise<void> {
  await createNotificationDoc(firestore, university, {
    userId: passengerId,
    type: 'ride_expired',
    title: 'Request Expired ⏰',
    message: `You didn't confirm in time. The ride from ${ride.from} → ${ride.to} is no longer available.`,
    relatedRideId: rideId,
    relatedBookingId: bookingId,
    priority: 'normal',
    metadata: {
      rideFrom: ride.from,
      rideTo: ride.to
    }
  });
}

/**
 * Notify about ride starting
 */
export async function notifyRideStarted(
  firestore: Firestore,
  university: string,
  passengerId: string,
  rideId: string,
  ride: Pick<RideInfo, 'from' | 'to' | 'driverName'>
): Promise<void> {
  await createNotificationDoc(firestore, university, {
    userId: passengerId,
    type: 'ride_started',
    title: 'Ride Started! 🚀',
    message: `${ride.driverName || 'Your driver'} has started the ride from ${ride.from}. Have a safe trip!`,
    relatedRideId: rideId,
    priority: 'high',
    metadata: {
      senderName: ride.driverName,
      rideFrom: ride.from,
      rideTo: ride.to
    }
  });
}

/**
 * Notify about ride completion
 */
export async function notifyRideCompleted(
  firestore: Firestore,
  university: string,
  userId: string,
  rideId: string,
  ride: Pick<RideInfo, 'from' | 'to'>
): Promise<void> {
  await createNotificationDoc(firestore, university, {
    userId,
    type: 'ride_completed',
    title: 'Ride Completed! ✨',
    message: `Your ride from ${ride.from} → ${ride.to} has been completed. Rate your experience!`,
    relatedRideId: rideId,
    priority: 'normal',
    metadata: {
      rideFrom: ride.from,
      rideTo: ride.to
    }
  });
}

/**
 * Notify about missed call
 */
export async function notifyMissedCall(
  firestore: Firestore,
  university: string,
  userId: string,
  callerName: string,
  callerId: string,
  callType: 'audio' | 'video',
  rideId?: string
): Promise<void> {
  await createNotificationDoc(firestore, university, {
    userId,
    type: 'call_missed',
    title: `Missed ${callType === 'video' ? 'Video' : ''} Call 📞`,
    message: `${callerName} tried to call you. Tap to call back.`,
    relatedRideId: rideId || 'call',
    priority: 'high',
    metadata: {
      senderId: callerId,
      senderName: callerName,
      callType
    }
  });
}

/**
 * Fetch ride info for notification metadata
 */
export async function getRideInfo(
  firestore: Firestore,
  university: string,
  rideId: string
): Promise<RideInfo | null> {
  try {
    const rideRef = doc(firestore, 'universities', university, 'rides', rideId);
    const rideSnap = await getDoc(rideRef);
    
    if (!rideSnap.exists()) return null;
    
    const data = rideSnap.data();
    return {
      from: data.from || 'Unknown',
      to: data.to || 'Unknown',
      departureTime: data.departureTime,
      price: data.price,
      driverId: data.driverId,
      driverName: data.driverInfo?.fullName || data.driverName
    };
  } catch (error) {
    console.error('[RideNotificationService] Failed to fetch ride info:', error);
    return null;
  }
}

/**
 * Fetch user info for notification metadata
 */
export async function getUserInfo(
  firestore: Firestore,
  university: string,
  userId: string
): Promise<{ fullName: string; verified?: boolean } | null> {
  try {
    const userRef = doc(firestore, 'universities', university, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return null;
    
    const data = userSnap.data();
    return {
      fullName: data.fullName || 'User',
      verified: data.universityEmailVerified || data.verified
    };
  } catch (error) {
    console.error('[RideNotificationService] Failed to fetch user info:', error);
    return null;
  }
}
