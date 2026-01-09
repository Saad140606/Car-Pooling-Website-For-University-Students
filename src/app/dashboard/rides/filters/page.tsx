'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
    pointInput: '' as string,
    direction: 'any' as 'any'|'toUniversity'|'fromUniversity',
  });

  useEffect(() => {
    try {
      const params = Object.fromEntries(searchParams ? Array.from(searchParams.entries()) : []);
      setFilters({
        transport: (params.transport as any) || 'any',
        gender: (params.gender as any) || 'any',
        minPrice: params.minPrice || '',
        maxPrice: params.maxPrice || '',
        pointInput: params.pointInput || '',
        direction: (params.direction as any) || 'any',
      });
    } catch (_) {}
  }, [searchParams]);

  const apply = () => {
    const p = new URLSearchParams();
    if (filters.transport && filters.transport !== 'any') p.set('transport', filters.transport);
    if (filters.gender && filters.gender !== 'any') p.set('gender', filters.gender);
    if (filters.minPrice) p.set('minPrice', filters.minPrice);
    if (filters.maxPrice) p.set('maxPrice', filters.maxPrice);
    if (filters.pointInput) p.set('pointInput', parsePointInput(filters.pointInput));
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
          <div className="text-xs text-muted-foreground">Point (lat,lng)</div>
          <Input placeholder="e.g. 24.8607,67.0011" value={filters.pointInput} onChange={(e) => setFilters(f => ({ ...f, pointInput: e.target.value }))} />
        </div>

        <div>
          <div className="text-xs text-muted-foreground">Direction</div>
          <Select value={filters.direction} onValueChange={(v) => setFilters(f => ({ ...f, direction: v as any }))}>
            <SelectTrigger className="w-44"><SelectValue>{filters.direction === 'any' ? 'Any' : filters.direction === 'toUniversity' ? 'To University' : 'From University'}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="toUniversity">To University</SelectItem>
              <SelectItem value="fromUniversity">From University</SelectItem>
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