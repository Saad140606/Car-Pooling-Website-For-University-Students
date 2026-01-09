import { NextResponse } from 'next/server';

// /api/admin/verify disabled — user requested no server-side admin verification.
export async function POST(_req: Request) {
  return NextResponse.json({ ok: false, error: 'admin verify disabled' }, { status: 404 });
}
