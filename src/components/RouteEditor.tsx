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
  getAuthToken?: () => Promise<string>;
};

export default function RouteEditor({ origin, destination, onRouteGenerated, getAuthToken }: RouteEditorProps) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestLimit, setSuggestLimit] = useState<number>(50);
  const [generating, setGenerating] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, any[]>>(new Map());
  const latestQueryRef = useRef<string>('');

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

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const highlightMatch = (text: string, q: string) => {
    if (!q) return text;
    const safe = escapeRegExp(q.trim());
    if (!safe) return text;
    const parts = text.split(new RegExp(`(${safe})`, 'ig'));
    return parts.map((part, idx) =>
      part.toLowerCase() === q.trim().toLowerCase() ? (
        <span key={`${part}-${idx}`} className="text-primary font-semibold">
          {part}
        </span>
      ) : (
        <span key={`${part}-${idx}`}>{part}</span>
      )
    );
  };

  const getSearchText = (item: any) => {
    const primary = extractPlaceName(item);
    const display = item.display_name || '';
    return `${primary} ${display}`.toLowerCase();
  };

  const scoreSuggestion = (item: any, q: string) => {
    const text = getSearchText(item);
    const queryText = q.toLowerCase().trim();
    if (!queryText) return 0;

    let score = 0;
    if (text.startsWith(queryText)) score += 120;
    if (text.includes(queryText)) score += 60;

    const popular = [
      'malir cantt', 'malir', 'gulshan-e-iqbal', 'gulshan', 'saddar', 'dha', 'nazimabad',
      'korangi', 'clifton', 'defence', 'bahadurabad', 'shahra e faisal', 'shahrah-e-faisal',
      'north nazimabad', 'north karachi', 'johar', 'gulistan-e-johar', 'stadium',
      'airport', 'jinnah', 'university', 'ned', 'fast', 'ku', 'dow', 'aku',
      'hospital', 'mall', 'campus'
    ];

    for (const key of popular) {
      if (text.includes(key)) score += 100;
    }

    if (typeof item.importance === 'number') score += item.importance * 10;
    return score;
  };

  const searchPlaces = useCallback(async (q: string, limit: number) => {
    if (!q || q.length < 3) {
      abortRef.current?.abort();
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }
    try {
      const trimmed = q.trim();
      const cacheKey = `${trimmed.toLowerCase()}::${limit}`;
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        if (latestQueryRef.current === q) {
          setSuggestions(cached);
        }
        setSearchLoading(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSearchLoading(true);
      const query = encodeURIComponent(q.trim());
      const limitStr = String(Math.max(1, Math.min(100, limit || 50)));
      const viewbox = encodeURIComponent(KARACHI_VIEWBOX);
      const url = `/api/nominatim/search?q=${query}&limit=${limitStr}&addressdetails=1&viewbox=${viewbox}&bounded=1`;
      
      console.log('[SEARCH] Searching for:', q, 'URL:', url);
      
      // Get auth token if available
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (getAuthToken) {
        try {
          const token = await getAuthToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        } catch (e) {
          console.warn('[SEARCH] Could not get auth token:', e);
        }
      }
      
      const res = await fetch(url, { 
        method: 'GET',
        headers,
        signal: controller.signal
      });
      
      if (!res.ok) {
        console.error('[SEARCH] API returned:', res.status, res.statusText);
        setSuggestions([]);
        setSearchLoading(false);
        return;
      }
      
      const json = await res.json();
      console.log('[SEARCH] Got results:', json);
      
      const results: any[] = Array.isArray(json) ? json : (json?.features || []);
      const sorted = results
        .map((item) => ({ item, score: scoreSuggestion(item, q) }))
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.item);
      const limited = sorted.slice(0, limit || 50);
      cacheRef.current.set(cacheKey, limited);
      if (latestQueryRef.current === q) {
        setSuggestions(limited);
      }
      setSearchLoading(false);
    } catch (e) {
      if ((e as any)?.name === 'AbortError') return;
      console.error('[SEARCH] Error:', e);
      setSuggestions([]);
      setSearchLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 3) {
      abortRef.current?.abort();
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchPlaces(query, suggestLimit);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, suggestLimit, searchPlaces]);

  // Recalculate route when origin/destination/waypoints change
  useEffect(() => {
    const doGenerate = async () => {
      if (!origin || !destination) {
        console.log('[ROUTE_EDITOR] Missing origin or destination, skipping route generation');
        return;
      }
      
      // Validate coordinates are valid numbers
      if (!isFinite(origin.lat) || !isFinite(origin.lng) || !isFinite(destination.lat) || !isFinite(destination.lng)) {
        console.error('[ROUTE_EDITOR] Invalid coordinates:', { origin, destination });
        setRouteError('Invalid location coordinates. Please select valid locations.');
        setGenerating(false);
        return;
      }
      
      console.log('[ROUTE_EDITOR] Generating route from', origin, 'to', destination, 'with', waypoints.length, 'waypoints');
      setGenerating(true);
      setRouteError(null);
      let coords: [number, number][] = [];
      try {
        coords = [ [origin.lng, origin.lat] as [number, number], ...waypoints.map(w => [w.lng, w.lat] as [number, number]), [destination.lng, destination.lat] as [number, number] ];
        
        // Validate all coordinates
        for (const [lng, lat] of coords) {
          if (!isFinite(lat) || !isFinite(lng)) {
            throw new Error('Invalid coordinate values detected');
          }
        }
        
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
              const friendly = 'Unable to find a route. Try selecting different locations or check that they are accessible by car.';
              
              console.warn(`[ROUTE_EDITOR] Route service error on attempt ${attempt}/${2}`, { status: resp.status, body: parsed });
              
              if (resp.status >= 400 && resp.status < 500) {
                // Client error - no route available
                console.warn('[ROUTE_EDITOR] Client error (no route available)', { status: resp.status });
                setRouteError('No route found. Please select different locations that are connected by roads.');
                setGenerating(false);
                return;
              }
              if (attempt < 2) {
                console.log(`[ROUTE_EDITOR] Retrying route generation (attempt ${attempt + 1}/2)`);
                await new Promise(r => setTimeout(r, 300)); // 300ms retry delay
                continue;
              }
              console.error('[ROUTE_EDITOR] Route generation failed after all retries');
              setRouteError(friendly);
              setGenerating(false);
              return;
            }
            const data = await resp.json();
            
            // Validate response data
            if (!data || !data.features || data.features.length === 0) {
              throw new Error('Empty route response from server');
            }
            
            const coordsRes: any[] = (data?.features?.[0]?.geometry?.coordinates) || (data?.geometry?.coordinates) || [];
            
            if (coordsRes.length === 0) {
              throw new Error('No route coordinates in response');
            }
            
            const latlngs: LatLng[] = coordsRes.map((c: any) => ({ lat: c[1], lng: c[0] }));
            const polyline = encodePolyline(latlngs);
            const bounds = computeBounds(latlngs);
            const summary = (data?.features && data.features[0] && data.features[0].properties && data.features[0].properties.summary) || null;
            const distanceMeters = summary?.distance ?? null;
            const durationSeconds = summary?.duration ?? null;
            
            console.log('[ROUTE_EDITOR] ✓ Route generated successfully:', { 
              points: latlngs.length, 
              distance: distanceMeters ? `${(distanceMeters/1000).toFixed(1)}km` : 'unknown',
              duration: durationSeconds ? `${Math.round(durationSeconds/60)}min` : 'unknown'
            });
            
            setRouteError(null);
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
        console.error('[ROUTE_EDITOR] Route generation failed after all retries:', lastErr?.message || lastErr);
        const errorMsg = lastErr?.name === 'AbortError' 
          ? 'Request timed out. Please try selecting your locations again or check your internet connection.'
          : 'Unable to find a route. Please select different locations that are connected by roads.';
        setRouteError(errorMsg);
      } catch (e: any) {
        console.error('[ROUTE_EDITOR] Route generation error:', e?.message || e);
        setRouteError('Unable to generate route. Please select different locations and try again.');
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
            placeholder="Search for routes and places"
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              latestQueryRef.current = v;
              setQuery(v);
            }}
            className="pr-10"
          />
          {searchLoading && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-muted-foreground" />}

          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-slate-800 border border-slate-700 p-2 rounded max-h-72 overflow-y-auto z-50 shadow-lg">
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
                    <div className="text-sm font-medium text-slate-100 truncate">
                      {highlightMatch(primaryName, query)}
                    </div>
                    {secondary && (
                      <div className="text-xs text-muted-foreground truncate">
                        {highlightMatch(secondary, query)}
                      </div>
                    )}
                  </div>
                );
              })}
              {suggestions.length >= suggestLimit && (
                <div className="p-2 border-t border-slate-700">
                  <button 
                    type="button" 
                    className="text-xs text-accent hover:underline" 
                    onClick={() => setSuggestLimit((v) => Math.min(100, v + 25))}
                  >
                    Show more results
                  </button>
                </div>
              )}
            </div>
          )}
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
                  <div className="text-xs text-muted-foreground">Route point added</div>
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
