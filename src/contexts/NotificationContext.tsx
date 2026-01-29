'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useFirestore, useUser } from '@/firebase';
import type { Notification, NotificationCount } from '@/types/notification';
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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [premiumNotifications, setPremiumNotifications] = useState<PremiumNotificationProps[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize Firestore notifications
  useEffect(() => {
    if (!firestore || !user?.uid || !user?.university) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsubscribe = () => {};

    try {
      unsubscribe = subscribeToNotifications(
        firestore,
        user.university,
        user.uid,
        (updatedNotifications) => {
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

  // Initialize FCM listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const messaging = getMessaging();

      const unsubscribe = onMessage(messaging, (payload: MessagePayload) => {
        console.log('[NotificationProvider] FCM message:', payload);

        const notification = payload.notification;
        const data = payload.data as any;

        if (notification) {
          // Play notification sound
          try {
            ringtoneManager.playNotificationSound();
            ringtoneManager.vibrate([200, 100, 200]);
          } catch (error) {
            console.error('[NotificationProvider] Sound/vibrate error:', error);
          }

          // Create premium notification
          const premiumNotif: PremiumNotificationProps = {
            id: `fcm-${Date.now()}-${Math.random()}`,
            type: (data?.type || 'info') as any,
            title: notification.title || 'Notification',
            message: notification.body || '',
            duration: data?.type === 'call_incoming' ? 0 : 5000,
            senderName: data?.senderName,
            senderAvatar: data?.senderAvatar,
          };

          addPremiumNotification(premiumNotif);

          // Show system notification
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(notification.title || 'Campus Rides', {
                body: notification.body,
                icon: notification.icon || '/logo.png',
                badge: notification.badge || '/badge.png',
                tag: data?.relatedId || 'notification',
                requireInteraction: data?.type === 'call_incoming',
              });
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
      const updated = [{ ...notification, id, timestamp } as any, ...prev];
      return updated.slice(0, 10); // Keep max 10
    });

    // Auto-remove after duration
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
