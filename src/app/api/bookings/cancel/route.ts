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
import {
  isAccountLocked,
  getLockExpirationDate,
  shouldLockAccount,
  buildCancellationTrackingUpdate,
} from '@/lib/rideCancellationService';

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
    const userRef = db.doc(`universities/${validUniversity}/users/${authenticatedUserId}`);

    // ===== PRE-TRANSACTION VALIDATION =====
    // Check ride exists and driver owns it
    const rideSnap = await db.doc(rideRef.path).get();
    if (!rideSnap.exists) {
      return errorResponse('Ride not found', 404);
    }

    const ride = rideSnap.data() as any;
    
    // Check booking exists first
    const bookingSnap = await db.doc(bookingRef.path).get();
    if (!bookingSnap.exists) {
      return errorResponse('Booking not found', 404);
    }
    const booking = bookingSnap.data() as any;
    
    // Verify authenticated user is authorized to cancel
    // - Driver can cancel if they own the ride (with isDriverCancel flag)
    // - Passenger can cancel their own booking
    if (isDriverCancel) {
      if (ride.driverId !== authenticatedUserId) {
        return errorResponse('Only the ride driver can cancel a passenger', 403);
      }
    } else {
      // For passenger cancellation, verify they own the booking
      if (booking.passengerId !== authenticatedUserId) {
        return errorResponse('You can only cancel your own bookings', 403);
      }
    }

    // ===== CHECK ACCOUNT LOCK STATUS =====
    // Check if the cancelling user's account is locked
    const lockStatus = await isAccountLocked(db, validUniversity, authenticatedUserId, isDriverCancel);
    if (lockStatus.locked) {
      const minutesRemaining = lockStatus.minutesRemaining || 0;
      return errorResponse(
        `Your account is temporarily locked due to high cancellation rate. Please try again in ${minutesRemaining} minutes.`,
        403
      );
    }

    // Check booking is in acceptable state for cancellation
    const cancelableStatuses = ['accepted', 'ACCEPTED', 'pending', 'PENDING', 'CONFIRMED', 'confirmed'];
    if (!cancelableStatuses.includes(booking.status)) {
      return errorResponse(`Cannot cancel booking with status: ${booking.status}`, 400);
    }

    // Check if ride has already departed
    if (ride.departureTime) {
      const departureTime = ride.departureTime.toDate ? ride.departureTime.toDate() : new Date(ride.departureTime);
      const now = new Date();
      if (now >= departureTime) {
        return errorResponse('Cannot cancel after ride has departed', 400);
      }
    }

    // ===== TRANSACTION: Cancel booking and update ride/user stats =====
    const result = await db.runTransaction(async (tx) => {
      // Re-fetch to ensure freshness in transaction
      const freshRideSnap = await tx.get(rideRef);
      if (!freshRideSnap.exists()) {
        throw new Error('Ride not found');
      }

      const freshBookingSnap = await tx.get(bookingRef);
      if (!freshBookingSnap.exists()) {
        throw new Error('Booking not found');
      }

      const freshBooking = freshBookingSnap.data() as any;

      // Update booking status to CANCELLED
      tx.update(bookingRef, {
        status: 'CANCELLED',
        cancelledBy: isDriverCancel ? 'driver' : 'passenger',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        cancellationReason: sanitizedReason,
      });

      // Increment ride available seats
      const freshRide = freshRideSnap.data() as any;
      const currentAvailable = freshRide.availableSeats ?? 0;

      tx.update(rideRef, {
        availableSeats: currentAvailable + 1,
        confirmedPassengers: (freshRide.confirmedPassengers || []).filter(
          (uid: string) => uid !== booking.passengerId
        ),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Track cancellation for abuse prevention
      // DRIVER CANCELLATION: Always affects cancellation rate
      // PASSENGER CANCELLATION: Only affects rate if ride was CONFIRMED
      const shouldTrackCancellation = isDriverCancel || 
        (freshBooking.status === 'CONFIRMED' || freshBooking.status === 'confirmed');

      if (shouldTrackCancellation) {
        const freshUserSnap = await tx.get(userRef);
        const userData = freshUserSnap.data() as any;

        // Build cancellation tracking update
        const trackingUpdate = buildCancellationTrackingUpdate(
          userData,
          isDriverCancel, // isDriver flag
          ride.departureTime
        );

        tx.update(userRef, {
          ...trackingUpdate,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Check if account should be locked (primarily for drivers)
        const updatedStats = { ...userData, ...trackingUpdate };
        const cancellationRate = updatedStats.cancellationRate || 0;
        const totalRides = updatedStats.totalRides || 0;
        if (shouldLockAccount(cancellationRate, totalRides)) {
          const lockExpiry = getLockExpirationDate();
          tx.update(userRef, {
            cancellationLocked: true,
            cancellationLockExpiry: lockExpiry,
          });
        }
      }

      return {
        bookingId,
        rideId,
        status: 'CANCELLED',
        cancelledBy: isDriverCancel ? 'driver' : 'passenger',
      };
    });

    return successResponse({ success: true, message: 'Booking cancelled successfully', ...result }, 200);
  } catch (err: any) {
    console.error('[Booking Cancel API] Error:', err?.message || err);

    if (err.message === 'Ride not found') {
      return errorResponse('Ride not found', 404);
    }
    if (err.message === 'Booking not found') {
      return errorResponse('Booking not found', 404);
    }

    return errorResponse(err?.message || 'Failed to cancel booking', 500);
  }
}
