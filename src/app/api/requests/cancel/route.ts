/**
 * Cancel Ride Request API
 * 
 * SECURITY: This endpoint requires authentication and verifies
 * that the authenticated user is either the passenger or the driver.
 * 
 * Enhanced with:
 * - Departure time validation (cannot cancel after ride starts)
 * - Account lock detection and enforcement
 * - Comprehensive cancellation tracking
 * - Duplicate cancellation prevention
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
import { notifyRideCancelled } from '@/lib/serverNotificationService';
import { handleCancelPassenger } from '@/lib/rideLifecycle/lifecycleService';
import { evaluateAndApplyRoleCancellationPolicy } from '@/lib/serverRoleCancellationPolicy';

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
    const bookingRef = db.doc(`universities/${validUniversity}/bookings/${requestId}`);

    // ===== PRE-TRANSACTION VALIDATION: Check permissions and business rules =====
    // Step 1: Validate cancellation permission (departure time check)
    const rideSnap = await db.doc(`universities/${validUniversity}/rides/${rideId}`).get();
    if (!rideSnap.exists) {
      return errorResponse('Ride not found', 404);
    }
    const ride = rideSnap.data() as any;
    
    // Check if ride has already departed
    if (ride.departureTime) {
      const departureTime = ride.departureTime.toDate ? ride.departureTime.toDate() : ride.departureTime;
      const now = new Date();
      if (now >= departureTime) {
        return errorResponse('Cannot cancel after ride has departed', 400);
      }
    }

    const departureTime = ride.departureTime
      ? (ride.departureTime.toDate ? ride.departureTime.toDate() : new Date(ride.departureTime))
      : null;
    const isLastMinuteCancellation = !!departureTime
      && ((departureTime.getTime() - Date.now()) / (60 * 1000)) >= 0
      && ((departureTime.getTime() - Date.now()) / (60 * 1000)) <= 30;
    const rideSeats = Math.max(1, Number(ride?.seats || ride?.totalSeats || 4));

    // Step 2: Check for duplicate cancellation (idempotency)
    const userSnap = await db.doc(`universities/${validUniversity}/users/${authenticatedUserId}`).get();
    let userData: any = {};
    if (userSnap.exists) {
      userData = userSnap.data() as any;

      const reqSnap = await db.doc(`universities/${validUniversity}/rides/${rideId}/requests/${requestId}`).get();
      const bookingSnap = !reqSnap.exists ? await db.doc(`universities/${validUniversity}/bookings/${requestId}`).get() : null;
      
      if (reqSnap.exists) {
        const reqStatus = String(reqSnap.data()?.status || '').toUpperCase();
        if (reqStatus === 'CANCELLED') {
          return errorResponse('Request already cancelled', 400);
        }
      }
      if (bookingSnap?.exists) {
        const bookingStatus = String(bookingSnap.data()?.status || '').toUpperCase();
        if (bookingStatus === 'CANCELLED') {
          return errorResponse('Booking already cancelled', 400);
        }
      }
    }

    const result = await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(requestRef);
      const bookingSnap = reqSnap.exists ? null : await tx.get(bookingRef);
      if (!reqSnap.exists && !bookingSnap?.exists) {
        throw new Error('Request not found');
      }
      const request = reqSnap.exists ? (reqSnap.data() as any) : null;
      const booking = bookingSnap?.exists ? (bookingSnap.data() as any) : null;
      const effective = request || booking;

      // ===== AUTHORIZATION: Verify authenticated user is passenger or driver =====
      const isPassenger = effective.passengerId === authenticatedUserId;
      const isDriver = effective.driverId === authenticatedUserId;
      
      if (!isPassenger && !isDriver) {
        throw new Error('FORBIDDEN: Only passenger or driver can cancel this request');
      }

      const status = effective.status;
      const normalizedStatus = String(status || '').toUpperCase();
      if (!['PENDING', 'ACCEPTED', 'CONFIRMED'].includes(normalizedStatus)) {
        throw new Error('Cannot cancel request with current status');
      }

      const now = admin.firestore.Timestamp.now();
      const isLateCancellation = normalizedStatus === 'CONFIRMED';
      const cancellerRole = isPassenger ? 'passenger' : 'driver';
      const basePenaltyUnits = isLateCancellation
        ? (isPassenger ? 1 : (1 / rideSeats))
        : 0;
      const cancellationPenaltyUnits = basePenaltyUnits > 0
        ? basePenaltyUnits * (isLastMinuteCancellation ? 2 : 1)
        : 0;

      const cancellationUpdate = {
        status: 'CANCELLED',
        cancelledAt: now,
        cancelledBy: authenticatedUserId,
        cancellationReason: sanitizedReason,
        isLateCancellation,
        cancelledBeforeDeparture: true,
        lastMinuteCancellation: isLastMinuteCancellation,
        rideDepartureTime: departureTime ? admin.firestore.Timestamp.fromDate(departureTime) : null,
        cancellationPenaltyUnits: Number(cancellationPenaltyUnits.toFixed(4)),
        cancellationPenaltyApplies: cancellationPenaltyUnits > 0,
        cancellationScope: isPassenger ? 'booking_cancelled_by_passenger' : 'passenger_removal',
      };

      // Update request if it exists
      if (request) {
        tx.update(requestRef, cancellationUpdate);
      }

      // Update booking document if it exists (for analytics and user history)
      const bookingSnap2 = bookingSnap ?? await tx.get(bookingRef);
      if (bookingSnap2.exists) {
        tx.update(bookingRef, cancellationUpdate);
      }

      // Release seats based on status
      const effectiveRideId = effective.rideId || rideId;
      const rideRef = db.doc(`universities/${validUniversity}/rides/${effectiveRideId}`);
      const rideSnap = await tx.get(rideRef);
      if (rideSnap.exists) {
        const ride = rideSnap.data() as any;
        if (normalizedStatus === 'ACCEPTED') {
          // Release reserved seat
          const reserved = (ride.reservedSeats ?? 0) as number;
          tx.update(rideRef, { reservedSeats: Math.max(0, reserved - 1) });
        } else if (normalizedStatus === 'CONFIRMED') {
          // Return seat to available pool
          const available = (ride.availableSeats ?? 0) as number;
          tx.update(rideRef, { availableSeats: available + 1 });
        }
      }

      return { 
        cancellerRole, 
        isLateCancellation, 
        lastMinuteCancellation: isLastMinuteCancellation,
        cancellationPenaltyUnits: Number(cancellationPenaltyUnits.toFixed(4)),
        passengerId: effective.passengerId, 
        driverId: effective.driverId 
      };
    });

    let lockResult: Awaited<ReturnType<typeof evaluateAndApplyRoleCancellationPolicy>> | null = null;
    try {
      lockResult = await evaluateAndApplyRoleCancellationPolicy(
        db,
        validUniversity,
        authenticatedUserId,
        result.cancellerRole === 'driver' ? 'driver' : 'passenger'
      );
    } catch (policyErr) {
      console.error('[CancelRequest] Policy evaluation error (non-critical):', policyErr);
    }

    // ===== SEND NOTIFICATIONS: After successful cancellation =====
    try {
      // Get ride info for notification
      const rideSnap = await adminDb.doc(`universities/${validUniversity}/rides/${rideId}`).get();
      const rideData = rideSnap.data() as any;
      
      // Get canceller name from correct university-scoped path
      const cancellerSnap = await adminDb.doc(`universities/${validUniversity}/users/${authenticatedUserId}`).get();
      const cancellerData = cancellerSnap.data() as any;
      const cancellerName = cancellerData?.fullName || cancellerData?.name || 'User';
      
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

    // ===== UPDATE LIFECYCLE (ASYNC, non-blocking) =====
    try {
      // Call lifecycle service to sync state
      await handleCancelPassenger(
        adminDb,
        validUniversity,
        rideId,
        result.passengerId,
        'CANCELLED_BY_PASSENGER'
      );
    } catch (lifecycleErr) {
      console.warn('[CancelRequest] Lifecycle update failed (non-critical):', lifecycleErr);
    }

    return successResponse({
      ok: true,
      data: result,
      accountLocked: Boolean(lockResult?.locked),
      lockMessage: lockResult?.message,
      lockUntil: lockResult?.lockUntil || null,
      cancellationRate: lockResult?.cancellationRate ?? null,
      totalRidesWindow: lockResult?.totalRides ?? null,
      cancelledRidesWindow: lockResult?.cancelledRides ?? null,
    });
  } catch (e: any) {
    // Handle authorization errors with 403
    if (e.message?.includes('FORBIDDEN')) {
      return errorResponse('Access denied', 403);
    }
    return errorResponse(e.message || 'Request failed', 400);
  }
}
