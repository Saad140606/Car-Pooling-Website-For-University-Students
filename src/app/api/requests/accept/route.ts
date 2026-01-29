import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/firebaseAdmin';
import admin from 'firebase-admin';

export async function POST(req: NextRequest) {
  if (!adminDb) return NextResponse.json({ error: 'Admin not initialized' }, { status: 500 });
  try {
    const { university, rideId, requestId, driverId } = await req.json();
    if (!university || !rideId || !requestId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const db = adminDb;
    const rideRef = db.doc(`universities/${university}/rides/${rideId}`);
    const requestRef = db.doc(`universities/${university}/rides/${rideId}/requests/${requestId}`);

    const result = await db.runTransaction(async (tx) => {
      const rideSnap = await tx.get(rideRef);
      if (!rideSnap.exists) throw new Error('Ride not found');
      const ride = rideSnap.data() as any;
      if (driverId && ride.driverId && ride.driverId !== driverId) {
        throw new Error('Only the ride owner can accept requests');
      }

      const reqSnap = await tx.get(requestRef);
      if (!reqSnap.exists) throw new Error('Request not found');
      const request = reqSnap.data() as any;
      if (request.status && request.status !== 'PENDING') {
        throw new Error('Only PENDING requests can be accepted');
      }

      const passengerId = request.passengerId;
      if (!passengerId) throw new Error('Invalid request: missing passengerId');

      // Check rider's active request count (PENDING + ACCEPTED)
      const activeRequestsSnap = await db.collectionGroup('requests')
        .where('passengerId', '==', passengerId)
        .where('status', 'in', ['PENDING', 'ACCEPTED'])
        .get();
      
      if (activeRequestsSnap.size >= 3) {
        throw new Error('Rider has reached the maximum of 3 active requests');
      }

      const now = admin.firestore.Timestamp.now();
      const reservedSeats = (ride.reservedSeats ?? 0) as number;
      const availableSeats = (ride.availableSeats ?? 0) as number;
      const totalSeats = (ride.totalSeats ?? 0) as number;

      // Prevent overbooking: reserved + available should not exceed total
      if (availableSeats <= 0) {
        throw new Error('No seats available to reserve');
      }
      if (reservedSeats + 1 > totalSeats - availableSeats) {
        throw new Error('Cannot reserve more seats than available');
      }

      // Calculate dynamic confirmation deadline based on pickup time
      let confirmDeadline = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)); // Default 5 min
      let timerType = 'short'; // 'short', 'medium', 'none'
      
      try {
        const departureTime = ride.departureTime?.seconds 
          ? new Date(ride.departureTime.seconds * 1000)
          : (ride.departureTime ? new Date(ride.departureTime) : null);
        
        if (departureTime) {
          const now_ms = Date.now();
          const departure_ms = departureTime.getTime();
          const minutesUntilPickup = (departure_ms - now_ms) / (60 * 1000);
          
          if (minutesUntilPickup <= 0) {
            // Ride already started - no confirmation needed
            timerType = 'none';
            confirmDeadline = admin.firestore.Timestamp.now();
          } else if (minutesUntilPickup <= 120) {
            // Ride starting soon (0-2 hours) - short timer (2-3 minutes)
            timerType = 'short';
            confirmDeadline = admin.firestore.Timestamp.fromDate(new Date(now_ms + 2.5 * 60 * 1000));
          } else if (minutesUntilPickup < 360) {
            // Ride later today (2-6 hours) - medium timer (30 minutes)
            timerType = 'medium';
            confirmDeadline = admin.firestore.Timestamp.fromDate(new Date(now_ms + 30 * 60 * 1000));
          } else {
            // Ride tomorrow or far in future (6+ hours) - relaxed, no auto-expiry
            timerType = 'none';
            confirmDeadline = admin.firestore.Timestamp.fromDate(new Date(now_ms + 24 * 60 * 60 * 1000)); // 24 hours for safety
          }
        }
      } catch (e) {
        // If anything goes wrong, use default 5-minute timer
        console.error('Error calculating dynamic timer:', e);
      }

      tx.update(rideRef, { reservedSeats: reservedSeats + 1 });
      tx.update(requestRef, {
        status: 'ACCEPTED',
        acceptedAt: now,
        confirmDeadline,
        timerType,
        confirmLater: false,
        remindersCount: 0,
      });

      return { passengerId, rideId, timerType };
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 400 });
  }
}
