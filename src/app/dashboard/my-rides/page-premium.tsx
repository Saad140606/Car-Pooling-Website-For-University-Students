'use client';

import React, { useState } from 'react';
import { collection, query, where, orderBy, doc, writeBatch, runTransaction, serverTimestamp } from 'firebase/firestore';
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
import { PremiumCountdown } from '@/components/PremiumEmptyState';
import { useToast } from '@/hooks/use-toast';
import { Ride as RideType, Booking as BookingType } from '@/lib/types';
import {
  MapPin,
  Clock,
  Users,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Trash2,
  Eye,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function isValidFirestoreInstance(value: any): boolean {
  return Boolean(value && typeof value === 'object' && '_databaseId' in value);
}

interface OfferedRideCardProps {
  ride: RideType;
  requestCount: number;
  onViewRequests: () => void;
  onDelete: () => void;
}

function OfferedRideCard({ ride, requestCount, onViewRequests, onDelete }: OfferedRideCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const departureTime = ride.departureTime?.seconds
    ? new Date(ride.departureTime.seconds * 1000)
    : null;

  const now = new Date();
  const isPassedTime = departureTime && departureTime <= now;
  const bookedCount = ride.totalSeats! - (ride.availableSeats || 0);

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
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={isPassedTime ? 'destructive' : ride.availableSeats! > 0 ? 'success' : 'warning'} size="sm">
                {isPassedTime ? 'Inactive' : ride.availableSeats! > 0 ? 'Active' : 'Full'}
              </Badge>
              <Badge variant="default" size="sm">
                {bookedCount} Booked
              </Badge>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="truncate font-semibold text-white">
                  {ride.from} → {ride.to}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />
                {departureTime ? (
                  <span>
                    {departureTime.toLocaleDateString()} at{' '}
                    {departureTime.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                ) : (
                  <span>Time TBD</span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-primary mb-1">₨{ride.price}</div>
            <div className="text-xs text-slate-400">per seat</div>
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
              <div className="text-slate-400 text-xs mb-1">Seats</div>
              <div className="text-white font-semibold">
                {bookedCount} / {ride.totalSeats}
              </div>
              <div className="text-xs text-slate-400 mt-1">Occupied</div>
            </div>
            <div className="bg-slate-800/50 rounded p-3">
              <div className="text-slate-400 text-xs mb-1">Ride Distance</div>
              <div className="text-white font-semibold">
                {ride.distanceKm?.toFixed(1) || 'N/A'} km
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800">
            <div className="text-xs text-slate-400 mb-3">Ride Details</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Transport Mode:</span>
                <span className="text-white font-medium">
                  {ride.transportMode === 'bike' ? '🏍️ Bike' : '🚗 Car'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gender Allowed:</span>
                <span className="text-white font-medium capitalize">
                  {ride.genderAllowed}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex gap-2 flex-wrap">
            <Button
              onClick={onViewRequests}
              variant="default"
              size="sm"
              className="flex-1 relative"
            >
              <Eye className="mr-2 h-4 w-4" />
              View Requests
              {requestCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold">
                  {requestCount}
                </span>
              )}
            </Button>
            <Button onClick={onDelete} variant="destructive" size="sm" className="flex-1">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardContent>
      )}

      <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-400">
            {requestCount} Request{requestCount !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="transition-transform duration-200"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>
    </Card>
  );
}

export default function MyOfferedRidesPage() {
  const { user, data: userData } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const ridesQuery =
    user && isValidFirestoreInstance(firestore) && userData && userData.university
      ? query(
          collection(firestore, 'universities', userData.university, 'rides'),
          where('driverId', '==', user.uid),
          orderBy('departureTime', 'desc')
        )
      : null;

  const { data: rides, loading } = useCollection<RideType>(ridesQuery, {
    listen: true,
  });

  const [selectedRide, setSelectedRide] = useState<string | null>(null);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [rideRequests, setRideRequests] = useState<BookingType[]>([]);

  const handleViewRequests = async (rideId: string) => {
    if (!isValidFirestoreInstance(firestore) || !userData || !userData.university) return;

    setSelectedRide(rideId);
    setRequestsLoading(true);

    try {
      const requestsRef = collection(
        firestore,
        'universities',
        userData.university,
        'rides',
        rideId,
        'requests'
      );
      const requestsQuery = query(requestsRef, where('status', 'in', ['PENDING', 'pending']));
      // In a real implementation, use useCollection hook instead
      // For now, we're setting up the pattern
      setRideRequests([]);
    } catch (err) {
      console.error('Failed to load requests:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load requests' });
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleDeleteRide = async (rideId: string) => {
    if (!isValidFirestoreInstance(firestore) || !userData || !userData.university) return;

    if (!confirm('Are you sure you want to delete this ride?')) return;

    try {
      const rideRef = doc(firestore, 'universities', userData.university, 'rides', rideId);
      await firestore.updateDoc(rideRef, { status: 'cancelled', updatedAt: serverTimestamp() });
      toast({ title: 'Ride deleted', description: 'Your ride has been removed.' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Could not delete ride',
      });
    }
  };

  const activeRides = rides?.filter((r) => {
    const departureTime = r.departureTime?.seconds ? new Date(r.departureTime.seconds * 1000) : null;
    const now = new Date();
    // Active rides: status is 'active' AND departure time hasn't passed yet
    return r.status === 'active' && departureTime && departureTime > now;
  }) || [];
  
  const pastRides = rides?.filter((r) => {
    const departureTime = r.departureTime?.seconds ? new Date(r.departureTime.seconds * 1000) : null;
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    
    // Show in past section if:
    // 1. Status is not 'active', OR
    // 2. Departure time has passed but less than 12 hours ago
    if (r.status !== 'active') return true;
    if (!departureTime) return false;
    if (departureTime <= now && departureTime > twelveHoursAgo) return true;
    
    return false;
  }) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 pb-20">
      {/* Header */}
      <div className="bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 py-4 sm:py-6 md:py-8 px-4 sm:px-6 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">My Offered Rides</h1>
          <p className="text-slate-400">Manage your active rides and booking requests</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-8 space-y-8 md:space-y-12">
        {/* Active Rides */}
        {!loading && activeRides.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-white">Active Rides</h2>
              <Badge variant="success" size="sm">{activeRides.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeRides.map((ride, index) => (
                <div
                  key={ride.id}
                  className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <OfferedRideCard
                    ride={ride}
                    requestCount={0} // Would fetch actual request count
                    onViewRequests={() => handleViewRequests(ride.id)}
                    onDelete={() => handleDeleteRide(ride.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Past Rides */}
        {!loading && pastRides.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Past Rides</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pastRides.map((ride, index) => (
                <div
                  key={ride.id}
                  className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 opacity-75"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <OfferedRideCard
                    ride={ride}
                    requestCount={0}
                    onViewRequests={() => handleViewRequests(ride.id)}
                    onDelete={() => handleDeleteRide(ride.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && rides?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No rides offered yet</h3>
            <p className="text-slate-400 text-center max-w-xs mb-6">
              Start earning by offering your first ride
            </p>
            <Button onClick={() => (window.location.href = '/dashboard/create-ride')}>
              Create a Ride
            </Button>
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-slate-900 rounded-lg h-80 animate-pulse border border-slate-800" />
            ))}
          </div>
        )}
      </div>

      {/* Requests Dialog */}
      {selectedRide && (
        <Dialog open={!!selectedRide} onOpenChange={() => setSelectedRide(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Booking Requests</DialogTitle>
              <DialogDescription>
                {rideRequests.length} request{rideRequests.length !== 1 ? 's' : ''} waiting for your decision
              </DialogDescription>
            </DialogHeader>

            {requestsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-slate-800 h-24 rounded animate-pulse" />
                ))}
              </div>
            ) : rideRequests.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No pending requests for this ride</div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {rideRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-white">Passenger Name</div>
                      <div className="text-sm text-slate-400">Requested 2 hours ago</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="default">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Accept
                      </Button>
                      <Button size="sm" variant="destructive">
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
