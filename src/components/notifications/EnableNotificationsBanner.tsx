'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser } from '@/firebase';
import { fcmTokenManager } from '@/lib/fcmTokenManager';

export function EnableNotificationsBanner() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [requesting, setRequesting] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }

    const syncPermission = () => setPermission(Notification.permission);
    syncPermission();

    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);

    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
    };
  }, []);

  const handleEnable = async () => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }

    try {
      setRequesting(true);
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted' && firestore && user?.uid) {
        await fcmTokenManager.initialize(firestore, user.uid);
      }
    } catch (error) {
      setPermission(Notification.permission);
    } finally {
      setRequesting(false);
    }
  };

  if (permission === 'unsupported' || permission === 'granted') {
    return null;
  }

  const isDenied = permission === 'denied';

  return (
    <div className="mb-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-950/60 p-4 shadow-lg shadow-primary/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">Enable notifications</p>
            <p className="text-xs text-slate-400">
              {isDenied
                ? 'Notifications are blocked in your browser. Turn them on in site settings, then press Enable again.'
                : 'Get ride updates, messages, and call alerts.'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={handleEnable}
          disabled={requesting}
          className="rounded-full"
        >
          {requesting ? 'Requesting…' : isDenied ? 'Enable Again' : 'Enable'}
        </Button>
      </div>
    </div>
  );
}
