/**
 * Reject Ride Request API
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
  sanitizeString,
  errorResponse,
  successResponse,
  RATE_LIMITS,
} from '@/lib/api-security';
import { notifyRequestRejected } from '@/lib/serverNotificationService';

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
    const { university, rideId, requestId, reason } = body;

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

    // Sanitize reason
    const sanitizedReason = reason ? sanitizeString(reason) : 'No reason provided';

    const db = adminDb;
    const requestRef = db.doc(`universities/${validUniversity}/rides/${rideId}/requests/${requestId}`);
    const rideRef = db.doc(`universities/${validUniversity}/rides/${rideId}`);

    const result = await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(requestRef);
      if (!reqSnap.exists) {
        throw new Error('Request not found');
      }
      const request = reqSnap.data() as any;

      // ===== AUTHORIZATION: Verify authenticated user is the driver =====
      if (request.driverId !== authenticatedUserId) {
        throw new Error('FORBIDDEN: Only the ride owner can reject requests');
      }

      if (request.status !== 'PENDING') {
        throw new Error('Only PENDING requests can be rejected');
      }

      const now = admin.firestore.Timestamp.now();
      tx.update(requestRef, {
        status: 'REJECTED',
        rejectedAt: now,
        rejectionReason: sanitizedReason,
      });
      
      return { passengerId: request.passengerId };
    });

    // ===== SEND NOTIFICATION: After successful rejection =====
    try {
      // Get ride info for notification
      const rideSnap = await adminDb.doc(`universities/${validUniversity}/rides/${rideId}`).get();
      const rideData = rideSnap.data() as any;
      
      if (result.passengerId) {
        await notifyRequestRejected(
          adminDb,
          validUniversity,
          result.passengerId,
          rideId,
          requestId,
          {
            from: rideData?.pickupLocation || rideData?.from || 'Starting point',
            to: rideData?.dropoffLocation || rideData?.to || 'Destination'
          }
        );
      }
    } catch (notifError) {
      // Log notification error but don't fail the request
      console.error('[RejectRequest] Notification error (non-critical):', notifError);
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
