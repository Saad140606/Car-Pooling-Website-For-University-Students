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

    const body = await req.json().catch(() => ({}));
    const selectedUni = body?.selectedUni || 'fast';
    const allUniversities = ['fast', 'ned', 'karachi'].filter(u => u !== selectedUni);

    // Check admin document first
    const adminSnap = await admin.firestore().doc(`admins/${uid}`).get().catch(() => null as any);
    const isAdmin = !!(adminSnap && adminSnap.exists);

    // Check university-scoped profile
    const uniSnap = await admin.firestore().doc(`universities/${selectedUni}/users/${uid}`).get().catch(() => null as any);
    if (uniSnap && uniSnap.exists) return NextResponse.json({ isMember: true, isAdmin, university: selectedUni });

    // Check ALL other universities - IMPORTANT: return which university the user belongs to
    for (const otherUni of allUniversities) {
      const otherSnap = await admin.firestore().doc(`universities/${otherUni}/users/${uid}`).get().catch(() => null as any);
      if (otherSnap && otherSnap.exists) return NextResponse.json({ isMember: true, isAdmin, university: otherUni, registeredIn: otherUni });
    }

    // Check legacy top-level users/{univ}_{uid}
    const legacySelected = await admin.firestore().doc(`users/${selectedUni}_${uid}`).get().catch(() => null as any);
    if (legacySelected && legacySelected.exists) return NextResponse.json({ isMember: true, isAdmin, university: selectedUni, legacy: true });
    
    for (const otherUni of allUniversities) {
      const legacyOther = await admin.firestore().doc(`users/${otherUni}_${uid}`).get().catch(() => null as any);
      if (legacyOther && legacyOther.exists) return NextResponse.json({ isMember: true, isAdmin, university: otherUni, legacy: true, registeredIn: otherUni });
    }

    return NextResponse.json({ isMember: false, isAdmin });
  } catch (err) {
    try { console.error('[api/admin/isMember] error', err); } catch (_) {}
    return NextResponse.json({ isMember: false }, { status: 200 });
  }
}
