import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import admin from '@/firebase/firebaseAdmin';

const db = admin.firestore();

const RATE_LIMIT_SECONDS = 60 * 5; // 5 minutes per IP/UID

function sanitizeEmail(email: any) {
  return typeof email === 'string' ? email.trim() : '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = (body.name || '').trim();
    const email = sanitizeEmail(body.email);
    const message = (body.message || '').trim();
    const uid = body.uid || null;
    const isAuthenticated = !!uid;

    // Basic validation
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing name, email or message' }, { status: 400 });
    }
    if (message.length < 10) {
      return NextResponse.json({ error: 'Message too short (minimum 10 characters)' }, { status: 400 });
    }
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // Determine requester IP (support proxied headers). Do not use `req.ip`
    // because `NextRequest` doesn't include that property in Edge/Node types.
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded
      ? forwarded.split(',')[0].trim()
      : (req.headers.get('x-real-ip') || req.headers.get('x-client-ip') || 'unknown');

    // Rate limit key: prefer uid if present, otherwise use IP
    const key = uid ? `uid:${uid}` : `ip:${ip}`;
    const keyRef = db.collection('contact_rate_limits').doc(key);
    const now = admin.firestore.Timestamp.now();
    const docSnap = await keyRef.get();
    if (docSnap.exists) {
      const data = docSnap.data() as any;
      const last = data?.lastSubmitted as any | undefined;
      if (last) {
        const secondsSince = now.seconds - last.seconds;
        if (secondsSince < RATE_LIMIT_SECONDS) {
          return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
        }
      }
    }

    // Persist contact message
    const msg = {
      isAuthenticated,
      uid: uid || null,
      name,
      email,
      message,
      createdAt: now,
      status: 'open' as const,
    };

    await db.collection('contact_messages').add(msg);

    // Update rate limit marker
    await keyRef.set({ lastSubmitted: now }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Contact API error', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

