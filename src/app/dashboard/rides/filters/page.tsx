'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/firebase';
import { getUniversityShortLabel } from '@/lib/universities';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

function parsePointInput(s: string) {
  const parts = s.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (!isNaN(lat) && !isNaN(lng)) return `${lat},${lng}`;
  }
  return '';
}

export default function FiltersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState({
    transport: 'any' as 'any'|'car'|'bike',
    gender: 'any' as 'any'|'male'|'female',
    minPrice: '' as string,
    maxPrice: '' as string,
    // `point` stores selected coordinates; `pointInput` stores display text
    pointInput: '' as string,
    point: null as { lat: number; lng: number } | null,
    university: '' as string,
    direction: 'any' as 'any'|'toUniversity'|'fromUniversity',
  });

  const [suggestions, setSuggestions] = useState<Array<any>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    try {
      const params = Object.fromEntries(searchParams ? Array.from(searchParams.entries()) : []);
      setFilters({
        transport: (params.transport as any) || 'any',
        gender: (params.gender as any) || 'any',
        minPrice: params.minPrice || '',
        maxPrice: params.maxPrice || '',
        pointInput: params.pointInput || (params.pointName || ''),
        point: params.point ? (function(){ const parts = (params.point || '').split(',').map(p=>p.trim()); if (parts.length>=2){ const lat=Number(parts[0]); const lng=Number(parts[1]); if (!isNaN(lat)&&!isNaN(lng)) return {lat,lng}; } return null; })() : null,
        university: params.university || '',
        direction: (params.direction as any) || 'any',
      });
    } catch (_) {}
  }, [searchParams]);

  const { user, data: userData } = useUser();

  // When a logged-in user has a university, lock the filters.university to it
  useEffect(() => {
    if (user && userData && userData.university) {
      setFilters(f => ({ ...f, university: userData.university }));
    }
  }, [user, userData]);

  const apply = () => {
    const p = new URLSearchParams();
    if (filters.transport && filters.transport !== 'any') p.set('transport', filters.transport);
    if (filters.gender && filters.gender !== 'any') p.set('gender', filters.gender);
    if (filters.minPrice) p.set('minPrice', filters.minPrice);
    if (filters.maxPrice) p.set('maxPrice', filters.maxPrice);
    if (filters.point) p.set('point', `${filters.point.lat},${filters.point.lng}`);
    if (filters.university && filters.university !== 'any') p.set('university', filters.university);
    if (filters.direction && filters.direction !== 'any') p.set('direction', filters.direction);

    const qs = p.toString();
    router.push(`/dashboard/rides${qs ? `?${qs}` : ''}`);
  };

  const clear = () => {
    router.push('/dashboard/rides');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Filters</h1>
          <p className="text-sm text-muted-foreground">Refine your search for rides</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.back()}>Back</Button>
          <Button onClick={clear} variant="outline">Clear</Button>
          <Button onClick={apply}>Apply</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-muted-foreground">University</div>
          {user && userData && userData.university ? (
            <div className="flex items-center gap-2">
              <Input value={getUniversityShortLabel(userData.university) || userData.university} disabled />
              <Badge variant="outline">Locked</Badge>
            </div>
          ) : (
            <Select value={filters.university || 'any'} onValueChange={(v) => setFilters(f => ({ ...f, university: v }))}>
              <SelectTrigger className="w-44"><SelectValue>{filters.university && filters.university !== 'any' ? getUniversityShortLabel(filters.university) || filters.university : 'Select'}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="fast">FAST</SelectItem>
                <SelectItem value="ned">NED</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div>
          <div className="text-xs text-muted-foreground">Transport</div>
          <Select value={filters.transport} onValueChange={(v) => setFilters(f => ({ ...f, transport: v as any }))}>
            <SelectTrigger className="w-44"><SelectValue>{filters.transport === 'any' ? 'Any' : filters.transport}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="car">Car</SelectItem>
              <SelectItem value="bike">Bike</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">Gender</div>
          <Select value={filters.gender} onValueChange={(v) => setFilters(f => ({ ...f, gender: v as any }))}>
            <SelectTrigger className="w-44"><SelectValue>{filters.gender === 'any' ? 'Any' : filters.gender}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">Price Min</div>
          <Input value={filters.minPrice} onChange={(e) => setFilters(f => ({ ...f, minPrice: e.target.value }))} placeholder="Min" />
        </div>

        <div>
          <div className="text-xs text-muted-foreground">Price Max</div>
          <Input value={filters.maxPrice} onChange={(e) => setFilters(f => ({ ...f, maxPrice: e.target.value }))} placeholder="Max" />
        </div>

        <div className="md:col-span-2">
          <div className="text-xs text-muted-foreground">Place</div>
          <div className="relative">
            <Input aria-autocomplete="list" aria-expanded={suggestions.length>0} placeholder="Search place (e.g. Main Gate)" value={filters.pointInput} onChange={(e) => {
              const v = e.target.value;
              setFilters(f => ({ ...f, pointInput: v, point: null }));
              if (!v || v.trim().length < 2) {
                // cancel pending timer or fetch and clear suggestions immediately
                try { window.clearTimeout((window as any).__filters_suggest_timer); } catch (e) {}
                try { (window as any).__filters_suggest_controller?.abort(); } catch (e) {}
                setSuggestions([]);
                setSearching(false);
                return;
              }
              setSearching(true);
              // debounce
              window.clearTimeout((window as any).__filters_suggest_timer);
              (window as any).__filters_suggest_timer = window.setTimeout(async () => {
                // create an AbortController so we can cancel late responses
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
                    // aborted - ignore
                  } else {
                    setSuggestions([]);
                  }
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
        </div>

        <div>
          <div className="text-xs text-muted-foreground">Direction</div>
          <Select value={filters.direction} onValueChange={(v) => setFilters(f => ({ ...f, direction: v as any }))}>
            <SelectTrigger className="w-44"><SelectValue>{filters.direction === 'any' ? 'Any' : filters.direction === 'toUniversity' ? 'To University' : 'From University'}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="toUniversity">Going To University</SelectItem>
              <SelectItem value="fromUniversity">Leaving From University</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Badge>Tip</Badge>
        <div className="text-sm text-muted-foreground">Filters are applied to the list and are bookmarkable via the URL.</div>
      </div>
    </div>
  );
}