'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CancellationConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  title?: string;
  description?: string;
  cancellerRole: 'driver' | 'passenger'; // 'driver' = cancelling entire ride, 'passenger' = cancelling booking
  cancellationRate?: number;
  minutesUntilDeparture?: number;
  showRateWarning?: boolean;
  showAccountLockWarning?: boolean;
  accountLockMinutesRemaining?: number;
  isBookingConfirmed?: boolean; // NEW: Whether passenger has confirmed the ride
}

/**
 * Cancellation confirmation dialog
 * Shows user their cancellation rate and requires explicit confirmation
 * Alerts them to the consequences of cancellation
 */
export function CancellationConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  isLoading = false,
  title,
  description,
  cancellerRole,
  cancellationRate = 0,
  minutesUntilDeparture,
  showRateWarning = false,
  showAccountLockWarning = false,
  accountLockMinutesRemaining,
  isBookingConfirmed = false, // Default to false
}: CancellationConfirmDialogProps) {
  const [confirming, setConfirming] = React.useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const isHighRate = cancellationRate > 30;
  const isExtremeRate = cancellationRate > 50;
  
  // Passenger canceling before confirmation has no penalty
  const willAffectRate = cancellerRole === 'driver' || (cancellerRole === 'passenger' && isBookingConfirmed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onClick={(e) => { e.stopPropagation(); }}
        onPointerDown={(e) => { e.stopPropagation(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Confirm Cancellation
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cancellation type and impact */}
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            {cancellerRole === 'driver' ? (
              <div>
                <p className="text-sm font-semibold text-white mb-1">You are cancelling this entire ride</p>
                <p className="text-xs text-slate-300">
                  All passengers with confirmed bookings will be notified immediately. Cancellation rate impact applies only when this ride has at least one confirmed passenger.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-white mb-1">You are cancelling your booking</p>
                <p className="text-xs text-slate-300">
                  The driver will be notified and a seat will become available for other passengers.
                </p>
                {!isBookingConfirmed && (
                  <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded">
                    <p className="text-xs text-green-300 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      No penalty - You haven't confirmed this ride yet
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Departure time warning */}
          {willAffectRate && minutesUntilDeparture !== undefined && minutesUntilDeparture <= 30 && (
            <div className="p-3 bg-orange-900/30 rounded-lg border border-orange-700/50">
              <p className="text-xs text-orange-200 font-semibold">
                ⏱️ Last-minute cancellation
              </p>
              <p className="text-xs text-orange-200 mt-1">
                You are cancelling {minutesUntilDeparture} minutes before departure. This counts as a 2x cancellation penalty.
              </p>
            </div>
          )}

          {/* Cancellation rate display - only show if affects rate */}
          {willAffectRate && (
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 mb-2">Your cancellation rate:</p>
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  isExtremeRate ? 'bg-red-600 text-white' :
                  isHighRate ? 'bg-orange-500 text-white' :
                  'bg-green-600 text-white'
                }`}>
                  {cancellationRate}%
                </div>
                <span className={`text-sm font-semibold ${
                  isExtremeRate ? 'text-red-400' :
                  isHighRate ? 'text-orange-400' :
                  'text-green-400'
                }`}>
                  {isExtremeRate ? '🚨 Critical' : isHighRate ? '⚠️ High' : '✓ Good'}
                </span>
              </div>
            </div>
          )}

          {/* High rate warning */}
          {willAffectRate && showRateWarning && isHighRate && (
            <div className={`p-3 rounded-lg border ${
              isExtremeRate
                ? 'bg-red-900/30 border-red-700/50'
                : 'bg-orange-900/30 border-orange-700/50'
            }`}>
              <p className={`text-xs font-semibold mb-1 ${isExtremeRate ? 'text-red-200' : 'text-orange-200'}`}>
                {isExtremeRate ? '🚨 Critical Cancellation Rate' : '⚠️ High Cancellation Rate'}
              </p>
              <p className={`text-xs ${isExtremeRate ? 'text-red-200' : 'text-orange-200'}`}>
                {isExtremeRate
                  ? 'Your account may be locked if you continue cancelling frequently. Please cancel only if absolutely necessary.'
                  : 'Frequent cancellations may affect your account status. Cancelling may lock your account temporarily.'}
              </p>
            </div>
          )}

          {/* Account lock warning */}
          {showAccountLockWarning && (
            <div className="p-3 bg-red-900/30 rounded-lg border border-red-700/50">
              <p className="text-xs text-red-200 font-semibold mb-1">🔒 Account Lock Warning</p>
              <p className="text-xs text-red-200">
                {accountLockMinutesRemaining
                  ? `Your account will be temporarily locked for ${accountLockMinutesRemaining} more minutes due to high cancellation rate. You cannot cancel again during this period.`
                  : 'Your account might be locked if your cancellation rate exceeds the threshold.'}
              </p>
            </div>
          )}

          {/* Threshold info - only show if affects rate */}
          {willAffectRate && (
            <div className="p-2 bg-slate-900/50 rounded-lg border border-slate-700 text-center">
              <p className="text-[10px] text-slate-400">
                Accounts with &gt;=35% cancellation rate (after at least 3 rides) are auto-locked for 7 days
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex justify-end">
          <Button
            variant="ghost"
            onClick={() => {
              setConfirming(false);
              onCancel?.();
              onOpenChange(false);
            }}
            disabled={confirming || isLoading}
          >
            Keep Booking
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={confirming || isLoading}
            className="flex items-center gap-2"
          >
            {confirming || isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" />
                Yes, Cancel
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
