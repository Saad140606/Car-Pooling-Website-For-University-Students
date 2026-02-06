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

    let query: any = db.collection('chats');
    
    if (universityId) {
      const primaryQuery = query.where('university', '==', universityId);
      const testSnap = await primaryQuery.limit(1).get().catch(() => null);
      query = testSnap && testSnap.size > 0
        ? primaryQuery
        : query.where('universityId', '==', universityId);
    }

    // Get total count
    const countSnap = await query.get().catch(err => {
      console.error('[admin/messages] count fetch failed', err);
      return null;
    });

    const total = countSnap?.size || 0;

    // Fetch with pagination
    let docsSnap = null;
    try {
      docsSnap = await query
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
    } catch (err) {
      console.warn('[admin/messages] ordered query failed, trying unordered', err);
      try {
        docsSnap = await query
          .limit(limit)
          .offset(offset)
          .get();
      } catch (err2) {
        console.error('[admin/messages] fetch failed', err2);
        docsSnap = null;
      }
    }

    // Aggregate message data
    let totalMessages = 0;
    const chats = [];

    for (const chatDoc of docsSnap?.docs || []) {
      const chatData = chatDoc.data();
      try {
        const messagesRef = chatDoc.ref.collection('messages');
        const messagesSnap = await messagesRef.get();
        const messageCount = messagesSnap.size;
        totalMessages += messageCount;

        chats.push({
          id: chatDoc.id,
          ...chatData,
          messageCount,
          createdAt: chatData.createdAt?.toDate?.()?.toISOString() || chatData.createdAt,
          updatedAt: chatData.updatedAt?.toDate?.()?.toISOString() || chatData.updatedAt,
        });
      } catch (err) {
        console.warn(`[admin/messages] failed to fetch messages for chat ${chatDoc.id}`, err);
        chats.push({
          id: chatDoc.id,
          ...chatData,
          messageCount: 0,
          createdAt: chatData.createdAt?.toDate?.()?.toISOString() || chatData.createdAt,
          updatedAt: chatData.updatedAt?.toDate?.()?.toISOString() || chatData.updatedAt,
        });
      }
    }

    console.log(`[admin/messages] Fetched ${chats.length} chats with ${totalMessages} total messages (total chats: ${total})`);

    return NextResponse.json({
      chats,
      totalMessages,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (e: any) {
    console.error('[admin/messages] error', e);
    return NextResponse.json({ error: e?.message || 'Failed to fetch messages' }, { status: 500 });
  }
}
