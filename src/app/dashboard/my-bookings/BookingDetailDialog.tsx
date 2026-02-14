'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MapPin, Calendar, User, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';

interface BookingDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
}

export function BookingDetailDialog({ open, onOpenChange, booking }: BookingDetailDialogProps) {
  const ride = booking?.ride || {};
  const driver = booking?.driverDetails || booking?.ride?.driverInfo || { fullName: 'Driver' };
  
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Time TBD';
    try {
      const date = timestamp.seconds 
        ? new Date(timestamp.seconds * 1000) 
        : new Date(timestamp);
      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Time TBD';
    }
  };

  const getStatusBadge = () => {
    if (booking.status === 'CONFIRMED') {
      return (
        <Badge className="bg-green-600/80 text-white gap-1">
          <CheckCircle2 className="h-3 w-3" /> Confirmed
        </Badge>
      );
    }
    if (booking.status === 'accepted') {
      return (
        <Badge className="bg-blue-600/80 text-white gap-1">
          <CheckCircle2 className="h-3 w-3" /> Pending
        </Badge>
      );
    }
    if (booking.status === 'pending') {
      return (
        <Badge className="bg-amber-600/80 text-white gap-1">
          <AlertCircle className="h-3 w-3" /> Awaiting
        </Badge>
      );
    }
    if (booking.status === 'declined' || booking.status === 'rejected') {
      return (
        <Badge className="bg-red-600/80 text-white gap-1">
          <AlertCircle className="h-3 w-3" /> Rejected
        </Badge>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center justify-between">
            Booking Details
            {getStatusBadge()}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Your booking information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* Driver Info - Compact */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-br from-blue-900/20 to-blue-950/40 border border-blue-700/30">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold text-xs flex-shrink-0">
              {driver.fullName?.split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase() || 'D'}
            </div>
            <div>
              <p className="text-xs text-slate-400">Driver</p>
              <p className="text-sm font-semibold text-white">{driver.fullName || 'Ride Provider'}</p>
            </div>
          </div>

          {/* Route - Compact */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40">
              <MapPin className="h-4 w-4 text-green-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400">From</p>
                <p className="text-sm font-semibold text-white truncate">{ride.from || 'Unknown'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40">
              <MapPin className="h-4 w-4 text-red-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400">To</p>
                <p className="text-sm font-semibold text-white truncate">{ride.to || 'Unknown'}</p>
              </div>
            </div>
          </div>

          {/* Pickup/Dropoff - Only show if available */}
          {booking.pickupPlaceName && (
            <div className="p-2 rounded-lg bg-slate-800/40">
              <p className="text-xs text-slate-400">Your Pickup</p>
              <p className="text-sm text-slate-200 truncate">{booking.pickupPlaceName}</p>
            </div>
          )}

          {/* Departure - Compact */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40">
            <Calendar className="h-4 w-4 text-blue-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-slate-400">Departure</p>
              <p className="text-sm font-semibold text-white">{formatTimestamp(ride.departureTime)}</p>
            </div>
          </div>

          {/* Price - Single mention */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-br from-emerald-900/30 to-emerald-950/50 border border-emerald-700/30">
            <DollarSign className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-400">Fare</p>
              <p className="text-base font-bold text-white">PKR {ride.price || booking.price || 0}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
