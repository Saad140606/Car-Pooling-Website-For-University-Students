import { NextResponse } from 'next/server';

// Force dynamic behavior to prevent prerendering
export const dynamic = 'force-dynamic';

export async function POST() {
  // Disabled: session endpoint removed per user instruction.
  return NextResponse.json({ ok: false, error: 'session endpoint disabled' }, { status: 404 });
}

export async function DELETE() {
  return NextResponse.json({ ok: false, error: 'session endpoint disabled' }, { status: 404 });
}
