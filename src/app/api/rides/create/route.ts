import { NextRequest } from 'next/server';
import admin from 'firebase-admin';
import { adminDb } from '@/firebase/firebaseAdmin';
import {
  requireAuth,
  applyRateLimit,
  validateUniversity,
  sanitizeString,
  errorResponse,
  successResponse,
  RATE_LIMITS,
} from '@/lib/api-security';

function toDate(input: unknown): Date | null {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'string' || typeof input === 'number') {
    const parsed = new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof (input as any)?.seconds === 'number') {
    const parsed = new Date((input as any).seconds * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function removeUndefinedDeep(value: any): any {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (value instanceof Date) return value;

  // Preserve Firestore Timestamp-like values
  if (value && typeof value?.toDate === 'function') {
    return value;
  }

  // Preserve Firestore FieldValue sentinels (serverTimestamp/increment/etc.)
  if (value && typeof value === 'object') {
    const ctorName = value?.constructor?.name;
    if (ctorName === 'FieldValue' || ctorName === 'Timestamp' || ctorName === 'GeoPoint' || ctorName === 'DocumentReference') {
      return value;
    }
    if (typeof value?._methodName === 'string') {
      return value;
    }
  }

  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep).filter((v) => v !== undefined);
  }
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      const v = removeUndefinedDeep(value[key]);
      if (v !== undefined) out[key] = v;
    }
    return out;
  }
  return value;
}

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return errorResponse('Server configuration error', 500);
    }

    const authResult = await requireAuth(req);
    if ((authResult as any)?.status) {
      return authResult as any;
    }
    const authenticatedUser = authResult as { uid: string };

    const rateLimitResult = await applyRateLimit(req, RATE_LIMITS.RIDE_ACTION);
    if ((rateLimitResult as any)?.status) {
      return rateLimitResult as any;
    }

    const body = await req.json();
    const university = validateUniversity(body?.university);
    const rideData = body?.rideData;

    if (!university) {
      return errorResponse('Invalid university parameter', 400);
    }

    if (!rideData || typeof rideData !== 'object') {
      return errorResponse('Invalid ride data payload', 400);
    }

    const from = sanitizeString(rideData.from);
    const to = sanitizeString(rideData.to);
    const departureDate = toDate(rideData.departureTime || rideData.time);

    if (!from || from.length < 3 || !to || to.length < 3) {
      return errorResponse('Invalid ride route details', 400);
    }

    if (!departureDate) {
      return errorResponse('Invalid departure time', 400);
    }

    const driverId = String(rideData.driverId || '');
    const createdBy = String(rideData.createdBy || '');
    if (driverId !== authenticatedUser.uid || createdBy !== authenticatedUser.uid) {
      return errorResponse('Forbidden: user mismatch', 403);
    }

    const normalizedPayload = removeUndefinedDeep({
      ...rideData,
      university,
      driverId: authenticatedUser.uid,
      createdBy: authenticatedUser.uid,
      from,
      to,
      departureTime: admin.firestore.Timestamp.fromDate(departureDate),
      time: admin.firestore.Timestamp.fromDate(departureDate),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const docRef = await adminDb.collection(`universities/${university}/rides`).add(normalizedPayload);

    return successResponse({
      rideId: docRef.id,
      university,
    });
  } catch (error: any) {
    console.error('[API:CreateRide] Failed to create ride via server fallback:', error);
    return errorResponse(error?.message || 'Failed to create ride', 500);
  }
}
