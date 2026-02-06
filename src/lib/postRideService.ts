// src/lib/postRideService.ts
// Service for post-ride operations: ratings, earnings calculation, and spending tracking

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  doc,
  Firestore,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import {
  RideRating,
  PendingRating,
  RideEarnings,
  PassengerSpending,
  DriverAnalyticsSummary,
  PassengerAnalyticsSummary,
  POST_RIDE_CONSTANTS,
  isRideCompleted,
  isRatingEligible,
  shouldCalculateEarnings,
  getHoursAfterDeparture,
} from './postRideTypes';

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

// ============================================================================
// PENDING RATINGS - Find rides that need rating
// ============================================================================

/**
 * Get all rides that the passenger has completed but not yet rated
 */
export async function getPendingRatingsForPassenger(
  firestore: Firestore,
  passengerId: string,
  university: string
): Promise<PendingRating[]> {
  const pendingRatings: PendingRating[] = [];
  
  try {
    // Get all confirmed bookings for this passenger
    const bookingsRef = collection(firestore, `universities/${university}/bookings`);
    const bookingsQuery = query(
      bookingsRef,
      where('passengerId', '==', passengerId),
      where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED', 'confirmed'])
    );
    
    const bookingsSnap = await getDocs(bookingsQuery);
    
    for (const bookingDoc of bookingsSnap.docs) {
      const booking = bookingDoc.data();
      const rideId = booking.rideId;
      
      if (!rideId) continue;
      
      // Get the ride data
      const rideRef = doc(firestore, `universities/${university}/rides`, rideId);
      const rideSnap = await getDoc(rideRef);
      
      if (!rideSnap.exists()) continue;
      
      const ride = rideSnap.data();
      const departureTime = toDate(ride.departureTime);
      
      if (!departureTime) continue;
      
      // Check if ride is completed (2+ hours after departure)
      if (!isRideCompleted(departureTime)) continue;
      
      // Check if rating is eligible (within rating window)
      if (!isRatingEligible(departureTime)) continue;
      
      // Check if rating already exists
      const ratingRef = doc(firestore, `universities/${university}/ratings`, bookingDoc.id);
      const ratingSnap = await getDoc(ratingRef);
      
      if (ratingSnap.exists()) continue; // Already rated
      
      // Add to pending ratings
      const rideCompletedAt = new Date(departureTime.getTime() + POST_RIDE_CONSTANTS.COMPLETION_HOURS * 60 * 60 * 1000);
      
      pendingRatings.push({
        rideId,
        bookingId: bookingDoc.id,
        driverId: ride.driverId || ride.createdBy,
        driverName: ride.driverInfo?.fullName || 'Ride Provider',
        from: ride.from || 'Unknown',
        to: ride.to || 'Unknown',
        departureTime,
        rideCompletedAt,
        ratingDueAt: rideCompletedAt,
        price: booking.price || ride.price || 0,
      });
    }
    
    // Sort by completion time (oldest first)
    pendingRatings.sort((a, b) => a.rideCompletedAt.getTime() - b.rideCompletedAt.getTime());
    
    return pendingRatings;
  } catch (error) {
    console.error('[PostRide] Error getting pending ratings:', error);
    return [];
  }
}

// ============================================================================
// SUBMIT RATING
// ============================================================================

/**
 * Submit a rating for a completed ride
 */
