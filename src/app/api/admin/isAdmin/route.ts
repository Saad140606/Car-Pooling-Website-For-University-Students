import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import admin from '@/firebase/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    const idToken = m[1];

    const payload = await admin.auth().verifyIdToken(idToken);
    const uid = payload.uid;

    const snap = await admin.firestore().doc(`admins/${uid}`).get();
    const isAdmin = snap.exists;

    return NextResponse.json({ isAdmin });
  } catch (err) {
    try { console.error('[api/admin/isAdmin] error', err); } catch (_) {}
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
}
