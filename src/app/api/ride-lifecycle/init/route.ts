/**
 * Ride Lifecycle API — Initialize Endpoint
 *
 * POST /api/ride-lifecycle/init
 * Body: { university, rideId }
 *
 * Called after ride creation to initialize lifecycle state machine fields.
 * Sets status to OPEN and creates the transition log.
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
import { initializeRideLifecycle } from '@/lib/rideLifecycle/lifecycleService';

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
    const { university, rideId } = body;

    const validUniversity = validateUniversity(university);
    if (!validUniversity) {
      return errorResponse('Invalid university', 400);
    }

    if (!isValidDocId(rideId)) {
      return errorResponse('Invalid ride ID', 400);
    }

    // Verify the authenticated user is the ride owner
    const db = adminDb;
    const rideSnap = await db.doc(`universities/${validUniversity}/rides/${rideId}`).get();
    if (!rideSnap.exists) {
      return errorResponse('Ride not found', 404);
    }

    const rideData = rideSnap.data() as any;
    const rideDriver = rideData.driverId || rideData.createdBy;
    if (rideDriver !== authenticatedUserId) {
      return errorResponse('Only the ride owner can initialize lifecycle', 403);
    }

    await initializeRideLifecycle(db, validUniversity, rideId, authenticatedUserId);

    return successResponse({ ok: true, status: 'OPEN' });
  } catch (e: any) {
    console.error('[RideLifecycle Init] Error:', e);
    return errorResponse(e.message || 'Initialization failed', 400);
  }
}
