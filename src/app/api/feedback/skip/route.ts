import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { adminAuth, adminDb } from '@/firebase/firebaseAdmin';

type FeedbackType = 'first_ride' | 'app';
type University = 'fast' | 'ned' | 'karachi';

const VALID_UNIVERSITIES: University[] = ['fast', 'ned', 'karachi'];
const VALID_TYPES: FeedbackType[] = ['first_ride', 'app'];
const APP_FEEDBACK_REPEAT_DELAY_MS = 5 * 24 * 60 * 60 * 1000;

function parseUniversity(value: unknown): University | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase() as University;
  return VALID_UNIVERSITIES.includes(normalized) ? normalized : null;
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

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: 'Invalid feedback type' }, { status: 400 });
    }

    if (!university) {
      return NextResponse.json({ success: false, error: 'Valid university is required' }, { status: 400 });
    }

    const userRef = adminDb.doc(`universities/${university}/users/${authedUser.uid}`);
    const now = admin.firestore.Timestamp.now();
    const nowField = admin.firestore.FieldValue.serverTimestamp();

    await adminDb.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new Error('User profile not found');
      }

      const userData = userSnap.data() || {};
      const feedback = userData.feedback || {};

      if (type === 'first_ride') {
        const firstRide = feedback.firstRide || {};
        if (firstRide.submittedAt || firstRide.skippedAt) {
          return;
        }

        tx.set(
          userRef,
          {
            'feedback.firstRide': {
              ...(firstRide || {}),
              skippedAt: nowField,
              skipped: true,
              dismissed: true,
              dismissedAt: nowField,
              doNotShowAgain: true,
              updatedAt: nowField,
            },
          },
          { merge: true }
        );
        return;
      }

      const appState = feedback.app || {};
      if (appState.submittedAt) {
        return;
      }

      const nextPromptAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + APP_FEEDBACK_REPEAT_DELAY_MS);

      tx.set(
        userRef,
        {
          'feedback.app': {
            ...(appState || {}),
            skippedAt: nowField,
            lastPromptAt: nowField,
            nextPromptAt,
            promptCount: Number(appState.promptCount || 0) + 1,
            updatedAt: nowField,
          },
        },
        { merge: true }
      );
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Feedback Skip API] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to skip feedback prompt' },
      { status: 500 }
    );
  }
}
