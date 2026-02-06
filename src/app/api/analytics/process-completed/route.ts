// src/app/api/analytics/process-completed/route.ts
// API endpoint to process completed rides for earnings and spending calculations

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/firebase/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { POST_RIDE_CONSTANTS } from '@/lib/postRideTypes';

function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate();
  if (ts._seconds || ts.seconds) return new Date((ts._seconds || ts.seconds) * 1000);
  if (typeof ts === 'number') return new Date(ts);
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (authError) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    const userId = decodedToken.uid;
    
    // Parse request body
    const body = await request.json();
    const { university } = body;
    
    if (!university) {
      return NextResponse.json(
        { success: false, error: 'University parameter required' },
        { status: 400 }
      );
    }
    
    const now = new Date();
    const results = {
      earningsProcessed: 0,
      spendingProcessed: 0,
      errors: [] as string[],
    };
    
    console.log(`[ProcessCompleted API] Processing rides for user ${userId}...`);
    
    // =======================================================================
    // PROCESS DRIVER EARNINGS
    // =======================================================================
    
    // Get rides where user is driver
    const ridesRef = adminDb.collection(`universities/${university}/rides`);
    
    // Check by driverId
    const driverRidesSnap = await ridesRef.where('driverId', '==', userId).get();
    
    // Also check by createdBy (fallback)
    const createdBySnap = await ridesRef.where('createdBy', '==', userId).get();
    
    const processedRideIds = new Set<string>();
    
    const processRide = async (rideDoc: FirebaseFirestore.DocumentSnapshot) => {
      if (processedRideIds.has(rideDoc.id)) return;
      processedRideIds.add(rideDoc.id);
      
      const ride = rideDoc.data();
      if (!ride) return;
      
      const departureTime = toDate(ride.departureTime);
      if (!departureTime) return;
      
      const hoursAfterDeparture = (now.getTime() - departureTime.getTime()) / (1000 * 60 * 60);
      
      // Check if earnings should be calculated (4+ hours after departure)
      if (hoursAfterDeparture < POST_RIDE_CONSTANTS.EARNINGS_CALCULATION_HOURS) return;
      
      // Check if already calculated
      if (ride.earningsCalculated) return;
      
      // Check if earnings document exists
      const earningsRef = adminDb.collection(`universities/${university}/earnings`).doc(rideDoc.id);
      const existingEarnings = await earningsRef.get();
      
      if (existingEarnings.exists) {
        // Mark ride as calculated
        await rideDoc.ref.update({ earningsCalculated: true });
        return;
      }
      
      try {
        // Get all confirmed bookings for this ride
        const bookingsRef = adminDb.collection(`universities/${university}/bookings`);
        const bookingsSnap = await bookingsRef
          .where('rideId', '==', rideDoc.id)
          .where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED', 'confirmed'])
          .get();
        
        const bookedSeats = bookingsSnap.size;
        const pricePerSeat = ride.price || 0;
        const totalEarnings = bookedSeats * pricePerSeat;
        const passengersServed = bookingsSnap.docs.map(d => d.data().passengerId);
        
        const batch = adminDb.batch();
        const timestamp = Timestamp.now();
        const rideCompletedAt = Timestamp.fromDate(
          new Date(departureTime.getTime() + POST_RIDE_CONSTANTS.COMPLETION_HOURS * 60 * 60 * 1000)
        );
        
        const driverId = ride.driverId || ride.createdBy;
        
        // Create earnings document
        batch.set(earningsRef, {
          id: rideDoc.id,
          rideId: rideDoc.id,
          driverId,
          university,
          totalEarnings,
          bookedSeats,
          pricePerSeat,
          passengersServed,
          calculatedAt: timestamp,
          rideCompletedAt,
          from: ride.from || '',
          to: ride.to || '',
          departureTime: ride.departureTime,
        });
        
        // Update driver stats
        const driverStatsRef = adminDb.collection(`universities/${university}/driverStats`).doc(driverId);
        const driverStatsSnap = await driverStatsRef.get();
        
        if (driverStatsSnap.exists) {
          batch.update(driverStatsRef, {
            totalEarnings: FieldValue.increment(totalEarnings),
            totalRidesCompleted: FieldValue.increment(1),
            totalPassengersServed: FieldValue.increment(bookedSeats),
            lastEarningsAt: timestamp,
          });
        } else {
          batch.set(driverStatsRef, {
            driverId,
            totalEarnings,
            totalRidesCompleted: 1,
            totalPassengersServed: bookedSeats,
            totalRating: 0,
            ratingsCount: 0,
            averageRating: 0,
            lastEarningsAt: timestamp,
            createdAt: timestamp,
          });
        }
        
        // Update ride status
        batch.update(rideDoc.ref, {
          status: 'completed',
          earningsCalculated: true,
          earningsCalculatedAt: timestamp,
        });
        
        await batch.commit();
        
        console.log(`[ProcessCompleted] Earnings calculated for ride ${rideDoc.id}: ${totalEarnings} PKR`);
        results.earningsProcessed++;
      } catch (error: any) {
        console.error(`[ProcessCompleted] Error processing ride ${rideDoc.id}:`, error);
        results.errors.push(`Ride ${rideDoc.id}: ${error.message}`);
      }
    };
    
    // Process all driver rides
    for (const rideDoc of driverRidesSnap.docs) {
      await processRide(rideDoc);
    }
    
    for (const rideDoc of createdBySnap.docs) {
      await processRide(rideDoc);
    }
    
    // =======================================================================
    // PROCESS PASSENGER SPENDING
    // =======================================================================
    
    const bookingsRef = adminDb.collection(`universities/${university}/bookings`);
    const passengerBookingsSnap = await bookingsRef
      .where('passengerId', '==', userId)
      .where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED', 'confirmed'])
      .get();
    
    for (const bookingDoc of passengerBookingsSnap.docs) {
      const booking = bookingDoc.data();
      
      // Check if already calculated
      if (booking.spendingCalculated) continue;
      
      // Check if spending document exists
      const spendingRef = adminDb.collection(`universities/${university}/passengerSpending`).doc(bookingDoc.id);
      const existingSpending = await spendingRef.get();
      
      if (existingSpending.exists) {
        await bookingDoc.ref.update({ spendingCalculated: true });
        continue;
      }
      
      try {
        // Get ride data for departure time
        const rideRef = adminDb.collection(`universities/${university}/rides`).doc(booking.rideId);
        const rideSnap = await rideRef.get();
        
        if (!rideSnap.exists) continue;
        
        const ride = rideSnap.data();
        const departureTime = toDate(ride?.departureTime);
        
        if (!departureTime) continue;
        
        const hoursAfterDeparture = (now.getTime() - departureTime.getTime()) / (1000 * 60 * 60);
        
        // Check if ride is completed
        if (hoursAfterDeparture < POST_RIDE_CONSTANTS.COMPLETION_HOURS) continue;
        
        const amount = booking.price || ride?.price || 0;
        const batch = adminDb.batch();
        const timestamp = Timestamp.now();
        const rideCompletedAt = Timestamp.fromDate(
          new Date(departureTime.getTime() + POST_RIDE_CONSTANTS.COMPLETION_HOURS * 60 * 60 * 1000)
        );
        
        // Create spending document
        batch.set(spendingRef, {
          id: bookingDoc.id,
          bookingId: bookingDoc.id,
          rideId: booking.rideId,
          passengerId: booking.passengerId,
          driverId: booking.driverId || ride?.driverId || ride?.createdBy,
          amount,
          calculatedAt: timestamp,
          rideCompletedAt,
          from: ride?.from || '',
          to: ride?.to || '',
          departureTime: ride?.departureTime,
        });
        
        // Update passenger stats
        const passengerStatsRef = adminDb.collection(`universities/${university}/passengerStats`).doc(booking.passengerId);
        const passengerStatsSnap = await passengerStatsRef.get();
        
        if (passengerStatsSnap.exists) {
          batch.update(passengerStatsRef, {
            totalSpent: FieldValue.increment(amount),
            totalRidesTaken: FieldValue.increment(1),
            lastRideAt: timestamp,
          });
        } else {
          batch.set(passengerStatsRef, {
            passengerId: booking.passengerId,
            totalSpent: amount,
            totalRidesTaken: 1,
            lastRideAt: timestamp,
            createdAt: timestamp,
          });
        }
        
        // Update booking
        batch.update(bookingDoc.ref, {
          spendingCalculated: true,
          spendingCalculatedAt: timestamp,
        });
        
        await batch.commit();
        
        console.log(`[ProcessCompleted] Spending tracked for booking ${bookingDoc.id}: ${amount} PKR`);
        results.spendingProcessed++;
      } catch (error: any) {
        console.error(`[ProcessCompleted] Error processing booking ${bookingDoc.id}:`, error);
        results.errors.push(`Booking ${bookingDoc.id}: ${error.message}`);
      }
    }
    
    console.log(`[ProcessCompleted] Complete: ${results.earningsProcessed} earnings, ${results.spendingProcessed} spending`);
    
    return NextResponse.json({
      success: true,
      ...results,
    });
    
  } catch (error: any) {
    console.error('[ProcessCompleted API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process completed rides' },
      { status: 500 }
    );
  }
}
