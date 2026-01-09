import admin from '@/firebase/firebaseAdmin';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const COOKIE_NAME = 'admin_session';
const SECRET = process.env.ADMIN_SESSION_SECRET || '';

function verifyToken(token: string) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  } catch (e) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    const token = m ? decodeURIComponent(m[1]) : '';
    const payload = verifyToken(token);
    if (!payload) {
      console.warn('[admin/stats] missing/invalid session token');
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // verify admin existence server-side
    try {
      const snap = await admin.firestore().doc(`admins/${payload.uid}`).get();
      if (!snap.exists) {
        console.warn('[admin/stats] admin doc missing for uid', payload.uid);
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
    } catch (e) {
      console.error('[admin/stats] admin existence check failed', e);
      return NextResponse.json({ error: 'server error' }, { status: 500 });
    }

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
