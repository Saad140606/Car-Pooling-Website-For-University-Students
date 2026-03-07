'use client';

import { collection, query, where, orderBy, limit, doc, writeBatch, runTransaction, getDocs, getDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import { Check, MapPin, X, Trash, CheckCircle2, Clock } from 'lucide-react';
import { useCollection as useBookingCollection } from '@/firebase/firestore/use-collection';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import L, { LatLngExpression } from 'leaflet';
import { Ride as RideType, Booking as BookingType } from '@/lib/types';
import { decodePolyline } from '@/lib/route';
import { formatTimestamp, parseTimestampToMs } from '@/lib/timestampUtils';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from '@/components/map';
import { getRoutePinIcon } from '@/lib/mapPinIcons';
import ChatButton from '@/components/chat/ChatButton';
import NotificationBadge from '@/components/NotificationBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { useNotifications } from '@/contexts/NotificationContext';
import { InlineVerifiedBadge } from '@/components/VerificationBadge';
import { UserNameWithBadge } from '@/components/UserNameWithBadge';
import { isUserVerified } from '@/lib/verificationUtils';
import { CancellationConfirmDialog } from '@/components/CancellationConfirmDialog';
import PassengerDetailModal from '@/components/PassengerDetailModal';
import { RideDetailDialog } from './RideDetailDialog';
import React from 'react';
import { trackEvent } from '@/lib/ga';
import { getRoleCancellationRate } from '@/lib/roleCancellationRate';

// Small helper: truncate string to n characters with ellipsis
function truncateChars(s?: string | null, n = 30) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '...' : s;
}

function getPassengerPhone(passengerDetails: any): string | null {
  if (!passengerDetails) return null;
  return passengerDetails.contactNumber || passengerDetails.phone || null;
}

