/**
 * useRideLifecycle — Frontend Hook
 *
 * Real-time hook that syncs UI state with the backend ride lifecycle.
 * Uses Firestore onSnapshot for live updates.
 * UI ONLY reflects backend state — no client-side fake transitions.
 *
 * Usage:
 *   const { state, actions, isLoading, error } = useRideLifecycle(rideId, university);
 *
 * Provides:
 *   - state: Current lifecycle state (status, passengers, etc.)
 *   - actions: Typed action dispatchers (complete, cancel, rate, etc.)
 *   - UI helpers: isLocked, canCancel, canRate, statusLabel, etc.
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { useUser } from '@/firebase';
import { useFirestore } from '@/firebase';
import {
  RideStatus,
  PassengerStatus,
  type LifecycleRide,
  type RidePassenger,
  LIFECYCLE_CONSTANTS,
} from '@/lib/rideLifecycle/types';
import {
  isRideLocked,
  isTerminalState,
  isCancellationAllowed,
  isBookingAllowed,
  areRatingsAllowed,
  toLegacyStatus,
  fromLegacyStatus,
} from '@/lib/rideLifecycle/stateMachine';

// ============================================================================
// TYPES
// ============================================================================

export interface LifecycleState {
  status: RideStatus;
  legacyStatus: string;
  departureTime: Date | null;
  totalSeats: number;
  availableSeats: number;
  reservedSeats: number;
  confirmedPassengers: RidePassenger[];
  pendingRequests: RidePassenger[];
  cancelledPassengers: RidePassenger[];
  completionWindowEnd: Date | null;
  ratingsOpen: boolean;
  driverId: string;
  from: string;
  to: string;
  price: number;
  rideId: string;
  transitionLog: Array<{ from: string; to: string; reason?: string; timestamp?: any }>;
}

export interface LifecycleActions {
  /** Driver marks ride as completed */
  completeRide: () => Promise<void>;
  /** Driver cancels entire ride */
  cancelRide: (reason?: string) => Promise<void>;
  /** Driver marks passenger as no-show */
  markNoShow: (passengerId: string) => Promise<void>;
  /** Submit a rating */
  submitRating: (ratedUserId: string, rating: number) => Promise<void>;
  /** Initialize lifecycle (called after ride creation) */
  initLifecycle: () => Promise<void>;
}

export interface LifecycleUIState {
  /** Whether the ride is locked (departure time reached) */
  isLocked: boolean;
  /** Whether the ride is in a terminal state */
  isTerminal: boolean;
  /** Whether cancellation is allowed */
  canCancel: boolean;
  /** Whether new bookings are allowed */
  canBook: boolean;
  /** Whether ratings can be submitted */
  canRate: boolean;
  /** User's role in this ride */
  userRole: 'driver' | 'passenger' | 'viewer';
  /** Human-readable status label */
  statusLabel: string;
  /** Whether the ride is actively in progress */
  isActive: boolean;
  /** Whether the driver can complete the ride */
  canComplete: boolean;
  /** Minutes until departure (negative = already departed) */
  minutesUntilDeparture: number | null;
}