export async function submitRideRating(
  firestore: Firestore,
  university: string,
  bookingId: string,
  rideId: string,
  passengerId: string,
  driverId: string,
  rating: number,
  departureTime: Date
): Promise<{ success: boolean; error?: string }> {
  // Validate rating
  if (rating < POST_RIDE_CONSTANTS.MIN_RATING || rating > POST_RIDE_CONSTANTS.MAX_RATING) {
    return { success: false, error: 'Rating must be between 1 and 5' };
  }
  
  // Check if already rated
  const ratingRef = doc(firestore, `universities/${university}/ratings`, bookingId);
  const existingRating = await getDoc(ratingRef);
  
  if (existingRating.exists()) {
    return { success: false, error: 'You have already rated this ride' };
  }
  
  try {
    const batch = writeBatch(firestore);
    const now = serverTimestamp();
    const rideCompletedAt = new Date(departureTime.getTime() + POST_RIDE_CONSTANTS.COMPLETION_HOURS * 60 * 60 * 1000);
    
    // Create rating document
    const ratingData: RideRating = {
      id: bookingId,
      rideId,
      driverId,
      passengerId,
      rating,
      createdAt: now,
      rideCompletedAt: rideCompletedAt as any,
    };
    
    batch.set(ratingRef, ratingData);
    
    // Update driver's rating stats
    const driverStatsRef = doc(firestore, `universities/${university}/driverStats`, driverId);
    const driverStatsSnap = await getDoc(driverStatsRef);
    
    if (driverStatsSnap.exists()) {
      const stats = driverStatsSnap.data();
      const currentTotal = (stats.totalRating || 0) + rating;
      const currentCount = (stats.ratingsCount || 0) + 1;
      const newAverage = currentTotal / currentCount;
      
      batch.update(driverStatsRef, {
        totalRating: currentTotal,
        ratingsCount: currentCount,
        averageRating: newAverage,
        lastRatingAt: now,
      });
    } else {
      batch.set(driverStatsRef, {
        driverId,
        totalRating: rating,
        ratingsCount: 1,
        averageRating: rating,
        lastRatingAt: now,
        createdAt: now,
      });
    }
    
    // Update booking with rating
    const bookingRef = doc(firestore, `universities/${university}/bookings`, bookingId);
    batch.update(bookingRef, {
      driverRating: rating,
      ratedAt: now,
    });
    
    await batch.commit();
    
    console.log(`[PostRide] Rating submitted: ${rating} stars for ride ${rideId}`);
    return { success: true };
  } catch (error: any) {
    console.error('[PostRide] Error submitting rating:', error);
    return { success: false, error: error.message || 'Failed to submit rating' };
  }
}

// ============================================================================
// EARNINGS CALCULATION
// ============================================================================

/**
 * Calculate and store earnings for a completed ride
 */
export async function calculateRideEarnings(
  firestore: Firestore,
  university: string,
  rideId: string
): Promise<{ success: boolean; earnings?: number; error?: string }> {
  try {
    // Check if earnings already calculated
    const earningsRef = doc(firestore, `universities/${university}/earnings`, rideId);
    const existingEarnings = await getDoc(earningsRef);
    
    if (existingEarnings.exists()) {
      const data = existingEarnings.data();
      return { success: true, earnings: data.totalEarnings };
    }
    
    // Get ride data
    const rideRef = doc(firestore, `universities/${university}/rides`, rideId);
    const rideSnap = await getDoc(rideRef);
    
    if (!rideSnap.exists()) {
      return { success: false, error: 'Ride not found' };
    }
    
    const ride = rideSnap.data();
    const departureTime = toDate(ride.departureTime);
    
    if (!departureTime) {
      return { success: false, error: 'Invalid departure time' };
    }
    
    // Check if earnings should be calculated (4+ hours after departure)
    if (!shouldCalculateEarnings(departureTime)) {
      return { success: false, error: 'Too early to calculate earnings' };
    }
    
    // Get all confirmed bookings for this ride
    const bookingsRef = collection(firestore, `universities/${university}/bookings`);
    const bookingsQuery = query(
      bookingsRef,
      where('rideId', '==', rideId),
      where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED', 'confirmed'])
    );
    
    const bookingsSnap = await getDocs(bookingsQuery);
    
    const bookedSeats = bookingsSnap.size;
    const pricePerSeat = ride.price || 0;
    const totalEarnings = bookedSeats * pricePerSeat;
    const passengersServed = bookingsSnap.docs.map(d => d.data().passengerId);
    
    const batch = writeBatch(firestore);
    const now = serverTimestamp();
    const rideCompletedAt = new Date(departureTime.getTime() + POST_RIDE_CONSTANTS.COMPLETION_HOURS * 60 * 60 * 1000);
    
    // Create earnings document
    const earningsData: RideEarnings = {
      id: rideId,
      rideId,
      driverId: ride.driverId || ride.createdBy,
      university,
      totalEarnings,
      bookedSeats,
      pricePerSeat,
      passengersServed,
      calculatedAt: now,
      rideCompletedAt: rideCompletedAt as any,
      from: ride.from || '',
      to: ride.to || '',
      departureTime: ride.departureTime,
    };
    
    batch.set(earningsRef, earningsData);
    
    // Update driver stats
    const driverStatsRef = doc(firestore, `universities/${university}/driverStats`, earningsData.driverId);
    const driverStatsSnap = await getDoc(driverStatsRef);
    
    if (driverStatsSnap.exists()) {
      const stats = driverStatsSnap.data();
      const newTotalEarnings = (stats.totalEarnings || 0) + totalEarnings;
      const newCompleted = (stats.totalRidesCompleted || 0) + 1;
      const newPassengers = (stats.totalPassengersServed || 0) + bookedSeats;
      
      batch.update(driverStatsRef, {
        totalEarnings: newTotalEarnings,
        totalRidesCompleted: newCompleted,
        totalPassengersServed: newPassengers,
        lastEarningsAt: now,
      });
    } else {
      batch.set(driverStatsRef, {
        driverId: earningsData.driverId,
        totalEarnings,
        totalRidesCompleted: 1,
        totalPassengersServed: bookedSeats,
        totalRating: 0,
        ratingsCount: 0,
        averageRating: 0,
        lastEarningsAt: now,
        createdAt: now,
      });
    }
    
    // Update ride status
    batch.update(rideRef, {
      status: 'completed',
      earningsCalculated: true,
      earningsCalculatedAt: now,
    });
    
    await batch.commit();
    
    console.log(`[PostRide] Earnings calculated for ride ${rideId}: ${totalEarnings} PKR (${bookedSeats} seats × ${pricePerSeat})`);
    return { success: true, earnings: totalEarnings };
  } catch (error: any) {
    console.error('[PostRide] Error calculating earnings:', error);
    return { success: false, error: error.message || 'Failed to calculate earnings' };
  }
}

