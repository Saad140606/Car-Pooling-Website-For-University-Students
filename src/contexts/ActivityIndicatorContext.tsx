'use client';

/**
 * Activity Indicator Context
 * 
 * Provides real-time activity indicator state throughout the app.
 * Manages subscriptions to the activity indicator manager and handles
 * initialization/cleanup for user sessions.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { activityIndicatorManager } from '@/lib/activityIndicatorService';
import { getSelectedUniversity } from '@/lib/university';
import type { ActivityIndicatorState } from '@/types/activityIndicator';

interface ActivityIndicatorContextType {
  // State
  activityState: ActivityIndicatorState;
  hasAnyActivity: boolean;
  hasBookingsActivity: boolean;
  hasRidesActivity: boolean;
  hasAnalyticsActivity: boolean;
  hasChatActivity: boolean;
  hasNotificationsActivity: boolean;

  // Actions
  markBookingsAsViewed: () => void;
  markRidesAsViewed: () => void;
  markAnalyticsAsViewed: () => void;
  markChatAsViewed: () => void;
  markNotificationsAsViewed: () => void;
  reset: () => void;
}

const ActivityIndicatorContext = createContext<ActivityIndicatorContextType | undefined>(undefined);

export function ActivityIndicatorProvider({ children }: { children: React.ReactNode }) {
  const { user, initialized, data: userData } = useUser();
  const firestore = useFirestore();
  const [activityState, setActivityState] = useState<ActivityIndicatorState>({
    bookings: false,
    rides: false,
    analytics: false,
    chat: false,
    notifications: false,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize activity indicator manager when user and university are ready
  useEffect(() => {
    if (!initialized || !firestore) return;

    const university = String(user?.university || userData?.university || getSelectedUniversity() || '').trim().toLowerCase();

    if (user?.uid && university) {
      try {
        activityIndicatorManager.initialize(firestore, user.uid, university);
        setIsInitialized(true);

        // Subscribe to state changes
        const unsubscribe = activityIndicatorManager.subscribe((newState) => {
          setActivityState({ ...newState });
        });

        // Load initial state
        setActivityState(activityIndicatorManager.getState());

        return () => {
          unsubscribe();
        };
      } catch (error) {
        console.error('[ActivityIndicator] Failed to initialize:', error);
      }
    } else if (isInitialized && !user?.uid) {
      // User logged out
      activityIndicatorManager.cleanup();
      setIsInitialized(false);
      setActivityState({
        bookings: false,
        rides: false,
        analytics: false,
        chat: false,
        notifications: false,
      });
    }
  }, [user?.uid, user?.university, userData?.university, initialized, firestore, isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Note: We don't cleanup on unmount to preserve cross-tab state
      // Check if user is still logged in before cleanup
    };
  }, []);

  const markBookingsAsViewed = useCallback(() => {
    activityIndicatorManager.markAsViewed('bookings').catch((error) => {
      console.error('[ActivityIndicator] Failed to mark bookings viewed:', error);
    });
  }, []);

  const markRidesAsViewed = useCallback(() => {
    activityIndicatorManager.markAsViewed('rides').catch((error) => {
      console.error('[ActivityIndicator] Failed to mark rides viewed:', error);
    });
  }, []);

  const markAnalyticsAsViewed = useCallback(() => {
    activityIndicatorManager.markAsViewed('analytics').catch((error) => {
      console.error('[ActivityIndicator] Failed to mark analytics viewed:', error);
    });
  }, []);

  const markChatAsViewed = useCallback(() => {
    activityIndicatorManager.markAsViewed('chat').catch((error) => {
      console.error('[ActivityIndicator] Failed to mark chat viewed:', error);
    });
  }, []);

  const markNotificationsAsViewed = useCallback(() => {
    activityIndicatorManager.markAsViewed('notifications').catch((error) => {
      console.error('[ActivityIndicator] Failed to mark notifications viewed:', error);
    });
  }, []);

  const reset = useCallback(() => {
    activityIndicatorManager.reset().catch((error) => {
      console.error('[ActivityIndicator] Failed to reset activity state:', error);
    });
  }, []);

  const hasAnyActivity =
    activityState.bookings || activityState.rides || activityState.analytics || activityState.chat || activityState.notifications;
  const hasBookingsActivity = activityState.bookings;
  const hasRidesActivity = activityState.rides;
  const hasAnalyticsActivity = activityState.analytics;
  const hasChatActivity = activityState.chat;
  const hasNotificationsActivity = activityState.notifications;

  const value: ActivityIndicatorContextType = {
    activityState,
    hasAnyActivity,
    hasBookingsActivity,
    hasRidesActivity,
    hasAnalyticsActivity,
    hasChatActivity,
    hasNotificationsActivity,
    markBookingsAsViewed,
    markRidesAsViewed,
    markAnalyticsAsViewed,
    markChatAsViewed,
    markNotificationsAsViewed,
    reset,
  };

  return (
    <ActivityIndicatorContext.Provider value={value}>
      {children}
    </ActivityIndicatorContext.Provider>
  );
}

/**
 * Hook to use activity indicator context
 */
export function useActivityIndicator() {
  const context = useContext(ActivityIndicatorContext);
  if (!context) {
    throw new Error(
      'useActivityIndicator must be used within ActivityIndicatorProvider'
    );
  }
  return context;
}
