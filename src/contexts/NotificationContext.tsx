'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { Notification, NotificationCount } from '@/types/notification';
import { 
  subscribeToNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  markChatNotificationsAsRead,
  markRideNotificationsAsRead
} from '@/firebase/firestore/notifications';

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
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !user?.uid || !user?.university) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToNotifications(
      firestore,
      user.university,
      user.uid,
      (updatedNotifications) => {
        setNotifications(updatedNotifications);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, user?.uid, user?.university]);

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
      getUnreadForRide
    }}>
      {children}
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
