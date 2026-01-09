import React, { useEffect, useState, useCallback } from 'react';
import { Waypoint, LatLng, encodePolyline, computeBounds } from '@/lib/route';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type RouteEditorProps = {
  origin?: Waypoint | null;
  destination?: Waypoint | null;
  onRouteGenerated?: (data: { waypoints: Waypoint[]; polyline: string; bounds: ReturnType<typeof computeBounds> | null }) => void;
};

export default function RouteEditor({ origin, destination, onRouteGenerated }: RouteEditorProps) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

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

  const searchPlaces = useCallback(async (q: string) => {
    if (!q || q.length < 2) return setSuggestions([]);
    try {
      const res = await fetch(`/api/nominatim/search?q=${encodeURIComponent(q)}&limit=6`);
      if (!res.ok) return setSuggestions([]);
      const json = await res.json();
      setSuggestions(Array.isArray(json) ? json : []);
    } catch (e) { setSuggestions([]); }
  }, []);

  // Recalculate route when origin/destination/waypoints change
  useEffect(() => {
    const doGenerate = async () => {
      if (!origin || !destination) return;
      setGenerating(true);
      try {
        // Prepare coordinates in [lng,lat] for ORS
        const coords: [number, number][] = [ [origin.lng, origin.lat], ...waypoints.map(w => [w.lng, w.lat]), [destination.lng, destination.lat] ];
        const resp = await fetch('/api/ors', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coordinates: coords })
        });
        if (!resp.ok) throw new Error('Route service failed');
        const data = await resp.json();
        // ORS may return geometry coordinates as [lng,lat]
        const coordsRes: any[] = (data?.features?.[0]?.geometry?.coordinates) || (data?.geometry?.coordinates) || [];
        const latlngs: LatLng[] = coordsRes.map((c: any) => ({ lat: c[1], lng: c[0] }));
        const polyline = encodePolyline(latlngs);
        const bounds = computeBounds(latlngs);
        onRouteGenerated?.({ waypoints, polyline, bounds });
      } catch (e) {
        console.error('Route generation failed', e);
      } finally { setGenerating(false); }
    };
    doGenerate();
  }, [origin, destination, waypoints, onRouteGenerated]);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Add Route Points (Optional)</h3>
      <div className="flex gap-2">
        <Input placeholder="Search place or address" value={query} onChange={(e) => { setQuery(e.target.value); searchPlaces(e.target.value); }} />
        <Button onClick={() => { if (suggestions[0]) addWaypoint({ name: suggestions[0].display_name, lat: Number(suggestions[0].lat), lng: Number(suggestions[0].lon) }); }}>Add</Button>
      </div>
      {suggestions.length > 0 && (
        <div className="bg-card p-2 rounded">
          {suggestions.map((s) => (
            <div key={s.place_id} className="p-1 hover:bg-muted cursor-pointer" onClick={() => { addWaypoint({ name: s.display_name, lat: Number(s.lat), lng: Number(s.lon) }); setQuery(''); setSuggestions([]); }}>
              <div className="text-sm">{s.display_name}</div>
            </div>
          ))}
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
      </div>
    </div>
  );
}
