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
      const snap = await db.collectionGroup('users').get();
      docs = snap.docs;
      console.log(`[admin/users] Found ${docs.length} users via collectionGroup`);
    } catch (err) {
      console.warn('[admin/users] collectionGroup failed, trying top-level', err);
      const snap = await db.collection('users').get();
      docs = snap.docs;
      console.log(`[admin/users] Found ${docs.length} users via top-level`);
    }

    const withMeta = docs.map((doc) => {
      const data = doc.data();
      const pathMatch = doc.ref.path.match(/universities\/([^/]+)\/users\//i);
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

    const users = page.map(({ doc, data, universityId }) => ({
      id: doc.id,
      ...data,
      universityId,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    }));

    console.log(`[admin/users] Fetched ${users.length} users (total: ${total})`);

    return NextResponse.json({
      users,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (e: any) {
    console.error('[admin/users] error', e);
    return NextResponse.json({ error: e?.message || 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const { userId, updates } = await req.json();
    if (!userId || !updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'userId and updates are required' }, { status: 400 });
    }

    const db = admin.firestore();
    const userIdStr = String(userId);
    const writePayload = { ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    const topLevelRef = db.collection('users').doc(userIdStr);
    const topLevelSnap = await topLevelRef.get().catch(() => null);

    if (topLevelSnap?.exists) {
      await topLevelRef.set(writePayload, { merge: true });
      return NextResponse.json({ ok: true });
    }

    const cgSnap = await db
      .collectionGroup('users')
      .where(admin.firestore.FieldPath.documentId(), '==', userIdStr)
      .limit(1)
      .get();

    if (cgSnap.empty) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await cgSnap.docs[0].ref.set(writePayload, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[admin/users:PATCH] error', e);
    return NextResponse.json({ error: e?.message || 'Failed to update user' }, { status: 500 });
  }
}
