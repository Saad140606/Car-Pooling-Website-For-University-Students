"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { collection, collectionGroup, query, where, orderBy, limit, doc, updateDoc, serverTimestamp, getDoc, getDocs, runTransaction } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from '@/components/map';
import { getRoutePinIcon } from '@/lib/mapPinIcons';
import ChatButton from '@/components/chat/ChatButton';
import NotificationBadge from '@/components/NotificationBadge';
import { InlineVerifiedBadge } from '@/components/VerificationBadge';
import { UserNameWithBadge } from '@/components/UserNameWithBadge';
import { isUserVerified } from '@/lib/verificationUtils';
import { Booking as BookingType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MapPin, Clock, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import { useNotifications } from '@/contexts/NotificationContext';
import { ErrorState, EmptyState, LoadingState } from '@/components/StateComponents';
import { safeGet } from '@/lib/safeApi';
import { CancellationConfirmDialog } from '@/components/CancellationConfirmDialog';
import { BookingDetailDialog } from './BookingDetailDialog';
import { decodePolyline } from '@/lib/route';
import { parseTimestampToMs } from '@/lib/timestampUtils';
import { trackEvent } from '@/lib/ga';

const LazyMapLeaflet = dynamic(() => import('@/components/MapLeaflet'), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center bg-slate-900/50"><div className="text-slate-400">Loading map...</div></div>
});

/**
 * Safe array helper
 */
function toArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value !== null && value !== undefined) return [value];
  return [];
}

const ACTIVE_BOOKING_STATUSES = new Set(['PENDING', 'ACCEPTED', 'CONFIRMED', 'ONGOING', 'IN_PROGRESS', 'COMPLETION_WINDOW', 'COMPLETED']);
const HIDDEN_BOOKING_STATUSES = new Set(['CANCELLED', 'CANCELED', 'REJECTED', 'DECLINED', 'REMOVED', 'EXPIRED', 'FAILED']);

/**
 * Safe date formatting utility
 */
