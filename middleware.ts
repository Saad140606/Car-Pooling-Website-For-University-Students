import { NextResponse } from 'next/server';

// Middleware no-op: user requested no middleware-based admin blocking.
export async function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
