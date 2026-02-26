// src/app/api/analytics/driver/route.ts
// API endpoint to get driver analytics (earnings + ratings)

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
    
    // Get driver stats
    const statsRef = adminDb.collection(`universities/${university}/driverStats`).doc(userId);
    const statsSnap = await statsRef.get();
    
    // Get all earnings
    const earningsRef = adminDb.collection(`universities/${university}/earnings`);
    const earningsSnap = await earningsRef.where('driverId', '==', userId).get();
    
    // Get all ratings
    const ratingsRef = adminDb.collection(`universities/${university}/ratings`);
    const ratingsSnap = await ratingsRef.where('driverId', '==', userId).get();

    // Get ride completions for this driver's rides (source-of-truth fallback for passenger ratings)
    const ridesRef = adminDb.collection(`universities/${university}/rides`);
    const [driverRidesSnap, createdByRidesSnap] = await Promise.all([
      ridesRef.where('driverId', '==', userId).get(),
      ridesRef.where('createdBy', '==', userId).get(),
    ]);
    const driverRideIds = new Set<string>([
      ...driverRidesSnap.docs.map((d) => d.id),
      ...createdByRidesSnap.docs.map((d) => d.id),
    ]);
    
    // Process earnings per ride
    const earningsPerRide = earningsSnap.docs.map(d => {
      const data = d.data();
      const date = toDate(data.departureTime) || new Date();
      return {
        rideId: data.rideId,
        earnings: data.totalEarnings || 0,
        date: date.toISOString(),
        from: data.from || '',
        to: data.to || '',
        bookedSeats: data.bookedSeats || 0,
        pricePerSeat: data.pricePerSeat || 0,
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Process ratings per ride
    const ratingsPerRide = ratingsSnap.docs.map(d => {
      const data = d.data();
      const date = toDate(data.createdAt) || new Date();
      return {
        rideId: data.rideId,
        passengerId: data.passengerId || '',
        rating: data.rating || 0,
        date: date.toISOString(),
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Add ratings from rideCompletions passengerWorkflows when ratings collection is missing/incomplete
    const ratingsByKey = new Map<string, { rideId: string; passengerId: string; rating: number; date: string }>();

    ratingsPerRide.forEach((rating) => {
      const key = `${rating.rideId}__${rating.passengerId || 'unknown'}`;
      ratingsByKey.set(key, rating);
    });

    const completionReads = await Promise.all(
      Array.from(driverRideIds).map((rideId) =>
        adminDb.collection(`universities/${university}/rideCompletions`).doc(rideId).get()
      )
    );

    completionReads.forEach((completionSnap) => {
      if (!completionSnap.exists) return;

      const completionData = completionSnap.data() || {};
      const rideId = String(completionData.rideId || completionSnap.id);
      const passengerWorkflows = completionData.passengerWorkflows || {};

      Object.entries(passengerWorkflows).forEach(([passengerId, workflowAny]) => {
        const workflow = workflowAny as any;
        const rating = Number(workflow?.providerRating || 0);
        if (!rating || rating < 1 || rating > 5) return;

        const completedAt = toDate(workflow?.completedAt) || toDate(completionData.providerCompletedAt) || new Date();
        const key = `${rideId}__${passengerId}`;

        if (!ratingsByKey.has(key)) {
          ratingsByKey.set(key, {
            rideId,
            passengerId,
            rating,
            date: completedAt.toISOString(),
          });
        }
      });
    });

    const mergedRatingsPerRide = Array.from(ratingsByKey.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const stats = statsSnap.exists ? statsSnap.data() : null;
    
    // Calculate totals from actual data
    const totalEarningsFromData = earningsPerRide.reduce((sum, e) => sum + e.earnings, 0);
    const totalRatingsFromData = mergedRatingsPerRide.reduce((sum, r) => sum + r.rating, 0);
    const ratingsCount = mergedRatingsPerRide.length;
    const averageRatingFromData = ratingsCount > 0 ? totalRatingsFromData / ratingsCount : 0;
    const totalPassengersFromData = earningsSnap.docs.reduce((sum, d) => sum + (d.data().bookedSeats || 0), 0);
    
    // Calculate monthly earnings
    const monthlyEarnings: { [key: string]: number } = {};
    earningsPerRide.forEach(e => {
      const monthKey = new Date(e.date).toISOString().slice(0, 7); // YYYY-MM
      monthlyEarnings[monthKey] = (monthlyEarnings[monthKey] || 0) + e.earnings;
    });
    
    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    mergedRatingsPerRide.forEach(r => {
      const key = Math.round(r.rating) as keyof typeof ratingDistribution;
      if (key >= 1 && key <= 5) {
        ratingDistribution[key]++;
      }
    });

    const resolvedAverageRating = ratingsCount > 0 ? averageRatingFromData : (stats?.averageRating || 0);
    const resolvedRatingsCount = ratingsCount > 0 ? ratingsCount : (stats?.ratingsCount || 0);
    
    return NextResponse.json({
      success: true,
      analytics: {
        totalEarnings: stats?.totalEarnings || totalEarningsFromData,
        totalRidesCompleted: stats?.totalRidesCompleted || earningsPerRide.length,
        totalPassengersServed: stats?.totalPassengersServed || totalPassengersFromData,
        averageRating: resolvedAverageRating,
        totalRatingsCount: resolvedRatingsCount,
        earningsPerRide,
        ratingsPerRide: mergedRatingsPerRide,
        monthlyEarnings,
        ratingDistribution,
        lastUpdated: new Date().toISOString(),
      },
    });
    
  } catch (error: any) {
    console.error('[Driver Analytics API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get driver analytics' },
      { status: 500 }
    );
  }
}