function formatDate(ts: any, defaultValue = '') {
  try {
    if (!ts) return defaultValue;

    const milliseconds = parseTimestampToMs(ts, { silent: true });

    if (milliseconds === null) return defaultValue;
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
  const [showRoutePickup, setShowRoutePickup] = React.useState(false);
  const [showConfirmRideDialog, setShowConfirmRideDialog] = React.useState(false);
  const initialStatus = String(booking.status || 'pending');
  const [confirmationProcessed, setConfirmationProcessed] = React.useState(initialStatus.toUpperCase() === 'CONFIRMED');
  const [rideStatus, setRideStatus] = React.useState<'available' | 'full' | 'expired'>('available');
  const [seatsLeft, setSeatsLeft] = React.useState<number | null>(() => {
    const initialSeats = safeGet(ride, 'availableSeats');
    return typeof initialSeats === 'number' ? Math.max(0, initialSeats) : null;
  });
  const [departureTimer, setDepartureTimer] = React.useState<string>('');
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [localBookingStatus, setLocalBookingStatus] = React.useState<string>(initialStatus);
  const [showBookingDetail, setShowBookingDetail] = React.useState(false);
  const normalizedStatus = React.useMemo(
    () => String(localBookingStatus || booking.status || 'pending').trim().toUpperCase(),
    [localBookingStatus, booking.status]
  );
  
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const actionFeedback = useActionFeedback();
  const { getUnreadForRide } = useNotifications();
  const isConfirmedByRideState = React.useMemo(() => {
    if (!user?.uid) return false;
    const confirmedPassengers = Array.isArray((ride as any)?.confirmedPassengers)
      ? (ride as any).confirmedPassengers
      : [];

    return confirmedPassengers.some((p: any) => {
      if (typeof p === 'string') return p === user.uid;
      return p?.userId === user.uid;
    });
  }, [ride, user?.uid]);
  const isEffectivelyConfirmed = normalizedStatus === 'CONFIRMED' || confirmationProcessed || isConfirmedByRideState;

  React.useEffect(() => {
    if (isConfirmedByRideState) {
      setConfirmationProcessed(true);
      setLocalBookingStatus('CONFIRMED');
    }
  }, [isConfirmedByRideState]);

  // Safe ride status check
  const checkRideStatus = React.useCallback(async () => {
    if (!firestore || !ride || !ride.id) {
      console.debug('[BookingCard] Ride data not fully available yet');
      return;
    }

    try {
      setStatusError(null);
      
      // Check departure time
      const departureTimeData =
        safeGet(ride, 'departureTime') ||
        safeGet(booking, 'departureTime') ||
        safeGet(booking, 'ride.departureTime');
      if (!departureTimeData) {
        console.debug('[BookingCard] Departure time not available');
        return;
      }

      const departureTimeMs = parseTimestampToMs(departureTimeData, { silent: true });

      if (departureTimeMs === null) {
        console.debug('[BookingCard] Invalid departure time');
        return;
      }

      const departureTime = new Date(departureTimeMs);

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
      const seatsAvailable = typeof rideData?.availableSeats === 'number'
        ? Math.max(0, rideData.availableSeats)
        : Math.max(0, totalSeats - confirmedBookings);

      setSeatsLeft(seatsAvailable);

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
    if (isEffectivelyConfirmed) {
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
      actionFeedback.start('Confirming request, please wait…', 'Confirming Request...');

      const idToken = await user.getIdToken(true);
      const response = await fetch('/api/requests/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          university,
          rideId: booking.rideId || ride.id,
          requestId: booking.id,
        }),
      });

      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseData?.error || responseData?.message || 'Failed to confirm ride');
      }

      // SUCCESS: UI already updated optimistically
      toast({
        title: 'Success',
        description: 'Ride confirmed! Driver can now pick you up.'
      });
      trackEvent('ride_acceptance', {
        event_action: 'passenger_confirmed',
        ride_id: booking.rideId || ride.id,
        booking_id: booking.id,
      });
      
      checkRideStatus();
    } catch (err: any) {
      console.debug('[handleConfirmRide] Error:', err);

      // If API returned an error after commit, re-check server state before rolling back UI.
      try {
        const requestRef = doc(firestore, `universities/${university}/rides/${booking.rideId || ride.id}/requests`, booking.id);
        const requestSnap = await getDoc(requestRef);
        const requestStatus = String(requestSnap.data()?.status || '').toUpperCase();
        if (requestStatus === 'CONFIRMED') {
          setConfirmationProcessed(true);
          setLocalBookingStatus('CONFIRMED');
          toast({
            title: 'Ride Confirmed',
            description: 'Confirmation was successful.'
          });
          checkRideStatus();
          return;
        }
      } catch (_) {
        // ignore state recheck failures and continue normal error handling
      }
      
      // RESET STATE ON ERROR
      setConfirmationProcessed(false);
      setLocalBookingStatus(initialStatus);
      
      const lowerMessage = String(err?.message || '').toLowerCase();

      if (err.message === 'SEATS_FULL' || lowerMessage.includes('full') || lowerMessage.includes('all seats are filled')) {
        toast({
          variant: 'destructive',
          title: 'Seats Full',
          description: 'All seats are filled. You cannot confirm this ride.'
        });
        setRideStatus('full');
      } else if (lowerMessage.includes('ride already started') || lowerMessage.includes('cannot confirm this ride now')) {
        toast({
          variant: 'destructive',
          title: 'Ride Started',
          description: 'Ride already started. You cannot confirm this ride now.'
        });
        setRideStatus('expired');
      } else if (err.message === 'ALREADY_CONFIRMED' || err.message?.toLowerCase?.().includes('already confirmed')) {
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
      actionFeedback.clear();
      setConfirming(false);
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

      const rawText = await res.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = { error: rawText || 'Unknown server error' };
      }
      if (!res.ok) {
        console.error('[CancelRide] API error:', { status: res.status, error: data });
        const errMessage = data?.message || data?.error || `Failed to cancel booking (${res.status})`;
        // Handle specific error messages
        if (res.status === 403) {
          toast({
            variant: 'destructive',
            title: 'Account Locked',
            description: errMessage || 'Your account has been temporarily locked due to high cancellation rates.'
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Cancellation Failed',
            description: errMessage
          });
        }
        return;
      }

      toast({
        title: 'Booking Cancelled',
        description: 'Your booking has been cancelled and the seat has been released.'
      });
      trackEvent('ride_cancellation', {
        event_action: 'passenger_cancelled',
        ride_id: ride.id,
        booking_id: booking.id,
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
    const departureSource =
      safeGet(ride, 'departureTime') ||
      safeGet(booking, 'departureTime') ||
      safeGet(booking, 'ride.departureTime');
    if (normalizedStatus !== 'CONFIRMED' || !departureSource) return;

    const updateTimer = () => {
      try {
        const now = new Date();
        const departureMs = parseTimestampToMs(departureSource, { silent: true });
        if (departureMs === null) {
          setDepartureTimer('Invalid time');
          return;
        }
        const departure = new Date(departureMs);

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
  }, [normalizedStatus, ride?.departureTime, (booking as any)?.departureTime]);

  const driverName = safeGet(driver, 'fullName', 'Ride Provider');
  const driverVerified = !!(safeGet(driver, 'universityEmailVerified') && safeGet(driver, 'idVerified')) || safeGet(driver, 'isVerified') || false;
  const driverContactNumber =
    safeGet(driver, 'contactNumber') ||
    safeGet(driver, 'phone') ||
    safeGet(booking, 'driverDetails.contactNumber') ||
    safeGet(booking, 'driverDetails.phone') ||
    '';
  const whatsappContactHref = driverContactNumber
    ? `https://wa.me/${String(driverContactNumber).replace(/\D/g, '')}`
    : null;
  const driverInitials = driverName.split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();
  const rideFrom = safeGet(ride, 'from', 'Unknown');
  const rideTo = safeGet(ride, 'to', 'Unknown');
  const ridePrice = safeGet(ride, 'price') ?? safeGet(booking, 'price', 0);
  const rideRoute = safeGet(ride, 'route', []);
  const pickupPoint = safeGet(booking, 'pickupPoint');
  const pickupPlaceName = safeGet(booking, 'pickupPlaceName', '');
  const dropoffPlaceName = safeGet(booking, 'dropoffPlaceName', '');

  const normalizePoint = React.useCallback((pt: any) => {
    if (!pt) return null;
    if (Array.isArray(pt) && pt.length >= 2) return { lat: Number(pt[0]), lng: Number(pt[1]) };
    if (typeof pt === 'object' && pt !== null && typeof pt.lat === 'number' && typeof pt.lng === 'number') {
      return { lat: Number(pt.lat), lng: Number(pt.lng) };
    }
    return null;
  }, []);

  const pickupLatLng = normalizePoint(pickupPoint);

  const routeFromPolyline = React.useMemo(() => {
    if (ride?.routePolyline && typeof ride.routePolyline === 'string') {
      return decodePolyline(ride.routePolyline).map((p) => [p.lat, p.lng]) as [number, number][];
    }
    return [] as [number, number][];
  }, [ride?.routePolyline]);

  const routeFromArray = React.useMemo(() => {
    if (Array.isArray(ride?.route) && ride.route.length > 0) {
      return ride.route
        .map((p: any) => {
          if (Array.isArray(p) && p.length >= 2) return [Number(p[0]), Number(p[1])] as [number, number];
          if (p && typeof p.lat === 'number' && typeof p.lng === 'number') return [Number(p.lat), Number(p.lng)] as [number, number];
          return null;
        })
        .filter(Boolean) as [number, number][];
    }
    return [] as [number, number][];
  }, [ride?.route]);

  const dropoffLatLng = React.useMemo(() => {
    const directDrop = normalizePoint((booking as any)?.dropoffPoint);
    if (directDrop) return directDrop;
    if (routeFromArray.length > 0) {
      const last = routeFromArray[routeFromArray.length - 1];
      return { lat: last[0], lng: last[1] };
    }
    if (routeFromPolyline.length > 0) {
      const last = routeFromPolyline[routeFromPolyline.length - 1];
      return { lat: last[0], lng: last[1] };
    }
    return null;
  }, [booking, normalizePoint, routeFromArray, routeFromPolyline]);

  const routePath = React.useMemo(() => {
    if (routeFromPolyline.length > 0) return routeFromPolyline;
    if (routeFromArray.length > 0) return routeFromArray;
    if (pickupLatLng && dropoffLatLng) return [[pickupLatLng.lat, pickupLatLng.lng], [dropoffLatLng.lat, dropoffLatLng.lng]] as [number, number][];
    return [] as [number, number][];
  }, [routeFromPolyline, routeFromArray, pickupLatLng, dropoffLatLng]);

  const mapBounds = React.useMemo(() => {
    if (routePath.length > 0) return L.latLngBounds(routePath as any);
    if (pickupLatLng && dropoffLatLng) return L.latLngBounds([
      [pickupLatLng.lat, pickupLatLng.lng],
      [dropoffLatLng.lat, dropoffLatLng.lng]
    ] as any);
    if (pickupLatLng) return L.latLngBounds([[pickupLatLng.lat, pickupLatLng.lng]] as any);
    return null;
  }, [routePath, pickupLatLng, dropoffLatLng]);

  const rideId = safeGet(ride, 'id');
  const unreadCount = rideId ? getUnreadForRide(rideId) : 0;
  const chatId = safeGet(booking, 'chatId') || booking.id;

  const openInGoogleMaps = React.useCallback(() => {
    const origin = pickupLatLng
      ? `${pickupLatLng.lat},${pickupLatLng.lng}`
      : (pickupPlaceName || rideFrom || '').trim();
    const destination = dropoffLatLng
      ? `${dropoffLatLng.lat},${dropoffLatLng.lng}`
      : (dropoffPlaceName || rideTo || '').trim();

    if (!origin && !destination) {
      toast({
        variant: 'destructive',
        title: 'Location unavailable',
        description: 'Pickup and destination are missing for this ride.'
      });
      return;
    }

    const params = new URLSearchParams({ api: '1' });
    if (origin) params.set('origin', origin);
    if (destination) params.set('destination', destination);
    params.set('travelmode', 'driving');

    const mapsUrl = `https://www.google.com/maps/dir/?${params.toString()}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  }, [pickupLatLng, dropoffLatLng, pickupPlaceName, dropoffPlaceName, rideFrom, rideTo, toast]);

  return (
    <>
    <Card 
      className="w-full max-w-sm md:max-w-none overflow-hidden transition-all duration-300 ease-out hover:shadow-xl hover:shadow-primary/20 border border-slate-700 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-xl cursor-pointer"
      onClick={() => setShowBookingDetail(true)}
    >
      <CardHeader className="pb-3 md:px-4 md:pt-4 md:pb-2.5 lg:px-3.5 lg:pt-3.5 lg:pb-2">
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
                {normalizedStatus === 'CONFIRMED' && (
                  <Badge className="gap-1 bg-green-600/80 text-white text-[10px] py-0 px-1.5">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Confirmed
                  </Badge>
                )}
                {normalizedStatus === 'ACCEPTED' && (
                  <Badge className="gap-1 bg-blue-600/80 text-white text-[10px] py-0 px-1.5">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Pending
                  </Badge>
                )}
                {normalizedStatus === 'PENDING' && (
                  <Badge className="gap-1 bg-amber-600/80 text-white text-[10px] py-0 px-1.5">
                    <AlertCircle className="h-2.5 w-2.5" /> Awaiting
                  </Badge>
                )}
                {(normalizedStatus === 'DECLINED' || normalizedStatus === 'REJECTED') && (
                  <Badge className="gap-1 bg-red-600/80 text-white text-[10px] py-0 px-1.5">
                    <AlertCircle className="h-2.5 w-2.5" /> Rejected
                  </Badge>
                )}
              </div>
              {driverContactNumber && (
                <div className="mt-1.5 text-[11px] text-slate-300">
                  Contact: <a href={whatsappContactHref || '#'} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{driverContactNumber}</a>
                </div>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-primary">PKR {ridePrice}</div>
            <div className="text-[10px] text-slate-400">per seat</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-2.5 space-y-2 md:px-4 md:pb-2 md:space-y-1.5 lg:px-3.5 lg:pb-1.5">
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
          <div className="text-slate-300">{formatDate(safeGet(ride, 'departureTime') || safeGet(booking, 'departureTime') || safeGet(booking, 'ride.departureTime'), 'Unknown time')}</div>
        </div>

        {/* Departure timer for confirmed rides */}
        {normalizedStatus === 'CONFIRMED' && departureTimer && (
          <div className="text-xs">
            <span className="text-slate-400 font-medium">Time remaining:</span>
            <div className="text-blue-400 font-mono">{departureTimer}</div>
          </div>
        )}

        {seatsLeft !== null && (
          <div className="text-xs">
            <span className="text-slate-400 font-medium">Seats left:</span>
            <div className="text-emerald-300 font-semibold">{seatsLeft}</div>
          </div>
        )}

        {/* Status error */}
        {statusError && (
          <div className="text-xs bg-red-900/30 border border-red-700/50 text-red-200 p-2 rounded">
            {statusError}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pt-3 md:px-4 md:pb-4 md:pt-2.5 lg:px-3.5 lg:pb-3 lg:gap-1.5" onClick={(e) => e.stopPropagation()}>
        <Button
          onClick={() => setShowRoutePickup(true)}
          variant="outline"
          size="sm"
          className="w-full h-10 md:h-9 border-slate-600/80 bg-gradient-to-r from-slate-800/80 to-slate-700/60 hover:from-slate-700 hover:to-slate-600 text-slate-100 shadow-md"
        >
          View Route & Pickup
        </Button>
        <div className="w-full">
          <Button
            onClick={openInGoogleMaps}
            variant="outline"
            size="sm"
            className="w-full h-9 md:h-8.5 px-4 text-sm border-slate-600/80 bg-slate-800/70 hover:bg-slate-700/80 text-slate-200"
          >
            View on Maps
          </Button>
        </div>

        {/* ACCEPTED STATUS - Show Confirm button */}
        {normalizedStatus === 'ACCEPTED' && !isEffectivelyConfirmed && (
          <>
            <div className={`grid gap-2 w-full ${chatId ? 'grid-cols-2' : 'grid-cols-1'}`}>
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
            <Button
              onClick={() => setShowConfirmRideDialog(true)}
              disabled={confirming || isEffectivelyConfirmed || rideStatus !== 'available'}
              size="sm"
              className="w-full h-10 md:h-9 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20"
            >
              {confirming ? 'Confirming...' : 'Confirm Ride'}
            </Button>
            <p className="text-[11px] text-amber-300/90 text-center">
              Confirm your ride fast, otherwise seats may be booked by someone else.
            </p>
          </>
        )}

        {normalizedStatus === 'PENDING' && !confirmationProcessed && (
          <div className={`grid gap-2 w-full ${chatId ? 'grid-cols-2' : 'grid-cols-1'}`}>
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
        {isEffectivelyConfirmed && (
          <div className="w-full space-y-2">
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-green-600/20 border border-green-600/50 text-green-200 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Ride Confirmed!
            </div>
            <div className={`flex gap-2 ${chatId ? '' : 'w-full'}`}>
              {chatId && (
                <ChatButton chatId={chatId} university={university} label="Chat" className="flex-1 h-9 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 shadow-md shadow-blue-500/20" />
              )}
              <Button
                onClick={() => setShowCancelDialog(true)}
                disabled={cancelling}
                variant="destructive"
                size="sm"
                className={chatId ? 'flex-1' : 'w-full'}
              >
                {cancelling ? 'Cancelling...' : 'Cancel Ride'}
              </Button>
            </div>
          </div>
        )}

        {/* RIDE FULL - Show message */}
        {rideStatus === 'full' && !isEffectivelyConfirmed && (
          <div className="w-full text-center py-2 px-3 rounded-md bg-amber-600/20 border border-amber-600/50 text-amber-200 text-xs font-medium">
            All Seats Filled
          </div>
        )}

        {/* RIDE EXPIRED - Show message */}
        {rideStatus === 'expired' && !isEffectivelyConfirmed && (
          <div className="w-full text-center py-2 px-3 rounded-md bg-red-600/20 border border-red-600/50 text-red-200 text-xs font-medium">
            Ride Has Expired
          </div>
        )}

        {!(normalizedStatus === 'ACCEPTED' && !confirmationProcessed) && null}
      </CardFooter>

      <Dialog open={showConfirmRideDialog} onOpenChange={setShowConfirmRideDialog}>
        <DialogContent
          onClick={(e) => { e.stopPropagation(); }}
          onPointerDown={(e) => { e.stopPropagation(); }}
          className="max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Confirm this ride?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-slate-300">
            <p>Are you sure you want to confirm this ride seat now?</p>
            <p className="text-amber-300">Important: If you confirm and cancel later, it increases your cancellation rate and repeated late cancellations may lead to account restrictions.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConfirmRideDialog(false)}>Not now</Button>
            <Button
              onClick={() => {
                setShowConfirmRideDialog(false);
                void handleConfirmRide();
              }}
              disabled={confirming || isEffectivelyConfirmed || rideStatus !== 'available'}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {confirming ? 'Confirming...' : 'Yes, Confirm Ride'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRoutePickup} onOpenChange={setShowRoutePickup}>
        <DialogContent
          className="max-w-3xl"
          onClick={(e) => { e.stopPropagation(); }}
          onPointerDown={(e) => { e.stopPropagation(); }}
        >
          <DialogHeader>
            <DialogTitle>Route & Pickup</DialogTitle>
          </DialogHeader>

          {pickupLatLng && dropoffLatLng ? (
            <div className="h-[60vh] w-full rounded-lg overflow-hidden border border-slate-700">
              <MapContainer
                bounds={mapBounds || undefined}
                center={mapBounds ? undefined : ([pickupLatLng.lat, pickupLatLng.lng] as any)}
                zoom={mapBounds ? undefined : 13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                />
                {routePath.length > 0 && (
                  <Polyline positions={routePath as any} pathOptions={{ color: '#60A5FA', weight: 5, opacity: 0.9 }} />
                )}
                <Marker
                  position={[pickupLatLng.lat, pickupLatLng.lng] as any}
                  icon={getRoutePinIcon('pickup')}
                >
                  <Popup>{pickupPlaceName || 'Pickup location'}</Popup>
                </Marker>
                <Marker
                  position={[dropoffLatLng.lat, dropoffLatLng.lng] as any}
                  icon={getRoutePinIcon('end')}
                >
                  <Popup>{dropoffPlaceName || ride?.to || 'Dropoff location'}</Popup>
                </Marker>
              </MapContainer>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-slate-400">Route data unavailable</div>
          )}
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
        minutesUntilDeparture={departureTimer ? parseInt(departureTimer.split(':')[0] || '0') : 0}
        showRateWarning={cancellationRate > 30}
          isBookingConfirmed={normalizedStatus === 'CONFIRMED'}
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
  const { getUnreadForRide, markRideAsRead } = useNotifications();
  const firestore = useFirestore();
  const [retryKey, setRetryKey] = React.useState(0);
  const [pageError, setPageError] = React.useState<string | null>(null);
  const [requestBookings, setRequestBookings] = React.useState<BookingType[]>([]);
  const [requestBackfillLoading, setRequestBackfillLoading] = React.useState(false);
  const [requestBackfillInitialized, setRequestBackfillInitialized] = React.useState(false);
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const normalizedUniversity = React.useMemo(
    () => String(userData?.university || '').trim().toLowerCase(),
    [userData?.university]
  );

  // Safety checks
  const hasRequiredData = user?.uid && firestore && normalizedUniversity;

  const bookingsQuery = hasRequiredData ? query(
    collection(firestore, 'universities', normalizedUniversity, 'bookings'),
    where('passengerId', '==', user.uid),
    orderBy('createdAt', 'desc'),
    limit(100) // ── PERF: Limit to last 100 bookings ──
  ) : null;

  const { data: bookingsData, loading, error: queryError } = useCollection<BookingType>(
    bookingsQuery,
    { listen: true, includeUserDetails: 'driverId' }
  );

  React.useEffect(() => {
    let cancelled = false;

    const fetchRequestBackfill = async () => {
      setRequestBackfillLoading(true);
      setRequestBackfillInitialized(false);

      if (!firestore || !user?.uid || !normalizedUniversity) {
        if (!cancelled) {
          setRequestBookings([]);
          setRequestBackfillLoading(false);
          setRequestBackfillInitialized(true);
        }
        return;
      }

      try {
        const idToken = await user.getIdToken(true);
        const response = await fetch(
          `/api/bookings/request-backfill?university=${encodeURIComponent(normalizedUniversity)}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          }
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || 'Failed to load accepted requests');
        }

        const mapped = Array.isArray(payload?.bookings)
          ? payload.bookings as BookingType[]
          : [];

        if (!cancelled) {
          setRequestBookings(mapped);
        }
      } catch (error: any) {
        console.warn('[MyBookings] Request backfill failed:', error);
        if (!cancelled) setRequestBookings([]);
      } finally {
        if (!cancelled) {
          setRequestBackfillLoading(false);
          setRequestBackfillInitialized(true);
        }
      }
    };

    fetchRequestBackfill();

    return () => {
      cancelled = true;
    };
  }, [firestore, user?.uid, normalizedUniversity, retryKey]);

  // Safe bookings array
  const allBookings = toArray(bookingsData).filter((b) => b && b.id);
  
  const bookings = React.useMemo(() => {
    const merged = [...allBookings, ...requestBookings];
    const seen = new Set<string>();
    return merged.filter((item) => {
      if (!item?.id) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [allBookings, requestBookings]);

  // Debug logs
  React.useEffect(() => {
    console.log('[MyBookings] Debug Info:', {
      allBookings: allBookings.length,
      requestBookings: requestBookings.length,
      totalBookings: bookings.length,
      hasRequiredData,
      normalizedUniversity,
      bookingsLoading: loading,
      requestBackfillLoading,
      bookingsDataSample: allBookings[0] ? { id: allBookings[0].id, status: allBookings[0].status } : null,
      requestBookingsSample: requestBookings[0] ? { id: requestBookings[0].id, status: requestBookings[0].status } : null,
    });
  }, [allBookings, requestBookings, bookings, hasRequiredData, normalizedUniversity, loading, requestBackfillLoading]);

  const visibleBookings = bookings.filter((booking) => {
    const normalizedStatus = String(booking?.status || '').trim().toUpperCase();
    if (HIDDEN_BOOKING_STATUSES.has(normalizedStatus)) {
      return false;
    }
    if (!ACTIVE_BOOKING_STATUSES.has(normalizedStatus)) {
      return false;
    }

    const bookingRide = safeGet(booking, 'ride');
    const departureData =
      safeGet(bookingRide, 'departureTime') ||
      safeGet(booking, 'ride.departureTime') ||
      safeGet(booking, 'departureTime');
    const departureMs = parseTimestampToMs(departureData, { silent: true });

    if (departureMs === null) return true;

    const fourHoursInMs = 4 * 60 * 60 * 1000;
    return nowMs - departureMs <= fourHoursInMs;
  });

  const getRecencyMs = React.useCallback((booking: any) => {
    const bookingUpdated = parseTimestampToMs(booking?.updatedAt, { silent: true });
    const bookingCreated = parseTimestampToMs(booking?.createdAt, { silent: true });
    const rideUpdated = parseTimestampToMs(booking?.ride?.updatedAt, { silent: true });
    const rideCreated = parseTimestampToMs(booking?.ride?.createdAt, { silent: true });
    const departure = parseTimestampToMs(booking?.ride?.departureTime, { silent: true });
    return bookingUpdated ?? bookingCreated ?? rideUpdated ?? rideCreated ?? departure ?? 0;
  }, []);

  const sortedVisibleBookings = React.useMemo(() => {
    return [...visibleBookings].sort((a: any, b: any) => {
      const aRideId = String(a?.rideId || a?.ride?.id || '');
      const bRideId = String(b?.rideId || b?.ride?.id || '');
      const unreadDelta = (getUnreadForRide(bRideId) || 0) - (getUnreadForRide(aRideId) || 0);
      if (unreadDelta !== 0) return unreadDelta;
      return getRecencyMs(b) - getRecencyMs(a);
    });
  }, [visibleBookings, getUnreadForRide, getRecencyMs]);

  React.useEffect(() => {
    if (!sortedVisibleBookings.length) return;
    sortedVisibleBookings.forEach((booking: any) => {
      const rideId = String(booking?.rideId || booking?.ride?.id || '');
      if (!rideId) return;
      if (getUnreadForRide(rideId) > 0) {
        void markRideAsRead(rideId).catch(() => {});
      }
    });
  }, [sortedVisibleBookings, getUnreadForRide, markRideAsRead]);
  
  const policyCancellationRate = Number((userData as any)?.passengerCancellationPolicy?.cancellationRate);
  const totalParticipations = Number((userData as any)?.totalParticipations || 0);
  const totalCancellations = Number((userData as any)?.totalCancellations || 0);
  const fallbackCancellationRate = totalParticipations > 0
    ? Math.round((totalCancellations / totalParticipations) * 100)
    : 0;
  const cancellationRate = Number.isFinite(policyCancellationRate)
    ? policyCancellationRate
    : fallbackCancellationRate;

  const waitingForUniversityResolution = !!user?.uid && !userLoading && !normalizedUniversity;
  const waitingForBackfillBeforeEmpty =
    !!user?.uid && !!normalizedUniversity && allBookings.length === 0 && !requestBackfillInitialized;
  const isLoading = userLoading || waitingForUniversityResolution || loading || waitingForBackfillBeforeEmpty;
  const hasError = !!queryError || !!pageError;
  const errorMessage = queryError?.message || pageError;

  React.useEffect(() => {
    if (queryError) {
      console.debug('[MyBookings] Query error:', queryError);
      setPageError(queryError.message);
    }
  }, [queryError]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

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
  if (!visibleBookings || visibleBookings.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
          <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="section-shell py-8 relative z-10">
          <EmptyState
            title="No Active Bookings"
            description="No bookings found. Browse available rides and make a booking."
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
          <p className="text-slate-300">View and manage your ride bookings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
          {sortedVisibleBookings.map((booking) => (
            <BookingCard
              key={`${booking.id}-${retryKey}`}
              booking={booking}
              university={normalizedUniversity}
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
              <DialogContent
                className="max-w-3xl"
                onClick={(e) => { e.stopPropagation(); }}
                onPointerDown={(e) => { e.stopPropagation(); }}
              >
                <DialogHeader>
                  <DialogTitle>Route from {ride?.from} to {ride?.to}</DialogTitle>
                </DialogHeader>
                <div className="h-[60vh] w-full rounded-lg overflow-hidden border border-slate-700">
                  {ride?.route && ride.route.length ? (
                    <LazyMapLeaflet 
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

