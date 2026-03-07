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

    const normalizedUniversity = String(universityId || '').toLowerCase();

    let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    try {
      const snap = await db.collectionGroup('bookings').get();
      docs = snap.docs;
      console.log(`[admin/bookings] Found ${docs.length} bookings via collectionGroup`);
    } catch (err) {
      console.warn('[admin/bookings] collectionGroup failed, trying top-level', err);
      const snap = await db.collection('bookings').get();
      docs = snap.docs;
      console.log(`[admin/bookings] Found ${docs.length} bookings via top-level`);
    }

    const withMeta = docs.map((doc) => {
      const data = doc.data();
      const pathMatch = doc.ref.path.match(/universities\/([^/]+)\/bookings\//i);
      const derivedUniversityId = pathMatch?.[1]?.toLowerCase() || '';
      const fieldUniversity = String(data.universityId || data.university || '').toLowerCase();
      return {
        doc,
        data,
        universityId: fieldUniversity || derivedUniversityId,
      };
    });

    const filtered = normalizedUniversity
      ? withMeta.filter((item) => item.universityId === normalizedUniversity)
      : withMeta;

    const sorted = filtered.sort((a, b) => {
      const aMs = a.data.createdAt?.toDate?.()?.getTime?.() || new Date(a.data.createdAt || 0).getTime() || 0;
      const bMs = b.data.createdAt?.toDate?.()?.getTime?.() || new Date(b.data.createdAt || 0).getTime() || 0;
      return bMs - aMs;
    });

    const total = sorted.length;
    const page = sorted.slice(offset, offset + limit);

    const bookings = page.map(({ doc, data, universityId }) => ({
      id: doc.id,
      ...data,
      universityId,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    }));

    console.log(`[admin/bookings] Fetched ${bookings.length} bookings (total: ${total})`);

    return NextResponse.json({
      bookings,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (e: any) {
    console.error('[admin/bookings] error', e);
    return NextResponse.json({ error: e?.message || 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const { bookingId, universityId, updates } = await req.json();
    if (!bookingId || !updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'bookingId and updates are required' }, { status: 400 });
    }

    const db = admin.firestore();
    const writePayload = { ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    const paths = [
      universityId ? `universities/${String(universityId).toLowerCase()}/bookings/${bookingId}` : null,
      `bookings/${bookingId}`,
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
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[admin/bookings:PATCH] error', e);
    return NextResponse.json({ error: e?.message || 'Failed to update booking' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;
    return NextResponse.json(
      {
        error: 'Deletion from admin dashboard is disabled. Delete records only from Firebase project console.',
      },
      { status: 403 }
    );
  } catch (e: any) {
    console.error('[admin/bookings:DELETE] error', e);
    return NextResponse.json({ error: e?.message || 'Failed to delete booking' }, { status: 500 });
  }
}
