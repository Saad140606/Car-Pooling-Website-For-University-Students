'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { LatLngExpression } from 'leaflet';
import { Calendar, Users, User, Search, PlayCircle, Clock, MapPin, Car } from 'lucide-react';

// Small helper: truncate string to n characters with ellipsis
function truncateChars(s?: string | null, n = 30) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '...' : s;
}

// --- Types ---
export type RideCardProps = {
  startLocation: string;
  endLocation: string;
  rideDateTime: Date | string;
  price: number | string;
  driverName: string;
  seatsLeft?: number;
  genderPreference?: string; // e.g. 'Both Men & Women'
  dvr?: number | string;
  routeCoordinates?: LatLngExpression[];
  className?: string;
  onBook?: () => void;
  onViewRoute?: () => void;
};

// --- Helper Component: Route Line Visualization ---
// Keeps your original logic but styled for the new card
function InlineRoutePreview({ route }: { route?: any[] }) {
  if (!route || route.length === 0) return <div className="h-full w-full bg-slate-200" />;

  const points = route.map((p: any) => 
    Array.isArray(p) ? { lat: Number(p[0]), lng: Number(p[1]) } : { lat: Number(p.lat), lng: Number(p.lng) }
  );
  
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  
  // Calculate bounds with padding
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const W = 380;
  const H = 100;
  // minimal horizontal padding to avoid clipping markers; remove large inset
  const padX = 2; 
  const padY = 6;
  
  // Prevent division by zero
  const lonSpan = (maxLng - minLng) || 0.0001;
  const latSpan = (maxLat - minLat) || 0.0001;

  const project = (pt: { lat: number; lng: number }) => {
    const x = padX + ((pt.lng - minLng) / lonSpan) * (W - padX * 2);
    // Latitude increases upwards, SVG Y increases downwards
    const y = padY + (1 - (pt.lat - minLat) / latSpan) * (H - padY * 2);
    return { x, y };
  };

  const pathD = points.map((p, i) => {
    const { x, y } = project(p);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  const start = project(points[0]);
  const end = project(points[points.length - 1]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
      {/* Route Path (no extra background) */}
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" className="opacity-40" />
      <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

      {/* Start Marker (Green) */}
      <circle cx={Math.max(2, start.x)} cy={start.y} r={5} fill="#10B981" stroke="#fff" strokeWidth={1.5} />
      {/* End Marker (Green small) */}
      <circle cx={Math.min(W - 2, end.x)} cy={end.y} r={5} fill="#10B981" stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}

// --- Main Component ---
export default function RideCard({
  startLocation,
  endLocation,
  rideDateTime,
  price,
  driverName,
  seatsLeft = 0,
  genderPreference = 'Both Men & Women',
  dvr = 0,
  routeCoordinates = [],
  className,
  onBook,
  onViewRoute,
}: RideCardProps) {

  // Format Date pieces
  const { weekday, shortWeekday, dateShort, dateText } = useMemo(() => {
    const dt = typeof rideDateTime === 'string' ? new Date(rideDateTime) : (rideDateTime as Date);
    return {
      weekday: dt.toLocaleDateString('en-US', { weekday: 'long' }),
      shortWeekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
      dateShort: dt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      dateText: dt.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
    };
  }, [rideDateTime]);

  // Ride provider initials for compact badge
  const driverInitials = useMemo(() => {
    if (!driverName) return '';
    return driverName.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  }, [driverName]);

  return (
    <div 
      className={clsx(
            'group relative flex flex-col md:flex-row w-full max-w-full min-w-0 overflow-hidden rounded-lg bg-[#1c2237] text-white text-[0.78rem] shadow-sm transition-all border border-slate-700/30 md:max-w-[720px] lg:max-w-[900px]',
            className
          )}
    >
      {/* (moved initials into right panel to avoid overlap/overflow) */}

      {/* --- Left Section: Route & Map --- */}
      <div className="flex-1 min-w-0 p-1 md:p-2 flex flex-col gap-1 relative">
        {/* Price badge moved into header for prominence */}
        <div className="absolute top-2 right-2 z-30">
          <div className="bg-primary/95 text-primary-foreground px-3 py-1 rounded-full font-bold text-sm shadow-sm border border-primary/20">PKR {price}</div>
        </div>
        
        {/* Route Headers */}
        <div className="relative flex flex-col gap-1">
          {/* Connecting Line */}
          <div className="absolute left-[5px] top-2 bottom-2 w-0.5 border-l border-dashed border-slate-500/50" />

          {/* Start */}
          <div className="flex items-center gap-2 relative z-10 min-w-0">
            <div className="h-3 w-3 rounded-full bg-green-500 ring-2 ring-[#1c2237] flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-white leading-tight truncate" title={startLocation}>{truncateChars(startLocation, 60)}</span>
              <span className="text-xs text-slate-400">Karachi</span>
            </div>
          </div>

          {/* End */}
          <div className="flex items-center gap-2 relative z-10 min-w-0">
            <div className="h-3 w-3 rounded-full bg-red-500 ring-2 ring-[#1c2237] flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-white leading-tight truncate" title={endLocation}>{truncateChars(endLocation, 60)}</span>
              <span className="text-xs text-slate-400">Karachi</span>
            </div>
          </div>
        </div>

        {/* Map Area: use public/map.png as a background to match design */}
        <div className="relative w-full h-[1.6rem] md:h-[2rem] rounded-md overflow-hidden group/map">
          <img src="/map.png" alt="map preview" className="w-full h-full object-cover" />

          {/* Decorative start/end markers positioned left/right */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <div className="h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
          </div>
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
          </div>

          {/* Map Overlay Button (Bottom Right inside map) */}
          <button 
            onClick={onViewRoute}
            className="absolute bottom-1 right-1 z-20 bg-[#111827]/70 hover:bg-[#111219] text-[0.64rem] font-medium text-white px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors shadow-sm whitespace-nowrap backdrop-blur"
          >
            <Search className="w-3 h-3" />
            View
          </button>
        </div>

        {/* Footer Meta Data: compact single-line date/time, seats left, and gender */}
        <div className="mt-1 grid grid-cols-1 md:grid-cols-3 gap-1 text-[0.62rem] text-slate-300">
          <div className="flex items-start gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
            <div className="min-w-0">
              <div className="text-white truncate text-[0.72rem]">{dateText}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-slate-400" />
            <div className="text-[0.62rem] text-slate-400">Seats: <span className="text-white font-medium ml-1">{seatsLeft}</span></div>
          </div>

          <div className="flex items-center gap-2">
            <Users className="w-3 h-3 text-slate-400" />
            <div className="text-[0.62rem] text-slate-400">{genderPreference === 'Both Men & Women' ? 'Both Men & Women' : (String(genderPreference).includes('Men') ? 'Only Men' : String(genderPreference).includes('Women') ? 'Only Women' : genderPreference)}</div>
          </div>
        </div>
        
        {/* Desktop View Route button below details (matches design) */}
        <div className="mt-1 hidden md:flex">
          <button onClick={onViewRoute} className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#111827]/20 text-slate-200 border border-white/5 hover:bg-[#111827]/30">
            <Search className="w-4 h-4" />
            View Route
          </button>
        </div>
      </div>

      {/* --- Divider --- */}
      <div className="hidden md:block w-px bg-gradient-to-b from-transparent via-slate-600/30 to-transparent my-1" />

      {/* --- Right Section: Ride Provider & Actions (compact) --- */}
      <div className="w-full md:w-40 lg:md:w-48 min-w-0 overflow-hidden bg-[#1c2237] p-2 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-700/50 relative h-auto"> 

        {/* Ride Provider Info */}
        <div className="flex flex-col gap-1 mb-3 min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-[#334155] flex items-center justify-center text-white font-semibold text-[0.64rem] flex-shrink-0">{driverInitials}</div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white truncate max-w-[10rem]" title={driverName}>{truncateChars(driverName, 30)}</h3>
                <div className="text-[0.64rem] text-slate-400">DVR: {dvr}</div>
              </div>
            </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-auto">
            {/* Primary Book button (always visible) */}
            <button 
              onClick={onBook}
              className="flex w-full py-1 rounded-md bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold text-[0.78rem] shadow-sm transition-all items-center justify-center gap-2 px-2"
            >
               <div className="w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center">
                 <span className="text-[#4f46e5] text-[9px]">✓</span>
               </div>
               Book
            </button>
        </div>

      </div>
    </div>
  );
}