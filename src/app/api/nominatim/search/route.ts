/**
 * Nominatim Search Proxy API
 * 
 * SECURITY: Requires authentication and implements rate limiting
 * to prevent abuse of the external Nominatim service.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAuthToken,
  applyRateLimit,
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

    const res = await fetch(nomUrl, {
      method: 'GET',
      headers: { 
        'User-Agent': 'CampusRide/1.0 (carpooling app)', 
        'Accept-Language': 'en' 
      },
    });

    if (!res.ok) {
      console.error('Nominatim search error:', res.status);
      return errorResponse('Geocoding service unavailable', 502);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Nominatim search proxy failed:', err.code || 'UNKNOWN');
    return errorResponse('Geocoding service error', 500);
  }
}