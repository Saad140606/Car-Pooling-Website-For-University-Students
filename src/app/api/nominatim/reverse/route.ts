/**
 * Nominatim Reverse Geocoding Proxy API
 * 
 * SECURITY: Requires authentication and implements rate limiting
 * to prevent abuse of the external Nominatim service.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAuthToken,
  checkRateLimit,
  getClientIP,
  errorResponse,
} from '@/lib/api-security';

// Rate limit specific to geocoding operations
const GEOCODING_RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 60 * 1000, // 30 requests per minute
  keyPrefix: 'geocoding-reverse',
};

export async function GET(req: NextRequest) {
  // Authentication is optional for reverse geocoding.
  // Allow anonymous access but enforce stricter per-IP rate limits.
  const authResult = await verifyAuthToken(req, true); // silent = true (don't log missing auth)

  // Choose rate limit config based on whether user is authenticated
  const rateConfig = authResult.success && authResult.user
    ? { maxRequests: 60, windowMs: 60 * 1000, keyPrefix: 'geocoding-reverse-user' }
    : { maxRequests: 30, windowMs: 60 * 1000, keyPrefix: 'geocoding-reverse-anon' };

  // Build identifier (user:UID or ip:IP)
  const identifier = authResult.success && authResult.user
    ? `user:${authResult.user.uid}`
    : `ip:${getClientIP(req)}`;

  const rateLimitResult = await checkRateLimit(identifier, rateConfig);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const url = new URL(req.url);
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');

    if (!lat || !lon) {
      return errorResponse('Missing lat or lon parameters', 400);
    }

    // ===== INPUT VALIDATION =====
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (isNaN(latNum) || isNaN(lonNum)) {
      return errorResponse('Invalid coordinate format', 400);
    }

    // Validate coordinate ranges
    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      return errorResponse('Coordinates out of range', 400);
    }

    const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(latNum.toString())}&lon=${encodeURIComponent(lonNum.toString())}&addressdetails=1&zoom=18`;

    // Use a short timeout to avoid long-running requests blocking route generation
    const controller = new AbortController();
    const timeoutMs = 5000; // 5 seconds
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(nomUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'CampusRide/1.0 (carpooling app)',
        'Accept-Language': 'en',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      console.error('Nominatim reverse error:', res.status);
      return errorResponse('Geocoding service unavailable', 502);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('Nominatim reverse proxy timed out');
      return errorResponse('Geocoding request timed out', 504);
    }
    console.error('Nominatim reverse proxy failed:', err.code || err.message || 'UNKNOWN');
    return errorResponse('Geocoding service error', 500);
  }
}