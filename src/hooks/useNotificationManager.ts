'use client';

import { useEffect, useState, useCallback } from 'react';
import { notificationManager, type NotificationPayload } from '@/lib/notificationManager';

/**
 * useNotificationManager: Hook for managing real-time notifications
 */
export function useNotificationManager() {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Initialize FCM listener on mount
    notificationManager.initFCMListener();

    // Subscribe to notifications
    const unsubscribe = notificationManager.subscribe((payload: NotificationPayload) => {
      setNotifications(prev => [payload, ...prev.slice(0, 49)]); // Keep last 50
      setUnreadCount(notificationManager.getTotalCount());
    });

    // Update count on mount
    setUnreadCount(notificationManager.getTotalCount());

    return () => unsubscribe();
  }, []);

  const clearNotification = useCallback((relatedId: string) => {
    setNotifications(prev => prev.filter(n => n.relatedId !== relatedId));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    notificationManager.clearAllCounts();
    setUnreadCount(0);
  }, []);

  const decrementCount = useCallback((type: string) => {
    notificationManager.decrementCount(type);
    setUnreadCount(notificationManager.getTotalCount());
  }, []);

  return {
    notifications,
    unreadCount,
    getCount: notificationManager.getCount.bind(notificationManager),
    getTotalCount: notificationManager.getTotalCount.bind(notificationManager),
    clearNotification,
    clearAllNotifications,
    decrementCount,
  };
}
