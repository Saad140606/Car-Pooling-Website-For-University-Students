"use client";

import React from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ChatButton from '@/components/chat/ChatButton';
import { MapPin } from 'lucide-react';

export default function MyBookingsPage() {
  const { user, data: userData } = useUser();
  const firestore = useFirestore();

  // Build query only when firestore, user and userData are available; otherwise pass null
  const bookingsQuery = (firestore && user && userData)
    ? query(
        collection(firestore, `universities/${userData.university}/bookings`),
        where('passengerId', '==', user.uid),
        where('status', '==', 'accepted')
      )
    : null;

  // Call hook unconditionally to keep hook order stable across renders
  const { data: bookings } = useCollection<any>(bookingsQuery);

  if (!firestore || !user) return <p className="text-sm text-muted-foreground">Sign in to view your bookings.</p>;
  if (!userData) return <p className="text-sm text-muted-foreground">Loading profile…</p>;
  if (!bookings || bookings.length === 0) return <p className="text-sm text-muted-foreground">You have no accepted bookings.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">My Accepted Rides</h2>
      {bookings.map((b: any) => (
        <Card key={b.id}>
          <CardHeader>
            <CardTitle className="truncate">{b.ride?.from || b.ride?.from} → {b.ride?.to || b.ride?.to}</CardTitle>
          </CardHeader>
          <CardContent>
            <p><strong>Provider:</strong> {b.driverDetails?.fullName || b.ride?.driverInfo?.fullName || 'N/A'}</p>
            <p><strong>Contact:</strong> {b.driverDetails?.contactNumber || b.ride?.driverInfo?.contactNumber || 'N/A'}</p>
            <p><strong>Price:</strong> {b.ride?.price ? `PKR ${b.ride.price}` : 'N/A'}</p>
            <p><strong>Departure:</strong> {b.ride?.departureTime ? new Date(b.ride.departureTime.seconds * 1000).toLocaleString() : 'N/A'}</p>
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Pickup: {b.pickupPlaceName || (b.pickupPoint && typeof b.pickupPoint.lat === 'number' && typeof b.pickupPoint.lng === 'number' ? `${b.pickupPoint.lat.toFixed(4)}, ${b.pickupPoint.lng.toFixed(4)}` : 'N/A')}</p>
          </CardContent>
          <CardFooter>
            <div className="flex justify-end w-full">
              {b.chatId ? <ChatButton chatId={b.chatId} university={userData.university} label="Chat" /> : <div className="text-sm text-muted-foreground">Chat unavailable</div>}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
