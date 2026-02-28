'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserNameWithBadge } from '@/components/UserNameWithBadge';
import { parseTimestamp } from '@/lib/timestampUtils';
import { Calendar, MapPin, Phone, X, AlertCircle, DollarSign, Map } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import dynamic from 'next/dynamic';
import L, { LatLngExpression } from 'leaflet';
import { decodePolyline } from '@/lib/route';
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

const LazyMapLeaflet = dynamic(() => import('@/components/MapLeaflet'), {
  ssr: false,
  loading: () => <div className="h-80 w-full flex items-center justify-center bg-slate-900/50"><div className="text-slate-400">Loading map...</div></div>
});

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
  ride?: any; // Add ride data for map
  user?: any; // Firebase user for authentication
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
  ride,
  user,
}: PassengerDetailModalProps) {
  const { toast } = useToast();
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showMap, setShowMap] = useState(false);

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

  // Map computations
  const routeLatLngs = React.useMemo(() => {
    if (!ride) return [];
    if (ride.routePolyline && typeof ride.routePolyline === 'string') {
      return decodePolyline(ride.routePolyline);
    }
    if (Array.isArray(ride.route)) {
      return (ride.route as any[])
        .map((p) => {
          if (Array.isArray(p) && p.length >= 2) return { lat: Number(p[0]), lng: Number(p[1]) };
          if (p && typeof p.lat === 'number' && typeof p.lng === 'number') return { lat: p.lat, lng: p.lng };
          return null;
        })
        .filter(Boolean) as { lat: number; lng: number }[];
    }
    return [];
  }, [ride]);

  const pickupLatLng = React.useMemo(() => {
    const pt = booking?.pickupPoint;
    if (!pt) return null;
    if (Array.isArray(pt) && pt.length >= 2) return { lat: Number(pt[0]), lng: Number(pt[1]) };
    if (typeof pt === 'object' && pt !== null && typeof pt.lat === 'number' && typeof pt.lng === 'number') {
      return { lat: Number(pt.lat), lng: Number(pt.lng) };
    }
    return null;
  }, [booking?.pickupPoint]);

  const boundsFromRide = React.useMemo(() => {
    const b = ride?.routeBounds;
    if (b && typeof b.minLat === 'number' && typeof b.maxLat === 'number' && typeof b.minLng === 'number' && typeof b.maxLng === 'number') {
      return L.latLngBounds([b.minLat, b.minLng], [b.maxLat, b.maxLng]);
    }
    if (routeLatLngs.length) return L.latLngBounds(routeLatLngs as any);
    return undefined;
  }, [ride, routeLatLngs]);

  // Determine if ride is leaving FROM or going TO university
  const isFromUniversity = React.useMemo(() => {
    if (!ride) return false;
    const fromStr = String(ride.from || '').toLowerCase();
    return fromStr.includes('university') || fromStr.includes('campus') || fromStr.includes('uni');
  }, [ride]);

  // Conditional labels based on ride direction
  const passengerPickupLabel = isFromUniversity ? 'Dropoff Location' : 'Pickup Location';
  const passengerLocationMarkerLabel = isFromUniversity ? 'Your Dropoff' : 'Your Pickup';

  const mapMarkers = React.useMemo(() => {
    const markers: any[] = [];
    if (routeLatLngs.length) {
      markers.push({ lat: routeLatLngs[0].lat, lng: routeLatLngs[0].lng, label: isFromUniversity ? 'Start (University)' : 'Start' });
      if (routeLatLngs.length > 1) {
        const end = routeLatLngs[routeLatLngs.length - 1];
        markers.push({ lat: end.lat, lng: end.lng, label: isFromUniversity ? 'Destination' : 'Destination (University)' });
      }
    }
    if (pickupLatLng) {
      markers.push({ lat: pickupLatLng.lat, lng: pickupLatLng.lng, label: passengerLocationMarkerLabel });
    }
    return markers as LatLngExpression[];
  }, [pickupLatLng, routeLatLngs, isFromUniversity, passengerLocationMarkerLabel]);

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

    if (!user) {
      toast({ variant: 'destructive', title: 'Error', description: 'User not authenticated' });
      return;
    }

    setIsCancelling(true);
    try {
      // Get fresh auth token
      const idToken = await user.getIdToken().catch((err: any) => {
        console.error('[PassengerCancel] Failed to get auth token:', err);
        throw new Error('Failed to authenticate. Please log in again.');
      });

      console.log('[PassengerCancel] Calling API with token...');
      const response = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          university,
          rideId,
          bookingId,
          reason: 'Driver cancelled passenger',
          isDriverCancel: true,
        }),
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = { error: rawText || 'Unknown server error' };
      }

      if (!response.ok) {
        console.error('[PassengerCancel] API error:', { status: response.status, error: data });
        throw new Error(data.error || data.message || `Failed to cancel booking (${response.status})`);
      }

      console.log('[PassengerCancel] Success:', data);
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
        <DialogContent className="max-w-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 max-h-[90vh] overflow-y-auto">
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
            <div className="p-4 bg-gradient-to-br from-slate-800/80 to-slate-900/60 rounded-lg border border-slate-700/50">
              <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-4">👤 Passenger</h3>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500/40 to-emerald-500/30 flex items-center justify-center font-bold text-base text-green-300 flex-shrink-0 ring-2 ring-green-500/30 shadow-lg shadow-green-500/20">
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
                      className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors mt-2 hover:underline"
                    >
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium">{phoneNumber}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Locations Section */}
            <div className="p-4 bg-gradient-to-br from-slate-800/80 to-slate-900/60 rounded-lg border border-slate-700/50 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold">📍 Locations</h3>
                
              </div>
              
              {/* Passenger Pickup/Dropoff Location - Conditional Card */}
              <div className={`p-3.5 rounded-lg hover:transition-all duration-300 border ${
                isFromUniversity
                  ? 'bg-red-900/20 border-red-700/40 hover:border-red-600/60'
                  : 'bg-green-900/20 border-green-700/40 hover:border-green-600/60'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`h-3 w-3 rounded-full flex-shrink-0 mt-1 shadow-lg ${
                    isFromUniversity
                      ? 'bg-red-500 shadow-red-500/50'
                      : 'bg-green-500 shadow-green-500/50'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs uppercase tracking-wider font-semibold ${
                      isFromUniversity ? 'text-red-400/80' : 'text-green-400/80'
                    }`}>{passengerPickupLabel}</p>
                    <p className={`text-sm font-medium mt-1.5 leading-relaxed whitespace-normal break-words ${
                      isFromUniversity ? 'text-red-100' : 'text-green-100'
                    }`}>
                      {pickupLocation}
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-600/60 to-transparent" />

              {/* Dropoff Location - Prominent Card */}
              <div className="p-3.5 bg-red-900/20 border border-red-700/40 rounded-lg hover:border-red-600/60 transition-all duration-300">
                <div className="flex items-start gap-3">
                  <div className="h-3 w-3 rounded-full bg-red-500 flex-shrink-0 mt-1 shadow-lg shadow-red-500/50" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-red-400/80 uppercase tracking-wider font-semibold">Dropoff Location</p>
                    <p className="text-sm text-red-100 font-medium mt-1.5 leading-relaxed whitespace-normal break-words">
                      {dropoffLocation}
                    </p>
                  </div>
                </div>
              </div>
            </div>

         

            {/* Ride Details Section */}
            <div className="p-4 bg-gradient-to-br from-slate-800/80 to-slate-900/60 rounded-lg border border-slate-700/50">
              <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-4">📅 Ride Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-gradient-to-br from-slate-700/40 to-slate-800/30 rounded-lg border border-slate-600/40">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span className="text-xs uppercase tracking-wide">Date & Time</span>
                  </div>
                  <p className="text-slate-100 font-semibold text-sm leading-relaxed">{dateText}</p>
                </div>
                <div className="p-3.5 bg-gradient-to-br from-slate-700/40 to-slate-800/30 rounded-lg border border-slate-600/40">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <DollarSign className="h-4 w-4 flex-shrink-0" />
                    <span className="text-xs uppercase tracking-wide">Price</span>
                  </div>
                  <p className="font-bold text-primary text-lg leading-none">PKR {price}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-slate-700/50 flex-wrap">
              <Button
                onClick={() => setShowCancelDialog(true)}
                disabled={isCancelling}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                {isCancelling ? 'Cancelling...' : 'Remove Passenger'}
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:text-white font-semibold transition-all duration-300"
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
