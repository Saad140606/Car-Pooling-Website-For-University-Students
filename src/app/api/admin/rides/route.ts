import admin from '@/firebase/firebaseAdmin';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminApiAuth';

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const universityId = searchParams.get('universityId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const db = admin.firestore();

    // Try to fetch from collectionGroup first
    let ridesSnap = null;
    let query: any = null;

    try {
      query = db.collectionGroup('rides');
      if (universityId) {
        let primaryQuery = query.where('university', '==', universityId);
        let countSnap = await primaryQuery.get();
        if (countSnap.empty) {
          primaryQuery = query.where('universityId', '==', universityId);
          countSnap = await primaryQuery.get();
        }
        query = primaryQuery;
        console.log(`[admin/rides] Found ${countSnap.size} rides via collectionGroup`);
        ridesSnap = countSnap;
      } else {
        const countSnap = await query.get();
        console.log(`[admin/rides] Found ${countSnap.size} rides via collectionGroup`);
        ridesSnap = countSnap;
      }
    } catch (err) {
      console.warn('[admin/rides] collectionGroup failed, trying top-level', err);
      try {
        query = db.collection('rides');
        if (universityId) {
          let primaryQuery = query.where('university', '==', universityId);
          let countSnap = await primaryQuery.get();
          if (countSnap.empty) {
            primaryQuery = query.where('universityId', '==', universityId);
            countSnap = await primaryQuery.get();
          }
          query = primaryQuery;
        }
        const countSnap = await query.get();
        console.log(`[admin/rides] Found ${countSnap.size} rides via top-level`);
        ridesSnap = countSnap;
      } catch (err2) {
        console.error('[admin/rides] fetch failed', err2);
        ridesSnap = null;
      }
    }

    const total = ridesSnap?.size || 0;

    // Get paginated results
    let paginatedSnap = null;
    if (query) {
      try {
        paginatedSnap = await query
          .orderBy('createdAt', 'desc')
          .limit(limit)
          .offset(offset)
          .get();
      } catch (err) {
        console.warn('[admin/rides] ordered query failed, trying unordered', err);
        try {
          paginatedSnap = await query
            .limit(limit)
            .offset(offset)
            .get();
        } catch (err2) {
          paginatedSnap = null;
        }
      }
    }

    const driverNameCache = new Map<string, string>();

    const resolveDriverName = async (university: string, driverId: string): Promise<string | null> => {
      const cacheKey = `${university}:${driverId}`;
      if (driverNameCache.has(cacheKey)) return driverNameCache.get(cacheKey) || null;

      const candidatePaths = [
        `universities/${university}/users/${driverId}`,
        `users/${driverId}`,
      ];

      for (const path of candidatePaths) {
        try {
          const snap = await db.doc(path).get();
          if (!snap.exists) continue;
          const d = snap.data() as any;
          const name = d?.fullName || d?.displayName || d?.name || null;
          if (name) {
            driverNameCache.set(cacheKey, String(name));
            return String(name);
          }
        } catch {
          // Ignore profile fetch failures and continue fallback chain.
        }
      }

      driverNameCache.set(cacheKey, '');
      return null;
    };

    const rides = paginatedSnap
      ? await Promise.all(
          paginatedSnap.docs.map(async (doc) => {
            const data = doc.data();
            const pathMatch = doc.ref.path.match(/universities\/([^/]+)\/rides\//i);
            const derivedUniversityId = pathMatch?.[1]?.toLowerCase() || '';
            const fieldUniversityId = String(data.universityId || data.university || '').toLowerCase();
            const universityIdResolved = fieldUniversityId || derivedUniversityId;

            const driverId = String(data.driverId || data.createdBy || '').trim();
            const resolvedDriverName =
              data.driverName ||
              data.rideProviderName ||
              data.driverInfo?.fullName ||
              data.driverInfo?.name ||
              (driverId && universityIdResolved
                ? await resolveDriverName(universityIdResolved, driverId)
                : null);

            return {
              id: doc.id,
              ...data,
              driverName: resolvedDriverName || data.driverName || null,
              universityId: universityIdResolved,
              departureTime: data.departureTime?.toDate?.()?.toISOString() || data.departureTime,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            };
          })
        )
      : [];

    console.log(`[admin/rides] Fetched ${rides.length} rides (total: ${total})`);

    return NextResponse.json({
      rides,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (e: any) {
    console.error('[admin/rides] error', e);
    return NextResponse.json({ error: e?.message || 'Failed to fetch rides' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const { rideId, universityId, updates } = await req.json();
    if (!rideId || !updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'rideId and updates are required' }, { status: 400 });
    }

    const db = admin.firestore();
    const writePayload = { ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    const paths = [
      universityId ? `universities/${String(universityId).toLowerCase()}/rides/${rideId}` : null,
      `rides/${rideId}`,
    ].filter(Boolean) as string[];

    let updated = false;
    for (const path of paths) {
      const ref = db.doc(path);
      const snap = await ref.get();
      if (!snap.exists) continue;
      await ref.set(writePayload, { merge: true });
      updated = true;
    }

    if (!updated) {
      return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[admin/rides:PATCH] error', e);
    return NextResponse.json({ error: e?.message || 'Failed to update ride' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const rideId = searchParams.get('rideId');
    const universityId = searchParams.get('universityId');

    if (!rideId) {
      return NextResponse.json({ error: 'rideId is required' }, { status: 400 });
    }

    const db = admin.firestore();
    const paths = [
      universityId ? `universities/${String(universityId).toLowerCase()}/rides/${rideId}` : null,
      `rides/${rideId}`,
    ].filter(Boolean) as string[];

    let deleted = false;
    for (const path of paths) {
      const ref = db.doc(path);
      const snap = await ref.get();
      if (!snap.exists) continue;
      await ref.delete();
      deleted = true;
    }

    if (!deleted) {
      return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[admin/rides:DELETE] error', e);
    return NextResponse.json({ error: e?.message || 'Failed to delete ride' }, { status: 500 });
  }
}
