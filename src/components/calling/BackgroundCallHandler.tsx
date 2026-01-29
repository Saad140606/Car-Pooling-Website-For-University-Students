/**
 * Background Call Handler
 * Ensures calls work even when app is backgrounded or not visible
 */

'use client';

import { useEffect, useRef } from 'react';
import { useCallingContext } from '@/contexts/CallingContext';

export function BackgroundCallHandler() {
  const { currentCall, isCallActive } = useCallingContext();
  const pageHiddenRef = useRef(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pageHiddenRef.current = true;
        console.debug('[BackgroundCallHandler] App backgrounded');
        
        // Keep service worker alive for calls
        if (isCallActive) {
          // Broadcast channel to communicate with service worker
          try {
            const channel = new BroadcastChannel('call-active');
            channel.postMessage({ type: 'call-active', callId: currentCall?.id });
          } catch (error) {
            console.debug('[BackgroundCallHandler] BroadcastChannel not available:', error);
          }
        }
      } else {
        pageHiddenRef.current = false;
        console.debug('[BackgroundCallHandler] App foregrounded');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isCallActive, currentCall?.id]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isCallActive) {
        e.preventDefault();
        e.returnValue = 'An active call is in progress. Are you sure you want to leave?';
        return 'An active call is in progress. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isCallActive]);

  // Handle network changes
  useEffect(() => {
    const handleOnline = () => {
      console.debug('[BackgroundCallHandler] Network reconnected');
      // Reconnect call if network was lost
    };

    const handleOffline = () => {
      console.debug('[BackgroundCallHandler] Network disconnected');
      // Show reconnecting state
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return null;
}
