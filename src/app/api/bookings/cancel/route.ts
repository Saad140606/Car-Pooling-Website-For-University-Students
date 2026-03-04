/**
 * Booking Cancellation API
 *
 * Allows drivers or passengers to cancel a booking.
 * 
 * SECURITY: Requires authentication and verifies user is the ride driver or passenger
 *
 * Cancellation Rules:
 * - Driver cancels: Always affects cancellation rate
 * - Passenger cancels before confirming: No penalty (status is 'accepted')
 * - Passenger cancels after confirming: Affects cancellation rate (status is 'CONFIRMED')
 * 
 * When cancellation occurs:
 * 1. Booking status is updated to 'CANCELLED'
 * 2. Ride available seats are incremented
 * 3. Cancellation count is tracked (if applicable)
 * 4. Other party is notified
 * 5. Cancellation rate may trigger account lock
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
    const { university, rideId, bookingId, reason, isDriverCancel } = body;

    // Validate university
    const validUniversity = validateUniversity(university);
    if (!validUniversity) {
      return errorResponse('Invalid university parameter', 400);
    }

    // Validate IDs
    if (!isValidDocId(rideId)) {
      return errorResponse('Invalid ride ID', 400);
    }
    if (!isValidDocId(bookingId)) {
      return errorResponse('Invalid booking ID', 400);
    }

    // Sanitize reason
    const sanitizedReason = reason ? sanitizeString(reason) : 'Driver cancelled booking';

    const db = adminDb;
    const rideRef = db.doc(`universities/${validUniversity}/rides/${rideId}`);
    const bookingRef = db.doc(`universities/${validUniversity}/bookings/${bookingId}`);
    const requestRef = db.doc(`universities/${validUniversity}/rides/${rideId}/requests/${bookingId}`);
    const userRef = db.doc(`universities/${validUniversity}/users/${authenticatedUserId}`);

    // ===== PRE-TRANSACTION VALIDATION =====
    // Check ride exists and driver owns it
    const rideSnap = await db.doc(rideRef.path).get();
    if (!rideSnap.exists) {
      return errorResponse('Ride not found', 404);
    }

    const ride = rideSnap.data() as any;
    
    // Check booking/request exists first
    const bookingSnap = await db.doc(bookingRef.path).get();
    const requestSnap = await db.doc(requestRef.path).get();
    if (!bookingSnap.exists && !requestSnap.exists) {
      return errorResponse('Booking or request not found', 404);
    }
    const booking = bookingSnap.exists ? (bookingSnap.data() as any) : null;
    const request = requestSnap.exists ? (requestSnap.data() as any) : null;
    const effective = booking || request;
    
    // Verify authenticated user is authorized to cancel
    // - Driver can cancel if they own the ride (with isDriverCancel flag)
    // - Passenger can cancel their own booking
    if (isDriverCancel) {
      if (ride.driverId !== authenticatedUserId) {
        return errorResponse('Only the ride driver can cancel a passenger', 403);
      }
    } else {
      // For passenger cancellation, verify they own the booking
      if (effective?.passengerId !== authenticatedUserId) {
        return errorResponse('You can only cancel your own bookings', 403);
      }
    }

    const preUserSnap = await db.doc(userRef.path).get();

    // Check booking is in acceptable state for cancellation
    const cancelableStatuses = ['accepted', 'ACCEPTED', 'pending', 'PENDING', 'CONFIRMED', 'confirmed'];
    if (!cancelableStatuses.includes(effective?.status)) {
      return errorResponse(`Cannot cancel booking/request with status: ${effective?.status}`, 400);
    }

    // Check if ride has already departed
    if (ride.departureTime) {
      const departureTime = ride.departureTime.toDate ? ride.departureTime.toDate() : new Date(ride.departureTime);
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

    // ===== TRANSACTION: Cancel booking and update ride/user stats =====
    const result = await db.runTransaction(async (tx) => {
      // Re-fetch to ensure freshness in transaction
      const freshRideSnap = await tx.get(rideRef);
      if (!freshRideSnap.exists) {
        throw new Error('Ride not found');
      }

      const freshBookingSnap = await tx.get(bookingRef);
      const freshRequestSnap = await tx.get(requestRef);
      const freshUserSnap = await tx.get(userRef);
      if (!freshBookingSnap.exists && !freshRequestSnap.exists) {
        throw new Error('Booking or request not found');
      }

      const freshBooking = freshBookingSnap.exists ? (freshBookingSnap.data() as any) : null;
      const freshRequest = freshRequestSnap.exists ? (freshRequestSnap.data() as any) : null;
      const freshEffective = freshBooking || freshRequest;

      const cancellationPayload = {
        status: 'CANCELLED',
        cancelledBy: isDriverCancel ? 'driver' : 'passenger',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        cancellationReason: sanitizedReason,
        cancelledBeforeDeparture: true,
      };

      // Release seat reservation/confirmation based on status
      const freshRide = freshRideSnap.data() as any;
      const currentAvailable = freshRide.availableSeats ?? 0;
      const currentReserved = freshRide.reservedSeats ?? 0;
      const normalizedStatus = String(freshEffective?.status || '').toUpperCase();
      const passengerId = freshEffective?.passengerId;
      const wasConfirmed = normalizedStatus === 'CONFIRMED';
      const totalSeats = Math.max(1, Number(freshRide?.seats || freshRide?.totalSeats || 4));
      const basePenaltyUnits = wasConfirmed
        ? (isDriverCancel ? (1 / totalSeats) : 1)
        : 0;
      const cancellationPenaltyUnits = basePenaltyUnits > 0
        ? basePenaltyUnits * (isLastMinuteCancellation ? 2 : 1)
        : 0;

      const enrichedCancellationPayload = {
        ...cancellationPayload,
        isLateCancellation: wasConfirmed,
        lastMinuteCancellation: isLastMinuteCancellation,
        rideDepartureTime: departureTime ? admin.firestore.Timestamp.fromDate(departureTime) : null,
        cancellationPenaltyUnits: Number(cancellationPenaltyUnits.toFixed(4)),
        cancellationPenaltyApplies: cancellationPenaltyUnits > 0,
        cancellationScope: isDriverCancel ? 'passenger_removal' : 'booking_cancelled_by_passenger',
      };

      if (normalizedStatus === 'CONFIRMED') {
        tx.update(rideRef, {
          availableSeats: currentAvailable + 1,
          confirmedPassengers: (freshRide.confirmedPassengers || []).filter(
            (uid: string) => uid !== passengerId
          ),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else if (normalizedStatus === 'ACCEPTED') {
        tx.update(rideRef, {
          reservedSeats: Math.max(0, currentReserved - 1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (freshBookingSnap.exists) {
        tx.update(bookingRef, enrichedCancellationPayload);
      }
      if (freshRequestSnap.exists) {
        tx.update(requestRef, enrichedCancellationPayload);
      }

      // Keep lightweight history fields for backward compatibility.
      const userData = freshUserSnap.data() as any;
      tx.update(userRef, {
        totalCancellations: (userData?.totalCancellations ?? 0) + (cancellationPenaltyUnits > 0 ? 1 : 0),
        lateCancellations: cancellationPenaltyUnits > 0 && wasConfirmed
          ? (userData?.lateCancellations ?? 0) + 1
          : (userData?.lateCancellations ?? 0),
        lastCancellationAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        bookingId,
        rideId,
        status: 'CANCELLED',
        cancelledBy: isDriverCancel ? 'driver' : 'passenger',
        passengerId: freshEffective?.passengerId || null,
        driverId: freshRide?.driverId || null,
        isLateCancellation: normalizedStatus === 'CONFIRMED',
        lastMinuteCancellation: isLastMinuteCancellation,
        cancellationPenaltyUnits: Number(cancellationPenaltyUnits.toFixed(4)),
      };
    });

    let lockResult: Awaited<ReturnType<typeof evaluateAndApplyRoleCancellationPolicy>> | null = null;
    try {
      lockResult = await evaluateAndApplyRoleCancellationPolicy(
        db,
        validUniversity,
        authenticatedUserId,
        isDriverCancel ? 'driver' : 'passenger'
      );
    } catch (policyErr) {
      console.error('[BookingCancel] Policy evaluation error (non-critical):', policyErr);
    }

    try {
      const cancellerSnap = await db.doc(`universities/${validUniversity}/users/${authenticatedUserId}`).get();
      const cancellerData = cancellerSnap.exists ? (cancellerSnap.data() as any) : null;
      const cancellerName =
        cancellerData?.fullName ||
        cancellerData?.name ||
        (isDriverCancel ? 'Driver' : 'Passenger');

      const targetUserId = isDriverCancel ? result.passengerId : result.driverId;
      if (targetUserId) {
        await notifyRideCancelled(
          db,
          validUniversity,
          targetUserId,
          rideId,
          bookingId,
          cancellerName,
          {
            from: ride?.pickupLocation || ride?.from || 'Starting point',
            to: ride?.dropoffLocation || ride?.to || 'Destination',
          },
          Boolean(result.isLateCancellation)
        );
      }
    } catch (notifErr) {
      console.error('[BookingCancel] Notification error (non-critical):', notifErr);
    }

    return successResponse({
      success: true,
      message: lockResult?.locked ? (lockResult.message || 'Booking cancelled successfully') : 'Booking cancelled successfully',
      ...result,
      accountLocked: Boolean(lockResult?.locked),
      lockUntil: lockResult?.lockUntil || null,
      cancellationRate: lockResult?.cancellationRate ?? null,
      totalRidesWindow: lockResult?.totalRides ?? null,
      cancelledRidesWindow: lockResult?.cancelledRides ?? null,
    }, 200);
  } catch (err: any) {
    console.error('[Booking Cancel API] Error:', err?.message || err);

    if (err.message === 'Ride not found') {
      return errorResponse('Ride not found', 404);
    }
    if (err.message === 'Booking not found' || err.message === 'Booking or request not found') {
      return errorResponse('Booking or request not found', 404);
    }

    return errorResponse(err?.message || 'Failed to cancel booking', 500);
  }
}
