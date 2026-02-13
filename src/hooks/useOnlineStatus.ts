'use client';

import { useState, useEffect } from 'react';

export interface OfflineStatus {
  isOnline: boolean;
  lastOnlineTime: Date | null;
  offlineDuration: number; // milliseconds offline
}

/**
 * Hook to detect offline/online status
 * Provides real-time updates when connection changes
 */
export function useOnlineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });

  const [lastOnlineTime, setLastOnlineTime] = useState<Date | null>(
    typeof navigator !== 'undefined' && navigator.onLine ? new Date() : null
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('[OfflineStatus] Device is online');
      setIsOnline(true);
      setLastOnlineTime(new Date());
    };

    const handleOffline = () => {
      console.warn('[OfflineStatus] Device is offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const offlineDuration = !isOnline && lastOnlineTime
    ? Date.now() - lastOnlineTime.getTime()
    : 0;

  return {
    isOnline,
    lastOnlineTime,
    offlineDuration,
  };
}
