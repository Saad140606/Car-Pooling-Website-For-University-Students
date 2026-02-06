import { NextRequest, NextResponse } from 'next/server';
import admin from '@/firebase/firebaseAdmin';
import { requireAdmin } from '@/lib/adminApiAuth';
import type { Query } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const approvalsLimit = parseInt(searchParams.get('limit') || '100');
    const filterStatus = searchParams.get('status');
    const filterType = searchParams.get('type');
    const universityId = searchParams.get('universityId');

    const db = admin.firestore();

    let usersQuery: Query = db
      .collection('users')
      .where('status', '==', 'pending');

    if (universityId) {
      const primaryQuery = usersQuery.where('university', '==', universityId);
      const testSnap = await primaryQuery.limit(1).get().catch(() => null);
      usersQuery = testSnap && testSnap.size > 0
        ? primaryQuery
        : usersQuery.where('universityId', '==', universityId);
    }

    try {
      usersQuery = usersQuery.orderBy('createdAt', 'desc').limit(approvalsLimit);
    } catch (err) {
      usersQuery = usersQuery.limit(approvalsLimit);
    }

    const usersSnap = await usersQuery.get();
    const pendingUsers: any[] = [];

    usersSnap.forEach((doc) => {
      const userData = doc.data();
      const createdAt = userData.createdAt?.toDate?.()?.toISOString?.() || userData.createdAt;

      pendingUsers.push({
        id: `APPROVAL_${doc.id}`,
        type: 'email_verification',
        user: {
          id: doc.id,
          name: [userData.firstName, userData.lastName].filter(Boolean).join(' ') || userData.fullName || 'Unknown',
          email: userData.email || '',
          university: userData.university || userData.universityId,
          avatar: userData.profilePicture,
        },
        status: 'pending',
        submittedAt: createdAt ? new Date(createdAt).toLocaleString() : '',
        priority: 'high',
        documents: userData.verificationDocuments || [],
      });
    });

    let approvals = pendingUsers;
    if (filterStatus && filterStatus !== 'all') {
      approvals = approvals.filter((a) => a.status === filterStatus);
    }

    if (filterType && filterType !== 'all') {
      approvals = approvals.filter((a) => a.type === filterType);
    }

    return NextResponse.json({
      approvals: approvals.slice(0, approvalsLimit),
      total: approvals.length,
      hasMore: approvals.length > approvalsLimit,
    });
  } catch (error: any) {
    console.error('[admin/approvals] Error:', error);
    return NextResponse.json(
      { error: error.message, approvals: [], total: 0 },
      { status: 500 }
    );
  }
}
