
'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import type { Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin } from 'lucide-react';
import { LeavingTimePicker } from '@/components/ui/leaving-time-picker';


const rideSchema = z.object({
  from: z.string().min(3, 'Starting location is required.'),
  to: z.string().min(3, 'Destination is required.'),
  departureTime: z.date({ required_error: 'Please select a departure date and time.' }),
  transportMode: z.enum(['car', 'bike']),
  price: z.coerce.number().positive('Price must be a positive number.'),
  totalSeats: z.coerce.number().int().min(1, 'There must be at least 1 seat.'),
  genderAllowed: z.enum(['male', 'female', 'both']),
}).refine(data => data.from.toLowerCase() !== data.to.toLowerCase(), {
  message: "Starting location and destination can't be the same.",
  path: ['to'],
});


export interface MapComponentRef {
  resetMap: () => void;
  getRoute: () => { lat: number; lng: number }[];
  enterSelectionMode: (center: L.LatLngExpression) => void;
  exitSelectionMode: () => void;
  getTempMarkerLatLng: () => L.LatLng | null;
}

const ORS_API_KEY = "PASTE_KEY_HERE";

type LatLngLiteral = { lat: number; lng: number; name?: string };

const MapComponent = forwardRef<MapComponentRef, {
    onMapClick: (lat: number, lng: number, name: string) => void;
    onRouteUpdate: (distance: number | null, duration: number | null) => void;
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

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current || mapInstanceRef.current) return;
    
    // CRITICAL ICON FIX: Ensures marker icons are visible in Next.js.
    // Replaces default path logic with direct paths to images in `/public`.
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/marker-icon-2x.png',
        iconUrl: '/marker-icon.png',
        shadowUrl: '/marker-shadow.png',
    });
    
    mapInstanceRef.current = L.map(mapContainerRef.current).setView([24.8607, 67.0011], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(mapInstanceRef.current);

    mapInstanceRef.current.on('click', async (e: L.LeafletMouseEvent) => {
        if (!props.activeMapSelect) return; // Only handle clicks in selection mode
        const { lat, lng } = e.latlng;
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        const name = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        props.onMapClick(lat, lng, name);
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
      fromMarkerRef.current.bindPopup(props.from.name || 'Starting Point').openPopup();
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
      toMarkerRef.current.bindPopup(props.to.name || 'Destination').openPopup();
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

        if (!ORS_API_KEY || ORS_API_KEY === "PASTE_KEY_HERE") {
            console.warn('ORS API key missing. Cannot draw route.');
            props.onRouteUpdate(null, null);
            return;
        }
        
        const body = { coordinates: [[start.lng, start.lat], [end.lng, end.lat]] };
        
        try {
            const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': ORS_API_KEY },
                body: JSON.stringify(body),
            });
    
            if (!response.ok) throw new Error(`Failed to fetch route. Status: ${response.status}`);
            const routeData = await response.json();
            
            if (routeData.features && routeData.features.length > 0) {
                // Use L.polyline instead of L.geoJSON for reliability.
                // It requires manually converting coordinates from [lng, lat] to [lat, lng].
                const coordinates = routeData.features[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
                const polyline = L.polyline(coordinates, { color: '#3F51B5', weight: 7, opacity: 0.9 }).addTo(mapInstanceRef.current);
                mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
                routeLayerRef.current = polyline;
    
                const summary = routeData.features[0].properties.summary;
                props.onRouteUpdate(summary.distance / 1000, summary.duration / 60);
            } else {
                props.onRouteUpdate(null, null);
            }
        } catch (error) {
            console.error("Error drawing route:", error);
            props.onRouteUpdate(null, null);
        }
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
    enterSelectionMode: (center: L.LatLngExpression) => {
        if (!mapInstanceRef.current) return;
        mapInstanceRef.current.setView(center, 15, { animate: true });
        // The visual pin is now handled by a div overlay in the parent component,
        // so we don't need a temporary Leaflet marker here.
    },
    exitSelectionMode: () => {
       // No temporary marker to remove.
    },
    getTempMarkerLatLng: () => {
        return mapInstanceRef.current?.getCenter() || null;
    }
  }));

  return <div ref={mapContainerRef} className="h-full w-full" />;
});
MapComponent.displayName = 'MapComponent';


