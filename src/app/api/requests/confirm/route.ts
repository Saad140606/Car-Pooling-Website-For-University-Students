/**
 * Confirm Ride Request API
 * 
 * SECURITY: This endpoint requires authentication and verifies
 * that the authenticated user is the passenger who owns the request.
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
      const rideSnap = await tx.get(rideRef);
      if (!rideSnap.exists) {
        throw new Error('Ride not found');
      }
      const ride = rideSnap.data() as any;

      const reqSnap = await tx.get(requestRef);
      if (!reqSnap.exists) {
        throw new Error('Request not found');
      }
      const request = reqSnap.data() as any;

      // ===== AUTHORIZATION: Verify authenticated user is the passenger =====
      if (request.passengerId !== authenticatedUserId) {
        throw new Error('FORBIDDEN: Only the passenger can confirm this request');
      }

      if (request.status !== 'ACCEPTED') {
        throw new Error('Only ACCEPTED requests can be confirmed');
      }
      
      // Check expiry with proper timestamp handling
      const now = admin.firestore.Timestamp.now();
      if (request.expiresAt) {
        const expiryTs = request.expiresAt.toMillis 
          ? request.expiresAt 
          : admin.firestore.Timestamp.fromDate(new Date(request.expiresAt));
        if (expiryTs.toMillis() < now.toMillis()) {
          throw new Error('Request expired');
        }
      }

      // Ensure passenger has no other CONFIRMED rides
      const confirmedSnap = await db.collectionGroup('requests')
        .where('passengerId', '==', authenticatedUserId)
        .where('status', '==', 'CONFIRMED')
        .limit(1)
        .get();
      
      if (!confirmedSnap.empty) {
        throw new Error('You already have a confirmed ride. Please cancel it first.');
      }

      const reservedSeats = (ride.reservedSeats ?? 0) as number;
      const availableSeats = (ride.availableSeats ?? 0) as number;
      
      if (availableSeats <= 0) {
        throw new Error('Ride is full');
      }

      tx.update(rideRef, { 
        availableSeats: availableSeats - 1, 
        reservedSeats: Math.max(0, reservedSeats - 1) 
      });
      tx.update(requestRef, { 
        status: 'CONFIRMED', 
        confirmedAt: now 
      });

      return { passenger: authenticatedUserId, tripKey: request.tripKey };
    });

    // After confirm, auto-cancel other requests for same passenger and tripKey
    const tripKey = result.tripKey;
    if (tripKey) {
      const cg = await adminDb.collectionGroup('requests')
        .where('passengerId', '==', authenticatedUserId)
        .where('tripKey', '==', tripKey)
        .get();
      const batch = adminDb.batch();
      const ridesToAdjust: Record<string, number> = {};
      
      cg.forEach((d) => {
        if (d.id === requestId && d.ref.parent.parent?.id === rideId) return;
        const data = d.data() as any;
        if (data.status === 'PENDING' || data.status === 'ACCEPTED') {
          batch.update(d.ref, { 
            status: 'AUTO_CANCELLED', 
            autoCancelledAt: admin.firestore.FieldValue.serverTimestamp() 
          });
          if (data.status === 'ACCEPTED') {
            const ridePath = d.ref.parent.parent?.path;
            if (ridePath) ridesToAdjust[ridePath] = (ridesToAdjust[ridePath] || 0) + 1;
          }
        }
      });
      
      // Release reserved seats from affected rides
      for (const [path, count] of Object.entries(ridesToAdjust)) {
        const rref = adminDb.doc(path);
        const snap = await rref.get();
        if (snap.exists) {
          const rs = (snap.data()?.reservedSeats ?? 0) as number;
          batch.update(rref, { reservedSeats: Math.max(0, rs - count) });
        }
      }
      
      await batch.commit();
    }

    return successResponse({ ok: true });
  } catch (e: any) {
    // Handle authorization errors with 403
    if (e.message?.includes('FORBIDDEN')) {
      return errorResponse('Access denied', 403);
    }
    return errorResponse(e.message || 'Request failed', 400);
  }
}
