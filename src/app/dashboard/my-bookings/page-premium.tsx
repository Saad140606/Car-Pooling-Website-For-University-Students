'use client';

import React, { useState } from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/premium-dialog';
import { PremiumEmptyState, PremiumCountdown } from '@/components/PremiumEmptyState';
import { Booking as BookingType } from '@/lib/types';
import { MapPin, Clock, Users, MessageSquare, MapIcon, Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BookingCardProps {
  booking: BookingType;
  onChat: () => void;
  onCancel: () => void;
  onViewRoute: () => void;
}

function PremiumBookingCard({ booking, onChat, onCancel, onViewRoute }: BookingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const ride = booking.ride;
  const driver = booking.driverDetails || ride?.driverInfo || { fullName: 'Driver' };

  const departureTime = ride?.departureTime?.seconds
    ? new Date(ride.departureTime.seconds * 1000)
    : null;

  const statusColors: Record<string, string> = {
    pending: 'warning',
    accepted: 'success',
    rejected: 'error',
    completed: 'default',
    cancelled: 'error',
  };

  const statusColor = statusColors[booking.status?.toLowerCase() || 'pending'] || 'default';

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-300 ease-out',
      'hover:shadow-xl hover:border-primary/50',
      'border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950',
      'before:absolute before:inset-0 before:rounded-lg before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:-z-10'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-semibold text-sm">
                {(driver?.fullName || 'U')
                  .split(' ')
                  .map((s: string) => s[0])
                  .join('')}
              </div>
              <div>
                <h3 className="font-semibold text-white">{driver?.fullName || 'Driver'}</h3>
                <Badge variant={statusColor as 'default' | 'destructive' | 'outline' | 'secondary' | 'success' | 'warning' | 'info' | 'error'} size="sm">
                  {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1) || 'Pending'}
                </Badge>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="truncate">{ride?.from} → {ride?.to}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />
                {departureTime ? (
                  <span>
                    {departureTime.toLocaleDateString()} at {departureTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : (
                  <span>Time TBD</span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-primary mb-1">₨{ride?.price || booking.price}</div>
            <div className="text-xs text-slate-400">total cost</div>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 border-t border-slate-800">
          {departureTime && (
            <div>
              <div className="text-xs text-slate-400 mb-2">Time until departure:</div>
              <PremiumCountdown targetDate={departureTime} format="detailed" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-800/50 rounded p-3">
              <div className="text-slate-400 text-xs mb-1">Driver Info</div>
              <div className="text-white font-medium">{driver?.fullName}</div>
              {'contactNumber' in driver && driver?.contactNumber && (
                <a
                  href={`https://wa.me/${String(driver.contactNumber).replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 text-xs mt-1 hover:underline"
                >
                  {driver.contactNumber}
                </a>
              )}
            </div>
            <div className="bg-slate-800/50 rounded p-3">
              <div className="text-slate-400 text-xs mb-1">Pickup Point</div>
              <div className="text-white font-medium text-sm">
                {booking.pickupPlaceName || 'To be selected'}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex gap-2 flex-wrap">
            <Button onClick={onViewRoute} variant="outline" size="sm" className="flex-1">
              <MapIcon className="mr-2 h-4 w-4" />
              View Route
            </Button>
            {booking.status === 'accepted' && (
              <Button onClick={onChat} variant="outline" size="sm" className="flex-1">
                <MessageSquare className="mr-2 h-4 w-4" />
                Chat
              </Button>
            )}
            {booking.status === 'pending' && (
              <Button onClick={onCancel} variant="destructive" size="sm" className="flex-1">
                Cancel Request
              </Button>
            )}
          </div>
        </CardContent>
      )}

      <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-900/50">
        <span className="text-xs text-slate-400">
          {ride?.distanceKm ? `${ride.distanceKm.toFixed(1)} km` : 'Distance TBD'}
        </span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="transition-transform duration-200"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </Card>
  );
}

export default function MyBookingsPage() {
  const { user, data: userData, loading: userLoading } = useUser();
  const firestore = useFirestore();

  const bookingsQuery = (user && firestore && userData) ? query(
    collection(firestore, 'universities', userData.university, 'bookings'),
    where('passengerId', '==', user.uid),
    orderBy('createdAt', 'desc')
  ) : null;

  const { data: bookings, loading } = useCollection<BookingType>(bookingsQuery, {
    listen: true,
    includeUserDetails: 'driverId',
  });

  const isLoading = userLoading || loading;

  // Separate bookings by status
  const upcomingBookings = bookings?.filter((b) =>
    b.ride?.departureTime &&
    new Date(b.ride.departureTime).getTime() > Date.now() &&
    b.status === 'accepted'
  ) || [];

  const pendingBookings = bookings?.filter((b) => b.status === 'pending') || [];

  const pastBookings = bookings?.filter((b) =>
    b.ride?.departureTime &&
    new Date(b.ride.departureTime).getTime() <= Date.now()
  ) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 pb-20">
      {/* Header */}
      <div className="bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 py-4 sm:py-6 md:py-8 px-4 sm:px-6 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">My Bookings</h1>
          <p className="text-slate-400">Track and manage your ride bookings</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-8 space-y-8 md:space-y-12">
        {/* Upcoming Bookings */}
        {!isLoading && upcomingBookings.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-white">Upcoming Rides</h2>
              <Badge variant="success" size="sm">{upcomingBookings.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {upcomingBookings.map((booking, index) => (
                <div
                  key={booking.id}
                  className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <PremiumBookingCard
                    booking={booking}
                    onChat={() => {}}
                    onCancel={() => {}}
                    onViewRoute={() => {}}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Bookings */}
        {!isLoading && pendingBookings.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" />
              <h2 className="text-xl font-semibold text-white">Pending Requests</h2>
              <Badge variant="warning" size="sm">{pendingBookings.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingBookings.map((booking, index) => (
                <div
                  key={booking.id}
                  className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <PremiumBookingCard
                    booking={booking}
                    onChat={() => {}}
                    onCancel={() => {}}
                    onViewRoute={() => {}}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Past Bookings */}
        {!isLoading && pastBookings.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Past Rides</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pastBookings.map((booking, index) => (
                <div
                  key={booking.id}
                  className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 opacity-75"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <PremiumBookingCard
                    booking={booking}
                    onChat={() => {}}
                    onCancel={() => {}}
                    onViewRoute={() => {}}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && bookings?.length === 0 && (
          <PremiumEmptyState
            title="No bookings yet"
            description="Start exploring available rides to book your first ride"
            variant="bookings"
            action={{
              label: 'Find a Ride',
              onClick: () => (window.location.href = '/dashboard/rides'),
            }}
          />
        )}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-slate-900 rounded-lg h-80 animate-pulse border border-slate-800" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