export default function CreateRidePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mapRef = useRef<MapComponentRef>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  const { user, loading: userLoading, data: userData } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [fromCoords, setFromCoords] = useState<LatLngLiteral | null>(null);
  const [toCoords, setToCoords] = useState<LatLngLiteral | null>(null);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  
  const [activeMapSelect, setActiveMapSelect] = useState<'from' | 'to' | null>(null);

  const form = useForm<z.infer<typeof rideSchema>>({
    resolver: zodResolver(rideSchema),
    defaultValues: { from: '', to: '', price: 200, totalSeats: 4, genderAllowed: 'both', transportMode: 'car' },
  });
  
  const transportMode = form.watch('transportMode');

  useEffect(() => {
    if (transportMode === 'bike') {
        form.setValue('price', 100);
        form.setValue('totalSeats', 1);
    } else if (transportMode === 'car') {
        form.setValue('price', 200);
        form.setValue('totalSeats', 4);
    }
  }, [transportMode, form]);

  const handleConfirmSelection = async () => {
    if (!activeMapSelect || !mapRef.current) return;
    
    const latLng = mapRef.current.getTempMarkerLatLng();
    if (!latLng) return;
    
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latLng.lat}&lon=${latLng.lng}`);
        const data = await res.json();
        const name = data.display_name || `${latLng.lat.toFixed(4)}, ${latLng.lng.toFixed(4)}`;
        
        form.setValue(activeMapSelect, name);
        if (activeMapSelect === 'from') {
            setFromCoords({ lat: latLng.lat, lng: latLng.lng, name });
        } else {
            setToCoords({ lat: latLng.lat, lng: latLng.lng, name });
        }
        
    } catch (e) {
        console.error("Reverse geocoding failed", e);
        toast({ variant: 'destructive', title: "Could not fetch location name."});
    } finally {
        mapRef.current.exitSelectionMode();
        setActiveMapSelect(null);
    }
  };
  
  const handleChooseOnMap = (field: 'from' | 'to') => {
    setActiveMapSelect(field);
    mapRef.current?.enterSelectionMode([24.8607, 67.0011]); // Center on Karachi
    
    // Smoothly scroll to the map container
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

  const [query, setQuery] = useState({ field: '', text: '' });
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const searchNominatim = async (q: string) => {
    if (q.length < 3) return [];
    try {
        // Bounding box for Karachi: min lon, min lat, max lon, max lat
        const viewbox = "66.8,24.7,67.4,25.1";
        const params = new URLSearchParams({ 
            q, 
            format: 'json', 
            limit: '5', 
            countrycodes: 'pk',
            viewbox: viewbox,
            bounded: '1'
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
        if (!res.ok) return [];
        return await res.json();
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
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchNominatim(query.text);
      setSuggestions(results);
      setSearchLoading(false);
    }, 500);

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [query]);
  
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
    if (!user || !userData || !firestore) {
        toast({ variant: "destructive", title: "Authentication Error", description: "Please wait a moment and try again. You must be logged in to create a ride." });
        return;
    }
    setIsSubmitting(true);

    try {
        const route = mapRef.current?.getRoute() ?? [];
        if (route.length === 0 && (fromCoords && toCoords)) {
            toast({ variant: "destructive", title: "Missing Route", description: "Could not calculate a route. Please ensure start and end points are valid." });
            setIsSubmitting(false);
            return;
        }

        const rideData: any = {
            driverId: user.uid,
            from: values.from, to: values.to,
            departureTime: values.departureTime,
            transportMode: values.transportMode,
            price: values.price,
            totalSeats: values.totalSeats,
            availableSeats: values.totalSeats,
            genderAllowed: values.genderAllowed,
            status: 'active',
            route,
            createdAt: serverTimestamp(),
            driverInfo: { fullName: userData.fullName, gender: userData.gender },
            ...(distanceKm && { distanceKm }),
            ...(durationMin && { durationMin }),
        };

        const ridesCollection = collection(firestore, 'universities', userData.university, 'rides');
        await addDoc(ridesCollection, rideData);
        
        toast({ title: 'Success!', description: 'Your ride has been created.' });
        router.push('/dashboard/my-rides');
    } catch (e: any) {
        console.error("Error creating ride:", e);
        toast({ variant: "destructive", title: "Error", description: e.message || "Failed to create ride." });
    } finally {
        setIsSubmitting(false);
    }
  };

  const renderSuggestionsFor = (field: 'from' | 'to') => {
    if (query.field !== field || suggestions.length === 0) return null;
    return (
        <div className="absolute left-0 right-0 top-full bg-popover border rounded-md mt-1 z-50 max-h-60 overflow-auto">
            {suggestions.map((s) => (
                <div key={s.place_id} className="p-2 hover:bg-muted cursor-pointer" onMouseDown={() => handleSelectSuggestion(field, s)}>
                    <p className="text-sm">{s.display_name}</p>
                </div>
            ))}
        </div>
    );
  };
  
  const isButtonDisabled = userLoading || isSubmitting;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl">Offer a New Ride</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                <FormField control={form.control} name="from" render={({ field }) => (
                    <FormItem className="relative">
                        <FormLabel>From</FormLabel>
                        <FormControl>
                            <div className='relative'>
                              <Input placeholder="Search for starting point" {...field} onChange={(e) => { field.onChange(e); setQuery({ field: 'from', text: e.target.value }); }} onBlur={() => setTimeout(() => setSuggestions([]), 200)} autoComplete="off" />
                              {searchLoading && query.field === 'from' && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3"/>}
                            </div>
                        </FormControl>
                        <Button type="button" variant="link" size="sm" className="p-0 h-auto absolute right-1 -bottom-6 text-accent" onClick={() => handleChooseOnMap('from')}>
                          <MapPin className="w-3 h-3 mr-1" /> Choose on map
                        </Button>
                        {renderSuggestionsFor('from')}
                        <FormMessage />
                    </FormItem>
                )}/>

                <FormField control={form.control} name="to" render={({ field }) => (
                    <FormItem className="relative">
                        <FormLabel>To</FormLabel>
                        <FormControl>
                            <div className='relative'>
                              <Input placeholder="Search for destination" {...field} onChange={(e) => { field.onChange(e); setQuery({ field: 'to', text: e.target.value }); }} onBlur={() => setTimeout(() => setSuggestions([]), 200)} autoComplete="off" />
                              {searchLoading && query.field === 'to' && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3"/>}
                            </div>
                        </FormControl>
                        <Button type="button" variant="link" size="sm" className="p-0 h-auto absolute right-1 -bottom-6 text-accent" onClick={() => handleChooseOnMap('to')}>
                          <MapPin className="w-3 h-3 mr-1" /> Choose on map
                        </Button>
                        {renderSuggestionsFor('to')}
                        <FormMessage />
                    </FormItem>
                )}/>
              </div>
            
              <div ref={mapContainerRef} className="h-[450px] w-full rounded-lg overflow-hidden border shadow-sm relative z-0">
                  <MapComponent 
                    ref={mapRef} 
                    onMapClick={() => {}}
                    onRouteUpdate={handleRouteUpdate}
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
              
              {distanceKm != null && durationMin != null && (
                  <div className="text-sm text-center p-2 bg-secondary rounded-md text-secondary-foreground">
                      Estimated distance: <strong>{distanceKm} km</strong> &bull; Estimated duration: <strong>{durationMin} min</strong>
                  </div>
              )}

              <FormField
                control={form.control}
                name="departureTime"
                render={({ field }) => (
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

              <FormField control={form.control} name="transportMode" render={({ field }) => (
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="price" render={({ field }) => (
                      <FormItem>
                      <FormLabel>Price per Seat (PKR)</FormLabel>
                      <FormControl><Input type="number" min="1" {...field} /></FormControl>
                      <FormMessage />
                      </FormItem>
                  )}/>
                  <FormField control={form.control} name="totalSeats" render={({ field }) => (
                      <FormItem>
                      <FormLabel>Total Seats</FormLabel>
                      <FormControl><Input type="number" min="1" {...field} /></FormControl>
                      <FormMessage />
                      </FormItem>
                  )}/>
              </div>

              <FormField control={form.control} name="genderAllowed" render={({ field }) => (
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
                  
              <div className="flex flex-col gap-2 pt-4">
                  <Button type="submit" className="w-full" size="lg" disabled={isButtonDisabled}>
                      {isButtonDisabled ? <Loader2 className="animate-spin" /> : 'Create Ride'}
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
