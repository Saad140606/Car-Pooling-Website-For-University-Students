'use client';
import { useUser, useFirestore } from '@/firebase';
import { query, where, orderBy, doc, runTransaction, serverTimestamp, addDoc, getDoc, Timestamp } from 'firebase/firestore';
import { safeCollection } from '@/firebase/helpers';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Route, Calendar, Users, Search as SearchIcon } from 'lucide-react';
import FullRideCard from '@/components/FullRideCard';
import { useCollection as useBookingsCollection } from '@/firebase/firestore/use-collection';
import L, { LatLng, LatLngExpression } from 'leaflet';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, CircleMarker, Tooltip } from '@/components/map';
import { Ride as RideType } from '@/lib/types';
import { getUniversityShortLabel } from '@/lib/universities';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { notifyNewRideRequest } from '@/lib/rideNotificationService';
import { parseTimestamp, parseTimestampToMs, isRideExpired } from '@/lib/timestampUtils';


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
  } catch (e) {
    // silent fallback if mergeOptions isn't available in some environments
  }
}

// Small helper available to components in this file: truncate by characters (alphabets)
const truncateWords = (s?: string, limit = 30) => {
  if (!s) return '';
  if (s.length <= limit) return s;
  return s.slice(0, limit) + '...';
};

// CRITICAL FIX: Active booking statuses that block new bookings
// Only these statuses are considered "active" - completed/expired/rejected/cancelled don't block
const ACTIVE_BOOKING_STATUSES = ['pending', 'PENDING', 'accepted', 'ACCEPTED', 'confirmed', 'CONFIRMED', 'ongoing', 'ONGOING'];

