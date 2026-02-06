import admin from '@/firebase/firebaseAdmin';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminApiAuth';
import type { Firestore, DocumentSnapshot } from 'firebase-admin/firestore';

type DocSnap = DocumentSnapshot;

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function buildLast7Days() {
  const now = new Date();
  const days: { label: string; date: Date }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    days.push({ label, date: d });
  }
  return days;
}

async function fetchDocsByUniversity(
  db: Firestore,
  collectionName: string,
  universityId?: string | null
) {
  const docsByPath = new Map<string, DocSnap>();

  const addDocs = (docs: DocSnap[] | undefined | null) => {
    if (!docs) return;
    for (const d of docs) {
      docsByPath.set(d.ref.path, d);
    }
  };

  if (universityId) {
    // University-scoped subcollection
    try {
      const uniSnap = await db
        .collection('universities')
        .doc(universityId)
        .collection(collectionName)
        .get();
      addDocs(uniSnap.docs);
    } catch (err) {
      console.warn(`[admin/analytics] ${collectionName} university subcollection failed`, err);
    }

    // Top-level collection with possible field names
    try {
      const topSnapA = await db
        .collection(collectionName)
        .where('university', '==', universityId)
        .get();
      addDocs(topSnapA.docs);
    } catch (err) {
      console.warn(`[admin/analytics] ${collectionName} top-level university filter failed`, err);
    }

    try {
      const topSnapB = await db
        .collection(collectionName)
        .where('universityId', '==', universityId)
        .get();
      addDocs(topSnapB.docs);
    } catch (err) {
      console.warn(`[admin/analytics] ${collectionName} top-level universityId filter failed`, err);
    }

    return Array.from(docsByPath.values());
  }

  // All universities: combine top-level and collectionGroup
  try {
    const topSnap = await db.collection(collectionName).get();
    addDocs(topSnap.docs);
  } catch (err) {
    console.warn(`[admin/analytics] ${collectionName} top-level fetch failed`, err);
  }

  try {
    const groupSnap = await db.collectionGroup(collectionName).get();
    addDocs(groupSnap.docs);
  } catch (err) {
    console.warn(`[admin/analytics] ${collectionName} collectionGroup fetch failed`, err);
  }

  return Array.from(docsByPath.values());
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const universityId = searchParams.get('universityId');

    const db = admin.firestore();

    // Fetch all collections with proper error handling
    console.log('[admin/analytics] Fetching data...');

    const usersDocs = await fetchDocsByUniversity(db, 'users', universityId);
    const ridesDocs = await fetchDocsByUniversity(db, 'rides', universityId);
    const bookingsDocs = await fetchDocsByUniversity(db, 'bookings', universityId);
    const reportsDocs = await fetchDocsByUniversity(db, 'reports', universityId);

    // Messages/Chats
    let messagesCount = 0;
    try {
      const chatsDocs = await fetchDocsByUniversity(db, 'chats', universityId);
      console.log(`[admin/analytics] Found ${chatsDocs.length} chats`);
      for (const chatDoc of chatsDocs) {
        const messagesRef = chatDoc.ref.collection('messages');
        const msgSnap = await messagesRef.get();
        messagesCount += msgSnap.size;
      }
    } catch (err) {
      console.warn('[admin/analytics] messages fetch failed', err);
    }

    // Calculate stats
    const totalUsers = usersDocs.length;
    const activeUsers = usersDocs.filter(d => d.data().status === 'active').length || 0;
    const verifiedUsers = usersDocs.filter(d => d.data().verified === true).length || 0;

    const totalRides = ridesDocs.length;
    const completedRides = ridesDocs.filter(d => d.data().status === 'completed').length || 0;
    const cancelledRides = ridesDocs.filter(d => d.data().status === 'cancelled').length || 0;
    const activeRides = ridesDocs.filter(d => ['active', 'in_progress'].includes(d.data().status)).length || 0;

    const totalBookings = bookingsDocs.length;
    const confirmedBookings = bookingsDocs.filter(d => d.data().status === 'confirmed').length || 0;
    const cancelledBookings = bookingsDocs.filter(d => d.data().status === 'cancelled').length || 0;

    const totalReports = reportsDocs.length;
    const pendingReports = reportsDocs.filter(d => d.data().status === 'pending').length || 0;
    const resolvedReports = reportsDocs.filter(d => d.data().status === 'resolved').length || 0;

    // Calculate revenue
    let totalRevenue = 0;
    if (bookingsDocs) {
      bookingsDocs.forEach(doc => {
        const amount = doc.data().amount || doc.data().price || 0;
        if (typeof amount === 'number') totalRevenue += amount;
      });
    }

    // Calculate average rating
    let totalRating = 0;
    let ratingCount = 0;
    if (ridesDocs) {
      ridesDocs.forEach(doc => {
        const rating = doc.data().rating;
        if (typeof rating === 'number') {
          totalRating += rating;
          ratingCount++;
        }
      });
    }
    const averageRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(2) : '0.00';

    // Get university name if universityId provided
    let universityName = '';
    if (universityId) {
      try {
        const uniSnap = await db.collection('universities').doc(universityId).get();
        if (uniSnap.exists) {
          universityName = uniSnap.data()?.name || universityId;
        }
      } catch (err) {
        console.warn('[admin/analytics] university name fetch failed', err);
      }
    }

    const last7Days = buildLast7Days();
    const ridesByDay = last7Days.map((d) => ({ label: d.label, value: 0 }));
    const revenueByDay = last7Days.map((d) => ({ label: d.label, value: 0 }));

    ridesDocs.forEach((doc) => {
      const createdAt = toDate(doc.data().createdAt || doc.data().departureTime);
      if (!createdAt) return;
      for (let i = 0; i < last7Days.length; i++) {
        const day = last7Days[i].date;
        const next = new Date(day);
        next.setDate(day.getDate() + 1);
        if (createdAt >= day && createdAt < next) {
          ridesByDay[i].value += 1;
          break;
        }
      }
    });

    bookingsDocs.forEach((doc) => {
      const createdAt = toDate(doc.data().createdAt);
      if (!createdAt) return;
      const amount = doc.data().amount || doc.data().price || 0;
      if (typeof amount !== 'number') return;
      for (let i = 0; i < last7Days.length; i++) {
        const day = last7Days[i].date;
        const next = new Date(day);
        next.setDate(day.getDate() + 1);
        if (createdAt >= day && createdAt < next) {
          revenueByDay[i].value += amount;
          break;
        }
      }
    });

    const result = {
      universityId,
      universityName,
      users: {
        total: totalUsers,
        active: activeUsers,
        verified: verifiedUsers,
        suspended: usersDocs.filter(d => d.data().status === 'suspended').length || 0,
        pending: usersDocs.filter(d => d.data().status === 'pending').length || 0,
      },
      rides: {
        total: totalRides,
        completed: completedRides,
        active: activeRides,
        cancelled: cancelledRides,
        pending: ridesDocs.filter(d => d.data().status === 'pending').length || 0,
        averageRating: parseFloat(String(averageRating)),
      },
      bookings: {
        total: totalBookings,
        confirmed: confirmedBookings,
        cancelled: cancelledBookings,
        pending: bookingsDocs.filter(d => d.data().status === 'pending').length || 0,
      },
      reports: {
        total: totalReports,
        pending: pendingReports,
        resolved: resolvedReports,
        inProgress: reportsDocs.filter(d => d.data().status === 'in_progress').length || 0,
      },
      messages: {
        total: messagesCount,
      },
      revenue: {
        total: totalRevenue,
        average: totalBookings > 0 ? (totalRevenue / totalBookings).toFixed(2) : '0.00',
      },
      ridesByDay,
      revenueByDay,
    };

    console.log('[admin/analytics] Result:', result);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('[admin/analytics] error', e);
    return NextResponse.json({ error: e?.message || 'Failed to fetch analytics' }, { status: 500 });
  }
}
