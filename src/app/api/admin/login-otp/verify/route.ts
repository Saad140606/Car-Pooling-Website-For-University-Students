import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/adminApiAuth';
import { adminDb } from '@/firebase/firebaseAdmin';

const MAX_VERIFY_ATTEMPTS = 3;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function POST(req: Request) {
  const adminResult = await requireAdmin(req);
  if (!adminResult.ok) return adminResult.response;

  const body = await req.json().catch(() => ({}));
  const otp = String(body?.otp || '').trim().replace(/\s/g, '');
  if (!/^\d{6}$/.test(otp)) {
    return NextResponse.json({ error: 'Enter a valid 6-digit OTP.' }, { status: 400 });
  }

  const db = adminDb ?? getFirestore();
  const uid = adminResult.uid;
  const now = Date.now();

  const otpRef = db.collection('admin_login_otps').doc(uid);
  const snap = await otpRef.get();
  if (!snap.exists) {
    return NextResponse.json(
      { error: 'No OTP request found. Please request a new code.' },
      { status: 404 }
    );
  }

  const data = snap.data() || {};
  const lockedUntil = Number(data.lockedUntil || 0);
  if (lockedUntil > now) {
    return NextResponse.json(
      {
        error: 'OTP verification is temporarily locked after 3 incorrect attempts.',
        retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000),
      },
      { status: 429 }
    );
  }

  const expiresAt = Number(data.expiresAt || 0);
  if (!expiresAt || now > expiresAt) {
    return NextResponse.json(
      { error: 'OTP expired. Request a new code.' },
      { status: 401 }
    );
  }

  const currentHash = String(data.otpHash || '');
  const attemptHash = hashOtp(otp);

  if (!currentHash || attemptHash !== currentHash) {
    const nextAttempts = Number(data.verifyAttempts || 0) + 1;

    if (nextAttempts >= MAX_VERIFY_ATTEMPTS) {
      const lockUntil = now + LOCK_DURATION_MS;
      await otpRef.set(
        {
          verifyAttempts: nextAttempts,
          lockedUntil: lockUntil,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return NextResponse.json(
        {
          error: 'Too many incorrect OTP attempts. Verification is locked for 30 minutes.',
          retryAfterSeconds: Math.ceil((lockUntil - now) / 1000),
        },
        { status: 429 }
      );
    }

    await otpRef.set(
      {
        verifyAttempts: nextAttempts,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json(
      {
        error: 'Invalid OTP.',
        remainingAttempts: Math.max(0, MAX_VERIFY_ATTEMPTS - nextAttempts),
      },
      { status: 401 }
    );
  }

  await otpRef.delete();

  return NextResponse.json({ success: true, message: 'OTP verified successfully.' });
}
