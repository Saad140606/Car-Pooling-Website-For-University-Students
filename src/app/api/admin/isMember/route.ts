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
    const selectedUniRaw = String(body?.selectedUni || 'fast').toLowerCase();
    const universities = ['fast', 'ned', 'karachi'] as const;
    const selectedUni = universities.includes(selectedUniRaw as any)
      ? (selectedUniRaw as 'fast' | 'ned' | 'karachi')
      : 'fast';

    // Check admin document first
    const adminSnap = await admin.firestore().doc(`admins/${uid}`).get().catch(() => null as any);
    const isAdmin = !!(adminSnap && adminSnap.exists);

    const memberships: Array<'fast' | 'ned' | 'karachi'> = [];
    for (const uni of universities) {
      const snap = await admin.firestore().doc(`universities/${uni}/users/${uid}`).get().catch(() => null as any);
      if (snap && snap.exists) memberships.push(uni);
    }

    let preferredUniversity: 'fast' | 'ned' | 'karachi' | null = null;
    const topLevelUserSnap = await admin.firestore().doc(`users/${uid}`).get().catch(() => null as any);
    if (topLevelUserSnap?.exists) {
      const topUniversity = String((topLevelUserSnap.data() as any)?.university || '').toLowerCase();
      if (universities.includes(topUniversity as any) && memberships.includes(topUniversity as any)) {
        preferredUniversity = topUniversity as 'fast' | 'ned' | 'karachi';
      }
    }

    if (memberships.length > 0) {
      const resolvedUniversity = preferredUniversity || memberships[0];
      return NextResponse.json({
        isMember: true,
        isAdmin,
        university: resolvedUniversity,
        registeredIn: resolvedUniversity,
        hasMultipleMemberships: memberships.length > 1,
        memberships,
      });
    }

    // Legacy fallback: top-level users/{univ}_{uid}
    const legacyMemberships: Array<'fast' | 'ned' | 'karachi'> = [];
    for (const uni of universities) {
      const legacy = await admin.firestore().doc(`users/${uni}_${uid}`).get().catch(() => null as any);
      if (legacy && legacy.exists) legacyMemberships.push(uni);
    }

    if (legacyMemberships.length > 0) {
      const resolvedLegacyUniversity = legacyMemberships[0];
      return NextResponse.json({
        isMember: true,
        isAdmin,
        university: resolvedLegacyUniversity,
        registeredIn: resolvedLegacyUniversity,
        legacy: true,
        hasMultipleMemberships: legacyMemberships.length > 1,
        memberships: legacyMemberships,
      });
    }

    return NextResponse.json({ isMember: false, isAdmin });
  } catch (err) {
    try { console.error('[api/admin/isMember] error', err); } catch (_) {}
    return NextResponse.json({ isMember: false }, { status: 200 });
  }
}
