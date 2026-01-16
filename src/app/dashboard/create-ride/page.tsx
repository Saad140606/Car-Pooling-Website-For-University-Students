

'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addDoc, collection, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import type { Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Button } from '@/components/ui/button';
import RouteEditor from '@/components/RouteEditor';
import { decodePolyline } from '@/lib/route';
import type { LatLng as RouteLatLng } from '@/lib/route';
import { calculatePricing } from '@/lib/pricing';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Lock } from 'lucide-react';
import { LeavingTimePicker } from '@/components/ui/leaving-time-picker';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


const rideSchema = z.object({
  from: z.string().min(3, 'Starting location is required.'),
  to: z.string().min(3, 'Destination is required.'),
  departureTime: z.date({ required_error: 'Please select a departure date and time.' }),
  transportMode: z.enum(['car', 'bike']),
  price: z.coerce.number().int().min(0, 'Price must be a non-negative integer.'),
  totalSeats: z.coerce.number().int().min(1, 'There must be at least 1 seat.'),
  genderAllowed: z.enum(['male', 'female', 'both']),
}).refine(data => data.from.toLowerCase() !== data.to.toLowerCase(), {
  message: "Starting location and destination can't be the same.",
  path: ['to'],
});


export interface MapComponentRef {
  resetMap: () => void;
  getRoute: () => { lat: number; lng: number }[];
  setRoute?: (latlngs: { lat: number; lng: number }[] ) => void;
  // center: where to show selection UI, bounds?: visual bounds, radius?: meters
  enterSelectionMode: (center: L.LatLngExpression, bounds?: L.LatLngBoundsExpression, radius?: number) => void;
  exitSelectionMode: () => void;
  getTempMarkerLatLng: () => L.LatLng | null;
}

type LatLngLiteral = { lat: number; lng: number; name?: string };

