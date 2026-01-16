'use client';

import React, { useMemo } from 'react';
import clsx from 'clsx';
import { Calendar, Users, Search, Clock } from 'lucide-react';

type RideCardProps = {
  startLocation: string;
  endLocation: string;
  rideDateTime: Date | string;
  price: number | string;
  driverName: string;
  seatsLeft: number;
  genderPreference: string;
  dvr?: number;
  transport?: string;
  onViewRoute?: () => void;
  onBook?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
};

export default function RideCard({
  startLocation,
  endLocation,
  rideDateTime,
  price,
  driverName,
  seatsLeft,
  genderPreference,
  dvr = 0,
  transport,
  onViewRoute,
  onBook,
  disabled,
  disabledReason,
  className,
}: RideCardProps) {
  const dateText = useMemo(() => {
    const dt = typeof rideDateTime === 'string' ? new Date(rideDateTime) : rideDateTime;
    return dt.toLocaleString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [rideDateTime]);

  const initials = driverName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={clsx(
        'w-full min-w-0 rounded-xl bg-[#1e2340] border border-white/10 shadow-lg text-white flex flex-col overflow-hidden h-full',
        className
      )}
    >
      <div className="p-4 md:p-5 space-y-3 relative">

        {/* Price */}
        <div className="absolute top-4 right-4">
          <span className="bg-[#3b4cca] px-3 py-1 rounded-full text-xs font-semibold">
            PKR {price}
          </span>
        </div>

        {/* Provider (moved to top) */}
        <div className="space-y-2">
          <div className="text-sm text-white/60">Ride Provider</div>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#334155] flex items-center justify-center font-semibold text-xs flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{driverName}</p>
            </div>
          </div>
        </div>

        {/* Locations: Pickup then Drop-off */}
        <div className="relative space-y-2">
          <div className="absolute left-[6px] top-2 bottom-2 border-l border-dashed border-white/20" />

          <div className="flex gap-2 min-w-0">
            <span className="mt-1 h-3 w-3 rounded-full bg-green-500 ring-2 ring-[#1e2340] flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">
                {startLocation}
              </p>
              <p className="text-xs text-white/60">Karachi</p>
            </div>
          </div>

          <div className="flex gap-2 min-w-0">
            <span className="mt-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-[#1e2340] flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">
                {endLocation}
              </p>
              <p className="text-xs text-white/60">Karachi</p>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="relative h-24 md:h-28 rounded-lg overflow-hidden bg-[#0f172a]">
          <img
            src="/map.png"
            alt="route"
            className="w-full h-full object-cover"
          />

          <button
            onClick={onViewRoute}
            className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 px-2 py-1 rounded text-[11px] flex items-center gap-1"
          >
            <Search className="w-3 h-3" />
            View Route
          </button>
        </div>

        {/* Meta: Date, Seats, Gender, Transport */}
        <div className="space-y-1 text-sm text-white/80 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-4 h-4" />
            {dateText}
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-4 h-4" />
            Seats Left: <span className="font-semibold text-white">{seatsLeft}</span>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4" />
            <div>{genderPreference}</div>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <div className="text-xs text-white/60">Transport:</div>
            <div className="font-semibold text-white">{transport || 'Car'}</div>
          </div>
        </div>

        {/* Bottom Buttons */}
        <div className="flex items-center justify-between gap-3 mt-3">
          <button
            onClick={onViewRoute}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 text-sm"
          >
            <Search className="w-4 h-4" />
            View Route
          </button>

          <button
            onClick={(e) => { if (!disabled && onBook) onBook(); }}
            className={`rounded-md py-2 md:py-3 text-sm font-semibold flex items-center justify-center gap-2 ${disabled ? 'bg-white/10 text-white/60 cursor-not-allowed' : 'bg-[#3b4cca] hover:bg-[#2f3db8] text-white'}`}
            style={{ minWidth: '8rem' }}
            title={disabled && disabledReason ? disabledReason : undefined}
          >
            <span className="bg-white text-[#3b4cca] w-4 h-4 rounded-full flex items-center justify-center text-[10px]">
              ✓
            </span>
            {disabled ? (disabledReason || 'Unavailable') : 'Book Ride'}
          </button>
        </div>
      </div>
    </div>
  );
}

        
