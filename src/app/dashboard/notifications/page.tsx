'use client';

import { useState, useMemo } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { collection, query, where, orderBy, limit, updateDoc, doc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  CheckCheck,
  Trash2,
  MapPin,
  MessageCircle,
  AlertCircle,
  Phone,
  Home,
  Clock,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import type { Notification } from '@/types/notification';

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
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread'>('all');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const university = userData?.university;

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

  const { data: allNotifications = [], loading: notificationsLoading } = useCollection<NotificationWithId>(q);

  // Filter notifications
  const notifications = useMemo(() => {
    if (selectedFilter === 'unread') {
      return allNotifications.filter((n) => !n.isRead);
    }
    return allNotifications;
  }, [allNotifications, selectedFilter]);

  const unreadCount = useMemo(() => allNotifications.filter((n) => !n.isRead).length, [allNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    if (!firestore || !university) return;
    try {
      await updateDoc(doc(firestore, 'universities', university, 'notifications', notificationId), {
        isRead: true,
        readAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!firestore || !university) return;
    const unreadNotifications = allNotifications.filter((n) => !n.isRead);
    try {
      await Promise.all(
        unreadNotifications.map((n) =>
          updateDoc(doc(firestore, 'universities', university, 'notifications', n.id), {
            isRead: true,
            readAt: new Date(),
          })
        )
      );
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    if (!firestore || !university) return;
    setDeletingIds((prev) => new Set([...prev, notificationId]));
    try {
      // In Firestore, we can't delete documents from client without special rules
      // Instead, we'll mark them as deleted
      await updateDoc(doc(firestore, 'universities', university, 'notifications', notificationId), {
        isDeleted: true,
      });
    } catch (error) {
      console.error('Failed to delete notification:', error);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const handleNotificationClick = (notification: NotificationWithId) => {
    handleMarkAsRead(notification.id);

    // Navigate based on notification type
    if (notification.relatedRideId) {
      router.push(`/dashboard/my-rides/${notification.relatedRideId}`);
    } else if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

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
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="h-8 w-8 text-blue-600" />
            Notifications
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Stay updated with your ride activity</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAllAsRead} className="text-sm">
            Mark all as read
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={selectedFilter} onValueChange={(v) => setSelectedFilter(v as 'all' | 'unread')}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="all">
            All Notifications
            {allNotifications.length > 0 && <span className="ml-2 text-xs">({allNotifications.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium leading-none text-white bg-red-600 rounded-full">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-6">
          {notificationsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : notifications.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Bell className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No notifications yet</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {selectedFilter === 'unread' ? 'You have read all your notifications!' : 'Your notifications will appear here'}
                </p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((notification) => {
              const IconComponent = NOTIFICATION_ICONS[notification.type as keyof typeof NOTIFICATION_ICONS] || Bell;
              const iconColor = NOTIFICATION_COLORS[notification.type] || 'text-gray-600';

              return (
                <Card
                  key={notification.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Icon */}
                      <div className={`flex-shrink-0 pt-1 ${iconColor}`}>
                        <IconComponent className="h-6 w-6" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h3 className={`font-semibold text-sm ${!notification.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                              {notification.title}
                            </h3>
                            <p className={`text-sm mt-1 ${!notification.isRead ? 'text-gray-700 dark:text-gray-400' : 'text-gray-600 dark:text-gray-500'}`}>
                              {notification.message}
                            </p>
                            {notification.metadata?.senderName && (
                              <p className="text-xs text-gray-500 dark:text-gray-600 mt-2">From: {notification.metadata.senderName}</p>
                            )}
                          </div>

                          {/* Unread indicator and actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!notification.isRead && (
                              <div className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                            )}
                          </div>
                        </div>

                        {/* Time and actions */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-xs text-gray-500 dark:text-gray-500">{formatTime(notification.createdAt)}</span>
                          <div className="flex items-center gap-2">
                            {!notification.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-auto py-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(notification.id);
                                }}
                              >
                                Mark read
                              </Button>
                            )}
                            {notification.relatedRideId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-auto py-1 gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/dashboard/my-rides/${notification.relatedRideId}`);
                                }}
                              >
                                View <ChevronRight className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-auto py-1 text-gray-500 hover:text-red-600"
                              disabled={deletingIds.has(notification.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(notification.id);
                              }}
                            >
                              {deletingIds.has(notification.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="unread" className="space-y-3 mt-6">
          {/* Same content as 'all' but filtered */}
          {notificationsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : notifications.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <CheckCheck className="h-12 w-12 mx-auto text-green-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All caught up!</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">You have read all your notifications.</p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((notification) => {
              const IconComponent = NOTIFICATION_ICONS[notification.type as keyof typeof NOTIFICATION_ICONS] || Bell;
              const iconColor = NOTIFICATION_COLORS[notification.type] || 'text-gray-600';

              return (
                <Card
                  key={notification.id}
                  className="cursor-pointer transition-all hover:shadow-md bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Icon */}
                      <div className={`flex-shrink-0 pt-1 ${iconColor}`}>
                        <IconComponent className="h-6 w-6" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                              {notification.title}
                            </h3>
                            <p className="text-sm mt-1 text-gray-700 dark:text-gray-400">
                              {notification.message}
                            </p>
                            {notification.metadata?.senderName && (
                              <p className="text-xs text-gray-500 dark:text-gray-600 mt-2">From: {notification.metadata.senderName}</p>
                            )}
                          </div>

                          {/* Unread indicator */}
                          <div className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0 mt-1" />
                        </div>

                        {/* Time and actions */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                          <span className="text-xs text-gray-500 dark:text-gray-600">{formatTime(notification.createdAt)}</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-auto py-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification.id);
                              }}
                            >
                              Mark read
                            </Button>
                            {notification.relatedRideId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-auto py-1 gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/dashboard/my-rides/${notification.relatedRideId}`);
                                }}
                              >
                                View <ChevronRight className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-auto py-1 text-gray-500 hover:text-red-600"
                              disabled={deletingIds.has(notification.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(notification.id);
                              }}
                            >
                              {deletingIds.has(notification.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
