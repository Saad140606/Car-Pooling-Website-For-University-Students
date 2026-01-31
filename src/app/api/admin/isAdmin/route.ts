import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import admin from '@/firebase/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    // Extract and validate authorization header
    const authHeader = req.headers.get('authorization') || '';
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      console.warn('[api/admin/isAdmin] Missing or invalid authorization header');
      return NextResponse.json({ isAdmin: false }, { status: 401 });
    }
    const idToken = m[1];

    // Verify ID token
    let payload;
    try {
      payload = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      console.warn('[api/admin/isAdmin] Token verification failed:', err instanceof Error ? err.message : String(err));
      return NextResponse.json({ isAdmin: false }, { status: 401 });
    }

    const uid = payload.uid;
    if (!uid) {
      console.warn('[api/admin/isAdmin] No UID in token');
      return NextResponse.json({ isAdmin: false }, { status: 401 });
    }

    // Check if user document exists in admins collection
    try {
      const snap = await admin.firestore().doc(`admins/${uid}`).get();
      const isAdmin = snap.exists;
      
      if (isAdmin) {
        console.log(`[api/admin/isAdmin] User ${uid} confirmed as admin`);
      }
      
      return NextResponse.json({ isAdmin }, { status: 200 });
    } catch (err) {
      console.error('[api/admin/isAdmin] Firestore lookup failed:', err instanceof Error ? err.message : String(err));
      return NextResponse.json({ isAdmin: false }, { status: 200 });
    }
  } catch (err) {
    console.error('[api/admin/isAdmin] Unexpected error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
}
