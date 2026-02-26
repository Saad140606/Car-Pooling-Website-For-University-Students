// src/app/api/confirm-password-reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/firebase/firebaseAdmin';
import crypto from 'crypto';
import admin from 'firebase-admin';

type University = 'fast' | 'ned' | 'karachi';

const MAX_RESETS_PER_WINDOW = 3;
const RESET_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function isValidUniversity(university: unknown): university is University {
  return university === 'fast' || university === 'ned' || university === 'karachi';
}

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value?.toMillis && typeof value.toMillis === 'function') return value.toMillis();
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

function logSecurityEvent(university: University, eventType: string, details: Record<string, unknown>) {
  if (!adminDb) return;
  return adminDb.collection(`universities/${university}/securityLogs`).add({
    eventType,
    ...details,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }).catch(() => undefined);
}

export async function POST(request: NextRequest) {
  try {
    const { email, newPassword, university } = await request.json();
    const clientIp = getClientIp(request);

    if (!email || !newPassword || typeof email !== 'string' || typeof newPassword !== 'string' || !isValidUniversity(university)) {
      return NextResponse.json(
        { error: 'Missing or invalid request fields' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const resetKey = crypto.createHash('sha256').update(`${university}:${normalizedEmail}`).digest('hex');
    const resetRef = adminDb.collection('passwordResets').doc(resetKey);
    const resetDoc = await resetRef.get();

    if (!resetDoc.exists || !resetDoc.data()) {
      return NextResponse.json(
        { error: 'Invalid password reset session. Please request a new code.' },
        { status: 400 }
      );
    }

    const data = resetDoc.data();
    const resetUid = String(data?.uid || '');
    const resetUniversity = data?.university;
    const resetEmail = String(data?.email || '').toLowerCase().trim();
    const lockUntilMs = toMillis(data?.lockedUntil);

    if (!resetUid || resetUniversity !== university || resetEmail !== normalizedEmail) {
      return NextResponse.json(
        { error: 'Invalid password reset session. Please request a new code.' },
        { status: 400 }
      );
    }

    if (!data?.verified) {
      return NextResponse.json(
        { error: 'Code has not been verified. Please verify your code first.' },
        { status: 403 }
      );
    }

    if (lockUntilMs > Date.now()) {
      return NextResponse.json(
        {
          error: 'Password reset is temporarily locked for this account.',
          retryAfterSeconds: Math.max(1, Math.ceil((lockUntilMs - Date.now()) / 1000)),
          lockUntil: lockUntilMs,
        },
        { status: 429 }
      );
    }

    const userRef = adminDb.collection('universities').doc(university).collection('users').doc(resetUid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await logSecurityEvent(university, 'password_reset_confirm_profile_missing', {
        uid: resetUid,
        email: normalizedEmail,
        clientIp,
      });
      return NextResponse.json(
        { error: 'Unable to complete password reset. Please try again.' },
        { status: 400 }
      );
    }

    const userData = userDoc.data();

    const userLockUntilMs = toMillis(userData?.passwordResetLockUntil);
    if (userLockUntilMs > Date.now()) {
      return NextResponse.json(
        {
          error: 'Password reset is temporarily locked for this account.',
          retryAfterSeconds: Math.max(1, Math.ceil((userLockUntilMs - Date.now()) / 1000)),
          lockUntil: userLockUntilMs,
        },
        { status: 429 }
      );
    }

    try {
      await adminAuth.updateUser(resetUid, {
        password: newPassword,
      });
    } catch (err: any) {
      await logSecurityEvent(university, 'password_reset_confirm_auth_update_failed', {
        uid: resetUid,
        email: normalizedEmail,
        clientIp,
        errorCode: err?.code || 'UNKNOWN',
      });
      return NextResponse.json(
        { error: 'Failed to update password. Please try again.' },
        { status: 500 }
      );
    }

    const now = Date.now();
    const trackingResult = await adminDb.runTransaction(async (tx) => {
      const freshUserDoc = await tx.get(userRef);
      const freshData = freshUserDoc.data() || {};
      const currentLockUntilMs = toMillis(freshData.passwordResetLockUntil);

      if (currentLockUntilMs > now) {
        return {
          locked: true,
          lockUntil: currentLockUntilMs,
          attempts: Number(freshData.passwordResetAttempts || 0),
        };
      }

      const windowStartMs = toMillis(freshData.passwordResetWindowStart);
      const isWindowExpired = !windowStartMs || now - windowStartMs >= RESET_WINDOW_MS;
      const currentAttempts = isWindowExpired ? 0 : Number(freshData.passwordResetAttempts || 0);
      const nextAttempts = currentAttempts + 1;
      const nextWindowStart = isWindowExpired ? now : windowStartMs;
      const shouldLock = nextAttempts >= MAX_RESETS_PER_WINDOW;
      const nextLockUntil = shouldLock ? now + RESET_WINDOW_MS : 0;

      tx.set(userRef, {
        passwordResetAttempts: nextAttempts,
        passwordResetWindowStart: admin.firestore.Timestamp.fromMillis(nextWindowStart),
        passwordResetLockUntil: shouldLock ? admin.firestore.Timestamp.fromMillis(nextLockUntil) : null,
        lastPasswordResetAt: admin.firestore.Timestamp.fromMillis(now),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      tx.delete(resetRef);

      return {
        locked: shouldLock,
        lockUntil: nextLockUntil || null,
        attempts: nextAttempts,
      };
    });

    if (trackingResult.locked && trackingResult.lockUntil) {
      await logSecurityEvent(university, 'password_reset_confirm_limit_reached', {
        uid: resetUid,
        email: normalizedEmail,
        clientIp,
        lockUntil: trackingResult.lockUntil,
      });
    }

    await logSecurityEvent(university, 'password_reset_confirm_success', {
      uid: resetUid,
      email: normalizedEmail,
      clientIp,
      attemptsInWindow: trackingResult.attempts,
    });

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully',
      rateLimitInfo: {
        remaining: Math.max(0, MAX_RESETS_PER_WINDOW - trackingResult.attempts),
      },
      lockUntil: trackingResult.lockUntil,
    });
  } catch (error: any) {
    console.error('Confirm password reset error:', error?.code || error?.message || 'UNKNOWN');
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
