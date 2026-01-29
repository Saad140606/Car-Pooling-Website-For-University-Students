"use client";

import React from 'react';
import { collection, query, where, orderBy, doc, updateDoc, serverTimestamp, getDoc, arrayUnion, getDocs } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MapLeaflet from '@/components/MapLeaflet';
import ChatButton from '@/components/chat/ChatButton';
import NotificationBadge from '@/components/NotificationBadge';
import { Booking as BookingType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Clock, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/contexts/NotificationContext';

function formatDate(ts: any) {
  try {
    return new Date(ts.seconds * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_) { return '' }
}

function BookingCard({ booking, university }: { booking: BookingType, university: string }) {
  const ride = booking.ride;
  const driver = booking.driverDetails || ride?.driverInfo || { fullName: 'Ride Provider' } as any;
  const [confirming, setConfirming] = React.useState(false);
  const [rideStatus, setRideStatus] = React.useState<'available' | 'full' | 'expired'>('available');
  const [departureTimer, setDepartureTimer] = React.useState<string>('');
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { getUnreadForRide } = useNotifications();

  // Check ride status (available, full, or expired)
  const checkRideStatus = React.useCallback(async () => {
    if (!firestore || !ride) return;

    try {
      // Check if departure time has passed
      const departureTime = new Date(ride.departureTime.seconds * 1000);
      if (departureTime <= new Date()) {
        setRideStatus('expired');
        return;
      }

      // Check seat availability
      const rideRef = doc(firestore, 'universities', university, 'rides', ride.id);
      const rideSnap = await getDoc(rideRef);
      
      if (rideSnap.exists()) {
        const rideData = rideSnap.data();
        const confirmedBookings = rideData.confirmedPassengers?.length || 0;
        const seatsAvailable = (rideData.seats || 4) - confirmedBookings;

        setRideStatus(seatsAvailable > 0 ? 'available' : 'full');
      }
    } catch (err) {
      console.error('Failed to check ride status:', err);
    }
  }, [firestore, ride, university]);

  // Check status on mount and set up polling
  React.useEffect(() => {
    checkRideStatus();
    const interval = setInterval(checkRideStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [checkRideStatus]);

  const handleConfirmRide = async () => {
    if (!firestore || !user || !booking.ride) return;
    
    try {
      setConfirming(true);

      // Re-check seat availability right before confirming
      const rideRef = doc(firestore, 'universities', university, 'rides', booking.ride.id);
      const rideSnap = await getDoc(rideRef);
      
      if (!rideSnap.exists()) {
        toast({ variant: 'destructive', title: 'Error', description: 'Ride not found' });
        return;
      }

      const rideData = rideSnap.data();
      const confirmedBookings = rideData.confirmedPassengers?.length || 0;
      const seatsAvailable = (rideData.seats || 4) - confirmedBookings;

      // Check departure time
      const departureTime = new Date(booking.ride.departureTime.seconds * 1000);
      if (departureTime <= new Date()) {
        toast({ variant: 'destructive', title: 'Ride Expired', description: 'The departure time for this ride has passed.' });
        setRideStatus('expired');
        return;
      }

      // Check seat availability
      if (seatsAvailable <= 0) {
        toast({ variant: 'destructive', title: 'Seats Full', description: 'Seats are already full for this ride.' });
        setRideStatus('full');
        return;
      }

      // Use transaction for atomic seat reduction
      const { runTransaction } = await import('firebase/firestore');
      await runTransaction(firestore, async (transaction) => {
        const currentRideSnap = await transaction.get(rideRef);
        if (!currentRideSnap.exists()) throw new Error('Ride not found');
        
        const currentRideData = currentRideSnap.data();
        const currentSeats = currentRideData.availableSeats ?? 0;
        const confirmedCount = currentRideData.confirmedPassengers?.length || 0;
        const actualAvailable = currentSeats - confirmedCount;

        // Re-check seats in transaction
        if (actualAvailable <= 0) {
          throw new Error('SEATS_FULL');
        }

        // Confirm the booking
        const bookingRef = doc(firestore, 'universities', university, 'bookings', booking.id);
        transaction.update(bookingRef, {
          status: 'CONFIRMED',
          confirmedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Add to confirmedPassengers and reduce available seats
        transaction.update(rideRef, {
          confirmedPassengers: arrayUnion(user.uid),
          availableSeats: currentSeats - 1,
          updatedAt: serverTimestamp(),
          ...(currentSeats - 1 === 0 && { status: 'full' })
        });

        // If seats are now full, auto-decline all remaining pending/accepted requests
        if (currentSeats - 1 === 0) {
          const requestsRef = collection(firestore, `universities/${university}/rides/${booking.ride.id}/requests`);
          const pendingQuery = query(requestsRef, where('status', 'in', ['PENDING', 'pending']));
          const pendingSnap = await getDocs(pendingQuery);
          
          pendingSnap.forEach((reqDoc) => {
            if (reqDoc.id !== booking.id) {
              transaction.update(reqDoc.ref, { 
                status: 'rejected',
                rejectionReason: 'Seats are full',
                updatedAt: serverTimestamp()
              });
            }
          });

          // Also update accepted bookings that haven't been confirmed yet
          const acceptedQuery = query(
            collection(firestore, `universities/${university}/bookings`),
            where('rideId', '==', booking.ride.id),
            where('status', '==', 'accepted')
          );
          const acceptedSnap = await getDocs(acceptedQuery);
          
          acceptedSnap.forEach((bookingDoc) => {
            if (bookingDoc.id !== booking.id) {
              transaction.update(bookingDoc.ref, { 
                status: 'declined',
                declineReason: 'Seats are full',
                updatedAt: serverTimestamp()
              });
            }
          });
        }
      });

      toast({ title: 'Ride Confirmed', description: 'You have confirmed the ride. Driver can now pick you up.' });
      checkRideStatus();
    } catch (err: any) {
      console.error('Failed to confirm ride:', err);
      if (err.message === 'SEATS_FULL') {
        toast({ variant: 'destructive', title: 'Seats Full', description: 'Seats are already full for this ride.' });
        setRideStatus('full');
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to confirm ride' });
      }
    } finally {
      setConfirming(false);
    }
  };

  // Timer for departure countdown on confirmed rides
  React.useEffect(() => {
    if (booking.status !== 'CONFIRMED' || !ride?.departureTime) return;

    const updateTimer = () => {
      const now = new Date();
      const departure = new Date(ride.departureTime.seconds * 1000);
      const diff = departure.getTime() - now.getTime();

      if (diff <= 0) {
        setDepartureTimer('Ride has started');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setDepartureTimer(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [booking.status, ride?.departureTime]);

  return (
    <Card className="overflow-hidden transition-all duration-300 ease-out hover:shadow-xl hover:shadow-primary/20 border border-slate-700 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold text-xs flex-shrink-0 shadow-lg relative">
              {(driver.fullName || 'U').split(' ').map((s:any)=>s[0]).slice(0,2).join('')}
              {ride?.id && getUnreadForRide(ride.id) > 0 && (
                <NotificationBadge count={getUnreadForRide(ride.id)} dot position="top-right" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-bold text-white truncate">{driver.fullName || 'Driver'}</CardTitle>
              <div className="flex items-center gap-1.5 mt-1">
                {booking.status === 'CONFIRMED' && (
                  <Badge className="gap-1 bg-green-600/80 text-white text-[10px] py-0 px-1.5">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Confirmed
                  </Badge>
                )}
                {booking.status === 'accepted' && (
                  <Badge className="gap-1 bg-blue-600/80 text-white text-[10px] py-0 px-1.5">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Pending Confirmation
                  </Badge>
                )}
                {booking.status === 'pending' && (
                  <Badge className="gap-1 bg-amber-600/80 text-white text-[10px] py-0 px-1.5">
                    <AlertCircle className="h-2.5 w-2.5" /> Awaiting
                  </Badge>
                )}
                {booking.status === 'declined' && (
                  <Badge className="gap-1 bg-red-600/80 text-white text-[10px] py-0 px-1.5">
                    <AlertCircle className="h-2.5 w-2.5" /> Seats Full
                  </Badge>
                )}
                {booking.status === 'rejected' && (
                  <Badge className="gap-1 bg-red-600/80 text-white text-[10px] py-0 px-1.5">
                    <AlertCircle className="h-2.5 w-2.5" /> Rejected
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-primary">PKR {ride?.price ?? booking.price ?? '0'}</div>
            <div className="text-[10px] text-slate-400">per seat</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-2.5 space-y-2">
        {/* Route - FROM/TO format with stacked layout */}
        <div className="space-y-2 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0"></div>
              <span className="text-slate-400 font-medium">From</span>
            </div>
            <div className="ml-4 text-slate-200">{ride?.from || 'Not set'}</div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500 flex-shrink-0"></div>
              <span className="text-slate-400 font-medium">To</span>
            </div>
            <div className="ml-4 text-slate-200 truncate">{ride?.to || 'Not set'}</div>
          </div>
        </div>

        {/* Pickup and Dropoff Points */}
        <div className="space-y-1.5 text-xs">
          {booking.pickupPlaceName && (
            <div>
              <span className="text-slate-400 font-medium">Pickup Point:</span>
              <div className="text-slate-300">{booking.pickupPlaceName}</div>
            </div>
          )}
          {booking.dropoffPlaceName && (
            <div>
              <span className="text-slate-400 font-medium">Dropoff Point:</span>
              <div className="text-slate-300 truncate">{booking.dropoffPlaceName}</div>
            </div>
          )}
        </div>

        {/* Time */}
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
          <div className="text-xs text-slate-300">
            {formatDate(ride?.departureTime ?? booking.createdAt)}
          </div>
        </div>

        {/* Timer for departure (confirmed rides) */}
        {booking.status === 'CONFIRMED' && departureTimer && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-700/30">
            <Clock className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
            <div className="text-xs">
              <span className="text-slate-300">Ride starts in: </span>
              <span className="font-bold text-green-400">{departureTimer}</span>
            </div>
          </div>
        )}

        {/* Ride Status */}
        {booking.status === 'accepted' && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-700/30">
            {rideStatus === 'available' && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                <div className="text-xs text-green-400 font-medium">Seats Available</div>
              </>
            )}
            {rideStatus === 'full' && (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                <div className="text-xs text-red-400 font-medium">Seats Full</div>
              </>
            )}
            {rideStatus === 'expired' && (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                <div className="text-xs text-slate-400 font-medium">Departure Time Passed</div>
              </>
            )}
          </div>
        )}

        {/* Confirmed status message */}
        {booking.status === 'CONFIRMED' && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-700/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
            <div className="text-xs text-green-400 font-medium">Ride confirmed - Check in when ready</div>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t border-slate-700/50 pt-3 flex gap-2">
        {booking.status === 'declined' && (
          <div className="flex-1 text-center py-2">
            <div className="text-sm text-red-400 font-medium">Seats are full</div>
            <div className="text-xs text-slate-400 mt-0.5">Another passenger confirmed first</div>
          </div>
        )}
        {booking.status === 'rejected' && (
          <div className="flex-1 text-center py-2">
            <div className="text-sm text-red-400 font-medium">Request rejected by driver</div>
          </div>
        )}
        {booking.status === 'accepted' && rideStatus !== 'expired' && booking.status !== 'declined' ? (
          <>
            <Button 
              onClick={handleConfirmRide} 
              disabled={confirming || rideStatus === 'full'} 
              className="flex-1 gap-1.5 h-9 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="h-4 w-4" />
              {confirming ? 'Confirming...' : rideStatus === 'full' ? 'Seats Full' : 'Confirm Ride'}
            </Button>
            {((booking as any).chatId || booking.id) ? (
              <ChatButton chatId={(booking as any).chatId || booking.id} university={university} label="Chat" />
            ) : null}
          </>
        ) : rideStatus === 'expired' ? (
          <Button 
            disabled 
            className="flex-1 gap-1.5 h-9 bg-slate-700 hover:bg-slate-700 text-slate-400 cursor-not-allowed"
          >
            <AlertCircle className="h-4 w-4" />
            Ride Expired
          </Button>
        ) : (
          <>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5 border-slate-600 hover:bg-slate-800/50 h-9">
                  <MapPin className="h-4 w-4" />
                  View Route
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Route from {ride?.from} to {ride?.to}</DialogTitle>
                </DialogHeader>
                <div className="h-[60vh] w-full rounded-lg overflow-hidden border border-slate-700">
                  {ride?.route && ride.route.length ? (
                    <MapLeaflet 
                      route={ride.route as any} 
                      markers={booking.pickupPoint ? [{ lat: booking.pickupPoint.lat || booking.pickupPoint[0], lng: booking.pickupPoint.lng || booking.pickupPoint[1], label: 'Pickup' }] : []} 
                      style={{ height: '100%', width: '100%' }} 
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400">No route available</div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            {booking.status === 'CONFIRMED' && ((booking as any).chatId || booking.id) ? (
              <ChatButton chatId={(booking as any).chatId || booking.id} university={university} label="Chat" />
            ) : null}
          </>
        )}
      </CardFooter>
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
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
          <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="section-shell py-8 relative z-10">
          <div className="grid grid-cols-1 gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
          <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="section-shell py-8 relative z-10">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-50">No Bookings</h2>
            <p className="text-slate-300">You have not booked any rides yet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground relative">
      {/* Floating background orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent" />
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl opacity-30 animate-float" />
        <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="section-shell py-8 relative z-10">
        <div className="mb-8 animate-page">
          <h1 className="text-3xl font-headline font-bold text-slate-50 mb-2">My Bookings</h1>
          <p className="text-slate-300">View and manage your ride bookings</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bookings.map((b) => (
            <BookingCard key={b.id} booking={b} university={userData!.university} />
          ))}
        </div>
      </div>
    </div>
  );
}

