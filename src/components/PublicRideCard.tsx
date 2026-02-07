import React from 'react';
import { Calendar, Users, Search, Clock } from 'lucide-react';
import clsx from 'clsx';

// Helper: Convert any timestamp format to Date safely with detailed logging
function getDateFromTimestamp(ts: any): Date | null {
  if (!ts) {
    console.debug('[PublicRideCard] Timestamp is null or undefined');
    return null;
  }
  
  // If already a Date, validate and return
  if (ts instanceof Date) {
    if (!isNaN(ts.getTime())) {
      console.debug('[PublicRideCard] Parsed Date object:', ts.toISOString());
      return ts;
    }
    console.warn('[PublicRideCard] Invalid Date object');
    return null;
  }
  
  // If number (milliseconds), convert to Date
  if (typeof ts === 'number') {
    if (isFinite(ts)) {
      const d = new Date(ts);
      console.debug('[PublicRideCard] Parsed number timestamp:', d.toISOString());
      return d;
    }
    console.warn('[PublicRideCard] Invalid number timestamp (not finite):', ts);
    return null;
  }
  
  // If Firestore Timestamp with .seconds and .nanoseconds
  if (ts && typeof ts === 'object') {
    if (typeof ts.seconds === 'number' && typeof ts.nanoseconds === 'number') {
      const ms = ts.seconds * 1000 + (ts.nanoseconds / 1_000_000);
      if (isFinite(ms)) {
        const d = new Date(ms);
        console.debug('[PublicRideCard] Parsed Firestore Timestamp:', { seconds: ts.seconds, nanoseconds: ts.nanoseconds, isoString: d.toISOString() });
        return d;
      }
      console.warn('[PublicRideCard] Invalid Firestore Timestamp (not finite):', { seconds: ts.seconds, nanoseconds: ts.nanoseconds, ms });
      return null;
    }
    // Check for toDate() method (Firebase SDK Timestamp)
    if (typeof ts.toDate === 'function') {
      try {
        const d = ts.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) {
          console.debug('[PublicRideCard] Parsed Timestamp.toDate():', d.toISOString());
          return d;
        }
      } catch (e) {
        console.warn('[PublicRideCard] toDate() failed:', e);
      }
    }
  }
  
  // Try parsing as ISO string or other string format
  if (typeof ts === 'string') {
    try {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        console.debug('[PublicRideCard] Parsed string timestamp:', ts, '→', d.toISOString());
        return d;
      }
      console.warn('[PublicRideCard] Parsed string but got invalid Date:', ts);
    } catch (e) {
      console.warn('[PublicRideCard] Failed to parse string timestamp:', ts, e);
    }
  }
  
  console.warn('[PublicRideCard] Could not parse timestamp of type', typeof ts, ':', ts);
  return null;
}

export default function PublicRideCard({ ride, onViewRoute, onBook }: { ride: any; onViewRoute?: () => void; onBook?: () => void }) {
  let departureDate: Date | null = null;
  try {
    departureDate = getDateFromTimestamp(ride.departureTime);
  } catch (e) {
    console.error('[PublicRideCard] ❌ Exception parsing departureTime:', e);
  }
  
  const dateText = departureDate 
    ? (() => {
        try {
          return departureDate!.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
        } catch (e) {
          console.error('[PublicRideCard] ❌ toLocaleString failed:', e);
          // Fallback to simpler format
          try {
            return departureDate!.toISOString().split('T')[0] + ' ' + departureDate!.toISOString().split('T')[1].substring(0, 5);
          } catch (_) {
            return '⚠ Invalid Date';
          }
        }
      })()
    : '⚠ Invalid Date';

  return (
    <div className={clsx('w-full min-w-0 rounded-xl bg-card border border-border shadow-sm text-foreground flex flex-col overflow-hidden h-full')}>
      <div className="p-4 md:p-5 space-y-3 relative">
        <div className="absolute top-4 right-4">
          <span className="bg-primary/95 text-primary-foreground px-3 py-1 rounded-full font-semibold text-xs">PKR {ride.price}</span>
        </div>

        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">Pickup Area</div>
          <div className="font-semibold">{ride.fromArea || 'Unknown'}</div>
        </div>

        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">Drop-off Area</div>
          <div className="font-semibold">{ride.toArea || 'Unknown'}</div>
        </div>

        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">When</div>
          <div className="font-semibold">{dateText}</div>
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div>Seats: <span className="font-semibold text-foreground">{ride.seatsLeft}</span></div>
          <div>Transport: <span className="font-semibold text-foreground">{(ride.transportMode||'car').toUpperCase()}</span></div>
          <div>Gender: <span className="font-semibold text-foreground">{ride.genderAllowed === 'both' ? 'All' : ride.genderAllowed}</span></div>
          <div className="ml-auto text-xs bg-muted px-2 py-0.5 rounded">{ride.university?.toUpperCase()}</div>
        </div>

        {ride.stops && ride.stops.length > 0 && (
          <div className="mt-2 text-sm text-muted-foreground">
            <div className="text-xs">Major stops</div>
            <ul className="list-disc pl-5 text-sm text-foreground mt-1">
              {ride.stops.map((s: string, i: number) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <button onClick={onViewRoute} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-sm">View Route</button>
          <button onClick={onBook} className="rounded-md py-2 md:py-3 text-sm font-semibold flex items-center justify-center gap-2 bg-primary text-primary-foreground">Book Ride</button>
        </div>

        <div className="mt-2 text-xs text-muted-foreground">Some details are visible after login</div>
      </div>
    </div>
  );
}
