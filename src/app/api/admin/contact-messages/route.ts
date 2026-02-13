import admin from '@/firebase/firebaseAdmin';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminApiAuth';

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'unread', 'read', 'responded'
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const db = admin.firestore();

    let query: any = db.collection('contact_messages');
    
    if (status) {
      query = query.where('status', '==', status);
    }

    // Get total count
    const countSnap = await query.get().catch(err => {
      console.error('[admin/contact-messages] count fetch failed', err);
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
      console.warn('[admin/contact-messages] ordered query failed, trying unordered', err);
      try {
        docsSnap = await query
          .limit(limit)
          .offset(offset)
          .get();
      } catch (err2) {
        console.error('[admin/contact-messages] fetch failed', err2);
        docsSnap = null;
      }
    }

    const messages = docsSnap?.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
    })) || [];

    console.log(`[admin/contact-messages] Fetched ${messages.length} messages (total: ${total})`);

    return NextResponse.json({
      messages,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (e: any) {
    console.error('[admin/contact-messages] error', e);
    return NextResponse.json({ error: e?.message || 'Failed to fetch contact messages' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const { messageId, status } = await req.json();

    if (!messageId || !status) {
      return NextResponse.json({ error: 'messageId and status are required' }, { status: 400 });
    }

    const db = admin.firestore();
    await db.collection('contact_messages').doc(messageId).update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[admin/contact-messages] PATCH error', e);
    return NextResponse.json({ error: e?.message || 'Failed to update message status' }, { status: 500 });
  }
}
