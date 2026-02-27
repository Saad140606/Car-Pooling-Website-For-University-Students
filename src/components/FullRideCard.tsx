"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RideCard from './RideCard';
import RideDetailModal from './RideDetailModal';
import StopsViewer from './StopsViewer';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import L, { LatLng, LatLngExpression } from 'leaflet';
import { MapContainer, TileLayer, Marker, CircleMarker, Polyline, useMapEvents, Tooltip } from '@/components/map';
import { runTransaction, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { decodePolyline } from '@/lib/route';
import { detectUniversityFromString } from '@/lib/universities';
import { parseTimestamp } from '@/lib/timestampUtils';
import { CancellationConfirmDialog } from '@/components/CancellationConfirmDialog';
import { openGoogleMapsRoute } from '@/lib/googleMapsRoute';

function MapEvents({ onSelect }: { onSelect: (pt: LatLng) => void }) {
  useMapEvents({ click(e: L.LeafletMouseEvent) { onSelect(e.latlng); } });
  return null;
}

export default function FullRideCard({ ride, user, userData, firestore, myBookings, openBookingOnMount, selectedUniversity }: { ride: any; user: any; userData: any; firestore: any; myBookings?: any[]; openBookingOnMount?: boolean; selectedUniversity?: string }) {
  const router = useRouter();
  const [openDetail, setOpenDetail] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [openBook, setOpenBook] = useState(false);
  const [openStops, setOpenStops] = useState(false);
  const [pickupPoint, setPickupPoint] = useState<LatLng | null>(null);
  const [pickupPlaceName, setPickupPlaceName] = useState<string | null>(null);
  const [pickupPlaceLoading, setPickupPlaceLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const { toast } = useToast();
  const [confirmCountdown, setConfirmCountdown] = useState<string | null>(null);
  const [showConfirmWarning, setShowConfirmWarning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const normalizeStopsInput = useCallback((raw: any) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') return Object.values(raw);
    return [];
  }, []);

  const [stopsForViewer, setStopsForViewer] = useState<any[]>(() => normalizeStopsInput(ride.stops));

  const isDriver = user && ride.driverId === user.uid;
  const isFull = (ride.availableSeats ?? 0) <= 0;

  const existingBooking = (myBookings || []).find((b: any) => b.rideId === ride.id);

  useEffect(() => {
    setStopsForViewer(normalizeStopsInput(ride.stops));
  }, [ride.stops, normalizeStopsInput]);

  useEffect(() => {
    if (!openStops) return;

    const refreshStops = async () => {
      const fallbackStops = normalizeStopsInput(ride.stops);
      console.log('[FullRideCard] View Stops opened. Local stops:', fallbackStops.length);
      setStopsForViewer(fallbackStops);

      if (!firestore || !ride?.id) return;
      const university = ride.university || selectedUniversity || userData?.university;
      if (!university) return;

      try {
        const rideRef = doc(firestore, `universities/${university}/rides`, ride.id);
        const snap = await getDoc(rideRef);
        if (snap.exists()) {
          const data = snap.data();
          const latestStops = normalizeStopsInput(data?.stops);
          console.log('[FullRideCard] Refreshed stops from Firestore:', latestStops.length);
          setStopsForViewer(latestStops);
        }
      } catch (err) {
        console.warn('[FullRideCard] Failed to refresh stops from Firestore:', err);
      }
    };

    refreshStops();
  }, [openStops, firestore, ride?.id, ride?.stops, ride?.university, selectedUniversity, userData?.university, normalizeStopsInput]);

  const [existingRequest, setExistingRequest] = useState<any | null>(null);
  const [existingChecked, setExistingChecked] = useState(false);

  useEffect(() => {
    if (openBookingOnMount) {
      setOpenBook(true);
    }
    let mounted = true;
    (async () => {
      setExistingChecked(false);
      try {
        if (!firestore || !userData || !user) {
          if (mounted) setExistingRequest(null);
          if (mounted) setExistingChecked(true);
          return;
        }
        const requestId = `${ride.id}_${user.uid}`;
        const reqRef = doc(firestore, `universities/${userData.university}/rides`, ride.id, 'requests', requestId);
        const snap = await getDoc(reqRef);
        if (!mounted) return;
        setExistingRequest(snap.exists() ? snap.data() : null);
      } catch (e) {
        // ignore
        if (mounted) setExistingRequest(null);
      } finally {
        if (mounted) setExistingChecked(true);
      }
    })();
    return () => { mounted = false; };
  }, [firestore, userData, user, ride.id]);

  const genderMismatch = ride.genderAllowed && ride.genderAllowed !== 'both' && userData?.gender && userData.gender !== ride.genderAllowed;
  const existingRequestStatus = existingRequest ? existingRequest.status : null;
  const bookingStatus = existingBooking ? existingBooking.status : null;
  // CRITICAL FIX: Define active statuses whitelist (not blacklist)
  const activeStatuses = ['pending', 'PENDING', 'accepted', 'ACCEPTED', 'confirmed', 'CONFIRMED', 'ongoing', 'ONGOING'];
  // Only treat accepted when a booking exists and is accepted. Pending requests should show pending.
  const isAcceptedBooking = bookingStatus === 'accepted' || bookingStatus === 'ACCEPTED';
  const isConfirmedBooking = bookingStatus === 'CONFIRMED' || bookingStatus === 'confirmed';
  const isPendingRequest = existingRequestStatus === 'pending' || existingRequestStatus === 'PENDING';
  const isRejectedRequest = existingRequestStatus === 'rejected' || existingRequestStatus === 'REJECTED';
  const isAcceptedRequest = existingRequestStatus === 'ACCEPTED' || existingRequestStatus === 'accepted';

  const disabledReason = isDriver ? "Can't book own ride"
    : isFull ? 'Ride is full'
    : genderMismatch ? `Reserved for ${ride.genderAllowed} riders`
    : isConfirmedBooking ? `You have already confirmed this ride`
    : isAcceptedBooking ? `You already requested this ride (accepted)`
    : isPendingRequest ? `You already requested this ride (pending)`
    : undefined;

  // Smart countdown for accepted request confirmation window
  // Respects dynamic timer based on pickup time (short/medium/none)
  useEffect(() => {
    if (!isAcceptedRequest || !existingRequest?.confirmDeadline) { setConfirmCountdown(null); return; }
    const getMs = (t: any) => {
      if (!t) return 0;
      if (typeof t.toDate === 'function') return t.toDate().getTime();
      return new Date(t).getTime();
    };
    
    const deadlineMs = getMs(existingRequest.confirmDeadline);
    const timerType = existingRequest.timerType || 'short';
    const confirmLater = existingRequest.confirmLater || false;
    
    // If rider chose "confirm later", show different message instead of countdown
    if (confirmLater) {
      setConfirmCountdown('waiting'); // special value for "confirm later" state
      return;
    }
    
    // For "none" timer type (future rides), don't show countdown timer
    if (timerType === 'none') {
      setConfirmCountdown(null);
      return;
    }
    
    // Show countdown for short/medium timer types
    const tick = () => {
      const remain = Math.max(0, deadlineMs - Date.now());
      const mm = Math.floor(remain / 60000);
      const ss = Math.floor((remain % 60000) / 1000);
      setConfirmCountdown(`${mm}:${ss.toString().padStart(2,'0')}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [isAcceptedRequest, existingRequest?.confirmDeadline, existingRequest?.timerType, existingRequest?.confirmLater]);

  // geometry helpers (approx meters)
  const toMeters = (latlng: { lat: number; lng: number }) => {
    const latRad = (latlng.lat * Math.PI) / 180;
    const x = latlng.lng * 111320 * Math.cos(latRad);
    const y = latlng.lat * 110540;
    return { x, y };
  };
  const pointToSegmentDistanceMeters = (p: LatLng, a: LatLng, b: LatLng) => {
    const P = toMeters({ lat: p.lat, lng: p.lng });
    const A = toMeters({ lat: a.lat, lng: a.lng });
    const B = toMeters({ lat: b.lat, lng: b.lng });
    const vx = B.x - A.x;
    const vy = B.y - A.y;
    const l2 = vx * vx + vy * vy;
    if (l2 === 0) return Math.hypot(P.x - A.x, P.y - A.y);
    let t = ((P.x - A.x) * vx + (P.y - A.y) * vy) / l2;
    t = Math.max(0, Math.min(1, t));
    const projx = A.x + t * vx;
    const projy = A.y + t * vy;
    return Math.hypot(P.x - projx, P.y - projy);
  };
  const isPointNearRoute = (point: LatLng, route: LatLngExpression[], tolerance = 0.003) => {
    const tolMeters = tolerance * 111320;
    for (let i = 0; i < route.length - 1; i++) {
      const start = L.latLng(route[i] as LatLng);
      const end = L.latLng(route[i + 1] as LatLng);
      const d = pointToSegmentDistanceMeters(point, start as any, end as any);
      if (d < tolMeters) return true;
    }
    return false;
  };

  const handleSelectPickup = useCallback((pt: LatLng) => {
    if (!ride.route || !ride.route.length) return;
    if (isPointNearRoute(pt, ride.route as LatLngExpression[])) {
      setPickupPoint(pt);
    } else {
      toast({ variant: 'destructive', title: 'Invalid Pickup Point', description: 'Please select a point on or very near the route.' });
    }
  }, [ride.route, toast]);

  // Reverse-geocode whenever a pickup point is selected so we can show a friendly name
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!pickupPoint) {
        if (mounted) {
          setPickupPlaceName(null);
          setPickupPlaceLoading(false);
        }
        return;
      }
      if (mounted) {
        setPickupPlaceLoading(true);
        setPickupPlaceName(null);
      }
      try {
        // Get auth token for API call
        let headers: HeadersInit = {};
        if (user) {
          try {
            const token = await user.getIdToken();
            if (token) headers = { 'Authorization': `Bearer ${token}` };
          } catch (e) {
            console.warn('Could not get auth token for reverse geocode', e);
          }
        }
        
        const res = await fetch(`/api/nominatim/reverse?lat=${encodeURIComponent(pickupPoint.lat)}&lon=${encodeURIComponent(pickupPoint.lng)}`, { headers });
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          if (mounted) setPickupPlaceName(data.display_name || null);
        } else {
          console.error('Reverse geocode failed', res.status);
          if (mounted) setPickupPlaceName(null);
        }
      } catch (e) {
        console.error('Reverse geocode error', e);
        if (mounted) setPickupPlaceName(null);
      } finally {
        if (mounted) setPickupPlaceLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [pickupPoint, user]);

  const handleBook = async (pt?: LatLng) => {
    if (!user || !firestore) {
      router.push('/auth/select-university');
      return false;
    }
    if (!userData || !userData.university) {
      toast({ variant: 'destructive', title: 'Profile incomplete', description: 'Please complete your profile and select your university before booking.' });
      return false;
    }
    if (!existingChecked) {
      toast({ variant: 'destructive', title: 'Please wait', description: 'Checking previous request status...' });
      return false;
    }
    if (isDriver) {
      toast({ variant: 'destructive', title: "Can't book own ride" });
      return false;
    }
    // Re-check the authoritative docs to avoid stale local state causing false positives
    try {
      const requestId = `${ride.id}_${user.uid}`;
      const reqRef = doc(firestore, `universities/${userData.university}/rides`, ride.id, 'requests', requestId);
      const reqSnap = await getDoc(reqRef);
      const reqData = reqSnap.exists() ? (reqSnap.data() as any) : null;
      // CRITICAL FIX: Only block on ACTIVE statuses, not completed/rejected/cancelled
      if (reqData && reqData.status && activeStatuses.includes(reqData.status)) {
        toast({ variant: 'destructive', title: 'Already Requested', description: 'You have already requested this ride.' });
        return false;
      }

      const bookingRef = doc(firestore, `universities/${userData.university}/bookings`, requestId);
      const bSnap = await getDoc(bookingRef);
      const bData = bSnap.exists() ? (bSnap.data() as any) : null;
      // CRITICAL FIX: Only block on ACTIVE statuses, not completed/rejected/cancelled
      if (bData && bData.status && activeStatuses.includes(bData.status)) {
        toast({ variant: 'destructive', title: 'Already Requested', description: 'You have already requested this ride.' });
        return false;
      }
    } catch (e) {
      // If the re-check fails, fall back to local checks below
      console.debug('Failed to re-check existing request/booking:', e);
    }
    if (genderMismatch) {
      toast({ variant: 'destructive', title: 'Booking Not Allowed', description: `This ride is reserved for ${ride.genderAllowed} riders.` });
      return false;
    }
    setLoading(true);
    const pickup = pt || pickupPoint;
    let pickupPlaceName: string | null = null;
    try {
      if (pickup) {
        const res = await fetch(`/api/nominatim/reverse?lat=${encodeURIComponent(pickup.lat)}&lon=${encodeURIComponent(pickup.lng)}`);
        if (res.ok) {
          const data = await res.json();
          pickupPlaceName = data.display_name || null;
        }
      }
    } catch (e) {}

    // Compute a tripKey to group concurrent requests (30-minute slot of departure day)
    let tripKey: string | null = null;
    try {
      const dep = ride.departureTime?.seconds ? new Date(ride.departureTime.seconds * 1000) : (ride.departureTime ? new Date(ride.departureTime) : null);
      if (dep) {
        const slot = Math.floor(dep.getTime() / (30 * 60 * 1000));
        const day = `${dep.getUTCFullYear()}-${(dep.getUTCMonth()+1).toString().padStart(2,'0')}-${dep.getUTCDate().toString().padStart(2,'0')}`;
        tripKey = `${day}:${slot}`;
      }
    } catch {}

    const requestData = {
      rideId: ride.id,
      driverId: ride.driverId,
      passengerId: user.uid,
      status: 'PENDING',
      createdAt: serverTimestamp(),
      pickupPoint: pickup ? { lat: pickup.lat, lng: pickup.lng } : null,
      pickupPlaceName,
      tripKey,
      passengerDetails: {
        uid: user.uid,
        fullName: userData?.fullName || '',
        email: user.email,
        gender: userData?.gender,
        contactNumber: userData?.contactNumber,
      }
    };

    try {
      await runTransaction(firestore, async (transaction) => {
        const rideRef = doc(firestore, `universities/${userData.university}/rides`, ride.id);
        const rideDoc = await transaction.get(rideRef);
        if (!rideDoc.exists() || rideDoc.data().availableSeats <= 0) {
          throw new Error('This ride is no longer available or is full.');
        }
        const requestId = `${ride.id}_${user.uid}`;
        const requestRef = doc(firestore, `universities/${userData.university}/rides`, ride.id, 'requests', requestId);
        const existingRequest = await transaction.get(requestRef);
        if (existingRequest.exists()) {
          const data: any = existingRequest.data();
          if (data && data.status && !['rejected','REJECTED','cancelled','CANCELLED','expired','EXPIRED','auto_cancelled','AUTO_CANCELLED'].includes((data.status as string))) {
            throw new Error('You have already requested a seat on this ride.');
          }
          // allow overwrite if previous request was rejected
        }
        const requestPayload = Object.assign({}, requestData, { bookingId: requestId });
        transaction.set(requestRef, requestPayload);
      });
      toast({ title: 'Request Sent!', description: 'The ride provider has been notified of your request.' });
      setOpenBook(false);
      setPickupPoint(null);
      setPickupPlaceName(null);
      return true;
    } catch (err: any) {
      if (err?.message?.includes('3 active requests')) {
        toast({ 
          variant: 'destructive', 
          title: 'Request Limit Reached', 
          description: 'Please confirm or cancel an existing request before requesting another ride.' 
        });
      } else {
        toast({ variant: 'destructive', title: 'Booking Failed', description: err?.message || String(err) });
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRequest = async () => {
    if (!user || !userData || !firestore || !existingRequest) return;
    setLoading(true);
    try {
      const res = await fetch('/api/requests/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university: userData.university,
          rideId: ride.id,
          requestId: `${ride.id}_${user.uid}`,
          passengerId: user.uid,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm');
      toast({ title: 'Ride Confirmed! 🎉', description: 'Your seat is now reserved. Other requests have been cancelled.' });
      setShowConfirmWarning(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Confirmation Failed', description: err?.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLater = async () => {
    if (!user || !userData || !firestore || !existingRequest) return;
    setLoading(true);
    try {
      const res = await fetch('/api/requests/confirm-later', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university: userData.university,
          rideId: ride.id,
          requestId: `${ride.id}_${user.uid}`,
          passengerId: user.uid,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to defer confirmation');
      toast({ title: 'Confirm Later ✅', description: 'You can confirm this ride later. We will remind you before pickup time.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Confirm Later Failed', description: err?.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!user || !userData || !firestore || !existingRequest) return;
    setCancelling(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/requests/cancel', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          university: userData.university,
          rideId: ride.id,
          requestId: `${ride.id}_${user.uid}`,
          cancelledBy: user.uid,
          reason: 'User cancelled',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          toast({ variant: 'destructive', title: 'Account Locked', description: data.message || 'Your account has been locked due to high cancellation rates.' });
        } else {
          throw new Error(data.error || 'Failed to cancel');
        }
      } else {
        toast({ title: 'Request Cancelled', description: 'Your request has been cancelled.' });
        setShowCancelDialog(false);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Cancellation Failed', description: err?.message || String(err) });
    } finally {
      setCancelling(false);
    }
  };

  // search helper
  useEffect(() => {
    const t = setTimeout(() => {
      if (!searchQuery || searchQuery.trim().length < 2) { setSearchResults([]); return; }
      (async () => {
        setSearching(true);
        try {
          const bounds = L.latLngBounds(ride.route as LatLngExpression[]);
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          const viewbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
          const res = await fetch(`/api/nominatim/search?q=${encodeURIComponent(searchQuery)}&viewbox=${encodeURIComponent(viewbox)}&limit=6`);
          if (!res.ok) { setSearchResults([]); setSearching(false); return; }
          const json = await res.json();
          setSearchResults(Array.isArray(json) ? json : []);
        } catch (e) { setSearchResults([]); }
        setSearching(false);
      })();
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, ride.route]);

  const start = ride.from;
  const end = ride.to;
  // Use centralized timestamp parser (silent mode avoids console spam in production)
  let departureDate: Date | null = null;
  try {
    departureDate = parseTimestamp(ride.departureTime, { silent: false });
    if (!departureDate) {
      console.error('[FullRideCard] ❌ Failed to parse departureTime for ride', ride.id, ':', ride.departureTime);
    }
  } catch (e) {
    console.error('[FullRideCard] ❌ Exception parsing departureTime:', e);
  }
  
  const departure = departureDate ? (
    (() => {
      try {
        return new Date(departureDate.getTime()).toISOString();
      } catch (e) {
        console.error('[FullRideCard] ❌ Failed to convert departureDate to ISO string:', e);
        return '';
      }
    })()
  ) : '';
  const isFromUniversity = !!detectUniversityFromString(start);

  return (
    <div className="w-full h-full">
      <RideCard
        startLocation={start}
        endLocation={end}
        rideDateTime={departure}
        price={ride.price}
        driverName={ride.driverInfo?.fullName || 'Provider'}
        seatsLeft={ride.availableSeats}
        genderPreference={ride.genderAllowed === 'both' ? 'Both' : ride.genderAllowed}
        dvr={ride.driverInfo?.dvr || 0}
        transport={ride.transportMode || ride.transport}
        university={ride.university}
        hideUniversity={userData?.university === ride.university}
        stops={stopsForViewer}
        driverVerified={ride.driverInfo?.isVerified || ride.driverInfo?.universityEmailVerified || false}
        statusLabel={isAcceptedRequest && confirmCountdown ? `Accepted — confirm within ${confirmCountdown}` : undefined}
        onViewRoute={() => setOpenView(true)}
        onViewStops={() => setOpenStops(true)}
        onCardClick={() => setOpenDetail(true)}
        onGoogleMaps={() => {
          const opened = openGoogleMapsRoute({
            route: ride.route,
            stops: ride.stops,
            fromName: ride.from,
            toName: ride.to,
            travelMode: ride.transportMode === 'bike' ? 'bicycling' : 'driving',
          });
          if (!opened) {
            toast({ variant: 'destructive', title: 'Route unavailable', description: 'No route data available for this ride.' });
          }
        }}
        onBook={() => {
          if (!user) {
            router.push('/auth/select-university');
            return;
          }
          setOpenBook(true);
        }}
        disabled={!existingChecked ? true : !!disabledReason}
        disabledReason={!existingChecked ? 'Checking...' : disabledReason}
          />

      {/* Read-only route viewer */}
      <Dialog open={openView} onOpenChange={setOpenView}>
        <DialogTrigger asChild>
          <div />
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Route from {start} to {end}</DialogTitle>
          </DialogHeader>
          <div className="h-[60vh] w-full relative">
            <MapContainer bounds={L.latLngBounds(ride.route as LatLngExpression[])} style={{ height: '60vh', width: '100%' }}>
          <p className="sr-only" id="route-desc">Route preview for selected ride.</p>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
              <Polyline positions={ride.route as LatLngExpression[]} color="#60A5FA" weight={4} opacity={0.9} />
              {ride.route && ride.route.length > 0 && (
                <>
                  <Marker 
                    position={ride.route[0] as any}
                    icon={L.icon({
                      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [1, -34],
                      shadowSize: [41, 41]
                    })}
                  >
                    <Tooltip>Start: {start}</Tooltip>
                  </Marker>
                  <Marker 
                    position={ride.route[ride.route.length - 1] as any}
                    icon={L.icon({
                      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [1, -34],
                      shadowSize: [41, 41]
                    })}
                  >
                    <Tooltip>End: {end}</Tooltip>
                  </Marker>
                </>
              )}
            </MapContainer>
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <button className="btn" onClick={() => setOpenView(false)}>Close</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stops Dialog */}
      <Dialog open={openStops} onOpenChange={setOpenStops}>
        <DialogTrigger asChild>
          <div />
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <p className="sr-only" id="stops-desc">All stops for this route.</p>
          <DialogHeader>
            <DialogTitle>Route Stops</DialogTitle>
          </DialogHeader>
          {stopsForViewer.length > 0 ? (
            <StopsViewer 
              stops={stopsForViewer} 
              routePolyline={ride.routePolyline}
              routeCoordinates={ride.routePolyline ? decodePolyline(ride.routePolyline) : undefined}
              isCreator={false}
              triggerText=""
              getAuthToken={user ? () => user.getIdToken() : undefined}
              onRequestRide={() => {
                setOpenStops(false);
                if (!user) {
                  router.push('/auth/select-university');
                  return;
                }
                setOpenBook(true);
              }}
              university={ride.university}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">No stops available for this route</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Booking dialog with pickup selection & search */}
      <Dialog open={openBook} onOpenChange={setOpenBook}>
        <DialogTrigger asChild>
          <div />
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{isFromUniversity ? 'Select Drop Point' : 'Select Pickup Point'}</DialogTitle>
          </DialogHeader>

          {/* Request Status Display */}
          {isAcceptedRequest && existingRequest && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-green-900 dark:text-green-100">Request Accepted! ✅</h3>
                {existingRequest.timerType !== 'none' && confirmCountdown && confirmCountdown !== 'waiting' && (
                  <span className="text-sm font-mono text-green-700 dark:text-green-300">
                    {confirmCountdown}
                  </span>
                )}
              </div>
              
              {/* Smart timer messages based on timerType */}
              {existingRequest.timerType === 'short' && !existingRequest.confirmLater && (
                <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                  🚗 <strong>Ride starting soon!</strong> Please confirm within {confirmCountdown ? `${confirmCountdown}` : '2-3 minutes'} to secure your seat.
                </p>
              )}
              {existingRequest.timerType === 'medium' && !existingRequest.confirmLater && (
                <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                  ⏰ <strong>Confirm within 30 minutes.</strong> Driver Ali is waiting for your confirmation.
                </p>
              )}
              {existingRequest.timerType === 'none' && !existingRequest.confirmLater && (
                <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                  📅 <strong>This ride is tomorrow or later.</strong> You can confirm anytime before pickup. Take your time!
                </p>
              )}
              {existingRequest.confirmLater && (
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-3 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                  ⏸️ <strong>Confirm Later:</strong> You chose to confirm later. We will remind you 30 minutes before pickup.
                </p>
              )}
              
              {showConfirmWarning ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 p-3 rounded-md mb-3">
                  <p className="text-sm text-amber-900 dark:text-amber-100 mb-2">
                    ⚠️ <strong>Important:</strong> Confirming this ride will automatically cancel all your other pending and accepted requests for rides around the same time.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirmRequest}
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                    >
                      {loading ? 'Confirming...' : 'Yes, Confirm This Ride'}
                    </button>
                    <button
                      onClick={() => setShowConfirmWarning(false)}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Show Confirm Later option for non-urgent rides (medium/none timer types) */}
                  {!existingRequest.confirmLater && (existingRequest.timerType === 'medium' || existingRequest.timerType === 'none') && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowConfirmWarning(true)}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                      >
                        Confirm Now
                      </button>
                      <button
                        onClick={handleConfirmLater}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                      >
                        {loading ? 'Setting...' : 'Confirm Later'}
                      </button>
                      <button
                        onClick={() => setShowCancelDialog(true)}
                        disabled={cancelling}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
                      >
                        {cancelling ? 'Cancelling...' : 'Cancel'}
                      </button>
                    </div>
                  )}
                  
                  {/* For urgent rides or if already confirmed later, show standard buttons */}
                  {(existingRequest.confirmLater || existingRequest.timerType === 'short') && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowConfirmWarning(true)}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                      >
                        Confirm Ride
                      </button>
                      <button
                        onClick={() => setShowCancelDialog(true)}
                        disabled={cancelling}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
                      >
                        {cancelling ? 'Cancelling...' : 'Cancel'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {isPendingRequest && existingRequest && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">Request Pending ⏳</h3>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                Your request is waiting for the ride provider to respond.
              </p>
              <button
                onClick={() => setShowCancelDialog(true)}
                disabled={cancelling}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Request'}
              </button>
            </div>
          )}

          {isRejectedRequest && existingRequest && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Request Declined ❌</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                The ride provider declined your request. You can request again if seats are still available.
              </p>
            </div>
          )}

          <div className="h-[60vh] w-full relative" style={{ minHeight: '400px' }}>
            <div className="absolute left-4 top-4 z-[99999] w-[calc(100%-4rem)] md:w-2/3 pointer-events-auto">
          <p className="sr-only" id="book-desc">Select your pickup point and request a seat.</p>
              <div className="flex gap-2">
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search places near route..." className="w-full rounded-md px-3 py-2 text-sm bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-200" />
                <button className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm" onClick={() => { /* manual search triggered by input effect */ }} disabled={searching}>{searching ? 'Searching...' : 'Search'}</button>
              </div>
                  {searchResults.length > 0 && (
                <div className="mt-2 max-h-48 overflow-auto bg-white/95 text-slate-900 rounded-md p-2 absolute left-0 right-0 top-full z-[100000] shadow-lg">
                  {searchResults.map((r: any) => (
                    <div key={r.place_id || r.osm_id} className="p-2 hover:bg-slate-100 rounded-md cursor-pointer text-slate-900" onClick={() => {
                      const lat = Number(r.lat || r.latitude || (r.center && r.center.lat));
                      const lon = Number(r.lon || r.longitude || (r.center && r.center.lng));
                      if (!lat || !lon) { toast({ variant: 'destructive', title: 'Invalid result' }); return; }
                      const pt = L.latLng(lat, lon);
                      if (!isPointNearRoute(pt, ride.route as LatLngExpression[], 0.005)) {
                        toast({ variant: 'destructive', title: 'Not on route', description: 'Selected place is not sufficiently close to the route.' });
                        return;
                      }
                      setPickupPoint(pt);
                      // Use the search result's display name immediately when available
                      const name = r.display_name || r.name || null;
                      setPickupPlaceName(name);
                      setSearchResults([]);
                      setSearchQuery(r.display_name || r.name || '');
                    }}>{r.display_name || r.name}</div>
                  ))}
                </div>
              )}
            </div>

            <MapContainer bounds={L.latLngBounds(ride.route as LatLngExpression[])} style={{ height: '60vh', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
              <Polyline positions={ride.route as LatLngExpression[]} color="#60A5FA" weight={4} opacity={0.9} />

              {/* Start and End Markers */}
              {ride.route && ride.route.length > 0 && (
                <>
                  <Marker 
                    position={ride.route[0] as any}
                    icon={L.icon({
                      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [1, -34],
                      shadowSize: [41, 41]
                    })}
                  >
                    <Tooltip>Start: {start}</Tooltip>
                  </Marker>
                  <Marker 
                    position={ride.route[ride.route.length - 1] as any}
                    icon={L.icon({
                      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [1, -34],
                      shadowSize: [41, 41]
                    })}
                  >
                    <Tooltip>End: {end}</Tooltip>
                  </Marker>
                </>
              )}
              
              {pickupPoint && (
                <CircleMarker center={pickupPoint as any} pathOptions={{ color: '#3F51B5', fillColor: '#3F51B5' }} radius={6}>
                  <Tooltip>{isFromUniversity ? 'Drop' : 'Pickup'}</Tooltip>
                </CircleMarker>
              )}
              <MapEvents onSelect={handleSelectPickup} />
            </MapContainer>
          </div>
            <div className="mt-4 flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">{pickupPoint ? (
              <span className="inline-block">Selected: <span className="font-medium text-slate-900 dark:text-slate-100">{pickupPlaceLoading ? 'Resolving place…' : (pickupPlaceName || 'Selected point')}</span></span>
            ) : (isFromUniversity ? 'Click on the route or search to select a drop point.' : 'Click on the route or search to select a pickup point.')}</div>

            <div className="flex gap-3 items-center">
              <button
                aria-label={isFromUniversity ? 'Cancel drop request' : 'Cancel pickup request'}
                onClick={() => { setOpenBook(false); setPickupPoint(null); setPickupPlaceName(null); }}
                className="px-3 py-2 rounded-md border border-slate-200 bg-transparent text-sm text-slate-200 hover:bg-slate-700/40 transition"
              >
                Cancel
              </button>

              <button
                aria-label={isFromUniversity ? 'Request drop' : 'Request pickup'}
                onClick={() => handleBook(pickupPoint)}
                disabled={!existingChecked || !pickupPoint || loading || !!disabledReason}
                className={`px-4 py-2 rounded-md text-sm font-medium transition shadow-sm min-w-[140px] ${(!existingChecked || !pickupPoint || loading || disabledReason) ? 'bg-slate-500/60 text-slate-100 cursor-not-allowed' : 'bg-[#3F51B5] text-white hover:brightness-105'}`}
              >
                {loading ? 'Sending...' : (disabledReason ? 'Not allowed' : (isFromUniversity ? 'Request Drop' : 'Request Pickup'))}
              </button>

              {disabledReason && (
                <div className="text-xs text-muted-foreground ml-2">{disabledReason}</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ride Detail Modal */}
      <RideDetailModal
        open={openDetail}
        onOpenChange={setOpenDetail}
        ride={ride}
        driverName={ride.driverInfo?.fullName || 'Provider'}
        driverVerified={ride.driverInfo?.isVerified || ride.driverInfo?.universityEmailVerified || false}
        startLocation={start}
        endLocation={end}
        rideDateTime={departure}
        price={ride.price}
        seatsLeft={ride.availableSeats}
        genderPreference={ride.genderAllowed === 'both' ? 'Both' : ride.genderAllowed}
        transport={ride.transportMode || ride.transport}
        university={ride.universe}
        hideUniversity={userData?.university === ride.university}
        statusLabel={isAcceptedRequest && confirmCountdown ? `Accepted — confirm within ${confirmCountdown}` : undefined}
        onViewStops={() => {
          setOpenDetail(false);
          setOpenStops(true);
        }}
        onBook={() => {
          if (!user) {
            router.push('/auth/select-university');
            return;
          }
          setOpenDetail(false);
          setOpenBook(true);
        }}
        disabled={!existingChecked ? true : !!disabledReason}
        disabledReason={!existingChecked ? 'Checking...' : disabledReason}
      />

      {/* Cancellation Confirmation Dialog */}
      <CancellationConfirmDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={handleCancelRequest}
        onCancel={() => setShowCancelDialog(false)}
        isLoading={cancelling}
        cancellerRole="passenger"
        cancellationRate={0} // Not tracked in find-rides view
        minutesUntilDeparture={0}
      />
    </div>
  );
}
