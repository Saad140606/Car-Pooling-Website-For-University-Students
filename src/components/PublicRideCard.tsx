import React from 'react';
import { Calendar, Users, Search, Clock } from 'lucide-react';
import clsx from 'clsx';

export default function PublicRideCard({ ride, onViewRoute, onBook }: { ride: any; onViewRoute?: () => void; onBook?: () => void }) {
  const dateText = new Date(ride.departureTime).toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

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
