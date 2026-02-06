import admin from '@/firebase/firebaseAdmin';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminApiAuth';

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const db = admin.firestore();
    // Aggregations (production: use count() aggregation if available)
    const usersSnap = await db.collection('users').get();
    const ridesSnap = await db.collectionGroup('rides').get().catch(async () => {
      // if rides are top-level
      const s = await db.collection('rides').get().catch(() => null);
      return s;
    });
    const bookingsSnap = await db.collection('bookings').get().catch(() => null);

    // Payments sum if exists
    let totalRevenue = 0;
    const paymentsRef = db.collection('payments');
    const paymentsSnap = await paymentsRef.get().catch(() => null);
    if (paymentsSnap) {
      paymentsSnap.forEach(p => { const v = p.data().amount; if (typeof v === 'number') totalRevenue += v; });
    }

    const result = {
      totalUsers: usersSnap ? usersSnap.size : 0,
      totalRides: ridesSnap ? ridesSnap.size : 0,
      totalBookings: bookingsSnap ? bookingsSnap.size : 0,
      totalRevenue,
    };
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('admin stats error', e);
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
