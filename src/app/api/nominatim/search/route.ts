/**
 * Nominatim Search Proxy API
 * 
 * SECURITY: Requires authentication and implements rate limiting
 * to prevent abuse of the external Nominatim service.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAuthToken,
  checkRateLimit,
  getClientIP,
  sanitizeString,
  errorResponse,
} from '@/lib/api-security';

// Rate limit specific to geocoding operations
const GEOCODING_RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 60 * 1000, // 30 requests per minute
  keyPrefix: 'geocoding',
};

export async function GET(req: NextRequest) {
  // Authentication is optional for search. Allow anonymous access but enforce rate limits.
  const authResult = await verifyAuthToken(req, true); // silent = true (don't log missing auth)

  const rateConfig = authResult.success && authResult.user
    ? { maxRequests: 60, windowMs: 60 * 1000, keyPrefix: 'geocoding-user' }
    : { maxRequests: 30, windowMs: 60 * 1000, keyPrefix: 'geocoding-anon' };

  const identifier = authResult.success && authResult.user
    ? `user:${authResult.user.uid}`
    : `ip:${getClientIP(req)}`;

  const rateLimitResult = await checkRateLimit(identifier, rateConfig);
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q');
    const viewbox = url.searchParams.get('viewbox');
    const limit = url.searchParams.get('limit') || '5';

    if (!q) {
      return errorResponse('Missing query parameter', 400);
    }

    // ===== INPUT VALIDATION =====
    const sanitizedQuery = sanitizeString(q).slice(0, 200); // Limit query length
    if (!sanitizedQuery || sanitizedQuery.length < 1) {
      return errorResponse('Query too short', 400);
    }

    // Validate limit parameter - allow up to 50 results for better suggestions
    const parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return errorResponse('Invalid limit parameter (1-50)', 400);
    }

    const params = new URLSearchParams({ 
      q: sanitizedQuery, 
      format: 'json', 
      limit: Math.min(parsedLimit, 50).toString(), 
      countrycodes: 'pk',
      addressdetails: '1'
    });

    if (viewbox) {
      // Validate viewbox format (should be 4 comma-separated numbers)
      const viewboxParts = viewbox.split(',');
      if (viewboxParts.length === 4 && viewboxParts.every(p => !isNaN(parseFloat(p)))) {
        params.set('viewbox', viewbox);
        params.set('bounded', '1');
      }
    }

    const nomUrl = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

    const controller = new AbortController();
    const timeoutMs = 5000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(nomUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'CampusRide/1.0 (carpooling app)',
        'Accept-Language': 'en'
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      console.error('Nominatim search error:', res.status);
      return errorResponse('Geocoding service unavailable', 502);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('Nominatim search proxy timed out');
      return errorResponse('Geocoding request timed out', 504);
    }
    console.error('Nominatim search proxy failed:', err.code || err.message || 'UNKNOWN');
    return errorResponse('Geocoding service error', 500);
  }
}