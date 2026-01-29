// src/app/api/send-password-reset-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { adminDb, adminAuth } from '@/firebase/firebaseAdmin';
import { checkPasswordChangeRateLimit } from '@/lib/passwordRateLimitAdmin';

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

const OTP_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const SEND_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes window
const MAX_SENDS_PER_WINDOW = 3;

function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid email' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists in Firebase Auth and get UID
    let uid: string;
    try {
      const userRecord = await adminAuth.getUserByEmail(normalizedEmail);
      uid = userRecord.uid;
    } catch (err: any) {
      // Don't reveal if email exists or not for security
      return NextResponse.json(
        { error: 'If an account exists with this email, you will receive a password reset code.' },
        { status: 200 }
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

    // Check if user exists in Firebase Auth
    try {
      // We'll store OTP in Firestore and validate the email format
      const resetRef = adminDb.collection('passwordResets').doc(normalizedEmail);
      const resetDoc = await resetRef.get();

      // Rate limiting: check if user has sent too many OTPs recently
      if (resetDoc.exists) {
        const data = resetDoc.data();
        const lastSendTime = data?.lastSendTime?.toMillis?.() || 0;
        const sendCount = data?.sendCount || 0;
        const now = Date.now();

        if (now - lastSendTime < SEND_LIMIT_WINDOW_MS && sendCount >= MAX_SENDS_PER_WINDOW) {
          return NextResponse.json(
            { error: 'Too many OTP requests. Please try again in a few minutes.' },
            { status: 429 }
          );
        }
      }

      // Generate new OTP
      const otp = generateOtp();
      const hashedOtp = hashOtp(otp);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

      // Store OTP in Firestore
      await resetRef.set({
        hashedOtp,
        expiresAt,
        email: normalizedEmail,
        createdAt: new Date(),
        lastSendTime: new Date(),
        sendCount: (resetDoc.exists ? (resetDoc.data().sendCount || 0) : 0) + 1,
        verified: false,
      });

      // Send OTP via email
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

      return NextResponse.json({
        success: true,
        message: 'Verification code sent to your email',
      });
    } catch (err: any) {
      console.error('Error in password reset OTP flow:', err);
      return NextResponse.json(
        { error: 'Failed to send OTP. Please try again.' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Password reset OTP API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
