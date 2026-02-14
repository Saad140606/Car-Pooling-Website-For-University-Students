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
import { notifyRideConfirmed } from '@/lib/rideNotificationService';
import { handleConfirmSeat } from '@/lib/rideLifecycle/lifecycleService';

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

      // ===== IDEMPOTENCY CHECK: If already CONFIRMED, return success =====
      if (request.status === 'CONFIRMED') {
        return { 
          passenger: authenticatedUserId, 
          tripKey: request.tripKey,
          idempotent: true
        };
      }

      if (request.status !== 'ACCEPTED') {
        throw new Error('Only ACCEPTED requests can be confirmed');
      }
      
      // Check expiry with proper timestamp handling
      const now = admin.firestore.Timestamp.now();
      if (request.confirmDeadline) {
        const deadlineTs = request.confirmDeadline.toMillis 
          ? request.confirmDeadline 
          : admin.firestore.Timestamp.fromDate(new Date(request.confirmDeadline));
        if (deadlineTs.toMillis() < now.toMillis()) {
          throw new Error('Request expired - confirmation window has closed');
        }
      }

      // Ensure passenger has no OTHER CONFIRMED rides
      const confirmedSnap = await db.collectionGroup('requests')
        .where('passengerId', '==', authenticatedUserId)
        .where('status', '==', 'CONFIRMED')
        .limit(1)
        .get();
      
      if (!confirmedSnap.empty) {
        // Check if the only confirmed ride is this one (idempotent case)
        const confirmedDoc = confirmedSnap.docs[0];
        if (confirmedDoc.id !== requestId) {
          throw new Error('You already have a confirmed ride. Please cancel it first.');
        }
      }

      const reservedSeats = (ride.reservedSeats ?? 0) as number;
      const availableSeats = (ride.availableSeats ?? 0) as number;
      
      // Check seats are available BEFORE confirming
      if (availableSeats <= 0) {
        throw new Error('Ride is full - no seats available');
      }

      // ===== ATOMIC UPDATE: Confirm ride and decrement available seats =====
      tx.update(rideRef, { 
        availableSeats: Math.max(0, availableSeats - 1),
        reservedSeats: Math.max(0, reservedSeats - 1),
        updatedAt: now,
        // Mark ride as full if no seats left
        ...(availableSeats - 1 === 0 && { status: 'full' })
      });
      
      tx.update(requestRef, { 
        status: 'CONFIRMED', 
        confirmedAt: now,
        updatedAt: now
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

    // ===== SEND NOTIFICATION: After successful confirmation =====
    try {
      if (!result.idempotent) {  // Only send notification on first confirm
        // Get ride and passenger info for notification
        const rideSnap = await adminDb.doc(`universities/${validUniversity}/rides/${rideId}`).get();
        const requestSnap = await adminDb.doc(`universities/${validUniversity}/rides/${rideId}/requests/${requestId}`).get();
        const rideData = rideSnap.data() as any;
        const requestData = requestSnap.data() as any;
        
        // Get passenger info for notification
        const passengerRef = await adminDb.collection('users').doc(authenticatedUserId).get();
        const passengerData = passengerRef.data() as any;
        
        await notifyRideConfirmed(
          adminDb,
          validUniversity,
          rideData?.driverId,
          rideId,
          requestId,
          {
            uid: authenticatedUserId,
            fullName: passengerData?.fullName || 'Passenger',
            email: passengerData?.email
          },
          {
            from: rideData?.pickupLocation || rideData?.from || 'Starting point',
            to: rideData?.dropoffLocation || rideData?.to || 'Destination'
          }
        );
      }
    } catch (notifError) {
      // Log notification error but don't fail the request
      console.error('[ConfirmRequest] Notification error (non-critical):', notifError);
    }

    // ===== UPDATE LIFECYCLE (ASYNC, non-blocking) =====
    try {
      if (!result.idempotent) {
        // Call lifecycle service to sync state
        await handleConfirmSeat(adminDb, validUniversity, rideId, requestId, authenticatedUserId);
      }
    } catch (lifecycleErr) {
      console.warn('[ConfirmRequest] Lifecycle update failed (non-critical):', lifecycleErr);
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
