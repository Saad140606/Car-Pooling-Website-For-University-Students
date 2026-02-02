'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EnableNotificationsBanner() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
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
    } catch (error) {
      setPermission(Notification.permission);
    } finally {
      setRequesting(false);
    }
  };

  if (permission !== 'default') {
    return null;
  }

  return (
    <div className="mb-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-950/60 p-4 shadow-lg shadow-primary/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">Enable notifications</p>
            <p className="text-xs text-slate-400">Get ride updates, messages, and call alerts.</p>
          </div>
        </div>
        <Button
          type="button"
          onClick={handleEnable}
          disabled={requesting}
          className="rounded-full"
        >
          {requesting ? 'Enabling…' : 'Enable'}
        </Button>
      </div>
    </div>
  );
}
