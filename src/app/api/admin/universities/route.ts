import admin from '@/firebase/firebaseAdmin';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminApiAuth';
import type { Firestore, DocumentSnapshot } from 'firebase-admin/firestore';

type DocSnap = DocumentSnapshot;

async function fetchUniDocs(
  db: Firestore,
  uniId: string,
  collectionName: string
) {
  const docsByPath = new Map<string, DocSnap>();
  const addDocs = (docs: DocSnap[] | undefined | null) => {
    if (!docs) return;
    for (const d of docs) docsByPath.set(d.ref.path, d);
  };

  // University-scoped subcollection
  try {
    const uniSnap = await db
      .collection('universities')
      .doc(uniId)
      .collection(collectionName)
      .get();
    addDocs(uniSnap.docs);
  } catch (err) {
    console.warn(`[admin/universities] ${collectionName} subcollection failed for ${uniId}`, err);
  }

  // Top-level collection with possible field names
  try {
    const topSnapA = await db.collection(collectionName).where('university', '==', uniId).get();
    addDocs(topSnapA.docs);
  } catch (err) {
    console.warn(`[admin/universities] ${collectionName} top-level university filter failed for ${uniId}`, err);
  }

  try {
    const topSnapB = await db.collection(collectionName).where('universityId', '==', uniId).get();
    addDocs(topSnapB.docs);
  } catch (err) {
    console.warn(`[admin/universities] ${collectionName} top-level universityId filter failed for ${uniId}`, err);
  }

  return Array.from(docsByPath.values());
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const db = admin.firestore();

    console.log('[admin/universities] Fetching all universities...');

    // Fetch all universities
    const universitiesSnap = await db.collection('universities').get().catch(err => {
      console.error('[admin/universities] universities fetch failed', err);
      return null;
    });

    if (!universitiesSnap || universitiesSnap.size === 0) {
      console.warn('[admin/universities] no universities found');
      return NextResponse.json({ universities: [], comparison: [] });
    }

    const universities: any[] = [];

    // For each university, aggregate stats
    for (const uniDoc of universitiesSnap.docs) {
      const uniId = uniDoc.id;
      const uniData = uniDoc.data();

      try {
        // Count users
        const usersDocs = await fetchUniDocs(db, uniId, 'users');
        const totalUsers = usersDocs.length;
        const activeUsers = usersDocs.filter(d => d.data().status === 'active').length;
        const verifiedUsers = usersDocs.filter(d => d.data().verified === true).length;

        // Count rides
        const ridesDocs = await fetchUniDocs(db, uniId, 'rides');
        const totalRides = ridesDocs.length;
        const completedRides = ridesDocs.filter(d => d.data().status === 'completed').length || 0;
        const activeRides = ridesDocs.filter(d => ['active', 'in_progress'].includes(d.data().status)).length || 0;

        // Count bookings
        const bookingsDocs = await fetchUniDocs(db, uniId, 'bookings');
        const totalBookings = bookingsDocs.length;
        const confirmedBookings = bookingsDocs.filter(d => d.data().status === 'confirmed').length;

        // Count reports
        const reportsDocs = await fetchUniDocs(db, uniId, 'reports');
        const totalReports = reportsDocs.length;
        const resolvedReports = reportsDocs.filter(d => d.data().status === 'resolved').length;

        // Count messages
        let totalMessages = 0;
        try {
          const chatsDocs = await fetchUniDocs(db, uniId, 'chats');
          for (const chatDoc of chatsDocs) {
            const messagesSnap = await chatDoc.ref.collection('messages').get();
            totalMessages += messagesSnap.size;
          }
        } catch (err) {
          console.warn(`[admin/universities] messages fetch failed for ${uniId}`, err);
        }

        // Calculate revenue
        let totalRevenue = 0;
        bookingsDocs.forEach(doc => {
          const amount = doc.data().amount || doc.data().price || 0;
          if (typeof amount === 'number') totalRevenue += amount;
        });

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

        universities.push({
          id: uniId,
          name: uniData.name || uniId,
          abbreviation: uniData.abbreviation || uniId.substring(0, 3).toUpperCase(),
          users: {
            total: totalUsers,
            active: activeUsers,
            verified: verifiedUsers,
          },
          rides: {
            total: totalRides,
            completed: completedRides,
            active: activeRides,
            averageRating: parseFloat(String(averageRating)),
          },
          bookings: {
            total: totalBookings,
            confirmed: confirmedBookings,
          },
          reports: {
            total: totalReports,
            resolved: resolvedReports,
          },
          messages: {
            total: totalMessages,
          },
          revenue: {
            total: totalRevenue,
          },
        });

        console.log(`[admin/universities] Processed ${uniData.name}: ${totalUsers} users, ${totalRides} rides`);
      } catch (err) {
        console.error(`[admin/universities] error processing ${uniId}`, err);
        universities.push({
          id: uniId,
          name: uniData.name || uniId,
          users: { total: 0, active: 0, verified: 0 },
          rides: { total: 0, completed: 0, active: 0, averageRating: 0 },
          bookings: { total: 0, confirmed: 0 },
          reports: { total: 0, resolved: 0 },
          messages: { total: 0 },
          revenue: { total: 0 },
        });
      }
    }

    // Create comparison data
    const comparison = universities.map(uni => ({
      name: uni.name,
      users: uni.users.total,
      rides: uni.rides.total,
      bookings: uni.bookings.total,
      revenue: uni.revenue.total,
      rating: uni.rides.averageRating,
    }));

    console.log(`[admin/universities] Fetched ${universities.length} universities`);

    return NextResponse.json({
      universities,
      comparison,
      total: universities.length,
    });
  } catch (e: any) {
    console.error('[admin/universities] error', e);
    return NextResponse.json({ error: e?.message || 'Failed to fetch universities' }, { status: 500 });
  }
}
