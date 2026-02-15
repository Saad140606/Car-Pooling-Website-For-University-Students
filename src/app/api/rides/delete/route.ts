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
  console.log('[API:DeleteRide] Request received');
  
  try {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      console.error('[API:DeleteRide] Firebase Admin not initialized');
      return errorResponse('Server configuration error', 500);
    }

    // ===== AUTHENTICATION =====
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) {
      console.warn('[API:DeleteRide] Authentication failed');
      return authResult;
    }
    const authenticatedUserId = authResult.uid;
    console.log('[API:DeleteRide] Authenticated user:', authenticatedUserId);

    // ===== RATE LIMITING =====
    const rateLimitResult = await applyRateLimit(req, RATE_LIMITS.RIDE_ACTION);
    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult;
    }

    // ===== INPUT VALIDATION =====
    const { university, rideId } = await req.json();
    console.log('[API:DeleteRide] Input:', { university, rideId });

    if (!university || typeof university !== 'string') {
      console.warn('[API:DeleteRide] Invalid university parameter');
      return errorResponse('Invalid university', 400);
    }

    const validUniversity = validateUniversity(university);
    if (!validUniversity) {
      console.warn('[API:DeleteRide] University not found:', university);
      return errorResponse('University not found', 400);
    }

    if (!rideId || typeof rideId !== 'string') {
      console.warn('[API:DeleteRide] Invalid ride ID parameter');
      return errorResponse('Invalid ride ID', 400);
    }

    if (!isValidDocId(rideId)) {
      console.warn('[API:DeleteRide] Invalid ride ID format:', rideId);
      return errorResponse('Invalid ride ID format', 400);
    }

    const db = adminDb;

    // ===== PREFLIGHT CHECKS: Verify ride exists and driver owns it =====
    console.log('[API:DeleteRide] Fetching ride document');
    const rideRef = db.doc(`universities/${validUniversity}/rides/${rideId}`);
    let ride: any = null;
    let rideSnap: FirebaseFirestore.DocumentSnapshot;
    
    try {
      rideSnap = await rideRef.get();
      
      if (!rideSnap.exists) {
        console.warn('[API:DeleteRide] Ride not found in database:', rideId);
        // Don't return immediately - try to clean up related data anyway
        ride = null;
      } else {
        ride = rideSnap.data() as any;
        console.log('[API:DeleteRide] Ride found:', { rideId, status: ride.status });

        // Verify authenticated user is the driver
        const ownerId = ride.driverId || ride.createdBy;
        if (ownerId !== authenticatedUserId) {
          console.warn('[API:DeleteRide] Ownership mismatch:', { 
            ownerId, 
            authenticatedUserId 
          });
          return errorResponse('You are not the owner of this ride', 403);
        }
        console.log('[API:DeleteRide] Ownership verified');

        // ===== CRITICAL SAFETY CHECK: Ensure NO accepted bookings exist =====
        // Query for any ACCEPTED or CONFIRMED bookings
        console.log('[API:DeleteRide] Checking for accepted bookings');
        const bookingsQuery = db.collection(`universities/${validUniversity}/bookings`)
          .where('rideId', '==', rideId)
          .where('status', 'in', ['accepted', 'ACCEPTED', 'CONFIRMED']);

        const bookingsSnap = await bookingsQuery.get();
        console.log('[API:DeleteRide] Found accepted bookings:', bookingsSnap.size);

        if (bookingsSnap.size > 0) {
          console.warn('[API:DeleteRide] Cannot delete - has accepted bookings:', bookingsSnap.size);
          return errorResponse(
            `Ride cannot be deleted because ${bookingsSnap.size} booking(s) are accepted.`,
            400
          );
        }
      }
    } catch (readErr: any) {
      console.warn('[API:DeleteRide] Error reading ride document:', {
        message: readErr?.message,
        code: readErr?.code
      });
      // Continue anyway - we'll try to clean up related data
    }

    // ===== FETCH ALL RELATED DATA BEFORE TRANSACTION =====
    // CRITICAL: Firestore Admin SDK transactions cannot use await within the callback
    // We must fetch all data BEFORE entering the transaction, then delete synchronously
    console.log('[API:DeleteRide] Fetching all related documents before deletion');
    
    // Fetch all bookings for this ride
    const allBookingsQuery = db.collection(`universities/${validUniversity}/bookings`)
      .where('rideId', '==', rideId);
    const allBookingsSnap = await allBookingsQuery.get();
    const bookingDocs = allBookingsSnap.docs;
    console.log('[API:DeleteRide] Found', bookingDocs.length, 'bookings to delete');

    // Fetch all ride-scoped requests
    let requestDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    try {
      const requestsQuery = db.collection(`universities/${validUniversity}/rides/${rideId}/requests`);
      const requestsSnap = await requestsQuery.get();
      requestDocs = requestsSnap.docs;
      console.log('[API:DeleteRide] Found', requestDocs.length, 'requests to delete');
    } catch (e) {
      console.log('[API:DeleteRide] No requests subcollection or error fetching:', e);
    }

    // Fetch all chats linked to this ride
    let chatDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    try {
      const chatsQuery = db.collection(`universities/${validUniversity}/chats`)
        .where('rideId', '==', rideId);
      const chatsSnap = await chatsQuery.get();
      chatDocs = chatsSnap.docs;
      console.log('[API:DeleteRide] Found', chatDocs.length, 'chats to delete');
    } catch (e) {
      console.log('[API:DeleteRide] Error fetching chats:', e);
    }

    // If ride doesn't exist, treat as a warning but continue with cleanup
    if (!ride) {
      console.warn('[API:DeleteRide] Ride document does not exist - proceeding with cleanup of related data only');
      // Still proceed to delete bookings, requests, chats to clean up orphaned data
    }

    // ===== DELETE RIDE AND RELATED DATA IN TRANSACTION =====
    console.log('[API:DeleteRide] Starting transaction to delete ride and related data');
    console.log('[API:DeleteRide] Transaction will delete:', {
      rideId,
      bookingCount: bookingDocs.length,
      requestCount: requestDocs.length,
      chatCount: chatDocs.length
    });

    let transactionResult;
    try {
      transactionResult = await db.runTransaction(async (tx) => {
        // Delete ride document
        console.log('[API:DeleteRide] Deleting ride in transaction');
        tx.delete(rideRef);

        // Delete all bookings
        console.log('[API:DeleteRide] Deleting bookings in transaction:', bookingDocs.length);
        bookingDocs.forEach((doc) => {
          tx.delete(doc.ref);
        });

        // Delete ride-scoped requests
        console.log('[API:DeleteRide] Deleting requests in transaction:', requestDocs.length);
        requestDocs.forEach((doc) => {
          tx.delete(doc.ref);
        });

        // Delete chats
        console.log('[API:DeleteRide] Deleting chats in transaction:', chatDocs.length);
        chatDocs.forEach((doc) => {
          tx.delete(doc.ref);
        });

        return { success: true };
      });
      console.log('[API:DeleteRide] Transaction completed successfully:', transactionResult);
    } catch (txErr) {
      console.error('[API:DeleteRide] Transaction error:', {
        message: txErr?.message,
        code: txErr?.code,
        type: txErr?.constructor?.name
      });
      throw txErr; // Re-throw to be caught by outer try-catch
    }

    return successResponse({
      ok: true,
      message: ride ? 'Ride deleted successfully' : 'Ride cleanup completed (ride document not found)',
      data: { rideId, rideFound: !!ride, cleanedUp: { bookings: bookingDocs.length, requests: requestDocs.length, chats: chatDocs.length } }
    });

  } catch (e: any) {
    console.error('[DeleteRide] Caught error at function level:', {
      message: e?.message,
      code: e?.code,
      type: e?.constructor?.name,
      errorStr: String(e),
      stack: e?.stack?.substring(0, 500)
    });

    // Handle permission/auth errors
    if (e.message?.includes('permission-denied') || e.code === 'PERMISSION_DENIED') {
      console.log('[DeleteRide] Returning 403 permission denied error');
      return errorResponse(
        'Permission denied. Ensure your account has access.',
        403
      );
    }

    // Handle Firestore specific errors
    if (e.message?.includes('FAILED_PRECONDITION') || e.code === 'FAILED_PRECONDITION') {
      console.log('[DeleteRide] Returning 400 precondition failed error');
      return errorResponse('Cannot delete ride due to existing dependencies', 400);
    }

    // Return detailed error message - ensure it's always a string
    const errorMsg = String(e?.message || e?.toString?.() || e || 'Failed to delete ride').substring(0, 500);
    console.error('[DeleteRide] Final error response being sent:', errorMsg);
    
    // Ensure we always return a proper error response object
    return NextResponse.json(
      { error: errorMsg, ok: false },
      { status: 500 }
    );
  }
}

