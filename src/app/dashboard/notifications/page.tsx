'use client';

import { useEffect, useMemo } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardContent } from '@/components/ui/card';
import {
  Bell,
  CheckCheck,
  MapPin,
  MessageCircle,
  AlertCircle,
  Phone,
  Clock,
  Loader2,
} from 'lucide-react';
import type { Notification } from '@/types/notification';
import { useNotifications } from '@/contexts/NotificationContext';
import { useActivityIndicator } from '@/contexts/ActivityIndicatorContext';

const NOTIFICATION_ICONS = {
  ride_requested: MapPin,
  request_accepted: CheckCheck,
  request_rejected: AlertCircle,
  ride_confirmed: CheckCheck,
  ride_cancelled: AlertCircle,
  ride_started: MapPin,
  ride_completed: CheckCheck,
  chat_message: MessageCircle,
  call_missed: Phone,
  request_expired: Clock,
  system: Bell,
} as const;

const NOTIFICATION_COLORS: Record<string, string> = {
  ride_requested: 'text-blue-600',
  request_accepted: 'text-green-600',
  request_rejected: 'text-red-600',
  ride_confirmed: 'text-green-600',
  ride_cancelled: 'text-red-600',
  ride_started: 'text-blue-600',
  ride_completed: 'text-green-600',
  chat_message: 'text-purple-600',
  call_missed: 'text-orange-600',
  request_expired: 'text-yellow-600',
  system: 'text-gray-600',
};

interface NotificationWithId extends Notification {
  id: string;
}

export default function NotificationsPage() {
  const firestore = useFirestore();
  const { user, data: userData, loading: userLoading } = useUser();
  const { unreadCount: contextUnreadCount, markAllAsRead } = useNotifications();
  const { markNotificationsAsViewed } = useActivityIndicator();

  const university = String(userData?.university || '').trim().toLowerCase();

  // Query notifications
  const q =
    user && firestore && university
      ? query(
          collection(firestore, 'universities', university, 'notifications'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(100)
        )
      : null;

  const { data: notificationsData, loading: notificationsLoading } = useCollection<NotificationWithId>(q);
  const allNotifications = useMemo(
    () => (Array.isArray(notificationsData) ? notificationsData : []),
    [notificationsData]
  );

  const unreadCount = useMemo(() => allNotifications.filter((n) => !n.isRead).length, [allNotifications]);

  useEffect(() => {
    if (!user?.uid) return;
    if (contextUnreadCount.total <= 0) {
      markNotificationsAsViewed();
      return;
    }

    const timer = window.setTimeout(() => {
      markAllAsRead().catch(() => {});
      markNotificationsAsViewed();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [user?.uid, contextUnreadCount.total, markAllAsRead, markNotificationsAsViewed]);

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600">Please log in to view your notifications.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="h-8 w-8 text-blue-600" />
            Notifications
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Stay updated with your ride activity</p>
        </div>
        <div className="px-3 py-1.5 rounded-full border border-white/10 bg-slate-900/60 text-xs font-semibold text-slate-200">
          {allNotifications.length} total • {unreadCount} unread
        </div>
      </div>

      {notificationsLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : allNotifications.length === 0 ? (
        <Card className="border-white/10 bg-slate-900/40 backdrop-blur-sm">
          <CardContent className="pt-12 pb-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-white">No notifications yet</h3>
            <p className="text-sm text-slate-400 mt-2">Your latest ride updates will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {allNotifications.map((notification) => {
            const IconComponent = NOTIFICATION_ICONS[notification.type as keyof typeof NOTIFICATION_ICONS] || Bell;
            const iconColor = NOTIFICATION_COLORS[notification.type] || 'text-gray-600';

            return (
              <Card
                key={notification.id}
                className={`border-white/10 bg-slate-900/55 backdrop-blur-sm transition-all ${
                  !notification.isRead ? 'ring-1 ring-blue-500/40' : ''
                }`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="relative mt-0.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/80 border border-white/10">
                        <IconComponent className={`h-5 w-5 ${iconColor}`} />
                      </div>
                      {!notification.isRead && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-500" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm sm:text-base font-semibold text-white truncate">{notification.title}</h3>
                        <span className="text-[11px] sm:text-xs text-slate-400 whitespace-nowrap">
                          {formatTime(notification.createdAt)}
                        </span>
                      </div>

                      <p className="text-sm text-slate-300 mt-1 leading-relaxed">{notification.message}</p>

                      {notification.metadata?.senderName && (
                        <p className="text-xs text-slate-400 mt-2">From: {notification.metadata.senderName}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
