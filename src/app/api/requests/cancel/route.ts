import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/firebaseAdmin';
import admin from 'firebase-admin';

export async function POST(req: NextRequest) {
  if (!adminDb) return NextResponse.json({ error: 'Admin not initialized' }, { status: 500 });
  try {
    const { university, rideId, requestId, cancelledBy, reason } = await req.json();
    if (!university || !rideId || !requestId || !cancelledBy) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const db = adminDb;
    const rideRef = db.doc(`universities/${university}/rides/${rideId}`);
    const requestRef = db.doc(`universities/${university}/rides/${rideId}/requests/${requestId}`);

    const result = await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(requestRef);
      if (!reqSnap.exists) throw new Error('Request not found');
      const request = reqSnap.data() as any;

      // Check authorization
      if (cancelledBy !== request.passengerId && cancelledBy !== request.driverId) {
        throw new Error('Only passenger or driver can cancel this request');
      }

      const status = request.status;
      if (!['PENDING', 'ACCEPTED', 'CONFIRMED'].includes(status)) {
        throw new Error('Cannot cancel request with status: ' + status);
      }

      const now = admin.firestore.Timestamp.now();
      const isLateCancellation = status === 'CONFIRMED';
      const cancellerRole = cancelledBy === request.passengerId ? 'passenger' : 'driver';

      // Update request
      tx.update(requestRef, {
        status: 'CANCELLED',
        cancelledAt: now,
        cancelledBy,
        cancellationReason: reason || 'No reason provided',
        isLateCancellation,
      });

      // Track late cancellations for penalties
      if (isLateCancellation) {
        const userRef = db.doc(`universities/${university}/users/${cancelledBy}`);
        const userSnap = await tx.get(userRef);
        if (userSnap.exists) {
          const userData = userSnap.data() as any;
          const lateCancellations = (userData.lateCancellations ?? 0) + 1;
          const totalCancellations = (userData.totalCancellations ?? 0) + 1;
          
          tx.update(userRef, {
            lateCancellations,
            totalCancellations,
            lastCancellationAt: now,
          });

          // Apply cooldown if threshold exceeded
          if (lateCancellations >= 3) {
            const cooldownUntil = admin.firestore.Timestamp.fromDate(
              new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            );
            tx.update(userRef, { cooldownUntil });
          }
        }
      }

      // Release seats based on status
      const rideSnap = await tx.get(rideRef);
      if (rideSnap.exists) {
        const ride = rideSnap.data() as any;
        if (status === 'ACCEPTED') {
          // Release reserved seat
          const reserved = (ride.reservedSeats ?? 0) as number;
          tx.update(rideRef, { reservedSeats: Math.max(0, reserved - 1) });
        } else if (status === 'CONFIRMED') {
          // Return seat to available pool
          const available = (ride.availableSeats ?? 0) as number;
          tx.update(rideRef, { availableSeats: available + 1 });
        }
      }

      return { cancellerRole, isLateCancellation, passengerId: request.passengerId, driverId: request.driverId };
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 400 });
  }
}
