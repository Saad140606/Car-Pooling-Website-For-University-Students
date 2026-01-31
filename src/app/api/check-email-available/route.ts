/**
 * Check Email Availability API
 * 
 * SECURITY: Implements rate limiting to prevent email enumeration attacks.
 * Returns minimal information to avoid information disclosure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/firebaseAdmin';
import {
  applyRateLimit,
  isValidEmail,
  getClientIP,
  errorResponse,
  successResponse,
} from '@/lib/api-security';

// Strict rate limiting for email checking to prevent enumeration
const EMAIL_CHECK_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 10 requests per minute
  keyPrefix: 'email-check',
};

export async function POST(request: NextRequest) {
  // ===== RATE LIMITING =====
  // Use IP-based rate limiting since this is a pre-auth endpoint
  const clientIP = getClientIP(request);
  const rateLimitResult = await applyRateLimit(request, {
    ...EMAIL_CHECK_RATE_LIMIT,
    keyPrefix: `email-check:${clientIP}`,
  });
  if (rateLimitResult instanceof NextResponse) {
    return rateLimitResult;
  }

  try {
    const { email, university } = await request.json();

    // ===== INPUT VALIDATION =====
    if (!email || !university) {
      return errorResponse('Missing required fields', 400);
    }

    if (!isValidEmail(email)) {
      return errorResponse('Invalid email format', 400);
    }

    // Validate university
    const normalizedUniversity = String(university).toLowerCase();
    if (!['fast', 'ned'].includes(normalizedUniversity)) {
      return errorResponse('Invalid university', 400);
    }

    const db = adminDb ?? getFirestore();
    const normalizedEmail = email.toLowerCase().trim();

    // Check BOTH universities to see if email is already registered
    const universities = ['fast', 'ned'];
    
    for (const uni of universities) {
      const usersRef = db.collection('universities').doc(uni).collection('users');
      const existingQuery = await usersRef.where('email', '==', normalizedEmail).limit(1).get();
      
      if (!existingQuery.empty) {
        // SECURITY: Don't reveal which university the email is registered with
        // This prevents information disclosure
        return successResponse({
          available: false,
          // Generic message that doesn't reveal specific university
          message: 'This email is already registered. Please use a different email or sign in.'
        });
      }
    }

    // Email is available
    return successResponse({ available: true });
  } catch (error: any) {
    // SECURITY: Generic error message
    console.error('Email check error:', error.code || 'UNKNOWN');
    return errorResponse('Unable to verify email. Please try again.', 500);
  }
}
