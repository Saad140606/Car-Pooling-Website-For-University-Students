'use client';

import { collection, query, where, orderBy, doc, writeBatch, runTransaction, getDocs, getDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Check, MapPin, X, Trash, CheckCircle2, Clock } from 'lucide-react';
import { useCollection as useBookingCollection } from '@/firebase/firestore/use-collection';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import L, { LatLngExpression } from 'leaflet';
import { Ride as RideType, Booking as BookingType } from '@/lib/types';
import { decodePolyline } from '@/lib/route';
import { formatTimestamp, parseTimestampToMs } from '@/lib/timestampUtils';
import MapLeaflet from '@/components/MapLeaflet';
import ChatButton from '@/components/chat/ChatButton';
import NotificationBadge from '@/components/NotificationBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { useNotifications } from '@/contexts/NotificationContext';
import { InlineVerifiedBadge } from '@/components/VerificationBadge';
import { UserNameWithBadge } from '@/components/UserNameWithBadge';
import { isUserVerified } from '@/lib/verificationUtils';
import React from 'react';

// Fix for default icon not showing in Leaflet
if (typeof window !== 'undefined') {
  try {
    const pinSvg = `
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
        <path d='M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7z' fill='%23FFD166' stroke='%23ffffff' stroke-width='1.2' />
        <circle cx='12' cy='9' r='2.5' fill='%230b1220' />
      </svg>
    `;
    const pinDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(pinSvg)}`;
    L.Icon.Default.mergeOptions({ iconRetinaUrl: pinDataUrl, iconUrl: pinDataUrl, shadowUrl: '' });
  } catch (e) {}
}

// Small helper: truncate string to n characters with ellipsis
function truncateChars(s?: string | null, n = 30) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '...' : s;
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

function BookingRequests({ ride, university, onProcessed }: { ride: RideType, university: string, onProcessed?: (bookingId: string, status: 'accepted' | 'rejected') => void }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  console.log('[BookingRequests] Component mounted with ride:', { 
    rideId: ride?.id, 
    university, 
    rideFull: ride 
  });

  // Read requests from the ride-scoped `requests` subcollection so ride owners
  // can safely list only requests for their ride (rules allow listing here).
  // CRITICAL: Only create query if ride.id is defined to prevent invalid collection paths
  const bookingsQuery = (firestore && ride?.id) ? query(
    collection(firestore, `universities/${university}/rides/${ride.id}/requests`),
    where('status', 'in', ['PENDING', 'pending'])
  ) : null;

  const { data: bookings, loading } = useBookingCollection<BookingType>(bookingsQuery, { includeUserDetails: 'passengerId' });
  const [processingIds, setProcessingIds] = React.useState<string[]>([]);
  const [shownBookings, setShownBookings] = React.useState<BookingType[]>([]);
  const [placeNames, setPlaceNames] = React.useState<Record<string, string>>({});

  // Keep local shown list in sync with upstream bookings, but allow optimistic
  // removal immediately after an accept/reject so the UI does not permit
  // duplicate accepts while waiting for Firestore listeners to update.
  React.useEffect(() => {
    if (!bookings) return setShownBookings([]);
    setShownBookings(bookings);
  }, [bookings]);
  
  // Fetch place names for bookings that have coordinates but no place name
  React.useEffect(() => {
    if (!bookings) return;
    bookings.forEach(async (booking) => {
      if (!booking.pickupPlaceName && booking.pickupPoint && !placeNames[booking.id]) {
        try {
          const res = await fetch(`/api/nominatim/reverse?lat=${booking.pickupPoint.lat}&lon=${booking.pickupPoint.lng}`);
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
              setPlaceNames(prev => ({ ...prev, [booking.id]: data.display_name }));
            }
          }
        } catch (e) {
          console.debug('Failed to fetch place name:', e);
        }
      }
    });
  }, [bookings, placeNames]);

  const handleBooking = async (booking: BookingType, newStatus: 'accepted' | 'rejected') => {
    console.log('[handleBooking] Starting with:', { 
      bookingId: booking?.id, 
      status: newStatus, 
      user: user?.uid,
      booking_rideId: booking?.rideId,
      component_ride_id: ride?.id,
      booking_full: booking
    });
    
    if (!firestore) {
      console.error('[handleBooking] Firestore not available');
      return;
    }
    if (!booking?.id) {
      console.error('[handleBooking] No booking ID');
      return;
    }

    // Prevent duplicate clicks
    if (processingIds.includes(booking.id)) {
      console.log('[handleBooking] Already processing this booking');
      return;
    }
    
    // Fetch fresh booking data from Firestore to ensure status is current
    try {
      const freshRequestRef = doc(firestore, `universities/${university}/rides/${ride.id}/requests/${booking.id}`);
      const freshRequestSnap = await getDoc(freshRequestRef);
      
      if (freshRequestSnap.exists()) {
        const freshBooking = freshRequestSnap.data() as BookingType;
        const normalizedStatus = freshBooking.status?.toLowerCase();
        
        console.log('[handleBooking] Fresh booking status from Firestore:', normalizedStatus);
        
        if (normalizedStatus && normalizedStatus !== 'pending') {
          console.log('[handleBooking] Booking already processed with status:', freshBooking.status);
          toast({
            variant: 'destructive',
            title: 'Request Already Processed',
            description: 'This request has already been handled.'
          });
          return;
        }
      } else {
        console.error('[handleBooking] Booking not found in Firestore');
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Booking request not found.'
        });
        return;
      }
    } catch (error) {
      console.error('[handleBooking] Error fetching fresh booking data:', error);
      // Continue anyway - the transaction/API will handle errors
    }
    
    setProcessingIds((s) => [...s, booking.id]);
    // Optimistically remove the booking from the shown list so the provider
    // sees immediate feedback and cannot accept/reject the same request twice.
    const previousShown = shownBookings;
    setShownBookings((s) => s.filter((b) => b.id !== booking.id));

    try {
      // Use Firestore transaction for accept - simplify flow and avoid API issues
      if (newStatus === 'accepted') {
        console.log('[handleBooking] Processing acceptance via direct Firestore transaction...');
        
        const rideId = ride.id || booking.rideId;
        if (!rideId) {
          throw new Error('Ride ID not found');
        }

        await runTransaction(firestore, async (transaction) => {
          const rideRef = doc(firestore, `universities/${university}/rides`, rideId);
          const requestRef = doc(firestore, `universities/${university}/rides`, rideId, 'requests', booking.id);
          
          // Get ride data
          const rideDoc = await transaction.get(rideRef);
          if (!rideDoc.exists()) {
            throw new Error('Ride not found in database');
          }
          
          const rideData = rideDoc.data() as RideType;
          
          // Get request data
          const requestDoc = await transaction.get(requestRef);
          if (!requestDoc.exists()) {
            throw new Error('Request not found in database');
          }
          
          const requestData = requestDoc.data() as BookingType;
          
          // Verify request is still pending
          const normalizedStatus = requestData.status?.toLowerCase();
          if (normalizedStatus && normalizedStatus !== 'pending') {
            throw new Error(`Request has already been ${normalizedStatus}`);
          }
          
          // Update request to accepted
          transaction.update(requestRef, {
            status: 'ACCEPTED',
            acceptedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          // Create booking document
          const bookingRef = doc(firestore, `universities/${university}/bookings`, booking.id);
          const chatId = booking.id;
          const chatRef = doc(firestore, `universities/${university}/chats`, chatId);
          
          transaction.set(chatRef, {
            bookingId: booking.id,
            rideId: rideId,
            passengerId: requestData.passengerId,
            providerId: rideData.driverId,
            participants: [requestData.passengerId, rideData.driverId],
            createdAt: serverTimestamp(),
            status: 'active'
          });
          
          transaction.set(bookingRef, {
            ...requestData,
            status: 'accepted',
            createdAt: serverTimestamp(),
            rideId: rideId,
            chatId: chatId,
            // Store complete ride details so my-bookings can display them
            ride: {
              id: rideData.id || rideId,
              from: rideData.from,
              to: rideData.to,
              departureTime: rideData.departureTime,
              price: rideData.price,
              route: rideData.route || [],
              driverId: rideData.driverId,
              driverInfo: rideData.driverInfo || { fullName: 'Driver' }
            },
            // Store driver details for chat display
            driverDetails: {
              fullName: rideData.driverInfo?.fullName || 'Driver',
              universityEmailVerified: rideData.driverInfo?.universityEmailVerified,
              idVerified: rideData.driverInfo?.idVerified,
              isVerified: rideData.driverInfo?.isVerified
            }
          });
        });

        console.log('[handleBooking] Acceptance processed successfully via transaction');
      } else {
        // For rejects: use direct Firestore update
        console.log('[handleBooking] Processing rejection...');
        
        const rideId = ride.id || booking.rideId;
        if (!rideId) {
          throw new Error('Ride ID not found');
        }
        
        try {
          const res = await fetch('/api/requests/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              university,
              rideId,
              requestId: booking.id,
              cancelledBy: booking.driverId || user?.uid,
              reason: 'Driver rejected request'
            })
          });

          if (!res.ok) {
            console.log('[handleBooking] Cancel API failed with status:', res.status, 'using fallback...');
            throw new Error(`Cancel API failed: ${res.status}`);
          }
          
          console.log('[handleBooking] Rejection processed via API');
        } catch (apiError) {
          console.log('[handleBooking] API rejection failed, using direct update:', apiError);
          // Fallback: update directly
          await runTransaction(firestore, async (transaction) => {
            const requestRef = doc(firestore, `universities/${university}/rides`, rideId, 'requests', booking.id);
            transaction.update(requestRef, { status: 'rejected' });
          });
        }
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

    } catch (error) {
      console.error('[handleBooking] Error:', error);
      console.error('[handleBooking] Error details:', { 
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        bookingId: booking.id,
        status: newStatus
      });
      
      // Roll back optimistic UI change so the provider can retry or see the request again
      setShownBookings(previousShown);
      
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage
      });
    } finally {
      setProcessingIds((s) => s.filter((id) => id !== booking.id));
    }
  };

  if (loading) return <div className="space-y-2 mt-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>;
  if (!bookings || bookings.length === 0) return <p className="text-slate-400 text-sm mt-4">No pending requests.</p>

  return (
    <div className="mt-4 space-y-3">
      <h4 className="font-semibold text-slate-200">Booking Requests</h4>
      {shownBookings.map((booking: any) => (
        <div key={booking.id} className="flex items-center justify-between p-3 bg-slate-800/40 backdrop-blur-sm rounded-lg">
          <div>
            <div className="mb-2">
              <UserNameWithBadge 
                name={booking.passengerDetails?.fullName || 'User'} 
                verified={isUserVerified(booking.passengerDetails)}
                size="md"
                truncate={false}
              />
            </div>
            {booking.passengerDetails?.phone ? (
              <p className="text-sm text-slate-300">{booking.passengerDetails.phone}</p>
            ) : null}
             <p className="text-xs text-accent flex items-center mt-1">
               <MapPin className="h-3 w-3 mr-1"/> {formatPickupLabel(booking, placeNames)}
             </p>
          </div>
          <div className="flex gap-2">
            <Button 
              size="icon" 
              variant="outline" 
              className="h-8 w-8 bg-green-500/10 text-green-500 hover:bg-green-500/20" 
              onClick={() => handleBooking(booking, 'accepted')} 
              disabled={processingIds.includes(booking.id) || (booking.status !== 'PENDING' && booking.status !== 'pending')}
              title="Accept request"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button 
              size="icon" 
              variant="outline" 
              className="h-8 w-8 bg-red-500/10 text-red-500 hover:bg-red-500/20" 
              onClick={() => handleBooking(booking, 'rejected')} 
              disabled={processingIds.includes(booking.id) || (booking.status !== 'PENDING' && booking.status !== 'pending')}
              title="Reject request"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MyRideCard({ ride, university } : { ride: RideType, university: string }) {
    const firestore = useFirestore();
    const { user, data: userData } = useUser();
    const { getUnreadForRide } = useNotifications();

    const acceptedBookingsQuery = (firestore && ride?.id) ? query(
        collection(firestore, `universities/${university}/bookings`),
        where('rideId', '==', ride.id),
        where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED'])
    ) : null;
    const { data: acceptedBookings } = useBookingCollection<BookingType>(acceptedBookingsQuery);

    const pendingRequestsQuery = (firestore && ride?.id) ? query(
      collection(firestore, `universities/${university}/rides/${ride.id}/requests`),
      where('status', 'in', ['PENDING', 'pending'])
    ) : null;
    const { data: pendingRequests } = useBookingCollection<BookingType>(pendingRequestsQuery);

    const acceptedPoints = acceptedBookings?.map(b => b.pickupPoint).filter(Boolean) as LatLngExpression[] || [];
    const pendingPoints = pendingRequests?.map(r => r.pickupPoint).filter(Boolean) as LatLngExpression[] || [];
    const pickupPoints = [...acceptedPoints, ...pendingPoints];
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const acceptedCount = acceptedBookings?.length || 0;
    const [availableSeats, setAvailableSeats] = React.useState<number>(ride.availableSeats ?? 0);

    React.useEffect(() => {
      setAvailableSeats(ride.availableSeats ?? 0);
    }, [ride.availableSeats]);

    const { toast } = useToast();

    const handleDeleteRide = async () => {
      if (!firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'Firestore not initialized.' });
        return;
      }

      // Preflight: fetch the authoritative ride document to confirm creator and avoid hitting rules
      try {
        const rideRef = doc(firestore, `universities/${university}/rides`, ride.id);
        const rideSnap = await getDoc(rideRef);
        if (!rideSnap.exists()) {
          toast({ variant: 'destructive', title: 'Not found', description: 'Ride not found. It may have already been deleted.' });
          setDeleteOpen(false);
          return;
        }
        const rideDoc = rideSnap.data() as RideType & { driverId?: string; createdBy?: string };

        // Fail fast with a clear message if the authenticated user is not the driver/creator
        // CRITICAL: Check driverId (canonical) first, fallback to createdBy for backwards compatibility
        const ownerId = rideDoc.driverId || rideDoc.createdBy;
        if (!user || ownerId !== user.uid) {
          toast({ variant: 'destructive', title: 'Not allowed', description: `You are not the driver of this ride (driverId: ${ownerId || 'unknown'}) and cannot delete it.` });
          setDeleteOpen(false);
          return;
        }

        // Ensure the user's profile university matches the ride's university; mirrors Firestore checks
        if (userData && userData.university && userData.university !== university) {
          toast({ variant: 'destructive', title: 'Permission mismatch', description: 'Your account university does not match this ride. Please complete your profile or contact support.' });
          setDeleteOpen(false);
          return;
        }

        if (acceptedCount > 0) {
          toast({ variant: 'destructive', title: 'Cannot delete', description: 'This ride has accepted bookings and cannot be deleted.' });
          return;
        }
      } catch (err: any) {
        console.error('Preflight ride fetch failed', err);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to verify ride ownership. Please try again.' });
        setDeleteOpen(false);
        return;
      }

      setIsDeleting(true);
      try {
        const bookingsQuery = query(collection(firestore, `universities/${university}/bookings`), where('rideId', '==', ride.id));
        const bookingsSnap = await getDocs(bookingsQuery);
        const batch = writeBatch(firestore);
        bookingsSnap.forEach((b) => batch.delete(doc(firestore, `universities/${university}/bookings`, b.id)));
        // Also remove any ride-scoped requests
        try {
          const requestsSnap = await getDocs(collection(firestore, `universities/${university}/rides/${ride.id}/requests`));
          requestsSnap.forEach((r) => batch.delete(doc(firestore, `universities/${university}/rides/${ride.id}/requests`, r.id)));
        } catch (_) {
          // ignore — some environments may not have requests yet
        }
        // Also remove any chats linked to this ride (created when bookings were accepted)
        try {
          const chatsQuery = query(collection(firestore, `universities/${university}/chats`), where('rideId', '==', ride.id));
          const chatsSnap = await getDocs(chatsQuery);
          chatsSnap.forEach((c) => batch.delete(doc(firestore, `universities/${university}/chats`, c.id)));
        } catch (_) {
          // ignore — chats may not exist
        }
        batch.delete(doc(firestore, `universities/${university}/rides`, ride.id));
        await batch.commit();

        toast({ title: 'Deleted', description: 'Ride and pending bookings (if any) have been deleted.' });
        setDeleteOpen(false);
      } catch (err: any) {
        console.error('Delete ride failed', err);
        // Map Firestore permission-denied to an actionable message
        if (err?.code === 'permission-denied' || String(err?.message).includes('permission-denied')) {
          // Fetch the ride doc again to get more info for the user (debug help)
          try {
            const rSnap = await getDoc(doc(firestore, `universities/${university}/rides`, ride.id));
            const rideData = rSnap.exists() ? rSnap.data() as any : null;
            const ownerId = rideData?.driverId || rideData?.createdBy || 'unknown';
            toast({ variant: 'destructive', title: 'Could not delete ride', description: `Missing or insufficient permissions. Driver ID: ${ownerId}. Ensure your account has access or run the Firestore emulator to test rules (see docs/firestore-rules.md).` });
          } catch (e) {
            toast({ variant: 'destructive', title: 'Could not delete ride', description: 'Missing or insufficient permissions. Ensure your account has access or run the Firestore emulator to test rules (see docs/firestore-rules.md).' });
          }
        } else {
          toast({ variant: 'destructive', title: 'Could not delete ride', description: err?.message || 'An error occurred while deleting the ride.' });
        }

        try {
          const permissionError = new FirestorePermissionError({ path: `universities/${university}/rides`, operation: 'delete' });
          setTimeout(() => errorEmitter.emit('permission-error', permissionError), 50);
        } catch (emitErr) {
          console.error('Failed to emit permission-error:', emitErr);
        }
      } finally {
        setIsDeleting(false);
      }
    }; 

    return (
        <Card className="p-3 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 shadow-md shadow-primary/5 relative">
            <CardHeader className="p-0 mb-2">
              <div className="flex justify-between items-start gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="space-y-0.5 mb-2">
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
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
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

              <div className="mb-2">
                {ride.route && ride.route.length > 0 && (
                  <RouteDialogButton ride={ride} pickupPoints={pickupPoints} />
                )}
              </div>

              <BookingRequests ride={ride} university={university} />

              {/* Confirmed Passengers: passengers who clicked Confirm Ride */}
              {acceptedBookings && acceptedBookings.filter(b => b.status === 'CONFIRMED').length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 relative">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <h4 className="font-bold text-sm text-white">Confirmed Passengers</h4>
                    <Badge className="bg-green-600/80 text-white text-xs py-0.5 px-2">{acceptedBookings.filter(b => b.status === 'CONFIRMED').length}</Badge>
                    {getUnreadForRide(ride.id) > 0 && (
                      <NotificationBadge count={getUnreadForRide(ride.id)} dot className="ml-auto" position="inline" />
                    )}
                  </div>
                  {acceptedBookings.filter(b => b.status === 'CONFIRMED').map((b) => (
                    <div key={b.id} className="p-4 bg-gradient-to-br from-green-900/20 to-slate-900/50 rounded-lg border border-green-700/50 hover:border-green-600/70 transition-all duration-200">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <UserNameWithBadge 
                                name={b.passengerDetails?.fullName || (b.passengerDetails as any)?.displayName || 'Unknown Student'} 
                                verified={isUserVerified(b.passengerDetails)}
                                size="md"
                                truncate
                              />
                            </div>
                          </div>
                          <div className="space-y-2 text-xs text-slate-400">
                            <div className="flex items-start gap-2">
                              <MapPin className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                              <span className="text-slate-300 line-clamp-2">
                                {formatPickupLabel(b as any)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 ml-5">
                              <span className="text-slate-400">Price: </span>
                              <span className="font-semibold text-primary">PKR {(b.ride as any)?.price ?? (b as any).price ?? ride.price}</span>
                            </div>
                            <div className="flex items-center gap-2 ml-5 text-slate-500">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{((b.ride?.departureTime?.seconds ?? ride.departureTime?.seconds) && new Date((b.ride?.departureTime?.seconds ?? ride.departureTime?.seconds) * 1000).toLocaleString('en-US', { 
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })) || 'Time TBD'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {(b.passengerDetails as any)?.phone ? (
                            <a href={`tel:${(b.passengerDetails as any).phone}`} className="text-xs px-3 py-1.5 rounded-md bg-blue-600/90 hover:bg-blue-700 text-white font-medium transition-colors">Call</a>
                          ) : null}
                          {((b as any).chatId || b.id) ? (
                            <ChatButton chatId={(b as any).chatId || b.id} university={university} label="Chat" />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending Confirmation: accepted but not yet confirmed */}
              {acceptedBookings && acceptedBookings.filter(b => b.status === 'accepted').length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 relative">
                    <Clock className="h-5 w-5 text-amber-500" />
                    <h4 className="font-bold text-sm text-white">Pending Confirmation</h4>
                    <Badge className="bg-amber-600/80 text-white text-xs py-0.5 px-2">{acceptedBookings.filter(b => b.status === 'accepted').length}</Badge>
                    {getUnreadForRide(ride.id) > 0 && (
                      <NotificationBadge count={getUnreadForRide(ride.id)} dot className="ml-auto" position="inline" />
                    )}
                  </div>
                  {acceptedBookings.filter(b => b.status === 'accepted').map((b) => (
                    <div key={b.id} className="p-4 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-all duration-200">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <UserNameWithBadge 
                                name={b.passengerDetails?.fullName || (b.passengerDetails as any)?.displayName || 'Unknown Student'} 
                                verified={isUserVerified(b.passengerDetails)}
                                size="md"
                                truncate
                              />
                            </div>
                            <Badge className="bg-amber-600/80 text-white text-[10px] py-0 px-1.5">Awaiting Confirmation</Badge>
                          </div>
                          <div className="space-y-2 text-xs text-slate-400">
                            <div className="flex items-start gap-2">
                              <MapPin className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                              <span className="text-slate-300 line-clamp-2">
                                {formatPickupLabel(b as any)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 ml-5">
                              <span className="text-slate-400">Price: </span>
                              <span className="font-semibold text-primary">PKR {(b.ride as any)?.price ?? (b as any).price ?? ride.price}</span>
                            </div>
                            <div className="flex items-center gap-2 ml-5 text-slate-500">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{((b.ride?.departureTime?.seconds ?? ride.departureTime?.seconds) && new Date((b.ride?.departureTime?.seconds ?? ride.departureTime?.seconds) * 1000).toLocaleString('en-US', { 
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })) || 'Time TBD'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {(b.passengerDetails as any)?.phone ? (
                            <a href={`tel:${(b.passengerDetails as any).phone}`} className="text-xs px-3 py-1.5 rounded-md bg-blue-600/90 hover:bg-blue-700 text-white font-medium transition-colors">Call</a>
                          ) : null}
                          {((b as any).chatId || b.id) ? (
                            <ChatButton chatId={(b as any).chatId || b.id} university={university} label="Chat" />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>

            <CardFooter className="p-0 mt-2">
              <div className="flex justify-end w-full">
                <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="flex items-center gap-2" disabled={!user || user.uid !== ride.driverId} title={!user ? 'Sign in to delete this ride' : user.uid !== ride.driverId ? 'You are not the owner of this ride' : ''}>
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
                      <Button variant="destructive" onClick={handleDeleteRide} disabled={isDeleting || acceptedCount > 0}>
                        {isDeleting ? 'Deleting...' : 'Delete Ride'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardFooter>
        </Card>
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

  // Only create query if we have ALL required data (user, firestore, AND userData with university)
  // Query by driverId to get rides offered by the current user
  // NOTE: All rides should have driverId set (canonical field)
  // createdBy is kept for backwards compatibility but queries use driverId
  const ridesQuery = (user && firestore && userData && userData.university) ? query(
    collection(firestore, 'universities', userData.university, 'rides'),
    where('driverId', '==', user.uid)
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

  // Filter out rides that are 12+ hours past departure (should be auto-deleted)
  const filteredRides = React.useMemo(() => {
    if (!rides) return [];
    const twelveHoursMs = 12 * 60 * 60 * 1000;
    const now = Date.now();
    
    const filtered = rides.filter((ride) => {
      // Get timestamp in milliseconds (handles Timestamp, Date, number, etc.)
      const departureMs = getTimestampMs(ride.departureTime);
      
      // Log filter decisions for rides that fail
      if (departureMs === null) {
        console.warn(`[My Rides] Ride ${ride.id} has invalid departureTime:`, ride.departureTime);
        // Include rides with invalid timestamps - let server-side deletion handle cleanup
        return true;
      }
      
      const isExpired = (now - departureMs) >= twelveHoursMs;
      if (isExpired) {
        console.debug(`[My Rides] Filtering out expired ride ${ride.id}: departure was ${Math.round((now - departureMs) / 1000 / 60)} minutes ago`);
      }
      
      return !isExpired;
    });
    
    if (filtered.length < rides.length) {
      console.log(`[My Rides] Filtered ${rides.length - filtered.length} expired ride(s)`);
    }
    
    return filtered;
  }, [rides]);

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
          <p className="text-slate-300">Track and manage your active ride offers</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {ridesWithStatus
          .sort((a: RideType, b: RideType) => {
            const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.toMillis?.() ?? 0;
            const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.toMillis?.() ?? 0;
            return bTime - aTime; // descending order
          })
          .map((ride: RideType) => (
            <MyRideCard key={ride.id} ride={ride} university={userData!.university} />
          ))}
        </div>
      </div>
    </div>
  );
}


// ---- helpers ----
// Error boundary to catch and surface Leaflet initialization errors (e.g., double-init in Strict Mode)
class MapErrorBoundary extends React.Component<{ children: React.ReactNode, onMapError?: () => void }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    // Only handle the known Leaflet double-init error; rethrow others to bubble up.
    const message = String(error?.message || error);
    if (message.includes('Map container is already initialized') || message.includes('Map container is being reused')) {
      console.warn('Map initialization error caught by MapErrorBoundary:', message);
      this.props.onMapError?.();
    } else {
      throw error;
    }
  }

  render() {
    if (this.state.hasError) {
      // Render nothing — parent will decide when to retry mounting the map
      return null;
    }
    return this.props.children;
  }
}

function RouteDialogButton({ ride, pickupPoints }: { ride: RideType, pickupPoints: LatLngExpression[] }) {
  const [open, setOpen] = React.useState(false);
  // When opening the dialog, wait one tick before mounting the MapContainer. This avoids
  // react-leaflet/leaflet double-init errors caused by React Strict Mode (dev) mounting
  // the component twice in quick succession.
  const [showMap, setShowMap] = React.useState(false);
  // Track retries to apply a short backoff when initialization fails
  const [retryCount, setRetryCount] = React.useState(0);
  const retryCountRef = React.useRef<number>(retryCount);
  const [resetKey, setResetKey] = React.useState(0);
  const [autoRetryDisabled, setAutoRetryDisabled] = React.useState(false);
  const MAX_RETRIES = 3;

  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  // Normalize route and markers to mirror the create-ride map
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

  const boundsFromRide = React.useMemo(() => {
    const b = (ride as any).routeBounds;
    if (b && typeof b.minLat === 'number' && typeof b.maxLat === 'number' && typeof b.minLng === 'number' && typeof b.maxLng === 'number') {
      return L.latLngBounds([b.minLat, b.minLng], [b.maxLat, b.maxLng]);
    }
    if (routeLatLngs.length) return L.latLngBounds(routeLatLngs as any);
    return undefined;
  }, [ride, routeLatLngs]);

  const decoratedMarkers = React.useMemo(() => {
    const markers: any[] = [];
    if (routeLatLngs.length) {
      markers.push({ lat: routeLatLngs[0].lat, lng: routeLatLngs[0].lng, label: 'Start' });
      if (routeLatLngs.length > 1) {
        const end = routeLatLngs[routeLatLngs.length - 1];
        markers.push({ lat: end.lat, lng: end.lng, label: 'Destination' });
      }
    }
    pickupPoints.forEach((p: any, idx: number) => {
      if (Array.isArray(p) && p.length >= 2) {
        markers.push({ lat: Number(p[0]), lng: Number(p[1]), label: `Pickup ${idx + 1}` });
      } else if (p && typeof p.lat === 'number' && typeof p.lng === 'number') {
        markers.push({ lat: p.lat, lng: p.lng, label: `Pickup ${idx + 1}` });
      }
    });
    return markers as LatLngExpression[];
  }, [pickupPoints, routeLatLngs]);

  const cleanupMapContainer = React.useCallback(() => {
    const node = wrapperRef.current;

    // Remove any leaflet container inside the wrapper
      if (node) {
      const existing = node.querySelector('.leaflet-container');
      if (existing) {
        try {
          // Remove Leaflet's internal id so future inits don't think the container is already in use
          try { delete (existing as any)._leaflet_id; } catch (e) {}
          // Do not remove DOM children; leave React-managed nodes intact. Deleting
          // the internal id is sufficient to allow a fresh map initialization.
        } catch (err) {
          console.warn('Failed to safely clear existing leaflet container in wrapper:', err);
        }
      }
    }
  }, []);

  React.useEffect(() => {
    let t: number | undefined;
    let t2: number | undefined;
    if (open) {
      // Use a small delay to give React/Leaflet time to cleanly unmount during Strict Mode re-mounts
      // and to avoid racing with Leaflet's container initialization. Apply a backoff when retrying.
      // We intentionally omit `cleanupMapContainer` from the dependency list to keep the deps array
      // size constant across renders (it has stable identity). See note below.
      const baseDelay = retryCountRef.current === 0 ? 100 : Math.min(500 * retryCountRef.current, 2000);
      t = window.setTimeout(() => {
        // Call the stable cleanup function (defined with empty deps) to remove lingering containers
        cleanupMapContainer();
        // Give the browser a moment to settle the DOM after cleanup before mounting the map
        t2 = window.setTimeout(() => setShowMap(true), 20);
      }, baseDelay);
    } else {
      // Immediately unmount map when dialog closes so Leaflet can cleanup
      setShowMap(false);
      // Reset retry counter when closed
      setRetryCount(0);
      retryCountRef.current = 0;
      setAutoRetryDisabled(false);
    }
    return () => {
      if (t) clearTimeout(t);
      if (t2) clearTimeout(t2);
    };
    // `cleanupMapContainer` has a stable identity; omitting it prevents dep-array size changes in dev
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Called by the MapErrorBoundary when Leaflet throws the double-init error.
  const handleMapError = React.useCallback(() => {
    console.debug('[RouteDialogButton] Map error caught; scheduling cleanup and retry', { retryCount: retryCountRef.current });

    // If we've exceeded the max retries, stop auto retry and show manual reset UI
    if (retryCountRef.current + 1 > MAX_RETRIES) {
      console.warn('[RouteDialogButton] Max retries exceeded; disabling automatic retries');
      setShowMap(false);
      setAutoRetryDisabled(true);
      setRetryCount((c) => { const next = c + 1; retryCountRef.current = next; return next; });
      return;
    }

    // Unmount map and retry after a brief backoff, but limit attempts to avoid loops
    setShowMap(false);
    setRetryCount((c) => { const next = c + 1; retryCountRef.current = next; return next; });
    const backoff = Math.min(500 * (retryCountRef.current), 2000);
    window.setTimeout(() => {
      cleanupMapContainer();
      setShowMap(true);
    }, backoff);
  }, [cleanupMapContainer]);

  const resetMap = React.useCallback(() => {
    console.debug('[RouteDialogButton] Manual map reset triggered');
    cleanupMapContainer();
    setShowMap(false);
    setAutoRetryDisabled(false);
    setRetryCount(0);
    retryCountRef.current = 0;
    setResetKey((k) => k + 1);
    window.setTimeout(() => setShowMap(true), 100);
  }, [cleanupMapContainer]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <MapPin className="mr-2 h-4 w-4" /> View Route & Pickups
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
            <DialogTitle>Your Route & Passenger Pickups</DialogTitle>
            <DialogDescription>
              View the route for your ride and see where passengers will be picked up along the way.
            </DialogDescription>
        </DialogHeader>
        <div className="h-[60vh] w-full relative" ref={wrapperRef}>
          {showMap && (
            <MapErrorBoundary key={`map-error-${ride.id}-${resetKey}`} onMapError={handleMapError}>
              <div className="h-full w-full" style={{ height: '100%' }}>
                <MapLeaflet
                  key={`myride-map-${ride.id}-${resetKey}`}
                  route={routeLatLngs as LatLngExpression[]}
                  markers={decoratedMarkers}
                  bounds={boundsFromRide}
                  style={{ height: '100%', width: '100%' }}
                  // Match create-ride map styling and give a reliable tile source
                  tileUrl="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  tileAttribution="&copy; OpenStreetMap contributors"
                  routeColor="#60A5FA"
                />
              </div>
            </MapErrorBoundary>
          )}

          {(!showMap && retryCount > 0 && !autoRetryDisabled) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-surface/80 p-4 rounded-md text-sm">
                Failed to initialize map. Retrying... ({retryCount})
              </div>
            </div>
          )}

          {autoRetryDisabled && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="bg-surface/80 p-4 rounded-md text-sm">Failed to initialize map after multiple attempts.</div>
              <div className="flex gap-2">
                <Button onClick={resetMap} size="sm">Reset Map</Button>
                <Button size="sm" variant="outline" onClick={() => { setShowMap(false); setOpen(false); }}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
