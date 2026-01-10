'use client';

import { collection, query, where, orderBy, doc, writeBatch, runTransaction, getDocs, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Check, MapPin, X, Trash } from 'lucide-react';
import { useCollection as useBookingCollection } from '@/firebase/firestore/use-collection';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import L, { LatLngExpression } from 'leaflet';
import { Ride as RideType, Booking as BookingType } from '@/lib/types';
import MapLeaflet from '@/components/MapLeaflet';
import ChatButton from '@/components/chat/ChatButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import React from 'react';

// Fix for default icon not showing in Leaflet
if (typeof window !== 'undefined') {
  try {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/marker-icon-2x.png',
      iconUrl: '/marker-icon.png',
      shadowUrl: '/marker-shadow.png',
    });
  } catch (e) {}
}

// Small helper: truncate string to n characters with ellipsis
function truncateChars(s?: string | null, n = 30) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '...' : s;
}

function BookingRequests({ ride, university, onProcessed }: { ride: RideType, university: string, onProcessed?: (bookingId: string, status: 'accepted' | 'rejected') => void }) {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Read requests from the ride-scoped `requests` subcollection so ride owners
  // can safely list only requests for their ride (rules allow listing here).
  const bookingsQuery = firestore ? query(
    collection(firestore, `universities/${university}/rides/${ride.id}/requests`),
    where('status', '==', 'pending')
  ) : null;

  const { data: bookings, loading } = useBookingCollection<BookingType>(bookingsQuery, { includeUserDetails: 'passengerId' });
  const [processingIds, setProcessingIds] = React.useState<string[]>([]);
  const [shownBookings, setShownBookings] = React.useState<BookingType[]>([]);

  // Keep local shown list in sync with upstream bookings, but allow optimistic
  // removal immediately after an accept/reject so the UI does not permit
  // duplicate accepts while waiting for Firestore listeners to update.
  React.useEffect(() => {
    if (!bookings) return setShownBookings([]);
    setShownBookings(bookings);
  }, [bookings]);

  const handleBooking = async (booking: BookingType, newStatus: 'accepted' | 'rejected') => {
    if (!firestore) return;
    if (!booking?.id) return;

    // Prevent duplicate clicks
    if (processingIds.includes(booking.id)) return;
    setProcessingIds((s) => [...s, booking.id]);
    // Optimistically remove the booking from the shown list so the provider
    // sees immediate feedback and cannot accept/reject the same request twice.
    const previousShown = shownBookings;
    setShownBookings((s) => s.filter((b) => b.id !== booking.id));

    try {
      await runTransaction(firestore, async (transaction) => {
        const bookingRef = doc(firestore, `universities/${university}/bookings`, booking.id);
        const rideRef = doc(firestore, `universities/${university}/rides`, booking.rideId);
        const requestRef = doc(firestore, `universities/${university}/rides`, booking.rideId, 'requests', booking.id);
        const chatRef = doc(firestore, `universities/${university}/chats`, booking.id);

        // Re-read booking inside transaction and ensure it's still pending
        const bookingDoc = await transaction.get(bookingRef);
        if (!bookingDoc.exists()) throw new Error('Booking no longer exists');
        const bookingData = bookingDoc.data() as BookingType & { status?: string };
        if (bookingData.status !== 'pending') {
          // Nothing to do — another action already processed this booking
          return;
        }

        if (newStatus === 'accepted') {
          const rideDoc = await transaction.get(rideRef);
          if (!rideDoc.exists()) {
            throw new Error('Ride does not exist!');
          }
          const currentRideData = rideDoc.data() as RideType;
          // Prevent accepting when no seats remain
          const currentAvailable = (currentRideData.availableSeats ?? 0);
          if (currentAvailable <= 0) {
            throw new Error('No seats available');
          }
          const newAvailableSeats = currentAvailable - 1;

          // Include driver details and ride snapshot on the booking so the passenger
          // can view provider info even if /users read is restricted later.
          const driverDetails = currentRideData.driverInfo || null;
          const rideSnapshot = {
            id: rideDoc.id,
            driverId: currentRideData.driverId,
            from: currentRideData.from,
            to: currentRideData.to,
            departureTime: currentRideData.departureTime,
            price: currentRideData.price,
            route: currentRideData.route,
            driverInfo: currentRideData.driverInfo,
          } as Partial<RideType>;

          // Now perform the writes: set booking status and include driver/ride snapshot
          // Also create a chat room (id = booking.id) so passenger and provider can chat once accepted.
          const chatId = bookingDoc.id;
          const chatRef = doc(firestore, `universities/${university}/chats`, chatId);
          const chatData = {
            bookingId: bookingDoc.id,
            rideId: ride.id,
            passengerId: bookingData.passengerId,
            providerId: currentRideData.driverId,
            participants: [bookingData.passengerId, currentRideData.driverId],
            createdAt: serverTimestamp(),
            status: 'active'
          };
          transaction.set(chatRef, chatData);
          transaction.update(bookingRef, { status: newStatus, driverDetails, ride: rideSnapshot, chatId });
          // Mirror status and metadata to the ride-scoped request doc as well
          transaction.update(requestRef, { status: newStatus, driverDetails, ride: rideSnapshot, chatId });
          transaction.update(rideRef, {
            availableSeats: newAvailableSeats,
            ...(newAvailableSeats === 0 && { status: 'full' })
          });
        } else {
          transaction.update(bookingRef, { status: newStatus });
          transaction.update(requestRef, { status: newStatus });
          // If a chat exists for this booking (unlikely on reject), remove it to keep chats temporary
          const chatDoc = await transaction.get(chatRef);
          if (chatDoc.exists()) {
            transaction.delete(chatRef);
          }
        }
      });

      onProcessed?.(booking.id, newStatus);

      toast({
        title: `Booking ${newStatus}`,
        description: `The request has been ${newStatus}.`
      });

    } catch (error) {
      console.error(`Error ${newStatus} booking:`, error);
      // Roll back optimistic UI change so the provider can retry or see the request again
      setShownBookings(previousShown);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong. Please try again.'
      });
    } finally {
      setProcessingIds((s) => s.filter((id) => id !== booking.id));
    }
  };

  if (loading) return <div className="space-y-2 mt-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>;
  if (!bookings || bookings.length === 0) return <p className="text-muted-foreground text-sm mt-4">No pending requests.</p>

  return (
    <div className="mt-4 space-y-3">
      <h4 className="font-semibold">Booking Requests</h4>
      {shownBookings.map((booking: any) => (
        <div key={booking.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
          <div>
            <p className="font-medium">{booking.passengerDetails?.fullName}</p>
            {booking.passengerDetails?.phone ? (
              <p className="text-sm text-muted-foreground">{booking.passengerDetails.phone}</p>
            ) : null}
             {booking.pickupPoint && (
              <p className="text-xs text-accent flex items-center mt-1">
                <MapPin className="h-3 w-3 mr-1"/> Pickup Requested
              </p>
             )}
          </div>
          <div className="flex gap-2">
            <Button size="icon" variant="outline" className="h-8 w-8 bg-green-500/10 text-green-500 hover:bg-green-500/20" onClick={() => handleBooking(booking, 'accepted')} disabled={processingIds.includes(booking.id)}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" className="h-8 w-8 bg-red-500/10 text-red-500 hover:bg-red-500/20" onClick={() => handleBooking(booking, 'rejected')} disabled={processingIds.includes(booking.id)}>
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

    const acceptedBookingsQuery = firestore ? query(
        collection(firestore, `universities/${university}/bookings`),
        where('rideId', '==', ride.id),
        where('status', '==', 'accepted')
    ) : null;
    const { data: acceptedBookings } = useBookingCollection<BookingType>(acceptedBookingsQuery);

    const pickupPoints = acceptedBookings?.map(b => b.pickupPoint).filter(Boolean) as LatLngExpression[] || [];
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
        const rideDoc = rideSnap.data() as RideType & { createdBy?: string };

        // Fail fast with a clear message if the authenticated user is not the creator
        if (!user || rideDoc.createdBy !== user.uid) {
          toast({ variant: 'destructive', title: 'Not allowed', description: `You are not the creator of this ride (createdBy: ${rideDoc.createdBy || 'unknown'}) and cannot delete it.` });
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
            const createdBy = rSnap.exists() ? (rSnap.data() as any).createdBy : 'unknown';
            toast({ variant: 'destructive', title: 'Could not delete ride', description: `Missing or insufficient permissions. Creator: ${createdBy}. Ensure your account has access or run the Firestore emulator to test rules (see docs/firestore-rules.md).` });
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
        <Card className="p-3">
            <CardHeader className="p-0 mb-2">
              <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm font-semibold">{truncateChars(ride.from, 30)} → {truncateChars(ride.to, 30)}</CardTitle>
                    <CardDescription className="truncate text-xs text-slate-300">{new Date(ride.departureTime.seconds * 1000).toLocaleString()}</CardDescription>
                  </div>
                   <Badge variant={ride.status === 'active' ? 'default' : ride.status === 'full' ? 'destructive' : 'secondary'} className="text-xs">{ride.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                <div>
                  <div className="text-[0.85rem] text-white font-medium">PKR {ride.price}</div>
                  <div className="text-[0.72rem]">Seats Left: <span className="font-medium text-white">{availableSeats}</span></div>
                </div>
                <div className="text-right">
                  <div className="text-[0.72rem]">{ride.genderAllowed === 'Both Men & Women' ? 'Both' : (String(ride.genderAllowed).includes('Men') ? 'Men' : String(ride.genderAllowed).includes('Women') ? 'Women' : ride.genderAllowed)}</div>
                </div>
              </div>

              <div className="mb-2">
                {ride.route && ride.route.length > 0 && (
                  <RouteDialogButton ride={ride} pickupPoints={pickupPoints} />
                )}
              </div>

              <BookingRequests ride={ride} university={university} onProcessed={(bookingId, status) => {
                if (status === 'accepted') {
                  setAvailableSeats((s) => Math.max(0, s - 1));
                }
              }} />

              {/* Accepted Passengers: show denormalized passenger & ride details so driver can contact and verify pickups */}
              {acceptedBookings && acceptedBookings.length > 0 && (
                <div className="mt-3 space-y-2">
                  <h4 className="font-semibold text-sm">Accepted Passengers</h4>
                  {acceptedBookings.map((b) => (
                    <div key={b.id} className="p-2 bg-secondary rounded-md text-sm flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate">{b.passengerDetails?.fullName || b.passengerDetails?.displayName || 'Unknown Student'}</div>
                        <div className="text-xs text-slate-300 truncate">{b.passengerDetails?.fullName ? '' : ''}</div>
                        <div className="text-xs text-accent mt-1">
                          {b.pickupPlaceName || (b.pickupPoint ? `${(b.pickupPoint as any).lat?.toFixed?.(4) || ''}, ${(b.pickupPoint as any).lng?.toFixed?.(4) || ''}` : 'Pickup not set')}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Price: PKR {b.ride?.price ?? b.price ?? ride.price}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {b.passengerDetails?.phone ? (
                          <a href={`tel:${b.passengerDetails.phone}`} className="text-[0.72rem] px-2 py-1 rounded bg-primary/90 text-primary-foreground">Call</a>
                        ) : null}
                        <div className="mt-2 flex flex-col items-end gap-2">
                          {b.chatId ? (
                            <ChatButton chatId={b.chatId} university={university} label="Chat" />
                          ) : null}
                        </div>
                        <div className="text-[0.7rem] text-slate-400">{new Date((b.ride?.departureTime?.seconds ?? ride.departureTime.seconds) * 1000).toLocaleString()}</div>
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


export default function MyRidesPage() {
  const { user, data: userData, loading: userLoading } = useUser();
  const firestore = useFirestore();

  const ridesQuery = (user && firestore && userData) ? query(
    collection(firestore, 'universities', userData.university, 'rides'),
    where('driverId', '==', user.uid),
    orderBy('createdAt', 'desc')
  ) : null;

  const { data: rides, loading: ridesLoading } = useCollection<RideType>(ridesQuery);
  const loading = userLoading || ridesLoading;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!rides || rides.length === 0) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold">No Rides Offered</h2>
        <p className="text-muted-foreground">You have not offered any rides yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-headline font-bold mb-6">My Offered Rides</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {rides.map((ride: RideType) => (
          <MyRideCard key={ride.id} ride={ride} university={userData!.university} />
        ))}
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
        </DialogHeader>
        <div className="h-[60vh] w-full relative" ref={wrapperRef}>
          {showMap && (
            <MapErrorBoundary key={`map-error-${ride.id}-${resetKey}`} onMapError={handleMapError}>
              <div className="h-full w-full" style={{ height: '100%' }}>
                <MapLeaflet
                  key={`myride-map-${ride.id}-${resetKey}`}
                  route={ride.route as LatLngExpression[]}
                  markers={pickupPoints as LatLngExpression[]}
                  bounds={L.latLngBounds(ride.route as LatLngExpression[])}
                  style={{ height: '100%', width: '100%' }}
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
