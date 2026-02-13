'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserNameWithBadge } from '@/components/UserNameWithBadge';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from '@/components/map';
import { parseTimestamp } from '@/lib/timestampUtils';
import L, { LatLngExpression } from 'leaflet';
import { Calendar, Clock, Users, MapPin, Car, ArrowRight, X } from 'lucide-react';

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

  const hasRoute = ride?.route && Array.isArray(ride.route) && ride.route.length > 0;
  const start = startLocation || ride?.from || 'Unknown';
  const end = endLocation || ride?.to || 'Unknown';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700">
        {/* Header with close button */}
        <DialogHeader className="sticky top-0 bg-gradient-to-b from-slate-900 to-slate-900/95 z-10 pb-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between w-full gap-4">
            <DialogTitle className="text-xl font-bold text-white">Ride Details</DialogTitle>
            <DialogClose className="opacity-70 hover:opacity-100 transition-opacity">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
        </DialogHeader>

        {/* Main Content */}
        <div className="space-y-6 px-1">
          {/* Provider Section */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h3 className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">Provider</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 flex items-center justify-center font-bold text-sm flex-shrink-0 border border-primary/30">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <UserNameWithBadge
                    name={driverName}
                    verified={driverVerified}
                    size="lg"
                    truncate={false}
                  />
                </div>
                {statusLabel && (
                  <p className="text-sm text-amber-300 font-medium mt-1">{statusLabel}</p>
                )}
              </div>
            </div>
          </div>

          {/* Route Section */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h3 className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">Route</h3>
            <div className="space-y-3">
              {/* From Location */}
              <div>
                <div className="flex items-start gap-3 mb-1">
                  <div className="h-3 w-3 rounded-full bg-green-500 flex-shrink-0 mt-1" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 font-medium">FROM</p>
                    <p className="text-sm text-white break-words">{start}</p>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center py-2">
                <ArrowRight className="h-4 w-4 text-slate-500 rotate-90" />
              </div>

              {/* To Location */}
              <div>
                <div className="flex items-start gap-3">
                  <div className="h-3 w-3 rounded-full bg-red-500 flex-shrink-0 mt-1" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 font-medium">TO</p>
                    <p className="text-sm text-white break-words">{end}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Map Section */}
          {hasRoute && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
              <h3 className="text-xs text-slate-400 font-semibold uppercase tracking-wider p-4 pb-2">Route Map</h3>
              <div className="h-64 w-full">
                <MapContainer
                  bounds={L.latLngBounds(ride.route as LatLngExpression[])}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                  <Polyline
                    positions={ride.route as LatLngExpression[]}
                    color="#60A5FA"
                    weight={4}
                    opacity={0.9}
                  />
                  {ride.route.length > 0 && (
                    <>
                      <Marker
                        position={ride.route[0] as any}
                        icon={L.icon({
                          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                          iconSize: [25, 41],
                          iconAnchor: [12, 41],
                          popupAnchor: [1, -34],
                          shadowSize: [41, 41],
                        })}
                      >
                        <Tooltip>Start: {start}</Tooltip>
                      </Marker>
                      <Marker
                        position={ride.route[ride.route.length - 1] as any}
                        icon={L.icon({
                          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                          iconSize: [25, 41],
                          iconAnchor: [12, 41],
                          popupAnchor: [1, -34],
                          shadowSize: [41, 41],
                        })}
                      >
                        <Tooltip>End: {end}</Tooltip>
                      </Marker>
                    </>
                  )}
                </MapContainer>
              </div>
            </div>
          )}

          {/* Ride Details */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h3 className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-4">Ride Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Departure */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-400 font-medium">Departure</span>
                </div>
                <p className="text-sm text-white ml-6">{dateText}</p>
              </div>

              {/* Price */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-400 font-medium">Price</span>
                </div>
                <Badge className="bg-primary text-primary-foreground ml-0">
                  PKR {price}
                </Badge>
              </div>

              {/* Seats Available */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-400 font-medium">Available Seats</span>
                </div>
                <p className="text-sm text-white ml-6">
                  <span className="font-semibold">{seatsLeft}</span>
                  {seatsLeft === 1 ? ' seat' : ' seats'}
                </p>
              </div>

              {/* Gender Preference */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-400 font-medium">Gender Preference</span>
                </div>
                <Badge variant="outline" className="border-slate-600 text-slate-200">
                  {genderPreference}
                </Badge>
              </div>

              {/* Transport */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Car className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-400 font-medium">Transport</span>
                </div>
                <p className="text-sm text-white ml-6">{transport}</p>
              </div>

              {/* University */}
              {university && !hideUniversity && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span className="text-xs text-slate-400 font-medium">University</span>
                  </div>
                  <Badge variant="outline" className="border-slate-600 text-slate-200">
                    {university.toUpperCase()}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 sticky bottom-0 bg-gradient-to-t from-slate-950 to-slate-950/80 pt-4 -mx-6 px-6 pb-4">
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
