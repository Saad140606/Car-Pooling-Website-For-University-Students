import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/firebaseAdmin';
import admin from 'firebase-admin';

export async function POST(req: NextRequest) {
  if (!adminDb) return NextResponse.json({ error: 'Admin not initialized' }, { status: 500 });
  try {
    const { university, rideId, requestId, driverId, reason } = await req.json();
    if (!university || !rideId || !requestId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const db = adminDb;
    const requestRef = db.doc(`universities/${university}/rides/${rideId}/requests/${requestId}`);

    await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(requestRef);
      if (!reqSnap.exists) throw new Error('Request not found');
      const request = reqSnap.data() as any;

      if (driverId && request.driverId && request.driverId !== driverId) {
        throw new Error('Only the ride owner can reject requests');
      }

      if (request.status !== 'PENDING') {
        throw new Error('Only PENDING requests can be rejected');
      }

      const now = admin.firestore.Timestamp.now();
      tx.update(requestRef, {
        status: 'REJECTED',
        rejectedAt: now,
        rejectionReason: reason || 'No reason provided',
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 400 });
  }
}
