/**
 * Ride Request Notification Fallback API
 *
 * Creates a server-side notification for drivers when a passenger submits a ride request.
 * Used as a fallback when client-side notification creation fails.
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
import { notifyNewRideRequest } from '@/lib/serverNotificationService';

export async function POST(req: NextRequest) {
  if (!adminDb) {
    return errorResponse('Server configuration error', 500);
  }

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const authenticatedUserId = authResult.uid;

  const rateLimitResult = await applyRateLimit(req, RATE_LIMITS.RIDE_ACTION);
  if (rateLimitResult instanceof NextResponse) {
    return rateLimitResult;
  }

  try {
    const body = await req.json();
    const { university, rideId, driverId, passengerName, from, to, pickupPoint, dropoffPoint } = body;

    const validUniversity = validateUniversity(university);
    if (!validUniversity) {
      return errorResponse('Invalid university parameter', 400);
    }

    if (!isValidDocId(rideId) || !isValidDocId(driverId)) {
      return errorResponse('Invalid ride or driver ID', 400);
    }

    const rideRef = adminDb.doc(`universities/${validUniversity}/rides/${rideId}`);
    const rideSnap = await rideRef.get();
    if (!rideSnap.exists) {
      return errorResponse('Ride not found', 404);
    }

    const rideData = rideSnap.data() as any;
    const actualDriverId = rideData?.driverId || rideData?.createdBy;
    if (!actualDriverId || actualDriverId !== driverId) {
      return errorResponse('Driver mismatch for ride', 400);
    }

    const requestId = `${rideId}_${authenticatedUserId}`;
    const requestRef = adminDb.doc(`universities/${validUniversity}/rides/${rideId}/requests/${requestId}`);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      return errorResponse('Request not found for current user', 403);
    }

    await notifyNewRideRequest(
      adminDb,
      validUniversity,
      driverId,
      rideId,
      passengerName || 'A student',
      from || rideData?.from || rideData?.pickupLocation || 'Starting point',
      to || rideData?.to || rideData?.dropoffLocation || 'Destination',
      {
        pickupPoint: pickupPoint || rideData?.from || rideData?.pickupLocation || 'Starting point',
        dropoffPoint: dropoffPoint || rideData?.to || rideData?.dropoffLocation || 'Destination',
      }
    );

    return successResponse({ ok: true });
  } catch (error: any) {
    return errorResponse(error?.message || 'Failed to create notification', 400);
  }
}
