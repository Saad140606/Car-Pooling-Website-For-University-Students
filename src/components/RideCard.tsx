'use client';

import React, { useMemo } from 'react';
import clsx from 'clsx';
import { Calendar, Users, Search, Clock, MapPin } from 'lucide-react';
import { VerificationBadge } from './VerificationBadge';

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
  university?: string;
  hideUniversity?: boolean;
  stops?: any[];
  onViewRoute?: () => void;
  onViewStops?: () => void;
  onBook?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  driverVerified?: boolean;
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
  university,
  hideUniversity = false,
  stops,
  onViewRoute,
  onViewStops,
  onBook,
  disabled,
  disabledReason,
  className,
  driverVerified,
}: RideCardProps) {
  const dateText = useMemo(() => {
    const dt = typeof rideDateTime === 'string' ? new Date(rideDateTime) : rideDateTime;
    return dt.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
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
      <div className="p-2 md:p-2.5 space-y-1.5 relative">

        {/* Price and University */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {university && !hideUniversity && <span className="bg-white/10 px-1.5 py-0.5 rounded text-[0.65rem] font-semibold">{university.toUpperCase()}</span>}
          <span className="bg-[#3b4cca] px-2 py-0.5 rounded-full text-[0.7rem] font-semibold">
            PKR {price}
          </span>
        </div>

        {/* Provider */}
        <div className="space-y-1">
          <div className="text-xs text-white/60">Provider</div>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-[#334155] flex items-center justify-center font-semibold text-[0.6rem] flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex items-center gap-1">
              <p className="font-semibold truncate text-xs">{driverName}</p>
              <VerificationBadge verified={driverVerified} showText={false} size="sm" />
            </div>
          </div>
        </div>

        {/* Locations */}
        <div className="relative space-y-0.5">
          <div className="absolute left-[5px] top-1 bottom-1 border-l border-dashed border-white/20" />

          <div className="space-y-0.5">
            <div className="text-[0.7rem] text-white/50 font-medium">FROM</div>
            <div className="flex gap-1.5 min-w-0 items-start">
              <span className="mt-0.5 h-2 w-2 rounded-full bg-green-500 ring-1 ring-[#1e2340] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-xs truncate">
                  {startLocation}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[0.7rem] text-white/50 font-medium">TO</div>
            <div className="flex gap-1.5 min-w-0 items-start">
              <span className="mt-0.5 h-2 w-2 rounded-full bg-red-500 ring-1 ring-[#1e2340] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-xs truncate">
                  {endLocation}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Map - clickable */}
        <button
          onClick={onViewRoute}
          className="relative h-14 md:h-16 rounded-lg overflow-hidden bg-[#0f172a] w-full cursor-pointer hover:opacity-90 transition"
        >
          <img
            src="/map.png"
            alt="route"
            className="w-full h-full object-cover"
          />

          <span className="absolute bottom-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-[0.65rem] flex items-center gap-0.5 pointer-events-none">
            <Search className="w-2.5 h-2.5" />
            View
          </span>
        </button>

        {/* Meta: Date, Seats, Gender, Transport */}
        <div className="space-y-0.5 text-xs text-white/80 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="w-3 h-3" />
            <span className="text-[0.7rem]">{dateText}</span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <Clock className="w-3 h-3" />
            <span className="text-[0.7rem]">Seats: <span className="font-semibold text-white">{seatsLeft}</span></span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <Users className="w-3 h-3" />
            <span className="text-[0.7rem]">{genderPreference}</span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[0.65rem] text-white/60">Transport:</span>
            <span className="font-semibold text-white text-[0.7rem]">{transport || 'Car'}</span>
          </div>
        </div>

        {/* Bottom Buttons */}
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <div className="flex gap-1.5">
            <button
              onClick={onViewStops}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 text-xs"
            >
              <Search className="w-3 h-3" />
              View Stops
            </button>
          </div>

          <button
            onClick={(e) => { if (!disabled && onBook) onBook(); }}
            className={`rounded-md py-1 text-xs font-semibold flex items-center justify-center gap-1 ${disabled ? 'bg-white/10 text-white/60 cursor-not-allowed' : 'bg-[#3b4cca] hover:bg-[#2f3db8] text-white'}`}
            style={{ minWidth: '6rem' }}
            title={disabled && disabledReason ? disabledReason : undefined}
          >
            <span className="bg-white text-[#3b4cca] w-3 h-3 rounded-full flex items-center justify-center text-[8px]">
              ✓
            </span>
            {disabled ? (disabledReason || 'N/A') : 'Book'}
          </button>
        </div>
      </div>
    </div>  
  );
}

        
