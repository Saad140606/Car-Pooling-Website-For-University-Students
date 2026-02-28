/**
 * Ride Lifecycle API — Transition Endpoint
 *
 * Handles ride status transitions, ride completion, and ride cancellation.
 * All mutations go through the lifecycle service for atomic, validated operations.
 *
 * POST /api/ride-lifecycle/transition
 * Body: { university, rideId, action, reason?, passengerId? }
 *
 * Actions:
 *   - complete: Driver marks ride as completed
 *   - cancel: Driver cancels entire ride
 *   - no_show: Driver marks passenger as no-show (requires passengerId)
 *   - driver_review: Driver marks passenger arrived/no-show (requires passengerId, review)
 *   - passenger_complete: Passenger confirms completion
 *   - passenger_cancel: Passenger cancels with reason (requires reason)
 */

import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { adminDb } from '@/firebase/firebaseAdmin';
import {
  requireAuth,
  applyRateLimit,
  validateUniversity,
  isValidDocId,
  errorResponse,
  successResponse,
  RATE_LIMITS,
} from '@/lib/api-security';
import {
  markRideCompleted,
  markPassengerNoShow,
  cancelRide,
  getRideLifecycleState,
  reviewPassengerArrival,
  submitPassengerCompletion,
} from '@/lib/rideLifecycle/lifecycleService';
import {
  notifyRideCompleted,
  notifyRideCancelledByDriver,
  notifyPassengerNoShow,
} from '@/lib/rideLifecycle/notifications';
import { evaluateAndApplyRoleCancellationPolicy } from '@/lib/serverRoleCancellationPolicy';

export async function POST(req: NextRequest) {
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
    const body = await req.json();
    const { university, rideId, action, reason, passengerId, review } = body;

    const validUniversity = validateUniversity(university);
    if (!validUniversity) {
      return errorResponse('Invalid university', 400);
    }

    if (!isValidDocId(rideId)) {
      return errorResponse('Invalid ride ID', 400);
    }

    const db = adminDb;

    switch (action) {
      case 'complete': {
        const result = await markRideCompleted(db, validUniversity, rideId, authenticatedUserId);

        // Send completion notifications
        try {
          const state = await getRideLifecycleState(db, validUniversity, rideId);
          if (state) {
            const passengerIds = state.confirmedPassengers.map((p) => p.userId);
            await notifyRideCompleted(
              db,
              validUniversity,
              state.driverId,
              passengerIds,
              rideId,
              state.from,
              state.to
            );
          }
        } catch (notifErr) {
          console.error('[RideLifecycle] Notification error (non-critical):', notifErr);
        }

        return successResponse({ ok: true, ...result });
      }

      case 'cancel': {
        const result = await cancelRide(db, validUniversity, rideId, authenticatedUserId, reason);
        let lockResult: Awaited<ReturnType<typeof evaluateAndApplyRoleCancellationPolicy>> | null = null;
        try {
          lockResult = await evaluateAndApplyRoleCancellationPolicy(
            db,
            validUniversity,
            authenticatedUserId,
            'driver'
          );
        } catch (policyErr) {
          console.error('[RideLifecycle] Policy evaluation error (non-critical):', policyErr);
        }

        // Send cancellation notifications
        try {
          const state = await getRideLifecycleState(db, validUniversity, rideId);
          if (state && result.affectedPassengers.length > 0) {
            await notifyRideCancelledByDriver(
              db,
              validUniversity,
              result.affectedPassengers,
              rideId,
              'Driver',
              state.from,
              state.to
            );
          }
        } catch (notifErr) {
          console.error('[RideLifecycle] Notification error (non-critical):', notifErr);
        }

        return successResponse({
          ok: true,
          ...result,
          accountLocked: Boolean(lockResult?.locked),
          message: lockResult?.locked ? lockResult.message : undefined,
          lockUntil: lockResult?.lockUntil || null,
          cancellationRate: lockResult?.cancellationRate ?? null,
          totalRidesWindow: lockResult?.totalRides ?? null,
          cancelledRidesWindow: lockResult?.cancelledRides ?? null,
        });
      }

      case 'no_show': {
        if (!passengerId || !isValidDocId(passengerId)) {
          return errorResponse('Passenger ID required for no_show action', 400);
        }

        const result = await markPassengerNoShow(
          db,
          validUniversity,
          rideId,
          authenticatedUserId,
          passengerId
        );

        // Notify passenger
        try {
          await notifyPassengerNoShow(db, validUniversity, passengerId, rideId);
        } catch (notifErr) {
          console.error('[RideLifecycle] Notification error (non-critical):', notifErr);
        }

        return successResponse({ ok: true, ...result });
      }
      
      case 'driver_review': {
        if (!passengerId || !isValidDocId(passengerId)) {
          return errorResponse('Passenger ID required for driver_review action', 400);
        }
        if (review !== 'arrived' && review !== 'no-show') {
          return errorResponse('Review must be arrived or no-show', 400);
        }

        const result = await reviewPassengerArrival(
          db,
          validUniversity,
          rideId,
          authenticatedUserId,
          passengerId,
          review
        );

        // Update booking with driver review
        try {
          const bookingSnap = await db
            .collection(`universities/${validUniversity}/bookings`)
            .where('rideId', '==', rideId)
            .where('passengerId', '==', passengerId)
            .limit(1)
            .get();
          if (!bookingSnap.empty) {
            await bookingSnap.docs[0].ref.update({
              driverReview: review,
              driverReviewAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        } catch (updateErr) {
          console.error('[RideLifecycle] Failed to update booking driver review:', updateErr);
        }

        return successResponse({ ok: true, ...result });
      }

      case 'passenger_complete': {
        const result = await submitPassengerCompletion(
          db,
          validUniversity,
          rideId,
          authenticatedUserId,
          'completed'
        );

        try {
          const bookingSnap = await db
            .collection(`universities/${validUniversity}/bookings`)
            .where('rideId', '==', rideId)
            .where('passengerId', '==', authenticatedUserId)
            .limit(1)
            .get();
          if (!bookingSnap.empty) {
            await bookingSnap.docs[0].ref.update({
              passengerCompletion: 'completed',
              passengerCompletionAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        } catch (updateErr) {
          console.error('[RideLifecycle] Failed to update booking completion:', updateErr);
        }

        return successResponse({ ok: true, ...result });
      }

      case 'passenger_cancel': {
        if (!reason || !String(reason).trim()) {
          return errorResponse('Cancellation reason required', 400);
        }

        const result = await submitPassengerCompletion(
          db,
          validUniversity,
          rideId,
          authenticatedUserId,
          'cancelled',
          reason
        );

        try {
          const bookingSnap = await db
            .collection(`universities/${validUniversity}/bookings`)
            .where('rideId', '==', rideId)
            .where('passengerId', '==', authenticatedUserId)
            .limit(1)
            .get();
          if (!bookingSnap.empty) {
            await bookingSnap.docs[0].ref.update({
              passengerCompletion: 'cancelled',
              passengerCompletionAt: admin.firestore.FieldValue.serverTimestamp(),
              completionReason: reason,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        } catch (updateErr) {
          console.error('[RideLifecycle] Failed to update booking cancellation:', updateErr);
        }

        return successResponse({ ok: true, ...result });
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (e: any) {
    if (e.message?.includes('FORBIDDEN')) {
      return errorResponse('Access denied', 403);
    }
    if (e.name === 'InvalidTransitionError') {
      return errorResponse(e.message, 409);
    }
    console.error('[RideLifecycle] Error:', e);
    return errorResponse(e.message || 'Request failed', 400);
  }
}