const MapComponent = forwardRef<MapComponentRef, {
    onMapClick: (lat: number, lng: number, name: string) => void;
    onRouteUpdate: (distance: number | null, duration: number | null) => void;
    onRouteError?: (err: Error) => void;
    from: LatLngLiteral | null;
    to: LatLngLiteral | null;
    activeMapSelect: 'from' | 'to' | null;
}>((props, ref) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const fromMarkerRef = useRef<L.Marker | null>(null);
  const toMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  // Ref for the temporary marker used in selection mode
  const tempMarkerRef = useRef<L.Marker | null>(null);
  // Semi-transparent selection circle to indicate allowed campus radius during selection
  const selectionCircleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current || mapInstanceRef.current) return;
    
    // Ensure marker icons are available in Next.js by pointing to public/ assets
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
        // ignore
      }
    }
    
    // Use OpenStreetMap tiles (plain/default style used elsewhere)
    mapInstanceRef.current = L.map(mapContainerRef.current).setView([24.8607, 67.0011], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      detectRetina: true,
      subdomains: 'abc',
    }).addTo(mapInstanceRef.current);

    mapInstanceRef.current.on('click', async (e: L.LeafletMouseEvent) => {
        if (!props.activeMapSelect) return; // Only handle clicks in selection mode
        const { lat, lng } = e.latlng;
        try {
          // Use server-side proxy to avoid CORS and ensure a valid User-Agent
          const res = await fetch(`/api/nominatim/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`);
          if (res.ok) {
            const data = await res.json();
            const name = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            props.onMapClick(lat, lng, name);
            return;
          } else {
            console.warn('Nominatim reverse proxy returned non-OK', { status: res.status });
          }
        } catch (err) {
          console.error('Nominatim reverse failed', err);
        }

        // Fallback: use coordinates as the name if proxy fails
        props.onMapClick(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    });

    // Update temp marker on map move during selection mode
    mapInstanceRef.current.on('move', () => {
        if (tempMarkerRef.current) {
            tempMarkerRef.current.setLatLng(mapInstanceRef.current!.getCenter());
        }
    });

    const map = mapInstanceRef.current;
    return () => {
        map.remove();
        mapInstanceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    // FROM marker
    if (props.from) {
      if (fromMarkerRef.current) {
        fromMarkerRef.current.setLatLng(props.from);
      } else {
        fromMarkerRef.current = L.marker(props.from).addTo(mapInstanceRef.current);
      }
      // Avoid auto-panning when marking a location. Opening popups will not auto-pan the map.
      try { fromMarkerRef.current.bindPopup(props.from.name || 'Starting Point'); } catch (_) {}
    } else if (fromMarkerRef.current) {
        mapInstanceRef.current.removeLayer(fromMarkerRef.current);
        fromMarkerRef.current = null;
    }

    // TO marker
    if (props.to) {
      if (toMarkerRef.current) {
        toMarkerRef.current.setLatLng(props.to);
      } else {
        toMarkerRef.current = L.marker(props.to).addTo(mapInstanceRef.current);
      }
      try { toMarkerRef.current.bindPopup(props.to.name || 'Destination'); } catch (_) {}
    } else if (toMarkerRef.current) {
        mapInstanceRef.current.removeLayer(toMarkerRef.current);
        toMarkerRef.current = null;
    }
  }, [props.from, props.to]);


  useEffect(() => {
    const drawRoute = async (start: LatLngLiteral, end: LatLngLiteral) => {
        if (!mapInstanceRef.current) return;
        if (routeLayerRef.current) {
            mapInstanceRef.current.removeLayer(routeLayerRef.current);
            routeLayerRef.current = null;
        }

        if (!process.env.NEXT_PUBLIC_ORS_API_KEY) {
            console.warn('ORS API key missing. Cannot draw route. Please add NEXT_PUBLIC_ORS_API_KEY to your .env file.');
            props.onRouteUpdate(null, null);
            return;
        }
        
        const body = { coordinates: [[start.lng, start.lat], [end.lng, end.lat]] };

        const maxAttempts = 3;
        let attempt = 0;
        let lastErr: any = null;

        while (attempt < maxAttempts) {
            attempt++;
            try {
                const response = await fetch('/api/ors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    body: JSON.stringify(body),
                });

                if (!response.ok) {
                    // Try to parse returned JSON for more details
                    let errText = '';
                    try {
                        const errJson = await response.json();
                        if (errJson?.error) errText = typeof errJson.error === 'string' ? errJson.error : JSON.stringify(errJson.error);
                        else errText = JSON.stringify(errJson);
                    } catch (e) {
                        errText = await response.text().catch(() => `Status ${response.status}`);
                    }
                    const short = errText ? (errText.length > 1000 ? errText.slice(0, 1000) + '…' : errText) : `Status ${response.status}`;

                    // If ORS returns a client error (4xx), it's likely "no route found" or bad request — don't retry, surface friendly message.
                    if (response.status >= 400 && response.status < 500) {
                        console.warn('ORS returned client error (no route / bad request)', { status: response.status, short });
                        props.onRouteUpdate(null, null);
                        props.onRouteError?.(new Error(`No routable path found (ORS ${response.status}). ${short}`));
                        return;
                    }

                    // For server errors (5xx) or other statuses, throw to trigger retry/backoff
                    throw new Error(`ORS proxy error: ${response.status} — ${short}`);
                }

                const routeData = await response.json();

                if (routeData.features && routeData.features.length > 0) {
                    const coordinates = routeData.features[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
                    // Draw outline + foreground polyline for contrast on dark basemap
                    const polylineOutline = L.polyline(coordinates, { color: '#0b1220', weight: 13, opacity: 0.95 }).addTo(mapInstanceRef.current);
                    const polyline = L.polyline(coordinates, { color: '#FFD166', weight: 7, opacity: 0.95 }).addTo(mapInstanceRef.current);
                    routeLayerRef.current = polyline;
                    // Only fit the map to the route if the user is NOT actively selecting a point — avoid interrupting selection
                    if (!props.activeMapSelect) {
                      try { mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] }); } catch (_) {}
                    }
                    routeLayerRef.current = polyline;

                    const summary = routeData.features[0].properties.summary;
                    props.onRouteUpdate(summary.distance / 1000, summary.duration / 60);
                } else {
                    props.onRouteUpdate(null, null);
                }

                // success — break retry loop
                return;
            } catch (error) {
                lastErr = error;
                console.warn(`Route fetch attempt ${attempt} failed:`, error);
                // small backoff before retrying
                if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 500 * attempt));
            }
        }

        // If we reach here, all attempts failed
        console.error("Error drawing route after retries:", lastErr);
        props.onRouteUpdate(null, null);
        props.onRouteError?.(lastErr instanceof Error ? lastErr : new Error(String(lastErr)));
    };
    
    if (props.from && props.to) {
        drawRoute(props.from, props.to);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.from, props.to]);


  useImperativeHandle(ref, () => ({
    resetMap: () => {
      if (mapInstanceRef.current) {
        if (fromMarkerRef.current) mapInstanceRef.current.removeLayer(fromMarkerRef.current);
        if (toMarkerRef.current) mapInstanceRef.current.removeLayer(toMarkerRef.current);
        if (routeLayerRef.current) mapInstanceRef.current.removeLayer(routeLayerRef.current);
      }
      fromMarkerRef.current = null;
      toMarkerRef.current = null;
      routeLayerRef.current = null;
      mapInstanceRef.current?.setView([24.8607, 67.0011], 13);
      props.onRouteUpdate(null, null);
    },
    getRoute: () => {
        if (!routeLayerRef.current) return [];
        const latLngs = routeLayerRef.current.getLatLngs();
        const flattened = Array.isArray(latLngs[0]) ? (latLngs as L.LatLng[][]).flat() : (latLngs as L.LatLng[]);
        return flattened.map(latLng => ({ lat: latLng.lat, lng: latLng.lng }));
    },
    enterSelectionMode: (center: L.LatLngExpression, bounds?: L.LatLngBoundsExpression, radius?: number) => {
        if (!mapInstanceRef.current) return;
        // center the map on the university/selection point so user sees the boundary
        mapInstanceRef.current.setView(center, 15, { animate: true });
        // show temp marker at center
        if (tempMarkerRef.current) {
          tempMarkerRef.current.setLatLng(center as any);
        } else {
          tempMarkerRef.current = L.marker(center as any, { interactive: false }).addTo(mapInstanceRef.current);
        }
        // Draw a semi-transparent selection circle when radius provided
        try {
          if (typeof radius === 'number') {
            if (selectionCircleRef.current) {
              selectionCircleRef.current.setLatLng(center as any).setRadius(radius);
            } else {
              selectionCircleRef.current = L.circle(center as any, {
                radius,
                color: '#FFD166',
                weight: 2,
                dashArray: '6 8',
                fillColor: '#FFD166',
                fillOpacity: 0.06,
                interactive: false,
              }).addTo(mapInstanceRef.current);
            }
          }
        } catch (_) {}
        // NOTE: we intentionally do NOT set max bounds here — allowing free panning makes selection easier.
        // University bounds are validated on confirm (see handleConfirmSelection).
    },
    exitSelectionMode: () => {
        if (!mapInstanceRef.current) return;
        if (tempMarkerRef.current) {
            mapInstanceRef.current.removeLayer(tempMarkerRef.current);
            tempMarkerRef.current = null;
        }
        // Remove selection circle if present
        if (selectionCircleRef.current) {
            try { mapInstanceRef.current.removeLayer(selectionCircleRef.current); } catch (_) {}
            selectionCircleRef.current = null;
        }
        // leave max-bounds untouched; no cleanup needed since we never set it
    },
    getTempMarkerLatLng: () => {
        return (tempMarkerRef.current?.getLatLng && tempMarkerRef.current.getLatLng()) || mapInstanceRef.current?.getCenter() || null;
    }
    ,
    // Allow externally setting a precomputed route (lat/lng array)
    setRoute: (coords: { lat: number; lng: number }[]) => {
      if (!mapInstanceRef.current) return;
      try {
        if (routeLayerRef.current) {
          mapInstanceRef.current.removeLayer(routeLayerRef.current);
          routeLayerRef.current = null;
        }
        if (!coords || coords.length === 0) return;
        const ll = coords.map(c => [c.lat, c.lng] as [number, number]);
        const polylineOutline = L.polyline(ll, { color: '#0b1220', weight: 13, opacity: 0.95 }).addTo(mapInstanceRef.current);
        const polyline = L.polyline(ll, { color: '#FFD166', weight: 7, opacity: 0.95 }).addTo(mapInstanceRef.current);
        routeLayerRef.current = polyline;
        // Compute approximate distance (meters) from the polyline coordinates and estimate duration.
        try {
          let totalMeters = 0;
          const toRad = (v: number) => (v * Math.PI) / 180;
          const R = 6371e3; // meters
          for (let i = 0; i < ll.length - 1; i++) {
            const aLat = ll[i][0], aLng = ll[i][1];
            const bLat = ll[i+1][0], bLng = ll[i+1][1];
            const phi1 = toRad(aLat);
            const phi2 = toRad(bLat);
            const dPhi = toRad(bLat - aLat);
            const dLambda = toRad(bLng - aLng);
            const A = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
            const C = 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A));
            totalMeters += R * C;
          }
          const distanceKm = Math.round((totalMeters / 1000) * 100) / 100;
          // Estimate duration assuming avg speed 40 km/h (adjustable later)
          const durationMin = Math.round((distanceKm / 40) * 60);
          props.onRouteUpdate(distanceKm, durationMin);
        } catch (e) {
          // ignore calculation errors
        }
        if (!props.activeMapSelect) {
          try { mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] }); } catch (_) {}
        }
      } catch (e) { console.warn('setRoute failed', e); }
    }
  }));

  return <div ref={mapContainerRef} className="h-full w-full" />;
});
MapComponent.displayName = 'MapComponent';


