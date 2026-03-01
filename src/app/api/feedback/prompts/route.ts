import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/firebase/firebaseAdmin';

type University = 'fast' | 'ned' | 'karachi';

const VALID_UNIVERSITIES: University[] = ['fast', 'ned', 'karachi'];
const APP_FEEDBACK_INITIAL_DELAY_MS = 3 * 24 * 60 * 60 * 1000;
const APP_FEEDBACK_REPEAT_DELAY_MS = 3 * 24 * 60 * 60 * 1000;
const FIRST_RIDE_REPEAT_DELAY_MS = 3 * 24 * 60 * 60 * 1000;

function parseUniversity(value: string | null): University | null {
  if (!value) return null;
  const normalized = value.toLowerCase() as University;
  return VALID_UNIVERSITIES.includes(normalized) ? normalized : null;
}

function toMs(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value.seconds) return value.seconds * 1000;
  return 0;
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

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Server unavailable' }, { status: 500 });
    }

    const authedUser = await getAuthUser(req);
    if (!authedUser) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const university = parseUniversity(searchParams.get('university'));

    if (!university) {
      return NextResponse.json({ success: false, error: 'Valid university is required' }, { status: 400 });
    }

    const userRef = adminDb.doc(`universities/${university}/users/${authedUser.uid}`);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ success: false, error: 'User profile not found' }, { status: 404 });
    }

    const userData = userSnap.data() || {};
    const feedbackState = userData.feedback || {};
    const firstRideState = feedbackState.firstRide || {};
    const appFeedbackState = feedbackState.app || {};

    let completedRidesCount = 0;

    const [driverCompletedSnap, passengerCompletedSnap] = await Promise.all([
      adminDb
        .collection(`universities/${university}/rides`)
        .where('driverId', '==', authedUser.uid)
        .where('lifecycleStatus', '==', 'COMPLETED')
        .limit(2)
        .get(),
      adminDb
        .collection(`universities/${university}/bookings`)
        .where('passengerId', '==', authedUser.uid)
        .where('passengerCompletion', '==', 'completed')
        .limit(2)
        .get(),
    ]);

    completedRidesCount = driverCompletedSnap.size + passengerCompletedSnap.size;

    const hasSubmittedFirstRide = Boolean(firstRideState.submittedAt || firstRideState.submitted === true);
    const firstRideLastPromptMs = toMs(firstRideState.lastPromptAt || firstRideState.skippedAt || firstRideState.updatedAt);
    const firstRideExplicitNextPromptMs = toMs(firstRideState.nextPromptAt);
    const nowMs = Date.now();
    const firstRideNextPromptAtMs = firstRideExplicitNextPromptMs > 0
      ? firstRideExplicitNextPromptMs
      : (firstRideLastPromptMs > 0 ? firstRideLastPromptMs + FIRST_RIDE_REPEAT_DELAY_MS : 0);

    const shouldShowFirstRide =
      completedRidesCount >= 1 &&
      !hasSubmittedFirstRide &&
      nowMs >= firstRideNextPromptAtMs;

    const accountCreatedAtMs = toMs(userData.createdAt || userData.registeredAt);

    const hasSubmittedApp = Boolean(appFeedbackState.submittedAt);
    const lastPromptAtMs = toMs(appFeedbackState.lastPromptAt);
    const explicitNextPromptAtMs = toMs(appFeedbackState.nextPromptAt);
    const firstEligibleAt = accountCreatedAtMs > 0
      ? accountCreatedAtMs + APP_FEEDBACK_INITIAL_DELAY_MS
      : nowMs + APP_FEEDBACK_INITIAL_DELAY_MS;
    const nextPromptAt = explicitNextPromptAtMs > 0
      ? explicitNextPromptAtMs
      : (lastPromptAtMs > 0 ? lastPromptAtMs + APP_FEEDBACK_REPEAT_DELAY_MS : firstEligibleAt);

    const shouldShowAppFeedback = !hasSubmittedApp && nowMs >= nextPromptAt;

    return NextResponse.json({
      success: true,
      prompts: {
        firstRide: {
          shouldShow: shouldShowFirstRide,
          completedRidesCount,
          hasSubmitted: hasSubmittedFirstRide,
          nextPromptAt: firstRideNextPromptAtMs,
        },
        appFeedback: {
          shouldShow: shouldShowAppFeedback,
          hasSubmitted: hasSubmittedApp,
          nextPromptAt,
          promptCount: Number(appFeedbackState.promptCount || 0),
        },
      },
    });
  } catch (error: any) {
    console.error('[Feedback Prompts API] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to get feedback prompts' },
      { status: 500 }
    );
  }
}
