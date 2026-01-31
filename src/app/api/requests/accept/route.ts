/**
 * Accept Ride Request API
 * 
 * SECURITY: This endpoint requires authentication and verifies
 * that the authenticated user is the driver/owner of the ride.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/firebaseAdmin';
import admin from 'firebase-admin';
import {
  requireAuth,
  applyRateLimit,
  validateUniversity,
  isValidDocId,
  errorResponse,
  successResponse,
  RATE_LIMITS,
} from '@/lib/api-security';

export async function POST(req: NextRequest) {
  // Check if Firebase Admin is initialized
  if (!adminDb) {
    return errorResponse('Server configuration error', 500);
  }

  // ===== AUTHENTICATION =====
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const authenticatedUserId = authResult.uid;

  // ===== RATE LIMITING =====
  const rateLimitResult = await applyRateLimit(req, RATE_LIMITS.RIDE_ACTION);
  if (rateLimitResult instanceof NextResponse) {
    return rateLimitResult;
  }

  try {
    // ===== INPUT VALIDATION =====
    const body = await req.json();
    const { university, rideId, requestId } = body;

    // Validate university
    const validUniversity = validateUniversity(university);
    if (!validUniversity) {
      return errorResponse('Invalid university parameter', 400);
    }

    // Validate document IDs
    if (!isValidDocId(rideId)) {
      return errorResponse('Invalid ride ID', 400);
    }
    if (!isValidDocId(requestId)) {
      return errorResponse('Invalid request ID', 400);
    }

    const db = adminDb;
    const rideRef = db.doc(`universities/${validUniversity}/rides/${rideId}`);
    const requestRef = db.doc(`universities/${validUniversity}/rides/${rideId}/requests/${requestId}`);

    const result = await db.runTransaction(async (tx) => {
      // Get ride data
      const rideSnap = await tx.get(rideRef);
      if (!rideSnap.exists) {
        throw new Error('Ride not found');
      }
      const ride = rideSnap.data() as any;

      // ===== AUTHORIZATION: Verify authenticated user is the driver =====
      const rideDriverId = ride.driverId || ride.createdBy;
      if (rideDriverId !== authenticatedUserId) {
        throw new Error('FORBIDDEN: Only the ride owner can accept requests');
      }

      // Get request data
      const reqSnap = await tx.get(requestRef);
      if (!reqSnap.exists) {
        throw new Error('Request not found');
      }
      const request = reqSnap.data() as any;

      // Validate request status
      if (request.status && request.status !== 'PENDING') {
        throw new Error('Only PENDING requests can be accepted');
      }

      const passengerId = request.passengerId;
      if (!passengerId) {
        throw new Error('Invalid request: missing passenger ID');
      }

      // Check rider's active request count (PENDING + ACCEPTED)
      const activeRequestsSnap = await db.collectionGroup('requests')
        .where('passengerId', '==', passengerId)
        .where('status', 'in', ['PENDING', 'ACCEPTED'])
        .get();
      
      if (activeRequestsSnap.size >= 3) {
        throw new Error('Passenger has reached maximum active requests limit');
      }

      const now = admin.firestore.Timestamp.now();
      const reservedSeats = (ride.reservedSeats ?? 0) as number;
      const availableSeats = (ride.availableSeats ?? 0) as number;
      const totalSeats = (ride.totalSeats ?? 0) as number;

      // Prevent overbooking
      if (availableSeats <= 0) {
        throw new Error('No seats available');
      }
      if (reservedSeats + 1 > totalSeats - availableSeats) {
        throw new Error('Cannot reserve more seats than available');
      }

      // Calculate dynamic confirmation deadline based on pickup time
      let confirmDeadline = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 5 * 60 * 1000)
      );
      let timerType = 'short';
      
      try {
        const departureTime = ride.departureTime?.seconds 
          ? new Date(ride.departureTime.seconds * 1000)
          : (ride.departureTime ? new Date(ride.departureTime) : null);
        
        if (departureTime) {
          const nowMs = Date.now();
          const departureMs = departureTime.getTime();
          const minutesUntilPickup = (departureMs - nowMs) / (60 * 1000);
          
          if (minutesUntilPickup <= 0) {
            timerType = 'none';
            confirmDeadline = admin.firestore.Timestamp.now();
          } else if (minutesUntilPickup <= 120) {
            timerType = 'short';
            confirmDeadline = admin.firestore.Timestamp.fromDate(
              new Date(nowMs + 2.5 * 60 * 1000)
            );
          } else if (minutesUntilPickup < 360) {
            timerType = 'medium';
            confirmDeadline = admin.firestore.Timestamp.fromDate(
              new Date(nowMs + 30 * 60 * 1000)
            );
          } else {
            timerType = 'none';
            confirmDeadline = admin.firestore.Timestamp.fromDate(
              new Date(nowMs + 24 * 60 * 60 * 1000)
            );
          }
        }
      } catch (e) {
        // Use default 5-minute timer on error
      }

      // Update ride and request
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

    return successResponse({ ok: true, data: result });
  } catch (e: any) {
    // Handle authorization errors with 403
    if (e.message?.includes('FORBIDDEN')) {
      return errorResponse('Access denied', 403);
    }
    return errorResponse(e.message || 'Request failed', 400);
  }
}
