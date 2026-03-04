'use client';

import React from 'react';
import { collection, query, where, doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/contexts/NotificationContext';
import { useCollection as useBookingCollection } from '@/firebase/firestore/use-collection';
import { MapPin, Clock, Users, CheckCircle2, X, Trash, AlertCircle, Calendar, Navigation } from 'lucide-react';
import { Ride as RideType, Booking as BookingType } from '@/lib/types';
import { formatTimestamp } from '@/lib/timestampUtils';
import { UserNameWithBadge } from '@/components/UserNameWithBadge';
import { isUserVerified } from '@/lib/verificationUtils';
import { CancellationConfirmDialog } from '@/components/CancellationConfirmDialog';
import ChatButton from '@/components/chat/ChatButton';
import PassengerDetailModal from '@/components/PassengerDetailModal';
import { LatLngExpression } from 'leaflet';
import { openGoogleMapsRoute } from '@/lib/googleMapsRoute';

// Small helper: truncate string to n characters with ellipsis
function truncateChars(s?: string | null, n = 30) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '...' : s;
}

function formatPickupLabel(booking: { id?: string; pickupPlaceName?: string | null; pickupPoint?: { lat: number; lng: number } | null }, fetchedNames?: Record<string, string>) {
  // First check if we have a place name
  if (booking?.pickupPlaceName) return truncateChars(booking.pickupPlaceName, 45);
  
  // Then check if we fetched one
  if (booking?.id && fetchedNames?.[booking.id]) return truncateChars(fetchedNames[booking.id], 45);
  
  // Fall back to coordinates if available
  if (booking?.pickupPoint) {
    const { lat, lng } = booking.pickupPoint;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
  return 'Pickup not set';
}

// Calculate time remaining until departure
function getTimeRemaining(departureTime: any): string {
  try {
    if (!departureTime) return '';
    const depTime = departureTime?.seconds 
      ? new Date(departureTime.seconds * 1000)
      : new Date(departureTime);
    
    const now = new Date();
    const diff = depTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'Departed';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days}d ${hours % 24}h`;
    }
    
    return `in ${hours}h ${minutes}m`;
  } catch {
    return '';
  }
}

export default function MyRideCardPremium({ ride, university }: { ride: RideType, university: string }) {
  const firestore = useFirestore();
  const { user, data: userData } = useUser();
  const { getUnreadForRide } = useNotifications();
  const { toast } = useToast();

  // State for dialogs and actions
  const [showDetailDialog, setShowDetailDialog] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showCancelDialog, setShowCancelDialog] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [reviewingPassengerId, setReviewingPassengerId] = React.useState<string | null>(null);
  const [selectedPassenger, setSelectedPassenger] = React.useState<any | null>(null);
  const [showPassengerDetail, setShowPassengerDetail] = React.useState(false);

  // Fetch bookings
  const acceptedBookingsQuery = (firestore && ride?.id) ? query(
    collection(firestore, `universities/${university}/bookings`),
    where('rideId', '==', ride.id),
    where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED'])
  ) : null;
  const { data: acceptedBookings } = useBookingCollection<BookingType>(acceptedBookingsQuery, { includeUserDetails: 'passengerId' });

  const pendingRequestsQuery = (firestore && ride?.id) ? query(
    collection(firestore, `universities/${university}/rides/${ride.id}/requests`),
    where('status', 'in', ['PENDING', 'pending'])
  ) : null;
  const { data: pendingRequests } = useBookingCollection<BookingType>(pendingRequestsQuery, { includeUserDetails: 'passengerId' });

  const confirmedCount = acceptedBookings?.filter(b => b.status === 'CONFIRMED').length || 0;
  const pendingCount = acceptedBookings?.filter(b => b.status === 'accepted').length || 0;
  const requestCount = pendingRequests?.length || 0;
  const acceptedCount = acceptedBookings?.length || 0;

  const lifecycleStatus = (ride as any)?.lifecycleStatus;
  const needsCompletion = lifecycleStatus === 'IN_PROGRESS' || lifecycleStatus === 'COMPLETION_WINDOW';

  const timeRemaining = getTimeRemaining(ride.departureTime);

  // Delete ride handler
  const handleDeleteRide = async () => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore not initialized.' });
      return;
    }

    // Preflight check
    try {
      const rideRef = doc(firestore, `universities/${university}/rides`, ride.id);
      const rideSnap = await getDoc(rideRef);
      if (!rideSnap.exists()) {
        toast({ variant: 'destructive', title: 'Not found', description: 'Ride not found. It may have already been deleted.' });
        setDeleteOpen(false);
        return;
      }
      const rideDoc = rideSnap.data() as RideType & { driverId?: string; createdBy?: string };

      const ownerId = rideDoc.driverId || rideDoc.createdBy;
      if (!user || ownerId !== user.uid) {
        toast({ variant: 'destructive', title: 'Not allowed', description: `You are not the driver of this ride and cannot delete it.` });
        setDeleteOpen(false);
        return;
      }

      if (userData && userData.university && userData.university !== university) {
        toast({ variant: 'destructive', title: 'Permission mismatch', description: 'Your account university does not match this ride.' });
        setDeleteOpen(false);
        return;
      }

      if (acceptedCount > 0) {
        toast({ variant: 'destructive', title: 'Cannot delete', description: 'This ride has accepted bookings and cannot be deleted.' });
        return;
      }
    } catch (err: any) {
      console.error('Preflight ride fetch failed', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to verify ride ownership. Please try again.' });
      setDeleteOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/rides/delete', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          university,
          rideId: ride.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          toast({ variant: 'destructive', title: 'Permission Denied', description: data.message || 'You do not have permission to delete this ride.' });
        } else if (response.status === 400) {
          toast({ variant: 'destructive', title: 'Cannot Delete', description: data.message || 'This ride cannot be deleted. It may have accepted bookings.' });
        } else if (response.status === 404) {
          toast({ variant: 'destructive', title: 'Not Found', description: 'Ride not found. It may have already been deleted.' });
        } else {
          toast({ variant: 'destructive', title: 'Delete Failed', description: data.message || 'An error occurred while deleting the ride.' });
        }
        setDeleteOpen(false);
        return;
      }

      toast({ title: 'Deleted', description: 'Ride has been deleted successfully.' });
      setDeleteOpen(false);
      setShowDetailDialog(false);
    } catch (err: any) {
      console.error('Delete ride failed', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message || 'An error occurred while deleting the ride.' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel ride handler
  const handleCancelRide = async () => {
    if (!user || user.uid !== ride.driverId) {
      toast({ variant: 'destructive', title: 'Not allowed', description: 'Only the driver can cancel this ride.' });
      return;
    }

    setIsCancelling(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/rides/cancel', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          university,
          rideId: ride.id,
          reason: 'Driver cancelled ride',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          toast({ 
            variant: 'destructive', 
            title: 'Account Locked', 
            description: data.message || 'Your account has been temporarily locked due to high cancellation rates.' 
          });
        } else {
          toast({ 
            variant: 'destructive', 
            title: 'Cancellation Failed', 
            description: data.message || 'Failed to cancel ride' 
          });
        }
        return;
      }

      toast({ title: 'Ride Cancelled', description: 'All passengers have been notified.' });
      setShowCancelDialog(false);
      setShowDetailDialog(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to cancel ride.' });
    } finally {
      setIsCancelling(false);
    }
  };

  // Review passenger (arrived/no-show)
  const handleDriverReview = async (passengerId: string, review: string) => {
    if (!user || user.uid !== ride.driverId) {
      toast({ variant: 'destructive', title: 'Not allowed', description: 'Only the driver can review passengers.' });
      return;
    }

    setReviewingPassengerId(passengerId);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/ride-lifecycle/transition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          university,
          rideId: ride.id,
          action: 'driver_review',
          passengerId,
          review,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast({ variant: 'destructive', title: 'Review Failed', description: data.error || 'Failed to review passenger.' });
        return;
      }

      toast({ title: 'Review Saved', description: `Marked passenger as ${review}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to review passenger.' });
    } finally {
      setReviewingPassengerId(null);
    }
  };

  // Complete ride
  const handleMarkRideComplete = async () => {
    if (!user || user.uid !== ride.driverId) {
      toast({ variant: 'destructive', title: 'Not allowed', description: 'Only the driver can complete this ride.' });
      return;
    }

    setIsCompleting(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/ride-lifecycle/transition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          university,
          rideId: ride.id,
          action: 'complete',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast({ variant: 'destructive', title: 'Completion Failed', description: data.error || 'Failed to complete ride.' });
        return;
      }

      toast({ title: 'Ride Completed', description: 'Ratings are now open for this ride.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to complete ride.' });
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <>
      {/* COMPACT CARD - CLICKABLE */}
      <Card 
        className="group relative overflow-hidden bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 backdrop-blur-md border-slate-700/50 hover:border-primary/50 transition-all duration-300 cursor-pointer hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1"
        onClick={() => setShowDetailDialog(true)}
      >
        {/* Hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <CardHeader className="relative z-10 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              {/* From */}
              <div className="flex items-start gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400 font-medium">From</p>
                  <p className="text-sm font-semibold text-white truncate">{ride.from}</p>
                </div>
              </div>
              
              {/* To */}
              <div className="flex items-start gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400 font-medium">To</p>
                  <p className="text-sm font-semibold text-white truncate">{ride.to}</p>
                </div>
              </div>
            </div>
            
            {/* Price & Status */}
            <div className="text-right flex-shrink-0">
              <Badge 
                variant={ride.status === 'active' ? 'default' : ride.status === 'full' ? 'destructive' : 'secondary'} 
                className="text-xs mb-1.5"
              >
                {ride.status}
              </Badge>
              <div className="text-lg font-bold text-primary">PKR {ride.price}</div>
              <div className="text-xs text-slate-400">per seat</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 pt-0 space-y-2">
          {/* DateTime & Time Remaining */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {formatTimestamp(ride.departureTime, { format: 'short', fallback: 'Time TBD' })}
            </div>
            {timeRemaining && (
              <div className="flex items-center gap-1.5 text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                {timeRemaining}
              </div>
            )}
          </div>

          {/* Seats & Passengers */}
          <div className="flex items-center justify-between pt-2 border-slate-700/50">
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              {ride.availableSeats || 0} seats available
            </div>
            <div className="flex items-center gap-2">
              {confirmedCount > 0 && (
                <Badge className="bg-green-500/20 text-green-300 text-xs py-0 px-2 border border-green-500/30">
                  {confirmedCount} confirmed
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge className="bg-amber-500/20 text-amber-300 text-xs py-0 px-2 border border-amber-500/30">
                  {pendingCount} pending
                </Badge>
              )}
              {requestCount > 0 && (
                <Badge className="bg-blue-500/20 text-blue-300 text-xs py-0 px-2 border border-blue-500/30">
                  {requestCount} requests
                </Badge>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center pt-1">Click to view details</p>
        </CardContent>
      </Card>

      {/* DETAIL DIALOG - OPENS ON CARD CLICK */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Ride Details</DialogTitle>
            <DialogDescription>
              Manage your ride and view passenger information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Ride Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Route Information
              </h3>
              
              <div className="space-y-3 pl-7">
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">From</p>
                  <p className="text-sm font-semibold text-white">{ride.from}</p>
                </div>
                
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">To</p>
                  <p className="text-sm font-semibold text-white">{ride.to}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1">Departure</p>
                    <p className="text-sm text-white">{formatTimestamp(ride.departureTime, { format: 'long', fallback: 'Not set' })}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1">Time Remaining</p>
                    <p className="text-sm text-amber-400">{timeRemaining || 'Departed'}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1">Price per Seat</p>
                    <p className="text-sm font-bold text-primary">PKR {ride.price}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-1">Available Seats</p>
                    <p className="text-sm text-white">{ride.availableSeats || 0}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">Status</p>
                  <Badge 
                    variant={ride.status === 'active' ? 'default' : ride.status === 'full' ? 'destructive' : 'secondary'}
                  >
                    {ride.status}
                  </Badge>
                </div>

                <Button
                  variant="outline"
                  className="w-full border-blue-500/30 text-blue-300 hover:bg-blue-500/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    const opened = openGoogleMapsRoute({
                      route: ride.route,
                      stops: ride.stops,
                      fromName: ride.from,
                      toName: ride.to,
                      travelMode: ride.transportMode === 'bike' ? 'bicycling' : 'driving',
                    });
                    if (!opened) {
                      toast({ variant: 'destructive', title: 'Route unavailable', description: 'No route data available for this ride.' });
                    }
                  }}
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  View Route on Google Maps
                </Button>
              </div>
            </div>

            {/* Booking Requests (Pending) */}
            {pendingRequests && pendingRequests.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-400" />
                  New Requests ({requestCount})
                </h3>
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div 
                      key={req.id}
                      className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <UserNameWithBadge 
                            name={req.passengerDetails?.fullName || 'Unknown'} 
                            verified={isUserVerified(req.passengerDetails)}
                            size="sm"
                          />
                          <p className="text-xs text-slate-400 mt-1">
                            {formatPickupLabel(req as any)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-8 text-xs">Review</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmed Passengers */}
            {acceptedBookings && acceptedBookings.filter(b => b.status === 'CONFIRMED').length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  Confirmed Passengers ({confirmedCount})
                </h3>
                <div className="space-y-2">
                  {acceptedBookings.filter(b => b.status === 'CONFIRMED').map((b) => (
                    <div 
                      key={b.id}
                      onClick={() => {
                        setSelectedPassenger(b);
                        setShowPassengerDetail(true);
                      }}
                      className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <UserNameWithBadge 
                            name={b.passengerDetails?.fullName || 'Unknown'} 
                            verified={isUserVerified(b.passengerDetails)}
                            size="sm"
                            truncate
                          />
                          <div className="flex items-center gap-2 mt-1">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            <p className="text-xs text-slate-400 truncate">
                              {formatPickupLabel(b as any)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <ChatButton chatId={(b as any).chatId || b.id} university={university} label="Chat" className="text-xs" otherUserName={b.passengerDetails?.fullName || 'Unknown'} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Confirmation */}
            {acceptedBookings && acceptedBookings.filter(b => b.status === 'accepted').length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-400" />
                  Pending Confirmation ({pendingCount})
                </h3>
                <div className="space-y-2">
                  {acceptedBookings.filter(b => b.status === 'accepted').map((b) => (
                    <div 
                      key={b.id}
                      onClick={() => {
                        setSelectedPassenger(b);
                        setShowPassengerDetail(true);
                      }}
                      className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <UserNameWithBadge 
                            name={b.passengerDetails?.fullName || 'Unknown'} 
                            verified={isUserVerified(b.passengerDetails)}
                            size="sm"
                            truncate
                          />
                          <p className="text-xs text-slate-400 mt-1 truncate">
                            {formatPickupLabel(b as any)}
                          </p>
                        </div>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <ChatButton chatId={(b as any).chatId || b.id} university={university} label="Chat" className="text-xs" otherUserName={b.passengerDetails?.fullName || 'Unknown'} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completion Required */}
            {needsCompletion && confirmedCount > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  Completion Required
                </h3>
                <div className="space-y-2">
                  {acceptedBookings?.filter(b => b.status === 'CONFIRMED').map((b) => (
                    <div key={`completion-${b.id}`} className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-950/20">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <UserNameWithBadge 
                            name={b.passengerDetails?.fullName || 'Unknown'} 
                            verified={isUserVerified(b.passengerDetails)}
                            size="sm"
                            truncate
                          />
                          <p className="text-xs text-slate-400 mt-1">
                            {b.driverReview ? `Review: ${b.driverReview}` : 'Awaiting review'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs"
                            disabled={!!b.driverReview || reviewingPassengerId === b.passengerId}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDriverReview(b.passengerId, 'arrived');
                            }}
                          >
                            Arrived
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={!!b.driverReview || reviewingPassengerId === b.passengerId}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDriverReview(b.passengerId, 'no-show');
                            }}
                          >
                            No-show
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={handleMarkRideComplete}
                    className="w-full bg-emerald-600 hover:bg-emerald-500"
                    disabled={isCompleting}
                  >
                    {isCompleting ? 'Completing...' : 'Mark Ride Complete'}
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-slate-700/50">
              {ride.status !== 'cancelled' && (
                <>
                  <Button 
                    variant="outline" 
                    className="flex-1 border-red-700/50 hover:bg-red-900/20 hover:text-red-400"
                    onClick={() => setShowCancelDialog(true)}
                    disabled={!user || user.uid !== ride.driverId || isCancelling}
                  >
                    <X className="h-4 w-4 mr-2" /> Cancel Ride
                  </Button>
                  <CancellationConfirmDialog
                    open={showCancelDialog}
                    onOpenChange={setShowCancelDialog}
                    cancellationRate={Number((userData as any)?.driverCancellationPolicy?.cancellationRate ?? 0)}
                    minutesUntilDeparture={(() => {
                      try {
                        if (!ride.departureTime) return 0;
                        const depTime = ride.departureTime?.seconds 
                          ? new Date(ride.departureTime.seconds * 1000)
                          : new Date(ride.departureTime);
                        return Math.max(0, Math.floor((depTime.getTime() - Date.now()) / (60 * 1000)));
                      } catch {
                        return 0;
                      }
                    })()}
                    onConfirm={handleCancelRide}
                    isLoading={isCancelling}
                    cancellerRole="driver"
                  />
                </>
              )}
              
              {acceptedCount === 0 && (
                <>
                  <Button 
                    variant="destructive" 
                    className="flex-1"
                    onClick={() => setDeleteOpen(true)}
                    disabled={!user || user.uid !== ride.driverId}
                  >
                    <Trash className="h-4 w-4 mr-2" /> Delete Ride
                  </Button>
                  <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Ride</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to permanently delete this ride? This will also remove any pending bookings.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="ghost">Cancel</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={handleDeleteRide} disabled={isDeleting}>
                          {isDeleting ? 'Deleting...' : 'Delete Ride'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Passenger Detail Modal */}
      {selectedPassenger && (
        <PassengerDetailModal
          open={showPassengerDetail}
          onOpenChange={setShowPassengerDetail}
          booking={selectedPassenger}
          passengerName={selectedPassenger.passengerDetails?.fullName || selectedPassenger.passengerDetails?.displayName || 'Unknown'}
          passengerVerified={isUserVerified(selectedPassenger.passengerDetails)}
          pickupLocation={formatPickupLabel(selectedPassenger as any)}
          dropoffLocation={selectedPassenger.dropoffPlaceName || selectedPassenger.ride?.to || 'Unknown'}
          rideDateTime={selectedPassenger.ride?.departureTime ?? ride.departureTime}
          price={selectedPassenger.price ?? selectedPassenger.ride?.price ?? ride.price}
          phoneNumber={(selectedPassenger.passengerDetails as any)?.contactNumber || (selectedPassenger.passengerDetails as any)?.phone}
          university={university}
          rideId={ride.id}
          bookingId={selectedPassenger.id}
          onCancelSuccess={() => {
            setShowPassengerDetail(false);
            setSelectedPassenger(null);
          }}
        />
      )}
    </>
  );
}
