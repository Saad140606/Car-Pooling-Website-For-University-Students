/**
 * Verify Password Reset Code API
 * 
 * SECURITY: Implements brute force protection with attempt limiting and lockout
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/firebase/firebaseAdmin';
import admin from 'firebase-admin';
import {
  applyRateLimit,
  isValidEmail,
  getClientIP,
  errorResponse,
  successResponse,
  RATE_LIMITS,
} from '@/lib/api-security';

const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
type University = 'fast' | 'ned' | 'karachi';

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

function logSecurityEvent(university: University, eventType: string, details: Record<string, unknown>) {
  if (!adminDb) return;
  return adminDb.collection(`universities/${university}/securityLogs`).add({
    eventType,
    ...details,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }).catch(() => undefined);
}

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
    const { email, code, university } = await request.json();

    // ===== INPUT VALIDATION =====
    if (!email || !code || typeof email !== 'string' || typeof code !== 'string' || !isValidUniversity(university)) {
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

    const resetKey = crypto.createHash('sha256').update(`${university}:${normalizedEmail}`).digest('hex');
    const resetRef = adminDb.collection('passwordResets').doc(resetKey);
    const resetDoc = await resetRef.get();

    if (!resetDoc.exists) {
      return errorResponse('Invalid or expired verification code', 400);
    }

    const data = resetDoc.data();
    if (!data || data.email !== normalizedEmail || data.university !== university) {
      return errorResponse('Invalid or expired verification code', 400);
    }
    
    const attempts = Number(data?.attempts || 0);
    const lockedUntil = toMillis(data?.lockedUntil);

    if (lockedUntil > Date.now()) {
      const remainingMinutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
      return errorResponse(
        `Too many failed attempts. Please try again in ${remainingMinutes} minutes.`,
        429
      );
    }

    const expiresAt = toMillis(data?.expiresAt);
    const storedHash = data?.hashedOtp;

    if (!expiresAt || Date.now() > expiresAt) {
      return errorResponse('Verification code has expired. Please request a new one.', 400);
    }

    if (hashedCode !== storedHash) {
      const newAttempts = attempts + 1;
      const updateData: Record<string, unknown> = {
        attempts: newAttempts,
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        lastAttemptIP: getClientIP(request),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (newAttempts >= MAX_ATTEMPTS) {
        updateData.lockedUntil = admin.firestore.Timestamp.fromMillis(Date.now() + LOCKOUT_DURATION_MS);
      }

      await resetRef.set(updateData, { merge: true });

      if (newAttempts >= MAX_ATTEMPTS) {
        if (data.uid) {
          await adminDb.collection('universities').doc(university).collection('users').doc(String(data.uid)).set({
            passwordResetLockUntil: admin.firestore.Timestamp.fromMillis(Date.now() + LOCKOUT_DURATION_MS),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        await logSecurityEvent(university, 'password_reset_code_locked', {
          uid: data.uid || null,
          email: normalizedEmail,
          clientIp: getClientIP(request),
        });

        return errorResponse('Too many failed attempts. Please try again later.', 429);
      }

      const remainingAttempts = Math.max(0, MAX_ATTEMPTS - newAttempts);
      return errorResponse(
        `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
        400
      );
    }

    await resetRef.set({
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      attempts: 0,
      lockedUntil: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await logSecurityEvent(university, 'password_reset_code_verified', {
      uid: data.uid || null,
      email: normalizedEmail,
      clientIp: getClientIP(request),
    });

    return successResponse({
      success: true,
      message: 'Code verified successfully',
    });
  } catch (error: any) {
    console.error('Verify password reset code error:', error.code || 'UNKNOWN');
    return errorResponse('Failed to verify code. Please try again.', 500);
  }
}
