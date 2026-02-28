/**
 * Ride Lifecycle API — Pending Ratings
 *
 * GET /api/ride-lifecycle/pending-ratings?university=...
 * Returns ratings the user still needs to submit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/firebase/firebaseAdmin';

function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate();
  if (ts._seconds || ts.seconds) return new Date((ts._seconds || ts.seconds) * 1000);
  if (typeof ts === 'number') return new Date(ts);
  return null;
}

function normalizeConfirmedPassengers(raw: any[]): Array<{ userId: string; driverReview?: string; passengerCompletion?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      if (typeof p === 'string') {
        return { userId: p };
      }
      if (!p || typeof p !== 'object') return null;
      return {
        userId: p.userId,
        driverReview: p.driverReview,
        passengerCompletion: p.passengerCompletion,
      };
    })
    .filter(Boolean) as Array<{ userId: string; driverReview?: string; passengerCompletion?: string }>;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (authError) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const { searchParams } = new URL(request.url);
    const university = searchParams.get('university');

    if (!university) {
      return NextResponse.json({ success: false, error: 'University parameter required' }, { status: 400 });
    }

    const pendingRatings: any[] = [];

    // Driver flow: rate passengers
    const driverRidesSnap = await adminDb
      .collection(`universities/${university}/rides`)
      .where('driverId', '==', userId)
      .where('lifecycleStatus', '==', 'COMPLETED')
      .where('ratingsOpen', '==', true)
      .limit(200)
      .get();

    for (const rideDoc of driverRidesSnap.docs) {
      const ride = rideDoc.data();
      const confirmed = normalizeConfirmedPassengers(ride.confirmedPassengers || []);
      for (const passenger of confirmed) {
        if (passenger.driverReview === 'no-show') continue;
        if (passenger.passengerCompletion !== 'completed') continue;

        const ratingId = `${rideDoc.id}_${userId}_${passenger.userId}`;
        const ratingRef = adminDb.doc(`universities/${university}/lifecycle_ratings/${ratingId}`);
        const ratingSnap = await ratingRef.get();
        if (ratingSnap.exists) continue;

        pendingRatings.push({
          rideId: rideDoc.id,
          ratedUserId: passenger.userId,
          targetName: 'Passenger',
          role: 'driver',
          from: ride.from || 'Unknown',
          to: ride.to || 'Unknown',
          departureTime: toDate(ride.departureTime)?.toISOString() || null,
          price: ride.price || 0,
        });
      }
    }

    // Passenger flow: rate driver
    const bookingsSnap = await adminDb
      .collection(`universities/${university}/bookings`)
      .where('passengerId', '==', userId)
      .where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED', 'confirmed'])
      .limit(200)
      .get();

    for (const bookingDoc of bookingsSnap.docs) {
      const booking = bookingDoc.data();
      const bookingId = bookingDoc.id;

      // Legacy compatibility: if booking already has a saved driver rating,
      // treat it as already rated and skip popup.
      if (booking.driverRating || booking.ratedAt) {
        continue;
      }

      // Legacy compatibility: old workflows store ratings under
      // universities/{university}/ratings/{bookingId}.
      const legacyRatingRef = adminDb.doc(`universities/${university}/ratings/${bookingId}`);
      const legacyRatingSnap = await legacyRatingRef.get();
      if (legacyRatingSnap.exists) {
        continue;
      }

      if (booking.passengerCompletion !== 'completed') continue;

      const rideId = booking.rideId;
      if (!rideId) continue;

      const rideSnap = await adminDb.collection(`universities/${university}/rides`).doc(rideId).get();
      if (!rideSnap.exists) continue;

      const ride = rideSnap.data();
      if (!ride || ride.lifecycleStatus !== 'COMPLETED' || ride.ratingsOpen !== true) continue;

      const ratedUserId = ride.driverId || ride.createdBy;
      if (!ratedUserId) continue;

      const ratingId = `${rideId}_${userId}_${ratedUserId}`;
      const ratingRef = adminDb.doc(`universities/${university}/lifecycle_ratings/${ratingId}`);
      const ratingSnap = await ratingRef.get();
      if (ratingSnap.exists) continue;

      pendingRatings.push({
        rideId,
        ratedUserId,
        targetName: ride.driverInfo?.fullName || 'Driver',
        role: 'passenger',
        from: ride.from || 'Unknown',
        to: ride.to || 'Unknown',
        departureTime: toDate(ride.departureTime)?.toISOString() || null,
        price: booking.price || ride.price || 0,
      });
    }

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
