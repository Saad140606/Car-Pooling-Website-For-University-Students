/**
 * API Security Utilities
 * 
 * This module provides authentication, authorization, rate limiting,
 * and input validation utilities for API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/firebase/firebaseAdmin';
import admin from 'firebase-admin';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
  status?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  error?: string;
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Verify Firebase ID token from Authorization header
 * Returns the authenticated user or null if invalid
 * @param req - The request object
 * @param silent - If true, suppress logging for missing auth (useful for optional auth endpoints)
 */
export async function verifyAuthToken(req: NextRequest, silent: boolean = false): Promise<AuthResult> {
  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      // Don't log as error when auth is optional
      if (!silent) {
        console.log('[verifyAuthToken] No authorization header found');
      }
      return { success: false, error: 'Missing authorization header', status: 401 };
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      console.error('[verifyAuthToken] Invalid authorization format');
      return { success: false, error: 'Invalid authorization format', status: 401 };
    }
    
    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    
    if (!token || token.length < 100) {
      return { success: false, error: 'Invalid token format', status: 401 };
    }
    
    if (!adminAuth) {
      console.error('Firebase Admin Auth not initialized');
      return { success: false, error: 'Server configuration error', status: 500 };
    }
    
    const decodedToken = await adminAuth.verifyIdToken(token, true); // checkRevoked = true
    
    return {
      success: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
        emailVerified: decodedToken.email_verified || false,
      },
    };
  } catch (error: any) {
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/id-token-expired') {
      return { success: false, error: 'Token expired', status: 401 };
    }
    if (error.code === 'auth/id-token-revoked') {
      return { success: false, error: 'Token revoked', status: 401 };
    }
    if (error.code === 'auth/argument-error') {
      return { success: false, error: 'Invalid token', status: 401 };
    }
    
    console.error('Token verification error:', error.code || error.message);
    return { success: false, error: 'Authentication failed', status: 401 };
  }
}

/**
 * Require authentication - returns user or throws response
 */
export async function requireAuth(req: NextRequest): Promise<AuthenticatedUser | NextResponse> {
  const result = await verifyAuthToken(req);
  
  if (!result.success || !result.user) {
    return NextResponse.json(
      { error: result.error || 'Unauthorized' },
      { status: result.status || 401 }
    );
  }
  
  return result.user;
}

/**
 * Check if user is an admin
 */
export async function isUserAdmin(uid: string): Promise<boolean> {
  if (!adminDb) return false;
  
  try {
    const adminDoc = await adminDb.collection('admins').doc(uid).get();
    return adminDoc.exists;
  } catch (error) {
    console.error('Admin check error:', error);
    return false;
  }
}

/**
 * Require admin authentication
 */
export async function requireAdmin(req: NextRequest): Promise<AuthenticatedUser | NextResponse> {
  const authResult = await requireAuth(req);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const isAdmin = await isUserAdmin(authResult.uid);
  
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 }
    );
  }
  
  return authResult;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

const RATE_LIMIT_COLLECTION = 'rate_limits';

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key prefix for namespacing different limiters */
  keyPrefix: string;
}

/**
 * Check rate limit for a given key
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!adminDb) {
    // If DB not available, allow request but log warning
    console.warn('Rate limiting unavailable: DB not initialized');
    return { allowed: true, remaining: config.maxRequests, resetAt: Date.now() + config.windowMs };
  }
  
  const fullKey = `${config.keyPrefix}:${key}`;
  const ref = adminDb.collection(RATE_LIMIT_COLLECTION).doc(fullKey);
  const now = Date.now();
  
  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const data = doc.exists ? doc.data() : null;
      
      // Check if we're in a new window
      if (!data || data.windowStart + config.windowMs < now) {
        // Start new window
        tx.set(ref, {
          count: 1,
          windowStart: now,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
          allowed: true,
          remaining: config.maxRequests - 1,
          resetAt: now + config.windowMs,
        };
      }
      
      // Check if limit exceeded
      if (data.count >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: data.windowStart + config.windowMs,
          error: 'Rate limit exceeded',
        };
      }
      
      // Increment counter
      tx.update(ref, {
        count: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      return {
        allowed: true,
        remaining: config.maxRequests - data.count - 1,
        resetAt: data.windowStart + config.windowMs,
      };
    });
    
    return result;
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow request but log
    return { allowed: true, remaining: config.maxRequests, resetAt: now + config.windowMs };
  }
}

/**
 * Apply rate limiting middleware
 */
export async function applyRateLimit(
  req: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult | NextResponse> {
  // Get identifier: authenticated user ID or IP address (silent mode to avoid logging)
  const authResult = await verifyAuthToken(req, true);
  const identifier = authResult.success && authResult.user
    ? `user:${authResult.user.uid}`
    : `ip:${getClientIP(req)}`;
  
  const result = await checkRateLimit(identifier, config);
  
  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetAt.toString(),
          'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }
  
  return result;
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .slice(0, 10000); // Limit length
}

/**
 * Validate and sanitize university parameter
 */
export function validateUniversity(university: unknown): 'NED' | 'FAST' | null {
  if (typeof university !== 'string') return null;
  
  const normalized = university.toUpperCase();
  if (normalized === 'NED' || normalized === 'FAST') {
    return normalized;
  }
  
  // Also handle lowercase variants
  const lowerNorm = university.toLowerCase();
  if (lowerNorm === 'ned') return 'NED';
  if (lowerNorm === 'fast') return 'FAST';
  
  return null;
}

/**
 * Validate Firebase document ID format
 */
export function isValidDocId(id: unknown): boolean {
  if (typeof id !== 'string') return false;
  // Firebase doc IDs: 1-1500 chars, no forward slashes
  return id.length >= 1 && id.length <= 1500 && !id.includes('/');
}

/**
 * Validate email format
 */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get client IP address from request
 * Handles various proxy headers securely
 */
export function getClientIP(req: NextRequest): string {
  // Check standard headers in order of preference
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // Take only the first IP (client IP before proxies)
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    const clientIP = ips[0];
    // Basic validation - should look like an IP
    if (/^[\d.:a-fA-F]+$/.test(clientIP)) {
      return clientIP;
    }
  }
  
  const xRealIP = req.headers.get('x-real-ip');
  if (xRealIP && /^[\d.:a-fA-F]+$/.test(xRealIP)) {
    return xRealIP;
  }
  
  // Fallback
  return 'unknown';
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
): NextResponse {
  const body: Record<string, unknown> = { error: message };
  
  // Only include details in development
  if (process.env.NODE_ENV === 'development' && details) {
    body.details = details;
  }
  
  return NextResponse.json(body, { status });
}

/**
 * Create a standardized success response
 */
export function successResponse(
  data: Record<string, unknown>,
  status: number = 200
): NextResponse {
  return NextResponse.json(data, { status });
}

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

// ============================================================================
// COMMON RATE LIMIT CONFIGS
// ============================================================================

export const RATE_LIMITS = {
  // For authentication endpoints (login, signup)
  AUTH: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyPrefix: 'auth',
  },
  // For OTP verification attempts
  OTP_VERIFY: {
    maxRequests: 5,
    windowMs: 5 * 60 * 1000, // 5 minutes
    keyPrefix: 'otp-verify',
  },
  // For OTP send requests
  OTP_SEND: {
    maxRequests: 3,
    windowMs: 10 * 60 * 1000, // 10 minutes
    keyPrefix: 'otp-send',
  },
  // For general API requests
  API: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'api',
  },
  // For ride request actions
  RIDE_ACTION: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'ride-action',
  },
  // For contact form
  CONTACT: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'contact',
  },
} as const;
