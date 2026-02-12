

'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addDoc, collection, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import type { Map as LeafletMap } from 'leaflet';
import L from 'leaflet';

import { Button } from '@/components/ui/button';
import RouteEditor from '@/components/RouteEditor';
import StopsViewer from '@/components/StopsViewer';
import { decodePolyline } from '@/lib/route';
import type { LatLng as RouteLatLng } from '@/lib/route';
import { calculatePricing } from '@/lib/pricing';
import { extractMeaningfulStopName, filterImportantStops, deduplicateNearbyStops, deduplicateByName } from '@/lib/stopFiltering';
import { cleanLocationName, orderStopsCorrectly, cleanAndOrderStops, isPlaceholderName, removeDuplicateLocations, createFallbackStops } from '@/lib/stopOrdering';
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

type RideFormValues = {
  from: string;
  to: string;
  departureTime: Date;
  transportMode: 'car' | 'bike';
  price: number;
  totalSeats: number;
  genderAllowed: 'male' | 'female' | 'both';
};


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
  // Called on any map click (regardless of selection mode) so parent can hide UI like popups
  onAnyMapClick?: () => void;
  onRouteError?: (err: Error) => void;
  from: LatLngLiteral | null;
  to: LatLngLiteral | null;
  activeMapSelect: 'from' | 'to' | null;
  // initialSelection allows the parent to request centering/selection on mount
  initialSelection?: { center: L.LatLngExpression; bounds?: L.LatLngBoundsExpression; radius?: number } | null;
  lockedPin?: boolean;
  // If present, this position will be rendered as a permanent locked marker on the map
  lockedPosition?: { lat: number; lng: number; name?: string } | null;
  // Function to get auth token for API calls
  getAuthToken?: () => Promise<string>;
  // University location to center map on - passed from parent
  universityLocation?: { lat: number; lng: number; name?: string } | null;
}>((props, ref) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  // Primary origin/destination markers so selected points are visible
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  // Permanent locked marker (uni) which must not be removed during selection or map movements
  const lockedMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const routeOutlineRef = useRef<L.Polyline | null>(null);  // Store outline polyline separately
  // Ref for the temporary marker used in selection mode
  const tempMarkerRef = useRef<L.Marker | null>(null);
  // Semi-transparent selection circle to indicate allowed campus radius during selection
  const selectionCircleRef = useRef<L.Circle | null>(null);
  // Preserve previous main marker location while in selection mode
  const prevMainLocRef = useRef<L.LatLng | null>(null);

  // SSR-safe cached image icon for markers (uses public/map-marker.png)
  const imageIconRef = useRef<L.Icon | null>(null);
  const getImageIcon = () => {
    if (imageIconRef.current) return imageIconRef.current;
    if (typeof window === 'undefined') return null;
    try {
      // Create a lucide-style MapPin SVG in a dark-blue color and use as data URL
      const color = '#2b2f67';
      const pinSvg = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
          <path d='M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 1 1 18 0z' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' />
          <circle cx='12' cy='10' r='3.2' fill='none' stroke='${color}' stroke-width='2' />
        </svg>
      `;
      const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(pinSvg)}`;
      // larger/thicker icon to match provided design
      imageIconRef.current = L.icon({ iconUrl: dataUrl, iconSize: [40, 62], iconAnchor: [20, 52], popupAnchor: [0, -44] });
      return imageIconRef.current;
    } catch (e) {
      return null;
    }
  };

  // Simple SVG pin generator so we can color-code origin/destination
  const makePinIcon = (fill: string, inner: string = '#ffffff') => {
    try {
      const pinSvg = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='40' height='56'>
          <path d='M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7z' fill='${fill}' stroke='#0b1220' stroke-width='1.2' />
          <circle cx='12' cy='9' r='2.8' fill='${inner}' stroke='#0b1220' stroke-width='1.2' />
        </svg>
      `;
      return L.divIcon({ 
        className: '', 
        html: pinSvg,
        iconAnchor: [20, 50],
        popupAnchor: [0, -50]
      });
    } catch {
      return (getImageIcon() as any) || undefined;
    }
  };

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
    
      // Create helper to generate an SVG data URL for colored pin icons
      const makePinDataUrl = (color: string, innerColor = '#0b1220') => {
        const pinSvg = `
          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
            <path d='M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7z' fill='${color}' stroke='%23ffffff' stroke-width='1.2' />
            <circle cx='12' cy='9' r='2.5' fill='${innerColor}' />
          </svg>
        `;
        return `data:image/svg+xml;utf8,${encodeURIComponent(pinSvg)}`;
      };

      // Pre-create a couple of icon styles to use across the map (avoid black default)
      const yellowPinUrl = makePinDataUrl('#FFD166', '#0b1220');
      const bluePinUrl = makePinDataUrl('#2563EB', '#ffffff');

      const DEFAULT_PIN_ICON = L.icon({ iconUrl: yellowPinUrl, iconSize: [34, 46], iconAnchor: [17, 46], popupAnchor: [0, -40] });
      const ALT_PIN_ICON = L.icon({ iconUrl: bluePinUrl, iconSize: [34, 46], iconAnchor: [17, 46], popupAnchor: [0, -40] });

      // Use public map marker image if available to avoid default black markers
      const IMAGE_MARKER_URL = '/map-marker.png';
      // create a local image icon but prefer the cached getter elsewhere
      try {
        // Use L.icon only if L is available
        getImageIcon();
      } catch (_) {}
    
    // Use OpenStreetMap tiles (plain/default style used elsewhere)
    // Initialize map - will be centered on university location from props or FAST default
    const mapCenter = props.universityLocation 
      ? [props.universityLocation.lat, props.universityLocation.lng] as [number, number]
      : [24.8569128, 67.2646384] as [number, number];
    mapInstanceRef.current = L.map(mapContainerRef.current).setView(mapCenter, 13);
    // If parent requested an initial selection (e.g., university lock), apply it immediately
    if (props.initialSelection && props.activeMapSelect) {
      try {
        const { center, bounds, radius } = props.initialSelection;
        try { mapInstanceRef.current.setView(center as any, 15, { animate: false }); } catch (_) {}
        // temp marker at center (only when parent explicitly entered selection mode)
        if (props.activeMapSelect) {
          if (tempMarkerRef.current) {
            tempMarkerRef.current.setLatLng(center as any);
          } else {
            tempMarkerRef.current = L.marker(center as any, { interactive: false, icon: (getImageIcon() as any) || undefined }).addTo(mapInstanceRef.current);
          }
        }
        // Draw selection circle if radius provided
        try {
          if (typeof radius === 'number') {
            if (selectionCircleRef.current) {
              selectionCircleRef.current.setLatLng(center as any).setRadius(radius as number);
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
        // Fit bounds if supplied
        try { if (bounds) mapInstanceRef.current.fitBounds(bounds); } catch (_) {}
      } catch (e) {
        console.debug('initialSelection apply failed', e);
      }
    }
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      detectRetina: true,
      subdomains: 'abc',
    }).addTo(mapInstanceRef.current);

    mapInstanceRef.current.on('click', async (e: L.LeafletMouseEvent) => {
      // Inform parent about any map click so it can hide UI like locked-pin popups
      try { props.onAnyMapClick?.(); } catch (_) {}
      if (!props.activeMapSelect) return; // Only handle clicks in selection mode
      const { lat, lng } = e.latlng;
        try {
          // Get auth token for API call
          let headers: HeadersInit = {};
          if (props.getAuthToken) {
            try {
              const token = await props.getAuthToken();
              if (token) headers = { 'Authorization': `Bearer ${token}` };
            } catch (e) {
              console.warn('Could not get auth token for reverse geocode', e);
            }
          }
          
          // Use server-side proxy to avoid CORS and ensure a valid User-Agent
          const res = await fetch(`/api/nominatim/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`, { headers });
          if (res.ok) {
            const data = await res.json();
            let name = 'Selected Location'; // Default fallback - never show coordinates
            
            // Extract a readable place name from the response
            if (data.address) {
              // Build a clean, readable place name
              const addr = data.address;
              const placeName = addr.amenity || addr.building || addr.shop || addr.office || addr.tourism || addr.leisure;
              const area = addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district;
              const road = addr.road || addr.residential || addr.pedestrian || addr.street;
              const city = addr.city || addr.town || addr.village;
              
              // Priority: specific place > road + area > area > road > city
              if (placeName && area) {
                name = `${placeName}, ${area}`;
              } else if (placeName) {
                name = placeName;
              } else if (road && area) {
                name = `${road}, ${area}`;
              } else if (area && city) {
                name = `${area}, ${city}`;
              } else if (area) {
                name = area;
              } else if (road && city) {
                name = `${road}, ${city}`;
              } else if (road) {
                name = road;
              } else if (city) {
                name = city;
              } else if (data.display_name) {
                // Use display_name but clean it up - take first 2-3 meaningful parts
                const parts = data.display_name.split(',').map((p: string) => p.trim()).filter((p: string) => p && !/^\d+$/.test(p));
                name = parts.slice(0, 3).join(', ') || 'Selected Location';
              }
            } else if (data.display_name) {
              // Clean up display_name - take first 2-3 meaningful parts
              const parts = data.display_name.split(',').map((p: string) => p.trim()).filter((p: string) => p && !/^\d+$/.test(p));
              name = parts.slice(0, 3).join(', ') || 'Selected Location';
            }
            
            // If a lockedPosition is provided and the clicked coordinates are very close to it,
            // prefer the locked position's canonical name to avoid reverse-geocode mismatches.
            try {
              const lp = props.lockedPosition;
              if (lp) {
                const tol = 0.0005; // ~50m tolerance
                if (Math.abs(lat - (lp.lat || 0)) <= tol && Math.abs(lng - (lp.lng || 0)) <= tol) {
                  name = lp.name || name;
                }
              }
            } catch (_) {}
            props.onMapClick(lat, lng, name);
            return;
          } else {
            console.warn('Nominatim reverse proxy returned non-OK', { status: res.status });
          }
        } catch (err) {
          console.error('Nominatim reverse failed', err);
        }

        // Fallback: use a generic name if proxy fails - NEVER show coordinates
        let fallbackName = 'Selected Location';
        try {
          const lp = props.lockedPosition;
          if (lp) {
            const tol = 0.0005;
            if (Math.abs(lat - (lp.lat || 0)) <= tol && Math.abs(lng - (lp.lng || 0)) <= tol) {
              fallbackName = lp.name || fallbackName;
            }
          }
        } catch (_) {}
        props.onMapClick(lat, lng, fallbackName);
    });

    // Update temp marker on map move during selection mode
    mapInstanceRef.current.on('move', () => {
      if (!props.activeMapSelect) return; // only update while actively selecting
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

    // Create or update a permanent locked marker if requested
    const lockedPos = props.lockedPosition;
    if (lockedPos) {
      if (lockedMarkerRef.current) {
        try { lockedMarkerRef.current.setLatLng([lockedPos.lat, lockedPos.lng]); } catch (_) {}
      } else {
        try {
          lockedMarkerRef.current = L.marker([lockedPos.lat, lockedPos.lng], { icon: (getImageIcon() as any) || undefined }).addTo(mapInstanceRef.current!);
          try { lockedMarkerRef.current.bindPopup(lockedPos.name || 'University'); } catch (_) {}
        } catch (_) {}
      }
    } else if (lockedMarkerRef.current) {
      try { mapInstanceRef.current.removeLayer(lockedMarkerRef.current); } catch (_) {}
      lockedMarkerRef.current = null;
    }

    // Update origin/destination markers so selected points are visible on the map
    const tol = 5e-5; // ~5m tolerance for overlapping with locked marker
    const lp = props.lockedPosition;
    const sameAsLocked = (p?: LatLngLiteral | null) => !!(lp && p && Math.abs(p.lat - lp.lat) <= tol && Math.abs(p.lng - lp.lng) <= tol);

    // Origin marker
    if (props.from && !sameAsLocked(props.from)) {
      if (startMarkerRef.current) {
        try { startMarkerRef.current.setLatLng([props.from.lat, props.from.lng]); } catch (_) {}
      } else {
        try {
          startMarkerRef.current = L.marker([props.from.lat, props.from.lng], { icon: makePinIcon('#22c55e') }).addTo(mapInstanceRef.current!);
          try { startMarkerRef.current.bindPopup(props.from.name || 'Start'); } catch (_) {}
        } catch (_) {}
      }
    } else if (startMarkerRef.current) {
      try { mapInstanceRef.current.removeLayer(startMarkerRef.current); } catch (_) {}
      startMarkerRef.current = null;
    }

    // Destination marker
    if (props.to && !sameAsLocked(props.to)) {
      if (endMarkerRef.current) {
        try { endMarkerRef.current.setLatLng([props.to.lat, props.to.lng]); } catch (_) {}
      } else {
        try {
          endMarkerRef.current = L.marker([props.to.lat, props.to.lng], { icon: makePinIcon('#ef4444') }).addTo(mapInstanceRef.current!);
          try { endMarkerRef.current.bindPopup(props.to.name || 'Destination'); } catch (_) {}
        } catch (_) {}
      }
    } else if (endMarkerRef.current) {
      try { mapInstanceRef.current.removeLayer(endMarkerRef.current); } catch (_) {}
      endMarkerRef.current = null;
    }
  }, [props.from, props.to, props.lockedPin, props.lockedPosition]);

  // Center map on university location when it changes (on initial load)
  useEffect(() => {
    if (!mapInstanceRef.current || !props.universityLocation) return;
    // Center the map on the university location when the page loads
    mapInstanceRef.current.setView([props.universityLocation.lat, props.universityLocation.lng], 13, { animate: false });
  }, [props.universityLocation?.lat, props.universityLocation?.lng]);

  useEffect(() => {
    // CLEANUP: Clear previous route immediately when coordinates change (before drawing new route)
    const clearRoute = () => {
      console.log('[ROUTE] Clearing previous route');
      if (mapInstanceRef.current) {
        // Remove route outline first
        if (routeOutlineRef.current) {
          try {
            mapInstanceRef.current.removeLayer(routeOutlineRef.current);
          } catch (e) {
            console.debug('[ROUTE] Error removing route outline layer:', e);
          }
          routeOutlineRef.current = null;
        }
        // Remove main route polyline
        if (routeLayerRef.current) {
          try {
            mapInstanceRef.current.removeLayer(routeLayerRef.current);
          } catch (e) {
            console.debug('[ROUTE] Error removing route layer:', e);
          }
          routeLayerRef.current = null;
        }
      }
      props.onRouteUpdate(null, null);
    };

    const drawRoute = async (start: LatLngLiteral, end: LatLngLiteral) => {
        // Wait up to 5 seconds for map to be initialized
        let mapReady = false;
        let waitCount = 0;
        while (!mapInstanceRef.current && waitCount < 50) {
          await new Promise(r => setTimeout(r, 100));
          waitCount++;
        }
        
        if (!mapInstanceRef.current) {
          console.warn('[ROUTE] Map not initialized after waiting 5 seconds');
          props.onRouteUpdate(null, null);
          return;
        }
        
        console.log('[ROUTE] Starting route generation from', start, 'to', end);
        // Clear any previous route
        if (routeLayerRef.current) {
            mapInstanceRef.current.removeLayer(routeLayerRef.current);
            routeLayerRef.current = null;
        }

        if (!process.env.NEXT_PUBLIC_ORS_API_KEY) {
            console.warn('[ROUTE] ORS API key missing. Cannot draw route. Please add NEXT_PUBLIC_ORS_API_KEY to your .env file.');
            props.onRouteUpdate(null, null);
            return;
        }
        
        // Validate coordinates before making API call
        if (!start || !start.lat || !start.lng || !end || !end.lat || !end.lng) {
          console.warn('[ROUTE] Invalid coordinates:', { start, end });
          props.onRouteUpdate(null, null);
          props.onRouteError?.(new Error('Invalid start or end coordinates'));
          return;
        }
        
        // Ensure coordinates are numbers
        const startLat = Number(start.lat);
        const startLng = Number(start.lng);
        const endLat = Number(end.lat);
        const endLng = Number(end.lng);
        
        if (!Number.isFinite(startLat) || !Number.isFinite(startLng) || !Number.isFinite(endLat) || !Number.isFinite(endLng)) {
          console.warn('[ROUTE] Non-numeric coordinates:', { startLat, startLng, endLat, endLng });
          props.onRouteUpdate(null, null);
          props.onRouteError?.(new Error('Coordinates must be valid numbers'));
          return;
        }
        
        const body = { coordinates: [[startLng, startLat], [endLng, endLat]] };

        const maxAttempts = 2; // Reduced from 3 to 2 for faster failure feedback
        let attempt = 0;
        let lastErr: any = null;

        while (attempt < maxAttempts) {
          attempt++;
            // Use longer timeout for client to wait for server proxy: 16s base, 22s on retry
            const timeoutMs = attempt === 1 ? 16000 : 22000;
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                const response = await fetch('/api/ors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                }).finally(() => clearTimeout(timeoutId));

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

                    // If ORS returns a client error (4xx), it's likely "no route found" or bad request — don't retry
                    if (response.status >= 400 && response.status < 500) {
                        console.warn('ORS returned client error (no route found)', { status: response.status, short });
                        props.onRouteUpdate(null, null);
                        props.onRouteError?.(new Error('No route found. Please select different locations that are connected by roads.'));
                        return;
                    }

                    // For server errors (5xx) or other statuses, throw to trigger retry/backoff
                    throw new Error(`ORS proxy error: ${response.status} — ${short}`);
                }

                let routeData: any;
                try {
                  routeData = await response.json();
                } catch (parseErr) {
                  console.error('[ROUTE] Failed to parse response JSON:', parseErr);
                  throw new Error(`Failed to parse route response: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
                }

                if (!routeData.features || routeData.features.length === 0) {
                    console.warn('[ROUTE] No features in response');
                    props.onRouteUpdate(null, null);
                    props.onRouteError?.(new Error('No route found. Please select different locations and try again.'));
                    return;
                }

                const feature = routeData.features[0];
                if (!feature.geometry || !feature.geometry.coordinates || feature.geometry.coordinates.length === 0) {
                    console.warn('[ROUTE] Invalid geometry in response:', feature);
                    props.onRouteUpdate(null, null);
                    props.onRouteError?.(new Error('Invalid route data. Please select different locations and try again.'));
                    return;
                }

                console.log('[ROUTE] Route data received, drawing polyline with', feature.geometry.coordinates.length, 'coordinates');
                const coordinates = feature.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
                // Decide route color: if one endpoint equals lockedPosition, use primary (blue)
                const lockedPos = props.lockedPosition;
                const startIsLocked = lockedPos && start && Math.abs(start.lat - lockedPos.lat) < 1e-6 && Math.abs(start.lng - lockedPos.lng) < 1e-6;
                const endIsLocked = lockedPos && end && Math.abs(end.lat - lockedPos.lat) < 1e-6 && Math.abs(end.lng - lockedPos.lng) < 1e-6;
                const routeColor = (lockedPos && (startIsLocked || endIsLocked)) ? '#3F51B5' : '#9575CD';
                
                // Remove OLD route layers before creating new one
                if (routeOutlineRef.current) {
                  mapInstanceRef.current.removeLayer(routeOutlineRef.current);
                  routeOutlineRef.current = null;
                }
                if (routeLayerRef.current) {
                  mapInstanceRef.current.removeLayer(routeLayerRef.current);
                  routeLayerRef.current = null;
                }
                
                // Create single polyline with glow effect via CSS/opacity instead of double rendering
                const polyline = L.polyline(coordinates, { color: routeColor, weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(mapInstanceRef.current);
                routeLayerRef.current = polyline;
                console.log('[ROUTE] Polyline drawn successfully with', coordinates.length, 'coordinates');
                
                // Only fit the map to the route if the user is NOT actively selecting a point — avoid interrupting selection
                if (!props.activeMapSelect) {
                    try { mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50], animate: false }); } catch (_) {}
                }

                // Extract and update route summary
                const summary = feature.properties?.summary;
                if (summary) {
                    console.log('[ROUTE] Route summary:', { distance: summary.distance, duration: summary.duration });
                    props.onRouteUpdate(summary.distance / 1000, summary.duration / 60);
                } else {
                    console.warn('[ROUTE] No summary in route properties');
                    props.onRouteUpdate(null, null);
                }

                // success — break retry loop
                return;
            } catch (error) {
              lastErr = error;
              const isTimeout = error instanceof Error && error.name === 'AbortError';
              if (isTimeout) {
                // Timeout: avoid printing the full error stack which can be noisy in console
                console.warn(`[ROUTE] Route fetch attempt ${attempt} aborted due to timeout (${timeoutMs}ms)`);
              } else {
                console.warn(`\n[ROUTE] Route fetch attempt ${attempt} failed:`, error);
              }
              // Faster backoff: 200ms instead of 500ms * attempt
              if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 200));
            }
        }

        // If we reach here, all attempts failed
        console.error('[ROUTE] All route attempts failed', lastErr);
        const isTimeoutFinal = lastErr instanceof Error && lastErr.name === 'AbortError';
        if (isTimeoutFinal) {
          props.onRouteUpdate(null, null);
          props.onRouteError?.(new Error('Route request timed out. Please try selecting your locations again.'));
        } else {
          props.onRouteUpdate(null, null);
          props.onRouteError?.(new Error('Unable to find a route. Please select different locations that are connected by roads.'));
        }
    };
    
    if (props.from && props.to) {
        console.log('[ROUTE] ✓ Effect triggered: Both from and to are set');
        console.log('[ROUTE]   FROM:', props.from);
        console.log('[ROUTE]   TO:', props.to);
        drawRoute(props.from, props.to);
    } else {
        // If either from or to is missing, clear the route
        console.log('[ROUTE] ✗ Effect triggered but coordinates missing - clearing route');
        console.log('[ROUTE]   FROM:', props.from ? 'SET' : 'NULL');
        console.log('[ROUTE]   TO:', props.to ? 'SET' : 'NULL');
        clearRoute();
    }

    // Cleanup: Clear route when component unmounts or dependencies change
    return () => {
      // We don't clear the route here as it would cause flashing between route changes
      // The cleanup happens at the start of the next effect run with clearRoute()
    };
  // Use stringified values for proper deep comparison of coordinate objects
  }, [props.from?.lat, props.from?.lng, props.to?.lat, props.to?.lng]);


  useImperativeHandle(ref, () => ({
    resetMap: () => {
      if (mapInstanceRef.current) {
        if (startMarkerRef.current) mapInstanceRef.current.removeLayer(startMarkerRef.current);
        if (endMarkerRef.current) mapInstanceRef.current.removeLayer(endMarkerRef.current);
        if (routeOutlineRef.current) mapInstanceRef.current.removeLayer(routeOutlineRef.current);
        if (routeLayerRef.current) mapInstanceRef.current.removeLayer(routeLayerRef.current);
      }
      startMarkerRef.current = null;
      endMarkerRef.current = null;
      routeLayerRef.current = null;
      // Center map on university location if available, otherwise use FAST University coordinates
      const centerLat = props.universityLocation?.lat || 24.8569128;
      const centerLng = props.universityLocation?.lng || 67.2646384;
      mapInstanceRef.current?.setView([centerLat, centerLng], 13);
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
        // Only show selection UI if the parent has entered selection mode.
        // This prevents automatic pendingSelection from creating a visible temp pin.
        if (props.activeMapSelect) {
          // Keep existing origin/destination pins visible; only show a temporary center pin for selection

          // show temp marker at center
          if (tempMarkerRef.current) {
            tempMarkerRef.current.setLatLng(center as any);
          } else {
            tempMarkerRef.current = L.marker(center as any, { interactive: false, icon: (getImageIcon() as any) || undefined }).addTo(mapInstanceRef.current);
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
        }
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
        // No need to restore any main marker; origin/destination pins persist outside selection
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
        // Remove OLD route layers (both outline and main polyline)
        if (routeOutlineRef.current) {
          mapInstanceRef.current.removeLayer(routeOutlineRef.current);
          routeOutlineRef.current = null;
        }
        if (routeLayerRef.current) {
          mapInstanceRef.current.removeLayer(routeLayerRef.current);
          routeLayerRef.current = null;
        }
        if (!coords || coords.length === 0) return;
        const ll = coords.map(c => [c.lat, c.lng] as [number, number]);
        // Choose color blue if one endpoint matches locked position
        const lockedPos2 = props.lockedPosition;
        const start = ll[0] ? { lat: ll[0][0], lng: ll[0][1] } : null;
        const end = ll[ll.length - 1] ? { lat: ll[ll.length - 1][0], lng: ll[ll.length - 1][1] } : null;
        const startLocked = lockedPos2 && start && Math.abs(start.lat - lockedPos2.lat) < 1e-6 && Math.abs(start.lng - lockedPos2.lng) < 1e-6;
        const endLocked = lockedPos2 && end && Math.abs(end.lat - lockedPos2.lat) < 1e-6 && Math.abs(end.lng - lockedPos2.lng) < 1e-6;
        const color = (lockedPos2 && (startLocked || endLocked)) ? '#3F51B5' : '#9575CD';
        // Create NEW route layers
        const polylineOutline = L.polyline(ll, { color: '#ffffff', weight: 10, opacity: 0.7 }).addTo(mapInstanceRef.current);
        const polyline = L.polyline(ll, { color, weight: 6, opacity: 0.95 }).addTo(mapInstanceRef.current);
        // Store both references for future cleanup
        routeOutlineRef.current = polylineOutline;
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

// Geocoding cache to prevent repeated API calls
const geocodingCache = new Map<string, string>();

function getCacheKey(lat: number, lng: number): string {
  // Round to 4 decimal places (~11 meters precision) for cache key
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

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
  const [generatedStops, setGeneratedStops] = useState<any[] | null>(null);
  const [stopsLoading, setStopsLoading] = useState(false);
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
    lat: 24.9302091,
    lng: 67.1148119,
    name: 'NED UET, University Road, Gulshan-e-Iqbal Town, Gulshan District, Karachi Division, Sindh, 75300, Pakistan',
  };
  const KARACHI_UNI: LatLngLiteral = {
    lat: 24.9401,
    lng: 67.1200,
    name: 'University of Karachi, Main University Road, Karachi, Sindh, 75270, Pakistan',
  };

  const UNI_MAX_RADIUS_METERS = 4000; // allow ~4km radius from campus center

  const getUniversityShortName = () => {
    const uni = (userData?.university || '').toString().toLowerCase();
    if (uni === 'ned') return 'NED University';
    if (uni === 'karachi') return 'Karachi University';
    return 'FAST University';
  };

  const getCurrentUniversity = () => {
    const uni = (userData?.university || '').toString().toLowerCase();
    if (uni === 'ned') return NED_UNI;
    if (uni === 'karachi') return KARACHI_UNI;
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
    const uniShortName = getUniversityShortName();
    if (sel === 'toUni') {
      // Set destination to the student's university (exact coordinates)
      form.setValue('to', uniShortName);
      setToCoords(uni);
      // Always clear opposite field and coords so switching presets behaves predictably
      form.setValue('from', '');
      setFromCoords(null);
      // Set the map to show the university with a small zoom area
      const smallRadius = 500; // 500 meters for visualization
      const deltaLat = smallRadius / 111000;
      const deltaLng = smallRadius / (111000 * Math.cos(uni.lat * Math.PI / 180));
      const bounds: L.LatLngBoundsExpression = [[uni.lat - deltaLat, uni.lng - deltaLng], [uni.lat + deltaLat, uni.lng + deltaLng]];
      setPendingSelection?.({ center: [uni.lat, uni.lng], bounds, radius: smallRadius });
    } else if (sel === 'fromUni') {
      // Set starting point to the student's university (exact coordinates)
      form.setValue('from', uniShortName);
      setFromCoords(uni);
      // Always clear opposite field and coords so switching presets behaves predictably
      form.setValue('to', '');
      setToCoords(null);
      // Set the map to show the university with a small zoom area
      const smallRadius = 500; // 500 meters for visualization
      const deltaLat = smallRadius / 111000;
      const deltaLng = smallRadius / (111000 * Math.cos(uni.lat * Math.PI / 180));
      const bounds: L.LatLngBoundsExpression = [[uni.lat - deltaLat, uni.lng - deltaLng], [uni.lat + deltaLat, uni.lng + deltaLng]];
      setPendingSelection?.({ center: [uni.lat, uni.lng], bounds, radius: smallRadius });
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
  
  // Clear stops when route endpoints or route itself changes to trigger regeneration
  useEffect(() => {
    // Clear stops when coordinates or route changes (route will regenerate)
    setGeneratedStops(null);
  }, [fromCoords?.lat, fromCoords?.lng, toCoords?.lat, toCoords?.lng, routeLatLngs]);
  
  const [activeMapSelect, setActiveMapSelect] = useState<'from' | 'to' | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ center: L.LatLngExpression; bounds?: L.LatLngBoundsExpression; radius?: number } | null>(null);
  

  // When the MapComponent becomes ready, apply any pending university-centered selection
  useEffect(() => {
    if (!pendingSelection) return;
    try {
      if (mapRef.current && typeof mapRef.current.enterSelectionMode === 'function') {
        mapRef.current.enterSelectionMode(pendingSelection.center, pendingSelection.bounds, pendingSelection.radius);
        setPendingSelection(null);
      }
    } catch (e) {
      console.debug('Failed to apply pendingSelection; will retry on next render.', e);
    }
  }, [pendingSelection, mapRef.current]);

  const form = useForm({
    resolver: zodResolver(rideSchema),
    defaultValues: { from: '', to: '', departureTime: undefined as any, price: 200, totalSeats: 4, genderAllowed: 'both', transportMode: 'car' },
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
        
        const res = await fetch(`/api/nominatim/reverse?lat=${encodeURIComponent(chosenLatLng.lat)}&lon=${encodeURIComponent(chosenLatLng.lng)}`, { headers });
        let name = 'Selected Location'; // Default fallback - never show coordinates
        if (res.ok) {
          const data = await res.json();
          if (data && data.address) {
            // Build a clean, readable place name
            const addr = data.address;
            const placeName = addr.amenity || addr.building || addr.shop || addr.office || addr.tourism || addr.leisure;
            const area = addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district;
            const road = addr.road || addr.residential || addr.pedestrian || addr.street;
            const city = addr.city || addr.town || addr.village;
            
            // Priority: specific place > road + area > area > road > city
            if (placeName && area) {
              name = `${placeName}, ${area}`;
            } else if (placeName) {
              name = placeName;
            } else if (road && area) {
              name = `${road}, ${area}`;
            } else if (area && city) {
              name = `${area}, ${city}`;
            } else if (area) {
              name = area;
            } else if (road && city) {
              name = `${road}, ${city}`;
            } else if (road) {
              name = road;
            } else if (city) {
              name = city;
            } else if (data.display_name) {
              // Clean up display_name - take first 2-3 meaningful parts
              const parts = data.display_name.split(',').map((p: string) => p.trim()).filter((p: string) => p && !/^\d+$/.test(p));
              name = parts.slice(0, 3).join(', ') || 'Selected Location';
            }
          } else if (data && data.display_name) {
            // Clean up display_name - take first 2-3 meaningful parts
            const parts = data.display_name.split(',').map((p: string) => p.trim()).filter((p: string) => p && !/^\d+$/.test(p));
            name = parts.slice(0, 3).join(', ') || 'Selected Location';
          }
        } else {
          try {
            const errJson = await res.json();
            console.warn('Nominatim reverse proxy returned non-OK', errJson);
          } catch (e) {
            console.warn('Nominatim reverse proxy returned non-OK status', { status: res.status });
          }
        }

        form.setValue(activeMapSelect!, name, { shouldValidate: true, shouldDirty: true });
        if (activeMapSelect === 'from') {
          setFromCoords({ lat: chosenLatLng.lat, lng: chosenLatLng.lng, name });
        } else {
          setToCoords({ lat: chosenLatLng.lat, lng: chosenLatLng.lng, name });
        }
      } catch (e) {
        console.error("Reverse geocoding failed", e);
        // Use generic fallback - NEVER show coordinates
        const fallbackName = 'Selected Location';
        form.setValue(activeMapSelect!, fallbackName, { shouldValidate: true, shouldDirty: true });
        if (activeMapSelect === 'from') {
          setFromCoords({ lat: chosenLatLng.lat, lng: chosenLatLng.lng, name: fallbackName });
        } else {
          setToCoords({ lat: chosenLatLng.lat, lng: chosenLatLng.lng, name: fallbackName });
        }
      } finally {
        mapRef.current?.exitSelectionMode();
        setActiveMapSelect(null);
      }
    };


    // Proceed with reverse geocoding and finalization regardless of distance
    await finalizeSelection(latLng);
  };

  // Handle a click from the map component (reverse geocode result provided by MapComponent)
  const handleMapClick = (lat: number, lng: number, name: string) => {
    if (!activeMapSelect) return;

    // Prefer canonical university names when the clicked point lies within a university radius
    const ned = NED_UNI;
    const fast = FAST_UNI;
    const karachi = KARACHI_UNI;
    const clicked = { lat, lng };
    const nearNed = distanceInMeters(clicked, { lat: ned.lat, lng: ned.lng }) <= UNI_MAX_RADIUS_METERS;
    const nearFast = distanceInMeters(clicked, { lat: fast.lat, lng: fast.lng }) <= UNI_MAX_RADIUS_METERS;
    const nearKarachi = distanceInMeters(clicked, { lat: karachi.lat, lng: karachi.lng }) <= UNI_MAX_RADIUS_METERS;

    const finalName = nearNed ? ned.name : (nearFast ? fast.name : (nearKarachi ? karachi.name : name));

    // Apply immediately and exit selection mode
    if (activeMapSelect === 'from') {
      form.setValue('from', finalName, { shouldValidate: true, shouldDirty: true });
      setFromCoords({ lat, lng, name: finalName });
    } else {
      form.setValue('to', finalName, { shouldValidate: true, shouldDirty: true });
      setToCoords({ lat, lng, name: finalName });
    }

    try { mapRef.current?.exitSelectionMode(); } catch (_) {}
    setActiveMapSelect(null);
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
      
      // Generate stops from waypoints or sample route points
      try {
        // Dynamic stop count based on route distance - REDUCED to prevent excessive API calls
        const routeDistanceKm = data.distanceMeters ? data.distanceMeters / 1000 : 0;
        const getTargetStopCount = (distanceKm: number) => {
          if (distanceKm < 5) return 5;
          if (distanceKm < 15) return 5;
          if (distanceKm < 30) return 6;
          return 7; // Maximum 7 stops for any route
        };
        const targetStopCount = getTargetStopCount(routeDistanceKm);
        const maxStops = Math.min(7, targetStopCount); // Hard limit of 7 stops
        
        let stops: any[] = [];
        
        // Always use full route sampling - ignore waypoints and sample from full polyline
        if (latlngs && latlngs.length > 0) {
          const n = latlngs.length;
          
          // Calculate cumulative distances first
          let cumulativeDistance = 0;
          const distances: number[] = [0];
          for (let i = 1; i < latlngs.length; i++) {
            const lat1 = latlngs[i-1].lat, lng1 = latlngs[i-1].lng;
            const lat2 = latlngs[i].lat, lng2 = latlngs[i].lng;
            const R = 6371e3; // meters
            const φ1 = lat1 * Math.PI / 180;
            const φ2 = lat2 * Math.PI / 180;
            const Δφ = (lat2 - lat1) * Math.PI / 180;
            const Δλ = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            cumulativeDistance += R * c;
            distances.push(cumulativeDistance);
          }
          
          const totalDistance = distances[distances.length - 1];
          const targetStopDistance = totalDistance / (maxStops - 1); // Distance between stops
          
          // Select stops at regular intervals
          const idxs: number[] = [0]; // Always include start
          let targetDist = targetStopDistance;
          
          for (let i = 1; i < n - 1; i++) {
            if (distances[i] >= targetDist) {
              idxs.push(i);
              targetDist += targetStopDistance;
            }
          }
          idxs.push(n - 1); // Always include end
          
          stops = idxs.map((i, idx) => ({
            id: `stop_${Date.now()}_${idx}_${Math.random()}`,
            name: 'Loading...', // Placeholder until real name is fetched
            lat: latlngs[i].lat,
            lng: latlngs[i].lng,
            order: idx,
            distanceFromStart: Math.round(distances[i] || 0),
            type: idx === 0 ? 'start' : (idx === idxs.length - 1 ? 'end' : 'route'),
            isCustom: false,
            isAutoGenerated: true
          }));
        }
        
        if (stops && stops.length > 0) {
          const finalStops = stops;
          const currentUni = getCurrentUniversity();
          const uniShortName = getUniversityShortName();
          
          console.log('[STOPS] Processing', finalStops.length, 'stops...');
          
          // Set loading state
          setStopsLoading(true);
          setGeneratedStops(null);
          
          // Fetch place names with rate limiting to prevent API overload
          (async () => {
            try {
              // Get auth token for API calls
              let authToken = '';
              try {
                if (user) {
                  authToken = await user.getIdToken();
                }
              } catch (e) {
                console.warn('[STOPS] Could not get auth token:', e);
              }
              
              // Process stops in small batches to avoid rate limiting
              const BATCH_SIZE = 3;
              const DELAY_BETWEEN_BATCHES = 500; // ms
              
              // Function to geocode a single stop
              const geocodeStop = async (stop: any, idx: number): Promise<any> => {
                try {
                  // Check if this stop is at the university location (within 500m)
                  const isUniStop = distanceInMeters(currentUni, { lat: stop.lat, lng: stop.lng }) < 500;
                  
                  if (isUniStop) {
                    console.log(`[STOPS] Stop ${idx + 1}: University (${uniShortName})`);
                    return { ...stop, name: uniShortName };
                  }
                  
                  // Check cache first
                  const cacheKey = getCacheKey(stop.lat, stop.lng);
                  const cachedName = geocodingCache.get(cacheKey);
                  
                  if (cachedName) {
                    console.log(`[STOPS] Stop ${idx + 1}: "${cachedName}" (cached)`);
                    return { ...stop, name: cachedName };
                  }
                  
                  // Single attempt geocoding - no retries to reduce API calls
                  let placeName = '';
                  
                  try {
                    const fetchHeaders: HeadersInit = {
                      'Content-Type': 'application/json'
                    };
                    
                    if (authToken) {
                      fetchHeaders['Authorization'] = `Bearer ${authToken}`;
                    }
                    
                    const res = await fetch(`/api/nominatim/reverse?lat=${stop.lat}&lon=${stop.lng}`, {
                      method: 'GET',
                      headers: fetchHeaders,
                      signal: AbortSignal.timeout(15000)
                    });
                      
                    if (res.ok) {
                      const data = await res.json();
                      
                      if (data.address) {
                        const addr = data.address;
                        const landmark = addr.amenity || addr.shop || addr.building || addr.office ||
                                        addr.tourism || addr.leisure || addr.historic || addr.university ||
                                        addr.hospital || addr.school || addr.college || addr.mosque || addr.church;
                        const road = addr.road || addr.street || addr.avenue || addr.boulevard ||
                                    addr.highway || addr.path || addr.residential;
                        const area = addr.neighbourhood || addr.suburb || addr.quarter ||
                                    addr.city_district || addr.hamlet;
                        const city = addr.city || addr.town || addr.village || addr.municipality;

                        if (landmark) {
                          placeName = area ? `${landmark}, ${area}` : landmark;
                        } else if (road && area) {
                          placeName = `${road}, ${area}`;
                        } else if (road && city) {
                          placeName = `${road}, ${city}`;
                        } else if (area && city) {
                          placeName = `${area}, ${city}`;
                        } else if (area) {
                          placeName = area;
                        } else if (road) {
                          placeName = road;
                        } else if (city) {
                          placeName = city;
                        }
                      }

                      if (!placeName && data.display_name) {
                        const meaningful = extractMeaningfulStopName(data.display_name);
                        placeName = meaningful || placeName;
                      }

                      if (!placeName && data.display_name) {
                        const parts = data.display_name.split(',')
                          .map((p: string) => p.trim())
                          .filter((p: string) => p && !/^\d+$/.test(p) && p.length > 2);

                        if (parts.length >= 2) {
                          placeName = `${parts[0]}, ${parts[1]}`;
                        } else if (parts.length === 1) {
                          placeName = parts[0];
                        }
                      }
                  } else if (res.status === 429) {
                      console.warn(`[STOPS] Stop ${idx + 1}: Rate limited (429)`);
                    }
                  } catch (fetchErr: any) {
                    const isTimeout = fetchErr?.name === 'AbortError' || fetchErr?.code === 'ETIMEDOUT' || fetchErr?.message?.includes('timeout');
                    const errMsg = isTimeout ? 'timeout' : fetchErr.message || 'network error';
                    console.error(`[STOPS] Stop ${idx + 1}: Fetch error (${errMsg})`);
                  }
                  
                  // Validate and store result
                  if (placeName && placeName.length > 2 && 
                      !placeName.match(/^\d+\.\d+/) && !placeName.match(/^-?\d+$/)) {
                    geocodingCache.set(cacheKey, placeName);
                    console.log(`[STOPS] Stop ${idx + 1}: "${placeName}"`);
                    return { ...stop, name: placeName };
                  } else {
                    // Use position-based fallback for unnamed stops
                    // This helps identify which stop failed without duplicate names
                    console.warn(`[STOPS] Stop ${idx + 1}: No name found, using fallback`);
                    return { ...stop, name: `Stop ${idx + 1}` };
                  }
                } catch (e) {
                  console.error(`[STOPS] Stop ${idx + 1}: Unexpected error:`, e instanceof Error ? e.message : String(e));
                  return { ...stop, name: `Stop ${idx + 1}` };
                }
              };
              
              const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
              const runInChunks = async <T extends { distanceFromStart?: number },>(items: T[], size: number, fn: (item: T, idx: number) => Promise<any>) => {
                const results: any[] = [];
                for (let i = 0; i < items.length; i += size) {
                  const chunk = items.slice(i, i + size);
                  try {
                    const chunkResults = await Promise.all(
                      chunk.map((item, idx) => fn(item, i + idx).catch(err => {
                        console.warn(`[STOPS] Chunk item ${i + idx} failed:`, err);
                        // Distance-based fallback instead of "Stop X"
                        const distKm = ((item.distanceFromStart || 0) / 1000).toFixed(1);
                        return { ...item, name: `Route Point (${distKm}km)` };
                      }))
                    );
                    results.push(...chunkResults);
                    
                    // Progressive update: show stops as they load (with proper ordering)
                    if (results.length > 0 && i === 0) {
                      console.log('[STOPS] First chunk ready, updating UI...');
                      const orderedResults = orderStopsCorrectly(results);
                      setGeneratedStops([...orderedResults]);
                    }
                  } catch (chunkErr) {
                    console.error(`[STOPS] Chunk ${i}-${i + size} failed:`, chunkErr);
                    // Add distance-based fallback names for failed chunk
                    const fallbacks = chunk.map((item, idx) => {
                      const distKm = ((item.distanceFromStart || 0) / 1000).toFixed(1);
                      return {
                        ...item,
                        name: `Route Point (${distKm}km)`
                      };
                    });
                    results.push(...fallbacks);
                  }
                  
                  // Add delay between batches to prevent rate limiting
                  if (i + size < items.length) {
                    await sleep(DELAY_BETWEEN_BATCHES);
                  }
                }
                return results;
              };

              // Process stops in batches with delay to prevent rate limiting
              console.log('[STOPS] Geocoding', finalStops.length, 'stops in batches...');
              const stopsWithNames = await runInChunks(finalStops, BATCH_SIZE, geocodeStop);
              
              console.log('[STOPS] All names resolved:', stopsWithNames.map((s, i) => `${i+1}:"${s.name}"`).join(', '));
              
              // Clean location names (remove addresses, use clean names)
              const cleanedStops = stopsWithNames.map(s => ({
                ...s,
                name: cleanLocationName(s.name)
              }));
              console.log('[STOPS] After cleaning names:', cleanedStops.map((s, i) => `${i+1}:"${s.name}"`).join(', '));
              
              // CRITICAL FIX: Never remove START or END stops, even if at same location
              // Preserve all stops - START is always first, END is always last by type
              let deduped = cleanedStops;
              
              // Only deduplicate INTERMEDIATE stops (not START or END)
              const startStop = cleanedStops.find(s => s.type === 'start');
              const endStop = cleanedStops.find(s => s.type === 'end');
              const intermediateStops = cleanedStops.filter(s => s.type !== 'start' && s.type !== 'end');
              
              // Deduplicate intermediate stops but NEVER remove START/END
              const dedupedIntermediate = removeDuplicateLocations(intermediateStops);
              
              // Rebuild: START + deduplicated intermediate + END
              deduped = [];
              if (startStop) deduped.push(startStop);
              deduped.push(...dedupedIntermediate);
              if (endStop && !deduped.some(s => s.id === endStop.id)) deduped.push(endStop);
              
              console.log('[STOPS] After protecting START/END:', deduped.length, 'stops:', deduped.map(s => s.name).join(' → '));
              
              // Additional deduplication: Remove consecutive INTERMEDIATE stops with identical names (but keep START/END)
              const dedupedByName: typeof deduped = [];
              let lastName = '';
              for (const stop of deduped) {
                const isStartOrEnd = stop.type === 'start' || stop.type === 'end';
                if (isStartOrEnd) {
                  // Always keep START and END
                  dedupedByName.push(stop);
                  lastName = stop.name;
                } else if (stop.name !== lastName) {
                  // Only keep intermediate stops with different names
                  dedupedByName.push(stop);
                  lastName = stop.name;
                } else {
                  console.log(`[STOPS] Skipping duplicate named stop: "${stop.name}"`);
                }
              }
              
              console.log('[STOPS] After name dedup:', dedupedByName.length, 'stops:', dedupedByName.map(s => s.name).join(' → '));

              const ensureMinStops = (baseStops: any[], allStops: any[], minCount: number) => {
                // CRITICAL: Never return less than what's provided, especially for START/END
                if (baseStops.length === 0) return baseStops;
                
                // Preserve START and END stops AT ALL COSTS
                const startStop = baseStops.find(s => s.type === 'start');
                const endStop = baseStops.find(s => s.type === 'end');
                const intermediateStops = baseStops.filter(s => s.type !== 'start' && s.type !== 'end');
                
                // Build final array: START + all intermediates + END
                const result: any[] = [];
                if (startStop) result.push(startStop);
                result.push(...intermediateStops); // Keep ALL intermediate stops
                if (endStop) result.push(endStop);
                
                // ALWAYS sort by distance to maintain proper ordering
                return orderStopsCorrectly(result);
              };

              const finalStopsWithMin = ensureMinStops(dedupedByName, cleanedStops, targetStopCount);

              // Final validation: ensure all stops have real names and proper ordering
              const validatedStops = finalStopsWithMin.map(stop => ({
                ...stop,
                name: isPlaceholderName(stop.name) ? cleanLocationName(stop.name) : stop.name
              }));

              // CRITICAL: Apply final ordering to ensure START is first, END is last
              const finalOrderedStops = orderStopsCorrectly(validatedStops);

              // UPDATE STATE ONLY ONCE with complete, properly ordered array
              console.log('[STOPS] FINAL RENDER:', finalOrderedStops.length, 'stops', finalOrderedStops.map((s, i) => `${i+1}:${s.type}:"${s.name}"`).join(', '));
              setGeneratedStops([...finalOrderedStops]);
              setStopsLoading(false);
            } catch (e) {
              console.error('[STOPS] Fatal error:', e);
              const fallbackStops = finalStops.map((s: any, idx: number) => ({
                ...s,
                name: cleanLocationName(s.name)
              }));
              // Ensure proper ordering even in fallback
              const orderedFallback = orderStopsCorrectly(fallbackStops);
              setGeneratedStops([...orderedFallback]);
              setStopsLoading(false);
            }
          })();
        } else {
          setGeneratedStops(null);
          setStopsLoading(false);
        }
      } catch (stopsErr) {
        console.warn('Failed to generate stops preview:', stopsErr);
        setGeneratedStops(null);
        setStopsLoading(false);
      }
      
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
  const [suggestLimit, setSuggestLimit] = useState<number>(20);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);
  
  // Cache the Firebase auth token for search suggestions to avoid repeated async calls and speed up suggestions
  const searchTokenRef = useRef<string | null>(null);
  const searchTokenTimeRef = useRef<number>(0);
  const searchNominatim = async (q: string, limit: number) => {
    if (q.length < 1) return []; // Allow even single character for instant suggestions
    if (!user) {
      console.warn('[SEARCH] No user authenticated');
      return [];
    }
    const queryText = q.trim().toLowerCase() === 'all' ? 'karachi' : q;
    console.log('[SEARCH] Searching Nominatim for:', queryText);
    try {
      // Cache the token for 30 minutes (Firebase tokens are valid for 1 hour) - aggressive caching for speed
      const now = Date.now();
      if (!searchTokenRef.current || now - searchTokenTimeRef.current > 30 * 60 * 1000) {
        try {
          searchTokenRef.current = await user.getIdToken();
          searchTokenTimeRef.current = now;
        } catch (e) {
          console.warn('Could not get auth token for search', e);
          return [];
        }
      }
      const token = searchTokenRef.current;
      // Karachi-wide bounding box to include large and small places
      const KARACHI_VIEWBOX = { minLon: 66.5, minLat: 24.6, maxLon: 67.5, maxLat: 25.5 };
      const viewbox = `${KARACHI_VIEWBOX.minLon},${KARACHI_VIEWBOX.maxLat},${KARACHI_VIEWBOX.maxLon},${KARACHI_VIEWBOX.minLat}`;
      const params = new URLSearchParams({
        q: queryText,
        format: 'jsonv2',
        limit: String(Math.max(1, Math.min(50, limit || 20))),
        countrycodes: 'pk',
        addressdetails: '1',
        viewbox: viewbox,
        bounded: '1'
      });
      const res = await fetch(`/api/nominatim/search?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        priority: 'high' as RequestInit['priority']
      });
      if (!res.ok) {
        console.warn('[SEARCH] Nominatim search proxy returned non-OK', { status: res.status });
        return [];
      }
      const results = await res.json();
      console.log('[SEARCH] Nominatim returned:', Array.isArray(results) ? results.length : 0, 'results');
      return Array.isArray(results) ? results : [];
    } catch (e) {
      console.error('Nominatim search failed', e);
      return [];
    }
  };

  useEffect(() => {
    if (query.text.length < 3) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }
    
    if (!user) {
      console.log('[SEARCH] No user - skipping search');
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }
    
    // Reset limit when new search starts
    setSuggestLimit(20);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    console.log('[SEARCH] Debouncing search for:', query.field, query.text);
    setSearchLoading(true);
    
    // DEBOUNCE: Wait 600ms after user stops typing before searching
    // This prevents too many API calls and shows results only when user has finished typing
    searchTimeoutRef.current = window.setTimeout(async () => {
      console.log('[SEARCH] Starting search after debounce for:', query.field, query.text);
      const results = await searchNominatim(query.text, suggestLimit);
      console.log('[SEARCH] Got results:', results.length, 'for field:', query.field);
      setSuggestions(results);
      setSearchLoading(false);
    }, 600);

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [query.text, query.field, suggestLimit, user]);

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

      setRecommendedPricePerSeat(Math.round(pricing.recommendedPerSeat));
      setFinalPricePerSeat(Math.round(pricing.finalPerSeat));
      setPricingBreakdown(pricing.breakdown);
      // Pre-fill form price with recommended if user hasn't already changed it from the mode default
      try {
        const currentPrice = form.getValues('price');
        const DEFAULT_PRICE_BY_MODE: Record<string, number> = { car: 200, bike: 100 };
        const modeDefault = DEFAULT_PRICE_BY_MODE[transportMode] ?? 200;
        if (!currentPrice || Number(currentPrice) === modeDefault) {
          form.setValue('price', Math.round(pricing.recommendedPerSeat));
        }
      } catch (_) {}
    } catch (e) {
      console.error('Pricing calculation failed', e);
    }
  }, [transportMode, distanceKm, durationMin, departureTimeValue]);
  
  const handleSelectSuggestion = (field: 'from' | 'to', place: any) => {
    console.log('[SELECT] Suggestion selected for field:', field, place);
    // Build a clean, readable place name from address parts
    const a = place.address || {};
    const placeName = a.amenity || a.building || a.shop || a.office || a.tourism || a.leisure;
    const road = a.road || a.residential || a.pedestrian;
    const hood = a.neighbourhood || a.suburb || a.quarter || a.city_district;
    const city = a.city || a.town || a.village;
    
    let name = '';
    if (placeName && hood) {
      name = `${placeName}, ${hood}`;
    } else if (placeName) {
      name = placeName;
    } else if (road && hood) {
      name = `${road}, ${hood}`;
    } else if (hood && city) {
      name = `${hood}, ${city}`;
    } else if (hood) {
      name = hood;
    } else if (road && city) {
      name = `${road}, ${city}`;
    } else if (road) {
      name = road;
    } else if (city) {
      name = city;
    } else if (place.display_name) {
      // Clean up display_name - take first 2-3 meaningful parts
      const parts = place.display_name.split(',').map((p: string) => p.trim()).filter((p: string) => p && !/^\d+$/.test(p));
      name = parts.slice(0, 3).join(', ') || 'Selected Location';
    } else {
      name = 'Selected Location';
    }
    
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    
    console.log('[SELECT] Setting field value:', { field, name, lat, lng });
    form.setValue(field, name, { shouldValidate: true, shouldDirty: true });
    if (field === 'from') {
        setFromCoords({ lat, lng, name });
    } else {
        setToCoords({ lat, lng, name });
    }
    
    setSuggestions([]);
    setQuery({ field: '', text: '' });
  };
  
  const onSubmit = async (values: RideFormValues) => {
    // Check if stops are available
    if (!generatedStops || generatedStops.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Missing Stops',
        description: 'Please wait for route stops to load before creating a ride.',
      });
      return;
    }

    // Validate that university selections use exact coordinates
    const currentUni = getCurrentUniversity();
    const fromDistance = fromCoords ? distanceInMeters(currentUni, fromCoords) : Infinity;
    const toDistance = toCoords ? distanceInMeters(currentUni, toCoords) : Infinity;
    
    // If user selected fromUni, ensure from position is at exact university
    if (uniAuto === 'fromUni' && fromDistance > 100) {
      toast({
        variant: 'destructive',
        title: 'Invalid Starting Location',
        description: 'Starting location must be at the exact university center. Please select the university location.',
      });
      return;
    }
    
    // If user selected toUni, ensure to position is at exact university
    if (uniAuto === 'toUni' && toDistance > 100) {
      toast({
        variant: 'destructive',
        title: 'Invalid Destination',
        description: 'Destination must be at the exact university center. Please select the university location.',
      });
      return;
    }

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
    // Ensure the user's profile has required fields (fullName) before proceeding
    if (!ud.fullName) {
      toast({ variant: 'destructive', title: 'Complete Profile', description: 'Please add your full name to your profile before creating a ride.' });
      router.push('/dashboard/complete-profile');
      return;
    }
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
    console.debug('Create ride submit started', { userId: user?.uid, university: userData?.university });

    // Reset abort marker — we'll use a timed wrapper around the Firestore write to detect hangs
    submissionAbortedRef.current = false;

    const route = mapRef.current.getRoute();
    if (fromCoords && toCoords && route.length === 0 && process.env.NEXT_PUBLIC_ORS_API_KEY) {
        toast({ variant: "destructive", title: "Missing Route", description: "Could not calculate a route. Please wait for the route to appear on the map before creating the ride." });
        setIsSubmitting(false);
        return;
    }

    const universityId = (userData?.university || '').toLowerCase();
    if (!universityId) {
      setIsSubmitting(false);
      toast({ variant: 'destructive', title: 'Complete Profile', description: 'Please add your university before creating a ride.' });
      router.push('/dashboard/complete-profile');
      return;
    }

    const totalSeats = Math.max(1, Math.trunc(values.totalSeats));

    // Normalize departureTime: ensure it's a valid Date (Firestore will auto-convert to Timestamp)
    let normalizedDeparture: Date | null = null;
    try {
      if (!values.departureTime) {
        toast({ variant: 'destructive', title: 'Missing Time', description: 'Please select a departure date and time.' });
        return;
      }
      
      // If it's already a Date object, use it
      if (values.departureTime instanceof Date) {
        normalizedDeparture = values.departureTime;
      }
      // If it's a string, parse it
      else if (typeof values.departureTime === 'string') {
        normalizedDeparture = new Date(values.departureTime);
      }
      // Otherwise try to convert
      else {
        normalizedDeparture = new Date(values.departureTime);
      }
      
      // Validate the resulting Date
      if (!normalizedDeparture || isNaN(normalizedDeparture.getTime())) {
        console.error('[CreateRide] Invalid departure time:', values.departureTime);
        toast({ variant: 'destructive', title: 'Invalid Date', description: 'The departure date is invalid. Please select a new date.' });
        return;
      }
      
      console.log('[CreateRide] ✓ Departure time prepared:', normalizedDeparture.toISOString());
    } catch (e) {
      console.error('[CreateRide] ❌ Error preparing departure time:', e);
      toast({ variant: 'destructive', title: 'Date Error', description: 'Error processing the departure date. Please try again.' });
      return;
    }

    const rideData = {
      university: universityId,
      driverId: uid,
      createdBy: uid, // canonical
      from: values.from,
      to: values.to,
      // store both `time` (legacy) and `departureTime` as Date/Timestamp
      time: normalizedDeparture,
      // Firestore will auto-convert JS Date to Timestamp on write
      departureTime: normalizedDeparture,
      transportMode: values.transportMode,
      price: Math.trunc(values.price),
      seats: totalSeats, // canonical
      totalSeats,
      availableSeats: totalSeats,
      genderAllowed: values.genderAllowed,
      status: 'active' as 'active',
      // Keep legacy `route` (array of lat/lng) for compatibility, but store canonical encoded polyline and bounds
      route,
      routePolyline: routePolyline || null,
      routeBounds: routeBounds || null,
      waypoints: routeWaypoints || null,
      // Use serverTimestamp to guarantee a Firestore timestamp value accepted by rules
      createdAt: serverTimestamp(),
      driverInfo: {
        ...(ud.fullName && { fullName: ud.fullName }),
        ...(ud.gender && { gender: ud.gender }),
        ...(ud.contactNumber && { contactNumber: ud.contactNumber }),
        ...(ud.transport && { transport: ud.transport }),
        // Include verification flags
        ...(ud.universityEmailVerified !== undefined && { universityEmailVerified: ud.universityEmailVerified }),
        ...(ud.idVerified !== undefined && { idVerified: ud.idVerified }),
        // Compute isVerified: true only if BOTH email and ID verified, explicitly set false otherwise
        isVerified: !!(ud.universityEmailVerified && ud.idVerified),
      },
      ...(distanceKm && { distanceKm }),
      ...(durationMin && { durationMin }),
      ...(recommendedPricePerSeat && { recommendedPricePerSeat }),
      ...(finalPricePerSeat && { finalPricePerSeat }),
      ...(pricingBreakdown && { pricingBreakdown }),
    };

    // Remove undefined values recursively to satisfy Firestore's validation (no undefined allowed)
    // Preserve Firestore sentinel types (serverTimestamp, increment, arrayUnion, Timestamp, etc.)
    const removeUndefined = (obj: any): any => {
      if (obj === undefined) return undefined;
      if (obj === null) return null;

      // CRITICAL: Preserve Date objects — Firestore auto-converts them to Timestamps
      // Without this check, Date objects get converted to {} (empty map) because
      // Object.keys(new Date()) returns [] — destroying the date value entirely.
      if (obj instanceof Date) return obj;

      // Keep Firestore Timestamp-like objects intact (duck-typed to avoid runtime/type import issues)
      if (obj && typeof (obj as any).toDate === 'function') return obj;

      // Preserve Firestore FieldValue sentinels (detected by internal _methodName)
      if (typeof obj === 'object' && obj !== null && typeof (obj as any)._methodName === 'string') {
        return obj;
      }

      if (Array.isArray(obj)) return obj.map(v => removeUndefined(v)).filter(v => v !== undefined);
      if (typeof obj === 'object') {
        const out: any = {};
        for (const k of Object.keys(obj)) {
          const v = removeUndefined((obj as any)[k]);
          if (v !== undefined) out[k] = v;
        }
        return out;
      }
      return obj;
    };

    // Auto-generate a sensible `stops` array for the ride document.
    // Prefer using generatedStops (which have names fetched) if available;
    // otherwise use route waypoints or sample the route lat/lngs.
    try {
      const maxStops = 20; // Increased from 12 to allow more stops - Firestore can handle it
      let stops: { name?: string; lat: number; lng: number; distanceFromStart?: number; type?: string; isCustom?: boolean; isAutoGenerated?: boolean }[] | null = null;

      // First priority: use generatedStops if they have been created (they have names!)
      if (generatedStops && generatedStops.length > 0) {
        stops = generatedStops.map((s: any) => ({
          name: s.name || undefined,
          lat: Number(s.lat),
          lng: Number(s.lng),
          distanceFromStart: s.distanceFromStart,
          type: s.type,
          isCustom: s.isCustom,
          isAutoGenerated: s.isAutoGenerated
        })).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
        
        console.log('[RIDE_SAVE] Using generatedStops:', stops.length, 'stops:', stops.map((s, i) => `${i+1}:${s.type}:"${s.name}"`).join(', '));
      }
      // Second priority: route waypoints
      else if (routeWaypoints && Array.isArray(routeWaypoints) && routeWaypoints.length > 0) {
        stops = routeWaypoints.map((w: any) => ({ name: w.name || undefined, lat: Number(w.lat ?? (w[0] ?? 0)), lng: Number(w.lng ?? (w[1] ?? 0)) })).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
      }
      // Last resort: sample route points
      else if (routeLatLngs && Array.isArray(routeLatLngs) && routeLatLngs.length > 0) {
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
        // CRITICAL: Save ALL stops without slicing - preserve complete stop list
        // Every stop is important for route accuracy
        (rideData as any).stops = stops;
        console.log('[RIDE_SAVE] Attached', stops.length, 'stops to ride document:', stops.map((s, i) => `${i+1}:${s.type}:"${s.name}"`).join(', '));
      }
    } catch (stopsErr) {
      console.warn('Failed to auto-generate stops for ride:', stopsErr);
    }

    // Sanitize AFTER stops have been added
    const sanitizedRideData = removeUndefined(rideData);

      try {
        console.debug('Creating ride: writing to Firestore', { university: userData!.university, rideData: sanitizedRideData });
        const ridesCollection = collection(firestore!, 'universities', universityId, 'rides');

      const writeStart = Date.now();

      // Quick network check: if the browser reports offline, bail out early.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsSubmitting(false);
        toast({ variant: 'destructive', title: 'No Connection', description: 'Your device appears to be offline. Please reconnect and try again.' });
        return;
      }

      // NOTE: Removed preflight read to avoid pre-emptive permission-denied errors.
      // We'll attempt the write directly and surface any real Firestore error to the user.

      // Optional token refresh: try to refresh but don't block writes if this minor step fails
      try {
        await user!.getIdToken(true);
      } catch (err) {
        console.warn('ID token refresh failed (non-fatal)', err);
      }

      // Try the write with a simple retry strategy (2 attempts). Do not use per-attempt timeouts that
      // could cause the app to ignore a later success — surface the final result to the user.
      const addDocWithRetry = async (attempts = 2) => {
        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            console.debug(`[Ride Creation] Attempt ${attempt}: Creating document in collection: ${universityId}/rides`);
            const res = await addDoc(ridesCollection, sanitizedRideData as any);
            console.debug(`✅ [Ride Creation] Document created successfully! ID: ${res.id}`, {
              universityId: universityId,
              rideId: res.id,
              driverId: sanitizedRideData.driverId,
              from: sanitizedRideData.from,
              to: sanitizedRideData.to,
              departureTime: sanitizedRideData.departureTime,
              status: sanitizedRideData.status,
              writeTimeMs: Date.now() - writeStart
            });
            return res;
          } catch (err: any) {
            console.warn('addDoc attempt failed', { 
              attempt, 
              error: err?.message || err, 
              errorCode: err?.code,
              online: typeof navigator !== 'undefined' ? navigator.onLine : undefined, 
              uid: user?.uid, 
              university: userData?.university 
            });
            if (attempt === attempts) throw err;
            await new Promise((r) => setTimeout(r, 500 * attempt));
          }
        }
      };

      try {
        const docRef = await addDocWithRetry(2);
        console.debug('✅ Ride write attempt finished successfully', { durationMs: Date.now() - writeStart, docId: docRef!.id });
      } catch (err: any) {
        // Re-throw to be handled by outer catch
        console.error('❌ All addDoc retry attempts failed:', err);
        throw err;
      }

      console.debug('Ride created successfully - notifying user');
      toast({ title: 'Success!', description: 'Your ride has been created. Redirecting to My Rides...' });
      
      // CRITICAL: Wait for Firestore replication before redirecting to My Rides
      // Firestore typically replicates within 100-500ms, but we use 2000ms to be safe
      // This ensures the real-time listener on My Rides page will see the newly created ride
      console.log('[CreateRide] ✅ Waiting 2 seconds for Firestore replication before redirecting...');
      setTimeout(() => {
        console.log('[CreateRide] 🔄 Redirecting to My Rides now');
        router.push('/dashboard/my-rides');
      }, 2000);
    } catch (e: any) {
        console.error("❌ Error creating ride:", e);
        console.error("❌ Error details:", {
          message: e?.message,
          code: e?.code,
          name: e?.name,
          stack: e?.stack,
          fullError: JSON.stringify(e, Object.getOwnPropertyNames(e), 2)
        });
        console.error("❌ User ID:", user?.uid);
        console.error("❌ University:", userData?.university);
        console.error("❌ SanitizedRideData driverId:", sanitizedRideData?.driverId);
        
        // Ensure we clear the submitting state BEFORE doing anything that could throw or crash the page
        setIsSubmitting(false);

        if (e?.message === 'write-timeout') {
          toast({ variant: 'destructive', title: 'Timed out', description: 'Creating ride is taking too long. Please check your connection and try again.' });
          return;
        }

        // Show detailed error in toast
        const errorMsg = e?.code === 'permission-denied' 
          ? `Permission denied. Check console for details. User: ${user?.uid?.substring(0,8)}...`
          : (e?.message || 'An error occurred while creating the ride.');
        
        toast({ variant: 'destructive', title: 'Could not create ride', description: errorMsg });

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
    console.log('[RENDER] renderSuggestionsFor called:', { field, queryField: query.field, suggestionsCount: suggestions.length });
    if (query.field !== field) {
      console.log('[RENDER] Field mismatch - not rendering');
      return null;
    }
    if (suggestions.length === 0) {
      console.log('[RENDER] No suggestions - not rendering');
      return null;
    }
    console.log('[RENDER] Rendering suggestions dropdown for:', field);
    return (
      <div role="listbox" aria-label="Location suggestions" className="absolute left-0 right-0 top-full bg-card border-2 border-primary/30 rounded-lg mt-2 z-[10050] max-h-72 overflow-auto shadow-xl" style={{ position: 'absolute' }}>
        <div className="px-3 py-2 text-xs font-semibold text-primary bg-primary/5 border-b border-primary/10">
          📍 {suggestions.length} Location{suggestions.length !== 1 ? 's' : ''} Found
        </div>
            {suggestions.map((s, idx) => {
                // Build a clean display name from address parts
                const a = s.address || {};
                const placeName = a.amenity || a.building || a.shop || a.office || a.tourism || a.leisure;
                const road = a.road || a.residential || a.pedestrian || a.path || a.cycleway;
                const hood = a.neighbourhood || a.suburb || a.quarter || a.city_district;
                const city = a.city || a.town || a.village;
                
                // Build primary name (what user sees first)
                let primaryName = '';
                if (placeName) {
                  primaryName = placeName;
                } else if (road && hood) {
                  primaryName = `${road}, ${hood}`;
                } else if (hood) {
                  primaryName = hood;
                } else if (road) {
                  primaryName = road;
                } else if (s.display_name) {
                  // Clean up display_name - take first 2 parts
                  const parts = s.display_name.split(',').map((p: string) => p.trim()).filter((p: string) => p && !/^\d+$/.test(p));
                  primaryName = parts.slice(0, 2).join(', ') || s.display_name;
                }
                
                // Build secondary info
                const secondaryParts = [];
                if (placeName && road) secondaryParts.push(road);
                if (hood && !primaryName.includes(hood)) secondaryParts.push(hood);
                if (city && !primaryName.includes(city)) secondaryParts.push(city);
                
                return (
                <button
                  key={s.place_id || `${s.lat}-${s.lon}-${idx}`}
                  role="option"
                  aria-selected={false}
                  className="w-full text-left flex items-start gap-2 p-3 hover:bg-primary/10 hover:border-l-4 hover:border-primary cursor-pointer transition-all border-b border-border/50 last:border-b-0"
                  onMouseDown={() => handleSelectSuggestion(field, s)}
                >
                    <MapPin className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate text-foreground">{primaryName || 'Unknown Location'}</div>
                      {secondaryParts.length > 0 && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{secondaryParts.join(' • ')}</div>
                      )}
                    </div>
                </button>
                );
            })}
        {suggestions.length >= suggestLimit && (
          <div className="p-3 bg-primary/5 border-t border-primary/10 sticky bottom-0">
            <button type="button" className="text-sm text-primary font-medium hover:underline flex items-center gap-1" onMouseDown={() => setSuggestLimit((v) => Math.min(200, v + 30))}>
              <span>Load more results</span>
              <span className="text-xs">({suggestions.length}+ available)</span>
            </button>
          </div>
        )}
        {suggestions.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground text-center">No locations found. Try a different search term.</div>
        )}
      </div>
    );
  };
  
  const isButtonDisabled = userLoading || isSubmitting || !routePolyline || !generatedStops || generatedStops.length === 0;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md shadow-lg shadow-primary/5">
        <CardHeader>
          <CardTitle className="font-headline text-3xl text-slate-50">Offer a New Ride</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label className="text-sm font-medium text-slate-200 mb-2 block">Trip Type (required)</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={uniAuto === 'toUni'} onClick={() => applyUniversitySelection('toUni')} className={`rounded-md p-3 text-left transition focus:outline-none ${uniAuto === 'toUni' ? 'bg-primary text-primary-foreground' : 'bg-slate-800/50'}`}>
                <div className="font-medium">Going to university</div>
                <div className="text-xs text-muted-foreground mt-1">Set destination to your university</div>
              </button>
              <button type="button" aria-pressed={uniAuto === 'fromUni'} onClick={() => applyUniversitySelection('fromUni')} className={`rounded-md p-3 text-left transition focus:outline-none ${uniAuto === 'fromUni' ? 'bg-primary text-primary-foreground' : 'bg-slate-800/50'}`}>
                <div className="font-medium">Leaving from university</div>
                <div className="text-xs text-muted-foreground mt-1">Set start point to your university</div>
              </button>
            </div>
          </div>

          {/* Ensure the default selection is applied on mount */}
          <script>
            { /* noop - keep TS happy; real effect below */ }
          </script>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8 relative">
                <FormField control={form.control} name="from" render={({ field }: any) => (
                    <FormItem className="relative z-[100]" style={{ overflow: 'visible' }}>
                        <FormLabel>From</FormLabel>
                        <FormControl>
                            <div className='relative'>
                              <Input placeholder="Type to search locations..." {...field} value={uniAuto === 'fromUni' ? String(getCurrentUniversity().name ?? '') : field.value} readOnly={uniAuto === 'fromUni'} className={uniAuto === 'fromUni' ? 'opacity-70 cursor-not-allowed' : ''} onChange={(e) => { if (uniAuto !== 'fromUni') { field.onChange(e); setQuery({ field: 'from', text: e.target.value }); } }} onFocus={() => { if (field.value && uniAuto !== 'fromUni') setQuery({ field: 'from', text: field.value }); }} onBlur={() => setTimeout(() => setSuggestions([]), 300)} autoComplete="off" />
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
                    <FormItem className="relative z-[100]" style={{ overflow: 'visible' }}>
                        <FormLabel>To</FormLabel>
                        <FormControl>
                            <div className='relative'>
                              <Input placeholder="Type to search locations..." {...field} value={uniAuto === 'toUni' ? String(getCurrentUniversity().name ?? '') : field.value} readOnly={uniAuto === 'toUni'} className={uniAuto === 'toUni' ? 'opacity-70 cursor-not-allowed' : ''} onChange={(e) => { if (uniAuto !== 'toUni') { field.onChange(e); setQuery({ field: 'to', text: e.target.value }); } }} onFocus={() => { if (field.value && uniAuto !== 'toUni') setQuery({ field: 'to', text: field.value }); }} onBlur={() => setTimeout(() => setSuggestions([]), 300)} autoComplete="off" />
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
            
              <div ref={mapContainerRef} className="h-[450px] w-full rounded-lg overflow-hidden shadow-sm relative">
                  <MapComponent 
                    ref={mapRef} 
                    onMapClick={handleMapClick}
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
                    lockedPin={(uniAuto === 'toUni' || uniAuto === 'fromUni')}
                    lockedPosition={(uniAuto === 'toUni' || uniAuto === 'fromUni') ? getCurrentUniversity() : null}
                    universityLocation={getCurrentUniversity()}
                    onAnyMapClick={() => { /* noop - map clicks handled in MapComponent */ }}
                    getAuthToken={user ? () => user.getIdToken() : undefined}
                  />
                  
                  {activeMapSelect && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[1000] pointer-events-none">
                         <MapPin className="h-10 w-10 text-primary drop-shadow-lg"/>
                      </div>
                  )}
                  {activeMapSelect && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] w-full px-4">
                          <Button type="button" className="w-full" onClick={handleConfirmSelection}>
                              Confirm Location
                          </Button>
                      </div>
                  )}
              </div>

              {/* Route editor: add/reorder/remove waypoints and generate final polyline */}
              <div className="mb-6">
                <RouteEditor 
                  origin={fromCoords || null} 
                  destination={toCoords || null} 
                  onRouteGenerated={onRouteGenerated}
                  getAuthToken={user ? () => user.getIdToken() : undefined}
                />
                {routePolyline ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {(() => {
                      const short = (s?: string | null) => {
                        if (!s) return '—';
                        const parts = String(s).split(',').map(p => p.trim()).filter(Boolean);
                        return parts.slice(0, 2).join(', ');
                      };
                      return `Route generated and ready. From: ${short(fromCoords?.name)} → To: ${short(toCoords?.name)}`;
                    })()}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-muted-foreground">No generated route yet. Add waypoints or ensure start/end are selected.</div>
                )}
                
                {/* Loading indicator for stops */}
                {stopsLoading && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Fetching stop names...</span>
                  </div>
                )}
                
                {/* Display and edit generated stops */}
                {generatedStops && generatedStops.length > 0 && (
                  <div className="mt-3">
                    <StopsViewer
                      stops={generatedStops}
                      routePolyline={routePolyline || undefined}
                      routeCoordinates={routeLatLngs}
                      isCreator={true}
                      getAuthToken={user ? () => user.getIdToken() : undefined}
                      onUpdateStops={async (updatedStops) => {
                        setGeneratedStops(updatedStops);
                      }}
                      triggerText={`Manage Stops (${generatedStops.length})`}
                    />
                    <div className="text-xs text-muted-foreground mt-2">Click to view, edit, add or remove stops. These will be saved with your ride.</div>
                  </div>
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
                <div className="text-sm text-center p-3 bg-red-500/10 text-red-400 rounded-md">
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
                      setGeneratedStops(null);
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
