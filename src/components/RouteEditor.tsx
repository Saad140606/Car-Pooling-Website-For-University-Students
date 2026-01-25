import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Waypoint, LatLng, encodePolyline, computeBounds } from '@/lib/route';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
  const debounceRef = useRef<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

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

  useEffect(() => { setSuggestions([]); }, [query]);

  // Default Karachi viewbox to restrict suggestions to Karachi area when using this editor
  // Nominatim expects viewbox as: left_lon,top_lat,right_lon,bottom_lat
  const KARACHI_VIEWBOX = '66.5,25.5,67.5,24.6';

  const searchPlaces = useCallback(async (q: string, limit: number) => {
    if (!q || q.length < 1) return setSuggestions([]);
    try {
      // Show more comprehensive results within Karachi; include small places
      const res = await fetch(`/api/nominatim/search?q=${encodeURIComponent(q.trim().toLowerCase() === 'all' ? 'karachi' : q)}&limit=${encodeURIComponent(String(Math.max(1, Math.min(500, limit || 100))))}&addressdetails=1&viewbox=${encodeURIComponent(KARACHI_VIEWBOX)}&bounded=1`);
      if (!res.ok) return setSuggestions([]);
      const json = await res.json();
      const results: any[] = Array.isArray(json) ? json : [];
      // Server-side viewbox already bounds results to Karachi; include as-is
      setSuggestions(results);
    } catch (e) { setSuggestions([]); }
  }, []);

  // Recalculate route when origin/destination/waypoints change
  useEffect(() => {
    const doGenerate = async () => {
      if (!origin || !destination) return;
      setGenerating(true);
      let coords: [number, number][] = [];
      try {
        // Prepare coordinates in [lng,lat] for ORS
        coords = [ [origin.lng, origin.lat] as [number, number], ...waypoints.map(w => [w.lng, w.lat] as [number, number]), [destination.lng, destination.lat] as [number, number] ];
        const resp = await fetch('/api/ors', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coordinates: coords })
        });
        if (!resp.ok) {
          let bodyText: string | null = null;
          let parsed: any = null;
          try { bodyText = await resp.text(); } catch (e) { /* ignore */ }
          try { parsed = bodyText ? JSON.parse(bodyText) : null; } catch (e) { parsed = bodyText; }
          const details = parsed && typeof parsed === 'object' ? parsed : (bodyText || '');
          const friendly = 'No route found between these locations. Try different points or adjust the route.';
          // Treat client-status errors as no-route, avoid console errors.
          if (resp.status >= 400 && resp.status < 500) {
            console.warn('Route service returned client error (no route/bad request)', { status: resp.status, details });
            setRouteError(friendly);
            return; // do not draw fallback straight line
          }
          // For other statuses, also surface friendly message without throwing
          console.warn('Route service error', { status: resp.status, details });
          setRouteError(friendly);
          return;
        }
        const data = await resp.json();
        setRouteError(null);
        // ORS may return geometry coordinates as [lng,lat]
        const coordsRes: any[] = (data?.features?.[0]?.geometry?.coordinates) || (data?.geometry?.coordinates) || [];
        const latlngs: LatLng[] = coordsRes.map((c: any) => ({ lat: c[1], lng: c[0] }));
        const polyline = encodePolyline(latlngs);
        const bounds = computeBounds(latlngs);
        // ORS returns summary in meters and seconds at features[0].properties.summary
        const summary = (data?.features && data.features[0] && data.features[0].properties && data.features[0].properties.summary) || null;
        const distanceMeters = summary?.distance ?? null;
        const durationSeconds = summary?.duration ?? null;
        onRouteGenerated?.({ waypoints, polyline, bounds, distanceMeters, durationSeconds });
      } catch (e: any) {
        console.warn('Route generation failed', e);
        setRouteError('No route found between these locations. Try different points or adjust the route.');
        // Do not draw fallback straight line — show friendly message instead
      } finally { setGenerating(false); }
    };
    doGenerate();
  }, [origin, destination, waypoints, onRouteGenerated]);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Add Route Points (Optional)</h3>
      <div className="flex gap-2">
        <Input
          placeholder="Search place or address"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            // Debounce requests to avoid firing for every keystroke
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
            // Fast debounce for responsive suggestions
            const delay = 200;
            debounceRef.current = window.setTimeout(() => {
              searchPlaces(v, suggestLimit);
            }, delay) as unknown as number;
          }}
        />
        <Button onClick={() => { if (suggestions[0]) addWaypoint({ name: suggestions[0].display_name, lat: Number(suggestions[0].lat), lng: Number(suggestions[0].lon) }); }}>Add</Button>
      </div>
      {suggestions.length > 0 && (
        <div className="bg-card p-2 rounded">
          {suggestions.map((s) => (
            <div key={s.place_id} className="p-1 hover:bg-muted cursor-pointer" onClick={() => { addWaypoint({ name: s.display_name, lat: Number(s.lat), lng: Number(s.lon) }); setQuery(''); setSuggestions([]); }}>
              <div className="text-sm">{s.display_name}</div>
              {(() => {
                const a = (s as any).address || {};
                const road = a.road || a.residential || a.pedestrian || a.path || a.cycleway;
                const hood = a.neighbourhood || a.suburb || a.quarter || a.city_district;
                const city = a.city || a.town || a.village || a.county;
                const parts = [road, hood, city].filter(Boolean);
                return parts.length ? <div className="text-xs text-muted-foreground truncate">{parts.join(', ')}</div> : null;
              })()}
            </div>
          ))}
          {suggestions.length >= suggestLimit && (
            <div className="p-2 border-t">
              <button type="button" className="text-xs text-accent hover:underline" onClick={() => setSuggestLimit((v) => Math.min(200, v + 30))}>Show more results</button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {waypoints.map((w, i) => (
          <div key={`${w.lat}-${w.lng}-${i}`} className="flex items-center gap-2">
            <div className="flex-1 text-sm truncate">{w.name || `${w.lat.toFixed(4)}, ${w.lng.toFixed(4)}`}</div>
            <div className="flex gap-1">
              <Button size="sm" onClick={() => moveWaypoint(i, -1)} disabled={i === 0}>↑</Button>
              <Button size="sm" onClick={() => moveWaypoint(i, 1)} disabled={i === waypoints.length - 1}>↓</Button>
              <Button size="sm" variant="destructive" onClick={() => removeWaypoint(i)}>Remove</Button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="text-xs text-muted-foreground">Route generation: {generating ? 'calculating...' : 'ready'}</div>
        {routeError ? (
          <div className="text-sm text-red-400 mt-2">{routeError}</div>
        ) : null}
      </div>
    </div>
  );
}
