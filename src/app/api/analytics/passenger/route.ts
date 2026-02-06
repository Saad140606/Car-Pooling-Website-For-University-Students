// src/app/api/analytics/passenger/route.ts
// API endpoint to get passenger analytics (spending)

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
    
    // Get passenger stats
    const statsRef = adminDb.collection(`universities/${university}/passengerStats`).doc(userId);
    const statsSnap = await statsRef.get();
    
    // Get all spending records
    const spendingRef = adminDb.collection(`universities/${university}/passengerSpending`);
    const spendingSnap = await spendingRef.where('passengerId', '==', userId).get();
    
    // Process spending per ride
    const spendingPerRide = spendingSnap.docs.map(d => {
      const data = d.data();
      const date = toDate(data.departureTime) || new Date();
      return {
        rideId: data.rideId,
        bookingId: data.bookingId,
        amount: data.amount || 0,
        date: date.toISOString(),
        from: data.from || '',
        to: data.to || '',
        driverId: data.driverId || '',
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const stats = statsSnap.exists ? statsSnap.data() : null;
    
    // Calculate totals from actual data
    const totalSpentFromData = spendingPerRide.reduce((sum, s) => sum + s.amount, 0);
    const totalRidesFromData = spendingPerRide.length;
    
    // Calculate monthly spending
    const monthlySpending: { [key: string]: number } = {};
    spendingPerRide.forEach(s => {
      const monthKey = new Date(s.date).toISOString().slice(0, 7); // YYYY-MM
      monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + s.amount;
    });
    
    // Calculate spending by route
    const spendingByRoute: { [key: string]: { count: number; total: number } } = {};
    spendingPerRide.forEach(s => {
      const routeKey = `${s.from} → ${s.to}`;
      if (!spendingByRoute[routeKey]) {
        spendingByRoute[routeKey] = { count: 0, total: 0 };
      }
      spendingByRoute[routeKey].count++;
      spendingByRoute[routeKey].total += s.amount;
    });
    
    // Get top routes
    const topRoutes = Object.entries(spendingByRoute)
      .map(([route, data]) => ({ route, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return NextResponse.json({
      success: true,
      analytics: {
        totalSpent: stats?.totalSpent || totalSpentFromData,
        totalRidesTaken: stats?.totalRidesTaken || totalRidesFromData,
        averageSpentPerRide: totalRidesFromData > 0 ? (stats?.totalSpent || totalSpentFromData) / totalRidesFromData : 0,
        spendingPerRide,
        monthlySpending,
        topRoutes,
        lastUpdated: new Date().toISOString(),
      },
    });
    
  } catch (error: any) {
    console.error('[Passenger Analytics API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get passenger analytics' },
      { status: 500 }
    );
  }
}
