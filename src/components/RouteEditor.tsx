'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Waypoint, LatLng, encodePolyline, computeBounds } from '@/lib/route';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type RouteEditorProps = {
  origin?: Waypoint | null;
  destination?: Waypoint | null;
  onRouteGenerated?: (data: { waypoints: Waypoint[]; polyline: string; bounds: ReturnType<typeof computeBounds> | null; distanceMeters?: number | null; durationSeconds?: number | null }) => void;
};

export default function RouteEditor({ origin, destination, onRouteGenerated }: RouteEditorProps) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestLimit, setSuggestLimit] = useState<number>(20);
  const [generating, setGenerating] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const addWaypoint = (p: Waypoint) => setWaypoints((s) => [...s, p]);
  const removeWaypoint = (i: number) => setWaypoints((s) => s.filter((_, idx) => idx !== i));
  const moveWaypoint = (i: number, dir: -1 | 1) => {
    setWaypoints((s) => {
      const copy = s.slice();
      const j = i + dir;
      if (j < 0 || j >= copy.length) return copy;
      const tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
      return copy;
    });
  };

  // Karachi viewbox: left_lon,top_lat,right_lon,bottom_lat
  const KARACHI_VIEWBOX = '66.5,25.5,67.5,24.6';

  const extractPlaceName = (result: any) => {
    const a = result.address || {};
    const placeName = a.amenity || a.building || a.shop || a.office || a.tourism || a.leisure;
    const road = a.road || a.residential || a.pedestrian || a.path || a.cycleway;
    const hood = a.neighbourhood || a.suburb || a.quarter || a.city_district;
    const city = a.city || a.town || a.village;
    
    // Priority: place name > road + hood > hood > city
    if (placeName && hood) {
      return `${placeName}, ${hood}`;
    } else if (placeName) {
      return placeName;
    } else if (road && hood) {
      return `${road}, ${hood}`;
    } else if (hood && city) {
      return `${hood}, ${city}`;
    } else if (hood) {
      return hood;
    } else if (road && city) {
      return `${road}, ${city}`;
    } else if (road) {
      return road;
    } else if (city) {
      return city;
    } else {
      const parts = (result.display_name || '').split(',').map((p: string) => p.trim()).filter((p: string) => p && !/^\d+$/.test(p));
      return parts.slice(0, 2).join(', ') || 'Unknown Location';
    }
  };

  const searchPlaces = useCallback(async (q: string, limit: number) => {
    if (!q || q.length < 1) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }
    try {
      setSearchLoading(true);
      const res = await fetch(`/api/nominatim/search?q=${encodeURIComponent(q.trim())}&limit=${encodeURIComponent(String(Math.max(1, Math.min(50, limit || 20))))}&addressdetails=1&viewbox=${encodeURIComponent(KARACHI_VIEWBOX)}&bounded=1`);
      if (!res.ok) {
        setSuggestions([]);
        setSearchLoading(false);
        return;
      }
      const json = await res.json();
      const results: any[] = Array.isArray(json) ? json : [];
      setSuggestions(results);
      setSearchLoading(false);
    } catch (e) { 
      setSuggestions([]);
      setSearchLoading(false);
    }
  }, []);

  // Recalculate route when origin/destination/waypoints change
  useEffect(() => {
    const doGenerate = async () => {
      if (!origin || !destination) return;
      setGenerating(true);
      let coords: [number, number][] = [];
      try {
        coords = [ [origin.lng, origin.lat] as [number, number], ...waypoints.map(w => [w.lng, w.lat] as [number, number]), [destination.lng, destination.lat] as [number, number] ];
        
        let lastErr: any = null;
        
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            // Use longer timeout: 16s base, 22s on retry to match server proxy timeouts
            const timeoutMs = attempt === 1 ? 16000 : 22000;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            const resp = await fetch('/api/ors', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ coordinates: coords }),
              signal: controller.signal,
            }).finally(() => clearTimeout(timeoutId));
            
            if (!resp.ok) {
              let bodyText: string | null = null;
              let parsed: any = null;
              try { bodyText = await resp.text(); } catch (e) { /* ignore */ }
              try { parsed = bodyText ? JSON.parse(bodyText) : null; } catch (e) { parsed = bodyText; }
              const friendly = 'No route found between these locations. Try different points or adjust the route.';
              if (resp.status >= 400 && resp.status < 500) {
                console.warn('Route service returned client error (no route/bad request)', { status: resp.status });
                setRouteError(friendly);
                setGenerating(false);
                return;
              }
              if (attempt < 2) {
                await new Promise(r => setTimeout(r, 150)); // Faster retry: 150ms
                continue;
              }
              console.warn('Route service error', { status: resp.status });
              setRouteError(friendly);
              setGenerating(false);
              return;
            }
            const data = await resp.json();
            setRouteError(null);
            const coordsRes: any[] = (data?.features?.[0]?.geometry?.coordinates) || (data?.geometry?.coordinates) || [];
            const latlngs: LatLng[] = coordsRes.map((c: any) => ({ lat: c[1], lng: c[0] }));
            const polyline = encodePolyline(latlngs);
            const bounds = computeBounds(latlngs);
            const summary = (data?.features && data.features[0] && data.features[0].properties && data.features[0].properties.summary) || null;
            const distanceMeters = summary?.distance ?? null;
            const durationSeconds = summary?.duration ?? null;
            onRouteGenerated?.({ waypoints, polyline, bounds, distanceMeters, durationSeconds });
            setGenerating(false);
            return; // Success
          } catch (e: any) {
            lastErr = e;
            const isTimeout = e?.name === 'AbortError';
            console.warn(`Route generation attempt ${attempt} failed (timeout: ${isTimeout}):`, e);
            if (attempt < 2) {
              await new Promise(r => setTimeout(r, 150)); // Faster retry: 150ms
            }
          }
        }
        
        // All retries failed
        console.warn('Route generation failed after retries', lastErr);
        setRouteError('No route found between these locations. Try different points or adjust the route.');
      } catch (e: any) {
        console.warn('Route generation failed', e);
        setRouteError('No route found between these locations. Try different points or adjust the route.');
      } finally { setGenerating(false); }
    };
    doGenerate();
  }, [origin, destination, waypoints, onRouteGenerated]);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-100">Add Route Points (Optional)</h3>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="Type 3+ characters to search for stops"
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              // NO DEBOUNCE - search instantly when 3+ characters typed
              if (v.length >= 3) {
                searchPlaces(v, suggestLimit);
              } else {
                setSuggestions([]);
                setSearchLoading(false);
              }
            }}
            className="pr-10"
          />
          {searchLoading && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <Button 
          onClick={() => { 
            if (suggestions[0]) {
              const name = extractPlaceName(suggestions[0]);
              addWaypoint({ name, lat: Number(suggestions[0].lat), lng: Number(suggestions[0].lon) }); 
              setQuery('');
              setSuggestions([]);
            }
          }}
          disabled={!suggestions[0]}
        >
          Add
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 p-2 rounded max-h-72 overflow-y-auto z-50">
          {suggestions.map((s, idx) => {
            const primaryName = extractPlaceName(s);
            const a = s.address || {};
            const road = a.road || a.residential || a.pedestrian || a.path || a.cycleway;
            const hood = a.neighbourhood || a.suburb || a.quarter || a.city_district;
            const city = a.city || a.town || a.village;
            const secondary = [road, hood, city].filter(Boolean).join(', ');
            
            return (
              <div 
                key={s.place_id || idx}
                className="p-2 hover:bg-slate-700 cursor-pointer rounded transition" 
                onClick={() => { 
                  addWaypoint({ name: primaryName, lat: Number(s.lat), lng: Number(s.lon) }); 
                  setQuery(''); 
                  setSuggestions([]);
                }}
              >
                <div className="text-sm font-medium text-slate-100 truncate">{primaryName}</div>
                {secondary && <div className="text-xs text-muted-foreground truncate">{secondary}</div>}
              </div>
            );
          })}
          {suggestions.length >= suggestLimit && (
            <div className="p-2 border-t border-slate-700">
              <button 
                type="button" 
                className="text-xs text-accent hover:underline" 
                onClick={() => setSuggestLimit((v) => Math.min(50, v + 20))}
              >
                Show more results
              </button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2 mt-4">
        {waypoints.length === 0 ? (
          <div className="text-xs text-muted-foreground p-3 bg-slate-800/50 rounded border border-slate-700">
            No route stops added yet. Type in the search box and click Add to include stops along your route.
          </div>
        ) : (
          <>
            <div className="text-xs font-medium text-slate-300">Route Points ({waypoints.length})</div>
            {waypoints.map((w, i) => (
              <div key={`${w.lat}-${w.lng}-${i}`} className="flex items-center gap-2 p-3 bg-slate-800/50 border border-slate-700 rounded">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-100 truncate">{w.name || `Stop ${i + 1}`}</div>
                  <div className="text-xs text-muted-foreground">{w.lat.toFixed(4)}, {w.lng.toFixed(4)}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => moveWaypoint(i, -1)} disabled={i === 0} className="h-8 w-8">↑</Button>
                  <Button size="sm" variant="ghost" onClick={() => moveWaypoint(i, 1)} disabled={i === waypoints.length - 1} className="h-8 w-8">↓</Button>
                  <Button size="sm" variant="destructive" onClick={() => removeWaypoint(i)} className="h-8 w-8">✕</Button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="text-xs text-muted-foreground pt-2">
        Route generation: <span className="font-medium">{generating ? 'calculating route...' : 'ready'}</span>
        {routeError && <div className="text-red-400 mt-2">{routeError}</div>}
      </div>
    </div>
  );
}
