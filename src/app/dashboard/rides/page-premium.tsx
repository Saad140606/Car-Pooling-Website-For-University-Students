'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { query, where, orderBy, collection, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Ride as RideType } from '@/lib/types';
import { PremiumSearchBar } from '@/components/PremiumSearchBar';
import { PriceSlider } from '@/components/PriceSlider';
import { PremiumEmptyState, PremiumCountdown } from '@/components/PremiumEmptyState';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/premium-select';
import { MapPin, Clock, Users, DollarSign, MessageSquare, Loader2, Filter, ChevronDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RideFilters {
  minPrice: number;
  maxPrice: number;
  minSeats: number;
  university?: string;
  sortBy: 'time' | 'price' | 'distance';
}

interface RideCardProps {
  ride: RideType;
  onBook: () => void;
  isBooked: boolean;
  isLoading: boolean;
}

function PremiumRideCard({ ride, onBook, isBooked, isLoading }: RideCardProps) {
  const departureTime = ride.departureTime?.seconds
    ? new Date(ride.departureTime.seconds * 1000)
    : ride.departureTime instanceof Date
    ? ride.departureTime
    : null;

  const seatStatus =
    ride.availableSeats! > 0
      ? ride.availableSeats === 1
        ? 'Ending Soon'
        : 'Available'
      : 'Full';

  const seatColor =
    seatStatus === 'Available' ? 'success' : seatStatus === 'Ending Soon' ? 'warning' : 'error';

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-300 ease-out cursor-pointer',
      'hover:shadow-xl hover:scale-105 hover:border-primary/50',
      'border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950',
      'before:absolute before:inset-0 before:rounded-lg before:bg-gradient-to-r before:from-primary/5 before:to-transparent before:-z-10'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between mb-2">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant={seatColor} size="sm">
                {seatStatus}
              </Badge>
              <Badge variant="default" size="sm">
                {ride.transportMode === 'bike' ? '🏍️ Bike' : '🚗 Car'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium truncate">
                {ride.from} <ArrowRight className="h-3 w-3 inline" /> {ride.to}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary mb-1">₨{ride.price}</div>
            <div className="text-xs text-slate-400">per seat</div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="h-4 w-4 text-amber-400" />
            {departureTime ? (
              <div>
                <div className="font-medium text-white">{departureTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="text-xs text-slate-400">{departureTime.toLocaleDateString()}</div>
              </div>
            ) : (
              <span>Time TBD</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Users className="h-4 w-4 text-blue-400" />
            <div>
              <div className="font-medium text-white">{ride.availableSeats} / {ride.totalSeats} seats</div>
              <div className="text-xs text-slate-400">Available</div>
            </div>
          </div>
          {ride.distanceKm && (
            <div className="flex items-center gap-2 text-slate-300 col-span-2">
              <ArrowRight className="h-4 w-4 text-green-400" />
              <div>
                <div className="font-medium text-white">{ride.distanceKm.toFixed(1)} km</div>
                <div className="text-xs text-slate-400">Distance</div>
              </div>
            </div>
          )}
        </div>

        {departureTime && (
          <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">Departure in:</div>
            <PremiumCountdown targetDate={departureTime} format="compact" />
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={onBook}
            disabled={isBooked || ride.availableSeats === 0 || isLoading}
            className="flex-1"
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Booking...
              </>
            ) : isBooked ? (
              'Already Requested'
            ) : ride.availableSeats === 0 ? (
              'No Seats'
            ) : (
              'Request Seat'
            )}
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FindARidePage() {
  const { user, data: userData, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [filters, setFilters] = useState<RideFilters>({
    minPrice: 0,
    maxPrice: 1000,
    minSeats: 1,
    university: userData?.university || undefined,
    sortBy: 'time',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRide, setExpandedRide] = useState<string | null>(null);
  const [bookingRide, setBookingRide] = useState<string | null>(null);

  const ridesQuery =
    user && firestore && userData
      ? query(
          collection(firestore, 'universities', userData.university, 'rides'),
          where('status', '==', 'active'),
          where('driverId', '!=', user.uid),
          orderBy('driverId'),
          orderBy('departureTime', 'desc')
        )
      : null;

  const { data: rides, loading } = useCollection<RideType>(ridesQuery, {
    listen: true,
  });

  const filteredRides = React.useMemo(() => {
    if (!rides) return [];

    let filtered = rides.filter(
      (ride) =>
        ride.price >= filters.minPrice &&
        ride.price <= filters.maxPrice &&
        ride.availableSeats! >= filters.minSeats &&
        (searchQuery === '' ||
          ride.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ride.to.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Sort rides
    switch (filters.sortBy) {
      case 'price':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'distance':
        filtered.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
        break;
      case 'time':
      default:
        filtered.sort(
          (a, b) =>
            new Date(b.departureTime || 0).getTime() - new Date(a.departureTime || 0).getTime()
        );
    }

    return filtered;
  }, [rides, filters, searchQuery]);

  const handleBook = useCallback(
    async (rideId: string) => {
      if (!user || !userData || !firestore) {
        toast({ variant: 'destructive', title: 'Sign in required', description: 'Please sign in to book a ride.' });
        return;
      }

      const ride = rides?.find((r) => r.id === rideId);
      if (!ride) return;

      if (ride.driverId === user.uid) {
        toast({ variant: 'destructive', title: "Can't book own ride", description: 'You cannot book your own ride.' });
        return;
      }

      if (ride.genderAllowed && ride.genderAllowed !== 'both' && userData.gender !== ride.genderAllowed) {
        toast({
          variant: 'destructive',
          title: 'Booking not allowed',
          description: `This ride is reserved for ${ride.genderAllowed} riders.`,
        });
        return;
      }

      setBookingRide(rideId);

      try {
        const bookingId = `${rideId}_${user.uid}`;
        const requestRef = doc(
          firestore,
          'universities',
          userData.university,
          'rides',
          rideId,
          'requests',
          bookingId
        );

        // Attempt transaction for seat availability
        await runTransaction(firestore, async (transaction) => {
          const rideRef = doc(firestore, 'universities', userData.university, 'rides', rideId);
          const rideSnap = await transaction.get(rideRef);

          if (!rideSnap.exists()) {
            throw new Error('Ride no longer exists');
          }

          const currentRide = rideSnap.data() as RideType;
          if (currentRide.availableSeats! <= 0) {
            throw new Error('No seats available');
          }

          const bookingSnap = await transaction.get(requestRef);
          if (bookingSnap.exists()) {
            throw new Error('You have already requested this ride');
          }

          // Create booking
          transaction.set(requestRef, {
            rideId,
            passengerId: user.uid,
            status: 'PENDING',
            createdAt: serverTimestamp(),
            pickupPoint: null,
            pickupPlaceName: null,
          });
        });

        toast({
          title: 'Request sent!',
          description: 'Your booking request has been sent to the driver.',
        });

        setBookingRide(null);
      } catch (err: any) {
        console.error('Booking error:', err);
        toast({
          variant: 'destructive',
          title: 'Booking failed',
          description: err?.message || 'Could not complete your request. Please try again.',
        });
        setBookingRide(null);
      }
    },
    [user, userData, firestore, rides, toast]
  );

  const isLoading = userLoading || loading;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 py-3 sm:py-4 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">Find Your Ride</h1>
          <div className="flex gap-3 items-center">
            <PremiumSearchBar
              placeholder="Search by location..."
              onSearch={setSearchQuery}
              onSelect={(suggestion) => setSearchQuery(suggestion.text)}
              suggestions={[]}
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'p-2.5 rounded-lg transition-all duration-200',
                showFilters
                  ? 'bg-primary text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              )}
            >
              <Filter className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-slate-900/50 backdrop-blur border-b border-slate-800 py-3 sm:py-4 md:py-6 px-4 sm:px-6 animate-in fade-in-0 slide-in-from-top-2 duration-300">
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <label className="text-sm font-semibold text-white mb-3 block">Price Range</label>
              <PriceSlider
                min={0}
                max={1000}
                defaultMin={filters.minPrice}
                defaultMax={filters.maxPrice}
                onChangeRange={(min, max) => setFilters({ ...filters, minPrice: min, maxPrice: max })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-semibold text-white mb-3 block">Minimum Seats</label>
                <select
                  value={filters.minSeats}
                  onChange={(e) => setFilters({ ...filters, minSeats: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} seat{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-white mb-3 block">Sort By</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    setFilters({ ...filters, sortBy: e.target.value as any })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="time">Nearest Departure</option>
                  <option value="price">Lowest Price</option>
                  <option value="distance">Shortest Distance</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-slate-900 rounded-lg h-96 animate-pulse border border-slate-800"
              />
            ))}
          </div>
        ) : filteredRides.length === 0 ? (
          <PremiumEmptyState
            title={searchQuery ? 'No rides found' : 'No available rides'}
            description={
              searchQuery
                ? 'Try adjusting your search or filters'
                : 'Check back later for more rides in your area'
            }
            variant="search"
            action={{
              label: 'Offer a Ride',
              onClick: () => router.push('/dashboard/create-ride'),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRides.map((ride, index) => (
              <div
                key={ride.id}
                className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <PremiumRideCard
                  ride={ride}
                  onBook={() => handleBook(ride.id)}
                  isBooked={bookingRide === ride.id}
                  isLoading={bookingRide === ride.id}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
