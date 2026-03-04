// src/lib/analyticsService.ts
// Comprehensive analytics service that computes real metrics from Firestore data

import {
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  Timestamp,
  DocumentData,
  Firestore,
} from 'firebase/firestore';
import {
  UserRole,
  CommonMetrics,
  DriverMetrics,
  PassengerMetrics,
  CombinedAnalytics,
  AnalyticsInsight,
  RideHistoryEntry,
  TimeSeriesDataPoint,
  RideActivityDataPoint,
  RouteFrequency,
  InsightType,
} from './analyticsTypes';
import { haversine } from './route';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (typeof ts === 'number') return new Date(ts);
  return null;
}

function getDayName(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

function getFullDayName(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculateDistance(route: any[] | undefined): number {
  if (!route || !Array.isArray(route) || route.length < 2) return 0;
  let meters = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = Array.isArray(route[i])
      ? { lat: Number(route[i][0]), lng: Number(route[i][1]) }
      : { lat: Number(route[i].lat), lng: Number(route[i].lng) };
    const b = Array.isArray(route[i + 1])
      ? { lat: Number(route[i + 1][0]), lng: Number(route[i + 1][1]) }
      : { lat: Number(route[i + 1].lat), lng: Number(route[i + 1].lng) };
    
    if (!isNaN(a.lat) && !isNaN(a.lng) && !isNaN(b.lat) && !isNaN(b.lng)) {
      meters += haversine(a as any, b as any);
    }
  }
  return meters / 1000; // Return km
}

function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * CRITICAL: Check if a ride is completed based on departure time
 * A ride is completed if its departureTime has passed (is in the past)
 */
function isRideCompleted(departureTime: any, status?: string, lifecycleStatus?: string): boolean {
  if (lifecycleStatus === 'COMPLETED') return true;
  if (lifecycleStatus === 'CANCELLED' || lifecycleStatus === 'FAILED') return false;
  if (status === 'completed') return true;
  if (status === 'cancelled' || status === 'expired') return false;
  if (!departureTime) return false;
  
  const date = toDate(departureTime);
  if (!date) return false;
  
  return date.getTime() < Date.now();
}

// ============================================================================
// DATA FETCHING
// ============================================================================

interface RawRideData {
  id: string;
  driverId: string;
  from: string;
  to: string;
  departureTime: any;
  status: string;
  price?: number;
  fare?: number;
  totalSeats?: number;
  availableSeats?: number;
  route?: any[];
  distanceKm?: number;
  createdAt?: any;
  completedAt?: any;
  driverInfo?: { fullName?: string };
  pickupPlaceName?: string;
  dropoffPlaceName?: string;
  cancellationReason?: string;
  rating?: number;
  driverRating?: number;
  passengerRating?: number;
  confirmedPassengers?: Array<{
    userId?: string;
    driverReview?: 'arrived' | 'no-show';
    passengerCompletion?: 'completed' | 'cancelled';
    completionReason?: string;
  }>;
}

interface RawBookingData {
  id: string;
  rideId: string;
  passengerId: string;
  driverId: string;
  status: string;
  price?: number;
  createdAt?: any;
  confirmedAt?: any;
  cancelledAt?: any;
  passengerCompletion?: 'completed' | 'cancelled';
  completionReason?: string;
  pickupPlaceName?: string;
  dropoffPlaceName?: string;
  cancellationReason?: string;
  driverDetails?: { fullName?: string };
  rating?: number;
  passengerRating?: number;
  driverRating?: number;
}

interface RawRequestData {
  id: string;
  rideId: string;
  passengerId: string;
  driverId: string;
  status: string;
  createdAt?: any;
  acceptedAt?: any;
  confirmedAt?: any;
  cancelledAt?: any;
  cancellationReason?: string;
  pickupPlaceName?: string;
  dropoffPlaceName?: string;
  rideData?: RawRideData;
}

function getBookingCompletionOutcome(
  booking: RawBookingData & { rideData?: RawRideData }
): { completion: 'completed' | 'cancelled' | null; reason?: string } {
  const bookingCompletion = String((booking as any).passengerCompletion || '').toLowerCase();
  if (bookingCompletion === 'completed') {
    return { completion: 'completed' };
  }
  if (bookingCompletion === 'cancelled') {
    return {
      completion: 'cancelled',
      reason: (booking as any).completionReason || booking.cancellationReason,
    };
  }

  const passengers = Array.isArray(booking.rideData?.confirmedPassengers)
    ? booking.rideData!.confirmedPassengers!
    : [];
  const participant = passengers.find((p: any) => String(p?.userId || '') === String(booking.passengerId || ''));
  const participantCompletion = String(participant?.passengerCompletion || '').toLowerCase();

  if (participantCompletion === 'completed') {
    return { completion: 'completed' };
  }
  if (participantCompletion === 'cancelled' || String(participant?.driverReview || '').toLowerCase() === 'no-show') {
    return {
      completion: 'cancelled',
      reason: participant?.completionReason || booking.completionReason || booking.cancellationReason,
    };
  }

  return { completion: null };
}

function getBookingFare(booking: RawBookingData & { rideData?: RawRideData }): number {
  const direct = Number((booking as any).totalFare || booking.price || (booking as any).fare || 0);
  if (direct > 0) return direct;

  const seats = Math.max(1, Number((booking as any).seats || (booking as any).seatsBooked || 1) || 1);
  const seatPrice = Number(booking.rideData?.price || booking.rideData?.fare || 0);
  return seatPrice > 0 ? seatPrice * seats : 0;
}

function isDriverPreDepartureCancellation(ride: RawRideData): boolean {
  const status = String((ride as any).status || (ride as any).lifecycleStatus || '').toLowerCase();
  if (!status.includes('cancel')) return false;

  const cancelledBy = String((ride as any).cancelledBy || '').toLowerCase();
  const driverId = String((ride as any).driverId || '').toLowerCase();
  if (cancelledBy && cancelledBy !== 'driver' && cancelledBy !== driverId) return false;

  if ((ride as any).cancelledBeforeDeparture === true) return true;

  const cancelledAt = toDate((ride as any).cancelledAt);
  const departureTime = toDate((ride as any).departureTime);
  return !!cancelledAt && !!departureTime && cancelledAt.getTime() < departureTime.getTime();
}

function isPassengerPreDepartureCancellation(request: RawRequestData): boolean {
  const status = String((request as any).status || '').toLowerCase();
  if (!status.includes('cancel')) return false;

  const cancelledBy = String((request as any).cancelledBy || '').toLowerCase();
  const passengerId = String((request as any).passengerId || '').toLowerCase();
  if (cancelledBy && cancelledBy !== 'passenger' && cancelledBy !== passengerId) return false;

  if ((request as any).cancelledBeforeDeparture === true) return true;
  return (request as any).isLateCancellation === false;
}

function isLastMinuteCancellation(payload: any): boolean {
  if (payload?.lastMinuteCancellation === true) return true;
  const cancelledAt = toDate(payload?.cancelledAt);
  const departureTime =
    toDate(payload?.rideDepartureTime)
    || toDate(payload?.departureTime)
    || toDate(payload?.rideData?.departureTime);

  if (!cancelledAt || !departureTime) return false;
  const diffMinutes = (departureTime.getTime() - cancelledAt.getTime()) / (60 * 1000);
  return diffMinutes >= 0 && diffMinutes <= 30;
}

function getDriverCancellationUnitsFromRide(ride: RawRideData): number {
  if (!isDriverPreDepartureCancellation(ride)) return 0;

  const confirmedCount = Number((ride as any)?.cancelledConfirmedPassengersCount
    ?? (Array.isArray((ride as any)?.confirmedPassengers) ? (ride as any).confirmedPassengers.length : 0));
  if (confirmedCount < 1) return 0;

  const multiplier = isLastMinuteCancellation(ride) ? 2 : 1;
  const explicitUnits = Number((ride as any)?.cancellationPenaltyUnits);
  if (Number.isFinite(explicitUnits) && explicitUnits > 0) {
    return explicitUnits;
  }

  return multiplier;
}

function isDriverPassengerRemovalCancellation(request: RawRequestData): boolean {
  const status = String((request as any)?.status || '').toLowerCase();
  if (!status.includes('cancel')) return false;

  const cancelledBy = String((request as any)?.cancelledBy || '').toLowerCase();
  if (cancelledBy !== 'driver' && cancelledBy !== String((request as any)?.driverId || '').toLowerCase()) {
    return false;
  }

  const scope = String((request as any)?.cancellationScope || '').toLowerCase();
  if (scope === 'ride_cancelled_by_driver') return false;

  const reason = String((request as any)?.cancellationReason || '').toLowerCase();
  if (reason.includes('driver cancelled the ride')) return false;

  return (request as any)?.isLateCancellation === true;
}

function getDriverPassengerRemovalUnits(request: RawRequestData, rideById: Map<string, RawRideData>): number {
  if (!isDriverPassengerRemovalCancellation(request)) return 0;

  const ride = request.rideId ? rideById.get(request.rideId) : undefined;
  const seats = Math.max(
    1,
    Number((request as any)?.rideTotalSeats || (request as any)?.totalSeats || (request as any)?.rideData?.seats || ride?.totalSeats || 4)
  );

  const multiplier = isLastMinuteCancellation(request) ? 2 : 1;
  const explicitUnits = Number((request as any)?.cancellationPenaltyUnits);
  if (Number.isFinite(explicitUnits) && explicitUnits > 0) {
    return explicitUnits;
  }

  return (1 / seats) * multiplier;
}

function isPassengerConfirmedCancellationBooking(booking: RawBookingData & { rideData?: RawRideData }): boolean {
  const status = String((booking as any)?.status || '').toLowerCase();
  if (!status.includes('cancel')) return false;

  const cancelledBy = String((booking as any)?.cancelledBy || '').toLowerCase();
  if (cancelledBy !== 'passenger' && cancelledBy !== String((booking as any)?.passengerId || '').toLowerCase()) {
    return false;
  }

  return (booking as any)?.isLateCancellation === true;
}

function getPassengerCancellationUnits(booking: RawBookingData & { rideData?: RawRideData }): number {
  if (!isPassengerConfirmedCancellationBooking(booking)) return 0;

  const multiplier = isLastMinuteCancellation(booking) ? 2 : 1;
  const explicitUnits = Number((booking as any)?.cancellationPenaltyUnits);
  if (Number.isFinite(explicitUnits) && explicitUnits > 0) {
    return explicitUnits;
  }

  return multiplier;
}

export async function fetchUserAnalyticsData(
  firestore: Firestore,
  userId: string,
  university: string
): Promise<{
  driverRides: RawRideData[];
  passengerBookings: (RawBookingData & { rideData?: RawRideData })[];
  passengerRequests: RawRequestData[];
  receivedRequests: RawRequestData[];
}> {
  const ridesRef = collection(firestore, `universities/${university}/rides`);
  
  // Fetch rides where user is driver
  const driverRidesQuery = query(
    ridesRef,
    where('driverId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const driverRidesSnapshot = await getDocs(driverRidesQuery);
  const driverRides = driverRidesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as RawRideData[];

  // Fetch bookings where user is passenger
  const bookingsRef = collection(firestore, `universities/${university}/bookings`);
  const passengerBookingsQuery = query(
    bookingsRef,
    where('passengerId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  let passengerBookings: (RawBookingData & { rideData?: RawRideData })[] = [];
  let bookingsRaw: RawBookingData[] = [];
  try {
    const passengerBookingsSnapshot = await getDocs(passengerBookingsQuery);
    bookingsRaw = passengerBookingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as RawBookingData[];
  } catch (e) {
    // Bookings collection might not exist or have different permissions
    console.debug('[Analytics] Could not fetch bookings:', e);
  }

  // CRITICAL FIX: Batch fetch rides for passenger bookings instead of sequential getDoc
  const rideMap = new Map<string, RawRideData>();
  
  // Add driver rides to map
  driverRides.forEach(ride => rideMap.set(ride.id, ride));
  
  // Collect all missing ride IDs that need to be fetched
  const missingRideIds: string[] = [];
  for (const booking of bookingsRaw) {
    if (booking.rideId && !rideMap.has(booking.rideId)) {
      if (!missingRideIds.includes(booking.rideId)) {
        missingRideIds.push(booking.rideId);
      }
    }
  }
  
  // OPTIMIZED: Fetch missing rides in batches instead of sequential awaits
  const BATCH_SIZE = 10;
  for (let i = 0; i < missingRideIds.length; i += BATCH_SIZE) {
    const batch = missingRideIds.slice(i, i + BATCH_SIZE);
    const rideSnapshots = await Promise.all(
      batch.map(rideId =>
        getDoc(doc(firestore, `universities/${university}/rides`, rideId)).catch(() => null)
      )
    );
    
    rideSnapshots.forEach(snapshot => {
      if (snapshot?.exists()) {
        const rideData = { id: snapshot.id, ...snapshot.data() } as RawRideData;
        rideMap.set(snapshot.id, rideData);
      }
    });
  }
  
  // Enrich bookings with cached ride data
  passengerBookings = bookingsRaw.map(booking => {
    const enrichedBooking: RawBookingData & { rideData?: RawRideData } = { ...booking };
    if (booking.rideId && rideMap.has(booking.rideId)) {
      enrichedBooking.rideData = rideMap.get(booking.rideId);
    }
    return enrichedBooking;
  });

  // For requests, we need to check ride subcollections - OPTIMIZED: Batch fetch with max 5 concurrent
  let passengerRequests: RawRequestData[] = [];
  const receivedRequests: RawRequestData[] = [];

  // Fetch requests from all driver rides (received requests) - limit concurrency
  const REQUEST_CONCURRENCY = 5;
  for (let i = 0; i < driverRides.length; i += REQUEST_CONCURRENCY) {
    const batch = driverRides.slice(i, i + REQUEST_CONCURRENCY);
    const requestSnapshots = await Promise.all(
      batch.map(ride =>
        getDocs(collection(firestore, `universities/${university}/rides/${ride.id}/requests`)).catch(() => null)
      )
    );
    
    requestSnapshots.forEach(snapshot => {
      if (snapshot) {
        snapshot.docs.forEach(doc => {
          const data = doc.data() as RawRequestData;
          receivedRequests.push({ id: doc.id, ...data });
        });
      }
    });
  }

  // Fetch requests where user is passenger (includes cancellations before booking materialization)
  try {
    const requestsGroupRef = collectionGroup(firestore, 'requests');
    const passengerRequestsQuery = query(
      requestsGroupRef,
      where('passengerId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const passengerRequestsSnapshot = await getDocs(passengerRequestsQuery);

    passengerRequests = passengerRequestsSnapshot.docs
      .filter((requestDoc) => requestDoc.ref.path.includes(`/universities/${university}/`))
      .map((requestDoc) => {
        const data = requestDoc.data() as RawRequestData;
        const segments = requestDoc.ref.path.split('/');
        const rideSegmentIndex = segments.indexOf('rides');
        const rideIdFromPath = rideSegmentIndex >= 0 ? segments[rideSegmentIndex + 1] : undefined;

        return {
          id: requestDoc.id,
          ...data,
          rideId: data.rideId || rideIdFromPath || data.id,
        } as RawRequestData;
      });
  } catch (error) {
    console.debug('[Analytics] Could not fetch passenger requests via collectionGroup:', error);
  }

  // Backfill ride data for passenger requests
  for (const request of passengerRequests) {
    if (request.rideId && !rideMap.has(request.rideId) && !missingRideIds.includes(request.rideId)) {
      missingRideIds.push(request.rideId);
    }
  }

  const unresolvedRideIds = missingRideIds.filter((rideId) => !rideMap.has(rideId));
  for (let i = 0; i < unresolvedRideIds.length; i += BATCH_SIZE) {
    const batch = unresolvedRideIds.slice(i, i + BATCH_SIZE);
    const rideSnapshots = await Promise.all(
      batch.map(rideId =>
        getDoc(doc(firestore, `universities/${university}/rides`, rideId)).catch(() => null)
      )
    );

    rideSnapshots.forEach(snapshot => {
      if (snapshot?.exists()) {
        const rideData = { id: snapshot.id, ...snapshot.data() } as RawRideData;
        rideMap.set(snapshot.id, rideData);
      }
    });
  }

  passengerRequests = passengerRequests.map((request) => {
    if (request.rideId && rideMap.has(request.rideId)) {
      return {
        ...request,
        rideData: rideMap.get(request.rideId),
      };
    }
    return request;
  });

  return {
    driverRides,
    passengerBookings,
    passengerRequests,
    receivedRequests,
  };
}

// ============================================================================
// METRICS COMPUTATION
// ============================================================================

function computeCommonMetrics(
  rides: RawRideData[],
  bookings: RawBookingData[],
  isDriver: boolean
): CommonMetrics {
  const allItems = isDriver ? rides : bookings;

  const completedItems = allItems.filter((item) => {
    const status = String(item.status || '').toLowerCase();
    const passengerCompletion = String((item as any).passengerCompletion || '').toLowerCase();
    const lifecycleStatus = String((item as any).lifecycleStatus || '').toLowerCase();
    return status === 'completed' || passengerCompletion === 'completed' || lifecycleStatus === 'completed';
  });
  const cancelledItems = allItems.filter((item) => {
    const status = String(item.status || '').toLowerCase();
    const passengerCompletion = String((item as any).passengerCompletion || '').toLowerCase();
    return status.includes('cancel') || status === 'declined' || status === 'rejected' || status === 'failed' || passengerCompletion === 'cancelled';
  });
  const pendingItems = allItems.filter(
    item => {
      const status = String(item.status || '').toLowerCase();
      const lifecycleStatus = String((item as any).lifecycleStatus || '').toLowerCase();
      return status === 'pending' || status === 'active' || status === 'accepted' || lifecycleStatus === 'completion_window';
    }
  );

  // Calculate ratings
  const ratings = allItems
    .map(item => {
      if (isDriver) {
        return (item as RawRideData).driverRating || (item as RawRideData).rating;
      }
      return (item as RawBookingData).passengerRating || (item as RawBookingData).rating;
    })
    .filter((r): r is number => typeof r === 'number' && r > 0);

  const averageRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null;

  // Calculate trust score (0-100)
  const completionRate = allItems.length > 0
    ? (completedItems.length / allItems.length) * 100
    : 0;
  const ratingScore = averageRating ? (averageRating / 5) * 100 : 50;
  const trustScore = Math.round((completionRate * 0.6) + (ratingScore * 0.4));

  // Calculate active days
  const uniqueDays = new Set<string>();
  allItems.forEach(item => {
    const date = toDate(item.createdAt);
    if (date) uniqueDays.add(formatDateKey(date));
  });

  // Calculate total distance
  let totalDistanceKm = 0;
  if (isDriver) {
    rides.forEach(ride => {
      if (ride.distanceKm) {
        totalDistanceKm += ride.distanceKm;
      } else if (ride.route) {
        totalDistanceKm += calculateDistance(ride.route);
      }
    });
  }

  // Estimate total time (assuming average speed of 30 km/h for urban rides)
  const totalTimeMinutes = Math.round(totalDistanceKm * 2); // 2 min per km average

  // Find first and last activity dates
  const dates = allItems
    .map(item => toDate(item.createdAt))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    totalRides: allItems.length,
    completedRides: completedItems.length,
    cancelledRides: cancelledItems.length,
    pendingRides: pendingItems.length,
    averageRating,
    totalRatingsReceived: ratings.length,
    trustScore,
    activeDaysOnPlatform: uniqueDays.size,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalTimeMinutes,
    memberSince: dates.length > 0 ? dates[0] : null,
    lastActiveDate: dates.length > 0 ? dates[dates.length - 1] : null,
  };
}

function computeDriverMetrics(
  rides: RawRideData[],
  receivedRequests: RawRequestData[]
): DriverMetrics {
  const commonMetrics = computeCommonMetrics(rides, [], true);
  const rideById = new Map<string, RawRideData>();
  rides.forEach((ride) => {
    if (ride.id) rideById.set(ride.id, ride);
  });

  // Completed rides must be explicitly completed by lifecycle/form actions
  const completedRides = rides.filter(r => 
    String(r.status || '').toLowerCase() === 'completed' || String((r as any).lifecycleStatus || '').toLowerCase() === 'completed'
  );
  
  // Calculate passengers served
  const totalPassengersServed = rides.reduce((sum, ride) => {
    const filled = (ride.totalSeats || 0) - (ride.availableSeats || 0);
    return sum + Math.max(0, filled);
  }, 0);

  // Calculate seat efficiency
  const totalSeatsOffered = rides.reduce((sum, ride) => sum + (ride.totalSeats || 0), 0);
  const totalSeatsFilled = totalPassengersServed;
  const seatEfficiencyPercent = totalSeatsOffered > 0
    ? Math.round((totalSeatsFilled / totalSeatsOffered) * 100)
    : 0;

  // Calculate acceptance rate from requests
  const acceptedRequests = receivedRequests.filter(
    r => r.status === 'ACCEPTED' || r.status === 'accepted' || r.status === 'CONFIRMED'
  );
  const rideAcceptanceRate = receivedRequests.length > 0
    ? Math.round((acceptedRequests.length / receivedRequests.length) * 100)
    : 100;

  // Completion rate based on status only (for overall stats)
  const statusCompletedRides = rides.filter(r => {
    const status = String(r.status || '').toLowerCase();
    const lifecycleStatus = String((r as any).lifecycleStatus || '').toLowerCase();
    return status === 'completed' || lifecycleStatus === 'completed';
  });
  const wholeRideCancellationUnits = rides.reduce((sum, ride) => sum + getDriverCancellationUnitsFromRide(ride), 0);
  const passengerRemovalCancellationUnits = receivedRequests.reduce(
    (sum, request) => sum + getDriverPassengerRemovalUnits(request, rideById),
    0
  );
  const terminalFailureRideUnits = rides.filter((ride) => {
    const status = String(ride.status || '').toLowerCase();
    const lifecycleStatus = String((ride as any).lifecycleStatus || '').toLowerCase();
    return status === 'failed' || status === 'expired' || status === 'rejected' || status === 'declined'
      || lifecycleStatus === 'failed' || lifecycleStatus === 'expired';
  }).length;
  const weightedCancellationUnits = wholeRideCancellationUnits + passengerRemovalCancellationUnits + terminalFailureRideUnits;
  const rideCompletionBase = statusCompletedRides.length + weightedCancellationUnits;
  const rideCompletionRate = rideCompletionBase > 0
    ? Math.round((statusCompletedRides.length / rideCompletionBase) * 100)
    : 100;

  // Cancellation rate: role-specific and pre-departure only
  const cancellationRate = rideCompletionBase > 0
    ? Math.round((weightedCancellationUnits / rideCompletionBase) * 100)
    : 0;

  const nonCompletedRides = rides.filter((ride) => {
    const status = String(ride.status || '').toLowerCase();
    const lifecycleStatus = String((ride as any).lifecycleStatus || '').toLowerCase();
    return !(
      status === 'completed' ||
      lifecycleStatus === 'completed' ||
      status.includes('cancel') ||
      lifecycleStatus.includes('cancel') ||
      status === 'failed' ||
      status === 'expired' ||
      status === 'rejected' ||
      status === 'declined' ||
      lifecycleStatus === 'failed' ||
      lifecycleStatus === 'expired'
    );
  }).length;

  const weightedTotalRides = statusCompletedRides.length + weightedCancellationUnits + nonCompletedRides;

  // Peak ride hours
  const hourCounts = new Array(24).fill(0);
  rides.forEach(ride => {
    const date = toDate(ride.departureTime) || toDate(ride.createdAt);
    if (date) hourCounts[date.getHours()]++;
  });
  const maxHourCount = Math.max(...hourCounts);
  const peakRideHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(h => h.count === maxHourCount && h.count > 0)
    .map(h => h.hour);

  // Most common routes
  const routeCounts = new Map<string, { from: string; to: string; count: number; lastUsed: Date }>();
  rides.forEach(ride => {
    const key = `${ride.from}|${ride.to}`;
    const existing = routeCounts.get(key);
    const date = toDate(ride.createdAt) || new Date();
    if (existing) {
      existing.count++;
      if (date > existing.lastUsed) existing.lastUsed = date;
    } else {
      routeCounts.set(key, { from: ride.from, to: ride.to, count: 1, lastUsed: date });
    }
  });
  const mostCommonRoutes = Array.from(routeCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Earnings from completion-form outcomes only
  const totalEarnings = completedRides.reduce((sum, ride) => {
    const participants = Array.isArray((ride as any).confirmedPassengers)
      ? (ride as any).confirmedPassengers
      : [];

    const completedPassengers = participants.filter((participant: any) => {
      const completion = String(participant?.passengerCompletion || '').toLowerCase();
      const review = String(participant?.driverReview || '').toLowerCase();
      return completion === 'completed' && review !== 'no-show';
    }).length;

    const pricePerSeat = Number(ride.price || ride.fare || 0);
    return sum + (completedPassengers > 0 && pricePerSeat > 0 ? completedPassengers * pricePerSeat : 0);
  }, 0);
  const averageEarningsPerRide = completedRides.length > 0
    ? Math.round(totalEarnings / completedRides.length)
    : 0;

  // Best performing days - using corrected earnings calculation (only completed rides)
  const dayEarnings = new Map<string, number>();
  completedRides.forEach(ride => {
    const date = toDate(ride.createdAt);
    if (date) {
      const day = getFullDayName(date);
      const participants = Array.isArray((ride as any).confirmedPassengers)
        ? (ride as any).confirmedPassengers
        : [];
      const completedPassengers = participants.filter((participant: any) => {
        const completion = String(participant?.passengerCompletion || '').toLowerCase();
        const review = String(participant?.driverReview || '').toLowerCase();
        return completion === 'completed' && review !== 'no-show';
      }).length;
      const pricePerSeat = Number(ride.price || ride.fare || 0);
      const rideEarnings = completedPassengers > 0 && pricePerSeat > 0 ? completedPassengers * pricePerSeat : 0;
      dayEarnings.set(day, (dayEarnings.get(day) || 0) + rideEarnings);
    }
  });
  const bestPerformingDays = Array.from(dayEarnings.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day]) => day);

  // Time series data - CRITICAL FIX: Use completed rides only with corrected earnings
  // Create a map of ride earnings for time series
  const rideEarningsMap = new Map<string, number>();
  completedRides.forEach(ride => {
    const participants = Array.isArray((ride as any).confirmedPassengers)
      ? (ride as any).confirmedPassengers
      : [];
    const completedPassengers = participants.filter((participant: any) => {
      const completion = String(participant?.passengerCompletion || '').toLowerCase();
      const review = String(participant?.driverReview || '').toLowerCase();
      return completion === 'completed' && review !== 'no-show';
    }).length;
    const pricePerSeat = Number(ride.price || ride.fare || 0);
    rideEarningsMap.set(ride.id, completedPassengers > 0 && pricePerSeat > 0 ? completedPassengers * pricePerSeat : 0);
  });
  
  const earningsOverTime = computeTimeSeriesData(
    completedRides,
    ride => rideEarningsMap.get(ride.id) || 0
  );
  const ridesOverTime = computeTimeSeriesData(rides, () => 1);
  const weeklyActivity = computeWeeklyActivity(rides);
  const rideActivityHeatmap = computeHeatmapData(rides);

  return {
    ...commonMetrics,
    totalRides: Math.round(weightedTotalRides * 100) / 100,
    completedRides: statusCompletedRides.length,
    cancelledRides: Math.round(weightedCancellationUnits * 100) / 100,
    pendingRides: nonCompletedRides,
    role: 'driver',
    totalPassengersServed,
    totalSeatsOffered,
    totalSeatsFilled,
    seatEfficiencyPercent,
    rideAcceptanceRate,
    rideCompletionRate,
    cancellationRate,
    peakRideHours,
    mostCommonRoutes,
    totalEarnings,
    averageEarningsPerRide,
    bestPerformingDays,
    earningsOverTime,
    ridesOverTime,
    weeklyActivity,
    rideActivityHeatmap,
  };
}

function computePassengerMetrics(
  bookings: (RawBookingData & { rideData?: RawRideData })[],
  requests: RawRequestData[]
): PassengerMetrics {
  const commonMetrics = computeCommonMetrics([], bookings, false);

  // Completion outcome must come from passenger completion form submission.
  const formCompletedBookings = bookings.filter((booking) => getBookingCompletionOutcome(booking).completion === 'completed');
  const bookingCancellationUnits = bookings.reduce((sum, booking) => sum + getPassengerCancellationUnits(booking), 0);

  const bookingIds = new Set(bookings.map((booking) => String(booking.id || '')));
  const requestFallbackCancellationUnits = requests.reduce((sum, request) => {
    const reqId = String(request?.id || '');
    if (!reqId || bookingIds.has(reqId)) return sum;

    const status = String(request?.status || '').toLowerCase();
    if (!status.includes('cancel')) return sum;

    const cancelledBy = String((request as any)?.cancelledBy || '').toLowerCase();
    if (cancelledBy !== 'passenger' && cancelledBy !== String(request?.passengerId || '').toLowerCase()) return sum;
    if ((request as any)?.isLateCancellation !== true) return sum;

    const multiplier = isLastMinuteCancellation(request) ? 2 : 1;
    const explicitUnits = Number((request as any)?.cancellationPenaltyUnits);
    const units = Number.isFinite(explicitUnits) && explicitUnits > 0 ? explicitUnits : multiplier;
    return sum + units;
  }, 0);

  const weightedCancellationUnits = bookingCancellationUnits + requestFallbackCancellationUnits;

  const totalRidesTaken = formCompletedBookings.length;

  const totalDistanceKm = formCompletedBookings.reduce((sum, booking) => {
    const rideDistance = Number(booking.rideData?.distanceKm || 0);
    if (rideDistance > 0) return sum + rideDistance;
    if (booking.rideData?.route && Array.isArray(booking.rideData.route)) {
      return sum + calculateDistance(booking.rideData.route);
    }
    return sum;
  }, 0);
  const totalTimeMinutes = Math.round(totalDistanceKm * 2);

  // Request to confirm rate - use completed bookings only
  const ridesRequested = Math.max(bookings.length, requests.length);
  const ridesConfirmed = formCompletedBookings.length;
  const requestToConfirmRate = ridesRequested > 0
    ? Math.round((ridesConfirmed / ridesRequested) * 100)
    : 0;

  // Preferred pickup times
  const hourCounts = new Array(24).fill(0);
  bookings.forEach(booking => {
    const date = toDate(booking.createdAt);
    if (date) hourCounts[date.getHours()]++;
  });
  const maxHourCount = Math.max(...hourCounts);
  const preferredPickupTimes = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(h => h.count === maxHourCount && h.count > 0)
    .map(h => h.hour);

  // Most frequent destinations (we'd need ride data for this, use empty for now)
  const mostFrequentDestinations: RouteFrequency[] = [];

  // Cost calculations - count completed bookings only
  const totalSpent = formCompletedBookings.reduce((sum, booking) => sum + getBookingFare(booking), 0);
  const averageCostPerRide = formCompletedBookings.length > 0
    ? Math.round(totalSpent / formCompletedBookings.length)
    : 0;

  // Time series data - use completedBookings for accurate spending
  const spendingOverTime = computeTimeSeriesData(
    formCompletedBookings,
    booking => getBookingFare(booking)
  );
  const ridesOverTime = computeTimeSeriesData(bookings, () => 1);
  const weeklyActivity = computeWeeklyActivity(bookings);
  const rideActivityHeatmap = computeHeatmapData(bookings);

  const nonCompletedBookings = bookings.filter((booking) => {
    const completion = getBookingCompletionOutcome(booking).completion;
    if (completion === 'completed' || completion === 'cancelled') return false;
    const status = String(booking?.status || '').toLowerCase();
    return !(
      status.includes('cancel') ||
      status === 'completed' ||
      status === 'failed' ||
      status === 'expired' ||
      status === 'rejected' ||
      status === 'declined'
    );
  }).length;

  const terminalFailureBookingUnits = bookings.filter((booking) => {
    const completion = getBookingCompletionOutcome(booking).completion;
    if (completion === 'completed' || completion === 'cancelled') return false;
    const status = String(booking?.status || '').toLowerCase();
    return status === 'failed' || status === 'expired' || status === 'rejected' || status === 'declined';
  }).length;

  const weightedCancellationUnitsWithFailures = weightedCancellationUnits + terminalFailureBookingUnits;
  const cancellationBaseWithFailures = formCompletedBookings.length + weightedCancellationUnitsWithFailures;
  const cancellationRate = cancellationBaseWithFailures > 0
    ? Math.round((weightedCancellationUnitsWithFailures / cancellationBaseWithFailures) * 100)
    : 0;
  const rideCompletionRate = cancellationBaseWithFailures > 0
    ? Math.round((formCompletedBookings.length / cancellationBaseWithFailures) * 100)
    : 100;

  const weightedTotalRides = formCompletedBookings.length + weightedCancellationUnitsWithFailures + nonCompletedBookings;

  return {
    ...commonMetrics,
    totalRides: Math.round(weightedTotalRides * 100) / 100,
    completedRides: formCompletedBookings.length,
    cancelledRides: Math.round(weightedCancellationUnitsWithFailures * 100) / 100,
    pendingRides: nonCompletedBookings,
    role: 'passenger',
    totalRidesTaken,
    rideCompletionRate,
    ridesRequested,
    ridesConfirmed,
    requestToConfirmRate,
    cancellationRate,
    preferredPickupTimes,
    mostFrequentDestinations,
    totalSpent,
    averageCostPerRide,
    spendingOverTime,
    ridesOverTime,
    weeklyActivity,
    rideActivityHeatmap,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalTimeMinutes,
  };
}

// ============================================================================
// TIME SERIES HELPERS
// ============================================================================

function computeTimeSeriesData<T extends { createdAt?: any }>(
  items: T[],
  getValue: (item: T) => number
): TimeSeriesDataPoint[] {
  const dataByDate = new Map<string, number>();
  
  // Get last 30 days
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dataByDate.set(formatDateKey(date), 0);
  }

  items.forEach(item => {
    const date = toDate(item.createdAt);
    if (date) {
      const key = formatDateKey(date);
      if (dataByDate.has(key)) {
        dataByDate.set(key, (dataByDate.get(key) || 0) + getValue(item));
      }
    }
  });

  return Array.from(dataByDate.entries()).map(([date, value]) => ({
    date,
    value,
    label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));
}

function computeWeeklyActivity<T extends { createdAt?: any }>(
  items: T[]
): TimeSeriesDataPoint[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const counts = new Array(7).fill(0);

  items.forEach(item => {
    const date = toDate(item.createdAt);
    if (date) counts[date.getDay()]++;
  });

  return days.map((day, idx) => ({
    date: day,
    value: counts[idx],
    label: day,
  }));
}

function computeHeatmapData<T extends { createdAt?: any }>(
  items: T[]
): RideActivityDataPoint[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data: RideActivityDataPoint[] = [];

  // Initialize all cells
  days.forEach(day => {
    for (let hour = 0; hour < 24; hour++) {
      data.push({ day, hour, value: 0 });
    }
  });

  // Count occurrences
  items.forEach(item => {
    const date = toDate(item.createdAt);
    if (date) {
      const dayIndex = date.getDay();
      const dayName = days[dayIndex === 0 ? 6 : dayIndex - 1]; // Convert to Mon=0 format
      const hour = date.getHours();
      const cell = data.find(d => d.day === dayName && d.hour === hour);
      if (cell) cell.value++;
    }
  });

  return data;
}

// ============================================================================
// INSIGHTS GENERATION
// ============================================================================

function generateInsights(
  driverMetrics: DriverMetrics | null,
  passengerMetrics: PassengerMetrics | null
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];

  if (driverMetrics) {
    // Activity pattern insights
    if (driverMetrics.peakRideHours.length > 0) {
      const peakHour = driverMetrics.peakRideHours[0];
      const timeLabel = peakHour < 12 ? `${peakHour}:00 AM` : `${peakHour - 12 || 12}:00 PM`;
      insights.push({
        id: generateUniqueId(),
        type: 'activity_pattern',
        title: 'Peak Activity Time',
        description: `You're most active around ${timeLabel}. This is when you provide the most rides.`,
        icon: 'Clock',
        color: 'primary',
        value: timeLabel,
      });
    }

    // Performance insights
    if (driverMetrics.seatEfficiencyPercent > 80) {
      insights.push({
        id: generateUniqueId(),
        type: 'achievement',
        title: 'Excellent Seat Efficiency',
        description: `${driverMetrics.seatEfficiencyPercent}% of your offered seats get filled. You're maximizing your capacity!`,
        icon: 'Trophy',
        color: 'success',
        value: `${driverMetrics.seatEfficiencyPercent}%`,
        trend: 'up',
      });
    }

    if (driverMetrics.rideCompletionRate >= 90) {
      insights.push({
        id: generateUniqueId(),
        type: 'performance',
        title: 'High Reliability',
        description: `Your ${driverMetrics.rideCompletionRate}% completion rate shows you're a dependable driver.`,
        icon: 'Shield',
        color: 'success',
        value: `${driverMetrics.rideCompletionRate}%`,
        trend: 'up',
      });
    }

    // Best day insight
    if (driverMetrics.bestPerformingDays.length > 0) {
      insights.push({
        id: generateUniqueId(),
        type: 'trend',
        title: 'Best Performing Day',
        description: `${driverMetrics.bestPerformingDays[0]} is your most profitable day. Consider offering more rides then!`,
        icon: 'TrendingUp',
        color: 'purple',
        value: driverMetrics.bestPerformingDays[0],
      });
    }

    // Earnings milestone
    if (driverMetrics.totalEarnings > 0) {
      insights.push({
        id: generateUniqueId(),
        type: 'achievement',
        title: 'Total Earnings',
        description: `You've earned PKR ${driverMetrics.totalEarnings.toLocaleString()} from providing rides. Great work!`,
        icon: 'Wallet',
        color: 'success',
        value: `PKR ${driverMetrics.totalEarnings.toLocaleString()}`,
      });
    }

    // Route suggestion
    if (driverMetrics.mostCommonRoutes.length > 0) {
      const topRoute = driverMetrics.mostCommonRoutes[0];
      insights.push({
        id: generateUniqueId(),
        type: 'suggestion',
        title: 'Most Popular Route',
        description: `${topRoute.from} → ${topRoute.to} is your most frequent route (${topRoute.count} times).`,
        icon: 'MapPin',
        color: 'info',
        value: `${topRoute.count}x`,
      });
    }
  }

  if (passengerMetrics) {
    // Spending insights
    if (passengerMetrics.totalSpent > 0) {
      insights.push({
        id: generateUniqueId(),
        type: 'trend',
        title: 'Total Spent on Rides',
        description: `You've spent PKR ${passengerMetrics.totalSpent.toLocaleString()} on rides. Average per ride: PKR ${passengerMetrics.averageCostPerRide}`,
        icon: 'CreditCard',
        color: 'info',
        value: `PKR ${passengerMetrics.totalSpent.toLocaleString()}`,
      });
    }

    // Request success rate
    if (passengerMetrics.requestToConfirmRate > 80) {
      insights.push({
        id: generateUniqueId(),
        type: 'performance',
        title: 'High Booking Success',
        description: `${passengerMetrics.requestToConfirmRate}% of your ride requests get confirmed. Ride providers trust you!`,
        icon: 'CheckCircle',
        color: 'success',
        value: `${passengerMetrics.requestToConfirmRate}%`,
        trend: 'up',
      });
    }

    // Preferred time insight
    if (passengerMetrics.preferredPickupTimes.length > 0) {
      const peakHour = passengerMetrics.preferredPickupTimes[0];
      const timeLabel = peakHour < 12 ? `${peakHour}:00 AM` : `${peakHour - 12 || 12}:00 PM`;
      insights.push({
        id: generateUniqueId(),
        type: 'activity_pattern',
        title: 'Preferred Travel Time',
        description: `You typically book rides around ${timeLabel}. Plan ahead for the best options!`,
        icon: 'Clock',
        color: 'primary',
        value: timeLabel,
      });
    }

    // Activity milestone
    if (passengerMetrics.totalRidesTaken >= 10) {
      insights.push({
        id: generateUniqueId(),
        type: 'achievement',
        title: 'Active Passenger',
        description: `You've completed ${passengerMetrics.totalRidesTaken} rides! You're a regular commuter.`,
        icon: 'Award',
        color: 'purple',
        value: `${passengerMetrics.totalRidesTaken} rides`,
      });
    }
  }

  return insights;
}

// ============================================================================
// RIDE HISTORY
// ============================================================================

function buildRideHistory(
  driverRides: RawRideData[],
  passengerBookings: (RawBookingData & { rideData?: RawRideData })[],
  passengerRequests: RawRequestData[]
): RideHistoryEntry[] {
  const history: RideHistoryEntry[] = [];

  // Add driver rides
  driverRides.forEach(ride => {
    const date = toDate(ride.createdAt) || toDate(ride.departureTime);
    history.push({
      id: ride.id,
      rideId: ride.id,
      date: date || new Date(),
      from: ride.from || 'Unknown',
      to: ride.to || 'Unknown',
      role: 'driver',
      status: normalizeStatus(ride.status),
      rawStatus: ride.status,
      ratingGiven: null,
      ratingReceived: ride.driverRating || ride.rating || null,
      seats: ride.totalSeats,
      passengers: (ride.totalSeats || 0) - (ride.availableSeats || 0),
      fare: ride.price || ride.fare || 0,
      distanceKm: ride.distanceKm || calculateDistance(ride.route),
      durationMinutes: Math.round((ride.distanceKm || calculateDistance(ride.route)) * 2),
      providerName: 'You',
      pickupLocation: ride.pickupPlaceName || undefined,
      dropoffLocation: ride.dropoffPlaceName || undefined,
      cancellationReason: ride.cancellationReason || undefined,
    });
  });

  // Add passenger bookings
  passengerBookings.forEach(booking => {
    const rideData = (booking as any).rideData as RawRideData | undefined;
    const date = toDate(booking.createdAt) || toDate(booking.confirmedAt);
    const bookingFare = Number(booking.price || rideData?.price || rideData?.fare || 0);
    const passengerCompletion = String((booking as any).passengerCompletion || '').toLowerCase();
    const matchedPassenger = Array.isArray((rideData as any)?.confirmedPassengers)
      ? (rideData as any).confirmedPassengers.find((p: any) => {
          if (typeof p === 'string') return false;
          return p?.userId === booking.passengerId;
        })
      : null;
    const completionReason =
      booking.completionReason ||
      (booking as any).cancellationReason ||
      matchedPassenger?.completionReason ||
      undefined;
    history.push({
      id: booking.id,
      bookingId: booking.id,
      rideId: booking.rideId,
      date: date || new Date(),
      from: rideData?.from || (booking as any).from || 'Unknown',
      to: rideData?.to || (booking as any).to || 'Unknown',
      role: 'passenger',
      status: passengerCompletion === 'cancelled' ? 'cancelled' : normalizeStatus(booking.status),
      rawStatus: booking.status,
      ratingGiven: booking.passengerRating || null,
      ratingReceived: booking.driverRating || null,
      seats: 1,
      fare: bookingFare,
      distanceKm: rideData?.distanceKm || (rideData?.route ? calculateDistance(rideData.route) : undefined),
      durationMinutes: rideData?.distanceKm
        ? Math.round(rideData.distanceKm * 2)
        : (rideData?.route ? Math.round(calculateDistance(rideData.route) * 2) : undefined),
      providerName:
        booking.driverDetails?.fullName ||
        rideData?.driverInfo?.fullName ||
        (rideData?.driverId ? `Driver (${rideData.driverId.slice(0, 6)}...)` : 'Ride Provider'),
      pickupLocation: booking.pickupPlaceName || (booking as any).pickupPointName || rideData?.pickupPlaceName || undefined,
      dropoffLocation: booking.dropoffPlaceName || (booking as any).dropoffPointName || rideData?.dropoffPlaceName || undefined,
      cancellationReason: completionReason,
    });
  });

  // Add cancelled passenger requests so cancellations show in history even without booking docs
  const existingPassengerKeys = new Set(
    history
      .filter((entry) => entry.role === 'passenger')
      .map((entry) => `${entry.rideId || ''}:${entry.bookingId || entry.id}`)
  );

  passengerRequests.forEach((request) => {
    const normalizedStatus = normalizeStatus(request.status);
    if (normalizedStatus !== 'cancelled') return;

    const dedupeKey = `${request.rideId || ''}:${request.id}`;
    if (existingPassengerKeys.has(dedupeKey)) return;

    const rideData = request.rideData;
    const date = toDate(request.cancelledAt) || toDate(request.createdAt);

    history.push({
      id: `request-${request.id}`,
      bookingId: request.id,
      rideId: request.rideId,
      date: date || new Date(),
      from: rideData?.from || (request as any).from || 'Unknown',
      to: rideData?.to || (request as any).to || 'Unknown',
      role: 'passenger',
      status: 'cancelled',
      rawStatus: request.status,
      ratingGiven: null,
      ratingReceived: null,
      seats: 1,
      fare: Number(rideData?.price || rideData?.fare || (request as any).price || 0),
      distanceKm: rideData?.distanceKm || (rideData?.route ? calculateDistance(rideData.route) : undefined),
      durationMinutes: rideData?.distanceKm
        ? Math.round(rideData.distanceKm * 2)
        : (rideData?.route ? Math.round(calculateDistance(rideData.route) * 2) : undefined),
      providerName:
        rideData?.driverInfo?.fullName ||
        (rideData?.driverId ? `Driver (${rideData.driverId.slice(0, 6)}...)` : 'Ride Provider'),
      pickupLocation: request.pickupPlaceName || rideData?.pickupPlaceName || undefined,
      dropoffLocation: request.dropoffPlaceName || rideData?.dropoffPlaceName || undefined,
      cancellationReason: request.cancellationReason || (request as any).reason || undefined,
    });
  });

  // Sort by date descending
  return history.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function normalizeStatus(status: string): 'completed' | 'cancelled' | 'active' | 'pending' {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return 'completed';
  if (s.includes('cancel') || s === 'rejected' || s === 'declined' || s === 'failed') return 'cancelled';
  if (s === 'active' || s === 'accepted') return 'active';
  return 'pending';
}

// ============================================================================
// MAIN ANALYTICS FUNCTION
// ============================================================================

export async function computeUserAnalytics(
  firestore: Firestore,
  userId: string,
  university: string
): Promise<CombinedAnalytics> {
  const { driverRides, passengerBookings, passengerRequests, receivedRequests } =
    await fetchUserAnalyticsData(firestore, userId, university);

  // Determine user role
  const hasDriverActivity = driverRides.length > 0;
  const hasPassengerActivity = passengerBookings.length > 0 || passengerRequests.length > 0;
  
  let userRole: UserRole = 'passenger';
  if (hasDriverActivity && hasPassengerActivity) {
    userRole = 'both';
  } else if (hasDriverActivity) {
    userRole = 'driver';
  }

  // Compute metrics
  const driverMetrics = hasDriverActivity
    ? computeDriverMetrics(driverRides, receivedRequests)
    : null;
  
  const passengerMetrics = hasPassengerActivity
    ? computePassengerMetrics(passengerBookings, passengerRequests)
    : null;

  // Prefer persisted post-ride spending records when available
  if (passengerMetrics) {
    try {
      const spendingRef = collection(firestore, `universities/${university}/passengerSpending`);
      const spendingQuery = query(spendingRef, where('passengerId', '==', userId));
      const spendingSnap = await getDocs(spendingQuery);

      if (!spendingSnap.empty) {
        const spendingAmounts = spendingSnap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return Number(data?.amount || 0);
        });

        const totalSpentFromRecords = spendingAmounts.reduce((sum, amount) => sum + amount, 0);
        const ridesWithSpending = spendingAmounts.filter((amount) => amount > 0).length;

        if (totalSpentFromRecords > 0) {
          passengerMetrics.totalSpent = Math.round(totalSpentFromRecords);
          const rideCountForAverage = Math.max(passengerMetrics.totalRidesTaken, ridesWithSpending);
          passengerMetrics.averageCostPerRide = rideCountForAverage > 0
            ? Math.round(totalSpentFromRecords / rideCountForAverage)
            : 0;
        }
      }
    } catch (error) {
      console.debug('[Analytics] Could not load passengerSpending fallback:', error);
    }
  }

  // Generate insights
  const insights = generateInsights(driverMetrics, passengerMetrics);

  // Build ride status breakdown for pie chart
  const allRides = driverRides.length > passengerBookings.length ? driverRides : passengerBookings;
  const statusCounts = {
    completed: 0,
    cancelled: 0,
    active: 0,
    pending: 0,
  };
  allRides.forEach(item => {
    const status = normalizeStatus(item.status);
    statusCounts[status]++;
  });

  const rideStatusBreakdown = [
    { label: 'Completed', value: statusCounts.completed, color: '#10B981' },
    { label: 'Active', value: statusCounts.active, color: '#3B82F6' },
    { label: 'Pending', value: statusCounts.pending, color: '#F59E0B' },
    { label: 'Cancelled', value: statusCounts.cancelled, color: '#EF4444' },
  ].filter(item => item.value > 0);

  return {
    userRole,
    driverMetrics,
    passengerMetrics,
    insights,
    rideStatusBreakdown,
  };
}

export { buildRideHistory };
