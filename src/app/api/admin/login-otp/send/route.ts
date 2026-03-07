import { NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/adminApiAuth';
import { adminDb } from '@/firebase/firebaseAdmin';

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_SENDS = 3;
const ADMIN_OTP_RECEIVER_EMAIL = 'syedsaadnajam2006@gmail.com';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.FIREBASE_EMAIL_USER,
    pass: process.env.FIREBASE_EMAIL_PASSWORD,
  },
});

function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function POST(req: Request) {
  const adminResult = await requireAdmin(req);
  if (!adminResult.ok) return adminResult.response;

  const db = adminDb ?? getFirestore();
  const uid = adminResult.uid;
  const email = adminResult.email;
  const now = Date.now();

  const otpRef = db.collection('admin_login_otps').doc(uid);
  const snap = await otpRef.get();
  const existing = snap.exists ? snap.data() : null;

  const lockedUntil = Number(existing?.lockedUntil || 0);
  if (lockedUntil > now) {
    return NextResponse.json(
      {
        error: 'OTP verification is temporarily locked due to multiple failed attempts.',
        retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000),
      },
      { status: 429 }
    );
  }

  const sendCount = Number(existing?.sendCount || 0);
  if (sendCount >= MAX_SENDS) {
    return NextResponse.json(
      {
        error: 'Maximum OTP send limit reached (3). Complete login with the latest code.',
        remainingSends: 0,
      },
      { status: 429 }
    );
  }

  if (!process.env.FIREBASE_EMAIL_USER || !process.env.FIREBASE_EMAIL_PASSWORD) {
    return NextResponse.json(
      { error: 'Email service is not configured.' },
      { status: 503 }
    );
  }

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = now + OTP_EXPIRY_MS;

  await otpRef.set(
    {
      uid,
      adminEmail: email,
      otpHash,
      expiresAt,
      sendCount: sendCount + 1,
      verifyAttempts: 0,
      lockedUntil: null,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: existing?.createdAt || FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Campus Ride Admin OTP</h2>
      <p>An admin login attempt requires OTP verification.</p>
      <p><strong>Admin Email:</strong> ${email || 'Unknown'}</p>
      <p><strong>Admin UID:</strong> ${uid}</p>
      <div style="margin: 24px 0; text-align: center;">
        <span style="display:inline-block; background:#1d4ed8; color:white; padding:12px 24px; border-radius:8px; letter-spacing:4px; font-size:24px; font-weight:700;">${otp}</span>
      </div>
      <p>This code expires in 10 minutes.</p>
      <p style="color:#64748b; font-size:12px;">If this was not you, change admin credentials immediately.</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.FIREBASE_EMAIL_USER,
    to: ADMIN_OTP_RECEIVER_EMAIL,
    subject: 'Campus Ride Admin Login OTP',
    html,
  });

  return NextResponse.json({
    success: true,
    message: `OTP sent to ${ADMIN_OTP_RECEIVER_EMAIL}`,
    remainingSends: Math.max(0, MAX_SENDS - (sendCount + 1)),
  });
}
