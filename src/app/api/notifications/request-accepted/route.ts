/**
 * Request Accepted Notification Fallback API
 *
 * Creates a server-side notification for passengers when their ride request is accepted.
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
import { notifyRequestAccepted } from '@/lib/serverNotificationService';

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
    const { university, rideId, requestId, passengerId } = body;

    const validUniversity = validateUniversity(university);
    if (!validUniversity) {
      return errorResponse('Invalid university parameter', 400);
    }

    if (!isValidDocId(rideId) || !isValidDocId(requestId)) {
      return errorResponse('Invalid ride or request ID', 400);
    }

    const rideRef = adminDb.doc(`universities/${validUniversity}/rides/${rideId}`);
    const rideSnap = await rideRef.get();
    if (!rideSnap.exists) {
      return errorResponse('Ride not found', 404);
    }

    const rideData = rideSnap.data() as any;
    const rideDriverId = rideData?.driverId || rideData?.createdBy;
    if (!rideDriverId || rideDriverId !== authenticatedUserId) {
      return errorResponse('Access denied', 403);
    }

    const requestRef = adminDb.doc(`universities/${validUniversity}/rides/${rideId}/requests/${requestId}`);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      return errorResponse('Request not found', 404);
    }

    const requestData = requestSnap.data() as any;
    const targetPassengerId = passengerId || requestData?.passengerId;
    if (!targetPassengerId) {
      return errorResponse('Missing passenger ID', 400);
    }

    await notifyRequestAccepted(
      adminDb,
      validUniversity,
      targetPassengerId,
      rideId,
      requestId,
      {
        from: rideData?.pickupLocation || rideData?.from || 'Starting point',
        to: rideData?.dropoffLocation || rideData?.to || 'Destination',
        departureTime: rideData?.departureTime,
        driverName: rideData?.driverName || 'Driver',
      }
    );

    return successResponse({ ok: true });
  } catch (error: any) {
    return errorResponse(error?.message || 'Failed to create notification', 400);
  }
}
