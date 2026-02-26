// src/app/api/send-password-reset-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { adminDb, adminAuth } from '@/firebase/firebaseAdmin';
import admin from 'firebase-admin';
import { getUniversityEmailDomain } from '@/lib/university-verification';

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.FIREBASE_EMAIL_USER,
    pass: process.env.FIREBASE_EMAIL_PASSWORD,
  },
});

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 5 * 1000;
const MAX_RESETS_PER_WINDOW = 3;
const RESET_LOCK_MS = 14 * 24 * 60 * 60 * 1000;
const GENERIC_SUCCESS_MESSAGE = 'If the account is eligible, a verification code will be sent to your email.';

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

function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { email, university } = await request.json();
    const clientIp = getClientIp(request);

    if (!email || typeof email !== 'string' || !isValidUniversity(university)) {
      return NextResponse.json(
        { error: 'Missing or invalid request fields' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const requiredDomain = getUniversityEmailDomain(university);
    if (!requiredDomain || !normalizedEmail.endsWith(requiredDomain.toLowerCase())) {
      return NextResponse.json(
        { error: `Use your ${requiredDomain} email on this portal.` },
        { status: 400 }
      );
    }

    const genericSuccess = NextResponse.json({
      success: true,
      message: GENERIC_SUCCESS_MESSAGE,
    });

    let uid: string;
    try {
      const userRecord = await adminAuth.getUserByEmail(normalizedEmail);
      uid = userRecord.uid;
    } catch (err: any) {
      await logSecurityEvent(university, 'password_reset_request_unknown_email', {
        email: normalizedEmail,
        clientIp,
      });
      return genericSuccess;
    }

    const userRef = adminDb.collection('universities').doc(university).collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      await logSecurityEvent(university, 'password_reset_request_profile_missing', {
        uid,
        email: normalizedEmail,
        clientIp,
      });
      return genericSuccess;
    }

    const userData = userDoc.data() || {};
    const profileEmail = String(userData.email || '').toLowerCase().trim();
    const hasVerifiedEmail = Boolean(userData.universityEmailVerified || userData.emailVerified);

    if (profileEmail !== normalizedEmail || !hasVerifiedEmail) {
      await logSecurityEvent(university, 'password_reset_request_ineligible', {
        uid,
        email: normalizedEmail,
        profileEmail,
        hasVerifiedEmail,
        clientIp,
      });
      return genericSuccess;
    }

    try {
      const resetKey = crypto.createHash('sha256').update(`${university}:${normalizedEmail}`).digest('hex');
      const resetRef = adminDb.collection('passwordResets').doc(resetKey);
      const now = Date.now();

      const transactionResult = await adminDb.runTransaction(async (tx) => {
        const [freshUserDoc] = await Promise.all([tx.get(userRef)]);
        const freshData = freshUserDoc.data() || {};

        const lockUntilMs = toMillis(freshData.passwordResetLockUntil);
        if (lockUntilMs > now) {
          const retryAfterSeconds = Math.max(1, Math.ceil((lockUntilMs - now) / 1000));
          return { status: 'locked' as const, retryAfterSeconds, lockUntilMs };
        }

        const lastRequestMs = toMillis(freshData.lastPasswordResetRequestAt);
        if (lastRequestMs > 0 && now - lastRequestMs < REQUEST_COOLDOWN_MS) {
          const retryAfterSeconds = Math.max(1, Math.ceil((REQUEST_COOLDOWN_MS - (now - lastRequestMs)) / 1000));
          return { status: 'cooldown' as const, retryAfterSeconds };
        }

        const windowStartMs = toMillis(freshData.passwordResetWindowStart);
        const isWindowExpired = !windowStartMs || now - windowStartMs >= RESET_LOCK_MS;
        const effectiveAttempts = isWindowExpired ? 0 : Number(freshData.passwordResetAttempts || 0);
        const effectiveWindowStart = isWindowExpired ? now : windowStartMs;

        if (effectiveAttempts >= MAX_RESETS_PER_WINDOW) {
          const newLockUntil = now + RESET_LOCK_MS;
          tx.set(userRef, {
            passwordResetLockUntil: admin.firestore.Timestamp.fromMillis(newLockUntil),
            passwordResetWindowStart: admin.firestore.Timestamp.fromMillis(effectiveWindowStart),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
          return {
            status: 'locked' as const,
            retryAfterSeconds: Math.max(1, Math.ceil((newLockUntil - now) / 1000)),
            lockUntilMs: newLockUntil,
          };
        }

        const otp = generateOtp();
        const hashedOtp = hashOtp(otp);
        const expiresAtMs = now + OTP_EXPIRY_MS;

        tx.set(resetRef, {
          uid,
          email: normalizedEmail,
          university,
          hashedOtp,
          expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSendTime: admin.firestore.FieldValue.serverTimestamp(),
          verified: false,
          attempts: 0,
          lockedUntil: null,
          requestIp: clientIp,
        }, { merge: true });

        tx.set(userRef, {
          lastPasswordResetRequestAt: admin.firestore.Timestamp.fromMillis(now),
          passwordResetWindowStart: admin.firestore.Timestamp.fromMillis(effectiveWindowStart),
          passwordResetLockUntil: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        return { status: 'ok' as const, otp };
      });

      if (transactionResult.status === 'cooldown') {
        return NextResponse.json(
          {
            error: 'Please wait before requesting another code.',
            retryAfterSeconds: transactionResult.retryAfterSeconds,
          },
          { status: 429 }
        );
      }

      if (transactionResult.status === 'locked') {
        await logSecurityEvent(university, 'password_reset_request_locked', {
          uid,
          email: normalizedEmail,
          clientIp,
          lockUntilMs: transactionResult.lockUntilMs || null,
        });
        return NextResponse.json(
          {
            error: 'Password reset is temporarily locked for this account.',
            retryAfterSeconds: transactionResult.retryAfterSeconds,
            lockUntil: transactionResult.lockUntilMs || null,
          },
          { status: 429 }
        );
      }

      const otp = transactionResult.otp;

      const mailOptions = {
        from: process.env.FIREBASE_EMAIL_USER,
        to: normalizedEmail,
        subject: '🔐 Your Password Reset Code - Campus Ride',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; text-align: center; color: white; margin-bottom: 30px;">
              <h1 style="margin: 0; font-size: 28px;">🔐 Password Reset</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Campus Ride</p>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Hi,</p>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #555; line-height: 1.6;">
                We received a request to reset your password. Use the verification code below to proceed with resetting your password.
              </p>

              <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
                <div style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 3px; font-family: 'Courier New', monospace;">
                  ${otp}
                </div>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                  This code will expire in 15 minutes
                </p>
              </div>

              <p style="margin: 20px 0 0 0; font-size: 14px; color: #888; line-height: 1.6;">
                <strong>⚠️ Security Note:</strong> Never share this code with anyone. Our team will never ask for this code.
              </p>
            </div>

            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>Didn't request this?</strong> If you didn't request a password reset, you can safely ignore this email. Your account is secure.
              </p>
            </div>

            <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="margin: 0;">© 2026 Campus Ride. All rights reserved.</p>
              <p style="margin: 5px 0 0 0;">This is an automated message, please do not reply.</p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);

      await logSecurityEvent(university, 'password_reset_code_sent', {
        uid,
        email: normalizedEmail,
        clientIp,
      });

      return genericSuccess;
    } catch (err: any) {
      await logSecurityEvent(university, 'password_reset_send_failed', {
        email: normalizedEmail,
        clientIp,
        errorCode: err?.code || 'UNKNOWN',
      });
      console.error('Error in password reset OTP flow:', err?.code || err?.message || 'UNKNOWN');
      return NextResponse.json(
        { error: 'Unable to process password reset right now. Please try again.' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Password reset OTP API error:', error?.code || error?.message || 'UNKNOWN');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
