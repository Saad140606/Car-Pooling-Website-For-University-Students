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
const SEND_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes window for rate limiting
const MAX_SENDS_PER_WINDOW = 3;

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

    // Generate OTP
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const now = Date.now();
    const expiresAt = now + OTP_EXPIRY_MS;

    // Store OTP in Firestore with rate limiting
    const db = adminDb ?? getFirestore();
    const verificationRef = db.collection('email_verification_otps').doc(uid);
    const snapshot = await verificationRef.get();
    const data = snapshot.exists ? snapshot.data() : null;

    let sendCount = 0;
    let sendWindowStart = now;
    if (data && data.sendWindowStart && data.sendCount) {
      const windowStart = data.sendWindowStart as number;
      if (now - windowStart <= SEND_LIMIT_WINDOW_MS) {
        sendCount = data.sendCount as number;
        sendWindowStart = windowStart;
      }
    }
    if (sendCount >= MAX_SENDS_PER_WINDOW) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before requesting another code.' },
        { status: 429 }
      );
    }

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
        console.log('Attempting to send email from:', process.env.FIREBASE_EMAIL_USER);
        await transporter.sendMail({
          from: process.env.FIREBASE_EMAIL_USER,
          to: universityEmail,
          subject: 'Your Campus Ride Verification Code',
          html,
        });
        console.log('Verification OTP sent successfully to:', universityEmail);
      } catch (emailError: any) {
        console.error('Failed to send email. Error details:', {
          code: emailError.code,
          message: emailError.message,
          response: emailError.response,
        });
        console.error('Full error:', emailError);
        if (process.env.NODE_ENV === 'development') {
          console.log('Development mode: Returning OTP in response for testing');
          return NextResponse.json({
            success: true,
            message: 'Verification code (dev mode)',
            otp,
          });
        }
        return NextResponse.json(
          { error: `Failed to send email: ${emailError.message}` },
          { status: 500 }
        );
      }
    } else {
      console.log('Email credentials not configured. Development mode - OTP:', otp);
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent',
      otp: (!process.env.FIREBASE_EMAIL_USER || !process.env.FIREBASE_EMAIL_PASSWORD) ? otp : undefined,
    });
  } catch (error: any) {
    console.error('Error sending verification OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send verification code' },
      { status: 500 }
    );
  }
}
