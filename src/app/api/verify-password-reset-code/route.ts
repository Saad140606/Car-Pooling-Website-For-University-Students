// src/app/api/verify-password-reset-code/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb, adminAuth } from '@/firebase/firebaseAdmin';

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code || typeof email !== 'string' || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid email or code' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const hashedCode = hashOtp(code.trim());

    // Retrieve OTP from Firestore
    const resetRef = adminDb.collection('passwordResets').doc(normalizedEmail);
    const resetDoc = await resetRef.get();

    if (!resetDoc.exists) {
      return NextResponse.json(
        { error: 'No password reset request found for this email' },
        { status: 404 }
      );
    }

    const data = resetDoc.data();
    const expiresAt = data?.expiresAt?.toDate?.() || new Date(0);
    const storedHash = data?.hashedOtp;

    // Check if OTP has expired
    if (Date.now() > expiresAt.getTime()) {
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Verify OTP (compare hashes)
    if (hashedCode !== storedHash) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Mark as verified in Firestore (will be used to confirm password reset)
    await resetRef.update({
      verified: true,
      verifiedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Code verified successfully',
    });
  } catch (error: any) {
    console.error('Verify password reset code error:', error);
    return NextResponse.json(
      { error: 'Failed to verify code' },
      { status: 500 }
    );
  }
}
