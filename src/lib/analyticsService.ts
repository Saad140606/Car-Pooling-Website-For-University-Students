// src/lib/analyticsService.ts
// Comprehensive analytics service that computes real metrics from Firestore data

import {
  collection,
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
  rating?: number;
  driverRating?: number;
  passengerRating?: number;
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
  const passengerRequests: RawRequestData[] = [];
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
  
  const completedItems = allItems.filter(
    item => item.status === 'completed' || item.status === 'CONFIRMED'
  );
  const cancelledItems = allItems.filter(
    item => item.status === 'cancelled' || item.status === 'CANCELLED'
  );
  const pendingItems = allItems.filter(
    item => item.status === 'pending' || item.status === 'PENDING' || item.status === 'active'
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

  // CRITICAL FIX: Filter rides where departure time has passed for "completed" metrics
  const completedRides = rides.filter(r => 
    (r.status === 'completed' || r.status === 'confirmed') && isRideCompleted(r.departureTime, r.status, (r as any).lifecycleStatus)
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
  const statusCompletedRides = rides.filter(r => r.status === 'completed');
  const cancelledRides = rides.filter(r => r.status === 'cancelled');
  const rideCompletionRate = (statusCompletedRides.length + cancelledRides.length) > 0
    ? Math.round((statusCompletedRides.length / (statusCompletedRides.length + cancelledRides.length)) * 100)
    : 100;

  // Cancellation rate
  const cancellationRate = rides.length > 0
    ? Math.round((cancelledRides.length / rides.length) * 100)
    : 0;

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

  // Earnings calculation - CRITICAL FIX
  // Calculate earnings ONLY from rides that are actually completed (departure time has passed)
  const totalEarnings = completedRides.reduce((sum, ride) => {
    // Count CONFIRMED requests ONLY (not ACCEPTED or PENDING)
    const rideRequests = receivedRequests.filter(
      r => r.rideId === ride.id && (r.status === 'CONFIRMED' || r.status === 'confirmed')
    );
    const confirmedPassengers = rideRequests.length;
    
    // Earnings = confirmed passengers × price per seat
    const pricePerSeat = ride.price || ride.fare || 0;
    const rideEarnings = confirmedPassengers > 0 ? confirmedPassengers * pricePerSeat : 0;
    
    return sum + rideEarnings;
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
      // Count CONFIRMED passengers ONLY (same logic as totalEarnings)
      const rideRequests = receivedRequests.filter(
        r => r.rideId === ride.id && (r.status === 'CONFIRMED' || r.status === 'confirmed')
      );
      const confirmedPassengers = rideRequests.length;
      const pricePerSeat = ride.price || ride.fare || 0;
      const rideEarnings = confirmedPassengers > 0 ? confirmedPassengers * pricePerSeat : 0;
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
    const rideRequests = receivedRequests.filter(
      r => r.rideId === ride.id && (r.status === 'CONFIRMED' || r.status === 'confirmed')
    );
    const confirmedPassengers = rideRequests.length;
    const pricePerSeat = ride.price || ride.fare || 0;
    rideEarningsMap.set(ride.id, confirmedPassengers > 0 ? confirmedPassengers * pricePerSeat : 0);
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

  // CRITICAL FIX: Only count bookings where status is CONFIRMED (not accepted/pending)
  const confirmedBookings = bookings.filter(
    b => (b.status === 'CONFIRMED' || b.status === 'confirmed')
  );
  
  // Filter for completed rides (ride departure time has passed)
  // ONLY these rides should count toward spending analytics
  const completedBookings = confirmedBookings.filter(
    b => b.rideData && isRideCompleted(b.rideData.departureTime, b.rideData.status, (b.rideData as any).lifecycleStatus)
  );
  
  const totalRidesTaken = completedBookings.length;

  // Request to confirm rate - use completed bookings only
  const ridesRequested = bookings.length;
  const ridesConfirmed = completedBookings.length;
  const requestToConfirmRate = ridesRequested > 0
    ? Math.round((ridesConfirmed / ridesRequested) * 100)
    : 0;

  // Cancellation rate
  const cancelledBookings = bookings.filter(
    b => b.status === 'cancelled' || b.status === 'CANCELLED'
  );
  const cancellationRate = bookings.length > 0
    ? Math.round((cancelledBookings.length / bookings.length) * 100)
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

  // Cost calculations - CRITICAL FIX: Only count spending for completed rides
  const totalSpent = completedBookings.reduce(
    (sum, b) => sum + (b.price || 0),
    0
  );
  const averageCostPerRide = completedBookings.length > 0
    ? Math.round(totalSpent / completedBookings.length)
    : 0;

  // Time series data - use completedBookings for accurate spending
  const spendingOverTime = computeTimeSeriesData(
    completedBookings,
    booking => booking.price || 0
  );
  const ridesOverTime = computeTimeSeriesData(bookings, () => 1);
  const weeklyActivity = computeWeeklyActivity(bookings);
  const rideActivityHeatmap = computeHeatmapData(bookings);

  return {
    ...commonMetrics,
    role: 'passenger',
    totalRidesTaken,
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
  passengerBookings: RawBookingData[]
): RideHistoryEntry[] {
  const history: RideHistoryEntry[] = [];

  // Add driver rides
  driverRides.forEach(ride => {
    const date = toDate(ride.createdAt) || toDate(ride.departureTime);
    history.push({
      id: ride.id,
      date: date || new Date(),
      from: ride.from || 'Unknown',
      to: ride.to || 'Unknown',
      role: 'driver',
      status: normalizeStatus(ride.status),
      ratingGiven: null,
      ratingReceived: ride.driverRating || ride.rating || null,
      seats: ride.totalSeats,
      passengers: (ride.totalSeats || 0) - (ride.availableSeats || 0),
      fare: ride.price || ride.fare || 0,
      distanceKm: ride.distanceKm || calculateDistance(ride.route),
      durationMinutes: Math.round((ride.distanceKm || calculateDistance(ride.route)) * 2),
    });
  });

  // Add passenger bookings
  passengerBookings.forEach(booking => {
    const date = toDate(booking.createdAt);
    history.push({
      id: booking.id,
      date: date || new Date(),
      from: 'Booking',
      to: 'Destination',
      role: 'passenger',
      status: normalizeStatus(booking.status),
      ratingGiven: booking.passengerRating || null,
      ratingReceived: booking.driverRating || null,
      seats: 1,
      fare: booking.price || 0,
    });
  });

  // Sort by date descending
  return history.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function normalizeStatus(status: string): 'completed' | 'cancelled' | 'active' | 'pending' {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'confirmed') return 'completed';
  if (s === 'cancelled' || s === 'rejected' || s === 'declined') return 'cancelled';
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
  const hasPassengerActivity = passengerBookings.length > 0;
  
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
