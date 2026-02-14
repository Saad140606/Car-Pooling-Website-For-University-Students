"use client";

import React from 'react';
import { collection, query, where, orderBy, limit, doc, updateDoc, serverTimestamp, getDoc, getDocs, runTransaction } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MapLeaflet from '@/components/MapLeaflet';
import ChatButton from '@/components/chat/ChatButton';
import NotificationBadge from '@/components/NotificationBadge';
import { InlineVerifiedBadge } from '@/components/VerificationBadge';
import { UserNameWithBadge } from '@/components/UserNameWithBadge';
import { isUserVerified } from '@/lib/verificationUtils';
import { Booking as BookingType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { MapPin, Clock, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/contexts/NotificationContext';
import { ErrorState, EmptyState, LoadingState } from '@/components/StateComponents';
import { safeGet } from '@/lib/safeApi';
import { CancellationConfirmDialog } from '@/components/CancellationConfirmDialog';
import { BookingDetailDialog } from './BookingDetailDialog';
import { useRideLifecycleMonitor } from '@/hooks/useRideLifecycleMonitor';
import { LIFECYCLE_CONFIG } from '@/config/lifecycle';

/**
 * Safe array helper
 */
function toArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value !== null && value !== undefined) return [value];
  return [];
}

/**
 * Safe date formatting utility
 */
function formatDate(ts: any, defaultValue = '') {
  try {
    if (!ts || typeof ts !== 'object') return defaultValue;
    const milliseconds = ts.seconds ? ts.seconds * 1000 : ts;
    const date = new Date(milliseconds);
    if (isNaN(date.getTime())) return defaultValue;
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.debug('[formatDate] Error formatting date:', error);
    return defaultValue;
  }
}

interface BookingCardProps {
  booking: BookingType | null | undefined;
  university: string | null | undefined;
  cancellationRate?: number;
}

