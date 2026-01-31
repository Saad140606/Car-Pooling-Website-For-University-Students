/**
 * Verify Password Reset Code API
 * 
 * SECURITY: Implements brute force protection with attempt limiting and lockout
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/firebase/firebaseAdmin';
import {
  applyRateLimit,
  isValidEmail,
  getClientIP,
  errorResponse,
  successResponse,
  RATE_LIMITS,
} from '@/lib/api-security';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: NextRequest) {
  // ===== RATE LIMITING =====
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.OTP_VERIFY);
  if (rateLimitResult instanceof NextResponse) {
    return rateLimitResult;
  }

  try {
    const { email, code } = await request.json();

    // ===== INPUT VALIDATION =====
    if (!email || !code || typeof email !== 'string' || typeof code !== 'string') {
      return errorResponse('Missing or invalid email or code', 400);
    }

    if (!isValidEmail(email)) {
      return errorResponse('Invalid email format', 400);
    }

    // Validate code format (6 digits)
    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      return errorResponse('Invalid code format', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const hashedCode = hashOtp(trimmedCode);

    // Retrieve OTP from Firestore
    const resetRef = adminDb.collection('passwordResets').doc(normalizedEmail);
    const resetDoc = await resetRef.get();

    if (!resetDoc.exists) {
      // SECURITY: Generic message to prevent email enumeration
      return errorResponse('Invalid or expired verification code', 400);
    }

    const data = resetDoc.data();
    
    // ===== BRUTE FORCE PROTECTION =====
    const attempts = (data?.attempts || 0) as number;
    const lockedUntil = data?.lockedUntil?.toDate?.()?.getTime() || 0;

    // Check if account is locked
    if (lockedUntil > Date.now()) {
      const remainingMinutes = Math.ceil((lockedUntil - Date.now()) / 60000);
      return errorResponse(
        `Too many failed attempts. Please try again in ${remainingMinutes} minutes.`,
        429
      );
    }

    const expiresAt = data?.expiresAt?.toDate?.() || new Date(0);
    const storedHash = data?.hashedOtp;

    // Check if OTP has expired
    if (Date.now() > expiresAt.getTime()) {
      return errorResponse('Verification code has expired. Please request a new one.', 400);
    }

    // Verify OTP (compare hashes)
    if (hashedCode !== storedHash) {
      // Increment attempt counter
      const newAttempts = attempts + 1;
      const updateData: Record<string, any> = {
        attempts: newAttempts,
        lastAttemptAt: new Date(),
        lastAttemptIP: getClientIP(request),
      };

      // Lock if max attempts exceeded
      if (newAttempts >= MAX_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await resetRef.update(updateData);
        return errorResponse(
          'Too many failed attempts. Please try again in 15 minutes.',
          429
        );
      }

      await resetRef.update(updateData);
      const remainingAttempts = MAX_ATTEMPTS - newAttempts;
      return errorResponse(
        `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
        400
      );
    }

    // ===== SUCCESS: Mark as verified =====
    await resetRef.update({
      verified: true,
      verifiedAt: new Date(),
      attempts: 0, // Reset attempts on success
      lockedUntil: null,
    });

    return successResponse({
      success: true,
      message: 'Code verified successfully',
    });
  } catch (error: any) {
    // SECURITY: Generic error message
    console.error('Verify password reset code error:', error.code || 'UNKNOWN');
    return errorResponse('Failed to verify code. Please try again.', 500);
  }
}