function RouteMapModal({ ride, onBook, children, userData, alreadyBooked }: { ride: RideType, onBook: (pickupPoint: LatLng) => Promise<boolean>, children: React.ReactNode, userData?: any, alreadyBooked?: boolean }) {
  const [pickupPoint, setPickupPoint] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Controlled dialog state to manage when the MapContainer is mounted (avoids double-init)
  const [open, setOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mountId, setMountId] = useState(0);
  const [mapHostKey, setMapHostKey] = useState(() => `maphost-${Date.now()}-${Math.random()}`);
  const [retryCount, setRetryCount] = useState(0);
  const retryCountRef = useRef<number>(retryCount);
  const [resetKey, setResetKey] = useState(0);
  const [autoRetryDisabled, setAutoRetryDisabled] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Helper: convert latlng to approx meters (equirectangular approximation)
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
    // tolerance is in degrees-ish; convert to meters (approx)
    const tolMeters = tolerance * 111320;
    for (let i = 0; i < route.length - 1; i++) {
      const start = L.latLng(route[i] as LatLng);
      const end = L.latLng(route[i + 1] as LatLng);
      const d = pointToSegmentDistanceMeters(point, start, end);
      if (d < tolMeters) return true;
    }
    return false;
  };
  
  const MapEvents = () => {
    // typed event param
    useMapEvents({
      click(e: L.LeafletMouseEvent) {
        if (isPointNearRoute(e.latlng, ride.route as LatLngExpression[])) {
          setPickupPoint(e.latlng);
        } else {
          toast({ variant: 'destructive', title: 'Invalid Pickup Point', description: 'Please select a point on or very near the route.' });
        }
      },
    });
    return null;
  };

  // Search Nominatim for place suggestions within the route bbox
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<any>>([]);
  const [searching, setSearching] = useState(false);

  const searchPlaces = async (q: string) => {
    if (!q || q.trim().length < 2) return setSearchResults([]);
    setSearching(true);
    try {
      // Use the bounding box of the route to reduce irrelevant results
      const bounds = L.latLngBounds(ride.route as LatLngExpression[]);
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const viewbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
      const res = await fetch(`/api/nominatim/search?q=${encodeURIComponent(q)}&viewbox=${encodeURIComponent(viewbox)}&limit=6`);
      if (!res.ok) {
        setSearchResults([]);
        return;
      }
      const json = await res.json();
      setSearchResults(Array.isArray(json) ? json : []);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced auto-search when the user types in the search box
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      searchPlaces(searchQuery);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  const handleBookWithPickup = async () => {
    if (!pickupPoint) {
      toast({ variant: 'destructive', title: 'No Pickup Point', description: 'Please select a pickup point on the route.' });
      return;
    }
    // Require a completed profile before booking
    const profileComplete = userData && userData.fullName && userData.gender && userData.contactNumber && userData.university;
    if (!profileComplete) {
      toast({ variant: 'destructive', title: 'Complete Profile', description: 'Please complete your profile before booking a ride. Redirecting...'});
      router.push('/dashboard/complete-profile');
      return;
    }
    // Prevent booking when ride is restricted to a specific gender
    if (ride.genderAllowed && ride.genderAllowed !== 'both' && userData?.gender && userData.gender !== ride.genderAllowed) {
      toast({ variant: 'destructive', title: 'Booking Not Allowed', description: `This ride is reserved for ${ride.genderAllowed} riders.` });
      return;
    }
    setLoading(true);
    try {
      const ok = await onBook(pickupPoint);
      setLoading(false);
      if (ok) {
        setOpen(false);
      }
    } catch (err) {
      setLoading(false);
      toast({ variant: 'destructive', title: 'Booking Failed', description: (err as any)?.message || 'Could not request seat. Please try again.' });
    }
  };
  
  const startPos = ride.route[0] as LatLngExpression;
  const endPos = ride.route[ride.route.length - 1] as LatLngExpression;

  // Cleanup helper: remove any stale leaflet container from the wrapper element to avoid double-init
  const cleanupMapContainer = useCallback(() => {
    try {
      const el = wrapperRef.current;

      // Safely clear any leaflet container inside the wrapper first (do NOT remove the
      // wrapper's child node itself — React may still manage it and will attempt to
      // remove it later, which can trigger `removeChild` errors). Clear children
      // instead so the element remains managed by React.
      if (el) {
        const possible = el.querySelector('.leaflet-container');
        if (possible) {
          try { if ((possible as any)._leaflet_id) { try { delete (possible as any)._leaflet_id; } catch (e) {} } } catch (e) {}
          // Do NOT remove children or the element itself. Removing DOM nodes that
          // React manages can cause later `removeChild` errors during commit when
          // React attempts to unmount the node. Deleting Leaflet's internal id is
          // sufficient to allow a fresh map initialization.
        }
      }
      // NOTE: Do NOT remove leaflet containers belonging to other React mounts. Removing
      // DOM nodes that React also manages can cause React to attempt to delete a node
      // that no longer exists (removeChild error). We only remove the container that
      // belongs to this wrapper to avoid interfering with other mounts.
    } catch (_) {}
  }, []);

  // When `open` changes, run cleanup and mount the map slightly later to avoid double-init (dev Strict Mode)
  useEffect(() => {
    if (open) {
      // ensure any previous container is removed before mounting
      cleanupMapContainer();
      // bump mount id to force a brand-new MapContainer instance
      setMountId((m) => m + 1);
      // also rotate the host key so React creates a fresh wrapping element
      setMapHostKey(`maphost-${Date.now()}-${Math.random()}`);
      const baseDelay = retryCountRef.current === 0 ? 100 : Math.min(500 * retryCountRef.current, 2000);
      const t = window.setTimeout(() => {
        cleanupMapContainer();
        const t2 = window.setTimeout(() => setShowMap(true), 20);
        // clear inner timeout on cleanup
        (window as any).__route_map_t2 = t2;
      }, baseDelay);
      (window as any).__route_map_t = t;
      return () => window.clearTimeout(t);
    }
    return;
  }, [open, cleanupMapContainer]);

  // When dialog closes, unmount map immediately and run cleanup
  useEffect(() => {
    if (!open) {
      setShowMap(false);
      cleanupMapContainer();
    }
  }, [open, cleanupMapContainer]);

  // Called by the MapErrorBoundary when Leaflet throws the double-init error.
  const handleMapError = useCallback(() => {
    // If we've exceeded retries, stop auto retry and show manual reset UI
    if (retryCountRef.current + 1 > 3) {
      setShowMap(false);
      setAutoRetryDisabled(true);
      setRetryCount((c) => { const next = c + 1; retryCountRef.current = next; return next; });
      return;
    }

    // Unmount map and retry after a brief backoff
    setShowMap(false);
    setRetryCount((c) => { const next = c + 1; retryCountRef.current = next; return next; });
    const backoff = Math.min(500 * (retryCountRef.current), 2000);
    window.setTimeout(() => {
      cleanupMapContainer();
      setShowMap(true);
    }, backoff);
  }, [cleanupMapContainer]);

  const resetMap = useCallback(() => {
    cleanupMapContainer();
    setShowMap(false);
    setAutoRetryDisabled(false);
    setRetryCount(0);
    retryCountRef.current = 0;
    setResetKey((k) => k + 1);
    // rotate host key to ensure a fresh DOM node for MapContainer
    setMapHostKey(`maphost-${Date.now()}-${Math.random()}`);
    window.setTimeout(() => setShowMap(true), 100);
  }, [cleanupMapContainer]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Route from {truncateWords(ride.from, 30)} to {truncateWords(ride.to, 30)}</DialogTitle>
        </DialogHeader>
        <div className="h-[60vh] w-full relative" ref={wrapperRef}>
          <div className="absolute left-4 top-4 z-[99999] w-[calc(100%-4rem)] md:w-2/3 pointer-events-auto">
            <div className="flex gap-2">
              <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); }} placeholder="Search places near route..." className="w-full rounded-md px-3 py-2 text-sm bg-white text-slate-900 placeholder:text-slate-500 ring-1 ring-slate-200" />
              <button className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm" onClick={() => searchPlaces(searchQuery)} disabled={searching}>{searching ? 'Searching...' : 'Search'}</button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-auto bg-white/95 text-slate-900 rounded-md p-2 absolute left-0 right-0 top-full z-[100000] shadow-lg">
                {searchResults.map((r: any) => (
                  <div key={r.place_id || r.osm_id} className="p-2 hover:bg-slate-100 rounded-md cursor-pointer text-slate-900" onClick={async () => {
                    const lat = Number(r.lat || r.latitude || (r.center && r.center.lat));
                    const lon = Number(r.lon || r.longitude || (r.center && r.center.lng));
                    if (!lat || !lon) {
                      toast({ variant: 'destructive', title: 'Invalid result', description: 'Selected place does not have a location.' });
                      return;
                    }
                    const pt = L.latLng(lat, lon);
                    if (!isPointNearRoute(pt, ride.route as LatLngExpression[], 0.005)) {
                      toast({ variant: 'destructive', title: 'Not on route', description: 'Selected place is not sufficiently close to the route. Please choose a point on the route.' });
                      return;
                    }
                    setPickupPoint(pt);
                    // center map to the selected point if map exists
                    try { (document.querySelector('.leaflet-container') as any)?._leaflet_id && null; } catch (_) {}
                    // close results
                    setSearchResults([]);
                    setSearchQuery(r.display_name || r.name || '');
                  }}>{r.display_name || r.name}</div>
                ))}
              </div>
            )}
          </div>
          {showMap && (
            <MapErrorBoundary key={`map-error-${ride.id}-${resetKey}`} onMapError={handleMapError}>
              <div key={mapHostKey} className="h-full w-full">
                <MapContainer
                  key={`route-map-${ride.id}-${mountId}-${mapHostKey}`}
                  bounds={L.latLngBounds(ride.route as LatLngExpression[])}
                  style={{ height: '100%', width: '100%' }}
                >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {startPos && (
                  <CircleMarker center={startPos as any} pathOptions={{ color: '#10B981', fillColor: '#10B981', weight: 1 }} radius={6}>
                    <Tooltip direction="top" offset={[0, -6]} opacity={1} permanent={false}>Start</Tooltip>
                  </CircleMarker>
                )}
                {endPos && (
                  <CircleMarker center={endPos as any} pathOptions={{ color: '#EF4444', fillColor: '#EF4444', weight: 1 }} radius={6}>
                    <Tooltip direction="top" offset={[0, -6]} opacity={1} permanent={false}>End</Tooltip>
                  </CircleMarker>
                )}
                <Polyline positions={ride.route as LatLngExpression[]} color="#ffffff" weight={2} opacity={0.9} dashArray="5,5" />
                {pickupPoint && (
                  <CircleMarker center={pickupPoint as any} pathOptions={{ color: '#3F51B5', fillColor: '#3F51B5' }} radius={6} />
                )}
                <MapEvents />
              </MapContainer>
              </div>
            </MapErrorBoundary>
          )}

          {(!showMap && retryCount > 0 && !autoRetryDisabled) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-surface/80 p-4 rounded-md text-sm">Failed to initialize map. Retrying... ({retryCount})</div>
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
        <p className="text-sm text-center text-muted-foreground">Click on the route to select your desired pickup point.</p>
        <Button onClick={handleBookWithPickup} disabled={!pickupPoint || loading || alreadyBooked || (ride.genderAllowed && ride.genderAllowed !== 'both' && userData?.gender && userData.gender !== ride.genderAllowed)}>
          {loading ? <Loader2 className="animate-spin" /> : (alreadyBooked ? 'Already Requested' : 'Request Pickup')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

// Error boundary to catch Leaflet double-init errors and surface them to the modal
class MapErrorBoundary extends React.Component<{ children: React.ReactNode, onMapError?: () => void }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    const message = String(error?.message || error);
    if (message.includes('Map container is already initialized') || message.includes('Map container is being reused')) {
      console.warn('Map initialization error caught by MapErrorBoundary:', message);
      this.props.onMapError?.();
    } else {
      throw error;
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function RideCard({ ride, user, userData, firestore, selectedUniversity }: { ride: any, user: any, userData: any, firestore: any, selectedUniversity?: string }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [existingBooking, setExistingBooking] = useState<any | null>(null);
  const [existingChecked, setExistingChecked] = useState(false);

  // Check for an existing request by deterministic id (rideId_userId) using a direct get.
  React.useEffect(() => {
    let mounted = true;
    const check = async () => {
      setExistingChecked(false);
      if (!firestore || !user || !userData) {
        if (mounted) setExistingBooking(null);
        if (mounted) setExistingChecked(true);
        return;
      }
      try {
        const requestId = `${ride.id}_${user.uid}`;
        const ref = doc(firestore, `universities/${userData.university}/rides`, ride.id, 'requests', requestId);
        const snap = await getDoc(ref);
        if (!mounted) return;
        setExistingBooking(snap.exists() ? ({ id: snap.id, ...snap.data() } as any) : null);
      } catch (e) {
        console.error('Failed to check existing request', e);
        if (mounted) setExistingBooking(null);
      } finally {
        if (mounted) setExistingChecked(true);
      }
    };
    check();
    return () => { mounted = false; };
  }, [firestore, user, userData, ride.id]);

  const existingRequestStatus = existingBooking ? existingBooking.status : null;
  // CRITICAL FIX: Only block on ACTIVE statuses (not completed/rejected/cancelled)
  const hasBlockingRequest = existingBooking ? ACTIVE_BOOKING_STATUSES.includes(existingRequestStatus) : false;

  const handleRequestSeat = async (pickupPoint: LatLng) => {
    // CRITICAL: Logged-out users are redirected to university selection
    if (!user) {
      toast({ variant: 'destructive', title: 'Select Your University', description: 'Please select your university to book a ride.' });
      router.push('/auth/select-university');
      return false;
    }
    if (!firestore) return false;
    if (!userData || !userData.university) {
      toast({ variant: 'destructive', title: 'Profile incomplete', description: 'Please complete your profile and select your university before booking.' });
      return false;
    }

    // Ensure user has a valid auth token before attempting transaction
    let idToken: string | null = null;
    try {
      idToken = await user.getIdToken(true); // Force refresh
      if (!idToken) {
        throw new Error('Could not obtain authentication token');
      }
    } catch (tokenErr) {
      console.error('Token refresh failed:', tokenErr);
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'Please sign out and sign in again.' });
      router.push('/auth/select-university');
      return false;
    }

    if (ride.driverId === user.uid) {
      toast({ variant: 'destructive', title: "Can't book own ride" });
      return false;
    }

    // Prevent double-requesting the same ride (only block when request not rejected)
    if (hasBlockingRequest) {
      toast({ variant: 'destructive', title: 'Already Requested', description: 'You have already requested a seat on this ride.' });
      return false;
    }

    // Enforce gender restriction: only allow booking if user's gender matches ride.genderAllowed
    if (ride.genderAllowed && ride.genderAllowed !== 'both' && userData?.gender && userData.gender !== ride.genderAllowed) {
      toast({ variant: 'destructive', title: 'Booking Not Allowed', description: `This ride is reserved for ${ride.genderAllowed} riders.` });
      return false;
    }

    setLoading(true);

    // Attempt to reverse-geocode the chosen pickupPoint to a human-readable place name.
    let pickupPlaceName: string | null = null;
    try {
      const res = await fetch(`/api/nominatim/reverse?lat=${encodeURIComponent(pickupPoint.lat)}&lon=${encodeURIComponent(pickupPoint.lng)}`);
      if (res.ok) {
        const data = await res.json();
        pickupPlaceName = data.display_name || null;
      }
    } catch (e) {
      // ignore reverse geocode failures; we'll store coords at minimum
    }

    // Compute tripKey based on departure time (30-minute slot)
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
      status: 'PENDING' as any,
      createdAt: serverTimestamp(),
      pickupPoint: { lat: pickupPoint.lat, lng: pickupPoint.lng },
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
        // Use a deterministic request id to prevent duplicate requests from the same user
        const requestId = `${ride.id}_${user.uid}`;
        const requestRef = doc(firestore, `universities/${userData.university}/rides`, ride.id, 'requests', requestId);
        const existingRequestDoc = await transaction.get(requestRef);
        if (existingRequestDoc.exists()) {
          const data = existingRequestDoc.data();
          if (data && data.status && !['rejected','REJECTED','cancelled','CANCELLED','expired','EXPIRED','auto_cancelled','AUTO_CANCELLED'].includes((data.status as string))) {
            throw new Error('You have already requested a seat on this ride.');
          }
          // If the existing request was rejected, allow overwriting so the user can request again.
        }
        const requestPayload = Object.assign({}, requestData, { bookingId: requestId });
        transaction.set(requestRef, requestPayload);
      });

      // Send client-side notification to driver (redundant with Cloud Function, but ensures immediate notification)
      try {
        await notifyNewRideRequest(
          firestore,
          userData.university,
          ride.driverId,
          ride.id,
          { uid: user.uid, fullName: userData?.fullName || 'A student' },
          { from: ride.from || 'Unknown', to: ride.to || 'Unknown' }
        );
      } catch (notifError) {
        // Don't fail the request if notification fails
        console.debug('[RideRequest] Notification error (non-critical):', notifError);
      }

      toast({ title: 'Request Sent!', description: 'The ride provider has been notified of your request.' });
      return true;
    } catch (error: any) {
      console.error('Error requesting seat:', error);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      console.error('Request auth check:', { hasUser: !!user, userId: user?.uid, hasFirestore: !!firestore, userDataUniversity: userData?.university });
      
      const code = error?.code || '';
      const msg = error?.message || String(error);

      // Only emit a permission-error when the underlying error indicates a real permission denial.
      if (code === 'permission-denied' || String(msg).toLowerCase().includes('permission')) {
        const permissionError = new FirestorePermissionError({ path: `universities/${userData.university}/rides/${ride.id}/requests`, operation: 'create', requestResourceData: requestData });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Request Failed — Permission Denied',
          description: `Ensure your Firestore rules allow creating ride requests under universities/${userData.university}/rides/${ride.id}/requests. Then run: firebase deploy --only firestore:rules`,
        });
      } else {
        toast({ variant: 'destructive', title: 'Booking Failed', description: msg || 'Unknown error. Check console for details.' });
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const startPos = (ride.route && ride.route[0]) as LatLngExpression | undefined;
  const endPos = (ride.route && ride.route[ride.route.length - 1]) as LatLngExpression | undefined;
  const bounds = ride.route ? (L.latLngBounds(ride.route as LatLngExpression[])) : undefined;

  const truncateWords = (s?: string, limit = 30) => {
    if (!s) return '';
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length <= limit) return s;
    return words.slice(0, limit).join(' ') + '...';
  };

  // Instead of mounting many interactive Mini maps (which can cause Leaflet double-init
  // errors under Strict Mode), render a static map image preview for the card and keep
  // the interactive MapContainer only in the route modal.

  // Inline SVG fallback preview (used when static map fails)
  function InlineRoutePreview({ route }: { route: any[] }) {
    if (!route || route.length === 0) return <div className="h-full w-full bg-muted" />;

    // Normalize into {lat,lng} array
    const points = route.map((p: any) => Array.isArray(p) ? { lat: Number(p[0]), lng: Number(p[1]) } : { lat: Number(p.lat), lng: Number(p.lng) });
    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const W = 260;
    const H = 56;

    const pad = 3; // visual padding — keep small so path fills width
    const lonSpan = (maxLng - minLng) || 0.0001;
    const latSpan = (maxLat - minLat) || 0.0001;

    const project = (pt: { lat: number; lng: number }) => {
      const x = pad + ((pt.lng - minLng) / lonSpan) * (W - pad * 2);
      // invert y so larger lat (north) is up
      const y = pad + (1 - (pt.lat - minLat) / latSpan) * (H - pad * 2);
      return { x, y };
    };

    const pathD = points.map((p, i) => {
      const { x, y } = project(p);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');

    const start = project(points[0]);
    const end = project(points[points.length - 1]);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.2" />
          </filter>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" rx="8" fill="#f8fafc" />
        <path d={pathD} fill="none" stroke="#1E88FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#shadow)" opacity="0.95" />
        <path d={pathD} fill="none" stroke="#8ACBFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        <circle cx={start.x} cy={start.y} r="3.5" fill="#10B981" stroke="#ffffff" strokeWidth="1" />
        {/* End pin: small map-pin shape composed of head + tail */}
        <g transform={`translate(${end.x}, ${end.y})`}>
          <path d="M0 -6 A4 4 0 1 1 0 6 L0 9 Z" fill="#EF4444" stroke="#fff" strokeWidth="0.8" />
          <circle cx="0" cy="-2" r="1.6" fill="#fff" />
        </g>
      </svg>
    );
  }

  const makeStaticMapUrl = () => {
    if (!ride.route || ride.route.length === 0) return null;
    const s = ride.route[0];
    const e = ride.route[ride.route.length - 1];
    const start = Array.isArray(s) ? { lat: s[0], lng: s[1] } : { lat: (s as any).lat, lng: (s as any).lng };
    const end = Array.isArray(e) ? { lat: e[0], lng: e[1] } : { lat: (e as any).lat, lng: (e as any).lng };
    // center on bounds
    let centerLat = start.lat;
    let centerLng = start.lng;
    try {
      const b = L.latLngBounds(ride.route as LatLngExpression[]);
      const c = b.getCenter();
      centerLat = c.lat; centerLng = c.lng;
    } catch (e) {}

    const zoom = 12; // fixed zoom is adequate for preview
    const size = '260x56';
    // staticmap.openstreetmap.de supports markers and size/zoom/center
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}&zoom=${zoom}&size=${size}&markers=${start.lat},${start.lng},green1|${end.lat},${end.lng},red1`;
  };

  const isDriver = user && ride.driverId === user.uid;
  const isFull = (ride.availableSeats ?? 0) <= 0;

  // Departure date pieces for display - use centralized timestamp parser
  const departureDt = parseTimestamp(ride?.departureTime, { silent: true });
  const weekday = departureDt ? departureDt.toLocaleDateString('en-US', { weekday: 'long' }) : '';
  const dateShort = departureDt ? departureDt.toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }) : '⚠ Invalid Date'; 

  // local component: image + fallback inline preview
  function PreviewInner({ route, makeUrl }: { route: any[]; makeUrl: () => string | null }) {
    const [imgError, setImgError] = useState(false);
    const url = makeUrl();

    // Always render the inline SVG preview to keep the UI compact and allow
    // using a map-pin icon for the end marker (static image may use round markers).
    return (
      <div className="h-full w-full">
        <InlineRoutePreview route={route} />
      </div>
    );
  }

  const uniLabel = (ride.university || selectedUniversity || '').toUpperCase();

  return (
    <Card className="relative flex flex-col md:flex-row p-1 rounded-md bg-card border border-border overflow-visible shadow-sm h-auto md:min-h-[90px]">


      <div className="relative flex-1 pr-2 flex flex-col justify-between">
        {/* Desktop price pill (left area) */}
          <div className="hidden md:flex flex-col items-end gap-1 absolute top-1 right-2 z-20">
          <div className="bg-primary/95 text-primary-foreground px-2 py-0.5 rounded-full font-semibold text-[0.68rem] shadow-sm border border-primary/20">PKR {ride.price}</div>
          {uniLabel && <div className="px-2 py-0.5 text-[0.62rem] rounded-full bg-white/10 text-white border border-white/10">{uniLabel}</div>}
        </div>
        {/* Top content: From / To rows + Map */}
        <div>
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-3 w-3 rounded-full bg-emerald-400 inline-block flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-[0.78rem] line-clamp-1 text-white">{truncateWords(ride.from, 30)}</p>
                    <p className="text-[0.62rem] text-muted-foreground mt-1 truncate">{truncateWords(ride.from.split(',').slice(0,2).join(', '), 10)}</p>
                  </div>
                </div>

                <div className="mt-2 flex items-start gap-3">
                  <span className="mt-1 h-3 w-3 rounded-full bg-red-500 inline-block flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-[0.78rem] line-clamp-1 text-white">{truncateWords(ride.to, 30)}</p>
                    <p className="text-[0.62rem] text-muted-foreground mt-1 truncate">{truncateWords(ride.to.split(',').slice(0,2).join(', '), 10)}</p>
                  </div>
                </div>
              </div>
            </div>

          <div className="flex items-start gap-2.5">
            <div className="flex-1">
              <div className="rounded-md overflow-hidden border border-border bg-white p-1 h-8 md:h-9 shadow-sm">
                {ride.route && ride.route.length > 0 ? (
                  <RouteMapModal ride={ride} onBook={handleRequestSeat} userData={userData} alreadyBooked={hasBlockingRequest}>
                    <div className="relative w-full h-full rounded-md overflow-hidden pl-2 flex items-center cursor-pointer">
                      <div className="flex-1 h-full min-h-0">
                        <PreviewInner route={ride.route} makeUrl={makeStaticMapUrl} />
                      </div>
                      <div className="absolute bottom-1 right-1">
                        <div className="bg-[#111827]/80 text-[0.6rem] text-white rounded-md px-2 py-0.5">View</div>
                      </div>
                    </div>
                  </RouteMapModal>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No route</div>
                )}
              </div>
            </div>

            <div className="w-24 flex flex-col justify-between items-end gap-1">
              <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-[0.4rem]">{(ride.driverInfo?.fullName || 'U').split(' ').map((s:any)=>s[0]).slice(0,2).join('')}</div>

              <div className="w-full space-y-0.5">
                <RouteMapModal ride={ride} onBook={handleRequestSeat} userData={userData} alreadyBooked={hasBlockingRequest}>
                  <Button className="w-full text-[0.68rem] h-6 bg-transparent hover:bg-white/5 border border-white/5 text-slate-200 px-1">Route</Button>
                </RouteMapModal>

                <RouteMapModal ride={ride} onBook={handleRequestSeat} userData={userData} alreadyBooked={hasBlockingRequest}>
                  <Button disabled={!user || !existingChecked || isDriver || isFull || hasBlockingRequest || (ride.genderAllowed && ride.genderAllowed !== 'both' && userData?.gender && userData.gender !== ride.genderAllowed)} className="w-full h-6 bg-primary rounded-md text-primary-foreground px-1 text-[0.68rem]">{user ? 'Book' : 'Sign in'}</Button>
                </RouteMapModal>
              </div>
            </div>

          </div>

          <div className="mt-0.5 grid grid-cols-3 gap-1 text-[0.55rem] text-muted-foreground">
            <div className="flex items-start gap-0.5">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <div className="text-[0.5rem]">{dateShort}</div>
            </div>
            <div className="flex items-start gap-0.5">
              <Users className="h-3 w-3 flex-shrink-0" />
              <div className="font-semibold text-[0.5rem]">{ride.availableSeats}S</div>
            </div>
            <div className="flex items-start gap-0.5">
              <Route className="h-3 w-3 flex-shrink-0" />
              <div className="text-[0.5rem]">{ride.genderAllowed === 'both' ? 'All' : ride.genderAllowed}</div>
            </div>
          </div>

                <RouteMapModal ride={ride} onBook={handleRequestSeat} userData={userData} alreadyBooked={hasBlockingRequest}>
                  <Button disabled={!user || !existingChecked || isDriver || isFull || hasBlockingRequest || (ride.genderAllowed && ride.genderAllowed !== 'both' && userData?.gender && userData.gender !== ride.genderAllowed)} className="bg-primary rounded-md text-primary-foreground px-3 py-1 text-sm">{user ? 'Book' : 'Sign in to book'}</Button>
                </RouteMapModal>
        </div>
      </div>

          {/* Provider column removed to keep card compact and single CTA */}
    </Card>
  );
}

export default function RidesPage() {
  // Lightweight wrapper to stabilize hooks at this component boundary.
  // The heavy logic and all hooks live inside `RidesPageInner` so React's
  // hook order in the exported component remains stable across renders.
  return <RidesPageInner />;
}

function RidesPageInner() {
  const { user, data: userData, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Declare ALL state hooks unconditionally at the top
  const [filters, setFilters] = useState(() => {
    const baseFilters = {
      transport: 'any' as 'any'|'car'|'bike',
      gender: 'any' as 'any'|'male'|'female',
      minPrice: '' as string,
      maxPrice: '' as string,
      pointInput: '' as string,
      point: null as { lat:number; lng:number } | null,
      university: '' as string,
      direction: 'any' as 'any'|'toUniversity'|'fromUniversity',
    };
    return baseFilters;
  });

  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [hideProfileBanner, setHideProfileBanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<any>>([]);
  const [searching, setSearching] = useState(false);

  // Declare ALL effect hooks unconditionally 
  useEffect(() => {
    // keep lightweight logging only
    // Avoid logging heavy objects which can cause stringify issues
  }, [user, userData, userLoading]);

  // Auto-lock university filter for logged-in users
  useEffect(() => {
    if (user && userData?.university) {
      setFilters(f => ({ ...f, university: userData.university }));
    } else {
      setFilters(f => ({ ...f, university: '' }));
    }
  }, [user?.uid, userData?.university]);

  // Debug filter state changes (defensive)
  useEffect(() => {
    try {
      // No-op or minimal logging to avoid accidental throws
    } catch (e) {}
  }, [filters?.university, user, userData?.university]);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // === ALL HOOK DEFINITIONS MUST HAPPEN BEFORE ANY NON-HOOK CODE ===

  // Build queries - always execute unconditionally
  const fastRidesQuery = firestore ? query(
    safeCollection(firestore, 'universities', 'fast', 'rides'),
    where('status', '==', 'active')
  ) : null;

  const nedRidesQuery = firestore ? query(
    safeCollection(firestore, 'universities', 'ned', 'rides'),
    where('status', '==', 'active')
  ) : null;

  const karachiRidesQuery = firestore ? query(
    safeCollection(firestore, 'universities', 'karachi', 'rides'),
    where('status', '==', 'active')
  ) : null;

  // Custom hooks - MUST be called unconditionally and in same order
  const { data: fastRides, loading: fastRidesLoading, error: fastRidesError } = useCollection<RideType>(fastRidesQuery);
  const { data: nedRides, loading: nedRidesLoading, error: nedRidesError } = useCollection<RideType>(nedRidesQuery);
  const { data: karachiRides, loading: karachiRidesLoading, error: karachiRidesError } = useCollection<RideType>(karachiRidesQuery);

  // myBookingsQuery hook
  // CRITICAL FIX: Only fetch ACTIVE bookings at query level
  // This prevents completed/expired/rejected bookings from blocking new bookings
  const myBookingsQuery = firestore && userData?.university ? query(
    safeCollection(firestore, 'universities', userData.university, 'bookings'),
    where('passengerId', '==', user?.uid || ''),
    where('status', 'in', ACTIVE_BOOKING_STATUSES)
  ) : null;
  const { data: myBookings } = useBookingsCollection(myBookingsQuery);

  // Memos MUST be declared before useCallback and useEffect
  const ridesWithValidTimestamps = React.useMemo(() => {
    const allRides = [
      ...(fastRides || []).map(r => ({ ...r, university: 'fast' })),
      ...(nedRides || []).map(r => ({ ...r, university: 'ned' })),
      ...(karachiRides || []).map(r => ({ ...r, university: 'karachi' }))
    ];
    // Keep ALL rides, even if timestamp parsing fails
    // Filtering happens later in availableRides based on expiration
    return allRides;
  }, [fastRides, nedRides, karachiRides]);
  
  const rides = React.useMemo(() => {
    return ridesWithValidTimestamps.sort((a, b) => {
      // Use centralized timestamp parser (silent mode to avoid console spam)
      const aTime = parseTimestampToMs(a.departureTime, { silent: true }) || 0;
      const bTime = parseTimestampToMs(b.departureTime, { silent: true }) || 0;
      return aTime - bTime;
    });
  }, [ridesWithValidTimestamps]);

  // Helper callbacks
  const parsePointInput = useCallback((s: string) => {
    const parts = s.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    return null;
  }, []);

  const useMyLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setFilters(f => ({ ...f, pointInput: `${p.lat},${p.lng}`, point: p }));
    });
  }, []);

  // Compute availableRides - filter out own rides and past rides (before downstream filters)
  // CRITICAL: This is the ONLY place where we filter expired rides
  // Expired rides must remain visible in:
  //   - My Rides (driver's view)
  //   - My Bookings (passenger's view)
  //   - My Offered Rides
  //   - Ride history/analytics
  // Only Find Ride (this page) should hide expired rides
  const availableRides = React.useMemo(() => {
    return rides?.filter((ride: any) => {
      if (!ride) return false;
      
      // Only filter out driver's own ride if user is logged in
      if (user && ride.driverId === user.uid) {
        return false;
      }
      
      // If user is logged in, only show rides from their university
      if (user && userData?.university) {
        if (ride.university !== userData.university) {
          return false;
        }
      }
      
      // CRITICAL: Filter out expired rides using centralized utility
      // Uses defensive logic: if timestamp is invalid/unparseable, keeps the ride visible
      // to avoid hiding rides due to data corruption
      if (isRideExpired(ride.departureTime, { silent: true })) {
        return false;
      }
      
      return true;
    }) ?? [];
  }, [rides, user, userData?.university]);

  // Helper for route proximity filtering
  const isPointNearRoute = useCallback((point: {lat:number; lng:number}, route: L.LatLngExpression[] | {lat:number; lng:number}[], tolerance = 0.003): boolean => {
    const toMetersLocal = (latlng: { lat: number; lng: number }) => {
      const latRad = (latlng.lat * Math.PI) / 180;
      const x = latlng.lng * 111320 * Math.cos(latRad);
      const y = latlng.lat * 110540;
      return { x, y };
    };

    const pointToSegmentDistanceMetersLocal = (p: {lat:number; lng:number}, a: {lat:number; lng:number}, b: {lat:number; lng:number}) => {
      const P = toMetersLocal({ lat: p.lat, lng: p.lng });
      const A = toMetersLocal({ lat: a.lat, lng: a.lng });
      const B = toMetersLocal({ lat: b.lat, lng: b.lng });
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

    const tolMeters = tolerance * 111320;
    for (let i = 0; i < route.length - 1; i++) {
      const start = L.latLng(route[i] as LatLng);
      const end = L.latLng(route[i + 1] as LatLng);
      const d = pointToSegmentDistanceMetersLocal(point as any, { lat: start.lat, lng: start.lng } as any, { lat: end.lat, lng: end.lng } as any);
      if (d < tolMeters) return true;
    }
    return false;
  }, []);

  // Apply user filters to available rides
  const filteredRides = React.useMemo(() => {
    return availableRides?.filter((ride: any) => {
      if (!ride) return false;

      // University filter
      if (filters.university && filters.university !== 'any' && filters.university !== '') {
        if (ride.university !== filters.university) return false;
      } else if (user && userData?.university) {
        if (ride.university !== userData.university) return false;
      }

      // transport/gender/price filters
      if (filters.transport !== 'any' && ride.transportMode !== filters.transport) return false;
      if (filters.gender !== 'any' && !(ride.driverInfo?.gender === filters.gender)) return false;
      const min = filters.minPrice ? Number(filters.minPrice) : null;
      const max = filters.maxPrice ? Number(filters.maxPrice) : null;
      if (min !== null && ride.price < min) return false;
      if (max !== null && ride.price > max) return false;

      // route proximity filter
      const p = filters.point ?? (filters.pointInput ? parsePointInput(filters.pointInput) : null);
      if (p) {
        if (!(ride.route && ride.route.length && isPointNearRoute(p as any, ride.route as LatLngExpression[]))) return false;
      }

      // direction filter
      if (filters.direction !== 'any' && userData?.university) {
        const uni = getUniversityShortLabel(userData.university).toLowerCase();
        const from = (ride.from || '').toLowerCase();
        const to = (ride.to || '').toLowerCase();
        if (filters.direction === 'toUniversity' && !to.includes(uni)) return false;
        if (filters.direction === 'fromUniversity' && !from.includes(uni)) return false;
      }

      // Search query matching
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const hay = (`${ride.from || ''} ${ride.to || ''} ${ride.driverInfo?.fullName || ''} ${String(ride.price || '')} ${ride.transportMode || ''}`).toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    }) ?? [];
  }, [availableRides, user, userData?.university, filters, searchQuery, parsePointInput, isPointNearRoute]);

  const clearFilters = useCallback(() => {
    setFilters({ transport: 'any', gender: 'any', minPrice: '', maxPrice: '', pointInput: '', point: null, university: (user && userData?.university) ? userData.university : '', direction: 'any' });
  }, [user, userData?.university]);

  // === END OF ALL HOOK DEFINITIONS ===
  
  const ridesLoading = fastRidesLoading || nedRidesLoading || karachiRidesLoading;
  // FIX: Only consider bookings with ACTIVE statuses (already filtered at query level)
  const hasActiveBooking = (myBookings || []).some((b: any) => b && b.status);
  const isLoading = userLoading || ridesLoading;

  // Query error logging
  useEffect(() => {
    if (fastRidesError) console.error('❌ [Find Ride] FAST query error:', fastRidesError);
    if (nedRidesError) console.error('❌ [Find Ride] NED query error:', nedRidesError);
    if (karachiRidesError) console.error('❌ [Find Ride] Karachi query error:', karachiRidesError);
  }, [fastRidesError, nedRidesError, karachiRidesError]);
  
  // Sync filters from URL search params
  useEffect(() => {
    try {
      const params: Record<string, string> = {};
      if (searchParams) {
        for (const key of Array.from(searchParams.keys())) {
          const v = searchParams.get(key);
          if (v !== null) params[key as string] = v;
        }
      }
      const newFilters = {
        transport: (params.transport as any) || 'any',
        gender: (params.gender as any) || 'any',
        minPrice: params.minPrice || '',
        maxPrice: params.maxPrice || '',
        pointInput: params.pointInput || '',
        point: params.pointInput ? parsePointInput(params.pointInput) : null,
        university: (user && userData?.university) ? userData.university : (params.university || ''),
        direction: (params.direction as any) || 'any',
      };
      setFilters(f => ({ ...f, ...newFilters }));
    } catch (e) {
      // ignore malformed query params
    }
  }, [searchParams, user, userData?.university, parsePointInput]);

  // Lock university filter for logged-in users
  useEffect(() => {
    if (user && userData && userData.university) {
      setFilters(f => {
        if (f.university !== userData.university) {
          return { ...f, university: userData.university };
        }
        return f;
      });
    }
  }, [user, userData, userData?.university]);

  // Early return for loading state - after all hooks
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-60 w-full" />)}
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
        <div className="flex items-center gap-3 mb-6 animate-page">
          {!user && <button onClick={() => router.back()} className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 text-sm text-slate-200">← Back</button>}
          <h1 className="text-3xl font-headline font-bold text-slate-50">Available Rides</h1>
        </div>

      {/* Premium profile completion banner */}
      {user && userData && !hideProfileBanner && !userLoading && !(userData.fullName && userData.gender && userData.university) && (
        <div className="mb-8 w-full animate-fade-slide-up">
          <div className="w-full profile-banner rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
            <div className="p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              {/* Left content */}
              <div className="flex-1 min-w-0 flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 border border-primary/40">
                    <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                
                {/* Text content */}
                <div className="flex-1">
                  <h3 className="text-base md:text-lg font-semibold text-white font-headline">Complete Your Profile</h3>
                  <p className="mt-1 text-sm text-slate-300">Finish your profile to unlock booking and creating rides. It only takes a minute!</p>
                  
                  {/* Progress indicator */}
                  <div className="mt-3 text-xs text-slate-400">
                    {!userData.fullName || !userData.gender ? '↳ Missing personal details' : ''}
                    {!userData.university ? (!userData.fullName ? ' & ' : '↳ ') + 'University' : ''}
                  </div>
                </div>
              </div>

              {/* Right actions */}
              <div className="flex-shrink-0 flex items-center gap-3 w-full md:w-auto">
                <Button 
                  onClick={() => router.push('/dashboard/complete-profile')} 
                  className="flex-1 md:flex-none rounded-full px-6 py-2.5 font-medium shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/60 transition-all duration-300 hover:scale-105 active:scale-95 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Complete Now
                  </span>
                </Button>
                <button 
                  onClick={() => setHideProfileBanner(true)} 
                  className="profile-banner-dismiss text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/5 transition-all duration-200"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
          <Button onClick={() => setShowFilters(true)}>Filters</Button>
          <Dialog open={showFilters} onOpenChange={setShowFilters}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Filters</DialogTitle>
                </DialogHeader>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm mb-1 font-semibold">{(user && userData?.university) ? 'University (Locked to Portal)' : 'University'}</label>
                  {(user && userData?.university) ? (
                    <div className="flex items-center gap-2">
                      <Input 
                        value={getUniversityShortLabel(userData.university) || userData.university} 
                        disabled 
                        title="Your university is locked based on your account. Contact support to change it."
                        className="bg-slate-800/50 backdrop-blur-sm text-slate-300 disabled:opacity-70 cursor-not-allowed" 
                      />
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/50">🔒 Locked</Badge>
                    </div>
                  ) : (
                    <Select value={filters.university || 'any'} onValueChange={(v) => setFilters(f => ({ ...f, university: v }))}>
                      <SelectTrigger className="w-full bg-slate-800/50 backdrop-blur-sm text-slate-200 focus:ring-primary">
                        <SelectValue>{filters.university === 'any' || !filters.university ? 'All Universities' : filters.university === 'fast' ? 'FAST University' : filters.university === 'karachi' ? 'Karachi University' : 'NED University'}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900">
                        <SelectItem value="any">All Universities</SelectItem>
                        <SelectItem value="fast">FAST University</SelectItem>
                        <SelectItem value="ned">NED University</SelectItem>
                        <SelectItem value="karachi">Karachi University</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <label className="block text-sm mb-1">Transport</label>
                  <Select value={filters.transport} onValueChange={(v) => setFilters(f => ({ ...f, transport: v as any }))}>
                    <SelectTrigger className="w-full"><SelectValue>{filters.transport === 'any' ? 'Any' : filters.transport}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="car">Car</SelectItem>
                      <SelectItem value="bike">Bike</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm mb-1">Ride Provider Gender</label>
                  <Select value={filters.gender} onValueChange={(v) => setFilters(f => ({ ...f, gender: v as any }))}>
                    <SelectTrigger className="w-full"><SelectValue>{filters.gender === 'any' ? 'Any' : filters.gender}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm mb-1">Min Price</label>
                    <Input value={filters.minPrice} onChange={(e) => setFilters(f => ({ ...f, minPrice: e.target.value }))} placeholder="Min" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Max Price</label>
                    <Input value={filters.maxPrice} onChange={(e) => setFilters(f => ({ ...f, maxPrice: e.target.value }))} placeholder="Max" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-1">Place</label>
                  <div className="relative">
                    <Input aria-autocomplete="list" aria-expanded={suggestions.length>0} placeholder="Search place (e.g. Main Gate)" value={filters.pointInput} onChange={(e) => {
                      const v = e.target.value;
                      setFilters(f => ({ ...f, pointInput: v, point: null }));
                      if (!v || v.trim().length < 2) {
                        try { window.clearTimeout((window as any).__filters_suggest_timer); } catch (e) {}
                        try { (window as any).__filters_suggest_controller?.abort(); } catch (e) {}
                        setSuggestions([]);
                        setSearching(false);
                        return;
                      }
                      setSearching(true);
                      window.clearTimeout((window as any).__filters_suggest_timer);
                      (window as any).__filters_suggest_timer = window.setTimeout(async () => {
                        try { (window as any).__filters_suggest_controller?.abort(); } catch (e) {}
                        const controller = new AbortController();
                        (window as any).__filters_suggest_controller = controller;
                        try {
                          // Limit suggestions to Karachi bounding box to keep results local
                          const viewbox = '66.97,24.75,67.18,25.075';
                          const res = await fetch(`/api/nominatim/search?q=${encodeURIComponent(v)}&limit=6&viewbox=${viewbox}&bounded=1`, { signal: controller.signal });
                          if (!res.ok) { setSuggestions([]); setSearching(false); return; }
                          const json = await res.json();
                          setSuggestions(Array.isArray(json) ? json : []);
                        } catch (e: any) {
                          if (e && e.name === 'AbortError') {
                            // ignore
                          } else { setSuggestions([]); }
                        } finally { setSearching(false); try { delete (window as any).__filters_suggest_controller; } catch (e) {} }
                      }, 300);
                    }} />

                    {suggestions.length > 0 && (
                      <ul role="listbox" className="absolute z-50 left-0 right-0 bg-popover border border-border rounded mt-1 max-h-56 overflow-auto">
                        {suggestions.map((s, i) => (
                          <li key={s.place_id || s.osm_id} role="option" tabIndex={0} className="p-2 cursor-pointer hover:bg-slate-100" onClick={() => {
                            const lat = Number(s.lat || s.latitude || (s.center && s.center.lat));
                            const lon = Number(s.lon || s.longitude || (s.center && s.center.lng));
                            if (!isNaN(lat) && !isNaN(lon)) {
                              setFilters(f => ({ ...f, pointInput: s.display_name || s.name || '', point: { lat, lng: lon } }));
                            } else {
                              setFilters(f => ({ ...f, pointInput: s.display_name || s.name || '', point: null }));
                            }
                            setSuggestions([]);
                          }} onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLElement).click(); } }}>
                            <div className="text-sm">{s.display_name || s.name}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Use to find rides near a point on route.</div>
                </div>

                <div>
                  <label className="block text-sm mb-1">Direction</label>
                  <Select value={filters.direction} onValueChange={(v) => setFilters(f => ({ ...f, direction: v as any }))}>
                    <SelectTrigger className="w-full"><SelectValue>{filters.direction === 'any' ? 'Any' : filters.direction === 'toUniversity' ? 'To University' : 'From University'}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="toUniversity">Going To University</SelectItem>
                      <SelectItem value="fromUniversity">Leaving From University</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { clearFilters(); setShowFilters(false); }}>Clear</Button>
                <Button onClick={() => setShowFilters(false)}>Apply</Button>
              </div>
            </DialogContent>
          </Dialog>
          {/** Show matches badge only when filters/search are active */}
          { (searchQuery.trim() !== '' || filters.transport !== 'any' || filters.gender !== 'any' || filters.minPrice || filters.maxPrice || filters.pointInput || filters.direction !== 'any' || (filters.university && filters.university !== '' && !user)) && (
            <Badge>{filteredRides.length} matches</Badge>
          ) }

          <div className="ml-4 flex items-center gap-2 w-full max-w-md">
            <Input value={searchQuery} onChange={(e: any) => setSearchQuery(e.target.value)} placeholder="Search by from, to, ride provider, price..." />
            {searchQuery ? (
              <Button variant="ghost" onClick={() => setSearchQuery('')}>Clear</Button>
            ) : (
              <div className="hidden sm:flex items-center text-slate-400 pl-2"><SearchIcon className="w-4 h-4"/></div>
            )}
          </div>
        </div>
        <div>
          <Button variant="ghost" onClick={() => { setFilters({ transport: 'any', gender: 'any', minPrice: '', maxPrice: '', pointInput: '', point: null, university: (user && userData?.university) ? userData.university : '', direction: 'any' }); setSearchQuery(''); router.push('/dashboard/rides'); }}>Clear</Button>
        </div>
      </div>

      {ridesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredRides && filteredRides.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 items-stretch">
          {filteredRides.map((ride: any) => {
            // FIX: Only check for ACTIVE bookings on OTHER rides (already filtered at query level)
            const hasActiveBookingForOther = (myBookings || []).some((b: any) => (
              b && b.status && b.rideId !== ride.id
            ));
            const pendingBookingId = searchParams ? searchParams.get('pendingBooking') : null;
            const openBooking = pendingBookingId && pendingBookingId === ride.id;
            return (
              <FullRideCard key={ride.id} ride={ride} user={user} userData={userData} firestore={firestore} hasActiveBooking={hasActiveBookingForOther} myBookings={myBookings} openBookingOnMount={openBooking} />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 sm:py-12 md:py-16 rounded-2xl bg-gradient-to-br from-slate-800/40 via-slate-800/30 to-slate-900/40 backdrop-blur-md shadow-lg shadow-primary/5">
          <h2 className="text-2xl font-semibold text-slate-50">No Rides Available</h2>
          <p className="text-slate-400 mt-2">Check back later for new rides from your university!</p>
          {fastRidesError || nedRidesError || karachiRidesError ? (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-300 text-sm">
              ⚠️ Error loading rides. Please try again or contact support.
            </div>
          ) : null}
        </div>
      )}
      </div>
    </div>
  );
}
