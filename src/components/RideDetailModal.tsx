'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserNameWithBadge } from '@/components/UserNameWithBadge';
import { parseTimestamp } from '@/lib/timestampUtils';
import { Calendar, Users, MapPin, Car } from 'lucide-react';

interface RideDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ride?: any;
  driverName?: string;
  driverVerified?: boolean;
  startLocation?: string;
  endLocation?: string;
  rideDateTime?: Date | string;
  price?: number | string;
  seatsLeft?: number;
  genderPreference?: string;
  transport?: string;
  university?: string;
  hideUniversity?: boolean;
  statusLabel?: string;
  onViewStops?: () => void;
  onBook?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

export default function RideDetailModal({
  open,
  onOpenChange,
  ride,
  driverName = 'Provider',
  driverVerified = false,
  startLocation = 'Unknown',
  endLocation = 'Unknown',
  rideDateTime,
  price = 0,
  seatsLeft = 0,
  genderPreference = 'Both',
  transport = 'Car',
  university = '',
  hideUniversity = false,
  statusLabel,
  onViewStops,
  onBook,
  disabled = false,
  disabledReason,
}: RideDetailModalProps) {
  const dateText = React.useMemo(() => {
    try {
      const dt = parseTimestamp(rideDateTime, { silent: true });
      if (!dt) return '⚠ Invalid Date';
      
      return dt.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return '⚠ Error parsing date';
    }
  }, [rideDateTime]);

  const initials = driverName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const start = startLocation || ride?.from || 'Unknown';
  const end = endLocation || ride?.to || 'Unknown';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-[95vw] bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700">
        <DialogHeader className="pb-2 border-b border-slate-700/50">
          <DialogTitle className="text-lg font-bold text-white">Ride Details</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
              <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Fare</div>
              <div className="text-lg font-bold text-white">PKR {price}</div>
              <p className="text-xs text-slate-400">per seat</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
              <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Seats Left</div>
              <div className="text-lg font-bold text-white">{seatsLeft}</div>
              <p className="text-xs text-slate-400">available</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 flex items-center justify-center font-bold text-sm flex-shrink-0 border border-primary/30">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <UserNameWithBadge
                  name={driverName}
                  verified={driverVerified}
                  size="md"
                  truncate={false}
                />
                {statusLabel && <p className="text-xs text-amber-300 font-medium mt-1">{statusLabel}</p>}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 mt-1.5" />
              <div className="min-w-0">
                <p className="text-[11px] text-slate-400 font-medium">FROM</p>
                <p className="text-sm text-white break-words">{start}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500 mt-1.5" />
              <div className="min-w-0">
                <p className="text-[11px] text-slate-400 font-medium">TO</p>
                <p className="text-sm text-white break-words">{end}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border border-slate-700 bg-slate-900/40 p-2 text-slate-200">
              <span className="text-slate-400 text-xs block">Departure</span>
              {dateText}
            </div>
            <div className="rounded-md border border-slate-700 bg-slate-900/40 p-2 text-slate-200">
              <span className="text-slate-400 text-xs block">Gender Preference</span>
              {genderPreference}
            </div>
            <div className="rounded-md border border-slate-700 bg-slate-900/40 p-2 text-slate-200">
              <span className="text-slate-400 text-xs block">Transport</span>
              {transport}
            </div>
            {university && !hideUniversity && (
              <div className="rounded-md border border-slate-700 bg-slate-900/40 p-2 text-slate-200">
                <span className="text-slate-400 text-xs block">University</span>
                {university.toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            {onViewStops && (
              <Button
                variant="outline"
                onClick={() => {
                  onViewStops();
                  onOpenChange(false);
                }}
                className="flex-1 hover:bg-slate-700"
              >
                View Stops
              </Button>
            )}
            {onBook && (
              <Button
                onClick={() => {
                  onBook();
                  onOpenChange(false);
                }}
                disabled={disabled}
                className="flex-1 bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/40"
                title={disabled && disabledReason ? disabledReason : undefined}
              >
                {disabled ? (disabledReason || 'Not Available') : 'Book Ride'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
