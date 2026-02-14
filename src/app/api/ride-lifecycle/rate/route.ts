/**
 * Ride Lifecycle API — Rating Endpoint
 *
 * POST /api/ride-lifecycle/rate
 * Body: { university, rideId, ratedUserId, rating }
 *
 * Server-side validation:
 * - Only confirmed participants can rate
 * - Rating must be 1-5
 * - No duplicate ratings
 * - Anonymous (only aggregate scores exposed)
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
import { submitRating, getRideLifecycleState } from '@/lib/rideLifecycle/lifecycleService';

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
    const { university, rideId, ratedUserId, rating } = body;

    const validUniversity = validateUniversity(university);
    if (!validUniversity) {
      return errorResponse('Invalid university', 400);
    }

    if (!isValidDocId(rideId)) {
      return errorResponse('Invalid ride ID', 400);
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return errorResponse('Rating must be an integer between 1 and 5', 400);
    }

    if (!ratedUserId) {
      return errorResponse('Rated user ID required', 400);
    }

    // Determine rater role from ride data
    const db = adminDb;
    const state = await getRideLifecycleState(db, validUniversity, rideId);
    if (!state) {
      return errorResponse('Ride not found', 404);
    }

    let raterRole: 'driver' | 'passenger';
    if (authenticatedUserId === state.driverId) {
      raterRole = 'driver';
    } else {
      raterRole = 'passenger';
    }

    const result = await submitRating(
      db,
      validUniversity,
      rideId,
      authenticatedUserId,
      ratedUserId,
      raterRole,
      rating
    );

    return successResponse({ ok: true, ...result });
  } catch (e: any) {
    if (e.message?.includes('FORBIDDEN')) {
      return errorResponse('Access denied', 403);
    }
    console.error('[RideLifecycle Rate] Error:', e);
    return errorResponse(e.message || 'Rating failed', 400);
  }
}
