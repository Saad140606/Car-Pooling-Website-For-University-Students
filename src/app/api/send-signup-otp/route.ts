import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { adminDb } from '@/firebase/firebaseAdmin';
import { getUniversityEmailDomain } from '@/lib/university-verification';

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
const SEND_LIMIT_WINDOW_MS = 10 * 60 * 1000;
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
    const { uid, email, university } = await request.json();

    if (!uid || !email || !university) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const now = Date.now();
    const expiresAt = now + OTP_EXPIRY_MS;

    const db = adminDb ?? getFirestore();

    // ===== CRITICAL FIX: Check if email already exists in another university =====
    // This prevents a user registered at FAST from signing up at NED with the same email
    const otherUniversity = university === 'fast' ? 'ned' : 'fast';
    const otherUniUsersRef = db.collection('universities').doc(otherUniversity).collection('users');
    const existingUserQuery = await otherUniUsersRef.where('email', '==', email).limit(1).get();
    
    if (!existingUserQuery.empty) {
      console.warn(`Email ${email} already registered at ${otherUniversity} university`);
      return NextResponse.json(
        { 
          error: `This email is already registered with ${otherUniversity === 'fast' ? 'FAST' : 'NED'} University. Please use a different email or sign in to your existing account.`
        },
        { status: 409 } // Conflict status code
      );
    }
    // ===== END CRITICAL FIX =====
    const signupOtpRef = db.collection('signup_otps').doc(uid);
    const snapshot = await signupOtpRef.get();
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

    await signupOtpRef.set({
      uid,
      email,
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

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3F51B5;">Welcome to Campus Ride!</h2>
        <p>Hello,</p>
        <p>Use the code below to verify your email and complete your registration. It expires in 10 minutes.</p>
        <p style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; background: #3F51B5; color: white; padding: 12px 24px; font-size: 20px; letter-spacing: 4px; border-radius: 6px;">${otp}</span>
        </p>
        <p style="color: #666; font-size: 12px;">If you didn't create this account, you can ignore this email.</p>
        <p style="color: #666; font-size: 12px;">Campus Ride - Carpooling for University Students</p>
      </div>
    `;

    if (process.env.FIREBASE_EMAIL_USER && process.env.FIREBASE_EMAIL_PASSWORD) {
      try {
        console.log('Attempting to send email from:', process.env.FIREBASE_EMAIL_USER);
        await transporter.sendMail({
          from: process.env.FIREBASE_EMAIL_USER,
          to: email,
          subject: 'Verify Your Campus Ride Email',
          html,
        });
        console.log('Signup OTP sent successfully to:', email);
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
      otp: !process.env.FIREBASE_EMAIL_USER || !process.env.FIREBASE_EMAIL_PASSWORD ? otp : undefined,
    });
  } catch (error: any) {
    console.error('Error sending signup OTP:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send verification code' },
      { status: 500 }
    );
  }
}
