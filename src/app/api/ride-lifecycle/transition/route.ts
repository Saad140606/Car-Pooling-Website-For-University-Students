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
 */

import { NextRequest, NextResponse } from 'next/server';
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
} from '@/lib/rideLifecycle/lifecycleService';
import {
  notifyRideCompleted,
  notifyRideCancelledByDriver,
  notifyPassengerNoShow,
} from '@/lib/rideLifecycle/notifications';

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
    const { university, rideId, action, reason, passengerId } = body;

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

        return successResponse({ ok: true, ...result });
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
