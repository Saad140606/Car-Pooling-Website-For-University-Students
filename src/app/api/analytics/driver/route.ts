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
        rating: data.rating || 0,
        date: date.toISOString(),
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const stats = statsSnap.exists ? statsSnap.data() : null;
    
    // Calculate totals from actual data
    const totalEarningsFromData = earningsPerRide.reduce((sum, e) => sum + e.earnings, 0);
    const totalRatingsFromData = ratingsPerRide.reduce((sum, r) => sum + r.rating, 0);
    const ratingsCount = ratingsPerRide.length;
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
    ratingsPerRide.forEach(r => {
      const key = Math.round(r.rating) as keyof typeof ratingDistribution;
      if (key >= 1 && key <= 5) {
        ratingDistribution[key]++;
      }
    });
    
    return NextResponse.json({
      success: true,
      analytics: {
        totalEarnings: stats?.totalEarnings || totalEarningsFromData,
        totalRidesCompleted: stats?.totalRidesCompleted || earningsPerRide.length,
        totalPassengersServed: stats?.totalPassengersServed || totalPassengersFromData,
        averageRating: stats?.averageRating || averageRatingFromData,
        totalRatingsCount: stats?.ratingsCount || ratingsCount,
        earningsPerRide,
        ratingsPerRide,
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
