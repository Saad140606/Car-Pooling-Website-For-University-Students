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

    let query: any = db.collection('reports');
    
    if (universityId) {
      const primaryQuery = query.where('university', '==', universityId);
      const testSnap = await primaryQuery.limit(1).get().catch(() => null);
      query = testSnap && testSnap.size > 0
        ? primaryQuery
        : query.where('universityId', '==', universityId);
    }

    // Get total count
    const countSnap = await query.get().catch(err => {
      console.error('[admin/reports] count fetch failed', err);
      return null;
    });

    const total = countSnap?.size || 0;

    // Fetch with pagination
    let docsSnap = null;
    try {
      docsSnap = await query
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
    } catch (err) {
      console.warn('[admin/reports] ordered query failed, trying unordered', err);
      try {
        docsSnap = await query
          .limit(limit)
          .offset(offset)
          .get();
      } catch (err2) {
        console.error('[admin/reports] fetch failed', err2);
        docsSnap = null;
      }
    }

    const reports = docsSnap?.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
    })) || [];

    console.log(`[admin/reports] Fetched ${reports.length} reports (total: ${total})`);

    return NextResponse.json({
      reports,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (e: any) {
    console.error('[admin/reports] error', e);
    return NextResponse.json({ error: e?.message || 'Failed to fetch reports' }, { status: 500 });
  }
}
