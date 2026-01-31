'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import type { Notification, NotificationCount, NotificationType } from '@/types/notification';
import { 
  subscribeToNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  markChatNotificationsAsRead,
  markRideNotificationsAsRead
} from '@/firebase/firestore/notifications';
import { getMessaging, onMessage, type MessagePayload } from 'firebase/messaging';
import { ringtoneManager } from '@/lib/ringtoneManager';
import { PremiumNotificationDisplay, PremiumNotificationProps } from '@/components/premium/PremiumNotification';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: NotificationCount;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markChatAsRead: (chatId: string) => Promise<void>;
  markRideAsRead: (rideId: string) => Promise<void>;
  getUnreadForChat: (chatId: string) => number;
  getUnreadForRide: (rideId: string) => number;
  // Premium notifications
  premiumNotifications: PremiumNotificationProps[];
  addPremiumNotification: (notification: PremiumNotificationProps) => void;
  removePremiumNotification: (id: string) => void;
  clearPremiumNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Anti-spam: Track recently shown notifications to prevent duplicates
 */
const recentNotificationIds = new Set<string>();
const DEDUP_WINDOW_MS = 30000; // 30 seconds

function shouldShowNotification(notificationId: string): boolean {
  if (recentNotificationIds.has(notificationId)) {
    return false;
  }
  
  recentNotificationIds.add(notificationId);
  
  // Clean up after dedup window
  setTimeout(() => {
    recentNotificationIds.delete(notificationId);
  }, DEDUP_WINDOW_MS);
  
  return true;
}

/**
 * Map notification type to premium notification type
 */
function mapNotificationType(type: NotificationType | string): PremiumNotificationProps['type'] {
  const typeMap: Record<string, PremiumNotificationProps['type']> = {
    'chat': 'chat',
    'booking': 'ride_request',
    'ride_status': 'ride_confirmed',
    'ride_request': 'ride_request',
    'ride_accepted': 'ride_accepted',
    'ride_rejected': 'ride_rejected',
    'ride_confirmed': 'ride_confirmed',
    'ride_cancelled': 'ride_cancelled',
    'ride_expired': 'ride_expired',
    'ride_reminder': 'ride_reminder',
    'ride_started': 'ride_started',
    'ride_completed': 'ride_completed',
    'call_incoming': 'call_incoming',
    'call_missed': 'call_missed',
    'call_ended': 'call_ended',
    'system': 'info',
    'verification': 'verification',
    'request_accepted': 'ride_accepted',
    'request_confirmed': 'ride_confirmed',
    'request_cancelled': 'ride_cancelled',
    'request_rejected': 'ride_rejected',
    'request_expired': 'ride_expired',
    'reminder': 'ride_reminder',
  };
  
  return typeMap[type] || 'info';
}

/**
 * Get appropriate sound for notification type
 */
