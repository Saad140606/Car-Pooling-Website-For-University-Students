/**
 * RideLifecycleStatus — UI Component
 *
 * Displays the current lifecycle status of a ride with appropriate
 * visual indicators and action buttons based on the user's role.
 *
 * Reflects backend state only — no client-side fake transitions.
 */

'use client';

import React, { useState } from 'react';
import { useRideLifecycle } from '@/hooks/useRideLifecycle';
import { RideStatus, PassengerStatus } from '@/lib/rideLifecycle/types';

// ============================================================================
// STATUS BADGE COLORS
// ============================================================================

const STATUS_COLORS: Record<RideStatus, { bg: string; text: string; border: string }> = {
  [RideStatus.CREATED]:           { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  [RideStatus.OPEN]:              { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  [RideStatus.REQUESTED]:         { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  [RideStatus.ACCEPTED]:          { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  [RideStatus.CONFIRMED]:         { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  [RideStatus.LOCKED]:            { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  [RideStatus.IN_PROGRESS]:       { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  [RideStatus.COMPLETION_WINDOW]: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  [RideStatus.COMPLETED]:         { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  [RideStatus.FAILED]:            { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  [RideStatus.CANCELLED]:         { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-300' },
};

// ============================================================================
// STATUS BADGE
// ============================================================================

function StatusBadge({ status, label }: { status: RideStatus; label: string }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS[RideStatus.OPEN];
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {label}
    </span>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface RideLifecycleStatusProps {
  rideId: string;
  university: string;
  compact?: boolean;
  showActions?: boolean;
  onRatingSubmitted?: () => void;
}

export function RideLifecycleStatus({
  rideId,
  university,
  compact = false,
  showActions = true,
  onRatingSubmitted,
}: RideLifecycleStatusProps) {
  const { state, ui, actions, isLoading, error } = useRideLifecycle(rideId, university);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingTarget, setRatingTarget] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="animate-pulse flex items-center gap-2">
        <div className="h-6 w-24 rounded-full bg-gray-200" />
        {!compact && <div className="h-4 w-32 rounded bg-gray-200" />}
      </div>
    );
  }

  if (error || !state) {
    return null;
  }

  const wrapAction = async (fn: () => Promise<void>) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await fn();
    } catch (e: any) {
      setActionError(e.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ===== COMPACT MODE =====
  if (compact) {
    return <StatusBadge status={state.status} label={ui.statusLabel} />;
  }

  // ===== FULL MODE =====
  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <StatusBadge status={state.status} label={ui.statusLabel} />
        {ui.minutesUntilDeparture !== null && !ui.isTerminal && (
          <span className="text-sm text-muted-foreground">
            {ui.minutesUntilDeparture > 0
              ? `Departs in ${ui.minutesUntilDeparture} min`
              : 'Departed'}
          </span>
        )}
      </div>

      {/* Seat Info */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>
          {state.confirmedPassengers.length}/{state.totalSeats} confirmed
        </span>
        <span>{state.availableSeats} seats available</span>
        {state.reservedSeats > 0 && <span>{state.reservedSeats} reserved</span>}
      </div>

      {/* Confirmed Passengers (driver view) */}
      {ui.userRole === 'driver' && state.confirmedPassengers.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Confirmed Passengers</h4>
          {state.confirmedPassengers.map((p) => (
            <div key={p.userId} className="flex items-center justify-between text-sm p-2 rounded bg-accent/50">
              <span className="truncate">{p.userId}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${p.status === PassengerStatus.NO_SHOW ? 'text-red-500' : 'text-green-500'}`}>
                  {p.status}
                </span>
                {/* No-show button during completion window */}
                {showActions && ui.canComplete && p.status === PassengerStatus.CONFIRMED && (
                  <button
                    onClick={() => wrapAction(() => actions.markNoShow(p.userId))}
                    disabled={actionLoading}
                    className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                  >
                    No-Show
                  </button>
                )}
                {/* Rate button */}
                {showActions && ui.canRate && p.status !== PassengerStatus.NO_SHOW && (
                  <button
                    onClick={() => {
                      setRatingTarget(p.userId);
                      setShowRatingDialog(true);
                    }}
                    className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                  >
                    Rate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {showActions && (
        <div className="flex flex-wrap gap-2">
          {/* Complete Ride */}
          {ui.canComplete && (
            <button
              onClick={() => wrapAction(actions.completeRide)}
              disabled={actionLoading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
            >
              {actionLoading ? 'Processing...' : 'Mark Completed'}
            </button>
          )}

          {/* Cancel Ride (driver) */}
          {ui.canCancel && ui.userRole === 'driver' && (
            <button
              onClick={() => setShowCancelDialog(true)}
              disabled={actionLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
            >
              Cancel Ride
            </button>
          )}

          {/* Rate Driver (passenger) */}
          {ui.canRate && ui.userRole === 'passenger' && state.driverId && (
            <button
              onClick={() => {
                setRatingTarget(state.driverId);
                setShowRatingDialog(true);
              }}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium"
            >
              Rate Driver
            </button>
          )}

          {/* Locked indicator */}
          {ui.isLocked && !ui.isTerminal && !ui.isActive && (
            <span className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium border border-yellow-300">
              🔒 Ride Locked
            </span>
          )}
        </div>
      )}

      {/* Action Error */}
      {actionError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {actionError}
        </div>
      )}

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 space-y-3">
          <h4 className="font-medium text-red-700">Cancel this ride?</h4>
          <p className="text-sm text-red-600">
            This will notify all {state.confirmedPassengers.length + state.pendingRequests.length} passengers
            and restore their seats.
          </p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation (optional)..."
            className="w-full p-2 text-sm border rounded-lg resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() =>
                wrapAction(async () => {
                  await actions.cancelRide(cancelReason || undefined);
                  setShowCancelDialog(false);
                })
              }
              disabled={actionLoading}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
            >
              {actionLoading ? 'Cancelling...' : 'Confirm Cancel'}
            </button>
            <button
              onClick={() => setShowCancelDialog(false)}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
            >
              Keep Ride
            </button>
          </div>
        </div>
      )}

      {/* Rating Dialog */}
      {showRatingDialog && ratingTarget && (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 space-y-3">
          <h4 className="font-medium text-amber-700">Rate this {ui.userRole === 'passenger' ? 'driver' : 'passenger'}</h4>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRatingValue(star)}
                className={`text-2xl ${star <= ratingValue ? 'text-amber-500' : 'text-gray-300'}`}
              >
                ★
              </button>
            ))}
          </div>
          <p className="text-xs text-amber-600">Your rating is anonymous</p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                wrapAction(async () => {
                  await actions.submitRating(ratingTarget, ratingValue);
                  setShowRatingDialog(false);
                  setRatingTarget(null);
                  onRatingSubmitted?.();
                })
              }
              disabled={actionLoading}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm"
            >
              {actionLoading ? 'Submitting...' : 'Submit Rating'}
            </button>
            <button
              onClick={() => {
                setShowRatingDialog(false);
                setRatingTarget(null);
              }}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Transition Log (debug, hidden by default) */}
      {state.transitionLog && state.transitionLog.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Transition log ({state.transitionLog.length})
          </summary>
          <div className="mt-1 space-y-1 pl-2 border-l-2 border-gray-200">
            {state.transitionLog.slice(-5).map((t, i) => (
              <div key={i}>
                {t.from} → {t.to}
                {t.reason && <span className="ml-1 text-gray-400">({t.reason})</span>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * Compact inline lifecycle badge for ride cards.
 */
export function RideLifecycleBadge({
  rideId,
  university,
}: {
  rideId: string;
  university: string;
}) {
  return <RideLifecycleStatus rideId={rideId} university={university} compact showActions={false} />;
}
