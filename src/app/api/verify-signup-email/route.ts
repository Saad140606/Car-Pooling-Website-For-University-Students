import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { adminDb } from '@/firebase/firebaseAdmin';
import { isValidUniversityEmail } from '@/lib/university-verification';

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

    // SECURITY: Removed verbose logging to prevent information leakage

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
    // SECURITY: OTP hash comparison - no logging of sensitive data

    if (attemptedHash !== otpData.otpHash) {
      const attempts = (otpData.attempts || 0) + 1;
      const lockedUntil = attempts >= MAX_ATTEMPTS ? now + OTP_EXPIRY_MS : null;
      console.warn('Invalid OTP attempt', attempts, 'for uid:', uid);
      await signupOtpRef.update({ attempts, lockedUntil, updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 401 });
    }

    // SECURITY: OTP verification successful - proceeding with registration

    // ===== CRITICAL: Check if email already exists in another university =====
    const otherUni = otpData.university === 'fast' ? 'ned' : 'fast';
    const otherUniUsersRef = db.collection('universities').doc(otherUni).collection('users');
    const existingEmailQuery = await otherUniUsersRef.where('email', '==', otpData.email).limit(1).get();
    
    if (!existingEmailQuery.empty) {
      console.error(`SECURITY: Email ${otpData.email} already exists in ${otherUni} university! Blocking registration.`);
      // Delete the signup OTP doc
      await signupOtpRef.delete();
      return NextResponse.json(
        { 
          error: `This email is already registered with ${otherUni === 'fast' ? 'FAST' : 'NED'} University. Please use a different email or sign in to your existing account.`
        },
        { status: 409 }
      );
    }
    // ===== END CRITICAL CHECK =====

    // Check if the email is a university email
    const isUniversityEmail = otpData.university && isValidUniversityEmail(otpData.email, otpData.university as 'fast' | 'ned');
    
    // Mark email as verified in users collection
    const userRef = db.collection('users').doc(uid);
    const updateData: any = {
      email: otpData.email,
      emailVerified: true,
      emailVerifiedAt: FieldValue.serverTimestamp(),
    };

    // If it's a valid university email, also mark university email as verified
    if (isUniversityEmail) {
      updateData.universityEmail = otpData.email;
      updateData.universityEmailVerified = true;
      updateData.universityEmailVerifiedAt = FieldValue.serverTimestamp();
      console.log('University email verified for uid:', uid);
    }

    await userRef.set(updateData, { merge: true });

    // Also mark in university-scoped users if university is available
    if (otpData.university) {
      const uniUserRef = db.collection('universities').doc(otpData.university).collection('users').doc(uid);
      const uniUpdateData: any = {
        email: otpData.email,  // ===== CRITICAL: Store email in university-scoped collection so check-email-available can find it =====
        emailVerified: true,
        emailVerifiedAt: FieldValue.serverTimestamp(),
      };

      if (isUniversityEmail) {
        uniUpdateData.universityEmail = otpData.email;
        uniUpdateData.universityEmailVerified = true;
        uniUpdateData.universityEmailVerifiedAt = FieldValue.serverTimestamp();
      }

      await uniUserRef.set(uniUpdateData, { merge: true });
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
