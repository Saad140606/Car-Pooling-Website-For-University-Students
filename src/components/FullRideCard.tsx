"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RideCard from './RideCard';
import StopsViewer from './StopsViewer';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import L, { LatLng, LatLngExpression } from 'leaflet';
import { MapContainer, TileLayer, Marker, CircleMarker, Polyline, useMapEvents, Tooltip } from '@/components/map';
import { runTransaction, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { decodePolyline } from '@/lib/route';

function MapEvents({ onSelect }: { onSelect: (pt: LatLng) => void }) {
  useMapEvents({ click(e: L.LeafletMouseEvent) { onSelect(e.latlng); } });
  return null;
}

export default function FullRideCard({ ride, user, userData, firestore, hasActiveBooking, myBookings, openBookingOnMount, selectedUniversity }: { ride: any; user: any; userData: any; firestore: any; hasActiveBooking?: boolean; myBookings?: any[]; openBookingOnMount?: boolean; selectedUniversity?: string }) {
  const router = useRouter();
  const [openView, setOpenView] = useState(false);
  const [openBook, setOpenBook] = useState(false);
  const [pickupPoint, setPickupPoint] = useState<LatLng | null>(null);
  const [pickupPlaceName, setPickupPlaceName] = useState<string | null>(null);
  const [pickupPlaceLoading, setPickupPlaceLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const { toast } = useToast();

  const isDriver = user && ride.driverId === user.uid;
  const isFull = (ride.availableSeats ?? 0) <= 0;

  const existingBooking = (myBookings || []).find((b: any) => b.rideId === ride.id);

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
  // Only treat accepted when a booking exists and is accepted. Pending requests should show pending.
  const isAcceptedBooking = bookingStatus === 'accepted';
  const isPendingRequest = existingRequestStatus === 'pending';
  const isRejectedRequest = existingRequestStatus === 'rejected';

  const disabledReason = isDriver ? "Can't book own ride"
    : isFull ? 'Ride is full'
    : genderMismatch ? `Reserved for ${ride.genderAllowed} riders`
    : isAcceptedBooking ? `You already requested this ride (accepted)`
    : isPendingRequest ? `You already requested this ride (pending)`
    : (hasActiveBooking ? 'You already have an active booking on another ride' : undefined);

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
        const res = await fetch(`/api/nominatim/reverse?lat=${encodeURIComponent(pickupPoint.lat)}&lon=${encodeURIComponent(pickupPoint.lng)}`);
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
  }, [pickupPoint]);

  const handleBook = async (pt?: LatLng) => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Not signed in' });
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
      if (reqData && reqData.status && reqData.status !== 'rejected') {
        toast({ variant: 'destructive', title: 'Already Requested', description: 'You have already requested this ride.' });
        return false;
      }

      const bookingRef = doc(firestore, `universities/${userData.university}/bookings`, requestId);
      const bSnap = await getDoc(bookingRef);
      const bData = bSnap.exists() ? (bSnap.data() as any) : null;
      if (bData && bData.status && bData.status !== 'rejected' && bData.status !== 'cancelled') {
        toast({ variant: 'destructive', title: 'Already Requested', description: 'You have already requested this ride.' });
        return false;
      }
    } catch (e) {
      // If the re-check fails, fall back to local checks below
      console.debug('Failed to re-check existing request/booking:', e);
    }
    if (hasActiveBooking) {
      toast({ variant: 'destructive', title: 'Already have booking', description: 'You already have an active booking and cannot request another.' });
      return false;
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

    const requestData = {
      rideId: ride.id,
      driverId: ride.driverId,
      passengerId: user.uid,
      status: 'pending',
      createdAt: serverTimestamp(),
      pickupPoint: pickup ? { lat: pickup.lat, lng: pickup.lng } : null,
      pickupPlaceName,
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
          if (data && data.status && data.status !== 'rejected') {
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
      toast({ variant: 'destructive', title: 'Booking Failed', description: err?.message || String(err) });
      return false;
    } finally {
      setLoading(false);
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
  const departure = ride.departureTime ? new Date(ride.departureTime.seconds * 1000).toISOString() : '';

  return (
    <>
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[95%] md:max-w-[700px] lg:max-w-[850px] transform-gpu scale-95 sm:scale-95 md:scale-100">
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
        stops={ride.stops}
        onViewRoute={() => setOpenView(true)}
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
          
          {/* Stops Viewer */}
          {ride.stops && ride.stops.length > 0 && (
            <div className="mt-3 flex justify-center">
              <StopsViewer 
                stops={ride.stops} 
                routePolyline={ride.routePolyline}
                routeCoordinates={ride.routePolyline ? decodePolyline(ride.routePolyline) : undefined}
                isCreator={false}
                triggerText="View All Stops"
              />
            </div>
          )}
        </div>
      </div>

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
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
              <Polyline positions={ride.route as LatLngExpression[]} color="#ffffff" weight={2} opacity={0.9} dashArray="5,5" />
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

      {/* Booking dialog with pickup selection & search */}
      <Dialog open={openBook} onOpenChange={setOpenBook}>
        <DialogTrigger asChild>
          <div />
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select Pickup Point</DialogTitle>
          </DialogHeader>
          <div className="h-[60vh] w-full relative" style={{ minHeight: '400px' }}>
            <div className="absolute left-4 top-4 z-[99999] w-[calc(100%-4rem)] md:w-2/3 pointer-events-auto">
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
              <Polyline positions={ride.route as LatLngExpression[]} color="#ffffff" weight={2} opacity={0.9} dashArray="5,5" />

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
                  <Tooltip>Pickup</Tooltip>
                </CircleMarker>
              )}
              <MapEvents onSelect={handleSelectPickup} />
            </MapContainer>
          </div>
            <div className="mt-4 flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">{pickupPoint ? (
              <span className="inline-block">Selected: <span className="font-medium text-slate-900 dark:text-slate-100">{pickupPlaceLoading ? 'Resolving place…' : (pickupPlaceName || `${pickupPoint.lat.toFixed(5)}, ${pickupPoint.lng.toFixed(5)}`)}</span></span>
            ) : 'Click on the route or search to select a pickup point.'}</div>

            <div className="flex gap-3 items-center">
              <button
                aria-label="Cancel pickup request"
                onClick={() => { setOpenBook(false); setPickupPoint(null); setPickupPlaceName(null); }}
                className="px-3 py-2 rounded-md border border-slate-200 bg-transparent text-sm text-slate-200 hover:bg-slate-700/40 transition"
              >
                Cancel
              </button>

              <button
                aria-label="Request pickup"
                onClick={() => handleBook(pickupPoint)}
                disabled={!existingChecked || !pickupPoint || loading || !!disabledReason}
                className={`px-4 py-2 rounded-md text-sm font-medium transition shadow-sm min-w-[140px] ${(!existingChecked || !pickupPoint || loading || disabledReason) ? 'bg-slate-500/60 text-slate-100 cursor-not-allowed' : 'bg-[#3F51B5] text-white hover:brightness-105'}`}
              >
                {loading ? 'Sending...' : (disabledReason ? 'Not allowed' : 'Request Pickup')}
              </button>

              {disabledReason && (
                <div className="text-xs text-muted-foreground ml-2">{disabledReason}</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
