// src/app/api/send-verification-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { adminDb } from '@/firebase/firebaseAdmin';
import { getUniversityEmailDomain } from '@/lib/university-verification';

// Configure email transporter (using Gmail SMTP)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.FIREBASE_EMAIL_USER,
    pass: process.env.FIREBASE_EMAIL_PASSWORD,
  },
});

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Short-term rate limiting (prevent rapid requests)
const SHORT_TERM_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SENDS_SHORT_TERM = 3; // Max 3 in 10 minutes

// LONG-TERM rate limiting: Maximum 3 codes per 14 days
// This prevents abuse of verification system
const LONG_TERM_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
const MAX_CODES_PER_14_DAYS = 3; // Hard limit: 3 codes per 14 days

function generateOtp(): string {
  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  return otp;
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { uid, universityEmail, university } = await request.json();

    if (!uid || !universityEmail || !university) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate the email domain (allowlist via helper)
    const expectedDomain = getUniversityEmailDomain(university as 'fast' | 'ned');
    if (!universityEmail.toLowerCase().endsWith(expectedDomain.toLowerCase())) {
      return NextResponse.json(
        { error: `Email must end with ${expectedDomain}` },
        { status: 400 }
      );
    }

    const now = Date.now();
    const db = adminDb ?? getFirestore();
    
    // ============================================
    // RATE LIMIT CHECK: 3 codes per 14 days
    // ============================================
    const rateLimitRef = db.collection('verification_rate_limits').doc(uid);
    const rateLimitSnap = await rateLimitRef.get();
    const rateLimitData = rateLimitSnap.exists ? rateLimitSnap.data() : null;
    
    // Get existing code requests within the 14-day window
    let codeRequests: number[] = [];
    if (rateLimitData?.codeRequests && Array.isArray(rateLimitData.codeRequests)) {
      // Filter to only include requests within the 14-day window
      codeRequests = (rateLimitData.codeRequests as number[]).filter(
        (timestamp: number) => now - timestamp < LONG_TERM_WINDOW_MS
      );
    }
    
    // Check if user has exceeded the 14-day limit
    if (codeRequests.length >= MAX_CODES_PER_14_DAYS) {
      // Calculate when the oldest request will expire
      const oldestRequest = Math.min(...codeRequests);
      const resetTime = new Date(oldestRequest + LONG_TERM_WINDOW_MS);
      const daysUntilReset = Math.ceil((oldestRequest + LONG_TERM_WINDOW_MS - now) / (24 * 60 * 60 * 1000));
      
      return NextResponse.json(
        { 
          error: `You have reached the maximum of ${MAX_CODES_PER_14_DAYS} verification codes per 14 days. Please try again in ${daysUntilReset} day${daysUntilReset > 1 ? 's' : ''}.`,
          resetAt: resetTime.toISOString(),
          remainingCodes: 0,
          windowDays: 14
        },
        { status: 429 }
      );
    }

    // Generate OTP
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = now + OTP_EXPIRY_MS;

    // Store OTP in Firestore with short-term rate limiting
    const verificationRef = db.collection('email_verification_otps').doc(uid);
    const snapshot = await verificationRef.get();
    const data = snapshot.exists ? snapshot.data() : null;

    // Short-term rate limiting (3 per 10 minutes)
    let sendCount = 0;
    let sendWindowStart = now;
    if (data && data.sendWindowStart && data.sendCount) {
      const windowStart = data.sendWindowStart as number;
      if (now - windowStart <= SHORT_TERM_WINDOW_MS) {
        sendCount = data.sendCount as number;
        sendWindowStart = windowStart;
      }
    }
    if (sendCount >= MAX_SENDS_SHORT_TERM) {
      const minutesRemaining = Math.ceil((sendWindowStart + SHORT_TERM_WINDOW_MS - now) / 60000);
      return NextResponse.json(
        { error: `Too many requests. Please wait ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''} before requesting another code.` },
        { status: 429 }
      );
    }

    // Update OTP document
    await verificationRef.set({
      uid,
      universityEmail: universityEmail.toLowerCase(),
      university,
      otpHash,
      expiresAt,
      attempts: 0,
      lockedUntil: null,
      sendCount: sendCount + 1,
      sendWindowStart,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    // Update 14-day rate limit tracking
    // Add current request timestamp to the list
    const updatedCodeRequests = [...codeRequests, now];
    await rateLimitRef.set({
      uid,
      codeRequests: updatedCodeRequests,
      lastRequestAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Create email HTML
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3F51B5;">Your Campus Ride Verification Code</h2>
        <p>Hello,</p>
        <p>Use the code below to verify your university email. It expires in 10 minutes.</p>
        <p style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; background: #3F51B5; color: white; padding: 12px 24px; font-size: 20px; letter-spacing: 4px; border-radius: 6px;">${otp}</span>
        </p>
        <p style="color: #666; font-size: 12px;">If you didn’t request this, you can ignore this email.</p>
        <p style="color: #666; font-size: 12px;">Campus Ride - Trusted badge for verified university emails.</p>
      </div>
    `;

    // Send email using Nodemailer (Gmail SMTP)
    if (process.env.FIREBASE_EMAIL_USER && process.env.FIREBASE_EMAIL_PASSWORD) {
      try {
        await transporter.sendMail({
          from: process.env.FIREBASE_EMAIL_USER,
          to: universityEmail,
          subject: 'Your Campus Ride Verification Code',
          html,
        });
        // SECURITY: Only log minimal info in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Verification OTP sent to:', universityEmail);
        }
      } catch (emailError: any) {
        // SECURITY: Log minimal error info, never expose to client
        console.error('Email send failed:', emailError.code || 'UNKNOWN');
        return NextResponse.json(
          { error: 'Failed to send verification email. Please try again.' },
          { status: 500 }
        );
      }
    } else {
      // SECURITY: In production, this should fail if email is not configured
      if (process.env.NODE_ENV === 'production') {
        console.error('CRITICAL: Email credentials not configured in production');
        return NextResponse.json(
          { error: 'Email service unavailable' },
          { status: 503 }
        );
      }
      console.log('DEV MODE: Email would be sent to:', universityEmail);
    }

    // SECURITY: NEVER return OTP in response - even in dev mode
    // Include rate limit info for user feedback
    const remainingCodes = MAX_CODES_PER_14_DAYS - updatedCodeRequests.length;
    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your university email',
      remainingCodes,
      windowDays: 14,
    });
  } catch (error: any) {
    console.error('Error sending verification OTP:', error.code || 'UNKNOWN');
    return NextResponse.json(
      { error: error.message || 'Failed to send verification code' },
      { status: 500 }
    );
  }
}
