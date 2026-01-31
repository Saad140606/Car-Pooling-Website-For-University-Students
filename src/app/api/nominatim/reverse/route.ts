/**
 * Nominatim Reverse Geocoding Proxy API
 * 
 * SECURITY: Requires authentication and implements rate limiting
 * to prevent abuse of the external Nominatim service.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAuthToken,
  applyRateLimit,
  errorResponse,
} from '@/lib/api-security';

// Rate limit specific to geocoding operations
const GEOCODING_RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 60 * 1000, // 30 requests per minute
  keyPrefix: 'geocoding-reverse',
};

export async function GET(req: NextRequest) {
  // ===== AUTHENTICATION =====
  const authResult = await verifyAuthToken(req);
  if (!authResult.success) {
    return errorResponse('Authentication required', 401);
  }

  // ===== RATE LIMITING =====
  const rateLimitResult = await applyRateLimit(req, GEOCODING_RATE_LIMIT);
  if (rateLimitResult instanceof NextResponse) {
    return rateLimitResult;
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

    const res = await fetch(nomUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'CampusRide/1.0 (carpooling app)',
        'Accept-Language': 'en',
      },
    });

    if (!res.ok) {
      console.error('Nominatim reverse error:', res.status);
      return errorResponse('Geocoding service unavailable', 502);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Nominatim reverse proxy failed:', err.code || 'UNKNOWN');
    return errorResponse('Geocoding service error', 500);
  }
}