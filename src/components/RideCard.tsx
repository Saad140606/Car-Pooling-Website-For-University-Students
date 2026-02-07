'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Calendar, Users, Search, Clock, MapPin } from 'lucide-react';
import { VerificationBadge } from './VerificationBadge';

// Helper: Convert any timestamp format to Date safely with detailed logging
function getDateFromTimestamp(ts: any): Date | null {
  if (!ts) {
    console.debug('[RideCard] Timestamp is null or undefined');
    return null;
  }
  
  // If already a Date, validate and return
  if (ts instanceof Date) {
    if (!isNaN(ts.getTime())) {
      console.debug('[RideCard] Parsed Date object:', ts.toISOString());
      return ts;
    }
    console.warn('[RideCard] Invalid Date object');
    return null;
  }
  
  // If number (milliseconds), convert to Date
  if (typeof ts === 'number') {
    if (isFinite(ts)) {
      const d = new Date(ts);
      console.debug('[RideCard] Parsed number timestamp:', d.toISOString());
      return d;
    }
    console.warn('[RideCard] Invalid number timestamp (not finite):', ts);
    return null;
  }
  
  // If Firestore Timestamp with .seconds and .nanoseconds
  if (ts && typeof ts === 'object') {
    if (typeof ts.seconds === 'number' && typeof ts.nanoseconds === 'number') {
      const ms = ts.seconds * 1000 + (ts.nanoseconds / 1_000_000);
      if (isFinite(ms)) {
        const d = new Date(ms);
        console.debug('[RideCard] Parsed Firestore Timestamp:', { seconds: ts.seconds, nanoseconds: ts.nanoseconds, isoString: d.toISOString() });
        return d;
      }
      console.warn('[RideCard] Invalid Firestore Timestamp (not finite):', { seconds: ts.seconds, nanoseconds: ts.nanoseconds, ms });
      return null;
    }
    // Check for toDate() method (Firebase SDK Timestamp)
    if (typeof ts.toDate === 'function') {
      try {
        const d = ts.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) {
          console.debug('[RideCard] Parsed Timestamp.toDate():', d.toISOString());
          return d;
        }
      } catch (e) {
        console.warn('[RideCard] toDate() failed:', e);
      }
    }
  }
  
  // Try parsing as ISO string or other string format
  if (typeof ts === 'string') {
    try {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        console.debug('[RideCard] Parsed string timestamp:', ts, '→', d.toISOString());
        return d;
      }
      console.warn('[RideCard] Parsed string but got invalid Date:', ts);
    } catch (e) {
      console.warn('[RideCard] Failed to parse string timestamp:', ts, e);
    }
  }
  
  console.warn('[RideCard] Could not parse timestamp of type', typeof ts, ':', ts);
  return null;
}

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
  onBook,
  disabled,
  disabledReason,
  className,
  driverVerified,
  statusLabel,
}: RideCardProps) {  const [isHovering, setIsHovering] = useState(false);
    const dateText = useMemo(() => {
    // Use helper to safely convert any timestamp format
    try {
      const dt = getDateFromTimestamp(rideDateTime);
      
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
        console.debug('[RideCard] ✓ Formatted date successfully:', formatted);
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
      className={clsx(
        'w-full min-w-0 rounded-xl bg-[#1e2340] border border-white/10 shadow-lg text-white flex flex-col overflow-hidden h-full',
        'animate-bounce-in transition-all duration-300 hover-card-lift hover:shadow-2xl hover:shadow-primary/20',
        'hover:border-primary/40',
        className
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="p-2 md:p-2.5 space-y-1.5 relative">

        {/* Price and University */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 transition-all duration-300" style={{
          transform: isHovering ? 'scale(1.05)' : 'scale(1)',
        }}>
          {university && !hideUniversity && <span className="bg-white/10 hover-lift-sm px-1.5 py-0.5 rounded text-[0.65rem] font-semibold transition-all">{university.toUpperCase()}</span>}
          <span className="bg-[#3b4cca] hover-glow px-2 py-0.5 rounded-full text-[0.7rem] font-semibold transition-all">
            PKR {price}
          </span>
        </div>

        {/* Provider */}
        <div className="space-y-1 animate-scale-up">
          <div className="text-xs text-white/60 transition-colors duration-300" style={{
            color: isHovering ? 'rgb(255 255 255 / 0.8)' : 'rgb(255 255 255 / 0.6)',
          }}>Provider</div>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center font-semibold text-[0.6rem] flex-shrink-0 hover-lift-sm transition-all">
              {initials}
            </div>
            <div className="min-w-0 flex items-center gap-1">
              <p className="font-semibold truncate text-xs">{driverName}</p>
              <VerificationBadge verified={driverVerified} showText={false} size="sm" />
            </div>
          </div>
          {statusLabel ? (
            <div className="text-[0.7rem] text-amber-300 font-medium mt-1">{statusLabel}</div>
          ) : null}
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
          className="relative h-14 md:h-16 rounded-lg overflow-hidden bg-[#0f172a] w-full cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 group"
        >
          <img
            src="/map.png"
            alt="route"
            className="w-full h-full object-cover"
          />

          <span className="absolute bottom-1 right-1 bg-black/80 backdrop-blur px-1.5 py-0.5 rounded text-[0.65rem] flex items-center gap-0.5 pointer-events-none transition-all duration-300 group-hover:bg-primary/60 group-hover:scale-110">
            <Search className="w-2.5 h-2.5 animate-float" />
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
        <div className="flex items-center justify-between gap-2 mt-1.5 animate-slide-and-fade">
          <div className="flex gap-1.5">
            <button
              onClick={onViewStops}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 hover:shadow-md text-xs transition-all duration-200 btn-press"
            >
              <Search className="w-3 h-3" />
              View Stops
            </button>
          </div>

          <button
            onClick={(e) => { if (!disabled && onBook) onBook(); }}
            className={`rounded-md py-1 text-xs font-semibold flex items-center justify-center gap-1 transition-all duration-200 btn-press ${disabled ? 'bg-white/10 text-white/60 cursor-not-allowed' : 'bg-gradient-to-r from-[#3b4cca] to-primary hover:shadow-lg hover:shadow-primary/40 text-white hover-glow'}`}
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

        
