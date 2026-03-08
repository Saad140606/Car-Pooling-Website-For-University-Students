import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { adminDb } from '@/firebase/firebaseAdmin';
import { isValidUniversityEmail } from '@/lib/university-verification';

const OTP_EXPIRY_MS = 10 * 60 * 1000;
// NOTE: Removed MAX_ATTEMPTS - users can retry unlimited times without lockout
// Only OTP expiry (10 minutes) limits attempts

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    let { uid, otp, university } = await request.json();

    // Sanitize and trim OTP
    if (otp) {
      otp = String(otp).trim().replace(/\s/g, '');
    }

    if (!uid || !otp || !university) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ===== CRITICAL SECURITY: Validate university parameter =====
    if (!['fast', 'ned', 'karachi'].includes(university)) {
      return NextResponse.json({ error: 'Invalid university' }, { status: 400 });
    }
    // ===== END CRITICAL VALIDATION =====

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

    // ===== CRITICAL SECURITY: Enforce portal consistency =====
    // OTP must be verified on the SAME portal where signup started
    if (otpData.university !== university) {
      console.error(`SECURITY: Portal mismatch! OTP started on ${otpData.university}, verification attempted on ${university}`);
      const uniName = otpData.university === 'fast' ? 'FAST' : otpData.university === 'ned' ? 'NED' : 'Karachi';
      return NextResponse.json(
        { 
          error: `You started signup on ${uniName} University portal. Please verify your code on the same portal.`
        },
        { status: 403 } // Forbidden - trying to use OTP on wrong portal
      );
    }
    // ===== END CRITICAL SECURITY CHECK =====

    const now = Date.now();

    // NOTE: Removed lockout mechanism - users can retry unlimited times
    // if (otpData.lockedUntil && now < otpData.lockedUntil) {
    //   console.warn('Account locked for uid:', uid);
    //   return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    // }

    if (otpData.expiresAt < now) {
      console.warn('OTP expired for uid:', uid, 'expiresAt:', otpData.expiresAt, 'now:', now);
      return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 410 });
    }

    const attemptedHash = hashOtp(otp);
    // SECURITY: OTP hash comparison - no logging of sensitive data

    if (attemptedHash !== otpData.otpHash) {
      const attempts = (otpData.attempts || 0) + 1;
      // NOTE: Removed lockout - just track attempts for logging/analytics
      console.warn('Invalid OTP attempt', attempts, 'for uid:', uid);
      await signupOtpRef.update({ attempts, updatedAt: FieldValue.serverTimestamp() });
      // Return simple "Invalid OTP" error without rate limiting
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 401 });
    }

    // SECURITY: OTP verification successful - proceeding with registration

    // ===== CRITICAL: Check if email already exists in another university =====
    const allUniversities = ['fast', 'ned', 'karachi'];
    const otherUniversities = allUniversities.filter(u => u !== otpData.university);
    
    for (const otherUni of otherUniversities) {
      const otherUniUsersRef = db.collection('universities').doc(otherUni).collection('users');
      const existingEmailQuery = await otherUniUsersRef.where('email', '==', otpData.email).limit(1).get();
      
      if (!existingEmailQuery.empty) {
        console.error(`SECURITY: Email ${otpData.email} already exists in ${otherUni} university! Blocking registration.`);
        // Delete the signup OTP doc
        await signupOtpRef.delete();
        const uniName = otherUni === 'fast' ? 'FAST' : otherUni === 'ned' ? 'NED' : 'Karachi';
        return NextResponse.json(
          { 
            error: `This email is already registered with ${uniName} University. Please use a different email or sign in to your existing account.`
          },
          { status: 409 }
        );
      }
    }
    // ===== END CRITICAL CHECK =====

    // Check if the email is a university email
    const isUniversityEmail = otpData.university && isValidUniversityEmail(otpData.email, otpData.university as 'fast' | 'ned' | 'karachi');
    
    // Mark as verified only in university-scoped user doc.
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
