// src/app/api/rating/pending/route.ts
// API endpoint to get pending ratings for a user

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/firebase/firebaseAdmin';
import { POST_RIDE_CONSTANTS } from '@/lib/postRideTypes';

function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate();
  if (ts._seconds || ts.seconds) return new Date((ts._seconds || ts.seconds) * 1000);
  if (typeof ts === 'number') return new Date(ts);
  return null;
}

export async function GET(request: NextRequest) {
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
    
    // Get university from query params
    const { searchParams } = new URL(request.url);
    const university = searchParams.get('university');
    
    if (!university) {
      return NextResponse.json(
        { success: false, error: 'University parameter required' },
        { status: 400 }
      );
    }
    
    const pendingRatings: any[] = [];
    const now = new Date();
    
    // Get all confirmed bookings for this passenger
    const bookingsRef = adminDb.collection(`universities/${university}/bookings`);
    const bookingsSnap = await bookingsRef
      .where('passengerId', '==', userId)
      .where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED', 'confirmed'])
      .get();
    
    for (const bookingDoc of bookingsSnap.docs) {
      const booking = bookingDoc.data();
      const rideId = booking.rideId;
      
      if (!rideId) continue;
      
      // Get the ride data
      const rideRef = adminDb.collection(`universities/${university}/rides`).doc(rideId);
      const rideSnap = await rideRef.get();
      
      if (!rideSnap.exists) continue;
      
      const ride = rideSnap.data();
      const departureTime = toDate(ride?.departureTime);
      
      if (!departureTime) continue;
      
      const hoursAfterDeparture = (now.getTime() - departureTime.getTime()) / (1000 * 60 * 60);
      
      // Check if ride is completed (2+ hours after departure)
      if (hoursAfterDeparture < POST_RIDE_CONSTANTS.COMPLETION_HOURS) continue;
      
      // Check if rating is still eligible (within 30 days)
      if (hoursAfterDeparture > POST_RIDE_CONSTANTS.RATING_ELIGIBLE_HOURS) continue;
      
      // Check if rating already exists
      const ratingRef = adminDb.collection(`universities/${university}/ratings`).doc(bookingDoc.id);
      const ratingSnap = await ratingRef.get();
      
      if (ratingSnap.exists) continue; // Already rated
      
      // Add to pending ratings
      const rideCompletedAt = new Date(departureTime.getTime() + POST_RIDE_CONSTANTS.COMPLETION_HOURS * 60 * 60 * 1000);
      
      pendingRatings.push({
        rideId,
        bookingId: bookingDoc.id,
        driverId: ride?.driverId || ride?.createdBy,
        driverName: ride?.driverInfo?.fullName || 'Ride Provider',
        from: ride?.from || 'Unknown',
        to: ride?.to || 'Unknown',
        departureTime: departureTime.toISOString(),
        rideCompletedAt: rideCompletedAt.toISOString(),
        price: booking.price || ride?.price || 0,
      });
    }
    
    // Sort by completion time (oldest first)
    pendingRatings.sort((a, b) => 
      new Date(a.rideCompletedAt).getTime() - new Date(b.rideCompletedAt).getTime()
    );
    
    return NextResponse.json({
      success: true,
      pendingRatings,
      count: pendingRatings.length,
    });
    
  } catch (error: any) {
    console.error('[Pending Ratings API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get pending ratings' },
      { status: 500 }
    );
  }
}
