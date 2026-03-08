// src/app/api/verify-university-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { adminDb } from '@/firebase/firebaseAdmin';

const OTP_EXPIRY_MS = 10 * 60 * 1000;
// NOTE: Removed MAX_ATTEMPTS - users can retry unlimited times without lockout
// Only OTP expiry (10 minutes) limits attempts

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    let { uid, otp, universityEmail } = await request.json();

    // Sanitize and trim OTP
    if (otp) {
      otp = String(otp).trim().replace(/\s/g, '');
    }

    if (!uid || !otp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // SECURITY: Removed verbose logging to prevent information leakage

    const db = adminDb ?? getFirestore();
    const verificationRef = db.collection('email_verification_otps').doc(uid);
    const verificationDoc = await verificationRef.get();

    if (!verificationDoc.exists) {
      console.warn('No email verification OTP document found for uid:', uid);
      return NextResponse.json({ error: 'No active verification request found' }, { status: 404 });
    }

    const verificationData = verificationDoc.data();
    if (!verificationData) {
      console.warn('Invalid verification data for uid:', uid);
      return NextResponse.json({ error: 'Invalid verification data' }, { status: 400 });
    }

    const now = Date.now();
    // NOTE: Removed lockout mechanism - users can retry unlimited times
    // if (verificationData.lockedUntil && now < verificationData.lockedUntil) {
    //   console.warn('Account locked for uid:', uid);
    //   return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    // }

    if (verificationData.expiresAt < now) {
      console.warn('OTP expired for uid:', uid, 'expiresAt:', verificationData.expiresAt, 'now:', now);
      return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 410 });
    }

    if (universityEmail && verificationData.universityEmail !== universityEmail.toLowerCase()) {
      console.warn('Email mismatch for uid:', uid, 'expected:', verificationData.universityEmail, 'received:', universityEmail.toLowerCase());
      return NextResponse.json({ error: 'Email does not match the request.' }, { status: 400 });
    }

    const attemptedHash = hashOtp(otp);
    // SECURITY: OTP hash comparison - no logging of sensitive data

    if (attemptedHash !== verificationData.otpHash) {
      const attempts = (verificationData.attempts || 0) + 1;
      // NOTE: Removed lockout - just track attempts for logging/analytics
      await verificationRef.update({ attempts, updatedAt: FieldValue.serverTimestamp() });
      // Return simple "Invalid OTP" error without rate limiting
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 401 });
    }

    if (verificationData.university) {
      const uniUserRef = db
        .collection('universities')
        .doc(verificationData.university)
        .collection('users')
        .doc(uid);
      await uniUserRef.set(
        {
          universityEmail: verificationData.universityEmail,
          universityEmailVerified: true,
          universityEmailVerifiedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await verificationRef.delete();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error verifying university email:', error);
    return NextResponse.json({ error: error.message || 'Failed to verify email' }, { status: 500 });
  }
}
