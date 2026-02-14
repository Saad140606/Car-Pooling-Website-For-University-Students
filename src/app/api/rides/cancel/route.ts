/**
 * Driver Ride Cancellation API
 *
 * Allows drivers to cancel an entire ride, which:
 * 1. Sets ride status to 'cancelled'
 * 2. Cancels all passenger bookings
 * 3. Notifies all affected passengers
 * 4. Tracks cancellation for abuse prevention
 *
 * SECURITY: Requires authentication and verifies user is the ride driver
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
  shouldLockAccount,
  getLockExpirationDate,
} from '@/lib/rideCancellationService';
import { notifyRideCancelled } from '@/lib/rideNotificationService';

export async function POST(req: NextRequest) {
  console.log('[API:CancelRide] Request received');
  
  // Check if Firebase Admin is initialized
  if (!adminDb) {
    console.error('[API:CancelRide] Firebase Admin not initialized');
    return errorResponse('Server configuration error', 500);
  }

  // ===== AUTHENTICATION =====
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    console.warn('[API:CancelRide] Authentication failed');
    return authResult;
  }
  const authenticatedUserId = authResult.uid;
  console.log('[API:CancelRide] Authenticated user:', authenticatedUserId);

  // ===== RATE LIMITING =====
  const rateLimitResult = await applyRateLimit(req, RATE_LIMITS.RIDE_ACTION);
  if (rateLimitResult instanceof NextResponse) {
    return rateLimitResult;
  }

  try {
    // ===== INPUT VALIDATION =====
    const body = await req.json();
    const { university, rideId, reason } = body;
    console.log('[API:CancelRide] Input:', { university, rideId, reason });

    // Validate university
    const validUniversity = validateUniversity(university);
    if (!validUniversity) {
      console.warn('[API:CancelRide] Invalid university:', university);
      return errorResponse('Invalid university parameter', 400);
    }

    // Validate ride ID
    if (!isValidDocId(rideId)) {
      console.warn('[API:CancelRide] Invalid ride ID:', rideId);
      return errorResponse('Invalid ride ID', 400);
    }

    // Sanitize reason
    const sanitizedReason = reason ? sanitizeString(reason) : 'Driver cancelled';

    const db = adminDb;
    const rideRef = db.doc(`universities/${validUniversity}/rides/${rideId}`);

    // ===== VALIDATION: Check if ride exists and hasn't departed =====
    console.log('[API:CancelRide] Fetching ride document for validation');
    const preRideSnap = await rideRef.get();
    if (!preRideSnap.exists) {
      console.warn('[API:CancelRide] Ride not found:', rideId);
      return errorResponse('Ride not found', 404);
    }
    const preRideData = preRideSnap.data() as any;
    console.log('[API:CancelRide] Ride found:', { rideId, status: preRideData.status });
    
    // Check departure time
    if (preRideData.departureTime) {
      const departureTime = preRideData.departureTime.toDate 
        ? preRideData.departureTime.toDate() 
        : new Date(preRideData.departureTime);
      if (new Date() >= departureTime) {
        console.warn('[API:CancelRide] Ride has already departed');
        return errorResponse('Cannot cancel - ride has already started', 400);
      }
    }

    // ===== VALIDATION: Check if user account is locked =====
    console.log('[API:CancelRide] Checking user account lock status');
    const userRef = db.doc(`universities/${validUniversity}/users/${authenticatedUserId}`);
    const preUserSnap = await userRef.get();
    if (preUserSnap.exists) {
      const preUserData = preUserSnap.data() as any;
      if (preUserData.accountLockUntil) {
        const lockUntil = preUserData.accountLockUntil.toDate 
          ? preUserData.accountLockUntil.toDate() 
          : new Date(preUserData.accountLockUntil);
        if (new Date() < lockUntil) {
          const minutesRemaining = Math.ceil((lockUntil.getTime() - Date.now()) / (60 * 1000));
          console.warn('[API:CancelRide] Account is locked until:', lockUntil);
          return errorResponse(
            `Your account is temporarily locked due to high cancellation rate. Please try again in ${minutesRemaining} minutes.`,
            403
          );
        }
      }
    }
    console.log('[API:CancelRide] Account lock check passed');

    console.log('[API:CancelRide] Starting transaction');
    const result = await db.runTransaction(async (tx) => {
      // ===== AUTHORIZATION: Verify authenticated user is the driver =====
      const rideSnap = await tx.get(rideRef);
      if (!rideSnap.exists()) {
        throw new Error('Ride not found');
      }

      const ride = rideSnap.data() as any;
      if (ride.driverId !== authenticatedUserId) {
        console.warn('[API:CancelRide] Driver mismatch:', { 
          rideDriver: ride.driverId, 
          authenticatedUser: authenticatedUserId 
        });
        throw new Error('FORBIDDEN: Only the driver can cancel this ride');
      }
      console.log('[API:CancelRide] Driver authorization verified');

      // ===== CHECK: Ride not already cancelled =====
      if (ride.status === 'cancelled') {
        console.warn('[API:CancelRide] Ride already cancelled');
        throw new Error('This ride has already been cancelled');
      }
      console.log('[API:CancelRide] Ride status check passed, proceeding with cancellation');

      const now = admin.firestore.Timestamp.now();

      // ===== UPDATE: Set ride status to cancelled =====
      tx.update(rideRef, {
        status: 'cancelled',
        cancelledAt: now,
        cancelledBy: authenticatedUserId,
        cancellationReason: sanitizedReason,
        updatedAt: now,
      });

      // ===== FIND AND CANCEL: All passenger bookings for this ride =====
      const bookingsQuery = db
        .collection(`universities/${validUniversity}/bookings`)
        .where('rideId', '==', rideId)
        .where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED', 'pending', 'PENDING']);

      const bookingsSnap = await tx.get(bookingsQuery as any);
      const passengersToNotify: string[] = [];
      console.log('[API:CancelRide] Found bookings/requests to cancel:', bookingsSnap.size);

      bookingsSnap.forEach((bookingDoc) => {
        const booking = bookingDoc.data() as any;
        const bookingId = bookingDoc.id;

        // Only cancel bookings that aren't already cancelled
        if (!['CANCELLED', 'cancelled', 'rejected', 'REJECTED'].includes(booking.status)) {
          tx.update(bookingDoc.ref, {
            status: 'CANCELLED',
            cancelledAt: now,
            cancelledBy: authenticatedUserId,
            cancellationReason: `Driver cancelled the ride`,
            isLateCancellation: booking.status === 'CONFIRMED',
          });

          // Track for notification
          if (booking.passengerId) {
            passengersToNotify.push(booking.passengerId);
          }
        }
      });

      // ===== FIND AND CANCEL: All ride requests for this ride =====
      const requestsQuery = db.collection(`universities/${validUniversity}/rides/${rideId}/requests`);
      const requestsSnap = await tx.get(requestsQuery as any);

      requestsSnap.forEach((requestDoc) => {
        const request = requestDoc.data() as any;
        if (!['CANCELLED', 'cancelled', 'rejected', 'REJECTED'].includes(request.status)) {
          tx.update(requestDoc.ref, {
            status: 'CANCELLED',
            cancelledAt: now,
            cancelledBy: authenticatedUserId,
            cancellationReason: `Driver cancelled the ride`,
          });

          // Track for notification if not already tracked
          if (request.passengerId && !passengersToNotify.includes(request.passengerId)) {
            passengersToNotify.push(request.passengerId);
          }
        }
      });

      // ===== TRACKING: Update driver's cancellation metrics =====
      const userRef = db.doc(`universities/${validUniversity}/users/${authenticatedUserId}`);
      const userSnap = await tx.get(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as any;
        const totalCancellations = (userData.totalCancellations ?? 0) + 1;
        const totalParticipations = userData.totalParticipations ?? 0;
        const cancellationRate = totalParticipations > 0
          ? Math.round((totalCancellations / totalParticipations) * 100)
          : 0;

        const update: any = {
          totalCancellations,
          lastCancellationAt: now,
        };

        // ===== ABUSE PREVENTION: Lock account if threshold exceeded =====
        // Threshold: > 35% cancellation rate after 3+ participations
        if (totalParticipations >= 3 && cancellationRate > 35) {
          const lockExpiration = getLockExpirationDate();
          update.accountLockUntil = admin.firestore.Timestamp.fromDate(lockExpiration);
          console.log('[DriverRideCancel] Account locked:', { userId: authenticatedUserId, cancellationRate, totalParticipations });
        }

        tx.update(userRef, update);
      }

      return {
        rideId,
        passengersAffected: passengersToNotify.length,
        passengersToNotify,
        driverName: ride.driverInfo?.fullName || 'Driver',
        rideFrom: ride.from,
        rideTo: ride.to,
      };
    });

    // ===== NOTIFICATIONS: Send to all affected passengers (after transaction) =====
    try {
      const rideSnap = await adminDb.doc(rideRef.path).get();
      const rideData = rideSnap.data() as any;
      const driverName = rideData?.driverInfo?.fullName || 'Driver';

      for (const passengerId of result.passengersToNotify) {
        try {
          await notifyRideCancelled(
            adminDb,
            validUniversity,
            passengerId,
            rideId,
            undefined,
            driverName,
            {
              from: result.rideFrom,
              to: result.rideTo,
            },
            false // isLateCancellation - driver cancelling entire ride is not "late"
          );
        } catch (notifErr) {
          console.error('[DriverRideCancel] Failed to notify passenger:', notifErr);
          // Continue notifying others
        }
      }
    } catch (notifError) {
      console.error('[DriverRideCancel] Notification batch error (non-critical):', notifError);
    }

    return successResponse({
      ok: true,
      data: {
        rideId,
        passengersAffected: result.passengersAffected,
        status: 'cancelled',
      },
    });
  } catch (e: any) {
    // Handle authorization errors with 403
    if (e.message?.includes('FORBIDDEN')) {
      return errorResponse('Access denied', 403);
    }
    if (e.message?.includes('already been cancelled')) {
      return errorResponse('This ride has already been cancelled', 400);
    }
    return errorResponse(e.message || 'Ride cancellation failed', 400);
  }
}