export interface UseRideLifecycleReturn {
  state: LifecycleState | null;
  ui: LifecycleUIState;
  actions: LifecycleActions;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// STATUS LABEL MAP
// ============================================================================

const STATUS_LABELS: Record<RideStatus, string> = {
  [RideStatus.CREATED]: 'Created',
  [RideStatus.OPEN]: 'Open for Booking',
  [RideStatus.REQUESTED]: 'Requests Pending',
  [RideStatus.ACCEPTED]: 'Requests Accepted',
  [RideStatus.CONFIRMED]: 'Seats Confirmed',
  [RideStatus.LOCKED]: 'Ride Locked',
  [RideStatus.IN_PROGRESS]: 'In Progress',
  [RideStatus.COMPLETION_WINDOW]: 'Awaiting Completion',
  [RideStatus.COMPLETED]: 'Completed',
  [RideStatus.FAILED]: 'Failed — No Passengers',
  [RideStatus.CANCELLED]: 'Cancelled',
};

// ============================================================================
// API HELPER
// ============================================================================

async function callLifecycleAPI(
  path: string,
  token: string,
  body: Record<string, any>
): Promise<any> {
  const response = await fetch(`/api/ride-lifecycle/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || 'API request failed');
  }

  return data;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRideLifecycle(
  rideId: string | null | undefined,
  university: string | null | undefined
): UseRideLifecycleReturn {
  const { user } = useUser();
  const firestore = useFirestore();
  const [state, setState] = useState<LifecycleState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // ===== REAL-TIME LISTENER =====
  useEffect(() => {
    if (!rideId || !university) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!firestore) {
        setError('Firestore not initialized');
        setIsLoading(false);
        return;
      }
      const rideRef = doc(firestore, `universities/${university}/rides/${rideId}`);

      unsubRef.current = onSnapshot(
        rideRef,
        (snap) => {
          if (!snap.exists()) {
            setState(null);
            setError('Ride not found');
            setIsLoading(false);
            return;
          }

          const data = snap.data();

          // Determine lifecycle status
          let lifecycleStatus: RideStatus;
          if (data.lifecycleStatus && Object.values(RideStatus).includes(data.lifecycleStatus)) {
            lifecycleStatus = data.lifecycleStatus as RideStatus;
          } else {
            lifecycleStatus = fromLegacyStatus(data.status || 'active');
          }

          // Parse departure time
          let departureTime: Date | null = null;
          if (data.departureTime) {
            if (data.departureTime.toDate) {
              departureTime = data.departureTime.toDate();
            } else if (data.departureTime.seconds) {
              departureTime = new Date(data.departureTime.seconds * 1000);
            }
          }

          // Parse completion window end
          let completionWindowEnd: Date | null = null;
          if (data.completionWindowEnd) {
            if (data.completionWindowEnd.toDate) {
              completionWindowEnd = data.completionWindowEnd.toDate();
            } else if (data.completionWindowEnd.seconds) {
              completionWindowEnd = new Date(data.completionWindowEnd.seconds * 1000);
            }
          }

          setState({
            status: lifecycleStatus,
            legacyStatus: data.status || toLegacyStatus(lifecycleStatus),
            departureTime,
            totalSeats: data.totalSeats ?? 0,
            availableSeats: data.availableSeats ?? 0,
            reservedSeats: data.reservedSeats ?? 0,
            confirmedPassengers: data.confirmedPassengers || [],
            pendingRequests: data.pendingRequests || [],
            cancelledPassengers: data.cancelledPassengers || [],
            completionWindowEnd,
            ratingsOpen: data.ratingsOpen ?? false,
            driverId: data.driverId || '',
            from: data.from || '',
            to: data.to || '',
            price: data.price ?? 0,
            rideId,
            transitionLog: data.transitionLog || [],
          });

          setIsLoading(false);
          setError(null);
        },
        (err) => {
          console.error('[useRideLifecycle] Snapshot error:', err);
          setError('Failed to load ride data');
          setIsLoading(false);
        }
      );
    } catch (err) {
      console.error('[useRideLifecycle] Setup error:', err);
      setError('Failed to initialize ride listener');
      setIsLoading(false);
    }

    return () => {
      unsubRef.current?.();
    };
  }, [rideId, university, firestore]);

  // ===== COMPUTE UI STATE =====
  const ui = useMemo<LifecycleUIState>(() => {
    if (!state) {
      return {
        isLocked: false,
        isTerminal: false,
        canCancel: false,
        canBook: false,
        canRate: false,
        userRole: 'viewer',
        statusLabel: 'Loading...',
        isActive: false,
        canComplete: false,
        minutesUntilDeparture: null,
      };
    }

    const userId = user?.uid;
    const isDriver = userId === state.driverId;
    const isPassenger = state.confirmedPassengers.some((p) => p.userId === userId);

    let userRole: 'driver' | 'passenger' | 'viewer' = 'viewer';
    if (isDriver) userRole = 'driver';
    else if (isPassenger) userRole = 'passenger';

    const locked = isRideLocked(state.status);
    const terminal = isTerminalState(state.status);
    const canCancel = isCancellationAllowed(state.status);
    const canBook = isBookingAllowed(state.status);
    const canRate = areRatingsAllowed(state.status, state.ratingsOpen);

    const isActive =
      state.status === RideStatus.IN_PROGRESS ||
      state.status === RideStatus.COMPLETION_WINDOW;

    const canComplete =
      isDriver &&
      (state.status === RideStatus.COMPLETION_WINDOW ||
        state.status === RideStatus.IN_PROGRESS);

    let minutesUntilDeparture: number | null = null;
    if (state.departureTime) {
      minutesUntilDeparture = Math.floor(
        (state.departureTime.getTime() - Date.now()) / (60 * 1000)
      );
    }

    return {
      isLocked: locked,
      isTerminal: terminal,
      canCancel,
      canBook,
      canRate,
      userRole,
      statusLabel: STATUS_LABELS[state.status] || state.status,
      isActive,
      canComplete,
      minutesUntilDeparture,
    };
  }, [state, user?.uid]);

  // ===== ACTIONS =====
  const getToken = useCallback(async (): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    if (!token) throw new Error('Failed to get auth token');
    return token;
  }, [user]);

  const completeRide = useCallback(async () => {
    if (!rideId || !university) throw new Error('Missing ride/university');
    const token = await getToken();
    await callLifecycleAPI('transition', token, {
      university,
      rideId,
      action: 'complete',
    });
  }, [rideId, university, getToken]);

  const cancelRideAction = useCallback(
    async (reason?: string) => {
      if (!rideId || !university) throw new Error('Missing ride/university');
      const token = await getToken();
      await callLifecycleAPI('transition', token, {
        university,
        rideId,
        action: 'cancel',
        reason,
      });
    },
    [rideId, university, getToken]
  );

  const markNoShow = useCallback(
    async (passengerId: string) => {
      if (!rideId || !university) throw new Error('Missing ride/university');
      const token = await getToken();
      await callLifecycleAPI('transition', token, {
        university,
        rideId,
        action: 'no_show',
        passengerId,
      });
    },
    [rideId, university, getToken]
  );

  const submitRatingAction = useCallback(
    async (ratedUserId: string, rating: number) => {
      if (!rideId || !university) throw new Error('Missing ride/university');
      const token = await getToken();
      await callLifecycleAPI('rate', token, {
        university,
        rideId,
        ratedUserId,
        rating,
      });
    },
    [rideId, university, getToken]
  );

  const initLifecycle = useCallback(async () => {
    if (!rideId || !university) throw new Error('Missing ride/university');
    const token = await getToken();
    await callLifecycleAPI('init', token, {
      university,
      rideId,
    });
  }, [rideId, university, getToken]);

  const actions: LifecycleActions = useMemo(
    () => ({
      completeRide,
      cancelRide: cancelRideAction,
      markNoShow,
      submitRating: submitRatingAction,
      initLifecycle,
    }),
    [completeRide, cancelRideAction, markNoShow, submitRatingAction, initLifecycle]
  );

  return { state, ui, actions, isLoading, error };
}
