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

    const rides = paginatedSnap?.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      departureTime: doc.data().departureTime?.toDate?.()?.toISOString() || doc.data().departureTime,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
    })) || [];

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
