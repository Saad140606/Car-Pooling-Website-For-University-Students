/**
 * Cancel Ride Request API
 * 
 * SECURITY: This endpoint requires authentication and verifies
 * that the authenticated user is either the passenger or the driver.
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
import { notifyRideCancelled } from '@/lib/rideNotificationService';

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
    const rideRef = db.doc(`universities/${validUniversity}/rides/${rideId}`);
    const requestRef = db.doc(`universities/${validUniversity}/rides/${rideId}/requests/${requestId}`);

    const result = await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(requestRef);
      if (!reqSnap.exists) {
        throw new Error('Request not found');
      }
      const request = reqSnap.data() as any;

      // ===== AUTHORIZATION: Verify authenticated user is passenger or driver =====
      const isPassenger = request.passengerId === authenticatedUserId;
      const isDriver = request.driverId === authenticatedUserId;
      
      if (!isPassenger && !isDriver) {
        throw new Error('FORBIDDEN: Only passenger or driver can cancel this request');
      }

      const status = request.status;
      if (!['PENDING', 'ACCEPTED', 'CONFIRMED'].includes(status)) {
        throw new Error('Cannot cancel request with current status');
      }

      const now = admin.firestore.Timestamp.now();
      const isLateCancellation = status === 'CONFIRMED';
      const cancellerRole = isPassenger ? 'passenger' : 'driver';

      // Update request
      tx.update(requestRef, {
        status: 'CANCELLED',
        cancelledAt: now,
        cancelledBy: authenticatedUserId,
        cancellationReason: sanitizedReason,
        isLateCancellation,
      });

      // Track late cancellations for penalties
      if (isLateCancellation) {
        const userRef = db.doc(`universities/${validUniversity}/users/${authenticatedUserId}`);
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

      return { 
        cancellerRole, 
        isLateCancellation, 
        passengerId: request.passengerId, 
        driverId: request.driverId 
      };
    });

    // ===== SEND NOTIFICATIONS: After successful cancellation =====
    try {
      // Get ride info for notification
      const rideSnap = await adminDb.doc(`universities/${validUniversity}/rides/${rideId}`).get();
      const rideData = rideSnap.data() as any;
      
      // Get canceller name
      const cancellerSnap = await adminDb.collection('users').doc(authenticatedUserId).get();
      const cancellerData = cancellerSnap.data() as any;
      const cancellerName = cancellerData?.fullName || 'User';
      
      // Determine who cancelled
      const isPassenger = result.passengerId === authenticatedUserId;
      
      // Notify the OTHER party (passenger if driver cancelled, driver if passenger cancelled)
      if (isPassenger) {
        // Passenger cancelled - notify driver
        if (result.driverId) {
          await notifyRideCancelled(
            adminDb,
            validUniversity,
            result.driverId,
            rideId,
            requestId,
            cancellerName,
            {
              from: rideData?.pickupLocation || rideData?.from || 'Starting point',
              to: rideData?.dropoffLocation || rideData?.to || 'Destination'
            },
            result.isLateCancellation
          );
        }
      } else {
        // Driver cancelled - notify passenger
        if (result.passengerId) {
          await notifyRideCancelled(
            adminDb,
            validUniversity,
            result.passengerId,
            rideId,
            requestId,
            cancellerName,
            {
              from: rideData?.pickupLocation || rideData?.from || 'Starting point',
              to: rideData?.dropoffLocation || rideData?.to || 'Destination'
            },
            result.isLateCancellation
          );
        }
      }
    } catch (notifError) {
      // Log notification error but don't fail the request
      console.error('[CancelRequest] Notification error (non-critical):', notifError);
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