export default function CreateRidePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mapRef = useRef<MapComponentRef>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const submitTimeoutRef = useRef<number | null>(null);
  const submissionAbortedRef = useRef(false);
  
  const { user, loading: userLoading, data: userData, initialized } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [fromCoords, setFromCoords] = useState<LatLngLiteral | null>(null);
  const [toCoords, setToCoords] = useState<LatLngLiteral | null>(null);
  const [routePolyline, setRoutePolyline] = useState<string | null>(null);
  const [routeBounds, setRouteBounds] = useState<any | null>(null);
  const [routeWaypoints, setRouteWaypoints] = useState<{ name?: string; lat: number; lng: number }[] | null>(null);
  const [routeLatLngs, setRouteLatLngs] = useState<RouteLatLng[] | null>(null);
  const [recommendedPricePerSeat, setRecommendedPricePerSeat] = useState<number | null>(null);
  const [finalPricePerSeat, setFinalPricePerSeat] = useState<number | null>(null);
  const [pricingBreakdown, setPricingBreakdown] = useState<any | null>(null);

  // University selection is mandatory: 'toUni' (going to uni) | 'fromUni' (leaving from uni)
  const [uniAuto, setUniAuto] = useState<'toUni' | 'fromUni'>('toUni');

  // Predefined university locations (approximate centers)
  const FAST_UNI: LatLngLiteral = {
    lat: 24.8569128,
    lng: 67.2646384,
    name: 'FAST National University of Computer and Emerging Sciences, Bin Qasim Town, Malir District, Karachi Division, Sindh, 75030, Pakistan',
  };
  const NED_UNI: LatLngLiteral = {
    lat: 24.9368,
    lng: 67.0580,
    name: 'NED UET, University Road, Billys Homes, Gul Houses, Gulshan-e-Iqbal Town, Gulshan District, Karachi Division, Sindh, 75300, Pakistan',
  };

  const UNI_MAX_RADIUS_METERS = 4000; // allow ~4km radius from campus center

  const getCurrentUniversity = () => {
    if (userData?.university === 'ned') return NED_UNI;
    return FAST_UNI;
  };

  const distanceInMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    // Haversine formula
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371e3; // meters
    const phi1 = toRad(a.lat);
    const phi2 = toRad(b.lat);
    const dPhi = toRad(b.lat - a.lat);
    const dLambda = toRad(b.lng - a.lng);

    const A = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    const C = 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A));
    return R * C;
  };

  const isWithinUniversityBounds = (point: { lat: number; lng: number }) => {
    const uni = getCurrentUniversity();
    return distanceInMeters(uni, point) <= UNI_MAX_RADIUS_METERS;
  };

  const applyUniversitySelection = (sel: 'toUni' | 'fromUni') => {
    setUniAuto(sel);
    const uni = getCurrentUniversity();
    if (sel === 'toUni') {
      // Set destination to the student's university and clear the starting point (always)
      if (!form.getValues('to')) form.setValue('to', String(uni.name ?? ''));
      setToCoords(uni);
      // Always clear opposite field and coords so switching presets behaves predictably
      form.setValue('from', '');
      setFromCoords(null);
      const deltaLat = UNI_MAX_RADIUS_METERS / 111000;
      const deltaLng = UNI_MAX_RADIUS_METERS / (111000 * Math.cos(uni.lat * Math.PI / 180));
      const bounds: L.LatLngBoundsExpression = [[uni.lat - deltaLat, uni.lng - deltaLng], [uni.lat + deltaLat, uni.lng + deltaLng]];
      mapRef.current?.enterSelectionMode([uni.lat, uni.lng], bounds, UNI_MAX_RADIUS_METERS);
    } else if (sel === 'fromUni') {
      // Set starting point to the student's university and clear the destination (always)
      if (!form.getValues('from')) form.setValue('from', String(uni.name ?? ''));
      setFromCoords(uni);
      // Always clear opposite field and coords so switching presets behaves predictably
      form.setValue('to', '');
      setToCoords(null);
      const deltaLat = UNI_MAX_RADIUS_METERS / 111000;
      const deltaLng = UNI_MAX_RADIUS_METERS / (111000 * Math.cos(uni.lat * Math.PI / 180));
      const bounds: L.LatLngBoundsExpression = [[uni.lat - deltaLat, uni.lng - deltaLng], [uni.lat + deltaLat, uni.lng + deltaLng]];
      mapRef.current?.enterSelectionMode([uni.lat, uni.lng], bounds, UNI_MAX_RADIUS_METERS);
    }
  };

  // Apply default selection only after the user's university is known
  useEffect(() => {
    // Only apply when fields are empty and the user's university is available to avoid
    // overwriting input with a wrong default (e.g. FAST) while auth/profile are still loading.
    if ((form.getValues('from') === '' && form.getValues('to') === '') && userData?.university) {
      applyUniversitySelection(uniAuto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.university, initialized]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  
  const [activeMapSelect, setActiveMapSelect] = useState<'from' | 'to' | null>(null);

  const form = useForm<z.infer<typeof rideSchema>>({
    resolver: zodResolver(rideSchema),
    defaultValues: { from: '', to: '', price: 200, totalSeats: 4, genderAllowed: 'both', transportMode: 'car' },
  });
  
  const transportMode = form.watch('transportMode');
  const departureTimeValue = form.watch('departureTime');

  useEffect(() => {
    // Suggest sensible defaults when transport mode changes. Do not overwrite a user-modified price;
    // pricing effect below will prefill price from calculated recommendation when appropriate.
    if (transportMode === 'bike') {
      form.setValue('totalSeats', 2);
    } else if (transportMode === 'car') {
      form.setValue('totalSeats', 4);
    }
  }, [transportMode, form]);

  const handleConfirmSelection = async () => {
    if (!activeMapSelect || !mapRef.current) return;
    
    const latLng = mapRef.current.getTempMarkerLatLng();
    if (!latLng) return;

    const finalizeSelection = async (chosenLatLng: { lat: number; lng: number }) => {
      try {
        const res = await fetch(`/api/nominatim/reverse?lat=${encodeURIComponent(chosenLatLng.lat)}&lon=${encodeURIComponent(chosenLatLng.lng)}`);
        let name = `${chosenLatLng.lat.toFixed(4)}, ${chosenLatLng.lng.toFixed(4)}`;
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) name = data.display_name;
        } else {
          try {
            const errJson = await res.json();
            console.warn('Nominatim reverse proxy returned non-OK', errJson);
          } catch (e) {
            console.warn('Nominatim reverse proxy returned non-OK status', { status: res.status });
          }
        }

        form.setValue(activeMapSelect!, name);
        if (activeMapSelect === 'from') {
          setFromCoords({ lat: chosenLatLng.lat, lng: chosenLatLng.lng, name });
        } else {
          setToCoords({ lat: chosenLatLng.lat, lng: chosenLatLng.lng, name });
        }
      } catch (e) {
        console.error("Reverse geocoding failed", e);
        toast({ variant: 'destructive', title: "Could not fetch location name."});
      } finally {
        mapRef.current?.exitSelectionMode();
        setActiveMapSelect(null);
      }
    };


    // Proceed with reverse geocoding and finalization regardless of distance
    await finalizeSelection(latLng);
  };
  
  const handleChooseOnMap = (field: 'from' | 'to') => {
    // Prevent changing a locked field (preset to the student's university)
    if (field === 'to' && uniAuto === 'toUni') {
      toast({ title: 'Locked', description: 'Destination is locked to your university and cannot be changed.' });
      return;
    }
    if (field === 'from' && uniAuto === 'fromUni') {
      toast({ title: 'Locked', description: 'Starting location is locked to your university and cannot be changed.' });
      return;
    }

    setActiveMapSelect(field);
    // Center selection around the student's university and restrict to campus area
    const centerUni = getCurrentUniversity();
    const deltaLat = UNI_MAX_RADIUS_METERS / 111000;
    const deltaLng = UNI_MAX_RADIUS_METERS / (111000 * Math.cos(centerUni.lat * Math.PI / 180));
    const bounds: L.LatLngBoundsExpression = [[centerUni.lat - deltaLat, centerUni.lng - deltaLng], [centerUni.lat + deltaLat, centerUni.lng + deltaLng]];
    mapRef.current?.enterSelectionMode([centerUni.lat, centerUni.lng], bounds);
    
    mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    toast({
      title: 'Choose Location',
      description: `Move the map to position the pin, then click "Confirm Location".`,
    });
  };

  const handleRouteUpdate = useCallback((distance: number | null, duration: number | null) => {
      if(distance) setDistanceKm(Math.round(distance * 100) / 100);
      if(duration) setDurationMin(Math.round(duration));
  }, []);

  const onRouteGenerated = useCallback((data: { waypoints: any[]; polyline: string; bounds: any; distanceMeters?: number | null; durationSeconds?: number | null } ) => {
    try {
      setRouteWaypoints(data.waypoints || []);
      setRoutePolyline(data.polyline || null);
      setRouteBounds(data.bounds || null);
      // decode polyline to lat/lng for map drawing
      // lazy import decode to avoid circulars
      const latlngs = decodePolyline(data.polyline || '');
      setRouteLatLngs(latlngs);
      // instruct the map to draw the generated route
      try { mapRef.current?.setRoute(latlngs); } catch (e) { console.warn('Failed to set route on map', e); }
      // Update distance and duration if ORS returned them
      if (data.distanceMeters != null) {
        const km = Math.round((data.distanceMeters / 1000) * 100) / 100;
        setDistanceKm(km);
      }
      if (data.durationSeconds != null) {
        const minutes = Math.round((data.durationSeconds / 60));
        setDurationMin(minutes);
      }
    } catch (e) {
      console.error('onRouteGenerated failed', e);
    }
  }, []);

  const [query, setQuery] = useState({ field: '', text: '' });
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);
  
  const searchNominatim = async (q: string) => {
    if (q.length < 3) return [];
    try {
        // Restrict search area by university bounds where possible to surface local results
        // Karachi bounding box (lon/lat). We'll strictly filter results to this box
        // to avoid showing out-of-city suggestions.
        const KARACHI_VIEWBOX = { minLon: 66.8, minLat: 24.7, maxLon: 67.4, maxLat: 25.1 };
        // Tight viewbox around NED University when the user is from NED
        let viewbox = `${KARACHI_VIEWBOX.minLon},${KARACHI_VIEWBOX.minLat},${KARACHI_VIEWBOX.maxLon},${KARACHI_VIEWBOX.maxLat}`;
        if (userData?.university === 'ned') {
          viewbox = '67.00,24.84,67.06,24.88';
        }
        const params = new URLSearchParams({
            q,
            format: 'jsonv2',
            limit: '8',
            countrycodes: 'pk',
            viewbox: viewbox,
            bounded: '1'
        });
        // Use server-side proxy for search to avoid client-side CORS/UA restrictions
        const res = await fetch(`/api/nominatim/search?${params.toString()}`);
        if (!res.ok) {
            console.warn('Nominatim search proxy returned non-OK', { status: res.status });
            return [];
        }
        const results = await res.json();
        // Filter results to ensure they lie within Karachi box (fallback safety) so
        // we never show results outside Karachi even if the proxy returns extras.
        const filtered = (results || []).filter((p: any) => {
            const lat = parseFloat(p.lat);
            const lon = parseFloat(p.lon);
            // If we're using the tight NED viewbox, use that box as bounds
            if (userData?.university === 'ned') {
              return lon >= 67.00 && lon <= 67.06 && lat >= 24.84 && lat <= 24.88;
            }
            return lon >= KARACHI_VIEWBOX.minLon && lon <= KARACHI_VIEWBOX.maxLon && lat >= KARACHI_VIEWBOX.minLat && lat <= KARACHI_VIEWBOX.maxLat;
        });
        return filtered;
    } catch (e) {
        console.error('Nominatim search failed', e);
        return [];
    }
  };

  useEffect(() => {
    if (query.text.length < 3) {
      setSuggestions([]);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    setSearchLoading(true);
    if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = window.setTimeout(async () => {
      const results = await searchNominatim(query.text);
      setSuggestions(results);
      setSearchLoading(false);
    }, 500);

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [query]);

  // Recalculate pricing whenever transportMode, route distance/duration or departure time changes
  useEffect(() => {
    if (!distanceKm || !durationMin) {
      setRecommendedPricePerSeat(null);
      setFinalPricePerSeat(null);
      setPricingBreakdown(null);
      return;
    }

    try {
      const pricing = calculatePricing({
        transportType: transportMode === 'bike' ? 'bike' : 'car',
        distanceKm: distanceKm || 0,
        durationMinutes: durationMin || 0,
        departureTime: departureTimeValue || null,
      });

      setRecommendedPricePerSeat(pricing.recommendedPerSeat);
      setFinalPricePerSeat(pricing.finalPerSeat);
      setPricingBreakdown(pricing.breakdown);
      // Pre-fill form price with recommended if user hasn't already changed it from the mode default
      try {
        const currentPrice = form.getValues('price');
        const DEFAULT_PRICE_BY_MODE: Record<string, number> = { car: 200, bike: 100 };
        const modeDefault = DEFAULT_PRICE_BY_MODE[transportMode] ?? 200;
        if (!currentPrice || Number(currentPrice) === modeDefault) {
          form.setValue('price', pricing.recommendedPerSeat);
        }
      } catch (_) {}
    } catch (e) {
      console.error('Pricing calculation failed', e);
    }
  }, [transportMode, distanceKm, durationMin, departureTimeValue]);
  
  const handleSelectSuggestion = (field: 'from' | 'to', place: any) => {
    const name = place.display_name;
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    
    form.setValue(field, name);
    if (field === 'from') {
        setFromCoords({ lat, lng, name });
    } else {
        setToCoords({ lat, lng, name });
    }
    
    setSuggestions([]);
    setQuery({ field: '', text: '' });
  };
  
  const onSubmit = async (values: z.infer<typeof rideSchema>) => {
    const missing: string[] = [];
    if (!initialized) missing.push('auth not initialized');
    if (!user) missing.push('not signed in');
    if (!userData) missing.push('user profile missing');
    if (!firestore) missing.push('firestore not initialized');
    if (missing.length > 0) {
      // Helpful debug info for development — use browser console to inspect values.
      console.debug('Create ride blocked - missing:', { initialized, user, userData, firestore });
      // If user profile is missing, send the user to a quick "Complete Profile" page to fill
      // the required fields (university, full name, gender). This avoids repeated failures.
      if (!userData && user) {
        toast({
          variant: 'destructive',
          title: 'Cannot Create Ride',
          description: 'Please complete your profile before creating a ride. Redirecting...',
        });
        router.push('/dashboard/complete-profile');
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Cannot Create Ride',
        description: `Please wait a moment and try again. Missing: ${missing.join(', ')}.`,
      });
      return;
    }

    // At this point we've validated presence of user, userData, and firestore — create local non-null aliases
    const uid = user!.uid;
    const ud = userData!;
    const db = firestore!;
    if (!mapRef.current) {
      toast({ variant: "destructive", title: "Map Error", description: "Map component is not ready. Please wait a moment." });
      return;
    }

    // Ensure the user's university is present — Firestore collection paths require valid strings.
    if (userData && !userData.university) {
      toast({ variant: 'destructive', title: 'Cannot Create Ride', description: 'Your profile is missing the university. Please complete your profile.' });
      router.push('/dashboard/complete-profile');
      return;
    }

    setIsSubmitting(true);

    // Debugging: log key values that affect the submission flow
    console.debug('Create ride submit started', { fromCoords, toCoords, userId: user?.uid, university: userData?.university });

    // Reset abort marker — we'll use a timed wrapper around the Firestore write to detect hangs
    submissionAbortedRef.current = false;

    const route = mapRef.current.getRoute();
    if (fromCoords && toCoords && route.length === 0 && process.env.NEXT_PUBLIC_ORS_API_KEY) {
        toast({ variant: "destructive", title: "Missing Route", description: "Could not calculate a route. Please wait for the route to appear on the map before creating the ride." });
        setIsSubmitting(false);
        return;
    }

    const rideData = {
      driverId: uid,
      createdBy: uid, // canonical
      from: values.from,
      to: values.to,
      time: values.departureTime, // canonical
      departureTime: values.departureTime,
      transportMode: values.transportMode,
      price: values.price,
      seats: values.totalSeats, // canonical
      totalSeats: values.totalSeats,
      availableSeats: values.totalSeats,
      genderAllowed: values.genderAllowed,
      status: 'active' as 'active',
      // Keep legacy `route` (array of lat/lng) for compatibility, but store canonical encoded polyline and bounds
      route,
      routePolyline: routePolyline || null,
      routeBounds: routeBounds || null,
      waypoints: routeWaypoints || null,
      createdAt: serverTimestamp(),
      driverInfo: {
        fullName: ud.fullName,
        gender: ud.gender,
        ...(ud.contactNumber && { contactNumber: ud.contactNumber }),
        ...(ud.transport && { transport: ud.transport }),
      },
      ...(distanceKm && { distanceKm }),
      ...(durationMin && { durationMin }),
      ...(recommendedPricePerSeat && { recommendedPricePerSeat }),
      ...(finalPricePerSeat && { finalPricePerSeat }),
      ...(pricingBreakdown && { pricingBreakdown }),
    };

    // Auto-generate a sensible `stops` array for the ride document.
    // Prefer explicit route waypoints (named) returned by the directions generator;
    // otherwise sample the decoded route lat/lngs to pick a few main stops.
    try {
      const maxStops = 6;
      let stops: { name?: string; lat: number; lng: number }[] | null = null;

      if (routeWaypoints && Array.isArray(routeWaypoints) && routeWaypoints.length > 0) {
        stops = routeWaypoints.map((w: any) => ({ name: w.name || undefined, lat: Number(w.lat ?? (w[0] ?? 0)), lng: Number(w.lng ?? (w[1] ?? 0)) })).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
      }

      if ((!stops || stops.length === 0) && routeLatLngs && Array.isArray(routeLatLngs) && routeLatLngs.length > 0) {
        const n = routeLatLngs.length;
        const step = Math.max(1, Math.floor((n - 1) / (maxStops - 1)));
        const idxs: number[] = [];
        for (let i = 0; i < n; i += step) {
          idxs.push(i);
        }
        if (idxs[idxs.length - 1] !== n - 1) idxs.push(n - 1);
        stops = idxs.map(i => ({ lat: routeLatLngs![i].lat, lng: routeLatLngs![i].lng }));
      }

      if (stops && stops.length > 0) {
        // Trim to maxStops and attach to rideData
        (rideData as any).stops = stops.slice(0, maxStops);
      }
    } catch (stopsErr) {
      console.warn('Failed to auto-generate stops for ride:', stopsErr);
    }

    try {
      console.debug('Creating ride: writing to Firestore', { university: userData!.university, rideData });
      const ridesCollection = collection(firestore!, 'universities', userData!.university, 'rides');

      const writeStart = Date.now();

      // Quick network check: if the browser reports offline, bail out early.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsSubmitting(false);
        toast({ variant: 'destructive', title: 'No Connection', description: 'Your device appears to be offline. Please reconnect and try again.' });
        return;
      }

      // SDK preflight: use Firestore SDK read of the current user doc to validate network/auth/rules.
      if (!firestore || !user) {
        console.warn('Firestore SDK preflight skipped due to missing firestore or user', { firestoreAvailable: !!firestore, uid: user?.uid });
      } else {
        try {
          const preflightPromise = getDoc(doc(db, 'users', uid));
          const res = await Promise.race([preflightPromise, new Promise((_, rej) => setTimeout(() => rej(new Error('preflight-timeout')), 5000))]);
          // If getDoc resolves, the client can reach Firestore and auth is valid (though rules may still restrict the read)
          if ((res as any)?.exists && (res as any).exists()) {
            console.debug('Firestore SDK preflight OK (user doc exists)');
          } else {
            console.debug('Firestore SDK preflight OK (user doc read)');
          }
        } catch (err: any) {
          console.warn('Firestore SDK preflight failed', err);
          setIsSubmitting(false);

          // Map common SDK errors to actionable messages
          const code = err?.code || err?.status || '';
          const message = err?.message || String(err);

          if (message.includes('permission-denied') || code === 'permission-denied') {
            toast({ variant: 'destructive', title: 'Permission Denied', description: 'Your account does not have permission to access Firestore. Check security rules and that you are signed in.' });
          } else if (message === 'preflight-timeout') {
            toast({ variant: 'destructive', title: 'Firestore Preflight Timeout', description: 'Request to Firestore did not respond within 5s. Check network/firewall.' });
          } else {
            toast({ variant: 'destructive', title: 'Could not reach Firestore', description: message });
          }

          return;
        }
      }

      // Ensure user's ID token can be refreshed before attempting a write (helps catch auth/session issues)
      try {
        // Race token refresh against a short timeout so we don't stall longer than necessary
        await Promise.race([user!.getIdToken(true), new Promise((_, rej) => setTimeout(() => rej(new Error('token-timeout')), 5000))]);
        console.debug('ID token refresh successful before write', { uid: user?.uid });
      } catch (err) {
        console.warn('ID token refresh failed before write', err);
        setIsSubmitting(false);
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'Unable to verify your session. Please sign out and sign in again.' });
        return;
      }

      // Try the write with a simple retry strategy (2 attempts) and a 20s per-attempt timeout.
      const addDocWithRetry = async (attempts = 2) => {
        for (let attempt = 1; attempt <= attempts; attempt++) {
          // reset abort flag for each attempt
          submissionAbortedRef.current = false;

          const p = new Promise<any>(async (resolve, reject) => {
            const timer = setTimeout(() => {
              submissionAbortedRef.current = true;
              reject(new Error('write-timeout'));
            }, 20000);

            try {
              const res = await addDoc(ridesCollection, rideData);
              clearTimeout(timer);
              resolve(res);
            } catch (err) {
              clearTimeout(timer);
              reject(err);
            }
          });

          try {
            const res = await p;
            return res;
          } catch (err: any) {
            console.warn('addDoc attempt failed', { attempt, error: err?.message || err, online: typeof navigator !== 'undefined' ? navigator.onLine : undefined, uid: user?.uid, university: userData?.university });
            // If last attempt, rethrow
            if (attempt === attempts) throw err;
            // Otherwise, small backoff before retrying
            await new Promise((r) => setTimeout(r, 500 * attempt));
          }
        }
      };

      try {
        await addDocWithRetry(2);
      } catch (err: any) {
        // Re-throw to be handled by outer catch
        throw err;
      }

      if (submissionAbortedRef.current) {
        const offline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
        console.warn('Create ride write completed after timeout — ignoring result', { offline });
        return;
      }

      console.debug('Ride created successfully', { durationMs: Date.now() - writeStart });
      toast({ title: 'Success!', description: 'Your ride has been created.' });
      router.push('/dashboard/my-rides');
    } catch (e: any) {
        console.error("Error creating ride:", e);
        // Ensure we clear the submitting state BEFORE doing anything that could throw or crash the page
        setIsSubmitting(false);

        if (e?.message === 'write-timeout') {
          toast({ variant: 'destructive', title: 'Timed out', description: 'Creating ride is taking too long. Please check your connection and try again.' });
          return;
        }

        // Show a helpful toast for the user immediately
        toast({ variant: 'destructive', title: 'Could not create ride', description: e?.message || 'An error occurred while creating the ride.' });

        // Emit the permission error for developer visibility, but do it asynchronously so the UI can update first
        try {
          const permissionError = new FirestorePermissionError({
              path: `universities/${ud.university}/rides`,
              operation: 'create',
              requestResourceData: rideData
          });
          setTimeout(() => errorEmitter.emit('permission-error', permissionError), 50);
        } catch (emitErr) {
          console.error('Failed to emit permission-error:', emitErr);
        }
        return; // we've already cleaned up
    } finally {
      // Defensive: ensure submitting is cleared if it hasn't been already
      setIsSubmitting(false);
    }
  };

  const renderSuggestionsFor = (field: 'from' | 'to') => {
    if (query.field !== field || suggestions.length === 0) return null;
    return (
      <div role="listbox" aria-label="Location suggestions" className="absolute left-0 right-0 top-full bg-popover border rounded-md mt-1 z-[10050] max-h-60 overflow-auto shadow-lg">
        <div className="px-3 py-2 text-xs text-muted-foreground border-b">Suggestions</div>
            {suggestions.map((s, idx) => (
                <button
                  key={s.place_id || `${s.lat}-${s.lon}-${idx}`}
                  role="option"
                  aria-selected={false}
                  className="w-full text-left flex flex-col p-3 hover:bg-muted cursor-pointer"
                  onMouseDown={() => handleSelectSuggestion(field, s)}
                >
                    <div className="text-sm font-medium truncate">{s.display_name}</div>
                    {s.type && <div className="text-xs text-muted-foreground truncate">{s.type}</div>}
                </button>
            ))}
        {suggestions.length === 0 && (
          <div className="p-3 text-sm text-muted-foreground">No nearby results. Try a different query.</div>
        )}
      </div>
    );
  };
  
  const isButtonDisabled = userLoading || isSubmitting || !routePolyline;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl">Offer a New Ride</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Trip Type (required)</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={uniAuto === 'toUni'} onClick={() => applyUniversitySelection('toUni')} className={`rounded-md border p-3 text-left transition focus:outline-none ${uniAuto === 'toUni' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card'}`}>
                <div className="font-medium">Going to university</div>
                <div className="text-xs text-muted-foreground mt-1">Set destination to {userData?.university === 'ned' ? 'NED University' : 'FAST University'}</div>
              </button>
              <button type="button" aria-pressed={uniAuto === 'fromUni'} onClick={() => applyUniversitySelection('fromUni')} className={`rounded-md border p-3 text-left transition focus:outline-none ${uniAuto === 'fromUni' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card'}`}>
                <div className="font-medium">Leaving from university</div>
                <div className="text-xs text-muted-foreground mt-1">Set start point to {userData?.university === 'ned' ? 'NED University' : 'FAST University'}</div>
              </button>
            </div>
          </div>

          {/* Ensure the default selection is applied on mount */}
          <script>
            { /* noop - keep TS happy; real effect below */ }
          </script>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                <FormField control={form.control} name="from" render={({ field }: any) => (
                    <FormItem className="relative">
                        <FormLabel>From</FormLabel>
                        <FormControl>
                            <div className='relative'>
                              <Input placeholder="Search for starting point" {...field} readOnly={uniAuto === 'fromUni'} className={uniAuto === 'fromUni' ? 'opacity-70 cursor-not-allowed' : ''} onChange={(e) => { if (uniAuto !== 'fromUni') { field.onChange(e); setQuery({ field: 'from', text: e.target.value }); } }} onBlur={() => setTimeout(() => setSuggestions([]), 200)} autoComplete="off" />
                              {searchLoading && query.field === 'from' && uniAuto !== 'fromUni' && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3"/>}
                              {uniAuto === 'fromUni' && <Lock className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />}
                            </div>
                        </FormControl>
                        <Button type="button" variant="link" size="sm" className={`p-0 h-auto absolute right-1 -bottom-6 ${uniAuto === 'fromUni' ? 'opacity-50 pointer-events-none' : 'text-accent'}`} onClick={() => handleChooseOnMap('from')} disabled={uniAuto === 'fromUni'}>
                          <MapPin className="w-3 h-3 mr-1" /> Choose on map
                        </Button>
                        {uniAuto !== 'fromUni' && renderSuggestionsFor('from')}
                        <FormMessage />
                    </FormItem>
                )}/>

                <FormField control={form.control} name="to" render={({ field }: any) => (
                    <FormItem className="relative">
                        <FormLabel>To</FormLabel>
                        <FormControl>
                            <div className='relative'>
                              <Input placeholder="Search for destination" {...field} readOnly={uniAuto === 'toUni'} className={uniAuto === 'toUni' ? 'opacity-70 cursor-not-allowed' : ''} onChange={(e) => { if (uniAuto !== 'toUni') { field.onChange(e); setQuery({ field: 'to', text: e.target.value }); } }} onBlur={() => setTimeout(() => setSuggestions([]), 200)} autoComplete="off" />
                              {searchLoading && query.field === 'to' && uniAuto !== 'toUni' && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3"/>}
                              {uniAuto === 'toUni' && <Lock className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />}
                            </div>
                        </FormControl>
                        <Button type="button" variant="link" size="sm" className={`p-0 h-auto absolute right-1 -bottom-6 ${uniAuto === 'toUni' ? 'opacity-50 pointer-events-none' : 'text-accent'}`} onClick={() => handleChooseOnMap('to')} disabled={uniAuto === 'toUni'}>
                          <MapPin className="w-3 h-3 mr-1" /> Choose on map
                        </Button>
                        {uniAuto !== 'toUni' && renderSuggestionsFor('to')}
                        <FormMessage />
                    </FormItem>
                )}/>
              </div>
            
              <div ref={mapContainerRef} className="h-[450px] w-full rounded-lg overflow-hidden border shadow-sm relative">
                  <MapComponent 
                    ref={mapRef} 
                    onMapClick={() => {}}
                    onRouteUpdate={handleRouteUpdate}
                    onRouteError={(err) => {
                      const msg = err?.message || 'Could not fetch route. Please try again.';
                      const isORSDown = /ORS proxy error|Status: 500|500/.test(msg);
                      const isNoRoute = /No routable path found|No route found/i.test(msg);
                      if (isORSDown) {
                        toast({ variant: 'destructive', title: 'Route Service Unavailable', description: `${msg}. Check NEXT_PUBLIC_ORS_API_KEY or try again later.` });
                      } else if (isNoRoute) {
                        toast({ variant: 'destructive', title: 'No Route Found', description: 'Could not find a routable path between those locations. Try different points or adjust the route.' });
                      } else {
                        toast({ variant: 'destructive', title: 'Route Error', description: msg });
                      }
                    }}
                    from={fromCoords}
                    to={toCoords}
                    activeMapSelect={activeMapSelect}
                  />

                  {activeMapSelect && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[1000] pointer-events-none">
                         <MapPin className="h-10 w-10 text-primary drop-shadow-lg"/>
                      </div>
                  )}
                  {activeMapSelect && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] w-full px-4">
                          <Button className="w-full" onClick={handleConfirmSelection}>
                              Confirm Location
                          </Button>
                      </div>
                  )}
              </div>

              {/* Route editor: add/reorder/remove waypoints and generate final polyline */}
              <div className="mb-6">
                <RouteEditor origin={fromCoords || null} destination={toCoords || null} onRouteGenerated={onRouteGenerated} />
                {routePolyline ? (
                  <div className="mt-2 text-xs text-muted-foreground">Route generated and ready. Bounds: {routeBounds ? `${routeBounds.minLat.toFixed(4)},${routeBounds.minLng.toFixed(4)} → ${routeBounds.maxLat.toFixed(4)},${routeBounds.maxLng.toFixed(4)}` : 'n/a'}</div>
                ) : (
                  <div className="mt-2 text-xs text-muted-foreground">No generated route yet. Add waypoints or ensure start/end are selected.</div>
                )}
              </div>

              <div className="mb-4 z-50">
                <FormField
                  control={form.control}
                  name="departureTime"
                  render={({ field }: any) => (
                    <FormItem>
                      <FormLabel>Leaving Time</FormLabel>
                      <FormControl>
                        <LeavingTimePicker
                          selected={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {distanceKm != null && durationMin != null && (
                  <div className="text-sm text-center p-2 bg-secondary rounded-md text-secondary-foreground">
                      Estimated distance: <strong>{distanceKm} km</strong> &bull; Estimated duration: <strong>{durationMin} min</strong>
                  </div>
              )}

              {!process.env.NEXT_PUBLIC_ORS_API_KEY && (
                <div className="text-sm text-center p-3 bg-destructive/20 text-destructive-foreground rounded-md border border-destructive/50">
                    <strong>Route Service Not Configured:</strong> The map cannot draw routes. Please add your OpenRouteService API key to the <strong>.env</strong> file as <code>NEXT_PUBLIC_ORS_API_KEY</code> and restart the development server.
                </div>
              )}



              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="transportMode" render={({ field }: any) => (
                    <FormItem>
                    <FormLabel>Transport Mode</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select transport mode" /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="car">Car</SelectItem>
                            <SelectItem value="bike">Bike</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}/>

                <FormField control={form.control} name="price" render={({ field }: any) => {
                    return (
                      <FormItem>
                        <FormLabel>Price per Seat (PKR)</FormLabel>

                        <FormControl>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            {...field}
                            onChange={(e) => {
                              // Keep only digits, remove decimals and non-numeric chars
                              let s = String(e.target.value || '');
                              // Remove non-digit characters
                              s = s.replace(/\D+/g, '');
                              // Remove leading zeros when more than one digit
                              if (s.length > 1) s = s.replace(/^0+/, '');
                              if (s === '') {
                                field.onChange(0);
                                setFinalPricePerSeat(0);
                              } else {
                                const n = Number(s);
                                field.onChange(n);
                                setFinalPricePerSeat(n);
                              }
                            }}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    );
                }}/>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="totalSeats" render={({ field }: any) => (
                      <FormItem>
                      <FormLabel>Total Seats</FormLabel>
                      <FormControl><Input type="number" min="1" {...field} /></FormControl>
                      <FormMessage />
                      </FormItem>
                  )}/>

                  <FormField control={form.control} name="genderAllowed" render={({ field }: any) => (
                      <FormItem>
                      <FormLabel>Gender Allowed</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select who can book" /></SelectTrigger></FormControl>
                          <SelectContent>
                              <SelectItem value="both">All Genders</SelectItem>
                              <SelectItem value="male">Male Only</SelectItem>
                              <SelectItem value="female">Female Only</SelectItem>
                          </SelectContent>
                      </Select>
                      <FormMessage />
                      </FormItem>
                  )}/>
              </div>
                  
              <div className="flex flex-col gap-2 pt-4">
                  <Button type="submit" className="w-full" size="lg" disabled={isButtonDisabled}>
                      {isSubmitting ? <Loader2 className="animate-spin" /> : 'Create Ride'}
                  </Button>
                  <Button variant="outline" type="button" onClick={() => { 
                      form.reset();
                      setFromCoords(null);
                      setToCoords(null);
                      mapRef.current?.resetMap(); 
                  }}>Reset Form & Route</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
