'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { MapPin, Clock, Users, CheckCircle2, AlertCircle, Calendar, DollarSign, User } from 'lucide-react';
import { Booking as BookingType } from '@/lib/types';
import { UserNameWithBadge } from '@/components/UserNameWithBadge';
import { isUserVerified } from '@/lib/verificationUtils';
import { CancellationConfirmDialog } from '@/components/CancellationConfirmDialog';
import ChatButton from '@/components/chat/ChatButton';
import { safeGet } from '@/lib/safeApi';

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
    return defaultValue;
  }
}

// Calculate time remaining until departure
function getTimeRemaining(departureTime: any): string {
  try {
    if (!departureTime) return '';
    const depTime = departureTime?.seconds 
      ? new Date(departureTime.seconds * 1000)
      : new Date(departureTime);
    
    const now = new Date();
    const diff = depTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'Departed';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days}d ${hours % 24}h`;
    }
    
    return `in ${hours}h ${minutes}m`;
  } catch {
    return '';
  }
}

interface MyBookingCardPremiumProps {
  booking: BookingType | null | undefined;
  university: string | null | undefined;
  cancellationRate?: number;
}

export default function MyBookingCardPremium({ booking, university, cancellationRate = 0 }: MyBookingCardPremiumProps) {
  // Safety checks
  if (!booking || !booking.id || !university) {
    return null;
  }

  const ride = safeGet(booking, 'ride');
  const driver = safeGet(booking, 'driverDetails') || safeGet(booking, 'ride.driverInfo') || { fullName: 'Driver' };
  
  const [showDetailDialog, setShowDetailDialog] = React.useState(false);
  const [showCancelDialog, setShowCancelDialog] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const driverName = safeGet(driver, 'fullName', 'Ride Provider');
  const driverVerified = !!(safeGet(driver, 'universityEmailVerified') && safeGet(driver, 'idVerified')) || safeGet(driver, 'isVerified') || false;
  const driverInitials = driverName.split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();
  const rideFrom = safeGet(ride, 'from', 'Unknown');
  const rideTo = safeGet(ride, 'to', 'Unknown');
  const ridePrice = safeGet(ride, 'price') ?? safeGet(booking, 'price', 0);
  const pickupPlaceName = safeGet(booking, 'pickupPlaceName', '');
  const dropoffPlaceName = safeGet(booking, 'dropoffPlaceName', '');
  const chatId = safeGet(booking, 'chatId') || booking.id;

  const timeRemaining = getTimeRemaining(ride?.departureTime);

  const handleCancelRide = async () => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be signed in.' });
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
          isDriverCancel: false
        })
      });

      const data = await res.json();
      if (!res.ok) {
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

      setShowCancelDialog(false);
      setShowDetailDialog(false);
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

  const getStatusBadge = () => {
    const status = String(booking.status).toLowerCase();
    if (status === 'confirmed') {
      return <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Confirmed</Badge>;
    }
    if (status === 'accepted') {
      return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Accepted</Badge>;
    }
    if (status === 'pending') {
      return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">Pending</Badge>;
    }
    if (status === 'declined' || booking.status === 'rejected') {
      return <Badge className="bg-red-500/20 text-red-300 border-red-500/30">Declined</Badge>;
    }
    if (status === 'cancelled') {
      return <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30">Cancelled</Badge>;
    }
    return <Badge variant="secondary">{booking.status}</Badge>;
  };

  return (
    <>
      {/* COMPACT CARD - CLICKABLE */}
      <Card 
        className="group relative overflow-hidden bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 backdrop-blur-md border-slate-700/50 hover:border-primary/50 transition-all duration-300 cursor-pointer hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1"
        onClick={() => setShowDetailDialog(true)}
      >
        {/* Hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <CardHeader className="relative z-10 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              {/* Driver Avatar */}
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold text-xs flex-shrink-0">
                {driverInitials}
              </div>
              
              {/* Driver Info */}
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <UserNameWithBadge 
                    name={driverName} 
                    verified={driverVerified}
                    size="sm"
                    truncate
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge()}
                </div>
              </div>
            </div>
            
            {/* Price */}
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-bold text-primary">PKR {ridePrice}</div>
              <div className="text-xs text-slate-400">per seat</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 pt-0 space-y-3">
          {/* Route */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-400 font-medium">From</p>
                <p className="text-sm font-semibold text-white truncate">{rideFrom}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-400 font-medium">To</p>
                <p className="text-sm font-semibold text-white truncate">{rideTo}</p>
              </div>
            </div>
          </div>

          {/* Pickup Location Preview */}
          {pickupPlaceName && (
            <div className="flex items-start gap-2 pt-2 border-t border-slate-700/50">
              <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-400">Pickup</p>
                <p className="text-xs text-slate-300 truncate">{pickupPlaceName}</p>
              </div>
            </div>
          )}

          {/* DateTime & Time Remaining */}
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-700/50">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {formatDate(ride?.departureTime, 'Time TBD')}
            </div>
            {timeRemaining && (
              <div className="flex items-center gap-1.5 text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                {timeRemaining}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 text-center pt-1">Click to view details</p>
        </CardContent>
      </Card>

      {/* DETAIL DIALOG - OPENS ON CARD CLICK */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Booking Details</DialogTitle>
            <DialogDescription>
              View your ride booking information and manage your booking
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Booking Status */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div>
                <p className="text-xs text-slate-400 font-medium mb-1">Booking Status</p>
                <div className="flex items-center gap-2">
                  {getStatusBadge()}
                </div>
              </div>
              {(String(booking.status).toLowerCase() === 'confirmed') && (
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              )}
              {(booking.status === 'pending') && (
                <AlertCircle className="h-8 w-8 text-amber-400" />
              )}
            </div>

            {/* Driver Information */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Driver Information
              </h3>
              
              <div className="pl-7 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold text-sm">
                    {driverInitials}
                  </div>
                  <div>
                    <UserNameWithBadge 
                      name={driverName} 
                      verified={driverVerified}
                      size="md"
                    />
                    <p className="text-xs text-slate-400">Driver</p>
                  </div>
                </div>
                
                {chatId && (
                  <div className="pt-2">
                    <ChatButton chatId={chatId} university={university} label="Chat with Driver" className="w-full" />
                  </div>
                )}
              </div>
            </div>

            {/* Ride Details */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Route & Schedule
              </h3>
              
              <div className="pl-7 space-y-3">
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">From</p>
                  <p className="text-sm font-semibold text-white">{rideFrom}</p>
                </div>
                
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">To</p>
                  <p className="text-sm font-semibold text-white">{rideTo}</p>
                </div>

                {pickupPlaceName && (
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1">Your Pickup Point</p>
                    <p className="text-sm text-white">{pickupPlaceName}</p>
                  </div>
                )}

                {dropoffPlaceName && (
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1">Your Dropoff Point</p>
                    <p className="text-sm text-white">{dropoffPlaceName}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1">Departure</p>
                    <p className="text-sm text-white">{formatDate(ride?.departureTime, 'Not set')}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1">Time Remaining</p>
                    <p className="text-sm text-amber-400">{timeRemaining || 'Departed'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Payment
              </h3>
              
              <div className="pl-7">
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">Price per Seat</p>
                  <p className="text-lg font-bold text-primary">PKR {ridePrice}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            {booking.status !== 'CANCELLED' && String(booking.status).toLowerCase() !== 'cancelled' && (
              <div className="flex flex-col gap-2 pt-4 border-t border-slate-700/50">
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Booking'}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancellation Confirmation Dialog */}
      <CancellationConfirmDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={handleCancelRide}
        onCancel={() => setShowCancelDialog(false)}
        isLoading={cancelling}
        cancellerRole="passenger"
        cancellationRate={cancellationRate}
        minutesUntilDeparture={(() => {
          try {
            if (!ride?.departureTime) return 0;
            const depTime = ride.departureTime?.seconds 
              ? new Date(ride.departureTime.seconds * 1000)
              : new Date(ride.departureTime);
            const diff = depTime.getTime() - Date.now();
            return Math.max(0, Math.floor(diff / (60 * 1000)));
          } catch {
            return 0;
          }
        })()}
        showRateWarning={cancellationRate > 30}
        isBookingConfirmed={String(booking.status).toLowerCase() === 'confirmed'}
      />
    </>
  );
}
