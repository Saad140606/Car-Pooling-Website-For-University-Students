import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { adminDb } from '@/firebase/firebaseAdmin';

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    let { uid, otp } = await request.json();

    // Sanitize and trim OTP
    if (otp) {
      otp = String(otp).trim().replace(/\s/g, '');
    }

    if (!uid || !otp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log('Verifying OTP for uid:', uid, 'OTP length:', otp.length);

    const db = adminDb ?? getFirestore();
    const signupOtpRef = db.collection('signup_otps').doc(uid);
    const signupOtpDoc = await signupOtpRef.get();

    if (!signupOtpDoc.exists) {
      console.warn('No signup OTP document found for uid:', uid);
      return NextResponse.json({ error: 'No active verification request found' }, { status: 404 });
    }

    const otpData = signupOtpDoc.data();
    if (!otpData) {
      console.warn('Invalid OTP data for uid:', uid);
      return NextResponse.json({ error: 'Invalid verification data' }, { status: 400 });
    }

    const now = Date.now();

    if (otpData.lockedUntil && now < otpData.lockedUntil) {
      console.warn('Account locked for uid:', uid);
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    if (otpData.expiresAt < now) {
      console.warn('OTP expired for uid:', uid, 'expiresAt:', otpData.expiresAt, 'now:', now);
      return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 410 });
    }

    const attemptedHash = hashOtp(otp);
    console.log('OTP verification attempt:');
    console.log('  Stored hash:', otpData.otpHash);
    console.log('  Attempted hash:', attemptedHash);
    console.log('  OTP input:', otp);

    if (attemptedHash !== otpData.otpHash) {
      const attempts = (otpData.attempts || 0) + 1;
      const lockedUntil = attempts >= MAX_ATTEMPTS ? now + OTP_EXPIRY_MS : null;
      console.warn('Invalid OTP attempt', attempts, 'for uid:', uid);
      await signupOtpRef.update({ attempts, lockedUntil, updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 401 });
    }

    console.log('OTP verified successfully for uid:', uid);

    // Mark email as verified in users collection
    const userRef = db.collection('users').doc(uid);
    await userRef.set(
      {
        email: otpData.email,
        emailVerified: true,
        emailVerifiedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Also mark in university-scoped users if university is available
    if (otpData.university) {
      const uniUserRef = db.collection('universities').doc(otpData.university).collection('users').doc(uid);
      await uniUserRef.set(
        {
          emailVerified: true,
          emailVerifiedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    // Delete the signup OTP doc
    await signupOtpRef.delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error verifying signup email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify email' },
      { status: 500 }
    );
  }
}
