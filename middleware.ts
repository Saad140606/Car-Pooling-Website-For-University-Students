/**
 * Next.js Middleware for Security
 * 
 * This middleware adds security headers to all responses and
 * implements basic protection for the application.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Security headers to add to all responses
const securityHeaders = {
  // Prevent XSS attacks
  'X-XSS-Protection': '1; mode=block',
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Permissions policy (restrict dangerous APIs)
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=()',
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add HSTS header for HTTPS connections
  if (request.nextUrl.protocol === 'https:') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  // Block access to sensitive paths
  const pathname = request.nextUrl.pathname;
  
  // Block direct access to API internals
  if (pathname.includes('/_next/') && pathname.includes('.map')) {
    return new NextResponse(null, { status: 404 });
  }

  // Block access to common vulnerability probes
  const blockedPaths = [
    '/.env',
    '/.git',
    '/wp-admin',
    '/wp-login',
    '/xmlrpc.php',
    '/admin.php',
    '/config.php',
    '/.htaccess',
    '/web.config',
  ];

  if (blockedPaths.some(blocked => pathname.toLowerCase().startsWith(blocked))) {
    return new NextResponse(null, { status: 404 });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
