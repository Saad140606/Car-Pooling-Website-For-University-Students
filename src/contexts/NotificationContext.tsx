'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { getSelectedUniversity } from '@/lib/university';
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
import { fcmTokenManager } from '@/lib/fcmTokenManager';
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
  const { user, data: userData } = useUser();
  const firestore = useFirestore();
    const resolvedUniversity = React.useMemo(() => {
      const fromProfile = String((userData as any)?.university || '').trim().toLowerCase();
      if (fromProfile) return fromProfile;
      const selected = String(getSelectedUniversity() || '').trim().toLowerCase();
      return selected || null;
    }, [userData]);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [premiumNotifications, setPremiumNotifications] = useState<PremiumNotificationProps[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Track the last notification ID to detect new ones
  const lastNotificationIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);
  const autoPermissionPromptedUidRef = useRef<string | null>(null);

  // Initialize FCM token registration
  useEffect(() => {
    if (!firestore || !user?.uid || !resolvedUniversity) {
      // Cleanup on logout
      fcmTokenManager.cleanup().catch(console.error);
      autoPermissionPromptedUidRef.current = null;
      return;
    }

    const initNotifications = async () => {
      try {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          return;
        }

        // Auto-prompt once per logged-in user when permission is undecided.
        if (
          Notification.permission === 'default' &&
          autoPermissionPromptedUidRef.current !== user.uid
        ) {
          autoPermissionPromptedUidRef.current = user.uid;
          try {
            await Notification.requestPermission();
          } catch (promptErr) {
            console.warn('[NotificationProvider] Auto permission prompt failed:', promptErr);
          }
        }

        // Register FCM token only when permission is granted.
        if (Notification.permission === 'granted') {
          console.log('[NotificationProvider] Initializing FCM token manager for user:', user.uid);
          await fcmTokenManager.initialize(firestore, user.uid, resolvedUniversity);
        }
      } catch (error) {
        console.error('[NotificationProvider] Failed to initialize FCM token manager:', error);
      }
    };

    void initNotifications();

    return () => {
      // Cleanup on unmount or user change
      fcmTokenManager.cleanup().catch(console.error);
    };
  }, [firestore, user?.uid, resolvedUniversity]);

  // Initialize Firestore notifications
  useEffect(() => {
    if (!firestore || !user?.uid || !resolvedUniversity) {
      console.log('[NotificationProvider] Missing prerequisites:', {
        hasFirestore: !!firestore,
        hasUser: !!user?.uid,
        hasUniversity: !!resolvedUniversity
      });
      setNotifications([]);
      setLoading(false);
      return;
    }

    console.log('[NotificationProvider] Initializing notifications for user:', {
      userId: user.uid,
      university: resolvedUniversity
    });

    setLoading(true);
    isInitialLoadRef.current = true;
    let unsubscribe = () => {};

    try {
      unsubscribe = subscribeToNotifications(
        firestore,
        resolvedUniversity,
        user.uid,
        (updatedNotifications) => {
          console.log('[NotificationProvider] Received notification update:', {
            count: updatedNotifications.length,
            unread: updatedNotifications.filter(n => !n.isRead).length,
            latest: updatedNotifications[0]?.type || 'none'
          });
          
          // Detect new notifications
          if (!isInitialLoadRef.current && updatedNotifications.length > 0) {
            const latestNotification = updatedNotifications[0];
            
            // Check if this is a new notification
            if (latestNotification.id !== lastNotificationIdRef.current && 
                !latestNotification.isRead &&
                shouldShowNotification(latestNotification.id)) {
              
              console.log('[NotificationProvider] 🔔 NEW NOTIFICATION:', {
                id: latestNotification.id,
                type: latestNotification.type,
                title: latestNotification.title
              });
              
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
              
              // Play sound/vibration for all notifications. Calls use ringtone for stronger alerting.
              try {
                if (latestNotification.type.includes('call_incoming')) {
                  void ringtoneManager.playRingtone();
                  ringtoneManager.vibrate([200, 120, 200, 120, 200]);
                } else {
                  void ringtoneManager.playNotificationSound();
                  ringtoneManager.vibrate([100, 50, 100]);
                }
              } catch (error) {
                console.error('[NotificationProvider] Sound error:', error);
              }
            }
            
            lastNotificationIdRef.current = latestNotification.id;
          } else if (updatedNotifications.length > 0) {
            // Initial load - just store the latest ID
            console.log('[NotificationProvider] Initial load complete');
            lastNotificationIdRef.current = updatedNotifications[0].id;
          }
          
          isInitialLoadRef.current = false;
          setNotifications(updatedNotifications);
          setLoading(false);
        }
      );
    } catch (error) {
      console.error('[NotificationProvider] ❌ Error subscribing to notifications:', error);
      setLoading(false);
    }

    return () => {
      console.log('[NotificationProvider] Cleaning up notification subscription');
      unsubscribe();
    };
  }, [firestore, user?.uid, resolvedUniversity]);

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
          // Play notification sound/ringtone
          const notificationType = data?.type || 'info';
          try {
            if (notificationType.includes('call_incoming')) {
              void ringtoneManager.playRingtone();
              ringtoneManager.vibrate([250, 120, 250, 120, 250]);
            } else {
              void ringtoneManager.playNotificationSound();
              ringtoneManager.vibrate([200, 100, 200]);
            }
          } catch (error) {
            console.error('[NotificationProvider] Sound/vibrate error:', error);
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
                silent: false,
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
    if (!firestore || !resolvedUniversity) return;
    await markNotificationAsRead(firestore, resolvedUniversity, notificationId);
  }, [firestore, resolvedUniversity]);

  const markAllAsRead = useCallback(async () => {
    if (!firestore || !resolvedUniversity || !user?.uid) return;
    await markAllNotificationsAsRead(firestore, resolvedUniversity, user.uid);
  }, [firestore, resolvedUniversity, user?.uid]);

  const markChatAsRead = useCallback(async (chatId: string) => {
    if (!firestore || !resolvedUniversity || !user?.uid) return;
    await markChatNotificationsAsRead(firestore, resolvedUniversity, user.uid, chatId);
  }, [firestore, resolvedUniversity, user?.uid]);

  const markRideAsRead = useCallback(async (rideId: string) => {
    if (!firestore || !resolvedUniversity || !user?.uid) return;
    await markRideNotificationsAsRead(firestore, resolvedUniversity, user.uid, rideId);
  }, [firestore, resolvedUniversity, user?.uid]);

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
