/**
 * Delete Ride API
 * 
 * SAFETY: This endpoint enforces a critical business rule:
 * - A ride can ONLY be deleted if NO bookings are accepted
 * - The moment ANY booking becomes accepted, deletion is blocked
 * 
 * This protects:
 * - Ride integrity
 * - Passenger expectations
 * - Booking consistency
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/firebaseAdmin';
import admin from 'firebase-admin';
import {
  requireAuth,
  applyRateLimit,
  validateUniversity,
  isValidDocId,
  errorResponse,
  successResponse,
  RATE_LIMITS,
} from '@/lib/api-security';

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
    const { university, rideId } = await req.json();

    if (!university || typeof university !== 'string') {
      return errorResponse('Invalid university', 400);
    }

    const validUniversity = validateUniversity(university);
    if (!validUniversity) {
      return errorResponse('University not found', 400);
    }

    if (!rideId || typeof rideId !== 'string') {
      return errorResponse('Invalid ride ID', 400);
    }

    if (!isValidDocId(rideId)) {
      return errorResponse('Invalid ride ID format', 400);
    }

    const db = adminDb;

    // ===== PREFLIGHT CHECKS: Verify ride exists and driver owns it =====
    const rideRef = db.doc(`universities/${validUniversity}/rides/${rideId}`);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) {
      return errorResponse('Ride not found', 404);
    }

    const ride = rideSnap.data() as any;

    // Verify authenticated user is the driver
    const ownerId = ride.driverId || ride.createdBy;
    if (ownerId !== authenticatedUserId) {
      return errorResponse('You are not the owner of this ride', 403);
    }

    // ===== CRITICAL SAFETY CHECK: Ensure NO accepted bookings exist =====
    // Query for any ACCEPTED or CONFIRMED bookings
    const bookingsQuery = db.collection(`universities/${validUniversity}/bookings`)
      .where('rideId', '==', rideId)
      .where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED']);

    const bookingsSnap = await bookingsQuery.get();

    if (bookingsSnap.size > 0) {
      return errorResponse(
        `Ride cannot be deleted because ${bookingsSnap.size} booking(s) are accepted.`,
        400
      );
    }

    // ===== DELETE RIDE AND RELATED DATA =====
    await db.runTransaction(async (tx) => {
      // Delete ride document
      tx.delete(rideRef);

      // Delete all bookings (pending ones are ok to delete)
      const allBookingsQuery = db.collection(`universities/${validUniversity}/bookings`)
        .where('rideId', '==', rideId);
      const allBookings = await tx.get(allBookingsQuery);
      allBookings.forEach((doc) => {
        tx.delete(doc.ref);
      });

      // Delete any ride-scoped requests (subcollection)
      try {
        const requestsQuery = db.collection(`universities/${validUniversity}/rides/${rideId}/requests`);
        const requests = await tx.get(requestsQuery);
        requests.forEach((doc) => {
          tx.delete(doc.ref);
        });
      } catch (_) {
        // Ignore - requests may not exist
      }

      // Delete any chats linked to this ride
      try {
        const chatsQuery = db.collection(`universities/${validUniversity}/chats`)
          .where('rideId', '==', rideId);
        const chats = await tx.get(chatsQuery);
        chats.forEach((doc) => {
          tx.delete(doc.ref);
        });
      } catch (_) {
        // Ignore - chats may not exist
      }
    });

    return successResponse({
      ok: true,
      message: 'Ride deleted successfully',
      data: { rideId }
    });

  } catch (e: any) {
    console.error('[DeleteRide] Error:', e);

    // Handle permission errors
    if (e.message?.includes('permission-denied')) {
      return errorResponse(
        'Permission denied. Ensure your account has access.',
        403
      );
    }

    return errorResponse(e.message || 'Failed to delete ride', 500);
  }
}
