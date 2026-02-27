'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Calendar, Users, Search, Clock, MapPin, Navigation } from 'lucide-react';
import { UserNameWithBadge } from './UserNameWithBadge';
import { parseTimestamp } from '@/lib/timestampUtils';

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
  onGoogleMaps?: () => void;
  onBook?: () => void;
  onCardClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  driverVerified?: boolean;
  statusLabel?: string;
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
  onGoogleMaps,
  onBook,
  onCardClick,
  disabled,
  disabledReason,
  className,
  driverVerified,
  statusLabel,
}: RideCardProps) {  const [isHovering, setIsHovering] = useState(false);
  const dateText = useMemo(() => {
    // Use centralized timestamp parser to safely convert any timestamp format
    try {
      const dt = parseTimestamp(rideDateTime, { silent: true });
      
      // If conversion fails, show placeholder
      if (!dt) {
        console.error('[RideCard] ❌ Failed to parse departure time:', rideDateTime, 'type:', typeof rideDateTime);
        return '⚠ Invalid Date';
      }
      
      // Format the date with fallback in case toLocaleString fails
      try {
        const formatted = dt.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
        return formatted;
      } catch (formatError) {
        console.error('[RideCard] ❌ toLocaleString failed:', formatError);
        // Fallback to ISO string
        return dt.toISOString().split('T')[0] + ' ' + dt.toISOString().split('T')[1].substring(0, 5);
      }
    } catch (e) {
      console.error('[RideCard] ❌ Unexpected error in dateText useMemo:', e);
      return '⚠ Error';
    }
  }, [rideDateTime]);

  const initials = driverName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      onClick={onCardClick}
      className={clsx(
        'w-full min-w-0 rounded-xl bg-[#1e2340] border border-white/10 shadow-lg text-white flex flex-col overflow-hidden h-full',
        'transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20',
        'hover:border-primary/40',
        onCardClick ? 'cursor-pointer active:scale-[0.98]' : '',
        className
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="p-3.5 sm:p-3 space-y-2.5 sm:space-y-2 relative">

        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          {university && !hideUniversity ? (
            <span className="bg-white/10 px-2 py-0.5 rounded text-xs font-semibold">
              {university.toUpperCase()}
            </span>
          ) : (
            <span />
          )}
          <span className="bg-[#3b4cca] px-2.5 py-1 rounded-full text-xs font-bold tracking-wide shadow-sm">
            PKR {price}
          </span>
        </div>

        {/* Provider */}
        <div className="space-y-1.5">
          <div className="text-xs text-white/50 font-medium">Provider</div>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center font-semibold text-xs flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <UserNameWithBadge 
                name={driverName} 
                verified={driverVerified}
                size="sm"
                truncate
              />
            </div>
          </div>
          {statusLabel ? (
            <div className="text-xs text-amber-300 font-medium mt-1">{statusLabel}</div>
          ) : null}
        </div>

        {/* Locations */}
        <div className="relative space-y-1.5 pl-1">
          <div className="absolute left-[5px] top-2 bottom-2 border-l-2 border-dashed border-white/15" />

          <div className="space-y-0.5">
            <div className="text-[11px] text-white/40 font-semibold tracking-wider uppercase">From</div>
            <div className="flex gap-2 min-w-0 items-start">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-[#1e2340] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm sm:text-xs leading-snug break-words">
                  {startLocation}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] text-white/40 font-semibold tracking-wider uppercase">To</div>
            <div className="flex gap-2 min-w-0 items-start">
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#1e2340] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm sm:text-xs leading-snug break-words">
                  {endLocation}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Map - clickable */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onViewRoute) onViewRoute();
          }}
          className="relative h-16 sm:h-14 rounded-lg overflow-hidden bg-[#0f172a] w-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 group"
        >
          <img
            src="/map.png"
            alt="route"
            className="w-full h-full object-cover"
          />

          <span className="absolute bottom-1.5 right-1.5 bg-black/80 backdrop-blur px-2 py-0.5 rounded-md text-xs flex items-center gap-1 pointer-events-none transition-all duration-300 group-hover:bg-primary/60">
            <Search className="w-3 h-3" />
            View
          </span>
        </button>

        {/* Meta: Date, Seats, Gender, Transport */}
        <div className="space-y-1.5 sm:space-y-1 text-sm sm:text-xs text-white/80 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-white/50 flex-shrink-0" />
            <span className="text-[13px] sm:text-xs">{dateText}</span>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-white/50 flex-shrink-0" />
            <span className="text-[13px] sm:text-xs">Seats: <span className="font-semibold text-white">{seatsLeft}</span></span>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-white/50 flex-shrink-0" />
            <span className="text-[13px] sm:text-xs">{genderPreference}</span>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-white/50 flex-shrink-0" />
            <span className="text-[13px] sm:text-xs">Transport: <span className="font-semibold text-white">{transport || 'Car'}</span></span>
          </div>
        </div>

        {/* Bottom Buttons */}
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onViewStops) onViewStops();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-all duration-200 active:scale-95 min-h-[40px] sm:min-h-0"
          >
            <Search className="w-3.5 h-3.5" />
            View Stops
          </button>

          {onGoogleMaps && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onGoogleMaps();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs font-medium transition-all duration-200 active:scale-95 min-h-[40px] sm:min-h-0 border border-blue-500/20"
            >
              <Navigation className="w-3.5 h-3.5" />
              Maps
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled && onBook) onBook();
            }}
            className={`rounded-lg py-2.5 sm:py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 min-h-[40px] sm:min-h-0 ${disabled ? 'bg-white/10 text-white/60 cursor-not-allowed' : 'bg-gradient-to-r from-[#3b4cca] to-primary hover:shadow-lg hover:shadow-primary/40 text-white'}`}
            style={{ minWidth: '7rem' }}
            title={disabled && disabledReason ? disabledReason : undefined}
          >
            <span className="bg-white text-[#3b4cca] w-4 h-4 rounded-full flex items-center justify-center text-[10px]">
              ✓
            </span>
            {disabled ? (disabledReason || 'N/A') : 'Book'}
          </button>
        </div>
      </div>
    </div>  
  );
}

        
