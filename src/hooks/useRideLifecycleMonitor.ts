'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useUser } from '@/firebase';
import { LIFECYCLE_CONFIG } from '@/config/lifecycle';

/**
 * CRITICAL: Client-side Ride Lifecycle Monitor
 * 
 * This hook provides a deterministic, time-based state checker that:
 * 1. Monitors ride departure times
 * 2. Automatically triggers completion window checks
 * 3. Runs on page load, periodically, and when app regains focus
 * 4. Calls backend API to update server state when needed
 * 
 * COMPLETION_DELAY: 5 minutes (testing) - configurable
 */

export interface RideLifecycleState {
  needsCompletion: boolean;
  lifecycleStatus: string | null;
  minutesUntilCompletion: number | null;
  shouldShowCompletionUI: boolean;
}

interface LifecycleMonitorOptions {
  ride: any;
  booking?: any; // For passengers
  university: string;
  checkInterval?: number; // milliseconds, default 15000 (15 seconds)
  completionDelayMinutes?: number; // default 5
}

/**
 * Hook to monitor ride lifecycle and trigger completion workflows
 */
export function useRideLifecycleMonitor({
  ride,
  booking,
  university,
  checkInterval = LIFECYCLE_CONFIG.CLIENT_CHECK_INTERVAL_MS,
  completionDelayMinutes = LIFECYCLE_CONFIG.COMPLETION_DELAY_MINUTES,
}: LifecycleMonitorOptions): RideLifecycleState {
  const { user } = useUser();
  const [state, setState] = useState<RideLifecycleState>({
    needsCompletion: false,
    lifecycleStatus: null,
    minutesUntilCompletion: null,
    shouldShowCompletionUI: false,
  });
  
  const lastCheckRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Calculate if ride needs completion based on time
   */
  const calculateLifecycleState = useCallback((): RideLifecycleState => {
    if (!ride || !ride.departureTime) {
      return {
        needsCompletion: false,
        lifecycleStatus: null,
        minutesUntilCompletion: null,
        shouldShowCompletionUI: false,
      };
    }

    // Parse departure time
    const departureMs = ride.departureTime.seconds 
      ? ride.departureTime.seconds * 1000 
      : new Date(ride.departureTime).getTime();

    if (isNaN(departureMs)) {
      console.error('[LifecycleMonitor] Invalid departure time:', ride.departureTime);
      return {
        needsCompletion: false,
        lifecycleStatus: null,
        minutesUntilCompletion: null,
        shouldShowCompletionUI: false,
      };
    }

    const nowMs = Date.now();
    const completionThresholdMs = departureMs + (completionDelayMinutes * 60 * 1000);
    const minutesUntilCompletion = Math.floor((completionThresholdMs - nowMs) / (60 * 1000));

    // Get current lifecycle status
    const currentLifecycleStatus = ride.lifecycleStatus || 'OPEN';

    // Determine if completion threshold has been reached (time-based, independent of status)
    const isPastCompletionThreshold = nowMs >= completionThresholdMs;
    
    // Check if ride is in a completion-eligible state
    const isInCompletionState = 
      currentLifecycleStatus === 'IN_PROGRESS' || 
      currentLifecycleStatus === 'COMPLETION_WINDOW';

    // For passengers, also check booking status
    const isConfirmedParticipant = booking 
      ? booking.status === 'CONFIRMED' 
      : true; // For drivers, always true if it's their ride

    // CRITICAL FIX: Show completion UI if time threshold passed AND user is confirmed participant
    // This allows the UI to show even if backend status hasn't updated yet
    // The backend check will be triggered to update the status
    const shouldShowCompletionUI = 
      isPastCompletionThreshold && 
      isConfirmedParticipant &&
      // Only show if ride hasn't already been completed or cancelled
      currentLifecycleStatus !== 'COMPLETED' &&
      currentLifecycleStatus !== 'CANCELLED' &&
      currentLifecycleStatus !== 'FAILED';

    return {
      needsCompletion: isInCompletionState || (isPastCompletionThreshold && shouldShowCompletionUI),
      lifecycleStatus: currentLifecycleStatus,
      minutesUntilCompletion,
      shouldShowCompletionUI,
    };
  }, [ride, booking, completionDelayMinutes]);

  /**
   * Trigger backend to update lifecycle status if needed
   */
  const triggerBackendCheck = useCallback(async () => {
    if (!user || !ride || !university) return;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/ride-lifecycle/check-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          university,
          rideId: ride.id,
        }),
      });

      if (!response.ok) {
        console.error('[LifecycleMonitor] Backend check failed:', await response.text());
      } else {
        const result = await response.json();
        console.log('[LifecycleMonitor] Backend check result:', result);
      }
    } catch (error) {
      console.error('[LifecycleMonitor] Error triggering backend check:', error);
    }
  }, [user, ride, university]);

  /**
   * Main check function
   */
  const checkLifecycle = useCallback(() => {
    const now = Date.now();
    
    // Throttle checks to avoid excessive API calls
    if (now - lastCheckRef.current < 5000) {
      return;
    }
    
    lastCheckRef.current = now;

    // Calculate new state
    const newState = calculateLifecycleState();
    setState(newState);

    // CRITICAL FIX: Trigger backend check if past completion threshold
    // This ensures the backend updates the lifecycle status from IN_PROGRESS to COMPLETION_WINDOW
    // Even if the status hasn't been updated yet, we need to trigger the backend
    if (newState.shouldShowCompletionUI) {
      console.log('[LifecycleMonitor] Triggering backend check - completion threshold reached');
      triggerBackendCheck();
    }

    console.log('[LifecycleMonitor] State check:', {
      rideId: ride?.id,
      lifecycleStatus: newState.lifecycleStatus,
      minutesUntilCompletion: newState.minutesUntilCompletion,
      shouldShowUI: newState.shouldShowCompletionUI,
    });
  }, [calculateLifecycleState, triggerBackendCheck, ride]);

  /**
   * Set up periodic checking
   */
  useEffect(() => {
    // Initial check
    checkLifecycle();

    // Set up interval
    intervalRef.current = setInterval(checkLifecycle, checkInterval);

    // Check when window regains focus
    const handleFocus = () => {
      console.log('[LifecycleMonitor] Window focused, checking lifecycle');
      checkLifecycle();
    };
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkLifecycle, checkInterval]);

  /**
   * Re-check when ride or booking changes (real-time updates)
   */
  useEffect(() => {
    checkLifecycle();
  }, [ride?.lifecycleStatus, ride?.departureTime, booking?.status, checkLifecycle]);

  return state;
}
