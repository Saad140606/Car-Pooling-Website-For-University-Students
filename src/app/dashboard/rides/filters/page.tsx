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
      const iterable = searchParams ? Array.from(searchParams.entries()) as Iterable<readonly [string, string]> : [];
      const params = Object.fromEntries(iterable);
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

  // CRITICAL SECURITY: When a user logs in, their university is LOCKED to their profile
  // They cannot select a different university under any circumstance
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
      {/* Floating background orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
        <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
      </div>
      
      <div className="section-shell py-8 relative z-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-headline font-bold text-slate-50 mb-1">Refine Your Search</h1>
          <p className="text-slate-300">Customize filters to find the perfect ride</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.back()} className="text-slate-200 hover:text-slate-50">Back</Button>
          <Button onClick={clear} className="bg-slate-800/50 text-slate-200 hover:bg-slate-800 hover:text-slate-50">Clear</Button>
          <Button onClick={apply} className="shadow-lg shadow-primary/30 hover:shadow-primary/50">Apply</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* University Filter */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 animate-slide-in-down" style={{ animationDelay: '0.1s' }}>
          {/* Show a locked label only for valid logged-in universities */}
          <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
            {(user && userData && (userData.university === 'fast' || userData.university === 'ned')) ? 'University (Locked to Portal)' : 'University'}
          </div>

          {/* Lock only when the authenticated user has a valid university value */}
          { (user && userData && (userData.university === 'fast' || userData.university === 'ned')) ? (
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
            // For everyone else (including logged-out users and invalid data), show an unlocked dropdown
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

        {/* Transport Filter */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 animate-slide-in-down" style={{ animationDelay: '0.15s' }}>
          <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Transport</div>
          <Select value={filters.transport} onValueChange={(v) => setFilters(f => ({ ...f, transport: v as any }))}>
            <SelectTrigger className="w-full bg-slate-800/50 backdrop-blur-sm text-slate-200 focus:ring-primary"><SelectValue>{filters.transport === 'any' ? 'Any' : filters.transport}</SelectValue></SelectTrigger>
            <SelectContent className="bg-slate-900">
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="car">Car</SelectItem>
              <SelectItem value="bike">Bike</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Gender Filter */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-950/60 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 animate-slide-in-down" style={{ animationDelay: '0.2s' }}>
          <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Gender</div>
          <Select value={filters.gender} onValueChange={(v) => setFilters(f => ({ ...f, gender: v as any }))}>
            <SelectTrigger className="w-full bg-slate-800/50 backdrop-blur-sm text-slate-200 focus:ring-primary"><SelectValue>{filters.gender === 'any' ? 'Any' : filters.gender}</SelectValue></SelectTrigger>
            <SelectContent className="bg-slate-900 border-border/40">
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Price Min Filter */}
        <div className="p-5 rounded-2xl border border-primary/25 bg-gradient-to-br from-card/90 via-card/80 to-card/70 backdrop-blur-lg shadow-lg hover:shadow-xl hover:border-primary/50 transition-all duration-300 animate-slide-in-down" style={{ animationDelay: '0.25s' }}>
          <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Min Price</div>
          <Input value={filters.minPrice} onChange={(e) => setFilters(f => ({ ...f, minPrice: e.target.value }))} placeholder="Enter min price" className="border-border/40 bg-background/60 backdrop-blur-sm text-slate-200 placeholder:text-slate-400 focus:border-primary/50" />
        </div>

        {/* Price Max Filter */}
        <div className="p-5 rounded-2xl border border-primary/25 bg-gradient-to-br from-card/90 via-card/80 to-card/70 backdrop-blur-lg shadow-lg hover:shadow-xl hover:border-primary/50 transition-all duration-300 animate-slide-in-down" style={{ animationDelay: '0.3s' }}>
          <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Max Price</div>
          <Input value={filters.maxPrice} onChange={(e) => setFilters(f => ({ ...f, maxPrice: e.target.value }))} placeholder="Enter max price" className="border-border/40 bg-background/60 backdrop-blur-sm text-slate-200 placeholder:text-slate-400 focus:border-primary/50" />
        </div>

        {/* Place Filter */}
        <div className="md:col-span-2 p-5 rounded-2xl border border-primary/25 bg-gradient-to-br from-card/90 via-card/80 to-card/70 backdrop-blur-lg shadow-lg hover:shadow-xl hover:border-primary/50 transition-all duration-300 animate-slide-in-down" style={{ animationDelay: '0.35s' }}>
          <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Place</div>
          <div className="relative">
            <Input aria-autocomplete="list" aria-expanded={suggestions.length>0} placeholder="Search place (e.g. Main Gate)" value={filters.pointInput} className="border-border/40 bg-background/60 backdrop-blur-sm text-slate-200 placeholder:text-slate-400 focus:border-primary/50" onChange={(e) => {
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
              <ul role="listbox" className="absolute z-50 left-0 right-0 bg-slate-900/95 border border-border/40 backdrop-blur-lg rounded-xl mt-2 max-h-56 overflow-auto shadow-2xl">
                {suggestions.map((s, i) => (
                  <li key={s.place_id || s.osm_id} role="option" tabIndex={0} className="p-3 cursor-pointer hover:bg-primary/10 border-b border-border/20 last:border-b-0 transition-colors" onClick={() => {
                    const lat = Number(s.lat || s.latitude || (s.center && s.center.lat));
                    const lon = Number(s.lon || s.longitude || (s.center && s.center.lng));
                    if (!isNaN(lat) && !isNaN(lon)) {
                      setFilters(f => ({ ...f, pointInput: s.display_name || s.name || '', point: { lat, lng: lon } }));
                    } else {
                      setFilters(f => ({ ...f, pointInput: s.display_name || s.name || '', point: null }));
                    }
                    setSuggestions([]);
                  }} onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLElement).click(); } }}>
                    <div className="text-sm text-slate-200">{s.display_name || s.name}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Direction Filter */}
        <div className="md:col-span-2 p-5 rounded-2xl border border-primary/25 bg-gradient-to-br from-card/90 via-card/80 to-card/70 backdrop-blur-lg shadow-lg hover:shadow-xl hover:border-primary/50 transition-all duration-300 animate-slide-in-down" style={{ animationDelay: '0.4s' }}>
          <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Direction</div>
          <Select value={filters.direction} onValueChange={(v) => setFilters(f => ({ ...f, direction: v as any }))}>
            <SelectTrigger className="w-full border-border/40 bg-background/60 backdrop-blur-sm text-slate-200 focus:border-primary/50"><SelectValue>{filters.direction === 'any' ? 'Any' : filters.direction === 'toUniversity' ? 'To University' : 'From University'}</SelectValue></SelectTrigger>
            <SelectContent className="bg-slate-900 border-border/40">
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="toUniversity">Going To University</SelectItem>
              <SelectItem value="fromUniversity">Leaving From University</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-8 p-5 rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/5 via-accent/5 to-transparent backdrop-blur-lg shadow-lg animate-slide-in-down" style={{ animationDelay: '0.45s' }}>
        <div className="flex items-start gap-3">
          <div className="text-accent text-xl mt-0.5">💡</div>
          <div>
            <div className="text-sm font-semibold text-slate-200 mb-1">Pro Tip</div>
            <div className="text-sm text-slate-300">Filters are applied to the list and are bookmarkable via the URL. Save your favorite search combinations!</div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}