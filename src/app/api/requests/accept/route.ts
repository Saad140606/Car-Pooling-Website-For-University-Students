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
import { notifyRequestAccepted } from '@/lib/serverNotificationService';
import { handleAcceptRequest } from '@/lib/rideLifecycle/lifecycleService';

export async function POST(req: NextRequest) {
  console.log('[API /api/requests/accept] Received request');
  console.log('[API] Headers:', {
    authorization: req.headers.get('Authorization'),
    contentType: req.headers.get('Content-Type'),
    hasAuthHeader: req.headers.has('Authorization'),
    allHeaders: Array.from(req.headers.keys())
  });
  
  // Check if Firebase Admin is initialized
  if (!adminDb) {
    console.error('[API] Firebase Admin not initialized');
    return errorResponse('Server configuration error', 500);
  }

  // ===== AUTHENTICATION =====
  console.log('[API] Checking authentication...');
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    console.error('[API] Authentication failed');
    return authResult;
  }
  const authenticatedUserId = authResult.uid;
  console.log('[API] Authenticated user:', authenticatedUserId);

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

      // ===== IDEMPOTENCY CHECK: If already ACCEPTED, return success =====
      if (request.status === 'ACCEPTED') {
        return { 
          passengerId: request.passengerId, 
          rideId, 
          timerType: request.timerType || 'short',
          idempotent: true 
        };
      }

      // Validate request status - only PENDING can be accepted
      if (request.status !== 'PENDING') {
        throw new Error('Only PENDING requests can be accepted');
      }

      const passengerId = request.passengerId;
      if (!passengerId) {
        throw new Error('Invalid request: missing passenger ID');
      }

      // Prevent accepting the same passenger more than once for the same ride
      // (e.g., duplicate request documents for one passenger).
      const duplicateAcceptedQuery = db
        .collection(`universities/${validUniversity}/rides/${rideId}/requests`)
        .where('passengerId', '==', passengerId)
        .where('status', 'in', ['ACCEPTED', 'CONFIRMED'])
        .limit(1);
      const duplicateAcceptedSnap = await tx.get(duplicateAcceptedQuery);
      if (!duplicateAcceptedSnap.empty) {
        const alreadyAcceptedDoc = duplicateAcceptedSnap.docs[0];
        if (alreadyAcceptedDoc.id !== requestId) {
          throw new Error('Passenger already has an accepted request for this ride');
        }
      }

      // NOTE: Do not run collectionGroup(passengerId + status) checks here because
      // they require a composite index that can block acceptance in production.
      // Seat safety and request idempotency are already enforced below transactionally.

      const now = admin.firestore.Timestamp.now();
      const reservedSeats = (ride.reservedSeats ?? 0) as number;
      const availableSeats = (ride.availableSeats ?? 0) as number;
      const totalSeats = (ride.totalSeats ?? 0) as number;

      // Prevent overbooking - check that we have seats to reserve
      if (availableSeats <= 0) {
        throw new Error('No seats available');
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

      // ===== ATOMIC UPDATE: Accept request and reserve seat =====
      // Only increment reservedSeats if transitioning from PENDING to ACCEPTED
      tx.update(rideRef, { 
        reservedSeats: reservedSeats + 1,
        updatedAt: now
      });
      tx.update(requestRef, {
        status: 'ACCEPTED',
        acceptedAt: now,
        confirmDeadline,
        timerType,
        confirmLater: false,
        remindersCount: 0,
        updatedAt: now
      });

      return { passengerId, rideId, timerType };
    });

    // ===== FIRE-AND-FORGET SIDE EFFECTS =====
    // Keep API response fast; these do not affect correctness of seat reservation.
    if (!result.idempotent) {
      void (async () => {
        try {
          const rideSnap = await adminDb.doc(`universities/${validUniversity}/rides/${rideId}`).get();
          const rideData = rideSnap.data() as any;

          await notifyRequestAccepted(
            adminDb,
            validUniversity,
            result.passengerId,
            rideId,
            requestId,
            {
              from: rideData?.pickupLocation || rideData?.from || 'Starting point',
              to: rideData?.dropoffLocation || rideData?.to || 'Destination',
              departureTime: rideData?.departureTime,
              driverName: rideData?.driverName || 'Driver'
            }
          );
        } catch (notifError) {
          console.error('[AcceptRequest] Notification error (non-critical):', notifError);
        }

        try {
          await handleAcceptRequest(adminDb, validUniversity, rideId, requestId, authenticatedUserId);
        } catch (lifecycleErr) {
          console.warn('[AcceptRequest] Lifecycle update failed (non-critical):', lifecycleErr);
        }
      })();
    }

    return successResponse({ ok: true, data: result });
  } catch (e: any) {
    // Handle authorization errors with 403
    if (e.message?.includes('FORBIDDEN')) {
      return errorResponse('Access denied', 403);
    }
    return errorResponse(e.message || 'Request failed', 400);
  }
}
