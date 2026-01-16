"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { collection, query, where, orderBy, onSnapshot, DocumentData, doc, updateDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import MapLeaflet from '@/components/MapLeaflet';
import RidesTable from '@/components/RidesTable';
import RideDetailModal from '@/components/RideDetailModal';
import { haversine } from '@/lib/route';

type Ride = DocumentData & {
  id?: string;
  riderId?: string;
  passengerIds?: string[];
  startLocation?: string;
  endLocation?: string;
  createdAt?: any;
  status?: string;
  fare?: number;
  rating?: number;
  route?: any;
};

export default function AnalyticsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'history' | 'analytics'>('history');
  const [mapRoute, setMapRoute] = useState<any[] | null>(null);
  const [ratingLoading, setRatingLoading] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] = useState<any | null>(null);

  useEffect(() => {
    if (!firestore || !user) {
      setRides([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const riderQ = query(
      collection(firestore, 'rides'),
      where('riderId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const passengerQ = query(
      collection(firestore, 'rides'),
      where('passengerIds', 'array-contains', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribers: Array<() => void> = [];

    const riderUnsub = onSnapshot(riderQ, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRides((prev) => {
        // merge with existing passenger rides if any
        const other = prev.filter((r) => r.riderId !== user.uid);
        const merged = [...data, ...other];
        // dedupe by id
        const map = new Map<string, Ride>();
        for (const r of merged) if (r.id) map.set(r.id, r);
        return Array.from(map.values()).sort((a, b) => {
          const ta = a.createdAt?.seconds ?? 0;
          const tb = b.createdAt?.seconds ?? 0;
          return tb - ta;
        });
      });
      setLoading(false);
    }, (err) => {
      console.warn('riderQ snapshot error', err);
      setLoading(false);
    });

    const passengerUnsub = onSnapshot(passengerQ, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRides((prev) => {
        const riderOnly = prev.filter((r) => r.riderId === user.uid);
        const merged = [...riderOnly, ...data];
        const map = new Map<string, Ride>();
        for (const r of merged) if (r.id) map.set(r.id, r);
        return Array.from(map.values()).sort((a, b) => {
          const ta = a.createdAt?.seconds ?? 0;
          const tb = b.createdAt?.seconds ?? 0;
          return tb - ta;
        });
      });
      setLoading(false);
    }, (err) => {
      console.warn('passengerQ snapshot error', err);
      setLoading(false);
    });

    unsubscribers.push(riderUnsub, passengerUnsub);

    return () => unsubscribers.forEach((u) => u());
  }, [firestore, user]);

  const stats = useMemo(() => {
    const total = rides.length;
    const completed = rides.filter((r) => r.status === 'completed').length;
    const cancelled = rides.filter((r) => r.status === 'cancelled').length;
    const pending = rides.filter((r) => r.status === 'pending').length;
    const avgRating = (() => {
      const rated = rides.filter((r) => typeof r.rating === 'number');
      if (rated.length === 0) return null;
      const sum = rated.reduce((s, r) => s + (r.rating || 0), 0);
      return +(sum / rated.length).toFixed(2);
    })();

    // earnings/spent: when user is rider they 'earn' fare; when passenger they 'spend'.
    let earned = 0;
    let spent = 0;
    for (const r of rides) {
      const fare = Number(r.fare || 0);
      if (r.riderId === user?.uid) earned += fare;
      else if (Array.isArray(r.passengerIds) && r.passengerIds.includes(user?.uid)) spent += fare;
    }

    // favorite routes (top by count)
    const routeCounts = new Map<string, number>();
    for (const r of rides) {
      const key = `${r.startLocation || 'Unknown'} → ${r.endLocation || 'Unknown'}`;
      routeCounts.set(key, (routeCounts.get(key) || 0) + 1);
    }
    const favoriteRoutes = Array.from(routeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([route, count]) => ({ route, count }));

    return { total, completed, cancelled, pending, avgRating, earned, spent, favoriteRoutes };
  }, [rides, user]);

  if (userLoading) return <div className="p-6">Loading user…</div>;

  function closeMap() { setMapRoute(null); }

  // Simple sparkline: histogram of rides by day
  function Sparkline({ data }: { data: number[] }) {
    if (!data || data.length === 0) return <div className="h-8" />;
    // bucket by day (local)
    const counts = new Map<string, number>();
    data.forEach((ts) => {
      const d = new Date(ts);
      const key = d.toISOString().slice(0,10);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const points = Array.from(counts.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>v);
    const max = Math.max(...points, 1);
    const W = 300, H = 40; const bw = Math.max(2, Math.floor(W / points.length));
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="rounded">
        {points.map((v,i)=>{
          const h = (v/max) * (H-4);
          const x = i * bw;
          return <rect key={i} x={x} y={H-h-2} width={bw-1} height={h} fill="#3b82f6" opacity="0.9" />
        })}
      </svg>
    );
  }

  function computePeakTimes(rides: Ride[]) {
    const hours = new Array(24).fill(0);
    for (const r of rides) {
      const t = r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000) : (r.createdAt?.toDate ? r.createdAt.toDate() : null);
      if (!t) continue;
      hours[t.getHours()]++;
    }
    const max = Math.max(...hours);
    if (max === 0) return '—';
    const peaks = hours.map((c,i)=> ({c,i})).filter(x=>x.c===max).map(x=>`${x.i}:00`);
    return peaks.join(', ');
  }

  function computeDistanceTotal(rides: Ride[]) {
    let meters = 0;
    for (const r of rides) {
      if (typeof r.distance === 'number') { meters += r.distance; continue; }
      const route = r.route;
      if (!route || !Array.isArray(route) || route.length < 2) continue;
      for (let i=0;i<route.length-1;i++){
        const a = Array.isArray(route[i]) ? { lat: Number(route[i][0]), lng: Number(route[i][1]) } : { lat: Number(route[i].lat), lng: Number(route[i].lng) };
        const b = Array.isArray(route[i+1]) ? { lat: Number(route[i+1][0]), lng: Number(route[i+1][1]) } : { lat: Number(route[i+1].lat), lng: Number(route[i+1].lng) };
        meters += haversine(a as any, b as any);
      }
    }
    return (meters/1000).toFixed(2);
  }

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">My Rides & Analytics</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Ride History</CardTitle>
                <CardDescription>Your personal ride history (as rider or passenger)</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Loading rides…</div>
                ) : rides.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No rides yet.</div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <button className={"px-3 py-1 rounded-md " + (tab==='history' ? 'bg-primary text-white' : 'bg-muted-foreground/10')} onClick={() => setTab('history')}>Ride History</button>
                      <button className={"px-3 py-1 rounded-md " + (tab==='analytics' ? 'bg-primary text-white' : 'bg-muted-foreground/10')} onClick={() => setTab('analytics')}>Analytics</button>
                    </div>

                    {tab === 'history' ? (
                      <div className="space-y-3">
                        <RidesTable rides={rides} pageSize={8} onOpenRide={(r) => setSelectedRide(r)} />
                      </div>
                    ) : (
                      <div>
                        {/* Simple charts & analytics in the same column */}
                        <div className="mb-4">
                          <div className="text-sm text-muted-foreground">Rides Over Time</div>
                          <Sparkline data={rides.map(r => r.createdAt?.seconds ? r.createdAt.seconds * 1000 : Date.now())} />
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          <div className="text-sm">Peak usage times: {computePeakTimes(rides)}</div>
                          <div className="text-sm">Distance traveled: {computeDistanceTotal(rides)} km</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
                <CardDescription>Quick stats about your rides</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2">
                    <div className="text-xs text-muted-foreground">Total rides</div>
                    <div className="text-xl font-semibold">{stats.total}</div>
                  </div>
                  <div className="p-2">
                    <div className="text-xs text-muted-foreground">Completed</div>
                    <div className="text-xl font-semibold text-emerald-500">{stats.completed}</div>
                  </div>
                  <div className="p-2">
                    <div className="text-xs text-muted-foreground">Avg rating</div>
                    <div className="text-xl font-semibold">{stats.avgRating ?? '—'}</div>
                  </div>
                  <div className="p-2">
                    <div className="text-xs text-muted-foreground">Total earned/spent</div>
                    <div className="text-xl font-semibold">PKR {stats.earned || 0} / PKR {stats.spent || 0}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Favorite Routes</CardTitle>
                <CardDescription>Top routes from your history</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.favoriteRoutes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No routes yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {stats.favoriteRoutes.map((f, i) => (
                      <li key={i} className="flex justify-between text-sm">
                        <span className="truncate">{f.route}</span>
                        <span className="text-muted-foreground">{f.count}x</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
        {mapRoute ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl h-[70vh] bg-white rounded shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b">
              <div className="font-semibold">Ride Route</div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 rounded bg-gray-200" onClick={() => { setMapRoute(null); }}>Close</button>
              </div>
            </div>
            <div className="w-full h-full">
              <MapLeaflet route={mapRoute} className="w-full h-full" />
            </div>
          </div>
        </div>
      ) : null}

      <RideDetailModal ride={selectedRide} onClose={() => setSelectedRide(null)} />
    </div>
  );
}