// ============================================================================
// PASSENGER SPENDING TRACKING
// ============================================================================

/**
 * Calculate and store spending for a passenger's completed ride
 */
export async function calculatePassengerSpending(
  firestore: Firestore,
  university: string,
  bookingId: string
): Promise<{ success: boolean; amount?: number; error?: string }> {
  try {
    // Check if spending already calculated
    const spendingRef = doc(firestore, `universities/${university}/passengerSpending`, bookingId);
    const existingSpending = await getDoc(spendingRef);
    
    if (existingSpending.exists()) {
      const data = existingSpending.data();
      return { success: true, amount: data.amount };
    }
    
    // Get booking data
    const bookingRef = doc(firestore, `universities/${university}/bookings`, bookingId);
    const bookingSnap = await getDoc(bookingRef);
    
    if (!bookingSnap.exists()) {
      return { success: false, error: 'Booking not found' };
    }
    
    const booking = bookingSnap.data();
    
    // Get ride data for departure time
    const rideRef = doc(firestore, `universities/${university}/rides`, booking.rideId);
    const rideSnap = await getDoc(rideRef);
    
    if (!rideSnap.exists()) {
      return { success: false, error: 'Ride not found' };
    }
    
    const ride = rideSnap.data();
    const departureTime = toDate(ride.departureTime);
    
    if (!departureTime) {
      return { success: false, error: 'Invalid departure time' };
    }
    
    // Check if ride is completed
    if (!isRideCompleted(departureTime)) {
      return { success: false, error: 'Ride not yet completed' };
    }
    
    const amount = booking.price || ride.price || 0;
    const batch = writeBatch(firestore);
    const now = serverTimestamp();
    const rideCompletedAt = new Date(departureTime.getTime() + POST_RIDE_CONSTANTS.COMPLETION_HOURS * 60 * 60 * 1000);
    
    // Create spending document
    const spendingData: PassengerSpending = {
      id: bookingId,
      bookingId,
      rideId: booking.rideId,
      passengerId: booking.passengerId,
      driverId: booking.driverId,
      amount,
      calculatedAt: now,
      rideCompletedAt: rideCompletedAt as any,
      from: ride.from || '',
      to: ride.to || '',
      departureTime: ride.departureTime,
    };
    
    batch.set(spendingRef, spendingData);
    
    // Update passenger stats
    const passengerStatsRef = doc(firestore, `universities/${university}/passengerStats`, booking.passengerId);
    const passengerStatsSnap = await getDoc(passengerStatsRef);
    
    if (passengerStatsSnap.exists()) {
      const stats = passengerStatsSnap.data();
      const newTotal = (stats.totalSpent || 0) + amount;
      const newCount = (stats.totalRidesTaken || 0) + 1;
      
      batch.update(passengerStatsRef, {
        totalSpent: newTotal,
        totalRidesTaken: newCount,
        lastRideAt: now,
      });
    } else {
      batch.set(passengerStatsRef, {
        passengerId: booking.passengerId,
        totalSpent: amount,
        totalRidesTaken: 1,
        lastRideAt: now,
        createdAt: now,
      });
    }
    
    // Update booking
    batch.update(bookingRef, {
      spendingCalculated: true,
      spendingCalculatedAt: now,
    });
    
    await batch.commit();
    
    console.log(`[PostRide] Spending tracked for booking ${bookingId}: ${amount} PKR`);
    return { success: true, amount };
  } catch (error: any) {
    console.error('[PostRide] Error tracking spending:', error);
    return { success: false, error: error.message || 'Failed to track spending' };
  }
}

