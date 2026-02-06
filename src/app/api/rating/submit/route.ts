// src/app/api/rating/submit/route.ts
// API endpoint for submitting ride ratings

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/firebase/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { POST_RIDE_CONSTANTS } from '@/lib/postRideTypes';

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
    const { bookingId, rideId, driverId, rating, university } = body;
    
    // Validate inputs
    if (!bookingId || !rideId || !driverId || rating === undefined || !university) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    if (rating < POST_RIDE_CONSTANTS.MIN_RATING || rating > POST_RIDE_CONSTANTS.MAX_RATING) {
      return NextResponse.json(
        { success: false, error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }
    
    // Verify booking exists and belongs to the user
    const bookingRef = adminDb.collection(`universities/${university}/bookings`).doc(bookingId);
    const bookingSnap = await bookingRef.get();
    
    if (!bookingSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }
    
    const booking = bookingSnap.data();
    if (booking?.passengerId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You can only rate your own bookings' },
        { status: 403 }
      );
    }
    
    // Check if already rated
    const ratingRef = adminDb.collection(`universities/${university}/ratings`).doc(bookingId);
    const existingRating = await ratingRef.get();
    
    if (existingRating.exists) {
      return NextResponse.json(
        { success: false, error: 'You have already rated this ride' },
        { status: 409 }
      );
    }
    
    // Get ride to verify departure time
    const rideRef = adminDb.collection(`universities/${university}/rides`).doc(rideId);
    const rideSnap = await rideRef.get();
    
    if (!rideSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Ride not found' },
        { status: 404 }
      );
    }
    
    const ride = rideSnap.data();
    const departureTime = ride?.departureTime?.toDate?.() || new Date(ride?.departureTime);
    const now = new Date();
    const hoursAfterDeparture = (now.getTime() - departureTime.getTime()) / (1000 * 60 * 60);
    
    // Check if ride is completed
    if (hoursAfterDeparture < POST_RIDE_CONSTANTS.COMPLETION_HOURS) {
      return NextResponse.json(
        { success: false, error: 'Ride has not been completed yet' },
        { status: 400 }
      );
    }
    
    const batch = adminDb.batch();
    const timestamp = Timestamp.now();
    const rideCompletedAt = Timestamp.fromDate(
      new Date(departureTime.getTime() + POST_RIDE_CONSTANTS.COMPLETION_HOURS * 60 * 60 * 1000)
    );
    
    // Create rating document
    batch.set(ratingRef, {
      id: bookingId,
      rideId,
      driverId,
      passengerId: userId,
      rating,
      createdAt: timestamp,
      rideCompletedAt,
    });
    
    // Update driver stats
    const driverStatsRef = adminDb.collection(`universities/${university}/driverStats`).doc(driverId);
    const driverStatsSnap = await driverStatsRef.get();
    
    if (driverStatsSnap.exists) {
      const stats = driverStatsSnap.data();
      const currentTotal = (stats?.totalRating || 0) + rating;
      const currentCount = (stats?.ratingsCount || 0) + 1;
      const newAverage = currentTotal / currentCount;
      
      batch.update(driverStatsRef, {
        totalRating: currentTotal,
        ratingsCount: currentCount,
        averageRating: newAverage,
        lastRatingAt: timestamp,
      });
    } else {
      batch.set(driverStatsRef, {
        driverId,
        totalRating: rating,
        ratingsCount: 1,
        averageRating: rating,
        lastRatingAt: timestamp,
        createdAt: timestamp,
        totalEarnings: 0,
        totalRidesCompleted: 0,
        totalPassengersServed: 0,
      });
    }
    
    // Update booking with rating
    batch.update(bookingRef, {
      driverRating: rating,
      ratedAt: timestamp,
    });
    
    await batch.commit();
    
    console.log(`[Rating API] Rating submitted: ${rating} stars for ride ${rideId} by user ${userId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Rating submitted successfully',
      rating,
    });
    
  } catch (error: any) {
    console.error('[Rating API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit rating' },
      { status: 500 }
    );
  }
}