function BookingCard({ booking, university, cancellationRate = 0 }: BookingCardProps) {
  // Safety checks
  if (!booking || !booking.id || !university) {
    return null;
  }

  const ride = safeGet(booking, 'ride');
  const driver = safeGet(booking, 'driverDetails') || safeGet(booking, 'ride.driverInfo') || { fullName: 'Driver' };
  
  const [confirming, setConfirming] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [showCancelDialog, setShowCancelDialog] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');
  const [showCompletionCancel, setShowCompletionCancel] = React.useState(false);
  const [confirmationProcessed, setConfirmationProcessed] = React.useState(booking.status === 'CONFIRMED');
  const [rideStatus, setRideStatus] = React.useState<'available' | 'full' | 'expired'>('available');
  const [departureTimer, setDepartureTimer] = React.useState<string>('');
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [localBookingStatus, setLocalBookingStatus] = React.useState<string>(booking.status || 'pending');
  const [showBookingDetail, setShowBookingDetail] = React.useState(false);
  
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { getUnreadForRide } = useNotifications();
  const lifecycleStatus = (ride as any)?.lifecycleStatus;
  const needsCompletion = booking.status === 'CONFIRMED' && (lifecycleStatus === 'IN_PROGRESS' || lifecycleStatus === 'COMPLETION_WINDOW');

  // CRITICAL: Client-side lifecycle monitor for deterministic completion window
  const lifecycleState = useRideLifecycleMonitor({
    ride,
    booking,
    university,
    // Using global config: checkInterval and completionDelayMinutes from @/config/lifecycle
  });

  // Safe ride status check
  const checkRideStatus = React.useCallback(async () => {
    if (!firestore || !ride || !ride.id) {
      console.debug('[BookingCard] Ride data not fully available yet');
      return;
    }

    try {
      setStatusError(null);
      
      // Check departure time
      const departureTimeData = safeGet(ride, 'departureTime');
      if (!departureTimeData) {
        console.debug('[BookingCard] Departure time not available');
        return;
      }

      const departureTime = new Date(
        departureTimeData.seconds ? departureTimeData.seconds * 1000 : departureTimeData
      );
      
      if (isNaN(departureTime.getTime())) {
        console.debug('[BookingCard] Invalid departure time');
        return;
      }

      if (departureTime <= new Date()) {
        setRideStatus('expired');
        return;
      }

      // Check seat availability
      const rideRef = doc(firestore, 'universities', university, 'rides', ride.id);
      const rideSnap = await getDoc(rideRef);
      
      if (!rideSnap.exists()) {
        console.debug('[BookingCard] Ride not found');
        setRideStatus('expired');
        return;
      }

      const rideData = rideSnap.data();
      const confirmedBookings = safeGet(rideData, 'confirmedPassengers.length', 0);
      const totalSeats = safeGet(rideData, 'seats', 4);
      const seatsAvailable = totalSeats - confirmedBookings;

      setRideStatus(seatsAvailable > 0 ? 'available' : 'full');
    } catch (err) {
      console.debug('[BookingCard] Failed to check ride status:', err);
    }
  }, [firestore, ride, university]);

  // Check status on mount and set up polling
  React.useEffect(() => {
    checkRideStatus();
    const interval = setInterval(checkRideStatus, 5000);
    return () => clearInterval(interval);
  }, [checkRideStatus]);

  const handleConfirmRide = async () => {
    // ONE-CLICK PROTECTION: Prevent duplicate confirmations
    if (confirmationProcessed || localBookingStatus === 'CONFIRMED') {
      toast({
        title: 'Already Confirmed',
        description: 'This ride has already been confirmed.'
      });
      return;
    }

    if (!firestore || !user?.uid || !booking?.id || !booking?.rideId || !ride?.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Missing required booking information'
      });
      return;
    }
    
    try {
      // IMMEDIATE UI UPDATE: Show loading state and disable button
      setConfirming(true);
      setStatusError(null);
      setConfirmationProcessed(true);
      setLocalBookingStatus('CONFIRMED');

      // Re-check before confirming
      const rideRef = doc(firestore, 'universities', university, 'rides', ride.id);
      const bookingRef = doc(firestore, 'universities', university, 'bookings', booking.id);
      
      const bookingSnap = await getDoc(bookingRef);
      
      // IDEMPOTENT CHECK: If already confirmed, skip confirmation logic
      if (bookingSnap.exists() && bookingSnap.data().status === 'CONFIRMED') {
        toast({
          title: 'Success',
          description: 'Ride already confirmed!'
        });
        setLocalBookingStatus('CONFIRMED');
        checkRideStatus();
        return;
      }

      const rideSnap = await getDoc(rideRef);
      
      if (!rideSnap.exists()) {
        toast({ variant: 'destructive', title: 'Error', description: 'Ride not found' });
        setConfirmationProcessed(false);
        setLocalBookingStatus(booking.status);
        return;
      }

      const rideData = rideSnap.data();
      const confirmedBookings = safeGet(rideData, 'confirmedPassengers.length', 0);
      const totalSeats = safeGet(rideData, 'seats', 4);
      const seatsAvailable = totalSeats - confirmedBookings;

      // Check departure time
      const departureTimeData = safeGet(rideData, 'departureTime');
      if (!departureTimeData) {
        toast({ variant: 'destructive', title: 'Error', description: 'Invalid ride time' });
        setConfirmationProcessed(false);
        setLocalBookingStatus(booking.status);
        return;
      }

      const departureTime = new Date(
        departureTimeData.seconds ? departureTimeData.seconds * 1000 : departureTimeData
      );

      if (departureTime <= new Date()) {
        toast({ variant: 'destructive', title: 'Ride Expired', description: 'This ride has already departed' });
        setRideStatus('expired');
        setConfirmationProcessed(false);
        setLocalBookingStatus(booking.status);
        return;
      }

      if (seatsAvailable <= 0) {
        toast({ variant: 'destructive', title: 'Seats Full', description: 'No seats available for this ride' });
        setRideStatus('full');
        setConfirmationProcessed(false);
        setLocalBookingStatus(booking.status);
        return;
      }

      // ATOMIC TRANSACTION: Ensure idempotent confirmation
      await runTransaction(firestore, async (transaction) => {
        const currentBookingSnap = await transaction.get(bookingRef);
        
        // CRITICAL: Check if already confirmed within transaction
        if (currentBookingSnap.exists() && currentBookingSnap.data().status === 'CONFIRMED') {
          throw new Error('ALREADY_CONFIRMED');
        }

        const currentRideSnap = await transaction.get(rideRef);
        if (!currentRideSnap.exists()) throw new Error('Ride no longer exists');
        
        const currentRideData = currentRideSnap.data();
        const currentSeats = safeGet(currentRideData, 'availableSeats', 0);
        const confirmedCount = safeGet(currentRideData, 'confirmedPassengers.length', 0);
        const actualAvailable = currentSeats - confirmedCount;

        if (actualAvailable <= 0) {
          throw new Error('SEATS_FULL');
        }

        // Check if user already confirmed (idempotency key)
        const confirmedPassengers = currentRideData.confirmedPassengers || [];
        if (confirmedPassengers.includes(user.uid)) {
          throw new Error('ALREADY_CONFIRMED');
        }

        // Confirm the booking
        transaction.update(bookingRef, {
          status: 'CONFIRMED',
          confirmedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Add to confirmed passengers (only if not already present)
        transaction.update(rideRef, {
          confirmedPassengers: [...confirmedPassengers, user.uid],
          availableSeats: Math.max(0, currentSeats - 1),
          updatedAt: serverTimestamp(),
          ...(currentSeats - 1 === 0 && { status: 'full' })
        });
      });

      // SUCCESS: UI already updated optimistically
      toast({
        title: 'Success',
        description: 'Ride confirmed! Driver can now pick you up.'
      });
      
      checkRideStatus();
    } catch (err: any) {
      console.debug('[handleConfirmRide] Error:', err);
      
      // RESET STATE ON ERROR
      setConfirmationProcessed(false);
      setLocalBookingStatus(booking.status || 'pending');
      
      if (err.message === 'SEATS_FULL') {
        toast({
          variant: 'destructive',
          title: 'Seats Full',
          description: 'All seats have been taken'
        });
        setRideStatus('full');
      } else if (err.message === 'ALREADY_CONFIRMED') {
        toast({
          title: 'Already Confirmed',
          description: 'This ride has already been confirmed.'
        });
        setLocalBookingStatus('CONFIRMED');
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: err?.message || 'Failed to confirm ride'
        });
      }
    } finally {
      setConfirming(false);
    }
  };

  const handlePassengerComplete = async () => {
    if (!user) return;
    setIsCompleting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/ride-lifecycle/transition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          university,
          rideId: ride?.id || booking.rideId,
          action: 'passenger_complete',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast({ variant: 'destructive', title: 'Completion Failed', description: data.error || 'Failed to complete ride.' });
        return;
      }

      toast({ title: 'Completion Confirmed', description: 'Thanks for confirming your ride.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to confirm completion.' });
    } finally {
      setIsCompleting(false);
    }
  };

  const handlePassengerCancel = async () => {
    if (!user) return;
    if (!cancelReason.trim()) {
      toast({ variant: 'destructive', title: 'Reason Required', description: 'Please provide a cancellation reason.' });
      return;
    }

    setIsCompleting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/ride-lifecycle/transition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          university,
          rideId: ride?.id || booking.rideId,
          action: 'passenger_cancel',
          reason: cancelReason,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast({ variant: 'destructive', title: 'Cancellation Failed', description: data.error || 'Failed to cancel completion.' });
        return;
      }

      toast({ title: 'Cancellation Submitted', description: 'Your cancellation has been recorded.' });
      setShowCompletionCancel(false);
      setCancelReason('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to submit cancellation.' });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCancelRide = async () => {
    if (!firestore || !user?.uid || !booking?.id || !booking?.rideId || !ride?.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Missing required booking information'
      });
      return;
    }

    setCancelling(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          university,
          rideId: ride.id,
          bookingId: booking.id,
          reason: 'Passenger cancelled booking',
          isDriverCancel: false // Passenger is canceling their own booking
        })
      });

      const data = await res.json();
      if (!res.ok) {
        // Handle specific error messages
        if (res.status === 403) {
          toast({
            variant: 'destructive',
            title: 'Account Locked',
            description: data.message || 'Your account has been temporarily locked due to high cancellation rates.'
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Cancellation Failed',
            description: data.message || data.error || 'Failed to cancel booking'
          });
        }
        return;
      }

      toast({
        title: 'Booking Cancelled',
        description: 'Your booking has been cancelled and the seat has been released.'
      });

      // Update local state
      setLocalBookingStatus('CANCELLED');
      setConfirmationProcessed(false);
      setShowCancelDialog(false);
    } catch (err: any) {
      console.error('Error cancelling ride:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Failed to cancel booking'
      });
    } finally {
      setCancelling(false);
    }
  };

  // Departure timer
  React.useEffect(() => {
    if (booking?.status !== 'CONFIRMED' || !ride?.departureTime) return;

    const updateTimer = () => {
      try {
        const now = new Date();
        const departureData = safeGet(ride, 'departureTime');
        const departure = new Date(
          departureData?.seconds ? departureData.seconds * 1000 : departureData
        );

        if (isNaN(departure.getTime())) {
          setDepartureTimer('Invalid time');
          return;
        }

        const diff = departure.getTime() - now.getTime();

        if (diff <= 0) {
          setDepartureTimer('Ride has started');
          return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setDepartureTimer(`${hours}h ${minutes}m ${seconds}s`);
      } catch (err) {
        console.debug('[Timer] Error updating timer:', err);
        setDepartureTimer('Unable to calculate');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [booking?.status, ride?.departureTime]);

  const driverName = safeGet(driver, 'fullName', 'Ride Provider');
  const driverVerified = !!(safeGet(driver, 'universityEmailVerified') && safeGet(driver, 'idVerified')) || safeGet(driver, 'isVerified') || false;
  const driverInitials = driverName.split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();
  const rideFrom = safeGet(ride, 'from', 'Unknown');
  const rideTo = safeGet(ride, 'to', 'Unknown');
  const ridePrice = safeGet(ride, 'price') ?? safeGet(booking, 'price', 0);
  const rideRoute = safeGet(ride, 'route', []);
  const pickupPoint = safeGet(booking, 'pickupPoint');
  const pickupPlaceName = safeGet(booking, 'pickupPlaceName', '');
  const dropoffPlaceName = safeGet(booking, 'dropoffPlaceName', '');

  const rideId = safeGet(ride, 'id');
  const unreadCount = rideId ? getUnreadForRide(rideId) : 0;
  const chatId = safeGet(booking, 'chatId') || booking.id;

  return (
    <>
    <Card 
      className="overflow-hidden transition-all duration-300 ease-out hover:shadow-xl hover:shadow-primary/20 border border-slate-700 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-xl cursor-pointer"
      onClick={() => setShowBookingDetail(true)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold text-xs flex-shrink-0 shadow-lg">
              {driverInitials || 'U'}
              {rideId && unreadCount > 0 && (
                <NotificationBadge count={unreadCount} dot position="top-right" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1">
                <UserNameWithBadge 
                  name={driverName} 
                  verified={driverVerified}
                  size="md"
                  truncate
                />
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {booking.status === 'CONFIRMED' && (
                  <Badge className="gap-1 bg-green-600/80 text-white text-[10px] py-0 px-1.5">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Confirmed
                  </Badge>
                )}
                {booking.status === 'accepted' && (
                  <Badge className="gap-1 bg-blue-600/80 text-white text-[10px] py-0 px-1.5">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Pending
                  </Badge>
                )}
                {booking.status === 'pending' && (
                  <Badge className="gap-1 bg-amber-600/80 text-white text-[10px] py-0 px-1.5">
                    <AlertCircle className="h-2.5 w-2.5" /> Awaiting
                  </Badge>
                )}
                {(booking.status === 'declined' || booking.status === 'rejected') && (
                  <Badge className="gap-1 bg-red-600/80 text-white text-[10px] py-0 px-1.5">
                    <AlertCircle className="h-2.5 w-2.5" /> Rejected
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-primary">PKR {ridePrice}</div>
            <div className="text-[10px] text-slate-400">per seat</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-2.5 space-y-2">
        {/* ========================================
            COMPLETION WINDOW - PASSENGER UI (PROMINENT)
            ======================================== */}
        {lifecycleState.shouldShowCompletionUI && (
          <div className="mb-4 p-4 rounded-lg border-2 border-emerald-500 bg-gradient-to-br from-emerald-900/40 to-emerald-950/60 animate-pulse-slow" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <h3 className="font-bold text-lg text-white">🎉 Complete Your Ride</h3>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              Did this ride complete successfully? Please confirm or report any issues.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handlePassengerComplete}
                disabled={isCompleting}
                className="flex-1 h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-500"
              >
                {isCompleting ? 'Submitting...' : '✓ Ride Completed'}
              </Button>
              <Dialog open={showCompletionCancel} onOpenChange={setShowCompletionCancel}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="flex-1 h-12 text-base font-bold border-red-600 text-red-400 hover:bg-red-900/20"
                    disabled={isCompleting}
                  >
                    ✗ Report Issue
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Report Ride Issue</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <p className="text-sm text-slate-300">Please select the reason for cancellation:</p>
                    <div className="space-y-2">
                      {['Driver did not arrive', 'Late arrival', 'Ride cancelled by driver', 'Route changed', 'Safety concern', 'Other'].map((reason) => (
                        <button
                          key={reason}
                          onClick={() => setCancelReason(reason)}
                          className={`w-full p-3 rounded-lg border text-left transition-all ${
                            cancelReason === reason
                              ? 'border-emerald-500 bg-emerald-900/30 text-white'
                              : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                    {cancelReason === 'Other' && (
                      <textarea
                        className="w-full min-h-[90px] rounded-md border border-slate-700 bg-slate-900/80 p-3 text-sm text-slate-100 placeholder-slate-500"
                        value={cancelReason === 'Other' ? '' : cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Please explain the issue..."
                      />
                    )}
                  </div>
                  <DialogFooter className="gap-2">
                    <DialogClose asChild>
                      <Button variant="ghost" className="text-slate-300">Close</Button>
                    </DialogClose>
                    <Button 
                      onClick={handlePassengerCancel} 
                      disabled={isCompleting || !cancelReason || cancelReason.trim().length === 0} 
                      className="bg-red-600 hover:bg-red-500"
                    >
                      {isCompleting ? 'Submitting...' : 'Submit Report'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-xs text-slate-400 mt-3 text-center">
              This helps maintain ride quality and safety for all users
            </p>
          </div>
        )}

        {/* Route */}
        <div className="space-y-2 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0"></div>
              <span className="text-slate-400 font-medium">From</span>
            </div>
            <div className="ml-4 text-slate-200 truncate">{rideFrom}</div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500 flex-shrink-0"></div>
              <span className="text-slate-400 font-medium">To</span>
            </div>
            <div className="ml-4 text-slate-200 truncate">{rideTo}</div>
          </div>
        </div>

        {/* Pickup/Dropoff */}
        <div className="space-y-1.5 text-xs">
          {pickupPlaceName && (
            <div>
              <span className="text-slate-400 font-medium">Pickup:</span>
              <div className="text-slate-300 truncate">{pickupPlaceName}</div>
            </div>
          )}
          {dropoffPlaceName && (
            <div>
              <span className="text-slate-400 font-medium">Dropoff:</span>
              <div className="text-slate-300 truncate">{dropoffPlaceName}</div>
            </div>
          )}
        </div>

        {/* Departure time */}
        <div className="text-xs">
          <span className="text-slate-400 font-medium">Departure:</span>
          <div className="text-slate-300">{formatDate(ride?.departureTime, 'Unknown time')}</div>
        </div>

        {/* Departure timer for confirmed rides */}
        {booking.status === 'CONFIRMED' && departureTimer && (
          <div className="text-xs">
            <span className="text-slate-400 font-medium">Time remaining:</span>
            <div className="text-blue-400 font-mono">{departureTimer}</div>
          </div>
        )}

        {/* Status error */}
        {statusError && (
          <div className="text-xs bg-red-900/30 border border-red-700/50 text-red-200 p-2 rounded">
            {statusError}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pt-3" onClick={(e) => e.stopPropagation()}>
        {/* ACCEPTED STATUS - Show Confirm button */}
        {(booking.status === 'accepted' || localBookingStatus === 'accepted') && !confirmationProcessed && (
          <>
            <Button
              onClick={handleConfirmRide}
              disabled={confirming || confirmationProcessed || rideStatus !== 'available'}
              size="sm"
              className="w-full h-10 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20"
            >
              {confirming ? 'Confirming...' : 'Confirm Ride'}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              {chatId && (
                <ChatButton chatId={chatId} university={university} label="Chat" className="h-9 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 shadow-md shadow-blue-500/20" />
              )}
              <Button
                onClick={() => setShowCancelDialog(true)}
                disabled={cancelling}
                variant="destructive"
                size="sm"
                className="h-9"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Ride'}
              </Button>
            </div>
          </>
        )}

        {booking.status === 'pending' && !confirmationProcessed && (
          <div className="grid grid-cols-2 gap-2 w-full">
            {chatId && (
              <ChatButton chatId={chatId} university={university} label="Chat" className="h-9 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 shadow-md shadow-blue-500/20" />
            )}
            <Button
              onClick={() => setShowCancelDialog(true)}
              disabled={cancelling}
              variant="destructive"
              size="sm"
              className="h-9"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Request'}
            </Button>
          </div>
        )}

        {/* CONFIRMED STATUS - Show Confirmed badge and Cancel button */}
        {(localBookingStatus === 'CONFIRMED' || confirmationProcessed || booking.status === 'CONFIRMED') && (
          <div className="w-full space-y-2">
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-green-600/20 border border-green-600/50 text-green-200 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Ride Confirmed!
            </div>
            <div className="flex gap-2">
              {chatId && (
                <ChatButton chatId={chatId} university={university} label="Chat" className="flex-1 h-9 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 shadow-md shadow-blue-500/20" />
              )}
              <Button
                onClick={() => setShowCancelDialog(true)}
                disabled={cancelling}
                variant="destructive"
                size="sm"
                className="flex-1"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Ride'}
              </Button>
            </div>
          </div>
        )}

        {/* RIDE FULL - Show message */}
        {rideStatus === 'full' && !confirmationProcessed && (
          <div className="w-full text-center py-2 px-3 rounded-md bg-amber-600/20 border border-amber-600/50 text-amber-200 text-xs font-medium">
            All Seats Filled
          </div>
        )}

        {/* RIDE EXPIRED - Show message */}
        {rideStatus === 'expired' && !confirmationProcessed && (
          <div className="w-full text-center py-2 px-3 rounded-md bg-red-600/20 border border-red-600/50 text-red-200 text-xs font-medium">
            Ride Has Expired
          </div>
        )}
      </CardFooter>

      {/* Cancellation Confirmation Dialog */}
      <CancellationConfirmDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={handleCancelRide}
        onCancel={() => setShowCancelDialog(false)}
        isLoading={cancelling}
        cancellerRole="passenger"
        cancellationRate={cancellationRate}
        minutesUntilDeparture={departureTimer ? parseInt(departureTimer.split(':')[0] || '0') : 0}
        showRateWarning={cancellationRate > 30}
        isBookingConfirmed={localBookingStatus === 'CONFIRMED' || booking.status === 'CONFIRMED'}
      />
    </Card>

    {/* Booking Detail Dialog */}
    <BookingDetailDialog
      open={showBookingDetail}
      onOpenChange={setShowBookingDetail}
      booking={booking}
    />
    </>
  );
}

export default function MyBookingsPage() {
  const { user, data: userData, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const [retryKey, setRetryKey] = React.useState(0);
  const [pageError, setPageError] = React.useState<string | null>(null);

  // Safety checks
  const hasRequiredData = user?.uid && firestore && userData?.university;

  const bookingsQuery = hasRequiredData ? query(
    collection(firestore, 'universities', userData.university, 'bookings'),
    where('passengerId', '==', user.uid),
    orderBy('createdAt', 'desc'),
    limit(100) // ── PERF: Limit to last 100 bookings ──
  ) : null;

  const { data: bookingsData, loading, error: queryError } = useCollection<BookingType>(
    bookingsQuery,
    { listen: true, includeUserDetails: 'driverId' }
  );

  // Safe bookings array
  const allBookings = toArray(bookingsData).filter((b) => b && b.id);
  
  const bookings = allBookings;
  
  const cancelledCount = allBookings.filter((b) => {
    try {
      return String(b.status).toLowerCase() === 'cancelled';
    } catch (_) {
      return false;
    }
  }).length;
  const cancellationRate = allBookings.length > 0
    ? Math.round((cancelledCount / allBookings.length) * 100)
    : 0;

  const isLoading = userLoading || loading;
  const hasError = !!queryError || !!pageError;
  const errorMessage = queryError?.message || pageError;

  React.useEffect(() => {
    if (queryError) {
      console.debug('[MyBookings] Query error:', queryError);
      setPageError(queryError.message);
    }
  }, [queryError]);

  const handleRetry = () => {
    setRetryKey((prev) => prev + 1);
    setPageError(null);
  };

  const handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
          <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="section-shell py-8 relative z-10">
          <LoadingState count={3} height="h-40" />
        </div>
      </div>
    );
  }

  // Error state
  if (hasError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
          <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="section-shell py-8 relative z-10">
          <ErrorState
            title="Failed to Load Bookings"
            description="We couldn't load your bookings. Please try again."
            error={errorMessage}
            onRetry={handleRetry}
            onGoHome={handleGoHome}
          />
        </div>
      </div>
    );
  }

  // Empty state
  if (!bookings || bookings.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
          <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="section-shell py-8 relative z-10">
          <EmptyState
            title="No Bookings Yet"
            description="You haven't booked any rides yet. Browse available rides and make a booking."
            action={{
              label: 'Find a Ride',
              onClick: () => window.location.href = '/dashboard/rides'
            }}
          />
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
        <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="section-shell py-8 relative z-10">
        <div className="mb-6 sm:mb-8 animate-page">
          <h1 className="text-3xl font-headline font-bold text-slate-50 mb-2">My Bookings</h1>
          <p className="text-slate-300">View and manage your ride bookings ({bookings.length})</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bookings.map((booking) => (
            <BookingCard
              key={`${booking.id}-${retryKey}`}
              booking={booking}
              university={userData?.university}
              cancellationRate={cancellationRate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}


function BookingCardLegacy({ booking, university }: { booking: BookingType, university: string }) {
  const ride = booking.ride;
  const driver = booking.driverDetails || ride?.driverInfo || { fullName: 'Ride Provider' } as any;
  const [confirming, setConfirming] = React.useState(false);
  const [rideStatus, setRideStatus] = React.useState<'available' | 'full' | 'expired'>('available');
  const [departureTimer, setDepartureTimer] = React.useState<string>('');
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { getUnreadForRide } = useNotifications();

  // Check ride status (available, full, or expired)
  const checkRideStatus = React.useCallback(async () => {
    if (!firestore || !ride) return;

    try {
      // Check if departure time has passed
      const departureTime = new Date(ride.departureTime.seconds * 1000);
      if (departureTime <= new Date()) {
        setRideStatus('expired');
        return;
      }

      // Check seat availability
      const rideRef = doc(firestore, 'universities', university, 'rides', ride.id);
      const rideSnap = await getDoc(rideRef);
      
      if (rideSnap.exists()) {
        const rideData = rideSnap.data();
        const confirmedBookings = rideData.confirmedPassengers?.length || 0;
        const seatsAvailable = (rideData.seats || 4) - confirmedBookings;

        setRideStatus(seatsAvailable > 0 ? 'available' : 'full');
      }
    } catch (err) {
      console.error('Failed to check ride status:', err);
    }
  }, [firestore, ride, university]);

  // Check status on mount and set up polling
  React.useEffect(() => {
    checkRideStatus();
    const interval = setInterval(checkRideStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [checkRideStatus]);

  const handleConfirmRide = async () => {
    if (!firestore || !user || !booking.ride) return;
    
    try {
      setConfirming(true);

      // Re-check seat availability right before confirming
      const rideRef = doc(firestore, 'universities', university, 'rides', booking.ride.id);
      const rideSnap = await getDoc(rideRef);
      
      if (!rideSnap.exists()) {
        toast({ variant: 'destructive', title: 'Error', description: 'Ride not found' });
        return;
      }

      const rideData = rideSnap.data();
      const confirmedBookings = rideData.confirmedPassengers?.length || 0;
      const seatsAvailable = (rideData.seats || 4) - confirmedBookings;

      // Check departure time
      const departureTime = new Date(booking.ride.departureTime.seconds * 1000);
      if (departureTime <= new Date()) {
        toast({ variant: 'destructive', title: 'Ride Expired', description: 'The departure time for this ride has passed.' });
        setRideStatus('expired');
        return;
      }

      // Check seat availability
      if (seatsAvailable <= 0) {
        toast({ variant: 'destructive', title: 'Seats Full', description: 'Seats are already full for this ride.' });
        setRideStatus('full');
        return;
      }

      // Use transaction for atomic seat reduction
      const { runTransaction } = await import('firebase/firestore');
      await runTransaction(firestore, async (transaction) => {
        const currentRideSnap = await transaction.get(rideRef);
        if (!currentRideSnap.exists()) throw new Error('Ride not found');
        
        const currentRideData = currentRideSnap.data();
        const currentSeats = currentRideData.availableSeats ?? 0;
        const confirmedCount = currentRideData.confirmedPassengers?.length || 0;
        const actualAvailable = currentSeats - confirmedCount;

        // Re-check seats in transaction
        if (actualAvailable <= 0) {
          throw new Error('SEATS_FULL');
        }

        // Confirm the booking
        const bookingRef = doc(firestore, 'universities', university, 'bookings', booking.id);
        transaction.update(bookingRef, {
          status: 'CONFIRMED',
          confirmedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Add to confirmedPassengers and reduce available seats
        transaction.update(rideRef, {
          confirmedPassengers: [...(currentRideData.confirmedPassengers || []), user.uid],
          availableSeats: currentSeats - 1,
          updatedAt: serverTimestamp(),
          ...(currentSeats - 1 === 0 && { status: 'full' })
        });

        // If seats are now full, auto-decline all remaining pending/accepted requests
        if (currentSeats - 1 === 0) {
          const requestsRef = collection(firestore, `universities/${university}/rides/${booking.ride.id}/requests`);
          const pendingQuery = query(requestsRef, where('status', 'in', ['PENDING', 'pending']));
          const pendingSnap = await getDocs(pendingQuery);
          
          pendingSnap.forEach((reqDoc) => {
            if (reqDoc.id !== booking.id) {
              transaction.update(reqDoc.ref, { 
                status: 'rejected',
                rejectionReason: 'Seats are full',
                updatedAt: serverTimestamp()
              });
            }
          });

          // Also update accepted bookings that haven't been confirmed yet
          const acceptedQuery = query(
            collection(firestore, `universities/${university}/bookings`),
            where('rideId', '==', booking.ride.id),
            where('status', '==', 'accepted')
          );
          const acceptedSnap = await getDocs(acceptedQuery);
          
          acceptedSnap.forEach((bookingDoc) => {
            if (bookingDoc.id !== booking.id) {
              transaction.update(bookingDoc.ref, { 
                status: 'declined',
                declineReason: 'Seats are full',
                updatedAt: serverTimestamp()
              });
            }
          });
        }
      });

      toast({ title: 'Ride Confirmed', description: 'You have confirmed the ride. Driver can now pick you up.' });
      checkRideStatus();
    } catch (err: any) {
      console.error('Failed to confirm ride:', err);
      if (err.message === 'SEATS_FULL') {
        toast({ variant: 'destructive', title: 'Seats Full', description: 'Seats are already full for this ride.' });
        setRideStatus('full');
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to confirm ride' });
      }
    } finally {
      setConfirming(false);
    }
  };

  // Timer for departure countdown on confirmed rides
  React.useEffect(() => {
    if (booking.status !== 'CONFIRMED' || !ride?.departureTime) return;

    const updateTimer = () => {
      const now = new Date();
      const departure = new Date(ride.departureTime.seconds * 1000);
      const diff = departure.getTime() - now.getTime();

      if (diff <= 0) {
        setDepartureTimer('Ride has started');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setDepartureTimer(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [booking.status, ride?.departureTime]);

  return (
    <Card className="overflow-hidden transition-all duration-300 ease-out hover:shadow-xl hover:shadow-primary/20 border border-slate-700 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold text-xs flex-shrink-0 shadow-lg relative">
              {(driver.fullName || 'U').split(' ').map((s:any)=>s[0]).slice(0,2).join('')}
              {ride?.id && getUnreadForRide(ride.id) > 0 && (
                <NotificationBadge count={getUnreadForRide(ride.id)} dot position="top-right" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1">
                <UserNameWithBadge 
                  name={driver.fullName || 'Driver'} 
                  verified={isUserVerified(driver)}
                  size="md"
                  truncate
                />
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {booking.status === 'CONFIRMED' && (
                  <Badge className="gap-1 bg-green-600/80 text-white text-[10px] py-0 px-1.5">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Confirmed
                  </Badge>
                )}
                {booking.status === 'accepted' && (
                  <Badge className="gap-1 bg-blue-600/80 text-white text-[10px] py-0 px-1.5">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Pending Confirmation
                  </Badge>
                )}
                {booking.status === 'pending' && (
                  <Badge className="gap-1 bg-amber-600/80 text-white text-[10px] py-0 px-1.5">
                    <AlertCircle className="h-2.5 w-2.5" /> Awaiting
                  </Badge>
                )}
                {booking.status === 'declined' && (
                  <Badge className="gap-1 bg-red-600/80 text-white text-[10px] py-0 px-1.5">
                    <AlertCircle className="h-2.5 w-2.5" /> Seats Full
                  </Badge>
                )}
                {booking.status === 'rejected' && (
                  <Badge className="gap-1 bg-red-600/80 text-white text-[10px] py-0 px-1.5">
                    <AlertCircle className="h-2.5 w-2.5" /> Rejected
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-primary">PKR {ride?.price ?? booking.price ?? '0'}</div>
            <div className="text-[10px] text-slate-400">per seat</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-2.5 space-y-2">
        {/* Route - FROM/TO format with stacked layout */}
        <div className="space-y-2 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0"></div>
              <span className="text-slate-400 font-medium">From</span>
            </div>
            <div className="ml-4 text-slate-200">{ride?.from || 'Not set'}</div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500 flex-shrink-0"></div>
              <span className="text-slate-400 font-medium">To</span>
            </div>
            <div className="ml-4 text-slate-200 truncate">{ride?.to || 'Not set'}</div>
          </div>
        </div>

        {/* Pickup and Dropoff Points */}
        <div className="space-y-1.5 text-xs">
          {booking.pickupPlaceName && (
            <div>
              <span className="text-slate-400 font-medium">Pickup Point:</span>
              <div className="text-slate-300">{booking.pickupPlaceName}</div>
            </div>
          )}
        </div>

        {/* Time */}
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
          <div className="text-xs text-slate-300">
            {formatDate(ride?.departureTime ?? booking.createdAt)}
          </div>
        </div>

        {/* Timer for departure (confirmed rides) */}
        {booking.status === 'CONFIRMED' && departureTimer && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-700/30">
            <Clock className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
            <div className="text-xs">
              <span className="text-slate-300">Ride starts in: </span>
              <span className="font-bold text-green-400">{departureTimer}</span>
            </div>
          </div>
        )}

        {/* Ride Status */}
        {booking.status === 'accepted' && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-700/30">
            {rideStatus === 'available' && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                <div className="text-xs text-green-400 font-medium">Seats Available</div>
              </>
            )}
            {rideStatus === 'full' && (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                <div className="text-xs text-red-400 font-medium">Seats Full</div>
              </>
            )}
            {rideStatus === 'expired' && (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                <div className="text-xs text-slate-400 font-medium">Departure Time Passed</div>
              </>
            )}
          </div>
        )}

        {/* Confirmed status message */}
        {booking.status === 'CONFIRMED' && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-700/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
            <div className="text-xs text-green-400 font-medium">Ride confirmed - Check in when ready</div>
          </div>
        )}

        {/* Completion required */}
        {needsCompletion && (
          <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3">
            <div className="text-xs text-slate-300 font-medium">Completion required</div>
            <p className="text-[11px] text-slate-400 mt-1">Confirm you completed the ride or cancel with a reason.</p>
            <div className="flex gap-2 mt-3">
              <Button
                onClick={handlePassengerComplete}
                disabled={isCompleting}
                className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-500"
              >
                {isCompleting ? 'Submitting...' : 'Confirm Completion'}
              </Button>
              <Dialog open={showCompletionCancel} onOpenChange={setShowCompletionCancel}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-9">Cancel</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Completion</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-300">Reason (required)</label>
                    <textarea
                      className="w-full min-h-[90px] rounded-md border border-slate-700 bg-slate-900/80 p-2 text-sm text-slate-100"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Explain why you are cancelling..."
                    />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="ghost">Close</Button>
                    </DialogClose>
                    <Button onClick={handlePassengerCancel} disabled={isCompleting} className="bg-red-600 hover:bg-red-500">
                      {isCompleting ? 'Submitting...' : 'Submit Cancellation'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t border-slate-700/50 pt-3 flex gap-2">
        {booking.status === 'declined' && (
          <div className="flex-1 text-center py-2">
            <div className="text-sm text-red-400 font-medium">Seats are full</div>
            <div className="text-xs text-slate-400 mt-0.5">Another passenger confirmed first</div>
          </div>
        )}
        {booking.status === 'rejected' && (
          <div className="flex-1 text-center py-2">
            <div className="text-sm text-red-400 font-medium">Request rejected by driver</div>
          </div>
        )}
        {booking.status === 'accepted' && rideStatus === 'available' ? (
          <>
            <Button 
              onClick={handleConfirmRide} 
              disabled={confirming} 
              className="flex-1 gap-1.5 h-9 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="h-4 w-4" />
              {confirming ? 'Confirming...' : 'Confirm Ride'}
            </Button>
            {((booking as any).chatId || booking.id) && (
              <ChatButton chatId={(booking as any).chatId || booking.id} university={university} label="Chat" />
            )}
          </>
        ) : booking.status === 'CONFIRMED' && ((booking as any).chatId || booking.id) ? (
          <>
            <Button 
              onClick={handleConfirmRide} 
              disabled={true}
              className="flex-1 gap-1.5 h-9 bg-slate-700 hover:bg-slate-700 text-slate-300 cursor-not-allowed"
            >
              <CheckCircle2 className="h-4 w-4" />
              Already Confirmed
            </Button>
            <ChatButton chatId={(booking as any).chatId || booking.id} university={university} label="Chat" />
          </>
        ) : rideStatus === 'expired' ? (
          <Button 
            disabled 
            className="flex-1 gap-1.5 h-9 bg-slate-700 hover:bg-slate-700 text-slate-400 cursor-not-allowed"
          >
            <AlertCircle className="h-4 w-4" />
            Ride Expired
          </Button>
        ) : (
          <>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5 border-slate-600 hover:bg-slate-800/50 h-9">
                  <MapPin className="h-4 w-4" />
                  View Route
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Route from {ride?.from} to {ride?.to}</DialogTitle>
                </DialogHeader>
                <div className="h-[60vh] w-full rounded-lg overflow-hidden border border-slate-700">
                  {ride?.route && ride.route.length ? (
                    <MapLeaflet 
                      route={ride.route as any} 
                      markers={booking.pickupPoint ? [[booking.pickupPoint.lat || booking.pickupPoint[0], booking.pickupPoint.lng || booking.pickupPoint[1]]] : []} 
                      style={{ height: '100%', width: '100%' }} 
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400">No route available</div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            {booking.id && (
              <ChatButton chatId={booking.id} university={university} label="Chat" />
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
}

