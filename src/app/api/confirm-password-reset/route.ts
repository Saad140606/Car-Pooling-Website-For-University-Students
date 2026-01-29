// src/app/api/confirm-password-reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/firebase/firebaseAdmin';
import { checkPasswordChangeRateLimit, getUpdatedPasswordChangeTracking } from '@/lib/passwordRateLimitAdmin';

export async function POST(request: NextRequest) {
  try {
    const { email, newPassword } = await request.json();

    if (!email || !newPassword || typeof email !== 'string' || typeof newPassword !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid email or password' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify that the code was verified
    const resetRef = adminDb.collection('passwordResets').doc(normalizedEmail);
    const resetDoc = await resetRef.get();

    if (!resetDoc.exists) {
      return NextResponse.json(
        { error: 'No password reset request found' },
        { status: 404 }
      );
    }

    const data = resetDoc.data();

    if (!data?.verified) {
      return NextResponse.json(
        { error: 'Code has not been verified. Please verify your code first.' },
        { status: 403 }
      );
    }

    // Find the user by email in Firebase Auth
    let uid: string;
    try {
      const userRecord = await adminAuth.getUserByEmail(normalizedEmail);
      uid = userRecord.uid;
    } catch (err: any) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check password change rate limit (3 changes per 14 days)
    const userRef = adminDb.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    
    const rateLimitCheck = checkPasswordChangeRateLimit({
      passwordChangeCount: userData?.passwordChangeCount,
      passwordChangeWindowStart: userData?.passwordChangeWindowStart,
    });

    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { 
          error: rateLimitCheck.message,
          rateLimitInfo: {
            count: rateLimitCheck.count,
            remaining: rateLimitCheck.remaining,
            resetDate: rateLimitCheck.resetDate,
          }
        },
        { status: 429 }
      );
    }

    // Update password in Firebase Auth
    try {
      await adminAuth.updateUser(uid, {
        password: newPassword,
      });
    } catch (err: any) {
      console.error('Error updating password:', err);
      return NextResponse.json(
        { error: 'Failed to update password. Please try again.' },
        { status: 500 }
      );
    }

    // Update rate limit tracking (atomic operation)
    const updatedTracking = getUpdatedPasswordChangeTracking({
      passwordChangeCount: userData?.passwordChangeCount,
      passwordChangeWindowStart: userData?.passwordChangeWindowStart,
    });

    await userRef.set({
      passwordChangeCount: updatedTracking.passwordChangeCount,
      passwordChangeWindowStart: updatedTracking.passwordChangeWindowStart,
    }, { merge: true });

    // Clean up the password reset document
    await resetRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully',
      rateLimitInfo: {
        remaining: Math.max(0, 3 - updatedTracking.passwordChangeCount),
      }
    });
  } catch (error: any) {
    console.error('Confirm password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
