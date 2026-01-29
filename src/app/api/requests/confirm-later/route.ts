import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/firebaseAdmin';
import admin from 'firebase-admin';

export async function POST(req: NextRequest) {
  if (!adminDb) return NextResponse.json({ error: 'Admin not initialized' }, { status: 500 });
  try {
    const { university, rideId, requestId, passengerId } = await req.json();
    if (!university || !rideId || !requestId || !passengerId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const db = adminDb;
    const requestRef = db.doc(`universities/${university}/rides/${rideId}/requests/${requestId}`);

    await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(requestRef);
      if (!reqSnap.exists) throw new Error('Request not found');
      const request = reqSnap.data() as any;

      if (request.passengerId !== passengerId) {
        throw new Error('Only the rider can confirm later');
      }

      if (request.status !== 'ACCEPTED') {
        throw new Error('Only ACCEPTED requests can be deferred');
      }

      // Pause the timer by setting confirmLater flag
      // The request stays ACCEPTED but timer is paused
      const now = admin.firestore.Timestamp.now();
      tx.update(requestRef, {
        confirmLater: true,
        confirmLaterAt: now,
      });
    });

    return NextResponse.json({ 
      ok: true, 
      message: 'You can confirm this ride later. We will remind you before pickup time.' 
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 400 });
  }
}
