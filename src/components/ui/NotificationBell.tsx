// src/components/ui/NotificationBell.tsx
'use client';

import { useState, useEffect } from 'react';
import { collection, doc, query, where, orderBy, limit, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useFirestore } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Bell } from 'lucide-react';

export default function NotificationBell() {
  const firestore = useFirestore();
  const { user, loading: userLoading } = useUser();
  const [open, setOpen] = useState(false);

  const q = (user && firestore) ? query(collection(firestore, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(20)) : null;
  const { data: notifications = [], loading } = useCollection<any>(q);

  const unreadCount = (notifications || []).filter(n => !n.isRead).length;

  useEffect(() => {
    function onFcm(e: any) {
      // When a new FCM arrives, keep the dropdown open briefly to show it.
      setOpen(true);
      setTimeout(() => setOpen(false), 4000);
    }
    window.addEventListener('fcm_message', onFcm as EventListener);
    return () => window.removeEventListener('fcm_message', onFcm as EventListener);
  }, []);

  async function markAsRead(id: string) {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'notifications', id), { isRead: true, readAt: new Date() });
    } catch (e) {
      console.debug('Failed to mark notification read', e);
    }
  }

  async function markAllRead() {
    if (!firestore) return;
    try {
      const batch = notifications.filter(n => !n.isRead).slice(0, 50);
      await Promise.all(batch.map((n: any) => updateDoc(doc(firestore, 'notifications', n.id), { isRead: true, readAt: new Date() })));
    } catch (e) {
      console.debug('Failed to mark all notifications read', e);
    }
  }

  return (
    <div className="relative">
      <button aria-label="Notifications" onClick={() => setOpen(v => !v)} className="relative p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
        <Bell className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-0 -right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium leading-none text-white bg-red-600 rounded-full">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded shadow-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ring-1 ring-black/5">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <strong>Notifications</strong>
            <button onClick={markAllRead} className="text-sm text-blue-600 hover:underline">Mark all read</button>
          </div>
          <ul>
            {notifications.length === 0 && (
              <li className="p-3 text-sm text-gray-500">No notifications</li>
            )}
            {notifications.map((n: any) => (
              <li key={n.id} className={`p-3 border-b border-gray-100 dark:border-gray-700 ${n.isRead ? 'opacity-70' : 'bg-gray-50 dark:bg-gray-900'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">{n.body}</div>
                    {n.relatedId && (
                      <div className="mt-1">
                        <Link href={n.type === 'chat' ? `/dashboard/chats/${n.relatedId}` : n.type === 'ride' ? `/dashboard/rides/${n.relatedId}` : '/dashboard'} className="text-xs text-blue-600 hover:underline">Open</Link>
                      </div>
                    )}
                  </div>
                  <div className="ml-2 text-right">
                    <div className="text-xs text-gray-500">{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : ''}</div>
                    {!n.isRead && (<button onClick={() => markAsRead(n.id)} className="mt-2 text-xs text-blue-600">Mark read</button>)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