// ============================================================================
// BATCH PROCESSING - Process all completed rides
// ============================================================================

/**
 * Process all completed rides for a user (both as driver and passenger)
 * This should be called when the app loads
 */
export async function processCompletedRidesForUser(
  firestore: Firestore,
  userId: string,
  university: string
): Promise<{ 
  earningsProcessed: number; 
  spendingProcessed: number; 
  errors: string[];
}> {
  const result = {
    earningsProcessed: 0,
    spendingProcessed: 0,
    errors: [] as string[],
  };
  
  try {
    console.log(`[PostRide] Processing completed rides for user ${userId}...`);
    
    // Process rides where user is driver
    const ridesRef = collection(firestore, `universities/${university}/rides`);
    const driverRidesQuery = query(
      ridesRef,
      where('driverId', '==', userId)
    );
    
    const driverRidesSnap = await getDocs(driverRidesQuery);
    
    for (const rideDoc of driverRidesSnap.docs) {
      const ride = rideDoc.data();
      const departureTime = toDate(ride.departureTime);
      
      if (!departureTime) continue;
      if (!shouldCalculateEarnings(departureTime)) continue;
      if (ride.earningsCalculated) continue;
      
      const earnings = await calculateRideEarnings(firestore, university, rideDoc.id);
      if (earnings.success) {
        result.earningsProcessed++;
      } else if (earnings.error && !earnings.error.includes('already')) {
        result.errors.push(`Earnings for ride ${rideDoc.id}: ${earnings.error}`);
      }
    }
    
    // Also check rides where user is createdBy (fallback)
    const createdByQuery = query(
      ridesRef,
      where('createdBy', '==', userId)
    );
    
    const createdBySnap = await getDocs(createdByQuery);
    
    for (const rideDoc of createdBySnap.docs) {
      const ride = rideDoc.data();
      if (ride.driverId === userId) continue; // Already processed
      
      const departureTime = toDate(ride.departureTime);
      if (!departureTime) continue;
      if (!shouldCalculateEarnings(departureTime)) continue;
      if (ride.earningsCalculated) continue;
      
      const earnings = await calculateRideEarnings(firestore, university, rideDoc.id);
      if (earnings.success) {
        result.earningsProcessed++;
      } else if (earnings.error && !earnings.error.includes('already')) {
        result.errors.push(`Earnings for ride ${rideDoc.id}: ${earnings.error}`);
      }
    }
    
    // Process bookings where user is passenger
    const bookingsRef = collection(firestore, `universities/${university}/bookings`);
    const passengerBookingsQuery = query(
      bookingsRef,
      where('passengerId', '==', userId),
      where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED', 'confirmed'])
    );
    
    const passengerBookingsSnap = await getDocs(passengerBookingsQuery);
    
    for (const bookingDoc of passengerBookingsSnap.docs) {
      const booking = bookingDoc.data();
      if (booking.spendingCalculated) continue;
      
      const spending = await calculatePassengerSpending(firestore, university, bookingDoc.id);
      if (spending.success) {
        result.spendingProcessed++;
      } else if (spending.error && !spending.error.includes('already') && !spending.error.includes('not yet')) {
        result.errors.push(`Spending for booking ${bookingDoc.id}: ${spending.error}`);
      }
    }
    
    console.log(`[PostRide] Processing complete: ${result.earningsProcessed} earnings, ${result.spendingProcessed} spending`);
    return result;
  } catch (error: any) {
    console.error('[PostRide] Error processing completed rides:', error);
    result.errors.push(error.message || 'Unknown error');
    return result;
  }
}

