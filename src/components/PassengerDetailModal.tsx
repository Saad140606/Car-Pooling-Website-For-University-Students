'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserNameWithBadge } from '@/components/UserNameWithBadge';
import { parseTimestamp } from '@/lib/timestampUtils';
import { Calendar, MapPin, Phone, X, AlertCircle, ArrowDown, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PassengerDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking?: any;
  passengerName?: string;
  passengerVerified?: boolean;
  pickupLocation?: string;
  dropoffLocation?: string;
  rideDateTime?: Date | string;
  price?: number | string;
  phoneNumber?: string;
  university?: string;
  rideId?: string;
  bookingId?: string;
  onCancelSuccess?: () => void;
}

export default function PassengerDetailModal({
  open,
  onOpenChange,
  booking,
  passengerName = 'Passenger',
  passengerVerified = false,
  pickupLocation = 'Unknown',
  dropoffLocation = 'Unknown',
  rideDateTime,
  price = 0,
  phoneNumber,
  university = '',
  rideId = '',
  bookingId = '',
  onCancelSuccess,
}: PassengerDetailModalProps) {
  const { toast } = useToast();
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const dateText = React.useMemo(() => {
    try {
      const dt = parseTimestamp(rideDateTime, { silent: true });
      if (!dt) return '⚠ Invalid Date';

      return dt.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return '⚠ Error parsing date';
    }
  }, [rideDateTime]);

  const initials = passengerName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleCancelPassenger = async () => {
    if (!rideId || !bookingId || !university) {
      toast({ variant: 'destructive', title: 'Error', description: 'Missing required information' });
      return;
    }

    setIsCancelling(true);
    try {
      const response = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university,
          rideId,
          bookingId,
          reason: 'Driver cancelled passenger',
          isDriverCancel: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel booking');
      }

      toast({
        title: 'Passenger Cancelled',
        description: `${passengerName} has been removed from the ride.`,
      });

      setShowCancelDialog(false);
      onOpenChange(false);
      onCancelSuccess?.();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Cancellation Failed',
        description: err?.message || 'Failed to cancel passenger',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700">
          {/* Header */}
          <DialogHeader>
            <DialogTitle className="text-white text-lg flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              Passenger Details
            </DialogTitle>
          </DialogHeader>

          {/* Main Content */}
          <div className="space-y-4 mt-4">
            {/* Passenger Profile Section */}
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <h3 className="text-xs text-slate-400 mb-3">PASSENGER</h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/20 flex items-center justify-center font-semibold text-sm text-green-300 flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <UserNameWithBadge
                    name={passengerName}
                    verified={passengerVerified}
                    size="lg"
                    truncate={false}
                  />
                  {phoneNumber && (
                    <a
                      href={`tel:${phoneNumber}`}
                      className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors mt-1"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>{phoneNumber}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Locations Section */}
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <h3 className="text-xs text-slate-400 mb-3">LOCATIONS</h3>
              <div className="space-y-3">
                {/* Pickup */}
                <div className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-400">PICKUP</p>
                    <p className="text-sm text-green-200/90 font-medium break-words">{pickupLocation}</p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center py-1">
                  <ArrowDown className="h-4 w-4 text-slate-500" />
                </div>

                {/* Dropoff */}
                <div className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0 mt-2" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-400">DROPOFF</p>
                    <p className="text-sm text-red-200/90 font-medium break-words">{dropoffLocation}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Ride Details Section */}
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <h3 className="text-xs text-slate-400 mb-3">RIDE DETAILS</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="h-4 w-4" />
                    <span>Date & Time</span>
                  </div>
                  <span className="text-slate-300 font-medium">{dateText}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Price</span>
                  <span className="font-semibold text-primary">PKR {price}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => setShowCancelDialog(true)}
                disabled={isCancelling}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white transition-all duration-300 hover:scale-[1.02]"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Passenger'}
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all duration-300"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancellation Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Cancel Passenger?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Are you sure you want to cancel <span className="font-semibold text-white">{passengerName}</span> from this ride? This will remove them and update your cancellation metrics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/80">
              Cancellations affect your driver rating. Excessive cancellations may result in account suspension.
            </p>
          </div>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="bg-slate-700 hover:bg-slate-600 text-white border-0 transition-all duration-300">
              Keep Passenger
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelPassenger}
              disabled={isCancelling}
              className="bg-red-600 hover:bg-red-700 text-white transition-all duration-300 hover:scale-[1.02]"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Passenger'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