function formatPickupLabel(booking: { id?: string; pickupPlaceName?: string | null; pickupPoint?: { lat: number; lng: number } | null }, fetchedNames?: Record<string, string>) {
  // First check if we have a place name
  if (booking?.pickupPlaceName) return truncateChars(booking.pickupPlaceName, 45);
  
  // Then check if we fetched one
  if (booking?.id && fetchedNames?.[booking.id]) return truncateChars(fetchedNames[booking.id], 45);
  
  // Fall back to coordinates if available
  if (booking?.pickupPoint) {
    const { lat, lng } = booking.pickupPoint;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
  return 'Pickup not set';
}

function isValidFirestoreInstance(value: any): boolean {
  return Boolean(value && typeof value === 'object' && '_databaseId' in value);
}

function BookingRequests({ ride, university, onProcessed }: { ride: RideType, university: string, onProcessed?: (bookingId: string, status: 'accepted' | 'rejected') => void }) {
  const firestore = useFirestore();
  const { user, data: userData } = useUser();
  const { toast } = useToast();
  const actionFeedback = useActionFeedback();
  const [selectedRequest, setSelectedRequest] = React.useState<any | null>(null);
  const [showRequestDetail, setShowRequestDetail] = React.useState(false);
  const [showRequestRoute, setShowRequestRoute] = React.useState(false);

  console.log('[BookingRequests] Component mounted with ride:', { 
    rideId: ride?.id, 
    university, 
    rideFull: ride 
  });

  // Read requests from the ride-scoped `requests` subcollection so ride owners
  // can safely list only requests for their ride (rules allow listing here).
  // CRITICAL: Only create query if ride.id is defined to prevent invalid collection paths
  // listen: true (default) enables real-time updates via onSnapshot
  const bookingsQuery = (isValidFirestoreInstance(firestore) && ride?.id) ? query(
    collection(firestore, `universities/${university}/rides/${ride.id}/requests`),
    where('status', 'in', ['PENDING', 'pending'])
  ) : null;

  const { data: bookings, loading } = useBookingCollection<BookingType>(bookingsQuery, { includeUserDetails: 'passengerId', listen: true });
  
  const [processingIds, setProcessingIds] = React.useState<string[]>([]);
  const [processingStateById, setProcessingStateById] = React.useState<Record<string, 'accepting' | 'rejecting'>>({});
  const [shownBookings, setShownBookings] = React.useState<BookingType[]>([]);
  const [placeNames, setPlaceNames] = React.useState<Record<string, string>>({});
  const fetchingPlaceNameIdsRef = React.useRef<Set<string>>(new Set());
  const hasDeparturePassed = React.useMemo(() => {
    const departureMs = parseTimestampToMs(ride?.departureTime, { silent: true });
    return departureMs !== null && Date.now() >= departureMs;
  }, [ride?.departureTime]);

  // Keep local shown list in sync with upstream bookings, but allow optimistic
  // removal immediately after an accept/reject so the UI does not permit
  // duplicate accepts while waiting for Firestore listeners to update.
  // Keep one pending card per passenger for faster, simpler request queues.
  React.useEffect(() => {
    if (!bookings) return setShownBookings([]);
    const seenPassengerIds = new Set<string>();
    const filteredBookings = bookings.filter((booking) => {
      const passengerId = booking.passengerId;
      if (!passengerId) return true;
      if (seenPassengerIds.has(passengerId)) return false;
      seenPassengerIds.add(passengerId);
      return true;
    });
    setShownBookings(filteredBookings);
  }, [bookings]);
  
  // Fetch place names for bookings that have coordinates but no place name
  React.useEffect(() => {
    if (!bookings) return;

    bookings.forEach((booking) => {
      if (!booking.id || booking.pickupPlaceName || !booking.pickupPoint || placeNames[booking.id]) {
        return;
      }

      if (fetchingPlaceNameIdsRef.current.has(booking.id)) {
        return;
      }
      fetchingPlaceNameIdsRef.current.add(booking.id);

      void (async () => {
        try {
          const res = await fetch(`/api/nominatim/reverse?lat=${booking.pickupPoint!.lat}&lon=${booking.pickupPoint!.lng}`);
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
              setPlaceNames(prev => ({ ...prev, [booking.id]: data.display_name }));
            }
          }
        } catch (e) {
          console.debug('Failed to fetch place name:', e);
        } finally {
          fetchingPlaceNameIdsRef.current.delete(booking.id);
        }
      })();
    });
  }, [bookings, placeNames]);

  const handleBooking = async (booking: BookingType, newStatus: 'accepted' | 'rejected') => {
    const actionStartMs = performance.now();
    console.log('[handleBooking] Starting with:', { 
      bookingId: booking?.id, 
      status: newStatus, 
      user: user?.uid,
      booking_rideId: booking?.rideId,
      component_ride_id: ride?.id,
      booking_full: booking
    });
    
    if (!isValidFirestoreInstance(firestore)) {
      console.error('[handleBooking] Firestore not available');
      return;
    }
    if (!booking?.id) {
      console.error('[handleBooking] No booking ID');
      return;
    }

    if (hasDeparturePassed) {
      toast({
        variant: 'destructive',
        title: 'Ride already departed',
        description: 'You can not accept or reject any passenger after passing departure time.',
      });
      return;
    }

    // Prevent duplicate clicks
    if (processingIds.includes(booking.id)) {
      console.log('[handleBooking] Already processing this booking');
      return;
    }
    
    setProcessingIds((s) => [...s, booking.id]);
    setProcessingStateById((prev) => ({
      ...prev,
      [booking.id as string]: newStatus === 'accepted' ? 'accepting' : 'rejecting',
    }));
    actionFeedback.start(
      newStatus === 'accepted'
        ? 'Accepting request, please wait…'
        : 'Rejecting request, please wait…',
      newStatus === 'accepted' ? 'Accepting Request...' : 'Rejecting Request...'
    );
    // Optimistically remove the booking from the shown list so the provider
    // sees immediate feedback and cannot accept/reject the same request twice.
    const previousShown = shownBookings;
    setShownBookings((s) => s.filter((b) => b.id !== booking.id));

    try {
      // Use API transaction path for strict idempotency and race-safe acceptance.
      if (newStatus === 'accepted') {
        console.log('[handleBooking] Processing acceptance via API...');
        
        const rideId = ride.id || booking.rideId;
        if (!rideId) {
          throw new Error('Ride ID not found');
        }
        const idToken = await user?.getIdToken(true);
        if (!idToken) {
          throw new Error('Authentication token unavailable. Please sign in again.');
        }

        const res = await fetch('/api/requests/accept', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            university,
            rideId,
            requestId: booking.id,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || data?.message || 'Failed to accept request');
        }

        console.log('[handleBooking] Acceptance processed successfully via API');
      } else {
        // For rejects: use direct Firestore update
        console.log('[handleBooking] Processing rejection...');
        
        const rideId = ride.id || booking.rideId;
        if (!rideId) {
          throw new Error('Ride ID not found');
        }
        
        const idToken = await user?.getIdToken(true);
        if (!idToken) {
          throw new Error('Authentication token unavailable. Please sign in again.');
        }

        const res = await fetch('/api/requests/reject', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            university,
            rideId,
            requestId: booking.id,
            reason: 'Driver rejected request'
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || data?.message || `Reject API failed: ${res.status}`);
        }
        
        console.log('[handleBooking] Rejection processed via API');
      }

      onProcessed?.(booking.id, newStatus);

      // After transaction succeeded, if this was a reject attempt, try to delete any chat (best-effort).
      if (newStatus === 'rejected') {
        try {
          await deleteDoc(doc(firestore, `universities/${university}/chats`, booking.id));
        } catch (e) {
          console.debug('Could not delete chat after reject (may not exist or insufficient permissions)', e);
        }
      }

      toast({
        title: `Booking ${newStatus}`,
        description: `The request has been ${newStatus}.`
      });
      trackEvent('ride_acceptance', {
        event_action: newStatus === 'accepted' ? 'driver_accepted' : 'driver_rejected',
        ride_id: ride.id || booking.rideId,
        booking_id: booking.id,
      });

    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : (typeof error === 'object' && error && 'message' in (error as any) && (error as any).message)
            ? String((error as any).message)
            : (() => {
                try {
                  return JSON.stringify(error);
                } catch {
                  return String(error);
                }
              })();

      console.error('[handleBooking] Error:', errorMessage);
      console.error('[handleBooking] Error details:', {
        message: errorMessage,
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined,
        bookingId: booking.id,
        status: newStatus,
      });
      
      // Roll back optimistic UI change so the provider can retry or see the request again
      setShownBookings(previousShown);
      
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage || 'Something went wrong. Please try again.'
      });
    } finally {
      console.log('[handleBooking][perf] action=', newStatus, 'bookingId=', booking.id, 'total_ms=', Math.round(performance.now() - actionStartMs));
      actionFeedback.clear();
      setProcessingIds((s) => s.filter((id) => id !== booking.id));
      setProcessingStateById((prev) => {
        const next = { ...prev };
        delete next[booking.id as string];
        return next;
      });
    }
  };

  if (loading) return <div className="space-y-2 mt-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>;
  if (!bookings || bookings.length === 0) return <p className="text-slate-400 text-sm mt-4">No pending requests.</p>

  return (
    <>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Booking Requests
            <Badge className="bg-amber-500/20 text-amber-300 text-xs">{shownBookings.length}</Badge>
          </h4>
        </div>

        {hasDeparturePassed && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-200">
            You can not accept or reject any passenger after passing departure time.
          </div>
        )}

        {shownBookings.map((booking: any) => (
          <div 
            key={booking.id} 
            onClick={() => {
              setSelectedRequest(booking);
              setShowRequestDetail(true);
            }}
            className="group relative flex items-center justify-between p-4 bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-slate-900/60 backdrop-blur-sm rounded-xl border border-slate-700/50 hover:border-amber-500/50 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5"
          >
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
            
            <div className="relative z-10 flex-1 min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/20 flex items-center justify-center font-semibold text-xs text-amber-300 flex-shrink-0">
                  {(booking.passengerDetails?.fullName || 'U').split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <UserNameWithBadge 
                  name={booking.passengerDetails?.fullName || 'User'} 
                  verified={isUserVerified(booking.passengerDetails)}
                  size="md"
                  truncate={false}
                />
              </div>
              <div className="flex items-start gap-2 mt-2">
                <MapPin className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200/90 font-medium line-clamp-2">
                  {formatPickupLabel(booking, placeNames)}
                </p>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 ml-6">Click to view full details</p>
            </div>
            
            <div className="relative z-10 flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
              <Button 
                size="icon" 
                variant="outline" 
                className="h-9 w-9 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:text-green-300 border-green-500/30 hover:border-green-500/50 transition-all duration-300 hover:scale-110" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleBooking(booking, 'accepted');
                }} 
                disabled={hasDeparturePassed || processingIds.includes(booking.id) || (booking.status !== 'PENDING' && booking.status !== 'pending')}
                title={hasDeparturePassed ? 'You can not accept or reject any passenger after passing departure time.' : 'Accept request'}
              >
                <Check className="h-5 w-5" />
              </Button>
              <Button 
                size="icon" 
                variant="outline" 
                className="h-9 w-9 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border-red-500/30 hover:border-red-500/50 transition-all duration-300 hover:scale-110" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleBooking(booking, 'rejected');
                }} 
                disabled={hasDeparturePassed || processingIds.includes(booking.id) || (booking.status !== 'PENDING' && booking.status !== 'pending')}
                title={hasDeparturePassed ? 'You can not accept or reject any passenger after passing departure time.' : 'Reject request'}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {processingIds.includes(booking.id) && (
              <p className="absolute bottom-2 right-4 text-[11px] text-amber-300">
                {processingStateById[booking.id] === 'accepting'
                  ? 'Please wait, request is accepting...'
                  : 'Please wait, request is rejecting...'}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Passenger Request Detail Modal */}
      {selectedRequest && (
        <Dialog open={showRequestDetail} onOpenChange={setShowRequestDetail}>
          <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white text-lg flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Request Details
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Review booking request details for this passenger
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              {/* Passenger Info */}
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <h3 className="text-xs text-slate-400 mb-2">PASSENGER</h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/20 flex items-center justify-center font-semibold text-sm text-amber-300">
                    {(selectedRequest.passengerDetails?.fullName || 'U').split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div>
                    <UserNameWithBadge 
                      name={selectedRequest.passengerDetails?.fullName || 'User'} 
                      verified={isUserVerified(selectedRequest.passengerDetails)}
                      size="lg"
                    />
                    {selectedRequest.passengerDetails?.gender && (
                      <p className="text-xs text-slate-400 mt-1">{selectedRequest.passengerDetails.gender}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Pickup Location */}
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <h3 className="text-xs text-slate-400 mb-2">PICKUP LOCATION</h3>
                <div className="flex items-start gap-2">
                  <MapPin className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-200/90 font-medium break-words">
                    {selectedRequest.pickupPlaceName || placeNames?.[selectedRequest.id] || 'Pickup not set'}
                  </p>
                </div>
              </div>

              {/* Ride Details */}
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <h3 className="text-xs text-slate-400 mb-3">RIDE DETAILS</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price:</span>
                    <span className="font-semibold text-primary">PKR {ride.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Date & Time:</span>
                    <span className="text-slate-300">{formatTimestamp(ride.departureTime, { format: 'short' })}</span>
                  </div>
                </div>
              </div>

              {/* Contact Info - Only shown after acceptance */}
              {(() => {
                const reqStatus = String(selectedRequest.status || '').toUpperCase();
                const isAcceptedRequest = reqStatus === 'ACCEPTED' || reqStatus === 'CONFIRMED';
                const passengerPhone = getPassengerPhone(selectedRequest.passengerDetails);

                if (isAcceptedRequest && passengerPhone) {
                  return (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <p className="text-xs text-green-200/90">Passenger Number: {passengerPhone}</p>
                    </div>
                  );
                }

                return (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-xs text-amber-200/80 flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">ℹ️</span>
                      Contact information will be available after accepting the request.
                    </p>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <Button
                onClick={() => setShowRequestRoute(true)}
                variant="outline"
                className="w-full border-slate-600/70 bg-slate-800/60 hover:bg-slate-700/70 text-slate-100"
              >
                <MapPin className="h-4 w-4 mr-2" />
                View Route & Pickup
              </Button>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => {
                    handleBooking(selectedRequest, 'accepted');
                    setShowRequestDetail(false);
                  }}
                  disabled={hasDeparturePassed || processingIds.includes(selectedRequest.id)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {processingIds.includes(selectedRequest.id) && processingStateById[selectedRequest.id] === 'accepting'
                    ? 'Accepting...'
                    : 'Accept Request'}
                </Button>
                <Button
                  onClick={() => {
                    handleBooking(selectedRequest, 'rejected');
                    setShowRequestDetail(false);
                  }}
                  disabled={hasDeparturePassed || processingIds.includes(selectedRequest.id)}
                  variant="outline"
                  className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <X className="h-4 w-4 mr-2" />
                  {processingIds.includes(selectedRequest.id) && processingStateById[selectedRequest.id] === 'rejecting'
                    ? 'Rejecting...'
                    : 'Reject'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedRequest && (
        <Dialog open={showRequestRoute} onOpenChange={setShowRequestRoute}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Passenger Route Preview</DialogTitle>
              <DialogDescription>
                Route preview with only this passenger {String(ride.from || '').toLowerCase().includes('university') ? 'dropoff' : 'pickup'}.
              </DialogDescription>
            </DialogHeader>

            <div className="h-[60vh] w-full rounded-lg overflow-hidden border border-slate-700">
              {(() => {
                const routePoints = (() => {
                  if (ride.routePolyline && typeof ride.routePolyline === 'string') return decodePolyline(ride.routePolyline);
                  if (Array.isArray(ride.route)) {
                    return (ride.route as any[])
                      .map((p) => {
                        if (Array.isArray(p) && p.length >= 2) return { lat: Number(p[0]), lng: Number(p[1]) };
                        if (p && typeof p.lat === 'number' && typeof p.lng === 'number') return { lat: p.lat, lng: p.lng };
                        return null;
                      })
                      .filter(Boolean) as Array<{ lat: number; lng: number }>;
                  }
                  return [] as Array<{ lat: number; lng: number }>;
                })();

                const pickupPoint = (() => {
                  const pt = selectedRequest?.pickupPoint;
                  if (pt && typeof pt.lat === 'number' && typeof pt.lng === 'number') return { lat: pt.lat, lng: pt.lng };
                  if (Array.isArray(pt) && pt.length >= 2) {
                    const lat = Number(pt[0]);
                    const lng = Number(pt[1]);
                    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
                  }
                  return null;
                })();

                const routePath = routePoints.map((point) => [point.lat, point.lng] as [number, number]);
                const startPoint = routePoints[0] || null;
                const endPoint = routePoints.length > 1 ? routePoints[routePoints.length - 1] : null;
                const passengerName =
                  selectedRequest?.passengerDetails?.fullName ||
                  selectedRequest?.passengerName ||
                  'Passenger';
                const isFromUniversity = String(ride.from || '').toLowerCase().includes('university');
                const passengerLabel = `${passengerName} ${isFromUniversity ? 'Dropoff' : 'Pickup'}`;

                const boundsPoints: Array<{ lat: number; lng: number }> = [];
                routePoints.forEach((point) => boundsPoints.push(point));
                if (pickupPoint) boundsPoints.push(pickupPoint);
                const bounds = boundsPoints.length >= 2
                  ? L.latLngBounds(boundsPoints.map((point) => [point.lat, point.lng]))
                  : null;

                if (!routePoints.length && !pickupPoint) {
                  return <div className="h-full flex items-center justify-center text-sm text-slate-400">No route available</div>;
                }

                return (
                  <MapContainer
                    bounds={bounds || undefined}
                    center={bounds ? undefined : (pickupPoint ? ([pickupPoint.lat, pickupPoint.lng] as any) : (startPoint ? ([startPoint.lat, startPoint.lng] as any) : undefined))}
                    zoom={bounds ? undefined : 13}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap contributors'
                    />
                    {routePath.length > 0 && (
                      <Polyline positions={routePath as any} pathOptions={{ color: '#60A5FA', weight: 5, opacity: 0.9 }} />
                    )}
                    {startPoint && (
                      <Marker position={[startPoint.lat, startPoint.lng] as any} icon={getRoutePinIcon('start')}>
                        <Popup>Start</Popup>
                      </Marker>
                    )}
                    {endPoint && (
                      <Marker position={[endPoint.lat, endPoint.lng] as any} icon={getRoutePinIcon('end')}>
                        <Popup>Destination</Popup>
                      </Marker>
                    )}
                    {pickupPoint && (
                      <Marker position={[pickupPoint.lat, pickupPoint.lng] as any} icon={getRoutePinIcon('pickup')}>
                        <Popup>{passengerLabel}</Popup>
                      </Marker>
                    )}
                  </MapContainer>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function MyRideCard({ ride, university } : { ride: RideType, university: string }) {
    const firestore = useFirestore();
    const { user, data: userData } = useUser();
  const { getUnreadForRide, markRideAsRead } = useNotifications();

    const acceptedBookingsQuery = (isValidFirestoreInstance(firestore) && ride?.id) ? query(
        collection(firestore, `universities/${university}/bookings`),
        where('rideId', '==', ride.id),
      where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED', 'confirmed'])
    ) : null;
    const { data: acceptedBookings } = useBookingCollection<BookingType>(acceptedBookingsQuery);

    const acceptedRequestsQuery = (isValidFirestoreInstance(firestore) && ride?.id) ? query(
      collection(firestore, `universities/${university}/rides/${ride.id}/requests`),
      where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED', 'confirmed'])
    ) : null;
    const { data: acceptedRequests } = useBookingCollection<any>(acceptedRequestsQuery);

    const acceptedParticipants = React.useMemo(() => {
      const merged: any[] = [];
      const seenPassengerIds = new Set<string>();

      (acceptedBookings || []).forEach((item: any) => {
        const passengerId = String(item?.passengerId || '');
        if (passengerId && seenPassengerIds.has(passengerId)) return;
        if (passengerId) seenPassengerIds.add(passengerId);
        merged.push(item);
      });

      (acceptedRequests || []).forEach((item: any) => {
        const passengerId = String(item?.passengerId || '');
        if (passengerId && seenPassengerIds.has(passengerId)) return;
        if (passengerId) seenPassengerIds.add(passengerId);
        merged.push({
          ...item,
          id: item?.id || `${ride.id}_${passengerId || Math.random()}`,
          ride: item?.ride || ride,
          passengerDetails: item?.passengerDetails || item?.passenger || null,
        });
      });

      return merged;
    }, [acceptedBookings, acceptedRequests, ride]);

    const pendingRequestsQuery = (isValidFirestoreInstance(firestore) && ride?.id) ? query(
      collection(firestore, `universities/${university}/rides/${ride.id}/requests`),
      where('status', 'in', ['PENDING', 'pending'])
    ) : null;
    const { data: pendingRequests } = useBookingCollection<BookingType>(pendingRequestsQuery);

    const isFromUniversityRide = React.useMemo(() => {
      const fromStr = String(ride.from || '').toLowerCase();
      return fromStr.includes('university') || fromStr.includes('campus') || fromStr.includes('uni');
    }, [ride.from]);

    // Keep a legacy alias to avoid runtime issues in any JSX paths still referencing this name.
    const isFromUniversity = isFromUniversityRide;

    const pickupMarkers = React.useMemo(() => {
      const toPoint = (pickupPoint: any): { lat: number; lng: number } | null => {
        if (pickupPoint && typeof pickupPoint.lat === 'number' && typeof pickupPoint.lng === 'number') {
          return { lat: Number(pickupPoint.lat), lng: Number(pickupPoint.lng) };
        }
        if (Array.isArray(pickupPoint) && pickupPoint.length >= 2) {
          const lat = Number(pickupPoint[0]);
          const lng = Number(pickupPoint[1]);
          if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
            return { lat, lng };
          }
        }
        return null;
      };

      const allParticipants = [
        ...((acceptedParticipants || []) as any[]),
        ...((pendingRequests || []) as any[]),
      ];

      return allParticipants
        .map((participant: any) => {
          const point = toPoint(participant?.pickupPoint);
          if (!point) return null;

          const name =
            participant?.passengerDetails?.fullName ||
            participant?.passengerDetails?.name ||
            participant?.passengerName ||
            'Passenger';

          return {
            lat: point.lat,
            lng: point.lng,
            label: `${name} ${isFromUniversityRide ? 'Dropoff' : 'Pickup'}`,
          };
        })
        .filter(Boolean) as Array<{ lat: number; lng: number; label: string }>;
    }, [acceptedParticipants, pendingRequests, isFromUniversityRide]);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [isCancelling, setIsCancelling] = React.useState(false);
    const [showCancelDialog, setShowCancelDialog] = React.useState(false);
    const [selectedPassenger, setSelectedPassenger] = React.useState<any | null>(null);
    const [showPassengerDetail, setShowPassengerDetail] = React.useState(false);
    const [showRideDetail, setShowRideDetail] = React.useState(false);
    const acceptedCount = acceptedParticipants?.length || 0;
    const confirmedBookings = React.useMemo(
      () => (acceptedParticipants || []).filter((b: any) => String(b.status || '').toUpperCase() === 'CONFIRMED'),
      [acceptedParticipants]
    );
    const pendingAcceptedBookings = React.useMemo(
      () => (acceptedParticipants || []).filter((b: any) => String(b.status || '').toUpperCase() === 'ACCEPTED'),
      [acceptedParticipants]
    );
    const [resolvedPickupNames, setResolvedPickupNames] = React.useState<Record<string, string>>({});
    const resolvingPickupIdsRef = React.useRef<Set<string>>(new Set());
    const rideConfirmedCount = Array.isArray((ride as any)?.confirmedPassengers)
      ? (ride as any).confirmedPassengers.length
      : 0;
    const [availableSeats, setAvailableSeats] = React.useState<number>(ride.availableSeats ?? 0);
    const [departureTimer, setDepartureTimer] = React.useState<string>('');
    const driverCancellationRate = React.useMemo(
      () => getRoleCancellationRate(userData, 'driver'),
      [userData]
    );

    React.useEffect(() => {
      setAvailableSeats(ride.availableSeats ?? 0);
    }, [ride.availableSeats]);

    React.useEffect(() => {
      const updateTimer = () => {
        const departureMs = parseTimestampToMs(ride?.departureTime, { silent: true });
        if (departureMs === null) {
          setDepartureTimer('Time unavailable');
          return;
        }

        const diff = departureMs - Date.now();
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
      const timer = setInterval(updateTimer, 1000);
      return () => clearInterval(timer);
    }, [ride?.departureTime]);

    React.useEffect(() => {
      if (!ride?.id) return;
      if (getUnreadForRide(ride.id) > 0) {
        void markRideAsRead(ride.id).catch(() => {});
      }
    }, [ride?.id, getUnreadForRide, markRideAsRead]);

    React.useEffect(() => {
      const toPoint = (pickupPoint: any): { lat: number; lng: number } | null => {
        if (pickupPoint && typeof pickupPoint.lat === 'number' && typeof pickupPoint.lng === 'number') {
          return { lat: pickupPoint.lat, lng: pickupPoint.lng };
        }
        if (Array.isArray(pickupPoint) && pickupPoint.length >= 2) {
          const lat = Number(pickupPoint[0]);
          const lng = Number(pickupPoint[1]);
          if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
            return { lat, lng };
          }
        }
        return null;
      };

      const candidates = (acceptedParticipants || [])
        .map((item: any) => ({ item, point: toPoint(item?.pickupPoint) }))
        .filter(({ item, point }) => {
          const hasValidId = !!item?.id;
          const hasName = !!item?.pickupPlaceName;
          const alreadyResolved = hasValidId ? !!resolvedPickupNames[item.id] : false;
          const inProgress = hasValidId ? resolvingPickupIdsRef.current.has(item.id) : false;
          return hasValidId && !!point && !hasName && !alreadyResolved && !inProgress;
        });

      if (!candidates.length) return;

      candidates.forEach(async ({ item, point }) => {
        const id = item.id as string;
        resolvingPickupIdsRef.current.add(id);

        try {
          const res = await fetch(`/api/nominatim/reverse?lat=${encodeURIComponent(point!.lat)}&lon=${encodeURIComponent(point!.lng)}`);
          if (!res.ok) return;
          const data = await res.json();
          const name = data?.display_name;
          if (typeof name === 'string' && name.trim()) {
            setResolvedPickupNames((prev) => ({ ...prev, [id]: name.trim() }));
          }
        } catch (error) {
          console.debug('[MyRides] Failed to resolve pickup place name:', error);
        } finally {
          resolvingPickupIdsRef.current.delete(id);
        }
      });
    }, [acceptedParticipants, resolvedPickupNames]);

    const { toast } = useToast();
    const openRideInGoogleMaps = React.useCallback(() => {
      const routeArray = Array.isArray(ride.route) ? (ride.route as any[]) : [];
      const firstPoint = routeArray.find((point: any) => point && typeof point.lat === 'number' && typeof point.lng === 'number');
      const lastPoint = [...routeArray].reverse().find((point: any) => point && typeof point.lat === 'number' && typeof point.lng === 'number');

      const origin = firstPoint ? `${firstPoint.lat},${firstPoint.lng}` : String(ride.from || '').trim();
      const destination = lastPoint ? `${lastPoint.lat},${lastPoint.lng}` : String(ride.to || '').trim();

      if (!origin && !destination) {
        toast({
          variant: 'destructive',
          title: 'Location unavailable',
          description: 'No route locations found for this ride.'
        });
        return;
      }

      const params = new URLSearchParams({ api: '1' });
      if (origin) params.set('origin', origin);
      if (destination) params.set('destination', destination);
      params.set('travelmode', 'driving');

      const mapsUrl = `https://www.google.com/maps/dir/?${params.toString()}`;
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    }, [ride.route, ride.from, ride.to, toast]);
    const handleDeleteRide = async () => {
      // ===== CRITICAL: Comprehensive validation before attempting delete =====
      
      // Check 1: Firestore initialized
      if (!isValidFirestoreInstance(firestore)) {
        console.error('[DeleteRide] Firestore not initialized');
        toast({ variant: 'destructive', title: 'System Error', description: 'Database connection not available. Please refresh the page.' });
        return;
      }

      // Check 2: User authenticated
      if (!user) {
        console.error('[DeleteRide] User not authenticated');
        toast({ variant: 'destructive', title: 'Authentication Required', description: 'You must be logged in to delete rides.' });
        setDeleteOpen(false);
        return;
      }

      // Check 3: University set
      if (!university) {
        console.error('[DeleteRide] University not set');
        toast({ variant: 'destructive', title: 'Configuration Error', description: 'University information missing. Please refresh the page.' });
        setDeleteOpen(false);
        return;
      }

      // Check 4: Ride ID exists
      if (!ride?.id) {
        console.error('[DeleteRide] Ride ID missing');
        toast({ variant: 'destructive', title: 'Invalid Ride', description: 'Ride information is incomplete.' });
        setDeleteOpen(false);
        return;
      }

      console.log('[DeleteRide] Starting deletion process', {
        rideId: ride.id,
        userId: user.uid,
        university,
        acceptedCount
      });

      // ===== PREFLIGHT: Verify ride exists and user owns it =====
      try {
        const rideRef = doc(firestore, `universities/${university}/rides`, ride.id);
        const rideSnap = await getDoc(rideRef);
        
        if (!rideSnap.exists()) {
          console.warn('[DeleteRide] Ride not found in database', ride.id);
          toast({ 
            variant: 'destructive', 
            title: 'Ride Not Found', 
            description: 'This ride no longer exists. It may have already been deleted.' 
          });
          setDeleteOpen(false);
          return;
        }
        
        const rideDoc = rideSnap.data() as RideType & { driverId?: string; createdBy?: string };
        const ownerId = rideDoc.driverId || rideDoc.createdBy;
        
        // Verify ownership
        if (ownerId !== user.uid) {
          console.warn('[DeleteRide] Ownership mismatch', {
            ownerId,
            userId: user.uid
          });
          toast({ 
            variant: 'destructive', 
            title: 'Unauthorized', 
            description: 'You are not the owner of this ride and cannot delete it.' 
          });
          setDeleteOpen(false);
          return;
        }

        // Verify university match
        if (userData?.university && userData.university !== university) {
          console.warn('[DeleteRide] University mismatch', {
            userUniversity: userData.university,
            rideUniversity: university
          });
          toast({ 
            variant: 'destructive', 
            title: 'Permission Error', 
            description: 'Your account university does not match this ride. Please contact support.' 
          });
          setDeleteOpen(false);
          return;
        }

        // Block if has confirmed passengers
        if (acceptedCount > 0) {
          console.warn('[DeleteRide] Ride has accepted bookings', { acceptedCount });
          toast({ 
            variant: 'destructive', 
            title: 'Cannot Delete', 
            description: `This ride has ${acceptedCount} confirmed passenger${acceptedCount > 1 ? 's' : ''} and cannot be deleted. You can cancel the ride instead.` 
          });
          setDeleteOpen(false);
          return;
        }

        // Check departure time
        if (rideDoc.departureTime) {
          const departureMs = rideDoc.departureTime.seconds 
            ? rideDoc.departureTime.seconds * 1000 
            : new Date(rideDoc.departureTime).getTime();
          
          if (Date.now() >= departureMs) {
            console.warn('[DeleteRide] Ride has already departed');
            toast({ 
              variant: 'destructive', 
              title: 'Cannot Delete', 
              description: 'Cannot delete a ride that has already departed.' 
            });
            setDeleteOpen(false);
            return;
          }
        }
      } catch (preflightErr: any) {
        console.error('[DeleteRide] Preflight check failed:', preflightErr);
        toast({ 
          variant: 'destructive', 
          title: 'Verification Failed', 
          description: 'Failed to verify ride ownership. Please try again.' 
        });
        setDeleteOpen(false);
        return;
      }

      // ===== EXECUTE DELETE VIA BACKEND API =====
      setIsDeleting(true);
      console.log('[DeleteRide] Calling backend API');
      
      try {
        // Get fresh auth token
        const idToken = await user.getIdToken(/* forceRefresh */ true).catch(err => {
          console.error('[DeleteRide] Failed to get auth token:', err);
          throw new Error('Failed to authenticate. Please log in again.');
        });
        
        console.log('[DeleteRide] Auth token obtained, making API request');
        
        const response = await fetch('/api/rides/delete', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            university,
            rideId: ride.id,
          }),
        });

        console.log('[DeleteRide] API response status:', response.status);
        console.log('[DeleteRide] Response headers:', {
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length')
        });
        
        let data;
        let responseText = '';
        try {
          responseText = await response.text();
          console.log('[DeleteRide] Response text:', responseText.substring(0, 500)); // Log first 500 chars to avoid spam
          data = responseText ? JSON.parse(responseText) : {};
        } catch (parseErr) {
          console.error('[DeleteRide] Failed to parse response:', parseErr);
          console.error('[DeleteRide] Raw response text was:', responseText);
          data = { error: 'Invalid response from server' };
        }

        if (!response.ok) {
          console.error('[DeleteRide] API error response:', { 
            status: response.status, 
            data,
            error: data?.error,
            message: data?.message
          });
          
          // Specific error handling
          if (response.status === 401) {
            toast({ 
              variant: 'destructive', 
              title: 'Authentication Failed', 
              description: 'Your session has expired. Please log in again.' 
            });
          } else if (response.status === 403) {
            toast({ 
              variant: 'destructive', 
              title: 'Permission Denied', 
              description: data.message || data.error || 'You do not have permission to delete this ride.' 
            });
          } else if (response.status === 404) {
            toast({ 
              variant: 'destructive', 
              title: 'Ride Not Found', 
              description: 'This ride no longer exists. It may have already been deleted.' 
            });
          } else if (response.status === 400) {
            toast({ 
              variant: 'destructive', 
              title: 'Cannot Delete', 
              description: data.message || data.error || 'This ride cannot be deleted. It may have confirmed bookings.' 
            });
          } else {
            toast({ 
              variant: 'destructive', 
              title: 'Delete Failed', 
              description: data.message || data.error || `Server error (${response.status}). Please try again.` 
            });
          }
          setDeleteOpen(false);
          return;
        }

        // Success!
        console.log('[DeleteRide] Ride deleted successfully', { 
          rideId: ride.id,
          response: { ok: data?.ok, message: data?.message, statusCode: response.status }
        });
        toast({ 
          title: 'Ride Deleted', 
          description: data?.message || 'Your ride has been deleted successfully.' 
        });
        setDeleteOpen(false);
        
      } catch (apiErr: any) {
        console.error('[DeleteRide] API call failed:', apiErr);
        
        // Network or other errors
        if (apiErr.message?.includes('Failed to fetch') || apiErr.message?.includes('NetworkError')) {
          toast({ 
            variant: 'destructive', 
            title: 'Network Error', 
            description: 'Failed to connect to server. Please check your internet connection and try again.' 
          });
        } else if (apiErr.message?.includes('authenticate')) {
          toast({ 
            variant: 'destructive', 
            title: 'Authentication Error', 
            description: apiErr.message 
          });
        } else {
          toast({ 
            variant: 'destructive', 
            title: 'Delete Failed', 
            description: apiErr.message || 'An unexpected error occurred. Please try again.' 
          });
        }
        setDeleteOpen(false);
      } finally {
        setIsDeleting(false);
      }
    }; 

    const handleCancelRide = async () => {
      // ===== CRITICAL: Comprehensive validation before attempting cancel =====
      
      console.log('[CancelRide] Starting cancellation process', {
        rideId: ride?.id,
        userId: user?.uid,
        driverId: ride?.driverId
      });

      // Check 1: User authenticated
      if (!user) {
        console.error('[CancelRide] User not authenticated');
        toast({ 
          variant: 'destructive', 
          title: 'Authentication Required', 
          description: 'You must be logged in to cancel rides.' 
        });
        return;
      }

      // Check 2: Ride exists
      if (!ride?.id || !ride?.driverId) {
        console.error('[CancelRide] Invalid ride data');
        toast({ 
          variant: 'destructive', 
          title: 'Invalid Ride', 
          description: 'Ride information is incomplete.' 
        });
        return;
      }

      // Check 3: User is the driver
      if (user.uid !== ride.driverId) {
        console.warn('[CancelRide] User is not the driver', {
          userId: user.uid,
          driverId: ride.driverId
        });
        toast({ 
          variant: 'destructive', 
          title: 'Unauthorized', 
          description: 'Only the ride driver can cancel this ride.' 
        });
        return;
      }

      // Check 4: University set
      if (!university) {
        console.error('[CancelRide] University not set');
        toast({ 
          variant: 'destructive', 
          title: 'Configuration Error', 
          description: 'University information missing.' 
        });
        return;
      }

      // Check 5: Ride not already cancelled
      if (ride.status === 'cancelled') {
        console.warn('[CancelRide] Ride already cancelled');
        toast({ 
          variant: 'destructive', 
          title: 'Already Cancelled', 
          description: 'This ride has already been cancelled.' 
        });
        setShowCancelDialog(false);
        return;
      }

      // ===== EXECUTE CANCELLATION VIA BACKEND API =====
      setIsCancelling(true);
      console.log('[CancelRide] Calling backend API');
      
      try {
        // Get fresh auth token
        const idToken = await user.getIdToken(/* forceRefresh */ true).catch(err => {
          console.error('[CancelRide] Failed to get auth token:', err);
          throw new Error('Failed to authenticate. Please log in again.');
        });
        
        console.log('[CancelRide] Auth token obtained, making API request');
        
        const response = await fetch('/api/rides/cancel', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            university,
            rideId: ride.id,
            reason: 'Driver cancelled ride',
          }),
        });

        console.log('[CancelRide] API response status:', response.status);
        
        let data;
        try {
          data = await response.json();
        } catch (parseErr) {
          console.error('[CancelRide] Failed to parse response:', parseErr);
          data = { message: 'Invalid response from server' };
        }

        if (!response.ok) {
          console.error('[CancelRide] API error:', { status: response.status, data });
          
          // Specific error handling
          if (response.status === 401) {
            toast({ 
              variant: 'destructive', 
              title: 'Authentication Failed', 
              description: 'Your session has expired. Please log in again.' 
            });
          } else if (response.status === 403) {
            // Check if it's an account lock
            if (data.message?.includes('locked') || data.error?.includes('locked')) {
              toast({ 
                variant: 'destructive', 
                title: 'Account Temporarily Locked', 
                description: data.message || data.error || 'Your account has been temporarily locked due to high cancellation rates.'
              });
            } else {
              toast({ 
                variant: 'destructive', 
                title: 'Permission Denied', 
                description: data.message || data.error || 'You do not have permission to cancel this ride.' 
              });
            }
          } else if (response.status === 404) {
            toast({ 
              variant: 'destructive', 
              title: 'Ride Not Found', 
              description: 'This ride no longer exists.' 
            });
          } else if (response.status === 400) {
            toast({ 
              variant: 'destructive', 
              title: 'Cannot Cancel', 
              description: data.message || data.error || 'This ride cannot be cancelled. It may have already started.' 
            });
          } else {
            toast({ 
              variant: 'destructive', 
              title: 'Cancellation Failed', 
              description: data.message || data.error || `Server error (${response.status}). Please try again.` 
            });
          }
          setShowCancelDialog(false);
          return;
        }

        // Success!
        const passengersAffected = data.data?.passengersAffected || 0;
        console.log('[CancelRide] Ride cancelled successfully', { 
          rideId: ride.id, 
          passengersAffected 
        });
        
        toast({ 
          title: 'Ride Cancelled', 
          description: passengersAffected > 0 
            ? `${passengersAffected} passenger${passengersAffected > 1 ? 's have' : ' has'} been notified.`
            : 'Ride has been cancelled successfully.' 
        });
        trackEvent('ride_cancellation', {
          event_action: 'driver_cancelled',
          ride_id: ride.id,
          passengers_affected: passengersAffected,
        });
        setShowCancelDialog(false);
        
      } catch (apiErr: any) {
        console.error('[CancelRide] API call failed:', apiErr);
        
        // Network or other errors
        if (apiErr.message?.includes('Failed to fetch') || apiErr.message?.includes('NetworkError')) {
          toast({ 
            variant: 'destructive', 
            title: 'Network Error', 
            description: 'Failed to connect to server. Please check your internet connection and try again.' 
          });
        } else if (apiErr.message?.includes('authenticate')) {
          toast({ 
            variant: 'destructive', 
            title: 'Authentication Error', 
            description: apiErr.message 
          });
        } else {
          toast({ 
            variant: 'destructive', 
            title: 'Cancellation Failed', 
            description: apiErr.message || 'An unexpected error occurred. Please try again.' 
          });
        }
        setShowCancelDialog(false);
      } finally {
        setIsCancelling(false);
      }
    };

    return (
        <>
        <Card 
          className="p-2.5 sm:p-3 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 shadow-md shadow-primary/5 relative"
        >
            <CardHeader 
              className="p-0 mb-1.5 md:mb-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setShowRideDetail(true)}
            >
              <div className="flex justify-between items-start gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="space-y-0.5 mb-1.5 md:mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[0.65rem] text-slate-400">From</p>
                          <p className="text-xs font-semibold truncate text-white">{truncateChars(ride.from, 25)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[0.65rem] text-slate-400">To</p>
                          <p className="text-xs font-semibold truncate text-white">{truncateChars(ride.to, 25)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-white/10">
                      <div className="text-[0.7rem] text-slate-300">
                        {formatTimestamp(ride.departureTime, { format: 'short', fallback: 'Time TBD' })}
                      </div>
                    </div>
                  </div>
                   <div className="text-right flex-shrink-0">
                     <Badge variant={ride.status === 'active' ? 'default' : ride.status === 'full' ? 'destructive' : 'secondary'} className="text-[0.65rem] mb-1">{ride.status}</Badge>
                     <div className="text-sm font-semibold text-white">PKR {ride.price}</div>
                     <div className="text-[0.7rem] text-slate-300">Seats: {availableSeats}</div>
                   </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">

              <div className="mb-2.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                <RouteDialogButton ride={ride} pickupMarkers={pickupMarkers} />
                <div className="w-full">
                  <Button
                    onClick={openRideInGoogleMaps}
                    variant="outline"
                    size="sm"
                    className="w-full h-9 px-4 text-sm border-slate-600/80 bg-slate-800/70 hover:bg-slate-700/80 text-slate-200"
                  >
                    <MapPin className="mr-1.5 h-3.5 w-3.5" /> View on Maps
                  </Button>
                </div>
                <div className="w-full rounded-md border border-blue-500/30 bg-blue-900/10 px-3 py-2 text-xs">
                  <span className="text-slate-300">Time remaining: </span>
                  <span className="text-blue-300 font-mono">{departureTimer}</span>
                </div>
              </div>

              <BookingRequests ride={ride} university={university} />

              {/* Confirmed Passengers: passengers who clicked Confirm Ride */}
              {confirmedBookings.length > 0 && (
                <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2 relative">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    <h4 className="font-bold text-sm text-white">Confirmed Passengers</h4>
                    <Badge className="bg-green-500/20 text-green-300 text-xs py-0.5 px-2 border border-green-500/30">{confirmedBookings.length}</Badge>
                    {getUnreadForRide(ride.id) > 0 && (
                      <NotificationBadge count={getUnreadForRide(ride.id)} dot className="ml-auto" position="inline" />
                    )}
                  </div>
                  <div className="space-y-2 md:max-h-56 md:overflow-y-auto md:pr-1">
                  {confirmedBookings.map((b) => (
                    <div 
                      key={b.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPassenger(b);
                        setShowPassengerDetail(true);
                      }}
                      className="group relative p-2.5 md:p-3 bg-gradient-to-br from-green-900/20 via-green-800/10 to-slate-900/50 rounded-lg border border-green-700/40 hover:border-green-500/60 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-green-500/10 hover:-translate-y-0.5"
                    >
                      {/* Gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                      
                      <div className="relative z-10 flex items-start justify-between gap-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/20 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="h-4 w-4 text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <UserNameWithBadge 
                                name={b.passengerDetails?.fullName || (b.passengerDetails as any)?.displayName || 'Unknown Student'} 
                                verified={isUserVerified(b.passengerDetails)}
                                size="md"
                                truncate
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5 text-xs ml-9">
                            <div className="flex items-start gap-2">
                              <MapPin className="h-3.5 w-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                              <span className="text-green-200/90 font-medium line-clamp-2">
                                {formatPickupLabel(b as any, resolvedPickupNames)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-slate-400">{((b.ride?.departureTime?.seconds ?? ride.departureTime?.seconds) && new Date((b.ride?.departureTime?.seconds ?? ride.departureTime?.seconds) * 1000).toLocaleString('en-US', { 
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })) || 'Time TBD'}</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1.5 ml-9">Click for contact info</p>
                        </div>
                        <div className="relative z-10 flex flex-col gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          {((b as any).chatId || b.id) ? (
                            <ChatButton chatId={(b as any).chatId || b.id} university={university} label="Chat" otherUserName={b.passengerDetails?.fullName || (b.passengerDetails as any)?.displayName || 'Unknown'} />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              )}

              {/* Pending Confirmation: accepted but not yet confirmed */}
              {pendingAcceptedBookings.length > 0 && (
                <div className="mt-3 space-y-2" onClick={(e) => { e.stopPropagation(); }}>
                  <div className="flex items-center gap-2 relative">
                    <Clock className="h-5 w-5 text-amber-400" />
                    <h4 className="font-bold text-sm text-white">Pending Confirmation</h4>
                    <Badge className="bg-amber-500/20 text-amber-300 text-xs py-0.5 px-2 border border-amber-500/30">{pendingAcceptedBookings.length}</Badge>
                    {getUnreadForRide(ride.id) > 0 && (
                      <NotificationBadge count={getUnreadForRide(ride.id)} dot className="ml-auto" position="inline" />
                    )}
                  </div>
                  <div className="space-y-2 md:max-h-56 md:overflow-y-auto md:pr-1">
                  {pendingAcceptedBookings.map((b: any) => (
                    <div 
                      key={b.id} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPassenger(b);
                        setShowPassengerDetail(true);
                      }}
                      className="group relative p-2.5 md:p-3 bg-gradient-to-br from-amber-900/20 via-amber-800/10 to-slate-900/50 rounded-lg border border-amber-700/40 hover:border-amber-500/60 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5"
                    >
                      {/* Gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                      
                      <div className="relative z-10 flex items-start justify-between gap-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                              <Clock className="h-4 w-4 text-amber-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <UserNameWithBadge 
                                name={b.passengerDetails?.fullName || (b.passengerDetails as any)?.displayName || 'Unknown Student'} 
                                verified={isUserVerified(b.passengerDetails)}
                                size="md"
                                truncate
                              />
                              <p className="text-xs text-amber-400/80 mt-1">Waiting for confirmation</p>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-start gap-2">
                              <MapPin className="h-3.5 w-3.5 text-amber-400/80 flex-shrink-0 mt-0.5" />
                              <span className="text-xs text-slate-300 line-clamp-2">
                                {formatPickupLabel(b as any, resolvedPickupNames)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-xs text-slate-400">
                                {formatTimestamp(b.ride?.departureTime ?? ride.departureTime, { format: 'short', fallback: 'Time TBD' })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="relative z-10 flex flex-col gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          {((b as any).chatId || b.id) ? (
                            <ChatButton chatId={(b as any).chatId || b.id} university={university} label="Chat" otherUserName={b.passengerDetails?.fullName || (b.passengerDetails as any)?.displayName || 'Unknown'} />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter className="p-0 mt-2">
              <div className="flex justify-end w-full gap-2" onClick={(e) => e.stopPropagation()}>
                {/* Cancel Ride Button */}
                {ride.status !== 'cancelled' && acceptedCount > 0 && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex items-center gap-2 border-red-700/50 hover:bg-red-900/20 hover:text-red-400"
                      onClick={() => setShowCancelDialog(true)}
                      disabled={!user || user.uid !== ride.driverId || isCancelling}
                      title={!user ? 'Sign in to cancel this ride' : user.uid !== ride.driverId ? 'Only the driver can cancel' : ''}
                    >
                      <X className="h-4 w-4" /> Cancel Ride
                    </Button>
                    <CancellationConfirmDialog
                      open={showCancelDialog}
                      onOpenChange={setShowCancelDialog}
                      cancellationRate={driverCancellationRate}
                      minutesUntilDeparture={(() => {
                        try {
                          if (!ride.departureTime) return 0;
                          const depTime = ride.departureTime?.seconds 
                            ? new Date(ride.departureTime.seconds * 1000)
                            : new Date(ride.departureTime);
                          return Math.max(0, Math.floor((depTime.getTime() - Date.now()) / (60 * 1000)));
                        } catch {
                          return 0;
                        }
                      })()}
                      onConfirm={handleCancelRide}
                      isLoading={isCancelling}
                      cancellerRole="driver"
                    />
                  </>
                )}
                
                {acceptedCount === 0 && (
                  <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="flex items-center gap-2" 
                        disabled={!user || user.uid !== ride.driverId}
                        title={
                          !user ? 'Sign in to delete this ride' 
                          : user.uid !== ride.driverId ? 'You are not the owner of this ride'
                          : ''
                        }
                      >
                        <Trash className="h-4 w-4" /> Delete
                      </Button>
                    </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Ride</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to permanently delete this ride? This will also remove any pending bookings. You cannot delete a ride that has accepted bookings.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="ghost">Cancel</Button>
                      </DialogClose>
                      <Button variant="destructive" onClick={handleDeleteRide} disabled={isDeleting}>
                        {isDeleting ? 'Deleting...' : 'Delete Ride'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                )}
              </div>
            </CardFooter>

            {/* Passenger Detail Modal */}
            {selectedPassenger && (
              <PassengerDetailModal
                open={showPassengerDetail}
                onOpenChange={setShowPassengerDetail}
                booking={selectedPassenger}
                passengerName={selectedPassenger.passengerDetails?.fullName || selectedPassenger.passengerDetails?.displayName || 'Unknown'}
                passengerVerified={isUserVerified(selectedPassenger.passengerDetails)}
                pickupLocation={formatPickupLabel(selectedPassenger as any, resolvedPickupNames)}
                dropoffLocation={selectedPassenger.dropoffPlaceName || selectedPassenger.ride?.to || 'Unknown'}
                rideDateTime={selectedPassenger.ride?.departureTime ?? ride.departureTime}
                price={selectedPassenger.price ?? selectedPassenger.ride?.price ?? ride.price}
                phoneNumber={(selectedPassenger.passengerDetails as any)?.contactNumber || (selectedPassenger.passengerDetails as any)?.phone}
                university={university}
                rideId={ride.id}
                bookingId={selectedPassenger.id}
                ride={ride}
                user={user}
                onCancelSuccess={() => {
                  setShowPassengerDetail(false);
                  setSelectedPassenger(null);
                }}
              />
            )}
        </Card>

        {/* Ride Detail Dialog */}
        <RideDetailDialog
          open={showRideDetail}
          onOpenChange={setShowRideDetail}
          ride={ride}
          acceptedCount={acceptedCount}
          availableSeats={availableSeats}
        />
        </>
    )
}


// Helper: Convert Firestore Timestamp to milliseconds, handling multiple formats
function getTimestampMs(ts: any): number | null {
  if (!ts) return null;
  // If it's already a number (milliseconds), return it
  if (typeof ts === 'number') return ts;
  // If it's a Firestore Timestamp with .seconds property
  if (ts && typeof ts === 'object' && typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + ((ts.nanoseconds || 0) / 1_000_000);
  }
  // If it's a Date object
  if (ts instanceof Date) return ts.getTime();
  // Try to convert to date and get time
  try {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d.getTime();
  } catch (_) {}
  return null;
}

export default function MyRidesPage() {
  const { user, data: userData, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const normalizedUniversity = String(userData?.university || '').trim().toLowerCase();
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  // CRITICAL: Log when user data is still loading or missing
  React.useEffect(() => {
    if (userLoading) {
      console.log('🚗 [My Rides] Still loading user data...');
    } else if (!user) {
      console.log('🚗 [My Rides] User not logged in');
    } else if (!userData) {
      console.warn('🚗 [My Rides] User authenticated but userData is missing');
    } else if (!userData.university) {
      console.warn('🚗 [My Rides] User profile missing university field');
    } else {
      console.log('🚗 [My Rides] User data loaded successfully', {
        uid: user.uid,
        university: userData.university,
        fullName: userData.fullName
      });
    }
  }, [userLoading, user, userData]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // ── PERF: Add orderBy and limit to my-rides query ──
  const ridesQuery = (user && isValidFirestoreInstance(firestore) && userData && userData.university) ? query(
    collection(firestore, 'universities', userData.university, 'rides'),
    where('driverId', '==', user.uid),
    // Note: Would prefer orderBy('departureTime', 'desc') but that requires a composite index
    // For now, sort client-side; consider adding index later for better performance
    limit(100) // Limit to last 100 rides to avoid loading entire history
  ) : null;

  const { data: ridesRaw, loading: ridesLoading, error: ridesError } = useCollection<RideType>(ridesQuery);
  
  // Sort client-side by departureTime (descending) until Firestore index is ready
  const rides = React.useMemo(() => {
    if (!ridesRaw) return null;
    return [...ridesRaw].sort((a, b) => {
      const aMs = getTimestampMs(a.departureTime);
      const bMs = getTimestampMs(b.departureTime);
      const aTime = aMs || 0;
      const bTime = bMs || 0;
      return bTime - aTime; // descending
    });
  }, [ridesRaw]);
  
  const loading = userLoading || ridesLoading;

  // Debug: Log query status and results - CRITICAL for diagnosing missing rides
  React.useEffect(() => {
    console.log('🚗 [My Rides] Query Status:', {
      hasUser: !!user,
      userId: user?.uid,
      hasFirestore: !!firestore,
      hasUserData: !!userData,
      university: userData?.university,
      queryCreated: !!ridesQuery,
      ridesLoading,
      ridesError: ridesError?.toString() || null,
      ridesRawCount: ridesRaw?.length || 0,
      ridesCount: rides?.length || 0,
      rides: rides?.map(r => ({ 
        id: r.id, 
        from: r.from, 
        to: r.to, 
        driverId: r.driverId,
        departureTime: r.departureTime,
        departureTimeMs: getTimestampMs(r.departureTime),
        status: r.status
      })) || [],
      timestamp: new Date().toISOString()
    });
  }, [user, firestore, userData, ridesQuery, ridesLoading, ridesError, rides, ridesRaw]);

  // Filter out rides that are 4+ hours past departure
  const filteredRides = React.useMemo(() => {
    if (!rides) return [];
    const fourHoursMs = 4 * 60 * 60 * 1000;
    const now = nowMs;
    const hiddenRideStatuses = new Set(['cancelled', 'canceled']);
    
    const filtered = rides.filter((ride) => {
      const status = String(ride?.status || '').trim().toLowerCase();
      if (hiddenRideStatuses.has(status)) {
        return false;
      }

      // Get timestamp in milliseconds (handles Timestamp, Date, number, etc.)
      const departureMs = getTimestampMs(ride.departureTime);
      
      // Log filter decisions for rides that fail
      if (departureMs === null) {
        console.warn(`[My Rides] Ride ${ride.id} has invalid departureTime:`, ride.departureTime);
        // Include rides with invalid timestamps - let server-side deletion handle cleanup
        return true;
      }
      
      const isExpired = (now - departureMs) >= fourHoursMs;
      if (isExpired) {
        console.debug(`[My Rides] Filtering out expired ride ${ride.id}: departure was ${Math.round((now - departureMs) / 1000 / 60)} minutes ago`);
      }
      
      return !isExpired;
    });
    
    if (filtered.length < rides.length) {
      console.log(`[My Rides] Filtered ${rides.length - filtered.length} expired ride(s)`);
    }
    
    return filtered;
  }, [rides, nowMs]);

  // Update ride status to "inactive" if departure time has passed
  const ridesWithStatus = React.useMemo(() => {
    if (!filteredRides || filteredRides.length === 0) return [];
    const now = Date.now();
    
    return filteredRides.map((ride) => {
      const departureMs = getTimestampMs(ride.departureTime);
      // If departure time has passed and ride is currently "active", mark as "inactive"
      const isInactive = departureMs !== null && now > departureMs && ride.status === 'active';
      
      if (isInactive) {
        console.debug(`[My Rides] Marking ride ${ride.id} as inactive (departed)`);
        return { ...ride, status: 'inactive' };
      }
      
      return ride;
    });
  }, [filteredRides]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
          <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="section-shell py-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Guard against missing university - show loading or empty state
  // IMPORTANT: This MUST come before the empty rides check to prevent
  // showing "No Rides Offered" when the user profile hasn't loaded yet.
  if (!userData?.university) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
          <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="section-shell py-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Now safe to check for empty rides — university is loaded and query has been executed
  if (!ridesWithStatus || ridesWithStatus.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
          <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="section-shell py-8 relative z-10">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-50">No Rides Offered</h2>
            <p className="text-slate-300">You have not offered any rides yet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
      {/* Floating background orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
        <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="section-shell py-8 relative z-10">
        <div className="mb-6 sm:mb-8 animate-page">
          <h1 className="text-3xl font-headline font-bold text-slate-50 mb-2">My Offered Rides</h1>
          <p className="text-slate-300">Ride providers can view and track their ride offers after creating them.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {ridesWithStatus
          .sort((a: RideType, b: RideType) => {
            const aTime =
              parseTimestampToMs((a as any)?.updatedAt, { silent: true }) ??
              parseTimestampToMs((a as any)?.createdAt, { silent: true }) ??
              parseTimestampToMs((a as any)?.departureTime, { silent: true }) ??
              0;
            const bTime =
              parseTimestampToMs((b as any)?.updatedAt, { silent: true }) ??
              parseTimestampToMs((b as any)?.createdAt, { silent: true }) ??
              parseTimestampToMs((b as any)?.departureTime, { silent: true }) ??
              0;
            return bTime - aTime; // descending order
          })
          .map((ride: RideType) => (
            <MyRideCard key={ride.id} ride={ride} university={normalizedUniversity} />
          ))}
        </div>
      </div>
    </div>
  );
}


// ---- Simple Route Dialog Button (matching my-bookings implementation) ----
function RouteDialogButton({
  ride,
  pickupMarkers,
}: {
  ride: RideType;
  pickupMarkers: Array<{ lat: number; lng: number; label?: string }>;
}) {
  const routeLatLngs = React.useMemo(() => {
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
    return [] as { lat: number; lng: number }[];
  }, [ride.route, ride.routePolyline]);

  // Determine if ride is leaving FROM or going TO university
  const isFromUniversity = React.useMemo(() => {
    const fromStr = String(ride.from || '').toLowerCase();
    return fromStr.includes('university') || fromStr.includes('campus') || fromStr.includes('uni');
  }, [ride.from]);

  const routePath = React.useMemo(() => {
    return routeLatLngs.map((point) => [point.lat, point.lng] as [number, number]);
  }, [routeLatLngs]);

  // Calculate bounds for the map
  const mapBounds = React.useMemo(() => {
    const allPoints: any[] = [...routeLatLngs];
    pickupMarkers.forEach((p: any) => {
      if (p && typeof p.lat === 'number' && typeof p.lng === 'number') {
        allPoints.push({ lat: Number(p.lat), lng: Number(p.lng) });
      }
    });
    if (allPoints.length < 2) return null;
    return L.latLngBounds(allPoints.map((p: any) => [p.lat, p.lng]));
  }, [routeLatLngs, pickupMarkers]);

  const startLatLng = routeLatLngs.length > 0 ? routeLatLngs[0] : null;
  const endLatLng = routeLatLngs.length > 1 ? routeLatLngs[routeLatLngs.length - 1] : null;

  const normalizedPickupMarkers = React.useMemo(() => {
    return pickupMarkers
      .map((point: any) => {
        if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') return null;
        return {
          lat: Number(point.lat),
          lng: Number(point.lng),
          label: point.label || null,
        };
      })
      .filter(Boolean) as Array<{ lat: number; lng: number; label: string | null }>;
  }, [pickupMarkers]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full h-10 border-slate-600/80 bg-gradient-to-r from-slate-800/80 to-slate-700/60 hover:from-slate-700 hover:to-slate-600 text-slate-100 shadow-md"
        >
          <MapPin className="mr-2 h-4 w-4" /> View Route & {isFromUniversity ? 'Dropoffs' : 'Pickups'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl" onClick={(e) => { e.stopPropagation(); }} onPointerDown={(e) => { e.stopPropagation(); }}>
        <DialogHeader>
          <DialogTitle>Your Route & Passenger {isFromUniversity ? 'Dropoffs' : 'Pickups'}</DialogTitle>
          <DialogDescription>
            View the route for your ride and see where passengers will be {isFromUniversity ? 'dropped off' : 'picked up'} along the way.
          </DialogDescription>
        </DialogHeader>
        <div className="h-[60vh] w-full rounded-lg overflow-hidden border border-slate-700">
          {routeLatLngs.length > 0 ? (
            <MapContainer
              bounds={mapBounds || undefined}
              center={mapBounds ? undefined : (startLatLng ? ([startLatLng.lat, startLatLng.lng] as any) : undefined)}
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
              {startLatLng && (
                <Marker position={[startLatLng.lat, startLatLng.lng] as any} icon={getRoutePinIcon('start')}>
                  <Popup>Start</Popup>
                </Marker>
              )}
              {endLatLng && (
                <Marker position={[endLatLng.lat, endLatLng.lng] as any} icon={getRoutePinIcon('end')}>
                  <Popup>Destination</Popup>
                </Marker>
              )}
              {normalizedPickupMarkers.map((point, idx) => (
                <Marker key={`pickup-${idx}`} position={[point.lat, point.lng] as any} icon={getRoutePinIcon('pickup')}>
                  <Popup>{point.label || `Passenger ${isFromUniversity ? 'Dropoff' : 'Pickup'}`}</Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">No route available</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


