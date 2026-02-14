/**
 * Ride Lifecycle API — State Endpoint
 *
 * GET /api/ride-lifecycle/state?university=X&rideId=Y
 *
 * Returns the full lifecycle state of a ride.
 * Read-only endpoint — no authentication required for basic state,
 * but authenticated users get full details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/firebaseAdmin';
import {
  verifyAuthToken,
  validateUniversity,
  isValidDocId,
  errorResponse,
  successResponse,
} from '@/lib/api-security';
import { getRideLifecycleState } from '@/lib/rideLifecycle/lifecycleService';

export async function GET(req: NextRequest) {
  if (!adminDb) {
    return errorResponse('Server configuration error', 500);
  }

  try {
    const { searchParams } = new URL(req.url);
    const university = searchParams.get('university');
    const rideId = searchParams.get('rideId');

    const validUniversity = university ? validateUniversity(university) : null;
    if (!validUniversity) {
      return errorResponse('Invalid university', 400);
    }

    if (!rideId || !isValidDocId(rideId)) {
      return errorResponse('Invalid ride ID', 400);
    }

    const db = adminDb;
    const state = await getRideLifecycleState(db, validUniversity, rideId);

    if (!state) {
      return errorResponse('Ride not found', 404);
    }

    // Check auth for full details (optional)
    const authResult = await verifyAuthToken(req, true);
    const isAuthenticated = authResult.success;
    const userId = authResult.user?.uid;

    // Determine user role
    let userRole: 'driver' | 'passenger' | 'viewer' = 'viewer';
    if (userId === state.driverId) {
      userRole = 'driver';
    } else if (state.confirmedPassengers.some((p) => p.userId === userId)) {
      userRole = 'passenger';
    }

    // Build response — sanitize sensitive data for non-participants
    const response: Record<string, any> = {
      rideId: state.rideId,
      status: state.status,
      departureTime: state.departureTime,
      totalSeats: state.totalSeats,
      availableSeats: state.availableSeats,
      from: state.from,
      to: state.to,
      price: state.price,
      transportMode: state.transportMode,
      ratingsOpen: state.ratingsOpen,
      confirmedPassengerCount: state.confirmedPassengers.length,
      userRole,
    };

    // Authenticated participants get full details
    if (isAuthenticated && (userRole === 'driver' || userRole === 'passenger')) {
      response.confirmedPassengers = state.confirmedPassengers;
      response.pendingRequests = userRole === 'driver' ? state.pendingRequests : [];
      response.completionWindowEnd = state.completionWindowEnd;
      response.transitionLog = state.transitionLog.slice(-10); // Last 10 transitions
      response.reservedSeats = state.reservedSeats;
    }

    return successResponse(response);
  } catch (e: any) {
    console.error('[RideLifecycle State] Error:', e);
    return errorResponse(e.message || 'Failed to get ride state', 500);
  }
}
