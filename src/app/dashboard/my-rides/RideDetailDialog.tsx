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
import { MapPin, Calendar, Users, DollarSign, Clock } from 'lucide-react';

interface RideDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ride: any;
  acceptedCount: number;
  availableSeats: number;
}

export function RideDetailDialog({ open, onOpenChange, ride, acceptedCount, availableSeats }: RideDetailDialogProps) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center justify-between">
            Ride Details
            <Badge variant={ride.status === 'active' ? 'default' : ride.status === 'full' ? 'destructive' : 'secondary'}>
              {ride.status}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Your ride information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* Price and Seats - Combined in one row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gradient-to-br from-emerald-900/30 to-emerald-950/50 border border-emerald-700/30">
              <DollarSign className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-400">Fare</p>
                <p className="text-base font-bold text-white">PKR {ride.price}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gradient-to-br from-purple-900/30 to-purple-950/50 border border-purple-700/30">
              <Users className="h-5 w-5 text-purple-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-400">Available</p>
                <p className="text-base font-bold text-white">{availableSeats} seats</p>
              </div>
            </div>
          </div>

          {/* Route - Compact */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40">
              <MapPin className="h-4 w-4 text-green-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400">From</p>
                <p className="text-sm font-semibold text-white truncate">{ride.from}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40">
              <MapPin className="h-4 w-4 text-red-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400">To</p>
                <p className="text-sm font-semibold text-white truncate">{ride.to}</p>
              </div>
            </div>
          </div>

          {/* Departure - Compact */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40">
            <Calendar className="h-4 w-4 text-blue-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-slate-400">Departure</p>
              <p className="text-sm font-semibold text-white">{formatTimestamp(ride.departureTime)}</p>
            </div>
          </div>

          {/* Passengers - Compact */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-br from-blue-900/20 to-blue-950/40 border border-blue-700/30">
            <Users className="h-4 w-4 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-400">Confirmed Passengers</p>
              <p className="text-sm font-semibold text-blue-300">{acceptedCount} booked</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
