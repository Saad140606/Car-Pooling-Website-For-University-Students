"use client";

import React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MapLeaflet from '@/components/MapLeaflet';
import ChatButton from '@/components/chat/ChatButton';
import { Booking as BookingType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function formatDate(ts: any) {
  try {
    return new Date(ts.seconds * 1000).toLocaleString();
  } catch (_) { return '' }
}

function BookingCard({ booking, university }: { booking: BookingType, university: string }) {
  const ride = booking.ride;
  const driver = booking.driverDetails || ride?.driverInfo || { fullName: 'Ride Provider' } as any;

  return (
    <Card className="p-4 rounded-md shadow-md">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm">{(driver.fullName || 'U').split(' ').map((s:any)=>s[0]).slice(0,2).join('')}</div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="font-semibold text-sm text-white truncate">{driver.fullName}</div>
              <div className="text-xs text-slate-300 mt-1 truncate">{ride ? `${ride.from} → ${ride.to}` : ''}</div>
            </div>
            <div className="ml-4">
              <div className="bg-amber-400 text-amber-900 px-3 py-1 rounded-full font-semibold">${ride?.price ?? booking.price ?? '0.00'}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-300">{formatDate(ride?.departureTime ?? booking.createdAt)}</div>
              <div className="text-sm text-white mt-1">Pickup: {booking.pickupPlaceName || (booking.pickupPoint ? `${(booking.pickupPoint as any).lat.toFixed(4)}, ${(booking.pickupPoint as any).lng.toFixed(4)}` : 'Not set')}</div>
            </div>
            <div className="h-24 bg-surface rounded-md overflow-hidden">
              {ride?.route && ride.route.length ? (
                <MapLeaflet route={ride.route as any} markers={booking.pickupPoint ? [booking.pickupPoint as any] : []} style={{ height: '100%', width: '100%' }} />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">No route</div>
              )}
            </div>
          </div>

        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">View Route</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Route from {ride?.from} to {ride?.to}</DialogTitle>
              </DialogHeader>
              <div className="h-[60vh] w-full">
                {ride?.route && ride.route.length ? (
                  <MapLeaflet route={ride.route as any} markers={booking.pickupPoint ? [booking.pickupPoint as any] : []} style={{ height: '100%', width: '100%' }} />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400">No route available</div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          {booking.chatId ? <ChatButton chatId={booking.chatId} university={university} label="Chat" /> : null}
        </div>
        <div className="text-sm text-slate-400">Status: <Badge className="ml-2">{booking.status}</Badge></div>
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

  const { data: bookings, loading } = useCollection<BookingType>(bookingsQuery, { listen: true, includeUserDetails: 'driverId' });

  const isLoading = userLoading || loading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold">No Bookings</h2>
        <p className="text-muted-foreground">You have not booked any rides yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-headline font-bold mb-6">My Bookings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bookings.map((b) => (
          <BookingCard key={b.id} booking={b} university={userData!.university} />
        ))}
      </div>
    </div>
  );
}

