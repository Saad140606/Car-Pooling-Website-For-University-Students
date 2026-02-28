import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { adminAuth, adminDb } from '@/firebase/firebaseAdmin';

type FeedbackType = 'first_ride' | 'app';
type University = 'fast' | 'ned' | 'karachi';

const VALID_UNIVERSITIES: University[] = ['fast', 'ned', 'karachi'];
const VALID_TYPES: FeedbackType[] = ['first_ride', 'app'];

function parseUniversity(value: unknown): University | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase() as University;
  return VALID_UNIVERSITIES.includes(normalized) ? normalized : null;
}

function sanitizeText(input: unknown, maxLength = 1000): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength);
}

async function getAuthUser(req: NextRequest): Promise<{ uid: string } | null> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token || !adminAuth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Server unavailable' }, { status: 500 });
    }

    const authedUser = await getAuthUser(req);
    if (!authedUser) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const type = body?.type as FeedbackType;
    const university = parseUniversity(body?.university);
    const rating = Number(body?.rating || 0);
    const category = sanitizeText(body?.category, 100);
    const comment = sanitizeText(body?.comment, 1000);

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: 'Invalid feedback type' }, { status: 400 });
    }

    if (!university) {
      return NextResponse.json({ success: false, error: 'Valid university is required' }, { status: 400 });
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json({ success: false, error: 'Category is required' }, { status: 400 });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const userRef = adminDb.doc(`universities/${university}/users/${authedUser.uid}`);
    const feedbackDocId = `${type}_${authedUser.uid}`;
    const feedbackRef = adminDb.doc(`universities/${university}/feedback_submissions/${feedbackDocId}`);

    const result = await adminDb.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new Error('User profile not found');
      }

      const userData = userSnap.data() || {};
      const feedbackState = userData.feedback || {};
      const stateNode = type === 'first_ride'
        ? (feedbackState.firstRide || {})
        : (feedbackState.app || {});

      if (stateNode.submittedAt) {
        return { alreadySubmitted: true };
      }

      const statePath = type === 'first_ride' ? 'feedback.firstRide' : 'feedback.app';

      tx.set(
        userRef,
        {
          [statePath]: {
            submittedAt: now,
            submitted: true,
            score: rating,
            category,
            comment,
            skippedAt: null,
            skipped: false,
            dismissed: true,
            dismissedAt: now,
            doNotShowAgain: true,
            updatedAt: now,
          },
        },
        { merge: true }
      );

      tx.set(
        feedbackRef,
        {
          userId: authedUser.uid,
          university,
          type,
          rating,
          category,
          comment,
          submittedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      return { alreadySubmitted: false };
    });

    return NextResponse.json({
      success: true,
      alreadySubmitted: result.alreadySubmitted,
    });
  } catch (error: any) {
    console.error('[Feedback Submit API] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
