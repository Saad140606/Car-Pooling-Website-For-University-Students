import admin from '@/firebase/firebaseAdmin';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const COOKIE_NAME = 'admin_session';
const SECRET = process.env.ADMIN_SESSION_SECRET || '';
const TTL = 60 * 60 * 24 * 7; // 7 days

function signPayload(payload: any) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${hmac}`;
}

function verifyToken(token: string) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export async function POST() {
  // Disabled: session endpoint removed per user instruction.
  return NextResponse.json({ ok: false, error: 'session endpoint disabled' }, { status: 404 });
}

export async function DELETE() {
  return NextResponse.json({ ok: false, error: 'session endpoint disabled' }, { status: 404 });
}
