import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { adminDb } from '@/firebase/firebaseAdmin';
import { requireAdmin } from '@/lib/api-security';

type University = 'fast' | 'ned' | 'karachi';
type FeedbackType = 'first_ride' | 'app';

const UNIVERSITIES: University[] = ['fast', 'ned', 'karachi'];

function parseDays(value: string | null): number {
  const parsed = Number(value || '30');
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return Math.min(Math.floor(parsed), 365);
}

function toDateString(value: any): string {
  if (!value) return '';
  let date: Date | null = null;
  if (typeof value.toDate === 'function') {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    date = new Date(value);
  }
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Server unavailable' }, { status: 500 });
    }

    const adminUser = await requireAdmin(req);
    if (adminUser instanceof NextResponse) {
      return adminUser;
    }

    const { searchParams } = new URL(req.url);
    const universityParam = (searchParams.get('university') || 'all').toLowerCase();
    const typeParam = (searchParams.get('type') || 'all').toLowerCase();
    const days = parseDays(searchParams.get('days'));

    const targetUniversities: University[] = universityParam === 'all'
      ? UNIVERSITIES
      : (UNIVERSITIES.includes(universityParam as University) ? [universityParam as University] : []);

    if (targetUniversities.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid university filter' }, { status: 400 });
    }

    if (!['all', 'first_ride', 'app'].includes(typeParam)) {
      return NextResponse.json({ success: false, error: 'Invalid type filter' }, { status: 400 });
    }

    const since = admin.firestore.Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000);

    const docs: Array<{ id: string; data: any }> = [];

    for (const university of targetUniversities) {
      let queryRef: FirebaseFirestore.Query = adminDb
        .collection(`universities/${university}/feedback_submissions`)
        .where('submittedAt', '>=', since);

      if (typeParam !== 'all') {
        queryRef = queryRef.where('type', '==', typeParam as FeedbackType);
      }

      const snap = await queryRef.limit(1000).get();
      snap.docs.forEach((doc) => docs.push({ id: doc.id, data: doc.data() }));
    }

    const byType: Record<string, number> = { first_ride: 0, app: 0 };
    const byUniversity: Record<string, number> = { fast: 0, ned: 0, karachi: 0 };
    const ratingDistribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    const categoryDistribution: Record<string, number> = {};
    const trendByDate: Record<string, number> = {};

    let ratingTotal = 0;

    for (const item of docs) {
      const data = item.data || {};
      const rating = Number(data.rating || 0);
      const type = String(data.type || '');
      const university = String(data.university || '').toLowerCase();
      const category = String(data.category || 'Other').trim() || 'Other';
      const dateKey = toDateString(data.submittedAt || data.createdAt);

      if (type === 'first_ride' || type === 'app') {
        byType[type] = (byType[type] || 0) + 1;
      }

      if (university in byUniversity) {
        byUniversity[university] = (byUniversity[university] || 0) + 1;
      }

      if (rating >= 1 && rating <= 5) {
        ratingDistribution[String(rating)] = (ratingDistribution[String(rating)] || 0) + 1;
        ratingTotal += rating;
      }

      categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;

      if (dateKey) {
        trendByDate[dateKey] = (trendByDate[dateKey] || 0) + 1;
      }
    }

    const totalSubmissions = docs.length;
    const averageRating = totalSubmissions > 0 ? Number((ratingTotal / totalSubmissions).toFixed(2)) : 0;

    const recentResponses = docs
      .sort((a, b) => {
        const aTime = a.data?.submittedAt?.toMillis?.() || 0;
        const bTime = b.data?.submittedAt?.toMillis?.() || 0;
        return bTime - aTime;
      })
      .slice(0, 50)
      .map((item) => ({
        id: item.id,
        userId: item.data.userId || '',
        university: item.data.university || '',
        type: item.data.type || '',
        rating: Number(item.data.rating || 0),
        category: item.data.category || 'Other',
        comment: item.data.comment || '',
        submittedAt: item.data.submittedAt?.toDate?.()?.toISOString?.() || null,
      }));

    const trend = Object.entries(trendByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      filters: {
        university: universityParam,
        type: typeParam,
        days,
      },
      summary: {
        totalSubmissions,
        averageRating,
        byType,
        byUniversity,
        ratingDistribution,
        categoryDistribution,
      },
      trend,
      recentResponses,
    });
  } catch (error: any) {
    console.error('[Admin Feedback Analytics API] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to load feedback analytics' },
      { status: 500 }
    );
  }
}
