'use client';

import { collection, query, where, orderBy, doc, writeBatch, runTransaction } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Check, MapPin, X } from 'lucide-react';
import { useCollection as useBookingCollection } from '@/firebase/firestore/use-collection';
import L, { LatLngExpression } from 'leaflet';
import { Ride as RideType, Booking as BookingType } from '@/lib/types';
import { MapContainer, TileLayer, Marker, Polyline } from '@/components/map';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import React from 'react';

// Fix for default icon not showing in Leaflet
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png').default,
    iconUrl: require('leaflet/dist/images/marker-icon.png').default,
    shadowUrl: require('leaflet/dist/images/marker-shadow.png').default,
  });
}

function BookingRequests({ ride, university }: { ride: RideType, university: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const bookingsQuery = firestore ? query(
    collection(firestore, `universities/${university}/bookings`),
    where('rideId', '==', ride.id),
    where('status', '==', 'pending')
  ) : null;
  
  const { data: bookings, loading } = useBookingCollection<BookingType>(bookingsQuery, { includeUserDetails: 'passengerId' });

  const handleBooking = async (booking: BookingType, newStatus: 'accepted' | 'rejected') => {
    if (!firestore) return;

    try {
      await runTransaction(firestore, async (transaction) => {
        const bookingRef = doc(firestore, `universities/${university}/bookings`, booking.id);
        const rideRef = doc(firestore, `universities/${university}/rides`, booking.rideId);
        
        transaction.update(bookingRef, { status: newStatus });

        if (newStatus === 'accepted') {
          const rideDoc = await transaction.get(rideRef);
          if (!rideDoc.exists()) {
            throw "Ride does not exist!";
          }
          const currentRideData = rideDoc.data() as RideType;
          const newAvailableSeats = currentRideData.availableSeats - 1;
          
          transaction.update(rideRef, { 
              availableSeats: newAvailableSeats,
              ...(newAvailableSeats === 0 && { status: 'full' })
          });
        }
      });

      toast({
        title: `Booking ${newStatus}`,
        description: `The request has been ${newStatus}.`
      });

    } catch (error) {
      console.error(`Error ${newStatus} booking:`, error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Something went wrong. Please try again.'
      });
    }
  };

  if (loading) return <div className="space-y-2 mt-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>;
  if (!bookings || bookings.length === 0) return <p className="text-muted-foreground text-sm mt-4">No pending requests.</p>

  return (
    <div className="mt-4 space-y-3">
      <h4 className="font-semibold">Booking Requests</h4>
      {bookings.map((booking: any) => (
        <div key={booking.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
          <div>
            <p className="font-medium">{booking.passengerDetails?.fullName}</p>
            <p className="text-sm text-muted-foreground">{booking.passengerDetails?.email}</p>
             {booking.pickupPoint && (
              <p className="text-xs text-accent flex items-center mt-1">
                <MapPin className="h-3 w-3 mr-1"/> Pickup Requested
              </p>
             )}
          </div>
          <div className="flex gap-2">
            <Button size="icon" variant="outline" className="h-8 w-8 bg-green-500/10 text-green-500 hover:bg-green-500/20" onClick={() => handleBooking(booking, 'accepted')}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" className="h-8 w-8 bg-red-500/10 text-red-500 hover:bg-red-500/20" onClick={() => handleBooking(booking, 'rejected')}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MyRideCard({ ride, university } : { ride: RideType, university: string }) {
    const firestore = useFirestore();
    const acceptedBookingsQuery = firestore ? query(
        collection(firestore, `universities/${university}/bookings`),
        where('rideId', '==', ride.id),
        where('status', '==', 'accepted')
    ) : null;
    const { data: acceptedBookings } = useBookingCollection<BookingType>(acceptedBookingsQuery);

    const pickupPoints = acceptedBookings?.map(b => b.pickupPoint).filter(Boolean) as LatLngExpression[] || [];

    return (
        <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{ride.from} to {ride.to}</CardTitle>
                    <CardDescription>{new Date(ride.departureTime.seconds * 1000).toLocaleString()}</CardDescription>
                  </div>
                   <Badge variant={ride.status === 'active' ? 'default' : ride.status === 'full' ? 'destructive' : 'secondary'}>{ride.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <p><strong>Price:</strong> PKR {ride.price}</p>
                <p><strong>Seats:</strong> {ride.availableSeats} / {ride.totalSeats} available</p>
                <p><strong>Gender:</strong> {ride.genderAllowed}</p>
              </div>

              {ride.route && ride.route.length > 0 && (
                 <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <MapPin className="mr-2 h-4 w-4" /> View Route & Pickups
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                          <DialogTitle>Your Route & Passenger Pickups</DialogTitle>
                      </DialogHeader>
                      <div className="h-[60vh] w-full relative">
                        <MapContainer
                            bounds={L.latLngBounds(ride.route as LatLngExpression[])}
                            style={{ height: '100%', width: '100%' }}
                        >
                            <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            />
                            <Polyline positions={ride.route as LatLngExpression[]} color="#3F51B5" weight={5} />
                            {pickupPoints.map((pos, i) => <Marker key={i} position={pos} />)}
                        </MapContainer>
                      </div>
                    </DialogContent>
                 </Dialog>
              )}

              <BookingRequests ride={ride} university={university} />
            </CardContent>
        </Card>
    )
}


export default function MyRidesPage() {
  const { user, data: userData, loading: userLoading } = useUser();
  const firestore = useFirestore();

  const ridesQuery = (user && firestore && userData) ? query(
    collection(firestore, 'universities', userData.university, 'rides'),
    where('driverId', '==', user.uid),
    orderBy('createdAt', 'desc')
  ) : null;

  const { data: rides, loading: ridesLoading } = useCollection<RideType>(ridesQuery);
  const loading = userLoading || ridesLoading;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!rides || rides.length === 0) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold">No Rides Offered</h2>
        <p className="text-muted-foreground">You have not offered any rides yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-headline font-bold mb-6">My Offered Rides</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {rides.map((ride: RideType) => (
          <MyRideCard key={ride.id} ride={ride} university={userData!.university} />
        ))}
      </div>
    </div>
  );
}