function getSoundForType(type: string): 'notification' | 'ringtone' | 'none' {
  if (type.includes('call_incoming')) return 'ringtone';
  if (type.includes('cancelled') || type.includes('rejected')) return 'notification';
  if (type.includes('critical')) return 'notification';
  return 'notification';
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [premiumNotifications, setPremiumNotifications] = useState<PremiumNotificationProps[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Track the last notification ID to detect new ones
  const lastNotificationIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

  // Initialize Firestore notifications
  useEffect(() => {
    if (!firestore || !user?.uid || !user?.university) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    isInitialLoadRef.current = true;
    let unsubscribe = () => {};

    try {
      unsubscribe = subscribeToNotifications(
        firestore,
        user.university,
        user.uid,
        (updatedNotifications) => {
          // Detect new notifications
          if (!isInitialLoadRef.current && updatedNotifications.length > 0) {
            const latestNotification = updatedNotifications[0];
            
            // Check if this is a new notification
            if (latestNotification.id !== lastNotificationIdRef.current && 
                !latestNotification.isRead &&
                shouldShowNotification(latestNotification.id)) {
              
              // Show premium notification
              const premiumNotif: PremiumNotificationProps = {
                id: `firestore-${latestNotification.id}`,
                type: mapNotificationType(latestNotification.type),
                title: latestNotification.title,
                message: latestNotification.message,
                duration: latestNotification.priority === 'critical' ? 0 : 6000,
                senderName: latestNotification.metadata?.senderName,
                senderAvatar: latestNotification.metadata?.senderPhoto,
                senderVerified: latestNotification.metadata?.senderVerified,
                priority: latestNotification.priority,
              };
              
              addPremiumNotification(premiumNotif);
              
              // Play notification sound (unless it's a call notification which has its own ringtone)
              if (!latestNotification.type.includes('call')) {
                try {
                  ringtoneManager.playNotificationSound();
                  ringtoneManager.vibrate([100, 50, 100]);
                } catch (error) {
                  console.error('[NotificationProvider] Sound error:', error);
                }
              }
            }
            
            lastNotificationIdRef.current = latestNotification.id;
          } else if (updatedNotifications.length > 0) {
            // Initial load - just store the latest ID
            lastNotificationIdRef.current = updatedNotifications[0].id;
          }
          
          isInitialLoadRef.current = false;
          setNotifications(updatedNotifications);
          setLoading(false);
        }
      );
    } catch (error) {
      console.error('[NotificationProvider] Error subscribing to notifications:', error);
      setLoading(false);
    }

    return () => unsubscribe();
  }, [firestore, user?.uid, user?.university]);

  // Initialize FCM listener for push notifications
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const messaging = getMessaging();

      const unsubscribe = onMessage(messaging, (payload: MessagePayload) => {
        console.log('[NotificationProvider] FCM message:', payload);

        const notification = payload.notification;
        const data = payload.data as any;
        
        // Create a unique ID for deduplication
        const notificationId = data?.notificationId || data?.relatedId || `fcm-${Date.now()}`;
        
        if (!shouldShowNotification(notificationId)) {
          console.debug('[NotificationProvider] Skipping duplicate FCM notification');
          return;
        }

        if (notification) {
          // Play notification sound (except for call notifications)
          const notificationType = data?.type || 'info';
          if (!notificationType.includes('call_incoming')) {
            try {
              ringtoneManager.playNotificationSound();
              ringtoneManager.vibrate([200, 100, 200]);
            } catch (error) {
              console.error('[NotificationProvider] Sound/vibrate error:', error);
            }
          }

          // Create premium notification
          const premiumNotif: PremiumNotificationProps = {
            id: `fcm-${notificationId}-${Date.now()}`,
            type: mapNotificationType(notificationType),
            title: notification.title || 'Notification',
            message: notification.body || '',
            duration: notificationType === 'call_incoming' ? 0 : 
                     data?.priority === 'critical' ? 0 : 6000,
            senderName: data?.senderName,
            senderAvatar: data?.senderAvatar || data?.senderPhoto,
            senderVerified: data?.senderVerified === 'true' || data?.senderVerified === true,
            priority: data?.priority,
          };

          addPremiumNotification(premiumNotif);

          // Show system notification for background/PWA
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const sysNotif = new Notification(notification.title || 'Campus Rides', {
                body: notification.body,
                icon: notification.icon || '/logo.png',
                badge: notification.badge || '/badge.png',
                tag: data?.relatedId || 'notification',
                requireInteraction: notificationType === 'call_incoming' || data?.priority === 'critical',
                silent: notificationType.includes('call'), // Don't play system sound for calls
              });
              
              // Auto-close system notification after 10 seconds (except for calls)
              if (!notificationType.includes('call')) {
                setTimeout(() => sysNotif.close(), 10000);
              }
            } catch (error) {
              console.error('[NotificationProvider] System notification error:', error);
            }
          }

          // Update app badge
          updateAppBadge();
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('[NotificationProvider] FCM listener error:', error);
    }
  }, []);

  const unreadCount: NotificationCount = {
    total: notifications.filter(n => !n.isRead).length,
    chat: notifications.filter(n => !n.isRead && n.type === 'chat').length,
    booking: notifications.filter(n => !n.isRead && n.type === 'booking').length,
    ride_status: notifications.filter(n => !n.isRead && n.type === 'ride_status').length,
    ride_request: notifications.filter(n => !n.isRead && (n.type === 'ride_request' || n.type === 'booking')).length,
    call_missed: notifications.filter(n => !n.isRead && n.type === 'call_missed').length,
  };

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!firestore || !user?.university) return;
    await markNotificationAsRead(firestore, user.university, notificationId);
  }, [firestore, user?.university]);

  const markAllAsRead = useCallback(async () => {
    if (!firestore || !user?.university || !user?.uid) return;
    await markAllNotificationsAsRead(firestore, user.university, user.uid);
  }, [firestore, user?.university, user?.uid]);

  const markChatAsRead = useCallback(async (chatId: string) => {
    if (!firestore || !user?.university || !user?.uid) return;
    await markChatNotificationsAsRead(firestore, user.university, user.uid, chatId);
  }, [firestore, user?.university, user?.uid]);

  const markRideAsRead = useCallback(async (rideId: string) => {
    if (!firestore || !user?.university || !user?.uid) return;
    await markRideNotificationsAsRead(firestore, user.university, user.uid, rideId);
  }, [firestore, user?.university, user?.uid]);

  const getUnreadForChat = useCallback((chatId: string) => {
    return notifications.filter(n => !n.isRead && n.type === 'chat' && n.relatedChatId === chatId).length;
  }, [notifications]);

  const getUnreadForRide = useCallback((rideId: string) => {
    return notifications.filter(n => !n.isRead && n.relatedRideId === rideId).length;
  }, [notifications]);

  // Premium notification handlers
  const addPremiumNotification = useCallback((notification: PremiumNotificationProps) => {
    const id = notification.id || `notif-${Date.now()}-${Math.random()}`;
    const timestamp = Date.now();
    
    setPremiumNotifications(prev => {
      // Prevent duplicate IDs
      if (prev.some(n => n.id === id)) {
        return prev;
      }
      
      const updated = [{ ...notification, id, timestamp } as any, ...prev];
      return updated.slice(0, 10); // Keep max 10
    });

    // Auto-remove after duration (unless persistent)
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        removePremiumNotification(id);
      }, notification.duration);
    }
  }, []);

  const removePremiumNotification = useCallback((id: string) => {
    setPremiumNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearPremiumNotifications = useCallback(() => {
    setPremiumNotifications([]);
  }, []);

  const updateAppBadge = useCallback(() => {
    if (typeof window === 'undefined' || !('setAppBadge' in navigator)) return;

    const total = unreadCount.total + premiumNotifications.length;
    if (total > 0) {
      try {
        (navigator as any).setAppBadge(total);
      } catch (error) {
        console.error('[NotificationProvider] Badge update error:', error);
      }
    } else if ('clearAppBadge' in navigator) {
      try {
        (navigator as any).clearAppBadge();
      } catch (error) {
        console.error('[NotificationProvider] Badge clear error:', error);
      }
    }
  }, [unreadCount, premiumNotifications.length]);

  // Update badge when counts change
  useEffect(() => {
    updateAppBadge();
  }, [updateAppBadge]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      markChatAsRead,
      markRideAsRead,
      getUnreadForChat,
      getUnreadForRide,
      premiumNotifications,
      addPremiumNotification,
      removePremiumNotification,
      clearPremiumNotifications,
    }}>
      {children}
      <PremiumNotificationDisplay
        notifications={premiumNotifications as any}
        onClose={removePremiumNotification}
      />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
