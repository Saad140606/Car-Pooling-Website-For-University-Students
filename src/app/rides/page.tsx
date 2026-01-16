"use client";

import React, { useEffect, useState, useCallback } from 'react';
import PublicRideCard from '@/components/PublicRideCard';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';

export default function PublicRidesPage() {
  const { user, data: userData } = useUser();
  const router = useRouter();

  // university filter state (all/ned/fast)
  const [uniFilter, setUniFilter] = useState<'all'|'ned'|'fast'>('all');
  const [lockedFilter, setLockedFilter] = useState(false);

  // pagination
  const [rides, setRides] = useState<any[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If user is logged in, lock filter to their university
  useEffect(() => {
    if (user && userData?.university) {
      setUniFilter(userData.university);
      setLockedFilter(true);
    } else {
      setLockedFilter(false);
      setUniFilter('all');
    }
  }, [user, userData]);

  const fetchRides = useCallback(async (opts: { reset?: boolean } = {}) => {
    if (loading) return;
    setLoading(true);
    try {
      const q = new URL('/api/public-rides', location.origin);
      q.searchParams.set('uni', uniFilter || 'all');
      q.searchParams.set('limit', '12');
      if (!opts.reset && nextToken) q.searchParams.set('pageToken', nextToken);
      const res = await fetch(q.toString());
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      if (opts.reset) setRides(json.rides || []);
      else setRides(prev => [...prev, ...(json.rides || [])]);
      setNextToken(json.nextPageToken || null);
    } catch (e) {
      console.error('fetch public rides', e);
    } finally {
      setLoading(false);
    }
  }, [uniFilter, nextToken, loading]);

  useEffect(() => { fetchRides({ reset: true }); }, [fetchRides, uniFilter]);

  const handleViewRoute = (ride: any) => {
    // open modal or route to ride detail. For now, go to dashboard view which requires auth
    router.push(`/dashboard/rides`);
  };

  const handleBook = (ride: any) => {
    // Book requires auth: redirect to select-university
    router.push('/auth/select-university');
  };

  return (
    <div>
      <h1 className="text-3xl font-headline mb-6">Public Rides</h1>

      <div className="mb-4 flex items-center gap-4">
        <div>
          <label className="text-sm mr-2">University</label>
          <Select onValueChange={(v: any) => !lockedFilter && setUniFilter(v)} defaultValue={uniFilter}>
            <SelectTrigger className="min-w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Universities</SelectItem>
              <SelectItem value="ned">NED University</SelectItem>
              <SelectItem value="fast">FAST University</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto">
          <Button onClick={() => router.push('/auth/select-university')}>Sign In</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rides.map(r => (
          <PublicRideCard key={r.id} ride={r} onViewRoute={() => handleViewRoute(r)} onBook={() => handleBook(r)} />
        ))}
      </div>

      <div className="mt-6 text-center">
        {nextToken ? (
          <Button onClick={() => fetchRides() } disabled={loading}>{loading ? 'Loading…' : 'Load more'}</Button>
        ) : (
          <div className="text-sm text-muted-foreground">No more rides</div>
        )}
      </div>
    </div>
  );
}
