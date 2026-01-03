'use client';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, orderBy, Timestamp, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Route } from 'lucide-react';
import { useCollection as useBookingsCollection } from '@/firebase/firestore/use-collection';
import L, { LatLng, LatLngExpression } from 'leaflet';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from '@/components/map';
import { Ride as RideType } from '@/lib/types';


// Fix for default icon not showing in Leaflet
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png').default,
    iconUrl: require('leaflet/dist/images/marker-icon.png').default,
    shadowUrl: require('leaflet/dist/images/marker-shadow.png').default,
  });
}

function RouteMapModal({ ride, onBook, children }: { ride: RideType, onBook: (pickupPoint: LatLng) => void, children: React.ReactNode }) {
  const [pickupPoint, setPickupPoint] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isPointNearRoute = (point: LatLng, route: LatLngExpression[], tolerance = 0.003) => {
    for (let i = 0; i < route.length - 1; i++) {
        const start = L.latLng(route[i] as LatLng);
        const end = L.latLng(route[i+1] as LatLng);
        const closestPoint = L.GeometryUtil.closest(L.CRS.EPSG3857, [start, end], point);
        if (closestPoint && point.distanceTo(closestPoint) < tolerance * 111320) { // approx meters
            return true;
        }
    }
    return false;
  };
  
  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (isPointNearRoute(e.latlng, ride.route as LatLngExpression[])) {
          setPickupPoint(e.latlng);
        } else {
          toast({ variant: 'destructive', title: 'Invalid Pickup Point', description: 'Please select a point on or very near the route.' });
        }
      },
    });
    return null;
  };

  const handleBookWithPickup = () => {
    if (!pickupPoint) {
      toast({ variant: 'destructive', title: 'No Pickup Point', description: 'Please select a pickup point on the route.' });
      return;
    }
    setLoading(true);
    onBook(pickupPoint);
    // Loading state will be handled by the parent
  };
  
  const startPos = ride.route[0] as LatLngExpression;
  const endPos = ride.route[ride.route.length - 1] as LatLngExpression;

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Route from {ride.from} to {ride.to}</DialogTitle>
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
            <Marker position={startPos}><CardDescription>Start</CardDescription></Marker>
            <Marker position={endPos}><CardDescription>End</CardDescription></Marker>
            <Polyline positions={ride.route as LatLngExpression[]} color="#3F51B5" weight={5} />
            {pickupPoint && <Marker position={pickupPoint} />}
            <MapEvents />
          </MapContainer>
        </div>
        <p className="text-sm text-center text-muted-foreground">Click on the route to select your desired pickup point.</p>
        <Button onClick={handleBookWithPickup} disabled={!pickupPoint || loading}>
            {loading ? <Loader2 className="animate-spin" /> : `Request Pickup at Selected Point`}
        </Button>
      </DialogContent>
    </Dialog>
  )
}


function RideCard({ ride, user, userData, firestore }: { ride: any, user: any, userData: any, firestore: any }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const bookingsQuery = firestore && user ? query(
    collection(firestore, `universities/${userData.university}/bookings`),
    where('rideId', '==', ride.id),
    where('passengerId', '==', user.uid)
  ) : null;
  const { data: bookings, loading: bookingsLoading } = useBookingsCollection(bookingsQuery);
  const existingBooking = bookings?.[0];

  const handleRequestSeat = async (pickupPoint: LatLng) => {
    if (!user || !firestore) return;
    setLoading(true);
    try {
      if (ride.driverId === user.uid) {
        toast({ variant: 'destructive', title: "Can't book own ride" });
        return;
      }

      await runTransaction(firestore, async (transaction) => {
        const rideRef = doc(firestore, `universities/${userData.university}/rides`, ride.id);
        const rideDoc = await transaction.get(rideRef);

        if (!rideDoc.exists()) {
          throw "Ride does not exist!";
        }

        const currentRideData = rideDoc.data();
        if (currentRideData.availableSeats <= 0) {
          throw "This ride is already full.";
        }
        
        const newBookingRef = doc(collection(firestore, `universities/${userData.university}/bookings`));
        transaction.set(newBookingRef, {
          rideId: ride.id,
          driverId: ride.driverId,
          passengerId: user.uid,
          status: 'pending',
          createdAt: serverTimestamp(),
          ride: currentRideData, // denormalize for easier access
          pickupPoint: { lat: pickupPoint.lat, lng: pickupPoint.lng },
        });
      });

      toast({
        title: 'Request Sent!',
        description: 'The driver has been notified of your request.',
      });
    } catch (error: any) {
      console.error('Error requesting seat:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.toString() || 'Could not request seat. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const getButtonState = () => {
    if (bookingsLoading || loading) return <Button disabled><Loader2 className="animate-spin" /></Button>;
    if (ride.driverId === user.uid) return <Button disabled>Your Ride</Button>;
    if (ride.availableSeats === 0) return <Button disabled variant="destructive">Full</Button>;
    if (existingBooking) {
      if (existingBooking.status === 'pending') return <Button disabled variant="secondary">Pending</Button>;
      if (existingBooking.status === 'accepted') return <Button disabled className="bg-green-600">Accepted</Button>;
      if (existingBooking.status === 'rejected') return <Button disabled variant="destructive">Rejected</Button>;
    }
    return (
      <RouteMapModal ride={ride} onBook={handleRequestSeat}>
        <Button>
          <Route className="mr-2 h-4 w-4" /> View Route & Book
        </Button>
      </RouteMapModal>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>{ride.from} to {ride.to}</CardTitle>
                <CardDescription>Driver: {ride.driverInfo.fullName}</CardDescription>
            </div>
            <Badge variant="secondary">PKR {ride.price}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p><strong>Time:</strong> {new Date(ride.departureTime.seconds * 1000).toLocaleString()}</p>
        <p><strong>Seats Left:</strong> {ride.availableSeats}</p>
        <p><strong>Gender:</strong> <span className="capitalize">{ride.genderAllowed}</span></p>
      </CardContent>
      <CardFooter className="flex justify-end">
        {getButtonState()}
      </CardFooter>
    </Card>
  );
}

export default function RidesPage() {
  const { user, data: userData, loading: userLoading } = useUser();
  const firestore = useFirestore();

  const genderFilter = userData?.gender === 'male' ? ['male', 'both'] : ['female', 'both'];

  const ridesQuery = (user && firestore && userData) ? query(
    collection(firestore, 'universities', userData.university, 'rides'),
    where('status', '==', 'active'),
    where('availableSeats', '>', 0),
    where('departureTime', '>', Timestamp.now()),
    where('genderAllowed', 'in', genderFilter),
    orderBy('departureTime', 'asc')
  ) : null;

  const { data: rides, loading: ridesLoading } = useCollection<RideType>(ridesQuery);
  
  const isLoading = userLoading || ridesLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-60 w-full" />)}
      </div>
    );
  }

  const availableRides = rides?.filter(ride => ride.driverId !== user?.uid);

  return (
    <div>
      <h1 className="text-3xl font-headline font-bold mb-6">Available Rides</h1>
      {availableRides && availableRides.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableRides.map((ride: any) => (
            <RideCard key={ride.id} ride={ride} user={user} userData={userData} firestore={firestore} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border-dashed border-2 rounded-lg">
          <h2 className="text-2xl font-semibold">No Rides Available</h2>
          <p className="text-muted-foreground mt-2">Check back later for new rides from your university!</p>
        </div>
      )}
    </div>
  );
}