// ============================================================================
// GET ANALYTICS DATA
// ============================================================================

/**
 * Get driver analytics summary
 */
export async function getDriverAnalytics(
  firestore: Firestore,
  driverId: string,
  university: string
): Promise<DriverAnalyticsSummary | null> {
  try {
    // Get driver stats
    const statsRef = doc(firestore, `universities/${university}/driverStats`, driverId);
    const statsSnap = await getDoc(statsRef);
    
    // Get all earnings
    const earningsRef = collection(firestore, `universities/${university}/earnings`);
    const earningsQuery = query(earningsRef, where('driverId', '==', driverId));
    const earningsSnap = await getDocs(earningsQuery);
    
    // Get all ratings
    const ratingsRef = collection(firestore, `universities/${university}/ratings`);
    const ratingsQuery = query(ratingsRef, where('driverId', '==', driverId));
    const ratingsSnap = await getDocs(ratingsQuery);
    
    const earningsPerRide = earningsSnap.docs.map(d => {
      const data = d.data();
      const date = toDate(data.departureTime) || new Date();
      return {
        rideId: data.rideId,
        earnings: data.totalEarnings,
        date,
        from: data.from,
        to: data.to,
      };
    }).sort((a, b) => b.date.getTime() - a.date.getTime());
    
    const ratingsPerRide = ratingsSnap.docs.map(d => {
      const data = d.data();
      const date = toDate(data.createdAt) || new Date();
      return {
        rideId: data.rideId,
        rating: data.rating,
        date,
      };
    }).sort((a, b) => b.date.getTime() - a.date.getTime());
    
    let stats = statsSnap.exists() ? statsSnap.data() : null;
    
    // Calculate totals from actual data if stats don't exist
    const totalEarnings = earningsPerRide.reduce((sum, e) => sum + e.earnings, 0);
    const totalRatings = ratingsPerRide.reduce((sum, r) => sum + r.rating, 0);
    const ratingsCount = ratingsPerRide.length;
    const averageRating = ratingsCount > 0 ? totalRatings / ratingsCount : 0;
    const totalPassengers = earningsSnap.docs.reduce((sum, d) => sum + (d.data().bookedSeats || 0), 0);
    
    return {
      totalEarnings: stats?.totalEarnings || totalEarnings,
      totalRidesCompleted: stats?.totalRidesCompleted || earningsPerRide.length,
      totalPassengersServed: stats?.totalPassengersServed || totalPassengers,
      averageRating: stats?.averageRating || averageRating,
      totalRatingsCount: stats?.ratingsCount || ratingsCount,
      earningsPerRide,
      ratingsPerRide,
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error('[PostRide] Error getting driver analytics:', error);
    return null;
  }
}

/**
 * Get passenger analytics summary
 */
export async function getPassengerAnalytics(
  firestore: Firestore,
  passengerId: string,
  university: string
): Promise<PassengerAnalyticsSummary | null> {
  try {
    // Get passenger stats
    const statsRef = doc(firestore, `universities/${university}/passengerStats`, passengerId);
    const statsSnap = await getDoc(statsRef);
    
    // Get all spending records
    const spendingRef = collection(firestore, `universities/${university}/passengerSpending`);
    const spendingQuery = query(spendingRef, where('passengerId', '==', passengerId));
    const spendingSnap = await getDocs(spendingQuery);
    
    const spendingPerRide = spendingSnap.docs.map(d => {
      const data = d.data();
      const date = toDate(data.departureTime) || new Date();
      return {
        rideId: data.rideId,
        amount: data.amount,
        date,
        from: data.from,
        to: data.to,
      };
    }).sort((a, b) => b.date.getTime() - a.date.getTime());
    
    let stats = statsSnap.exists() ? statsSnap.data() : null;
    
    // Calculate totals from actual data if stats don't exist
    const totalSpent = spendingPerRide.reduce((sum, s) => sum + s.amount, 0);
    const totalRides = spendingPerRide.length;
    
    return {
      totalSpent: stats?.totalSpent || totalSpent,
      totalRidesTaken: stats?.totalRidesTaken || totalRides,
      averageSpentPerRide: totalRides > 0 ? (stats?.totalSpent || totalSpent) / totalRides : 0,
      spendingPerRide,
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error('[PostRide] Error getting passenger analytics:', error);
    return null;
  }
}
