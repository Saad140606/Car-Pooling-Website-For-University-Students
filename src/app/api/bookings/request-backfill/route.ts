import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/firebaseAdmin';
import {
  requireAuth,
  errorResponse,
  successResponse,
} from '@/lib/api-security';

type University = 'fast' | 'ned' | 'karachi';

function parseUniversity(value: string | null): University | null {
  if (!value) return null;
  const normalized = value.toLowerCase() as University;
  if (normalized === 'fast' || normalized === 'ned' || normalized === 'karachi') {
    return normalized;
  }
  return null;
}

function extractUniversityFromPath(path: string): string | null {
  const segments = path.split('/').filter(Boolean);
  const universitiesIndex = segments.indexOf('universities');
  if (universitiesIndex < 0) return null;
  return segments[universitiesIndex + 1] || null;
}

export async function GET(req: NextRequest) {
  if (!adminDb) {
    console.error('[RequestBackfill] Firebase Admin not initialized');
    return errorResponse('Server configuration error', 500);
  }

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    console.error('[RequestBackfill] Auth failed');
    return authResult;
  }

  const { searchParams } = new URL(req.url);
  const validUniversity = parseUniversity(searchParams.get('university'));
  if (!validUniversity) {
    console.error('[RequestBackfill] Invalid university:', searchParams.get('university'));
    return errorResponse('Invalid university parameter', 400);
  }

  try {
    const passengerId = authResult.uid;

    const requestsSnap = await adminDb
      .collectionGroup('requests')
      .where('passengerId', '==', passengerId)
      .where('status', 'in', ['ACCEPTED', 'CONFIRMED'])
      .limit(80)
      .get();

    const requestDocs = requestsSnap.docs.filter((requestDoc) => {
      const pathUniversity = extractUniversityFromPath(requestDoc.ref.path);
      return pathUniversity === validUniversity;
    });

    const rideIdSet = new Set<string>();
    requestDocs.forEach((requestDoc) => {
      const requestData = requestDoc.data() as any;
      const hasDepartureTime = !!(requestData?.rideData?.departureTime);
      const segments = requestDoc.ref.path.split('/');
      const rideSegmentIndex = segments.indexOf('rides');
      const rideIdFromPath = rideSegmentIndex >= 0 ? String(segments[rideSegmentIndex + 1] || '') : '';
      const rideId = String(requestData?.rideId || rideIdFromPath || '').trim();
      if (rideId && !hasDepartureTime) {
        rideIdSet.add(rideId);
      }
    });
    const rideIds = Array.from(rideIdSet);

    const rideMap = new Map<string, any>();
    if (rideIds.length > 0) {
      const rideRefs = rideIds.map((rideId) => adminDb.doc(`universities/${validUniversity}/rides/${rideId}`));
      const rideSnaps = await adminDb.getAll(...rideRefs);
      rideSnaps.forEach((rideSnap) => {
        if (rideSnap.exists) {
          rideMap.set(rideSnap.id, { id: rideSnap.id, ...rideSnap.data() });
        }
      });
    }

    const bookings = requestDocs.map((requestDoc) => {
      const requestData = requestDoc.data() as any;
      const segments = requestDoc.ref.path.split('/');
      const rideSegmentIndex = segments.indexOf('rides');
      const rideIdFromPath = rideSegmentIndex >= 0 ? segments[rideSegmentIndex + 1] : null;
      const rideId = String(requestData?.rideId || rideIdFromPath || '').trim();
      const enrichedRide = rideMap.get(rideId) || null;
      const ride = requestData?.rideData
        ? {
            ...enrichedRide,
            ...requestData.rideData,
            departureTime: requestData.rideData?.departureTime || enrichedRide?.departureTime || null,
          }
        : enrichedRide;

      return {
        id: requestDoc.id,
        rideId,
        passengerId: requestData?.passengerId || passengerId,
        driverId: requestData?.driverId || ride?.driverId || null,
        status: requestData?.status || 'PENDING',
        createdAt: requestData?.createdAt || requestData?.updatedAt || null,
        departureTime: requestData?.departureTime || ride?.departureTime || null,
        pickupPoint: requestData?.pickupPoint || null,
        pickupPlaceName: requestData?.pickupPlaceName || null,
        dropoffPlaceName: requestData?.dropoffPlaceName || null,
        passengerDetails: requestData?.passengerDetails || null,
        driverDetails: requestData?.driverDetails || ride?.driverInfo || null,
        ride,
      };
    });

    return successResponse({ ok: true, bookings });
  } catch (error: any) {
    console.error('[RequestBackfill API] Error:', error);
    return errorResponse(error?.message || 'Failed to fetch request backfill', 500);
  }
}
