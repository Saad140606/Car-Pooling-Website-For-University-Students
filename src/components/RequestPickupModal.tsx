'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/premium-dialog';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation2, ArrowRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Ride as RideType } from '@/lib/types';
import { setPendingBooking } from '@/lib/bookings';

interface RequestPickupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ride: RideType;
  requestType?: 'pickup' | 'dropoff' | 'both';
  university?: string;
}

export function RequestPickupModal({
  open,
  onOpenChange,
  ride,
  requestType = 'both',
  university = 'ned',
}: RequestPickupModalProps) {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<'pickup' | 'dropoff' | null>(
    requestType === 'both' ? null : requestType
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    if (!selectedType) return;

    setIsProcessing(true);

    // Store the ride info and request type in session storage for use after login
    try {
      setPendingBooking({
        rideId: ride.id,
        university,
      });
      sessionStorage.setItem(
        'pendingRideRequest',
        JSON.stringify({
          rideId: ride.id,
          university: university,
          requestType: selectedType,
          rideDetails: {
            from: ride.from,
            to: ride.to,
            price: ride.price,
            departureTime: ride.departureTime,
          },
        })
      );
    } catch (e) {
      console.warn('Failed to store ride request', e);
    }

    // Redirect to university selection
    router.push('/auth/select-university/');
    
    setIsProcessing(false);
    onOpenChange(false);
  };

  const isPickupOnly = requestType === 'pickup';
  const isDropoffOnly = requestType === 'dropoff';
  const isBoth = requestType === 'both';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-gradient-to-br from-slate-900 to-slate-950 border-slate-700 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Request a Ride
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-base">
            Choose how you'd like to travel
          </DialogDescription>
        </DialogHeader>

        {/* Ride Details */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Route</span>
            <span className="text-sm font-semibold text-white">{ride.price} PKR</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="font-medium truncate">{ride.from}</span>
            <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="font-medium truncate">{ride.to}</span>
          </div>
        </div>

        {/* Request Type Selection */}
        <div className="space-y-3 mb-6">
          {/* Request Pickup Option */}
          {(isPickupOnly || isBoth) && (
            <button
              onClick={() => setSelectedType('pickup')}
              disabled={isProcessing}
              className={cn(
                'w-full p-4 rounded-lg border-2 transition-all duration-200 text-left',
                selectedType === 'pickup'
                  ? 'bg-primary/10 border-primary text-white'
                  : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600'
              )}
            >
              <div className="flex items-start gap-3">
                <MapPin className={cn(
                  'h-5 w-5 mt-1 flex-shrink-0',
                  selectedType === 'pickup' ? 'text-primary' : 'text-slate-500'
                )} />
                <div>
                  <div className="font-semibold text-sm">Request Pickup</div>
                  <div className={cn(
                    'text-xs mt-1',
                    selectedType === 'pickup' ? 'text-slate-300' : 'text-slate-500'
                  )}>
                    Get picked up from your location
                  </div>
                </div>
              </div>
            </button>
          )}

          {/* Request Dropoff Option */}
          {(isDropoffOnly || isBoth) && (
            <button
              onClick={() => setSelectedType('dropoff')}
              disabled={isProcessing}
              className={cn(
                'w-full p-4 rounded-lg border-2 transition-all duration-200 text-left',
                selectedType === 'dropoff'
                  ? 'bg-primary/10 border-primary text-white'
                  : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600'
              )}
            >
              <div className="flex items-start gap-3">
                <Navigation2 className={cn(
                  'h-5 w-5 mt-1 flex-shrink-0',
                  selectedType === 'dropoff' ? 'text-primary' : 'text-slate-500'
                )} />
                <div>
                  <div className="font-semibold text-sm">Request Dropoff</div>
                  <div className={cn(
                    'text-xs mt-1',
                    selectedType === 'dropoff' ? 'text-slate-300' : 'text-slate-500'
                  )}>
                    Get dropped off at your destination
                  </div>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Info Banner */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
          <div className="flex gap-2 text-sm text-blue-200">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>Sign in or create an account to complete your booking</span>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedType || isProcessing}
            className="bg-primary hover:bg-primary/90"
          >
            {isProcessing ? 'Redirecting...' : 'Continue to Sign In'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
