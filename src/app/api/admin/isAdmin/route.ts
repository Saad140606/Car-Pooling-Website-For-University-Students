import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import admin from '@/firebase/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    // Extract and validate authorization header
    const authHeader = req.headers.get('authorization') || '';
    console.log('[api/admin/isAdmin] Auth header present:', !!authHeader);
    
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      console.warn('[api/admin/isAdmin] ❌ Missing or invalid authorization header');
      return NextResponse.json({ isAdmin: false, error: 'Missing authorization header' }, { status: 200 });
    }
    const idToken = m[1];
    console.log('[api/admin/isAdmin] Token extracted, length:', idToken.length);

    // Verify ID token
    let payload;
    try {
      console.log('[api/admin/isAdmin] Verifying token with Firebase Admin...');
      payload = await admin.auth().verifyIdToken(idToken);
      console.log('[api/admin/isAdmin] ✅ Token verified successfully');
    } catch (err) {
      console.warn('[api/admin/isAdmin] ❌ Token verification failed:', err instanceof Error ? err.message : String(err));
      return NextResponse.json({ isAdmin: false, error: 'Token verification failed' }, { status: 200 });
    }

    const uid = payload.uid;
    let email = payload.email;
    
    // If email is not in token, try to get it from request body
    if (!email) {
      try {
        const body = await req.json().catch(() => ({}));
        email = body.email;
        console.log('[api/admin/isAdmin] Email retrieved from request body:', email);
      } catch (err) {
        console.log('[api/admin/isAdmin] No email in token or request body');
      }
    }
    
    if (!uid) {
      console.warn('[api/admin/isAdmin] ❌ No UID in token');
      return NextResponse.json({ isAdmin: false, error: 'No UID in token' }, { status: 200 });
    }

    console.log('[api/admin/isAdmin] 🔍 Checking admin status for:', { uid, email });

    // First check NEXT_PUBLIC_ADMIN_EMAILS (client-side admin list)
    try {
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      
      console.log('[api/admin/isAdmin] Admin emails from env:', adminEmails);
      
      if (email && adminEmails.includes(email.toLowerCase())) {
        console.log(`[api/admin/isAdmin] ✅ User ${uid} (${email}) confirmed as admin via NEXT_PUBLIC_ADMIN_EMAILS`);
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
        console.log(`[api/admin/isAdmin] ✅ User ${uid} confirmed as admin via Firestore`);
      } else {
        console.log(`[api/admin/isAdmin] ❌ User ${uid} (${email}) is NOT an admin`);
      }
      
      return NextResponse.json({ isAdmin }, { status: 200 });
    } catch (err) {
      console.error('[api/admin/isAdmin] ❌ Firestore lookup failed:', err instanceof Error ? err.message : String(err));
      return NextResponse.json({ isAdmin: false }, { status: 200 });
    }
  } catch (err) {
    console.error('[api/admin/isAdmin] ❌ Unexpected error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
}
