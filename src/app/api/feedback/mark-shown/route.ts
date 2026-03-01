import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { adminAuth, adminDb } from '@/firebase/firebaseAdmin';

type FeedbackType = 'first_ride' | 'app';
type University = 'fast' | 'ned' | 'karachi';

const VALID_UNIVERSITIES: University[] = ['fast', 'ned', 'karachi'];
const VALID_TYPES: FeedbackType[] = ['first_ride', 'app'];
const APP_FEEDBACK_REPEAT_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

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
    const university = parseUniversity(body?.university);
    const type = (body?.type || 'app') as FeedbackType;

    if (!university) {
      return NextResponse.json({ success: false, error: 'Valid university is required' }, { status: 400 });
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: 'Invalid feedback type' }, { status: 400 });
    }

    const userRef = adminDb.doc(`universities/${university}/users/${authedUser.uid}`);
    const now = admin.firestore.Timestamp.now();
    const nowField = admin.firestore.FieldValue.serverTimestamp();
    const nextPromptAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + APP_FEEDBACK_REPEAT_DELAY_MS);

    await adminDb.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new Error('User profile not found');
      }

      const userData = userSnap.data() || {};
      if (type === 'first_ride') {
        const firstRideState = userData.feedback?.firstRide || {};

        if (firstRideState.submittedAt || firstRideState.doNotShowAgain === true || firstRideState.promptShownAt) {
          return;
        }

        tx.set(
          userRef,
          {
            'feedback.firstRide': {
              ...(firstRideState || {}),
              promptShownAt: nowField,
              lastPromptAt: nowField,
              doNotShowAgain: true,
              promptCount: Number(firstRideState.promptCount || 0) + 1,
              updatedAt: nowField,
              nextPromptAt: null,
            },
          },
          { merge: true }
        );
        return;
      }

      const appState = userData.feedback?.app || {};

      if (appState.submittedAt) {
        return;
      }

      tx.set(
        userRef,
        {
          'feedback.app': {
            ...(appState || {}),
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
    console.error('[Feedback MarkShown API] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to mark feedback prompt as shown' },
      { status: 500 }
    );
  }
}
