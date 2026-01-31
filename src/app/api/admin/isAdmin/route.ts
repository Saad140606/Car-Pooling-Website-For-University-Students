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
    const email = payload.email;
    if (!uid) {
      console.warn('[api/admin/isAdmin] No UID in token');
      return NextResponse.json({ isAdmin: false }, { status: 401 });
    }

    // First check NEXT_PUBLIC_ADMIN_EMAILS (client-side admin list)
    try {
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      
      if (email && adminEmails.includes(email.toLowerCase())) {
        console.log(`[api/admin/isAdmin] User ${uid} (${email}) confirmed as admin via NEXT_PUBLIC_ADMIN_EMAILS`);
        return NextResponse.json({ isAdmin: true }, { status: 200 });
      }
    } catch (err) {
      console.warn('[api/admin/isAdmin] Failed to check NEXT_PUBLIC_ADMIN_EMAILS:', err);
    }

    // Check if user document exists in admins collection
    try {
      const snap = await admin.firestore().doc(`admins/${uid}`).get();
      const isAdmin = snap.exists;
      
      if (isAdmin) {
        console.log(`[api/admin/isAdmin] User ${uid} confirmed as admin via Firestore`);
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
